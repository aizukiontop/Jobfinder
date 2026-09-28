import { nowIso } from './db.js'
import { audit, getPreferences } from './panel.js'

const DISABLED_NOTE = 'Email sending is turned off, so this message was not sent.'

export function createNotifications(db, mailer, { enabled = false, batchSize = 3, maxAttempts = 3 } = {}) {
  const mailEnabled = enabled === true && mailer.enabled === true
  let running = null
  let stopped = false

  function wantsEmail(userId) {
    const user = db.prepare('SELECT is_active FROM users WHERE id=?').get(userId)
    return Boolean(user?.is_active) && getPreferences(db, userId).notificationEmails
  }

  function enqueue({ eventKey, eventType, userId, subject, text }) {
    if (!userId) return null
    const user = db.prepare('SELECT id,email FROM users WHERE id=?').get(userId)
    if (!user) return null
    const status = !wantsEmail(user.id) ? 'opted-out' : mailEnabled ? 'queued' : 'disabled'
    const timestamp = nowIso()
    const result = db.prepare(`
      INSERT OR IGNORE INTO notification_outbox(event_key,event_type,recipient_user_id,recipient,subject,text_body,
        status,last_error,available_at,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(eventKey, eventType, user.id, user.email, subject, text, status,
      status === 'disabled' ? DISABLED_NOTE : '', timestamp, timestamp, timestamp)
    return result.changes ? Number(result.lastInsertRowid) : null
  }

  function claimNext() {
    return db.transaction(() => {
      const item = db.prepare(`
        SELECT * FROM notification_outbox WHERE status IN ('queued','retry') AND available_at<=? ORDER BY id LIMIT 1
      `).get(nowIso())
      if (!item) return null
      if (!mailEnabled || !wantsEmail(item.recipient_user_id)) {
        const status = mailEnabled ? 'opted-out' : 'disabled'
        db.prepare('UPDATE notification_outbox SET status=?,last_error=?,updated_at=? WHERE id=?')
          .run(status, status === 'disabled' ? DISABLED_NOTE : '', nowIso(), item.id)
        return { skipped: true }
      }
      db.prepare("UPDATE notification_outbox SET status='sending',attempts=attempts+1,claimed_at=?,updated_at=? WHERE id=?")
        .run(nowIso(), nowIso(), item.id)
      return { ...item, attempts: item.attempts + 1 }
    })()
  }

  async function runBatch() {
    const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString()
    db.prepare(`
      UPDATE notification_outbox SET status=CASE WHEN attempts>=? THEN 'failed' ELSE 'retry' END,
        last_error='The previous attempt was interrupted.',updated_at=?
      WHERE status='sending' AND claimed_at<?
    `).run(maxAttempts, nowIso(), staleBefore)

    for (let count = 0; count < batchSize && !stopped; count++) {
      const item = claimNext()
      if (!item) break
      if (item.skipped) continue
      try {
        await mailer.send({
          to: item.recipient, subject: item.subject, text: item.text_body,
          idempotencyKey: `jobfinder-outbox-${item.event_key}`,
        })
        db.transaction(() => {
          db.prepare("UPDATE notification_outbox SET status='accepted',last_error='',updated_at=? WHERE id=?").run(nowIso(), item.id)
          audit(db, null, 'notification.accepted', 'notification', item.id,
            'The email provider accepted a notification. Inbox delivery is not confirmed.', { attempts: item.attempts })
        })()
      } catch {
        const failed = item.attempts >= maxAttempts
        const retryAt = new Date(Date.now() + 60_000 * 2 ** item.attempts).toISOString()
        db.prepare('UPDATE notification_outbox SET status=?,last_error=?,available_at=?,updated_at=? WHERE id=?')
          .run(failed ? 'failed' : 'retry', 'The email request failed. Provider details are not stored.', retryAt, nowIso(), item.id)
      }
    }
  }

  function processBatch() {
    if (stopped) return Promise.resolve()
    if (!running) running = runBatch().finally(() => { running = null })
    return running
  }

  function stop() {
    stopped = true
    return running ?? Promise.resolve()
  }

  return { enabled: mailEnabled, enqueue, processBatch, stop }
}

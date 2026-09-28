import { randomUUID } from 'node:crypto'
import { nowIso } from './db.js'
import { ApiError } from './security.js'

export const PUBLIC_JOB_SQL = "status='active' AND review_status IN ('legacy','approved') " +
  'AND (owner_user_id IS NULL OR owner_user_id IN (SELECT id FROM users WHERE is_active=1))'

const DETAIL_FIELDS = new Set(['fields', 'fromStatus', 'toStatus', 'fromReview', 'toReview', 'version',
  'skillWeightPercent', 'notificationEmails', 'decision', 'jobId', 'applicationId', 'source', 'attempts'])

const DECISION_WORDS = { approve: 'approved', reject: 'rejected', suspend: 'suspended', archive: 'archived' }

export function audit(db, actor, action, targetType, targetId, summary, details = {}) {
  const safe = Object.fromEntries(Object.entries(details).filter(([key]) => DETAIL_FIELDS.has(key)))
  db.prepare(`
    INSERT INTO audit_events(actor_id,actor_label,action,target_type,target_id,summary,details_json,created_at)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(actor?.id ?? null, actor ? actor.email : 'system', action, targetType, String(targetId), summary, JSON.stringify(safe), nowIso())
}

export function createAdminAccount(db, { email, passwordHash, officeName }) {
  const address = String(email).trim().toLowerCase()
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(address)) {
    throw new Error('That email already has a JobFinder account. Use a different email for the PESO administrator.')
  }
  const id = randomUUID()
  const timestamp = nowIso()
  db.transaction(() => {
    db.prepare("INSERT INTO users(id,email,password_hash,role,created_at,updated_at) VALUES (?,?,?,'admin',?,?)")
      .run(id, address, passwordHash, timestamp, timestamp)
    db.prepare('INSERT INTO admin_profiles(user_id,office_name,updated_at) VALUES (?,?,?)')
      .run(id, officeName, timestamp)
    audit(db, null, 'admin.created', 'user', id, `PESO administrator account created for ${officeName}.`)
  })()
  return id
}

export function getPreferences(db, userId) {
  const row = db.prepare('SELECT * FROM user_preferences WHERE user_id=?').get(userId)
  return {
    skillWeightPercent: row ? row.skill_weight_percent : 70,
    notificationEmails: row ? row.notification_emails === 1 : true,
  }
}

export function pagination(query) {
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1)
  const limit = Math.max(1, Math.min(100, Number.parseInt(query.limit ?? '25', 10) || 25))
  return { page, limit, offset: (page - 1) * limit }
}

export function maskEmail(email) {
  const [name, domain] = String(email).split('@')
  return `${name.slice(0, 1)}***@${domain ?? 'hidden'}`
}

function validPreferences(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false
  if (Object.keys(body).some((key) => key !== 'skillWeightPercent' && key !== 'notificationEmails')) return false
  if ('skillWeightPercent' in body) {
    const value = body.skillWeightPercent
    if (!Number.isInteger(value) || value < 0 || value > 100) return false
  }
  if ('notificationEmails' in body && typeof body.notificationEmails !== 'boolean') return false
  return true
}

export function registerPanelRoutes(app, { db, requireAuth, requireAdmin, jobDto, notifications }) {
  app.get('/api/me/preferences', requireAuth, (req, res) => {
    res.json({ preferences: getPreferences(db, req.auth.id) })
  })

  app.patch('/api/me/preferences', requireAuth, (req, res, next) => {
    if (!validPreferences(req.body)) {
      return next(new ApiError(400, 'VALIDATION_ERROR',
        'Skill weight must be a whole number from 0 to 100, and email notifications must be on or off.'))
    }
    const old = getPreferences(db, req.auth.id)
    const preferences = { ...old, ...req.body }
    const changed = Object.keys(req.body).filter((key) => old[key] !== preferences[key])
    if (changed.length) {
      db.transaction(() => {
        db.prepare(`
          INSERT INTO user_preferences(user_id,skill_weight_percent,notification_emails,updated_at) VALUES (?,?,?,?)
          ON CONFLICT(user_id) DO UPDATE SET skill_weight_percent=excluded.skill_weight_percent,
            notification_emails=excluded.notification_emails, updated_at=excluded.updated_at
        `).run(req.auth.id, preferences.skillWeightPercent, preferences.notificationEmails ? 1 : 0, nowIso())
        audit(db, req.auth, 'preferences.updated', 'user', req.auth.id, 'Recommendation or email preferences updated.',
          { fields: changed, ...preferences })
      })()
    }
    res.json({ preferences })
  })

  app.get('/api/admin/jobs', requireAuth, requireAdmin, (req, res) => {
    const { page, limit, offset } = pagination(req.query)
    const where = ["status <> 'draft'"]
    const params = []
    if (req.query.reviewStatus) { where.push('review_status=?'); params.push(String(req.query.reviewStatus)) }
    if (req.query.dataSource) { where.push('data_source=?'); params.push(String(req.query.dataSource)) }
    if (req.query.category) { where.push('category=?'); params.push(String(req.query.category)) }
    if (req.query.ownerId) { where.push('owner_user_id=?'); params.push(String(req.query.ownerId)) }
    if (req.query.q) {
      const text = `%${String(req.query.q).slice(0, 200).toLowerCase()}%`
      where.push('(lower(title) LIKE ? OR lower(company) LIKE ?)')
      params.push(text, text)
    }
    const clause = `WHERE ${where.join(' AND ')}`
    const total = db.prepare(`SELECT count(*) AS n FROM jobs ${clause}`).get(...params).n
    const rows = db.prepare(`SELECT * FROM jobs ${clause} ORDER BY updated_at DESC, id LIMIT ? OFFSET ?`)
      .all(...params, limit, offset)
    res.json({ items: rows.map((row) => jobDto(db, row)), total, page, limit })
  })

  app.post('/api/admin/jobs/:jobId/review', requireAuth, requireAdmin, (req, res, next) => {
    const body = req.body ?? {}
    const decision = body.decision
    const reason = typeof body.reason === 'string' ? body.reason.trim() : null
    const valid = Object.hasOwn(DECISION_WORDS, decision) && reason !== null && reason.length <= 2000 &&
      Number.isInteger(body.expectedVersion) && body.expectedVersion > 0 &&
      (decision === 'approve' || reason.length > 0) &&
      Object.keys(body).every((key) => ['decision', 'reason', 'expectedVersion'].includes(key))
    if (!valid) {
      return next(new ApiError(400, 'VALIDATION_ERROR', 'Choose a decision and give a reason. A reason is optional only for approval.'))
    }
    try {
      const updated = db.transaction(() => {
        const job = db.prepare('SELECT * FROM jobs WHERE id=?').get(req.params.jobId)
        if (!job) throw new ApiError(404, 'JOB_NOT_FOUND', 'Job not found.')
        if (job.review_version !== body.expectedVersion) {
          throw new ApiError(409, 'STALE_REVIEW', 'This posting changed after you opened it. Refresh and review the current version.')
        }
        if (decision === 'approve' && (job.status !== 'active' || !['pending', 'rejected', 'suspended'].includes(job.review_status))) {
          throw new ApiError(409, 'INVALID_REVIEW_STATE', 'Only submitted postings can be approved. Existing postings are already exempt.')
        }
        if (decision === 'reject' && job.review_status !== 'pending') {
          throw new ApiError(409, 'INVALID_REVIEW_STATE', 'Only postings waiting for review can be rejected. Use suspend or archive instead.')
        }
        if (decision === 'archive' && job.status === 'closed') {
          throw new ApiError(409, 'INVALID_REVIEW_STATE', 'This posting is already closed.')
        }
        const review = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'suspended'
        const status = decision === 'archive' ? 'closed' : job.status
        const version = job.review_version + 1
        const timestamp = nowIso()
        db.prepare(`
          UPDATE jobs SET review_status=?,review_reason=?,review_version=?,status=?,
            date_posted=CASE WHEN ?='approved' THEN COALESCE(date_posted,?) ELSE date_posted END,updated_at=?
          WHERE id=?
        `).run(review, reason, version, status, review, timestamp.slice(0, 10), timestamp, job.id)
        audit(db, req.auth, `job.${decision}`, 'job', job.id, `Job posting "${job.title}" ${DECISION_WORDS[decision]}.`, {
          decision, fromStatus: job.status, toStatus: status, fromReview: job.review_status, toReview: review, version,
        })
        const office = db.prepare('SELECT office_name FROM admin_profiles WHERE user_id=?').get(req.auth.id)?.office_name ?? 'PESO Angeles City'
        notifications.enqueue({
          eventKey: `job-review:${job.id}:${version}`,
          eventType: 'posting-review',
          userId: job.owner_user_id,
          subject: `Your JobFinder posting was ${DECISION_WORDS[decision]}`,
          text: [
            `Your job posting "${job.title}" was ${DECISION_WORDS[decision]} by ${office}.`,
            reason ? `Reason: ${reason}` : '',
            'Sign in to JobFinder to see the posting.',
          ].filter(Boolean).join('\n'),
        })
        return db.prepare('SELECT * FROM jobs WHERE id=?').get(job.id)
      })()
      res.json({ job: jobDto(db, updated) })
    } catch (error) { next(error) }
  })

  app.get('/api/admin/summary', requireAuth, requireAdmin, (req, res) => {
    const count = (sql, ...params) => db.prepare(sql).get(...params).n
    const recentSubmissions = db.prepare(`
      SELECT * FROM jobs WHERE review_status='pending' AND status='active' ORDER BY updated_at DESC LIMIT 5
    `).all()
    const recentActivity = db.prepare('SELECT * FROM audit_events ORDER BY id DESC LIMIT 6').all()
    res.json({
      pendingReviews: count("SELECT count(*) AS n FROM jobs WHERE review_status='pending' AND status='active'"),
      publishedJobs: count(`SELECT count(*) AS n FROM jobs WHERE ${PUBLIC_JOB_SQL}`),
      employers: count("SELECT count(*) AS n FROM users WHERE role='employer'"),
      suspendedEmployers: count("SELECT count(*) AS n FROM users WHERE role='employer' AND is_active=0"),
      jobSeekers: count("SELECT count(*) AS n FROM users WHERE role='job-seeker'"),
      applications: count('SELECT count(*) AS n FROM applications'),
      recentSubmissions: recentSubmissions.map((row) => jobDto(db, row)),
      recentActivity: recentActivity.map((row) => ({
        id: row.id, actorLabel: row.actor_label, action: row.action, summary: row.summary, createdAt: row.created_at,
      })),
    })
  })

  app.get('/api/admin/employers', requireAuth, requireAdmin, (req, res) => {
    const { page, limit, offset } = pagination(req.query)
    const where = ["u.role='employer'"]
    const params = []
    if (req.query.status === 'active') where.push('u.is_active=1')
    if (req.query.status === 'suspended') where.push('u.is_active=0')
    if (req.query.q) {
      const text = `%${String(req.query.q).slice(0, 200).toLowerCase()}%`
      where.push('(lower(e.company_name) LIKE ? OR lower(u.email) LIKE ? OR lower(e.contact_name) LIKE ?)')
      params.push(text, text, text)
    }
    const clause = `FROM users u JOIN employer_profiles e ON e.user_id=u.id WHERE ${where.join(' AND ')}`
    const total = db.prepare(`SELECT count(*) AS n ${clause}`).get(...params).n
    const rows = db.prepare(`
      SELECT u.id, u.email, u.is_active, u.status_reason, u.created_at,
        e.company_name, e.contact_name, e.industry, e.contact_email, e.contact_phone, e.address, e.website,
        (SELECT count(*) FROM jobs j WHERE j.owner_user_id=u.id AND j.status <> 'draft') AS postings,
        (SELECT count(*) FROM jobs j WHERE j.owner_user_id=u.id AND u.is_active=1 AND j.status='active' AND j.review_status IN ('legacy','approved')) AS published,
        (SELECT count(*) FROM jobs j WHERE j.owner_user_id=u.id AND j.status='active' AND j.review_status='pending') AS pending,
        (SELECT count(*) FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.owner_user_id=u.id) AS applications,
        (SELECT max(sn.last_seen_at) FROM sessions sn WHERE sn.user_id=u.id) AS last_seen
      ${clause} ORDER BY e.company_name COLLATE NOCASE LIMIT ? OFFSET ?
    `).all(...params, limit, offset)
    res.json({
      items: rows.map((row) => ({
        id: row.id, email: row.email, active: row.is_active === 1, statusReason: row.status_reason,
        companyName: row.company_name, contactName: row.contact_name, industry: row.industry,
        contactEmail: row.contact_email, contactPhone: row.contact_phone, address: row.address, website: row.website,
        postings: row.postings, published: row.published, pending: row.pending, applications: row.applications,
        createdAt: row.created_at, lastSeen: row.last_seen,
      })),
      total, page, limit,
    })
  })

  app.patch('/api/admin/employers/:userId/status', requireAuth, requireAdmin, (req, res, next) => {
    const body = req.body ?? {}
    const reason = typeof body.reason === 'string' ? body.reason.trim() : null
    const valid = typeof body.active === 'boolean' && reason !== null && reason.length <= 1000 &&
      (body.active || reason.length > 0) &&
      Object.keys(body).every((key) => key === 'active' || key === 'reason')
    if (!valid) {
      return next(new ApiError(400, 'VALIDATION_ERROR', 'Give a reason when suspending an employer.'))
    }
    const employer = db.prepare(`
      SELECT u.id, u.is_active, e.company_name FROM users u JOIN employer_profiles e ON e.user_id=u.id
      WHERE u.id=? AND u.role='employer'
    `).get(req.params.userId)
    if (!employer) return next(new ApiError(404, 'EMPLOYER_NOT_FOUND', 'Employer not found.'))
    const wasActive = employer.is_active === 1
    db.transaction(() => {
      db.prepare('UPDATE users SET is_active=?,status_reason=?,updated_at=? WHERE id=?')
        .run(body.active ? 1 : 0, body.active ? '' : reason, nowIso(), employer.id)
      if (!body.active) db.prepare('DELETE FROM sessions WHERE user_id=?').run(employer.id)
      if (wasActive !== body.active) {
        audit(db, req.auth, body.active ? 'employer.reactivated' : 'employer.suspended', 'user', employer.id,
          `Employer "${employer.company_name}" ${body.active ? 'reactivated' : 'suspended'}.`,
          { fromStatus: wasActive ? 'active' : 'suspended', toStatus: body.active ? 'active' : 'suspended' })
      }
    })()
    res.json({ id: employer.id, active: body.active, statusReason: body.active ? '' : reason })
  })

  app.get('/api/admin/audit', requireAuth, requireAdmin, (req, res) => {
    const { page, limit, offset } = pagination(req.query)
    const action = String(req.query.action ?? '').trim()
    const where = action ? 'WHERE action=?' : ''
    const params = action ? [action] : []
    const total = db.prepare(`SELECT count(*) AS n FROM audit_events ${where}`).get(...params).n
    const items = db.prepare(`SELECT * FROM audit_events ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset)
      .map((row) => ({
        id: row.id, actorId: row.actor_id, actorLabel: row.actor_label, action: row.action,
        targetType: row.target_type, targetId: row.target_id, summary: row.summary,
        details: JSON.parse(row.details_json), createdAt: row.created_at,
      }))
    res.json({ items, total, page, limit })
  })

  app.get('/api/admin/notifications', requireAuth, requireAdmin, (req, res) => {
    const { page, limit, offset } = pagination(req.query)
    const total = db.prepare('SELECT count(*) AS n FROM notification_outbox').get().n
    const items = db.prepare(`
      SELECT id,event_type,recipient,status,attempts,last_error,created_at FROM notification_outbox
      ORDER BY id DESC LIMIT ? OFFSET ?
    `).all(limit, offset).map((row) => ({
      id: row.id, eventType: row.event_type, recipient: maskEmail(row.recipient), status: row.status,
      attempts: row.attempts, lastError: row.last_error, createdAt: row.created_at,
    }))
    res.json({ items, total, page, limit, mailEnabled: notifications.enabled })
  })
}

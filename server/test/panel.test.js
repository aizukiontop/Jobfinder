import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import Database from 'better-sqlite3'
import { createApp } from '../app.js'
import { createNotifications } from '../notifications.js'
import { createAdminAccount } from '../panel.js'
import { hashPassword } from '../security.js'

const origin = 'http://127.0.0.1'
const VERIFIED_JOBS = JSON.parse(readFileSync(new URL('../../src/data/jobs.verified.json', import.meta.url), 'utf8'))
const roots = []

const fakeMailer = {
  enabled: true,
  sent: [],
  failNext: 0,
  async send(message) {
    if (this.failNext > 0) {
      this.failNext -= 1
      throw new Error('fake provider outage')
    }
    this.sent.push(message)
  },
}

function tempRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'jobfinder-panel-test-'))
  roots.push(root)
  return root
}

async function startApp(root, overrides = {}) {
  const api = createApp({
    host: '127.0.0.1', port: 0,
    dbPath: path.join(root, 'jobfinder.sqlite'),
    uploadDir: path.join(root, 'uploads'),
    appOrigin: origin,
    sessionTtlSeconds: 3600,
    rememberTtlSeconds: 7200,
    secureCookies: false,
    seedOnStart: true,
    authRateLimit: 1000,
    resetTokenTtlSeconds: 1800,
    mailer: fakeMailer,
    ...overrides,
  })
  const server = createServer(api.app)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  return {
    api,
    stop: async () => {
      await new Promise((resolve) => server.close(resolve))
      api.close()
    },
    async call(route, { method = 'GET', cookie, body, form } = {}) {
      const headers = {}
      if (cookie) headers.cookie = cookie
      if (method !== 'GET') headers.origin = origin
      if (body !== undefined) headers['content-type'] = 'application/json'
      const response = await fetch(`${baseUrl}${route}`, {
        method, headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
      })
      const text = await response.text()
      const isJson = (response.headers.get('content-type') ?? '').includes('json')
      return { status: response.status, data: isJson && text ? JSON.parse(text) : null, headers: response.headers }
    },
  }
}

async function register(app, body) {
  const response = await app.call('/api/auth/register', { method: 'POST', body: { password: 'TestPass2026', ...body } })
  assert.equal(response.status, 201, JSON.stringify(response.data))
  const cookie = response.headers.get('set-cookie').match(/jf_session=[^;]+/)[0]
  return { id: response.data.account.id, isAdmin: response.data.account.isAdmin, cookie }
}

function jobBody(overrides = {}) {
  return {
    status: 'active', title: 'Inventory Clerk', category: 'Administrative',
    description: 'Keep stock records accurate.', responsibilities: ['Count stock'],
    requirements: ['Relevant experience'], benefits: [], requiredSkills: ['Inventory Management'],
    preferredSkills: [], employmentType: 'Full-time', workArrangement: 'On-site',
    experienceLevel: 'Associate', location: 'Pulung Cacutud, Angeles City', city: 'Angeles City',
    province: 'Pampanga', barangay: 'Pulung Cacutud', address: 'Angeles Livelihood Complex',
    salary: 'Negotiable', salaryMin: null, salaryMax: null, openings: 1,
    applicationDeadline: '2099-12-31', lat: 15.16, lng: 120.57, coordinateSource: 'exact-address',
    ...overrides,
  }
}

function resumeForm() {
  const form = new FormData()
  form.set('firstName', 'Ana')
  form.set('lastName', 'Cruz')
  form.set('email', 'ana.panel@example.com')
  form.set('resume', new Blob(['%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'], { type: 'application/pdf' }), 'resume.pdf')
  return form
}

function outbox(db) {
  return db.prepare('SELECT * FROM notification_outbox ORDER BY id').all()
}

test('migration keeps existing postings, applications and saves exactly as they were', async () => {
  const root = tempRoot()
  const dbPath = path.join(root, 'jobfinder.sqlite')
  const verified = VERIFIED_JOBS[0]
  const old = new Database(dbPath)
  old.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8')
    .replace("CHECK(role IN ('job-seeker', 'employer', 'admin'))", "CHECK(role IN ('job-seeker', 'employer'))"))
  const time = '2026-09-01T00:00:00.000Z'
  const addUser = old.prepare('INSERT INTO users(id,email,password_hash,role,created_at,updated_at) VALUES (?,?,?,?,?,?)')
  addUser.run('u-employer', 'boss@example.com', 'x', 'employer', time, time)
  addUser.run('u-seeker', 'seeker@example.com', 'x', 'job-seeker', time, time)
  old.prepare("INSERT INTO employer_profiles(user_id,contact_name,company_name,industry,contact_email,updated_at) VALUES ('u-employer','Boss','Old Corp','Retail','boss@example.com',?)").run(time)
  old.prepare("INSERT INTO job_seeker_profiles(user_id,first_name,last_name,updated_at) VALUES ('u-seeker','Sam','Reyes',?)").run(time)
  const addJob = old.prepare(`
    INSERT INTO jobs(id,owner_user_id,title,company,location,city,province,address,salary_text,employment_type,
      work_arrangement,experience_level,category,description,data_source,application_mode,status,date_posted,created_at,updated_at)
    VALUES (?,?,?,?,'Angeles City','Angeles City','Pampanga','Somewhere','Negotiable','Full-time','On-site','Entry level',
      'Administrative','Old description',?,?,?,?,?,?)
  `)
  addJob.run('old-active', 'u-employer', 'Old Active Job', 'Old Corp', 'employer-created', 'internal', 'active', '2026-08-01', time, time)
  addJob.run('old-closed', 'u-employer', 'Old Closed Job', 'Old Corp', 'employer-created', 'internal', 'closed', '2026-08-01', time, time)
  addJob.run('old-draft', 'u-employer', 'Old Draft Job', 'Old Corp', 'employer-created', 'internal', 'draft', null, time, time)
  addJob.run(verified.id, null, 'Title edited on the live server', verified.company, 'external-verified', 'internal', 'active', '2026-08-01', time, time)
  old.prepare("INSERT INTO stored_files(id,owner_user_id,kind,storage_key,original_name,mime_type,size_bytes,sha256,created_at) VALUES ('f1','u-seeker','application-resume','f1.pdf','cv.pdf','application/pdf',10,'abc',?)").run(time)
  old.prepare(`INSERT INTO applications(id,job_id,applicant_user_id,job_title_snapshot,company_snapshot,first_name_snapshot,last_name_snapshot,
    email_snapshot,resume_file_id,applicant_skills_json,required_skills_json,skill_match_score,matching_version,status,applied_at,updated_at)
    VALUES ('a1','old-active','u-seeker','Old Active Job','Old Corp','Sam','Reyes','seeker@example.com','f1','[]','[]',0.5,'exact-snapshot-v1','reviewing',?,?)`).run(time, time)
  old.prepare("INSERT INTO saved_jobs(user_id,job_id,created_at) VALUES ('u-seeker','old-active',?)").run(time)
  const jobsBefore = old.prepare('SELECT * FROM jobs ORDER BY id').all()
  const applicationsBefore = old.prepare('SELECT * FROM applications').all()
  const savedBefore = old.prepare('SELECT * FROM saved_jobs').all()
  const usersBefore = old.prepare('SELECT * FROM users ORDER BY id').all()
  old.close()

  const app = await startApp(root)
  try {
    const db = app.api.db
    for (const before of jobsBefore) {
      const now = db.prepare('SELECT * FROM jobs WHERE id=?').get(before.id)
      for (const [column, value] of Object.entries(before)) assert.deepEqual(now[column], value, `${before.id}.${column}`)
      assert.equal(now.review_status, 'legacy')
    }
    assert.deepEqual(db.prepare('SELECT * FROM applications').all(), applicationsBefore)
    assert.deepEqual(db.prepare('SELECT * FROM saved_jobs').all(), savedBefore)

    const publicJobs = (await app.call('/api/jobs')).data
    const ids = publicJobs.items.map((job) => job.id)
    assert.ok(ids.includes('old-active'))
    assert.ok(!ids.includes('old-closed') && !ids.includes('old-draft'))
    assert.equal(publicJobs.total, VERIFIED_JOBS.length + 1)
    assert.equal(publicJobs.items.find((job) => job.id === verified.id).title, 'Title edited on the live server')
    assert.ok(publicJobs.items.every((job) => job.reviewStatus === 'legacy'))

    for (const before of usersBefore) {
      const now = db.prepare('SELECT * FROM users WHERE id=?').get(before.id)
      for (const [column, value] of Object.entries(before)) assert.deepEqual(now[column], value, `${before.id}.${column}`)
    }
    assert.match(db.prepare("SELECT sql FROM sqlite_master WHERE name='users'").get().sql, /'admin'/)
    assert.equal(db.pragma('foreign_key_check').length, 0)

    createAdminAccount(db, { email: 'peso@example.com', passwordHash: await hashPassword('TestPass2026'), officeName: 'PESO Angeles City' })
    const login = await app.call('/api/auth/login', { method: 'POST', body: { email: 'peso@example.com', password: 'TestPass2026' } })
    assert.equal(login.status, 200)
    assert.equal(login.data.account.role, 'admin')
    assert.equal(login.data.profile.officeName, 'PESO Angeles City')

    const selfAdmin = await app.call('/api/auth/register', {
      method: 'POST', body: { role: 'admin', email: 'fake-peso@example.com', password: 'TestPass2026', firstName: 'Fa', lastName: 'Ke' },
    })
    assert.equal(selfAdmin.status, 400)
  } finally {
    await app.stop()
  }

  const again = await startApp(root)
  try {
    const title = again.api.db.prepare('SELECT title FROM jobs WHERE id=?').get(verified.id).title
    assert.equal(title, 'Title edited on the live server')
    assert.equal(again.api.db.prepare('SELECT count(*) AS n FROM jobs').get().n, VERIFIED_JOBS.length + 3)
  } finally {
    await again.stop()
  }
})

let app
let admin
let employer
let otherEmployer
let seeker

before(async () => {
  fakeMailer.sent = []
  app = await startApp(tempRoot())
  const adminId = createAdminAccount(app.api.db, { email: 'admin@example.com', passwordHash: await hashPassword('TestPass2026'), officeName: 'PESO Angeles City' })
  const adminLogin = await app.call('/api/auth/login', { method: 'POST', body: { email: 'admin@example.com', password: 'TestPass2026' } })
  admin = { id: adminId, cookie: adminLogin.headers.get('set-cookie').match(/jf_session=[^;]+/)[0] }
  employer = await register(app, { role: 'employer', email: 'hr@example.com', companyName: 'Panel Corp', industry: 'Retail', contactName: 'HR' })
  otherEmployer = await register(app, { role: 'employer', email: 'other-hr@example.com', companyName: 'Other Corp', industry: 'Retail', contactName: 'HR' })
  seeker = await register(app, { role: 'job-seeker', email: 'seeker@example.com', firstName: 'Ana', lastName: 'Cruz' })
})

after(async () => {
  await app.stop()
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

async function createJob(overrides) {
  const response = await app.call('/api/employer/jobs', { method: 'POST', cookie: employer.cookie, body: jobBody(overrides) })
  assert.equal(response.status, 201, JSON.stringify(response.data))
  return response.data.job
}

function review(job, decision, reason = '', version = job.reviewVersion) {
  return app.call(`/api/admin/jobs/${job.id}/review`, {
    method: 'POST', cookie: admin.cookie, body: { decision, reason, expectedVersion: version },
  })
}

test('admin routes reject visitors, employers and ordinary job seekers', async () => {
  for (const route of ['/api/admin/jobs', '/api/admin/audit', '/api/admin/notifications', '/api/admin/users', '/api/admin/employers', '/api/admin/summary']) {
    assert.equal((await app.call(route)).status, 401)
    assert.equal((await app.call(route, { cookie: employer.cookie })).status, 403)
    assert.equal((await app.call(route, { cookie: seeker.cookie })).status, 403)
    assert.equal((await app.call(route, { cookie: admin.cookie })).status, 200)
  }
  const job = await createJob({ title: 'Forbidden Review Target' })
  const forged = await app.call(`/api/admin/jobs/${job.id}/review`, {
    method: 'POST', cookie: employer.cookie, body: { decision: 'approve', reason: '', expectedVersion: job.reviewVersion },
  })
  assert.equal(forged.status, 403)
})

test('a new posting waits for approval and is hidden from every public path until then', async () => {
  const job = await createJob({ title: 'Pending Stock Clerk' })
  assert.equal(job.reviewStatus, 'pending')
  assert.equal(job.datePosted, null)

  const ids = (await app.call('/api/jobs')).data.items.map((item) => item.id)
  assert.ok(!ids.includes(job.id))
  assert.equal((await app.call(`/api/jobs/${job.id}`)).status, 404)
  assert.equal((await app.call(`/api/me/saved-jobs/${job.id}`, { method: 'PUT', cookie: seeker.cookie })).status, 404)
  assert.equal((await app.call(`/api/jobs/${job.id}/applications`, { method: 'POST', cookie: seeker.cookie, form: resumeForm() })).status, 404)

  const approved = await review(job, 'approve')
  assert.equal(approved.status, 200, JSON.stringify(approved.data))
  assert.equal(approved.data.job.reviewStatus, 'approved')
  assert.equal(approved.data.job.reviewVersion, job.reviewVersion + 1)
  assert.ok(approved.data.job.datePosted)
  assert.equal((await app.call(`/api/jobs/${job.id}`)).status, 200)

  const entry = app.api.db.prepare("SELECT * FROM audit_events WHERE action='job.approve' AND target_id=?").get(job.id)
  assert.equal(entry.actor_id, admin.id)
  assert.equal(JSON.parse(entry.details_json).toReview, 'approved')
})

test('employers cannot forge review fields or change another owner posting', async () => {
  const forged = await app.call('/api/employer/jobs', {
    method: 'POST', cookie: employer.cookie, body: { ...jobBody(), reviewStatus: 'approved' },
  })
  assert.equal(forged.status, 400)
  const job = await createJob({ title: 'Owner Check' })
  const patchForged = await app.call(`/api/employer/jobs/${job.id}`, {
    method: 'PATCH', cookie: employer.cookie, body: { reviewStatus: 'approved', reviewVersion: 99 },
  })
  assert.equal(patchForged.status, 400)
  const otherOwner = await app.call(`/api/employer/jobs/${job.id}`, { method: 'PATCH', cookie: otherEmployer.cookie, body: { title: 'Hijack' } })
  assert.equal(otherOwner.status, 404)
  assert.equal(app.api.db.prepare('SELECT review_status FROM jobs WHERE id=?').get(job.id).review_status, 'pending')
})

test('drafts stay private and are not placed in the admin review list', async () => {
  const draft = await createJob({ status: 'draft', title: 'Private Draft Posting' })
  assert.equal(draft.status, 'draft')
  const list = (await app.call('/api/admin/jobs?q=Private%20Draft', { cookie: admin.cookie })).data
  assert.equal(list.total, 0)
  const approve = await review(draft, 'approve')
  assert.equal(approve.status, 409)
})

test('rejection needs a reason, shows the reason to the employer and allows resubmission', async () => {
  const job = await createJob({ title: 'Needs Better Description' })
  const noReason = await review(job, 'reject', '   ')
  assert.equal(noReason.status, 400)
  assert.equal(app.api.db.prepare('SELECT review_status FROM jobs WHERE id=?').get(job.id).review_status, 'pending')

  const rejected = await review(job, 'reject', 'Please describe the actual duties.')
  assert.equal(rejected.status, 200)
  const mine = (await app.call('/api/employer/jobs', { cookie: employer.cookie })).data.items.find((item) => item.id === job.id)
  assert.equal(mine.reviewStatus, 'rejected')
  assert.equal(mine.reviewReason, 'Please describe the actual duties.')

  const resubmit = await app.call(`/api/employer/jobs/${job.id}`, {
    method: 'PATCH', cookie: employer.cookie, body: { description: 'Count stock and record deliveries daily.' },
  })
  assert.equal(resubmit.status, 200)
  assert.equal(resubmit.data.job.reviewStatus, 'pending')
  assert.equal(resubmit.data.job.reviewReason, '')
  assert.ok(app.api.db.prepare("SELECT 1 FROM audit_events WHERE action='job.submitted' AND target_id=? AND id > (SELECT max(id) FROM audit_events WHERE action='job.reject')").get(job.id))
})

test('editing an approved posting needs a new approval and old review versions are refused', async () => {
  const job = await createJob({ title: 'Approved Then Edited' })
  const approved = (await review(job, 'approve')).data.job
  const edited = await app.call(`/api/employer/jobs/${job.id}`, {
    method: 'PATCH', cookie: employer.cookie, body: { title: 'Approved Then Edited With New Pay', salary: 'PHP 30,000' },
  })
  assert.equal(edited.data.job.reviewStatus, 'pending')
  assert.equal((await app.call(`/api/jobs/${job.id}`)).status, 404)

  const stale = await review(approved, 'approve')
  assert.equal(stale.status, 409)
  assert.equal(stale.data.error.code, 'STALE_REVIEW')
  assert.equal(app.api.db.prepare('SELECT review_status FROM jobs WHERE id=?').get(job.id).review_status, 'pending')

  const fresh = await review(edited.data.job, 'approve')
  assert.equal(fresh.status, 200)

  const closed = await app.call(`/api/employer/jobs/${job.id}`, { method: 'PATCH', cookie: employer.cookie, body: { status: 'closed' } })
  assert.equal(closed.data.job.reviewStatus, 'approved')
  const reopened = await app.call(`/api/employer/jobs/${job.id}`, { method: 'PATCH', cookie: employer.cookie, body: { status: 'active' } })
  assert.equal(reopened.data.job.reviewStatus, 'approved')
  assert.equal((await app.call(`/api/jobs/${job.id}`)).status, 200)
})

test('suspend and archive hide a posting but keep its applications and history', async () => {
  await app.call('/api/me/profile', { method: 'PATCH', cookie: seeker.cookie, body: { skills: ['Inventory Management'] } })
  const job = await createJob({ title: 'Suspend Me Later' })
  const approved = (await review(job, 'approve')).data.job
  const applied = await app.call(`/api/jobs/${job.id}/applications`, { method: 'POST', cookie: seeker.cookie, form: resumeForm() })
  assert.equal(applied.status, 201, JSON.stringify(applied.data))
  const applicationId = applied.data.application.id
  const scoreBefore = app.api.db.prepare('SELECT skill_match_score FROM applications WHERE id=?').get(applicationId).skill_match_score

  assert.equal((await review(approved, 'suspend', '')).status, 400)
  const suspended = await review(approved, 'suspend', 'Reported as a duplicate posting.')
  assert.equal(suspended.status, 200)
  assert.equal((await app.call(`/api/jobs/${job.id}`)).status, 404)
  assert.equal(app.api.db.prepare('SELECT count(*) AS n FROM applications WHERE id=?').get(applicationId).n, 1)
  assert.equal((await app.call(`/api/applications/${applicationId}/resume`, { cookie: employer.cookie })).status, 200)

  const archived = await review(suspended.data.job, 'archive', 'Position filled.')
  assert.equal(archived.status, 200)
  assert.equal(archived.data.job.status, 'closed')
  assert.equal(app.api.db.prepare('SELECT skill_match_score FROM applications WHERE id=?').get(applicationId).skill_match_score, scoreBefore)

  const legacyJob = (await app.call('/api/jobs')).data.items.find((item) => item.reviewStatus === 'legacy')
  const legacyApprove = await review(legacyJob, 'approve')
  assert.equal(legacyApprove.status, 409)
})

test('admin posting list filters by text, review state, source and page', async () => {
  const list = async (query) => (await app.call(`/api/admin/jobs?${query}`, { cookie: admin.cookie })).data
  const pending = await list('reviewStatus=pending')
  assert.ok(pending.items.every((job) => job.reviewStatus === 'pending'))
  const verified = await list('dataSource=external-verified&limit=5')
  assert.equal(verified.total, VERIFIED_JOBS.length)
  assert.equal(verified.items.length, 5)
  const page2 = await list('dataSource=external-verified&limit=5&page=2')
  assert.notEqual(page2.items[0].id, verified.items[0].id)
  const byText = await list('q=suspend%20me')
  assert.equal(byText.total, 1)
  const byCategory = await list('category=Administrative&dataSource=employer-created')
  assert.ok(byCategory.items.every((job) => job.category === 'Administrative' && job.dataSource === 'employer-created'))
})

test('preferences default to 70/30, reject invalid values and persist per account', async () => {
  const initial = await app.call('/api/me/preferences', { cookie: seeker.cookie })
  assert.deepEqual(initial.data.preferences, { skillWeightPercent: 70, notificationEmails: true })

  for (const body of [{ skillWeightPercent: 1.5 }, { skillWeightPercent: -1 }, { skillWeightPercent: 101 },
    { skillWeightPercent: '70' }, { notificationEmails: 'no' }, { skillWeightPercent: 50, extra: true }, []]) {
    const response = await app.call('/api/me/preferences', { method: 'PATCH', cookie: seeker.cookie, body })
    assert.equal(response.status, 400, JSON.stringify(body))
  }
  assert.equal((await app.call('/api/me/preferences', { cookie: seeker.cookie })).data.preferences.skillWeightPercent, 70)

  const applicationScores = app.api.db.prepare('SELECT id, skill_match_score FROM applications ORDER BY id').all()
  const saved = await app.call('/api/me/preferences', { method: 'PATCH', cookie: seeker.cookie, body: { skillWeightPercent: 40 } })
  assert.equal(saved.status, 200)
  assert.equal(saved.data.preferences.skillWeightPercent, 40)
  assert.equal((await app.call('/api/me/preferences', { cookie: seeker.cookie })).data.preferences.skillWeightPercent, 40)
  assert.equal((await app.call('/api/me/preferences', { cookie: admin.cookie })).data.preferences.skillWeightPercent, 70)
  assert.deepEqual(app.api.db.prepare('SELECT id, skill_match_score FROM applications ORDER BY id').all(), applicationScores)

  const entry = app.api.db.prepare("SELECT * FROM audit_events WHERE action='preferences.updated' ORDER BY id DESC").get()
  assert.deepEqual(JSON.parse(entry.details_json), { fields: ['skillWeightPercent'], skillWeightPercent: 40, notificationEmails: true })
})

test('audit records are admin-only, append-only and never hold personal values', async () => {
  await app.call('/api/me/profile', { method: 'PATCH', cookie: seeker.cookie, body: { headline: 'Secret headline text', lat: 15.15, lng: 120.59 } })
  const entry = app.api.db.prepare("SELECT * FROM audit_events WHERE action='profile.updated' ORDER BY id DESC").get()
  assert.deepEqual(JSON.parse(entry.details_json), { fields: ['headline', 'lat', 'lng'] })
  const everything = JSON.stringify(app.api.db.prepare('SELECT * FROM audit_events').all())
  for (const secret of ['Secret headline text', 'TestPass2026', 'jf_session', '15.15', 'resume.pdf']) {
    assert.ok(!everything.includes(secret), secret)
  }
  assert.throws(() => app.api.db.prepare("UPDATE audit_events SET summary='changed'").run(), /append-only/)
  assert.throws(() => app.api.db.prepare('DELETE FROM audit_events').run(), /append-only/)

  const viaApi = (await app.call('/api/admin/audit?action=job.approve', { cookie: admin.cookie })).data
  assert.ok(viaApi.total >= 1)
  assert.ok(viaApi.items.every((item) => item.action === 'job.approve'))
})

test('with sending disabled, events are recorded as not sent and nothing reaches the mailer', async () => {
  const rows = outbox(app.api.db)
  const types = new Set(rows.map((row) => row.event_type))
  assert.ok(types.has('posting-review'))
  assert.ok(types.has('new-application'))
  assert.ok(rows.every((row) => row.status === 'disabled'))
  await app.api.notifications.processBatch()
  assert.equal(fakeMailer.sent.length, 0)

  const log = (await app.call('/api/admin/notifications', { cookie: admin.cookie })).data
  assert.equal(log.mailEnabled, false)
  assert.ok(log.items.every((item) => item.recipient.includes('***@') && !('subject' in item) && !('text' in item)))
})

test('application status changes notify the applicant, and opting out suppresses emails', async () => {
  const application = app.api.db.prepare('SELECT id FROM applications ORDER BY applied_at DESC').get()
  const changed = await app.call(`/api/employer/applications/${application.id}/status`, {
    method: 'PATCH', cookie: employer.cookie, body: { status: 'shortlisted' },
  })
  assert.equal(changed.status, 200)
  const statusEvent = outbox(app.api.db).find((row) => row.event_type === 'application-status')
  assert.equal(statusEvent.recipient_user_id, seeker.id)
  assert.match(statusEvent.text_body, /Shortlisted/)

  await app.call('/api/me/preferences', { method: 'PATCH', cookie: employer.cookie, body: { notificationEmails: false } })
  const job = await createJob({ title: 'Opt Out Check' })
  await review(job, 'approve')
  const reviewEvent = outbox(app.api.db).find((row) => row.event_key === `job-review:${job.id}:${job.reviewVersion + 1}`)
  assert.equal(reviewEvent.status, 'opted-out')
})

test('enabled sending uses the fake mailer with bounded retries and stable duplicate protection', async () => {
  fakeMailer.sent = []
  const notifications = createNotifications(app.api.db, fakeMailer, { enabled: true, batchSize: 3, maxAttempts: 3 })
  assert.ok(notifications.enqueue({ eventKey: 'test:once', eventType: 'test', userId: seeker.id, subject: 'Hello', text: 'Body' }))
  assert.equal(notifications.enqueue({ eventKey: 'test:once', eventType: 'test', userId: seeker.id, subject: 'Hello', text: 'Body' }), null)

  fakeMailer.failNext = 1
  await notifications.processBatch()
  let row = app.api.db.prepare("SELECT * FROM notification_outbox WHERE event_key='test:once'").get()
  assert.equal(row.status, 'retry')
  assert.equal(row.attempts, 1)
  assert.doesNotMatch(row.last_error, /outage/)

  app.api.db.prepare("UPDATE notification_outbox SET available_at='2000-01-01T00:00:00.000Z' WHERE event_key='test:once'").run()
  await notifications.processBatch()
  row = app.api.db.prepare("SELECT * FROM notification_outbox WHERE event_key='test:once'").get()
  assert.equal(row.status, 'accepted')
  assert.equal(fakeMailer.sent.length, 1)
  assert.equal(fakeMailer.sent[0].to, 'seeker@example.com')
  assert.equal(fakeMailer.sent[0].idempotencyKey, 'jobfinder-outbox-test:once')

  await notifications.processBatch()
  assert.equal(fakeMailer.sent.length, 1)

  notifications.enqueue({ eventKey: 'test:fails', eventType: 'test', userId: seeker.id, subject: 'Hi', text: 'Body' })
  for (let attempt = 0; attempt < 5; attempt++) {
    fakeMailer.failNext = 1
    app.api.db.prepare("UPDATE notification_outbox SET available_at='2000-01-01T00:00:00.000Z' WHERE event_key='test:fails'").run()
    await notifications.processBatch()
  }
  fakeMailer.failNext = 0
  row = app.api.db.prepare("SELECT * FROM notification_outbox WHERE event_key='test:fails'").get()
  assert.equal(row.status, 'failed')
  assert.equal(row.attempts, 3)

  notifications.enqueue({ eventKey: 'test:interrupted', eventType: 'test', userId: seeker.id, subject: 'Hi', text: 'Body' })
  app.api.db.prepare("UPDATE notification_outbox SET status='sending',attempts=1,claimed_at='2000-01-01T00:00:00.000Z' WHERE event_key='test:interrupted'").run()
  await notifications.processBatch()
  row = app.api.db.prepare("SELECT * FROM notification_outbox WHERE event_key='test:interrupted'").get()
  assert.equal(row.status, 'accepted')
  assert.equal(fakeMailer.sent.at(-1).idempotencyKey, 'jobfinder-outbox-test:interrupted')
  await notifications.stop()
})

test('BUG-03 too many sign-in attempts return a clear wait message', async () => {
  const limited = await startApp(tempRoot(), { authRateLimit: 2 })
  try {
    const attempt = () => limited.call('/api/auth/login', { method: 'POST', body: { email: 'nobody@example.com', password: 'WrongPass-2026' } })
    assert.equal((await attempt()).status, 401)
    assert.equal((await attempt()).status, 401)
    const blocked = await attempt()
    assert.equal(blocked.status, 429)
    assert.equal(blocked.data.error.code, 'TOO_MANY_ATTEMPTS')
    assert.match(blocked.data.error.message, /wait 15 minutes/)
  } finally {
    await limited.stop()
  }
})

test('PESO dashboard summary counts match the database', async () => {
  const summary = (await app.call('/api/admin/summary', { cookie: admin.cookie })).data
  const db = app.api.db
  assert.equal(summary.pendingReviews, db.prepare("SELECT count(*) AS n FROM jobs WHERE review_status='pending' AND status='active'").get().n)
  assert.equal(summary.employers, db.prepare("SELECT count(*) AS n FROM users WHERE role='employer'").get().n)
  assert.equal(summary.jobSeekers, db.prepare("SELECT count(*) AS n FROM users WHERE role='job-seeker'").get().n)
  assert.equal(summary.publishedJobs, (await app.call('/api/jobs')).data.total)
  assert.ok(summary.recentSubmissions.every((job) => job.reviewStatus === 'pending'))
  assert.ok(summary.recentActivity.length > 0)
})

test('PESO can suspend and reactivate an employer without losing applications', async () => {
  const shop = await register(app, { role: 'employer', email: 'shop@example.com', companyName: 'Suspend Test Shop', industry: 'Retail', contactName: 'Owner' })
  const created = await app.call('/api/employer/jobs', { method: 'POST', cookie: shop.cookie, body: jobBody({ title: 'Shop Stock Clerk' }) })
  await review(created.data.job, 'approve')
  const applied = await app.call(`/api/jobs/${created.data.job.id}/applications`, { method: 'POST', cookie: seeker.cookie, form: resumeForm() })
  assert.equal(applied.status, 201)

  const status = (body, cookie = admin.cookie) => app.call(`/api/admin/employers/${shop.id}/status`, { method: 'PATCH', cookie, body })
  assert.equal((await status({ active: false, reason: 'Fake company' }, employer.cookie)).status, 403)
  assert.equal((await status({ active: false, reason: '  ' })).status, 400)

  const suspended = await status({ active: false, reason: 'Reported as a fake company.' })
  assert.equal(suspended.status, 200)
  assert.equal((await app.call(`/api/jobs/${created.data.job.id}`)).status, 404)
  assert.equal((await app.call('/api/auth/me', { cookie: shop.cookie })).status, 401)
  const login = await app.call('/api/auth/login', { method: 'POST', body: { email: 'shop@example.com', password: 'TestPass2026' } })
  assert.equal(login.status, 401)
  assert.equal(app.api.db.prepare('SELECT count(*) AS n FROM applications WHERE id=?').get(applied.data.application.id).n, 1)

  const listed = (await app.call('/api/admin/employers?status=suspended&q=suspend%20test', { cookie: admin.cookie })).data
  assert.equal(listed.total, 1)
  assert.equal(listed.items[0].active, false)
  assert.equal(listed.items[0].statusReason, 'Reported as a fake company.')
  assert.equal(listed.items[0].applications, 1)
  const theirJobs = (await app.call(`/api/admin/jobs?ownerId=${shop.id}`, { cookie: admin.cookie })).data
  assert.deepEqual(theirJobs.items.map((job) => job.title), ['Shop Stock Clerk'])
  assert.ok(app.api.db.prepare("SELECT 1 FROM audit_events WHERE action='employer.suspended' AND target_id=?").get(shop.id))

  assert.equal((await status({ active: true, reason: '' })).status, 200)
  assert.equal((await app.call(`/api/jobs/${created.data.job.id}`)).status, 200)
  const back = await app.call('/api/auth/login', { method: 'POST', body: { email: 'shop@example.com', password: 'TestPass2026' } })
  assert.equal(back.status, 200)
})

test('forgot password emails a working reset link when a mail provider is set up', async () => {
  const account = await register(app, { role: 'job-seeker', email: 'forgot@example.com', firstName: 'For', lastName: 'Got' })
  fakeMailer.sent = []
  assert.equal((await app.call('/api/auth/forgot-password', { method: 'POST', body: { email: 'forgot@example.com' } })).status, 202)
  assert.equal(fakeMailer.sent.length, 1)
  const message = fakeMailer.sent[0]
  assert.equal(message.to, 'forgot@example.com')
  assert.match(message.subject, /Reset your JobFinder password/)
  const token = message.text.match(/\?reset=([A-Za-z0-9_-]+)/)[1]

  const reset = await app.call('/api/auth/reset-password', { method: 'POST', body: { token, password: 'BrandNewPass2026' } })
  assert.equal(reset.status, 200)
  assert.equal((await app.call('/api/auth/me', { cookie: account.cookie })).status, 401)
  const login = await app.call('/api/auth/login', { method: 'POST', body: { email: 'forgot@example.com', password: 'BrandNewPass2026' } })
  assert.equal(login.status, 200)
})

test('hired and rejected decisions email the applicant when sending is on', async () => {
  const mailing = await startApp(tempRoot(), { notificationsEnabled: true })
  try {
    const pesoId = createAdminAccount(mailing.api.db, { email: 'peso-mail@example.com', passwordHash: await hashPassword('TestPass2026'), officeName: 'PESO Angeles City' })
    const pesoCookie = (await mailing.call('/api/auth/login', { method: 'POST', body: { email: 'peso-mail@example.com', password: 'TestPass2026' } }))
      .headers.get('set-cookie').match(/jf_session=[^;]+/)[0]
    const boss = await register(mailing, { role: 'employer', email: 'boss-mail@example.com', companyName: 'Mail Test Co', industry: 'Retail', contactName: 'Boss' })
    const job = (await mailing.call('/api/employer/jobs', { method: 'POST', cookie: boss.cookie, body: jobBody({ title: 'Mail Test Clerk' }) })).data.job
    await mailing.call(`/api/admin/jobs/${job.id}/review`, { method: 'POST', cookie: pesoCookie, body: { decision: 'approve', reason: '', expectedVersion: job.reviewVersion } })

    const decisions = [['hired-seeker@example.com', 'hired', /Hired/], ['rejected-seeker@example.com', 'rejected', /Not selected/]]
    for (const [email, status, wording] of decisions) {
      const person = await register(mailing, { role: 'job-seeker', email, firstName: 'Job', lastName: 'Seeker' })
      const applied = await mailing.call(`/api/jobs/${job.id}/applications`, { method: 'POST', cookie: person.cookie, form: resumeForm() })
      const changed = await mailing.call(`/api/employer/applications/${applied.data.application.id}/status`, {
        method: 'PATCH', cookie: boss.cookie, body: { status },
      })
      assert.equal(changed.status, 200)
      fakeMailer.sent = []
      await mailing.api.notifications.processBatch()
      const toApplicant = fakeMailer.sent.find((message) => message.to === email)
      assert.ok(toApplicant, `${status} email sent`)
      assert.match(toApplicant.text, wording)
      assert.match(toApplicant.text, /Mail Test Clerk/)
    }
    assert.ok(pesoId)
  } finally {
    await mailing.stop()
  }
})

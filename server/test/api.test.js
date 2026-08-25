import { createHash, randomBytes, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import { createApp } from '../app.js'
import { loadConfig } from '../config.js'
import { hashPassword } from '../security.js'

const VERIFIED_JOB_COUNT = JSON.parse(readFileSync(new URL('../../src/data/jobs.verified.json', import.meta.url), 'utf8')).length

const mutationOrigin = 'http://127.0.0.1'
let root
let api
let server
let baseUrl

function sessionCookie(response) {
  const value = response.headers.get('set-cookie') ?? ''
  const match = value.match(/jf_session=[^;]+/)
  assert.ok(match, 'response should set a JobFinder session cookie')
  return match[0]
}

async function request(route, { method = 'GET', cookie, body, form, origin = method === 'GET' ? undefined : mutationOrigin } = {}) {
  const headers = {}
  if (cookie) headers.cookie = cookie
  if (origin) headers.origin = origin
  if (body !== undefined) headers['content-type'] = 'application/json'
  return fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
    redirect: 'manual',
  })
}

async function json(response) {
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

async function register(body) {
  const response = await request('/api/auth/register', { method: 'POST', body })
  return { response, data: await json(response), cookie: sessionCookie(response) }
}

function resumeForm(firstName = 'Ana') {
  const form = new FormData()
  form.set('firstName', firstName)
  form.set('lastName', 'Cruz')
  form.set('email', 'ana@example.com')
  form.set('phone', '09170000000')
  form.set('coverLetter', 'Please consider my application.')
  form.set('resume', new Blob(['%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'], { type: 'application/pdf' }), 'resume.pdf')
  return form
}

function profileResumeForm(marker) {
  const form = new FormData()
  form.set('resume', new Blob([`%PDF-1.4\n${marker}\n%%EOF`], { type: 'application/pdf' }), `${marker}.pdf`)
  return form
}

before(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'jobfinder-api-test-'))
  api = createApp({
    host: '127.0.0.1', port: 0,
    dbPath: path.join(root, 'jobfinder.sqlite'),
    uploadDir: path.join(root, 'uploads'),
    appOrigin: mutationOrigin,
    sessionTtlSeconds: 3600,
    rememberTtlSeconds: 7200,
    secureCookies: false,
    seedOnStart: true,
  })
  server = createServer(api.app)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  api.close()
  rmSync(root, { recursive: true, force: true })
})

test('health and verified seed are correct and idempotent', async () => {
  const health = await request('/api/health')
  assert.equal(health.status, 200)
  assert.deepEqual(await json(health), { ok: true, database: 'ok' })

  const jobs = await request('/api/jobs')
  const payload = await json(jobs)
  assert.equal(payload.total, VERIFIED_JOB_COUNT)
  assert.equal(payload.items.length, VERIFIED_JOB_COUNT)
  assert.ok(payload.items.every((job) => job.dataSource === 'external-verified'))
  assert.ok(payload.items.every((job) => job.applicationMode === 'internal'))
  assert.equal(api.db.prepare("SELECT count(*) AS count FROM jobs WHERE data_source='external-verified'").get().count, VERIFIED_JOB_COUNT)
})

test('runtime and service configuration enforce loopback-only networking', () => {
  assert.throws(() => loadConfig({ host: '0.0.0.0' }), /exactly 127\.0\.0\.1/)
  assert.equal(loadConfig({ host: '127.0.0.1' }).host, '127.0.0.1')
  const service = readFileSync(new URL('../../deploy/jobfinder-api.service', import.meta.url), 'utf8')
  assert.match(service, /RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6/)
  assert.match(service, /IPAddressDeny=any/)
  assert.match(service, /IPAddressAllow=localhost/)
  assert.match(service, /MemoryMax=76M/)
})

test('password hashing has a bounded single-worker queue', async () => {
  const attempts = await Promise.allSettled(
    Array.from({ length: 6 }, (_, index) => hashPassword(`bounded-password-${index}`)),
  )
  assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 5)
  const rejected = attempts.find((item) => item.status === 'rejected')
  assert.equal(rejected.reason.code, 'AUTH_BUSY')
})

test('registration hashes passwords, enforces origin, and prevents duplicate emails across roles', async () => {
  const blocked = await request('/api/auth/register', {
    method: 'POST', origin: 'https://evil.example',
    body: { role: 'job-seeker', email: 'blocked@example.com', password: 'password123', firstName: 'Bad', lastName: 'Origin' },
  })
  assert.equal(blocked.status, 403)

  const seeker = await register({
    role: 'job-seeker', email: 'ana@example.com', password: 'password123', firstName: 'Ana', lastName: 'Cruz',
  })
  assert.equal(seeker.response.status, 201)
  assert.equal(seeker.data.account.role, 'job-seeker')
  const stored = api.db.prepare('SELECT password_hash FROM users WHERE email=?').get('ana@example.com')
  assert.notEqual(stored.password_hash, 'password123')
  assert.match(stored.password_hash, /^scrypt\$/)

  const duplicate = await request('/api/auth/register', {
    method: 'POST', body: {
      role: 'employer', email: 'ANA@EXAMPLE.COM', password: 'password123',
      companyName: 'Duplicate Corp', industry: 'Retail', contactName: 'HR',
    },
  })
  assert.equal(duplicate.status, 409)
  assert.equal((await json(duplicate)).error.code, 'EMAIL_IN_USE')
})

test('saved jobs are user-scoped and verified listings accept one application each', async () => {
  const login = await request('/api/auth/login', { method: 'POST', body: { email: 'ana@example.com', password: 'password123' } })
  const cookie = sessionCookie(login)

  assert.equal((await request('/api/me/saved-jobs/rv02', { method: 'PUT', cookie })).status, 204)
  assert.equal((await request('/api/me/saved-jobs/rv02', { method: 'PUT', cookie })).status, 204)
  const saved = await json(await request('/api/me/saved-jobs', { cookie }))
  assert.deepEqual(saved.jobIds, ['rv02'])

  const firstUpload = await request('/api/me/resume', { method: 'PUT', cookie, form: profileResumeForm('first') })
  assert.equal(firstUpload.status, 201)
  const firstRow = api.db.prepare("SELECT id,storage_key FROM stored_files WHERE owner_user_id=(SELECT id FROM users WHERE email='ana@example.com') AND kind='profile-resume'").get()
  assert.ok(firstRow)
  assert.ok(existsSync(path.join(root, 'uploads', 'resumes', firstRow.storage_key)))

  const secondUpload = await request('/api/me/resume', { method: 'PUT', cookie, form: profileResumeForm('second') })
  assert.equal(secondUpload.status, 201)
  const profileFiles = api.db.prepare("SELECT id,storage_key FROM stored_files WHERE owner_user_id=(SELECT id FROM users WHERE email='ana@example.com') AND kind='profile-resume'").all()
  assert.equal(profileFiles.length, 1)
  assert.equal(profileFiles[0].id, firstRow.id)
  assert.notEqual(profileFiles[0].storage_key, firstRow.storage_key)
  assert.equal(existsSync(path.join(root, 'uploads', 'resumes', firstRow.storage_key)), false)
  assert.equal(existsSync(path.join(root, 'uploads', 'resumes', profileFiles[0].storage_key)), true)

  const verified = await request('/api/jobs/rv02/applications', { method: 'POST', cookie, form: resumeForm() })
  assert.equal(verified.status, 201, 'verified listings now accept internal applications')
  assert.equal(api.db.prepare('SELECT count(*) AS count FROM applications').get().count, 1)

  const repeat = await request('/api/jobs/rv02/applications', { method: 'POST', cookie, form: resumeForm() })
  const repeatBody = await json(repeat)
  assert.equal(repeat.status, 409, 'one application per job per applicant')
  assert.equal(repeatBody.error.code, 'DUPLICATE_APPLICATION')

  const ownerless = api.db.prepare("SELECT owner_user_id FROM jobs WHERE id='rv02'").get()
  assert.equal(ownerless.owner_user_id, null, 'verified listings still have no employer owner')
})

test('employer ownership and the complete internal application lifecycle are enforced', async () => {
  const employer = await register({
    role: 'employer', email: 'hr@example.com', password: 'password123',
    companyName: 'Angeles Test Corp', industry: 'Retail & Trade', contactName: 'HR Manager',
  })
  const otherEmployer = await register({
    role: 'employer', email: 'other@example.com', password: 'password123',
    companyName: 'Other Corp', industry: 'Finance', contactName: 'Other HR',
  })
  const seekerLogin = await request('/api/auth/login', { method: 'POST', body: { email: 'ana@example.com', password: 'password123' } })
  const seekerCookie = sessionCookie(seekerLogin)
  await request('/api/me/profile', {
    method: 'PATCH', cookie: seekerCookie,
    body: { skills: ['Inventory Management', 'Microsoft Excel'] },
  })

  const create = await request('/api/employer/jobs', {
    method: 'POST', cookie: employer.cookie,
    body: {
      status: 'active', title: 'Warehouse Supervisor', category: 'Administrative',
      description: 'Lead warehouse operations.', responsibilities: ['Lead staff'],
      requirements: ['Relevant experience'], benefits: [], requiredSkills: ['Inventory Management'],
      preferredSkills: ['Microsoft Excel'], employmentType: 'Full-time', workArrangement: 'On-site',
      experienceLevel: 'Associate', location: 'Pulung Cacutud, Angeles City', city: 'Angeles City',
      province: 'Pampanga', barangay: 'Pulung Cacutud', address: 'Angeles Livelihood Complex',
      salary: '₱22,000 - ₱27,000', salaryMin: 22000, salaryMax: 27000, openings: 1,
      applicationDeadline: '2099-12-31', lat: 15.16, lng: 120.57, coordinateSource: 'exact-address',
    },
  })
  const created = await json(create)
  assert.equal(create.status, 201, JSON.stringify(created))
  const jobId = created.job.id

  const forbiddenUpdate = await request(`/api/employer/jobs/${jobId}`, {
    method: 'PATCH', cookie: otherEmployer.cookie, body: { status: 'closed' },
  })
  assert.equal(forbiddenUpdate.status, 404)

  const apply = await request(`/api/jobs/${jobId}/applications`, {
    method: 'POST', cookie: seekerCookie, form: resumeForm(),
  })
  const application = await json(apply)
  assert.equal(apply.status, 201, JSON.stringify(application))
  assert.equal(application.application.matchScorePercent, 100)
  const applicationId = application.application.id

  const duplicate = await request(`/api/jobs/${jobId}/applications`, {
    method: 'POST', cookie: seekerCookie, form: resumeForm(),
  })
  assert.equal(duplicate.status, 409)
  assert.equal((await json(duplicate)).error.code, 'DUPLICATE_APPLICATION')

  const applicants = await json(await request(`/api/employer/applications?jobId=${jobId}`, { cookie: employer.cookie }))
  assert.equal(applicants.items.length, 1)
  assert.equal(applicants.items[0].applicantEmail, 'ana@example.com')

  const deniedResume = await request(`/api/applications/${applicationId}/resume`, { cookie: otherEmployer.cookie })
  assert.equal(deniedResume.status, 404)
  const allowedResume = await request(`/api/applications/${applicationId}/resume`, { cookie: employer.cookie })
  assert.equal(allowedResume.status, 200)
  assert.match(allowedResume.headers.get('content-disposition'), /attachment/)

  const status = await request(`/api/employer/applications/${applicationId}/status`, {
    method: 'PATCH', cookie: employer.cookie, body: { status: 'shortlisted' },
  })
  assert.equal(status.status, 200)
  const myApplications = await json(await request('/api/me/applications', { cookie: seekerCookie }))
  assert.equal(myApplications.items[0].status, 'shortlisted')
  assert.equal(api.db.prepare('SELECT count(*) AS count FROM application_status_history WHERE application_id=?').get(applicationId).count, 2)

  const closeJob = await request(`/api/employer/jobs/${jobId}`, {
    method: 'PATCH', cookie: employer.cookie, body: { status: 'closed' },
  })
  assert.equal(closeJob.status, 200)
  assert.equal((await json(closeJob)).job.status, 'closed')
})

test('password reset issues single-use tokens and does not reveal account existence', async () => {
  const email = 'reset-flow@example.com'
  const created = await request('/api/auth/register', {
    method: 'POST',
    body: { role: 'job-seeker', email, password: 'password123', firstName: 'Reset', lastName: 'Flow' },
  })
  assert.equal(created.status, 201)

  const unknown = await request('/api/auth/forgot-password', { method: 'POST', body: { email: 'no-such-user@example.com' } })
  const known = await request('/api/auth/forgot-password', { method: 'POST', body: { email } })
  assert.equal(unknown.status, 202)
  assert.equal(known.status, 202, 'both cases must respond identically')

  const userId = api.db.prepare('SELECT id FROM users WHERE email=?').get(email).id
  const token = randomBytes(32).toString('base64url')
  api.db.prepare(`
    INSERT INTO password_reset_tokens(id,user_id,token_hash,created_at,expires_at)
    VALUES (?,?,?,?,?)
  `).run(randomUUID(), userId, createHash('sha256').update(token).digest('hex'),
    new Date().toISOString(), new Date(Date.now() + 600_000).toISOString())

  const expired = randomBytes(32).toString('base64url')
  api.db.prepare(`
    INSERT INTO password_reset_tokens(id,user_id,token_hash,created_at,expires_at)
    VALUES (?,?,?,?,?)
  `).run(randomUUID(), userId, createHash('sha256').update(expired).digest('hex'),
    new Date().toISOString(), new Date(Date.now() - 1_000).toISOString())

  const expiredAttempt = await request('/api/auth/reset-password', { method: 'POST', body: { token: expired, password: 'brandnew123' } })
  assert.equal(expiredAttempt.status, 400, 'expired tokens must be rejected')

  const reset = await request('/api/auth/reset-password', { method: 'POST', body: { token, password: 'brandnew123' } })
  assert.equal(reset.status, 200)

  const oldLogin = await request('/api/auth/login', { method: 'POST', body: { email, password: 'password123' } })
  const newLogin = await request('/api/auth/login', { method: 'POST', body: { email, password: 'brandnew123' } })
  assert.equal(oldLogin.status, 401, 'the previous password must stop working')
  assert.equal(newLogin.status, 200)

  const replay = await request('/api/auth/reset-password', { method: 'POST', body: { token, password: 'thirdpass123' } })
  assert.equal(replay.status, 400, 'tokens must be single use')
})

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import path from 'node:path'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { fileTypeFromFile } from 'file-type'
import helmet from 'helmet'
import multer from 'multer'
import { z } from 'zod'
import { getJobSkills, getUserSkills, initializeDatabase, normalizeSkill, nowIso, openDatabase, replaceJobSkills, replaceUserSkills } from './db.js'
import { createMailer, passwordResetEmail } from './mailer.js'
import { ApiError, asyncRoute, authenticate, clearSessionCookie, createSession, hashPassword, originGuard, requireRole, sha256, verifyPassword, writeSessionCookie } from './security.js'

const APPLICATION_STATUSES = ['applied', 'reviewing', 'shortlisted', 'interview', 'hired', 'rejected']
const PROFILE_FIELDS = new Set([
  'firstName', 'lastName', 'headline', 'visibility', 'preferredLocation',
  'preferredEmploymentType', 'careerCategory', 'education', 'experienceLevel',
  'barangay', 'lat', 'lng', 'skills',
])
const EMPLOYER_FIELDS = new Set([
  'contactName', 'companyName', 'industry', 'description', 'address',
  'contactEmail', 'contactPhone', 'website', 'companySize',
])

const registerSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('job-seeker'),
    email: z.string().trim().email().max(254),
    password: z.string().min(8).max(128),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
  }).strict(),
  z.object({
    role: z.literal('employer'),
    email: z.string().trim().email().max(254),
    password: z.string().min(8).max(128),
    companyName: z.string().trim().min(1).max(160),
    industry: z.string().trim().min(1).max(120),
    contactName: z.string().trim().min(1).max(160),
  }).strict(),
])

const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(254),
}).strict()

const resetPasswordSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: z.string().min(8).max(128),
}).strict()

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
  rememberMe: z.boolean().optional().default(false),
}).strict()

const applicationSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional().default(''),
  coverLetter: z.string().trim().max(10_000).optional().default(''),
})

const jobInputSchema = z.object({
  title: z.string().trim().max(180).optional().default(''),
  category: z.string().trim().max(120).optional().default(''),
  description: z.string().trim().max(30_000).optional().default(''),
  responsibilities: z.array(z.string().trim().max(1_000)).max(100).optional().default([]),
  requirements: z.array(z.string().trim().max(1_000)).max(100).optional().default([]),
  benefits: z.array(z.string().trim().max(1_000)).max(100).optional().default([]),
  requiredSkills: z.array(z.string().trim().min(1).max(120)).max(100).optional().default([]),
  preferredSkills: z.array(z.string().trim().min(1).max(120)).max(100).optional().default([]),
  employmentType: z.string().trim().max(80).optional().default(''),
  workArrangement: z.string().trim().max(80).optional().default(''),
  experienceLevel: z.string().trim().max(80).optional().default(''),
  location: z.string().trim().max(300).optional().default(''),
  city: z.string().trim().max(120).optional().default('Angeles City'),
  province: z.string().trim().max(120).optional().default('Pampanga'),
  barangay: z.string().trim().max(120).nullable().optional().default(null),
  address: z.string().trim().max(500).optional().default(''),
  salaryMin: z.number().int().nonnegative().nullable().optional().default(null),
  salaryMax: z.number().int().nonnegative().nullable().optional().default(null),
  salary: z.string().trim().max(160).optional().default('Negotiable'),
  openings: z.number().int().positive().max(10_000).optional().default(1),
  applicationDeadline: z.string().trim().max(40).nullable().optional().default(null),
  lat: z.number().min(-90).max(90).nullable().optional().default(null),
  lng: z.number().min(-180).max(180).nullable().optional().default(null),
  coordinateSource: z.enum(['exact-address', 'barangay-centroid', 'city-centroid']).nullable().optional().default(null),
  status: z.enum(['draft', 'active', 'closed']).optional().default('draft'),
}).strict()

function parse(schema, value) {
  const result = schema.safeParse(value)
  if (result.success) return result.data
  const fields = {}
  for (const issue of result.error.issues) fields[issue.path.join('.') || 'request'] = issue.message
  throw new ApiError(400, 'VALIDATION_ERROR', 'Please correct the highlighted fields.', fields)
}

function selectKeys(value, allowed) {
  return Object.fromEntries(Object.entries(value ?? {}).filter(([key]) => allowed.has(key)))
}

function safeJson(value) {
  try { return JSON.parse(value) } catch { return [] }
}

function daysAgo(dateText) {
  if (!dateText) return 0
  const value = Math.floor((Date.now() - Date.parse(dateText)) / 86_400_000)
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function jobDto(db, row) {
  const requiredSkills = getJobSkills(db, row.id, 'required')
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location,
    city: row.city,
    province: row.province,
    barangay: row.barangay,
    address: row.address,
    salary: row.salary_text,
    salaryMin: row.salary_min ?? 0,
    salaryMax: row.salary_max ?? 0,
    employmentType: row.employment_type,
    workArrangement: row.work_arrangement,
    experienceLevel: row.experience_level,
    category: row.category,
    description: row.description,
    responsibilities: safeJson(row.responsibilities_json),
    requirements: safeJson(row.requirements_json),
    benefits: safeJson(row.benefits_json),
    requiredSkills,
    preferredSkills: getJobSkills(db, row.id, 'preferred'),
    skills: requiredSkills,
    openings: row.openings,
    daysAgo: daysAgo(row.date_posted),
    lat: row.latitude,
    lng: row.longitude,
    coordinateSource: row.coordinate_source,
    datePosted: row.date_posted,
    expirationDate: row.application_deadline,
    applicationUrl: row.application_url,
    sourceUrl: row.source_url,
    dataSource: row.data_source,
    postedBy: row.owner_user_id,
    applicationMode: row.application_mode,
    status: row.status,
  }
}

function seekerProfile(db, user) {
  const row = db.prepare('SELECT * FROM job_seeker_profiles WHERE user_id=?').get(user.id)
  const resume = row?.resume_file_id
    ? db.prepare('SELECT id, original_name, created_at FROM stored_files WHERE id=?').get(row.resume_file_id)
    : null
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: row.first_name,
    lastName: row.last_name,
    headline: row.headline,
    visibility: row.visibility,
    skills: getUserSkills(db, user.id),
    preferredLocation: row.preferred_location,
    preferredEmploymentType: row.preferred_employment_type,
    careerCategory: row.career_category,
    education: row.education,
    experienceLevel: row.experience_level,
    barangay: row.barangay,
    lat: row.latitude,
    lng: row.longitude,
    resume: resume ? { id: resume.id, name: resume.original_name, updatedAt: resume.created_at } : null,
    resumeName: resume?.original_name ?? '',
    resumeDate: resume?.created_at ?? '',
    photo: row.photo_key ? `/api/me/photo?v=${row.photo_key.slice(0, 8)}` : '',
  }
}

function employerProfile(db, user) {
  const row = db.prepare('SELECT * FROM employer_profiles WHERE user_id=?').get(user.id)
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    contactName: row.contact_name,
    companyName: row.company_name,
    industry: row.industry,
    description: row.description,
    address: row.address,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    website: row.website,
    companySize: row.company_size,
  }
}

function sessionDto(db, user, admin = false) {
  return {
    account: { id: user.id, email: user.email, role: user.role, isAdmin: admin },
    profile: user.role === 'job-seeker' ? seekerProfile(db, user) : employerProfile(db, user),
  }
}

function scoreSkills(requiredSkills, applicantSkills) {
  if (!requiredSkills.length || !applicantSkills.length) return 0
  const applicant = new Set(applicantSkills.map(normalizeSkill))
  return requiredSkills.reduce((sum, value) => sum + (applicant.has(normalizeSkill(value)) ? 1 : 0), 0) / requiredSkills.length
}

function assertPublishable(job) {
  const fields = {}
  for (const key of ['title', 'category', 'description', 'employmentType', 'workArrangement', 'experienceLevel', 'location', 'address']) {
    if (!job[key]) fields[key] = 'Required before publishing.'
  }
  if (!job.requirements.length) fields.requirements = 'At least one requirement is required.'
  if (!job.requiredSkills.length) fields.requiredSkills = 'At least one required skill is required.'
  if (job.city.toLowerCase() !== 'angeles city') fields.city = 'Only Angeles City jobs are supported.'
  if (job.lat == null || job.lng == null || !job.coordinateSource) fields.location = 'Verified coordinates are required.'
  if (job.salaryMin != null && job.salaryMax != null && job.salaryMin > job.salaryMax) fields.salaryMax = 'Must be at least the minimum salary.'
  if (Object.keys(fields).length) throw new ApiError(400, 'JOB_NOT_PUBLISHABLE', 'Complete the job before publishing.', fields)
}

function applicationDto(row) {
  const applicantSkills = safeJson(row.applicant_skills_json)
  return {
    id: row.id,
    jobId: row.job_id,
    jobTitle: row.job_title_snapshot,
    company: row.company_snapshot,
    dateApplied: row.applied_at,
    status: row.status,
    firstName: row.first_name_snapshot,
    lastName: row.last_name_snapshot,
    applicantName: `${row.first_name_snapshot} ${row.last_name_snapshot}`,
    email: row.email_snapshot,
    applicantEmail: row.email_snapshot,
    phone: row.phone_snapshot,
    coverLetter: row.cover_letter,
    applicantSkills,
    skillMatchScore: row.skill_match_score,
    matchScorePercent: Math.round(row.skill_match_score * 100),
    matchScore: Math.round(row.skill_match_score * 100),
    resume: { id: row.resume_file_id, name: row.resume_name },
    photo: row.applicant_photo_key
      ? `/api/applications/${row.id}/photo?v=${row.applicant_photo_key.slice(0, 8)}`
      : '',
    resumeName: row.resume_name,
  }
}

async function hashFile(filePath) {
  const hash = createHash('sha256')
  await new Promise((resolve, reject) => {
    createReadStream(filePath).on('data', (chunk) => hash.update(chunk)).on('end', resolve).on('error', reject)
  })
  return hash.digest('hex')
}

function removeIfPresent(filePath) {
  if (filePath && existsSync(filePath)) rmSync(filePath, { force: true })
}

export function createApp(config) {
  if (config.host !== '127.0.0.1') {
    throw new Error('JobFinder API host must be exactly 127.0.0.1')
  }
  mkdirSync(config.uploadDir, { recursive: true })
  const tempDir = path.join(config.uploadDir, 'tmp')
  const resumeDir = path.join(config.uploadDir, 'resumes')
  const photoDir = path.join(config.uploadDir, 'photos')
  mkdirSync(tempDir, { recursive: true })
  mkdirSync(resumeDir, { recursive: true })
  mkdirSync(photoDir, { recursive: true })

  const db = openDatabase(config.dbPath)
  initializeDatabase(db, { seed: config.seedOnStart })
  const requireAuth = authenticate(db)
  const adminEmails = new Set(config.adminEmails ?? [])
  const isAdmin = (user) => adminEmails.has(String(user?.email ?? '').toLowerCase())
  const requireAdmin = (req, _res, next) => {
    if (!isAdmin(req.auth)) {
      return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'))
    }
    next()
  }
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 'loopback')
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(express.json({ limit: '64kb' }))
  app.use(originGuard(config.appOrigin))

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false })
  const resetLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false })
  const mailer = createMailer(config.mail)
  const upload = multer({
    storage: multer.diskStorage({ destination: tempDir, filename: (_req, _file, cb) => cb(null, randomUUID()) }),
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10 },
  })

  async function acceptResume(file, ownerUserId, kind) {
    if (!file) throw new ApiError(400, 'RESUME_REQUIRED', 'A PDF or DOCX resume is required.')
    const detected = await fileTypeFromFile(file.path)
    const allowed = new Map([
      ['application/pdf', '.pdf'],
      ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
    ])
    if (!detected || !allowed.has(detected.mime)) {
      removeIfPresent(file.path)
      throw new ApiError(400, 'INVALID_RESUME', 'Only genuine PDF or DOCX files are accepted.')
    }
    const id = randomUUID()
    const storageKey = `${id}${allowed.get(detected.mime)}`
    const finalPath = path.join(resumeDir, storageKey)
    const digest = await hashFile(file.path)
    renameSync(file.path, finalPath)
    return {
      id, ownerUserId, kind, storageKey, finalPath,
      originalName: path.basename(file.originalname).slice(0, 255),
      mimeType: detected.mime, sizeBytes: file.size, sha256: digest, createdAt: nowIso(),
    }
  }

  const insertFile = db.prepare(`
    INSERT INTO stored_files(id, owner_user_id, kind, storage_key, original_name, mime_type, size_bytes, sha256, created_at)
    VALUES (@id, @ownerUserId, @kind, @storageKey, @originalName, @mimeType, @sizeBytes, @sha256, @createdAt)
  `)

  app.get('/api/health', (_req, res, next) => {
    try {
      db.prepare('SELECT 1').get()
      res.json({ ok: true, database: 'ok' })
    } catch (error) { next(error) }
  })

  app.post('/api/auth/register', authLimiter, asyncRoute(async (req, res) => {
    const input = parse(registerSchema, req.body)
    const email = input.email.toLowerCase()
    if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) {
      throw new ApiError(409, 'EMAIL_IN_USE', 'An account with this email already exists.', { email: 'Already registered.' })
    }
    const id = randomUUID()
    const timestamp = nowIso()
    const passwordHash = await hashPassword(input.password)
    db.transaction(() => {
      db.prepare('INSERT INTO users(id,email,password_hash,role,created_at,updated_at) VALUES (?,?,?,?,?,?)')
        .run(id, email, passwordHash, input.role, timestamp, timestamp)
      if (input.role === 'job-seeker') {
        db.prepare(`
          INSERT INTO job_seeker_profiles(user_id,first_name,last_name,updated_at)
          VALUES (?,?,?,?)
        `).run(id, input.firstName, input.lastName, timestamp)
      } else {
        db.prepare(`
          INSERT INTO employer_profiles(user_id,contact_name,company_name,industry,address,contact_email,updated_at)
          VALUES (?,?,?,?,?,?,?)
        `).run(id, input.contactName, input.companyName, input.industry, 'Angeles City, Pampanga', email, timestamp)
      }
    })()
    const session = createSession(db, id, config.sessionTtlSeconds)
    writeSessionCookie(res, session.token, session.expires, config.secureCookies)
    res.status(201).json(sessionDto(db, { id, email, role: input.role }, isAdmin({ email })))
  }))

  app.post('/api/auth/login', authLimiter, asyncRoute(async (req, res) => {
    const input = parse(loginSchema, req.body)
    const user = db.prepare('SELECT id,email,password_hash,role FROM users WHERE email=? AND is_active=1').get(input.email.toLowerCase())
    const valid = user ? await verifyPassword(input.password, user.password_hash) : (await hashPassword(input.password), false)
    if (!valid) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.')
    const ttl = input.rememberMe ? config.rememberTtlSeconds : config.sessionTtlSeconds
    const session = createSession(db, user.id, ttl)
    writeSessionCookie(res, session.token, session.expires, config.secureCookies)
    res.json(sessionDto(db, user, isAdmin(user)))
  }))


  app.post('/api/auth/forgot-password', resetLimiter, asyncRoute(async (req, res) => {
    const input = parse(forgotPasswordSchema, req.body)
    const user = db.prepare('SELECT id,email FROM users WHERE email=? AND is_active=1').get(input.email.toLowerCase())

    if (user && mailer.enabled) {
      const token = randomBytes(32).toString('base64url')
      const timestamp = nowIso()
      const expiresAt = new Date(Date.now() + config.resetTokenTtlSeconds * 1000).toISOString()

      db.transaction(() => {
        db.prepare('DELETE FROM password_reset_tokens WHERE user_id=? AND used_at IS NULL').run(user.id)
        db.prepare(`
          INSERT INTO password_reset_tokens(id,user_id,token_hash,created_at,expires_at)
          VALUES (?,?,?,?,?)
        `).run(randomUUID(), user.id, sha256(token), timestamp, expiresAt)
      })()

      const resetUrl = `${config.appOrigin}/?reset=${token}`
      const message = passwordResetEmail(resetUrl, Math.round(config.resetTokenTtlSeconds / 60))
      try {
        await mailer.send({ to: user.email, ...message })
      } catch (error) {
        console.error('Password reset email failed', error)
      }
    }

    res.status(202).json({ ok: true })
  }))

  app.post('/api/auth/reset-password', resetLimiter, asyncRoute(async (req, res) => {
    const input = parse(resetPasswordSchema, req.body)
    const row = db.prepare(`
      SELECT t.id, t.user_id, t.expires_at, t.used_at
      FROM password_reset_tokens t
      JOIN users u ON u.id=t.user_id AND u.is_active=1
      WHERE t.token_hash=?
    `).get(sha256(input.token))

    if (!row || row.used_at || Date.parse(row.expires_at) < Date.now()) {
      throw new ApiError(400, 'INVALID_RESET_TOKEN', 'This reset link is invalid or has expired. Please request a new one.')
    }

    const passwordHash = await hashPassword(input.password)
    const timestamp = nowIso()
    db.transaction(() => {
      db.prepare('UPDATE users SET password_hash=?,updated_at=? WHERE id=?').run(passwordHash, timestamp, row.user_id)
      db.prepare('UPDATE password_reset_tokens SET used_at=? WHERE id=?').run(timestamp, row.id)
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id)
    })()

    res.json({ ok: true })
  }))

  app.get('/api/auth/me', requireAuth, (req, res) => res.json(sessionDto(db, req.auth, isAdmin(req.auth))))
  app.post('/api/auth/logout', requireAuth, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE id=?').run(req.auth.sessionId)
    clearSessionCookie(res, config.secureCookies)
    res.status(204).end()
  })

  app.get('/api/jobs', (req, res) => {
    let rows = db.prepare("SELECT * FROM jobs WHERE status='active' ORDER BY date_posted DESC, created_at DESC").all()
    const q = String(req.query.query ?? '').trim().toLowerCase()
    const barangay = String(req.query.barangay ?? '').trim().toLowerCase()
    const employmentType = String(req.query.employmentType ?? '').trim().toLowerCase()
    const experienceLevel = String(req.query.experienceLevel ?? '').trim().toLowerCase()
    rows = rows.filter((row) =>
      (!q || `${row.title} ${row.company} ${row.description}`.toLowerCase().includes(q)) &&
      (!barangay || String(row.barangay ?? '').toLowerCase() === barangay) &&
      (!employmentType || row.employment_type.toLowerCase() === employmentType) &&
      (!experienceLevel || row.experience_level.toLowerCase() === experienceLevel))
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit ?? '100', 10) || 100))
    res.json({ items: rows.slice(0, limit).map((row) => jobDto(db, row)), total: rows.length })
  })

  app.get('/api/jobs/:jobId', (req, res, next) => {
    const row = db.prepare("SELECT * FROM jobs WHERE id=? AND status='active'").get(req.params.jobId)
    if (!row) return next(new ApiError(404, 'JOB_NOT_FOUND', 'Job not found.'))
    res.json({ job: jobDto(db, row) })
  })

  app.get('/api/me/profile', requireAuth, (req, res) => res.json({ profile: sessionDto(db, req.auth, isAdmin(req.auth)).profile }))

  app.patch('/api/me/profile', requireAuth, (req, res, next) => {
    try {
      const timestamp = nowIso()
      if (req.auth.role === 'job-seeker') {
        const input = selectKeys(req.body, PROFILE_FIELDS)
        const row = db.prepare('SELECT * FROM job_seeker_profiles WHERE user_id=?').get(req.auth.id)
        const merged = {
          firstName: input.firstName ?? row.first_name, lastName: input.lastName ?? row.last_name,
          headline: input.headline ?? row.headline, visibility: input.visibility ?? row.visibility,
          preferredLocation: input.preferredLocation ?? row.preferred_location,
          preferredEmploymentType: input.preferredEmploymentType ?? row.preferred_employment_type,
          careerCategory: input.careerCategory ?? row.career_category, education: input.education ?? row.education,
          experienceLevel: input.experienceLevel ?? row.experience_level, barangay: input.barangay ?? row.barangay,
          lat: input.lat ?? row.latitude, lng: input.lng ?? row.longitude,
        }
        if (!merged.firstName?.trim() || !merged.lastName?.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'First and last name are required.')
        if (!['public', 'private'].includes(merged.visibility)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid visibility.')
        db.transaction(() => {
          db.prepare(`
            UPDATE job_seeker_profiles SET first_name=?,last_name=?,headline=?,visibility=?,preferred_location=?,
              preferred_employment_type=?,career_category=?,education=?,experience_level=?,barangay=?,latitude=?,longitude=?,updated_at=?
            WHERE user_id=?
          `).run(merged.firstName.trim(), merged.lastName.trim(), merged.headline, merged.visibility, merged.preferredLocation,
            merged.preferredEmploymentType, merged.careerCategory, merged.education, merged.experienceLevel,
            merged.barangay, merged.lat, merged.lng, timestamp, req.auth.id)
          if (Array.isArray(input.skills)) replaceUserSkills(db, req.auth.id, input.skills)
        })()
      } else {
        const input = selectKeys(req.body, EMPLOYER_FIELDS)
        const row = employerProfile(db, req.auth)
        const merged = { ...row, ...input }
        if (!merged.companyName?.trim() || !merged.industry?.trim() || !merged.contactName?.trim()) {
          throw new ApiError(400, 'VALIDATION_ERROR', 'Company, industry, and contact name are required.')
        }
        db.prepare(`
          UPDATE employer_profiles SET contact_name=?,company_name=?,industry=?,description=?,address=?,
            contact_email=?,contact_phone=?,website=?,company_size=?,updated_at=? WHERE user_id=?
        `).run(merged.contactName, merged.companyName, merged.industry, merged.description, merged.address,
          merged.contactEmail, merged.contactPhone, merged.website, merged.companySize, timestamp, req.auth.id)
      }
      res.json({ profile: sessionDto(db, req.auth, isAdmin(req.auth)).profile })
    } catch (error) { next(error) }
  })

  app.put('/api/me/resume', requireAuth, requireRole('job-seeker'), upload.single('resume'), asyncRoute(async (req, res) => {
    let accepted
    let oldFile
    let committed = false
    let responseId
    try {
      oldFile = db.prepare(`
        SELECT f.id, f.storage_key
        FROM job_seeker_profiles p
        JOIN stored_files f ON f.id=p.resume_file_id
        WHERE p.user_id=? AND f.kind='profile-resume'
      `).get(req.auth.id)
      accepted = await acceptResume(req.file, req.auth.id, 'profile-resume')
      db.transaction(() => {
        if (oldFile) {
          const updated = db.prepare(`
            UPDATE stored_files SET storage_key=@storageKey,original_name=@originalName,
              mime_type=@mimeType,size_bytes=@sizeBytes,sha256=@sha256,created_at=@createdAt
            WHERE id=@oldId AND owner_user_id=@ownerUserId AND kind='profile-resume'
          `).run({ ...accepted, oldId: oldFile.id })
          if (updated.changes !== 1) throw new Error('Profile resume replacement lost ownership')
          responseId = oldFile.id
          db.prepare('UPDATE job_seeker_profiles SET updated_at=? WHERE user_id=?')
            .run(nowIso(), req.auth.id)
        } else {
          insertFile.run(accepted)
          responseId = accepted.id
          db.prepare('UPDATE job_seeker_profiles SET resume_file_id=?,updated_at=? WHERE user_id=?')
            .run(accepted.id, nowIso(), req.auth.id)
        }
      })()
      committed = true
    } catch (error) {
      removeIfPresent(req.file?.path)
      if (!committed) removeIfPresent(accepted?.finalPath)
      throw error
    }
    if (oldFile && oldFile.storage_key !== accepted.storageKey) {
      try {
        removeIfPresent(path.join(resumeDir, oldFile.storage_key))
      } catch (error) {
        console.error('Failed to remove replaced profile resume file', error)
      }
    }
    res.status(201).json({ resume: { id: responseId, name: accepted.originalName, updatedAt: accepted.createdAt } })
  }))

  app.delete('/api/me/resume', requireAuth, requireRole('job-seeker'), (req, res) => {
    const file = db.prepare(`
      SELECT f.id, f.storage_key
      FROM job_seeker_profiles p
      JOIN stored_files f ON f.id=p.resume_file_id
      WHERE p.user_id=? AND f.kind='profile-resume'
    `).get(req.auth.id)
    if (!file) return res.status(204).end()

    db.transaction(() => {
      db.prepare('UPDATE job_seeker_profiles SET resume_file_id=NULL,updated_at=? WHERE user_id=?')
        .run(nowIso(), req.auth.id)
      db.prepare("DELETE FROM stored_files WHERE id=? AND owner_user_id=? AND kind='profile-resume'")
        .run(file.id, req.auth.id)
    })()

    try {
      removeIfPresent(path.join(resumeDir, file.storage_key))
    } catch (error) {
      console.error('Failed to remove deleted profile resume file', error)
    }
    res.status(204).end()
  })

  app.get('/api/me/resume/download', requireAuth, requireRole('job-seeker'), (req, res, next) => {
    const file = db.prepare(`
      SELECT f.* FROM job_seeker_profiles p JOIN stored_files f ON f.id=p.resume_file_id
      WHERE p.user_id=?
    `).get(req.auth.id)
    if (!file) return next(new ApiError(404, 'RESUME_NOT_FOUND', 'Resume not found.'))
    res.type(file.mime_type).set('X-Content-Type-Options', 'nosniff').download(path.join(resumeDir, file.storage_key), file.original_name)
  })

  const photoUpload = multer({
    storage: multer.diskStorage({ destination: tempDir, filename: (_req, _file, cb) => cb(null, randomUUID()) }),
    limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0 },
  })

  const PHOTO_TYPES = new Map([
    ['image/png', '.png'],
    ['image/jpeg', '.jpg'],
    ['image/webp', '.webp'],
  ])

  app.put('/api/me/photo', requireAuth, requireRole('job-seeker'), photoUpload.single('photo'), asyncRoute(async (req, res) => {
    if (!req.file) throw new ApiError(400, 'PHOTO_REQUIRED', 'Choose a PNG, JPEG or WebP image.')
    let storedKey
    try {
      const detected = await fileTypeFromFile(req.file.path)
      if (!detected || !PHOTO_TYPES.has(detected.mime)) {
        throw new ApiError(400, 'INVALID_PHOTO', 'Only genuine PNG, JPEG or WebP images are accepted.')
      }
      storedKey = `${randomUUID()}${PHOTO_TYPES.get(detected.mime)}`
      renameSync(req.file.path, path.join(photoDir, storedKey))
    } catch (error) {
      removeIfPresent(req.file?.path)
      throw error
    }

    const previous = db.prepare('SELECT photo_key FROM job_seeker_profiles WHERE user_id=?').get(req.auth.id)
    db.prepare('UPDATE job_seeker_profiles SET photo_key=?,updated_at=? WHERE user_id=?')
      .run(storedKey, nowIso(), req.auth.id)
    if (previous?.photo_key && previous.photo_key !== storedKey) {
      removeIfPresent(path.join(photoDir, previous.photo_key))
    }

    res.status(201).json({ photo: `/api/me/photo?v=${storedKey.slice(0, 8)}` })
  }))

  app.get('/api/me/photo', requireAuth, requireRole('job-seeker'), (req, res, next) => {
    const row = db.prepare('SELECT photo_key FROM job_seeker_profiles WHERE user_id=?').get(req.auth.id)
    if (!row?.photo_key) return next(new ApiError(404, 'PHOTO_NOT_FOUND', 'No profile photo has been uploaded.'))
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Cache-Control', 'private, max-age=300')
    res.sendFile(path.join(photoDir, row.photo_key))
  })

  app.delete('/api/me/photo', requireAuth, requireRole('job-seeker'), (req, res) => {
    const row = db.prepare('SELECT photo_key FROM job_seeker_profiles WHERE user_id=?').get(req.auth.id)
    if (row?.photo_key) {
      db.prepare('UPDATE job_seeker_profiles SET photo_key=NULL,updated_at=? WHERE user_id=?').run(nowIso(), req.auth.id)
      removeIfPresent(path.join(photoDir, row.photo_key))
    }
    res.status(204).end()
  })

  app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
    const rows = db.prepare(`
      SELECT
        u.id, u.email, u.role, u.is_active, u.created_at,
        s.first_name, s.last_name, s.headline, s.photo_key, s.resume_file_id,
        e.company_name, e.industry,
        (SELECT count(*) FROM saved_jobs sj WHERE sj.user_id = u.id) AS saved_jobs,
        (SELECT count(*) FROM applications a WHERE a.applicant_user_id = u.id) AS applications,
        (SELECT count(*) FROM jobs j WHERE j.owner_user_id = u.id) AS jobs_posted,
        (SELECT max(sn.last_seen_at) FROM sessions sn WHERE sn.user_id = u.id) AS last_seen
      FROM users u
      LEFT JOIN job_seeker_profiles s ON s.user_id = u.id
      LEFT JOIN employer_profiles e ON e.user_id = u.id
      ORDER BY u.created_at DESC
    `).all()

    const postings = db.prepare(`
      SELECT
        j.id, j.owner_user_id, j.title, j.status, j.employment_type, j.date_posted, j.created_at,
        (SELECT count(*) FROM applications a WHERE a.job_id = j.id) AS applicant_count
      FROM jobs j
      WHERE j.owner_user_id IS NOT NULL
      ORDER BY j.created_at DESC
    `).all()

    const byOwner = new Map()
    for (const job of postings) {
      const list = byOwner.get(job.owner_user_id) ?? []
      list.push({
        id: job.id,
        title: job.title,
        status: job.status,
        employmentType: job.employment_type,
        applicants: job.applicant_count,
        postedAt: job.date_posted ?? job.created_at,
      })
      byOwner.set(job.owner_user_id, list)
    }

    res.json({
      items: rows.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        jobs: byOwner.get(row.id) ?? [],
        active: row.is_active === 1,
        name: row.role === 'employer'
          ? row.company_name
          : `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
        detail: row.role === 'employer' ? row.industry : row.headline,
        savedJobs: row.saved_jobs,
        applications: row.applications,
        jobsPosted: row.jobs_posted,
        hasResume: Boolean(row.resume_file_id),
        hasPhoto: Boolean(row.photo_key),
        createdAt: row.created_at,
        lastSeen: row.last_seen,
      })),
      totals: {
        users: rows.length,
        seekers: rows.filter((r) => r.role === 'job-seeker').length,
        employers: rows.filter((r) => r.role === 'employer').length,
      },
    })
  })

  app.delete('/api/admin/jobs/:jobId', requireAuth, requireAdmin, (req, res, next) => {
    const job = db.prepare('SELECT id, title, data_source FROM jobs WHERE id=?').get(req.params.jobId)
    if (!job) return next(new ApiError(404, 'JOB_NOT_FOUND', 'Job not found.'))

    if (job.data_source !== 'employer-created') {
      return next(new ApiError(409, 'SEEDED_JOB',
        'Verified listings come from the dataset and would return on the next seed. Remove them from jobs.verified.json instead.'))
    }

    const applications = db.prepare('SELECT count(*) AS count FROM applications WHERE job_id=?').get(job.id).count
    if (applications > 0) {
      return next(new ApiError(409, 'JOB_HAS_APPLICATIONS',
        `This posting has ${applications} application${applications === 1 ? '' : 's'}. Deleting it would destroy those records.`))
    }

    db.transaction(() => {
      db.prepare('DELETE FROM saved_jobs WHERE job_id=?').run(job.id)
      db.prepare('DELETE FROM job_skills WHERE job_id=?').run(job.id)
      db.prepare('DELETE FROM jobs WHERE id=?').run(job.id)
    })()

    res.status(204).end()
  })

  app.get('/api/me/saved-jobs', requireAuth, requireRole('job-seeker'), (req, res) => {
    const jobIds = db.prepare('SELECT job_id FROM saved_jobs WHERE user_id=? ORDER BY created_at DESC').all(req.auth.id).map((r) => r.job_id)
    res.json({ jobIds })
  })
  app.put('/api/me/saved-jobs/:jobId', requireAuth, requireRole('job-seeker'), (req, res, next) => {
    if (!db.prepare("SELECT 1 FROM jobs WHERE id=? AND status='active'").get(req.params.jobId)) return next(new ApiError(404, 'JOB_NOT_FOUND', 'Job not found.'))
    db.prepare('INSERT OR IGNORE INTO saved_jobs(user_id,job_id,created_at) VALUES (?,?,?)').run(req.auth.id, req.params.jobId, nowIso())
    res.status(204).end()
  })
  app.delete('/api/me/saved-jobs/:jobId', requireAuth, requireRole('job-seeker'), (req, res) => {
    db.prepare('DELETE FROM saved_jobs WHERE user_id=? AND job_id=?').run(req.auth.id, req.params.jobId)
    res.status(204).end()
  })

  app.get('/api/employer/jobs', requireAuth, requireRole('employer'), (req, res) => {
    const rows = db.prepare('SELECT * FROM jobs WHERE owner_user_id=? ORDER BY created_at DESC').all(req.auth.id)
    const count = db.prepare('SELECT count(*) AS count FROM applications WHERE job_id=?')
    res.json({ items: rows.map((row) => ({ ...jobDto(db, row), applicantCount: count.get(row.id).count })) })
  })

  app.post('/api/employer/jobs', requireAuth, requireRole('employer'), (req, res) => {
    const input = parse(jobInputSchema, req.body)
    if (input.status === 'active') assertPublishable(input)
    const employer = employerProfile(db, req.auth)
    const id = randomUUID()
    const timestamp = nowIso()
    db.transaction(() => {
      db.prepare(`
        INSERT INTO jobs(id,owner_user_id,title,company,location,city,province,barangay,address,salary_text,salary_min,salary_max,
          employment_type,work_arrangement,experience_level,category,description,responsibilities_json,requirements_json,benefits_json,
          openings,latitude,longitude,coordinate_source,date_posted,application_deadline,data_source,application_mode,status,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'employer-created','internal',?,?,?)
      `).run(id, req.auth.id, input.title, employer.companyName, input.location, input.city, input.province, input.barangay,
        input.address, input.salary, input.salaryMin, input.salaryMax, input.employmentType, input.workArrangement,
        input.experienceLevel, input.category, input.description, JSON.stringify(input.responsibilities), JSON.stringify(input.requirements),
        JSON.stringify(input.benefits), input.openings, input.lat, input.lng, input.coordinateSource,
        input.status === 'active' ? timestamp.slice(0, 10) : null, input.applicationDeadline, input.status, timestamp, timestamp)
      replaceJobSkills(db, id, input.requiredSkills, input.preferredSkills)
    })()
    res.status(201).json({ job: jobDto(db, db.prepare('SELECT * FROM jobs WHERE id=?').get(id)) })
  })

  app.patch('/api/employer/jobs/:jobId', requireAuth, requireRole('employer'), (req, res, next) => {
    const row = db.prepare('SELECT * FROM jobs WHERE id=? AND owner_user_id=?').get(req.params.jobId, req.auth.id)
    if (!row) return next(new ApiError(404, 'JOB_NOT_FOUND', 'Job not found.'))
    const current = jobDto(db, row)
    const currentInput = {
      title: current.title, category: current.category, description: current.description,
      responsibilities: current.responsibilities, requirements: current.requirements,
      benefits: current.benefits, requiredSkills: current.requiredSkills,
      preferredSkills: current.preferredSkills, employmentType: current.employmentType,
      workArrangement: current.workArrangement, experienceLevel: current.experienceLevel,
      location: current.location, city: current.city, province: current.province,
      barangay: current.barangay, address: current.address, salaryMin: current.salaryMin,
      salaryMax: current.salaryMax, salary: current.salary, openings: current.openings,
      applicationDeadline: current.expirationDate, lat: current.lat, lng: current.lng,
      coordinateSource: current.coordinateSource, status: current.status,
    }
    const input = parse(jobInputSchema, { ...currentInput, ...req.body })
    if (input.status === 'active') assertPublishable(input)
    const employer = employerProfile(db, req.auth)
    db.transaction(() => {
      db.prepare(`
        UPDATE jobs SET title=?,company=?,location=?,city=?,province=?,barangay=?,address=?,salary_text=?,salary_min=?,salary_max=?,
          employment_type=?,work_arrangement=?,experience_level=?,category=?,description=?,responsibilities_json=?,requirements_json=?,
          benefits_json=?,openings=?,latitude=?,longitude=?,coordinate_source=?,date_posted=COALESCE(date_posted,?),
          application_deadline=?,status=?,updated_at=? WHERE id=? AND owner_user_id=?
      `).run(input.title, employer.companyName, input.location, input.city, input.province, input.barangay, input.address,
        input.salary, input.salaryMin, input.salaryMax, input.employmentType, input.workArrangement, input.experienceLevel,
        input.category, input.description, JSON.stringify(input.responsibilities), JSON.stringify(input.requirements),
        JSON.stringify(input.benefits), input.openings, input.lat, input.lng, input.coordinateSource,
        input.status === 'active' ? nowIso().slice(0, 10) : null, input.applicationDeadline, input.status, nowIso(), row.id, req.auth.id)
      replaceJobSkills(db, row.id, input.requiredSkills, input.preferredSkills)
    })()
    res.json({ job: jobDto(db, db.prepare('SELECT * FROM jobs WHERE id=?').get(row.id)) })
  })

  app.get('/api/me/applications', requireAuth, requireRole('job-seeker'), (req, res) => {
    const rows = db.prepare(`
      SELECT a.*, f.original_name AS resume_name, p.photo_key AS applicant_photo_key
      FROM applications a
      JOIN stored_files f ON f.id=a.resume_file_id
      LEFT JOIN job_seeker_profiles p ON p.user_id=a.applicant_user_id
      WHERE a.applicant_user_id=? ORDER BY a.applied_at DESC
    `).all(req.auth.id)
    res.json({ items: rows.map(applicationDto) })
  })

  app.post('/api/jobs/:jobId/applications', requireAuth, requireRole('job-seeker'), upload.single('resume'), asyncRoute(async (req, res) => {
    let accepted
    try {
      const input = parse(applicationSchema, req.body)
      const job = db.prepare("SELECT * FROM jobs WHERE id=? AND status='active'").get(req.params.jobId)
      if (!job) throw new ApiError(404, 'JOB_NOT_FOUND', 'Job not found.')
      if (job.application_mode === 'external') {
        throw new ApiError(409, 'EXTERNAL_APPLICATION_ONLY', 'Apply through the verified external source.', { applicationUrl: job.application_url })
      }
      if (job.application_deadline && Date.parse(job.application_deadline) < Date.now()) throw new ApiError(409, 'APPLICATIONS_CLOSED', 'Applications are closed.')
      if (db.prepare('SELECT 1 FROM applications WHERE job_id=? AND applicant_user_id=?').get(job.id, req.auth.id)) {
        throw new ApiError(409, 'DUPLICATE_APPLICATION', 'You have already applied for this job.')
      }
      accepted = await acceptResume(req.file, req.auth.id, 'application-resume')
      const applicantSkills = getUserSkills(db, req.auth.id)
      const requiredSkills = getJobSkills(db, job.id, 'required')
      const score = scoreSkills(requiredSkills, applicantSkills)
      const id = randomUUID()
      const timestamp = nowIso()
      db.transaction(() => {
        insertFile.run(accepted)
        db.prepare(`
          INSERT INTO applications(id,job_id,applicant_user_id,job_title_snapshot,company_snapshot,first_name_snapshot,
            last_name_snapshot,email_snapshot,phone_snapshot,cover_letter,resume_file_id,applicant_skills_json,
            required_skills_json,skill_match_score,matching_version,status,applied_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'applied',?,?)
        `).run(id, job.id, req.auth.id, job.title, job.company, input.firstName, input.lastName, input.email,
          input.phone, input.coverLetter, accepted.id, JSON.stringify(applicantSkills), JSON.stringify(requiredSkills),
          score, 'exact-snapshot-v1', timestamp, timestamp)
        db.prepare(`
          INSERT INTO application_status_history(application_id,from_status,to_status,changed_by_user_id,changed_at)
          VALUES (?,NULL,'applied',?,?)
        `).run(id, req.auth.id, timestamp)
      })()
      const row = db.prepare(`SELECT a.*, f.original_name AS resume_name, p.photo_key AS applicant_photo_key FROM applications a JOIN stored_files f ON f.id=a.resume_file_id LEFT JOIN job_seeker_profiles p ON p.user_id=a.applicant_user_id WHERE a.id=?`).get(id)
      res.status(201).json({ application: applicationDto(row) })
    } catch (error) {
      removeIfPresent(req.file?.path)
      removeIfPresent(accepted?.finalPath)
      throw error
    }
  }))

  app.get('/api/employer/applications', requireAuth, requireRole('employer'), (req, res) => {
    const params = [req.auth.id]
    let where = 'j.owner_user_id=?'
    if (req.query.jobId) { where += ' AND a.job_id=?'; params.push(String(req.query.jobId)) }
    if (req.query.status) { where += ' AND a.status=?'; params.push(String(req.query.status)) }
    const rows = db.prepare(`
      SELECT a.*, f.original_name AS resume_name, p.photo_key AS applicant_photo_key
      FROM applications a
      JOIN jobs j ON j.id=a.job_id JOIN stored_files f ON f.id=a.resume_file_id
      LEFT JOIN job_seeker_profiles p ON p.user_id=a.applicant_user_id
      WHERE ${where} ORDER BY a.skill_match_score DESC, a.applied_at DESC
    `).all(...params)
    res.json({ items: rows.map(applicationDto) })
  })

  app.patch('/api/employer/applications/:applicationId/status', requireAuth, requireRole('employer'), (req, res, next) => {
    const status = req.body?.status
    if (!APPLICATION_STATUSES.includes(status)) return next(new ApiError(400, 'VALIDATION_ERROR', 'Invalid application status.'))
    const row = db.prepare(`
      SELECT a.* FROM applications a JOIN jobs j ON j.id=a.job_id
      WHERE a.id=? AND j.owner_user_id=?
    `).get(req.params.applicationId, req.auth.id)
    if (!row) return next(new ApiError(404, 'APPLICATION_NOT_FOUND', 'Application not found.'))
    const timestamp = nowIso()
    db.transaction(() => {
      db.prepare('UPDATE applications SET status=?,updated_at=? WHERE id=?').run(status, timestamp, row.id)
      db.prepare(`INSERT INTO application_status_history(application_id,from_status,to_status,changed_by_user_id,changed_at) VALUES (?,?,?,?,?)`)
        .run(row.id, row.status, status, req.auth.id, timestamp)
    })()
    res.json({ id: row.id, status })
  })

  app.get('/api/applications/:applicationId/photo', requireAuth, (req, res, next) => {
    const row = db.prepare(`
      SELECT a.applicant_user_id, j.owner_user_id AS job_owner_user_id, p.photo_key
      FROM applications a
      JOIN jobs j ON j.id=a.job_id
      LEFT JOIN job_seeker_profiles p ON p.user_id=a.applicant_user_id
      WHERE a.id=?
    `).get(req.params.applicationId)

    if (!row || (row.applicant_user_id !== req.auth.id && row.job_owner_user_id !== req.auth.id)) {
      return next(new ApiError(404, 'PHOTO_NOT_FOUND', 'Photo not found.'))
    }
    if (!row.photo_key) return next(new ApiError(404, 'PHOTO_NOT_FOUND', 'This applicant has no photo.'))

    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Cache-Control', 'private, max-age=300')
    res.sendFile(path.join(photoDir, row.photo_key))
  })

  app.get('/api/applications/:applicationId/resume', requireAuth, (req, res, next) => {
    const row = db.prepare(`
      SELECT a.applicant_user_id, j.owner_user_id AS job_owner_user_id, f.* FROM applications a
      JOIN jobs j ON j.id=a.job_id JOIN stored_files f ON f.id=a.resume_file_id
      WHERE a.id=?
    `).get(req.params.applicationId)
    if (!row || (row.applicant_user_id !== req.auth.id && row.job_owner_user_id !== req.auth.id)) {
      return next(new ApiError(404, 'RESUME_NOT_FOUND', 'Resume not found.'))
    }
    res.type(row.mime_type).set('X-Content-Type-Options', 'nosniff')
      .download(path.join(resumeDir, row.storage_key), row.original_name)
  })

  app.use('/api', (_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'API route not found.')))
  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE' ? 'Resume must be 5 MB or smaller.' : 'Invalid upload.'
      return res.status(400).json({ error: { code: 'INVALID_UPLOAD', message } })
    }
    const status = error instanceof ApiError ? error.status : 500
    if (status === 500) console.error(error)
    const body = { code: error.code ?? 'INTERNAL_ERROR', message: status === 500 ? 'Unexpected server error.' : error.message }
    if (error.fields) body.fields = error.fields
    res.status(status).json({ error: body })
  })

  return { app, db, close: () => db.close() }
}

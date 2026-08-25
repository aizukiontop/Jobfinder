import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const serverDir = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.join(serverDir, 'schema.sql')
export const verifiedJobsPath = path.resolve(serverDir, '..', 'src', 'data', 'jobs.verified.json')

export function nowIso() {
  return new Date().toISOString()
}

export function normalizeSkill(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9/. ]/g, '')
    .replace(/\s+/g, ' ')
}

export function openDatabase(dbPath) {
  mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('cache_size = -4096')
  db.pragma('journal_size_limit = 16777216')
  return db
}

export function migrate(db) {
  db.exec(readFileSync(schemaPath, 'utf8'))
}

function ensureSkill(db, name) {
  const normalized = normalizeSkill(name)
  if (!normalized) return null
  db.prepare(`
    INSERT INTO skills(name, normalized_name)
    VALUES (?, ?)
    ON CONFLICT(normalized_name) DO UPDATE SET name = excluded.name
  `).run(String(name).trim(), normalized)
  return db.prepare('SELECT id FROM skills WHERE normalized_name = ?').get(normalized).id
}

export function replaceUserSkills(db, userId, skillNames) {
  const replace = db.transaction(() => {
    db.prepare('DELETE FROM user_skills WHERE user_id = ?').run(userId)
    const insert = db.prepare('INSERT INTO user_skills(user_id, skill_id, position) VALUES (?, ?, ?)')
    const seen = new Set()
    for (const [position, name] of skillNames.entries()) {
      const normalized = normalizeSkill(name)
      if (!normalized || seen.has(normalized)) continue
      seen.add(normalized)
      const skillId = ensureSkill(db, name)
      if (skillId) insert.run(userId, skillId, position)
    }
  })
  replace()
}

export function replaceJobSkills(db, jobId, requiredSkills, preferredSkills) {
  db.prepare('DELETE FROM job_skills WHERE job_id = ?').run(jobId)
  const insert = db.prepare(`
    INSERT OR IGNORE INTO job_skills(job_id, skill_id, kind, position)
    VALUES (?, ?, ?, ?)
  `)
  for (const [kind, names] of [['required', requiredSkills], ['preferred', preferredSkills]]) {
    const seen = new Set()
    for (const [position, name] of names.entries()) {
      const normalized = normalizeSkill(name)
      if (!normalized || seen.has(normalized)) continue
      seen.add(normalized)
      const skillId = ensureSkill(db, name)
      if (skillId) insert.run(jobId, skillId, kind, position)
    }
  }
}

export function getUserSkills(db, userId) {
  return db.prepare(`
    SELECT s.name
    FROM user_skills us
    JOIN skills s ON s.id = us.skill_id
    WHERE us.user_id = ?
    ORDER BY us.position, s.id
  `).all(userId).map((row) => row.name)
}

export function getJobSkills(db, jobId, kind) {
  return db.prepare(`
    SELECT s.name
    FROM job_skills js
    JOIN skills s ON s.id = js.skill_id
    WHERE js.job_id = ? AND js.kind = ?
    ORDER BY js.position, s.id
  `).all(jobId, kind).map((row) => row.name)
}

export function seedVerifiedJobs(db, datasetPath = verifiedJobsPath) {
  const raw = readFileSync(datasetPath)
  const hash = createHash('sha256').update(raw).digest('hex')
  const jobs = JSON.parse(raw.toString('utf8'))
  if (!Array.isArray(jobs) || jobs.length === 0) {
    throw new Error('Verified job seed must contain at least one record')
  }
  if (jobs.some((job) => job.dataSource !== 'external-verified')) {
    throw new Error('Verified job seed contains a non-verified record')
  }
  for (const job of jobs) {
    if (job.coordinateSource === 'google-maps-verified') job.coordinateSource = 'exact-address'
  }

  const upsert = db.prepare(`
    INSERT INTO jobs(
      id, owner_user_id, title, company, location, city, province, barangay, address,
      salary_text, salary_min, salary_max, employment_type, work_arrangement,
      experience_level, category, description, responsibilities_json,
      requirements_json, benefits_json, openings, latitude, longitude,
      coordinate_source, date_posted, application_deadline, application_url,
      source_url, data_source, application_mode, status, seed_revision,
      created_at, updated_at
    ) VALUES (
      @id, NULL, @title, @company, @location, @city, @province, @barangay, @address,
      @salary, @salaryMin, @salaryMax, @employmentType, @workArrangement,
      @experienceLevel, @category, @description, @responsibilities,
      @requirements, @benefits, @openings, @lat, @lng,
      @coordinateSource, @datePosted, @expirationDate, @applicationUrl,
      @sourceUrl, 'external-verified', 'external', 'active', @seedRevision,
      @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title, company=excluded.company, location=excluded.location,
      city=excluded.city, province=excluded.province, barangay=excluded.barangay,
      address=excluded.address, salary_text=excluded.salary_text,
      salary_min=excluded.salary_min, salary_max=excluded.salary_max,
      employment_type=excluded.employment_type,
      work_arrangement=excluded.work_arrangement,
      experience_level=excluded.experience_level, category=excluded.category,
      description=excluded.description,
      responsibilities_json=excluded.responsibilities_json,
      requirements_json=excluded.requirements_json,
      benefits_json=excluded.benefits_json, openings=excluded.openings,
      latitude=excluded.latitude, longitude=excluded.longitude,
      coordinate_source=excluded.coordinate_source, date_posted=excluded.date_posted,
      application_deadline=excluded.application_deadline,
      application_url=excluded.application_url, source_url=excluded.source_url,
      application_mode='external', status='active', seed_revision=excluded.seed_revision,
      updated_at=excluded.updated_at
    WHERE jobs.data_source='external-verified'
  `)

  const seed = db.transaction(() => {
    const timestamp = nowIso()
    for (const job of jobs) {
      upsert.run({
        ...job,
        responsibilities: JSON.stringify(job.responsibilities ?? []),
        requirements: JSON.stringify(job.requirements ?? []),
        benefits: JSON.stringify(job.benefits ?? []),
        expirationDate: job.expirationDate ?? null,
        applicationUrl: job.applicationUrl ?? null,
        sourceUrl: job.sourceUrl ?? null,
        seedRevision: 'verified-jobs-2026-08',
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      replaceJobSkills(db, job.id, job.requiredSkills ?? job.skills ?? [], job.preferredSkills ?? [])
    }
    db.prepare(`
      INSERT INTO data_seeds(name, version, sha256, applied_at)
      VALUES ('verified-jobs', '2026-08', ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        version=excluded.version, sha256=excluded.sha256, applied_at=excluded.applied_at
    `).run(hash, timestamp)
  })
  seed()
  return { count: jobs.length, sha256: hash }
}

export function initializeDatabase(db, { seed = false } = {}) {
  migrate(db)
  if (seed) seedVerifiedJobs(db)
  return db
}

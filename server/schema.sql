PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA cache_size = -4096;
PRAGMA journal_size_limit = 16777216;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS data_seeds (
  name TEXT PRIMARY KEY,
  version TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE CHECK(length(email) BETWEEN 3 AND 254),
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('job-seeker', 'employer')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_ci ON users(email COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS ix_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS stored_files (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK(kind IN ('profile-resume', 'application-resume')),
  storage_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK(size_bytes > 0),
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS ix_files_owner_kind
  ON stored_files(owner_user_id, kind, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_profile_resume_per_user
  ON stored_files(owner_user_id)
  WHERE kind = 'profile-resume';

CREATE TABLE IF NOT EXISTS job_seeker_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  headline TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('public', 'private')),
  resume_file_id TEXT REFERENCES stored_files(id) ON DELETE SET NULL,
  preferred_location TEXT NOT NULL DEFAULT 'Angeles City',
  preferred_employment_type TEXT NOT NULL DEFAULT 'Full-time',
  career_category TEXT NOT NULL DEFAULT '',
  education TEXT NOT NULL DEFAULT '',
  experience_level TEXT NOT NULL DEFAULT 'Entry level',
  barangay TEXT,
  latitude REAL CHECK(latitude BETWEEN -90 AND 90),
  longitude REAL CHECK(longitude BETWEEN -180 AND 180),
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS employer_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  company_size TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS skills (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE
) STRICT;

CREATE TABLE IF NOT EXISTS user_skills (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, skill_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_user_skills_skill ON user_skills(skill_id, user_id);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  barangay TEXT,
  address TEXT NOT NULL,
  salary_text TEXT NOT NULL,
  salary_min INTEGER CHECK(salary_min IS NULL OR salary_min >= 0),
  salary_max INTEGER CHECK(salary_max IS NULL OR salary_max >= 0),
  employment_type TEXT NOT NULL,
  work_arrangement TEXT NOT NULL,
  experience_level TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  responsibilities_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(responsibilities_json)),
  requirements_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(requirements_json)),
  benefits_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(benefits_json)),
  openings INTEGER NOT NULL DEFAULT 1 CHECK(openings >= 1),
  latitude REAL CHECK(latitude BETWEEN -90 AND 90),
  longitude REAL CHECK(longitude BETWEEN -180 AND 180),
  coordinate_source TEXT CHECK(coordinate_source IS NULL OR coordinate_source IN ('exact-address','barangay-centroid','city-centroid')),
  date_posted TEXT,
  application_deadline TEXT,
  application_url TEXT,
  source_url TEXT,
  data_source TEXT NOT NULL CHECK(data_source IN ('external-verified','employer-created')),
  application_mode TEXT NOT NULL CHECK(application_mode IN ('internal','external')),
  status TEXT NOT NULL CHECK(status IN ('draft','active','closed')),
  seed_revision TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max),
  CHECK(data_source <> 'employer-created' OR owner_user_id IS NOT NULL),
  CHECK(application_mode <> 'internal' OR owner_user_id IS NOT NULL)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_jobs_public ON jobs(status, date_posted DESC);
CREATE INDEX IF NOT EXISTS ix_jobs_owner_status ON jobs(owner_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_jobs_filters ON jobs(barangay, employment_type, experience_level);

CREATE TABLE IF NOT EXISTS job_skills (
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK(kind IN ('required','preferred')),
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (job_id, skill_id, kind)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_job_skills_lookup ON job_skills(skill_id, kind, job_id);

CREATE TABLE IF NOT EXISTS saved_jobs (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, job_id)
) STRICT;

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  applicant_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  job_title_snapshot TEXT NOT NULL,
  company_snapshot TEXT NOT NULL,
  first_name_snapshot TEXT NOT NULL,
  last_name_snapshot TEXT NOT NULL,
  email_snapshot TEXT NOT NULL,
  phone_snapshot TEXT NOT NULL DEFAULT '',
  cover_letter TEXT NOT NULL DEFAULT '',
  resume_file_id TEXT NOT NULL REFERENCES stored_files(id) ON DELETE RESTRICT,
  applicant_skills_json TEXT NOT NULL CHECK(json_valid(applicant_skills_json)),
  required_skills_json TEXT NOT NULL CHECK(json_valid(required_skills_json)),
  skill_match_score REAL NOT NULL CHECK(skill_match_score BETWEEN 0 AND 1),
  matching_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('applied','reviewing','shortlisted','interview','hired','rejected')),
  applied_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(job_id, applicant_user_id)
) STRICT;

CREATE INDEX IF NOT EXISTS ix_applications_applicant
  ON applications(applicant_user_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS ix_applications_job_status
  ON applications(job_id, status, applied_at DESC);

CREATE TABLE IF NOT EXISTS application_status_history (
  id INTEGER PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  changed_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS ix_application_history
  ON application_status_history(application_id, changed_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS ix_password_reset_user
  ON password_reset_tokens(user_id, expires_at);

INSERT OR IGNORE INTO schema_migrations(version, name, applied_at)
VALUES (1, 'initial backend schema', strftime('%Y-%m-%dT%H:%M:%fZ','now'));

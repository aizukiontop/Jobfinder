import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import * as cookie from 'cookie'

const scrypt = promisify(scryptCallback)
const SCRYPT_N = 16_384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LENGTH = 32
export const SESSION_COOKIE = 'jf_session'

export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

// scrypt is intentionally serialized on the 1 vCPU replica. Each invocation
// may reserve roughly 16 MiB, so allowing anonymous requests to run several in
// parallel could exceed the service memory ceiling. The small bounded queue
// also prevents unbounded pending promises during a distributed login flood.
const MAX_CONCURRENT_SCRYPT = 1
const MAX_QUEUED_SCRYPT = 4
let activeScrypt = 0
const scryptQueue = []

async function acquireScryptSlot() {
  if (activeScrypt < MAX_CONCURRENT_SCRYPT) {
    activeScrypt += 1
    return
  }
  if (scryptQueue.length >= MAX_QUEUED_SCRYPT) {
    throw new ApiError(503, 'AUTH_BUSY', 'Authentication is temporarily busy. Please try again.')
  }
  await new Promise((resolve) => scryptQueue.push(resolve))
}

function releaseScryptSlot() {
  const next = scryptQueue.shift()
  if (next) next()
  else activeScrypt -= 1
}

async function boundedScrypt(...args) {
  await acquireScryptSlot()
  try {
    return await scrypt(...args)
  } finally {
    releaseScryptSlot()
  }
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const derived = await boundedScrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 32 * 1024 * 1024,
  })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`
}

export async function verifyPassword(password, encoded) {
  try {
    const [kind, n, r, p, saltText, keyText] = encoded.split('$')
    if (kind !== 'scrypt') return false
    const expected = Buffer.from(keyText, 'base64url')
    const actual = Buffer.from(await boundedScrypt(password, Buffer.from(saltText, 'base64url'), expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: 32 * 1024 * 1024,
    }))
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function createSession(db, userId, ttlSeconds) {
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  const expires = new Date(now.getTime() + ttlSeconds * 1000)
  db.prepare(`
    INSERT INTO sessions(id, token_hash, user_id, created_at, last_seen_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), sha256(token), userId, now.toISOString(), now.toISOString(), expires.toISOString())
  return { token, expires }
}

export function writeSessionCookie(res, token, expires, secure) {
  res.append('Set-Cookie', cookie.serialize(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api',
    expires,
  }))
}

export function clearSessionCookie(res, secure) {
  res.append('Set-Cookie', cookie.serialize(SESSION_COOKIE, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api',
    expires: new Date(0),
  }))
}

function sessionToken(req) {
  return cookie.parse(req.headers.cookie ?? '')[SESSION_COOKIE] ?? null
}

export function authenticate(db) {
  const select = db.prepare(`
    SELECT s.id AS session_id, s.expires_at, u.id, u.email, u.role
    FROM sessions s
    JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND u.is_active=1
  `)
  const remove = db.prepare('DELETE FROM sessions WHERE id=?')
  const touch = db.prepare('UPDATE sessions SET last_seen_at=? WHERE id=?')
  return (req, _res, next) => {
    const token = sessionToken(req)
    const row = token ? select.get(sha256(token)) : null
    if (!row || Date.parse(row.expires_at) <= Date.now()) {
      if (row) remove.run(row.session_id)
      return next(new ApiError(401, 'AUTH_REQUIRED', 'Please sign in to continue.'))
    }
    req.auth = { id: row.id, email: row.email, role: row.role, sessionId: row.session_id, token }
    touch.run(new Date().toISOString(), row.session_id)
    next()
  }
}

export function requireRole(role) {
  return (req, _res, next) => {
    if (req.auth?.role !== role) {
      return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'))
    }
    next()
  }
}

export function originGuard(appOrigin) {
  const expected = new URL(appOrigin).origin
  return (req, _res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next()
    const origin = req.get('origin')
    if (origin !== expected) {
      return next(new ApiError(403, 'INVALID_ORIGIN', 'Request origin is not allowed.'))
    }
    next()
  }
}

export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

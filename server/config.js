import path from 'node:path'

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function loadConfig(overrides = {}) {
  const root = path.resolve(process.cwd(), 'server')
  const host = overrides.host ?? process.env.JOBFINDER_HOST ?? '127.0.0.1'
  if (host !== '127.0.0.1') {
    throw new Error('JOBFINDER_HOST must be exactly 127.0.0.1')
  }
  return {
    host,
    port: overrides.port ?? positiveInteger(process.env.JOBFINDER_PORT, 3210),
    dbPath: overrides.dbPath ?? process.env.JOBFINDER_DB_PATH ?? path.join(root, 'data', 'jobfinder.sqlite'),
    uploadDir: overrides.uploadDir ?? process.env.JOBFINDER_UPLOAD_DIR ?? path.join(root, 'uploads'),
    appOrigin: overrides.appOrigin ?? process.env.JOBFINDER_APP_ORIGIN ?? 'http://127.0.0.1:5173',
    sessionTtlSeconds: overrides.sessionTtlSeconds ?? positiveInteger(process.env.JOBFINDER_SESSION_TTL, 43_200),
    rememberTtlSeconds: overrides.rememberTtlSeconds ?? positiveInteger(process.env.JOBFINDER_REMEMBER_TTL, 2_592_000),
    secureCookies: overrides.secureCookies ?? process.env.NODE_ENV === 'production',
    seedOnStart: overrides.seedOnStart ?? process.env.JOBFINDER_SEED_ON_START === '1',
    adminEmails: overrides.adminEmails ?? String(process.env.JOBFINDER_ADMIN_EMAILS ?? '')
      .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean),
    resetTokenTtlSeconds: overrides.resetTokenTtlSeconds ?? positiveInteger(process.env.JOBFINDER_RESET_TTL, 1_800),
    mail: overrides.mail ?? {
      provider: process.env.JOBFINDER_MAIL_PROVIDER ?? 'none',
      apiKey: process.env.JOBFINDER_MAIL_API_KEY ?? '',
      from: process.env.JOBFINDER_MAIL_FROM ?? 'JobFinder <onboarding@resend.dev>',
    },
  }
}

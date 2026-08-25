import type { Job } from '../types'

const ALLOWED_APPLICATION_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

export function getExternalApplicationUrl(job: Job): string | null {
  if (job.applicationMode !== 'external' || !job.applicationUrl) return null

  try {
    const parsed = new URL(job.applicationUrl)
    return ALLOWED_APPLICATION_PROTOCOLS.has(parsed.protocol) ? job.applicationUrl : null
  } catch {
    return null
  }
}

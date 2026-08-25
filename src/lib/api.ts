import type { Job } from '../types'

interface JobsResponse {
  items: Job[]
  total: number
}

export class ApiRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

export async function fetchPublicJobs(signal?: AbortSignal): Promise<Job[]> {
  const response = await fetch('/api/jobs', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    let message = 'Unable to load verified jobs from the JobFinder server.'
    try {
      const body = await response.json()
      if (typeof body?.error?.message === 'string') message = body.error.message
    } catch {
      // Keep the safe generic message for a non-JSON response.
    }
    throw new ApiRequestError(message, response.status)
  }

  const body = await response.json() as JobsResponse
  if (!Array.isArray(body.items)) {
    throw new ApiRequestError('The JobFinder server returned an invalid jobs response.', 502)
  }

  return body.items
}

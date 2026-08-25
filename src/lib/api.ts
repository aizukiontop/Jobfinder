import type { ApplicantRecord, Application, Employer, EmployerJob, Job, User } from '../types'

const BASE = '/api'

export class ApiRequestError extends Error {
  status: number
  code: string
  fields: Record<string, string>

  constructor(
    message: string,
    status: number,
    code = 'REQUEST_FAILED',
    fields: Record<string, string> = {}
  ) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
  raw?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, raw = false } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined && !raw) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers,
    body: raw ? (body as BodyInit) : body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  if (response.status === 204) return undefined as T

  let payload: any = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new ApiRequestError(
      payload?.error?.message ?? 'The JobFinder server could not complete that request.',
      response.status,
      payload?.error?.code ?? 'REQUEST_FAILED',
      payload?.error?.fields ?? {}
    )
  }

  return payload as T
}

export async function fetchPublicJobs(signal?: AbortSignal): Promise<Job[]> {
  const body = await request<{ items: Job[]; total: number }>('/jobs', { signal })
  if (!Array.isArray(body?.items)) {
    throw new ApiRequestError('The JobFinder server returned an invalid jobs response.', 502)
  }
  return body.items
}

export async function fetchJob(jobId: string, signal?: AbortSignal): Promise<Job> {
  const body = await request<{ job: Job }>(`/jobs/${encodeURIComponent(jobId)}`, { signal })
  return body.job
}

export interface SessionAccount {
  id: string
  email: string
  role: 'job-seeker' | 'employer'
}

export interface SessionResponse {
  account: SessionAccount
  profile: any
}

export interface SeekerRegistration {
  role: 'job-seeker'
  email: string
  password: string
  firstName: string
  lastName: string
}

export interface EmployerRegistration {
  role: 'employer'
  email: string
  password: string
  companyName: string
  industry: string
  contactName: string
}

export function register(
  input: SeekerRegistration | EmployerRegistration
): Promise<SessionResponse> {
  return request<SessionResponse>('/auth/register', { method: 'POST', body: input })
}

export function login(
  email: string,
  password: string,
  rememberMe = false
): Promise<SessionResponse> {
  return request<SessionResponse>('/auth/login', {
    method: 'POST',
    body: { email, password, rememberMe },
  })
}

export async function fetchSession(signal?: AbortSignal): Promise<SessionResponse | null> {
  try {
    return await request<SessionResponse>('/auth/me', { signal })
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) return null
    throw error
  }
}

export function requestPasswordReset(email: string): Promise<void> {
  return request<void>('/auth/forgot-password', { method: 'POST', body: { email } })
}

export function resetPassword(token: string, password: string): Promise<void> {
  return request<void>('/auth/reset-password', { method: 'POST', body: { token, password } })
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' })
}

export async function fetchProfile(signal?: AbortSignal): Promise<any> {
  const body = await request<{ profile: any }>('/me/profile', { signal })
  return body.profile
}

export async function updateProfile(updates: Partial<User> | Partial<Employer>): Promise<any> {
  const body = await request<{ profile: any }>('/me/profile', { method: 'PATCH', body: updates })
  return body.profile
}

export interface StoredResume {
  id: string
  name: string
  updatedAt: string
}

export async function uploadResume(file: File): Promise<StoredResume> {
  const form = new FormData()
  form.append('resume', file)
  const body = await request<{ resume: StoredResume }>('/me/resume', {
    method: 'PUT',
    body: form,
    raw: true,
  })
  return body.resume
}

export function deleteResume(): Promise<void> {
  return request<void>('/me/resume', { method: 'DELETE' })
}

export const resumeDownloadUrl = `${BASE}/me/resume/download`

export function applicationResumeUrl(applicationId: string): string {
  return `${BASE}/applications/${encodeURIComponent(applicationId)}/resume`
}

export async function fetchSavedJobIds(signal?: AbortSignal): Promise<string[]> {
  const body = await request<{ jobIds: string[] }>('/me/saved-jobs', { signal })
  return Array.isArray(body?.jobIds) ? body.jobIds : []
}

export function saveJob(jobId: string): Promise<void> {
  return request<void>(`/me/saved-jobs/${encodeURIComponent(jobId)}`, { method: 'PUT' })
}

export function unsaveJob(jobId: string): Promise<void> {
  return request<void>(`/me/saved-jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' })
}

export async function fetchMyApplications(signal?: AbortSignal): Promise<Application[]> {
  const body = await request<{ items: Application[] }>('/me/applications', { signal })
  return Array.isArray(body?.items) ? body.items : []
}

export interface ApplicationInput {
  firstName: string
  lastName: string
  email: string
  phone?: string
  coverLetter?: string
  resume: File
}

export async function applyToJob(
  jobId: string,
  input: ApplicationInput
): Promise<Application> {
  const form = new FormData()
  form.append('firstName', input.firstName)
  form.append('lastName', input.lastName)
  form.append('email', input.email)
  form.append('phone', input.phone ?? '')
  form.append('coverLetter', input.coverLetter ?? '')
  form.append('resume', input.resume)

  const body = await request<{ application: Application }>(
    `/jobs/${encodeURIComponent(jobId)}/applications`,
    { method: 'POST', body: form, raw: true }
  )
  return body.application
}

export async function fetchEmployerJobs(signal?: AbortSignal): Promise<EmployerJob[]> {
  const body = await request<{ items: EmployerJob[] }>('/employer/jobs', { signal })
  return Array.isArray(body?.items) ? body.items : []
}

export async function createEmployerJob(input: Record<string, unknown>): Promise<Job> {
  const body = await request<{ job: Job }>('/employer/jobs', { method: 'POST', body: input })
  return body.job
}

export async function updateEmployerJob(
  jobId: string,
  updates: Record<string, unknown>
): Promise<Job> {
  const body = await request<{ job: Job }>(`/employer/jobs/${encodeURIComponent(jobId)}`, {
    method: 'PATCH',
    body: updates,
  })
  return body.job
}

export async function fetchEmployerApplications(
  filters: { jobId?: string; status?: string } = {},
  signal?: AbortSignal
): Promise<ApplicantRecord[]> {
  const query = new URLSearchParams()
  if (filters.jobId) query.set('jobId', filters.jobId)
  if (filters.status) query.set('status', filters.status)
  const suffix = query.toString() ? '?' + query.toString() : ''

  const body = await request<{ items: ApplicantRecord[] }>(
    '/employer/applications' + suffix,
    { signal }
  )
  return Array.isArray(body?.items) ? body.items : []
}

export function updateApplicationStatus(
  applicationId: string,
  status: string
): Promise<{ id: string; status: string }> {
  return request<{ id: string; status: string }>(
    '/employer/applications/' + encodeURIComponent(applicationId) + '/status',
    { method: 'PATCH', body: { status } }
  )
}

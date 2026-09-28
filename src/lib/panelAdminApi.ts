import type { Job } from '../types'
import { request } from './api'

export interface AdminPage<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export type ReviewDecision = 'approve' | 'reject' | 'suspend' | 'archive'

export interface AuditEntry {
  id: number
  actorId: string | null
  actorLabel: string
  action: string
  targetType: string
  targetId: string
  summary: string
  details: Record<string, unknown>
  createdAt: string
}

export interface NotificationEntry {
  id: number
  eventType: string
  recipient: string
  status: string
  attempts: number
  lastError: string | null
  createdAt: string
}

export interface AdminEmployer {
  id: string
  email: string
  active: boolean
  statusReason: string
  companyName: string
  contactName: string
  industry: string
  contactEmail: string
  contactPhone: string
  address: string
  website: string
  postings: number
  published: number
  pending: number
  applications: number
  createdAt: string
  lastSeen: string | null
}

export interface AdminSummary {
  pendingReviews: number
  publishedJobs: number
  employers: number
  suspendedEmployers: number
  jobSeekers: number
  applications: number
  recentSubmissions: Job[]
  recentActivity: { id: number; actorLabel: string; action: string; summary: string; createdAt: string }[]
}

export function fetchAdminSummary() {
  return request<AdminSummary>('/admin/summary')
}

export function fetchAdminEmployers(filters: { q: string; status: string; page: number }) {
  const params = new URLSearchParams({ q: filters.q, status: filters.status, page: String(filters.page), limit: '15' })
  return request<AdminPage<AdminEmployer>>(`/admin/employers?${params}`)
}

export function setEmployerStatus(employerId: string, active: boolean, reason: string) {
  return request<{ id: string; active: boolean; statusReason: string }>(`/admin/employers/${encodeURIComponent(employerId)}/status`, {
    method: 'PATCH',
    body: { active, reason: reason.trim() },
  })
}

export function fetchAdminJobs(filters: { q: string; reviewStatus: string; dataSource: string; category: string; ownerId: string; page: number }, signal?: AbortSignal) {
  const params = new URLSearchParams({ ...filters, page: String(filters.page), limit: '15' })
  return request<AdminPage<Job>>(`/admin/jobs?${params}`, { signal })
}

export function reviewAdminJob(job: Job, decision: ReviewDecision, reason: string) {
  return request<{ job: Job }>(`/admin/jobs/${encodeURIComponent(job.id)}/review`, {
    method: 'POST',
    body: { decision, reason: reason.trim(), expectedVersion: job.reviewVersion },
  })
}

export function fetchAdminAudit(page: number, action: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(page), limit: '20', action })
  return request<AdminPage<AuditEntry>>(`/admin/audit?${params}`, { signal })
}

export function fetchAdminNotifications(page: number, signal?: AbortSignal) {
  return request<AdminPage<NotificationEntry> & { mailEnabled: boolean }>(`/admin/notifications?page=${page}&limit=20`, { signal })
}

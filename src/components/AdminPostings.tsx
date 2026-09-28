import { useEffect, useState } from 'react'
import { ApiRequestError } from '../lib/api'
import { fetchAdminJobs, reviewAdminJob, type ReviewDecision } from '../lib/panelAdminApi'
import { CATEGORIES } from '../data'
import { formatRelativeDate } from '../lib/formatDate'
import PostingReviewStatus from './PostingReviewStatus'
import type { Job } from '../types'

const REVIEW_FILTERS = [
  { value: 'pending', label: 'Waiting for review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended / archived' },
  { value: 'legacy', label: 'Existing postings (exempt)' },
  { value: '', label: 'All postings' },
]

const DECISIONS: { value: ReviewDecision; label: string }[] = [
  { value: 'approve', label: 'Approve and publish' },
  { value: 'reject', label: 'Reject (ask for changes)' },
  { value: 'suspend', label: 'Suspend (hide from the public)' },
  { value: 'archive', label: 'Archive (close permanently)' },
]

function allowedDecisions(job: Job): ReviewDecision[] {
  const allowed: ReviewDecision[] = []
  const submitted = job.reviewStatus === 'pending' || job.reviewStatus === 'rejected' || job.reviewStatus === 'suspended'
  if (job.status === 'active' && submitted) allowed.push('approve')
  if (job.reviewStatus === 'pending') allowed.push('reject')
  if (job.status === 'active' && job.reviewStatus !== 'suspended') allowed.push('suspend')
  if (job.status !== 'closed') allowed.push('archive')
  return allowed
}

const selectStyle = { border: '1px solid #d1d5db', borderRadius: 6 }

export default function AdminPostings({ ownerId = '' }: { ownerId?: string }) {
  const [text, setText] = useState('')
  const [filters, setFilters] = useState({ q: '', reviewStatus: ownerId ? '' : 'pending', dataSource: '', category: '', ownerId, page: 1 })
  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadCount, setReloadCount] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchAdminJobs(filters)
      .then(data => {
        if (cancelled) return
        setJobs(data.items)
        setTotal(data.total)
      })
      .catch(() => { if (!cancelled) setError('The postings could not be loaded.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filters, reloadCount])

  const setFilter = (key: 'reviewStatus' | 'dataSource' | 'category', value: string) => {
    setFilters({ ...filters, [key]: value, page: 1 })
  }

  const pages = Math.max(1, Math.ceil(total / 15))

  return (
    <section className="space-y-4">
      <form
        onSubmit={e => { e.preventDefault(); setFilters({ ...filters, q: text.trim(), page: 1 }) }}
        className="flex flex-wrap gap-2"
      >
        <input
          aria-label="Search postings by title or company"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Title or company"
          style={selectStyle}
          className="px-3 py-2 text-sm w-full sm:w-60"
        />
        <select aria-label="Review status" value={filters.reviewStatus} onChange={e => setFilter('reviewStatus', e.target.value)} style={selectStyle} className="px-2 py-2 text-sm bg-white">
          {REVIEW_FILTERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select aria-label="Data source" value={filters.dataSource} onChange={e => setFilter('dataSource', e.target.value)} style={selectStyle} className="px-2 py-2 text-sm bg-white">
          <option value="">All sources</option>
          <option value="employer-created">Employer postings</option>
          <option value="external-verified">Verified dataset</option>
        </select>
        <select aria-label="Category" value={filters.category} onChange={e => setFilter('category', e.target.value)} style={selectStyle} className="px-2 py-2 text-sm bg-white">
          <option value="">All categories</option>
          {CATEGORIES.map(category => <option key={category.name} value={category.name}>{category.name}</option>)}
        </select>
        <button style={{ background: '#0f2044', color: '#fff', borderRadius: 6 }} className="px-4 py-2 text-sm font-semibold">
          Search
        </button>
      </form>

      {loading && <p role="status" className="text-sm text-gray-500 py-6">Loading postings…</p>}
      {error && <p role="alert" className="text-sm text-red-600 py-6">{error}</p>}

      {!loading && !error && (
        <div className="space-y-2">
          {jobs.length === 0 && (
            <p className="text-sm text-gray-500 py-6 text-center">No postings match these filters.</p>
          )}
          {jobs.map(job => (
            <div key={job.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{job.title || 'Untitled'}</p>
                  <p className="text-xs text-gray-500">
                    {job.company} · {job.category} · {job.dataSource === 'employer-created' ? 'Employer posting' : 'Verified dataset'}
                    {job.datePosted ? ` · posted ${formatRelativeDate(job.datePosted)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PostingReviewStatus job={job} />
                  <button
                    onClick={() => setOpenId(openId === job.id ? null : job.id)}
                    aria-expanded={openId === job.id}
                    style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                    className="px-3 py-1.5 text-sm"
                  >
                    {openId === job.id ? 'Close' : 'Review'}
                  </button>
                </div>
              </div>
              {job.reviewReason && <p className="text-xs text-gray-600 mt-2">Last reason: {job.reviewReason}</p>}
              {openId === job.id && (
                <ReviewPanel
                  job={job}
                  onDone={() => { setOpenId(null); setReloadCount(count => count + 1) }}
                />
              )}
            </div>
          ))}
          <div className="flex items-center justify-between text-sm pt-2">
            <span className="text-gray-600">{total} posting{total === 1 ? '' : 's'} · page {filters.page} of {pages}</span>
            <div className="flex gap-2">
              <button disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })} style={selectStyle} className="px-3 py-1.5 disabled:opacity-40">Previous</button>
              <button disabled={filters.page >= pages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })} style={selectStyle} className="px-3 py-1.5 disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function ReviewPanel({ job, onDone }: { job: Job; onDone: () => void }) {
  const choices = DECISIONS.filter(option => allowedDecisions(job).includes(option.value))
  const [decision, setDecision] = useState<ReviewDecision | ''>(choices[0]?.value ?? '')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const reasonNeeded = decision !== 'approve'

  const submit = async () => {
    if (!decision) return
    if (reasonNeeded && !reason.trim()) {
      setError('Write a reason. The employer will see it.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await reviewAdminJob(job, decision, reason)
      onDone()
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'STALE_REVIEW') {
        setError('The employer changed this posting after you opened it. Close this panel and review the new version.')
      } else {
        setError(err instanceof ApiRequestError ? err.message : 'The decision could not be saved.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ borderTop: '1px solid #f3f4f6' }} className="mt-3 pt-3 space-y-3 text-sm">
      <div className="grid gap-2 sm:grid-cols-2 text-gray-700">
        <p><span className="text-gray-500">Location:</span> {job.address || job.location}{job.barangay ? `, ${job.barangay}` : ''}</p>
        <p><span className="text-gray-500">Salary:</span> {job.salary}</p>
        <p><span className="text-gray-500">Type:</span> {job.employmentType} · {job.workArrangement} · {job.experienceLevel}</p>
        <p><span className="text-gray-500">Required skills:</span> {(job.requiredSkills ?? job.skills).join(', ') || 'None'}</p>
      </div>
      <p className="whitespace-pre-wrap text-gray-800">{job.description}</p>
      {job.requirements.length > 0 && (
        <ul className="list-disc pl-5 text-gray-700">
          {job.requirements.map((item, index) => <li key={index}>{item}</li>)}
        </ul>
      )}

      {choices.length === 0 ? (
        <p className="text-gray-500">No decision is available for this posting.</p>
      ) : (
        <fieldset className="space-y-2">
          <legend className="font-semibold text-gray-800 mb-1">Decision</legend>
          {choices.map(option => (
            <label key={option.value} className="flex items-center gap-2">
              <input
                type="radio"
                name={`decision-${job.id}`}
                checked={decision === option.value}
                onChange={() => setDecision(option.value)}
                style={{ accentColor: '#16a34a' }}
              />
              {option.label}
            </label>
          ))}
          <label className="block">
            <span className="text-gray-700">Reason {reasonNeeded ? '(required, shown to the employer)' : '(optional)'}</span>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              maxLength={2000}
              rows={3}
              style={selectStyle}
              className="mt-1 w-full px-3 py-2"
            />
          </label>
          {error && <p role="alert" className="text-red-600">{error}</p>}
          <button
            onClick={submit}
            disabled={saving}
            style={{ background: '#0f2044', color: '#fff', borderRadius: 6 }}
            className="px-4 py-2 font-semibold disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save decision'}
          </button>
        </fieldset>
      )}
    </div>
  )
}

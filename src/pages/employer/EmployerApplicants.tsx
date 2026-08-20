import { useState } from 'react'
import { useApp } from '../../context'
import type { ApplicantRecord } from '../../types'

const STATUS_COLORS: Record<ApplicantRecord['status'], { bg: string; text: string }> = {
  applied: { bg: '#eff6ff', text: '#1d4ed8' },
  reviewing: { bg: '#fef9c3', text: '#a16207' },
  shortlisted: { bg: '#f0fdf4', text: '#15803d' },
  interview: { bg: '#fae8ff', text: '#7e22ce' },
  hired: { bg: '#dcfce7', text: '#15803d' },
  rejected: { bg: '#fef2f2', text: '#b91c1c' },
}

const STATUS_ORDER: ApplicantRecord['status'][] = ['applied', 'reviewing', 'shortlisted', 'interview', 'hired', 'rejected']

export default function EmployerApplicants() {
  const { employerJobs, allApplicants, updateApplicantStatus, selectedJobId, getApplicantsForJob } = useApp()
  // Pre-filter by the job ID passed from navigate(), if any
  const [jobFilter, setJobFilter] = useState<string>(selectedJobId ?? 'all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedApplicant, setSelectedApplicant] = useState<ApplicantRecord | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ id: string; status: ApplicantRecord['status']; label: string } | null>(null)

  // Use ranked applicants when filtering by specific job
  const ranked = jobFilter !== 'all' ? getApplicantsForJob(jobFilter) : allApplicants

  const filtered = ranked.filter(a => {
    const matchStatus = statusFilter === 'all' || a.status === statusFilter
    return matchStatus
  })

  const applyStatusChange = (id: string, status: ApplicantRecord['status']) => {
    updateApplicantStatus(id, status)
    setConfirmAction(null)
    if (selectedApplicant?.id === id) {
      setSelectedApplicant(prev => prev ? { ...prev, status } : null)
    }
  }

  const newCount = allApplicants.filter(a => a.status === 'applied').length

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }} className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Applicants</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {allApplicants.length} total applicants
            {newCount > 0 && <span style={{ color: '#1d4ed8' }} className="ml-2 font-medium">· {newCount} new</span>}
          </p>
        </div>

        {/* Filters */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }} className="p-4 mb-4 flex flex-wrap gap-3 items-center">
          <div>
            <select
              value={jobFilter}
              onChange={e => setJobFilter(e.target.value)}
              style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
              className="px-3 py-2 text-sm outline-none bg-white"
            >
              <option value="all">All Job Posts</option>
              {employerJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {(['all', ...STATUS_ORDER] as const).map(s => {
              const color = s !== 'all' ? STATUS_COLORS[s] : null
              const isActive = statusFilter === s
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    background: isActive ? (color?.bg ?? '#f3f4f6') : '#fff',
                    color: isActive ? (color?.text ?? '#374151') : '#374151',
                    border: `1px solid ${isActive ? (color?.text ?? '#d1d5db') : '#d1d5db'}`,
                    borderRadius: 999,
                    fontSize: 12,
                  }}
                  className="px-3 py-1 font-medium capitalize"
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>

        {/* Applicant list */}
        <div className="space-y-2">
          {filtered.map(applicant => {
            const s = STATUS_COLORS[applicant.status]
            return (
              <div
                key={applicant.id}
                style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}
                className="p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div
                    style={{ background: '#0f2044', color: '#fff', borderRadius: 999, fontSize: 14, flexShrink: 0 }}
                    className="w-10 h-10 flex items-center justify-center font-bold"
                  >
                    {applicant.applicantName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{applicant.applicantName}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{applicant.jobTitle}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          style={{ background: '#f0fdf4', color: '#15803d', borderRadius: 999, fontSize: 11 }}
                          className="px-2 py-0.5 font-semibold"
                        >
                          {applicant.matchScore}% Match
                        </span>
                        <span style={{ background: s.bg, color: s.text, borderRadius: 999, fontSize: 11 }} className="px-2.5 py-0.5 font-semibold capitalize">
                          {applicant.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                      <span>{applicant.applicantEmail}</span>
                      {applicant.phone && <span>{applicant.phone}</span>}
                      <span>Applied {applicant.appliedDate}</span>
                      {applicant.resumeName && <span>📎 {applicant.resumeName}</span>}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <button
                        onClick={() => setSelectedApplicant(applicant)}
                        style={{ background: '#0f2044', color: '#fff', borderRadius: 6 }}
                        className="px-3 py-1.5 text-xs font-semibold hover:opacity-90"
                      >
                        View Profile
                      </button>
                      {applicant.status !== 'shortlisted' && applicant.status !== 'hired' && applicant.status !== 'rejected' && (
                        <button
                          onClick={() => setConfirmAction({ id: applicant.id, status: 'shortlisted', label: 'Shortlist' })}
                          style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                          className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Shortlist
                        </button>
                      )}
                      {applicant.status === 'shortlisted' && (
                        <button
                          onClick={() => setConfirmAction({ id: applicant.id, status: 'interview', label: 'Move to Interview' })}
                          style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                          className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Interview
                        </button>
                      )}
                      {applicant.status === 'interview' && (
                        <button
                          onClick={() => setConfirmAction({ id: applicant.id, status: 'hired', label: 'Mark as Hired' })}
                          style={{ background: '#dcfce7', color: '#15803d', borderRadius: 6 }}
                          className="px-3 py-1.5 text-xs font-semibold hover:bg-green-100"
                        >
                          Mark Hired
                        </button>
                      )}
                      {applicant.status !== 'hired' && applicant.status !== 'rejected' && (
                        <button
                          onClick={() => setConfirmAction({ id: applicant.id, status: 'rejected', label: 'Reject' })}
                          className="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-700"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }} className="py-14 text-center text-gray-400 text-sm">
              No applicants match your current filters.
            </div>
          )}
        </div>
      </div>

      {/* View Profile Modal */}
      {selectedApplicant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div style={{ background: '#fff', borderRadius: 12, maxWidth: 520, width: '100%', maxHeight: '90vh', overflow: 'auto' }} className="p-6">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div style={{ background: '#0f2044', color: '#fff', borderRadius: 999, fontSize: 16, flexShrink: 0 }} className="w-12 h-12 flex items-center justify-center font-bold">
                  {selectedApplicant.applicantName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{selectedApplicant.applicantName}</p>
                  <p className="text-xs text-gray-500">{selectedApplicant.jobTitle}</p>
                </div>
              </div>
              <button onClick={() => setSelectedApplicant(null)} className="text-gray-400 hover:text-gray-600 ml-4">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="space-y-3 text-sm mb-5">
              <div className="grid grid-cols-2 gap-3">
                <div style={{ background: '#f9fafb', borderRadius: 6 }} className="p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Email</p>
                  <p className="font-medium text-gray-800">{selectedApplicant.applicantEmail}</p>
                </div>
                <div style={{ background: '#f9fafb', borderRadius: 6 }} className="p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                  <p className="font-medium text-gray-800">{selectedApplicant.phone ?? 'Not provided'}</p>
                </div>
                <div style={{ background: '#f9fafb', borderRadius: 6 }} className="p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Match Score</p>
                  <p className="font-semibold" style={{ color: '#16a34a' }}>{selectedApplicant.matchScore}%</p>
                </div>
                <div style={{ background: '#f9fafb', borderRadius: 6 }} className="p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Date Applied</p>
                  <p className="font-medium text-gray-800">{selectedApplicant.appliedDate}</p>
                </div>
              </div>

              {selectedApplicant.resumeName && (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 6 }} className="p-3 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span className="text-gray-700 font-medium">{selectedApplicant.resumeName}</span>
                </div>
              )}

              {selectedApplicant.coverLetter && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">COVER LETTER</p>
                  <p style={{ background: '#f9fafb', borderRadius: 6 }} className="p-3 text-gray-700 text-xs leading-relaxed">{selectedApplicant.coverLetter}</p>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">UPDATE STATUS</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_ORDER.map(status => {
                  const s = STATUS_COLORS[status]
                  const isCurrent = selectedApplicant.status === status
                  return (
                    <button
                      key={status}
                      onClick={() => { applyStatusChange(selectedApplicant.id, status) }}
                      style={{
                        background: isCurrent ? s.bg : '#fff',
                        color: isCurrent ? s.text : '#374151',
                        border: `1px solid ${isCurrent ? s.text : '#d1d5db'}`,
                        borderRadius: 999,
                        fontSize: 12,
                      }}
                      className="px-3 py-1 font-medium capitalize"
                    >
                      {isCurrent && '✓ '}{status}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm action dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div style={{ background: '#fff', borderRadius: 12, maxWidth: 360 }} className="w-full p-6">
            <h3 className="font-bold text-gray-900 mb-2">{confirmAction.label}</h3>
            <p className="text-sm text-gray-500 mb-5">
              {confirmAction.status === 'hired'
                ? "Mark this applicant as hired? This will update their application status."
                : confirmAction.status === 'rejected'
                ? "Reject this applicant? This action can be reversed."
                : `Move this applicant to "${confirmAction.label}"?`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)} style={{ border: '1px solid #e5e7eb', borderRadius: 6 }} className="flex-1 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => applyStatusChange(confirmAction.id, confirmAction.status)}
                style={{ background: confirmAction.status === 'rejected' ? '#ef4444' : '#0f2044', color: '#fff', borderRadius: 6 }}
                className="flex-1 py-2 text-sm font-semibold hover:opacity-90"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

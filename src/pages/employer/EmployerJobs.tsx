import { useState } from 'react'
import { useApp } from '../../context'
import type { EmployerJob } from '../../types'

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: '#dcfce7', text: '#15803d' },
  closed: { bg: '#f3f4f6', text: '#6b7280' },
  draft: { bg: '#fef9c3', text: '#a16207' },
}

type StatusFilter = 'all' | 'active' | 'closed' | 'draft'

export default function EmployerJobs() {
  const { employerJobs, updateEmployerJob, navigate, getApplicantCount } = useApp()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [confirmClose, setConfirmClose] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const PER_PAGE = 6

  const filtered = employerJobs.filter(j => {
    const matchSearch = !search || j.title.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || j.status === statusFilter
    return matchSearch && matchStatus
  })

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)

  const closeJob = (id: string) => {
    updateEmployerJob(id, { status: 'closed' })
    setConfirmClose(null)
  }

  const publishDraft = (id: string) => {
    updateEmployerJob(id, { status: 'active' })
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }} className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Job Posts</h1>
            <p className="text-sm text-gray-500 mt-0.5">{employerJobs.length} total job posts</p>
          </div>
          <button
            onClick={() => navigate('employer-post')}
            style={{ background: '#0f2044', color: '#fff', borderRadius: 6 }}
            className="px-4 py-2 text-sm font-semibold hover:opacity-90 flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Post a Job
          </button>
        </div>

        {/* Search + filter */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }} className="p-4 mb-4 flex flex-wrap gap-3 items-center">
          <div style={{ border: '1px solid #d1d5db', borderRadius: 6 }} className="flex items-center px-3 gap-2 flex-1 min-w-48">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
              placeholder="Search job posts..."
              className="flex-1 py-2 text-sm outline-none text-gray-800 placeholder-gray-400"
            />
          </div>
          <div className="flex items-center gap-1">
            {(['all', 'active', 'closed', 'draft'] as StatusFilter[]).map(s => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setCurrentPage(1) }}
                style={{
                  background: statusFilter === s ? '#0f2044' : '#fff',
                  color: statusFilter === s ? '#fff' : '#374151',
                  border: `1px solid ${statusFilter === s ? '#0f2044' : '#d1d5db'}`,
                  borderRadius: 6,
                }}
                className="px-3 py-1.5 text-sm font-medium capitalize"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Jobs table */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                  {['Job Title', 'Type / Setup', 'Applicants', 'Posted', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(job => {
                  const s = STATUS_COLORS[job.status]
                  return (
                    <tr key={job.id} style={{ borderBottom: '1px solid #f9fafb' }} className="hover:bg-gray-50">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-gray-900">{job.title}</p>
                        <p className="text-xs text-gray-400">{job.city} · {job.openings} opening{job.openings !== 1 ? 's' : ''}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-gray-700">{job.employmentType}</p>
                        <p className="text-xs text-gray-400">{job.workArrangement}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => navigate('employer-applicants', job.id)}
                          style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 999, fontSize: 11 }}
                          className="px-2.5 py-0.5 font-semibold hover:bg-blue-100"
                        >
                          {getApplicantCount(job.id)} applicants
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">
                        {job.daysAgo === 0 ? 'Today' : `${job.daysAgo}d ago`}
                      </td>
                      <td className="px-5 py-3.5">
                        <span style={{ background: s.bg, color: s.text, borderRadius: 999, fontSize: 11 }} className="px-2.5 py-0.5 font-semibold capitalize">
                          {job.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => navigate('employer-applicants', job.id)}
                            style={{ color: '#0f2044' }}
                            className="text-xs font-medium hover:underline whitespace-nowrap"
                          >
                            Applicants
                          </button>
                          <span className="text-gray-300">|</span>
                          {job.status === 'draft' ? (
                            <button
                              onClick={() => publishDraft(job.id)}
                              style={{ color: '#16a34a' }}
                              className="text-xs font-medium hover:underline"
                            >
                              Publish
                            </button>
                          ) : job.status === 'active' ? (
                            <button
                              onClick={() => setConfirmClose(job.id)}
                              className="text-xs font-medium text-red-500 hover:underline"
                            >
                              Close
                            </button>
                          ) : (
                            <button
                              onClick={() => updateEmployerJob(job.id, { status: 'active' })}
                              style={{ color: '#16a34a' }}
                              className="text-xs font-medium hover:underline"
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-sm">
                      No jobs found.{' '}
                      <button onClick={() => navigate('employer-post')} style={{ color: '#16a34a' }} className="font-medium hover:underline">Post a job</button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 px-5 py-4 border-t border-gray-100">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={{ border: '1px solid #e5e7eb', borderRadius: 6 }} className="px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40">Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setCurrentPage(p)} style={{ border: `1px solid ${p === currentPage ? '#0f2044' : '#e5e7eb'}`, background: p === currentPage ? '#0f2044' : '#fff', color: p === currentPage ? '#fff' : '#374151', borderRadius: 6 }} className="w-8 h-8 text-sm font-medium">{p}</button>
              ))}
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} style={{ border: '1px solid #e5e7eb', borderRadius: 6 }} className="px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40">Next</button>
            </div>
          )}
        </div>
      </div>

      {/* Confirm close dialog */}
      {confirmClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div style={{ background: '#fff', borderRadius: 12, maxWidth: 380 }} className="w-full p-6">
            <h3 className="font-bold text-gray-900 mb-2">Close this job posting?</h3>
            <p className="text-sm text-gray-500 mb-5">This will stop accepting new applicants. You can reopen it later.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmClose(null)} style={{ border: '1px solid #e5e7eb', borderRadius: 6 }} className="flex-1 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={() => closeJob(confirmClose)} style={{ background: '#ef4444', color: '#fff', borderRadius: 6 }} className="flex-1 py-2 text-sm font-semibold hover:bg-red-600">Close Job</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

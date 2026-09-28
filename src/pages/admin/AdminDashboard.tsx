import { useEffect, useState } from 'react'
import { useApp } from '../../context'
import { fetchAdminSummary, type AdminSummary } from '../../lib/panelAdminApi'
import { formatRelativeDate } from '../../lib/formatDate'

function StatCard({ label, value, color, onClick }: { label: string; value: number; color: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, borderLeft: `4px solid ${color}` }}
      className="p-5 text-left enabled:hover:bg-gray-50"
    >
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </button>
  )
}

export default function AdminDashboard() {
  const { adminProfile, navigate } = useApp()
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAdminSummary()
      .then(setSummary)
      .catch(() => setError('The dashboard could not be loaded. Try refreshing the page.'))
  }, [])

  return (
    <div style={{ background: '#f9fafb', flex: 1 }} className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{adminProfile?.officeName ?? 'PESO Angeles City'}</h1>
          <p className="text-sm text-gray-500 mt-1">Review job postings and manage the employers on JobFinder.</p>
        </div>

        {error && <p role="alert" className="text-sm text-red-600 mb-6">{error}</p>}
        {!summary && !error && <p role="status" className="text-sm text-gray-500 mb-6">Loading dashboard…</p>}

        {summary && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <StatCard label="Waiting for review" value={summary.pendingReviews} color="#f59e0b" onClick={() => navigate('admin-postings')} />
              <StatCard label="Published jobs" value={summary.publishedJobs} color="#16a34a" onClick={() => navigate('admin-postings')} />
              <StatCard label="Employers" value={summary.employers} color="#1d4ed8" onClick={() => navigate('admin-employers')} />
              <StatCard label="Suspended employers" value={summary.suspendedEmployers} color="#dc2626" onClick={() => navigate('admin-employers')} />
              <StatCard label="Job seekers" value={summary.jobSeekers} color="#7c3aed" onClick={() => navigate('admin-seekers')} />
              <StatCard label="Applications" value={summary.applications} color="#0f2044" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-base text-gray-900">New submissions</h2>
                  <button onClick={() => navigate('admin-postings')} style={{ color: '#16a34a' }} className="text-sm font-medium hover:underline">
                    Review all
                  </button>
                </div>
                {summary.recentSubmissions.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-gray-500 text-center">No postings are waiting for review.</p>
                ) : (
                  <ul>
                    {summary.recentSubmissions.map(job => (
                      <li key={job.id} className="px-5 py-3 border-b border-gray-50 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{job.title}</p>
                          <p className="text-xs text-gray-500">{job.company} · {job.category}</p>
                        </div>
                        <button
                          onClick={() => navigate('admin-postings')}
                          style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                          className="px-3 py-1.5 text-sm flex-shrink-0"
                        >
                          Review
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-base text-gray-900">Recent activity</h2>
                  <button onClick={() => navigate('admin-logs')} style={{ color: '#16a34a' }} className="text-sm font-medium hover:underline">
                    View log
                  </button>
                </div>
                <ul>
                  {summary.recentActivity.map(entry => (
                    <li key={entry.id} className="px-5 py-3 border-b border-gray-50">
                      <p className="text-sm text-gray-900">{entry.summary}</p>
                      <p className="text-xs text-gray-500">{entry.actorLabel} · {formatRelativeDate(entry.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

import { useApp } from '../context'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  applied: { bg: '#dbeafe', color: '#1d4ed8' },
  reviewing: { bg: '#fef9c3', color: '#a16207' },
  shortlisted: { bg: '#e0e7ff', color: '#4338ca' },
  interview: { bg: '#fce7f3', color: '#be185d' },
  hired: { bg: '#dcfce7', color: '#15803d' },
  rejected: { bg: '#fee2e2', color: '#b91c1c' },
  Submitted: { bg: '#dbeafe', color: '#1d4ed8' },
}

export default function Applications() {
  const { applications, navigate, allJobs } = useApp()

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 60000)
    if (diff < 2) return 'Just now'
    if (diff < 60) return `${diff} minutes ago`
    if (diff < 1440) return `${Math.floor(diff / 60)} hours ago`
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Your Applications</h1>
        <p className="text-sm text-gray-500 mb-8">Track the status of jobs you&#39;ve applied to.</p>

        {applications.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">No applications yet.</h2>
            <p className="text-sm text-gray-500 mb-6">
              Find a job and click Apply Now to get started.
            </p>
            <button
              onClick={() => navigate('search')}
              style={{ background: '#16a34a', color: '#fff', borderRadius: 6 }}
              className="px-6 py-2.5 text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              Browse Jobs
            </button>
          </div>
        ) : (
          <div
            style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}
            className="overflow-hidden"
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Job Title
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Company
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Date Applied
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app, i) => {
                  const statusStyle = STATUS_COLORS[app.status] ?? { bg: '#f3f4f6', color: '#374151' }
                  const job = allJobs.find(j => j.id === app.jobId)
                  return (
                    <tr
                      key={app.id}
                      style={{ borderBottom: i < applications.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <button
                          onClick={() => job && navigate('jobdetail', job.id)}
                          className="font-semibold text-gray-900 hover:underline text-left"
                        >
                          {app.jobTitle}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-gray-600">{app.company}</td>
                      <td className="px-5 py-4 text-gray-500">{formatDate(app.dateApplied)}</td>
                      <td className="px-5 py-4">
                        <span
                          style={{
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            borderRadius: 999,
                            fontSize: 12,
                          }}
                          className="px-3 py-1 font-medium"
                        >
                          {app.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #e5e7eb', background: '#fff' }} className="mt-12 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-400">© 2026 JobFinder. All rights reserved.</p>
          <div className="flex gap-4">
            {['Terms', 'Privacy', 'Accessibility', 'Contact'].map(l => (
              <button key={l} style={{ color: '#16a34a' }} className="text-xs hover:underline">{l}</button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}

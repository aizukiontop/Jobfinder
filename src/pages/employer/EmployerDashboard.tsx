import { useApp } from '../../context'

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }} className="p-5 flex items-center gap-4">
      <div style={{ background: color, borderRadius: 8 }} className="w-11 h-11 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: '#dcfce7', text: '#15803d' },
  closed: { bg: '#f3f4f6', text: '#6b7280' },
  draft: { bg: '#fef9c3', text: '#a16207' },
}

export default function EmployerDashboard() {
  const { employer, employerJobs, allApplicants, navigate, getApplicantCount } = useApp()

  const activeJobs = employerJobs.filter(j => j.status === 'active')
  const totalApplicants = allApplicants.length
  const newApplicants = allApplicants.filter(a => a.status === 'applied').length
  const hired = allApplicants.filter(a => a.status === 'hired').length
  const recentJobs = employerJobs.slice(0, 5)

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }} className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {employer?.companyName ?? 'Employer'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage your job postings and find the right candidates.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Active Job Posts"
            value={activeJobs.length}
            color="#eff6ff"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f2044" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>}
          />
          <StatCard
            label="Total Applicants"
            value={totalApplicants}
            color="#f0fdf4"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
          />
          <StatCard
            label="New Applicants"
            value={newApplicants}
            color="#fef9c3"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a16207" strokeWidth="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>}
          />
          <StatCard
            label="Hired Candidates"
            value={hired}
            color="#fce7f3"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#be185d" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
          />
        </div>

        {/* Recent Job Posts */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-base text-gray-900">Recent Job Posts</h2>
            <button
              onClick={() => navigate('employer-jobs')}
              style={{ color: '#16a34a' }}
              className="text-sm font-medium hover:underline"
            >
              View all
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                  {['Job Title', 'Employment Type', 'Applicants', 'Posted', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentJobs.map(job => {
                  const s = STATUS_COLORS[job.status] ?? STATUS_COLORS.draft
                  return (
                    <tr key={job.id} style={{ borderBottom: '1px solid #f9fafb' }} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{job.title}</p>
                        <p className="text-xs text-gray-400">{job.city}</p>
                      </td>
                      <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{job.employmentType}</td>
                      <td className="px-5 py-3 text-gray-600">
                        <span
                          style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 999, fontSize: 11 }}
                          className="px-2 py-0.5 font-semibold"
                        >
                          {getApplicantCount(job.id)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                        {job.daysAgo === 0 ? 'Today' : `${job.daysAgo}d ago`}
                      </td>
                      <td className="px-5 py-3">
                        <span style={{ background: s.bg, color: s.text, borderRadius: 999, fontSize: 11 }} className="px-2.5 py-0.5 font-semibold capitalize">
                          {job.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => navigate('employer-applicants')}
                            style={{ color: '#0f2044' }}
                            className="text-xs font-medium hover:underline whitespace-nowrap"
                          >
                            Applicants
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => navigate('employer-jobs')}
                            style={{ color: '#16a34a' }}
                            className="text-xs font-medium hover:underline"
                          >
                            Manage
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {recentJobs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-gray-400 text-sm">
                      No job posts yet.{' '}
                      <button onClick={() => navigate('employer-post')} style={{ color: '#16a34a' }} className="font-medium hover:underline">Post your first job</button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <button
            onClick={() => navigate('employer-post')}
            style={{ background: '#0f2044', color: '#fff', borderRadius: 10 }}
            className="p-5 text-left hover:opacity-90 transition-opacity"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" className="mb-3">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            <p className="font-semibold text-sm">Post a New Job</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>Reach qualified candidates in your area.</p>
          </button>
          <button
            onClick={() => navigate('employer-applicants')}
            style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}
            className="p-5 text-left hover:bg-gray-50 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" className="mb-3">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            <p className="font-semibold text-sm text-gray-900">Review Applicants</p>
            <p className="text-xs text-gray-500 mt-1">{newApplicants} new applicants awaiting review.</p>
          </button>
          <button
            onClick={() => navigate('employer-profile')}
            style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}
            className="p-5 text-left hover:bg-gray-50 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f2044" strokeWidth="2" className="mb-3">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
            </svg>
            <p className="font-semibold text-sm text-gray-900">Company Profile</p>
            <p className="text-xs text-gray-500 mt-1">Update your company information.</p>
          </button>
        </div>
      </div>
    </div>
  )
}

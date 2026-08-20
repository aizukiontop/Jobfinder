import { useApp } from '../context'

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? '#16a34a' : 'none'} stroke={filled ? '#16a34a' : '#9ca3af'} strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

export default function SavedJobs() {
  const { allJobs, savedJobIds, toggleSave, navigate } = useApp()
  const savedJobs = allJobs.filter(j => savedJobIds.includes(j.id))

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Saved Jobs</h1>
        <p className="text-sm text-gray-500 mb-8">
          {savedJobs.length === 0
            ? 'No saved jobs yet.'
            : `You have ${savedJobs.length} saved job${savedJobs.length !== 1 ? 's' : ''}.`}
        </p>

        {savedJobs.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔖</div>
            <h2 className="text-lg font-semibold text-gray-700 mb-2">No saved jobs yet.</h2>
            <p className="text-sm text-gray-500 mb-6">
              Browse jobs and click the bookmark icon to save them here.
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedJobs.map(job => (
              <div
                key={job.id}
                style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}
                className="p-5 flex flex-col"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div
                    style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6 }}
                    className="w-10 h-10 flex items-center justify-center"
                  >
                    <BuildingIcon />
                  </div>
                  <button onClick={() => toggleSave(job.id)} className="hover:scale-110 transition-transform">
                    <BookmarkIcon filled={true} />
                  </button>
                </div>

                {/* Info */}
                <h3 className="font-semibold text-sm text-gray-900 mb-1">{job.title}</h3>
                <p style={{ color: '#16a34a' }} className="text-xs font-medium mb-3">{job.company}</p>

                <div style={{ borderTop: '1px solid #f3f4f6' }} className="pt-3 space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {job.location}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-700 font-medium">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v8M8 12h8" />
                    </svg>
                    {job.salary}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8M12 17v4" />
                    </svg>
                    {job.employmentType}
                  </div>
                </div>

                <button
                  onClick={() => navigate('apply', job.id)}
                  style={{ background: '#16a34a', color: '#fff', borderRadius: 6 }}
                  className="w-full py-2.5 text-sm font-semibold hover:bg-green-700 transition-colors mt-auto"
                >
                  Apply Now
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #e5e7eb', background: '#fff' }} className="mt-12 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-400">© 2024 JobFinder. All rights reserved.</p>
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

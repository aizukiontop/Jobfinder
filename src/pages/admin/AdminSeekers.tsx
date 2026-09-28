import { useEffect, useState } from 'react'
import { fetchAdminUsers, type AdminUser } from '../../lib/api'
import { formatRelativeDate } from '../../lib/formatDate'

export default function AdminSeekers() {
  const [seekers, setSeekers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchAdminUsers()
      .then(data => setSeekers(data.items.filter(item => item.role === 'job-seeker')))
      .catch(() => setError('The job seeker list could not be loaded.'))
      .finally(() => setLoading(false))
  }, [])

  const needle = query.trim().toLowerCase()
  const shown = needle
    ? seekers.filter(s => s.email.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle))
    : seekers

  return (
    <div style={{ background: '#f9fafb', flex: 1 }} className="py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Seekers</h1>
          <p className="text-sm text-gray-500 mt-1">{seekers.length} registered job seeker{seekers.length === 1 ? '' : 's'}. This list is view-only.</p>
        </div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Filter job seekers"
          placeholder="Filter by name or email"
          style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
          className="w-full max-w-sm px-3 py-2 text-sm"
        />
        {loading && <p role="status" className="text-sm text-gray-500 py-6">Loading job seekers…</p>}
        {error && <p role="alert" className="text-sm text-red-600 py-6">{error}</p>}
        {!loading && !error && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }} className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 720 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Name', 'Email', 'Activity', 'Registered', 'Last seen'].map(h => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-gray-700">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.name || '—'}</p>
                      {s.detail && <p className="text-xs text-gray-500">{s.detail}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.email}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {s.applications} application{s.applications === 1 ? '' : 's'}, {s.savedJobs} saved
                      <span className="text-gray-400">{s.hasResume ? ' · resume' : ' · no resume'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatRelativeDate(s.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{s.lastSeen ? formatRelativeDate(s.lastSeen) : 'never'}</td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">No job seekers match that filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

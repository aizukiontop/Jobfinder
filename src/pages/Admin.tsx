import { useEffect, useState } from 'react'
import { useApp } from '../context'
import { fetchAdminUsers, type AdminUser } from '../lib/api'
import { formatRelativeDate } from '../lib/formatDate'

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}
      className="px-5 py-4 flex-1 min-w-[140px]"
    >
      <p className="text-2xl font-bold" style={{ color: '#0f2044' }}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}

function RoleTag({ role }: { role: string }) {
  const employer = role === 'employer'
  return (
    <span
      style={{
        background: employer ? '#eef2ff' : '#dcfce7',
        color: employer ? '#3730a3' : '#166534',
        borderRadius: 999,
      }}
      className="px-2 py-0.5 text-xs font-medium whitespace-nowrap"
    >
      {employer ? 'Employer' : 'Job Seeker'}
    </span>
  )
}

export default function Admin() {
  const { isAdmin, navigate } = useApp()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [totals, setTotals] = useState({ users: 0, seekers: 0, employers: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    const controller = new AbortController()
    void (async () => {
      try {
        const data = await fetchAdminUsers(controller.signal)
        setUsers(data.items)
        setTotals(data.totals)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError('The user list could not be loaded.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-sm mb-4">This page is restricted.</p>
        <button
          onClick={() => navigate('home')}
          style={{ background: '#0f2044', color: '#fff', borderRadius: 6 }}
          className="px-6 py-2.5 text-sm font-semibold"
        >
          Back to home
        </button>
      </div>
    )
  }

  const needle = query.trim().toLowerCase()
  const shown = needle
    ? users.filter(u =>
        u.email.toLowerCase().includes(needle) || u.name.toLowerCase().includes(needle))
    : users

  return (
    <div style={{ background: '#f9fafb', flex: 1 }} className="py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Registered Users</h1>
        <p className="text-sm text-gray-500 mb-6">Every account on JobFinder.</p>

        <div className="flex flex-wrap gap-3 mb-6">
          <Stat label="Total accounts" value={totals.users} />
          <Stat label="Job seekers" value={totals.seekers} />
          <Stat label="Employers" value={totals.employers} />
        </div>

        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter by name or email"
          style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
          className="w-full max-w-sm px-3 py-2 text-sm outline-none mb-4"
        />

        {loading && <p className="text-sm text-gray-500 py-8">Loading accounts…</p>}
        {error && <p className="text-sm text-red-600 py-8">{error}</p>}

        {!loading && !error && (
          <div
            style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}
            className="overflow-x-auto"
          >
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Activity</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Registered</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {shown.flatMap(u => [
                  <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{u.name || '—'}</p>
                      {u.detail && <p className="text-xs text-gray-500">{u.detail}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3"><RoleTag role={u.role} /></td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {u.role === 'employer' ? (
                        u.jobsPosted > 0 ? (
                          <button
                            onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                            style={{ color: '#16a34a' }}
                            className="font-medium hover:underline"
                          >
                            {u.jobsPosted} job{u.jobsPosted === 1 ? '' : 's'} posted
                            <span className="ml-1">{expanded === u.id ? '▾' : '▸'}</span>
                          </button>
                        ) : (
                          'No jobs posted'
                        )
                      ) : (
                        <>
                          {u.applications} application{u.applications === 1 ? '' : 's'}, {u.savedJobs} saved
                          <span className="text-gray-400">{u.hasResume ? ' · resume' : ' · no resume'}</span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatRelativeDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {u.lastSeen ? formatRelativeDate(u.lastSeen) : 'never'}
                    </td>
                  </tr>,
                  expanded === u.id && u.jobs.length > 0 && (
                    <tr key={u.id + '-jobs'} style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>
                      <td colSpan={6} className="px-4 py-3">
                        <p className="text-xs font-semibold text-gray-700 mb-2">
                          Jobs posted by {u.name || u.email}
                        </p>
                        <div className="space-y-1">
                          {u.jobs.map(j => (
                            <div key={j.id} className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-medium text-gray-900">{j.title || 'Untitled'}</span>
                              <span
                                style={{
                                  background: j.status === 'active' ? '#dcfce7' : j.status === 'draft' ? '#fef3c7' : '#f3f4f6',
                                  color: j.status === 'active' ? '#166534' : j.status === 'draft' ? '#92400e' : '#4b5563',
                                  borderRadius: 999,
                                }}
                                className="px-2 py-0.5"
                              >
                                {j.status}
                              </span>
                              <span className="text-gray-500">{j.employmentType}</span>
                              <span className="text-gray-500">
                                · {j.applicants} applicant{j.applicants === 1 ? '' : 's'}
                              </span>
                              <span className="text-gray-400">· {formatRelativeDate(j.postedAt)}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ),
                ])}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                      No accounts match that filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

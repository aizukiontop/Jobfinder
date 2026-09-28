import { useEffect, useState } from 'react'
import { ApiRequestError } from '../../lib/api'
import { fetchAdminEmployers, setEmployerStatus, type AdminEmployer } from '../../lib/panelAdminApi'
import { formatRelativeDate } from '../../lib/formatDate'
import AdminPostings from '../../components/AdminPostings'

const inputStyle = { border: '1px solid #d1d5db', borderRadius: 6 }

export default function AdminEmployers() {
  const [text, setText] = useState('')
  const [filters, setFilters] = useState({ q: '', status: '', page: 1 })
  const [employers, setEmployers] = useState<AdminEmployer[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadCount, setReloadCount] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchAdminEmployers(filters)
      .then(data => {
        if (cancelled) return
        setEmployers(data.items)
        setTotal(data.total)
      })
      .catch(() => { if (!cancelled) setError('The employer list could not be loaded.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filters, reloadCount])

  const pages = Math.max(1, Math.ceil(total / 15))

  return (
    <div style={{ background: '#f9fafb', flex: 1 }} className="py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employers</h1>
          <p className="text-sm text-gray-500 mt-1">Check employer details, see their postings, and suspend accounts that break the rules.</p>
        </div>

        <form
          onSubmit={e => { e.preventDefault(); setFilters({ ...filters, q: text.trim(), page: 1 }) }}
          className="flex flex-wrap gap-2"
        >
          <input
            aria-label="Search employers"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Company, contact or email"
            style={inputStyle}
            className="px-3 py-2 text-sm w-full sm:w-64"
          />
          <select
            aria-label="Account status"
            value={filters.status}
            onChange={e => setFilters({ ...filters, status: e.target.value, page: 1 })}
            style={inputStyle}
            className="px-2 py-2 text-sm bg-white"
          >
            <option value="">All employers</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <button style={{ background: '#0f2044', color: '#fff', borderRadius: 6 }} className="px-4 py-2 text-sm font-semibold">
            Search
          </button>
        </form>

        {loading && <p role="status" className="text-sm text-gray-500 py-6">Loading employers…</p>}
        {error && <p role="alert" className="text-sm text-red-600 py-6">{error}</p>}

        {!loading && !error && (
          <div className="space-y-2">
            {employers.length === 0 && <p className="text-sm text-gray-500 py-6 text-center">No employers match these filters.</p>}
            {employers.map(employer => (
              <div key={employer.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      {employer.companyName}
                      <span
                        style={{
                          background: employer.active ? '#dcfce7' : '#fee2e2',
                          color: employer.active ? '#166534' : '#b91c1c',
                          borderRadius: 999,
                        }}
                        className="ml-2 px-2 py-0.5 text-xs font-medium"
                      >
                        {employer.active ? 'Active' : 'Suspended'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {employer.industry} · {employer.contactName} · {employer.email}{employer.contactPhone ? ` · ${employer.contactPhone}` : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      {employer.published} published · {employer.pending} waiting for review · {employer.postings} total ·{' '}
                      {employer.applications} application{employer.applications === 1 ? '' : 's'} · joined {formatRelativeDate(employer.createdAt)}
                    </p>
                    {!employer.active && employer.statusReason && (
                      <p className="text-xs text-red-700 mt-1">Suspended because: {employer.statusReason}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setOpenId(openId === employer.id ? null : employer.id)}
                    aria-expanded={openId === employer.id}
                    style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                    className="px-3 py-1.5 text-sm"
                  >
                    {openId === employer.id ? 'Close' : 'Manage'}
                  </button>
                </div>
                {openId === employer.id && (
                  <div style={{ borderTop: '1px solid #f3f4f6' }} className="mt-3 pt-3 space-y-4">
                    <AccountStatusForm employer={employer} onDone={() => setReloadCount(count => count + 1)} />
                    <div>
                      <h3 className="font-semibold text-sm text-gray-800 mb-2">Postings by {employer.companyName}</h3>
                      <AdminPostings ownerId={employer.id} />
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between text-sm pt-2">
              <span className="text-gray-600">{total} employer{total === 1 ? '' : 's'} · page {filters.page} of {pages}</span>
              <div className="flex gap-2">
                <button disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })} style={inputStyle} className="px-3 py-1.5 disabled:opacity-40">Previous</button>
                <button disabled={filters.page >= pages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })} style={inputStyle} className="px-3 py-1.5 disabled:opacity-40">Next</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AccountStatusForm({ employer, onDone }: { employer: AdminEmployer; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (employer.active && !reason.trim()) {
      setError('Write a reason for the suspension.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await setEmployerStatus(employer.id, !employer.active, reason)
      onDone()
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'The account status could not be changed.')
    } finally {
      setSaving(false)
    }
  }

  if (!employer.active) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-gray-700">This employer cannot sign in, and their postings are hidden from job seekers. Their applications are kept.</p>
        {error && <p role="alert" className="text-red-600">{error}</p>}
        <button
          onClick={save}
          disabled={saving}
          style={{ background: '#16a34a', color: '#fff', borderRadius: 6 }}
          className="px-4 py-2 font-semibold disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Reactivate employer'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2 text-sm">
      <label className="block">
        <span className="text-gray-700">Reason for suspension (required)</span>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          maxLength={1000}
          rows={2}
          style={inputStyle}
          className="mt-1 w-full px-3 py-2"
          placeholder="e.g. Reported as a fake company"
        />
      </label>
      <p className="text-xs text-gray-500">Suspending signs the employer out, blocks sign-in and hides their postings. Applications and history are kept.</p>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <button
        onClick={save}
        disabled={saving}
        style={{ background: '#dc2626', color: '#fff', borderRadius: 6 }}
        className="px-4 py-2 font-semibold disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Suspend employer'}
      </button>
    </div>
  )
}

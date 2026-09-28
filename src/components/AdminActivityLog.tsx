import { useEffect, useState } from 'react'
import { ApiRequestError } from '../lib/api'
import { fetchAdminAudit, fetchAdminNotifications, type AuditEntry, type NotificationEntry } from '../lib/panelAdminApi'

const EMAIL_STATUS: Record<string, string> = {
  disabled: 'Not sent — email disabled',
  queued: 'Queued (not sent)',
  sending: 'Sending',
  retry: 'Retry pending',
  accepted: 'Provider accepted (delivery unconfirmed)',
  failed: 'Failed',
  'opted-out': 'Not sent — opted out',
}

export default function AdminActivityLog({ kind }: { kind: 'audit' | 'notifications' }) {
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [notifications, setNotifications] = useState<NotificationEntry[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(20)
  const [action, setAction] = useState('')
  const [filter, setFilter] = useState('')
  const [mailEnabled, setMailEnabled] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void (async () => {
      try {
        if (kind === 'audit') {
          const data = await fetchAdminAudit(page, filter, controller.signal)
          if (controller.signal.aborted) return
          setAudit(data.items)
          setTotal(data.total)
          setLimit(data.limit)
        } else {
          const data = await fetchAdminNotifications(page, controller.signal)
          if (controller.signal.aborted) return
          setNotifications(data.items)
          setTotal(data.total)
          setLimit(data.limit)
          setMailEnabled(data.mailEnabled)
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof ApiRequestError ? err.message : 'The log could not be loaded. Try refreshing.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [kind, page, filter, revision])

  const pages = Math.max(1, Math.ceil(total / limit))
  return (
    <section aria-label={kind === 'audit' ? 'Website change log' : 'Email notification log'} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-lg text-gray-900">{kind === 'audit' ? 'Website change log' : 'Email notification log'}</h2>
          <p className="text-sm text-gray-500">{kind === 'audit' ? 'Recorded website actions. This is an activity audit, not a source-code change history.' : 'Delivery state of notification events. Provider acceptance does not prove inbox delivery.'}</p>
        </div>
        <button onClick={() => setRevision(value => value + 1)} disabled={loading} className="rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">Refresh log</button>
      </div>
      {kind === 'notifications' && mailEnabled !== null && (
        <p role="status" className={`rounded-md border p-3 text-sm ${mailEnabled ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          {mailEnabled ? 'Email sending is enabled. Check each event for its actual send status.' : 'Real email sending is disabled. Events are recorded for testing; no email has been sent for disabled events.'}
        </p>
      )}
      {kind === 'audit' && <form onSubmit={event => { event.preventDefault(); setFilter(action.trim()); setPage(1) }} className="flex flex-wrap gap-2">
        <input aria-label="Filter audit action" value={action} onChange={event => setAction(event.target.value)} placeholder="Action, e.g. job.approve" className="rounded-md border border-gray-300 px-3 py-2 text-sm w-full sm:w-80" />
        <button className="rounded-md bg-[#0f2044] px-4 py-2 text-sm text-white">Filter action</button>
        {filter && <button type="button" onClick={() => { setAction(''); setFilter(''); setPage(1) }} className="text-sm text-gray-600 px-3">Clear</button>}
      </form>}
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <p role="status" className="text-sm text-gray-500 py-8">Loading log…</p> : !error && (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            {kind === 'audit' ? <table className="w-full text-sm min-w-[660px]">
              <thead className="bg-gray-50 text-left text-gray-600"><tr>{['When', 'Actor', 'Action / target', 'Summary'].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
              <tbody>{audit.map(entry => <tr key={entry.id} className="border-t border-gray-100 align-top">
                <td className="p-4 whitespace-nowrap text-xs">{new Date(entry.createdAt).toLocaleString()}</td>
                <td className="p-4 break-words">{entry.actorLabel || 'System'}</td>
                <td className="p-4"><p className="font-medium">{entry.action}</p><p className="text-xs text-gray-500 break-all">{entry.targetType}: {entry.targetId}</p></td>
                <td className="p-4 whitespace-pre-wrap break-words">{entry.summary || '—'}</td>
              </tr>)}{audit.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-gray-500">No recorded actions match this filter.</td></tr>}</tbody>
            </table> : <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-gray-50 text-left text-gray-600"><tr>{['Created', 'Event', 'Recipient', 'Status', 'Attempts'].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
              <tbody>{notifications.map(entry => <tr key={entry.id} className="border-t border-gray-100 align-top">
                <td className="p-4 text-xs whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}</td>
                <td className="p-4">{entry.eventType}</td>
                <td className="p-4 break-words">{entry.recipient}</td>
                <td className="p-4"><p>{EMAIL_STATUS[entry.status] ?? entry.status}</p>{entry.lastError && <p className="text-xs text-red-700 mt-1">{entry.lastError}</p>}</td>
                <td className="p-4">{entry.attempts}</td>
              </tr>)}{notifications.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-500">No notification events recorded yet.</td></tr>}</tbody>
            </table>}
          </div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span>{total} event{total === 1 ? '' : 's'} · Page {page} of {pages}</span>
            <div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="rounded border px-3 py-2 disabled:opacity-40">Previous</button><button disabled={page >= pages} onClick={() => setPage(value => value + 1)} className="rounded border px-3 py-2 disabled:opacity-40">Next</button></div>
          </div>
        </>
      )}
    </section>
  )
}

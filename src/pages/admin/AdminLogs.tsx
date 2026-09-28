import { useState } from 'react'
import AdminActivityLog from '../../components/AdminActivityLog'

export default function AdminLogs() {
  const [kind, setKind] = useState<'audit' | 'notifications'>('audit')

  return (
    <div style={{ background: '#f9fafb', flex: 1 }} className="py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
        <div role="tablist" className="flex gap-2">
          {([['audit', 'Change log'], ['notifications', 'Email log']] as const).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={kind === value}
              onClick={() => setKind(value)}
              style={{
                background: kind === value ? '#0f2044' : '#fff',
                color: kind === value ? '#fff' : '#374151',
                border: '1px solid #d1d5db',
                borderRadius: 6,
              }}
              className="px-4 py-2 text-sm font-medium"
            >
              {label}
            </button>
          ))}
        </div>
        <AdminActivityLog key={kind} kind={kind} />
      </div>
    </div>
  )
}

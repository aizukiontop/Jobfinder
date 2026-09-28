import AdminPostings from '../../components/AdminPostings'

export default function AdminPostingsPage() {
  return (
    <div style={{ background: '#f9fafb', flex: 1 }} className="py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Postings</h1>
          <p className="text-sm text-gray-500 mt-1">New postings are published only after PESO approves them. Existing postings from before this review system are marked as exempt.</p>
        </div>
        <AdminPostings />
      </div>
    </div>
  )
}

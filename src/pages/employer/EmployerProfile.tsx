import { useState, useEffect } from 'react'
import { useApp } from '../../context'

const INDUSTRIES = ['Information Technology', 'Healthcare', 'Education', 'Retail & Trade', 'Manufacturing', 'Finance & Banking', 'Hospitality & Tourism', 'Construction', 'Transportation', 'Other']
const COMPANY_SIZES = ['1-10 employees', '11-50 employees', '51-200 employees', '201-500 employees', '500+ employees']

export default function EmployerProfile() {
  const { employer, updateEmployer } = useApp()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    companyName: '',
    industry: '',
    description: '',
    address: '',
    contactEmail: '',
    contactPhone: '',
    website: '',
    companySize: '',
    contactName: '',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (employer) {
      setForm({
        companyName: employer.companyName,
        industry: employer.industry,
        description: employer.description,
        address: employer.address,
        contactEmail: employer.contactEmail,
        contactPhone: employer.contactPhone,
        website: employer.website,
        companySize: employer.companySize,
        contactName: employer.contactName,
      })
    }
  }, [employer])

  const field = (name: keyof typeof form) => ({
    value: form[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [name]: e.target.value })),
    disabled: !editing,
  })

  const handleSave = () => {
    updateEmployer(form)
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)

    // Also update in localStorage employer accounts
    try {
      const employers = JSON.parse(localStorage.getItem('jf_employers') ?? '[]')
      const updated = employers.map((e: any) => e.id === employer?.id ? { ...e, ...form } : e)
      localStorage.setItem('jf_employers', JSON.stringify(updated))
    } catch { /* ignore */ }
  }

  const handleCancel = () => {
    if (employer) {
      setForm({
        companyName: employer.companyName, industry: employer.industry,
        description: employer.description, address: employer.address,
        contactEmail: employer.contactEmail, contactPhone: employer.contactPhone,
        website: employer.website, companySize: employer.companySize,
        contactName: employer.contactName,
      })
    }
    setEditing(false)
  }

  const inputClass = `w-full px-3 py-2.5 text-sm outline-none`
  const inputStyle = (disabled: boolean) => ({
    border: `1px solid ${disabled ? '#f3f4f6' : '#d1d5db'}`,
    borderRadius: 6,
    background: disabled ? '#f9fafb' : '#fff',
    color: disabled ? '#6b7280' : '#111827',
  })

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }} className="py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Company Profile</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your company information shown to job seekers.</p>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit Profile
            </button>
          )}
        </div>

        {saved && (
          <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 6 }} className="px-4 py-3 mb-4 text-sm text-green-800 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Profile saved successfully.
          </div>
        )}

        {/* Company logo / avatar */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }} className="p-6 mb-4 flex items-center gap-5">
          <div style={{ background: '#0f2044', color: '#fff', borderRadius: 12, fontSize: 28 }} className="w-16 h-16 flex items-center justify-center font-bold flex-shrink-0">
            {employer?.companyName.charAt(0) ?? 'C'}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">{employer?.companyName}</p>
            <p className="text-sm text-gray-500">{employer?.industry}</p>
            <p className="text-xs text-gray-400 mt-0.5">{employer?.companySize}</p>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name</label>
              <input {...field('companyName')} style={inputStyle(!editing)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Industry</label>
              {editing ? (
                <select {...field('industry')} style={{ border: '1px solid #d1d5db', borderRadius: 6 }} className="w-full px-3 py-2.5 text-sm outline-none bg-white">
                  {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                </select>
              ) : (
                <input value={form.industry} readOnly style={inputStyle(true)} className={inputClass} />
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Description</label>
            <textarea
              {...field('description')}
              rows={4}
              style={{ ...inputStyle(!editing), resize: 'none' as const }}
              className={inputClass}
              placeholder="Describe your company, culture, and what makes it a great place to work."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
            <input {...field('address')} style={inputStyle(!editing)} className={inputClass} placeholder="Full company address" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Email</label>
              <input type="email" {...field('contactEmail')} style={inputStyle(!editing)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Number</label>
              <input {...field('contactPhone')} style={inputStyle(!editing)} className={inputClass} placeholder="(045) 000-0000" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Website</label>
              <input {...field('website')} style={inputStyle(!editing)} className={inputClass} placeholder="www.yourcompany.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Size</label>
              {editing ? (
                <select {...field('companySize')} style={{ border: '1px solid #d1d5db', borderRadius: 6 }} className="w-full px-3 py-2.5 text-sm outline-none bg-white">
                  {COMPANY_SIZES.map(s => <option key={s}>{s}</option>)}
                </select>
              ) : (
                <input value={form.companySize} readOnly style={inputStyle(true)} className={inputClass} />
              )}
            </div>
          </div>

          {editing && (
            <div style={{ borderTop: '1px solid #f3f4f6' }} className="pt-5 flex gap-3">
              <button
                onClick={handleCancel}
                style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{ background: '#0f2044', color: '#fff', borderRadius: 6 }}
                className="flex-1 py-2.5 text-sm font-semibold hover:opacity-90"
              >
                Save Changes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

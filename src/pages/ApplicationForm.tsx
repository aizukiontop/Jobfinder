import { useState, useRef } from 'react'
import { useApp } from '../context'
import type { Application } from '../types'

function UploadIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <polyline points="9 15 12 12 15 15" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

export default function ApplicationForm() {
  const { allJobs, selectedJobId, navigate, prevPage, addApplication, hasApplied, user } = useApp()
  const job = allJobs.find(j => j.id === selectedJobId)

  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
    phone: '',
    coverLetter: '',
  })
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!job) {
    return (
      <div className="text-center py-20 text-gray-500">
        Job not found.{' '}
        <button onClick={() => navigate('search')} style={{ color: '#16a34a' }} className="underline">
          Browse Jobs
        </button>
      </div>
    )
  }

  const alreadyApplied = hasApplied(job.id)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.firstName.trim()) e.firstName = 'First name is required.'
    if (!form.lastName.trim()) e.lastName = 'Last name is required.'
    if (!form.email.trim()) e.email = 'Email address is required.'
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email address.'
    if (!resumeFile) e.resume = 'Resume/CV is required.'
    return e
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    const app: Application = {
      id: `app-${Date.now()}`,
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      dateApplied: new Date().toISOString(),
      status: 'applied',
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      coverLetter: form.coverLetter,
      // Snapshot skills at time of application for employer ranking
      applicantSkills: user?.skills ?? [],
    }

    addApplication(app)
    setSubmitted(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, resume: 'File must be under 5MB.' }))
      return
    }
    if (!['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
      setErrors(prev => ({ ...prev, resume: 'Only PDF or DOCX files are accepted.' }))
      return
    }
    setResumeFile(file)
    setErrors(prev => ({ ...prev, resume: '' }))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      fileInputRef.current!.files = e.dataTransfer.files
      handleFileChange({ target: { files: e.dataTransfer.files } } as React.ChangeEvent<HTMLInputElement>)
    }
  }

  if (submitted) {
    return (
      <div style={{ background: '#f9fafb', minHeight: '100vh' }} className="flex items-center justify-center px-4">
        <div
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12 }}
          className="max-w-md w-full p-8 text-center"
        >
          <div
            style={{ background: '#dcfce7', borderRadius: 999 }}
            className="w-16 h-16 flex items-center justify-center mx-auto mb-4"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Application Submitted!</h2>
          <p className="text-sm text-gray-500 mb-2">
            Your application for <strong>{job.title}</strong> at <strong>{job.company}</strong> has been submitted successfully.
          </p>
          <p className="text-xs text-gray-400 mb-6">
            You can track the status in the Applications page.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('applications')}
              style={{ background: '#0f2044', color: '#fff', borderRadius: 6 }}
              className="flex-1 py-2.5 text-sm font-semibold hover:opacity-90"
            >
              View Applications
            </button>
            <button
              onClick={() => navigate('search')}
              style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
              className="flex-1 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Browse More Jobs
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }} className="px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <button
          onClick={() => navigate('jobdetail', job.id)}  
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to job details
        </button>

        {alreadyApplied && (
          <div
            style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: 8 }}
            className="p-4 mb-6 text-sm text-yellow-800"
          >
            You have already applied for this position. Submitting again will create a duplicate application.
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}
          className="p-6 md:p-8"
        >
          {/* Job header */}
          <div className="flex items-center gap-4 pb-5 mb-6" style={{ borderBottom: '1px solid #f3f4f6' }}>
            <div
              style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8 }}
              className="w-14 h-14 flex items-center justify-center flex-shrink-0"
            >
              <BuildingIcon />
            </div>
            <div>
              <h2 className="font-bold text-lg text-gray-900">{job.title}</h2>
              <p style={{ color: '#16a34a' }} className="text-sm font-medium">
                {job.company} • {job.location}
              </p>
            </div>
          </div>

          {/* Contact Information */}
          <h3 className="font-semibold text-base text-gray-900 mb-4">Contact Information</h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                value={form.firstName}
                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                style={{
                  border: `1px solid ${errors.firstName ? '#ef4444' : '#d1d5db'}`,
                  borderRadius: 6,
                }}
                className="w-full px-3 py-2 text-sm outline-none focus:border-green-500"
              />
              {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                value={form.lastName}
                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                style={{
                  border: `1px solid ${errors.lastName ? '#ef4444' : '#d1d5db'}`,
                  borderRadius: 6,
                }}
                className="w-full px-3 py-2 text-sm outline-none focus:border-green-500"
              />
              {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              style={{
                border: `1px solid ${errors.email ? '#ef4444' : '#d1d5db'}`,
                borderRadius: 6,
              }}
              className="w-full px-3 py-2 text-sm outline-none focus:border-green-500"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
              className="w-full px-3 py-2 text-sm outline-none focus:border-green-500"
              placeholder="09xx-xxx-xxxx"
            />
          </div>

          {/* Resume */}
          <div style={{ borderTop: '1px solid #f3f4f6' }} className="pt-6 mb-6">
            <h3 className="font-semibold text-base text-gray-900 mb-4">
              Resume/CV <span className="text-red-500">*</span>
            </h3>

            {resumeFile ? (
              <div
                style={{ border: '1px solid #d1d5db', borderRadius: 8 }}
                className="flex items-center gap-3 p-4"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="text-sm text-gray-700 flex-1">{resumeFile.name}</span>
                <button
                  type="button"
                  onClick={() => setResumeFile(null)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${errors.resume ? '#ef4444' : '#d1d5db'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
                className="flex flex-col items-center justify-center py-10 hover:border-gray-400 transition-colors"
              >
                <UploadIcon />
                <p style={{ color: '#16a34a' }} className="text-sm font-medium mt-2">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF, DOCX up to 5MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}
            {errors.resume && <p className="text-xs text-red-500 mt-1">{errors.resume}</p>}
          </div>

          {/* Cover letter */}
          <div style={{ borderTop: '1px solid #f3f4f6' }} className="pt-6 mb-8">
            <h3 className="font-semibold text-base text-gray-900 mb-4">Cover Letter (Optional)</h3>
            <textarea
              value={form.coverLetter}
              onChange={e => setForm(f => ({ ...f, coverLetter: e.target.value }))}
              rows={5}
              style={{ border: '1px solid #d1d5db', borderRadius: 8 }}
              className="w-full px-3 py-2.5 text-sm outline-none resize-none focus:border-green-500"
              placeholder="Write a brief cover letter..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate('jobdetail', job.id)}  
              style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
              className="px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ background: '#16a34a', color: '#fff', borderRadius: 6 }}
              className="px-6 py-2.5 text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              Submit Application
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

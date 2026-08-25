import { useState, useRef, useEffect } from 'react'
import { useApp } from '../context'
import { ApiRequestError } from '../lib/api'
import { deletePhoto, deleteResume, uploadPhoto, uploadResume } from '../lib/api'
import { formatRelativeDate } from '../lib/formatDate'
import { CATEGORIES, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from '../data'
import { ANGELES_CITY_BARANGAYS } from '../data/barangays'

export default function Profile() {
  const { user, updateUser, navigate } = useApp()

  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    headline: user?.headline ?? '',
    skills: user?.skills.join(', ') ?? '',
    preferredLocation: user?.preferredLocation ?? 'Angeles City',
    preferredEmploymentType: user?.preferredEmploymentType ?? 'Full-time',
    careerCategory: user?.careerCategory ?? '',
    experienceLevel: user?.experienceLevel ?? 'Entry level',
    education: user?.education ?? '',
    barangay: user?.barangay ?? '',
  })
  const [saved, setSaved] = useState(false)
  const [resumeName, setResumeName] = useState(user?.resumeName ?? '')
  const [resumeDate, setResumeDate] = useState(user?.resumeDate ?? '')
  const [visibility, setVisibility] = useState<'Public' | 'Private'>('Public')
  const [photoUrl, setPhotoUrl] = useState(user?.photo ?? '')
  const [photoError, setPhotoError] = useState('')
  const photoInputRef = useRef<HTMLInputElement>(null)
  const resumeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName,
        lastName: user.lastName,
        headline: user.headline,
        skills: user.skills.join(', '),
        preferredLocation: user.preferredLocation,
        preferredEmploymentType: user.preferredEmploymentType,
        careerCategory: user.careerCategory,
        experienceLevel: user.experienceLevel,
        education: user.education,
        barangay: user.barangay ?? '',
      })
      setResumeName(user.resumeName)
      setResumeDate(user.resumeDate)
      setPhotoUrl(user.photo)
    }
  }, [user])

  if (!user) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-sm mb-4">Please sign in to view your profile.</p>
        <button
          onClick={() => navigate('signin')}
          style={{ background: '#0f2044', color: '#fff', borderRadius: 6 }}
          className="px-6 py-2.5 text-sm font-semibold"
        >
          Sign In
        </button>
      </div>
    )
  }

  const homeLocationUpdate = () => {
    if (!form.barangay) return { barangay: null, lat: null, lng: null }
    const match = ANGELES_CITY_BARANGAYS.find(b => b.canonical === form.barangay)
    if (!match) return { barangay: null, lat: null, lng: null }
    return { barangay: match.canonical, lat: match.lat, lng: match.lng }
  }

  const handleSave = async () => {
    const updates = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      headline: form.headline.trim(),
      skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      preferredLocation: form.preferredLocation,
      preferredEmploymentType: form.preferredEmploymentType,
      careerCategory: form.careerCategory,
      experienceLevel: form.experienceLevel,
      education: form.education.trim(),
      resumeName,
      resumeDate,
      ...homeLocationUpdate(),
    }
    if (!(await updateUser(updates))) return
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoError('')
    try {
      setPhotoUrl(await uploadPhoto(file))
    } catch (err) {
      setPhotoError(
        err instanceof ApiRequestError
          ? err.message
          : 'The photo could not be uploaded. Please try again.'
      )
    }
  }

  const handlePhotoRemove = async () => {
    setPhotoError('')
    try {
      await deletePhoto()
      setPhotoUrl('')
    } catch {
      setPhotoError('The photo could not be removed. Please try again.')
    }
  }

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const stored = await uploadResume(file)
      setResumeName(stored.name)
      setResumeDate(stored.updatedAt)
    } catch {
      setResumeName('Upload failed. Please choose a PDF or DOCX under 5 MB.')
    }
  }

  return (
    <div style={{ background: '#f9fafb', flex: 1 }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile Settings</h1>

        {saved && (
          <div
            style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8 }}
            className="px-4 py-3 mb-6 text-sm text-green-800 flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Profile saved successfully.
          </div>
        )}

        {/* Photo section */}
        <div
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}
          className="p-6 mb-4"
        >
          <div className="flex items-center gap-5 mb-4">
            <div
              style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 999 }}
              className="w-20 h-20 flex items-center justify-center overflow-hidden flex-shrink-0"
            >
              {photoUrl ? (
                <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </div>
            <div>
              <p className="font-bold text-gray-900 text-base">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm text-gray-500">{user.email}</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => photoInputRef.current?.click()}
                  style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Upload New Photo
                </button>
                {photoUrl && (
                  <button
                    onClick={handlePhotoRemove}
                    style={{ border: '1px solid #fca5a5', borderRadius: 6, color: '#dc2626' }}
                    className="px-3 py-1.5 text-xs font-medium hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
                <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoUpload} className="hidden" />
              </div>
              {photoError && <p className="text-xs text-red-500 mt-2">{photoError}</p>}
            </div>
          </div>
          <div style={{ borderTop: '1px solid #f3f4f6' }} className="pt-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Profile visibility: <strong className="text-gray-700">{visibility}</strong>
            </span>
            <button
              onClick={() => setVisibility(v => (v === 'Public' ? 'Private' : 'Public'))}
              style={{ color: '#16a34a' }}
              className="text-sm font-medium hover:underline"
            >
              Change
            </button>
          </div>
        </div>

        {/* Personal Information */}
        <div
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}
          className="p-6 mb-4"
        >
          <h2 className="font-semibold text-base text-gray-900 mb-5">Personal Information</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                value={form.firstName}
                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                className="w-full px-3 py-2 text-sm outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                value={form.lastName}
                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                className="w-full px-3 py-2 text-sm outline-none focus:border-green-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Professional Headline</label>
            <input
              value={form.headline}
              onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
              style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
              className="w-full px-3 py-2 text-sm outline-none focus:border-green-500"
              placeholder="e.g. Junior Web Developer specializing in React"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Skills{' '}
              <span className="text-xs text-gray-400 font-normal">(comma-separated)</span>
            </label>
            <input
              value={form.skills}
              onChange={e => setForm(f => ({ ...f, skills: e.target.value }))}
              style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
              className="w-full px-3 py-2 text-sm outline-none focus:border-green-500"
              placeholder="e.g. React, JavaScript, Customer Service"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Education</label>
            <input
              value={form.education}
              onChange={e => setForm(f => ({ ...f, education: e.target.value }))}
              style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
              className="w-full px-3 py-2 text-sm outline-none focus:border-green-500"
              placeholder="e.g. BS Computer Science, Holy Angel University"
            />
          </div>

          <div style={{ borderTop: '1px solid #f3f4f6' }} className="pt-4 mb-1">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Job Preferences (used for match scoring)</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Location</label>
              <input
                value={form.preferredLocation}
                onChange={e => setForm(f => ({ ...f, preferredLocation: e.target.value }))}
                style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                className="w-full px-3 py-2 text-sm outline-none focus:border-green-500"
                placeholder="Angeles City"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Home Barangay</label>
              <select
                value={form.barangay}
                onChange={e => setForm(f => ({ ...f, barangay: e.target.value }))}
                style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                className="w-full px-3 py-2 text-sm outline-none focus:border-green-500 bg-white"
              >
                <option value="">Not set</option>
                {ANGELES_CITY_BARANGAYS.map(b => (
                  <option key={b.canonical} value={b.canonical}>{b.canonical}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Used to measure travel distance to each job.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
              <select
                value={form.preferredEmploymentType}
                onChange={e => setForm(f => ({ ...f, preferredEmploymentType: e.target.value }))}
                style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                className="w-full px-3 py-2 text-sm outline-none focus:border-green-500 bg-white"
              >
                {EMPLOYMENT_TYPES.map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Career Category</label>
              <select
                value={form.careerCategory}
                onChange={e => setForm(f => ({ ...f, careerCategory: e.target.value }))}
                style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                className="w-full px-3 py-2 text-sm outline-none focus:border-green-500 bg-white"
              >
                <option value="">Select category</option>
                {CATEGORIES.map(c => (
                  <option key={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Experience Level</label>
              <select
                value={form.experienceLevel}
                onChange={e => setForm(f => ({ ...f, experienceLevel: e.target.value }))}
                style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                className="w-full px-3 py-2 text-sm outline-none focus:border-green-500 bg-white"
              >
                {EXPERIENCE_LEVELS.map(l => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              style={{ background: '#0f2044', color: '#fff', borderRadius: 6 }}
              className="px-6 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Save Changes
            </button>
          </div>
        </div>

        {/* Resume */}
        <div
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}
          className="p-6 mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-base text-gray-900">Resume</h2>
            <button
              onClick={() => resumeInputRef.current?.click()}
              style={{ color: '#16a34a' }}
              className="text-sm font-medium hover:underline"
            >
              Upload New
            </button>
            <input ref={resumeInputRef} type="file" accept=".pdf,.docx" onChange={handleResumeUpload} className="hidden" />
          </div>

          {resumeName ? (
            <div
              style={{ border: '1px solid #e5e7eb', borderRadius: 8 }}
              className="flex items-center gap-3 p-4"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{resumeName}</p>
                {resumeDate && <p className="text-xs text-gray-400">Updated {formatRelativeDate(resumeDate)}</p>}
              </div>
              <button
                onClick={async () => {
                  try {
                    await deleteResume()
                    setResumeName('')
                    setResumeDate('')
                  } catch {
                    setResumeName('Could not remove the resume. Please try again.')
                  }
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ) : (
            <div
              onClick={() => resumeInputRef.current?.click()}
              style={{ border: '2px dashed #d1d5db', borderRadius: 8, cursor: 'pointer' }}
              className="flex flex-col items-center justify-center py-8 hover:border-gray-400 transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <polyline points="9 15 12 12 15 15" />
              </svg>
              <p style={{ color: '#16a34a' }} className="text-sm font-medium mt-2">Upload resume</p>
              <p className="text-xs text-gray-400 mt-0.5">PDF or DOCX, up to 5MB</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useApp } from '../context'
import { CATEGORIES, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, WORK_ARRANGEMENTS } from '../data'
import type { Job } from '../types'

const LOCATION_OPTIONS = [
  'Angeles City, Pampanga',
  'Clark, Pampanga',
  'San Fernando, Pampanga',
  'Manila',
  'Makati City',
  'Taguig',
  'Pasig City',
  'Remote',
  'Other',
]

const COORD_MAP: Record<string, [number, number]> = {
  'Angeles City, Pampanga': [15.1449, 120.5887],
  'Clark, Pampanga': [15.1841, 120.5402],
  'San Fernando, Pampanga': [15.0283, 120.6898],
  'Manila': [14.5995, 120.9842],
  'Makati City': [14.5547, 121.0244],
  'Taguig': [14.5243, 121.0792],
  'Pasig City': [14.5764, 121.0851],
  'Remote': [14.5995, 120.9842],
  'Other': [15.1449, 120.5887],
}

export default function PostJob() {
  const { addPostedJob, navigate, user } = useApp()
  const [form, setForm] = useState({
    title: '',
    company: user?.firstName ? `${user.firstName}'s Company` : '',
    description: '',
    responsibilities: '',
    requirements: '',
    location: 'Angeles City, Pampanga',
    salaryMin: '',
    salaryMax: '',
    employmentType: 'Full-time',
    workArrangement: 'On-site',
    experienceLevel: 'Entry level',
    category: 'IT & Software',
    openings: '1',
    skills: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = 'Job title is required.'
    if (!form.company.trim()) e.company = 'Company name is required.'
    if (!form.description.trim()) e.description = 'Job description is required.'
    if (!form.responsibilities.trim()) e.responsibilities = 'Responsibilities are required.'
    if (!form.requirements.trim()) e.requirements = 'Requirements are required.'
    if (!form.salaryMin || isNaN(Number(form.salaryMin))) e.salaryMin = 'Enter a valid minimum salary.'
    if (!form.salaryMax || isNaN(Number(form.salaryMax))) e.salaryMax = 'Enter a valid maximum salary.'
    return e
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    const [lat, lng] = COORD_MAP[form.location] ?? [15.1449, 120.5887]
    const min = Number(form.salaryMin)
    const max = Number(form.salaryMax)

    const skillList = form.skills.split(',').map(s => s.trim()).filter(Boolean)
    const job: Job = {
      id: `posted-${Date.now()}`,
      title: form.title.trim(),
      company: form.company.trim(),
      location: form.location,
      city: 'Angeles City',
      province: 'Pampanga',
      barangay: null,
      address: form.location,
      salary: `₱${min.toLocaleString()} - ₱${max.toLocaleString()}`,
      salaryMin: min,
      salaryMax: max,
      employmentType: form.employmentType,
      workArrangement: form.workArrangement,
      experienceLevel: form.experienceLevel,
      category: form.category,
      description: form.description.trim(),
      responsibilities: form.responsibilities.split('\n').filter(Boolean),
      requirements: form.requirements.split('\n').filter(Boolean),
      benefits: ['Government-mandated benefits', '13th month pay'],
      requiredSkills: skillList,
      preferredSkills: [],
      skills: skillList,
      openings: parseInt(form.openings) || 1,
      daysAgo: 0,
      lat,
      lng,
      coordinateSource: 'city-centroid',
      dataSource: 'employer-created',
      postedBy: user?.id,
    }

    addPostedJob(job)
    setSubmitted(true)
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
          <h2 className="text-xl font-bold text-gray-900 mb-2">Job Posted!</h2>
          <p className="text-sm text-gray-500 mb-6">
            Your job listing is now live and visible in Search Jobs.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('search')}
              style={{ background: '#0f2044', color: '#fff', borderRadius: 6 }}
              className="flex-1 py-2.5 text-sm font-semibold hover:opacity-90"
            >
              View in Search
            </button>
            <button
              onClick={() => { setSubmitted(false); setForm({ title: '', company: user?.firstName ? `${user.firstName}'s Company` : '', description: '', responsibilities: '', requirements: '', location: 'Angeles City, Pampanga', salaryMin: '', salaryMax: '', employmentType: 'Full-time', workArrangement: 'On-site', experienceLevel: 'Entry level', category: 'IT & Software', openings: '1', skills: '' }) }}
              style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
              className="flex-1 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Post Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  const inp = (name: keyof typeof form) => ({
    value: form[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm(f => ({ ...f, [name]: e.target.value }))
      setErrors(prev => ({ ...prev, [name]: '' }))
    },
  })

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }} className="px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Post a Job</h1>
        <p className="text-sm text-gray-500 mb-6">Fill in the details below to create a new job listing.</p>

        <form
          onSubmit={handleSubmit}
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }}
          className="p-6 md:p-8 space-y-5"
        >
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Title <span className="text-red-500">*</span>
              </label>
              <input
                {...inp('title')}
                style={{ border: `1px solid ${errors.title ? '#ef4444' : '#d1d5db'}`, borderRadius: 6 }}
                className="w-full px-3 py-2 text-sm outline-none"
                placeholder="e.g. Junior Web Developer"
              />
              {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                {...inp('company')}
                style={{ border: `1px solid ${errors.company ? '#ef4444' : '#d1d5db'}`, borderRadius: 6 }}
                className="w-full px-3 py-2 text-sm outline-none"
              />
              {errors.company && <p className="text-xs text-red-500 mt-1">{errors.company}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Description <span className="text-red-500">*</span>
            </label>
            <textarea
              {...inp('description')}
              rows={4}
              style={{ border: `1px solid ${errors.description ? '#ef4444' : '#d1d5db'}`, borderRadius: 6 }}
              className="w-full px-3 py-2 text-sm outline-none resize-none"
              placeholder="Describe the role and what the team does..."
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Responsibilities <span className="text-red-500">*</span>{' '}
              <span className="text-xs text-gray-400 font-normal">(one per line)</span>
            </label>
            <textarea
              {...inp('responsibilities')}
              rows={4}
              style={{ border: `1px solid ${errors.responsibilities ? '#ef4444' : '#d1d5db'}`, borderRadius: 6 }}
              className="w-full px-3 py-2 text-sm outline-none resize-none"
              placeholder="- Develop and maintain web applications&#10;- Collaborate with the team..."
            />
            {errors.responsibilities && <p className="text-xs text-red-500 mt-1">{errors.responsibilities}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Requirements <span className="text-red-500">*</span>{' '}
              <span className="text-xs text-gray-400 font-normal">(one per line)</span>
            </label>
            <textarea
              {...inp('requirements')}
              rows={4}
              style={{ border: `1px solid ${errors.requirements ? '#ef4444' : '#d1d5db'}`, borderRadius: 6 }}
              className="w-full px-3 py-2 text-sm outline-none resize-none"
              placeholder="- Degree in Computer Science or related field&#10;- 1+ year experience..."
            />
            {errors.requirements && <p className="text-xs text-red-500 mt-1">{errors.requirements}</p>}
          </div>

          {/* Location & salary */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <select
                {...inp('location')}
                style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                className="w-full px-3 py-2 text-sm outline-none bg-white"
              >
                {LOCATION_OPTIONS.map(l => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Number of Openings</label>
              <input
                type="number"
                min={1}
                {...inp('openings')}
                style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                className="w-full px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Salary Min (₱) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                {...inp('salaryMin')}
                style={{ border: `1px solid ${errors.salaryMin ? '#ef4444' : '#d1d5db'}`, borderRadius: 6 }}
                className="w-full px-3 py-2 text-sm outline-none"
                placeholder="15000"
              />
              {errors.salaryMin && <p className="text-xs text-red-500 mt-1">{errors.salaryMin}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Salary Max (₱) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                {...inp('salaryMax')}
                style={{ border: `1px solid ${errors.salaryMax ? '#ef4444' : '#d1d5db'}`, borderRadius: 6 }}
                className="w-full px-3 py-2 text-sm outline-none"
                placeholder="25000"
              />
              {errors.salaryMax && <p className="text-xs text-red-500 mt-1">{errors.salaryMax}</p>}
            </div>
          </div>

          {/* Job type fields */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
              <select
                {...inp('employmentType')}
                style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                className="w-full px-3 py-2 text-sm outline-none bg-white"
              >
                {EMPLOYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Work Arrangement</label>
              <select
                {...inp('workArrangement')}
                style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                className="w-full px-3 py-2 text-sm outline-none bg-white"
              >
                {WORK_ARRANGEMENTS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Experience Level</label>
              <select
                {...inp('experienceLevel')}
                style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                className="w-full px-3 py-2 text-sm outline-none bg-white"
              >
                {EXPERIENCE_LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                {...inp('category')}
                style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                className="w-full px-3 py-2 text-sm outline-none bg-white"
              >
                {CATEGORIES.map(c => <option key={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Required Skills{' '}
                <span className="text-xs text-gray-400 font-normal">(comma-separated)</span>
              </label>
              <input
                {...inp('skills')}
                style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                className="w-full px-3 py-2 text-sm outline-none"
                placeholder="HTML, CSS, JavaScript"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              style={{ background: '#16a34a', color: '#fff', borderRadius: 6 }}
              className="px-8 py-2.5 text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              Post Job
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

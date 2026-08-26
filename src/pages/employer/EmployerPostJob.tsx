import { useState } from 'react'
import { useApp } from '../../context'
import { ApiRequestError, createEmployerJob, updateEmployerJob as patchEmployerJob } from '../../lib/api'
import { DEFAULT_MAP_CENTER } from '../../config/geo'
import type { EmployerJob } from '../../types'
import { CATEGORIES, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from '../../data'

const WORK_SETUPS = ['On-site', 'Hybrid', 'Remote']

const SPLIT_PATTERN = /[\n,]/

export default function EmployerPostJob() {
  const { employer, addEmployerJob, reloadJobs, navigate, employerJobs, selectedJobId, refreshAccountData } = useApp()
  const editing = employerJobs.find(j => j.id === selectedJobId) ?? null

  const [form, setForm] = useState({
    title: editing?.title ?? '',
    category: editing?.category ?? CATEGORIES[0]?.name ?? 'IT & Software',
    description: editing?.description ?? '',
    requirements: editing?.requirements ?? '',
    employmentType: editing?.employmentType ?? 'Full-time',
    workArrangement: editing?.workArrangement ?? 'On-site',
    experienceLevel: editing?.experienceLevel ?? 'Entry level',
    location: editing?.location ?? '',
    salaryMin: editing?.salaryMin ? String(editing.salaryMin) : '',
    salaryMax: editing?.salaryMax ? String(editing.salaryMax) : '',
    openings: editing?.openings ? String(editing.openings) : '1',
    deadline: editing?.deadline ? String(editing.deadline).slice(0, 10) : '',
    requiredSkills: (editing?.requiredSkills ?? []).join(', '),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const field = (name: keyof typeof form) => ({
    value: form[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm(f => ({ ...f, [name]: e.target.value }))
      setErrors(prev => ({ ...prev, [name]: '' }))
    },
  })

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = 'Job title is required.'
    if (!form.description.trim()) e.description = 'Description is required.'
    if (!form.requirements.trim()) e.requirements = 'Requirements are required.'
    if (!form.location.trim()) e.location = 'Location is required.'
    if (!form.requiredSkills.trim()) e.requiredSkills = 'At least one required skill is needed.'
    if (form.deadline) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (Date.parse(form.deadline) < today.getTime()) {
        e.deadline = 'The deadline cannot be earlier than today.'
      }
    }
    if (!form.salaryMin || isNaN(Number(form.salaryMin))) e.salaryMin = 'Enter a valid minimum salary.'
    if (!form.salaryMax || isNaN(Number(form.salaryMax))) e.salaryMax = 'Enter a valid maximum salary.'
    if (!form.openings || isNaN(Number(form.openings)) || Number(form.openings) < 1) e.openings = 'Enter a valid number of openings.'
    return e
  }

  const handleSubmit = async (isDraft: boolean) => {
    if (!isDraft) {
      const errs = validate()
      if (Object.keys(errs).length > 0) { setErrors(errs); return }
    }

    const salaryMin = Number(form.salaryMin) || 0
    const salaryMax = Number(form.salaryMax) || 0
    const toList = (value: string) =>
      value.split(SPLIT_PATTERN).map(item => item.trim()).filter(Boolean)

    setSubmitting(true)
    try {
      const payload = {
        title: form.title,
        category: form.category,
        description: form.description,
        requirements: toList(form.requirements),
        requiredSkills: toList(form.requiredSkills),
        employmentType: form.employmentType,
        workArrangement: form.workArrangement,
        experienceLevel: form.experienceLevel,
        location: form.location,
        city: 'Angeles City',
        province: 'Pampanga',
        address: form.location,
        salary: salaryMin && salaryMax
          ? `₱${salaryMin.toLocaleString()} - ₱${salaryMax.toLocaleString()}`
          : 'Negotiable',
        salaryMin: salaryMin || null,
        salaryMax: salaryMax || null,
        openings: Number(form.openings) || 1,
        applicationDeadline: form.deadline || null,
        lat: DEFAULT_MAP_CENTER[0],
        lng: DEFAULT_MAP_CENTER[1],
        coordinateSource: 'city-centroid',
        status: isDraft ? 'draft' : 'active',
      }

      if (editing) {
        await patchEmployerJob(editing.id, payload)
        await refreshAccountData()
        if (!isDraft) await reloadJobs()
        setSubmitted(true)
        return
      }

      const job = await createEmployerJob(payload)

      addEmployerJob({
        ...(job as unknown as EmployerJob),
        employerId: employer?.id ?? '',
        requirements: form.requirements,
        deadline: form.deadline,
        applicantCount: 0,
      })
      if (!isDraft) await reloadJobs()
      setSubmitted(true)
    } catch (err) {
      setErrors(
        err instanceof ApiRequestError && Object.keys(err.fields).length > 0
          ? err.fields
          : { title: err instanceof ApiRequestError ? err.message : 'Unable to reach the JobFinder server.' }
      )
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = (err?: string) => ({
    border: `1px solid ${err ? '#ef4444' : '#d1d5db'}`,
    borderRadius: 6,
  })

  const baseInput = 'w-full px-3 py-2.5 text-sm outline-none focus:ring-0'

  if (submitted) {
    return (
      <div style={{ background: '#f9fafb', flex: 1 }} className="flex items-center justify-center px-4">
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12 }} className="w-full max-w-sm p-8 text-center">
          <div style={{ background: '#dcfce7', borderRadius: 999 }} className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">{editing ? 'Job Updated' : 'Job Posted Successfully!'}</h2>
          <p className="text-sm text-gray-500 mb-6">Your job listing is now live and visible to job seekers.</p>
          <div className="flex gap-3">
            <button onClick={() => { setSubmitted(false); setForm({ title: '', category: CATEGORIES[0]?.name ?? '', description: '', requirements: '', employmentType: 'Full-time', workArrangement: 'On-site', experienceLevel: 'Entry level', location: '', salaryMin: '', salaryMax: '', openings: '1', deadline: '', requiredSkills: '' }) }} style={{ border: '1px solid #e5e7eb', borderRadius: 6 }} className="flex-1 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Post Another
            </button>
            <button onClick={() => navigate('employer-jobs')} style={{ background: '#0f2044', color: '#fff', borderRadius: 6 }} className="flex-1 py-2.5 text-sm font-semibold hover:opacity-90">
              My Job Posts
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#f9fafb', flex: 1 }} className="py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Post a Job</h1>
          <p className="text-sm text-gray-500 mt-1">Fill in the details below to publish a job opening.</p>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }} className="p-6 space-y-5">
          {/* Job Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Job Title <span className="text-red-500">*</span></label>
            <input {...field('title')} style={inputStyle(errors.title)} className={baseInput} placeholder="e.g. Junior Web Developer" />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
          </div>

          {/* Company name (display only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name</label>
            <input value={employer?.companyName ?? ''} readOnly style={{ border: '1px solid #e5e7eb', borderRadius: 6, background: '#f9fafb' }} className={baseInput + ' text-gray-500'} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
              <select {...field('category')} style={{ border: '1px solid #d1d5db', borderRadius: 6 }} className="w-full px-3 py-2.5 text-sm outline-none bg-white">
                {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            {/* Experience Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Experience Level</label>
              <select {...field('experienceLevel')} style={{ border: '1px solid #d1d5db', borderRadius: 6 }} className="w-full px-3 py-2.5 text-sm outline-none bg-white">
                {EXPERIENCE_LEVELS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Job Description <span className="text-red-500">*</span></label>
            <textarea
              {...field('description')}
              rows={5}
              style={inputStyle(errors.description)}
              className={baseInput + ' resize-none'}
              placeholder="Describe the role, responsibilities, and what the ideal candidate will be doing day-to-day."
            />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
          </div>

          {/* Requirements */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Requirements <span className="text-red-500">*</span></label>
            <textarea
              {...field('requirements')}
              rows={4}
              style={inputStyle(errors.requirements)}
              className={baseInput + ' resize-none'}
              placeholder="List qualifications, education, and skills required. One per line."
            />
            {errors.requirements && <p className="text-xs text-red-500 mt-1">{errors.requirements}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Required Skills <span className="text-red-500">*</span></label>
            <textarea
              {...field('requiredSkills')}
              rows={2}
              style={inputStyle(errors.requiredSkills)}
              className={baseInput + ' resize-none'}
              placeholder="Separate skills with commas, for example: Customer Service, MS Excel, Cash Handling"
            />
            {errors.requiredSkills && <p className="text-xs text-red-500 mt-1">{errors.requiredSkills}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Employment Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Employment Type</label>
              <select {...field('employmentType')} style={{ border: '1px solid #d1d5db', borderRadius: 6 }} className="w-full px-3 py-2.5 text-sm outline-none bg-white">
                {EMPLOYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            {/* Work Setup */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Work Setup</label>
              <select {...field('workArrangement')} style={{ border: '1px solid #d1d5db', borderRadius: 6 }} className="w-full px-3 py-2.5 text-sm outline-none bg-white">
                {WORK_SETUPS.map(w => <option key={w}>{w}</option>)}
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Location <span className="text-red-500">*</span></label>
            <input {...field('location')} style={inputStyle(errors.location)} className={baseInput} placeholder="e.g. Angeles City, Pampanga" />
            {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location}</p>}
          </div>

          {/* Salary Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Monthly Salary Range (₱) <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-3">
              <input {...field('salaryMin')} type="number" style={inputStyle(errors.salaryMin)} className={baseInput} placeholder="Minimum" />
              <span className="text-gray-400 text-sm flex-shrink-0">to</span>
              <input {...field('salaryMax')} type="number" style={inputStyle(errors.salaryMax)} className={baseInput} placeholder="Maximum" />
            </div>
            {(errors.salaryMin || errors.salaryMax) && <p className="text-xs text-red-500 mt-1">{errors.salaryMin || errors.salaryMax}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Openings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Number of Openings <span className="text-red-500">*</span></label>
              <input {...field('openings')} type="number" min="1" style={inputStyle(errors.openings)} className={baseInput} placeholder="1" />
              {errors.openings && <p className="text-xs text-red-500 mt-1">{errors.openings}</p>}
            </div>
            {/* Deadline */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Application Deadline</label>
              <input
                {...field('deadline')}
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                style={inputStyle(errors.deadline)}
                className={baseInput}
              />
              {errors.deadline && <p className="text-xs text-red-500 mt-1">{errors.deadline}</p>}
            </div>
          </div>

          {/* Actions */}
          <div style={{ borderTop: '1px solid #f3f4f6' }} className="pt-5 flex gap-3">
            <button
              onClick={() => handleSubmit(true)}
              disabled={submitting}
              style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
              className="flex-1 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              style={{ background: '#0f2044', color: '#fff', borderRadius: 6 }}
              className="flex-1 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Post Job'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

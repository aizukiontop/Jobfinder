import { useState, useEffect } from 'react'
import { useApp } from '../context'

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? '#16a34a' : 'none'} stroke={filled ? '#16a34a' : '#6b7280'} strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

export default function JobDetail() {
  const { allJobs, selectedJobId, navigate, prevPage, toggleSave, savedJobIds, hasApplied, user, calculateMatchScore, calculateSkillMatchScore } = useApp()
  const job = allJobs.find(j => j.id === selectedJobId)

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

  const saved = savedJobIds.includes(job.id)
  const applied = hasApplied(job.id)
  const skillScore = user && job ? calculateSkillMatchScore(job) : 0

  // Async Dijkstra-based composite score.
  // No user location is available on this page, so G(a,j) uses the user's
  // stored barangay centroid if present, otherwise G=0 (skill-only score).
  const [matchScore, setMatchScore] = useState<number>(0)
  useEffect(() => {
    if (!user || !job) { setMatchScore(0); return }
    const lat = user.lat ?? undefined
    const lng = user.lng ?? undefined
    calculateMatchScore(job, lat, lng).then(s => setMatchScore(Math.round(s * 100)))
  }, [user, job, calculateMatchScore])

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }} className="px-4 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Back */}
        <button
          onClick={() => navigate('search')}  
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to results
        </button>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10 }} className="p-6 md:p-8">
          {/* Job header */}
          <div className="flex items-start gap-5 mb-6">
            <div
              style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 10 }}
              className="w-16 h-16 flex items-center justify-center flex-shrink-0"
            >
              <BuildingIcon />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-gray-900 mb-1">{job.title}</h1>
                  <p style={{ color: '#16a34a' }} className="text-sm font-semibold">{job.company}</p>
                </div>
                <button
                  onClick={() => toggleSave(job.id)}
                  className="hover:scale-110 transition-transform mt-1"
                >
                  <BookmarkIcon filled={saved} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mt-2">
                {user && matchScore > 0 && (
                  <span
                    style={{
                      background: matchScore >= 70 ? '#dcfce7' : matchScore >= 40 ? '#fef9c3' : '#fee2e2',
                      color: matchScore >= 70 ? '#15803d' : matchScore >= 40 ? '#a16207' : '#b91c1c',
                      borderRadius: 999, fontSize: 12
                    }}
                    className="inline-block px-3 py-1 font-semibold"
                    title={`Skill Match: ${Math.round(skillScore * 100)}%`}
                  >
                    {matchScore}% Match
                  </span>
                )}
                {job.dataSource === 'prototype' && (
                  <span style={{ background: '#fef9c3', color: '#a16207', fontSize: 11, padding: '2px 8px', borderRadius: 999, border: '1px solid #fde047' }}>
                    Sample Data
                  </span>
                )}
                {job.dataSource === 'external-verified' && (
                  <span style={{ background: '#dcfce7', color: '#166534', fontSize: 11, padding: '2px 8px', borderRadius: 999, border: '1px solid #86efac' }}>
                    ✓ Verified Posting
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Meta grid */}
          <div
            style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}
            className="grid grid-cols-2 md:grid-cols-3 gap-4 p-5 mb-6"
          >
            <InfoItem label="Location" value={job.barangay ? `${job.barangay}, Angeles City` : job.city} />
            <InfoItem label="Salary" value={job.salary} />
            <InfoItem label="Employment Type" value={job.employmentType} />
            <InfoItem label="Work Arrangement" value={job.workArrangement} />
            <InfoItem label="Experience Level" value={job.experienceLevel} />
            <InfoItem label="Openings" value={`${job.openings} opening${job.openings !== 1 ? 's' : ''}`} />
            <InfoItem
              label="Date Posted"
              value={
                job.daysAgo === 0
                  ? 'Today'
                  : job.daysAgo === 1
                  ? 'Yesterday'
                  : `${job.daysAgo} days ago`
              }
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mb-8">
            <button
              onClick={() => navigate('apply', job.id)}
              disabled={applied}
              style={{
                background: applied ? '#9ca3af' : '#16a34a',
                color: '#fff',
                borderRadius: 6,
              }}
              className="flex-1 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:cursor-not-allowed"
            >
              {applied ? 'Already Applied' : 'Apply Now'}
            </button>
            <button
              onClick={() => toggleSave(job.id)}
              style={{
                border: `1px solid ${saved ? '#16a34a' : '#d1d5db'}`,
                color: saved ? '#16a34a' : '#374151',
                borderRadius: 6,
              }}
              className="flex-1 py-2.5 text-sm font-semibold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <BookmarkIcon filled={saved} />
              {saved ? 'Saved' : 'Save Job'}
            </button>
          </div>

          {/* Description */}
          <Section title="Job Description">
            <p className="text-sm text-gray-600 leading-relaxed">{job.description}</p>
          </Section>

          {/* Responsibilities */}
          <Section title="Responsibilities">
            <ul className="space-y-2">
              {job.responsibilities.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span style={{ color: '#16a34a', marginTop: 2 }}>•</span>
                  {r}
                </li>
              ))}
            </ul>
          </Section>

          {/* Requirements */}
          <Section title="Requirements">
            <ul className="space-y-2">
              {job.requirements.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span style={{ color: '#16a34a', marginTop: 2 }}>•</span>
                  {r}
                </li>
              ))}
            </ul>
          </Section>

          {/* Benefits */}
          {job.benefits.length > 0 && (
            <Section title="Benefits">
              <ul className="space-y-2">
                {job.benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" style={{ marginTop: 2, flexShrink: 0 }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {b}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Skills */}
          {job.skills.length > 0 && (
            <Section title="Required Skills">
              <div className="flex flex-wrap gap-2">
                {job.skills.map(s => (
                  <span
                    key={s}
                    style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12 }}
                    className="px-3 py-1 text-gray-700 font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderTop: '1px solid #f3f4f6' }} className="pt-5 pb-5">
      <h2 className="font-semibold text-base text-gray-900 mb-3">{title}</h2>
      {children}
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  )
}

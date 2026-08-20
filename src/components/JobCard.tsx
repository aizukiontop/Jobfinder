import { useState, useEffect } from 'react'
import type { Job } from '../types'
import { useApp } from '../context'

interface JobCardProps {
  job: Job
  compact?: boolean
  showMatch?: boolean
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? '#16a34a' : 'none'} stroke={filled ? '#16a34a' : '#9ca3af'} strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function MoneyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  )
}

export default function JobCard({ job, compact = false, showMatch = false }: JobCardProps) {
  const { navigate, toggleSave, savedJobIds, user, calculateMatchScore } = useApp()
  const saved = savedJobIds.includes(job.id)

  // Async Dijkstra-based match score (no location available on Home page — skill-only)
  const [matchScore, setMatchScore] = useState(0)
  useEffect(() => {
    if (!showMatch || !user) { setMatchScore(0); return }
    calculateMatchScore(job).then(s => setMatchScore(Math.round(s * 100)))
  }, [showMatch, user, job, calculateMatchScore])

  const timeLabel = job.daysAgo === 0
    ? 'Just now'
    : job.daysAgo === 1
    ? '1 day ago'
    : `${job.daysAgo} days ago`

  return (
    <div
      style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8 }}
      className="p-4 transition-colors"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3">
          <div
            style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6 }}
            className="w-10 h-10 flex items-center justify-center flex-shrink-0"
          >
            <BuildingIcon />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('jobdetail', job.id)}
                style={{ color: '#111827' }}
                className="font-semibold text-sm hover:underline text-left"
              >
                {job.title}
              </button>
              {showMatch && user && matchScore > 0 && (
                <span
                  style={{ background: '#dcfce7', color: '#15803d', borderRadius: 999, fontSize: 11 }}
                  className="px-2 py-0.5 font-semibold"
                >
                  {matchScore}% Match
                </span>
              )}
            </div>
            <button
              onClick={() => navigate('search')}
              style={{ color: '#16a34a' }}
              className="text-xs font-medium hover:underline"
            >
              {job.company}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <ClockIcon /> {timeLabel}
          </span>
          <button onClick={() => toggleSave(job.id)} className="hover:scale-110 transition-transform">
            <BookmarkIcon filled={saved} />
          </button>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span
          style={{ background: '#f3f4f6', color: '#374151', borderRadius: 4, fontSize: 11 }}
          className="px-2 py-0.5 font-medium"
        >
          {job.workArrangement}
        </span>
        <span
          style={{ background: '#f3f4f6', color: '#374151', borderRadius: 4, fontSize: 11 }}
          className="px-2 py-0.5 font-medium"
        >
          {job.employmentType}
        </span>
        <span
          style={{ background: '#f3f4f6', color: '#374151', borderRadius: 4, fontSize: 11 }}
          className="px-2 py-0.5 font-medium"
        >
          {job.experienceLevel}
        </span>
      </div>

      {/* Description snippet */}
      {!compact && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{job.description}</p>
      )}

      {/* Location + salary */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-4">
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <MapPinIcon /> {job.location}
        </span>
        <span className="text-xs text-gray-700 font-medium flex items-center gap-1">
          <MoneyIcon /> {job.salary}
        </span>
        {job.openings > 1 && (
          <span className="text-xs text-gray-500">{job.openings} openings</span>
        )}
      </div>

      {/* Action */}
      <button
        onClick={() => navigate('jobdetail', job.id)}
        style={{ border: '1px solid #BFDBFE', borderRadius: 6, color: '#374151', background: '#fff' }}
        className="w-full py-2 text-sm font-medium hover:bg-blue-50 transition-colors"
      >
        View Details
      </button>
    </div>
  )
}

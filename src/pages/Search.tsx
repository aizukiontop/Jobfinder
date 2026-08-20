import { useState, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '../context'
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from '../data'
import { BARANGAY_NAMES } from '../data/barangays'
import MapView from '../components/MapView'
import type { Job } from '../types'

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? '#16a34a' : 'none'} stroke={filled ? '#16a34a' : '#9ca3af'} strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function LocationIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

const DATE_OPTIONS = ['Any time', 'Past 24 hours', 'Past week', 'Past month']

export default function Search() {
  const { allJobs, navigate, toggleSave, savedJobIds, searchQuery, setSearchQuery,
          calculateMatchScore, user } = useApp()
  const [localQuery, setLocalQuery] = useState(searchQuery)
  const [dateFilter, setDateFilter] = useState('Any time')
  const [empTypes, setEmpTypes] = useState<string[]>([])
  const [expLevels, setExpLevels] = useState<string[]>([])
  const [barangayFilter, setBarangayFilter] = useState<string>('All Angeles City')
  const [showMap, setShowMap] = useState(true)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const PER_PAGE = 8

  // User geolocation
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [locLoading, setLocLoading] = useState(false)
  // null = not checked yet, true = inside, false = outside Angeles City
  const [userInsideCity, setUserInsideCity] = useState<boolean | null>(null)

  // Dijkstra-based match scores keyed by job.id — computed asynchronously
  // so each card re-renders as its Dijkstra result arrives.
  const [matchScores, setMatchScores] = useState<Record<string, number>>({})
  const [scoresLoading, setScoresLoading] = useState(false)

  useEffect(() => { setLocalQuery(searchQuery) }, [searchQuery])

  const requestLocation = () => {
    if (!navigator.geolocation) return
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setUserLat(lat)
        setUserLng(lng)
        // Boundary check — only pass coordinates to Dijkstra when inside Angeles City
        import('../lib/geo').then(({ isWithinAngelesCity }) => {
          setUserInsideCity(isWithinAngelesCity(lat, lng))
        })
        setLocLoading(false)
      },
      () => setLocLoading(false),
      { timeout: 10000 }
    )
  }

  // Step 1: Filter jobs (synchronous)
  const filtered = useMemo(() => {
    let jobs = [...allJobs]

    // All jobs in allJobs are Angeles City (hard-blocked at import)
    const q = localQuery.toLowerCase().trim()
    if (q) {
      jobs = jobs.filter(
        j =>
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q) ||
          j.category.toLowerCase().includes(q) ||
          (j.requiredSkills ?? j.skills).some(s => s.toLowerCase().includes(q)) ||
          j.description.toLowerCase().includes(q)
      )
    }

    // Barangay filter
    if (barangayFilter !== 'All Angeles City') {
      jobs = jobs.filter(j =>
        j.barangay?.toLowerCase() === barangayFilter.toLowerCase()
      )
    }

    if (dateFilter !== 'Any time') {
      const limit =
        dateFilter === 'Past 24 hours' ? 1
        : dateFilter === 'Past week' ? 7
        : 30
      jobs = jobs.filter(j => j.daysAgo <= limit)
    }
    if (empTypes.length > 0) {
      jobs = jobs.filter(j => empTypes.includes(j.employmentType))
    }
    if (expLevels.length > 0) {
      jobs = jobs.filter(j => expLevels.includes(j.experienceLevel))
    }
    return jobs
  }, [allJobs, localQuery, barangayFilter, dateFilter, empTypes, expLevels])

  // Step 2: Compute Dijkstra-based MatchScores asynchronously whenever
  // the filtered set, user, or location changes. Jobs render immediately
  // (no score shown yet), then re-render as each score arrives.
  const computeScores = useCallback(async () => {
    if (!user) { setMatchScores({}); return }

    const lat = userInsideCity === true ? userLat : null
    const lng = userInsideCity === true ? userLng : null

    setScoresLoading(true)
    const next: Record<string, number> = {}

    // Compute all scores concurrently — Dijkstra runs in the browser so
    // Promise.all just queues microtasks; road graph is cached after first load.
    await Promise.all(
      filtered.map(async job => {
        const score = await calculateMatchScore(
          job,
          lat ?? undefined,
          lng ?? undefined
        )
        next[job.id] = score
      })
    )

    setMatchScores(next)
    setScoresLoading(false)
  }, [filtered, user, userInsideCity, userLat, userLng, calculateMatchScore])

  useEffect(() => { computeScores() }, [computeScores])

  // Step 3: Sort filtered jobs by MatchScore descending (thesis core output).
  // When no user is logged in, preserve dataset order.
  const sorted = useMemo(() => {
    if (!user || Object.keys(matchScores).length === 0) return filtered
    return [...filtered].sort(
      (a, b) => (matchScores[b.id] ?? 0) - (matchScores[a.id] ?? 0)
    )
  }, [filtered, matchScores, user])

  const totalPages = Math.ceil(sorted.length / PER_PAGE)
  const paginated = sorted.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)
  const selectedJob = sorted.find(j => j.id === selectedJobId) ?? null

  const toggleEmpType = (t: string) =>
    setEmpTypes(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]))
  const toggleExpLevel = (l: string) =>
    setExpLevels(prev => (prev.includes(l) ? prev.filter(x => x !== l) : [...prev, l]))
  const handleSearch = () => { setSearchQuery(localQuery); setCurrentPage(1) }

  return (
    <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
      {/* Search bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb' }} className="px-4 py-3">
        {userInsideCity === false && (
        <div style={{ background: '#fef3c7', borderBottom: '1px solid #fde68a', padding: '8px 16px' }}>
          <div className="max-w-7xl mx-auto flex items-center gap-2" style={{ fontSize: 13, color: '#92400e' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>
              <strong>Your location is outside Angeles City.</strong> Distance-based matching is unavailable, but you can still browse and apply for Angeles City jobs.
            </span>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto flex flex-wrap gap-2 items-center">
          <div style={{ border: '1px solid #d1d5db', borderRadius: 6 }} className="flex items-center px-3 gap-2 flex-1 min-w-48">
            <span className="text-gray-400"><SearchIcon /></span>
            <input
              value={localQuery}
              onChange={e => setLocalQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Job title, skills, or company"
              className="flex-1 py-2 text-sm outline-none text-gray-800 placeholder-gray-400"
            />
          </div>
          <button
            onClick={handleSearch}
            style={{ background: '#16a34a', color: '#fff', borderRadius: 6 }}
            className="px-5 py-2 text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            Find
          </button>
          <button
            onClick={requestLocation}
            disabled={locLoading}
            title="Use my location for route calculation"
            style={{
              border: `1px solid ${userInsideCity === true ? '#16a34a' : userInsideCity === false ? '#f59e0b' : '#d1d5db'}`,
              borderRadius: 6,
              color: userInsideCity === true ? '#16a34a' : userInsideCity === false ? '#92400e' : '#374151',
              background: userInsideCity === true ? '#f0fdf4' : userInsideCity === false ? '#fef3c7' : '#fff',
            }}
            className="px-4 py-2 text-sm font-medium flex items-center gap-2 hover:bg-gray-50"
          >
            <LocationIcon />
            {locLoading ? 'Locating…' : userInsideCity === true ? 'Located ✓' : userInsideCity === false ? 'Outside Area' : 'My Location'}
          </button>
          <button
            onClick={() => setShowMap(v => !v)}
            style={{
              border: `1px solid ${showMap ? '#16a34a' : '#d1d5db'}`,
              borderRadius: 6,
              color: showMap ? '#16a34a' : '#374151',
              background: showMap ? '#f0fdf4' : '#fff',
            }}
            className="px-4 py-2 text-sm font-medium flex items-center gap-2 hover:bg-gray-50"
          >
            <MapIcon /> Map
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col lg:flex-row gap-4">
        {/* Filters sidebar */}
        <aside
          style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}
          className="w-52 flex-shrink-0 p-4 self-start hidden md:block"
        >
          {/* Barangay filter */}
          <div className="mb-5">
            <div className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1">
              <LocationIcon />
              <span>Barangay</span>
            </div>
            <select
              value={barangayFilter}
              onChange={e => { setBarangayFilter(e.target.value); setCurrentPage(1) }}
              style={{ border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}
              className="w-full px-2 py-1.5 outline-none text-gray-700 bg-white"
            >
              <option value="All Angeles City">All Angeles City</option>
              {BARANGAY_NAMES.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Date Posted */}
          <div style={{ borderTop: '1px solid #e5e7eb' }} className="pt-4 mb-5">
            <div className="text-sm font-semibold text-gray-800 mb-3">Date Posted</div>
            <div className="space-y-2">
              {DATE_OPTIONS.map(opt => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="date"
                    checked={dateFilter === opt}
                    onChange={() => { setDateFilter(opt); setCurrentPage(1) }}
                    style={{ accentColor: '#16a34a' }}
                  />
                  <span className="text-sm text-gray-600">{opt}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e5e7eb' }} className="pt-4 mb-5">
            <div className="text-sm font-semibold text-gray-800 mb-3">Employment Type</div>
            <div className="space-y-2">
              {EMPLOYMENT_TYPES.map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={empTypes.includes(t)}
                    onChange={() => { toggleEmpType(t); setCurrentPage(1) }}
                    style={{ accentColor: '#16a34a' }}
                  />
                  <span className="text-sm text-gray-600">{t}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e5e7eb' }} className="pt-4">
            <div className="text-sm font-semibold text-gray-800 mb-3">Experience Level</div>
            <div className="space-y-2">
              {EXPERIENCE_LEVELS.map(l => (
                <label key={l} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={expLevels.includes(l)}
                    onChange={() => { toggleExpLevel(l); setCurrentPage(1) }}
                    style={{ accentColor: '#16a34a' }}
                  />
                  <span className="text-sm text-gray-600">{l}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-base text-gray-800">
              {barangayFilter !== 'All Angeles City'
                ? `Jobs in ${barangayFilter}`
                : localQuery ? `${localQuery} Jobs in Angeles City` : 'All Jobs — Angeles City'}
            </h2>
            <div className="flex items-center gap-2">
              {scoresLoading && user && (
                <span style={{ fontSize: 11, color: '#9ca3af' }}>Calculating matches…</span>
              )}
              <span className="text-sm text-gray-500">{sorted.length.toLocaleString()} results</span>
            </div>
          </div>

          <div className="space-y-2">
            {paginated.map(job => (
              <SearchJobRow
                key={job.id}
                job={job}
                selected={selectedJobId === job.id}
                saved={savedJobIds.includes(job.id)}
                matchScore={user ? (matchScores[job.id] ?? null) : null}
                onSelect={() => setSelectedJobId(job.id === selectedJobId ? null : job.id)}
                onToggleSave={() => toggleSave(job.id)}
                onViewDetails={() => navigate('jobdetail', job.id)}
              />
            ))}
            {sorted.length === 0 && (
              <div className="text-center py-16 text-gray-400 text-sm">
                No jobs found. Try adjusting your search or filters.
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 mt-6">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                style={{ border: '1px solid #e5e7eb', borderRadius: 6 }}
                className="px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50"
              >
                Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  style={{
                    border: `1px solid ${p === currentPage ? '#0f2044' : '#e5e7eb'}`,
                    background: p === currentPage ? '#0f2044' : '#fff',
                    color: p === currentPage ? '#fff' : '#374151',
                    borderRadius: 6,
                  }}
                  className="w-8 h-8 text-sm font-medium"
                >
                  {p}
                </button>
              ))}
              {totalPages > 5 && <span className="text-gray-400 text-sm px-1">…</span>}
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                style={{ border: '1px solid #e5e7eb', borderRadius: 6 }}
                className="px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Map */}
        {showMap && (
          <div style={{ width: '100%', maxWidth: 380, flexShrink: 0 }} className="block lg:w-[380px]">
            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              overflow: 'hidden',
              height: 500,
              position: 'sticky',
              top: 70,
            }}>
              <MapView
                jobs={sorted}
                selectedJobId={selectedJobId}
                onSelectJob={id => setSelectedJobId(id === selectedJobId ? null : id)}
                userLat={userInsideCity === true ? userLat : null}
                userLng={userInsideCity === true ? userLng : null}
              />
            </div>

            {selectedJob && (
              <div
                style={{ border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', marginTop: 8 }}
                className="p-4"
              >
                <div className="flex items-start gap-3 mb-2">
                  <div style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6 }}
                    className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                    <BuildingIcon />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <p className="font-semibold text-sm text-gray-900 leading-tight">{selectedJob.title}</p>
                      <button onClick={() => toggleSave(selectedJob.id)}>
                        <BookmarkIcon filled={savedJobIds.includes(selectedJob.id)} />
                      </button>
                    </div>
                    <p style={{ color: '#16a34a' }} className="text-xs font-medium">{selectedJob.company}</p>
                    <p className="text-xs text-gray-500">
                      {selectedJob.barangay ?? selectedJob.city} • {selectedJob.salary}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{selectedJob.description}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate('apply', selectedJob.id)}
                    style={{ background: '#16a34a', color: '#fff', borderRadius: 6 }}
                    className="flex-1 py-2 text-sm font-semibold hover:bg-green-700"
                  >
                    Apply Now
                  </button>
                  <button
                    onClick={() => navigate('jobdetail', selectedJob.id)}
                    style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                    className="flex-1 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    View Details
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SearchJobRow({
  job, selected, saved, matchScore,
  onSelect, onToggleSave, onViewDetails,
}: {
  job: Job
  selected: boolean
  saved: boolean
  matchScore: number | null
  onSelect: () => void
  onToggleSave: () => void
  onViewDetails: () => void
}) {
  const matchPct = matchScore != null ? Math.round(matchScore * 100) : null
  const matchColor =
    matchPct == null ? '#9ca3af'
    : matchPct >= 70 ? '#16a34a'
    : matchPct >= 40 ? '#d97706'
    : '#dc2626'

  return (
    <div
      onClick={onSelect}
      style={{
        background: '#fff',
        border: `1px solid ${selected ? '#16a34a' : '#e5e7eb'}`,
        borderRadius: 8,
        cursor: 'pointer',
      }}
      className="p-4 hover:border-gray-300 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6 }}
          className="w-10 h-10 flex items-center justify-center flex-shrink-0">
          <BuildingIcon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <button
                onClick={e => { e.stopPropagation(); onViewDetails() }}
                className="font-semibold text-sm text-gray-900 hover:underline text-left"
              >
                {job.title}
              </button>
              <p style={{ color: '#16a34a' }} className="text-xs font-medium">{job.company}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {matchPct != null && (
                <span style={{ color: matchColor, fontSize: 11, fontWeight: 600 }}>
                  {matchPct}% match
                </span>
              )}
              <span className="text-xs text-gray-400">
                {job.daysAgo === 0 ? 'Just now' : job.daysAgo === 1 ? '1d ago' : `${job.daysAgo}d ago`}
              </span>
              <button
                onClick={e => { e.stopPropagation(); onToggleSave() }}
                className="hover:scale-110 transition-transform"
              >
                <BookmarkIcon filled={saved} />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 items-center">
            <span className="text-xs text-gray-500">
              📍 {job.barangay ?? job.city}, Angeles City ({job.workArrangement})
            </span>
            <span className="text-xs text-gray-600 font-medium">{job.salary}</span>
            {job.dataSource === 'prototype' && (
              <span style={{ background: '#fef9c3', color: '#a16207', fontSize: 10, padding: '1px 5px', borderRadius: 3, border: '1px solid #fde047' }}>
                Sample
              </span>
            )}
            {job.dataSource === 'external-verified' && (
              <span style={{ background: '#dcfce7', color: '#166534', fontSize: 10, padding: '1px 5px', borderRadius: 3, border: '1px solid #86efac' }}>
                ✓ Verified
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

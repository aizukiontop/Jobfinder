import { useState, useEffect } from 'react'
import { useApp } from '../context'
import { CATEGORIES } from '../data'
import JobCard from '../components/JobCard'
import angelesBackground from '../assets/angeles-background.png'

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function TrendingIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

export default function Home() {
  const { allJobs, navigate, setSearchQuery, user, calculateMatchScore } = useApp()
  const [query, setQuery] = useState('')

  const handleSearch = () => {
    setSearchQuery(query)
    navigate('search')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }


  // Async Dijkstra-based featured jobs — sorted by MatchScore when user is logged in.
  // No location passed here (Home page has no GPS widget), so G uses stored user coords.
  const [featuredJobs, setFeaturedJobs] = useState(allJobs.slice(0, 4))
  useEffect(() => {
    if (!user) { setFeaturedJobs(allJobs.slice(0, 4)); return }
    const lat = user.lat ?? undefined
    const lng = user.lng ?? undefined
    Promise.all(
      allJobs.map(async j => ({ job: j, score: await calculateMatchScore(j, lat, lng) }))
    ).then(scored => {
      setFeaturedJobs(
        scored.sort((a, b) => b.score - a.score).slice(0, 4).map(x => x.job)
      )
    })
  }, [user, allJobs, calculateMatchScore])

  const categoryCounts = CATEGORIES.map(cat => ({
    ...cat,
    count: allJobs.filter(j => j.category === cat.name).length,
  }))

  return (
    <div>
      {/* Hero */}
        <div
        style={{
          backgroundImage: `url(${angelesBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          position: 'relative',
          overflow: 'hidden',
          minHeight: 320,
        }}
        className="flex items-center justify-center py-12 sm:py-16 px-4 min-h-[390px] sm:min-h-[320px]"
      >
        <div className="relative z-10 text-center max-w-2xl w-full">
          <h1
            style={{ color: '#fff', lineHeight: 1.1 }}
            className="text-4xl md:text-5xl font-extrabold mb-4"
          >
            Your skills. Your place. Your next job.
          </h1>

          <p
            className="text-sm md:text-base mb-6"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            Connect with local employers and discover roles
            <br />
            that match your skills, experience, and career goals.
          </p>

          {/* Search bar */}
          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
            }}
            className="flex items-center max-w-xl mx-auto mb-4 overflow-hidden"
          >
            <div className="pl-4 text-gray-400">
              <SearchIcon />
            </div>

            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              type="text"
              placeholder="Job title, skills, or company"
              className="flex-1 px-3 py-3 text-sm outline-none text-gray-800 placeholder-gray-400"
            />

            <button
              onClick={handleSearch}
              style={{
                background: '#16a34a',
                color: '#fff',
                borderRadius: 0,
              }}
              className="px-6 py-3 text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              Search
            </button>
          </div>

          
       
        </div>
      </div>

      {/* Main content */}
      <div
        style={{ background: '#f9fafb' }}
        className="py-10 px-4"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-6 items-start">
            {/* Featured jobs */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="font-bold text-lg"
                  style={{ color: '#111827' }}
                >
                  Featured Jobs for You
                </h2>

                <button
                  onClick={() => navigate('search')}
                  style={{ color: '#16a34a' }}
                  className="text-sm font-medium flex items-center gap-1 hover:underline"
                >
                  View all <ChevronRightIcon />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {featuredJobs.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    showMatch={!!user}
                  />
                ))}
              </div>
            </div>

            {/* Sidebar */}
            <div className="w-72 flex-shrink-0 hidden lg:block space-y-4">
              {/* Local Insights */}
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                }}
                className="p-5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <TrendingIcon />

                  <h3
                    className="font-semibold text-sm"
                    style={{ color: '#111827' }}
                  >
                    Local Insights
                  </h3>
                </div>

                <p className="text-xs text-gray-500 mb-3">
                  JobFinder focuses on employment opportunities around Angeles
                  City using local employment information.
                </p>

                <button
                  style={{ color: '#16a34a' }}
                  className="text-xs font-medium hover:underline flex items-center gap-1"
                >
                  Read about our data <ChevronRightIcon />
                </button>
              </div>

              {/* Browse by Category */}
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                }}
                className="p-5"
              >
                <h3
                  className="font-semibold text-sm mb-3"
                  style={{ color: '#111827' }}
                >
                  Browse by Category
                </h3>

                <div className="space-y-2">
                  {categoryCounts.map(cat => (
                    <button
                      key={cat.name}
                      onClick={() => {
                        setSearchQuery(cat.name)
                        navigate('search')
                      }}
                      className="w-full flex items-center justify-between text-sm hover:text-green-700 group"
                    >
                      <span
                        style={{ color: '#374151' }}
                        className="group-hover:text-green-700"
                      >
                        {cat.name}
                      </span>

                      <span
                        style={{
                          background: '#f3f4f6',
                          borderRadius: 999,
                          fontSize: 11,
                          minWidth: 22,
                        }}
                        className="px-2 py-0.5 text-center text-gray-600 font-medium"
                      >
                        {cat.count}
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => navigate('search')}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    color: '#374151',
                  }}
                  className="w-full mt-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  All Categories
                </button>
              </div>

              {/* Get discovered CTA */}
              <div
                style={{
                  background: '#0f2044',
                  borderRadius: 8,
                  position: 'relative',
                  overflow: 'hidden',
                }}
                className="p-5"
              >
                {/* Background person figure */}
                <div
                  style={{
                    position: 'absolute',
                    right: -30,
                    bottom: -55,
                    opacity: 0.12,
                    color: '#ffffff',
                    zIndex: 0,
                  }}
                >
                  <svg
                    width="170"
                    height="170"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <circle cx="12" cy="7" r="3.5" />
                    <path d="M5 21c0-4.2 3.1-7 7-7s7 2.8 7 7" />
                  </svg>
                </div>

                {/* Card content */}
                <div
                  style={{
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  <h3 className="font-bold text-white text-base mb-2">
                    Browse verified listings
                  </h3>

                  <p
                    className="text-xs mb-4"
                    style={{ color: 'rgba(255,255,255,0.7)' }}
                  >
                    Review current opportunities and apply through each verified source.
                  </p>

                  <button
                    onClick={() => navigate('search')}
                    style={{
                      background: '#16a34a',
                      color: '#fff',
                      borderRadius: 6,
                    }}
                    className="w-full py-2 text-sm font-semibold hover:bg-green-700 transition-colors"
                  >
                    Search Jobs
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer
        style={{
          background: '#fff',
          borderTop: '1px solid #e5e7eb',
        }}
        className="py-6 px-4"
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-400">
            © 2026 JobFinder. All rights reserved.
          </p>

          <div className="flex gap-4">
            {['Terms', 'Privacy', 'Accessibility', 'Contact'].map(l => (
              <button
                key={l}
                style={{ color: '#16a34a' }}
                className="text-xs hover:underline"
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}

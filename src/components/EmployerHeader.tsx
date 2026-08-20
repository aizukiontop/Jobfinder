import { useApp } from '../context'
import type { Page } from '../types'
import jobfinderLogo from '../assets/jobfinder-logo.png'

export default function EmployerHeader() {
  const { page, navigate, employer, setEmployer } = useApp()

  const navItems: { label: string; page: Page }[] = [
    { label: 'Dashboard', page: 'employer-dashboard' },
    { label: 'My Job Posts', page: 'employer-jobs' },
    { label: 'Post a Job', page: 'employer-post' },
    { label: 'Applicants', page: 'employer-applicants' },
    { label: 'Company Profile', page: 'employer-profile' },
  ]

  return (
    <header
      style={{
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
      }}
      className="sticky top-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-4 flex items-center h-14 gap-6">

        {/* Logo */}
        <button
          onClick={() => navigate('employer-dashboard')}
          className="flex items-center gap-2 flex-shrink-0"
        >
          <img
            src={jobfinderLogo}
            alt="JobFinder"
            className="w-8 h-8 object-contain"
          />

          <span
            style={{ color: '#0f2044' }}
            className="font-semibold text-base hidden sm:block"
          >
            JobFinder
          </span>

          <span
            style={{
              background: '#f0fdf4',
              color: '#16a34a',
              borderRadius: 4,
              fontSize: 11,
            }}
            className="px-2 py-0.5 font-semibold hidden sm:block"
          >
            Employer
          </span>
        </button>

        {/* Nav */}
        <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
          {navItems.map(item => {
            const active = page === item.page

            return (
              <button
                key={item.page}
                onClick={() => navigate(item.page)}
                style={{
                  color: active ? '#0f2044' : '#374151',
                  background: active ? '#f3f4f6' : 'transparent',
                  borderRadius: 6,
                  whiteSpace: 'nowrap',
                }}
                className="px-3 py-1.5 text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3 flex-shrink-0">

          {/* Notification bell */}
          <button className="relative text-gray-500 hover:text-gray-700">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>

            <span
              style={{
                background: '#16a34a',
                color: '#fff',
                borderRadius: 999,
                fontSize: 10,
                top: -4,
                right: -4,
              }}
              className="absolute w-4 h-4 flex items-center justify-center font-bold leading-none"
            >
              2
            </span>
          </button>

          {/* Company avatar + name */}
          <div className="flex items-center gap-2">

            <div
              style={{
                background: '#0f2044',
                color: '#fff',
                borderRadius: 6,
              }}
              className="w-7 h-7 flex items-center justify-center font-bold text-xs flex-shrink-0"
            >
              {employer?.companyName.charAt(0) ?? 'E'}
            </div>

            <span className="text-sm font-medium text-gray-700 hidden md:block max-w-32 truncate">
              {employer?.companyName ?? 'Employer'}
            </span>

          </div>

          {/* Sign Out */}
          <button
            onClick={() => {
              setEmployer(null)
              navigate('home')
            }}
            className="text-sm font-medium text-gray-500 hover:text-gray-800"
          >
            Sign Out
          </button>

        </div>
      </div>
    </header>
  )
}
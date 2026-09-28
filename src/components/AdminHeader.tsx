import { useApp } from '../context'
import type { Page } from '../types'
import jobfinderLogo from '../assets/jobfinder-logo.png'

export default function AdminHeader() {
  const { page, navigate, adminProfile, signOut } = useApp()

  const navItems: { label: string; page: Page }[] = [
    { label: 'Dashboard', page: 'admin' },
    { label: 'Job Postings', page: 'admin-postings' },
    { label: 'Employers', page: 'admin-employers' },
    { label: 'Job Seekers', page: 'admin-seekers' },
    { label: 'Activity Logs', page: 'admin-logs' },
    { label: 'Public Site', page: 'search' },
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
        <button
          onClick={() => navigate('admin')}
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
              background: '#eff6ff',
              color: '#1d4ed8',
              borderRadius: 4,
              fontSize: 11,
            }}
            className="px-2 py-0.5 font-semibold hidden sm:block"
          >
            PESO Admin
          </span>
        </button>

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

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div
              style={{
                background: '#1d4ed8',
                color: '#fff',
                borderRadius: 6,
              }}
              className="w-7 h-7 flex items-center justify-center font-bold text-xs flex-shrink-0"
            >
              P
            </div>
            <span className="text-sm font-medium text-gray-700 hidden md:block max-w-40 truncate">
              {adminProfile?.officeName ?? 'PESO Angeles City'}
            </span>
          </div>
          <button
            onClick={async () => {
              await signOut()
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

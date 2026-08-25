import { useState } from 'react'
import jobfinderLogo from '../assets/jobfinder-logo.png'
import { useApp } from '../context'
import type { Page } from '../types'

const NAV_ITEMS: { label: string; page: Page }[] = [
  { label: 'Home', page: 'home' },
  { label: 'Search Jobs', page: 'search' },
]

export default function Header() {
  const { page, navigate } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleNavigate = (targetPage: Page) => {
    navigate(targetPage)
    setMenuOpen(false)
  }

  return (
    <>
      <header
        style={{ background: '#fff', borderBottom: '1px solid #e5e7eb' }}
        className="sticky top-0 z-50"
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <button
            type="button"
            onClick={() => handleNavigate('home')}
            className="flex flex-shrink-0 items-center gap-2"
          >
            <img
              src={jobfinderLogo}
              alt="JobFinder Logo"
              className="h-16 w-16 object-contain"
            />
            <span style={{ color: '#0f2044' }} className="text-base font-semibold">
              JobFinder
            </span>
          </button>

          <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Primary">
            {NAV_ITEMS.map(item => (
              <button
                type="button"
                key={item.page}
                onClick={() => handleNavigate(item.page)}
                style={{
                  color: page === item.page ? '#0f2044' : '#374151',
                  background: page === item.page ? '#f3f4f6' : 'transparent',
                  borderRadius: 6,
                }}
                className="px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-100"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <span className="hidden text-xs font-medium text-gray-500 md:inline">
            Verified listings only
          </span>

          <button
            type="button"
            onClick={() => setMenuOpen(open => !open)}
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-md hover:bg-gray-100 md:hidden"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span aria-hidden="true" className="space-y-1.5">
              <span className="block h-0.5 w-5 bg-gray-700" />
              <span className="block h-0.5 w-5 bg-gray-700" />
              <span className="block h-0.5 w-5 bg-gray-700" />
            </span>
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-gray-200 bg-white md:hidden">
            <nav className="px-4 py-2" aria-label="Mobile primary">
              {NAV_ITEMS.map(item => (
                <button
                  type="button"
                  key={item.page}
                  onClick={() => handleNavigate(item.page)}
                  style={{
                    color: page === item.page ? '#0f2044' : '#374151',
                    background: page === item.page ? '#f3f4f6' : 'transparent',
                  }}
                  className="w-full rounded-md px-3 py-3 text-left text-sm font-medium"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        )}
      </header>

      <aside
        className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900"
        aria-label="Public preview notice"
      >
        Temporary public preview: verified listings are available; accounts and
        JobFinder applications are not yet available.
      </aside>
    </>
  )
}

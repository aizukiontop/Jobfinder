import { useState } from 'react'
import { useApp } from '../context'
import type { Page } from '../types'
import jobfinderLogo from '../assets/jobfinder-logo.png'

export default function Header() {
  const { page, navigate, user, setUser, savedJobIds, applications } = useApp()
  const [menuOpen, setMenuOpen] = useState(false)

  const navItems: { label: string; page: Page }[] = [
    { label: 'Home', page: 'home' },
    { label: 'Search Jobs', page: 'search' },
    { label: 'Saved Jobs', page: 'saved' },
    { label: 'Applications', page: 'applications' },
    { label: 'Profile', page: 'profile' },
  ]

  const handleNavigate = (targetPage: Page) => {
    navigate(targetPage)
    setMenuOpen(false)
  }

  return (
    <header
      style={{ background: '#fff', borderBottom: '1px solid #e5e7eb' }}
      className="sticky top-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-4 flex items-center h-14 gap-6">
        {/* Logo */}
        <button
          onClick={() => handleNavigate('home')}
          className="flex items-center gap-2 flex-shrink-0"
        >
          <img
            src={jobfinderLogo}
            alt="JobFinder Logo"
            className="w-16 h-16 object-contain"
          />

          <span
            style={{ color: '#0f2044' }}
            className="font-semibold text-base"
          >
            JobFinder
          </span>
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
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
                }}
                className="px-3 py-1.5 text-sm font-medium hover:bg-gray-100 transition-colors flex items-center gap-1"
              >
                {item.label}

                {item.page === 'saved' && savedJobIds.length > 0 && (
                  <span
                    style={{
                      background: '#16a34a',
                      color: '#fff',
                      borderRadius: 999,
                      fontSize: 11,
                    }}
                    className="px-1.5 py-0.5 font-semibold leading-none"
                  >
                    {savedJobIds.length}
                  </span>
                )}

                {item.page === 'applications' && applications.length > 0 && (
                  <span
                    style={{
                      background: '#0f2044',
                      color: '#fff',
                      borderRadius: 999,
                      fontSize: 11,
                    }}
                    className="px-1.5 py-0.5 font-semibold leading-none"
                  >
                    {applications.length}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Desktop Right Side */}
        <div className="hidden md:flex items-center gap-3 flex-shrink-0">
          {user ? (
            <>
              <span className="text-sm text-gray-500">
                Welcome back,{' '}
                <span
                  style={{ color: '#0f2044' }}
                  className="font-medium"
                >
                  {user.firstName}
                </span>
              </span>

              <button
                onClick={() => setUser(null)}
                className="text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <span className="text-sm text-gray-500">
                Browsing as Guest
              </span>

              <button
                onClick={() => navigate('signin')}
                style={{
                  background: '#0f2044',
                  color: '#fff',
                  borderRadius: 6,
                }}
                className="px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Sign In
              </button>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden ml-auto w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-100"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <div className="space-y-1.5">
            <span className="block w-5 h-0.5 bg-gray-700"></span>
            <span className="block w-5 h-0.5 bg-gray-700"></span>
            <span className="block w-5 h-0.5 bg-gray-700"></span>
          </div>
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <nav className="px-4 py-2">
            {navItems.map(item => {
              const active = page === item.page

              return (
                <button
                  key={item.page}
                  onClick={() => handleNavigate(item.page)}
                  style={{
                    color: active ? '#0f2044' : '#374151',
                    background: active ? '#f3f4f6' : 'transparent',
                  }}
                  className="w-full text-left px-3 py-3 rounded-md text-sm font-medium flex items-center justify-between"
                >
                  <span>{item.label}</span>

                  {item.page === 'saved' && savedJobIds.length > 0 && (
                    <span
                      style={{
                        background: '#16a34a',
                        color: '#fff',
                        borderRadius: 999,
                        fontSize: 11,
                      }}
                      className="px-1.5 py-0.5 font-semibold"
                    >
                      {savedJobIds.length}
                    </span>
                  )}

                  {item.page === 'applications' &&
                    applications.length > 0 && (
                      <span
                        style={{
                          background: '#0f2044',
                          color: '#fff',
                          borderRadius: 999,
                          fontSize: 11,
                        }}
                        className="px-1.5 py-0.5 font-semibold"
                      >
                        {applications.length}
                      </span>
                    )}
                </button>
              )
            })}

            <div className="border-t border-gray-200 mt-2 pt-2 pb-2">
              {user ? (
                <>
                  <div className="px-3 py-2 text-sm text-gray-500">
                    Welcome back,{' '}
                    <span
                      style={{ color: '#0f2044' }}
                      className="font-medium"
                    >
                      {user.firstName}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setUser(null)
                      setMenuOpen(false)
                    }}
                    className="w-full text-left px-3 py-3 text-sm font-medium text-gray-700"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <div className="px-3 py-2 text-sm text-gray-500">
                    Browsing as Guest
                  </div>

                  <button
                    onClick={() => handleNavigate('signin')}
                    style={{
                      background: '#0f2044',
                      color: '#fff',
                      borderRadius: 6,
                    }}
                    className="w-full px-3 py-2.5 text-sm font-semibold"
                  >
                    Sign In
                  </button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
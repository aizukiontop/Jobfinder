import { useState } from 'react'
import { useApp } from '../context'
import { ApiRequestError } from '../lib/api'
import jobfinderLogo from '../assets/jobfinder-logo.png'

export default function SignIn() {
  const { navigate, signIn } = useApp()

  const [email, setEmail] =
    useState('')

  const [password, setPassword] =
    useState('')

  const [rememberMe, setRememberMe] =
    useState(false)

  const [error, setError] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setError('')
    setLoading(true)

    try {
      const role = await signIn(email, password, rememberMe)
      navigate(role === 'employer' ? 'employer-dashboard' : 'home')
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : 'Unable to reach the JobFinder server. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        background: '#f9fafb',
        minHeight: '100vh',
      }}
      className="flex items-center justify-center px-4 py-12"
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
        }}
        className="w-full max-w-sm p-8"
      >
        <div className="flex justify-center mb-6">
          <img
            src={jobfinderLogo}
            alt="JobFinder Logo"
            className="w-16 h-16 object-contain"
          />
        </div>

        <h1 className="text-xl font-bold text-center text-gray-900 mb-1">
          Sign in to your account
        </h1>

        <p className="text-sm text-center text-gray-500 mb-6">
          Or{' '}
          <button
            onClick={() =>
              navigate('register')
            }
            style={{
              color: '#16a34a',
            }}
            className="font-medium hover:underline"
          >
            create a new account
          </button>
        </p>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 6,
            }}
            className="px-4 py-3 mb-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>

            <input
              type="email"
              value={email}
              onChange={e =>
                setEmail(e.target.value)
              }
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 text-sm outline-none text-gray-800"
              style={{
                border: '1px solid #d1d5db',
                borderRadius: 6,
              }}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={e =>
                setPassword(e.target.value)
              }
              placeholder="••••••••"
              className="w-full px-3 py-2.5 text-sm outline-none text-gray-800"
              style={{
                border: '1px solid #d1d5db',
                borderRadius: 6,
              }}
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e =>
                  setRememberMe(
                    e.target.checked
                  )
                }
                style={{
                  accentColor: '#16a34a',
                }}
              />

              <span className="text-sm text-gray-600">
                Remember me
              </span>
            </label>

            <button
              type="button"
              style={{
                color: '#16a34a',
              }}
              className="text-sm font-medium hover:underline"
            >
              Forgot your password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: '#0f2044',
              color: '#fff',
              borderRadius: 6,
            }}
            className="w-full py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {loading
              ? 'Signing in...'
              : 'Sign in'}
          </button>
        </form>

        {/* Demo employer account */}

        <div
          style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
          }}
          className="mt-6 p-3"
        >
          <p className="text-xs font-semibold text-gray-700 mb-1">
            Employer Demo
          </p>

          <p className="text-xs text-gray-500">
            hr@premiertechph.com
          </p>

          <p className="text-xs text-gray-500">
            Password: demo123
          </p>
        </div>
      </div>
    </div>
  )
}
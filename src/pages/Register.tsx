import { useState } from 'react'
import { useApp } from '../context'
import PasswordField from '../components/PasswordField'
import { ApiRequestError } from '../lib/api'
import type { UserRole } from '../types'

export default function Register() {
  const { navigate, signUp } = useApp()

  const [role, setRole] =
    useState<UserRole>('job-seeker')

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    companyName: '',
    industry: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  const [errors, setErrors] =
    useState<Record<string, string>>({})

  const [loading, setLoading] =
    useState(false)

  const validate = () => {
    const e: Record<string, string> = {}

    if (role === 'job-seeker') {
      if (!form.firstName.trim())
        e.firstName = 'First name is required.'

      if (!form.lastName.trim())
        e.lastName = 'Last name is required.'
    }

    if (role === 'employer') {
      if (!form.companyName.trim())
        e.companyName = 'Company name is required.'

      if (!form.industry.trim())
        e.industry = 'Industry is required.'
    }

    if (!form.email.trim()) {
      e.email = 'Email is required.'
    } else if (
      !/\S+@\S+\.\S+/.test(form.email)
    ) {
      e.email = 'Enter a valid email address.'
    }

    if (!form.password) {
      e.password = 'Password is required.'
    } else if (
      form.password.length < 6
    ) {
      e.password =
        'Password must be at least 6 characters.'
    }

    if (!form.confirmPassword) {
      e.confirmPassword =
        'Please confirm your password.'
    } else if (
      form.password !== form.confirmPassword
    ) {
      e.confirmPassword =
        'Passwords do not match.'
    }

    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const errs = validate()

    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setLoading(true)

    try {
      if (role === 'job-seeker') {
        await signUp({
          role: 'job-seeker',
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
        })
        navigate('profile')
      } else {
        await signUp({
          role: 'employer',
          email: form.email,
          password: form.password,
          companyName: form.companyName,
          industry: form.industry,
          contactName:
            `${form.firstName} ${form.lastName}`.trim() || 'Company Administrator',
        })
        navigate('employer-dashboard')
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrors(
          Object.keys(err.fields).length > 0
            ? err.fields
            : { email: err.message }
        )
      } else {
        setErrors({
          email: 'Unable to reach the JobFinder server. Please try again.',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const updateField = (
    field: keyof typeof form,
    value: string
  ) => {
    setForm(prev => ({
      ...prev,
      [field]: value,
    }))

    setErrors(prev => ({
      ...prev,
      [field]: '',
    }))
  }

  return (
    <div
      style={{
        background: '#f9fafb',
        flex: 1,
      }}
      className="flex items-center justify-center px-4 py-12"
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
        }}
        className="w-full max-w-md p-8"
      >
        <h1 className="text-xl font-bold text-center text-gray-900 mb-1">
          Create your account
        </h1>

        <p className="text-sm text-center text-gray-500 mb-6">
          Choose how you want to use JobFinder.
        </p>

        {/* ROLE SELECTION */}

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() =>
              setRole('job-seeker')
            }
            style={{
              border:
                role === 'job-seeker'
                  ? '2px solid #16a34a'
                  : '1px solid #d1d5db',
              background:
                role === 'job-seeker'
                  ? '#f0fdf4'
                  : '#fff',
              borderRadius: 8,
            }}
            className="p-4 text-left"
          >
            <div className="font-semibold text-sm text-gray-900">
              Job Seeker
            </div>

            <div className="text-xs text-gray-500 mt-1">
              Find jobs and apply to opportunities.
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              setRole('employer')
            }
            style={{
              border:
                role === 'employer'
                  ? '2px solid #16a34a'
                  : '1px solid #d1d5db',
              background:
                role === 'employer'
                  ? '#f0fdf4'
                  : '#fff',
              borderRadius: 8,
            }}
            className="p-4 text-left"
          >
            <div className="font-semibold text-sm text-gray-900">
              Employer
            </div>

            <div className="text-xs text-gray-500 mt-1">
              Post jobs and find qualified candidates.
            </div>
          </button>
        </div>

        <p className="text-sm text-center text-gray-500 mb-6">
          Already have an account?{' '}
          <button
            onClick={() =>
              navigate('signin')
            }
            style={{
              color: '#16a34a',
            }}
            className="font-medium hover:underline"
          >
            Sign in
          </button>
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {role === 'job-seeker' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>

                <input
                  value={form.firstName}
                  onChange={e =>
                    updateField(
                      'firstName',
                      e.target.value
                    )
                  }
                  style={{
                    border: `1px solid ${
                      errors.firstName
                        ? '#ef4444'
                        : '#d1d5db'
                    }`,
                    borderRadius: 6,
                  }}
                  className="w-full px-3 py-2.5 text-sm outline-none"
                />

                {errors.firstName && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.firstName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>

                <input
                  value={form.lastName}
                  onChange={e =>
                    updateField(
                      'lastName',
                      e.target.value
                    )
                  }
                  style={{
                    border: `1px solid ${
                      errors.lastName
                        ? '#ef4444'
                        : '#d1d5db'
                    }`,
                    borderRadius: 6,
                  }}
                  className="w-full px-3 py-2.5 text-sm outline-none"
                />

                {errors.lastName && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.lastName}
                  </p>
                )}
              </div>
            </div>
          )}

          {role === 'employer' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name
                </label>

                <input
                  value={form.companyName}
                  onChange={e =>
                    updateField(
                      'companyName',
                      e.target.value
                    )
                  }
                  placeholder="e.g. Premier Tech Solutions"
                  className="w-full px-3 py-2.5 text-sm outline-none"
                  style={{
                    border: `1px solid ${
                      errors.companyName
                        ? '#ef4444'
                        : '#d1d5db'
                    }`,
                    borderRadius: 6,
                  }}
                />

                {errors.companyName && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.companyName}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Industry
                </label>

                <input
                  value={form.industry}
                  onChange={e =>
                    updateField(
                      'industry',
                      e.target.value
                    )
                  }
                  placeholder="e.g. Information Technology"
                  className="w-full px-3 py-2.5 text-sm outline-none"
                  style={{
                    border: `1px solid ${
                      errors.industry
                        ? '#ef4444'
                        : '#d1d5db'
                    }`,
                    borderRadius: 6,
                  }}
                />

                {errors.industry && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.industry}
                  </p>
                )}
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>

            <input
              type="email"
              value={form.email}
              onChange={e =>
                updateField(
                  'email',
                  e.target.value
                )
              }
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 text-sm outline-none"
              style={{
                border: `1px solid ${
                  errors.email
                    ? '#ef4444'
                    : '#d1d5db'
                }`,
                borderRadius: 6,
              }}
            />

            {errors.email && (
              <p className="text-xs text-red-500 mt-1">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>

            <PasswordField
              value={form.password}
              onChange={value => updateField('password', value)}
              autoComplete="new-password"
              className="w-full px-3 py-2.5 text-sm outline-none"
              style={{
                border: `1px solid ${
                  errors.password
                    ? '#ef4444'
                    : '#d1d5db'
                }`,
                borderRadius: 6,
              }}
            />

            {errors.password && (
              <p className="text-xs text-red-500 mt-1">
                {errors.password}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>

            <PasswordField
              value={form.confirmPassword}
              onChange={value => updateField('confirmPassword', value)}
              autoComplete="new-password"
              className="w-full px-3 py-2.5 text-sm outline-none"
              style={{
                border: `1px solid ${
                  errors.confirmPassword
                    ? '#ef4444'
                    : '#d1d5db'
                }`,
                borderRadius: 6,
              }}
            />

            {errors.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: '#0f2044',
              color: '#fff',
              borderRadius: 6,
            }}
            className="w-full py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
          >
            {loading
              ? 'Creating account...'
              : role === 'employer'
              ? 'Create Employer Account'
              : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
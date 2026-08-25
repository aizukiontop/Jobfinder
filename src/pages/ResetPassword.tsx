import { useState } from 'react'
import { useApp } from '../context'
import { ApiRequestError, resetPassword } from '../lib/api'
import PasswordField from '../components/PasswordField'
import PasswordRequirements from '../components/PasswordRequirements'
import { isAcceptablePassword, passwordRules } from '../lib/passwordPolicy'
import jobfinderLogo from '../assets/jobfinder-logo.png'

export default function ResetPassword() {
  const { navigate, resetToken } = useApp()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isAcceptablePassword(password)) {
      const missing = passwordRules(password).filter(r => !r.met)
      setError(`Password needs: ${missing.map(r => r.label.toLowerCase()).join(', ')}.`)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setError('')
    setLoading(true)
    try {
      await resetPassword(resetToken ?? '', password)
      setDone(true)
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
    <div style={{ background: '#f9fafb', flex: 1 }} className="flex items-center justify-center px-4 py-12">
      <div
        style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12 }}
        className="w-full max-w-sm p-8"
      >
        <img src={jobfinderLogo} alt="JobFinder" className="w-14 h-14 object-contain mx-auto mb-4" />

        {done ? (
          <>
            <h1 className="text-lg font-bold text-gray-900 text-center mb-2">Password updated</h1>
            <p className="text-sm text-gray-500 text-center mb-6">
              You can now sign in with your new password. Any other devices have been signed out.
            </p>
            <button
              onClick={() => navigate('signin')}
              style={{ background: '#0f2044', color: '#fff', borderRadius: 6 }}
              className="w-full py-2.5 text-sm font-semibold hover:opacity-90"
            >
              Go to sign in
            </button>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-gray-900 text-center mb-1">Choose a new password</h1>
            <p className="text-sm text-gray-500 text-center mb-6">
              Enter a new password for your JobFinder account.
            </p>

            {error && (
              <div
                style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6 }}
                className="px-3 py-2 mb-4 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <PasswordField
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  required
                  style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                />
                <PasswordRequirements password={password} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                <PasswordField
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                  required
                  style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ background: '#0f2044', color: '#fff', borderRadius: 6 }}
                className="w-full py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

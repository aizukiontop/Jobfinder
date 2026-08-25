import { useState } from 'react'
import { useApp } from '../context'
import { requestPasswordReset } from '../lib/api'
import jobfinderLogo from '../assets/jobfinder-logo.png'

export default function ForgotPassword() {
  const { navigate } = useApp()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch {
      setError('Unable to reach the JobFinder server. Please try again.')
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

        {sent ? (
          <>
            <h1 className="text-lg font-bold text-gray-900 text-center mb-2">Check your email</h1>
            <p className="text-sm text-gray-500 text-center mb-6">
              If an account exists for <strong className="text-gray-700">{email}</strong>, we have sent a link
              to reset your password. The link expires in 30 minutes.
            </p>
            <button
              onClick={() => navigate('signin')}
              style={{ background: '#0f2044', color: '#fff', borderRadius: 6 }}
              className="w-full py-2.5 text-sm font-semibold hover:opacity-90"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-gray-900 text-center mb-1">Forgot your password?</h1>
            <p className="text-sm text-gray-500 text-center mb-6">
              Enter your email and we will send you a reset link.
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-3 py-2.5 text-sm outline-none text-gray-800"
                  style={{ border: '1px solid #d1d5db', borderRadius: 6 }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ background: '#0f2044', color: '#fff', borderRadius: 6 }}
                className="w-full py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>

            <button
              onClick={() => navigate('signin')}
              style={{ color: '#16a34a' }}
              className="w-full mt-4 text-sm font-medium hover:underline"
            >
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  )
}

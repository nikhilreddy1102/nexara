// REPO: nexara-frontend
// PATH: src/app/(dashboard)/account/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { authApi, accountApi, ApiError } from '@/lib/api'
import { cache } from '@/lib/cache'
import type { User } from '@/types'

const TOKEN_KEY = 'nexara_token'
const REFRESH_KEY = 'nexara_refresh_token'

export default function AccountPage() {
  const [email, setEmail] = useState('')
  const [hasPasswordSet, setHasPasswordSet] = useState<boolean | null>(null)
  const [pageLoading, setPageLoading] = useState(true)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  useEffect(() => {
    const cached = cache.get<{ email: string; has_password_set: boolean }>('account_me')
    if (cached) {
      setEmail(cached.email ?? '')
      setHasPasswordSet(cached.has_password_set !== false)
      setPageLoading(false)
      return
    }

    authApi.me()
      .then((data: User) => {
        setEmail(data?.email ?? '')
        setHasPasswordSet(data?.has_password_set !== false)
        cache.set('account_me', { email: data?.email, has_password_set: data?.has_password_set }, 30)
      })
      .catch(() => {})
      .finally(() => setPageLoading(false))
  }, [])

  // Mirrors backend/auth/password_rules.py -- same rule enforced
  // everywhere a password gets set in this product.
  const passwordError = (pw: string): string | null => {
    const missing: string[] = []
    if (pw.length < 8) missing.push('at least 8 characters')
    if (!/[A-Z]/.test(pw)) missing.push('an uppercase letter')
    if (!/[a-z]/.test(pw)) missing.push('a lowercase letter')
    if (!/[0-9]/.test(pw)) missing.push('a number')
    if (!/[^A-Za-z0-9]/.test(pw)) missing.push('a special character')
    if (missing.length === 0) return null
    return `Password needs ${missing.join(', ')}.`
  }

  const isFormFilled = hasPasswordSet
    ? currentPassword !== '' && newPassword !== '' && confirmPassword !== ''
    : newPassword !== '' && confirmPassword !== ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const pwError = passwordError(newPassword)
    if (pwError) { setError(pwError); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    if (hasPasswordSet && !currentPassword) { setError('Enter your current password.'); return }

    setLoading(true)
    try {
      await accountApi.setPassword(newPassword, hasPasswordSet ? currentPassword : undefined)
      // Success -- don't log out immediately. Show the confirm popup
      // first, same as discussed: they explicitly click OK before the
      // session actually ends, rather than being yanked out with no
      // warning right after submitting.
      setShowLogoutConfirm(true)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === 'Current password is incorrect.') {
          setError('Current password is incorrect.')
        } else if (err.status === 400) {
          setError(err.code)
        } else {
          setError("Couldn't update your password. Please try again.")
        }
      } else {
        setError("Couldn't reach the server. Check your connection and try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmLogout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    window.location.href = '/login'
  }

  return (
    <div>
      <Header title="Account" subtitle="Manage your personal details and password" />

      {pageLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-7 h-7 rounded-full border-[3px] border-gray-200 border-t-brand animate-spin" />
          <p className="text-sm text-gray-500">Getting your info...</p>
        </div>
      ) : (
      <div className="p-4 md:p-6 space-y-6 max-w-lg">

        <div className="card">
          <p className="text-sm font-medium text-gray-900 mb-3">Personal details</p>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
            <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700">
              {email || '...'}
            </div>
          </div>
        </div>

        <div className="card">
          <p className="text-sm font-medium text-gray-900 mb-1">
            {hasPasswordSet ? 'Change password' : 'Create password'}
          </p>
          <p className="text-xs text-gray-500 mb-4">
            {hasPasswordSet
              ? 'Enter your current password, then choose a new one.'
              : 'You signed in without a password. Set one now for smoother sign-in next time.'}
          </p>

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {hasPasswordSet && (
              <div>
                <label htmlFor="current-password" className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                  Current password
                </label>
                <input
                  id="current-password" type="password"
                  value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                  autoComplete="current-password" className="input"
                />
              </div>
            )}

            <div>
              <label htmlFor="new-password" className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                New password
              </label>
              <input
                id="new-password" type="password" placeholder="Min 8 characters"
                value={newPassword} onChange={e => setNewPassword(e.target.value)}
                autoComplete="new-password" className="input"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Use 8+ characters with uppercase, lowercase, a number, and a special character.
              </p>
            </div>

            <div>
              <label htmlFor="confirm-new-password" className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Confirm new password
              </label>
              <input
                id="confirm-new-password" type="password"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password" className="input"
              />
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}

            <button
              type="submit"
              disabled={loading || !isFormFilled}
              className="btn-primary w-full text-center mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : hasPasswordSet ? 'Change password' : 'Create password'}
            </button>
          </form>
        </div>

      </div>
      )}

      {showLogoutConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff', borderRadius: 16, padding: '28px 24px', width: '100%',
              maxWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: '#111827' }}>
              Password updated
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
              For your security, you&apos;ll be logged out now. Sign back in
              with your new password.
            </p>
            <button
              onClick={handleConfirmLogout}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
                background: '#111827', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
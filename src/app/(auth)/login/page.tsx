// src/app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api'
import { MobileAppNotice, MobileAppLink } from '@/components/MobileAppInstall'

function friendlyLoginError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'invalid_credentials':
        return 'Invalid email or password.'
      case 'session_expired':
        return 'Your session expired. Please sign in again.'
      case 'account_pending_deletion':
        return "This account is past its recovery window and can't be signed into. Contact support if you didn't mean to delete it."
      default:
        return 'Something went wrong. Please try again.'
    }
  }
  if (err instanceof Error) return err.message
  return 'Something went wrong. Please try again.'
}

export default function LoginPage() {
  const { signin } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const year = new Date().getFullYear()

  const isFormFilled = email.trim() !== '' && password !== ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signin(email, password)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'no_account') {
        // No account for this email — go straight to signup instead of
        // showing a dead-end error. Signup captures DOB + password there.
        router.push(`/signup?email=${encodeURIComponent(email)}`)
        return
      }
      setError(friendlyLoginError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex">

      <aside className="hidden md:flex md:w-1/2 bg-sidebar flex-col justify-between p-10" aria-hidden="true">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <Image src="/nexara-icon-64.png" alt="" width={36} height={36} className="rounded-lg" />
            <div>
              <p className="text-sidebar-bright text-lg font-medium leading-tight">Nexara</p>
              <p className="text-[9px] text-sidebar-muted leading-tight">Powered by Nikarva</p>
            </div>
          </div>

          <h1 className="text-sidebar-text text-2xl font-medium leading-snug mb-4">
            Outreach Automation,<br />Done Right.
          </h1>
          <p className="text-sidebar-muted text-sm leading-relaxed mb-8">
            Smart campaigns that find, research and message the right people on autopilot.
          </p>

          <ul className="flex flex-col gap-3" role="list">
            {[
              'From seed to scale, outreach for every stage of growth',
              'Built for founders, recruiters and contractors alike',
              'One platform for hiring, contracting, and every business goal',
              'Gets smarter with every campaign you run',
            ].map(f => (
              <li key={f} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-brand-darker flex items-center justify-center flex-shrink-0 mt-0.5" aria-hidden="true">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9FE1CB" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span className="text-sidebar-text text-sm">{f}</span>
              </li>
            ))}
          </ul>

          <MobileAppNotice />
        </div>

        <div className="border-t border-sidebar-border pt-5">
          <p className="text-sidebar-muted text-xs text-center">© {year} Nikarva Technologies</p>
        </div>
      </aside>

      <section
        className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-10 bg-white"
        aria-labelledby="signin-heading"
      >
        <div className="w-full max-w-sm">

          <div className="flex items-center gap-2 mb-8 md:hidden" aria-hidden="true">
            <Image src="/nexara-icon-32.png" alt="" width={32} height={32} className="rounded-lg" />
            <span className="text-gray-900 text-base font-medium">Nexara</span>
          </div>

          <div className="mb-7">
            <h2 id="signin-heading" className="text-xl font-medium text-gray-900 mb-1">
              Welcome back
            </h2>
            <p className="text-sm text-gray-500">Sign in to your Nexara account</p>
          </div>

          <form
            onSubmit={handleSubmit}
            aria-label="Sign in form"
            aria-describedby={error ? 'form-error' : undefined}
            noValidate
            className="flex flex-col gap-4"
          >
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                aria-required="true"
                aria-invalid={error ? 'true' : 'false'}
                autoComplete="email"
                className="input"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="password" className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-brand hover:text-brand-darker">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  aria-required="true"
                  aria-invalid={error ? 'true' : 'false'}
                  autoComplete="current-password"
                  className="input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div id="form-error" role="alert" aria-live="assertive" aria-atomic="true">
              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !isFormFilled}
              aria-busy={loading}
              className="btn-primary w-full text-center mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in to Nexara'}
            </button>
          </form>

          <MobileAppLink />

          <div className="flex items-center gap-3 my-5" aria-hidden="true">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <p className="text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-brand font-medium hover:text-brand-darker">
              Create one free
            </Link>
          </p>

          <dl
            className="grid grid-cols-3 gap-2 mt-8 pt-6 border-t border-gray-100"
            aria-label="Platform statistics"
          >
            {[
              { val: '3 modes', label: 'Campaign types' },
              { val: '~95%', label: 'Acceptance rate' },
              { val: 'Auto', label: 'Outreach mode' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <dt className="text-xs text-gray-400">{s.label}</dt>
                <dd className="text-sm font-medium text-gray-900">{s.val}</dd>
              </div>
            ))}
          </dl>

        </div>
      </section>
    </main>
  )
}
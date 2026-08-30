// src/app/(auth)/signup/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { ApiError } from '@/lib/api'
import { MobileAppNotice, MobileAppLink } from '@/components/MobileAppInstall'

type Step = 'form' | 'otp'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate()
}

export default function SignupPage() {
  const { user, loading: authLoading, signupRequestOtp, signupVerifyOtp } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState<Step>('form')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [dobMonth, setDobMonth] = useState('')
  const [dobDay, setDobDay] = useState('')
  const [dobYear, setDobYear] = useState('')
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  const [otp, setOtp] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendMessage, setResendMessage] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const year = new Date().getFullYear()

  // Arrives here from /login?email=... when that address has no account
  // yet. Read it off the URL directly rather than useSearchParams, which
  // would force a Suspense boundary around this whole page for no benefit.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const prefill = params.get('email')
    if (prefill) setEmail(prefill)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Guards the direction the dashboard layout doesn't: someone already
  // signed in landing here (a stale bookmark, a link that forgot to check
  // login state) previously just saw a blank "Create your account" form
  // instead of being sent back to what they already have.
  useEffect(() => {
    if (!authLoading && user) router.push('/dashboard')
  }, [user, authLoading, router])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => setResendCooldown(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const monthNum = dobMonth ? Number(dobMonth) : null
  const yearNum = dobYear.length === 4 ? Number(dobYear) : null
  const maxDayForSelection = monthNum && yearNum ? daysInMonth(monthNum, yearNum) : 31
  // Reset day if it's no longer valid for the newly-selected month/year
  // (e.g. switching from March 31 to February).
  if (dobDay && Number(dobDay) > maxDayForSelection) {
    setDobDay('')
  }

  const buildDobString = (): string | null => {
    if (!dobMonth || !dobDay || !dobYear || dobYear.length !== 4) return null
    const m = Number(dobMonth), d = Number(dobDay), y = Number(dobYear)
    const candidate = new Date(y, m - 1, d)
    // Guards against invalid combos (e.g. Feb 30) that Date() would silently roll forward
    if (candidate.getFullYear() !== y || candidate.getMonth() !== m - 1 || candidate.getDate() !== d) return null
    if (candidate.getTime() > Date.now()) return null // no future dates
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  // Mirrors backend/auth/password_rules.py -- lists every unmet
  // requirement at once instead of one failure per submit attempt.
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

  const isFormFilled = email.trim() !== '' && password !== '' && dobMonth !== '' && dobDay !== '' && dobYear !== ''
  const isOtpFilled = otp.trim().length >= 6

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const pwError = passwordError(password)
    if (pwError) { setError(pwError); return }

    const dob = buildDobString()
    if (!dob) {
      setError('Please enter a valid date of birth (no future dates).')
      return
    }

    setLoading(true)
    try {
      await signupRequestOtp(email, password)
      setStep('otp')
      setResendCooldown(60)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 400) {
        // Backend sends a human-readable message for both weak-password
        // and already-registered cases here -- show it directly rather
        // than guessing which one happened.
        setError(err.code)
      } else {
        setError('Failed to create account.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setResendMessage('')
    setLoading(true)
    try {
      await signupRequestOtp(email, password)
      setResendCooldown(60)
      setResendMessage('Code resent.')
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'cooldown_active') {
        // Backend's own gate caught it -- frontend timer was already
        // supposed to prevent this, just resync silently.
        setResendCooldown(60)
      } else if (err instanceof ApiError && err.status === 400) {
        setError(err.code)
      } else {
        setError("Couldn't resend the code. Check your connection and try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (otp.trim().length < 6) { setError('Enter the verification code.'); return }

    const dob = buildDobString()
    if (!dob) {
      // Shouldn't happen (already validated in step 1), but guards
      // against someone reloading mid-flow and losing component state.
      setError('Something went wrong. Please start over.')
      setStep('form')
      return
    }

    setLoading(true)
    try {
      await signupVerifyOtp(email, otp.trim(), dob)
      // signupVerifyOtp logs the person in and redirects to /dashboard itself.
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'invalid_otp') {
        setError('That code is incorrect or has expired.')
      } else {
        setError("Couldn't reach the server. Check your connection and try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  // Already signed in -- the effect above is navigating away right now,
  // don't flash the signup form while that happens.
  if (authLoading || user) return null

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
            Start your first<br />campaign today.
          </h1>
          <p className="text-sidebar-muted text-sm leading-relaxed">
            Set up in minutes. No prior outreach automation experience needed.
          </p>

          <MobileAppNotice />
        </div>

        <div className="border-t border-sidebar-border pt-5">
          <p className="text-sidebar-muted text-xs text-center">
            © {year} Nikarva Technologies
          </p>
        </div>
      </aside>

      <section
        className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-10 bg-white"
        aria-labelledby="signup-heading"
      >
        <div className="w-full max-w-sm">

          <div className="flex items-center gap-2 mb-8 md:hidden" aria-hidden="true">
            <Image src="/nexara-icon-32.png" alt="" width={32} height={32} className="rounded-lg" />
            <span className="text-gray-900 text-base font-medium">Nexara</span>
          </div>

          {step === 'form' && (
            <>
              <div className="mb-7">
                <h2 id="signup-heading" className="text-xl font-medium text-gray-900 mb-1">
                  Create your account
                </h2>
                <p className="text-sm text-gray-500">Get started with Nexara for free</p>
              </div>

              <form
                onSubmit={handleFormSubmit}
                aria-label="Sign up form"
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
                  <label htmlFor="password" className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    aria-required="true"
                    minLength={8}
                    autoComplete="new-password"
                    className="input"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Use 8+ characters with uppercase, lowercase, a number, and a special character.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                    Date of birth
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      aria-label="Birth month"
                      value={dobMonth}
                      onChange={e => setDobMonth(e.target.value)}
                      required
                      className="input"
                    >
                      <option value="">Month</option>
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                      ))}
                    </select>

                    <select
                      aria-label="Birth day"
                      value={dobDay}
                      onChange={e => setDobDay(e.target.value)}
                      required
                      disabled={!dobMonth}
                      className="input disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Day</option>
                      {Array.from({ length: maxDayForSelection }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>

                    <input
                      aria-label="Birth year"
                      type="number"
                      placeholder="Year"
                      value={dobYear}
                      onChange={e => setDobYear(e.target.value.slice(0, 4))}
                      min={1900}
                      max={year}
                      required
                      className="input"
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Used for account verification only.</p>
                </div>

                <div id="form-error" role="alert" aria-live="assertive" aria-atomic="true">
                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                      {error}
                    </p>
                  )}
                </div>

                <label className="flex items-start gap-2 text-[11px] text-gray-500 -mb-1">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={e => setAgreedToTerms(e.target.checked)}
                    required
                    aria-required="true"
                    className="mt-0.5 flex-shrink-0"
                  />
                  <span>
                    By checking here you agree to Nexara&apos;s{' '}
                    <Link href="/terms" className="text-brand font-medium hover:text-brand-darker underline">
                      Terms and Conditions
                    </Link>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading || !isFormFilled || !agreedToTerms}
                  aria-busy={loading}
                  className="btn-primary w-full text-center mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending code...' : 'Create account'}
                </button>
              </form>

              <MobileAppLink />
            </>
          )}

          {step === 'otp' && (
            <>
              <div className="mb-7">
                <h2 className="text-xl font-medium text-gray-900 mb-1">Verify your email</h2>
                <p className="text-sm text-gray-500">We sent a verification code to {email || 'your email'}.</p>
              </div>
              <form onSubmit={handleOtpSubmit} noValidate className="flex flex-col gap-4">
                <div>
                  <label htmlFor="otp" className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Verification code</label>
                  <input
                    id="otp" type="text" inputMode="numeric" placeholder="123456" maxLength={10}
                    value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    required className="input tracking-[0.3em] text-center"
                  />
                </div>
                {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}
                {resendMessage && !error && (
                  <p className="text-sm text-brand bg-brand-light px-3 py-2 rounded-lg">{resendMessage}</p>
                )}
                <p className="text-xs text-gray-500 text-center -mt-1">
                  {resendCooldown > 0 ? (
                    <>Resend code in {resendCooldown}s</>
                  ) : (
                    <button type="button" onClick={handleResend} disabled={loading} className="text-brand font-medium hover:text-brand-darker underline disabled:opacity-50">
                      Resend code
                    </button>
                  )}
                </p>
                <button type="submit" disabled={loading || !isOtpFilled} className="btn-primary w-full text-center mt-1 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Verifying...' : 'Verify and continue'}
                </button>
                <button type="button" onClick={() => { setStep('form'); setError(''); setOtp(''); setResendMessage('') }} className="text-xs text-gray-500 hover:text-gray-700 underline text-center">
                  Use a different email
                </button>
              </form>
            </>
          )}

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-brand font-medium hover:text-brand-darker">
              Sign in
            </Link>
          </p>

        </div>
      </section>
    </main>
  )
}
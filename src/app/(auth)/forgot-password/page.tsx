// src/app/(auth)/forgot-password/page.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { authApi } from '@/lib/api'
import { ApiError } from '@/lib/api'

type Step = 'request' | 'otp' | 'reset' | 'done'

const SUPPORT_EMAIL = 'support@nikarva.com'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate()
}

function friendlyIdentityError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'mismatch') return "The email and date of birth don't match our records."
  }
  return "Couldn't reach the server. Check your connection and try again."
}

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('request')
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(false)

  const [email, setEmail] = useState('')
  const [dobMonth, setDobMonth] = useState('')
  const [dobDay, setDobDay] = useState('')
  const [dobYear, setDobYear] = useState('')

  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendMessage, setResendMessage] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  // Optional -- only offered because the account might have no DOB on
  // file yet (career-plan accounts never do). Backend silently ignores
  // this if the account already has a real DOB, see forgot_password_reset.
  const [addDobMonth, setAddDobMonth] = useState('')
  const [addDobDay, setAddDobDay] = useState('')
  const [addDobYear, setAddDobYear] = useState('')
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => setResendCooldown(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const yearNow = new Date().getFullYear()
  const monthNum = dobMonth ? Number(dobMonth) : null
  const yearNum = dobYear.length === 4 ? Number(dobYear) : null
  const maxDayForSelection = monthNum && yearNum ? daysInMonth(monthNum, yearNum) : 31
  if (dobDay && Number(dobDay) > maxDayForSelection) setDobDay('')

  const buildDobString = (): string | null => {
    if (!dobMonth || !dobDay || !dobYear || dobYear.length !== 4) return null
    const m = Number(dobMonth), d = Number(dobDay), y = Number(dobYear)
    const candidate = new Date(y, m - 1, d)
    if (candidate.getFullYear() !== y || candidate.getMonth() !== m - 1 || candidate.getDate() !== d) return null
    if (candidate.getTime() > Date.now()) return null
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  // DOB is optional here -- not every account has one on file (career-
  // plan accounts from AgentTina activation never do). The backend
  // decides whether it's actually required; this just needs to
  // distinguish "left blank on purpose" (fine) from "started filling it
  // in but didn't finish" (a real mistake worth catching client-side).
  const getRequestDob = (): { dob?: string; error?: string } => {
    const allEmpty = !dobMonth && !dobDay && !dobYear
    if (allEmpty) return {}
    const partial = !(dobMonth && dobDay && dobYear)
    if (partial) return { error: 'Complete all three date fields, or leave date of birth blank entirely.' }
    const dob = buildDobString()
    if (!dob) return { error: 'Please enter a valid date of birth (no future dates).' }
    return { dob }
  }

  const isRequestFormFilled = email.trim() !== ''
  const isOtpFilled = otp.trim().length >= 6
  const isResetFormFilled = newPassword !== '' && confirmPassword !== ''

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email) { setError('Please enter your email.'); return }
    const { dob, error: dobError } = getRequestDob()
    if (dobError) { setError(dobError); return }

    setLoading(true)
    try {
      await authApi.forgotPasswordVerifyIdentity(email, dob)
      setStep('otp')
      setResendCooldown(60)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'locked') {
        setLocked(true)
      } else {
        setError(friendlyIdentityError(err))
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setResendMessage('')
    const { dob, error: dobError } = getRequestDob()
    if (dobError) {
      setError(dobError)
      setStep('request')
      return
    }
    setLoading(true)
    try {
      await authApi.forgotPasswordVerifyIdentity(email, dob)
      setResendCooldown(60)
      setResendMessage('Code resent.')
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'cooldown_active') {
        // Backend's own gate caught it -- frontend timer was already
        // supposed to prevent this, just resync silently.
        setResendCooldown(60)
      } else if (err instanceof ApiError && err.code === 'locked') {
        setLocked(true)
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

    setLoading(true)
    try {
      const res = await authApi.forgotPasswordVerifyOtp(email, otp.trim())
      setResetToken(res.reset_token)
      setStep('reset')
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

  const getAddDob = (): { dob?: string; error?: string } => {
    const allEmpty = !addDobMonth && !addDobDay && !addDobYear
    if (allEmpty) return {}
    const partial = !(addDobMonth && addDobDay && addDobYear)
    if (partial) return { error: 'Complete all three date fields, or leave date of birth blank entirely.' }
    const m = Number(addDobMonth), d = Number(addDobDay), y = Number(addDobYear)
    const candidate = new Date(y, m - 1, d)
    const valid = candidate.getFullYear() === y && candidate.getMonth() === m - 1 && candidate.getDate() === d
      && candidate.getTime() <= Date.now() && addDobYear.length === 4
    if (!valid) return { error: 'Please enter a valid date of birth (no future dates).' }
    return { dob: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` }
  }

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const pwError = passwordError(newPassword)
    if (pwError) { setError(pwError); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    const { dob: addDob, error: dobError } = getAddDob()
    if (dobError) { setError(dobError); return }

    setLoading(true)
    try {
      await authApi.forgotPasswordReset(resetToken, newPassword, addDob)
      setStep('done')
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        setError('That reset link expired. Please start over.')
        setStep('request')
        setOtp('')
        setResetToken('')
      } else if (err instanceof ApiError && err.status === 400) {
        // Backend's weak-password message is already human-readable.
        setError(err.code)
      } else {
        setError("Couldn't reach the server. Check your connection and try again.")
      }
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
            Reset your<br />password.
          </h1>
          <p className="text-sidebar-muted text-sm leading-relaxed">
            We&apos;ll verify it&apos;s really you before letting anything change.
          </p>
        </div>
        <div className="border-t border-sidebar-border pt-5">
          <p className="text-sidebar-muted text-xs text-center">© {yearNow} Nikarva Technologies</p>
        </div>
      </aside>

      <section className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-10 bg-white">
        <div className="w-full max-w-sm">

          <div className="flex items-center gap-2 mb-8 md:hidden" aria-hidden="true">
            <Image src="/nexara-icon-32.png" alt="" width={32} height={32} className="rounded-lg" />
            <span className="text-gray-900 text-base font-medium">Nexara</span>
          </div>

          {locked ? (
            <div>
              <div className="mb-5">
                <h2 className="text-xl font-medium text-gray-900 mb-1">Too many attempts</h2>
                <p className="text-sm text-gray-500">
                  We couldn&apos;t verify that email and date of birth after several tries.
                  For your account&apos;s safety, this is temporarily locked.
                </p>
              </div>
              <p className="text-sm text-red-600 bg-red-50 px-3 py-3 rounded-lg border border-red-100">
                Please contact{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="underline font-medium">
                  {SUPPORT_EMAIL}
                </a>{' '}
                for help regaining access to your account.
              </p>
            </div>
          ) : (
            <>
              {step === 'request' && (
                <>
                  <div className="mb-7">
                    <h2 className="text-xl font-medium text-gray-900 mb-1">Forgot your password?</h2>
                    <p className="text-sm text-gray-500">Enter your email to get a verification code.</p>
                  </div>
                  <form onSubmit={handleRequestSubmit} noValidate className="flex flex-col gap-4">
                    <div>
                      <label htmlFor="email" className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
                      <input
                        id="email" type="email" placeholder="you@example.com"
                        value={email} onChange={e => setEmail(e.target.value)}
                        required autoComplete="email" className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        Date of birth <span className="normal-case text-gray-400">(if set on your account)</span>
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <select aria-label="Birth month" value={dobMonth} onChange={e => setDobMonth(e.target.value)} className="input">
                          <option value="">Month</option>
                          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                        </select>
                        <select aria-label="Birth day" value={dobDay} onChange={e => setDobDay(e.target.value)} disabled={!dobMonth} className="input disabled:opacity-50 disabled:cursor-not-allowed">
                          <option value="">Day</option>
                          {Array.from({ length: maxDayForSelection }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <input
                          aria-label="Birth year" type="number" placeholder="Year"
                          value={dobYear} onChange={e => setDobYear(e.target.value.slice(0, 4))}
                          min={1900} max={yearNow} className="input"
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Leave blank if you don&apos;t remember setting one.
                      </p>
                    </div>
                    {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}
                    <button type="submit" disabled={loading || !isRequestFormFilled} className="btn-primary w-full text-center mt-1 disabled:opacity-50 disabled:cursor-not-allowed">
                      {loading ? 'Checking...' : 'Send verification code'}
                    </button>
                  </form>
                </>
              )}

              {step === 'otp' && (
                <>
                  <div className="mb-7">
                    <h2 className="text-xl font-medium text-gray-900 mb-1">Enter verification code</h2>
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
                      {loading ? 'Verifying...' : 'Verify code'}
                    </button>
                    <button type="button" onClick={() => { setStep('request'); setError(''); setOtp(''); setResendMessage('') }} className="text-xs text-gray-500 hover:text-gray-700 underline text-center">
                      Use a different email
                    </button>
                  </form>
                </>
              )}

              {step === 'reset' && (
                <>
                  <div className="mb-7">
                    <h2 className="text-xl font-medium text-gray-900 mb-1">Set a new password</h2>
                    <p className="text-sm text-gray-500">Verified - choose a new password for your account.</p>
                  </div>
                  <form onSubmit={handleResetSubmit} noValidate className="flex flex-col gap-4">
                    <div>
                      <label htmlFor="new-password" className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">New password</label>
                      <div className="relative">
                        <input
                          id="new-password" type={showNewPassword ? 'text' : 'password'} placeholder="Min 8 characters"
                          value={newPassword} onChange={e => setNewPassword(e.target.value)}
                          required minLength={8} autoComplete="new-password" className="input pr-10"
                        />
                        <button type="button" onClick={() => setShowNewPassword(v => !v)}
                          aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showNewPassword ? (
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
                      <p className="text-[11px] text-gray-400 mt-1">
                        Use 8+ characters with uppercase, lowercase, a number, and a special character.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="confirm-password" className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Confirm new password</label>
                      <div className="relative">
                        <input
                          id="confirm-password" type={showConfirmPassword ? 'text' : 'password'} placeholder="Re-enter password"
                          value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                          required minLength={8} autoComplete="new-password" className="input pr-10"
                        />
                        <button type="button" onClick={() => setShowConfirmPassword(v => !v)}
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showConfirmPassword ? (
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

                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                        Date of birth <span className="normal-case text-gray-400">(optional)</span>
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <select aria-label="Birth month" value={addDobMonth} onChange={e => setAddDobMonth(e.target.value)} className="input">
                          <option value="">Month</option>
                          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                        </select>
                        <select aria-label="Birth day" value={addDobDay} onChange={e => setAddDobDay(e.target.value)} disabled={!addDobMonth} className="input disabled:opacity-50 disabled:cursor-not-allowed">
                          <option value="">Day</option>
                          {Array.from(
                            { length: addDobMonth && addDobYear.length === 4 ? daysInMonth(Number(addDobMonth), Number(addDobYear)) : 31 },
                            (_, i) => i + 1
                          ).map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <input
                          aria-label="Birth year" type="number" placeholder="Year"
                          value={addDobYear} onChange={e => setAddDobYear(e.target.value.slice(0, 4))}
                          min={1900} max={yearNow} className="input"
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Helps verify your identity for future password resets. Skip this if you&apos;d rather not.
                      </p>
                    </div>

                    {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">{error}</p>}
                    <button type="submit" disabled={loading || !isResetFormFilled} className="btn-primary w-full text-center mt-1 disabled:opacity-50 disabled:cursor-not-allowed">
                      {loading ? 'Resetting...' : 'Reset password'}
                    </button>
                  </form>
                </>
              )}

              {step === 'done' && (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center mx-auto mb-4">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-medium text-gray-900 mb-1">Password reset</h2>
                  <p className="text-sm text-gray-500 mb-6">You can now sign in with your new password.</p>
                  <Link href="/login" className="btn-primary inline-block px-6">Back to sign in</Link>
                </div>
              )}
            </>
          )}

          <p className="text-center text-sm text-gray-500 mt-6">
            {step === 'done' ? 'Or, ' : 'Remembered it? '}
            <Link href="/login" className="text-brand font-medium hover:text-brand-darker">Back to sign in</Link>
          </p>

        </div>
      </section>
    </main>
  )
}
// src/context/AuthContext.tsx
'use client'

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { mutate as mutateSWR } from 'swr'
import { authApi, isConnectivityError } from '@/lib/api'
import { cache } from '@/lib/cache'
import { User } from '@/types'

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  signin: (email: string, password: string) => Promise<void>
  signupRequestOtp: (email: string, password: string) => Promise<void>
  signupVerifyOtp: (email: string, otp: string, dob: string) => Promise<void>
  signout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null, token: null, loading: true,
  signin: async () => {}, signupRequestOtp: async () => {}, signupVerifyOtp: async () => {}, signout: async () => {},
})

const TOKEN_KEY = 'nexara_token'
const REFRESH_KEY = 'nexara_refresh_token'

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp ? payload.exp * 1000 : null
  } catch { return null }
}

function isTokenExpired(token: string): boolean {
  const expiry = getTokenExpiry(token)
  if (!expiry) return true
  return Date.now() > expiry - 60_000
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didInitRef = useRef(false)

  const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    setToken(null)
    setUser(null)
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
  }

  // Separated from scheduleRefresh so a connectivity failure can retry
  // the SAME attempt shortly after, instead of going through
  // scheduleRefresh again -- which would recompute the delay off the
  // (still old, about-to-expire) access token and could come back <= 0,
  // silently never trying again.
  const attemptRefresh = async (retryDelayMs = 30_000) => {
    const savedRefresh = localStorage.getItem(REFRESH_KEY)
    if (!savedRefresh) { clearAuth(); router.push('/login'); return }
    try {
      const res = await authApi.refresh(savedRefresh)
      localStorage.setItem(TOKEN_KEY, res.access_token)
      if (res.refresh_token) localStorage.setItem(REFRESH_KEY, res.refresh_token)
      setToken(res.access_token)
      scheduleRefresh(res.access_token)
    } catch (err) {
      // The backend being briefly unreachable (or our own request timing
      // out) isn't proof the refresh token is invalid -- don't kill an
      // otherwise-live session over a network blip. Keep retrying instead
      // of forcing a login prompt for something that may resolve itself.
      if (isConnectivityError(err)) {
        refreshTimerRef.current = setTimeout(() => attemptRefresh(retryDelayMs), retryDelayMs)
        return
      }
      clearAuth()
      router.push('/login')
    }
  }

  const scheduleRefresh = (accessToken: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    const expiry = getTokenExpiry(accessToken)
    if (!expiry) return
    const delay = expiry - Date.now() - 120_000
    if (delay <= 0) return
    refreshTimerRef.current = setTimeout(() => attemptRefresh(), delay)
  }

  useEffect(() => {
    // React 18 Strict Mode (dev only) mounts, unmounts, and remounts this
    // effect. If the refresh token rotates server-side, the second
    // invocation would refresh with an already-consumed token and log the
    // user out immediately after load. Only the first real invocation runs.
    if (didInitRef.current) return
    didInitRef.current = true

    const savedToken = localStorage.getItem(TOKEN_KEY)

    if (!savedToken) {
      setLoading(false)
      return
    }

    if (isTokenExpired(savedToken)) {
      const savedRefresh = localStorage.getItem(REFRESH_KEY)
      if (!savedRefresh) { clearAuth(); setLoading(false); return }
      authApi.refresh(savedRefresh)
        .then(res => {
          localStorage.setItem(TOKEN_KEY, res.access_token)
          if (res.refresh_token) localStorage.setItem(REFRESH_KEY, res.refresh_token)
          setToken(res.access_token)
          scheduleRefresh(res.access_token)
          return authApi.me()
        })
        .then(me => { setUser(me); setLoading(false) })
        .catch(err => {
          // A network blip during this cold-start refresh doesn't mean the
          // refresh token is dead -- leave the stored session alone and
          // just retry shortly, instead of logging the user out for
          // losing wifi for a second.
          if (isConnectivityError(err)) {
            setLoading(false)
            setTimeout(() => attemptRefresh(), 30_000)
            return
          }
          clearAuth()
          setLoading(false)
        })
      return
    }

    // Token valid — decode user from JWT immediately (no network call)
    try {
      const payload = JSON.parse(atob(savedToken.split('.')[1]))
      // Set minimal user instantly so dashboard renders
      setUser({ id: payload.sub, email: payload.email } as User)
      setToken(savedToken)
      setLoading(false)  // ← dashboard renders NOW
    } catch {
      clearAuth()
      setLoading(false)
      return
    }

    scheduleRefresh(savedToken)

    // Enrich with full profile silently in background
    authApi.me()
      .then(me => setUser(me))
      .catch(err => {
        // Only an actual auth rejection (invalid/expired token) should log
        // the user out here. A request that merely got aborted -- a fast
        // client-side navigation cancelling it, a hard refresh, a network
        // blip -- rejects the same way a real 401 does, but it's not
        // proof the session is dead. Evicting a valid session over that
        // is exactly what made sessions feel like they didn't stick in
        // the same tab.
        if (isConnectivityError(err)) return
        clearAuth()
        router.push('/login')
      })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => { if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current) }
  }, [])

  // Shared by signin and signupVerifyOtp -- both end up with the same
  // {access_token, refresh_token, user_id, email} shape and both should
  // land the person on the dashboard the same way.
  const applySession = async (res: { access_token: string; refresh_token: string; reactivated?: boolean }) => {
    localStorage.setItem(TOKEN_KEY, res.access_token)
    localStorage.setItem(REFRESH_KEY, res.refresh_token)
    setToken(res.access_token)
    scheduleRefresh(res.access_token)
    const me = await authApi.me()
    setUser(me)
    // One-shot flag, not app state -- the dashboard layout reads and
    // clears this on its next mount to show a single "welcome back"
    // banner after a login that just restored a soft-deleted account.
    if (res.reactivated) sessionStorage.setItem('nexara_reactivated', '1')
    router.push('/dashboard')
  }

  const signin = async (email: string, password: string) => {
    const res = await authApi.signin(email, password)
    await applySession(res)
  }

  // Step 1 of signup -- creates the (unconfirmed) account and sends the
  // verification code. No session yet, nothing to log in to.
  const signupRequestOtp = async (email: string, password: string) => {
    await authApi.signupRequestOtp(email, password)
  }

  // Step 2 -- verifying the code both confirms the email and returns a
  // live session in the same call, so this logs the person straight in.
  const signupVerifyOtp = async (email: string, otp: string, dob: string) => {
    const res = await authApi.signupVerifyOtp(email, otp, dob)
    await applySession(res)
  }

  const signout = async () => {
    try { await authApi.signout() } catch {}
    cache.invalidatePrefix('')   // module-level cache survives a soft navigation --
                                   // without this, the next person to log in on this
                                   // browser tab could briefly see this user's cached data
    mutateSWR(() => true, undefined, { revalidate: false })   // same reasoning, for SWR's cache
    clearAuth()
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, signin, signupRequestOtp, signupVerifyOtp, signout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
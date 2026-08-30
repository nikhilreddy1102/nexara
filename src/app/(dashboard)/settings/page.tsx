'use client'

import { useState, useEffect, Suspense } from 'react'
import useSWR from 'swr'
import { useSearchParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import { Skeleton } from '@/components/ui/Skeleton'
import { settingsApi } from '@/lib/api'
import { useLinkedInStatus } from '@/hooks/useLinkedInStatus'
import type { User } from '@/types'

interface LimitField { used: number; limit: number; note?: string | null }
interface CreditsField extends LimitField { discovery_cost: number; message_cost: number }
interface DailyLimits {
  tier: string
  connection_requests: LimitField
  dms: LimitField
  // Mutually exclusive: free has its own independent profile_views cap
  // and no credit pool; every other plan is gated by the shared credits
  // pool instead and has no separate profile_views cap. Exactly one of
  // these two is non-null for a given account.
  profile_views: LimitField | null
  credits: CreditsField | null
  // free only -- display-only, not tracked or enforced anywhere yet
  // (no "used" value exists to show). Always null for every other plan.
  monthly_credits_info: { limit: number; note?: string | null } | null
}
interface NotificationPrefs { email_on_reply: boolean; daily_digest: boolean }
interface ActivityEntry { id: string; label: string; timestamp: string }
interface LinkedInProfile { name: string; title: string; location: string; email: string }
interface OnboardingStatus { campaign_created: boolean; message_approved: boolean }

// Fallback used only if GET /settings/limits genuinely fails to respond
// (network/server error) — the endpoint itself now returns real,
// tier-aware numbers for every plan, not just free.
const DUMMY_LIMITS: DailyLimits = {
  tier: 'free',
  connection_requests: { used: 0, limit: 20 },
  dms: { used: 0, limit: 80 },
  profile_views: { used: 0, limit: 40 },
  credits: null,
  monthly_credits_info: { limit: 1000 },
}

function authHeaders() {
  const token = localStorage.getItem('nexara_token')
  return { Authorization: `Bearer ${token ?? ''}` }
}

function SettingsContent() {
  // Every read below is a useSWR() call: whatever's already cached (e.g.
  // from a previous visit this session, or shared with another page that
  // fetched the same endpoint -- /settings/linkedin especially, now shared
  // with Dashboard/Campaigns/People Finder) renders immediately, then
  // revalidates in the background instead of showing a fresh spinner
  // every time this page mounts.
  const { data: user } = useSWR<User>('/settings')
  const { connected: linkedinConnected, account: linkedinAccount, loading: linkedinFastLoading, mutate: mutateLinkedin } = useLinkedInStatus()
  const linkedin = { connected: linkedinConnected, account: linkedinAccount }

  // The fast/cached call above is a DB-only read. Whether LinkedIn is
  // genuinely still connected (not just what our DB last recorded) needs a
  // live Unipile round-trip, which is slow -- so it runs separately, once,
  // after we know the fast call says connected, with its own "getting
  // updated status" indicator on just the LinkedIn card instead of
  // blocking everything else. Updates the SHARED /settings/linkedin cache
  // entry on success, so every other page using useLinkedInStatus() picks
  // up the corrected data too.
  const [verifyingLinkedin, setVerifyingLinkedin] = useState(false)
  useEffect(() => {
    if (linkedinFastLoading || !linkedinConnected) return
    let cancelled = false
    setVerifyingLinkedin(true)
    settingsApi.verifyLinkedin()
      .then(fresh => { if (!cancelled) mutateLinkedin(fresh, { revalidate: false }) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setVerifyingLinkedin(false) })
    return () => { cancelled = true }
  }, [linkedinConnected, linkedinFastLoading, mutateLinkedin])

  const loading = !user

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [connecting, setConnecting] = useState(false)

  // Editable drafts -- these two are user-edited before "Save changes", so
  // they're local state synced from the fetched value once, not a direct
  // render of the SWR data (which could otherwise clobber an in-progress
  // edit on a background revalidation).
  const [dreamCompanies, setDreamCompanies] = useState<string[]>([])
  const [techStack, setTechStack] = useState<string[]>([])
  useEffect(() => {
    if (!user) return
    setDreamCompanies(user.dream_companies || [])
    setTechStack(user.tech_stack || [])
  }, [user])

  const [chipInput, setChipInput] = useState('')
  const [techInput, setTechInput] = useState('')
  const searchParams = useSearchParams()

  // Onboarding — backend confirmed no new endpoint needed, all three are
  // answerable from existing data: linkedin_connected reads live off the
  // hook above; campaign_created off /campaigns; message_approved off
  // /analytics/overview.total_sent. That last key is the SAME one Dashboard
  // fetches, so visiting either page after the other renders instantly
  // from the shared cache.
  const { data: campaignsData } = useSWR<{ campaigns: unknown[] }>('/campaigns')
  const { data: overview } = useSWR<{ total_sent?: number }>('/analytics/overview')
  const onboarding: OnboardingStatus = {
    campaign_created: (campaignsData?.campaigns?.length ?? 0) > 0,
    message_approved: (overview?.total_sent ?? 0) > 0,
  }

  // Daily limits — GET/PUT /settings/limits now live. connection_requests
  // and dms are real numbers; profile_views is still a backend placeholder
  // (40) pending the real free-tier figure. Editable draft, same reasoning
  // as dream companies/tech stack above.
  const { data: limitsData, error: limitsError } = useSWR<DailyLimits>('/settings/limits')
  const limitsIsDummy = !!limitsError
  const [limits, setLimits] = useState<DailyLimits>(DUMMY_LIMITS)
  useEffect(() => {
    if (limitsData) setLimits(limitsData)
    else if (limitsError) setLimits(DUMMY_LIMITS)
  }, [limitsData, limitsError])
  const [savingLimits, setSavingLimits] = useState(false)

  // Notification prefs — needs GET/PUT /settings/notifications.
  const { data: notifData, error: notifFetchError } = useSWR<NotificationPrefs>('/settings/notifications')
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>({ email_on_reply: true, daily_digest: false })
  const [notifIsDummy, setNotifIsDummy] = useState(false)
  useEffect(() => {
    if (notifData) { setNotifPrefs(notifData); setNotifIsDummy(false) }
    else if (notifFetchError) setNotifIsDummy(true)
  }, [notifData, notifFetchError])

  // Recent activity — needs GET /settings/activity returning
  // [{ id, label, timestamp }]. No fake entries if missing — an honest
  // empty state beats inventing an audit trail that doesn't exist.
  const { data: activityData } = useSWR<{ activity: ActivityEntry[] }>('/settings/activity')
  const activity = activityData?.activity ?? null

  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // LinkedIn Information card — GET /settings/linkedin/profile. Its own
  // SWR key, independent of the linkedin.connected flag above: the
  // endpoint itself already 400s fast (DB-only) when nothing's connected,
  // and the render below keys off linkedin.connected for what to show, so
  // fetching this unconditionally and in parallel with everything else is
  // safe and avoids the waterfall gating on it used to cause.
  const { data: linkedinProfile, isLoading: linkedinProfileLoading, error: linkedinProfileError } =
    useSWR<LinkedInProfile>('/settings/linkedin/profile')
  const linkedinProfileUnavailable = !!linkedinProfileError

  // Handle LinkedIn redirect callback
  useEffect(() => {
    const linkedinStatus = searchParams.get('linkedin')
    const accountId = searchParams.get('account_id')

    if (linkedinStatus === 'connected' && accountId) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/linkedin/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ account_id: accountId })
      }).then(() => {
        mutateLinkedin()
      }).catch(() => {})

      window.history.replaceState({}, '', '/settings')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const addChip = (val: string, arr: string[], setArr: (a: string[]) => void, setInput: (s: string) => void) => {
    const trimmed = val.trim()
    if (trimmed && !arr.includes(trimmed)) setArr([...arr, trimmed])
    setInput('')
  }

  const removeChip = (val: string, arr: string[], setArr: (a: string[]) => void) => {
    setArr(arr.filter(x => x !== val))
  }

  const save = async () => {
    setSaving(true)
    try {
      await settingsApi.update({ dream_companies: dreamCompanies, tech_stack: techStack })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  const connectLinkedIn = async () => {
    setConnecting(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/linkedin/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() }
      })
      const data = await res.json()
      if (data.auth_url) {
        window.location.href = data.auth_url
      } else {
        alert('Failed to generate LinkedIn auth URL')
      }
    } catch {
      alert('Failed to connect LinkedIn')
    } finally {
      setConnecting(false)
    }
  }

  const [disconnecting, setDisconnecting] = useState(false)
  const [disconnectError, setDisconnectError] = useState<string | null>(null)
  const [disconnectWarning, setDisconnectWarning] = useState<string | null>(null)

  const disconnectLinkedIn = async () => {
    setDisconnecting(true)
    setDisconnectError(null)
    setDisconnectWarning(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/linkedin/disconnect`, {
        method: 'DELETE',
        headers: authHeaders()
      })
      const body = await res.json().catch(() => ({} as {
        message?: string; unipile_disconnected?: boolean; unipile_error?: string; detail?: string
      }))
      if (!res.ok) throw new Error(body?.detail ?? `Disconnect failed (${res.status})`)
      if (body?.unipile_disconnected === false) {
        setDisconnectWarning(
          "Disconnected from Nexara. LinkedIn's session may still be active on our end - you can safely reconnect."
        )
        if (body?.unipile_error) console.warn('Unipile disconnect did not confirm:', body.unipile_error)
      }
      await mutateLinkedin()
    } catch (e) {
      setDisconnectError(e instanceof Error ? e.message : 'Failed to disconnect LinkedIn')
    } finally {
      setDisconnecting(false)
    }
  }

  const saveLimits = async () => {
    setSavingLimits(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/limits`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          connection_requests: limits.connection_requests.limit,
          dms: limits.dms.limit,
          // Mutually exclusive on the backend too -- only the one that
          // applies to this account's tier is ever non-null here.
          ...(limits.profile_views ? { profile_views: limits.profile_views.limit } : {}),
          ...(limits.credits ? { credits: limits.credits.limit } : {}),
        })
      })
      if (!res.ok) throw new Error()
    } catch {
      // Endpoint doesn't exist yet — values stay as local-only for now.
    } finally {
      setSavingLimits(false)
    }
  }

  const toggleNotif = async (key: keyof NotificationPrefs) => {
    const next = { ...notifPrefs, [key]: !notifPrefs[key] }
    setNotifPrefs(next)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(next)
      })
      if (!res.ok) throw new Error()
    } catch {
      setNotifIsDummy(true) // couldn't persist - flag it honestly
    }
  }

  const exportData = async () => {
    setExporting(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/export`, {
        method: 'POST', headers: authHeaders()
      })
      if (!res.ok) throw new Error()
      alert("Export started - you'll get an email when it's ready.")
    } catch {
      alert("Data export isn't available yet.")
    } finally {
      setExporting(false)
    }
  }

  const deleteAccount = async () => {
    if (!window.confirm(
      "Delete your account? You'll have 20 days to log back in and restore it. " +
      "After that your account is locked, and it's permanently deleted around day 26 - this cannot be undone once that happens."
    )) return
    setDeleting(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/settings/account`, {
        method: 'DELETE', headers: authHeaders()
      })
      if (!res.ok) throw new Error()
      localStorage.removeItem('nexara_token')
      localStorage.removeItem('nexara_refresh_token')
      window.location.href = '/login'
    } catch {
      alert("Couldn't delete your account right now. Please try again.")
      setDeleting(false)
    }
  }

  const onboardingItems = {
    linkedin_connected: linkedin.connected, // always live, never from onboarding state
    campaign_created: onboarding?.campaign_created ?? false,
    message_approved: onboarding?.message_approved ?? null,
  }
  const onboardingComplete = onboardingItems.linkedin_connected && onboardingItems.campaign_created && onboardingItems.message_approved === true

  return (
    <div>
      <Header title="Settings" subtitle="Account and preferences" />
      <div className="p-4 md:p-6 max-w-7xl">

        {/* AgentTina cross-promo */}
        <a
          href="https://tina.nikarva.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 bg-brand-light border border-brand/20 rounded-xl px-4 py-3 mb-5 hover:border-brand transition-colors flex-wrap"
        >
          <div>
            <p className="text-sm font-medium text-brand-dark">Match a resume to this campaign&apos;s roles</p>
            <p className="text-xs text-gray-500">AgentTina builds a resume for the same job posting Nexara is reaching out about</p>
          </div>
          <span className="text-xs font-medium text-brand-dark whitespace-nowrap">Open AgentTina →</span>
        </a>

        {!onboardingComplete && (
          <div className="card mb-5">
            <p className="text-sm font-medium text-gray-900 mb-3">Get set up</p>
            <div className="space-y-2">
              {([
                { key: 'linkedin_connected' as const, label: 'Connect LinkedIn' },
                { key: 'campaign_created' as const, label: 'Create your first campaign' },
                { key: 'message_approved' as const, label: 'Approve your first message' },
              ]).map(item => {
                const value = onboardingItems[item.key]
                return (
                  <div key={item.key} className="flex items-center gap-2 text-xs">
                    {value === null ? (
                      <span className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" />
                    ) : value ? (
                      <span className="text-brand">✓</span>
                    ) : (
                      <span className="text-gray-300">○</span>
                    )}
                    <span className={value ? 'text-gray-400 line-through' : 'text-gray-700'}>
                      {item.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">

          {/* LinkedIn account */}
          <div className="card">
            <p className="text-sm font-medium text-gray-900 mb-4">Nexara account</p>
            {loading ? (
              <div className="space-y-2 animate-pulse">
                <div className="flex gap-3 items-center">
                  <div className="w-9 h-9 bg-gray-100 rounded-full" />
                  <div className="space-y-1 flex-1"><Skeleton className="h-3 w-32" /><Skeleton className="h-2 w-24" /></div>
                </div>
              </div>
            ) : linkedin.connected && linkedin.account ? (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-medium">
                      {user?.email?.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                    <p className="text-xs text-gray-500">{linkedin.account.plan_type} · Session active</p>
                    {verifyingLinkedin && (
                      <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-pulse" />
                        Getting updated status...
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={connectLinkedIn} disabled={connecting} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">
                    {connecting ? 'Connecting...' : 'Reconnect'}
                  </button>
                  <button onClick={disconnectLinkedIn} disabled={disconnecting} className="btn-danger text-xs px-3 py-1.5 disabled:opacity-50">
                    {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z" />
                    <rect x="2" y="9" width="4" height="12" />
                    <circle cx="4" cy="4" r="2" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">LinkedIn not connected</p>
                <p className="text-xs text-gray-500 mb-4">Connect your LinkedIn to start campaigns</p>
                <button onClick={connectLinkedIn} disabled={connecting} className="btn-primary text-xs px-4 py-2 disabled:opacity-50">
                  {connecting ? 'Connecting...' : 'Connect LinkedIn'}
                </button>
              </div>
            )}
            {disconnectError && <p className="text-xs text-red-500 mt-3">⚠ {disconnectError}</p>}
            {disconnectWarning && <p className="text-xs text-amber-600 mt-3">ⓘ {disconnectWarning}</p>}
          </div>

          {/* LinkedIn Information - new GET /settings/linkedin/profile endpoint */}
          <div className="card">
            <p className="text-sm font-medium text-gray-900 mb-4">LinkedIn Information</p>
            {linkedinProfileLoading ? (
              <div className="space-y-2 animate-pulse"><Skeleton className="h-3 w-32" /><Skeleton className="h-3 w-40" /><Skeleton className="h-3 w-24" /></div>
            ) : !linkedin.connected ? (
              <p className="text-xs text-gray-400 py-4 text-center">Connect LinkedIn to see profile information</p>
            ) : linkedinProfileUnavailable ? (
              <p className="text-xs text-gray-400 py-4 text-center">Couldn&apos;t load LinkedIn profile information.</p>
            ) : linkedinProfile ? (
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500 flex-shrink-0">Name</dt>
                  <dd className="text-gray-900 font-medium text-right truncate">{linkedinProfile.name || '-'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500 flex-shrink-0">Title</dt>
                  <dd className="text-gray-900 text-right truncate">{linkedinProfile.title || '-'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500 flex-shrink-0">Location</dt>
                  <dd className="text-gray-900 text-right truncate">{linkedinProfile.location || '-'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500 flex-shrink-0">Email</dt>
                  <dd className="text-gray-900 text-right truncate">{linkedinProfile.email || '-'}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-gray-400 py-4 text-center">No profile information available</p>
            )}
          </div>

          {/* Dream companies */}
          <div className="card">
            <p className="text-sm font-medium text-gray-900 mb-1">Dream companies</p>
            <p className="text-xs text-gray-400 mb-3">HRs at these companies get automatic high priority</p>
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
              {dreamCompanies.map(c => (
                <span key={c} className="bg-brand-light text-brand-dark text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                  {c}
                  <button onClick={() => removeChip(c, dreamCompanies, setDreamCompanies)} className="hover:text-red-500 text-base leading-none">×</button>
                </span>
              ))}
              {dreamCompanies.length === 0 && <span className="text-xs text-gray-400">No companies added yet</span>}
            </div>
            <input value={chipInput} onChange={e => setChipInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addChip(chipInput, dreamCompanies, setDreamCompanies, setChipInput)}
              placeholder="Type company name + Enter" className="input text-xs" />
          </div>

          {/* Tech stack */}
          <div className="card">
            <p className="text-sm font-medium text-gray-900 mb-1">Tech stack</p>
            <p className="text-xs text-gray-400 mb-3">Used for ATS scoring against job requirements</p>
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
              {techStack.map(t => (
                <span key={t} className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                  {t}
                  <button onClick={() => removeChip(t, techStack, setTechStack)} className="hover:text-red-500 text-base leading-none">×</button>
                </span>
              ))}
              {techStack.length === 0 && <span className="text-xs text-gray-400">No skills added yet</span>}
            </div>
            <input value={techInput} onChange={e => setTechInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addChip(techInput, techStack, setTechStack, setTechInput)}
              placeholder="e.g. React, Python, LangChain + Enter" className="input text-xs" />
          </div>

          {/* Daily limits - now usage bars, tier-aware shape, live endpoint */}
          <div className="card">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-900">Daily limits</p>
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium capitalize">{limits.tier} tier</span>
            </div>
            {limitsIsDummy && (
              <p className="text-[11px] text-gray-400 mb-3">Couldn&apos;t load your current limits - showing defaults for now.</p>
            )}
            <div className="space-y-4 mt-2">
              {/* Mutually exclusive on the backend: free gets its own
                  independent "profile views" cap, every other plan gets a
                  shared "credits" pool instead (discovery/enrichment and
                  messaging both spend from it) -- see DailyLimits above. */}
              {([
                { key: 'connection_requests' as const, label: 'Connection requests' },
                limits.credits
                  ? { key: 'credits' as const, label: 'Credits' }
                  : { key: 'profile_views' as const, label: 'Profile views' },
                { key: 'dms' as const, label: 'DMs per day' },
              ]).map(l => {
                const field = limits[l.key]
                if (!field) return null
                const pct = field.limit > 0 ? Math.min(100, Math.round((field.used / field.limit) * 100)) : 0
                return (
                  <div key={l.key}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-500">{l.label}</span>
                      <span className="text-gray-700 font-medium">
                        {field.used}/
                        <input
                          type="number"
                          value={field.limit}
                          min={0}
                          onChange={e => setLimits(prev => ({
                            ...prev, [l.key]: { ...prev[l.key], limit: Number(e.target.value) }
                          }))}
                          className="w-10 text-center border border-gray-200 rounded ml-0.5 focus:outline-none focus:border-brand"
                        />
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    {l.key === 'credits' && 'discovery_cost' in field && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        {field.discovery_cost} credits per profile viewed/enriched, {field.message_cost} per message sent
                      </p>
                    )}
                    {field.note && (
                      <p className="text-[10px] text-gray-400 mt-1">{field.note}</p>
                    )}
                  </div>
                )
              })}
              {/* free only -- shown for awareness, not editable: nothing
                  tracks usage against it yet, so there's no bar/input,
                  just the ceiling itself. */}
              {limits.monthly_credits_info && (
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-500">Credits</span>
                    <span className="text-gray-700 font-medium">-/{limits.monthly_credits_info.limit} per month</span>
                  </div>
                  {limits.monthly_credits_info.note && (
                    <p className="text-[10px] text-gray-400 mt-1">{limits.monthly_credits_info.note}</p>
                  )}
                </div>
              )}
            </div>
            <button onClick={saveLimits} disabled={savingLimits} className="btn-secondary text-xs px-3 py-1.5 mt-4 disabled:opacity-50">
              {savingLimits ? 'Saving...' : 'Save limits'}
            </button>
          </div>

          {/* Notifications - now also shows InMail credits, moved here from its own card */}
          <div className="card">
            <p className="text-sm font-medium text-gray-900 mb-1">Notifications</p>
            {notifIsDummy && (
              <p className="text-[11px] text-gray-400 mb-3">Couldn&apos;t save your preference - please try again.</p>
            )}
            <div className="space-y-3 mt-2">
              {([
                { key: 'email_on_reply' as const, label: 'Email me when someone replies' },
                { key: 'daily_digest' as const, label: 'Daily summary digest' },
              ]).map(n => (
                <label key={n.key} className="flex items-center justify-between text-xs text-gray-600 cursor-pointer">
                  {n.label}
                  <input type="checkbox" checked={notifPrefs[n.key]} onChange={() => toggleNotif(n.key)} />
                </label>
              ))}
            </div>

            <div className="border-t border-gray-100 mt-4 pt-4">
              <p className="text-xs font-medium text-gray-700 mb-2">InMail credits</p>
              {loading ? (
                <div className="space-y-2 animate-pulse"><Skeleton className="h-3 w-full" /><Skeleton className="h-2 w-full" /></div>
              ) : linkedin.connected && linkedin.account ? (
                <div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-gray-500">{linkedin.account.plan_type}</span>
                    <span className={`font-medium ${linkedin.account.inmail_credits_remaining < 3 ? 'text-amber-500' : 'text-gray-900'}`}>
                      {linkedin.account.inmail_credits_remaining} / {linkedin.account.inmail_credits_total} remaining
                    </span>
                  </div>
                  <div className="progress-bg mb-2">
                    <div className="progress-bar" style={{ width: `${(linkedin.account.inmail_credits_remaining / Math.max(linkedin.account.inmail_credits_total, 1)) * 100}%` }} />
                  </div>
                  {linkedin.account.inmail_credits_remaining < 3 && (
                    <p className="text-xs text-amber-500 flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                      Running low on credits
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-2">Connect LinkedIn to see credit balance</p>
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div className="card">
            <p className="text-sm font-medium text-gray-900 mb-3">Recent activity</p>
            {activity === null ? (
              <div className="space-y-2 animate-pulse py-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ) : activity.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {activity.map(a => (
                  <div key={a.id} className="flex justify-between text-xs">
                    <span className="text-gray-600">{a.label}</span>
                    <span className="text-gray-400">{new Date(a.timestamp).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Warm-up */}
          <div className="card">
            <p className="text-sm font-medium text-gray-900 mb-4">Warm-up mode</p>
            {loading ? (
              <div className="space-y-2 animate-pulse"><Skeleton className="h-3 w-full" /><Skeleton className="h-2 w-3/4" /></div>
            ) : linkedin.connected ? (
              <div>
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-gray-500">Status</span>
                  <span className={`font-medium ${linkedin.account?.warm_up_complete ? 'text-brand' : 'text-amber-500'}`}>
                    {linkedin.account?.warm_up_complete ? 'Complete' : 'In progress'}
                  </span>
                </div>
                <div className="progress-bg">
                  <div className="progress-bar" style={{ width: linkedin.account?.warm_up_complete ? '100%' : '40%' }} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-3">Connect LinkedIn to see warm-up status</p>
            )}
          </div>
        </div>

        <div className="mt-5">
          <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save changes'}
          </button>
        </div>

        {/* Danger zone */}
        <div className="border border-red-200 rounded-xl px-4 py-3 mt-8 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-red-600">Danger zone</p>
            <p className="text-xs text-gray-500">Export your data, or delete this account (20-day window to restore it, then permanently deleted)</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportData} disabled={exporting} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">
              {exporting ? 'Exporting...' : 'Export data'}
            </button>
            <button onClick={deleteAccount} disabled={deleting} className="btn-danger text-xs px-3 py-1.5 disabled:opacity-50">
              {deleting ? 'Deleting...' : 'Delete account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">Loading...</div>}>
      <SettingsContent />
    </Suspense>
  )
}
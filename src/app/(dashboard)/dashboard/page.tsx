'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import Header from '@/components/layout/Header'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { ModeBadge, StatusBadge } from '@/components/ui/Badges'
import { campaignsApi, connectionsApi, authApi, accountApi } from '@/lib/api'
import { useInMail } from '@/context/InMailContext'
import { useLinkedInStatus } from '@/hooks/useLinkedInStatus'
import CareerPlanActivatedToast from '@/app/activate/CareerPlanActivatedToast'
import CreatePasswordBanner from '@/components/CreatePasswordBanner'
import GrowthPromoBanner from '@/components/GrowthPromoBanner'

interface Stats { total_sent: number; total_accepted: number; total_replied: number; acceptance_rate: number; reply_rate: number }
interface Campaign { id: string; name: string; mode: string; status: string; stats?: { sent: number; accepted: number; total: number } }

function MetricCard({ label, value, sub, warn }: { label: string; value: string | number; sub?: string; warn?: boolean }) {
  return (
    <div className="card">
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <p className={`text-2xl font-medium ${warn ? 'text-amber-500' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${warn ? 'text-amber-400' : 'text-gray-400'}`}>{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  // useSWR renders whatever's already cached for these keys immediately
  // (e.g. from a previous visit this session) and revalidates in the
  // background -- no more manual cache.get/set bookkeeping, and no more
  // waiting on a fresh network round-trip every time this page mounts.
  const { data: campaignsData, isLoading: campaignsLoading, mutate: mutateCampaigns } =
    useSWR<{ campaigns: Campaign[] }>('/campaigns/stats')
  const { data: stats, isLoading: statsLoading, mutate: mutateStats } =
    useSWR<Stats>('/analytics/overview')
  const campaigns = campaignsData?.campaigns || []
  // isLoading is only true on a genuine first fetch with nothing cached yet
  // -- a background revalidation of already-cached data doesn't flip this,
  // so the page doesn't re-flash a skeleton over data it's already showing.
  const loading = campaignsLoading || statsLoading

  const [startingId, setStartingId] = useState<string | null>(null)
  const [pausingId, setPausingId] = useState<string | null>(null)
  const { count: inmailCount } = useInMail()

  // Same gate as /campaigns and /campaigns/new -- both of those already
  // enforce this for real, this is just so the dashboard's own
  // shortcuts (empty-state button, quick link) don't point somewhere
  // that's just going to bounce the person right back to a locked page.
  const { connected: linkedinConnected, loading: linkedinLoading } = useLinkedInStatus()
  const [hasSyncedOnce, setHasSyncedOnce] = useState<boolean | null>(null)

  useEffect(() => {
    if (linkedinLoading || !linkedinConnected) return
    connectionsApi.syncStatus()
      .then(s => setHasSyncedOnce(!!s?.last_synced_at))
      .catch(() => setHasSyncedOnce(false))
  }, [linkedinConnected, linkedinLoading])

  const campaignsUnlocked = linkedinConnected === true && hasSyncedOnce === true
  const newCampaignHref = campaignsUnlocked
    ? '/campaigns/new'
    : (!linkedinLoading && linkedinConnected === false)
      ? '/settings'
      : '/campaigns'

  // Genuinely new: has_completed_first_load has existed as a column
  // since the career-plan migrations, but nothing ever read or wrote
  // it until now. null = not known yet, true = this really is their
  // first successful load ever, false = they've loaded before.
  const [isFirstLoad, setIsFirstLoad] = useState<boolean | null>(null)
  const [showCenteredLoader, setShowCenteredLoader] = useState(false)
  const centeredLoaderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    authApi.me()
      .then(data => setIsFirstLoad(data?.has_completed_first_load === false))
      .catch(() => setIsFirstLoad(false))
  }, [])

  useEffect(() => {
    // Only ever arms for a genuine first-time load, and only after a
    // 400ms delay -- a fast load never gets the centered treatment,
    // same "don't flash it for no reason" principle used elsewhere.
    if (isFirstLoad === true && loading) {
      centeredLoaderTimerRef.current = setTimeout(() => setShowCenteredLoader(true), 400)
    }
    return () => { if (centeredLoaderTimerRef.current) clearTimeout(centeredLoaderTimerRef.current) }
  }, [isFirstLoad, loading])

  useEffect(() => {
    if (!loading) {
      setShowCenteredLoader(false)
      if (isFirstLoad === true) {
        setIsFirstLoad(false)
        accountApi.markFirstLoadSeen().catch(() => {})
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const handleStart = async (campaignId: string) => {
    setStartingId(campaignId)
    try {
      await campaignsApi.start(campaignId)
      await Promise.all([mutateCampaigns(), mutateStats()])
    } catch { }
    finally { setStartingId(null) }
  }

  const handlePause = async (campaignId: string) => {
    setPausingId(campaignId)
    try {
      await campaignsApi.pause(campaignId)
      await Promise.all([mutateCampaigns(), mutateStats()])
    } catch { }
    finally { setPausingId(null) }
  }

  const active = campaigns.filter(c => c.status === 'running')

  return (
    <div>
      <CareerPlanActivatedToast />
      <Header title="Dashboard" subtitle="Your outreach at a glance" />
      <div className="p-4 md:p-6 space-y-6">

        <GrowthPromoBanner />
        <CreatePasswordBanner />

        {showCenteredLoader && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center animate-pulse">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </div>
            <p className="text-sm text-gray-500">Setting up your dashboard...</p>
          </div>
        )}

        {!showCenteredLoader && (
        <>
        {inmailCount > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#991B1B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-red-800 font-medium">{inmailCount} InMail{inmailCount > 1 ? 's' : ''} need your approval</span>
            </div>
            <Link href="/inmail" className="text-xs text-red-700 font-medium hover:text-red-900">Review →</Link>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {loading ? [1,2,3,4,5].map(i => <SkeletonCard key={i} />) : (
            <>
              <MetricCard
                label="Discovered"
                value={campaigns.reduce((sum, c) => sum + (c.stats?.total ?? 0), 0)}
                sub="Across all campaigns"
              />
              <MetricCard label="Total sent" value={stats?.total_sent ?? 0} sub="All campaigns" />
              <MetricCard label="Accepted" value={stats?.total_accepted ?? 0} sub={`${stats?.acceptance_rate ?? 0}% rate`} />
              <MetricCard label="Replied" value={stats?.total_replied ?? 0} sub={`${stats?.reply_rate ?? 0}% reply rate`} />
              <MetricCard label="Active campaigns" value={active.length} sub={`${campaigns.length} total`} />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">Active campaigns</p>
              <Link href="/campaigns" className="text-xs text-brand hover:text-brand-darker">View all →</Link>
            </div>
            {loading ? (
              [1,2].map(i => <div key={i} className="card animate-pulse space-y-2"><div className="h-4 bg-gray-100 rounded w-48" /><div className="h-3 bg-gray-100 rounded w-full" /></div>)
            ) : campaigns.length === 0 ? (
              <div className="card flex flex-col items-center py-10 text-center">
                <div className="w-10 h-10 rounded-full bg-brand-light flex items-center justify-center mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">No active campaigns</p>
                <p className="text-xs text-gray-500 mb-4">
                  {campaignsUnlocked
                    ? 'Create your first campaign to start outreach'
                    : linkedinConnected === false
                      ? 'Connect LinkedIn to get started'
                      : 'Sync your connections to get started'}
                </p>
                <Link href={newCampaignHref} className="btn-primary">
                  {campaignsUnlocked ? 'Create campaign' : linkedinConnected === false ? 'Connect LinkedIn' : 'Sync connections'}
                </Link>
              </div>
            ) : (
              <>
                {active.length === 0 && (
                  <p className="text-xs text-gray-500 -mt-1 mb-1">
                    Nothing&apos;s running right now - start one of your existing campaigns below.
                  </p>
                )}
                {(active.length > 0 ? active : campaigns).map(c => {
                  const s = c.stats ?? { sent: 0, accepted: 0, total: 0 }
                  const progress = s.total > 0 ? Math.round((s.sent / s.total) * 100) : 0
                  const isRunning = c.status === 'running'
                  return (
                    <Link key={c.id} href={`/campaigns/${c.id}`} className="card block hover:border-brand transition-colors cursor-pointer">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{c.name}</span>
                        <div className="flex gap-2 items-center flex-shrink-0">
                          <ModeBadge mode={c.mode} /><StatusBadge status={c.status} />
                          {isRunning ? (
                            <button
                              onClick={e => { e.preventDefault(); e.stopPropagation(); handlePause(c.id) }}
                              disabled={pausingId === c.id}
                              className="text-[10px] px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 font-medium"
                            >
                              {pausingId === c.id ? 'Pausing...' : 'Pause'}
                            </button>
                          ) : (
                            <button
                              onClick={e => { e.preventDefault(); e.stopPropagation(); handleStart(c.id) }}
                              disabled={startingId === c.id}
                              className="text-[10px] px-2 py-1 rounded-lg bg-brand text-white hover:opacity-90 disabled:opacity-50 font-medium"
                            >
                              {startingId === c.id ? 'Starting...' : 'Start'}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-500 mb-2">
                        <span><b className="text-gray-900">{s.total}</b> discovered</span>
                        <span><b className="text-gray-900">{s.sent}</b> sent</span>
                        <span className="text-brand"><b>{s.accepted}</b> accepted</span>
                      </div>
                      <div className="progress-bg"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
                    </Link>
                  )
                })}
                <Link
                  href={newCampaignHref}
                  className="card flex items-center justify-center py-4 border-dashed hover:border-brand transition-colors"
                >
                  <span className="btn-primary inline-flex items-center gap-1.5">
                    <span className="text-base leading-none">+</span> Create new campaign
                  </span>
                </Link>
              </>
            )}
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="card">
              <p className="text-sm font-medium text-gray-900 mb-3">Quick links</p>
              <div className="space-y-2">
                {[
                  { href: '/history', label: 'Outreach history', icon: '🕐' },
                  { href: newCampaignHref, label: 'New campaign', icon: '➕' },
                  { href: '/settings', label: 'LinkedIn settings', icon: '🔗' },
                ].map(l => (
                  <Link key={l.href} href={l.href} className="flex items-center gap-2 text-xs text-gray-600 hover:text-brand py-1">
                    <span>{l.icon}</span>{l.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="card">
              <p className="text-sm font-medium text-gray-900 mb-3">Account health</p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Total sent</span><span className="font-medium text-gray-900">{stats?.total_sent ?? 0}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Acceptance rate</span><span className="font-medium text-gray-900">{stats?.acceptance_rate ?? 0}%</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Reply rate</span><span className="font-medium text-gray-900">{stats?.reply_rate ?? 0}%</span></div>
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  )
}
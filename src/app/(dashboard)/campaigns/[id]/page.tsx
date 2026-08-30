'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import { ModeBadge, StatusBadge } from '@/components/ui/Badges'
import { Skeleton, SkeletonRow } from '@/components/ui/Skeleton'
import { campaignsApi, targetsApi } from '@/lib/api'
import { cache } from '@/lib/cache'
import { useLinkedInStatus } from '@/hooks/useLinkedInStatus'
import ConnectionOutreachCampaignDetail from './ConnectionOutreachCampaignDetail'
import type { Campaign, CampaignSchedule, OutreachTarget } from '@/types'
import React from 'react'

// Same America/Chicago convention already used in analytics/page.tsx --
// every date/time on this page renders in CST/CDT regardless of the
// viewer's own browser timezone, not just here but consistently across
// the app.
const CST = 'America/Chicago'
function formatCSTDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { timeZone: CST, month: 'short', day: 'numeric' })
}
function formatCSTDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: CST, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }) + ' CT'
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface RunConfig {
  test_mode: boolean
  limit: number
  research_depth: 'basic' | 'pro' | 'advanced'
  message_model: 'haiku' | 'sonnet'
  dry_run: boolean
}

interface CampaignRun {
  id: string
  status: string
  run_config: { test_mode: boolean; limit: number }
  targets_found: number
  targets_sent: number
  targets_drafted: number
  targets_skipped: number
  started_at: string
  completed_at: string | null
  errors: string[]
}

type RunStatus = 'idle' | 'running' | 'success' | 'failed'


const TEST_MODE_CAP = 6
const LIVE_MODE_MAX = 100
const LIVE_APPROVAL_GATE = 5

function ActionBadge({ action }: { action: string | null }) {
  if (!action) return <span className="text-gray-300">-</span>
  const styles: Record<string, string> = {
    connection_request: 'bg-blue-100 text-blue-700',
    email: 'bg-purple-100 text-purple-700',
    inmail: 'bg-green-100 text-green-700',
  }
  const labels: Record<string, string> = {
    connection_request: 'connection',
    email: 'email',
    inmail: 'inmail',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${styles[action] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[action] ?? action}
    </span>
  )
}

function dedupeSortTargets(raw: OutreachTarget[]): OutreachTarget[] {
  const sorted = [...raw].sort((a, b) =>
    new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  )
  const seen = new Map<string, OutreachTarget>()
  for (const target of sorted) {
    const key = target.linkedin_url || target.id
    if (!seen.has(key)) seen.set(key, target)
  }
  return Array.from(seen.values())
}

function getLatestRun<T extends { started_at: string }>(runs: T[]): T | null {
  if (runs.length === 0) return null
  return [...runs].sort((a, b) =>
    new Date(b.started_at ?? 0).getTime() - new Date(a.started_at ?? 0).getTime()
  )[0]
}

function RunModeBadge({ testMode }: { testMode: boolean }) {
  return testMode
    ? <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-500">test</span>
    : <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-50 text-amber-600">live</span>
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [targets, setTargets] = useState<OutreachTarget[]>([])
  const [runs, setRuns] = useState<CampaignRun[]>([])
  const [loading, setLoading] = useState(true)
  const [showRunModal, setShowRunModal] = useState(false)
  const [showRunsModal, setShowRunsModal] = useState(false)
  const [running, setRunning] = useState(false)
  const [pausing, setPausing] = useState(false)
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [runMessage, setRunMessage] = useState<string | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [expandedTarget, setExpandedTarget] = useState<string | null>(null)
  // Per-target approve/reject loading states
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  // "Get more details" -- on-demand single-target enrichment. Confirm
  // dialog holds the target awaiting the 5-credit confirmation; enrichingId
  // tracks the actual in-flight call once confirmed.
  const [enrichConfirmTarget, setEnrichConfirmTarget] = useState<OutreachTarget | null>(null)
  const [enrichingId, setEnrichingId] = useState<string | null>(null)
  const [enrichError, setEnrichError] = useState<Record<string, string>>({})
  // "View more details" -- shown instead of the 5-credit confirm once a
  // target's already been enriched. Free: just reads what /enrich already
  // found. recomposingId/recomposeError back the manual InMail<->connection
  // override inside that panel (POST /targets/{id}/recompose, also free --
  // reuses the same enrichment data, no new Unipile call).
  const [viewDetailsTarget, setViewDetailsTarget] = useState<OutreachTarget | null>(null)
  const [recomposingId, setRecomposingId] = useState<string | null>(null)
  const [recomposeError, setRecomposeError] = useState<string | null>(null)
  const [approveError, setApproveError] = useState<Record<string, string>>({})
  const [reviewSortOrder, setReviewSortOrder] = useState<'latest' | 'earliest'>('latest')
  const [reviewCollapsed, setReviewCollapsed] = useState(false)
  const [reviewPage, setReviewPage] = useState(1)
  const REVIEW_PAGE_SIZE = 5
  const [runPreviewTargets, setRunPreviewTargets] = useState<OutreachTarget[]>([])
  const [runPreviewLoading, setRunPreviewLoading] = useState(false)
  const [runPreviewUnavailable, setRunPreviewUnavailable] = useState(false)
  const RUN_PREVIEW_COUNT = 5
  const [targetsTablePage, setTargetsTablePage] = useState(1)
  const TARGETS_PAGE_SIZE = 10

  const [runConfig, setRunConfig] = useState<RunConfig>({
    test_mode: true,
    limit: 3,
    research_depth: 'basic',
    message_model: 'haiku',
    dry_run: false,
  })

  // Schedule panel state -- separate from runConfig since this is a
  // persistent per-campaign setting the scheduler reads, not a per-click
  // run option. Loaded on mount, saved on demand via the panel's own
  // Save button, editable anytime per the requirement that this isn't
  // locked in at launch.
  const [schedule, setSchedule] = useState<CampaignSchedule | null>(null)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleSaved, setScheduleSaved] = useState(false)
  // True only when saving settings just paused an in-flight campaign --
  // drives the "click Rerun to start with updated settings" banner.
  const [settingsPausedNotice, setSettingsPausedNotice] = useState(false)
  const [dailyLimitDraft, setDailyLimitDraft] = useState<number>(20)
  const [discoveryTierDraft, setDiscoveryTierDraft] = useState<'basic' | 'pro' | 'advanced'>('basic')

  // people-finder campaigns get an immediate single-target run instead of
  // the discovery-run modal -- these people are already known, there's
  // nothing to "discover."
  const [runningNow, setRunningNow] = useState(false)
  const [runNowMessage, setRunNowMessage] = useState<string | null>(null)
  // Not premium => connection notes get truncated to LinkedIn's shorter
  // free-tier cap and can get silently dropped if the account's free
  // monthly note quota is used up (see clients/unipile.py's 422 retry).
  // Purely informational -- doesn't change what gets sent. Shared SWR
  // cache instead of its own fetch -- was a 5th call inside fetchData()
  // below, duplicating what every other page already fetches.
  const { account: linkedinAccount } = useLinkedInStatus()
  const linkedInPlanType = linkedinAccount?.plan_type ?? null

  // Live "first 5 drafting" progress -- polls quietly in the background
  // while the campaign is still gated, so the counter and captions move
  // on their own instead of only updating when the user manually refreshes.
  const gatePollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [gateCaptionIndex, setGateCaptionIndex] = useState(0)
  const GATE_CAPTIONS = [
    'Checking their recent LinkedIn activity...',
    'Looking for an active hiring signal...',
    'Drafting a personalized note...',
    'Almost ready for your review...',
  ]
  // Stall detection: if the drafted count hasn't actually moved for a
  // while, nothing is polling this campaign automatically (no scheduler
  // tick wired in) -- no point hammering the backend every few seconds
  // forever with zero chance of a different answer. Tracks the last
  // count seen and when it last genuinely changed.
  const gateProgressRef = useRef<{ count: number; lastChangedAt: number }>({ count: -1, lastChangedAt: Date.now() })
  const [gateStalled, setGateStalled] = useState(false)
  const GATE_STALL_THRESHOLD_MS = 2 * 60 * 1000  // 2 min -- matches what the banner already promises
  const GATE_POLL_ACTIVE_MS = 8000               // while actively expecting progress
  const GATE_POLL_STALLED_MS = 30000             // backed off once stalled -- still checks, just far less often
  // The moment autonomous_approved first flips true -- used for the
  // 1-minute buffer below so the switch to "Autopilot mode is on" doesn't
  // happen on the exact same render as the 5th approval, which reads as
  // abrupt. Null until we've actually seen it happen once.
  const [autopilotFlippedAt, setAutopilotFlippedAt] = useState<number | null>(null)
  const [autopilotRevealed, setAutopilotRevealed] = useState(false)

  const fetchData = async () => {
    if (!id) return
    const [c, t, r, s] = await Promise.all([
      campaignsApi.get(id).catch(() => null),
      targetsApi.list(id).catch(() => ({ targets: [] })),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/campaigns/${id}/runs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('nexara_token') ?? ''}` }
      }).then(r => r.json()).catch(() => ({ runs: [] })),
      campaignsApi.getSchedule(id).catch(() => null),
    ])
    setCampaign(c)
    if (c) {
      setDailyLimitDraft(c.daily_limit ?? 20)
      setDiscoveryTierDraft(c.discovery_tier ?? 'basic')
      // Run Campaign modal's tier picker used to always start at 'basic'
      // regardless of what was already chosen at creation/in Automation
      // settings, forcing the user to re-pick it on every single manual
      // run. Default it to the campaign's own stored tier instead --
      // still a real, changeable choice per run, just not reset every time.
      setRunConfig(rc => ({ ...rc, research_depth: c.discovery_tier ?? 'basic' }))
    }
    if (s) setSchedule(s)

    const raw = (t as { targets: OutreachTarget[] })?.targets || []
    const deduped = dedupeSortTargets(raw)
    setTargets(deduped)
    const runList = (r as { runs: CampaignRun[] })?.runs || []
    setRuns(runList)

    // Cache the composite so re-visiting this campaign paints instantly;
    // short TTL since approve/reject and in-flight runs change this often.
    cache.set(`campaign_detail:${id}`, { campaign: c, targets: deduped, runs: runList }, 15)
  }

  useEffect(() => {
    if (!id) return
    // Stale-while-revalidate: paint from cache immediately if we have it
    // (skips the loading skeleton entirely on repeat visits), then always
    // refetch in the background so the view is never more than ~15s stale.
    const cached = cache.get<{ campaign: Campaign | null; targets: OutreachTarget[]; runs: CampaignRun[] }>(
      `campaign_detail:${id}`
    )
    if (cached) {
      setCampaign(cached.campaign)
      setTargets(cached.targets)
      setRuns(cached.runs)
      setLoading(false)
    }
    fetchData().finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  // 1-minute buffer before switching the UI to "Autopilot mode is on" --
  // flipping the badge on the exact same render as the 5th approval reads
  // as abrupt. Records the moment autonomous_approved first turns true,
  // then waits 60s before actually revealing the autopilot state.
  useEffect(() => {
    if (campaign?.autonomous_approved && autopilotFlippedAt === null) {
      setAutopilotFlippedAt(Date.now())
    }
    if (!campaign?.autonomous_approved) {
      setAutopilotFlippedAt(null)
      setAutopilotRevealed(false)
    }
  }, [campaign?.autonomous_approved, autopilotFlippedAt])

  useEffect(() => {
    if (autopilotFlippedAt === null || autopilotRevealed) return
    const elapsed = Date.now() - autopilotFlippedAt
    const remaining = Math.max(0, 60000 - elapsed)
    const t = setTimeout(() => setAutopilotRevealed(true), remaining)
    return () => clearTimeout(t)
  }, [autopilotFlippedAt, autopilotRevealed])

  // Fetch a small preview of targets belonging to the run shown in the
  // "Last Run Results" modal. This hits an endpoint that requires
  // campaign_run_id to exist on outreach_targets — until that's wired up
  // on the backend, it 404s and we just hide the preview section.
  useEffect(() => {
    const runId = getLatestRun(runs)?.id
    if (!showRunsModal || !id || !runId) {
      setRunPreviewTargets([])
      setRunPreviewUnavailable(false)
      return
    }
    const cacheKey = `run_targets:${id}:${runId}`
    const cached = cache.get<OutreachTarget[]>(cacheKey)
    if (cached) {
      setRunPreviewTargets(cached)
      setRunPreviewUnavailable(false)
      setRunPreviewLoading(false)
    } else {
      setRunPreviewLoading(true)
      setRunPreviewUnavailable(false)
    }
    let cancelled = false
    campaignsApi.runTargets(id, runId)
      .then(res => {
        if (cancelled) return
        const list = res.targets || []
        setRunPreviewTargets(list)
        cache.set(cacheKey, list, 60)
      })
      .catch(() => {
        if (cancelled) return
        if (!cached) {
          setRunPreviewUnavailable(true)
          setRunPreviewTargets([])
        }
      })
      .finally(() => { if (!cancelled) setRunPreviewLoading(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRunsModal, id, runs])

  const effectiveLimit = runConfig.test_mode
    ? Math.min(runConfig.limit, TEST_MODE_CAP)
    : runConfig.limit

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  const startPolling = (expectedLimit: number) => {
    let attempts = 0
    const maxAttempts = 20
    pollRef.current = setInterval(async () => {
      attempts++
      try {
        const t = await targetsApi.list(id!)
        const raw = (t as { targets: OutreachTarget[] })?.targets || []
        const newTargets = dedupeSortTargets(raw)
        setTargets(newTargets)
        cache.set(`campaign_detail:${id}`, { campaign, targets: newTargets, runs }, 15)
        const withMessages = newTargets.filter(x => x.message_sent)
        if (withMessages.length >= expectedLimit) {
          stopPolling()
          setRunStatus('success')
          setRunMessage(`Done! Found ${newTargets.length} targets, composed ${withMessages.length} messages.`)
          campaignsApi.get(id!).then(c => setCampaign(c)).catch(() => {})
          return
        }
        if (attempts >= maxAttempts) {
          stopPolling()
          if (withMessages.length > 0) {
            setRunStatus('success')
            setRunMessage(`Completed. Composed ${withMessages.length} messages.`)
          } else {
            setRunStatus('failed')
            setRunMessage('No targets found. Check discovery source or campaign filters.')
          }
          campaignsApi.get(id!).then(c => setCampaign(c)).catch(() => {})
          return
        }
        setRunMessage(`Agent running... ${attempts * 3}s`)
      } catch {
        stopPolling()
        setRunStatus('failed')
        setRunMessage('Failed to fetch results.')
      }
    }, 3000)
  }

  const handleRun = async () => {
    if (!id) return
    setRunning(true)
    setRunError(null)
    setRunMessage(null)
    setRunStatus('running')
    stopPolling()
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('nexara_token') : ''
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/campaigns/${id}/run`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
          body: JSON.stringify({ ...runConfig, limit: effectiveLimit }),
        }
      )
      if (!res.ok) {
        const err = await res.json() as { detail?: string }
        throw new Error(err.detail ?? 'Run failed')
      }
      setRunMessage('Agent started. Discovering targets...')
      campaignsApi.get(id).then(c => setCampaign(c)).catch(() => {})
      startPolling(effectiveLimit)
    } catch (e) {
      setRunStatus('failed')
      setRunError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setRunning(false)
    }
  }

  const handlePause = async () => {
    if (!id || pausing) return
    setPausing(true)
    try {
      stopPolling()
      await campaignsApi.pause(id)
      const u = await campaignsApi.get(id)
      setCampaign(u)
    } catch { } finally { setPausing(false) }
  }

  // Replaces the old separate "Start" button. One click: un-pause, then
  // immediately do whatever the primary action for this campaign type is
  // -- Run Now for people-finder campaigns, open the discovery-run modal
  // for everything else. No second click needed to actually make
  // something happen, which was the exact confusion being fixed here.
  const handleResume = async () => {
    if (!id) return
    try {
      await campaignsApi.start(id)
      const u = await campaignsApi.get(id)
      setCampaign(u)
      if (u.source === 'people_finder') {
        await handleRunNow()
      } else {
        setShowRunModal(true); setRunStatus('idle'); setRunMessage(null); setRunError(null)
      }
    } catch { }
  }

  // people-finder campaigns: no discovery to run, so "Run Now" processes
  // one already-known pending target immediately instead of opening the
  // discovery-run modal. Backend still enforces the per-account mutex --
  // this can report skipped_busy if something else is already in flight.
  const handleRunNow = async () => {
    if (!id || runningNow) return
    setRunningNow(true)
    setRunNowMessage(null)
    try {
      const result = await campaignsApi.runNow(id)
      if (result.status === 'processed') {
        const gate = campaign?.live_approval_gate ?? 5
        setRunNowMessage(
          campaign?.autonomous_approved
            ? 'Started processing the next pending person automatically.'
            : `Started processing the next pending person. Approve the first ${gate} connection requests to turn on autopilot mode.`
        )
      } else if (result.status === 'skipped_busy') {
        setRunNowMessage('Another target is already in flight for this account -- try again shortly.')
      } else if (result.status === 'no_pending_targets') {
        setRunNowMessage('No pending targets to process.')
      } else if (result.status === 'paused') {
        setRunNowMessage('This campaign is paused -- resume it before running manually.')
      } else {
        setRunNowMessage(result.detail ?? `Status: ${result.status}`)
      }
      await fetchData()
    } catch (e) {
      setRunNowMessage(e instanceof Error ? e.message : 'Run failed')
    } finally {
      setRunningNow(false)
    }
  }

  const handleSaveSchedule = async () => {
    if (!id || scheduleSaving) return
    setScheduleSaving(true)
    setScheduleSaved(false)
    try {
      const updated = await campaignsApi.updateSchedule(id, {
        enabled: schedule?.enabled ?? true,
        days_of_week: schedule?.days_of_week ?? [1, 2, 3, 4, 5],
        window_start_local: schedule?.window_start_local ?? '09:00',
        window_end_local: schedule?.window_end_local ?? '18:00',
      })
      setSchedule(updated)
      // Daily limit and discovery tier live on the campaign row itself,
      // not the schedule table -- saved via the existing generic update
      // endpoint alongside the schedule so one Save button covers both.
      const campaignUpdates: { daily_limit: number; discovery_tier?: string } = { daily_limit: dailyLimitDraft }
      if (campaign?.source !== 'people_finder') campaignUpdates.discovery_tier = discoveryTierDraft
      let updatedCampaign = await campaignsApi.update(id, campaignUpdates)
      // A campaign already in flight shouldn't keep running on settings
      // that no longer match what's on screen -- pause it so nothing fires
      // against the stale config between now and the user explicitly
      // rerunning. Only matters for a campaign that was actually running;
      // draft/already-paused campaigns have nothing active to interrupt.
      // Same pattern as handlePause above: ignore pause()'s own return
      // value and refetch, since its typed shape doesn't match what the
      // rest of this page relies on for campaign state.
      const wasRunning = updatedCampaign.status === 'running'
      if (wasRunning) {
        await campaignsApi.pause(id)
        updatedCampaign = await campaignsApi.get(id)
      }
      setCampaign(updatedCampaign)
      // Run modal's tier picker should reflect what was JUST saved, not
      // whatever it happened to load with at page-open.
      setRunConfig(rc => ({ ...rc, research_depth: discoveryTierDraft }))
      setScheduleSaved(true)
      setSettingsPausedNotice(wasRunning)
      setTimeout(() => setScheduleSaved(false), 6000)
    } catch { } finally {
      setScheduleSaving(false)
    }
  }

  const toggleScheduleDay = (day: number) => {
    setSchedule(s => {
      const base = s ?? { campaign_id: id ?? '', enabled: true, days_of_week: [1, 2, 3, 4, 5], window_start_local: '09:00', window_end_local: '18:00' }
      const has = base.days_of_week.includes(day)
      return { ...base, days_of_week: has ? base.days_of_week.filter(d => d !== day) : [...base.days_of_week, day].sort() }
    })
  }

  const handleCloseModal = () => {
    stopPolling()
    setShowRunModal(false)
    setRunStatus('idle')
    setRunMessage(null)
    setRunError(null)
  }

  // ── APPROVE: calls POST /targets/{id}/approve → triggers real Unipile send ──
  const handleApprove = async (targetId: string) => {
    setApprovingId(targetId)
    setApproveError(prev => ({ ...prev, [targetId]: '' }))
    try {
      const token = localStorage.getItem('nexara_token')
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/targets/${targetId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
      })
      if (!res.ok) {
        const err = await res.json() as { detail?: string }
        throw new Error(err.detail ?? 'Send failed')
      }
      // Refresh targets to reflect sent status
      await fetchData()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Send failed'
      setApproveError(prev => ({ ...prev, [targetId]: msg }))
    } finally {
      setApprovingId(null)
    }
  }

  // ── REJECT: calls POST /targets/{id}/reject → marks as skipped ──
  const handleReject = async (targetId: string) => {
    setRejectingId(targetId)
    try {
      const token = localStorage.getItem('nexara_token')
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/targets/${targetId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
      })
      await fetchData()
    } catch { } finally {
      setRejectingId(null)
    }
  }

  // ── ENRICH: calls POST /targets/{id}/enrich after the 5-credit confirm
  // -- real Unipile profile + recent-posts lookup for just this one person,
  // then rewrites their message using what it finds. ──
  const handleEnrich = async (targetId: string) => {
    setEnrichConfirmTarget(null)
    setEnrichingId(targetId)
    setEnrichError(prev => ({ ...prev, [targetId]: '' }))
    try {
      const token = localStorage.getItem('nexara_token')
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/targets/${targetId}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
      })
      if (!res.ok) {
        const err = await res.json() as { detail?: string }
        throw new Error(err.detail ?? 'Could not fetch more details')
      }
      await fetchData()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not fetch more details'
      setEnrichError(prev => ({ ...prev, [targetId]: msg }))
    } finally {
      setEnrichingId(null)
    }
  }

  // ── RECOMPOSE: manual InMail <-> connection note override, free -- reuses
  // whatever /enrich already fetched instead of calling Unipile again. ──
  const handleRecompose = async (targetId: string, action: 'inmail' | 'connection_request') => {
    setRecomposingId(targetId)
    setRecomposeError(null)
    try {
      const token = localStorage.getItem('nexara_token')
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/targets/${targetId}/recompose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const err = await res.json() as { detail?: string }
        throw new Error(err.detail ?? 'Could not rewrite the message')
      }
      setViewDetailsTarget(null)
      await fetchData()
    } catch (e) {
      setRecomposeError(e instanceof Error ? e.message : 'Could not rewrite the message')
    } finally {
      setRecomposingId(null)
    }
  }

  const lastRun = getLatestRun(runs)

  // Same reasoning as the scan-history page: prefer the real fetched
  // target list over the stored one-time ints when we actually have it,
  // so the modal's stat boxes don't contradict the preview list below them.
  const lastRunTargetsDataReady = !runPreviewLoading && !runPreviewUnavailable
  const lastRunDisplayStats = lastRun ? {
    found: lastRunTargetsDataReady ? runPreviewTargets.length : (lastRun.targets_found ?? 0),
    sent: lastRunTargetsDataReady
      ? runPreviewTargets.filter(t => t.status === 'sent' || !!t.sent_at).length
      : (lastRun.targets_sent ?? 0),
    drafted: lastRunTargetsDataReady
      ? runPreviewTargets.filter(t => !!t.message_sent).length
      : (lastRun.targets_drafted ?? 0),
    skipped: lastRunTargetsDataReady
      ? runPreviewTargets.filter(t => t.status === 'skipped' || !!t.skip_reason).length
      : (lastRun.targets_skipped ?? 0),
  } : null
  const isLastRunLive = lastRun && !lastRun.run_config?.test_mode
  // people-finder campaigns already have their people picked -- no
  // discovery to run, so they skip the Test/Live discovery-run modal and
  // the basic/pro/advanced tier picker entirely (that tier only matters
  // for finding NEW people, and the scheduler hardcodes these to the
  // advanced research tier regardless).
  const isPeopleFinderCampaign = campaign?.source === 'people_finder'

  const pendingReview = targets.filter(t =>
    t.message_sent && t.status === 'pending' && !t.inmail_approved
  )

  // Live progress while still in the gate phase: rotates the caption and
  // quietly re-fetches while there's a real chance of progress. Backs off
  // to a slow, infrequent check (rather than stopping outright) once
  // nothing's changed for a while -- covers both "nothing is actually
  // running automatically" and "it might start later," without hammering
  // the backend every few seconds in the meantime. Placed here, after
  // pendingReview, and before every conditional return below (loading /
  // !campaign) so these hooks always run in the same order every render.
  const gateStillActive = !!campaign?.supervised_mode && !campaign?.autonomous_approved
  const gateApprovalGate = campaign?.live_approval_gate ?? 5
  const draftedSoFar = Math.min(gateApprovalGate, pendingReview.length + (campaign?.manual_approvals_count ?? 0))

  useEffect(() => {
    if (!gateStillActive) {
      setGateStalled(false)
      return
    }
    if (draftedSoFar !== gateProgressRef.current.count) {
      gateProgressRef.current = { count: draftedSoFar, lastChangedAt: Date.now() }
      setGateStalled(false)  // real progress happened -- no longer stalled
    }
  }, [draftedSoFar, gateStillActive])

  useEffect(() => {
    if (!gateStillActive || !id) {
      if (gatePollRef.current) { clearTimeout(gatePollRef.current); gatePollRef.current = null }
      return
    }
    const captionTimer = setInterval(() => {
      setGateCaptionIndex(i => (i + 1) % GATE_CAPTIONS.length)
    }, 3500)

    const tick = async () => {
      const stalled = Date.now() - gateProgressRef.current.lastChangedAt > GATE_STALL_THRESHOLD_MS
      setGateStalled(stalled)
      await fetchData()
      // Re-arm the next tick at whichever cadence matches the current
      // state -- fast while there's a real chance of progress, slow once
      // there's clearly nothing ticking on its own.
      gatePollRef.current = setTimeout(tick, stalled ? GATE_POLL_STALLED_MS : GATE_POLL_ACTIVE_MS)
    }
    gatePollRef.current = setTimeout(tick, GATE_POLL_ACTIVE_MS)

    return () => {
      clearInterval(captionTimer)
      if (gatePollRef.current) { clearTimeout(gatePollRef.current); gatePollRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateStillActive, id])

  // targets is already sorted latest-first from fetchData/startPolling, so
  // 'earliest' just reverses that order rather than re-sorting.
  const sortedPendingReview = reviewSortOrder === 'latest'
    ? pendingReview
    : [...pendingReview].reverse()

  const reviewTotalPages = Math.max(1, Math.ceil(sortedPendingReview.length / REVIEW_PAGE_SIZE))
  const clampedReviewPage = Math.min(reviewPage, reviewTotalPages)
  const paginatedReview = sortedPendingReview.slice(
    (clampedReviewPage - 1) * REVIEW_PAGE_SIZE,
    clampedReviewPage * REVIEW_PAGE_SIZE
  )

  // targets is already latest-first (dedupeSortTargets), so this is a
  // plain page slice, no re-sorting needed.
  const targetsTableTotalPages = Math.max(1, Math.ceil(targets.length / TARGETS_PAGE_SIZE))
  const clampedTargetsTablePage = Math.min(targetsTablePage, targetsTableTotalPages)
  const paginatedTargetsTable = targets.slice(
    (clampedTargetsTablePage - 1) * TARGETS_PAGE_SIZE,
    clampedTargetsTablePage * TARGETS_PAGE_SIZE
  )

  if (loading) {
    return (
      <div>
        <Header title="Campaign detail" subtitle="Loading..." />
        <div className="p-4 md:p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="card space-y-3">{[1, 2, 3].map(i => <SkeletonRow key={i} />)}</div>
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div>
        <Header title="Campaign detail" subtitle="Campaign not found" />
        <div className="p-4 md:p-6">
          <div className="card text-center py-10">
            <p className="text-sm text-gray-500 mb-4">This campaign does not exist or you do not have access.</p>
            <Link href="/campaigns" className="btn-secondary">Back to campaigns</Link>
          </div>
        </div>
      </div>
    )
  }

  if (campaign.mode === 'connection_outreach') {
    return <ConnectionOutreachCampaignDetail campaign={campaign} />
  }

  return (
    <div>
      <Header
        title={campaign.name}
        subtitle="Campaign detail"
        action={
          <div className="flex gap-2 flex-wrap">
            {lastRun && (
              <button onClick={() => setShowRunsModal(true)} className="btn-secondary text-xs">
                Last Run Results
              </button>
            )}
            {campaign.status === 'paused' ? (
              // Paused: Resume only.
              <button onClick={handleResume} disabled={runningNow} className="btn-primary disabled:opacity-50">
                {runningNow ? 'Resuming...' : 'Resume'}
              </button>
            ) : campaign.status === 'running' ? (
              // Running: Pause only. Run Now used to sit next to Pause here
              // too -- removed on purpose. Run Now's job is exclusively to
              // START a campaign; once it's running, the only action that
              // makes sense is stopping it, not a second "start" button
              // sitting beside the stop button.
              <button onClick={handlePause} disabled={pausing} className="btn-secondary disabled:opacity-50">
                {pausing ? 'Pausing...' : 'Pause'}
              </button>
            ) : (
              // Not yet started (draft, or completed): Run Now only. This
              // is what actually starts the campaign -- draft flips to
              // 'running' automatically the moment a target gets claimed
              // (routers/scheduler.py), so the button set above takes over
              // from the very next render.
              <button
                onClick={() => {
                  if (isPeopleFinderCampaign) {
                    handleRunNow()
                  } else {
                    setShowRunModal(true); setRunStatus('idle'); setRunMessage(null); setRunError(null)
                  }
                }}
                disabled={isPeopleFinderCampaign && runningNow}
                className="btn-primary disabled:opacity-50"
              >
                {isPeopleFinderCampaign && runningNow ? 'Starting...' : 'Run Now'}
              </button>
            )}
          </div>
        }
      />

      {/* Last Run Results Modal */}
      {showRunsModal && lastRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-gray-900">Last Run Results</p>
              <button onClick={() => setShowRunsModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="flex items-center gap-2">
              <RunModeBadge testMode={lastRun.run_config?.test_mode ?? true} />
              <span className="text-xs text-gray-500">
                {lastRun.started_at ? formatCSTDateTime(lastRun.started_at) : '-'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-auto ${
                lastRun.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
              }`}>
                {lastRun.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Targets found', value: lastRunDisplayStats?.found ?? 0 },
                { label: 'Messages sent', value: lastRunDisplayStats?.sent ?? 0 },
                { label: 'Drafts composed', value: lastRunDisplayStats?.drafted ?? 0 },
                { label: 'Skipped', value: lastRunDisplayStats?.skipped ?? 0 },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-medium text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            {!lastRun.run_config?.test_mode && pendingReview.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-700 font-medium">
                  {pendingReview.length} message{pendingReview.length > 1 ? 's' : ''} pending approval
                </p>
                <p className="text-[10px] text-amber-600 mt-0.5">
                  First {LIVE_APPROVAL_GATE} live messages require manual approval
                </p>
              </div>
            )}
            {lastRun.errors?.length > 0 && (
              <div className="bg-red-50 rounded-xl px-4 py-3">
                <p className="text-xs text-red-600 font-medium mb-1">Errors</p>
                {lastRun.errors.slice(0, 3).map((e, i) => (
                  <p key={i} className="text-[10px] text-red-500">{e}</p>
                ))}
              </div>
            )}
            {runPreviewLoading && (
              <div className="space-y-2">
                {[0, 1, 2].map(i => <SkeletonRow key={i} />)}
              </div>
            )}
            {!runPreviewLoading && !runPreviewUnavailable && runPreviewTargets.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Targets found</p>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {runPreviewTargets.slice(0, RUN_PREVIEW_COUNT).map(t => (
                    <div key={t.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{t.hr_name || '-'}</p>
                        <p className="text-[10px] text-gray-400 truncate">{t.company || '-'}</p>
                      </div>
                      {t.linkedin_url && (
                        <a
                          href={t.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-blue-500 hover:text-blue-700 flex-shrink-0"
                        >
                          LinkedIn
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Always available - this is the door into browsing every past
                scan, not conditional on whether *this* run had more than
                RUN_PREVIEW_COUNT targets. That was the original design intent
                of the scan-history page: a persistent way in, not a
                sometimes-there link. */}
            <Link
              href={`/campaigns/${id}/runs?run=${lastRun.id}`}
              className="block text-center text-xs text-blue-600 hover:text-blue-800 underline"
            >
              {runPreviewTargets.length > RUN_PREVIEW_COUNT
                ? `View all ${runPreviewTargets.length} results →`
                : 'Click here for scan history →'}
            </Link>
            <button onClick={() => setShowRunsModal(false)} className="btn-secondary w-full">Close</button>
          </div>
        </div>
      )}

      {/* "Get more details" confirmation -- a real Unipile profile view,
          not free, so this is a real confirm step rather than firing on
          click. Explains what it does (recent activity + hiring details)
          and what it costs before calling POST /targets/{id}/enrich. */}
      {enrichConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <p className="text-base font-semibold text-gray-900">Get more details</p>
            <p className="text-sm text-gray-600">
              Checks {enrichConfirmTarget.hr_name || 'this person'}&apos;s recent LinkedIn activity and hiring
              details, then rewrites their message using what it finds. This uses <b>5 credits</b> for a
              real profile lookup.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEnrichConfirmTarget(null)} className="btn-secondary text-xs">Cancel</button>
              <button onClick={() => handleEnrich(enrichConfirmTarget.id)} className="btn-primary text-xs">
                Use 5 credits
              </button>
            </div>
          </div>
        </div>
      )}

      {/* "View more details" -- free, shown once a target's already been
          enriched instead of re-charging. Summarizes what /enrich found and
          offers a manual InMail <-> connection note override that reuses
          the same data (POST /targets/{id}/recompose), also free. */}
      {viewDetailsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-gray-900">{viewDetailsTarget.hr_name || 'Profile'} details</p>
              <button onClick={() => { setViewDetailsTarget(null); setRecomposeError(null) }} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            {viewDetailsTarget.hiring_detected ? (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-orange-700">Hiring signal found</p>
                {viewDetailsTarget.hiring_posts && viewDetailsTarget.hiring_posts.length > 0 && (
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {viewDetailsTarget.hiring_posts[0].text}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-500">No hiring signal in their recent posts.</p>
              </div>
            )}

            {viewDetailsTarget.recent_posts && viewDetailsTarget.recent_posts.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-gray-700">Other recent activity</p>
                {viewDetailsTarget.recent_posts.slice(0, 3).map((post, i) => (
                  <p key={post.id ?? i} className="text-xs text-gray-500 leading-relaxed bg-gray-50 rounded-lg p-2">{post.text}</p>
                ))}
              </div>
            )}

            <div className="border-t border-gray-100 pt-3 space-y-2">
              <p className="text-xs text-gray-500">
                Currently drafted as <b>{viewDetailsTarget.action_taken === 'inmail' ? 'an InMail' : 'a connection note'}</b>.
                {viewDetailsTarget.action_taken !== 'inmail' && !viewDetailsTarget.open_profile && (
                  <> Sending a real InMail (not to an open profile) needs LinkedIn Premium/InMail credits on your sending account.</>
                )}
              </p>
              {recomposeError && <p className="text-xs text-red-500">⚠ {recomposeError}</p>}
              <div className="flex gap-2">
                {viewDetailsTarget.action_taken !== 'inmail' && (
                  <button
                    onClick={() => handleRecompose(viewDetailsTarget.id, 'inmail')}
                    disabled={recomposingId === viewDetailsTarget.id}
                    className="btn-secondary text-xs flex-1 disabled:opacity-50"
                  >
                    {recomposingId === viewDetailsTarget.id ? 'Rewriting...' : 'Ask Nexara to draft this as an InMail'}
                  </button>
                )}
                {viewDetailsTarget.action_taken === 'inmail' && (
                  <button
                    onClick={() => handleRecompose(viewDetailsTarget.id, 'connection_request')}
                    disabled={recomposingId === viewDetailsTarget.id}
                    className="btn-secondary text-xs flex-1 disabled:opacity-50"
                  >
                    {recomposingId === viewDetailsTarget.id ? 'Rewriting...' : 'Send as a connection note instead'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Run Modal */}
      {showRunModal && !isPeopleFinderCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-gray-900">Run Campaign</p>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
              {([true, false] as const).map(mode => (
                <button
                  key={String(mode)}
                  onClick={() => setRunConfig(c => ({ ...c, test_mode: mode, limit: mode ? Math.min(c.limit, TEST_MODE_CAP) : c.limit }))}
                  disabled={runStatus === 'running'}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all disabled:opacity-50 ${runConfig.test_mode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                >
                  {mode ? 'Test Mode' : 'Live Mode'}
                </button>
              ))}
            </div>
            <p className={`text-xs rounded-lg px-3 py-2 ${runConfig.test_mode ? 'text-blue-600 bg-blue-50' : 'text-amber-600 bg-amber-50'}`}>
              {runConfig.test_mode
                ? `Discovers targets, composes messages, saves drafts. No actual sends. Capped at ${TEST_MODE_CAP} targets.`
                : `Will send real LinkedIn messages. First ${LIVE_APPROVAL_GATE} require manual approval.`}
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">
                Max targets this run
                {runConfig.test_mode && <span className="text-gray-400 font-normal ml-1">(max {TEST_MODE_CAP} in test mode)</span>}
              </label>
              <input
                type="number" min={1}
                max={runConfig.test_mode ? TEST_MODE_CAP : LIVE_MODE_MAX}
                value={effectiveLimit}
                disabled={runStatus === 'running'}
                onChange={e => {
                  const val = Number(e.target.value)
                  setRunConfig(c => ({ ...c, limit: runConfig.test_mode ? Math.min(val, TEST_MODE_CAP) : Math.min(val, LIVE_MODE_MAX) }))
                }}
                className="input w-full disabled:opacity-50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Discovery tier</label>
              <div className="flex gap-2">
                {(['basic', 'pro', 'advanced'] as const).map(d => (
                  <button key={d} onClick={() => setRunConfig(c => ({ ...c, research_depth: d }))} disabled={runStatus === 'running'}
                    className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-all disabled:opacity-50 ${runConfig.research_depth === d ? 'border-brand bg-brand/5 text-brand' : 'border-gray-200 text-gray-500'}`}>
                    {d === 'basic' ? 'Basic' : d === 'pro' ? 'Pro' : 'Advanced'}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400">
                {runConfig.research_depth === 'basic' && 'Searches database for people, plus a company overview.'}
                {runConfig.research_depth === 'pro' && 'This pulls up the live data from trusted sources with basic details'}
                {runConfig.research_depth === 'advanced' && 'This pulls real peole live, plus a full profile lookup for each person taght includes real profile, recent posts, hiring-signal detection.'}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Message model</label>
              <div className="flex gap-2">
                {(['haiku', 'sonnet'] as const).map(m => (
                  <button key={m} onClick={() => setRunConfig(c => ({ ...c, message_model: m }))} disabled={runStatus === 'running'}
                    className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-all disabled:opacity-50 ${runConfig.message_model === m ? 'border-brand bg-brand/5 text-brand' : 'border-gray-200 text-gray-500'}`}>
                    {m === 'haiku' ? 'Basic (fast, cheap)' : 'Advanced (best quality)'}
                  </button>
                ))}
              </div>
            </div>
            {runStatus === 'running' && runMessage && (
              <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
                <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                <p className="text-xs text-blue-700">{runMessage}</p>
              </div>
            )}
            {runStatus === 'success' && runMessage && (
              <div className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
                <span className="text-green-600 flex-shrink-0">✓</span>
                <p className="text-xs text-green-700">{runMessage}</p>
              </div>
            )}
            {runStatus === 'failed' && (runMessage || runError) && (
              <div className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2">
                <span className="text-red-500 flex-shrink-0">✕</span>
                <p className="text-xs text-red-600">{runError || runMessage}</p>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={handleCloseModal} className="btn-secondary flex-1">
                {runStatus === 'success' ? 'Close' : 'Cancel'}
              </button>
              <button onClick={handleRun} disabled={running || runStatus === 'running'} className="btn-primary flex-1 disabled:opacity-50">
                {running || runStatus === 'running' ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Running...
                  </span>
                ) : runStatus === 'success' ? 'Run Again' : 'Run'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!showRunModal && runStatus === 'success' && runMessage && (
        <div className="mx-4 md:mx-6 mt-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <span className="text-green-600">✓</span>
          <p className="text-xs text-green-700 flex-1">{runMessage}</p>
          <button onClick={() => setRunStatus('idle')} className="text-green-400 hover:text-green-600 text-sm">✕</button>
        </div>
      )}
      {!showRunModal && runStatus === 'failed' && (runMessage || runError) && (
        <div className="mx-4 md:mx-6 mt-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <span className="text-red-500">✕</span>
          <p className="text-xs text-red-600 flex-1">{runError || runMessage}</p>
          <button onClick={() => setRunStatus('idle')} className="text-red-400 hover:text-red-600 text-sm">✕</button>
        </div>
      )}
      {runNowMessage && (
        <div className="mx-4 md:mx-6 mt-4 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-700 flex-1">{runNowMessage}</p>
          <button onClick={() => setRunNowMessage(null)} className="text-blue-400 hover:text-blue-600 text-sm">✕</button>
        </div>
      )}

      <div className="p-4 md:p-6 space-y-5">
        <div className="flex flex-wrap gap-2 items-center">
          <ModeBadge mode={campaign.mode} />
          <StatusBadge status={campaign.status} />
          {campaign.supervised_mode && (
            autopilotRevealed ? (
              <span className="bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Autopilot
              </span>
            ) : campaign.autonomous_approved ? (
              <span className="bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Turning on autopilot...
              </span>
            ) : (
              <span className="bg-blue-50 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                Supervised · {Math.max(0, (campaign.live_approval_gate ?? 5) - (campaign.manual_approvals_count ?? 0))} more to autopilot
              </span>
            )
          )}
          {typeof campaign.daily_limit === 'number' && (
            <span className="bg-gray-50 text-gray-700 text-xs px-2 py-0.5 rounded-full">
              {campaign.sent_today ?? 0}/{campaign.daily_limit} today
            </span>
          )}
          {campaign.next_action_at && (
            <span className="bg-gray-50 text-gray-700 text-xs px-2 py-0.5 rounded-full">
              Next send: {formatCSTDateTime(campaign.next_action_at)}
            </span>
          )}
          {lastRun && (
            <span className="text-xs text-gray-400 ml-auto">
              Last run: <RunModeBadge testMode={lastRun.run_config?.test_mode ?? true} />
              <span className="ml-1">{formatCSTDate(lastRun.started_at)}</span>
            </span>
          )}
        </div>

        {gateStillActive && targets.some(t => t.status === 'pending') && (
          <div className={`border rounded-xl px-4 py-3 space-y-2 ${gateStalled ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-center justify-between">
              <p className={`text-xs font-medium ${gateStalled ? 'text-amber-800' : 'text-blue-800'}`}>
                {draftedSoFar}/{gateApprovalGate} ready for review
              </p>
              {!gateStalled && (
                <span className="text-[10px] text-blue-500">{GATE_CAPTIONS[gateCaptionIndex]}</span>
              )}
            </div>
            <div className={`w-full h-1.5 rounded-full overflow-hidden ${gateStalled ? 'bg-amber-100' : 'bg-blue-100'}`}>
              <div
                className={`h-full rounded-full transition-all duration-700 ${gateStalled ? 'bg-amber-500' : 'bg-blue-500'}`}
                style={{ width: `${(draftedSoFar / gateApprovalGate) * 100}%` }}
              />
            </div>
            {gateStalled ? (
              <p className="text-[10px] text-amber-700">
                No new drafts in the last couple of minutes - the automatic scheduler doesn&apos;t appear to be
                ticking on its own right now. Click Run Now to process the next person manually, or check
                that automation is actually wired in on the backend.
              </p>
            ) : (
              <p className="text-[10px] text-blue-600">
                Feel free to leave and come back in about 3 minutes - approve them whenever you&apos;re ready,
                and once all {gateApprovalGate} are approved autopilot turns on for the rest.
              </p>
            )}
          </div>
        )}

        {/* Automation settings -- daily limit, schedule, and (for
            discovery-based campaigns only) the discovery tier. Editable
            anytime, not locked in at launch. All times America/Chicago. */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900">Automation settings</p>
              {schedule?.enabled === false ? (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Schedule off</span>
              ) : schedule?.is_active_now ? (
                <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Active now
                </span>
              ) : (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">Outside window</span>
              )}
            </div>
            <span className="text-[10px] text-gray-400">All times shown in Central (CT)</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Daily send limit</label>
              <input
                type="number" min={1} max={200}
                value={dailyLimitDraft}
                onChange={e => setDailyLimitDraft(Math.max(1, Number(e.target.value)))}
                className="input w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Window start (CT)</label>
              <input
                type="time"
                value={schedule?.window_start_local ?? '09:00'}
                onChange={e => setSchedule(s => ({ ...(s ?? { campaign_id: id ?? '', enabled: true, days_of_week: [1, 2, 3, 4, 5], window_start_local: '09:00', window_end_local: '18:00' }), window_start_local: e.target.value }))}
                className="input w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Window end (CT)</label>
              <input
                type="time"
                value={schedule?.window_end_local ?? '18:00'}
                onChange={e => setSchedule(s => ({ ...(s ?? { campaign_id: id ?? '', enabled: true, days_of_week: [1, 2, 3, 4, 5], window_start_local: '09:00', window_end_local: '18:00' }), window_end_local: e.target.value }))}
                className="input w-full"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Schedule enabled</label>
              <button
                onClick={() => setSchedule(s => ({ ...(s ?? { campaign_id: id ?? '', enabled: true, days_of_week: [1, 2, 3, 4, 5], window_start_local: '09:00', window_end_local: '18:00' }), enabled: !(s?.enabled ?? true) }))}
                className={`w-full text-xs py-1.5 rounded-lg border font-medium transition-all ${(schedule?.enabled ?? true) ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}
              >
                {(schedule?.enabled ?? true) ? 'On' : 'Off'}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Days active</label>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_LABELS.map((label, day) => {
                const active = (schedule?.days_of_week ?? [1, 2, 3, 4, 5]).includes(day)
                return (
                  <button
                    key={day}
                    onClick={() => toggleScheduleDay(day)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${active ? 'border-brand bg-brand/5 text-brand' : 'border-gray-200 text-gray-400'}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {!isPeopleFinderCampaign && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Discovery tier</label>
              <div className="flex gap-2">
                {(['basic', 'pro', 'advanced'] as const).map(tier => (
                  <button
                    key={tier}
                    onClick={() => setDiscoveryTierDraft(tier)}
                    className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-all ${discoveryTierDraft === tier ? 'border-brand bg-brand/5 text-brand' : 'border-gray-200 text-gray-500'}`}
                  >
                    {tier === 'basic' ? 'Basic' : tier === 'pro' ? 'Pro' : 'Advanced'}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400">
                {discoveryTierDraft === 'basic' && 'Searches our existing database of previously found people, plus a company overview.'}
                {discoveryTierDraft === 'pro' && 'Also searches LinkedIn live when our existing database doesn’t have enough people.'}
                {discoveryTierDraft === 'advanced' && 'Also searches LinkedIn live, plus a full profile lookup for each person.'}
              </p>
            </div>
          )}
          {isPeopleFinderCampaign && (
            <p className="text-[11px] text-gray-400">
              This campaign&apos;s people are already identified, so there&apos;s no discovery tier to choose -
              the scheduler always runs full profile + hiring-signal enrichment for these targets.
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleSaveSchedule} disabled={scheduleSaving} className="btn-primary text-xs disabled:opacity-50">
              {scheduleSaving ? 'Saving...' : 'Save automation settings'}
            </button>
            {scheduleSaved && !settingsPausedNotice && <span className="text-xs text-green-600">Saved</span>}
          </div>

          {/* Only shown when saving just paused an in-flight campaign --
              a plain "Saved" text would leave the user assuming the old
              run is still going on the new settings. Dismisses on Rerun,
              same dual-path as handleResume: people-finder campaigns have
              no discovery to configure, so Rerun processes the next
              pending person directly instead of opening the modal. */}
          {scheduleSaved && settingsPausedNotice && (
            <div className="mt-3 flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-xs text-amber-700">
                Settings saved - this campaign was paused so nothing runs on the old config. Click Rerun to start with the updated settings.
              </p>
              <button
                onClick={() => {
                  setScheduleSaved(false)
                  setSettingsPausedNotice(false)
                  if (isPeopleFinderCampaign) {
                    handleRunNow()
                  } else {
                    setShowRunModal(true); setRunStatus('idle'); setRunMessage(null); setRunError(null)
                  }
                }}
                className="btn-primary text-xs flex-shrink-0"
              >Rerun now</button>
            </div>
          )}
        </div>

        {/* Approval gate banner */}
        {isLastRunLive && pendingReview.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p className="text-xs font-medium text-amber-800">Live mode - {pendingReview.length} pending approval</p>
              <p className="text-[10px] text-amber-600">First {LIVE_APPROVAL_GATE} connection requests require manual approval before sending</p>
            </div>
          </div>
        )}

        {/* Not premium: connection notes get a shorter cap and can get
            silently dropped once the account's free monthly note quota
            runs out (Unipile then returns a 422 and this app retries
            without the note -- the send still goes through, just blank).
            Purely informational; doesn't block or change anything. */}
        {linkedInPlanType && linkedInPlanType !== 'premium' && campaign.supervised_mode && pendingReview.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p className="text-xs font-medium text-amber-800">This LinkedIn account isn&apos;t on Premium</p>
              <p className="text-[10px] text-amber-600">
                Connection notes are capped shorter and may get dropped once your free monthly note quota runs out -
                LinkedIn Premium always allows a note, which meaningfully increases acceptance rates.
              </p>
            </div>
          </div>
        )}

        {/* Review section */}
        {campaign.supervised_mode && pendingReview.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className={`flex items-center gap-2 ${reviewCollapsed ? '' : 'mb-3'}`}>
              <button
                onClick={() => setReviewCollapsed(v => !v)}
                title={reviewCollapsed ? 'Click to review' : 'Click to hide'}
                className="text-blue-700 hover:bg-blue-100 rounded-lg p-1 -m-1 transition-colors flex-shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {reviewCollapsed ? (
                    <>
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 8 11 8a18.5 18.5 0 0 1-2.61 3.53M6.61 6.61A18.5 18.5 0 0 0 1 13s4 8 11 8a10.44 10.44 0 0 0 5.39-1.61" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
              <span
                className="text-sm font-medium text-blue-800 cursor-pointer"
                onClick={() => setReviewCollapsed(v => !v)}
              >
                Review before send
              </span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Supervised</span>
              <div className="ml-auto flex items-center gap-2">
                {!reviewCollapsed && (
                  <select
                    value={reviewSortOrder}
                    onChange={e => {
                      setReviewSortOrder(e.target.value as 'latest' | 'earliest')
                      setReviewPage(1)
                    }}
                    className="text-xs bg-white border border-blue-200 text-blue-700 rounded-full px-2 py-0.5 font-medium focus:outline-none"
                  >
                    <option value="latest">Latest first</option>
                    <option value="earliest">Earliest first</option>
                  </select>
                )}
                <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                  {pendingReview.length} pending
                </span>
              </div>
            </div>
            {reviewCollapsed && (
              <button
                onClick={() => setReviewCollapsed(false)}
                className="text-xs text-blue-600 hover:text-blue-800 underline mt-1"
              >
                Click the eye to review {pendingReview.length} pending message{pendingReview.length > 1 ? 's' : ''}
              </button>
            )}
            {!reviewCollapsed && (
            <>
            <div className="space-y-3">
              {paginatedReview.map((t, idx) => (
                <div key={t.id} className="bg-white rounded-xl border border-blue-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">{t.hr_name || t.company}</p>
                        {t.hr_name && <span className="text-xs text-gray-400">{t.company}</span>}
                        <ActionBadge action={t.action_taken} />
                        {t.hiring_detected && (
                          <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-medium">Hiring</span>
                        )}
                        {isLastRunLive && (clampedReviewPage - 1) * REVIEW_PAGE_SIZE + idx < LIVE_APPROVAL_GATE && (
                          <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium">approval required</span>
                        )}
                        {t.linkedin_url && (
                          <a href={t.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] text-blue-500 hover:text-blue-700 underline">LinkedIn</a>
                        )}
                        {t.email_found && (
                          <a href={`mailto:${t.email_found}`} onClick={e => e.stopPropagation()} className="text-[10px] text-gray-400 hover:text-gray-600 underline">{t.email_found}</a>
                        )}
                      </div>
                      <div
                        className="text-xs text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-3 cursor-pointer"
                        onClick={() => setExpandedTarget(expandedTarget === t.id ? null : t.id)}
                      >
                        {expandedTarget === t.id
                          ? <span className="whitespace-pre-wrap">{t.message_sent}</span>
                          : <span>{t.message_sent?.slice(0, 120)}... <span className="text-blue-500">show more</span></span>
                        }
                      </div>
                      {t.message_sent && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          {t.message_sent.length} chars
                          {t.action_taken === 'connection_request' && t.message_sent.length > 280 && <span className="text-red-500 ml-1">over 280 limit</span>}
                          {t.action_taken === 'connection_request' && t.message_sent.length < 200 && <span className="text-amber-500 ml-1">under 200 minimum</span>}
                        </p>
                      )}
                      {/* Per-target error */}
                      {approveError[t.id] && (
                        <p className="text-[10px] text-red-500 mt-1">⚠ {approveError[t.id]}</p>
                      )}
                      {enrichError[t.id] && (
                        <p className="text-[10px] text-red-500 mt-1">⚠ {enrichError[t.id]}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => t.enriched_at ? setViewDetailsTarget(t) : setEnrichConfirmTarget(t)}
                        disabled={enrichingId === t.id || approvingId === t.id || rejectingId === t.id}
                        className="text-xs px-3 py-1.5 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-600 border border-gray-200 rounded-lg font-medium transition-colors min-w-[72px]"
                      >
                        {enrichingId === t.id ? (
                          <span className="flex items-center justify-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                            Checking
                          </span>
                        ) : t.enriched_at ? 'View more details' : 'Get more details'}
                      </button>
                      <button
                        onClick={() => handleApprove(t.id)}
                        disabled={approvingId === t.id || rejectingId === t.id}
                        className="text-xs px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors min-w-[72px]"
                      >
                        {approvingId === t.id ? (
                          <span className="flex items-center justify-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            Sending
                          </span>
                        ) : 'Approve'}
                      </button>
                      <button
                        onClick={() => handleReject(t.id)}
                        disabled={approvingId === t.id || rejectingId === t.id}
                        className="text-xs px-3 py-1.5 bg-white hover:bg-red-50 disabled:opacity-50 text-red-500 border border-red-200 rounded-lg font-medium transition-colors"
                      >
                        {rejectingId === t.id ? 'Rejecting...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {sortedPendingReview.length > REVIEW_PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-blue-100">
                <p className="text-[11px] text-blue-600">
                  Showing {(clampedReviewPage - 1) * REVIEW_PAGE_SIZE + 1}–
                  {Math.min(clampedReviewPage * REVIEW_PAGE_SIZE, sortedPendingReview.length)} of {sortedPendingReview.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setReviewPage(p => Math.max(1, p - 1))}
                    disabled={clampedReviewPage === 1}
                    className="text-xs px-2.5 py-1 rounded-lg border border-blue-200 bg-white text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-100 transition-colors"
                  >
                    Prev
                  </button>
                  <span className="text-[11px] text-blue-600">
                    Page {clampedReviewPage} of {reviewTotalPages}
                  </span>
                  <button
                    onClick={() => setReviewPage(p => Math.min(reviewTotalPages, p + 1))}
                    disabled={clampedReviewPage === reviewTotalPages}
                    className="text-xs px-2.5 py-1 rounded-lg border border-blue-200 bg-white text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-100 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            </>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total targets', value: targets.length },
            { label: 'Sent', value: targets.filter(t => t.sent_at).length },
            { label: 'Accepted', value: targets.filter(t => t.accepted_at).length },
            { label: 'Replied', value: targets.filter(t => t.replied_at).length },
          ].map(s => (
            <div key={s.label} className="card text-center">
              <p className="text-xl font-medium text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Targets table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-900">Targets</p>
            <p className="text-xs text-gray-400">Latest first · {targets.length} total</p>
          </div>
          {targets.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-sm text-gray-500 mb-1">No targets yet</p>
              <p className="text-xs text-gray-400">Targets will appear here once the discovery agent runs</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Person</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium hidden md:table-cell">Company</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium hidden md:table-cell">Message</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium hidden md:table-cell">Action</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                      <th className="text-left px-4 py-3 text-gray-500 font-medium hidden md:table-cell">Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTargetsTable.map(t => (
                      <React.Fragment key={t.id}>
                        <tr
                          className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                          onClick={() => setExpandedTarget(expandedTarget === t.id ? null : t.id)}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{t.hr_name || '-'}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {t.linkedin_url && (
                                <a href={t.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] text-blue-500 hover:text-blue-700">LinkedIn</a>
                              )}
                              {t.email_found && (
                                <a href={`mailto:${t.email_found}`} onClick={e => e.stopPropagation()} className="text-[10px] text-gray-400 hover:text-gray-600">{t.email_found}</a>
                              )}
                            </div>
                            <p className="text-gray-400 md:hidden mt-0.5">{t.company}</p>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <p className="text-gray-900">{t.company || '-'}</p>
                            <p className="text-gray-400">{t.title}</p>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell max-w-xs">
                            {t.message_sent
                              ? <p className="text-gray-600 truncate">{t.message_sent}</p>
                              : <p className="text-gray-300">-</p>
                            }
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <ActionBadge action={t.action_taken} />
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <RunModeBadge testMode={!t.sent_at && t.status !== 'sent'} />
                          </td>
                        </tr>
                        {expandedTarget === t.id && t.message_sent && (
                          <tr className="bg-blue-50">
                            <td colSpan={6} className="px-4 py-3">
                              <div className="bg-white rounded-xl border border-blue-100 p-4">
                                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs font-medium text-gray-700">
                                      {t.action_taken === 'connection_request' ? 'Connection Note' : t.action_taken === 'email' ? 'Email' : 'InMail'}
                                    </p>
                                    <ActionBadge action={t.action_taken} />
                                    <RunModeBadge testMode={!t.sent_at && t.status !== 'sent'} />
                                    <span className="text-[10px] text-gray-400">{t.message_sent.length} chars</span>
                                    {t.action_taken === 'connection_request' && t.message_sent.length > 280 && <span className="text-red-500 text-[10px]">over 280 limit</span>}
                                    {t.action_taken === 'connection_request' && t.message_sent.length < 200 && <span className="text-amber-500 text-[10px]">under 200 minimum</span>}
                                    {t.linkedin_url && (
                                      <a href={t.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] text-blue-500 hover:text-blue-700 underline">LinkedIn</a>
                                    )}
                                    {t.email_found && (
                                      <a href={`mailto:${t.email_found}`} onClick={e => e.stopPropagation()} className="text-[10px] text-gray-400 hover:text-gray-600 underline">{t.email_found}</a>
                                    )}
                                  </div>
                                  <button onClick={() => setExpandedTarget(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                                </div>
                                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
                                  {t.message_sent}
                                </p>
                                {/* Quick approve from expanded row if still pending */}
                                {t.status === 'pending' && !t.inmail_approved && (
                                  <div className="flex gap-2 mt-3">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleApprove(t.id) }}
                                      disabled={approvingId === t.id}
                                      className="text-xs px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg font-medium"
                                    >
                                      {approvingId === t.id ? 'Sending...' : '✓ Approve & Send'}
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleReject(t.id) }}
                                      disabled={rejectingId === t.id}
                                      className="text-xs px-3 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50 rounded-lg font-medium"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {targets.length > TARGETS_PAGE_SIZE && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <p className="text-[11px] text-gray-400">
                    Showing {(clampedTargetsTablePage - 1) * TARGETS_PAGE_SIZE + 1}–
                    {Math.min(clampedTargetsTablePage * TARGETS_PAGE_SIZE, targets.length)} of {targets.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTargetsTablePage(p => Math.max(1, p - 1))}
                      disabled={clampedTargetsTablePage === 1}
                      className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      Prev
                    </button>
                    <span className="text-[11px] text-gray-500">
                      Page {clampedTargetsTablePage} of {targetsTableTotalPages}
                    </span>
                    <button
                      onClick={() => setTargetsTablePage(p => Math.min(targetsTableTotalPages, p + 1))}
                      disabled={clampedTargetsTablePage === targetsTableTotalPages}
                      className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
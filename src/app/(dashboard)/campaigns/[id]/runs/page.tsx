'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import { Skeleton, SkeletonRow } from '@/components/ui/Skeleton'
import { campaignsApi } from '@/lib/api'
import { cache } from '@/lib/cache'
import type { Campaign, OutreachTarget } from '@/types'

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

function RunModeBadge({ testMode }: { testMode: boolean }) {
  return testMode
    ? <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-500">test</span>
    : <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-50 text-amber-600">live</span>
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-green-50 text-green-600',
    running: 'bg-blue-50 text-blue-600',
    failed: 'bg-red-50 text-red-600',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${styles[status] ?? 'bg-amber-50 text-amber-600'}`}>
      {status}
    </span>
  )
}

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

function ScanHistoryContent() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [runs, setRuns] = useState<CampaignRun[]>([])
  const [runsLoading, setRunsLoading] = useState(true)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [runsSortOrder, setRunsSortOrder] = useState<'latest' | 'earliest'>('latest')

  const [runTargets, setRunTargets] = useState<OutreachTarget[]>([])
  const [targetsLoading, setTargetsLoading] = useState(false)
  const [targetsUnavailable, setTargetsUnavailable] = useState(false)
  const [expandedTarget, setExpandedTarget] = useState<string | null>(null)

  // Load campaign + full run list once
  useEffect(() => {
    if (!id) return

    const cached = cache.get<{ campaign: Campaign | null; runs: CampaignRun[] }>(`campaign_runs_list:${id}`)
    if (cached) {
      setCampaign(cached.campaign)
      setRuns(cached.runs)
      const requestedFromCache = searchParams.get('run')
      const latestFromCache = [...cached.runs].sort((a, b) =>
        new Date(b.started_at ?? 0).getTime() - new Date(a.started_at ?? 0).getTime()
      )[0]?.id ?? null
      setSelectedRunId(
        (requestedFromCache && cached.runs.some(x => x.id === requestedFromCache))
          ? requestedFromCache
          : latestFromCache
      )
      setRunsLoading(false)
    } else {
      setRunsLoading(true)
    }

    Promise.all([
      campaignsApi.get(id).catch(() => null),
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/campaigns/${id}/runs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('nexara_token') ?? ''}` }
      }).then(r => r.json()).catch(() => ({ runs: [] }))
    ]).then(([c, r]) => {
      setCampaign(c)
      const runList = (r as { runs: CampaignRun[] })?.runs || []
      setRuns(runList)
      cache.set(`campaign_runs_list:${id}`, { campaign: c, runs: runList }, 15)
      // Only move the selection if we didn't already set it from cache above
      // (avoids yanking the user back to run #1 after a background refresh).
      if (!cached) {
        const requested = searchParams.get('run')
        const latest = [...runList].sort((a, b) =>
          new Date(b.started_at ?? 0).getTime() - new Date(a.started_at ?? 0).getTime()
        )[0]?.id ?? null
        const initial = (requested && runList.some(x => x.id === requested))
          ? requested
          : latest
        setSelectedRunId(initial)
      }
    }).finally(() => setRunsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Load targets for whichever run is selected
  useEffect(() => {
    if (!id || !selectedRunId) {
      setRunTargets([])
      return
    }
    setExpandedTarget(null)

    const cacheKey = `run_targets:${id}:${selectedRunId}`
    const cached = cache.get<OutreachTarget[]>(cacheKey)
    if (cached) {
      setRunTargets(cached)
      setTargetsUnavailable(false)
      setTargetsLoading(false)
    } else {
      setTargetsLoading(true)
      setTargetsUnavailable(false)
    }

    let cancelled = false
    campaignsApi.runTargets(id, selectedRunId)
      .then(res => {
        if (cancelled) return
        const list = res.targets || []
        setRunTargets(list)
        setTargetsUnavailable(false)
        // Completed runs' target lists are effectively immutable once
        // populated (only status/approval fields might change elsewhere),
        // so a longer TTL is safe here vs. the run list itself.
        cache.set(cacheKey, list, 60)
      })
      .catch(() => {
        if (cancelled) return
        // Only show the "unavailable" state if we don't already have a
        // cached success to fall back on — a transient failure shouldn't
        // blank out data the user was already looking at.
        if (!cached) {
          setTargetsUnavailable(true)
          setRunTargets([])
        }
      })
      .finally(() => { if (!cancelled) setTargetsLoading(false) })
    return () => { cancelled = true }
  }, [id, selectedRunId])

  const sortedRuns = [...runs].sort((a, b) => {
    const diff = new Date(b.started_at ?? 0).getTime() - new Date(a.started_at ?? 0).getTime()
    return runsSortOrder === 'latest' ? diff : -diff
  })

  const selectedRun = runs.find(r => r.id === selectedRunId) ?? null

  // Prefer counting the actual loaded target list over the separately
  // stored ints on campaign_runs — those are a one-time snapshot and can
  // disagree with what's really linked to this run (e.g. pre-migration
  // runs, or dedup-preserved targets that belong to an earlier run).
  // Only fall back to the stored ints while we don't yet have real data
  // to count (still loading, or the endpoint failed) — showing 0 in that
  // case would be misleadingly definitive.
  const targetsDataReady = !targetsLoading && !targetsUnavailable
  const displayStats = selectedRun ? {
    found: targetsDataReady ? runTargets.length : (selectedRun.targets_found ?? 0),
    sent: targetsDataReady
      ? runTargets.filter(t => t.status === 'sent' || !!t.sent_at).length
      : (selectedRun.targets_sent ?? 0),
    drafted: targetsDataReady
      ? runTargets.filter(t => !!t.message_sent).length
      : (selectedRun.targets_drafted ?? 0),
    skipped: targetsDataReady
      ? runTargets.filter(t => t.status === 'skipped' || !!t.skip_reason).length
      : (selectedRun.targets_skipped ?? 0),
  } : null

  if (runsLoading) {
    return (
      <div>
        <Header title="Scan history" subtitle="Loading..." />
        <div className="p-4 md:p-6 space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="card space-y-3">{[1, 2, 3].map(i => <SkeletonRow key={i} />)}</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header
        title="Scan history"
        subtitle={campaign ? `${campaign.name} · all runs` : 'All runs'}
        action={
          <Link href={`/campaigns/${id}`} className="text-xs text-gray-500 hover:text-gray-700 underline">
            ← Back to campaign
          </Link>
        }
      />
      <div className="p-4 md:p-6">
        {runs.length === 0 ? (
          <div className="card text-center py-10">
            <p className="text-sm text-gray-500 mb-1">No runs yet</p>
            <p className="text-xs text-gray-400">Scans will show up here once you run this campaign</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
            {/* Left: list of all scans */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden h-fit md:sticky md:top-4">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-gray-700">{runs.length} scan{runs.length > 1 ? 's' : ''}</p>
                <select
                  value={runsSortOrder}
                  onChange={e => setRunsSortOrder(e.target.value as 'latest' | 'earliest')}
                  className="text-[11px] bg-gray-50 border border-gray-200 text-gray-600 rounded-full px-2 py-0.5 font-medium focus:outline-none"
                >
                  <option value="latest">Latest first</option>
                  <option value="earliest">Earliest first</option>
                </select>
              </div>
              <div className="max-h-[70vh] overflow-y-auto divide-y divide-gray-50">
                {sortedRuns.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRunId(r.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      r.id === selectedRunId ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <RunModeBadge testMode={r.run_config?.test_mode ?? true} />
                      <StatusPill status={r.status} />
                    </div>
                    <p className="text-xs text-gray-900">
                      {r.started_at ? new Date(r.started_at).toLocaleString() : '-'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: selected run detail */}
            <div className="space-y-4">
              {selectedRun && (
                <>
                  <div className="card">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <RunModeBadge testMode={selectedRun.run_config?.test_mode ?? true} />
                      <span className="text-xs text-gray-500">
                        {selectedRun.started_at ? new Date(selectedRun.started_at).toLocaleString() : '-'}
                      </span>
                      <span className="ml-auto"><StatusPill status={selectedRun.status} /></span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Targets found', value: displayStats?.found ?? 0 },
                        { label: 'Messages sent', value: displayStats?.sent ?? 0 },
                        { label: 'Drafts composed', value: displayStats?.drafted ?? 0 },
                        { label: 'Skipped', value: displayStats?.skipped ?? 0 },
                      ].map(s => (
                        <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                          <p className="text-lg font-medium text-gray-900">{s.value}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                    {selectedRun.errors?.length > 0 && (
                      <div className="bg-red-50 rounded-xl px-4 py-3 mt-3">
                        <p className="text-xs text-red-600 font-medium mb-1">Errors</p>
                        {selectedRun.errors.slice(0, 3).map((e, i) => (
                          <p key={i} className="text-[10px] text-red-500">{e}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-3">Targets found in this scan</p>
                    {targetsLoading && (
                      <div className="card space-y-2">{[0, 1, 2].map(i => <SkeletonRow key={i} />)}</div>
                    )}
                    {!targetsLoading && targetsUnavailable && (
                      <div className="card text-center py-8">
                        <p className="text-sm text-gray-500 mb-1">Can&apos;t load targets for this scan yet</p>
                        <p className="text-xs text-gray-400 max-w-md mx-auto">
                          This needs a backend endpoint: GET /campaigns/&#123;id&#125;/runs/&#123;run_id&#125;/targets,
                          returning the targets tied to that run. Requires a campaign_run_id column on outreach_targets.
                        </p>
                      </div>
                    )}
                    {!targetsLoading && !targetsUnavailable && runTargets.length === 0 && (
                      <div className="card text-center py-8">
                        <p className="text-sm text-gray-500">No targets recorded for this scan</p>
                      </div>
                    )}
                    {!targetsLoading && !targetsUnavailable && runTargets.length > 0 && (
                      <div className="space-y-2">
                        {runTargets.map(t => (
                          <div key={t.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                            <button
                              onClick={() => setExpandedTarget(expandedTarget === t.id ? null : t.id)}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-medium text-gray-900">{t.hr_name || '-'}</p>
                                    <span className="text-xs text-gray-400">{t.company}</span>
                                    <ActionBadge action={t.action_taken} />
                                  </div>
                                  <p className="text-xs text-gray-400 mt-0.5">{t.title}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {t.linkedin_url && (
                                    <a
                                      href={t.linkedin_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      className="text-[10px] text-blue-500 hover:text-blue-700 underline"
                                    >
                                      LinkedIn
                                    </a>
                                  )}
                                  <span className="text-xs text-gray-300">{expandedTarget === t.id ? '▲' : '▼'}</span>
                                </div>
                              </div>
                            </button>
                            {expandedTarget === t.id && t.message_sent && (
                              <div className="px-4 pb-4">
                                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
                                  {t.message_sent}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-1">{t.message_sent.length} chars</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ScanHistoryPage() {
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-8 w-64" /></div>}>
      <ScanHistoryContent />
    </Suspense>
  )
}
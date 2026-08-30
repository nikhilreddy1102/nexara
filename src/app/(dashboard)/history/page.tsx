'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { Skeleton } from '@/components/ui/Skeleton'
import { campaignsApi } from '@/lib/api'
import { cache } from '@/lib/cache'
import type { OutreachTarget } from '@/types'
import PersonalRowActions from './PersonalRowActions'
import FollowupReply from './Followupreply'

type TabType = 'all' | 'connection_with_note' | 'connection_no_note' | 'inmail' | 'personal' | 'scan_history'

interface SentTarget extends OutreachTarget {
  campaign_name?: string
  source?: 'people_finder' | 'campaign'
  entry_type?: 'search' | 'quick_track'
  reply_text?: string | null
  conversation_thread?: { direction: 'sent' | 'received'; text: string; at: string }[]
}

interface Campaign { id: string; name: string; mode: string; status: string; stats?: { total: number } }
interface CampaignRun {
  id: string
  status: string
  run_config: { test_mode: boolean; limit: number }
  targets_found: number
  targets_sent: number
  started_at: string
}

function formatTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function StatusDot({ target }: { target: SentTarget }) {
  if (target.replied_at) return <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0 mt-1.5" title="Replied" />
  if (target.accepted_at) return <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-1.5" title="Accepted" />
  if (target.status === 'tracked') return <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" title="Tracked - not connected yet" />
  return <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" title="Sent" />
}

function TypeBadge({ target }: { target: SentTarget }) {
  if (target.action_taken === 'inmail')
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">InMail</span>
  if (target.action_taken === 'connection_request' && target.message_sent)
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">Connection + note</span>
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">Connection</span>
}

function RunModeBadge({ testMode }: { testMode: boolean }) {
  return testMode
    ? <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-500">test</span>
    : <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-50 text-amber-600">live</span>
}

function ScanStatusPill({ status }: { status: string }) {
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

export default function HistoryPage() {
  const [targets, setTargets] = useState<SentTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabType>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null)
  const [campaignsLoading, setCampaignsLoading] = useState(true)

  // Only one campaign open at a time, only one scan open within it at a
  // time. Both runs and per-run targets are fetched lazily, on first
  // expand, and cached so re-opening the same one doesn't re-fetch.
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null)
  const [campaignRuns, setCampaignRuns] = useState<Record<string, CampaignRun[]>>({})
  const [campaignRunsLoading, setCampaignRunsLoading] = useState<Record<string, boolean>>({})
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  const [runTargetsMap, setRunTargetsMap] = useState<Record<string, OutreachTarget[]>>({})
  const [runTargetsLoadingMap, setRunTargetsLoadingMap] = useState<Record<string, boolean>>({})

  const toggleCampaign = (campaignId: string) => {
    if (expandedCampaignId === campaignId) {
      setExpandedCampaignId(null)
      setExpandedRunId(null)
      return
    }
    setExpandedCampaignId(campaignId)
    setExpandedRunId(null) // switching campaigns always closes whichever scan was open
    if (!campaignRuns[campaignId]) {
      // Same cache key the dedicated /campaigns/{id}/runs page uses — reuse
      // whatever it left warm instead of re-fetching from scratch.
      const cacheKey = `campaign_runs_list:${campaignId}`
      const cachedEntry = cache.get<{ campaign: unknown; runs: CampaignRun[] }>(cacheKey)
      if (cachedEntry) {
        setCampaignRuns(prev => ({ ...prev, [campaignId]: cachedEntry.runs }))
      } else {
        setCampaignRunsLoading(prev => ({ ...prev, [campaignId]: true }))
      }
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/campaigns/${campaignId}/runs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('nexara_token') ?? ''}` }
      })
        .then(r => r.json())
        .then(d => {
          const runs = (d?.runs || []) as CampaignRun[]
          const sorted = [...runs].sort((a, b) =>
            new Date(b.started_at ?? 0).getTime() - new Date(a.started_at ?? 0).getTime()
          )
          setCampaignRuns(prev => ({ ...prev, [campaignId]: sorted }))
          // Preserve whatever 'campaign' object the other page may have
          // already cached here — we don't have that object ourselves,
          // and overwriting it with null would break that page's cache.
          cache.set(cacheKey, { campaign: cachedEntry?.campaign ?? null, runs: sorted }, 15)
        })
        .catch(() => { if (!cachedEntry) setCampaignRuns(prev => ({ ...prev, [campaignId]: [] })) })
        .finally(() => setCampaignRunsLoading(prev => ({ ...prev, [campaignId]: false })))
    }
  }

  const toggleRun = (campaignId: string, runId: string) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null)
      return
    }
    setExpandedRunId(runId)
    if (!runTargetsMap[runId]) {
      // Same cache key as the "Last Run Results" modal and the dedicated
      // scan-history page — whichever one populated it first, all three
      // benefit.
      const cacheKey = `run_targets:${campaignId}:${runId}`
      const cached = cache.get<OutreachTarget[]>(cacheKey)
      if (cached) {
        setRunTargetsMap(prev => ({ ...prev, [runId]: cached }))
      } else {
        setRunTargetsLoadingMap(prev => ({ ...prev, [runId]: true }))
      }
      campaignsApi.runTargets(campaignId, runId)
        .then(res => {
          const list = res.targets || []
          setRunTargetsMap(prev => ({ ...prev, [runId]: list }))
          cache.set(cacheKey, list, 60)
        })
        .catch(() => { if (!cached) setRunTargetsMap(prev => ({ ...prev, [runId]: [] })) })
        .finally(() => setRunTargetsLoadingMap(prev => ({ ...prev, [runId]: false })))
    }
  }

  async function loadSentTargets() {
    try {
      const token = localStorage.getItem('nexara_token')
      const headers = { Authorization: `Bearer ${token ?? ''}` }
      // Two sources, merged into one list -- campaign sends and People
      // Finder sends are separate systems (see people_finder_results vs
      // outreach_messages), so this is a genuine merge of two API calls,
      // not one endpoint. Each failing independently degrades to an
      // empty list for that source rather than failing the whole page.
      const [campaignRes, peopleFinderRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/targets/sent`, { headers }).then(r => r.json()).catch(() => ({ targets: [] })),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/discovery-test/history`, { headers }).then(r => r.json()).catch(() => ({ targets: [] })),
      ])
      const list: SentTarget[] = [...(campaignRes.targets || []), ...(peopleFinderRes.targets || [])]
      list.sort((a, b) => new Date(b.sent_at || b.created_at).getTime() - new Date(a.sent_at || a.created_at).getTime())
      setTargets(list)
      cache.set('history_sent_targets', list, 15)
    } catch { }
    finally { setLoading(false) }
  }

  useEffect(() => {
    // Sent-outreach list: hydrate instantly from cache if we have it, then
    // always refetch in the background — short TTL since approve/send
    // actions elsewhere change this frequently.
    const cachedSent = cache.get<SentTarget[]>('history_sent_targets')
    if (cachedSent) { setTargets(cachedSent); setLoading(false) }
    loadSentTargets()

    // Scan history tab needs the campaign list up front (cheap, one call).
    // Reuses the same 'campaigns_stats' cache key as the dashboard and
    // analytics pages — whichever page visited it most recently keeps
    // this one warm too, and vice versa.
    const cachedCampaigns = cache.get<Campaign[]>('campaigns_stats')
    if (cachedCampaigns) { setCampaigns(cachedCampaigns); setCampaignsLoading(false) }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/campaigns/stats`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('nexara_token') ?? ''}` }
    })
      .then(r => r.json())
      .then(d => {
        const list = d.campaigns || []
        setCampaigns(list)
        cache.set('campaigns_stats', list, 30)
      })
      .catch(() => { if (!cachedCampaigns) setCampaigns(null) })
      .finally(() => setCampaignsLoading(false))
  }, [])

  // Personal (quick-track) entries are held OUT of "All" and every other
  // tab -- not just another filter on the same pool. That's what "won't
  // show up anywhere except Personal" actually requires; if they stayed
  // in the shared pool, "All" would include them too.
  const searchTargets = targets.filter(t => t.entry_type !== 'quick_track')
  const personalTargets = targets.filter(t => t.entry_type === 'quick_track')

  const filtered = (tab === 'personal' ? personalTargets : searchTargets).filter(t => {
    if (tab === 'all' || tab === 'personal') return true
    if (tab === 'inmail') return t.action_taken === 'inmail'
    if (tab === 'connection_with_note') return t.action_taken === 'connection_request' && !!t.message_sent
    if (tab === 'connection_no_note') return t.action_taken === 'connection_request' && !t.message_sent
    return true
  })

  const counts = {
    all: searchTargets.length,
    connection_with_note: searchTargets.filter(t => t.action_taken === 'connection_request' && !!t.message_sent).length,
    connection_no_note: searchTargets.filter(t => t.action_taken === 'connection_request' && !t.message_sent).length,
    inmail: searchTargets.filter(t => t.action_taken === 'inmail').length,
    personal: personalTargets.length,
    scan_history: campaigns?.length ?? 0,
  }

  const accepted = targets.filter(t => t.accepted_at).length
  const replied = targets.filter(t => t.replied_at).length
  const totalDiscovered = (campaigns ?? []).reduce((sum, c) => sum + (c.stats?.total ?? 0), 0)

  const tabs: { key: TabType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'connection_with_note', label: 'Connection + note' },
    { key: 'connection_no_note', label: 'Connection only' },
    { key: 'inmail', label: 'InMail' },
    { key: 'personal', label: 'Personal' },
    { key: 'scan_history', label: 'Scan history' },
  ]

  return (
    <div>
      <Header title="Outreach History" subtitle="All successfully sent outreach" />
      <div className="p-4 md:p-6 space-y-5">

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          {(tab === 'scan_history' ? [
            { label: 'Campaigns', value: campaigns?.length ?? 0, color: 'text-gray-900' },
            { label: 'Discovered (all time)', value: totalDiscovered, color: 'text-blue-600' },
            { label: 'Total sent', value: targets.length, color: 'text-green-600' },
          ] : [
            { label: 'Total sent', value: targets.length, color: 'text-gray-900' },
            { label: 'Accepted', value: accepted, color: 'text-green-600' },
            { label: 'Replied', value: replied, color: 'text-purple-600' },
          ]).map(s => (
            <div key={s.label} className="card text-center py-3">
              <p className={`text-2xl font-medium ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors flex items-center gap-1.5 ${
                tab === t.key
                  ? 'bg-brand-light border-brand text-brand-dark font-medium'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}>
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                tab === t.key ? 'bg-brand text-white' : 'bg-gray-100 text-gray-500'
              }`}>{counts[t.key]}</span>
            </button>
          ))}
        </div>

        {/* Loading */}
        {tab !== 'scan_history' && loading && (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="card animate-pulse flex gap-3 items-start">
                <Skeleton className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-2 w-64" />
                </div>
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {tab !== 'scan_history' && !loading && filtered.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-sm text-gray-500 mb-1">
              {tab === 'all' ? 'No sent outreach yet' : `No ${tabs.find(t => t.key === tab)?.label} sent yet`}
            </p>
            <p className="text-xs text-gray-400">Approved connection requests and inmails will appear here</p>
          </div>
        )}

        {/* List */}
        {tab !== 'scan_history' && !loading && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map(t => (
              <div key={t.id}
                className="card cursor-pointer hover:border-gray-300 transition-colors"
                onClick={() => setExpanded(expanded === t.id ? null : t.id)}
              >
                <div className="flex items-start gap-3">
                  <StatusDot target={t} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">{t.hr_name || '-'}</p>
                      {t.company && <span className="text-xs text-gray-400">{t.company}</span>}
                      <TypeBadge target={t} />
                      {t.accepted_at && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium">✓ Accepted</span>}
                      {t.replied_at && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">💬 Replied</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {t.campaign_name && <span className="text-[10px] text-gray-400">{t.campaign_name}</span>}
                      {t.source === 'people_finder' && <span className="text-[10px] text-gray-400">People Finder</span>}
                      {t.title && <span className="text-[10px] text-gray-400">{t.title}</span>}
                      {t.linkedin_url && (
                        <a href={t.linkedin_url} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-[10px] text-blue-500 hover:text-blue-700">LinkedIn ↗</a>
                      )}
                    </div>
                    {expanded === t.id && (
                      <div className="mt-3 bg-gray-50 rounded-lg p-3">
                        {t.status === 'tracked' ? (
                          <>
                            <p className="text-xs text-gray-500">Tracked - not connected yet.</p>
                            <PersonalRowActions targetId={t.id} onSent={loadSentTargets} />
                          </>
                        ) : t.message_sent ? (
                          <><p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{t.message_sent}</p>
                              <p className="text-[10px] text-gray-400 mt-1.5">{t.message_sent.length} chars</p></>
                        ) : (
                          <p className="text-xs text-gray-400 italic">No note - connection only</p>
                        )}
                        {t.status !== 'tracked' && t.replied_at && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            {t.conversation_thread && t.conversation_thread.length > 0 ? (
                              <div className="space-y-1.5">
                                <p className="text-[10px] text-gray-400 font-medium mb-1">Conversation:</p>
                                {t.conversation_thread.map((m, i) => (
                                  <div key={i} className={m.direction === 'sent' ? 'text-right' : 'text-left'}>
                                    <p className={`text-[10px] font-medium ${m.direction === 'sent' ? 'text-brand' : 'text-purple-500'}`}>
                                      {m.direction === 'sent' ? 'You' : 'Them'}
                                    </p>
                                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap inline-block">{m.text}</p>
                                  </div>
                                ))}
                              </div>
                            ) : t.reply_text ? (
                              <>
                                <p className="text-[10px] text-purple-500 font-medium mb-1">Their reply:</p>
                                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{t.reply_text}</p>
                              </>
                            ) : null}
                            {t.source === 'people_finder' && <FollowupReply targetId={t.id} />}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-gray-400">{t.sent_at ? formatTime(t.sent_at) : '-'}</p>
                    {t.accepted_at && <p className="text-[10px] text-green-500 mt-0.5">accepted {formatTime(t.accepted_at)}</p>}
                    {t.replied_at && <p className="text-[10px] text-purple-500 mt-0.5">replied {formatTime(t.replied_at)}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab !== 'scan_history' && !loading && targets.length > 0 && (
          <div className="flex items-center gap-4 text-[10px] text-gray-400 pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Sent</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Accepted</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Replied</span>
          </div>
        )}

        {/* Scan history - campaigns accordion (only one open at a time) */}
        {tab === 'scan_history' && (
          <div className="space-y-2">
            {campaignsLoading ? (
              [1,2,3].map(i => (
                <div key={i} className="card animate-pulse space-y-2">
                  <Skeleton className="h-3 w-40" /><Skeleton className="h-2 w-24" />
                </div>
              ))
            ) : !campaigns || campaigns.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-sm text-gray-500 mb-1">No campaigns yet</p>
                <p className="text-xs text-gray-400">Scans will show up here once you run a campaign</p>
              </div>
            ) : (
              campaigns.map(c => {
                const isCampaignOpen = expandedCampaignId === c.id
                const runs = campaignRuns[c.id]
                const runsLoading = campaignRunsLoading[c.id]
                return (
                  <div key={c.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleCampaign(c.id)}
                      className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-gray-300 transition-transform ${isCampaignOpen ? 'rotate-90' : ''}`}>▶</span>
                        <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{c.stats?.total ?? 0} discovered</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium capitalize flex-shrink-0">{c.mode}</span>
                    </button>

                    {isCampaignOpen && (
                      <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-3 space-y-2">
                        {runsLoading ? (
                          [1,2].map(i => (
                            <div key={i} className="bg-white rounded-lg p-3 animate-pulse">
                              <Skeleton className="h-3 w-32" />
                            </div>
                          ))
                        ) : !runs || runs.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">No scans for this campaign yet</p>
                        ) : (
                          runs.map(run => {
                            const isRunOpen = expandedRunId === run.id
                            const people = runTargetsMap[run.id]
                            const peopleLoading = runTargetsLoadingMap[run.id]
                            return (
                              <div key={run.id} className="bg-white border border-gray-100 rounded-lg overflow-hidden">
                                <button
                                  onClick={() => toggleRun(c.id, run.id)}
                                  className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`text-gray-300 text-[10px] transition-transform ${isRunOpen ? 'rotate-90' : ''}`}>▶</span>
                                    <RunModeBadge testMode={run.run_config?.test_mode ?? true} />
                                    <span className="text-xs text-gray-700 truncate">
                                      {run.started_at ? new Date(run.started_at).toLocaleString() : '-'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-[10px] text-gray-400">{run.targets_found ?? 0} found · {run.targets_sent ?? 0} sent</span>
                                    <ScanStatusPill status={run.status} />
                                  </div>
                                </button>
                                {isRunOpen && (
                                  <div className="border-t border-gray-100 px-3 py-3">
                                    {peopleLoading ? (
                                      <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-3 w-full" />)}</div>
                                    ) : !people || people.length === 0 ? (
                                      <p className="text-xs text-gray-400 text-center py-2">No targets recorded for this scan</p>
                                    ) : (
                                      <div className="space-y-1.5">
                                        {people.map(p => (
                                          <div key={p.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
                                            <div className="min-w-0">
                                              <p className="text-xs font-medium text-gray-900 truncate">{p.hr_name || '-'}</p>
                                              <p className="text-[10px] text-gray-400 truncate">{p.company || '-'}{p.title ? ` · ${p.title}` : ''}</p>
                                            </div>
                                            {p.linkedin_url && (
                                              <a
                                                href={p.linkedin_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={e => e.stopPropagation()}
                                                className="text-[10px] text-blue-500 hover:text-blue-700 flex-shrink-0"
                                              >
                                                LinkedIn
                                              </a>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
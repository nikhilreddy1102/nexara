'use client'

import { useState, useEffect, useMemo } from 'react'
import Header from '@/components/layout/Header'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { cache } from '@/lib/cache'

interface DailyEntry { label: string; value: number }
interface AnalyticsData {
  total_campaigns: number
  total_sent: number
  total_accepted: number
  total_replied: number
  acceptance_rate: number
  reply_rate: number
  daily_sent: DailyEntry[]
  by_mode: { fulltime: number; c2c: number; custom: number; people_finder: number }
}
interface CampaignStat { id: string; stats?: { total: number } }
interface CampaignRun { targets_found: number; started_at: string }
interface DiscoveredDay { key: string; weekday: string; monthDay: string; full: string; value: number }

// Builds the last N calendar days ending today, using America/Chicago
// (Central) day boundaries — computed here in the browser so this is
// actually guaranteed Central Time, not dependent on backend timezone
// handling I can't verify.
function lastNCentralDays(n: number): Omit<DiscoveredDay, 'value'>[] {
  const days: Omit<DiscoveredDay, 'value'>[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }) // YYYY-MM-DD
    const weekday = d.toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'short' })
    const monthDay = d.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' })
    const full = d.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'long', day: 'numeric', year: 'numeric' })
    days.push({ key, weekday, monthDay, full })
  }
  return days
}

function centralDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

const RANGE_OPTIONS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
]

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [totalDiscovered, setTotalDiscovered] = useState<number | null>(null)
  const [allRuns, setAllRuns] = useState<CampaignRun[]>([])
  const [runsLoaded, setRunsLoaded] = useState(false)
  const [rangeDays, setRangeDays] = useState(7)
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const cached = cache.get<AnalyticsData>('analytics_overview')
      const cachedCampaigns = cache.get<CampaignStat[]>('campaigns_stats')
      const cachedRuns = cache.get<CampaignRun[]>('all_campaign_runs')
      if (cachedCampaigns) {
        setTotalDiscovered(cachedCampaigns.reduce((sum, c) => sum + (c.stats?.total ?? 0), 0))
      }
      if (cachedRuns) { setAllRuns(cachedRuns); setRunsLoaded(true) }
      if (cached) { setData(cached); if (cachedCampaigns && cachedRuns) { setLoading(false); return } }
      try {
        const token = localStorage.getItem('nexara_token')
        const headers = { Authorization: `Bearer ${token ?? ''}` }
        const [overviewRes, campaignsRes] = await Promise.all([
          cached ? Promise.resolve(cached) : fetch(`${process.env.NEXT_PUBLIC_API_URL}/analytics/overview`, { headers }).then(r => r.json()).catch(() => null),
          cachedCampaigns
            ? Promise.resolve({ campaigns: cachedCampaigns })
            : fetch(`${process.env.NEXT_PUBLIC_API_URL}/campaigns/stats`, { headers }).then(r => r.json()).catch(() => ({ campaigns: [] })),
        ])
        if (!cached) cache.set('analytics_overview', overviewRes, 60)
        setData(overviewRes)
        const list = (campaignsRes as { campaigns: CampaignStat[] })?.campaigns || []
        if (!cachedCampaigns) cache.set('campaigns_stats', list, 30)
        setTotalDiscovered(list.reduce((sum, c) => sum + (c.stats?.total ?? 0), 0))

        // One /runs call per campaign — real per-scan timestamps + found
        // counts. We keep the raw list in state so switching the day-range
        // filter just re-buckets in memory, no re-fetch needed.
        if (!cachedRuns) {
          const runLists = await Promise.all(
            list.map(c =>
              fetch(`${process.env.NEXT_PUBLIC_API_URL}/campaigns/${c.id}/runs`, { headers })
                .then(r => r.json())
                .then(r => (r as { runs: CampaignRun[] })?.runs || [])
                .catch(() => [] as CampaignRun[])
            )
          )
          const flat = runLists.flat()
          cache.set('all_campaign_runs', flat, 60)
          setAllRuns(flat)
          setRunsLoaded(true)
        }
      } catch { }
      finally { setLoading(false) }
    }
    load()
  }, [])

  // Re-bucket in memory whenever the filter or the underlying runs change —
  // no network call needed since we already have every run's raw timestamp.
  const discoveredDays: DiscoveredDay[] = useMemo(() => {
    const days = lastNCentralDays(rangeDays)
    const buckets = new Map(days.map(d => [d.key, 0]))
    for (const run of allRuns) {
      if (!run.started_at) continue
      const key = centralDateKey(run.started_at)
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + (run.targets_found ?? 0))
    }
    return days.map(d => ({ ...d, value: buckets.get(d.key) ?? 0 }))
  }, [allRuns, rangeDays])

  const daily = data?.daily_sent ?? []
  const maxBar = Math.max(...daily.map(d => d.value), 1)
  const maxDiscoveredBar = Math.max(...discoveredDays.map(d => d.value), 1)
  const byMode = data?.by_mode ?? { fulltime: 0, c2c: 0, custom: 0, people_finder: 0 }
  const totalMode = byMode.fulltime + byMode.c2c + byMode.custom + byMode.people_finder || 1

  // Month range shown under the Discovered chart title, e.g. "Jul 2026" or
  // "Jun – Jul 2026" if the range spans two months.
  const monthLabel = useMemo(() => {
    if (discoveredDays.length === 0) return ''
    const first = new Date(discoveredDays[0].key)
    const last = new Date(discoveredDays[discoveredDays.length - 1].key)
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short' })
    const year = last.toLocaleDateString('en-US', { timeZone: 'America/Chicago', year: 'numeric' })
    return fmt(first) === fmt(last) ? `${fmt(first)} ${year}` : `${fmt(first)}–${fmt(last)} ${year}`
  }, [discoveredDays])

  const metrics = data ? [
    { label: 'Discovered', value: totalDiscovered ?? 0, color: 'text-gray-900' },
    { label: 'Total sent', value: data.total_sent, color: 'text-gray-900' },
    { label: 'Total accepted', value: data.total_accepted, color: 'text-brand' },
    { label: 'Total replied', value: data.total_replied, color: 'text-gray-900' },
    { label: 'Acceptance rate', value: `${data.acceptance_rate}%`, color: 'text-brand' },
  ] : []

  return (
    <div>
      <Header title="Analytics" subtitle="Performance insights" />
      <div className="p-4 md:p-6 space-y-6">

        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {loading ? [1,2,3,4,5].map(i => <SkeletonCard key={i} />) :
            metrics.map(m => (
              <div key={m.label} className="card">
                <p className="text-xs text-gray-500 mb-2">{m.label}</p>
                <p className={`text-2xl font-medium ${m.color}`}>{m.value}</p>
              </div>
            ))
          }
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className="space-y-4">

            {/* Discovered per day - bucketed in the browser using
                America/Chicago, real dates, interactive, filterable. */}
            <div className="card">
              <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <p className="text-sm font-medium text-gray-900">Discovered</p>
                <select
                  value={rangeDays}
                  onChange={e => setRangeDays(Number(e.target.value))}
                  className="text-xs bg-gray-50 border border-gray-200 text-gray-600 rounded-full px-2 py-1 font-medium focus:outline-none"
                >
                  {RANGE_OPTIONS.map(o => (
                    <option key={o.days} value={o.days}>{o.label}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-gray-400 mb-4">{monthLabel} · Central Time</p>
              {loading || !runsLoaded ? (
                <div className="h-32 bg-gray-50 rounded animate-pulse" />
              ) : discoveredDays.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-xs text-gray-400">No scan data yet</div>
              ) : (
                <div className="flex items-end gap-1.5 h-32 relative">
                  {discoveredDays.map((d, i) => (
                    <div
                      key={d.key}
                      className="flex-1 flex flex-col items-center gap-1.5 relative"
                      onMouseEnter={() => setHoveredBar(i)}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      {hoveredBar === i && (
                        <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] rounded-md px-2 py-1 whitespace-nowrap z-10 shadow-lg">
                          {d.full}: <b>{d.value}</b> discovered
                        </div>
                      )}
                      <div className="w-full relative flex items-end" style={{ height: '80px' }}>
                        <div
                          className={`w-full rounded-t transition-all cursor-pointer ${
                            d.value > 0
                              ? hoveredBar === i ? 'bg-blue-600' : 'bg-blue-500'
                              : 'bg-gray-100'
                          }`}
                          style={{ height: `${Math.max((d.value / maxDiscoveredBar) * 80, d.value > 0 ? 6 : 2)}px` }}
                        />
                      </div>
                      <span className={`text-[9px] ${hoveredBar === i ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                        {rangeDays <= 7 ? d.weekday : d.monthDay}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sent - backend-computed weekday buckets. No real date exists
                in this data (just labels like 'Tue'), so no filter/tooltip
                date here without a backend change. */}
            <div className="card">
              <p className="text-sm font-medium text-gray-900 mb-4">Sent this week</p>
              {loading ? (
                <div className="h-24 bg-gray-50 rounded animate-pulse" />
              ) : (
                <div className="flex items-end gap-2 h-24">
                  {daily.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                      <span className="text-[10px] text-gray-500 font-medium">
                        {d.value > 0 ? d.value : ''}
                      </span>
                      <div className="w-full relative flex items-end" style={{ height: '60px' }}>
                        <div
                          className={`w-full rounded-t transition-all ${d.value > 0 ? 'bg-brand' : 'bg-gray-100'}`}
                          style={{ height: `${Math.max((d.value / maxBar) * 60, d.value > 0 ? 6 : 2)}px` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400">{d.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* By mode */}
          <div className="card h-fit">
            <p className="text-sm font-medium text-gray-900 mb-4">By source</p>
            {loading ? (
              <div className="space-y-4">
                {[1,2,3,4].map(i => <div key={i} className="h-6 bg-gray-50 rounded animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {[
                  { label: 'Fulltime', color: 'bg-purple-400', count: byMode.fulltime },
                  { label: 'C2C', color: 'bg-brand', count: byMode.c2c },
                  { label: 'Custom', color: 'bg-amber-400', count: byMode.custom },
                  { label: 'People Finder', color: 'bg-blue-400', count: byMode.people_finder },
                ].map(m => {
                  const pct = Math.round((m.count / totalMode) * 100)
                  return (
                    <div key={m.label}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-gray-500">{m.label}</span>
                        <span className="text-gray-700 font-medium">
                          {m.count > 0 ? `${m.count} sent (${pct}%)` : 'No data'}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full">
                        <div className={`h-full ${m.color} rounded-full transition-all`}
                          style={{ width: `${m.count > 0 ? pct : 0}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Summary row */}
        {!loading && data && data.total_sent > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total campaigns', value: data.total_campaigns },
              { label: 'Reply rate', value: `${data.reply_rate}%` },
              { label: 'Pending acceptance', value: data.total_sent - data.total_accepted },
              { label: 'Converted', value: data.total_accepted },
            ].map(s => (
              <div key={s.label} className="card text-center py-3">
                <p className="text-lg font-medium text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
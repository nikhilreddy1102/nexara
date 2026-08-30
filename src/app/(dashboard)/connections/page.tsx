'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { connectionsApi, type LinkedInConnection } from '@/lib/api'

const PAGE_SIZE = 20
const POLL_INTERVAL_MS = 3000 // was 2500 -- slightly longer, fewer calls, no perceptible UX loss

type FilterKey = 'open_to_work' | 'hiring' | 'enriched'

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<LinkedInConnection[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [activeFilters, setActiveFilters] = useState<FilterKey[]>([])
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'paused' | 'completed' | 'failed'>('idle')
  const [totalSynced, setTotalSynced] = useState(0)
  const [totalConnections, setTotalConnections] = useState<number | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [startingSync, setStartingSync] = useState(false)
  const [checkingCount, setCheckingCount] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [enrichingId, setEnrichingId] = useState<string | null>(null)
  const [enrichStatus, setEnrichStatus] = useState<'idle' | 'enriching' | 'paused' | 'completed' | 'failed'>('idle')
  const [enrichedCount, setEnrichedCount] = useState(0)
  const [totalToEnrich, setTotalToEnrich] = useState(0)

  const [confirmTarget, setConfirmTarget] = useState<LinkedInConnection | null>(null)

  const enrichPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Always holds the CURRENT loadConnections (latest filters/search).
  // setInterval captures whatever function reference existed at the
  // moment it was created -- without this ref, a running poll started
  // before a filter/search change would keep calling a stale, unfiltered
  // fetch every tick and silently revert the visible results.
  const loadConnectionsRef = useRef<() => Promise<void>>(async () => {})

  // Cancels an in-flight fetch if a newer one starts before it resolves
  // (fast filter/page clicking) -- avoids a stale response landing after
  // a newer one and overwriting the correct results, and avoids wasting
  // the completed-but-now-irrelevant network/render work.
  const abortRef = useRef<AbortController | null>(null)

  const loadConnections = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    try {
      const params: Parameters<typeof connectionsApi.list>[0] = {
        limit: PAGE_SIZE,
        offset,
        ...(appliedSearch ? { search: appliedSearch } : {}),
        ...(activeFilters.includes('open_to_work') ? { open_to_work: true } : {}),
        ...(activeFilters.includes('hiring') ? { is_hiring: true } : {}),
        ...(activeFilters.includes('enriched') ? { enriched: true } : {}),
      }
      const res = await connectionsApi.list(params)
      if (!controller.signal.aborted) {
        setConnections(res.connections)
        setTotal(res.total)
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        // real error -- swallow silently here, list just won't update;
        // nothing user-facing needed for a failed background poll refetch
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [offset, activeFilters, appliedSearch])

  useEffect(() => { loadConnections() }, [loadConnections])
  useEffect(() => { loadConnectionsRef.current = loadConnections }, [loadConnections])

  // isInitialCheck=true means "just checking current status, don't also
  // refetch the list" -- the mount-time loadConnections() above already
  // covers the initial data load, so without this flag the very first
  // pollStatus() call (which always runs once on mount) would fire a
  // second, redundant fetch if status happens to already be
  // completed/paused (the common case).
  const pollStatus = useCallback(async (isInitialCheck = false) => {
    const status = await connectionsApi.syncStatus()
    setSyncStatus(status.status)
    setTotalSynced(status.total_synced)
    setTotalConnections(status.total_connections ?? null)
    setLastSyncedAt(status.last_synced_at)

    if (status.status !== 'syncing') {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = null
      if (!isInitialCheck && (status.status === 'completed' || status.status === 'paused')) {
        loadConnectionsRef.current()
      }
    }
    // While actively 'syncing', do NOT refetch the list every tick -- the
    // progress bar already updates from totalSynced/totalConnections in
    // status alone. Only refetch once, on the transition to finished.
  }, [])

  useEffect(() => {
    pollStatus(true) // initial check -- no redundant list refetch
    connectionsApi.getCachedCount()
      .then((res) => { if (res.total_connections !== null) setTotalConnections(res.total_connections) })
      .catch(() => {})
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      abortRef.current?.abort()
    }
  }, [pollStatus])

  const pollEnrichStatus = useCallback(async (isInitialCheck = false) => {
    const status = await connectionsApi.enrichStatus()
    setEnrichStatus(status.status)
    setEnrichedCount(status.enriched_count)
    setTotalToEnrich(status.total_to_enrich)
    if (status.status !== 'enriching') {
      if (enrichPollRef.current) clearInterval(enrichPollRef.current)
      enrichPollRef.current = null
      if (!isInitialCheck && (status.status === 'completed' || status.status === 'paused')) {
        loadConnectionsRef.current()
      }
    }
  }, [])

  useEffect(() => {
    pollEnrichStatus(true) // initial check -- no redundant list refetch
    return () => { if (enrichPollRef.current) clearInterval(enrichPollRef.current) }
  }, [pollEnrichStatus])

  const handleCheckCount = async () => {
    if (checkingCount) return
    setCheckingCount(true)
    setStartError(null)
    try {
      const res = await connectionsApi.checkCount()
      setTotalConnections(res.total_connections)
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Could not check your connection count.')
    } finally {
      setCheckingCount(false)
    }
  }

  const handleSyncAll = async () => {
    if (syncStatus === 'syncing' || startingSync || totalConnections === null) return
    setStartError(null)
    setStartingSync(true)
    try {
      const res = await connectionsApi.syncAll()
      setSyncStatus('syncing')
      setTotalConnections(res.total_connections)
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(() => pollStatus(false), POLL_INTERVAL_MS)
    } catch (err) {
      if (err instanceof Error && err.message.includes('already in progress')) {
        setSyncStatus('syncing')
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = setInterval(() => pollStatus(false), POLL_INTERVAL_MS)
      } else {
        setStartError(err instanceof Error ? err.message : 'Something went wrong starting the sync.')
      }
    } finally {
      setStartingSync(false)
    }
  }

  const handleStop = async () => { await connectionsApi.syncCancel() }

  const handleRefresh = async () => {
    if (refreshing || syncStatus === 'syncing') return
    setRefreshing(true)
    try {
      const res = await connectionsApi.refresh()
      setToast(res.fetched > 0 ? `${res.fetched} new connection${res.fetched === 1 ? '' : 's'} found` : 'No new connections since last check')
      setTimeout(() => setToast(null), 3000)
      if (res.total_connections !== null) setTotalConnections(res.total_connections)
      loadConnections()
    } finally {
      setRefreshing(false)
    }
  }

  const handleEnrichOne = async (id: string) => {
    setEnrichingId(id)
    try {
      const res = await connectionsApi.enrichOne(id)
      // Patch just this one row in place -- no full refetch, so the
      // person can't shift position or appear to vanish from the list.
      setConnections((prev) => prev.map((c) => (
        c.id === id
          ? {
              ...c,
              email: res.email,
              location: res.location,
              open_to_work: res.open_to_work,
              linkedin_url: res.linkedin_url ?? c.linkedin_url,
              enriched_at: new Date().toISOString(),
            }
          : c
      )))
    } catch {
      setToast('Could not enrich this profile')
      setTimeout(() => setToast(null), 3000)
    } finally {
      setEnrichingId(null)
    }
  }

  const handleEnrichAll = async (scope: 'all' | 'recruiters') => {
    if (enrichStatus === 'enriching') return
    try {
      await connectionsApi.enrichAll(scope)
      setEnrichStatus('enriching')
      setToast(`Enriching ${scope === 'recruiters' ? 'recruiter profiles' : 'all connections'} in the background`)
      setTimeout(() => setToast(null), 3000)
      if (enrichPollRef.current) clearInterval(enrichPollRef.current)
      enrichPollRef.current = setInterval(() => pollEnrichStatus(false), POLL_INTERVAL_MS)
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('already in progress'))) {
        setToast(err instanceof Error ? err.message : 'Could not start enrichment')
        setTimeout(() => setToast(null), 3000)
      }
    }
  }

  const handleEnrichStop = async () => { await connectionsApi.enrichCancel() }

  const filterLabels: Record<FilterKey, string> = {
    open_to_work: 'open to work',
    hiring: 'hiring',
    enriched: 'enriched',
  }

  const emptyStateMessage = (() => {
    if (activeFilters.length === 0 && !appliedSearch) {
      return 'No connections synced yet.'
    }
    const parts: string[] = []
    if (activeFilters.length > 0) {
      parts.push(activeFilters.map((f) => filterLabels[f]).join(' + '))
    }
    if (appliedSearch) {
      parts.push(`matching "${appliedSearch}"`)
    }
    return `We don't have any connections that are ${parts.join(' and ')}.`
  })()

  const progressPct = totalConnections ? Math.min(100, Math.round((totalSynced / totalConnections) * 100)) : null
  const enrichPct = totalToEnrich ? Math.min(100, Math.round((enrichedCount / totalToEnrich) * 100)) : 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const rangeStart = total === 0 ? 0 : offset + 1
  const rangeEnd = Math.min(offset + connections.length, total)

  const applySearch = () => { setAppliedSearch(search); setOffset(0) }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold">Connections</h1>
          <p className="text-sm text-gray-500">
            {lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}` : 'Never synced'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing || syncStatus === 'syncing'}
            className="px-3 py-2 text-sm border rounded-md disabled:opacity-50"
          >
            {refreshing ? 'Checking…' : 'Refresh'}
          </button>

          {syncStatus === 'syncing' ? (
            <button onClick={handleStop} className="px-3 py-2 text-sm border rounded-md text-red-600 border-red-300">
              Stop Sync
            </button>
          ) : totalConnections === null ? (
            <button
              onClick={handleCheckCount}
              disabled={checkingCount}
              className="px-3 py-2 text-sm bg-gray-800 text-white rounded-md disabled:opacity-50"
            >
              {checkingCount ? 'Checking…' : 'Check Connections Count'}
            </button>
          ) : (
            <button
              onClick={handleSyncAll}
              disabled={startingSync}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md disabled:opacity-50"
            >
              {startingSync ? 'Starting…' : `Sync All (${totalConnections})`}
            </button>
          )}

          {enrichStatus === 'enriching' ? (
            <button onClick={handleEnrichStop} className="px-3 py-2 text-sm border rounded-md text-red-600 border-red-300">
              Stop Enrich
            </button>
          ) : (
            <>
              <button
                onClick={() => handleEnrichAll('all')}
                disabled={total === 0}
                className="px-3 py-2 text-sm border rounded-md disabled:opacity-50"
              >
                Enrich All
              </button>
              <button
                onClick={() => handleEnrichAll('recruiters')}
                disabled={total === 0}
                className="px-3 py-2 text-sm border rounded-md disabled:opacity-50"
                title="Only enriches connections tagged as recruiter/hiring manager/founder"
              >
                Enrich Recruiters Only
              </button>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          {toast}
        </div>
      )}

      {startError && (
        <div className="mb-4 text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-center justify-between">
          <span>{startError}</span>
          <button onClick={() => setStartError(null)} className="text-red-700 underline">Dismiss</button>
        </div>
      )}

      {syncStatus === 'syncing' && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>
              Syncing… {totalSynced}
              {progressPct !== null ? ` / ${totalConnections} (${progressPct}%)` : ' synced so far'}
            </span>
          </div>
          {progressPct !== null ? (
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          ) : (
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-400 animate-pulse w-full" />
            </div>
          )}
        </div>
      )}

      {syncStatus === 'paused' && (
        <div className="mb-4 text-sm bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex items-center justify-between">
          <span>Synced {totalSynced}{totalConnections ? ` / ${totalConnections}` : ''} - incomplete.</span>
          <button onClick={handleSyncAll} className="text-amber-700 underline">Continue</button>
        </div>
      )}

      {syncStatus === 'failed' && (
        <div className="mb-4 text-sm bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-center justify-between">
          <span>Sync failed.</span>
          <button onClick={handleSyncAll} className="text-red-700 underline">Retry</button>
        </div>
      )}

      {enrichStatus === 'enriching' && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Enriching… {enrichedCount} / {totalToEnrich}</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 transition-all" style={{ width: `${enrichPct}%` }} />
          </div>
        </div>
      )}

      {enrichStatus === 'paused' && enrichedCount < totalToEnrich && (
        <div className="mb-4 text-sm bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex items-center justify-between">
          <span>Enrichment paused at {enrichedCount} / {totalToEnrich}.</span>
          <button onClick={() => handleEnrichAll('all')} className="text-amber-700 underline">Continue</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => { setActiveFilters([]); setOffset(0) }}
          className={`px-3 py-1.5 text-sm rounded-full border ${activeFilters.length === 0 ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}
        >
          All
        </button>
        {([
          { key: 'open_to_work', label: 'Open to Work' },
          { key: 'hiring', label: 'Hiring' },
          { key: 'enriched', label: 'Enriched' },
        ] as { key: FilterKey; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              setActiveFilters((prev) => prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key])
              setOffset(0)
            }}
            className={`px-3 py-1.5 text-sm rounded-full border ${activeFilters.includes(key) ? 'bg-gray-900 text-white' : 'bg-white text-gray-700'}`}
          >
            {label}
          </button>
        ))}

        <div className="sm:ml-auto flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => {
              const v = e.target.value
              setSearch(v)
              if (v === '') { setAppliedSearch(''); setOffset(0) }
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') applySearch() }}
            className="px-3 py-1.5 text-sm border rounded-md w-full sm:w-56"
          />
          <button
            onClick={applySearch}
            className="px-3 py-1.5 text-sm border rounded-md bg-gray-900 text-white flex-shrink-0"
          >
            Go
          </button>
        </div>
      </div>

      {total === 0 && !loading ? (
        <div className="text-center py-16 border rounded-lg">
          <p className="text-gray-500 mb-3">{emptyStateMessage}</p>
          {activeFilters.length === 0 && !appliedSearch && (
            <button
              onClick={totalConnections === null ? handleCheckCount : handleSyncAll}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm"
            >
              {totalConnections === null ? 'Check your connection count to begin' : 'Sync your LinkedIn connections'}
            </button>
          )}
        </div>
      ) : (
        <div className={`space-y-2 transition-opacity ${loading ? 'opacity-60' : 'opacity-100'}`}>
          {connections.map((c) => (
            <div
              key={c.id}
              onClick={() => c.linkedin_url && setConfirmTarget(c)}
              className={`border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3 ${c.linkedin_url ? 'cursor-pointer hover:bg-gray-50' : ''}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {c.profile_picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.profile_picture_url} alt="" className="w-10 h-10 rounded-full flex-shrink-0" loading="lazy" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className={`font-medium truncate ${c.linkedin_url ? 'text-blue-700 hover:underline' : ''}`}>
                    {c.name}
                  </div>
                  {c.headline && <div className="text-sm text-gray-600 truncate">{c.headline}</div>}
                  {c.location && <div className="text-xs text-gray-400 mt-0.5">{c.location}</div>}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.open_to_work && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Open to Work</span>
                    )}
                    {c.is_hiring && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                        {c.role_category === 'founder' ? 'Founder' : c.role_category === 'recruiter' ? 'Recruiter' : 'Hiring Manager'}
                      </span>
                    )}
                    {c.enriched_at && (
                      <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">Enriched</span>
                    )}
                    {c.email && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{c.email}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
                {!c.enriched_at && (
                  <button
                    onClick={() => handleEnrichOne(c.id)}
                    disabled={enrichingId === c.id}
                    className="text-xs px-2.5 py-1 border rounded-md text-gray-600 disabled:opacity-50"
                  >
                    {enrichingId === c.id ? 'Enriching…' : 'Enrich'}
                  </button>
                )}
                <button
                  onClick={() => c.linkedin_url && setConfirmTarget(c)}
                  disabled={!c.linkedin_url}
                  className="text-blue-600 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Message
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 mt-4 text-sm">
          <button
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            disabled={offset === 0}
            className="w-full sm:w-auto px-3 py-1.5 border rounded-md disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-gray-500 whitespace-nowrap">
            {rangeStart}–{rangeEnd} of {total} · Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
            className="w-full sm:w-auto px-3 py-1.5 border rounded-md disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {confirmTarget && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setConfirmTarget(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold mb-2">Open LinkedIn profile?</h3>
            <p className="text-sm text-gray-600 mb-5">
              Would you like to open <span className="font-medium">{confirmTarget.name}</span>&apos;s LinkedIn page in a new tab?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                className="px-3 py-1.5 text-sm border rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  window.open(confirmTarget.linkedin_url!, '_blank', 'noopener,noreferrer')
                  setConfirmTarget(null)
                }}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md"
              >
                Open Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { ModeBadge, StatusBadge } from '@/components/ui/Badges'
import { Skeleton } from '@/components/ui/Skeleton'
import { campaignsApi, isConnectivityError, friendlyErrorMessage } from '@/lib/api'
import { useLinkedInStatus } from '@/hooks/useLinkedInStatus'

const filters = ['all', 'active', 'paused', 'draft'] as const
type Filter = typeof filters[number]

interface CampaignStats {
  total: number; sent: number; accepted: number
  replied: number; pending: number; last_sent_at: string | null
}
interface Campaign {
  id: string; name: string; mode: string; status: string
  supervised_mode: boolean; created_at: string; stats?: CampaignStats
}

function formatRelativeTime(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function CampaignsPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const {
    data: campaignsData, isLoading: loading, error: campaignsError, mutate: mutateCampaigns,
  } = useSWR<{ campaigns: Campaign[] }>('/campaigns/stats')
  const campaigns = campaignsData?.campaigns || []

  // Same gate as campaigns/new -- that's the real enforcement point (it's
  // the file that actually creates a campaign), this is just so someone
  // browsing the list doesn't see campaigns with no way to have created
  // them, or hit a dead "+ New campaign" link.
  const {
    connected: linkedinConnectedRaw, loading: linkedinLoading, error: linkedinError, mutate: mutateLinkedin,
  } = useLinkedInStatus()
  const linkedinConnected: boolean | null = linkedinLoading ? null : linkedinConnectedRaw

  const {
    data: syncData, isLoading: syncLoading, error: syncError, mutate: mutateSync,
  } = useSWR<{ last_synced_at: string | null }>(linkedinConnected ? '/connections/sync-status' : null)
  const hasSyncedOnce: boolean | null =
    linkedinConnected !== true ? null : syncLoading ? null : !!syncData?.last_synced_at

  const gateError = isConnectivityError(linkedinError)
    ? friendlyErrorMessage(linkedinError)
    : isConnectivityError(syncError)
      ? friendlyErrorMessage(syncError)
      : isConnectivityError(campaignsError)
        ? friendlyErrorMessage(campaignsError)
        : null

  const retryChecks = () => { mutateLinkedin(); mutateSync(); mutateCampaigns() }

  async function handleDelete(e: React.MouseEvent, campaignId: string) {
    e.preventDefault()
    e.stopPropagation()
    if (confirmDeleteId !== campaignId) { setConfirmDeleteId(campaignId); return }
    setDeletingId(campaignId)
    try {
      await campaignsApi.delete(campaignId)
      await mutateCampaigns()
    } catch { alert('Failed to delete campaign') }
    finally { setDeletingId(null); setConfirmDeleteId(null) }
  }

  const filtered = filter === 'all' ? campaigns : campaigns.filter(c =>
    filter === 'active' ? c.status === 'running' : c.status === filter
  )

  if (linkedinConnected !== true || hasSyncedOnce !== true) {
    return (
      <div>
        <Header title="Campaigns" subtitle="Manage outreach campaigns" />
        <div className="p-4 md:p-6 max-w-3xl">
          {gateError && (
            <div className="card flex flex-col items-center text-center py-14 px-6">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.58 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">Couldn&apos;t reach Nexara</p>
              <p className="text-xs text-gray-500 max-w-sm mb-5">{gateError}</p>
              <button onClick={retryChecks} className="btn-primary">Retry</button>
            </div>
          )}
          {!gateError && linkedinConnected === false && (
            <div className="card flex flex-col items-center text-center py-14 px-6">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">Connect LinkedIn to unlock campaigns</p>
              <p className="text-xs text-gray-500 max-w-sm mb-5">
                Campaigns send and track outreach through your own LinkedIn account, so
                there&apos;s nothing for a campaign to do until it&apos;s connected.
              </p>
              <a href="/settings" className="btn-primary">Connect LinkedIn</a>
            </div>
          )}
          {!gateError && linkedinConnected === true && hasSyncedOnce === false && (
            <div className="card flex flex-col items-center text-center py-14 px-6">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">Sync your connections to unlock campaigns</p>
              <p className="text-xs text-gray-500 max-w-sm mb-5">
                LinkedIn&apos;s connected, but campaigns need your existing connections
                synced first so Nexara knows who&apos;s already in your network.
              </p>
              <a href="/connections" className="btn-primary">Sync connections</a>
            </div>
          )}
          {!gateError &&
            (linkedinConnected === null || (linkedinConnected === true && hasSyncedOnce === null)) && (
            <div className="card animate-pulse h-40" />
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header
        title="Campaigns"
        subtitle="Manage outreach campaigns"
        action={<Link href="/campaigns/new" className="btn-primary">+ New campaign</Link>}
      />
      <div className="p-4 md:p-6">
        <div className="flex gap-2 mb-5 flex-wrap">
          {filters.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs border transition-colors ${
                filter === f ? 'bg-brand-light border-brand text-brand-dark font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="card animate-pulse">
                <div className="flex justify-between mb-3">
                  <Skeleton className="h-4 w-48" />
                  <div className="flex gap-2"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-5 w-14 rounded-full" /></div>
                </div>
                <div className="flex gap-4 mb-3">{[1,2,3,4].map(j => <Skeleton key={j} className="h-3 w-16" />)}</div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <EmptyState
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>}
            title={filter === 'all' ? 'No campaigns yet' : `No ${filter} campaigns`}
            description={filter === 'all' ? 'Create your first campaign to start reaching out.' : `No ${filter} campaigns right now.`}
            action={filter === 'all' ? { label: '+ Create campaign', href: '/campaigns/new' } : undefined}
          />
        )}

        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map(c => {
              const s = c.stats ?? { total: 0, sent: 0, accepted: 0, replied: 0, pending: 0, last_sent_at: null }
              const acceptance = s.sent > 0 ? Math.round((s.accepted / s.sent) * 100) : 0
              const progress = s.total > 0 ? Math.round((s.sent / s.total) * 100) : 0
              const isConfirming = confirmDeleteId === c.id
              const isDeleting = deletingId === c.id

              return (
                <div key={c.id} className="card relative group hover:border-brand transition-colors">
                  {/* Delete - sits outside Link, no propagation issue */}
                  <div className="absolute top-3 right-3 z-10 flex gap-2 items-center">
                    {isConfirming ? (
                      <>
                        <button
                          onClick={(e) => handleDelete(e, c.id)}
                          disabled={isDeleting}
                          className="text-xs px-2.5 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 transition-colors"
                        >
                          {isDeleting ? 'Deleting…' : 'Confirm'}
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(null) }}
                          className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => handleDelete(e, c.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50"
                        title="Delete campaign"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Clickable card body - Link wraps only the content, not the delete button */}
                  <Link href={`/campaigns/${c.id}`} className="block pr-10">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900 mb-0.5">{c.name}</p>
                        <p className="text-xs text-gray-400">
                          {c.supervised_mode ? 'Supervised' : 'Autonomous'} · Created {new Date(c.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 ml-4">
                        <ModeBadge mode={c.mode} />
                        <StatusBadge status={c.status} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-3">
                      <span><b className="text-gray-900">{s.sent}</b> sent</span>
                      <span><b className="text-brand">{s.accepted}</b> accepted</span>
                      <span><b className="text-gray-900">{s.replied}</b> replied</span>
                      <span><b className="text-gray-900">{acceptance}%</b> acceptance</span>
                      {s.pending > 0 && <span className="text-amber-600"><b>{s.pending}</b> pending approval</span>}
                    </div>
                    <div className="progress-bg">
                      <div className="progress-bar" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-xs text-gray-400">{s.sent} of {s.total} targets contacted</p>
                      {s.last_sent_at
                        ? <p className="text-xs text-gray-400">Last sent <span className="text-gray-600 font-medium">{formatRelativeTime(s.last_sent_at)}</span></p>
                        : s.pending > 0
                          ? <p className="text-xs text-amber-500 font-medium">Awaiting approval</p>
                          : s.total > 0 ? <p className="text-xs text-gray-400">No sends yet</p> : null
                      }
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

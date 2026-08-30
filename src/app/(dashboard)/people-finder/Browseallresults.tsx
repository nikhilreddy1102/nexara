'use client'

import { useState } from 'react'
import { Megaphone, X, Loader2, ChevronDown } from 'lucide-react'
import StartCampaignBar from './StartCampaignBar'

function authHeaders() {
  const token = localStorage.getItem('nexara_token')
  return { Authorization: `Bearer ${token ?? ''}` }
}

interface SavedResult {
  id: string
  name?: string
  title?: string
  company?: string
  linkedin_url?: string
  hiring_detected?: boolean
  [key: string]: unknown
}

const PAGE_SIZE = 25

/**
 * "Run Campaign" without a fresh search -- browses EVERY saved People
 * Finder result across all past searches (/all-results), with a hiring-only
 * filter. Selecting under hiring-only and starting a campaign passes
 * verify_hiring=true so the backend re-confirms anyone whose enrichment is
 * more than 24h stale before including them, rather than trusting an old scan.
 */
export default function BrowseAllResults() {
  const [isOpen, setIsOpen] = useState(false)
  const [hiringOnly, setHiringOnly] = useState(false)
  const [results, setResults] = useState<SavedResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const load = async (hiring: boolean, append: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const offset = append ? results.length : 0
      const params = new URLSearchParams({ hiring_only: String(hiring), limit: String(PAGE_SIZE), offset: String(offset) })
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/discovery-test/all-results?${params}`, {
        headers: authHeaders(),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body?.detail ?? 'Failed to load results')
        return
      }
      setResults(prev => append ? [...prev, ...body.results] : body.results)
      setTotal(body.total ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const open = () => {
    setIsOpen(true)
    setSelectedIds(new Set())
    load(hiringOnly, false)
  }

  const toggleHiringOnly = (val: boolean) => {
    setHiringOnly(val)
    setSelectedIds(new Set())
    load(val, false)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <>
      <button
        onClick={open}
        className="flex items-center gap-2 text-xs font-medium px-3.5 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <Megaphone size={14} />
        Run Campaign
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={() => setIsOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <p className="text-sm font-medium text-gray-900">Run a campaign from People Finder</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Every person you&apos;ve ever found - not just this session&apos;s search</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="px-5 pt-3 flex gap-2 flex-shrink-0">
              <button
                onClick={() => toggleHiringOnly(false)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${!hiringOnly ? 'border-brand bg-brand/5 text-brand' : 'border-gray-200 text-gray-500'}`}
              >
                Everyone
              </button>
              <button
                onClick={() => toggleHiringOnly(true)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${hiringOnly ? 'border-brand bg-brand/5 text-brand' : 'border-gray-200 text-gray-500'}`}
              >
                Hiring signal only
              </button>
              {hiringOnly && (
                <span className="text-[10px] text-gray-400 self-center">Stale (24h+) hiring data gets re-confirmed before sending</span>
              )}
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {error && <p className="text-xs text-red-500 mb-3">⚠ {error}</p>}

              {loading && results.length === 0 && (
                <div className="py-8 text-center">
                  <Loader2 size={22} className="animate-spin mx-auto text-brand mb-3" />
                  <p className="text-xs text-gray-500">Loading…</p>
                </div>
              )}

              {!loading && results.length === 0 && !error && (
                <p className="text-xs text-gray-400 text-center py-8">
                  {hiringOnly ? 'No saved results currently show a hiring signal.' : 'No saved People Finder results yet - run a search first.'}
                </p>
              )}

              <div className="space-y-2">
                {results.map(r => (
                  <label key={r.id} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      className="mt-1 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.name || '-'}</p>
                        {r.hiring_detected && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium">Hiring</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{r.title}{r.company ? ` · ${r.company}` : ''}</p>
                    </div>
                  </label>
                ))}
              </div>

              {results.length < total && (
                <button
                  onClick={() => load(hiringOnly, true)}
                  disabled={loading}
                  className="w-full text-xs text-gray-500 hover:text-gray-700 py-3 flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {loading ? 'Loading…' : <>View more <ChevronDown size={14} /></>}
                </button>
              )}
            </div>
          </div>

          <div onClick={e => e.stopPropagation()}>
            <StartCampaignBar
              selectedIds={Array.from(selectedIds)}
              onClear={() => setSelectedIds(new Set())}
              verifyHiring={hiringOnly}
            />
          </div>
        </div>
      )}
    </>
  )
}
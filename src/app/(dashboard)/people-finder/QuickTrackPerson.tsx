'use client'

import { useState } from 'react'
import { User, X, Search, Link2, Check, Loader2 } from 'lucide-react'

function authHeaders() {
  const token = localStorage.getItem('nexara_token')
  return { Authorization: `Bearer ${token ?? ''}` }
}

interface Candidate {
  name: string | null
  title: string | null
  company: string | null
  linkedin_url: string | null
  provider_id: string | null
  raw: Record<string, unknown>
}

type Step =
  | { kind: 'input' }
  | { kind: 'searching' }
  | { kind: 'candidates'; mode: 'url' | 'name_search'; candidates: Candidate[] }
  | { kind: 'saving'; candidate: Candidate }
  | { kind: 'tracked'; resultId: string; candidate: Candidate }
  | { kind: 'error'; message: string }

type ActionState = { kind: 'idle' } | { kind: 'loading'; action: string } | { kind: 'done'; action: string } | { kind: 'error'; message: string }

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function looksLikeUrl(q: string) {
  const s = q.trim().toLowerCase()
  return s.startsWith('http') && s.includes('linkedin.com')
}

export default function QuickTrackPerson() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [step, setStep] = useState<Step>({ kind: 'input' })
  const [action, setAction] = useState<ActionState>({ kind: 'idle' })

  const reset = () => {
    setQuery('')
    setStep({ kind: 'input' })
    setAction({ kind: 'idle' })
  }

  const close = () => {
    setIsOpen(false)
    reset()
  }

  const runSearch = async () => {
    if (!query.trim()) return
    setStep({ kind: 'searching' })
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/discovery-test/quick-track/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ query: query.trim() }),
      })
      const body = await res.json()
      if (!res.ok) {
        setStep({ kind: 'error', message: body?.detail ?? `Search failed (${res.status})` })
        return
      }
      const candidates: Candidate[] = body.candidates || []
      if (candidates.length === 0) {
        setStep({ kind: 'error', message: looksLikeUrl(query) ? "Couldn't resolve that LinkedIn URL" : 'No matches found - try a different name' })
        return
      }
      setStep({ kind: 'candidates', mode: body.mode, candidates })
    } catch (e) {
      setStep({ kind: 'error', message: e instanceof Error ? e.message : 'Network error' })
    }
  }

  const pickCandidate = async (candidate: Candidate) => {
    setStep({ kind: 'saving', candidate })
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/discovery-test/quick-track/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          linkedin_url: candidate.linkedin_url,
          name: candidate.name,
          title: candidate.title,
          company: candidate.company,
          provider_id: candidate.provider_id,
          raw: candidate.raw,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setStep({ kind: 'error', message: body?.detail ?? `Save failed (${res.status})` })
        return
      }
      setStep({ kind: 'tracked', resultId: body.result.id, candidate })
    } catch (e) {
      setStep({ kind: 'error', message: e instanceof Error ? e.message : 'Network error' })
    }
  }

  const runAction = async (resultId: string, path: string, actionLabel: string) => {
    setAction({ kind: 'loading', action: actionLabel })
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/discovery-test/${path}/${resultId}`, {
        method: 'POST', headers: authHeaders(),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAction({ kind: 'error', message: body?.detail ?? `${actionLabel} failed` })
        return
      }
      setAction({ kind: 'done', action: actionLabel })
    } catch (e) {
      setAction({ kind: 'error', message: e instanceof Error ? e.message : 'Network error' })
    }
  }

  return (
    <>
      {/* Deliberately amber, not the app's teal brand color -- this is a
          distinct, occasional action (one specific person) next to the
          page's main broad-search flow, and the color difference signals
          that at a glance. */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 text-xs font-medium px-3.5 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
      >
        <User size={14} />
        Have someone in mind?
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={close}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-900">Track a specific person</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Won&apos;t show up in your regular search results - only on History</p>
              </div>
              <button onClick={close} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              {step.kind === 'input' && (
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    LinkedIn URL or name
                  </label>
                  <input
                    autoFocus
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && runSearch()}
                    placeholder="e.g. Priya Sharma, or https://linkedin.com/in/..."
                    className="input w-full text-sm"
                  />
                  <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                    {looksLikeUrl(query) ? (
                      <><Link2 size={12} /> Will resolve this exact profile directly</>
                    ) : query.trim() ? (
                      <><Search size={12} /> Will search LinkedIn for this name - you&apos;ll pick from a short list</>
                    ) : (
                      'Paste a profile URL for an exact match, or type a name to search'
                    )}
                  </p>
                  <button
                    onClick={runSearch}
                    disabled={!query.trim()}
                    className="btn-primary w-full mt-2 disabled:opacity-40"
                  >
                    {looksLikeUrl(query) ? 'Resolve profile' : 'Search'}
                  </button>
                </div>
              )}

              {step.kind === 'searching' && (
                <div className="py-8 text-center">
                  <Loader2 size={22} className="animate-spin mx-auto text-brand mb-3" />
                  <p className="text-xs text-gray-500">
                    {looksLikeUrl(query) ? 'Resolving that profile…' : 'Searching LinkedIn…'}
                  </p>
                </div>
              )}

              {step.kind === 'candidates' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 mb-2">
                    {step.mode === 'url' ? 'Confirm this is the right person:' : `${step.candidates.length} match${step.candidates.length === 1 ? '' : 'es'} - pick the right one:`}
                  </p>
                  {step.candidates.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => pickCandidate(c)}
                      className="w-full text-left flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-brand hover:bg-brand-light transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-brand-light text-brand-dark flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                        {initials(c.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.name || '-'}</p>
                        <p className="text-xs text-gray-500 truncate">{c.title}{c.company ? ` · ${c.company}` : ''}</p>
                      </div>
                    </button>
                  ))}
                  <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 pt-1">← Try a different search</button>
                </div>
              )}

              {step.kind === 'saving' && (
                <div className="py-8 text-center">
                  <Loader2 size={22} className="animate-spin mx-auto text-brand mb-3" />
                  <p className="text-xs text-gray-500">Saving {step.candidate.name}…</p>
                </div>
              )}

              {step.kind === 'tracked' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                    <Check size={16} />
                    <p className="text-xs font-medium">Now tracking {step.candidate.name} - check History → Personal</p>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-900">{step.candidate.name}</p>
                    <p className="text-xs text-gray-500">{step.candidate.title}{step.candidate.company ? ` · ${step.candidate.company}` : ''}</p>
                    {step.candidate.linkedin_url && (
                      <a href={step.candidate.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:text-blue-700">View profile ↗</a>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-700">What next?</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => runAction(step.resultId, 'enrich', 'Get more details')}
                        disabled={action.kind === 'loading'}
                        className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {action.kind === 'loading' && action.action === 'Get more details' ? 'Loading…' : 'Get more details'}
                      </button>
                      <button
                        onClick={() => runAction(step.resultId, 'connect', 'Connect without note')}
                        disabled={action.kind === 'loading'}
                        className="text-xs px-3 py-1.5 rounded-lg bg-brand text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {action.kind === 'loading' && action.action === 'Connect without note' ? 'Sending…' : 'Connect without note'}
                      </button>
                    </div>
                    {action.kind === 'done' && (
                      <p className="text-[11px] text-green-600">✓ {action.action} - done</p>
                    )}
                    {action.kind === 'error' && (
                      <p className="text-[11px] text-red-500">⚠ {action.message}</p>
                    )}
                  </div>

                  <button onClick={close} className="btn-secondary w-full text-xs">Done</button>
                </div>
              )}

              {step.kind === 'error' && (
                <div className="space-y-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-red-600">⚠ {step.message}</p>
                  </div>
                  <button onClick={reset} className="btn-secondary w-full text-xs">Try again</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
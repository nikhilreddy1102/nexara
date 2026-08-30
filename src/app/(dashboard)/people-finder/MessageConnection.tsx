'use client'

import { useState } from 'react'
import { Users, X, Loader2, Check, Search } from 'lucide-react'

function authHeaders() {
  const token = localStorage.getItem('nexara_token')
  return { Authorization: `Bearer ${token ?? ''}` }
}

interface Connection {
  name?: string
  title?: string
  company?: string
  provider_id?: string
  linkedin_url?: string
  [key: string]: unknown
}

type Step =
  | { kind: 'search' }
  | { kind: 'searching' }
  | { kind: 'results'; connections: Connection[] }
  | { kind: 'compose'; connection: Connection; text: string }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string }

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

/**
 * Distinct from "Have someone in mind?" -- that resolves a URL or searches
 * LinkedIn broadly. This searches your REAL existing connections list
 * (/my-connections), for reaching back out to someone you already know
 * but lost touch with -- the actual "stay in front of hiring managers"
 * product pitch. Compose is manual-only here (no Generate with Nexara) --
 * there's no existing conversation thread for a cold re-connect the way
 * there is for a reply, so there's nothing for Haiku to draft from yet.
 */
export default function MessageConnection() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [step, setStep] = useState<Step>({ kind: 'search' })

  const close = () => {
    setIsOpen(false)
    setQuery('')
    setStep({ kind: 'search' })
  }

  const search = async () => {
    setStep({ kind: 'searching' })
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('search', query.trim())
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/discovery-test/my-connections?${params}`, {
        headers: authHeaders(),
      })
      const body = await res.json()
      if (!res.ok) {
        setStep({ kind: 'error', message: body?.detail ?? 'Failed to load connections' })
        return
      }
      const connections: Connection[] = body.items || []
      setStep({ kind: 'results', connections })
    } catch (e) {
      setStep({ kind: 'error', message: e instanceof Error ? e.message : 'Network error' })
    }
  }

  const send = async () => {
    if (step.kind !== 'compose') return
    const message = step.text.trim()
    if (!message) return
    setStep({ kind: 'sending' })
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/discovery-test/message-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          provider_id: step.connection.provider_id,
          name: step.connection.name,
          title: step.connection.title,
          company: step.connection.company,
          linkedin_url: step.connection.linkedin_url,
          message,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStep({ kind: 'error', message: body?.detail ?? 'Failed to send' })
        return
      }
      setStep({ kind: 'sent' })
    } catch (e) {
      setStep({ kind: 'error', message: e instanceof Error ? e.message : 'Network error' })
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 text-xs font-medium px-3.5 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
      >
        <Users size={14} />
        Message a connection
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={close}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-900">Message a connection</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Reach back out to someone you already know</p>
              </div>
              <button onClick={close} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="p-5">
              {step.kind === 'search' && (
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Search your connections</label>
                  <input
                    autoFocus
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && search()}
                    placeholder="e.g. Aravind, or leave blank to see recent connections"
                    className="input w-full text-sm"
                  />
                  <button onClick={search} className="btn-primary w-full mt-2">
                    <Search size={14} className="inline mr-1.5" />
                    Search
                  </button>
                </div>
              )}

              {step.kind === 'searching' && (
                <div className="py-8 text-center">
                  <Loader2 size={22} className="animate-spin mx-auto text-brand mb-3" />
                  <p className="text-xs text-gray-500">Loading your connections…</p>
                </div>
              )}

              {step.kind === 'results' && (
                <div className="space-y-2">
                  {step.connections.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6">No matches - try a different search</p>
                  ) : (
                    step.connections.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => setStep({ kind: 'compose', connection: c, text: '' })}
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
                    ))
                  )}
                  <button onClick={() => setStep({ kind: 'search' })} className="text-xs text-gray-400 hover:text-gray-600 pt-1">← Search again</button>
                </div>
              )}

              {(step.kind === 'compose' || step.kind === 'sending') && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-brand-light text-brand-dark flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                      {initials(step.kind === 'compose' ? step.connection.name : undefined)}
                    </div>
                    <p className="text-sm font-medium text-gray-900">{step.kind === 'compose' ? step.connection.name : ''}</p>
                  </div>
                  <textarea
                    autoFocus
                    value={step.kind === 'compose' ? step.text : ''}
                    onChange={e => step.kind === 'compose' && setStep({ kind: 'compose', connection: step.connection, text: e.target.value })}
                    disabled={step.kind === 'sending'}
                    placeholder="Write your message - no auto-generation here, this is a fresh conversation with nothing to draft from yet"
                    rows={4}
                    className="input w-full text-sm resize-none disabled:opacity-50"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">
                      {step.kind === 'compose' ? `${step.text.length} chars` : 'Sending…'}
                    </span>
                    <button onClick={send} disabled={step.kind === 'sending' || (step.kind === 'compose' && !step.text.trim())}
                      className="btn-primary disabled:opacity-40">
                      {step.kind === 'sending' ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              )}

              {step.kind === 'sent' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                    <Check size={16} />
                    <p className="text-xs font-medium">Message sent - check History → Personal</p>
                  </div>
                  <button onClick={close} className="btn-secondary w-full text-xs">Done</button>
                </div>
              )}

              {step.kind === 'error' && (
                <div className="space-y-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-red-600">⚠ {step.message}</p>
                  </div>
                  <button onClick={() => setStep({ kind: 'search' })} className="btn-secondary w-full text-xs">Try again</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
'use client'

import { useState } from 'react'

function authHeaders() {
  const token = localStorage.getItem('nexara_token')
  return { Authorization: `Bearer ${token ?? ''}` }
}

type NoteState =
  | { kind: 'idle' }
  | { kind: 'editing'; text: string }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string }

type SimpleState = { kind: 'idle' | 'loading' | 'done' } | { kind: 'error'; message: string }

interface Props {
  targetId: string
  onSent?: () => void   // lets the parent refresh the list so status flips from "tracked" to "sent" without a full page reload
}

/**
 * Only appears for Personal-tab rows that haven't been connected with yet
 * (status: 'tracked'). Deliberately manual-note-only -- no "generate with
 * Nexara" button here. /compose-note (the Haiku draft) is a separate,
 * optional backend endpoint this component simply never calls; wiring it
 * in later is additive, not a rework of this component.
 */
export default function PersonalRowActions({ targetId, onSent }: Props) {
  const [detailsState, setDetailsState] = useState<SimpleState>({ kind: 'idle' })
  const [connectState, setConnectState] = useState<SimpleState>({ kind: 'idle' })
  const [noteState, setNoteState] = useState<NoteState>({ kind: 'idle' })

  const getDetails = async () => {
    setDetailsState({ kind: 'loading' })
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/discovery-test/enrich/${targetId}`, {
        method: 'POST', headers: authHeaders(),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setDetailsState({ kind: 'error', message: body?.detail ?? 'Failed to load details' })
        return
      }
      setDetailsState({ kind: 'done' })
    } catch (e) {
      setDetailsState({ kind: 'error', message: e instanceof Error ? e.message : 'Network error' })
    }
  }

  const connectWithoutNote = async () => {
    setConnectState({ kind: 'loading' })
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/discovery-test/connect/${targetId}`, {
        method: 'POST', headers: authHeaders(),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setConnectState({ kind: 'error', message: body?.detail ?? 'Failed to connect' })
        return
      }
      setConnectState({ kind: 'done' })
      onSent?.()
    } catch (e) {
      setConnectState({ kind: 'error', message: e instanceof Error ? e.message : 'Network error' })
    }
  }

  const sendWithNote = async () => {
    if (noteState.kind !== 'editing') return
    const message = noteState.text.trim()
    if (!message) return
    setNoteState({ kind: 'sending' })
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/discovery-test/connect-with-note/${targetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ message }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setNoteState({ kind: 'error', message: body?.detail ?? 'Failed to send' })
        return
      }
      setNoteState({ kind: 'sent' })
      onSent?.()
    } catch (e) {
      setNoteState({ kind: 'error', message: e instanceof Error ? e.message : 'Network error' })
    }
  }

  const bothDone = connectState.kind === 'done' || noteState.kind === 'sent'
  if (bothDone) {
    return <p className="text-[11px] text-green-600 mt-2">✓ Connection request sent</p>
  }

  return (
    <div className="mt-2 pt-2 border-t border-gray-100" onClick={e => e.stopPropagation()}>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={getDetails}
          disabled={detailsState.kind === 'loading'}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {detailsState.kind === 'loading' ? 'Loading…' : detailsState.kind === 'done' ? '✓ Details loaded' : 'Get more details'}
        </button>
        <button
          onClick={connectWithoutNote}
          disabled={connectState.kind === 'loading' || noteState.kind === 'editing'}
          className="text-xs px-2.5 py-1.5 rounded-lg bg-brand text-white hover:opacity-90 disabled:opacity-50"
        >
          {connectState.kind === 'loading' ? 'Sending…' : 'Connect without note'}
        </button>
        <button
          onClick={() => setNoteState({ kind: 'editing', text: '' })}
          disabled={noteState.kind === 'editing' || connectState.kind === 'loading'}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-brand text-brand hover:bg-brand-light disabled:opacity-50"
        >
          Connect with note
        </button>
      </div>

      {detailsState.kind === 'error' && <p className="text-[11px] text-red-500 mt-1.5">⚠ {detailsState.message}</p>}
      {connectState.kind === 'error' && <p className="text-[11px] text-red-500 mt-1.5">⚠ {connectState.message}</p>}

      {noteState.kind === 'editing' && (
        <div className="mt-2 space-y-1.5">
          <textarea
            autoFocus
            value={noteState.text}
            onChange={e => setNoteState({ kind: 'editing', text: e.target.value })}
            placeholder="Write your own note - nothing is generated for you here"
            rows={3}
            className="input w-full text-xs resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400">{noteState.text.length} chars</span>
            <div className="flex gap-2">
              <button onClick={() => setNoteState({ kind: 'idle' })} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={sendWithNote}
                disabled={!noteState.text.trim()}
                className="text-xs px-2.5 py-1 rounded-lg bg-brand text-white hover:opacity-90 disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
      {noteState.kind === 'sending' && <p className="text-[11px] text-gray-500 mt-1.5">Sending…</p>}
      {noteState.kind === 'error' && <p className="text-[11px] text-red-500 mt-1.5">⚠ {noteState.message}</p>}
    </div>
  )
}
'use client'

import { useState } from 'react'

function authHeaders() {
  const token = localStorage.getItem('nexara_token')
  return { Authorization: `Bearer ${token ?? ''}` }
}

type ComposeState =
  | { kind: 'idle' }
  | { kind: 'editing'; text: string }
  | { kind: 'generating' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string }

interface Props {
  targetId: string
}

/**
 * Appears wherever a reply already shows (History, any tab). Two paths
 * into the compose box: type your own, or "Generate with Nexara" which
 * reads the full conversation_thread (not just their latest message) via
 * /generate-followup. Sending goes through /send-followup, which requires
 * a stored chat_id -- if there isn't one yet (older replies captured
 * before this was built), the button explains why instead of failing silently.
 */
export default function FollowupReply({ targetId }: Props) {
  const [state, setState] = useState<ComposeState>({ kind: 'idle' })

  const generate = async () => {
    setState({ kind: 'generating' })
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/discovery-test/generate-followup/${targetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({}),
      })
      const body = await res.json()
      if (!res.ok) {
        setState({ kind: 'error', message: body?.detail ?? 'Failed to generate a draft' })
        return
      }
      setState({ kind: 'editing', text: body.draft })
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Network error' })
    }
  }

  const send = async () => {
    if (state.kind !== 'editing') return
    const message = state.text.trim()
    if (!message) return
    setState({ kind: 'sending' })
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/discovery-test/send-followup/${targetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ message }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setState({ kind: 'error', message: body?.detail ?? 'Failed to send' })
        return
      }
      setState({ kind: 'sent' })
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : 'Network error' })
    }
  }

  if (state.kind === 'sent') {
    return <p className="text-[11px] text-green-600 mt-2">✓ Reply sent</p>
  }

  if (state.kind === 'idle') {
    return (
      <div className="mt-2 pt-2 border-t border-gray-100 flex gap-2" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => setState({ kind: 'editing', text: '' })}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          Reply
        </button>
        <button
          onClick={generate}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-brand text-brand hover:bg-brand-light"
        >
          Generate with Nexara
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5" onClick={e => e.stopPropagation()}>
      {state.kind === 'generating' && <p className="text-[11px] text-gray-500">Reading the conversation so far…</p>}
      {(state.kind === 'editing' || state.kind === 'sending') && (
        <>
          <textarea
            autoFocus
            value={state.kind === 'editing' ? state.text : ''}
            onChange={e => setState({ kind: 'editing', text: e.target.value })}
            disabled={state.kind === 'sending'}
            placeholder="Type your reply, or click Generate with Nexara above"
            rows={3}
            className="input w-full text-xs resize-none disabled:opacity-50"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400">
              {state.kind === 'editing' ? `${state.text.length} chars` : 'Sending…'}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setState({ kind: 'idle' })} disabled={state.kind === 'sending'}
                className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={send} disabled={state.kind === 'sending' || (state.kind === 'editing' && !state.text.trim())}
                className="text-xs px-2.5 py-1 rounded-lg bg-brand text-white hover:opacity-90 disabled:opacity-40">
                Send
              </button>
            </div>
          </div>
        </>
      )}
      {state.kind === 'error' && <p className="text-[11px] text-red-500">⚠ {state.message}</p>}
    </div>
  )
}
'use client'

import { useState, useEffect, useRef } from 'react'
import { messagesApi } from '@/lib/api'
import { formatDayDivider, formatMessageTime, isNewCTDay } from '@/lib/chatTime'
import type { LinkedinMessage, StreamEvent } from '@/types'

interface Props {
  chatId: string | null
  connectionId: string | null
  senderName: string | null
  onMessagesUpdated: (message: LinkedinMessage) => void
}

export default function ChatThread({ chatId, connectionId, senderName, onMessagesUpdated }: Props) {
  const [thread, setThread] = useState<LinkedinMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [headline, setHeadline] = useState<string | null>(null)
  const [enriching, setEnriching] = useState(false)
  const [profileUrl, setProfileUrl] = useState<string | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [composeText, setComposeText] = useState('')
  const [aiBusy, setAiBusy] = useState<'suggest' | 'rewrite' | null>(null)
  const [grounded, setGrounded] = useState<boolean | null>(null)
  const [sending, setSending] = useState(false)
  const [composeError, setComposeError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load history for THIS thread specifically -- chat_id is a real filter
  // on the backend. CRITICAL: never call .list() with neither chatId nor
  // connectionId set -- that becomes GET /messages with NO filter at all,
  // returning every message on the account merged into one view. If a
  // thread genuinely has neither identifier, that's a data problem to
  // surface, not something to silently paper over by showing everything.
  useEffect(() => {
    if (!chatId && !connectionId) {
      setLoadError('This conversation is missing both a chat ID and a connection ID -- cannot load its messages safely.')
      setLoading(false)
      return
    }
    setLoadError(null)
    setLoading(true)
    messagesApi
      .list(chatId ? { chat_id: chatId, limit: 100 } : { connection_id: connectionId!, limit: 100 })
      .then((res) => {
        const sorted = [...res.messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        setThread(sorted)
        const withUrl = sorted.find((m) => m.sender_linkedin_url)
        if (withUrl) setProfileUrl(withUrl.sender_linkedin_url)
        const withHeadline = sorted.find((m) => m.sender_headline)
        if (withHeadline) setHeadline(withHeadline.sender_headline)
      })
      .finally(() => setLoading(false))

    messagesApi.markThreadSeen({ chat_id: chatId ?? undefined, connection_id: connectionId ?? undefined })
      .then((res) => console.log('mark-thread-seen result:', res))
      .catch((e) => console.error('mark-thread-seen FAILED:', e))
  }, [chatId, connectionId])

  // Live updates for this thread -- filters the shared stream.
  useEffect(() => {
    const es = new EventSource(messagesApi.streamUrl())
    es.onmessage = (e) => {
      try {
        const event: StreamEvent = JSON.parse(e.data)
        if (event.type === 'new_message') {
          const belongs = chatId ? event.message.chat_id === chatId : event.message.connection_id === connectionId
          if (belongs) {
            setThread((prev) => [...prev, event.message])
            onMessagesUpdated(event.message)
            messagesApi.markThreadSeen({ chat_id: chatId ?? undefined, connection_id: connectionId ?? undefined })
      .then((res) => console.log('mark-thread-seen result:', res))
      .catch((e) => console.error('mark-thread-seen FAILED:', e))
          }
        } else if (event.type === 'reply_sent' || event.type === 'reply_drafted') {
          const status = (event as { reply_status?: string }).reply_status as LinkedinMessage['reply_status']
          setThread((prev) => prev.map((m) => (m.id === event.message_id ? { ...m, reply_status: status } : m)))
        }
      } catch {
        // ignore malformed events
      }
    }
    return () => es.close()
  }, [chatId, connectionId, onMessagesUpdated])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread.length])

  const loadHeadline = async () => {
    const first = thread[0]
    if (!first) return
    setEnriching(true)
    try {
      // Headline needs a real sender_linkedin_url to look up -- if this
      // thread doesn't have one yet, try resolving it first (searches
      // linkedin_connections / discovered_profiles by provider_id).
      let url = profileUrl
      if (!url) {
        const resolved = await messagesApi.resolveProfileUrl(first.id)
        if (resolved.found) url = resolved.sender_linkedin_url
        setProfileUrl(url)
      }
      if (!url) return   // nothing found anywhere -- can't enrich
      const res = await messagesApi.enrichSender(first.id)
      setHeadline(res.sender_headline)
    } finally {
      setEnriching(false)
    }
  }

  const approve = async (messageId: string) => {
    const updated = await messagesApi.approveReply(messageId)
    setThread((prev) => prev.map((m) => (m.id === messageId ? updated : m)))
    onMessagesUpdated(updated)
  }

  const saveEditedDraft = async (messageId: string, text: string) => {
    const updated = await messagesApi.editDraft(messageId, text)
    setThread((prev) => prev.map((m) => (m.id === messageId ? updated : m)))
    onMessagesUpdated(updated)
  }

  const askNexara = async () => {
    setAiBusy('suggest')
    setComposeError(null)
    try {
      const res = await messagesApi.suggestReply({ chat_id: chatId ?? undefined, connection_id: connectionId ?? undefined })
      setComposeText(res.draft)
      setGrounded(res.grounded_in_fact_sheet)
    } catch (e) {
      setComposeError(e instanceof Error ? e.message : 'Failed to generate a suggestion')
    } finally {
      setAiBusy(null)
    }
  }

  const rewriteWithNexara = async () => {
    if (!composeText.trim()) return
    setAiBusy('rewrite')
    setComposeError(null)
    try {
      const res = await messagesApi.rewriteDraft({ chat_id: chatId ?? undefined, connection_id: connectionId ?? undefined, draft_text: composeText })
      setComposeText(res.draft)
      setGrounded(null)   // rewrite doesn't track this -- clear rather than show a stale value
    } catch (e) {
      setComposeError(e instanceof Error ? e.message : 'Failed to rewrite')
    } finally {
      setAiBusy(null)
    }
  }

  // Covers "custom send" too -- typing here and hitting Send without ever
  // touching Ask Nexara or Rewrite goes through this exact same call.
  const send = async () => {
    if (!composeText.trim() || !chatId) return
    setSending(true)
    setComposeError(null)
    try {
      const sent = await messagesApi.sendToThread({ chat_id: chatId, connection_id: connectionId ?? undefined, message_text: composeText })
      setThread((prev) => [...prev, sent])
      onMessagesUpdated(sent)
      setComposeText('')
      setGrounded(null)
    } catch (e) {
      setComposeError(e instanceof Error ? e.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full p-6 text-center">
        <p className="text-sm text-red-600">{loadError}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          {profileUrl ? (
            <button onClick={() => setShowProfileModal(true)} className="font-medium text-sm text-blue-600 hover:underline">
              {senderName || 'Unknown sender'}
            </button>
          ) : (
            <p className="font-medium text-sm">{senderName || 'Unknown sender'}</p>
          )}
          {headline ? (
            <p className="text-xs text-gray-500">{headline}</p>
          ) : (
            <button onClick={loadHeadline} disabled={enriching || loading} className="text-xs text-blue-600 underline disabled:opacity-50">
              {loading ? '…' : enriching ? 'Loading…' : 'Show profile info'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          thread.map((m, i) => (
            <div key={m.id}>
              {isNewCTDay(m.created_at, thread[i - 1]?.created_at) && (
                <div className="flex items-center justify-center my-3">
                  <span className="text-[11px] text-gray-400 bg-gray-100 rounded-full px-3 py-1">
                    {formatDayDivider(m.created_at)}
                  </span>
                </div>
              )}
              <MessageBubble message={m} onApprove={() => approve(m.id)} onSaveEdit={(text) => saveEditedDraft(m.id, text)} />
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Compose bar -- custom send is just typing here and hitting Send;
          Ask Nexara / Rewrite only ever populate this box, never send
          anything on their own. */}
      <div className="border-t p-3 space-y-2">
        {composeError && <p className="text-xs text-red-600">{composeError}</p>}
        <textarea
          value={composeText}
          onChange={(e) => {
            setComposeText(e.target.value)
            setGrounded(null)   // no longer necessarily true once hand-edited
          }}
          placeholder="Write a message…"
          rows={2}
          className="w-full text-sm border rounded-md p-2"
        />
        {grounded !== null && (
          <p className="text-[11px] text-gray-400">
            {grounded ? '✓ Grounded in this campaign\u2019s fact sheet' : 'Casual reply - no fact sheet involved'}
          </p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={aiBusy !== null || !chatId}
              onClick={askNexara}
              className="px-2.5 py-1.5 text-xs border rounded-md disabled:opacity-50"
            >
              {aiBusy === 'suggest' ? 'Thinking…' : 'Ask Nexara'}
            </button>
            <button
              type="button"
              disabled={aiBusy !== null || !composeText.trim()}
              onClick={rewriteWithNexara}
              className="px-2.5 py-1.5 text-xs border rounded-md disabled:opacity-50"
            >
              {aiBusy === 'rewrite' ? 'Rewriting…' : 'Rewrite with Nexara'}
            </button>
          </div>
          <button
            type="button"
            disabled={sending || !composeText.trim() || !chatId}
            onClick={send}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
        {!chatId && <p className="text-[11px] text-gray-400">No chat started with this connection yet -- sending isn&apos;t available until there&apos;s an active LinkedIn conversation.</p>}
      </div>

      {showProfileModal && profileUrl && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowProfileModal(false)}>
          <div className="bg-white rounded-lg p-5 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-medium text-sm mb-1">{senderName || 'Unknown sender'}</p>
            {headline && <p className="text-xs text-gray-500 mb-4">{headline}</p>}
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center px-3 py-2 text-sm bg-blue-600 text-white rounded-md"
            >
              Open on LinkedIn
            </a>
            <button onClick={() => setShowProfileModal(false)} className="block w-full text-center mt-2 px-3 py-2 text-sm text-gray-500">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message, onApprove, onSaveEdit }: { message: LinkedinMessage; onApprove: () => void; onSaveEdit: (text: string) => Promise<void> }) {
  const isOutbound = message.direction === 'outbound'
  const [editing, setEditing] = useState(false)
  const [draftText, setDraftText] = useState(message.reply_draft ?? '')
  const [saving, setSaving] = useState(false)

  const startEdit = () => {
    setDraftText(message.reply_draft ?? '')
    setEditing(true)
  }

  const save = async () => {
    if (!draftText.trim()) return
    setSaving(true)
    try {
      await onSaveEdit(draftText.trim())
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  // Split into two colors on purpose, where a single amber card used to
  // cover both:
  //   pending_review -- only ever exists when the campaign's
  //     supervised_mode is True (see reply_handler.py's gate in
  //     classify_and_draft_merged_reply) -- a GOOD draft that passed
  //     validation, just waiting on your supervised-mode approval.
  //   held_for_review -- the validator rejected it twice, or it's from
  //     the always-hold "unknown" branch -- a draft that genuinely
  //     needed a second look, independent of supervised_mode.
  // Amber stays the "needs closer attention" signal for held_for_review;
  // violet is Tailwind's closest built-in shade to "lavender" (there is
  // no literal lavender class) for the supervised, already-safe case.
  const isPendingReview = message.reply_status === 'pending_review'
  const isHeldForReview = message.reply_status === 'held_for_review'
  const reviewColors = isHeldForReview
    ? { border: 'border-amber-400', bg: 'bg-amber-50', label: 'text-amber-700', textareaBorder: 'border-amber-300', textareaRing: 'focus:ring-amber-400', editBorder: 'border-amber-300', editText: 'text-amber-700 hover:bg-amber-100' }
    : { border: 'border-violet-400', bg: 'bg-violet-50', label: 'text-violet-700', textareaBorder: 'border-violet-300', textareaRing: 'focus:ring-violet-400', editBorder: 'border-violet-300', editText: 'text-violet-700 hover:bg-violet-100' }

  return (
    <div className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'}`}>
      <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${isOutbound ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
        {message.message_text}
      </div>
      <p className="text-[10px] text-gray-400 mt-0.5 mr-1 ml-1">{formatMessageTime(message.created_at)}</p>
      {/* Only Autopilot gets a tag -- manual and campaign sends show
          nothing, per spec ("if manual nothing like that"). */}
      {isOutbound && message.sent_via === 'autopilot' && (
        <p className="text-[10px] text-gray-400 mt-0.5 mr-1">Autopilot</p>
      )}

      {message.reply_draft && (isPendingReview || isHeldForReview) && (
        <div className={`mt-1 max-w-[70%] rounded-lg border border-dashed ${reviewColors.border} ${reviewColors.bg} px-3 py-2 text-sm`}>
          <p className={`text-xs ${reviewColors.label} mb-1`}>
            {isHeldForReview ? 'Held for review' : 'Draft reply - awaiting approval (supervised)'}
          </p>
          {editing ? (
            <>
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={3}
                className={`w-full rounded border ${reviewColors.textareaBorder} bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 ${reviewColors.textareaRing}`}
                autoFocus
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={save}
                  disabled={saving || !draftText.trim()}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="px-2 py-1 text-xs border border-gray-300 text-gray-600 rounded disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p>{message.reply_draft}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={onApprove} className="px-2 py-1 text-xs bg-blue-600 text-white rounded">
                  Approve &amp; send
                </button>
                <button onClick={startEdit} className={`px-2 py-1 text-xs border ${reviewColors.editBorder} ${reviewColors.editText} rounded`}>
                  Edit
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {message.reply_status === 'autopilot_scheduled' && (
        <p className="mt-1 text-[11px] text-gray-400">Sending automatically shortly…</p>
      )}
    </div>
  )
}
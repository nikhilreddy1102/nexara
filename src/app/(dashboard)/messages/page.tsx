'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { messagesApi } from '@/lib/api'
import { cache } from '@/lib/cache'
import { formatSidebarTimestamp } from '@/lib/chatTime'
import Header from '@/components/layout/Header'
import ChatThread from './ChatThread'
import type { LinkedinMessage, StreamEvent } from '@/types'

const PAGE_SIZE = 60

interface Conversation {
  key: string   // chat_id if present, else connection_id, else message id (stranger, no thread yet)
  chat_id: string | null
  connection_id: string | null
  sender_name: string | null
  last_message: LinkedinMessage
  unread_count: number
  // Split from a single needs_review boolean into two, so the sidebar can
  // show the same violet/amber distinction ChatThread's draft card uses:
  //   pending_review -- supervised campaign, draft already passed
  //     validation, just waiting on approval.
  //   held_for_review -- validator rejected it or it's from the
  //     always-hold "unknown" branch -- needs closer attention,
  //     independent of supervised_mode.
  // held_for_review takes visual precedence if a thread somehow has both
  // (multiple messages in different states) -- it's the more urgent signal.
  pending_review: boolean
  held_for_review: boolean
}

const CACHE_KEY = 'messages:list'

export default function MessagesPage() {
  const searchParams = useSearchParams()
  // Cache-first: if a cached list already exists, render it immediately
  // (no loading flash on repeat visits) and skip the network call
  // entirely. The live SSE subscription below is what keeps it current
  // after that -- not a periodic refetch on every navigation.
  const [messages, setMessages] = useState<LinkedinMessage[]>(() => cache.get<LinkedinMessage[]>(CACHE_KEY) ?? [])
  const [loading, setLoading] = useState(() => cache.get<LinkedinMessage[]>(CACHE_KEY) === null)
  const [activeKey, setActiveKey] = useState<string | null>(null)
  // Infinite scroll over the raw message feed -- conversations below are
  // grouped from whatever's in `messages`, so paging in more raw rows
  // naturally surfaces more (and older) conversations, same idea as
  // Instagram's DM list loading older threads as you scroll down.
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const cursorRef = useRef<string | null>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cached = cache.get<LinkedinMessage[]>(CACHE_KEY)
    if (cached !== null) {
      // Cached list came from a flat limit:200 fetch pre-pagination, or
      // from a prior paginated session -- either way we don't know its
      // cursor, so scrolling further just re-requests page 1 forward
      // from "now," which at worst re-shows a few already-seen rows
      // (deduped by id) rather than losing pagination entirely.
      return
    }
    messagesApi
      .list({ limit: PAGE_SIZE })
      .then((res) => {
        setMessages(res.messages)
        setHasMore(res.has_more)
        cursorRef.current = res.next_before
        // Long TTL -- the SSE subscription below keeps this fresh in
        // real time, so this isn't "trust a 30-second-old snapshot," it's
        // "don't refetch on navigation when we're already being told
        // about every change as it happens."
        cache.set(CACHE_KEY, res.messages, 600)
      })
      .finally(() => setLoading(false))
  }, [])

  const loadMoreConversations = useCallback(() => {
    if (loadingMore || !hasMore || !cursorRef.current) return
    setLoadingMore(true)
    messagesApi
      .list({ limit: PAGE_SIZE, before: cursorRef.current })
      .then((res) => {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id))
          const merged = [...prev, ...res.messages.filter((m) => !seen.has(m.id))]
          cache.set(CACHE_KEY, merged, 600)
          return merged
        })
        setHasMore(res.has_more)
        cursorRef.current = res.next_before
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }, [loadingMore, hasMore])

  const handleSidebarScroll = useCallback(() => {
    const el = sidebarRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
      loadMoreConversations()
    }
  }, [loadMoreConversations])

  // Live updates -- new messages, sends, thread-clears all land here so
  // the list (unread counts, last-message previews, new conversations
  // entirely) stays current without ever needing a manual refetch.
  useEffect(() => {
    const es = new EventSource(messagesApi.streamUrl())
    es.onmessage = (e) => {
      try {
        const event: StreamEvent = JSON.parse(e.data)
        if (event.type === 'new_message') {
          setMessages((prev) => {
            const next = [...prev, event.message]
            cache.set(CACHE_KEY, next, 600)
            return next
          })
        } else if (event.type === 'message_sent') {
          // Sent via the compose bar or approve-reply elsewhere -- the
          // full row arrives through 'new_message' too in most paths,
          // this covers the connection-outreach send endpoint's own event.
        } else if (event.type === 'thread_seen' || event.type === 'message_seen') {
          setMessages((prev) => {
            const next = prev.map((m) => {
              if (event.type === 'message_seen' && m.id === event.message_id) return { ...m, seen_at: new Date().toISOString() }
              if (event.type === 'thread_seen') {
                const matchesChat = event.chat_id && m.chat_id === event.chat_id
                const matchesConn = event.connection_id && m.connection_id === event.connection_id
                if (matchesChat || matchesConn) return { ...m, seen_at: m.seen_at ?? new Date().toISOString() }
              }
              return m
            })
            cache.set(CACHE_KEY, next, 600)
            return next
          })
        }
      } catch {
        // ignore malformed events
      }
    }
    return () => es.close()
  }, [])

  // Deep-link from AlertsPanel: ?chat_id=... or ?connection_id=...
  useEffect(() => {
    const chatId = searchParams.get('chat_id')
    const connectionId = searchParams.get('connection_id')
    if (chatId || connectionId) {
      setActiveKey(chatId || connectionId)
    }
  }, [searchParams])

  // Group the flat message list into conversations -- one row per chat_id
  // (falling back to connection_id, then message id for a stranger with
  // no thread established yet), newest message first.
  const conversations = useMemo<Conversation[]>(() => {
    const map = new Map<string, Conversation>()
    // CRITICAL: the backend returns messages newest-first
    // (get_linkedin_messages orders by created_at desc). The carry-forward
    // logic below only works walking oldest-to-newest -- otherwise the
    // very first message seen for a conversation IS already the newest
    // one, so there's nothing yet to carry a name forward FROM, and an
    // outbound reply with no sender_name (which is normal -- it's your
    // own message) permanently wins with "Unknown" even though an earlier
    // inbound message in the same thread has the real name sitting right
    // there. Sorting ascending here is what makes the carry-forward
    // actually reachable.
    const sorted = [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    for (const m of sorted) {
      const key = m.chat_id || m.connection_id || m.id
      const existing = map.get(key)
      if (!existing || new Date(m.created_at) > new Date(existing.last_message.created_at)) {
        map.set(key, {
          key,
          chat_id: m.chat_id,
          connection_id: m.connection_id,
          // Never overwrite a known name with an empty one -- outbound
          // messages (your own replies) never carry sender_name, since
          // that field means "who's messaging you," not "who you're
          // messaging." If the latest message in the thread is your own
          // reply, keep whatever name an earlier inbound message already
          // established instead of falling back to "Unknown."
          sender_name: m.sender_name || existing?.sender_name || null,
          last_message: m,
          unread_count: existing?.unread_count ?? 0,
          pending_review: existing?.pending_review ?? false,
          held_for_review: existing?.held_for_review ?? false,
        })
      }
    }
    for (const m of messages) {
      if (m.direction === 'inbound' && !m.seen_at) {
        const key = m.chat_id || m.connection_id || m.id
        const conv = map.get(key)
        if (conv) conv.unread_count += 1
      }
      // Same violet/amber split as ChatThread's draft card -- a thread
      // with ANY message in either state gets flagged here too, so it's
      // visible before you even open the conversation. held_for_review
      // wins if a thread somehow has both (more urgent signal).
      if (m.reply_status === 'held_for_review') {
        const key = m.chat_id || m.connection_id || m.id
        const conv = map.get(key)
        if (conv) conv.held_for_review = true
      } else if (m.reply_status === 'pending_review') {
        const key = m.chat_id || m.connection_id || m.id
        const conv = map.get(key)
        if (conv) conv.pending_review = true
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime()
    )
  }, [messages])

  const active = conversations.find((c) => c.key === activeKey) || null

  return (
    <div className="flex flex-col h-screen">
      <Header title="Messages" />
      <div className="flex flex-1 min-h-0">
        <div ref={sidebarRef} onScroll={handleSidebarScroll} className="w-80 border-r overflow-y-auto flex-shrink-0">
          {loading ? (
            <p className="p-4 text-sm text-gray-400">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">No messages yet.</p>
          ) : (
            <>
              {conversations.map((c) => {
                const reviewBorder = c.held_for_review
                  ? 'border-l-amber-400 bg-amber-50'
                  : c.pending_review
                  ? 'border-l-violet-400 bg-violet-50'
                  : 'border-l-transparent'
                return (
                  <button
                    key={c.key}
                    onClick={() => setActiveKey(c.key)}
                    className={`w-full text-left p-3 border-b hover:bg-gray-50 border-l-4 ${reviewBorder} ${
                      activeKey === c.key ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{c.sender_name || 'Unknown'}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[11px] text-gray-400">{formatSidebarTimestamp(c.last_message.created_at)}</span>
                        {c.held_for_review && (
                          <span className="px-1.5 h-[18px] rounded-full bg-amber-100 text-amber-700 text-[10px] flex items-center justify-center font-medium">
                            Review
                          </span>
                        )}
                        {!c.held_for_review && c.pending_review && (
                          <span className="px-1.5 h-[18px] rounded-full bg-violet-100 text-violet-700 text-[10px] flex items-center justify-center font-medium">
                            Awaiting approval
                          </span>
                        )}
                        {c.unread_count > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{c.last_message.message_text}</p>
                  </button>
                )
              })}
              {loadingMore && <p className="p-3 text-center text-xs text-gray-400">Loading more…</p>}
              {!hasMore && <p className="p-3 text-center text-xs text-gray-300">No more conversations.</p>}
            </>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {active ? (
            <ChatThread
              key={active.key}
              chatId={active.chat_id}
              connectionId={active.connection_id}
              senderName={active.sender_name}
              onMessagesUpdated={(updated) => {
                // ChatThread pushes fresh state back up so the left-hand
                // list's unread counts and last-message previews stay in
                // sync without a second full refetch.
                setMessages((prev) => {
                  const others = prev.filter((m) => m.id !== updated.id)
                  const next = [...others, updated]
                  cache.set(CACHE_KEY, next, 600)
                  return next
                })
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
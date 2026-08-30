'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { messagesApi } from '@/lib/api'
import type { LinkedinMessage, StreamEvent } from '@/types'

interface MessagesAlertsContextType {
  unseen: LinkedinMessage[]
  // Real COUNT(*) from the backend -- NOT unseen.length. This is what the
  // sidebar/bell badge should render, since `unseen` is only whatever page
  // the dropdown has loaded so far.
  unseenCount: number
  streamConnected: boolean
  hasMore: boolean
  loadingMore: boolean
  loadMore: () => void
}

const MessagesAlertsContext = createContext<MessagesAlertsContextType>({
  unseen: [],
  unseenCount: 0,
  streamConnected: false,
  hasMore: false,
  loadingMore: false,
  loadMore: () => {},
})

const PAGE_SIZE = 30

// Same shape as InMailContext (createContext/Provider/hook), same file
// already existing in this codebase. This is the ONE SSE connection for
// the whole app -- Sidebar's badge count and AlertsPanel's dropdown both
// read from here instead of each opening their own EventSource.
export function MessagesAlertsProvider({ children }: { children: ReactNode }) {
  const [unseen, setUnseen] = useState<LinkedinMessage[]>([])
  const [unseenCount, setUnseenCount] = useState(0)
  const [streamConnected, setStreamConnected] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const cursorRef = useRef<string | null>(null)
  const esRef = useRef<EventSource | null>(null)

  // Re-fetches page 1 and MERGES it in rather than replacing the whole
  // array -- if the user has scrolled the dropdown past page 1 via
  // loadMore, a periodic resync must not truncate what they've already
  // loaded back down to PAGE_SIZE. Cursor/hasMore only get reset on the
  // very first call (mount), when there's nothing loaded yet to clobber.
  const loadSnapshot = useCallback(() => {
    messagesApi
      .alerts({ limit: PAGE_SIZE })
      .then((res) => {
        setUnseenCount(res.total_unseen)
        setUnseen((prev) => {
          if (prev.length === 0) {
            cursorRef.current = res.next_before
            setHasMore(res.has_more)
            return res.unseen
          }
          const freshIds = new Set(res.unseen.map((m) => m.id))
          const rest = prev.filter((m) => !freshIds.has(m.id))
          return [...res.unseen, ...rest]
        })
      })
      .catch(() => {})
  }, [])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || !cursorRef.current) return
    setLoadingMore(true)
    messagesApi
      .alerts({ limit: PAGE_SIZE, before: cursorRef.current })
      .then((res) => {
        setUnseen((prev) => [...prev, ...res.unseen])
        setHasMore(res.has_more)
        cursorRef.current = res.next_before
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }, [loadingMore, hasMore])

  useEffect(() => {
    loadSnapshot()

    const es = new EventSource(messagesApi.streamUrl())
    esRef.current = es
    es.onopen = () => setStreamConnected(true)
    es.onerror = () => setStreamConnected(false)

    es.onmessage = (e) => {
      try {
        const event: StreamEvent = JSON.parse(e.data)
        if (event.type === 'new_message') {
          // Only prepend into the loaded page list if it's actually an
          // unseen inbound message -- the stream also carries outbound
          // sends. Count goes up regardless of what's loaded on screen.
          if (event.message.direction === 'inbound' && !event.message.seen_at) {
            setUnseen((prev) => [event.message, ...prev])
            setUnseenCount((prev) => prev + 1)
          }
        } else if (event.type === 'message_seen') {
          setUnseen((prev) => {
            const existed = prev.some((m) => m.id === event.message_id)
            if (existed) setUnseenCount((c) => Math.max(0, c - 1))
            return prev.filter((m) => m.id !== event.message_id)
          })
        } else if (event.type === 'thread_seen') {
          setUnseen((prev) => {
            const cleared = prev.filter((m) => {
              if (event.chat_id && m.chat_id === event.chat_id) return true
              if (event.connection_id && m.connection_id === event.connection_id) return true
              return false
            }).length
            if (cleared > 0) setUnseenCount((c) => Math.max(0, c - cleared))
            return prev.filter((m) => {
              if (event.chat_id && m.chat_id === event.chat_id) return false
              if (event.connection_id && m.connection_id === event.connection_id) return false
              return true
            })
          })
        }
      } catch {
        // malformed event -- ignore
      }
    }

    // No replay buffer on the stream -- re-snapshot periodically to catch
    // anything missed during a disconnect gap, same reasoning as before.
    // This only refreshes page 1 + the total count; it won't disturb
    // pages already loaded further down via loadMore.
    const interval = setInterval(() => {
      // Runs regardless of readyState -- gating this on OPEN made it a
      // no-op exactly when it's needed most. The point of this fallback
      // IS to catch anything missed during a disconnect; skipping it
      // while disconnected defeats its entire purpose.
      loadSnapshot()
    }, 5000)

    return () => {
      es.close()
      clearInterval(interval)
    }
  }, [loadSnapshot])

  return (
    <MessagesAlertsContext.Provider value={{ unseen, unseenCount, streamConnected, hasMore, loadingMore, loadMore }}>
      {children}
    </MessagesAlertsContext.Provider>
  )
}

export function useMessagesAlerts() {
  return useContext(MessagesAlertsContext)
}
'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useMessagesAlerts } from '@/context/MessagesAlertsContext'
import type { LinkedinMessage } from '@/types'

// No longer owns an EventSource -- reads from MessagesAlertsProvider,
// same shared connection Sidebar's badge count reads from. Wrap the app
// with <MessagesAlertsProvider> once, same place InMailProvider is
// already wrapped.
export default function AlertsPanel() {
  const router = useRouter()
  const { unseen, unseenCount, streamConnected, hasMore, loadingMore, loadMore } = useMessagesAlerts()
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Instagram-style: fire the next page fetch once the scroll position
  // gets within ~120px of the bottom, instead of waiting for the user to
  // hit the literal end (which feels laggy) or paginating with buttons.
  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el || loadingMore || !hasMore) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      loadMore()
    }
  }, [loadingMore, hasMore, loadMore])

  const openThread = (message: LinkedinMessage) => {
    setOpen(false)
    const params = new URLSearchParams()
    if (message.chat_id) params.set('chat_id', message.chat_id)
    else if (message.connection_id) params.set('connection_id', message.connection_id)
    router.push(`/messages?${params.toString()}`)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md hover:bg-gray-100"
        title={streamConnected ? 'Live' : 'Reconnecting…'}
      >
        <BellIcon />
        {unseenCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center">
            {unseenCount > 99 ? '99+' : unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div ref={listRef} onScroll={handleScroll} className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white border rounded-md shadow-lg z-50">
          {unseenCount > 0 && (
            <div className="sticky top-0 px-3 py-1.5 bg-gray-50 border-b text-[11px] text-gray-500">
              {unseenCount} unseen
            </div>
          )}
          {unseen.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">No new messages.</p>
          ) : (
            <>
              {unseen.map((m) => (
                <button key={m.id} onClick={() => openThread(m)} className="w-full text-left p-3 border-b hover:bg-gray-50 text-sm">
                  <p className="font-medium truncate">{m.sender_name || 'Unknown sender'}</p>
                  <p className="text-gray-500 truncate">{m.message_text}</p>
                </button>
              ))}
              {loadingMore && <p className="p-3 text-center text-xs text-gray-400">Loading more…</p>}
              {!hasMore && unseen.length > 0 && (
                <p className="p-3 text-center text-xs text-gray-300">You&apos;re all caught up.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
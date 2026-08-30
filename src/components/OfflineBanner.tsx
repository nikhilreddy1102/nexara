'use client'

import { useState, useEffect } from 'react'

// Mounted in the root layout so it covers both a visitor landing on the
// marketing page with no signal and a logged-in user losing connectivity
// mid-session (e.g. partway through building or running a campaign).
// navigator.onLine is a lower bound -- it can read true on a captive
// portal with no real route out -- but it's the only signal that fires
// instantly on airplane mode / wifi drop, and api.ts's ApiError('network_error')
// path handles the "onLine says yes but requests still fail" case per-request.
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    setOffline(!navigator.onLine)
    const goOffline = () => setOffline(true)
    const goOnline = () => setOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      className="fixed top-0 inset-x-0 z-[100] bg-amber-500 text-white text-xs font-medium text-center py-2 px-4"
    >
      You&apos;re offline - check your connection. Anything in progress won&apos;t save until you&apos;re back online.
    </div>
  )
}

// REPO: nexara-frontend
// PATH: src/components/GrowthPromoBanner.tsx
'use client'

import { useState, useEffect } from 'react'

const DISMISS_KEY = 'nexara_dismissed_growth_promo'
const OFFER_DEADLINE = new Date('2026-08-31T23:59:59')

// Dismissible for the session, and self-expiring -- once OFFER_DEADLINE
// passes this renders nothing at all, so there's no risk of it
// lingering on the dashboard advertising an offer that's already over.
export default function GrowthPromoBanner() {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY)) setDismissed(true)
  }, [])

  if (dismissed || new Date() > OFFER_DEADLINE) return null

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
          </svg>
        </div>
        <p className="text-sm text-blue-900">
          Get the <b>Growth plan free for a month</b> - to claim the
          promotion, just email us at{' '}
          <a href="mailto:support@nikarva.com" className="underline font-semibold">
            support@nikarva.com
          </a>
        </p>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="flex-shrink-0 text-blue-400 hover:text-blue-600 text-sm px-1"
      >
        &times;
      </button>
    </div>
  )
}
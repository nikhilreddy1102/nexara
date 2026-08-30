// REPO: nexara-frontend
// PATH: src/components/CreatePasswordBanner.tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { authApi } from '@/lib/api'
import type { User } from '@/types'

const DISMISS_KEY = 'nexara_dismissed_create_password_banner'

// Shown below the header, only for accounts with no password set yet
// (career-plan accounts, before they've completed create-password).
// Dismissible for the session -- reappears on next real login, doesn't
// nag every page load once someone's closed it once.
export default function CreatePasswordBanner() {
  const [needsPassword, setNeedsPassword] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY)) {
      setDismissed(true)
      return
    }
    authApi.me()
      .then((data: User) => setNeedsPassword(data?.has_password_set === false))
      .catch(() => {})
  }, [])

  if (!needsPassword || dismissed) return null

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '10px 16px', marginBottom: 16, borderRadius: 10,
        background: '#fffbeb', border: '1px solid #fde68a',
      }}
    >
      <span style={{ fontSize: 13, color: '#92400e' }}>
        Create a password for smoother sign-in next time.
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <Link href="/account" style={{ fontSize: 13, fontWeight: 600, color: '#92400e', textDecoration: 'underline' }}>
          Set up now
        </Link>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b45309', fontSize: 13, padding: 0 }}
        >
          &times;
        </button>
      </div>
    </div>
  )
}
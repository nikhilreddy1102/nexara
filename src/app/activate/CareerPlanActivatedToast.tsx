// REPO: nexara-frontend
// PATH: src/components/CareerPlanActivatedToast.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'

// Drop <CareerPlanActivatedToast /> anywhere in dashboard/page.tsx --
// it renders nothing unless ?welcome=career_plan is on the URL, and
// strips that param immediately so refreshing the page doesn't show it
// again. Self-contained: no props needed.
export default function CareerPlanActivatedToast() {
  const router = useRouter()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('welcome') !== 'career_plan') return

    setVisible(true)

    // Strip the param so a later refresh of this same URL doesn't
    // re-show the toast -- this was a one-time arrival event, not
    // persistent page state.
    params.delete('welcome')
    const cleanUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '')
    router.replace(cleanUrl)

    const timer = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed', top: 20, right: 20, zIndex: 2000,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px', borderRadius: 10,
        background: '#ecfdf5', border: '1px solid #a7f3d0',
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
      }}
    >
      <Check size={16} color="#059669" />
      <span style={{ fontSize: 13, fontWeight: 600, color: '#065f46' }}>
        Career plan activated
      </span>
    </div>
  )
}
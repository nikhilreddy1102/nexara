// REPO: nexara-frontend
// PATH: src/components/OnboardingTour.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { authApi, accountApi } from '@/lib/api'

interface Step {
  target: string | null
  title: string
  body: string
}

const STEPS: Step[] = [
  { target: null,
    title: 'Welcome to Nexara 👋',
    body: "Let's take a 60-second look around before you get started." },
  { target: '#tour-group-main',
    title: 'Your outreach lives here',
    body: 'Campaigns, Targets, People Finder, and My Connections - find people, run outreach, and sync your LinkedIn connections from here to unlock campaigns.' },
  { target: '#tour-group-tools',
    title: 'Tools for managing it all',
    body: 'Templates for your message drafts, InMail queue and Messages for the conversations, History and Analytics to see what\u2019s working.' },
  { target: '#tour-account-link',
    title: 'Manage your account',
    body: 'Create or change your password here anytime, whenever you\u2019re ready - works the same no matter how you signed up.' },
  { target: '#tour-settings-link',
    title: 'Connect LinkedIn',
    body: 'Connect your LinkedIn account and check your usage limits here. Sync your connections from My Connections once it\u2019s linked.' },
  { target: '#tour-upgrade-btn',
    title: 'Upgrade anytime',
    body: 'See what each plan includes and upgrade whenever you\u2019re ready to scale up your outreach.' },
  { target: null,
    title: "You're all set",
    body: 'That\u2019s the whole tour. Connect LinkedIn whenever you\u2019re ready and your first campaign is a couple clicks away.' },
]

const CARD_W = 280
const CARD_H_EST = 200
const GAP = 14
// Matches (dashboard)/layout.tsx's `duration-250` transition on the
// mobile drawer -- must wait this long after toggling it before
// measuring anything, or the rect is grabbed mid-slide.
const DRAWER_TRANSITION_MS = 280

// Sidebar is rendered TWICE by layout.tsx -- once for desktop (always
// visible, hidden md:flex) and once for the mobile drawer (fixed,
// md:hidden, slides via translate-x). Both copies carry the same ids,
// which is technically invalid duplicate HTML -- fixing that properly
// means passing a per-instance id suffix into Sidebar itself, not done
// here. This works around it functionally: check every element with
// the id, use whichever one actually has real size on screen right now.
function findVisibleTarget(selector: string): HTMLElement | null {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector))
  for (const el of candidates) {
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) return el
  }
  return null
}

interface OnboardingTourProps {
  // Wired to (dashboard)/layout.tsx's own sidebarOpen state, so the
  // tour can actually open/close the real mobile drawer instead of
  // guessing at a toggle mechanism. Omit these and the tour still
  // works on desktop; on mobile it'll just skip sidebar steps whose
  // target isn't currently visible, since it can't open the drawer
  // without them.
  mobileSidebarOpen?: boolean
  onSetMobileSidebarOpen?: (open: boolean) => void
}

export default function OnboardingTour({ onSetMobileSidebarOpen }: OnboardingTourProps) {
  const [checked, setChecked] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [tourActive, setTourActive] = useState(false)
  const [current, setCurrent] = useState(0)
  const [spotlight, setSpotlight] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const [cardPos, setCardPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // "Take a tour" launcher button -- draggable, default position next to
  // the header's notification bell. Drag position is plain component
  // state, not localStorage/sessionStorage, so a refresh resets it back
  // to that default corner.
  const [buttonPos, setButtonPos] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dragRef = useRef<{ dragging: boolean; moved: boolean; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null)

  const handleButtonPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const el = buttonRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragRef.current = {
      dragging: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    }
    el.setPointerCapture(e.pointerId)
  }

  const handleButtonPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    const el = buttonRef.current
    if (!drag?.dragging || !el) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (!drag.moved && Math.hypot(dx, dy) < 4) return
    drag.moved = true
    const w = el.offsetWidth, h = el.offsetHeight
    const left = Math.max(8, Math.min(e.clientX - drag.offsetX, window.innerWidth - w - 8))
    const top = Math.max(8, Math.min(e.clientY - drag.offsetY, window.innerHeight - h - 8))
    setButtonPos({ top, left })
  }

  const handleButtonPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    buttonRef.current?.releasePointerCapture(e.pointerId)
    if (dragRef.current) dragRef.current.dragging = false
  }

  // Native click still fires after a drag's pointerup -- swallow it here
  // instead of double-triggering startTour() on every plain click.
  const handleButtonClick = () => {
    if (dragRef.current?.moved) { dragRef.current.moved = false; return }
    startTour()
  }

  useEffect(() => {
    authApi.me()
      .then(data => {
        if (data?.has_seen_tour === false) {
          promptTimerRef.current = setTimeout(() => setShowPrompt(true), 2000)
        }
      })
      .catch(() => {})
      .finally(() => setChecked(true))
    return () => { if (promptTimerRef.current) clearTimeout(promptTimerRef.current) }
  }, [])

  const markSeen = useCallback(() => {
    accountApi.markTourSeen().catch(() => {})
  }, [])

  const placeTooltip = useCallback((rect: DOMRect | null) => {
    const vw = window.innerWidth, vh = window.innerHeight
    const cardW = Math.min(CARD_W, vw - 32)

    if (!rect) {
      setCardPos({ top: vh / 2 - CARD_H_EST / 2, left: vw / 2 - cardW / 2 })
      return
    }
    let top = rect.bottom + GAP
    if (top + CARD_H_EST > vh) top = Math.max(GAP, rect.top - CARD_H_EST - GAP)
    let left = rect.left + rect.width / 2 - cardW / 2
    left = Math.max(GAP, Math.min(left, vw - cardW - GAP))
    setCardPos({ top, left })
  }, [])

  const locateAndShow = useCallback((step: Step) => {
    if (!step.target) {
      setSpotlight(null)
      placeTooltip(null)
      return
    }
    const el = findVisibleTarget(step.target)
    if (!el) {
      // Even after trying to open the drawer, nothing visible was
      // found -- rather than show a spotlight pointing at nothing,
      // just drop the spotlight and center the card. Doesn't happen
      // in the normal desktop/mobile-drawer cases above; this is the
      // genuine last-resort fallback.
      setSpotlight(null)
      placeTooltip(null)
      return
    }
    const rect = el.getBoundingClientRect()
    setSpotlight({ top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16 })
    placeTooltip(rect)
  }, [placeTooltip])

  const showStep = useCallback((index: number) => {
    const step = STEPS[index]

    if (!step.target) {
      onSetMobileSidebarOpen?.(false)
      locateAndShow(step)
      return
    }

    // Every real target in this tour lives inside the sidebar. Try
    // opening the mobile drawer (harmless no-op on desktop, where the
    // always-visible copy already satisfies findVisibleTarget on its
    // own) and wait for the slide transition before measuring.
    onSetMobileSidebarOpen?.(true)
    setTimeout(() => locateAndShow(step), DRAWER_TRANSITION_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locateAndShow, onSetMobileSidebarOpen])

  const startTour = () => {
    setShowPrompt(false)
    markSeen()
    setCurrent(0)
    setTourActive(true)
    showStep(0)
  }
  const dismissPrompt = () => {
    setShowPrompt(false)
    markSeen()
  }
  const endTour = () => {
    setTourActive(false)
    setSpotlight(null)
    onSetMobileSidebarOpen?.(false)
  }
  const nextStep = () => {
    if (current < STEPS.length - 1) { const n = current + 1; setCurrent(n); showStep(n) }
    else endTour()
  }
  const prevStep = () => {
    if (current > 0) { const p = current - 1; setCurrent(p); showStep(p) }
  }

  useEffect(() => {
    if (!tourActive) return
    const onResize = () => showStep(current)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [tourActive, current, showStep])

  if (!checked) return null

  return (
    <>
      {showPrompt && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl p-4 w-64 z-[850]">
          <p className="text-sm font-semibold mb-3">Take a quick tour of Nexara?</p>
          <div className="flex gap-2">
            <button onClick={dismissPrompt} className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-semibold">
              Not now
            </button>
            <button onClick={startTour} className="flex-1 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold">
              Start
            </button>
          </div>
        </div>
      )}

      {!showPrompt && !tourActive && (
        <button
          ref={buttonRef}
          onClick={handleButtonClick}
          onPointerDown={handleButtonPointerDown}
          onPointerMove={handleButtonPointerMove}
          onPointerUp={handleButtonPointerUp}
          style={{ touchAction: 'none', ...(buttonPos ? { top: buttonPos.top, left: buttonPos.left } : { top: 12, right: 72 }) }}
          className="fixed z-[850] flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-brand text-white text-xs font-semibold shadow-lg hover:opacity-90 transition-opacity cursor-grab active:cursor-grabbing select-none"
        >
          🔔 Take a tour
        </button>
      )}

      {tourActive && (
        <div className="fixed inset-0 z-[900]">
          <div
            className="fixed rounded-xl border-2 border-brand pointer-events-none transition-all duration-300"
            style={
              spotlight
                ? { top: spotlight.top, left: spotlight.left, width: spotlight.width, height: spotlight.height, boxShadow: '0 0 0 9999px rgba(11,18,32,0.6)' }
                : { top: 0, left: 0, width: 0, height: 0, boxShadow: '0 0 0 9999px rgba(11,18,32,0.6)' }
            }
          />
          <div
            className="fixed bg-white/85 backdrop-blur-md border border-white/50 rounded-2xl shadow-2xl p-5 transition-all duration-300"
            style={{ top: cardPos.top, left: cardPos.left, width: Math.min(CARD_W, typeof window !== 'undefined' ? window.innerWidth - 32 : CARD_W) }}
          >
            <button onClick={endTour} className="absolute top-3.5 right-4 text-[11px] font-semibold text-gray-400 underline">
              End tour
            </button>
            <p className="text-[10px] font-bold uppercase tracking-wide text-brand mb-1.5">
              Step {current + 1} of {STEPS.length}
            </p>
            <p className="text-[15px] font-bold mb-1.5">{STEPS[current].title}</p>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">{STEPS[current].body}</p>
            <div className="flex items-center justify-between">
              <button onClick={prevStep} className={`text-xs text-gray-500 ${current === 0 ? 'invisible' : ''}`}>
                Back
              </button>
              <button onClick={nextStep} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold">
                {current === STEPS.length - 1 ? 'Got it' : 'Next'}
              </button>
            </div>
            <div className="flex gap-1 justify-center mt-3">
              {STEPS.map((_, i) => (
                <span key={i} className={`w-1.5 h-1.5 rounded-full ${i <= current ? 'bg-brand' : 'bg-gray-200'}`} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
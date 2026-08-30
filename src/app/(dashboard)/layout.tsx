'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { InMailProvider } from '@/context/InMailContext'
import { MessagesAlertsProvider } from '@/context/MessagesAlertsContext'
import Sidebar from '@/components/layout/Sidebar'
import OnboardingTour from '@/components/OnboardingTour'
import PublicFooter from '@/components/layout/PublicFooter'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hasToken, setHasToken] = useState(false)
  const [showReactivated, setShowReactivated] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setHasToken(!!localStorage.getItem('nexara_token'))
  }, [])

  // One-shot: set by AuthContext's applySession only on the signin call
  // that just restored a soft-deleted account. Cleared immediately so it
  // never reappears on a later navigation within the same session.
  useEffect(() => {
    if (sessionStorage.getItem('nexara_reactivated')) {
      setShowReactivated(true)
      sessionStorage.removeItem('nexara_reactivated')
    }
  }, [])

  useEffect(() => { setSidebarOpen(false) }, [pathname])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') setSidebarOpen(false) }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  useEffect(() => {
    if (!loading && !user) {
      const token = localStorage.getItem('nexara_token')
      if (!token) router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (sidebarOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  const LoadingScreen = () => (
    <div className="min-h-screen flex items-center justify-center bg-page">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center animate-pulse">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </div>
        <p className="text-sm text-gray-400">Loading Nexara...</p>
        <p className="text-xs text-gray-300 mt-1">
          Taking too long?{' '}
          <button
            onClick={() => window.location.reload()}
            className="text-brand underline hover:text-brand-darker"
          >
            Click here to refresh
          </button>
        </p>
      </div>
    </div>
  )

  if (loading) return <LoadingScreen />
  if (!user && hasToken) return <LoadingScreen />
  if (!user) return null

  return (
    <InMailProvider>
      <MessagesAlertsProvider>
        <div className="flex h-screen bg-page overflow-hidden">

          <div className="hidden md:flex flex-shrink-0">
            <Sidebar />
          </div>

          {sidebarOpen && (
            <div
              ref={overlayRef}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <div className={`
            fixed inset-y-0 left-0 z-50 md:hidden
            transform transition-transform duration-250 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}>
            <Sidebar />
          </div>

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                aria-label="Open menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-brand flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-900">Nexara</span>
              </div>
            </div>

            <main className="flex-1 overflow-y-auto flex flex-col">
              {showReactivated && (
                <div className="flex items-center justify-between gap-3 bg-brand-light border-b border-brand/20 px-4 py-2.5 flex-shrink-0">
                  <p className="text-sm text-brand-dark">Welcome back - your account has been restored.</p>
                  <button
                    onClick={() => setShowReactivated(false)}
                    className="text-brand-dark/60 hover:text-brand-dark text-lg leading-none flex-shrink-0"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </div>
              )}
              <div className="flex-1">{children}</div>
              <PublicFooter />
            </main>
          </div>

          <OnboardingTour mobileSidebarOpen={sidebarOpen} onSetMobileSidebarOpen={setSidebarOpen} />
        </div>
      </MessagesAlertsProvider>
    </InMailProvider>
  )
}
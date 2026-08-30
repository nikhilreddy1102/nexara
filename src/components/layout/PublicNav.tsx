'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

// Shared header for the public marketing pages (landing, pricing, insights).
// Pricing and Insights previously each had their own inline nav with just a
// logo and a single button -- missing the Our Plans/Insights cross-links and
// Sign in entirely. This is the one nav all three render now, so they can't
// drift apart again.
export default function PublicNav() {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const loggedIn = !loading && !!user

  const closeMenu = () => setMenuOpen(false)

  const isActive = (href: string) => pathname === href
  const navLinkCls = (href: string) =>
    `text-xs font-medium transition-colors ${isActive(href) ? 'text-brand font-semibold' : 'text-gray-600 hover:text-gray-900'}`
  const mobileNavLinkCls = (href: string) =>
    `text-sm font-medium ${isActive(href) ? 'text-brand font-semibold' : 'text-gray-700'}`

  return (
    <nav className="relative flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
      <Link href="/" className="flex items-center gap-2.5">
        <Image src="/nexara-icon-64.png" alt="Nexara" width={32} height={32} className="rounded-lg" />
        <div>
          <p className="text-sm font-medium text-gray-900 leading-tight">Nexara</p>
          <p className="text-[9px] text-gray-400 leading-tight hidden md:block">Powered by Nikarva</p>
        </div>
      </Link>

      <div className="hidden md:flex items-center gap-7 absolute left-1/2 -translate-x-1/2">
        <Link href="/pricing" className={navLinkCls('/pricing')}>
          Our Plans
        </Link>
        <Link href="/insights" className={navLinkCls('/insights')}>
          Insights
        </Link>
      </div>

      <div className="hidden md:flex items-center gap-3">
        {loggedIn ? (
          <Link href="/dashboard" className="text-xs bg-sidebar text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity font-medium">
            Back to dashboard
          </Link>
        ) : (
          <>
            <Link href="/login" className="text-xs text-gray-600 hover:text-gray-900 transition-colors">Sign in</Link>
            <Link href="/signup" className="text-xs bg-sidebar text-white px-4 py-2 rounded-lg hover:opacity-90 transition-opacity font-medium">
              Get started free
            </Link>
          </>
        )}
      </div>

      {/* Our Plans/Insights/Sign in were unreachable on mobile before this --
          the links above are md:flex-only with no fallback, so a phone
          visitor had no way to get to Pricing or Insights from the nav. */}
      <button
        onClick={() => setMenuOpen(v => !v)}
        className="md:hidden p-2 -mr-2 text-gray-600"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
      >
        {menuOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {menuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-100 shadow-lg flex flex-col px-6 py-4 gap-4 z-50">
          <Link href="/pricing" onClick={closeMenu} className={mobileNavLinkCls('/pricing')}>Our Plans</Link>
          <Link href="/insights" onClick={closeMenu} className={mobileNavLinkCls('/insights')}>Insights</Link>
          <div className="border-t border-gray-100 pt-4 flex flex-col gap-3">
            {loggedIn ? (
              <Link href="/dashboard" onClick={closeMenu} className="text-sm bg-sidebar text-white px-4 py-2.5 rounded-lg text-center font-medium">
                Back to dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" onClick={closeMenu} className="text-sm text-gray-600 text-center">Sign in</Link>
                <Link href="/signup" onClick={closeMenu} className="text-sm bg-sidebar text-white px-4 py-2.5 rounded-lg text-center font-medium">
                  Get started free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

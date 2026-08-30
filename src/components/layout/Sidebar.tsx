'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useInMail } from '@/context/InMailContext'
import { useMessagesAlerts } from '@/context/MessagesAlertsContext'

const navMain = [
  { href: '/dashboard', label: 'Dashboard', d: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/campaigns', label: 'Campaigns', d: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },
  { href: '/targets', label: 'Targets', d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: '/people-finder', label: 'People Finder', d: 'M11 5a3 3 0 100 6 3 3 0 000-6zM4 21v-1a5 5 0 015-5h1m9 1a5 5 0 00-4.546-4.977M16 3.13a4 4 0 010 7.75M21 21l-3.5-3.5M19 15a4 4 0 100 8 4 4 0 000-8z' },
  { href: '/connections', label: 'My Connections', d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M9 20H4v-2a3 3 0 015.356-1.857M9 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
]

const navTools = [
  { href: '/templates', label: 'Templates', d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { href: '/inmail', label: 'InMail queue', d: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { href: '/history', label: 'History', d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/analytics', label: 'Analytics', d: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' },
]

const settingsD = 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z'
const accountD = 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'

function Icon({ d }: { d: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signout } = useAuth()
  const { count: inmailCount } = useInMail()
  const { unseenCount } = useMessagesAlerts()
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const year = new Date().getFullYear()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleLogout = async () => {
    setShowMenu(false)
    await signout()
    router.push('/login')
  }

  const active = (href: string) =>
    pathname === href || pathname.startsWith(href + '/')

  const linkCls = (href: string) =>
    `flex items-center gap-2 px-3.5 py-2 text-xs border-l-2 transition-colors ${
      active(href)
        ? 'bg-sidebar-active text-sidebar-bright border-brand'
        : 'text-sidebar-text border-transparent hover:bg-sidebar-active hover:text-sidebar-bright'
    }`

  return (
    <div className="w-48 h-screen bg-sidebar flex flex-col">

      {/* Logo */}
      <div className="px-4 py-3 border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Image
            src="/nexara-icon-32.png"
            alt="Nexara"
            width={28}
            height={28}
            className="rounded-md flex-shrink-0"
          />
          <div>
            <p className="text-sidebar-bright text-sm font-medium leading-tight">Nexara</p>
            <p className="text-[9px] text-sidebar-muted leading-tight">Powered by Nikarva</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 pt-2 overflow-y-auto">
        <div id="tour-group-main">
          <p className="px-3.5 py-2 text-[10px] text-sidebar-muted uppercase tracking-wider">Main</p>
          {navMain.map(n => (
            <Link key={n.href} href={n.href} className={linkCls(n.href)}>
              <Icon d={n.d} />{n.label}
            </Link>
          ))}
        </div>

        <div id="tour-group-tools">
          <p className="px-3.5 py-2 mt-1 text-[10px] text-sidebar-muted uppercase tracking-wider">Tools</p>
          <Link href="/templates" className={linkCls('/templates')}>
            <Icon d={navTools[0].d} />Templates
          </Link>
          <Link href="/inmail" className={linkCls('/inmail')}>
            <Icon d={navTools[1].d} />
            <span className="flex-1">InMail queue</span>
            {inmailCount > 0 && (
              <span className="bg-red-900 text-red-200 text-[10px] px-1.5 py-0.5 rounded-full leading-none">
                {inmailCount}
              </span>
            )}
          </Link>
          <Link href="/messages" className={linkCls('/messages')}>
            <Icon d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            <span className="flex-1">Messages</span>
            {unseenCount > 0 && (
              <span className="bg-red-900 text-red-200 text-[10px] px-1.5 py-0.5 rounded-full leading-none">
                {unseenCount}
              </span>
            )}
          </Link>
          <Link href="/history" className={linkCls('/history')}>
            <Icon d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />History
          </Link>
          <Link href="/analytics" className={linkCls('/analytics')}>
            <Icon d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />Analytics
          </Link>
        </div>

        <p className="px-3.5 py-2 mt-1 text-[10px] text-sidebar-muted uppercase tracking-wider">Account</p>
        <Link id="tour-account-link" href="/account" className={linkCls('/account')}>
          <Icon d={accountD} />Account
        </Link>
        <Link id="tour-settings-link" href="/settings" className={linkCls('/settings')}>
          <Icon d={settingsD} />Settings
        </Link>
      </nav>

      {/* Upgrade CTA -- links to the same page used for the public pricing page */}
      <div className="px-3 pb-3 flex-shrink-0">
        <Link
          id="tour-upgrade-btn"
          href="/pricing"
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-brand text-white text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          Upgrade
        </Link>
      </div>

      {/* Account section */}
      <div className="flex-shrink-0 relative" ref={menuRef}>

        {/* Popup */}
        {showMenu && (
          <div className="absolute bottom-full left-0 right-0 mb-1 mx-2 bg-white border border-gray-200 rounded-xl overflow-hidden z-50">
            <div className="px-3 py-2.5 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-900 truncate">
                {user?.email?.split('@')[0]}
              </p>
              <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Sign out
            </button>
          </div>
        )}

        {/* Clickable account row */}
        <button
          onClick={() => setShowMenu(prev => !prev)}
          className="w-full px-3.5 py-3 border-t border-sidebar-border flex items-center gap-2 hover:bg-sidebar-active transition-colors"
          aria-expanded={showMenu}
          aria-label="Account menu"
        >
          <div className="relative flex-shrink-0">
            <div className="w-7 h-7 rounded-full bg-brand-darker flex items-center justify-center text-[10px] text-sidebar-text font-medium">
              {user?.email?.slice(0, 2).toUpperCase() ?? 'NK'}
            </div>
            <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-400 border-2 border-sidebar" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[11px] text-sidebar-bright font-medium truncate">
              {user?.email?.split('@')[0] ?? 'User'}
            </p>
            <p className="text-[10px] text-sidebar-muted truncate">
              {user?.email}
            </p>
          </div>
          <svg
            width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="#5DCAA5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`flex-shrink-0 transition-transform duration-150 ${showMenu ? 'rotate-180' : ''}`}
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>

        {/* Copyright */}
        <div className="px-3.5 py-2 border-t border-sidebar-border">
          <p className="text-[9px] text-sidebar-muted text-center">
            © {year} Nikarva Technologies
          </p>
        </div>

      </div>
    </div>
  )
}
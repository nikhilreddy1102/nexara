'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useInMail } from '@/context/InMailContext'

const items = [
  { href: '/dashboard', label: 'Home', d: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/campaigns', label: 'Campaigns', d: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },
  { href: '/inmail', label: 'InMail', d: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { href: '/analytics', label: 'Analytics', d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { href: '/settings', label: 'Settings', d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { count: inmailCount } = useInMail()
  const active = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-sidebar border-t border-sidebar-border z-50">
      <div className="flex items-center justify-around py-1.5">
        {items.map(item => (
          <Link key={item.href} href={item.href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
              active(item.href) ? 'text-sidebar-bright' : 'text-sidebar-muted'
            }`}
          >
            <div className="relative">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.d} />
              </svg>
              {item.href === '/inmail' && inmailCount > 0 && (
                <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center font-medium">
                  {inmailCount}
                </span>
              )}
            </div>
            <span className="text-[10px]">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
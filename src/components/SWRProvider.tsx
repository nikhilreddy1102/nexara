'use client'

import { SWRConfig } from 'swr'
import { fetcher } from '@/lib/swr'
import type { ReactNode } from 'react'

// Root layout is a Server Component -- a function prop (fetcher) can't be
// passed from there straight into SWRConfig (a Client Component) across
// that boundary. This tiny client wrapper is the fix.
export default function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        // Revalidating every focus/reconnect on top of what's already in
        // flight is exactly the kind of request burst that exhausts the
        // browser's per-origin connection limit in local dev -- opt
        // individual hooks into it if a specific screen genuinely needs
        // always-fresh-on-refocus data.
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 4000,
      }}
    >
      {children}
    </SWRConfig>
  )
}

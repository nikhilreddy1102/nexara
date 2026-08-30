'use client'

import Header from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'

// InMail isn't wired up on the backend yet -- this used to list every
// campaign then fire one /targets request per campaign to build the queue
// (the same N+1 pattern fixed elsewhere), for a feature nothing actually
// populates. Hardcoded until InMail ships; swap this back to a real fetch
// then.
export default function InmailPage() {
  return (
    <div>
      <Header title="InMail queue" subtitle="Approve before spending credits" />
      <div className="p-4 md:p-6">
        <EmptyState
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
          title="InMail isn't available yet"
          description="This feature hasn't been wired up. Check back later."
        />
      </div>
    </div>
  )
}

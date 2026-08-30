'use client'

import { createContext, useContext, ReactNode } from 'react'

interface InMailContextType {
  count: number
  credits: number | null
  refresh: () => void
}

// InMail isn't wired up on the backend yet -- this used to fire two
// requests (targetsApi.list() + settingsApi.linkedin()) on every single
// dashboard page load, since this provider wraps the whole layout. That
// was pure waste for a feature nothing downstream actually uses yet, and
// it was two more entries competing for the connection-limit queue on
// every navigation. Hardcoded to "nothing pending" until InMail actually
// ships; swap this back to a real fetch then.
const InMailContext = createContext<InMailContextType>({
  count: 0,
  credits: null,
  refresh: () => {},
})

export function InMailProvider({ children }: { children: ReactNode }) {
  return (
    <InMailContext.Provider value={{ count: 0, credits: null, refresh: () => {} }}>
      {children}
    </InMailContext.Provider>
  )
}

export function useInMail() {
  return useContext(InMailContext)
}

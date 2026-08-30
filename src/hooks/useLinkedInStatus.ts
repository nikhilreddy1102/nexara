import useSWR from 'swr'
import type { LinkedInAccount } from '@/types'

interface LinkedInStatus {
  connected: boolean
  account: LinkedInAccount | null
}

// Shared across every page that needs "is LinkedIn connected + credits/plan"
// (Dashboard, Settings, Campaigns list/new/detail, People Finder). Same SWR
// key ('/settings/linkedin') means these all share ONE cached fetch instead
// of each page firing its own -- previously up to 7 separate requests to
// the exact same endpoint across the app, now one.
export function useLinkedInStatus() {
  const { data, error, isLoading, mutate } = useSWR<LinkedInStatus>('/settings/linkedin')
  return {
    connected: data?.connected ?? false,
    account: data?.account ?? null,
    loading: isLoading,
    error,
    // Call after an action that changes connection state (connect/
    // disconnect/reconnect) to refetch and update every consumer at once.
    mutate,
  }
}

import { apiGet } from './api'

// Shared fetcher for every useSWR() call in the app -- goes through the
// same apiGet() as everything else (auth header, 15s timeout, refresh-on-401),
// keyed by the endpoint string itself, so two components asking for the
// same endpoint share one cached entry instead of each firing their own
// request. That's what makes "cached instantly, revalidate silently" work:
// SWR renders whatever's already in its cache for that key immediately,
// then revalidates in the background and only re-renders if the data
// actually changed.
export const fetcher = <T = unknown>(endpoint: string): Promise<T> => apiGet<T>(endpoint)

// src/lib/cache.ts
// Simple in-memory cache with TTL. Prevents redundant API calls across page navigations.

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

export const cache = {
  get<T>(key: string): T | null {
    const entry = store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) { store.delete(key); return null }
    return entry.data as T
  },
  set<T>(key: string, data: T, ttlSeconds = 30): void {
    store.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 })
  },
  invalidate(key: string): void { store.delete(key) },
  invalidatePrefix(prefix: string): void {
    Array.from(store.keys()).forEach(key => {
      if (key.startsWith(prefix)) store.delete(key)
    })
  }
}
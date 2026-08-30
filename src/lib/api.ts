import type {
  User, Campaign, OutreachTarget, Template, Analytics, LinkedInAccount, Notification, CampaignSchedule,
  SegmentFilter, SegmentPreviewResponse, ConnectionOutreachCampaignFields, LinkedinMessage, AlertsResponse,
  MessagesListResponse,
} from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

const TOKEN_KEY = 'nexara_token'
const REFRESH_KEY = 'nexara_refresh_token'

interface CampaignsResponse     { campaigns: Campaign[] }
interface TargetsResponse       { targets: OutreachTarget[] }
interface TemplatesResponse     { templates: Template[] }
interface NotificationsResponse { notifications: Notification[] }
interface LinkedInResponse      { connected: boolean; account: LinkedInAccount | null }
interface SigninResponse        {
  access_token: string; refresh_token: string; user_id: string; email: string
  // True only on the signin call that just reactivated a soft-deleted
  // account (login within the backend's 20-day reactivation window).
  // Absent/false on every normal login and on /auth/refresh.
  reactivated?: boolean
}
interface ConnectionsResponse   { connections: LinkedInConnection[]; count: number; total: number }
interface SyncStatusResponse {
  status: 'idle' | 'syncing' | 'paused' | 'completed' | 'failed'
  pages_fetched: number
  total_synced: number
  total_connections: number | null
  last_synced_at: string | null
}

export interface LinkedInConnection {
  id: string
  provider_id: string
  public_identifier: string | null
  linkedin_url: string | null
  name: string | null
  headline: string | null
  email: string | null
  role_category: string | null
  is_hiring: boolean
  open_to_work: boolean
  location: string | null
  connected_at: string | null
  enriched_at: string | null
  profile_picture_url: string | null
  last_synced_at: string | null
}

type RequestData = Record<string, unknown>

// Thrown by request() instead of a plain Error so pages can branch on
// `code` (the backend's `detail` string, e.g. "no_account", "locked")
// instead of pattern-matching the human-readable message.
export class ApiError extends Error {
  status: number
  code: string
  // Best-effort navigator.onLine reading at the moment a network_error/
  // timeout happened -- lets callers say "you're offline" instead of a
  // generic "can't reach us" when the browser itself confirms there's no
  // connection at all (status 0 alone can't tell those apart).
  likelyOffline: boolean
  constructor(status: number, code: string, likelyOffline = false) {
    super(code)
    this.status = status
    this.code = code
    this.likelyOffline = likelyOffline
  }
}

// True for anything that means "we couldn't get a real answer out of
// Nexara" -- no response at all (network_error), no response in time
// (timeout), or a response that says the backend itself is broken (5xx).
// False for a normal 4xx: that's the backend answering correctly and
// saying no, not a connectivity/backend-health problem.
export function isConnectivityError(err: unknown): err is ApiError {
  return err instanceof ApiError && (err.code === 'network_error' || err.code === 'timeout' || err.status >= 500)
}

export function friendlyErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiError) {
    if (err.code === 'network_error') {
      return err.likelyOffline
        ? "You're offline - check your connection and try again."
        : "Couldn't reach Nexara. Check your connection, or try again in a moment."
    }
    if (err.code === 'timeout') {
      return 'Nexara is taking longer than expected to respond. Please try again.'
    }
    if (err.status >= 500) {
      return "Nexara is having trouble on our end right now - this isn't your connection. Please try again shortly."
    }
  }
  return fallback
}

// How long we wait for a response before treating the backend as
// unresponsive. A fetch() to a backend that accepted the TCP connection
// but never replies (hung request, deadlock, overloaded worker) never
// rejects and never resolves on its own -- without this, that case would
// spin forever instead of surfacing as an error.
const REQUEST_TIMEOUT_MS = 15000

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

// Endpoints that must NEVER trigger a refresh-and-retry (avoids infinite loops,
// and avoids force-navigating an unauthenticated visitor to /login mid-flow
// just because one of these returned a 401/429 for reasons unrelated to
// their own session -- wrong password, wrong OTP, DOB mismatch, lockout).
const NO_REFRESH_ENDPOINTS = [
  '/auth/refresh',
  '/auth/signin',
  '/auth/signup/request-otp',
  '/auth/signup/verify-otp',
  '/auth/forgot-password/verify-identity',
  '/auth/forgot-password/verify-otp',
  '/auth/forgot-password/reset',
  '/career-plan/activate',
]

// Single-flight lock: if five components 401 in the same tick (a page that
// fires 5 API calls on mount, all with the same stale token), we want ONE
// refresh call, not five racing each other and rotating the refresh token
// out from under one another.
let refreshInFlight: Promise<string> | null = null

async function performRefresh(): Promise<string> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const savedRefresh = typeof window !== 'undefined' ? localStorage.getItem(REFRESH_KEY) : null
    if (!savedRefresh) throw new Error('No refresh token available')

    const timeoutController = new AbortController()
    const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        signal: timeoutController.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: savedRefresh }),
      })
    } catch (err) {
      const likelyOffline = typeof navigator !== 'undefined' && !navigator.onLine
      const code = err instanceof DOMException && err.name === 'AbortError' ? 'timeout' : 'network_error'
      throw new ApiError(0, code, likelyOffline)
    } finally {
      clearTimeout(timeoutId)
    }
    if (!res.ok) throw new Error('Refresh failed')
    const body = await res.json() as SigninResponse
    localStorage.setItem(TOKEN_KEY, body.access_token)
    if (body.refresh_token) localStorage.setItem(REFRESH_KEY, body.refresh_token)
    return body.access_token
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

function forceLogout() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  if (!window.location.pathname.startsWith('/login')) {
    window.location.assign('/login')
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function performRequest<T = any>(endpoint: string, options: RequestInit = {}, _isRetry = false): Promise<T> {
  const token = getToken()
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      signal: timeoutController.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    })
  } catch (err) {
    const likelyOffline = typeof navigator !== 'undefined' && !navigator.onLine
    // Our own timeout firing looks identical to a caller-cancelled fetch
    // (both reject as AbortError) -- there's no way to fully distinguish
    // them here since no caller currently passes its own signal, so we
    // treat any abort as "backend took too long to answer."
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, 'timeout', likelyOffline)
    }
    // fetch() rejected for any other reason -- offline, DNS failure,
    // connection refused. Distinct from a 4xx/5xx response so callers can
    // tell "couldn't even reach the server" apart from "the backend
    // answered and said no."
    throw new ApiError(0, 'network_error', likelyOffline)
  } finally {
    clearTimeout(timeoutId)
  }

  if (res.status === 401 && !_isRetry && !NO_REFRESH_ENDPOINTS.includes(endpoint)) {
    try {
      await performRefresh()
    } catch (err) {
      // A connectivity failure during the refresh call itself isn't proof
      // the session is dead -- don't force-logout someone for losing wifi
      // or hitting a slow backend.
      if (isConnectivityError(err)) throw err
      forceLogout()
      throw new ApiError(401, 'session_expired')
    }
    // Retry exactly once with the freshly refreshed token.
    return request<T>(endpoint, options, true)
  }

  if (!res.ok) {
    if (res.status === 401 && !NO_REFRESH_ENDPOINTS.includes(endpoint)) {
      // Already retried once and still 401 — refresh token itself is dead.
      forceLogout()
      throw new ApiError(401, 'session_expired')
    }
    const error = await res.json().catch(() => ({ detail: 'unknown_error' }))
    // FastAPI's `detail` is sometimes a short machine code (what we throw
    // from our own routes, e.g. "no_account", "locked", "invalid_otp") and
    // sometimes a human sentence (validation errors etc). Either way it's
    // always a string here -- never render the raw parsed JSON object.
    const code = typeof error.detail === 'string' ? error.detail : `request_failed_${res.status}`
    throw new ApiError(res.status, code)
  }
  return res.json()
}

// De-dupes concurrent identical GET requests into a single network call.
// Without this, React Strict Mode's dev-only double-effect-fire (or two
// components independently loading the same resource on the same mount)
// each opened their own connection. Locally that was enough simultaneous
// requests -- plus the always-open /messages/stream SSE connection -- to
// exhaust the browser's 6-connections-per-origin HTTP/1.1 cap, so unrelated
// requests queued behind them for many seconds. Concurrent callers now
// share one in-flight promise instead of each firing their own.
const inFlightGetRequests = new Map<string, Promise<unknown>>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function request<T = any>(endpoint: string, options: RequestInit = {}, _isRetry = false): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  if (method !== 'GET' || _isRetry) {
    return performRequest<T>(endpoint, options, _isRetry)
  }

  const existing = inFlightGetRequests.get(endpoint)
  if (existing) return existing as Promise<T>

  const promise = performRequest<T>(endpoint, options, _isRetry).finally(() => {
    inFlightGetRequests.delete(endpoint)
  })
  inFlightGetRequests.set(endpoint, promise)
  return promise
}

// Generic escape hatch for call sites doing a one-off GET that doesn't
// warrant a dedicated method on one of the *Api objects below -- still
// goes through the same auth headers, timeout, refresh-on-401, and
// de-dupe handling as everything else here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apiGet<T = any>(endpoint: string): Promise<T> {
  return request<T>(endpoint)
}

export const authApi = {
  signupRequestOtp: (email: string, password: string) =>
    request<{ message: string }>('/auth/signup/request-otp', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),
  signupVerifyOtp: (email: string, otp: string, dob: string) =>
    request<SigninResponse>('/auth/signup/verify-otp', {
      method: 'POST', body: JSON.stringify({ email, otp, dob }),
    }),
  signin: (email: string, password: string) =>
    request<SigninResponse>('/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) }),
  refresh: (refreshToken: string) =>
    request<SigninResponse>('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) }),
  signout: () =>
    request<void>('/auth/signout', { method: 'POST' }),
  me: () =>
    request<User>('/auth/me'),
  forgotPasswordVerifyIdentity: (email: string, dob?: string) =>
    request<{ message: string }>('/auth/forgot-password/verify-identity', {
      method: 'POST', body: JSON.stringify({ email, dob: dob || null }),
    }),
  forgotPasswordVerifyOtp: (email: string, otp: string) =>
    request<{ reset_token: string }>('/auth/forgot-password/verify-otp', {
      method: 'POST', body: JSON.stringify({ email, otp }),
    }),
  forgotPasswordReset: (resetToken: string, newPassword: string, dob?: string) =>
    request<{ message: string }>('/auth/forgot-password/reset', {
      method: 'POST', body: JSON.stringify({ reset_token: resetToken, new_password: newPassword, dob: dob || null }),
    }),
}

interface ActivateResponse {
  existing_account: boolean
  access_token?: string
  refresh_token?: string
  user_id?: string
  email?: string
}

export const careerPlanApi = {
  activate: (token: string) =>
    request<ActivateResponse>('/career-plan/activate', {
      method: 'POST', body: JSON.stringify({ token }),
    }),
}

export const accountApi = {
  setPassword: (newPassword: string, currentPassword?: string) =>
    request<{ message: string }>('/account/password', {
      method: 'POST', body: JSON.stringify({ new_password: newPassword, current_password: currentPassword || null }),
    }),
  markTourSeen: () =>
    request<{ message: string }>('/account/tour-seen', { method: 'POST' }),
  markFirstLoadSeen: () =>
    request<{ message: string }>('/account/first-load-seen', { method: 'POST' }),
}

export const campaignsApi = {
  list: () =>
    request<CampaignsResponse>('/campaigns'),
  create: (data: {
    name: string
    // 'custom' is never a valid value to send -- mode is one of
    // 'fulltime' | 'c2c' | 'connection_outreach' | 'b2b_prospecting' | 'staffing'
    // directly. Kept as `string` here rather than a strict union so this
    // signature doesn't need touching again the moment a 5th card exists.
    mode: string
    // Now optional: omitting it lets the backend apply its per-mode default
    // (True for fulltime/c2c, False/autopilot for connection_outreach).
    // Only pass this explicitly if you're overriding that default.
    supervised_mode?: boolean
    target_titles?: string[]
    target_role_categories?: string[]
    target_companies?: string[]
    target_locations?: string[]
    // Sales Navigator headcount bucket keys, e.g. '1-10' | '11-50' | '51-200'
    // | '201-500' | '501-1000' | '1001-5000' | '5001-10000' | '10001+'.
    target_company_size?: string[]
    // 'basic' | 'pro' | 'advanced' -- chosen at creation instead of always
    // silently defaulting to basic. Omitting it still behaves as basic.
    discovery_tier?: string
    job_title?: string
    tech_stack?: string[]
    custom_goal?: string
    target_persona?: string
    // connection_outreach only -- ignored by the backend for every other mode.
    goal_type?: 'specific' | 'general'
    goal_text?: string
    connection_segment_filter?: SegmentFilter
    connection_selection_mode?: 'all_matched' | 'include_list' | 'exclude_list'
    personalization_enabled?: boolean
    recent_activity_enabled?: boolean
  }) =>
    request<Campaign>('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) =>
    request<Campaign>(`/campaigns/${id}`),
  update: (id: string, data: RequestData) =>
    request<Campaign>(`/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/campaigns/${id}`, { method: 'DELETE' }),
  start: (id: string) =>
    request<Campaign>(`/campaigns/${id}/start`, { method: 'POST' }),
  pause: (id: string) =>
    request<Campaign>(`/campaigns/${id}/pause`, { method: 'POST' }),
  // NOTE: requires backend support — outreach_targets needs a campaign_run_id
  // column, and this endpoint needs to filter targets by it. Until that
  // exists this will 404; callers should catch and degrade gracefully.
  runTargets: (campaignId: string, runId: string) =>
    request<TargetsResponse>(`/campaigns/${campaignId}/runs/${runId}/targets`),
  getSchedule: (id: string) =>
    request<CampaignSchedule>(`/campaigns/${id}/schedule`),
  updateSchedule: (id: string, data: {
    enabled: boolean
    days_of_week: number[]
    window_start_local: string
    window_end_local: string
  }) =>
    request<CampaignSchedule>(`/campaigns/${id}/schedule`, { method: 'PUT', body: JSON.stringify(data) }),
  // Lives under /scheduler, not /campaigns, on the backend -- this is the
  // people-finder-campaign "process one pending target right now" call,
  // not the discovery-based /campaigns/{id}/run endpoint.
  runNow: (id: string) =>
    request<{ status: string; detail?: string }>(`/scheduler/campaigns/${id}/run-now`, { method: 'POST' }),
}

export const targetsApi = {
  // Omit campaignId to get every target across all of the user's campaigns
  // in one request -- the backend does this as a single query, instead of
  // callers looping over campaigns and firing one request each.
  list: (campaignId?: string) =>
    request<TargetsResponse>(campaignId ? `/targets?campaign_id=${campaignId}` : '/targets'),
  add: (data: RequestData) =>
    request<OutreachTarget>('/targets', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: RequestData) =>
    request<OutreachTarget>(`/targets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/targets/${id}`, { method: 'DELETE' }),
}

export const templatesApi = {
  list: () =>
    request<TemplatesResponse>('/templates'),
  create: (data: RequestData) =>
    request<Template>('/templates', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: RequestData) =>
    request<Template>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/templates/${id}`, { method: 'DELETE' }),
}

export const analyticsApi = {
  overview: () =>
    request<Analytics>('/analytics/overview'),
  campaign: (id: string) =>
    request<Analytics>(`/analytics/campaign/${id}`),
}

export const settingsApi = {
  get: () =>
    request<User>('/settings'),
  update: (data: RequestData) =>
    request<User>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  // Fast, DB-only status -- use this everywhere. Only the Settings page's
  // LinkedIn card should also call verifyLinkedin() for the authoritative,
  // live-checked version (slower, corrects drift).
  linkedin: () =>
    request<LinkedInResponse>('/settings/linkedin'),
  verifyLinkedin: () =>
    request<LinkedInResponse>('/settings/linkedin/verify'),
  notifications: () =>
    request<NotificationsResponse>('/settings/notifications'),
  markRead: (id: string) =>
    request<void>(`/settings/notifications/${id}/read`, { method: 'PUT' }),
}

export const connectionsApi = {
  list: (params: {
    is_hiring?: boolean
    open_to_work?: boolean
    // New: role_categories and exclude, for the Recruiter/HM/Founder
    // chips. role_categories and open_to_work are mutually exclusive on
    // the wire (same rule as the campaign wizard's segment filter) --
    // don't send both; send whichever facet is actually active.
    role_categories?: string[]
    exclude?: boolean
    enriched?: boolean
    search?: string
    limit?: number
    offset?: number
  } = {}) => {
    const query = new URLSearchParams()
    if (params.is_hiring !== undefined) query.set('is_hiring', String(params.is_hiring))
    if (params.open_to_work !== undefined) query.set('open_to_work', String(params.open_to_work))
    if (params.role_categories?.length) {
      for (const rc of params.role_categories) query.append('role_categories', rc)
    }
    if (params.exclude !== undefined) query.set('exclude', String(params.exclude))
    if (params.enriched !== undefined) query.set('enriched', String(params.enriched))
    if (params.search) query.set('search', params.search)
    query.set('limit', String(params.limit ?? 50))
    query.set('offset', String(params.offset ?? 0))
    return request<ConnectionsResponse>(`/connections?${query.toString()}`)
  },
  // Return type matches the smart-delta refresh (pages_checked, not
  // has_more -- the backend now pages from page 1 until it hits an
  // already-known connection, rather than advancing a stored cursor).
  refresh: () =>
    request<{ success: boolean; fetched: number; pages_checked: number; total_connections: number | null }>('/connections/refresh', { method: 'POST' }),
  syncAll: () =>
    request<{ success: boolean; message: string; total_connections: number | null }>('/connections/sync-all', { method: 'POST' }),
  syncCancel: () =>
    request<{ success: boolean; message: string }>('/connections/sync-cancel', { method: 'POST' }),
  syncStatus: () =>
    request<SyncStatusResponse>('/connections/sync-status'),
  checkCount: () =>
    request<{ success: boolean; total_connections: number }>('/connections/check-count', { method: 'POST' }),
  getCachedCount: () =>
    request<{ total_connections: number | null }>('/connections/count'),
  enrichOne: (id: string) =>
    request<{ success: boolean; email: string | null; location: string | null; open_to_work: boolean; linkedin_url?: string }>(`/connections/${id}/enrich`, { method: 'POST' }),
  enrichAll: (scope: 'all' | 'recruiters' = 'all') =>
    request<{ success: boolean; message: string }>(`/connections/enrich-all?scope=${scope}`, { method: 'POST' }),
  enrichCancel: () =>
    request<{ success: boolean; message: string }>('/connections/enrich-cancel', { method: 'POST' }),
  enrichStatus: () =>
    request<{
      status: 'idle' | 'enriching' | 'paused' | 'completed' | 'failed'
      total_to_enrich: number
      enriched_count: number
      scope: 'all' | 'recruiters'
      extra_delay_seconds: number
    }>('/connections/enrich-status'),
}

// ─────────────────────────────────────────────────────────────────────
// Connection Outreach -- new. Segment preview, goal/fact-sheet, people
// selection, message generation, supervised-mode toggle, and the actual send.
// ─────────────────────────────────────────────────────────────────────
export const connectionOutreachApi = {
  segmentPreview: (filter: SegmentFilter, limit = 10) =>
    request<SegmentPreviewResponse>('/connection-outreach/segment-preview', {
      method: 'POST',
      body: JSON.stringify({ ...filter, limit }),
    }),

  // Supervised initial-send approvals -- only ever non-empty for the
  // narrow case where recent_activity_enabled generated genuinely fresh,
  // per-person content on a supervised campaign. message_text below is
  // the REAL final message (weave already ran), never a template.
  getPendingApprovals: (campaignId: string) =>
    request<{
      pending: {
        outreach_message_id: string
        connection_id: string | null
        name: string | null
        headline: string | null
        profile_picture_url: string | null
        message_text: string | null
        created_at: string
      }[]
    }>(`/connection-outreach/campaigns/${campaignId}/pending-approvals`),

  // Saves edited text WITHOUT sending -- same edit/approve separation as
  // ChatThread's MessageBubble. approveSend below sends whatever is
  // currently stored, so an edit here is picked up automatically.
  editPendingApproval: (campaignId: string, outreachMessageId: string, messageText: string) =>
    request<{ success: boolean }>(`/connection-outreach/campaigns/${campaignId}/pending-approvals/${outreachMessageId}`, {
      method: 'PUT',
      body: JSON.stringify({ message_text: messageText }),
    }),

  // Sends IMMEDIATELY, not a requeue -- personalization already happened
  // when the row was created, there's nothing left to regenerate.
  approveSend: (campaignId: string, outreachMessageIds: string[]) =>
    request<{ success: boolean; approved: number; failed: number }>(`/connection-outreach/campaigns/${campaignId}/approve-send`, {
      method: 'POST',
      body: JSON.stringify({ outreach_message_ids: outreachMessageIds }),
    }),

  rejectSend: (campaignId: string, outreachMessageIds: string[]) =>
    request<{ success: boolean; rejected: number }>(`/connection-outreach/campaigns/${campaignId}/reject-send`, {
      method: 'POST',
      body: JSON.stringify({ outreach_message_ids: outreachMessageIds }),
    }),

  updateGoal: (campaignId: string, body: { goal_type: 'specific' | 'general'; goal_text?: string }) =>
    request<ConnectionOutreachCampaignFields>(`/connection-outreach/campaigns/${campaignId}/goal`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  uploadFactSheet: (campaignId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const token = getToken()
    return fetch(`${API_URL}/connection-outreach/campaigns/${campaignId}/fact-sheet`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Upload failed' }))
        throw new Error(err.detail || 'Upload failed')
      }
      return res.json() as Promise<{ id: string; filename: string }>
    })
  },

  updateSelection: (campaignId: string, body: { mode: 'all_matched' | 'include_list' | 'exclude_list'; connection_ids: string[] }) =>
    request<{ success: boolean; mode: string; count: number }>(`/connection-outreach/campaigns/${campaignId}/selection`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  generateMessage: (campaignId: string, instruction: string) =>
    request<{ draft: string; instruction: string }>(`/connection-outreach/campaigns/${campaignId}/message/generate`, {
      method: 'POST',
      body: JSON.stringify({ instruction }),
    }),

  regenerateMessage: (campaignId: string, instruction: string) =>
    request<{ draft: string; instruction: string }>(`/connection-outreach/campaigns/${campaignId}/message/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ instruction }),
    }),

  updatePersonalization: (campaignId: string, enabled: boolean) =>
    request<ConnectionOutreachCampaignFields>(`/connection-outreach/campaigns/${campaignId}/personalization`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    }),

  updateRecentActivity: (campaignId: string, enabled: boolean) =>
    request<ConnectionOutreachCampaignFields>(`/connection-outreach/campaigns/${campaignId}/recent-activity`, {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    }),

  updateSupervisedMode: (campaignId: string, supervised_mode: boolean) =>
    request<ConnectionOutreachCampaignFields>(`/connection-outreach/campaigns/${campaignId}/supervised-mode`, {
      method: 'PUT',
      body: JSON.stringify({ supervised_mode }),
    }),

  // /campaigns/{id}/start is blocked for this mode (it's the graph-pipeline
  // entry point) -- this is the resume path instead, reusing
  // campaignsApi.pause() for the other direction.
  resume: (campaignId: string) =>
    request<{ message: string; campaign: unknown }>(`/connection-outreach/campaigns/${campaignId}/resume`, { method: 'POST' }),

  // Omit connection_ids to use the campaign's saved segment filter +
  // selection instead of an explicit override. No longer sends
  // synchronously -- queues with real pacing (see
  // initial_send_scheduler.py); "queued" replaces the old "sent" count.
  send: (campaignId: string, body: { message_text: string; connection_ids?: string[] }) =>
    request<{ drafted: number; queued: number; skipped: number; daily_limit_reached: number; errored: number }>(
      `/connection-outreach/campaigns/${campaignId}/send`,
      { method: 'POST', body: JSON.stringify(body) }
    ),

  // Real status for the post-launch detail page -- didn't exist before.
  getQueueStatus: (campaignId: string) =>
    request<{
      total: number; queued: number; sent: number; pending_approval: number; failed: number
      next_send_at: string | null; supervised_mode: boolean; status: string
      reply_pipeline: { pending_classification: number; autopilot_scheduled: number; pending_review: number; held_for_review: number }
      reply_rate: { sent: number; replied: number }
      conversations: { chat_id: string; connection_id: string | null; sender_name: string | null; last_message: string; last_message_at: string; needs_review: boolean }[]
      // Non-editable as of now -- real enforced constants from the
      // backend (routers/connection_outreach.py's module-level DAILY_SEND_LIMIT
      // etc.), not a second hardcoded copy on this side.
      sending_limits: {
        daily_send_limit: number
        daily_send_limit_scope: string
        message_gap_min_seconds: number
        message_gap_max_seconds: number
        recent_activity_extra_max_seconds: number
        recent_activity_enabled: boolean
      }
    }>(`/connection-outreach/campaigns/${campaignId}/queue-status`),
}

// ─────────────────────────────────────────────────────────────────────
// Messages / Inbox / Alerts -- new.
// ─────────────────────────────────────────────────────────────────────
export const messagesApi = {
  list: (params: { campaign_id?: string; connection_id?: string; chat_id?: string; direction?: 'inbound' | 'outbound'; limit?: number; offset?: number; before?: string } = {}) => {
    const query = new URLSearchParams()
    if (params.campaign_id) query.set('campaign_id', params.campaign_id)
    if (params.connection_id) query.set('connection_id', params.connection_id)
    if (params.chat_id) query.set('chat_id', params.chat_id)
    if (params.direction) query.set('direction', params.direction)
    if (params.before) query.set('before', params.before)
    query.set('limit', String(params.limit ?? 50))
    query.set('offset', String(params.offset ?? 0))
    return request<MessagesListResponse>(`/messages?${query.toString()}`)
  },

  // Account-wide reply pipeline status -- wasn't callable from the
  // frontend at all until now, even though the backend endpoint existed.
  getPipelineStatus: () =>
    request<{
      pending_classification: number; autopilot_scheduled: number; pending_review: number
      held_for_review: number; approved_sent: number
      reply_rate: { sent: number; replied: number }
    }>('/messages/pipeline-status'),

  alerts: (params: { limit?: number; before?: string } = {}) => {
    const query = new URLSearchParams()
    query.set('limit', String(params.limit ?? 50))
    if (params.before) query.set('before', params.before)
    return request<AlertsResponse>(`/messages/alerts?${query.toString()}`)
  },

  markSeen: (messageId: string) =>
    request<LinkedinMessage>(`/messages/${messageId}/mark-seen`, { method: 'POST' }),

  markThreadSeen: (body: { chat_id?: string; connection_id?: string }) =>
    request<{ success: boolean; cleared_count: number }>('/messages/thread/mark-seen', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  approveReply: (messageId: string) =>
    request<LinkedinMessage>(`/messages/${messageId}/approve-reply`, { method: 'POST' }),

  editDraft: (messageId: string, replyDraft: string) =>
    request<LinkedinMessage>(`/messages/${messageId}/edit-draft`, {
      method: 'POST',
      body: JSON.stringify({ reply_draft: replyDraft }),
    }),

  enrichSender: (messageId: string) =>
    request<{ sender_headline: string | null; sender_profile: Record<string, unknown> | null; cached: boolean }>(
      `/messages/${messageId}/enrich-sender`,
      { method: 'POST' }
    ),

  // Ask Nexara -- campaign-aware: grounded in the campaign's fact sheet
  // when one exists, casual/thread-only otherwise (same branching
  // reply_handler.py's autopilot drafting already uses).
  suggestReply: (body: { chat_id?: string; connection_id?: string }) =>
    request<{ draft: string; grounded_in_fact_sheet: boolean }>('/messages/thread/suggest-reply', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Rewrite with Nexara -- polishes whatever's already typed, same intent.
  rewriteDraft: (body: { chat_id?: string; connection_id?: string; draft_text: string }) =>
    request<{ draft: string }>('/messages/thread/rewrite', { method: 'POST', body: JSON.stringify(body) }),

  // The actual send for the compose bar -- covers "custom send" too,
  // since typing here and hitting Send without touching Ask/Rewrite goes
  // through this exact same call.
  sendToThread: (body: { chat_id: string; connection_id?: string; message_text: string }) =>
    request<LinkedinMessage>('/messages/thread/send', { method: 'POST', body: JSON.stringify(body) }),

  // Fallback for messages missing sender_linkedin_url -- searches
  // linkedin_connections/discovered_profiles by provider_id.
  resolveProfileUrl: (messageId: string) =>
    request<{ sender_linkedin_url: string | null; found: boolean }>(`/messages/${messageId}/resolve-profile-url`, {
      method: 'POST',
    }),

  // NOT a request() call -- returns a URL for a raw EventSource, since
  // EventSource can't send Authorization headers, only query params.
  streamUrl: () => `${API_URL}/messages/stream?token=${getToken() ?? ''}`,
}
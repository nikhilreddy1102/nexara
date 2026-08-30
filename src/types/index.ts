// Type-only import from api.ts -- safe despite api.ts also importing types
// FROM this file, since `import type` is erased at compile time and
// creates no real runtime circularity.
import type { LinkedInConnection } from '@/lib/api'

export interface User {
  id: string
  email: string
  region: string
  supabase_uid: string
  dream_companies: string[]
  resume_text: string | null
  tech_stack: string[]
  years_experience: number | null
  visa_status: string | null
  availability: string | null
  rate_per_hour: number | null
  warm_up_complete: boolean
  dob: string | null // 'YYYY-MM-DD' - needs a matching column on the backend profile table
  created_at: string
  has_password_set?: boolean
  has_completed_first_load?: boolean
  has_seen_tour?: boolean
}

export interface Campaign {
  id: string
  user_id: string
  name: string
  // Updated: 'custom' is never written anymore -- each card writes its own
  // value directly from creation. 'custom' stays in this union only so
  // TypeScript doesn't complain about any already-existing rows fetched
  // from before this change; nothing NEW ever has this value.
  mode: 'fulltime' | 'c2c' | 'custom' | 'connection_outreach' | 'b2b_prospecting' | 'staffing'
  status: 'draft' | 'running' | 'paused' | 'completed'
  source: string
  supervised_mode: boolean
  autonomous_approved: boolean
  target_role_categories: string[]
  created_at: string
  daily_limit?: number          // already existed on the backend row, just wasn't typed here
  sent_today?: number           // new -- added to GET /campaigns/{id}
  next_action_at?: string | null  // new -- added to GET /campaigns/{id}
  // basic | pro | advanced -- what tier of discovery this campaign uses
  // when the scheduler runs it automatically. Ignored (forced to
  // 'advanced') for source === 'people_finder' campaigns.
  discovery_tier?: 'basic' | 'pro' | 'advanced'
  // Approval gate: once manual_approvals_count reaches live_approval_gate,
  // the backend flips autonomous_approved and remaining supervised targets
  // auto-send without stopping for review. NOTE: this gate is
  // fulltime/c2c-only -- connection_outreach uses a flat, reversible
  // supervised_mode toggle instead (see ConnectionOutreachCampaignFields
  // below), not this graduation mechanic.
  manual_approvals_count?: number
  live_approval_gate?: number
  // connection_outreach only -- undefined/null for every other mode.
  goal_type?: 'specific' | 'general' | null
  goal_text?: string | null
  fact_sheet_id?: string | null
  goal_attached_at?: string | null
  connection_segment_filter?: SegmentFilter | null
  connection_selection_mode?: 'all_matched' | 'include_list' | 'exclude_list'
  personalization_enabled?: boolean
  recent_activity_enabled?: boolean
}

export interface CampaignSchedule {
  campaign_id: string
  enabled: boolean
  days_of_week: number[]  // 0=Sunday..6=Saturday
  window_start_local: string  // 'HH:MM', America/Chicago
  window_end_local: string
  is_active_now?: boolean  // computed server-side by the exact same check the scheduler runs
}

export interface OutreachTarget {
  id: string
  campaign_id: string
  linkedin_url: string | null
  hr_name: string | null
  company: string | null
  title: string | null
  connection_degree: number | null
  profile_type: string | null
  open_profile: boolean
  action_taken: string | null
  status: string
  priority: 'high' | 'medium' | 'low'
  priority_score: number
  ats_score: number
  role_categories: string[]
  last_verified_at: string | null
  inmail_approved: boolean
  inmail_spent: boolean
  email_found: string | null
  message_sent: string | null
  sent_at: string | null
  accepted_at: string | null
  replied_at: string | null
  follow_up_count: number
  skip_reason: string | null
  created_at: string
  hiring_detected?: boolean
  hiring_posts?: LinkedInPost[]
  recent_posts?: LinkedInPost[]
  enriched_at?: string | null
}

// Raw Unipile post object, as returned by the /targets/{id}/enrich flow.
export interface LinkedInPost {
  id?: string
  date?: string
  text: string
  [key: string]: unknown
}

export interface Template {
  id: string
  user_id: string
  name: string
  type: string
  persona: string | null
  mode: 'fulltime' | 'c2c' | 'custom'
  body: string
  variables: string[]
  char_limit: number | null
  performance_score: number
  acceptance_rate: number
  reply_rate: number
  version: number
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  level: 'info' | 'warning' | 'critical'
  message: string
  read: boolean
  action_required: boolean
  created_at: string
}

export interface LinkedInAccount {
  id: string
  user_id: string
  unipile_account_id: string
  plan_type: string
  inmail_credits_total: number
  inmail_credits_used: number
  inmail_credits_remaining: number
  daily_requests_sent: number
  warm_up_complete: boolean
  status: string
}

export interface Analytics {
  total_campaigns: number
  total_sent: number
  total_accepted: number
  total_replied: number
  acceptance_rate: number
  reply_rate: number
}

// ─────────────────────────────────────────────────────────────────────
// Connection Outreach + Messages -- added below, nothing above this
// line changed except Campaign.mode's union and its new optional fields.
// ─────────────────────────────────────────────────────────────────────

export interface SegmentFilter {
  role_categories: string[]   // subset of ['recruiter', 'hiring_manager', 'founder']
  open_to_work: boolean | null
  exclude: boolean
  // NEW -- ticking this drops anyone who's ever received an outbound
  // campaign message, in ANY campaign, from both the live count and the
  // people-picker sample. Orthogonal to role_categories/open_to_work/
  // exclude -- applied as a separate id-exclusion pass on the backend
  // (get_contacted_connection_ids), so it works regardless of what else
  // is selected, including nothing else selected at all.
  exclude_contacted: boolean
}

export interface SegmentPreviewResponse {
  count: number
  sample: LinkedInConnection[]   // from api.ts, first 10 matches
}

// Fields specific to mode === 'connection_outreach' -- these ARE the
// fields already added onto Campaign above; this separate interface
// exists only for call sites that want to work with just the subset
// (e.g. a function that only ever touches Connection Outreach campaigns
// and wants a narrower type than the full Campaign shape).
export interface ConnectionOutreachCampaignFields {
  id: string
  mode: 'connection_outreach'
  goal_type: 'specific' | 'general' | null
  goal_text: string | null
  fact_sheet_id: string | null
  goal_attached_at: string | null
  connection_segment_filter: SegmentFilter | null
  connection_selection_mode: 'all_matched' | 'include_list' | 'exclude_list'
  personalization_enabled: boolean
  recent_activity_enabled: boolean
  supervised_mode: boolean
}

export interface LinkedinMessage {
  id: string
  nexara_user_id: string
  campaign_id: string | null
  outreach_message_id: string | null
  connection_id: string | null
  chat_id: string | null
  direction: 'inbound' | 'outbound'
  message_text: string
  classification: 'factual' | 'social' | 'unknown' | null
  classified_at: string | null
  reply_draft: string | null
  reply_status: 'pending_review' | 'autopilot_scheduled' | 'approved_sent' | 'held_for_review' | null
  scheduled_send_at: string | null
  seen_at: string | null
  created_at: string
  sender_name: string | null
  sender_linkedin_url: string | null
  sender_headline: string | null
  sent_via: 'autopilot' | 'manual' | 'campaign' | null
  sender_profile: Record<string, unknown> | null
}

export interface AlertsResponse {
  unseen: LinkedinMessage[]
  count: number
  total_unseen: number
  has_more: boolean
  next_before: string | null
}

export interface MessagesListResponse {
  messages: LinkedinMessage[]
  count: number
  total: number
  has_more: boolean
  next_before: string | null
}

// Shape of events arriving over the SSE stream (GET /messages/stream).
// Every event has "type"; the rest depends on which one.
export type StreamEvent =
  | { type: 'new_message'; message: LinkedinMessage }
  | { type: 'message_seen'; message_id: string }
  | { type: 'thread_seen'; chat_id: string | null; connection_id: string | null; cleared_count: number }
  | { type: 'reply_drafted'; message_id: string; classification: string; reply_status: string }
  | { type: 'reply_sent'; message_id: string; chat_id: string }
  | { type: 'message_sent'; connection_id: string; campaign_id: string }
  | { type: 'account_disconnected'; status: string; message: string }
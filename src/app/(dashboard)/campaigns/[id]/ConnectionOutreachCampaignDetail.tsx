'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { connectionOutreachApi, campaignsApi, messagesApi } from '@/lib/api'
import { cache } from '@/lib/cache'
import { formatSidebarTimestamp } from '@/lib/chatTime'
import Header from '@/components/layout/Header'
import GoalStep from '../new/ConnectionOutreach/GoalStep'
import type { Campaign, StreamEvent, CampaignSchedule } from '@/types'

interface QueueStatus {
  total: number
  queued: number
  sent: number
  pending_approval: number
  failed: number
  next_send_at: string | null
  supervised_mode: boolean
  status: string
  reply_pipeline: { pending_classification: number; autopilot_scheduled: number; pending_review: number; held_for_review: number }
  reply_rate: { sent: number; replied: number }
  conversations: { chat_id: string; connection_id: string | null; sender_name: string | null; last_message: string; last_message_at: string; needs_review: boolean }[]
  // Non-editable as of now -- real enforced constants from the backend,
  // not hardcoded here (would risk silently drifting from what
  // send_to_segment actually applies if the backend value ever changes).
  sending_limits: {
    daily_send_limit: number
    daily_send_limit_scope: string
    message_gap_min_seconds: number
    message_gap_max_seconds: number
    recent_activity_extra_max_seconds: number
    recent_activity_enabled: boolean
  }
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Props {
  campaign: Campaign | null
}

export default function ConnectionOutreachCampaignDetail({ campaign }: Props) {
  const router = useRouter()
  const cacheKey = campaign ? `queue-status:${campaign.id}` : null
  // Cache-first, same pattern as the Messages page: if this campaign's
  // status is already cached from a previous visit, render it instantly
  // instead of showing a loading spinner while waiting on a fetch that
  // usually returns the same thing anyway. SSE events below are what
  // actually keep this correct afterward, not a refetch on every mount.
  const [status, setStatus] = useState<QueueStatus | null>(() => (cacheKey ? cache.get<QueueStatus>(cacheKey) : null))
  const [loading, setLoading] = useState(() => (cacheKey ? cache.get<QueueStatus>(cacheKey) === null : true))
  const [pauseLoading, setPauseLoading] = useState(false)
  const [goalType, setGoalType] = useState<'specific' | 'general' | null>(null)
  const [goalText, setGoalText] = useState('')
  const [factSheetName, setFactSheetName] = useState<string | null>(null)
  const [goalOpen, setGoalOpen] = useState(false)
  // Schedule -- fetched separately, same endpoint the (currently
  // Fulltime/C2C-only) schedule panel already uses. Read-only display
  // here, no edit UI yet, per "non-editable as of now."
  const [schedule, setSchedule] = useState<CampaignSchedule | null>(null)
  // Supervised initial-send drafts waiting on approval -- only ever
  // non-empty for the narrow case (recent_activity_enabled generated
  // fresh, per-person content). Not cached like queue-status, since this
  // list changes the moment someone approves/rejects/edits.
  const [pendingApprovals, setPendingApprovals] = useState<
    { outreach_message_id: string; connection_id: string | null; name: string | null; headline: string | null; message_text: string | null }[]
  >([])
  const [selectedApprovalIds, setSelectedApprovalIds] = useState<Set<string>>(new Set())
  const [approvalActionLoading, setApprovalActionLoading] = useState(false)
  // Per-row edit state -- mirrors ChatThread's MessageBubble pattern
  // exactly (editingId set = that row shows a textarea; draftText holds
  // the in-progress edit until Save).
  const [editingApprovalId, setEditingApprovalId] = useState<string | null>(null)
  const [editDraftText, setEditDraftText] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const loadPendingApprovals = useCallback(() => {
    if (!campaign) return
    connectionOutreachApi
      .getPendingApprovals(campaign.id)
      .then((res) => setPendingApprovals(res.pending))
      .catch(() => setPendingApprovals([]))
  }, [campaign])

  const loadStatus = useCallback(() => {
    if (!campaign) return
    connectionOutreachApi
      .getQueueStatus(campaign.id)
      .then((res) => {
        setStatus(res)
        // Long TTL -- SSE is what keeps this fresh in real time, this
        // cache exists purely to skip a redundant fetch on the next
        // visit, not to trust a stale snapshot on its own.
        cache.set(`queue-status:${campaign.id}`, res, 600)
      })
      .finally(() => setLoading(false))
  }, [campaign])

  useEffect(() => {
    // Still fetch even when cache hit -- confirms freshness silently in
    // the background rather than trusting an old visit forever. This is
    // the one place a fetch always happens regardless of cache state;
    // SSE handles everything after this point.
    loadStatus()
    loadPendingApprovals()
    if (campaign) {
      setGoalType(campaign.goal_type ?? null)
      setGoalText(campaign.goal_text ?? '')
      campaignsApi.getSchedule(campaign.id).then(setSchedule).catch(() => setSchedule(null))
    }
  }, [loadStatus, loadPendingApprovals, campaign])

  useEffect(() => {
    if (!campaign) return
    const campaignId = campaign.id
    const es = new EventSource(messagesApi.streamUrl())
    es.onmessage = (e) => {
      try {
        const event: StreamEvent = JSON.parse(e.data)
        if (
          (event.type === 'message_sent' && event.campaign_id === campaignId) ||
          event.type === 'new_message' || event.type === 'reply_sent' || event.type === 'reply_drafted'
        ) {
          loadStatus()
        }
      } catch {
        // ignore malformed events
      }
    }
    return () => es.close()
  }, [campaign, loadStatus])

  const togglePause = async () => {
    if (!campaign || !status) return
    setPauseLoading(true)
    try {
      if (status.status === 'paused') {
        await connectionOutreachApi.resume(campaign.id)
      } else {
        await campaignsApi.pause(campaign.id)
      }
      loadStatus()
    } finally {
      setPauseLoading(false)
    }
  }

  const saveGoal = async () => {
    if (!campaign || !goalType) return
    await connectionOutreachApi.updateGoal(campaign.id, { goal_type: goalType, goal_text: goalText })
    setGoalOpen(false)
  }

  const toggleApprovalSelected = (id: string) => {
    setSelectedApprovalIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const approveIds = async (ids: string[]) => {
    if (!campaign || ids.length === 0) return
    setApprovalActionLoading(true)
    try {
      await connectionOutreachApi.approveSend(campaign.id, ids)
      setSelectedApprovalIds((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      })
      loadPendingApprovals()
      loadStatus()   // sent/queued counts change immediately, worth refreshing both
    } finally {
      setApprovalActionLoading(false)
    }
  }

  const rejectIds = async (ids: string[]) => {
    if (!campaign || ids.length === 0) return
    setApprovalActionLoading(true)
    try {
      await connectionOutreachApi.rejectSend(campaign.id, ids)
      setSelectedApprovalIds((prev) => {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      })
      loadPendingApprovals()
    } finally {
      setApprovalActionLoading(false)
    }
  }

  const startEditApproval = (id: string, currentText: string) => {
    setEditingApprovalId(id)
    setEditDraftText(currentText)
  }

  const saveEditApproval = async () => {
    if (!campaign || !editingApprovalId || !editDraftText.trim()) return
    setEditSaving(true)
    try {
      await connectionOutreachApi.editPendingApproval(campaign.id, editingApprovalId, editDraftText.trim())
      // Update locally instead of a full refetch -- approveSend below
      // reads whatever's in this local state's message_text, and a
      // refetch here would just be redundant since we already know the
      // new value (we just wrote it).
      setPendingApprovals((prev) =>
        prev.map((p) => (p.outreach_message_id === editingApprovalId ? { ...p, message_text: editDraftText.trim() } : p))
      )
      setEditingApprovalId(null)
    } finally {
      setEditSaving(false)
    }
  }

  if (!campaign) return null

  if (loading) {
    return (
      <div>
        <Header title={campaign.name} subtitle="Connection Outreach" />
        <div className="p-4 md:p-6">
          <p className="text-sm text-gray-400">Loading…</p>
        </div>
      </div>
    )
  }

  const isPaused = status?.status === 'paused'
  const replyRatePct = status && status.reply_rate.sent > 0
    ? Math.round((status.reply_rate.replied / status.reply_rate.sent) * 100)
    : null

  // "90-180s" style formatting for the gap range, and a rough "up to
  // X min" for the recent-activity extra on top of it.
  const gapMinLabel = status ? formatSeconds(status.sending_limits.message_gap_min_seconds) : null
  const gapMaxLabel = status ? formatSeconds(status.sending_limits.message_gap_max_seconds) : null
  const activityExtraLabel = status ? formatSeconds(status.sending_limits.recent_activity_extra_max_seconds) : null

  return (
    <div>
      <Header
        title={campaign.name}
        subtitle="Connection Outreach"
        action={
          <button
            type="button"
            disabled={pauseLoading}
            onClick={togglePause}
            className={`px-3 py-1.5 text-sm rounded-md disabled:opacity-50 ${
              isPaused ? 'bg-green-600 text-white' : 'border border-gray-300 text-gray-700'
            }`}
          >
            {pauseLoading ? '…' : isPaused ? 'Resume' : 'Pause'}
          </button>
        }
      />
      <div className="p-4 md:p-6 max-w-4xl space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            isPaused ? 'bg-amber-100 text-amber-700' : status?.status === 'running' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {status?.status}
          </span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">{status?.supervised_mode ? 'Supervised - replies wait for your approval' : 'Autopilot'}</span>
        </div>

        {/* Pending initial-send approvals -- only ever non-empty for the
            narrow case (recent_activity_enabled actually generated fresh,
            per-person content on a supervised campaign). Sending is
            immediate on approve, not a requeue -- personalization already
            happened, there's nothing left to regenerate. */}
        {pendingApprovals.length > 0 && (
          <div className="rounded-md border border-violet-300 bg-violet-50 overflow-hidden">
            <div className="p-3 border-b border-violet-200 flex items-center justify-between">
              <p className="text-sm font-medium text-violet-800">
                {pendingApprovals.length} message{pendingApprovals.length === 1 ? '' : 's'} waiting to send
              </p>
              {selectedApprovalIds.size > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={approvalActionLoading}
                    onClick={() => approveIds(Array.from(selectedApprovalIds))}
                    className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                  >
                    {approvalActionLoading ? '…' : `Approve & send ${selectedApprovalIds.size}`}
                  </button>
                  <button
                    type="button"
                    disabled={approvalActionLoading}
                    onClick={() => rejectIds(Array.from(selectedApprovalIds))}
                    className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 rounded disabled:opacity-50"
                  >
                    Skip {selectedApprovalIds.size}
                  </button>
                </div>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-violet-100">
              {pendingApprovals.map((p) => {
                const isEditing = editingApprovalId === p.outreach_message_id
                return (
                  <div key={p.outreach_message_id} className="flex items-start gap-3 p-3 text-sm hover:bg-violet-100/50">
                    <input
                      type="checkbox"
                      checked={selectedApprovalIds.has(p.outreach_message_id)}
                      onChange={() => toggleApprovalSelected(p.outreach_message_id)}
                      disabled={isEditing}
                      className="mt-1 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{p.name || 'Unknown'}</p>
                      {p.headline && <p className="text-xs text-gray-500 truncate">{p.headline}</p>}

                      {isEditing ? (
                        <>
                          <textarea
                            value={editDraftText}
                            onChange={(e) => setEditDraftText(e.target.value)}
                            rows={3}
                            className="w-full mt-2 rounded border border-violet-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-violet-400"
                            autoFocus
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              disabled={editSaving || !editDraftText.trim()}
                              onClick={saveEditApproval}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                            >
                              {editSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              disabled={editSaving}
                              onClick={() => setEditingApprovalId(null)}
                              className="px-2 py-1 text-xs border border-gray-300 text-gray-600 rounded disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-gray-700 mt-1">{p.message_text}</p>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              disabled={approvalActionLoading}
                              onClick={() => approveIds([p.outreach_message_id])}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                            >
                              Approve &amp; send
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditApproval(p.outreach_message_id, p.message_text || '')}
                              className="px-2 py-1 text-xs border border-violet-300 text-violet-700 hover:bg-violet-100 rounded"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={approvalActionLoading}
                              onClick={() => rejectIds([p.outreach_message_id])}
                              className="px-2 py-1 text-xs border border-gray-300 text-gray-600 rounded disabled:opacity-50"
                            >
                              Skip
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Sends */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Sends</p>
          <div className="grid grid-cols-4 gap-3">
            <StatBox label="Queued" value={status?.queued ?? 0} />
            <StatBox label="Sent" value={status?.sent ?? 0} />
            {status && status.pending_approval > 0 && <StatBox label="Awaiting approval" value={status.pending_approval} highlight />}
            {status && status.failed > 0 && <StatBox label="Failed" value={status.failed} danger />}
          </div>
        </div>

        {/* Replies -- the pipeline that was previously invisible */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Replies</p>
          <div className="grid grid-cols-4 gap-3">
            <StatBox
              label="Reply rate"
              value={replyRatePct !== null ? `${replyRatePct}%` : '-'}
              sub={status ? `${status.reply_rate.replied}/${status.reply_rate.sent}` : undefined}
            />
            {status && status.reply_pipeline.pending_classification > 0 && (
              <StatBox label="Waiting (debounce)" value={status.reply_pipeline.pending_classification} />
            )}
            {status && status.reply_pipeline.autopilot_scheduled > 0 && (
              <StatBox label="Scheduled to send" value={status.reply_pipeline.autopilot_scheduled} />
            )}
            {status && (status.reply_pipeline.pending_review + status.reply_pipeline.held_for_review) > 0 && (
              <StatBox
                label="Needs your review"
                value={status.reply_pipeline.pending_review + status.reply_pipeline.held_for_review}
                highlight
              />
            )}
          </div>
        </div>

        {status && status.queued > 0 && status.next_send_at && (
          <div className="rounded-md border bg-blue-50 border-blue-200 p-3 text-sm text-blue-800">
            Next message sends around {new Date(status.next_send_at).toLocaleString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })} CT
            {isPaused && ' - paused, won\u2019t send until resumed'}
          </div>
        )}

        {/* Sending limits & timing -- non-editable as of now. Real
            enforced values straight from the backend, not a second
            hardcoded copy on this side that could drift. */}
        {status && (
          <div className="rounded-md border p-4">
            <p className="text-sm font-medium mb-3">Sending limits &amp; timing</p>
            <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
              <div>
                <dt className="text-xs text-gray-500">Daily limit</dt>
                <dd className="text-gray-900">
                  {status.sending_limits.daily_send_limit}/day
                  <span className="text-xs text-gray-400"> ({status.sending_limits.daily_send_limit_scope}-wide, shared across all campaigns)</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Gap between messages</dt>
                <dd className="text-gray-900">
                  {gapMinLabel}–{gapMaxLabel}
                  {status.sending_limits.recent_activity_enabled && (
                    <span className="text-xs text-gray-400"> (up to +{activityExtraLabel} more with recent-activity personalization on)</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Send window</dt>
                <dd className="text-gray-900">
                  {schedule ? (
                    schedule.enabled ? (
                      <>
                        {schedule.window_start_local}–{schedule.window_end_local} CT
                        <span className="text-xs text-gray-400">
                          {' '}on {schedule.days_of_week.length === 5 && schedule.days_of_week.every((d) => d >= 1 && d <= 5)
                            ? 'weekdays'
                            : schedule.days_of_week.map((d) => DAY_LABELS[d]).join(', ')}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-400">No window restriction -- sends any time</span>
                    )
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Right now</dt>
                <dd className={schedule?.is_active_now ? 'text-green-700' : 'text-gray-500'}>
                  {schedule ? (schedule.is_active_now ? 'Within send window' : 'Outside send window -- queued sends wait') : '-'}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {/* Goal -- editable any time, reusing the exact same component
            from the creation wizard rather than building a second one. */}
        <div className="rounded-md border p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Goal</p>
            <button type="button" onClick={() => setGoalOpen((v) => !v)} className="text-sm text-blue-600 underline">
              {goalOpen ? 'Close' : 'Edit'}
            </button>
          </div>
          {!goalOpen && (
            <p className="text-sm text-gray-500 mt-2">
              {campaign.goal_type === 'specific' ? (campaign.goal_text || 'Specific goal, no description set') : campaign.goal_type === 'general' ? 'General conversation' : 'No goal set'}
            </p>
          )}
          {goalOpen && (
            <div className="mt-3 space-y-3">
              <GoalStep
                campaignId={campaign.id}
                goalType={goalType}
                goalText={goalText}
                factSheetName={factSheetName}
                onChange={(t, text) => {
                  setGoalType(t)
                  setGoalText(text)
                }}
                onFactSheetUploaded={setFactSheetName}
              />
              <button type="button" onClick={saveGoal} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md">
                Save
              </button>
            </div>
          )}
        </div>

        {/* Conversations -- reuses the same chat_id every message in a
            thread already carries; clicking one just deep-links into the
            same Messages/Inbox view instead of duplicating a chat UI here. */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Conversations</p>
          {status && status.conversations.length === 0 ? (
            <p className="text-sm text-gray-400">Nothing sent yet.</p>
          ) : (
            <div className="rounded-md border divide-y">
              {status?.conversations.map((c) => (
                <button
                  key={c.chat_id}
                  onClick={() => router.push(`/messages?chat_id=${c.chat_id}`)}
                  className={`w-full text-left p-3 hover:bg-gray-50 flex items-center justify-between border-l-4 ${
                    c.needs_review ? 'border-l-amber-400 bg-amber-50' : 'border-l-transparent'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{c.sender_name || 'Unknown'}</p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {c.needs_review && (
                          <span className="px-1.5 h-[18px] rounded-full bg-amber-100 text-amber-700 text-[10px] flex items-center justify-center font-medium">
                            Review
                          </span>
                        )}
                        <span className="text-[11px] text-gray-400">{formatSidebarTimestamp(c.last_message_at)}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{c.last_message}</p>
                  </div>
                  <span className="text-xs text-blue-600 flex-shrink-0 ml-2">Open →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatSeconds(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.round(totalSeconds / 60)
  return `${minutes}min`
}

function StatBox({ label, value, sub, highlight, danger }: { label: string; value: number | string; sub?: string; highlight?: boolean; danger?: boolean }) {
  return (
    <div className={`rounded-md border p-4 text-center ${highlight ? 'bg-amber-50 border-amber-200' : danger ? 'bg-red-50 border-red-200' : ''}`}>
      <p className={`text-2xl font-semibold ${danger ? 'text-red-700' : highlight ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  )
}
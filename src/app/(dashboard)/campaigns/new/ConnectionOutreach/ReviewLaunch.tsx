'use client'

import { useState, useEffect } from 'react'
import { connectionOutreachApi, campaignsApi } from '@/lib/api'

const DAYS = [
  { value: 0, label: 'Sun' }, { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' }, { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' },
]

interface Props {
  campaignId: string
  matchedCount: number
  selectionMode: 'all_matched' | 'include_list' | 'exclude_list'
  selectedCount: number
  messageText: string
  recentActivityEnabled: boolean
  onLaunched: () => void
}

export default function ReviewLaunch({ campaignId, matchedCount, selectionMode, selectedCount, messageText, recentActivityEnabled, onLaunched }: Props) {
  // Real fix for the 137-vs-20 bug: matchedCount alone is the raw
  // segment total, before "Fine-tune who's included" was ever applied.
  // This mirrors the EXACT arithmetic send_to_segment does server-side
  // (matched_ids intersected/subtracted by the saved selection), so what
  // this screen promises matches what actually gets queued.
  const targetCount =
    selectionMode === 'include_list' ? selectedCount :
    selectionMode === 'exclude_list' ? Math.max(matchedCount - selectedCount, 0) :
    matchedCount

  // Defaults to autopilot (false = not supervised) for this mode
  // specifically -- confirmed explicitly, opposite of Fulltime/C2C's
  // default. This is a flat, reversible toggle here and later on the
  // campaign page, not the one-way graduation gate Fulltime/C2C use --
  // see connection-outreach-design.md 2.7.
  const [supervised, setSupervised] = useState(false)

  // Schedule -- same campaign_schedules table and is_within_schedule_window
  // check Fulltime/C2C already use, CST only, no second system built for
  // this. Defaults match that table's own defaults (all 7 days, 9-6).
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5])
  const [windowStart, setWindowStart] = useState('09:00')
  const [windowEnd, setWindowEnd] = useState('18:00')

  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ drafted: number; queued: number; skipped: number; daily_limit_reached: number; errored: number } | null>(null)

  useEffect(() => {
    campaignsApi.getSchedule(campaignId).then((s) => {
      if (!s) return
      setScheduleEnabled(s.enabled)
      setDaysOfWeek(s.days_of_week)
      setWindowStart(s.window_start_local)
      setWindowEnd(s.window_end_local)
    }).catch(() => {
      // no schedule row yet -- defaults above stand, matches how
      // is_within_schedule_window treats a missing row as always-open
    })
  }, [campaignId])

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))
  }

  const launch = async () => {
    setLaunching(true)
    setError(null)
    try {
      await connectionOutreachApi.updateSupervisedMode(campaignId, supervised)
      await campaignsApi.updateSchedule(campaignId, {
        enabled: scheduleEnabled, days_of_week: daysOfWeek,
        window_start_local: windowStart, window_end_local: windowEnd,
      })
      const res = await connectionOutreachApi.send(campaignId, { message_text: messageText })
      setResult(res)
      const nothingHappened = res.queued === 0 && res.drafted === 0
      if (!nothingHappened) {
        onLaunched()
      }
      // If nothing happened, stay on this screen with the zero counts
      // visible instead of redirecting into a campaign page that would
      // just show the same nothing with less context about why.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Launch failed')
    } finally {
      setLaunching(false)
    }
  }

  if (result) {
    const nothingHappened = result.queued === 0 && result.drafted === 0
    if (nothingHappened) {
      return (
        <div className="rounded-md border bg-red-50 border-red-200 p-4 text-sm space-y-1">
          <p className="font-medium text-red-800">Nothing was sent</p>
          <p className="text-red-700">
            {result.skipped > 0 && `${result.skipped} of ${matchedCount} were skipped - missing LinkedIn provider info. `}
            {result.daily_limit_reached > 0 && `${result.daily_limit_reached} hit the 80/day limit. `}
            {result.errored > 0 && `${result.errored} hit an unexpected error - check the backend logs for details. `}
            {result.skipped === 0 && result.daily_limit_reached === 0 && result.errored === 0 && 'The send call returned successfully but queued nobody - check that your outreach LinkedIn account is actually connected under Settings.'}
          </p>
        </div>
      )
    }
    return (
      <div className="rounded-md border bg-green-50 border-green-200 p-4 text-sm space-y-1">
        <p className="font-medium text-green-800">Campaign launched</p>
        {result.queued > 0 && (
          <p>{result.queued} message{result.queued === 1 ? '' : 's'} queued - sending gradually{scheduleEnabled ? ', within your scheduled window' : ''}, not all at once</p>
        )}
        {result.drafted > 0 && <p>{result.drafted} drafted, waiting for your approval (supervised mode)</p>}
        {result.skipped > 0 && <p className="text-amber-700">{result.skipped} skipped - missing LinkedIn provider info</p>}
        {result.daily_limit_reached > 0 && (
          <p className="text-amber-700">{result.daily_limit_reached} not queued - 80/day limit reached for today. They&apos;ll need sending again tomorrow (re-launching isn&apos;t automatic yet).</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4 space-y-1 text-sm">
        <p><span className="font-medium">{targetCount}</span> connection{targetCount === 1 ? '' : 's'} will be messaged</p>
        <p className="text-gray-500 line-clamp-2">&quot;{messageText}&quot;</p>
      </div>

      <div className="rounded-md border p-4">
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={supervised} onChange={(e) => setSupervised(e.target.checked)} className="mt-0.5 rounded" />
          <span>
            <span className="text-sm font-medium block">Review before sending</span>
            <span className="text-xs text-gray-500">
              {supervised
                ? recentActivityEnabled
                  ? 'Personalized messages and every reply wait for your approval. Your initial message gets reworded per person before sending, so each one is reviewed first.'
                  : 'Your initial message is fixed, so it sends automatically as written above - only AI-drafted replies wait for your approval.'
                : 'Messages, follow-ups, and replies send automatically, gradually spaced out. You can switch this on any time from the campaign page.'}
            </span>
          </span>
        </label>
      </div>

      <div className="rounded-md border p-4 space-y-3">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={scheduleEnabled} onChange={(e) => setScheduleEnabled(e.target.checked)} className="rounded" />
          <span className="text-sm font-medium">Limit sending to specific days/hours</span>
        </label>
        <p className="text-xs text-gray-400">All times Central (CST/CDT). Off means sends can go out any day, any hour.</p>

        {scheduleEnabled && (
          <div className="space-y-2 pl-6">
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={`px-2.5 py-1 text-xs rounded-full border ${
                    daysOfWeek.includes(d.value) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <input type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} className="border rounded-md px-2 py-1 text-sm" />
              <span className="text-gray-400">to</span>
              <input type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} className="border rounded-md px-2 py-1 text-sm" />
              <span className="text-gray-400">CST</span>
            </div>
          </div>
        )}
      </div>

      {recentActivityEnabled && (
        <p className="text-xs text-gray-400">Recent-activity referencing is on - each send checks that person&apos;s profile first, adding up to 10 extra minutes of random delay per person.</p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        disabled={launching || targetCount === 0 || !messageText.trim()}
        onClick={launch}
        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md disabled:opacity-50"
      >
        {launching ? 'Launching…' : 'Launch campaign'}
      </button>
    </div>
  )
}
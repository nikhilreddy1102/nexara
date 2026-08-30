'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { campaignsApi, connectionOutreachApi } from '@/lib/api'
import SegmentFilterStep from './ConnectionOutreach/SegmentFilterStep'
import GoalStep from './ConnectionOutreach/GoalStep'
import MessageStep from './ConnectionOutreach/MessageStep'
import ReviewLaunch from './ConnectionOutreach/ReviewLaunch'
import type { SegmentFilter } from '@/types'

const EMPTY_FILTER: SegmentFilter = { role_categories: [], open_to_work: null, exclude: false, exclude_contacted: false }

interface Props {
  onExit: () => void   // called if the person backs out to mode selection
}

export default function ConnectionOutreachWizard({ onExit }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [filter, setFilter] = useState<SegmentFilter>(EMPTY_FILTER)
  const [selectionMode, setSelectionMode] = useState<'all_matched' | 'include_list' | 'exclude_list'>('all_matched')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [goalType, setGoalType] = useState<'specific' | 'general' | null>(null)
  const [goalText, setGoalText] = useState('')
  const [factSheetName, setFactSheetName] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [personalizationEnabled, setPersonalizationEnabled] = useState(true)
  const [recentActivityEnabled, setRecentActivityEnabled] = useState(true)   // on by default, per spec
  const [matchedCount, setMatchedCount] = useState(0)

  // The campaign gets CREATED at the end of step 1 (segment chosen), not
  // at the end of the wizard -- goal/message steps need a real campaign_id
  // to call their endpoints against (fact sheet upload, message generation).
  const createCampaign = async () => {
    setCreating(true)
    setError(null)
    try {
      const campaign = await campaignsApi.create({
        name,
        mode: 'connection_outreach',   // never 'custom' -- see campaigns.py's CreateCampaignRequest
        connection_segment_filter: filter,
        connection_selection_mode: selectionMode,
        personalization_enabled: personalizationEnabled,
        recent_activity_enabled: recentActivityEnabled,
      })
      setCampaignId(campaign.id)
      if (selectionMode !== 'all_matched' && selectedIds.length) {
        await connectionOutreachApi.updateSelection(campaign.id, { mode: selectionMode, connection_ids: selectedIds })
      }
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create campaign')
    } finally {
      setCreating(false)
    }
  }

  const saveGoal = async () => {
    if (!campaignId || !goalType) return
    setError(null)
    try {
      await connectionOutreachApi.updateGoal(campaignId, { goal_type: goalType, goal_text: goalText })
      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save goal')
    }
  }

  // Toggles can change after creation too (this step re-syncs both any
  // time Continue is pressed, in case they were flipped after the
  // initial create call).
  const proceedFromMessage = async () => {
    if (!campaignId) return
    try {
      await Promise.all([
        connectionOutreachApi.updatePersonalization(campaignId, personalizationEnabled),
        connectionOutreachApi.updateRecentActivity(campaignId, recentActivityEnabled),
      ])
    } catch {
      // non-fatal -- creation already set the initial values; a failed
      // resync here just means a toggle flip after creation didn't stick,
      // not a broken campaign
    }
    setStep(4)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-gray-400">
        {['Name', 'Segment', 'Goal', 'Message', 'Review'].map((label, i) => (
          <span key={label} className={i === step ? 'text-gray-900 font-medium' : ''}>
            {i > 0 && <span className="mx-1">→</span>}
            {label}
          </span>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Campaign name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q3 Recruiter Outreach"
              className="w-full text-sm border rounded-md p-2"
            />
          </div>
          <div className="flex justify-between">
            <button type="button" onClick={onExit} className="px-3 py-2 text-sm text-gray-500">
              ← Back to campaign type
            </button>
            <button
              type="button"
              disabled={!name.trim()}
              onClick={() => setStep(1)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md disabled:opacity-50"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <SegmentFilterStep
            value={filter}
            onChange={(f) => setFilter(f)}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onSelectionChange={(m, ids) => {
              setSelectionMode(m)
              setSelectedIds(ids)
            }}
            onCountChange={setMatchedCount}
          />
          <button
            type="button"
            disabled={creating}
            onClick={createCampaign}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Continue →'}
          </button>
        </div>
      )}

      {step === 2 && campaignId && (
        <div className="space-y-4">
          <GoalStep
            campaignId={campaignId}
            goalType={goalType}
            goalText={goalText}
            factSheetName={factSheetName}
            onChange={(t, text) => {
              setGoalType(t)
              setGoalText(text)
            }}
            onFactSheetUploaded={setFactSheetName}
          />
          <button
            type="button"
            disabled={!goalType}
            onClick={saveGoal}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md disabled:opacity-50"
          >
            Continue →
          </button>
        </div>
      )}

      {step === 3 && campaignId && (
        <div className="space-y-4">
          <MessageStep
            campaignId={campaignId}
            messageText={messageText}
            personalizationEnabled={personalizationEnabled}
            recentActivityEnabled={recentActivityEnabled}
            onMessageChange={setMessageText}
            onPersonalizationChange={setPersonalizationEnabled}
            onRecentActivityChange={setRecentActivityEnabled}
          />
          <button
            type="button"
            disabled={!messageText.trim()}
            onClick={proceedFromMessage}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md disabled:opacity-50"
          >
            Continue →
          </button>
        </div>
      )}

      {step === 4 && campaignId && (
        <ReviewLaunch
          campaignId={campaignId}
          matchedCount={matchedCount}
          selectionMode={selectionMode}
          selectedCount={selectedIds.length}
          messageText={messageText}
          recentActivityEnabled={recentActivityEnabled}
          onLaunched={() => router.push(`/campaigns/${campaignId}`)}
        />
      )}
    </div>
  )
}
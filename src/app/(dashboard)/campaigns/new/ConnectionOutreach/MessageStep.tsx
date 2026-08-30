'use client'

import { useState } from 'react'
import { connectionOutreachApi } from '@/lib/api'

interface Props {
  campaignId: string   // this step only renders once the campaign exists --
                         // generation needs a real campaign_id to call
  messageText: string
  personalizationEnabled: boolean
  recentActivityEnabled: boolean
  onMessageChange: (text: string) => void
  onPersonalizationChange: (enabled: boolean) => void
  onRecentActivityChange: (enabled: boolean) => void
}

export default function MessageStep({
  campaignId, messageText, personalizationEnabled, recentActivityEnabled,
  onMessageChange, onPersonalizationChange, onRecentActivityChange,
}: Props) {
  const [instruction, setInstruction] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async (regenerate: boolean) => {
    if (!instruction.trim()) return
    setGenerating(true)
    setError(null)
    try {
      const result = regenerate
        ? await connectionOutreachApi.regenerateMessage(campaignId, instruction)
        : await connectionOutreachApi.generateMessage(campaignId, instruction)
      onMessageChange(result.draft)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-2">Describe the message you want</p>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. 'Friendly, mention I saw their recent post about hiring, ask if they're open to a quick call.'"
          rows={2}
          className="w-full text-sm border rounded-md p-2"
        />
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            disabled={generating || !instruction.trim()}
            onClick={() => generate(false)}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md disabled:opacity-50"
          >
            {generating ? 'Generating…' : 'Generate'}
          </button>
          {messageText && (
            <button
              type="button"
              disabled={generating}
              onClick={() => generate(true)}
              className="px-3 py-2 text-sm border rounded-md disabled:opacity-50"
            >
              Regenerate
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>

      {messageText && (
        <div>
          <p className="text-sm font-medium mb-2">Message</p>
          <textarea
            value={messageText}
            onChange={(e) => onMessageChange(e.target.value)}
            rows={4}
            className="w-full text-sm border rounded-md p-2"
          />
          {messageText.includes('{first_name}') && (
            <p className="text-xs text-gray-400 mt-1">{'{first_name}'} gets replaced with each person&apos;s real first name when it sends - that&apos;s expected, not a typo.</p>
          )}
        </div>
      )}

      {/* Two separate toggles -- not one combined checkbox. They cost
          different things: name substitution is free (already in your
          connections list), recent-activity referencing needs a live
          LinkedIn lookup for each person right before their message goes
          out, which is why it also adds extra pacing delay when it's on. */}
      <div className="space-y-2 pt-2 border-t">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={personalizationEnabled}
            onChange={(e) => onPersonalizationChange(e.target.checked)}
            className="rounded"
          />
          Personalize with recipient&apos;s name
          <span className="text-xs text-gray-400">(free - on by default)</span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={recentActivityEnabled}
            onChange={(e) => onRecentActivityChange(e.target.checked)}
            className="rounded"
          />
          Reference recent activity
          <span className="text-xs text-gray-400">(on by default)</span>
        </label>
        {recentActivityEnabled && (
          <p className="text-xs text-gray-500 pl-6">
            Checks each person&apos;s LinkedIn profile right before their message sends - adds up to 10 extra minutes of random delay per person on top of normal pacing, since that lookup takes real time too.
          </p>
        )}
      </div>
    </div>
  )
}
'use client'

import { useState, useRef } from 'react'
import { connectionOutreachApi } from '@/lib/api'

interface Props {
  campaignId?: string   // undefined during creation (nothing to PATCH yet) --
                          // in that case onChange just updates local wizard
                          // state, and the actual API calls happen at launch.
  goalType: 'specific' | 'general' | null
  goalText: string
  factSheetName: string | null
  onChange: (goalType: 'specific' | 'general', goalText: string) => void
  onFactSheetUploaded: (filename: string) => void
}

export default function GoalStep({ campaignId, goalType, goalText, factSheetName, onChange, onFactSheetUploaded }: Props) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!campaignId) {
      // Creation flow: stash the file, upload happens once the campaign
      // actually exists (see ReviewLaunch.tsx). Here we just confirm the
      // pick to the user.
      onFactSheetUploaded(file.name)
      return
    }
    setUploading(true)
    setError(null)
    try {
      const result = await connectionOutreachApi.uploadFactSheet(campaignId, file)
      onFactSheetUploaded(result.filename)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">What&apos;s this campaign for?</p>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange('specific', goalText)}
          className={`text-left p-4 rounded-md border-2 transition-colors ${
            goalType === 'specific' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <p className="font-medium text-sm">Specific goal</p>
          <p className="text-xs text-gray-500 mt-1">Attach a product/fact sheet. Replies get answered strictly from it, and follow-ups run automatically.</p>
        </button>
        <button
          type="button"
          onClick={() => onChange('general', '')}
          className={`text-left p-4 rounded-md border-2 transition-colors ${
            goalType === 'general' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <p className="font-medium text-sm">General conversation</p>
          <p className="text-xs text-gray-500 mt-1">No fact sheet, no automatic follow-ups. Just open conversation.</p>
        </button>
      </div>

      {goalType === 'specific' && (
        <div className="space-y-3">
          <textarea
            value={goalText}
            onChange={(e) => onChange('specific', e.target.value)}
            placeholder="What's the goal? e.g. 'Book a 15-minute intro call about our HR automation product.'"
            rows={2}
            className="w-full text-sm border rounded-md p-2"
          />
          <div>
            <input ref={fileInput} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
              className="px-3 py-2 text-sm border rounded-md disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : factSheetName ? `Replace fact sheet (${factSheetName})` : 'Attach fact sheet'}
            </button>
            {!factSheetName && <p className="text-xs text-amber-700 mt-2">Follow-ups won&apos;t activate until a fact sheet is attached.</p>}
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          </div>
        </div>
      )}

      {goalType === 'general' && (
        <textarea
          value={goalText}
          onChange={(e) => onChange('general', e.target.value)}
          placeholder="Optional context for the opening message, e.g. 'Reconnecting with past colleagues.'"
          rows={2}
          className="w-full text-sm border rounded-md p-2"
        />
      )}

      <p className="text-xs text-gray-400">The goal and fact sheet can be changed any time after launch, from the campaign page.</p>
    </div>
  )
}
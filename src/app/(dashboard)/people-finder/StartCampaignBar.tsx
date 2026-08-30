'use client'

import { useState } from 'react'
import { X, Loader2, Check } from 'lucide-react'

function authHeaders() {
  const token = localStorage.getItem('nexara_token')
  return { Authorization: `Bearer ${token ?? ''}` }
}

type Step =
  | { kind: 'bar' }
  | { kind: 'naming'; name: string }
  | { kind: 'creating' }
  | { kind: 'done'; campaignId: string; added: number; skipped: { id: string; name: string; reason: string }[] }
  | { kind: 'error'; message: string }

interface Props {
  selectedIds: string[]
  onClear: () => void
  verifyHiring?: boolean
}

/**
 * Appears only when at least one result is selected. Confirms a campaign
 * name, calls /start-campaign, then shows exactly who got added vs
 * skipped (and why) -- skipped people are already mid-conversation, per
 * the confirmed rule, not a silent failure.
 */
export default function StartCampaignBar({ selectedIds, onClear, verifyHiring = false }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'bar' })

  if (selectedIds.length === 0 && step.kind !== 'done') return null

  const create = async () => {
    if (step.kind !== 'naming' || !step.name.trim()) return
    setStep({ kind: 'creating' })
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/discovery-test/start-campaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name: step.name.trim(), result_ids: selectedIds, verify_hiring: verifyHiring }),
      })
      const body = await res.json()
      if (!res.ok) {
        setStep({ kind: 'error', message: body?.detail ?? 'Failed to create campaign' })
        return
      }
      if (!body.success) {
        setStep({ kind: 'error', message: body.message ?? 'Everyone selected is already in an active conversation' })
        return
      }
      setStep({ kind: 'done', campaignId: body.campaign_id, added: body.added, skipped: body.skipped ?? [] })
      onClear()
    } catch (e) {
      setStep({ kind: 'error', message: e instanceof Error ? e.message : 'Network error' })
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white border border-gray-200 shadow-lg rounded-xl p-4 w-full max-w-md">
      {step.kind === 'bar' && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-700">
            <span className="font-medium text-gray-900">{selectedIds.length}</span> selected
          </p>
          <div className="flex gap-2">
            <button onClick={onClear} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              Clear
            </button>
            <button onClick={() => setStep({ kind: 'naming', name: '' })} className="text-xs px-3 py-1.5 rounded-lg bg-brand text-white hover:opacity-90">
              Start Campaign
            </button>
          </div>
        </div>
      )}

      {step.kind === 'naming' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">Name this campaign</p>
            <button onClick={() => setStep({ kind: 'bar' })} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          <input
            autoFocus
            value={step.name}
            onChange={e => setStep({ kind: 'naming', name: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && create()}
            placeholder={`e.g. "QA outreach batch"`}
            className="input w-full text-sm"
          />
          <p className="text-[11px] text-gray-400">
            Anyone already mid-conversation (sent or replied) is skipped automatically - this only adds people you haven&apos;t reached out to yet.
          </p>
          <button onClick={create} disabled={!step.name.trim()} className="btn-primary w-full disabled:opacity-40">
            Create campaign with {selectedIds.length} people
          </button>
        </div>
      )}

      {step.kind === 'creating' && (
        <div className="py-4 text-center">
          <Loader2 size={20} className="animate-spin mx-auto text-brand mb-2" />
          <p className="text-xs text-gray-500">Creating campaign…</p>
        </div>
      )}

      {step.kind === 'done' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-green-600">
            <Check size={16} />
            <p className="text-sm font-medium">Campaign created - {step.added} people added</p>
          </div>
          {step.skipped.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-2">
              <p className="text-[11px] text-amber-700 font-medium mb-1">{step.skipped.length} skipped:</p>
              {step.skipped.map(s => (
                <p key={s.id} className="text-[11px] text-amber-600">{s.name} - {s.reason}</p>
              ))}
            </div>
          )}
          <a href={`/campaigns/${step.campaignId}`} className="btn-primary w-full text-center block">
            View campaign
          </a>
        </div>
      )}

      {step.kind === 'error' && (
        <div className="space-y-2">
          <p className="text-xs text-red-500">⚠ {step.message}</p>
          <button onClick={() => setStep({ kind: 'bar' })} className="btn-secondary w-full text-xs">Back</button>
        </div>
      )}
    </div>
  )
}
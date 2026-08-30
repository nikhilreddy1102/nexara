'use client'

import { useState, useEffect, useCallback } from 'react'
import { connectionOutreachApi } from '@/lib/api'
import type { SegmentFilter } from '@/types'
import type { LinkedInConnection } from '@/lib/api'

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'hiring_manager', label: 'Hiring Manager' },
  { value: 'founder', label: 'Founder' },
]

interface Props {
  value: SegmentFilter
  onChange: (filter: SegmentFilter) => void
  selectionMode: 'all_matched' | 'include_list' | 'exclude_list'
  selectedIds: string[]
  onSelectionChange: (mode: 'all_matched' | 'include_list' | 'exclude_list', ids: string[]) => void
  onCountChange: (count: number) => void
}

export default function SegmentFilterStep({ value, onChange, selectionMode, selectedIds, onSelectionChange, onCountChange }: Props) {
  const [count, setCount] = useState<number | null>(null)
  const [sample, setSample] = useState<LinkedInConnection[]>([])
  const [loadingAll, setLoadingAll] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  // Real bug this fixes: the previous version's .catch(() => setCount(null))
  // reset to the SAME state as "hasn't loaded yet at all" -- a genuinely
  // failing request (bad backend deploy, auth issue, network error) was
  // indistinguishable from "nothing selected," both showing "Pick a filter
  // above to see how many connections match" forever with no way to tell
  // which one was actually happening.
  const [loadError, setLoadError] = useState<string | null>(null)

  // Debounced live count -- fires every time the filter actually changes,
  // including exclude_contacted now, same mechanism as every other
  // checkbox here (role_categories, open_to_work, exclude). Runs on
  // mount too, with the initial empty filter -- an empty segment
  // matches everyone on the backend (_apply_segment_filter leaves the
  // query unfiltered when role_categories is empty and open_to_work is
  // null), so this is what shows the full scrollable "everyone" list by
  // default, before any filter button is clicked.
  useEffect(() => {
    setLoading(true)
    setLoadError(null)
    const timeout = setTimeout(() => {
      connectionOutreachApi
        .segmentPreview(value)
        .then((res) => {
          setCount(res.count)
          setSample(res.sample)
          onCountChange(res.count)
        })
        .catch((e) => {
          setCount(null)
          setLoadError(e instanceof Error ? e.message : 'Failed to load your connections')
        })
        .finally(() => setLoading(false))
    }, 400)
    return () => clearTimeout(timeout)
  }, [value, onCountChange])

  const toggleRole = useCallback(
    (role: string) => {
      const has = value.role_categories.includes(role)
      onChange({
        ...value,
        role_categories: has ? value.role_categories.filter((r) => r !== role) : [...value.role_categories, role],
        open_to_work: null,
      })
    },
    [value, onChange]
  )

  const toggleOpenToWork = useCallback(() => {
    onChange({
      ...value,
      role_categories: [],
      open_to_work: value.open_to_work ? null : true,
    })
  }, [value, onChange])

  const toggleExclude = useCallback(() => {
    onChange({ ...value, exclude: !value.exclude })
  }, [value, onChange])

  // NEW -- independent of role_categories/open_to_work/exclude, so it
  // stays available (and useful on its own -- "just show me everyone
  // fresh") regardless of what else is selected above.
  const toggleExcludeContacted = useCallback(() => {
    onChange({ ...value, exclude_contacted: !value.exclude_contacted })
  }, [value, onChange])

  // View all -- lives HERE, not inside PeoplePicker, since count/value/
  // connectionOutreachApi only exist in this component's scope. Passed
  // down to the child as a plain callback + two values instead.
  const loadAll = useCallback(async () => {
    if (count === null) return
    setLoadingAll(true)
    try {
      const res = await connectionOutreachApi.segmentPreview(value, count)
      setSample(res.sample)
    } finally {
      setLoadingAll(false)
    }
  }, [value, count])

  const hasRoleSelection = value.role_categories.length > 0
  const hasOpenToWork = value.open_to_work === true

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-2">Who do you want to reach?</p>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={hasOpenToWork}
              onClick={() => toggleRole(opt.value)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                value.role_categories.includes(opt.value)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            disabled={hasRoleSelection}
            onClick={toggleOpenToWork}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              hasOpenToWork ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            }`}
          >
            Open to Work
          </button>
        </div>
        {(hasRoleSelection || hasOpenToWork) && (
          <label className="flex items-center gap-2 mt-3 text-sm text-gray-600">
            <input type="checkbox" checked={value.exclude} onChange={toggleExclude} className="rounded" />
            Exclude these people instead of including them
          </label>
        )}
        {/* Always visible, independent of role/open-to-work -- unlike the
            invert-exclude checkbox above, this is a standalone filter that
            makes sense even with nothing else selected ("just show me
            people I haven't reached out to yet"). */}
        <label className="flex items-center gap-2 mt-3 text-sm text-gray-600">
          <input type="checkbox" checked={value.exclude_contacted} onChange={toggleExcludeContacted} className="rounded" />
          Exclude people already contacted in any campaign
        </label>
      </div>

      <div className="rounded-md border bg-gray-50 p-4">
        {loading ? (
          <p className="text-sm text-gray-500">Checking your connections…</p>
        ) : loadError ? (
          <p className="text-sm text-red-600">Couldn&apos;t load your connections: {loadError}</p>
        ) : count === null ? (
          <p className="text-sm text-gray-500">Loading your connections…</p>
        ) : count === 0 ? (
          <p className="text-sm text-amber-700">No connections match this combination yet.</p>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm">
              <span className="font-semibold">{count}</span> connection{count === 1 ? '' : 's'} match
              {value.exclude ? ' (after exclusions)' : ''}
              {value.exclude_contacted ? ', not yet contacted' : ''}
            </p>
            <button type="button" onClick={() => setPickerOpen((v) => !v)} className="text-sm text-blue-600 underline">
              {pickerOpen ? 'Hide list' : 'Fine-tune who\u2019s included'}
            </button>
          </div>
        )}
      </div>

      {pickerOpen && count !== null && count > 0 && (
        <PeoplePicker
          sample={sample}
          count={count}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
          loadingAll={loadingAll}
          onLoadAll={loadAll}
        />
      )}
    </div>
  )
}

function PeoplePicker({
  sample,
  count,
  selectionMode,
  selectedIds,
  onSelectionChange,
  loadingAll,
  onLoadAll,
}: {
  sample: LinkedInConnection[]
  count: number
  selectionMode: 'all_matched' | 'include_list' | 'exclude_list'
  selectedIds: string[]
  onSelectionChange: (mode: 'all_matched' | 'include_list' | 'exclude_list', ids: string[]) => void
  loadingAll: boolean
  onLoadAll: () => void
}) {
  const toggle = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]
    onSelectionChange(selectionMode === 'all_matched' ? 'include_list' : selectionMode, next)
  }

  return (
    <div className="rounded-md border">
      <div className="flex items-center gap-4 p-3 border-b text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={selectionMode !== 'exclude_list'}
            onChange={() => onSelectionChange('include_list', selectedIds)}
          />
          Include only checked people
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={selectionMode === 'exclude_list'}
            onChange={() => onSelectionChange('exclude_list', selectedIds)}
          />
          Exclude checked people
        </label>
      </div>
      <div className="max-h-64 overflow-y-auto divide-y">
        {sample.map((c) => (
          <label key={c.id} className="flex items-center gap-3 p-3 text-sm hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggle(c.id)} />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{c.name || 'Unnamed'}</p>
              <p className="text-gray-500 truncate">{c.headline}</p>
            </div>
            {c.role_category && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c.role_category}</span>
            )}
          </label>
        ))}
      </div>
      <p className="p-2 text-xs text-gray-400 border-t flex items-center justify-between">
        <span>Showing {sample.length} of {count} matches. Selection applies campaign-wide, not just to this preview list.</span>
        {sample.length < count && (
          <button
            type="button"
            disabled={loadingAll}
            onClick={onLoadAll}
            className="text-blue-600 underline disabled:opacity-50 flex-shrink-0 ml-2"
          >
            {loadingAll ? 'Loading…' : `View all ${count}`}
          </button>
        )}
      </p>
    </div>
  )
}
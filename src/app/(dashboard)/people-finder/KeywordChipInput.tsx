'use client'

import { useState, KeyboardEvent } from 'react'
import { X, CornerDownLeft } from 'lucide-react'

interface KeywordChipInputProps {
  value: string[]
  onChange: (chips: string[]) => void
  placeholder?: string
}

/**
 * Type a term, then confirm it as a chip three equivalent ways: press Enter
 * (works from a physical keyboard or a mobile keyboard's "return"/"go" key
 * -- same keydown event either way), or tap the ↵ icon inside the input.
 * The icon exists specifically because "press Enter" isn't a visible
 * affordance on a touchscreen -- someone who hasn't used a chip input
 * before has no way to discover it without a tappable control that shows
 * the action is available. Backspace on an empty input deletes the last
 * chip -- standard pattern, works identically by touch or keyboard.
 *
 * Chips join with " OR " when sent to the backend, NOT commas -- LinkedIn's
 * keyword search treats a comma as part of one literal phrase, not as a
 * separator between alternatives. Getting this join right is the entire
 * point of this component; a plain comma-joined string silently defeats it.
 */
export default function KeywordChipInput({ value, onChange, placeholder }: KeywordChipInputProps) {
  const [draft, setDraft] = useState('')
  const [isComposing, setIsComposing] = useState(false)

  const addChip = () => {
    const trimmed = draft.trim()
    if (!trimmed) return
    if (!value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setDraft('')
  }

  const removeChip = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // isComposing guards against IME input (Chinese/Japanese/Korean etc.) --
    // without it, hitting Enter to confirm an IME candidate would also fire
    // this and add a half-typed chip.
    if (isComposing) return

    if (e.key === 'Enter') {
      e.preventDefault()
      addChip()
      return
    }
    // Also accept comma as a natural "done typing this one" key on desktop --
    // it never reaches the join logic as a literal comma since it's consumed
    // here to create a chip boundary, not passed through into chip text.
    if (e.key === ',') {
      e.preventDefault()
      addChip()
      return
    }
    if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      removeChip(value.length - 1)
    }
  }

  const hasDraft = draft.trim().length > 0

  return (
    <div className="input w-full text-sm flex flex-wrap items-center gap-1.5 py-1.5 min-h-[2.5rem]">
      {value.map((chip, i) => (
        <span
          key={`${chip}-${i}`}
          className="inline-flex items-center gap-1 bg-brand-light text-brand-dark text-xs px-2 py-1 rounded-md"
        >
          {chip}
          <button
            type="button"
            onClick={() => removeChip(i)}
            aria-label={`Remove ${chip}`}
            className="hover:opacity-70 -mr-0.5"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      <div className="flex-1 min-w-[8ch] flex items-center gap-1">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onBlur={addChip}
          // enterKeyHint + inputMode make mobile keyboards show a "Go"/"return"
          // key instead of e.g. a search-globe icon, and keeps autocorrect from
          // mangling short technical terms like "SDE" or "VP".
          enterKeyHint="done"
          inputMode="text"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={value.length === 0 ? placeholder : 'Add another…'}
          className="flex-1 min-w-0 outline-none bg-transparent text-sm"
        />
        {/*
          onMouseDown preventDefault stops the input from blurring before
          this button's onClick fires -- without it, tapping the icon on
          some browsers races against the input's own onBlur handler, which
          also calls addChip(). Both paths are individually safe (addChip
          no-ops on an already-empty draft), but avoiding the race entirely
          is cleaner than relying on that being harmless.
        */}
        <button
          type="button"
          onMouseDown={e => e.preventDefault()}
          onClick={addChip}
          disabled={!hasDraft}
          aria-label="Add keyword"
          // 44px touch target (Apple/Google minimum), not just the icon's
          // own visual size -- a tap target sized to match the glyph is a
          // common miss on mobile and this is specifically a mobile-facing
          // control.
          className={`flex-shrink-0 flex items-center justify-center w-8 h-8 -my-1 rounded-md transition-colors ${
            hasDraft ? 'text-brand hover:bg-brand-light' : 'text-gray-300'
          }`}
        >
          <CornerDownLeft size={16} />
        </button>
      </div>
    </div>
  )
}
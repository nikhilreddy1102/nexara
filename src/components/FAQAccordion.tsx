// REPO: nexara-frontend
// PATH: src/components/FAQAccordion.tsx
'use client'

import { useState } from 'react'

interface FAQItem {
  question: string
  answer: string
}

// Pulled out of page.tsx (a server component, so it can keep exporting
// `metadata`) since single-open-at-a-time accordion behavior needs React
// state. First question starts open so there's always something to read
// without a click.
export default function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="border border-gray-100 rounded-xl bg-white divide-y divide-gray-50">
      {items.map((item, i) => {
        const isOpen = openIndex === i
        return (
          <div key={item.question} className="px-5 py-4">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 text-sm font-medium text-gray-900 text-left"
            >
              {item.question}
              <span
                className={`text-gray-400 flex-shrink-0 text-lg leading-none transition-transform ${isOpen ? 'rotate-45' : ''}`}
                aria-hidden="true"
              >
                +
              </span>
            </button>
            {isOpen && (
              <p className="text-xs text-gray-500 leading-relaxed mt-2">{item.answer}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

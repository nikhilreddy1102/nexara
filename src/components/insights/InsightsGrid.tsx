// REPO: nexara-frontend
// PATH: src/components/insights/InsightsGrid.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Article {
  category: string
  title: string
  description: string
  href: string
}

// Category tag colors -- light bg + darker text, same visual language as
// the rest of the site's badges (bg-brand-light/text-brand-dark etc.),
// one distinct color per category so the tag reads at a glance.
const CATEGORY_COLORS: Record<string, string> = {
  'Safety & Automation': 'bg-amber-50 text-amber-700',
  'Job Search': 'bg-blue-50 text-blue-700',
  'Startup Financing': 'bg-purple-50 text-purple-700',
  'Growth': 'bg-brand-light text-brand-dark',
}

const ARTICLES: Article[] = [
  {
    category: 'Safety & Automation',
    title: 'Is LinkedIn Automation Safe? What Actually Gets Accounts Restricted',
    description: "LinkedIn automation is safe when it mimics human behavior - paced sends, message variation, warmup periods. Here's exactly what triggers LinkedIn's detection systems and what doesn't.",
    href: '/insights/is-linkedin-automation-safety',
  },
  {
    category: 'Job Search',
    title: 'How to Reach Hiring Managers Directly on LinkedIn (Instead of Just Applying)',
    description: "Applying through job boards means competing against hundreds of applicants filtered by ATS keywords. Here's how to reach the actual hiring manager instead.",
    href: '/insights/reach-hiring-managers-linkedin',
  },
  {
    category: 'Startup Financing',
    title: 'How to Reach Investors on LinkedIn Without a Warm Intro',
    description: "Warm intros convert best, but they're not the only path. Here's what makes a cold LinkedIn message to an investor actually get a reply.",
    href: '/insights/reach-investors-linkedin-cold-outreach',
  },
  {
    category: 'Growth',
    title: 'How to Get Your First Customers on LinkedIn Without Paid Ads',
    description: "Early customers respond to a direct conversation with the person who built the product, not an ad. Here's how outreach-based customer acquisition actually works pre-revenue.",
    href: '/insights/first-customers-linkedin-without-ads',
  },
]

const CATEGORIES = ['All', 'Safety & Automation', 'Job Search', 'Startup Financing', 'Growth'] as const

export default function InsightsGrid() {
  const [filter, setFilter] = useState<(typeof CATEGORIES)[number]>('All')
  const filtered = filter === 'All' ? ARTICLES : ARTICLES.filter(a => a.category === filter)

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`px-4 py-1.5 rounded-full text-xs border transition-colors ${
              filter === c ? 'bg-brand-light border-brand text-brand-dark font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(article => (
          <Link
            key={article.href}
            href={article.href}
            className="card p-5 block hover:border-brand transition-colors"
          >
            <span className={`inline-block text-[9px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded-full mb-3 ${CATEGORY_COLORS[article.category]}`}>
              {article.category}
            </span>
            <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2 mb-2">{article.title}</p>
            <p className="text-xs text-gray-500 leading-relaxed line-clamp-1 mb-4">{article.description}</p>
            <span className="text-xs text-gray-400">Read more →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// REPO: nexara-frontend
// PATH: src/app/insights/page.tsx
import type { Metadata } from 'next'
import InsightsGrid from '@/components/insights/InsightsGrid'
import PublicNav from '@/components/layout/PublicNav'

export const metadata: Metadata = {
  title: 'Insights - Nexara',
  description: 'Outreach tips, product updates, and what actually works on LinkedIn.',
}

export default function InsightsPage() {
  return (
    <div className="min-h-screen bg-page">
      <PublicNav />

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-medium text-gray-900 mb-1.5">Insights</h1>
        <p className="text-sm text-gray-500 mb-8">Outreach tips and what actually gets replies on LinkedIn.</p>

        <InsightsGrid />
      </div>

      <div className="border-t border-gray-100 px-6 py-4 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} Nikarva Technologies
      </div>
    </div>
  )
}

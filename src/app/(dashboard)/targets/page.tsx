'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusBadge, PriorityBadge } from '@/components/ui/Badges'
import { SkeletonRow } from '@/components/ui/Skeleton'
import { cache } from '@/lib/cache'
import { targetsApi } from '@/lib/api'
import type { OutreachTarget } from '@/types'

const statusFilters = ['all', 'replied', 'accepted', 'sent', 'pending', 'skipped']

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function TargetsPage() {
  const [targets, setTargets] = useState<OutreachTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    async function load() {
      const cached = cache.get<OutreachTarget[]>('all_targets')
      if (cached) { setTargets(cached); setLoading(false); return }

      try {
        // Single query across every campaign, instead of listing campaigns
        // and firing one /targets request per campaign.
        const data = await targetsApi.list()
        const list = data.targets || []
        cache.set('all_targets', list, 30)
        setTargets(list)
      } catch { setTargets([]) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const filtered = filter === 'all' ? targets : targets.filter(t => t.status === filter)

  return (
    <div>
      <Header
        title="Targets"
        subtitle="All contacts across campaigns"
        action={<button className="btn-secondary text-xs px-3 py-2">Export</button>}
      />
      <div className="p-4 md:p-6">
        <div className="flex gap-2 mb-5 flex-wrap">
          {statusFilters.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                filter === f ? 'bg-brand-light border-brand text-brand-dark font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && (
                <span className="ml-1 text-[10px] text-gray-400">
                  {targets.filter(t => t.status === f).length}
                </span>
              )}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-400 self-center">{filtered.length} total</span>
        </div>

        {loading && (
          <div className="card divide-y divide-gray-50">
            {[1,2,3,4].map(i => <SkeletonRow key={i} />)}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <EmptyState
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            title="No targets yet"
            description="Targets are discovered automatically when your campaign runs."
          />
        )}

        {!loading && filtered.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Person</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium hidden md:table-cell">Company / Title</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium hidden md:table-cell">Action</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-brand-light text-brand-dark flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                            {initials(t.hr_name)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{t.hr_name || '-'}</p>
                            {t.linkedin_url && (
                              <a href={t.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:text-blue-700">LinkedIn ↗</a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-gray-900">{t.company || '-'}</p>
                        <p className="text-gray-400">{t.title}</p>
                        {t.role_categories && t.role_categories.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {t.role_categories.map(cat => (
                              <span key={cat} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{cat}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{t.action_taken || '-'}</td>
                      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                      <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
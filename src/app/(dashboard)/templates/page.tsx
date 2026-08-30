'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/layout/Header'
import { EmptyState } from '@/components/ui/EmptyState'
import { ModeBadge } from '@/components/ui/Badges'
import { Skeleton } from '@/components/ui/Skeleton'
import { templatesApi } from '@/lib/api'
import type { Template } from '@/types'

const modeFilters = ['all', 'fulltime', 'c2c', 'custom']

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    templatesApi.list()
      .then(data => setTemplates(data.templates || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? templates : templates.filter(t => t.mode === filter)

  return (
    <div>
      <Header title="Templates" subtitle="Pre-built message templates" />
      <div className="p-4 md:p-6">
        <div className="flex gap-2 mb-5 flex-wrap">
          {modeFilters.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs border transition-colors ${
                filter === f ? 'bg-brand-light border-brand text-brand-dark font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}>
              {f === 'all' ? 'All' : f === 'c2c' ? 'C2C' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="card animate-pulse space-y-3">
                <div className="flex justify-between"><Skeleton className="h-4 w-48" /><Skeleton className="h-5 w-16 rounded-full" /></div>
                <Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" />
                <div className="flex gap-2">{[1,2,3].map(j => <Skeleton key={j} className="h-5 w-20 rounded" />)}</div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <EmptyState
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
            title="No templates yet"
            description="Templates are created automatically when you launch your first campaign."
          />
        )}

        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map(t => (
              <div key={t.id} className="card hover:border-gray-300 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  <ModeBadge mode={t.mode} />
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
                  <span>{t.type}</span>
                  {t.persona && <span>·  {t.persona}</span>}
                  {t.char_limit && <span>· {t.char_limit} char limit</span>}
                  {t.acceptance_rate > 0 && <span className="text-brand">· {t.acceptance_rate}% acceptance</span>}
                </div>
                <p className="text-xs text-gray-400 italic leading-relaxed mb-3 line-clamp-2">&quot;{t.body}&quot;</p>
                {t.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {t.variables.map(v => (
                      <span key={v} className="font-mono text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{'{' + v + '}'}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
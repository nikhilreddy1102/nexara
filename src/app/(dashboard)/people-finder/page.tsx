'use client'

import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import KeywordChipInput from './KeywordChipInput'
import QuickTrackPerson from './QuickTrackPerson'
import BrowseAllResults from './Browseallresults'
import StartCampaignBar from './StartCampaignBar'
import { useLinkedInStatus } from '@/hooks/useLinkedInStatus'

type Step = 'form' | 'loading' | 'results' | 'hard_error'

const COMPANY_SIZE_BUCKETS = [
  '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+',
]

const JOB_FUNCTION_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'business_development', label: 'Business development' },
  { value: 'operations', label: 'Operations' },
  { value: 'sales', label: 'Sales' },
]

const SENIORITY_OPTIONS = [
  'owner', 'partner', 'cxo', 'vp', 'director', 'manager', 'senior', 'entry', 'training', 'unpaid',
]

interface SearchResult {
  id: string
  name?: string
  title?: string
  company?: string
  linkedin_url?: string
  [key: string]: unknown
}
interface ResolvedCompany { name: string; id?: string; resolved: boolean }
interface ResolvedLocation { name: string; id?: string; resolved: boolean }
interface ResolvedJobFunction { name: string; id?: string; resolved: boolean }
interface SearchResponse {
  success: true
  tier_used: 'sales_navigator' | 'classic'
  fallback_reason?: string
  note?: string
  results: SearchResult[]
  resolved_companies?: ResolvedCompany[]
  resolved_locations?: ResolvedLocation[]
  resolved_job_function?: ResolvedJobFunction | null
  dropped_seniority_values?: string[] | null
  agencies_filtered?: number
  recruiter_titles_filtered?: number
  filters_sent?: Record<string, unknown>
  applied_params?: Record<string, unknown>
}

interface Post {
  text: string
  char_count: number
  date: string
  posted_at?: string
  permalink?: string
  post_id?: string
}

interface EnrichResponse {
  success: true
  confirmed_title?: string
  confirmed_company?: string
  confirmed_email?: string
  profile_type?: string
  open_profile?: boolean
  hiring_detected?: boolean
  hiring_posts?: Post[]
  other_recent_posts?: Post[]
}
interface ComposeNoteResponse {
  result_id: string
  draft_message: string
  char_count: number
  char_limit: number
  is_premium: boolean
}

function authHeaders() {
  const token = localStorage.getItem('nexara_token')
  return { Authorization: `Bearer ${token ?? ''}` }
}

async function parseJsonSafe(res: Response) {
  return res.json().catch(() => ({} as Record<string, unknown>))
}

type NoteFlowState =
  | { step: 'idle' }
  | { step: 'drafting' }
  | { step: 'editing'; draft: string; charLimit: number }
  | { step: 'sending'; draft: string; charLimit: number }
  | { step: 'sent' }
  | { step: 'error'; message: string }

type ConnectState = { status: 'idle' | 'sending' | 'sent' | 'error'; error?: string }

export default function PeopleFinderPage() {
  const [step, setStep] = useState<Step>('form')
  const [hardError, setHardError] = useState('')

  const { connected: linkedinConnectedRaw, loading: linkedinLoading } = useLinkedInStatus()
  const linkedinConnected: boolean | null = linkedinLoading ? null : linkedinConnectedRaw

  // Search form
  const [keywordChips, setKeywordChips] = useState<string[]>([])
  const [companies, setCompanies] = useState('')
  const [companySize, setCompanySize] = useState<string[]>([])
  const [location, setLocation] = useState('')
  const [jobFunction, setJobFunction] = useState('')
  const [seniority, setSeniority] = useState<string[]>([])
  const [excludeAgencies, setExcludeAgencies] = useState(true)
  const [excludeRecruiterTitles, setExcludeRecruiterTitles] = useState(false)
  const [limit, setLimit] = useState(25)

  const toggleSize = (bucket: string) =>
    setCompanySize(prev => prev.includes(bucket) ? prev.filter(b => b !== bucket) : [...prev, bucket])

  const toggleSeniority = (level: string) =>
    setSeniority(prev => prev.includes(level) ? prev.filter(s => s !== level) : [...prev, level])

  // Results
  const [tierUsed, setTierUsed] = useState<'sales_navigator' | 'classic' | null>(null)
  const [fallbackReason, setFallbackReason] = useState('')
  const [note, setNote] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [resolvedCompanies, setResolvedCompanies] = useState<ResolvedCompany[]>([])
  const [resolvedLocations, setResolvedLocations] = useState<ResolvedLocation[]>([])
  const [resolvedJobFunction, setResolvedJobFunction] = useState<ResolvedJobFunction | null>(null)
  const [droppedSeniorityValues, setDroppedSeniorityValues] = useState<string[]>([])
  const [agenciesFiltered, setAgenciesFiltered] = useState(0)
  const [recruiterTitlesFiltered, setRecruiterTitlesFiltered] = useState(0)

  // Per-result state, keyed by result id
  const [detailsMap, setDetailsMap] = useState<Record<string, EnrichResponse>>({})
  const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({})
  const [detailsError, setDetailsError] = useState<Record<string, string>>({})
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({})

  const [connectState, setConnectState] = useState<Record<string, ConnectState>>({})
  const [noteFlow, setNoteFlow] = useState<Record<string, NoteFlowState>>({})

  // Pagination
  const PAGE_SIZE = 10
  const [page, setPage] = useState(1)

  // Per-post "view more" expansion, keyed by `${resultId}:${kind}:${index}`
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({})
  const togglePost = (key: string) =>
    setExpandedPosts(prev => ({ ...prev, [key]: !prev[key] }))
  const POST_CLAMP = 280

  const runSearch = async () => {
    setStep('loading')
    setHardError('')
    try {
      const companyList = companies.split(',').map(c => c.trim()).filter(Boolean)
      const locationList = location.split(',').map(l => l.trim()).filter(Boolean)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/discovery-test/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          category: 'people',
          keywords: keywordChips.length ? keywordChips.join(' OR ') : undefined,
          companies: companyList.length ? companyList : undefined,
          company_size: companySize.length ? companySize : undefined,
          location: locationList.length ? locationList : undefined,
          job_function: jobFunction || undefined,
          seniority: seniority.length ? seniority : undefined,
          exclude_recruiting_agencies: excludeAgencies,
          exclude_recruiter_titles: excludeRecruiterTitles,
          limit,
        }),
      })
      const body = await parseJsonSafe(res) as SearchResponse & { detail?: string }
      if (!res.ok) {
        setHardError(body?.detail ?? `Search failed (${res.status})`)
        setStep('hard_error')
        return
      }
      // eslint-disable-next-line no-console
      console.log('filters_sent', body.filters_sent, 'applied_params', body.applied_params)
      setTierUsed(body.tier_used)
      setFallbackReason(body.fallback_reason ?? '')
      setNote(body.note ?? '')
      setResults(body.results || [])
      setResolvedCompanies(body.resolved_companies || [])
      setResolvedLocations(body.resolved_locations || [])
      setResolvedJobFunction(body.resolved_job_function ?? null)
      setDroppedSeniorityValues(body.dropped_seniority_values || [])
      setAgenciesFiltered(body.agencies_filtered ?? 0)
      setRecruiterTitlesFiltered(body.recruiter_titles_filtered ?? 0)
      // Fresh search — clear any per-result state from a previous run
      setDetailsMap({}); setDetailsLoading({}); setDetailsError({}); setExpandedDetails({})
      setConnectState({}); setNoteFlow({}); setExpandedPosts({})
      setPage(1)
      setStep('results')
    } catch (e) {
      setHardError(e instanceof Error ? e.message : 'Network error')
      setStep('hard_error')
    }
  }

  const toggleDetails = async (id: string) => {
    setExpandedDetails(prev => ({ ...prev, [id]: !prev[id] }))
    if (detailsMap[id] || detailsLoading[id]) return
    setDetailsLoading(prev => ({ ...prev, [id]: true }))
    setDetailsError(prev => ({ ...prev, [id]: '' }))
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/discovery-test/enrich/${id}`, {
        method: 'POST', headers: authHeaders(),
      })
      const body = await parseJsonSafe(res) as EnrichResponse & { detail?: string }
      if (!res.ok) throw new Error(body?.detail ?? `Failed (${res.status})`)
      setDetailsMap(prev => ({ ...prev, [id]: body }))
    } catch (e) {
      setDetailsError(prev => ({ ...prev, [id]: e instanceof Error ? e.message : 'Failed to load details' }))
    } finally {
      setDetailsLoading(prev => ({ ...prev, [id]: false }))
    }
  }

  const connectWithoutNote = async (id: string) => {
    setConnectState(prev => ({ ...prev, [id]: { status: 'sending' } }))
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/discovery-test/connect/${id}`, {
        method: 'POST', headers: authHeaders(),
      })
      const body = await parseJsonSafe(res) as { detail?: string }
      if (!res.ok) throw new Error(body?.detail ?? `Failed (${res.status})`)
      setConnectState(prev => ({ ...prev, [id]: { status: 'sent' } }))
    } catch (e) {
      setConnectState(prev => ({ ...prev, [id]: { status: 'error', error: e instanceof Error ? e.message : 'Failed to connect' } }))
    }
  }

  const startNoteFlow = async (id: string) => {
    setNoteFlow(prev => ({ ...prev, [id]: { step: 'drafting' } }))
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/discovery-test/compose-note/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({}),
      })
      const body = await parseJsonSafe(res) as ComposeNoteResponse & { detail?: string }
      if (!res.ok) throw new Error(body?.detail ?? `Failed (${res.status})`)
      setNoteFlow(prev => ({ ...prev, [id]: { step: 'editing', draft: body.draft_message, charLimit: body.char_limit } }))
    } catch (e) {
      setNoteFlow(prev => ({ ...prev, [id]: { step: 'error', message: e instanceof Error ? e.message : 'Failed to draft note' } }))
    }
  }

  const updateDraft = (id: string, text: string) => {
    setNoteFlow(prev => {
      const current = prev[id]
      if (current?.step !== 'editing') return prev
      return { ...prev, [id]: { ...current, draft: text } }
    })
  }

  const confirmSendNote = async (id: string) => {
    const current = noteFlow[id]
    if (current?.step !== 'editing') return
    setNoteFlow(prev => ({ ...prev, [id]: { step: 'sending', draft: current.draft, charLimit: current.charLimit } }))
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/discovery-test/connect-with-note/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ message: current.draft }),
      })
      const body = await parseJsonSafe(res) as { detail?: string }
      if (!res.ok) throw new Error(body?.detail ?? `Failed (${res.status})`)
      setNoteFlow(prev => ({ ...prev, [id]: { step: 'sent' } }))
    } catch (e) {
      setNoteFlow(prev => ({ ...prev, [id]: { step: 'error', message: e instanceof Error ? e.message : 'Failed to send' } }))
    }
  }

  const cancelNoteFlow = (id: string) => setNoteFlow(prev => ({ ...prev, [id]: { step: 'idle' } }))

  const unresolvedCompanies = resolvedCompanies.filter(c => !c.resolved)
  const unresolvedLocations = resolvedLocations.filter(l => !l.resolved)

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const pagedResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <Header title="People Finder" subtitle="Search LinkedIn through your connected account" action={<div className="flex gap-2"><BrowseAllResults /><Link href="/connections" className="px-3 py-2 text-sm border rounded-md inline-flex items-center">Message a connection</Link><QuickTrackPerson /></div>} />
      <div className={`p-4 md:p-6 space-y-5 ${step === 'results' ? 'w-full' : 'max-w-3xl mx-auto'}`}>

        {step === 'form' && (
          <>
            <div className="card space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Keywords</label>
                <KeywordChipInput
                  value={keywordChips}
                  onChange={setKeywordChips}
                  placeholder="Type a term, press Enter - e.g. hiring manager, engineering manager"
                />
                <p className="text-[11px] text-gray-400 mt-1">Each chip is treated as an alternative (OR) - add &quot;engineering manager&quot;, &quot;head of engineering&quot;, etc. as separate chips rather than one long phrase.</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Companies</label>
                <input
                  value={companies}
                  onChange={e => setCompanies(e.target.value)}
                  placeholder="e.g. Stripe, Anthropic, OpenAI"
                  className="input w-full text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Location</label>
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Seattle, San Francisco Bay Area"
                  className="input w-full text-sm"
                />
                <p className="text-[11px] text-gray-400 mt-1">Comma-separated. Matched against LinkedIn directly - unmatched entries are flagged in the results.</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Job function</label>
                <select
                  value={jobFunction}
                  onChange={e => setJobFunction(e.target.value)}
                  className="input w-full text-sm"
                >
                  {JOB_FUNCTION_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">Only applies when your account has advanced search access - standard search ignores this filter, see the notice after searching.</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-2">Seniority</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {SENIORITY_OPTIONS.map(level => (
                    <label key={level} className={`flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors capitalize ${
                      seniority.includes(level) ? 'border-brand bg-brand-light text-brand-dark' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}>
                      <input
                        type="checkbox"
                        checked={seniority.includes(level)}
                        onChange={() => toggleSeniority(level)}
                        className="sr-only"
                      />
                      {level}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-2">Company size</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {COMPANY_SIZE_BUCKETS.map(bucket => (
                    <label key={bucket} className={`flex items-center gap-1.5 text-xs border rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors ${
                      companySize.includes(bucket) ? 'border-brand bg-brand-light text-brand-dark' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}>
                      <input
                        type="checkbox"
                        checked={companySize.includes(bucket)}
                        onChange={() => toggleSize(bucket)}
                        className="sr-only"
                      />
                      {bucket}
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Only applies when your account has advanced search access - standard search has no company-size filter at all, on any account.</p>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeAgencies}
                    onChange={e => setExcludeAgencies(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Exclude recruiting agencies
                </label>
                <p className="text-[11px] text-gray-400 pl-6">Matches on company name (e.g. Randstad, Kelly Services) - won&apos;t catch in-house recruiters at real companies.</p>

                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeRecruiterTitles}
                    onChange={e => setExcludeRecruiterTitles(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Exclude recruiter job titles
                </label>
                <p className="text-[11px] text-gray-400 pl-6">Matches on title text (e.g. &quot;Technical Recruiter&quot;, &quot;Talent Acquisition&quot;) - catches in-house recruiters the filter above can&apos;t. Off by default: broader titles can false-positive, so turn on deliberately and check the filtered count after searching.</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Limit</label>
                <input
                  type="number"
                  min={1}
                  value={limit}
                  onChange={e => setLimit(Number(e.target.value))}
                  className="input w-24 text-sm"
                />
                <p className="text-[11px] text-gray-400 mt-1">Server clamps this to the platform max.</p>
              </div>

              <div className="border-t border-gray-100 pt-4">
                {linkedinConnected === null ? (
                  <div className="animate-pulse h-9 bg-gray-100 rounded-lg" />
                ) : linkedinConnected === false ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 text-center">
                    <p className="text-xs text-amber-800 mb-2">
                      Connect your LinkedIn account in Settings to use People Finder.
                    </p>
                    <Link href="/settings" className="btn-primary text-xs px-4 py-1.5 inline-block">
                      Go to Settings
                    </Link>
                  </div>
                ) : (
                  <button onClick={runSearch} className="btn-primary w-full">Search</button>
                )}
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-600 space-y-1.5">
              <p className="font-medium text-gray-700">How to search:</p>
              <p><span className="font-medium">Keywords</span> - add each term as its own chip (e.g. <code className="bg-white px-1 rounded">engineering manager</code>, <code className="bg-white px-1 rounded">head of engineering</code>) - they combine as OR automatically. This is the main lever on accounts without advanced search access. To exclude a term instead of adding one, type it as its own chip prefixed with <code className="bg-white px-1 rounded">NOT</code>, e.g. a chip reading <code className="bg-white px-1 rounded">NOT recruiter</code> - the exclude-agencies/exclude-recruiter-titles toggles below cover most of this already, so only add NOT chips for terms those don&apos;t catch.</p>
              <p><span className="font-medium">Companies</span> - enter multiple names separated by commas (e.g. <code className="bg-white px-1 rounded">Stripe, Anthropic, OpenAI</code>). Each name is matched against LinkedIn directly; if one can&apos;t be found, you&apos;ll see it flagged in the results. Works on both advanced and standard search.</p>
              <p><span className="font-medium">Location</span> - comma-separated, e.g. <code className="bg-white px-1 rounded">Seattle, San Francisco Bay Area</code>. Unmatched entries are flagged after search. Works on both tiers.</p>
              <p><span className="font-medium">Job function / Seniority / Company size</span> - advanced-search-only filters. On accounts without it (most accounts, unless yours has advanced search access), these are silently skipped and a notice explains what ran instead.</p>
              <p>Results automatically use advanced search if your account has it, and fall back to standard search if not - you&apos;ll see which one was used above the results, along with a note if that fallback dropped any of your filters.</p>
            </div>
          </>
        )}

        {step === 'loading' && (
          <div className="card text-center py-10">
            <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-brand border-t-transparent animate-spin" />
            <p className="text-sm font-medium text-gray-900">Searching…</p>
          </div>
        )}

        {step === 'hard_error' && (
          <div className="card space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-sm text-red-700">⚠ {hardError}</p>
            </div>
            <button onClick={() => setStep('form')} className="btn-secondary w-full">Back to search</button>
          </div>
        )}

        {step === 'results' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  tierUsed === 'sales_navigator' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                }`}>
                  {tierUsed === 'sales_navigator' ? 'Results from advanced search' : (fallbackReason || 'Standard search')}
                </span>
                {agenciesFiltered > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-600">
                    {agenciesFiltered} recruiting-agency profile{agenciesFiltered === 1 ? '' : 's'} filtered out
                  </span>
                )}
                {recruiterTitlesFiltered > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-gray-100 text-gray-600">
                    {recruiterTitlesFiltered} recruiter-title profile{recruiterTitlesFiltered === 1 ? '' : 's'} filtered out
                  </span>
                )}
              </div>
              <button onClick={() => setStep('form')} className="text-xs text-gray-500 hover:text-gray-700 underline">
                New search
              </button>
            </div>

            {/* Was parsed off the response but never shown -- this is the message
                that tells you when Classic fallback dropped function/seniority
                or company/headcount filters. Distinct from fallbackReason, which
                only says *that* a fallback happened, not what it cost you. */}
            {note && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <p className="text-xs text-blue-700">ℹ {note}</p>
              </div>
            )}

            {resolvedJobFunction && !resolvedJobFunction.resolved && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-800">
                  Couldn&apos;t match job function &quot;{resolvedJobFunction.name}&quot; - check spelling, or it may only resolve on accounts with advanced search access.
                </p>
              </div>
            )}

            {droppedSeniorityValues.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-800">
                  Seniority value{droppedSeniorityValues.length === 1 ? '' : 's'} with no equivalent on this search tier, dropped: {droppedSeniorityValues.join(', ')}
                </p>
              </div>
            )}

            {unresolvedCompanies.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-800">
                  Couldn&apos;t resolve compan{unresolvedCompanies.length === 1 ? 'y' : 'ies'}: {unresolvedCompanies.map(c => c.name).join(', ')}
                </p>
              </div>
            )}

            {unresolvedLocations.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <p className="text-xs text-amber-800">
                  Couldn&apos;t match location{unresolvedLocations.length === 1 ? '' : 's'}: {unresolvedLocations.map(l => l.name).join(', ')} - check spelling.
                </p>
              </div>
            )}

            {results.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-sm text-gray-500">No results returned</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pagedResults.map(r => {
                  const details = detailsMap[r.id]
                  const dLoading = detailsLoading[r.id]
                  const dError = detailsError[r.id]
                  const isExpanded = expandedDetails[r.id]
                  const connect = connectState[r.id] ?? { status: 'idle' as const }
                  const noteState = noteFlow[r.id] ?? { step: 'idle' as const }

                  return (
                    <div key={r.id} className="card">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(r.id)}
                            onChange={() => {
                              setSelectedIds(prev => {
                                const next = new Set(prev)
                                if (next.has(r.id)) next.delete(r.id)
                                else next.add(r.id)
                                return next
                              })
                            }}
                            className="mt-1 flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{r.name || '-'}</p>
                            {r.title && <p className="text-xs text-gray-500 mt-0.5">{r.title}</p>}
                            {r.company && <p className="text-xs text-gray-400 mt-0.5">{r.company}</p>}
                            {r.linkedin_url && (
                              <a href={r.linkedin_url} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-blue-500 hover:text-blue-700 mt-1 inline-block">
                                View profile ↗
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 flex-shrink-0">
                          <button
                            onClick={() => toggleDetails(r.id)}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                          >
                            {isExpanded ? 'Hide details' : 'Get more details'}
                          </button>
                          <button
                            onClick={() => connectWithoutNote(r.id)}
                            disabled={connect.status === 'sending' || connect.status === 'sent'}
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-brand text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {connect.status === 'sending' ? 'Sending...' : connect.status === 'sent' ? '✓ Connected' : 'Connect without note'}
                          </button>
                          <button
                            onClick={() => startNoteFlow(r.id)}
                            disabled={noteState.step !== 'idle' && noteState.step !== 'error'}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-brand text-brand hover:bg-brand-light disabled:opacity-50"
                          >
                            Connect with note
                          </button>
                        </div>
                      </div>

                      {connect.status === 'error' && (
                        <p className="text-xs text-red-500 mt-2">⚠ {connect.error}</p>
                      )}

                      {noteState.step !== 'idle' && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          {noteState.step === 'drafting' && (
                            <div className="animate-pulse h-16 bg-gray-100 rounded-lg" />
                          )}
                          {noteState.step === 'editing' && (
                            <div className="space-y-2">
                              <textarea
                                value={noteState.draft}
                                onChange={e => updateDraft(r.id, e.target.value)}
                                rows={4}
                                className="input w-full text-xs resize-none"
                              />
                              <div className="flex items-center justify-between">
                                <span className={`text-[11px] ${noteState.draft.length > noteState.charLimit ? 'text-red-500' : 'text-gray-400'}`}>
                                  {noteState.draft.length}/{noteState.charLimit} characters
                                </span>
                                <div className="flex gap-2">
                                  <button onClick={() => cancelNoteFlow(r.id)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => confirmSendNote(r.id)}
                                    disabled={noteState.draft.length > noteState.charLimit || noteState.draft.trim().length === 0}
                                    className="text-xs px-3 py-1.5 rounded-lg bg-brand text-white hover:opacity-90 disabled:opacity-50"
                                  >
                                    Confirm & send
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          {noteState.step === 'sending' && (
                            <p className="text-xs text-gray-500">Sending...</p>
                          )}
                          {noteState.step === 'sent' && (
                            <p className="text-xs text-green-600">✓ Sent with note</p>
                          )}
                          {noteState.step === 'error' && (
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs text-red-500">⚠ {noteState.message}</p>
                              <button onClick={() => cancelNoteFlow(r.id)} className="text-xs text-gray-500 underline flex-shrink-0">Dismiss</button>
                            </div>
                          )}
                        </div>
                      )}

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          {dLoading ? (
                            <div className="space-y-2 animate-pulse">
                              <div className="h-3 bg-gray-100 rounded w-1/2" />
                              <div className="h-3 bg-gray-100 rounded w-3/4" />
                            </div>
                          ) : dError ? (
                            <p className="text-xs text-red-500">⚠ {dError}</p>
                          ) : details ? (
                            <div className="space-y-2 text-xs">
                              {details.confirmed_title && (
                                <p><span className="text-gray-500">Confirmed title:</span> <span className="text-gray-900">{details.confirmed_title}</span></p>
                              )}
                              {details.confirmed_company && (
                                <p><span className="text-gray-500">Confirmed company:</span> <span className="text-gray-900">{details.confirmed_company}</span></p>
                              )}
                              {details.confirmed_email && (
                                <p><span className="text-gray-500">Email:</span> <span className="text-gray-900">{details.confirmed_email}</span></p>
                              )}
                              {details.hiring_detected && (
                                <div className="bg-green-50 border border-green-100 rounded-lg px-2.5 py-2">
                                  <p className="text-green-700 font-medium mb-1">🎯 Hiring signal detected</p>
                                  {details.hiring_posts?.map((post, i) => {
                                    const key = `${r.id}:hiring:${i}`
                                    const isLong = post.char_count > POST_CLAMP
                                    const open = expandedPosts[key]
                                    const shown = isLong && !open ? post.text.slice(0, POST_CLAMP).trimEnd() + '…' : post.text
                                    return (
                                      <div key={post.post_id ?? i} className="mb-2 last:mb-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                          {post.date && <span className="text-[11px] text-gray-400">{post.date}</span>}
                                        </div>
                                        <p className="text-gray-600 whitespace-pre-wrap">{shown}</p>
                                        <div className="flex items-center gap-3 mt-0.5">
                                          {isLong && (
                                            <button
                                              onClick={() => togglePost(key)}
                                              className="text-[11px] text-brand hover:underline"
                                            >
                                              {open ? 'View less' : 'View more'}
                                            </button>
                                          )}
                                          {post.permalink && (
                                            <a
                                              href={post.permalink}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-[11px] text-blue-500 hover:text-blue-700"
                                            >
                                              View on LinkedIn ↗
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                              {details.other_recent_posts && details.other_recent_posts.length > 0 && (
                                <div>
                                  <p className="text-gray-500 mb-1">Recent posts:</p>
                                  <div className="space-y-1">
                                    {details.other_recent_posts.map((post, i) => {
                                      const key = `${r.id}:other:${i}`
                                      const isLong = post.char_count > POST_CLAMP
                                      const open = expandedPosts[key]
                                      const shown = isLong && !open ? post.text.slice(0, POST_CLAMP).trimEnd() + '…' : post.text
                                      return (
                                        <div key={post.post_id ?? i} className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                                          <div className="flex items-center gap-2 mb-0.5">
                                            {post.date && <span className="text-[11px] text-gray-400">{post.date}</span>}
                                          </div>
                                          <p className="text-gray-600 whitespace-pre-wrap">{shown}</p>
                                          <div className="flex items-center gap-3 mt-0.5">
                                            {isLong && (
                                              <button
                                                onClick={() => togglePost(key)}
                                                className="text-[11px] text-brand hover:underline"
                                              >
                                                {open ? 'View less' : 'View more'}
                                              </button>
                                            )}
                                            {post.permalink && (
                                              <a
                                                href={post.permalink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[11px] text-blue-500 hover:text-blue-700"
                                              >
                                                View on LinkedIn ↗
                                              </a>
                                            )}
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {results.length > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <StartCampaignBar selectedIds={Array.from(selectedIds)} onClear={() => setSelectedIds(new Set())} />
    </div>
  )
}
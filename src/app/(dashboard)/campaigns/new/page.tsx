'use client'

import { useState, useEffect, useRef } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import { campaignsApi, isConnectivityError, friendlyErrorMessage } from '@/lib/api'
import { useLinkedInStatus } from '@/hooks/useLinkedInStatus'
import { FAMILY_LABELS, FAMILY_TO_TITLES, searchRoleFamilies } from '@/config/roleTaxonomy'
import ConnectionOutreachWizard from './ConnectionOutreachWizard'

const modes = [
  { id: 'fulltime', label: 'Fulltime', desc: 'Find HRs and hiring managers. Research-driven personalized messages.', timing: 'Follow-up after 7 days' },
  { id: 'c2c', label: 'C2C', desc: 'Coming soon.', timing: '', disabled: true },
  { id: 'custom', label: 'Custom', desc: 'Define your own target in plain English. Nexara composes from your brief.', timing: 'You define follow-up timing' },
]

const companyChips = ['FAANG+', 'AI Labs', 'Top Fintech', 'Fortune 500', 'Series B+', 'Funded AI', 'Top 50 SaaS']
// Target roles now searches the full ROLE_FAMILIES taxonomy in
// @/config/roleTaxonomy -- see that file for the family list and how
// typing matches against it.
const techStackChips = ['React', 'Python', 'Node.js', 'Java', 'Go', 'TypeScript', 'AWS', 'Kubernetes', 'LangChain', 'FastAPI']
// Keyed by the same country VALUE used in countryChips below -- cities
// shown are scoped to whichever country the user actually picked, instead
// of one flat list mixing every country's cities together regardless of
// selection.
const CITIES_BY_COUNTRY: Record<string, string[]> = {
  'United States': ['Bay Area', 'New York', 'Seattle', 'Austin', 'Chicago', 'Boston', 'Los Angeles', 'Denver', 'Raleigh-Durham'],
  'India': ['Bangalore', 'Mumbai', 'Hyderabad', 'Pune', 'Chennai', 'Delhi NCR', 'Noida'],
  'United Kingdom': ['London', 'Manchester', 'Cambridge', 'Edinburgh'],
  'Australia': ['Sydney', 'Melbourne', 'Brisbane'],
  'Canada': ['Toronto', 'Vancouver', 'Montreal', 'Waterloo'],
}

function citiesForCountries(selectedCountries: string[]): string[] {
  return Array.from(new Set(selectedCountries.flatMap(c => CITIES_BY_COUNTRY[c] ?? [])))
}
// Must match linkedin_search.py's COMPANY_SIZE_BUCKETS keys exactly --
// Sales Navigator only, ignored on Classic fallback and at basic tier.
const companySizeChips = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+']
const SMALL_COMPANY_SIZES = ['1-10', '11-50']
const discoveryTiers: { id: 'basic' | 'pro' | 'advanced'; label: string; desc: string }[] = [
  { id: 'basic', label: 'Basic', desc: 'Searches our existing database of previously found people, plus a company overview.' },
  { id: 'pro', label: 'Pro', desc: 'Also searches LinkedIn live when our existing database doesn’t have enough people.' },
  { id: 'advanced', label: 'Advanced', desc: 'Also searches LinkedIn live, plus a full profile lookup for each person.' },
]
const countryChips = [
  { label: 'USA', value: 'United States' },
  { label: 'India', value: 'India' },
  { label: 'UK', value: 'United Kingdom' },
  { label: 'Australia', value: 'Australia' },
  { label: 'Canada', value: 'Canada' },
]



const COMPANY_TO_KEYWORDS: Record<string, string[]> = {
  'FAANG+': ['Google', 'Meta', 'Apple', 'Amazon', 'Netflix', 'Microsoft'],
  'AI Labs': ['OpenAI', 'Anthropic', 'DeepMind', 'Cohere', 'Mistral', 'xAI'],
  'Top Fintech': ['Stripe', 'Plaid', 'Robinhood', 'Chime', 'Brex', 'Rippling'],
  'Fortune 500': [],
  'Series B+': [],
  'Funded AI': [],
  'Top 50 SaaS': ['Salesforce', 'HubSpot', 'Zendesk', 'Atlassian', 'Notion', 'Figma'],
}

// Still a cosmetic heuristic, not a real lookup against discovered_profiles
// or a live count -- but weighted so each pick visibly moves the range
// instead of nudging it by single digits. Same "no filter = broadest
// reach, each specific pick narrows from that ceiling then grows again as
// you stack more" direction as before, just with per-item weights large
// enough to actually feel responsive.
function estimateProfiles(companies: string[], roles: string[], cities: string[], countries: string[]): string {
  const base = 10
  const companyTerm = companies.length > 0 ? companies.length * 40 : 150
  const roleTerm = roles.length > 0 ? roles.length * 30 : 100
  // Mirrors buildTargetLocations(): cities and country are never both sent
  // to search at once (a city implies its own country), so the estimate
  // shouldn't count them both either -- cities win when any are picked.
  const locationCount = cities.length > 0 ? cities.length : countries.length
  const locationTerm = locationCount > 0 ? locationCount * 25 : 40
  const low = base + companyTerm + roleTerm + locationTerm
  // Fixed-width band, not multiplicative -- a x3 spread balloons out of
  // control as low grows with more picks (e.g. 5 companies alone pushes
  // low past 300, tripling that into a ~1000-point-wide range). A flat
  // +150 keeps the band a believable size regardless of how many filters
  // are stacked.
  const high = low + 150
  return `${low}–${high}`
}

export default function NewCampaignPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [mode, setMode] = useState('')
  // Which of Connection Outreach / B2B Prospecting / Staffing was picked
  // under "Custom". Client-only -- never sent to the backend, and
  // 'custom' itself is never written anywhere. See campaigns.py's
  // CreateCampaignRequest: mode is one of 'fulltime' | 'c2c' |
  // 'connection_outreach' | 'b2b_prospecting' | 'staffing', full stop.
  const [customCard, setCustomCard] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [techStack, setTechStack] = useState<string[]>([])
  const [customGoal, setCustomGoal] = useState('')
  const [targetPersona, setTargetPersona] = useState('')
  const [supervised, setSupervised] = useState(true)
  const [saving, setSaving] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<string[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [cities, setCities] = useState<string[]>([])
  const [countries, setCountries] = useState<string[]>([])
  const [companySize, setCompanySize] = useState<string[]>([])
  const [discoveryTier, setDiscoveryTier] = useState<'basic' | 'pro' | 'advanced'>('basic')
  const [rolesDropdownOpen, setRolesDropdownOpen] = useState(false)
  const [roleInput, setRoleInput] = useState('')
  const rolesDropdownRef = useRef<HTMLDivElement>(null)
  // Red "Required" text/borders only appear once the user actually tries to
  // move past this step while something's missing -- before that, fields
  // just carry the plain * marker, not a pre-emptive error state.
  const [attemptedStep2Next, setAttemptedStep2Next] = useState(false)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rolesDropdownRef.current && !rolesDropdownRef.current.contains(e.target as Node)) {
        setRolesDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Same gate as the campaigns list page -- this is the file that
  // actually creates and launches a campaign, so it's the real
  // enforcement point. Hiding buttons elsewhere (dashboard, the list
  // page) is just UI convenience; someone reaching this URL directly
  // must still be blocked here regardless of how they got here.
  // Separate from the booleans above -- a failed *check* (offline, timed
  // out, backend 5xx) is not the same fact as "not connected" / "not
  // synced", and showing "Connect LinkedIn" for what's actually a
  // connectivity problem would send an already-connected user down the
  // wrong path. Shared by both checks below since only one gate renders
  // at a time.
  const {
    connected: linkedinConnectedRaw, loading: linkedinLoading, error: linkedinErr, mutate: mutateLinkedin,
  } = useLinkedInStatus()
  const linkedinConnected: boolean | null = linkedinLoading ? null : linkedinConnectedRaw

  const {
    data: syncData, isLoading: syncLoading, error: syncErr, mutate: mutateSync,
  } = useSWR<{ last_synced_at: string | null }>(linkedinConnected ? '/connections/sync-status' : null)
  const hasSyncedOnce: boolean | null =
    linkedinConnected !== true ? null : syncLoading ? null : !!syncData?.last_synced_at

  const gateError = isConnectivityError(linkedinErr)
    ? friendlyErrorMessage(linkedinErr)
    : isConnectivityError(syncErr)
      ? friendlyErrorMessage(syncErr)
      : null

  const retryChecks = () => { mutateLinkedin(); mutateSync() }

  const toggleChip = (arr: string[], setArr: (a: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  const buildTargetTitles = (): string[] => {
    if (roles.length === 0) return ['Software Engineer', 'Engineering Manager', 'Recruiter', 'HR Manager']
    return roles.flatMap(r => FAMILY_TO_TITLES[r] ?? [r])
  }

  const buildTargetCompanies = (): string[] => {
    return companies.flatMap(c => COMPANY_TO_KEYWORDS[c] ?? [c])
  }

  // Sends EITHER the city or the country, never both -- LinkedIn's location
  // filter matches on ANY of the ids you give it, so including the country
  // alongside a narrower city would make the city selection a no-op (every
  // country-wide match already satisfies the filter, swallowing the city
  // narrowing entirely). Cities imply their own country already.
  const buildTargetLocations = (): string[] => {
    return cities.length > 0 ? cities : countries
  }

  // Validation per mode -- everything on this page is required except
  // Target companies and Company size (those two stay genuinely optional;
  // narrowing to specific companies/headcount is a real choice to skip).
  const step2Valid = (): boolean => {
    if (!name.trim()) return false
    if (mode === 'c2c' && !jobTitle.trim()) return false
    if (mode === 'c2c' && techStack.length === 0) return false
    if (mode === 'custom' && (!customGoal.trim() || !targetPersona.trim())) return false
    if (mode === 'fulltime' && roles.length === 0) return false
    if (countries.length === 0) return false
    return true
  }

  const handleLaunch = async () => {
    if (!name || !mode) return
    setSaving(true)
    setLaunchError(null)
    try {
      const c = await campaignsApi.create({
        name,
        mode,
        supervised_mode: supervised,
        target_titles: buildTargetTitles(),
        target_companies: buildTargetCompanies(),
        target_locations: buildTargetLocations(),
        // Defensive, not just UI-level: companies always wins over size even
        // if stale state somehow slipped through (see the lock above).
        target_company_size: companies.length === 0 && companySize.length > 0 ? companySize : undefined,
        discovery_tier: discoveryTier,
        // Fulltime no longer has its own free-text "Role you are targeting"
        // field -- Target roles is the single source of truth now, so this
        // derives a readable job_title from whichever roles were picked
        // (composer.py's message-composition prompt still reads job_title
        // for fulltime's "Sender is looking for: X" line).
        job_title: mode === 'fulltime'
          ? (roles.map(r => FAMILY_LABELS[r] ?? r).join(', ') || undefined)
          : (jobTitle || undefined),
        tech_stack: techStack.length > 0 ? techStack : undefined,
        custom_goal: customGoal || undefined,
        target_persona: targetPersona || undefined,
      })
      router.push(`/campaigns/${c.id}`)
    } catch (err) {
      setSaving(false)
      setLaunchError(friendlyErrorMessage(err, 'Something went wrong creating the campaign. Please try again.'))
    }
  }

  const stepLabels = ['Mode', 'Brief', 'Strategy', 'Launch']
  const hasSelections = companies.length > 0 || roles.length > 0 || cities.length > 0 || countries.length > 0
  const estimate = estimateProfiles(companies, roles, cities, countries)

  // Connection Outreach forks off entirely here -- owns its own name
  // field, its own steps, its own creation call. Everything below this
  // block (the original 4-step Fulltime/C2C/discovery-Custom flow) is
  // byte-for-byte what it always was.
  if (linkedinConnected !== true || hasSyncedOnce !== true) {
    return (
      <div>
        <Header title="New campaign" subtitle="Set up your outreach" />
        <div className="p-4 md:p-6 max-w-3xl">
          {gateError && (
            <div className="card flex flex-col items-center text-center py-14 px-6">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.58 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">Couldn&apos;t reach Nexara</p>
              <p className="text-xs text-gray-500 max-w-sm mb-5">{gateError}</p>
              <button onClick={retryChecks} className="btn-primary">Retry</button>
            </div>
          )}
          {!gateError && linkedinConnected === false && (
            <div className="card flex flex-col items-center text-center py-14 px-6">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">Connect LinkedIn to unlock campaigns</p>
              <p className="text-xs text-gray-500 max-w-sm mb-5">
                Campaigns send and track outreach through your own LinkedIn account, so
                there&apos;s nothing for a campaign to do until it&apos;s connected.
              </p>
              <a href="/settings" className="btn-primary">Connect LinkedIn</a>
            </div>
          )}
          {!gateError && linkedinConnected === true && hasSyncedOnce === false && (
            <div className="card flex flex-col items-center text-center py-14 px-6">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">Sync your connections to unlock campaigns</p>
              <p className="text-xs text-gray-500 max-w-sm mb-5">
                LinkedIn&apos;s connected, but campaigns need your existing connections
                synced first so Nexara knows who&apos;s already in your network.
              </p>
              <a href="/connections" className="btn-primary">Sync connections</a>
            </div>
          )}
          {!gateError &&
            (linkedinConnected === null || (linkedinConnected === true && hasSyncedOnce === null)) && (
            <div className="card animate-pulse h-40" />
          )}
        </div>
      </div>
    )
  }

  if (mode === 'custom' && customCard === 'connection_outreach') {
    return (
      <div>
        <Header title="New campaign" subtitle="Connection Outreach" />
        <div className="p-4 md:p-6 max-w-3xl">
          <ConnectionOutreachWizard onExit={() => setCustomCard(null)} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="New campaign" subtitle="Set up your outreach in 4 steps" />
      <div className="p-4 md:p-6 max-w-3xl">

        {/* Step indicator */}
        <div className="flex items-center mb-8">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  step > i + 1 ? 'bg-brand-light text-brand-dark'
                  : step === i + 1 ? 'bg-brand text-white'
                  : 'bg-gray-100 text-gray-400'
                }`}>
                  {step > i + 1 ? '✓' : i + 1}
                </div>
                <span className={`text-[10px] whitespace-nowrap ${step === i + 1 ? 'text-brand' : 'text-gray-400'}`}>{label}</span>
              </div>
              {i < stepLabels.length - 1 && (
                <div className={`flex-1 h-px mx-2 mb-4 ${step > i + 1 ? 'bg-brand' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 1 - Mode */}
        {step === 1 && (
          <div>
            <p className="text-sm text-gray-500 mb-4">Select your campaign mode</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              {modes.map(m => (
                <button
                  key={m.id}
                  disabled={m.disabled}
                  onClick={() => {
                    if (m.disabled) return
                    setMode(m.id)
                    setCustomCard(null)   // reset card pick if switching away and back
                  }}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    m.disabled ? 'border border-gray-100 opacity-50 cursor-not-allowed'
                    : mode === m.id ? 'border-2 border-brand bg-brand-light/30' : 'border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 mb-2">{m.label}</p>
                  <p className="text-xs text-gray-500 leading-relaxed mb-3">{m.desc}</p>
                  {m.timing && <p className="text-[10px] text-gray-400">{m.timing}</p>}
                </button>
              ))}
            </div>

            {/* "Custom" reveals these cards. Nothing is sent to the
                backend yet -- picking a card is what actually matters. */}
            {mode === 'custom' && (
              <div className="mb-6">
                <p className="text-xs text-gray-500 mb-3">Choose a campaign type</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => setCustomCard('connection_outreach')}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      customCard === 'connection_outreach' ? 'border-2 border-brand bg-brand-light/30' : 'border border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-900 mb-1">Connection Outreach</p>
                    <p className="text-xs text-gray-500">Message people you&apos;re already connected to on LinkedIn.</p>
                  </button>
                  <button disabled className="text-left p-4 rounded-xl border border-gray-100 opacity-50 cursor-not-allowed">
                    <p className="text-sm font-medium text-gray-900 mb-1">B2B Prospecting</p>
                    <p className="text-xs text-gray-500">Coming soon.</p>
                  </button>
                  <button disabled className="text-left p-4 rounded-xl border border-gray-100 opacity-50 cursor-not-allowed">
                    <p className="text-sm font-medium text-gray-900 mb-1">Staffing</p>
                    <p className="text-xs text-gray-500">Coming soon.</p>
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                disabled={mode === 'custom' ? !customCard : !mode}
                onClick={() => setStep(2)}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 - Brief */}
        {step === 2 && (
          <div>
            <div className="space-y-5 mb-6">

              {/* Campaign name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Campaign name <span className="text-red-500">*</span>
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. FAANG+ ML Engineer outreach"
                  className={`input ${attemptedStep2Next && !name.trim() ? 'border-red-200 focus:border-red-400' : ''}`}
                />
                {attemptedStep2Next && !name.trim() && (
                  <p className="text-xs text-red-500 mt-1">Required</p>
                )}
              </div>

              {/* C2C - Job title required */}
              {mode === 'c2c' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Your job title / skill <span className="text-red-500">*</span>
                      <span className="text-gray-400 font-normal ml-1">(required - used to search contract job postings)</span>
                    </label>
                    <input
                      value={jobTitle}
                      onChange={e => setJobTitle(e.target.value)}
                      placeholder="e.g. React Developer, Python Engineer, Java Developer"
                      className={`input ${attemptedStep2Next && !jobTitle.trim() ? 'border-red-200 focus:border-red-400' : ''}`}
                    />
                    {attemptedStep2Next && !jobTitle.trim() && (
                      <p className="text-xs text-red-500 mt-1">Required for C2C mode</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Tech stack <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {techStackChips.map(t => (
                        <button key={t} onClick={() => toggleChip(techStack, setTechStack, t)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            techStack.includes(t) ? 'bg-brand-light border-brand text-brand-dark' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}>{t}</button>
                      ))}
                    </div>
                    {attemptedStep2Next && techStack.length === 0 && (
                      <p className="text-xs text-red-500 mt-1">Select at least one</p>
                    )}
                  </div>
                </>
              )}

              {/* Custom mode fields -- this is the OLD discovery-based
                  free-text flow. Only ever reached now if customCard is
                  null, which shouldn't normally happen since step 1
                  requires picking a card to continue -- kept as-is,
                  unreachable dead code rather than deleted, in case you
                  want to revive the free-text path later. */}
              {mode === 'custom' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Your goal <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={customGoal}
                      onChange={e => setCustomGoal(e.target.value)}
                      placeholder="e.g. Market my SaaS product to CTOs at startups"
                      className={`input ${attemptedStep2Next && !customGoal.trim() ? 'border-red-200' : ''}`}
                    />
                    {attemptedStep2Next && !customGoal.trim() && (
                      <p className="text-xs text-red-500 mt-1">Required for Custom mode</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Target persona <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={targetPersona}
                      onChange={e => setTargetPersona(e.target.value)}
                      placeholder="e.g. CTOs at Series A startups with 10-50 employees"
                      className={`input ${attemptedStep2Next && !targetPersona.trim() ? 'border-red-200' : ''}`}
                    />
                    {attemptedStep2Next && !targetPersona.trim() && (
                      <p className="text-xs text-red-500 mt-1">Required for Custom mode</p>
                    )}
                  </div>
                </>
              )}

              {/* Target companies - not shown for C2C */}
              {mode !== 'c2c' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Target companies <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {companies.map(c => (
                      <span key={c} className="bg-purple-100 text-purple-900 text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                        {c}
                        <button onClick={() => toggleChip(companies, setCompanies, c)} className="hover:text-purple-600">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {companyChips.map(c => (
                      <button key={c} onClick={() => {
                        const addingFirstCompany = companies.length === 0 && !companies.includes(c)
                        toggleChip(companies, setCompanies, c)
                        // Named companies make a size filter redundant (and
                        // contradictory if it doesn't match their real
                        // headcount, e.g. FAANG+ + "1-10") -- clear it the
                        // moment the first company is picked, matching the
                        // lock this triggers below.
                        if (addingFirstCompany && companySize.length > 0) setCompanySize([])
                      }}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          companies.includes(c) ? 'bg-brand-light border-brand text-brand-dark' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>{c}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Company size - not shown for C2C (Dice has no such filter).
                  Sales Navigator only -- silently ignored on Classic
                  fallback and at basic tier (no live search at all). Locked
                  whenever specific companies are targeted -- a named-company
                  search makes a headcount filter redundant at best, and
                  actively contradictory at worst (e.g. FAANG+ + "1-10"
                  would AND together into an impossible search). */}
              {mode !== 'c2c' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Company size <span className="text-gray-400 font-normal">(optional - only applies to live search at Pro/Advanced tier)</span>
                  </label>
                  <div className={`flex flex-wrap gap-1.5 ${companies.length > 0 ? 'opacity-40' : ''}`}>
                    {companySizeChips.map(c => (
                      <button key={c} disabled={companies.length > 0} onClick={() => toggleChip(companySize, setCompanySize, c)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          companies.length > 0 ? 'cursor-not-allowed border-gray-100 text-gray-300'
                          : companySize.includes(c) ? 'bg-brand-light border-brand text-brand-dark' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>{c}</button>
                    ))}
                  </div>
                  {companies.length > 0 ? (
                    <p className="text-[10px] text-amber-600 mt-1.5">
                      Locked while target companies are selected. Remove the company chips above to filter by size instead.
                    </p>
                  ) : companySize.length > 0 && companySize.every(c => SMALL_COMPANY_SIZES.includes(c)) && (
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      Small-company range selected - outreach targets founders/VPs instead of HR at Pro/Advanced tier.
                    </p>
                  )}
                </div>
              )}

              {/* Target roles - not shown for C2C or custom. Free-type
                  combobox backed by the full ROLE_FAMILIES taxonomy in
                  @/config/roleTaxonomy: typing matches against every
                  keyword in every family (hundreds of specific titles),
                  but the dropdown only ever surfaces the FAMILY name via
                  FAMILY_LABELS -- so typing something as specific as
                  "spring boot" or "kafka" still nudges the user toward the
                  right family instead of a wall of raw keywords. `roles`
                  stores family KEYS (e.g. 'backend'), except when Enter is
                  pressed on text that matched nothing -- that gets added
                  verbatim as a custom role rather than blocking the user;
                  it falls through FAMILY_TO_TITLES' `?? [r]` fallback and
                  still reaches the AI hiring-title resolver fine (see
                  discovery.py), it just won't get a shared-cache category.
                  Doubles as "the role(s) you're targeting" -- the old
                  separate free-text field was redundant with this and has
                  been folded in; job_title for message composition is
                  derived from whichever roles get picked here (see
                  handleLaunch). */}
              {mode === 'fulltime' && (() => {
                const suggestions = searchRoleFamilies(roleInput).filter(f => !roles.includes(f))
                const addRole = (r: string) => {
                  const val = r.trim()
                  if (val && !roles.includes(val)) setRoles([...roles, val])
                  setRoleInput('')
                }
                return (
                  <div ref={rolesDropdownRef} className="relative">
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Role(s) you&apos;re targeting <span className="text-red-500">*</span>
                    </label>
                    {roles.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {roles.map(r => (
                          <span key={r} className="bg-brand-light text-brand-dark text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                            {FAMILY_LABELS[r] ?? r}
                            <button onClick={() => toggleChip(roles, setRoles, r)} className="hover:text-brand-dark/70">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <input
                      value={roleInput}
                      onChange={e => { setRoleInput(e.target.value); setRolesDropdownOpen(true) }}
                      onFocus={() => setRolesDropdownOpen(true)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); addRole(suggestions[0] ?? roleInput) }
                      }}
                      placeholder="Type to search, e.g. Backend, Kafka, Analyst, Kubernetes..."
                      className={`input ${attemptedStep2Next && roles.length === 0 ? 'border-red-200' : ''}`}
                    />
                    {rolesDropdownOpen && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-56 overflow-y-auto">
                        {suggestions.map(r => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => addRole(r)}
                            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                          >{FAMILY_LABELS[r] ?? r}</button>
                        ))}
                        {suggestions.length === 0 && (
                          <p className="px-3 py-1.5 text-xs text-gray-400">
                            {roleInput.trim()
                              ? `No match in our supported roles - press Enter to add "${roleInput.trim()}" as a custom role`
                              : 'All supported roles already selected'}
                          </p>
                        )}
                      </div>
                    )}
                    {attemptedStep2Next && roles.length === 0 && (
                      <p className="text-xs text-red-500 mt-1">Select at least one role</p>
                    )}
                  </div>
                )
              })()}

              {/* Country - single-select: exactly one country per campaign,
                  not a multi-pick set. Clicking the already-selected chip
                  deselects it back to none. */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Country <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {countryChips.map(c => (
                    <button key={c.value} onClick={() => {
                      const isSelected = countries.includes(c.value)
                      const nextCountries = isSelected ? [] : [c.value]
                      setCountries(nextCountries)
                      // Cities are scoped to the selected country -- prune
                      // any city that's no longer valid the moment the
                      // country changes, instead of leaving a stale,
                      // now-invisible selection in state.
                      const nextAvailableCities = new Set(citiesForCountries(nextCountries))
                      setCities(prev => prev.filter(city => nextAvailableCities.has(city)))
                    }}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        countries.includes(c.value) ? 'bg-green-100 border-green-400 text-green-800' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>{c.label}</button>
                  ))}
                </div>
                {countries.length > 0 ? (
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    {cities.length > 0
                      ? `Searches around ${cities.join(', ')}`
                      : `Searches all people in ${countries[0]} regardless of city`}
                  </p>
                ) : attemptedStep2Next && (
                  <p className="text-xs text-red-500 mt-1">Select a country</p>
                )}
              </div>

              {/* Cities - hidden until a country is picked, and scoped to
                  exactly that country (see CITIES_BY_COUNTRY) instead of
                  one flat list mixing every country's cities together
                  regardless of what's actually selected. */}
              {countries.length > 0 && citiesForCountries(countries).length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Specific cities <span className="text-gray-400 font-normal">(optional - narrows to exact city, within the country selected above)</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {citiesForCountries(countries).map(l => (
                      <button key={l} onClick={() => toggleChip(cities, setCities, l)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          cities.includes(l) ? 'bg-blue-100 border-blue-400 text-blue-800' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>{l}</button>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Search preview */}
            {(name || hasSelections) && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-xs text-blue-700 leading-relaxed">
                <p className="font-medium text-blue-800 mb-2">Nexara will search for:</p>
                {mode === 'c2c' && jobTitle && <p>Contract search: <b>{jobTitle}</b>{techStack.length > 0 ? ` + ${techStack.join(', ')}` : ''}</p>}
                {mode !== 'c2c' && companies.length > 0 && (
                  <p>Companies: {companies.join(', ')}
                    <span className="text-blue-400 ml-1">→ {buildTargetCompanies().slice(0, 4).join(', ')}{buildTargetCompanies().length > 4 ? '...' : ''}</span>
                  </p>
                )}
                {mode === 'fulltime' && (roles.length > 0 ? (
                  <p>Roles: {roles.map(r => FAMILY_LABELS[r] ?? r).join(', ')}
                    <span className="text-blue-400 ml-1">→ {buildTargetTitles().slice(0, 3).join(', ')}{buildTargetTitles().length > 3 ? '...' : ''}</span>
                  </p>
                ) : (
                  <p className="text-blue-500">Roles: all engineering + recruiter titles</p>
                ))}
                {mode === 'custom' && customGoal && <p>Goal: {customGoal}</p>}
                {cities.length > 0 ? (
                  <p>Cities: {cities.join(', ')}</p>
                ) : countries.length > 0 && (
                  <p>Country: {countries[0]} (entire country)</p>
                )}
                <p className="mt-1.5 text-blue-600 font-medium">Estimated profiles: {estimate}</p>
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="btn-secondary">← Back</button>
              <button
                onClick={() => {
                  if (step2Valid()) setStep(3)
                  else setAttemptedStep2Next(true)
                }}
                className="btn-primary"
              >
                Generate strategy →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 - Strategy approval */}
        {step === 3 && (
          <div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                </svg>
                <span className="text-sm font-medium text-blue-800">Gate 1 - Review search strategy before it runs</span>
              </div>
              <div className="bg-white rounded-lg p-3 text-xs leading-relaxed text-gray-600 space-y-1.5">
                <p><b className="text-gray-900">Campaign:</b> {name}</p>
                <p><b className="text-gray-900">Mode:</b> {mode}</p>
                {mode === 'c2c' && jobTitle && <p><b className="text-gray-900">Searching contract job postings for:</b> {jobTitle}{techStack.length > 0 ? ` + ${techStack.join(', ')}` : ''}</p>}
                {mode !== 'c2c' && companies.length > 0 && (
                  <p><b className="text-gray-900">Companies:</b> {companies.join(', ')}
                    <span className="text-gray-400 ml-1">→ {buildTargetCompanies().slice(0, 4).join(', ')}{buildTargetCompanies().length > 4 ? '...' : ''}</span>
                  </p>
                )}
                {mode === 'fulltime' && (roles.length > 0 ? (
                  <p><b className="text-gray-900">Roles:</b> {roles.map(r => FAMILY_LABELS[r] ?? r).join(', ')}
                    <span className="text-gray-400 ml-1">→ {buildTargetTitles().slice(0, 3).join(', ')}{buildTargetTitles().length > 3 ? '...' : ''}</span>
                  </p>
                ) : (
                  <p><b className="text-gray-900">Roles:</b> <span className="text-gray-400">all engineering + recruiter titles</span></p>
                ))}
                {mode === 'custom' && <p><b className="text-gray-900">Goal:</b> {customGoal}</p>}
                {mode === 'custom' && <p><b className="text-gray-900">Persona:</b> {targetPersona}</p>}
                {cities.length > 0 ? (
                  <p><b className="text-gray-900">Cities:</b> {cities.join(', ')}</p>
                ) : countries.length > 0 && (
                  <p><b className="text-gray-900">Country:</b> {countries[0]} (entire country)</p>
                )}
                {companySize.length > 0 && <p><b className="text-gray-900">Company size:</b> {companySize.join(', ')}</p>}
                <p className="text-brand font-medium">Estimated profiles: {estimate}</p>
              </div>
            </div>

            {/* Discovery tier - defaults to basic (cache-only) but is a real
                choice here now, not something only editable after creation
                from the campaign detail page's Automation settings panel. */}
            <div className="card mb-6">
              <p className="text-sm font-medium text-gray-900 mb-1">Discovery tier</p>
              <p className="text-xs text-gray-500 mb-3">How this campaign finds people on each run. Can be changed later from the campaign page.</p>
              <div className="flex gap-2 mb-2">
                {discoveryTiers.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setDiscoveryTier(t.id)}
                    className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-all ${discoveryTier === t.id ? 'border-brand bg-brand/5 text-brand' : 'border-gray-200 text-gray-500'}`}
                  >{t.label}</button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400">{discoveryTiers.find(t => t.id === discoveryTier)?.desc}</p>
              {mode === 'c2c' && discoveryTier !== 'basic' && (
                <p className="text-[11px] text-gray-400 mt-1">C2C discovery always searches contract job postings regardless of tier - Pro/Advanced here only changes whether full profile enrichment runs per person.</p>
              )}
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="btn-secondary">← Back</button>
              <button onClick={() => setStep(4)} className="btn-primary">Approve &amp; continue →</button>
            </div>
          </div>
        )}

        {/* Step 4 - Launch */}
        {step === 4 && (
          <div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
              <div className="flex items-center gap-2 mb-3">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                <span className="text-sm font-medium text-blue-800">Gate 2 - Review message template before outreach fires</span>
              </div>
              <div className="bg-white rounded-lg p-3">
                <p className="text-xs font-medium text-gray-700 mb-2">Message template preview</p>
                <div className="border-l-2 border-brand pl-3 text-xs text-gray-500 leading-relaxed italic">
                  {mode === 'c2c'
                    ? `Saw the ${jobTitle} contract role you posted. Been doing exactly that stack for several years - available now and can move fast. Happy to send my profile if it looks like a fit.`
                    : `Hi {'{first_name}'}, noticed {'{company}'} is scaling its {'{team_name}'} team. Been doing {'{role}'} work for {'{years}'} years - worth connecting.`
                  }
                </div>
              </div>
            </div>

            <div className="card mb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Supervised mode</p>
                  <p className="text-xs text-gray-500 mt-0.5">Review first 4–5 messages before enabling autopilot</p>
                </div>
                <button
                  onClick={() => setSupervised(!supervised)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${supervised ? 'bg-brand' : 'bg-gray-200'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${supervised ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            {launchError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 text-xs text-red-700 flex items-center justify-between gap-3">
                <span>{launchError}</span>
                <button onClick={handleLaunch} className="text-red-800 font-medium underline flex-shrink-0">Retry</button>
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(3)} className="btn-secondary">← Back</button>
              <button
                disabled={!name || saving}
                onClick={handleLaunch}
                className="btn-primary disabled:opacity-40"
              >
                {saving ? 'Creating...' : '🚀 Launch campaign'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
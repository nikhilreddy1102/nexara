// REPO: nexara-frontend
// PATH: src/app/pricing/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import PublicNav from '@/components/layout/PublicNav'

interface Tier {
  key: string
  name: string
  credits: number
  standard: number
  student: number
  discount: number
  pdl: number
  tagline: string
  useCases?: string[]
}

// Order matters here -- it's what upgrade/downgrade comparison is based
// on for logged-in users below.
const TIERS: Tier[] = [
  {
    key: 'starter', name: 'Starter', credits: 800, standard: 29.99, student: 19.99, discount: 33.3, pdl: 0,
    tagline: 'Get your first conversations going',
  },
  {
    key: 'growth', name: 'Growth', credits: 2000, standard: 39.99, student: 29.99, discount: 25, pdl: 0,
    tagline: 'Recommended - where most active searches land',
  },
  {
    key: 'pro', name: 'Pro', credits: 3500, standard: 49.99, student: 39.99, discount: 20, pdl: 50,
    tagline: 'Built for founder-level conversations',
    useCases: [
      "Reach out directly to founders - pitch an idea, ask for an intro, or open a conversation that matters.",
      "Market your product to the exact people who'd want it, without buying ad space.",
    ],
  },
  {
    key: 'advanced', name: 'Advanced', credits: 5000, standard: 59.99, student: 44.99, discount: 25, pdl: 100,
    tagline: 'Full-scale outbound, built to convert',
    useCases: [
      'Run founder outreach at real volume - investors, partners, or anyone worth a cold intro.',
      'Take your go-to-market outbound seriously, reaching the right buyers at scale.',
    ],
  },
]

const TIER_ORDER = TIERS.map(t => t.key)
const MESSAGING_CAP = 80
const POOL_RATE = 5   // credits per discovery/enrichment action -- confirmed by product, matches backend's DISCOVERY_CREDIT_COST (config/plans.py)
const SLIDER_MIN = 200
const SLIDER_MAX = 5600

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'
const TOKEN_KEY = 'nexara_token'

function fmt(n: number) {
  return '$' + n.toFixed(2)
}

function nearestTier(volume: number): Tier {
  let best = TIERS[0]
  let bestDiff = Infinity
  for (const t of TIERS) {
    const diff = Math.abs(t.credits - volume)
    if (diff < bestDiff) { bestDiff = diff; best = t }
  }
  return best
}

function poolFor(t: Tier) {
  return Math.floor((t.credits - MESSAGING_CAP) / POOL_RATE)
}

type ButtonState = { label: string; kind: 'current' | 'upgrade' | 'downgrade' | 'inert' }

export default function PricingPage() {
  const [isStudent, setIsStudent] = useState(false)
  const [sliderValue, setSliderValue] = useState(2000)
  const [detailsOpen, setDetailsOpen] = useState<string | null>(null)
  const [showClaimOfferModal, setShowClaimOfferModal] = useState(false)

  // null = not logged in (or still checking). A real tier key, or
  // 'career_plan', once known.
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)
  const [planChecked, setPlanChecked] = useState(false)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null
    if (!token) { setPlanChecked(true); return }

    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.plan) setCurrentPlan(data.plan)
      })
      .catch(() => {})
      .finally(() => setPlanChecked(true))
  }, [])

  const recommended = useMemo(() => nearestTier(sliderValue), [sliderValue])

  // Career-plan accounts aren't one of the four purchasable tiers, but
  // per the intended comparison they're treated as equivalent to
  // Starter for upgrade/downgrade purposes -- there's nothing below
  // Starter to "downgrade" to.
  const effectivePlanKey = currentPlan === 'career_plan' ? 'starter' : currentPlan

  function buttonState(tierKey: string): ButtonState {
    if (!planChecked || !effectivePlanKey || !TIER_ORDER.includes(effectivePlanKey)) {
      return { label: 'Coming soon', kind: 'inert' }
    }
    const currentRank = TIER_ORDER.indexOf(effectivePlanKey)
    const tileRank = TIER_ORDER.indexOf(tierKey)
    if (tileRank === currentRank) return { label: 'Current plan', kind: 'current' }
    if (tileRank > currentRank) return { label: 'Upgrade', kind: 'upgrade' }
    return { label: 'Downgrade', kind: 'downgrade' }
  }

  const sliderPct = ((sliderValue - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100
  const detailsTier = detailsOpen ? TIERS.find(t => t.key === detailsOpen) : null

  return (
    <div className="min-h-screen bg-white">

      <PublicNav />

      <section className="text-center max-w-2xl mx-auto px-6 pt-16 pb-10">
        <span className="inline-block text-[11px] font-semibold tracking-wide uppercase text-brand bg-brand-light px-3 py-1.5 rounded-full mb-4">
          Pricing
        </span>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-3">
          Outreach that scales<br />with your goals.
        </h1>
        <p className="text-gray-500 text-[15px] leading-relaxed">
          Nexara finds, researches, and messages the right people on LinkedIn for you - job
          seekers reaching recruiters, founders reaching investors, or businesses reaching
          customers. Pick the volume that matches how many conversations you&apos;re trying to start.
        </p>
      </section>

      <div className="flex justify-center mb-1 mt-6">
        <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-0.5">
          <button
            onClick={() => setIsStudent(false)}
            className={`px-5 py-2 rounded-md text-[13px] font-semibold transition-colors ${!isStudent ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            Standard
          </button>
          <button
            onClick={() => setIsStudent(true)}
            className={`px-5 py-2 rounded-md text-[13px] font-semibold transition-colors ${isStudent ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            Student
          </button>
        </div>
      </div>
      <p className="text-center text-xs text-gray-400 mb-12 h-4">
        {isStudent ? 'Student pricing requires .edu email verification at signup' : '\u00A0'}
      </p>

      {/* Credit dial -- the one signature interactive element on the page */}
      <div className="max-w-2xl mx-auto px-6 mb-14">
        <div className="card p-8 bg-gradient-to-b from-gray-50 to-white">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[13px] font-semibold text-gray-500">How many people are you trying to reach?</span>
            <span className="text-[15px] font-semibold text-brand">{sliderValue.toLocaleString()} prospects / day</span>
          </div>
          <div className="relative py-5">
            <div className="relative h-1.5 rounded-full bg-gray-100">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-brand-light to-brand"
                style={{ width: `${sliderPct}%` }}
              />
            </div>
            <div
              className="absolute top-1/2 w-[22px] h-[22px] rounded-full bg-brand border-[3px] border-white shadow-lg -translate-y-1/2 -translate-x-1/2 pointer-events-none"
              style={{ left: `${sliderPct}%` }}
            />
            <input
              type="range"
              min={SLIDER_MIN}
              max={SLIDER_MAX}
              step={10}
              value={sliderValue}
              onChange={e => setSliderValue(Number(e.target.value))}
              className="absolute top-0 left-0 w-full h-[26px] opacity-0 cursor-grab active:cursor-grabbing"
              aria-label="Daily prospect volume"
            />
          </div>
          <div className="flex justify-between text-[11px] text-gray-400 font-medium">
            <span>200</span><span>1,500</span><span>3,000</span><span>4,500</span><span>5,600+</span>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-3 mt-5 pt-5 border-t border-dashed border-gray-200">
            <p className="text-sm text-gray-500">
              Based on your volume, <b className="text-gray-900">{recommended.name}</b> fits best.
            </p>
            <div className="flex items-center gap-2 bg-brand-light text-brand-darker px-3.5 py-1.5 rounded-full text-[13px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-brand" />
              {poolFor(recommended).toLocaleString()} profiles/day researched
            </div>
          </div>
        </div>
      </div>

      {/* Limited-time promo */}
      <div className="max-w-5xl mx-auto px-6 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 mb-0.5">Limited-time offer</p>
              <p className="text-sm text-amber-900">
                Register by <b>August 31, 2026</b> and get the Growth plan free for your first month.
              </p>
            </div>
          </div>
          {planChecked && effectivePlanKey ? (
            <button
              onClick={() => setShowClaimOfferModal(true)}
              className="flex-shrink-0 text-xs font-semibold text-amber-900 bg-white border border-amber-300 px-4 py-2 rounded-lg hover:bg-amber-100 transition-colors"
            >
              Claim offer →
            </button>
          ) : (
            <Link
              href="/signup"
              className="flex-shrink-0 text-xs font-semibold text-amber-900 bg-white border border-amber-300 px-4 py-2 rounded-lg hover:bg-amber-100 transition-colors"
            >
              Claim offer →
            </Link>
          )}
        </div>
      </div>

      {/* Tier grid */}
      <section className="max-w-5xl mx-auto px-6 mb-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIERS.map(t => {
            const isRec = t.key === recommended.key
            const price = isStudent ? t.student : t.standard
            const btn = buttonState(t.key)
            return (
              <div
                key={t.key}
                className={`relative card p-6 transition-all duration-200 ${
                  isRec ? 'border-brand shadow-lg shadow-brand/10 -translate-y-1.5' : 'opacity-60'
                }`}
              >
                {isRec && (
                  <span className="absolute -top-2.5 left-6 bg-brand text-white text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full">
                    Recommended
                  </span>
                )}
                <p className="text-sm font-semibold text-gray-500 mb-1">{t.name}</p>
                <p className="text-xs text-gray-400 leading-snug mb-4 min-h-[32px]">{t.tagline}</p>

                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[28px] font-bold text-gray-900">{fmt(price)}</span>
                  {isStudent && <span className="text-sm text-gray-400 line-through">{fmt(t.standard)}</span>}
                  <span className="text-xs text-gray-400">/ month</span>
                </div>
                {isStudent && (
                  <div className="inline-flex items-center gap-1.5 bg-brand-light text-brand-darker text-xs font-bold px-2.5 py-1 rounded-full mt-2">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l4 6-4 14-4-14z" /></svg>
                    Save {t.discount}%
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100 text-[13px] text-gray-500">
                  <b className="text-gray-900">{t.credits.toLocaleString()}</b> credits / day
                </div>

                <button
                  disabled
                  className={`w-full mt-5 py-2.5 rounded-lg text-[13px] font-semibold cursor-not-allowed ${
                    btn.kind === 'current'
                      ? 'bg-brand-light text-brand-darker border border-brand'
                      : 'bg-white text-gray-400 border border-gray-200'
                  }`}
                >
                  {btn.label}
                </button>
                <button
                  onClick={() => setDetailsOpen(t.key)}
                  className="w-full mt-2 text-xs text-gray-500 underline hover:text-brand-darker"
                >
                  View details
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* Enterprise band */}
      <section className="max-w-5xl mx-auto px-6 mb-10">
        <div className="bg-gray-900 rounded-2xl p-8 md:p-11 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-white text-xl font-bold mb-1.5">Need something different?</h3>
            <p className="text-gray-400 text-sm max-w-md leading-relaxed">
              Bigger team, custom volume, or a plan that doesn&apos;t fit neatly into one of the
              above - tell us what you need and we&apos;ll build it.
            </p>
          </div>
          <a
            href="mailto:support@nikarva.com"
            className="flex-shrink-0 bg-white text-gray-900 font-semibold text-sm px-5 py-3 rounded-lg hover:opacity-90 transition-opacity"
          >
            Contact us →
          </a>
        </div>
      </section>

      <p className="text-center text-[13px] text-gray-500 pb-16">
        Enhance your job search - students save up to <b className="text-gray-900">33.3%</b> with a valid .edu email.
      </p>

      {/* Details modal */}
      {detailsTier && (
        <div
          className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-5 z-50"
          onClick={() => setDetailsOpen(null)}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-8 max-h-[88vh] overflow-y-auto relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setDetailsOpen(null)}
              aria-label="Close"
              className="absolute top-5 right-5 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500"
            >
              &times;
            </button>
            <p className="text-xs font-semibold text-brand mb-1">
              {detailsTier.key === recommended.key ? 'Recommended for you' : 'Plan details'}
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">{detailsTier.name}</h2>
            <p className="text-sm text-gray-500 mb-6">
              {fmt(isStudent ? detailsTier.student : detailsTier.standard)} / month
              {isStudent && ` (student, ${detailsTier.discount}% off)`}
            </p>

            {detailsTier.useCases && (
              <div className="bg-brand-light rounded-xl p-4 mb-2">
                <h5 className="text-[11px] font-bold uppercase tracking-wide text-brand-darker mb-2.5">Popular for</h5>
                <ul className="space-y-2">
                  {detailsTier.useCases.map((u, i) => (
                    <li key={i} className="text-[13px] text-gray-900 leading-relaxed pl-4 relative">
                      <span className="absolute left-0 text-brand">→</span>{u}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {[
              {
                on: true,
                title: 'Personalized LinkedIn outreach',
                body: `Send up to ${MESSAGING_CAP} tailored messages a day to new prospects - enough to keep real conversations moving without writing them yourself.`,
              },
              {
                on: true,
                title: 'Find & research prospects',
                body: `Discover and research up to ${poolFor(detailsTier).toLocaleString()} LinkedIn profiles a day - Nexara finds the right people and pulls what it can on them before you ever reach out.`,
              },
              {
                on: detailsTier.pdl > 0,
                title: 'Premium contact lookups',
                body: detailsTier.pdl > 0
                  ? `Unlock up to ${detailsTier.pdl} hard-to-find direct contacts a month, for the people who don't show up through a normal search.`
                  : `Available on Pro and Advanced - unlocks direct emails for people a normal search can't find.`,
              },
            ].map((b, i) => (
              <div key={i} className={`flex gap-3 py-3.5 border-t border-gray-100 ${i === 2 ? 'border-b' : ''}`}>
                <div className={`w-[26px] h-[26px] rounded-full flex-shrink-0 flex items-center justify-center text-[13px] mt-0.5 ${b.on ? 'bg-brand-light text-brand-darker' : 'bg-gray-100 text-gray-400'}`}>
                  {b.on ? '✓' : '-'}
                </div>
                <div>
                  <h4 className={`text-sm font-semibold mb-0.5 ${b.on ? 'text-gray-900' : 'text-gray-400'}`}>{b.title}</h4>
                  <p className="text-[13px] text-gray-500 leading-relaxed">{b.body}</p>
                </div>
              </div>
            ))}

            <button disabled className="w-full mt-6 py-3 rounded-lg bg-gray-900 text-white text-sm font-semibold cursor-not-allowed opacity-90">
              {buttonState(detailsTier.key).label}
            </button>
          </div>
        </div>
      )}

      {/* Claim-offer modal -- for an already-logged-in visitor. Sending them
          to /signup instead (a blank account-creation form with no guard
          against an existing session) is what used to look like being
          logged out and asked to sign in again. */}
      {showClaimOfferModal && (
        <div
          className="fixed inset-0 bg-gray-900/50 flex items-center justify-center p-5 z-50"
          onClick={() => setShowClaimOfferModal(false)}
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-8 relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowClaimOfferModal(false)}
              aria-label="Close"
              className="absolute top-5 right-5 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500"
            >
              &times;
            </button>
            <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">You&apos;re already set up</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              Email us at{' '}
              <a href="mailto:support@nikarva.com" className="text-brand font-medium hover:text-brand-darker">
                support@nikarva.com
              </a>{' '}
              to claim the Growth-plan promotion - we&apos;ll activate it on your account within one calendar day.
            </p>
            <button
              onClick={() => setShowClaimOfferModal(false)}
              className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Got it
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
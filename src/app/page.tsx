import type { Metadata } from 'next'
import Link from 'next/link'
import FAQAccordion from '@/components/FAQAccordion'
import PublicNav from '@/components/layout/PublicNav'
import PublicFooter from '@/components/layout/PublicFooter'

export const metadata: Metadata = {
  title: 'Nexara: Connect at Scale. Grow Without Limits.',
  description:
    'Nexara automates LinkedIn outreach for job seekers, founders, and businesses - finding recruiters, investors, or customers and writing personalized messages that get replies. Starts with free credits, plus student pricing available.',
  keywords: [
    'linkedin automation',
    'linkedin automation tool',
    'linkedin outreach tool',
    'linkedin outreach automation',
    'ai linkedin messages',
    'automated linkedin connection requests',
    'linkedin job search automation',
    'find hiring managers on linkedin',
    'cold email job search',
    'product marketing outreach',
    'linkedin outreach for founders',
    'reach customers without ads',
  ],
  openGraph: {
    title: 'Nexara: Connect at Scale. Grow Without Limits.',
    description:
      'Nexara automates LinkedIn outreach for job seekers, founders, and businesses - finding recruiters, investors, or customers and writing personalized messages that get replies. Starts with free credits, plus student pricing available.',
    type: 'website',
  },
}

interface Feature {
  icon: string
  title: string
  desc: string
  color: string
  comingSoon?: boolean
}

const FEATURES: Feature[] = [
  {
    icon: '🔍',
    title: 'Finds the right people for you',
    desc: 'Most LinkedIn automation tools assume you already have a lead list. Nexara finds engineers, hiring managers, and recruiters at your target companies for you - no CSV upload, no manual Sales Navigator search.',
    color: '#E1F5EE',
  },
  {
    icon: '✍️',
    title: 'Messages written for the person, not a template',
    desc: 'Every LinkedIn connection note and cold email is written specifically for that person and company - based on their role, recent hiring activity, and team growth. Not a mail-merge with {{first_name}} swapped in.',
    color: '#EEEDFE',
  },
  {
    icon: '✅',
    title: 'You approve first',
    desc: 'Review every message before it sends. The first 5 live messages go through you - approve them, and autopilot takes over from there. No babysitting every single send.',
    color: '#E6F1FB',
  },
  {
    icon: '🧠',
    title: 'Gets smarter over time',
    desc: 'Autopilot learns from what you approve and reject, and flags a template for you to switch up if it stops getting replies - so a stale message doesn\'t quietly burn through your credits.',
    color: '#F3E8FF',
  },
  {
    icon: '🔔',
    title: 'Alerted the moment it matters',
    desc: 'When someone accepts, replies, or asks a question, you get notified right away - not buried in a LinkedIn inbox you check once a day. Jump in while the conversation is still warm.',
    color: '#FDEBE3',
  },
  {
    icon: '📊',
    title: 'Track everything in one place',
    desc: 'Acceptance rate, reply rate, and full outreach history across every campaign - so you know what\'s actually working, not just that messages went out.',
    color: '#FAEEDA',
  },
  {
    icon: '🤝',
    title: 'You stay in touch with hiring managers and recruiters',
    desc: 'It\'s easy to connect with someone on LinkedIn and never speak to them again. Nexara keeps track of the connections you\'ve already made and follows up for you - so you stay in front of hiring managers and recruiters instead of quietly losing touch.',
    color: '#FEF3E2',
  },
  {
    icon: '📄',
    title: 'Resume matched to the same role',
    desc: 'Pair Nexara with AgentTina and the outreach note and your resume are built for the exact same job posting - instead of a generic resume and a generic connection request landing separately.',
    color: '#E1F0FA',
  },
]

// SEO/AEO note: each answer's first sentence is written as a complete,
// standalone claim -- answer engines (Google AI Overviews, ChatGPT,
// Perplexity) lift the first sentence verbatim, so it can't depend on the
// next one for context. Rendered both as visible copy below and as the
// FAQPage JSON-LD schema, generated from this same array so the two can't
// drift out of sync.
const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: 'Is LinkedIn automation safe to use on my account?',
    answer: "Nexara sends messages from your own LinkedIn account at a pace designed to stay within normal usage patterns, not a separate bot account posing as you. Messages go out in your voice, with daily caps and timing variation built in specifically to reduce the risk that comes with any LinkedIn automation tool, though as with any automation, some risk to your account standing always exists.",
  },
  {
    question: 'Will using Nexara get my LinkedIn account banned or restricted?',
    answer: "Nexara is built to minimize that risk, not eliminate it. LinkedIn can restrict any account it flags for automated behavior, regardless of which tool is used. Nexara reduces exposure through paced sending, daily volume caps, and a supervised mode that reviews your first several messages before handing control to autopilot.",
  },
  {
    question: 'Do I need LinkedIn Sales Navigator to use Nexara?',
    answer: 'No, Nexara does not require LinkedIn Sales Navigator or any paid LinkedIn add-on. Discovery and outreach both run through your existing regular LinkedIn account, with no additional LinkedIn subscription needed.',
  },
  {
    question: 'Does Nexara have a mobile app?',
    answer: 'Nexara works as an installable web app (PWA) on both iPhone and Android - add it to your home screen from your browser and it opens like a native app, with push notifications for anything that needs your attention in the moment: a reply worth reviewing, a LinkedIn disconnect, or a message waiting for your approval before it sends.',
  },
  {
    question: 'How much does LinkedIn outreach automation cost?',
    answer: "Nexara offers a free tier to start, with paid plans scaling by outreach volume as your campaigns grow. Pricing is usage-based rather than a flat SaaS fee, so cost tracks how much outreach you're actually running.",
  },
  {
    question: 'How do I set up LinkedIn automation for job searching or outreach?',
    answer: "Setup takes a few minutes: sign up free, connect your LinkedIn account, sync your existing connections, then launch your first campaign. Your first five messages are held for your approval before Nexara's autopilot takes over sending on its own.",
  },
  {
    question: 'Can I use Nexara for something other than job searching?',
    answer: 'Yes, Nexara is used for job search outreach to hiring managers and recruiters, product marketing outreach to potential customers, and investor outreach for fundraising, all through the same AI-personalized messaging system.',
  },
  {
    question: "Is Nexara included with AgentTina's career services plan?",
    answer: 'Yes, AgentTina career services clients get Nexara included automatically, activated with one click from the Activate your plan banner on their AgentTina dashboard.',
  },
  {
    question: 'Who do I contact for support with Nexara?',
    answer: 'Email support@nikarva.com for direct support on any account, billing, or technical issue.',
  },
]

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map(item => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
}

export default function PublicPage() {
  return (
    <div className="min-h-screen bg-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />

      <PublicNav />

      {/* Hero */}
      <div className="text-center px-6 py-14 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 text-xs text-gray-500 mb-6">
          <span className="w-2 h-2 rounded-full bg-[#1D9E75]" />
          LinkedIn automation for job seekers, founders & marketers
        </div>
        <h1 className="text-4xl md:text-5xl font-medium text-gray-900 leading-tight mb-4">
          Make more professional connections that turn into{' '}
          <span className="text-[#1D9E75]">interviews</span>
        </h1>
        <p className="text-gray-500 text-base mb-8 leading-relaxed">
          Nexara finds hiring managers, writes personalized connection notes and cold emails, and tells you the moment someone replies - while you focus on everything else.
        </p>
        <div className="flex flex-col items-center gap-3">
          <Link href="/signup" className="bg-sidebar text-white px-8 py-3 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            Start free - no Credit Card needed
          </Link>
          <p className="text-xs text-gray-400">
            Get free credits on your first signup to try discovery and outreach.{' '}
            <Link href="/terms" className="underline hover:text-gray-600">T&C apply</Link>
          </p>
          <a href="#how-it-works" className="text-xs text-gray-500 underline hover:text-gray-700">
            Curious how this actually works?
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">

        {/* Why it's different */}
        <div className="border border-gray-100 rounded-xl p-6 bg-white">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Why this is different</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            Most LinkedIn automation tools charge you to send messages to a list <em>you</em> already built.
            You still have to find the right people yourself before any of them are useful. Nexara does the
            finding - discovering hiring managers and recruiters at your target companies - and the writing,
            so the only thing left for you to do is hit approve.
          </p>
        </div>

        {/* Not just job search -- product marketing / fundraising use case */}
        <div className="border border-gray-100 rounded-xl p-6 bg-white">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Also built for product marketing</p>
          <p className="text-sm text-gray-700 leading-relaxed">
            Nexara isn&apos;t only for job seekers. Founders and marketers use it to reach the exact people who&apos;d
            want their product directly - instead of spending a lot of money on ad space that reaches everyone but
            the people who actually need it. The same discovery-and-personalized-outreach engine that finds hiring
            managers also finds potential customers and investors, on autopilot.
          </p>
        </div>

        {/* Features */}
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">What Nexara does</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-5 bg-white">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base mb-3" style={{ background: f.color }}>
                  {f.icon}
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <p className="text-sm font-medium text-gray-900">{f.title}</p>
                  {f.comingSoon && (
                    <span className="text-[9px] uppercase tracking-wide font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {f.title === 'Resume matched to the same role' ? (
                    <>
                      Pair Nexara with{' '}
                      <a
                        href="https://tina.nikarva.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        AgentTina
                      </a>{' '}
                      and the outreach note and your resume are built for the exact same job posting - instead of a generic resume and a generic connection request landing separately.
                    </>
                  ) : f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* How it works (anchor target for the hero link) */}
        <div id="how-it-works" className="space-y-10 scroll-mt-6">

          {/* How messages get sent */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">How your outreach gets sent</p>
            <div className="border border-gray-100 rounded-xl bg-white divide-y divide-gray-50">
              {[
                {
                  n: '1',
                  title: 'We find the person and pick the channel',
                  desc: 'Once Nexara finds a hiring manager or recruiter at your target company, it decides whether a LinkedIn connection request or a cold email is the better way to reach them, based on what contact info is actually available.',
                },
                {
                  n: '2',
                  title: 'The message is written for that person specifically',
                  desc: 'The note references something real about them or their team - a recent hire, a job posting, team growth - instead of a generic template with your name dropped in. LinkedIn notes and cold emails are both written this way.',
                },
                {
                  n: '3',
                  title: 'It goes out through your own LinkedIn account',
                  desc: 'Messages send from your account, in your voice, so replies land in your own inbox and conversations continue naturally from there.',
                },
              ].map(step => (
                <div key={step.n} className="flex gap-4 px-5 py-4">
                  <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">
                    {step.n}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-1">{step.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* How autopilot mode works */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">How autopilot mode works</p>
            <div className="border border-gray-100 rounded-xl bg-white divide-y divide-gray-50">
              {[
                {
                  n: '1',
                  title: 'You start in supervised mode',
                  desc: 'Every message is drafted and held for your review first. Nothing sends without you seeing it.',
                },
                {
                  n: '2',
                  title: 'The first 5 live messages need your approval',
                  desc: 'You approve, edit, or reject each one individually. This is where autopilot learns what a "good" message looks like for you - the tone you keep, the ones you reject, and why.',
                },
                {
                  n: '3',
                  title: 'After that, autopilot takes over',
                  desc: 'Once you\'ve approved the first 5, new messages send on their own without waiting for your review - built on the pattern of what you already approved.',
                },
                {
                  n: '4',
                  title: 'If a template stops working, you\'re told',
                  desc: 'Autopilot keeps an eye on reply rate per template. If one starts underperforming, you get flagged to switch it - instead of autopilot quietly sending a dead template to fifty more people on your credits.',
                },
              ].map(step => (
                <div key={step.n} className="flex gap-4 px-5 py-4">
                  <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">
                    {step.n}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-1">{step.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Frequently asked questions</p>
          <FAQAccordion items={FAQ_ITEMS} />
        </div>

        {/* Bottom CTA */}
        <div className="bg-sidebar rounded-2xl p-8 text-center">
          <h2 className="text-xl font-medium text-white mb-2">Ready to get more interviews?</h2>
          <p className="text-sm text-sidebar-muted mb-6">Free to start. No credit card. Connect LinkedIn and launch your first campaign in a few minutes.</p>
          <Link href="/signup" className="inline-block bg-white px-8 py-3 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity" style={{ color: '#0B3C81' }}>
            Start free - no Credit Card needed →
          </Link>
        </div>
      </div>

      <PublicFooter />
    </div>
  )
}
// REPO: nexara-frontend
// PATH: src/app/insights/reach-investors-linkedin-cold-outreach/page.tsx
import type { Metadata } from 'next'
import InsightLayout from '@/components/insights/InsightLayout'

export const metadata: Metadata = {
  title: 'How to Reach Investors on LinkedIn Without a Warm Intro | Nexara',
  description: "Warm intros convert best, but they're not the only path. Here's what makes a cold LinkedIn message to an investor actually get a reply.",
}

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How do I cold message investors on LinkedIn?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Name the specific reason that investor is a fit based on their actual portfolio or thesis, lead with a traction or proof point rather than burying it, skip attaching a pitch deck on the first message, and keep the message brief with a clear, low-friction ask.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can you reach investors without a warm introduction?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, a well-researched, specific cold message on LinkedIn is a legitimate second channel to reach investors, though warm introductions still convert at a higher rate where available.',
      },
    },
  ],
}

export default function ReachInvestorsPage() {
  return (
    <InsightLayout title="How to Reach Investors on LinkedIn Without a Warm Intro" faqSchema={FAQ_SCHEMA}>
      <p>
        Cold outreach to investors on LinkedIn works when it&apos;s specific to that investor&apos;s actual thesis
        and portfolio, not a generic pitch deck attachment - most investors ignore blanket cold pitches but will
        engage with a message that shows the founder has done real research on why that specific investor is a fit.
      </p>

      <div>
        <h2>Why &quot;warm intro only&quot; isn&apos;t the whole story anymore</h2>
        <p>
          Warm introductions remain the highest-conversion path into an investor&apos;s inbox, but they&apos;re not
          the only path, and not every founder has access to a network that produces them. A well-researched,
          specific cold message on LinkedIn is a legitimate second channel - not a replacement for warm intros, but
          not something to dismiss either.
        </p>
      </div>

      <div>
        <h2>What separates a cold pitch that gets ignored from one that gets a reply</h2>
        <ul>
          <li><strong>Naming the specific reason this investor, not &quot;any investor&quot;</strong> - their actual portfolio, thesis, or a specific fund they lead, referenced accurately</li>
          <li><strong>Traction or proof point up front</strong>, not buried - a number, a milestone, a signal that this isn&apos;t a first-time idea-stage cold call</li>
          <li><strong>No attachment on the first message</strong> - a pitch deck attached to a cold LinkedIn message reads as spam; the ask should be a short conversation, with materials to follow if there&apos;s interest</li>
          <li><strong>Brevity</strong> - investors see volume; a message that respects their time gets further than one that tries to make the full case up front</li>
        </ul>
      </div>

      <div>
        <h2>The volume-vs-precision tradeoff</h2>
        <p>
          Fundraising outreach is a smaller, higher-value audience than job-search outreach - a founder isn&apos;t
          messaging hundreds of investors, they&apos;re messaging a carefully researched list of dozens who are an
          actual thesis fit. Precision matters more than volume in this category specifically, which changes what
          &quot;automation&quot; should even mean here: research and personalization matter more than raw send
          volume.
        </p>
      </div>

      <div>
        <h2>Where Nexara fits in this</h2>
        <p>
          The same discovery-and-personalization pipeline built for job-seeker outreach applies directly to
          investor outreach - finding the right person, researching their actual background before drafting
          anything, and keeping every message reviewable before it sends, which matters even more in a category
          where one badly-targeted cold pitch can burn a relationship with a fund a founder may want to approach
          again later.
        </p>
      </div>
    </InsightLayout>
  )
}

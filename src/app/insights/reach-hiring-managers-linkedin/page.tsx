// REPO: nexara-frontend
// PATH: src/app/insights/reach-hiring-managers-linkedin/page.tsx
import type { Metadata } from 'next'
import InsightLayout from '@/components/insights/InsightLayout'

export const metadata: Metadata = {
  title: 'How to Reach Hiring Managers Directly on LinkedIn | Nexara',
  description: "Applying through job boards means competing against hundreds of applicants filtered by ATS keywords. Here's how to reach the actual hiring manager instead.",
}

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How do I reach hiring managers directly on LinkedIn?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Find the actual hiring manager or team lead for the role, send a short, specific message referencing something real about the role or company, and make a clear, low-friction ask like a short call rather than a vague request.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is direct LinkedIn outreach better than applying through job boards?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Direct outreach often outperforms job board applications because most applications are filtered by ATS keyword matching before a human reviews them, while a direct message to a hiring manager is read as a message, not parsed as a resume.',
      },
    },
  ],
}

export default function ReachHiringManagersPage() {
  return (
    <InsightLayout title="How to Reach Hiring Managers Directly on LinkedIn (Instead of Just Applying)" faqSchema={FAQ_SCHEMA}>
      <p>
        Reaching a hiring manager directly on LinkedIn works better than applying through a job board because most
        roles receive hundreds of applications that get filtered by ATS keyword matching before a human ever sees
        them - a direct, personalized message gets read by a person on the first try.
      </p>

      <div>
        <h2>Why direct outreach outperforms applying</h2>
        <p>
          Job boards optimize for volume, not fit. A hiring manager posting a single role commonly receives 100+
          applications within days; most companies&apos; ATS systems filter a meaningful share of those before
          human review based on keyword and formatting match alone. A well-targeted LinkedIn message to the actual
          hiring manager or team lead bypasses that filter entirely - it&apos;s read as a message, not parsed as a
          resume.
        </p>
      </div>

      <div>
        <h2>What makes a cold outreach message actually get a reply</h2>
        <ul>
          <li><strong>Specific, not generic</strong> - referencing something real about the role, the team, or a recent company update, not &quot;I&apos;m interested in opportunities at your company&quot;</li>
          <li><strong>Short</strong> - three to five sentences; hiring managers skim, they don&apos;t read cover letters in their inbox</li>
          <li><strong>A clear, low-friction ask</strong> - &quot;open to a 10-minute call&quot; beats &quot;let me know if there&apos;s anything available&quot;</li>
          <li><strong>Sent to the right person</strong> - the actual hiring manager or team lead for the role, not a generic recruiter or HR inbox, wherever that&apos;s identifiable</li>
        </ul>
      </div>

      <div>
        <h2>The referral math</h2>
        <p>
          A referral or direct hiring-manager conversation moves a candidate past the initial screening stage that
          most applications never clear. Reaching 20 relevant hiring managers with a genuinely personalized message
          consistently outperforms submitting 200 generic applications, because the constraint isn&apos;t how many
          jobs exist - it&apos;s how many of your applications actually get read by a person.
        </p>
      </div>

      <div>
        <h2>Where Nexara fits in this</h2>
        <p>
          The platform is built around this exact workflow - finding the right person at a target company (not just
          any recruiter), drafting a personalized opening based on that person&apos;s actual background and the
          role, and sending it from the user&apos;s own LinkedIn account in their own voice, reviewed before it
          sends.
        </p>
      </div>
    </InsightLayout>
  )
}

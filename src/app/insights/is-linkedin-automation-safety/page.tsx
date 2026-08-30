// REPO: nexara-frontend
// PATH: src/app/insights/is-linkedin-automation-safety/page.tsx
import type { Metadata } from 'next'
import InsightLayout from '@/components/insights/InsightLayout'

export const metadata: Metadata = {
  title: 'Is LinkedIn Automation Safe? What Gets Accounts Restricted | Nexara',
  description: "LinkedIn automation is safe when it mimics human behavior - paced sends, message variation, warmup periods. Here's exactly what triggers LinkedIn's detection systems and what doesn't.",
}

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is LinkedIn automation safe?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "LinkedIn automation is safe when it mimics real human behavior: paced sending, daily volume limits, and messages sent from your own account rather than a bot. It becomes risky when tools send at bulk-scraper volume, skip warmup periods, or use shared infrastructure that LinkedIn's detection systems flag.",
      },
    },
    {
      '@type': 'Question',
      name: 'How does LinkedIn detect automated activity?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'LinkedIn detects automation through behavioral signals: volume spikes, mechanically regular timing between actions, repeated template text, aggressive activity on new accounts with no warmup, and IP or device fingerprint anomalies.',
      },
    },
  ],
}

export default function IsLinkedInAutomationSafetyPage() {
  return (
    <InsightLayout title="Is LinkedIn Automation Safe? What Actually Gets Accounts Restricted" faqSchema={FAQ_SCHEMA}>
      <p>
        LinkedIn automation is safe when it mimics real human behavior - paced sending, daily volume limits, and
        messages sent from your own account rather than a bot. It becomes risky when tools send at bulk-scraper
        volume, skip warmup periods on new accounts, or use shared/rotating infrastructure that LinkedIn&apos;s
        detection systems flag as coordinated abuse.
      </p>

      <div>
        <h2>How LinkedIn actually detects automation</h2>
        <p>
          LinkedIn&apos;s detection isn&apos;t primarily about <em>whether</em> you&apos;re using a tool - it&apos;s
          about behavioral signals that deviate from normal human usage:
        </p>
        <ul>
          <li><strong>Volume spikes</strong>: jumping from near-zero activity to 100+ connection requests in a day</li>
          <li><strong>Timing regularity</strong>: messages sent at mechanically consistent intervals (every 47 seconds, for example) rather than the natural irregularity of a person typing and clicking</li>
          <li><strong>Template repetition</strong>: identical or near-identical message text sent to many recipients</li>
          <li><strong>New account aggression</strong>: a freshly created or recently reactivated account immediately sending at high volume, with no warmup period</li>
          <li><strong>IP and device fingerprint anomalies</strong>: activity from data-center IPs or shared infrastructure rather than the account&apos;s normal device/location pattern</li>
        </ul>
      </div>

      <div>
        <h2>What actually reduces risk</h2>
        <ul>
          <li>Daily send caps well under LinkedIn&apos;s own soft limits, not maxed out for volume</li>
          <li>Randomized delays between actions instead of fixed intervals</li>
          <li>Message variation rather than one template blasted to hundreds of people</li>
          <li>A warmup period for new or recently reconnected accounts before scaling to full volume</li>
          <li>Human review before send, at least initially - catching an obviously bot-like message before it goes out is cheaper than recovering a restricted account</li>
        </ul>
      </div>

      <div>
        <h2>Where Nexara fits in this</h2>
        <p>
          Messages send from the user&apos;s own LinkedIn account with daily caps and randomized delays built into
          every campaign by default, and new campaigns start in supervised mode - the first several messages
          require manual approval before the system moves to autonomous sending. That sequencing exists
          specifically because the biggest early-stage risk isn&apos;t the sending logic, it&apos;s an unreviewed
          AI-drafted message going out sounding obviously automated.
        </p>
        <p className="mt-3">
          No automation tool - Nexara included - can guarantee zero account risk, because LinkedIn&apos;s
          enforcement decisions are LinkedIn&apos;s alone. The realistic goal is minimizing the behavioral signals
          that trigger review, not eliminating platform risk entirely.
        </p>
      </div>
    </InsightLayout>
  )
}

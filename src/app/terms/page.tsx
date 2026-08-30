// REPO: nexara-frontend
// PATH: src/app/terms/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import LegalLayout, { type LegalSection } from '@/components/legal/LegalLayout'
import { DocumentIcon } from '@/components/legal/icons'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing your use of Nexara, an AI-powered LinkedIn outreach automation platform operated by Nikarva Technologies LLC.',
}

const LAST_UPDATED = 'August 18, 2026'

const SECTIONS: LegalSection[] = [
  { id: 'section-1', label: '1. Service Description' },
  { id: 'section-2', label: '2. Eligibility' },
  { id: 'section-3', label: '3. Your LinkedIn Account' },
  { id: 'section-4', label: '4. Supervised Mode and Autopilot' },
  { id: 'section-5', label: '5. Acceptable Use' },
  { id: 'section-6', label: '6. No Outcome Guarantee' },
  { id: 'section-7', label: '7. AI-Generated Content' },
  { id: 'section-8', label: '8. Subscription, Credits, and Daily Limits' },
  { id: 'section-9', label: '9. LinkedIn Account Disconnection' },
  { id: 'section-10', label: '10. Account Suspension' },
  { id: 'section-11', label: '11. International Use' },
  { id: 'section-12', label: '12. Account Deletion' },
  { id: 'section-13', label: '13. Intellectual Property' },
  { id: 'section-14', label: '14. Limitation of Liability' },
  { id: 'section-15', label: '15. Governing Law' },
  { id: 'section-16', label: '16. Changes to These Terms' },
  { id: 'section-17', label: '17. Contact' },
]

export default function TermsPage() {
  return (
    <LegalLayout
      icon={<DocumentIcon />}
      iconBg="bg-brand-light"
      iconColor="#085041"
      title="Terms of Service"
      lastUpdated={LAST_UPDATED}
      sections={SECTIONS}
      contactSectionId="section-17"
      contactSectionLabel="17. Contact"
      currentPath="/terms"
    >
      <section id="section-1">
        <h2>1. Service Description</h2>
        <p>
          Nexara is an AI-powered outreach automation platform operated by Nikarva Technologies LLC (&quot;Nikarva,&quot;
          &quot;we,&quot; &quot;us,&quot; &quot;our&quot;). Nexara helps you find and reach relevant people on LinkedIn - whether
          you&apos;re a job seeker connecting with hiring managers and recruiters, a founder marketing a product, or someone
          raising funds and reaching out to investors - through AI-personalized connection requests and messages that you review
          and approve.
        </p>
        <p className="mt-2">
          Nexara operates on your own LinkedIn account. We do not create, sell, or manage LinkedIn accounts on your behalf.
        </p>
      </section>

      <section id="section-2">
        <h2>2. Eligibility</h2>
        <p>You must be at least 18 years old to use Nexara. By creating an account, you confirm that you meet this requirement.</p>
      </section>

      <section id="section-3">
        <h2>3. Your LinkedIn Account</h2>
        <p>
          Nexara automates actions on your LinkedIn account, within limits you control. LinkedIn&apos;s own Terms of Service
          govern what activity is permitted on their platform, and LinkedIn may restrict, limit, or suspend accounts it
          determines to be in violation of those terms.
        </p>
        <p className="mt-2">By using Nexara, you acknowledge that:</p>
        <ul>
          <li>Any automation tool carries inherent risk to your LinkedIn account standing.</li>
          <li>Nikarva is not liable for any restriction, suspension, or termination of your LinkedIn account resulting from your use of Nexara.</li>
          <li>Nexara&apos;s pacing and supervision features are designed to reduce this risk but cannot eliminate it.</li>
        </ul>
      </section>

      <section id="section-4">
        <h2>4. Supervised Mode and Autopilot</h2>
        <p>
          Campaigns default to <strong>Supervised Mode</strong>: AI-drafted messages and replies are queued for your review and
          approval before sending. You may enable <strong>Autopilot</strong> on a per-campaign basis, which sends AI-drafted
          messages without individual review.
        </p>
        <p className="mt-2">
          If you enable Autopilot, you accept responsibility for messages sent under your account without prior review,
          including their content and compliance with LinkedIn&apos;s terms and applicable law.
        </p>
      </section>

      <section id="section-5">
        <h2>5. Acceptable Use</h2>
        <p>You agree not to use Nexara to:</p>
        <ul>
          <li>Send unsolicited commercial spam at a volume or nature that would violate LinkedIn&apos;s commercial-use policies or applicable anti-spam law.</li>
          <li>Misrepresent your identity, affiliation, or the source of your outreach.</li>
          <li>Use another person&apos;s LinkedIn credentials or access an account without authorization.</li>
          <li>Scrape or extract data beyond what Nexara&apos;s intended discovery and enrichment features provide.</li>
          <li>Resell or redistribute access to Nexara or data obtained through it.</li>
        </ul>
        <p className="mt-2">
          You are solely responsible for the content of your outreach and for compliance with anti-spam, marketing, and
          solicitation laws applicable to you and your recipients. For how data surfaced through discovery and enrichment is
          handled on our side, see our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>

      <section id="section-6">
        <h2>6. No Outcome Guarantee</h2>
        <p>
          Nexara does not guarantee replies, connections, meetings, sales, funding, job offers, or any other specific outcome
          from outreach conducted through the platform.
        </p>
      </section>

      <section id="section-7">
        <h2>7. AI-Generated Content</h2>
        <p>
          Messages are drafted using AI language models. You retain final responsibility for message content sent under your
          account and name, whether sent in Supervised Mode or Autopilot.
        </p>
      </section>

      <section id="section-8">
        <h2>8. Subscription, Credits, and Daily Limits</h2>
        <ul>
          <li>Subscription tiers include defined daily limits for messaging and enrichment.</li>
          <li>Unused daily limits do not roll over or accumulate - each day&apos;s allowance expires at the end of that day.</li>
          <li>Subscriptions renew automatically unless canceled prior to the renewal date.</li>
        </ul>
      </section>

      <section id="section-9">
        <h2>9. LinkedIn Account Disconnection</h2>
        <p>
          If your LinkedIn account becomes disconnected mid-campaign, you will be alerted and Nexara will attempt reconnection.
          If reconnection is not restored within 24 hours due to a failure on Nexara&apos;s infrastructure, billing for the
          affected period will be recalculated and credited accordingly. Delays caused by your own reconnection process pause
          the affected period rather than triggering a credit.
        </p>
      </section>

      <section id="section-10">
        <h2>10. Account Suspension</h2>
        <p>
          We may suspend or terminate accounts that show patterns consistent with platform abuse, to protect the integrity of
          the service. No refund is issued for suspension resulting from a violation of these Terms.
        </p>
      </section>

      <section id="section-11">
        <h2>11. International Use</h2>
        <p>
          Nexara is offered to users globally, including job seekers, founders, and investors located outside the United
          States. All data is processed and stored in the United States. By using Nexara, you consent to this transfer and
          processing. If you are located in the European Economic Area, United Kingdom, or another jurisdiction with data
          protection laws governing international transfers, your continued use constitutes consent to processing in the
          United States on that basis.
        </p>
      </section>

      <section id="section-12">
        <h2>12. Account Deletion</h2>
        <p>
          If you delete your account, you may log in and reactivate it with all data intact for up to 20 days from the date of
          deletion. If not reactivated within that window, your account and associated data will be permanently deleted within
          30 days of the original deletion request. Once permanently deleted, account data cannot be recovered. See our{' '}
          <Link href="/privacy">Privacy Policy</Link> for more on how your data is retained and deleted.
        </p>
      </section>

      <section id="section-13">
        <h2>13. Intellectual Property</h2>
        <p>
          You retain ownership of your campaign data and outreach content. Nikarva retains all rights to the Nexara platform,
          technology, and branding.
        </p>
      </section>

      <section id="section-14">
        <h2>14. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, Nikarva Technologies LLC&apos;s liability arising from your use of Nexara is
          limited to the amount you paid in the 12 months preceding the claim. Nikarva is not liable for indirect, incidental,
          or consequential damages, including lost business, lost opportunities, or LinkedIn account restrictions.
        </p>
      </section>

      <section id="section-15">
        <h2>15. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the State of Wyoming, United States, without regard to conflict-of-law
          principles.
        </p>
      </section>

      <section id="section-16">
        <h2>16. Changes to These Terms</h2>
        <p>
          We may update these Terms from time to time. Material changes will be reflected by an updated &quot;Last
          updated&quot; date at the top of this page.
        </p>
      </section>
    </LegalLayout>
  )
}

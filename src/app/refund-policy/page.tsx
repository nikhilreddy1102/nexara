// REPO: nexara-frontend
// PATH: src/app/refund-policy/page.tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import LegalLayout, { type LegalSection } from '@/components/legal/LegalLayout'
import { RefundIcon } from '@/components/legal/icons'

export const metadata: Metadata = {
  title: 'Refund Policy',
  description: 'When and how refunds work for Nexara subscriptions.',
}

const LAST_UPDATED = 'August 18, 2026'

const SECTIONS: LegalSection[] = [
  { id: 'section-1', label: '1. Subscription Refunds' },
  { id: 'section-2', label: '2. Non-Refundable Activity' },
  { id: 'section-3', label: '3. Terms Violations' },
  { id: 'section-4', label: '4. Chargebacks' },
  { id: 'section-5', label: '5. Contact' },
]

export default function RefundPolicyPage() {
  return (
    <LegalLayout
      icon={<RefundIcon />}
      iconBg="bg-amber-50"
      iconColor="#B45309"
      title="Refund Policy"
      lastUpdated={LAST_UPDATED}
      sections={SECTIONS}
      contactSectionId="section-5"
      contactSectionLabel="5. Contact"
      currentPath="/refund-policy"
    >
      <section id="section-1">
        <h2>1. Subscription Refunds</h2>
        <p>
          Subscriptions may be canceled at any time. If you cancel mid-billing-cycle, a prorated refund will be issued for the
          unused portion of that cycle, provided the cancellation request is submitted through your account settings or by
          emailing <a href="mailto:support@nikarva.com">support@nikarva.com</a>.
        </p>
      </section>

      <section id="section-2">
        <h2>2. Non-Refundable Activity</h2>
        <p>
          Refunds are not available for any billing period in which live outreach messages have already been sent to real
          LinkedIn contacts through your campaigns. Sent messages represent an irreversible, consumed action and cannot be
          &quot;returned.&quot;
        </p>
      </section>

      <section id="section-3">
        <h2>3. Terms Violations</h2>
        <p>
          No refund will be issued if your account is suspended or terminated for violating our{' '}
          <Link href="/terms">Terms of Service</Link>, including patterns of platform abuse.
        </p>
      </section>

      <section id="section-4">
        <h2>4. Chargebacks</h2>
        <p>
          If you believe you were charged in error, please contact <a href="mailto:support@nikarva.com">support@nikarva.com</a>{' '}
          before initiating a dispute with your bank or card issuer. We aim to resolve billing issues directly and quickly.
        </p>
      </section>
    </LegalLayout>
  )
}

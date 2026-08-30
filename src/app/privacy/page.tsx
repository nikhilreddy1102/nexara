// REPO: nexara-frontend
// PATH: src/app/privacy/page.tsx
import type { Metadata } from 'next'
import LegalLayout, { type LegalSection } from '@/components/legal/LegalLayout'
import { ShieldIcon } from '@/components/legal/icons'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Nexara, operated by Nikarva Technologies LLC, collects, uses, and protects your data.',
}

const LAST_UPDATED = 'August 18, 2026'

const SECTIONS: LegalSection[] = [
  { id: 'section-1', label: '1. What We Collect' },
  { id: 'section-2', label: '2. How We Use Your Data' },
  { id: 'section-3', label: '3. Third-Party Processing' },
  { id: 'section-4', label: '4. We Do Not Sell Your Data' },
  { id: 'section-5', label: '5. Data Security' },
  { id: 'section-6', label: '6. Data Retention and Deletion' },
  { id: 'section-7', label: '7. Your Rights' },
  { id: 'section-8', label: '8. International Users' },
  { id: 'section-9', label: "9. Children's Privacy" },
  { id: 'section-10', label: '10. Changes to This Policy' },
  { id: 'section-11', label: '11. Contact' },
]

export default function PrivacyPage() {
  return (
    <LegalLayout
      icon={<ShieldIcon />}
      iconBg="bg-blue-50"
      iconColor="#1D4ED8"
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      sections={SECTIONS}
      contactSectionId="section-11"
      contactSectionLabel="11. Contact"
      currentPath="/privacy"
    >
      <section id="section-1">
        <h2>1. What We Collect</h2>
        <ul>
          <li><strong>Account information</strong>: name, email, password (hashed), date of birth (where required for verification).</li>
          <li><strong>LinkedIn data</strong>: connection data, profile data, and messaging activity accessed through your authorized LinkedIn integration.</li>
          <li><strong>Discovery and enrichment data</strong>: profile and contact information (including email addresses, where available) surfaced through our discovery and enrichment features.</li>
          <li><strong>Message content</strong>: outreach messages and replies sent and received through the platform.</li>
          <li><strong>Payment information</strong>: processed by our payment provider; we do not store full card details.</li>
          <li><strong>Usage data</strong>: how you interact with Nexara, for support and product improvement purposes.</li>
        </ul>
      </section>

      <section id="section-2">
        <h2>2. How We Use Your Data</h2>
        <p>
          We use your data only to operate the campaigns and features you create and use - discovery, message drafting,
          delivery, reply handling, account management, and billing. We do not use your data for any secondary purpose,
          including training external AI models on your specific data, building a separate contact database independent of
          your account, or cross-user analytics tied to identifiable individuals, without separately notifying you.
        </p>
      </section>

      <section id="section-3">
        <h2>3. Third-Party Processing</h2>
        <p>We work with a limited set of service providers to operate Nexara, including:</p>
        <ul>
          <li>AI language processing providers, for message drafting</li>
          <li>LinkedIn integration and automation infrastructure providers</li>
          <li>Contact enrichment providers</li>
          <li>Payment processing providers</li>
          <li>Email delivery providers</li>
          <li>Database and hosting infrastructure providers</li>
        </ul>
        <p className="mt-2">
          These providers process data solely to help us deliver the service and are bound by their own confidentiality and
          security obligations.
        </p>
      </section>

      <section id="section-4">
        <h2>4. We Do Not Sell Your Data</h2>
        <p>
          <strong>Nexara does not sell, rent, or trade your personal information to third parties for their own marketing or
          commercial purposes.</strong>
        </p>
      </section>

      <section id="section-5">
        <h2>5. Data Security</h2>
        <p>
          We use reasonable technical and administrative measures to protect your data, including access controls limiting
          internal access to what&apos;s needed for support, billing, and abuse investigation. If a data security incident
          affects your information, we will notify you without undue delay.
        </p>
      </section>

      <section id="section-6">
        <h2>6. Data Retention and Deletion</h2>
        <p>
          If you delete your account, you may reactivate it with all data intact for up to 20 days. If not reactivated, your
          account and associated data will be permanently deleted from our systems within 30 days of your original deletion
          request. Once permanently deleted, data cannot be recovered.
        </p>
      </section>

      <section id="section-7">
        <h2>7. Your Rights</h2>
        <p>
          You may request access to, correction of, or deletion of your personal data at any time by contacting{' '}
          <a href="mailto:support@nikarva.com">support@nikarva.com</a>.
        </p>
      </section>

      <section id="section-8">
        <h2>8. International Users</h2>
        <p>
          Nexara is offered to users globally. All data is processed and stored in the United States, regardless of where you
          access the service from. By using Nexara, you consent to this transfer and processing.
        </p>
      </section>

      <section id="section-9">
        <h2>9. Children&apos;s Privacy</h2>
        <p>Nexara is not intended for anyone under 18. We do not knowingly collect data from anyone under this age.</p>
      </section>

      <section id="section-10">
        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Material changes will be reflected by an updated &quot;Last
          updated&quot; date at the top of this page.
        </p>
      </section>
    </LegalLayout>
  )
}

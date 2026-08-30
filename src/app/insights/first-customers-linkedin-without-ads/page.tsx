// REPO: nexara-frontend
// PATH: src/app/insights/first-customers-linkedin-without-ads/page.tsx
import type { Metadata } from 'next'
import InsightLayout from '@/components/insights/InsightLayout'

export const metadata: Metadata = {
  title: 'How to Get Your First Customers on LinkedIn Without Paid Ads | Nexara',
  description: "Early customers respond to a direct conversation with the person who built the product, not an ad. Here's how outreach-based customer acquisition actually works pre-revenue.",
}

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How do I get customers without paid ads?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Reach people who have the specific problem your product solves through direct outreach, lead with the problem rather than the product, offer something concrete like early access or founder support, and follow up on replies personally.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does LinkedIn outreach work for early-stage customer acquisition?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Yes, direct outreach on LinkedIn can outperform small paid ad budgets at the early stage because a well-targeted conversation converts at a much higher rate than an ad impression, trading time for the money most early-stage builders don't have.",
      },
    },
  ],
}

export default function FirstCustomersPage() {
  return (
    <InsightLayout title="How to Get Your First Customers on LinkedIn Without Paid Ads" faqSchema={FAQ_SCHEMA}>
      <p>
        Getting a product&apos;s first customers through LinkedIn outreach works because early buyers respond to a
        direct conversation with the person who built the thing, not to an ad - outreach at this stage is a
        relationship-building tool, not a sales-volume tool.
      </p>

      <div>
        <h2>Why paid ads don&apos;t work yet at this stage</h2>
        <p>
          Paid acquisition needs volume and budget to reach statistical significance - testing creative, audiences,
          and funnels takes spend most early-stage builders don&apos;t have. Direct outreach doesn&apos;t need scale
          to work; a single well-targeted conversation with the right prospect can produce a customer, a piece of
          feedback, or an introduction that ad spend at low budget almost never produces.
        </p>
      </div>

      <div>
        <h2>What makes outreach-based customer acquisition work</h2>
        <ul>
          <li><strong>Targeting people with the actual problem</strong>, not a broad job-title list - a specific pain point beats a demographic match every time</li>
          <li><strong>Leading with the problem, not the product</strong> - &quot;I noticed you&apos;re dealing with X&quot; gets a different response than &quot;check out my new tool&quot;</li>
          <li><strong>Offering something concrete early</strong> - early access, a free trial, direct founder support - not just a link to a landing page</li>
          <li><strong>Following up on replies personally</strong>, at least in the early stage - the goal at this volume is relationships, not a funnel</li>
        </ul>
      </div>

      <div>
        <h2>Why this scales better than it looks like it should</h2>
        <p>
          A founder doing 20 genuinely researched outreach conversations a week will often outperform a small paid
          ad budget in early-stage customer acquisition, because the conversion rate on a direct, relevant
          conversation is dramatically higher than an ad impression - the tradeoff is time, not money, which is
          usually the more available resource pre-revenue.
        </p>
      </div>

      <div>
        <h2>Where Nexara fits in this</h2>
        <p>
          The discovery and personalization pipeline applies here the same way - finding people who match a
          specific problem profile, not a broad title list, and starting a real conversation rather than a
          broadcast message, sent from the founder&apos;s own LinkedIn account so it reads as it actually is: one
          person reaching out to another.
        </p>
      </div>
    </InsightLayout>
  )
}

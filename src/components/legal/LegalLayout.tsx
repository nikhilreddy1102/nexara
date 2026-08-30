// REPO: nexara-frontend
// PATH: src/components/legal/LegalLayout.tsx
import Link from 'next/link'
import Image from 'next/image'

export interface LegalSection {
  id: string
  label: string
}

type LegalPagePath = '/terms' | '/privacy' | '/refund-policy'

interface LegalPageMeta {
  href: LegalPagePath
  label: string
}

// Single source of truth for the three legal routes -- each page passes
// its own href as `currentPath` and this filters itself out of the
// cross-link row, so adding a fourth legal page later only means adding
// one entry here.
const LEGAL_PAGES: LegalPageMeta[] = [
  { href: '/terms', label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/refund-policy', label: 'Refund Policy' },
]

interface LegalLayoutProps {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  title: string
  lastUpdated: string
  sections: LegalSection[]
  contactSectionId: string
  contactSectionLabel: string
  currentPath: LegalPagePath
  children: React.ReactNode
}

export default function LegalLayout({
  icon, iconBg, iconColor, title, lastUpdated, sections,
  contactSectionId, contactSectionLabel, currentPath, children,
}: LegalLayoutProps) {
  const otherPages = LEGAL_PAGES.filter(p => p.href !== currentPath)

  return (
    <div className="min-h-screen bg-white">
      <nav className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/nexara-icon-32.png" alt="Nexara" width={28} height={28} className="rounded-md" />
          <span className="text-[15px] font-semibold text-gray-900">Nexara</span>
        </Link>
        <Link href="/" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
          ← Back to Nexara
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">

        <div className="flex items-center gap-3 mb-2">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}
            style={{ color: iconColor }}
          >
            {icon}
          </div>
          <div>
            <h1 className="text-xl font-medium text-gray-900">{title}</h1>
            <p className="text-xs text-gray-400 mt-0.5">Last updated: {lastUpdated}</p>
          </div>
        </div>

        {/* Quick navigation -- anchors into this page's own sections only,
            so a long page is scannable without scrolling blind. */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 my-8">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Quick navigation</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
            {sections.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-xs text-gray-600 hover:text-brand-dark hover:underline truncate"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-8 text-sm text-gray-600 leading-relaxed [&_h2]:scroll-mt-6 [&_h2]:text-base [&_h2]:font-medium [&_h2]:text-gray-900 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:mt-2 [&_a]:text-brand-dark [&_a]:underline [&_a:hover]:text-brand-darker">
          {children}
        </div>

        {/* Contact -- last numbered section in the source doc, styled the
            same way across all three pages so it stands out from the
            plain-paragraph sections above it. */}
        <div
          id={contactSectionId}
          className="scroll-mt-6 bg-brand-light border border-brand/20 rounded-xl p-5 mt-10 flex items-center justify-between flex-wrap gap-3"
        >
          <div>
            <p className="text-sm font-medium text-brand-dark">{contactSectionLabel}</p>
            <p className="text-xs text-gray-600 mt-0.5">Questions about this page - we&apos;re happy to help.</p>
          </div>
          <a href="mailto:support@nikarva.com" className="text-sm font-medium text-brand-dark underline flex-shrink-0">
            support@nikarva.com
          </a>
        </div>

        {/* Cross-links to the other two legal pages */}
        <div className="flex items-center gap-4 mt-8 pt-6 border-t border-gray-100 text-xs text-gray-500">
          {otherPages.map(p => (
            <Link key={p.href} href={p.href} className="hover:text-gray-900 hover:underline">
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100 px-6 py-4 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} Nikarva Technologies
      </div>
    </div>
  )
}

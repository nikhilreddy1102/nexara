// REPO: nexara-frontend
// PATH: src/components/insights/InsightLayout.tsx
import Link from 'next/link'
import Image from 'next/image'

interface InsightLayoutProps {
  title: string
  faqSchema: Record<string, unknown>
  children: React.ReactNode
}

// Shared shell for the four /insights/* article pages -- nav, article
// body wrapper, footer, and the FAQPage JSON-LD script. Each page owns
// its own Metadata export (title tag + meta description come from the
// source doc verbatim) and passes its own faqSchema + body as children.
export default function InsightLayout({ title, faqSchema, children }: InsightLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <nav className="flex items-center justify-between px-6 md:px-10 py-4 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/nexara-icon-32.png" alt="Nexara" width={28} height={28} className="rounded-md" />
          <span className="text-[15px] font-semibold text-gray-900">Nexara</span>
        </Link>
        <Link href="/insights" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
          ← All insights
        </Link>
      </nav>

      <article className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-medium text-gray-900 leading-snug mb-6">{title}</h1>
        <div className="space-y-6 text-sm text-gray-600 leading-relaxed [&_h2]:text-base [&_h2]:font-medium [&_h2]:text-gray-900 [&_h2]:mb-2 [&_h2]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:mt-2 [&_strong]:text-gray-900 [&_strong]:font-medium">
          {children}
        </div>
      </article>

      <div className="border-t border-gray-100 px-6 py-4 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} Nikarva Technologies
      </div>
    </div>
  )
}

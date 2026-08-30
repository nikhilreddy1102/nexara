import Link from 'next/link'

// Shared footer -- same markup the landing page has always used, now also
// rendered on dashboard pages (inside the scrollable content area, to the
// right of the sidebar) so logged-in screens end with the same copyright/
// legal-links bar instead of just stopping.
export default function PublicFooter() {
  return (
    <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between text-xs text-gray-400">
      <span>© {new Date().getFullYear()} Nikarva Technologies</span>
      <div className="flex gap-4">
        <Link href="/privacy" className="hover:text-gray-600">Privacy</Link>
        <Link href="/terms" className="hover:text-gray-600">Terms</Link>
        <Link href="/refund-policy" className="hover:text-gray-600">Refund Policy</Link>
      </div>
    </div>
  )
}

// REPO: nexara-frontend
// PATH: src/app/activate/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { careerPlanApi } from '@/lib/api'

const TOKEN_KEY = 'nexara_token'
const REFRESH_KEY = 'nexara_refresh_token'

type Status = 'activating' | 'redirecting' | 'existing' | 'error'

export default function ActivatePage() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('activating')

  useEffect(() => {
    // Read the token directly off the URL client-side rather than
    // useSearchParams, same reasoning as signup's email prefill --
    // avoids forcing a Suspense boundary around this page for no
    // benefit.
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')

    if (!token) {
      setStatus('error')
      return
    }

    careerPlanApi.activate(token)
      .then(res => {
        if (res.existing_account) {
          // Already has a Nexara account -- plan upgraded server-side,
          // but no session bypass. Real login required, same as any
          // other returning user.
          setStatus('existing')
          setTimeout(() => router.push('/login'), 1500)
          return
        }

        if (!res.access_token || !res.refresh_token) {
          setStatus('error')
          return
        }

        localStorage.setItem(TOKEN_KEY, res.access_token)
        localStorage.setItem(REFRESH_KEY, res.refresh_token)
        setStatus('redirecting')
        // welcome=career_plan only ever set here -- existing_account
        // above redirects to /login instead, which never reaches this
        // line, so there's no path for the toast to fire on a repeat
        // "Open Nexara" click for someone already fully set up.
        router.push('/dashboard?welcome=career_plan')
      })
      .catch(() => {
        // Whatever went wrong (expired token, malformed, server error),
        // this page has no other context to work with -- one plain
        // failure state, point them at support rather than trying to
        // explain the specific cause of an unauthenticated failure.
        setStatus('error')
      })
  }, [router])

  return (
    <main className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-sm text-center px-6">
        {status === 'activating' && (
          <>
            <div className="w-8 h-8 mx-auto mb-4 rounded-full border-[3px] border-gray-200 border-t-brand animate-spin" />
            <p className="text-sm text-gray-600">Setting up your Nexara access...</p>
          </>
        )}

        {status === 'redirecting' && (
          <>
            <div className="w-8 h-8 mx-auto mb-4 rounded-full border-[3px] border-gray-200 border-t-brand animate-spin" />
            <p className="text-sm text-gray-600">Almost there...</p>
          </>
        )}

        {status === 'existing' && (
          <>
            <div className="w-8 h-8 mx-auto mb-4 rounded-full border-[3px] border-gray-200 border-t-brand animate-spin" />
            <p className="text-sm text-gray-600">Taking you to sign in...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="text-lg font-medium text-gray-900 mb-2">
              We couldn&apos;t activate your plan
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              This link may have expired. Please go back to your career
              services dashboard and try again, or reach out for help.
            </p>
            <p className="text-sm text-gray-500">
              <a href="mailto:support@nikarva.com" className="text-brand font-medium hover:text-brand-darker">
                support@nikarva.com
              </a>
            </p>
          </>
        )}
      </div>
    </main>
  )
}
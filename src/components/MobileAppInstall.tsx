// REPO: nexara-frontend
// PATH: src/components/MobileAppInstall.tsx
'use client'

import { useState } from 'react'
import { Smartphone, X } from 'lucide-react'

// Nexara is a PWA (see public/manifest.json) -- there's no native App
// Store / Play Store listing, so "install" means "add to home screen"
// through the browser. iOS goes first per Apple's Safari-only install
// path being the one people get stuck on; Android's Chrome menu is more
// discoverable on its own.
const STEPS: { platform: string; steps: string[] }[] = [
  {
    platform: 'iOS (Safari)',
    steps: [
      'Open nexara.nikarva.com in Safari',
      'Tap the Share icon in the toolbar',
      'Scroll down and tap "Add to Home Screen"',
      'Tap "Add" in the top right',
    ],
  },
  {
    platform: 'Android (Chrome)',
    steps: [
      'Open nexara.nikarva.com in Chrome',
      'Tap the ⋮ menu in the top right',
      'Tap "Install app" (or "Add to Home screen")',
      'Tap "Install" to confirm',
    ],
  },
]

function InstallSteps({ theme }: { theme: 'dark' | 'light' }) {
  const numberClass = theme === 'dark'
    ? 'bg-sidebar-border text-sidebar-bright'
    : 'bg-gray-100 text-gray-600'
  const platformClass = theme === 'dark' ? 'text-sidebar-bright' : 'text-gray-900'
  const stepClass = theme === 'dark' ? 'text-sidebar-muted' : 'text-gray-500'

  return (
    <div className="space-y-4">
      {STEPS.map(group => (
        <div key={group.platform}>
          <p className={`text-xs font-medium mb-2 ${platformClass}`}>{group.platform}</p>
          <ol className="space-y-1.5">
            {group.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className={`w-4 h-4 rounded-full text-[9px] font-medium flex items-center justify-center flex-shrink-0 mt-0.5 ${numberClass}`}>
                  {i + 1}
                </span>
                <span className={`text-xs leading-relaxed ${stepClass}`}>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}

// Rendered directly in the desktop login/signup side panel -- there's
// room for the full instructions inline, no need to hide them behind a
// click on a screen that's only ever shown at md+ width.
export function MobileAppNotice() {
  return (
    <div className="border-t border-sidebar-border pt-5 mt-5">
      <div className="flex items-center gap-2 mb-3">
        <Smartphone size={14} className="text-sidebar-bright" />
        <p className="text-sidebar-bright text-xs font-medium">Nexara is available as a mobile app too</p>
      </div>
      <InstallSteps theme="dark" />
    </div>
  )
}

// Rendered below the submit button on mobile only (md:hidden) -- the
// desktop side panel with MobileAppNotice isn't shown at this width, so
// this is a link into a modal carrying the same instructions instead.
export function MobileAppLink() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mt-5"
      >
        <Smartphone size={13} />
        Get Nexara as a mobile app
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-app-modal-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p id="mobile-app-modal-title" className="text-sm font-medium text-gray-900">Add Nexara to your home screen</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Opens and feels like an app, no App Store needed</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <InstallSteps theme="light" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

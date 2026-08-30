import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nexara | LinkedIn Outreach Automation',
  description: 'Smart LinkedIn outreach campaigns',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
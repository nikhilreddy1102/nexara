import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import SWRProvider from '@/components/SWRProvider'
import { AuthProvider } from '@/context/AuthContext'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/react'
import OfflineBanner from '@/components/OfflineBanner'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  themeColor: '#1D9E75',
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL('https://nexara.nikarva.com'),
  title: {
    default: 'Nexara | Outreach Automation',
    template: '%s | Nexara',
  },
  description:
    'Nexara is an intelligent outreach automation platform. Run fulltime hiring, C2C, and custom campaigns - find, research, and message the right people automatically.',
  keywords: [
    'outreach automation',
    'LinkedIn automation',
    'hiring outreach',
    'C2C outreach',
    'recruiter outreach',
    'AI outreach tool',
    'campaign automation',
    'Nexara',
    'Nikarva',
  ],
  authors: [{ name: 'Nikarva Technologies', url: 'https://nikarva.com' }],
  creator: 'Nikarva Technologies',
  publisher: 'Nikarva Technologies',
  category: 'Business Software',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://nexara.nikarva.com',
    siteName: 'Nexara',
    title: 'Nexara | Outreach Automation',
    description:
      'Intelligent outreach automation. Find, research, and message the right people - on autopilot.',
    images: [
      {
        url: '/nexara-icon-512.png',
        width: 512,
        height: 512,
        alt: 'Nexara Outreach Automation',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Nexara | Outreach Automation',
    description: 'Intelligent outreach automation built by Nikarva Technologies.',
    images: ['/nexara-icon-512.png'],
  },
  icons: {
    icon: [
      { url: '/nexara-icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/nexara-icon-64.png', sizes: '64x64', type: 'image/png' },
    ],
    apple: { url: '/nexara-icon-192.png', sizes: '192x192', type: 'image/png' },
    shortcut: '/favicon.ico',
  },
  manifest: '/manifest.json',
  robots: {
    index: true,
    follow: true,
    nocache: false,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <OfflineBanner />
        <SWRProvider>
          <AuthProvider>{children}</AuthProvider>
        </SWRProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
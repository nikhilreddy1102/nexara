import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/login', '/signup'],
        disallow: ['/dashboard', '/campaigns', '/targets', '/templates', '/inmail', '/analytics', '/settings'],
      },
    ],
    sitemap: 'https://nexara.nikarva.com/sitemap.xml',
  }
}
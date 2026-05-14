import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://hillcountryappliancerepair.com'

  const routes = [
    '',
    '/about',
    '/services',
    '/service-areas',
    '/contact',
    '/schedule',
    '/pay',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: route === '' ? 1 : 0.8,
  }))

  const serviceSlugs = [
    'refrigerator',
    'washer-dryer',
    'dishwasher',
    'oven-range',
    'ice-maker',
    'other',
  ]

  const serviceRoutes = serviceSlugs.map((slug) => ({
    url: `${baseUrl}/services/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [...routes, ...serviceRoutes]
}

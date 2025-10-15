import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Loom AI Memory',
    short_name: 'Loom AI',
    description: 'AI powered personal memory assistant for the digital age',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1ca04c',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    categories: ['productivity', 'utilities', 'business'],
    lang: 'en',
    scope: '/',
  }
}

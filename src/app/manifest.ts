import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Unaabs Smart Events',
    short_name: 'Smart Events',
    description: 'Run your event business: bookings, payments, quotes and a private portal for every customer.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#FBF6EC',
    theme_color: '#7A1F3D',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

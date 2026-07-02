import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Coffee Oasis',
    short_name: 'Coffee Oasis',
    description: 'Skip the line. Order your coffee ahead.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFF6E8',
    theme_color: '#F58220',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}

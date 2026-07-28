import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json(
    {
      name: 'Projetar Conforto — Staff',
      short_name: 'PC Staff',
      description: 'Backoffice de gestão da Projetar Conforto',
      start_url: '/admin',
      scope: '/admin',
      display: 'standalone',
      background_color: '#18191c',
      theme_color: '#18191c',
      icons: [
        { src: '/icons/admin-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/admin-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/admin-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } }
  );
}

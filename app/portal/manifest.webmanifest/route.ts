import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json(
    {
      name: 'Projetar Conforto',
      short_name: 'Projetar Conforto',
      description: 'Acompanhe a sua obra em tempo real',
      start_url: '/portal',
      scope: '/portal',
      display: 'standalone',
      background_color: '#faf1ea',
      theme_color: '#7c4324',
      icons: [
        { src: '/icons/portal-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/portal-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/portal-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } }
  );
}

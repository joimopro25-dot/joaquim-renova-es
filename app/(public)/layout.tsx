import type { Metadata } from 'next';

const SITE_URL = 'https://projetarconforto.pt';
const TITLE = 'Projetar Conforto | Renovações de Casas, Pladur, Capoto, Casas de Banho e Cozinhas';
const DESCRIPTION =
  'Empresa de renovações de casas em Portugal. Especialistas em pladur, capoto (isolamento térmico), remodelação de casas de banho, cozinhas, quartos e jardins. Peça já o seu orçamento sem compromisso.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'renovação de casas',
    'obras em casa',
    'pladur',
    'tetos falsos pladur',
    'capoto',
    'isolamento térmico exterior',
    'ETICS',
    'remodelação de casas de banho',
    'remodelação de cozinhas',
    'renovação de quartos',
    'jardins e exteriores',
    'empresa de renovações Portugal',
  ],
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    locale: 'pt_PT',
    siteName: 'Projetar Conforto',
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Projetar Conforto' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'HomeAndConstructionBusiness',
  name: 'Projetar Conforto',
  description: DESCRIPTION,
  url: SITE_URL,
  image: `${SITE_URL}/og-image.png`,
  telephone: '+351911918796',
  email: 'geral@projetarconforto.pt',
  areaServed: 'PT',
  priceRange: '€€',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'PT',
  },
  makesOffer: [
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Renovação de Casas de Banho' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Renovação de Cozinhas' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Pladur - Tetos e Paredes' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Capoto (Isolamento Térmico Exterior)' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Renovação de Quartos e Interiores' } },
    { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Jardins e Exteriores' } },
  ],
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  );
}

import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://projetarconforto.pt';
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/termos-condicoes`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/politica-privacidade`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}

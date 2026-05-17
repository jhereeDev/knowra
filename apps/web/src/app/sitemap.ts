import type { MetadataRoute } from 'next';

// Generates /sitemap.xml at build time. Keep this list in sync as new
// public pages are added — search engines pull this on their own
// schedule (typically daily for known sites).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://knowra.space';
  const now = new Date();

  return [
    {
      url: base,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${base}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}

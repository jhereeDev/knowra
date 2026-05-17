import type { MetadataRoute } from 'next';

// Generates /robots.txt on every build. Allows everything except the
// API routes (no point indexing JSON endpoints) and points crawlers at
// the sitemap so new pages get picked up faster.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/'],
      },
    ],
    sitemap: 'https://knowra.space/sitemap.xml',
    host: 'https://knowra.space',
  };
}

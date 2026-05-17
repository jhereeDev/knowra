import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

const SITE_URL = 'https://knowra.space';
const SITE_NAME = 'Knowra';
const TAGLINE = 'Expand your Knowra.';
const DESCRIPTION =
  "The curiosity feed. Every swipe surfaces a beautifully presented Wikipedia article — bite-sized hooks, hero images, and a built-in dark reader. Same dopamine loop as short-form video, redirected toward something worth your time.";

// Title template means child pages can override `title` to a short string
// (e.g. "Privacy") and the rendered <title> becomes "Privacy — Knowra"
// without each page repeating the brand. The default applies to the root.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${TAGLINE}`,
    template: `%s — ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'Wikipedia',
    'knowledge',
    'curiosity',
    'trivia',
    'learning',
    'facts',
    'reading',
    'discover',
    'feed',
    'cards',
  ],
  authors: [{ name: 'Jheremiah Figueroa' }],
  creator: 'Jheremiah Figueroa',
  publisher: SITE_NAME,
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${TAGLINE}`,
    description: DESCRIPTION,
    locale: 'en_US',
    // opengraph-image.png in app/ is auto-attached by Next 15 — keeping
    // an explicit entry here makes the URL absolute (some scrapers
    // require it).
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — ${TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${TAGLINE}`,
    description: DESCRIPTION,
    images: ['/twitter-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'reference',
  // Hint to install prompts that we have a native app — the mobile
  // links will eventually point at App Store + Play Store IDs.
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: 'black-translucent',
  },
};

// Viewport / theme color used by mobile browser chrome — split out of
// `metadata` per Next 15's API.
export const viewport: Viewport = {
  themeColor: '#05071a',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const body = (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
  // ClerkProvider is opt-in via env var so dev/test builds without
  // Clerk credentials still render cleanly.
  if (!CLERK_ENABLED) return body;
  return <ClerkProvider>{body}</ClerkProvider>;
}

import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Knowra — expand your Knowra',
  description: 'The curiosity feed. TikTok mechanic, Wikipedia content.',
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

import Link from 'next/link';

// Shared shell for /privacy and /terms. Keeps the back link and
// attribution footer in one place.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:py-16">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="text-xl font-semibold tracking-tight text-knowverse-star transition hover:opacity-80"
        >
          Knowra
        </Link>
        <Link
          href="/"
          className="text-xs text-knowverse-star/60 transition hover:text-knowverse-star"
        >
          ← Back to home
        </Link>
      </header>

      <article className="mt-12 text-knowverse-star/85">{children}</article>

      <footer className="mt-auto pt-16 text-xs text-knowverse-star/40">
        <p>
          Questions? Email{' '}
          <a
            href="mailto:jheremiah.dev@gmail.com"
            className="underline hover:text-knowverse-star/70"
          >
            jheremiah.dev@gmail.com
          </a>
          .
        </p>
      </footer>
    </main>
  );
}

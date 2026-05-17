import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How we use Wikipedia — Knowra',
  description:
    'Knowra is a curiosity feed. Every card is a Wikipedia article, used under CC BY-SA 4.0 with attribution.',
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 sm:py-20">
      <Link href="/" className="text-xs text-knowverse-star/50 hover:text-knowverse-star">
        ← Back
      </Link>

      <h1 className="mt-6 text-4xl font-semibold tracking-tight">
        How we use Wikipedia
      </h1>
      <p className="mt-3 text-sm text-knowverse-star/60">
        The short version of a long commitment.
      </p>

      <article className="mt-12 space-y-8 text-base leading-relaxed text-knowverse-star/80">
        <Block heading="The content is Wikipedia.">
          Every article you see in Knowra comes from{' '}
          <a
            href="https://en.wikipedia.org"
            className="underline hover:text-knowverse-star"
          >
            Wikipedia
          </a>
          . We render a short preview — title, image, two-sentence hook — and a
          "Go deeper" button that takes you to the full article on Wikipedia.
          We don't write the encyclopedia; we just bring you to it.
        </Block>

        <Block heading="Licensed CC BY-SA 4.0.">
          Wikipedia content is licensed under{' '}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            className="underline hover:text-knowverse-star"
          >
            Creative Commons Attribution-ShareAlike 4.0
          </a>
          . We treat any derivative we generate — like the AI-written hooks —
          as falling under the same license. Attribution and the source link
          travel with every card.
        </Block>

        <Block heading="We pledge 5% of revenue to Wikimedia.">
          For the first three years of meaningful revenue, 5% goes to the{' '}
          <a
            href="https://wikimediafoundation.org/"
            className="underline hover:text-knowverse-star"
          >
            Wikimedia Foundation
          </a>
          . If we get acquired, the pledge follows.
        </Block>

        <Block heading="We try to be a good citizen of the API.">
          Every call to Wikipedia carries a <code>User-Agent</code> with a
          contact email. We cache aggressively so we don't hammer their
          servers, and we'll honor rate limits gracefully if we ever hit them.
          If you're from the Wikimedia community and we're doing something
          inconsiderate, write us:{' '}
          <a
            href="mailto:dev@knowra.space"
            className="underline hover:text-knowverse-star"
          >
            dev@knowra.space
          </a>
          .
        </Block>

        <Block heading="What we won't do.">
          We won't train models on Wikipedia content beyond the hooks we
          generate. We won't gate access to Wikipedia behind a paywall — every
          article is one tap away from the live source. We won't use Wikipedia
          content to imply Wikimedia endorses or is affiliated with Knowra.
        </Block>
      </article>

      <footer className="mt-16 border-t border-knowverse-star/10 pt-6 text-xs text-knowverse-star/40">
        Knowra is independent and not affiliated with the Wikimedia Foundation.
      </footer>
    </main>
  );
}

function Block({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-knowverse-star text-lg font-semibold">{heading}</h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}

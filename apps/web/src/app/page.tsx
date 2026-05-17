import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-12 sm:py-20">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Knowra</h1>
        <nav className="flex gap-5 text-xs text-knowverse-star/60">
          <Link href="/about" className="hover:text-knowverse-star">
            How we use Wikipedia
          </Link>
        </nav>
      </header>

      <section className="mt-20 sm:mt-32">
        <h2 className="text-5xl font-semibold leading-tight sm:text-6xl">
          The curiosity feed.
        </h2>
        <p className="mt-6 max-w-xl text-lg text-knowverse-star/70">
          TikTok mechanic, Wikipedia content. Same dopamine loop —
          redirected toward something worth your time.
        </p>
        <p className="mt-3 text-sm italic text-knowverse-star/50">
          Expand your Knowra.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href="#waitlist"
            className="rounded-full bg-knowverse-star px-6 py-3 text-sm font-semibold text-knowverse-deep transition hover:opacity-90"
          >
            Join the waitlist
          </a>
          <Link
            href="/about"
            className="rounded-full border border-knowverse-star/20 px-6 py-3 text-sm text-knowverse-star/80 transition hover:border-knowverse-star/50"
          >
            How it works
          </Link>
        </div>
      </section>

      <section className="mt-24 grid gap-6 sm:grid-cols-3">
        <Pillar
          title="Bite-sized"
          body="Every card is a Wikipedia article with a striking image and a two-sentence hook. Swipe up for the next one."
        />
        <Pillar
          title="Personal, not creepy"
          body="No tracking for ads. No App Tracking Transparency prompt. The feed learns from how you swipe — that's it."
        />
        <Pillar
          title="Respect the source"
          body="Every article links back to Wikipedia. We pledge 5% of revenue to the Wikimedia Foundation."
        />
      </section>

      <footer className="mt-auto pt-24 text-xs text-knowverse-star/40">
        <p>
          Content from Wikipedia, licensed{' '}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            className="underline hover:text-knowverse-star/70"
          >
            CC BY-SA 4.0
          </a>
          . Knowra is independent and not affiliated with the Wikimedia Foundation.
        </p>
        <p className="mt-2">
          API:{' '}
          <Link href="/api/health" className="underline hover:text-knowverse-star/70">
            /api/health
          </Link>
        </p>
      </footer>
    </main>
  );
}

function Pillar({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-knowverse-star/10 bg-knowverse/30 p-5">
      <h3 className="text-base font-semibold text-knowverse-star">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-knowverse-star/60">{body}</p>
    </div>
  );
}

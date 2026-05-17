import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support — Knowra',
  description: 'How to get help with Knowra: contact, account deletion, FAQs.',
};

export default function SupportPage() {
  return (
    <>
      <h1 className="text-4xl font-semibold tracking-tight text-knowverse-star">
        Support
      </h1>
      <p className="mt-3 text-base text-knowverse-star/70">
        We&apos;re a small team. Email gets a real human reply, usually within a
        couple of days.
      </p>

      <Section title="Contact us">
        <p>
          Email{' '}
          <a
            href="mailto:jheremiah.dev@gmail.com"
            className="underline hover:text-knowverse-star/70"
          >
            jheremiah.dev@gmail.com
          </a>{' '}
          with:
        </p>
        <ul>
          <li>Bug reports — please include your iOS/Android version and what you were doing.</li>
          <li>Feature ideas — we read everything.</li>
          <li>Content issues — if a hook or category looks wrong, send the article title.</li>
          <li>Account/data deletion requests (see below).</li>
        </ul>
      </Section>

      <Section title="Delete my data">
        <p>
          The fastest way is to uninstall the app — that clears your saved
          articles, collections, topic preferences, and device ID from your
          phone. Server-side, your anonymous event history is automatically
          purged after 90 days.
        </p>
        <p>
          To delete your server-side data immediately, email us with the word
          &ldquo;delete&rdquo; in the subject and your device ID (find it in
          Settings → About in the app). We&apos;ll confirm deletion within 30
          days.
        </p>
      </Section>

      <Section title="Common questions">
        <h3 className="mt-4 text-base font-medium text-knowverse-star">
          Why is the feed showing the same articles?
        </h3>
        <p>
          Trending and Today pull from Wikipedia&apos;s daily feeds. If you swipe
          through everything for the day, you&apos;ll see repeats until the next
          day&apos;s data lands. The For You and Random tabs always have fresh
          content.
        </p>

        <h3 className="mt-6 text-base font-medium text-knowverse-star">
          Where do the article images come from?
        </h3>
        <p>
          Same place as the articles — Wikipedia. We cache them on our CDN so
          they load fast. Image licenses are visible when you tap &ldquo;Open in
          Wikipedia.&rdquo;
        </p>

        <h3 className="mt-6 text-base font-medium text-knowverse-star">
          Why don&apos;t you have ads?
        </h3>
        <p>
          Ads would change the feed&apos;s incentive structure — once we
          optimize for ad views we stop optimizing for what&apos;s actually
          interesting. We make money from affiliate links on relevant articles
          (e.g. a book mentioned in a science article) and brand-sponsored
          collections, both clearly labeled.
        </p>

        <h3 className="mt-6 text-base font-medium text-knowverse-star">
          Is the content accurate?
        </h3>
        <p>
          It&apos;s as accurate as Wikipedia, which is to say: usually very, but
          not always. We don&apos;t verify claims. If you see an error, the best
          fix is to edit the Wikipedia article itself.
        </p>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-knowverse-star">{title}</h2>
      <div className="mt-3 space-y-3 text-base leading-relaxed text-knowverse-star/75 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
        {children}
      </div>
    </section>
  );
}

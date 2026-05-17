import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms — Knowra',
  description: 'The terms of using Knowra. Short, plain English.',
};

const EFFECTIVE_DATE = '2026-05-17';

export default function TermsPage() {
  return (
    <>
      <h1 className="text-4xl font-semibold tracking-tight text-knowverse-star">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-knowverse-star/50">
        Effective {EFFECTIVE_DATE}
      </p>

      <Section title="Using Knowra">
        <p>
          Knowra is a feed of Wikipedia articles presented as scrollable cards.
          By installing or using the app or this website (&ldquo;Service&rdquo;),
          you agree to these terms. If you don&apos;t, please don&apos;t use the
          Service.
        </p>
      </Section>

      <Section title="The content">
        <p>
          Every article in Knowra comes from{' '}
          <a
            href="https://www.wikipedia.org"
            className="underline hover:text-knowverse-star"
          >
            Wikipedia
          </a>{' '}
          and is licensed under{' '}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            className="underline hover:text-knowverse-star"
          >
            CC BY-SA 4.0
          </a>
          . Knowra adds presentation: short hooks, layout, categorization.
          Underlying article text and images retain their original licenses and
          attributions, which we display in the &ldquo;Open original&rdquo; view.
        </p>
        <p>
          Knowra is independent and not affiliated with or endorsed by the
          Wikimedia Foundation.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>You agree not to:</p>
        <ul>
          <li>
            Scrape, mirror, or systematically copy Knowra&apos;s API or content
            for commercial use.
          </li>
          <li>Reverse engineer the app or attempt to extract our model prompts.</li>
          <li>
            Interfere with the Service or attempt to access it through unauthorized
            means (rate-limit bypass, credential stuffing, etc.).
          </li>
          <li>
            Use the Service in violation of any applicable law, or in a manner
            that could harm us or other users.
          </li>
        </ul>
      </Section>

      <Section title="Accounts">
        <p>
          Sign-in is not currently required to use Knowra. If we add sign-in in
          the future, you&apos;ll be responsible for keeping your credentials
          secure. We may suspend accounts that violate these terms.
        </p>
      </Section>

      <Section title="Service availability">
        <p>
          Knowra is provided &ldquo;as is.&rdquo; We work hard on uptime and
          quality, but we don&apos;t guarantee the Service will be uninterrupted,
          error-free, or that every hook or category will be perfectly accurate.
          Wikipedia content can be edited at any time; we don&apos;t verify
          claims.
        </p>
      </Section>

      <Section title="Liability">
        <p>
          To the maximum extent allowed by law, Knowra (and its operators) are
          not liable for indirect, incidental, or consequential damages arising
          out of your use of the Service. Our total liability for any claim
          related to the Service is limited to the amount you&apos;ve paid us in
          the last 12 months, which for the free tier is zero.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          You can stop using Knowra at any time by uninstalling the app or
          closing the browser tab. We may suspend or terminate access if you
          materially violate these terms.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We&apos;ll update these terms when the Service or applicable law
          changes. The effective date at the top will be bumped. Continuing to
          use the Service after a change means you accept the new terms.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Operated by Jheremiah Figueroa. Reach out at{' '}
          <a
            href="mailto:jheremiah.dev@gmail.com"
            className="underline hover:text-knowverse-star/70"
          >
            jheremiah.dev@gmail.com
          </a>
          .
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

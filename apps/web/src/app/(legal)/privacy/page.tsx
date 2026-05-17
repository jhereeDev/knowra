import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy — Knowra',
  description: 'How Knowra handles your data. Short version: we keep it minimal.',
};

const EFFECTIVE_DATE = '2026-05-17';

export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-4xl font-semibold tracking-tight text-knowverse-star">
        Privacy
      </h1>
      <p className="mt-2 text-sm text-knowverse-star/50">
        Effective {EFFECTIVE_DATE}
      </p>

      <Section title="The short version">
        <p>
          Knowra is a curiosity feed. We need just enough data to make the feed feel
          personal and to keep the service running — nothing more. We don&apos;t sell
          your data, we don&apos;t share it with advertisers, and we don&apos;t track
          you across other apps.
        </p>
      </Section>

      <Section title="What we collect">
        <ul>
          <li>
            <strong>An anonymous device ID.</strong> Generated on first launch and
            stored in your device&apos;s secure storage. We use it to remember
            which cards you&apos;ve seen so we don&apos;t serve the same article
            twice.
          </li>
          <li>
            <strong>Swipe events.</strong> Impressions, saves, skips, opens. Used
            to tune what shows up in your For You tab. Stored alongside your
            anonymous device ID.
          </li>
          <li>
            <strong>Topic preferences.</strong> If you toggle topics on or off in
            Settings, that choice is sent with feed requests so the algorithm
            knows what to favor. Stored on-device and in our database.
          </li>
          <li>
            <strong>Saved articles &amp; collections.</strong> Stored on your
            device. We don&apos;t sync them to our servers unless you sign in
            (sign-in is currently disabled in the public release).
          </li>
          <li>
            <strong>Push notification token (optional).</strong> Only if you
            explicitly opt in to notifications. Used to deliver the daily article
            ping; revoked the moment you turn notifications off.
          </li>
        </ul>
      </Section>

      <Section title="What we don't collect">
        <ul>
          <li>
            <strong>No IDFA, IDFV, or advertising identifiers.</strong> Knowra
            does not show ads or share data with ad networks. You will never see
            an App Tracking Transparency prompt.
          </li>
          <li>
            <strong>No real identity.</strong> No name, no phone number, no email
            unless you choose to sign in (currently disabled).
          </li>
          <li>
            <strong>No location data.</strong> We don&apos;t request location
            permission and we don&apos;t infer location from your IP.
          </li>
          <li>
            <strong>No contacts, photos, or microphone access.</strong> We
            don&apos;t use them.
          </li>
        </ul>
      </Section>

      <Section title="Third parties we share data with">
        <p>
          We use a small set of vendors to run the service. Each receives only
          what they need to do their job.
        </p>
        <ul>
          <li>
            <strong>Anthropic</strong> — generates the short &ldquo;hooks&rdquo;
            displayed under article titles. We send the article title and
            description; we don&apos;t send your device ID or any user data.
          </li>
          <li>
            <strong>Wikimedia (Wikipedia)</strong> — the source of every article.
            Knowra fetches article metadata on your behalf. Your IP is not
            forwarded; requests come from our server.
          </li>
          <li>
            <strong>Cloudflare Images</strong> — stores and serves the article
            hero images. Standard CDN access logs apply.
          </li>
          <li>
            <strong>Neon (Postgres)</strong> — stores card metadata, your
            anonymous device ID, and your swipe events.
          </li>
          <li>
            <strong>Upstash (Redis)</strong> — caching and rate limiting.
          </li>
          <li>
            <strong>Apple Push Notification Service / Firebase Cloud Messaging</strong> —
            only if you&apos;ve opted in to notifications.
          </li>
        </ul>
      </Section>

      <Section title="Retention">
        <p>
          Swipe events older than 90 days are deleted automatically. Saved
          articles live as long as you keep them. Your anonymous device ID is
          deleted when you uninstall the app or clear app data.
        </p>
      </Section>

      <Section title="Children">
        <p>
          Knowra is rated 13+. We don&apos;t knowingly collect data from anyone
          under 13. If you believe a child has used Knowra, email us and
          we&apos;ll remove the associated device ID and events on request.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          You can delete your local data at any time by uninstalling the app or
          clearing app data in your phone&apos;s settings. To request deletion of
          server-side data associated with your device, email{' '}
          <a
            href="mailto:jheremiah.dev@gmail.com"
            className="underline hover:text-knowverse-star/70"
          >
            jheremiah.dev@gmail.com
          </a>{' '}
          with the word &ldquo;delete&rdquo; in the subject. Include your device
          ID (Settings → About in the app) so we can find your data. We&apos;ll
          confirm deletion within 30 days.
        </p>
        <p>
          If you&apos;re in the EU, UK, or California, you have additional rights
          under GDPR / CCPA (access, rectification, portability, objection). Same
          email, same response time.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We&apos;ll update this page when our data practices change. The
          effective date at the top will be bumped. For material changes
          we&apos;ll notify active users via in-app banner.
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

# Knowra — Documentation Index

> **Working title.** A native iOS + Android app (React Native + Expo) that gives people the TikTok scroll loop, redirected toward Wikipedia knowledge. "Educational doomscrolling," done right.

This folder contains the founding documentation for the project. Each file is self-contained, but they're designed to be read in order.

## The documents

| # | File | What it covers |
|---|---|---|
| 01 | [Vision & business model](./01-vision-business-model.md) | The 30-second pitch, target market, competitive landscape, strategic principles, north-star metric. |
| 02 | [Product spec](./02-product-spec.md) | Design tenets, MVP feed, all features beyond MVP, anti-patterns, onboarding flow, success metrics. |
| 03 | [Technical architecture](./03-technical-architecture.md) | Mobile stack (React Native + Expo + EAS), backend (Next.js + Vercel + Neon), Wikipedia integration, build & release pipeline, infra cost estimates. |
| 04 | [Data model & algorithm](./04-data-algorithm.md) | Postgres schema, feed algorithms (Random / For You / Today), cold-start, event ingestion. |
| 05 | [Monetization strategy](./05-monetization.md) | Affiliate, sponsored cards, B2B/EdTech licensing — with revenue projections and unit economics. |
| 06 | [Roadmap & risks](./06-roadmap-risks.md) | 12-month phased plan, KPIs by phase, team plan, funding philosophy, and the 11 risks most likely to kill us. |

## TL;DR for someone in a hurry

**Problem.** Most people spend 2–4 hours a day on infinite-scroll content they regret afterwards.

**Insight.** The habit is the asset. Don't fight it — redirect it. Replace the content, keep the loop.

**Product.** A native iOS + Android app where every swipe surfaces a beautifully presented Wikipedia article. Card has a hero image, a hook, a "Go deeper" tray. Three feeds: Random, For You, Today. Built with React Native + Expo for one-team velocity across both platforms.

**Why now.** Backlash against content slop is real. Wikipedia is free, world-class, CC-licensed. Cross-platform native is finally fast to build, and **none of our revenue streams trigger App Store / Play Store commission** — they're all external.

**How we make money.** Affiliate links in the Go-deeper tray. Native sponsored cards from museums, podcasts, courses. B2B licensing to schools, libraries, corporate L&D. **Zero App Store tax on any of it**, because none are digital IAP.

**Why this is defensible.** Personalization data compounds. Editorial curation is hard to clone. B2B contracts are sticky. First brand to own "the curiosity feed" wins the category by default.

**What we won't do.** No subscriptions (yet). No in-app purchases. No dark patterns. No autoplay video. No App Tracking Transparency prompt — we don't track for ads.

## What I want feedback on

If you're reviewing this, the three questions where my thinking is least settled:

1. **Onboarding sequence.** Specifically, when to ask for topic preferences vs. when to just let the algorithm figure it out from swipes. Hot take welcome.
2. **Pricing on B2B.** Per-student pricing varies wildly in EdTech. The numbers in `05-monetization.md` are educated guesses, not benchmarks.
3. **AI hooks tone.** Smart-friend voice is the goal. Hard to get right at scale. Curious if anyone has a strong opinion on prompting strategy for this.

## Next steps if you're building this

1. Lock the name. Spend a weekend on it.
2. Day-1 housekeeping: enroll in the Apple Developer Program (1–2 week approval lag — do this first) and Google Play Console.
3. Stand up the Phase 0 infra: Vercel + Neon + Upstash + Expo project + EAS Build pipeline (~1 week).
4. Get the random-card feed running end-to-end on your own iPhone via TestFlight (~2 weeks).
5. Show it to ten friends. Measure how many open it the next day unprompted.
6. If that number is > 5/10, raise pre-seed and keep going. If it's < 3/10, the loop isn't there yet — iterate on hook quality and image curation before doing anything else.

---

*Last updated: 2026-05-16. Documents are living drafts — expect them to evolve as the product gets real.*

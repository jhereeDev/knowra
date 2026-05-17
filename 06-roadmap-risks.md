# 06 — Roadmap, KPIs & Risks

A 12-month plan, the metrics we judge it by, and the things most likely to kill the company.

---

## 1. 12-month phased roadmap

### Phase 0 — Foundations (Weeks 1–3)
- Set up monorepo (mobile app, marketing site, backend, shared types).
- Vercel + Neon + Upstash + Sentry + PostHog provisioned.
- Apple Developer Program enrollment + Google Play Console setup (Apple enrollment can take 1–2 weeks — start day 1).
- Initialize Expo project, set up EAS Build, ship a "Hello world" build to TestFlight + Play Internal Testing.
- Wire up Auth.js magic-link backend.
- Get the Wikipedia random-summary endpoint flowing end-to-end with one card rendered on a real iPhone.
- Decide & lock the name + brand + App Store listing draft.

### Phase 1 — MVP feed (Weeks 4–8)
- Vertical pager (Reanimated + Gesture Handler), gesture math tuned on 5 real devices including a low-end Android.
- Random feed live, image pipeline functional, `expo-image` caching tuned.
- "Go deeper" tray with first 300 words + Wikipedia link.
- Anonymous-user event ingestion via batched POST.
- Universal Links / App Links wired to marketing site article URLs.
- **Milestone:** TestFlight build feels indistinguishable from a finished consumer app. Plays at 60+ fps on iPhone 12 baseline.

### Phase 2 — Hooks & polish (Weeks 9–12)
- LLM-generated hooks for top 10k articles (batch job).
- AI-generated 300-word summaries.
- Image curation worker filling in Wikimedia Commons backups.
- "Today" tab launched.
- Save / Share / Collections (anonymous + signed-in).
- App Store listing finalized: screenshots, preview video, metadata, privacy nutrition labels.
- **Milestone:** TestFlight external + Play Closed Testing open to ~500 invited testers. Submit first App Store / Play Store review **as private/internal**. Measure D1.

### Phase 3 — Personalization, push & retention (Weeks 13–18)
- "For You" feed live with v1 algorithm (vector similarity + exploration band).
- Topic preferences UI.
- **Native push notifications** for daily digest (APNs via Expo on iOS, FCM on Android).
- Streak counter (interaction-gated).
- Magic-link + Sign in with Apple + Google Sign-In.
- Apple's StoreKit review prompt wired for high-intent moments.
- **Milestone:** **public launch on App Store + Play Store.** Target 10k MAU within 30 days. (Plan for 1-week submission/review buffer.)

### Phase 4 — Differentiators (Weeks 19–26)
- Rabbit Hole mode + shareable rabbit-hole image (Skia rendering).
- Audio narration ("Surprise me" mode) via `expo-av` with background audio.
- "Did I learn?" weekly recap email + spaced-repetition quiz cards.
- Multi-language support (Spanish, French, German, Portuguese first — biggest Wikipedia communities + biggest mobile markets).
- iOS widget + Android widget for "card of the day."
- **Milestone:** 50k MAU, first affiliate revenue crosses 4 figures/month.

### Phase 5 — Monetization & B2B foundation (Weeks 27–38)
- Sponsored card pipeline (initially direct-sold).
- Affiliate links live in Go-deeper tray for top 10k articles, with in-app browser flow tuned for conversion.
- B2B pilot conversations: 2 libraries, 1 school district, 1 museum.
- Public API for partners.
- Marketing site refresh + ASO push (App Store Optimization).
- **Milestone:** $20k MRR, 100k MAU.

### Phase 6 — Scale prep (Weeks 39–52)
- Separate recommendation service in Python (FastAPI).
- Multi-region deployment, p95 latency targets enforced.
- First 1–2 B2B contracts signed and live.
- iPad-optimized layout + Android tablet polish.
- Hire 1 designer, 1 mobile eng, 1 content lead, 1 B2B salesperson.
- **Milestone:** $80k MRR, 250k MAU, runway extended via revenue.

## 2. KPIs by phase

### MVP KPIs (months 1–3)
- D1 retention ≥ 35%
- Median session length ≥ 4 min
- ≥ 12 cards per session
- ≥ 8% sessions with a "Go deeper" tap

### Growth KPIs (months 4–6)
- D7 retention ≥ 15%
- WAU/MAU ≥ 0.5
- Organic shares per DAU ≥ 0.05
- CAC < $0.50 blended

### Monetization KPIs (months 7–12)
- Affiliate RPM ≥ $1
- Sponsored CPM ≥ $15
- B2B pipeline: 5 active pilots, 1 paid contract
- Net revenue per MAU trending toward $0.50

## 3. Team plan

**Day 0:** founder(s) + maybe one part-time designer.
**Month 3:** add one full-stack engineer; keep design contract.
**Month 6:** add one content lead (handles editorial curation + sponsor relations).
**Month 9:** add one backend/ML engineer (recommendation service) + one B2B salesperson.
**Month 12:** team of ~7. Don't over-hire — content + algorithm gains beat headcount gains in this category.

## 4. Funding philosophy

This doesn't need to be a venture-scale business in year 1. Path:
- **Bootstrap or pre-seed ($150–500k):** to fund 4–6 months of two-person team + early infra.
- **Seed ($2–4M) at month 9–12:** only after retention is validated. Spend on B2B sales muscle and a content engine.
- **Series A:** only if the B2B and consumer flywheels are both compounding.

Profitability is reachable at modest scale. Don't take dilution you don't need.

## 5. Risks (and what we do about them)

### 5.1 Legal: Wikipedia / CC-BY-SA compliance
- **Risk:** misuse of CC-BY-SA content, especially AI-derived hooks/summaries. The Wikimedia community is well-organized and *will* notice.
- **Mitigation:**
  - Bake attribution into every card.
  - Treat AI-generated derivatives as CC-BY-SA themselves.
  - Pledge 5% of revenue to Wikimedia Foundation.
  - Publish a "How we use Wikipedia" page from day one.
  - Engage with the Wikimedia community early — they're allies if we treat them right.
- **Worst case:** a public letter from the Wikimedia community pressures us to change practices or shut down. Probability moderate. Cost manageable if we lead with respect.

### 5.2 Legal: Image rights & attribution
- **Risk:** Wikimedia Commons mostly hosts CC/PD images but mis-tagged or misattributed images do exist. Using one wrong image at scale is a copyright incident.
- **Mitigation:** auto-fetch & store license metadata for every image. Attribution shown on Go-deeper. Don't serve images flagged "non-free" or with unclear provenance. Manual review of top-10k hero images.

### 5.3 Legal: Privacy (GDPR / CCPA / global)
- **Risk:** anonymous tracking, personalization, and push notifications cross multiple regulatory boundaries.
- **Mitigation:** first-party analytics only, consent banner where required, data export/delete in Settings, age gate for EU minors (per UK Age-Appropriate Design Code & California AB-2273). Document data flows.

### 5.4 Platform: Wikipedia API rate limits
- **Risk:** at scale, we exceed Wikimedia's anonymous request limits.
- **Mitigation:** aggressive Postgres + Redis cache (most articles are ingested once and live in our DB forever). Use `User-Agent` per their etiquette. Apply for a higher rate limit when needed — they grant generously for good-faith partners.

### 5.5 Product: Filter bubble & dopamine optimization
- **Risk:** the same optimization that makes the feed addictive narrows it into a brain-rot tunnel — defeating our positioning.
- **Mitigation:** exploration band hard-coded at 15%. Track per-user category entropy and intervene if it collapses. Cap session length suggestions ("You've been scrolling for 30 min — here's your recap").

### 5.6 Product: Copycats
- **Risk:** Wikipedia + TikTok-style feed is easy to clone. Multiple prototypes already exist.
- **Mitigation:** speed to brand. Editorial layer (hooks, image curation) is harder to clone than the feed. B2B lock-in compounds over time. **Don't lose 6 months on perfectionism — ship.**

### 5.7 Market: Wikipedia / Wikimedia themselves build this
- **Risk:** Wikimedia ships their own TikTok-style mode in their official app. Already on their experimental roadmap.
- **Mitigation:**
  - Their incentive is reference utility, not entertainment. Their version will feel like Wikipedia, not like a consumer app.
  - We compete on personalization, editorial polish, and B2B distribution — not on having the content.
  - Worst case: we become a complement, not a competitor. Possibly even an acquisition target.

### 5.8 Market: AI summaries kill the "click through to Wikipedia" model
- **Risk:** users get the AI summary, never go deeper, we don't get the affiliate signal needed for revenue.
- **Mitigation:** Go-deeper is the revenue surface. Design *needs* to make it desirable. Track "Go deeper" tap rate as a top-3 KPI. If it drops below 6%, redesign immediately.

### 5.9 Market: The "scrolling is bad" backlash that powers us could also kill us
- **Risk:** parents, lawmakers, schools start blocking *all* infinite-scroll apps — ours included — regardless of content.
- **Mitigation:** ship anti-dark-patterns from day one (no autoplay, no streak guilt, session caps, recap nudges). Position as "the *good* infinite scroll." Cultivate vocal supporters in education space. We *want* to be the example regulators cite as the version that's OK.

### 5.10 Operational: image bandwidth bills
- **Risk:** at scale, image bandwidth dominates infra cost.
- **Mitigation:** AVIF/WebP, aggressive caching, blurhash placeholders, CDN partner with sane pricing (Cloudflare Images). Model bandwidth costs every quarter.

### 5.11 Operational: Founder burnout
- **Risk:** the dopamine + content + B2B sales motion is three companies under a trench coat. Easy to burn out.
- **Mitigation:** stage the lift. Don't sell B2B until the consumer engine is humming. Hire to your weaknesses, not your strengths.

### 5.12 Platform: App Store / Play Store rejection
- **Risk:** Apple or Google rejects the app at submission. Common reasons in our category: "spam / duplicate functionality" (we're "just another Wikipedia reader"), "insufficient functionality" (the swipe feed alone may be deemed too thin at v1), or category-rating issues if a swiped article surfaces sensitive content.
- **Mitigation:**
  - **Differentiate the listing copy** — emphasize personalization, curated hooks, audio narration, Rabbit Hole. Don't position as "Wikipedia." Position as "TikTok for curiosity."
  - **Ship v1 with enough depth** that "thin app" critique doesn't stick — at least 4 of the differentiators from §4 of the product spec are live at launch.
  - **Aggressive content safety filters** at ingest, especially current events and mature topics.
  - **Pre-review** by an App Store consultant before the first submission (~$1k well spent).
  - Build a contingency week into every launch plan to handle 1 round of rejection.

### 5.13 Platform: Apple policy change on external links / affiliate
- **Risk:** Apple tightens external-link or commission rules in a way that breaks our affiliate model. They've reversed course on this before.
- **Mitigation:**
  - **Diversified monetization** — affiliate is one of three streams. Sponsored + B2B are platform-independent.
  - **Stay current** with Apple developer news and DMA developments. We're operating in an actively-changing legal landscape (2024–2026 court rulings have been *loosening*, not tightening — but that could flip).
  - **Don't be the test case.** If a rule is ambiguous, ask. App Review has a "Request guideline interpretation" channel that's underused.

### 5.14 Platform: React Native / Expo ecosystem risk
- **Risk:** Expo or a critical RN dependency (Reanimated, Gesture Handler) breaks compatibility or shifts in a way that costs us weeks.
- **Mitigation:**
  - **Pin major versions.** Upgrade quarterly, never on a release deadline.
  - **Stay on the managed workflow as long as possible.** Drop to `expo prebuild` only when truly required.
  - **Invest in CI** — every PR builds for both platforms, prevents drift.
  - **Worst case fallback:** eject to bare RN. Painful but well-trodden.

### 5.16 Brand: Name collision with existing "Knowra" trivia app
- **Risk:** an existing iOS app named *Knowra* (Sebastian Humbach, ~2024, a quiz/trivia app — "3,000+ questions across 11 categories, makes knowledge fun") already occupies the App Store search result for our exact name and sits in an adjacent category. Risk of user confusion, App Store search dilution, and (lower probability) a trademark dispute if the incumbent files first.
- **Mitigation:**
  - **File USPTO trademark early** in Class 9 (downloadable software) + Class 41 (educational services) as soon as we have demonstrable use in commerce. The incumbent has no registered trademark on record at brand-decision time, only common-law rights.
  - **Differentiate visually and verbally** — lean hard into the space/knowverse identity from day one. Listing copy, screenshots, and icon must read unmistakably different from a trivia quiz app.
  - **Acquisition fallback** — solo-dev apps in this size class are often acquirable for low four figures. If trademark filing surfaces friction, founder-to-founder outreach is the cleanest unblock.
  - **Monitor** — set a recurring App Store search check; if the incumbent rebrands or stalls, the collision risk decays on its own.
- **Status at brand decision (2026-05-17):** acknowledged and accepted by the founder.

### 5.15 Platform: Push notification fatigue / OS-level caps
- **Risk:** iOS users disable our push (single biggest retention lever) or iOS introduces new caps on notifications.
- **Mitigation:**
  - **Don't ask for push on session 1.** Ever. Earn the permission ask.
  - **Make the daily digest excellent.** One push per day, perfectly relevant, opt-out is easy. Quality beats quantity by orders of magnitude.
  - **Backup retention channels** — email digest for users who declined push.

## 6. What "winning" looks like — and the second-order opportunity

By month 24, "winning" means:
- 500k+ MAU
- $2M+ ARR (mostly sponsored + B2B)
- 1 marquee B2B partner (the British Library, NYC DOE, a museum group)
- "Open Wikipedia" → "Open [our app]" has flipped for our core users

The second-order opportunity: once we own the curiosity feed, **every long-form knowledge platform wants to integrate.** Coursera, MasterClass, Substack, NYT — they all want their content to be the "Go deeper" destination. We become an attention router for the entire learning economy. That's the platform play, and it's only available if we win the feed first.

## 7. What we're explicitly not doing

- Not building original content. We're a discovery layer; Wikipedia (and partners) make the content.
- Not building social-graph features in v1. No follows, no DMs. Solo experience.
- Not doing video. We're not a video app, and our edge over TikTok is *not* being video.
- Not building a full web app (just marketing + SEO). Native is the product.
- Not raising aggressively before retention is proven. Premature funding is a great way to spend $5M proving the wrong thing.
- Not adding in-app purchases / subscriptions to start. Keeps Apple's commission at 0% on our revenue.

---

*This concludes the document set. See `00-README.md` for the overview index.*

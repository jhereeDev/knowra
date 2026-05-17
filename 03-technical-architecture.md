# 03 — Technical Architecture

> **Platform decision:** native iOS + Android via **React Native + Expo**, with a complementary marketing/SEO site on Next.js. Pair this with `04-data-algorithm.md` for the data layer.

---

## 1. High-level architecture

```
┌──────────────────────────────────────────────────────────────────┐
│              Mobile clients (iOS + Android)                      │
│  React Native 0.76 (New Architecture) · Expo SDK 52              │
│  Expo Router · Reanimated 3 · Gesture Handler · Skia · MMKV      │
│  Expo Push · Notifee · Hermes engine                             │
└────────────────┬─────────────────────────────────────────────────┘
                 │                            ┌─────────────────────┐
                 │                            │  Marketing site +    │
                 │ HTTPS, JSON                │  /article/[slug] SEO │
                 │                            │  Next.js · Vercel    │
                 │                            └──────────┬───────────┘
                 │                                       │
                 ▼                                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Edge / API layer                           │
│  Next.js Route Handlers on Vercel Edge Functions                 │
│  · /api/feed   · /api/article   · /api/event   · /api/auth       │
└───┬──────────────┬──────────────┬─────────────────────────────────┘
    │              │              │
    ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌────────────────────────┐
│ Wikipedia│  │ Postgres │  │ Recommendation service │
│   API    │  │  (Neon)  │  │  Python · FastAPI      │
└──────────┘  └────┬─────┘  └────────┬───────────────┘
                   │                 │
                   ▼                 ▼
            ┌─────────────────────────┐
            │  Redis (Upstash)        │
            │  · feed cache           │
            └─────────────────────────┘

       ┌────────────────────────────────────┐
       │  Image pipeline (background)       │
       │  Wikimedia Commons → Cloudflare    │
       │  Images → CDN                      │
       └────────────────────────────────────┘
```

The **mobile clients are the product.** The marketing site exists for SEO + sharing — every article has a public URL so an iMessage of "look at this" opens to a real preview. The backend is unchanged in shape from the PWA-era thinking; only the client changed.

## 2. Mobile client stack

### 2.1 Core
- **React Native 0.76+** with the New Architecture enabled (Fabric + TurboModules). The New Arch is finally stable in 2026 and gives us serious performance headroom — gesture-driven swipe needs it.
- **Expo SDK 52+** managed workflow. Lets us avoid most native config; we can drop down to `expo prebuild` if we need a native module Expo doesn't wrap.
- **Expo Router (v4)** for file-based routing with deep linking baked in.
- **TypeScript** — non-negotiable.
- **NativeWind** (Tailwind for React Native) — preserves the rapid-iteration design ergonomics from the original plan, with platform-aware classnames.
- **Zustand** for in-memory state; **MMKV** (via `react-native-mmkv`) for fast key-value persistence (saved cards, prefs, anonymous device ID).
- **WatermelonDB** or **Expo SQLite** for richer offline storage (cached cards, events queue, collections). WatermelonDB is overkill for v1; start with Expo SQLite.

### 2.2 Animations & gestures (the most important section)
This is the part of the codebase that has to be world-class. The swipe is the product.

- **React Native Reanimated 3** — UI-thread animations. Anything that runs at 60–120fps lives here.
- **React Native Gesture Handler 2** — native-thread gesture recognition. Pair with Reanimated for the swipe pager.
- **React Native Skia** — for the rabbit-hole graph, blurhash placeholders, and any custom drawing.
- **`react-native-pager-view`** OR a custom Reanimated pager — start with the off-the-shelf pager; replace with custom if we need finer control.
- **`react-native-haptic-feedback`** — subtle haptic on card-commit. Big upgrade over web.

Gesture math targets:
- Commit at ≥25% viewport translation OR ≥600 px/s velocity
- Resistance curve when scrolling beyond bounds (springy, not hard)
- Card stays at 60+ fps during swipe (use `runOnUI` aggressively)

### 2.3 Image strategy (slightly different from web)

- **`expo-image`** for everything. Built-in caching, blurhash placeholders, transformations.
- Three image variants served from Cloudflare Images: 720w, 1080w, 1440w (the Pro Max etc).
- Preload images for the next 3 cards on every commit. `expo-image` exposes a `prefetch` API that's good enough.
- Disk cache cap: 200MB by default, user-adjustable in Settings.

### 2.4 Push notifications (the iOS payoff)

This is one of the main reasons to go native:
- **Expo Notifications** for both iOS (APNs) + Android (FCM).
- Daily digest push at user-chosen time.
- Rich notifications: hero image + title + 2-line hook. Tapping opens directly to the card (deep link).
- We use Expo's push service as a wrapper around APNs/FCM — saves us running our own notification infra until we're at scale.

### 2.5 Offline & background

- Last 50 viewed cards + all saved cards are cached for offline.
- Events queue persists; flushes on connection restore.
- Background fetch (iOS) / Background tasks (Android) refresh the "Today" feed once a day, so the morning push opens to a pre-loaded feed.

### 2.6 What stays the same from the PWA plan
- Backend services (Next.js API routes, Postgres, Redis, recommendation service)
- Wikipedia integration
- Image pipeline worker
- LLM hook/summary worker
- Auth model (magic link, anonymous-first)
- Data flow shape

The mobile rewrite is *just* the client. The hard-won architecture decisions on the data and recommendation layer carry forward unchanged.

## 3. Marketing site + SEO surface

A separate Next.js app on Vercel. Handles:

- **Landing page** (`/`) — install CTAs to App Store + Google Play.
- **Article SEO pages** (`/a/[slug]`) — server-rendered, OpenGraph cards for sharing, "Open in app" smart banner at the top.
- **Public collection pages** (`/c/[id]`) — shared collections render server-side.
- **About / Press / Wikimedia commitment** pages.
- **Legal:** Privacy policy, Terms, attribution page.

Why bother with the site:
1. SEO — Google indexes every article URL. Long tail of "[obscure topic] wikipedia" queries can drive significant organic acquisition.
2. Share previews — link sent over iMessage / WhatsApp / Slack rendering as a rich card.
3. Universal/App Links — `https://knowra.space/a/abc` opens in the native app if installed, falls back to the web page if not. This is the killer flow for word-of-mouth.

We do **not** ship a swipe feed on the web. That keeps the mobile app the only "real" experience.

## 4. Backend services

### 4.1 API layer (unchanged in shape)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/feed/random` | GET | Returns 20 random card payloads. |
| `/api/feed/for-you` | GET | Returns 20 personalized cards. |
| `/api/feed/today` | GET | Returns Today-feed cards. |
| `/api/article/[id]` | GET | Full article + summary + related + affiliate items. |
| `/api/event` | POST | Batched user-interaction events. |
| `/api/auth/*` | POST | Magic-link auth via Auth.js. |
| `/api/collections` | CRUD | Saved collections. |
| `/api/push/register` | POST | Register an Expo push token for a device. |

### 4.2 Wikipedia integration
Identical to the PWA plan — REST API for random + on-this-day, Action API for full articles, Wikimedia Commons for image fallbacks. Always set a `User-Agent` with contact email; respect `MaxLag`; cache aggressively in our own DB.

### 4.3 Recommendation service
Same plan: lives inside Next.js for MVP; split into a Python FastAPI service at ~10k DAU. See `04-data-algorithm.md`.

### 4.4 Image pipeline worker
Same: nightly cron job that ingests, validates, resizes to Cloudflare Images, and stores blurhashes.

### 4.5 LLM hook/summary worker
Same: nightly batch job over new/updated articles.

## 5. Auth model

- **Magic link only** at MVP (Auth.js + Resend for email).
- **Apple Sign-In** added in v1.1 — **required by Apple** if we offer Google Sign-In or any other social login on iOS.
- **Google Sign-In** added in v1.1.
- Anonymous device users tracked via a UUID stored in MMKV. Merge graph into a real account on signup.

## 6. Build, release & distribution

### 6.1 Build pipeline
- **EAS Build** (Expo Application Services) for cloud builds. Removes the "did anyone update Xcode?" tax from a small team.
- **EAS Submit** for App Store / Play Store submission.
- **EAS Update** for over-the-air JS bundle updates (huge for fast iteration on copy/UI without going through review).

### 6.2 Release tracks
- **Internal:** TestFlight (iOS) + Play Internal Testing — daily builds for the team.
- **Beta:** TestFlight external + Play Closed Testing — ~500 invited testers.
- **Production:** staged rollout (1% → 10% → 50% → 100%) on Android; phased on iOS.
- **Hotfix channel:** EAS Update for JS-only fixes (no review needed).

### 6.3 App Store / Play Store realities
- First submission review: typically 1–3 days now (much better than the bad old days). Plan for week-long buffer before any hard launch.
- We will need:
  - Apple Developer Program: $99/year
  - Google Play Console: $25 one-time
  - Privacy policy hosted publicly
  - Data Safety / Privacy "nutrition label" forms — we'll declare event tracking, no third-party data sharing
  - Age rating: target 12+ (mild educational references to historical violence, war, etc.)
- App Store rejection risks discussed in `06-roadmap-risks.md`.

## 7. Deployment

| Component | Provider | Notes |
|---|---|---|
| Mobile apps | EAS Build → App Store + Play Store | Builds on EAS, submitted via EAS Submit. |
| OTA updates | EAS Update | Channel: `production` / `beta` / `dev`. |
| Marketing site | Vercel | Auto-deploy from `main`. |
| API | Vercel Edge Functions | Same project as marketing site. |
| Postgres | Neon | Branching for staging. |
| Redis | Upstash | Pay-per-request. |
| Vector DB | pgvector inside Neon → Qdrant later | Cheaper to start. |
| Images | Cloudflare Images | Best $/image at scale. |
| Recommendation service | Fly.io | Multi-region, scale-to-zero friendly. |
| Push | Expo Push (APNs/FCM under the hood) | Free up to scale; consider migrating to native at >1M DAU. |
| Image / LLM worker | Inngest + Vercel Cron | Background job orchestration. |
| Email (magic links) | Resend | Cheap, dev-friendly. |
| Crash & analytics | Sentry + PostHog (RN SDKs) | Both have first-class RN support. |

## 8. Estimated infra cost at scale

| Users (MAU) | Est. monthly cost | Big drivers |
|---|---|---|
| 1k | ~$80 | EAS Production plan, Vercel hobby, Neon free |
| 10k | ~$500 | EAS Build minutes, Vercel Pro, Sentry, image bandwidth |
| 100k | ~$4.2k | Image bandwidth, recommendation infra, push delivery |
| 1M | ~$30k | Bandwidth + LLM inference + push (might self-host APNs/FCM by now) |

These are rough — they're slightly higher than the PWA plan only because of EAS Build minutes and the dev-tooling cost. Bandwidth dominates at scale regardless of client choice.

## 9. Security & privacy posture

- All traffic HTTPS with certificate pinning enabled in the mobile clients (foils intermediate-cert attacks on hostile WiFi).
- Magic-link tokens single-use, 10-min expiry.
- All on-device storage (MMKV, SQLite) encrypted at rest.
- iOS App Tracking Transparency: we don't need IDFA. We don't ask. This is a positioning win — "We don't track you across apps" is a deliberate marketing line.
- Data Safety / Privacy nutrition labels honestly declared: events, anonymous device ID, email if signed in. Nothing else.
- One-button "delete my data" in Settings, satisfies GDPR + CCPA + India DPDP.

## 10. The "why React Native + Expo" decision in one paragraph

We need 60+ fps swipe physics, native push, App Store presence, and the ability to ship to two platforms with a four-person team in under six months. Pure native (Swift + Kotlin) doubles dev cost and ships slower. Flutter is excellent but pulls us into Dart and creates a worse web-share path. Capacitor would feel like a wrapped website. React Native + Expo's tooling has matured — EAS handles the worst part of the native dev experience, and Reanimated 3 + Gesture Handler are genuinely good enough for our specific use case. Discord, Shopify, Coinbase, and Mercari all ship critical paths on React Native in 2026. We're not the smartest people in the room here — we're following a well-trodden path.

## 11. Open technical questions

1. **iOS-only vs. simultaneous Android launch.** Many consumer apps launch iOS-first to focus QA. Argument for: better demographics for affiliate revenue, more vocal early users. Argument against: Android-first markets are huge (India, Brazil, Indonesia) and we want them long-term. **Recommendation:** simultaneous public beta, but invest more in iOS polish for the first 3 months.
2. **Native modules: Skia overkill?** Skia is heavy and adds binary size. For v1, the only use case is the Rabbit-Hole graph + custom card transitions. We can defer Skia until v1.1 and use simpler React Native primitives.
3. **OTA update strategy.** EAS Update is great but Apple has policies about how much you can change without a real review. Stay on the right side — UI tweaks, copy fixes, A/B test variants. Anything that changes the user-facing functionality goes through review.
4. **Self-host inference (LLM hooks/summaries)** — same question as the PWA plan; defer.

---

*Next: `04-data-algorithm.md` covers the schema and recommendation algorithm — unchanged from the original plan.*

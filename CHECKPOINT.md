# CHECKPOINT.md

> A living state file. **Update at the end of every working session.** Keep it short — under ~120 lines. Older entries go to [`CHECKPOINT.history.md`](./CHECKPOINT.history.md).

---

## Current state

**Last updated:** 2026-05-18
**Updated by:** Claude (auth + onboarding + quiz + map + Knowverse batch)
**Phase:** Phase 3 — Personalization (per `06-roadmap-risks.md`)

### What exists
- **Live backend** at `https://knowra.space` (VPS, nginx + certbot + systemd, port 3033). Daily-digest cron at 13:30 UTC.
- **iOS 1.0.0** in App Store Review (ASC App ID 6770208055, bundle `space.knowra.app`).
- **Android 1.0.0 (versionCode 3)** in Play Console Internal testing.
- **All 4 feeds** live: For You, Trending, Today, Random.
- **Save + Collections + Search + Streak + Settings + In-app reader + Donation nudges + Daily push digest** — all shipped.
- **Auth + sync** (Clerk via OAuth Apple/Google) — code complete, env keys needed to activate.
- **3-card onboarding calibration** — gates first launch.
- **Quiz cards** (spaced repetition: 1/3/7/21 days, cap 3/day) from saved articles.
- **Map feed** (region-tap → Wikipedia related-pages for that place).
- **Knowverse constellation** — local star/edge graph of read articles, plain-RN-View visualization.

### What doesn't exist yet
- TestFlight external testers (build needs to be submitted for **Beta App Review** — separate from App Store Review).
- Play Console Closed test → Production promotion (personal account requires 20 testers / 14 days).
- USPTO trademark filing (Class 9 + Class 41).
- Skia-based Knowverse v2 (pan/zoom + share-as-poster).
- Interactive map view with pins (Phase 2 of map feature; requires `react-native-maps` + map provider keys).

## Decisions locked in

- **Native iOS + Android** via React Native + Expo. New Architecture enabled.
- **Backend** Next.js 15 on VPS (not Vercel — see `deploy/README.md`).
- **Monetization**: affiliate + sponsored cards + B2B/EdTech. No subscriptions / IAP. 5% to Wikimedia.
- **Auth**: Clerk OAuth (Apple + Google). Anonymous-by-default; signing in is opt-in and syncs local state up.
- **Sync model**: last-write-wins, push-only on first sign-in. `GET /api/sync/state` exists for future pull but isn't called yet.
- **Quiz cards**: source = saved articles only. Schedule = 1d/3d/7d/21d per save. Cap = 3/day.
- **Knowverse**: top-level icon in feed header (not buried in settings/saved). v1 = plain Views, v2 = Skia.
- **Map feed**: region-tap via Wikipedia related-pages seeded by place name. Phase 2 (pins on real map) deferred.
- **No tracking for ads.** No ATT prompt. Brand promise.

## Open questions (need a call before they block work)

1. **Beta App Review** — submit the TestFlight build for external testing review (separate from App Store Review). Founder action.
2. **Secret rotation** — Clerk / Anthropic / Cloudflare / Upstash / Neon credentials were exposed mid-session. Rotate when convenient.
3. **Map Phase 2** — interactive map with pins, or skip and go straight to audio narration? Native-maps SDK adds binary size and provider keys.
4. **Knowverse v2** — Skia for pan/zoom + poster export, or ship v1 to TestFlight first and gather feedback?

## Recommended next move

**Biggest wins (do these next, in this order):**

1. **Audio narration ("Listen" mode)** — TTS via ElevenLabs or OpenAI, cache audio in Cloudflare R2 keyed by `wiki_id`. `expo-av` for playback, background-audio entitlement on iOS. Closes the "I can't use this while driving" objection. ~2-3 days.
2. **Wrapped-style monthly recap** — shareable card "In May, you learned about 47 articles across X, Y, Z. Top rabbit hole: A → B → C." Pair with the Knowverse graph as the poster image. Organic viral loop, no friend system needed. ~1-2 days.
3. **Knowverse v2 (Skia)** — pan/zoom + share-as-poster. Install `@shopify/react-native-skia`, port the current View-based renderer. Required EAS rebuild. ~1-2 days.
4. **Negative signal ("less of this")** — long-press menu on a card → mute topic / suppress cluster. Currently the algorithm only sees positive signals. ~0.5 day.

**Founder / non-code tasks:**
- Add the Clerk env keys (see "Activation" below) and run migration 0004.
- Submit the TestFlight build for Beta App Review.
- Promote Android Internal → Closed test (requires 20 testers).
- Rotate exposed secrets.

**Tech debt that should land before the next big feature:**
- One unit test of the For You blend logic (`/api/cards/foryou/route.ts`).
- Sentry crash reporting (was held; the Fabric crash was diagnosed from a screenshot — not sustainable).

## Activation (this session's work)

```env
# packages/db/.env
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...

# apps/mobile/.env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Then: `pnpm --filter @knowra/db migrate`, create the Clerk app at clerk.com (enable Apple + Google), rebuild EAS dev client.

## Active branches & PRs

_(All work on `main`. No open PRs.)_

## Session log

### 2026-05-17 — Phase 2 deploy + App Store / Play Console submission ✅
*(Detailed entry archived in `CHECKPOINT.history.md`.)*
- knowra.space live behind nginx + certbot, daily-digest cron timer, Upstash caching.
- iOS 1.0.0 uploaded → Waiting for App Store Review. Android 1.0.0 → Play Internal testing.
- Many Fabric / responsiveness / icon / SEO fixes. Donation nudges, local feed cache, push opt-in earned at streak ≥3, in-app reader summary/full toggle.

### 2026-05-18 — Auth + onboarding + quiz + map + Knowverse batch ✅
Five features in one session, ~1700 lines added across mobile + backend + shared.

**1. Clerk auth + sync** — restored mobile `ClerkProvider` (env-gated), real `useSSO` sign-in (Apple + Google), Settings `AccountSection`, `lib/sync.ts` with `maybeFirstPush` one-shot. Backend: `clerkMiddleware()`, `getOrCreateUser()` upserts `users.clerk_user_id`, `POST /api/sync/push` (last-write-wins replace, synthetic `__all_saved__` collection for flat list), `GET /api/sync/state` (cards round-tripped via articles+images join). Migration `0004_auth_sync.sql` adds `clerk_user_id` + streak columns.

**2. 3-card onboarding calibration** — `/onboarding/topics.tsx` (pick ≥3 from 18-topic curated set), `/onboarding/cards.tsx` (3 cards from `/api/cards/foryou` seeded by topics, explicit Save/Skip buttons, calibration events emitted). `useHasCalibrated` SecureStore flag, `<Redirect>` from `/index.tsx` when false.

**3. Quiz cards (SRS)** — shared `quizQuestionSchema`. Backend `lib/quiz.ts` + `POST /api/quizzes/generate` (Haiku 4.5 strict-JSON 4-option MCQ + explanation). Mobile `lib/quizzes.ts` SecureStore store with `dueQuizzes()` scanning by SRS schedule (1/3/7/21d), `recordAnswer`, missed-slot auto-advance, daily cap. `QuizCardView` reveals answer + explanation. `FeedItem` extended with `quiz` variant; `interleaveQuizzes` at every-3rd position on cold boot. `ensureQuizForArticle` triggered on save, `removeQuizForArticle` on unsave.

**4. Map feed** — `GET /api/cards/region?seed=<title>` reuses `fetchRelatedSummaries` (any Wikipedia article title → related-pages graph). Mobile `/map` index with continent + country pills (24 curated + free-text search), `/map/region` per-region vertical pager reusing `VerticalPager` + `CardView`. Feed-header map icon.

**5. Knowverse** — `lib/knowverse.ts` SecureStore graph (`stars[]` + `edges[]`, MAX 500/2000). `recordKnowverseStar` on save, `recordKnowverseEdge` on "More like this" tap inside reader. `/knowverse` screen: deterministic radial layout via hashed polar coords clustered by first category, recency-faded brightness, plain-View stars + rotated thin-View edges (no Skia / SVG). Tap-to-open via existing `ArticleReader` modal. Feed-header star icon.

**Verified:** typecheck clean across all 4 workspaces.
**Not done this session:** EAS rebuild, Clerk env wiring, migration apply, manual device test of the new flows.

---

*Older entries archived to [`CHECKPOINT.history.md`](./CHECKPOINT.history.md).*

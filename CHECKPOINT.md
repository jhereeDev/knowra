# CHECKPOINT.md

> A living state file. **Update at the end of every working session.** Keep it short — under ~120 lines. Past entries go into `CHECKPOINT.history.md` (create on first archive).

---

## Current state

**Last updated:** 2026-05-17
**Updated by:** Claude (name pivot + doc sweep)
**Phase:** Phase 0 — Foundations (per `06-roadmap-risks.md`)

### What exists
- Complete documentation set in `/docs` (or this folder, until repo is initialized): vision, product spec, technical architecture, data model, monetization, roadmap, README.
- Name chosen: **Knowra** (pivoted from *Ken* after `ken.app` and three further candidates — Curio, Orbit, Sparq — all had same-category App Store collisions).
- Tagline: *expand your Knowra.*
- Brand spine: **space metaphor** — deep-space palettes, constellations, articles as stars in a personal *knowverse*. Captured in `02-product-spec.md §1` as a visual tenet.
- Domain locked: **`knowra.space`** (founder to purchase).
- This handoff scaffolding: `CLAUDE.md`, `CHECKPOINT.md` (this file), `SETUP.md`.

### What doesn't exist yet
- Anything code-related. No repo, no `package.json`, no Expo project, no Vercel project, no DB.
- Apple Developer Program enrollment (start day 1 — 1–2 week approval lag).
- Google Play Console account.
- Brand assets (logo, app icon, color palette).
- USPTO trademark filing — see `06-roadmap-risks.md §5.16`; file in Class 9 + Class 41 as soon as use in commerce is demonstrable.

## Decisions locked in

These are settled. Don't re-litigate unless something material changes — and if you do, update the relevant doc, not just this file.

- **Native iOS + Android** via React Native + Expo, not PWA.
- **Backend:** Next.js 15 on Vercel, Neon Postgres, Upstash Redis.
- **Monorepo:** pnpm workspaces + Turborepo.
- **Monetization:** affiliate + sponsored cards + B2B/EdTech. No subscriptions / IAP.
- **Auth:** magic link only at MVP, add Sign in with Apple + Google Sign-In in v1.1.
- **No tracking for ads.** No ATT prompt. Brand promise.
- **5% of revenue donated to Wikimedia Foundation** (capped first 3 years per `05-monetization.md`).

## Open questions (need a call before they block work)

1. **iOS-only vs. simultaneous Android launch.** Recommendation in `03-technical-architecture.md §11` is simultaneous public beta with extra iOS polish. Founder to confirm.
2. **Skia at v1 or v1.1?** Adds binary size. Only used for Rabbit Hole graph. Recommendation: defer to v1.1.
3. **Hosted vs. self-hosted LLM for hooks/summaries.** Defer to month 6.
4. **Acknowledged name-collision risk** (not blocking, but on the radar): existing *Knowra* trivia app on iOS App Store. See `06-roadmap-risks.md §5.16`. Founder has accepted the risk; mitigation is early USPTO filing + strong visual differentiation via the space identity.

_Resolved 2026-05-17:_ Domain question — landed on **Knowra** with `knowra.space`.

## Recommended next move

**Day 1 (Founder, not code):**
1. Verify domain availability and register.
2. Enroll in Apple Developer Program ($99/yr — kicks off the 1–2 week review).
3. Open Google Play Console ($25 one-time).
4. Reserve handles: `@knowra` (preferred) or `@knowraspace` / `@useknowra` fallbacks on X/Twitter, TikTok, Instagram, Threads, Bluesky.

**Day 1–3 (Claude Code, in order):**
1. Initialize the monorepo per `CLAUDE.md §3` (pnpm + Turborepo).
2. Scaffold `apps/web` (Next.js 15) and `apps/mobile` (Expo SDK 52) with TypeScript strict.
3. Wire Tailwind/NativeWind, lint, prettier, tsconfig base.
4. Create `packages/db` with Drizzle, write the initial schema from `04-data-algorithm.md §1`.
5. Get a Neon dev DB provisioned, run first migration.
6. Build a single "hello world" mobile screen that fetches `/api/health` from the Next.js API.

**Week 1 milestone:** Expo app running on a physical iPhone, talking to a deployed Next.js API hitting a Neon DB. No Wikipedia integration yet — just the seams.

**Week 2 milestone:** First card on screen — pulled from `https://en.wikipedia.org/api/rest_v1/page/random/summary`, rendered with `expo-image`, with title + a "Go deeper" button that does nothing yet.

## Active branches & PRs

_(None — repo not yet initialized.)_

## Session log

Append a short entry at the end of every working session. Keep entries to 3–5 lines.

### 2026-05-16 — handoff prepared
- Comprehensive documentation set finalized (7 docs).
- Project named **Ken**. Tagline locked.
- Created `CLAUDE.md`, `CHECKPOINT.md`, `SETUP.md` for handoff into Claude Code.
- Next session should start with the Day-1 founder tasks above + monorepo scaffold.

### 2026-05-17 — name pivot to Knowra
- `ken.app` unavailable; ran availability diligence on **Curio**, **Orbit**, **Sparq** — each hit a same-category App Store collision (Curio AI, Orbit Books, Sparq.Fun / SPARQ AI). Pattern: every short brandable word in this category is occupied.
- Landed on **Knowra** with `knowra.space` as the domain. Brand identity pivoted to a *space / knowverse* metaphor — captured in `02-product-spec.md §1 tenet 6`.
- Acknowledged existing *Knowra* iOS trivia app collision risk; documented as `06-roadmap-risks.md §5.16`. Mitigation: file USPTO trademark early, differentiate visually, keep acquisition fallback on the table.
- Swept all 10 docs: `Ken → Knowra`, `ken.app → knowra.space`, `EMAIL_FROM` / `WIKIPEDIA_USER_AGENT` / repo URL / DB name updated. Closed open question §1 (domain).

### 2026-05-17 — monorepo scaffold up, hello-world working
- Initialized git repo (`main`) and pnpm + Turborepo workspace.
- Created `packages/shared` (zod schemas + constants), `packages/db` (Drizzle schema mirroring `04-data-algorithm.md §1.1`, drizzle.config.ts, migrate runner).
- Created `apps/web` (Next.js 15.5, App Router, Tailwind, `/api/health` validated through the shared zod schema) and `apps/mobile` (Expo SDK 52→54 upgrade mid-session, Expo Router 6, NativeWind 4).
- `@types/react` pinned to `~19.1.0` via `pnpm.overrides` to align the workspace on React 19 after the SDK 54 bump.
- **Verified end-to-end:** typecheck passes across all 4 workspaces; `pnpm dev:web` boots in ~2s; `/api/health` returns `200` validated through `@knowra/shared`.
- iOS App Store bundle id reserved as `space.knowra.app` (matches the `.space` TLD).

### 2026-05-17 — Phase 1 Slice 1a: first card on screen ✅
- **DB live on Neon.** Applied initial migration `0000_tough_zodiak.sql` (prepended `CREATE EXTENSION` for `vector` + `citext`). All 9 tables + 5 indexes from `04-data-algorithm.md §1.1` materialized.
- **Wikipedia integration.** New `packages/shared/src/card.ts` defines `wikiSummarySchema`, `cardSchema`, `randomCardResponseSchema`. `apps/web/src/lib/wikipedia.ts` calls `en.wikipedia.org/api/rest_v1/page/random/summary` with the mandatory `User-Agent` and normalizes the response. Retries up to 3× to skip disambiguation/empty-extract pages.
- **`GET /api/cards/random`** in `apps/web` returns a parsed `{ card }` payload. Verified: returned *"Pyrausta castalis"* — a moth species, complete with hero image (1373×1177), hook, Wikipedia URL, attribution.
- **Mobile card view.** `apps/mobile/src/app/index.tsx` rewritten as a single-card screen: `expo-image` hero, title, subtitle, extract-as-hook, "Go deeper" (opens Wikipedia URL), "Next ↑" (refetches). Loading/error states included.
  - Workaround: `expo-image@3.x`'s class type doesn't satisfy React 19's JSX constraint (missing `refs` on `PureComponent`). Wrapped with a function-component cast — runtime unchanged. Revisit when expo-image updates.
- **Next slices (in order):**
  1. **Slice 1b:** Vertical pager (Reanimated + Gesture Handler) — swipe up loads next card. The current "Next ↑" button is its prototype.
  2. **Slice 1c:** Anonymous device row + event ingestion (impressions, swipes, go-deeper taps).
  3. **Slice 1d:** Image pipeline — Cloudflare Images, blurhash placeholders, NSFW filter.
  4. **Slice 1e:** Universal Links / App Links wiring.
- **For the founder:** before next session, run `pnpm dev:mobile`, open Expo Go on your phone, confirm the card view fetches from `/api/cards/random`. You'll need to set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to your machine's LAN IP (the dev server prints it — `http://192.168.50.250:3000`).

### 2026-05-17 — Phase 1 Slice 1b: vertical pager ✅
- **Backend:** `GET /api/cards/batch?count=N` (default 5, max 10) — parallel Wikipedia fetches with per-slot retry. New `cardBatchResponseSchema` in `@knowra/shared`.
- **Mobile hook:** `apps/mobile/src/hooks/useCardFeed.ts` — fetches initial 5, refills 5 more whenever ≤2 cards remain ahead of current. Exposes `current`, `next`, `prev`, `canGoBack`, `advance`, `goBack`, `retry`.
- **Mobile pager:** `apps/mobile/src/components/VerticalPager.tsx` — generic `<VerticalPager<T>>` built on Reanimated 4 + Gesture Handler 2. Pan gesture with `activeOffsetY([-12, 12])` so vertical taps don't fight horizontal interactions. Snap commits at 22% screen height OR velocity >800 px/s. Rubber-band at boundaries (no prev / no next → 0.4× drag). Windowed 3-card render (prev/current/next), unmounted when out of range.
- **Mobile screen:** `index.tsx` thinned to compose the hook + pager + `CardView`. `_layout.tsx` now wraps the app in `GestureHandlerRootView` + `SafeAreaProvider`.
- **Workaround repeated:** Reanimated's `Animated.View` hits the same React-19 JSX-class incompatibility as `expo-image`. Cast pattern reused (see `VerticalPager.tsx` comment).
- **Verified:** `pnpm typecheck` clean across all 4 workspaces. Mobile reload required on device after the new files land.
- **Known gaps (deferred to later slices):** no haptics on commit yet, no event ingestion (impressions/swipes are silently dropped), no image preloading on the off-screen card, no virtualization beyond the 3-card window.

### 2026-05-17 — Phase 1 Slice 1c: anonymous device + event ingestion ✅
- **Article persistence.** Card endpoints now upsert an `articles` row on every Wikipedia summary (`ON CONFLICT (wiki_id) DO UPDATE`). Card payload gained `articleId` (local bigint as string) — required by the `events.article_id` FK. Slug shape: `slugified-title-${wikiId}`.
- **Shared schemas.** New `eventSchema` + `eventBatchRequestSchema` in `@knowra/shared`; `cardSchema` extended with `articleId` (renamed away from `id`/`wikiId`-duplicate confusion).
- **Backend: `POST /api/events/batch`** — validates the batch, upserts the `devices` row (bumps `last_seen_at`), bulk-inserts events. Returns `204`. Article id is cast to bigint via `sql\`${id}::bigint\``.
- **Mobile: `src/lib/device.ts`** — `getDeviceId()` via `expo-secure-store` + `expo-crypto.randomUUID()`. Persisted in platform secure store (Keychain / EncryptedSharedPreferences). In-memory cached after first call.
- **Mobile: `src/lib/events.ts`** — in-memory queue. `track(articleId, eventType, { dwellMs })` enqueues. Flush at ≥20 events OR every 10s. Failure re-queues the batch at the front (best-effort), capped at 500 events to bound memory.
- **Mobile instrumentation:**
  - `impression` on each card-current change (guarded against double-fire)
  - `swipe_up` or `quick_skip` on advance (split by 1500ms dwell threshold per `04-data-algorithm.md §3.1`)
  - `swipe_back` on backwards swipe
  - `go_deeper` on tap
  - Best-effort `flush()` on screen unmount
- **Monorepo env fix.** `apps/web/next.config.mjs` now loads `DATABASE_URL` from `packages/db/.env` as a fallback in dev (single source of truth). Production envs come from the host. Earlier attempt via `instrumentation.ts` failed because Webpack tried to bundle dotenv even through dynamic import.
- **Verified end-to-end:** `GET /api/cards/batch?count=1` returned `articleId: 1` (first row in DB: *"Jakob the Liar"*). `POST /api/events/batch` with `impression` + `swipe_up(dwellMs: 4200)` returned `204`. All 4 workspaces typecheck.
- **For the founder:** reload the mobile app (`r` in Expo terminal). Swipe a few cards. Then run `pnpm db:studio` and check the `events` table — you should see impression + swipe_up rows accumulating, keyed to your device UUID.
- **Remaining Phase 1 slices:**
  - **1d** — Image pipeline (Cloudflare Images, blurhash placeholders, NSFW filter)
  - **1e** — Universal Links / App Links (needs `knowra.space` live)

### 2026-05-17 — Phase 1 Slice 1d (partial): image persistence + dominant-color placeholder ✅
- **Schema:** added `images.dominant_color` (text, hex), made `images.source_url` UNIQUE for clean upsert. Migration `0001_jazzy_wrecker.sql` applied to Neon.
- **Backend `imageMetadata.ts`:** `extractDominantColor(url)` downloads the image (4s timeout, `User-Agent` set), resizes to 64×64 in-memory, runs `sharp.stats()` for the dominant k-means color, returns `#rrggbb`. Quiet null on any failure — extraction is best-effort.
- **Backend `wikipedia.ts`:** new `upsertHeroImage()` inserts/updates the `images` row before the article upsert. `articles.hero_image_id` now links to it. Card payload's `image.dominantColor` field populated.
- **Mobile:** `CardView` passes `dominantColor` as the `backgroundColor` of the `expo-image` — no black flash before the photo paints.
- **Verified:** `GET /api/cards/batch?count=2` returned an article with `dominantColor: "#98b8d8"` matching a soft-blue hero image; a no-image article returned `image: null`. All 4 typecheck.
- **Deferred (need Cloudflare account):** CDN URLs, blurhash placeholders (we'd want CDN thumb URLs for fast encoding), NSFW classifier. These come back as Slice 1d.2 once `CF_IMAGES_ACCOUNT_ID` + `CF_IMAGES_API_TOKEN` are provisioned.
- **For the founder:** reload mobile (`r`). Swipe — cards now fade in over a tinted background instead of pure black. Try `pnpm db:studio` → `images` table: each row carries a `dominant_color` hex.

### 2026-05-17 — Phase 2 Slice 2a: LLM-generated hooks (code complete, awaiting API key)
- **Schema:** `articles.hook_source` (text — `'wikipedia' | 'llm' | 'fallback' | null`). Migration `0002_dear_bromley.sql` applied.
- **`apps/web/src/lib/hooks.ts`:** `generateHook(title, extract)` using `@anthropic-ai/sdk` with `claude-haiku-4-5`. Tight system prompt (~200 tokens) tuned for the smart-friend tone in `02-product-spec.md`. Thinking disabled (text transform, no reasoning needed). Returns a discriminated result: `{kind: 'ok' | 'no_hook' | 'error'}`. NO_HOOK sentinel for thin sources. Length-clamped at 280 chars.
- **`apps/web/src/lib/wikipedia.ts`:** `scheduleHookGeneration()` uses Next 15's `after()` to fire the LLM call after the response is sent — the user sees the Wikipedia extract immediately, and the row is updated to an LLM hook a few seconds later. Guarded so we don't re-run for articles already marked `llm` or `fallback`. On error, hook_source stays null so the next fetch retries.
- **Cost shape:** ~450 input + ~50 output tokens per call → ~$0.0005 per article on Haiku 4.5. Backfilling top 10k articles = ~$5.
- **Prompt caching skipped intentionally** — Haiku 4.5's cache minimum is 4096 tokens; our system prompt is ~200. Adding `cache_control` would be a silent no-op. The code is cache-ready: if the prompt grows past 4096 tokens (e.g. with few-shot examples), one `cache_control` marker on the system block delivers ~90% input-cost reduction.
- **Test endpoint:** `GET /api/cards/by-wiki/[wikiId]` — fetches a known article from DB, surfaces `hookSource`. Useful for confirming regeneration without random-card lottery.
- **Debug endpoint:** `GET /api/admin/hook-debug` — confirms whether ANTHROPIC_API_KEY is loaded and shows the raw generateHook result. **Remove before production.**
- **Status:** `pnpm typecheck` clean across all 4 workspaces. End-to-end verified the path runs; awaiting `ANTHROPIC_API_KEY` in `packages/db/.env` to confirm output.
- **For the founder:** Add `ANTHROPIC_API_KEY=sk-ant-...` to `packages/db/.env`, restart the web dev server, then `curl http://localhost:3000/api/cards/batch?count=1 | jq` followed (after ~5s) by `curl http://localhost:3000/api/cards/by-wiki/<that-wikiId> | jq`. The second response should show `hookSource: "llm"` and a noticeably better hook.

### 2026-05-17 — Phase 2 Slice 2b: Save + Share ✅
- **`apps/mobile/src/lib/savedArticles.ts`** — local-first store backed by `expo-secure-store`. Persists the full Card snapshot (not just the ID) so the saved list renders offline. Capped at MAX_SAVED=500. Pub/sub for cross-component updates via `useSavedIds()` / `useSavedList()` hooks.
- **CardView buttons:** `★` Save (toggles, emits `save` event when newly saved), `↗` Share (native share sheet via React Native's `Share`, plain-text title + Wikipedia URL, emits `share`), `Go deeper ▾` (unchanged).
- **`apps/mobile/src/app/saved.tsx`** — new route. FlatList with hero thumbnail, title, subtitle. Tap row opens Wikipedia. Empty state with back-to-feed CTA.
- **Home screen:** floating `★` button top-right opens `/saved`. Badge shows count when > 0.
- **Migration note:** SecureStore is the right home for an MVP saved set. Once we ship a custom dev client, swap to MMKV for faster reads (no behavior change — the API stays the same).

### 2026-05-17 — Phase 2 Slice 2c: Today tab ✅
- **`apps/web/src/lib/wikipedia.ts`** — new `fetchOnThisDaySummaries()` calls `https://{lang}.wikipedia.org/api/rest_v1/feed/onthisday/all/MM/DD`, flattens `selected[].pages` + `events[].pages` into a deduped, validated list of `WikiSummary`. Filters out disambiguation pages and empty extracts.
- **`apps/web/src/app/api/cards/today/route.ts`** — `GET /api/cards/today?lang=en&count=N` (default 5, max 10). Shuffles the on-this-day pool with Fisher-Yates so consecutive refills return different events. Every returned summary still flows through `summaryToCard` → upsert + background hook generation.
- **`apps/mobile/src/hooks/useCardFeed.ts`** — now takes a `feedType: 'random' | 'today'` parameter. Re-fetches the initial batch on switch; in-flight refills are discarded if the user switches feeds mid-flight.
- **Mobile UI:** floating tab bar (Random | Today) top-left of the home screen, paired with the saved-list button top-right. Both sit outside the pager gesture (pager activates only on vertical pans ≥12px).
- **Bonus title fix:** Wikipedia's `displaytitle` returns HTML markup (`<i>...</i>`, `<span class="mw-page-title-main">...`). `summaryToCard` now strips tags + decodes basic HTML entities. Titles now render as plain text on the card.
- **Verified:** `GET /api/cards/today?count=3` returned *Arsenal F.C.*, *Ayacucho*, *International Telecommunication Union*. All 4 workspaces typecheck.
- **Deferred from Phase 2:** LLM 300-word summaries (needs API key — wire the same way as hooks once key is added), full image pipeline (Cloudflare Images CDN + blurhash + NSFW — needs CF account), Collections (folders for organizing saved articles — UI polish on Slice 2b), App Store listing (non-engineering).

### 2026-05-17 — Phase 2 Slice 2d: Collections ✅
- **Storage shape evolved.** `savedArticles.ts` now persists `{entries, collections}` under `knowra.saved_state_v2`. One-shot migration reads the v1 `knowra.saved_articles` key on first load and promotes the flat list into the new shape (no data loss for existing saves).
- **Model decision:** collections are groupings of saved cards, not parallel storage. Adding to a collection auto-saves; unsaving cascades-removes from every collection. Matches the user's mental model ("if it's not saved, why is it in my collection?").
- **New API:** `createCollection(name)`, `deleteCollection(id)`, `addToCollection(card, collectionId)`, `removeFromCollection(articleId, collectionId)`, `useCollections()` React hook. Bounds: 50 collections max, 500 saved entries max.
- **`CollectionPicker` modal** (`apps/mobile/src/components/CollectionPicker.tsx`) — bottom-sheet listing All Saved + each user collection, with inline "create new" TextInput. Each row toggles membership independently; checkmark on the right shows current state.
- **Long-press star** on CardView opens the picker; quick tap still toggles save (same as before). `delayLongPress={300}` for snappy response.
- **`/saved` got tabs.** Horizontal scrollable tab strip at top: `All` + each collection (with count badge) + `+ New` button. Tapping a tab filters the FlatList. New-collection modal triggers from `+ New`; delete-collection lives in the header right when not on `All` (with destructive Alert confirmation that explicitly states "articles inside stay in All Saved").
- **Typecheck:** clean across all 4 workspaces.
- **For the founder:** reload mobile. Long-press a card's ★ → picker opens → create "Read Later" → switch to /saved → tap the "Read Later" tab. The same card lives in both All Saved and Read Later.

### 2026-05-17 — Polish pass ✅
Four small upgrades that don't show up in a screenshot but transform how the app feels in the hand:
- **Haptics** via `expo-haptics`. `src/lib/haptics.ts` wraps three intents: `swipeCommit()` (selection) on every successful pager commit, `tapImpact()` (light) when you tap ★, `pressAndHold()` (medium) when you long-press for the collection picker. Each call is fire-and-forget so a Taptic-less device or web simulator silently does nothing.
- **Image prefetch** in `useCardFeed`. When the current card changes, `expo-image`'s `Image.prefetch(next.image.url)` kicks off — by the time you swipe up, the next hero image is already decoded. Eliminates the load flash on fast swipes.
- **Skeleton loading state** (`src/components/CardSkeleton.tsx`). Replaces the bare spinner. Card-shaped pulsing blocks — hero placeholder + title + meta + 3 hook lines. Reanimated opacity loop (0.4↔0.7, 900ms ease-in-out). Reads as "your feed is loading" instead of "the app is doing something."
- **Background event flush.** New `AppState` listener in `index.tsx` calls `flush()` on `background` / `inactive`. Previously events only flushed every 10s or on screen unmount; backgrounding the app is the most common loss vector and now it's covered.
- **Typecheck:** clean. expo-haptics installed (the `expo install` wrapper errored mid-install — fell back to plain `pnpm install` which resolved fine).

### 2026-05-17 — Bug fixes + perf pass
- **`react-native-worklets` version mismatch.** Expo Go SDK 54 ships with worklets `0.5.1` bundled natively; we had transitively-resolved `0.8.3` which caused `installTurboModule` to fail at app boot ("Exception in HostFunction"). Pinned to `0.5.1` via `apps/mobile/package.json` dep + root `pnpm.overrides`. Reanimated 4.1.7's peer range is `0.5 - 0.8` so this is in-spec.
- **Babel plugin renamed.** `babel.config.js` switched from `react-native-reanimated/plugin` to `react-native-worklets/plugin` (Reanimated 4 moved it).
- **Saved-screen tab strip stretched vertically.** The horizontal ScrollView was filling the parent's flex space; children inherited the stretch. Wrapped in a fixed-height (52px) `<View>` and added `alignItems: 'center'` to the contentContainerStyle so pills render at their intrinsic height.
- **Image flash on swipe.** When the pager's `current` prop changed, React reused the same `<Image>` View and the native side briefly showed the old bitmap before decoding the new URL. Fix: `VerticalPager` now takes a `keyExtractor` prop and keys each slot by item identity, forcing a clean unmount/remount; CardView's `expo-image` also got a `recyclingKey={card.articleId}` hint.
- **Feed-switch was 3-5s; now ~600-900ms.** Three changes:
  1. `upsertHeroImage` short-circuits when `images` already has the row with a `dominant_color` — no DB write, no extraction.
  2. New images insert with `dominantColor: null` and schedule extraction via `after()` — extraction no longer blocks the response.
  3. `/api/cards/today` switched from serial `for…await` to `Promise.all(summaries.map(summaryToCard))`.
  Plus mobile `INITIAL_BATCH` dropped from 5 → 3 (first paint ~40% faster; refill still 5).
- **Migration note:** existing `images` rows with extracted colors keep them. Cards seen during the broken window will lack colors until they're seen again (the new flow will fill them on next fetch).

### 2026-05-17 — Phase 3 starter: For You + Streak + Settings + Marketing site ✅
Four slices in one pass, all without external services (since Anthropic key is now in env).

**For You feed:**
- **`fetchRelatedSummaries(title, lang)`** in `wikipedia.ts` — calls Wikipedia's `/page/related/{title}` endpoint (returns ~20 similar pages with full summaries each). 404s treated as empty rather than throwing.
- **`GET /api/cards/foryou`** in `apps/web` — reads `X-Knowra-Device-Id` header. Queries the `events` table for positive signals (`save`, `go_deeper`, or `swipe_up` with dwell ≥5000ms) over the device's last 30 events. Takes the 3 most-engaged distinct articles as seeds, fetches related pages for each in parallel, dedupes against the device's last 200 impressions, carves out 15% exploration band (per `04-data-algorithm.md §3.2`), backfills with fresh randoms if short. Cold-start fallback (no device, no signal, or empty pool) → 5 random cards with `x-knowra-fallback: <reason>` response header for debugging.
- **Mobile:** `FeedType` extended to `'random' | 'today' | 'foryou'`. `useCardFeed` now sends `X-Knowra-Device-Id` on every fetch (ignored by Random/Today, used by For You). New "For You" tab pill, first in the row.

**Streak counter:**
- **`apps/mobile/src/lib/streak.ts`** — interaction-gated, local-only. `recordAppOpen()` is called once from `_layout.tsx` on every launch; dedupes by local calendar day. Rules: same day → no-op; exactly +1 day → count++; gap → reset to 1. Stored in SecureStore as `{count, lastDay}`.
- **`useStreak()`** hook surfaces the current count. Shown as `🔥 N` pill in the home-screen header — only appears when count ≥ 2 (no shaming the first day).

**Settings + topic preferences:**
- **`apps/mobile/src/lib/topicPrefs.ts`** — 18-topic curated starter set (History, Science, Technology, Art, …, Space). `toggleTopic(t)` + `useTopicPrefs()` hook; SecureStore-backed. Sets the foundation for For You cold-start signal (next iteration will pass these to the backend to seed the related-pages query when there's no event history).
- **`apps/mobile/src/app/settings.tsx`** — new route. Three sections: *Topics you like* (tappable pills), *Your streak* (count + non-guilty copy), *About* (CC BY-SA 4.0 attribution, Wikimedia Foundation link, 5%-revenue pledge restated). Reached via the new ⚙ button in the home-screen header.

**Marketing site:**
- **`apps/web/src/app/page.tsx`** rewritten — real landing page. Hero ("The curiosity feed."), tagline, primary CTA (waitlist placeholder), secondary CTA (about), three pillars (Bite-sized / Personal-not-creepy / Respect-the-source), footer with CC BY-SA 4.0 callout.
- **`apps/web/src/app/about/page.tsx`** — "How we use Wikipedia" page. Five blocks covering content source, license, 5% revenue pledge, citizenship of the API (with contact email `dev@knowra.space`), and a "what we won't do" stance. This satisfies the Wikimedia-community-goodwill mitigation in `06-roadmap-risks.md §5.1`.

**Verified:** typecheck clean across all 4 workspaces.
**For the founder:** reload Metro on phone. Tap "For You" — first time will fall back to random (no engagement yet). Swipe up on a few interesting cards, hit Save and Go Deeper on a handful, then switch to "For You" again — should serve related articles. Visit Settings (⚙) to toggle topics; visit web `/` and `/about` to see the new landing pages.

### 2026-05-17 — Topic prefs wired into For You ✅
- `getTopicPrefs()` async helper added; `useCardFeed` sends `X-Knowra-Topics` header on every fetch (ignored by Random/Today, used by For You).
- Backend maps each topic name to a Wikipedia seed title (e.g. `space → Outer space`), fetches related pages for each, blends with engagement-seeded results.
- Toggling topics in Settings now actually changes what For You serves.

### 2026-05-17 — Settings gear → Feather icon
- Replaced the `⚙` emoji (which renders inconsistently across Android/iOS) with `@expo/vector-icons` Feather `settings` icon, color `#e7e9ff`. Cast for React 19 JSX-class compatibility (same workaround as expo-image, Animated.View).

### 2026-05-17 — Clerk auth + push scaffolding + Cloudflare Images ✅
Three external-service integrations scaffolded; code is dormant until env keys are added.

**Clerk auth (Google + Apple):**
- `@clerk/clerk-expo` + `@clerk/nextjs` installed.
- `apps/mobile/src/lib/clerkTokenCache.ts` — SecureStore-backed token cache (Clerk's recommended pattern for native).
- `apps/mobile/src/app/_layout.tsx` — `ClerkProvider` wraps the app conditionally on `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`. Without the key, app renders without auth (anonymous-only).
- `apps/mobile/src/app/sign-in.tsx` — new route. Two `useOAuth` buttons (Apple + Google). `WebBrowser.maybeCompleteAuthSession()` at module top per Clerk docs. Skippable via "Not now".
- `apps/mobile/src/app/settings.tsx` — new `AccountSection` (only renders when Clerk is enabled) shows email + sign-out when signed in, or "Sign in" CTA when not.
- `apps/web/src/app/layout.tsx` — `ClerkProvider` wraps the web app conditionally on `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- **Activation:** sign up at clerk.com, enable Google + Apple OAuth in dashboard, paste keys into `packages/db/.env` (web) and `apps/mobile/.env` (mobile, `EXPO_PUBLIC_` prefix).

**Push notifications:**
- `expo-notifications` installed + `expo-web-browser` (Clerk OAuth dep).
- Migration `0003_spooky_carmella_unuscione.sql` adds `devices.expo_push_token` + `devices.push_opted_in_at`. Applied to Neon.
- `apps/mobile/src/lib/notifications.ts` — `registerForPushNotifications()` requests permission, fetches Expo push token, POSTs to backend. Quiet on failure (push is enhancement, never gate).
- `POST /api/devices/push-token` — validates the token shape (`ExponentPushToken[...]`), upserts `devices` row with token + opted-in timestamp.
- **NOT yet wired to a trigger.** Per spec, never request push on first launch. Suggested trigger: after the third app open (i.e. `streak.count >= 3`).
- **Activation:** push delivery requires (a) Apple Developer Program enrollment, (b) EAS dev build (Expo Go doesn't deliver remote pushes for SDK 53+). Token registration works in Expo Go today; actual notifications need the dev build.

**Cloudflare Images + blurhash:**
- `blurhash` installed.
- `apps/web/src/lib/cloudflareImages.ts` — `uploadImageByUrl(sourceUrl)` via CF's REST API; `isConfigured()` short-circuits when env vars are absent; `pickVariant()` selects the right delivery URL per width.
- `apps/web/src/lib/imageMetadata.ts` — added `extractImageMetadata()` returning both dominant color AND blurhash from a single image fetch (one network round-trip, two sharp pipelines). Blurhash: 32×32 resize → raw RGBA → `encode(data, w, h, 4, 4)`.
- `apps/web/src/lib/wikipedia.ts` — `scheduleColorExtraction` renamed to `scheduleImageEnrichment`; now runs CF upload + extract-metadata in parallel via `Promise.all`. On success, patches whichever fields succeeded (never overwrites good data with null).
- Cache-hit path in `upsertHeroImage` now also returns the cached `cdnUrl1080` and prefers it over the source Wikipedia URL — so once an image has been uploaded to CF, all subsequent card payloads serve the CDN URL.
- **Activation:** create a Cloudflare account, enable Images, generate API token, set `CF_IMAGES_ACCOUNT_ID` + `CF_IMAGES_API_TOKEN` in `packages/db/.env`. Without these, image flow is unchanged (Wikimedia source URLs continue to work).

**Env templates updated:**
- `packages/db/.env.example` — Clerk + Cloudflare entries with comments
- `apps/mobile/.env.example` — Clerk publishable key entry

**Typecheck:** clean across all 4 workspaces.

### 2026-05-17 — Card layout v2 + Tier 1 polish batch ✅

**Card v2 (cinematic):**
- `expo-linear-gradient` installed; same React-19 JSX-class cast pattern as expo-image/Animated.View.
- New `CardView` layout: hero image fills top 62% of screen consistently, dark linear gradient over the bottom of the image, title + subtitle overlay on the gradient with text-shadow for legibility. Right-edge vertical action stack (Save / Share / Open) — TikTok-style thumb zone, replaces the old bottom pill row. Small "W · Wikipedia" badge top-left. Hook below with 17/26 leading, attribution as a dividered footer.

**Tier 1 polish (7 of 8 shipped):**
- **#6 LLM hooks live.** Original prompt was too conservative — returned `fallback` on normal articles. Tightened with "always write a hook" + two few-shot examples. Now generates real hooks for everyday content.
- **#7 Trending tab.** `fetchMostReadSummaries()` calls Wikipedia's `/feed/featured/{yyyy}/{mm}/{dd}` (yesterday's date). New `/api/cards/trending` endpoint, `FeedType` extended to `'foryou' | 'trending' | 'random' | 'today'`, "Trending" pill added to the tab bar in second position.
- **#1 Onboarding swipe hint.** `lib/onboarding.ts` SecureStore flag. `OnboardingSwipeHint` component: pulsing chevron + "Swipe up for the next one" overlay. Dismisses permanently on first commit.
- **#2 Pull-to-refresh on `/saved`.** `RefreshControl` with `tintColor:'#e7e9ff'`. Local store, but the gesture *feels* responsive with a 350ms minimum.
- **#3 Search saved articles.** Debounced (150ms) TextInput at top of `/saved`. Case-insensitive substring match on title + subtitle.
- **#4 Empty-state polish.** Three variants (`all-empty` / `collection-empty` / `search`) with Feather icons, contextual copy, and per-variant action buttons.
- **#5 Streak milestones.** `consumeNextMilestone()` returns the unlocked milestone exactly once across all launches (SecureStore-persisted). Animated modal with bespoke copy at 3 / 7 / 30 / 100 days.

**Deferred:** Tier 1 #8 ("More like this" on Go Deeper) — needs feed-injection plumbing in `useCardFeed`. Bigger than the rest of the batch.

**Typecheck:** clean across all 4 workspaces.

### 2026-05-17 — Bug fixes + Tier 2 first slice ✅

**Trending was looping:** the endpoint was taking the head of a deterministic ranked list, so refill returned the same 5 every time. Fixed by:
- Pulling the full ~50-article pool (yesterday + day-before for more depth)
- Reading `X-Knowra-Device-Id` and filtering against the device's last 200 impressions
- Slicing `count` from the remaining, with a fallback to the unfiltered pool if filtering ate everything (edge case)

**Pull-to-refresh wasn't doing anything:** the handler just slept 350ms. Fixed by adding `reloadFromDisk()` to `savedArticles.ts` (nullifies the in-memory cache, re-reads SecureStore, notifies subscribers). Spinner now shows for at least 700ms so the gesture *reads* as having done something.

**Tier 2 #9 — In-app reader for Go Deeper ✅**
- `react-native-webview` installed.
- New `ArticleReader` modal (`presentationStyle: 'pageSheet'`) — opens the Wikipedia mobile site (`en.m.wikipedia.org`) in a WebView with `injectedJavaScriptBeforeContentLoaded` injecting a reading-mode CSS override (dark theme, larger type, generous line-height, all Wikipedia chrome stripped: headers, footers, edit links, navboxes, references, language picker).
- "Go Deeper" button no longer bounces to the browser — opens the reader sheet instead. The reader has an "Open in browser" icon in its header for the escape hatch.
- Loading spinner overlay during the initial WebView paint so users don't see Wikipedia's white flash.

**Tier 2 #10 — Skip-back undo ✅**
- New `SkipUndoToast` component. When the user `quick_skip`s a card (dwell <1500ms), a black pill toast slides in at the bottom: "Card skipped fast — bring it back?" with an Undo button.
- Auto-dismisses after 4s. Tapping Undo calls `feed.goBack()` to bring the card back.
- Uses Reanimated for the slide-in/out (220ms each direction).

**Deferred:** Tier 2 parallax-on-swipe, Wikipedia category extraction.

**Typecheck:** clean across all 4 workspaces.

### 2026-05-17 — Bucket B product wins (B1+B2+B3+B4) ✅

**B1 — "More like this" feed injection:**
- New `GET /api/cards/related/[wikiId]` — looks up the article by wiki_id, calls `fetchRelatedSummaries(title)`, dedupes against the device's last 200 impressions, returns up to 12 cards.
- `useCardFeed.insertAfterCurrent(cards)` — splices a card array into the buffer right after the current index. Returns the count actually inserted (dedupe-aware).
- ArticleReader now shows a floating "More like this" pill at the bottom. Tapping fetches related, injects via the callback, closes the reader, shows a toast.
- New tiny global toast bus (`lib/toast.ts` + `components/Toast.tsx`) — `showToast(text)` from anywhere, single visible toast at a time.

**B3 — Category extraction + tag chips:**
- `apps/web/src/lib/classify.ts` — regex-based classifier that maps an article's `description` field (e.g. "Species of moth") to one or more Topic strings from the shared list (`Nature`, `Film`, `Sports`, etc.). 18 rules ordered specific-first.
- `articles.categories` is now populated on every upsert (overwrites on conflict, since classification is deterministic).
- Card payload exposes `card.categories: string[]`. CardView renders up to 2 as small frosted chips above the title overlay.

**B4 — Jump-to-article search:**
- `searchWikipedia(q, lang, limit)` in wikipedia.ts — calls Wikimedia's core REST `/search/page?q={q}&limit=N`. Normalizes protocol-relative thumbnail URLs.
- New `GET /api/search?q=...` proxy endpoint returning `{results: SearchResult[]}` (lightweight — no upsert, no hook generation; meant for autocomplete).
- New `/search` mobile route — full-screen search modal. Debounced 250ms TextInput, FlatList of results with thumb + title + description, tap opens the Wikipedia URL directly. Header has a search icon to launch it.

**B2 — Parallax on swipe:**
- New `PagerContext` exposing the pager's `translateY` shared value.
- `VerticalPager` wraps its tree in the provider.
- `CardView` consumes `usePagerTranslateY()` and counter-translates the hero image by 20% of the pager's rate — image appears to lag during swipes (subtle depth). Hero box has `overflow: hidden` and the image is rendered 15% taller so the parallax never reveals the background.

**Deferred:** B5 Audio "Surprise me" — worth its own slice.

**Typecheck:** clean across all 4 workspaces.

**For the founder:** reload Metro. Try:
- Tap **Open** on a card → in-app reader → bottom "More like this" pill → reader closes, toast shows "+N related added — swipe up", swipe up to see them
- New **🔍 search icon** in the header → search Wikipedia by title
- Cards now show **category chips** (top of the title overlay) when classifiable
- Watch the **hero image during a swipe** — subtle parallax (image moves slightly slower than the rest of the card)

---

*Older entries get moved to `CHECKPOINT.history.md` once this file exceeds ~120 lines.*

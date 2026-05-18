# CHECKPOINT history

Archived session log entries from `CHECKPOINT.md`. The live file keeps only the most recent 2-3 entries to stay under ~120 lines.

---

## 2026-05-16 — handoff prepared
- Comprehensive documentation set finalized (7 docs).
- Project named **Ken**. Tagline locked.
- Created `CLAUDE.md`, `CHECKPOINT.md`, `SETUP.md` for handoff into Claude Code.
- Next session should start with the Day-1 founder tasks above + monorepo scaffold.

## 2026-05-17 — name pivot to Knowra
- `ken.app` unavailable; ran availability diligence on **Curio**, **Orbit**, **Sparq** — each hit a same-category App Store collision (Curio AI, Orbit Books, Sparq.Fun / SPARQ AI). Pattern: every short brandable word in this category is occupied.
- Landed on **Knowra** with `knowra.space` as the domain. Brand identity pivoted to a *space / knowverse* metaphor — captured in `02-product-spec.md §1 tenet 6`.
- Acknowledged existing *Knowra* iOS trivia app collision risk; documented as `06-roadmap-risks.md §5.16`. Mitigation: file USPTO trademark early, differentiate visually, keep acquisition fallback on the table.
- Swept all 10 docs: `Ken → Knowra`, `ken.app → knowra.space`, `EMAIL_FROM` / `WIKIPEDIA_USER_AGENT` / repo URL / DB name updated. Closed open question §1 (domain).

## 2026-05-17 — monorepo scaffold up, hello-world working
- Initialized git repo (`main`) and pnpm + Turborepo workspace.
- Created `packages/shared` (zod schemas + constants), `packages/db` (Drizzle schema mirroring `04-data-algorithm.md §1.1`, drizzle.config.ts, migrate runner).
- Created `apps/web` (Next.js 15.5, App Router, Tailwind, `/api/health` validated through the shared zod schema) and `apps/mobile` (Expo SDK 52→54 upgrade mid-session, Expo Router 6, NativeWind 4).
- `@types/react` pinned to `~19.1.0` via `pnpm.overrides` to align the workspace on React 19 after the SDK 54 bump.
- **Verified end-to-end:** typecheck passes across all 4 workspaces; `pnpm dev:web` boots in ~2s; `/api/health` returns `200` validated through `@knowra/shared`.
- iOS App Store bundle id reserved as `space.knowra.app` (matches the `.space` TLD).

## 2026-05-17 — Phase 1 Slice 1a: first card on screen ✅
- **DB live on Neon.** Applied initial migration `0000_tough_zodiak.sql`. All 9 tables + 5 indexes materialized.
- **Wikipedia integration.** `wikiSummarySchema`, `cardSchema`, `randomCardResponseSchema` in shared. `apps/web/src/lib/wikipedia.ts` calls Wikipedia REST with the mandatory `User-Agent`. Retries up to 3× to skip disambiguation/empty-extract pages.
- **`GET /api/cards/random`** returns a parsed `{ card }` payload.
- **Mobile card view.** `apps/mobile/src/app/index.tsx` rewritten as a single-card screen: `expo-image` hero, title, subtitle, extract-as-hook, "Go deeper", "Next ↑".
- expo-image's class type doesn't satisfy React 19's JSX constraint — wrapped with a function-component cast (recurring pattern).

## 2026-05-17 — Phase 1 Slice 1b: vertical pager ✅
- **Backend:** `GET /api/cards/batch?count=N` (default 5, max 10) — parallel Wikipedia fetches with per-slot retry.
- **Mobile hook:** `useCardFeed.ts` — initial 5, refills 5 when ≤2 ahead.
- **Mobile pager:** `VerticalPager.tsx` — generic `<VerticalPager<T>>` on Reanimated 4 + Gesture Handler 2. Snap commits at 22% screen height OR velocity >800 px/s. Windowed 3-card render.
- Reanimated's `Animated.View` cast pattern repeated.

## 2026-05-17 — Phase 1 Slice 1c: anonymous device + event ingestion ✅
- **Article persistence.** Card endpoints upsert `articles` rows. Card payload gained `articleId`.
- **`POST /api/events/batch`** — validates, upserts device row, bulk-inserts events. Returns `204`.
- **Mobile:** `device.ts` (SecureStore + crypto.randomUUID), `events.ts` (in-memory queue, flush at 20 events or 10s).
- **Instrumentation:** impression / swipe_up / quick_skip / swipe_back / go_deeper. Best-effort flush on unmount + on AppState background.

## 2026-05-17 — Phase 1 Slice 1d (partial): image persistence + dominant-color ✅
- Added `images.dominant_color`, made `images.source_url` UNIQUE for upsert. Migration `0001_jazzy_wrecker.sql`.
- `imageMetadata.ts`: downloads image (4s timeout, User-Agent set), `sharp.stats()` for k-means dominant color.
- `CardView` passes `dominantColor` as `expo-image` background — no black flash.
- Deferred (need Cloudflare): CDN URLs, blurhash, NSFW classifier.

## 2026-05-17 — Phase 2 Slice 2a: LLM-generated hooks ✅
- Schema: `articles.hook_source`. Migration `0002_dear_bromley.sql`.
- `hooks.ts`: Haiku 4.5 with tight system prompt (~200 tokens). Discriminated result: `ok | no_hook | error`. Length-clamped 280 chars.
- `scheduleHookGeneration()` via Next 15's `after()` — extract first, LLM hook later. Cost: ~$0.0005/article.

## 2026-05-17 — Phase 2 Slice 2b: Save + Share ✅
- `savedArticles.ts` — SecureStore, capped at 500. Pub/sub for cross-component updates.
- CardView: ★ Save, ↗ Share, Go deeper. `/saved` route with FlatList + empty state.

## 2026-05-17 — Phase 2 Slice 2c: Today tab ✅
- `fetchOnThisDaySummaries()` flattens `selected[]` + `events[]` from the OnThisDay endpoint.
- `/api/cards/today?lang=en&count=N`. Fisher-Yates shuffle for variety.
- Mobile: `feedType: 'random' | 'today'` + floating tab bar (Random | Today).
- Bonus: `summaryToCard` strips HTML tags from `displaytitle`.

## 2026-05-17 — Phase 2 Slice 2d: Collections ✅
- `savedArticles.ts` storage evolved to `{entries, collections}`. One-shot migration from v1 key.
- Model: collections are subsets of saved. Adding auto-saves; unsaving cascade-removes.
- `CollectionPicker` modal, long-press star to open. `/saved` got tabs + create-new + destructive delete.

## 2026-05-17 — Polish pass ✅
- **Haptics**: `swipeCommit / tapImpact / pressAndHold` wrapping `expo-haptics`.
- **Image prefetch** in `useCardFeed` — next hero image decoded before swipe.
- **Skeleton loading**: card-shaped pulsing blocks instead of bare spinner.
- **Background event flush** via AppState listener.

## 2026-05-17 — Bug fixes + perf pass
- **`react-native-worklets` version mismatch.** Pinned to `0.5.1` via root overrides. Babel plugin renamed to `react-native-worklets/plugin`.
- **Saved-screen tab strip stretched vertically** — fixed-height wrapper + `alignItems: 'center'`.
- **Image flash on swipe** — `keyExtractor` on pager + `recyclingKey` on expo-image.
- **Feed-switch 3-5s → 600-900ms**: short-circuit `upsertHeroImage` on cache hit, lazy color extraction via `after()`, `Promise.all` parallel summary→card. `INITIAL_BATCH` 5 → 3.

## 2026-05-17 — Phase 3 starter: For You + Streak + Settings + Marketing site ✅
- **For You:** `fetchRelatedSummaries`, `/api/cards/foryou` reading `X-Knowra-Device-Id`. Positive signals: save / go_deeper / swipe_up dwell≥5s. 3 top seeds → related → dedup → 15% exploration. Cold-start → 5 random + `x-knowra-fallback` debug header.
- **Streak:** `lib/streak.ts` — interaction-gated, local-only, dedup by calendar day. `🔥 N` pill at ≥2 days.
- **Settings + topic prefs:** 18-topic curated set, `useTopicPrefs`, `/settings` route with Topics + Streak + About sections.
- **Marketing site:** `/` landing + `/about` "How we use Wikipedia" page with attribution + 5% pledge.

## 2026-05-17 — Topic prefs wired into For You + Settings gear icon
- `getTopicPrefs()` async; mobile sends `X-Knowra-Topics` header. Backend maps topics to seed Wikipedia titles (e.g. `space → Outer space`).
- Replaced `⚙` emoji with Feather `settings` icon (cross-platform render consistency).

## 2026-05-17 — Clerk auth + push scaffolding + Cloudflare Images ✅ (scaffolded, dormant)
- **Clerk:** `@clerk/clerk-expo` + `@clerk/nextjs` installed. Mobile `_layout.tsx` ClerkProvider gated on env. `/sign-in` route with Apple + Google `useOAuth`. Settings `AccountSection`.
- **Push:** `expo-notifications`, `devices.expo_push_token` + `push_opted_in_at` columns (migration `0003_spooky_carmella_unuscione.sql`). `registerForPushNotifications()`. `POST /api/devices/push-token`. Trigger NOT wired (per spec).
- **CF Images + blurhash:** `cloudflareImages.ts` (REST upload by URL), `extractImageMetadata` returning dominant color AND blurhash from one image fetch. `scheduleImageEnrichment` parallelizes CF upload + extract.

## 2026-05-17 — Card layout v2 + Tier 1 polish batch ✅
- **Card v2 (cinematic):** hero fills top 62%, dark gradient bottom, right-edge action stack (Save/Share/Open), "W · Wikipedia" badge top-left.
- **Trending tab** via `fetchMostReadSummaries`, `/api/cards/trending`, `feedType: 'trending'` pill.
- **LLM hooks live** — tightened prompt with two few-shot examples.
- **Onboarding swipe hint** — pulsing chevron, dismisses on first commit.
- **Pull-to-refresh on /saved** with `RefreshControl`.
- **Search saved articles** — debounced 150ms.
- **Empty-state polish** (3 variants).
- **Streak milestones** — animated modal at 3/7/30/100 days.

## 2026-05-17 — Bug fixes + Tier 2 first slice ✅
- **Trending loop fix** — pull full pool (yesterday + day-before), filter by device's last 200 impressions, fallback if filtered empty.
- **Pull-to-refresh now does something** — `reloadFromDisk()` nullifies cache, re-reads SecureStore, 700ms min spinner.
- **In-app reader (Tier 2 #9)** — `react-native-webview` ArticleReader modal with reading-mode CSS injection. Go Deeper opens reader sheet instead of browser. Loading overlay over Wikipedia's white flash.
- **Skip-back undo (Tier 2 #10)** — `SkipUndoToast` slides in on quick_skip, 4s auto-dismiss, Undo calls `goBack`.

## 2026-05-17 — Bucket B product wins (B1+B2+B3+B4) ✅
- **B1 "More like this"** — `/api/cards/related/[wikiId]`, `insertAfterCurrent(cards)`, reader CTA, global toast bus.
- **B3 Category extraction** — `lib/classify.ts` maps `description` field to topic strings. `articles.categories` populated. CardView renders chips.
- **B4 Jump-to-article search** — `searchWikipedia`, `/api/search`, full-screen search modal with debounced TextInput.
- **B2 Parallax on swipe** — `PagerContext` shared value, CardView counter-translates hero by 20%.

## 2026-05-17 — Phase 2 deploy + App Store / Play Console submission ✅
*(This entry consolidates a long debugging session — see git history for the granular fixes.)*

- **VPS deploy live** at `https://knowra.space` behind nginx + certbot. Caddy abandoned mid-session (port 443 conflict with existing nginx vhosts). systemd `knowra-web.service` on port 3033 (3000/3001 taken). `/opt/knowra` owned by `knowra` user. Health endpoint green.
- **Daily-digest cron** wired via systemd timer (`knowra-digest-cron.timer` at 13:30 UTC). `lib/digest.ts`, `lib/expoPush.ts`, `/api/cron/daily-digest` gated on `CRON_SECRET`.
- **Upstash Redis caching** — `lib/cache.ts` `getOrSet` read-through, wraps Wikipedia most-read / on-this-day / search calls. Fail-open on Redis errors.
- **iOS 1.0.0 uploaded to App Store Connect** — Apple Team `A23ZGW4Y37`, ASC App ID `6770208055`, bundle `space.knowra.app`. Submitted for App Store Review.
- **Android 1.0.0 (versionCode 3) uploaded to Play Console Internal**. Personal account → 20 testers / 14 days required for Closed → Production promotion.
- **Fabric crashes resolved**: `java.lang.String → Double` cast error traced to iOS-only `decelerationRate="normal"` prop on Android WebView. Multiple rounds of percentage-string elimination on `expo-image`/`expo-linear-gradient`/`AnimatedView` to satisfy New Arch strict typing. Final fix: `onLayout` for absolute pixel sizing in CardView/CardSkeleton/VerticalPager.
- **Tablet responsiveness** — replaced `useWindowDimensions` with `onLayout` measurement.
- **In-app reader** for search + saved (replaced `Linking.openURL` paths).
- **Saved-screen bookmark icon** — Feather → Ionicons filled bookmark.
- **App icon** fixed (was rendering white) — 250×250 + alpha was rejected; regenerated 1024×1024 opaque + declared `expo.icon` / `ios.icon` / `android.adaptiveIcon.foregroundImage` in app.json.
- **Trending dedup** — server-side join on events→articles for wiki_id + Fisher-Yates shuffle. Client-side refill also dedups by articleId.
- **App icon + adaptive-icon + Play feature graphic** generated via `scripts/generate-app-icons.mjs` + `scripts/generate-feature-graphic.mjs`. Screenshots flattened (alpha rejected by ASC) via `scripts/flatten-screenshots.mjs`.
- **Web SEO complete** — favicon, OG image, Twitter card, robots.ts, sitemap.ts, /privacy, /terms. Generated via `scripts/generate-web-assets.mjs`.
- **Donation nudge (`02-product-spec.md §4.11`)** — `DonationNudge.tsx`, heterogeneous `FeedItem` union (`card | nudge`), `nudgeCounter.ts` every ~50 impressions, `injectNudgeAfterCurrent`.
- **Local feed cache** — `feedCache.ts`, cache-first paint with background refresh + dedup'd merge.
- **Push opt-in earned** — gated on `streak.count >= 3`, single SecureStore flag (`knowra.push_prompted`).
- **Daily-digest deep link** — `routeFromNotification` parses `wikiId` from notification data, routes to `/article/[wikiId]`.
- **ArticleReader summary-vs-full toggle** — `/api/cards/[wikiId]/summary` + `lib/summary.ts` (Haiku 4.5 long-form summary), `lib/articleSummary.ts` mobile fetch, reader header tab.
- **LinkedIn + Facebook closed-beta posts drafted.**

**Security-relevant items still pending:** Clerk / Anthropic / Cloudflare / Upstash / Neon credentials were pasted in plaintext mid-session. Flagged as compromised — rotate when convenient.

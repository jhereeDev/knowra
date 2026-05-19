# CHECKPOINT.md

> A living state file. **Update at the end of every working session.** Keep it short — under ~120 lines. Older entries go to [`CHECKPOINT.history.md`](./CHECKPOINT.history.md).

---

## Current state

**Last updated:** 2026-05-20
**Updated by:** Claude (crash fix + audio narration + Clerk disable + Apple rejection batch)
**Phase:** Phase 3 — Personalization (per `06-roadmap-risks.md`)

### What exists
- **Live backend** at `https://knowra.space` (VPS, nginx + certbot + systemd, port 3033). Daily-digest cron at 13:30 UTC.
- **iOS 1.1.2 (build 10)** submitted to App Store Connect → TestFlight; Apple rejected 1.0 (3) on first review (5 issues, all metadata/Review Notes — no code blockers).
- **Android 1.0.0 (versionCode 3)** in Play Console Internal testing.
- **All 4 feeds** live: For You, Trending, Today, Random.
- **Save + Collections + Search + Streak + Settings + In-app reader + Donation nudges + Daily push digest** — shipped.
- **Onboarding calibration** with existing-user safety net (auto-marks calibrated if saved/streak > 0).
- **Quiz cards** (spaced repetition: 1/3/7/21 days, cap 3/day) from saved articles.
- **Map feed** (region-tap → Wikipedia related-pages for that place).
- **Knowverse constellation** — local star/edge graph, plain-RN-View visualization.
- **Audio narration** — OpenAI tts-1 backend with disk-cached MP3s + Range-streaming endpoint; mobile `expo-audio` singleton + bottom mini player + "Listen" button on cards. Needs `OPENAI_API_KEY` on VPS to activate; ships in build 11.

### What doesn't exist yet
- TestFlight external testers — needs Beta App Review submission (separate from App Store Review).
- Play Console Closed test → Production promotion (personal account: 20 testers / 14 days required).
- USPTO trademark filing (Class 9 + Class 41).
- Skia-based Knowverse v2 (pan/zoom + share-as-poster).
- Interactive map with pins (Phase 2; requires `react-native-maps`).
- Sentry crash reporting — repeatedly demonstrated need this session.

## Decisions locked in

- **Native iOS + Android** via React Native + Expo. New Architecture enabled.
- **Backend** Next.js 15 on VPS (not Vercel — see `deploy/README.md`).
- **Monetization**: affiliate + sponsored cards + B2B/EdTech. No subscriptions / IAP. 5% to Wikimedia.
- **Auth**: Clerk OAuth (Apple + Google) — **currently FORCE-DISABLED** via `CLERK_FORCE_DISABLE` in `_layout.tsx`. Re-enable steps documented inline; requires Clerk Dashboard config (Native API on, OAuth providers wired) before flipping.
- **Sync model**: last-write-wins, push-only on first sign-in. Endpoints live but unreachable while auth is off.
- **Quiz cards**: source = saved articles only. Schedule = 1d/3d/7d/21d. Cap = 3/day.
- **Knowverse**: top-level icon in feed header. v1 = plain Views, v2 = Skia.
- **Map feed**: region-tap via Wikipedia related-pages seeded by place name.
- **Audio narration**: OpenAI tts-1, disk-cached at `/var/lib/knowra/audio/`. One singleton player at a time. Background-audio enabled.
- **No tracking for ads.** No ATT prompt. Brand promise.

## Open questions (need a call before they block work)

1. **App Store rejection — 5 items** all metadata/Review Notes (none code-blockers). Founder action: see "Rejection items pending" below.
2. **Clerk re-enable**: when ready, requires Clerk Dashboard Native API toggle + Apple/Google OAuth provider wiring, then flip `CLERK_FORCE_DISABLE` to `false`.
3. **Secret rotation** — Clerk / Anthropic / Cloudflare / Upstash / Neon credentials exposed mid-session prior. Rotate when convenient.
4. **Knowverse v2 (Skia)** — ship after audio validates in production?

## Rejection items pending (founder action in App Store Connect)

| Apple guideline | Action | Where |
|---|---|---|
| 4.1(c) — Wikipedia in subtitle | Replace subtitle (e.g. "Curiosity, beautifully") | ASC → App Information → Subtitle |
| 5.1.2(i) — ATT/tracking mismatch | Flip tracking flags to No across all data types | ASC → App Privacy |
| 2.3.6 — Age Rating "In-App Controls" | Set Age Assurance + Parental Controls to None | ASC → Age Rating |
| 4.2.2 — Minimum functionality | Paste native-features list as Review Notes | ASC → App Review Information |
| 5.2.1 — FIFA content | Reply: "Wikipedia content under CC BY-SA, no claim to FIFA marks." | ASC → reply to rejection |

## Recommended next move

1. **Verify 1.1.2 (10) boots clean in TestFlight.** Crash fix = Clerk hardcoded-off. If still crashes, the failure isn't auth-related and we bisect new code (most likely the onboarding redirect or quiz module).
2. **Address the 5 ASC rejection items** (15 min total in the web UI).
3. **Ship audio narration** — bump version → build 11 → submit. Needs `OPENAI_API_KEY` on VPS + `sudo mkdir -p /var/lib/knowra/audio && sudo chown knowra:knowra /var/lib/knowra/audio` first.
4. **Wrapped-style monthly recap** — natural pairing with Knowverse for share-out posters.
5. **Sentry** — required before any more big drops. The cycle of crash → guess → rebuild → guess is unsustainable.

## Active branches & PRs

_(All work on `main`. No open PRs.)_

## Session log

### 2026-05-17 — Phase 2 deploy + App Store / Play Console submission ✅
*(Detailed entry archived in `CHECKPOINT.history.md`.)*

### 2026-05-18 — Auth + onboarding + quiz + map + Knowverse batch ✅
*(Detailed entry archived in `CHECKPOINT.history.md`.)*

### 2026-05-19 / 05-20 — Crash recovery + audio narration ✅
Long debugging session. Build 7 (1.1.0) crashed at launch in TestFlight; iterated three builds to ship a clean one.

- **Crash root-caused**: `_layout.tsx` had a top-level `import { ClerkProvider } from '@clerk/clerk-expo'`. Even with the env-key gate around the JSX, the module body of `@clerk/clerk-expo` executed at startup, transitively loading `expo-auth-session → ExpoCryptoAES`. expo-updates' `ErrorRecovery.crash()` fired when JS startup failed repeatedly. **Build 7**: hit the import-time crash. **Build 8** (1.1.1 + lazy-require fix): still crashed — failure had moved to render-time as `ClerkProvider` tried to init against an unconfigured Clerk Dashboard. **Build 9 → 10** (1.1.2 + `CLERK_FORCE_DISABLE = true`): submitted to TestFlight; pending verification.
- **Lazy-require pattern**: refactored `_layout.tsx` to call `require('@clerk/clerk-expo')` inside `wrapWithClerk()`. Extracted Clerk-using `AccountSection` to its own file at `apps/mobile/src/components/AccountSection.tsx`, lazy-required from `settings.tsx`. Same pattern for any future Native API-dependent module.
- **Existing-user safety net** in `index.tsx`: users with saves/streak auto-mark calibrated so they don't get bounced into the new onboarding flow.
- **Audio narration shipped to codebase** (will land in build 11):
  - `packages/shared/src/audio.ts` — `generateAudioResponseSchema`
  - `apps/web/src/lib/tts.ts` — OpenAI tts-1, sha256+wikiId-keyed disk cache, ~$0.0075/article
  - `apps/web/src/app/api/audio/[wikiId]/route.ts` (POST: generate) + `apps/web/src/app/api/audio/file/[wikiId]/route.ts` (GET: Range-streaming MP3)
  - `apps/mobile/src/lib/audio.ts` — singleton player via `expo-audio` `createAudioPlayer`, `useAudioState` hook, background-audio mode
  - `apps/mobile/src/components/MiniAudioPlayer.tsx` — bottom overlay with title/play-pause/stop/progress
  - `CardView`: new `ListenButton` between Share and Open in the right-edge action stack
  - `app.json`: `UIBackgroundModes: ['audio']`, `expo-audio` plugin
- **Apple Review rejection received** for 1.0 (3): 5 items (4.1c Wikipedia subtitle, 5.1.2i tracking mismatch, 2.3.6 age rating in-app controls, 4.2.2 minimum functionality, 5.2.1 FIFA). All metadata/Review Notes — no code blockers. Drafts of each ASC response in the session transcript.
- **Verified**: typecheck clean across all 4 workspaces. `pnpm install` resolved expo-audio cleanly despite pre-existing React 19 peer warnings.

---

*Older entries archived to [`CHECKPOINT.history.md`](./CHECKPOINT.history.md).*

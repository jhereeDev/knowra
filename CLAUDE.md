# CLAUDE.md — Instructions for Claude Code working on Knowra

> Read this file at the start of every session. It captures the project's shape, the conventions to follow, and the things to avoid. When in doubt, prefer this file over your priors.

---

## 1. What we're building

**Knowra** is a native iOS + Android app that gives users the TikTok scroll loop — but every swipe surfaces a beautifully presented Wikipedia article. Same dopamine mechanic as short-form video, redirected toward knowledge.

Tagline: **expand your Knowra.** Visual identity leans into a *space* metaphor — deep-space palettes, constellations, a "knowverse" of articles orbiting your curiosity. Domain: `knowra.space`.

Full product context lives in this folder. The single most important docs to read are:

| Doc | Why you'd read it |
|---|---|
| [`00-README.md`](./00-README.md) | Index + 30-second pitch. |
| [`02-product-spec.md`](./02-product-spec.md) | What the product *is* — features, flows, anti-patterns. **Read this if writing UI.** |
| [`03-technical-architecture.md`](./03-technical-architecture.md) | Stack, services, build pipeline. **Read this if writing code.** |
| [`04-data-algorithm.md`](./04-data-algorithm.md) | DB schema, feed algorithms. **Read this if touching data or feed logic.** |
| [`CHECKPOINT.md`](./CHECKPOINT.md) | Where we are right now. **Always read at start of session.** |
| [`SETUP.md`](./SETUP.md) | Environment + commands. |

The other docs (vision, monetization, roadmap) are context. Read when relevant to the task.

## 2. Stack at a glance

**Mobile clients** (the product):
- React Native 0.76+ with the New Architecture enabled
- Expo SDK 52+ (managed workflow)
- TypeScript (strict mode)
- Expo Router v4 for navigation
- NativeWind (Tailwind) for styling
- Reanimated 3 + Gesture Handler 2 for animations & swipes
- Skia for custom drawing (Rabbit Hole graph)
- MMKV for fast persistent storage
- Expo SQLite for relational offline data
- Zustand for in-memory state
- TanStack Query for server state
- expo-image for image rendering & caching
- Expo Notifications for push

**Backend** (Vercel-hosted):
- Next.js 15 (App Router)
- TypeScript
- Route Handlers as the API
- Auth.js (magic link only at MVP)
- Drizzle ORM
- Neon Postgres (with pgvector extension)
- Upstash Redis
- Cloudflare Images for hero images
- Resend for transactional email
- Inngest for background jobs

**Marketing site** — also Next.js, separate app in the monorepo.

**Recommendation service** (only built once we hit ~10k DAU):
- Python 3.12 + FastAPI
- Hosted on Fly.io

## 3. Repo layout (expected)

```
knowra/
├─ apps/
│  ├─ mobile/              # Expo / React Native app
│  ├─ web/                 # Marketing site + /article/[slug] SEO
│  └─ api/                 # Next.js API routes (might live inside web/)
├─ packages/
│  ├─ shared/              # Types, zod schemas, constants shared between apps
│  ├─ db/                  # Drizzle schema + migrations
│  └─ ui/                  # Shared design tokens (if/when needed)
├─ scripts/                # One-off scripts: ingest, batch LLM hooks, etc.
├─ .github/workflows/      # CI
├─ docs/                   # This folder symlinked or duplicated
├─ CLAUDE.md               # This file
├─ CHECKPOINT.md           # Session state
└─ SETUP.md                # Setup instructions
```

We use **pnpm workspaces** + **Turborepo**. Don't introduce yarn or npm.

## 4. Code conventions

### TypeScript
- `"strict": true`. Always.
- No `any`. Use `unknown` and narrow.
- Prefer `type` over `interface` except when extending external types.
- Use `zod` for any data crossing a boundary (API, env vars, persisted storage).

### React / React Native
- Function components only. No class components.
- Hooks at the top, JSX at the bottom. No early returns *before* hooks.
- Memoize expensive children with `memo` only after measuring — premature memoization adds noise.
- Reanimated worklets must be self-contained — don't capture refs across the worklet boundary.

### Styling
- NativeWind classnames. Compose them; don't write inline styles unless platform-specific.
- Use the design tokens in `packages/ui` (once created) — no hex codes in components.
- Honor `prefers-reduced-motion` everywhere we animate.

### File naming
- Components: `PascalCase.tsx` (e.g. `CardStack.tsx`).
- Hooks: `useCamelCase.ts`.
- Utils & non-React: `kebab-case.ts`.
- Tests: `*.test.ts(x)` colocated with source.

### State management
- Local UI state → `useState`.
- Cross-component, in-memory → `Zustand`.
- Server state (anything fetched) → TanStack Query. **Never** stash server data in Zustand.
- Persisted preferences → MMKV via a typed wrapper.

### API contracts
- Every API response is validated through a `zod` schema that's *shared* between client and server (via `packages/shared`).
- Errors: return `{ error: { code, message } }` shape. Never throw across the wire.

### Database
- Drizzle for schema + migrations. Migrations are checked in.
- Never `DROP` or `ALTER` in a way that's not backward-compatible. Always migrate forward in two steps if needed.
- `id` columns are `bigserial` for content tables, `uuid` for user-scoped tables (rationale: predictable ordering for content, unguessable IDs for user data).

### Testing
- Vitest for unit tests.
- Playwright for marketing-site e2e.
- Maestro for mobile e2e (later phase — not in MVP).
- Don't ship a recommendation-service change without a replay test on held-out data.

### Errors & logging
- All errors flow through Sentry (frontend + backend).
- Use structured logs server-side: `log.info({ user_id, event: 'x' }, 'human msg')`.
- Never `console.log` in production code. Use a logger.

## 5. Anti-patterns — things to never do

- **Never break the swipe.** Anything that risks dropping a frame on the feed is a non-starter. If it's expensive, push it to a worklet, web worker, or background queue.
- **Never add a paywall, subscription, or in-app purchase.** Monetization is affiliate + sponsored + B2B only. See `05-monetization.md`.
- **Never use localStorage / AsyncStorage for anything performance-sensitive.** MMKV is mandatory.
- **Never ask for permissions on first launch.** Push, location (we don't use it), tracking — all earned, not requested.
- **Never display Wikipedia content without attribution.** Attribution + license shown on every Go-deeper view, and on the marketing site article pages.
- **Never fall through to an `any` type to "make TypeScript happy."** Type properly or use `zod` to narrow.
- **Never write Wikipedia API calls without `User-Agent` set** to our contact email. Wikimedia rate-limits anonymous traffic aggressively and we want to be a good citizen.
- **Never commit secrets.** `.env.local` is `.gitignore`'d. CI uses Vercel/EAS env vars.
- **Never run `expo prebuild` casually.** It commits us to bare workflow. Stay managed unless absolutely required.
- **Never ship an OTA update via EAS Update that materially changes app functionality.** Apple's policy. UI tweaks, copy fixes, A/B variants are fine. New features go through review.
- **Never store IDFA or anything that triggers App Tracking Transparency.** We don't track for ads. Brand promise.

## 6. Commands you'll use often

(See `SETUP.md` for the canonical list with explanations.)

```bash
pnpm i                       # Install everything
pnpm dev                     # Dev: web + api in parallel
pnpm dev:mobile              # Dev: Expo
pnpm db:push                 # Drizzle: push schema to dev DB
pnpm db:generate             # Drizzle: generate migration
pnpm test                    # Run all unit tests
pnpm lint                    # ESLint across the monorepo
pnpm typecheck               # tsc --noEmit across the monorepo
pnpm build:mobile:preview    # EAS Build: preview profile
pnpm submit:ios              # EAS Submit to TestFlight
```

## 7. How to work in this codebase

**Start of session.** Read `CHECKPOINT.md`. It tells you the current state, last commit context, and the recommended next move.

**Working on a task.**
1. Search the relevant doc(s) before writing code.
2. If the task touches the feed UX, re-read `02-product-spec.md §3.4` (gestures) and the design tenets in §1.
3. If the task touches data, check `04-data-algorithm.md` for the schema.
4. Run `pnpm typecheck` + `pnpm test` before declaring done.
5. Update `CHECKPOINT.md` with what changed and the next obvious next step.

**Uncertainty.** If a decision isn't covered in the docs and isn't trivial, *stop and ask* rather than guessing. We have strong opinions captured in the docs; new ones should be deliberate.

**Don't introduce libraries** without checking the doc-listed stack. We've already chosen Zustand, TanStack Query, MMKV, etc. If you think one of them is wrong, raise it — don't silently swap.

## 8. Memory across sessions

- Architectural and product decisions live in this `/docs` folder. Update the relevant doc when a decision is made.
- Session-to-session state lives in `CHECKPOINT.md`. Keep it short and accurate.
- One-off scratch notes can live in `/scratch/*.md` (gitignored) if useful.

## 9. Mindset

This is a focused, opinionated product. **Defaults matter more than features.** A feature that ships well-defaulted with great copy beats five features that ship with knobs. When in doubt, do less, but do it sharper.

The product principles, in order of importance:
1. The feed comes first.
2. Smart, never smug.
3. Beauty is a feature.
4. Respect the source (Wikipedia).
5. No dark patterns.

Every PR should be checkable against these.

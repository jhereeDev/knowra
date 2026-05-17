# SETUP.md — Getting Knowra running locally

Everything you need to go from a fresh machine to a running dev environment. Pair with `CLAUDE.md` for code conventions and `CHECKPOINT.md` for current state.

---

## 1. Prerequisites

You need the following installed. Versions are minimums; newer is fine.

| Tool | Version | Why | Install |
|---|---|---|---|
| Node.js | 20 LTS+ | Runtime for everything JS/TS | [nvm](https://github.com/nvm-sh/nvm) or [Volta](https://volta.sh) |
| pnpm | 9+ | Package manager (we don't use npm/yarn) | `npm i -g pnpm` |
| Git | any modern | Version control | system |
| Xcode | 15+ (macOS only) | iOS builds, Simulator | App Store |
| Android Studio | latest stable | Android Emulator | [developer.android.com](https://developer.android.com/studio) |
| Watchman | latest | File watcher, helps Metro | `brew install watchman` |
| Java JDK | 17 | Required for Android builds | `brew install --cask zulu17` |
| EAS CLI | latest | Expo cloud builds + submits | `pnpm add -g eas-cli` |
| Expo Go (phone) | latest | Quick on-device testing | iOS App Store / Play Store |
| Vercel CLI | latest | Deploys, env var sync | `pnpm add -g vercel` |
| Drizzle Kit | (project dep) | DB migrations | installed via pnpm |

Windows note: native iOS development needs a Mac (Xcode is Apple-only). Android development works fine on Windows; for iOS we recommend EAS Build (cloud) + a borrowed Mac for one-off device testing.

## 2. Accounts you'll need

Most have free tiers that cover early development.

- **Apple Developer Program** — $99/yr. Required for TestFlight + App Store. Enroll early; approval can take 1–2 weeks.
- **Google Play Console** — $25 one-time. For Play Store + Internal Testing.
- **Expo account** — free; needed for EAS Build/Submit/Update.
- **Vercel** — free hobby tier covers dev. Pro tier ($20/mo) when shipping for real.
- **Neon** — free tier covers dev DB. Pro when production.
- **Upstash** — pay-per-request Redis. ~$0 in dev.
- **Cloudflare** — free DNS + free Cloudflare Images tier (small).
- **Sentry** — free up to 5k events/mo.
- **PostHog** — free up to 1M events/mo.
- **Resend** — free 100 emails/day.
- **OpenAI or Anthropic** — for hook + summary generation. ~$10/mo in dev.

Optional but useful: **1Password** or **Doppler** for shared team secrets.

## 3. Cloning & first install

```bash
# Clone
git clone git@github.com:<org>/knowra.git
cd knowra

# Install everything (uses pnpm workspaces)
pnpm i

# Copy env templates
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local

# Fill in env vars (see §5 below)
```

The repo is a Turborepo monorepo. `pnpm i` at the root installs everything.

## 4. Database setup

```bash
# Create a Neon project: https://console.neon.tech
# Get the connection string; paste into apps/web/.env.local as DATABASE_URL

# Push the current schema to your dev DB
pnpm --filter db db:push

# Or, if you've added migrations:
pnpm --filter db db:migrate

# Open Drizzle Studio to browse the DB
pnpm --filter db db:studio
```

Important: enable the `pgvector` extension on the Neon project before first push.

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## 5. Environment variables

`apps/web/.env.local`:

```bash
# Database
DATABASE_URL=postgres://...neon.tech/knowra?sslmode=require

# Redis
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Auth
AUTH_SECRET=<run: openssl rand -base64 32>
AUTH_URL=http://localhost:3000

# Email (magic links)
RESEND_API_KEY=re_...
EMAIL_FROM="Knowra <hello@knowra.space>"

# Wikipedia (mandatory — they rate-limit anonymous)
WIKIPEDIA_USER_AGENT="Knowra/0.1 (contact: dev@knowra.space)"

# Cloudflare Images
CF_IMAGES_ACCOUNT_ID=...
CF_IMAGES_API_TOKEN=...

# LLM (hooks + summaries)
ANTHROPIC_API_KEY=sk-ant-...
# or
OPENAI_API_KEY=sk-...

# Observability
SENTRY_DSN=...
POSTHOG_API_KEY=...
```

`apps/mobile/.env.local`:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_POSTHOG_API_KEY=...
EXPO_PUBLIC_SENTRY_DSN=...
```

> Note the `EXPO_PUBLIC_` prefix. Anything without it is *not* bundled into the mobile app.

## 6. Running things

### Web + API (dev)

```bash
pnpm dev:web
# → http://localhost:3000
```

### Mobile (Expo dev client)

```bash
pnpm dev:mobile
# Scan the QR code with Expo Go (iOS or Android), or press:
#   i → open iOS Simulator
#   a → open Android Emulator
```

If you need a custom dev client (e.g., adding a native module Expo Go doesn't include):

```bash
pnpm --filter mobile expo prebuild --no-install
pnpm --filter mobile ios     # or: android
```

### Everything in parallel

```bash
pnpm dev
# Turborepo runs every workspace's `dev` script. Use a TTY that handles multi-pane output.
```

## 7. Common dev tasks

```bash
# Typecheck the whole monorepo
pnpm typecheck

# Lint
pnpm lint

# Run unit tests
pnpm test

# Generate a new Drizzle migration after editing schema
pnpm --filter db db:generate

# Push migration to dev DB
pnpm --filter db db:migrate
```

## 8. Building & shipping (EAS)

### First-time EAS setup

```bash
pnpm add -g eas-cli
eas login                                  # Expo account
eas build:configure                        # only first time, generates eas.json
```

### Preview build (for TestFlight Internal / Play Internal)

```bash
pnpm build:mobile:preview
# Builds both iOS + Android in the cloud, ~15-25 min each
```

### Submit to stores

```bash
eas submit -p ios --profile preview        # → TestFlight
eas submit -p android --profile preview    # → Play Internal Testing
```

### Production build

```bash
pnpm build:mobile:production
eas submit -p ios --profile production
eas submit -p android --profile production
```

### OTA update (JS-only changes — no review needed)

```bash
eas update --branch production --message "Tweak copy on Go-deeper tray"
```

Reminder: only ship UI/copy tweaks and A/B variants OTA. Anything functional goes through review. Apple policy.

## 9. Useful debugging commands

```bash
# Clear Metro cache (when things get weird)
pnpm --filter mobile expo start --clear

# Clear pnpm + Turbo caches
rm -rf node_modules .turbo
pnpm i

# Inspect a build's logs
eas build:list
eas build:view <build-id>

# Check Wikipedia API rate-limit status (won't actually 429 in dev, but useful)
curl -A "$WIKIPEDIA_USER_AGENT" -I https://en.wikipedia.org/api/rest_v1/page/random/summary

# Open the Neon dev DB in Drizzle Studio
pnpm --filter db db:studio
```

## 10. Working with the AI tooling

Hooks and summaries are batch-generated by a script:

```bash
# Backfill hooks for the next 100 unprocessed articles
pnpm --filter scripts run hooks -- --limit 100

# Re-run for a specific article (e.g., quality fix)
pnpm --filter scripts run hooks -- --article-id 12345 --force
```

Embeddings for ranking:

```bash
pnpm --filter scripts run embed -- --limit 1000
```

These scripts also run on Inngest in production — see `apps/web/src/inngest/`.

## 11. If something is broken

In order:

1. **Re-read `CHECKPOINT.md`** — is the failure on an already-known issue?
2. **`pnpm typecheck`** — type errors are often the real cause.
3. **Clear caches:** Metro (`--clear`), Turbo (`rm -rf .turbo`), pnpm (`rm -rf node_modules`).
4. **Check env vars** — missing or stale env is the #1 dev-time bug.
5. **Sentry** — local Sentry catches even dev errors if `SENTRY_DSN` is set.
6. **Open an issue / ask** — easier than guessing.

## 12. House rules (mostly mirrored from CLAUDE.md)

- Never `npm install` or `yarn add`. pnpm only.
- Never commit `.env.local`. Always update `.env.example` when adding new vars.
- Never push to `main` directly. PR + checks pass.
- Never run an unverified migration against production. Always preview on a Neon branch first.
- Never commit Wikipedia article *content* into the repo. It's all fetched + cached at runtime.
- Never disable a failing test "for now." Fix it or delete it.

---

*See `CLAUDE.md` for code conventions and `CHECKPOINT.md` for current development state.*

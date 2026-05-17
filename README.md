# Knowra

> The curiosity feed. TikTok mechanic, Wikipedia content. *Expand your Knowra.*

Native iOS + Android app (React Native + Expo) with a Next.js backend and marketing site.

See [`00-README.md`](./00-README.md) for full documentation, [`CLAUDE.md`](./CLAUDE.md) for working conventions, and [`SETUP.md`](./SETUP.md) for environment setup.

## Quick start

```bash
pnpm install
pnpm dev:web      # Next.js + API at http://localhost:3000
pnpm dev:mobile   # Expo dev server
```

## Layout

```
knowra/
├─ apps/
│  ├─ web/        # Next.js 15 — marketing + API
│  └─ mobile/     # Expo SDK 55+ — the product
├─ packages/
│  ├─ db/         # Drizzle schema + migrations
│  └─ shared/     # zod schemas + types shared across web/mobile
└─ docs/          # Living documentation
```

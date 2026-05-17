# @knowra/db

Drizzle schema and migrations for Knowra. Targets Postgres (Neon in production) with the `pgvector` and `citext` extensions enabled.

## First-time setup

```bash
# In your Neon SQL editor (or psql):
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS citext;

# Then, from the repo root:
cp packages/db/.env.example packages/db/.env
# Fill in DATABASE_URL

pnpm db:generate   # create migration files from src/schema.ts
pnpm db:migrate    # apply migrations to the DB
pnpm db:studio     # open Drizzle Studio in the browser
```

`pnpm db:push` is a faster dev-only path that syncs schema directly without producing migration files — use `db:generate` + `db:migrate` for anything you intend to ship.

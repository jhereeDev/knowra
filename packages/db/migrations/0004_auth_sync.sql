-- Clerk auth + sync state.
-- 1. Add clerk_user_id (unique) so we can map a signed-in OAuth user to
--    the canonical users row. Backfill is unnecessary — existing rows
--    pre-date Clerk and stay null until linked.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clerk_user_id" text;
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Streak state. Source-of-truth lives on the device; these columns
--    only hold the most recent push so a new device can restore.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "streak_count" integer DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "streak_last_day" text;

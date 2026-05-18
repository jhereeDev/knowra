import { auth, clerkClient } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDb, users } from '@knowra/db';

// Returns the canonical users row for the currently-signed-in Clerk
// user, creating it on first call. Returns null when:
//   - Clerk isn't configured (no env keys)
//   - the request isn't authenticated
//
// The mapping is keyed by `clerk_user_id`. We backfill `email` and
// `name` from Clerk on creation so the row is usable without another
// round-trip to Clerk.
export async function getOrCreateUser(): Promise<{
  id: string;
  clerkUserId: string;
} | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const db = getDb();
  const existing = await db
    .select({ id: users.id, clerkUserId: users.clerkUserId })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  const first = existing[0];
  if (first?.id && first.clerkUserId) {
    return { id: first.id, clerkUserId: first.clerkUserId };
  }

  // First sight of this Clerk user → create the row. Pull email + name
  // for a friendlier presentation in any future admin UI. Failures here
  // are tolerated — we'd rather create an email-less row than refuse
  // sign-in.
  let email: string | null = null;
  let name: string | null = null;
  try {
    const client = await clerkClient();
    const u = await client.users.getUser(clerkUserId);
    email = u.primaryEmailAddress?.emailAddress ?? null;
    name = [u.firstName, u.lastName].filter(Boolean).join(' ') || null;
  } catch {
    /* tolerate — clerkClient can be rate-limited */
  }

  const inserted = await db
    .insert(users)
    .values({ clerkUserId, email, name })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      // No-op update so we still get the row back via .returning().
      set: { clerkUserId },
    })
    .returning({ id: users.id, clerkUserId: users.clerkUserId });
  const row = inserted[0];
  if (!row?.id || !row.clerkUserId) return null;
  return { id: row.id, clerkUserId: row.clerkUserId };
}

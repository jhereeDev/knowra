import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { syncPushBodySchema, syncPushResponseSchema } from '@knowra/shared';
import { collectionItems, collections, getDb, users } from '@knowra/db';
import { getOrCreateUser } from '@/lib/clerkUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/sync/push — uplift local device state into the user's
// cloud account. Replaces the user's cloud collections + streak +
// topic prefs with the supplied payload. The model is intentionally
// last-write-wins: device-side state is canonical between syncs, and
// each sync overwrites the prior cloud snapshot.
//
// Saved entries (the flat list) are *implicit* — collection_items
// rows under any of the user's collections are "saved." We also write
// a special $ALL collection (server-generated) holding every saved
// articleId, so the flat list survives the round trip.
//
// Auth required. Returns 401 if no Clerk session.
export async function POST(req: Request): Promise<Response> {
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'sign in required' } },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'bad_request', message: 'invalid JSON' } },
      { status: 400 },
    );
  }

  const parsed = syncPushBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'bad_request', message: parsed.error.message } },
      { status: 400 },
    );
  }
  const payload = parsed.data;

  const db = getDb();

  // 1. Streak + topic prefs land on the users row.
  await db
    .update(users)
    .set({
      ...(payload.streak !== undefined
        ? {
            streakCount: payload.streak.count,
            streakLastDay: payload.streak.lastDay || null,
          }
        : {}),
      ...(payload.topicPrefs !== undefined ? { topicPrefs: payload.topicPrefs } : {}),
    })
    .where(sql`${users.id} = ${user.id}`);

  // 2. Wipe + re-insert collections. We use a deterministic naming
  //    convention: the $ALL collection (name='__all_saved__') is the
  //    saved-list home; user-named collections come second.
  await db.execute(
    sql`DELETE FROM ${collectionItems}
        WHERE ${collectionItems.collectionId} IN
          (SELECT id FROM ${collections} WHERE ${collections.userId} = ${user.id})`,
  );
  await db.execute(
    sql`DELETE FROM ${collections} WHERE ${collections.userId} = ${user.id}`,
  );

  // Sanitize article ids — must parse as a positive integer. Anything
  // else (stale local rows, malformed input) is dropped silently.
  const cleanArticleIds = (ids: string[]): bigint[] => {
    const out: bigint[] = [];
    for (const raw of ids) {
      try {
        const n = BigInt(raw);
        if (n > 0n) out.push(n);
      } catch {
        /* skip non-numeric */
      }
    }
    return out;
  };

  // 2a. The flat saved list lives in a synthetic __all_saved__ collection.
  //     Its id is supplied by the server; users never see it directly.
  const allSavedIds = cleanArticleIds(payload.entries.map((e) => e.card.articleId));
  let allSavedCollectionId: string | null = null;
  if (allSavedIds.length > 0) {
    const inserted = await db
      .insert(collections)
      .values({ userId: user.id, name: '__all_saved__' })
      .returning({ id: collections.id });
    allSavedCollectionId = inserted[0]?.id ?? null;
  }

  // 2b. User-named collections, preserving the client's UUID + name.
  //     We accept whatever id the client provides; uniqueness across
  //     users is preserved by the (user_id, id) tuple at usage time.
  const userCollections = payload.collections.filter((c) => c.name !== '__all_saved__');
  if (userCollections.length > 0) {
    await db.insert(collections).values(
      userCollections.map((c) => ({
        id: c.id,
        userId: user.id,
        name: c.name,
        createdAt: new Date(c.createdAt),
      })),
    );
  }

  // 3. Collection items. Membership in __all_saved__ is the union of
  //    `entries.articleId`; per-collection membership comes from the
  //    client's collections.articleIds.
  const itemRows: { collectionId: string; articleId: bigint }[] = [];
  if (allSavedCollectionId) {
    for (const id of allSavedIds) {
      itemRows.push({ collectionId: allSavedCollectionId, articleId: id });
    }
  }
  for (const c of userCollections) {
    for (const id of cleanArticleIds(c.articleIds)) {
      itemRows.push({ collectionId: c.id, articleId: id });
    }
  }

  if (itemRows.length > 0) {
    // Some article ids may not exist server-side (stale snapshots from
    // a wiped dev DB, etc.). We attempt the insert in a single batch
    // and let pg's FK enforcement reject orphans — but to keep one bad
    // row from killing the whole sync, we do it in chunks of 50 with
    // ON CONFLICT DO NOTHING. The (collection_id, article_id) PK on
    // collection_items absorbs duplicates cleanly.
    const CHUNK = 50;
    for (let i = 0; i < itemRows.length; i += CHUNK) {
      const slice = itemRows.slice(i, i + CHUNK);
      try {
        await db
          .insert(collectionItems)
          .values(
            slice.map((r) => ({
              collectionId: r.collectionId,
              articleId: Number(r.articleId),
            })),
          )
          .onConflictDoNothing();
      } catch {
        /* a chunk with all-orphans FK-fails as a unit; skip silently */
      }
    }
  }

  return NextResponse.json(
    syncPushResponseSchema.parse({
      ok: true,
      entriesCount: payload.entries.length,
      collectionsCount: payload.collections.length,
    }),
  );
}

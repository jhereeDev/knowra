import * as SecureStore from 'expo-secure-store';
import { syncPushBodySchema, type SyncPushBody } from '@knowra/shared';
import { listSaved } from './savedArticles';
import { getTopicPrefs } from './topicPrefs';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const FIRST_PUSH_FLAG = 'knowra.sync_first_push_done';

// Build a sync payload from the device's current local state. Streak
// is read lazily here to avoid a hard import dependency on streak.ts's
// internals — instead we re-load from SecureStore directly with the
// same key streak.ts uses.
async function buildPayload(): Promise<SyncPushBody> {
  const [savedEntries, topicPrefs, streakRaw] = await Promise.all([
    listSaved(),
    getTopicPrefs(),
    SecureStore.getItemAsync('knowra.streak'),
  ]);

  // Collections require touching the savedArticles store's collections
  // directly. We expose a lightweight read here rather than threading
  // a new export through, since this is the only consumer.
  const stateRaw = await SecureStore.getItemAsync('knowra.saved_state_v2');
  let collections: SyncPushBody['collections'] = [];
  if (stateRaw) {
    try {
      const parsed = JSON.parse(stateRaw) as {
        collections?: Array<{
          id: string;
          name: string;
          createdAt: string;
          articleIds: string[];
        }>;
      };
      collections = Array.isArray(parsed.collections)
        ? parsed.collections.map((c) => ({
            id: c.id,
            name: c.name,
            createdAt: c.createdAt,
            articleIds: c.articleIds ?? [],
          }))
        : [];
    } catch {
      /* corrupt local state — treat as empty */
    }
  }

  let streak: SyncPushBody['streak'] | undefined;
  if (streakRaw) {
    try {
      const parsed = JSON.parse(streakRaw) as { count?: number; lastDay?: string };
      if (typeof parsed.count === 'number' && typeof parsed.lastDay === 'string') {
        streak = { count: parsed.count, lastDay: parsed.lastDay };
      }
    } catch {
      /* skip */
    }
  }

  return {
    strategy: 'merge',
    entries: savedEntries,
    collections,
    streak,
    topicPrefs,
  };
}

/**
 * Push the device's current local state to the user's cloud account.
 * Authorization is the caller's responsibility — pass a Clerk session
 * token (from `session.getToken()`). Returns true on success, false on
 * any failure (network, server error, parse error). Failures are silent
 * by design: sign-in must succeed even if sync doesn't.
 */
export async function pushLocalToCloud(sessionToken: string): Promise<boolean> {
  try {
    const payload = await buildPayload();
    const validated = syncPushBodySchema.parse(payload);
    const res = await fetch(`${API_URL}/api/sync/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(validated),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Trigger the first-time sync after a successful sign-in. Idempotent:
 * once the flag is set, subsequent calls no-op. The flag survives app
 * relaunches but resets on sign-out so a sign-back-in to a different
 * account doesn't suppress the upload.
 */
export async function maybeFirstPush(sessionToken: string): Promise<void> {
  const alreadyDone = await SecureStore.getItemAsync(FIRST_PUSH_FLAG);
  if (alreadyDone) return;
  const ok = await pushLocalToCloud(sessionToken);
  if (ok) {
    await SecureStore.setItemAsync(FIRST_PUSH_FLAG, '1').catch(() => {});
  }
}

/** Clear the first-push flag — call on sign-out. */
export async function resetSyncState(): Promise<void> {
  await SecureStore.deleteItemAsync(FIRST_PUSH_FLAG).catch(() => {});
}

import { z } from 'zod';
import { cardSchema } from './card';

// Local state pushed to the cloud on sign-in. The mobile client owns the
// canonical version of "saved" + "collections" + "streak" until a user
// signs in; at that point we lift the local snapshot up to the user's
// account so the next device the user signs in on can pull it back down.
//
// Shape mirrors the in-app SecureStore models in apps/mobile/src/lib/
// (savedArticles.ts + streak.ts) so the client-side push is a straight
// serialization.

export const syncSavedEntrySchema = z.object({
  card: cardSchema,
  savedAt: z.string().datetime(),
});
export type SyncSavedEntry = z.infer<typeof syncSavedEntrySchema>;

export const syncCollectionSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  createdAt: z.string().datetime(),
  articleIds: z.array(z.string()),
});
export type SyncCollection = z.infer<typeof syncCollectionSchema>;

export const syncStreakSchema = z.object({
  count: z.number().int().nonnegative(),
  lastDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')),
});
export type SyncStreak = z.infer<typeof syncStreakSchema>;

// Body of POST /api/sync/push — the full local snapshot.
// strategy="merge" unions cloud + local (local wins on overlap),
// strategy="replace" overwrites cloud with the supplied payload.
// First sign-in uses "merge"; explicit "Restore from cloud" buttons
// (future) use "replace" the other direction.
export const syncPushBodySchema = z.object({
  strategy: z.enum(['merge', 'replace']).default('merge'),
  entries: z.array(syncSavedEntrySchema),
  collections: z.array(syncCollectionSchema),
  streak: syncStreakSchema.optional(),
  topicPrefs: z.array(z.string()).optional(),
});
export type SyncPushBody = z.infer<typeof syncPushBodySchema>;

// Response from GET /api/sync/state — the user's current cloud state.
export const syncStateResponseSchema = z.object({
  entries: z.array(syncSavedEntrySchema),
  collections: z.array(syncCollectionSchema),
  streak: syncStreakSchema,
  topicPrefs: z.array(z.string()),
});
export type SyncStateResponse = z.infer<typeof syncStateResponseSchema>;

export const syncPushResponseSchema = z.object({
  ok: z.literal(true),
  entriesCount: z.number().int().nonnegative(),
  collectionsCount: z.number().int().nonnegative(),
});
export type SyncPushResponse = z.infer<typeof syncPushResponseSchema>;

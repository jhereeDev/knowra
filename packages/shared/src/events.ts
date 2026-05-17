import { z } from 'zod';
import { EVENT_TYPES } from './constants';

export const eventTypeSchema = z.enum(EVENT_TYPES);

export const eventSchema = z.object({
  // Local DB row id of the article (bigint as string).
  articleId: z.string().regex(/^\d+$/, 'articleId must be a numeric string'),
  eventType: eventTypeSchema,
  // Time the user spent on the card before the event fired. Required for
  // swipe_up, swipe_back, quick_skip; optional for impression and go_deeper.
  dwellMs: z.number().int().nonnegative().optional(),
  // ISO-8601 timestamp captured client-side (more accurate than server-now
  // since events are batched and flushed asynchronously).
  occurredAt: z.string().datetime(),
});

export type EventInput = z.infer<typeof eventSchema>;

export const eventBatchRequestSchema = z.object({
  // UUID v4 generated client-side on first launch, persisted in SecureStore.
  deviceId: z.string().uuid(),
  events: z.array(eventSchema).min(1).max(200),
});

export type EventBatchRequest = z.infer<typeof eventBatchRequestSchema>;

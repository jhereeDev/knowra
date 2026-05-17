import type { EventInput, EventType } from '@knowra/shared';
import { getDeviceId } from './device';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const FLUSH_INTERVAL_MS = 10_000;
const FLUSH_THRESHOLD = 20;
const MAX_QUEUE = 500; // safety cap if we ever get stuck offline

const queue: EventInput[] = [];
let flushing = false;
let timer: ReturnType<typeof setInterval> | null = null;

function ensureTimer() {
  if (timer) return;
  timer = setInterval(() => {
    void flush();
  }, FLUSH_INTERVAL_MS);
}

export function track(
  articleId: string,
  eventType: EventType,
  opts: { dwellMs?: number } = {},
): void {
  ensureTimer();
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push({
    articleId,
    eventType,
    dwellMs: opts.dwellMs,
    occurredAt: new Date().toISOString(),
  });
  if (queue.length >= FLUSH_THRESHOLD) void flush();
}

export async function flush(): Promise<void> {
  if (flushing) return;
  if (queue.length === 0) return;
  flushing = true;

  const batch = queue.splice(0, queue.length);
  try {
    const deviceId = await getDeviceId();
    const res = await fetch(`${API_URL}/api/events/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, events: batch }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    // Re-queue at front so we don't lose events on a transient network failure.
    // If we keep failing, MAX_QUEUE will eventually shed the oldest.
    queue.unshift(...batch);
    if (__DEV__) {
      console.warn('[events] flush failed, re-queued', err);
    }
  } finally {
    flushing = false;
  }
}

import * as SecureStore from 'expo-secure-store';

// Persisted card-impression counter used to gate the every-N-cards
// Wikipedia donation nudge (product spec §4.11). Persists across app
// launches; resets on uninstall. No UI ever displays this number, so
// the API is intentionally minimal — just a bump + an injection signal.

const STORAGE_KEY = 'knowra.nudge_counter';
const NUDGE_EVERY = 50;

let cache: number | null = null;
let loadPromise: Promise<number> | null = null;

async function loadFromDisk(): Promise<number> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

async function ensureLoaded(): Promise<number> {
  if (cache !== null) return cache;
  loadPromise ??= loadFromDisk();
  cache = await loadPromise;
  return cache;
}

function commit(next: number): void {
  cache = next;
  void SecureStore.setItemAsync(STORAGE_KEY, String(next)).catch(() => {});
}

/**
 * Record a card impression. Returns true when the post-bump count is a
 * multiple of NUDGE_EVERY — that's the signal to inject a donation nudge
 * card into the feed buffer. Caller is responsible for the injection;
 * this function is fire-and-forget.
 */
export async function bumpImpression(): Promise<boolean> {
  const current = await ensureLoaded();
  const next = current + 1;
  commit(next);
  return next % NUDGE_EVERY === 0;
}

/**
 * Wipe the counter back to zero. Exposed for debug / "reset experience"
 * settings rather than production use. Safe to call without awaiting.
 */
export async function resetNudgeCounter(): Promise<void> {
  cache = 0;
  await SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
}

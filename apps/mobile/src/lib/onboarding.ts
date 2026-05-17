import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

// Two-state onboarding flag stored in SecureStore. Becomes `true` after
// the user's first swipe commit. Survives launches but not uninstalls.

const STORAGE_KEY = 'knowra.onboarding_swipe_seen';

let cache: boolean | null = null;
const subscribers = new Set<(seen: boolean) => void>();

async function loadFromDisk(): Promise<boolean> {
  if (cache !== null) return cache;
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  cache = raw === '1';
  return cache;
}

export async function markSwipeSeen(): Promise<void> {
  if (cache === true) return;
  cache = true;
  for (const sub of subscribers) sub(true);
  await SecureStore.setItemAsync(STORAGE_KEY, '1').catch(() => {});
}

/** Returns true once the first swipe has occurred; null while loading. */
export function useHasSeenSwipeHint(): boolean | null {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    void loadFromDisk().then((s) => {
      if (mounted) setSeen(s);
    });
    const sub = (s: boolean) => setSeen(s);
    subscribers.add(sub);
    return () => {
      mounted = false;
      subscribers.delete(sub);
    };
  }, []);
  return seen;
}

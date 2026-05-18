import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

// Two separate onboarding flags. Both survive launches but not uninstalls.
//   - swipe_seen: flips on the user's first swipe commit (used by the
//     in-feed swipe-up hint to disappear).
//   - calibrated: flips when the user finishes the 3-card topic
//     calibration on first launch (used to gate the root route).

const SWIPE_KEY = 'knowra.onboarding_swipe_seen';
const CALIBRATED_KEY = 'knowra.onboarding_calibrated';

let swipeCache: boolean | null = null;
const swipeSubs = new Set<(seen: boolean) => void>();

let calibratedCache: boolean | null = null;
const calibratedSubs = new Set<(done: boolean) => void>();

async function loadSwipeFromDisk(): Promise<boolean> {
  if (swipeCache !== null) return swipeCache;
  const raw = await SecureStore.getItemAsync(SWIPE_KEY);
  swipeCache = raw === '1';
  return swipeCache;
}

export async function markSwipeSeen(): Promise<void> {
  if (swipeCache === true) return;
  swipeCache = true;
  for (const sub of swipeSubs) sub(true);
  await SecureStore.setItemAsync(SWIPE_KEY, '1').catch(() => {});
}

/** Returns true once the first swipe has occurred; null while loading. */
export function useHasSeenSwipeHint(): boolean | null {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    void loadSwipeFromDisk().then((s) => {
      if (mounted) setSeen(s);
    });
    const sub = (s: boolean) => setSeen(s);
    swipeSubs.add(sub);
    return () => {
      mounted = false;
      swipeSubs.delete(sub);
    };
  }, []);
  return seen;
}

async function loadCalibratedFromDisk(): Promise<boolean> {
  if (calibratedCache !== null) return calibratedCache;
  const raw = await SecureStore.getItemAsync(CALIBRATED_KEY);
  calibratedCache = raw === '1';
  return calibratedCache;
}

export async function markCalibrated(): Promise<void> {
  if (calibratedCache === true) return;
  calibratedCache = true;
  for (const sub of calibratedSubs) sub(true);
  await SecureStore.setItemAsync(CALIBRATED_KEY, '1').catch(() => {});
}

/** Returns true once topic calibration has been completed; null while loading. */
export function useHasCalibrated(): boolean | null {
  const [done, setDone] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    void loadCalibratedFromDisk().then((d) => {
      if (mounted) setDone(d);
    });
    const sub = (d: boolean) => setDone(d);
    calibratedSubs.add(sub);
    return () => {
      mounted = false;
      calibratedSubs.delete(sub);
    };
  }, []);
  return done;
}

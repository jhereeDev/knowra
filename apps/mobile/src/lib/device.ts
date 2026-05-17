import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'knowra.device_id';

let cached: string | null = null;
let pending: Promise<string> | null = null;

/**
 * Returns a stable device UUID. Generates one on first call and persists
 * to the platform secure store (Keychain on iOS, EncryptedSharedPreferences
 * on Android). Subsequent calls in the same process are served from memory.
 *
 * SecureStore is used (vs MMKV) because it works in Expo Go and stays put
 * across Expo Go reinstalls within the same project scope on iOS. Will swap
 * to MMKV once we ship custom dev clients.
 */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  if (pending) return pending;

  pending = (async () => {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
    const fresh = Crypto.randomUUID();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, fresh);
    cached = fresh;
    return fresh;
  })();

  try {
    return await pending;
  } finally {
    pending = null;
  }
}

import * as SecureStore from 'expo-secure-store';

// Inline the TokenCache shape so we don't depend on Clerk's internal
// export paths (which have moved between minor versions).
export type ClerkTokenCache = {
  getToken(key: string): Promise<string | null>;
  saveToken(key: string, value: string): Promise<void>;
};

// Clerk recommends SecureStore for the session token cache on native.
// Errors are swallowed and the key is cleared so a corrupted cache forces
// a re-auth rather than locking the user out.
export const clerkTokenCache: ClerkTokenCache = {
  async getToken(key) {
    try {
      const item = await SecureStore.getItemAsync(key);
      return item;
    } catch {
      await SecureStore.deleteItemAsync(key).catch(() => {});
      return null;
    }
  },
  async saveToken(key, value) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      /* persistence is best-effort */
    }
  },
};

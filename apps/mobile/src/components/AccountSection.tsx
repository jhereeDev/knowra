import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { resetSyncState } from '@/lib/sync';

// Lives in its own file so the settings screen can lazy-require it
// only when Clerk env keys are present. A top-level static import of
// `@clerk/clerk-expo` from settings.tsx would side-effect-load
// `expo-auth-session` → native `ExpoCryptoAES`, which crashes in
// Expo Go (and in any EAS client that doesn't bundle it).

export function AccountSection() {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  // Clerk's `isLoaded` flips true once the session resource finishes
  // hydrating from the token cache. Render nothing in the meantime so
  // Settings doesn't flash a stale "Sign in" pill while a returning
  // user's session is still loading.
  if (!isLoaded) return null;

  const email = user?.primaryEmailAddress?.emailAddress;

  return (
    <View className="mt-6">
      <View className="px-5">
        <Text className="text-knowverse-star/50 text-xs uppercase tracking-widest">
          Account
        </Text>
      </View>
      <View className="px-5 pt-3">
        {isSignedIn ? (
          <>
            <Text className="text-knowverse-star text-sm">
              Signed in as {email ?? user?.firstName ?? 'your account'}
            </Text>
            <Text className="text-knowverse-star/50 mt-1 text-xs">
              Your saves, collections, and streak sync to this account on every
              change.
            </Text>
            <Pressable
              onPress={() => {
                void (async () => {
                  await signOut();
                  await resetSyncState();
                })();
              }}
              className="mt-4 self-start rounded-full border border-knowverse-star/30 px-4 py-2"
            >
              <Text className="text-knowverse-star/80 text-sm">Sign out</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text className="text-knowverse-star/70 text-sm">
              Sign in to sync your saves and streak across devices. Optional —
              Knowra works fully without an account.
            </Text>
            <Pressable
              onPress={() => router.push('/sign-in' as never)}
              className="bg-knowverse-star mt-4 self-start rounded-full px-5 py-2"
            >
              <Text className="text-knowverse-deep text-sm font-semibold">
                Sign in
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

import 'react-native-gesture-handler';
import '../../global.css';
import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { recordAppOpen } from '@/lib/streak';
import { registerForPushNotifications } from '@/lib/notifications';

// IMPORTANT: do NOT static-import `@clerk/clerk-expo` here. Its
// dependency chain runs `expo-auth-session` → native `ExpoCryptoAES`
// on module load, and that module is NOT bundled in Expo Go SDK 54.
// A top-level import crashes the app at startup before any JSX
// runs. Instead, we lazy-`require()` the module inside the wrapper
// function below — Metro bundles it eagerly but defers execution
// until the function is actually called, which only happens when
// `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is set (i.e. a real EAS build).

// Keep the native splash visible until React has actually committed the
// first frame of the feed (cached cards if we have them, skeleton if not).
// Without this, expo-splash-screen auto-hides as soon as the JS bundle
// finishes loading — which leaves a 100-400ms blank window before the
// first paint. Doing it at module level (not inside the component) means
// the prevent call fires before any rendering happens, even on cold start.
// Fire-and-forget: the API returns a promise we don't need to await, and
// the type signature wants a `.catch` to consume the unhandled rejection.
void SplashScreen.preventAutoHideAsync().catch(() => {});

// Clerk auth is FORCE-DISABLED for now. The native module chain
// (`@clerk/clerk-expo` → `expo-auth-session` → `ExpoCryptoAES`) was
// crashing the app on launch in production iOS builds, and we haven't
// fully configured the Clerk dashboard (Native API toggle, OAuth
// providers) anyway. To re-enable later:
//   1. Set `CLERK_FORCE_DISABLE = false` below
//   2. Verify `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` is set in EAS env
//   3. Verify Clerk Dashboard → Native API is ON
//   4. Verify Apple + Google OAuth providers are configured
// All other Knowra features work fully anonymously without auth, so
// disabling here is non-destructive.
const CLERK_FORCE_DISABLE = true;
const CLERK_PUBLISHABLE_KEY = CLERK_FORCE_DISABLE
  ? undefined
  : process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Streak threshold at which we earn the right to ask for push permission.
// Per product spec §6: never ask on session 1. By day 3 the user has
// demonstrated intent — that's when the daily digest becomes valuable.
const PUSH_PROMPT_STREAK = 3;
const PUSH_PROMPTED_FLAG = 'knowra.push_prompted';

async function maybePromptForPush(streakCount: number): Promise<void> {
  if (streakCount < PUSH_PROMPT_STREAK) return;
  const alreadyPrompted = await SecureStore.getItemAsync(PUSH_PROMPTED_FLAG);
  if (alreadyPrompted) return;
  // Set the flag BEFORE asking — if the user denies, we don't re-ask
  // every launch. The OS would ignore the second ask anyway (iOS only
  // honors the first prompt), but the flag also dedupes the token POST.
  await SecureStore.setItemAsync(PUSH_PROMPTED_FLAG, '1').catch(() => {});
  await registerForPushNotifications();
}

// Read `wikiId` out of a notification's data payload and route to the
// per-article screen. Used by both the cold-start path (app opened by
// tapping a push) and the warm path (push tapped while app was running
// or backgrounded).
function routeFromNotification(
  response: Notifications.NotificationResponse | null | undefined,
): void {
  const data = response?.notification.request.content.data;
  const wikiId = typeof data?.wikiId === 'string' ? data.wikiId : undefined;
  if (!wikiId) return;
  router.push(`/article/${wikiId}` as never);
}

export default function RootLayout() {
  // Hide the native splash on first commit. Because the layout renders
  // its child Stack synchronously, by the time this effect runs the
  // FeedScreen has already mounted and committed its first frame —
  // either cached cards (instant) or the skeleton (cache miss). Either
  // way, the splash hands off to a non-blank frame.
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Record an app-open exactly once per launch. The streak module
  // dedupes by calendar day, so this is a no-op if the user already
  // opened the app today. Then, if the user has earned the ask
  // (streak >= 3) and we haven't asked before, prompt for push.
  useEffect(() => {
    void recordAppOpen().then((streak) => maybePromptForPush(streak.count));
  }, []);

  // Push-tap deep link. Two paths:
  //   1. Cold start: the user tapped a push while the app was closed.
  //      Notifications.getLastNotificationResponseAsync() returns that
  //      tap once. We check it on mount.
  //   2. Warm: app is already running. The listener fires for every
  //      subsequent tap. Cleanup removes the subscription on unmount.
  useEffect(() => {
    void Notifications.getLastNotificationResponseAsync().then(routeFromNotification);
    const sub = Notifications.addNotificationResponseReceivedListener(
      routeFromNotification,
    );
    return () => sub.remove();
  }, []);

  const tree = (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#05071a' }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#05071a' },
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );

  if (!CLERK_PUBLISHABLE_KEY) return tree;
  return wrapWithClerk(tree, CLERK_PUBLISHABLE_KEY);
}

// Lazy Clerk wrapper. Only invoked when the publishable key is set;
// the require() calls don't evaluate until then. See the import-block
// comment above for why this can't be a static import.
function wrapWithClerk(tree: React.ReactElement, publishableKey: string): React.ReactElement {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { ClerkProvider: RawClerkProvider } = require('@clerk/clerk-expo');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { clerkTokenCache } = require('@/lib/clerkTokenCache');
  // Recurring React-19 JSX-class cast — Clerk's component types reject
  // the `children` prop under the stricter R19 constraint. Same pattern
  // as expo-image / Animated.View.
  const ClerkProvider = RawClerkProvider as unknown as React.ComponentType<{
    publishableKey: string;
    tokenCache: typeof clerkTokenCache;
    children: React.ReactNode;
  }>;
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={clerkTokenCache}>
      {tree}
    </ClerkProvider>
  );
}

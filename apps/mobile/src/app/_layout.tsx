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
import { ClerkProvider as RawClerkProvider } from '@clerk/clerk-expo';
import { recordAppOpen } from '@/lib/streak';
import { registerForPushNotifications } from '@/lib/notifications';
import { clerkTokenCache, type ClerkTokenCache } from '@/lib/clerkTokenCache';

// Recurring React-19 JSX-class workaround. Clerk's own component
// types don't yet satisfy React 19's stricter JSX constraint and
// reject the `children` prop. Casting to a plain function-component
// type preserves runtime behavior. See CardView / expo-image for
// the same pattern.
type ClerkProviderProps = {
  publishableKey: string;
  tokenCache: ClerkTokenCache;
  children: React.ReactNode;
};
const ClerkProvider = RawClerkProvider as unknown as React.ComponentType<ClerkProviderProps>;

// Keep the native splash visible until React has actually committed the
// first frame of the feed (cached cards if we have them, skeleton if not).
// Without this, expo-splash-screen auto-hides as soon as the JS bundle
// finishes loading — which leaves a 100-400ms blank window before the
// first paint. Doing it at module level (not inside the component) means
// the prevent call fires before any rendering happens, even on cold start.
// Fire-and-forget: the API returns a promise we don't need to await, and
// the type signature wants a `.catch` to consume the unhandled rejection.
void SplashScreen.preventAutoHideAsync().catch(() => {});

// Clerk is wired here behind a publishable-key env gate. When the key
// is absent, ClerkProvider is bypassed entirely and the app runs
// anonymously — preserving the brand promise that an account is
// optional. ExpoCryptoAES (the historical Expo Go blocker) ships with
// the EAS-built dev/production clients; only Expo Go itself can't
// resolve it.
const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

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
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={clerkTokenCache}
    >
      {tree}
    </ClerkProvider>
  );
}

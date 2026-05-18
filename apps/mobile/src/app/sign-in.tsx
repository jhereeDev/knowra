import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Feather as RawFeather } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';
import { useSSO } from '@clerk/clerk-expo';
import { useAuth } from '@clerk/clerk-expo';
import { maybeFirstPush } from '@/lib/sync';

// Recurring React-19 JSX-class workaround (see CardView, expo-image).
type FeatherIconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
};
const Feather = RawFeather as unknown as React.ComponentType<FeatherIconProps>;

// Per Clerk's Expo docs: warm up the browser to make the OAuth modal
// open instantly on tap. This must be paired with the cooldown in the
// effect cleanup; otherwise the warmed session leaks.
function useWarmUpBrowser() {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

// Required at module top per Clerk docs — completes any in-flight web
// auth session if the user closed the in-app browser without finishing.
WebBrowser.maybeCompleteAuthSession();

type Strategy = 'oauth_apple' | 'oauth_google';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { startSSOFlow } = useSSO();
  const { getToken, isSignedIn } = useAuth();
  const [busy, setBusy] = useState<Strategy | null>(null);
  const [error, setError] = useState<string | null>(null);
  useWarmUpBrowser();

  // If the user lands here already signed in (e.g. via deep-link), just
  // bounce back to the feed. The settings page already shows their
  // account; there's no reason to keep them here.
  useEffect(() => {
    if (isSignedIn) router.back();
  }, [isSignedIn, router]);

  const onPress = useCallback(
    async (strategy: Strategy) => {
      if (busy) return;
      setBusy(strategy);
      setError(null);
      try {
        const result = await startSSOFlow({ strategy });
        if (result.createdSessionId && result.setActive) {
          await result.setActive({ session: result.createdSessionId });
          // First-push happens here, not in _layout.tsx, so the user
          // doesn't navigate away before we have a token.
          const token = await getToken().catch(() => null);
          if (token) await maybeFirstPush(token);
          router.back();
          return;
        }
        // If we got here without a session, Clerk needed extra steps
        // (MFA, profile completion, etc.). For MVP, surface a generic
        // message — we'll wire the multi-step flow once a user hits it.
        setError('Sign-in needs another step. Try again or use a different method.');
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        // The user cancelling the in-app browser surfaces as an error
        // with no clean code — suppress that one.
        if (/cancel|dismiss/i.test(message)) {
          setError(null);
        } else {
          setError(message.slice(0, 160));
        }
      } finally {
        setBusy(null);
      }
    },
    [busy, getToken, router, startSSOFlow],
  );

  return (
    <View
      className="flex-1 bg-knowverse-deep px-8"
      style={{ paddingTop: insets.top + 24 }}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <Pressable
        onPress={() => router.back()}
        accessibilityLabel="Close sign-in"
        className="self-end"
      >
        <Feather name="x" size={22} color="#e7e9ff" />
      </Pressable>

      <View className="flex-1 justify-center">
        <Text className="text-knowverse-star text-4xl font-semibold">
          Sign in to Knowra
        </Text>
        <Text className="text-knowverse-star/60 mt-3 text-base leading-relaxed">
          Sync your saves, collections, and streak across devices. Knowra
          still works fully without an account — this is opt-in.
        </Text>

        <View className="mt-10 gap-3">
          <Pressable
            disabled={busy !== null}
            onPress={() => void onPress('oauth_apple')}
            accessibilityLabel="Continue with Apple"
            className="flex-row items-center justify-center gap-3 rounded-full bg-knowverse-star px-6 py-4"
          >
            {busy === 'oauth_apple' ? (
              <ActivityIndicator color="#05071a" />
            ) : (
              <Feather name="github" size={18} color="#05071a" />
            )}
            <Text className="text-knowverse-deep text-base font-semibold">
              Continue with Apple
            </Text>
          </Pressable>

          <Pressable
            disabled={busy !== null}
            onPress={() => void onPress('oauth_google')}
            accessibilityLabel="Continue with Google"
            className="flex-row items-center justify-center gap-3 rounded-full border border-knowverse-star/30 bg-knowverse/60 px-6 py-4"
          >
            {busy === 'oauth_google' ? (
              <ActivityIndicator color="#e7e9ff" />
            ) : (
              <Feather name="chrome" size={18} color="#e7e9ff" />
            )}
            <Text className="text-knowverse-star text-base font-semibold">
              Continue with Google
            </Text>
          </Pressable>
        </View>

        {error && (
          <Text className="text-red-300 mt-6 text-sm">{error}</Text>
        )}

        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Skip sign-in"
          className="mt-10 self-start"
        >
          <Text className="text-knowverse-star/50 text-sm underline">
            Not now
          </Text>
        </Pressable>
      </View>

      <Text className="text-knowverse-star/30 pb-6 text-center text-xs">
        We use Apple / Google sign-in via Clerk. We don't post to your
        socials and we don't share your email.
      </Text>
    </View>
  );
}

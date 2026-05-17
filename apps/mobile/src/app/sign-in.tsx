import { Pressable, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Stub. The real sign-in flow uses @clerk/clerk-expo's useOAuth, which
// transitively requires expo-auth-session → ExpoCryptoAES — a native
// module not bundled in Expo Go SDK 54. Restore the original Clerk
// implementation (see git history for this file) once a custom dev
// client has been built via `eas build --profile development`.

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      className="flex-1 bg-knowverse-deep px-8"
      style={{ paddingTop: insets.top + 24 }}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <View className="flex-1 justify-center">
        <Text className="text-knowverse-star text-4xl font-semibold">
          Sign-in coming soon
        </Text>
        <Text className="text-knowverse-star/60 mt-3 text-base">
          Knowra works fully without an account — your saved articles, streak,
          and topic preferences are stored on this device.
        </Text>
        <Text className="text-knowverse-star/40 mt-4 text-sm">
          Google + Apple sign-in lights up in the next build of the app.
        </Text>

        <Pressable
          onPress={() => router.back()}
          className="bg-knowverse-star mt-10 self-start rounded-full px-6 py-3"
        >
          <Text className="text-knowverse-deep text-sm font-semibold">
            Back to feed
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

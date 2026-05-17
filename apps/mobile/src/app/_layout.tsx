import 'react-native-gesture-handler';
import '../../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { recordAppOpen } from '@/lib/streak';

// NOTE: Clerk auth (`@clerk/clerk-expo`) is intentionally NOT imported
// here. Its dependency `expo-auth-session` requires the `ExpoCryptoAES`
// native module which is not bundled in Expo Go SDK 54. To enable Clerk
// sign-in, build a custom dev client with EAS (`eas build --profile
// development`) and restore the ClerkProvider wrapper. See CHECKPOINT
// "2026-05-17 — Clerk auth + push scaffolding".

export default function RootLayout() {
  // Record an app-open exactly once per launch. The streak module
  // dedupes by calendar day, so this is a no-op if the user already
  // opened the app today.
  useEffect(() => {
    void recordAppOpen();
  }, []);

  return (
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
}

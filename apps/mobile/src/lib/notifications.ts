import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getDeviceId } from './device';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Configure how foreground notifications are handled. On iOS, we want the
// banner to drop in even when the user is in the app — feels like a real
// app instead of one that goes silent when in use.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Ask the OS for notification permission and, if granted, fetch the
 * Expo push token and POST it to the backend. Per product spec, we
 * defer this ask — never request on first launch. Trigger after the
 * user has shown engagement (e.g. 3+ app opens).
 *
 * Returns the token on success, null on denial or any failure (failures
 * are silent — push is an enhancement).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') return null;

    // Android needs a default channel before notifications display.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const tokenRes = await Notifications.getExpoPushTokenAsync();
    const token = tokenRes.data;
    if (!token) return null;

    // Send to backend. Quiet failure — we'll retry on next attempt.
    const deviceId = await getDeviceId();
    await fetch(`${API_URL}/api/devices/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Knowra-Device-Id': deviceId,
      },
      body: JSON.stringify({ token }),
    }).catch(() => {});

    return token;
  } catch {
    return null;
  }
}

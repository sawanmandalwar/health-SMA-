import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { requestNotificationPermission } from './notificationService';
import { registerWebPushWithBackend } from './webPushService';

// Native builds schedule reminders locally with expo-notifications, while the
// web build relies on backend Web Push. This keeps callers platform-agnostic:
// they just ask "can this user receive reminders?".
export async function requestReminderPermission(
  authToken?: string | null,
): Promise<boolean> {
  if (Platform.OS !== 'web') {
    return requestNotificationPermission();
  }

  const token = authToken || (await AsyncStorage.getItem('authToken'));

  if (!token) return false;

  return registerWebPushWithBackend(token);
}

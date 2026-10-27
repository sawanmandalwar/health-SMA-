import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiFetch, parseJson } from './api';

const FALLBACK_TIME_ZONE = 'Asia/Kolkata';

let lastSyncedKey = '';

export function getDeviceTimeZone(): string {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof timeZone === 'string' && timeZone.trim()) {
      return timeZone.trim();
    }
  } catch {
    // Fall through to the app default.
  }

  return FALLBACK_TIME_ZONE;
}

// Keep the backend's daily dose window aligned with the device. This is called
// on app focus but only performs one request per token + timezone per session.
export async function syncTimezoneWithBackend(
  authToken?: string | null,
): Promise<boolean> {
  try {
    const token = authToken || (await AsyncStorage.getItem('authToken'));
    if (!token) return false;

    const timezone = getDeviceTimeZone();
    const syncKey = `${token}:${timezone}`;

    if (lastSyncedKey === syncKey) return true;

    const response = await apiFetch('/api/profile/timezone', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ timezone }),
    });

    const data = await parseJson(response).catch(() => null);

    if (!response.ok) {
      console.log(
        '[timezone] Backend rejected timezone sync:',
        response.status,
        data?.message || 'unknown error',
      );
      return false;
    }

    lastSyncedKey = syncKey;

    try {
      const raw = await AsyncStorage.getItem('user');
      if (raw) {
        const user = JSON.parse(raw);
        if (user && typeof user === 'object') {
          await AsyncStorage.setItem(
            'user',
            JSON.stringify({ ...user, timezone }),
          );
        }
      }
    } catch {
      // Cached profile metadata is best-effort only.
    }

    return true;
  } catch (error) {
    console.log(
      '[timezone] Unable to sync device timezone:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return false;
  }
}

export function resetTimezoneSyncCache(): void {
  lastSyncedKey = '';
}

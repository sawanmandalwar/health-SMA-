import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { apiFetch, parseJson } from './api';

// ============================================================
// Web Push reminders
// ------------------------------------------------------------
// The Vercel web build cannot schedule native notifications, so reminders are
// sent by the backend cron (/api/cron/reminders) to the browser using the Web
// Push API. This module registers the service worker, creates the push
// subscription and stores it for the signed-in user.
// ============================================================

const SUBSCRIPTION_ENDPOINT_KEY = 'webPushEndpoint';
const SERVICE_WORKER_URL = '/sw.js';

let registrationInFlight: Promise<boolean> | null = null;
let lastRegisteredKey = '';

export function isWebPushSupported(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;

  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// iOS only allows Web Push when the site was added to the Home Screen.
function isIosStandalone(): boolean {
  if (typeof navigator === 'undefined') return false;

  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  const standaloneDisplay =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;

  return Boolean(iosNavigator.standalone) || standaloneDisplay;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;

  const ua = navigator.userAgent || '';
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isIpadOs =
    navigator.platform === 'MacIntel' &&
    typeof navigator.maxTouchPoints === 'number' &&
    navigator.maxTouchPoints > 1;

  return isAppleMobile || isIpadOs;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const raw = atob(base64);
  const output = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
}

async function getVapidPublicKey(): Promise<string | null> {
  try {
    const response = await apiFetch('/api/notifications/web-push/public-key');
    const data = await parseJson<{
      configured?: boolean;
      publicKey?: string;
    }>(response).catch(() => null);

    if (!response.ok || !data?.configured || !data.publicKey) {
      console.log(
        '[web-push] Server has no VAPID keys configured; reminders are disabled.',
      );
      return null;
    }

    return data.publicKey;
  } catch (error) {
    console.log(
      '[web-push] Unable to load the VAPID public key:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return null;
  }
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (existing) return existing;

    const registered = await navigator.serviceWorker.register(
      SERVICE_WORKER_URL,
      { scope: '/' },
    );

    return registered;
  } catch (error) {
    console.log(
      '[web-push] Service worker registration failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return null;
  }
}

function matchesApplicationServerKey(
  subscription: PushSubscription,
  key: Uint8Array,
): boolean {
  const current = subscription.options?.applicationServerKey;
  if (!current) return false;

  const currentBytes = new Uint8Array(current);
  if (currentBytes.length !== key.length) return false;

  for (let index = 0; index < key.length; index += 1) {
    if (currentBytes[index] !== key[index]) return false;
  }

  return true;
}

async function getOrCreateSubscription(
  registration: ServiceWorkerRegistration,
  applicationServerKey: Uint8Array,
): Promise<PushSubscription> {
  const subscribe = () =>
    registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });

  const existing = await registration.pushManager.getSubscription();

  if (!existing) return subscribe();

  // Re-create the subscription when the server's VAPID key changed, otherwise
  // the backend's pushes would be rejected by the browser.
  if (matchesApplicationServerKey(existing, applicationServerKey)) {
    return existing;
  }

  await existing.unsubscribe().catch(() => undefined);

  return subscribe();
}


async function requestPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false;

  if (Notification.permission === 'granted') return true;

  if (Notification.permission === 'denied') {
    console.log(
      '[web-push] Notifications are blocked in the browser settings.',
    );
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

async function postSubscription(
  authToken: string,
  subscription: PushSubscription,
): Promise<boolean> {
  const json = subscription.toJSON();
  const endpoint = json.endpoint || subscription.endpoint;
  const keys = json.keys || {};

  if (!endpoint || !keys.p256dh || !keys.auth) {
    console.log('[web-push] Push subscription is missing endpoint or keys.');
    return false;
  }

  const response = await apiFetch('/api/notifications/web-push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      subscription: {
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
      },
    }),
  });

  if (!response.ok) {
    console.log(
      '[web-push] Backend rejected the subscription:',
      response.status,
    );
    return false;
  }

  await AsyncStorage.setItem(SUBSCRIPTION_ENDPOINT_KEY, endpoint);

  return true;
}

// Register this browser for backend-driven reminders. Safe to call on every
// screen focus: the subscription is reused and re-sent at most once per token.
export async function registerWebPushWithBackend(
  authToken: string,
): Promise<boolean> {
  if (!authToken) return false;
  if (!isWebPushSupported()) return false;

  if (lastRegisteredKey === authToken) return true;
  if (registrationInFlight) return registrationInFlight;

  registrationInFlight = (async () => {
    try {
      if (isIos() && !isIosStandalone()) {
        console.log(
          '[web-push] On iPhone/iPad, add Health Saathi to the Home Screen to receive notifications.',
        );
      }

      const granted = await requestPermission();
      if (!granted) return false;

      const publicKey = await getVapidPublicKey();
      if (!publicKey) return false;

      const registration = await ensureServiceWorker();
      if (!registration) return false;

      await navigator.serviceWorker.ready;

      const subscription = await getOrCreateSubscription(
        registration,
        urlBase64ToUint8Array(publicKey),
      );

      const saved = await postSubscription(authToken, subscription);
      if (!saved) return false;

      lastRegisteredKey = authToken;
      console.log('[web-push] Browser reminders registered.');

      return true;
    } catch (error) {
      console.log(
        '[web-push] Registration failed:',
        error instanceof Error ? error.message : 'unknown error',
      );
      return false;
    } finally {
      registrationInFlight = null;
    }
  })();

  return registrationInFlight;
}

// Remove this browser's subscription on logout so a signed-out account stops
// receiving reminders on the device.
export async function unregisterWebPushWithBackend(
  authToken: string,
): Promise<boolean> {
  if (!isWebPushSupported() || !authToken) return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = registration
      ? await registration.pushManager.getSubscription()
      : null;

    const endpoint =
      (subscription && subscription.endpoint) ||
      (await AsyncStorage.getItem(SUBSCRIPTION_ENDPOINT_KEY)) ||
      '';

    if (endpoint) {
      await apiFetch('/api/notifications/web-push/subscribe', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ endpoint }),
      }).catch(() => undefined);
    }

    if (subscription) {
      await subscription.unsubscribe().catch(() => undefined);
    }

    await AsyncStorage.removeItem(SUBSCRIPTION_ENDPOINT_KEY);
    lastRegisteredKey = '';

    return Boolean(endpoint);
  } catch (error) {
    console.log(
      '[web-push] Unsubscribe failed:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return false;
  }
}

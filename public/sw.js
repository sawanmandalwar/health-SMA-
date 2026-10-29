/* eslint-env serviceworker */

// Service worker for Health Saathi web push reminders.
// It receives pushes from the backend and shows a notification even when the
// app tab or browser window is closed.

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Health Saathi';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'health-saathi-reminder',
    renotify: Boolean(payload.tag),
    requireInteraction: false,
    data: payload.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = typeof data.url === 'string' && data.url ? data.url : '/';

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);

          if (clientUrl.origin === self.location.origin) {
            await client.focus();

            if ('navigate' in client) {
              await client.navigate(targetUrl);
            }

            return;
          }
        } catch {
          // Ignore malformed client URLs and keep looking.
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});

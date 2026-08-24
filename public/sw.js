// Service worker — enables PWA install and web-push notifications.
// No caching strategy; all requests go to the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

// Show a notification when a push arrives (works even if the app is closed).
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || 'Coffee Oasis';
  const options = {
    body:  data.body || '',
    icon:  '/icon-192.png',
    badge: '/icon-192.png',
    tag:   data.tag || undefined,   // same tag replaces an earlier notification
    data:  { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Focus an existing tab (or open one) when the notification is tapped.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  // Same-origin paths only — never navigate off-site from a notification.
  let url = (event.notification.data && event.notification.data.url) || '/';
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) url = '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const c of clients) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});

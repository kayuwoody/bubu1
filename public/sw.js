// Minimal service worker — enables PWA install prompt on Android Chrome.
// No caching strategy; all requests go to the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

// Minimal service worker so CampusCrush can be installed as an app.
// It deliberately does not cache anything: chats and matches must always be live.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})

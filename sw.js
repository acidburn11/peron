const C = 'peron-v13';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'config.js', 'manifest.webmanifest', 'icon-192.png',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname.endsWith('transitous.org') || u.hostname.endsWith('openstreetmap.org') || u.hostname.endsWith('workers.dev') || u.hostname.endsWith('open-meteo.com')) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(C).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch { d = { title: 'Peron', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Peron', { body: d.body || '', tag: d.tag || 'peron', renotify: true, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => cs.length ? cs[0].focus() : self.clients.openWindow('./')));
});

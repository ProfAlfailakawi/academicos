const CACHE = 'academicos-shell-v4';
const SHELL = ['/', '/app', '/manifest.webmanifest', '/icon.svg', '/icon-maskable.svg', '/icon-mono.svg'];
// بلا skipWaiting يبقى العامل الجديد في الانتظار ما دام هناك تبويب مفتوح،
// فيستمر القديم في خدمة هيكل مخزّن يشير إلى أصول نشرة سابقة.
self.addEventListener('install', event => { self.skipWaiting(); event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).catch(() => undefined)); });
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(cache => cache.put('/', copy)); }
      return res;
    }).catch(() => caches.match('/').then(res => res || Response.error())));
    return;
  }
  if (!url.pathname.startsWith('/assets/') && !SHELL.includes(url.pathname)) return;
  event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => {
    if (res.ok && res.type === 'basic') caches.open(CACHE).then(cache => cache.put(req, res.clone()));
    return res;
  })));
});

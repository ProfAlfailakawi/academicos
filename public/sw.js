/* بصمة البناء تُطبع هنا عند البناء (scripts/build-stamp.mjs). بايتات هذا الملف
   يجب أن تتغيّر مع كل إصدار، وإلا لم يرَ المتصفح تحديثاً أصلاً ولم تعلم التبويبات
   المفتوحة بشيء. */
const BUILD = '__BUILD_ID__';
const CACHE = 'academicos-shell-' + BUILD;
const SHELL = ['/', '/app', '/manifest.webmanifest', '/icon.svg', '/icon-maskable.svg', '/icon-mono.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];
/* الأصول المبصومة بهاش في اسمها هي وحدها التي تُقدَّم من الكاش مباشرة: اسمها يتغيّر
   مع بايتاتها، فالنسخة القديمة مستحيلة بالبناء. ما عداها شبكةٌ أولاً وكاشٌ احتياط. */
const HASHED = /\/assets\/.+[-.][A-Za-z0-9_]{8,}\.[a-z0-9]+$/i;
// بلا skipWaiting يبقى العامل الجديد في الانتظار ما دام هناك تبويب مفتوح،
// فيستمر القديم في خدمة هيكل مخزّن يشير إلى أصول نشرة سابقة.
self.addEventListener('install', event => { self.skipWaiting(); event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).catch(() => undefined)); });
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  /* طلبات التنقل (HTML) دائماً من الشبكة وبـ cache:"no-store": الهيكل المخزّن يسمّي
     أصولاً حذفتها النشرة التالية. الكاش احتياطٌ لانقطاع الاتصال لا غير. */
  if (req.mode === 'navigate') {
    event.respondWith(fetch(url.pathname + url.search, { cache: 'no-store', credentials: 'same-origin' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(cache => cache.put('/', copy)); }
      return res;
    }).catch(() => caches.match('/').then(res => res || Response.error())));
    return;
  }
  if (HASHED.test(url.pathname)) {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res.ok && res.type === 'basic') caches.open(CACHE).then(cache => cache.put(req, res.clone()));
      return res;
    })));
    return;
  }
  if (!SHELL.includes(url.pathname)) return;
  // أصول الهيكل غير المبصومة: شبكةٌ أولاً حتى لا تُقدَّم نسخة قديمة بعد النشر.
  event.respondWith(fetch(req).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(cache => cache.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(res => res || Response.error())));
});

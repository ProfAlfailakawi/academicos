/* بصمة البناء تُطبع هنا عند البناء (scripts/build-stamp.mjs). بايتات هذا الملف
   يجب أن تتغيّر مع كل إصدار، وإلا لم يرَ المتصفح تحديثاً أصلاً ولم تعلم التبويبات
   المفتوحة بشيء. */
const BUILD = '__BUILD_ID__';
const CACHE = 'academicos-shell-' + BUILD;
const SHELL = ['/', '/app', '/manifest.webmanifest', '/icon.svg', '/icon-maskable.svg', '/icon-mono.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/locale-bootstrap.js', '/theme-bootstrap.js', '/boot-splash.js'];
/* الأصول المبصومة بهاش في اسمها هي وحدها التي تُقدَّم من الكاش مباشرة: اسمها يتغيّر
   مع بايتاتها، فالنسخة القديمة مستحيلة بالبناء. ما عداها شبكةٌ أولاً وكاشٌ احتياط. */
const HASHED = /\/assets\/.+[-.][A-Za-z0-9_]{8,}\.[a-z0-9]+$/i;
// بلا skipWaiting يبقى العامل الجديد في الانتظار ما دام هناك تبويب مفتوح،
// فيستمر القديم في خدمة هيكل مخزّن يشير إلى أصول نشرة سابقة.
/* «نُحدّث البرنامج» بدل صفحة Google الإنجليزية.
   أثناء النشر يتبدّل الخادم، فتجيب واجهةُ Google الأمامية عن التنقّل بصفحة 5xx إنجليزية
   لا يكتبها خادمُنا. الصفحة البديلة (/updating.html وسكربتها /updating.js — خارجيٌّ لأن
   CSP تمنع المضمّن) تُحفظ عند التثبيت في ذاكرةٍ ثابتة الاسم، وتُقدَّم للتنقّل وحده — لا
   لـ/api ولا لغير GET ولا لجوابٍ ناجح — حين يعود 500/502/503/504 أو ينقطع الطلب والجهاز
   متّصل. لا يُحفظ جوابُ 5xx في أيّ ذاكرة هنا أبداً. */
const UPDATING_CACHE = 'academicos-updating';
const UPDATING_PAGE = '/updating.html';
const UPDATING_SCRIPT = '/updating.js';
const isUpdatingStatus = status => status === 500 || status === 502 || status === 503 || status === 504;
const storeUpdatingPage = () => Promise.all([fetch(UPDATING_PAGE, { cache: 'no-store' }), fetch(UPDATING_SCRIPT, { cache: 'no-store' })]).then(([page, script]) => {
  if (!page.ok || !(page.headers.get('content-type') || '').includes('text/html') || !script.ok || !(script.headers.get('content-type') || '').includes('javascript')) return;
  return caches.open(UPDATING_CACHE).then(cache => Promise.all([cache.put(UPDATING_PAGE, page), cache.put(UPDATING_SCRIPT, script)]));
}).catch(() => undefined);
/* مسحها التعافي مع كل الذاكرة؟ تُعاد بعد أول تنقّلٍ ناجح، ولا يُنتظر ذلك. */
const refillUpdatingPage = () => caches.open(UPDATING_CACHE).then(cache => cache.match(UPDATING_PAGE)).then(hit => hit ? undefined : storeUpdatingPage()).catch(() => undefined);
const updatingResponse = () => caches.open(UPDATING_CACHE).then(cache => cache.match(UPDATING_PAGE)).then(page => page ? page.text().then(body => new Response(body, {
  status: 503, statusText: 'Service Unavailable',
  headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '5', 'X-AcademicOS-Updating': '1' },
})) : null).catch(() => null);
self.addEventListener('install', event => { self.skipWaiting(); event.waitUntil(Promise.all([caches.open(CACHE).then(cache => cache.addAll(SHELL)).catch(() => undefined), storeUpdatingPage()])); });
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== UPDATING_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  /* طلبات التنقل (HTML) دائماً من الشبكة وبـ cache:"no-store": الهيكل المخزّن يسمّي
     أصولاً حذفتها النشرة التالية. الكاش احتياطٌ لانقطاع الاتصال لا غير. */
  /* صفحة التحديث وسكربتها: الشبكة أولاً، والنسخة المحفوظة حين يتعثّر الخادم. ولا تُحفظ
     الصفحة مكان هيكل التطبيق أبداً. */
  if (url.pathname === UPDATING_SCRIPT) {
    event.respondWith(fetch(req).then(res => isUpdatingStatus(res.status) ? caches.match(UPDATING_SCRIPT).then(hit => hit || res) : res)
      .catch(() => caches.match(UPDATING_SCRIPT).then(res => res || Response.error())));
    return;
  }
  if (url.pathname === UPDATING_PAGE) {
    if (req.mode === 'navigate') event.respondWith(fetch(req).then(res => isUpdatingStatus(res.status) ? updatingResponse().then(page => page || res) : res)
      .catch(error => updatingResponse().then(page => { if (page) return page; throw error; })));
    return;
  }
  /* 5xx في التنقّل هو المنصّة تبدّل الخادم أثناء النشر: صفحة التحديث تنتظره ثم تعيد فتح
     الرابط نفسه. وطلبٌ ينقطع والجهاز يقول إنه متّصل هو اللحظة نفسها؛ أمّا الانقطاع الحقيقي
     فيبقى على الهيكل المخزّن كما كان. */
  if (req.mode === 'navigate') {
    event.respondWith(fetch(url.pathname + url.search, { cache: 'no-store', credentials: 'same-origin' }).then(res => {
      if (isUpdatingStatus(res.status)) return updatingResponse().then(page => page || res);
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(cache => cache.put('/', copy)); void refillUpdatingPage(); }
      return res;
    }).catch(async () => {
      if (self.navigator?.onLine !== false) { const page = await updatingResponse(); if (page) return page; }
      return caches.match('/').then(res => res || Response.error());
    }));
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
    // أيقونةٌ أو سكربتُ إقلاعٍ طُلب أثناء النشر فجاءته صفحةُ 5xx: النسخة المحفوظة أفضل.
    else if (isUpdatingStatus(res.status)) return caches.match(req).then(hit => hit || res);
    return res;
  }).catch(() => caches.match(req).then(res => res || Response.error())));
});

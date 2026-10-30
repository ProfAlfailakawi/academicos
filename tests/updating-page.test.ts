/**
 * «النظام قيد التحديث» بدل صفحة Google الإنجليزية أثناء النشر.
 *
 *   U1) sw.js: التنقّلُ بـ 500/502/503/504 أو بانقطاعٍ والجهازُ متّصل ← صفحةُ التحديث (503، no-store)؛
 *       والنجاحُ والتحويلُ يمرّان كما هما؛ ودون اتصالٍ حقيقي يبقى الهيكلُ المخزّن.
 *   U2) لا يمسّ /api ولا غيرَ GET، ولا يحفظ جوابَ 5xx، ولا يحفظ صفحةَ التحديث مكان الهيكل.
 *   U3) التثبيتُ يحفظ الصفحة وسكربتها في ذاكرةٍ ثابتة يُبقيها التفعيل، وتُعاد بعد مسحها.
 *   U4) الصفحة: مستقلّة، بلا سكربتٍ مضمّن (CSP)، RTL، نهاري/ليلي، وتسأل /api/health/live
 *       كل ٣ ثوانٍ وتتباطأ، وتعيد فتح الرابط نفسه، ولا تدور في حلقة.
 *   U5) التطبيق: 5xx بغير JSON على /api ← شريطٌ هادئ؛ والتعافي لا يمسح والخادمُ لا يجيب؛
 *       و/api/health/live قبل حدّ المعدّل وApp Check.
 *   U6) scripts/verify-pwa.mjs ما زال ينجح.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { isPlatformUpdating, UPDATING_MESSAGE } from '../src/lib/updating-notice';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const ORIGIN = 'https://academicos-edu.web.app';
const PAGE = read('public/updating.html');
const SCRIPT = read('public/updating.js');
const pathOf = (key: any) => new URL(typeof key === 'string' ? key : key.url, ORIGIN).pathname;
const html = (body: string, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
const js = (body: string, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'application/javascript; charset=utf-8' } });
const GOOGLE_502 = '<html><title>Error 502 (Server Error)!!1</title><p>Error: Server Error. Please try again in 30 seconds.</p></html>';

type Net = (pathname: string) => Promise<Response>;
/** The page and its script are reachable (install time); everything else answers with `rest`. */
const withPage = (rest: Net): Net => async (pathname) => {
  if (pathname === '/updating.html') return html(PAGE);
  if (pathname === '/updating.js') return js(SCRIPT);
  return rest(pathname);
};
const deploying = (status: number | 'drop'): Net => withPage(async () => {
  if (status === 'drop') throw new TypeError('Failed to fetch');
  return html(GOOGLE_502, status);
});

/** sw.js in a sandbox with an in-memory Cache Storage that records every write. */
function worker(net: Net, options: { online?: boolean } = {}) {
  const handlers: Record<string, (event: any) => void> = {};
  const store = new Map<string, Map<string, Response>>();
  const writes: Array<{ cache: string; key: string; status: number }> = [];
  const open = async (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    const entries = store.get(name)!;
    return {
      put: async (key: any, response: Response) => { writes.push({ cache: name, key: pathOf(key), status: response.status }); entries.set(pathOf(key), response.clone()); },
      match: async (key: any) => entries.get(pathOf(key))?.clone(),
      addAll: async (list: string[]) => { for (const item of list) { const r = await net(pathOf(item)); if (r.ok) entries.set(pathOf(item), r); } },
    };
  };
  const caches = {
    open,
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
    match: async (key: any) => { for (const entries of store.values()) { const hit = entries.get(pathOf(key)); if (hit) return hit.clone(); } return undefined; },
  };
  const self: any = {
    addEventListener: (type: string, fn: any) => { handlers[type] = fn; },
    location: { origin: ORIGIN }, skipWaiting() {}, clients: { claim() {} },
    navigator: { onLine: options.online ?? true },
  };
  vm.runInNewContext(read('public/sw.js'), { self, URL, Response, Promise, String, caches, fetch: (request: any) => net(pathOf(request)) });
  const lifecycle = async (type: string, data?: unknown) => {
    const waits: Promise<unknown>[] = [];
    handlers[type]({ data, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits); await tick();
  };
  const request = async (pathname: string, init: { mode?: string; method?: string } = {}) => {
    let answer: Promise<Response> | null = null;
    handlers.fetch({
      request: { url: `${ORIGIN}${pathname}`, mode: init.mode ?? 'navigate', method: init.method ?? 'GET' },
      respondWith: (p: Promise<Response>) => { answer = p; },
    });
    let response: Response | null = null, error: unknown = null;
    try { response = answer ? await answer : null; } catch (e) { error = e; }
    await tick(); await tick();
    return { answered: answer !== null, response, error };
  };
  return { lifecycle, request, store, writes, open };
}

const isUpdatingPage = async (response: Response | null) =>
  Boolean(response) && response!.status === 503 && response!.headers.get('cache-control') === 'no-store'
  && /text\/html/.test(response!.headers.get('content-type') || '') && (await response!.clone().text()).includes('النظام قيد التحديث');

test('U1 a 500/502/503/504 navigation shows the updating page (503, no-store)', async () => {
  for (const status of [500, 502, 503, 504]) {
    const sw = worker(deploying(status));
    await sw.lifecycle('install');
    for (const p of ['/app', '/projects/abc', '/']) {
      assert.ok(await isUpdatingPage((await sw.request(p)).response), `${status} on ${p}`);
    }
  }
});

test('U1 a dropped navigation while the device is online shows the updating page; truly offline keeps the shell', async () => {
  const sw = worker(deploying('drop'));
  await sw.lifecycle('install');
  assert.ok(await isUpdatingPage((await sw.request('/app')).response));

  const offline = worker(withPage(async (pathname) => { if (pathname === '/') return html('<p>app shell</p>'); throw new TypeError('offline'); }), { online: false });
  await offline.lifecycle('install');
  (await offline.open('academicos-shell-__BUILD_ID__')).put('/', html('<p>app shell</p>'));
  const shell = await offline.request('/app');
  assert.equal(await shell.response!.text(), '<p>app shell</p>');
});

test('U1 successful answers and redirects pass through untouched', async () => {
  const sw = worker(withPage(async () => html('<p>the app</p>')));
  await sw.lifecycle('install');
  const app = await sw.request('/app');
  assert.equal(app.response?.status, 200);
  assert.equal(await app.response!.text(), '<p>the app</p>');
  const redirect = worker(async () => new Response(null, { status: 302, headers: { Location: '/login' } }));
  assert.equal((await redirect.request('/app')).response?.status, 302);
});

test('U2 never touches /api or non-GET, never stores a 5xx, never stores the updating page as the shell', async () => {
  const sw = worker(deploying(502));
  await sw.lifecycle('install');
  assert.equal((await sw.request('/api/projects', { mode: 'cors' })).answered, false);
  assert.equal((await sw.request('/api/export/x.zip')).answered, false);
  assert.equal((await sw.request('/app', { method: 'POST' })).answered, false);
  const fiveXX = sw.writes.filter((w) => w.status >= 500);
  assert.deepEqual(fiveXX, []);

  const ok = worker(withPage(async (pathname) => html(`<p>${pathname}</p>`)));
  await ok.lifecycle('install');
  ok.writes.length = 0;
  const direct = await ok.request('/updating.html');
  assert.equal(direct.response?.status, 200);
  assert.ok(!ok.writes.some((w) => w.key === '/'), 'the updating page is never stored as the app shell');
  await ok.request('/app');
  assert.ok(ok.writes.some((w) => w.key === '/'), 'app screens are still stored as the shell');
});

test('U2 a shell asset or the updating script asked for mid-deploy is answered from the stored copy', async () => {
  const sw = worker(deploying(502));
  await sw.lifecycle('install');
  (await sw.open('academicos-shell-__BUILD_ID__')).put('/icon.svg', new Response('<svg>cached</svg>', { status: 200 }));
  const icon = await sw.request('/icon.svg', { mode: 'no-cors' });
  assert.equal(await icon.response!.text(), '<svg>cached</svg>');
  const script = await sw.request('/updating.js', { mode: 'no-cors' });
  assert.equal(script.response?.status, 200);
  assert.equal(await script.response!.text(), SCRIPT);
  const dropped = worker(deploying('drop'));
  await dropped.lifecycle('install');
  assert.equal(await (await dropped.request('/updating.js', { mode: 'no-cors' })).response!.text(), SCRIPT);
});

test('U3 install stores the page and its script; activate keeps them and drops older builds', async () => {
  const source = read('public/sw.js');
  const sw = worker(deploying(502));
  await sw.lifecycle('install');
  assert.ok(sw.store.get('academicos-updating')?.has('/updating.html'));
  assert.ok(sw.store.get('academicos-updating')?.has('/updating.js'));
  await sw.open('academicos-shell-old');
  await sw.lifecycle('activate');
  assert.ok(sw.store.has('academicos-updating'));
  assert.ok(!sw.store.has('academicos-shell-old'));
  assert.match(source, /const BUILD = '__BUILD_ID__';/);

  const empty = worker(withPage(async () => html(GOOGLE_502, 502)));
  assert.equal((await empty.request('/app')).response?.status, 502, 'without a stored page the answer is returned as it came');
  const refill = worker(withPage(async () => html('<p>ok</p>')));
  await refill.request('/app');
  assert.ok(refill.store.get('academicos-updating')?.has('/updating.html'), 'a successful navigation stores it again after a wipe');
});

test('U4 the page is self-contained, CSP-safe, RTL, light/dark, in the app identity', () => {
  assert.doesNotMatch(PAGE, /https?:\/\//i);
  assert.doesNotMatch(PAGE, /<link\b|@import/i);
  assert.equal([...PAGE.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/gi)].length, 0, 'no inline <script>: production CSP has no unsafe-inline');
  assert.deepEqual([...PAGE.matchAll(/<script[^>]*\bsrc="([^"]+)"/gi)].map((m) => m[1]), ['/updating.js']);
  assert.ok((PAGE.match(/url\("([^"]+)"\)/g) || []).every((u) => /^url\("\/fonts\//.test(u)));
  assert.match(PAGE, /<html lang="ar" dir="rtl">/);
  assert.match(PAGE, /prefers-color-scheme:dark/);
  assert.match(PAGE, /:root\.dark\{/);
  assert.match(PAGE, /prefers-reduced-motion/);
  assert.match(PAGE, /<title>تحديث النظام · AcademicOS<\/title>/);
  for (const text of ['النظام قيد التحديث', 'AcademicOS is restarting on a new version', 'إعادة الاتصال الآن', 'id="step"', 'role="status" aria-live="polite"']) assert.ok(PAGE.includes(text), text);
  // The mark is the app's own icon (public/icon.svg).
  const icon = read('public/icon.svg');
  for (const piece of ['M14.6 34.6 L24 13.4 L33.4 34.6', 'M17.7 27.6 H30.3', '#c8452d', '#23346b']) {
    assert.ok(icon.includes(piece) && PAGE.includes(piece), piece);
  }
  assert.doesNotMatch(SCRIPT, /https?:\/\//i);
});

function runPage(options: { health: boolean[]; recent?: number[]; pathname?: string; online?: boolean; theme?: string }) {
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const asked: string[] = [];
  const nodes: Record<string, any> = {};
  const node = (id: string) => (nodes[id] ??= { textContent: '', addEventListener() {} });
  const session: Record<string, string> = options.recent ? { 'academicos-updating-reloads': JSON.stringify(options.recent) } : {};
  const classes = new Set<string>();
  const location = { pathname: options.pathname ?? '/app', reloads: 0, replaced: '', reload() { this.reloads++; }, replace(url: string) { this.replaced = url; } };
  let call = 0;
  const context: any = {
    document: { getElementById: node, addEventListener() {}, hidden: false, readyState: 'complete', documentElement: { classList: { add: (c: string) => classes.add(c) } } },
    window: { addEventListener() {} }, navigator: { onLine: options.online ?? true }, location,
    localStorage: { getItem: (k: string) => (k === 'academicos-theme' ? options.theme ?? null : null) },
    sessionStorage: { getItem: (k: string) => session[k] ?? null, setItem: (k: string, v: string) => { session[k] = v; } },
    setTimeout: (fn: () => void, ms: number) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout() {},
    fetch: (url: string, init: any) => { asked.push(`${url}|${init?.cache}`); const ok = options.health[Math.min(call++, options.health.length - 1)]; return Promise.resolve({ ok }); },
    AbortController, JSON, Date, Math,
  };
  vm.runInNewContext(SCRIPT, context);
  const step = async () => {
    const timer = timers.filter((t) => t.ms !== 8000).shift()!;
    timers.splice(timers.indexOf(timer), 1);
    timer.fn(); await tick(); await tick();
    return timer.ms;
  };
  return { asked, location, nodes, step, classes };
}

test('U4 the page asks /api/health/live every 3 s and reopens the same URL when it answers', async () => {
  const page = runPage({ health: [false, false, true] });
  const delays = [await page.step(), await page.step(), await page.step()];
  assert.deepEqual(delays, [3000, 3000, 3000]);
  assert.ok(page.asked.every((a) => a === '/api/health/live|no-store'), page.asked.join());
  assert.equal(page.location.reloads, 1);
});

test('U4 it backs off up to 15 s, slows to 30 s after three reloads in two minutes, and goes home when opened by name', async () => {
  const slow = runPage({ health: [false] });
  const delays: number[] = [];
  for (let i = 0; i < 16; i++) delays.push(await slow.step());
  assert.equal(delays[0], 3000);
  assert.ok(delays[delays.length - 1] > 3000 && delays.every((ms) => ms <= 15000));
  assert.ok(delays.every((ms, i) => i === 0 || ms >= delays[i - 1]));
  assert.equal(slow.location.reloads, 0);

  const now = Date.now();
  const stuck = runPage({ health: [true], recent: [now - 5000, now - 4000, now - 3000] });
  assert.equal(await stuck.step(), 30000);
  assert.match(stuck.nodes.title.textContent, /وقتاً أطول/);
  assert.match(stuck.nodes.lead.textContent, /longer than usual/);

  const named = runPage({ health: [true], pathname: '/updating.html' });
  await named.step();
  assert.equal(named.location.replaced, '/');
  assert.equal(named.location.reloads, 0);
});

test('U4 offline it says so and does not ask the server; it honours the saved app theme', async () => {
  const page = runPage({ health: [true], online: false });
  await page.step();
  assert.equal(page.asked.length, 0);
  assert.match(page.nodes.title.textContent, /غير متصل/);
  assert.match(page.nodes.step.textContent, /انتظار عودة الشبكة/);
  assert.ok(runPage({ health: [true], theme: 'dark' }).classes.has('dark'));
  assert.ok(runPage({ health: [true], theme: 'light' }).classes.has('light'));
  assert.equal(runPage({ health: [true], theme: 'system' }).classes.size, 0);
});

test('U5 the app tells the platform 5xx apart and shows one calm notice instead of an error', () => {
  assert.ok(isPlatformUpdating(502, 'text/html; charset=UTF-8') && isPlatformUpdating(503, '') && isPlatformUpdating(500, 'text/html') && isPlatformUpdating(504, null));
  assert.ok(!isPlatformUpdating(503, 'application/json; charset=utf-8') && !isPlatformUpdating(404, 'text/html') && !isPlatformUpdating(200, 'text/html'));
  assert.match(UPDATING_MESSAGE, /النظام قيد التحديث/);

  const api = read('src/lib/api.ts');
  const perform = api.slice(api.indexOf('const perform = async'), api.indexOf('let result = await perform(false);'));
  assert.ok(perform.indexOf('isPlatformUpdating(') > 0 && perform.indexOf('isPlatformUpdating(') < perform.indexOf('response.json()'));
  assert.match(perform, /showUpdatingNotice\(\)/);
  assert.match(read('src/lib/ui-error.ts'), /code === "PLATFORM_UPDATING"\) return t\("ui\.error\.updating"\)/);
  assert.match(read('src/lib/i18n-messages.ts'), /"ui\.error\.updating": UI\(/);

  const update = read('src/lib/app-update.ts');
  const chunk = update.slice(update.indexOf('async function recoverFromStaleChunk'), update.indexOf('export function markShellHealthy'));
  assert.ok(chunk.indexOf('await serverAnswers()') > 0 && chunk.indexOf('await serverAnswers()') < chunk.indexOf('purgeShell()'), 'chunk recovery asks the server before wiping');
  const reconcile = update.slice(update.indexOf('function reconcileAfterReload'), update.indexOf('async function checkForUpdate'));
  assert.ok(reconcile.indexOf('await serverAnswers()') > 0 && reconcile.indexOf('await serverAnswers()') < reconcile.indexOf('purgeShell()'), 'hard refresh asks the server before wiping');
  assert.match(update, /SERVER_BACK_EVENT, \(\) => \{ void checkForUpdate\(\); \}/);
  const fetchBuild = update.slice(update.indexOf('async function fetchServerBuild'), update.indexOf('async function applyUpdate'));
  assert.ok(fetchBuild.indexOf('if (!response.ok) return null;') < fetchBuild.indexOf('response.json()'), 'the version check never reads the error page');
});

test('U5 /api/health/live is read-only and sits before the rate limiter and App Check', () => {
  const server = read('server.ts');
  const live = server.indexOf('app.get("/api/health/live"');
  assert.ok(live > 0);
  assert.ok(live < server.indexOf('app.use("/api", apiRateLimit);'));
  assert.ok(live < server.indexOf('app.use("/api", verifyAppCheck);'));
  const body = server.slice(live, server.indexOf('app.get("/env-config.js"', live));
  assert.match(body, /res\.json\(\{ ok: true \}\)/);
  assert.doesNotMatch(body, /Firestore|firestore|await/);
});

test('U6 scripts/verify-pwa.mjs still passes', () => {
  const output = execFileSync(process.execPath, ['scripts/verify-pwa.mjs'], { encoding: 'utf8' });
  assert.match(output, /PWA guard passed/);
});

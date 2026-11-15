/* Duo widget keep-out guard (WebKit).
 *
 * Fails when anything important (visible text, a/button/input/select/textarea,
 * [role=tab], [role=button], img, svg, logo, badge) has a bounding box that
 * intersects the reserved system-widget box at the physical top-right:
 *   x >= innerWidth - --duo-widget-w   and   y <= --duo-widget-h
 * Extended backgrounds are exempt (no text and no interaction, a full-screen scrim,
 * a decorative svg wider than 60% of the screen, or [data-duo-bleed]); each exemption
 * is logged. Where the Duo media query does not match (the box is 0) the case is
 * recorded as "inactive" and not counted as a pass.
 *
 *   npm run test:duo-widget        (builds nothing: run `npm run build` first)
 *   BASE=http://localhost:5190 node tests/e2e/duo-widget-guard.mjs   (use a running server)
 *   --report=PATH  write the JSON report;   --quick  fewer states (smoke)
 */
import { webkit } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const PORT = process.env.GUARD_PORT || '5197';
let BASE = process.env.BASE;
let server;
if (!BASE) {
  BASE = `http://localhost:${PORT}`;
  server = spawn('node', ['dist/server.cjs'], { env: { ...process.env, NODE_ENV: 'production', PORT }, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(BASE + '/')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
}

const SIZES = [[382, 580], [457, 678], [457, 760], [470, 780], [594, 368], [669, 867], [951, 585]];
const VIEWPORTS = SIZES.flatMap(([w, h]) => [[w, h], [h, w]]).filter(([w, h], i, a) => a.findIndex(([x, y]) => x === w && y === h) === i);
const TALL = [[720, 900], [951, 669], [951, 800], [960, 960], [382, 780], [382, 844], [470, 900], [669, 1000], [951, 700]];  // full-height app viewports (no browser toolbars)
const WK_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const SCHEMES = ['light', 'dark'];
const click = (sel) => async (p) => { const l = p.locator(sel).first(); if (await l.count()) { await l.click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(400); } };
const STATES = [
  { id: 'login', role: 'none', path: '/login' },
  { id: 'public-home', role: 'none', path: '/' },
  { id: 'public-page', role: 'none', path: '/p/faq' },
  { id: 'error-404', role: 'none', path: '/share/invalid-token-duo' },
  { id: 'student-home', role: 'student', path: '/app' },
  { id: 'student-projects', role: 'student', path: '/app/projects' },
  { id: 'workspace', role: 'student', path: '/app/project/demo_project_1_1' },
  { id: 'professor-home', role: 'professor', path: '/app' },
  { id: 'menu-open', role: 'student', path: '/app', act: click('.app-topbar button.lg\\:hidden') },
  { id: 'search-palette', role: 'student', path: '/app', act: click('.command-trigger') },
  { id: 'dialog-open', role: 'student', path: '/app/project/demo_project_1_1', act: async (p) => { await click('.workspace-more > summary')(p); await click('.workspace-more > div .border-dashed button')(p); } },
];
const QUICK = new Set(['login', 'student-home', 'menu-open', 'dialog-open']);
const FONT200 = new Set(['login', 'public-home', 'student-home', 'menu-open']);

let browser = await webkit.launch();
const tokens = {};
for (const role of ['student', 'professor']) tokens[role] = (await (await fetch(BASE + '/api/demo/session', { method: 'POST' })).json()).token;

async function context(role, [w, h], scheme, mode) {
  const app = mode === 'app';
  // APP = emulated Capacitor WKWebView in desktop WebKit: WKWebView UA (no Safari/ token), window.Capacitor, navigator.standalone undefined, DPR 2.
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: app ? 2 : 1, locale: 'ar-KW', colorScheme: scheme, reducedMotion: 'reduce', hasTouch: true, ...(app ? { userAgent: WK_UA, isMobile: true } : {}) });
  if (app) await ctx.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', platform: 'ios' }; try { Object.defineProperty(navigator, 'standalone', { value: undefined, configurable: true }); } catch {} });
  await ctx.addInitScript(([t, r, sc]) => {
    try { if (t) { sessionStorage.setItem('academicos_demo_session_v1', t); sessionStorage.setItem('academicos_demo_role_v1', r); } localStorage.setItem('academicos.locale.v1', 'ar'); localStorage.setItem('academicos-theme', sc); } catch {}
  }, [tokens[role] || '', role, scheme]);
  // the production server sends upgrade-insecure-requests; strip it for http://localhost only
  await ctx.route('**/*', async (route) => {
    const res = await route.fetch().catch(() => null); if (!res) return route.abort().catch(() => {});
    const hd = { ...res.headers() };
    if (hd['content-security-policy']) hd['content-security-policy'] = hd['content-security-policy'].replace(/;\s*upgrade-insecure-requests/, '');
    await route.fulfill({ response: res, headers: hd }).catch(() => {});
  });
  return ctx;
}

/* Runs in the page. Returns the zone and every important box that touches it. */
const measure = () => {
  const root = getComputedStyle(document.documentElement);
  const px = (n) => { const t = document.createElement('div'); t.style.cssText = `position:absolute;visibility:hidden;width:${root.getPropertyValue(n).trim() || '0px'}`; document.body.appendChild(t); const v = t.getBoundingClientRect().width; t.remove(); return v; };
  const ph = (n) => { const t = document.createElement('div'); t.style.cssText = `position:absolute;visibility:hidden;height:${root.getPropertyValue(n).trim() || '0px'}`; document.body.appendChild(t); const v = t.getBoundingClientRect().height; t.remove(); return v; };
  const vw = document.documentElement.clientWidth, vh = innerHeight;
  const zw = px('--duo-widget-w'), zh = ph('--duo-widget-h');
  const out = { vw, vh, zw, zh, hits: [], bleed: [], scrollX: document.documentElement.scrollWidth - vw };
  if (zw === 0 || zh === 0) return out;
  const zx = vw - zw;
  const hit = (r) => r.width > 0 && r.height > 0 && r.right > zx + 0.5 && r.left < vw && r.top < zh - 0.5 && r.bottom > 0;
  const visible = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse' || +s.opacity === 0) return false; } return true; };
  const label = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''}`;
  const INTERACTIVE = 'a,button,input,select,textarea,[role=tab],[role=button],[role=link],summary';
  const MEDIA = 'img,svg,canvas,video,[data-logo],[class*=logo],[class*=badge],[class*=avatar]';
  const seen = new Set();
  const add = (el, r, kind, text) => {
    if (seen.has(el)) return; seen.add(el);
    if (el.closest('.sr-only')) { out.bleed.push({ el: label(el), why: 'sr-only (visually hidden, 1px clip)' }); return; }
    if (el.closest('[data-duo-bleed],[data-duo-debug]')) { out.bleed.push({ el: label(el), why: 'data-duo-bleed' }); return; }
    const full = r.width >= vw * 0.9 && r.height >= vh * 0.9;
    const hasText = !!(el.textContent || '').trim();
    if (kind === 'interactive' && !hasText && (full || el.tabIndex === -1) && !el.querySelector('svg,img')) { out.bleed.push({ el: label(el), why: 'scrim (no text, tabindex -1 or full screen)' }); return; }
    if (kind === 'media' && (r.width >= vw * 0.6 || el.closest('[aria-hidden=true]'))) { out.bleed.push({ el: label(el), why: 'decorative media / aria-hidden' }); return; }
    out.hits.push({ el: label(el), kind, text: (text || el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40), rect: [r.left, r.top, r.right, r.bottom].map(Math.round) });
  };
  const clipped = (el, r) => { for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) { const s = getComputedStyle(n); if (/(hidden|clip|auto|scroll)/.test(s.overflowX + s.overflowY)) { const b = n.getBoundingClientRect(); if (b.right <= zx + 0.5 || b.top >= zh || b.bottom <= 0 || r.right <= b.left || r.left >= b.right) return true; } } return false; };
  for (const el of document.querySelectorAll(INTERACTIVE)) { const r = el.getBoundingClientRect(); if (hit(r) && visible(el) && !clipped(el, r)) add(el, r, 'interactive'); }
  for (const el of document.querySelectorAll(MEDIA)) { const r = el.getBoundingClientRect(); if (hit(r) && visible(el) && !clipped(el, r)) add(el, r, 'media'); }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) {
    if (!n.nodeValue.trim()) continue; const el = n.parentElement; if (!el || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName) || !visible(el)) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (hit(r) && !clipped(el, r)) { add(el, r, 'text', n.nodeValue); break; }
  }
  return out;
};

const report = { engine: 'webkit', base: BASE, cases: 0, active: 0, inactive: 0, violations: [], bleed: {}, scrollX: [], inactiveCases: [] };
let launched = 0;
async function relaunch() { try { await browser.close(); } catch {} browser = await webkit.launch(); launched = 0; }
async function run(role, vp, scheme, state, font200, mode, retry = 3) {
  if (++launched > 12) await relaunch();
  let ctx, page;
  try { ctx = await context(role, vp, scheme, mode); page = await ctx.newPage(); } catch (e) { if (!retry) throw e; await relaunch(); return run(role, vp, scheme, state, font200, mode, retry - 1); }
  const name = `${mode} ${vp[0]}x${vp[1]} ${scheme}${font200 ? ' font200' : ''} ${state.id}`;
  try {
    await page.goto(BASE + state.path, { waitUntil: 'load', timeout: 30000 });
    if (args.control) await page.addStyleTag({ content: ':root{--duo-widget-w:96px;--duo-widget-gap:8px;--duo-widget-h:clamp(64px,31vh,270px)}' });
    if (font200) await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    await page.waitForSelector('#root *', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(900);
    if (state.act) await state.act(page);
    await page.waitForTimeout(300);
    const m = await page.evaluate(measure);
    report.cases++; if (args.verbose) console.log('case', name);
    if (m.zw === 0 || m.zh === 0) { report.inactive++; report.inactiveCases.push(name); report.violations.push({ case: name, el: 'ZONE-INACTIVE', kind: 'error', text: 'box resolved to 0: the guard would pass vacuously' }); }
    else {
      report.active++;
      for (const h of m.hits) report.violations.push({ case: name, ...h });
      for (const b of m.bleed) { const k = `${b.el} :: ${b.why}`; report.bleed[k] = (report.bleed[k] || 0) + 1; }
      if (m.scrollX > 1) report.scrollX.push({ case: name, overflow: m.scrollX });
    }
  } catch (e) {
    if (/closed|crash/i.test(String(e)) && retry) { await relaunch(); return run(role, vp, scheme, state, font200, mode, retry - 1); }
    report.violations.push({ case: name, el: 'LOAD-ERROR', kind: 'error', text: String(e).slice(0, 120) });
  }
  await ctx.close().catch(() => {});
}
if (args.control) { args.quick = true; }
const MODES = args.mode ? [String(args.mode)] : ['safari', 'app'];
for (const mode of MODES) for (const vp of [...VIEWPORTS, ...TALL]) for (const scheme of SCHEMES) for (const st of STATES) {
  if (args.quick && !QUICK.has(st.id)) continue;
  if (args.states && !String(args.states).split(',').includes(st.id)) continue;
  await run(st.role, vp, scheme, st, false, mode);
  if (FONT200.has(st.id) && scheme === 'light' && !args.quick) await run(st.role, vp, scheme, st, true, mode);
}
await browser.close(); server?.kill();
if (args.report) writeFileSync(String(args.report), JSON.stringify(report, null, 1));
console.log(`WebKit duo-widget guard: ${report.cases} cases, ${report.active} active, ${report.inactive} inactive (box 0), ${report.violations.length} violations, ${report.scrollX.length} horizontal overflows`);
for (const v of report.violations.slice(0, 60)) console.log(' VIOLATION', v.case, '|', v.el, v.kind, JSON.stringify(v.text), v.rect ? v.rect.join(',') : '');
console.log('exemptions:', JSON.stringify(report.bleed));
console.log('inactive (not counted as pass):', [...new Set(report.inactiveCases.map((c) => c.split(' ').slice(0, 2).join(' ')))].join(', '));
if (args.control) {
  // negative control: on the BASE build (no keep-out) with the box forced on, the guard MUST flag overlaps
  const real = report.violations.filter((v) => v.el !== 'ZONE-INACTIVE' && v.el !== 'LOAD-ERROR').length;
  console.log(`NEGATIVE CONTROL: ${real} overlaps flagged on the base build with the box forced on (must be > 0)`);
  process.exit(real > 0 ? 0 : 1);
}
process.exit(report.violations.length || report.scrollX.length ? 1 : 0);

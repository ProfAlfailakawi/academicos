/* Before/after screenshots with the reserved box outlined.
 *   BASE=http://localhost:5192 node tests/e2e/duo-widget-shots.mjs before   (base branch build)
 *   BASE=http://localhost:5191 node tests/e2e/duo-widget-shots.mjs after
 * The red frame is drawn by this script from the measured numbers (96 x clamp(64, 31vh, 270)),
 * not by the page, so it is identical on both. Output: docs/iphone-duo-widget-corner/<tag>-<w>x<h>.png */
import { webkit } from 'playwright';
const tag = process.argv[2] || 'after';
const BASE = process.env.BASE;
const OUT = new URL('../../docs/iphone-duo-widget-corner/', import.meta.url).pathname;
const token = (await (await fetch(BASE + '/api/demo/session', { method: 'POST' })).json()).token;
const browser = await webkit.launch();
for (const [w, h] of [[382, 580], [669, 867], [951, 585]]) for (const [name, path, role] of [['home', '/app', 'student'], ['signin', '/login', 'none']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: 'ar-KW', reducedMotion: 'reduce', hasTouch: true });
  await ctx.addInitScript(([t, r]) => { try { if (t) { sessionStorage.setItem('academicos_demo_session_v1', t); sessionStorage.setItem('academicos_demo_role_v1', r); } localStorage.setItem('academicos.locale.v1', 'ar'); } catch {} }, [role === 'none' ? '' : token, role]);
  await ctx.route('**/*', async (route) => { const res = await route.fetch().catch(() => null); if (!res) return route.abort().catch(() => {}); const hd = { ...res.headers() }; if (hd['content-security-policy']) hd['content-security-policy'] = hd['content-security-policy'].replace(/;\s*upgrade-insecure-requests/, ''); await route.fulfill({ response: res, headers: hd }).catch(() => {}); });
  const p = await ctx.newPage();
  await p.goto(BASE + path, { waitUntil: 'load' }); await p.waitForTimeout(1500);
  await p.evaluate(() => { const hh = Math.min(270, Math.max(64, innerHeight * 0.31)); const d = document.createElement('div'); d.style.cssText = `position:fixed;top:0;right:0;width:96px;height:${hh}px;box-sizing:border-box;border:2px solid #f00;background:rgba(255,0,0,.14);z-index:2147483647;pointer-events:none`; document.body.appendChild(d); });
  await p.screenshot({ path: `${OUT}${tag}-${name}-${w}x${h}.png` });
  await ctx.close();
}
await browser.close();

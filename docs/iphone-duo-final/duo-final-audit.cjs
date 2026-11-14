/* iPhone Duo final audit — every inventoried screen × poses A–J, measured in WebKit.
 *
 * Run (server first, in another shell):
 *   npm run build && NODE_ENV=production PORT=5190 node dist/server.cjs
 *   NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
 *     BASE=http://localhost:5190 node docs/iphone-duo-final/duo-final-audit.cjs [--only=S01,F03] [--shots=DIR] [--no-stress] [--stress-only]
 *
 * Uses the isolated demo sandbox (POST /api/demo/session, read-only). The production
 * server sends HSTS + upgrade-insecure-requests; both are stripped inside this test
 * browser only, so http://localhost loads. Writes docs/iphone-duo-final/audit-report.json.
 */
const { webkit } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:5190';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const ONLY = args.only ? new Set(String(args.only).split(',')) : null;
const SHOTS = args.shots ? path.resolve(String(args.shots)) : null;
const OUT = path.join(__dirname, 'audit-report.json');

/* ---------------- poses ---------------- */
const POSES = [
  ['A', 382, 580], ['A', 385, 571], ['A', 320, 568],
  ['B', 594, 368],
  ['C', 669, 867],
  ['D', 951, 585],
  ['E', 951, 350], ['E', 600, 350],
  ['F', 669, 520], ['F', 600, 480],
  ['G', 768, 1024], ['G', 1024, 768], ['G', 1280, 800], ['G', 1440, 900],
  ['H', 360, 640], ['H', 390, 844], ['H', 844, 390],
  ['X', 320, 350], ['X', 320, 600], ['X', 320, 900], ['X', 470, 350], ['X', 470, 600], ['X', 470, 900],
  ['X', 620, 350], ['X', 620, 600], ['X', 620, 900],
];
const SHOT_SIZES = new Set(['669x867', '951x585', '951x350', '600x350', '594x368', '382x580']);

/* ---------------- screen inventory (router + navigation) ---------------- */
const click = (sel, i = 0) => async (p) => { const l = p.locator(sel); if (await l.count() > i) { await l.nth(i).click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(500); return true; } return false; };
const pwTab = (i) => async (p) => click('.workspace-head [role="group"] > button', i)(p);
const pwMore = (i) => async (p) => { await click('.workspace-more > summary')(p); return click('.workspace-more > div .grid > button', i)(p); };
const SCREENS = [
  // Public
  ['P01', 'none', '/', 'Public home'],
  ['P02', 'none', '/login', 'Sign-in'],
  ['P03', 'none', '/login', 'Sign-up (mode)', click('.auth-card button.focus-ring.font-semibold.brand-text')],
  ['P04', 'none', '/login', 'Password reset (mode)', click('.auth-card button.text-meta.brand-text')],
  ['P05', 'none', '/status', 'Service status'],
  ['P06', 'none', '/security-report', 'Security report'],
  ...['students', 'faculty', 'pricing', 'security', 'academic-integrity', 'about', 'contact', 'faq', 'terms', 'privacy', 'acceptable-use', 'ai-policy', 'accessibility']
    .map((s, i) => [`P1${String(i).padStart(2, '0')}`, 'none', `/p/${s}`, `Public page /p/${s}`]),
  ['P07', 'none', '/share/invalid-token-duo', 'Shared report (invalid link: error state)'],
  ['P08', 'none', '/verify-evidence', 'Verify evidence'],
  ['P09', 'professor', '/mfa-setup', 'MFA set-up (demo session)'],
  // Student
  ['S01', 'student', '/app', 'Student home (MissionControl)'],
  ['S02', 'student', '/app/projects', 'Projects'],
  ['S03', 'student', '/app/projects', 'Projects · completed filter', click('.segmented button', 2)],
  ['S04', 'student', '/app/project/demo_project_1_1', 'Workspace · writer'],
  ['S05', 'student', '/app/project/demo_project_1_1', 'Workspace · evidence', pwTab(1)],
  ['S06', 'student', '/app/project/demo_project_1_1', 'Workspace · viva', pwTab(2)],
  ...Array.from({ length: 13 }, (_, i) => [`S1${String(i).padStart(2, '0')}`, 'student', '/app/project/demo_project_1_1', `Workspace · more tab #${i + 1}`, pwMore(i)]),
  ['S07', 'student', '/app/project/demo_project_1_1', 'Workspace · "more" menu open', click('.workspace-more > summary')],
  ['S08', 'student', '/app/project/demo_project_1_1', 'Workspace · integrity dialog', async (p) => { await click('.workspace-more > summary')(p); return click('.workspace-more > div .border-dashed button', 0)(p); }],
  ['S09', 'student', '/app/project/demo_project_1_1', 'Workspace · defence dossier dialog', async (p) => { await click('.workspace-more > summary')(p); return click('.workspace-more > div .border-dashed button', 1)(p); }],
  ['S30', 'student', '/app/project/does-not-exist', 'Workspace · not found (error state)'],
  ['S31', 'student', '/app/upload', 'New assignment · write'],
  ['S32', 'student', '/app/upload', 'New assignment · rescue', click('[role="tablist"] [role="tab"]', 1)],
  ['S33', 'student', '/app/learn', 'Learn · explain'],
  ['S34', 'student', '/app/learn', 'Learn · solve', click('.duo-book > .flex.gap-2 > button, main .flex.gap-2 > button', 1)],
  ['S35', 'student', '/app/plans', 'Plans'],
  ['S36', 'student', '/app/settings', 'Settings · look'],
  ['S37', 'student', '/app/settings', 'Settings · tab 2', click('.segmented button', 1)],
  ['S38', 'student', '/app/settings', 'Settings · tab 3', click('.segmented button', 2)],
  ['S39', 'student', '/app/settings', 'Settings · tab 4', click('.segmented button', 3)],
  ['S40', 'student', '/app/onboarding', 'Onboarding'],
  ['S41', 'student', '/app/calendar', 'Calendar'],
  ['S42', 'student', '/app/notifications', 'Notifications · decisions'],
  ['S43', 'student', '/app/notifications', 'Notifications · all', click('button[aria-pressed]', 2)],
  ['S44', 'student', '/app/skills', 'Skills'],
  ['S45', 'student', '/app/passport', 'Passport'],
  ['S46', 'student', '/app/archive', 'Archive'],
  ['S47', 'student', '/app/jobs', 'Jobs'],
  ['S48', 'student', '/app/support', 'Support'],
  ['S49', 'student', '/app/search', 'Search'],
  ['S50', 'student', '/app/invitations', 'Invitations'],
  ['S51', 'student', '/app', 'Command palette (dialog)', async (p) => { await p.evaluate(() => window.dispatchEvent(new Event('academicos:open-palette'))); await p.waitForTimeout(400); return true; }],
  ['S52', 'student', '/app', 'Menu drawer (phone/laptop)', click('.app-topbar > button.lg\\:hidden')],
  // Professor
  ['F01', 'professor', '/app', 'Professor home (ProfessorOS)'],
  ['F02', 'professor', '/app/professor', 'Professor workspace'],
  ['F03', 'professor', '/app/course/demo_course_1', 'Course OS'],
  ['F04', 'professor', '/app/course/demo_course_1', 'Course OS · assignment builder dialog', click('main .ui-button[data-variant="outline"]:has(svg)', 0)],
  ['F05', 'professor', '/app/course/demo_course_1/assignment/demo_assignment_1_1/submissions', 'Submissions queue'],
  ['F06', 'professor', '/app/settings', 'Settings (professor)'],
  ['F07', 'professor', '/app/calendar', 'Calendar (professor)'],
  ['F08', 'professor', '/app/notifications', 'Notifications (professor)'],
  // Teaching assistant / admin / support
  ['T01', 'teaching_assistant', '/app', 'TA home (RoleHome)'],
  ['A01', 'university_admin', '/app', 'Admin home (RoleHome)'],
  ['A02', 'university_admin', '/app/control', 'Control plane'],
  ['A03', 'university_admin', '/app/platform', 'Platform hub'],
  ['A04', 'university_admin', '/app/platform', 'Platform hub · editor dialog', click('main .ui-button:not([data-variant="outline"]):has(svg.lucide-plus)', 0)],
  ['A05', 'university_admin', '/app/integrations', 'Integrations'],
  ['A06', 'university_admin', '/app/users', 'User management'],
  ['A07', 'university_admin', '/app/curriculum-twin', 'Curriculum twin'],
  ['A08', 'university_admin', '/app/settings', 'Settings (admin)'],
  ['U01', 'support_agent', '/app', 'Support home (RoleHome)'],
  ['U02', 'support_agent', '/app/support-console', 'Support console'],
];

/* ---------------- in-page measurement ---------------- */
function measure(opts) {
  const vw = innerWidth, vh = innerHeight, de = document.documentElement;
  const SPREAD = "(min-width: 721px) and (max-width: 1000px) and (min-height: 520px) and (max-height: 960px) and (orientation: landscape)";
  const LAPTOP = '(min-width: 520px) and (max-width: 1023.98px) and (max-height: 420px)';
  const spread = matchMedia(SPREAD).matches, laptop = matchMedia(LAPTOP).matches;
  const desc = (el) => { const t = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 40); const c = (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter(Boolean).slice(0, 3).join('.'); return `${el.tagName.toLowerCase()}${c ? '.' + c : ''}${t ? ` "${t}"` : ''}`; };
  // Memoised per element: hidden-ness and the clip region its descendants live in.
  const ROOT = { hidden: false, r: [-1e9, 1e9, -1e9, 1e9], hard: [-1e9, 1e9], sc: false };
  const memo = new Map();
  const info = (a) => {
    if (!a || a === de || a === document.body) return ROOT;
    let v = memo.get(a); if (v) return v;
    const s = getComputedStyle(a); const par = info(a.parentElement);
    const hidden = par.hidden || s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0 || (a.getAttribute('aria-hidden') === 'true' && !a.closest('[role=dialog]'));
    const base = s.position === 'fixed' ? ROOT : par;
    let r = base.r, hard = base.hard, sc = base.sc;
    if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
      const ar = a.getBoundingClientRect();
      r = [Math.max(r[0], ar.left), Math.min(r[1], ar.right), Math.max(r[2], ar.top), Math.min(r[3], ar.bottom)];
      if (/(auto|scroll)/.test(s.overflowX + s.overflowY)) sc = true; else hard = [Math.max(hard[0], ar.left), Math.min(hard[1], ar.right)];
    }
    v = { hidden, r, hard, sc, s }; memo.set(a, v); return v;
  };
  const hiddenStyle = (el) => info(el).hidden;
  const isSrOnly = (el) => { const s = info(el).s; return el.classList.contains('sr-only') || (s.position === 'absolute' && (s.clip !== 'auto' && s.clip !== '')) || (s.clipPath && s.clipPath.includes('inset(50%')); };
  const clipRect = (el, r) => { const c = getComputedStyle(el).position === 'fixed' ? ROOT : info(el.parentElement); const x1 = Math.max(r.left, c.r[0]), x2 = Math.min(r.right, c.r[1]); const hx1 = Math.max(r.left, c.hard[0]), hx2 = Math.min(r.right, c.hard[1]); return { x1, x2, y1: Math.max(r.top, c.r[2]), y2: Math.min(r.bottom, c.r[3]), scroller: c.sc, hardClip: hx2 - hx1 < r.right - r.left - 1 }; };
  const INTER = 'a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],summary';
  const cx = vw / 2, L = cx - 16, R = cx + 16;
  const spine = [], small = [], clipped = [], outX = [], safe = [];
  const sa = opts.sa || null;
  for (const el of document.body.querySelectorAll('*')) {
    const tag = el.tagName; if (el.classList.contains('skip-link')) continue; if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'svg' || el.closest('svg')) continue;
    const inter = el.matches(INTER);
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const important = inter || /^H[1-3]$/.test(tag) || tag === 'TH' || tag === 'TD' || tag === 'LABEL';
    if (!inter && !hasText && !important) continue;
    let r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    if (r.width >= vw - 1 && r.height >= vh - 1) continue; // modal scrims and full-screen backdrops
    if (hiddenStyle(el) || isSrOnly(el)) continue;
    if (hasText && !inter) { const rg = document.createRange(); let u = null; for (const n of el.childNodes) { if (n.nodeType !== 3 || !n.textContent.trim()) continue; rg.selectNodeContents(n); for (const q of rg.getClientRects()) { if (q.width < 1) continue; u = u ? { left: Math.min(u.left, q.left), right: Math.max(u.right, q.right), top: Math.min(u.top, q.top), bottom: Math.max(u.bottom, q.bottom) } : { left: q.left, right: q.right, top: q.top, bottom: q.bottom }; } } if (u) r = { ...u, width: u.right - u.left, height: u.bottom - u.top }; }
    const c = clipRect(el, r); const vis = c.x2 - c.x1 >= 1 && c.y2 - c.y1 >= 1;
    if (!vis) continue;
    if (spread && c.x2 > L && c.x1 < R) spine.push(desc(el));
    if (!c.scroller && (r.left < -1 || r.right > vw + 1)) outX.push(desc(el));
    if (important && c.hardClip && (c.x2 - c.x1) < 0.6 * r.width) clipped.push(desc(el));
    if (inter && c.x1 >= 0 && c.x2 <= vw && Math.min(r.width, r.height) < 44 && getComputedStyle(el).display !== 'inline') small.push(`${desc(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    if (sa && (hasText || inter)) { const fixedish = (() => { for (let a = el; a && a !== de; a = a.parentElement) { const p = getComputedStyle(a).position; if (p === 'fixed' || p === 'sticky') return true; } return false; })(); const top = fixedish ? c.y1 : c.y1 + scrollY; if (c.x1 < sa.l - 0.5 || c.x2 > vw - sa.r + 0.5 || (fixedish && top < sa.t - 0.5)) safe.push(desc(el)); }
  }
  // laptop: bottom bar never covers content
  let covered = null;
  if (laptop) { const bar = document.querySelector('.app-topbar'); const main = document.querySelector('.app-main'); if (bar && main) { const barTop = bar.getBoundingClientRect().top; const ps = parseFloat(getComputedStyle(main).paddingBottom); covered = ps + 0.5 < (vh - barTop) ? `main padding-bottom ${ps} < bar ${Math.round(vh - barTop)}` : null; } }
  return {
    spread, laptop,
    overflowX: Math.max(0, de.scrollWidth - de.clientWidth),
    spine: spine.slice(0, 12), spineCount: spine.length,
    small: small.slice(0, 8), smallCount: small.length,
    clipped: clipped.slice(0, 8), clippedCount: clipped.length,
    outX: outX.slice(0, 8), outXCount: outX.length,
    safe: sa ? safe.slice(0, 8) : undefined, safeCount: sa ? safe.length : undefined,
    covered,
    errorBoundary: !!document.querySelector('.error-screen'),
  };
}

/* ---------------- browser plumbing ---------------- */
async function newContext(browser, role, extra = {}) {
  let token = '';
  if (role !== 'none') token = (await (await fetch(BASE + '/api/demo/session', { method: 'POST' })).json()).token;
  const ctx = await browser.newContext({ viewport: { width: 669, height: 867 }, deviceScaleFactor: 1, locale: 'ar-KW', reducedMotion: 'reduce', hasTouch: true, ...extra });
  await ctx.addInitScript(([t, r, theme]) => {
    try { if (t) { sessionStorage.setItem('academicos_demo_session_v1', t); sessionStorage.setItem('academicos_demo_role_v1', r); } localStorage.setItem('academicos.locale.v1', 'ar'); if (theme) localStorage.setItem('academicos-theme', theme); } catch {}
  }, [token, role, extra.colorScheme === 'dark' ? 'dark' : '']);
  await ctx.route('**/*', async (route) => {
    const res = await route.fetch().catch(() => null); if (!res) return route.abort();
    const h = { ...res.headers() }; delete h['strict-transport-security'];
    if (h['content-security-policy']) h['content-security-policy'] = h['content-security-policy'].replace(/;\s*upgrade-insecure-requests/, '');
    await route.fulfill({ response: res, headers: h });
  });
  return ctx;
}
async function settle(p) {
  await p.waitForFunction(() => !document.querySelector('.acos-splash') && document.querySelector('#root > *'), null, { timeout: 30000 }).catch(() => {});
  await p.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(500);
}
async function open(p, screen) {
  const [, , url, , action] = screen;
  await p.setViewportSize({ width: 669, height: 867 });
  await p.goto(BASE + url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await settle(p);
  let ok = true; if (action) ok = await action(p);
  return ok;
}

/* Merge into the existing report (runs can be split with --only), then summarise. */
function flush(report) {
  const prev = fs.existsSync(OUT) && !args.fresh ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  const r = prev || report;
  if (prev) { Object.assign(prev.screens, report.screens); for (const k of Object.keys(report.stress)) prev.stress[k] = { ...(prev.stress[k] || {}), ...report.stress[k] }; if (Object.keys(report.live).length) prev.live = report.live; prev.generatedAt = report.generatedAt; prev.browser = report.browser; }
  const sum = { screens: 0, poseChecks: 0, overflow: 0, spine: 0, clipped: 0, outX: 0, small: 0, covered: 0, errorBoundary: 0 };
  for (const e of Object.values(r.screens)) { sum.screens++; for (const m of Object.values(e.poses)) { sum.poseChecks++; if (m.overflowX) sum.overflow++; if (m.spineCount) sum.spine++; if (m.clippedCount) sum.clipped++; if (m.outXCount) sum.outX++; if (m.smallCount) sum.small++; if (m.covered) sum.covered++; if (m.errorBoundary) sum.errorBoundary++; } }
  r.summary = sum;
  fs.writeFileSync(OUT, JSON.stringify(r));
  report.screens = {}; report.stress = {}; report.live = {};
  return sum;
}

(async () => {
  const browser = await webkit.launch();
  const report = { base: BASE, generatedAt: new Date().toISOString(), browser: `WebKit ${browser.version()}`, poses: POSES.map(([k, w, h]) => `${k} ${w}x${h}`), screens: {}, stress: {}, live: {} };
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const byRole = {};
  for (const s of SCREENS) { if (ONLY && !ONLY.has(s[0])) continue; (byRole[s[1]] ||= []).push(s); }
  for (const [role, list] of Object.entries(args['stress-only'] ? {} : byRole)) {
    const ctx = await newContext(browser, role);
    const p = await ctx.newPage();
    const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    for (const s of list) {
      const [id, , url, label] = s;
      errors.length = 0;
      const ok = await open(p, s);
      const entry = { role, url, label, actionApplied: ok, finalPath: new URL(p.url()).pathname, poses: {} };
      for (const [k, w, h] of POSES) {
        await p.setViewportSize({ width: w, height: h });
        await p.evaluate(() => window.scrollTo(0, 0));
        await p.waitForTimeout(350);
        const m = await p.evaluate(measure, {});
        entry.poses[`${k} ${w}x${h}`] = m;
        if (SHOTS && SHOT_SIZES.has(`${w}x${h}`)) await p.screenshot({ path: path.join(SHOTS, `${id}-${w}x${h}.jpg`), type: 'jpeg', quality: 70 });
      }
      entry.pageErrors = [...new Set(errors)].slice(0, 3);
      report.screens[id] = entry; flush(report);
      const worst = Object.values(entry.poses);
      console.log(id, label, '| ovf', Math.max(...worst.map((m) => m.overflowX)), '| spine', Math.max(...worst.map((m) => m.spineCount)), '| clip', Math.max(...worst.map((m) => m.clippedCount)), '| outX', Math.max(...worst.map((m) => m.outXCount)), '| small', Math.max(...worst.map((m) => m.smallCount)), entry.pageErrors.length ? '| ERR ' + entry.pageErrors[0] : '');
    }
    await ctx.close();
  }

  /* ---- J: accessibility stress on every main screen ---- */
  if (!args['no-stress']) {
    const MAIN = SCREENS.filter((s) => !s[4] && (!ONLY || ONLY.has(s[0])) && !/^P1\d\d/.test(s[0]) || ['P101', 'P106'].includes(s[0]));
    const variants = {
      text200: { css: 'html{font-size:200% !important}' },
      dark: { ctx: { colorScheme: 'dark' } },
      safeAreas: { css: ':root{--sa-t:28px !important;--sa-r:0px !important;--sa-b:22px !important;--sa-l:44px !important}', sa: { t: 28, r: 0, b: 22, l: 44 } },
    };
    for (const [vname, v] of Object.entries(variants)) {
      const roles = {}; for (const s of MAIN) (roles[s[1]] ||= []).push(s);
      for (const [role, list] of Object.entries(roles)) {
        const ctx = await newContext(browser, role, v.ctx || {});
        if (v.css) await ctx.addInitScript((css) => { const add = () => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }; if (document.head) add(); else document.addEventListener('DOMContentLoaded', add); }, v.css);
        const p = await ctx.newPage();
        for (const s of list) {
          await open(p, s);
          for (const [w, h] of [[669, 867], [951, 585], [382, 580], [951, 350]]) {
            await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(450);
            const m = await p.evaluate(measure, { sa: v.sa });
            ((report.stress[vname] ||= {})[s[0]] ||= {})[`${w}x${h}`] = { overflowX: m.overflowX, spineCount: m.spineCount, spine: m.spine.slice(0, 4), clippedCount: m.clippedCount, outXCount: m.outXCount, safeCount: m.safeCount, safe: m.safe, errorBoundary: m.errorBoundary };
            if (SHOTS && ['S01', 'F01', 'P02'].includes(s[0]) && w === 669) await p.screenshot({ path: path.join(SHOTS, `J-${vname}-${s[0]}-${w}x${h}.jpg`), type: 'jpeg', quality: 70 });
          }
        }
        await ctx.close();
      }
      console.log('stress', vname, 'done');
    }
    // keyboard: a focused field and the window shrunk to ~350 tall
    const kb = {};
    for (const [id, role, url, sel] of [['S01', 'student', '/app', 'textarea'], ['P02', 'none', '/login', '#login-password, input[type=email]'], ['S48', 'student', '/app/support', 'main input, main textarea'], ['S31', 'student', '/app/upload', 'main textarea, main input']]) {
      const ctx = await newContext(browser, role); const p = await ctx.newPage();
      await open(p, [id, role, url]);
      for (const [w, h] of [[669, 867], [951, 585], [382, 580]]) {
        await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(200);
        const f = p.locator(sel).first(); await f.focus().catch(() => {}); await f.scrollIntoViewIfNeeded().catch(() => {});
        await p.setViewportSize({ width: w, height: 350 }); await p.waitForTimeout(300);
        await f.scrollIntoViewIfNeeded().catch(() => {});
        const r = await p.evaluate(() => { const a = document.activeElement; const b = a && a.getBoundingClientRect(); const bar = document.querySelector('.app-topbar'); const bt = bar ? bar.getBoundingClientRect() : null; return { focusedTag: a && a.tagName, visible: !!b && b.top >= 0 && b.top < innerHeight - 20, coveredByBottomBar: !!(b && bt && bt.top > innerHeight / 2 && b.top + 20 > bt.top), overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
        (kb[id] ||= {})[`${w}x${h}->${w}x350`] = r;
      }
      await ctx.close();
    }
    report.stress.keyboard = kb;
  }

  /* ---- I: live resize on one page instance (no reload) ---- */
  if (!ONLY || ONLY.has('I')) {
    const SEQ = [[951, 585], [669, 867], [470, 700], [382, 580], [594, 368], [951, 350], [951, 585]];
    const ctx = await newContext(browser, 'student'); const p = await ctx.newPage();
    await p.setViewportSize({ width: 951, height: 585 });
    await p.goto(BASE + '/app', { waitUntil: 'domcontentloaded' }); await settle(p);
    let navs = 0; p.on('framenavigated', () => navs++);
    const marker = await p.evaluate(() => (window.__duoMarker = Math.random()));
    await p.fill('textarea', 'نص تجريبي يجب أن يبقى بعد كل طيّة');
    await p.evaluate(() => { const t = document.querySelector('textarea'); t.focus(); t.setSelectionRange(4, 9); });
    await p.evaluate(() => window.scrollTo(0, 400));
    const steps = [];
    for (const [w, h] of SEQ) {
      await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(350);
      steps.push(await p.evaluate(() => { const t = document.querySelector('textarea'); return { size: `${innerWidth}x${innerHeight}`, value: t && t.value, sel: t ? [t.selectionStart, t.selectionEnd] : null, scrollY: Math.round(scrollY), overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, marker: window.__duoMarker }; }));
    }
    // a dialog left open across the whole sequence
    await p.evaluate(() => window.dispatchEvent(new Event('academicos:open-palette'))); await p.waitForTimeout(300);
    await p.fill('#command-title', 'مشاريع').catch(() => {});
    const dlg = [];
    for (const [w, h] of SEQ) { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(300); dlg.push(await p.evaluate(() => { const i = document.querySelector('#command-title'); const pal = document.querySelector('.command-palette'); const r = pal && pal.getBoundingClientRect(); const cx = innerWidth / 2; return { size: `${innerWidth}x${innerHeight}`, open: !!i, query: i && i.value, panel: r ? [Math.round(r.left), Math.round(r.right)] : null, crossesSpine: !!r && r.right > cx - 16 && r.left < cx + 16, tapsBlocked: [[0.12, 0.5], [0.3, 0.92], [0.5, 0.5], [0.7, 0.92], [0.88, 0.15]].every(([fx, fy]) => { const e = document.elementFromPoint(innerWidth * fx, innerHeight * fy); return !!e && !!e.closest('[role="dialog"], .fixed.inset-0'); }), backdropFull: (() => { const b = pal && pal.parentElement && pal.parentElement.querySelector(':scope > button'); const br = b && b.getBoundingClientRect(); return !!br && br.left <= 0 && br.right >= innerWidth && br.top <= 0 && br.bottom >= innerHeight; })() }; })); }
    // print at ~658px: the book spread and laptop bar are screen-only
    await p.keyboard.press('Escape').catch(() => {});
    await p.setViewportSize({ width: 658, height: 900 }); await p.emulateMedia({ media: 'print' }); await p.waitForTimeout(300);
    const print = await p.evaluate(() => ({ spreadQueryMatches: matchMedia('screen and (min-width: 640px) and (max-width: 720px) and (min-height: 520px)').matches, bookDisplay: getComputedStyle(document.querySelector('.duo-book') || document.body).display, spineShown: getComputedStyle(document.querySelector('.app-shell'), '::after').content !== 'none' && getComputedStyle(document.querySelector('.app-shell'), '::after').content !== '', overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
    await p.emulateMedia({ media: 'screen' });
    report.live = { print, reloadsOrNavigations: navs, markerKept: steps.every((s) => s.marker === marker), textKept: steps.every((s) => s.value === 'نص تجريبي يجب أن يبقى بعد كل طيّة'), selectionKept: steps.every((s) => s.sel && s.sel[0] === 4 && s.sel[1] === 9), steps, dialog: dlg };
    console.log('live', JSON.stringify({ navs, markerKept: report.live.markerKept, textKept: report.live.textKept, selectionKept: report.live.selectionKept }));
    await ctx.close();
  }

  await browser.close();
  const sum = flush(report);
  console.log('summary', JSON.stringify(sum));
})().catch((e) => { console.error(e); process.exit(1); });

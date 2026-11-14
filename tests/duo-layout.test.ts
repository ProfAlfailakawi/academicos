import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = async (f: string) => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('Duo layout is width-based: no posture or viewport-segment queries decide layout', async () => {
  for (const f of ['index.css', 'duo.css', 'final-polish.css', 'motion.css', 'beauty.css', 'duo-edges.css']) {
    const s = await css(f);
    assert.doesNotMatch(s, /@media[^{]*(device-posture|viewport-segments)/, f);
  }
});

test('600-1023px swaps the phone dock for a rail instead of a stretched phone', async () => {
  const s = await css('duo.css');
  assert.match(s, /@media \(min-width: 600px\) and \(max-width: 1023\.98px\)/);
  assert.match(s, /\.mobile-dock \{ display: none !important; \}/);
  assert.match(s, /--rail-w/);
});

test('viewport never locks pinch-zoom', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const meta = html.match(/<meta name="viewport"[^>]*>/)?.[0] ?? '';
  assert.match(meta, /viewport-fit=cover/);
  assert.doesNotMatch(meta, /user-scalable\s*=\s*no|maximum-scale/);
});

test('edge layer: per-side safe-area tokens, start/end swap in RTL, loaded last', async () => {
  const s = await css('duo-edges.css');
  for (const side of ['top', 'right', 'bottom', 'left']) assert.match(s, new RegExp(`env\\(safe-area-inset-${side}`));
  assert.match(s, /\[dir="rtl"\] \{ --sa-start: var\(--sa-r\); --sa-end: var\(--sa-l\); \}/);
  // The rail absorbs the START edge inset (it used to take the left inset on the right edge in RTL).
  assert.match(s, /width: calc\(var\(--rail-w\) \+ var\(--sa-start\)\) !important/);
  const main = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
  const imports = [...main.matchAll(/import '\.\/([\w-]+\.css)'/g)].map((m) => m[1]);
  assert.equal(imports.at(-1), 'duo-edges.css');
});

test('compact height decides the rail: the folded screen held sideways is not a phone with two bars', async () => {
  const short = '(min-width: 520px) and (max-width: 599.98px) and (max-height: 480px)';
  for (const f of ['duo.css', 'beauty.css']) {
    const s = await css(f);
    const railBlocks = s.match(/@media \(min-width: 600px\) and \(max-width: [\d.]+px\)[^{]*\{/g) ?? [];
    assert.ok(railBlocks.length > 0, f);
    for (const q of railBlocks) assert.ok(q.includes(short), `${f}: ${q}`);
  }
});

test('sign-in fits short windows and touch targets hold at every width', async () => {
  const s = await css('duo-edges.css');
  assert.match(s, /@media \(max-height: 480px\) \{\s*\.auth-shell > main/);
  assert.match(s, /@media \(pointer: coarse\) \{[^}]*language-switcher[^}]*min-height: 44px/);
  assert.match(s, /:where\(\.min-h-screen\)[^{]*\{ min-height: 100dvh; \}/);
});

const SPREAD = 'screen and (min-width: 640px) and (max-width: 760px) and (min-height: 520px),\n       screen and (min-width: 761px) and (max-width: 1000px) and (min-height: 520px) and (min-aspect-ratio: 4/3)';

test('book spread: the opened Duo reads as two pages around a spine (screen only, no posture queries)', async () => {
  const s = await css('duo-edges.css');
  assert.ok(s.split(`@media ${SPREAD} {`).length - 1 >= 2, 'spread query for the shell and the public side');
  assert.match(s, /--spine: 32px;/);
  assert.match(s, /--pg: calc\(50vw - var\(--spine\) \/ 2\);/);
  // the top bar is split: search on the reading page, tools on the context page
  assert.match(s, /\.app-topbar \.topbar-tools \{\s*position: absolute;/);
  // pages bring their context; one grid row track absorbs a tall context page
  assert.match(s, /\.duo-book \{\s*display: grid !important;[\s\S]*?grid-template-rows: repeat\(14, auto\) 1fr;/);
  assert.match(s, /\.duo-book > \.duo-aside, \.duo-book > \.duo-unwrap > \.duo-aside \{\s*grid-column: 2; grid-row: 1 \/ -1;/);
  // dialogs: the panel moves to a page, the scrim stays full-screen
  assert.match(s, /\[role="dialog"\]\[aria-modal="true"\]:not\(\.fixed\):not\(\.app-sidebar--mobile\)/);
  // every new block is screen-only, so print keeps its own layout
  for (const q of s.match(/@media [^{]*(min-width: 640px|max-height: 420px)[^{]*\{/g) ?? []) assert.match(q, /^@media screen and /, q);
});

test('laptop posture: content on top, one control bar at the bottom that never covers it', async () => {
  const s = await css('duo-edges.css');
  const block = s.slice(s.indexOf('@media screen and (min-width: 520px) and (max-width: 1023.98px) and (max-height: 420px) {'));
  assert.ok(block.length > 100);
  assert.match(block, /\.app-shell \.app-sidebar--desktop \{ display: none !important; \}/);
  assert.match(block, /\.app-shell \.app-topbar \{\s*position: fixed !important; top: auto; bottom: 0;/);
  assert.match(block, /\.app-shell \.mobile-dock \{\s*display: block !important;/);
  assert.match(block, /padding-bottom: calc\(var\(--lap-bar\) \+ var\(--sa-b\) \+ 1\.25rem\) !important;/);
});

test('book pages: each page root marked .duo-book carries exactly one context page', async () => {
  const pages = ['MissionControl', 'ProfessorOS', 'RoleHome', 'Notifications', 'UploadAssignment', 'CurriculumTwin', 'AssignmentSubmissions', 'Passport', 'PlatformHub', 'Support', 'LearnStudio', 'CourseOS', 'ProjectWorkspace'];
  for (const p of pages) {
    const src = await readFile(new URL(`../src/pages/${p}.tsx`, import.meta.url), 'utf8');
    assert.equal((src.match(/\bduo-book\b/g) ?? []).length, 1, `${p}: duo-book`);
    assert.equal((src.match(/\bduo-aside\b/g) ?? []).length, 1, `${p}: duo-aside`);
  }
  // the top-bar tools wrapper is display:contents everywhere but the spread
  const layout = await readFile(new URL('../src/components/Layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /className="topbar-tools contents"/);
});

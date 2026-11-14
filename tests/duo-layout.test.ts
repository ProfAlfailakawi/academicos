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

const BOOK = 'screen and (min-width: 721px) and (max-width: 1000px) and (min-height: 520px) and (max-height: 960px) and (orientation: landscape)';

test('book spread: the opened Duo reads as two pages around a spine (screen only, no posture queries)', async () => {
  const s = await css('duo-edges.css');
  assert.ok(s.split(`@media ${BOOK} {`).length - 1 >= 2, 'book query for the shell and the public side');
  assert.match(s, /--spine: 32px;/);
  assert.match(s, /--pg: calc\(50vw - var\(--spine\) \/ 2\);/);
  // the top bar is split: search on the reading page, tools on the context page
  assert.match(s, /\.app-topbar \.topbar-tools \{\s*position: absolute;/);
  // pages bring their context; one grid row track absorbs a tall context page
  assert.match(s, /\.duo-book \{\s*display: grid;[\s\S]*?grid-template-rows: repeat\(14, auto\) 1fr;/);
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
  assert.match(block, /\.app-shell \.app-topbar \{\s*position: fixed; top: auto; bottom: 0;/);
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

test('book/laptop layers: no stacked !important — each one answers an existing !important and says which', async () => {
  const s = await css('duo-edges.css');
  const fresh = s.slice(s.indexOf('7) Book spread'));
  const lines = fresh.split('\n').filter((l) => l.includes('!important'));
  assert.ok(lines.length <= 24, `${lines.length} !important in the book/laptop layers`);
  for (const l of lines) assert.match(l, /\/\* !important: .+ \*\//, l.trim());
});

/** Evaluate one simple `screen and (min/max-width|height) and (orientation)` query for a viewport. */
function matches(query: string, w: number, h: number): boolean {
  return query.split(',').some((part) => part.split(' and ').every((c) => {
    c = c.trim();
    if (c === 'screen') return true;
    const m = c.match(/^\((min|max)-(width|height): ([\d.]+)px\)$/);
    if (m) { const v = m[2] === 'width' ? w : h; return m[1] === 'min' ? v >= Number(m[3]) : v <= Number(m[3]); }
    const o = c.match(/^\(orientation: (landscape|portrait)\)$/);
    if (o) return (o[1] === 'landscape') === (w >= h);
    throw new Error(`unsupported condition ${c}`);
  }));
}

test('book = landscape only: portrait inner screen is a single column, iPads and phones are untouched', async () => {
  const s = await css('duo-edges.css');
  const spreads = (s.match(/@media[^{]*min-width: 721px[^{]*\{/g) ?? []).filter((q) => q.includes('min-height: 520px') && !q.includes('display-mode'));
  assert.ok(spreads.length >= 2, 'book queries found');
  for (const q of spreads) assert.equal(q.replace(/^@media /, '').replace(/\s*\{$/, ''), BOOK);
  // no book/spread branch for 640-720 portrait survives in any stylesheet
  for (const f of ['duo-edges.css', 'beauty.css', 'duo.css', 'index.css']) {
    const t = await css(f);
    assert.doesNotMatch(t.replace(/\/\*[\s\S]*?\*\//g, ''), /min-aspect-ratio: 4\/3/, f);
  }
  const book = BOOK.replace(/^@media /, '');
  for (const [w, h] of [[951, 669], [951, 585], [722, 585], [880, 700], [1000, 600], [722, 521], [960, 940]]) assert.ok(matches(book, w, h), `${w}x${h} is a book`);
  for (const [w, h] of [[669, 867], [720, 900], [660, 800], [382, 580], [367, 740], [390, 844], [844, 390], [951, 350], [744, 1024], [768, 1024], [834, 1194], [1024, 768], [1280, 800], [1440, 900]]) assert.ok(!matches(book, w, h), `${w}x${h} is not a book`);
  // laptop posture is height-driven and screen-scoped
  for (const q of s.match(/@media[^{]*max-height: 420px[^{]*\{/g) ?? []) assert.match(q, /^@media screen and /, q);
  const beauty = await css('beauty.css');
  assert.doesNotMatch(beauty, /min-width: 761px/);
});

test('system widget keep-out: one token pair, inside DUO INNER + standalone only, physical right', async () => {
  const s = await css('duo-edges.css');
  const defs = s.match(/--duo-cutout-w: 116px; --duo-cutout-h: 116px;/g) ?? [];
  assert.equal(defs.length, 1, 'tokens defined once');
  const at = s.indexOf('--duo-cutout-w: 116px');
  const head = s.slice(s.lastIndexOf('@media', at), at);
  const BOOKQ = 'screen and (display-mode: standalone) and (min-width: 721px) and (max-width: 1000px) and (min-height: 520px) and (max-height: 960px) and (orientation: landscape)';
  const PORTQ = 'screen and (display-mode: standalone) and (min-width: 640px) and (max-width: 720px) and (min-height: 520px) and (max-height: 960px) and (orientation: portrait)';
  assert.ok(head.includes(BOOKQ) && head.includes(PORTQ), 'keep-out scope');
  // every keep-out rule block is standalone-only, so ordinary browsers and phones never reserve the corner
  const sec = s.slice(s.indexOf('10) System widget keep-out'));
  for (const q of sec.match(/@media [^{]*\{/g) ?? []) assert.match(q, /display-mode: standalone/, q);
  assert.match(sec, /--bar-h: var\(--duo-cutout-h\)/);
  assert.match(sec, /padding-right: calc\(var\(--pg-edge\) \+ var\(--duo-cutout-w\)\)/);
  assert.match(sec, /\.app-shell \.app-sidebar--desktop \{ padding-top: calc\(var\(--duo-cutout-h\)/);
});

test('book pages size from the page: counters and rows follow the ~430px page, not the 951px window', async () => {
  const s = await css('duo-edges.css');
  assert.match(s, /\.duo-book \.grid\.grid-cols-3:not\(\.notif-rings\) \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  assert.match(s, /\.app-main \.studio-head \{ flex-direction: column;/);
  assert.match(s, /\.duo-aside \.workspace-more > div \{ position: static;/);
});

test('narrow phones (320-382px): grids cannot be widened by a child, toolbars wrap instead of hiding actions', async () => {
  const index = await css('index.css');
  // an implicit auto column (md:grid-cols-N only) grew to its widest child and clipped forms on the folded screen
  assert.match(index, /\.grid:not\(\[class\*="grid-flow-"\], \[class\*="auto-cols-"\]\) > \* \{ min-width: 0; \}/);
  const brand = await css('styles/brand.css');
  assert.match(brand, /\.onboard-shell \{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(brand, /\.onboard-shell > \* \{ min-width: 0; \}/);
  const studio = await readFile(new URL('../src/components/project/ProjectWriterStudio.tsx', import.meta.url), 'utf8');
  assert.match(studio, /writer-toolbar[^"]*flex flex-wrap md:flex-nowrap/);
});

test('wrapped (non-ellipsis) .truncate items can still shrink inside flex rows', async () => {
  const index = await css('index.css');
  assert.match(index, /\.app-main \.truncate:not\(\.keep-truncate\) \{[^}]*min-width: 0;/);
});

test('workspace "more" summary shrinks to the screen and ellipsizes the active tool name', async () => {
  const index = await css('index.css');
  assert.match(index, /\.workspace-more > summary \{ max-width: 100%; \}/);
  assert.match(index, /\.workspace-more__current \{[^}]*text-overflow: ellipsis/);
});

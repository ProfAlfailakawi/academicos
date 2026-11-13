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

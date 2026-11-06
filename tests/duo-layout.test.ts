import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = async (f: string) => readFile(new URL(`../src/${f}`, import.meta.url), 'utf8');

test('Duo layout is width-based: no posture or viewport-segment queries decide layout', async () => {
  for (const f of ['index.css', 'duo.css', 'final-polish.css', 'motion.css']) {
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { buildScriptSrc } from '../src/server/security-controls';

test('production script-src drops unsafe-inline but keeps reCAPTCHA hosts', () => {
  const prod = buildScriptSrc(true, true);
  assert.doesNotMatch(prod, /'unsafe-inline'/);
  assert.match(prod, /'unsafe-eval'/);
  assert.match(prod, /https:\/\/www\.google\.com/);
  assert.match(prod, /https:\/\/www\.gstatic\.com/);
  assert.match(prod, /https:\/\/www\.recaptcha\.net/);
  assert.doesNotMatch(buildScriptSrc(true, false), /'unsafe-eval'/);
  // Vite's React refresh preamble is inline in development only.
  assert.match(buildScriptSrc(false, true), /'unsafe-inline'/);
});

test('index.html ships no inline scripts and defaults to Arabic RTL', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<html lang="ar" dir="rtl">/);
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/gi)];
  assert.equal(inline.length, 0, 'every <script> in index.html must use src=');
  for (const file of ['locale-bootstrap.js', 'theme-bootstrap.js', 'boot-splash.js']) {
    assert.match(html, new RegExp(`<script src="/${file.replace('.', '\\.')}"></script>`));
  }
  // The splash controller needs #acos-boot to exist when it runs.
  assert.ok(html.indexOf('id="acos-boot"') < html.indexOf('/boot-splash.js'));
});

async function runBootstrap(opts: { saved?: string | null; languages?: string[]; throws?: boolean }) {
  const source = await readFile(new URL('../public/locale-bootstrap.js', import.meta.url), 'utf8');
  const root: any = { lang: 'ar', dir: 'rtl', dataset: {} };
  const context = {
    document: { documentElement: root },
    navigator: { languages: opts.languages || [], language: (opts.languages || [])[0] },
    localStorage: {
      getItem: () => {
        if (opts.throws) throw new Error('blocked');
        return opts.saved ?? null;
      },
    },
  };
  vm.runInNewContext(source, context);
  return root;
}

test('locale bootstrap switches direction per locale with an Arabic fallback', async () => {
  assert.deepEqual(await runBootstrap({ languages: ['en-US'] }).then((r) => [r.lang, r.dir]), ['en', 'ltr']);
  assert.deepEqual(await runBootstrap({ languages: ['fr-FR', 'en'] }).then((r) => [r.lang, r.dir]), ['fr', 'ltr']);
  assert.deepEqual(await runBootstrap({ languages: ['ur-PK'] }).then((r) => [r.lang, r.dir]), ['ur', 'rtl']);
  assert.deepEqual(await runBootstrap({ languages: ['ar-KW', 'en'] }).then((r) => [r.lang, r.dir]), ['ar', 'rtl']);
  assert.deepEqual(await runBootstrap({ languages: ['de-DE'] }).then((r) => [r.lang, r.dir]), ['ar', 'rtl']);
  assert.deepEqual(await runBootstrap({ saved: 'tr', languages: ['ar'] }).then((r) => [r.lang, r.dir]), ['tr', 'ltr']);
  assert.deepEqual(await runBootstrap({ throws: true }).then((r) => [r.lang, r.dir]), ['ar', 'rtl']);
});

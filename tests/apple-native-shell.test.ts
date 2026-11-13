import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAppleNativeShell } from '../src/lib/platform';
import { ApiError } from '../src/lib/api';
import { localizedUiError } from '../src/lib/ui-error';

const g = globalThis as { window?: unknown };
function withWindow(win: unknown, run: () => void) {
  const previous = g.window;
  g.window = win;
  try { run(); } finally { if (previous === undefined) delete g.window; else g.window = previous; }
}
const cap = (native: boolean, platform: string) => ({ Capacitor: { isNativePlatform: () => native, getPlatform: () => platform } });

test('isAppleNativeShell is true only for native Capacitor on iOS', () => {
  assert.equal(isAppleNativeShell(), false); // no window (SSR/tests)
  withWindow({}, () => assert.equal(isAppleNativeShell(), false)); // normal website
  withWindow(cap(true, 'ios'), () => assert.equal(isAppleNativeShell(), true));
  withWindow(cap(true, 'android'), () => assert.equal(isAppleNativeShell(), false));
  withWindow(cap(false, 'web'), () => assert.equal(isAppleNativeShell(), false));
  withWindow({ Capacitor: {} }, () => assert.equal(isAppleNativeShell(), false));
});

test('plan-required errors do not point to the Plans page inside the iOS app', () => {
  const t = (key: string) => key;
  const err = new ApiError('x', 402, 'WRITER_PLAN_REQUIRED');
  assert.equal(localizedUiError(err, t), 'ui.error.planRequired');
  withWindow(cap(true, 'ios'), () => assert.equal(localizedUiError(err, t), 'ui.error.planRequiredNative'));
});

test('purchase surfaces are gated on isAppleNativeShell', () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  assert.match(read('src/pages/Plans.tsx'), /if \(isAppleNativeShell\(\)\) \{[\s\S]*plans\.nativeManaged/);
  assert.match(read('src/pages/PublicHome.tsx'), /\{!appleShell && \(\s*<section id="pricing"/);
  assert.match(read('src/components/Layout.tsx'), /isAppleNativeShell\(\)[\s\S]*item\.to !== "\/app\/plans"/);
  assert.match(read('src/pages/Settings.tsx'), /!isAppleNativeShell\(\) && \(\s*<Card/);
  assert.match(read('src/pages/PublicPage.tsx'), /slug === "pricing" && isAppleNativeShell\(\)/);
});

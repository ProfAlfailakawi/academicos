import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveInstallTarget, APP_STORE_URL } from '../src/lib/install-target';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

test('iOS native shell never shows the install prompt', () => {
  assert.deepEqual(resolveInstallTarget({ userAgent: IPHONE, nativeIosShell: true }), { kind: 'none' });
});
test('iPhone and iPad browsers open the App Store', () => {
  assert.deepEqual(resolveInstallTarget({ userAgent: IPHONE }), { kind: 'store', url: APP_STORE_URL });
  assert.deepEqual(resolveInstallTarget({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 }), { kind: 'store', url: APP_STORE_URL });
  assert.equal(resolveInstallTarget({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 }).kind, 'pwa');
});
test('Android keeps the PWA prompt until a Play URL is set', () => {
  assert.deepEqual(resolveInstallTarget({ userAgent: ANDROID }), { kind: 'pwa' });
  assert.deepEqual(resolveInstallTarget({ userAgent: ANDROID, playStoreUrl: 'https://play.google.com/store/apps/details?id=x' }), { kind: 'store', url: 'https://play.google.com/store/apps/details?id=x' });
});
test('desktop is unchanged', () => {
  assert.deepEqual(resolveInstallTarget({ userAgent: DESKTOP }), { kind: 'pwa' });
  assert.deepEqual(resolveInstallTarget({}), { kind: 'pwa' });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nativeTextOverride } from '../src/lib/native-text';
import { speechRecognitionSupported, startDictation } from '../src/lib/speech';

const g = globalThis as { window?: unknown };
function withWindow(win: unknown, run: () => void) {
  const previous = g.window;
  g.window = win;
  try { run(); } finally { if (previous === undefined) delete g.window; else g.window = previous; }
}
const ios = { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' }, webkitSpeechRecognition: function () {} };
const web = { webkitSpeechRecognition: function () {} };
const keys = ['upload.errClipboard', 'upload.errDictationUnsupported', 'upload.clipboardDenied', 'upload.dictationUnsupported', 'mission.voiceUnsupported', 'viva.voiceUnsupported'];

test('in the iOS app, browser wording is replaced by "this device" (ar, en)', () => {
  withWindow(ios, () => {
    for (const k of keys) {
      assert.match(nativeTextOverride(k, 'ar')!, /هذا الجهاز|الجهاز/);
      assert.doesNotMatch(nativeTextOverride(k, 'ar')!, /المتصفح/);
      assert.doesNotMatch(nativeTextOverride(k, 'en')!, /browser/i);
    }
    assert.equal(nativeTextOverride(keys[0], 'fr'), undefined);
    assert.equal(nativeTextOverride('other.key', 'ar'), undefined);
  });
});

test('in the browser, no override: original strings are used', () => {
  assert.equal(nativeTextOverride(keys[0], 'ar'), undefined);
  withWindow(web, () => { for (const k of keys) assert.equal(nativeTextOverride(k, 'ar'), undefined); });
});

test('dictation is unavailable in the iOS app and unchanged in the browser', () => {
  withWindow(ios, () => {
    assert.equal(speechRecognitionSupported(), false);
    let err = '';
    startDictation(['ar'], { onFinal() {}, onError: (c) => { err = c; } });
    assert.equal(err, 'unsupported');
  });
  withWindow(web, () => assert.equal(speechRecognitionSupported(), true));
});

test('dictation controls are hidden when native', () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  assert.match(read('src/pages/MissionControl.tsx'), /\{!isAppleNativeShell\(\) && <ToolButton icon=\{listening\?LoaderCircle:Mic2\}/);
  assert.match(read('src/components/project/VivaStudio.tsx'), /\{!isAppleNativeShell\(\) && <Button variant=\{listening/);
});

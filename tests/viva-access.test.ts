import test from 'node:test';
import assert from 'node:assert/strict';
import { questionSeconds } from '../src/lib/viva-access';
import { speechRecognitionLangs } from '../src/lib/speech';

test('extended time scales the per-question budget and "off" disables the timer', () => {
  assert.equal(questionSeconds('normal', 'off'), null);
  assert.equal(questionSeconds('normal', 'standard'), 180);
  assert.equal(questionSeconds('normal', 'extended150'), 270);
  assert.equal(questionSeconds('strict', 'extended200'), 240);
});

test('Arabic dictation prefers ar-KW with Arabic fallbacks; others use their tag then base language', () => {
  assert.deepEqual(speechRecognitionLangs('ar', 'ar-SA'), ['ar-KW', 'ar-SA', 'ar-AE', 'ar-EG', 'ar']);
  assert.deepEqual(speechRecognitionLangs('en', 'en-US'), ['en-US', 'en']);
  assert.deepEqual(speechRecognitionLangs('ur', 'ur-PK'), ['ur-PK', 'ur-IN', 'ur']);
});

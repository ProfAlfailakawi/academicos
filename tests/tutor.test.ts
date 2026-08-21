import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTutorRequest, toLesson, nativeTutorScaffold, tutorPlatformInstruction } from '../src/server/tutor';

test('Tutor request is Khan-style, language-aware, and integrity-safe', () => {
  const req = buildTutorRequest({ topic: 'المشتقات في التفاضل', language: 'العربية', level: 'beginner' });
  assert.equal(req.taskType, 'concept_explanation');
  assert.equal(req.agent, 'khan_tutor');
  assert.ok(/العربية/.test(req.platformInstruction || ''));
  // لا يكتب واجبًا قابلًا للتسليم
  assert.ok(/not answer the learner's own gradable assignment|submittable/i.test(req.platformInstruction || ''));
});

test('Tutor supports any language via explicit instruction', () => {
  for (const lang of ['English', 'Français', 'Español', '中文', 'العربية']) {
    assert.ok(tutorPlatformInstruction(lang, 'beginner').includes(lang));
  }
});

test('toLesson maps AI output into a structured lesson', () => {
  const lesson = toLesson('Derivatives', 'English', 'beginner', {
    summary: 'A derivative measures instantaneous rate of change.',
    findings: ['Start with average rate over an interval', 'Shrink the interval to zero'],
    suggestions: ['What is the derivative of x^2?', 'Explain slope in your own words'],
    warnings: ['Confusing average and instantaneous rate'],
  });
  assert.equal(lesson.source, 'ai');
  assert.ok(lesson.intuition.length > 0);
  assert.equal(lesson.buildingBlocks.length, 2);
  assert.equal(lesson.checkYourself.length, 2);
  assert.equal(lesson.commonMistakes.length, 1);
});

test('Native scaffold is honest when no AI provider is configured', () => {
  const s = nativeTutorScaffold('الجبر الخطي', 'العربية', 'beginner');
  assert.equal(s.source, 'scaffold');
  assert.ok(s.notice && /مزوّد ذكاء اصطناعي/.test(s.notice));
  assert.ok(s.buildingBlocks.length > 0); // بنية بلا اختلاق محتوى الموضوع
});

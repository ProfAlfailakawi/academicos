// AcademicOS Tutor — شرح احترافي بأسلوب "خان أكاديمي" عبر معلّم ذكاء اصطناعي.
//
// الفكرة: بوابة تعلّم إبداعية للجميع — الطالب يطلب موضوعًا، فيشرحه معلّم AI بأسلوب
// تدرّجي (حدس → بناء المفهوم → مثال محلول → أسئلة تحقّق ذاتي) بأي لغة يطلبها.
//
// مبادئ:
//  - يشرح المفهوم، ولا يكتب واجب الطالب القابل للتسليم (نزاهة أكاديمية).
//  - يعيد استخدام بوابة الـAI القائمة (runAcademicTask) دون تغييرها.
//  - عند غياب مزوّد AI: يعيد هيكل درس صادقًا (سقالة) بلا اختلاق محتوى.
//  - يدعم أي لغة عبر توجيه النموذج صراحةً باللغة المطلوبة.

import type { AcademicTaskInput, AcademicTaskOutput } from './ai';

export interface TutorLesson {
  topic: string;
  language: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  intuition: string;              // الحدس/الصورة الكبيرة
  buildingBlocks: string[];       // خطوات بناء المفهوم بالتدريج
  workedExample: string[];        // مثال محلول خطوة بخطوة
  checkYourself: string[];        // أسئلة تحقّق ذاتي (بلا حل الواجب)
  commonMistakes: string[];       // أخطاء شائعة/تنبيهات
  source: 'ai' | 'scaffold';
  notice?: string;
}

const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
function normLevel(v?: string): TutorLesson['level'] {
  return (LEVELS as readonly string[]).includes(String(v)) ? (v as TutorLesson['level']) : 'beginner';
}
function clip(s: unknown, n: number) { return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n); }

// توجيه المنصّة: أسلوب خان + اللغة + النزاهة الأكاديمية.
export function tutorPlatformInstruction(language: string, level: string): string {
  return [
    `Teach in the style of Khan Academy: warm, patient, one idea at a time, from intuition to formal understanding.`,
    `Respond entirely in this language: ${language}. Use correct terminology for that language.`,
    `Target level: ${level}.`,
    `Structure your answer as JSON: summary = a short intuitive "big picture" of the concept; findings = the concept built up in ordered small steps; suggestions = 3-6 self-check questions the learner can try (do NOT answer the learner's own gradable assignment or produce submittable work — teach the concept only); warnings = common mistakes and misconceptions.`,
    `Never fabricate facts, sources, or data. If the topic is ambiguous, teach the most standard interpretation and say so.`,
  ].join(' ');
}

// يبني طلب المهمة (نقي/حتمي) لبوابة الـAI.
export function buildTutorRequest(input: { topic: string; language?: string; level?: string; context?: string }): AcademicTaskInput {
  const language = clip(input.language, 40) || 'العربية';
  const level = normLevel(input.level);
  const topic = clip(input.topic, 600);
  return {
    taskType: 'concept_explanation',
    agent: 'khan_tutor',
    projectContext: { topic, language, level, note: 'standalone concept explanation, not a gradable deliverable' },
    learnerInstruction: `اشرح لي هذا الموضوع بأسلوب تعليمي متدرّج: ${topic}${input.context ? `\nسياق إضافي: ${clip(input.context, 600)}` : ''}`,
    platformInstruction: tutorPlatformInstruction(language, level),
    policySummary: 'شرح مفاهيمي تعليمي مستقل — لا يُنتج عملًا قابلًا للتسليم نيابة عن الطالب.',
  };
}

// يحوّل مخرج المهمة إلى درس منظّم.
export function toLesson(topic: string, language: string, level: string, output: AcademicTaskOutput): TutorLesson {
  return {
    topic: clip(topic, 300),
    language: clip(language, 40) || 'العربية',
    level: normLevel(level),
    intuition: clip(output.summary, 4000),
    buildingBlocks: (output.findings || []).map(x => clip(x, 800)).filter(Boolean).slice(0, 20),
    workedExample: [],
    checkYourself: (output.suggestions || []).map(x => clip(x, 500)).filter(Boolean).slice(0, 8),
    commonMistakes: (output.warnings || []).map(x => clip(x, 500)).filter(Boolean).slice(0, 10),
    source: 'ai',
  };
}

// سقالة صادقة عند غياب مزوّد AI — بلا اختلاق محتوى الموضوع.
export function nativeTutorScaffold(topic: string, language?: string, level?: string): TutorLesson {
  const t = clip(topic, 300) || 'الموضوع';
  return {
    topic: t,
    language: clip(language, 40) || 'العربية',
    level: normLevel(level),
    intuition: `لا يوجد معلّم ذكاء اصطناعي مُهيّأ حاليًا، لذا لا يمكن توليد شرح كامل لـ«${t}». هذا هيكل تعلّم لتبدأ به يدويًا.`,
    buildingBlocks: [
      'عرّف المفهوم بجملة واحدة بكلماتك الخاصة.',
      'اربطه بمثال يومي بسيط يقرّب الفكرة.',
      'فكّك المفهوم إلى مكوّناته الأساسية بالترتيب.',
      'اكتب مثالًا محلولًا خطوة بخطوة.',
    ],
    workedExample: [],
    checkYourself: [
      'هل أستطيع شرح المفهوم لزميل بلا مصطلحات معقّدة؟',
      'ما مثالٌ جديد أطبّق عليه المفهوم؟',
      'ما الخطأ الشائع الذي قد أقع فيه هنا؟',
    ],
    commonMistakes: ['الاعتماد على الحفظ دون فهم الحدس وراء المفهوم.'],
    source: 'scaffold',
    notice: 'شرح مؤقت (سقالة). هيّئ مزوّد ذكاء اصطناعي للحصول على شرح كامل بأسلوب خان أكاديمي.',
  };
}

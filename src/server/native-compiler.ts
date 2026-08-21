// AcademicOS Native Compiler — شبكة أمان حتمية عندما لا يوجد مزوّد AI مُهيّأ.
//
// الغرض: ألا ينكسر تدفّق الطالب (لصق نص → مشروع) عند غياب/انقطاع مزوّد الذكاء الاصطناعي.
// هذا المُجمِّع استدلالي (heuristic) وحتمي: لا يزعم فهمًا عميقًا كالـAI؛ ينتج ParsedAssignment
// قابلًا للعمل مع وسم كل شيء منخفض الثقة/يحتاج تأكيدًا، متسقًا مع مبدأ الصدق في المنتج.
//
// عند توفر مزوّد AI، لا يُستخدم هذا المسار إطلاقًا — الـAI هو الأساس.

import type { ParsedAssignment } from './project-engine';

function lines(text: string): string[] {
  return String(text || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
}
function clip(s: string, n: number) { return s.replace(/\s+/g, ' ').trim().slice(0, n); }
function has(text: string, terms: string[]) { const l = text.toLowerCase(); return terms.some(t => l.includes(t.toLowerCase())); }

// أفعال المهام: عربي + إنجليزي → رمز إجراء
const ACTION_KEYWORDS: Array<{ action: string; terms: string[] }> = [
  { action: 'RESEARCH', terms: ['بحث', 'مصادر', 'مراجع', 'research', 'sources', 'literature', 'references'] },
  { action: 'WRITE', terms: ['اكتب', 'تقرير', 'مقال', 'مقالة', 'كتابة', 'write', 'report', 'essay', 'paper', 'document'] },
  { action: 'ANALYZE', terms: ['حلل', 'تحليل', 'ناقش', 'analyze', 'analyse', 'analysis', 'discuss', 'evaluate', 'قيّم'] },
  { action: 'CALCULATE', terms: ['احسب', 'حساب', 'معادلة', 'calculate', 'compute', 'equation', 'statistics', 'إحصاء'] },
  { action: 'CODE', terms: ['برمج', 'كود', 'برنامج', 'code', 'program', 'implement', 'algorithm', 'خوارزمية'] },
  { action: 'DESIGN', terms: ['صمم', 'تصميم', 'design', 'prototype', 'wireframe', 'mockup'] },
  { action: 'BUILD', terms: ['ابن', 'نموذج', 'منتج', 'build', 'construct', 'model', 'prototype'] },
  { action: 'TEST', terms: ['اختبر', 'اختبار', 'test', 'validate', 'verify', 'تحقق'] },
  { action: 'PRESENT', terms: ['عرض', 'قدّم', 'شرائح', 'present', 'presentation', 'slides', 'deck'] },
  { action: 'SURVEY', terms: ['استبيان', 'استبانة', 'survey', 'questionnaire'] },
  { action: 'LAB', terms: ['مختبر', 'معمل', 'تجربة', 'lab', 'experiment'] },
  { action: 'REFLECT', terms: ['تأمل', 'انعكاس', 'reflection', 'reflect'] },
];

const DELIVERABLE_KEYWORDS: Array<{ title: string; format: string; terms: string[] }> = [
  { title: 'تقرير مكتوب', format: 'document', terms: ['تقرير', 'report', 'مقال', 'essay', 'paper', 'word', 'docx'] },
  { title: 'عرض تقديمي', format: 'presentation', terms: ['عرض', 'presentation', 'slides', 'pptx', 'powerpoint', 'شرائح'] },
  { title: 'ملف PDF', format: 'pdf', terms: ['pdf'] },
  { title: 'كود / مستودع', format: 'code', terms: ['كود', 'code', 'repository', 'github', 'مستودع', 'notebook'] },
  { title: 'جدول بيانات', format: 'spreadsheet', terms: ['جدول', 'spreadsheet', 'excel', 'xlsx', 'مصنف'] },
  { title: 'ملصق علمي', format: 'poster', terms: ['ملصق', 'poster'] },
  { title: 'فيديو', format: 'media', terms: ['فيديو', 'video', 'تسجيل'] },
];

const CITATION_STYLES: Array<{ style: string; terms: string[] }> = [
  { style: 'APA', terms: ['apa'] }, { style: 'MLA', terms: ['mla'] }, { style: 'Chicago', terms: ['chicago'] },
  { style: 'Harvard', terms: ['harvard', 'هارفارد'] }, { style: 'IEEE', terms: ['ieee'] }, { style: 'Vancouver', terms: ['vancouver'] },
];

const DOMAIN_KEYWORDS: Array<{ domain: string; terms: string[] }> = [
  { domain: 'Engineering', terms: ['هندسة', 'engineering', 'mechanic', 'circuit', 'structural', 'ميكانيك', 'دائرة'] },
  { domain: 'Computer Science', terms: ['برمجة', 'حاسوب', 'computer', 'software', 'algorithm', 'data structure', 'خوارزمية'] },
  { domain: 'Medicine', terms: ['طب', 'سريري', 'medicine', 'clinical', 'patient', 'مريض', 'تشخيص', 'diagnosis'] },
  { domain: 'Law', terms: ['قانون', 'حكم', 'law', 'legal', 'statute', 'قضية', 'case law', 'دعوى'] },
  { domain: 'Business', terms: ['أعمال', 'تسويق', 'business', 'marketing', 'management', 'إدارة', 'strategy'] },
  { domain: 'Statistics', terms: ['إحصاء', 'statistics', 'regression', 'hypothesis', 'انحدار', 'عينة', 'probability'] },
  { domain: 'Literature', terms: ['أدب', 'نص أدبي', 'literature', 'poem', 'novel', 'رواية', 'قصيدة', 'نقد'] },
  { domain: 'Science', terms: ['كيمياء', 'فيزياء', 'أحياء', 'chemistry', 'physics', 'biology', 'مختبر'] },
];

// بناء تاريخ UTC مع التحقق من صحة round-trip (يرفض 45/13/2025 بدل تدويره صامتًا).
function makeUtcDate(y: number, m: number, d: number): string | undefined {
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) return dt.toISOString();
  return undefined;
}
// كشف موعد بسيط: ISO أو dd/mm/yyyy أو "خلال N يوم/أسبوع".
function detectDeadline(text: string, now = Date.now()): string | undefined {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2})?\b/);
  if (iso) { const dt = makeUtcDate(Number(iso[1]), Number(iso[2]), Number(iso[3])); if (dt) return dt; }
  const dmy = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})\b/);
  if (dmy) { const dt = makeUtcDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1])); if (dt) return dt; }
  const rel = text.match(/(?:خلال|بعد|within|in)\s+(\d{1,3})\s*(يوم|أيام|day|days|أسبوع|weeks?|اسبوع)/i);
  if (rel) { const n = Number(rel[1]); const weeks = /أسبوع|week|اسبوع/i.test(rel[2]); return new Date(now + n * (weeks ? 7 : 1) * 86400000).toISOString(); }
  return undefined;
}

export function compileAssignmentNative(input: { text: string; timezone?: string }, now = Date.now()): ParsedAssignment {
  const text = String(input.text || '');
  const ls = lines(text);
  const title = clip(ls[0] || '', 160) || 'تكليف بلا عنوان — يحتاج تأكيد';

  const actions = ACTION_KEYWORDS.filter(a => has(text, a.terms)).map(a => a.action);
  const requiredActions = actions.length ? [...new Set(actions)] : ['RESEARCH', 'WRITE', 'PRESENT'];

  const deliverables = DELIVERABLE_KEYWORDS.filter(d => has(text, d.terms)).map(d => ({
    title: d.title, format: d.format, requirementSource: 'استُخرج محليًا من النص (يحتاج تأكيد)',
  }));

  // Rubric: كل نسبة مئوية في النص (قد توجد عدة نسب في سطر واحد)
  const rubric: Array<{ title: string; description: string; weighting: number }> = [];
  const seenWeights: string[] = [];
  for (const m of text.matchAll(/([؀-ۿA-Za-z][؀-ۿA-Za-z \-_]{1,60}?)\s*[:：،-]?\s*(\d{1,3})\s*%/g)) {
    const w = Number(m[2]);
    if (!(w > 0 && w <= 100)) continue;
    const title = clip(m[1], 120) || 'معيار';
    const key = `${title}|${w}`;
    if (seenWeights.includes(key)) continue;
    seenWeights.push(key);
    rubric.push({ title, description: '', weighting: w });
    if (rubric.length >= 20) break;
  }

  const citation = CITATION_STYLES.find(c => has(text, c.terms))?.style;
  const domain = DOMAIN_KEYWORDS.find(d => has(text, d.terms))?.domain || 'General';
  const deadline = detectDeadline(text, now);
  const group = has(text, ['مجموعة', 'جماعي', 'فريق', 'group', 'team']);
  const len = text.length;
  const complexity: 'low' | 'medium' | 'high' = len > 2500 || requiredActions.length >= 5 ? 'high' : len < 400 ? 'low' : 'medium';

  const projectType = has(text, ['عرض', 'presentation', 'slides']) ? 'Presentation'
    : has(text, ['كود', 'code', 'program', 'برمج']) ? 'Software project'
    : has(text, ['بحث', 'research', 'paper']) ? 'Research paper'
    : 'Report';

  const riskFlags: string[] = ['تم التوليد بالمُجمِّع المحلي بلا مزوّد ذكاء اصطناعي — راجع كل الحقول قبل الاعتماد.'];
  if (!deadline) riskFlags.push('لم يُكتشف موعد نهائي في النص — أضف الموعد يدويًا.');
  if (!rubric.length) riskFlags.push('لم يُكتشف Rubric بنسب — أكّد معايير التقييم.');
  if (!deliverables.length) riskFlags.push('لم تُكتشف مخرجات صريحة — أكّد التسليمات المطلوبة.');

  return {
    title,
    course: 'المقرر غير محدد',
    projectType,
    academicDomain: domain,
    complexity,
    collaborationMode: group ? 'group' : 'individual',
    requiredSkills: [],
    learningOutcomes: [],
    requiredActions,
    deliverables: deliverables.length ? deliverables : [{ title: 'التسليم النهائي', format: 'Needs confirmation' }],
    requirements: [
      { label: 'مصدر التحليل', value: 'مُجمِّع محلي حتمي (بدون AI)', category: 'other', confidence: 'needs_confirmation', source: 'native-compiler' },
      ...(deadline ? [{ label: 'الموعد النهائي', value: deadline, category: 'deadline' as const, confidence: 'needs_confirmation' as const }] : []),
      ...(citation ? [{ label: 'نمط الاستشهاد', value: citation, category: 'format' as const, confidence: 'medium' as const }] : []),
    ],
    rubric,
    deadline,
    deadlineTimezone: input.timezone,
    citationStyle: citation,
    softwareRequirements: [],
    aiPolicy: { level: 0, summary: 'سياسة غير موثقة — استخراج محلي بلا AI.', needsConfirmation: true },
    riskFlags,
    estimatedWorkloadHours: undefined,
  };
}

import { randomUUID } from 'node:crypto';
import type { AIUsagePolicy, Deliverable, ProjectDNA, ProjectTask, Requirement, RubricCriterion, WorkspaceModule } from '../types';

export interface ParsedAssignment {
  title?: string;
  course?: string;
  instructor?: string;
  projectType?: string;
  academicDomain?: string;
  complexity?: 'low' | 'medium' | 'high';
  collaborationMode?: 'individual' | 'group';
  requiredSkills?: string[];
  learningOutcomes?: string[];
  requiredActions?: string[];
  deliverables?: Array<{ title?: string; format?: string; deadline?: string; validationRules?: string[]; requirementSource?: string }>;
  requirements?: Array<{ label?: string; value?: string; category?: Requirement['category']; confidence?: Requirement['confidence']; source?: string }>;
  rubric?: Array<{ title?: string; description?: string; weighting?: number }>;
  deadline?: string;
  deadlineTimezone?: string;
  milestones?: Array<{ title?: string; date?: string }>;
  citationStyle?: string;
  softwareRequirements?: string[];
  aiPolicy?: Partial<AIUsagePolicy>;
  riskFlags?: string[];
  estimatedWorkloadHours?: number;
}


function clean(value: unknown, max = 240): string {
  return String(value ?? '').replace(/\x00/g, '').trim().slice(0, max);
}
function cleanList(values: unknown, maxItems: number, maxChars = 160): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(v => clean(v, maxChars)).filter(Boolean))].slice(0, maxItems);
}

const actionModuleMap: Record<string, WorkspaceModule> = {
  RESEARCH: 'research', WRITE: 'writing', CALCULATE: 'data', ANALYZE: 'data', CODE: 'code', DESIGN: 'design', BUILD: 'engineering', TEST: 'code', PRESENT: 'presentation', DEFEND: 'viva', REFLECT: 'writing', SURVEY: 'survey', COLLABORATE: 'team', SIMULATE: 'simulation', PORTFOLIO: 'portfolio', LAB: 'lab', SPREADSHEET: 'spreadsheet', MEDIA: 'media',
};

function normalizeActions(actions: unknown): string[] {
  if (!Array.isArray(actions)) return [];
  return [...new Set(actions.map(v => String(v).trim().toUpperCase()).filter(Boolean))].slice(0, 24);
}

function modulesFor(actions: string[], projectType: string): WorkspaceModule[] {
  const modules = new Set<WorkspaceModule>();
  actions.forEach(action => actionModuleMap[action] && modules.add(actionModuleMap[action]));
  const lower = projectType.toLowerCase();
  if (lower.includes('report') || lower.includes('essay') || lower.includes('paper')) modules.add('writing');
  if (lower.includes('presentation')) modules.add('presentation');
  if (lower.includes('group') || lower.includes('team')) modules.add('team');
  if (!modules.size) modules.add('writing');
  modules.add('viva');
  return [...modules];
}

function normalizePolicy(policy?: Partial<AIUsagePolicy>): AIUsagePolicy {
  const rawLevel = Number(policy?.level ?? 2);
  const level = (Number.isFinite(rawLevel) ? Math.min(5, Math.max(0, rawLevel)) : 2) as AIUsagePolicy['level'];
  return {
    level,
    summary: clean(policy?.summary, 600) || (policy?.needsConfirmation ? 'سياسة استخدام الذكاء الاصطناعي تحتاج تأكيدًا من تعليمات المقرر.' : `سياسة AI — المستوى ${level}`),
    allowed: cleanList(policy?.allowed, 40, 180),
    prohibited: cleanList(policy?.prohibited, 40, 180),
    disclosureRequired: Boolean(policy?.disclosureRequired),
    needsConfirmation: Boolean(policy?.needsConfirmation),
  };
}

function createTasks(actions: string[], deliverables: Deliverable[], deadline?: string): ProjectTask[] {
  const tasks: ProjectTask[] = [];
  const actionLabels: Record<string, string> = {
    RESEARCH: 'جمع المصادر وبناء خريطة الأدلة', WRITE: 'إعداد هيكل الكتابة والمسودة', CALCULATE: 'تنفيذ الحسابات والتحقق منها', ANALYZE: 'تنفيذ التحليل وربط النتائج بالأدلة', CODE: 'بناء المكونات البرمجية', DESIGN: 'إعداد التصميم وتوثيق قراراته', BUILD: 'بناء النموذج أو المنتج المطلوب', TEST: 'تشغيل الاختبارات وتوثيق النتائج', PRESENT: 'إعداد العرض وربطه بنتائج المشروع', DEFEND: 'التدرب على المناقشة الشفوية', REFLECT: 'إعداد نقاط الانعكاس الشخصي وفق سياسة AI', SURVEY: 'إعداد أداة الاستبيان وخطة التحليل', COLLABORATE: 'توزيع المسؤوليات ونقاط الدمج', SIMULATE: 'تشغيل المحاكاة وتوثيق المدخلات', PORTFOLIO: 'تجميع الأدلة القابلة للعرض', LAB: 'تنظيم سجل المختبر والقياسات', SPREADSHEET: 'بناء المصنف والتحقق من الصيغ', MEDIA: 'إعداد خطة الإنتاج والمخرجات الإعلامية',
  };
  actions.forEach((action, index) => tasks.push({
    id: randomUUID(), title: actionLabels[action] || `تنفيذ: ${action}`, status: index === 0 ? 'ready' : 'not_started', dueDate: deadline, estimatedMinutes: 60, module: actionModuleMap[action] || 'writing', dependencyIds: index ? [tasks[index - 1].id] : [],
  }));
  deliverables.forEach(deliverable => tasks.push({
    id: randomUUID(), title: `مراجعة وتجهيز: ${deliverable.title}`, status: 'not_started', dueDate: deliverable.deadline || deadline, estimatedMinutes: 30, module: 'writing', dependencyIds: tasks.length ? [tasks[tasks.length - 1].id] : [],
  }));
  return tasks;
}

export function buildProjectDNA(parsed: ParsedAssignment, owner: { userId: string; tenantId: string }, original?: ProjectDNA['originalAssignment']): ProjectDNA {
  const now = new Date().toISOString();
  const projectType = clean(parsed.projectType, 160) || 'Academic project';
  const actions = normalizeActions(parsed.requiredActions);
  if (!actions.length) actions.push('RESEARCH', 'WRITE', 'PRESENT');

  const deliverables: Deliverable[] = (parsed.deliverables || []).filter(Boolean).slice(0, 50).map(d => ({
    id: randomUUID(), title: clean(d.title, 240) || 'مخرج يحتاج تسمية', format: clean(d.format, 180) || 'Needs confirmation', status: 'pending', deadline: clean(d.deadline, 80) || undefined, validationRules: cleanList(d.validationRules, 30, 220), requirementSource: clean(d.requirementSource, 500) || undefined,
  }));
  if (!deliverables.length) deliverables.push({ id: randomUUID(), title: 'التسليم النهائي', format: 'Needs confirmation', status: 'pending' });

  const requirementCategories = new Set<Requirement['category']>(['deadline','format','content','policy','team','software','source','submission','other']);
  const requirementConfidence = new Set<Requirement['confidence']>(['high','medium','needs_confirmation']);
  const requirements: Requirement[] = (parsed.requirements || []).slice(0, 200).map(r => ({
    id: randomUUID(), label: clean(r.label, 220) || 'متطلب', value: clean(r.value, 1200) || 'Needs confirmation', category: requirementCategories.has(r.category as Requirement['category']) ? r.category as Requirement['category'] : 'other', confidence: requirementConfidence.has(r.confidence as Requirement['confidence']) ? r.confidence as Requirement['confidence'] : 'needs_confirmation', source: clean(r.source, 700) || undefined,
  }));
  const rubric: RubricCriterion[] = (parsed.rubric || []).slice(0, 100).map(r => ({
    id: randomUUID(), title: clean(r.title, 220) || 'معيار', description: clean(r.description, 1600), weighting: Number.isFinite(Number(r.weighting)) ? Math.min(100, Math.max(0, Number(r.weighting))) : 0, readiness: 'not_evidenced', evidenceIds: [],
  }));
  const aiPolicy = normalizePolicy(parsed.aiPolicy);
  if (!parsed.aiPolicy) aiPolicy.needsConfirmation = true;

  const milestones = (parsed.milestones || []).filter(m => m.title && m.date).slice(0, 50).map(m => ({ id: randomUUID(), title: clean(m.title, 220), date: clean(m.date, 80) }));
  const tasks = createTasks(actions, deliverables, clean(parsed.deadline, 80) || undefined);
  return {
    id: randomUUID(), revision: 1, userId: owner.userId, tenantId: owner.tenantId,
    title: clean(parsed.title, 260) || 'تكليف جديد — يحتاج تأكيد العنوان',
    course: clean(parsed.course, 220) || 'المقرر غير محدد', instructor: clean(parsed.instructor, 180) || undefined, projectType,
    academicDomain: clean(parsed.academicDomain, 160) || 'General', complexity: ['low','medium','high'].includes(String(parsed.complexity)) ? parsed.complexity! : 'medium', collaborationMode: ['individual','group'].includes(String(parsed.collaborationMode)) ? parsed.collaborationMode! : 'individual',
    requiredSkills: cleanList(parsed.requiredSkills, 80, 180), learningOutcomes: cleanList(parsed.learningOutcomes, 100, 500), requiredActions: actions,
    workspaceModules: modulesFor(actions, projectType), requirements, deliverables, rubric, tasks,
    deadlines: { final: clean(parsed.deadline, 80) || undefined, timezone: clean(parsed.deadlineTimezone, 80) || undefined, milestones }, citationStyle: clean(parsed.citationStyle, 100) || undefined,
    softwareRequirements: cleanList(parsed.softwareRequirements, 50, 180), aiPolicy,
    riskFlags: cleanList([...(parsed.riskFlags || []).slice(0, 100), ...requirements.filter(r => r.confidence === 'needs_confirmation').map(r => `تأكيد مطلوب: ${r.label}`)], 200, 500),
    estimatedWorkloadHours: Number.isFinite(Number(parsed.estimatedWorkloadHours)) ? Math.min(5000, Math.max(0, Number(parsed.estimatedWorkloadHours))) : undefined,
    status: 'ready', progress: 0, nextAction: tasks[0]?.title || 'راجع متطلبات المشروع', originalAssignment: original,
    createdAt: now, updatedAt: now,
  };
}

export function recalculateProject(project: ProjectDNA): ProjectDNA {
  const completedTasks = project.tasks.filter(t => t.status === 'completed').length;
  const progress = project.tasks.length ? Math.round((completedTasks / project.tasks.length) * 100) : 0;
  const next = project.tasks.find(t => t.status === 'ready' || t.status === 'in_progress') || project.tasks.find(t => t.status === 'not_started');
  const status = progress === 100 ? 'completed' : project.tasks.some(t => t.status === 'blocked') ? 'blocked' : completedTasks ? 'in_progress' : 'ready';
  return { ...project, progress, status, nextAction: next?.title || (progress === 100 ? 'شغّل فحص التسليم النهائي' : 'راجع متطلبات المشروع'), updatedAt: new Date().toISOString() };
}

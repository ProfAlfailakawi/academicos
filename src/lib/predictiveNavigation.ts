export type PredictiveCandidate = {
  to: string;
  label: string;
  reason: string;
  strength: 'strong' | 'medium' | 'light';
};

type Edge = { count: number; last: number; path: string };
type Model = {
  version: 1;
  visits: Record<string, number>;
  transitions: Record<string, Record<string, Edge>>;
};

type AvailableDestination = { to: string; label: string };

const EMPTY_MODEL: Model = { version: 1, visits: {}, transitions: {} };
const MAX_AGE = 1000 * 60 * 60 * 24 * 45;

export function routeSignature(pathname: string) {
  const clean = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  if (/^\/app\/project\/[^/]+$/.test(clean)) return '/app/project/:id';
  if (/^\/app\/course\/[^/]+$/.test(clean)) return '/app/course/:id';
  return clean;
}

function learnedLabel(path: string, available: AvailableDestination[]) {
  const exact = available.find(item => item.to === path);
  if (exact) return exact.label;
  const sig = routeSignature(path);
  if (sig === '/app/project/:id') return 'مساحة المشروع';
  if (sig === '/app/course/:id') return 'مساحة المقرر';
  if (sig === '/app/upload') return 'تحليل تكليف جديد';
  if (sig === '/app/semester') return 'الفصل الحالي';
  if (sig === '/app/settings') return 'الإعدادات والسياسات';
  if (sig === '/app/integrations') return 'التكاملات';
  if (sig === '/app/support') return 'الدعم';
  return 'المساحة التالية';
}

function isPotentiallyAccessible(path: string, available: AvailableDestination[]) {
  if (available.some(item => item.to === path)) return true;
  const sig = routeSignature(path);
  return sig === '/app/project/:id' || sig === '/app/course/:id' || sig === '/app/upload' || sig === '/app/settings' || sig === '/app/integrations' || sig === '/app/support' || sig === '/app/semester';
}

function readModel(storageKey: string): Model {
  if (typeof window === 'undefined') return EMPTY_MODEL;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || 'null') as Model | null;
    return parsed?.version === 1 && parsed.transitions && parsed.visits ? parsed : { ...EMPTY_MODEL, visits: {}, transitions: {} };
  } catch {
    return { ...EMPTY_MODEL, visits: {}, transitions: {} };
  }
}

function writeModel(storageKey: string, model: Model) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(storageKey, JSON.stringify(model)); } catch { /* local storage may be unavailable */ }
}

export function recordNavigation(storageKey: string, fromPath: string | null, toPath: string) {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const model = readModel(storageKey);
  const toSig = routeSignature(toPath);
  model.visits[toSig] = (model.visits[toSig] || 0) + 1;

  if (fromPath && fromPath !== toPath) {
    const fromSig = routeSignature(fromPath);
    const bucket = model.transitions[fromSig] || {};
    const current = bucket[toSig] || { count: 0, last: now, path: toPath };
    bucket[toSig] = { count: Math.min(current.count + 1, 99), last: now, path: toPath };
    model.transitions[fromSig] = bucket;
  }

  // Keep the model intentionally small and recent.
  for (const [from, bucket] of Object.entries(model.transitions)) {
    for (const [to, edge] of Object.entries(bucket)) {
      if (now - edge.last > MAX_AGE) delete bucket[to];
    }
    if (!Object.keys(bucket).length) delete model.transitions[from];
  }
  writeModel(storageKey, model);
}

function roleDefaults(role: string, current: string): Array<{to:string; label:string; reason:string; score:number}> {
  const student = role === 'student' || role === 'student_group_leader';
  const faculty = ['professor','course_coordinator','department_admin','college_admin','university_admin','admin','superadmin','root_owner'].includes(role);
  const control = ['department_admin','college_admin','university_admin','ai_governance_officer','accreditation_officer','national_admin','admin','superadmin','root_owner'].includes(role);
  const support = ['support_agent','trust_safety_admin'].includes(role);

  const common: Record<string, Array<{to:string; label:string; reason:string; score:number}>> = {
    '/app/projects': [
      { to: '/app/calendar', label: 'التقويم', reason: 'لرؤية الموعد التالي بعد مراجعة المشاريع', score: 8 },
      { to: '/app/upload', label: 'تحليل تكليف جديد', reason: 'لبدء تكليف جديد مباشرة', score: 6 },
    ],
    '/app/upload': [{ to: '/app/projects', label: 'المشاريع', reason: 'للانتقال من التحليل إلى مساحة العمل', score: 10 }],
    '/app/project/:id': [
      { to: '/app/skills', label: 'الأدلة والمهارات', reason: 'لربط تقدم المشروع بالأدلة المكتسبة', score: 9 },
      { to: '/app/calendar', label: 'التقويم', reason: 'لمراجعة الموعد المرتبط بالعمل', score: 6 },
    ],
    '/app/calendar': [{ to: '/app/projects', label: 'المشاريع', reason: 'للعودة من الموعد إلى العمل المرتبط به', score: 8 }],
    '/app/notifications': [{ to: '/app/projects', label: 'المشاريع', reason: 'للتصرف على التنبيه داخل مساحة العمل', score: 7 }],
    '/app/skills': [{ to: '/app/passport', label: 'الجواز الأكاديمي', reason: 'لرؤية أثر الأدلة على ملفك الأكاديمي', score: 9 }],
    '/app/passport': [{ to: '/app/projects', label: 'المشاريع', reason: 'للعودة إلى العمل الذي يبني ملفك الأكاديمي', score: 6 }],
    '/app/search': [{ to: '/app/projects', label: 'المشاريع', reason: 'للوصول إلى مساحة العمل بعد العثور عليها', score: 7 }],
    '/app/professor': [{ to: '/app/semester', label: 'الفصل الحالي', reason: 'لمراجعة الصورة التنفيذية للفصل', score: 8 }],
    '/app/course/:id': [{ to: '/app/professor', label: 'ProfessorOS', reason: 'للعودة إلى نظرة الأستاذ بعد المقرر', score: 8 }],
    '/app/control': [{ to: '/app/platform', label: 'مركز التشغيل والحوكمة', reason: 'للانتقال من مؤشرات المؤسسة إلى التشغيل', score: 9 }],
    '/app/platform': [{ to: '/app/users', label: 'إدارة المستخدمين', reason: 'إذا احتاجت مؤشرات التشغيل إلى إجراء إداري', score: 6 }],
    '/app/support-console': [{ to: '/app/support', label: 'الدعم', reason: 'للانتقال من الصندوق إلى تجربة الدعم', score: 6 }],
  };

  const base = [...(common[current] || [])];
  if (current === '/app' || current === '/app/semester') {
    if (student) base.push({ to: '/app/projects', label: 'المشاريع', reason: 'الخطوة الأقرب لبدء العمل من ملخص اليوم', score: 10 });
    else if (support) base.push({ to: '/app/support-console', label: 'صندوق الدعم', reason: 'الخطوة الأقرب بعد الدخول', score: 10 });
    else if (control) base.push({ to: '/app/control', label: 'لوحة المؤسسة', reason: 'الخطوة الأقرب بعد نظرة الفصل', score: 10 });
    else if (faculty) base.push({ to: '/app/professor', label: 'ProfessorOS', reason: 'الخطوة الأقرب بعد نظرة الفصل', score: 10 });
  }

  // Even on less common screens, keep one useful prediction available instead of
  // forcing the user back to search/navigation.
  if (!base.length) {
    if (student) base.push({ to: '/app/projects', label: 'المشاريع', reason: 'مساحة العمل الأكثر احتمالًا بعد هذه الشاشة', score: 6 });
    else if (support) base.push({ to: '/app/support-console', label: 'صندوق الدعم', reason: 'مساحة العمل الأكثر احتمالًا لدور الدعم', score: 6 });
    else if (control) base.push({ to: '/app/control', label: 'لوحة المؤسسة', reason: 'مساحة العمل الأكثر احتمالًا لدورك الإداري', score: 6 });
    else if (faculty) base.push({ to: '/app/professor', label: 'ProfessorOS', reason: 'مساحة العمل الأكثر احتمالًا لدور الأستاذ', score: 6 });
    else base.push({ to: '/app/projects', label: 'المشاريع', reason: 'مساحة العمل الأكثر احتمالًا بعد هذه الشاشة', score: 5 });
  }
  return base;
}

export function predictNext(storageKey: string, pathname: string, role: string, available: AvailableDestination[]): PredictiveCandidate | null {
  const current = routeSignature(pathname);
  const model = readModel(storageKey);
  const scores = new Map<string, { to:string; label:string; reason:string; score:number; learned:boolean }>();

  const learned = model.transitions[current] || {};
  for (const edge of Object.values(learned)) {
    if (edge.path === pathname || !isPotentiallyAccessible(edge.path, available)) continue;
    const ageDays = Math.max(0, (Date.now() - edge.last) / (1000 * 60 * 60 * 24));
    const recency = Math.max(0, 4 - ageDays / 8);
    const score = 11 + edge.count * 4 + recency;
    scores.set(edge.path, {
      to: edge.path,
      label: learnedLabel(edge.path, available),
      reason: edge.count >= 2 ? 'هذه عادة تنقلك المتكررة من هذه الشاشة' : 'استخدمت هذا المسار مؤخرًا من هنا',
      score,
      learned: true,
    });
  }

  for (const candidate of roleDefaults(role, current)) {
    if (candidate.to === pathname || !isPotentiallyAccessible(candidate.to, available)) continue;
    const existing = scores.get(candidate.to);
    const visitBonus = Math.min(3, (model.visits[routeSignature(candidate.to)] || 0) * 0.25);
    const score = candidate.score + visitBonus;
    if (!existing || score > existing.score) scores.set(candidate.to, { ...candidate, score, learned: false });
  }

  const best = [...scores.values()].sort((a,b) => b.score - a.score)[0];
  if (!best) return null;
  return {
    to: best.to,
    label: best.label,
    reason: best.reason,
    strength: best.score >= 18 ? 'strong' : best.score >= 10 ? 'medium' : 'light',
  };
}

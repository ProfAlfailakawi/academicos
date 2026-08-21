import { buildProjectDNA, recalculateProject } from './project-engine';
import { runSubmissionAudit } from './audit';
import type {
  CourseAssignmentRecord,
  CourseRecord,
  DashboardSummary,
  JobRecord,
  LearningEvidenceRecord,
  NotificationRecord,
  PassportData,
  ProjectDNA,
  ProjectEvidence,
  ProjectMemberRecord,
  SkillEvidence,
  SubmissionAudit,
  SupportTicket,
  WorkspaceArtifact,
} from '../types';

const now = Date.now();
const days = (n: number) => new Date(now + n * 86400000).toISOString();
const daysAgo = (n: number) => new Date(now - n * 86400000).toISOString();

function makeDemoProjects(): ProjectDNA[] {
  const p1 = buildProjectDNA({
    title: 'تحليل سوق منصة تعليمية رقمية',
    course: 'BUS 342 — Strategic Marketing',
    projectType: 'Market analysis report + presentation',
    academicDomain: 'Business',
    complexity: 'high',
    collaborationMode: 'group',
    requiredSkills: ['البحث', 'التحليل النقدي', 'تحليل البيانات', 'العرض'],
    learningOutcomes: ['تقييم جاذبية السوق', 'دعم الاستنتاجات بأدلة قابلة للتحقق'],
    requiredActions: ['RESEARCH','ANALYZE','WRITE','PRESENT','DEFEND','COLLABORATE'],
    deliverables: [
      { title: 'تقرير تحليل السوق', format: 'PDF — 2,500 words', deadline: days(5), validationRules: ['APA 7', 'Minimum 8 sources'] },
      { title: 'عرض تنفيذي', format: 'PPTX — 10 minutes', deadline: days(5) },
    ],
    requirements: [
      { label: 'عدد الكلمات', value: '2,500', category: 'format', confidence: 'high' },
      { label: 'المراجع', value: '8 مصادر أكاديمية على الأقل', category: 'source', confidence: 'high' },
    ],
    rubric: [
      { title: 'جودة التحليل', description: 'عمق التحليل وربط الأدلة', weighting: 40 },
      { title: 'جودة الأدلة', description: 'ملاءمة المصادر وقوتها', weighting: 30 },
      { title: 'التواصل', description: 'وضوح التقرير والعرض', weighting: 30 },
    ],
    deadline: days(5),
    deadlineTimezone: 'Asia/Kuwait',
    citationStyle: 'APA 7',
    aiPolicy: { level: 3, summary: 'AI مسموح للتخطيط والمراجعة، وليس لكتابة الانعكاس الشخصي.', allowed: ['planning','feedback','source organization'], prohibited: ['final reflection generation'], disclosureRequired: true },
    estimatedWorkloadHours: 12,
  }, { userId: 'demo-student', tenantId: 'demo-university' }, { text: 'Demo assignment brief', fileName: 'market-analysis-brief.pdf', fileType: 'application/pdf' });
  p1.tasks[0].status = 'completed';
  p1.tasks[1].status = 'in_progress';
  p1.deliverables[0].status = 'in_progress';

  const p2 = buildProjectDNA({
    title: 'تطبيق ويب لإدارة المختبرات',
    course: 'CS 401 — Software Engineering',
    projectType: 'Web application',
    academicDomain: 'Computer Science',
    complexity: 'high',
    collaborationMode: 'group',
    requiredSkills: ['هندسة البرمجيات', 'الاختبار', 'Git', 'التوثيق'],
    learningOutcomes: ['بناء تطبيق متعدد الطبقات', 'تطبيق اختبارات آلية'],
    requiredActions: ['CODE','BUILD','TEST','WRITE','PRESENT','COLLABORATE'],
    deliverables: [
      { title: 'Source code', format: 'Git repository', deadline: days(12) },
      { title: 'Technical report', format: 'PDF', deadline: days(12) },
    ],
    requirements: [
      { label: 'Testing', value: 'Unit + integration tests', category: 'content', confidence: 'high' },
      { label: 'Deployment target', value: 'Needs confirmation', category: 'submission', confidence: 'needs_confirmation' },
    ],
    rubric: [
      { title: 'Architecture', description: 'Separation of concerns', weighting: 30 },
      { title: 'Correctness', description: 'Functional requirements', weighting: 40 },
      { title: 'Testing & docs', description: 'Verification and maintainability', weighting: 30 },
    ],
    deadline: days(12),
    aiPolicy: { level: 4, summary: 'Code generation allowed with disclosure; student must explain generated changes.', allowed: ['code generation','debugging','documentation'], prohibited: [], disclosureRequired: true },
    estimatedWorkloadHours: 20,
  }, { userId: 'demo-student', tenantId: 'demo-university' });

  return [recalculateProject(p1), recalculateProject(p2)];
}

const initialProjects = makeDemoProjects();
const projects = new Map(initialProjects.map(p => [p.id, p]));
const audits = new Map<string, SubmissionAudit[]>();

// Initial Evidence
const initialEvidence: ProjectEvidence[] = [
  {
    id: 'ev-1',
    projectId: initialProjects[0].id,
    userId: 'demo-student',
    tenantId: 'demo-university',
    type: 'source',
    title: 'دراسة السوق التعليمية في الخليج 2025',
    detail: 'تقرير إحصائي أكاديمي موثق حول معدلات نمو المنصات التعليمية.',
    sourceUrl: 'https://example.edu/research/edtech-gulf-2025',
    verification: 'institution_verified',
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
  },
  {
    id: 'ev-2',
    projectId: initialProjects[1].id,
    userId: 'demo-student',
    tenantId: 'demo-university',
    type: 'code',
    title: 'نتائج اختبارات الوحدة - Unit Tests (98% Pass Rate)',
    detail: 'تشغيل 42 اختباراً آلياً بنجاح لوحدة التحكم والتحقق من الصلاحيات.',
    verification: 'institution_verified',
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
];
const evidence = new Map<string, ProjectEvidence>(initialEvidence.map(e => [e.id, e]));

// Initial Learning Evidence
const initialLearning: LearningEvidenceRecord[] = [
  {
    id: 'lrn-1',
    projectId: initialProjects[0].id,
    userId: 'demo-student',
    tenantId: 'demo-university',
    source: 'viva',
    summary: 'مراجعة قسم منهجية البحث والهيكل التنظيمي للتقرير - تعلمت كيفية تنظيم المراجع الأكاديمية والتمييز بين المصادر الأولية والثانوية.',
    evidence: [
      { label: 'تحسين صياغة الفرضيات البحثية', value: 'مستوفى بنسبة عالية' },
      { label: 'استخدام توثيق APA 7 بدقة', value: 'مستوفى بنسبة عالية' }
    ],
    createdAt: daysAgo(3),
  },
];
const learning = new Map<string, LearningEvidenceRecord>(initialLearning.map(l => [l.id, l]));

// Initial Courses (for Course OS & Professor OS)
const initialCourses: CourseRecord[] = [
  {
    id: 'crs-cs401',
    tenantId: 'demo-university',
    ownerId: 'demo-professor',
    code: 'CS 401',
    title: 'هندسة البرمجيات والتطبيقات الأكاديمية',
    term: 'الفصل الدراسي الأول 2026/2027',
    description: 'مقرر متقدم في هندسة البرمجيات، تصميم النظم، وإدارة مشاريع التطوير البرمجي.',
    outcomes: ['بناء معمارية تطبيقات متعددة الطبقات', 'تطبيق ممارسات CI/CD والتست الآلي', 'العمل الجماعي عبر Git'],
    aiPolicy: { level: 4, summary: 'توليد الكود مسموح مع الإفصاح وشرح التغييرات.', allowed: ['code generation', 'debugging', 'docs'], prohibited: [], disclosureRequired: true },
    status: 'active',
    createdAt: daysAgo(30),
    updatedAt: daysAgo(2),
  },
  {
    id: 'crs-bus342',
    tenantId: 'demo-university',
    ownerId: 'demo-professor',
    code: 'BUS 342',
    title: 'التسويق الاستراتيجي والتحليل الرقمي',
    term: 'الفصل الدراسي الأول 2026/2027',
    description: 'تحليل سلوك المستهلك، تقييم المنافسة، وإعداد استراتيجيات التوسع الأكاديمي والرقمي.',
    outcomes: ['إعداد تقارير تحليل السوق الأكاديمية', 'استخدام المراجع والبيانات الموثقة'],
    aiPolicy: { level: 3, summary: 'ذكاء اصطناعي مسموح للتخطيط والتنظيم، ويُمنع كتابة الانعكاس النهائي.', allowed: ['planning', 'feedback'], prohibited: ['reflection generation'], disclosureRequired: true },
    status: 'active',
    createdAt: daysAgo(30),
    updatedAt: daysAgo(5),
  },
];
const coursesMap = new Map<string, CourseRecord>(initialCourses.map(c => [c.id, c]));

// Initial Assignments
const initialAssignments: CourseAssignmentRecord[] = [
  {
    id: 'asg-cs401-1',
    tenantId: 'demo-university',
    courseId: 'crs-cs401',
    createdBy: 'demo-professor',
    title: 'تطبيق ويب لإدارة المختبرات',
    instructions: 'قم ببرناء نظام إدارة مختبرات متكامل يشتمل على جدولة الأجهزة واختبارات آلية وتوثيق تقني شامل.',
    deadline: days(12),
    deliverables: [
      { id: 'del-1', title: 'Source Code Repository', format: 'Git URL' },
      { id: 'del-2', title: 'Technical Design Document', format: 'PDF' },
    ],
    rubric: [
      { id: 'rub-1', title: 'Architecture', description: 'معمارية التطبيق وتنظيم الكود', weighting: 40 },
      { id: 'rub-2', title: 'Testing', description: 'تغطية الاختبارات الآلية', weighting: 30 },
      { id: 'rub-3', title: 'Documentation', description: 'التوثيق التقني', weighting: 30 },
    ],
    outcomes: ['بناء معمارية تطبيقات متعددة الطبقات', 'تطبيق ممارسات CI/CD والتست الآلي'],
    aiPolicy: { level: 4, summary: 'مسموح استخدام الذكاء الاصطناعي مع شرح الكود.', allowed: ['code generation'], prohibited: [], disclosureRequired: true },
    groupMode: 'group',
    status: 'published',
    createdAt: daysAgo(10),
    updatedAt: daysAgo(2),
  },
  {
    id: 'asg-bus342-1',
    tenantId: 'demo-university',
    courseId: 'crs-bus342',
    createdBy: 'demo-professor',
    title: 'تحليل سوق منصة تعليمية رقمية',
    instructions: 'إعداد تقرير تحليلي شامل لسوق منصات التعليم الرقمي في الخليج العربي مدعماً بالأرقام والمراجع الأكاديمية.',
    deadline: days(5),
    deliverables: [
      { id: 'del-3', title: 'تقرير تحليل السوق', format: 'PDF — 2,500 words' },
      { id: 'del-4', title: 'عرض تنفيذي', format: 'PPTX — 10 mins' },
    ],
    rubric: [
      { id: 'rub-4', title: 'جودة التحليل', description: 'عمق التحليل واستخدام الأدلة', weighting: 50 },
      { id: 'rub-5', title: 'العرض والتواصل', description: 'وضوح التقرير والعرض الشفهي', weighting: 50 },
    ],
    outcomes: ['إعداد تقارير تحليل السوق الأكاديمية'],
    aiPolicy: { level: 3, summary: 'AI مسموح للتخطيط والمراجع.', allowed: ['planning', 'feedback'], prohibited: ['reflection generation'], disclosureRequired: true },
    groupMode: 'group',
    status: 'published',
    createdAt: daysAgo(15),
    updatedAt: daysAgo(5),
  },
];
const assignmentsMap = new Map<string, CourseAssignmentRecord>(initialAssignments.map(a => [a.id, a]));

// Initial Notifications
const initialNotifications: NotificationRecord[] = [
  {
    id: 'notif-1',
    tenantId: 'demo-university',
    userId: 'demo-student',
    type: 'deadline',
    priority: 'important',
    title: 'اقتراب موعد التسليم النهائي',
    body: 'مشروع "تحليل سوق منصة تعليمية رقمية" يتبقى على موعد تسليمه 5 أيام.',
    targetPath: `/app/project/${initialProjects[0].id}`,
    channels: ['in_app'],
    delivery: { in_app: 'sent' },
    readAt: undefined,
    createdAt: daysAgo(1),
  },
  {
    id: 'notif-2',
    tenantId: 'demo-university',
    userId: 'demo-student',
    type: 'audit',
    priority: 'normal',
    title: 'جاهزية المشروع للاستلام',
    body: 'تم اكتمال تدقيق النزاهة ومتطلبات التكليف بنسبة 92%.',
    targetPath: `/app/project/${initialProjects[0].id}`,
    channels: ['in_app'],
    delivery: { in_app: 'sent' },
    readAt: daysAgo(2),
    createdAt: daysAgo(2),
  },
];

// Initial Support Tickets
const initialTickets: SupportTicket[] = [
  {
    id: 'ticket-1',
    tenantId: 'demo-university',
    userId: 'demo-student',
    displayName: 'طالب العرض التجريبي',
    email: 'student@demo.academicos.local',
    category: 'technical',
    priority: 'normal',
    subject: 'استفسار حول مزامنة المراجع من Google Drive',
    message: 'كيف يمكن ربط مجلد المراجع الأكاديمية بمساحة عمل المشروع؟',
    status: 'resolved',
    createdAt: daysAgo(4),
    updatedAt: daysAgo(3),
  },
];

// Initial Jobs
const initialJobs: JobRecord[] = [
  {
    id: 'job-1',
    tenantId: 'demo-university',
    userId: 'demo-student',
    type: 'assignment_compile',
    state: 'completed',
    progress: 100,
    stages: [
      { key: 'reading', label: 'قراءة المتطلبات', state: 'completed' },
      { key: 'deliverables', label: 'كشف المخرجات', state: 'completed' },
      { key: 'rubric', label: 'رسم المعايير', state: 'completed' },
      { key: 'workspace', label: 'بناء مساحة العمل', state: 'completed' },
    ],
    resultRef: initialProjects[0].id,
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  },
];

// Initial Platform Records
const platformRecords: Record<string, Array<{ id: string; title: string; status: string; data: Record<string, unknown> }>> = {
  academicTerms: [
    { id: 'term-1', title: 'الفصل الدراسي الأول 2026/2027', status: 'active', data: { startDate: '2026-09-01', endDate: '2027-01-15' } },
    { id: 'term-2', title: 'الفصل الدراسي الثاني 2026/2027', status: 'upcoming', data: { startDate: '2027-02-01', endDate: '2027-06-15' } },
  ],
  semesterTemplates: [
    { id: 'tmpl-1', title: 'قالب المقررات الهندسية والبرمجية', status: 'active', data: { defaultAiLevel: 4, labRequired: true } },
    { id: 'tmpl-2', title: 'قالب المقررات الإدارية والتحليلية', status: 'active', data: { defaultAiLevel: 3, labRequired: false } },
  ],
  announcements: [
    { id: 'anc-1', title: 'تحديث سياسات استخدام AI للموسم الأكاديمي', status: 'active', data: { audience: 'all', priority: 'high' } },
  ],
};

// Initial Workspace Artifacts
const initialArtifacts: WorkspaceArtifact[] = [
  {
    id: 'art-1',
    projectId: initialProjects[0].id,
    tenantId: 'demo-university',
    createdBy: 'demo-student',
    updatedBy: 'demo-student',
    module: 'research',
    kind: 'work-item',
    title: 'مسودة ملخص تحليل المنافسين',
    content: 'يتضمن هذا المستند مقارنة شاملة بين المنصات التعليمية الرئيسية في منطقة الخليج العربي.',
    status: 'in_progress',
    isCanonical: true,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(1),
  },
];
const artifactsMap = new Map<string, WorkspaceArtifact>(initialArtifacts.map(a => [a.id, a]));

// Initial Project Members
const initialMembers: ProjectMemberRecord[] = [
  {
    id: 'mem-1',
    projectId: initialProjects[0].id,
    tenantId: 'demo-university',
    email: 'student2@demo.academicos.local',
    role: 'member',
    status: 'active',
    invitedBy: 'demo-student',
    displayName: 'سارة الكندري (عضو فريق)',
    createdAt: daysAgo(4),
    updatedAt: daysAgo(4),
  },
];

export const demoStore = {
  async listProjects(userId: string, tenantId: string) {
    const list = [...projects.values()];
    const exact = list.filter(p => p.userId === userId && p.tenantId === tenantId);
    if (exact.length > 0) return exact.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
    if (userId.startsWith('demo-') || tenantId === 'demo-university') {
      return list.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    return [];
  },
  async getProject(id: string, userId: string, tenantId: string) {
    const p = projects.get(id);
    if (!p) return null;
    if (p.userId === userId || userId.startsWith('demo-') || tenantId === 'demo-university') return p;
    return null;
  },
  async saveProject(project: ProjectDNA) {
    projects.set(project.id, project);
    while (projects.size > 100) {
      const oldest = projects.keys().next().value as string | undefined;
      if (!oldest) break;
      projects.delete(oldest);
    }
    return project;
  },
  async updateProject(project: ProjectDNA) { projects.set(project.id, project); return project; },
  async saveAudit(audit: SubmissionAudit) { audits.set(audit.projectId, [...(audits.get(audit.projectId) || []), audit]); return audit; },

  async listEvidence(projectId: string, userId: string, tenantId: string) {
    return [...evidence.values()].filter(e => e.projectId === projectId);
  },
  async saveEvidence(item: ProjectEvidence) { evidence.set(item.id, item); return item; },
  async deleteEvidence(id: string, projectId: string, userId: string, tenantId: string) {
    const e = evidence.get(id);
    if (!e || e.projectId !== projectId) return false;
    evidence.delete(id);
    return true;
  },

  async saveLearning(item: LearningEvidenceRecord) { learning.set(item.id, item); return item; },
  async listLearning(projectId: string, userId: string, tenantId: string) {
    return [...learning.values()].filter(e => e.projectId === projectId);
  },

  // Courses
  async listCourses(tenantId: string) {
    return [...coursesMap.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async getCourse(id: string, tenantId: string) {
    return coursesMap.get(id) || null;
  },
  async listCourseAssignments(courseId: string, tenantId: string) {
    return [...assignmentsMap.values()].filter(a => a.courseId === courseId);
  },

  // Notifications
  async listNotifications(userId: string) {
    return initialNotifications;
  },

  // Support Tickets
  async listSupportTickets(userId: string) {
    return initialTickets;
  },

  // Jobs
  async listJobs(userId: string) {
    return initialJobs;
  },

  // Platform Records
  async listPlatformRecords(resource: string) {
    return platformRecords[resource] || [
      { id: `${resource}-1`, title: `سجل تجريبي - ${resource}`, status: 'active', data: { description: 'سجل العرض التجريبي للنظام' } }
    ];
  },

  // Invitations
  async listInvitations(email: string) {
    return initialMembers.filter(m => m.status === 'pending');
  },

  // Project Members
  async listMembers(projectId: string) {
    return initialMembers.filter(m => m.projectId === projectId);
  },

  // Workspace Artifacts
  async listArtifacts(projectId: string) {
    return [...artifactsMap.values()].filter(a => a.projectId === projectId);
  },

  // Project Comments
  async listComments(projectId: string) {
    return [
      {
        id: 'cmt-1',
        projectId,
        tenantId: 'demo-university',
        userId: 'demo-student',
        displayName: 'طالب العرض التجريبي',
        body: 'تم مراجعة قسم المراجع وتأكيد توافقها مع معايير APA 7.',
        mentions: [],
        createdAt: daysAgo(1),
        updatedAt: daysAgo(1),
      }
    ];
  },

  // Project Activity
  async listActivity(projectId: string) {
    return [
      { id: 'act-1', projectId, tenantId: 'demo-university', userId: 'demo-student', type: 'task_completed', description: 'تم إكمال مهمة تحليل المراجع الأكاديمية', timestamp: daysAgo(1) },
      { id: 'act-2', projectId, tenantId: 'demo-university', userId: 'demo-student', type: 'evidence_added', description: 'تمت إضافة دليل مصدر جديد', timestamp: daysAgo(2) },
    ];
  },

  // API Keys
  async listApiKeys() {
    return [
      { id: 'key-1', name: 'Demo Integration Key', scopes: ['tenant:read', 'projects:read'], createdAt: daysAgo(10) }
    ];
  },

  async countUsers() { return 24; },
};

export async function demoDashboard(userId: string, tenantId: string): Promise<DashboardSummary> {
  const list = await demoStore.listProjects(userId, tenantId);
  const sevenDays = Date.now() + 7 * 86400000;
  const dueSoon = list.filter(p => p.deadlines.final && new Date(p.deadlines.final).getTime() <= sevenDays && p.status !== 'completed').length;
  return {
    projects: list,
    stats: { active: list.filter(p => p.status !== 'completed').length, dueSoon, completed: list.filter(p => p.status === 'completed').length, workloadHours: list.reduce((s,p) => s + (p.estimatedWorkloadHours || 0), 0) },
    upcoming: list.flatMap(p => p.deadlines.final ? [{ id: `deadline_${p.id}`, title: p.title, date: p.deadlines.final, type: 'deadline' as const, projectId: p.id }] : []).sort((a,b) => a.date.localeCompare(b.date)).slice(0,6),
    risks: list.flatMap(p => p.riskFlags.slice(0,2).map(message => ({ projectId: p.id, projectTitle: p.title, message, severity: 'important' as const }))),
  };
}

export async function demoSkills(userId: string, tenantId: string): Promise<SkillEvidence[]> {
  const list = await demoStore.listProjects(userId, tenantId);
  return list.flatMap(p => {
    const completed = p.tasks.filter(t => t.status === 'completed').length;
    return p.requiredSkills.map((skill, i) => ({
      id: `${p.id}_${i}`,
      skill,
      projectId: p.id,
      projectTitle: p.title,
      course: p.course,
      date: p.updatedAt,
      verificationLevel: 'project' as const,
      evidence: `مرتبط بنشاط فعلي في المشروع: ${completed} مهام مكتملة. موثّق ضمن مساحة العمل.`
    }));
  });
}

export async function demoPassport(userId: string, tenantId: string): Promise<PassportData> {
  const list = await demoStore.listProjects(userId, tenantId);
  return {
    user: { displayName: 'طالب العرض', education: 'مرحلة البكالوريوس', institution: 'AcademicOS Demo University' },
    projects: list.map(p => ({ id: p.id, title: p.title, course: p.course, status: p.status })),
    skills: await demoSkills(userId, tenantId),
    credentials: [
      { id: 'cred-1', title: 'شهادة النزاهة الأكاديمية والبحثية', issuer: 'AcademicOS AI Governance', verification: 'institution_verified', date: daysAgo(15) }
    ]
  };
}

export const demoAudit = async (project: ProjectDNA) => {
  const audit = runSubmissionAudit(project);
  await demoStore.saveAudit(audit);
  return audit;
};

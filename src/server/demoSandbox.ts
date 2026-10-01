/**
 * Demo sandboxes for AcademicOS.
 *
 * Collection names are written as literals rather than imported from `db.ts`:
 * `db.ts` imports this module, and a cycle between the two would make the
 * initialisation order of `COLLECTIONS` load-order dependent. The names below
 * are kept identical to the keys in `COLLECTIONS`, which are themselves equal
 * to their values.
 *
 * A demo visitor is handed a private in-memory Firestore (see
 * `demoFirestore.ts`) pre-loaded with a term's worth of synthetic academic
 * work: a tenant, staff and students, courses, published assignments, projects
 * at every stage, submissions in every grading state, learning evidence, viva
 * sessions and support tickets. `db()` resolves to that sandbox for the life of
 * the request, so all 73 store methods operate on it without modification, and
 * the institution's real Firestore is never opened.
 *
 * The volume is the point. AcademicOS's argument is "from assignment to
 * evidence" — that only lands if a viewer can open a course, see twenty
 * submissions at different stages, click into a project's evidence trail and
 * find it already populated. An empty tenant demonstrates nothing.
 *
 * Every person, course and grade below is invented.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import { createDemoFirestore, type DemoFirestore } from "./demoFirestore";
import { seedDemoDepth } from "./demoSeedDepth";
import type {
  AIUsagePolicy,
  CourseAssignmentRecord,
  CourseEnrollmentRecord,
  CourseRecord,
  CourseSubmissionRecord,
  Deliverable,
  ProjectDNA,
  ProjectTask,
  Requirement,
  RubricCriterion,
  UserProfile,
} from "../types";

export const DEMO_SESSION_TTL_MS = 60 * 60 * 1000;
export const DEMO_TENANT_ID = "demo_tenant_academicos";
export const DEMO_INSTRUCTOR_ID = "demo_user_instructor";

/*
 * أدوار البيئة التجريبية.
 *
 * كانت البيئة تفتح على الأستاذ وحده، فلا تُرى شاشة الطالب — وهي نصف المنتج،
 * وأوّل ما يسأل عنه من يُعرض عليه. والأدوار هنا ليست ترقيةَ صلاحية: كلها داخل
 * الصندوق المعزول نفسه، وكل واحدٍ منها شخصٌ موجود في بذرته فعلًا — فالشاشة
 * تفتح على بياناته لا على فراغ.
 *
 * والخادم هو من يقرّر، لا الواجهة: تُرسل الواجهة الدور المطلوب، ويُطابَق هنا
 * على قائمةٍ مغلقة. أي قيمة أخرى تسقط على الأستاذ.
 */
export interface DemoActorProfile {
  userId: string;
  role: "professor" | "teaching_assistant" | "university_admin" | "support_agent" | "student";
  displayName: string;
  email: string;
}

export const DEMO_ACTORS: Record<string, DemoActorProfile> = {
  professor: {
    userId: DEMO_INSTRUCTOR_ID,
    role: "professor",
    displayName: "د. سارة الخالد (بيئة تجريبية)",
    email: "demo_user_instructor@demo.academicos.test",
  },
  teaching_assistant: {
    userId: "demo_user_ta",
    role: "teaching_assistant",
    displayName: "م. عبدالعزيز الشايع (بيئة تجريبية)",
    email: "demo_user_ta@demo.academicos.test",
  },
  university_admin: {
    userId: "demo_user_admin",
    role: "university_admin",
    displayName: "د. محمد البدر (بيئة تجريبية)",
    email: "demo_user_admin@demo.academicos.test",
  },
  support_agent: {
    // دورٌ خامس يفتح صندوق الدعم (/app/support-console) على تذاكر البذرة نفسها.
    userId: "demo_user_support",
    role: "support_agent",
    displayName: "أ. هند المطيري (بيئة تجريبية)",
    email: "demo_user_support@demo.academicos.test",
  },
  student: {
    // أول طالبٍ في البذرة: مسجَّل في المقررات ولديه تسليمات وأدلّة تعلّم،
    // فشاشته تفتح على عملٍ قائم لا على قائمةٍ فارغة.
    userId: "demo_user_student_1",
    role: "student",
    displayName: "عبدالله الفيلكاوي (بيئة تجريبية)",
    email: "demo_user_student_1@demo.academicos.test",
  },
};

/** يحوّل ما تطلبه الواجهة إلى فاعلٍ معروف. المجهول يسقط على الأستاذ. */
export function demoActorFor(requested: unknown): DemoActorProfile {
  const key = String(requested || "").trim();
  return DEMO_ACTORS[key] || DEMO_ACTORS.professor;
}
export const DEMO_TOKEN_PREFIX = "demo_";

/** Demo is on by default; a deployment that must never offer it sets this to "false". */
export function demoEnabled(): boolean {
  return process.env.ACADEMICOS_DEMO_ENABLED !== "false";
}

const day = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * day).toISOString();
const ahead = (days: number) => new Date(Date.now() + days * day).toISOString();

/* Seeded, not random: the same tenant every time, so a screenshot taken for a
 * deck still matches the product a month later. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5; state >>>= 0;
    return state / 0x100000000;
  };
}
const pick = <T>(items: readonly T[], index: number): T =>
  items[index % items.length];

const STUDENT_NAMES = [
  "عبدالله الفيلكاوي", "دانة العتيبي", "فهد المطيري", "مريم الرشيدي",
  "ناصر العجمي", "شهد الدوسري", "يوسف الهاجري", "لولوة الكندري",
  "طلال الفضلي", "نورة السبيعي", "سلمان البلوشي", "هيا الخالدي",
  "بدر المطوع", "العنود العنزي", "مشاري الصالح", "جنى الحربي",
  "راكان القحطاني", "غلا الشمري", "عمر الأنصاري", "حصة البحر",
  "خالد الرومي", "منيرة الوزان", "سعود الغانم", "وضحى الصقر",
];

const STAFF = [
  ["demo_user_instructor", "د. سارة الخالد", "professor"],
  ["demo_user_ta", "م. عبدالعزيز الشايع", "teaching_assistant"],
  ["demo_user_admin", "د. محمد البدر", "university_admin"],
  ["demo_user_support", "أ. هند المطيري", "support_agent"],
] as const;

const COURSES: ReadonlyArray<readonly [string, string, string, string[]]> = [
  ["CS310", "هندسة البرمجيات", "تصميم وبناء أنظمة برمجية بفرق عمل، من المتطلبات إلى التسليم.", ["تحليل المتطلبات", "تصميم معماري", "اختبار وحدات", "العمل الجماعي"]],
  ["DS240", "تحليل البيانات التطبيقي", "معالجة البيانات وتحليلها واستخلاص نتائج قابلة للدفاع عنها.", ["تنظيف البيانات", "التحليل الإحصائي", "تصوير البيانات", "تفسير النتائج"]],
  ["BUS420", "بحوث الأعمال", "تصميم بحث أعمال تطبيقي وكتابة تقرير أكاديمي محكّم.", ["تصميم البحث", "مراجعة أدبيات", "منهجية", "الكتابة الأكاديمية"]],
  ["EDU350", "تصميم التعلم الرقمي", "تصميم خبرات تعلم رقمية مبنية على أدلة.", ["تحليل المتعلمين", "تصميم تعليمي", "التقويم", "الأدوات الرقمية"]],
  ["ENG201", "الكتابة الأكاديمية بالإنجليزية", "مهارات الكتابة الأكاديمية والاقتباس والنزاهة البحثية.", ["البنية الأكاديمية", "التوثيق", "النزاهة", "المراجعة"]],
  ["LAW380", "منهجية البحث القانوني", "البحث في المصادر القانونية وبناء حجة مسندة.", ["البحث القانوني", "التحليل", "الاستشهاد", "الصياغة"]],
];

const PROJECT_TITLES = [
  "نظام حجز قاعات جامعية", "تحليل أنماط الغياب الطلابي", "دراسة سلوك المستهلك الكويتي",
  "منصة تعلم تفاعلية للرياضيات", "مراجعة أدبيات عن التعلم المدمج", "تحليل عقود الخدمات الرقمية",
  "تطبيق متابعة المشاريع الطلابية", "لوحة مؤشرات لأداء المقررات", "دراسة أثر الذكاء الاصطناعي على التقييم",
  "نموذج تنبؤ بمعدلات التخرج", "تصميم مساق مصغّر في أمن المعلومات", "تحليل جودة خدمات النقل الجامعي",
];

const PROJECT_STATUSES: ProjectDNA["status"][] = [
  "not_started", "ready", "in_progress", "blocked", "needs_review", "completed",
];

const SUBMISSION_STATUSES: CourseSubmissionRecord["status"][] = [
  "submitted", "grading", "graded", "released", "returned",
];

const DEMO_LEARNING_SUMMARIES = [
  "شرح في جلسة الشفهي لماذا اختار العيّنة العشوائية الطبقية بدل الملائمة.",
  "أعاد كتابة الفرضية الثانية بعد ملاحظة الأستاذ وربطها بالبيانات.",
  "حسم تعارضًا بين مصدرين حول أثر التعلّم المدمج مستندًا إلى حجم العينة.",
  "وثّق قرار استبعاد 14 استجابة ناقصة وأثره على النتائج.",
  "بنى جدولًا يربط كل معيار في الـRubric بقسم في التقرير.",
];

const DEMO_VIVA_QUESTIONS: ReadonlyArray<readonly [string, string, string]> = [
  ["اشرح بكلماتك سؤال البحث الرئيسي، ولماذا يهمّ في السياق الكويتي؟", "فهم المشكلة", "السؤال عن أثر التعلّم المدمج على الحضور، ويهمّ لأن جامعات الكويت توسّعت فيه بعد 2020."],
  ["لماذا اخترت هذه المنهجية دون غيرها؟", "المنهجية", "لأن البيانات كمية ومتاحة من نظام الحضور، فالتحليل الإحصائي أنسب من المقابلات."],
  ["ما أضعف نقطة في نتائجك، وكيف تعاملت معها؟", "التفكير النقدي", "حجم العينة في الشعبة المسائية صغير، فذكرته صراحةً في حدود الدراسة."],
  ["أين استعنت بالذكاء الاصطناعي، وكيف تحقّقت من مخرجاته؟", "النزاهة", "في المراجعة اللغوية فقط، وراجعت كل تعديل يدويًا وأفصحت عنه في الملحق."],
];

const DEMO_TICKET_BODIES = [
  "حاولت رفع التقرير بصيغة PDF أكثر من مرة وتظهر رسالة انتهاء المهلة عند 90٪.",
  "أرجو تمديد موعد التسليم يومين بسبب عذر طبي مرفق من المستوصف.",
  "هل يُسمح باستخدام أداة ذكاء اصطناعي لتلخيص المصادر في التسليم الثاني؟",
  "رمز الانضمام الذي أرسله الأستاذ يظهر أنه منتهي الصلاحية.",
];

function aiPolicy(level: AIUsagePolicy["level"]): AIUsagePolicy {
  return {
    level,
    summary:
      level <= 1 ? "الاستعانة بالذكاء الاصطناعي غير مسموحة في هذا التسليم."
      : level <= 3 ? "الاستعانة مسموحة للتخطيط والمراجعة مع إفصاح إلزامي."
      : "الاستعانة مسموحة على نطاق واسع مع توثيق كامل لكل استخدام.",
    allowed: level <= 1 ? [] : level <= 3 ? ["العصف الذهني", "مراجعة لغوية"] : ["العصف الذهني", "مراجعة لغوية", "توليد مسودات", "تحليل بيانات"],
    prohibited: level <= 1 ? ["أي توليد نص", "أي تحليل آلي"] : level <= 3 ? ["توليد نص التسليم النهائي"] : [],
    disclosureRequired: level >= 1,
    provenance: "published_assignment",
  };
}

/*
 * بنية المشروع: المتطلبات والمخرجات والمعايير والمهام.
 *
 * كانت هذه الحقول فارغة في كل مشروع، فتفتح تبويبات الخطة والمتطلبات والمعايير
 * على فراغ، وتبقى صفحة المهارات والجواز خاليةً لأنها تُبنى من المهام المكتملة.
 * تُشتق هنا من التكليف المنشور نفسه، وتتدرّج حالتها مع نسبة التقدّم، فيبقى ما
 * يراه الزائر متّسقًا بين المشروع وتسليمه ودرجته.
 */
const DEMO_TASKS: ReadonlyArray<readonly [string, string, ProjectTask["module"], number]> = [
  ["تحليل كراسة التكليف", "استخراج المتطلبات ومعايير التقييم وسياسة الذكاء الاصطناعي.", "research", 60],
  ["جمع المصادر وتوثيقها", "ثمانية مصادر محكّمة على الأقل، منها مصدران خليجيان.", "research", 150],
  ["بناء المنهجية", "تحديد أداة جمع البيانات وحجم العينة وحدود الدراسة.", "writing", 120],
  ["تحليل النتائج", "تحليل البيانات وربط كل نتيجة بالسؤال البحثي.", "data", 180],
  ["كتابة المسودة الأولى", "المقدمة والمنهجية والنتائج مع الإحالات.", "writing", 240],
  ["تجهيز العرض التقديمي", "عشر شرائح تلخّص المشكلة والمنهجية وأهم النتائج.", "presentation", 90],
  ["المراجعة النهائية والإفصاح", "مراجعة الاستشهادات وكتابة إفصاح استخدام الذكاء الاصطناعي.", "writing", 45],
];

function demoProjectStructure(
  projectId: string,
  assignment: CourseAssignmentRecord,
  progress: number,
  ownerId: string,
): Pick<ProjectDNA, "workspaceModules" | "requirements" | "deliverables" | "rubric" | "tasks" | "originalAssignment"> {
  const done = Math.round((progress / 100) * DEMO_TASKS.length);
  const final = assignment.deadline || ahead(14);
  const tasks: ProjectTask[] = DEMO_TASKS.map(([title, description, module, minutes], i) => ({
    id: `task_${projectId}_${i + 1}`,
    title,
    description,
    module,
    estimatedMinutes: minutes,
    assigneeId: ownerId,
    status: i < done ? "completed" : i === done ? "in_progress" : i === done + 1 ? "ready" : "not_started",
    dueDate: new Date(Date.parse(final) - (DEMO_TASKS.length - i) * 2 * day).toISOString(),
    ...(i > 0 ? { dependencyIds: [`task_${projectId}_${i}`] } : {}),
  }));
  const deliverables: Deliverable[] = assignment.deliverables.map((d, i) => ({
    id: d.id,
    title: d.title,
    format: d.format,
    deadline: final,
    ownerId,
    requirementSource: "كراسة التكليف",
    validationRules: d.format === "PDF" ? ["صيغة PDF", "لا يتجاوز 20 صفحة", "إفصاح الذكاء الاصطناعي في الملحق"] : [`صيغة ${d.format}`],
    status: progress >= 100 ? "completed" : progress >= 60 - i * 10 ? "ready" : progress > 0 ? "in_progress" : "pending",
  }));
  const readiness: RubricCriterion["readiness"][] =
    progress >= 100 ? ["covered", "covered", "covered"]
    : progress >= 50 ? ["covered", "partial", "not_evidenced"]
    : progress > 0 ? ["partial", "not_evidenced", "needs_revision"]
    : ["not_evidenced", "not_evidenced", "not_evidenced"];
  const rubric: RubricCriterion[] = assignment.rubric.map((r, i) => ({
    ...r,
    readiness: readiness[i % readiness.length],
    evidenceIds: progress > 0 ? [`demo_pevidence_${projectId}_${(i % 4) + 1}`] : [],
    levels: [
      { title: "متميّز", description: "يستوفي المعيار بعمق ومع أدلة واضحة.", points: r.weighting },
      { title: "جيد", description: "يستوفي المعيار مع بعض الثغرات.", points: Math.round(r.weighting * 0.75) },
      { title: "مقبول", description: "استيفاء جزئي يحتاج مراجعة.", points: Math.round(r.weighting * 0.5) },
    ],
  }));
  const requirements: Requirement[] = [
    { id: `req_${projectId}_1`, label: "الموعد النهائي", value: new Date(final).toLocaleDateString("ar-KW", { timeZone: "Asia/Kuwait" }), category: "deadline", confidence: "high", source: "كراسة التكليف — الصفحة 1" },
    { id: `req_${projectId}_2`, label: "صيغة التسليم", value: assignment.deliverables.map((d) => `${d.title} (${d.format})`).join("، "), category: "format", confidence: "high", source: "كراسة التكليف — قسم المخرجات" },
    { id: `req_${projectId}_3`, label: "المصادر", value: "ثمانية مصادر محكّمة على الأقل بأسلوب توثيق موحّد", category: "source", confidence: "medium", source: "كراسة التكليف — قسم التقييم" },
    { id: `req_${projectId}_4`, label: "سياسة الذكاء الاصطناعي", value: assignment.aiPolicy.summary, category: "policy", confidence: "high", source: "سياسة المقرر المنشورة" },
    { id: `req_${projectId}_5`, label: "طريقة العمل", value: assignment.groupMode === "group" ? "عمل جماعي (3–4 طلاب) مع توزيع أدوار موثّق" : "عمل فردي", category: "team", confidence: assignment.groupMode === "group" ? "high" : "needs_confirmation", source: "كراسة التكليف" },
  ];
  return {
    workspaceModules: ["research", "writing", "data", "presentation"],
    requirements,
    deliverables,
    rubric,
    tasks,
    // نص الكراسة الأصلي، حتى يعمل زر «عرض الكراسة الأصلية» بدل أن يبقى معطّلًا.
    originalAssignment: {
      fileName: `${assignment.title}.pdf`,
      fileType: "application/pdf",
      text: [
        assignment.title,
        "",
        assignment.instructions,
        "",
        "المخرجات المطلوبة:",
        ...assignment.deliverables.map((d) => `• ${d.title} (${d.format})`),
        "",
        "معايير التقييم:",
        ...assignment.rubric.map((r) => `• ${r.title} — ${r.weighting}٪: ${r.description}`),
        "",
        `سياسة الذكاء الاصطناعي: ${assignment.aiPolicy.summary}`,
      ].join("\n"),
    },
  };
}

function buildSandbox(): DemoFirestore {
  const random = makeRandom(0xac05);
  const store = createDemoFirestore();
  const now = new Date().toISOString();

  const rows = (items: { id: string; data: Record<string, unknown> }[]) => items;

  // Tenant and institution
  store.seed("tenants", [
    {
      id: DEMO_TENANT_ID,
      data: {
        id: DEMO_TENANT_ID,
        name: "جامعة الخليج التطبيقية (بيئة تجريبية)",
        plan: "institution",
        status: "active",
        seats: 1200,
        createdAt: ago(240),
        updatedAt: now,
      },
    },
  ]);

  // People: staff plus a cohort of students.
  const students = STUDENT_NAMES.map((name, index) => ({
    userId: `demo_user_student_${index + 1}`,
    name,
  }));

  const profiles: { id: string; data: Record<string, unknown> }[] = [];
  const members: { id: string; data: Record<string, unknown> }[] = [];

  STAFF.forEach(([userId, displayName, role]) => {
    const profile: UserProfile = {
      userId,
      tenantId: DEMO_TENANT_ID,
      displayName,
      email: `${userId}@demo.academicos.test`,
      language: "ar",
      country: "KW",
      university: "جامعة الخليج التطبيقية",
      specialization: "أعضاء هيئة التدريس",
      academicTerm: "الفصل الأول 2026/2027",
      onboardingCompleted: true,
      updatedAt: now,
    };
    profiles.push({ id: userId, data: profile as unknown as Record<string, unknown> });
    members.push({
      id: `${DEMO_TENANT_ID}__${userId}`,
      data: { id: `${DEMO_TENANT_ID}__${userId}`, tenantId: DEMO_TENANT_ID, userId, role, status: "active", createdAt: ago(200), updatedAt: now },
    });
  });

  students.forEach(({ userId, name }, index) => {
    const profile: UserProfile = {
      userId,
      tenantId: DEMO_TENANT_ID,
      displayName: name,
      email: `${userId}@demo.academicos.test`,
      language: "ar",
      country: "KW",
      university: "جامعة الخليج التطبيقية",
      specialization: pick(["علوم الحاسب", "إدارة الأعمال", "التربية", "القانون", "علم البيانات"], index),
      studyYear: String(2 + (index % 3)),
      academicTerm: "الفصل الأول 2026/2027",
      onboardingCompleted: index % 9 !== 0 || index === 0,
      // جواز الطالب الأول يعرض مشروعيه المنجزَين بدل قائمة فارغة.
      ...(index === 0 ? { passportProjectIds: ["demo_project_1_3", "demo_project_1_2"], passportVisibility: "shared_link" as const, dailyStudyMinutes: 150 } : {}),
      updatedAt: ago(index % 14),
    };
    profiles.push({ id: userId, data: profile as unknown as Record<string, unknown> });
    members.push({
      id: `${DEMO_TENANT_ID}__${userId}`,
      data: { id: `${DEMO_TENANT_ID}__${userId}`, tenantId: DEMO_TENANT_ID, userId, role: "student", status: "active", createdAt: ago(150 - index), updatedAt: now },
    });
  });

  store.seed("profiles", profiles);
  store.seed("tenantMembers", members);
  store.seed(
    "users",
    profiles.map(({ id, data }) => ({
      id,
      data: { id, uid: id, tenantId: DEMO_TENANT_ID, displayName: (data as any).displayName, email: (data as any).email, createdAt: ago(120) },
    })),
  );

  // Courses, enrollments, assignments
  const courses: { id: string; data: Record<string, unknown> }[] = [];
  const enrollments: { id: string; data: Record<string, unknown> }[] = [];
  const assignments: { id: string; data: Record<string, unknown> }[] = [];
  const joinCodes: { id: string; data: Record<string, unknown> }[] = [];

  COURSES.forEach(([code, title, description, outcomes], courseIndex) => {
    const courseId = `demo_course_${courseIndex + 1}`;
    const course: CourseRecord = {
      id: courseId,
      tenantId: DEMO_TENANT_ID,
      ownerId: courseIndex % 3 === 1 ? "demo_user_ta" : DEMO_INSTRUCTOR_ID,
      code,
      title,
      term: "الفصل الأول 2026/2027",
      description,
      // «التفكير النقدي» مشترك بين ثلاثة مقررات، فيظهر تكراره في التوأم الأكاديمي.
      outcomes: courseIndex < 3 ? [...outcomes, "التفكير النقدي"] : [...outcomes],
      aiPolicy: aiPolicy((courseIndex % 5) as AIUsagePolicy["level"]),
      status: courseIndex === COURSES.length - 1 ? "draft" : "active",
      createdAt: ago(120 - courseIndex * 5),
      updatedAt: ago(courseIndex),
    };
    courses.push({ id: courseId, data: course as unknown as Record<string, unknown> });

    joinCodes.push({
      id: `demo_join_${courseIndex + 1}`,
      data: {
        id: `demo_join_${courseIndex + 1}`,
        tenantId: DEMO_TENANT_ID,
        courseId,
        code: `${code}-${String(1000 + courseIndex * 37)}`,
        createdBy: course.ownerId,
        status: courseIndex % 4 === 0 ? "revoked" : "active",
        maxRedemptions: 60,
        redemptions: 18 + courseIndex * 3,
        expiresAt: ahead(30),
        createdAt: ago(100),
        updatedAt: ago(courseIndex),
      },
    });

    // A believable roster: most students in most courses, not all in all.
    students.forEach(({ userId }, studentIndex) => {
      // الطالب الأول مسجَّل في كل المقررات: مشاريعه موزّعة عليها، ولولا ذلك لرُفضت
      // توضيحات تكليفاته داخل المشروع لأنه «غير مسجّل».
      if (studentIndex !== 0 && (studentIndex + courseIndex) % 3 === 0) return;
      const enrollment: CourseEnrollmentRecord = {
        id: `${courseId}__${userId}`,
        tenantId: DEMO_TENANT_ID,
        courseId,
        userId,
        role: "student",
        status: studentIndex !== 0 && studentIndex % 17 === 0 ? "withdrawn" : "active",
        source: pick(["join_code", "invite", "roster", "sis"] as const, studentIndex + courseIndex),
        createdAt: ago(90 - studentIndex),
        updatedAt: ago(studentIndex % 20),
      };
      enrollments.push({ id: enrollment.id, data: enrollment as unknown as Record<string, unknown> });
    });

    // المساعد التدريسي مسجَّل مساعدًا في كل مقرر، فيرى تكليفاته وتوضيحاتها.
    enrollments.push({
      id: `${courseId}__demo_user_ta`,
      data: { id: `${courseId}__demo_user_ta`, tenantId: DEMO_TENANT_ID, courseId, userId: "demo_user_ta", role: "teaching_assistant", status: "active", source: "roster", createdAt: ago(100), updatedAt: ago(5) },
    });

    // Two or three assignments per course, one still in draft.
    const assignmentCount = 2 + (courseIndex % 2);
    for (let n = 0; n < assignmentCount; n += 1) {
      const assignmentId = `demo_assignment_${courseIndex + 1}_${n + 1}`;
      const assignment: CourseAssignmentRecord = {
        id: assignmentId,
        tenantId: DEMO_TENANT_ID,
        courseId,
        createdBy: course.ownerId,
        title: `${title} — التسليم ${n + 1}`,
        instructions: `اقرأ كراسة المشروع بعناية، وسلّم المخرجات المطلوبة قبل الموعد النهائي. ${description}`,
        deadline: n === 0 ? ago(10) : ahead(7 + n * 10),
        deliverables: [
          { id: `dl_${assignmentId}_1`, title: "التقرير النهائي", format: "PDF" },
          { id: `dl_${assignmentId}_2`, title: "العرض التقديمي", format: "PPTX" },
          ...(n === 1 ? [{ id: `dl_${assignmentId}_3`, title: "الكود المصدري", format: "ZIP" }] : []),
        ],
        rubric: [
          { id: `rb_${assignmentId}_1`, title: "جودة التحليل", description: "عمق التحليل ودقة الاستنتاجات.", weighting: 40 },
          { id: `rb_${assignmentId}_2`, title: "المنهجية", description: "وضوح المنهجية وملاءمتها.", weighting: 30 },
          { id: `rb_${assignmentId}_3`, title: "العرض والتوثيق", description: "التنظيم والاستشهاد الصحيح.", weighting: 30 },
        ],
        outcomes: [...outcomes].slice(0, 3),
        aiPolicy: aiPolicy(((courseIndex + n) % 5) as AIUsagePolicy["level"]),
        groupMode: n % 3 === 0 ? "group" : "individual",
        status: courseIndex === COURSES.length - 1 && n === 0 ? "draft" : "published",
        createdAt: ago(80 - courseIndex * 4 - n),
        updatedAt: ago(n),
      };
      assignments.push({ id: assignmentId, data: assignment as unknown as Record<string, unknown> });
    }
  });

  store.seed("courses", courses);
  store.seed("enrollments", enrollments);
  store.seed("assignments", assignments);
  store.seed("courseJoinCodes", joinCodes);

  // Projects — the unit AcademicOS actually works on.
  const projects: { id: string; data: Record<string, unknown> }[] = [];
  const projectMembers: { id: string; data: Record<string, unknown> }[] = [];
  const submissions: { id: string; data: Record<string, unknown> }[] = [];
  const evidence: { id: string; data: Record<string, unknown> }[] = [];
  const activity: { id: string; data: Record<string, unknown> }[] = [];
  const vivaSessions: { id: string; data: Record<string, unknown> }[] = [];

  const publishedAssignments = assignments.filter(
    (row) => (row.data as any).status === "published",
  );

  students.forEach(({ userId, name }, studentIndex) => {
    /* الطالب الأول هو من تفتح عليه شاشة الطالب، فيُعطى ثلاثة مشاريع في مراحل
     * مختلفة (جارٍ، بانتظار المراجعة، مكتمل) بدل مشروعٍ واحدٍ لم يبدأ. */
    const projectCount = studentIndex === 0 ? 5 : 1 + (studentIndex % 3);
    for (let n = 0; n < projectCount; n += 1) {
      const index = studentIndex === 0 && n >= 3 ? 100 + n : studentIndex * 3 + n;
      const assignmentRow = pick(publishedAssignments, index);
      const assignment = assignmentRow.data as unknown as CourseAssignmentRecord;
      const courseRow = courses.find((row) => row.id === assignment.courseId)!;
      const course = courseRow.data as unknown as CourseRecord;
      const projectId = `demo_project_${studentIndex + 1}_${n + 1}`;
      const status =
        studentIndex === 0
          ? (["in_progress", "needs_review", "completed", "completed", "completed"] as const)[n]
          : pick(PROJECT_STATUSES, index);
      const progress =
        studentIndex === 0 && n === 0 ? 58
        : status === "completed" ? 100 : status === "not_started" ? 0 : 15 + Math.floor(random() * 70);

      const project: ProjectDNA = {
        id: projectId,
        revision: 1 + (index % 5),
        userId,
        tenantId: DEMO_TENANT_ID,
        title: pick(PROJECT_TITLES, index),
        course: `${course.code} — ${course.title}`,
        instructor: "د. سارة الخالد",
        projectType: pick(["تقرير بحثي", "مشروع تطبيقي", "دراسة حالة", "مراجعة أدبيات"], index),
        academicDomain: course.title,
        language: "ar",
        complexity: pick(["low", "medium", "high"] as const, index),
        collaborationMode: assignment.groupMode === "group" ? "group" : "individual",
        requiredSkills: [...course.outcomes].slice(0, 3),
        learningOutcomes: [...assignment.outcomes],
        requiredActions: ["جمع المصادر", "بناء المنهجية", "تحليل النتائج", "كتابة التقرير"],
        ...demoProjectStructure(projectId, assignment, progress, userId),
        deadlines: {
          final: assignment.deadline,
          timezone: "Asia/Kuwait",
          milestones: [
            { id: `ms_${projectId}_1`, title: "اعتماد الخطة", date: ago(20) },
            { id: `ms_${projectId}_2`, title: "المسودة الأولى", date: ago(6) },
            { id: `ms_${projectId}_3`, title: "التسليم النهائي", date: assignment.deadline || ahead(14) },
          ],
        },
        citationStyle: pick(["APA 7", "IEEE", "Harvard"], index),
        // مربوط بالتكليف المنشور، فتعمل «مقارنة الفوج» وتوضيحات التكليف داخل المشروع.
        aiPolicy: { ...assignment.aiPolicy, assignmentId: assignment.id, courseId: assignment.courseId },
        // Risk flags are what the instructor dashboard is for. A board with no
        // flags anywhere would hide the feature entirely.
        riskFlags:
          // نمطٌ متكرّر لدى الطالب الأول، فيظهر في «الأنماط المتكررة» بالدماغ التعلّمي.
          studentIndex === 0 && n < 2 ? ["مصادر غير موثقة", "اقتراب الموعد النهائي مع تقدم منخفض"]
          : index % 5 === 0 ? ["اقتراب الموعد النهائي مع تقدم منخفض"]
          : index % 7 === 0 ? ["استخدام ذكاء اصطناعي بدون إفصاح", "مصادر غير موثقة"]
          : [],
        estimatedWorkloadHours: 12 + (index % 28),
        status,
        progress,
        nextAction: status === "completed" ? undefined : "إكمال قسم النتائج ومراجعة المصادر",
        createdAt: ago(70 - (index % 60)),
        updatedAt: ago(index % 12),
      };
      projects.push({ id: projectId, data: project as unknown as Record<string, unknown> });

      projectMembers.push({
        id: `${projectId}__${userId}`,
        data: { id: `${projectId}__${userId}`, tenantId: DEMO_TENANT_ID, projectId, userId, email: `${userId}@demo.academicos.test`, displayName: name, role: "leader", status: "active", invitedBy: userId, createdAt: project.createdAt, updatedAt: project.updatedAt },
      });

      /* Project activity is read out of the audit log, keyed on `tenant`/`target`
       * rather than the tenantId/projectId pair used elsewhere. Matching that
       * shape is what makes the project timeline populate. */
      ["أنشأ المشروع", "حدّث قسم المنهجية", "رفع مصدرًا جديدًا", "سجّل استخدام ذكاء اصطناعي", "سلّم النسخة النهائية"].forEach((action, a) => {
        const id = `demo_activity_${index + 1}_${a + 1}`;
        activity.push({
          id,
          data: { id, tenant: DEMO_TENANT_ID, target: projectId, actor: name, action, timestamp: ago((index % 12) + (4 - a)) },
        });
      });

      // Roughly two thirds of projects have reached a submission.
      if (index % 3 !== 2) {
        const submissionStatus = pick(SUBMISSION_STATUSES, index);
        const graded = submissionStatus === "graded" || submissionStatus === "released";
        const rubricGrades = assignment.rubric.map((criterion, r) => ({
          rubricId: criterion.id,
          title: criterion.title,
          maxPoints: criterion.weighting,
          awardedPoints: graded ? Math.round(criterion.weighting * (0.6 + random() * 0.4)) : 0,
          feedback: graded ? pick(["تحليل واضح ومسند.", "يحتاج تعميق في المقارنة.", "توثيق ممتاز للمصادر."], index + r) : undefined,
        }));
        const total = rubricGrades.reduce((sum, row) => sum + row.awardedPoints, 0);
        const submissionId = `demo_submission_${index + 1}`;
        const submission: CourseSubmissionRecord = {
          id: submissionId,
          tenantId: DEMO_TENANT_ID,
          courseId: assignment.courseId,
          assignmentId: assignment.id,
          projectId,
          studentId: userId,
          studentName: name,
          attempt: 1 + (index % 2),
          status: submissionStatus,
          submittedAt: ago(12 - (index % 11)),
          receiptHash: `demo${randomBytes(8).toString("hex")}`,
          projectRevision: project.revision || 1,
          audit: {} as CourseSubmissionRecord["audit"],
          snapshot: {
            projectTitle: project.title,
            deliverables: assignment.deliverables.map((d) => ({ id: d.id, title: d.title, format: d.format, status: "submitted" })),
            artifactIds: [],
            evidenceIds: [`demo_evidence_${index + 1}`],
          },
          rubricGrades,
          totalScore: graded ? total : undefined,
          maxScore: 100,
          feedback: graded ? "عمل جيد عمومًا؛ راجع دقة الاستشهادات في القسم الثالث." : undefined,
          gradedBy: graded ? DEMO_INSTRUCTOR_ID : undefined,
          gradedAt: graded ? ago(3) : undefined,
          releasedAt: submissionStatus === "released" ? ago(2) : undefined,
          returnedReason: submissionStatus === "returned" ? "الملف المرفوع غير مقروء — أعد الرفع بصيغة PDF." : undefined,
          updatedAt: ago(index % 6),
        };
        submissions.push({ id: submissionId, data: submission as unknown as Record<string, unknown> });
      }

      evidence.push({
        id: `demo_evidence_${index + 1}`,
        data: {
          id: `demo_evidence_${index + 1}`,
          tenantId: DEMO_TENANT_ID,
          projectId,
          userId,
          skill: pick(["التحليل النقدي", "المنهجية البحثية", "الكتابة الأكاديمية", "العمل الجماعي", "تصوير البيانات"], index),
          level: pick(["emerging", "developing", "proficient", "advanced"], index),
          summary: pick(DEMO_LEARNING_SUMMARIES, index),
          // شكل LearningEvidenceRecord الذي تقرؤه شاشات الشفهي والدماغ التعلّمي.
          source: pick(["viva", "revision", "decision", "manual"] as const, index),
          evidence: [
            { label: "المهارة", value: pick(["التحليل النقدي", "المنهجية البحثية", "الكتابة الأكاديمية", "العمل الجماعي", "تصوير البيانات"], index) },
            { label: "الدليل", value: pick(["شرح اختيار حجم العينة بلغته الخاصة", "عدّل الفرضية بعد ملاحظة الأستاذ", "قارن بين مصدرين متعارضين وحسم بينهما", "وثّق توزيع الأدوار داخل الفريق"], index) },
          ],
          confidence: Number((0.6 + random() * 0.38).toFixed(2)),
          createdAt: ago(index % 30),
          updatedAt: ago(index % 12),
        },
      });

      if (index % 6 === 0) {
        vivaSessions.push({
          id: `demo_viva_${index + 1}`,
          data: {
            id: `demo_viva_${index + 1}`,
            tenantId: DEMO_TENANT_ID,
            projectId,
            userId,
            status: index % 12 === 0 ? "completed" : "active",
            mode: pick(["normal", "strict", "easy"] as const, index),
            questions: DEMO_VIVA_QUESTIONS.map(([prompt, focus], q) => ({ id: `vq_${index + 1}_${q + 1}`, prompt, focus })),
            responses: DEMO_VIVA_QUESTIONS.slice(0, index % 12 === 0 ? 4 : 2).map(([, , answer], q) => ({ questionId: `vq_${index + 1}_${q + 1}`, answer, updatedAt: ago(index % 8) })),
            ...(index % 12 === 0 ? { completedAt: ago(index % 8) } : {}),
            questionCount: 4,
            score: index % 3 === 0 ? Number((60 + random() * 38).toFixed(1)) : undefined,
            createdAt: ago(index % 20),
            updatedAt: ago(index % 8),
          },
        });
      }
    }
  });

  /* The demo actor is the professor, and `buildDashboard` is scoped to projects
   * a user owns or belongs to. Without work of their own, the first screen a
   * visitor lands on would be empty while the rest of the tenant is full. */
  ["تطوير كراسة مشروع هندسة البرمجيات", "دراسة أثر سياسات الذكاء الاصطناعي على جودة التسليم", "إعادة تصميم تقويم مقرر تحليل البيانات", "مراجعة معايير النزاهة الأكاديمية", "دراسة جودة التغذية الراجعة في المقررات التطبيقية", "تقييم أثر المناقشات الشفهية على الفهم العميق"].forEach((title, n) => {
    const projectId = `demo_project_staff_${n + 1}`;
    const courseRow = courses[n % courses.length];
    const course = courseRow.data as unknown as CourseRecord;
    const status: ProjectDNA["status"] = n >= 4 ? "completed" : pick(PROJECT_STATUSES, n + 2);
    const project: ProjectDNA = {
      id: projectId,
      revision: 2 + n,
      userId: DEMO_INSTRUCTOR_ID,
      tenantId: DEMO_TENANT_ID,
      title,
      course: `${course.code} — ${course.title}`,
      instructor: "د. سارة الخالد",
      projectType: "مشروع تطوير أكاديمي",
      academicDomain: course.title,
      language: "ar",
      complexity: pick(["medium", "high"] as const, n),
      collaborationMode: "group",
      requiredSkills: [...course.outcomes].slice(0, 2),
      learningOutcomes: [...course.outcomes].slice(0, 3),
      requiredActions: ["مراجعة الأدبيات", "بناء المعايير", "تجريب على شعبة", "التوثيق"],
      ...demoProjectStructure(projectId, pick(publishedAssignments, n).data as unknown as CourseAssignmentRecord, 30 + n * 15, DEMO_INSTRUCTOR_ID),
      deadlines: {
        final: ahead(9 + n * 6),
        timezone: "Asia/Kuwait",
        milestones: [
          { id: `ms_${projectId}_1`, title: "اعتماد النطاق", date: ago(15) },
          { id: `ms_${projectId}_2`, title: "المسودة", date: ahead(2 + n) },
        ],
      },
      citationStyle: "APA 7",
      aiPolicy: aiPolicy(3),
      riskFlags: n === 1 ? ["اقتراب الموعد النهائي مع تقدم منخفض"] : [],
      estimatedWorkloadHours: 20 + n * 6,
      status,
      progress: status === "completed" ? 100 : 30 + n * 15,
      nextAction: "مراجعة نتائج التجريب مع منسق المقرر",
      createdAt: ago(45 - n * 5),
      updatedAt: ago(n),
    };
    projects.push({ id: projectId, data: project as unknown as Record<string, unknown> });
    projectMembers.push({
      id: `${projectId}__${DEMO_INSTRUCTOR_ID}`,
      data: { id: `${projectId}__${DEMO_INSTRUCTOR_ID}`, tenantId: DEMO_TENANT_ID, projectId, userId: DEMO_INSTRUCTOR_ID, email: `${DEMO_INSTRUCTOR_ID}@demo.academicos.test`, displayName: "د. سارة الخالد", role: "leader", status: "active", invitedBy: DEMO_INSTRUCTOR_ID, createdAt: project.createdAt, updatedAt: project.updatedAt },
    });
    ["أنشأ المشروع", "حدّث المعايير", "أضاف نتائج التجريب"].forEach((action, a) => {
      const id = `demo_activity_staff_${n + 1}_${a + 1}`;
      activity.push({ id, data: { id, tenant: DEMO_TENANT_ID, target: projectId, actor: "د. سارة الخالد", action, timestamp: ago(n + (3 - a)) } });
    });
    evidence.push({
      id: `demo_evidence_staff_${n + 1}`,
      data: {
        id: `demo_evidence_staff_${n + 1}`,
        tenantId: DEMO_TENANT_ID,
        projectId,
        userId: DEMO_INSTRUCTOR_ID,
        skill: pick(["تصميم التقويم", "المنهجية البحثية", "تحليل السياسات"], n),
        level: "advanced",
        summary: "صاغ معايير تقويم قابلة للقياس وجرّبها على شعبة فعلية.",
        source: "decision",
        evidence: [{ label: "المهارة", value: pick(["تصميم التقويم", "المنهجية البحثية", "تحليل السياسات"], n) }, { label: "الدليل", value: "نسخة المعايير المعتمدة ونتائج التجريب" }],
        confidence: 0.88,
        createdAt: ago(n + 3),
        updatedAt: ago(n),
      },
    });
  });

  store.seed("projects", projects);
  store.seed("projectMembers", projectMembers);
  store.seed("deliverables", []);
  store.seed("courseSubmissions", submissions);
  store.seed("learningEvidence", evidence);
  store.seed("auditLogs", activity);
  store.seed("vivaSessions", vivaSessions);

  // Support tickets, so the admin surface is not an empty table either.
  store.seed(
    "supportTickets",
    Array.from({ length: 14 }, (_, index) => ({
      id: `demo_ticket_${index + 1}`,
      data: {
        id: `demo_ticket_${index + 1}`,
        tenantId: DEMO_TENANT_ID,
        userId: pick(students, index).userId,
        userName: pick(students, index).name,
        displayName: pick(students, index).name,
        email: `${pick(students, index).userId}@demo.academicos.test`,
        category: pick(["technical", "academic", "academic", "account"] as const, index),
        subject: pick(["تعذر رفع ملف التسليم", "طلب تمديد الموعد النهائي", "سؤال عن سياسة الذكاء الاصطناعي", "مشكلة في رمز الانضمام"], index),
        body: pick(DEMO_TICKET_BODIES, index),
        message: pick(DEMO_TICKET_BODIES, index),
        status: pick(["open", "in_progress", "resolved"], index),
        priority: pick(["normal", "important", "critical"], index),
        ...(index % 3 === 1 ? { assignedTo: "demo_user_admin" } : {}),
        createdAt: ago(index % 25),
        updatedAt: ago(index % 9),
      },
    })),
  );

  // الطبقة الثانية: كل ما تقرؤه الشاشات خارج الهيكل الأساسي (انظر demoSeedDepth.ts).
  seedDemoDepth(store, { tenantId: DEMO_TENANT_ID, students, courses, assignments, projects });

  return store;
}

/*
 * كل صندوق كان نسخةً مزروعة كاملة (~3.3 MiB). البذرة الآن تُبنى مرةً وتُجمَّد،
 * ويأخذ كل زائر «تفرّعًا» يشاركها المستندات ولا ينسخ إلا ما يكتبه (نسخ عند الكتابة).
 * تُعاد البذرة كل ربع ساعة كي تبقى التواريخ النسبية (قبل يومين، بعد 3 أيام) صادقة.
 */
const TEMPLATE_TTL_MS = 15 * 60_000;
let template: { store: DemoFirestore; builtAt: number } | null = null;
function forkSandbox(): DemoFirestore {
  if (!template || Date.now() - template.builtAt > TEMPLATE_TTL_MS) {
    const store = buildSandbox();
    store.freeze();
    template = { store, builtAt: Date.now() };
  }
  return template.store.fork();
}

type SandboxRecord = { store: DemoFirestore; expiresAt: number };
const context = new AsyncLocalStorage<{ sessionId: string; store: DemoFirestore }>();
const sandboxes = new Map<string, SandboxRecord>();
const MAX_SANDBOXES = Number(process.env.ACADEMICOS_DEMO_MAX_SESSIONS || 300);

function sweep(): void {
  const now = Date.now();
  for (const [id, record] of sandboxes)
    if (record.expiresAt <= now) sandboxes.delete(id);
}

export const DemoSandbox = {
  isDemoRequest: (): boolean => Boolean(context.getStore()),
  currentFirestore: (): DemoFirestore | null => context.getStore()?.store || null,
  currentSessionId: (): string => context.getStore()?.sessionId || "",

  create(ttlMs: number = DEMO_SESSION_TTL_MS): string {
    sweep();
    // سقفٌ للذاكرة: كل صندوق نسخة مزروعة كاملة، فلا يُترك عددها مفتوحًا لطلبات مجهولة.
    if (sandboxes.size >= MAX_SANDBOXES)
      throw Object.assign(new Error("Demo is at capacity, try again shortly"), { status: 503, code: "DEMO_CAPACITY" });
    const sessionId = `${DEMO_TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
    sandboxes.set(sessionId, { store: forkSandbox(), expiresAt: Date.now() + ttlMs });
    return sessionId;
  },

  reset(sessionId: string, ttlMs: number = DEMO_SESSION_TTL_MS): boolean {
    if (!sessionId.startsWith(DEMO_TOKEN_PREFIX) || !sandboxes.has(sessionId)) return false;
    sandboxes.set(sessionId, { store: forkSandbox(), expiresAt: Date.now() + ttlMs });
    return true;
  },

  destroy(sessionId: string): void {
    sandboxes.delete(sessionId);
  },

  has(sessionId: string): boolean {
    const record = sandboxes.get(sessionId);
    if (!record) return false;
    if (record.expiresAt <= Date.now()) {
      sandboxes.delete(sessionId);
      return false;
    }
    return true;
  },

  /** Runs `fn` bound to the visitor's sandbox. Returns false when the session has expired. */
  run(sessionId: string, ttlMs: number, fn: () => void): boolean {
    const record = sandboxes.get(sessionId);
    if (!record || record.expiresAt <= Date.now()) {
      sandboxes.delete(sessionId);
      return false;
    }
    record.expiresAt = Date.now() + ttlMs;
    context.run({ sessionId, store: record.store }, fn);
    return true;
  },

  stats(sessionId: string): Record<string, number> {
    return sandboxes.get(sessionId)?.store.stats() || {};
  },
};

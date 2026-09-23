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
import type {
  AIUsagePolicy,
  CourseAssignmentRecord,
  CourseEnrollmentRecord,
  CourseRecord,
  CourseSubmissionRecord,
  ProjectDNA,
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
  role: "professor" | "teaching_assistant" | "university_admin" | "student";
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
      onboardingCompleted: index % 9 !== 0,
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
      outcomes: [...outcomes],
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
      if ((studentIndex + courseIndex) % 3 === 0) return;
      const enrollment: CourseEnrollmentRecord = {
        id: `${courseId}__${userId}`,
        tenantId: DEMO_TENANT_ID,
        courseId,
        userId,
        role: studentIndex === 0 && courseIndex === 0 ? "teaching_assistant" : "student",
        status: studentIndex % 17 === 0 ? "withdrawn" : "active",
        source: pick(["join_code", "invite", "roster", "sis"] as const, studentIndex + courseIndex),
        createdAt: ago(90 - studentIndex),
        updatedAt: ago(studentIndex % 20),
      };
      enrollments.push({ id: enrollment.id, data: enrollment as unknown as Record<string, unknown> });
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
    const projectCount = 1 + (studentIndex % 3);
    for (let n = 0; n < projectCount; n += 1) {
      const index = studentIndex * 3 + n;
      const assignmentRow = pick(publishedAssignments, index);
      const assignment = assignmentRow.data as unknown as CourseAssignmentRecord;
      const courseRow = courses.find((row) => row.id === assignment.courseId)!;
      const course = courseRow.data as unknown as CourseRecord;
      const projectId = `demo_project_${studentIndex + 1}_${n + 1}`;
      const status = pick(PROJECT_STATUSES, index);
      const progress =
        status === "completed" ? 100 : status === "not_started" ? 0 : 15 + Math.floor(random() * 70);

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
        workspaceModules: [],
        requirements: [],
        deliverables: [],
        rubric: [],
        tasks: [],
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
        aiPolicy: assignment.aiPolicy,
        // Risk flags are what the instructor dashboard is for. A board with no
        // flags anywhere would hide the feature entirely.
        riskFlags:
          index % 5 === 0 ? ["اقتراب الموعد النهائي مع تقدم منخفض"]
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
        data: { id: `${projectId}__${userId}`, tenantId: DEMO_TENANT_ID, projectId, userId, displayName: name, role: "owner", status: "active", createdAt: project.createdAt, updatedAt: project.updatedAt },
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
          summary: "دليل تعلّم مستخرج من نشاط الطالب داخل المشروع.",
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
            status: pick(["scheduled", "in_progress", "completed"], index),
            questionCount: 6,
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
  ["تطوير كراسة مشروع هندسة البرمجيات", "دراسة أثر سياسات الذكاء الاصطناعي على جودة التسليم", "إعادة تصميم تقويم مقرر تحليل البيانات", "مراجعة معايير النزاهة الأكاديمية"].forEach((title, n) => {
    const projectId = `demo_project_staff_${n + 1}`;
    const courseRow = courses[n % courses.length];
    const course = courseRow.data as unknown as CourseRecord;
    const status = pick(PROJECT_STATUSES, n + 2);
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
      workspaceModules: [],
      requirements: [],
      deliverables: [],
      rubric: [],
      tasks: [],
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
      data: { id: `${projectId}__${DEMO_INSTRUCTOR_ID}`, tenantId: DEMO_TENANT_ID, projectId, userId: DEMO_INSTRUCTOR_ID, displayName: "د. سارة الخالد", role: "owner", status: "active", createdAt: project.createdAt, updatedAt: project.updatedAt },
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
        summary: "دليل تعلّم مستخرج من نشاط المشروع.",
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
        subject: pick(["تعذر رفع ملف التسليم", "طلب تمديد الموعد النهائي", "سؤال عن سياسة الذكاء الاصطناعي", "مشكلة في رمز الانضمام"], index),
        body: "رسالة دعم مصطنعة في البيئة التجريبية.",
        status: pick(["open", "in_progress", "resolved"], index),
        priority: pick(["low", "normal", "high"], index),
        createdAt: ago(index % 25),
        updatedAt: ago(index % 9),
      },
    })),
  );

  return store;
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
    sandboxes.set(sessionId, { store: buildSandbox(), expiresAt: Date.now() + ttlMs });
    return sessionId;
  },

  reset(sessionId: string, ttlMs: number = DEMO_SESSION_TTL_MS): boolean {
    if (!sessionId.startsWith(DEMO_TOKEN_PREFIX) || !sandboxes.has(sessionId)) return false;
    sandboxes.set(sessionId, { store: buildSandbox(), expiresAt: Date.now() + ttlMs });
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

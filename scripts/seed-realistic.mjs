/**
 * Realistic, deterministic, idempotent seed for the local Firebase emulators.
 *
 *   npm run emulators            # terminal 1
 *   npm run emulators:seed:realistic [-- --students=1000 --teachers=50]   # terminal 2
 *
 * Creates (fixed IDs, seeded PRNG, fixed base date -> re-running overwrites the
 * same documents and never duplicates): teachers, students, staff roles, courses,
 * enrolments, assignments, projects + artifacts + evidence, submissions in every
 * state, grades, subscriptions / transactions / project entitlements,
 * notifications, profiles and a few support tickets.
 *
 * This is NOT the demo sandbox: all data lands in the real (emulated) Firestore
 * and Auth, so the production code path is what gets exercised.
 * Login: <email> / AcademicOS!Seed2026   (emails printed at the end)
 */
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)
  throw new Error("Refusing to seed without FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST");
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "academicos-local";
initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
const auth = getAuth();

const arg = (name, dflt) => {
  const hit = process.argv.find((x) => x.startsWith(`--${name}=`));
  const n = hit ? Number(hit.split("=")[1]) : dflt;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : dflt;
};
const TEACHERS = arg("teachers", 50);
const STUDENTS = arg("students", 1000);
export const SEED_PASSWORD = "AcademicOS!Seed2026";
const tenantId = "seed-university";
const BASE = Date.parse("2026-09-01T08:00:00Z");

// ---- deterministic PRNG -------------------------------------------------
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261018);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const iso = (offsetDays, hour = 0) => new Date(BASE + offsetDays * 86400000 + hour * 3600000).toISOString();
const sha = (s) => createHash("sha256").update(s).digest("hex");
const pad = (n, w = 4) => String(n).padStart(w, "0");

// ---- Arabic-realistic content ------------------------------------------
const MALE = ["محمد", "أحمد", "عبدالله", "خالد", "فهد", "سلمان", "يوسف", "عمر", "ناصر", "سعود", "بدر", "فيصل", "مشاري", "طلال", "حمد", "راشد", "علي", "حسن", "إبراهيم", "عبدالرحمن", "مبارك", "جاسم", "ماجد", "تركي"];
const FEMALE = ["فاطمة", "نورة", "سارة", "مريم", "هند", "لولوة", "دانة", "ريم", "شيخة", "العنود", "منى", "أمل", "هيا", "جود", "غدير", "لطيفة", "عائشة", "زينب", "أسماء", "بشاير", "شهد", "حصة", "ليلى", "رهف"];
const FAMILY = ["العتيبي", "المطيري", "الرشيدي", "العنزي", "الدوسري", "الشمري", "الخالدي", "الكندري", "العجمي", "الهاجري", "الصباح", "البلوشي", "الحربي", "القحطاني", "الزهراني", "الغامدي", "السبيعي", "المنصوري", "الفضلي", "الأنصاري", "بوشهري", "الصالح", "النجار", "الحداد"];
const SPECIALIZATIONS = ["علوم الحاسوب", "إدارة الأعمال", "الهندسة المدنية", "الصيدلة", "التمريض", "علم النفس", "الإعلام", "القانون", "الاقتصاد", "الأحياء", "الكيمياء", "اللغة الإنجليزية"];
const COURSE_TITLES = [
  ["CS101", "مقدمة في البرمجة"], ["CS210", "هياكل البيانات"], ["CS330", "قواعد البيانات"], ["BUS110", "مبادئ الإدارة"], ["BUS240", "التسويق الرقمي"],
  ["ECO101", "مبادئ الاقتصاد الجزئي"], ["PSY120", "علم النفس العام"], ["PSY305", "مناهج البحث في علم النفس"], ["ENG150", "الكتابة الأكاديمية"], ["LAW201", "مدخل إلى القانون التجاري"],
  ["BIO130", "الأحياء العامة"], ["CHM140", "الكيمياء العضوية"], ["NUR220", "أساسيات التمريض"], ["MED210", "علم الأدوية"], ["MED305", "الصيدلة السريرية"], ["CIV250", "ميكانيكا التربة"],
  ["MAS110", "مقدمة في الإعلام"], ["STA201", "الإحصاء التطبيقي"], ["MTH101", "التفاضل والتكامل"], ["ENT300", "ريادة الأعمال"],
];
const ASSIGNMENT_TITLES = ["تقرير بحثي", "دراسة حالة", "مشروع تطبيقي", "ورقة تحليلية", "عرض تقديمي جماعي", "تحليل بيانات", "مراجعة أدبيات", "تقرير مختبر"];
const SNIPPETS = [
  "تناولت الدراسة العلاقة بين المتغيّرات الرئيسية مع توثيق المصادر وفق نمط APA.",
  "أظهرت النتائج الأولية فروقًا ذات دلالة إحصائية عند مستوى 0.05.",
  "اعتمد التحليل على بيانات ثانوية من مصادر رسمية موثوقة مع مراجعة منهجية.",
  "نوقشت القيود المنهجية واقتُرحت توصيات للدراسات المستقبلية.",
];
const AI_POLICIES = [
  { level: 1, summary: "ممنوع استخدام الذكاء الاصطناعي", allowed: [], prohibited: ["generation"], disclosureRequired: false, needsConfirmation: false },
  { level: 2, summary: "مسموح للتخطيط فقط", allowed: ["planning"], prohibited: ["ghostwriting"], disclosureRequired: false, needsConfirmation: false },
  { level: 3, summary: "مسموح مع الإفصاح", allowed: ["planning", "feedback"], prohibited: [], disclosureRequired: true, needsConfirmation: false },
];

const writes = []; // {ref, data}
const put = (col, id, data) => writes.push({ ref: db.collection(col).doc(id), data });

async function upsertUser(uid, email, displayName, claims) {
  try {
    await auth.createUser({ uid, email, password: SEED_PASSWORD, emailVerified: true, displayName });
  } catch (e) {
    if (e?.code !== "auth/uid-already-exists" && e?.code !== "auth/email-already-exists") throw e;
    await auth.updateUser(uid, { email, password: SEED_PASSWORD, emailVerified: true, displayName });
  }
  await auth.setCustomUserClaims(uid, { ...claims, tenantId, emulatorMfaEnrolled: true });
}
async function inChunks(items, size, fn) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

const fullName = (i, female) => `${pick(female ? FEMALE : MALE)} ${pick(MALE)} ${pick(FAMILY)}`;
const started = Date.now();

// ---- users ----------------------------------------------------------------
const staff = [
  ["seed-root", "root@seed.academicos.local", "المالك الجذر", "root_owner"],
  ["seed-superadmin", "superadmin@seed.academicos.local", "مدير المنصة", "superadmin"],
  ["seed-university-admin", "univadmin@seed.academicos.local", "د. عبدالعزيز الكندري", "university_admin"],
  ["seed-dept-admin", "deptadmin@seed.academicos.local", "د. هدى الرشيدي", "department_admin"],
  ["seed-support", "support@seed.academicos.local", "وكيل الدعم", "support_agent"],
  ["seed-finance", "finance@seed.academicos.local", "مسؤول المالية", "finance_admin"],
  ["seed-ta", "ta@seed.academicos.local", "م. سلمى العنزي", "teaching_assistant"],
  ["seed-employer", "employer@seed.academicos.local", "شركة الخليج للتقنية", "employer"],
];
const teachers = Array.from({ length: TEACHERS }, (_, i) => {
  const female = i % 3 === 0;
  return { uid: `seed-teacher-${pad(i + 1)}`, email: `teacher${pad(i + 1)}@seed.academicos.local`, name: `د. ${fullName(i, female)}`, spec: SPECIALIZATIONS[i % SPECIALIZATIONS.length] };
});
const students = Array.from({ length: STUDENTS }, (_, i) => {
  const female = i % 2 === 1;
  return { uid: `seed-student-${pad(i + 1)}`, email: `student${pad(i + 1)}@seed.academicos.local`, name: fullName(i, female), spec: SPECIALIZATIONS[i % SPECIALIZATIONS.length], year: String((i % 4) + 1) };
});
console.log(`Seeding ${staff.length} staff + ${teachers.length} teachers + ${students.length} students ...`);
await inChunks(staff, 8, (s) => upsertUser(s[0], s[1], s[2], { role: s[3] }));
await inChunks(teachers, 25, (t) => upsertUser(t.uid, t.email, t.name, { role: "professor" }));
await inChunks(students, 25, (s) => upsertUser(s.uid, s.email, s.name, { role: "student" }));

const nowAt = iso(0);
put("tenants", tenantId, { id: tenantId, name: "جامعة البذرة التجريبية", status: "active", createdAt: iso(-200), updatedAt: nowAt });
for (const s of staff) put("users", s[0], { id: s[0], tenantId, email: s[1], displayName: s[2], role: s[3], status: "active", createdAt: iso(-200), updatedAt: nowAt });
for (const t of teachers) {
  put("users", t.uid, { id: t.uid, tenantId, email: t.email, displayName: t.name, role: "professor", status: "active", createdAt: iso(-180), updatedAt: nowAt });
  put("profiles", t.uid, { userId: t.uid, tenantId, displayName: t.name, email: t.email, language: "ar", country: "KW", university: "جامعة البذرة التجريبية", specialization: t.spec, onboardingCompleted: true, timezone: "Asia/Kuwait", updatedAt: nowAt });
}
for (const s of students) {
  put("users", s.uid, { id: s.uid, tenantId, email: s.email, displayName: s.name, role: "student", status: "active", createdAt: iso(-150), updatedAt: nowAt });
  // every 17th student has NOT finished onboarding (new sign-up that abandoned the flow)
  const done = Number(s.uid.slice(-4)) % 17 !== 0;
  put("profiles", s.uid, { userId: s.uid, tenantId, displayName: s.name, email: s.email, language: "ar", country: "KW", university: "جامعة البذرة التجريبية", specialization: s.spec, studyYear: s.year, academicTerm: "خريف 2026", dailyStudyMinutes: 60 + (Number(s.uid.slice(-4)) % 5) * 30, timezone: "Asia/Kuwait", onboardingCompleted: done, updatedAt: nowAt });
}

// ---- courses / assignments / enrolments -----------------------------------
const courses = [];
teachers.forEach((t, ti) => {
  const n = 2 + (ti % 3);
  for (let k = 0; k < n; k++) {
    const [code, title] = COURSE_TITLES[(ti * 3 + k) % COURSE_TITLES.length];
    const id = `seed-course-${pad(ti + 1)}-${k + 1}`;
    const status = k === n - 1 && ti % 7 === 0 ? "archived" : ti % 11 === 5 && k === 0 ? "draft" : "active";
    const course = { id, tenantId, ownerId: t.uid, code: `${code}-${k + 1}`, title, term: "خريف 2026", description: `مقرر ${title} — يقدّمه ${t.name}`, outcomes: ["O1", "O2", "O3"], aiPolicy: AI_POLICIES[(ti + k) % 3], status, createdAt: iso(-120), updatedAt: nowAt };
    courses.push({ ...course, teacher: t });
    put("courses", id, course);
    // Deterministic, publicly documented dev join code: AOS-<teacher #4 digits>C<course #>  (e.g. AOS-0001C1)
    const rawCode = `AOS-${pad(ti + 1)}C${k + 1}`;
    put("courseJoinCodes", `seed-join-${pad(ti + 1)}-${k + 1}`, { id: `seed-join-${pad(ti + 1)}-${k + 1}`, tenantId, courseId: id, prefix: rawCode.slice(0, 8), codeHash: sha(rawCode), status: status === "active" ? "active" : "revoked", maxUses: 500, useCount: 0, expiresAt: iso(120), createdBy: t.uid, createdAt: iso(-100), updatedAt: nowAt });
  }
});
const assignments = [];
for (const c of courses) {
  const n = 2 + int(0, 2);
  for (let a = 0; a < n; a++) {
    const id = `${c.id}-a${a + 1}`;
    const draft = a === n - 1 && c.status !== "active" ? "draft" : a === n - 1 && int(0, 4) === 0 ? "draft" : "published";
    const rubric = [
      { id: "r1", title: "جودة التحليل", description: "عمق التحليل ووضوح الحجة", weighting: 40 },
      { id: "r2", title: "التوثيق والمصادر", description: "سلامة الاستشهاد", weighting: 30 },
      { id: "r3", title: "التنظيم واللغة", description: "الوضوح والسلامة اللغوية", weighting: 30 },
    ];
    const rec = {
      id, tenantId, courseId: c.id, createdBy: c.ownerId, title: `${pick(ASSIGNMENT_TITLES)} ${a + 1}: ${c.title}`,
      instructions: `اكتب ${pick(ASSIGNMENT_TITLES)} حول موضوع من مقرر ${c.title}. ${pick(SNIPPETS)} يجب أن يتضمن العمل مقدمة وتحليلًا وخاتمة مع قائمة مراجع. `.repeat(2),
      deadline: iso(a === 0 ? -20 : 10 + a * 12, 20), deliverables: [{ id: "d1", title: "التقرير", format: "DOCX" }], rubric, outcomes: ["O1"], aiPolicy: c.aiPolicy,
      groupMode: "individual", status: draft, createdAt: iso(-90 + a), updatedAt: nowAt,
    };
    assignments.push({ ...rec, course: c });
    put("assignments", id, rec);
  }
}
const enrolments = new Map(); // studentIdx -> course list
const activeCourses = courses.filter((c) => c.status === "active");
students.forEach((s, si) => {
  const k = 4 + (si % 3);
  const mine = new Set();
  for (let j = 0; j < k; j++) mine.add(activeCourses[(si * 7 + j * 13) % activeCourses.length].id);
  const list = [...mine].map((id) => courses.find((c) => c.id === id));
  enrolments.set(si, list);
  for (const c of list) {
    const id = `${c.id}__${s.uid}`;
    put("enrollments", id, { id, tenantId, courseId: c.id, userId: s.uid, role: "student", status: si % 41 === 0 ? "withdrawn" : "active", source: "join_code", createdAt: iso(-60), updatedAt: nowAt });
  }
});
put("enrollments", "seed-course-0001-1__seed-ta", { id: "seed-course-0001-1__seed-ta", tenantId, courseId: "seed-course-0001-1", userId: "seed-ta", role: "teaching_assistant", status: "active", source: "invite", createdAt: iso(-60), updatedAt: nowAt });

// ---- projects, artifacts, evidence, submissions --------------------------
const byCourse = new Map();
for (const a of assignments) (byCourse.get(a.courseId) || byCourse.set(a.courseId, []).get(a.courseId)).push(a);
let nSub = 0, nProj = 0, nEv = 0;
const STATUSES = ["submitted", "submitted", "grading", "graded", "released", "released", "released", "returned"];
students.forEach((s, si) => {
  if (si % 41 === 0) return;
  for (const c of enrolments.get(si)) {
    for (const a of byCourse.get(c.id) || []) {
      if (a.status !== "published") continue;
      if (rnd() < 0.45) continue; // not everyone starts every assignment
      const pid = `seed-proj-${pad(si + 1)}-${a.id.replace("seed-course-", "")}`;
      const progress = int(10, 100);
      const done = progress >= 80;
      put("projects", pid, {
        id: pid, tenantId, userId: s.uid, title: a.title, course: c.code, projectType: "report", academicDomain: s.spec, complexity: "medium", collaborationMode: "individual",
        requiredSkills: [], learningOutcomes: ["O1"], requiredActions: ["WRITE"],
        deliverables: [{ id: "d1", title: "التقرير", format: "DOCX", status: done ? "ready" : "in_progress", fileId: done ? `f-${pid}` : undefined }],
        rubric: a.rubric.map((r) => ({ ...r, readiness: done ? "covered" : "partial" })), deadlines: { final: a.deadline, milestones: [{ id: "m1", title: "مسودة أولى", date: iso(5) }] }, sourceRequirements: [], softwareRequirements: [],
        aiPolicy: { ...a.aiPolicy, provenance: "published_assignment", courseId: c.id, assignmentId: a.id }, riskFlags: [], tasks: [], workspaceModules: ["writing"], requirements: [],
        status: "active", progress, revision: int(1, 6), originalAssignment: { attachments: [{ fileName: "brief.pdf", sha256: sha(pid) }] }, createdAt: iso(-30), updatedAt: iso(-int(0, 25)),
      });
      nProj++;
      put("artifacts", `art-${pid}`, { id: `art-${pid}`, tenantId, projectId: pid, module: "writing", kind: "document", title: "المسودة", content: `${pick(SNIPPETS)}\n\n${pick(SNIPPETS)}`, status: done ? "ready" : "draft", deliverableId: "d1", rubricIds: ["r1", "r2", "r3"], createdBy: s.uid, updatedBy: s.uid, createdAt: iso(-25), updatedAt: iso(-int(0, 20)) });
      put("projectEvidence", `ev-${pid}`, { id: `ev-${pid}`, tenantId, projectId: pid, userId: s.uid, type: "claim", title: "ادّعاء مدعوم", detail: pick(SNIPPETS), verification: "user_verified", deliverableId: "d1", rubricIds: ["r1", "r2"], createdAt: iso(-20), updatedAt: iso(-10) });
      nEv++;
      if (!done || rnd() < 0.15) continue;
      const status = pick(STATUSES);
      const graded = ["graded", "released"].includes(status);
      const grades = a.rubric.map((r) => ({ rubricId: r.id, title: r.title, maxPoints: r.weighting, awardedPoints: graded ? Math.round(r.weighting * (0.55 + rnd() * 0.45)) : 0, feedback: graded ? "عمل جيد، يُراجع التوثيق." : undefined }));
      const subId = `${a.id}__${s.uid}`; // same id scheme as firestoreStore.createCourseSubmission
      const receipt = sha(subId);
      put("courseSubmissions", subId, {
        id: subId, tenantId, courseId: c.id, assignmentId: a.id, projectId: pid, studentId: s.uid, studentName: s.name, attempt: 1, status, submittedAt: iso(-int(1, 18)), receiptHash: receipt, projectRevision: 3,
        audit: { score: int(70, 98), status: "ready", findings: [] },
        snapshot: { projectTitle: a.title, deliverables: [{ id: "d1", title: "التقرير", format: "DOCX", status: "ready", fileId: `f-${pid}` }], artifactIds: [`art-${pid}`], evidenceIds: [`ev-${pid}`] },
        rubricGrades: graded ? grades : [], totalScore: graded ? grades.reduce((x, g) => x + g.awardedPoints, 0) : undefined, maxScore: graded ? 100 : undefined,
        feedback: graded ? "ملاحظات المعلم: أحسنت في التحليل." : undefined, gradedBy: graded ? c.ownerId : undefined, gradedAt: graded ? iso(-1) : undefined, releasedAt: status === "released" ? iso(-1) : undefined,
        returnedReason: status === "returned" ? "أضف توثيق النسخة النهائية" : undefined, updatedAt: iso(-1),
      });
      nSub++;
    }
  }
});

// ---- billing: subscriptions, transactions, entitlements -------------------
const rec = (resource, id, owner, title, status, data, at) => ({ id, resource, tenantId, ownerId: owner, status, title, data, version: 1, createdBy: "seed", updatedBy: "seed", createdAt: at, updatedAt: at });
let nPay = 0;
students.forEach((s, si) => {
  if (si % 9 !== 0) return;
  const at = iso(-int(1, 60));
  const outcome = ["paid", "paid", "paid", "failed", "refunded"][si % 5];
  const tx = `seed-tx-${pad(si + 1)}`;
  put("platform_transactions", tx, rec("transactions", tx, s.uid, "LemonSqueezy order", outcome, { provider: "lemonsqueezy", externalId: `ls-${pad(si + 1)}`, userId: s.uid, amount: 1500, currency: "USD", planId: "project_standard", receivedAt: at }, at));
  if (outcome === "paid") {
    const sub = `seed-sub-${pad(si + 1)}`;
    put("platform_subscriptions", sub, rec("subscriptions", sub, s.uid, "اشتراك", ["active", "active", "cancelled", "past_due"][si % 4], { provider: "lemonsqueezy", userId: s.uid, currentPeriodEnd: iso(15 + (si % 20)) }, at));
  }
  nPay++;
});

// ---- notifications / support tickets -------------------------------------
let nNote = 0;
students.forEach((s, si) => {
  for (let k = 0; k < 1 + (si % 4); k++) {
    const id = `seed-note-${pad(si + 1)}-${k}`;
    put("notifications", id, { id, tenantId, userId: s.uid, type: pick(["deadline", "assignment", "comment", "system"]), priority: pick(["normal", "normal", "important"]), title: pick(["موعد تسليم قريب", "تم نشر تكليف جديد", "تعليق جديد على مشروعك", "تم تحديث درجتك"]), body: "افتح المنصة لمراجعة التفاصيل.", channels: ["in_app"], delivery: { in_app: "sent" }, createdAt: iso(-k - (si % 9)), readAt: k % 2 ? iso(-1) : undefined });
    nNote++;
  }
});
for (let i = 0; i < 30; i++) {
  const s = students[i * 7 % students.length];
  put("supportTickets", `seed-ticket-${pad(i + 1)}`, { id: `seed-ticket-${pad(i + 1)}`, tenantId, userId: s.uid, subject: pick(["لا أستطيع رفع الملف", "مشكلة في الدفع", "سؤال عن الدرجة", "نسيت كلمة المرور"]), message: "السلام عليكم، أحتاج مساعدة من فضلكم.", status: pick(["open", "open", "in_progress", "resolved"]), priority: "normal", createdAt: iso(-i), updatedAt: iso(-i) });
}

// ---- flush ------------------------------------------------------------------
for (let i = 0; i < writes.length; i += 400) {
  const batch = db.batch();
  for (const w of writes.slice(i, i + 400)) batch.set(w.ref, JSON.parse(JSON.stringify(w.data)));
  await batch.commit();
}
console.log(JSON.stringify({
  seeded: true, tenantId, password: SEED_PASSWORD, seconds: Math.round((Date.now() - started) / 1000),
  users: staff.length + teachers.length + students.length, teachers: teachers.length, students: students.length,
  courses: courses.length, assignments: assignments.length, projects: nProj, evidence: nEv, submissions: nSub, payments: nPay, notifications: nNote, documents: writes.length,
  sampleLogins: { teacher: teachers[0].email, student: students[1].email, universityAdmin: "univadmin@seed.academicos.local", root: "root@seed.academicos.local", support: "support@seed.academicos.local" },
}, null, 1));

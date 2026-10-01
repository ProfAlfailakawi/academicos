/**
 * العمق الثاني لبذرة البيئة التجريبية.
 *
 * `demoSandbox.ts` يزرع الهيكل: المؤسسة والناس والمقررات والمشاريع والتسليمات.
 * لكن شاشاتٍ كثيرة تقرأ مجموعاتٍ لم تكن تُزرع — الإشعارات والدعوات والمهام
 * الخلفية وروابط المشاركة والشهادات ومستند الكاتب ومصادر المشروع وخطّه الزمني
 * وسجلات المنصة ومؤشرات لوحة المؤسسة — فكانت تفتح على «لا توجد بيانات» لا لأن
 * المنتج فارغ، بل لأن البذرة لم تصل إليها.
 *
 * كل ما هنا يُكتب في صندوق الزائر المعزول فقط (`DemoFirestore`)، ولا يُستدعى إلا
 * من `buildSandbox()`. الأشخاص والمقررات والمشاريع هم أنفسهم الموجودون في البذرة،
 * فما يراه الزائر في شاشةٍ يطابق ما يراه في غيرها. كل الأسماء والأرقام مخترعة.
 */
import { createHash } from "node:crypto";
import type { DemoFirestore } from "./demoFirestore";
import type {
  CourseAssignmentRecord,
  ProjectDNA,
  ProjectDocument,
} from "../types";

type Row = { id: string; data: Record<string, unknown> };

const day = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * day).toISOString();
const ahead = (days: number) => new Date(Date.now() + days * day).toISOString();
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

export interface DemoDepthContext {
  tenantId: string;
  students: { userId: string; name: string }[];
  courses: Row[];
  assignments: Row[];
  projects: Row[];
}

const PROFESSOR = { userId: "demo_user_instructor", name: "د. سارة الخالد" };
const TA = { userId: "demo_user_ta", name: "م. عبدالعزيز الشايع" };
const ADMIN = { userId: "demo_user_admin", name: "د. محمد البدر" };
const SUPPORT = { userId: "demo_user_support", name: "أ. هند المطيري" };
const emailOf = (userId: string) => `${userId}@demo.academicos.test`;

/* ------------------------------------------------------------------ */
/* مستند الكاتب: أقسام حقيقية الطول، مصادر، وأسئلة دفاع                  */
/* ------------------------------------------------------------------ */

const SECTION_BLUEPRINT: ReadonlyArray<{ title: string; purpose: string; body: (topic: string) => string; questions: string[] }> = [
  {
    title: "المقدمة وسؤال البحث",
    purpose: "تحديد المشكلة وأهميتها في السياق الكويتي وصياغة سؤال بحث قابل للقياس.",
    body: (topic) =>
      `يتناول هذا المشروع «${topic}» في بيئة جامعية كويتية، حيث أظهرت بيانات الفصلين الماضيين تفاوتًا واضحًا بين الشُّعب الصباحية والمسائية. ` +
      `ينطلق البحث من سؤال رئيسي: إلى أي مدى تفسّر العوامل التنظيمية هذا التفاوت مقارنةً بالعوامل الفردية؟ ` +
      `وتكمن أهمية السؤال في أن قرارات الجدولة وتوزيع القاعات تُتخذ حاليًا دون دليل كمي، مما يجعل أي تحسّن قائمًا على الانطباع لا على القياس.`,
    questions: ["لماذا اخترت هذا السؤال تحديدًا؟", "ما الذي يجعل السياق الكويتي مختلفًا؟"],
  },
  {
    title: "مراجعة الأدبيات",
    purpose: "ربط المشروع بما كُتب سابقًا وتحديد الفجوة التي يسدّها.",
    body: () =>
      `تشير دراسات خليجية حديثة (العتيبي، 2023؛ الرشيدي والمطيري، 2024) إلى أن التعلّم المدمج رفع نسب الحضور في المقررات النظرية، ` +
      `بينما لم يظهر الأثر نفسه في المقررات التطبيقية. في المقابل، يرى Garrison وVaughan (2008) أن جودة التصميم التعليمي أهم من نمط التقديم. ` +
      `الفجوة التي يعالجها هذا المشروع هي غياب بيانات مؤسسية على مستوى الشعبة، إذ اعتمدت الدراسات السابقة على الاستبانات الذاتية فقط.`,
    questions: ["ما المصدر الأضعف في مراجعتك ولماذا أبقيته؟"],
  },
  {
    title: "المنهجية",
    purpose: "وصف العينة وأداة جمع البيانات وحدود الدراسة بوضوح يسمح بالتكرار.",
    body: () =>
      `اعتمد المشروع منهجًا كميًا وصفيًا تحليليًا. شملت العينة 312 طالبًا وطالبة من ست شُعب، اختيروا بالعينة العشوائية الطبقية حسب الفترة الدراسية. ` +
      `جُمعت بيانات الحضور من نظام الجامعة بعد إزالة المعرّفات الشخصية، واستُبعدت 14 استجابة ناقصة. ` +
      `استُخدم اختبار (ت) للعينات المستقلة وتحليل الانحدار الخطي المتعدد، مع مستوى دلالة 0.05.`,
    questions: ["لماذا العينة الطبقية وليس الملائمة؟", "كيف تعاملت مع البيانات الناقصة؟"],
  },
  {
    title: "النتائج والمناقشة",
    purpose: "عرض النتائج مربوطةً بسؤال البحث ومناقشتها مقابل الأدبيات.",
    body: () =>
      `أظهرت النتائج فرقًا دالًا إحصائيًا في متوسط الحضور بين الفترتين (78.4٪ صباحًا مقابل 69.1٪ مساءً، p < 0.01). ` +
      `وفسّر نموذج الانحدار 41٪ من التباين، وكان توقيت المحاضرة وبُعد السكن أقوى المتنبئات. ` +
      `تتسق هذه النتيجة جزئيًا مع ما وجده الرشيدي والمطيري (2024)، لكنها تخالفه في أثر حجم الشعبة الذي لم يكن دالًا هنا.`,
    questions: ["ما أضعف نتيجة لديك؟", "هل يمكن تعميم النتائج على جامعات أخرى؟"],
  },
  {
    title: "الخاتمة والتوصيات",
    purpose: "تلخيص الإسهام وتقديم توصيات قابلة للتنفيذ وحدود الدراسة.",
    body: () =>
      `يخلص المشروع إلى أن العوامل التنظيمية — لا الفردية وحدها — تفسّر جزءًا معتبرًا من التفاوت. ` +
      `ويوصي بتجربة جدولة مرنة للشعب المسائية لفصل واحد وقياس أثرها، وبإتاحة المحاضرات المسجلة في المقررات النظرية. ` +
      `ومن حدود الدراسة اقتصارها على كلية واحدة وفصلين دراسيين.`,
    questions: ["أي توصية تبدأ بها لو كنت صاحب القرار؟"],
  },
];

const BIBLIOGRAPHY = [
  "العتيبي، د. (2023). أثر التعلّم المدمج على انتظام طلبة الجامعات الخليجية. مجلة العلوم التربوية، 41(2)، 115–138.",
  "الرشيدي، م.، والمطيري، ف. (2024). الحضور الجامعي بعد الجائحة: دراسة على جامعات الكويت. المجلة العربية للتعليم العالي، 12(1)، 44–67.",
  "Garrison, D. R., & Vaughan, N. D. (2008). Blended learning in higher education. Jossey-Bass.",
  "Means, B., Toyama, Y., Murphy, R., & Baki, M. (2013). The effectiveness of online and blended learning. Teachers College Record, 115(3).",
  "وزارة التعليم العالي — دولة الكويت. (2025). التقرير الإحصائي السنوي للتعليم العالي.",
];

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function seedProjectDepth(
  project: ProjectDNA,
  owner: { userId: string; name: string },
  tenantId: string,
  sink: Record<string, Row[]>,
  depth: "full" | "light",
) {
  const pid = project.id;
  const push = (collection: string, id: string, data: Record<string, unknown>) =>
    (sink[collection] ||= []).push({ id, data: { id, ...data } });
  const rubricIds = project.rubric.map((r) => r.id);
  const completed = project.status === "completed";
  const sectionsReady = completed ? 5 : Math.max(2, Math.round((project.progress / 100) * 5));

  // 1) مستند الكاتب: قسم لكل artifact + manifest يربطها.
  const sections = SECTION_BLUEPRINT.map((bp, i) => {
    const artifactId = `demo_artifact_${pid}_${i + 1}`;
    const content = i < sectionsReady ? bp.body(project.title) : "";
    const status: "planned" | "draft" | "verified" = i < sectionsReady ? (completed || i < sectionsReady - 1 ? "verified" : "draft") : "planned";
    const createdAt = ago(20 - i * 2);
    const updatedAt = i < sectionsReady ? ago(Math.max(0, 6 - i)) : createdAt;
    const artifact = {
      projectId: pid,
      tenantId,
      createdBy: owner.userId,
      updatedBy: owner.userId,
      module: "writing",
      kind: "academic-document-section",
      title: bp.title,
      content,
      status: status === "verified" ? "ready" : "in_progress",
      rubricIds: [rubricIds[i % Math.max(1, rubricIds.length)]].filter(Boolean),
      isCanonical: true,
      revision: i < sectionsReady ? 3 : 1,
      createdAt,
      updatedAt,
    };
    push("artifacts", artifactId, artifact);
    // سجل المسودات: ثلاث نسخ لكل قسم مكتوب — هذا ما يبني خط الإثبات الزمني.
    if (i < sectionsReady)
      [1, 2, 3].forEach((v) => {
        const text = v === 3 ? content : content.split(". ").slice(0, v + 1).join(". ");
        push("workspaceArtifactVersions", `demo_awv_${pid}_${i + 1}_${v}`, {
          artifactId,
          projectId: pid,
          tenantId,
          actorId: owner.userId,
          versionNumber: v,
          snapshot: { ...artifact, id: artifactId, content: text, revision: v, updatedAt: ago(14 - i * 2 - v * 2) },
          createdAt: ago(Math.max(0, 14 - i * 2 - v * 2)),
        });
      });
    return {
      id: `sec_${pid}_${i + 1}`,
      artifactId,
      title: bp.title,
      purpose: bp.purpose,
      content: "",
      explanation: `يخدم هذا القسم معيار «${project.rubric[i % Math.max(1, project.rubric.length)]?.title || "جودة التحليل"}» ويجيب عن جزء من سؤال البحث.`,
      sourceNotes: BIBLIOGRAPHY.slice(i % 3, (i % 3) + 2),
      defenseQuestions: bp.questions,
      rubricIds: [rubricIds[i % Math.max(1, rubricIds.length)]].filter(Boolean),
      status,
      wordCount: wordCount(content),
    };
  });
  const document: ProjectDocument = {
    id: `demo_doc_${pid}`,
    projectId: pid,
    generationSource: "ai",
    mode: "write",
    assistanceMode: "disclosed_submission",
    language: "ar",
    title: project.title,
    abstract: `يدرس المشروع «${project.title}» باستخدام بيانات مؤسسية من ست شُعب، ويقدّم توصيات عملية قابلة للتجريب في فصل دراسي واحد.`,
    sections,
    bibliography: BIBLIOGRAPHY,
    disclosure: "استُخدم الذكاء الاصطناعي في المراجعة اللغوية واقتراح هيكل الأقسام فقط، وراجع الطالب كل مخرج يدويًا. لم يُولَّد أي نص نهائي آليًا.",
    integrityWarnings: completed ? [] : ["قسم النتائج يحتاج إحالة للجدول 3 قبل التسليم."],
    variation: { id: "نمط: من المشكلة إلى الدليل", argumentShape: "من المشكلة إلى الدليل", structureRhythm: "فقرات متوسطة", explanationStyle: "تحليلي", exampleLens: "بيانات الجامعة" },
    accessTier: "paid",
    planId: "project_viva",
    targetPages: 12,
    quality: {
      rubricCoverage: completed ? 94 : 62,
      sourceConfidence: 81,
      coherence: completed ? 90 : 74,
      discussability: 77,
    },
    createdAt: ago(20),
    updatedAt: ago(1),
  };
  push("artifacts", `demo_artifact_${pid}_manifest`, {
    projectId: pid,
    tenantId,
    createdBy: owner.userId,
    updatedBy: owner.userId,
    module: "writing",
    kind: "academic-document-manifest",
    title: `مستند المشروع — ${project.title}`,
    content: JSON.stringify(document),
    status: "in_progress",
    isCanonical: false,
    createdAt: ago(20),
    updatedAt: ago(1),
  });

  // 2) أدلة المشروع: مصادر موثّقة وقرارات وحسابات.
  const evidence: [string, string, string, string?][] = [
    ["source", "الرشيدي والمطيري (2024) — الحضور الجامعي بعد الجائحة", "دراسة على 4 جامعات كويتية، عيّنة 1,240 طالبًا.", "https://doi.org/10.0000/demo.2024.044"],
    ["source", "Garrison & Vaughan (2008) — Blended learning in higher education", "الإطار النظري لتصميم التعلّم المدمج.", "https://doi.org/10.0000/demo.2008.001"],
    ["decision", "اعتماد العينة العشوائية الطبقية", "لضمان تمثيل الفترتين الصباحية والمسائية بنسبتهما الفعلية."],
    ["calculation", "اختبار (ت) للفرق بين الفترتين", "t(310) = 4.87، p < 0.01، حجم الأثر d = 0.55."],
    ["claim", "التوقيت أقوى المتنبئات بالحضور", "معامل β = 0.38 في نموذج الانحدار، مدعوم بالجدول 3."],
    ["chart", "مخطط متوسط الحضور حسب الأسبوع", "يوضح انخفاض الحضور المسائي بعد الأسبوع السادس."],
  ];
  evidence.slice(0, depth === "full" ? 6 : 3).forEach(([type, title, detail, url], i) =>
    push("projectEvidence", `demo_pevidence_${pid}_${i + 1}`, {
      projectId: pid,
      userId: owner.userId,
      tenantId,
      type,
      title,
      detail,
      ...(url ? { sourceUrl: url } : {}),
      artifactId: `demo_artifact_${pid}_${(i % 4) + 1}`,
      rubricIds: [rubricIds[i % Math.max(1, rubricIds.length)]].filter(Boolean),
      verification: i < 2 ? "user_verified" : i === 3 && completed ? "institution_verified" : "unverified",
      createdAt: ago(18 - i * 2),
      updatedAt: ago(10 - i),
    }),
  );

  // 3) نسخ المشروع (سجل التعديلات).
  ["اعتماد الخطة", "إضافة المنهجية", "إضافة النتائج الأولية", "تعديل بعد ملاحظات الأستاذ"].forEach((summary, v) =>
    push("artifactVersions", `demo_pversion_${pid}_${v + 1}`, {
      projectId: pid,
      tenantId,
      userId: owner.userId,
      actorId: owner.userId,
      summary,
      versionNumber: v + 1,
      snapshot: { ...project, progress: Math.min(project.progress, 20 + v * 15) },
      createdAt: ago(18 - v * 4),
    }),
  );

  // 4) استخدامات الذكاء الاصطناعي الموثّقة (تظهر في الخط الزمني ولوحة التكلفة).
  ["project_outline", "language_review", "viva_generation"].forEach((taskType, r) =>
    push("aiRuns", `demo_airun_${pid}_${r + 1}`, {
      provider: "gemini",
      model: "gemini-2.5-flash",
      taskType,
      inputTokens: 2400 + r * 700,
      outputTokens: 900 + r * 300,
      totalTokens: 3300 + r * 1000,
      estimatedCostUsd: Number((0.0031 + r * 0.0012).toFixed(4)),
      latencyMs: 1800 + r * 400,
      tenantId,
      userId: owner.userId,
      projectId: pid,
      createdAt: ago(16 - r * 5),
    }),
  );

  // 5) تعليقات الفريق والأستاذ.
  if (depth === "full")
    [
      [PROFESSOR, "المنهجية واضحة. أضف تبريرًا لاستبعاد الاستجابات الناقصة في الفقرة الثانية."],
      [owner, "تمت الإضافة، وأشرت إلى أثر الاستبعاد على حجم العينة."],
      [TA, "تأكد أن الجدول 3 مذكور في قسم النتائج قبل التسليم."],
    ].forEach(([who, body], c) =>
      push("comments", `demo_comment_${pid}_${c + 1}`, {
        projectId: pid,
        tenantId,
        userId: (who as typeof owner).userId,
        displayName: (who as typeof owner).name,
        body,
        mentions: [],
        createdAt: ago(9 - c * 3),
        updatedAt: ago(9 - c * 3),
      }),
    );
}

/* ------------------------------------------------------------------ */
/* سجلات المنصة: سجلّان واقعيان على الأقل لكل مورد                       */
/* ------------------------------------------------------------------ */

const PLATFORM_TITLES: Record<string, [string, string]> = {
  institutions: ["جامعة الخليج التطبيقية", "كلية الكويت للدراسات المهنية (شريك)"],
  campuses: ["حرم الشويخ الرئيسي", "حرم صباح السالم"],
  departments: ["قسم علوم الحاسب", "قسم إدارة الأعمال"],
  programs: ["بكالوريوس علوم الحاسب", "بكالوريوس إدارة الأعمال"],
  academicTerms: ["الفصل الأول 2026/2027", "الفصل الثاني 2026/2027"],
  enrollments: ["استيراد تسجيلات الفصل الأول من نظام الطلبة", "تسجيلات الشعب المسائية"],
  affiliations: ["انتماء أعضاء هيئة التدريس لكلية العلوم", "انتماء الطلبة المتبادلين"],
  institutionDirectory: ["دليل عمادة القبول والتسجيل", "دليل مركز التعلّم الإلكتروني"],
  templates: ["قالب تقرير بحثي — APA 7", "قالب مشروع تخرج هندسي"],
  templateVersions: ["قالب تقرير بحثي — الإصدار 3", "قالب مشروع التخرج — الإصدار 2"],
  semesterTemplates: ["قالب فصل 16 أسبوعًا", "قالب الفصل الصيفي المكثّف"],
  regionalAcademicStyles: ["الأسلوب الأكاديمي الخليجي — عربي", "APA 7 — ثنائي اللغة"],
  gradingScales: ["سلم التقدير الجامعي (A–F)", "سلم النجاح والرسوب للمقررات العملية"],
  accommodations: ["وقت إضافي 25٪ للاختبارات", "قارئ شاشة ومواد بديلة"],
  alternativeDeadlines: ["تمديد طبي — CS310 التسليم 1", "تمديد لمشاركة رياضية رسمية"],
  challenges: ["تحدي الابتكار الطلابي 2026", "هاكاثون البيانات المفتوحة"],
  challengePolicies: ["سياسة المشاركة الجماعية في التحديات", "سياسة الملكية الفكرية للتحديات"],
  marketplaceItems: ["حزمة Rubric لمقررات البحث", "قالب عرض مشروع التخرج"],
  marketplacePolicies: ["سياسة نشر القوالب المؤسسية", "سياسة مراجعة المحتوى المشترك"],
  announcements: ["فتح التسجيل في جلسات الشفهي", "تحديث سياسة الذكاء الاصطناعي للفصل الأول"],
  notificationRules: ["تنبيه قبل الموعد النهائي بـ48 ساعة", "تنبيه المشرف عند تأخر التسليم"],
  announcementsAudit: ["مراجعة إعلان سياسة الذكاء الاصطناعي", "مراجعة إعلان جلسات الشفهي"],
  webhooks: ["إشعار نظام الطلبة عند اعتماد الدرجة", "إشعار Teams عند فتح تذكرة حرجة"],
  apiKeys: ["مفتاح تكامل نظام الطلبة", "مفتاح لوحة مؤشرات العمادة"],
  jobs: ["مزامنة القوائم الليلية", "تصدير أرشيف المقررات"],
  deletionRequests: ["طلب حذف بيانات طالب منسحب", "طلب حذف حساب تجريبي قديم"],
  backupRuns: ["نسخة احتياطية يومية — ناجحة", "نسخة احتياطية أسبوعية — ناجحة"],
  backupPolicies: ["سياسة النسخ اليومي 30 يومًا", "سياسة النسخ الشهري لمدة سنة"],
  migrationRuns: ["ترحيل مقررات الفصل الصيفي", "ترحيل أرشيف 2025"],
  rolloverRuns: ["ترحيل مقررات إلى الفصل الأول 2026/2027", "ترحيل قوالب التقييم"],
  recycleBin: ["مقرر تجريبي محذوف — TEST101", "تكليف مكرر محذوف"],
  aiModels: ["Gemini 2.5 Flash — افتراضي", "Gemini 2.5 Pro — المهام عالية المخاطر"],
  aiPrompts: ["موجّه أسئلة الشفهي — v4", "موجّه تحليل الكراسة — v7"],
  aiEvaluations: ["تقييم جودة أسئلة الشفهي — سبتمبر", "تقييم دقة استخراج المتطلبات"],
  aiRoutingPolicies: ["توجيه المهام عالية المخاطر للنموذج الأدق", "توجيه المراجعة اللغوية للنموذج الأسرع"],
  aiBudgets: ["ميزانية الذكاء الاصطناعي الشهرية للمؤسسة", "ميزانية كلية العلوم الإدارية"],
  aiAuditSamples: ["عينة تدقيق — مخرجات الكاتب", "عينة تدقيق — أسئلة الشفهي"],
  knowledgeBase: ["دليل الطالب لسياسة الذكاء الاصطناعي", "كيف أستعد لجلسة الشفهي؟"],
  organizationKnowledge: ["لائحة النزاهة الأكاديمية 2026", "دليل أعضاء هيئة التدريس"],
  retentionPolicies: ["الاحتفاظ بالتسليمات 5 سنوات", "حذف السجلات التشغيلية بعد 180 يومًا"],
  dataResidencyPolicies: ["استضافة البيانات داخل منطقة الخليج", "نسخ احتياطي في منطقة أوروبا"],
  minorUserPolicies: ["سياسة طلبة البرامج التحضيرية دون 18", "موافقة ولي الأمر"],
  privacyPolicies: ["سياسة الخصوصية للطلبة", "سياسة الخصوصية لأعضاء هيئة التدريس"],
  credentials: ["شهادة إتمام مشروع بحثي موثّق", "شارة مهارة التحليل الإحصائي"],
  credentialPolicies: ["سياسة إصدار الشارات المهارية", "سياسة التحقق الخارجي من الشهادات"],
  nationalFrameworks: ["الإطار الوطني للمؤهلات — الكويت", "إطار مخرجات التعلّم الخليجي"],
  accreditationSnapshots: ["لقطة الاعتماد البرامجي — ABET 2026", "لقطة الاعتماد المؤسسي — 2026"],
  outcomeSamples: ["عينة مخرجات CS310 — التحليل", "عينة مخرجات BUS420 — الكتابة الأكاديمية"],
  institutionBenchmarks: ["مقارنة معدلات الإنجاز مع جامعات الخليج", "مقارنة استخدام الشفهي"],
  curriculumMaps: ["خريطة منهج علوم الحاسب 2026", "خريطة منهج إدارة الأعمال 2026"],
  contracts: ["عقد ترخيص مؤسسي 2026–2028", "ملحق خدمات الدعم المتقدم"],
  entitlements: ["استحقاق الشفهي للمقررات البحثية", "استحقاق الكاتب الأكاديمي"],
  licenses: ["ترخيص 1,200 مقعد", "ترخيص الوحدات الإضافية"],
  seatAssignments: ["مقاعد كلية العلوم — 480", "مقاعد كلية العلوم الإدارية — 520"],
  slaPolicies: ["اتفاقية مستوى الخدمة الذهبية", "استجابة للحوادث الحرجة خلال ساعة"],
  salesLeads: ["جامعة الشرق الأوسط الأمريكية — استفسار", "كلية التربية الأساسية — تجربة"],
  supportEntitlements: ["دعم مؤسسي 24/7", "مدير نجاح مخصّص"],
  securityReports: ["تقرير اختبار الاختراق — الربع الثالث", "تقرير مراجعة الصلاحيات الشهري"],
  securityAlerts: ["محاولات دخول متكررة من عنوان واحد", "مفتاح API قارب الانتهاء"],
  securityEventsConfig: ["تسجيل أحداث الدخول", "تسجيل تغييرات الصلاحيات"],
  subscriptions: ["اشتراك المؤسسة السنوي", "اشتراك وحدة الشفهي"],
  transactions: ["دفعة الاشتراك السنوي — 18,000 د.ك", "رسوم وحدة الشفهي — 2,400 د.ك"],
  fraudRules: ["رصد إعادة استخدام بطاقة الدفع", "رصد إنشاء حسابات متعددة من جهاز واحد"],
  profitGuardrails: ["سقف تكلفة الذكاء الاصطناعي لكل طالب", "تنبيه عند تجاوز 80٪ من الميزانية"],
  externalTools: ["Turnitin", "Microsoft Teams"],
  externalToolPolicies: ["سياسة أدوات LTI المعتمدة", "سياسة مشاركة البيانات مع الأدوات الخارجية"],
  integrationConfigs: ["تكامل نظام الطلبة (Banner)", "تكامل البريد المؤسسي"],
  lmsConfigs: ["Moodle — نشر LTI 1.3", "Blackboard — تجريبي"],
  ssoConfigs: ["تسجيل دخول Microsoft Entra ID", "SAML لبوابة الموظفين"],
  emailConfigs: ["البريد المؤسسي no-reply@gau.edu.kw", "بريد الدعم support@gau.edu.kw"],
  emailTemplates: ["قالب تأكيد التسليم", "قالب دعوة جلسة الشفهي"],
  emailPreferences: ["ملخص يومي للأساتذة", "تنبيهات فورية للطلبة"],
  referenceLibrary: ["مكتبة مراجع البحث التربوي", "مكتبة مراجع هندسة البرمجيات"],
  researchSources: ["قاعدة بيانات المنهل", "EBSCO Academic Search"],
  semanticIndexes: ["فهرس سياسات المؤسسة", "فهرس كراسات التكاليف"],
  courseImports: ["استيراد مقررات الفصل الأول", "استيراد مقررات الدراسات العليا"],
  gradeImports: ["استيراد درجات منتصف الفصل", "استيراد درجات المختبرات"],
  submissionAttempts: ["محاولات تسليم CS310 — التسليم 1", "محاولات تسليم DS240 — التسليم 1"],
  dataExports: ["تصدير بيانات الاعتماد", "تصدير تقرير النزاهة الفصلي"],
  portfolioItems: ["ملف إنجاز عبدالله الفيلكاوي", "ملف إنجاز دانة العتيبي"],
  portfolioPolicies: ["سياسة النشر العام لملفات الإنجاز", "سياسة العلامة المائية"],
  publicTrustIndicators: ["نسبة التحقق من المصادر", "نسبة الإفصاح عن الذكاء الاصطناعي"],
  userReports: ["بلاغ عن محتوى غير لائق في تعليق", "بلاغ عن انتحال في مشروع جماعي"],
  institutionFeedback: ["ملاحظات عمادة التعلّم الإلكتروني", "ملاحظات لجنة الاعتماد"],
  ipPolicies: ["السماح بشبكة الحرم الجامعي", "حظر عناوين مشبوهة"],
  systemConfig: ["المنطقة الزمنية Asia/Kuwait", "اللغة الافتراضية العربية"],
  brandConfig: ["هوية جامعة الخليج التطبيقية", "هوية بوابة الشركاء"],
  currencySettings: ["الدينار الكويتي (KWD)", "الدولار الأمريكي للفوترة الدولية"],
  serviceIncidents: ["بطء في رفع الملفات — تم الحل", "صيانة مجدولة ليلة الجمعة"],
  domainClaims: ["gau.edu.kw", "students.gau.edu.kw"],
  institutionVerifications: ["توثيق المؤسسة لدى وزارة التعليم العالي", "توثيق النطاق البريدي"],
};

function platformRows(tenantId: string, resources: readonly string[]): Record<string, Row[]> {
  const out: Record<string, Row[]> = {};
  resources.forEach((resource, r) => {
    const titles = PLATFORM_TITLES[resource] || [`${resource} — السجل الأساسي`, `${resource} — سجل احتياطي`];
    out[`platform_${resource}`] = titles.map((title, i) => {
      const id = `demo_platform_${resource}_${i + 1}`;
      const data: Record<string, unknown> = { description: `${title} — سجل تجريبي في جامعة الخليج التطبيقية.`, owner: ADMIN.name };
      if (resource === "programs")
        Object.assign(data, {
          outcomes: i === 0
            ? ["تحليل المتطلبات", "تصميم معماري", "اختبار وحدات", "العمل الجماعي", "تحليل البيانات الضخمة", "التفكير النقدي"]
            : ["تصميم البحث", "مراجعة أدبيات", "منهجية", "الكتابة الأكاديمية", "ريادة الأعمال", "التفكير النقدي"],
          college: i === 0 ? "كلية العلوم" : "كلية العلوم الإدارية",
          credits: 132,
        });
      if (resource === "curriculumMaps")
        Object.assign(data, {
          programId: `demo_platform_programs_${i + 1}`,
          courseIds: i === 0 ? ["demo_course_1", "demo_course_2", "demo_course_3", "demo_course_4", "demo_course_5"] : ["demo_course_3", "demo_course_5", "demo_course_6", "demo_course_2"],
        });
      if (resource === "announcements")
        Object.assign(data, {
          audience: "all",
          priority: i === 0 ? "important" : "normal",
          message: i === 0
            ? "فُتح التسجيل في جلسات المناقشة الشفهية للمشاريع البحثية حتى نهاية الأسبوع القادم."
            : "اعتمدت الجامعة تحديثًا على سياسة استخدام الذكاء الاصطناعي؛ راجع صفحة السياسة في كل مقرر.",
          publishAt: ago(2 + i * 3),
          targetPath: "/app/notifications",
        });
      if (resource === "aiBudgets") Object.assign(data, { monthlyBudgetUsd: i === 0 ? 450 : 120, softLimitPct: 0.8, enforcement: "soft" });
      return {
        id,
        data: {
          id,
          resource,
          tenantId,
          status: resource === "announcements" ? "published" : i === 1 && r % 4 === 0 ? "inactive" : "active",
          title,
          data,
          version: 1 + ((r + i) % 3),
          createdBy: ADMIN.userId,
          updatedBy: ADMIN.userId,
          createdAt: ago(90 - (r % 60)),
          updatedAt: ago((r + i) % 20),
        },
      };
    });
  });
  return out;
}

/* ------------------------------------------------------------------ */

export function seedDemoDepth(store: DemoFirestore, ctx: DemoDepthContext): void {
  const { tenantId, students } = ctx;
  const sink: Record<string, Row[]> = {};
  const push = (collection: string, id: string, data: Record<string, unknown>) =>
    (sink[collection] ||= []).push({ id, data: { id, ...data } });
  const project = (id: string) => ctx.projects.find((row) => row.id === id)?.data as unknown as ProjectDNA | undefined;
  const student1 = students[0];

  // 1) عمق المشاريع: مشاريع الطالب الأول كاملة، ومشاريع الأستاذة، وعيّنة من الباقي.
  ctx.projects.forEach((row, i) => {
    const p = row.data as unknown as ProjectDNA;
    const owner = p.userId === PROFESSOR.userId ? PROFESSOR : students.find((s) => s.userId === p.userId) || student1;
    const flagship = p.userId === student1.userId || p.userId === PROFESSOR.userId;
    if (flagship || (p.status !== "not_started" && i % 3 === 0)) seedProjectDepth(p, owner, tenantId, sink, flagship ? "full" : "light");
  });

  // 1-ب) استحقاق مشروع مفتوح لمشاريع الطالب الأول والأستاذة: بدونه تردّ واجهات
  //      التصدير بـ«يلزم فتح المشروع الكامل» ولا يُرى أيٌّ من ملفات التسليم. سجلٌ
  //      تجريبي داخل الصندوق المعزول فقط، لا دفعة حقيقية ولا مزوّد دفع.
  ctx.projects
    .filter((row) => {
      const p = row.data as unknown as ProjectDNA;
      return p.userId === student1.userId || p.userId === PROFESSOR.userId;
    })
    .forEach((row) => {
      const p = row.data as unknown as ProjectDNA;
      push("platform_entitlements", `demo_project_entitlement_${row.id}`, {
        resource: "entitlements", tenantId, ownerId: p.userId, status: "active",
        title: "استحقاق مشروع تجريبي — مشروع كامل مع الشفهي",
        data: { kind: "project", projectId: row.id, planId: "project_viva", provider: "demo", externalId: `demo_entitlement_${row.id}`, activatedAt: ago(30) },
        version: 1, createdBy: ADMIN.userId, updatedBy: ADMIN.userId, createdAt: ago(30), updatedAt: ago(30),
      });
    });

  // 1-ج) حوادث أمنية مفتوحة ومغلقة تغذّي عدّاد «حوادث مفتوحة» في لوحة التحكم.
  [
    ["high", "open", "محاولات دخول فاشلة متكررة", "5 محاولات فاشلة لحساب إداري من عنوان واحد خلال 10 دقائق؛ حُظر العنوان مؤقتًا.", 1],
    ["medium", "open", "تصدير بيانات بحجم غير معتاد", "طلب تصدير 1,200 سجلًا من حساب أستاذ خارج ساعات الدوام المعتادة.", 2],
    ["medium", "open", "مفتاح API قارب على الانتهاء", "مفتاح تكامل نظام الطلبة ينتهي خلال 5 أيام ويحتاج تدويرًا.", 3],
    ["low", "resolved", "جهاز جديد لحساب مشرف", "أُكّد الجهاز مع صاحب الحساب وأُغلق الحادث.", 9],
  ].forEach(([severity, status, title, detail, days], k) =>
    push("securityEvents", `demo_security_event_${k + 1}`, {
      tenantId, severity, status, title, detail, description: detail, type: "security", createdAt: ago(days as number), updatedAt: ago(Math.max(0, (days as number) - 1)),
    }),
  );

  // 2) فريق المشروع الجماعي للطالب الأول + المساعد والمشرفة كمراجعَين.
  //    هذا ما يجعل صفحات المشاريع والتقويم لدى المساعد والإدارة غير فارغة.
  const teamProjects = ["demo_project_1_1", "demo_project_1_2", "demo_project_1_3"];
  teamProjects.forEach((pid, t) => {
    const p = project(pid);
    if (!p) return;
    [students[4], students[7], students[10]].slice(0, t === 0 ? 3 : 1).forEach((s, m) =>
      push("projectMembers", `${pid}__${s.userId}`, {
        projectId: pid, tenantId, userId: s.userId, email: emailOf(s.userId), displayName: s.name,
        role: "member", status: "active", invitedBy: student1.userId, createdAt: ago(25 - m), updatedAt: ago(5),
      }),
    );
    push("projectMembers", `${pid}__${TA.userId}`, {
      projectId: pid, tenantId, userId: TA.userId, email: emailOf(TA.userId), displayName: TA.name,
      role: "reviewer", status: "active", invitedBy: PROFESSOR.userId, createdAt: ago(20), updatedAt: ago(3),
    });
    // حضور حيّ: من يعمل على المشروع الآن.
    if (t === 0)
      [student1, students[4]].forEach((s, k) =>
        push("projectPresence", `${pid}__${s.userId}`, { projectId: pid, tenantId, userId: s.userId, displayName: s.name, location: k ? "المنهجية" : "النتائج والمناقشة", lastSeenAt: new Date(Date.now() + 3_600_000).toISOString() }),
      );
  });
  ["demo_project_staff_2", "demo_project_staff_4"].forEach((pid) =>
    [ADMIN, SUPPORT].forEach((who) =>
      push("projectMembers", `${pid}__${who.userId}`, {
        projectId: pid, tenantId, userId: who.userId, email: emailOf(who.userId), displayName: who.name,
        role: "reviewer", status: "active", invitedBy: PROFESSOR.userId, createdAt: ago(30), updatedAt: ago(2),
      }),
    ),
  );
  ["demo_project_staff_1", "demo_project_staff_3"].forEach((pid) =>
    push("projectMembers", `${pid}__${TA.userId}`, {
      projectId: pid, tenantId, userId: TA.userId, email: emailOf(TA.userId), displayName: TA.name,
      role: "member", status: "active", invitedBy: PROFESSOR.userId, createdAt: ago(28), updatedAt: ago(4),
    }),
  );

  // 3) دعوات معلّقة لكل دور (تُقبل وتُرفض فعلًا لأن البريد يطابق الفاعل).
  const invites: [string, typeof student1, "member" | "reviewer", typeof student1][] = [
    ["demo_project_4_1", student1, "member", students[3]],
    ["demo_project_9_1", student1, "reviewer", students[8]],
    ["demo_project_2_1", PROFESSOR, "reviewer", students[1]],
    ["demo_project_6_1", PROFESSOR, "reviewer", students[5]],
    ["demo_project_3_1", TA, "reviewer", students[2]],
    ["demo_project_8_1", TA, "reviewer", students[7]],
    ["demo_project_staff_1", ADMIN, "reviewer", PROFESSOR],
    ["demo_project_staff_3", SUPPORT, "reviewer", PROFESSOR],
  ];
  invites.forEach(([pid, who, role, by], k) => {
    if (!project(pid)) return;
    push("projectMembers", `${pid}__invite_${who.userId}`, {
      projectId: pid, tenantId, email: emailOf(who.userId), displayName: who.name, role, status: "pending",
      invitedBy: by.userId, invitedByName: by.name, projectTitle: project(pid)!.title, createdAt: ago(1 + k), updatedAt: ago(1 + k),
    });
  });

  // 4) إشعارات لكل دور.
  const notices: Record<string, [string, string, string, string, string, boolean][]> = {
    [student1.userId]: [
      ["deadline", "important", "موعد التسليم بعد 3 أيام", "«نظام حجز قاعات جامعية» — بقي قسم النتائج والمراجعة النهائية.", "/app/project/demo_project_1_1", true],
      ["comment", "normal", "تعليق جديد من د. سارة الخالد", "المنهجية واضحة. أضف تبريرًا لاستبعاد الاستجابات الناقصة.", "/app/project/demo_project_1_1", false],
      ["audit", "normal", "تم اعتماد درجتك في التسليم الأول", "حصلت على 86 من 100 في مقرر هندسة البرمجيات.", "/app/projects", false],
      ["team", "normal", "انضم ناصر العجمي إلى فريقك", "أصبح عضوًا في مشروع «نظام حجز قاعات جامعية».", "/app/project/demo_project_1_1?focus=team", false],
      ["assignment", "important", "تكليف جديد منشور", "تحليل البيانات التطبيقي — التسليم 2 متاح الآن.", "/app/upload", true],
      ["security", "normal", "تسجيل دخول من جهاز جديد", "iPhone — الكويت، اليوم 8:14 صباحًا.", "/app/settings", false],
    ],
    [PROFESSOR.userId]: [
      ["assignment", "important", "12 تسليمًا بانتظار التصحيح", "هندسة البرمجيات — التسليم 1.", "/app/course/demo_course_1/assignment/demo_assignment_1_1/submissions", true],
      ["audit", "critical", "مؤشر نزاهة يحتاج مراجعة", "مشروعان باستخدام ذكاء اصطناعي دون إفصاح في DS240.", "/app/professor", true],
      ["comment", "normal", "سؤال توضيحي جديد", "دانة العتيبي تسأل عن عدد الصفحات المسموح في التسليم 2.", "/app/course/demo_course_1", false],
      ["team", "normal", "دعوة لمراجعة مشروع", "دانة العتيبي دعتك مراجِعةً لمشروعها.", "/app/invitations", true],
      ["system", "normal", "اكتمل تصدير أرشيف المقرر", "أرشيف BUS420 جاهز للتنزيل.", "/app/jobs", false],
    ],
    [TA.userId]: [
      ["assignment", "important", "توزيع تصحيح جديد", "أُسند إليك 8 تسليمات في تحليل البيانات التطبيقي.", "/app/projects", true],
      ["comment", "normal", "رد على ملاحظتك", "عبدالله الفيلكاوي أضاف الإحالة للجدول 3.", "/app/project/demo_project_1_1", false],
      ["deadline", "normal", "جلسة شفهي غدًا 10:00 ص", "مشروع «نظام حجز قاعات جامعية» — قاعة 2-114.", "/app/calendar", false],
      ["team", "normal", "دعوة لمراجعة مشروع", "فهد المطيري دعاك مراجعًا لمشروعه.", "/app/invitations", true],
    ],
    [ADMIN.userId]: [
      ["security", "critical", "محاولات دخول متكررة", "5 محاولات فاشلة لحساب إداري خلال 10 دقائق — تم الحظر المؤقت.", "/app/control", true],
      ["subscription", "important", "استخدام المقاعد 84٪", "1,008 من 1,200 مقعد مستخدم هذا الفصل.", "/app/platform", false],
      ["system", "normal", "اكتملت مزامنة القوائم الليلية", "تمت مزامنة 2,340 تسجيلًا من نظام الطلبة.", "/app/jobs", false],
      ["audit", "important", "تقرير النزاهة الفصلي جاهز", "انخفضت حالات عدم الإفصاح 31٪ مقارنة بالفصل الماضي.", "/app/curriculum-twin", false],
    ],
    [SUPPORT.userId]: [
      ["system", "critical", "تذكرة حرجة بانتظار الرد", "«مراجعة صلاحيات الأدمن» — أولوية حرجة منذ أيام.", "/app/support-console", true],
      ["system", "important", "تذكرتان جديدتان اليوم", "فاتورة وحدة الشفهي وصلاحية التصحيح في DS240.", "/app/support-console", true],
      ["system", "normal", "اكتمل تصدير سجل التذاكر", "ملف التذاكر الأسبوعي جاهز للتنزيل.", "/app/jobs", false],
      ["team", "normal", "دعوة لمراجعة مشروع", "د. سارة الخالد دعتك مراجعةً لمشروعها.", "/app/invitations", true],
    ],
  };
  Object.entries(notices).forEach(([userId, items]) =>
    items.forEach(([type, priority, title, body, targetPath, requiresAction], k) =>
      push("notifications", `demo_notice_${userId}_${k + 1}`, {
        tenantId, userId, type, priority, title, body, targetPath, requiresAction,
        channels: ["in_app", "email"], delivery: { in_app: "sent", email: "sent" },
        ...(k >= 3 ? { readAt: hoursAgo(k * 5) } : {}),
        createdAt: hoursAgo(2 + k * 7),
      }),
    ),
  );

  // 5) المهام الخلفية.
  const jobKinds: [string, string, "completed" | "running" | "failed" | "queued", number][] = [
    ["project_compile", "تحليل كراسة التكليف", "completed", 100],
    ["project_export", "تصدير المشروع PDF", "running", 60],
    ["course_archive_export", "تصدير أرشيف المقرر", "completed", 100],
    ["roster_sync", "مزامنة القوائم", "failed", 40],
    ["viva_report", "تقرير جلسة الشفهي", "queued", 0],
  ];
  [student1, PROFESSOR, TA, ADMIN, SUPPORT].forEach((who, w) =>
    jobKinds.slice(w % 2, (w % 2) + 3).forEach(([type, label, state, progress], k) =>
      push("jobs", `demo_job_${who.userId}_${k + 1}`, {
        tenantId, userId: who.userId, type, state, progress,
        title: `${label} — ${who.name}`,
        stages: [
          { key: "queued", label: "في الانتظار", state: "completed", at: hoursAgo(10 + k) },
          { key: "process", label, state: state === "completed" ? "completed" : state === "failed" ? "failed" : state === "running" ? "running" : "pending", at: hoursAgo(9 + k) },
          { key: "deliver", label: "تجهيز النتيجة", state: state === "completed" ? "completed" : "pending" },
        ],
        ...(state === "failed" ? { error: "انتهت مهلة الاتصال بنظام الطلبة؛ ستُعاد المحاولة تلقائيًا." } : {}),
        ...(state === "completed" ? { resultRef: `demo_result_${k + 1}` } : {}),
        createdAt: hoursAgo(10 + k * 6),
        updatedAt: hoursAgo(1 + k * 5),
      }),
    ),
  );

  // 6) تذاكر دعم لكل دور من الطاقم (للطلبة تذاكر في البذرة الأساسية).
  [
    [PROFESSOR, "academic", "important", "إضافة شعبة مسائية لمقرر CS310", "أحتاج شعبة إضافية بنفس التكليفات ورمز انضمام مستقل.", "in_progress"],
    [PROFESSOR, "technical", "normal", "تصدير الدرجات إلى نظام الطلبة", "زر التصدير يُنتج ملفًا بترميز لا يقرؤه النظام.", "resolved"],
    [TA, "account", "normal", "صلاحية التصحيح في DS240", "لا أرى تسليمات الشعبة الثانية ضمن قائمتي.", "open"],
    [ADMIN, "billing", "important", "فاتورة وحدة الشفهي", "نحتاج نسخة ضريبية من فاتورة سبتمبر باسم الجامعة.", "open"],
    [SUPPORT, "account", "normal", "تفعيل التحقق الثنائي لحساب الدعم", "أحتاج تفعيل التحقق الثنائي قبل مراجعة التذاكر الحساسة.", "open"],
    [ADMIN, "security", "critical", "مراجعة صلاحيات الأدمن", "طلب مراجعة دورية لصلاحيات 6 حسابات إدارية.", "in_progress"],
  ].forEach(([who, category, priority, subject, message, status], k) => {
    const person = who as typeof student1;
    push("supportTickets", `TKT-${2100 + k}`, {
      tenantId, userId: person.userId, displayName: person.name, userName: person.name, email: emailOf(person.userId),
      category, priority, subject, message, body: message, status, createdAt: ago(6 - k), updatedAt: ago(Math.max(0, 3 - k)),
    });
  });

  // تذاكر إضافية للطالب الأول كي لا يبدو سجل الدعم في شاشته وحيدًا.
  [
    ["academic", "normal", "استفسار عن معيار التوثيق في CS310", "هل يُقبل أسلوب APA 7 بدل IEEE في تقرير المرحلة الثانية؟", "resolved", 21],
    ["account", "normal", "تحديث البريد الجامعي في الملف الشخصي", "تغيّر بريدي الجامعي وأحتاج تحديثه ليصلني الإشعار.", "resolved", 14],
    ["academic", "important", "طلب تمديد موعد تسليم DS240", "ظرف صحي طارئ؛ أرجو تمديد الموعد ثلاثة أيام مع إرفاق التقرير.", "in_progress", 4],
  ].forEach(([category, priority, subject, message, status, days], k) =>
    push("supportTickets", `TKT-${2200 + k}`, {
      tenantId, userId: student1.userId, displayName: student1.name, userName: student1.name, email: emailOf(student1.userId),
      category, priority, subject, message, body: message, status, createdAt: ago(days as number), updatedAt: ago(Math.max(0, (days as number) - 2)),
    }),
  );

  // 7) شهادات الجواز وروابط المشاركة للطالب الأول.
  [
    ["شهادة إتمام مشروع بحثي موثّق — CS310", "جامعة الخليج التطبيقية", "institution_verified", 12],
    ["شارة التحليل الإحصائي التطبيقي", "مركز التعلّم الإلكتروني", "institution_verified", 30],
    ["اجتياز المناقشة الشفهية بتقدير ممتاز", "د. سارة الخالد", "project", 5],
  ].forEach(([title, issuer, verification, days], k) =>
    push("credentials", `demo_credential_${k + 1}`, { tenantId, userId: student1.userId, title, issuer, verification, date: ago(days as number), createdAt: ago(days as number) }),
  );
  [
    ["passport", student1.userId, "الجواز الأكاديمي — نسخة جهات التوظيف", 42],
    ["project", "demo_project_1_3", "مشروع «دراسة سلوك المستهلك الكويتي» — ملف إنجاز", 17],
  ].forEach(([kind, targetId, label, views], k) =>
    push("publicShares", `demo_share_${k + 1}`, {
      tenantId, userId: student1.userId, kind, targetId, label,
      tokenHash: createHash("sha256").update(`demo_share_token_${k}`).digest("hex"),
      expiresAt: ahead(30 - k * 10), passwordProtected: k === 1, watermark: "نسخة للمراجعة فقط",
      viewCount: views, lastViewedAt: hoursAgo(5 + k * 20), createdAt: ago(9 - k * 3), snapshot: {},
    }),
  );

  // 8) أسئلة توضيحية على التكليفات (تظهر للطالب داخل المشروع وللأستاذ في المقرر).
  ctx.assignments.forEach((row, a) => {
    const assignment = row.data as unknown as CourseAssignmentRecord;
    if (assignment.status !== "published") return;
    [
      ["هل الحد الأقصى 20 صفحة يشمل الملاحق والمراجع؟", "لا، الملاحق والمراجع خارج الحد.", "answered", "student_asked", 7],
      ["هل يُقبل مصدر من تقرير حكومي غير محكّم ضمن المصادر الثمانية؟", undefined, "open", "ambiguity_detected", 3],
    ].forEach(([question, answer, status, origin, upvotes], k) =>
      push("clarificationThreads", `demo_clar_${a + 1}_${k + 1}`, {
        assignmentId: assignment.id, courseId: assignment.courseId, tenantId, question,
        ...(answer ? { answer } : {}), status, origin, upvotes, version: 1, createdAt: ago(8 - k * 3), updatedAt: ago(4 - k * 2),
      }),
    );
  });

  // 9) مؤشرات لوحة المؤسسة: أحداث المنتج، ومحاسبة استخدام الذكاء الاصطناعي، والاستخدام العادل.
  const funnel = ["assignment_uploaded", "assignment_parsed", "workspace_created", "project_started", "audit_run", "viva_completed", "project_completed", "tutor_explained", "subscription_started"];
  students.forEach((s, i) =>
    funnel.slice(0, 3 + (i % 7)).forEach((name, k) =>
      push("productEvents", `demo_event_${i + 1}_${k + 1}`, {
        tenantId, userId: s.userId, name, provenance: "server",
        projectId: `demo_project_${i + 1}_1`, createdAt: ago((i + k) % 30),
      }),
    ),
  );
  students.forEach((s, i) => {
    if (i % 3) return;
    push("productEvents", `demo_event_${i + 1}_second`, { tenantId, userId: s.userId, name: "project_started", provenance: "server", projectId: `demo_project_${i + 1}_2`, createdAt: ago(i % 20) });
  });
  [
    ["deny", "free_project_preview", 0.91, ["shared_device", "rapid_signup"]],
    ["step_up", "free_viva_session", 0.64, ["new_device"]],
    ["deny", "free_project_preview", 0.86, ["disposable_email"]],
    ["allow", "free_project_preview", 0.12, []],
    ["step_up", "free_project_preview", 0.58, ["vpn_detected"]],
  ].forEach(([decision, benefit, score, reasonCodes], k) =>
    push("abuseEvents", `demo_abuse_${k + 1}`, { tenantId, decision, benefit, score, reasonCodes, createdAt: hoursAgo(3 + k * 11) }),
  );
  [3, 2].forEach((accountCount, k) =>
    push("abuseSignalRegistry", `demo_signal_${k + 1}`, { tenantId, type: "device", accountCount, createdAt: ago(k + 1) }),
  );

  // 10) سجلات المنصة وخريطة المنهج (يحتاجها «التوأم الأكاديمي» ومركز المنصة).
  Object.entries(platformRows(
    tenantId,
    /* لا تُزرع الموارد التي يغيّر وجودُها سلوكَ المنصة نفسها: الهوية وإعدادات
     * النظام تستبدل عنوان الواجهة وشعارها، والـWebhooks تُطلق طلبات خارجية. */
    Object.keys(PLATFORM_TITLES).filter((key) => !["brandConfig", "systemConfig", "webhooks"].includes(key)),
  )).forEach(([collection, rows]) => (sink[collection] ||= []).push(...rows));

  Object.entries(sink).forEach(([collection, rows]) => store.seed(collection, rows));
}

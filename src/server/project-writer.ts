import { createHmac, randomUUID } from "node:crypto";
import type {
  AcademicAssistanceMode,
  ProjectDNA,
  ProjectDocument,
  ProjectDocumentSection,
  ProjectVariationProfile,
  ProjectWriterRequest,
  ProjectXRayFinding,
  ProjectXRayReport,
} from "../types";
import type { AcademicTaskOutput } from "./ai";

export interface VerifiedSourceInput {
  title: string;
  detail?: string;
  sourceUrl?: string;
  verification?: string;
}

export interface ProjectWriterGeneratorInput {
  sectionTitle: string;
  purpose: string;
  prompt: string;
  previousMemory: string;
  targetWords: number;
}

export type ProjectWriterGenerator = (
  input: ProjectWriterGeneratorInput,
) => Promise<AcademicTaskOutput>;

const ARGUMENT_SHAPES = [
  "problem-to-evidence-to-recommendation",
  "question-to-comparison-to-judgement",
  "context-to-mechanism-to-implication",
  "claim-to-counterclaim-to-synthesis",
  "case-to-pattern-to-practical-action",
];
const STRUCTURE_RHYTHMS = [
  "short opening, evidence-rich middle, decisive close",
  "concept first, applied example second, implication last",
  "progressive questions with explicit transitions",
  "comparison-led paragraphs with a compact synthesis",
  "case-led explanation followed by general principles",
];
const EXPLANATION_STYLES = [
  "plain academic Arabic with compact definitions",
  "formal academic prose with clear signposting",
  "analytical prose using cause-and-effect links",
  "evidence-led prose with careful qualification",
  "direct student voice with disciplined academic wording",
];
const EXAMPLE_LENSES = [
  "local Kuwait or Gulf context where genuinely relevant",
  "small realistic case comparison",
  "process and decision-making example",
  "stakeholder impact example",
  "implementation and measurement example",
  "risk and alternative-scenario example",
];

function pick<T>(items: T[], digest: Buffer, offset: number) {
  return items[digest[offset % digest.length] % items.length];
}

export function buildVariationProfile(
  project: ProjectDNA,
  userId: string,
  secret = process.env.PROJECT_VARIATION_SECRET ||
    process.env.CSRF_SIGNING_SECRET ||
    "academicos-development-variation-v1",
): ProjectVariationProfile {
  const assignmentFingerprint = [
    project.course,
    project.title,
    project.projectType,
    project.originalAssignment?.text?.slice(0, 800) || "",
  ].join("|");
  const digest = createHmac("sha256", secret)
    .update(`${userId}|${project.id}|${assignmentFingerprint}`)
    .digest();
  return {
    id: digest.toString("hex").slice(0, 12),
    argumentShape: pick(ARGUMENT_SHAPES, digest, 0),
    structureRhythm: pick(STRUCTURE_RHYTHMS, digest, 7),
    explanationStyle: pick(EXPLANATION_STYLES, digest, 13),
    exampleLens: pick(EXAMPLE_LENSES, digest, 19),
  };
}

function normalizeLanguage(value?: string) {
  const language = String(value || "العربية").trim().slice(0, 80);
  return language || "العربية";
}

function words(value: string) {
  return value.trim() ? value.trim().split(/\s+/u).length : 0;
}

function sectionSlug(title: string, index: number) {
  const slug = title
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || `section-${index + 1}`;
}

function includesAny(value: string, needles: string[]) {
  const normalized = value.toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}

export function decideProjectWritingAccess(
  project: ProjectDNA,
  assistanceMode: AcademicAssistanceMode,
) {
  const prohibited = (project.aiPolicy.prohibited || []).join(" ");
  const explicitBan = /no ai|ai not allowed|artificial intelligence prohibited|ممنوع.*ذكاء|منع.*ذكاء/i.test(
    prohibited,
  );
  if (assistanceMode === "practice") {
    return {
      fullDraft: true,
      disclosure:
        "مسودة تدريبية أنشئت بمساعدة AcademicOS. لا تُقدَّم كتسليم نهائي إلا بعد مراجعة سياسة المقرر والتحقق من المصادر والبيانات وفهم المحتوى.",
    };
  }
  if (assistanceMode === "policy_strict") {
    return {
      fullDraft: false,
      disclosure:
        "وضع السياسة الصارمة: تعرض المنصة هيكلًا تفصيليًا وأسئلة إرشادية، ويكتب الطالب النص القابل للتسليم بنفسه.",
    };
  }
  if (
    project.aiPolicy.needsConfirmation ||
    project.aiPolicy.provenance === "extracted_unverified" ||
    project.aiPolicy.level < 4 ||
    explicitBan
  ) {
    throw Object.assign(
      new Error(
        "لا يمكن إنشاء تسليم كامل في وضع التسليم المصرّح قبل تأكيد سياسة المقرر أو رفع مستوى السماح إلى L4 على الأقل.",
      ),
      { status: 403, code: "PROJECT_WRITING_POLICY_BLOCKED" },
    );
  }
  return {
    fullDraft: true,
    disclosure: project.aiPolicy.disclosureRequired
      ? `تم استخدام AcademicOS في التخطيط والصياغة والمراجعة وفق سياسة المقرر: ${project.aiPolicy.summary}`
      : `تم إنشاء المشروع بمساعدة AcademicOS وفق سياسة المقرر المؤكدة: ${project.aiPolicy.summary}`,
  };
}

function buildSectionPlan(project: ProjectDNA, desiredPages: number) {
  const haystack = `${project.projectType} ${project.academicDomain} ${project.title}`;
  const isResearch = includesAny(haystack, [
    "research",
    "بحث",
    "thesis",
    "رسالة",
    "دراسة",
  ]);
  const isTechnical = includesAny(haystack, [
    "engineering",
    "software",
    "computer",
    "تقني",
    "هندس",
    "برمج",
    "code",
  ]);
  const isBusiness = includesAny(haystack, [
    "business",
    "market",
    "management",
    "تسويق",
    "إدارة",
    "أعمال",
  ]);
  const core = isResearch
    ? [
        ["المقدمة ومشكلة الدراسة", "تحديد السياق والمشكلة وسؤال البحث والأهداف وحدود الدراسة"],
        ["الإطار النظري والدراسات السابقة", "تركيب الأدبيات وتحديد الفجوة دون اختلاق مصادر"],
        ["المنهجية", "شرح التصميم والعينة والأداة والإجراءات والقيود بما يعكس العمل الفعلي فقط"],
        ["النتائج والتحليل", "عرض النتائج الحقيقية أو وضع أماكن واضحة للبيانات التي لم تُجمع بعد"],
        ["المناقشة", "تفسير النتائج وربطها بالسؤال والأدلة والبدائل والقيود"],
        ["الخاتمة والتوصيات", "إجابة السؤال وتلخيص القيمة وتقديم توصيات قابلة للتنفيذ"],
      ]
    : isTechnical
      ? [
          ["مقدمة المشكلة والمتطلبات", "تحديد المستخدم والمشكلة والنطاق ومعايير النجاح"],
          ["التحليل والبدائل", "مقارنة البدائل وتبرير القرارات التقنية"],
          ["التصميم المعماري", "شرح المكونات وتدفق البيانات والافتراضات والحدود"],
          ["التنفيذ", "توثيق ما تم تنفيذه فعلياً دون ادعاء تشغيل غير مثبت"],
          ["الاختبار والتقييم", "ربط الاختبارات بمعايير النجاح وذكر النتائج الحقيقية فقط"],
          ["الخاتمة والعمل المستقبلي", "تلخيص الحل والقيود وخطوات التطوير التالية"],
        ]
      : isBusiness
        ? [
            ["الملخص التنفيذي", "عرض المشكلة والفرصة والاستنتاج المقترح بإيجاز"],
            ["السياق وتحليل السوق", "تحديد النطاق والعملاء والمنافسة والافتراضات"],
            ["التحليل والأدلة", "تطوير الحجة باستخدام بيانات ومصادر قابلة للتحقق"],
            ["البدائل والتوصية", "مقارنة الخيارات وتبرير التوصية والمفاضلات"],
            ["خطة التنفيذ والقياس", "تحديد المراحل والموارد والمخاطر ومؤشرات النجاح"],
            ["الخاتمة", "تجميع القرار والقيمة والخطوة التالية"],
          ]
        : [
            ["المقدمة", "تحديد الموضوع والسؤال والنطاق وخريطة المشروع"],
            ["الخلفية والمفاهيم", "تعريف المفاهيم وبناء سياق مدعوم بالأدلة"],
            ["التحليل", "تطوير الحجة ومناقشة البدائل والأدلة"],
            ["التطبيق أو دراسة الحالة", "تطبيق التحليل على حالة مناسبة دون اختلاق حقائق"],
            ["المناقشة والتقييم", "فحص القوة والقيود والاعتراضات"],
            ["الخاتمة والتوصيات", "تلخيص الاستنتاجات والإجابة عن هدف المشروع"],
          ];
  const totalTargetWords = Math.max(900, Math.min(12_000, desiredPages * 330));
  return core.map(([title, purpose], index) => ({
    id: sectionSlug(title, index),
    title,
    purpose,
    targetWords: Math.round(totalTargetWords / core.length),
  }));
}

function nativeSection(
  project: ProjectDNA,
  title: string,
  purpose: string,
  fullDraft: boolean,
  variation: ProjectVariationProfile,
) {
  const required = project.requirements
    .slice(0, 4)
    .map((item) => `- ${item.label}: ${item.value}`)
    .join("\n");
  if (!fullDraft)
    return `## ${title}\n\nهدف القسم: ${purpose}.\n\nاكتب هذا القسم وفق المسار الآتي:\n1. ابدأ بفكرة محددة مرتبطة بسؤال المشروع.\n2. اربط كل ادعاء بدليل متحقق منه.\n3. ناقش بديلاً أو قيداً واحداً على الأقل.\n4. اختم بما يمهد للقسم التالي.\n\nمتطلبات يجب مراعاتها:\n${required || "- راجع متطلبات التكليف الأصلية."}`;
  return `## ${title}\n\nهذا قسم أولي مخصص لمشروع «${project.title}». وظيفته ${purpose}. يبدأ العرض بتحديد الفكرة المركزية وربطها مباشرةً بهدف المشروع، ثم ينظم الأدلة وفق نمط ${variation.argumentShape}. يجب استبدال أي موضع يحتاج بيانات أو مرجع بدليل متحقق منه قبل التسليم.\n\nيعالج القسم المتطلبات الآتية دون ادعاء نتائج غير موجودة:\n${required || "- متطلبات التكليف كما وردت في الملف الأصلي."}\n\nينبغي أن يتضمن التطوير النهائي تفسيراً واضحاً، مثالاً مناسباً من منظور ${variation.exampleLens}، ومناقشةً لقيد أو تفسير بديل، ثم خاتمة قصيرة تربط هذا القسم بما يليه.`;
}

function sectionExplanation(title: string, purpose: string) {
  return `الفكرة الأساسية في «${title}» هي: ${purpose}. عند المناقشة، ابدأ بالهدف ثم اذكر الدليل الذي استخدمته وسبب اختياره وأهم قيد عليه.`;
}

function compactMemory(sections: ProjectDocumentSection[]) {
  return sections
    .slice(-3)
    .map((section) => `${section.title}: ${section.content.slice(0, 650)}`)
    .join("\n\n")
    .slice(0, 2500);
}

export async function composeProjectDocument(input: {
  project: ProjectDNA;
  request: ProjectWriterRequest;
  userId: string;
  verifiedSources?: VerifiedSourceInput[];
  generateSection?: ProjectWriterGenerator;
  variationSecret?: string;
}): Promise<ProjectDocument> {
  const { project, request, userId } = input;
  const language = normalizeLanguage(request.language);
  const desiredPages = Math.max(3, Math.min(35, Number(request.desiredPages || 12)));
  const access = decideProjectWritingAccess(project, request.assistanceMode);
  const variation = buildVariationProfile(project, userId, input.variationSecret);
  const plan = buildSectionPlan(project, desiredPages);
  const verifiedSources = (input.verifiedSources || []).filter(
    (source) =>
      source.verification === "verified" ||
      source.verification === "user_verified" ||
      source.verification === "institution_verified",
  );
  const sections: ProjectDocumentSection[] = [];

  for (let index = 0; index < plan.length; index += 1) {
    const item = plan[index];
    let output: AcademicTaskOutput | undefined;
    if (input.generateSection) {
      const existing = (request.existingDraft || "").slice(0, 24_000);
      const feedback = (request.professorFeedback || "").slice(0, 8_000);
      output = await input.generateSection({
        sectionTitle: item.title,
        purpose: item.purpose,
        targetWords: item.targetWords,
        previousMemory: compactMemory(sections),
        prompt: [
          `Write section ${index + 1} of ${plan.length} in ${language}.`,
          `Project: ${project.title}. Course: ${project.course}. Domain: ${project.academicDomain}.`,
          `Purpose: ${item.purpose}. Target approximately ${item.targetWords} words.`,
          `Student-specific variation ID: ${variation.id}. Use ${variation.argumentShape}; ${variation.structureRhythm}; ${variation.explanationStyle}; example lens: ${variation.exampleLens}.`,
          "This variation is a deliberate anti-duplication constraint. Do not reuse stock introductions, generic paragraph templates, or identical example sequences across learners.",
          access.fullDraft
            ? "Produce a coherent full draft for learning or policy-permitted use."
            : "Produce a detailed guided scaffold with questions and sentence starters, not final submission prose.",
          "Never invent a citation, DOI, author, dataset, participant, experiment, result, quote, or completed action.",
          verifiedSources.length
            ? `Only the following sources may be described as verified: ${verifiedSources.map((source) => `${source.title}${source.sourceUrl ? ` (${source.sourceUrl})` : ""}`).join("; ")}.`
            : "No verified sources were supplied. Use explicit [مصدر مطلوب] markers wherever evidence is needed.",
          request.topicNotes ? `Student decisions and topic notes: ${request.topicNotes.slice(0, 5000)}` : "",
          request.learnerVoiceSample
            ? `Preserve the student's transparent writing preferences without attempting to evade AI detection. Voice sample: ${request.learnerVoiceSample.slice(0, 1800)}`
            : "",
          request.mode === "rescue" && existing
            ? `Rescue the relevant ideas from this existing draft, correcting contradictions and unsupported language: ${existing}`
            : "",
          request.mode === "revise" && feedback
            ? `Apply this professor feedback and make the change visible in the section: ${feedback}`
            : "",
          `Confirmed requirements: ${project.requirements.map((requirement) => `${requirement.label}: ${requirement.value}`).join(" | ")}`,
          `Rubric: ${project.rubric.map((criterion) => `${criterion.id}:${criterion.title} (${criterion.weighting}%)`).join(" | ")}`,
          "Return the section prose in summary, a plain-language explanation in findings, defense questions in suggestions, and integrity/source warnings in warnings.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      });
    }
    const content =
      output?.summary?.trim() ||
      nativeSection(project, item.title, item.purpose, access.fullDraft, variation);
    const rubricIds = project.rubric
      .filter((_, rubricIndex) => rubricIndex % plan.length === index)
      .map((criterion) => criterion.id);
    sections.push({
      id: item.id,
      title: item.title,
      purpose: item.purpose,
      content,
      explanation:
        output?.findings?.filter(Boolean).slice(0, 3).join(" ") ||
        sectionExplanation(item.title, item.purpose),
      sourceNotes: output?.warnings?.filter(Boolean).slice(0, 8) || [],
      defenseQuestions:
        output?.suggestions?.filter(Boolean).slice(0, 5) || [
          `ما الهدف من قسم «${item.title}»؟`,
          "ما أقوى دليل فيه، وما القيد الذي يؤثر عليه؟",
        ],
      rubricIds,
      status:
        access.fullDraft && verifiedSources.length ? "verified" : "draft",
      wordCount: words(content),
    });
  }

  const now = new Date().toISOString();
  const rubricCovered = new Set(sections.flatMap((section) => section.rubricIds));
  const sourceWarnings = sections.flatMap((section) => section.sourceNotes);
  const integrityWarnings = [
    ...new Set([
      ...sourceWarnings,
      ...(verifiedSources.length
        ? []
        : ["لم تُرفق مصادر متحققة؛ يجب استبدال علامات [مصدر مطلوب] قبل التسليم."]),
      ...(request.mode === "rescue" && !request.existingDraft
        ? ["وضع الإنقاذ يحتاج مسودة مرفوعة للحصول على تشخيص كامل."]
        : []),
    ]),
  ].slice(0, 20);
  return {
    id: randomUUID(),
    projectId: project.id,
    mode: request.mode,
    assistanceMode: request.assistanceMode,
    language,
    title: project.title,
    abstract: `مشروع «${project.title}» منظّم في ${sections.length} أقسام مترابطة. يوضح الملف هدف كل قسم، الأدلة المطلوبة، وأسئلة المناقشة. راجع النص والمصادر والبيانات بما يتوافق مع سياسة المقرر قبل التسليم.`,
    sections,
    bibliography: verifiedSources.map((source) =>
      [source.title, source.sourceUrl].filter(Boolean).join(" — "),
    ),
    disclosure: access.disclosure,
    integrityWarnings,
    variation,
    quality: {
      rubricCoverage: project.rubric.length
        ? Math.round((rubricCovered.size / project.rubric.length) * 100)
        : 65,
      sourceConfidence: verifiedSources.length
        ? Math.min(100, 45 + verifiedSources.length * 7)
        : 15,
      coherence: input.generateSection ? 82 : 58,
      discussability: Math.min(
        96,
        50 + sections.filter((section) => section.defenseQuestions.length).length * 7,
      ),
    },
    createdAt: now,
    updatedAt: now,
  };
}

function sentenceDuplicates(text: string) {
  const sentences = text
    .split(/[.!؟!?\n]+/u)
    .map((value) => value.trim().replace(/\s+/g, " "))
    .filter((value) => value.length > 55);
  const counts = new Map<string, number>();
  for (const sentence of sentences) {
    const key = sentence.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.values()].filter((count) => count > 1).length;
}

export function inspectProjectDraft(
  project: ProjectDNA,
  rawDraft: string,
): ProjectXRayReport {
  const draft = String(rawDraft || "").slice(0, 160_000);
  const wordCount = words(draft);
  const headings = (draft.match(/^#{1,4}\s+.+$/gm) || []).length;
  const citations = (
    draft.match(/\([\p{L}][^()]{1,55},\s*(?:19|20)\d{2}\)|\[[0-9]{1,3}\]/gu) || []
  ).length;
  const hasReferences = /(?:المراجع|المصادر|references|bibliography)/i.test(draft);
  const duplicateCount = sentenceDuplicates(draft);
  const normalizedDraft = draft.toLowerCase();
  const rubricHits = project.rubric.filter((criterion) => {
    const terms = `${criterion.title} ${criterion.description}`
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((term) => term.length > 4)
      .slice(0, 8);
    return terms.some((term) => normalizedDraft.includes(term));
  }).length;
  const structure = Math.min(100, 20 + headings * 11 + (wordCount > 900 ? 20 : 0));
  const sources = Math.min(100, (hasReferences ? 30 : 0) + citations * 5);
  const rubric = project.rubric.length
    ? Math.round((rubricHits / project.rubric.length) * 100)
    : 60;
  const coherence = Math.max(20, Math.min(94, 78 - duplicateCount * 10 + (headings > 3 ? 8 : 0)));
  const discussability = Math.max(
    20,
    Math.min(92, Math.round((structure + rubric + coherence) / 3) - (sources < 35 ? 10 : 0)),
  );
  const findings: ProjectXRayFinding[] = [];
  const add = (
    severity: ProjectXRayFinding["severity"],
    category: ProjectXRayFinding["category"],
    title: string,
    detail: string,
    action: string,
  ) => findings.push({ id: randomUUID(), severity, category, title, detail, action });
  if (wordCount < 700)
    add("critical", "structure", "المسودة أقصر من مشروع متكامل", `تم رصد ${wordCount} كلمة تقريباً.`, "ابنِ الأقسام الناقصة من متطلبات التكليف قبل تحسين الأسلوب.");
  else add("good", "structure", "للمسودة حجم قابل للمراجعة", `تم رصد ${wordCount} كلمة و${headings} عناوين.`, "راجع توازن طول الأقسام.");
  if (!hasReferences || citations < 3)
    add("critical", "sources", "الدعم المرجعي ضعيف", `تم رصد ${citations} إحالات داخلية${hasReferences ? " مع قسم مراجع" : " دون قسم مراجع واضح"}.`, "أضف مصادر حقيقية متحققة واربط كل ادعاء رئيسي بها.");
  else add("good", "sources", "يوجد أساس مرجعي", `تم رصد ${citations} إحالات وقسم للمراجع.`, "تحقق يدوياً من DOI والروابط والصفحات.");
  if (rubric < 70)
    add("attention", "rubric", "تغطية الـRubric غير واضحة", `التغطية النصية التقديرية ${rubric}%.`, "اربط كل معيار بعنوان أو فقرة ودليل محدد.");
  else add("good", "rubric", "الـRubric ظاهر في بنية المشروع", `التغطية النصية التقديرية ${rubric}%.`, "أكّد مواضع الأدلة قبل التسليم.");
  if (duplicateCount)
    add("attention", "language", "يوجد تكرار حرفي", `تم رصد ${duplicateCount} جمل طويلة مكررة.`, "ادمج الفقرات واحتفظ بالنسخة الأقوى فقط.");
  if (/\b(?:lorem ipsum|as an ai|i cannot|chatgpt)\b/i.test(draft))
    add("critical", "language", "بقايا توليد ظاهرة", "توجد عبارات لا تنتمي إلى المستند الأكاديمي.", "احذف بقايا المحادثة وراجع الانتقالات.");
  return {
    projectId: project.id,
    generatedAt: new Date().toISOString(),
    wordCount,
    estimatedPages: Number((wordCount / 330).toFixed(1)),
    scores: { structure, sources, rubric, coherence, discussability },
    findings,
    professorQuestions: [
      `ما المشكلة التي يحلها مشروع «${project.title}» تحديداً؟`,
      project.rubric[0]
        ? `أين الدليل الذي يثبت تحقيق معيار «${project.rubric[0].title}»؟`
        : "ما المعيار الذي استخدمته للحكم على جودة العمل؟",
      "ما أضعف افتراض في المشروع؟ وما الذي سيتغير لو كان خاطئاً؟",
      "أي نتيجة تعتمد على بيانات فعلية، وأي جزء ما زال مقترحاً أو محاكاة؟",
    ],
  };
}

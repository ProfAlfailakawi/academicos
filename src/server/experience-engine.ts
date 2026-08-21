import { createHash } from "node:crypto";
import type {
  ControlPlaneData,
  CourseAssignmentRecord,
  CourseRecord,
  CourseSubmissionRecord,
  FacultyAutomationBrief,
  InstitutionCommandCenter,
  MissionControlPlan,
  ProjectDNA,
  RescuePlan,
} from "../types";

const nowIso = () => new Date().toISOString();
const pct = (value: number, total: number) =>
  total ? Math.round((value / total) * 100) : 100;
const stableId = (prefix: string, value: string) =>
  `${prefix}_${createHash("sha1").update(value).digest("hex").slice(0, 12)}`;

export function addConcierge(plan: MissionControlPlan): MissionControlPlan {
  const first = plan.actions[0];
  const headline = first ? `ابدأ بـ${first.title}` : "يومك الأكاديمي مستقر";
  const explanation = first
    ? `${first.reason} خصصنا لها ${first.estimatedMinutes} دقيقة ضمن ميزانيتك اليومية.`
    : "لا توجد خطوة ملحّة. راجع الفصل أو أضف تكليفًا عندما يصل إليك.";
  const automationCandidates = plan.actions.slice(0, 3).map((action) => ({
    id: `concierge_${action.id}`,
    title: action.title,
    detail: action.reason,
    path: action.path,
    requiresConfirmation: true,
  }));
  return {
    ...plan,
    concierge: { headline, explanation, automationCandidates },
  };
}

export function buildRescuePlan(
  project: ProjectDNA,
  availableMinutes = 180,
  at = Date.now(),
): RescuePlan {
  const incomplete = project.tasks.filter(
    (task) => task.status !== "completed",
  );
  const remainingMinutes = incomplete.reduce(
    (sum, task) => sum + Math.max(15, Number(task.estimatedMinutes || 60)),
    0,
  );
  const deadlineMs = project.deadlines.final
    ? new Date(project.deadlines.final).getTime()
    : NaN;
  const hoursLeft = Number.isFinite(deadlineMs)
    ? Math.max(0, (deadlineMs - at) / 3600000)
    : Number.POSITIVE_INFINITY;
  const capacity = Math.max(30, Math.min(720, Math.floor(availableMinutes)));
  const severity: RescuePlan["severity"] =
    hoursLeft <= 24 || remainingMinutes > capacity * 2
      ? "critical"
      : hoursLeft <= 72 || remainingMinutes > capacity
        ? "tight"
        : "steady";
  const ordered = [...incomplete].sort((a, b) => {
    const state = (v: string) =>
      v === "blocked" ? 0 : v === "in_progress" ? 1 : v === "ready" ? 2 : 3;
    return (
      state(a.status) - state(b.status) ||
      (a.dueDate || project.deadlines.final || "9999").localeCompare(
        b.dueDate || project.deadlines.final || "9999",
      )
    );
  });
  let budget = capacity;
  const phases: RescuePlan["phases"] = [];
  const deferred: string[] = [];
  for (const task of ordered) {
    const requested = Math.max(15, Number(task.estimatedMinutes || 60));
    if (budget <= 0) {
      deferred.push(task.id);
      continue;
    }
    const minutes = Math.min(requested, budget);
    budget -= minutes;
    phases.push({
      id: stableId("rescue", task.id),
      title: task.title,
      minutes,
      reason:
        task.status === "blocked"
          ? "ابدأ بإزالة العائق قبل أي عمل تابع."
          : task.status === "in_progress"
            ? "أكمل العمل المفتوح لتقليل تبديل السياق."
            : "هذه الخطوة تخدم أقرب مخرج غير مكتمل.",
      taskIds: [task.id],
      mustDo: phases.length < 3,
    });
  }
  const summary =
    severity === "critical"
      ? `خطة إنقاذ حرجة: ركّز على ${Math.min(3, phases.length)} خطوات أساسية واترك ${deferred.length} خطوة لما بعد التسليم أو اطلب تمديدًا رسميًا.`
      : severity === "tight"
        ? `الوقت ضيق؛ الخطة تضغط العمل في ${capacity} دقيقة مع تأجيل ${deferred.length} خطوة منخفضة الأولوية.`
        : `الخطة قابلة للتنفيذ ضمن وقتك الحالي دون ضغط غير ضروري.`;
  return {
    projectId: project.id,
    generatedAt: new Date(at).toISOString(),
    severity,
    availableMinutes: capacity,
    remainingMinutes,
    deadline: project.deadlines.final,
    summary,
    phases,
    deferredTaskIds: deferred,
    requiresConfirmation: true,
  };
}

export function buildFacultyAutomation(
  courses: CourseRecord[],
  assignments: CourseAssignmentRecord[],
): FacultyAutomationBrief {
  const actions: FacultyAutomationBrief["actions"] = [];
  for (const course of courses) {
    const related = assignments.filter((item) => item.courseId === course.id);
    const linked = new Set(
      related.flatMap((item) => item.outcomes.map((x) => x.trim())),
    );
    const uncovered = course.outcomes.filter(
      (outcome) => !linked.has(outcome.trim()),
    );
    if (uncovered.length)
      actions.push({
        id: stableId("faculty", `${course.id}:outcomes`),
        priority: "important",
        title: `اربط ${uncovered.length} مخرجًا في ${course.code}`,
        detail: "لا توجد تكليفات منشورة تقيس هذه المخرجات حتى الآن.",
        path: `/app/course/${course.id}`,
        courseId: course.id,
      });
    if (!related.length)
      actions.push({
        id: stableId("faculty", `${course.id}:assignment`),
        priority: "important",
        title: `أنشئ أول تكليف في ${course.code}`,
        detail: "المقرر لا يملك تكليفًا يمكن للطالب الارتباط به أو تسليمه.",
        path: `/app/course/${course.id}`,
        courseId: course.id,
      });
  }
  for (const item of assignments) {
    const weight = item.rubric.reduce(
      (sum, row) => sum + Number(row.weighting || 0),
      0,
    );
    const problems = [
      !item.deadline && "الموعد",
      !item.deliverables.length && "المخرجات",
      (!item.rubric.length || Math.abs(weight - 100) > 0.01) && "Rubric",
      !item.outcomes.length && "Outcomes",
      item.aiPolicy.needsConfirmation && "سياسة AI",
    ].filter(Boolean);
    if (problems.length)
      actions.push({
        id: stableId("faculty", `${item.id}:quality`),
        priority: item.status === "published" ? "critical" : "important",
        title: `أكمل ${item.title}`,
        detail: `ينقص التكليف: ${problems.join("، ")}.`,
        path: `/app/course/${item.courseId}`,
        courseId: item.courseId,
        assignmentId: item.id,
      });
  }
  const total = Math.max(1, assignments.length);
  return {
    generatedAt: nowIso(),
    courses: courses.length,
    assignments: assignments.length,
    publishedAssignments: assignments.filter((x) => x.status === "published")
      .length,
    actions: actions
      .sort(
        (a, b) =>
          ({ critical: 0, important: 1, normal: 2 })[a.priority] -
          { critical: 0, important: 1, normal: 2 }[b.priority],
      )
      .slice(0, 20),
    health: {
      outcomesMapped: pct(
        assignments.filter((x) => x.outcomes.length > 0).length,
        total,
      ),
      rubricReady: pct(
        assignments.filter(
          (x) =>
            x.rubric.length > 0 &&
            Math.abs(x.rubric.reduce((s, r) => s + r.weighting, 0) - 100) <
              0.01,
        ).length,
        total,
      ),
      deadlinesPresent: pct(
        assignments.filter((x) => Boolean(x.deadline)).length,
        total,
      ),
      policyConfirmed: pct(
        assignments.filter((x) => !x.aiPolicy.needsConfirmation).length,
        total,
      ),
    },
  };
}

export function normalizeRubricGrades(
  assignment: CourseAssignmentRecord,
  input: unknown,
) {
  if (!assignment.rubric.length)
    throw Object.assign(
      new Error(
        "A published rubric is required before this submission can be graded",
      ),
      { status: 409, code: "RUBRIC_REQUIRED" },
    );
  const rows = Array.isArray(input) ? input : [],
    byId = new Map<string, any>();
  for (const row of rows) {
    const id = String(row?.rubricId || "");
    if (!id || byId.has(id))
      throw Object.assign(
        new Error("Each rubric criterion must appear exactly once"),
        { status: 400, code: "RUBRIC_GRADE_INVALID" },
      );
    byId.set(id, row);
  }
  const rubricGrades = assignment.rubric.map((criterion) => {
    const row = byId.get(criterion.id);
    if (!row)
      throw Object.assign(
        new Error(`Missing grade for rubric criterion: ${criterion.title}`),
        { status: 400, code: "RUBRIC_GRADE_INCOMPLETE" },
      );
    const awardedPoints = Number(row.awardedPoints),
      maxPoints = Number(criterion.weighting);
    if (
      !Number.isFinite(awardedPoints) ||
      awardedPoints < 0 ||
      awardedPoints > maxPoints
    )
      throw Object.assign(
        new Error(
          `Grade for ${criterion.title} must be between 0 and ${maxPoints}`,
        ),
        { status: 400, code: "RUBRIC_GRADE_RANGE" },
      );
    const feedback = String(row.feedback || "")
      .trim()
      .slice(0, 3000);
    return {
      rubricId: criterion.id,
      title: criterion.title,
      maxPoints,
      awardedPoints: Number(awardedPoints.toFixed(2)),
      ...(feedback ? { feedback } : {}),
    };
  });
  if (byId.size !== assignment.rubric.length)
    throw Object.assign(
      new Error(
        "The grade contains a criterion that is not in the published rubric",
      ),
      { status: 400, code: "RUBRIC_GRADE_UNKNOWN" },
    );
  const totalScore = Number(
      rubricGrades.reduce((sum, row) => sum + row.awardedPoints, 0).toFixed(2),
    ),
    maxScore = Number(
      rubricGrades.reduce((sum, row) => sum + row.maxPoints, 0).toFixed(2),
    );
  return { rubricGrades, totalScore, maxScore };
}

export function buildInstitutionCommandCenter(input: {
  control: ControlPlaneData;
  courses: CourseRecord[];
  assignments: CourseAssignmentRecord[];
  submissions: CourseSubmissionRecord[];
  serviceState: Record<string, boolean>;
}): InstitutionCommandCenter {
  const { control, courses, assignments, submissions, serviceState } = input;
  const decisions: InstitutionCommandCenter["decisions"] = [];
  const risky = control.projects.filter((x) => x.riskCount > 0).length;
  const due = control.metrics.dueSoon;
  const gradingBacklog = submissions.filter((x) =>
    ["submitted", "grading", "graded"].includes(x.status),
  ).length;
  if (due)
    decisions.push({
      id: "decision_due",
      priority: due > 10 ? "critical" : "important",
      title: "ضغط تسليم قريب",
      detail: `${due} مشروعًا لها موعد خلال سبعة أيام.`,
      metric: String(due),
      recommendation: "راجع توزيع المواعيد والدعم المتاح قبل حدوث موجة تأخير.",
    });
  if (risky)
    decisions.push({
      id: "decision_risk",
      priority:
        risky > control.projects.length * 0.3 ? "critical" : "important",
      title: "مخاطر أكاديمية متكررة",
      detail: `${risky} مشروعًا تحمل إشارات نقص أو سياسة غير مؤكدة.`,
      metric: `${pct(risky, control.projects.length)}%`,
      recommendation:
        "فعّل Playbook موحدًا لتأكيد المتطلبات والسياسة من مصدر المقرر.",
    });
  if (gradingBacklog)
    decisions.push({
      id: "decision_grading",
      priority: gradingBacklog > 50 ? "critical" : "important",
      title: "تراكم في التقييم",
      detail: `${gradingBacklog} تسليمًا لم تُنشر درجته بعد.`,
      metric: String(gradingBacklog),
      recommendation: "وزّع قائمة التصحيح حسب المقرر والأقدمية مع SLA واضح.",
    });
  if (control.metrics.openIncidents)
    decisions.push({
      id: "decision_incident",
      priority: "critical",
      title: "حادث خدمة مفتوح",
      detail: `${control.metrics.openIncidents} حوادث ما زالت مفتوحة.`,
      metric: String(control.metrics.openIncidents),
      recommendation: "افتح غرفة الحادث واعرض أثره للمستخدمين بدل الصمت.",
    });
  const actionCounts = new Map<string, number>();
  for (const item of control.audit) {
    const key = item.action.split(".").slice(0, 2).join(".");
    actionCounts.set(key, (actionCounts.get(key) || 0) + 1);
  }
  const memory = [...actionCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([pattern, occurrences]) => ({
      pattern,
      occurrences,
      affectedProjects: new Set(
        control.audit
          .filter((x) => x.action.startsWith(pattern))
          .map((x) => x.target),
      ).size,
      suggestedPlaybook: pattern.startsWith("submission")
        ? "راجع أسباب التحذير الشائعة قبل فتح نافذة التسليم التالية."
        : pattern.startsWith("support")
          ? "حوّل الحل المتكرر إلى مقالة مساعدة وإجراء آلي آمن."
          : "حوّل الخطوات المتكررة إلى Workflow مدقق قابل لإعادة الاستخدام.",
    }));
  const outcomes = new Set(
    courses.flatMap((c) => c.outcomes.map((x) => x.trim())).filter(Boolean),
  );
  const linked = new Set(
    assignments.flatMap((a) => a.outcomes.map((x) => x.trim())).filter(Boolean),
  );
  const operations = Object.entries({
    authentication: serviceState.authentication,
    database: serviceState.database,
    storage: serviceState.storage,
    ai: serviceState.ai,
    ocr: serviceState.ocr,
    malware: serviceState.malware,
    notifications: serviceState.notifications,
    backup: serviceState.backup,
    billing: serviceState.billing,
  }).map(([key, ready]) => ({
    key,
    label: (
      {
        authentication: "المصادقة",
        database: "قاعدة البيانات",
        storage: "الملفات",
        ai: "بوابة AI",
        ocr: "OCR",
        malware: "فحص البرمجيات الضارة",
        notifications: "الإشعارات الخارجية",
        backup: "النسخ والاستعادة",
        billing: "الدفع",
      } as Record<string, string>
    )[key],
    state: ready
      ? ("ready" as const)
      : ["billing"].includes(key)
        ? ("attention" as const)
        : ("blocked" as const),
    detail: ready ? "مهيأ على الخادم" : "يحتاج مزودًا واعتمادات إنتاجية",
  }));
  const blocked = operations.filter((x) => x.state === "blocked").length;
  const posture =
    control.metrics.openIncidents || blocked >= 4
      ? "critical"
      : decisions.some((x) => x.priority === "critical") || blocked
        ? "attention"
        : "healthy";
  return {
    generatedAt: nowIso(),
    posture,
    decisions,
    memory,
    twin: {
      projects: control.projects.length,
      courses: courses.length,
      assignments: assignments.length,
      outcomes: outcomes.size,
      outcomeCoverage: pct(
        [...outcomes].filter((x) => linked.has(x)).length,
        outcomes.size,
      ),
      submissions: submissions.length,
      graded: submissions.filter((x) =>
        ["graded", "released"].includes(x.status),
      ).length,
      released: submissions.filter((x) => x.status === "released").length,
    },
    operations,
  };
}

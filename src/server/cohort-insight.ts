// "Where is the cohort stuck?" — an anonymised, aggregate view for instructors.
//
// Built only from the Project DNA of students working on one published
// assignment (project.aiPolicy.assignmentId). No student ids, names or
// per-student rows leave this module; nothing is reported until the cohort
// reaches the k-anonymity threshold, and individual buckets smaller than the
// threshold are folded away so a single student cannot be singled out.
//
// Pure: no I/O.

import type { ProjectDNA } from "../types";
import { K_ANONYMITY_MIN } from "./advanced/_shared";

export interface CohortStuckPoint {
  kind: "rubric" | "requirement" | "task" | "deliverable";
  label: string;
  /** Share of the cohort affected, 0-100. */
  percent: number;
  detail: "not_evidenced" | "needs_revision" | "needs_confirmation" | "blocked" | "not_started" | "pending";
}

export interface CohortInsight {
  available: boolean;
  cohortSize: number;
  kAnonymityMin: number;
  averageProgress?: number;
  stageDistribution?: Record<"not_started" | "in_progress" | "blocked" | "completed", number>;
  stuckPoints: CohortStuckPoint[];
  generatedAt: string;
}

const norm = (value: string) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

export function buildCohortInsight(projects: ProjectDNA[], now = new Date(), k = K_ANONYMITY_MIN): CohortInsight {
  // One project per student: the most recently updated.
  const byStudent = new Map<string, ProjectDNA>();
  for (const project of projects) {
    const current = byStudent.get(project.userId);
    if (!current || String(project.updatedAt) > String(current.updatedAt)) byStudent.set(project.userId, project);
  }
  const cohort = [...byStudent.values()];
  const base = { cohortSize: cohort.length, kAnonymityMin: k, generatedAt: now.toISOString() };
  if (cohort.length < k) return { ...base, available: false, stuckPoints: [] };

  const buckets = new Map<string, { kind: CohortStuckPoint["kind"]; label: string; detail: CohortStuckPoint["detail"]; students: Set<string> }>();
  const hit = (kind: CohortStuckPoint["kind"], label: string, detail: CohortStuckPoint["detail"], studentId: string) => {
    const clean = String(label || "").trim().slice(0, 160);
    if (!clean) return;
    const key = `${kind}|${detail}|${norm(clean)}`;
    const bucket = buckets.get(key) || { kind, label: clean, detail, students: new Set<string>() };
    bucket.students.add(studentId);
    buckets.set(key, bucket);
  };

  const stages = { not_started: 0, in_progress: 0, blocked: 0, completed: 0 };
  let progressSum = 0;
  for (const project of cohort) {
    const student = project.userId;
    progressSum += Number(project.progress) || 0;
    if (project.status === "completed") stages.completed += 1;
    else if (project.status === "blocked") stages.blocked += 1;
    else if ((Number(project.progress) || 0) === 0) stages.not_started += 1;
    else stages.in_progress += 1;
    for (const criterion of project.rubric || []) {
      if (criterion.readiness === "needs_revision") hit("rubric", criterion.title, "needs_revision", student);
      else if (!criterion.readiness || criterion.readiness === "not_evidenced") hit("rubric", criterion.title, "not_evidenced", student);
    }
    for (const requirement of project.requirements || []) {
      if (requirement.confidence === "needs_confirmation") hit("requirement", requirement.label, "needs_confirmation", student);
    }
    for (const task of project.tasks || []) {
      if (task.status === "blocked") hit("task", task.title, "blocked", student);
    }
    for (const deliverable of project.deliverables || []) {
      if (deliverable.status === "pending") hit("deliverable", deliverable.title, "pending", student);
    }
  }

  const stuckPoints = [...buckets.values()]
    .filter((bucket) => bucket.students.size >= k)
    .map((bucket) => ({
      kind: bucket.kind,
      label: bucket.label,
      detail: bucket.detail,
      percent: Math.round((bucket.students.size / cohort.length) * 100),
    }))
    .sort((a, b) => b.percent - a.percent || a.label.localeCompare(b.label))
    .slice(0, 12);

  // Stage counts below k are reported as 0-bucket merges to avoid singling out.
  const safeStages = Object.fromEntries(
    Object.entries(stages).map(([key, value]) => [key, value > 0 && value < k ? 0 : value]),
  ) as CohortInsight["stageDistribution"];

  return {
    ...base,
    available: true,
    averageProgress: Math.round(progressSum / cohort.length),
    stageDistribution: safeStages,
    stuckPoints,
  };
}

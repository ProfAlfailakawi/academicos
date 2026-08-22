import type { PlatformRecord, ProjectAccess, ProjectPlanId } from "../types";

export type PaidProjectPlanId = Exclude<ProjectPlanId, "preview">;

const PLAN_RANK: Record<ProjectPlanId, number> = {
  preview: 0,
  project: 1,
  project_viva: 2,
  group: 3,
};

export const PREVIEW_PAGE_LIMIT = 3;

export function isPaidProjectPlan(value: unknown): value is PaidProjectPlanId {
  return value === "project" || value === "project_viva" || value === "group";
}

export function projectPlanAllows(
  planId: ProjectPlanId | undefined,
  feature: "full_writer" | "export" | "viva" | "collaboration",
) {
  if (!planId || planId === "preview") return false;
  if (feature === "viva") return planId === "project_viva" || planId === "group";
  if (feature === "collaboration") return planId === "group";
  return true;
}

export function projectAccessFromEntitlements(
  records: PlatformRecord[],
  projectId: string,
): ProjectAccess {
  const active = records
    .filter(
      (record) =>
        record.resource === "entitlements" &&
        record.status === "active" &&
        !record.deletedAt &&
        String(record.data?.projectId || "") === projectId &&
        isPaidProjectPlan(record.data?.planId),
    )
    .sort(
      (a, b) =>
        PLAN_RANK[b.data.planId as ProjectPlanId] -
          PLAN_RANK[a.data.planId as ProjectPlanId] ||
        b.updatedAt.localeCompare(a.updatedAt),
    )[0];

  const planId = active?.data.planId as PaidProjectPlanId | undefined;
  if (!active || !planId) {
    return {
      tier: "preview",
      status: "preview",
      unlocked: false,
      canWriteFull: false,
      canExport: false,
      canViva: false,
      canCollaborate: false,
    };
  }
  return {
    tier: "paid",
    status: "active",
    planId,
    entitlementId: active.id,
    unlocked: true,
    canWriteFull: true,
    canExport: true,
    canViva: projectPlanAllows(planId, "viva"),
    canCollaborate: projectPlanAllows(planId, "collaboration"),
  };
}

export function decideProjectGeneration(
  access: ProjectAccess,
  existingAccessTier?: "preview" | "paid",
) {
  if (access.unlocked) return { allowed: true as const, preview: false as const };
  if (existingAccessTier)
    return {
      allowed: false as const,
      preview: true as const,
      code: "PROJECT_PAYMENT_REQUIRED" as const,
    };
  return { allowed: true as const, preview: true as const };
}

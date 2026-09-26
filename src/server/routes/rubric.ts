// Rubric drill-down routes: criterion → workspace items / evidence / gaps, and
// the "what's missing" task that feeds the project's Next Best Action.
import type { Express } from "express";
import { firestoreStore } from "../db";
import { recalculateProject } from "../project-engine";
import { buildGradeLossMap } from "../advanced/grade-loss-map";
import { applyGapTask, buildGapTask, buildRubricDrilldown, gapText, type CohortLossInput } from "../rubric-drilldown";
import type { ProjectDNA } from "../../types";
import type { AuthenticatedRequest, RouteDeps } from "./types";

async function cohortLoss(project: ProjectDNA, tenantId: string, locale: any): Promise<CohortLossInput[]> {
  const assignmentId = project.aiPolicy?.assignmentId;
  if (!assignmentId) return [];
  try {
    const submissions = (await firestoreStore.listTenantSubmissions(tenantId, 1000)).filter(
      (item) => item.assignmentId === assignmentId,
    );
    const map = buildGradeLossMap(submissions, project.rubric || [], locale);
    // k-anonymity is enforced inside buildGradeLossMap (no criteria when too small).
    return map.available
      ? map.criteria
          .filter((c) => c.severity !== "insufficient")
          .map((c) => ({ rubricId: c.rubricId, title: c.title, lossProbability: c.lossProbability, severity: c.severity }))
      : [];
  } catch {
    return [];
  }
}

export function registerRubricRoutes(app: Express, deps: RouteDeps) {
  const { authenticate, reqLocale, cleanField } = deps;

  async function load(req: AuthenticatedRequest) {
    const a = req.actor!;
    const project = await firestoreStore.getProject(req.params.id, a.userId, a.tenantId);
    if (!project) return null;
    const [artifacts, evidence] = await Promise.all([
      firestoreStore.listWorkspaceArtifacts(project.id, a.tenantId),
      firestoreStore.listProjectEvidence(project.id, a.userId, a.tenantId),
    ]);
    const locale = reqLocale(req);
    const cohort = await cohortLoss(project, a.tenantId, locale);
    return { project, drilldown: buildRubricDrilldown(project, artifacts, evidence, cohort), locale };
  }

  app.get(
    "/api/projects/:id/rubric-drilldown",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const data = await load(req);
        if (!data) return res.status(404).json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        res.json({
          success: true,
          drilldown: {
            ...data.drilldown,
            criteria: data.drilldown.criteria.map((c) => ({
              ...c,
              missingText: c.missing.map((code) => gapText(code, data.locale)),
            })),
          },
        });
      } catch (e) {
        next(e);
      }
    },
  );

  app.post(
    "/api/projects/:id/rubric/:criterionId/gap-task",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const data = await load(req);
        if (!data) return res.status(404).json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const criterionId = cleanField(req.params.criterionId, 180);
        const criterion = data.drilldown.criteria.find((c) => c.rubricId === criterionId);
        if (!criterion)
          return res.status(404).json({ error: "Rubric criterion not found", code: "RUBRIC_NOT_FOUND" });
        const existing = data.project.tasks.find((task) => task.id === criterion.gapTaskId);
        const task = buildGapTask(criterion, data.locale, existing);
        const updated = recalculateProject(applyGapTask(data.project, task));
        const persisted = await firestoreStore.updateProject(updated, a.userId, `Rubric gap task: ${criterion.title}`.slice(0, 200));
        await firestoreStore.writeAudit(a.tenantId, a.userId, "rubric.gap_task", data.project.id, undefined, {
          criterionId,
          missing: criterion.missing,
        });
        res.json({ success: true, project: persisted || updated, task });
      } catch (e) {
        next(e);
      }
    },
  );
}

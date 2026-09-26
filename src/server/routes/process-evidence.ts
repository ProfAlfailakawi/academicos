// Process Evidence routes: signed authorship timeline + public verification.
import { routeRateLimit } from "./route-rate-limit";
import type { Express } from "express";
import { firestoreStore } from "../db";
import { buildTimeMachine } from "../intelligence";
import {
  buildProcessEvidencePayload,
  processEvidenceSecret,
  signProcessEvidence,
  verifyProcessEvidence,
} from "../process-evidence";
import type { AuthenticatedRequest, RouteDeps } from "./types";

export function registerProcessEvidenceRoutes(
  app: Express,
  deps: RouteDeps & {
    loadProjectIntelligence: (actor: any, projectId: string) => Promise<any | null>;
  },
) {
  const { authenticate, loadProjectIntelligence, reqLocale } = deps;

  app.get(
    "/api/projects/:id/process-evidence",
    routeRateLimit,
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const data = await loadProjectIntelligence(a, req.params.id);
        if (!data)
          return res.status(404).json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const timeMachine = buildTimeMachine(
          data.project,
          data.activity,
          data.versions,
          data.artifacts,
          data.evidence,
          data.learning,
          data.aiRuns,
          reqLocale(req),
        );
        // Draft history: every saved version of the most recent artifacts.
        const recentArtifacts = [...data.artifacts]
          .filter((item: any) => !item.deletedAt)
          .sort((x: any, y: any) => String(y.updatedAt).localeCompare(String(x.updatedAt)))
          .slice(0, 15);
        const versionLists = await Promise.all(
          recentArtifacts.map((item: any) =>
            firestoreStore
              .listWorkspaceArtifactVersions(item.id, data.project.id, a.tenantId)
              .catch(() => []),
          ),
        );
        const payload = buildProcessEvidencePayload({
          project: data.project,
          timeMachine,
          evidence: data.evidence,
          artifactVersions: versionLists.flat(),
        });
        const report = signProcessEvidence(payload, processEvidenceSecret());
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "process_evidence.generate",
          data.project.id,
          undefined,
          { contentHash: report.integrity.contentHash, entries: report.summary.totalEntries },
        );
        res.setHeader("Cache-Control", "private, no-store");
        res.json({ success: true, report });
      } catch (e) {
        next(e);
      }
    },
  );

  app.post("/api/public/process-evidence/verify", routeRateLimit, async (req, res, next) => {
    try {
      const body = req.body || {};
      if (JSON.stringify(body).length > 600000)
        return res.status(413).json({ error: "Report is too large", code: "PROCESS_EVIDENCE_TOO_LARGE" });
      const report = body.report && typeof body.report === "object" ? body.report : undefined;
      const contentHash = typeof body.contentHash === "string" ? body.contentHash.trim() : undefined;
      const signature = typeof body.signature === "string" ? body.signature.trim() : undefined;
      if (!report && !(contentHash && signature))
        return res.status(400).json({
          error: "A report, or a content hash and signature, is required",
          code: "PROCESS_EVIDENCE_REQUIRED",
        });
      res.json({
        success: true,
        verification: verifyProcessEvidence({ report, contentHash, signature }, processEvidenceSecret()),
      });
    } catch (e) {
      next(e);
    }
  });
}

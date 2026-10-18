// Teacher-account requests: sign up as a student, ask for a teacher account,
// platform owners approve or reject. See ../teacher-requests.ts for the rules.
import type { Express, NextFunction, Response } from "express";
import { getAuth } from "firebase-admin/auth";
import { getAppFirestore } from "../firebase-services";
import { firestoreStore } from "../db";
import { createNotification, sendConfiguredEmail } from "../notifications";
import { SRV } from "../server-messages";
import { resolveServerLocale, tx, txf } from "../server-locale";
import {
  TEACHER_REQUEST_REVIEWER_ROLES,
  TeacherRequestError,
  decideTeacherRequest,
  firestoreTeacherRequestStore,
  submitTeacherRequest,
  type TeacherRequestStatus,
} from "../teacher-requests";
import type { UserRole } from "../../types";
import type { AuthenticatedRequest, RouteDeps } from "./types";

type Extra = {
  requireRoles: (...roles: UserRole[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;
  requireRecentPrivilegedAuth: (req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown;
};

export function registerTeacherRequestRoutes(app: Express, deps: RouteDeps & Extra) {
  const { authenticate, apiRateLimit, requireRoles, requireRecentPrivilegedAuth } = deps;
  const store = () => firestoreTeacherRequestStore(getAppFirestore());
  const fail = (res: Response, e: unknown, next: NextFunction) =>
    e instanceof TeacherRequestError
      ? res.status(e.status).json({ error: e.message, code: e.code })
      : next(e);

  // The requester's own request (if any).
  app.get("/api/teacher-requests/mine", authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
      const request = await store().get(req.actor!.userId);
      res.json({ success: true, request });
    } catch (e) {
      next(e);
    }
  });

  // Create / update the caller's pending request. The role is never read from the body.
  app.post("/api/teacher-requests", authenticate, apiRateLimit, async (req: AuthenticatedRequest, res, next) => {
    try {
      const a = req.actor!;
      const { created, request } = await submitTeacherRequest({ store: store(), actor: a, body: req.body });
      await firestoreStore.writeAudit(a.tenantId, a.userId, "teacher_request.submit", a.userId, undefined, {
        institution: request.institution,
        attempts: request.attempts,
      });
      res.status(created ? 201 : 200).json({ success: true, request });
    } catch (e) {
      fail(res, e, next);
    }
  });

  const reviewers = requireRoles(...(TEACHER_REQUEST_REVIEWER_ROLES as UserRole[]));

  app.get("/api/admin/teacher-requests", authenticate, reviewers, async (req: AuthenticatedRequest, res, next) => {
    try {
      const raw = String(req.query.status || "pending");
      const status = ["pending", "approved", "rejected"].includes(raw) ? (raw as TeacherRequestStatus) : undefined;
      const requests = await store().list(status, 300);
      res.json({ success: true, requests });
    } catch (e) {
      next(e);
    }
  });

  app.post(
    "/api/admin/teacher-requests/:id/decision",
    authenticate,
    reviewers,
    requireRecentPrivilegedAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const targetUserId = String(req.params.id || "");
        const { request, role } = await decideTeacherRequest({
          store: store(),
          auth: getAuth(),
          reviewer: { userId: a.userId, role: a.role },
          targetUserId,
          decision: req.body?.decision,
          reason: req.body?.reason,
        });
        const approved = request.status === "approved";
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          approved ? "teacher_request.approve" : "teacher_request.reject",
          targetUserId,
          request.reason,
          { targetTenantId: request.tenantId, institution: request.institution, grantedRole: approved ? role : undefined },
        );
        // Notify the applicant in their own language; delivery problems never undo the decision.
        try {
          const profile = await getAppFirestore().collection("profiles").doc(targetUserId).get();
          const locale = resolveServerLocale(profile.exists ? (profile.data() as any)?.language : undefined, "ar");
          const title = tx(approved ? SRV.teacherApprovedTitle : SRV.teacherRejectedTitle, locale);
          const body = approved
            ? tx(SRV.teacherApprovedBody, locale)
            : txf(SRV.teacherRejectedBody, locale, { reason: request.reason || "" });
          await createNotification({
            tenantId: request.tenantId,
            userId: targetUserId,
            type: "system",
            priority: "important",
            title,
            body,
            targetPath: "/app/settings",
            channels: ["in_app"],
          });
          if (request.email)
            await sendConfiguredEmail({ to: request.email, subject: title, text: body, tenantId: request.tenantId });
        } catch (notifyError) {
          console.error(
            JSON.stringify({ severity: "WARNING", event: "teacher_request_notify_failed", message: String((notifyError as any)?.message || notifyError).slice(0, 200) }),
          );
        }
        res.json({ success: true, request });
      } catch (e) {
        fail(res, e, next);
      }
    },
  );
}

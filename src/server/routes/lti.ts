// LTI 1.3 routes. Mounted before the App Check gate: the platform (Moodle,
// Canvas...) calls login/launch/jwks directly from the learner's browser or
// its own servers. Everything is inert until the LTI_* environment is set.
import { routeRateLimit } from "./route-rate-limit";
import express, { type Express } from "express";
import { firestoreStore } from "../db";
import { resolveVariationSecret } from "../variation-secret";
import {
  buildLoginRedirect,
  fetchJwks,
  LtiError,
  ltiConfig,
  postAgsScore,
  requestAgsToken,
  toolJwks,
  toolPrivateKey,
  verifyLtiIdToken,
  verifyLtiState,
} from "../lti";
import type { AuthenticatedRequest, RouteDeps } from "./types";

const stateSecret = () => String(process.env.LTI_STATE_SECRET || "").trim() || resolveVariationSecret("lti-state");
const appUrl = () => String(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

function ltiFail(res: express.Response, error: unknown) {
  const e = error as LtiError;
  res.status(e?.status || 400).json({ error: e?.message || "LTI request failed", code: e?.code || "LTI_ERROR" });
}

export function registerLtiRoutes(app: Express, deps: RouteDeps & { adminRoles: string[] }) {
  const { apiRateLimit, authenticate } = deps;
  const form = express.urlencoded({ extended: false, limit: "64kb" });
  const admins = new Set(deps.adminRoles);

  const login = (req: express.Request, res: express.Response) => {
    try {
      const params = { ...(req.query || {}), ...(req.body || {}) } as Record<string, unknown>;
      const { url } = buildLoginRedirect(ltiConfig(), params, stateSecret(), `${appUrl()}/api/lti/launch`);
      res.redirect(302, url);
    } catch (error) {
      ltiFail(res, error);
    }
  };
  app.get("/api/lti/login", routeRateLimit, apiRateLimit, login);
  app.post("/api/lti/login", routeRateLimit, apiRateLimit, form, login);

  app.post("/api/lti/launch", routeRateLimit, apiRateLimit, form, async (req, res) => {
    try {
      const config = ltiConfig();
      if (!config.configured) throw new LtiError("LTI is not configured", "LTI_NOT_CONFIGURED", 503);
      const { nonce } = verifyLtiState(stateSecret(), String(req.body?.state || ""));
      const jwks = await fetchJwks(config.jwksUrl);
      const launch = verifyLtiIdToken(String(req.body?.id_token || ""), config, jwks, { nonce });
      if (config.tenantId)
        await firestoreStore
          .writeAudit(config.tenantId, `lti:${launch.subject}`, "lti.launch", launch.resourceLink?.id || launch.context?.id || "lti", undefined, {
            deploymentId: launch.deploymentId,
            contextId: launch.context?.id || null,
            messageType: launch.messageType,
            roles: launch.roles.slice(0, 10),
            lineitem: launch.ags?.lineitem || null,
          })
          .catch(() => undefined);
      // Account linking and course mapping require institution setup; the
      // validated launch lands on the Integrations Center with its context.
      const target = new URL(`${appUrl()}/app/integrations`);
      target.searchParams.set("lti", "validated");
      if (launch.context?.title) target.searchParams.set("context", String(launch.context.title).slice(0, 120));
      res.redirect(303, target.toString());
    } catch (error) {
      ltiFail(res, error);
    }
  });

  app.get("/api/lti/jwks", routeRateLimit, apiRateLimit, (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(toolJwks());
  });

  app.get("/api/lti/config", routeRateLimit, authenticate, (req: AuthenticatedRequest, res) => {
    if (!admins.has(req.actor!.role)) return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
    const config = ltiConfig();
    res.json({
      success: true,
      lti: {
        configured: config.configured,
        missing: config.missing,
        issuer: config.issuer,
        clientId: config.clientId,
        deploymentIds: config.deploymentIds,
        jwksUrl: config.jwksUrl,
        authLoginUrl: config.authLoginUrl,
        tokenUrl: config.tokenUrl,
        agsEnabled: config.agsEnabled,
        tool: {
          loginUrl: `${appUrl()}/api/lti/login`,
          launchUrl: `${appUrl()}/api/lti/launch`,
          jwksUrl: `${appUrl()}/api/lti/jwks`,
        },
      },
    });
  });

  app.post("/api/lti/ags/score", routeRateLimit, authenticate, express.json({ limit: "32kb" }), async (req: AuthenticatedRequest, res) => {
    try {
      if (!admins.has(req.actor!.role)) return res.status(403).json({ error: "Forbidden", code: "FORBIDDEN" });
      const config = ltiConfig();
      const key = toolPrivateKey();
      if (!config.configured || !config.agsEnabled || !key)
        throw new LtiError("LTI grade passback is not configured", "LTI_AGS_NOT_CONFIGURED", 503);
      const lineitem = String(req.body?.lineitem || "");
      const lineitemUrl = new URL(lineitem);
      const platform = new URL(config.issuer);
      if (lineitemUrl.protocol !== "https:" || lineitemUrl.hostname !== platform.hostname)
        throw new LtiError("Line item must belong to the configured platform", "LTI_AGS_LINEITEM", 400);
      // Rebuild the target on the configured platform's origin so the host
      // never comes from the request body (SSRF guard); only the path is kept.
      const safeLineitem = new URL(`${lineitemUrl.pathname}${lineitemUrl.search}`, platform.origin).toString();
      const token = await requestAgsToken(config, key);
      const result = await postAgsScore(safeLineitem, token, {
        userId: String(req.body?.userId || ""),
        scoreGiven: Number(req.body?.scoreGiven),
        scoreMaximum: Number(req.body?.scoreMaximum),
        comment: req.body?.comment ? String(req.body.comment).slice(0, 2000) : undefined,
      });
      await firestoreStore.writeAudit(req.actor!.tenantId, req.actor!.userId, "lti.ags.score", lineitem.slice(0, 300), undefined, {
        ltiUser: String(req.body?.userId || "").slice(0, 120),
      });
      res.json({ success: true, ...result });
    } catch (error) {
      if (error instanceof TypeError) return res.status(400).json({ error: "Invalid line item URL", code: "LTI_AGS_LINEITEM" });
      ltiFail(res, error);
    }
  });
}

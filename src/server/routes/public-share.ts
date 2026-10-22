// Public share links: GET /api/public/share/:token and the password-retry POST.
// Moved out of server.ts so the failure handling can be tested in isolation;
// a valid token returns exactly what it returned before.
import type { Express } from "express";

type ShareDeps = {
  resolvePublicShare: (token: string, password?: string) => Promise<any>;
  cleanField: (value: unknown, max?: number) => string;
};

// Tokens are `share_` + 32 base64url characters (platform-store createPublicShare).
// Anything that cannot be one is answered like any unknown link, without touching
// the database. The bounds are deliberately loose so this never rejects a real token.
const TOKEN_SHAPE = /^share_[A-Za-z0-9_-]{16,128}$/;

const notFound = (res: any) =>
  res.status(404).json({
    error: "Share link is invalid, expired or revoked",
    code: "SHARE_NOT_FOUND",
  });

export function registerPublicShareRoutes(app: Express, deps: ShareDeps) {
  const { resolvePublicShare, cleanField } = deps;

  async function respond(req: any, res: any, password?: string) {
    const token = String(req.params.token);
    if (!TOKEN_SHAPE.test(token)) return notFound(res);
    let share: any;
    try {
      share = await resolvePublicShare(token, password);
    } catch (e) {
      // Backend failure (credentials, Firestore outage). Never log the token.
      console.error(
        JSON.stringify({
          severity: "ERROR",
          event: "public_share_backend_failed",
          code: String((e as any)?.code || "").slice(0, 60),
          message: String((e as any)?.message || e).slice(0, 200),
        }),
      );
      return res.status(503).json({
        error: "Share links are temporarily unavailable. Try again shortly.",
        code: "SHARE_UNAVAILABLE",
      });
    }
    if (!share) return notFound(res);
    if (share.passwordRequired)
      return res.status(share.passwordInvalid ? 403 : 401).json({
        error: share.passwordInvalid ? "Incorrect share password" : "Password required",
        code: share.passwordInvalid ? "SHARE_PASSWORD_INVALID" : "SHARE_PASSWORD_REQUIRED",
      });
    res.setHeader("Cache-Control", "private, no-store");
    return res.json({
      success: true,
      share: {
        kind: share.kind,
        label: share.label,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
        watermark: share.watermark,
        viewCount: share.viewCount,
        snapshot: share.snapshot || {},
      },
    });
  }

  app.get("/api/public/share/:token", async (req, res, next) => {
    try {
      await respond(req, res);
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/public/share/:token/access", async (req, res, next) => {
    try {
      await respond(req, res, cleanField(req.body?.password, 120));
    } catch (e) {
      next(e);
    }
  });
}

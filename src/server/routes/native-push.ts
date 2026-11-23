// تنبيهات تطبيق iOS: تسجيل توكن الجهاز وإلغاؤه وحالته لصاحب الجلسة.
// الحفظ والإرسال في ../native-push؛ هنا المسارات وحدها.
import type { Express } from "express";
import { deviceId, devicesFor, isValidDeviceToken, nativePushConfigured, removeDevice, saveDevice } from "../native-push";
import type { AuthenticatedRequest, RouteDeps } from "./types";

export function registerNativePushRoutes(app: Express, deps: Pick<RouteDeps, "authenticate">) {
  const { authenticate } = deps;

  app.get("/api/push/status", authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
      const a = req.actor!;
      const ids = (await devicesFor(a.tenantId, a.userId)).map(deviceId);
      res.json({ success: true, configured: nativePushConfigured(), ids });
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/push/subscribe-native", authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
      const a = req.actor!;
      const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
      if (!isValidDeviceToken(token)) return res.status(400).json({ error: "Invalid device token", code: "INVALID_DEVICE_TOKEN" });
      res.json({ success: true, id: await saveDevice(a.tenantId, a.userId, token) });
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/push/unsubscribe-native", authenticate, async (req: AuthenticatedRequest, res, next) => {
    try {
      const a = req.actor!;
      const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
      if (!isValidDeviceToken(token)) return res.status(400).json({ error: "Invalid device token", code: "INVALID_DEVICE_TOKEN" });
      res.json({ success: true, removed: await removeDevice(token, { tenantId: a.tenantId, userId: a.userId }) });
    } catch (e) {
      next(e);
    }
  });
}

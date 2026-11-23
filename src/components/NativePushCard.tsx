import React, { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { Card, CardContent } from "./ui/card";
import {
  isNativePushAvailable,
  nativePushSubscriptionId,
  readNativePushPermission,
  registerNativePushToken,
  requestNativePushPermission,
} from "../lib/native-push";

/*
 * «فعّل التنبيهات» — داخل تطبيق iOS وحده.
 * لمسةٌ واحدة تطلب إذن النظام (نافذة iOS نفسها)، ثم تسجّل الجهاز وتحفظ توكنه
 * عند الخادم وتفعّل قناة «إشعارات فورية». في المتصفح لا يُرسم شيء.
 */
type Phase = "loading" | "off" | "on" | "blocked" | "busy";

export function NativePushCard({ onEnabled }: { onEnabled?: () => void }) {
  const { t } = useI18n();
  const available = isNativePushAvailable();
  const [phase, setPhase] = useState<Phase>("loading");
  const [token, setToken] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!available) return;
    let alive = true;
    (async () => {
      const permission = await readNativePushPermission();
      if (!alive) return;
      if (permission === "denied") return setPhase("blocked");
      if (permission !== "granted") return setPhase("off");
      const current = await registerNativePushToken();
      const status = await api.nativePushStatus().catch(() => ({ ids: [] as string[] }));
      if (!alive) return;
      const id = current ? await nativePushSubscriptionId(current) : "";
      setToken(current);
      setPhase(id && status.ids.includes(id) ? "on" : "off");
    })();
    return () => {
      alive = false;
    };
  }, [available]);

  if (!available) return null;

  async function enable() {
    setPhase("busy");
    setFailed(false);
    const permission = await requestNativePushPermission();
    if (permission === "denied") return setPhase("blocked");
    if (permission !== "granted") return setPhase("off");
    const fresh = await registerNativePushToken();
    try {
      if (!fresh) throw new Error("no token");
      await api.subscribeNativePush(fresh);
      await api.updateNotificationPreferences({ push: true }).catch(() => undefined);
      setToken(fresh);
      setPhase("on");
      onEnabled?.();
    } catch {
      setFailed(true);
      setPhase("off");
    }
  }

  async function disable() {
    setPhase("busy");
    try {
      if (token) await api.unsubscribeNativePush(token);
      setPhase("off");
    } catch {
      setPhase("on");
    }
  }

  const on = phase === "on";
  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <BellRing size={17} className="brand-text shrink-0" aria-hidden="true" />
            <h2 id="native-push-title" className="section-title">
              {t("notif.nativeTitle")}
            </h2>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-labelledby="native-push-title"
            disabled={phase === "loading" || phase === "busy" || phase === "blocked"}
            onClick={() => void (on ? disable() : enable())}
            className={`focus-ring inline-flex h-8 w-14 shrink-0 items-center rounded-full px-1 transition-colors disabled:opacity-50 ${on ? "justify-end bg-[var(--brand)]" : "justify-start bg-black/20"}`}
          >
            <span
              className="inline-block h-6 w-6 rounded-full bg-white shadow"
            />
          </button>
        </div>
        <p className="body-copy mt-2">
          {phase === "blocked" ? t("notif.nativeBlocked") : t("notif.nativeDesc")}
        </p>
        {failed && (
          <p role="status" className="body-copy mt-2 text-danger">
            {t("notif.nativeFailed")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

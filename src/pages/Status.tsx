import React, { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import { PublicHeader } from "../components/PublicHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { useI18n } from "../lib/i18n";

export function Status() {
  const { t } = useI18n();
  const [h, setH] = useState<any>(null);
  useEffect(() => {
    api
      .health()
      .then(setH)
      .catch(() => setH({ status: "error" }));
  }, []);
  const services = h
    ? [
        [t("ui.api"), h.status === "ok"],
        [t("ui.identityFirestore"), Boolean(h.firebase)],
        [t("ui.storage"), Boolean(h.storageConfigured)],
        [t("ui.aiGateway"), Boolean(h.aiConfigured)],
        [t("ui.billing"), Boolean(h.billing?.configured)],
      ]
    : [];
  return (
    <main className="public-page">
      <div className="max-w-4xl mx-auto">
        <PublicHeader aside={<span className="text-meta muted hidden sm:inline">{t("status.publicStatus")}</span>} />
        <div className="mt-12">
          <div className="h-12 w-12 rounded-2xl tone-tile">
            <Activity size={20} />
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold mt-4">
            {t("status.title")}
          </h1>
          <p className="body-copy mt-3">
            {t("status.intro")}
          </p>
        </div>
        {h?.incidentBanner && (
          <div className="mt-6 rounded-xl bg-warning/12 p-4 text-sm">
            {h.incidentBanner}
          </div>
        )}
        {h === null && (
          <div className="grid sm:grid-cols-2 gap-3 mt-8" role="status" aria-busy="true" aria-label={t("app.loading")}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} shape="card" />
            ))}
          </div>
        )}
        {h?.status === "error" && (
          <div role="alert" className="mt-6 rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm text-danger flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            {t("ui.loadError")}
          </div>
        )}
        {services.length > 0 && services.every(([, ok]: any) => ok) && (
          <div className="status-hero mt-8" role="status">
            <span className="status-hero__dot" aria-hidden="true" />
            <div className="status-hero__title">{t("status.allUpTitle")}</div>
            <p className="body-copy">{t("status.allUpBody")}</p>
          </div>
        )}
        {services.length > 0 && (
          <div className="mt-8 flex items-center gap-1.5" dir="ltr" role="img" aria-label={`${services.filter(([, ok]: any) => ok).length}/${services.length}`}>
            {services.map(([label, ok]: any) => (
              <span
                key={label}
                title={label}
                className="h-3 flex-1 rounded-full"
                style={{ background: ok ? "var(--success)" : "var(--warning)" }}
              />
            ))}
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {services.map(([label, ok]: any) => (
            <Card key={label}>
              <CardContent>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-sm">{label}</div>
                  {ok ? (
                    <CheckCircle2 size={16} className="text-success" aria-hidden="true" />
                  ) : (
                    <AlertTriangle size={16} className="text-warning" aria-hidden="true" />
                  )}
                </div>
                <div className="text-meta muted mt-2">
                  {ok
                    ? t("status.operational")
                    : t("status.unavailable")}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-8 text-meta muted flex items-center gap-2">
          <ShieldCheck size={13} /> {t("status.secretsNote")}
        </div>
      </div>
    </main>
  );
}

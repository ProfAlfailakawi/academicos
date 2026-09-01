import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import { Activity, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
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
    <main className="min-h-screen bg-[var(--bg)] p-4 md:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="font-semibold">
            AcademicOS
          </Link>
          <span className="text-[10px] muted">{t("status.publicStatus")}</span>
        </div>
        <div className="mt-14">
          <div className="h-12 w-12 rounded-2xl brand-soft-bg grid place-items-center">
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
          <div className="mt-6 rounded-xl bg-[#f7eddd] dark:bg-[#332a1d] p-4 text-sm">
            {h.incidentBanner}
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-3 mt-8">
          {services.map(([label, ok]: any) => (
            <Card key={label}>
              <CardContent>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-sm">{label}</div>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`}
                  />
                </div>
                <div className="text-[11px] muted mt-2">
                  {ok
                    ? t("status.operational")
                    : t("status.unavailable")}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-8 text-[10px] muted flex items-center gap-2">
          <ShieldCheck size={13} /> {t("status.secretsNote")}
        </div>
      </div>
    </main>
  );
}

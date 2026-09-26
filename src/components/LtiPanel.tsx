import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { BookOpenCheck, CheckCircle2, Wrench } from "lucide-react";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { Card, CardContent } from "./ui/card";

type LtiInfo = Awaited<ReturnType<typeof api.ltiConfig>>["lti"];

/** LTI 1.3 / Moodle scaffold status for administrators (Integrations Center). */
export function LtiPanel() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const [lti, setLti] = useState<LtiInfo | null>(null);
  useEffect(() => {
    api.ltiConfig().then((r) => setLti(r.lti)).catch(() => setLti(null));
  }, []);
  const launched = params.get("lti") === "validated";
  if (!lti && !launched) return null;
  return (
    <Card>
      <CardContent>
        {launched && (
          <div role="status" className="mb-4 rounded-xl brand-soft-bg p-3 text-sm flex gap-2">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            <span>{t("lti.launchValidated")}{params.get("context") ? <> · <bdi>{params.get("context")}</bdi></> : null}</span>
          </div>
        )}
        {lti && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className="h-10 w-10 rounded-xl tone-tile shrink-0"><BookOpenCheck size={17} /></span>
                <div>
                  <div className="eyebrow">{t("lti.eyebrow")}</div>
                  <h2 className="section-title mt-1">{t("lti.title")}</h2>
                  <p className="body-copy mt-1 max-w-3xl">{t("lti.description")}</p>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${lti.configured ? "brand-soft-bg" : "bg-warning/10 text-warning"}`}>
                {lti.configured ? t("lti.configured") : t("lti.needsSetup")}
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-4 mt-5">
              <section className="rounded-xl border hairline p-4">
                <h3 className="text-sm font-semibold">{t("lti.platform")}</h3>
                <dl className="mt-3 space-y-2 text-xs">
                  {([
                    ["lti.issuer", lti.issuer],
                    ["lti.clientId", lti.clientId],
                    ["lti.deploymentId", lti.deploymentIds.join(", ")],
                    ["lti.jwksUrl", lti.jwksUrl],
                    ["lti.authLoginUrl", lti.authLoginUrl],
                    ["lti.tokenUrl", lti.tokenUrl],
                  ] as const).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-[8rem_1fr] gap-2">
                      <dt className="muted">{t(key)}</dt>
                      <dd className="font-mono break-all" dir="ltr">{value || "—"}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              <section className="rounded-xl border hairline p-4">
                <h3 className="text-sm font-semibold">{t("lti.toolUrls")}</h3>
                <p className="text-xs muted mt-1">{t("lti.toolUrlsHint")}</p>
                <dl className="mt-3 space-y-2 text-xs">
                  {([
                    ["lti.loginUrl", lti.tool.loginUrl],
                    ["lti.launchUrl", lti.tool.launchUrl],
                    ["lti.toolJwks", lti.tool.jwksUrl],
                  ] as const).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-[8rem_1fr] gap-2">
                      <dt className="muted">{t(key)}</dt>
                      <dd className="font-mono break-all" dir="ltr">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 text-xs">{t("lti.ags")}: <strong>{lti.agsEnabled ? t("lti.agsOn") : t("lti.agsOff")}</strong></div>
              </section>
            </div>
            {!lti.configured && (
              <div className="mt-4 rounded-xl bg-warning/10 text-warning p-3 text-xs flex gap-2">
                <Wrench size={15} className="shrink-0" />
                <span>{t("lti.missing")} <span dir="ltr" className="font-mono">{lti.missing.join(", ")}</span></span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

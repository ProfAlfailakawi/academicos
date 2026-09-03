import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  Building2,
  DollarSign,
  Flag,
  Gauge,
  Route,
  Siren,
  LoaderCircle,
  ShieldCheck,
  Fingerprint,
  Users,
} from "lucide-react";
import { api } from "../lib/api";
import type { ControlPlaneData, FeatureFlagRecord, InstitutionCommandCenter, PlatformMetrics } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "../components/ui/card";
import { StatusPill } from "../components/StatusPill";
import { formatDateTime, useI18n } from "../lib/i18n";
import { localizedUiError } from "../lib/ui-error";

export function ControlPlane() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [data, setData] = useState<ControlPlaneData | null>(null);
  const [error, setError] = useState("");
  const [flags, setFlags] = useState<FeatureFlagRecord[]>([]);
  const [flagBusy, setFlagBusy] = useState("");
  const [command, setCommand] = useState<InstitutionCommandCenter | null>(null);
  const [product, setProduct] = useState<PlatformMetrics | null>(null);
  const [fairUse, setFairUse] = useState<{ eventsReviewed:number; deniedBenefits:number; stepUpSignals:number; suspiciousDevices:number; recent:Array<{createdAt:string; benefit:string; score:number; reasonCodes:string[]}> } | null>(null);
  useEffect(() => {
    api
      .controlPlane()
      .then((r) => setData(r.control))
      .catch((e) => setError(localizedUiError(e, t, "ui.loadError")));
    api
      .featureFlags()
      .then((r) => setFlags(r.flags))
      .catch((e) => {
        console.error("Failed to load feature flags", e);
        setError((current) => current || localizedUiError(e, t, "ui.loadError"));
      });
    api.institutionCommandCenter()
      .then((r) => setCommand(r.command))
      .catch((e) => {
        console.error("Failed to load institution command center", e);
        setError((current) => current || localizedUiError(e, t, "ui.loadError"));
      });

    api.productMetrics()
      .then((r) => setProduct(r.metrics))
      .catch((e) => {
        console.error("Failed to load product metrics", e);
        setError((current) => current || localizedUiError(e, t, "ui.loadError"));
      });

    api.fairUseMetrics()
      .then((r) => setFairUse(r.fairUse))
      .catch((e) => {
        console.error("Failed to load fair-use metrics", e);
        setError((current) => current || localizedUiError(e, t, "ui.loadError"));
      });
  }, []);
  const canFlags = Boolean(
    user &&
    [
      "university_admin",
      "ai_governance_officer",
      "admin",
      "superadmin",
      "root_owner",
    ].includes(user.role),
  );
  async function toggleFlag(flag: FeatureFlagRecord) {
    if (!canFlags || flagBusy) return;
    setFlagBusy(flag.key);
    try {
      const r = await api.updateFeatureFlag(flag.key, !flag.enabled);
      setFlags((v) => v.map((x) => (x.key === flag.key ? r.flag : x)));
    } catch (e: any) {
      setError(localizedUiError(e, t, "ui.loadError"));
    } finally {
      setFlagBusy("");
    }
  }
  if (error)
    return (
      <div className="panel rounded-2xl p-6">
        <AlertTriangle className="brand-text" />
        <h1 className="section-title mt-4">{t('ctrl.errTitle')}</h1>
        <p className="body-copy mt-2">{error}</p>
      </div>
    );
  if (!data)
    return (
      <div className="min-h-64 grid place-items-center">
        <LoaderCircle className="animate-spin brand-text" />
      </div>
    );
  const m = data.metrics;
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("ui.institutionControlPlane")}
        title={t('ctrl.title')}
        description={t('ctrl.desc')}
      />
      <div className="grid grid-cols-2 xl:grid-cols-7 gap-3">
        <Metric icon={Users} label={t('ctrl.metric.users')} value={m.users} />
        <Metric icon={Building2} label={t('ctrl.metric.projects')} value={m.projects} />
        <Metric icon={Activity} label={t('ctrl.metric.active')} value={m.activeProjects} />
        <Metric icon={AlertTriangle} label={t('ctrl.metric.dueSoon')} value={m.dueSoon} />
        <Metric
          icon={BrainCircuit}
          label={t('ctrl.metric.aiCost')}
          value={`$${m.aiCostUsd.toFixed(2)}`}
        />
        <Metric
          icon={ShieldCheck}
          label={t('ctrl.metric.openIncidents')}
          value={m.openIncidents}
        />
        <Metric icon={Users} label={t('ctrl.metric.supportBacklog')} value={m.supportBacklog} />
      </div>
      {product && (
        <section className="grid xl:grid-cols-[1.15fr_.85fr] gap-5">
          <Card>
            <CardContent>
              <div className="flex items-center gap-3"><span className="h-11 w-11 rounded-2xl tone-tile"><Route size={18} /></span><div><div className="eyebrow">{t("ui.productFunnel")}</div><h2 className="section-title mt-1">{t("control.funnelTitle")}</h2></div></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-5">
                <Funnel label={t("ui.activation")} value={product.activation} />
                <Funnel label={t("control.firstAssignment")} value={product.firstAssignmentSuccess} />
                <Funnel label={t("control.secondProject")} value={product.secondProjectRetention} />
                <Funnel label={t("control.paidConversion")} value={product.paidConversion} />
              </div>
              <div className="grid sm:grid-cols-3 gap-2 mt-3"><Twin label={t("control.projectCompletion")} value={`${Math.round(product.projectCompletion * 100)}%`} /><Twin label={t("control.auditUsage")} value={`${Math.round(product.submissionAuditUsage * 100)}%`} /><Twin label={t("control.vivaUsage")} value={`${Math.round(product.vivaUsage * 100)}%`} /></div>
              <p className="text-[10px] muted leading-5 mt-3">{t("control.funnelNote")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-center gap-3"><span className="h-11 w-11 rounded-2xl tone-tile"><Gauge size={18} /></span><div><div className="eyebrow">{t("ui.aiCostQualityGate")}</div><h2 className="section-title mt-1">{t("control.aiHealthTitle")}</h2></div></div>
              {(() => { const failureRate = product.ai.runs ? (product.ai.failures / product.ai.runs) * 100 : 0; const costPerRun = product.ai.runs ? product.ai.costUsd / product.ai.runs : 0; const gate = failureRate >= 5 ? "critical" : failureRate >= 2 ? "attention" : "healthy"; return <><div className="grid grid-cols-3 gap-2 mt-5"><Twin label={t("ui.aiRuns")} value={product.ai.runs} /><Twin label={t("ui.cost")} value={`$${product.ai.costUsd.toFixed(2)}`} /><Twin label={t("ui.costPerRun")} value={`$${costPerRun.toFixed(3)}`} /></div><div className={`mt-4 rounded-xl p-4 ${gate === "healthy" ? "brand-soft-bg" : gate === "critical" ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning"}`}><div className="flex items-center justify-between gap-3"><strong className="text-xs">{t("control.reliabilityGate")}</strong><span className="text-xs font-bold mono-number">{failureRate.toFixed(1)}% {t("ui.failures")}</span></div><p className="text-[10px] leading-5 mt-2">{gate === "healthy" ? t("control.aiHealthy") : gate === "critical" ? t("control.aiCritical") : t("control.aiAttention")}</p></div></>; })()}
              <div className="mt-4 flex items-center gap-2 text-[10px] muted"><DollarSign size={13} /> {t("control.costCaveat")}</div>
            </CardContent>
          </Card>
        </section>
      )}
      {fairUse && (
        <Card>
          <CardContent>
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
              <div className="flex items-start gap-3">
                <span className="h-11 w-11 rounded-2xl tone-tile shrink-0"><Fingerprint size={19} /></span>
                <div><div className="eyebrow">{t("ui.fairUseShield")}</div><h2 className="section-title mt-1">{t("control.fairUseTitle")}</h2><p className="body-copy mt-2 max-w-3xl">{t("control.fairUseDesc")}</p></div>
              </div>
              <span className="tone-chip" data-tone="brand">{t("control.noMac")}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-5">
              <Twin label={t("control.fairUseReviewed")} value={fairUse.eventsReviewed} />
              <Twin label={t("control.fairUseDenied")} value={fairUse.deniedBenefits} />
              <Twin label={t("control.fairUseStepUp")} value={fairUse.stepUpSignals} />
              <Twin label={t("control.fairUseDevices")} value={fairUse.suspiciousDevices} />
            </div>
            {fairUse.recent.length > 0 && <div className="mt-5 grid lg:grid-cols-2 gap-2">{fairUse.recent.slice(0,6).map((item,idx)=><div key={`${item.createdAt}_${idx}`} className="rounded-xl border hairline bg-[var(--bg)] p-3"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold">{item.benefit}</span><span className="text-xs font-bold mono-number">{t("ui.risk")} {item.score}</span></div><div className="text-[10px] muted mt-1">{item.reasonCodes.join(" · ")}</div></div>)}</div>}
          </CardContent>
        </Card>
      )}
      {command && (
        <section className="panel-flat rounded-2xl p-5 md:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div><div className="eyebrow">{t("ui.institutionDecisionRoom")}</div><h2 className="section-title mt-1">{t('ctrl.twinTitle')}</h2><p className="body-copy mt-2">{t('ctrl.twinDesc')}</p></div>
            <span className="tone-chip" data-tone={command.posture === "healthy" ? "success" : command.posture === "critical" ? "danger" : "warning"}>{command.posture === "healthy" ? t('ctrl.posture.healthy') : command.posture === "critical" ? t('ctrl.posture.critical') : t('ctrl.posture.attention')}</span>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-5"><Twin label={t('ctrl.twin.projects')} value={command.twin.projects}/><Twin label={t('ctrl.twin.courses')} value={command.twin.courses}/><Twin label={t('ctrl.twin.assignments')} value={command.twin.assignments}/><Twin label={t('ctrl.twin.coverage')} value={`${command.twin.outcomeCoverage}%`}/><Twin label={t('ctrl.twin.submissions')} value={command.twin.submissions}/><Twin label={t('ctrl.twin.released')} value={command.twin.released}/></div>
          <div className="grid lg:grid-cols-2 gap-4 mt-5"><div className="space-y-2">{command.decisions.slice(0,5).map(d=><div key={d.id} className="rounded-xl border hairline p-3 bg-[var(--bg)]"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold">{d.title}</span><span className="text-sm font-semibold mono-number">{d.metric}</span></div><p className="text-[10px] muted leading-5 mt-1">{d.detail} {d.recommendation}</p></div>)}{!command.decisions.length&&<div className="rounded-xl brand-soft-bg p-4 text-sm font-semibold">{t('ctrl.noDecisions')}</div>}</div><div className="grid sm:grid-cols-2 gap-2">{command.operations.map(op=><div key={op.key} className="rounded-xl border hairline p-3 bg-[var(--bg)]"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{op.label}</span><span className={`h-2.5 w-2.5 rounded-full ${op.state === "ready" ? "bg-success" : op.state === "attention" ? "bg-warning" : "bg-danger"}`}/></div><div className="text-[9px] muted leading-4 mt-2">{op.detail}</div></div>)}</div></div>
        </section>
      )}
      <div className="grid xl:grid-cols-[1.45fr_.8fr] gap-5">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="eyebrow">{t("ui.operationalView")}</div>
                <h2 className="section-title mt-1">
                  {t('ctrl.projectsInTenant')}
                </h2>
              </div>
              <span className="text-[11px] muted">
                {t('ctrl.noFileContent')}
              </span>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="text-[11px] muted border-b hairline">
                    <th className="text-start py-3 font-medium">{t('ctrl.col.project')}</th>
                    <th className="text-start font-medium">{t('ctrl.col.course')}</th>
                    <th className="text-start font-medium">{t('ctrl.col.status')}</th>
                    <th className="text-start font-medium">{t('ctrl.col.progress')}</th>
                    <th className="text-start font-medium">{t('ctrl.col.risks')}</th>
                    <th className="text-start font-medium">{t("ui.aiPolicy")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.projects.map((p) => (
                    <tr key={p.id} className="border-b hairline last:border-0">
                      <td className="py-4 font-semibold">
                        {p.title}
                        <div className="text-[10px] muted font-normal mt-1">
                          {formatDateTime(p.updatedAt, locale)}
                        </div>
                      </td>
                      <td>{p.course}</td>
                      <td>
                        <StatusPill status={p.status} />
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-[var(--line)] overflow-hidden">
                            <div style={{ width: `${p.progress}%` }}
                            />
                          </div>
                          <span className="text-xs">{p.progress}%</span>
                        </div>
                      </td>
                      <td>{p.riskCount}</td>
                      <td>L{p.aiPolicyLevel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.projects.length && (
                <p className="body-copy py-8">
                  {t('ctrl.noProjects')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <div className="space-y-5">
          <Card>
            <CardContent>
              <div className="eyebrow">{t("ui.systemTruth")}</div>
              <h2 className="section-title mt-1">{t('ctrl.systemState')}</h2>
              <div className="mt-4 space-y-2">
                {Object.entries(data.system).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between rounded-xl bg-[var(--bg)] border hairline p-3"
                  >
                    <span className="text-xs font-semibold">{k}</span>
                    <span className="text-[11px] muted max-w-40 truncate">
                      {String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-center gap-2">
                <Flag size={16} className="brand-text" />
                <div>
                  <div className="eyebrow">{t("ui.emergencyControlsFlags")}</div>
                  <h2 className="section-title mt-1 flex items-center gap-2"><Siren size={15} /> {t("control.emergencyControls")}</h2>
                </div>
              </div>
              <p className="body-copy mt-2">
                {t('ctrl.flagsNote')}
              </p>
              <div className="mt-4 space-y-2">
                {flags.map((f) => (
                  <div
                    key={f.key}
                    className="rounded-xl bg-[var(--bg)] border hairline p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold">{f.key}</div>
                        <div className="text-[9px] muted mt-1 leading-4">
                          {f.description}
                        </div>
                      </div>
                      <button
                        disabled={!canFlags || Boolean(flagBusy)}
                        onClick={() => toggleFlag(f)}
                        aria-label={t('ctrl.toggleFlag').replace('{key}', f.key)}
                        className={`focus-ring relative h-6 w-11 rounded-full transition-colors ${f.enabled ? "brand-bg" : "soft-bg"}`}
                      >
                        <span
                          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${f.enabled ? "end-6" : "end-1"}`}
                        />
                      </button>
                    </div>
                  </div>
                ))}
                {!flags.length && (
                  <p className="body-copy">{t('ctrl.noFlags')}</p>
                )}
              </div>
              {!canFlags && (
                <div className="text-[9px] muted mt-3">
                  {t('ctrl.viewOnlyRole')}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="eyebrow">{t("ui.auditTrail")}</div>
              <h2 className="section-title mt-1">{t('ctrl.recentOps')}</h2>
              <div className="mt-4 space-y-3 max-h-[420px] overflow-auto">
                {data.audit.slice(0, 20).map((a) => (
                  <div
                    key={a.id}
                    className="border-b hairline pb-3 last:border-0"
                  >
                    <div className="text-xs font-semibold">{a.action}</div>
                    <div className="text-[10px] muted mt-1">
                      {a.target} ·{" "}
                      {formatDateTime(a.timestamp, locale)}
                    </div>
                  </div>
                ))}
                {!data.audit.length && (
                  <p className="body-copy">{t('ctrl.noAudit')}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
function Metric({ icon: Icon, label, value }: any) {
  return (
    <div className="panel rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] muted">{label}</span>
        <Icon size={15} className="brand-text" />
      </div>
      <div className="text-2xl font-semibold tracking-tight mt-3">{value}</div>
    </div>
  );
}
function Funnel({ label, value }: { label: string; value: number }) { const pct = Math.max(0, Math.min(100, (Number(value) || 0) * 100)); return <div className="rounded-xl border hairline p-3"><div className="flex items-center justify-between gap-2"><span className="text-[9px] muted">{label}</span><strong className="text-sm mono-number">{pct}%</strong></div><div className="tone-meter mt-3"><div style={{ width: `${pct}%` }} /></div></div>; }
function Twin({label,value}:{label:string;value:string|number}){return <div className="rounded-xl bg-[var(--bg)] border hairline p-3 text-center"><div className="text-lg font-semibold mono-number">{value}</div><div className="text-[9px] muted mt-1">{label}</div></div>}

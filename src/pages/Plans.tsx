import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowRight, BookOpenCheck, Check, CreditCard, LoaderCircle, LockKeyhole, ShieldCheck, Sparkles, Users } from "lucide-react";
import { api } from "../lib/api";
import type { ProjectAccess, ProjectDNA } from "../types";
import { Button } from "../components/ui/button";
import { formatMoney, useI18n } from "../lib/i18n";

const FALLBACK = [
  { id: "preview", amountUsd: 0, pages: 3, projects: 1 },
  { id: "project", amountUsd: 6.99, pages: 20, projects: 1 },
  { id: "project_viva", amountUsd: 8.99, pages: 25, projects: 1 },
  { id: "group", amountUsd: 12.99, pages: 35, projects: 1 },
];
const ICONS: Record<string, React.ElementType> = { preview: Sparkles, project: CreditCard, project_viva: ShieldCheck, group: Users };

export function Plans() {
  const { t, locale } = useI18n();
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState<ProjectDNA[]>([]);
  const [selectedId, setSelectedId] = useState(params.get("project") || "");
  const [access, setAccess] = useState<ProjectAccess | null>(null);
  const [configured, setConfigured] = useState(false);
  const [provider, setProvider] = useState("disabled");
  const [plans, setPlans] = useState(FALLBACK);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([api.billingStatus(), api.projects()])
      .then(([status, projectResult]) => {
        setConfigured(status.billing.configured);
        setProvider(status.billing.provider);
        setCurrency(status.billing.currency || "USD");
        if (status.billing.plans?.length) setPlans(status.billing.plans.map((plan) => ({ id: plan.id, amountUsd: plan.amountUsd, pages: plan.pages, projects: plan.projects })));
        setProjects(projectResult.projects);
        setSelectedId((current) => projectResult.projects.some((project) => project.id === current) ? current : projectResult.projects[0]?.id || "");
      })
      .catch((error) => setMessage(error.message || t("plans.loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    if (!selectedId) { setAccess(null); return; }
    setParams((current) => { const next = new URLSearchParams(current); next.set("project", selectedId); return next; }, { replace: true });
    api.projectAccess(selectedId).then((result) => setAccess(result.access)).catch(() => setAccess(null));
  }, [selectedId, setParams]);

  useEffect(() => {
    if (params.get("billing") === "cancelled") { setMessage(t("plans.cancelled")); return; }
    if (params.get("billing") !== "success" || !selectedId) return;
    let active = true, attempts = 0;
    setMessage(t("plans.confirming"));
    const verify = async () => {
      attempts += 1;
      try {
        const result = await api.projectAccess(selectedId);
        if (!active) return;
        setAccess(result.access);
        if (result.access.unlocked) { setMessage(t("plans.confirmed")); return; }
      } catch {}
      if (active && attempts < 12) window.setTimeout(verify, 1500);
      else if (active) setMessage(t("plans.bankPending"));
    };
    void verify();
    return () => { active = false; };
  }, [params, selectedId, t]);

  const selected = useMemo(() => projects.find((project) => project.id === selectedId), [projects, selectedId]);

  async function checkout(planId: "project" | "project_viva" | "group") {
    if (!selected) { setMessage(t("plans.selectProjectFirst")); return; }
    if (selected.collaborationMode === "group" && planId !== "group") { setMessage(t("plans.groupRequired")); return; }
    if (!configured) { setMessage(t("plans.notConfigured")); return; }
    setBusy(planId); setMessage("");
    try { const result = await api.createCheckout(planId, selected.id); window.location.assign(result.url); }
    catch (error: any) { setMessage(error.message || t("plans.checkoutError")); setBusy(""); }
  }

  return <div className="mx-auto max-w-6xl space-y-8">
    <header className="text-center max-w-3xl mx-auto">
      <div className="student-proof-chip"><CreditCard size={14} /> {t("plans.chip")}</div>
      <h1 className="text-3xl md:text-5xl font-black tracking-[-.05em] mt-5">{t("plans.title")}</h1>
      <p className="body-copy mt-3">{t("plans.subtitle")}</p>
    </header>

    <section className="panel-flat rounded-[24px] p-4 md:p-5">
      <div className="grid md:grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center">
        <span className="h-12 w-12 rounded-2xl tone-tile"><BookOpenCheck size={20} /></span>
        <label className="min-w-0"><span className="eyebrow">{t("plans.projectLabel")}</span>{loading ? <span className="field mt-2 flex items-center gap-2"><LoaderCircle size={15} className="animate-spin" /> {t("plans.loadingProjects")}</span> : projects.length ? <select className="field mt-2" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.title} · {project.course}</option>)}</select> : <p className="text-xs muted mt-2">{t("plans.noProject")}</p>}</label>
        {!projects.length && !loading ? <Button asChild><Link to="/app/upload">{t("plans.uploadAssignment")} <ArrowRight size={15} className="directional-icon" /></Link></Button> : access?.unlocked && selected ? <Button asChild><Link to={`/app/project/${selected.id}`}>{t("plans.openProject")} <ArrowRight size={15} className="directional-icon" /></Link></Button> : null}
      </div>
      {selected && <div className="mt-3 flex flex-wrap gap-2 text-[10px]"><span className="rounded-full soft-bg px-3 py-1.5">{selected.collaborationMode === "group" ? t("plans.groupProject") : t("plans.individualProject")}</span><span className={`rounded-full px-3 py-1.5 ${access?.unlocked ? "brand-soft-bg" : "bg-warning/10 text-warning"}`}>{access?.unlocked ? t("plans.unlocked") : t("plans.freePreview")}</span></div>}
    </section>

    {message && <div role="status" className="rounded-2xl brand-soft-bg p-4 text-sm text-center">{message}</div>}

    <div className="plan-grid">
      {plans.map((plan) => {
        const Icon = ICONS[plan.id] || Sparkles;
        const paid = plan.id !== "preview";
        const popular = plan.id === "project";
        const groupMismatch = Boolean(selected?.collaborationMode === "group" && paid && plan.id !== "group");
        const key = `plans.plan.${plan.id}`;
        return <article key={plan.id} className={`plan-card ${popular ? "is-popular" : ""} ${groupMismatch ? "opacity-55" : ""}`}>
          {popular && <span className="plan-card__popular">{t("plans.popular")}</span>}
          <span className="plan-card__icon"><Icon size={22} /></span>
          <h2>{t(`${key}.name`)}</h2>
          <div className="plan-price"><strong>{formatMoney(plan.amountUsd, currency, locale)}</strong></div>
          <p>{t(`${key}.description`)}</p>
          <ul><li><Check size={14} /> {t("plans.featureNoRenewal")}</li><li><Check size={14} /> {t("plans.featureEvidence")}</li><li><Check size={14} /> {t("plans.featureLanguages")}</li></ul>
          <Button className="w-full mt-auto" variant={paid ? "default" : "outline"} disabled={busy === plan.id || groupMismatch || (paid && access?.unlocked && access.planId === plan.id)} onClick={() => paid ? checkout(plan.id as "project" | "project_viva" | "group") : selected ? window.location.assign(`/app/project/${selected.id}`) : window.location.assign("/app/upload")}>{busy === plan.id ? <LoaderCircle size={15} className="animate-spin" /> : access?.unlocked && access.planId === plan.id ? <Check size={15} /> : paid ? <LockKeyhole size={15} /> : <Sparkles size={15} />}{access?.unlocked && access.planId === plan.id ? t("plans.active") : groupMismatch ? t("plans.individualOnly") : paid ? t("plans.choose") : t("plans.startPreview")}</Button>
        </article>;
      })}
    </div>

    <div className="rounded-2xl border hairline p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"><span><strong>{t("plans.connection")}</strong> {configured ? `${t("plans.connectedVia")} ${provider}` : t("plans.waitingKeys")}</span><span className="muted">{t("plans.serverPriceNote")}</span></div>
  </div>;
}

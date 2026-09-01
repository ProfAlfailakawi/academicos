import React, { useMemo, useState } from "react";
import { BarChart2, GitGraph, TrendingUp, Download, CheckCircle2, Clock3, CircleDashed, Code2, Copy, ShieldCheck } from "lucide-react";
import type { ProjectDNA } from "../../types";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { formatDate, useI18n, type LocaleCode } from "../../lib/i18n";
import { runtimeEnumLabel } from "../../lib/platform-locale";

type ChartType = "bar" | "flowchart" | "timeline";

const statusScore: Record<string, number> = { completed: 100, ready: 90, in_progress: 55, active: 55, pending: 10, draft: 15, blocked: 5 };
function safeDate(value: string | undefined, locale: LocaleCode, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatDate(date, locale, { year: "numeric", month: "short", day: "numeric" });
}

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[char] || char));
}

export function DynamicDataVisualizer({ project }: { project: ProjectDNA }) {
  const { t, locale, meta } = useI18n();
  const statusText = (status: string) => { const keyed = t(`visual.status.${status}`); return keyed === `visual.status.${status}` ? runtimeEnumLabel(status, locale) : keyed; };
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [copied, setCopied] = useState(false);

  const deliverables = useMemo(() => project.deliverables || [], [project.deliverables]);
  const tasks = useMemo(() => project.tasks || [], [project.tasks]);
  const requirements = useMemo(() => project.requirements || [], [project.requirements]);

  const barData = useMemo(() => {
    const rows = deliverables.slice(0, 8).map((item) => ({ label: item.title, value: statusScore[item.status] ?? 0, status: statusText(item.status) }));
    if (rows.length) return rows;
    const rubricRows = (project.rubric || []).slice(0, 8).map((item) => ({
      label: item.title,
      value: item.readiness === "covered" ? 100 : item.readiness === "partial" ? 55 : item.readiness === "needs_revision" ? 30 : 0,
      status: item.readiness === "covered" ? t("visual.covered") : item.readiness === "partial" ? t("visual.partial") : item.readiness === "needs_revision" ? t("visual.needsReview") : t("visual.noEvidence"),
    }));
    return rubricRows;
  }, [deliverables, project.rubric, t]);

  const workflowSteps = useMemo(() => {
    const fromTasks = tasks.slice(0, 8).map((task, index) => ({ title: task.title, desc: task.description || t("visual.recordedTask"), time: task.dueDate ? safeDate(task.dueDate, locale, t("visual.unspecified")) : task.estimatedMinutes ? `${task.estimatedMinutes} ${t("visual.minutes")}` : `${t("visual.step")} ${index + 1}`, status: task.status }));
    if (fromTasks.length) return fromTasks;
    return requirements.slice(0, 8).map((req, index) => ({ title: req.label, desc: req.value || t("visual.dnaRequirement"), time: req.source || `${t("visual.requirement")} ${index + 1}`, status: "pending" }));
  }, [tasks, requirements, locale, t]);

  const timelineItems = useMemo(() => {
    const milestones = (project.deadlines?.milestones || []).map((m) => ({ id: m.id, title: m.title, date: m.date, status: new Date(m.date).getTime() < Date.now() ? "due" : "upcoming" }));
    if (project.deadlines?.final) milestones.push({ id: "final", title: t("visual.finalSubmission"), date: project.deadlines.final, status: new Date(project.deadlines.final).getTime() < Date.now() ? "due" : "upcoming" });
    return milestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [project.deadlines, t]);

  const mermaid = useMemo(() => {
    if (!workflowSteps.length) return `flowchart TD\n  A[${t("visual.noPlanData")}]`;
    return `flowchart TD\n${workflowSteps.map((step, i) => `  N${i}[\"${step.title.replace(/\"/g, "'")}\"]${i < workflowSteps.length - 1 ? ` --> N${i + 1}` : ""}`).join("\n")}`;
  }, [workflowSteps, t]);

  const downloadSvg = () => {
    const width = 1080, rowHeight = 74, height = Math.max(240, 130 + Math.max(1, barData.length) * rowHeight);
    const rows = barData.length ? barData : [{ label: t("visual.noDrawable"), value: 0, status: t("visual.waitingData") }];
    const body = rows.map((item, i) => {
      const y = 105 + i * rowHeight;
      const barWidth = Math.round(Math.max(0, Math.min(100, item.value)) * 7.2);
      return `<text x="${meta.dir === "rtl" ? 1040 : 40}" y="${y}" text-anchor="${meta.dir === "rtl" ? "end" : "start"}" font-size="19" font-family="Arial" direction="${meta.dir}">${escapeXml(item.label.slice(0, 62))}</text><rect x="300" y="${y - 22}" width="720" height="24" rx="12" fill="#e5e7eb"/><rect x="300" y="${y - 22}" width="${barWidth}" height="24" rx="12" fill="#2563eb"/><text x="${meta.dir === "rtl" ? 40 : 1040}" y="${y - 3}" text-anchor="${meta.dir === "rtl" ? "start" : "end"}" font-size="16" font-family="Arial">${item.value}% · ${escapeXml(item.status)}</text>`;
    }).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><text x="${meta.dir === "rtl" ? 1040 : 40}" y="48" text-anchor="${meta.dir === "rtl" ? "end" : "start"}" font-size="28" font-weight="700" font-family="Arial" direction="${meta.dir}">${escapeXml(project.title)}</text><text x="${meta.dir === "rtl" ? 1040 : 40}" y="76" text-anchor="${meta.dir === "rtl" ? "end" : "start"}" font-size="15" fill="#6b7280" font-family="Arial" direction="${meta.dir}">${escapeXml(t("visual.svgNote"))}</text>${body}</svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${project.title || "academicos-project"}-visual.svg`; anchor.click(); URL.revokeObjectURL(url);
  };

  const copyMermaid = async () => { await navigator.clipboard.writeText(mermaid); setCopied(true); window.setTimeout(() => setCopied(false), 1500); };

  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border hairline bg-[var(--panel)]">
      <div><div className="text-[10px] font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400">{t("ui.evidenceBoundVisualStudio")}</div><h2 className="text-lg font-bold tracking-tight mt-0.5">{t("visual.title")}</h2><p className="text-xs text-muted-foreground mt-1 max-w-2xl">{t("visual.description")}</p></div>
      <div className="flex items-center gap-2 flex-wrap"><div className="flex rounded-xl border hairline p-1 bg-[var(--bg)]">
        <button onClick={() => setChartType("bar")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${chartType === "bar" ? "bg-blue-600 text-white" : "text-muted-foreground"}`}><BarChart2 size={13}/>{t("visual.readiness")}</button>
        <button onClick={() => setChartType("flowchart")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${chartType === "flowchart" ? "bg-blue-600 text-white" : "text-muted-foreground"}`}><GitGraph size={13}/>{t("visual.workflow")}</button>
        <button onClick={() => setChartType("timeline")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${chartType === "timeline" ? "bg-blue-600 text-white" : "text-muted-foreground"}`}><TrendingUp size={13}/>{t("visual.timeline")}</button>
      </div><Button size="sm" variant="outline" className="text-xs gap-1" onClick={downloadSvg}><Download size={13}/>{t("visual.export")}</Button></div>
    </div>

    <Card><CardContent className="p-6 md:p-8 space-y-6">
      {chartType === "bar" && <div className="space-y-5"><div><h3 className="font-bold text-sm">{t("visual.readinessTitle")}</h3><p className="text-xs text-muted-foreground mt-1">{t("visual.readinessDesc")}</p></div>
        {barData.length ? <div className="space-y-4">{barData.map(item => <div key={item.label} className="space-y-1.5"><div className="flex justify-between gap-4 text-xs"><span className="font-medium truncate">{item.label}</span><span className="font-mono font-bold shrink-0">{item.value}% · {item.status}</span></div><div className="h-3 w-full rounded-full bg-blue-100 dark:bg-blue-950/40 overflow-hidden"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${item.value}%` }}/></div></div>)}</div> : <div className="rounded-2xl border hairline p-8 text-center text-sm text-muted-foreground"><CircleDashed className="mx-auto mb-3"/>{t("visual.noDrawable")}</div>}
        <div className="flex items-start gap-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 text-xs"><ShieldCheck size={15} className="text-emerald-600 shrink-0"/><span>{t("visual.noFakeStats")}</span></div>
      </div>}

      {chartType === "flowchart" && <div className="space-y-5"><div><h3 className="font-bold text-sm">{t("visual.workflowTitle")}</h3><p className="text-xs text-muted-foreground mt-1">{t("visual.workflowDesc")}</p></div>
        {workflowSteps.length ? <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{workflowSteps.map((step, idx) => <div key={`${step.title}-${idx}`} className="rounded-2xl border hairline bg-[var(--bg)] p-4"><div className="flex items-center justify-between"><span className="h-7 w-7 rounded-lg bg-blue-600 text-white text-xs font-bold grid place-items-center">{idx + 1}</span><span className="text-[10px] font-mono text-blue-600">{step.time}</span></div><div className="font-bold text-xs mt-3">{step.title}</div><p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{step.desc}</p></div>)}</div> : <div className="rounded-xl border hairline p-6 text-xs text-muted-foreground">{t("visual.noWorkflow")}</div>}
        <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-xs flex items-center justify-between gap-3"><span>{t("visual.mermaidDesc")}</span><Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={copyMermaid}>{copied ? <CheckCircle2 size={12}/> : <Copy size={12}/>} {copied ? t("visual.copied") : t("visual.copyMermaid")}</Button></div>
        <pre className="hidden">{mermaid}</pre>
      </div>}

      {chartType === "timeline" && <div className="space-y-4"><div><h3 className="font-bold text-sm">{t("visual.timelineTitle")}</h3><p className="text-xs text-muted-foreground mt-1">{t("visual.timelineDesc")}</p></div>
        {timelineItems.length ? <div className="space-y-3">{timelineItems.map(item => { const due = item.status === "due"; return <div key={item.id} className="p-3 rounded-xl border hairline bg-[var(--bg)] flex items-center justify-between gap-3"><div className="flex items-center gap-3">{due ? <Clock3 size={16} className="text-amber-600"/> : <CheckCircle2 size={16} className="text-blue-600"/>}<span className="font-bold text-xs">{item.title}</span></div><span className="text-xs font-mono">{safeDate(item.date, locale, t("visual.unspecified"))}</span></div>})}</div> : <div className="rounded-xl border hairline p-8 text-center text-sm text-muted-foreground"><Clock3 className="mx-auto mb-3"/>{t("visual.noTimeline")}</div>}
      </div>}
    </CardContent></Card>
  </div>;
}

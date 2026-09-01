import React, { useMemo, useState } from "react";
import { Presentation, Download, Mic, Clock, Sparkles, ChevronLeft, ChevronRight, Copy, Check, ShieldCheck } from "lucide-react";
import type { ProjectDNA } from "../../types";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { useI18n } from "../../lib/i18n";

interface SlideData { id:number; title:string; subtitle:string; bulletPoints:string[]; allocatedTimeSeconds:number; speakerScript:string; keyTakeaway:string; }

const compact = (values: Array<string | undefined>, max = 4) => [...new Set(values.map(v => String(v || "").trim()).filter(Boolean))].slice(0, max);
const escapeHtml = (value:string) => value.replace(/[<>&\"]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c] || c));

export function AutoPresentationStudio({ project }: { project: ProjectDNA }) {
  const { t, locale, meta } = useI18n();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const slides = useMemo<SlideData[]>(() => {
    const result: SlideData[] = [];
    const add = (title:string, subtitle:string, points:string[], script:string, takeaway:string, seconds=75) => {
      const cleanPoints = compact(points, 5); if (!cleanPoints.length) return;
      result.push({ id:result.length + 1, title, subtitle, bulletPoints:cleanPoints, allocatedTimeSeconds:seconds, speakerScript:script, keyTakeaway:takeaway });
    };
    add(project.title || t("pres.project"), project.course || project.academicDomain || "", [project.projectType, project.academicDomain, ...project.learningOutcomes], t("pres.scriptIntro").replace("{title}", project.title), t("pres.takeawayIntro"), 60);
    add(t("pres.requirementsTitle"), "Project DNA · Requirements", (project.requirements || []).map(r => `${r.label}: ${r.value || t("pres.unspecified")}`), t("pres.scriptRequirements"), t("pres.takeawayRequirements"), 75);
    add(t("pres.outcomesTitle"), t("pres.outcomesSubtitle"), [...(project.learningOutcomes || []), ...(project.requiredActions || [])], t("pres.scriptOutcomes"), t("pres.takeawayOutcomes"), 90);
    add(t("pres.deliverablesTitle"), "Deliverables", (project.deliverables || []).map(d => `${d.title} — ${d.format || t("pres.unspecifiedFormat")} — ${d.status}`), t("pres.scriptDeliverables"), t("pres.takeawayDeliverables"), 75);
    add(t("pres.rubricTitle"), "Rubric coverage", (project.rubric || []).map(r => `${r.title}${r.weighting ? ` (${r.weighting}%)` : ""}${r.readiness ? ` — ${r.readiness}` : ""}`), t("pres.scriptRubric"), t("pres.takeawayRubric"), 90);
    add(t("pres.risksTitle"), t("pres.risksSubtitle"), project.riskFlags || [], t("pres.scriptRisks"), t("pres.takeawayRisks"), 60);
    if (!result.length) result.push({ id:1, title:project.title || t("pres.project"), subtitle:t("pres.waitingDna"), bulletPoints:[t("pres.notEnoughData")], allocatedTimeSeconds:45, speakerScript:t("pres.waitingScript"), keyTakeaway:t("pres.waitingTakeaway") });
    return result;
  }, [project, t]);

  const currentSlide = slides[Math.min(currentSlideIndex, slides.length - 1)];
  const totalMinutes = Math.ceil(slides.reduce((acc, s) => acc + s.allocatedTimeSeconds, 0) / 60);
  const copyScript = async () => { await navigator.clipboard.writeText(currentSlide.speakerScript); setCopied(true); window.setTimeout(() => setCopied(false), 1600); };

  const exportDeck = () => {
    const sections = slides.map(s => `<section class="slide"><div class="eyebrow">${escapeHtml(project.course || project.academicDomain || "AcademicOS")}</div><h1>${escapeHtml(s.title)}</h1><h2>${escapeHtml(s.subtitle)}</h2><ul>${s.bulletPoints.map(p => `<li>${escapeHtml(p)}</li>`).join("")}</ul><div class="notes"><strong>${escapeHtml(t("pres.presenterNotes"))} · ${s.allocatedTimeSeconds}s</strong><p>${escapeHtml(s.speakerScript)}</p></div></section>`).join("");
    const html = `<!doctype html><html lang="${locale}" dir="${meta.dir}"><meta charset="utf-8"><title>${escapeHtml(project.title)} · Presentation</title><style>@page{size:16in 9in;margin:0}body{margin:0;font-family:Arial,sans-serif;background:#111;color:#fff;text-align:start}.slide{box-sizing:border-box;width:100vw;min-height:100vh;padding:8vh 8vw;page-break-after:always;background:linear-gradient(135deg,#09090b,#18181b)}.eyebrow{color:#f59e0b;font-weight:700;letter-spacing:.08em}.slide h1{font-size:3.2rem;margin:2rem 0 .5rem}.slide h2{color:#fcd34d;font-size:1.2rem}.slide li{font-size:1.45rem;line-height:1.8;margin:.6rem 0}.notes{margin-top:3rem;padding:1rem;border:1px solid #3f3f46;border-radius:16px;color:#d4d4d8;font-size:.95rem}@media print{.notes{display:none}.slide{height:100vh}}</style><body>${sections}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], {type:"text/html;charset=utf-8"})); const a=document.createElement("a"); a.href=url; a.download=`${project.title || "academicos"}-presentation.html`; a.click(); URL.revokeObjectURL(url);
  };

  return <div className="space-y-6">
    <div className="rounded-2xl border hairline bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5"><div className="h-11 w-11 rounded-2xl bg-amber-500/20 text-amber-600 grid place-items-center shrink-0"><Presentation size={22}/></div><div><div className="flex items-center gap-2 flex-wrap"><span className="text-[10px] font-bold tracking-wider uppercase text-amber-600">Evidence-bound Presentation Builder</span><span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-700 font-semibold border border-amber-500/20">Project DNA only</span></div><h2 className="text-lg md:text-xl font-bold tracking-tight mt-0.5">{t("pres.title")}</h2><p className="text-xs text-muted-foreground mt-1">{t("pres.description")}</p></div></div>
      <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={exportDeck}><Download size={13}/>{t("pres.export")}</Button>
    </div>

    <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
      <div className="space-y-4"><div className="rounded-3xl border-2 hairline bg-gradient-to-br from-zinc-900 via-zinc-950 to-black text-white p-8 md:p-10 shadow-2xl min-h-[360px] flex flex-col justify-between">
        <div><div className="flex items-center justify-between text-[11px] text-zinc-400 pb-4 border-b border-zinc-800"><span className="font-bold tracking-wider uppercase text-amber-400">{project.academicDomain || "Academic Project"}</span><span className="font-mono">{currentSlide.id} / {slides.length}</span></div><h2 className="text-xl md:text-2xl font-bold mt-5">{currentSlide.title}</h2><p className="text-xs text-amber-300/80 mt-1">{currentSlide.subtitle}</p></div>
        <div className="space-y-3 py-6">{currentSlide.bulletPoints.map((point,i) => <div key={i} className="flex items-start gap-3 text-xs md:text-sm text-zinc-200"><span className="h-2 w-2 rounded-full bg-amber-400 mt-2 shrink-0"/><span className="leading-relaxed">{point}</span></div>)}</div>
        <div className="flex items-center justify-between pt-4 border-t border-zinc-800 text-[10px] text-zinc-400 font-mono"><span>{project.course}</span><span className="flex items-center gap-1"><ShieldCheck size={11}/>{t("pres.bound")}</span></div>
      </div>
      <div className="flex items-center justify-between p-3 rounded-2xl border hairline bg-[var(--panel)]"><Button size="sm" variant="outline" onClick={() => setCurrentSlideIndex(p => Math.max(0,p-1))} disabled={currentSlideIndex===0}><ChevronRight size={14}/>{t("pres.previous")}</Button><div className="flex gap-1.5">{slides.map((s,idx)=><button key={s.id} onClick={()=>setCurrentSlideIndex(idx)} className={`h-2.5 rounded-full ${currentSlideIndex===idx?"w-7 bg-amber-500":"w-2.5 bg-muted"}`}/>)}</div><Button size="sm" variant="outline" onClick={() => setCurrentSlideIndex(p => Math.min(slides.length-1,p+1))} disabled={currentSlideIndex===slides.length-1}>{t("pres.next")}<ChevronLeft size={14}/></Button></div></div>

      <Card className="rounded-3xl border hairline bg-[var(--panel)]"><CardContent className="p-6 md:p-7 space-y-5"><div className="flex items-center justify-between border-b hairline pb-4"><div className="flex items-center gap-2 text-amber-600 text-xs font-bold uppercase tracking-wider"><Mic size={15}/>Presenter Coach</div><span className="flex items-center gap-1 text-[11px] font-mono font-bold bg-amber-500/10 text-amber-600 px-2.5 py-0.5 rounded-full"><Clock size={12}/>{currentSlide.allocatedTimeSeconds} {t("pres.seconds")}</span></div>
        <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30"><div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">{t("pres.safeScript")}</div><p className="text-xs md:text-sm leading-relaxed font-medium mt-2">{currentSlide.speakerScript}</p><Button size="sm" variant="ghost" className="mt-3" onClick={copyScript}>{copied?<Check size={13} className="text-emerald-500"/>:<Copy size={13}/>} {copied?t("pres.copied"):t("pres.copy")}</Button></div>
        <div className="p-3.5 rounded-xl border hairline bg-[var(--bg)] text-xs text-muted-foreground"><span className="font-bold text-foreground flex items-center gap-1.5"><Sparkles size={13} className="text-amber-500"/>{t("pres.slideGoal")}</span><p className="mt-1 leading-relaxed">{currentSlide.keyTakeaway}</p></div>
        <div className="pt-2 text-xs text-muted-foreground font-mono">{t("pres.totalTime").replace("{minutes}", String(totalMinutes))}</div>
      </CardContent></Card>
    </div>
  </div>;
}

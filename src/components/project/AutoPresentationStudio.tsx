import React, { useMemo, useState } from "react";
import { Presentation, Download, Mic, Clock, Sparkles, ChevronLeft, ChevronRight, Copy, Check, ShieldCheck } from "lucide-react";
import type { ProjectDNA } from "../../types";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { useI18n } from "../../lib/i18n";
import { runtimeEnumLabel } from "../../lib/platform-locale";

interface SlideData { id:number; title:string; subtitle:string; bulletPoints:string[]; allocatedTimeSeconds:number; speakerScript:string; keyTakeaway:string; }

const compact = (values: Array<string | undefined>, max = 4) => [...new Set(values.map(v => String(v || "").trim()).filter(Boolean))].slice(0, max);
const escapeHtml = (value: string) =>
  value.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c] || c);

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
    add(t("pres.requirementsTitle"), t("ui.projectDnaRequirements"), (project.requirements || []).map(r => `${r.label}: ${r.value || t("pres.unspecified")}`), t("pres.scriptRequirements"), t("pres.takeawayRequirements"), 75);
    add(t("pres.outcomesTitle"), t("pres.outcomesSubtitle"), [...(project.learningOutcomes || []), ...(project.requiredActions || [])], t("pres.scriptOutcomes"), t("pres.takeawayOutcomes"), 90);
    add(t("pres.deliverablesTitle"), t("ui.deliverables"), (project.deliverables || []).map(d => `${d.title} — ${d.format || t("pres.unspecifiedFormat")} — ${runtimeEnumLabel(d.status, locale)}`), t("pres.scriptDeliverables"), t("pres.takeawayDeliverables"), 75);
    add(t("pres.rubricTitle"), t("ui.rubricCoverage"), (project.rubric || []).map(r => `${r.title}${r.weighting ? ` (${r.weighting}%)` : ""}${r.readiness ? ` — ${runtimeEnumLabel(r.readiness, locale)}` : ""}`), t("pres.scriptRubric"), t("pres.takeawayRubric"), 90);
    add(t("pres.risksTitle"), t("pres.risksSubtitle"), project.riskFlags || [], t("pres.scriptRisks"), t("pres.takeawayRisks"), 60);
    if (!result.length) result.push({ id:1, title:project.title || t("pres.project"), subtitle:t("pres.waitingDna"), bulletPoints:[t("pres.notEnoughData")], allocatedTimeSeconds:45, speakerScript:t("pres.waitingScript"), keyTakeaway:t("pres.waitingTakeaway") });
    return result;
  }, [project, t, locale]);

  const currentSlide = slides[Math.min(currentSlideIndex, slides.length - 1)];
  const totalMinutes = Math.ceil(slides.reduce((acc, s) => acc + s.allocatedTimeSeconds, 0) / 60);
  const copyScript = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable");
      await navigator.clipboard.writeText(currentSlide.speakerScript);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      console.error("Failed to copy presentation script", e);
    }
  };

  const exportDeck = () => {
    // Print-ready 16:9 deck. The font stack covers all eight launch scripts
    // (Arial alone renders Arabic, CJK, Devanagari and Urdu poorly), the palette
    // follows the product brand, and slide numbers/notes survive the print path.
    const sections = slides
      .map(
        (s, index) =>
          `<section class="slide"><header><span class="eyebrow">${escapeHtml(project.course || project.academicDomain || "AcademicOS")}</span><span class="page">${index + 1} / ${slides.length}</span></header>` +
          `<div class="body"><h1>${escapeHtml(s.title)}</h1>${s.subtitle ? `<h2>${escapeHtml(s.subtitle)}</h2>` : ""}<ul>${s.bulletPoints.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul></div>` +
          `<footer><span>${escapeHtml(project.title)}</span><span>${escapeHtml(s.keyTakeaway)}</span></footer>` +
          `<div class="notes"><strong>${escapeHtml(t("pres.presenterNotes"))} · ${s.allocatedTimeSeconds}s</strong><p>${escapeHtml(s.speakerScript)}</p></div></section>`,
      )
      .join("");
    const html = `<!doctype html><html lang="${locale}" dir="${meta.dir}"><meta charset="utf-8"><title>${escapeHtml(project.title)} · ${escapeHtml(t("pres.title"))}</title><style>
@page{size:1600px 900px;margin:0}
*{box-sizing:border-box}
body{margin:0;background:#0b1310;color:#f3f7f4;text-align:start;
  font-family:"Noto Sans","Noto Sans Arabic","Noto Sans SC","Noto Sans Devanagari","Noto Nastaliq Urdu",-apple-system,"Segoe UI",Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;line-height:1.5}
.slide{position:relative;width:100vw;min-height:100vh;padding:7vh 7vw 9vh;page-break-after:always;
  display:flex;flex-direction:column;justify-content:space-between;
  background:radial-gradient(120vw 80vh at 85% -20%,rgba(12,93,73,.55),transparent 60%),linear-gradient(135deg,#0b1310,#111c17)}
.slide::after{content:"";position:absolute;inset-block-start:0;inset-inline:0;height:6px;background:linear-gradient(90deg,#79c5a7,#d3a56d)}
header{display:flex;align-items:center;justify-content:space-between;gap:24px;
  padding-bottom:20px;border-bottom:1px solid rgba(243,247,244,.14)}
.eyebrow{color:#d3a56d;font-weight:700;letter-spacing:.13em;text-transform:uppercase;font-size:.85rem}
.page{color:rgba(243,247,244,.5);font-size:.85rem;font-variant-numeric:tabular-nums}
.body{flex:1;display:flex;flex-direction:column;justify-content:center;padding-block:4vh}
h1{font-size:clamp(2.2rem,4.4vw,3.6rem);line-height:1.1;letter-spacing:-.03em;margin:0 0 .6rem;text-wrap:balance}
h2{color:#79c5a7;font-size:clamp(1rem,1.5vw,1.35rem);font-weight:500;margin:0 0 2.2rem}
ul{margin:0;padding:0;list-style:none;display:grid;gap:1rem}
li{position:relative;padding-inline-start:1.9rem;font-size:clamp(1.05rem,1.6vw,1.5rem);line-height:1.6;color:rgba(243,247,244,.92)}
li::before{content:"";position:absolute;inset-inline-start:0;top:.62em;width:.62rem;height:.62rem;border-radius:50%;background:#79c5a7}
footer{display:flex;align-items:center;justify-content:space-between;gap:24px;
  padding-top:18px;border-top:1px solid rgba(243,247,244,.14);color:rgba(243,247,244,.55);font-size:.85rem}
.notes{margin-top:2.4rem;padding:1.1rem 1.3rem;border:1px solid rgba(243,247,244,.16);border-radius:18px;
  color:rgba(243,247,244,.78);font-size:.95rem}
.notes strong{display:block;margin-bottom:.4rem;color:#d3a56d;letter-spacing:.06em;text-transform:uppercase;font-size:.75rem}
.notes p{margin:0}
@media print{body{background:#0b1310}.notes{display:none}.slide{height:100vh;min-height:0}}
</style><body>${sections}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.title || "academicos"}-presentation.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return <div className="space-y-6">
    <div className="rounded-2xl border hairline bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5"><div className="h-11 w-11 rounded-2xl bg-amber-500/20 text-amber-600 grid place-items-center shrink-0"><Presentation size={22}/></div><div><div className="flex items-center gap-2 flex-wrap"><span className="text-[10px] font-bold tracking-wider uppercase text-amber-600">{t("ui.evidenceBoundPresentation")}</span><span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-700 font-semibold border border-amber-500/20">{t("ui.projectDnaOnly")}</span></div><h2 className="text-lg md:text-xl font-bold tracking-tight mt-0.5">{t("pres.title")}</h2><p className="text-xs text-muted-foreground mt-1">{t("pres.description")}</p></div></div>
      <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={exportDeck}><Download size={13}/>{t("pres.export")}</Button>
    </div>

    <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
      <div className="space-y-4"><div className="rounded-3xl border-2 hairline bg-gradient-to-br from-zinc-900 via-zinc-950 to-black text-white p-8 md:p-10 shadow-2xl min-h-[360px] flex flex-col justify-between">
        <div><div className="flex items-center justify-between text-[11px] text-zinc-400 pb-4 border-b border-zinc-800"><span className="font-bold tracking-wider uppercase text-amber-400">{project.academicDomain || t("pres.project")}</span><span className="font-mono">{currentSlide.id} / {slides.length}</span></div><h2 className="text-xl md:text-2xl font-bold mt-5">{currentSlide.title}</h2><p className="text-xs text-amber-300/80 mt-1">{currentSlide.subtitle}</p></div>
        <div className="space-y-3 py-6">{currentSlide.bulletPoints.map((point,i) => <div key={i} className="flex items-start gap-3 text-xs md:text-sm text-zinc-200"><span className="h-2 w-2 rounded-full bg-amber-400 mt-2 shrink-0"/><span className="leading-relaxed">{point}</span></div>)}</div>
        <div className="flex items-center justify-between pt-4 border-t border-zinc-800 text-[10px] text-zinc-400 font-mono"><span>{project.course}</span><span className="flex items-center gap-1"><ShieldCheck size={11}/>{t("pres.bound")}</span></div>
      </div>
      <div className="flex items-center justify-between p-3 rounded-2xl border hairline bg-[var(--panel)]"><Button size="sm" variant="outline" onClick={() => setCurrentSlideIndex(p => Math.max(0,p-1))} disabled={currentSlideIndex===0}><ChevronLeft size={14} className="directional-icon"/>{t("pres.previous")}</Button><div className="flex gap-1.5">{slides.map((s,idx)=><button key={s.id} onClick={()=>setCurrentSlideIndex(idx)} className={`h-2.5 rounded-full ${currentSlideIndex===idx?"w-7 bg-amber-500":"w-2.5 bg-muted"}`}/>)}</div><Button size="sm" variant="outline" onClick={() => setCurrentSlideIndex(p => Math.min(slides.length-1,p+1))} disabled={currentSlideIndex===slides.length-1}>{t("pres.next")}<ChevronRight size={14} className="directional-icon"/></Button></div></div>

      <Card className="rounded-3xl border hairline bg-[var(--panel)]"><CardContent className="p-6 md:p-7 space-y-5"><div className="flex items-center justify-between border-b hairline pb-4"><div className="flex items-center gap-2 text-amber-600 text-xs font-bold uppercase tracking-wider"><Mic size={15}/>{t("ui.presenterCoach")}</div><span className="flex items-center gap-1 text-[11px] font-mono font-bold bg-amber-500/10 text-amber-600 px-2.5 py-0.5 rounded-full"><Clock size={12}/>{currentSlide.allocatedTimeSeconds} {t("pres.seconds")}</span></div>
        <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30"><div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">{t("pres.safeScript")}</div><p className="text-xs md:text-sm leading-relaxed font-medium mt-2">{currentSlide.speakerScript}</p><Button size="sm" variant="ghost" className="mt-3" onClick={copyScript}>{copied?<Check size={13} className="text-emerald-500"/>:<Copy size={13}/>} {copied?t("pres.copied"):t("pres.copy")}</Button></div>
        <div className="p-3.5 rounded-xl border hairline bg-[var(--bg)] text-xs text-muted-foreground"><span className="font-bold text-foreground flex items-center gap-1.5"><Sparkles size={13} className="text-amber-500"/>{t("pres.slideGoal")}</span><p className="mt-1 leading-relaxed">{currentSlide.keyTakeaway}</p></div>
        <div className="pt-2 text-xs text-muted-foreground font-mono">{t("pres.totalTime").replace("{minutes}", String(totalMinutes))}</div>
      </CardContent></Card>
    </div>
  </div>;
}

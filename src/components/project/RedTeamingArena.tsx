import React, { useMemo, useState } from "react";
import { ShieldAlert, Flame, Zap, CheckCircle2, AlertTriangle, Sparkles, ShieldCheck, RefreshCw, BrainCircuit } from "lucide-react";
import type { ProjectDNA } from "../../types";
import { api } from "../../lib/api";
import { Button } from "../ui/button";
import { useI18n } from "../../lib/i18n";

interface CounterArgument {
  id: string;
  category: "methodology" | "sampling" | "generalizability" | "theoretical" | "requirements" | "evidence";
  challengeTitle: string;
  critiqueText: string;
  suggestedDefense: string;
  defenseStatus: "unaddressed" | "addressed" | "strong";
  origin: "project_dna" | "ai_review";
}

function projectBoundChallenges(project: ProjectDNA, t: (key: string) => string): CounterArgument[] {
  const items: CounterArgument[] = [];
  (project.riskFlags || []).slice(0, 3).forEach((risk, i) => items.push({ id:`risk-${i}`, category:"requirements", challengeTitle:t("red.recordedRisk"), critiqueText:risk, suggestedDefense:t("red.defenseRisk"), defenseStatus:"unaddressed", origin:"project_dna" }));
  (project.rubric || []).filter(r => r.readiness && r.readiness !== "covered").slice(0, 3).forEach((r, i) => items.push({ id:`rubric-${r.id || i}`, category:"evidence", challengeTitle:`${t("red.proveCriterion")}: ${r.title}?`, critiqueText:r.description || t("red.criterionGap"), suggestedDefense:t("red.defenseEvidence"), defenseStatus:r.readiness === "partial" ? "addressed" : "unaddressed", origin:"project_dna" }));
  (project.requirements || []).filter(r => r.confidence !== "high").slice(0, 2).forEach((r, i) => items.push({ id:`req-${r.id || i}`, category:"requirements", challengeTitle:`${t("red.requirementCertain")} ${r.label}`, critiqueText:`${t("red.recordedValue")}: ${r.value || t("red.unspecified")}. ${t("red.lowConfidence")}${r.source ? ` · ${t("red.source")}: ${r.source}` : ""}.`, suggestedDefense:t("red.defenseRequirement"), defenseStatus:"unaddressed", origin:"project_dna" }));
  if (!(project.sourceRequirements || []).length && (project.workspaceModules || []).includes("research")) items.push({ id:"source-gap", category:"evidence", challengeTitle:t("red.sourceStandard"), critiqueText:t("red.sourceGap"), suggestedDefense:t("red.defenseSources"), defenseStatus:"unaddressed", origin:"project_dna" });
  if (!items.length) items.push({ id:"clean-start", category:"requirements", challengeTitle:t("red.noConfirmedGap"), critiqueText:t("red.noConfirmedGapDesc"), suggestedDefense:t("red.runStress"), defenseStatus:"addressed", origin:"project_dna" });
  return items;
}

export function RedTeamingArena({ project }: { project: ProjectDNA }) {
  const { t } = useI18n();
  const [analyzing, setAnalyzing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [error, setError] = useState("");
  const [argumentsList, setArgumentsList] = useState<CounterArgument[]>(() => projectBoundChallenges(project, t));

  const handleSimulateAttack = async () => {
    setAnalyzing(true); setError("");
    try {
      const result = await api.redTeam(project.id);
      const generated: CounterArgument[] = result.challenges.map((item, i) => ({ ...item, id:`ai-${Date.now()}-${i}`, defenseStatus:"unaddressed" as const, origin:"ai_review" as const }));
      setArgumentsList(generated.length ? generated : projectBoundChallenges(project, t));
    } catch (e: any) {
      setError(e?.message || t("red.error"));
      setArgumentsList(projectBoundChallenges(project, t));
    } finally { setAnalyzing(false); }
  };

  const toggleStatus = (id: string) => setArgumentsList(prev => prev.map(item => item.id === id ? { ...item, defenseStatus: item.defenseStatus === "unaddressed" ? "addressed" : item.defenseStatus === "addressed" ? "strong" : "unaddressed" } : item));
  const categories = useMemo(() => [...new Set(argumentsList.map(x => x.category))], [argumentsList]);
  const labels: Record<string,string> = { methodology:t("red.cat.methodology"), sampling:t("red.cat.sampling"), generalizability:t("red.cat.generalizability"), theoretical:t("red.cat.theoretical"), requirements:t("red.cat.requirements"), evidence:t("red.cat.evidence") };
  const filtered = activeCategory === "all" ? argumentsList : argumentsList.filter(a => a.category === activeCategory);

  return <div className="space-y-6">
    <div className="rounded-2xl border hairline bg-gradient-to-r from-red-500/10 via-rose-500/5 to-transparent p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center gap-3.5"><div className="h-11 w-11 rounded-2xl bg-red-500/20 text-red-600 grid place-items-center shrink-0"><Flame size={22}/></div><div><div className="flex items-center gap-2 flex-wrap"><span className="text-[10px] font-bold tracking-wider uppercase text-red-600">Evidence-bound Red Team</span><span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/15 text-red-700 font-semibold border border-red-500/20">{t("red.badge")}</span></div><h2 className="text-lg md:text-xl font-bold tracking-tight mt-0.5">{t("red.title")}</h2><p className="text-xs text-muted-foreground mt-1 max-w-2xl">{t("red.description")}</p></div></div>
      <Button onClick={handleSimulateAttack} disabled={analyzing} className="bg-red-600 hover:bg-red-700 text-white gap-2 shrink-0">{analyzing ? <RefreshCw size={15} className="animate-spin"/> : <Zap size={15}/>} {analyzing ? t("red.analyzing") : t("red.attack")}</Button>
    </div>
    {error && <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">{error}</div>}
    <div className="flex gap-2 flex-wrap text-xs"><button onClick={() => setActiveCategory("all")} className={`px-3 py-1.5 rounded-xl border hairline ${activeCategory === "all" ? "bg-red-600 text-white border-red-600 font-semibold" : "bg-[var(--panel)] text-muted-foreground"}`}>{t("red.all")} ({argumentsList.length})</button>{categories.map(cat => <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-3 py-1.5 rounded-xl border hairline ${activeCategory === cat ? "bg-red-600 text-white border-red-600 font-semibold" : "bg-[var(--panel)] text-muted-foreground"}`}>{labels[cat] || cat}</button>)}</div>
    <div className="space-y-4">{filtered.map(item => <div key={item.id} className="rounded-2xl border hairline bg-[var(--panel)] p-5 space-y-4 hover:border-red-500/30 transition-colors">
      <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-2"><span className="h-7 w-7 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600 grid place-items-center shrink-0"><ShieldAlert size={16}/></span><div><h3 className="font-bold text-sm">{item.challengeTitle}</h3><span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">{item.origin === "ai_review" ? <BrainCircuit size={11}/> : <ShieldCheck size={11}/>} {item.origin === "ai_review" ? t("red.originAi") : t("red.originDna")}</span></div></div>
        <button onClick={() => toggleStatus(item.id)} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 ${item.defenseStatus === "strong" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : item.defenseStatus === "addressed" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"}`}>{item.defenseStatus === "strong" ? <><CheckCircle2 size={12}/>{t("red.closed")}</> : item.defenseStatus === "addressed" ? <><ShieldCheck size={12}/>{t("red.addressed")}</> : <><AlertTriangle size={12}/>{t("red.open")}</>}</button></div>
      <div className="p-3.5 rounded-xl bg-red-50/40 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-xs leading-relaxed"><span className="font-bold block mb-1">{t("red.critique")}:</span>{item.critiqueText}</div>
      <div className="p-3.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-xs leading-relaxed"><span className="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 mb-1"><Sparkles size={13}/>{t("red.defense")}:</span>{item.suggestedDefense}</div>
    </div>)}</div>
  </div>;
}

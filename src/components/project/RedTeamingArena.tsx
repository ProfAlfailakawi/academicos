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

  return <div className="space-y-6" data-tone="danger">
    <div className="studio-head">
      <div className="flex items-center gap-3.5 min-w-0">
        <span className="tone-tile h-11 w-11"><Flame size={22}/></span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="eyebrow tone-text">{t("ui.evidenceBoundRedTeam")}</span>
            <span className="tone-chip">{t("red.badge")}</span>
          </div>
          <h2 className="studio-head__title">{t("red.title")}</h2>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">{t("red.description")}</p>
        </div>
      </div>
      <Button variant="danger" onClick={handleSimulateAttack} disabled={analyzing} className="shrink-0">
        {analyzing ? <RefreshCw size={15} className="animate-spin"/> : <Zap size={15}/>}
        {analyzing ? t("red.analyzing") : t("red.attack")}
      </Button>
    </div>

    {error && <div className="note" data-tone="warning" role="alert"><AlertTriangle size={15}/><span>{error}</span></div>}

    <div className="segmented">
      <button aria-pressed={activeCategory === "all"} onClick={() => setActiveCategory("all")}>
        {t("red.all")} <span className="mono-number opacity-70">({argumentsList.length})</span>
      </button>
      {categories.map(cat => <button key={cat} aria-pressed={activeCategory === cat} onClick={() => setActiveCategory(cat)}>{labels[cat] || cat}</button>)}
    </div>

    <div className="space-y-4">{filtered.map(item => {
      const tone = item.defenseStatus === "strong" ? "success" : item.defenseStatus === "addressed" ? "info" : "danger";
      return <div key={item.id} className="academic-card panel-flat p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="tone-tile h-8 w-8 rounded-lg"><ShieldAlert size={16}/></span>
            <div className="min-w-0">
              <h3 className="font-bold text-sm leading-snug">{item.challengeTitle}</h3>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                {item.origin === "ai_review" ? <BrainCircuit size={11}/> : <ShieldCheck size={11}/>}
                {item.origin === "ai_review" ? t("red.originAi") : t("red.originDna")}
              </span>
            </div>
          </div>
          <button onClick={() => toggleStatus(item.id)} className="tone-chip focus-ring shrink-0" data-tone={tone}>
            {item.defenseStatus === "strong" ? <><CheckCircle2 size={12}/>{t("red.closed")}</> : item.defenseStatus === "addressed" ? <><ShieldCheck size={12}/>{t("red.addressed")}</> : <><AlertTriangle size={12}/>{t("red.open")}</>}
          </button>
        </div>
        <div className="note" data-tone="danger">
          <ShieldAlert size={15}/>
          <span><strong className="block mb-1">{t("red.critique")}</strong>{item.critiqueText}</span>
        </div>
        <div className="note" data-tone="success">
          <Sparkles size={15}/>
          <span><strong className="block mb-1">{t("red.defense")}</strong>{item.suggestedDefense}</span>
        </div>
      </div>;
    })}</div>
  </div>;
}

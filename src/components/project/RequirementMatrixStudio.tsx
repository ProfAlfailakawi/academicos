import React, { useMemo, useState } from "react";
import { ListChecks, CheckCircle2, AlertCircle, HelpCircle, Target, FileSearch } from "lucide-react";
import type { ProjectDNA, Requirement } from "../../types";
import { useI18n } from "../../lib/i18n";

export function RequirementMatrixStudio({ project }: { project: ProjectDNA }) {
  const { t } = useI18n();
  const categoryLabel = (category: Requirement["category"]) => t(`req.category.${category}`);
  const confidenceLabel = (confidence: Requirement["confidence"]) => t(`req.confidence.${confidence}`);
  const [filter, setFilter] = useState<"all" | Requirement["category"] | "rubric">("all");
  const requirements = project.requirements || [];
  const rubric = project.rubric || [];
  const rubricCovered = rubric.filter((item) => item.readiness === "covered").length;
  const rubricPartial = rubric.filter((item) => item.readiness === "partial" || item.readiness === "needs_revision").length;
  const rubricUnknown = rubric.filter((item) => !item.readiness || item.readiness === "not_evidenced").length;
  const visibleRequirements = useMemo(
    () => requirements.filter((item) => filter === "all" || (filter !== "rubric" && item.category === filter)),
    [filter, requirements],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border hairline bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-transparent p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-violet-500/20 text-violet-600 dark:text-violet-400 grid place-items-center shrink-0"><ListChecks size={22} /></div>
          <div>
            <div className="text-[10px] font-bold tracking-wider uppercase text-violet-600 dark:text-violet-400">Requirement Truth Matrix</div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight mt-0.5">{t("req.title")}</h2>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-2xl leading-5">{t("req.description")}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 min-w-[220px]">
          <div className="rounded-xl border hairline bg-[var(--panel)] p-3"><div className="text-[10px] text-muted-foreground">{t("req.extracted")}</div><div className="text-xl font-bold font-mono text-violet-600">{requirements.length}</div></div>
          <div className="rounded-xl border hairline bg-[var(--panel)] p-3"><div className="text-[10px] text-muted-foreground">{t("req.rubricCriteria")}</div><div className="text-xl font-bold font-mono text-violet-600">{rubric.length}</div></div>
        </div>
      </div>

      <div className="flex gap-2 text-xs flex-wrap">
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>{t("req.all")} ({requirements.length})</FilterButton>
        {(["format", "content", "source", "deadline", "submission", "policy"] as Requirement["category"][]).map((category) => {
          const count = requirements.filter((item) => item.category === category).length;
          return count ? <FilterButton key={category} active={filter === category} onClick={() => setFilter(category)}>{categoryLabel(category)} ({count})</FilterButton> : null;
        })}
        <FilterButton active={filter === "rubric"} onClick={() => setFilter("rubric")}>Rubric ({rubric.length})</FilterButton>
      </div>

      {filter !== "rubric" && (
        <div className="space-y-3.5">
          {visibleRequirements.length ? visibleRequirements.map((item) => (
            <div key={item.id} className="rounded-2xl border hairline bg-[var(--panel)] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="h-6 w-6 rounded-lg bg-violet-500/10 text-violet-600 grid place-items-center"><FileSearch size={14} /></span>
                  <h3 className="text-sm font-bold">{item.label}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground">{categoryLabel(item.category)}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-6 md:pr-8 whitespace-pre-wrap">{item.value || t("req.noDetail")}</p>
                {item.source && <p className="text-[10px] text-muted-foreground">{t("req.source")}: {item.source}</p>}
              </div>
              <Confidence confidence={item.confidence} label={confidenceLabel(item.confidence)} />
            </div>
          )) : (
            <Empty text={requirements.length ? t("req.emptyCategory") : t("req.emptyAll")} />
          )}
        </div>
      )}

      {filter === "rubric" && (
        <div className="space-y-4">
          {rubric.length > 0 && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <Metric label={t("req.covered")} value={rubricCovered} />
              <Metric label={t("req.partial")} value={rubricPartial} />
              <Metric label={t("req.unknown")} value={rubricUnknown} />
            </div>
          )}
          {rubric.length ? rubric.map((item) => {
            const state = item.readiness || "not_evidenced";
            return (
              <div key={item.id} className="rounded-2xl border hairline bg-[var(--panel)] p-5 flex flex-col md:flex-row items-start justify-between gap-4">
                <div className="min-w-0"><div className="flex items-center gap-2"><Target size={15} className="text-violet-600"/><h3 className="text-sm font-bold">{item.title}</h3>{item.weighting > 0 && <span className="text-[10px] text-muted-foreground">{item.weighting}%</span>}</div><p className="text-xs text-muted-foreground leading-6 mt-2">{item.description || t("req.noRubricDescription")}</p></div>
                <RubricState value={state} label={state === "covered" ? t("req.covered") : state === "partial" ? t("req.partialCoverage") : state === "needs_revision" ? t("req.needsReview") : t("req.unknown")} />
              </div>
            );
          }) : <Empty text={t("req.noRubric")} />}
        </div>
      )}
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`px-3 py-1.5 rounded-xl border hairline transition-colors ${active ? "bg-violet-600 text-white border-violet-600 font-semibold" : "bg-[var(--panel)] text-muted-foreground"}`}>{children}</button>;
}
function Confidence({ confidence, label }: { confidence: Requirement["confidence"]; label: string }) {
  const strong = confidence === "high", uncertain = confidence === "needs_confirmation";
  return <span className={`px-3 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 shrink-0 ${strong ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : uncertain ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-violet-500/10 text-violet-600 border-violet-500/20"}`}>{strong ? <CheckCircle2 size={13}/> : uncertain ? <HelpCircle size={13}/> : <AlertCircle size={13}/>} {label}</span>;
}
function RubricState({ value, label }: { value: string; label: string }) {
  const good = value === "covered";
  return <span className={`px-3 py-1 rounded-full text-[11px] font-semibold border shrink-0 ${good ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}>{label}</span>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border hairline bg-[var(--panel)] p-3"><div className="font-bold text-lg">{value}</div><div className="text-[10px] text-muted-foreground mt-1">{label}</div></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border hairline bg-[var(--panel)] p-8 text-center text-xs text-muted-foreground leading-6">{text}</div>; }

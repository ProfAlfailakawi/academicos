import React, { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, CircleDashed, FileText, ListPlus, Paperclip } from "lucide-react";
import type { ProjectDNA, RubricDrilldown, RubricDrilldownCriterion } from "../../types";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { localizedUiError } from "../../lib/ui-error";
import { Button } from "../ui/button";
import { InlineLoader } from "../ui/AcademicLoader";

/** Loads the rubric drill-down and exposes the "create what's-missing task" action. */
export function useRubricDrilldown(project: ProjectDNA, onProjectChange?: (project: ProjectDNA) => void) {
  const { t } = useI18n();
  const [drilldown, setDrilldown] = useState<RubricDrilldown | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const reload = useCallback(() => {
    api
      .rubricDrilldown(project.id)
      .then((r) => setDrilldown(r.drilldown))
      .catch((e) => setError(localizedUiError(e, t, "drill.loadError")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.revision]);
  useEffect(reload, [reload]);

  const createTask = useCallback(
    async (criterion: RubricDrilldownCriterion) => {
      setBusyId(criterion.rubricId);
      setError("");
      try {
        const r = await api.createRubricGapTask(project.id, criterion.rubricId);
        onProjectChange?.(r.project);
        reload();
      } catch (e) {
        setError(localizedUiError(e, t, "drill.taskError"));
      } finally {
        setBusyId("");
      }
    },
    [project.id, onProjectChange, reload, t],
  );

  return { drilldown, error, busyId, createTask, byId: (id: string) => drilldown?.criteria.find((c) => c.rubricId === id) };
}

/** Per-criterion drill-down: linked workspace items, evidence, gaps and the gap-task action. */
export function RubricCriterionDrilldown({
  criterion,
  busy,
  onCreateTask,
  onOpenWorkspace,
}: {
  criterion: RubricDrilldownCriterion;
  busy?: boolean;
  onCreateTask: (criterion: RubricDrilldownCriterion) => void;
  onOpenWorkspace?: (target: "writer" | "evidence" | "plan") => void;
}) {
  const { t, formatNumber } = useI18n();
  const taskOpen = criterion.gapTaskStatus && criterion.gapTaskStatus !== "completed";
  return (
    <div className="mt-3 rounded-xl border hairline bg-[var(--bg)] p-3 space-y-3 w-full">
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        <div>
          <div className="font-semibold flex items-center gap-1.5"><FileText size={13} className="brand-text" />{t("drill.linkedItems")}</div>
          {criterion.artifacts.length ? (
            <ul className="mt-1 space-y-1">
              {criterion.artifacts.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2"><bdi className="truncate">{item.title}</bdi><span className="muted shrink-0">{t(`drill.status.${item.status}`)}</span></li>
              ))}
            </ul>
          ) : <p className="muted mt-1">{t("drill.none")}</p>}
        </div>
        <div>
          <div className="font-semibold flex items-center gap-1.5"><Paperclip size={13} className="brand-text" />{t("drill.linkedEvidence")}</div>
          {criterion.evidence.length ? (
            <ul className="mt-1 space-y-1">
              {criterion.evidence.map((item) => <li key={item.id}><bdi>{item.title}</bdi></li>)}
            </ul>
          ) : <p className="muted mt-1">{t("drill.none")}</p>}
        </div>
      </div>
      {criterion.missing.length > 0 ? (
        <div>
          <div className="text-xs font-semibold flex items-center gap-1.5">
            <CircleDashed size={13} className="text-warning" />{t("drill.missing")}
            {criterion.weightAtRisk > 0 && <span className="muted font-normal">· {t("drill.weightAtRisk").replace("{w}", formatNumber(criterion.weightAtRisk))}</span>}
          </div>
          <ul className="mt-1 space-y-1 text-sm leading-7">
            {criterion.missingText.map((text) => <li key={text} className="flex gap-2"><span aria-hidden="true">•</span><span>{text}</span></li>)}
          </ul>
          <div className="flex flex-wrap gap-2 mt-2">
            <Button size="sm" onClick={() => onCreateTask(criterion)} disabled={busy}>
              {busy ? <InlineLoader size={14} /> : <ListPlus size={14} />}
              {taskOpen ? t("drill.refreshTask") : t("drill.createTask")}
            </Button>
            {onOpenWorkspace && criterion.missing.includes("no_workspace_item") && (
              <Button size="sm" variant="outline" onClick={() => onOpenWorkspace("writer")}>{t("drill.openWriter")}<ArrowRight size={13} className="directional-icon" /></Button>
            )}
            {onOpenWorkspace && criterion.missing.includes("no_evidence") && (
              <Button size="sm" variant="outline" onClick={() => onOpenWorkspace("evidence")}>{t("drill.openEvidence")}<ArrowRight size={13} className="directional-icon" /></Button>
            )}
            {onOpenWorkspace && taskOpen && (
              <Button size="sm" variant="ghost" onClick={() => onOpenWorkspace("plan")}>{t("drill.openPlan")}</Button>
            )}
          </div>
          {taskOpen && <p className="text-xs brand-text mt-2">{t("drill.taskQueued")}</p>}
        </div>
      ) : (
        <div className="text-xs font-semibold flex items-center gap-1.5 text-success"><CheckCircle2 size={13} />{t("drill.complete")}</div>
      )}
    </div>
  );
}

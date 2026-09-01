import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Braces,
  Calculator,
  Check,
  ClipboardList,
  FlaskConical,
  History,
  Image,
  Layers3,
  LoaderCircle,
  Mic2,
  PenLine,
  Presentation,
  RotateCcw,
  Save,
  Shapes,
  Table2,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { api } from "../../lib/api";
import type {
  ProjectDNA,
  WorkspaceArtifact,
  WorkspaceArtifactVersion,
  WorkspaceModule,
} from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { useI18n } from "../../lib/i18n";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

const configs: Record<
  WorkspaceModule,
  {
    name: string;
    description: string;
    kind: string;
    placeholder: string;
    icon: React.ElementType;
  }
> = {
  research: {
    name: "Research Studio",
    description: "studio.research.desc",
    kind: "research-note",
    placeholder: "studio.research.ph",
    icon: BookOpen,
  },
  writing: {
    name: "Writing Studio",
    description: "studio.writing.desc",
    kind: "document-section",
    placeholder: "studio.writing.ph",
    icon: PenLine,
  },
  data: {
    name: "Data Lab",
    description: "studio.data.desc",
    kind: "analysis-note",
    placeholder: "studio.data.ph",
    icon: BarChart3,
  },
  spreadsheet: {
    name: "Spreadsheet Studio",
    description: "studio.spreadsheet.desc",
    kind: "spreadsheet-check",
    placeholder: "studio.spreadsheet.ph",
    icon: Table2,
  },
  code: {
    name: "Code Lab",
    description: "studio.code.desc",
    kind: "code-note",
    placeholder: "studio.code.ph",
    icon: Braces,
  },
  engineering: {
    name: "Engineering Studio",
    description: "studio.engineering.desc",
    kind: "engineering-decision",
    placeholder: "studio.engineering.ph",
    icon: Calculator,
  },
  lab: {
    name: "Lab Notebook",
    description: "studio.lab.desc",
    kind: "lab-entry",
    placeholder: "studio.lab.ph",
    icon: FlaskConical,
  },
  design: {
    name: "Design Board",
    description: "studio.design.desc",
    kind: "design-decision",
    placeholder: "studio.design.ph",
    icon: Shapes,
  },
  media: {
    name: "Media Studio",
    description: "studio.media.desc",
    kind: "media-plan",
    placeholder: "studio.media.ph",
    icon: Image,
  },
  presentation: {
    name: "Presentation Studio",
    description: "studio.presentation.desc",
    kind: "slide-outline",
    placeholder: "studio.presentation.ph",
    icon: Presentation,
  },
  portfolio: {
    name: "Portfolio Studio",
    description: "studio.portfolio.desc",
    kind: "portfolio-item",
    placeholder: "studio.portfolio.ph",
    icon: Layers3,
  },
  survey: {
    name: "Survey Studio",
    description: "studio.survey.desc",
    kind: "survey-item",
    placeholder: "studio.survey.ph",
    icon: ClipboardList,
  },
  team: {
    name: "Team Studio",
    description: "studio.team.desc",
    kind: "team-item",
    placeholder: "",
    icon: Layers3,
  },
  simulation: {
    name: "Simulation Studio",
    description: "studio.simulation.desc",
    kind: "simulation-run",
    placeholder: "studio.simulation.ph",
    icon: WandSparkles,
  },
  viva: {
    name: "Viva Studio",
    description: "studio.viva.desc",
    kind: "viva-item",
    placeholder: "",
    icon: Mic2,
  },
};

type FormState = {
  title: string;
  content: string;
  status: WorkspaceArtifact["status"];
  deliverableId: string;
  rubricIds: string[];
  isCanonical: boolean;
};
type FacultyResult = {
  runId: string;
  agent: string;
  taskType: string;
  contextUsed: string[];
  output: {
    summary: string;
    findings: string[];
    suggestions: string[];
    warnings: string[];
  };
  disclosureRequired: boolean;
};
const empty: FormState = {
  title: "",
  content: "",
  status: "draft",
  deliverableId: "",
  rubricIds: [],
  isCanonical: false,
};

export function WorkspaceStudios({ project }: { project: ProjectDNA }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const modules = useMemo(
    () => project.workspaceModules.filter((m) => m !== "team" && m !== "viva"),
    [project.workspaceModules],
  );
  const [selected, setSelected] = useState<WorkspaceModule>(
    modules[0] || "writing",
  );
  const [items, setItems] = useState<WorkspaceArtifact[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [versions, setVersions] = useState<WorkspaceArtifactVersion[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [facultyBusy, setFacultyBusy] = useState(false);
  const [faculty, setFaculty] = useState<FacultyResult | null>(null);
  const [facultyFeedback, setFacultyFeedback] = useState("");
  const [autosaveState, setAutosaveState] = useState<
    "saved" | "saving" | "offline"
  >("saved");
  useEffect(() => {
    setLoading(true);
    api
      .artifacts(project.id, showDeleted)
      .then((r) => setItems(r.artifacts))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [project.id, showDeleted]);
  useEffect(() => {
    if (!modules.includes(selected as any) && modules[0])
      setSelected(modules[0]);
  }, [modules, selected]);
  const draftKey = (id: string) =>
    `academicos:draft:${user?.id || "anonymous"}:${project.id}:${selected}:${id}`;
  useEffect(() => {
    if (!editing) return;
    setAutosaveState(navigator.onLine ? "saving" : "offline");
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          draftKey(editing),
          JSON.stringify({ form, savedAt: new Date().toISOString() }),
        );
        setAutosaveState(navigator.onLine ? "saved" : "offline");
      } catch {
        setAutosaveState("offline");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [editing, form, selected, project.id, user?.id]);
  const config = configs[selected as keyof typeof configs];
  const EmptyIcon = config.icon;
  const visible = items.filter(
    (x) =>
      x.module === selected &&
      (showDeleted ? Boolean(x.deletedAt) : !x.deletedAt),
  );
  function begin(item?: WorkspaceArtifact) {
    const id = item?.id || "new";
    const fallback = item
      ? {
          title: item.title,
          content: item.content,
          status: item.status,
          deliverableId: item.deliverableId || "",
          rubricIds: item.rubricIds || [],
          isCanonical: Boolean(item.isCanonical),
        }
      : empty;
    let next = fallback;
    try {
      const raw = localStorage.getItem(draftKey(id));
      if (raw) {
        const saved = JSON.parse(raw);
        const newer =
          !item ||
          new Date(String(saved?.savedAt || 0)).getTime() >
            new Date(item.updatedAt).getTime();
        if (newer && saved?.form) next = saved.form;
      }
    } catch {}
    setEditing(id);
    setForm(next);
    setVersions([]);
    setFaculty(null);
    setFacultyFeedback("");
    setAutosaveState(navigator.onLine ? "saved" : "offline");
    setError("");
    if (item) {
      setHistoryLoading(true);
      api
        .artifactVersions(project.id, item.id)
        .then((r) => setVersions(r.versions))
        .catch((e) => setError(e.message))
        .finally(() => setHistoryLoading(false));
    }
  }
  function toggleRubric(id: string) {
    setForm((v) => ({
      ...v,
      rubricIds: v.rubricIds.includes(id)
        ? v.rubricIds.filter((x) => x !== id)
        : [...v.rubricIds, id],
    }));
  }
  async function save() {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      const body = {
        module: selected,
        kind: config.kind,
        title: form.title.trim(),
        content: form.content,
        status: form.status,
        deliverableId: form.deliverableId || undefined,
        rubricIds: form.rubricIds,
        isCanonical: form.isCanonical,
      };
      if (editing && editing !== "new") {
        let propagateArtifactIds: string[] = [];
        const current = items.find((x) => x.id === editing);
        if (
          current?.isCanonical &&
          form.isCanonical &&
          current.content !== form.content
        ) {
          const preview = await api.twinImpact(
            project.id,
            editing,
            form.content,
          );
          const exact = preview.impact.filter((x) => x.exactReplacePossible);
          if (
            exact.length &&
            window.confirm(
              t("studio.twinImpactConfirm")
                .replace("{count}", String(preview.impact.length))
                .replace("{exact}", String(exact.length)),
            )
          )
            propagateArtifactIds = exact.map((x) => x.id);
        }
        const r = await api.updateArtifact(project.id, editing, {
          ...body,
          deliverableId: form.deliverableId || null,
          propagateArtifactIds,
          baseRevision: current?.revision,
        });
        setItems((v) =>
          v.map((x) => (x.id === r.artifact.id ? r.artifact : x)),
        );
      } else {
        const r = await api.createArtifact(project.id, body);
        setItems((v) => [r.artifact, ...v]);
      }
      try {
        if (editing) localStorage.removeItem(draftKey(editing));
      } catch {}
      setEditing(null);
      setForm(empty);
      setAutosaveState("saved");
    } catch (e: any) {
      setError(
        e.code === "ARTIFACT_REVISION_CONFLICT"
          ? `${e.message} ${t("studio.revisionConflictSuffix")}`
          : e.message,
      );
    } finally {
      setSaving(false);
    }
  }
  async function remove(item: WorkspaceArtifact) {
    if (saving || confirmDelete !== item.id) {
      setConfirmDelete(item.id);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.deleteArtifact(project.id, item.id);
      setItems((v) => v.filter((x) => x.id !== item.id));
      setConfirmDelete(null);
      if (editing === item.id) {
        setEditing(null);
        setForm(empty);
        setVersions([]);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function restoreDeleted(item: WorkspaceArtifact) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const r = await api.restoreDeletedArtifact(project.id, item.id);
      setItems((v) => v.filter((x) => x.id !== item.id));
      if (showDeleted && r.artifact) setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function restore(version: WorkspaceArtifactVersion) {
    if (!editing || editing === "new" || saving) return;
    setSaving(true);
    setError("");
    try {
      const r = await api.restoreArtifactVersion(
        project.id,
        editing,
        version.id,
      );
      setItems((v) => v.map((x) => (x.id === r.artifact.id ? r.artifact : x)));
      setForm({
        title: r.artifact.title,
        content: r.artifact.content,
        status: r.artifact.status,
        deliverableId: r.artifact.deliverableId || "",
        rubricIds: r.artifact.rubricIds || [],
        isCanonical: Boolean(r.artifact.isCanonical),
      });
      const h = await api.artifactVersions(project.id, editing);
      setVersions(h.versions);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function facultyReview() {
    if (facultyBusy || (!form.title.trim() && !form.content.trim())) return;
    setFacultyBusy(true);
    setFaculty(null);
    setFacultyFeedback("");
    setError("");
    try {
      const r = await api.projectAssist(project.id, {
        module: selected,
        title: form.title.trim(),
        content: form.content,
      });
      setFaculty(r.faculty);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setFacultyBusy(false);
    }
  }
  async function rateFaculty(
    verdict: "helpful" | "incorrect" | "missing" | "report",
  ) {
    if (!faculty || facultyFeedback) return;
    try {
      await api.aiFeedback(faculty.runId, verdict);
      setFacultyFeedback(verdict);
    } catch (e: any) {
      setError(e.message);
    }
  }
  if (!modules.length)
    return (
      <Card>
        <CardContent>
          <h2 className="section-title">{t("studio.noSpecializedModule")}</h2>
          <p className="body-copy mt-2">{t("studio.noModuleBody")}</p>
        </CardContent>
      </Card>
    );
  return (
    <div className="grid xl:grid-cols-[250px_1fr] gap-5">
      <aside className="space-y-2">
        {modules.map((m) => {
          const c = configs[m as keyof typeof configs],
            Icon = c.icon,
            count = items.filter((x) => x.module === m).length;
          return (
            <button
              key={m}
              onClick={() => {
                setSelected(m);
                setEditing(null);
                setForm(empty);
                setFaculty(null);
                setFacultyFeedback("");
              }}
              className={`focus-ring w-full rounded-2xl border hairline p-3.5 text-start flex items-center gap-3 ${selected === m ? "brand-soft-bg" : "bg-[var(--panel)] hover:bg-[var(--panel-2)]"}`}
            >
              <span className="h-9 w-9 rounded-xl soft-bg grid place-items-center shrink-0">
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold truncate">
                  {c.name}
                </span>
                <span className="block text-[9px] muted mt-1">
                  {count} {t("studio.savedItems")}
                </span>
              </span>
            </button>
          );
        })}
      </aside>
      <section className="space-y-4">
        <Card>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
              <div>
                <div className="eyebrow">{t("pw.adaptiveWorkspace")}</div>
                <h2 className="text-xl font-semibold mt-1">{config.name}</h2>
                <p className="body-copy mt-2 max-w-3xl">
                  {t(config.description)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleted((v) => !v)}
                >
                  <RotateCcw size={14} />
                  {showDeleted ? t("studio.backToItems") : t("studio.trash")}
                </Button>
                {!showDeleted && (
                  <Button onClick={() => begin()}>
                    <Save size={15} />
                    {t("studio.newWorkItem")}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        {error && (
          <div className="rounded-xl border border-[var(--danger)]/20 p-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        )}
        {editing && (
          <Card>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="eyebrow">
                    {editing === "new" ? t("studio.newWorkItem") : t("ui.editWorkItem")}
                  </div>
                  <h3 className="section-title mt-1">{config.name}</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] muted">
                    {autosaveState === "saving"
                      ? t("ui.saving")
                      : autosaveState === "offline"
                        ? t("studio.offlineSaved")
                        : t("ui.savedLocally")}
                  </span>
                  <button
                    className="focus-ring text-xs muted"
                    onClick={() => {
                      setEditing(null);
                      setForm(empty);
                      setFaculty(null);
                      setFacultyFeedback("");
                    }}
                  >
                    {t("studio.cancel")}
                  </button>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-[11px] font-semibold muted">
                    {t("studio.titleLabel")}
                  </span>
                  <input
                    className="field mt-1.5"
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    placeholder={t("studio.titlePlaceholder")}
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold muted">
                    {t("studio.contentLabel")}
                  </span>
                  <textarea
                    className={`field mt-1.5 min-h-56 resize-y ${selected === "code" || selected === "spreadsheet" ? "font-mono text-xs" : ""}`}
                    value={form.content}
                    onChange={(e) =>
                      setForm({ ...form, content: e.target.value })
                    }
                    placeholder={config.placeholder ? t(config.placeholder) : ""}
                  />
                </label>
                <div className="rounded-xl border hairline p-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold flex items-center gap-2">
                        <WandSparkles size={14} />
                        {t("studio.aiFacultyReview")}
                      </div>
                      <p className="text-[10px] muted mt-1">
                        {t("ui.level")} {project.aiPolicy.level}:{" "}
                        {project.aiPolicy.summary || t("studio.reviewPolicyFallback")}{" "}
                        {t("studio.suggestionsNotAuto")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={facultyReview}
                      disabled={
                        facultyBusy ||
                        (!form.title.trim() && !form.content.trim())
                      }
                    >
                      {facultyBusy ? (
                        <LoaderCircle size={13} className="animate-spin" />
                      ) : (
                        <WandSparkles size={13} />
                      )}
                      {t("studio.reviewMyWork")}
                    </Button>
                  </div>
                  {faculty && (
                    <div className="mt-4 border-t hairline pt-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="rounded-full brand-soft-bg px-2.5 py-1 font-semibold">
                          {faculty.agent}
                        </span>
                        <span className="muted">
                          {t("studio.contextLabel")}{" "}
                          {faculty.contextUsed.join(" · ")}
                        </span>
                        {faculty.disclosureRequired && (
                          <span className="rounded-full soft-bg px-2.5 py-1">
                            {t("studio.aiDisclosureRequired")}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-7">
                        {faculty.output.summary}
                      </p>
                      {faculty.output.findings.length > 0 && (
                        <div>
                          <div className="text-[10px] font-semibold muted">
                            {t("ui.findings")}
                          </div>
                          <ul className="mt-1.5 space-y-1.5 text-xs list-disc ps-5">
                            {faculty.output.findings.map((x, i) => (
                              <li key={`f-${i}`}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {faculty.output.suggestions.length > 0 && (
                        <div>
                          <div className="text-[10px] font-semibold muted">
                            {t("ui.suggestions")}
                          </div>
                          <ul className="mt-1.5 space-y-1.5 text-xs list-disc ps-5">
                            {faculty.output.suggestions.map((x, i) => (
                              <li key={`s-${i}`}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {faculty.output.warnings.length > 0 && (
                        <div className="rounded-lg soft-bg p-3">
                          <div className="text-[10px] font-semibold">
                            {t("ui.warnings")}
                          </div>
                          <ul className="mt-1.5 space-y-1.5 text-xs list-disc ps-5">
                            {faculty.output.warnings.map((x, i) => (
                              <li key={`w-${i}`}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <span className="text-[10px] muted self-center">
                          {t("studio.wasReviewHelpful")}
                        </span>
                        {(
                          ["helpful", "incorrect", "missing", "report"] as const
                        ).map((v) => (
                          <button
                            type="button"
                            key={v}
                            disabled={Boolean(facultyFeedback)}
                            onClick={() => rateFaculty(v)}
                            className={`focus-ring rounded-full border hairline px-2.5 py-1 text-[9px] ${facultyFeedback === v ? "brand-soft-bg font-semibold" : ""}`}
                          >
                            {v === "helpful"
                              ? t("studio.helpful")
                              : v === "incorrect"
                                ? t("studio.incorrect")
                                : v === "missing"
                                  ? t("studio.missing")
                                  : t("studio.report")}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <label>
                    <span className="text-[11px] font-semibold muted">
                      {t("studio.statusLabel")}
                    </span>
                    <select
                      className="field mt-1.5"
                      value={form.status}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          status: e.target.value as WorkspaceArtifact["status"],
                        })
                      }
                    >
                      <option value="draft">{t("studio.statusDraft")}</option>
                      <option value="in_progress">
                        {t("studio.statusInProgress")}
                      </option>
                      <option value="ready">{t("studio.statusReadyForReview")}</option>
                    </select>
                  </label>
                  <label>
                    <span className="text-[11px] font-semibold muted">
                      {t("studio.linkDeliverable")}
                    </span>
                    <select
                      className="field mt-1.5"
                      value={form.deliverableId}
                      onChange={(e) =>
                        setForm({ ...form, deliverableId: e.target.value })
                      }
                    >
                      <option value="">{t("studio.noLink")}</option>
                      {project.deliverables.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {project.rubric.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold muted">
                      {t("ui.rubricEvidenceMapping")}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {project.rubric.map((r) => (
                        <button
                          type="button"
                          key={r.id}
                          onClick={() => toggleRubric(r.id)}
                          className={`focus-ring rounded-full border hairline px-3 py-1.5 text-[10px] flex items-center gap-1.5 ${form.rubricIds.includes(r.id) ? "brand-soft-bg" : ""}`}
                        >
                          {form.rubricIds.includes(r.id) && <Check size={11} />}{" "}
                          {r.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <label className="flex items-start gap-2 rounded-xl soft-bg p-3 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.isCanonical}
                    onChange={(e) =>
                      setForm({ ...form, isCanonical: e.target.checked })
                    }
                  />
                  <span>
                    <strong>{t("studio.canonicalRef")}</strong>
                    <span className="block muted mt-1">
                      {t("studio.canonicalRefDesc")}
                    </span>
                  </span>
                </label>
                {editing !== "new" && (
                  <div className="rounded-xl border hairline p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <History size={14} />
                        {t("studio.itemHistory")}
                      </div>
                      <span className="text-[9px] muted">
                        {t("studio.eachSaveVersion")}
                      </span>
                    </div>
                    {historyLoading ? (
                      <LoaderCircle
                        size={14}
                        className="animate-spin mt-3 brand-text"
                      />
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {versions.slice(0, 8).map((v) => (
                          <button
                            type="button"
                            key={v.id}
                            disabled={
                              saving ||
                              v.versionNumber ===
                                items.find((x) => x.id === editing)?.revision
                            }
                            onClick={() => restore(v)}
                            className="focus-ring rounded-lg soft-bg px-2.5 py-2 text-[10px] flex items-center gap-1.5 disabled:opacity-45"
                          >
                            <RotateCcw size={11} />v{v.versionNumber}
                          </button>
                        ))}
                        {!versions.length && (
                          <span className="text-[10px] muted">
                            {t("studio.historyAfterSave")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <Button
                  className="w-full"
                  onClick={save}
                  disabled={saving || !form.title.trim()}
                >
                  {saving ? (
                    <LoaderCircle size={15} className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  {t("studio.saveToProject")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        {loading ? (
          <div className="min-h-48 grid place-items-center">
            <LoaderCircle className="animate-spin brand-text" />
          </div>
        ) : visible.length ? (
          <div className="grid lg:grid-cols-2 gap-4">
            {visible.map((item) => (
              <Card key={item.id}>
                <CardContent className="h-full flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full brand-soft-bg px-2.5 py-1 text-[9px] font-semibold">
                          {item.status === "ready"
                            ? t("studio.badgeReady")
                            : item.status === "in_progress"
                              ? t("studio.statusInProgress")
                              : t("studio.statusDraft")}
                        </span>
                        {item.isCanonical && (
                          <span className="rounded-full soft-bg px-2.5 py-1 text-[9px] font-semibold">
                            {t("studio.canonicalBadge")}
                          </span>
                        )}
                      </div>
                      <h3 className="section-title mt-3">{item.title}</h3>
                    </div>
                    {!item.deletedAt && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t("studio.deleteWorkItemAria")}
                        onClick={() =>
                          setConfirmDelete(
                            confirmDelete === item.id ? null : item.id,
                          )
                        }
                        disabled={saving}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                  {confirmDelete === item.id && (
                    <div className="mt-3 rounded-xl border border-[var(--danger)]/25 p-3">
                      <div className="flex gap-2 text-xs">
                        <AlertTriangle
                          size={14}
                          className="text-[var(--danger)] shrink-0 mt-0.5"
                        />
                        <div>
                          <strong>{t("studio.deleteThisItem")}</strong>
                          <p className="muted mt-1">
                            {t("studio.deleteItemDesc")}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => remove(item)}
                          disabled={saving}
                        >
                          {t("studio.confirmDelete")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmDelete(null)}
                        >
                          {t("studio.cancel")}
                        </Button>
                      </div>
                    </div>
                  )}
                  <p
                    className={`mt-3 text-xs leading-6 muted whitespace-pre-wrap line-clamp-6 ${item.module === "code" || item.module === "spreadsheet" ? "font-mono" : ""}`}
                  >
                    {item.content || t("studio.noContentYet")}
                  </p>
                  <div className="mt-4 pt-3 border-t hairline flex flex-wrap gap-2 text-[9px] muted">
                    {item.deliverableId && (
                      <span>
                        {t("ui.deliverable")}: {project.deliverables.find(
                          (d) => d.id === item.deliverableId,
                        )?.title || t("ui.deliverable")}
                      </span>
                    )}
                    {(item.rubricIds || []).map((id) => (
                      <span key={id}>
                        ·{" "}
                        {project.rubric.find((r) => r.id === id)?.title ||
                          t("ui.rubric")}
                      </span>
                    ))}
                  </div>
                  {item.deletedAt ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-auto"
                      onClick={() => restoreDeleted(item)}
                      disabled={saving}
                    >
                      <RotateCcw size={13} />
                      {t("studio.restoreFromTrash")}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-auto"
                      onClick={() => begin(item)}
                    >
                      {t("studio.openEdit")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed hairline p-10 text-center">
            <EmptyIcon className="mx-auto brand-text" />
            <h3 className="section-title mt-4">
              {config.name} {t("studio.badgeReady")}
            </h3>
            <p className="body-copy mt-2">{t("studio.emptyStateBody")}</p>
          </div>
        )}
      </section>
    </div>
  );
}

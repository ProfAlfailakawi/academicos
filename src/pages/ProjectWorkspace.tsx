import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  ClipboardCheck,
  Clock3,
  Database,
  Bot,
  FilePenLine,
  FileCheck2,
  FileText,
  GitBranch,
  Ghost,
  Droplet,
  Repeat,
  GraduationCap,
  ListChecks,
  LoaderCircle,
  Play,
  Sparkles,
  UsersRound,
  ShieldCheck,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import type { ProjectDNA, ProjectTask, ProjectWriterRequest, RescuePlan, SubmissionAudit } from "../types";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { StatusPill } from "../components/StatusPill";
import { EvidenceStudio } from "../components/project/EvidenceStudio";
import { VivaStudio } from "../components/project/VivaStudio";
import { TeamStudio } from "../components/project/TeamStudio";
import { ProjectWriterStudio } from "../components/project/ProjectWriterStudio";
import { ProjectCopilot } from "../components/project/ProjectCopilot";
import { AcademicDossierModal } from "../components/project/AcademicDossierModal";
import { TurnitinForensicShieldModal } from "../components/project/TurnitinForensicShieldModal";
import { LiveScholarVerifier } from "../components/project/LiveScholarVerifier";
import { DynamicDataVisualizer } from "../components/project/DynamicDataVisualizer";
import { RedTeamingArena } from "../components/project/RedTeamingArena";
import { RequirementMatrixStudio } from "../components/project/RequirementMatrixStudio";
import { AutoPresentationStudio } from "../components/project/AutoPresentationStudio";
import { PortfolioArtifactBadge } from "../components/project/PortfolioArtifactBadge";
import { CrossStyleFormatter } from "../components/project/CrossStyleFormatter";
import { GhostCohortPanel } from "../components/project/GhostCohortPanel";
import { GradeLossMap } from "../components/project/GradeLossMap";
import { ReverseAssessmentStudio } from "../components/project/ReverseAssessmentStudio";
import { formatDate, useI18n } from "../lib/i18n";
import { localizedUiError } from "../lib/ui-error";
import {
  Fingerprint,
  Search,
  BarChart2,
  Flame,
  Presentation,
  Award,
  ArrowRightLeft,
} from "lucide-react";

const tabs = [
  ["copilot", "pw.tabCopilot", Bot],
  ["writer", "pw.tabWriter", FilePenLine],
  ["req_matrix", "pw.tabRequirements", ListChecks],
  ["red_teaming", "pw.tabRedTeam", Flame],
  ["scholar", "pw.tabScholar", Search],
  ["slides", "pw.tabSlides", Presentation],
  ["visualizer", "pw.tabVisuals", BarChart2],
  ["benchmark", "pw.tabBenchmark", Ghost],
  ["reverse", "pw.tabReverse", Repeat],
  ["formatter", "pw.tabFormatter", ArrowRightLeft],
  ["portfolio", "pw.tabPortfolio", Award],
  ["plan", "pw.tabPlan", ListChecks],
  ["evidence", "pw.tabEvidence", Database],
  ["viva", "pw.tabViva", GraduationCap],
  ["team", "pw.tabTeam", UsersRound],
] as const;
type Tab = (typeof tabs)[number][0];

export function ProjectWorkspace() {
  const { t } = useI18n();
  const { id = "" } = useParams();
  const location = useLocation();
  const [project, setProject] = useState<ProjectDNA | null>(null);
  const [tab, setTab] = useState<Tab>("writer");
  const [error, setError] = useState("");
  const [audit, setAudit] = useState<SubmissionAudit | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [showDossier, setShowDossier] = useState(false);
  const [showForensicRadar, setShowForensicRadar] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [showRescue, setShowRescue] = useState(false);
  const [rescueMinutes, setRescueMinutes] = useState(180);
  const [rescueLoading, setRescueLoading] = useState(false);
  const [rescue, setRescue] = useState<RescuePlan | null>(null);
  const [original, setOriginal] = useState<{
    text?: string;
    files: Array<{
      fileName: string;
      fileType?: string;
      url?: string;
      size?: number;
      sha256?: string;
    }>;
  } | null>(null);
  const [originalLoading, setOriginalLoading] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({
    VivaStudio: true,
    ProjectExport: true,
    EvidenceStudio: true,
  });

  useEffect(() => {
    api
      .project(id)
      .then((r) => setProject(r.project))
      .catch((e) => setError(localizedUiError(e, t, "ui.actionError")));
    api
      .featureFlags()
      .then((r) =>
        setFeatureFlags(
          Object.fromEntries(r.flags.map((f) => [f.key, f.enabled])),
        ),
      )
      .catch((e) => {
        console.error("Failed to load project feature flags", e);
        setError((current) => current || localizedUiError(e, t, "ui.loadError"));
      });
  }, [id]);
  useEffect(() => {
    const focus = new URLSearchParams(location.search).get("focus");
    if (focus === "viva") setTab("viva");
    else if (focus === "plan" || focus === "tasks") setTab("plan");
    else setTab("writer");
  }, [location.search]);
  if (error)
    return (
      <div className="panel-flat rounded-2xl p-6">
        <h2 className="section-title">{t("pw.cannotOpenProject")}</h2>
        <p className="body-copy mt-2">{error}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/app/projects">{t("pw.backToProjects")}</Link>
        </Button>
      </div>
    );
  if (!project)
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-20 soft-bg rounded-2xl" />
        <div className="h-96 soft-bg rounded-2xl" />
      </div>
    );

  async function setTaskStatus(
    task: ProjectTask,
    status: ProjectTask["status"],
  ) {
    const old = project!;
    setProject({
      ...old,
      tasks: old.tasks.map((t) => (t.id === task.id ? { ...t, status } : t)),
    });
    try {
      setProject((await api.updateTask(old.id, task.id, status)).project);
      setError("");
    } catch (e: any) {
      setProject(old);
      setError(localizedUiError(e, t, "pw.updateError"));
    }
  }
  async function setDeliverableStatus(deliverableId: string, status: string) {
    const old = project!;
    setProject({
      ...old,
      deliverables: old.deliverables.map((d) =>
        d.id === deliverableId ? { ...d, status: status as any } : d,
      ),
    });
    try {
      setProject(
        (await api.updateDeliverable(old.id, deliverableId, status)).project,
      );
      setError("");
    } catch (e: any) {
      setProject(old);
      setError(localizedUiError(e, t, "pw.updateError"));
    }
  }
  async function setRubricStatus(criterionId: string, readiness: string) {
    const old = project!;
    setProject({
      ...old,
      rubric: old.rubric.map((r) =>
        r.id === criterionId ? { ...r, readiness: readiness as any } : r,
      ),
    });
    try {
      setProject(
        (await api.updateRubric(old.id, criterionId, readiness)).project,
      );
      setError("");
    } catch (e: any) {
      setProject(old);
      setError(localizedUiError(e, t, "pw.updateError"));
    }
  }
  async function openOriginal() {
    setShowOriginal(true);
    setOriginalLoading(true);
    try {
      const r = await api.original(project!.id);
      setOriginal(r);
    } catch (e: any) {
      setOriginal({ text: `${t("pw.cannotOpenOriginalFile")}: ${e.message}`, files: [] });
    } finally {
      setOriginalLoading(false);
    }
  }
  async function runAudit() {
    setAuditing(true);
    setError("");
    try {
      setAudit((await api.audit(project!.id)).audit);
    } catch (e: any) {
      setAudit(null);
      setError(localizedUiError(e, t, "pw.auditError"));
    } finally {
      setAuditing(false);
    }
  }
  async function runRescue(minutes = rescueMinutes) {
    setShowRescue(true);
    setRescueLoading(true);
    try {
      const r = await api.rescuePlan(project!.id, minutes);
      setRescue(r.plan);
    } catch (e: any) {
      setError(localizedUiError(e, t, "pw.rescueError"));
    } finally {
      setRescueLoading(false);
    }
  }
  function fixAuditCategory(category?: string) {
    setAudit(null);
    if (category === "evidence" || category === "integrity") setTab("evidence");
    else if (category === "format" || category === "accessibility") setTab("formatter");
    else if (category === "requirement" || category === "rubric") setTab("req_matrix");
    else if (category === "deadline" || category === "deliverable") setTab("plan");
    else if (category === "policy") setShowDossier(true);
    else setTab("writer");
  }
  return (
    <div className="space-y-5">
      {location.state?.justCompiled && (
        <div className="brand-soft-bg rounded-xl px-4 py-3 text-sm flex items-start gap-2">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">{t("pw.workspaceReady")}</div>
            <div className="text-xs muted mt-1">
              {location.state?.compileSummary ||
                t("pw.compiledSummaryDefault")}
            </div>
          </div>
        </div>
      )}
      <header className="panel-flat rounded-2xl p-5 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-5 justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap text-xs muted">
              <Button
                asChild
                size="icon"
                variant="ghost"
                className="-ms-2"
                aria-label={t("pw.backToProjectsAria")}
              >
                <Link to="/app/projects">
                  <ArrowLeft size={18} className="directional-icon" />
                </Link>
              </Button>
              <span>{project.course}</span>
              <span>·</span>
              <span>{project.academicDomain}</span>
              <StatusPill status={project.status} />
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-[-0.03em] mt-2">
              {project.title}
            </h1>
            <div className="mt-4 flex items-center gap-3">
              <div className="tone-meter max-w-md flex-1">
                <div style={{ width: `${project.progress}%` }}
                />
              </div>
              <span className="text-xs muted mono-number">
                {project.progress}%
              </span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Button onClick={runAudit} disabled={auditing} className="shadow-sm">
              {auditing ? <LoaderCircle size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
              {t("pw.submissionReady")}
            </Button>
            <Button variant="outline" onClick={() => runRescue()} disabled={rescueLoading}>
              {rescueLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Clock3 size={16} />}
              {t("pw.rescueMe")}
            </Button>
            <details className="relative">
              <summary className="list-none cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border hairline bg-[var(--panel)] hover:bg-[var(--panel-2)]">
                {t("pw.submissionTools")} <ChevronDown size={14} />
              </summary>
              <div className="absolute z-30 start-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] panel rounded-xl border hairline shadow-xl p-2 space-y-1">
                <a href={api.exportBundleUrl(project.id)} download className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-[var(--panel-2)]">
                  <FileCheck2 size={15} /> {t("pw.submissionBundle")}
                </a>
                <button onClick={() => setShowForensicRadar(true)} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-[var(--panel-2)] text-start">
                  <Fingerprint size={15} /> {t("pw.styleIntegrity")}
                </button>
                <button onClick={() => setShowDossier(true)} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-[var(--panel-2)] text-start">
                  <ShieldCheck size={15} /> {t("pw.defenseDossier")}
                </button>
                <button onClick={openOriginal} disabled={!project.originalAssignment?.text && !project.originalAssignment?.fileName && !project.originalAssignment?.attachments?.length} className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs hover:bg-[var(--panel-2)] disabled:opacity-40 text-start">
                  <FileText size={15} /> {t("pw.originalAssignment")}
                </button>
              </div>
            </details>
          </div>
        </div>
        <div className="mt-5 pt-4 border-t hairline">
          <div className="flex flex-wrap gap-2 items-center">
            {tabs
              .filter(([key]) => ["writer", "evidence", "viva"].includes(key))
              .filter(([key]) =>
                (key !== "viva" || featureFlags.VivaStudio !== false) &&
                (key !== "evidence" || featureFlags.EvidenceStudio !== false),
              )
              .map(([key, label, Icon]) => (
                <button key={key} onClick={() => setTab(key)} className={`focus-ring rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2 ${tab === key ? "brand-soft-bg brand-text" : "muted hover:bg-[var(--panel-2)]"}`}>
                  <Icon size={16} />{t(label)}
                </button>
              ))}
            <button onClick={() => setShowMoreTools((v) => !v)} className={`focus-ring rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-2 ${showMoreTools || !["writer","evidence","viva"].includes(tab) ? "soft-bg" : "muted hover:bg-[var(--panel-2)]"}`}>
              <Sparkles size={16} /> {t("pw.more")} <ChevronDown size={14} className={showMoreTools ? "rotate-180 transition" : "transition"} />
            </button>
          </div>
          {(showMoreTools || !["writer","evidence","viva"].includes(tab)) && (
            <div className="mt-3 pt-3 border-t hairline flex flex-wrap gap-1">
              {tabs
                .filter(([key]) => !["writer", "evidence", "viva"].includes(key))
                .filter(([key]) =>
                  (key !== "copilot" || featureFlags.ProjectCopilot !== false) &&
                  (key !== "team" || project.collaborationMode === "group"),
                )
                .map(([key, label, Icon]) => (
                  <button key={key} onClick={() => setTab(key)} className={`focus-ring rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-2 ${tab === key ? "brand-soft-bg brand-text" : "muted hover:bg-[var(--panel-2)]"}`}>
                    <Icon size={14} />{label}
                  </button>
                ))}
            </div>
          )}
        </div>
      </header>
      {tab === "writer" && (
        <ProjectWriterStudio
          project={project}
          initialRequest={(location.state as { writerRequest?: ProjectWriterRequest } | null)?.writerRequest}
          onProjectChange={setProject}
          onOpenViva={() => setTab("viva")}
        />
      )}
      {tab === "copilot" && <ProjectCopilot project={project} />}
      {tab === "req_matrix" && <RequirementMatrixStudio project={project} />}
      {tab === "red_teaming" && <RedTeamingArena project={project} />}
      {tab === "scholar" && <LiveScholarVerifier project={project} />}
      {tab === "slides" && <AutoPresentationStudio project={project} />}
      {tab === "visualizer" && <DynamicDataVisualizer project={project} />}
      {tab === "benchmark" && (
        <div className="space-y-6">
          <GhostCohortPanel project={project} />
          <GradeLossMap project={project} />
        </div>
      )}
      {tab === "reverse" && <ReverseAssessmentStudio project={project} />}
      {tab === "formatter" && <CrossStyleFormatter project={project} />}
      {tab === "portfolio" && <PortfolioArtifactBadge project={project} />}
      {tab === "plan" && (
        <StudentPlan
          project={project}
          onTask={setTaskStatus}
          onDeliverable={setDeliverableStatus}
          onRubric={setRubricStatus}
        />
      )}
      {tab === "evidence" && <EvidenceStudio project={project} />}
      {tab === "viva" && <VivaStudio project={project} />}
      {tab === "team" && <TeamStudio project={project} />}

      {showDossier && (
        <AcademicDossierModal
          project={project}
          onClose={() => setShowDossier(false)}
        />
      )}

      {showForensicRadar && (
        <TurnitinForensicShieldModal
          project={project}
          onClose={() => setShowForensicRadar(false)}
        />
      )}

      {showOriginal && (
        <Modal title={t("pw.originalAssignment")} onClose={() => setShowOriginal(false)}>
          <div className="space-y-3">
            {project.originalAssignment?.fileName && (
              <div className="text-xs muted">
                {t("pw.file")}: {project.originalAssignment.fileName}
              </div>
            )}
            {originalLoading ? (
              <div className="h-28 grid place-items-center">
                <LoaderCircle className="animate-spin brand-text" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {(
                    original?.files ||
                    project.originalAssignment?.attachments ||
                    []
                  ).map((f: any) => (
                    <div
                      key={f.fileName}
                      className="rounded-xl border hairline p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">
                          {f.fileName}
                        </div>
                        <div className="text-[10px] muted">
                          {f.fileType || "file"}
                          {f.size ? ` · ${formatBytes(f.size)}` : ""}
                          {f.sha256
                            ? ` · SHA-256 ${String(f.sha256).slice(0, 12)}…`
                            : ""}
                          {f.url ? ` · ${t("pw.signedLink15")}` : ""}
                        </div>
                      </div>
                      {f.url ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={f.url} target="_blank" rel="noreferrer">
                            {t("pw.open")}
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
                {original?.text || project.originalAssignment?.text ? (
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-7 bg-[var(--bg)] border hairline rounded-xl p-4 max-h-[45vh] overflow-auto">
                    {original?.text || project.originalAssignment?.text}
                  </pre>
                ) : (
                  <p className="body-copy">
                    {t("pw.noTextPreview")}
                  </p>
                )}
              </>
            )}
          </div>
        </Modal>
      )}
      {audit && <AuditModal audit={audit} onClose={() => setAudit(null)} onFix={fixAuditCategory} />}
      {showRescue && <RescueModal plan={rescue} minutes={rescueMinutes} loading={rescueLoading} onMinutes={setRescueMinutes} onRefresh={runRescue} onOpenPlan={() => { setShowRescue(false); setTab("plan"); }} onClose={() => setShowRescue(false)} />}
    </div>
  );
}

function StudentPlan({
  project,
  onTask,
  onDeliverable,
  onRubric,
}: {
  project: ProjectDNA;
  onTask: (task: ProjectTask, status: ProjectTask["status"]) => void;
  onDeliverable: (id: string, status: string) => void;
  onRubric: (id: string, status: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <section className="grid sm:grid-cols-3 gap-3">
        <Mini label={t("pw.tasksMetric")} value={String(project.tasks.length)} hint={t("pw.tasksMetricHint")} />
        <Mini label={t("pw.deliverablesMetric")} value={String(project.deliverables.length)} hint={t("pw.deliverablesMetricHint")} />
        <Mini label={t("ui.rubric")} value={String(project.rubric.length)} hint={t("pw.rubricMetricHint")} />
      </section>
      <Tasks project={project} onChange={onTask} />
      <Requirements project={project} />
      <Rubric project={project} onChange={onRubric} />
      <Deliverables project={project} onChange={onDeliverable} />
    </div>
  );
}

function Overview({
  project,
  onTab,
}: {
  project: ProjectDNA;
  onTab: (t: any) => void;
}) {
  const { t } = useI18n();
  const next =
    project.tasks.find(
      (t) => t.status === "ready" || t.status === "in_progress",
    ) || project.tasks.find((t) => t.status === "not_started");
  return (
    <div className="grid xl:grid-cols-[1.35fr_.65fr] gap-5">
      <div className="space-y-5">
        <section className="relative overflow-hidden rounded-[22px] brand-hero p-6 md:p-8">
          <div className="absolute inset-0 opacity-10 paper-grid" />
          <div className="relative">
            <div className="text-xs text-white/70 flex items-center gap-2">
              <Sparkles size={15} />
              {t("ui.whatNext")}
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.03em] mt-3">
              {next?.title || project.nextAction}
            </h2>
            {next?.description && (
              <p className="text-white/70 text-sm leading-7 mt-2 max-w-2xl">
                {next.description}
              </p>
            )}
            <Button
              variant="secondary"
              className="mt-5 btn-on-deep"
              onClick={() => onTab("tasks")}
            >
              <Play size={15} />
              {t("pw.openPlan")}
            </Button>
          </div>
        </section>
        <div className="grid md:grid-cols-3 gap-3">
          <Mini
            label={t("pw.deliverables")}
            value={`${project.deliverables.filter((d) => d.status === "ready" || d.status === "completed").length}/${project.deliverables.length}`}
            hint={t("pw.readyHint")}
          />
          <Mini
            label={t("ui.rubric")}
            value={`${project.rubric.filter((r) => r.readiness === "covered").length}/${project.rubric.length || 0}`}
            hint={t("pw.criteriaCovered")}
          />
          <Mini
            label={t("pw.policy")}
            value={`L${project.aiPolicy.level}`}
            hint={
              project.aiPolicy.needsConfirmation ? t("pw.needsConfirm") : t("pw.defined")
            }
          />
        </div>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="section-title">{t("pw.adaptiveWorkspace")}</h2>
                <p className="body-copy mt-1">
                  {t("pw.modulesNote")}
                </p>
              </div>
              <GitBranch className="brand-text" />
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              {project.workspaceModules.map((m) => (
                <button
                  key={m}
                  onClick={() =>
                    onTab(
                      m === "team" ? "team" : m === "viva" ? "viva" : "studios",
                    )
                  }
                  className="focus-ring brand-soft-bg rounded-full px-3 py-1.5 text-xs font-semibold hover:opacity-80"
                >
                  {moduleName(m)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <aside className="space-y-5">
        <Card>
          <CardContent>
            <h2 className="text-sm font-semibold">{t("ui.projectDna")}</h2>
            <dl className="mt-4 space-y-3 text-xs">
              {[
                [t("pw.projectType"), project.projectType],
                [t("pw.complexity"), project.complexity],
                [t("pw.collabMode"), project.collaborationMode],
                [t("ui.citation"), project.citationStyle || t("pw.needsConfirm")],
                [
                  t("pw.workload"),
                  project.estimatedWorkloadHours
                    ? `${project.estimatedWorkloadHours} ${t("pw.hours")}`
                    : t("pw.needsConfirm"),
                ],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between gap-4 border-b hairline pb-3 last:border-0 last:pb-0"
                >
                  <dt className="muted">{k}</dt>
                  <dd className="font-semibold text-end">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2">
              <ShieldCheck size={17} className="brand-text" />
              <h2 className="text-sm font-semibold">{t("ui.aiPolicy")}</h2>
            </div>
            <p className="body-copy mt-3">{project.aiPolicy.summary}</p>
            {project.aiPolicy.needsConfirmation && (
              <div className="mt-3 rounded-xl bg-warning/12 text-warning text-xs p-3 flex gap-2">
                <AlertTriangle size={15} />
                <span>{t("pw.policyWarning")}</span>
              </div>
            )}
          </CardContent>
        </Card>
        {project.riskFlags.length > 0 && (
          <Card>
            <CardContent>
              <h2 className="text-sm font-semibold">{t("pw.risks")}</h2>
              <ul className="mt-3 space-y-2">
                {project.riskFlags.map((r) => (
                  <li key={r} className="text-xs leading-6 muted flex gap-2">
                    <CircleDashed size={14} className="mt-1 shrink-0" />
                    {r}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </aside>
    </div>
  );
}

function Tasks({
  project,
  onChange,
}: {
  project: ProjectDNA;
  onChange: (t: ProjectTask, s: ProjectTask["status"]) => void;
}) {
  const { t: tr, locale } = useI18n();
  return (
    <Card>
      <CardContent className="p-2 md:p-3">
        <div className="px-3 py-3">
          <h2 className="section-title">{tr("pw.projectPlan")}</h2>
          <p className="body-copy mt-1">
            {tr("pw.tasksNote")}
          </p>
        </div>
        <div className="mt-2">
          {project.tasks.map((t, i) => (
            <div
              key={t.id}
              className="grid grid-cols-[28px_1fr_auto] items-center gap-3 p-3 rounded-xl hover:bg-[var(--panel-2)]"
            >
              <div className="text-[11px] muted mono-number">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{t.title}</div>
                <div className="text-[11px] muted mt-1 flex gap-2 flex-wrap">
                  {t.module && <span>{moduleName(t.module)}</span>}
                  {t.estimatedMinutes && (
                    <span>· {t.estimatedMinutes} {tr("pw.minutes")}</span>
                  )}
                  {t.dueDate && (
                    <span>
                      · {formatDate(t.dueDate, locale)}
                    </span>
                  )}
                </div>
              </div>
              <select
                aria-label={`${tr("pw.statusOf")} ${t.title}`}
                value={t.status}
                onChange={(e) =>
                  onChange(t, e.target.value as ProjectTask["status"])
                }
                className="focus-ring rounded-lg border hairline bg-[var(--panel)] px-2 py-2 text-xs"
              >
                <option value="not_started">{tr("pw.notStarted")}</option>
                <option value="ready">{tr("pw.readyStatus")}</option>
                <option value="in_progress">{tr("pw.inProgress")}</option>
                <option value="blocked">{tr("pw.blocked")}</option>
                <option value="needs_review">{tr("pw.reviewStatus")}</option>
                <option value="completed">{tr("pw.completed")}</option>
              </select>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Deliverables({
  project,
  onChange,
}: {
  project: ProjectDNA;
  onChange: (id: string, s: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
      {project.deliverables.map((d) => (
        <Card key={d.id}>
          <CardContent className="h-full flex flex-col">
            <div className="flex justify-between gap-3">
              <div className="h-10 w-10 rounded-xl tone-tile">
                <FileCheck2 size={17} />
              </div>
              <StatusPill status={d.status} />
            </div>
            <h2 className="section-title mt-5">{d.title}</h2>
            <p className="body-copy mt-2">{t("pw.format")}: {d.format}</p>
            {d.validationRules?.length ? (
              <ul className="mt-4 space-y-1 text-xs muted">
                {d.validationRules.map((v) => (
                  <li key={v}>• {v}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-auto pt-6">
              <label className="text-[11px] muted">{t("pw.updateStatus")}</label>
              <select
                value={d.status}
                onChange={(e) => onChange(d.id, e.target.value)}
                className="focus-ring mt-1 w-full rounded-xl border hairline bg-[var(--panel)] px-3 py-2.5 text-xs"
              >
                <option value="pending">{t("pw.pending")}</option>
                <option value="in_progress">{t("pw.inProgress")}</option>
                <option value="ready">{t("pw.readyForSubmit")}</option>
                <option value="completed">{t("pw.submittedArchived")}</option>
              </select>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Requirements({ project }: { project: ProjectDNA }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardContent>
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="section-title">{t("ui.requirementTraceability")}</h2>
            <p className="body-copy mt-1">
              {t("pw.reqNote")}
            </p>
          </div>
          <span className="text-xs muted">
            {project.requirements.length} {t("pw.requirementsWord")}
          </span>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="text-start text-[11px] muted border-b hairline">
                <th className="text-start py-3 font-semibold">{t("pw.requirement")}</th>
                <th className="text-start py-3 font-semibold">{t("pw.value")}</th>
                <th className="text-start py-3 font-semibold">{t("pw.category")}</th>
                <th className="text-start py-3 font-semibold">{t("pw.confidence")}</th>
                <th className="text-start py-3 font-semibold">{t("pw.source")}</th>
              </tr>
            </thead>
            <tbody>
              {project.requirements.map((r) => (
                <tr key={r.id} className="border-b hairline last:border-0">
                  <td className="py-3 font-semibold">{r.label}</td>
                  <td className="py-3">{r.value}</td>
                  <td className="py-3 muted">{t(`req.category.${r.category}`)}</td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${r.confidence === "needs_confirmation" ? "bg-warning/12 text-warning " : "brand-soft-bg"}`}
                    >
                      {r.confidence === "needs_confirmation"
                        ? t("pw.needsConfirm")
                        : t(`req.confidence.${r.confidence}`)}
                    </span>
                  </td>
                  <td className="py-3 muted max-w-xs truncate">
                    {r.source || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Rubric({
  project,
  onChange,
}: {
  project: ProjectDNA;
  onChange: (id: string, status: string) => void;
}) {
  const { t } = useI18n();
  return project.rubric.length ? (
    <div className="grid lg:grid-cols-2 gap-4">
      {project.rubric.map((r) => (
        <Card key={r.id}>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="section-title">{r.title}</h2>
                <p className="body-copy mt-2">{r.description}</p>
              </div>
              <div className="h-11 w-11 rounded-xl soft-bg flex items-center justify-center text-xs font-semibold mono-number shrink-0">
                {r.weighting}%
              </div>
            </div>
            <div className="mt-5 grid sm:grid-cols-[1fr_auto] items-end gap-3">
              <div>
                <label className="text-[11px] muted">
                  {t("ui.rubricReadiness")} · {t("pw.notFinalGrade")}
                </label>
                <select
                  aria-label={`${t("pw.readinessOf")} ${r.title}`}
                  value={r.readiness || "not_evidenced"}
                  onChange={(e) => onChange(r.id, e.target.value)}
                  className="focus-ring mt-1 w-full rounded-xl border hairline bg-[var(--panel)] px-3 py-2.5 text-xs"
                >
                  <option value="not_evidenced">{t("pw.notEvidenced")}</option>
                  <option value="partial">{t("pw.partial")}</option>
                  <option value="covered">{t("pw.covered")}</option>
                  <option value="needs_revision">{t("pw.needsRevision")}</option>
                </select>
              </div>
              <StatusPill status={r.readiness || "not_evidenced"} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  ) : (
    <Card>
      <CardContent>
        <h2 className="section-title">{t("pw.rubricNotExtracted")}</h2>
        <p className="body-copy mt-2">
          {t("pw.rubricNote")}
        </p>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value, hint }: any) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="eyebrow">{label}</div>
        <div className="text-2xl font-semibold mt-3 mono-number">{value}</div>
        <div className="text-[10px] muted mt-1">{hint}</div>
      </CardContent>
    </Card>
  );
}

function AuditModal({
  audit,
  onClose,
  onFix,
}: {
  audit: SubmissionAudit;
  onClose: () => void;
  onFix: (category?: string) => void;
}) {
  const { t } = useI18n();
  const label = {
    ready: t("pw.auditReady"),
    mostly_ready: t("pw.mostlyReady"),
    needs_attention: t("pw.needsAttention"),
    critical_issues: t("pw.criticalIssues"),
  }[audit.status];
  return (
    <Modal title={t("pw.submissionReady")} onClose={onClose}>
      <div className="rounded-2xl brand-soft-bg p-5">
        <div className="text-[11px] muted">{t("pw.result")}</div>
        <div className="flex items-end justify-between gap-4"><div className="text-2xl font-semibold mt-1">{label}</div><div className="text-end"><div className="text-2xl font-semibold mono-number">{audit.score??0}%</div><div className="text-[9px] muted">{audit.blockingIssues??0} {t("pw.blocking")} · {audit.warnings??0} {t("pw.warning")}</div></div></div>
        <p className="body-copy mt-2">
          {t("pw.auditNote")}
        </p>
      </div>
      <div className="mt-4 space-y-2">
        {audit.checks.map((c) => (
          <div key={c.id} className="rounded-xl border hairline p-3 flex gap-3">
            <div
              className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${c.status === "pass" ? "brand-soft-bg" : c.status === "critical" ? "bg-danger/12 text-danger " : "bg-warning/12 text-warning "}`}
            >
              {c.status === "pass" ? (
                <Check size={15} />
              ) : (
                <AlertTriangle size={15} />
              )}
            </div>
            <div>
              <div className="text-sm font-semibold">{c.label}</div>
              <div className="text-xs leading-6 muted mt-1">{c.detail}</div>
              {c.action&&<div className="text-[10px] brand-text mt-1">{t("pw.action")}: {c.action}</div>}
              {c.status !== "pass" && c.status !== "not_applicable" && <button onClick={() => onFix(c.category)} className="mt-2 text-[11px] font-semibold brand-text hover:underline">{t("pw.takeMeToFix")} <ArrowRight size={12} className="inline directional-icon" /></button>}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
function RescueModal({
  plan,
  minutes,
  loading,
  onMinutes,
  onRefresh,
  onOpenPlan,
  onClose,
}: {
  plan: RescuePlan | null;
  minutes: number;
  loading: boolean;
  onMinutes: (minutes: number) => void;
  onRefresh: (minutes?: number) => void;
  onOpenPlan: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const severity = plan?.severity === "critical" ? t("pw.rescueCritical") : plan?.severity === "tight" ? t("pw.rescueTight") : t("pw.rescuePossible");
  return <Modal title={t("pw.rescueTitle")} onClose={onClose}>
    <div className="rounded-2xl brand-soft-bg p-5">
      <div className="eyebrow">{t("ui.deadlineRescue")}</div>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-2">
        <div><h3 className="text-xl font-semibold">{loading ? t("pw.rescueCalculating") : severity}</h3><p className="body-copy mt-2">{plan?.summary || t("pw.rescuePrompt")}</p></div>
        {plan && <div className="text-end shrink-0"><div className="text-2xl font-semibold mono-number">{plan.remainingMinutes} {t("pw.minuteShort")}</div><div className="text-[10px] muted">{t("pw.estimatedWork")}</div></div>}
      </div>
    </div>
    <div className="mt-5">
      <label className="text-xs font-semibold">{t("pw.timeAvailable")} <span className="muted">{minutes} {t("pw.minutes")}</span></label>
      <input type="range" min={30} max={720} step={30} value={minutes} onChange={(e) => onMinutes(Number(e.target.value))} className="w-full mt-3" />
      <div className="flex justify-between text-[10px] muted"><span>30 {t("pw.minuteShort")}</span><span>12 {t("pw.hours")}</span></div>
      <Button variant="outline" className="mt-3" onClick={() => onRefresh(minutes)} disabled={loading}>{loading ? <LoaderCircle size={15} className="animate-spin" /> : <Clock3 size={15} />} {t("pw.reorderPlan")}</Button>
    </div>
    {plan && <div className="mt-5 space-y-3">
      {plan.phases.map((phase, index) => <div key={phase.id} className="rounded-xl border hairline p-4 flex gap-3">
        <span className="h-8 w-8 rounded-lg tone-tile text-xs font-semibold shrink-0">{index + 1}</span>
        <div className="flex-1"><div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold">{phase.title}</div><span className="text-xs mono-number muted">{phase.minutes} {t("pw.minuteShort")}</span></div><p className="text-xs leading-6 muted mt-1">{phase.reason}</p>{phase.mustDo && <div className="text-[10px] brand-text font-semibold mt-2">{t("pw.doNotDefer")}</div>}</div>
      </div>)}
      {plan.deferredTaskIds.length > 0 && <div className="rounded-xl soft-bg p-3 text-xs muted">{t("pw.deferredTasks").replace("{count}", String(plan.deferredTaskIds.length))}</div>}
      <Button className="w-full" onClick={onOpenPlan}>{t("pw.openPlan")}</Button>
    </div>}
  </Modal>;
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        aria-label={t("pw.close")}
        onClick={onClose}
      />
      <div className="relative panel rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-hidden">
        <div className="h-14 px-5 flex items-center justify-between border-b hairline">
          <h2 className="font-semibold">{title}</h2>
          <Button
            size="icon"
            variant="ghost"
            aria-label={t("pw.closeWindow")}
            onClick={onClose}
          >
            <X size={18} />
          </Button>
        </div>
        <div className="p-5 overflow-auto max-h-[calc(88vh-56px)]">
          {children}
        </div>
      </div>
    </div>
  );
}
function moduleName(value: string) {
  return (
    (
      {
        research: "Research Studio",
        writing: "Writing Studio",
        data: "Data Lab",
        spreadsheet: "Spreadsheet Studio",
        code: "Code Lab",
        engineering: "Engineering Studio",
        lab: "Lab Notebook",
        design: "Design Board",
        media: "Media Studio",
        presentation: "Presentation Studio",
        portfolio: "Portfolio Studio",
        survey: "Survey Studio",
        team: "Team Studio",
        simulation: "Simulation Studio",
        viva: "Viva Studio",
      } as Record<string, string>
    )[value] || value
  );
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

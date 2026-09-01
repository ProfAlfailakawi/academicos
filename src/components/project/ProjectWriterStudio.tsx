import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpenCheck,
  Check,
  CheckCircle2,
  CreditCard,
  Download,
  Expand,
  FileSearch,
  LockKeyhole,
  LoaderCircle,
  MessageSquareText,
  Mic2,
  PanelRightOpen,
  Save,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { api } from "../../lib/api";
import type {
  ProjectDNA,
  ProjectAccess,
  ProjectDocument,
  ProjectDocumentSection,
  ProjectWriterRequest,
  ProjectXRayReport,
} from "../../types";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { useI18n } from "../../lib/i18n";

type SectionAction =
  | "explain"
  | "simplify"
  | "expand"
  | "shorten"
  | "voice"
  | "academic"
  | "translate"
  | "challenge"
  | "source";

const actionButtons: Array<{
  action: SectionAction;
  labelKey: string;
  icon: React.ElementType;
  apply?: boolean;
}> = [
  { action: "explain", labelKey: "writer.actionExplain", icon: MessageSquareText },
  { action: "simplify", labelKey: "writer.actionSimplify", icon: Sparkles, apply: true },
  { action: "expand", labelKey: "writer.actionExpand", icon: Expand, apply: true },
  { action: "academic", labelKey: "writer.actionAcademic", icon: BookOpenCheck, apply: true },
  { action: "source", labelKey: "writer.actionSources", icon: FileSearch, apply: true },
  { action: "challenge", labelKey: "writer.actionChallenge", icon: ShieldCheck },
];

export function ProjectWriterStudio({
  project,
  initialRequest,
  onProjectChange,
  onOpenViva,
}: {
  project: ProjectDNA;
  initialRequest?: ProjectWriterRequest;
  onProjectChange?: (project: ProjectDNA) => void;
  onOpenViva?: () => void;
}) {
  const { t, meta } = useI18n();
  const [document, setDocument] = useState<ProjectDocument | null>(null);
  const [access, setAccess] = useState<ProjectAccess | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<SectionAction | "save" | "xray" | "feedback" | "export" | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [insight, setInsight] = useState<{ title: string; body: string; points: string[] } | null>(null);
  const [xray, setXray] = useState<ProjectXRayReport | null>(null);
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const requestedOnce = useRef(false);

  useEffect(() => {
    let active = true;
    api
      .projectDocument(project.id)
      .then((response) => {
        if (!active) return;
        setAccess(response.access);
        if (response.document) {
          setDocument(response.document);
          setSelectedId(response.document.sections[0]?.id || "");
          return;
        }
        if (initialRequest && !requestedOnce.current) {
          requestedOnce.current = true;
          void generate(initialRequest);
        }
      })
      .catch((caught) => {
        if (active) setError(caught.message || t("writer.openError"));
      });
    return () => {
      active = false;
    };
  }, [project.id]);

  const section = useMemo(
    () => document?.sections.find((item) => item.id === selectedId) || document?.sections[0],
    [document, selectedId],
  );
  useEffect(() => setDraft(section?.content || ""), [section?.id, section?.content]);

  async function generate(request: ProjectWriterRequest) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await api.generateProjectDocument(project.id, request);
      setDocument(response.document);
      setAccess(response.access);
      setSelectedId(response.document.sections[0]?.id || "");
      setNotice(
        response.notice ||
          t("writer.builtNotice").replace("{count}", String(response.document.sections.length)).replace("{variation}", response.document.variation.id),
      );
      onProjectChange?.(response.project);
    } catch (caught: any) {
      setError(caught.message || t("writer.buildError"));
    } finally {
      setBusy(false);
    }
  }

  async function saveSection() {
    if (!section?.artifactId || draft === section.content) return;
    setActionBusy("save");
    setError("");
    try {
      const response = await api.updateArtifact(project.id, section.artifactId, {
        content: draft,
      });
      updateSection(section.id, response.artifact.content);
      setNotice(t("writer.savedNotice"));
    } catch (caught: any) {
      setError(caught.message || t("writer.saveError"));
    } finally {
      setActionBusy("");
    }
  }

  function updateSection(id: string, content: string) {
    setDocument((current) =>
      current
        ? {
            ...current,
            updatedAt: new Date().toISOString(),
            sections: current.sections.map((item) =>
              item.id === id
                ? {
                    ...item,
                    content,
                    wordCount: content.trim() ? content.trim().split(/\s+/u).length : 0,
                  }
                : item,
            ),
          }
        : current,
    );
  }

  async function runAction(action: SectionAction, apply = false) {
    if (!section?.artifactId) return;
    if (!access?.canWriteFull) {
      window.location.assign(`/app/plans?project=${encodeURIComponent(project.id)}`);
      return;
    }
    if (draft !== section.content) await saveSection();
    setActionBusy(action);
    setError("");
    setInsight(null);
    try {
      const response = await api.projectSectionAction(project.id, section.artifactId, {
        action,
        assistanceMode: document?.assistanceMode || "practice",
        instruction:
          action === "translate"
            ? `Translate to ${document?.language || meta.aiName}`
            : undefined,
        apply,
      });
      if (response.applied) {
        updateSection(section.id, response.artifact.content);
        setDraft(response.artifact.content);
        setNotice(t("writer.actionApplied").replace("{action}", t(actionButtons.find((item) => item.action === action)?.labelKey || "writer.actionGeneric")));
      } else {
        setInsight({
          title: action === "challenge" ? t("writer.challengeInsight") : t("writer.explainInsight"),
          body: response.output.summary,
          points: [...response.output.findings, ...response.output.suggestions].slice(0, 8),
        });
      }
    } catch (caught: any) {
      setError(caught.message || t("writer.actionError"));
    } finally {
      setActionBusy("");
    }
  }

  async function runXRay() {
    if (!document) return;
    setActionBusy("xray");
    try {
      if (section && draft !== section.content) await saveSection();
      const fullDraft = document.sections
        .map((item) => (item.id === section?.id ? draft : item.content))
        .join("\n\n");
      const response = await api.projectXRay(project.id, fullDraft);
      setXray(response.report);
    } catch (caught: any) {
      setError(caught.message || t("writer.xrayError"));
    } finally {
      setActionBusy("");
    }
  }

  async function applyFeedback() {
    if (!document || !feedback.trim()) return;
    if (!access?.canWriteFull) {
      window.location.assign(`/app/plans?project=${encodeURIComponent(project.id)}`);
      return;
    }
    setActionBusy("feedback");
    try {
      const response = await api.generateProjectDocument(project.id, {
        mode: "revise",
        assistanceMode: document.assistanceMode,
        language: document.language,
        desiredPages: Math.max(3, Math.round(document.sections.reduce((sum, item) => sum + item.wordCount, 0) / 330)),
        academicTone: "clear",
        existingDraft: document.sections.map((item) => item.content).join("\n\n"),
        professorFeedback: feedback,
      });
      setDocument(response.document);
      setAccess(response.access);
      setSelectedId(response.document.sections[0]?.id || "");
      setFeedback("");
      setShowFeedback(false);
      setNotice(t("writer.feedbackApplied"));
    } catch (caught: any) {
      setError(caught.message || t("writer.feedbackError"));
    } finally {
      setActionBusy("");
    }
  }

  async function exportWord() {
    if (!access?.canExport) {
      window.location.assign(`/app/plans?project=${encodeURIComponent(project.id)}`);
      return;
    }
    setActionBusy("export");
    try {
      if (section && draft !== section.content) await saveSection();
      await api.exportProject(project.id, "docx");
    } catch (caught: any) {
      setError(caught.message || t("writer.exportError"));
    } finally {
      setActionBusy("");
    }
  }

  async function completePaidProject() {
    if (!document || !access?.unlocked) return;
    await generate({
      mode: "write",
      assistanceMode: document.assistanceMode,
      language: document.language,
      desiredPages: document.targetPages || 12,
      academicTone: "clear",
      topicNotes: t("writer.completeInstruction"),
    });
  }

  if (busy)
    return (
      <GenerationState mode={initialRequest?.mode || "write"} />
    );

  if (!document)
    return (
      <Card className="overflow-hidden">
        <CardContent className="py-12 text-center">
          <span className="h-16 w-16 rounded-[22px] brand-soft-bg grid place-items-center mx-auto"><WandSparkles size={26} /></span>
          <h2 className="text-2xl font-semibold mt-5">{t("writer.readyTitle")}</h2>
          <p className="body-copy mt-2 max-w-xl mx-auto">{t("writer.readyDesc")}</p>
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            <Button onClick={() => generate({ mode: "write", assistanceMode: "practice", language: meta.aiName, desiredPages: 12, academicTone: "clear" })}><Sparkles size={16} /> {t("writer.writeDraft")}</Button>
            <Button variant="outline" onClick={() => generate({ mode: "write", assistanceMode: "policy_strict", language: meta.aiName, desiredPages: 12, academicTone: "clear" })}><ShieldCheck size={16} /> {t("writer.strictMode")}</Button>
          </div>
          {error && <p role="alert" className="text-xs text-[var(--danger)] mt-4">{error}</p>}
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-5">
      <ProjectFlow document={document} />
      {document.accessTier === "preview" && (
        <section className="rounded-[24px] border border-amber-500/30 bg-amber-500/10 p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="h-12 w-12 rounded-2xl bg-[var(--panel)] grid place-items-center shrink-0"><LockKeyhole size={20} /></span>
              <div><div className="eyebrow">{t("writer.previewEyebrow")}</div><h2 className="section-title mt-1">{t("writer.previewTitle")}</h2><p className="text-xs leading-6 muted mt-2">{t("writer.previewDesc")}</p></div>
            </div>
            {access?.unlocked ? <Button onClick={completePaidProject} disabled={busy}><Sparkles size={15} /> {t("writer.completePages").replace("{count}", String(document.targetPages || 12))}</Button> : <Button onClick={() => window.location.assign(`/app/plans?project=${encodeURIComponent(project.id)}`)}><CreditCard size={15} /> {t("writer.unlockFull")}</Button>}
          </div>
        </section>
      )}
      {(notice || error) && (
        <div className={`rounded-xl px-4 py-3 text-xs flex items-start gap-2 ${error ? "bg-red-500/10 text-[var(--danger)]" : "brand-soft-bg"}`} role={error ? "alert" : "status"}>
          {error ? <AlertTriangle size={15} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={15} className="mt-0.5 shrink-0" />}
          <span>{error || notice}</span>
        </div>
      )}
      <div className="grid 2xl:grid-cols-[280px_minmax(0,1fr)_300px] xl:grid-cols-[250px_minmax(0,1fr)] gap-4 items-start">
        <Card className="xl:sticky xl:top-24">
          <CardContent className="p-3">
            <div className="px-2 py-2 flex items-center justify-between gap-3">
              <div><div className="eyebrow">{t("writer.sections")}</div><div className="text-xs font-semibold mt-1">{document.sections.length} {t("writer.sectionsUnit")}</div></div>
              <span className="rounded-full brand-soft-bg px-2 py-1 text-[9px] font-semibold">{document.variation.id}</span>
            </div>
            <div className="mt-2 space-y-1">
              {document.sections.map((item, index) => (
                <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`section-nav focus-ring w-full rounded-xl p-3 text-start flex items-start gap-3 ${item.id === section?.id ? "is-selected" : ""}`}>
                  <span className="h-7 w-7 rounded-lg soft-bg grid place-items-center text-[10px] font-semibold mono-number">{index + 1}</span>
                  <span className="min-w-0 flex-1"><strong className="block text-xs leading-5">{item.title}</strong><span className="block text-[9px] muted mt-1">{item.wordCount} {t("writer.words")}</span></span>
                  {item.status === "verified" ? <ShieldCheck size={13} className="text-emerald-600" /> : <span className="h-2 w-2 rounded-full bg-amber-500 mt-1.5" />}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 min-w-0">
          <Card>
            <CardContent className="p-0">
              <div className="px-4 md:px-5 py-4 border-b hairline flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0"><div className="eyebrow">{t("writer.currentSection")}</div><h2 className="section-title mt-1 truncate">{section?.title}</h2></div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] muted">{draft.trim() ? draft.trim().split(/\s+/u).length : 0} {t("writer.words")}</span>
                  <Button size="sm" variant="outline" onClick={saveSection} disabled={actionBusy === "save" || draft === section?.content}>{actionBusy === "save" ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />} {t("writer.save")}</Button>
                </div>
              </div>
              <div className="writer-toolbar px-3 md:px-5 py-3 border-b hairline flex gap-2 overflow-x-auto">
                {actionButtons.map(({ action, labelKey, icon: Icon, apply }) => (
                  <button key={action} type="button" onClick={() => runAction(action, apply)} disabled={Boolean(actionBusy)} className="writer-action focus-ring rounded-xl border hairline px-3 py-2 inline-flex items-center gap-2 text-[11px] font-semibold whitespace-nowrap">
                    {actionBusy === action ? <LoaderCircle size={14} className="animate-spin" /> : !access?.canWriteFull ? <LockKeyhole size={14} /> : <Icon size={14} />}{t(labelKey)}
                  </button>
                ))}
              </div>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label={t("writer.sectionContentAria").replace("{section}", section?.title || t("writer.projectFallback"))}
                className="writer-canvas w-full min-h-[650px] resize-y bg-[var(--panel)] p-6 md:p-10 text-[15px] md:text-base leading-[2.15] outline-none"
                spellCheck
              />
              <div className="px-5 py-3 border-t hairline text-[10px] muted flex flex-wrap justify-between gap-2">
                <span>{t("writer.versionNote")}</span>
                <span>{section?.rubricIds.length ? t("writer.rubricLinked").replace("{count}", String(section.rubricIds.length)) : t("writer.reviewRubric")}</span>
              </div>
            </CardContent>
          </Card>
          {insight && (
            <Card className="writer-insight">
              <CardContent>
                <div className="flex items-start justify-between gap-3"><div><div className="eyebrow">AcademicOS Coach</div><h3 className="section-title mt-1">{insight.title}</h3></div><Button variant="ghost" size="sm" onClick={() => setInsight(null)}>{t("writer.close")}</Button></div>
                <p className="body-copy mt-4 whitespace-pre-wrap">{insight.body}</p>
                {insight.points.length > 0 && <div className="grid sm:grid-cols-2 gap-2 mt-4">{insight.points.map((point) => <div key={point} className="rounded-xl bg-[var(--bg)] border hairline p-3 text-xs leading-6">{point}</div>)}</div>}
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-4 xl:col-span-2 2xl:col-span-1 2xl:sticky 2xl:top-24">
          <QualityCard document={document} />
          <Card>
            <CardContent>
              <div className="flex items-center gap-2"><ScanSearch size={17} className="brand-text" /><h3 className="text-sm font-semibold">Project X-Ray</h3></div>
              <p className="text-[11px] leading-5 muted mt-2">{t("writer.xrayDesc")}</p>
              <Button className="w-full mt-4" variant="outline" onClick={runXRay} disabled={actionBusy === "xray"}>{actionBusy === "xray" ? <LoaderCircle size={15} className="animate-spin" /> : <ScanSearch size={15} />} {t("writer.runXray")}</Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-center gap-2"><MessageSquareText size={17} className="brand-text" /><h3 className="text-sm font-semibold">{t("writer.feedbackTitle")}</h3></div>
              {!showFeedback ? <Button className="w-full mt-4" variant="outline" onClick={() => setShowFeedback(true)}>{t("writer.addFeedback")}</Button> : <div className="mt-4"><textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={5} className="field resize-y" placeholder={t("writer.feedbackPh")} /><Button className="w-full mt-2" onClick={applyFeedback} disabled={!feedback.trim() || actionBusy === "feedback"}>{actionBusy === "feedback" ? <LoaderCircle size={15} className="animate-spin" /> : <WandSparkles size={15} />} {t("writer.applyFeedback")}</Button></div>}
            </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={exportWord} disabled={actionBusy === "export"}>{actionBusy === "export" ? <LoaderCircle size={15} className="animate-spin" /> : access?.canExport ? <Download size={15} /> : <LockKeyhole size={15} />} Word</Button>
            <Button onClick={() => access?.canViva ? onOpenViva?.() : window.location.assign(`/app/plans?project=${encodeURIComponent(project.id)}`)}>{access?.canViva ? <Mic2 size={15} /> : <LockKeyhole size={15} />} {t("writer.viva")}</Button>
          </div>
        </aside>
      </div>
      {xray && <XRayPanel report={xray} onClose={() => setXray(null)} onOpenViva={() => access?.canViva ? onOpenViva?.() : window.location.assign(`/app/plans?project=${encodeURIComponent(project.id)}`)} />}
    </div>
  );
}

function GenerationState({ mode }: { mode: ProjectWriterRequest["mode"] }) {
  const { t } = useI18n();
  const stages = mode === "rescue"
    ? [t("writer.stageRead"), t("writer.stageSources"), t("writer.stageStructure"), t("writer.stageExplain")]
    : [t("writer.stageUnderstand"), t("writer.stagePlan"), t("writer.stageWrite"), t("writer.stageViva")];
  return <Card className="generation-state overflow-hidden"><CardContent className="py-12 md:py-16 text-center"><span className="generation-orb h-20 w-20 rounded-[28px] brand-soft-bg grid place-items-center mx-auto"><LoaderCircle size={30} className="animate-spin" /></span><h2 className="text-2xl md:text-3xl font-semibold mt-6">{mode === "rescue" ? t("writer.rebuilding") : t("writer.building")}</h2><p className="body-copy mt-2">{t("writer.sharedMemory")}</p><div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8 max-w-3xl mx-auto">{stages.map((stage, index) => <div key={stage} className="rounded-2xl bg-[var(--bg)] border hairline p-4"><span className="h-8 w-8 rounded-xl brand-soft-bg grid place-items-center mx-auto text-xs font-semibold">{index + 1}</span><div className="text-xs font-semibold mt-3">{stage}</div></div>)}</div><p className="text-[10px] muted mt-6">{t("writer.buildingNote")}</p></CardContent></Card>;
}

function ProjectFlow({ document }: { document: ProjectDocument }) {
  const { t } = useI18n();
  const steps = [
    { label: t("writer.flowAssignment"), icon: FileSearch, done: true },
    { label: t("writer.flowProject"), icon: BookOpenCheck, done: document.sections.length > 0 },
    { label: t("writer.flowSources"), icon: ShieldCheck, done: document.quality.sourceConfidence >= 60 },
    { label: t("writer.flowViva"), icon: Mic2, done: document.quality.discussability >= 75 },
  ];
  return <section className="project-flow panel-flat rounded-2xl p-3 md:p-4"><div className="grid grid-cols-4 gap-2">{steps.map(({ label, icon: Icon, done }, index) => <div key={label} className={`project-flow-step ${done ? "is-done" : ""}`}><span className="project-flow-icon"><Icon size={16} /></span><span className="hidden sm:block text-[10px] font-semibold">{label}</span>{index < steps.length - 1 && <ArrowLeft size={13} className="project-flow-arrow directional-icon" />}</div>)}</div></section>;
}

function QualityCard({ document }: { document: ProjectDocument }) {
  const { t } = useI18n();
  const metrics = [
    ["Rubric", document.quality.rubricCoverage],
    [t("writer.metricSources"), document.quality.sourceConfidence],
    [t("writer.metricCoherence"), document.quality.coherence],
    [t("writer.metricViva"), document.quality.discussability],
  ] as const;
  return <Card><CardContent><div className="flex items-center justify-between gap-3"><div><div className="eyebrow">{t("writer.health")}</div><h3 className="text-sm font-semibold mt-1">{t("writer.quickPanel")}</h3></div><PanelRightOpen size={17} className="muted" /></div><div className="quality-rings grid grid-cols-2 gap-3 mt-5">{metrics.map(([label, value]) => <div key={label} className="quality-ring" style={{ "--score": value } as React.CSSProperties}><div className="quality-ring__dial"><strong>{value}</strong><span>%</span></div><div className="text-[10px] font-semibold mt-2">{label}</div></div>)}</div>{document.integrityWarnings[0] && <div className="rounded-xl bg-amber-500/10 text-[var(--warning)] p-3 text-[10px] leading-5 mt-4 flex gap-2"><AlertTriangle size={13} className="shrink-0 mt-0.5" />{document.integrityWarnings[0]}</div>}</CardContent></Card>;
}

function XRayPanel({ report, onClose, onOpenViva }: { report: ProjectXRayReport; onClose: () => void; onOpenViva?: () => void }) {
  const { t } = useI18n();
  const scores = Object.entries(report.scores) as Array<[string, number]>;
  return <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center p-0 md:p-4"><button className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={onClose} aria-label={t("writer.closeXray")} /><section role="dialog" aria-modal="true" aria-labelledby="xray-title" className="relative panel w-full max-w-5xl max-h-[92vh] overflow-auto rounded-t-[28px] md:rounded-[28px]"><div className="sticky top-0 z-10 bg-[var(--panel)] border-b hairline px-5 py-4 flex items-center justify-between gap-4"><div><div className="eyebrow">Project X-Ray</div><h2 id="xray-title" className="section-title mt-1">{t("writer.xrayTitle")}</h2></div><Button variant="ghost" size="sm" onClick={onClose}>{t("writer.close")}</Button></div><div className="p-5 md:p-7"><div className="grid grid-cols-2 md:grid-cols-5 gap-3">{scores.map(([key, value]) => <div key={key} className="rounded-2xl soft-bg p-4 text-center"><div className="text-2xl font-semibold mono-number">{value}%</div><div className="text-[10px] muted mt-1">{key}</div></div>)}</div><div className="grid lg:grid-cols-[1.2fr_.8fr] gap-5 mt-6"><div><h3 className="text-sm font-semibold">{t("writer.xrayFindings")}</h3><div className="space-y-2 mt-3">{report.findings.map((finding) => <div key={finding.id} className="rounded-2xl border hairline p-4 flex gap-3"><span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${finding.severity === "good" ? "brand-soft-bg" : finding.severity === "critical" ? "bg-red-500/10 text-[var(--danger)]" : "bg-amber-500/10 text-[var(--warning)]"}`}>{finding.severity === "good" ? <Check size={16} /> : <AlertTriangle size={16} />}</span><div><strong className="text-xs">{finding.title}</strong><p className="text-[11px] leading-5 muted mt-1">{finding.detail}</p><p className="text-[11px] leading-5 mt-2">{finding.action}</p></div></div>)}</div></div><aside><h3 className="text-sm font-semibold">{t("writer.professorQuestions")}</h3><div className="space-y-2 mt-3">{report.professorQuestions.map((question, index) => <div key={question} className="rounded-2xl brand-soft-bg p-4 text-xs leading-6"><span className="font-semibold me-2">{index + 1}.</span>{question}</div>)}</div><Button className="w-full mt-4" onClick={onOpenViva}><Mic2 size={15} /> {t("writer.startViva")}</Button></aside></div></div></section></div>;
}

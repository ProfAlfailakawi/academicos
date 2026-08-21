import React, { useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardPaste,
  FileText,
  LoaderCircle,
  Mic,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import type { ProjectDNA } from "../types";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

const MAX = 20 * 1024 * 1024;

export function UploadAssignment() {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const [compiled, setCompiled] = useState<{
    project: ProjectDNA;
    job: {
      id: string;
      state: string;
      progress: number;
      stages: Array<{ key: string; label: string; state: string; at?: string }>;
    };
  } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  async function filePayload(f: File) {
    if (f.size > MAX)
      throw new Error(t("upload.fileTooLarge"));
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.readAsDataURL(f);
    });
    return {
      name: f.name,
      mimeType: f.type || "application/octet-stream",
      base64,
      size: f.size,
    };
  }

  async function compile() {
    if (!text.trim() && !files.length) return;
    setError("");
    setProcessing(true);
    try {
      const result = await api.createProject({
        textContext: text.trim() || undefined,
        files: files.length
          ? await Promise.all(files.map(filePayload))
          : undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setCompiled(result);
      setProcessing(false);
    } catch (e: any) {
      setError(e.message || t("upload.compileError"));
      setProcessing(false);
    }
  }
  async function pasteText() {
    try {
      const value = await navigator.clipboard.readText();
      if (value) setText((old) => (old ? `${old}\n\n${value}` : value));
    } catch {
      setError(t("upload.clipboardDenied"));
    }
  }
  function dictate() {
    const Ctor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!Ctor) {
      setError(t("upload.dictationUnsupported"));
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "ar-KW";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setError(t("upload.dictationError"));
    };
    recognition.onresult = (event: any) => {
      const value = String(event.results?.[0]?.[0]?.transcript || "").trim();
      if (value) setText((old) => (old ? `${old}\n${value}` : value));
    };
    recognition.start();
  }

  if (compiled) {
    const p = compiled.project;
    const ambiguous = p.requirements.filter(
      (r) => r.confidence === "needs_confirmation",
    ).length;
    const deadlineCount =
      (p.deadlines.final ? 1 : 0) + (p.deadlines.milestones?.length || 0);
    const summary = `${p.requirements.length} ${t("upload.unitReq")} · ${p.deliverables.length} ${t("upload.unitDeliv")} · ${p.rubric.length} ${t("upload.unitRubric")}${ambiguous ? ` · ${ambiguous} ${t("upload.unitNeedsConfirm")}` : ""}`;
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="AcademicOS Moment"
          title={t("upload.workspaceReadyTitle")}
          description={t("upload.workspaceReadyDesc")}
        />
        <section className="panel-flat rounded-3xl overflow-hidden">
          <div className="p-6 md:p-9">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-7">
              <div className="max-w-3xl">
                <div className="h-12 w-12 rounded-2xl brand-soft-bg grid place-items-center">
                  <Sparkles size={20} className="brand-text" />
                </div>
                <div className="eyebrow mt-5">Your workspace is ready</div>
                <h1 className="text-3xl md:text-4xl font-semibold tracking-[-0.04em] mt-2">
                  {p.title}
                </h1>
                <p className="body-copy mt-3">{t("upload.workspaceReadyBody")}</p>
              </div>
              <Button
                onClick={() =>
                  navigate(`/app/project/${p.id}`, {
                    replace: true,
                    state: { justCompiled: true, compileSummary: summary },
                  })
                }
              >
                {t("upload.enterWorkspace")} <ArrowLeft size={16} />
              </Button>
            </div>
            <div className="mt-8 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <Result label={t("upload.requirements")} value={p.requirements.length} />
              <Result label={t("upload.deliverables")} value={p.deliverables.length} />
              <Result label="Rubric" value={p.rubric.length} />
              <Result
                label={t("upload.unconfirmed")}
                value={ambiguous}
                attention={ambiguous > 0}
              />
              <Result label={t("upload.aiConstraints")} value={p.aiPolicy.prohibited.length} />
              <Result label={t("upload.deadlines")} value={deadlineCount} />
            </div>
          </div>
        </section>
        <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
          <Card>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="brand-text" />
                <div>
                  <div className="eyebrow">Real job trace</div>
                  <h2 className="section-title mt-1">{t("upload.whatCompleted")}</h2>
                </div>
              </div>
              <div className="mt-5 divide-y hairline">
                {compiled.job.stages.map((stage, i) => (
                  <div key={stage.key} className="py-3 flex items-center gap-3">
                    <div
                      className={`h-7 w-7 rounded-lg grid place-items-center ${stage.state === "completed" ? "brand-soft-bg" : "soft-bg"}`}
                    >
                      {stage.state === "completed" ? (
                        <CheckCircle2 size={13} />
                      ) : (
                        <span className="text-[10px] mono-number">{i + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold">{stage.label}</div>
                      {stage.at && (
                        <div className="text-[9px] muted mt-1">
                          {new Date(stage.at).toLocaleString("ar-KW")}
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] muted">{stage.state}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="eyebrow">Project DNA</div>
              <h2 className="section-title mt-1">{t("upload.whatUnderstood")}</h2>
              <div className="mt-4 space-y-3 text-xs">
                <Line label={t("upload.projectType")} value={p.projectType} />
                <Line label={t("upload.domain")} value={p.academicDomain} />
                <Line
                  label={t("upload.workMode")}
                  value={p.collaborationMode === "group" ? t("upload.group") : t("upload.individual")}
                />
                <Line label={t("upload.aiPolicy")} value={`Level ${p.aiPolicy.level}`} />
                <Line
                  label="Workspaces"
                  value={String(p.workspaceModules.length)}
                />
              </div>
              <div className="mt-5 rounded-xl bg-[var(--bg)] border hairline p-3 text-[10px] leading-5 muted">
                Job ID:{" "}
                <span dir="ltr" className="font-mono">
                  {compiled.job.id}
                </span>{" "}
                · {compiled.job.progress}% · {compiled.job.state}
              </div>
            </CardContent>
          </Card>
        </div>
        {p.originalAssignment?.attachments?.length ? (
          <div className="mt-5 grid md:grid-cols-2 gap-2">
            {p.originalAssignment.attachments.map((file) => (
              <div
                key={file.fileName}
                className="rounded-xl border hairline bg-[var(--bg)] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold truncate">
                    {file.fileName}
                  </span>
                  <span className="rounded-full brand-soft-bg px-2 py-1 text-[9px] font-semibold">
                    {file.extraction?.mode || "unknown"}
                  </span>
                </div>
                <div className="text-[10px] muted mt-2">
                  {file.extraction?.provider || t("upload.noExtractionData")}
                  {file.extraction?.confidence !== undefined
                    ? ` · ${t("upload.confidence")} ${Math.round(file.extraction.confidence * 100)}%`
                    : ""}
                  {file.extraction?.agreement !== undefined
                    ? ` · ${t("upload.agreement")} ${Math.round(file.extraction.agreement * 100)}%`
                    : ""}
                </div>
                {file.extraction?.warnings.map((w) => (
                  <div
                    key={w}
                    className="text-[9px] text-[var(--warning)] mt-1"
                  >
                    {w}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Universal Assignment Compiler"
        title={t("upload.mainTitle")}
        description={t("upload.mainDesc")}
      />
      <div className="grid xl:grid-cols-[1fr_340px] gap-5 items-start">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const added = Array.from(e.dataTransfer.files);
                setFiles((old) => [...old, ...added].slice(0, 10));
              }}
              className="focus-ring w-full min-h-52 paper-grid flex flex-col items-center justify-center p-7 text-center border-b hairline hover:bg-[var(--panel-2)] transition-colors"
            >
              <div className="h-14 w-14 rounded-2xl brand-soft-bg flex items-center justify-center">
                <UploadCloud size={23} />
              </div>
              <h2 className="section-title mt-4">{t("upload.dropzoneTitle")}</h2>
              <p className="body-copy mt-2 max-w-xl">{t("upload.dropzoneDesc")}</p>
              <input
                ref={input}
                type="file"
                multiple
                className="hidden"
                onChange={(e) =>
                  setFiles((old) =>
                    [...old, ...Array.from(e.target.files || [])].slice(0, 10),
                  )
                }
                accept=".pdf,.docx,.pptx,.xlsx,.zip,.csv,.txt,.md,.json,image/*,audio/*,video/*"
              />
            </button>
            <div className="px-4 py-3 border-b hairline flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] muted">{t("upload.cameraHint")}</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={pasteText}
                >
                  <ClipboardPaste size={14} />
                  {t("upload.paste")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={dictate}
                  disabled={listening}
                >
                  <Mic size={14} />
                  {listening ? t("upload.listening") : t("upload.dictate")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => cameraInput.current?.click()}
                >
                  <Camera size={14} />
                  {t("upload.capturePhoto")}
                </Button>
              </div>
              <input
                ref={cameraInput}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const captured = Array.from(e.target.files || []);
                  setFiles((old) => [...old, ...captured].slice(0, 10));
                  e.currentTarget.value = "";
                }}
              />
            </div>
            {files.length > 0 && (
              <div className="p-4 border-b hairline space-y-2">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}_${file.lastModified}_${index}`}
                    className="flex items-center gap-3 rounded-xl bg-[var(--bg)] border hairline p-3"
                  >
                    <div className="h-9 w-9 rounded-lg soft-bg flex items-center justify-center">
                      <FileText size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">
                        {file.name}
                      </div>
                      <div className="text-[10px] muted mono-number">
                        {(file.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                        {file.type || "unknown type"}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setFiles((v) => v.filter((_, i) => i !== index))
                      }
                      aria-label={`${t("upload.delete")} ${file.name}`}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="p-5 md:p-6">
              <label className="text-sm font-semibold" htmlFor="assignmentText">
                {t("upload.pasteInstructions")}
              </label>
              <textarea
                id="assignmentText"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("upload.textPlaceholder")}
                className="focus-ring mt-3 w-full min-h-56 rounded-xl border hairline bg-[var(--bg)] p-4 text-sm leading-7 resize-y"
              />
              <div className="flex items-center justify-between gap-4 mt-4">
                <div className="text-[11px] muted">{t("upload.uncertainHint")}</div>
                <Button
                  onClick={compile}
                  disabled={processing || (!text.trim() && !files.length)}
                >
                  {processing ? (
                    <>
                      <LoaderCircle size={16} className="animate-spin" />
                      {t("upload.processing")}
                    </>
                  ) : (
                    <>
                      {t("upload.buildWorkspace")} <ArrowLeft size={16} />
                    </>
                  )}
                </Button>
              </div>
              {error && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl bg-[#f5e6e3] dark:bg-[#382522] p-3 text-sm text-[var(--danger)] flex gap-2"
                >
                  <AlertCircle size={17} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <aside className="space-y-4">
          <Card>
            <CardContent>
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="brand-text" />
                <h3 className="text-sm font-semibold">{t("upload.whatHappens")}</h3>
              </div>
              <ol className="mt-4 space-y-4">
                {[
                  t("upload.step1"),
                  t("upload.step2"),
                  t("upload.step3"),
                  t("upload.step4"),
                  t("upload.step5"),
                ].map((x, i) => (
                  <li key={x} className="flex gap-3 text-xs leading-5">
                    <span className="h-5 w-5 rounded-full brand-soft-bg flex items-center justify-center shrink-0 mono-number">
                      {i + 1}
                    </span>
                    <span>{x}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <h3 className="text-sm font-semibold">{t("upload.noFakeProgressTitle")}</h3>
              <p className="body-copy mt-2">{t("upload.noFakeProgressBody")}</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Result({
  label,
  value,
  attention = false,
}: {
  label: string;
  value: number;
  attention?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-[var(--bg)] border hairline p-4">
      <div className="text-[10px] muted">{label}</div>
      <div
        className={`text-2xl font-semibold mt-2 mono-number ${attention && value ? "text-[var(--warning)]" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="muted">{label}</span>
      <span className="font-semibold text-end">{value}</span>
    </div>
  );
}

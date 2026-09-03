import { localizedUiError } from "../lib/ui-error";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { CheckCircle2, GraduationCap, Lightbulb, ListChecks, AlertTriangle, Play, Square, Sparkles, ShieldCheck, UploadCloud, BrainCircuit, Clock3, FileText, LoaderCircle, Target } from "lucide-react";
import { api } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useI18n, LOCALES, localeMeta } from "../lib/i18n";
import type { LearningBrain } from "../types";

type Tab = "explain" | "solve";
type ExamIntake = Awaited<ReturnType<typeof api.learnIntake>>;
const MAX_STUDY_FILE_BYTES = 20 * 1024 * 1024;
async function toStudyFile(file: File) {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(file);
  });
  return { name: file.name, mimeType: file.type || "application/octet-stream", base64, size: file.size };
}

// Browser Web Speech narration; language follows the selected interface locale.
function speak(text: string, bcp47: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return false;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = bcp47;
    const match = synth.getVoices().find((v) => v.lang === bcp47) || synth.getVoices().find((v) => v.lang.startsWith(bcp47.split("-")[0]));
    if (match) u.voice = match;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}
function stopSpeak() { try { window.speechSynthesis?.cancel(); } catch {} }

export function LearnStudio() {
  const { t, locale, meta, setLocale } = useI18n();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>("explain");
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("beginner");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lesson, setLesson] = useState<Awaited<ReturnType<typeof api.learnExplain>>["lesson"] | null>(null);
  const [lessonSource, setLessonSource] = useState<string>("");
  const [solve, setSolve] = useState<Awaited<ReturnType<typeof api.learnSolve>> | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [brain, setBrain] = useState<LearningBrain | null>(null);
  const [examIntake, setExamIntake] = useState<ExamIntake | null>(null);
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [examDate, setExamDate] = useState(() => localStorage.getItem("academicos.examDate") || "");
  const studyFileRef = useRef<HTMLInputElement>(null);
  const speakBcp = localeMeta(locale).speech;

  useEffect(() => {
    api.learningBrain()
      .then((response) => setBrain(response.brain))
      .catch((e) => {
        console.error("Failed to load learning brain", e);
        setError(localizedUiError(e, t, "ui.loadError"));
      });
    const state = location.state as { seedProblem?: string; openSolve?: boolean; examIntake?: ExamIntake } | null;
    if (state?.seedProblem) setProblem(state.seedProblem);
    if (state?.openSolve) setTab("solve");
    if (state?.examIntake) setExamIntake(state.examIntake);
    return () => stopSpeak();
  }, []);

  useEffect(() => {
    if (examDate) localStorage.setItem("academicos.examDate", examDate);
    else localStorage.removeItem("academicos.examDate");
  }, [examDate]);

  async function ingestStudyFiles(fileList: FileList | null) {
    const files = Array.from(fileList || []).slice(0, 5);
    if (!files.length) return;
    const oversized = files.find((file) => file.size > MAX_STUDY_FILE_BYTES);
    if (oversized) { setError(t("learn.fileTooLarge").replace("{name}", oversized.name)); return; }
    setIntakeBusy(true); setError("");
    try {
      const response = await api.learnIntake({ files: await Promise.all(files.map(toStudyFile)) });
      setExamIntake(response);
      if (!topic.trim() && response.guide.keyIdeas[0]) setTopic(response.guide.keyIdeas[0].slice(0, 550));
    } catch (caught: any) {
      setError(localizedUiError(caught, t, "learn.intakeError"));
    } finally {
      setIntakeBusy(false);
      if (studyFileRef.current) studyFileRef.current.value = "";
    }
  }

  const runExplain = useCallback(async () => {
    if (!topic.trim()) return;
    setBusy(true); setError(""); setLesson(null); stopSpeak(); setSpeaking(false);
    try {
      const r = await api.learnExplain({ topic: topic.trim(), language: meta.aiName, level, context: examIntake?.materialText.slice(0, 560) });
      setLesson(r.lesson); setLessonSource(r.source);
    } catch { setError(t("learn.error")); }
    finally { setBusy(false); }
  }, [topic, level, meta.aiName, t, examIntake]);

  const runSolve = useCallback(async () => {
    if (!problem.trim()) return;
    setBusy(true); setError(""); setSolve(null); stopSpeak(); setSpeaking(false);
    try {
      const r = await api.learnSolve({ problem: problem.trim(), language: meta.aiName, context: examIntake?.materialText.slice(0, 760) });
      setSolve(r);
    } catch { setError(t("learn.error")); }
    finally { setBusy(false); }
  }, [problem, meta.aiName, t, examIntake]);

  const narrate = useCallback((parts: string[]) => {
    const text = parts.filter(Boolean).join(". ");
    if (!text) return;
    if (speaking) { stopSpeak(); setSpeaking(false); return; }
    const ok = speak(text, speakBcp);
    setSpeaking(ok);
  }, [speaking, speakBcp]);

  const Section = ({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) =>
    items.length ? (
      <div className="mt-5">
        <div className="flex items-center gap-2 section-title">{icon}{title}</div>
        <ol className="mt-2 space-y-2 list-decimal ms-5">
          {items.map((x, i) => <li key={i} className="text-sm leading-relaxed">{x}</li>)}
        </ol>
      </div>
    ) : null;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("ui.examCoach")}
        title={t("learn.heroTitle")}
        description={t("learn.heroDescription")}
        action={
          <label className="flex items-center gap-2 text-xs">
            <span className="muted">{t("app.language")}</span>
            <select
              className="field rounded-lg px-2 py-1"
              value={locale}
              onChange={(e) => setLocale(e.target.value as any)}
            >
              {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </label>
        }
      />

      <Card className="overflow-hidden">
        <CardContent>
          <div className="grid xl:grid-cols-[1.1fr_.9fr] gap-5 items-start">
            <div>
              <div className="flex items-center gap-3"><span className="h-11 w-11 rounded-2xl tone-tile"><BrainCircuit size={19} /></span><div><div className="eyebrow">{t("ui.examAutopilot")}</div><h2 className="section-title mt-1">{t("learn.autopilotTitle")}</h2></div></div>
              <p className="body-copy mt-3">{t("learn.autopilotDescription")}</p>
              <input ref={studyFileRef} type="file" multiple className="hidden" accept=".pdf,.docx,.pptx,.txt,.md,image/*" onChange={(event) => ingestStudyFiles(event.target.files)} />
              <div className="flex flex-wrap gap-2 mt-4">
                <Button variant="outline" onClick={() => studyFileRef.current?.click()} disabled={intakeBusy}>{intakeBusy ? <LoaderCircle size={16} className="animate-spin" /> : <UploadCloud size={16} />}{intakeBusy ? t("learn.readingMaterial") : t("learn.uploadMaterial")}</Button>
                <label className="inline-flex items-center gap-2 rounded-xl border hairline px-3 py-2 text-xs"><Clock3 size={14} /><span className="muted">{t("learn.examDate")}</span><input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} className="bg-transparent outline-none" /></label>
              </div>
            </div>
            <div className="rounded-2xl brand-soft-bg p-5">
              <div className="flex items-center gap-2 text-xs font-semibold"><Target size={15} /> {t("learn.todaySession")}</div>
              {brain?.recommendedFocus?.[0] ? <><strong className="block mt-3">{brain.recommendedFocus[0].skill}</strong><p className="text-xs leading-6 mt-2 opacity-80">{t("learn.focusReason")}</p></> : <><strong className="block mt-3">{t("learn.startOneMaterial")}</strong><p className="text-xs leading-6 mt-2 opacity-80">{t("learn.startOneMaterialDesc")}</p></>}
              {examDate && <div className="mt-3 text-[10px] font-semibold">{Math.max(0, Math.ceil((new Date(`${examDate}T23:59:59`).getTime() - Date.now()) / 86400000))} {t("learn.daysRemaining")}</div>}
            </div>
          </div>
          {examIntake && <div className="mt-5 border-t hairline pt-5">
            <div className="flex items-start gap-3"><span className="h-9 w-9 rounded-xl soft-bg grid place-items-center shrink-0"><FileText size={16} /></span><div className="flex-1"><div className="text-xs font-semibold">{t("learn.materialMapReady")}</div><p className="text-xs leading-6 muted mt-1">{examIntake.guide.summary}</p></div></div>
            {examIntake.guide.keyIdeas.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{examIntake.guide.keyIdeas.slice(0, 6).map((idea, index) => <button key={index} onClick={() => { setTab("explain"); setTopic(idea.slice(0, 550)); }} className="focus-ring rounded-full border hairline px-3 py-1.5 text-[10px] font-semibold hover:bg-[var(--panel-2)]">{t("learn.explainPrefix")}: {idea.slice(0, 70)}</button>)}</div>}
            {examIntake.guide.examPrompts[0] && <div className="mt-4 rounded-xl soft-bg p-4"><div className="text-[10px] muted">{t("learn.suggestedQuestion")}</div><p className="text-sm leading-7 mt-1">{examIntake.guide.examPrompts[0]}</p><Button size="sm" className="mt-3" onClick={() => { setTab("solve"); setProblem(examIntake.guide.examPrompts[0]); }}>{t("learn.testMe")}</Button></div>}
            {examIntake.guide.warnings.length > 0 && <div className="mt-3 text-[10px] text-warning">{examIntake.guide.warnings[0]}</div>}
          </div>}
        </CardContent>
      </Card>

      <div className="understanding-flow" aria-label={t("learn.trainingJourney")}>
        {[t("learn.flowPaste"), t("learn.flowHint"), t("learn.flowUnderstand"), t("learn.flowLock")].map((label, index) => <div key={label} className="understanding-step"><span>{index + 1}</span><CheckCircle2 size={20} /><strong>{label}</strong></div>)}
      </div>

      <div className="flex gap-2">
        {(["explain", "solve"] as Tab[]).map((x) => (
          <button
            key={x}
            onClick={() => setTab(x)}
            className={`focus-ring rounded-xl px-4 py-2 text-sm font-semibold border hairline ${tab === x ? "brand-soft-bg brand-text" : "bg-[var(--bg)]"}`}
          >
            {x === "explain" ? <Sparkles size={15} className="inline me-1" /> : <GraduationCap size={15} className="inline me-1" />}
            {x === "explain" ? t("learn.explainTopic") : t("learn.solveExam")}
          </button>
        ))}
      </div>

      {tab === "explain" ? (
        <Card>
          <CardContent>
            <label className="text-xs muted">{t("learn.topic")}</label>
            <input className="field w-full rounded-xl px-3 py-2 mt-1" placeholder={t("learn.topicPh")} value={topic} onChange={(e) => setTopic(e.target.value)} />
            <div className="flex items-center gap-3 mt-3">
              <select className="field rounded-lg px-2 py-2 text-sm" value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="beginner">{t("level.beginner")}</option>
                <option value="intermediate">{t("level.intermediate")}</option>
                <option value="advanced">{t("level.advanced")}</option>
              </select>
              <Button onClick={runExplain} disabled={busy || !topic.trim()}>{busy ? t("learn.loading") : t("learn.go")}</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <label className="text-xs muted">{t("learn.problem")}</label>
            <textarea className="field w-full rounded-xl px-3 py-2 mt-1 min-h-28" placeholder={t("learn.problemPh")} value={problem} onChange={(e) => setProblem(e.target.value)} />
            <div className="mt-3"><Button onClick={runSolve} disabled={busy || !problem.trim()}>{busy ? t("learn.loading") : t("learn.go")}</Button></div>
          </CardContent>
        </Card>
      )}

      {error && <div className="text-sm text-danger">{error}</div>}

      {tab === "explain" && lesson && (
        <Card>
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{lesson.topic}</h2>
              <div className="flex items-center gap-2">
                {lessonSource === "cache" && <span className="text-[10px] brand-text flex items-center gap-1"><ShieldCheck size={12} />{t("learn.sourceCache")}</span>}
                <Button variant="ghost" onClick={() => narrate([lesson.intuition, ...lesson.buildingBlocks])}>
                  {speaking ? <><Square size={14} className="inline me-1" />{t("learn.stop")}</> : <><Play size={14} className="inline me-1" />{t("learn.listen")}</>}
                </Button>
              </div>
            </div>
            {lesson.notice && <div className="mt-2 text-[11px] muted">{lesson.notice}</div>}
            <div className="mt-4 rounded-xl brand-soft-bg p-4">
              <div className="flex items-center gap-2 section-title"><Lightbulb size={15} />{t("learn.intuition")}</div>
              <p className="mt-2 text-sm leading-relaxed">{lesson.intuition}</p>
            </div>
            <Section icon={<ListChecks size={15} />} title={t("learn.buildingBlocks")} items={lesson.buildingBlocks} />
            <Section icon={<GraduationCap size={15} />} title={t("learn.checkYourself")} items={lesson.checkYourself} />
            <Section icon={<AlertTriangle size={15} />} title={t("learn.mistakes")} items={lesson.commonMistakes} />
          </CardContent>
        </Card>
      )}

      {tab === "solve" && solve && (
        <Card>
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs muted">{solve.result.mode === "worked" ? t("learn.workedNote") : t("learn.guidedNote")}</div>
              <Button variant="ghost" onClick={() => narrate([solve.result.finalAnswer || solve.result.strategy || "", ...solve.result.steps])}>
                {speaking ? <><Square size={14} className="inline me-1" />{t("learn.stop")}</> : <><Play size={14} className="inline me-1" />{t("learn.listen")}</>}
              </Button>
            </div>
            {solve.result.mode === "worked" && solve.result.finalAnswer && (
              <div className="mt-4 rounded-xl brand-soft-bg p-4">
                <div className="section-title">{t("learn.finalAnswer")}</div>
                <p className="mt-2 text-sm font-semibold leading-relaxed">{solve.result.finalAnswer}</p>
              </div>
            )}
            {solve.result.mode === "guided" && solve.result.strategy && (
              <div className="mt-4 rounded-xl brand-soft-bg p-4">
                <div className="section-title">{t("learn.strategy")}</div>
                <p className="mt-2 text-sm leading-relaxed">{solve.result.strategy}</p>
              </div>
            )}
            <Section icon={<ListChecks size={15} />} title={t("learn.steps")} items={solve.result.steps} />
            <Section icon={<ShieldCheck size={15} />} title={t("learn.verify")} items={solve.result.verify} />
            {solve.result.practiceQuestion && <div className="mt-5 rounded-2xl border border-dashed border-[var(--brand)]/35 brand-soft-bg p-5"><div className="flex items-center gap-2 section-title"><GraduationCap size={16} />{t("learn.practiceSimilar")}</div><p className="mt-3 text-sm leading-7">{solve.result.practiceQuestion}</p></div>}
            <Section icon={<AlertTriangle size={15} />} title={t("learn.caveats")} items={solve.result.caveats} />
            <div className="mt-5 text-[11px] muted border-t hairline pt-3">{solve.result.disclosure}</div>
          </CardContent>
        </Card>
      )}

      {!lesson && !solve && !busy && !error && (
        <div className="text-sm muted text-center py-10">{t("learn.empty")}</div>
      )}
    </div>
  );
}

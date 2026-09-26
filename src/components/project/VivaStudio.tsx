import {
  localizedUiError } from "../../lib/ui-error";
import React,
  { useEffect,
  useMemo,
  useRef,
  useState } from "react";
import {
  CheckCircle2,
  GraduationCap,
  Headphones,
  Mic,
  MicOff,
  Play,
  ShieldCheck,
  SkipForward,
  Square,
  Volume2,
} from "lucide-react";
import { api } from "../../lib/api";
import type { LearningEvidenceRecord, ProjectDNA, VivaMode, VivaSession } from "../../types";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { formatDateTime, useI18n } from "../../lib/i18n";
import { InlineLoader } from "../ui/AcademicLoader";
import { speechRecognitionLangs, startDictation } from "../../lib/speech";
import { questionSeconds, type VivaTimeSetting } from "../../lib/viva-access";

const ACCESS_KEY = "academicos.viva.access.v1";
type VivaAccess = { time: VivaTimeSetting; screenReader: boolean };
function loadAccess(): VivaAccess {
  try {
    const raw = JSON.parse(localStorage.getItem(ACCESS_KEY) || "{}");
    const time: VivaTimeSetting = ["off", "standard", "extended150", "extended200"].includes(raw.time) ? raw.time : "off";
    return { time, screenReader: Boolean(raw.screenReader) };
  } catch {
    return { time: "off", screenReader: false };
  }
}

function speak(text: string, lang = "en-US") {
  try {
    if (!window.speechSynthesis || !text.trim()) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.lang === lang)
      || voices.find((voice) => voice.lang.startsWith(lang.split("-")[0]))
      || null;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function VivaStudio({ project }: { project: ProjectDNA }) {
  const { t, meta, locale, formatNumber } = useI18n();
  const [access, setAccessState] = useState<VivaAccess>(loadAccess);
  const setAccess = (patch: Partial<VivaAccess>) =>
    setAccessState((current) => {
      const next = { ...current, ...patch };
      try { localStorage.setItem(ACCESS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  const [interim, setInterim] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const questionHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const [mode, setMode] = useState<VivaMode>("normal");
  const [session, setSession] = useState<VivaSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<LearningEvidenceRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [autoVoice, setAutoVoice] = useState(() => !loadAccess().screenReader);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    api.learningEvidence(project.id)
      .then((r) => setEvidence(r.evidence))
      .catch((e) => {
        console.error("Failed to load viva learning evidence", e);
        setError(localizedUiError(e, t, "ui.loadError"));
      });
    return () => {
      try { recognitionRef.current?.(); } catch {}
      try { window.speechSynthesis?.cancel(); } catch {}
    };
  }, [project.id]);

  const activeQuestion = useMemo(() => session?.questions[currentIndex] || null, [session, currentIndex]);
  const existingAnswer = activeQuestion && session
    ? session.responses.find((response) => response.questionId === activeQuestion.id)?.answer || ""
    : "";
  const activeAnswer = activeQuestion ? (answers[activeQuestion.id] ?? existingAnswer) : "";

  // Screen-reader flow: announce and focus each new question.
  useEffect(() => {
    if (!activeQuestion || !session || session.status === "completed") return;
    setAnnouncement(
      t("viva.a11y.questionOf")
        .replace("{n}", formatNumber(currentIndex + 1))
        .replace("{total}", formatNumber(session.questions.length))
        .replace("{q}", activeQuestion.prompt),
    );
    window.setTimeout(() => questionHeadingRef.current?.focus(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuestion?.id, session?.status]);

  // Optional per-question time budget (standard or extended). Advisory only:
  // answers are never auto-submitted when time runs out.
  useEffect(() => {
    if (!activeQuestion || !session || session.status === "completed") return setSecondsLeft(null);
    const budget = questionSeconds(session.mode, access.time);
    if (!budget) return setSecondsLeft(null);
    setSecondsLeft(budget);
    const timer = window.setInterval(() => {
      setSecondsLeft((value) => {
        if (value === null) return value;
        const next = value - 1;
        if (next === 60) setAnnouncement(t("viva.a11y.oneMinute"));
        if (next === 0) setAnnouncement(t("viva.a11y.timeUp"));
        return Math.max(0, next);
      });
    }, 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuestion?.id, session?.status, access.time]);

  useEffect(() => {
    if (!activeQuestion || !autoVoice || !session || session.status === "completed") return;
    const timer = window.setTimeout(() => {
      setSpeaking(speak(activeQuestion.prompt, meta.speech));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [activeQuestion?.id, autoVoice, session?.status, meta.speech]);

  async function start() {
    setBusy(true); setError("");
    try {
      const response = await api.startViva(project.id, mode);
      setSession(response.session);
      setAnswers({});
      setCurrentIndex(0);
    } catch (e: any) {
      setError(localizedUiError(e, t, "ui.actionError"));
    } finally {
      setBusy(false);
    }
  }

  async function save(questionId: string) {
    if (!session) return;
    const answer = (answers[questionId] || session.responses.find((r) => r.questionId === questionId)?.answer || "").trim();
    if (!answer) return;
    try {
      const response = await api.saveVivaResponse(project.id, session.id, questionId, answer);
      setSession(response.session);
    } catch (e: any) {
      setError(localizedUiError(e, t, "ui.actionError"));
    }
  }

  async function nextQuestion() {
    if (!session || !activeQuestion) return;
    await save(activeQuestion.id);
    if (currentIndex < session.questions.length - 1) setCurrentIndex((index) => index + 1);
  }

  async function finish() {
    if (!session) return;
    setBusy(true); setError("");
    try {
      if (activeQuestion) await save(activeQuestion.id);
      for (const question of session.questions) {
        const answer = (answers[question.id] || "").trim();
        if (answer && question.id !== activeQuestion?.id) await save(question.id);
      }
      const response = await api.completeViva(project.id, session.id);
      setSession(response.session);
      setEvidence((items) => [response.evidence, ...items]);
      try { window.speechSynthesis?.cancel(); } catch {}
      setSpeaking(false);
    } catch (e: any) {
      setError(localizedUiError(e, t, "ui.actionError"));
    } finally {
      setBusy(false);
    }
  }

  function toggleSpeak() {
    if (!activeQuestion) return;
    if (speaking) {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
      return;
    }
    setSpeaking(speak(activeQuestion.prompt, meta.speech));
  }

  function toggleListening() {
    if (!activeQuestion) return;
    if (listening) {
      try { recognitionRef.current?.(); } catch {}
      setListening(false);
      setAnnouncement(t("viva.a11y.recordingStopped"));
      return;
    }
    const questionId = activeQuestion.id;
    const stop = startDictation(speechRecognitionLangs(locale, meta.speech), {
      onFinal: (text) => {
        if (!text) return;
        setAnswers((current) => {
          const base = current[questionId] ?? (session?.responses.find((r) => r.questionId === questionId)?.answer || "");
          return { ...current, [questionId]: `${base}${base ? " " : ""}${text}`.trim() };
        });
      },
      onInterim: setInterim,
      onError: (code) => {
        setListening(false);
        setError(code === "unsupported" ? t("viva.voiceUnsupported") : t("viva.micError"));
      },
      onEnd: () => setListening(false),
    });
    recognitionRef.current = stop;
    setListening(true);
    setAnnouncement(t("viva.a11y.recording"));
  }

  if (!session || session.status === "completed") {
    return (
      <div className="grid xl:grid-cols-[1fr_.8fr] gap-5">
        <Card>
          <CardContent>
            <div className="h-12 w-12 rounded-2xl tone-tile"><GraduationCap size={20} /></div>
            <div className="eyebrow mt-5">{t("ui.voiceVivaSimulator")}</div>
            <h2 className="text-2xl font-semibold mt-1">{t("viva.heroTitle")}</h2>
            <p className="body-copy mt-3 max-w-2xl">{t("viva.heroDesc")}</p>
            <div className="grid sm:grid-cols-4 gap-2 mt-6">
              {([['easy', t('viva.modeEasy')], ['normal', t('viva.modeNormal')], ['strict', t('viva.modeStrict')], ['external', t('viva.modeExternal')]] as [VivaMode, string][]).map(([value, label]) => (
                <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)} className={`focus-ring rounded-xl border hairline p-3 text-xs font-semibold ${mode === value ? "brand-soft-bg" : ""}`}>{label}</button>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <Button onClick={start} disabled={busy}>{busy ? <InlineLoader size={16}/> : <Play size={16} />}{t("viva.start")}</Button>
              <label className="flex items-center gap-2 text-xs muted cursor-pointer">
                <input type="checkbox" checked={autoVoice} onChange={(event) => setAutoVoice(event.target.checked)} /> {t("viva.autoVoice")}
              </label>
            </div>
            <fieldset className="mt-5 rounded-xl border hairline p-4">
              <legend className="px-1 text-xs font-semibold">{t("viva.a11y.title")}</legend>
              <label className="block text-xs font-semibold" htmlFor="viva-time">{t("viva.a11y.time")}</label>
              <select id="viva-time" className="field mt-1.5" value={access.time} onChange={(event) => setAccess({ time: event.target.value as VivaTimeSetting })}>
                <option value="off">{t("viva.a11y.timeOff")}</option>
                <option value="standard">{t("viva.a11y.timeStandard")}</option>
                <option value="extended150">{t("viva.a11y.time150")}</option>
                <option value="extended200">{t("viva.a11y.time200")}</option>
              </select>
              <label className="mt-3 flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={access.screenReader}
                  onChange={(event) => {
                    setAccess({ screenReader: event.target.checked });
                    if (event.target.checked) setAutoVoice(false);
                  }}
                />
                {t("viva.a11y.screenReader")}
              </label>
              <p className="text-xs muted mt-2">{t("viva.a11y.note")}</p>
            </fieldset>
            {session?.status === "completed" && <div className="mt-5 rounded-xl brand-soft-bg p-4 text-sm"><strong>{t("viva.roundComplete")}</strong> {t("viva.roundCompleteDesc")}</div>}
            {error && <p role="alert" className="text-xs text-danger mt-3">{error}</p>}
          </CardContent>
        </Card>
        <Learning evidence={evidence} />
      </div>
    );
  }

  const answeredCount = session.questions.filter((question) => Boolean((answers[question.id] || session.responses.find((r) => r.questionId === question.id)?.answer || "").trim())).length;
  const progress = Math.round(((currentIndex + 1) / Math.max(1, session.questions.length)) * 100);

  return (
    <div className="grid xl:grid-cols-[1.15fr_.65fr] gap-5">
      <Card>
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="eyebrow">{t("ui.liveVoiceViva")} · {t(`viva.mode.${session.mode}`)}</div>
              <h2 className="section-title mt-1">{t("viva.liveTitle")}</h2>
            </div>
            <div className="text-end"><div className="text-xs font-semibold">{currentIndex + 1} / {session.questions.length}</div><div className="text-[11px] muted">{answeredCount} {t("viva.answered")}</div></div>
          </div>
          <div className="tone-meter mt-4" role="progressbar" aria-label={t("viva.liveTitle")} aria-valuemin={1} aria-valuemax={session.questions.length} aria-valuenow={currentIndex + 1}><div style={{ width: `${progress}%` }} /></div>
          <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
          {secondsLeft !== null && (
            <div className={`mt-3 text-xs font-semibold mono-number ${secondsLeft === 0 ? "text-warning" : "muted"}`} aria-hidden="true">
              {t("viva.a11y.remaining").replace("{time}", `${formatNumber(Math.floor(secondsLeft / 60))}:${formatNumber(secondsLeft % 60, { minimumIntegerDigits: 2 })}`)}
            </div>
          )}

          {activeQuestion && <div className="mt-7">
            <div className="rounded-2xl brand-soft-bg p-5">
              <div className="flex items-start gap-3">
                <span className="h-9 w-9 rounded-xl bg-[var(--panel)] grid place-items-center shrink-0"><Headphones size={17} /></span>
                <div className="flex-1"><div className="text-[11px] uppercase muted">{t("viva.currentQuestion")} · {activeQuestion.focus}</div><h3 ref={questionHeadingRef} tabIndex={-1} className="text-base md:text-lg font-semibold leading-8 mt-2 outline-none" dir="auto">{activeQuestion.prompt}</h3></div>
              </div>
              <Button variant="ghost" className="mt-3" onClick={toggleSpeak}>{speaking ? <Square size={15} /> : <Volume2 size={15} />}{speaking ? t("viva.stopAudio") : t("viva.listenQuestion")}</Button>
            </div>

            <label htmlFor={`q_${activeQuestion.id}`} className="text-xs font-semibold mt-5 block">{t("viva.yourAnswer")}</label>
            <textarea id={`q_${activeQuestion.id}`} value={activeAnswer} onChange={(event) => setAnswers((current) => ({ ...current, [activeQuestion.id]: event.target.value }))} placeholder={t("viva.answerPh")} dir="auto" aria-describedby={`q_hint_${activeQuestion.id}`} className="focus-ring mt-2 w-full min-h-40 rounded-xl border hairline bg-[var(--bg)] p-4 text-sm leading-7" />
            <p id={`q_hint_${activeQuestion.id}`} className="sr-only">{t("viva.a11y.answerHint")}</p>
            {listening && <p className="mt-2 text-xs muted" aria-hidden="true">{interim ? <span dir="auto">{interim}…</span> : t("viva.a11y.recording")}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant={listening ? "default" : "outline"} aria-pressed={listening} onClick={toggleListening}>{listening ? <MicOff size={16} /> : <Mic size={16} />}{listening ? t("viva.stopRecording") : t("viva.answerVoice")}</Button>
              {currentIndex < session.questions.length - 1 ? (
                <Button onClick={nextQuestion} disabled={!activeAnswer.trim()}><SkipForward size={16} />{t("viva.saveNext")}</Button>
              ) : (
                <Button onClick={finish} disabled={busy || !activeAnswer.trim()}>{busy ? <InlineLoader size={16}/> : <ShieldCheck size={16} />}{t("viva.finish")}</Button>
              )}
            </div>
          </div>}
          {error && <p role="alert" className="text-xs text-danger mt-4">{error}</p>}
        </CardContent>
      </Card>
      <Learning evidence={evidence} />
    </div>
  );
}

function Learning({ evidence }: { evidence: LearningEvidenceRecord[] }) {
  const { t, locale } = useI18n();
  return <Card><CardContent><div className="flex items-center gap-2"><CheckCircle2 size={17} className="brand-text" /><h2 className="section-title">{t("ui.proofOfLearning")}</h2></div><p className="body-copy mt-2">{t('viva.learningDesc')}</p><div className="mt-5 space-y-3">{evidence.map((item) => <div key={item.id} className="rounded-xl bg-[var(--bg)] border hairline p-3"><div className="text-[11px] uppercase muted">{item.source}</div><p className="text-xs leading-6 mt-1">{item.summary}</p><div className="text-[11px] muted mt-2">{formatDateTime(item.createdAt, locale)}</div></div>)}{!evidence.length && <div className="rounded-xl soft-bg p-4 text-xs muted">{t('viva.learningEmpty')}</div>}</div></CardContent></Card>;
}

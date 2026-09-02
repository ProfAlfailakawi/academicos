import { localizedUiError } from "../../lib/ui-error";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  GraduationCap,
  Headphones,
  LoaderCircle,
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
  const { t, meta } = useI18n();
  const [mode, setMode] = useState<VivaMode>("normal");
  const [session, setSession] = useState<VivaSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<LearningEvidenceRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [autoVoice, setAutoVoice] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    api.learningEvidence(project.id)
      .then((r) => setEvidence(r.evidence))
      .catch((e) => {
        console.error("Failed to load viva learning evidence", e);
        setError(localizedUiError(e, t, "ui.loadError"));
      });
    return () => {
      try { recognitionRef.current?.stop?.(); } catch {}
      try { window.speechSynthesis?.cancel(); } catch {}
    };
  }, [project.id]);

  const activeQuestion = useMemo(() => session?.questions[currentIndex] || null, [session, currentIndex]);
  const existingAnswer = activeQuestion && session
    ? session.responses.find((response) => response.questionId === activeQuestion.id)?.answer || ""
    : "";
  const activeAnswer = activeQuestion ? (answers[activeQuestion.id] ?? existingAnswer) : "";

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
      try { recognitionRef.current?.stop?.(); } catch {}
      setListening(false);
      return;
    }
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      setError(t("viva.voiceUnsupported"));
      return;
    }
    const recognition = new Recognition();
    recognition.lang = meta.speech;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) transcript += event.results[i][0]?.transcript || "";
      if (transcript.trim()) {
        setAnswers((current) => ({
          ...current,
          [activeQuestion.id]: `${current[activeQuestion.id] || existingAnswer}${current[activeQuestion.id] || existingAnswer ? " " : ""}${transcript}`.trim(),
        }));
      }
    };
    recognition.onerror = () => {
      setListening(false);
      setError(t("viva.micError"));
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  if (!session || session.status === "completed") {
    return (
      <div className="grid xl:grid-cols-[1fr_.8fr] gap-5">
        <Card>
          <CardContent>
            <div className="h-12 w-12 rounded-2xl brand-soft-bg grid place-items-center"><GraduationCap size={20} /></div>
            <div className="eyebrow mt-5">{t("ui.voiceVivaSimulator")}</div>
            <h2 className="text-2xl font-semibold mt-1">{t("viva.heroTitle")}</h2>
            <p className="body-copy mt-3 max-w-2xl">{t("viva.heroDesc")}</p>
            <div className="grid sm:grid-cols-4 gap-2 mt-6">
              {([['easy', t('viva.modeEasy')], ['normal', t('viva.modeNormal')], ['strict', t('viva.modeStrict')], ['external', t('viva.modeExternal')]] as [VivaMode, string][]).map(([value, label]) => (
                <button key={value} onClick={() => setMode(value)} className={`focus-ring rounded-xl border hairline p-3 text-xs font-semibold ${mode === value ? "brand-soft-bg" : ""}`}>{label}</button>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <Button onClick={start} disabled={busy}>{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Play size={16} />}{t("viva.start")}</Button>
              <label className="flex items-center gap-2 text-xs muted cursor-pointer">
                <input type="checkbox" checked={autoVoice} onChange={(event) => setAutoVoice(event.target.checked)} /> {t("viva.autoVoice")}
              </label>
            </div>
            {session?.status === "completed" && <div className="mt-5 rounded-xl brand-soft-bg p-4 text-sm"><strong>{t("viva.roundComplete")}</strong> {t("viva.roundCompleteDesc")}</div>}
            {error && <p className="text-xs text-[var(--danger)] mt-3">{error}</p>}
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
            <div className="text-end"><div className="text-xs font-semibold">{currentIndex + 1} / {session.questions.length}</div><div className="text-[10px] muted">{answeredCount} {t("viva.answered")}</div></div>
          </div>
          <div className="h-1.5 rounded-full soft-bg mt-4 overflow-hidden"><div className="h-full brand-bg rounded-full transition-all" style={{ width: `${progress}%` }} /></div>

          {activeQuestion && <div className="mt-7">
            <div className="rounded-2xl brand-soft-bg p-5">
              <div className="flex items-start gap-3">
                <span className="h-9 w-9 rounded-xl bg-[var(--panel)] grid place-items-center shrink-0"><Headphones size={17} /></span>
                <div className="flex-1"><div className="text-[10px] uppercase muted">{t("viva.currentQuestion")} · {activeQuestion.focus}</div><div className="text-base md:text-lg font-semibold leading-8 mt-2">{activeQuestion.prompt}</div></div>
              </div>
              <Button variant="ghost" className="mt-3" onClick={toggleSpeak}>{speaking ? <Square size={15} /> : <Volume2 size={15} />}{speaking ? t("viva.stopAudio") : t("viva.listenQuestion")}</Button>
            </div>

            <label htmlFor={`q_${activeQuestion.id}`} className="text-xs font-semibold mt-5 block">{t("viva.yourAnswer")}</label>
            <textarea id={`q_${activeQuestion.id}`} value={activeAnswer} onChange={(event) => setAnswers((current) => ({ ...current, [activeQuestion.id]: event.target.value }))} placeholder={t("viva.answerPh")} className="focus-ring mt-2 w-full min-h-40 rounded-xl border hairline bg-[var(--bg)] p-4 text-sm leading-7" />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant={listening ? "default" : "outline"} onClick={toggleListening}>{listening ? <MicOff size={16} /> : <Mic size={16} />}{listening ? t("viva.stopRecording") : t("viva.answerVoice")}</Button>
              {currentIndex < session.questions.length - 1 ? (
                <Button onClick={nextQuestion} disabled={!activeAnswer.trim()}><SkipForward size={16} />{t("viva.saveNext")}</Button>
              ) : (
                <Button onClick={finish} disabled={busy || !activeAnswer.trim()}>{busy ? <LoaderCircle size={16} className="animate-spin" /> : <ShieldCheck size={16} />}{t("viva.finish")}</Button>
              )}
            </div>
          </div>}
          {error && <p className="text-xs text-[var(--danger)] mt-4">{error}</p>}
        </CardContent>
      </Card>
      <Learning evidence={evidence} />
    </div>
  );
}

function Learning({ evidence }: { evidence: LearningEvidenceRecord[] }) {
  const { t, locale } = useI18n();
  return <Card><CardContent><div className="flex items-center gap-2"><CheckCircle2 size={17} className="brand-text" /><h2 className="section-title">{t("ui.proofOfLearning")}</h2></div><p className="body-copy mt-2">{t('viva.learningDesc')}</p><div className="mt-5 space-y-3">{evidence.map((item) => <div key={item.id} className="rounded-xl bg-[var(--bg)] border hairline p-3"><div className="text-[10px] uppercase muted">{item.source}</div><p className="text-xs leading-6 mt-1">{item.summary}</p><div className="text-[10px] muted mt-2">{formatDateTime(item.createdAt, locale)}</div></div>)}{!evidence.length && <div className="rounded-xl soft-bg p-4 text-xs muted">{t('viva.learningEmpty')}</div>}</div></CardContent></Card>;
}

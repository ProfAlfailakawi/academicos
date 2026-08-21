import React, { useCallback, useEffect, useRef, useState } from "react";
import { GraduationCap, Lightbulb, ListChecks, AlertTriangle, Play, Square, Sparkles, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useI18n, LOCALES, localeMeta } from "../lib/i18n";

type Tab = "explain" | "solve";

// سرد صوتي عبر متصفح المستخدم (Web Speech API) — بديل واقعي متعدد اللغات للفيديو.
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
  const speakBcp = localeMeta(locale).speech;

  useEffect(() => () => stopSpeak(), []);

  const runExplain = useCallback(async () => {
    if (!topic.trim()) return;
    setBusy(true); setError(""); setLesson(null); stopSpeak(); setSpeaking(false);
    try {
      const r = await api.learnExplain({ topic: topic.trim(), language: meta.aiName, level });
      setLesson(r.lesson); setLessonSource(r.source);
    } catch { setError(t("learn.error")); }
    finally { setBusy(false); }
  }, [topic, level, meta.aiName, t]);

  const runSolve = useCallback(async () => {
    if (!problem.trim()) return;
    setBusy(true); setError(""); setSolve(null); stopSpeak(); setSpeaking(false);
    try {
      const r = await api.learnSolve({ problem: problem.trim(), language: meta.aiName });
      setSolve(r);
    } catch { setError(t("learn.error")); }
    finally { setBusy(false); }
  }, [problem, meta.aiName, t]);

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
        eyebrow="AcademicOS"
        title={t("learn.title")}
        description={t("learn.subtitle")}
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

      <div className="flex gap-2">
        {(["explain", "solve"] as Tab[]).map((x) => (
          <button
            key={x}
            onClick={() => setTab(x)}
            className={`focus-ring rounded-xl px-4 py-2 text-sm font-semibold border hairline ${tab === x ? "brand-soft-bg brand-text" : "bg-[var(--bg)]"}`}
          >
            {x === "explain" ? <Sparkles size={15} className="inline me-1" /> : <GraduationCap size={15} className="inline me-1" />}
            {t(x === "explain" ? "learn.explainTab" : "learn.solveTab")}
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

      {error && <div className="text-sm text-red-500">{error}</div>}

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

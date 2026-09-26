import React, { useEffect, useState } from "react";
import { MessageSquareText, Send, ShieldCheck, Users } from "lucide-react";
import type { ClarificationThreadRecord, CohortInsight } from "../../types";
import { api } from "../../lib/api";
import { formatDateTime, useI18n } from "../../lib/i18n";
import { localizedUiError } from "../../lib/ui-error";
import { DialogShell } from "../AppDialog";
import { Button } from "../ui/button";
import { AcademicLoader, InlineLoader } from "../ui/AcademicLoader";

/** Instructor view: anonymised cohort stuck points + Clarification Room for one assignment. */
export function CohortInsightDialog({
  courseId,
  assignmentId,
  assignmentTitle,
  onClose,
}: {
  courseId: string;
  assignmentId: string;
  assignmentTitle: string;
  onClose: () => void;
}) {
  const { t, locale, formatNumber } = useI18n();
  const [insight, setInsight] = useState<CohortInsight | null>(null);
  const [threads, setThreads] = useState<ClarificationThreadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [topic, setTopic] = useState("");
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [answering, setAnswering] = useState("");

  function load() {
    setLoading(true);
    Promise.allSettled([api.cohortInsight(courseId, assignmentId), api.clarifications(courseId, assignmentId)])
      .then(([i, c]) => {
        if (i.status === "fulfilled") setInsight(i.value.insight);
        else setError(localizedUiError(i.reason, t, "cohort.loadError"));
        if (c.status === "fulfilled") setThreads(c.value.threads);
      })
      .finally(() => setLoading(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [courseId, assignmentId]);

  function prefill(label: string) {
    setTopic(label);
    setAnswer("");
  }

  async function send() {
    if (!topic.trim() || !answer.trim()) return;
    setSending(true);
    setError("");
    try {
      const r = await api.sendClarification(courseId, assignmentId, { question: topic.trim(), answer: answer.trim() });
      setNotice(t("cohort.sent").replace("{n}", formatNumber(r.notified)));
      setTopic("");
      setAnswer("");
      load();
    } catch (e) {
      setError(localizedUiError(e, t, "cohort.sendError"));
    } finally {
      setSending(false);
    }
  }

  async function answerThread(thread: ClarificationThreadRecord) {
    const text = (drafts[thread.id] || "").trim();
    if (!text) return;
    setAnswering(thread.id);
    setError("");
    try {
      const r = await api.answerCourseClarification(courseId, assignmentId, thread.id, text);
      setNotice(t("cohort.sent").replace("{n}", formatNumber(r.notified)));
      load();
    } catch (e) {
      setError(localizedUiError(e, t, "cohort.sendError"));
    } finally {
      setAnswering("");
    }
  }

  return (
    <DialogShell
      title={`${t("cohort.title")} · ${assignmentTitle}`}
      description={t("cohort.privacy")}
      onClose={onClose}
      className="relative panel rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col"
    >
      {loading ? (
        <div className="min-h-48 grid place-items-center"><AcademicLoader size={40} label={t("app.loading")} /></div>
      ) : (
        <div className="space-y-5">
          {error && <div role="alert" className="rounded-xl bg-danger/10 text-danger p-3 text-sm">{error}</div>}
          {notice && <div role="status" className="rounded-xl brand-soft-bg p-3 text-sm">{notice}</div>}

          <section>
            <div className="flex items-center gap-2"><Users size={16} className="brand-text" /><h3 className="section-title">{t("cohort.stuckTitle")}</h3></div>
            {!insight?.available ? (
              <p className="body-copy mt-2">
                {t("cohort.tooSmall").replace("{k}", formatNumber(insight?.kAnonymityMin || 5)).replace("{n}", formatNumber(insight?.cohortSize || 0))}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  <Stat label={t("cohort.students")} value={formatNumber(insight.cohortSize)} />
                  <Stat label={t("cohort.avgProgress")} value={`${formatNumber(insight.averageProgress || 0)}%`} />
                  <Stat label={t("cohort.blocked")} value={formatNumber(insight.stageDistribution?.blocked || 0)} />
                  <Stat label={t("cohort.completed")} value={formatNumber(insight.stageDistribution?.completed || 0)} />
                </div>
                {insight.stuckPoints.length ? (
                  <ul className="mt-4 space-y-2">
                    {insight.stuckPoints.map((point) => (
                      <li key={`${point.kind}-${point.detail}-${point.label}`} className="rounded-xl border hairline p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs muted">{t(`cohort.kind.${point.kind}`)} · {t(`cohort.detail.${point.detail}`)}</div>
                            <div className="text-sm font-semibold mt-0.5"><bdi>{point.label}</bdi></div>
                          </div>
                          <div className="text-end shrink-0">
                            <div className="text-lg font-bold mono-number">{formatNumber(point.percent)}%</div>
                            <button type="button" className="focus-ring text-xs brand-text font-semibold" onClick={() => prefill(point.label)}>{t("cohort.clarify")}</button>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full soft-bg overflow-hidden" aria-hidden="true">
                          <div className="h-1.5 rounded-full bg-[var(--brand)]" style={{ width: `${point.percent}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : <p className="body-copy mt-3">{t("cohort.noStuck")}</p>}
              </>
            )}
          </section>

          <section className="rounded-2xl border hairline p-4">
            <div className="flex items-center gap-2"><MessageSquareText size={16} className="brand-text" /><h3 className="section-title">{t("cohort.roomTitle")}</h3></div>
            <p className="text-xs muted mt-1">{t("cohort.roomHint")}</p>
            <label className="block mt-3">
              <span className="text-xs font-semibold">{t("cohort.topic")}</span>
              <input className="field mt-1.5" dir="auto" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={1000} />
            </label>
            <label className="block mt-3">
              <span className="text-xs font-semibold">{t("cohort.answer")}</span>
              <textarea className="field mt-1.5 min-h-24" dir="auto" value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={4000} />
            </label>
            <Button className="mt-3" onClick={send} disabled={sending || !topic.trim() || !answer.trim()}>
              {sending ? <InlineLoader size={15} /> : <Send size={15} />}{t("cohort.send")}
            </Button>
          </section>

          <section>
            <h3 className="section-title">{t("cohort.threads")}</h3>
            {threads.length ? (
              <ul className="mt-3 space-y-2">
                {threads.map((thread) => (
                  <li key={thread.id} className="rounded-xl border hairline p-3">
                    <div className="flex items-center justify-between gap-2 text-xs muted">
                      <span>{t(`cohort.status.${thread.status}`)}{thread.upvotes > 0 ? ` · ${t("cohort.upvotes").replace("{n}", formatNumber(thread.upvotes))}` : ""}</span>
                      <time dateTime={thread.updatedAt}>{formatDateTime(thread.updatedAt, locale)}</time>
                    </div>
                    <div className="text-sm font-semibold mt-1" dir="auto">{thread.question}</div>
                    {thread.answer ? (
                      <p className="text-sm leading-7 mt-1 flex gap-2"><ShieldCheck size={14} className="brand-text shrink-0 mt-1.5" /><span dir="auto">{thread.answer}</span></p>
                    ) : (
                      <div className="mt-2 flex flex-col sm:flex-row gap-2">
                        <label className="sr-only" htmlFor={`answer-${thread.id}`}>{t("cohort.answer")}</label>
                        <input id={`answer-${thread.id}`} className="field flex-1" dir="auto" value={drafts[thread.id] || ""} onChange={(e) => setDrafts((d) => ({ ...d, [thread.id]: e.target.value }))} />
                        <Button size="sm" onClick={() => answerThread(thread)} disabled={answering === thread.id || !(drafts[thread.id] || "").trim()}>
                          {answering === thread.id ? <InlineLoader size={14} /> : <Send size={14} />}{t("cohort.answerAll")}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="body-copy mt-2">{t("cohort.noThreads")}</p>}
          </section>
        </div>
      )}
    </DialogShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border hairline bg-[var(--bg)] p-3 text-center"><div className="text-lg font-bold mono-number">{value}</div><div className="text-xs muted mt-1">{label}</div></div>;
}

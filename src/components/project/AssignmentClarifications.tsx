import React, { useEffect, useState } from "react";
import { MessageCircleQuestion, Send, ShieldCheck } from "lucide-react";
import type { ClarificationThreadRecord, ProjectDNA } from "../../types";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { localizedUiError } from "../../lib/ui-error";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { InlineLoader } from "../ui/AcademicLoader";

/** Student side of the Clarification Room for a project created from a course assignment. */
export function AssignmentClarifications({ project }: { project: ProjectDNA }) {
  const { t } = useI18n();
  const courseId = project.aiPolicy?.courseId;
  const assignmentId = project.aiPolicy?.assignmentId;
  const [threads, setThreads] = useState<ClarificationThreadRecord[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!courseId || !assignmentId) return;
    api.clarifications(courseId, assignmentId).then((r) => setThreads(r.threads)).catch(() => setThreads([]));
  }, [courseId, assignmentId]);

  if (!courseId || !assignmentId) return null;

  async function ask() {
    if (!question.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      await api.sendClarification(courseId!, assignmentId!, { question: question.trim() });
      setQuestion("");
      setMessage(t("clar.asked"));
    } catch (e) {
      setMessage(localizedUiError(e, t, "clar.askError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-2"><MessageCircleQuestion size={17} className="brand-text" /><h2 className="section-title">{t("clar.title")}</h2></div>
        <p className="body-copy mt-1">{t("clar.hint")}</p>
        {threads.length > 0 && (
          <ul className="mt-4 space-y-2">
            {threads.map((thread) => (
              <li key={thread.id} className="rounded-xl border hairline p-3">
                <div className="text-sm font-semibold" dir="auto">{thread.question}</div>
                {thread.answer && <p className="text-sm leading-7 mt-1 flex gap-2"><ShieldCheck size={14} className="brand-text shrink-0 mt-1.5" /><span dir="auto">{thread.answer}</span></p>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <label className="sr-only" htmlFor="clar-question">{t("clar.ask")}</label>
          <input id="clar-question" className="field flex-1" dir="auto" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={1000} placeholder={t("clar.placeholder")} />
          <Button onClick={ask} disabled={busy || !question.trim()}>{busy ? <InlineLoader size={15} /> : <Send size={15} />}{t("clar.ask")}</Button>
        </div>
        {message && <p role="status" className="text-xs mt-2">{message}</p>}
      </CardContent>
    </Card>
  );
}

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  LoaderCircle,
  RotateCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Link, useParams } from "react-router";
import { api } from "../lib/api";
import type {
  CourseAssignmentRecord,
  CourseRecord,
  CourseSubmissionRecord,
} from "../types";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { formatDateTime, useI18n } from "../lib/i18n";

type GradeDraft = {
  rubricGrades: Array<{
    rubricId: string;
    awardedPoints: number;
    feedback: string;
  }>;
  feedback: string;
  returnedReason: string;
};
export function AssignmentSubmissions() {
  const { t, locale } = useI18n();
  const { courseId = "", assignmentId = "" } = useParams();
  const [course, setCourse] = useState<CourseRecord | null>(null),
    [assignment, setAssignment] = useState<CourseAssignmentRecord | null>(null),
    [submissions, setSubmissions] = useState<CourseSubmissionRecord[]>([]),
    [selected, setSelected] = useState(""),
    [draft, setDraft] = useState<GradeDraft | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  function load() {
    setLoading(true);
    api
      .assignmentSubmissions(courseId, assignmentId)
      .then((r) => {
        setCourse(r.course);
        setAssignment(r.assignment);
        setSubmissions(r.submissions);
        if (r.submissions[0]) open(r.submissions[0], r.assignment);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, [courseId, assignmentId]);
  function open(item: CourseSubmissionRecord, a = assignment) {
    setSelected(item.id);
    setDraft({
      rubricGrades: (a?.rubric || []).map((row) => {
        const old = item.rubricGrades.find((x) => x.rubricId === row.id);
        return {
          rubricId: row.id,
          awardedPoints: old?.awardedPoints || 0,
          feedback: old?.feedback || "",
        };
      }),
      feedback: item.feedback || "",
      returnedReason: item.returnedReason || "",
    });
  }
  async function save(status: "returned" | "grading" | "graded" | "released") {
    if (!draft || !assignment) return;
    setBusy(status);
    setError("");
    try {
      const result = await api.gradeSubmission(
        courseId,
        assignmentId,
        selected,
        {
          status,
          rubricGrades: status === "returned" ? undefined : draft.rubricGrades,
          feedback: draft.feedback,
          returnedReason: draft.returnedReason,
        },
      );
      setSubmissions((v) =>
        v.map((x) => (x.id === result.submission.id ? result.submission : x)),
      );
      open(result.submission, assignment);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  if (loading)
    return (
      <div className="min-h-64 grid place-items-center">
        <LoaderCircle className="animate-spin brand-text" />
      </div>
    );
  if (!course || !assignment)
    return (
      <Card>
        <CardContent>
          <h1 className="section-title">{t("subm.cannotOpen")}</h1>
          <p className="body-copy mt-2">{error || t("subm.assignmentNotFound")}</p>
        </CardContent>
      </Card>
    );
  const current = submissions.find((x) => x.id === selected),
    releasedCount = submissions.filter((x) => x.status === "released").length,
    pending = submissions.filter(
      (x) => !["released", "returned"].includes(x.status),
    ).length,
    immutable = current?.status === "released";
  return (
    <div className="space-y-5">
      <header className="panel-flat rounded-2xl p-5 md:p-6">
        <Link
          to={`/app/course/${course.id}`}
          className="focus-ring inline-flex items-center gap-2 text-xs muted"
        >
          <ArrowLeft size={15} className="directional-icon" />
          {course.code}
        </Link>
        <div className="eyebrow brand-text mt-4">{t("ui.submissionGradingDesk")}</div>
        <h1 className="text-3xl font-semibold tracking-[-.04em] mt-1">
          {assignment.title}
        </h1>
        <p className="body-copy mt-2">
          {t("subm.headerDesc")}
        </p>
        <div className="grid grid-cols-3 gap-3 mt-5">
          <Mini label={t("subm.miniSubmissions")} value={submissions.length} />
          <Mini label={t("subm.miniPending")} value={pending} />
          <Mini label={t("subm.miniReleased")} value={releasedCount} />
        </div>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-danger/8 border border-danger/20 p-3 text-sm text-danger"
        >
          {error}
        </div>
      )}
      <div className="grid xl:grid-cols-[360px_1fr] gap-5 items-start">
        <Card>
          <CardContent>
            <div className="flex items-center gap-2">
              <ClipboardCheck size={17} className="brand-text" />
              <h2 className="section-title">{t("subm.receiveQueue")}</h2>
            </div>
            <div className="mt-4 space-y-2">
              {submissions.map((item) => (
                <button
                  key={item.id}
                  onClick={() => open(item)}
                  className={`focus-ring w-full text-start rounded-xl border p-3 ${selected === item.id ? "border-[var(--brand)] brand-soft-bg" : "hairline bg-[var(--bg)]"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">
                      {item.studentName}
                    </span>
                    <Status status={item.status} />
                  </div>
                  <div className="text-[10px] muted mt-2">
                    {t("subm.attempt")} {item.attempt} ·{" "}
                    {formatDateTime(item.submittedAt, locale)}
                  </div>
                  <div
                    dir="ltr"
                    className="text-[9px] font-mono muted mt-1 truncate"
                  >
                    {item.receiptHash}
                  </div>
                </button>
              ))}
              {!submissions.length && (
                <div className="py-12 text-center">
                  <Clock3 size={22} className="mx-auto muted" />
                  <p className="body-copy mt-3">{t("subm.noSubmissions")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            {current && draft ? (
              <>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <div className="eyebrow">{t("ui.gradeWithEvidence")}</div>
                    <h2 className="section-title mt-1">
                      {current.studentName}
                    </h2>
                    <p className="text-[10px] muted mt-2">
                      {t("ui.revision")} {current.projectRevision} · {t("ui.audit")}{" "}
                      {current.audit.score ?? 0}% · {t("ui.evidence")}{" "}
                      {current.audit.evidenceCoverage ?? 0}%
                    </p>
                  </div>
                  <div className="rounded-xl brand-soft-bg px-3 py-2 text-xs font-semibold">
                    {current.totalScore === undefined
                      ? t("subm.gradeNotLocked")
                      : `${current.totalScore}/${current.maxScore}`}
                  </div>
                </div>
                {immutable && (
                  <div
                    role="status"
                    className="mt-4 rounded-xl brand-soft-bg p-3 text-xs font-semibold"
                  >
                    {t("subm.releasedLocked")}
                  </div>
                )}
                <div className="mt-5 space-y-3">
                  {assignment.rubric.map((row, index) => (
                    <section
                      key={row.id}
                      className="rounded-2xl border hairline p-4"
                    >
                      <div className="grid md:grid-cols-[1fr_120px] gap-4">
                        <div>
                          <h3 className="text-sm font-semibold">{row.title}</h3>
                          <p className="text-xs muted leading-6 mt-1">
                            {row.description || t("subm.noDescription")}
                          </p>
                        </div>
                        <label className="block">
                          <span className="text-[10px] muted">
                            {t("subm.scoreOf")} {row.weighting}
                          </span>
                          <input
                            disabled={immutable}
                            aria-label={`${t("subm.scoreAria")} ${row.title}`}
                            type="number"
                            min="0"
                            max={row.weighting}
                            step="0.25"
                            className="field mt-1"
                            value={
                              draft.rubricGrades[index]?.awardedPoints ?? 0
                            }
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                rubricGrades: draft.rubricGrades.map((x, i) =>
                                  i === index
                                    ? {
                                        ...x,
                                        awardedPoints: Number(e.target.value),
                                      }
                                    : x,
                                ),
                              })
                            }
                          />
                        </label>
                      </div>
                      <label className="block mt-3">
                        <span className="text-[10px] muted">
                          {t("subm.criterionFeedback")}
                        </span>
                        <textarea
                          disabled={immutable}
                          className="field mt-1 min-h-20"
                          value={draft.rubricGrades[index]?.feedback || ""}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              rubricGrades: draft.rubricGrades.map((x, i) =>
                                i === index
                                  ? { ...x, feedback: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                      </label>
                    </section>
                  ))}
                </div>
                <label className="block mt-4">
                  <span className="text-[11px] font-semibold muted">
                    {t("subm.generalFeedback")}
                  </span>
                  <textarea
                    disabled={immutable}
                    className="field mt-1 min-h-24"
                    value={draft.feedback}
                    onChange={(e) =>
                      setDraft({ ...draft, feedback: e.target.value })
                    }
                  />
                </label>
                <label className="block mt-3">
                  <span className="text-[11px] font-semibold muted">
                    {t("subm.returnReason")}
                  </span>
                  <textarea
                    disabled={immutable}
                    className="field mt-1 min-h-20"
                    value={draft.returnedReason}
                    onChange={(e) =>
                      setDraft({ ...draft, returnedReason: e.target.value })
                    }
                  />
                </label>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => save("returned")}
                    disabled={
                      immutable || Boolean(busy) || !draft.returnedReason.trim()
                    }
                  >
                    {busy === "returned" ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <RotateCcw size={15} />
                    )}
                    {t("subm.returnToStudent")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => save("grading")}
                    disabled={immutable || Boolean(busy)}
                  >
                    {busy === "grading" ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={15} />
                    )}
                    {t("subm.saveAsGrading")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => save("graded")}
                    disabled={immutable || Boolean(busy)}
                  >
                    {busy === "graded" ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={15} />
                    )}
                    {t("subm.internalClose")}
                  </Button>
                  <Button
                    onClick={() => save("released")}
                    disabled={immutable || Boolean(busy)}
                  >
                    {busy === "released" ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <Send size={15} />
                    )}
                    {t("subm.releaseGrade")}
                  </Button>
                </div>
              </>
            ) : (
              <div className="min-h-80 grid place-items-center text-center">
                <div>
                  <ClipboardCheck size={26} className="mx-auto muted" />
                  <h2 className="section-title mt-4">{t("subm.selectSubmission")}</h2>
                  <p className="body-copy mt-2">
                    {t("subm.selectHint")}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
function Status({ status }: { status: CourseSubmissionRecord["status"] }) {
  const { t } = useI18n();
  const labels = {
    submitted: t("subm.statusSubmitted"),
    returned: t("subm.statusReturned"),
    grading: t("subm.statusGrading"),
    graded: t("subm.statusGraded"),
    released: t("subm.statusReleased"),
  };
  return (
    <span className="rounded-full brand-soft-bg px-2 py-1 text-[9px] font-semibold">
      {labels[status]}
    </span>
  );
}
function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[var(--bg)] border hairline p-3">
      <div className="text-[10px] muted">{label}</div>
      <div className="text-xl font-semibold mt-1 mono-number">{value}</div>
    </div>
  );
}

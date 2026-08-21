import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  BookOpenCheck,
  Check,
  ChevronDown,
  CirclePlus,
  ClipboardCheck,
  Copy,
  Download,
  FileCheck2,
  KeyRound,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Target,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import type {
  CourseAssignmentRecord,
  CourseJoinCodeRecord,
  CourseRecord,
} from "../types";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { StatusPill } from "../components/StatusPill";

type DraftDeliverable = { title: string; format: string };
type DraftRubric = { title: string; description: string; weighting: number };
export function CourseOS() {
  const { t } = useI18n();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<CourseRecord | null>(null);
  const [assignments, setAssignments] = useState<CourseAssignmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [builder, setBuilder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cloning, setCloning] = useState("");
  const [quality, setQuality] = useState<
    Record<
      string,
      {
        status: "ready" | "attention" | "critical";
        checks: Array<{
          id: string;
          label: string;
          status: "pass" | "warning" | "critical";
          detail: string;
        }>;
      }
    >
  >({});
  const [joinCodes, setJoinCodes] = useState<CourseJoinCodeRecord[]>([]);
  const [joinSecret, setJoinSecret] = useState("");
  const [joinBusy, setJoinBusy] = useState("");
  const [form, setForm] = useState({
    title: "",
    instructions: "",
    deadline: "",
    groupMode: "individual",
    policyLevel: 2,
    outcomes: "",
    deliverables: [
      { title: t("course.finalDeliverable"), format: "PDF" },
    ] as DraftDeliverable[],
    rubric: [
      { title: t("course.workQuality"), description: "", weighting: 100 },
    ] as DraftRubric[],
  });
  function load() {
    setLoading(true);
    Promise.all([
      api.course(id),
      api.joinCodes(id).catch(() => ({ success: true as const, codes: [] })),
    ])
      .then(([r, j]) => {
        setCourse(r.course);
        setAssignments(r.assignments);
        setJoinCodes(j.codes);
        setForm((v) => ({ ...v, policyLevel: r.course.aiPolicy.level }));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, [id]);
  async function setCourseStatus(status: CourseRecord["status"]) {
    if (!course) return;
    const old = course;
    setCourse({ ...old, status });
    try {
      setCourse((await api.updateCourse(course.id, { status })).course);
    } catch {
      setCourse(old);
    }
  }
  async function publish(a: CourseAssignmentRecord) {
    const status = a.status === "published" ? "draft" : "published";
    setAssignments((v) => v.map((x) => (x.id === a.id ? { ...x, status } : x)));
    try {
      const r = await api.updateCourseAssignment(course!.id, a.id, { status });
      setAssignments((v) => v.map((x) => (x.id === a.id ? r.assignment : x)));
    } catch {
      load();
    }
  }
  async function exportArchive() {
    setError("");
    try {
      await api.exportCourseArchive(id);
    } catch (e: any) {
      setError(e.message || t("course.exportError"));
    }
  }
  async function cloneCourse() {
    if (!course || cloning) return;
    setCloning("course");
    setError("");
    try {
      const r = await api.cloneCourse(course.id);
      navigate(`/app/course/${r.course.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCloning("");
    }
  }
  async function cloneAssignment(a: CourseAssignmentRecord) {
    if (!course || cloning) return;
    setCloning(a.id);
    setError("");
    try {
      const r = await api.cloneCourseAssignment(course.id, a.id);
      setAssignments((v) => [r.assignment, ...v]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCloning("");
    }
  }
  async function checkQuality(a: CourseAssignmentRecord) {
    if (!course) return;
    setError("");
    try {
      const r = await api.assignmentQuality(course.id, a.id);
      setQuality((v) => ({ ...v, [a.id]: r.quality }));
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function issueJoinCode() {
    if (joinBusy) return;
    setJoinBusy("new");
    setError("");
    try {
      const r = await api.createJoinCode(id);
      setJoinCodes((v) => [r.code, ...v]);
      setJoinSecret(r.secret);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setJoinBusy("");
    }
  }
  async function regenerateJoinCode(c: CourseJoinCodeRecord) {
    if (joinBusy) return;
    setJoinBusy(c.id);
    setError("");
    try {
      const r = await api.regenerateJoinCode(id, c.id, c.maxUses, 30);
      setJoinCodes((v) => [
        r.code,
        ...v.map((x) =>
          x.id === c.id ? { ...x, status: "revoked" as const } : x,
        ),
      ]);
      setJoinSecret(r.secret);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setJoinBusy("");
    }
  }
  async function revokeJoinCode(c: CourseJoinCodeRecord) {
    if (joinBusy || c.status !== "active") return;
    setJoinBusy(c.id);
    setError("");
    try {
      await api.revokeJoinCode(id, c.id);
      setJoinCodes((v) =>
        v.map((x) =>
          x.id === c.id ? { ...x, status: "revoked" as const } : x,
        ),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setJoinBusy("");
    }
  }
  async function createAssignment() {
    if (!course || !form.title.trim() || !form.instructions.trim()) return;
    setSaving(true);
    setError("");
    try {
      const r = await api.createCourseAssignment(course.id, {
        title: form.title,
        instructions: form.instructions,
        deadline: form.deadline
          ? new Date(form.deadline).toISOString()
          : undefined,
        groupMode: form.groupMode as any,
        outcomes: form.outcomes
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        deliverables: form.deliverables.map((d, i) => ({
          id: String(i),
          ...d,
        })),
        rubric: form.rubric.map((x, i) => ({ id: String(i), ...x })),
        aiPolicy: {
          level: form.policyLevel as any,
          summary: t("course.assignmentPolicySummary").replace(
            "{n}",
            String(form.policyLevel),
          ),
          allowed: [],
          prohibited: [],
          disclosureRequired: form.policyLevel >= 4,
          needsConfirmation: false,
        },
        status: "draft",
      });
      setAssignments((v) => [r.assignment, ...v]);
      setBuilder(false);
      setForm((v) => ({
        ...v,
        title: "",
        instructions: "",
        deadline: "",
        outcomes: "",
        deliverables: [{ title: t("course.finalDeliverable"), format: "PDF" }],
        rubric: [{ title: t("course.workQuality"), description: "", weighting: 100 }],
      }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  if (loading)
    return (
      <div className="min-h-64 grid place-items-center">
        <LoaderCircle className="animate-spin brand-text" />
      </div>
    );
  if (error && !course)
    return (
      <div className="panel rounded-2xl p-6">
        <h1 className="section-title">{t("course.openError")}</h1>
        <p className="body-copy mt-2">{error}</p>
      </div>
    );
  if (!course) return null;
  const totalWeight = form.rubric.reduce(
    (s, r) => s + (Number(r.weighting) || 0),
    0,
  );
  return (
    <div className="space-y-5">
      <header className="panel-flat rounded-2xl p-5 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-5 justify-between">
          <div>
            <Link
              to="/app/professor"
              className="focus-ring inline-flex items-center gap-2 text-xs muted hover:text-[var(--ink)]"
            >
              <ArrowRight size={15} />
              ProfessorOS
            </Link>
            <div className="eyebrow brand-text mt-4">
              {course.code}
              {course.term ? ` · ${course.term}` : ""}
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-[-.04em] mt-1">
              {course.title}
            </h1>
            <p className="body-copy mt-3 max-w-3xl">
              {course.description || t("course.noDescription")}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={course.status}
              onChange={(e) =>
                setCourseStatus(e.target.value as CourseRecord["status"])
              }
              className="field w-auto text-xs"
            >
              <option value="draft">{t("course.draft")}</option>
              <option value="active">{t("course.active")}</option>
              <option value="archived">{t("course.archived")}</option>
            </select>
            <Button variant="outline" onClick={exportArchive}>
              <Download size={15} />
              {t("course.courseArchive")}
            </Button>
            <Button
              variant="outline"
              onClick={cloneCourse}
              disabled={Boolean(cloning)}
            >
              {cloning === "course" ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Copy size={15} />
              )}
              {t("course.cloneCourse")}
            </Button>
            <Button onClick={() => setBuilder(true)}>
              <CirclePlus size={16} />
              {t("course.newAssignment")}
            </Button>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 mt-6 pt-5 border-t hairline">
          <Mini label="Course Outcomes" value={course.outcomes.length} />
          <Mini label="Assignments" value={assignments.length} />
          <Mini label="Default AI Policy" value={`L${course.aiPolicy.level}`} />
        </div>
      </header>
      {error && (
        <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      <div className="grid xl:grid-cols-[.7fr_1.3fr] gap-5">
        <div className="space-y-5">
          <Card>
            <CardContent>
              <div className="flex items-center gap-2">
                <Target size={17} className="brand-text" />
                <h2 className="section-title">Course Outcomes</h2>
              </div>
              <div className="mt-4 space-y-2">
                {course.outcomes.length ? (
                  course.outcomes.map((o, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-[var(--bg)] border hairline p-3 flex gap-3"
                    >
                      <span className="h-6 w-6 rounded-lg brand-soft-bg grid place-items-center text-[10px] font-semibold shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-xs leading-6">{o}</p>
                    </div>
                  ))
                ) : (
                  <p className="body-copy">{t("course.noOutcomes")}</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-center gap-2">
                <ShieldCheck size={17} className="brand-text" />
                <h2 className="section-title">{t("course.defaultAiPolicy")}</h2>
              </div>
              <div className="mt-4 rounded-2xl brand-soft-bg p-4">
                <div className="text-3xl font-semibold">
                  Level {course.aiPolicy.level}
                </div>
                <p className="text-xs leading-6 mt-2">
                  {course.aiPolicy.summary}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <KeyRound size={17} className="brand-text" />
                  <h2 className="section-title">{t("course.joinCodes")}</h2>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={issueJoinCode}
                  disabled={Boolean(joinBusy)}
                >
                  {joinBusy === "new" ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : (
                    <CirclePlus size={14} />
                  )}
                  {t("course.newCode")}
                </Button>
              </div>
              <p className="body-copy mt-2">{t("course.joinCodesDesc")}</p>
              {joinSecret && (
                <div className="mt-3 rounded-xl brand-soft-bg p-3">
                  <div className="text-[10px] font-semibold">
                    {t("course.copyCodeNow")}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <code dir="ltr" className="text-sm font-semibold flex-1">
                      {joinSecret}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigator.clipboard?.writeText(joinSecret)}
                    >
                      <Copy size={13} />
                      {t("course.copy")}
                    </Button>
                  </div>
                </div>
              )}
              <div className="mt-4 space-y-2">
                {joinCodes.length ? (
                  joinCodes.slice(0, 6).map((c) => (
                    <div key={c.id} className="rounded-xl border hairline p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div dir="ltr" className="text-xs font-semibold">
                            {c.prefix}••••
                          </div>
                          <div className="text-[9px] muted mt-1">
                            {c.useCount}/{c.maxUses} · {t("course.expires")}{" "}
                            {new Date(c.expiresAt).toLocaleDateString("ar-KW")}{" "}
                            · {c.status}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={t("course.regenerateCode")}
                            onClick={() => regenerateJoinCode(c)}
                            disabled={Boolean(joinBusy)}
                          >
                            {joinBusy === c.id ? (
                              <LoaderCircle
                                size={14}
                                className="animate-spin"
                              />
                            ) : (
                              <RotateCcw size={14} />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={t("course.revokeCode")}
                            onClick={() => revokeJoinCode(c)}
                            disabled={
                              Boolean(joinBusy) || c.status !== "active"
                            }
                          >
                            <Ban size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="body-copy">{t("course.noActiveCodes")}</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-center gap-2">
                <ClipboardCheck size={17} className="brand-text" />
                <h2 className="section-title">Outcome Mapping</h2>
              </div>
              <p className="body-copy mt-2">
                Course Outcome → Assignment evidence map.
              </p>
              <div className="mt-4 space-y-2">
                {course.outcomes.length ? (
                  course.outcomes.map((o, i) => {
                    const linked = assignments.filter((a) =>
                      a.outcomes.some((x) => x.trim() === o.trim()),
                    );
                    return (
                      <div key={i} className="rounded-xl border hairline p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-xs leading-6 font-semibold">{o}</p>
                          <span
                            className={`rounded-full px-2 py-1 text-[9px] shrink-0 ${linked.length ? "brand-soft-bg" : "bg-[#f7eddd] text-[var(--warning)] dark:bg-[#332a1d]"}`}
                          >
                            {linked.length} {t("course.assignmentUnit")}
                          </span>
                        </div>
                        {linked.length ? (
                          <div className="mt-2 text-[10px] muted">
                            {linked.map((a) => a.title).join(" · ")}
                          </div>
                        ) : (
                          <div className="mt-2 text-[10px] text-[var(--warning)]">
                            {t("course.noAssignmentForOutcome")}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="body-copy">{t("course.addOutcomesFirst")}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="eyebrow">Assignment Builder</div>
                <h2 className="section-title mt-1">{t("course.courseAssignments")}</h2>
              </div>
              <Button variant="outline" onClick={() => setBuilder(true)}>
                <CirclePlus size={15} />
                {t("course.add")}
              </Button>
            </div>
            <div className="mt-5 space-y-3">
              {assignments.length ? (
                assignments.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-2xl border hairline p-4 md:p-5"
                  >
                    <div className="flex flex-col sm:flex-row gap-4 justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold ${a.status === "published" ? "brand-soft-bg" : "soft-bg muted"}`}
                          >
                            {a.status === "published"
                              ? t("course.published")
                              : a.status === "archived"
                                ? t("course.archived")
                                : t("course.draft")}
                          </span>
                          <span className="text-[10px] muted">
                            {a.groupMode === "group"
                              ? t("course.group")
                              : a.groupMode === "either"
                                ? t("course.eitherMode")
                                : t("course.individual")}{" "}
                            · AI L{a.aiPolicy.level}
                          </span>
                        </div>
                        <h3 className="text-base font-semibold mt-2">
                          {a.title}
                        </h3>
                        <p className="body-copy mt-1 line-clamp-2">
                          {a.instructions}
                        </p>
                      </div>
                      <div className="flex gap-1.5 flex-wrap sm:justify-end">
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/app/course/${course.id}/assignment/${a.id}/submissions`}>
                            <BookOpenCheck size={14} />
                            {t("course.submissions")}
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => checkQuality(a)}
                        >
                          <ClipboardCheck size={14} />
                          Quality
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cloneAssignment(a)}
                          disabled={Boolean(cloning)}
                        >
                          {cloning === a.id ? (
                            <LoaderCircle size={14} className="animate-spin" />
                          ) : (
                            <Copy size={14} />
                          )}
                          {t("course.copy")}
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            a.status === "published" ? "outline" : "default"
                          }
                          onClick={() => publish(a)}
                        >
                          {a.status === "published" ? (
                            <>
                              <ChevronDown size={14} />
                              {t("course.revertToDraft")}
                            </>
                          ) : (
                            <>
                              <Check size={14} />
                              {t("course.publish")}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <Sub label={t("course.deliverables")} value={a.deliverables.length} />
                      <Sub label="Rubric" value={a.rubric.length} />
                      <Sub label="Outcomes" value={a.outcomes.length} />
                    </div>
                    {a.deadline && (
                      <div className="text-[10px] muted mt-3">
                        {t("course.deadlineLabel")} {new Date(a.deadline).toLocaleString("ar-KW")}
                      </div>
                    )}
                    {quality[a.id] && (
                      <div
                        className={`mt-4 rounded-xl border hairline p-3 ${quality[a.id].status === "ready" ? "brand-soft-bg" : "bg-[var(--bg)]"}`}
                      >
                        <div className="flex items-center gap-2">
                          {quality[a.id].status === "ready" ? (
                            <Check size={14} />
                          ) : (
                            <AlertTriangle
                              size={14}
                              className="text-[var(--warning)]"
                            />
                          )}
                          <span className="text-xs font-semibold">
                            Assignment Quality Checker ·{" "}
                            {quality[a.id].status === "ready"
                              ? t("course.qualityReady")
                              : quality[a.id].status === "critical"
                                ? t("course.qualityCritical")
                                : t("course.qualityAttention")}
                          </span>
                        </div>
                        <div className="mt-3 grid md:grid-cols-2 gap-2">
                          {quality[a.id].checks.map((c) => (
                            <div
                              key={c.id}
                              className="rounded-lg bg-[var(--panel)]/70 p-2.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-semibold">
                                  {c.label}
                                </span>
                                <span
                                  className={`text-[9px] ${c.status === "pass" ? "brand-text" : c.status === "critical" ? "text-[var(--danger)]" : "text-[var(--warning)]"}`}
                                >
                                  {c.status}
                                </span>
                              </div>
                              <p className="text-[10px] muted leading-5 mt-1">
                                {c.detail}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-14 text-center">
                  <BookOpenCheck className="mx-auto brand-text" />
                  <h3 className="font-semibold mt-4">{t("course.noAssignments")}</h3>
                  <p className="body-copy mt-2">{t("course.noAssignmentsDesc")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      {builder && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 md:p-5">
          <button
            className="absolute inset-0 bg-black/35 backdrop-blur-sm"
            onClick={() => setBuilder(false)}
            aria-label={t("course.close")}
          />
          <div className="relative panel rounded-2xl w-full max-w-4xl max-h-[94vh] overflow-hidden">
            <div className="h-14 px-5 flex items-center justify-between border-b hairline">
              <div>
                <div className="text-xs font-semibold">Assignment Builder</div>
                <div className="text-[10px] muted">
                  {course.code} · {course.title}
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("course.closeBuilder")}
                onClick={() => setBuilder(false)}
              >
                <X size={18} />
              </Button>
            </div>
            <div className="p-5 overflow-auto max-h-[calc(94vh-56px)] space-y-5">
              <div className="grid md:grid-cols-2 gap-4">
                <Field label={t("course.assignmentTitle")}>
                  <input
                    className="field"
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    placeholder="Final project"
                  />
                </Field>
                <Field label={t("course.deadline")}>
                  <input
                    type="datetime-local"
                    className="field"
                    value={form.deadline}
                    onChange={(e) =>
                      setForm({ ...form, deadline: e.target.value })
                    }
                  />
                </Field>
              </div>
              <Field label={t("course.instructions")}>
                <textarea
                  className="field resize-y min-h-32"
                  value={form.instructions}
                  onChange={(e) =>
                    setForm({ ...form, instructions: e.target.value })
                  }
                  placeholder={t("course.instructionsPlaceholder")}
                />
              </Field>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label={t("course.workMode")}>
                  <select
                    className="field"
                    value={form.groupMode}
                    onChange={(e) =>
                      setForm({ ...form, groupMode: e.target.value })
                    }
                  >
                    <option value="individual">{t("course.individual")}</option>
                    <option value="group">{t("course.group")}</option>
                    <option value="either">{t("course.eitherMode")}</option>
                  </select>
                </Field>
                <Field label={`AI Policy — L${form.policyLevel}`}>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    className="w-full mt-3 accent-[var(--brand)]"
                    value={form.policyLevel}
                    onChange={(e) =>
                      setForm({ ...form, policyLevel: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label={t("course.measuredOutcomes")}>
                  <textarea
                    className="field h-20 resize-none"
                    value={form.outcomes}
                    onChange={(e) =>
                      setForm({ ...form, outcomes: e.target.value })
                    }
                    placeholder={t("course.onePerLine")}
                  />
                </Field>
              </div>
              <BuilderList title={t("course.deliverables")} icon={FileCheck2}>
                {form.deliverables.map((d, i) => (
                  <div
                    key={i}
                    className="grid sm:grid-cols-[1fr_1fr_auto] gap-2"
                  >
                    <input
                      className="field"
                      value={d.title}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          deliverables: form.deliverables.map((x, j) =>
                            j === i ? { ...x, title: e.target.value } : x,
                          ),
                        })
                      }
                      placeholder={t("course.deliverablePh")}
                    />
                    <input
                      className="field"
                      value={d.format}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          deliverables: form.deliverables.map((x, j) =>
                            j === i ? { ...x, format: e.target.value } : x,
                          ),
                        })
                      }
                      placeholder="PDF / PPTX…"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t("course.deleteDeliverable")}
                      onClick={() =>
                        setForm({
                          ...form,
                          deliverables: form.deliverables.filter(
                            (_, j) => j !== i,
                          ),
                        })
                      }
                    >
                      <X size={15} />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm({
                      ...form,
                      deliverables: [
                        ...form.deliverables,
                        { title: "", format: "" },
                      ],
                    })
                  }
                >
                  <CirclePlus size={14} />
                  {t("course.deliverable")}
                </Button>
              </BuilderList>
              <BuilderList
                title={`Rubric · ${t("course.total")} ${totalWeight}%`}
                icon={Target}
              >
                {form.rubric.map((r, i) => (
                  <div
                    key={i}
                    className="grid md:grid-cols-[.8fr_1.3fr_100px_auto] gap-2"
                  >
                    <input
                      className="field"
                      value={r.title}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          rubric: form.rubric.map((x, j) =>
                            j === i ? { ...x, title: e.target.value } : x,
                          ),
                        })
                      }
                      placeholder={t("course.criterionPh")}
                    />
                    <input
                      className="field"
                      value={r.description}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          rubric: form.rubric.map((x, j) =>
                            j === i ? { ...x, description: e.target.value } : x,
                          ),
                        })
                      }
                      placeholder={t("course.descriptionPh")}
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="field"
                      value={r.weighting}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          rubric: form.rubric.map((x, j) =>
                            j === i
                              ? { ...x, weighting: Number(e.target.value) }
                              : x,
                          ),
                        })
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t("course.deleteRubric")}
                      onClick={() =>
                        setForm({
                          ...form,
                          rubric: form.rubric.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <X size={15} />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm({
                      ...form,
                      rubric: [
                        ...form.rubric,
                        { title: "", description: "", weighting: 0 },
                      ],
                    })
                  }
                >
                  <CirclePlus size={14} />
                  {t("course.criterion")}
                </Button>
              </BuilderList>
              <div className="flex flex-col sm:flex-row gap-3 justify-between items-center pt-2">
                <p
                  className={`text-xs ${totalWeight === 100 ? "brand-text" : "text-[var(--warning)]"}`}
                >
                  {totalWeight === 100
                    ? t("course.rubricBalanced")
                    : t("course.rubricUnbalanced")}
                </p>
                <Button
                  onClick={createAssignment}
                  disabled={
                    saving || !form.title.trim() || !form.instructions.trim()
                  }
                >
                  {saving ? (
                    <LoaderCircle size={16} className="animate-spin" />
                  ) : (
                    <CirclePlus size={16} />
                  )}
                  {t("course.saveDraft")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold muted">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-[var(--bg)] border hairline p-3">
      <div className="text-[10px] muted">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
function Sub({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[var(--bg)] p-2.5 text-center">
      <div className="text-base font-semibold">{value}</div>
      <div className="text-[9px] muted">{label}</div>
    </div>
  );
}
function BuilderList({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border hairline p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="brand-text" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

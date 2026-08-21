import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  ChevronLeft,
  CirclePlus,
  GraduationCap,
  LoaderCircle,
  ShieldCheck,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import type { CourseRecord, FacultyAutomationBrief } from "../types";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/EmptyState";

const defaultPolicy = {
  level: 2 as const,
  allowed: ["clarification", "planning"],
  prohibited: [],
  disclosureRequired: false,
  needsConfirmation: false,
};
export function ProfessorOS() {
  const { t } = useI18n();
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [automation, setAutomation] = useState<FacultyAutomationBrief | null>(
    null,
  );
  const [form, setForm] = useState({
    code: "",
    title: "",
    term: "",
    description: "",
    outcomes: "",
    policyLevel: 2,
  });
  function load() {
    setLoading(true);
    Promise.all([api.courses(), api.facultyAutomation()])
      .then(([r, a]) => {
        setCourses(r.courses);
        setAutomation(a.brief);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);
  async function create() {
    if (!form.code.trim() || !form.title.trim()) return;
    setSaving(true);
    setError("");
    try {
      const r = await api.createCourse({
        code: form.code,
        title: form.title,
        term: form.term || undefined,
        description: form.description || undefined,
        outcomes: form.outcomes
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        aiPolicy: {
          ...defaultPolicy,
          level: form.policyLevel as any,
          summary: t("prof.policyLevelSummary").replace(
            "{n}",
            String(form.policyLevel),
          ),
        },
        status: "draft",
      });
      setCourses((v) => [r.course, ...v]);
      setShowCreate(false);
      setForm({
        code: "",
        title: "",
        term: "",
        description: "",
        outcomes: "",
        policyLevel: 2,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="ProfessorOS"
        title={t("prof.headerTitle")}
        description={t("prof.headerDesc")}
        action={
          <Button onClick={() => setShowCreate(true)}>
            <CirclePlus size={16} />
            {t("prof.newCourse")}
          </Button>
        }
      />
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {automation && (
        <Card>
          <CardContent>
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
              <div>
                <div className="flex items-center gap-2">
                  <Activity size={17} className="brand-text" />
                  <div>
                    <div className="eyebrow">Faculty automation brief</div>
                    <h2 className="section-title mt-1">{t("prof.needsAttention")}</h2>
                  </div>
                </div>
                <p className="body-copy mt-2">
                  {t("prof.healthDesc")}
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2 min-w-[320px]">
                <Health
                  label="Outcomes"
                  value={
                    automation.assignments
                      ? automation.health.outcomesMapped
                      : null
                  }
                />
                <Health
                  label="Rubric"
                  value={
                    automation.assignments
                      ? automation.health.rubricReady
                      : null
                  }
                />
                <Health
                  label={t("prof.deadlines")}
                  value={
                    automation.assignments
                      ? automation.health.deadlinesPresent
                      : null
                  }
                />
                <Health
                  label="AI"
                  value={
                    automation.assignments
                      ? automation.health.policyConfirmed
                      : null
                  }
                />
              </div>
            </div>
            <div className="mt-5 grid md:grid-cols-2 gap-2">
              {automation.actions.slice(0, 6).map((action) => (
                <Link
                  key={action.id}
                  to={action.path}
                  className="focus-ring rounded-xl border hairline p-3 flex gap-3 bg-[var(--bg)]"
                >
                  <AlertTriangle
                    size={15}
                    className={
                      action.priority === "critical"
                        ? "text-[var(--danger)]"
                        : "text-[var(--warning)]"
                    }
                  />
                  <div>
                    <div className="text-xs font-semibold">{action.title}</div>
                    <p className="text-[10px] muted leading-5 mt-1">
                      {action.detail}
                    </p>
                  </div>
                </Link>
              ))}
              {!automation.actions.length && (
                <div className="rounded-xl brand-soft-bg p-4 text-sm font-semibold">
                  {automation.assignments
                    ? t("prof.allPassed")
                    : t("prof.createFirstAssignment")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {loading ? (
        <div className="min-h-64 grid place-items-center">
          <LoaderCircle className="animate-spin brand-text" />
        </div>
      ) : courses.length ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {courses.map((c) => (
            <Link
              key={c.id}
              to={`/app/course/${c.id}`}
              className="focus-ring block group"
            >
              <Card className="h-full transition-transform group-hover:-translate-y-0.5">
                <CardContent className="h-full flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <span className="h-10 w-10 rounded-xl brand-soft-bg grid place-items-center">
                      <BookOpen size={17} />
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${c.status === "active" ? "brand-soft-bg" : c.status === "archived" ? "soft-bg muted" : "bg-[#f7eddd] text-[var(--warning)] dark:bg-[#332a1d]"}`}
                    >
                      {c.status === "active"
                        ? t("prof.statusActive")
                        : c.status === "archived"
                          ? t("prof.statusArchived")
                          : t("prof.statusDraft")}
                    </span>
                  </div>
                  <div className="eyebrow mt-5">
                    {c.code}
                    {c.term ? ` · ${c.term}` : ""}
                  </div>
                  <h2 className="section-title mt-1">{c.title}</h2>
                  <p className="body-copy mt-2 line-clamp-3">
                    {c.description || t("prof.addDescription")}
                  </p>
                  <div className="mt-5 pt-4 border-t hairline flex items-center justify-between text-xs">
                    <span className="muted">
                      {c.outcomes.length} outcomes · AI L{c.aiPolicy.level}
                    </span>
                    <ChevronLeft size={16} className="brand-text" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={GraduationCap}
          title={t("prof.emptyTitle")}
          description={t("prof.emptyDesc")}
          action={
            <Button onClick={() => setShowCreate(true)}>{t("prof.createCourse")}</Button>
          }
        />
      )}
      {showCreate && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowCreate(false)}
            aria-label={t("prof.close")}
          />
          <div className="relative panel rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="h-14 px-5 border-b hairline flex items-center justify-between sticky top-0 bg-[var(--panel)] z-10">
              <div>
                <div className="text-xs font-semibold">CourseOS</div>
                <div className="text-[10px] muted">{t("prof.createNewCourse")}</div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("prof.closeCreate")}
                onClick={() => setShowCreate(false)}
              >
                <X size={18} />
              </Button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label={t("prof.fieldCode")}>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="CS 401"
                    className="field"
                  />
                </Field>
                <Field label={t("prof.fieldTerm")}>
                  <input
                    value={form.term}
                    onChange={(e) => setForm({ ...form, term: e.target.value })}
                    placeholder="Fall 2026"
                    className="field"
                  />
                </Field>
              </div>
              <Field label={t("prof.fieldTitle")}>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Software Engineering"
                  className="field"
                />
              </Field>
              <Field label={t("prof.fieldDescription")}>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={3}
                  className="field resize-none"
                  placeholder={t("prof.descriptionPh")}
                />
              </Field>
              <Field label={t("prof.fieldOutcomes")}>
                <textarea
                  value={form.outcomes}
                  onChange={(e) =>
                    setForm({ ...form, outcomes: e.target.value })
                  }
                  rows={4}
                  className="field resize-none"
                  placeholder={t("prof.outcomesPh")}
                />
              </Field>
              <Field label={t("prof.fieldPolicy").replace("{n}", String(form.policyLevel))}>
                <input
                  type="range"
                  min="0"
                  max="5"
                  value={form.policyLevel}
                  onChange={(e) =>
                    setForm({ ...form, policyLevel: Number(e.target.value) })
                  }
                  className="w-full accent-[var(--brand)]"
                />
                <div className="flex justify-between text-[10px] muted mt-1">
                  <span>{t("prof.rangeProhibited")}</span>
                  <span>{t("prof.rangeExtended")}</span>
                </div>
              </Field>
              <div className="rounded-xl brand-soft-bg p-3 flex gap-2">
                <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                <p className="text-xs leading-6">
                  {t("prof.policyNote")}
                </p>
              </div>
              <Button
                className="w-full"
                onClick={create}
                disabled={saving || !form.code.trim() || !form.title.trim()}
              >
                {saving ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <CirclePlus size={16} />
                )}
                {t("prof.createCourseOS")}
              </Button>
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
function Health({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl bg-[var(--bg)] border hairline p-2.5 text-center">
      <div className="text-base font-semibold mono-number">
        {value === null ? "—" : `${value}%`}
      </div>
      <div className="text-[9px] muted mt-1">{label}</div>
    </div>
  );
}

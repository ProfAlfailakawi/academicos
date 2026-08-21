import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Gauge,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { api } from "../lib/api";
import type {
  LearningBrain,
  MissionControlAction,
  MissionControlPlan,
} from "../types";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { useI18n } from "../lib/i18n";

type TFn = (key: string) => string;

function minutesLabel(t: TFn, value: number) {
  const h = Math.floor(value / 60),
    m = value % 60;
  return h
    ? `${h} ${t("mission.hourUnit")}${m ? ` ${t("mission.and")} ${m} ${t("mission.minuteShort")}` : ""}`
    : `${m} ${t("mission.minuteUnit")}`;
}
function dayLabel(t: TFn, date?: string) {
  if (!date) return "";
  const d = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  return d < 0
    ? t("mission.late")
    : d === 0
      ? t("mission.today")
      : d === 1
        ? t("mission.tomorrow")
        : t("mission.inDays").replace("{d}", String(d));
}

export function MissionControl() {
  const { t } = useI18n();
  const [mission, setMission] = useState<MissionControlPlan | null>(null);
  const [brain, setBrain] = useState<LearningBrain | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    api
      .missionControl()
      .then((r) => {
        setMission(r.mission);
        setBrain(r.brain);
      })
      .catch((e) => setError(e.message || t("mission.buildError")));
  }, []);
  const today = useMemo(() => {
    const d = mission?.date
      ? new Date(`${mission.date}T12:00:00Z`)
      : new Date();
    return new Intl.DateTimeFormat("ar-KW", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: mission?.date ? "UTC" : undefined,
    }).format(d);
  }, [mission?.date]);
  if (error)
    return (
      <Card>
        <CardContent className="py-12">
          <h1 className="section-title">{t("mission.buildDayError")}</h1>
          <p className="body-copy mt-2">{error}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/app/semester">{t("mission.openCurrentSemester")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  if (!mission || !brain)
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-44 panel rounded-3xl" />
        <div className="h-72 panel rounded-3xl" />
      </div>
    );
  const first = mission.actions[0];
  const used = Math.min(
    100,
    Math.round(
      (mission.suggestedMinutes / Math.max(1, mission.availableMinutes)) * 100,
    ),
  );
  return (
    <div className="space-y-5">
      <section className="panel-flat rounded-3xl overflow-hidden">
        <div className="p-6 md:p-8 lg:p-9 grid lg:grid-cols-[1fr_auto] gap-7 items-end">
          <div className="max-w-3xl">
            <div className="eyebrow">Academic Mission Control · {today}</div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-[-0.04em] mt-3">
              {t("mission.heroTitle")}
            </h1>
            <p className="body-copy mt-4 max-w-2xl">
              {mission.pressure.message}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {first ? (
                <Button onClick={() => navigate(first.path)}>
                  <Sparkles size={16} />
                  {t("mission.startDay")} <ArrowLeft size={16} />
                </Button>
              ) : (
                <Button asChild>
                  <Link to="/app/upload">
                    {t("mission.addFirstAssignment")} <ArrowLeft size={16} />
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link to="/app/semester">
                  <CalendarDays size={15} />
                  {t("mission.fullSemester")}
                </Link>
              </Button>
            </div>
          </div>
          <div className="min-w-[210px] rounded-2xl bg-[var(--bg)] border hairline p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="eyebrow">{t("mission.dayBudget")}</div>
                <div className="text-2xl font-semibold mt-2 mono-number">
                  {minutesLabel(t, mission.availableMinutes)}
                </div>
              </div>
              <Clock3 size={20} className="brand-text" />
            </div>
            <div className="mt-4 h-1.5 rounded-full soft-bg overflow-hidden">
              <div
                className="h-full brand-bg rounded-full"
                style={{ width: `${used}%` }}
              />
            </div>
            <div className="text-[10px] muted mt-2">
              {t("mission.suggestedPlan")}{" "}
              {minutesLabel(t, mission.suggestedMinutes)} ·{" "}
              {mission.availableMinutesSource === "profile"
                ? t("mission.fromPreference")
                : t("mission.defaultEditable")}
            </div>
          </div>
        </div>
      </section>

      {mission.concierge && (
        <section className="rounded-2xl brand-soft-bg p-5 md:p-6">
          <div className="grid lg:grid-cols-[1fr_auto] gap-5 items-center">
            <div>
              <div className="eyebrow">Academic concierge</div>
              <h2 className="section-title mt-1">{mission.concierge.headline}</h2>
              <p className="body-copy mt-2">{mission.concierge.explanation}</p>
            </div>
            <div className="text-[10px] muted max-w-64">
              {t("mission.conciergeNote")}
            </div>
          </div>
        </section>
      )}

      <div className="grid xl:grid-cols-[1fr_330px] gap-5 items-start">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="eyebrow">Next best actions</div>
                <h2 className="section-title mt-1">
                  {t("mission.suggestedOrder")}
                </h2>
              </div>
              <span className="text-[11px] muted">
                {mission.actions.length} {t("mission.steps")}
              </span>
            </div>
            {mission.actions.length ? (
              <div className="mt-5 divide-y hairline">
                {mission.actions.map((action, index) => (
                  <ActionRow
                    key={action.id}
                    action={action}
                    index={index}
                    onOpen={() => navigate(action.path)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <CheckCircle2 size={25} className="mx-auto brand-text" />
                <div className="font-semibold mt-3">
                  {t("mission.noUrgentTask")}
                </div>
                <p className="body-copy mt-1">{t("mission.noUrgentHint")}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent>
              <div className="flex items-center gap-2">
                <BookOpenCheck size={17} className="brand-text" />
                <div>
                  <div className="eyebrow">AcademicOS Brain</div>
                  <h2 className="section-title mt-1">
                    {t("mission.learningMemory")}
                  </h2>
                </div>
              </div>
              {brain.recommendedFocus[0] ? (
                <div className="mt-5 rounded-2xl brand-soft-bg p-4">
                  <div className="text-[10px] muted">
                    {t("mission.bestFocusNow")}
                  </div>
                  <div className="font-semibold mt-1">
                    {brain.recommendedFocus[0].skill}
                  </div>
                  <p className="text-xs leading-6 muted mt-2">
                    {brain.recommendedFocus[0].reason}
                  </p>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl bg-[var(--bg)] border hairline p-4 text-xs muted">
                  {t("mission.needMoreEvidence")}
                </div>
              )}
              <div className="mt-5 space-y-3">
                <BrainLine
                  label={t("mission.strongestEvidence")}
                  value={brain.strengths[0]?.skill || t("mission.notFormedYet")}
                />
                <BrainLine
                  label={t("mission.projectsAnalyzed")}
                  value={String(brain.projectsAnalyzed)}
                />
                <BrainLine
                  label={t("mission.evidenceSaved")}
                  value={String(brain.evidenceItems)}
                />
              </div>
              <div className="mt-5 pt-4 border-t hairline text-[10px] leading-5 muted">
                {brain.basis}
              </div>
              <Button asChild variant="ghost" size="sm" className="mt-2 px-0">
                <Link to="/app/skills">
                  {t("mission.openEvidenceSkills")} <ArrowLeft size={13} />
                </Link>
              </Button>
            </CardContent>
          </Card>
          {mission.deferred.length > 0 && (
            <Card>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Gauge size={16} className="brand-text" />
                  <h3 className="text-sm font-semibold">
                    {t("mission.notToday")}
                  </h3>
                </div>
                <div className="mt-4 space-y-3">
                  {mission.deferred.slice(0, 3).map((x) => (
                    <div key={x.projectId}>
                      <div className="text-xs font-semibold">
                        {x.projectTitle}
                      </div>
                      <div className="text-[10px] muted mt-1 leading-5">
                        {x.reason}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionRow({
  action,
  index,
  onOpen,
}: {
  action: MissionControlAction;
  index: number;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  return (
    <button
      onClick={onOpen}
      className="focus-ring w-full text-start py-4 first:pt-1 last:pb-1 group"
    >
      <div className="grid grid-cols-[34px_1fr_auto] gap-3 items-start">
        <div className="h-8 w-8 rounded-xl brand-soft-bg flex items-center justify-center text-xs font-semibold mono-number">
          {index + 1}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold group-hover:brand-text transition-colors">
              {action.title}
            </span>
            <span
              className={`text-[9px] rounded-full px-2 py-1 ${action.priority === "critical" ? "bg-[#f5e6e3] text-[var(--danger)] dark:bg-[#382522]" : action.priority === "important" ? "bg-[#f7eddd] text-[var(--warning)] dark:bg-[#332a1d]" : "soft-bg muted"}`}
            >
              {t(`mission.priority.${action.priority}`)}
            </span>
          </div>
          <div className="text-[11px] muted mt-1">{action.projectTitle}</div>
          <p className="text-xs leading-6 muted mt-2 max-w-2xl">
            {action.reason}
          </p>
          {action.skillFocus && (
            <div className="text-[10px] brand-text mt-2">
              {t("mission.alsoLinksEvidence")} {action.skillFocus}
            </div>
          )}
        </div>
        <div className="text-end shrink-0">
          <div className="text-xs font-semibold mono-number">
            {minutesLabel(t, action.estimatedMinutes)}
          </div>
          {action.dueAt && (
            <div className="text-[10px] muted mt-1">
              {dayLabel(t, action.dueAt)}
            </div>
          )}
          <ArrowLeft
            size={15}
            className="ms-auto mt-3 muted group-hover:brand-text"
          />
        </div>
      </div>
    </button>
  );
}
function BrainLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[11px] muted">{label}</span>
      <span className="text-xs font-semibold text-end">{value}</span>
    </div>
  );
}

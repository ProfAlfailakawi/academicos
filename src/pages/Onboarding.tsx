import { localizedUiError } from "../lib/ui-error";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  BookMarked,
  CalendarRange,
  Check,
  Compass,
  GraduationCap,
  Languages,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  SkipForward,
  X,
} from "lucide-react";
import { useNavigate } from "react-router";
import { api } from "../lib/api";
import type { UserProfile } from "../types";
import { Button } from "../components/ui/button";
import { Logo, LogoMark } from "../components/brand/Logo";
import { LOCALES, type LocaleCode, useI18n } from "../lib/i18n";

type StepKind = "choice" | "text" | "tokens";
type StepKey =
  | "language"
  | "country"
  | "university"
  | "specialization"
  | "studyYear"
  | "academicTerm"
  | "courses";

const STEPS: { key: StepKey; kind: StepKind; icon: React.ElementType }[] = [
  { key: "language", kind: "choice", icon: Languages },
  { key: "country", kind: "text", icon: MapPin },
  { key: "university", kind: "text", icon: Building2 },
  { key: "specialization", kind: "text", icon: Compass },
  { key: "studyYear", kind: "text", icon: GraduationCap },
  { key: "academicTerm", kind: "text", icon: CalendarRange },
  { key: "courses", kind: "tokens", icon: BookMarked },
];

// عيّنة نصية بلغة كل خيار: يرى المستخدم شكل الخط قبل أن يختار، لا اسم اللغة فقط.
const LANGUAGE_SAMPLE: Record<LocaleCode, string> = {
  ar: "التعلّم بالدليل",
  en: "Learning, with evidence",
  tr: "Kanıtla öğrenme",
  zh: "有证据的学习",
  hi: "प्रमाण के साथ सीखना",
  es: "Aprender con evidencia",
  fr: "Apprendre avec des preuves",
  ur: "ثبوت کے ساتھ سیکھنا",
};

const DOMAIN_KEYS = [
  "engineering",
  "cs",
  "business",
  "medicine",
  "law",
  "education",
  "science",
  "arts",
] as const;

const FALLBACK_REGIONS = ["KW", "SA", "AE", "EG", "TR", "GB", "US", "CA"];

/** أسماء الدول تأتي من محرك المتصفح بلغة المستخدم، فلا نترجم قائمة دول يدويًا. */
function useCountrySuggestions(locale: LocaleCode) {
  return useMemo(() => {
    const preferred: string[] = [];
    try {
      const tags = Array.isArray(navigator.languages) && navigator.languages.length
        ? navigator.languages
        : [navigator.language];
      for (const tag of tags) {
        const region = new Intl.Locale(String(tag)).maximize().region;
        if (region && !preferred.includes(region)) preferred.push(region);
      }
    } catch {}
    const codes = [...preferred, ...FALLBACK_REGIONS].filter(
      (code, index, all) => all.indexOf(code) === index,
    ).slice(0, 8);
    let display: Intl.DisplayNames | null = null;
    try {
      display = new Intl.DisplayNames([locale], { type: "region" });
    } catch {}
    return codes.map((code) => {
      let name = code;
      try { name = display?.of(code) || code; } catch {}
      return name;
    });
  }, [locale]);
}

function useTermSuggestions(t: (key: string) => string) {
  return useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const order: { season: "fall" | "spring" | "summer"; year: number }[] =
      month >= 8
        ? [{ season: "fall", year }, { season: "spring", year: year + 1 }, { season: "summer", year: year + 1 }]
        : month <= 4
          ? [{ season: "spring", year }, { season: "summer", year }, { season: "fall", year }]
          : [{ season: "summer", year }, { season: "fall", year }, { season: "spring", year: year + 1 }];
    return order.map((item) =>
      t(`onboard.term.${item.season}`).replace("{y}", String(item.year)),
    );
  }, [t]);
}

export function Onboarding() {
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Partial<UserProfile>>({
    language: locale,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const [draftCourse, setDraftCourse] = useState("");
  const [saving, setSaving] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const countries = useCountrySuggestions(locale);
  const terms = useTermSuggestions(t);
  const years = ["y1", "y2", "y3", "y4", "y5", "grad"].map((k) => t(`onboard.year.${k}`));
  const domains = DOMAIN_KEYS.map((k) => t(`onboard.domain.${k}`));

  useEffect(() => {
    api
      .profile()
      .then((r) => setProfile((current) => ({ ...current, ...r.profile })))
      .catch((e) => {
        console.error("Failed to load onboarding profile", e);
        setError(localizedUiError(e, t, "ui.loadError"));
      });
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const current = STEPS[step];
  const courses = profile.courses || [];
  const textValue = String(profile[current.key as keyof UserProfile] ?? "");

  const suggestions =
    current.key === "country" ? countries
      : current.key === "specialization" ? domains
        : current.key === "studyYear" ? years
          : current.key === "academicTerm" ? terms
            : [];

  function setText(value: string) {
    setProfile((p) => ({ ...p, [current.key]: value }));
  }

  function chooseLanguage(code: LocaleCode) {
    setLocale(code);
    setProfile((p) => ({ ...p, language: code }));
  }

  function addCourse(raw: string) {
    const parts = raw.split(/[،,]/).map((x) => x.trim()).filter(Boolean);
    if (!parts.length) return;
    setProfile((p) => {
      const existing = p.courses || [];
      const merged = [...existing];
      for (const part of parts) if (!merged.includes(part)) merged.push(part);
      return { ...p, courses: merged };
    });
    setDraftCourse("");
  }

  function removeCourse(name: string) {
    setProfile((p) => ({ ...p, courses: (p.courses || []).filter((c) => c !== name) }));
  }

  async function finish() {
    setSaving(true);
    setSealing(true);
    setError("");
    const startedAt = Date.now();
    try {
      const pending = draftCourse.trim();
      const finalCourses = pending && !courses.includes(pending) ? [...courses, pending] : courses;
      await api.updateProfile({ ...profile, courses: finalCourses, onboardingCompleted: true });
      // نترك لحظة الختم تُكمل نفسها بصريًا بدل قطعها في منتصف الحركة.
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1100) await new Promise((r) => setTimeout(r, 1100 - elapsed));
      window.location.replace("/app/upload");
    } catch (e: any) {
      setSealing(false);
      setSaving(false);
      setError(localizedUiError(e, t, "onboard.saveError"));
    }
  }

  function next() {
    if (current.kind === "tokens" && draftCourse.trim()) {
      addCourse(draftCourse);
      return;
    }
    if (step === STEPS.length - 1) void finish();
    else setStep((s) => s + 1);
  }

  function back() {
    if (step) setStep((s) => s - 1);
    else navigate("/app");
  }

  const filledCount = STEPS.filter((s) =>
    s.key === "courses" ? courses.length > 0 : Boolean(profile[s.key as keyof UserProfile]),
  ).length;

  const card = (
    <IdentityCard
      profile={profile}
      courses={courses}
      sealed={sealing}
      filled={filledCount}
      total={STEPS.length}
    />
  );

  return (
    <div className="onboard-frame">
    <div className="onboard-shell">
      <aside className="onboard-rail">
        <Logo markSize={40} caption={t("brand.tagline")} />
        <div>
          <div className="eyebrow brand-text">{t("onboard.railEyebrow")}</div>
          <h1 className="mt-3 text-[28px] font-semibold tracking-[-.035em] leading-[1.16]">
            {t("onboard.railTitle")}
          </h1>
          <p className="body-copy mt-4 max-w-sm">{t("onboard.railBody")}</p>
          <div className="mt-8">{card}</div>
        </div>
        <p className="text-[11px] muted flex items-start gap-2 max-w-sm">
          <ShieldCheck size={14} className="mt-[2px] shrink-0" />
          {t("onboard.footer")}
        </p>
      </aside>

      <main className="onboard-main">
        <div className="onboard-body">
          <div className="flex items-center justify-between gap-4">
            <span className="eyebrow">
              {t("onboard.stepPrefix")} {step + 1} {t("onboard.stepMid")} {STEPS.length}
            </span>
            <div className="onboard-steps" role="presentation">
              {STEPS.map((s, i) => (
                <span
                  key={s.key}
                  className={`onboard-step-dot ${i === step ? "is-current" : i < step ? "is-done" : ""}`}
                />
              ))}
            </div>
          </div>

          <div key={current.key} className="onboard-question mt-9" data-motion="in">
            <span className="inline-flex h-11 w-11 rounded-2xl tone-tile">
              <current.icon size={19} />
            </span>
            <h2 className="onboard-title mt-5">{t(`onboard.${current.key}.title`)}</h2>
            <p className="body-copy mt-3 max-w-xl">{t(`onboard.${current.key}.description`)}</p>

            <div className="mt-8">
              {current.kind === "choice" ? (
                <div className="choice-grid">
                  {LOCALES.map((item) => {
                    const selected = profile.language === item.code;
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => chooseLanguage(item.code)}
                        aria-pressed={selected}
                        className={`choice-card focus-ring ${selected ? "is-selected" : ""}`}
                      >
                        <span className="min-w-0">
                          <span className="choice-card__name block" dir={item.dir} lang={item.code}>
                            {item.name}
                          </span>
                          <span className="choice-card__sample block truncate" dir={item.dir} lang={item.code}>
                            {LANGUAGE_SAMPLE[item.code]}
                          </span>
                        </span>
                        {selected ? (
                          <span className="choice-card__check"><Check size={13} /></span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : current.kind === "tokens" ? (
                <>
                  <div className="token-field">
                    {courses.map((course) => (
                      <span key={course} className="token">
                        {course}
                        <button
                          type="button"
                          onClick={() => removeCourse(course)}
                          aria-label={`${t("onboard.courses.remove")} — ${course}`}
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                    <input
                      ref={inputRef}
                      value={draftCourse}
                      onChange={(e) => setDraftCourse(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "،" || e.key === ",") {
                          e.preventDefault();
                          if (draftCourse.trim()) addCourse(draftCourse);
                          else next();
                        }
                        if (e.key === "Backspace" && !draftCourse && courses.length) {
                          removeCourse(courses[courses.length - 1]);
                        }
                      }}
                      onBlur={() => draftCourse.trim() && addCourse(draftCourse)}
                      placeholder={courses.length ? "" : t("onboard.courses.placeholder")}
                      aria-label={t("onboard.courses.title")}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                    <span className="onboard-hint">{t("onboard.courses.hint")}</span>
                    {courses.length ? (
                      <span className="text-[11px] muted mono-number">
                        {t("onboard.courses.count").replace("{n}", String(courses.length))}
                      </span>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <input
                    ref={inputRef}
                    value={textValue}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); next(); } }}
                    placeholder={t(`onboard.${current.key}.placeholder`)}
                    aria-label={t(`onboard.${current.key}.title`)}
                    className="onboard-input focus-ring"
                  />
                  {suggestions.length ? (
                    <div className="mt-4">
                      <div className="eyebrow mb-2.5">{t("onboard.quickPicks")}</div>
                      <div className="suggest-row">
                        {suggestions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setText(textValue === option ? "" : option)}
                            className={`suggest-chip focus-ring ${textValue === option ? "is-active" : ""}`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-6 rounded-2xl border p-3.5 text-sm"
              style={{
                borderColor: "color-mix(in srgb, var(--danger) 32%, transparent)",
                background: "color-mix(in srgb, var(--danger) 8%, transparent)",
                color: "var(--danger)",
              }}
            >
              {error}
            </div>
          ) : null}

          <div className="mt-9 flex items-center justify-between gap-3 flex-wrap">
            <Button variant="ghost" onClick={back} disabled={saving}>
              <ArrowLeft size={16} className="directional-icon" />
              {step ? t("onboard.prev") : t("onboard.later")}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => (step === STEPS.length - 1 ? void finish() : setStep((s) => s + 1))} disabled={saving}>
                <SkipForward size={16} />
                {t("onboard.skip")}
              </Button>
              <Button onClick={next} disabled={saving}>
                {saving ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowRight size={16} className="directional-icon" />}
                {step === STEPS.length - 1 ? t("onboard.start") : t("onboard.next")}
              </Button>
            </div>
          </div>
          <p className="onboard-hint mt-4">
            <kbd>Enter</kbd> {t("onboard.enterHint")}
          </p>

          <div className="onboard-mobile-card">{card}</div>
        </div>
      </main>

      {sealing ? (
        <div className="onboard-sealing" role="status" aria-live="polite">
          <div className="onboard-sealing__inner">
            <LogoMark variant="seal" size={78} animated />
            <h2 className="mt-6 text-xl font-semibold">{t("onboard.sealingTitle")}</h2>
            <p className="body-copy mt-2 max-w-xs">{t("onboard.sealingBody")}</p>
          </div>
        </div>
      ) : null}
    </div>
    </div>
  );
}

function IdentityCard({
  profile,
  courses,
  sealed,
  filled,
  total,
}: {
  profile: Partial<UserProfile>;
  courses: string[];
  sealed: boolean;
  filled: number;
  total: number;
}) {
  const { t } = useI18n();
  const rows: { key: string; label: string; value: string }[] = [
    {
      key: "language",
      label: t("app.language"),
      value: LOCALES.find((l) => l.code === profile.language)?.name || "",
    },
    { key: "country", label: t("onboard.country.title"), value: profile.country || "" },
    { key: "university", label: t("onboard.university.title"), value: profile.university || "" },
    { key: "specialization", label: t("onboard.specialization.title"), value: profile.specialization || "" },
    { key: "studyYear", label: t("onboard.studyYear.title"), value: profile.studyYear || "" },
    { key: "academicTerm", label: t("onboard.academicTerm.title"), value: profile.academicTerm || "" },
    {
      key: "courses",
      label: t("onboard.courses.title"),
      value: courses.length ? courses.join(" · ") : "",
    },
  ];
  return (
    <div className={`identity-card ${sealed ? "is-sealed" : ""}`}>
      <div className="identity-card__head">
        <span className="flex items-center gap-2.5 min-w-0">
          <LogoMark variant="tile" size={30} />
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold truncate">{t("onboard.cardTitle")}</span>
            <span className="block text-[10px] muted">
              {sealed ? t("onboard.cardSealed") : t("onboard.cardBuilding")}
            </span>
          </span>
        </span>
        <span className="text-[11px] muted mono-number">{filled}/{total}</span>
      </div>
      <dl className="mt-1">
        {rows.map((row) => (
          <div
            key={row.key}
            className={`identity-row ${row.value ? "is-filled" : "is-empty"}`}
          >
            <dt>{row.label}</dt>
            <dd title={row.value || undefined} aria-label={row.value || t("onboard.notSet")}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="identity-card__foot">
        <span>{t("brand.tagline")}</span>
        <span className="identity-card__seal" aria-hidden="true">{t("onboard.sealStamp")}</span>
      </div>
    </div>
  );
}

import { localizedUiError } from "../lib/ui-error";
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GraduationCap,
  LoaderCircle,
  SkipForward,
} from "lucide-react";
import { useNavigate } from "react-router";
import { api } from "../lib/api";
import type { UserProfile } from "../types";
import { Button } from "../components/ui/button";
import { LOCALES, type LocaleCode, useI18n } from "../lib/i18n";

const steps = [
  {
    key: "language",
    options: LOCALES.map((item) => [item.code] as const),
  },
  { key: "country" },
  { key: "university" },
  { key: "specialization" },
  { key: "studyYear" },
  { key: "academicTerm" },
  { key: "courses" },
] as const;

type StepKey = (typeof steps)[number]["key"];

export function Onboarding() {
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Partial<UserProfile>>({
    language: locale,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .profile()
      .then((r) => setProfile(r.profile))
      .catch((e) => {
        console.error("Failed to load onboarding profile", e);
        setError(localizedUiError(e, t, "ui.loadError"));
      });
  }, []);
  const current = steps[step];
  const value = useMemo(
    () =>
      current.key === "courses"
        ? (profile.courses || []).join(locale === "ar" || locale === "ur" ? "، " : ", ")
        : String(profile[current.key as keyof UserProfile] || ""),
    [current.key, profile, locale],
  );
  const setValue = (v: string) => {
    if (current.key === "language" && LOCALES.some((item) => item.code === v)) setLocale(v as LocaleCode);
    setProfile((p) => ({
      ...p,
      [current.key]:
        current.key === "courses"
          ? v
              .split(/[،,]/)
              .map((x) => x.trim())
              .filter(Boolean)
          : v,
    }));
  };

  async function finish() {
    setSaving(true);
    setError("");
    try {
      await api.updateProfile({ ...profile, onboardingCompleted: true });
      window.location.replace("/app/upload");
    } catch (e: any) {
      setError(localizedUiError(e, t, "onboard.saveError"));
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (step === steps.length - 1) void finish();
    else setStep((s) => s + 1);
  }
  return (
    <div className="min-h-[calc(100vh-9rem)] grid place-items-center py-6">
      <div className="w-full max-w-2xl">
        <div className="mb-7 flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl brand-bg grid place-items-center">
            <GraduationCap size={21} />
          </div>
          <div>
            <div className="eyebrow">{t("onboard.eyebrow")}</div>
            <h1 className="text-xl font-semibold mt-1">{t("onboard.heading")}</h1>
          </div>
        </div>
        <div className="panel rounded-[28px] p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs muted">
              {t("onboard.stepPrefix")} {step + 1} {t("onboard.stepMid")}{" "}
              {steps.length}
            </span>
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 brand-bg" : "w-3 bg-[var(--line)]"}`}
                />
              ))}
            </div>
          </div>
          <div className="mt-9">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-[-.035em]">
              {t(`onboard.${current.key}.title`)}
            </h2>
            <p className="body-copy mt-3">
              {t(`onboard.${current.key}.description`)}
            </p>
          </div>
          <div className="mt-8 min-h-28">
            {"options" in current && current.options ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {current.options.map(([v]) => (
                  <button
                    key={v}
                    onClick={() => setValue(v)}
                    className={`focus-ring text-start rounded-2xl border hairline p-5 transition ${value === v ? "brand-soft-bg border-[var(--brand)]" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        {LOCALES.find((item) => item.code === v)?.name || v}
                      </span>
                      {value === v && (
                        <Check size={18} className="brand-text" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") next();
                }}
                placeholder={t(`onboard.${current.key}.placeholder`)}
                className="focus-ring w-full h-14 rounded-2xl border hairline bg-[var(--panel)] px-4 text-base outline-none"
              />
            )}
          </div>
          {error && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          <div className="mt-8 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => (step ? setStep((s) => s - 1) : navigate("/app"))}
              disabled={saving}
            >
              <ArrowLeft size={16} className="directional-icon" />
              {step ? t("onboard.prev") : t("onboard.later")}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={next} disabled={saving}>
                <SkipForward size={16} />
                {t("onboard.skip")}
              </Button>
              <Button onClick={next} disabled={saving}>
                {saving ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <ArrowRight size={16} className="directional-icon" />
                )}{" "}
                {step === steps.length - 1
                  ? t("onboard.start")
                  : t("onboard.next")}
              </Button>
            </div>
          </div>
        </div>
        <p className="text-[11px] muted text-center mt-5">
          {t("onboard.footer")}
        </p>
      </div>
    </div>
  );
}

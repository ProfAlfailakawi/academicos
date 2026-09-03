import React, { useEffect, useState } from "react";
import { CheckCircle2, Copy, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { Navigate, useNavigate } from "react-router";
import {
  multiFactor,
  TotpMultiFactorGenerator,
  type TotpSecret,
} from "firebase/auth";
import { useAuth } from "../contexts/AuthContext";
import { firebaseAuth } from "../lib/firebase";
import { useI18n } from "../lib/i18n";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export function MfaSetup() {
  const { t } = useI18n();
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [alreadyConfigured, setAlreadyConfigured] = useState(false);

  useEffect(() => {
    let active = true;
    async function prepare() {
      if (!user || !firebaseAuth?.currentUser) return;
      setBusy(true);
      setError("");
      try {
        const current = firebaseAuth.currentUser;
        const factors = multiFactor(current);
        if (factors.enrolledFactors.length > 0) {
          if (active) setAlreadyConfigured(true);
          return;
        }
        const session = await factors.getSession();
        const generated = await TotpMultiFactorGenerator.generateSecret(session);
        if (active) setSecret(generated);
      } catch (e: any) {
        if (!active) return;
        if (e?.code === "auth/requires-recent-login") setError(t("mfaSetup.recentLogin"));
        else if (e?.code === "auth/operation-not-allowed") setError(t("mfaSetup.notEnabled"));
        else setError(e?.message || t("mfaSetup.error"));
      } finally {
        if (active) setBusy(false);
      }
    }
    prepare();
    return () => { active = false; };
  }, [user, t]);

  if (loading)
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--bg)]">
        <LoaderCircle size={20} className="animate-spin" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (user.mfaSatisfied) return <Navigate to="/app" replace />;

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.secretKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function enroll(event: React.FormEvent) {
    event.preventDefault();
    const current = firebaseAuth?.currentUser;
    if (!current || !secret) return;
    setBusy(true);
    setError("");
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        secret,
        otp.trim(),
      );
      await multiFactor(current).enroll(assertion, "AcademicOS Authenticator");
      // Force a clean second-factor sign-in so the new ID token contains
      // firebase.sign_in_second_factor before any privileged operation.
      await logout();
      navigate("/login?mfa=enrolled", { replace: true });
    } catch (e: any) {
      if (
        e?.code === "auth/invalid-verification-code" ||
        e?.code === "auth/code-expired"
      ) setError(t("mfaSetup.invalidCode"));
      else if (e?.code === "auth/requires-recent-login") setError(t("mfaSetup.recentLogin"));
      else setError(e?.message || t("mfaSetup.error"));
      setBusy(false);
    }
  }

  async function signInAgain() {
    setBusy(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  const authenticatorUri = secret
    ? secret.generateQrCodeUrl(user.email || user.displayName, "AcademicOS")
    : "";

  return (
    <div className="min-h-screen bg-[var(--bg)] grid place-items-center p-4 md:p-8">
      <div className="absolute top-4 end-4"><LanguageSwitcher compact /></div>
      <Card className="w-full max-w-xl">
        <CardContent className="p-6 md:p-8">
          <div className="h-12 w-12 rounded-2xl tone-tile">
            <ShieldCheck size={22} />
          </div>
          <div className="eyebrow brand-text mt-5">{t("mfaSetup.eyebrow")}</div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-[-0.03em] mt-2">
            {t("mfaSetup.title")}
          </h1>
          <p className="body-copy mt-2">{t("mfaSetup.desc")}</p>

          {alreadyConfigured ? (
            <div className="mt-6 rounded-2xl border hairline p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">{t("mfaSetup.alreadyConfigured")}</div>
                  <p className="body-copy mt-1 text-sm">{t("mfaSetup.signInAgainDesc")}</p>
                </div>
              </div>
              <Button className="w-full mt-5" onClick={signInAgain} disabled={busy}>
                {busy && <LoaderCircle size={16} className="animate-spin" />}
                {t("mfaSetup.signInAgain")}
              </Button>
            </div>
          ) : busy && !secret ? (
            <div className="mt-8 flex items-center gap-3 text-sm muted">
              <LoaderCircle size={18} className="animate-spin" />
              {t("mfaSetup.preparing")}
            </div>
          ) : secret ? (
            <form onSubmit={enroll} className="space-y-5 mt-6">
              <div className="rounded-2xl brand-soft-bg border border-[var(--border-subtle)] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <KeyRound size={16} /> {t("mfaSetup.secretLabel")}
                </div>
                <p className="text-xs muted leading-5 mt-2">{t("mfaSetup.manualNote")}</p>
                <div className="mt-3 flex items-center gap-2">
                  <code dir="ltr" className="min-w-0 flex-1 rounded-xl bg-[var(--panel)] border hairline px-3 py-2.5 text-xs break-all select-all">
                    {secret.secretKey}
                  </code>
                  <Button type="button" variant="secondary" size="sm" onClick={copySecret}>
                    {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                    {copied ? t("mfaSetup.copied") : t("mfaSetup.copy")}
                  </Button>
                </div>
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer brand-text font-semibold">{t("mfaSetup.uriLabel")}</summary>
                  <code dir="ltr" className="block mt-2 rounded-xl bg-[var(--panel)] border hairline px-3 py-2.5 text-[10px] break-all select-all">
                    {authenticatorUri}
                  </code>
                </details>
              </div>

              <label className="block">
                <span className="text-xs font-semibold">{t("mfaSetup.otpLabel")}</span>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\s/g, ""))}
                  className="field mt-1.5 text-center tracking-[0.22em]"
                  placeholder="000000"
                />
              </label>

              {error && (
                <div role="alert" className="text-xs p-3 rounded-lg bg-danger/10 text-danger border border-danger/20 leading-5">
                  {error}
                </div>
              )}

              <Button className="w-full" disabled={busy || otp.trim().length < 6}>
                {busy ? <><LoaderCircle size={16} className="animate-spin" />{t("mfaSetup.enrolling")}</> : t("mfaSetup.enroll")}
              </Button>
            </form>
          ) : null}

          {!secret && !alreadyConfigured && error && (
            <div role="alert" className="mt-6 text-xs p-3 rounded-lg bg-danger/10 text-danger border border-danger/20 leading-5">
              {error}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

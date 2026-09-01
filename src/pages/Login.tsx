import React, { useState } from "react";
import { Link, Navigate, useLocation } from "react-router";
import {
  ArrowRight,
  LoaderCircle,
  LockKeyhole,
  ShieldAlert,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../lib/i18n";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export function Login() {
  const { t } = useI18n();
  const { user, login, signup, resetPassword, configured } = useAuth(),
    [mode, setMode] = useState<"login" | "signup" | "forgot">("login"),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [successMsg, setSuccessMsg] = useState(""),
    location = useLocation(),
    showcaseMode = Boolean(import.meta.env.DEV && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL);

  if (user)
    return <Navigate to={(location.state as any)?.from || "/app"} replace />;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccessMsg("");
    try {
      if (mode === "signup") {
        await signup(name, email, password);
      } else if (mode === "forgot") {
        await resetPassword(email);
        setSuccessMsg(t("login.resetSent"));
        setBusy(false);
      } else {
        await login(email, password);
      }
    } catch (e: any) {
      let msg = e.message || t("login.errorGeneric");
      if (e.code === "auth/operation-not-allowed") {
        msg = t("login.firebaseEmailDisabled");
      } else if (
        e.code === "auth/invalid-credential" ||
        e.code === "auth/wrong-password" ||
        e.code === "auth/user-not-found"
      ) {
        msg = t("login.invalidCredentials");
      } else if (e.code === "auth/email-already-in-use") {
        msg = t("login.emailInUse");
      } else if (e.code === "auth/weak-password") {
        msg = t("login.weakPassword");
      }
      setError(msg);
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell min-h-screen grid lg:grid-cols-[1fr_.8fr] bg-[var(--bg)]">
      <section className="auth-visual hidden lg:flex paper-grid p-10 xl:p-16 flex-col justify-between border-l hairline">
        <Link to="/" className="flex items-center gap-3 w-fit">
          <div className="h-10 w-10 rounded-xl brand-bg flex items-center justify-center text-xs font-semibold">
            AO
          </div>
          <div className="font-semibold">AcademicOS</div>
        </Link>
        <div className="max-w-xl">
          <div className="eyebrow brand-text">{t("login.journey")}</div>
          <h1 className="text-5xl xl:text-6xl font-semibold tracking-[-0.05em] leading-[1.06] mt-4">
            {t("login.marketingLine1")}<br />{t("login.marketingLine2")}
          </h1>
          <p className="body-copy mt-5 text-base">
            {t("login.marketingBody")}
          </p>
        </div>
        <div className="text-xs muted">
          {t("login.privateNote")}
        </div>
      </section>
      <main className="relative flex items-center justify-center p-4 md:p-8">
        <div className="absolute top-4 end-4"><LanguageSwitcher compact /></div>
        <Card className="auth-card w-full max-w-md">
          <CardContent className="p-6 md:p-8">
            <Button variant="ghost" asChild size="sm" className="-ms-2 mb-6">
              <Link to="/">
                <ArrowRight size={15} />
                {t("login.home")}
              </Link>
            </Button>
            <div className="h-12 w-12 rounded-2xl brand-soft-bg flex items-center justify-center">
              {mode === "forgot" ? <KeyRound size={20} /> : <LockKeyhole size={20} />}
            </div>
            <h1 className="text-2xl font-semibold mt-5">
              {mode === "signup" ? t("login.signupTitle") : mode === "forgot" ? t("login.forgotTitle") : t("login.welcomeBack")}
            </h1>
            <p className="body-copy mt-2">
              {mode === "signup" ? t("login.signupDesc") : mode === "forgot" ? t("login.forgotDesc") : t("login.signinDesc")}
            </p>

            <form onSubmit={submit} className="space-y-4 mt-5">
              {mode === "signup" && (
                <label className="block">
                  <span className="text-xs font-semibold">{t("login.name")}</span>
                  <input
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="field mt-1.5"
                    placeholder={t("login.namePlaceholder")}
                  />
                </label>
              )}
              <label className="block">
                <span className="text-xs font-semibold">
                  {t("login.emailLabel")}
                </span>
                <input
                  autoComplete="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field mt-1.5"
                  placeholder="name@example.com"
                />
              </label>

              {mode !== "forgot" && (
                <label className="block">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">
                      {t("login.passwordLabel")}
                    </span>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode("forgot");
                          setError("");
                          setSuccessMsg("");
                        }}
                        className="text-[11px] brand-text hover:underline"
                      >
                        {t("login.forgotPassword")}
                      </button>
                    )}
                  </div>
                  <input
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="field mt-1.5"
                    placeholder="••••••••"
                  />
                </label>
              )}

              {error && (
                <div
                  role="alert"
                  className="text-xs p-3 rounded-lg bg-red-500/10 text-[var(--danger)] border border-red-500/20 leading-5"
                >
                  {error}
                </div>
              )}

              {successMsg && (
                <div
                  role="status"
                  className="text-xs p-3 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-start gap-2 leading-5"
                >
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  <div>{successMsg}</div>
                </div>
              )}

              <Button className="w-full" disabled={busy}>
                {busy ? (
                  <>
                    <LoaderCircle size={16} className="animate-spin" />
                    {t("login.verifying")}
                  </>
                ) : mode === "signup" ? (
                  t("login.createAccount")
                ) : mode === "forgot" ? (
                  t("login.sendReset")
                ) : (
                  t("login.submit")
                )}
              </Button>
            </form>

            <div className="mt-5 space-y-2">
              {mode === "login" ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="muted">{t("login.noAccount")}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setError("");
                      setSuccessMsg("");
                    }}
                    className="focus-ring font-semibold brand-text py-1 px-2 rounded-lg"
                  >
                    {t("login.newStudentAccount")}
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError("");
                      setSuccessMsg("");
                    }}
                    className="focus-ring text-xs font-semibold brand-text py-1 px-2 rounded-lg"
                  >
                    {t("login.backToSignIn")}
                  </button>
                </div>
              )}
            </div>

            {mode === "login" && (
              <div className="mt-6 rounded-2xl brand-soft-bg p-4 border border-[var(--border-subtle)]">
                <div className="text-xs font-semibold">{t("login.showcaseTitle")}</div>
                <p className="text-[10px] muted leading-5 mt-1">{t("login.showcaseDesc")}</p>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {[
                    ["student@showcase.academicos.local", t("login.roleStudent")],
                    ["professor@showcase.academicos.local", t("login.roleTeacher")],
                    ["university_admin@showcase.academicos.local", t("login.roleAdmin")],
                  ].map(([showcaseEmail, label]) => (
                    <button
                      key={showcaseEmail}
                      type="button"
                      onClick={async () => {
                        setEmail(showcaseEmail);
                        setPassword("AcademicOS!Showcase2026");
                        setBusy(true);
                        setError("");
                        try {
                          await login(showcaseEmail, "AcademicOS!Showcase2026");
                        } catch (e: any) {
                          setError(e.message || t("login.errorGeneric"));
                          setBusy(false);
                        }
                      }}
                      className="focus-ring rounded-xl bg-[var(--panel)] hover:bg-[var(--panel-hover)] px-2 py-2.5 text-[11px] font-semibold border hairline transition-colors shadow-xs"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 pt-5 border-t hairline text-[11px] muted leading-5">
              <strong>{t("login.firstTimeTitle")}</strong> {t("login.firstTimeDesc")}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

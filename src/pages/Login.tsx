import React, { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation } from "react-router";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import {
  getMultiFactorResolver,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  TotpMultiFactorGenerator,
  type MultiFactorInfo,
  type MultiFactorResolver,
} from "firebase/auth";
import { useAuth } from "../contexts/AuthContext";
import { firebaseAuth } from "../lib/firebase";
import { useI18n } from "../lib/i18n";
import { Button } from "../components/ui/button";
import { Logo } from "../components/brand/Logo";
import { Card, CardContent } from "../components/ui/card";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

function factorLabel(factor: MultiFactorInfo, t: (key: string) => string) {
  if (factor.factorId === TotpMultiFactorGenerator.FACTOR_ID)
    return factor.displayName || t("login.mfaTotp");
  if (factor.factorId === PhoneMultiFactorGenerator.FACTOR_ID) {
    const phone = (factor as MultiFactorInfo & { phoneNumber?: string }).phoneNumber;
    return factor.displayName || phone || t("login.mfaPhone");
  }
  return factor.displayName || factor.factorId;
}

export function Login() {
  const { t } = useI18n();
  const { user, login, signup, resetPassword, configured } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [mfaFactorIndex, setMfaFactorIndex] = useState(0);
  const [mfaCode, setMfaCode] = useState("");
  const [phoneVerificationId, setPhoneVerificationId] = useState("");
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const location = useLocation();
  const showcaseMode = Boolean(
    import.meta.env.DEV && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL,
  );

  useEffect(() => {
    if (new URLSearchParams(location.search).get("mfa") === "enrolled") {
      setSuccessMsg(t("login.mfaEnrolledSuccess"));
    }
  }, [location.search, t]);

  useEffect(
    () => () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    },
    [],
  );

  if (user)
    return <Navigate to={(location.state as any)?.from || "/app"} replace />;

  function resetMfaChallenge() {
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
    setMfaResolver(null);
    setMfaFactorIndex(0);
    setMfaCode("");
    setPhoneVerificationId("");
    setError("");
    setBusy(false);
  }

  function startMfaChallenge(authError: any) {
    if (!firebaseAuth) throw authError;
    const resolver = getMultiFactorResolver(firebaseAuth, authError);
    if (!resolver.hints.length) throw authError;
    setMfaResolver(resolver);
    setMfaFactorIndex(0);
    setMfaCode("");
    setPhoneVerificationId("");
    setError("");
    setBusy(false);
  }

  function mapAuthError(e: any) {
    if (
      e?.code === "auth/invalid-verification-code" ||
      e?.code === "auth/code-expired"
    )
      return t("login.mfaInvalidCode");
    if (e?.code === "auth/too-many-requests") return t("login.mfaTooManyRequests");
    if (e?.code === "auth/operation-not-allowed") return t("login.firebaseEmailDisabled");
    if (
      e?.code === "auth/invalid-credential" ||
      e?.code === "auth/wrong-password" ||
      e?.code === "auth/user-not-found"
    )
      return t("login.invalidCredentials");
    if (e?.code === "auth/email-already-in-use") return t("login.emailInUse");
    if (e?.code === "auth/weak-password") return t("login.weakPassword");
    return e?.message || t("login.errorGeneric");
  }

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
      if (e?.code === "auth/multi-factor-auth-required") {
        try {
          startMfaChallenge(e);
          return;
        } catch (resolverError: any) {
          setError(mapAuthError(resolverError));
          setBusy(false);
          return;
        }
      }
      setError(mapAuthError(e));
      setBusy(false);
    }
  }

  async function sendPhoneMfaCode() {
    if (!mfaResolver || !firebaseAuth) return;
    const hint = mfaResolver.hints[mfaFactorIndex];
    if (!hint || hint.factorId !== PhoneMultiFactorGenerator.FACTOR_ID) return;
    setBusy(true);
    setError("");
    try {
      recaptchaRef.current?.clear();
      recaptchaRef.current = new RecaptchaVerifier(
        firebaseAuth,
        "mfa-recaptcha-container",
        { size: "invisible" },
      );
      const provider = new PhoneAuthProvider(firebaseAuth);
      const verificationId = await provider.verifyPhoneNumber(
        { multiFactorHint: hint, session: mfaResolver.session },
        recaptchaRef.current,
      );
      setPhoneVerificationId(verificationId);
      setSuccessMsg(t("login.mfaCodeSent"));
    } catch (e: any) {
      setError(mapAuthError(e));
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setBusy(false);
    }
  }

  async function resolveMfa(event: React.FormEvent) {
    event.preventDefault();
    if (!mfaResolver) return;
    const hint = mfaResolver.hints[mfaFactorIndex];
    if (!hint) return;
    setBusy(true);
    setError("");
    try {
      let assertion;
      if (hint.factorId === TotpMultiFactorGenerator.FACTOR_ID) {
        assertion = TotpMultiFactorGenerator.assertionForSignIn(
          hint.uid,
          mfaCode.trim(),
        );
      } else if (hint.factorId === PhoneMultiFactorGenerator.FACTOR_ID) {
        if (!phoneVerificationId) {
          setError(t("login.mfaSendFirst"));
          setBusy(false);
          return;
        }
        const credential = PhoneAuthProvider.credential(
          phoneVerificationId,
          mfaCode.trim(),
        );
        assertion = PhoneMultiFactorGenerator.assertion(credential);
      } else {
        setError(t("login.mfaUnsupported"));
        setBusy(false);
        return;
      }
      await mfaResolver.resolveSignIn(assertion);
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } catch (e: any) {
      setError(mapAuthError(e));
      setBusy(false);
    }
  }

  const selectedFactor = mfaResolver?.hints[mfaFactorIndex];

  return (
    <div className="auth-shell min-h-screen grid lg:grid-cols-[1fr_.8fr] bg-[var(--bg)]">
      <section className="auth-visual hidden lg:flex paper-grid p-10 xl:p-16 flex-col justify-between border-e hairline">
        <Link to="/" className="focus-ring rounded-2xl w-fit">
          <Logo markSize={42} caption={t("brand.tagline")} />
        </Link>
        <div className="max-w-xl">
          <div className="eyebrow brand-text">{t("login.journey")}</div>
          <h1 className="text-5xl xl:text-6xl font-semibold tracking-[-0.05em] leading-[1.06] mt-4">
            {t("login.marketingLine1")}<br />{t("login.marketingLine2")}
          </h1>
          <p className="body-copy mt-5 text-base">{t("login.marketingBody")}</p>
        </div>
        <div className="text-xs muted">{t("login.privateNote")}</div>
      </section>
      <main className="relative flex items-center justify-center p-4 md:p-8">
        <div className="absolute top-4 end-4"><LanguageSwitcher compact /></div>
        <Card className="auth-card w-full max-w-md">
          <CardContent className="p-6 md:p-8">
            <Button variant="ghost" asChild size="sm" className="-ms-2 mb-6">
              <Link to="/">
                <ArrowLeft size={15} className="directional-icon" />
                {t("login.home")}
              </Link>
            </Button>

            {mfaResolver ? (
              <>
                <div className="h-12 w-12 rounded-2xl tone-tile">
                  <ShieldCheck size={21} />
                </div>
                <h1 className="text-2xl font-semibold mt-5">{t("login.mfaTitle")}</h1>
                <p className="body-copy mt-2">{t("login.mfaDesc")}</p>

                <form onSubmit={resolveMfa} className="space-y-4 mt-5">
                  {mfaResolver.hints.length > 1 && (
                    <label className="block">
                      <span className="text-xs font-semibold">{t("login.mfaMethod")}</span>
                      <select
                        className="field mt-1.5"
                        value={mfaFactorIndex}
                        onChange={(event) => {
                          setMfaFactorIndex(Number(event.target.value));
                          setMfaCode("");
                          setPhoneVerificationId("");
                          setSuccessMsg("");
                          setError("");
                        }}
                      >
                        {mfaResolver.hints.map((hint, index) => (
                          <option value={index} key={hint.uid}>
                            {factorLabel(hint, t)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <div className="rounded-xl border hairline p-3 text-xs">
                    <div className="font-semibold">{factorLabel(selectedFactor!, t)}</div>
                    <div className="muted mt-1">{t("login.mfaMethodHint")}</div>
                  </div>

                  {selectedFactor?.factorId === PhoneMultiFactorGenerator.FACTOR_ID && (
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      disabled={busy}
                      onClick={sendPhoneMfaCode}
                    >
                      {phoneVerificationId ? t("login.mfaResendCode") : t("login.mfaSendCode")}
                    </Button>
                  )}
                  <div id="mfa-recaptcha-container" />

                  <label className="block">
                    <span className="text-xs font-semibold">{t("login.mfaCode")}</span>
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\s/g, ""))}
                      className="field mt-1.5 text-center tracking-[0.22em]"
                      placeholder="000000"
                    />
                  </label>

                  {error && (
                    <div role="alert" className="text-xs p-3 rounded-lg bg-danger/10 text-danger border border-danger/20 leading-5">
                      {error}
                    </div>
                  )}
                  {successMsg && (
                    <div role="status" className="text-xs p-3 rounded-lg bg-success/10 text-success border border-success/20 flex items-start gap-2 leading-5">
                      <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                      <div>{successMsg}</div>
                    </div>
                  )}

                  <Button className="w-full" disabled={busy || !mfaCode.trim()}>
                    {busy ? <><LoaderCircle size={16} className="animate-spin" />{t("login.verifying")}</> : t("login.mfaVerify")}
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={resetMfaChallenge} disabled={busy}>
                    {t("login.mfaCancel")}
                  </Button>
                </form>
              </>
            ) : (
              <>
                <div className="h-12 w-12 rounded-2xl tone-tile">
                  {mode === "forgot" ? <KeyRound size={20} /> : <LockKeyhole size={20} />}
                </div>
                <h1 className="text-2xl font-semibold mt-5">
                  {mode === "signup" ? t("login.signupTitle") : mode === "forgot" ? t("login.forgotTitle") : t("login.welcomeBack")}
                </h1>
                <p className="body-copy mt-2">
                  {mode === "signup" ? t("login.signupDesc") : mode === "forgot" ? t("login.forgotDesc") : t("login.signinDesc")}
                </p>

                {!configured && (
                  <div role="alert" className="mt-5 text-xs p-3 rounded-lg bg-danger/10 text-danger border border-danger/20 leading-5">
                    <strong>{t("login.notConfiguredTitle")}</strong><br />
                    {t("login.notConfiguredBody")}
                  </div>
                )}

                <form onSubmit={submit} className="space-y-4 mt-5">
                  {mode === "signup" && (
                    <label className="block">
                      <span className="text-xs font-semibold">{t("login.name")}</span>
                      <input autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className="field mt-1.5" placeholder={t("login.namePlaceholder")} />
                    </label>
                  )}
                  <label className="block">
                    <span className="text-xs font-semibold">{t("login.emailLabel")}</span>
                    <input autoComplete="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field mt-1.5" placeholder="name@example.com" />
                  </label>

                  {mode !== "forgot" && (
                    <label className="block">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{t("login.passwordLabel")}</span>
                        {mode === "login" && (
                          <button type="button" onClick={() => { setMode("forgot"); setError(""); setSuccessMsg(""); }} className="text-[11px] brand-text hover:underline">
                            {t("login.forgotPassword")}
                          </button>
                        )}
                      </div>
                      <input autoComplete={mode === "signup" ? "new-password" : "current-password"} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="field mt-1.5" placeholder="••••••••" />
                    </label>
                  )}

                  {error && (
                    <div role="alert" className="text-xs p-3 rounded-lg bg-danger/10 text-danger border border-danger/20 leading-5">{error}</div>
                  )}
                  {successMsg && (
                    <div role="status" className="text-xs p-3 rounded-lg bg-success/10 text-success border border-success/20 flex items-start gap-2 leading-5">
                      <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                      <div>{successMsg}</div>
                    </div>
                  )}

                  <Button className="w-full" disabled={busy || !configured}>
                    {busy ? <><LoaderCircle size={16} className="animate-spin" />{t("login.verifying")}</> : mode === "signup" ? t("login.createAccount") : mode === "forgot" ? t("login.sendReset") : t("login.submit")}
                  </Button>
                </form>

                <div className="mt-5 space-y-2">
                  {mode === "login" ? (
                    <div className="flex items-center justify-between text-xs">
                      <span className="muted">{t("login.noAccount")}</span>
                      <button type="button" onClick={() => { setMode("signup"); setError(""); setSuccessMsg(""); }} className="focus-ring font-semibold brand-text py-1 px-2 rounded-lg">
                        {t("login.newStudentAccount")}
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <button type="button" onClick={() => { setMode("login"); setError(""); setSuccessMsg(""); }} className="focus-ring text-xs font-semibold brand-text py-1 px-2 rounded-lg">
                        {t("login.backToSignIn")}
                      </button>
                    </div>
                  )}
                </div>

                {mode === "login" && showcaseMode && (
                  <div className="mt-6 rounded-2xl brand-soft-bg p-4 border border-[var(--border-subtle)]">
                    <div className="text-xs font-semibold">{t("login.showcaseTitle")}</div>
                    <p className="text-[10px] muted leading-5 mt-1">{t("login.showcaseDesc")}</p>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {[
                        ["student@showcase.academicos.local", t("login.roleStudent")],
                        ["professor@showcase.academicos.local", t("login.roleTeacher")],
                        ["university_admin@showcase.academicos.local", t("login.roleAdmin")],
                      ].map(([showcaseEmail, label]) => (
                        <button key={showcaseEmail} type="button" onClick={async () => {
                          setEmail(showcaseEmail); setPassword("AcademicOS!Showcase2026"); setBusy(true); setError("");
                          try { await login(showcaseEmail, "AcademicOS!Showcase2026"); }
                          catch (e: any) { if (e?.code === "auth/multi-factor-auth-required") startMfaChallenge(e); else { setError(mapAuthError(e)); setBusy(false); } }
                        }} className="focus-ring rounded-xl bg-[var(--panel)] hover:bg-[var(--panel-hover)] px-2 py-2.5 text-[11px] font-semibold border hairline transition-colors shadow-xs">
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 pt-5 border-t hairline text-[11px] muted leading-5">
                  <strong>{t("login.firstTimeTitle")}</strong> {t("login.firstTimeDesc")}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

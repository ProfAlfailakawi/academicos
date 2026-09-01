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
    location = useLocation();

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
        setSuccessMsg("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريد الإلكتروني. يرجى التحقق من صندوق الوارد أو البريد المزعج (Spam).");
        setBusy(false);
      } else {
        await login(email, password);
      }
    } catch (e: any) {
      let msg = e.message || t("login.errorGeneric");
      if (e.code === "auth/operation-not-allowed") {
        msg = "خطأ Firebase: خدمة تسجيل الدخول بالبريد وكلمة المرور غير مفعلة حالياً في مشروع Firebase. يرجى تفعيل (Email/Password) من لوحة تحكم Firebase (Authentication -> Sign-in method).";
      } else if (
        e.code === "auth/invalid-credential" ||
        e.code === "auth/wrong-password" ||
        e.code === "auth/user-not-found"
      ) {
        msg = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
      } else if (e.code === "auth/email-already-in-use") {
        msg = "البريد الإلكتروني مسجل مسبقاً. حاول تسجيل الدخول أو استعادة كلمة المرور.";
      } else if (e.code === "auth/weak-password") {
        msg = "كلمة المرور ضعيفة. يرجى استخدام 6 أحرف على الأقل.";
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
          <div className="eyebrow brand-text">من التكليف إلى المناقشة</div>
          <h1 className="text-5xl xl:text-6xl font-semibold tracking-[-0.05em] leading-[1.06] mt-4">
            مشروعك كامل.
            <br />
            وأنت فاهم كل سطر.
          </h1>
          <p className="body-copy mt-5 text-base">
            اكتب، عدّل، افحص المصادر، ثم تدرّب على أسئلة الدكتور داخل مساحة واحدة.
          </p>
        </div>
        <div className="text-xs muted">
          حساب خاص · ملفات مشفرة · لا مشاركة دون إذنك
        </div>
      </section>
      <main className="flex items-center justify-center p-4 md:p-8">
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
              {mode === "signup"
                ? "أنشئ حساب الطالب"
                : mode === "forgot"
                ? "استعادة كلمة المرور"
                : "أهلاً بعودتك"}
            </h1>
            <p className="body-copy mt-2">
              {mode === "signup"
                ? "دقيقة واحدة ونفتح لك أول مشروع. (ضع كلمة مرور خاصة بك ولن تحتاج رقماً سرياً افتراضياً)."
                : mode === "forgot"
                ? "أدخل بريدك الإلكتروني المسجل لنرسل لك رابط إعادة تعيين كلمة المرور."
                : "ادخل بريدك وكلمة المرور الخاصة بحسابك (أو حساب الإدارة الخاص بك)."}
            </p>

            {!configured ? (
              <div
                role="alert"
                className="mt-5 rounded-xl bg-amber-500/10 text-[var(--warning)] p-4 text-xs leading-6 border border-amber-500/20"
              >
                <div className="flex items-center gap-2 font-semibold text-sm mb-1">
                  <ShieldAlert size={16} />
                  {t("login.notConfiguredTitle")}
                </div>
                {t("login.notConfiguredBody")}
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4 mt-5">
                {mode === "signup" && (
                  <label className="block">
                    <span className="text-xs font-semibold">الاسم</span>
                    <input
                      autoComplete="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="field mt-1.5"
                      placeholder="اسمك الأول أو اسمك الكامل"
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
                          نسيت كلمة المرور؟
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
                    "أنشئ حسابي الآن"
                  ) : mode === "forgot" ? (
                    "إرسال رابط الاستعادة بالبريد"
                  ) : (
                    t("login.submit")
                  )}
                </Button>
              </form>
            )}

            {configured && (
              <div className="mt-5 space-y-2">
                {mode === "login" ? (
                  <div className="flex items-center justify-between text-xs">
                    <span className="muted">ليس لديك حساب؟</span>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signup");
                        setError("");
                        setSuccessMsg("");
                      }}
                      className="focus-ring font-semibold brand-text py-1 px-2 rounded-lg"
                    >
                      أنشئ حساب طالب جديد
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
                      العودة لتسجيل الدخول
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 pt-5 border-t hairline text-[11px] muted leading-5">
              💡 <strong>تنبيه أول مرة:</strong> لا يوجد رقم سري افتراضي سابق؛ اختر كلمة المرور التي تحبها عند إنشاء حسابك الجديد. ولحسابك كأدمن (Dr.Ahmad.Alfailakawi@gmail.com)، سجّل الدخول مباشرة أو أنشئ حساباً بنفس البريد الإلكتروني لتفعيل صلاحيات المالك الجذرية تلقائياً.
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

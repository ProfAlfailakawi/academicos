import React, { useState } from "react";
import { Link, Navigate, useLocation } from "react-router";
import {
  ArrowRight,
  LoaderCircle,
  LockKeyhole,
  ShieldAlert,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../lib/i18n";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

export function Login() {
  const { t } = useI18n();
  const { user, login, signup, configured } = useAuth(),
    [mode, setMode] = useState<"login" | "signup">("login"),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    location = useLocation();
  if (user)
    return <Navigate to={(location.state as any)?.from || "/app"} replace />;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "signup") await signup(name, email, password);
      else await login(email, password);
    } catch (e: any) {
      setError(e.message || t("login.errorGeneric"));
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
          <p className="body-copy mt-5 text-base">اكتب، عدّل، افحص المصادر، ثم تدرّب على أسئلة الدكتور داخل مساحة واحدة.</p>
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
              <LockKeyhole size={20} />
            </div>
            <h1 className="text-2xl font-semibold mt-5">{mode === "signup" ? "أنشئ حساب الطالب" : "أهلاً بعودتك"}</h1>
            <p className="body-copy mt-2">{mode === "signup" ? "دقيقة واحدة ونفتح لك أول مشروع." : "ادخل وكمل من آخر قسم."}</p>
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
                {mode === "signup" && <label className="block"><span className="text-xs font-semibold">الاسم</span><input autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} className="field mt-1.5" placeholder="اسمك الأول يكفي" /></label>}
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
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold">
                    {t("login.passwordLabel")}
                  </span>
                  <input
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="field mt-1.5"
                  />
                </label>
                {error && (
                  <div role="alert" className="text-xs text-[var(--danger)]">
                    {error}
                  </div>
                )}
                <Button className="w-full" disabled={busy}>
                  {busy ? (
                    <>
                      <LoaderCircle size={16} className="animate-spin" />
                      {t("login.verifying")}
                    </>
                  ) : (
                    mode === "signup" ? "أنشئ حسابي" : t("login.submit")
                  )}
                </Button>
              </form>
            )}
            {configured && <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }} className="focus-ring w-full text-xs font-semibold brand-text mt-5 rounded-xl py-2">{mode === "login" ? "جديد؟ أنشئ حساب طالب" : "عندك حساب؟ سجّل الدخول"}</button>}
            <div className="mt-6 pt-5 border-t hairline text-[11px] muted leading-5">
              نحفظ حسابك ومشاريعك بصلاحيات منفصلة. لا توجد كلمة مرور أو هوية تجريبية مخفية داخل الواجهة.
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

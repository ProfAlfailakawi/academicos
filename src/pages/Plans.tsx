import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Check, CreditCard, LoaderCircle, ShieldCheck, Sparkles, Users } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";

const fallbackPlans = [
  { id: "preview", name: "معاينة مجانية", amountKwd: 0, description: "تحليل التكليف وخطة أولية", icon: Sparkles },
  { id: "project", name: "المشروع الكامل", amountKwd: 4.9, description: "كتابة الأقسام، X-Ray، تعديلات وWord", icon: CreditCard, popular: true },
  { id: "project_viva", name: "المشروع + المناقشة", amountKwd: 6.9, description: "كل شيء مع تدريب مناقشة وأسئلة من مشروعك", icon: ShieldCheck },
  { id: "group", name: "مشروع المجموعة", amountKwd: 8.9, description: "نسخة فريق بأدوار وتسليم موحد", icon: Users },
] as const;

export function Plans() {
  const [params] = useSearchParams();
  const [configured, setConfigured] = useState(false);
  const [provider, setProvider] = useState("disabled");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    api.billingStatus().then(({ billing }) => {
      setConfigured(billing.configured);
      setProvider(billing.provider);
    }).catch(() => undefined);
    if (params.get("billing") === "success") setMessage("تم الدفع بنجاح. باقتك جاهزة للاستخدام.");
    if (params.get("billing") === "cancelled") setMessage("تم إلغاء الدفع ولم يُخصم شيء.");
  }, []);

  async function checkout(planId: "project" | "project_viva" | "group") {
    if (!configured) { setMessage("واجهة الدفع جاهزة. أضف مفاتيح Stripe أو Tap أو MyFatoorah لتفعيل التحصيل الحقيقي."); return; }
    setBusy(planId); setMessage("");
    try { const result = await api.createCheckout(planId); window.location.assign(result.url); }
    catch (error: any) { setMessage(error.message || "تعذر فتح بوابة الدفع."); setBusy(""); }
  }

  return <div dir="rtl" className="mx-auto max-w-6xl space-y-8">
    <header className="text-center max-w-3xl mx-auto">
      <div className="student-proof-chip"><CreditCard size={14} /> ادفع لكل مشروع فقط</div>
      <h1 className="text-3xl md:text-5xl font-black tracking-[-.05em] mt-5">باقات بسيطة بسعر الطالب</h1>
      <p className="body-copy mt-3">لا اشتراك إجباري. ابدأ بالمعاينة، ثم افتح الباقة المناسبة عندما تكون مستعداً.</p>
    </header>
    {message && <div role="status" className="rounded-2xl brand-soft-bg p-4 text-sm text-center">{message}</div>}
    <div className="plan-grid">
      {fallbackPlans.map((plan) => {
        const Icon = plan.icon;
        const paid = plan.id !== "preview";
        return <article key={plan.id} className={`plan-card ${"popular" in plan && plan.popular ? "is-popular" : ""}`}>
          {"popular" in plan && plan.popular && <span className="plan-card__popular">الأكثر اختياراً</span>}
          <span className="plan-card__icon"><Icon size={22} /></span>
          <h2>{plan.name}</h2>
          <div className="plan-price"><strong>{plan.amountKwd ? plan.amountKwd.toFixed(3) : "0"}</strong><span>د.ك</span></div>
          <p>{plan.description}</p>
          <ul><li><Check size={14} /> مشروع واحد بلا تجديد تلقائي</li><li><Check size={14} /> حفظ نسخ وتعديلات</li><li><Check size={14} /> واجهة عربية سهلة</li></ul>
          <Button className="w-full mt-auto" variant={paid ? "default" : "outline"} disabled={busy === plan.id} onClick={() => paid ? checkout(plan.id as "project" | "project_viva" | "group") : setMessage("المعاينة المجانية تبدأ تلقائياً مع أول تكليف.")}>{busy === plan.id ? <LoaderCircle size={15} className="animate-spin" /> : null}{paid ? "اختر الباقة" : "ابدأ مجاناً"}</Button>
        </article>;
      })}
    </div>
    <div className="rounded-2xl border hairline p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"><span><strong>حالة الربط:</strong> {configured ? `متصل عبر ${provider}` : "جاهز للمفاتيح السرية"}</span><span className="muted">المبالغ يحددها الخادم ولا يقبل أسعاراً من المتصفح.</span></div>
  </div>;
}

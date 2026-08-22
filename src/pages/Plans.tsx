import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  ArrowLeft,
  BookOpenCheck,
  Check,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { api } from "../lib/api";
import type { ProjectAccess, ProjectDNA } from "../types";
import { Button } from "../components/ui/button";

const fallbackPlans = [
  { id: "preview", name: "معاينة مجانية", amountKwd: 0, description: "3 صفحات من مشروعك لتجرب الجودة", icon: Sparkles },
  { id: "project", name: "المشروع الكامل", amountKwd: 4.9, description: "المشروع الكامل، تعديلات الأقسام وWord", icon: CreditCard, popular: true },
  { id: "project_viva", name: "المشروع + المناقشة", amountKwd: 6.9, description: "كل شيء مع أسئلة مناقشة من مشروعك", icon: ShieldCheck },
  { id: "group", name: "مشروع المجموعة", amountKwd: 8.9, description: "مشروع فريق بأدوار وتسليم موحد", icon: Users },
] as const;

export function Plans() {
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState<ProjectDNA[]>([]);
  const [selectedId, setSelectedId] = useState(params.get("project") || "");
  const [access, setAccess] = useState<ProjectAccess | null>(null);
  const [configured, setConfigured] = useState(false);
  const [provider, setProvider] = useState("disabled");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([api.billingStatus(), api.projects()])
      .then(([status, projectResult]) => {
        setConfigured(status.billing.configured);
        setProvider(status.billing.provider);
        setProjects(projectResult.projects);
        setSelectedId((current) =>
          projectResult.projects.some((project) => project.id === current)
            ? current
            : projectResult.projects[0]?.id || "",
        );
      })
      .catch((error) => setMessage(error.message || "تعذر تحميل الباقات."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setAccess(null);
      return;
    }
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("project", selectedId);
      return next;
    }, { replace: true });
    api.projectAccess(selectedId).then((result) => setAccess(result.access)).catch(() => setAccess(null));
  }, [selectedId]);

  useEffect(() => {
    if (params.get("billing") === "cancelled") {
      setMessage("تم إلغاء الدفع ولم يُخصم شيء.");
      return;
    }
    if (params.get("billing") !== "success" || !selectedId) return;
    let active = true;
    let attempts = 0;
    setMessage("تمت العودة من بوابة الدفع. نؤكد تفعيل المشروع الآن…");
    const verify = async () => {
      attempts += 1;
      try {
        const result = await api.projectAccess(selectedId);
        if (!active) return;
        setAccess(result.access);
        if (result.access.unlocked) {
          setMessage("تم تأكيد الدفع وفتح المشروع بنجاح.");
          return;
        }
      } catch {}
      if (active && attempts < 12) window.setTimeout(verify, 1500);
      else if (active) setMessage("وصلت عملية الدفع، لكن تأكيد البنك ما زال قيد المعالجة. أعد فتح هذه الصفحة بعد لحظات.");
    };
    void verify();
    return () => { active = false; };
  }, [params.get("billing"), selectedId]);

  const selected = useMemo(
    () => projects.find((project) => project.id === selectedId),
    [projects, selectedId],
  );

  async function checkout(planId: "project" | "project_viva" | "group") {
    if (!selected) {
      setMessage("أنشئ مشروعاً أو اختره أولاً حتى نربط عملية الدفع به.");
      return;
    }
    if (selected.collaborationMode === "group" && planId !== "group") {
      setMessage("هذا مشروع مجموعة؛ اختر باقة المجموعة حتى تعمل مساحة الفريق.");
      return;
    }
    if (!configured) {
      setMessage("الكود جاهز للدفع الحقيقي. بقي أن تضيف أنت مفاتيح Stripe أو Tap أو MyFatoorah.");
      return;
    }
    setBusy(planId);
    setMessage("");
    try {
      const result = await api.createCheckout(planId, selected.id);
      window.location.assign(result.url);
    } catch (error: any) {
      setMessage(error.message || "تعذر فتح بوابة الدفع.");
      setBusy("");
    }
  }

  return <div dir="rtl" className="mx-auto max-w-6xl space-y-8">
    <header className="text-center max-w-3xl mx-auto">
      <div className="student-proof-chip"><CreditCard size={14} /> ادفع لكل مشروع فقط</div>
      <h1 className="text-3xl md:text-5xl font-black tracking-[-.05em] mt-5">اختر مشروعك، ثم افتحه بالكامل</h1>
      <p className="body-copy mt-3">لا اشتراك ولا تجديد تلقائي. كل دفعة مرتبطة بمشروع واحد وواضح قبل الانتقال للبنك.</p>
    </header>

    <section className="panel-flat rounded-[24px] p-4 md:p-5">
      <div className="grid md:grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center">
        <span className="h-12 w-12 rounded-2xl brand-soft-bg grid place-items-center"><BookOpenCheck size={20} /></span>
        <label className="min-w-0">
          <span className="eyebrow">المشروع الذي ستفتحه</span>
          {loading ? <span className="field mt-2 flex items-center gap-2"><LoaderCircle size={15} className="animate-spin" /> جاري تحميل مشاريعك…</span> : projects.length ? <select className="field mt-2" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.title} · {project.course}</option>)}</select> : <p className="text-xs muted mt-2">لا يوجد مشروع بعد. ارفع التكليف أولاً ثم ارجع للباقات.</p>}
        </label>
        {!projects.length && !loading ? <Button asChild><Link to="/app/upload">ارفع التكليف <ArrowLeft size={15} /></Link></Button> : access?.unlocked && selected ? <Button asChild><Link to={`/app/project/${selected.id}`}>افتح المشروع <ArrowLeft size={15} /></Link></Button> : null}
      </div>
      {selected && <div className="mt-3 flex flex-wrap gap-2 text-[10px]"><span className="rounded-full soft-bg px-3 py-1.5">{selected.collaborationMode === "group" ? "مشروع مجموعة" : "مشروع فردي"}</span><span className={`rounded-full px-3 py-1.5 ${access?.unlocked ? "brand-soft-bg" : "bg-amber-500/10 text-[var(--warning)]"}`}>{access?.unlocked ? `مفتوح · ${access.planId}` : "معاينة مجانية"}</span></div>}
    </section>

    {message && <div role="status" className="rounded-2xl brand-soft-bg p-4 text-sm text-center">{message}</div>}

    <div className="plan-grid">
      {fallbackPlans.map((plan) => {
        const Icon = plan.icon;
        const paid = plan.id !== "preview";
        const groupMismatch = Boolean(selected?.collaborationMode === "group" && paid && plan.id !== "group");
        return <article key={plan.id} className={`plan-card ${"popular" in plan && plan.popular ? "is-popular" : ""} ${groupMismatch ? "opacity-55" : ""}`}>
          {"popular" in plan && plan.popular && <span className="plan-card__popular">الأكثر اختياراً</span>}
          <span className="plan-card__icon"><Icon size={22} /></span>
          <h2>{plan.name}</h2>
          <div className="plan-price"><strong>{plan.amountKwd ? plan.amountKwd.toFixed(3) : "0"}</strong><span>د.ك</span></div>
          <p>{plan.description}</p>
          <ul><li><Check size={14} /> مشروع واحد بلا تجديد تلقائي</li><li><Check size={14} /> إجابة ببصمة مختلفة لكل طالب</li><li><Check size={14} /> العربية وكل اللغات</li></ul>
          <Button className="w-full mt-auto" variant={paid ? "default" : "outline"} disabled={busy === plan.id || groupMismatch || (paid && access?.unlocked && access.planId === plan.id)} onClick={() => paid ? checkout(plan.id as "project" | "project_viva" | "group") : selected ? window.location.assign(`/app/project/${selected.id}`) : window.location.assign("/app/upload")}>{busy === plan.id ? <LoaderCircle size={15} className="animate-spin" /> : access?.unlocked && access.planId === plan.id ? <Check size={15} /> : paid ? <LockKeyhole size={15} /> : <Sparkles size={15} />}{access?.unlocked && access.planId === plan.id ? "الباقة مفعلة" : groupMismatch ? "للمشاريع الفردية" : paid ? "اختر الباقة" : "ابدأ المعاينة"}</Button>
        </article>;
      })}
    </div>

    <div className="rounded-2xl border hairline p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"><span><strong>حالة الربط:</strong> {configured ? `متصل عبر ${provider}` : "جاهز وينتظر مفاتيحك السرية"}</span><span className="muted">السعر والمشروع يتحقق منهما الخادم؛ لا يمكن للمتصفح تغييرهما.</span></div>
  </div>;
}

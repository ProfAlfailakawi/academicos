import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  BookOpen,
  Check,
  ChevronLeft,
  Copy,
  GraduationCap,
  Link2,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "../lib/api";
import type { AIUsagePolicy, CourseRecord } from "../types";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

const POLICY_PRESETS: Array<{ level: 1 | 2 | 4; title: string; summary: string; allowed: string[]; prohibited: string[]; disclosureRequired: boolean }> = [
  { level: 1, title: "خطة وفهم فقط", summary: "يسمح للطالب بالفهم، توليد الأسئلة وبناء الخطة، ويكتب نص التسليم بنفسه.", allowed: ["الشرح", "العصف الذهني", "خطة المشروع"], prohibited: ["صياغة نص التسليم", "اختلاق المصادر"], disclosureRequired: false },
  { level: 2, title: "مراجعة وتحسين", summary: "يسمح بالمراجعة والشرح واقتراح التحسينات مع بقاء الصياغة النهائية للطالب.", allowed: ["مراجعة المسودة", "كشف الثغرات", "تحسين اللغة"], prohibited: ["توليد تسليم كامل", "اختلاق البيانات والمصادر"], disclosureRequired: true },
  { level: 4, title: "مسودة معلنة", summary: "يسمح بمسودة كاملة بشرط الإفصاح والتحقق من المصادر وفهم الطالب لكل جزء.", allowed: ["التخطيط", "الصياغة", "المراجعة", "تدريب المناقشة"], prohibited: ["اختلاق المصادر", "ادعاء بيانات غير موجودة", "إخفاء استخدام الذكاء الاصطناعي"], disclosureRequired: true },
];

export function ProfessorOS() {
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [linkBusy, setLinkBusy] = useState("");
  const [latestLink, setLatestLink] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ code: "", title: "", term: "", policyLevel: 2 as 1 | 2 | 4 });

  useEffect(() => {
    api.courses().then((result) => setCourses(result.courses)).catch(() => setCourses([])).finally(() => setLoading(false));
  }, []);

  const preset = useMemo(() => POLICY_PRESETS.find((item) => item.level === form.policyLevel) || POLICY_PRESETS[1], [form.policyLevel]);

  async function createStudentLink(courseId: string) {
    setLinkBusy(courseId);
    try {
      const result = await api.createJoinCode(courseId, 200, 120);
      const url = `${window.location.origin}/app/settings#join=${encodeURIComponent(result.secret)}`;
      setLatestLink(url);
      await navigator.clipboard.writeText(url).catch(() => undefined);
      setNotice("تم إنشاء رابط انضمام صالح لمدة 120 يوماً ونسخه. أرسله للطلبة.");
      return url;
    } catch (error: any) {
      setNotice(error.message || "تعذر إنشاء رابط الطلبة.");
      return "";
    } finally {
      setLinkBusy("");
    }
  }

  async function createCourse(event: React.FormEvent) {
    event.preventDefault();
    if (!form.code.trim() || !form.title.trim()) return;
    setCreating(true);
    setNotice("");
    try {
      const aiPolicy: AIUsagePolicy = {
        level: preset.level,
        summary: preset.summary,
        allowed: preset.allowed,
        prohibited: preset.prohibited,
        disclosureRequired: preset.disclosureRequired,
        needsConfirmation: false,
        provenance: "course_policy",
      };
      const result = await api.createCourse({
        code: form.code.trim(),
        title: form.title.trim(),
        term: form.term.trim() || undefined,
        outcomes: [],
        aiPolicy,
        status: "active",
      });
      setCourses((current) => [result.course, ...current]);
      const studentLink = await createStudentLink(result.course.id);
      setForm({ code: "", title: "", term: "", policyLevel: 2 });
      setShowCreate(false);
      setNotice(studentLink ? "تم إنشاء المقرر والسياسة ورابط الطلبة، ونسخ الرابط إلى الحافظة." : "تم إنشاء المقرر والسياسة. أنشئ رابط الطلبة من بطاقة المقرر.");
    } catch (error: any) {
      setNotice(error.message || "تعذر إنشاء المقرر.");
    } finally {
      setCreating(false);
    }
  }

  return <div dir="rtl" className="space-y-7 max-w-6xl mx-auto">
    <section className="teacher-lite-hero panel-flat rounded-[28px] p-6 md:p-9">
      <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-center">
        <div><div className="student-proof-chip"><GraduationCap size={14} /> Teacher Lite · اختياري وخفيف</div><h1 className="text-3xl md:text-5xl font-black tracking-[-.05em] mt-5">مقرر وسياسة ورابط — من شاشة واحدة.</h1><p className="body-copy mt-3 max-w-2xl">لا نظام جامعة ثقيل. أنشئ المقرر، اختر حدود مساعدة الذكاء الاصطناعي، ثم أرسل الرابط للطلبة خلال دقيقة.</p><Button className="mt-6" onClick={() => setShowCreate((value) => !value)}><Plus size={16} /> {showCreate ? "أغلق النموذج" : "أنشئ مقرراً"}</Button></div>
        <div className="h-24 w-24 rounded-[28px] brand-soft-bg grid place-items-center"><ShieldCheck size={38} /></div>
      </div>
    </section>

    {notice && <div role="status" className="rounded-xl brand-soft-bg p-3 text-xs">{notice}</div>}
    {latestLink && <div className="rounded-2xl border hairline p-3 flex flex-col sm:flex-row gap-2"><input className="field flex-1" dir="ltr" readOnly value={latestLink} aria-label="رابط انضمام الطلبة" /><Button variant="outline" onClick={() => navigator.clipboard.writeText(latestLink).then(() => setNotice("تم نسخ رابط الطلبة."))}><Copy size={15} /> نسخ الرابط</Button></div>}

    {showCreate && <Card><CardContent><form onSubmit={createCourse} className="space-y-5"><div><div className="eyebrow">إعداد سريع</div><h2 className="section-title mt-1">مقرر جديد</h2></div><div className="grid md:grid-cols-3 gap-3"><label><span className="text-xs font-semibold">رمز المقرر</span><input className="field mt-2" required maxLength={50} value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder="BUS 342" /></label><label className="md:col-span-2"><span className="text-xs font-semibold">اسم المقرر</span><input className="field mt-2" required maxLength={220} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="إدارة المشاريع" /></label><label><span className="text-xs font-semibold">الفصل الدراسي</span><input className="field mt-2" maxLength={100} value={form.term} onChange={(event) => setForm((current) => ({ ...current, term: event.target.value }))} placeholder="خريف 2026" /></label></div><fieldset><legend className="text-xs font-semibold">ما المسموح للطالب؟</legend><div className="grid md:grid-cols-3 gap-3 mt-3">{POLICY_PRESETS.map((item) => <button key={item.level} type="button" onClick={() => setForm((current) => ({ ...current, policyLevel: item.level }))} className={`focus-ring text-start rounded-2xl border p-4 ${form.policyLevel === item.level ? "brand-soft-bg border-[var(--brand)]" : "hairline"}`}><span className="h-9 w-9 rounded-xl bg-[var(--panel)] grid place-items-center"><ShieldCheck size={16} /></span><strong className="block text-sm mt-3">L{item.level} · {item.title}</strong><span className="block text-[11px] leading-5 muted mt-2">{item.summary}</span></button>)}</div></fieldset><div className="rounded-2xl soft-bg p-4"><div className="flex items-center gap-2"><Sparkles size={15} className="brand-text" /><strong className="text-xs">السياسة التي ستظهر للطالب</strong></div><p className="text-xs leading-6 mt-2">{preset.summary}</p><div className="flex flex-wrap gap-2 mt-3">{preset.allowed.map((item) => <span key={item} className="rounded-full bg-[var(--panel)] px-3 py-1 text-[10px] inline-flex items-center gap-1"><Check size={11} /> {item}</span>)}</div></div><div className="flex justify-end"><Button type="submit" disabled={creating || !form.code.trim() || !form.title.trim()}>{creating ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />} أنشئ واحفظ السياسة</Button></div></form></CardContent></Card>}

    <div className="grid md:grid-cols-3 gap-4">
      <LiteCard icon={ShieldCheck} title="سياسة واضحة" text="ثلاثة اختيارات مفهومة بدل صفحة إعدادات معقدة، والسياسة تظهر للطالب داخل مشروعه." />
      <LiteCard icon={Link2} title="رابط للطلبة" text="انسخ رابط المقرر فوراً؛ الطالب يصل للتكليف من دون إجراءات الجامعة." />
      <LiteCard icon={GraduationCap} title="إثبات فهم اختياري" text="المناقشة تبقى بيد الطالب، ولا توجد مراقبة خفية أو بيع لبياناته." />
    </div>

    <Card><CardContent><div className="flex items-center justify-between gap-3"><div><div className="eyebrow">مقرراتك</div><h2 className="section-title mt-1">السياسة والرابط جاهزان</h2></div><span className="text-[10px] muted">Teacher Lite فقط</span></div>{loading ? <div className="py-14 grid place-items-center"><LoaderCircle className="animate-spin brand-text" /></div> : courses.length ? <div className="grid md:grid-cols-2 gap-3 mt-5">{courses.map((course) => <div key={course.id} className="rounded-2xl border hairline p-4 flex items-center gap-3"><span className="h-11 w-11 rounded-2xl brand-soft-bg grid place-items-center"><BookOpen size={18} /></span><div className="min-w-0 flex-1"><strong className="block text-sm truncate">{course.code} · {course.title}</strong><span className="text-[10px] muted">L{course.aiPolicy.level} · {course.term || "فصل غير محدد"}</span></div><button onClick={() => createStudentLink(course.id)} disabled={linkBusy === course.id} className="focus-ring rounded-xl soft-bg h-11 w-11 grid place-items-center disabled:opacity-50" aria-label="إنشاء ونسخ رابط الطلبة">{linkBusy === course.id ? <LoaderCircle size={15} className="animate-spin" /> : <Copy size={15} />}</button><Button asChild size="sm" variant="ghost"><Link to={`/app/course/${course.id}`}><ChevronLeft size={16} /></Link></Button></div>)}</div> : <div className="rounded-2xl border border-dashed hairline p-10 text-center mt-5"><GraduationCap size={26} className="mx-auto brand-text" /><strong className="block mt-3">أنشئ أول مقرر خلال دقيقة</strong><p className="text-xs muted mt-2">اختر السياسة وانسخ الرابط؛ هذا كل ما تحتاجه للبدء.</p><Button className="mt-4" onClick={() => setShowCreate(true)}><Plus size={15} /> أنشئ مقرراً</Button></div>}</CardContent></Card>
  </div>;
}

function LiteCard({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return <Card><CardContent><span className="h-12 w-12 rounded-2xl brand-soft-bg grid place-items-center"><Icon size={20} /></span><h2 className="text-base font-bold mt-5">{title}</h2><p className="text-xs leading-6 muted mt-2">{text}</p></CardContent></Card>;
}

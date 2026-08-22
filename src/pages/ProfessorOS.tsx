import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import { BookOpen, ChevronLeft, Copy, GraduationCap, Link2, LoaderCircle, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import type { CourseRecord } from "../types";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

export function ProfessorOS() {
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  useEffect(() => { api.courses().then((result) => setCourses(result.courses)).catch(() => setCourses([])).finally(() => setLoading(false)); }, []);
  async function copy(text: string) { await navigator.clipboard.writeText(text); setNotice("تم نسخ الرابط."); }

  return <div dir="rtl" className="space-y-7 max-w-6xl mx-auto">
    <section className="teacher-lite-hero panel-flat rounded-[28px] p-6 md:p-9">
      <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-center">
        <div><div className="student-proof-chip"><GraduationCap size={14} /> Teacher Lite · مؤجل وخفيف</div><h1 className="text-3xl md:text-5xl font-black tracking-[-.05em] mt-5">أدوات المعلم الضرورية فقط.</h1><p className="body-copy mt-3 max-w-2xl">حدد سياسة الذكاء الاصطناعي، شارك رابط التكليف، واطلب من الطالب إثبات فهمه إذا أراد. لا مراقبة خفية ولا نظام جامعة ثقيل.</p></div>
        <div className="h-24 w-24 rounded-[28px] brand-soft-bg grid place-items-center"><ShieldCheck size={38} /></div>
      </div>
    </section>
    {notice && <div className="rounded-xl brand-soft-bg p-3 text-xs">{notice}</div>}
    <div className="grid md:grid-cols-3 gap-4">
      <LiteCard icon={ShieldCheck} title="سياسة واضحة" text="اختر مستوى المساعدة المسموح لكل تكليف: خطة فقط، مراجعة، أو مسودة معلنة." />
      <LiteCard icon={Link2} title="رابط للطلبة" text="أرسل رابط التكليف؛ الطالب يدخل مباشرة إلى مشروعه من دون خطوات إدارية." />
      <LiteCard icon={GraduationCap} title="إثبات فهم اختياري" text="رابط مناقشة يشاركه الطالب بإرادته ويعرض الإجابات التي اختار نشرها فقط." />
    </div>
    <Card>
      <CardContent>
        <div className="flex items-center justify-between gap-3"><div><div className="eyebrow">مقرراتك الحالية</div><h2 className="section-title mt-1">افتح المقرر وحدد السياسة</h2></div><span className="text-[10px] muted">لا توجد خصومات أو عمولات للمعلم</span></div>
        {loading ? <div className="py-14 grid place-items-center"><LoaderCircle className="animate-spin brand-text" /></div> : courses.length ? <div className="grid md:grid-cols-2 gap-3 mt-5">{courses.map((course) => <div key={course.id} className="rounded-2xl border hairline p-4 flex items-center gap-3"><span className="h-11 w-11 rounded-2xl brand-soft-bg grid place-items-center"><BookOpen size={18} /></span><div className="min-w-0 flex-1"><strong className="block text-sm truncate">{course.code} · {course.title}</strong><span className="text-[10px] muted">سياسة AI: L{course.aiPolicy.level}</span></div><button onClick={() => copy(`${window.location.origin}/app/course/${course.id}`)} className="focus-ring rounded-xl soft-bg h-10 w-10 grid place-items-center" aria-label="نسخ رابط المقرر"><Copy size={15} /></button><Button asChild size="sm" variant="ghost"><Link to={`/app/course/${course.id}`}><ChevronLeft size={16} /></Link></Button></div>)}</div> : <div className="rounded-2xl border border-dashed hairline p-10 text-center mt-5"><GraduationCap size={26} className="mx-auto brand-text" /><strong className="block mt-3">Teacher Lite جاهز للمرحلة الثانية</strong><p className="text-xs muted mt-2">نركّز الآن على تجربة الطالب، ونفعّل إنشاء المقررات عندما تحتاجه.</p></div>}
      </CardContent>
    </Card>
  </div>;
}

function LiteCard({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) { return <Card><CardContent><span className="h-12 w-12 rounded-2xl brand-soft-bg grid place-items-center"><Icon size={20} /></span><h2 className="text-base font-bold mt-5">{title}</h2><p className="text-xs leading-6 muted mt-2">{text}</p></CardContent></Card>; }

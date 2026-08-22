import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  FileHeart,
  FilePenLine,
  FolderOpen,
  GraduationCap,
  Mic2,
  ScanSearch,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { api } from "../lib/api";
import type { ProjectDNA } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

const journeys = [
  {
    to: "/app/upload?mode=write",
    icon: FilePenLine,
    number: "01",
    title: "اكتب مشروعي",
    detail: "ارفع التكليف؛ نبني المشروع، نشرح أقسامه، ونجهزك للمناقشة.",
    action: "ابدأ مشروعاً",
    tone: "brand",
  },
  {
    to: "/app/upload?mode=rescue",
    icon: FileHeart,
    number: "02",
    title: "أنقذ مشروعي",
    detail: "ارفع مشروع GPT أو مسودة جاهزة؛ نكشف الخلل ونصلحه ونفهمك محتواه.",
    action: "افحص مسودة",
    tone: "sand",
  },
  {
    to: "/app/learn",
    icon: GraduationCap,
    number: "03",
    title: "درّبني للاختبار",
    detail: "اختبارات سابقة، حل خطوة بخطوة، وتدريب مخصص على أخطائك.",
    action: "ابدأ التدريب",
    tone: "blue",
  },
] as const;

export function MissionControl() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectDNA[]>([]);
  useEffect(() => {
    api
      .projects()
      .then((response) => setProjects(response.projects))
      .catch(() => setProjects([]));
  }, []);
  const latest = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3),
    [projects],
  );
  const firstName = user?.displayName?.split(" ")[0] || "طالبنا";

  return (
    <div className="student-home space-y-6 md:space-y-8">
      <section className="student-hero panel-flat rounded-[30px] overflow-hidden">
        <div className="grid lg:grid-cols-[.95fr_1.05fr] items-center">
          <div className="p-6 md:p-9 lg:p-11 order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 rounded-full brand-soft-bg px-3 py-1.5 text-[11px] font-semibold">
              <Sparkles size={14} /> مشروع + فهم + مناقشة
            </div>
            <h1 className="text-3xl md:text-5xl font-semibold tracking-[-.05em] leading-[1.12] mt-5">
              هلا {firstName}،<br />شنو تبي تنجز اليوم؟
            </h1>
            <p className="body-copy mt-4 max-w-xl">
              اختر خطوة واحدة فقط. AcademicOS يرتب الباقي ويظل معاك من ملف التكليف إلى آخر سؤال من الدكتور.
            </p>
            <div className="flex flex-wrap gap-2 mt-6 text-[11px]">
              <span className="student-proof-chip"><CheckCircle2 size={13} /> مصادر متحققة</span>
              <span className="student-proof-chip"><CheckCircle2 size={13} /> صياغة مختلفة لكل طالب</span>
              <span className="student-proof-chip"><CheckCircle2 size={13} /> عربي وإنجليزي</span>
            </div>
          </div>
          <div className="relative min-h-[280px] lg:min-h-[430px] order-1 lg:order-2 overflow-hidden bg-[#f6efe4]">
            <img
              src="/assets/academicos-project-journey.png"
              alt="رحلة التكليف إلى مشروع موثق ثم مناقشة شفوية"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="student-journeys-title">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <div className="eyebrow">ابدأ من حاجتك</div>
            <h2 id="student-journeys-title" className="section-title mt-1">ثلاث خطوات واضحة، بدون قوائم معقدة</h2>
          </div>
          <span className="hidden sm:inline-flex items-center gap-2 text-[11px] muted">
            <WandSparkles size={15} /> نوجهك تلقائياً
          </span>
        </div>
        <div className="grid lg:grid-cols-3 gap-4">
          {journeys.map((journey) => {
            const Icon = journey.icon;
            return (
              <Link key={journey.to} to={journey.to} className="journey-card focus-ring group rounded-[24px]">
                <Card className={`h-full journey-card--${journey.tone}`}>
                  <CardContent className="p-5 md:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <span className="journey-icon h-16 w-16 rounded-[20px] grid place-items-center">
                        <Icon size={28} />
                      </span>
                      <span className="text-3xl font-semibold tracking-[-.06em] opacity-25 mono-number">{journey.number}</span>
                    </div>
                    <h3 className="text-xl font-semibold mt-7">{journey.title}</h3>
                    <p className="body-copy mt-2 min-h-14">{journey.detail}</p>
                    <div className="mt-6 flex items-center gap-2 text-sm font-semibold brand-text">
                      {journey.action}<ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid xl:grid-cols-[1.15fr_.85fr] gap-5 items-start">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="h-11 w-11 rounded-2xl brand-soft-bg grid place-items-center"><FolderOpen size={19} /></span>
                <div><div className="eyebrow">مشاريعك</div><h2 className="section-title mt-1">كمل من مكانك</h2></div>
              </div>
              <Button asChild variant="ghost" size="sm"><Link to="/app/projects">الكل <ArrowLeft size={14} /></Link></Button>
            </div>
            <div className="mt-5 space-y-2">
              {latest.map((project) => (
                <Link key={project.id} to={`/app/project/${project.id}`} className="project-quick-row focus-ring rounded-2xl flex items-center gap-3 p-3 border hairline">
                  <span className="h-10 w-10 rounded-xl soft-bg grid place-items-center"><BookOpenCheck size={17} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold truncate">{project.title}</span><span className="block text-[10px] muted mt-1">{project.course} · {project.progress}%</span></span>
                  <ArrowLeft size={16} className="muted" />
                </Link>
              ))}
              {!latest.length && (
                <div className="rounded-2xl border border-dashed hairline p-8 text-center">
                  <ScanSearch size={24} className="mx-auto brand-text" />
                  <div className="font-semibold mt-3">ما عندك مشروع للحين</div>
                  <p className="text-xs muted mt-1">أول تحليل للتكليف مجاني.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="understanding-card overflow-hidden">
          <CardContent>
            <div className="flex items-center gap-3">
              <span className="h-11 w-11 rounded-2xl bg-white/70 text-[var(--brand-2)] grid place-items-center"><Mic2 size={19} /></span>
              <div><div className="eyebrow">AcademicOS Promise</div><h2 className="section-title mt-1">مو بس نسلمك ملف</h2></div>
            </div>
            <div className="understanding-flow mt-6" aria-label="رحلة المشروع والفهم">
              {["نبني", "نوثّق", "نشرح", "نناقش"].map((label, index) => (
                <div key={label} className="understanding-step">
                  <span>{index + 1}</span><strong>{label}</strong>
                </div>
              ))}
            </div>
            <p className="text-xs leading-6 mt-5 text-[var(--brand-2)]">
              الناتج النهائي: مشروع قابل للتعديل + خريطة مصادر + ملخص فهم + أسئلة مناقشة من داخل مشروعك.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

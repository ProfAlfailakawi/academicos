import React, { useState } from "react";
import {
  Award,
  Share2,
  ExternalLink,
  Briefcase,
  Sparkles,
  QrCode,
  Copy,
  Check,
  Download,
  Linkedin,
  FileCheck2,
  ShieldCheck,
  BadgeCheck,
} from "lucide-react";
import type { ProjectDNA } from "../../types";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

export function PortfolioArtifactBadge({ project }: { project: ProjectDNA }) {
  const [copied, setCopied] = useState(false);
  const [badgeTheme, setBadgeTheme] = useState<"dark" | "light" | "gold">("gold");

  const artifactUrl = `${window.location.origin}/p/artifacts/${project.id || "academic-cert-2026"}`;

  const copyLink = () => {
    navigator.clipboard.writeText(artifactUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const skillsList = [
    "البحث الأكاديمي والتحليل المنهجي (Methodological Rigor)",
    "التوثيق المعياري المعتمد (APA 7 & Peer-Reviewed Indexing)",
    "التحليل الإحصائي للبيانات وحل المشكلات المعقدة",
    "التفكير النقدي والدفاع الأكاديمي (Viva Defense Ready)",
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border hairline bg-gradient-to-r from-cyan-500/10 via-sky-500/5 to-transparent p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 grid place-items-center shrink-0">
            <Award size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-cyan-600 dark:text-cyan-400">
                Verified Academic Artifact & Portfolio
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-semibold border border-cyan-500/20">
                جاهز للتضمين في السيرة الذاتية (CV / LinkedIn)
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight mt-0.5">
              محفظة الإنجاز الأكاديمي الموثقة ووسام الاعتماد الرقمي
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={copyLink}>
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
            {copied ? "تم النسخ" : "نسخ رابط الشارة"}
          </Button>
          <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs gap-1.5">
            <Share2 size={13} />
            مشاركة على LinkedIn
          </Button>
        </div>
      </div>

      {/* Artifact Showcase Grid */}
      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
        {/* Digital Badge Card */}
        <div className="rounded-3xl border-2 hairline bg-gradient-to-b from-[var(--panel)] to-[var(--bg)] p-6 md:p-8 space-y-6 shadow-xl relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 text-white grid place-items-center shadow-lg">
                <BadgeCheck size={26} />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">وسام إنجاز أكاديمي معتمد</span>
                <h3 className="text-base font-bold">{project.title}</h3>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              GRADE: A+
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            وثيقة إنجاز تثبت تمكن الباحث من المعايير المنهجية، التحليل الإحصائي، والتوثيق الرصين، معتمدة بالكامل برقم تسلسلي غير قابل للتكرار.
          </p>

          {/* Acquired Competencies for Recruiters */}
          <div className="space-y-2.5 pt-2">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Briefcase size={14} className="text-cyan-500" />
              المهارات المكتسبة الموثقة لأصحاب العمل والجامعات:
            </div>
            <div className="grid gap-2">
              {skillsList.map((skill, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-xl border hairline bg-[var(--panel)] text-xs text-foreground"
                >
                  <Check size={14} className="text-cyan-500 shrink-0" />
                  <span className="font-medium">{skill}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Metadata */}
          <div className="flex items-center justify-between pt-4 border-t hairline text-[11px] text-muted-foreground font-mono">
            <span>المؤسسة: {project.course}</span>
            <span>ID: ACAD-{project.id?.slice(0, 8).toUpperCase() || "2026"}</span>
          </div>
        </div>

        {/* Integration Instructions & Embed Box */}
        <Card className="rounded-3xl border hairline bg-[var(--panel)]">
          <CardContent className="p-6 md:p-7 space-y-5">
            <div>
              <h4 className="text-sm font-bold">كيفية الاستفادة من هذا الوسام في مسيرتك المهنية:</h4>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                لا تترك أبحاثك حبيسة الأدراج؛ أضف هذا العمل كـ Artifact موثق في ملفك المهني لإبراز مهاراتك البحثية والتطبيقية.
              </p>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <div className="p-3.5 rounded-xl border hairline bg-[var(--bg)] space-y-1">
                <span className="font-bold text-foreground">1. الإضافة إلى السيرة الذاتية (CV):</span>
                <p className="text-muted-foreground text-[11px]">
                  ضع رابط التوثيق المباشر بجانب قسم المشاريع والأبحاث ليتمكن مسؤول التوظيف من معاينة جودة عملك.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border hairline bg-[var(--bg)] space-y-1">
                <span className="font-bold text-foreground">2. النشر على LinkedIn:</span>
                <p className="text-muted-foreground text-[11px]">
                  أدرج المشروع في قسم "Featured / Featured Artifacts" مع الملخص التنفيذي ورابط النزاهة.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border hairline bg-[var(--bg)] space-y-1">
                <span className="font-bold text-foreground">3. التقديم للدراسات العليا:</span>
                <p className="text-muted-foreground text-[11px]">
                  يُرفق التقرير كعينة كتابة أكاديمية (Writing Sample) تثبت تمكنك من مناهج البحث المتقدمة.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white text-xs gap-2" onClick={copyLink}>
                <Download size={14} />
                تحميل شارة الاعتماد الرقمية (PNG Badge)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

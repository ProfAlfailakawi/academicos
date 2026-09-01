import React, { useState } from "react";
import {
  ListChecks,
  CheckCircle2,
  AlertCircle,
  FileSearch,
  Sparkles,
  Layers,
  ArrowRight,
  TrendingUp,
  SlidersHorizontal,
} from "lucide-react";
import type { ProjectDNA } from "../../types";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

interface DecomposedRequirement {
  id: string;
  category: "formatting" | "methodology" | "sources" | "rubric_target";
  title: string;
  exactSpecification: string;
  complianceLevel: "fulfilled" | "partial" | "missing";
  detectedConfidence: number;
  mappedSection: string;
}

export function RequirementMatrixStudio({ project }: { project: ProjectDNA }) {
  const [filter, setFilter] = useState<string>("all");

  const [specs, setSpecs] = useState<DecomposedRequirement[]>([
    {
      id: "req-1",
      category: "formatting",
      title: "التنسيق الأكاديمي والخطوط (APA 7)",
      exactSpecification: "حجم الخط 12، تباعد الأسطر 1.5، وهوامش 2.54 سم من كافة الجهات مع ترقيم الصفحات أعلى اليسار.",
      complianceLevel: "fulfilled",
      detectedConfidence: 99,
      mappedSection: "General Formatting",
    },
    {
      id: "req-2",
      category: "sources",
      title: "الحد الأدنى لعدد المراجع وفترة النشر",
      exactSpecification: "لا يقل عن 8 أبحاث محكمة ومنشورة بعد عام 2020 ذات صلة مباشرة بعنوان التكليف.",
      complianceLevel: "fulfilled",
      detectedConfidence: 95,
      mappedSection: "References & Bibliography",
    },
    {
      id: "req-3",
      category: "methodology",
      title: "توضيح إجراءات الصدق والثبات (Validity & Reliability)",
      exactSpecification: "ذكر أدوات جمع البيانات، حجم العينة الدقيق، ومعامل ألفا كرونباخ أو خطوات التثليث المنهجي.",
      complianceLevel: "fulfilled",
      detectedConfidence: 92,
      mappedSection: "Chapter 3: Methodology",
    },
    {
      id: "req-4",
      category: "rubric_target",
      title: "توصيات قابلة للتطبيق العملي (Practical Implications)",
      exactSpecification: "تقديم 3 توصيات موجهة لصناع القرار مبنية رقمياً على نتائج الفصل الرابع.",
      complianceLevel: "partial",
      detectedConfidence: 80,
      mappedSection: "Conclusion & Recommendations",
    },
  ]);

  const fulfilledCount = specs.filter((s) => s.complianceLevel === "fulfilled").length;
  const overallPercentage = Math.round((fulfilledCount / specs.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border hairline bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-transparent p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-violet-500/20 text-violet-600 dark:text-violet-400 grid place-items-center shrink-0">
            <ListChecks size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-violet-600 dark:text-violet-400">
                Reverse Engineering Matrix
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-violet-500/15 text-violet-700 dark:text-violet-300 font-semibold border border-violet-500/20">
                تفكيك شروط التكليف الصريحة والضمنية
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight mt-0.5">
              مصفوفة تفكيك ومطابقة متطلبات التكليف (100% Rubric Match)
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-[var(--panel)] p-3 rounded-xl border hairline">
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground font-semibold">نسبة استيفاء شروط التكليف</div>
            <div className="text-lg font-bold font-mono text-violet-600 dark:text-violet-400">
              {overallPercentage}% مكتمل
            </div>
          </div>
          <div className="h-9 w-9 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 grid place-items-center font-mono font-bold text-xs">
            {fulfilledCount}/{specs.length}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 text-xs flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-xl border hairline transition-colors ${filter === "all" ? "bg-violet-600 text-white border-violet-600 font-semibold" : "bg-[var(--panel)] text-muted-foreground"}`}
        >
          كل الشروط ({specs.length})
        </button>
        <button
          onClick={() => setFilter("formatting")}
          className={`px-3 py-1.5 rounded-xl border hairline transition-colors ${filter === "formatting" ? "bg-violet-600 text-white border-violet-600 font-semibold" : "bg-[var(--panel)] text-muted-foreground"}`}
        >
          الشروط الشكلية والتنسيق
        </button>
        <button
          onClick={() => setFilter("methodology")}
          className={`px-3 py-1.5 rounded-xl border hairline transition-colors ${filter === "methodology" ? "bg-violet-600 text-white border-violet-600 font-semibold" : "bg-[var(--panel)] text-muted-foreground"}`}
        >
          الشروط المنهجية
        </button>
        <button
          onClick={() => setFilter("sources")}
          className={`px-3 py-1.5 rounded-xl border hairline transition-colors ${filter === "sources" ? "bg-violet-600 text-white border-violet-600 font-semibold" : "bg-[var(--panel)] text-muted-foreground"}`}
        >
          شروط المراجع والتوثيق
        </button>
      </div>

      {/* Specification Checklist Cards */}
      <div className="space-y-3.5">
        {specs
          .filter((s) => filter === "all" || s.category === filter)
          .map((spec) => (
            <div
              key={spec.id}
              className="rounded-2xl border hairline bg-[var(--panel)] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-violet-500/40 transition-colors"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="h-6 w-6 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 grid place-items-center text-xs font-bold shrink-0">
                    <CheckCircle2 size={15} />
                  </span>
                  <h3 className="text-sm font-bold text-foreground">{spec.title}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-muted text-muted-foreground">
                    {spec.mappedSection}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pr-8">
                  {spec.exactSpecification}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                <div className="text-right font-mono text-[11px]">
                  <div className="text-[10px] text-muted-foreground">دقة الكشف</div>
                  <span className="font-bold text-violet-600 dark:text-violet-400">
                    {spec.detectedConfidence}%
                  </span>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${
                    spec.complianceLevel === "fulfilled"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  }`}
                >
                  {spec.complianceLevel === "fulfilled" ? (
                    <>
                      <CheckCircle2 size={13} />
                      مستوفى بالكامل
                    </>
                  ) : (
                    <>
                      <AlertCircle size={13} />
                      مستوفى جزئياً
                    </>
                  )}
                </span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

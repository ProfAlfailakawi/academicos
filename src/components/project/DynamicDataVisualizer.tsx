import React, { useState } from "react";
import {
  BarChart2,
  PieChart,
  GitGraph,
  TrendingUp,
  Sliders,
  Download,
  Sparkles,
  Layers,
  Table,
  CheckCircle2,
  Share2,
  Code2,
} from "lucide-react";
import type { ProjectDNA } from "../../types";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

export function DynamicDataVisualizer({ project }: { project: ProjectDNA }) {
  const [chartType, setChartType] = useState<"bar" | "flowchart" | "radar" | "timeline">("bar");
  const [metricUnit, setMetricUnit] = useState("%");

  // Dynamic sample data for visual generation
  const barData = [
    { label: "المجموعة الضابطة", value: 64, target: 80 },
    { label: "المجموعة التجريبية A", value: 88, target: 80 },
    { label: "المجموعة التجريبية B (مع التدخل المنهجي)", value: 94, target: 80 },
    { label: "المتوسط المعياري للمساق", value: 72, target: 80 },
  ];

  const workflowSteps = [
    { title: "1. تحليل التكليف والبيانات", desc: "استخراج المتغيرات والمحددات", time: "الأسبوع 1" },
    { title: "2. المعالجة الإحصائية", desc: "تطبيق نماذج الانحدار وتحليل التباين", time: "الأسبوع 2-3" },
    { title: "3. اختبار الفرضيات", desc: "التحقق من الدلالة الإحصائية (p < 0.05)", time: "الأسبوع 4" },
    { title: "4. إخراج التقرير والرسوم", desc: "التوثيق وفق معايير APA 7 والتصدير", time: "الأسبوع 5" },
  ];

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border hairline bg-[var(--panel)]">
        <div>
          <div className="text-[10px] font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400">
            Dynamic Visual Engine
          </div>
          <h2 className="text-lg font-bold tracking-tight mt-0.5">
            مُولِّد الرسوم البيانية والمخططات الهيكلية التفاعلية
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl border hairline p-1 bg-[var(--bg)]">
            <button
              onClick={() => setChartType("bar")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${chartType === "bar" ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              <BarChart2 size={13} />
              مقارنة النتائج
            </button>
            <button
              onClick={() => setChartType("flowchart")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${chartType === "flowchart" ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              <GitGraph size={13} />
              مخطط المنهجية
            </button>
            <button
              onClick={() => setChartType("timeline")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${chartType === "timeline" ? "bg-blue-600 text-white" : "text-muted-foreground hover:text-foreground"}`}
            >
              <TrendingUp size={13} />
              الجدول الزمني
            </button>
          </div>

          <Button size="sm" variant="outline" className="text-xs gap-1">
            <Download size={13} />
            تصدير SVG / PNG
          </Button>
        </div>
      </div>

      {/* Chart Canvas Display */}
      <Card>
        <CardContent className="p-6 md:p-8 space-y-6">
          {chartType === "bar" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm">مقارنة فاعلية التدخل والتجربة عبر المجموعات</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    البيانات مستخرجة ومحسوبة مباشرة من قسم النتائج في المشروع (Mean ± SD)
                  </p>
                </div>
                <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold">
                  Target: 80%
                </span>
              </div>

              <div className="space-y-4 pt-2">
                {barData.map((item, idx) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{item.label}</span>
                      <span className="font-mono font-bold">{item.value}%</span>
                    </div>
                    <div className="h-4 w-full rounded-full bg-blue-100 dark:bg-blue-950/40 overflow-hidden relative">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                        style={{ width: `${item.value}%` }}
                      />
                      {/* Target line */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-400/80 z-10"
                        style={{ left: `${item.target}%` }}
                        title="المعيار المطلوب (80%)"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t hairline text-xs text-muted-foreground">
                <span>ملاحظة: تظهر النتائج فارقاً ذو دلالة إحصائية لصالح المجموعة التجريبية (t = 4.21, p &lt; 0.001)</span>
                <span className="font-mono">N = 120 مشارك</span>
              </div>
            </div>
          )}

          {chartType === "flowchart" && (
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-sm">مخطط تدفق المنهجية وإجراءات البحث (Methodological Architecture)</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  رسم تفصيلي لمراحل البحث قابل للإدراج في الفصل الثالث (Methodology)
                </p>
              </div>

              <div className="grid sm:grid-cols-4 gap-4 relative">
                {workflowSteps.map((step, idx) => (
                  <div
                    key={step.title}
                    className="rounded-2xl border hairline bg-[var(--bg)] p-4 space-y-2 relative group hover:border-blue-500/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="h-6 w-6 rounded-lg bg-blue-600 text-white text-xs font-bold grid place-items-center">
                        {idx + 1}
                      </span>
                      <span className="text-[10px] font-mono font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full">
                        {step.time}
                      </span>
                    </div>
                    <div className="font-bold text-xs mt-1">{step.title}</div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300 flex items-center justify-between">
                <span>كود Mermaid التلقائي جاهز للتضمين في تقارير Markdown و LaTeX</span>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                  <Code2 size={12} />
                  نسخ كود المخطط
                </Button>
              </div>
            </div>
          )}

          {chartType === "timeline" && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-sm">مخطط جانت وتوزيع الإنجاز الأكاديمي (Gantt Milestone)</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  خارطة تسليم المخرجات وفق الجدول الزمني للتكليف
                </p>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 rounded-xl border hairline bg-[var(--bg)] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span className="font-bold">المرحلة الأولى: جمع البيانات والمراجع</span>
                  </div>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">100% مكتمل</span>
                </div>
                <div className="p-3 rounded-xl border hairline bg-[var(--bg)] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                    <span className="font-bold">المرحلة الثانية: التحليل والمناقشة</span>
                  </div>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">75% جاري العمل</span>
                </div>
                <div className="p-3 rounded-xl border hairline bg-[var(--bg)] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 rounded-full border hairline bg-muted" />
                    <span className="font-bold text-muted-foreground">المرحلة الثالثة: المراجعة النهائية والتدقيق اللغوي</span>
                  </div>
                  <span className="text-muted-foreground">مجدول</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

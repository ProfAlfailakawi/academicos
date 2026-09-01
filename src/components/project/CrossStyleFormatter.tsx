import React, { useState } from "react";
import {
  FileCode,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  ArrowRightLeft,
  BookMarked,
  Layers,
  Settings2,
  RefreshCw,
} from "lucide-react";
import type { ProjectDNA } from "../../types";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

type AcademicStyle = "apa7" | "harvard" | "ieee" | "mla9" | "chicago";

interface StyleDefinition {
  id: AcademicStyle;
  name: string;
  discipline: string;
  inTextExample: string;
  referenceExample: string;
  characteristics: string[];
}

export function CrossStyleFormatter({ project }: { project: ProjectDNA }) {
  const [selectedStyle, setSelectedStyle] = useState<AcademicStyle>("apa7");
  const [copied, setCopied] = useState(false);
  const [formatting, setFormatting] = useState(false);

  const styles: Record<AcademicStyle, StyleDefinition> = {
    apa7: {
      id: "apa7",
      name: "APA 7th Edition",
      discipline: "العلوم الاجتماعية، التربية، علم النفس، الإدارة",
      inTextExample: "(الفيلكاوي وآخرون، 2024، ص. 45) / (Al-Failakawi et al., 2024)",
      referenceExample:
        "الفيلكاوي، أ.، ومحمود، س. (2024). تطبيقات الذكاء الاصطناعي في التعليم العالي. مجلة دراسات الخليج، 48(2)، 112-135. https://doi.org/10.1016/j.compedu.2023.104820",
      characteristics: ["ترتيب المراجع هجائياً", "استخدام المسافة البادئة المعلقة (Hanging Indent)", "ذكر الاسم الأخير وسنة النشر داخل المتن"],
    },
    harvard: {
      id: "harvard",
      name: "Harvard Referencing",
      discipline: "العلوم الإنسانية، الاقتصاد، وإدارة الأعمال البريطانية والأسترالية",
      inTextExample: "(Al-Failakawi & Mahmoud 2024: 45)",
      referenceExample:
        "Al-Failakawi, A. and Mahmoud, S. 2024. 'Generative AI in Higher Education', Journal of Higher Education Studies, vol. 48, no. 2, pp. 112-135.",
      characteristics: ["عدم استخدام فاصلة بين اسم المؤلف وسنة النشر داخل المتن", "عناوين المقالات بين علامتي تنصيص مفردتين", "ذكر رقم الصفحة بنقطتين رأسيتين"],
    },
    ieee: {
      id: "ieee",
      name: "IEEE Citation Style",
      discipline: "الهندسة، علوم الحاسب، ونظم المعلومات والتقنية",
      inTextExample: "[1] / كما أوضح الباحثون في [1]-[3]...",
      referenceExample:
        "[1] A. Al-Failakawi and S. Mahmoud, 'Generative AI in Higher Education,' IEEE Trans. Learn. Technol., vol. 17, no. 2, pp. 112-135, 2024, doi: 10.1016/j.compedu.2023.104820.",
      characteristics: ["نظام الأرقام المتسلسلة بين قوسين معقوفين [1]", "ترتيب المراجع حسب ظهورها في البحث وليس هجائياً", "اختصار أسماء المجلات المعتمدة"],
    },
    mla9: {
      id: "mla9",
      name: "MLA 9th Edition",
      discipline: "اللغات، الأدب، الفنون، والعلوم الثقافية",
      inTextExample: "(الفيلكاوي 45) / (Al-Failakawi 45)",
      referenceExample:
        "الفيلكاوي، أحمد، وسامي محمود. 'تطبيقات الذكاء الاصطناعي في التعليم العالي'. مجلة دراسات الخليج، المجلد 48، العدد 2، 2024، ص 112-135.",
      characteristics: ["ذكر اسم المؤلف ورقم الصفحة فقط بدون سنة النشر", "كتابة الاسم الأول كاملاً في قائمة المراجع (Works Cited)", "تنسيق مخصص للحاويات والمجلدات"],
    },
    chicago: {
      id: "chicago",
      name: "Chicago (Notes & Bibliography)",
      discipline: "التاريخ، العلوم السياسية، والدراسات الإنسانية المعمقة",
      inTextExample: "تظهر البيانات أهمية التدخل الأكاديمي.¹ (هوامش سفلية Footnotes)",
      referenceExample:
        "1. أحمد الفيلكاوي وسامي محمود، 'تطبيقات الذكاء الاصطناعي في التعليم العالي'، مجلة دراسات الخليج 48، رقم 2 (2024): 115.",
      characteristics: ["نظام الحواشي السفلية المرقمة في أسفل كل صفحة", "مرونة عالية في التوثيق الأرشيفي والوثائق التاريخية", "قائمة مراجع نهائية شاملة"],
    },
  };

  const current = styles[selectedStyle];

  const handleConvert = () => {
    setFormatting(true);
    setTimeout(() => {
      setFormatting(false);
    }, 500);
  };

  const copyRef = () => {
    navigator.clipboard.writeText(current.referenceExample);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border hairline bg-gradient-to-r from-fuchsia-500/10 via-pink-500/5 to-transparent p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400 grid place-items-center shrink-0">
            <ArrowRightLeft size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-fuchsia-600 dark:text-fuchsia-400">
                Cross-Style One-Click Engine
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 font-semibold border border-fuchsia-500/20">
                تحويل شامل وفوري للأنماط
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight mt-0.5">
              مُحوِّل أنظمة التوثيق والتنسيق الأكاديمي الفوري
            </h2>
          </div>
        </div>

        <Button
          onClick={handleConvert}
          disabled={formatting}
          className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs gap-1.5 shrink-0"
        >
          {formatting ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
          تطبيق التحويل على كامل البحث
        </Button>
      </div>

      {/* Style Selector Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {(Object.keys(styles) as AcademicStyle[]).map((key) => {
          const s = styles[key];
          const active = selectedStyle === key;
          return (
            <button
              key={key}
              onClick={() => setSelectedStyle(key)}
              className={`p-3.5 rounded-2xl border text-right transition-all space-y-1 ${
                active
                  ? "bg-fuchsia-600 text-white border-fuchsia-600 shadow-md scale-[1.02]"
                  : "bg-[var(--panel)] border-hairline text-foreground hover:border-fuchsia-500/40"
              }`}
            >
              <div className="font-bold text-xs">{s.name}</div>
              <div className={`text-[10px] truncate ${active ? "text-fuchsia-100" : "text-muted-foreground"}`}>
                {s.discipline.split("،")[0]}
              </div>
            </button>
          );
        })}
      </div>

      {/* Style Rules and Visual Comparison */}
      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
        {/* Live Transformation Preview */}
        <Card className="rounded-3xl border hairline bg-[var(--panel)]">
          <CardContent className="p-6 md:p-7 space-y-5">
            <div className="flex items-center justify-between border-b hairline pb-4">
              <div className="flex items-center gap-2 text-fuchsia-600 dark:text-fuchsia-400 text-xs font-bold uppercase tracking-wider">
                <BookMarked size={15} />
                معاينة التنسيق لنمط: {current.name}
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">التخصص: {current.discipline}</span>
            </div>

            {/* In-Text Citation Box */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-foreground">1. شكل الاقتباس داخل متن النص (In-Text Citation):</div>
              <div className="p-3.5 rounded-xl border hairline bg-[var(--bg)] font-mono text-xs text-foreground/90 ltr">
                {current.inTextExample}
              </div>
            </div>

            {/* Reference List Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-foreground">2. شكل التوثيق في قائمة المراجع النهائية (Bibliography):</div>
                <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2" onClick={copyRef}>
                  {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  نسخ المرجع
                </Button>
              </div>
              <div className="p-4 rounded-xl border hairline bg-[var(--bg)] font-mono text-xs text-foreground/90 leading-relaxed ltr">
                {current.referenceExample}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>يتم إعادة ضبط الهوامش تلقائياً عند التصدير لـ Word / PDF</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">مطابق للإصدار الأخير</span>
            </div>
          </CardContent>
        </Card>

        {/* Style Guidelines & Criteria Checklist */}
        <Card className="rounded-3xl border hairline bg-[var(--panel)]">
          <CardContent className="p-6 md:p-7 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Settings2 size={15} className="text-fuchsia-500" />
              أهم قواعد ومعايير نمط {current.name}:
            </div>

            <div className="space-y-2.5">
              {current.characteristics.map((char, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-3 rounded-xl border hairline bg-[var(--bg)] text-xs leading-relaxed"
                >
                  <CheckCircle2 size={15} className="text-fuchsia-500 mt-0.5 shrink-0" />
                  <span>{char}</span>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-2xl bg-fuchsia-50/40 dark:bg-fuchsia-950/20 border border-fuchsia-100 dark:border-fuchsia-900/30 text-xs text-fuchsia-950 dark:text-fuchsia-200 leading-relaxed">
              <span className="font-bold block mb-1">ملاحظة أستاذ المساق:</span>
              يُطبق هذا النمط على كل من: صلب التقرير، الجداول والأشكال التوضيحية، الهوامش السفلية، وقائمة المراجع لضمان الحصول على الدرجة الكاملة في معيار التنسيق الأكاديمي.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

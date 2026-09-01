import React, { useState } from "react";
import {
  ShieldAlert,
  Flame,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import type { ProjectDNA } from "../../types";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

interface CounterArgument {
  id: string;
  category: "methodology" | "sampling" | "generalizability" | "theoretical";
  challengeTitle: string;
  critiqueText: string;
  suggestedDefense: string;
  defenseStatus: "unaddressed" | "addressed" | "strong";
}

export function RedTeamingArena({ project }: { project: ProjectDNA }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const [argumentsList, setArgumentsList] = useState<CounterArgument[]>([
    {
      id: "arg-1",
      category: "sampling",
      challengeTitle: "محدودية حجم العينة والتمثيل الديموغرافي",
      critiqueText: "قد يعترض المناقش بأن اختيار عينة الطلاب من كلية واحدة فقط يقلل من القدرة على تعميم النتائج على باقي الجامعات أو المراحل التعليمية الأخرى.",
      suggestedDefense: "أكّد أن الدراسة هي دراسة استكشافية نوعية (Exploratory Case Study) تركز على العمق المعرفي والسياقي بدلاً من التعميم الإحصائي الواسع، واقترح توسيع العينة في الدراسات المستقبلية كبند صريح في التوصيات.",
      defenseStatus: "strong",
    },
    {
      id: "arg-2",
      category: "methodology",
      challengeTitle: "الاعتماد على الاستبيان الذاتي وتأثير التحيز (Social Desirability Bias)",
      critiqueText: "الاعتماد الحصري على استبيان تقرير ذاتي (Self-Report Survey) قد يؤدي إلى إجابات مجاملة أو غير دقيقة حول استخدام الذكاء الاصطناعي.",
      suggestedDefense: "بيّن أنه تم تطبيق معيار الموثوقية (Cronbach's Alpha = 0.88)، وإجراء استبانات مجهولة الهوية بالكامل لضمان سرية البيانات وتحييد الرغبة في المجاملة.",
      defenseStatus: "addressed",
    },
    {
      id: "arg-3",
      category: "theoretical",
      challengeTitle: "التسليم بصحة الإطار النظري الكلاسيكي دون تحديث معايير 2026",
      critiqueText: "الإطار النظري المعتمد يرتكز على نظريات التعلم البنائية القديمة دون دمج أحدث أطر العمل المتعلقة بالتفاعل التوليدي بين الإنسان والآلة (Human-in-the-Loop Pedagogy).",
      suggestedDefense: "أشر إلى أن النظرية البنائية هي الأساس المعرفي الصلب، ولكن تم تطعيمها في الفصل الثاني بنموذج التعلم التوليدي الحديث (Generative Scaffold Framework) مع ذكر أحدث الأبحاث المنشورة.",
      defenseStatus: "unaddressed",
    },
  ]);

  const handleSimulateAttack = () => {
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
    }, 800);
  };

  const toggleStatus = (id: string) => {
    setArgumentsList((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextStatus = item.defenseStatus === "unaddressed" ? "addressed" : item.defenseStatus === "addressed" ? "strong" : "unaddressed";
          return { ...item, defenseStatus: nextStatus };
        }
        return item;
      })
    );
  };

  const filtered = activeCategory === "all" ? argumentsList : argumentsList.filter((a) => a.category === activeCategory);

  return (
    <div className="space-y-6">
      {/* Red Teaming Header */}
      <div className="rounded-2xl border hairline bg-gradient-to-r from-red-500/10 via-rose-500/5 to-transparent p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-red-500/20 text-red-600 dark:text-red-400 grid place-items-center shrink-0">
            <Flame size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-red-600 dark:text-red-400">
                Red Teaming & Adversarial Defense
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/15 text-red-700 dark:text-red-300 font-semibold border border-red-500/20">
                فحص الثغرات ونقد المناقش
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight mt-0.5">
              محاكي السيناريوهات المعاكسة وتفكيك الحجج
            </h2>
          </div>
        </div>

        <Button
          onClick={handleSimulateAttack}
          disabled={analyzing}
          className="bg-red-600 hover:bg-red-700 text-white gap-2 shrink-0"
        >
          {analyzing ? <RefreshCw size={15} className="animate-spin" /> : <Zap size={15} />}
          شن هجوم أكاديمي جديد (Stress-Test)
        </Button>
      </div>

      {/* Categories Filter */}
      <div className="flex gap-2 flex-wrap text-xs">
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-3 py-1.5 rounded-xl border hairline transition-colors ${activeCategory === "all" ? "bg-red-600 text-white border-red-600 font-semibold" : "bg-[var(--panel)] text-muted-foreground"}`}
        >
          كل الاعتراضات ({argumentsList.length})
        </button>
        <button
          onClick={() => setActiveCategory("sampling")}
          className={`px-3 py-1.5 rounded-xl border hairline transition-colors ${activeCategory === "sampling" ? "bg-red-600 text-white border-red-600 font-semibold" : "bg-[var(--panel)] text-muted-foreground"}`}
        >
          نقد العينة والبيانات
        </button>
        <button
          onClick={() => setActiveCategory("methodology")}
          className={`px-3 py-1.5 rounded-xl border hairline transition-colors ${activeCategory === "methodology" ? "bg-red-600 text-white border-red-600 font-semibold" : "bg-[var(--panel)] text-muted-foreground"}`}
        >
          نقد المنهجية
        </button>
        <button
          onClick={() => setActiveCategory("theoretical")}
          className={`px-3 py-1.5 rounded-xl border hairline transition-colors ${activeCategory === "theoretical" ? "bg-red-600 text-white border-red-600 font-semibold" : "bg-[var(--panel)] text-muted-foreground"}`}
        >
          نقد الإطار النظري
        </button>
      </div>

      {/* Argument Cards */}
      <div className="space-y-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border hairline bg-[var(--panel)] p-5 space-y-4 hover:border-red-500/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-7 w-7 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 grid place-items-center shrink-0">
                  <ShieldAlert size={16} />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-foreground">{item.challengeTitle}</h3>
                  <span className="text-[10px] uppercase font-mono text-muted-foreground">{item.category} challenge</span>
                </div>
              </div>

              <button
                onClick={() => toggleStatus(item.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5 transition-colors ${
                  item.defenseStatus === "strong"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : item.defenseStatus === "addressed"
                    ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                    : "bg-red-500/10 text-red-600 border-red-500/20"
                }`}
              >
                {item.defenseStatus === "strong" ? (
                  <>
                    <CheckCircle2 size={12} />
                    رد محكم وجاهز
                  </>
                ) : item.defenseStatus === "addressed" ? (
                  <>
                    <ShieldCheck size={12} />
                    تمت المعالجة جزئياً
                  </>
                ) : (
                  <>
                    <AlertTriangle size={12} />
                    يحتاج لصياغة رد
                  </>
                )}
              </button>
            </div>

            {/* Critique Description */}
            <div className="p-3.5 rounded-xl bg-red-50/40 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-xs text-red-950 dark:text-red-200 leading-relaxed">
              <span className="font-bold block mb-1">اعتراض المناقش المحتمل:</span>
              {item.critiqueText}
            </div>

            {/* Suggested Defense Strategy */}
            <div className="p-3.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-xs text-emerald-950 dark:text-emerald-200 leading-relaxed space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                <Sparkles size={13} />
                استراتيجية الرد والتأصيل العلمي المقترحة:
              </span>
              <p>{item.suggestedDefense}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

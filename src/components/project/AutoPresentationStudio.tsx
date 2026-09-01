import React, { useState } from "react";
import {
  Presentation,
  Play,
  Download,
  Mic,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  FileText,
  Volume2,
  Copy,
  Check,
} from "lucide-react";
import type { ProjectDNA } from "../../types";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

interface SlideData {
  id: number;
  title: string;
  subtitle: string;
  bulletPoints: string[];
  allocatedTimeSeconds: number;
  speakerScript: string;
  keyTakeaway: string;
}

export function AutoPresentationStudio({ project }: { project: ProjectDNA }) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const slides: SlideData[] = [
    {
      id: 1,
      title: project.title || "عنوان المشروع الأكاديمي",
      subtitle: `${project.course} — تحت إشراف لجنة المناقشة الموقرة`,
      bulletPoints: [
        "سياق المشكلة والدافع البحثي للمشروع",
        "الأهداف الرئيسية والأسئلة البحثية",
        "الأهمية الأكاديمية والتطبيقية للدراسة",
      ],
      allocatedTimeSeconds: 60,
      speakerScript:
        "بسم الله الرحمن الرحيم، أرحب بلجنة المناقشة الكريمة والحضور جميعاً. يهدف هذا العرض إلى تقديم خلاصة مشروعنا الأكاديمي الذي يعالج فجوة بحثية وتطبيقية هامة في مجال " +
        (project.academicDomain || "التخصص") +
        "، وسنستعرض معاً أهم المخرجات المنهجية والنتائج المستخلصة.",
      keyTakeaway: "الترحيب، التعريف بالمشروع، ووضع اللجنة في سياق المشكلة باحترافية وهدوء.",
    },
    {
      id: 2,
      title: "الإطار النظري ومراجعة الأدبيات السابقة",
      subtitle: "التأصيل العلمي وسد الفجوة المعرفية",
      bulletPoints: [
        "تحليل الدراسات السابقة واستعراض أحدث الأبحاث (2022-2026)",
        "تحديد الفجوة البحثية الدقيقة التي يعالجها التكليف",
        "بناء النموذج المعرفي والفرضيات الأساسية",
      ],
      allocatedTimeSeconds: 90,
      speakerScript:
        "عند استقراء الأدبيات السابقة، لاحظنا وجود تركيز كبير على الجوانب النظرية مع غياب أطر القياس الميدانية. هنا تأتي قيمة عملنا لسد هذه الفجوة استناداً إلى أحدث المعايير المعتمدة دولياً.",
      keyTakeaway: "إبراز قوة المراجع وأصالة الفكرة من خلال الفجوة البحثية.",
    },
    {
      id: 3,
      title: "المنهجية وأدوات جمع البيانات",
      subtitle: "التصميم الإحصائي، العينة، وإجراءات الصدق والثبات",
      bulletPoints: [
        "نوع المنهج المتبع (وصفي تحليلي / تجريبي)",
        "حجم العينة ومحددات الاختيار العشوائي",
        "معاملات الصدق والثبات والتحليل الإحصائي",
      ],
      allocatedTimeSeconds: 120,
      speakerScript:
        "اعتمدنا تصميماً منهجياً محكماً يضمن موثوقية النتائج؛ حيث تم تطبيق أدوات القياس على العينة المستهدفة والتحقق من الصدق الظاهري والثبات الإحصائي قبل الشروع في جمع البيانات النهائية.",
      keyTakeaway: "طمأنة اللجنة على رصانة المنهجية وسلامة أدوات القياس.",
    },
    {
      id: 4,
      title: "أبرز النتائج والتوصيات التطبيقية",
      subtitle: "خلاصة المخرجات وخارطة الطريق لصناع القرار",
      bulletPoints: [
        "إثبات صحة الفرضيات بفوارق ذات دلالة إحصائية",
        "مقارنة النتائج الحالية بالأبحاث السابقة المشابهة",
        "ثلاث توصيات تنفيذية محددة وقابلة للتطبيق الفوري",
      ],
      allocatedTimeSeconds: 90,
      speakerScript:
        "ختاماً، أظهرت النتائج تطابقاً قوياً مع الفرضيات المطروحة، ونوصي بناءً على هذا العمل بتبني آليات التدخل المنهجي المقترحة لتعزيز الكفاءة والنزاهة، ونحن على أتم الاستعداد لتلقي ملاحظاتكم وأسئلتكم القيمة.",
      keyTakeaway: "إنهاء العرض بثقة وتقديم توصيات ملموسة وفتح باب الأسئلة بأدب أكاديمي.",
    },
  ];

  const currentSlide = slides[currentSlideIndex];
  const totalMinutes = Math.ceil(slides.reduce((acc, s) => acc + s.allocatedTimeSeconds, 0) / 60);

  const copyScript = () => {
    navigator.clipboard.writeText(currentSlide.speakerScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="rounded-2xl border hairline bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 grid place-items-center shrink-0">
            <Presentation size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400">
                Auto-Slide & Presenter Script Sync
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/20">
                سيناريو الإلقاء المتزامن
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight mt-0.5">
              مُولِّد شرائح العرض الأكاديمي وسيناريو الإلقاء الزمني
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="text-xs gap-1.5">
            <Download size={13} />
            تحميل باوربوينت (PPTX)
          </Button>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5">
            <Play size={13} />
            بدء وضع المحاضر الكامل
          </Button>
        </div>
      </div>

      {/* Main Slide & Presenter Notes Split */}
      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
        {/* Slide Visual Screen */}
        <div className="space-y-4">
          <div className="rounded-3xl border-2 hairline bg-gradient-to-br from-zinc-900 via-zinc-950 to-black text-white p-8 md:p-10 shadow-2xl min-h-[360px] flex flex-col justify-between relative overflow-hidden">
            {/* Slide Header */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 pb-4 border-b border-zinc-800">
                <span className="font-bold tracking-wider uppercase text-amber-400">
                  {project.academicDomain || "Academic Project"}
                </span>
                <span className="font-mono">
                  الشريحة {currentSlide.id} من {slides.length}
                </span>
              </div>

              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white mt-5">
                {currentSlide.title}
              </h2>
              <p className="text-xs text-amber-300/80 mt-1 font-medium">{currentSlide.subtitle}</p>
            </div>

            {/* Slide Bullets */}
            <div className="space-y-3 py-6">
              {currentSlide.bulletPoints.map((point, i) => (
                <div key={i} className="flex items-start gap-3 text-xs md:text-sm text-zinc-200">
                  <span className="h-2 w-2 rounded-full bg-amber-400 mt-2 shrink-0" />
                  <span className="leading-relaxed">{point}</span>
                </div>
              ))}
            </div>

            {/* Slide Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-800 text-[10px] text-zinc-400 font-mono">
              <span>{project.course}</span>
              <span>AcademicOS Verified Slide</span>
            </div>
          </div>

          {/* Slide Navigation Bar */}
          <div className="flex items-center justify-between p-3 rounded-2xl border hairline bg-[var(--panel)]">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentSlideIndex === 0}
              className="text-xs gap-1"
            >
              <ChevronRight size={14} />
              الشريحة السابقة
            </Button>

            <div className="flex items-center gap-1.5">
              {slides.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentSlideIndex(idx)}
                  className={`h-2.5 rounded-full transition-all ${
                    currentSlideIndex === idx ? "w-7 bg-amber-500" : "w-2.5 bg-muted hover:bg-muted-foreground/40"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentSlideIndex((prev) => Math.min(slides.length - 1, prev + 1))}
              disabled={currentSlideIndex === slides.length - 1}
              className="text-xs gap-1"
            >
              الشريحة التالية
              <ChevronLeft size={14} />
            </Button>
          </div>
        </div>

        {/* Presenter Notes & Teleprompter */}
        <Card className="rounded-3xl border hairline bg-[var(--panel)]">
          <CardContent className="p-6 md:p-7 space-y-5">
            <div className="flex items-center justify-between border-b hairline pb-4">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider">
                <Mic size={15} />
                سيناريو الإلقاء الدقيق (Presenter Script)
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[11px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  <Clock size={12} />
                  {currentSlide.allocatedTimeSeconds} ثانية
                </span>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={copyScript}>
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  {copied ? "تم النسخ" : "نسخ النص"}
                </Button>
              </div>
            </div>

            {/* Script Text */}
            <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 space-y-2">
              <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                ماذا تقول للجنة المناقشة خلال هذه الشريحة:
              </div>
              <p className="text-xs md:text-sm text-foreground leading-relaxed font-sans font-medium">
                "{currentSlide.speakerScript}"
              </p>
            </div>

            {/* Key Takeaway / Psychological Cue */}
            <div className="p-3.5 rounded-xl border hairline bg-[var(--bg)] text-xs text-muted-foreground space-y-1">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-500" />
                الهدف التواصلي من الشريحة:
              </span>
              <p className="leading-relaxed">{currentSlide.keyTakeaway}</p>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs text-muted-foreground font-mono">
              <span>إجمالي وقت العرض المتوقع: ~{totalMinutes} دقائق</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">مطابق لوقت المناقشة الجامعية</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

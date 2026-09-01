import React, { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Activity,
  FileSearch,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Copy,
  Check,
  RefreshCw,
  Eye,
  Sliders,
  Cpu,
  Layers,
  Fingerprint,
} from "lucide-react";
import type { DeepAIDetectionReport, ProjectDNA } from "../../types";
import { api } from "../../lib/api";
import { Button } from "../ui/button";

export function TurnitinForensicShieldModal({
  project,
  onClose,
}: {
  project: ProjectDNA;
  onClose: () => void;
}) {
  const [customText, setCustomText] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<DeepAIDetectionReport | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "sentences" | "cliches" | "signals">("overview");

  const [humanizing, setHumanizing] = useState(false);
  const [humanizedResult, setHumanizedResult] = useState<{ humanizedText: string; improvementsMade: string[] } | null>(null);

  async function handleAnalyze() {
    setLoading(true);
    try {
      const res = await api.detectAI(project.id, customText || undefined);
      setReport(res.report);
      setHumanizedResult(null);
    } catch (e: any) {
      alert(e.message || "حدث خطأ أثناء فحص البصمة الجنائية.");
    } finally {
      setLoading(false);
    }
  }

  async function handleHumanize() {
    setHumanizing(true);
    try {
      const textToHumanize = customText || (report ? report.sentenceBreakdown.map(s => s.text).join(" ") : "");
      if (!textToHumanize) {
        alert("يرجى كتابة نص أو فحص المشروع أولاً.");
        return;
      }
      const res = await api.humanize(project.id, textToHumanize);
      setHumanizedResult({ humanizedText: res.humanizedText, improvementsMade: res.improvementsMade });
    } catch (e: any) {
      alert(e.message || "حدث خطأ أثناء معالجة النص وبناء الطابع البشري.");
    } finally {
      setHumanizing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 text-slate-100 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <Fingerprint size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  الدرع الجنائي للكشف عن الذكاء الاصطناعي (Turnitin & LLM Forensic Radar)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Ultra-Forensic v4.2
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                فحص عميق متعدد الطبقات: الـ Perplexity، والـ Burstiness، وبصمات الـ N-Gram لكشف النماذج التوليدية (GPT-4o, Claude 3.5, Gemini 1.5/2.0).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Custom Text or Project Run */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-semibold flex items-center gap-1.5 text-emerald-400">
                <FileSearch size={14} /> فحص نص مسودة المشروع أو لصق نص خارجي:
              </span>
              <span className="text-slate-500">
                اترك الحقل فارغاً لفحص كامل نصوص وأقسام المشروع التلقائية
              </span>
            </div>
            <textarea
              rows={3}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="الصق نص الفقرة أو المقال هنا للمعاينة الفورية، أو اضغط الزر مباشرة لفحص كامل مسودة المشروع..."
              className="w-full bg-slate-900 border border-slate-700/70 rounded-lg p-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                <Sliders size={13} className="text-cyan-400" />
                معيار الحساسية: <strong className="text-slate-200">أعلى دقة جنائية (Multi-Vector Stylometry)</strong>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleHumanize}
                  disabled={humanizing}
                  variant="outline"
                  className="border-cyan-500/40 text-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/40 font-medium text-xs px-4"
                >
                  {humanizing ? (
                    <>
                      <RefreshCw size={14} className="animate-spin mr-1.5" />
                      جاري المعالجة البشرية...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} className="mr-1.5" />
                      إضفاء الطابع البشري المنهجي (1-Click Humanizer)
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-xs px-5 shadow-lg shadow-emerald-900/30"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin mr-1.5" />
                      جاري التشريح الجنائي...
                    </>
                  ) : (
                    <>
                      <Zap size={14} className="mr-1.5" />
                      تشغيل الفحص الجنائي الشامل
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Humanized Result Display if available */}
          {humanizedResult && (
            <div className="bg-cyan-950/30 border border-cyan-500/40 rounded-xl p-4 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                  <Sparkles size={14} /> نتيجة محرك إضفاء الطابع البشري المنهجي (Scholarly Humanized Text)
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(humanizedResult.humanizedText);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="text-xs text-cyan-300 border-cyan-500/40 bg-cyan-950/50"
                >
                  {copied ? <Check size={13} className="mr-1" /> : <Copy size={13} className="mr-1" />}
                  {copied ? "تم النسخ" : "نسخ النص المعالج"}
                </Button>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 leading-relaxed font-sans max-h-60 overflow-y-auto">
                {humanizedResult.humanizedText}
              </div>
              <div className="text-[11px] text-cyan-400 flex flex-wrap gap-2 pt-1">
                {humanizedResult.improvementsMade.map((imp, i) => (
                  <span key={i} className="bg-cyan-900/50 px-2 py-0.5 rounded text-cyan-200">
                    ✓ {imp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Results Area */}
          {report && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Primary Metric Hero */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div
                  className={`p-4 rounded-xl border flex flex-col justify-between ${
                    report.overallAIScore < 25
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-300"
                      : report.overallAIScore < 50
                        ? "bg-amber-950/30 border-amber-500/40 text-amber-300"
                        : "bg-red-950/30 border-red-500/40 text-red-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      مؤشر الـ AI التراكمي
                    </span>
                    {report.overallAIScore < 25 ? (
                      <ShieldCheck size={18} className="text-emerald-400" />
                    ) : (
                      <ShieldAlert size={18} className="text-red-400" />
                    )}
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold tracking-tight">
                      {report.overallAIScore}%
                    </span>
                    <span className="text-xs text-slate-400">احتمالية التوليد</span>
                  </div>
                  <div className="mt-2 text-[11px] font-medium leading-tight">
                    {report.verdictLabel}
                  </div>
                </div>

                {/* Perplexity */}
                <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>معدل الحيرة (Perplexity)</span>
                    <Activity size={16} className="text-cyan-400" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-white">
                    {report.metrics.perplexityScore}/100
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {report.metrics.perplexityScore > 70
                      ? "ارتفاع التعقيد والمفردات الطبيعية (سلوك بشري أصيل)."
                      : "تنبؤية لغوية عالية تطابق توليد الـ LLM."}
                  </p>
                </div>

                {/* Burstiness */}
                <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>التدفق النبضي (Burstiness)</span>
                    <Layers size={16} className="text-indigo-400" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-white">
                    {report.metrics.burstinessScore}/100
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {report.metrics.burstinessScore > 60
                      ? "تنوع عضوي متوازن في طول وهيكل الجمل."
                      : "رتابة هيكلية ميكانيكية بين 16-24 كلمة."}
                  </p>
                </div>

                {/* Clichés Count */}
                <div className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between text-slate-400 text-xs">
                    <span>بصمات الكليشيهات</span>
                    <Cpu size={16} className="text-pink-400" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-white">
                    {report.metrics.aiHallmarkPhrasesCount}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {report.metrics.aiHallmarkPhrasesCount === 0
                      ? "خلو تام من العبارات النمطية للذكاء الاصطناعي."
                      : "تم رصد تعبيرات شائعة في المخرجات التوليدية."}
                  </p>
                </div>
              </div>

              {/* Tabs Navigation */}
              <div className="flex border-b border-slate-800 gap-4 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`pb-2 transition ${
                    activeTab === "overview"
                      ? "text-emerald-400 border-b-2 border-emerald-400"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  الملخص والإشارات الجنائية ({report.forensicSignals.length})
                </button>
                <button
                  onClick={() => setActiveTab("sentences")}
                  className={`pb-2 transition ${
                    activeTab === "sentences"
                      ? "text-emerald-400 border-b-2 border-emerald-400"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  التشريح الجملي (Sentence Breakdown - {report.sentenceBreakdown.length})
                </button>
                <button
                  onClick={() => setActiveTab("cliches")}
                  className={`pb-2 transition ${
                    activeTab === "cliches"
                      ? "text-emerald-400 border-b-2 border-emerald-400"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  الكليشيهات المرصودة ({report.detectedClichés.length})
                </button>
              </div>

              {/* Tab 1: Overview & Forensic Signals */}
              {activeTab === "overview" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      الإشارات الجنائية المكتشفة (Forensic Flags)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {report.forensicSignals.map((signal, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border text-xs ${
                            signal.severity === "critical"
                              ? "bg-red-950/30 border-red-500/40 text-red-200"
                              : signal.severity === "high"
                                ? "bg-amber-950/30 border-amber-500/40 text-amber-200"
                                : signal.severity === "medium"
                                  ? "bg-yellow-950/20 border-yellow-500/30 text-yellow-200"
                                  : "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1.5">
                            {signal.severity === "critical" || signal.severity === "high" ? (
                              <AlertTriangle size={14} className="text-red-400 shrink-0" />
                            ) : (
                              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                            )}
                            {signal.title}
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                            {signal.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Humanization Recommendations */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                    <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Sparkles size={14} /> توصيات إضفاء الطابع البشري والرصانة (Humanization & Rigor Protocol)
                    </h3>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {report.humanizationRecommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Tab 2: Sentence Breakdown */}
              {activeTab === "sentences" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>تشريح كل جملة على حدة مع بيان نسبة الشك والأسباب:</span>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> عالي الشبه (AI)</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> متوسط الشبه</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> بشري أصيل</span>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {report.sentenceBreakdown.map((s, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs transition ${
                          s.highlightColor === "red"
                            ? "bg-red-950/20 border-red-500/30 text-red-100"
                            : s.highlightColor === "orange" || s.highlightColor === "yellow"
                              ? "bg-amber-950/20 border-amber-500/30 text-amber-100"
                              : "bg-slate-950/30 border-slate-800 text-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <p className="leading-relaxed font-sans">{s.text}</p>
                          <div className="shrink-0 text-right">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                s.aiProbability >= 70
                                  ? "bg-red-500/20 text-red-400 border border-red-500/40"
                                  : s.aiProbability >= 40
                                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              }`}
                            >
                              AI: {s.aiProbability}%
                            </span>
                          </div>
                        </div>
                        {s.reasons.length > 0 && (
                          <div className="mt-1.5 pt-1.5 border-t border-slate-800/60 text-[10px] text-slate-400 flex flex-wrap gap-2">
                            {s.reasons.map((r, ri) => (
                              <span key={ri} className="bg-slate-900/80 px-2 py-0.5 rounded text-slate-300">
                                ⚠ {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 3: Clichés */}
              {activeTab === "cliches" && (
                <div className="space-y-3">
                  {report.detectedClichés.length === 0 ? (
                    <div className="text-center py-8 bg-slate-950/30 border border-slate-800 rounded-xl">
                      <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-2" />
                      <div className="text-xs font-bold text-slate-200">لم يتم رصد أي كليشيهات أو مصطلحات آلية</div>
                      <div className="text-[11px] text-slate-400 mt-1">النص نظيف تماماً من التعبيرات الشائعة لنماذج الذكاء الاصطناعي.</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {report.detectedClichés.map((c, i) => (
                        <div key={i} className="bg-slate-950/40 border border-slate-800 p-3 rounded-lg flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-pink-400 font-mono">"{c.phrase}"</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              تصنيف: {c.category === "ai_hallmark" ? "بصمة LLM شائعة" : c.category === "hedging" ? "تحوط تعميمي" : "رابط ميكانيكي"}
                            </div>
                          </div>
                          <span className="bg-pink-500/10 text-pink-300 border border-pink-500/30 px-2 py-0.5 rounded-full text-[11px] font-bold">
                            {c.occurrences} تكرار
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <a
              href={api.exportBundleUrl(project.id)}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow transition"
            >
              📥 تنزيل حزمة التسليم الأكاديمية الكاملة (.ZIP)
            </a>
            <span className="text-slate-400 hidden md:inline">
              تشمل البحث، التقرير الجنائي، ملف النزاهة والمراجع (.bib).
            </span>
          </div>
          <Button variant="outline" onClick={onClose} className="text-xs text-slate-300 border-slate-700">
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
}

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  Copy,
  FileSearch,
  Fingerprint,
  LoaderCircle,
  Quote,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { DeepAIDetectionReport, ProjectDNA } from "../../types";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { Button } from "../ui/button";

export function TurnitinForensicShieldModal({
  project,
  onClose,
}: {
  project: ProjectDNA;
  onClose: () => void;
}) {
  const { locale, t } = useI18n();
  const [customText, setCustomText] = useState("");
  const [loading, setLoading] = useState(false);
  const [improving, setImproving] = useState(false);
  const [report, setReport] = useState<DeepAIDetectionReport | null>(null);
  const [improved, setImproved] = useState<{ text: string; notes: string[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"overview" | "sentences" | "patterns">("overview");
  const sourceText = useMemo(
    () => customText.trim() || report?.sentenceBreakdown.map((sentence) => sentence.text).join(" ") || "",
    [customText, report],
  );

  async function analyze() {
    setLoading(true);
    setImproved(null);
    try {
      const result = await api.styleIntegrity(project.id, customText.trim() || undefined, locale);
      setReport(result.report);
    } catch (error: any) {
      alert(error?.message || t("integrity.errorAnalyze"));
    } finally {
      setLoading(false);
    }
  }

  async function improve() {
    if (!sourceText) {
      alert(t("integrity.needText"));
      return;
    }
    setImproving(true);
    try {
      const result = await api.improveStyle(project.id, sourceText, locale);
      setImproved({ text: result.improvedText, notes: result.improvementsMade });
    } catch (error: any) {
      alert(error?.message || t("integrity.errorImprove"));
    } finally {
      setImproving(false);
    }
  }

  const riskTone = report
    ? report.styleRiskScore >= 60
      ? "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/25"
      : report.styleRiskScore >= 30
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25"
        : "brand-soft-bg brand-text border-[var(--brand)]/20"
    : "";

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} aria-label={t("common.close")} />
      <div className="relative panel w-full max-w-5xl max-h-[92vh] rounded-[28px] overflow-hidden shadow-2xl">
        <header className="p-5 md:p-6 border-b hairline flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="h-12 w-12 rounded-2xl brand-soft-bg grid place-items-center shrink-0"><Fingerprint size={21} /></span>
            <div>
              <div className="eyebrow">Style & Integrity Guardian</div>
              <h2 className="text-xl md:text-2xl font-bold mt-1">{t("integrity.title")}</h2>
              <p className="body-copy mt-2 max-w-3xl">{t("integrity.description")}</p>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label={t("common.close")}><X size={18} /></Button>
        </header>

        <div className="p-5 md:p-6 overflow-y-auto max-h-[calc(92vh-104px)] space-y-5">
          <section className="rounded-2xl border hairline p-4 md:p-5 bg-[var(--bg)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold flex items-center gap-2"><FileSearch size={15} className="brand-text" /> {t("integrity.scopeTitle")}</div>
                <p className="text-[10px] muted mt-1">{t("integrity.scopeHint")}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={improve} disabled={improving || (!sourceText && !report)}>
                  {improving ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {t("integrity.improve")}
                </Button>
                <Button onClick={analyze} disabled={loading}>
                  {loading ? <LoaderCircle size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                  {t("integrity.analyze")}
                </Button>
              </div>
            </div>
            <textarea
              value={customText}
              onChange={(event) => setCustomText(event.target.value)}
              rows={4}
              className="field mt-4 resize-y"
              placeholder={t("integrity.placeholder")}
            />
          </section>

          {improved && (
            <section className="rounded-2xl border border-[var(--brand)]/25 brand-soft-bg p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div><div className="eyebrow">{t("integrity.transparentImprove")}</div><h3 className="section-title mt-1">{t("integrity.sameMeaning")}</h3></div>
                <Button variant="outline" size="sm" onClick={() => {
                  navigator.clipboard.writeText(improved.text).then(() => {
                    setCopied(true); window.setTimeout(() => setCopied(false), 1600);
                  });
                }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? t("common.copied") : t("common.copy")}</Button>
              </div>
              <div className="mt-4 rounded-xl bg-[var(--panel)] border hairline p-4 text-sm leading-7 whitespace-pre-wrap">{improved.text}</div>
              <div className="mt-3 flex flex-wrap gap-2">{improved.notes.map((note) => <span key={note} className="rounded-full bg-[var(--panel)] border hairline px-3 py-1 text-[10px]">{note}</span>)}</div>
            </section>
          )}

          {report && (
            <>
              <section className={`rounded-2xl border p-5 ${riskTone}`}>
                <div className="grid md:grid-cols-[1fr_auto] gap-5 items-center">
                  <div>
                    <div className="text-[10px] font-semibold opacity-70">{t("integrity.riskNotAi")}</div>
                    <div className="text-2xl md:text-3xl font-bold mt-2">{report.verdictLabel}</div>
                    <p className="text-xs leading-6 mt-3 opacity-80">{report.disclaimer}</p>
                  </div>
                  <div className="text-center md:min-w-36">
                    <div className="text-5xl font-black mono-number">{report.styleRiskScore}</div>
                    <div className="text-[10px] mt-1">{t("integrity.lowerBetter")}</div>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Metric icon={BarChart3} label={t("integrity.metricRhythm")} value={`${report.metrics.sentenceRhythmVariety}%`} />
                <Metric icon={Quote} label={t("integrity.metricCliches")} value={report.metrics.clichéCount} />
                <Metric icon={FileSearch} label={t("integrity.metricCitations")} value={report.metrics.citationVerificationFlags} />
                <Metric icon={AlertTriangle} label={t("integrity.metricUnsupported")} value={report.metrics.unsupportedQuantitativeClaims} />
              </div>

              <nav className="flex gap-2 overflow-x-auto border-b hairline pb-2">
                {([
                  ["overview", t("integrity.tabOverview")],
                  ["sentences", `${t("integrity.tabSentences")} (${report.sentenceBreakdown.length})`],
                  ["patterns", `${t("integrity.tabPatterns")} (${report.detectedClichés.length})`],
                ] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setTab(key)} className={`focus-ring rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap ${tab === key ? "brand-soft-bg" : "muted"}`}>{label}</button>
                ))}
              </nav>

              {tab === "overview" && (
                <div className="grid lg:grid-cols-2 gap-4">
                  <section className="space-y-2">
                    <div className="eyebrow">{t("integrity.signals")}</div>
                    {report.signals.map((signal, index) => (
                      <div key={`${signal.title}-${index}`} className="rounded-xl border hairline p-4 flex gap-3">
                        <span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${signal.severity === "high" || signal.severity === "critical" ? "bg-amber-500/10 text-[var(--warning)]" : "brand-soft-bg brand-text"}`}>
                          {signal.severity === "low" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                        </span>
                        <div><strong className="text-sm">{signal.title}</strong><p className="text-xs muted leading-6 mt-1">{signal.description}</p></div>
                      </div>
                    ))}
                  </section>
                  <section className="rounded-2xl soft-bg p-4">
                    <div className="eyebrow">{t("integrity.whatFix")}</div>
                    <div className="space-y-2 mt-3">{report.recommendations.map((item, index) => <div key={item} className="rounded-xl bg-[var(--panel)] border hairline p-3 text-xs leading-6 flex gap-2"><span className="brand-text font-bold">{index + 1}</span><span>{item}</span></div>)}</div>
                  </section>
                </div>
              )}

              {tab === "sentences" && (
                <div className="space-y-2 max-h-[46vh] overflow-auto pe-1">
                  {report.sentenceBreakdown.map((sentence, index) => (
                    <div key={index} className={`rounded-xl border p-3 ${sentence.highlightColor === "red" ? "border-red-500/25 bg-red-500/5" : sentence.highlightColor === "orange" ? "border-amber-500/25 bg-amber-500/5" : "hairline"}`}>
                      <div className="flex items-start gap-3 justify-between"><p className="text-sm leading-7">{sentence.text}</p><span className="rounded-full soft-bg px-2 py-1 text-[9px] font-semibold shrink-0">{t("integrity.review")} {sentence.styleRiskScore}</span></div>
                      <div className="flex flex-wrap gap-1.5 mt-2">{sentence.reasons.map((reason) => <span key={reason} className="rounded-full soft-bg px-2.5 py-1 text-[9px] muted">{reason}</span>)}</div>
                    </div>
                  ))}
                </div>
              )}

              {tab === "patterns" && (
                <div className="grid md:grid-cols-2 gap-3">
                  {report.detectedClichés.map((item) => <div key={item.phrase} className="rounded-xl border hairline p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm">{item.phrase}</strong><span className="text-[10px] muted">×{item.occurrences}</span></div><div className="text-[10px] muted mt-2">{t(`integrity.category.${item.category}`)}</div></div>)}
                  {!report.detectedClichés.length && <div className="md:col-span-2 rounded-xl brand-soft-bg p-5 text-sm font-semibold flex items-center gap-2"><CheckCircle2 size={17} /> {t("integrity.noCliches")}</div>}
                </div>
              )}
            </>
          )}

          {!report && !loading && (
            <div className="rounded-2xl border border-dashed hairline p-10 text-center">
              <ShieldCheck size={28} className="mx-auto brand-text" />
              <h3 className="font-bold mt-3">{t("integrity.trustFirst")}</h3>
              <p className="text-xs muted leading-6 mt-2 max-w-xl mx-auto">{t("integrity.trustDescription")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return <div className="rounded-2xl border hairline p-4 bg-[var(--panel)]"><div className="flex items-center justify-between gap-2"><span className="text-[10px] muted">{label}</span><Icon size={14} className="brand-text" /></div><div className="text-2xl font-bold mt-3 mono-number">{value}</div></div>;
}

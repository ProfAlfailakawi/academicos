import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  FileSearch,
  Fingerprint,
  GraduationCap,
  History,
  Lightbulb,
  Quote,
  ShieldCheck,
  X,
} from "lucide-react";
import type { DeepAIDetectionReport, ProjectDNA } from "../../types";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/i18n";
import { Button } from "../ui/button";
import { InlineLoader } from "../ui/AcademicLoader";
import { DialogShell } from "../AppDialog";

/**
 * Authorship & Integrity Check.
 *
 * Explains the writing signals an assessor may question and turns them into
 * learning prompts the student acts on in their own words. It deliberately
 * never produces rewritten text and never frames itself as an external
 * detector; authorship is demonstrated through the process-evidence timeline.
 */
export function AuthorshipIntegrityModal({
  project,
  onClose,
  onOpenTimeline,
}: {
  project: ProjectDNA;
  onClose: () => void;
  onOpenTimeline?: () => void;
}) {
  const { locale, t } = useI18n();
  const [customText, setCustomText] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<DeepAIDetectionReport | null>(null);
  const [actionError, setActionError] = useState("");
  const [tab, setTab] = useState<"overview" | "sentences" | "patterns">("overview");

  async function analyze() {
    setActionError("");
    setLoading(true);
    try {
      const result = await api.styleIntegrity(project.id, customText.trim() || undefined, locale);
      setReport(result.report);
    } catch (error) {
      console.error("Authorship & integrity check failed", error);
      setActionError(t("integrity.errorAnalyze"));
    } finally {
      setLoading(false);
    }
  }

  const learningPrompts = useMemo(() => {
    if (!report) return [] as string[];
    const prompts: string[] = [];
    if (report.metrics.clichéCount > 0) prompts.push(t("integrity.learn.formulaic"));
    if (report.metrics.citationVerificationFlags > 0) prompts.push(t("integrity.learn.citations"));
    if (report.metrics.unsupportedQuantitativeClaims > 0) prompts.push(t("integrity.learn.claims"));
    if (report.metrics.sentenceRhythmVariety < 40) prompts.push(t("integrity.learn.rhythm"));
    if (!prompts.length) prompts.push(t("integrity.learn.ok"));
    return prompts;
  }, [report, t]);

  const riskTone = report
    ? report.styleRiskScore >= 60
      ? "bg-danger/10 text-danger border-danger/25"
      : report.styleRiskScore >= 30
        ? "bg-warning/10 text-warning border-warning/25"
        : "brand-soft-bg brand-text border-[var(--brand)]/20"
    : "";

  const header = (
    <header className="p-5 md:p-6 border-b hairline flex items-start justify-between gap-4 shrink-0">
      <div className="flex items-start gap-3 min-w-0">
        <span className="h-12 w-12 rounded-2xl tone-tile shrink-0"><Fingerprint size={21} /></span>
        <div className="min-w-0">
          <div className="eyebrow">{t("ui.styleIntegrityGuardian")}</div>
          <p className="text-xl md:text-2xl font-bold mt-1" aria-hidden="true">{t("integrity.title")}</p>
          <p className="body-copy mt-2 max-w-3xl">{t("integrity.description")}</p>
        </div>
      </div>
      <Button size="icon" variant="ghost" onClick={onClose} aria-label={t("common.close")}><X size={18} /></Button>
    </header>
  );

  return (
    <DialogShell
      title={t("integrity.title")}
      onClose={onClose}
      header={header}
      overlayClassName="fixed inset-0 z-[90] flex items-center justify-center p-4"
      className="relative panel w-full max-w-5xl max-h-[92vh] rounded-[28px] overflow-hidden shadow-2xl flex flex-col"
      bodyClassName="p-5 md:p-6 overflow-y-auto flex-1 min-h-0 space-y-5"
    >
      {actionError && (
        <div role="alert" className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {actionError}
        </div>
      )}
      <section className="rounded-2xl border hairline p-4 md:p-5 bg-[var(--bg)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold flex items-center gap-2"><FileSearch size={15} className="brand-text" /> {t("integrity.scopeTitle")}</div>
            <p className="text-xs muted mt-1">{t("integrity.scopeHint")}</p>
          </div>
          <Button onClick={analyze} disabled={loading}>
            {loading ? <InlineLoader size={15} /> : <ShieldCheck size={15} />}
            {t("integrity.analyze")}
          </Button>
        </div>
        <label className="sr-only" htmlFor="integrity-custom-text">{t("integrity.scopeTitle")}</label>
        <textarea
          id="integrity-custom-text"
          dir="auto"
          value={customText}
          onChange={(event) => setCustomText(event.target.value)}
          rows={4}
          className="field mt-4 resize-y"
          placeholder={t("integrity.placeholder")}
        />
      </section>

      <div aria-live="polite" className="space-y-5">
        {report && (
          <>
            <section className={`rounded-2xl border p-5 ${riskTone}`}>
              <div className="grid md:grid-cols-[1fr_auto] gap-5 items-center">
                <div>
                  <div className="text-xs font-semibold opacity-80">{t("integrity.riskNotAi")}</div>
                  <div className="text-2xl md:text-3xl font-bold mt-2">{report.verdictLabel}</div>
                  <p className="text-sm leading-7 mt-3 opacity-90">{report.disclaimer}</p>
                </div>
                <div className="text-center md:min-w-36">
                  <div className="text-5xl font-black mono-number">{report.styleRiskScore}</div>
                  <div className="text-xs mt-1">{t("integrity.lowerBetter")}</div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--brand)]/25 brand-soft-bg p-4 md:p-5">
              <div className="flex items-center gap-2"><GraduationCap size={17} className="brand-text" /><h3 className="section-title">{t("integrity.learningTitle")}</h3></div>
              <p className="text-xs muted mt-1">{t("integrity.learningHint")}</p>
              <ul className="mt-3 space-y-2">
                {learningPrompts.map((prompt) => (
                  <li key={prompt} className="rounded-xl bg-[var(--panel)] border hairline p-3 text-sm leading-7 flex gap-2">
                    <Lightbulb size={15} className="brand-text shrink-0 mt-1.5" /><span>{prompt}</span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Metric icon={BarChart3} label={t("integrity.metricRhythm")} value={`${report.metrics.sentenceRhythmVariety}%`} />
              <Metric icon={Quote} label={t("integrity.metricCliches")} value={report.metrics.clichéCount} />
              <Metric icon={FileSearch} label={t("integrity.metricCitations")} value={report.metrics.citationVerificationFlags} />
              <Metric icon={AlertTriangle} label={t("integrity.metricUnsupported")} value={report.metrics.unsupportedQuantitativeClaims} />
            </div>

            <div role="tablist" aria-label={t("integrity.title")} className="flex gap-2 overflow-x-auto border-b hairline pb-2">
              {([
                ["overview", t("integrity.tabOverview")],
                ["sentences", `${t("integrity.tabSentences")} (${report.sentenceBreakdown.length})`],
                ["patterns", `${t("integrity.tabPatterns")} (${report.detectedClichés.length})`],
              ] as const).map(([key, label]) => (
                <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`focus-ring rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap ${tab === key ? "brand-soft-bg" : "muted"}`}>{label}</button>
              ))}
            </div>

            {tab === "overview" && (
              <div className="grid lg:grid-cols-2 gap-4" role="tabpanel">
                <section className="space-y-2">
                  <div className="eyebrow">{t("integrity.signals")}</div>
                  {report.signals.map((signal, index) => (
                    <div key={`${signal.title}-${index}`} className="rounded-xl border hairline p-4 flex gap-3">
                      <span className={`h-9 w-9 rounded-xl grid place-items-center shrink-0 ${signal.severity === "high" || signal.severity === "critical" ? "bg-warning/10 text-warning" : "brand-soft-bg brand-text"}`}>
                        {signal.severity === "low" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                      </span>
                      <div><strong className="text-sm">{signal.title}</strong><p className="text-sm muted leading-7 mt-1">{signal.description}</p></div>
                    </div>
                  ))}
                </section>
                <section className="rounded-2xl soft-bg p-4">
                  <div className="eyebrow">{t("integrity.whatFix")}</div>
                  <ol className="space-y-2 mt-3">{report.recommendations.map((item, index) => <li key={item} className="rounded-xl bg-[var(--panel)] border hairline p-3 text-sm leading-7 flex gap-2"><span className="brand-text font-bold">{index + 1}</span><span>{item}</span></li>)}</ol>
                </section>
              </div>
            )}

            {tab === "sentences" && (
              <div className="space-y-2 max-h-[46vh] overflow-auto pe-1" role="tabpanel">
                {report.sentenceBreakdown.map((sentence, index) => (
                  <div key={index} className={`rounded-xl border p-3 ${sentence.highlightColor === "red" ? "border-danger/25 bg-danger/8" : sentence.highlightColor === "orange" ? "border-warning/25 bg-warning/8" : "hairline"}`}>
                    <div className="flex items-start gap-3 justify-between"><p className="text-sm leading-7" dir="auto">{sentence.text}</p><span className="rounded-full soft-bg px-2 py-1 text-[11px] font-semibold shrink-0">{t("integrity.review")} {sentence.styleRiskScore}</span></div>
                    {sentence.reasons.length > 0 && <div className="mt-2"><div className="text-[11px] font-semibold muted">{t("integrity.whyFlagged")}</div><div className="flex flex-wrap gap-1.5 mt-1">{sentence.reasons.map((reason) => <span key={reason} className="rounded-full soft-bg px-2.5 py-1 text-[11px] muted">{reason}</span>)}</div></div>}
                  </div>
                ))}
              </div>
            )}

            {tab === "patterns" && (
              <div className="grid md:grid-cols-2 gap-3" role="tabpanel">
                {report.detectedClichés.map((item) => <div key={item.phrase} className="rounded-xl border hairline p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm" dir="auto">{item.phrase}</strong><span className="text-xs muted">×{item.occurrences}</span></div><div className="text-xs muted mt-2">{t(`integrity.category.${item.category}`)}</div></div>)}
                {!report.detectedClichés.length && <div className="md:col-span-2 rounded-xl brand-soft-bg p-5 text-sm font-semibold flex items-center gap-2"><CheckCircle2 size={17} /> {t("integrity.noCliches")}</div>}
              </div>
            )}
          </>
        )}
      </div>

      {!report && !loading && (
        <div className="rounded-2xl border border-dashed hairline p-10 text-center">
          <ShieldCheck size={28} className="mx-auto brand-text" />
          <h3 className="font-bold mt-3">{t("integrity.trustFirst")}</h3>
          <p className="text-sm muted leading-7 mt-2 max-w-xl mx-auto">{t("integrity.trustDescription")}</p>
        </div>
      )}

      <section className="rounded-2xl border hairline p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-3">
          <History size={18} className="brand-text shrink-0 mt-1" />
          <div><h3 className="text-sm font-semibold">{t("integrity.processTitle")}</h3><p className="text-xs muted leading-6 mt-1">{t("integrity.processDesc")}</p></div>
        </div>
        {onOpenTimeline && <Button variant="outline" onClick={onOpenTimeline}><History size={15} />{t("integrity.openTimeline")}</Button>}
      </section>
    </DialogShell>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return <div className="rounded-2xl border hairline p-4 bg-[var(--panel)]"><div className="flex items-center justify-between gap-2"><span className="text-xs muted">{label}</span><Icon size={14} className="brand-text" /></div><div className="text-2xl font-bold mt-3 mono-number">{value}</div></div>;
}

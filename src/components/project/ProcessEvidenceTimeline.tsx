import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookOpenCheck,
  Bot,
  CheckCircle2,
  Download,
  FilePenLine,
  GitCommitHorizontal,
  GraduationCap,
  History,
  Printer,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import type { ProcessEvidenceKind, ProcessEvidenceReport, ProcessEvidenceVerification, ProjectDNA } from "../../types";
import { api } from "../../lib/api";
import { formatDateTime, useI18n } from "../../lib/i18n";
import { localizedUiError } from "../../lib/ui-error";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { AcademicLoader, InlineLoader } from "../ui/AcademicLoader";

const KIND_ICON: Partial<Record<ProcessEvidenceKind, React.ElementType>> = {
  draft: FilePenLine,
  revision: GitCommitHorizontal,
  viva: GraduationCap,
  source_check: BookOpenCheck,
  ai_assist: Bot,
};

const FILTERS: Array<ProcessEvidenceKind | "all"> = ["all", "draft", "revision", "viva", "source_check", "ai_assist"];

/** Authorship-evidence timeline with a signed, printable "Process Evidence" report. */
export function ProcessEvidenceTimeline({ project }: { project: ProjectDNA }) {
  const { t, locale, formatNumber } = useI18n();
  const [report, setReport] = useState<ProcessEvidenceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<ProcessEvidenceKind | "all">("all");
  const [verification, setVerification] = useState<ProcessEvidenceVerification | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [printing, setPrinting] = useState(false);

  function load() {
    setLoading(true);
    setError("");
    setVerification(null);
    api
      .processEvidence(project.id)
      .then((r) => setReport(r.report))
      .catch((e) => setError(localizedUiError(e, t, "pe.loadError")))
      .finally(() => setLoading(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [project.id]);

  useEffect(() => {
    if (!printing) return;
    document.body.classList.add("pe-printing");
    const done = () => {
      document.body.classList.remove("pe-printing");
      setPrinting(false);
    };
    window.addEventListener("afterprint", done, { once: true });
    const timer = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", done);
      document.body.classList.remove("pe-printing");
    };
  }, [printing]);

  const entries = useMemo(
    () => (report?.entries || []).filter((entry) => filter === "all" || entry.kind === filter).slice().reverse(),
    [report, filter],
  );

  async function verify() {
    if (!report) return;
    setVerifying(true);
    try {
      setVerification((await api.verifyProcessEvidence({ report })).verification);
    } catch (e) {
      setError(localizedUiError(e, t, "pe.verifyError"));
    } finally {
      setVerifying(false);
    }
  }

  function downloadJson() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `process-evidence-${report.projectId}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const verifyUrl = report
    ? `${window.location.origin}/verify-evidence?h=${report.integrity.contentHash}&s=${report.integrity.signature}`
    : "";

  if (loading)
    return (
      <div className="min-h-64 grid place-items-center">
        <AcademicLoader size={40} label={t("app.loading")} />
      </div>
    );

  return (
    <div className="space-y-5">
      <Card>
        <CardContent>
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="flex gap-3 min-w-0">
              <span className="h-11 w-11 rounded-2xl tone-tile shrink-0"><History size={19} /></span>
              <div>
                <div className="eyebrow">{t("pe.eyebrow")}</div>
                <h2 className="section-title mt-1">{t("pe.title")}</h2>
                <p className="body-copy mt-2 max-w-3xl">{t("pe.description")}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={load}><RefreshCw size={15} />{t("pe.refresh")}</Button>
              <Button variant="outline" onClick={downloadJson} disabled={!report}><Download size={15} />{t("pe.downloadJson")}</Button>
              <Button onClick={() => setPrinting(true)} disabled={!report}><Printer size={15} />{t("pe.print")}</Button>
            </div>
          </div>
          {error && <div role="alert" className="mt-4 rounded-xl border border-danger/20 bg-danger/10 p-3 text-sm text-danger">{error}</div>}
        </CardContent>
      </Card>

      {report && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" aria-label={t("pe.summary")}>
            {([
              ["pe.drafts", report.summary.drafts],
              ["pe.revisions", report.summary.revisions],
              ["pe.vivaAnswers", report.summary.vivaAnswers],
              ["pe.sourceChecks", report.summary.sourceChecks],
              ["pe.aiAssists", report.summary.aiAssists],
              ["pe.activeDays", report.summary.activeDays],
            ] as const).map(([key, value]) => (
              <div key={key} className="rounded-2xl border hairline bg-[var(--panel)] p-4">
                <div className="text-xs muted">{t(key)}</div>
                <div className="text-2xl font-semibold mt-2 mono-number">{formatNumber(value)}</div>
              </div>
            ))}
          </section>

          <Card>
            <CardContent>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t("pe.filter")}>
                {FILTERS.map((kind) => (
                  <button
                    key={kind}
                    aria-pressed={filter === kind}
                    onClick={() => setFilter(kind)}
                    className={`focus-ring rounded-full px-3 py-1.5 text-xs font-semibold ${filter === kind ? "brand-soft-bg brand-text" : "soft-bg muted"}`}
                  >
                    {t(`pe.kind.${kind}`)}
                  </button>
                ))}
              </div>
              {entries.length ? (
                <ol className="mt-5 relative border-s hairline ms-2 space-y-4">
                  {entries.map((entry) => {
                    const Icon = KIND_ICON[entry.kind] || CheckCircle2;
                    return (
                      <li key={entry.id} className="ms-5">
                        <span className="absolute -start-[11px] mt-1 h-5 w-5 rounded-full brand-soft-bg grid place-items-center" aria-hidden="true">
                          <Icon size={11} className="brand-text" />
                        </span>
                        <div className="flex flex-wrap items-center gap-2 text-xs muted">
                          <time dateTime={entry.at}>{formatDateTime(entry.at, locale)}</time>
                          <span className="rounded-full soft-bg px-2 py-0.5 font-semibold">{t(`pe.kind.${entry.kind}`)}</span>
                          <span>{t(`pe.actor.${entry.actorType}`)}</span>
                          {typeof entry.version === "number" && <span className="mono-number">v{formatNumber(entry.version)}</span>}
                        </div>
                        <div className="text-sm font-semibold mt-1"><bdi>{entry.title}</bdi></div>
                        <p className="text-sm muted leading-7" dir="auto">{entry.detail}</p>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="body-copy mt-5">{t("pe.empty")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="eyebrow">{t("pe.integrity")}</div>
                  <div className="text-lg font-semibold mt-1 mono-number" dir="ltr">{report.integrity.verificationCode}</div>
                  <div className="text-xs muted mt-1 break-all" dir="ltr">SHA-256 {report.integrity.contentHash}</div>
                  <p className="text-xs muted mt-2 leading-6">{t("pe.integrityHint")}</p>
                </div>
                <Button variant="outline" onClick={verify} disabled={verifying}>
                  {verifying ? <InlineLoader size={15} /> : <ShieldCheck size={15} />}
                  {t("pe.verifyNow")}
                </Button>
              </div>
              {verification && (
                <div role="status" className={`mt-4 rounded-xl p-3 text-sm flex gap-2 ${verification.status === "valid" ? "brand-soft-bg" : "bg-warning/10 text-warning"}`}>
                  {verification.status === "valid" ? <ShieldCheck size={16} className="shrink-0 mt-0.5" /> : <ShieldAlert size={16} className="shrink-0 mt-0.5" />}
                  {t(`pe.status.${verification.status}`)}
                </div>
              )}
            </CardContent>
          </Card>

          {printing && createPortal(<ProcessEvidencePrint report={report} verifyUrl={verifyUrl} />, document.body)}
        </>
      )}
    </div>
  );
}

function ProcessEvidencePrint({ report, verifyUrl }: { report: ProcessEvidenceReport; verifyUrl: string }) {
  const { t, locale, meta, formatNumber } = useI18n();
  return (
    <div className="pe-print academic-text" dir={meta.dir} lang={locale}>
      <header>
        <div className="pe-print__brand">AcademicOS · {t("pe.eyebrow")}</div>
        <h1>{t("pe.printTitle")}</h1>
        <p><bdi>{report.projectTitle}</bdi> · <bdi>{report.course}</bdi></p>
        <p>{t("pe.generatedAt")}: {formatDateTime(report.generatedAt, locale)}</p>
      </header>
      <table className="pe-print__summary">
        <tbody>
          <tr>
            <th>{t("pe.drafts")}</th><td>{formatNumber(report.summary.drafts)}</td>
            <th>{t("pe.revisions")}</th><td>{formatNumber(report.summary.revisions)}</td>
            <th>{t("pe.vivaAnswers")}</th><td>{formatNumber(report.summary.vivaAnswers)}</td>
          </tr>
          <tr>
            <th>{t("pe.sourceChecks")}</th><td>{formatNumber(report.summary.sourceChecks)}</td>
            <th>{t("pe.aiAssists")}</th><td>{formatNumber(report.summary.aiAssists)}</td>
            <th>{t("pe.activeDays")}</th><td>{formatNumber(report.summary.activeDays)}</td>
          </tr>
        </tbody>
      </table>
      <table className="pe-print__entries">
        <thead>
          <tr><th>{t("pe.colTime")}</th><th>{t("pe.colKind")}</th><th>{t("pe.colEvent")}</th></tr>
        </thead>
        <tbody>
          {report.entries.map((entry) => (
            <tr key={entry.id}>
              <td>{formatDateTime(entry.at, locale)}</td>
              <td>{t(`pe.kind.${entry.kind}`)}</td>
              <td><strong><bdi>{entry.title}</bdi></strong><div dir="auto">{entry.detail}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
      <footer>
        <p><strong>{t("pe.integrity")}:</strong> <span dir="ltr">{report.integrity.verificationCode}</span></p>
        <p dir="ltr" className="pe-print__mono">SHA-256 {report.integrity.contentHash}</p>
        <p className="pe-print__mono">{t("pe.signature")}: <span dir="ltr">{report.integrity.signature}</span> · {t("pe.keyId")}: <span dir="ltr">{report.integrity.keyId}</span></p>
        <p>{t("pe.printVerify")}</p>
        <p dir="ltr" className="pe-print__mono">{verifyUrl}</p>
        <p>{t("pe.disclaimer")}</p>
      </footer>
    </div>
  );
}

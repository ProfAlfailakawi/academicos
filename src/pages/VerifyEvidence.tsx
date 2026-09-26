import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ShieldAlert, ShieldCheck, Upload } from "lucide-react";
import { api } from "../lib/api";
import type { ProcessEvidenceReport, ProcessEvidenceVerification } from "../types";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { useI18n } from "../lib/i18n";
import { localizedUiError } from "../lib/ui-error";
import { InlineLoader } from "../components/ui/AcademicLoader";

/** Public verifier for printed / exported Process Evidence reports. */
export function VerifyEvidence() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const [hash, setHash] = useState(params.get("h") || "");
  const [signature, setSignature] = useState(params.get("s") || "");
  const [report, setReport] = useState<ProcessEvidenceReport | null>(null);
  const [result, setResult] = useState<ProcessEvidenceVerification | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function verify(body: { report?: ProcessEvidenceReport; contentHash?: string; signature?: string }) {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult((await api.verifyProcessEvidence(body)).verification);
    } catch (e) {
      setError(localizedUiError(e, t, "pe.verifyError"));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (params.get("h") && params.get("s")) void verify({ contentHash: params.get("h")!, signature: params.get("s")! });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onFile(file?: File | null) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as ProcessEvidenceReport;
      setReport(parsed);
      setHash(parsed.integrity?.contentHash || "");
      setSignature(parsed.integrity?.signature || "");
      await verify({ report: parsed });
    } catch {
      setError(t("pe.invalidFile"));
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] p-4 md:p-10">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-xs muted">AcademicOS</Link>
        <div className="mt-10 h-12 w-12 rounded-2xl tone-tile"><ShieldCheck size={20} /></div>
        <h1 className="text-3xl font-semibold mt-4">{t("pe.verifyTitle")}</h1>
        <p className="body-copy mt-3">{t("pe.verifyIntro")}</p>
        <Card className="mt-8">
          <CardContent className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold">SHA-256</span>
              <input className="field mt-1.5 font-mono" dir="ltr" value={hash} onChange={(e) => setHash(e.target.value.trim())} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold">{t("pe.signature")}</span>
              <input className="field mt-1.5 font-mono" dir="ltr" value={signature} onChange={(e) => setSignature(e.target.value.trim())} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => verify(report ? { report } : { contentHash: hash, signature })} disabled={busy || (!report && (!hash || !signature))}>
                {busy ? <InlineLoader size={15} /> : <ShieldCheck size={15} />}{t("pe.verifyNow")}
              </Button>
              <label className="inline-flex items-center gap-2 rounded-lg border hairline px-3 py-2 text-xs font-semibold cursor-pointer focus-within:ring-2">
                <Upload size={15} />{t("pe.uploadJson")}
                <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
              </label>
            </div>
            {error && <div role="alert" className="rounded-xl bg-danger/10 text-danger p-3 text-sm">{error}</div>}
            {result && (
              <div role="status" className={`rounded-xl p-4 text-sm flex gap-2 ${result.status === "valid" ? "brand-soft-bg" : "bg-warning/10 text-warning"}`}>
                {result.status === "valid" ? <ShieldCheck size={17} className="shrink-0" /> : <ShieldAlert size={17} className="shrink-0" />}
                <div>
                  <div className="font-semibold">{t(`pe.status.${result.status}`)}</div>
                  {report && <div className="text-xs mt-1"><bdi>{report.projectTitle}</bdi> · <bdi>{report.course}</bdi></div>}
                  {!report && result.status === "valid" && <div className="text-xs mt-1">{t("pe.signatureOnly")}</div>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-xs muted mt-6 leading-6">{t("pe.disclaimer")}</p>
      </div>
    </main>
  );
}

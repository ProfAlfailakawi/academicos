import React, { useEffect, useMemo, useState } from "react";
import { Fingerprint, Download, ShieldCheck, FileCheck2, BrainCircuit, Copy, Check, LoaderCircle, ExternalLink, AlertTriangle, History } from "lucide-react";
import type { EvidenceCapsule, ProjectDNA } from "../../types";
import { api } from "../../lib/api";
import { formatDateTime, useI18n } from "../../lib/i18n";
import { Button } from "../ui/button";

interface CapsuleVerification {
  hashValid: boolean;
  signatureValid: boolean | null;
  signerTrusted: boolean | null;
  status: "signed_trusted" | "signed_untrusted" | "hash_valid" | "invalid";
  keyId?: string;
}

export function AcademicDossierModal({ project, onClose }: { project: ProjectDNA; onClose: () => void }) {
  const { locale, t } = useI18n();
  const [capsule, setCapsule] = useState<EvidenceCapsule | null>(null);
  const [verification, setVerification] = useState<CapsuleVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setError("");
      try {
        const response = await api.evidenceCapsule(project.id);
        const checked = await api.verifyEvidenceCapsule(response.capsule);
        if (active) { setCapsule(response.capsule); setVerification(checked.verification); }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : t("dossier.errorBuild"));
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [project.id, t]);

  async function createReviewLink() {
    setSharing(true); setError("");
    try {
      const response = await api.createShare({ kind: "project", targetId: project.id, label: `${t("ui.evidenceCapsule")} · ${project.title}`, watermark: `AcademicOS · ${t("ui.evidenceCapsule")}` });
      const url = new URL(response.url, window.location.origin).toString();
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (e) { setError(e instanceof Error ? e.message : t("dossier.errorShare")); }
    finally { setSharing(false); }
  }

  async function copyHash() {
    if (!capsule) return;
    await navigator.clipboard.writeText(capsule.integrity.hash);
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  const verifyLabel = useMemo(() => verification?.status === "signed_trusted"
    ? t("dossier.signedTrusted")
    : verification?.status === "signed_untrusted"
      ? t("dossier.signedUntrusted")
      : verification?.status === "hash_valid"
        ? t("dossier.hashValid")
        : verification?.status === "invalid"
          ? t("dossier.invalid")
          : t("dossier.verifying"), [verification?.status, t]);
  const verificationGood = verification && verification.status !== "invalid";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl border hairline bg-[var(--panel)] shadow-2xl p-6 md:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4 border-b hairline pb-5">
          <div className="flex items-center gap-3"><div className="h-12 w-12 rounded-2xl brand-soft-bg grid place-items-center text-indigo-600 shrink-0"><Fingerprint size={26}/></div><div><div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">{t("ui.evidenceCapsule")}</div><h2 className="text-xl md:text-2xl font-bold tracking-tight mt-0.5">{t("dossier.title")}</h2><p className="text-[11px] text-muted-foreground mt-1">{t("dossier.description")}</p></div></div>
          <div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={() => window.print()}><Download size={15}/>{t("common.print")}</Button><Button size="sm" variant="ghost" onClick={onClose}>{t("common.close")}</Button></div>
        </div>

        {loading && <div className="min-h-56 grid place-items-center"><div className="text-center"><LoaderCircle className="animate-spin mx-auto brand-text"/><p className="text-xs text-muted-foreground mt-3">{t("dossier.building")}</p></div></div>}
        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs flex gap-2"><AlertTriangle size={15} className="text-red-600 shrink-0"/><span>{error}</span></div>}

        {capsule && !loading && (
          <>
            <div className="rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-b from-indigo-50/40 to-transparent dark:from-indigo-950/20 p-6 space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b hairline">
                <div><span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${verificationGood ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}><ShieldCheck size={13}/>{verifyLabel}</span><h3 className="text-lg font-bold mt-2">{capsule.project.title}</h3><p className="text-xs text-muted-foreground mt-0.5">{capsule.project.course} · {t("dossier.updated")} {formatDateTime(capsule.project.updatedAt, locale)}</p></div>
                <button onClick={copyHash} className="text-start font-mono text-[10px] bg-white dark:bg-black/40 p-3 rounded-xl border hairline max-w-full"><div className="text-muted-foreground mb-1">SHA-256 · {t("dossier.copyHash")}</div><div className="font-bold text-indigo-600 break-all ltr">{capsule.integrity.hash}</div></button>
              </div>

              <div className="grid sm:grid-cols-4 gap-3">
                <Metric icon={<FileCheck2 size={15}/>} label={t("dossier.evidenceItems")} value={capsule.provenance.evidenceItems} detail={`${capsule.provenance.verifiedEvidenceItems} ${t("dossier.markedVerified")}`} />
                <Metric icon={<History size={15}/>} label={t("ui.artifacts")} value={capsule.provenance.artifacts} detail={`${capsule.provenance.canonicalArtifacts} ${t("ui.canonical")}`} />
                <Metric icon={<BrainCircuit size={15}/>} label={t("dossier.aiRuns")} value={capsule.provenance.aiAssistedRuns} detail={t("dossier.aiDisclosure")}/>
                <Metric icon={<ShieldCheck size={15}/>} label={t("dossier.learningProofs")} value={capsule.proofOfLearning.length} detail={`Viva / ${t("ui.proofOfLearning")}`} />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <section className="rounded-xl border hairline bg-[var(--bg)] p-4"><div className="text-xs font-bold mb-3">{t("dossier.rubricState")}</div><div className="space-y-2">{capsule.rubric.length ? capsule.rubric.map((item, i) => <div key={`${item.title}-${i}`} className="flex items-start justify-between gap-3 text-[11px]"><span>{item.title}</span><span className="text-muted-foreground shrink-0">{item.readiness || t("dossier.notEvidenced")}{item.weighting ? ` · ${item.weighting}%` : ""}</span></div>) : <div className="text-[11px] text-muted-foreground">{t("dossier.noRubric")}</div>}</div></section>
                <section className="rounded-xl border hairline bg-[var(--bg)] p-4"><div className="text-xs font-bold mb-3">{t("dossier.learningProofs")}</div><div className="space-y-2">{capsule.proofOfLearning.length ? capsule.proofOfLearning.slice(0,6).map((item) => <div key={item.id} className="text-[11px] leading-5"><strong>{item.source}</strong><div className="text-muted-foreground">{item.summary}</div></div>) : <div className="text-[11px] text-muted-foreground">{t("dossier.noLearningProof")}</div>}</div></section>
              </div>

              <div className="rounded-xl border hairline bg-[var(--bg)] p-4 text-xs leading-6"><strong>{t("dossier.disclosure")}:</strong> {capsule.disclosure}</div>

              <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 p-4 space-y-3">
                <div><div className="text-xs font-bold text-indigo-950 dark:text-indigo-200">{t("dossier.reviewLink")}</div><p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-1">{t("dossier.reviewLinkDesc")}</p></div>
                <div className="flex flex-col sm:flex-row gap-2"><Button size="sm" onClick={createReviewLink} disabled={sharing}>{sharing ? <LoaderCircle size={14} className="animate-spin"/> : <ExternalLink size={14}/>} {t("dossier.createReviewLink")}</Button><Button size="sm" variant="outline" onClick={() => api.exportEvidenceCapsule(project.id)}><Download size={14}/> {t("dossier.download")}</Button></div>
                {shareUrl && <div className="rounded-lg bg-white/70 dark:bg-black/20 p-2 text-[10px] break-all ltr flex gap-2 items-center"><span className="flex-1">{shareUrl}</span>{copied && <Check size={13} className="text-emerald-500 shrink-0"/>}</div>}
              </div>
            </div>
            <div className="flex justify-between items-center gap-4 text-[10px] text-muted-foreground pt-2"><span>AcademicOS {t("ui.evidenceCapsule")} v{capsule.schemaVersion}</span><span>SHA-256{capsule.integrity.signatureStatus === "signed" ? " · Ed25519" : ` · ${t("ui.hashOnly")}`} · {t("ui.traceability")} · {t("ui.proofOfLearning")}</span></div>
          </>
        )}
      </div>
    </div>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: number; detail: string }) {
  return <div className="rounded-xl border hairline bg-[var(--bg)] p-4"><div className="flex items-center gap-2 text-indigo-600 text-[11px] font-semibold">{icon}{label}</div><div className="text-2xl font-bold font-mono mt-2">{value}</div><p className="text-[10px] text-muted-foreground mt-1">{detail}</p></div>;
}

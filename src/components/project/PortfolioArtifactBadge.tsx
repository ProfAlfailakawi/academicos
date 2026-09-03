import { localizedUiError } from "../../lib/ui-error";
import React, { useEffect, useState } from "react";
import { Award, Share2, Briefcase, Copy, Check, ShieldCheck, LoaderCircle, ExternalLink, AlertTriangle } from "lucide-react";
import type { EvidenceCapsule, ProjectDNA } from "../../types";
import { api } from "../../lib/api";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { useI18n } from "../../lib/i18n";
import { runtimeEnumLabel } from "../../lib/platform-locale";

export function PortfolioArtifactBadge({ project }: { project: ProjectDNA }) {
  const { t, locale } = useI18n();
  const [capsule, setCapsule] = useState<EvidenceCapsule | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { let active = true; api.evidenceCapsule(project.id).then((r) => { if (active) setCapsule(r.capsule); }).catch((e) => { if (active) setError(localizedUiError(e, t, "portfolio.loadError")); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [project.id]);
  async function createShare() {
    setSharing(true); setError("");
    try {
      const r = await api.createShare({
        kind: "project",
        targetId: project.id,
        label: `${t("ui.portfolioProof")} · ${project.title}`,
        watermark: `AcademicOS · ${t("ui.portfolioProof")}`,
      });

      const url = new URL(r.url, window.location.origin).toString();
      setShareUrl(url);

      if (!navigator.clipboard?.writeText) {
        setError(t("portfolio.shareError"));
        return;
      }

      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
    catch (e) {
      console.error("Failed to create/copy portfolio share", e);
      setError(localizedUiError(e, t, "portfolio.shareError"));
    }
    finally { setSharing(false); }
  }
  const skills = [...new Set([...(project.requiredSkills || []), ...(capsule?.skills.map((s) => s.skill) || [])])].filter(Boolean).slice(0, 8);
  const completedDeliverables = capsule?.deliverables.filter((d) => d.status === "completed" || d.status === "ready").length || 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border hairline bg-gradient-to-r from-info/10 via-info/8 to-transparent p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5"><div className="h-11 w-11 rounded-2xl bg-info/20 text-info grid place-items-center shrink-0"><Award size={22}/></div><div><div className="text-[10px] font-bold tracking-wider uppercase text-info">{t("ui.portfolioProof")}</div><h2 className="text-lg md:text-xl font-bold tracking-tight mt-0.5">{t("portfolio.title")}</h2><p className="text-[11px] text-muted-foreground mt-1">{t("portfolio.description")}</p></div></div>
        <Button size="sm" onClick={createShare} disabled={sharing}>{sharing ? <LoaderCircle size={14} className="animate-spin"/> : <Share2 size={14}/>}{t("portfolio.createLink")}</Button>
      </div>
      {error && <div className="rounded-xl border border-warning/20 bg-warning/8 p-3 text-xs flex gap-2"><AlertTriangle size={14} className="text-warning shrink-0"/>{error}</div>}
      {loading ? <div className="min-h-40 grid place-items-center"><LoaderCircle className="animate-spin text-info"/></div> : (
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
          <div className="rounded-3xl border-2 hairline bg-gradient-to-b from-[var(--panel)] to-[var(--bg)] p-6 md:p-8 space-y-6 shadow-xl">
            <div className="flex items-start justify-between gap-3"><div><span className="text-[10px] font-mono uppercase text-muted-foreground">{t("ui.projectEvidenceArtifact")}</span><h3 className="text-base font-bold mt-1">{project.title}</h3><p className="text-[11px] text-muted-foreground mt-1">{project.course} · {runtimeEnumLabel(project.status, locale)}</p></div><span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-info/10 text-info border border-info/20">{project.progress}% {t("ui.projectProgress")}</span></div>
            <div className="grid grid-cols-3 gap-2 text-center"><Metric label={t("portfolio.completedDeliverables")} value={completedDeliverables}/><Metric label={t("ui.evidence")} value={capsule?.provenance.evidenceItems || 0}/><Metric label={t("ui.proofOfLearning")} value={capsule?.proofOfLearning.length || 0}/></div>
            <div><div className="text-xs font-bold flex items-center gap-1.5"><Briefcase size={14} className="text-info"/>{t("portfolio.skills")}</div><div className="grid gap-2 mt-3">{skills.length ? skills.map((skill) => <div key={skill} className="flex items-center gap-2 p-2.5 rounded-xl border hairline bg-[var(--panel)] text-xs"><Check size={14} className="text-info shrink-0"/><span>{skill}</span></div>) : <div className="text-[11px] text-muted-foreground">{t("portfolio.noSkills")}</div>}</div></div>
            {capsule && <div className="rounded-xl border hairline bg-[var(--panel)] p-3 text-[10px] leading-5"><div className="flex items-center gap-1.5 font-semibold text-info"><ShieldCheck size={13}/>{t("portfolio.integrity")}</div><div className="mt-1 text-muted-foreground">{t("ui.evidenceCapsuleSha")}: <span className="font-mono break-all ltr">{capsule.integrity.hash}</span></div></div>}
          </div>
          <Card className="rounded-3xl border hairline bg-[var(--panel)]"><CardContent className="p-6 md:p-7 space-y-5"><div><h4 className="text-sm font-bold">{t("portfolio.responsibleShare")}</h4><p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t("portfolio.shareDesc")}</p></div><div className="space-y-3 text-xs"><Info title={t("ui.cvLinkedIn")} text={t("portfolio.cvInfo")}/><Info title={t("portfolio.gradTitle")} text={t("portfolio.gradInfo")}/><Info title={t("portfolio.privacyTitle")} text={t("portfolio.privacyInfo")}/></div>{shareUrl ? <div className="space-y-2"><div className="rounded-lg border hairline p-2 text-[10px] break-all ltr">{shareUrl}</div><Button variant="outline" className="w-full" onClick={async () => {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable");
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  } catch (e) {
    setError(localizedUiError(e, t, "portfolio.shareError"));
  }
}}>{copied ? <Check size={14} className="text-success"/> : <Copy size={14}/>} {copied ? t("portfolio.copied") : t("portfolio.copyLink")}</Button><Button asChild variant="ghost" className="w-full"><a href={shareUrl} target="_blank" rel="noreferrer"><ExternalLink size={14}/>{t("portfolio.openLink")}</a></Button></div> : <Button className="w-full bg-info hover:bg-info text-white" onClick={createShare} disabled={sharing}><Share2 size={14}/>{t("portfolio.createShare")}</Button>}</CardContent></Card>
        </div>
      )}
    </div>
  );
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border hairline bg-[var(--panel)] p-3"><div className="font-bold text-lg">{value}</div><div className="text-[9px] text-muted-foreground mt-1">{label}</div></div>; }
function Info({ title, text }: { title: string; text: string }) { return <div className="p-3.5 rounded-xl border hairline bg-[var(--bg)]"><span className="font-bold">{title}</span><p className="text-muted-foreground text-[11px] mt-1 leading-5">{text}</p></div>; }

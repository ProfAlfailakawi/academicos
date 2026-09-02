import { localizedUiError } from "../../lib/ui-error";
import React, { useState } from "react";
import { ArrowRightLeft, Check, Copy, RefreshCw, ShieldCheck, AlertTriangle, BookMarked } from "lucide-react";
import type { AcademicSourceRecord, ProjectDNA } from "../../types";
import { api, ApiError } from "../../lib/api";
import { Button } from "../ui/button";
import { useI18n } from "../../lib/i18n";

type AcademicStyle = "apa7" | "harvard" | "ieee" | "mla9" | "chicago";
const STYLE_NAME: Record<AcademicStyle, string> = { apa7: "APA 7", harvard: "Harvard", ieee: "IEEE", mla9: "MLA 9", chicago: "Chicago" };

function surname(name: string) { const parts = name.trim().split(/\s+/); return parts[parts.length - 1] || name; }
function authorsPlain(source: AcademicSourceRecord) { return source.authors.length ? source.authors.join(", ") : "Author unavailable"; }
function year(source: AcademicSourceRecord) { return source.year || "n.d."; }
function container(source: AcademicSourceRecord) { return source.containerTitle || ""; }
function formatted(source: AcademicSourceRecord, style: AcademicStyle) {
  const authors = authorsPlain(source), y = year(source), journal = container(source), doi = `https://doi.org/${source.doi}`;
  if (style === "apa7") return `${authors} (${y}). ${source.title}.${journal ? ` ${journal}.` : ""} ${doi}`;
  if (style === "harvard") return `${authors} (${y}) ‘${source.title}’${journal ? `, ${journal}` : ""}. Available at: ${doi}.`;
  if (style === "ieee") return `${authors}, “${source.title},”${journal ? ` ${journal},` : ""} ${y}, doi: ${source.doi}.`;
  if (style === "mla9") return `${authors}. “${source.title}.”${journal ? ` ${journal},` : ""} ${y}. ${doi}.`;
  return `${authors}. “${source.title}.”${journal ? ` ${journal}.` : ""} ${y}. ${doi}.`;
}
function inText(source: AcademicSourceRecord, style: AcademicStyle) {
  const lead = source.authors[0] ? surname(source.authors[0]) : "Author", y = year(source);
  if (style === "ieee") return "[1]";
  if (style === "mla9") return `(${lead})`;
  if (style === "chicago") return `${lead}, “${source.title}.”¹`;
  return `(${lead}, ${y})`;
}

export function CrossStyleFormatter({ project }: { project: ProjectDNA }) {
  const { t } = useI18n();
  const [selectedStyle, setSelectedStyle] = useState<AcademicStyle>((project.citationStyle?.toLowerCase().includes("ieee") ? "ieee" : project.citationStyle?.toLowerCase().includes("mla") ? "mla9" : project.citationStyle?.toLowerCase().includes("chicago") ? "chicago" : project.citationStyle?.toLowerCase().includes("harvard") ? "harvard" : "apa7"));
  const [doi, setDoi] = useState("");
  const [source, setSource] = useState<AcademicSourceRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function verifyAndFormat() {
    if (!doi.trim()) return;
    setLoading(true); setError(""); setSource(null);
    try { const response = await api.researchSourceDoi(doi.trim()); setSource(response.source); }
    catch (e) { setError(e instanceof ApiError && e.code === "DOI_NOT_FOUND" ? t("formatter.notFound") : localizedUiError(e, t, "formatter.verifyError")); }
    finally { setLoading(false); }
  }
  async function copyRef() {
    if (!source) return;
    setError("");
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error(t("formatter.copyError"));
      }
      await navigator.clipboard.writeText(formatted(source, selectedStyle));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (e) {
      setCopied(false);
      setError(localizedUiError(e, t, "formatter.copyError"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border hairline bg-gradient-to-r from-fuchsia-500/10 via-pink-500/5 to-transparent p-5 md:p-6 flex items-start gap-3.5">
        <div className="h-11 w-11 rounded-2xl bg-fuchsia-500/20 text-fuchsia-600 grid place-items-center shrink-0"><ArrowRightLeft size={22}/></div>
        <div><div className="text-[10px] font-bold tracking-wider uppercase text-fuchsia-600">{t("ui.verifiedMetadataFormatter")}</div><h2 className="text-lg md:text-xl font-bold tracking-tight mt-0.5">{t("formatter.title")}</h2><p className="text-[11px] text-muted-foreground mt-1 leading-5 max-w-2xl">{t("formatter.description")}</p></div>
      </div>

      <div className="rounded-2xl border hairline bg-[var(--panel)] p-5 space-y-3">
        <label className="text-xs font-semibold">{t("formatter.realDoi")}</label>
        <div className="flex flex-col sm:flex-row gap-2"><input value={doi} onChange={(e) => setDoi(e.target.value)} onKeyDown={(e) => e.key === "Enter" && verifyAndFormat()} placeholder={t("formatter.doiPh")} className="field flex-1 font-mono ltr"/><Button onClick={verifyAndFormat} disabled={loading || !doi.trim()}>{loading ? <RefreshCw size={14} className="animate-spin"/> : <ShieldCheck size={14}/>}{t("formatter.verifyFormat")}</Button></div>
        {error && <div className="text-[11px] text-amber-600 flex gap-2 items-start"><AlertTriangle size={14} className="shrink-0 mt-0.5"/>{error}</div>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">{(Object.keys(STYLE_NAME) as AcademicStyle[]).map((key) => <button key={key} onClick={() => setSelectedStyle(key)} className={`p-3.5 rounded-2xl border text-center transition-all ${selectedStyle === key ? "bg-fuchsia-600 text-white border-fuchsia-600 shadow-md" : "bg-[var(--panel)] hairline"}`}><div className="font-bold text-xs">{STYLE_NAME[key]}</div></button>)}</div>

      {source ? (
        <div className="rounded-2xl border hairline bg-[var(--panel)] p-5 space-y-5">
          <div className="flex items-start justify-between gap-3"><div><div className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-semibold"><Check size={12}/>{t("ui.crossrefMetadataMatched")}</div><h3 className="text-sm font-bold mt-1">{source.title}</h3><p className="text-[11px] text-muted-foreground mt-1">{authorsPlain(source)}{source.year ? ` · ${source.year}` : ""}{source.containerTitle ? ` · ${source.containerTitle}` : ""}</p></div><span className="font-mono text-[10px] text-muted-foreground ltr break-all max-w-[35%]">{source.doi}</span></div>
          <div className="grid md:grid-cols-2 gap-3"><div className="rounded-xl border hairline bg-[var(--bg)] p-4"><div className="flex items-center gap-2 text-[11px] font-semibold"><BookMarked size={14} className="text-fuchsia-600"/>{t("formatter.inText")} · {STYLE_NAME[selectedStyle]}</div><div className="mt-3 text-sm font-medium ltr">{inText(source, selectedStyle)}</div></div><div className="rounded-xl border hairline bg-[var(--bg)] p-4"><div className="text-[11px] font-semibold">{t("formatter.references")} · {STYLE_NAME[selectedStyle]}</div><p className="mt-3 text-xs leading-6 ltr">{formatted(source, selectedStyle)}</p></div></div>
          <Button variant="outline" onClick={copyRef}>{copied ? <Check size={14} className="text-emerald-500"/> : <Copy size={14}/>} {copied ? t("formatter.copied") : t("formatter.copyStyle").replace("{style}", STYLE_NAME[selectedStyle])}</Button>
        </div>
      ) : <div className="rounded-2xl border hairline p-7 text-center text-xs text-muted-foreground">{t("formatter.empty")}</div>}
    </div>
  );
}

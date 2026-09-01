import React, { useState } from "react";
import {
  Search,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Plus,
  ShieldCheck,
  AlertTriangle,
  Database,
  Link2,
} from "lucide-react";
import type { AcademicSourceRecord, ProjectDNA } from "../../types";
import { api, ApiError } from "../../lib/api";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { formatDateTime, useI18n } from "../../lib/i18n";

function apaCitation(source: AcademicSourceRecord, unknownAuthor: string) {
  const authorText = source.authors.length ? source.authors.join(", ") : unknownAuthor;
  const year = source.year ? ` (${source.year}).` : ".";
  const journal = source.containerTitle ? ` ${source.containerTitle}.` : "";
  return `${authorText}${year} ${source.title}.${journal} https://doi.org/${source.doi}`;
}

function bibtexCitation(source: AcademicSourceRecord) {
  const lead = (source.authors[0] || "source").replace(/[^a-z0-9]/gi, "").toLowerCase() || "source";
  return `@article{${lead}${source.year || ""},\n  title={${source.title}},\n  author={${source.authors.join(" and ")}},\n  journal={${source.containerTitle || ""}},\n  year={${source.year || ""}},\n  doi={${source.doi}}\n}`;
}

function errorMessage(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiError) {
    if (error.code === "DOI_NOT_FOUND") return t("source.doiNotFound");
    if (error.code === "CROSSREF_UNAVAILABLE" || error.code === "CROSSREF_UPSTREAM_ERROR")
      return t("source.unavailable");
    return error.message;
  }
  return error instanceof Error ? error.message : t("source.error");
}

export function LiveScholarVerifier({ project }: { project: ProjectDNA }) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState(project.title || "");
  const [activeTab, setActiveTab] = useState<"search" | "doiCheck">("search");
  const [doiInput, setDoiInput] = useState("");
  const [results, setResults] = useState<AcademicSourceRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [addingDoi, setAddingDoi] = useState<string | null>(null);
  const [addedDois, setAddedDois] = useState<Set<string>>(() => new Set());

  async function handleSearch() {
    const value = query.trim();
    if (value.length < 2) return;
    setSearching(true);
    setError("");
    setHasSearched(true);
    try {
      const response = await api.researchSourcesSearch(value);
      setResults(response.sources);
    } catch (e) {
      setResults([]);
      setError(errorMessage(e, t));
    } finally {
      setSearching(false);
    }
  }

  async function handleDoiCheck() {
    const value = doiInput.trim();
    if (!value) return;
    setSearching(true);
    setError("");
    setHasSearched(true);
    try {
      const response = await api.researchSourceDoi(value);
      setResults([response.source]);
    } catch (e) {
      setResults([]);
      setError(errorMessage(e, t));
    } finally {
      setSearching(false);
    }
  }

  async function copyCitation(source: AcademicSourceRecord, format: "apa" | "bibtex") {
    const text = format === "apa" ? apaCitation(source, t("source.unknownAuthor")) : bibtexCitation(source);
    await navigator.clipboard.writeText(text);
    const key = `${source.doi}-${format}`;
    setCopied(key);
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1800);
  }

  async function addToProject(source: AcademicSourceRecord) {
    setAddingDoi(source.doi);
    setError("");
    try {
      const detail = [
        `DOI: ${source.doi}`,
        source.authors.length ? `Authors: ${source.authors.join("; ")}` : "",
        source.year ? `Year: ${source.year}` : "",
        source.containerTitle ? `Container: ${source.containerTitle}` : "",
        source.issn?.length ? `ISSN: ${source.issn.join(", ")}` : "",
        "Crossref metadata record matched. This verifies bibliographic identity only; it does not prove that the source supports a specific claim.",
      ].filter(Boolean).join("\n");
      await api.addEvidence(project.id, {
        type: "source",
        title: source.title,
        detail,
        sourceUrl: source.url,
      });
      setAddedDois((current) => new Set(current).add(source.doi));
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setAddingDoi(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border hairline bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">Source Guardian</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20 flex items-center gap-1">
                <Database size={10} /> Crossref Live
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-bold tracking-tight mt-0.5">{t("source.title")}</h2>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-2xl leading-5">
              {t("source.description")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant={activeTab === "search" ? "default" : "outline"} onClick={() => { setActiveTab("search"); setError(""); }} className="text-xs">
            {t("source.searchTab")}
          </Button>
          <Button size="sm" variant={activeTab === "doiCheck" ? "default" : "outline"} onClick={() => { setActiveTab("doiCheck"); setError(""); }} className="text-xs">
            {t("source.doiTab")}
          </Button>
        </div>
      </div>

      {activeTab === "search" ? (
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder={t("source.searchPlaceholder")}
              className="w-full rounded-xl border hairline bg-[var(--panel)] pr-10 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>
          <Button onClick={handleSearch} disabled={searching || query.trim().length < 2} className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
            {searching ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />} {t("source.searchAction")}
          </Button>
        </div>
      ) : (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="text-xs font-semibold">{t("source.doiHint")}</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={doiInput}
                onChange={(e) => setDoiInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDoiCheck()}
                placeholder="10.xxxx/xxxxx · https://doi.org/…"
                className="flex-1 rounded-xl border hairline bg-[var(--bg)] px-3.5 py-2 text-xs font-mono ltr"
              />
              <Button size="sm" onClick={handleDoiCheck} disabled={searching || !doiInput.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {searching ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />} {t("source.verifyRecord")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-6 flex items-start gap-2">
          <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!hasSearched && !searching && (
        <div className="rounded-2xl border hairline bg-[var(--panel)] p-8 text-center">
          <Database size={28} className="mx-auto text-emerald-600 mb-3" />
          <div className="font-semibold text-sm">{t("source.emptyTitle")}</div>
          <p className="text-xs text-muted-foreground mt-2">{t("source.emptyDesc")}</p>
        </div>
      )}

      {hasSearched && !searching && !error && results.length === 0 && (
        <div className="rounded-2xl border hairline p-7 text-center text-xs text-muted-foreground">{t("source.noResults")}</div>
      )}

      <div className="space-y-4">
        {results.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{results.length} {t("source.records")}</span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 size={13} /> {t("source.identityOnly")}
            </span>
          </div>
        )}

        {results.map((source, index) => (
          <div key={source.doi} className="rounded-2xl border hairline bg-[var(--panel)] p-5 space-y-3.5 hover:border-emerald-500/40 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 size={11} /> Crossref record matched
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">{t("source.result")} #{index + 1}</span>
                  {typeof source.citedByCount === "number" && (
                    <span className="text-[11px] text-muted-foreground">Crossref cited-by: {source.citedByCount}</span>
                  )}
                  {!!source.licenseUrls?.length && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400">{t("source.licenseAvailable")}</span>
                  )}
                </div>
                <h3 className="text-sm md:text-base font-bold text-foreground leading-snug">{source.title}</h3>
                <div className="text-xs text-muted-foreground leading-5">
                  <span className="font-semibold">{source.authors.length ? source.authors.join(" · ") : t("source.authorUnavailable")}</span>
                  {source.year ? ` (${source.year})` : ""}
                  {source.containerTitle ? <> — <span className="italic text-foreground/80">{source.containerTitle}</span></> : null}
                </div>
              </div>
              <Button asChild size="sm" variant="outline" className="shrink-0 text-xs gap-1.5 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                <a href={source.url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> DOI</a>
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-[var(--bg)] border hairline p-2.5 font-mono ltr break-all">doi:{source.doi}</div>
              <div className="rounded-lg bg-[var(--bg)] border hairline p-2.5">
                {source.issn?.length ? `ISSN metadata: ${source.issn.join(", ")}` : t("source.noIssn")}
              </div>
            </div>

            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-[11px] leading-5 flex gap-2">
              <Link2 size={14} className="text-sky-600 shrink-0 mt-0.5" />
              <span><strong>Source Guardian:</strong> {t("source.guardianNote")}</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t hairline text-xs">
              <div className="text-[10px] text-muted-foreground">{t("source.metadataVerified")}: {formatDateTime(source.metadataVerifiedAt, locale)}</div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2.5" onClick={() => copyCitation(source, "apa")}>
                  {copied === `${source.doi}-apa` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />} {t("source.copyApa")}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2.5" onClick={() => copyCitation(source, "bibtex")}>
                  {copied === `${source.doi}-bibtex` ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />} BibTeX
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-[11px] px-3 bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                  disabled={addingDoi === source.doi || addedDois.has(source.doi)}
                  onClick={() => addToProject(source)}
                >
                  {addedDois.has(source.doi) ? <Check size={12} /> : addingDoi === source.doi ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                  {addedDois.has(source.doi) ? t("source.added") : t("source.add")}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useMemo, useState } from "react";
import { BookOpen, FileSearch, FlaskConical, GraduationCap, LoaderCircle, Network, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "../../lib/api";
import type { CopilotMode, CopilotResponse, ProjectDNA } from "../../types";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

const modes: Array<{ id: CopilotMode; label: string; icon: React.ElementType }> = [
  { id: "file_search", label: "File Search", icon: FileSearch },
  { id: "research", label: "Research", icon: BookOpen },
  { id: "assignment_compile", label: "Compiler", icon: FlaskConical },
  { id: "tutor", label: "Tutor", icon: Sparkles },
  { id: "workspace_function", label: "Functions", icon: Network },
  { id: "viva_live", label: "Live Viva", icon: GraduationCap },
];

export function ProjectCopilot({ project }: { project: ProjectDNA }) {
  const [mode, setMode] = useState<CopilotMode>("file_search");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<CopilotResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const placeholder = useMemo(() => {
    if (mode === "research") return "ما المصادر التي أحتاج التحقق منها؟";
    if (mode === "tutor") return "اشرح لي المفهوم الذي أحتاج فهمه لهذا المعيار";
    if (mode === "viva_live") return "اختبرني بسؤال دفاع عن الدليل";
    return "ابحث داخل المشروع أو اربط فكرة بالـ Rubric";
  }, [mode]);
  async function run() {
    setBusy(true);
    setError("");
    try {
      const response = await api.projectCopilot(project.id, { mode, query });
      setResult(response.copilot);
    } catch (e: any) {
      setError(e.message || "Copilot failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid xl:grid-cols-[.82fr_1.18fr] gap-5">
      <Card>
        <CardContent>
          <div className="flex items-center gap-2">
            <ShieldCheck size={17} className="brand-text" />
            <h2 className="section-title">Project Copilot</h2>
          </div>
          <p className="body-copy mt-2">AI يوجه الفهم، الأدلة، وRubric داخل ذاكرة المشروع فقط عند البحث المحلي.</p>
          <div className="grid grid-cols-2 gap-2 mt-5">
            {modes.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setMode(id)} className={`focus-ring rounded-xl border hairline p-3 text-xs font-semibold flex items-center gap-2 ${mode === id ? "brand-soft-bg" : "hover:bg-[var(--panel-2)]"}`}>
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
          <textarea value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} className="focus-ring mt-5 w-full min-h-32 rounded-xl border hairline bg-[var(--bg)] p-3 text-sm leading-7" />
          <Button onClick={run} disabled={busy} className="mt-3">
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
            شغّل Copilot
          </Button>
          {error && <p className="text-xs text-[var(--danger)] mt-3">{error}</p>}
        </CardContent>
      </Card>
      <div className="space-y-5">
        {result ? <CopilotResult result={result} /> : <Card><CardContent className="py-14 text-center"><Sparkles className="mx-auto brand-text" /><p className="body-copy mt-3">اختر وضعًا واكتب سؤالًا. كل نتيجة ستظهر مع citations وRubric/Evidence links.</p></CardContent></Card>}
      </div>
    </div>
  );
}

function CopilotResult({ result }: { result: CopilotResponse }) {
  return (
    <>
      <Card>
        <CardContent>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="eyebrow">{result.mode}</div>
              <h2 className="section-title mt-1">Guided Output</h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${result.controls.blocked ? "bg-[#f7eddd] text-[var(--warning)]" : "brand-soft-bg"}`}>{result.controls.provider}</span>
          </div>
          <p className="body-copy whitespace-pre-wrap mt-4">{result.answer}</p>
          <div className="mt-5 grid sm:grid-cols-2 gap-2">
            {result.guidance.map((item) => <div key={item} className="rounded-xl soft-bg p-3 text-xs leading-6">{item}</div>)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <h2 className="section-title">Citations & Controls</h2>
          <div className="mt-4 space-y-2">{result.citations.slice(0, 8).map((citation) => <div key={citation.id} className="rounded-xl border hairline p-3"><div className="flex justify-between gap-3 text-xs"><span className="font-semibold">{citation.title}</span><span className="muted">{citation.sourceType} · {citation.trust}</span></div>{citation.quote && <p className="text-[11px] leading-5 muted mt-2">{citation.quote}</p>}</div>)}</div>
          <div className="mt-5 grid sm:grid-cols-3 gap-2 text-[10px] muted">
            <div>Flag: {result.controls.featureFlag}</div>
            <div>Grounded: {result.controls.grounded ? "yes" : "no"}</div>
            <div>Run: {result.observability.runId}</div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

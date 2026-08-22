import React, { useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft,
  BookOpenCheck,
  Check,
  FileHeart,
  FilePenLine,
  FileText,
  Languages,
  LoaderCircle,
  Mic2,
  Paperclip,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import type { AcademicAssistanceMode, AcademicWorkMode } from "../types";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";

const MAX = 20 * 1024 * 1024;

export function UploadAssignment() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const initialMode = params.get("mode") === "rescue" ? "rescue" : "write";
  const [mode, setMode] = useState<AcademicWorkMode>(initialMode);
  const [assignmentText, setAssignmentText] = useState("");
  const [draftText, setDraftText] = useState("");
  const [assignmentFiles, setAssignmentFiles] = useState<File[]>([]);
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [language, setLanguage] = useState("العربية");
  const [pages, setPages] = useState(12);
  const [topicNotes, setTopicNotes] = useState("");
  const [assistanceMode, setAssistanceMode] =
    useState<AcademicAssistanceMode>("practice");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const assignmentInput = useRef<HTMLInputElement>(null);
  const draftInput = useRef<HTMLInputElement>(null);
  const canStart = useMemo(
    () =>
      mode === "rescue"
        ? Boolean(draftText.trim() || draftFiles.length)
        : Boolean(assignmentText.trim() || assignmentFiles.length),
    [mode, assignmentText, assignmentFiles.length, draftText, draftFiles.length],
  );

  async function filePayload(file: File) {
    if (file.size > MAX)
      throw new Error(`الملف ${file.name} أكبر من 20MB.`);
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
      reader.readAsDataURL(file);
    });
    return {
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      base64,
      size: file.size,
    };
  }

  async function start() {
    if (!canStart) return;
    setProcessing(true);
    setError("");
    try {
      const labels = [
        assignmentText.trim()
          ? `--- ملف التكليف / ASSIGNMENT ---\n${assignmentText.trim()}`
          : "",
        mode === "rescue" && draftText.trim()
          ? `--- المسودة الحالية / EXISTING DRAFT ---\n${draftText.trim()}`
          : "",
        topicNotes.trim()
          ? `--- قرارات الطالب / STUDENT DECISIONS ---\n${topicNotes.trim()}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      const files = [...assignmentFiles, ...draftFiles];
      const result = await api.createProject({
        textContext: labels || undefined,
        files: files.length ? await Promise.all(files.map(filePayload)) : undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      navigate(`/app/project/${result.project.id}?focus=writer`, {
        replace: true,
        state: {
          justCompiled: true,
          writerMode: mode,
          writerRequest: {
            mode,
            assistanceMode,
            language,
            desiredPages: pages,
            academicTone: "clear",
            topicNotes,
            existingDraft: mode === "rescue" ? draftText : undefined,
          },
        },
      });
    } catch (caught: any) {
      setError(caught?.message || "تعذر تجهيز مساحة المشروع. حاول مرة أخرى.");
    } finally {
      setProcessing(false);
    }
  }

  function chooseMode(value: AcademicWorkMode) {
    setMode(value);
    setParams({ mode: value });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full brand-soft-bg px-3 py-1.5 text-[11px] font-semibold">
          <Sparkles size={14} /> نحتاج ثلاث دقائق فقط
        </div>
        <h1 className="text-3xl md:text-5xl font-semibold tracking-[-.05em] mt-4">
          {mode === "rescue" ? "خلّنا ننقذ مشروعك" : "خلّنا نكتب مشروعك"}
        </h1>
        <p className="body-copy mt-3">
          ارفع ما عندك. نقرأ المطلوب، نبني خطة واضحة، ثم ننقلك مباشرةً إلى محرر المشروع.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto" role="tablist" aria-label="نوع المهمة">
        <ModeButton
          selected={mode === "write"}
          icon={FilePenLine}
          title="اكتب من البداية"
          detail="عندي تكليف أو فكرة"
          onClick={() => chooseMode("write")}
        />
        <ModeButton
          selected={mode === "rescue"}
          icon={FileHeart}
          title="أنقذ مسودة جاهزة"
          detail="عندي مشروع من GPT أو شخص"
          onClick={() => chooseMode("rescue")}
        />
      </div>

      <div className="grid xl:grid-cols-[1fr_360px] gap-5 items-start">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <UploadBlock
              title={mode === "rescue" ? "1. ارفع تعليمات الدكتور إن وجدت" : "1. ارفع ملف التكليف"}
              detail="PDF، Word، PowerPoint، صورة أو نص من البوابة"
              files={assignmentFiles}
              onPick={() => assignmentInput.current?.click()}
              onDrop={(files) => setAssignmentFiles(files.slice(0, 5))}
              onRemove={(index) => setAssignmentFiles((old) => old.filter((_, i) => i !== index))}
            />
            <input
              ref={assignmentInput}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.docx,.pptx,.txt,.md,image/*"
              onChange={(event) => setAssignmentFiles(Array.from(event.target.files || []).slice(0, 5))}
            />
            <div className="p-5 border-b hairline">
              <label className="block">
                <span className="text-xs font-semibold">أو الصق تفاصيل التكليف</span>
                <textarea
                  value={assignmentText}
                  onChange={(event) => setAssignmentText(event.target.value)}
                  rows={5}
                  className="field mt-2 resize-y"
                  placeholder="الصق المطلوب، الـRubric، الموعد، عدد الصفحات وأي ملاحظات..."
                />
              </label>
            </div>

            {mode === "rescue" && (
              <>
                <UploadBlock
                  title="2. ارفع المشروع الجاهز"
                  detail="سنفحص المصادر والتكرار والـRubric وقابلية المناقشة"
                  files={draftFiles}
                  onPick={() => draftInput.current?.click()}
                  onDrop={(files) => setDraftFiles(files.slice(0, 5))}
                  onRemove={(index) => setDraftFiles((old) => old.filter((_, i) => i !== index))}
                  tone="sand"
                />
                <input
                  ref={draftInput}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(event) => setDraftFiles(Array.from(event.target.files || []).slice(0, 5))}
                />
                <div className="p-5 border-b hairline">
                  <label className="block">
                    <span className="text-xs font-semibold">أو الصق المسودة هنا</span>
                    <textarea
                      value={draftText}
                      onChange={(event) => setDraftText(event.target.value)}
                      rows={8}
                      className="field mt-2 resize-y"
                      placeholder="الصق المشروع كاملاً أو الجزء الذي يحتاج إنقاذاً..."
                    />
                  </label>
                </div>
              </>
            )}

            <div className="p-5">
              <label className="block">
                <span className="text-xs font-semibold">شنو تبي نراعي في المشروع؟</span>
                <textarea
                  value={topicNotes}
                  onChange={(event) => setTopicNotes(event.target.value)}
                  rows={3}
                  className="field mt-2 resize-y"
                  placeholder="فكرتك، رأيك، الحالة التي اخترتها، أو ملاحظات الدكتور السابقة..."
                />
              </label>
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-4 xl:sticky xl:top-24">
          <Card>
            <CardContent>
              <div className="flex items-center gap-2"><Languages size={17} className="brand-text" /><h2 className="section-title">شكل المشروع</h2></div>
              <label className="block mt-5">
                <span className="text-[11px] font-semibold">لغة الكتابة</span>
                <input list="project-languages" value={language} onChange={(event) => setLanguage(event.target.value)} className="field mt-1.5" placeholder="اكتب أي لغة" />
                <datalist id="project-languages"><option value="العربية" /><option value="English" /><option value="Français" /><option value="Español" /><option value="Türkçe" /><option value="اردو" /><option value="中文" /><option value="हिन्दी" /><option value="Deutsch" /><option value="فارسی" /></datalist>
                <span className="text-[9px] muted mt-1 block">اكتب أي لغة حتى لو لم تظهر في الاقتراحات.</span>
              </label>
              <label className="block mt-4">
                <span className="text-[11px] font-semibold flex justify-between"><span>عدد الصفحات التقريبي</span><strong className="brand-text">{pages}</strong></span>
                <input type="range" min="3" max="35" value={pages} onChange={(event) => setPages(Number(event.target.value))} className="w-full mt-3 accent-[var(--brand)]" />
              </label>
              <div className="mt-5 pt-4 border-t hairline">
                <div className="text-[11px] font-semibold mb-2">طريقة المساعدة</div>
                <AssistChoice selected={assistanceMode === "practice"} title="مسودة كاملة للتعلم" detail="نكتب ونشرح؛ تحقق من سياسة المقرر قبل التسليم" onClick={() => setAssistanceMode("practice")} />
                <AssistChoice selected={assistanceMode === "policy_strict"} title="حسب سياسة صارمة" detail="خطة وأسئلة إرشادية بدون تسليم نهائي" onClick={() => setAssistanceMode("policy_strict")} />
              </div>
            </CardContent>
          </Card>
          <Card className="brand-soft-bg">
            <CardContent>
              <div className="flex items-center gap-2"><ShieldCheck size={17} /><h3 className="text-sm font-semibold">وعد AcademicOS</h3></div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <SmallPromise icon={BookOpenCheck} label="مشروع" />
                <SmallPromise icon={FileText} label="شرح" />
                <SmallPromise icon={Mic2} label="مناقشة" />
              </div>
            </CardContent>
          </Card>
          {error && <div role="alert" className="rounded-xl bg-red-500/10 text-[var(--danger)] p-3 text-xs leading-6">{error}</div>}
          <Button size="lg" className="w-full" onClick={start} disabled={!canStart || processing}>
            {processing ? <><LoaderCircle size={18} className="animate-spin" /> نقرأ ونبني المساحة...</> : <>{mode === "rescue" ? "ابدأ الإنقاذ" : "ابنِ مشروعي"}<ArrowLeft size={17} /></>}
          </Button>
          <p className="text-[10px] leading-5 muted text-center">لن نخترع مصدراً أو بيانات أو نتيجة. أي نقص سيظهر لك بوضوح.</p>
        </aside>
      </div>
    </div>
  );
}

function ModeButton({ selected, icon: Icon, title, detail, onClick }: { selected: boolean; icon: React.ElementType; title: string; detail: string; onClick: () => void }) {
  return <button type="button" role="tab" aria-selected={selected} onClick={onClick} className={`mode-choice focus-ring rounded-2xl border p-4 flex items-center gap-3 text-start ${selected ? "is-selected" : "hairline"}`}><span className="h-12 w-12 rounded-2xl brand-soft-bg grid place-items-center"><Icon size={20} /></span><span className="flex-1"><strong className="block text-sm">{title}</strong><span className="text-[11px] muted mt-1 block">{detail}</span></span>{selected && <Check size={17} className="brand-text" />}</button>;
}

function UploadBlock({ title, detail, files, onPick, onDrop, onRemove, tone = "brand" }: { title: string; detail: string; files: File[]; onPick: () => void; onDrop: (files: File[]) => void; onRemove: (index: number) => void; tone?: "brand" | "sand" }) {
  return <div className="border-b hairline"><button type="button" onClick={onPick} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onDrop(Array.from(event.dataTransfer.files)); }} className={`upload-visual focus-ring w-full min-h-44 p-6 grid place-items-center text-center ${tone === "sand" ? "upload-visual--sand" : ""}`}><span><span className="h-14 w-14 rounded-2xl bg-white/75 grid place-items-center mx-auto shadow-sm"><UploadCloud size={23} /></span><strong className="block mt-4 text-sm">{title}</strong><span className="block text-[11px] muted mt-1">{detail}</span><span className="inline-flex items-center gap-1.5 mt-3 text-[10px] font-semibold brand-text"><Paperclip size={13} /> اضغط أو اسحب الملفات</span></span></button>{files.length > 0 && <div className="px-4 pb-4 flex flex-wrap gap-2">{files.map((file, index) => <span key={`${file.name}-${index}`} className="inline-flex items-center gap-2 rounded-full border hairline bg-[var(--panel)] px-3 py-1.5 text-[10px]"><FileText size={13} /><span className="max-w-44 truncate">{file.name}</span><button type="button" onClick={() => onRemove(index)} aria-label={`حذف ${file.name}`}><X size={12} /></button></span>)}</div>}</div>;
}

function AssistChoice({ selected, title, detail, onClick }: { selected: boolean; title: string; detail: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`focus-ring w-full rounded-xl p-3 text-start flex gap-3 mb-2 ${selected ? "brand-soft-bg" : "soft-bg"}`}><span className={`h-5 w-5 rounded-full border grid place-items-center shrink-0 ${selected ? "border-[var(--brand)]" : "hairline"}`}>{selected && <span className="h-2.5 w-2.5 rounded-full brand-bg" />}</span><span><strong className="block text-xs">{title}</strong><span className="block text-[10px] muted mt-1 leading-5">{detail}</span></span></button>;
}

function SmallPromise({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return <div className="rounded-xl bg-white/55 p-3"><Icon size={17} className="mx-auto" /><div className="text-[10px] font-semibold mt-2">{label}</div></div>;
}

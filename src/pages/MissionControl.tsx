import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, BookOpenCheck, BrainCircuit, Camera, CheckCircle2, Clock3, FileHeart, FilePenLine, FileText, FolderOpen, GraduationCap, LoaderCircle, Mic2, Paperclip, ScanSearch, Sparkles, Target, WandSparkles, X, Zap } from "lucide-react";
import { api } from "../lib/api";
import type { LearningBrain, MissionControlPlan, ProjectDNA, UserProfile } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { useI18n } from "../lib/i18n";

const MAX = 20 * 1024 * 1024;
type Intent = "auto" | "write" | "rescue" | "exam";
const JOURNEYS = [
  { to: "/app/upload?mode=write", icon: FilePenLine, title: "mission.journeyWrite", detail: "mission.journeyWriteDesc", tone: "brand" },
  { to: "/app/upload?mode=rescue", icon: FileHeart, title: "mission.journeyRescue", detail: "mission.journeyRescueDesc", tone: "sand" },
  { to: "/app/learn", icon: GraduationCap, title: "mission.journeyExam", detail: "mission.journeyExamDesc", tone: "blue" },
] as const;

function inferIntent(text: string, files: File[]): Exclude<Intent, "auto"> {
  const sample = `${text} ${files.map((file) => file.name).join(" ")}`.toLowerCase();
  if (/(exam|quiz|midterm|final|test|question bank|اختبار|كويز|أسئلة|امتحان|فاينل|ميدتيرم|examen|prueba|考试|परीक्षा|sınav|امتحان)/i.test(sample)) return "exam";
  if (/(draft|revision|rewrite|fix|rescue|مسودة|صحح|عدّل|تعديل|انقذ|أنقذ|borrador|brouillon|taslak|草稿|ड्राफ्ट|ڈرافٹ)/i.test(sample)) return "rescue";
  return "write";
}

async function filePayload(file: File, tooLarge: string) {
  if (file.size > MAX) throw new Error(`${file.name}: ${tooLarge}`);
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(file);
  });
  return { name: file.name, mimeType: file.type || "application/octet-stream", base64, size: file.size };
}

export function MissionControl() {
  const { user } = useAuth();
  const { t, meta } = useI18n();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<ProjectDNA[]>([]);
  const [mission, setMission] = useState<MissionControlPlan | null>(null);
  const [brain, setBrain] = useState<LearningBrain | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [intent, setIntent] = useState<Intent>("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);

  useEffect(() => {
    Promise.allSettled([api.projects(), api.missionControl(), api.profile()]).then(([projectsResult, missionResult, profileResult]) => {
      if (projectsResult.status === "fulfilled") setProjects(projectsResult.value.projects);
      if (missionResult.status === "fulfilled") { setMission(missionResult.value.mission); setBrain(missionResult.value.brain); }
      if (profileResult.status === "fulfilled") setProfile(profileResult.value.profile);
    });
  }, []);

  const latest = useMemo(() => [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3), [projects]);
  const firstName = user?.displayName?.trim().split(/\s+/)[0] || t("mission.student");
  const resolvedIntent = intent === "auto" ? inferIntent(text, files) : intent;
  const canGo = Boolean(text.trim() || files.length);
  const intentLabel = (value: Exclude<Intent,"auto">) => t(value === "exam" ? "mission.intentExam" : value === "rescue" ? "mission.intentRescue" : "mission.intentWrite");

  async function launch() {
    if (!canGo) return;
    setBusy(true); setError("");
    try {
      const selectedIntent = intent === "auto" ? inferIntent(text, files) : intent;
      const payload = () => Promise.all(files.slice(0, 5).map((file) => filePayload(file, t("mission.fileTooLarge"))));
      if (selectedIntent === "exam" && !files.length) { navigate("/app/learn", { state: { seedProblem: text.trim(), openSolve: true } }); return; }
      if (selectedIntent === "exam" && files.length) {
        const study = await api.learnIntake({ note: text.trim() || undefined, files: await payload() });
        navigate("/app/learn", { replace: true, state: { examIntake: study, openSolve: false } }); return;
      }
      const context = [
        text.trim() ? `--- STUDENT INPUT ---\n${text.trim()}` : "",
        selectedIntent === "rescue" ? "--- WORK MODE ---\nRescue/review an existing draft. Preserve the student's decisions and surface missing evidence." : "",
      ].filter(Boolean).join("\n\n");
      const result = await api.createProject({ textContext: context || undefined, files: files.length ? await payload() : undefined, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      navigate(`/app/project/${result.project.id}?focus=writer`, { replace: true, state: {
        justCompiled: true,
        compileSummary: t(selectedIntent === "rescue" ? "mission.compiledRescue" : "mission.compiledWrite"),
        writerRequest: { mode: selectedIntent === "rescue" ? "rescue" : "write", assistanceMode: "practice", language: meta.aiName, academicTone: "clear", topicNotes: text.trim() },
      }});
    } catch (caught: any) { setError(caught?.message || t("mission.error")); }
    finally { setBusy(false); }
  }

  function voiceInput() {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) { setError(t("mission.voiceUnsupported")); return; }
    const recognition = new Recognition(); recognition.lang = meta.speech; recognition.interimResults = false; recognition.continuous = false; setListening(true);
    recognition.onresult = (event: any) => { const transcript = String(event.results?.[0]?.[0]?.transcript || "").trim(); if (transcript) setText((current) => current ? `${current}\n${transcript}` : transcript); };
    recognition.onerror = () => setError(t("mission.voiceError")); recognition.onend = () => setListening(false); recognition.start();
  }

  const minuteUnit = t("mission.minuteShort");
  return <div className="student-home space-y-6 md:space-y-8">
    <section className="student-hero panel-flat rounded-[32px] overflow-hidden"><div className="grid lg:grid-cols-[1.03fr_.97fr] items-stretch">
      <div className="p-6 md:p-9 lg:p-11">
        <div className="inline-flex items-center gap-2 rounded-full brand-soft-bg px-3 py-1.5 text-[11px] font-semibold"><Sparkles size={14}/>{t("mission.smartInbox")}</div>
        <h1 className="text-3xl md:text-5xl font-semibold tracking-[-.05em] leading-[1.12] mt-5">{t("mission.hello")} {firstName},<br/>{t("mission.whatToday")}</h1>
        <p className="body-copy mt-4 max-w-2xl">{t("mission.heroDesc")}</p>
        <div className="academic-inbox mt-6 rounded-[26px] border hairline bg-[var(--panel)] p-3 md:p-4 shadow-sm">
          <textarea value={text} onChange={(e)=>setText(e.target.value)} className="w-full min-h-28 bg-transparent resize-none outline-none px-2 pt-2 text-sm md:text-base leading-7" placeholder={t("mission.placeholder")} aria-label={t("mission.whatToday")}/>
          {!!files.length && <div className="flex flex-wrap gap-2 px-2 pb-2">{files.map((file,index)=><span key={`${file.name}-${index}`} className="inline-flex items-center gap-2 rounded-full soft-bg px-3 py-1.5 text-[10px]"><FileText size={12}/><span className="max-w-48 truncate">{file.name}</span><button aria-label={`${t("mission.remove")} ${file.name}`} onClick={()=>setFiles((current)=>current.filter((_,i)=>i!==index))}><X size={11}/></button></span>)}</div>}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-t hairline pt-3 px-1"><div className="flex items-center gap-1.5 flex-wrap">
            <input ref={fileInput} type="file" multiple className="hidden" accept=".pdf,.docx,.pptx,.txt,.md,image/*" onChange={(e)=>setFiles(Array.from(e.target.files||[]).slice(0,5))}/>
            <input ref={cameraInput} type="file" className="hidden" accept="image/*" capture="environment" onChange={(e)=>setFiles(Array.from(e.target.files||[]).slice(0,1))}/>
            <ToolButton icon={Paperclip} label={t("mission.upload")} onClick={()=>fileInput.current?.click()}/><ToolButton icon={Camera} label={t("mission.camera")} onClick={()=>cameraInput.current?.click()}/><ToolButton icon={listening?LoaderCircle:Mic2} label={listening?t("mission.listening"):t("mission.speak")} onClick={voiceInput} spin={listening}/>
          </div><Button onClick={launch} disabled={!canGo||busy} className="min-w-40">{busy?<LoaderCircle size={16} className="animate-spin"/>:<WandSparkles size={16}/>} {busy?t("mission.processing"):t("mission.start")}<ArrowLeft size={15} className="directional-icon"/></Button></div>
        </div>
        <div className="flex gap-2 flex-wrap mt-3" aria-label={t("mission.optionalRouting")}>{(["auto","write","rescue","exam"] as Intent[]).map((value)=><button key={value} onClick={()=>setIntent(value)} className={`focus-ring rounded-full px-3 py-1.5 text-[10px] font-semibold border ${intent===value?"brand-soft-bg border-[var(--brand)]/30":"hairline muted"}`}>{t(`mission.intent.${value}`)}{value==="auto"&&canGo?` · ${t("mission.routesTo")} ${intentLabel(resolvedIntent)}`:""}</button>)}</div>
        {error&&<div role="alert" className="mt-3 rounded-xl bg-red-500/10 text-[var(--danger)] p-3 text-xs">{error}</div>}
      </div>
      <div className="relative min-h-[330px] bg-[#f6efe4] overflow-hidden"><img src="/assets/academicos-project-journey.png" alt={t("mission.imageAlt")} className="absolute inset-0 h-full w-full object-cover"/><div className="absolute inset-x-5 bottom-5 panel rounded-2xl p-4 backdrop-blur-sm border hairline"><div className="flex items-center gap-2 text-xs font-semibold"><Zap size={14} className="brand-text"/>{t("mission.valueFirst")}</div><p className="text-[10px] muted leading-5 mt-1">{t("mission.valueFirstDesc")}</p></div></div>
    </div></section>

    {mission&&<section className="grid xl:grid-cols-[1.25fr_.75fr] gap-5"><Card className="overflow-hidden"><CardContent>
      <div className="flex items-start justify-between gap-4"><div><div className="eyebrow">{t("mission.today")} · {mission.availableMinutes} {minuteUnit}</div><h2 className="section-title mt-1">{t("mission.startHere")}</h2><p className="body-copy mt-2">{t(mission.pressure.level==="critical"?"mission.pressureCriticalDesc":mission.pressure.level==="busy"?"mission.pressureBusyDesc":"mission.pressureCalmDesc").replace("{count}",String(mission.pressure.dueWithinSevenDays))}</p></div><span className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${mission.pressure.level==="critical"?"bg-red-500/10 text-red-600":mission.pressure.level==="busy"?"bg-amber-500/10 text-[var(--warning)]":"brand-soft-bg brand-text"}`}>{t(mission.pressure.level==="critical"?"mission.pressureCritical":mission.pressure.level==="busy"?"mission.pressureBusy":"mission.pressureCalm")}</span></div>
      <div className="mt-5 space-y-2">{mission.actions.slice(0,4).map((action,index)=><Link key={action.id} to={action.path} className="focus-ring rounded-2xl border hairline p-4 flex items-center gap-3 hover:bg-[var(--panel-2)]"><span className="h-10 w-10 rounded-xl brand-soft-bg grid place-items-center font-bold mono-number">{index+1}</span><span className="min-w-0 flex-1"><strong className="block text-sm">{action.title}</strong><span className="block text-[10px] muted mt-1 truncate">{action.projectTitle} · {t("mission.priorityReason")}</span></span><span className="inline-flex items-center gap-1 text-[10px] muted"><Clock3 size={12}/>{action.estimatedMinutes}{minuteUnit}</span><ArrowLeft size={15} className="muted directional-icon"/></Link>)}{!mission.actions.length&&<div className="rounded-2xl brand-soft-bg p-6 text-center"><CheckCircle2 size={22} className="mx-auto"/><strong className="block mt-2">{t("mission.noPressure")}</strong><p className="text-xs mt-1 opacity-75">{t("mission.noPressureDesc")}</p></div>}</div>
    </CardContent></Card>
    <Card className="understanding-card overflow-hidden"><CardContent><div className="flex items-center gap-3"><span className="h-11 w-11 rounded-2xl bg-white/70 text-[var(--brand-2)] grid place-items-center"><BrainCircuit size={19}/></span><div><div className="eyebrow">Learning Brain</div><h2 className="section-title mt-1">{t("mission.brainTitle")}</h2></div></div>{brain?.recommendedFocus?.[0]?<div className="mt-5 rounded-2xl bg-white/55 p-4"><div className="text-[10px] opacity-70">{t("mission.nextFocus")}</div><strong className="block mt-1">{brain.recommendedFocus[0].skill}</strong><p className="text-xs leading-6 mt-2 opacity-80">{t("mission.nextFocusDesc")}</p></div>:<p className="text-xs leading-6 mt-5 text-[var(--brand-2)]">{t("mission.brainEmpty")}</p>}<div className="grid grid-cols-3 gap-2 mt-4"><BrainStat label={t("mission.projects")} value={brain?.projectsAnalyzed||0}/><BrainStat label={t("mission.learningEvidence")} value={brain?.evidenceItems||0}/><BrainStat label={t("mission.strengths")} value={brain?.strengths.length||0}/></div></CardContent></Card></section>}

    <section aria-labelledby="shortcuts-title"><div className="flex items-center justify-between gap-4 mb-4"><div><div className="eyebrow">{t("mission.shortcutsEyebrow")}</div><h2 id="shortcuts-title" className="section-title mt-1">{t("mission.shortcutsTitle")}</h2></div><span className="hidden sm:inline-flex items-center gap-2 text-[11px] muted"><WandSparkles size={15}/>{t("mission.shortcutsHint")}</span></div><div className="grid md:grid-cols-3 gap-4">{JOURNEYS.map((journey)=>{const Icon=journey.icon;return <Link key={journey.to} to={journey.to} className="journey-card focus-ring group rounded-[24px]"><Card className={`h-full journey-card--${journey.tone}`}><CardContent className="p-5"><span className="journey-icon h-12 w-12 rounded-2xl grid place-items-center"><Icon size={21}/></span><h3 className="text-base font-semibold mt-5">{t(journey.title)}</h3><p className="text-xs muted mt-1">{t(journey.detail)}</p><div className="mt-4 flex items-center gap-2 text-xs font-semibold brand-text">{t("mission.open")}<ArrowLeft size={14} className="directional-icon"/></div></CardContent></Card></Link>})}</div></section>

    <section className="grid xl:grid-cols-[1.15fr_.85fr] gap-5 items-start"><Card><CardContent><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="h-11 w-11 rounded-2xl brand-soft-bg grid place-items-center"><FolderOpen size={19}/></span><div><div className="eyebrow">{t("mission.yourProjects")}</div><h2 className="section-title mt-1">{t("mission.continue")}</h2></div></div><Button asChild variant="ghost" size="sm"><Link to="/app/projects">{t("mission.all")}<ArrowLeft size={14} className="directional-icon"/></Link></Button></div><div className="mt-5 space-y-2">{latest.map((project)=><Link key={project.id} to={`/app/project/${project.id}`} className="project-quick-row focus-ring rounded-2xl flex items-center gap-3 p-3 border hairline"><span className="h-10 w-10 rounded-xl soft-bg grid place-items-center"><BookOpenCheck size={17}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold truncate">{project.title}</span><span className="block text-[10px] muted mt-1">{project.course} · {project.progress}%</span></span><ArrowLeft size={16} className="muted directional-icon"/></Link>)}{!latest.length&&<div className="rounded-2xl border border-dashed hairline p-8 text-center"><ScanSearch size={24} className="mx-auto brand-text"/><div className="font-semibold mt-3">{t("mission.noProject")}</div><p className="text-xs muted mt-1">{t("mission.noProjectDesc")}</p></div>}</div></CardContent></Card>
    <Card><CardContent><div className="flex items-center gap-3"><span className="h-11 w-11 rounded-2xl brand-soft-bg grid place-items-center"><Target size={19}/></span><div><div className="eyebrow">{t("mission.personalizationOptional")}</div><h2 className="section-title mt-1">{t("mission.profileLater")}</h2></div></div><p className="body-copy mt-4">{t(profile?.onboardingCompleted?"mission.profileReady":"mission.profileNotReady")}</p><Button asChild variant="outline" className="mt-4"><Link to="/app/onboarding">{t(profile?.onboardingCompleted?"mission.reviewProfile":"mission.customizeLater")}</Link></Button></CardContent></Card></section>
  </div>;
}

function ToolButton({icon:Icon,label,onClick,spin=false}:{icon:React.ElementType;label:string;onClick:()=>void;spin?:boolean}){return <button type="button" onClick={onClick} className="focus-ring min-h-10 rounded-xl soft-bg px-3 inline-flex items-center gap-1.5 text-[10px] font-semibold"><Icon size={14} className={spin?"animate-spin":""}/>{label}</button>}
function BrainStat({label,value}:{label:string;value:number}){return <div className="rounded-xl bg-white/55 p-3 text-center"><div className="text-lg font-bold mono-number">{value}</div><div className="text-[9px] mt-1 opacity-70">{label}</div></div>}

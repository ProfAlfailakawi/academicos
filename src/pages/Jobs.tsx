import { localizedUiError } from "../lib/ui-error";
import React,{useEffect,useState}from'react';
import{CircleStop,Clock3,RefreshCw,ServerCog}from'lucide-react';
import{api}from'../lib/api';
import type{JobRecord}from'../types';
import{PageHeader}from'../components/PageHeader';
import{Card,CardContent}from'../components/ui/card';
import{Button}from'../components/ui/button';
import{EmptyState}from'../components/EmptyState';
import{formatDateTime,useI18n}from'../lib/i18n';
import{runtimeEnumLabel}from'../lib/platform-locale';

/* عناوين المهام ومراحلها تُخزَّن عربيةً في السجل؛ تُعرَّب هنا عند العرض بغير العربية.
   ما لا يُعرف يبقى كما هو، فلا يُفقد نصٌّ حقيقي. */
const JOB_TEXT_EN: Record<string, string> = {
  "في الانتظار": "Queued",
  "تجهيز النتيجة": "Preparing result",
  "تحليل كراسة التكليف": "Assignment brief analysis",
  "تصدير المشروع PDF": "Project PDF export",
  "تصدير أرشيف المقرر": "Course archive export",
  "مزامنة القوائم": "Roster sync",
  "تقرير جلسة الشفهي": "Viva session report",
};
function jobText(text: string, locale: string): string {
  if (locale === "ar" || !text) return text;
  const [head, ...rest] = text.split(" — ");
  const en = JOB_TEXT_EN[head];
  return en ? [en, ...rest].join(" — ") : text;
}
export function Jobs(){const{t,locale}=useI18n();const[jobs,setJobs]=useState<JobRecord[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState('');const load=()=>{setLoading(true);api.jobs().then(r=>setJobs(r.jobs)).catch(e=>setError(localizedUiError(e, t, "ui.actionError"))).finally(()=>setLoading(false))};useEffect(()=>{load();const id=setInterval(load,10000);return()=>clearInterval(id)},[]);const cancel=async(id:string)=>{await api.cancelJob(id);load()};return <div className="space-y-6"><PageHeader eyebrow={t("ui.backgroundProcessing")} title={t('jobs.title')} description={t('jobs.description')} action={<Button variant="outline" onClick={load}><RefreshCw size={14} className={loading?'animate-spin':''}/> {t('jobs.refresh')}</Button>}/>{error&&<div className="text-sm text-danger">{error}</div>}{jobs.length?<div className="grid gap-3">{jobs.map(j=><Card key={j.id}><CardContent><div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div className="min-w-0"><div className="eyebrow">{runtimeEnumLabel(j.type,locale)} · {runtimeEnumLabel(j.state,locale)}</div><div className="font-semibold mt-1 truncate">{jobText(j.title||j.id,locale)}</div><div className="text-[11px] muted mt-1">{t('jobs.lastUpdate').replace('{date}',formatDateTime(j.updatedAt,locale))}</div></div><div className="job-progress-row flex items-center gap-3"><div className="job-progress w-40"><div className="flex justify-between text-[11px] muted"><span>{t("ui.progress")}</span><span>{j.progress}%</span></div><div className="mt-1 h-2 rounded-full bg-[var(--line)] overflow-hidden"><div className="h-full brand-bg" style={{width:`${j.progress}%`}}/></div></div>{!['completed','failed','cancelled'].includes(j.state)&&<Button size="sm" variant="outline" onClick={()=>cancel(j.id)}><CircleStop size={13}/> {t('jobs.cancel')}</Button>}</div></div><div className="job-stage-grid mt-4 grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] md:grid-cols-4 gap-2">{j.stages.map(s=><div key={s.key} className="job-stage rounded-xl bg-[var(--bg)] border hairline p-2.5 sm:p-3"><div className="flex items-center gap-2"><Clock3 size={13} className={s.state==='running'?'animate-pulse brand-text':'muted'}/><span className="text-[11px] font-semibold">{jobText(s.label,locale)}</span></div><div className="text-[11px] muted mt-1">{runtimeEnumLabel(s.state,locale)}</div></div>)}</div>{j.error&&<div className="mt-3 text-xs text-danger" role="alert">{t("ui.actionError")}</div>}</CardContent></Card>)}</div>:!loading&&<EmptyState icon={ServerCog} title={t('jobs.emptyTitle')} description={t('jobs.emptyDescription')}/>}</div>}

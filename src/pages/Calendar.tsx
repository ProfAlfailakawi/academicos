import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CalendarDays, Clock3 } from 'lucide-react';
import { api } from '../lib/api';
import type { ProjectDNA } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Card, CardContent } from '../components/ui/card';
import { EmptyState } from '../components/EmptyState';
import { formatDate, formatDateTime, useI18n } from '../lib/i18n';

export function Calendar() {
  const { t, locale } = useI18n();
  const [projects, setProjects] = useState<ProjectDNA[] | null>(null);
  useEffect(() => { api.projects().then(r => setProjects(r.projects)).catch(() => setProjects([])); }, []);
  const events = useMemo(() => (projects || []).flatMap(p => [
    ...(p.deadlines.final ? [{ id:`f_${p.id}`, title:p.title, subtitle:t('calendar.finalSubmission'), date:p.deadlines.final, projectId:p.id }] : []),
    ...p.deadlines.milestones.map(m => ({ id:m.id,title:m.title,subtitle:p.title,date:m.date,projectId:p.id })),
    ...p.tasks.filter(t => t.dueDate).map(t => ({ id:t.id,title:t.title,subtitle:p.title,date:t.dueDate!,projectId:p.id })),
  ]).sort((a,b)=>a.date.localeCompare(b.date)), [projects]);
  return <div className="space-y-7"><PageHeader eyebrow={t("ui.semesterOs")} title={t('calendar.title')} description={t('calendar.description')}/>{projects===null?<div className="h-80 soft-bg rounded-2xl animate-pulse"/>:events.length?<Card><CardContent className="p-2 md:p-3">{events.map((e,i)=><Link to={`/app/project/${e.projectId}`} key={e.id} className="focus-ring flex items-center gap-4 rounded-xl p-3 md:p-4 hover:bg-[var(--panel-2)]"><div className="h-12 w-12 rounded-xl brand-soft-bg flex flex-col items-center justify-center shrink-0"><span className="text-[10px] uppercase">{formatDate(e.date,locale,{month:'short'})}</span><span className="font-semibold mono-number">{new Date(e.date).getDate()}</span></div><div className="min-w-0 flex-1"><div className="text-sm font-semibold truncate">{e.title}</div><div className="text-[11px] muted mt-1 truncate">{e.subtitle}</div></div><div className="hidden sm:flex items-center gap-1 text-[11px] muted"><Clock3 size={13}/>{formatDateTime(e.date,locale,{hour:'2-digit',minute:'2-digit'})}</div></Link>)}</CardContent></Card>:<EmptyState title={t('calendar.emptyTitle')} description={t('calendar.emptyDescription')}/>}</div>;
}

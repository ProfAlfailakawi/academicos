import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CalendarDays, ChevronDown, Clock3 } from 'lucide-react';
import { api } from '../lib/api';
import type { ProjectDNA } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Card, CardContent } from '../components/ui/card';
import { EmptyState } from '../components/EmptyState';
import { formatDate, formatDateTime, useI18n } from '../lib/i18n';

function MonthHeat({ dates, locale }: { dates: string[]; locale: Parameters<typeof formatDate>[1] }) {
  const byDay = new Map<string, number>();
  for (const d of dates) { const k = d.slice(0, 10); byDay.set(k, (byDay.get(k) || 0) + 1); }
  const months = [...new Set([...byDay.keys()].map((k) => k.slice(0, 7)))].sort();
  const max = Math.max(1, ...byDay.values());
  return (
    <Card>
      <CardContent className="p-4 md:p-5 space-y-3">
        {months.map((m) => {
          const [y, mo] = m.split('-').map(Number);
          const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
          const total = [...byDay.entries()].filter(([k]) => k.startsWith(m)).reduce((a, [, n]) => a + n, 0);
          const label = formatDate(`${m}-01T12:00:00Z`, locale, { month: 'long', year: 'numeric', calendar: 'gregory' } as Intl.DateTimeFormatOptions);
          return (
            <div key={m} className="flex items-center gap-3">
              <div className="w-24 sm:w-32 shrink-0 text-meta font-semibold">{label} <span className="muted mono-number">{total}</span></div>
              <div className="grid flex-1 gap-[2px]" dir="ltr" style={{ gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` }} role="img" aria-label={`${label}: ${total}`}>
                {Array.from({ length: days }, (_, i) => {
                  const k = `${m}-${String(i + 1).padStart(2, '0')}`;
                  const n = byDay.get(k) || 0;
                  return <span key={k} title={`${i + 1}: ${n}`} className="h-5 rounded-[3px]" style={{ background: n ? `color-mix(in srgb, var(--brand) ${25 + Math.round((n / max) * 65)}%, var(--panel))` : 'var(--line)', opacity: n ? 1 : 0.45 }} />;
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function Calendar() {
  const { t, locale } = useI18n();
  const [projects, setProjects] = useState<ProjectDNA[] | null>(null);
  useEffect(() => { api.projects().then(r => setProjects(r.projects)).catch(() => setProjects([])); }, []);
  const events = useMemo(() => (projects || []).flatMap(p => [
    ...(p.deadlines.final ? [{ id:`f_${p.id}`, title:p.title, subtitle:t('calendar.finalSubmission'), date:p.deadlines.final, projectId:p.id }] : []),
    ...p.deadlines.milestones.map(m => ({ id:m.id,title:m.title,subtitle:p.title,date:m.date,projectId:p.id })),
    ...p.tasks.filter(t => t.dueDate).map(t => ({ id:t.id,title:t.title,subtitle:p.title,date:t.dueDate!,projectId:p.id })),
  ]).sort((a,b)=>a.date.localeCompare(b.date)), [projects]);
  // Rows are grouped by month; every event is still rendered (inside its month),
  // so each month badge equals the rows under it. The month that holds the next
  // upcoming event starts open; the rest are collapsed. Chosen from the data only.
  const monthGroups = useMemo(() => {
    const m = new Map<string, typeof events>();
    for (const e of events) { const k = e.date.slice(0, 7); m.set(k, [...(m.get(k) || []), e]); }
    return [...m.entries()].map(([key, items]) => ({ key, items }));
  }, [events]);
  const openKey = useMemo(() => {
    const now = new Date().toISOString().slice(0, 7);
    return (monthGroups.find((g) => g.key >= now) || monthGroups[monthGroups.length - 1])?.key;
  }, [monthGroups]);
  return <div className="space-y-7"><PageHeader eyebrow={t("ui.semesterOs")} title={t('calendar.title')} description={t('calendar.description')}/>{projects===null?<div className="h-80 soft-bg rounded-2xl animate-pulse"/>:events.length?<><MonthHeat dates={events.map(e=>e.date)} locale={locale}/><div className="space-y-3">{monthGroups.map(g=><Card key={g.key}><CardContent className="p-2 md:p-3"><details className="calendar-month" open={g.key===openKey}><summary className="focus-ring flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3"><CalendarDays size={17} className="brand-text shrink-0"/><span className="section-title flex-1">{formatDate(`${g.key}-01T12:00:00Z`,locale,{month:'long',year:'numeric',calendar:'gregory'} as Intl.DateTimeFormatOptions)}</span><span className="rounded-full soft-bg px-2.5 py-0.5 text-meta font-semibold mono-number">{g.items.length}</span><ChevronDown size={16} className="calendar-month__chev muted shrink-0"/></summary><div className="mt-1">{g.items.map(e=><Link to={`/app/project/${e.projectId}`} key={e.id} className="focus-ring flex items-center gap-3 sm:gap-4 rounded-xl p-2.5 sm:p-3 md:p-4 hover:bg-[var(--panel-2)]"><div className="h-12 min-w-12 px-1.5 rounded-xl brand-soft-bg flex flex-col items-center justify-center shrink-0"><span className="text-meta leading-4 whitespace-nowrap">{formatDate(e.date,locale,{month:'short'})}</span><span className="font-semibold mono-number">{formatDate(e.date,locale,{day:'numeric'})}</span></div><div className="min-w-0 flex-1"><div className="text-sm font-semibold truncate">{e.title}</div><div className="text-meta muted mt-1 truncate">{e.subtitle}</div></div><div className="hidden sm:flex items-center gap-1 text-meta muted"><Clock3 size={13}/>{formatDateTime(e.date,locale,{hour:'2-digit',minute:'2-digit'})}</div></Link>)}</div></details></CardContent></Card>)}</div></>:<EmptyState title={t('calendar.emptyTitle')} description={t('calendar.emptyDescription')}/>}</div>;
}

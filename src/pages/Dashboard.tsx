import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ArrowLeft, CalendarClock, CheckCircle2, Clock3, FolderKanban, Plus, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import type { DashboardSummary, ProjectDNA } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { EmptyState } from '../components/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../lib/i18n';

const dateFmt = new Intl.DateTimeFormat('ar-KW', { day: 'numeric', month: 'short' });

export function Dashboard() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api.dashboard().then(r => setSummary(r.summary)).catch(e => setError(e.message)); }, []);

  const nextProject = useMemo(() => summary?.projects.find(p => p.status !== 'completed' && p.nextAction) || summary?.projects[0], [summary]);
  if (error) return <ErrorBox message={error} />;
  if (!summary) return <DashboardSkeleton />;

  return (
    <div className="space-y-7 md:space-y-9">
      <PageHeader eyebrow={t('dash.eyebrow')} title={`${t('dash.greeting')} ${user?.displayName?.split(' ')[0] || ''}`} description={t('dash.heroDesc')} action={<Button asChild><Link to="/app/upload"><Plus size={17}/>{t('dash.newAssignment')}</Link></Button>} />

      {nextProject ? <NextAction project={nextProject} /> : <EmptyState title={t('dash.emptyTitle')} description={t('dash.emptyDesc')} action={<Button asChild><Link to="/app/upload">{t('dash.addFirst')}</Link></Button>} />}

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        <Metric icon={FolderKanban} label={t('dash.active')} value={summary.stats.active} hint={t('dash.activeHint')} />
        <Metric icon={CalendarClock} label={t('dash.dueSoon')} value={summary.stats.dueSoon} hint={t('dash.dueSoonHint')} />
        <Metric icon={Clock3} label={t('dash.workload')} value={summary.stats.workloadHours} suffix={t('dash.hourSuffix')} hint={t('dash.workloadHint')} />
        <Metric icon={CheckCircle2} label={t('dash.completed')} value={summary.stats.completed} hint={t('dash.completedHint')} />
      </section>

      <div className="grid xl:grid-cols-[1.5fr_.8fr] gap-5">
        <section className="space-y-4 min-w-0">
          <div className="flex items-center justify-between"><h2 className="section-title">{t('dash.currentProjects')}</h2><Button variant="ghost" size="sm" asChild><Link to="/app/projects">{t('dash.viewAll')} <ArrowLeft size={14}/></Link></Button></div>
          {summary.projects.length ? <div className="grid gap-3">{summary.projects.slice(0, 5).map(p => <ProjectRow key={p.id} project={p}/>)}</div> : <EmptyState title={t('dash.noProjects')} description={t('dash.noProjectsDesc')} />}
        </section>
        <aside className="space-y-4">
          <h2 className="section-title">{t('dash.upcoming')}</h2>
          <Card><CardContent className="space-y-1 p-2">{summary.upcoming.length ? summary.upcoming.map((item, i) => <div key={item.id} className="flex gap-3 p-3 rounded-xl hover:bg-[var(--panel-2)]"><div className="w-12 shrink-0 text-center"><div className="text-xs font-semibold mono-number">{dateFmt.format(new Date(item.date))}</div><div className="text-[10px] muted mt-1">{item.type === 'deadline' ? t('dash.deadline') : t('dash.milestone')}</div></div><div className="border-s hairline ps-3 min-w-0"><div className="text-sm font-semibold leading-5 truncate">{item.title}</div><div className="text-[11px] muted mt-1">{new Date(item.date).toLocaleString('ar-KW', { hour: '2-digit', minute: '2-digit' })}</div></div></div>) : <p className="body-copy p-4">{t('dash.noDates')}</p>}</CardContent></Card>
          {summary.risks.length > 0 && <Card><CardContent><div className="flex items-center gap-2 mb-3 text-[var(--warning)]"><AlertTriangle size={17}/><h3 className="text-sm font-semibold">{t('dash.needsAttention')}</h3></div><div className="space-y-3">{summary.risks.slice(0,3).map((risk, i) => <div key={`${risk.projectId}_${i}`} className="text-xs leading-6"><div className="font-semibold">{risk.projectTitle}</div><div className="muted">{risk.message}</div></div>)}</div></CardContent></Card>}
        </aside>
      </div>
    </div>
  );
}

function NextAction({ project }: { project: ProjectDNA }) {
  const { t } = useI18n();
  return <section className="relative overflow-hidden rounded-[24px] brand-bg p-6 md:p-8 shadow-xl"><div className="absolute inset-0 opacity-[.12] paper-grid"/><div className="relative grid md:grid-cols-[1fr_auto] gap-6 items-end"><div><div className="flex items-center gap-2 text-white/70 text-xs font-semibold mb-3"><Sparkles size={15}/>{t('dash.nextStep')}</div><h2 className="text-2xl md:text-3xl font-semibold tracking-[-0.03em] max-w-3xl">{project.nextAction}</h2><div className="text-white/70 text-sm mt-3">{project.course} · {project.title}</div><div className="mt-5 h-1.5 rounded-full bg-white/15 overflow-hidden max-w-xl"><div className="h-full bg-white rounded-full" style={{ width: `${project.progress}%` }}/></div></div><Button asChild variant="secondary" className="bg-white text-[var(--brand-2)] hover:bg-white/90"><Link to={`/app/project/${project.id}`}>{t('dash.openWorkspace')} <ArrowLeft size={16}/></Link></Button></div></section>;
}

function Metric({ icon: Icon, label, value, suffix, hint }: any) {
  return <Card className="overflow-hidden"><CardContent className="p-4 md:p-5"><div className="flex items-center justify-between"><span className="eyebrow">{label}</span><Icon size={17} className="muted"/></div><div className="mt-5 text-3xl md:text-4xl font-semibold tracking-[-0.04em] mono-number">{value}<span className="text-base ms-1 muted">{suffix}</span></div><div className="text-[11px] muted mt-2">{hint}</div></CardContent></Card>;
}

function ProjectRow({ project }: { project: ProjectDNA }) {
  return <Link to={`/app/project/${project.id}`} className="focus-ring panel-flat rounded-2xl p-4 md:p-5 block hover:shadow-[var(--shadow)] transition-shadow"><div className="flex gap-4 items-center"><div className="h-11 w-11 rounded-xl brand-soft-bg flex items-center justify-center shrink-0"><FolderKanban size={18}/></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2 flex-wrap"><span className="text-xs muted">{project.course}</span><StatusPill status={project.status}/></div><h3 className="text-sm md:text-base font-semibold truncate mt-1.5">{project.title}</h3><div className="mt-3 flex items-center gap-3"><div className="h-1.5 rounded-full bg-[var(--panel-2)] overflow-hidden flex-1"><div className="h-full brand-bg rounded-full" style={{ width: `${project.progress}%` }}/></div><span className="text-[11px] muted mono-number">{project.progress}%</span></div></div><ArrowLeft size={18} className="muted shrink-0"/></div></Link>;
}

function DashboardSkeleton() { return <div className="space-y-7 animate-pulse"><div className="h-24 rounded-2xl bg-[var(--panel-2)]"/><div className="h-44 rounded-3xl bg-[var(--brand-soft)]"/><div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-32 rounded-2xl bg-[var(--panel-2)]"/>)}</div></div>; }
function ErrorBox({ message }: { message: string }) { const { t } = useI18n(); return <div className="panel-flat rounded-2xl p-6"><h2 className="section-title">{t('dash.loadError')}</h2><p className="body-copy mt-2">{message}</p><Button className="mt-4" onClick={() => location.reload()}>{t('dash.retry')}</Button></div>; }

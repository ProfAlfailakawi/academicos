import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Filter, FolderKanban, Plus } from 'lucide-react';
import { api } from '../lib/api';
import type { ProjectDNA } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { StatusPill } from '../components/StatusPill';
import { EmptyState } from '../components/EmptyState';
import { useI18n } from '../lib/i18n';

export function Projects() {
  const { t } = useI18n();
  const [projects, setProjects] = useState<ProjectDNA[] | null>(null);
  const [filter, setFilter] = useState<'all'|'active'|'completed'>('all');
  useEffect(() => { api.projects().then(r => setProjects(r.projects)).catch(() => setProjects([])); }, []);
  const visible = useMemo(() => (projects || []).filter(p => filter === 'all' || (filter === 'completed' ? p.status === 'completed' : p.status !== 'completed')), [projects, filter]);
  return <div className="space-y-7"><PageHeader eyebrow={t('projects.eyebrow')} title={t('projects.title')} description={t('projects.description')} action={<Button asChild><Link to="/app/upload"><Plus size={17}/>{t('projects.newAssignment')}</Link></Button>}/><div className="flex items-center gap-2 overflow-auto pb-1"><Filter size={15} className="muted shrink-0"/>{([['all',t('projects.filterAll')],['active',t('projects.filterActive')],['completed',t('projects.filterCompleted')]] as const).map(([k,l]) => <button key={k} onClick={() => setFilter(k as 'all'|'active'|'completed')} className={`focus-ring rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${filter===k ? 'brand-soft-bg':'soft-bg muted'}`}>{l}</button>)}</div>{projects === null ? <div className="h-56 rounded-2xl soft-bg animate-pulse"/> : visible.length ? <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{visible.map(p => <ProjectCard key={p.id} p={p}/>)}</div> : <EmptyState title={t('projects.emptyTitle')} description={t('projects.emptyDescription')}/>}</div>;
}
function ProjectCard({ p }: { p: ProjectDNA }) { const { t } = useI18n(); return <Link to={`/app/project/${p.id}`} className="focus-ring block"><Card className="h-full hover:shadow-[var(--shadow)] transition-shadow"><CardContent className="h-full flex flex-col"><div className="flex justify-between gap-3"><div className="h-10 w-10 rounded-xl brand-soft-bg flex items-center justify-center"><FolderKanban size={17}/></div><StatusPill status={p.status}/></div><div className="mt-5 text-xs muted">{p.course}</div><h2 className="section-title mt-1.5 line-clamp-2">{p.title}</h2><p className="body-copy mt-2 line-clamp-2">{p.nextAction || t('projects.reviewWorkspace')}</p><div className="mt-auto pt-6"><div className="flex items-center gap-3"><div className="h-1.5 flex-1 rounded-full soft-bg overflow-hidden"><div className="h-full brand-bg" style={{width:`${p.progress}%`}}/></div><span className="text-[11px] muted mono-number">{p.progress}%</span><ArrowRight size={15} className="muted directional-icon"/></div></div></CardContent></Card></Link>; }

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, BookOpenCheck, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import type { SkillEvidence } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Card, CardContent } from '../components/ui/card';
import { EmptyState } from '../components/EmptyState';
import { useI18n } from '../lib/i18n';

export function Skills() {
  const { t } = useI18n();
  const [skills,setSkills]=useState<SkillEvidence[]|null>(null);
  useEffect(()=>{api.skills().then(r=>setSkills(r.skills)).catch(()=>setSkills([]));},[]);
  const grouped=useMemo(()=>{const m=new Map<string,SkillEvidence[]>();(skills||[]).forEach(s=>m.set(s.skill,[...(m.get(s.skill)||[]),s]));return [...m.entries()].sort((a,b)=>b[1].length-a[1].length)},[skills]);
  return <div className="space-y-7"><PageHeader eyebrow="Skill Genome" title={t('skills.title')} description={t('skills.description')}/>{skills===null?<div className="h-72 soft-bg rounded-2xl animate-pulse"/>:grouped.length?<div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{grouped.map(([name,evidence])=><Card key={name}><CardContent><div className="flex items-start justify-between gap-3"><div className="h-10 w-10 rounded-xl brand-soft-bg flex items-center justify-center"><BookOpenCheck size={17}/></div><span className="text-[11px] muted">{evidence.length} {t('skills.evidenceUnit')}</span></div><h2 className="section-title mt-5">{name}</h2><div className="mt-4 space-y-3">{evidence.slice(0,3).map(e=><Link key={e.id} to={`/app/project/${e.projectId}`} className="focus-ring block rounded-xl bg-[var(--bg)] border hairline p-3 hover:bg-[var(--panel-2)]"><div className="text-xs font-semibold line-clamp-1">{e.projectTitle}</div><div className="text-[10px] muted mt-1">{e.course} · {new Date(e.date).toLocaleDateString(document.documentElement.lang || undefined)}</div><div className="mt-2 flex items-center gap-1 text-[10px] brand-text"><ShieldCheck size={12}/>{e.verificationLevel==='institution'?t('skills.verifyInstitution'):e.verificationLevel==='project'?t('skills.verifyProject'):t('skills.verifySelf')}</div></Link>)}</div>{evidence.length>3&&<div className="text-[11px] muted mt-3">+ {evidence.length-3} {t('skills.moreEvidence')}</div>}</CardContent></Card>)}</div>:<EmptyState title={t('skills.emptyTitle')} description={t('skills.emptyDescription')}/>}</div>;
}

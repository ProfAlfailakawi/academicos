import { localizedUiError } from "../lib/ui-error";
import React,{useEffect,useState}from'react';
import{Link}from'react-router';
import{Archive as ArchiveIcon,ArrowRight}from'lucide-react';
import{api}from'../lib/api';
import type{ProjectDNA}from'../types';
import{PageHeader}from'../components/PageHeader';
import{Card,CardContent}from'../components/ui/card';
import{EmptyState}from'../components/EmptyState';
import{useI18n}from'../lib/i18n';
export function Archive(){const{t}=useI18n();const[p,setP]=useState<ProjectDNA[]|null>(null);const[error,setError]=useState('');useEffect(()=>{api.projects().then(r=>setP(r.projects.filter(x=>x.status==='completed'))).catch((e)=>{console.error("Failed to load archive",e);setError(localizedUiError(e, t, "ui.loadError"));})},[]);return <div className="space-y-7"><PageHeader eyebrow={t("ui.academicArchive")} title={t('archive.title')} description={t('archive.description')}/>{error?<div className="panel-flat rounded-2xl p-6"><h2 className="section-title">{t("ui.loadError")}</h2><p className="body-copy mt-2">{error}</p></div>:p===null?<div className="h-60 rounded-2xl soft-bg animate-pulse"/>:p.length?<div className="grid md:grid-cols-2 gap-4">{p.map(x=><Link to={`/app/project/${x.id}`} key={x.id}><Card><CardContent className="flex items-center gap-4"><div className="h-11 w-11 rounded-xl tone-tile"><ArchiveIcon size={18}/></div><div className="min-w-0 flex-1"><div className="text-xs muted">{x.course}</div><div className="font-semibold truncate mt-1">{x.title}</div></div><ArrowRight size={16} className="muted directional-icon"/></CardContent></Card></Link>)}</div>:<EmptyState title={t('archive.emptyTitle')} description={t('archive.emptyDescription')}/>}</div>}

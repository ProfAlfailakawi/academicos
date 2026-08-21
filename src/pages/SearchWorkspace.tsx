import React, { useEffect, useRef, useState } from 'react';
import { BookOpenCheck, FileText, FolderKanban, LoaderCircle, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../lib/api';
import type { GlobalSearchItem } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Card, CardContent } from '../components/ui/card';
import { useI18n } from '../lib/i18n';

export function SearchWorkspace(){
  const{t}=useI18n();const[params,setParams]=useSearchParams();const q=params.get('q')||'';const[value,setValue]=useState(q);const[results,setResults]=useState<GlobalSearchItem[]>([]);const[loading,setLoading]=useState(false);const[error,setError]=useState('');const seq=useRef(0);
  useEffect(()=>{setValue(q);if(q.trim().length<2){setResults([]);setLoading(false);return}const current=++seq.current;setLoading(true);setError('');const t=setTimeout(()=>api.search(q.trim()).then(r=>{if(current===seq.current)setResults(r.results)}).catch(e=>{if(current===seq.current)setError(e.message)}).finally(()=>{if(current===seq.current)setLoading(false)}),180);return()=>clearTimeout(t)},[q]);
  function submit(e:React.FormEvent){e.preventDefault();setParams(value.trim()?{q:value.trim()}:{})}
  return <div className="space-y-6"><PageHeader eyebrow="Global Search" title={t('search.title')} description={t('search.description')}/>
    <form onSubmit={submit} className="panel-flat rounded-2xl p-3 flex items-center gap-3"><Search size={19} className="muted ms-2"/><input autoFocus className="h-12 flex-1 bg-transparent outline-none text-sm" value={value} onChange={e=>setValue(e.target.value)} placeholder={t('search.placeholder')}/><button className="focus-ring rounded-xl brand-bg px-5 h-10 text-xs font-semibold" type="submit">{t('search.submit')}</button></form>
    {error&&<div className="rounded-xl border border-[var(--danger)]/20 p-3 text-sm text-[var(--danger)]">{error}</div>}
    <Card><CardContent><div className="flex items-center justify-between"><div><div className="eyebrow">Permission-aware results</div><h2 className="section-title mt-1">{t('search.results')}</h2></div>{loading?<LoaderCircle size={18} className="animate-spin brand-text"/>:<span className="text-[11px] muted mono-number">{results.length}</span>}</div>
      <div className="mt-5 divide-y divide-[var(--line)]">{results.map(item=><Result key={`${item.type}_${item.id}`} item={item}/>)}{!loading&&q.length>=2&&!results.length&&<div className="py-14 text-center"><Search className="mx-auto muted"/><h3 className="font-semibold mt-4">{t('search.emptyTitle')}</h3><p className="body-copy mt-2">{t('search.emptyBody')}</p></div>}{!q&&<div className="py-14 text-center"><Search className="mx-auto brand-text"/><h3 className="font-semibold mt-4">{t('search.startTitle')}</h3><p className="body-copy mt-2">{t('search.startBody')}</p></div>}</div>
    </CardContent></Card></div>
}
function Result({item}:{item:GlobalSearchItem}){const{t}=useI18n();const Icon=item.type==='project'?FolderKanban:item.type==='course'?BookOpenCheck:FileText;const label=item.type==='project'?t('search.typeProject'):item.type==='course'?t('search.typeCourse'):t('search.typeAssignment');return <Link to={item.path} className="focus-ring flex items-center gap-4 py-4 px-2 rounded-xl hover:bg-[var(--panel-2)]"><div className="h-10 w-10 rounded-xl brand-soft-bg grid place-items-center shrink-0"><Icon size={17}/></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="text-sm font-semibold truncate">{item.title}</h3><span className="rounded-full soft-bg px-2 py-0.5 text-[9px] muted shrink-0">{label}</span></div><p className="text-[11px] muted mt-1 truncate">{item.subtitle}</p></div><time className="hidden sm:block text-[10px] muted shrink-0">{new Date(item.updatedAt).toLocaleDateString('ar-KW')}</time></Link>}

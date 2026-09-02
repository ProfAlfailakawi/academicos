import { AppDialog } from "../components/AppDialog";
import { localizedUiError } from "../lib/ui-error";
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BriefcaseBusiness, FolderCheck, GraduationCap, LockKeyhole, Share2, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type { PassportData } from '../types';
import { PageHeader } from '../components/PageHeader';
import { Card, CardContent } from '../components/ui/card';
import { StatusPill } from '../components/StatusPill';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/ui/button';

export function Passport(){const{t}=useI18n();const[data,setData]=useState<PassportData|null>(null);const[loadError,setLoadError]=useState('');const[shareMessage,setShareMessage]=useState('');const[sharing,setSharing]=useState(false);const[sharePasswordDialogOpen,setSharePasswordDialogOpen]=useState(false);const[sharePassword,setSharePassword]=useState('');const[portfolioBusy,setPortfolioBusy]=useState(false);const[shares,setShares]=useState<Array<{id:string;kind:string;label:string;expiresAt?:string;revokedAt?:string;passwordProtected?:boolean;watermark?:string;viewCount?:number;lastViewedAt?:string;createdAt:string}>>([]);useEffect(()=>{
  api.passport()
    .then(r=>setData(r.passport))
    .catch((e)=>{
      console.error("Failed to load academic passport",e);
      setLoadError(localizedUiError(e, t, "ui.loadError"));
    });
  api.shares()
    .then(r=>setShares(r.shares))
    .catch((e)=>{
      console.error("Failed to load passport shares",e);
      setShareMessage(localizedUiError(e, t, "ui.loadError"));
    });
},[]);const share=()=>{setShareMessage('');setSharePassword('');setSharePasswordDialogOpen(true)};const confirmCreateShare=async()=>{const password=sharePassword.trim();if(password&&password.length<6){setShareMessage(t('passport.passwordTooShort'));return}setSharePasswordDialogOpen(false);setSharing(true);setShareMessage('');try{const expiresAt=new Date(Date.now()+30*86400000).toISOString();const r=await api.createShare({kind:'passport',label:t('passport.title'),expiresAt,password:password||undefined,watermark:`AcademicOS · ${t('share.consentShare')}`});try{if(!navigator.clipboard?.writeText)throw new Error("Clipboard is unavailable");await navigator.clipboard.writeText(r.url);setShareMessage(t('passport.shareCreated'))}catch(copyError){console.error("Passport share created but copy failed",copyError);setShareMessage(`${t('passport.shareCreated')} — ${r.url}`)}try{const x=await api.shares();setShares(x.shares)}catch(refreshError){console.error("Failed to refresh passport shares",refreshError);setShareMessage(localizedUiError(refreshError,t,"ui.loadError"))}}catch(e:any){setShareMessage(localizedUiError(e,t,'passport.shareFailed'))}finally{setSharing(false);setSharePassword('')}};const revoke=async(id:string)=>{try{await api.revokeShare(id);setShares(v=>v.map(x=>x.id===id?{...x,revokedAt:new Date().toISOString()}:x))}catch(e:any){setShareMessage(localizedUiError(e, t, 'passport.revokeFailed'))}};const toggleProject=async(id:string)=>{if(!data||portfolioBusy)return;const selected=new Set<string>(data.projects.map(p=>p.id));selected.has(id)?selected.delete(id):selected.add(id);setPortfolioBusy(true);try{await api.updateProfile({passportProjectIds:[...selected],passportVisibility:'private'});const available=data.availableProjects||[];setData({...data,projects:available.filter(p=>selected.has(p.id)),visibility:'private'})}catch(e:any){setShareMessage(localizedUiError(e, t, 'passport.portfolioSaveFailed'))}finally{setPortfolioBusy(false)}};return <div className="space-y-7"><PageHeader eyebrow={t("ui.academicPassport")} title={t('passport.title')} description={t('passport.headerDesc')}/>{loadError?<div className="panel-flat rounded-2xl p-6"><h2 className="section-title">{t("ui.loadError")}</h2><p className="body-copy mt-2">{loadError}</p></div>:!data?<div className="h-72 rounded-2xl soft-bg animate-pulse"/>:<><div className="grid lg:grid-cols-[330px_1fr] gap-5"><Card><CardContent className="text-center"><div className="h-20 w-20 rounded-3xl brand-soft-bg mx-auto flex items-center justify-center"><GraduationCap size={30}/></div><h2 className="text-xl font-semibold mt-4">{data.user.displayName}</h2><p className="text-xs muted mt-1">{data.user.education||t('passport.educationUnspecified')}</p>{data.user.institution&&<p className="text-xs muted mt-1">{data.user.institution}</p>}<Button size="sm" variant="outline" className="mt-4" onClick={share} disabled={sharing}><Share2 size={14}/>{sharing?t('passport.sharing'):t('passport.shareSelected')}</Button>{shareMessage&&<p className="text-[10px] muted mt-2 leading-5">{shareMessage}</p>}<div className="mt-6 rounded-xl bg-[var(--bg)] border hairline p-3 flex items-center gap-2 text-start"><LockKeyhole size={16} className="brand-text shrink-0"/><div><div className="text-xs font-semibold">{t('passport.privateByDefault')}</div><div className="text-[10px] muted mt-1">{t('passport.publicNeedsConsent')}</div></div></div></CardContent></Card><div className="space-y-5"><div className="grid sm:grid-cols-3 gap-3"><Stat icon={FolderCheck} value={data.projects.length} label={t('passport.projects')}/><Stat icon={ShieldCheck} value={data.skills.length} label={t('passport.skillEvidence')}/><Stat icon={BriefcaseBusiness} value={data.credentials.length} label={t('passport.credentials')}/></div><Card><CardContent><h2 className="section-title">{t('passport.selectedProjects')}</h2>{data.projects.length?<div className="mt-4 divide-y hairline">{data.projects.slice(0,8).map(p=><Link key={p.id} to={`/app/project/${p.id}`} className="focus-ring py-3 flex items-center justify-between gap-3"><div className="min-w-0"><div className="text-sm font-semibold truncate">{p.title}</div><div className="text-[11px] muted mt-1">{p.course}</div></div><StatusPill status={p.status}/></Link>)}</div>:<p className="body-copy mt-3">{t('passport.noProjects')}</p>}</CardContent></Card></div></div>{data.credentials.length===0&&<EmptyState title={t('passport.noCredentialsTitle')} description={t('passport.noCredentialsDesc')}/>}<Card><CardContent><h2 className="section-title">{t("ui.portfolioBuilder")}</h2><p className="body-copy mt-2">{t('passport.portfolioDesc')}</p><div className="mt-4 grid md:grid-cols-2 gap-2">{(data.availableProjects||[]).length?(data.availableProjects||[]).map(p=>{const selected=data.projects.some(x=>x.id===p.id);return <button key={p.id} type="button" disabled={portfolioBusy} onClick={()=>toggleProject(p.id)} className={`focus-ring rounded-xl border hairline p-3 text-start ${selected?'brand-soft-bg':''}`}><div className="flex items-center justify-between gap-3"><div><div className="text-xs font-semibold">{p.title}</div><div className="text-[10px] muted mt-1">{p.course}</div></div><span className="text-[10px] font-semibold">{selected?t('passport.selected'):t('passport.private')}</span></div></button>}):<p className="body-copy">{t('passport.noProjectsToSelect')}</p>}</div></CardContent></Card><Card><CardContent><h2 className="section-title">{t('passport.manageShares')}</h2><p className="body-copy mt-2">{t('passport.sharesDesc')}</p><div className="mt-4 space-y-2">{shares.length?shares.map(x=><div key={x.id} className="rounded-xl border hairline p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><div className="text-xs font-semibold">{x.label}</div><div className="text-[10px] muted mt-1">{x.revokedAt?t('passport.revoked'):x.expiresAt&&new Date(x.expiresAt).getTime()<Date.now()?t('passport.expired'):t('passport.active')} · {x.passwordProtected?t('passport.passwordProtected'):t('passport.noPassword')} · {t('passport.viewsCount').replace('{n}',String(x.viewCount||0))}</div></div><Button size="sm" variant="outline" disabled={Boolean(x.revokedAt)} onClick={()=>revoke(x.id)}>{t('passport.revoke')}</Button></div>):<p className="body-copy">{t('passport.noShares')}</p>}</div></CardContent></Card></>}
      <AppDialog
        open={sharePasswordDialogOpen}
        title={t("passport.shareSelected")}
        description={t("passport.passwordPrompt")}
        inputMode="password"
        value={sharePassword}
        onValueChange={setSharePassword}
        busy={sharing}
        onCancel={() => {
          if (sharing) return;
          setSharePasswordDialogOpen(false);
          setSharePassword("");
        }}
        onConfirm={confirmCreateShare}
      />
</div>}
function Stat({icon:Icon,value,label}:any){return <Card><CardContent className="p-4"><Icon size={17} className="muted"/><div className="text-3xl font-semibold mt-4 mono-number">{value}</div><div className="text-[11px] muted mt-1">{label}</div></CardContent>
      
</Card>}

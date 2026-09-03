import { AppDialog } from "../components/AppDialog";
import { localizedUiError } from "../lib/ui-error";
import React,{useEffect,useMemo,useState}from'react';
import{Boxes,ChevronRight,History,Network,Plus,RefreshCw,RotateCcw,Save,Trash2,X}from'lucide-react';
import{Link}from'react-router';
import{api,ApiError}from'../lib/api';
import{useAuth}from'../contexts/AuthContext';
import type{PlatformRecord,PlatformRecordVersion,PlatformResourceKey}from'../types';
import{PageHeader}from'../components/PageHeader';
import{Card,CardContent}from'../components/ui/card';
import{Button}from'../components/ui/button';
import{formatDateTime,useI18n}from'../lib/i18n';
import{platformResourceDescription,platformResourceLabel,platformStatusLabel}from'../lib/platform-locale';

type Meta={key:PlatformResourceKey;read:boolean;write:boolean;category:string;label:string;description:string;statusValues:string[];suggestedFields:string[];external:boolean;sensitive:boolean};
const categoryLabels:Record<string,string>={institution:'plat.cat.institution',academic:'plat.cat.academic',governance:'plat.cat.governance',ai:'plat.cat.ai',integrations:'plat.cat.integrations',lifecycle:'plat.cat.lifecycle',commercial:'plat.cat.commercial',trust:'plat.cat.trust',network:'plat.cat.network'};
function pretty(v:unknown){try{return JSON.stringify(v,null,2)}catch{return'{}'}}
export function PlatformHub(){
 const{t,locale}=useI18n();
 const{user}=useAuth();const canCurriculum=!!user&&['department_admin','college_admin','university_admin','accreditation_officer','admin','superadmin','root_owner'].includes(user.role);
 const[resources,setResources]=useState<Meta[]>([]);const[selected,setSelected]=useState<PlatformResourceKey|null>(null);const[records,setRecords]=useState<PlatformRecord[]>([]);const[deleted,setDeleted]=useState(false);const[busy,setBusy]=useState(false);const[error,setError]=useState('');const[editor,setEditor]=useState<{record?:PlatformRecord;title:string;status:string;json:string}|null>(null);const[versions,setVersions]=useState<PlatformRecordVersion[]|null>(null);const[reasonDialog,setReasonDialog]=useState<{open:boolean;kind:'change'|'delete'|'restore';value:string}>({open:false,kind:'change',value:''});const[pendingAction,setPendingAction]=useState<{kind:'save'}|{kind:'delete'|'restore';record:PlatformRecord}|null>(null);
 useEffect(()=>{api.platformResources().then(r=>{setResources(r.resources as Meta[]);if(!selected&&r.resources.length)setSelected(r.resources[0].key)}).catch(e=>{console.error("Failed to load platform resources",e);setError(localizedUiError(e,t,"plat.err.loadResources"))})},[]);
 const metaRaw=resources.find(r=>r.key===selected);const meta=metaRaw?{...metaRaw,label:platformResourceLabel(metaRaw.key,locale,metaRaw.label),description:platformResourceDescription(metaRaw.category,locale)}:undefined;const groups=useMemo(()=>Array.from(new Set(resources.map(x=>x.category))),[resources]);
 const load=async()=>{if(!selected)return;setBusy(true);setError('');try{setRecords((await api.platformRecords(selected,deleted)).records)}catch(e){setError(localizedUiError(e,t,'plat.err.loadResources'))}finally{setBusy(false)}};
 useEffect(()=>{load()},[selected,deleted]);
 const openCreate=()=>{if(!meta)return;const seed=Object.fromEntries(meta.suggestedFields.map(k=>[k,'']));setEditor({title:'',status:meta.statusValues[0]||'active',json:pretty(seed)})};
 const openEdit=(record:PlatformRecord)=>setEditor({record,title:record.title,status:record.status,json:pretty(record.data)});
 const executeSave=async(reason='')=>{if(!selected||!editor)return;let data:Record<string,unknown>;try{data=JSON.parse(editor.json||'{}')}catch{return setError(t('plat.err.invalidJson'))};setBusy(true);setError('');try{if(editor.record)await api.updatePlatformRecord(selected,editor.record.id,{title:editor.title,status:editor.status,data,reason});else await api.createPlatformRecord(selected,{title:editor.title,status:editor.status,data,reason});setEditor(null);await load()}catch(e){setError(localizedUiError(e,t,'plat.err.save'))}finally{setBusy(false)}};
 const save=async()=>{if(!selected||!editor)return;if(meta?.sensitive){setPendingAction({kind:'save'});setReasonDialog({open:true,kind:'change',value:''});return}await executeSave('')};
 const remove=async(record:PlatformRecord)=>{if(!selected)return;setPendingAction({kind:'delete',record});setReasonDialog({open:true,kind:'delete',value:''})};
 const restore=async(record:PlatformRecord)=>{if(!selected)return;setPendingAction({kind:'restore',record});setReasonDialog({open:true,kind:'restore',value:''})};
 const confirmReason=async()=>{const reason=reasonDialog.value.trim();if(!reason||!pendingAction||!selected)return;const action=pendingAction;setReasonDialog({open:false,kind:'change',value:''});setPendingAction(null);if(action.kind==='save'){await executeSave(reason);return}setBusy(true);setError('');try{if(action.kind==='delete')await api.deletePlatformRecord(selected,action.record.id,reason);else await api.restorePlatformRecord(selected,action.record.id,reason);await load()}catch(e){setError(localizedUiError(e,t,action.kind==='delete'?'plat.err.delete':'plat.err.restore'))}finally{setBusy(false)}};
 const history=async(record:PlatformRecord)=>{if(!selected)return;setBusy(true);try{setVersions((await api.platformVersions(selected,record.id)).versions)}finally{setBusy(false)}};
 return <div className="space-y-6"><PageHeader eyebrow={t("ui.institutionPlatformOps")} title={t('plat.title')} description={t('plat.desc')} action={<div className="flex gap-2 flex-wrap">{canCurriculum&&<Button asChild variant="outline"><Link to="/app/curriculum-twin"><Network size={15}/> {t("ui.curriculumTwin")}</Link></Button>}<Button variant="outline" onClick={()=>setDeleted(v=>!v)}>{deleted?t('plat.hideDeleted'):t('plat.trash')}</Button>{meta?.write&&<Button onClick={openCreate}><Plus size={15}/> {t('plat.add')}</Button>}</div>}/>
 {error&&<div className="rounded-xl border border-danger/20 bg-danger/8 p-3 text-sm text-danger">{error}</div>}
 <div className="grid xl:grid-cols-[310px_1fr] gap-5"><Card><CardContent className="p-3"><div className="px-2 py-2"><div className="eyebrow">{t("ui.capabilityMap")}</div><div className="text-sm font-semibold mt-1">{t('plat.manageableResources').replace('{count}',String(resources.length))}</div></div><div className="max-h-[72vh] overflow-auto space-y-4">{groups.map(g=><div key={g}><div className="text-[10px] muted font-semibold px-2 py-1">{categoryLabels[g]?t(categoryLabels[g]):g}</div>{resources.filter(x=>x.category===g).map(r=><button key={r.key} onClick={()=>{setSelected(r.key);setEditor(null);setVersions(null)}} className={`w-full text-start rounded-xl p-2.5 flex gap-2 items-start focus-ring ${selected===r.key?'brand-soft-bg':'hover:bg-[var(--bg)]'}`}><Boxes size={14} className="mt-0.5 shrink-0"/><span className="min-w-0"><span className="text-xs font-semibold block">{platformResourceLabel(r.key,locale,r.label)}</span><span className="text-[9px] muted block mt-1">{r.external?t('plat.requiresExternal'):''}{r.write?t('plat.manage'):t('plat.viewOnly')}</span></span></button>)}</div>)}</div></CardContent></Card>
 <div className="space-y-4">{meta&&<Card><CardContent><div className="flex items-start justify-between gap-3"><div><div className="eyebrow">{meta.key}</div><h2 className="section-title mt-1">{meta.label}</h2><p className="body-copy mt-2 max-w-3xl">{meta.description}</p></div><button onClick={load} className="focus-ring rounded-lg p-2 hover:bg-[var(--bg)]" aria-label={t('plat.refresh')}><RefreshCw size={16} className={busy?'animate-spin':''}/></button></div>{meta.external&&<div className="mt-4 rounded-xl border hairline bg-[var(--bg)] p-3 text-[11px] muted">{t('plat.externalNote')}</div>}</CardContent></Card>}
 {records.length?<div className="grid lg:grid-cols-2 gap-3">{records.map(r=><Card key={r.id}><CardContent><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="eyebrow">v{r.version} · {platformStatusLabel(r.status,locale)}</div><h3 className="font-semibold mt-1 truncate">{r.title}</h3><div className="text-[10px] muted mt-1">{formatDateTime(r.updatedAt,locale)}</div></div><ChevronRight size={16} className="muted directional-icon"/></div><div className="mt-4 rounded-xl bg-[var(--bg)] p-3 max-h-40 overflow-auto"><pre className="text-[10px] whitespace-pre-wrap break-words font-mono" dir="ltr">{pretty(r.data)}</pre></div><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>history(r)}><History size={13}/> {t('plat.versions')}</Button>{meta?.write&&!r.deletedAt&&<Button size="sm" variant="outline" onClick={()=>openEdit(r)}><Save size={13}/> {t('plat.edit')}</Button>}{meta?.write&&!r.deletedAt&&<Button size="sm" variant="outline" onClick={()=>remove(r)}><Trash2 size={13}/> {t('plat.softDelete')}</Button>}{meta?.write&&r.deletedAt&&<Button size="sm" variant="outline" onClick={()=>restore(r)}><RotateCcw size={13}/> {t('plat.restore')}</Button>}</div></CardContent></Card>)}</div>:<Card><CardContent className="py-12 text-center"><Boxes size={24} className="mx-auto muted"/><div className="font-semibold mt-3">{t('plat.noRecords')}</div><p className="body-copy mt-1">{t('plat.noRecordsHint')}</p></CardContent></Card>}
 </div></div>
 {editor&&<div className="fixed inset-0 z-[80] bg-black/35 flex items-end lg:items-center justify-center p-3" onMouseDown={e=>{if(e.target===e.currentTarget)setEditor(null)}}><div className="panel w-full max-w-2xl rounded-3xl p-5 max-h-[90vh] overflow-auto"><div className="flex justify-between gap-3"><div><div className="eyebrow">{editor.record?t("ui.editVersionedRecord"):t("ui.createRecord")}</div><h2 className="section-title mt-1">{meta?.label}</h2></div><button onClick={()=>setEditor(null)} className="focus-ring p-2 rounded-lg"><X size={17}/></button></div><label className="block mt-5 text-xs font-semibold">{t('plat.fieldTitle')}<input value={editor.title} onChange={e=>setEditor({...editor,title:e.target.value})} className="field mt-2 w-full"/></label><label className="block mt-4 text-xs font-semibold">{t('plat.fieldStatus')}<select value={editor.status} onChange={e=>setEditor({...editor,status:e.target.value})} className="field mt-2 w-full">{meta?.statusValues.map(x=><option key={x} value={x}>{platformStatusLabel(x,locale)}</option>)}</select></label><label className="block mt-4 text-xs font-semibold">{t('plat.fieldData')}<textarea dir="ltr" value={editor.json} onChange={e=>setEditor({...editor,json:e.target.value})} rows={15} className="field mt-2 w-full font-mono text-xs resize-y"/></label><div className="text-[10px] muted mt-2">{t('plat.suggestedFields').replace('{fields}',meta?.suggestedFields.join(' · ')||'—')}</div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={()=>setEditor(null)}>{t('plat.cancel')}</Button><Button disabled={busy||!editor.title.trim()} onClick={save}><Save size={14}/> {t('plat.save')}</Button></div></div></div>}
 {versions&&<div className="fixed inset-0 z-[85] bg-black/35 flex items-end lg:items-center justify-center p-3" onMouseDown={e=>{if(e.target===e.currentTarget)setVersions(null)}}><div className="panel w-full max-w-2xl rounded-3xl p-5 max-h-[85vh] overflow-auto"><div className="flex justify-between"><div><div className="eyebrow">{t("ui.immutableHistory")}</div><h2 className="section-title mt-1">{t('plat.versionHistory')}</h2></div><button onClick={()=>setVersions(null)} className="focus-ring p-2"><X size={17}/></button></div><div className="mt-5 space-y-3">{versions.map(v=><div key={v.id} className="rounded-xl bg-[var(--bg)] border hairline p-3"><div className="flex justify-between"><strong className="text-xs">{t("ui.version")} {v.version}</strong><span className="text-[10px] muted">{formatDateTime(v.createdAt,locale)}</span></div><div className="text-[10px] muted mt-1">{v.reason||t("ui.noReasonSupplied")}</div></div>)}</div></div></div>}
 
      <AppDialog
        open={reasonDialog.open}
        title={
          reasonDialog.kind === "delete"
            ? t("plat.prompt.deleteReason")
            : reasonDialog.kind === "restore"
              ? t("plat.prompt.restoreReason")
              : t("plat.prompt.changeReason")
        }
        inputMode="textarea"
        value={reasonDialog.value}
        onValueChange={(value) =>
          setReasonDialog((current) => ({ ...current, value }))
        }
        danger={reasonDialog.kind === "delete"}
        onCancel={() => {
          setReasonDialog({ open: false, kind: "change", value: "" });
          setPendingAction(null);
        }}
        onConfirm={confirmReason}
      />
</div>;
}

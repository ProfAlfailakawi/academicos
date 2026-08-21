import { randomUUID } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import type { NotificationPreferences, NotificationRecord, UserRole } from '../types';
import { platformStore } from './platform-store';

const COLLECTION='notifications';
const PREFERENCES='notificationPreferences';
const now=()=>new Date().toISOString();
const db=()=>getFirestore();

type CreateNotice=Omit<NotificationRecord,'id'|'createdAt'|'delivery'>;

export async function createNotification(input:CreateNotice){
  const item:NotificationRecord={...input,id:randomUUID(),createdAt:now(),delivery:Object.fromEntries(input.channels.map(c=>[c,c==='in_app'?'sent':'pending']))};
  await db().collection(COLLECTION).doc(item.id).set(item);
  return item;
}

export async function listNotifications(tenantId:string,userId:string,role:UserRole,limit=100){
  const directSnap=await db().collection(COLLECTION).where('tenantId','==',tenantId).where('userId','==',userId).limit(Math.min(200,Math.max(1,limit))).get();
  const direct=directSnap.docs.map(d=>d.data() as NotificationRecord).filter(x=>!x.archivedAt&&(!x.snoozedUntil||Date.parse(x.snoozedUntil)<=Date.now())&&(!x.expiresAt||new Date(x.expiresAt).getTime()>Date.now()));
  const announcements=await platformStore.list('announcements',tenantId,{status:'published',limit:100});
  const projected:NotificationRecord[]=announcements.filter(a=>{
    const data=a.data||{};const roles=Array.isArray(data.roles)?data.roles.map(String):[];const users=Array.isArray(data.userIds)?data.userIds.map(String):[];
    const audience=String(data.audience||'all');
    if(users.length&&users.includes(userId))return true;
    if(roles.length&&roles.includes(role))return true;
    return audience==='all'||audience==='students'&&['student','student_group_leader'].includes(role)||audience==='faculty'&&['teaching_assistant','professor','course_coordinator'].includes(role)||audience==='institution'&& !['employer'].includes(role);
  }).filter(a=>!a.data.expiresAt||new Date(String(a.data.expiresAt)).getTime()>Date.now()).map(a=>({id:`announcement:${a.id}`,tenantId,userId,type:'announcement',priority:(['critical','important','normal'].includes(String(a.data.priority))?String(a.data.priority):'normal') as NotificationRecord['priority'],title:a.title,body:String(a.data.message||a.data.body||''),targetPath:a.data.targetPath?String(a.data.targetPath):undefined,channels:['in_app'],delivery:{in_app:'sent'},createdAt:String(a.data.publishAt||a.createdAt),expiresAt:a.data.expiresAt?String(a.data.expiresAt):undefined}));
  return [...direct,...projected].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,limit);
}

export async function markNotificationRead(id:string,tenantId:string,userId:string){
  if(id.startsWith('announcement:'))return true;
  const ref=db().collection(COLLECTION).doc(id);const snap=await ref.get();if(!snap.exists)return false;const x=snap.data() as NotificationRecord;if(x.tenantId!==tenantId||x.userId!==userId)return false;await ref.set({readAt:now()},{merge:true});return true;
}

export async function updateNotificationState(id:string,tenantId:string,userId:string,patch:{read?:boolean;archive?:boolean;snoozedUntil?:string}){
  if(id.startsWith('announcement:'))return false;const ref=db().collection(COLLECTION).doc(id),snap=await ref.get();if(!snap.exists)return false;const item=snap.data() as NotificationRecord;if(item.tenantId!==tenantId||item.userId!==userId)return false;
  const next:Record<string,unknown>={};if(patch.read!==undefined)next.readAt=patch.read?now():null;if(patch.archive)next.archivedAt=now();if(patch.snoozedUntil){const until=Date.parse(patch.snoozedUntil);if(!Number.isFinite(until)||until<=Date.now()||until>Date.now()+30*86400000)throw Object.assign(new Error('Snooze must be within the next 30 days'),{status:400,code:'INVALID_SNOOZE'});next.snoozedUntil=new Date(until).toISOString();}await ref.set(next,{merge:true});return true;
}

export async function markAllNotificationsRead(tenantId:string,userId:string){const snap=await db().collection(COLLECTION).where('tenantId','==',tenantId).where('userId','==',userId).limit(500).get();const batch=db().batch(),at=now();let count=0;for(const doc of snap.docs){if(!doc.data().readAt){batch.set(doc.ref,{readAt:at},{merge:true});count++;}}if(count)await batch.commit();return count;}

const defaultPreferences:NotificationPreferences={inApp:true,email:true,push:false,smsCriticalOnly:false,digest:'realtime',quietHours:{enabled:true,start:'22:00',end:'07:00'},timezone:'Asia/Kuwait'};
export async function getNotificationPreferences(tenantId:string,userId:string){const doc=await db().collection(PREFERENCES).doc(`${tenantId}__${userId}`).get();return{...defaultPreferences,...(doc.exists?doc.data():{}),quietHours:{...defaultPreferences.quietHours,...(doc.data()?.quietHours||{})}} as NotificationPreferences;}
export async function saveNotificationPreferences(tenantId:string,userId:string,input:Partial<NotificationPreferences>){const current=await getNotificationPreferences(tenantId,userId),digest=['realtime','daily','weekly'].includes(String(input.digest))?input.digest:current.digest,time=/^([01]\d|2[0-3]):[0-5]\d$/;const quiet={...current.quietHours,...(input.quietHours||{})};if(!time.test(quiet.start)||!time.test(quiet.end))throw Object.assign(new Error('Quiet hours are invalid'),{status:400,code:'INVALID_QUIET_HOURS'});const next:NotificationPreferences={inApp:input.inApp??current.inApp,email:input.email??current.email,push:input.push??current.push,smsCriticalOnly:input.smsCriticalOnly??current.smsCriticalOnly,digest:digest!,quietHours:quiet,timezone:String(input.timezone||current.timezone).slice(0,80)};await db().collection(PREFERENCES).doc(`${tenantId}__${userId}`).set({...next,tenantId,userId,updatedAt:now()});return next;}

export async function sendConfiguredEmail(input:{to:string;subject:string;text:string;tenantId:string;notificationId?:string}){
  const endpoint=process.env.EMAIL_DELIVERY_ENDPOINT;const apiKey=process.env.EMAIL_API_KEY;const provider=process.env.EMAIL_PROVIDER;
  if(!endpoint||!apiKey||!provider)return {configured:false,sent:false,reason:'Transactional email is not configured'};
  if(!endpoint.startsWith('https://'))throw Object.assign(new Error('EMAIL_DELIVERY_ENDPOINT must use HTTPS'),{code:'EMAIL_ENDPOINT_INVALID'});
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${apiKey}`},body:JSON.stringify({provider,to:input.to,subject:input.subject,text:input.text,metadata:{tenantId:input.tenantId,notificationId:input.notificationId}}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Object.assign(new Error(`Email provider failed with HTTP ${response.status}`),{code:'EMAIL_PROVIDER_ERROR'});
  return {configured:true,sent:true};
}

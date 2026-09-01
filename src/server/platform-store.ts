import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { AIOutputFeedback, ApiKeyRecord, JobRecord, PlatformMetrics, PlatformRecord, PlatformRecordVersion, PlatformResourceKey, ProductEventRecord, PublicShareRecord } from '../types';
import { isPaidProjectPlan, projectAccessFromEntitlements, type PaidProjectPlanId } from './project-access';

const MAX_PAGE = 200;
const COLLECTION_PREFIX = 'platform_';
const VERSIONS = 'platform_recordVersions';
const EVENTS = 'productEvents';
const FEEDBACK = 'aiFeedback';
const JOBS = 'jobs';
const API_KEYS = 'apiKeys';
const PUBLIC_SHARES = 'publicShares';
const AUDIT = 'auditLogs';
const AI_BUDGET_RESERVATIONS = 'aiBudgetReservations';
const AI_BUDGET_COUNTERS = 'aiBudgetReservationCounters';
const EXTERNAL_WEBHOOK_EVENTS = 'externalWebhookEvents';

function db(){ return getFirestore(); }
function collectionFor(resource:PlatformResourceKey){ return `${COLLECTION_PREFIX}${resource}`; }
function now(){ return new Date().toISOString(); }
function hash(value:string){ return createHash('sha256').update(value).digest('hex'); }
const scryptAsync=promisify(scrypt);
async function passwordDigest(value:string,salt:string){return await scryptAsync(value,salt,32) as Buffer;}
async function hashPassword(value:string){const salt=randomBytes(16).toString('hex');const digest=await passwordDigest(value,salt);return `${salt}:${digest.toString('hex')}`;}
async function verifyPassword(value:string,stored:string){const [salt,expected='']=stored.split(':');if(!salt||!expected)return false;const actual=await passwordDigest(value,salt);const exp=Buffer.from(expected,'hex');return actual.length===exp.length&&timingSafeEqual(actual,exp);}

export const PLATFORM_RESOURCES:PlatformResourceKey[] = [
  'institutions','campuses','departments','programs','academicTerms','enrollments','affiliations','institutionDirectory',
  'templates','templateVersions','semesterTemplates','regionalAcademicStyles','gradingScales','accommodations','alternativeDeadlines',
  'challenges','challengePolicies','marketplaceItems','marketplacePolicies','announcements','notificationRules','announcementsAudit',
  'webhooks','apiKeys','jobs','deletionRequests','backupRuns','backupPolicies','migrationRuns','rolloverRuns','recycleBin',
  'aiModels','aiPrompts','aiEvaluations','aiRoutingPolicies','aiBudgets','aiAuditSamples','knowledgeBase','organizationKnowledge',
  'retentionPolicies','dataResidencyPolicies','minorUserPolicies','privacyPolicies','credentials','credentialPolicies',
  'nationalFrameworks','accreditationSnapshots','outcomeSamples','institutionBenchmarks','curriculumMaps',
  'contracts','entitlements','licenses','seatAssignments','slaPolicies','salesLeads','supportEntitlements',
  'securityReports','securityAlerts','securityEventsConfig','subscriptions','transactions','fraudRules','profitGuardrails',
  'externalTools','externalToolPolicies','integrationConfigs','lmsConfigs','ssoConfigs','emailConfigs','emailTemplates','emailPreferences',
  'referenceLibrary','researchSources','semanticIndexes','courseImports','gradeImports','submissionAttempts',
  'dataExports','portfolioItems','portfolioPolicies','publicTrustIndicators','userReports','institutionFeedback',
  'ipPolicies','systemConfig','brandConfig','currencySettings','serviceIncidents','domainClaims','institutionVerifications',
];

function assertResource(resource:string):asserts resource is PlatformResourceKey {
  if(!PLATFORM_RESOURCES.includes(resource as PlatformResourceKey)) throw Object.assign(new Error('Unknown platform resource'),{status:404,code:'RESOURCE_NOT_FOUND'});
}

async function audit(tenantId:string,actor:string,action:string,target:string,reason?:string,extra:Record<string,unknown>={}){
  const ref=db().collection(AUDIT).doc();
  await ref.set({id:ref.id,tenant:tenantId,actor,action,target,reason:reason||null,timestamp:now(),...extra});
}

export const platformStore = {
  assertResource,
  async list(resource:PlatformResourceKey,tenantId:string,options:{includeDeleted?:boolean;limit?:number;status?:string}={}){
    let query:any=db().collection(collectionFor(resource)).where('tenantId','==',tenantId);
    if(options.status) query=query.where('status','==',options.status);
    const snap=await query.limit(Math.min(MAX_PAGE,Math.max(1,options.limit||100))).get();
    return snap.docs.map((d:any)=>d.data() as PlatformRecord).filter((r:PlatformRecord)=>options.includeDeleted||!r.deletedAt).sort((a:PlatformRecord,b:PlatformRecord)=>b.updatedAt.localeCompare(a.updatedAt));
  },
  async get(resource:PlatformResourceKey,id:string,tenantId:string){
    const doc=await db().collection(collectionFor(resource)).doc(id).get();
    if(!doc.exists)return null;const item=doc.data() as PlatformRecord;return item.tenantId===tenantId?item:null;
  },
  async create(resource:PlatformResourceKey,tenantId:string,actorId:string,input:{title:string;status?:string;data?:Record<string,unknown>;ownerId?:string},reason?:string){
    const at=now();const id=randomUUID();
    const record:PlatformRecord={id,resource,tenantId,ownerId:input.ownerId,status:input.status||'active',title:input.title,data:input.data||{},version:1,createdBy:actorId,updatedBy:actorId,createdAt:at,updatedAt:at};
    const batch=db().batch();const ref=db().collection(collectionFor(resource)).doc(id);const versionRef=db().collection(VERSIONS).doc();
    batch.set(ref,record);batch.set(versionRef,{id:versionRef.id,recordId:id,resource,tenantId,version:1,snapshot:record,actorId,reason,createdAt:at} satisfies PlatformRecordVersion);
    await batch.commit();await audit(tenantId,actorId,`${resource}.create`,id,reason,{status:record.status});return record;
  },
  async update(resource:PlatformResourceKey,id:string,tenantId:string,actorId:string,patch:{title?:string;status?:string;data?:Record<string,unknown>},reason?:string){
    const ref=db().collection(collectionFor(resource)).doc(id);let next!:PlatformRecord;
    await db().runTransaction(async tx=>{const doc=await tx.get(ref);if(!doc.exists)throw Object.assign(new Error('Record not found'),{status:404,code:'NOT_FOUND'});const current=doc.data() as PlatformRecord;if(current.tenantId!==tenantId)throw Object.assign(new Error('Record is outside tenant scope'),{status:403,code:'TENANT_SCOPE'});const at=now();next={...current,title:patch.title??current.title,status:patch.status??current.status,data:patch.data?{...current.data,...patch.data}:current.data,version:Number(current.version||1)+1,updatedBy:actorId,updatedAt:at};tx.set(ref,next,{merge:true});const v=db().collection(VERSIONS).doc();tx.set(v,{id:v.id,recordId:id,resource,tenantId,version:next.version,snapshot:next,actorId,reason,createdAt:at} satisfies PlatformRecordVersion);});
    await audit(tenantId,actorId,`${resource}.update`,id,reason,{version:next.version,status:next.status});return next;
  },
  async softDelete(resource:PlatformResourceKey,id:string,tenantId:string,actorId:string,reason:string){
    const current=await this.get(resource,id,tenantId);if(!current)return false;const at=now();await db().collection(collectionFor(resource)).doc(id).set({...current,deletedAt:at,deletedBy:actorId,status:'deleted',updatedAt:at,updatedBy:actorId},{merge:true});await audit(tenantId,actorId,`${resource}.delete`,id,reason,{softDelete:true});return true;
  },
  async restore(resource:PlatformResourceKey,id:string,tenantId:string,actorId:string,reason:string){
    const current=await this.get(resource,id,tenantId);if(!current)return null;
    const at=now();const version=Number(current.version||1)+1;
    const restored:PlatformRecord={...current,status:current.status==='deleted'?'active':current.status,updatedAt:at,updatedBy:actorId,version};
    delete restored.deletedAt;delete restored.deletedBy;
    const ref=db().collection(collectionFor(resource)).doc(id);const versionRef=db().collection(VERSIONS).doc();const batch=db().batch();
    batch.set(ref,{status:restored.status,updatedAt:at,updatedBy:actorId,version,deletedAt:FieldValue.delete(),deletedBy:FieldValue.delete()},{merge:true});
    batch.set(versionRef,{id:versionRef.id,recordId:id,resource,tenantId,version,snapshot:restored,actorId,reason,createdAt:at} satisfies PlatformRecordVersion);
    await batch.commit();await audit(tenantId,actorId,`${resource}.restore`,id,reason,{version});return restored;
  },
  async versions(resource:PlatformResourceKey,id:string,tenantId:string){const snap=await db().collection(VERSIONS).where('tenantId','==',tenantId).where('resource','==',resource).where('recordId','==',id).limit(100).get();return snap.docs.map(d=>d.data() as PlatformRecordVersion).sort((a,b)=>b.version-a.version);},
  async recordEvent(event:Omit<ProductEventRecord,'id'|'createdAt'>){const ref=db().collection(EVENTS).doc();const item:ProductEventRecord={...event,provenance:event.provenance||'server',id:ref.id,createdAt:now()};await ref.set(item);return item;},
  async metrics(tenantId:string):Promise<PlatformMetrics>{
    const [events,ai]=await Promise.all([
      db().collection(EVENTS).where('tenantId','==',tenantId).limit(5000).get(),
      db().collection('aiRuns').where('tenantId','==',tenantId).limit(5000).get(),
    ]);
    const authoritative=events.docs.map(d=>d.data()).filter(x=>x.provenance!=='client');
    const counts:Record<string,number>={};
    for(const x of authoritative){const n=String(x.name||'unknown');counts[n]=(counts[n]||0)+1;}
    const users=new Set(authoritative.map(x=>String(x.userId||'')).filter(Boolean));
    const usersFor=(names:string[])=>new Set(authoritative.filter(x=>names.includes(String(x.name||''))).map(x=>String(x.userId||'')).filter(Boolean));
    const activatedUsers=usersFor(['assignment_uploaded','workspace_created','tutor_explained','exam_material_ingested']);
    const uploadedUsers=usersFor(['assignment_uploaded']);
    const parsedUsers=usersFor(['assignment_parsed']);
    const paidUsers=usersFor(['subscription_started']);
    const auditUsers=usersFor(['audit_run']);
    const vivaUsers=usersFor(['viva_completed']);
    const secondProjectUsers=new Set<string>();
    const projectsByUser=new Map<string,Set<string>>();
    const startedProjects=new Set<string>();
    const completedProjects=new Set<string>();
    for(const x of authoritative){
      const u=String(x.userId||'');
      const projectId=String(x.projectId||'');
      if(x.name==='project_started' && u){
        const set=projectsByUser.get(u)||new Set<string>();
        set.add(projectId||`event:${u}:${set.size}`);
        projectsByUser.set(u,set);
        if(set.size>=2)secondProjectUsers.add(u);
        if(projectId)startedProjects.add(projectId);
      }
      if(x.name==='project_completed' && projectId)completedProjects.add(projectId);
    }
    const totalUsers=Math.max(1,users.size);
    const aiFailures=ai.docs.filter(d=>Boolean(d.data().error||d.data().failed)).length;
    const aiCost=ai.docs.reduce((sum,d)=>sum+Number(d.data().estimatedCostUsd||0),0);
    return {
      activation:Number((activatedUsers.size/totalUsers).toFixed(3)),
      firstAssignmentSuccess:Number((parsedUsers.size/Math.max(1,uploadedUsers.size)).toFixed(3)),
      secondProjectRetention:Number((secondProjectUsers.size/totalUsers).toFixed(3)),
      projectCompletion:Number((completedProjects.size/Math.max(1,startedProjects.size)).toFixed(3)),
      paidConversion:Number((paidUsers.size/totalUsers).toFixed(3)),
      submissionAuditUsage:Number((auditUsers.size/totalUsers).toFixed(3)),
      vivaUsage:Number((vivaUsers.size/totalUsers).toFixed(3)),
      eventCounts:counts,
      ai:{runs:ai.size,costUsd:Number(aiCost.toFixed(4)),failures:aiFailures},
    };
  },
  async aiBudgetStatus(tenantId:string,userId?:string){
    const [budgets,runs]=await Promise.all([this.list('aiBudgets',tenantId,{limit:50,status:'active'}),db().collection('aiRuns').where('tenantId','==',tenantId).limit(5000).get()]);
    const tenantBudget=budgets.find(b=>!b.data?.userId);const userBudget=userId?budgets.find(b=>String(b.data?.userId||'')===userId):undefined;const selected=userBudget||tenantBudget;
    const month=new Date().toISOString().slice(0,7);const current=runs.docs.map(d=>d.data()).filter(x=>String(x.createdAt||'').startsWith(month)&&(!userBudget||String(x.userId||'')===userId));
    const spent=Number(current.reduce((sum,x)=>sum+Number(x.estimatedCostUsd||0),0).toFixed(6));
    const limit=Number(selected?.data?.monthlyBudgetUsd??selected?.data?.monthlyAiBudgetUsd??0);const softPct=Math.min(1,Math.max(0.1,Number(selected?.data?.softLimitPct??0.8)));const hard=Boolean(selected?.data?.hardLimit===true||selected?.data?.enforcement==='hard');
    return{spentUsd:spent,limitUsd:limit||null,softLimitReached:Boolean(limit&&spent>=limit*softPct),hardLimitReached:Boolean(limit&&spent>=limit),hardEnforced:hard,budgetRecordId:selected?.id||null,scope:userBudget?'user' as const:'tenant' as const,scopeUserId:userBudget?userId:undefined};
  },
  async reserveAiBudget(tenantId:string,userId:string){
    const status=await this.aiBudgetStatus(tenantId,userId);
    if(!status.hardEnforced||!status.limitUsd)return{reservation:null,status};
    const reservedUsd=Math.max(0.01,Number(process.env.AI_REQUEST_RESERVE_USD||1));
    const scopeKey=status.scope==='user'?`user_${userId}`:'tenant';
    const counterId=createHash('sha256').update(`${tenantId}:${new Date().toISOString().slice(0,7)}:${scopeKey}`).digest('hex');
    const counterRef=db().collection(AI_BUDGET_COUNTERS).doc(counterId),reservationRef=db().collection(AI_BUDGET_RESERVATIONS).doc();
    await db().runTransaction(async tx=>{
      const counter=await tx.get(counterRef);const pending=Number(counter.data()?.pendingUsd||0);
      if(status.spentUsd+pending+reservedUsd>status.limitUsd!)throw Object.assign(new Error('Monthly AI capacity has reached the configured hard limit.'),{status:429,code:'AI_BUDGET_HARD_LIMIT'});
      const at=now();tx.set(counterRef,{tenantId,scope:status.scope,scopeUserId:status.scopeUserId||null,month:at.slice(0,7),pendingUsd:pending+reservedUsd,updatedAt:at},{merge:true});
      tx.set(reservationRef,{id:reservationRef.id,counterId,tenantId,userId,reservedUsd,status:'active',createdAt:at,expiresAt:new Date(Date.now()+10*60_000).toISOString()});
    });
    return{reservation:{id:reservationRef.id,counterId,reservedUsd},status};
  },
  async releaseAiBudgetReservation(reservation:{id:string;counterId:string;reservedUsd:number}|null){
    if(!reservation)return;
    const reservationRef=db().collection(AI_BUDGET_RESERVATIONS).doc(reservation.id),counterRef=db().collection(AI_BUDGET_COUNTERS).doc(reservation.counterId);
    await db().runTransaction(async tx=>{const [record,counter]=await Promise.all([tx.get(reservationRef),tx.get(counterRef)]);if(!record.exists||record.data()?.status!=='active')return;const pending=Math.max(0,Number(counter.data()?.pendingUsd||0)-reservation.reservedUsd);tx.set(counterRef,{pendingUsd:pending,updatedAt:now()},{merge:true});tx.set(reservationRef,{status:'released',releasedAt:now()},{merge:true});});
  },
  async feedback(input:Omit<AIOutputFeedback,'id'|'createdAt'>){const ref=db().collection(FEEDBACK).doc();const item:AIOutputFeedback={...input,id:ref.id,createdAt:now()};await ref.set(item);await audit(input.tenantId,input.userId,'ai.feedback',input.runId,undefined,{verdict:input.verdict});return item;},
  async createJob(input:Omit<JobRecord,'id'|'createdAt'|'updatedAt'>){
    if(input.idempotencyKey){const id=createHash('sha256').update(`${input.tenantId}:${input.userId}:${input.type}:${input.idempotencyKey}`).digest('hex'),ref=db().collection(JOBS).doc(id);let result!:JobRecord;await db().runTransaction(async tx=>{const existing=await tx.get(ref);if(existing.exists){const current=existing.data() as JobRecord;if(input.inputHash&&current.inputHash&&input.inputHash!==current.inputHash)throw Object.assign(new Error('Idempotency key was already used for different input'),{status:409,code:'IDEMPOTENCY_CONFLICT'});result=current;return}const at=now();result={...input,id,createdAt:at,updatedAt:at};tx.set(ref,result)});return result;}
    const ref=db().collection(JOBS).doc();const at=now();const job:JobRecord={...input,id:ref.id,createdAt:at,updatedAt:at};await ref.set(job);return job;
  },
  async updateJob(id:string,tenantId:string,patch:Partial<Pick<JobRecord,'state'|'progress'|'stages'|'resultRef'|'error'>>){const ref=db().collection(JOBS).doc(id);const doc=await ref.get();if(!doc.exists)return null;const current=doc.data() as JobRecord;if(current.tenantId!==tenantId)return null;const next={...current,...patch,updatedAt:now()};await ref.set(next,{merge:true});return next as JobRecord;},
  async claimExternalWebhook(provider:string,eventId:string){
    const id=hash(`${provider}:${eventId}`),ref=db().collection(EXTERNAL_WEBHOOK_EVENTS).doc(id);let claimed=false;
    await db().runTransaction(async tx=>{const doc=await tx.get(ref),current=doc.data();const updatedAt=Date.parse(String(current?.updatedAt||''));if(current?.status==='completed'||(current?.status==='processing'&&Number.isFinite(updatedAt)&&Date.now()-updatedAt<5*60_000))return;claimed=true;tx.set(ref,{id,provider,eventId,status:'processing',attempts:FieldValue.increment(1),updatedAt:now(),createdAt:current?.createdAt||now()},{merge:true});});
    return{claimed,id};
  },
  async completeExternalWebhook(id:string,status:'completed'|'failed',error?:string){await db().collection(EXTERNAL_WEBHOOK_EVENTS).doc(id).set({status,updatedAt:now(),...(error?{error:error.slice(0,500)}:{error:FieldValue.delete()})},{merge:true});},
  async projectEntitlementAccess(tenantId:string,userId:string,projectId:string){
    const snap=await db().collection(collectionFor('entitlements')).where('ownerId','==',userId).limit(100).get();
    const records=snap.docs.map(d=>d.data() as PlatformRecord).filter(record=>record.tenantId===tenantId);
    return projectAccessFromEntitlements(records,projectId);
  },
  async grantProjectEntitlement(input:{tenantId:string;userId:string;projectId:string;planId:PaidProjectPlanId;provider:string;externalId:string;eventId:string;externalRefs?:string[]}){
    if(!input.tenantId||!input.userId||!input.projectId||!input.externalId||!isPaidProjectPlan(input.planId))throw Object.assign(new Error('Project entitlement metadata is incomplete'),{status:400,code:'PAYMENT_METADATA_INVALID'});
    const id=hash(`project-entitlement:${input.provider}:${input.externalId}:${input.tenantId}:${input.projectId}`),ref=db().collection(collectionFor('entitlements')).doc(id);let record!:PlatformRecord;
    await db().runTransaction(async tx=>{const existing=await tx.get(ref);if(existing.exists){record=existing.data() as PlatformRecord;if(record.status!=='active'){const at=now();record={...record,status:'active',updatedBy:input.provider,updatedAt:at,version:Number(record.version||1)+1,data:{...record.data,planId:input.planId,eventId:input.eventId,reactivatedAt:at}};tx.set(ref,record,{merge:true});}return;}const at=now();record={id,resource:'entitlements',tenantId:input.tenantId,ownerId:input.userId,status:'active',title:`AcademicOS ${input.planId}`,data:{kind:'project',projectId:input.projectId,planId:input.planId,provider:input.provider,externalId:input.externalId,externalRefs:[...new Set([input.externalId,...(input.externalRefs||[])].filter(Boolean))],eventId:input.eventId,activatedAt:at},version:1,createdBy:input.provider,updatedBy:input.provider,createdAt:at,updatedAt:at};tx.set(ref,record);});
    await audit(input.tenantId,input.provider,'project_entitlement.grant',id,`${input.provider} verified payment`,{projectId:input.projectId,userId:input.userId,planId:input.planId,eventId:input.eventId});return record;
  },
  async revokeProjectEntitlement(input:{tenantId:string;userId:string;projectId:string;provider:string;externalId?:string;eventId:string;reason:'refunded'|'chargeback'}){
    if(!input.tenantId||!input.userId||!input.projectId)throw Object.assign(new Error('Project entitlement metadata is incomplete'),{status:400,code:'PAYMENT_METADATA_INVALID'});
    const snap=await db().collection(collectionFor('entitlements')).where('ownerId','==',input.userId).limit(MAX_PAGE).get();const candidates=snap.docs.filter(doc=>{const x=doc.data() as PlatformRecord;return x.tenantId===input.tenantId&&x.status==='active'&&String(x.data?.kind||'')==='project'&&String(x.data?.projectId||'')===input.projectId&&String(x.data?.provider||'')===input.provider;});
    const exact=input.externalId?candidates.filter(doc=>{const data=doc.data().data||{};return String(data.externalId||'')===input.externalId||(Array.isArray(data.externalRefs)&&data.externalRefs.map(String).includes(input.externalId!));}):[];const matches=exact.length?exact:candidates.sort((a,b)=>String(b.data().updatedAt||'').localeCompare(String(a.data().updatedAt||''))).slice(0,1);
    if(!matches.length)return 0;const batch=db().batch(),at=now();for(const doc of matches)batch.set(doc.ref,{status:'revoked',updatedAt:at,updatedBy:input.provider,version:FieldValue.increment(1),data:{...doc.data().data,revokedAt:at,revocationReason:input.reason,revocationEventId:input.eventId,revocationExternalId:input.externalId||null}},{merge:true});await batch.commit();await audit(input.tenantId,input.provider,'project_entitlement.revoke',input.projectId,input.reason,{projectId:input.projectId,userId:input.userId,eventId:input.eventId,count:matches.length});return matches.length;
  },
  async listJobs(tenantId:string,userId?:string){let q:any=db().collection(JOBS).where('tenantId','==',tenantId);if(userId)q=q.where('userId','==',userId);const snap=await q.limit(100).get();return snap.docs.map((d:any)=>d.data() as JobRecord).sort((a:JobRecord,b:JobRecord)=>b.updatedAt.localeCompare(a.updatedAt));},
  async createApiKey(tenantId:string,actorId:string,name:string,scopes:string[],expiresAt?:string){const raw=`aos_${randomBytes(30).toString('base64url')}`;const id=randomUUID();const prefix=raw.slice(0,12);const record:ApiKeyRecord={id,tenantId,name,prefix,scopes:[...new Set(scopes)].slice(0,30),status:'active',createdBy:actorId,createdAt:now(),expiresAt};await db().collection(API_KEYS).doc(id).set({...record,keyHash:hash(raw)});await audit(tenantId,actorId,'api_key.create',id,undefined,{name,prefix,scopes:record.scopes});return {record,secret:raw};},
  async listApiKeys(tenantId:string){const snap=await db().collection(API_KEYS).where('tenantId','==',tenantId).limit(100).get();return snap.docs.map(d=>{const x=d.data();delete x.keyHash;return x as ApiKeyRecord}).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));},
  async revokeApiKey(id:string,tenantId:string,actorId:string,reason:string){const ref=db().collection(API_KEYS).doc(id);const doc=await ref.get();if(!doc.exists)return false;const x=doc.data();if(x.tenantId!==tenantId)return false;await ref.set({status:'revoked',revokedAt:now()},{merge:true});await audit(tenantId,actorId,'api_key.revoke',id,reason);return true;},
  async authenticateApiKey(raw:string,requiredScope?:string){if(!raw.startsWith('aos_'))return null;const prefix=raw.slice(0,12);const snap=await db().collection(API_KEYS).where('prefix','==',prefix).where('status','==','active').limit(10).get();const digest=Buffer.from(hash(raw));for(const doc of snap.docs){const x=doc.data();const stored=Buffer.from(String(x.keyHash||''));if(stored.length===digest.length&&timingSafeEqual(stored,digest)){if(x.expiresAt&&new Date(x.expiresAt).getTime()<Date.now())return null;if(requiredScope && (!Array.isArray(x.scopes) || !x.scopes.includes(requiredScope)))return null;await doc.ref.set({lastUsedAt:now()},{merge:true});return {id:doc.id,tenantId:String(x.tenantId),scopes:(x.scopes||[]) as string[]};}}return null;},
  async createPublicShare(tenantId:string,userId:string,input:{kind:PublicShareRecord['kind'];targetId:string;label:string;expiresAt?:string;snapshot?:Record<string,unknown>;password?:string;watermark?:string}){const token=`share_${randomBytes(24).toString('base64url')}`;const ref=db().collection(PUBLIC_SHARES).doc();const item:PublicShareRecord={id:ref.id,tenantId,userId,kind:input.kind,targetId:input.targetId,tokenHash:hash(token),label:input.label,...(input.expiresAt?{expiresAt:input.expiresAt}:{}),passwordProtected:Boolean(input.password),...(input.watermark?{watermark:input.watermark}:{}),viewCount:0,createdAt:now()};const passwordHash=input.password?await hashPassword(input.password):undefined;await ref.set({...item,snapshot:input.snapshot||{},...(passwordHash?{passwordHash}:{})});await audit(tenantId,userId,'public_share.create',ref.id,undefined,{kind:input.kind,expiresAt:input.expiresAt||null,passwordProtected:Boolean(input.password)});return {share:item,token};},
  async listPublicShares(tenantId:string,userId:string){const snap=await db().collection(PUBLIC_SHARES).where('tenantId','==',tenantId).where('userId','==',userId).limit(100).get();return snap.docs.map(d=>{const x=d.data() as any;delete x.tokenHash;delete x.passwordHash;delete x.snapshot;return x as Omit<PublicShareRecord,'tokenHash'>}).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));},
  async resolvePublicShare(token:string,password?:string){
    const tokenHash=hash(token);const snap=await db().collection(PUBLIC_SHARES).where('tokenHash','==',tokenHash).limit(1).get();if(snap.empty)return null;
    const doc=snap.docs[0],raw=doc.data() as any;const x=raw as PublicShareRecord;const expiry=x.expiresAt?Date.parse(x.expiresAt):null;if(x.revokedAt||(expiry!==null&&(!Number.isFinite(expiry)||expiry<Date.now())))return null;
    const protectedShare=Boolean(raw.passwordHash);const lockedUntil=Date.parse(String(raw.passwordLockedUntil||''));
    if(protectedShare&&Number.isFinite(lockedUntil)&&lockedUntil>Date.now())return {...x,tokenHash:'',snapshot:{},passwordRequired:true,passwordInvalid:true} as PublicShareRecord&{snapshot:Record<string,unknown>;passwordRequired:boolean;passwordInvalid:boolean};
    if(protectedShare&&!password)return {...x,tokenHash:'',snapshot:{},passwordRequired:true,passwordInvalid:false} as PublicShareRecord&{snapshot:Record<string,unknown>;passwordRequired:boolean;passwordInvalid:boolean};
    if(protectedShare&&!(await verifyPassword(String(password),String(raw.passwordHash)))){
      await db().runTransaction(async tx=>{const current=await tx.get(doc.ref);if(!current.exists)return;const failures=Number(current.data()?.passwordFailures||0)+1;tx.set(doc.ref,{passwordFailures:failures,passwordLastFailedAt:now(),...(failures>=5?{passwordLockedUntil:new Date(Date.now()+15*60_000).toISOString()}:{})},{merge:true});});
      return {...x,tokenHash:'',snapshot:{},passwordRequired:true,passwordInvalid:true} as PublicShareRecord&{snapshot:Record<string,unknown>;passwordRequired:boolean;passwordInvalid:boolean};
    }
    await doc.ref.set({viewCount:FieldValue.increment(1),lastViewedAt:now(),passwordFailures:0,passwordLockedUntil:FieldValue.delete()},{merge:true});
    const safe={...x,snapshot:raw.snapshot||{},viewCount:Number(raw.viewCount||0)+1} as any;delete safe.tokenHash;delete safe.passwordHash;delete safe.passwordFailures;delete safe.passwordLockedUntil;return safe as PublicShareRecord & {snapshot:Record<string,unknown>;passwordRequired?:boolean};
  },
  async revokePublicShare(id:string,tenantId:string,userId:string){const ref=db().collection(PUBLIC_SHARES).doc(id);const doc=await ref.get();if(!doc.exists)return false;const x=doc.data() as PublicShareRecord;if(x.tenantId!==tenantId||x.userId!==userId)return false;await ref.set({revokedAt:now()},{merge:true});await audit(tenantId,userId,'public_share.revoke',id);return true;},
  async incrementCounter(tenantId:string,key:string,delta=1){const ref=db().collection('tenantCounters').doc(`${tenantId}__${key}`);await ref.set({tenantId,key,value:FieldValue.increment(delta),updatedAt:now()},{merge:true});},
};

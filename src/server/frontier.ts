// AcademicOS Frontier Engines
// وحدات محرّك جديدة تبني على البنية القائمة دون تكرارها:
//  1) Accreditation Dossier Autopilot   — مُجمِّع ملف الاعتماد التلقائي
//  2) Authorship Passport                — جواز تأليف قابل للتحقق خارجيًا (يبني على Evidence Capsule)
//  3) Deadline Congestion Index          — مؤشر ازدحام المواعيد للفوج (محاكاة Monte-Carlo حتمية)
//  4) Integrity-by-Design Assignment Lint— مُدقّق نزاهة تصميم التكليف
//  5) Grader Fairness Calibration        — معايرة عدالة التصحيح
//  6) Federated Academic Graph           — الرسم الأكاديمي الفيدرالي الحافظ للخصوصية
//
// جميع الدوال نقية وحتمية: لا تستخدم Math.random ولا Date.now داخل منطق الحساب،
// وتقبل now/seed كوسيط لتكون قابلة لإعادة الإنتاج والاختبار.

import { createHash } from 'node:crypto';
import type {
  CourseAssignmentRecord, CourseRecord, CourseSubmissionRecord, EvidenceCapsule, PlatformRecord,
} from '../types';
import { verifyEvidenceCapsule } from './intelligence';

function isoNow(){ return new Date().toISOString(); }
function normalize(value:string){ return String(value||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('en'); }
function unique<T>(items:T[]){ return [...new Set(items)]; }
function digest(value:string){ return createHash('sha256').update(value).digest('hex'); }
function round(n:number,p=1){ const f=10**p; return Math.round(n*f)/f; }
function asStringArray(value:unknown){ return Array.isArray(value)?value.map(String).map(x=>x.trim()).filter(Boolean):[]; }
function dayKey(ts:number){ return new Date(ts).toISOString().slice(0,10); }
function isoWeek(ts:number){ const d=new Date(ts); const day=(d.getUTCDay()+6)%7; d.setUTCDate(d.getUTCDate()-day+3); const first=new Date(Date.UTC(d.getUTCFullYear(),0,4)); const week=1+Math.round(((d.getTime()-first.getTime())/86400000-3+((first.getUTCDay()+6)%7))/7); return `${d.getUTCFullYear()}-W${String(week).padStart(2,'0')}`; }
// PRNG حتمي (mulberry32) لمحاكاة قابلة لإعادة الإنتاج بنفس البذرة.
function mulberry32(seed:number){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function seedFrom(value:string){ return parseInt(digest(value).slice(0,8),16)>>>0; }

// ---------------------------------------------------------------------------
// 1) Accreditation Dossier Autopilot
// ---------------------------------------------------------------------------
export interface AccreditationOutcomeRow {
  outcome:string;
  courseIds:string[];
  assignmentIds:string[];
  assessedSubmissions:number;
  attainmentPercent:number|null; // متوسط نسبة الدرجات على التكليفات المرتبطة (دليل فعلي)
  attainmentMet:boolean|null;    // مقارنة بعتبة الاتقان
  status:'covered'|'thin'|'uncovered';
}
export interface AccreditationDossier {
  generatedAt:string;
  programId?:string;
  programTitle?:string;
  attainmentThreshold:number;
  outcomes:AccreditationOutcomeRow[];
  courses:Array<{ id:string; code:string; title:string; term?:string; outcomeCount:number; assessedAssignmentCount:number }>;
  coverage:{ outcomesTotal:number; covered:number; thin:number; uncovered:number; coveragePercent:number };
  attainment:{ measuredOutcomes:number; metOutcomes:number; averageAttainmentPercent:number|null };
  gaps:{ uncoveredOutcomes:string[]; unassessedOutcomes:string[]; belowThresholdOutcomes:string[] };
  readiness:{ level:'ready'|'needs_evidence'|'gaps'; summary:string };
  provenanceNote:string;
}

function submissionRatio(sub:CourseSubmissionRecord):number|null{
  if(typeof sub.totalScore==='number'&&typeof sub.maxScore==='number'&&sub.maxScore>0)return sub.totalScore/sub.maxScore;
  const grades=sub.rubricGrades||[]; const max=grades.reduce((n,g)=>n+(Number(g.maxPoints)||0),0); if(max<=0)return null;
  const got=grades.reduce((n,g)=>n+(Number(g.awardedPoints)||0),0); return got/max;
}

export function buildAccreditationDossier(
  courses:CourseRecord[], assignments:CourseAssignmentRecord[], submissions:CourseSubmissionRecord[],
  program?:PlatformRecord, curriculumMap?:PlatformRecord, attainmentThreshold=0.7,
):AccreditationDossier{
  const mappedCourseIds=asStringArray(curriculumMap?.data?.courseIds);
  const selected=mappedCourseIds.length?courses.filter(c=>mappedCourseIds.includes(c.id)):courses;
  const selectedIds=new Set(selected.map(c=>c.id));
  const selectedAssignments=assignments.filter(a=>selectedIds.has(a.courseId));
  const assignmentById=new Map(selectedAssignments.map(a=>[a.id,a]));
  const gradedByAssignment=new Map<string,CourseSubmissionRecord[]>();
  for(const s of submissions){ if(!assignmentById.has(s.assignmentId))continue; if(!(s.status==='graded'||s.status==='released'))continue; const list=gradedByAssignment.get(s.assignmentId)||[]; list.push(s); gradedByAssignment.set(s.assignmentId,list); }
  const expected=unique([
    ...asStringArray(program?.data?.outcomes), ...asStringArray(program?.data?.programOutcomes),
    ...asStringArray(curriculumMap?.data?.outcomes), ...asStringArray(curriculumMap?.data?.programOutcomes),
    ...selected.flatMap(c=>c.outcomes), ...selectedAssignments.flatMap(a=>a.outcomes),
  ]);
  const outcomes:AccreditationOutcomeRow[]=expected.map(outcome=>{
    const key=normalize(outcome);
    const courseIds=selected.filter(c=>c.outcomes.some(x=>normalize(x)===key)).map(c=>c.id);
    const linkedAssignments=selectedAssignments.filter(a=>a.outcomes.some(x=>normalize(x)===key));
    const ratios:number[]=[]; for(const a of linkedAssignments)for(const s of gradedByAssignment.get(a.id)||[]){ const r=submissionRatio(s); if(r!==null)ratios.push(r); }
    const ratioMean=ratios.length?ratios.reduce((n,x)=>n+x,0)/ratios.length:null;
    const attainmentPercent=ratioMean===null?null:round(ratioMean*100,1);
    // قارن النسبة غير المقربة بالعتبة حتى لا يرفع التقريب 69.96% إلى "محقق" عند عتبة 70%.
    const attainmentMet=ratioMean===null?null:ratioMean>=attainmentThreshold;
    const status:AccreditationOutcomeRow['status']=courseIds.length===0&&linkedAssignments.length===0?'uncovered':(courseIds.length===1||linkedAssignments.length===0)?'thin':'covered';
    return{ outcome, courseIds, assignmentIds:linkedAssignments.map(a=>a.id), assessedSubmissions:ratios.length, attainmentPercent, attainmentMet, status };
  });
  const covered=outcomes.filter(x=>x.status==='covered').length;
  const thin=outcomes.filter(x=>x.status==='thin').length;
  const uncovered=outcomes.filter(x=>x.status==='uncovered').length;
  const measured=outcomes.filter(x=>x.attainmentPercent!==null);
  const met=measured.filter(x=>x.attainmentMet).length;
  const avg=measured.length?round(measured.reduce((n,x)=>n+(x.attainmentPercent||0),0)/measured.length,1):null;
  const unassessed=outcomes.filter(x=>x.status!=='uncovered'&&x.attainmentPercent===null).map(x=>x.outcome);
  const belowThreshold=measured.filter(x=>!x.attainmentMet).map(x=>x.outcome);
  const level:AccreditationDossier['readiness']['level']=uncovered>0?'gaps':(unassessed.length>0||measured.length===0)?'needs_evidence':'ready';
  const summary=level==='gaps'?`يوجد ${uncovered} مخرج تعلم بلا تغطية ظاهرة؛ لا يكتمل ملف الاعتماد قبل معالجتها.`:level==='needs_evidence'?`التغطية مكتملة لكن ${unassessed.length} مخرج بلا أدلة تقييم مصححة بعد.`:`كل المخرجات مغطاة ومقاسة؛ ${met}/${measured.length} تحقق عتبة الإتقان ${Math.round(attainmentThreshold*100)}%.`;
  return{
    generatedAt:isoNow(), programId:program?.id, programTitle:program?.title, attainmentThreshold,
    outcomes,
    courses:selected.map(c=>({ id:c.id, code:c.code, title:c.title, term:c.term, outcomeCount:c.outcomes.length, assessedAssignmentCount:selectedAssignments.filter(a=>a.courseId===c.id&&(gradedByAssignment.get(a.id)?.length||0)>0).length })),
    coverage:{ outcomesTotal:outcomes.length, covered, thin, uncovered, coveragePercent:outcomes.length?round((covered/outcomes.length)*100,1):0 },
    attainment:{ measuredOutcomes:measured.length, metOutcomes:met, averageAttainmentPercent:avg },
    gaps:{ uncoveredOutcomes:outcomes.filter(x=>x.status==='uncovered').map(x=>x.outcome), unassessedOutcomes:unassessed, belowThresholdOutcomes:belowThreshold },
    readiness:{ level, summary },
    provenanceNote:'كل نسبة إتقان محسوبة من درجات تسليمات مصححة فعليًا (graded/released) مرتبطة بالمخرج عبر التكليفات. لا تُختلق أي أرقام؛ المخرج بلا تسليمات مصححة يظهر كـ"غير مُقاس" لا كـ"محقق".',
  };
}

// ---------------------------------------------------------------------------
// 2) Authorship Passport  (يبني على Evidence Capsule الموقّعة)
// ---------------------------------------------------------------------------
export interface AuthorshipPassport {
  schemaVersion:'1.0';
  generatedAt:string;
  subject:{ projectId:string; projectTitle:string; course:string };
  claims:{ deliverables:number; verifiedEvidence:number; proofOfLearning:number; humanContributors:number; aiAssistedRuns:number; establishedSkills:string[] };
  integrity:{ algorithm:string; hash:string; signatureStatus:EvidenceCapsule['integrity']['signatureStatus']; keyId?:string };
  trustTier:'unsigned'|'self_signed'|'institution_signed';
  verification:{ status:string; hashValid:boolean; signatureValid:boolean|null; signerTrusted:boolean|null };
  disclosure:string;
}

export function buildAuthorshipPassport(
  capsule:EvidenceCapsule, opts:{ trustedSigningPrivateKeyB64?:string; trustedPublicKeySpkiB64url?:string[] }={},
):AuthorshipPassport{
  const verification=verifyEvidenceCapsule(capsule,opts.trustedSigningPrivateKeyB64,opts.trustedPublicKeySpkiB64url||[]);
  const establishedSkills=capsule.skills.filter(s=>s.verificationLevel==='institution').map(s=>s.skill);
  const trustTier:AuthorshipPassport['trustTier']=capsule.integrity.signatureStatus!=='signed'?'unsigned':verification.signerTrusted?'institution_signed':'self_signed';
  return{
    schemaVersion:'1.0', generatedAt:isoNow(),
    subject:{ projectId:capsule.project.id, projectTitle:capsule.project.title, course:capsule.project.course },
    claims:{ deliverables:capsule.deliverables.length, verifiedEvidence:capsule.provenance.verifiedEvidenceItems, proofOfLearning:capsule.proofOfLearning.length, humanContributors:capsule.provenance.humanContributors, aiAssistedRuns:capsule.provenance.aiAssistedRuns, establishedSkills },
    integrity:{ algorithm:capsule.integrity.algorithm, hash:capsule.integrity.hash, signatureStatus:capsule.integrity.signatureStatus, keyId:capsule.integrity.keyId },
    trustTier,
    verification:{ status:verification.status, hashValid:verification.hashValid, signatureValid:verification.signatureValid, signerTrusted:verification.signerTrusted },
    disclosure:'جواز التأليف يثبت أصالة العملية (أدلة، Proof of Learning، مساهمون بشر) عبر تجزئة SHA-256 وتوقيع Ed25519 اختياري. هو بديل إيجابي لكاشفات الذكاء الاصطناعي: لا يتهم، ولا يمثل درجة أو Transcript، ولا يرفع مستوى تحقق أي دليل عن المسجّل.',
  };
}

export function verifyAuthorshipPassportAgainstCapsule(passport:AuthorshipPassport, capsule:EvidenceCapsule){
  const v=verifyEvidenceCapsule(capsule);
  const boundToCapsule=passport.integrity.hash===capsule.integrity.hash&&passport.subject.projectId===capsule.project.id;
  return{ boundToCapsule, capsuleStatus:v.status, hashValid:v.hashValid, valid:boundToCapsule&&v.hashValid };
}

// ---------------------------------------------------------------------------
// 3) Deadline Congestion Index  (محاكاة Monte-Carlo حتمية على مستوى الفوج)
// ---------------------------------------------------------------------------
export interface CongestionAssignmentInput { id:string; title:string; courseId:string; deadline?:string; estimatedHours?:number }
export interface DeadlineCongestionResult {
  generatedAt:string;
  cohortSize:number; iterationsPerStudent:number; horizonDays:number;
  dailyLoad:Array<{ date:string; expectedConcurrentAssignments:number; expectedHours:number; congestion:'calm'|'busy'|'critical' }>;
  weeklyLoad:Array<{ week:string; expectedHours:number; peakConcurrent:number }>;
  hotspots:Array<{ week:string; expectedHours:number; peakConcurrent:number; assignmentIds:string[] }>;
  collisions:Array<{ deadlineDate:string; assignmentIds:string[]; titles:string[] }>;
  congestionIndex:number; // 0-100
  summary:string;
}

export function buildDeadlineCongestion(
  assignments:CongestionAssignmentInput[], cohortSize=30, now=Date.now(), iterationsPerStudent=1,
):DeadlineCongestionResult{
  const withDeadline=assignments.filter(a=>a.deadline&&new Date(a.deadline).getTime()>=now);
  const students=Math.max(1,Math.min(2000,Math.round(cohortSize)));
  const iters=Math.max(1,Math.min(20,Math.round(iterationsPerStudent)));
  const dayHours=new Map<string,number>();
  // dayActiveUnits: مجموع (طالب×تكرار×تكليف) نشط في اليوم؛ القسمة على (students*iters)
  // تعطي التزامن المتوقع *لكل طالب* — مقياس مستقل عن حجم الفوج (تصحيح خطأ اتحاد المجموعة).
  const dayActiveUnits=new Map<string,number>();
  const dayAssignments=new Map<string,Set<string>>(); // للعرض/الأسابيع فقط، لا للتزامن
  let horizonEnd=now; const denom=students*iters;
  for(const a of withDeadline){
    const due=new Date(a.deadline as string).getTime(); horizonEnd=Math.max(horizonEnd,due);
    const est=Math.max(1,Math.min(60,Number(a.estimatedHours||6)));
    // نافذة عمل الطالب: توزيع مثلثي منحاز نحو الموعد (سلوك التسويف الواقعي)، بحد أقصى 21 يومًا.
    const maxWindow=Math.min(21,Math.max(2,Math.ceil(est/2)+3));
    for(let s=0;s<students;s++)for(let it=0;it<iters;it++){
      const rnd=mulberry32(seedFrom(`${a.id}|${s}|${it}`));
      const bias=Math.max(rnd(),rnd()); // منحاز نحو 1 => قرب الموعد
      const windowDays=Math.max(1,Math.round((1-bias)*maxWindow)+1);
      const start=due-windowDays*86400000;
      const perDay=est/windowDays/students; // حصة اليوم الواحد لكل طالب، مُطبّعة على الفوج
      for(let d=0;d<windowDays;d++){
        const t=start+d*86400000; if(t<now-86400000)continue; const key=dayKey(t);
        dayHours.set(key,(dayHours.get(key)||0)+perDay/iters);
        dayActiveUnits.set(key,(dayActiveUnits.get(key)||0)+1);
        const set=dayAssignments.get(key)||new Set<string>(); set.add(a.id); dayAssignments.set(key,set);
      }
    }
  }
  const horizonDays=Math.max(1,Math.ceil((horizonEnd-now)/86400000)+1);
  // تزامن متوقع لكل طالب (كسري) — 2+ = حرج، 1.25+ = مشغول.
  const concurrencyBand=(c:number):'calm'|'busy'|'critical'=>c>=2?'critical':c>=1.25?'busy':'calm';
  const dailyLoad=[...dayHours.keys()].sort().map(date=>{
    const hours=round(dayHours.get(date)||0,2);
    const concurrent=round((dayActiveUnits.get(date)||0)/denom,2);
    return{ date, expectedConcurrentAssignments:concurrent, expectedHours:hours, congestion:concurrencyBand(concurrent) };
  });
  const weekMap=new Map<string,{ hours:number; peak:number; assignmentIds:Set<string> }>();
  for(const day of dailyLoad){ const wk=isoWeek(new Date(day.date).getTime()); const x=weekMap.get(wk)||{ hours:0, peak:0, assignmentIds:new Set<string>() }; x.hours+=day.expectedHours; x.peak=Math.max(x.peak,day.expectedConcurrentAssignments); for(const id of dayAssignments.get(day.date)||[])x.assignmentIds.add(id); weekMap.set(wk,x); }
  const weeklyLoad=[...weekMap.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([week,x])=>({ week, expectedHours:round(x.hours,1), peakConcurrent:round(x.peak,2) }));
  const avgWeek=weeklyLoad.length?weeklyLoad.reduce((n,x)=>n+x.expectedHours,0)/weeklyLoad.length:0;
  const hotspots=weeklyLoad.filter(w=>w.peakConcurrent>=2||(avgWeek>0&&w.expectedHours>=avgWeek*1.5)).map(w=>({ week:w.week, expectedHours:w.expectedHours, peakConcurrent:w.peakConcurrent, assignmentIds:[...(weekMap.get(w.week)?.assignmentIds||[])] }));
  const byDeadline=new Map<string,CongestionAssignmentInput[]>();
  for(const a of withDeadline){ const key=dayKey(new Date(a.deadline as string).getTime()); const list=byDeadline.get(key)||[]; list.push(a); byDeadline.set(key,list); }
  const collisions=[...byDeadline.entries()].filter(([,list])=>list.length>=2).sort(([a],[b])=>a.localeCompare(b)).map(([deadlineDate,list])=>({ deadlineDate, assignmentIds:list.map(a=>a.id), titles:list.map(a=>a.title) }));
  const peakConcurrent=dailyLoad.reduce((m,d)=>Math.max(m,d.expectedConcurrentAssignments),0);
  const criticalDays=dailyLoad.filter(d=>d.congestion==='critical').length;
  const congestionIndex=Math.min(100,Math.round((peakConcurrent>=3?60:peakConcurrent*20)+criticalDays*4+collisions.length*8));
  const summary=congestionIndex>=60?`ازدحام مرتفع: ذروة ${peakConcurrent} تكليفات متزامنة و${collisions.length} تصادم مواعيد. يُنصح بإعادة توزيع بعض المواعيد قبل بدء الفصل.`:congestionIndex>=30?`ازدحام متوسط: راقب الأسابيع الساخنة (${hotspots.length}).`:'توزيع مواعيد متوازن ضمن البيانات الحالية.';
  return{ generatedAt:isoNow(), cohortSize:students, iterationsPerStudent:iters, horizonDays, dailyLoad, weeklyLoad, hotspots, collisions, congestionIndex, summary };
}

// ---------------------------------------------------------------------------
// 4) Integrity-by-Design Assignment Lint
// ---------------------------------------------------------------------------
export interface IntegrityLintResult {
  generatedAt:string;
  assignmentId:string;
  score:number; // 0-100 (أعلى = أكثر أصالة ومقاومة لإساءة استخدام الذكاء الاصطناعي)
  band:'authentic'|'moderate'|'at_risk';
  signals:Array<{ code:string; label:string; impact:number; present:boolean; detail:string }>;
  recommendations:string[];
  note:string;
}

const RECALL_VERBS=['اذكر','عرّف','عدد','لخّص','اكتب تعريف','define','list','summarize','describe','state','recall'];
const AUTHENTIC_MARKERS=['حلل','قارن','قيّم','صمم','برهن','ناقش','طبّق على','بيانات','دراسة حالة','مشروع','analyze','evaluate','design','critique','apply','dataset','case study'];
const LOCAL_MARKERS=['الكويت','جامعتك','مجتمعك','بيئتك المحلية','بياناتك','local','your community','your data','your institution'];

export function lintAssignmentIntegrity(assignment:CourseAssignmentRecord):IntegrityLintResult{
  const text=`${assignment.title} ${assignment.instructions}`; const key=normalize(text);
  const hasRecall=RECALL_VERBS.some(v=>key.includes(normalize(v)));
  const hasAuthentic=AUTHENTIC_MARKERS.some(v=>key.includes(normalize(v)));
  const hasLocal=LOCAL_MARKERS.some(v=>key.includes(normalize(v)));
  const requiresProcess=/(viva|مناقشة|proof of learning|دليل تعلم|مسودة|draft|reflection|تأمل|خطوات العمل|process)/i.test(text);
  const rubricProcess=(assignment.rubric||[]).some(r=>/(process|أصالة|منهج|تفكير|reasoning|reflection|viva|مناقشة)/i.test(`${r.title} ${r.description}`));
  const policyOpen=Number(assignment.aiPolicy?.level||0)>=4&&!assignment.aiPolicy?.disclosureRequired;
  const thinPrompt=(assignment.instructions||'').trim().length<160;
  const signals=[
    { code:'authentic_task', label:'مهمة أصيلة (تحليل/تصميم/تطبيق)', impact:22, present:hasAuthentic, detail:hasAuthentic?'التكليف يطلب مهارة عليا لا مجرد استرجاع.':'لا يظهر فعل معرفي عالٍ؛ المهام الاسترجاعية سهلة التوليد آليًا.' },
    { code:'local_context', label:'سياق محلي/شخصي', impact:18, present:hasLocal, detail:hasLocal?'يرتبط ببيانات/سياق يصعب على نموذج عام إنتاجه.':'لا يوجد سياق محلي أو بيانات خاصة بالطالب.' },
    { code:'process_evidence', label:'يتطلب دليل عملية أو مناقشة', impact:22, present:requiresProcess, detail:requiresProcess?'يطلب مسودات/تأمل/Viva تثبت التأليف.':'لا يطلب أي دليل على العملية؛ يصعب إثبات التأليف لاحقًا.' },
    { code:'rubric_process', label:'الـRubric يقيس العملية/الأصالة', impact:12, present:rubricProcess, detail:rubricProcess?'معيار تقييم يكافئ التفكير لا المخرج فقط.':'الـRubric يقيس المخرج النهائي فقط.' },
    { code:'recall_heavy', label:'ليس استرجاعيًا بحتًا', impact:14, present:!hasRecall||hasAuthentic, detail:hasRecall&&!hasAuthentic?'الصياغة استرجاعية (اذكر/عرّف/لخّص) وقابلة للتوليد الفوري.':'لا يغلب عليه الاسترجاع.' },
    { code:'clear_prompt', label:'تعليمات كافية التفصيل', impact:6, present:!thinPrompt, detail:thinPrompt?'التعليمات قصيرة جدًا؛ الغموض يشجع مخرجات عامة.':'تعليمات مفصّلة بما يكفي.' },
    { code:'scoped_ai_policy', label:'سياسة ذكاء اصطناعي محددة', impact:6, present:!policyOpen, detail:policyOpen?'السياسة مفتوحة بلا حدود؛ حدد المسموح والممنوع صراحة.':'سياسة الذكاء الاصطناعي محددة.' },
  ];
  const total=signals.reduce((n,s)=>n+s.impact,0);
  const score=Math.round((signals.filter(s=>s.present).reduce((n,s)=>n+s.impact,0)/total)*100);
  const band:IntegrityLintResult['band']=score>=75?'authentic':score>=50?'moderate':'at_risk';
  const recommendations=signals.filter(s=>!s.present).map(s=>({
    authentic_task:'أضف مطلبًا لتحليل/تصميم/تطبيق بدل الاسترجاع.',
    local_context:'اربط التكليف ببيانات الطالب أو سياق محلي (مثال: حالة من الكويت/جامعتك).',
    process_evidence:'اطلب مسودة أو تأملًا أو فعّل Viva قصيرة كدليل تأليف.',
    rubric_process:'أضف معيار Rubric يكافئ منهج التفكير والأصالة.',
    recall_heavy:'أعد صياغة الأفعال الاسترجاعية إلى أفعال عليا (حلل/قيّم/صمم).',
    clear_prompt:'وسّع التعليمات لتقليل الغموض والمخرجات العامة.',
    scoped_ai_policy:'حدد سياسة الذكاء الاصطناعي: ما المسموح وما الممنوع وكيف يُوثّق الاستخدام.',
  } as Record<string,string>)[s.code]).filter(Boolean);
  return{ generatedAt:isoNow(), assignmentId:assignment.id, score, band, signals, recommendations, note:'هذا مقياس تصميمي وقائي يشجع مهام أصيلة وأدلة عملية بدل المراقبة أو اتهام الطلاب. لا يفحص أعمال الطلاب ولا يصدر أحكامًا عليهم.' };
}

// ---------------------------------------------------------------------------
// 5) Grader Fairness Calibration
// ---------------------------------------------------------------------------
export interface GraderFairnessResult {
  generatedAt:string;
  assignmentScope:'single'|'mixed';
  cohort:{ gradedSubmissions:number; meanPercent:number|null; stdevPercent:number|null };
  graders:Array<{ graderId:string; graded:number; meanPercent:number; deltaFromCohort:number; zScore:number; tendency:'lenient'|'severe'|'aligned'|'insufficient'; flags:string[] }>;
  rubricVariance:Array<{ rubricId:string; title:string; meanPercent:number; spreadPercent:number; note?:string }>;
  anomalies:string[];
  appealReadyNote:string;
}

export function buildGraderFairness(submissions:CourseSubmissionRecord[]):GraderFairnessResult{
  const graded=submissions.filter(s=>(s.status==='graded'||s.status==='released')&&s.gradedBy);
  const assignmentScope:'single'|'mixed'=unique(graded.map(s=>s.assignmentId)).length<=1?'single':'mixed';
  const rows=graded.map(s=>({ graderId:String(s.gradedBy), ratio:submissionRatio(s), sub:s })).filter(r=>r.ratio!==null) as Array<{ graderId:string; ratio:number; sub:CourseSubmissionRecord }>;
  const cohortMean=rows.length?rows.reduce((n,r)=>n+r.ratio,0)/rows.length:null;
  const cohortStdev=rows.length&&cohortMean!==null?Math.sqrt(rows.reduce((n,r)=>n+(r.ratio-cohortMean)**2,0)/rows.length):null;
  const byGrader=new Map<string,number[]>(); for(const r of rows){ const list=byGrader.get(r.graderId)||[]; list.push(r.ratio); byGrader.set(r.graderId,list); }
  const graders=[...byGrader.entries()].map(([graderId,ratios])=>{
    const mean=ratios.reduce((n,x)=>n+x,0)/ratios.length;
    const delta=cohortMean!==null?mean-cohortMean:0;
    // للحكم على انحراف *متوسط المصحّح* نستخدم الخطأ المعياري (stdev/√n) لا انحراف التسليمات الخام.
    const se=cohortStdev&&cohortStdev>1e-9?cohortStdev/Math.sqrt(ratios.length):0;
    const z=se>1e-9?delta/se:0;
    // يتطلب دلالة إحصائية (z) وفارقًا عمليًا لا يقل عن 3 نقاط مئوية معًا.
    const material=Math.abs(delta)>=0.03;
    const tendency:'lenient'|'severe'|'aligned'|'insufficient'=ratios.length<3?'insufficient':(z>=0.5&&material)?'lenient':(z<=-0.5&&material)?'severe':'aligned';
    const flags:string[]=[]; if(tendency==='lenient')flags.push(`أعلى من متوسط الفوج بـ${round(delta*100,1)} نقطة مئوية`); if(tendency==='severe')flags.push(`أدنى من متوسط الفوج بـ${round(Math.abs(delta)*100,1)} نقطة مئوية`); if(ratios.length<3)flags.push('عدد تصحيحات قليل لاستنتاج موثوق');
    return{ graderId, graded:ratios.length, meanPercent:round(mean*100,1), deltaFromCohort:round(delta*100,1), zScore:round(z,2), tendency, flags };
  }).sort((a,b)=>b.zScore-a.zScore);
  // تشتت معايير الـRubric عبر التسليمات
  const rubricAgg=new Map<string,{ title:string; ratios:number[] }>();
  for(const s of graded)for(const g of s.rubricGrades||[]){ if(!(Number(g.maxPoints)>0))continue; const x=rubricAgg.get(g.rubricId)||{ title:g.title, ratios:[] }; x.ratios.push(Number(g.awardedPoints)/Number(g.maxPoints)); rubricAgg.set(g.rubricId,x); }
  const rubricVariance=[...rubricAgg.entries()].map(([rubricId,x])=>{ const mean=x.ratios.reduce((n,y)=>n+y,0)/x.ratios.length; const spread=Math.sqrt(x.ratios.reduce((n,y)=>n+(y-mean)**2,0)/x.ratios.length); return{ rubricId, title:x.title, meanPercent:round(mean*100,1), spreadPercent:round(spread*100,1), note:spread>=0.25?'تشتت مرتفع: قد يحتاج المعيار توضيحًا أو محكات أدق.':undefined }; }).sort((a,b)=>b.spreadPercent-a.spreadPercent);
  const anomalies:string[]=[];
  for(const g of graders)if(Math.abs(g.zScore)>=1)anomalies.push(`المصحّح ${g.graderId}: انحراف ${g.zScore} عن الفوج (${g.tendency==='lenient'?'تساهل':'تشدد'}).`);
  for(const r of rubricVariance)if(r.note)anomalies.push(`المعيار «${r.title}»: تشتت ${r.spreadPercent} نقطة مئوية.`);
  return{
    generatedAt:isoNow(), assignmentScope,
    cohort:{ gradedSubmissions:rows.length, meanPercent:cohortMean!==null?round(cohortMean*100,1):null, stdevPercent:cohortStdev!==null?round(cohortStdev*100,1):null },
    graders, rubricVariance, anomalies,
    appealReadyNote:'أرقام العدالة وصفية إحصائية على التوزيعات المصححة فقط، ولا تثبت تحيزًا فرديًا بذاتها؛ تُستخدم كمؤشر لمراجعة بشرية ومعايرة، وصالحة كوثيقة تفسير عند الطعون.',
  };
}

// ---------------------------------------------------------------------------
// 6) Federated Academic Graph (حافظ للخصوصية — تجزئات فقط، بلا بيانات طلاب خام)
// ---------------------------------------------------------------------------
export interface FederatedInstitutionInput { institutionId:string; institutionName:string; outcomes:Array<{ code:string; label:string }>; skills?:string[] }
export interface FederatedNode { key:string; label:string; institutions:string[]; kind:'outcome'|'skill' }
export interface FederatedGraphResult {
  generatedAt:string;
  institutions:Array<{ institutionId:string; institutionName:string; outcomeCount:number; skillCount:number }>;
  nodes:FederatedNode[];
  equivalences:Array<{ key:string; label:string; institutions:string[]; kind:'outcome'|'skill' }>; // مشترك عبر ≥2 مؤسسة
  transferCandidates:Array<{ from:string; to:string; sharedOutcomes:number; sharedSkills:number; transferabilityPercent:number }>;
  privacyNote:string;
}

export function buildFederatedGraph(institutions:FederatedInstitutionInput[]):FederatedGraphResult{
  const nodeMap=new Map<string,FederatedNode>();
  const add=(rawLabel:string,kind:'outcome'|'skill',inst:string)=>{ const key=`${kind}:${digest(normalize(rawLabel)).slice(0,16)}`; const n=nodeMap.get(key)||{ key, label:rawLabel, institutions:[], kind }; if(!n.institutions.includes(inst))n.institutions.push(inst); nodeMap.set(key,n); };
  for(const inst of institutions){ for(const o of inst.outcomes)add(o.label,'outcome',inst.institutionId); for(const s of inst.skills||[])add(s,'skill',inst.institutionId); }
  const nodes=[...nodeMap.values()].sort((a,b)=>b.institutions.length-a.institutions.length||a.key.localeCompare(b.key));
  const equivalences=nodes.filter(n=>n.institutions.length>=2).map(n=>({ key:n.key, label:n.label, institutions:n.institutions, kind:n.kind }));
  const transferCandidates:FederatedGraphResult['transferCandidates']=[];
  for(let i=0;i<institutions.length;i++)for(let j=0;j<institutions.length;j++){
    if(i===j)continue; const from=institutions[i], to=institutions[j];
    const toOutcomeKeys=new Set(to.outcomes.map(o=>`outcome:${digest(normalize(o.label)).slice(0,16)}`));
    const toSkillKeys=new Set((to.skills||[]).map(s=>`skill:${digest(normalize(s)).slice(0,16)}`));
    const sharedOutcomes=from.outcomes.filter(o=>toOutcomeKeys.has(`outcome:${digest(normalize(o.label)).slice(0,16)}`)).length;
    const sharedSkills=(from.skills||[]).filter(s=>toSkillKeys.has(`skill:${digest(normalize(s)).slice(0,16)}`)).length;
    const denom=from.outcomes.length+(from.skills?.length||0);
    if(denom===0)continue;
    transferCandidates.push({ from:from.institutionId, to:to.institutionId, sharedOutcomes, sharedSkills, transferabilityPercent:round(((sharedOutcomes+sharedSkills)/denom)*100,1) });
  }
  transferCandidates.sort((a,b)=>b.transferabilityPercent-a.transferabilityPercent);
  return{
    generatedAt:isoNow(),
    institutions:institutions.map(x=>({ institutionId:x.institutionId, institutionName:x.institutionName, outcomeCount:x.outcomes.length, skillCount:(x.skills||[]).length })),
    nodes, equivalences, transferCandidates,
    privacyNote:'الاتحاد يعتمد على تجزئات SHA-256 للمخرجات/المهارات المطبّعة فقط. لا تُشارك أي بيانات طلاب خام أو درجات؛ التكافؤ يُستنتج من تطابق التجزئة عبر المؤسسات، ما يدعم تحويل الساعات وتنقّل الطلاب مع حفظ السيادة والخصوصية.',
  };
}

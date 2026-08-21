import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  buildAccreditationDossier,
  buildAuthorshipPassport,
  verifyAuthorshipPassportAgainstCapsule,
  buildDeadlineCongestion,
  lintAssignmentIntegrity,
  buildGraderFairness,
  buildFederatedGraph,
} from '../src/server/frontier';
import { buildEvidenceCapsule } from '../src/server/intelligence';

const policy:any={ level:3, summary:'', allowed:[], prohibited:[], disclosureRequired:true };
const courses:any[]=[
  { id:'c1', tenantId:'t1', ownerId:'o1', code:'BUS301', title:'Analysis', term:'Fall2026', outcomes:['O1','O2'], aiPolicy:policy, status:'active', createdAt:'2026-01-01T00:00:00Z', updatedAt:'2026-01-01T00:00:00Z' },
  { id:'c2', tenantId:'t1', ownerId:'o1', code:'BUS302', title:'Strategy', term:'Fall2026', outcomes:['O2','O3'], aiPolicy:policy, status:'active', createdAt:'2026-01-01T00:00:00Z', updatedAt:'2026-01-01T00:00:00Z' },
];
const assignments:any[]=[
  { id:'a1', tenantId:'t1', courseId:'c1', createdBy:'o1', title:'Case study analysis', instructions:'حلل دراسة حالة من الكويت وقارن النتائج وقدّم مسودة وتأمل في خطوات العمل. اطلب viva قصيرة.', deadline:'2026-09-10T20:00:00Z', deliverables:[], rubric:[{id:'r1',title:'Analysis',description:'reasoning and process',weighting:60}], outcomes:['O1','O2'], aiPolicy:policy, groupMode:'individual', status:'published', createdAt:'x', updatedAt:'x' },
  { id:'a2', tenantId:'t1', courseId:'c2', createdBy:'o1', title:'Define terms', instructions:'اذكر التعريفات.', deadline:'2026-09-10T20:00:00Z', deliverables:[], rubric:[{id:'r2',title:'Recall',description:'final answer',weighting:100}], outcomes:['O3'], aiPolicy:{level:5,summary:'',allowed:[],prohibited:[],disclosureRequired:false}, groupMode:'individual', status:'published', createdAt:'x', updatedAt:'x' },
];
function sub(id:string, assignmentId:string, gradedBy:string, total:number, max:number):any{
  return { id, tenantId:'t1', courseId:'c1', assignmentId, projectId:'p'+id, studentId:'s'+id, studentName:'S', attempt:1, status:'graded', submittedAt:'x', receiptHash:'h', projectRevision:1, audit:{}, snapshot:{projectTitle:'',deliverables:[],artifactIds:[],evidenceIds:[]}, rubricGrades:[{rubricId:'r1',title:'Analysis',maxPoints:max,awardedPoints:total}], totalScore:total, maxScore:max, gradedBy, updatedAt:'x' };
}

test('Accreditation dossier maps outcomes to graded evidence and never fabricates attainment',()=>{
  const submissions=[ sub('1','a1','g1',80,100), sub('2','a1','g1',90,100) ];
  const d=buildAccreditationDossier(courses,assignments,submissions,undefined,undefined,0.7);
  const o1=d.outcomes.find(x=>x.outcome==='O1')!;
  assert.equal(o1.assessedSubmissions,2);
  assert.equal(o1.attainmentPercent,85);
  assert.equal(o1.attainmentMet,true);
  const o3=d.outcomes.find(x=>x.outcome==='O3')!; // a2 has no graded submissions
  assert.equal(o3.attainmentPercent,null); // not measured, not faked
  assert.ok(d.gaps.unassessedOutcomes.includes('O3'));
  assert.equal(d.readiness.level,'needs_evidence');
});

test('Authorship passport binds to its capsule and reflects signature trust',()=>{
  const project:any={ id:'p1', tenantId:'t1', userId:'u1', title:'T', course:'BUS301', status:'active', updatedAt:'x', deliverables:[{id:'d1',title:'R',format:'pdf',status:'in_progress'}], rubric:[], requiredSkills:[], createdAt:'x' };
  const skills:any[]=[{id:'s1',userId:'u1',projectId:'p1',skill:'Research',verificationLevel:'institution',evidence:'e',date:'x'}];
  const {privateKey}=generateKeyPairSync('ed25519');
  const signingKey=Buffer.from(privateKey.export({type:'pkcs8',format:'pem'})).toString('base64');
  const capsule=buildEvidenceCapsule(project,[],[],[],skills,[],signingKey);
  const passport=buildAuthorshipPassport(capsule);
  assert.equal(passport.trustTier,'self_signed');
  assert.ok(passport.claims.establishedSkills.includes('Research'));
  const check=verifyAuthorshipPassportAgainstCapsule(passport,capsule);
  assert.equal(check.valid,true);
  // tamper the capsule → binding breaks
  const tampered={...capsule,project:{...capsule.project,title:'X'}};
  assert.equal(verifyAuthorshipPassportAgainstCapsule(passport,tampered as any).valid,false);
});

test('Deadline congestion is deterministic and flags same-day collisions',()=>{
  const now=new Date('2026-09-01T00:00:00Z').getTime();
  const input=[
    {id:'a1',title:'A',courseId:'c1',deadline:'2026-09-10T20:00:00Z',estimatedHours:8},
    {id:'a2',title:'B',courseId:'c2',deadline:'2026-09-10T20:00:00Z',estimatedHours:8},
    {id:'a3',title:'C',courseId:'c3',deadline:'2026-09-25T20:00:00Z',estimatedHours:4},
  ];
  const r1=buildDeadlineCongestion(input,30,now);
  const r2=buildDeadlineCongestion(input,30,now);
  assert.deepEqual(r1.dailyLoad,r2.dailyLoad); // deterministic
  assert.equal(r1.collisions.length,1);
  assert.equal(r1.collisions[0].assignmentIds.length,2);
  assert.ok(r1.congestionIndex>0);
});

test('Deadline congestion classification is independent of cohort size (fix)',()=>{
  const now=new Date('2026-09-01T00:00:00Z').getTime();
  const input=[
    {id:'a1',title:'A',courseId:'c1',deadline:'2026-09-10T20:00:00Z',estimatedHours:8},
    {id:'a2',title:'B',courseId:'c2',deadline:'2026-09-11T20:00:00Z',estimatedHours:8},
  ];
  const small=buildDeadlineCongestion(input,5,now);
  const large=buildDeadlineCongestion(input,500,now);
  // متوسط التزامن لكل طالب لا يتضخم بحجم الفوج
  const peak=(r:any)=>Math.max(...r.dailyLoad.map((d:any)=>d.expectedConcurrentAssignments));
  assert.ok(Math.abs(peak(small)-peak(large))<0.5, `peak concurrency stable: ${peak(small)} vs ${peak(large)}`);
});

test('Accreditation attainment boundary is not lifted by rounding (fix)',()=>{
  // نسبة حقيقية 69.96% يجب ألا تُعدّ محققة عند عتبة 70%
  const courses2:any[]=[{ id:'c1', tenantId:'t1', ownerId:'o1', code:'X', title:'X', outcomes:['O1'], aiPolicy:policy, status:'active', createdAt:'x', updatedAt:'x' }];
  const assignments2:any[]=[{ id:'a1', tenantId:'t1', courseId:'c1', createdBy:'o1', title:'A', instructions:'x', deliverables:[], rubric:[], outcomes:['O1'], aiPolicy:policy, groupMode:'individual', status:'published', createdAt:'x', updatedAt:'x' }];
  const submissions=[ sub('1','a1','g',6996,10000) ]; // 69.96%
  const d=buildAccreditationDossier(courses2,assignments2,submissions,undefined,undefined,0.7);
  const o1=d.outcomes.find(x=>x.outcome==='O1')!;
  assert.equal(o1.attainmentMet,false);
});

test('Integrity lint rewards authentic tasks and flags recall-only ones',()=>{
  const authentic=lintAssignmentIntegrity(assignments[0]);
  const recall=lintAssignmentIntegrity(assignments[1]);
  assert.ok(authentic.score>recall.score);
  assert.equal(authentic.band,'authentic');
  assert.equal(recall.band,'at_risk');
  assert.ok(recall.recommendations.length>0);
});

test('Grader fairness detects lenient vs severe graders from graded distributions',()=>{
  const submissions=[
    sub('1','a1','lenient',95,100), sub('2','a1','lenient',96,100), sub('3','a1','lenient',94,100),
    sub('4','a1','severe',60,100), sub('5','a1','severe',58,100), sub('6','a1','severe',62,100),
  ];
  const f=buildGraderFairness(submissions);
  assert.equal(f.cohort.gradedSubmissions,6);
  const lenient=f.graders.find(g=>g.graderId==='lenient')!;
  const severe=f.graders.find(g=>g.graderId==='severe')!;
  assert.equal(lenient.tendency,'lenient');
  assert.equal(severe.tendency,'severe');
  assert.ok(f.anomalies.length>0);
});

test('Federated graph finds shared outcomes via hashes without raw student data',()=>{
  const g=buildFederatedGraph([
    { institutionId:'kuA', institutionName:'A', outcomes:[{code:'A1',label:'Critical thinking'},{code:'A2',label:'Data analysis'}], skills:['Research'] },
    { institutionId:'kuB', institutionName:'B', outcomes:[{code:'B1',label:'critical thinking'},{code:'B9',label:'Ethics'}], skills:['Research'] },
  ]);
  const shared=g.equivalences.find(e=>e.label.toLowerCase()==='critical thinking');
  assert.ok(shared&&shared.institutions.length===2);
  assert.ok(g.transferCandidates.some(t=>t.from==='kuA'&&t.to==='kuB'&&t.sharedOutcomes>=1&&t.sharedSkills>=1));
  assert.ok(/تجزئ/.test(g.privacyNote)); // privacy-preserving note present
});

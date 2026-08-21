import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  buildCurriculumTwin,
  buildEvidenceCapsule,
  buildLearningBrain,
  buildMissionControl,
  buildTimeMachine,
  buildTrustGraph,
  simulateCurriculumTwin,
  verifyEvidenceCapsule,
} from '../src/server/intelligence';

const project:any={id:'p1',tenantId:'t1',userId:'u1',title:'Market Analysis',course:'BUS301',status:'active',projectType:'report',academicDomain:'Business',complexity:'medium',collaborationMode:'individual',requiredSkills:['Research','Data analysis'],learningOutcomes:['Outcome A'],requiredActions:['RESEARCH'],deliverables:[{id:'d1',title:'Report',format:'pdf',status:'in_progress'}],rubric:[{id:'r1',title:'Analysis',weighting:40,readiness:'covered'}],deadlines:{final:'2026-08-13T20:00:00Z'},sourceRequirements:[],citationStyle:'APA',softwareRequirements:[],aiPolicy:{level:3},assessmentConstraints:[],evidenceRequirements:[],dependencies:[],estimatedWorkload:120,riskFlags:['Missing source'],tasks:[{id:'task1',title:'Complete analysis',status:'ready',estimatedMinutes:90,module:'writing'}],nextAction:'Complete analysis',workspaceModules:['research','writing'],requirements:[],createdAt:'2026-08-01T00:00:00Z',updatedAt:'2026-08-10T00:00:00Z'};
const skills:any[]=[{id:'s1',userId:'u1',projectId:'p1',skill:'Research',verificationLevel:'project',evidence:'Source review',date:'2026-08-10T00:00:00Z'}];
const learning:any[]=[{id:'l1',tenantId:'t1',userId:'u1',projectId:'p1',source:'viva',summary:'Explained method',createdAt:'2026-08-10T00:00:00Z'}];
const artifacts:any[]=[{id:'a1',projectId:'p1',title:'Analysis workbook',module:'data',content:'',status:'draft',isCanonical:true,deliverableId:'d1',rubricIds:['r1'],createdBy:'u1',updatedBy:'u1',createdAt:'2026-08-09T00:00:00Z',updatedAt:'2026-08-10T00:00:00Z'}];
const evidence:any[]=[{id:'e1',tenantId:'t1',projectId:'p1',userId:'u1',type:'source',title:'Source',detail:'Evidence',verification:'user_verified',createdAt:'2026-08-09T00:00:00Z',updatedAt:'2026-08-09T00:00:00Z'},{id:'e2',tenantId:'t1',projectId:'p1',userId:'u1',type:'claim',title:'Claim',detail:'Claim evidence',verification:'user_verified',relatedEvidenceIds:['e1'],artifactId:'a1',deliverableId:'d1',rubricIds:['r1'],createdAt:'2026-08-10T00:00:00Z',updatedAt:'2026-08-10T00:00:00Z'}];

test('Mission Control respects the learner time budget and Brain uses recorded evidence',()=>{
  const brain=buildLearningBrain([project],skills,learning);
  const mission=buildMissionControl([project],{uid:'u1',dailyStudyMinutes:60,timezone:'Pacific/Honolulu'} as any,brain,new Date('2026-08-11T03:00:00Z').getTime());
  assert.ok(brain.strengths.some(x=>x.skill==='Research'));
  assert.ok(mission.actions.length>0);
  assert.equal(mission.date,'2026-08-10');
  assert.ok(mission.actions.reduce((n,x)=>n+x.estimatedMinutes,0)<=60);
});

test('Trust Graph only marks saved provenance links explicit',()=>{
  const graph=buildTrustGraph(project,artifacts,evidence,learning,skills);
  assert.ok(graph.edges.some(x=>x.relation==='derived_from'&&x.basis==='explicit'));
  assert.equal(graph.coverage.deliverablesLinked,1);
  assert.equal(graph.coverage.rubricLinked,1);
});

test('Evidence Capsule detects tampering and distinguishes trusted from self-signed keys',()=>{
  const {privateKey}=generateKeyPairSync('ed25519');
  const signingKey=Buffer.from(privateKey.export({type:'pkcs8',format:'pem'})).toString('base64');
  const capsule=buildEvidenceCapsule(project,artifacts,evidence,learning,skills,[{id:'run1'}],signingKey);
  assert.equal(verifyEvidenceCapsule(capsule,signingKey).status,'signed_trusted');
  assert.equal(verifyEvidenceCapsule(capsule).status,'signed_untrusted');
  assert.equal(verifyEvidenceCapsule(capsule,undefined,[capsule.integrity.publicKeySpki!]).status,'signed_trusted');
  const tampered=structuredClone(capsule);tampered.project.title='Tampered';
  assert.equal(verifyEvidenceCapsule(tampered,signingKey).status,'invalid');
});

test('Curriculum Twin preserves baseline outcomes during removal simulation',()=>{
  const courses:any[]=[{id:'c1',tenantId:'t1',code:'C1',title:'Core',term:'T1',outcomes:['Outcome A'],createdAt:'',updatedAt:''},{id:'c2',tenantId:'t1',code:'C2',title:'Other',term:'T1',outcomes:['Outcome B'],createdAt:'',updatedAt:''}];
  const assignments:any[]=[{id:'as1',tenantId:'t1',courseId:'c1',title:'A',outcomes:['Outcome A'],createdAt:'',updatedAt:''}];
  const baseline=buildCurriculumTwin(courses,assignments,[],[]);
  assert.ok(baseline.outcomes.some(x=>x.outcome==='Outcome A'));
  const sim=simulateCurriculumTwin(courses,assignments,[],[],{removeCourseIds:['c1']});
  assert.equal(sim.impact.riskLevel,'high');
  assert.ok(sim.impact.newlyUncoveredOutcomes.includes('Outcome A'));
});

test('Time Machine is deterministic from stored project records',()=>{
  const timeline=buildTimeMachine(project,[],[],artifacts,evidence,learning,[]);
  assert.ok(timeline.events.length>=4);
  assert.equal(timeline.events[0].source,'project');
  assert.equal(timeline.summary.aiEvents,0);
});

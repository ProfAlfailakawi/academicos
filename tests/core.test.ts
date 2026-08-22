import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectDNA } from '../src/server/project-engine';
import { runSubmissionAudit } from '../src/server/audit';
import { createVivaSession, completeViva } from '../src/server/viva';
import { exportProject } from '../src/server/export';

test('Project DNA builds adaptive modules and honest confirmation states', () => {
  const project = buildProjectDNA({
    title:'Evidence-based report', course:'TEST 101', projectType:'Research report + presentation', academicDomain:'Education', complexity:'medium', collaborationMode:'individual',
    requiredActions:['RESEARCH','WRITE','PRESENT'], requiredSkills:['Research'], learningOutcomes:['Evidence use'],
    deliverables:[{title:'Report',format:'PDF'}], requirements:[{label:'Deadline',value:'Needs confirmation',category:'deadline',confidence:'needs_confirmation'}],
    rubric:[{title:'Evidence',description:'Uses sources',weighting:100}], aiPolicy:{level:2,summary:'Planning only',needsConfirmation:true}, riskFlags:[],
  }, {userId:'u1',tenantId:'t1'});
  assert.equal(project.title,'Evidence-based report');
  assert.ok(project.workspaceModules.includes('research'));
  assert.ok(project.workspaceModules.includes('writing'));
  assert.ok(project.workspaceModules.includes('presentation'));
  assert.ok(project.riskFlags.some(x=>x.includes('تأكيد مطلوب')));
});

test('Submission Audit does not call an unfinished deliverable ready', () => {
  const project = buildProjectDNA({title:'Audit',course:'T',projectType:'Report',academicDomain:'General',complexity:'low',collaborationMode:'individual',requiredActions:['WRITE'],requiredSkills:[],learningOutcomes:[],deliverables:[{title:'Report',format:'PDF'}],requirements:[],rubric:[],aiPolicy:{level:2,summary:'Planning',needsConfirmation:false},riskFlags:[]},{userId:'u',tenantId:'t'});
  const audit = runSubmissionAudit(project);
  assert.notEqual(audit.status,'ready');
  assert.ok(audit.checks.some(c=>c.status!=='pass'));
});

test('Viva produces proof of learning without an AI detector score', () => {
  const project = buildProjectDNA({title:'Viva',course:'T',projectType:'Report',academicDomain:'General',complexity:'medium',collaborationMode:'individual',requiredActions:['RESEARCH','DEFEND'],requiredSkills:['Critical thinking'],learningOutcomes:['Explain method'],deliverables:[{title:'Report',format:'PDF'}],requirements:[],rubric:[{title:'Reasoning',description:'Explain choices',weighting:100}],aiPolicy:{level:2,summary:'Planning',needsConfirmation:false},riskFlags:[]},{userId:'u',tenantId:'t'});
  const session = createVivaSession(project,'strict');
  session.responses = session.questions.map(q=>({questionId:q.id,answer:'I can explain the evidence and limitation.',updatedAt:new Date().toISOString()}));
  const result = completeViva(session);
  assert.equal(result.session.status,'completed');
  assert.equal(result.evidence.source,'viva');
  assert.ok(!JSON.stringify(result).toLowerCase().includes('ai detector'));
});

test('ZIP export contains a real archive payload', () => {
  const project = buildProjectDNA({title:'Export test',course:'T',projectType:'Report',academicDomain:'General',complexity:'low',collaborationMode:'individual',requiredActions:['WRITE'],requiredSkills:[],learningOutcomes:[],deliverables:[{title:'Report',format:'PDF'}],requirements:[],rubric:[],aiPolicy:{level:2,summary:'Planning',needsConfirmation:false},riskFlags:[]},{userId:'u',tenantId:'t'});
  const out = exportProject(project,'zip');
  assert.equal(out.contentType,'application/zip');
  assert.equal(out.data.readUInt32LE(0),0x04034b50);
  assert.ok(out.data.length>100);
});

test('DOCX export preserves the canonical ordered writer sections', () => {
  const project = buildProjectDNA({title:'Writer export',course:'T',projectType:'Report',academicDomain:'General',complexity:'low',collaborationMode:'individual',requiredActions:['WRITE'],requiredSkills:[],learningOutcomes:[],deliverables:[{title:'Report',format:'DOCX'}],requirements:[],rubric:[],aiPolicy:{level:4,summary:'Disclosed drafting',needsConfirmation:false},riskFlags:[]},{userId:'u',tenantId:'t'});
  const at = new Date().toISOString();
  const section = {id:'section-1',projectId:project.id,tenantId:'t',createdBy:'u',updatedBy:'u',module:'writing' as const,kind:'academic-document-section',title:'القسم الأول',content:'محتوى أكاديمي محفوظ داخل ملف Word النهائي.',status:'in_progress' as const,isCanonical:true,createdAt:at,updatedAt:at};
  const manifest = {...section,id:'manifest',kind:'academic-document-manifest',title:'manifest',content:JSON.stringify({sections:[{artifactId:section.id}]})};
  const out = exportProject(project,'docx',[manifest,section]);
  assert.equal(out.contentType,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.ok(out.data.includes(Buffer.from(section.content,'utf8')));
});

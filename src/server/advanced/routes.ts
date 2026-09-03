// AcademicOS — Advanced Routes Registry  (إصلاح الفجوة #2: نمط توجيه معياري)
// السبب الجذري: 145 مسارًا مكدّسة في server.ts (10كسطر) تجعل التعديل مؤلمًا والمراجعة الأمنية شبه مستحيلة.
//
// الحل: كل قدرة جديدة تُسجَّل عبر registrar معزول يستقبل تبعياته بالحقن (ctx) بدل الوصول العالمي.
// server.ts يضيف سطرًا واحدًا: `registerAdvancedRoutes(app, ctx)` — وهذا يرسّخ النمط الذي يُفكَّك عليه
// الملف الكبير تدريجيًا (كل مجموعة مسارات → registrar في ملفها). راجع docs/ARCHITECTURE_REFACTOR.md.
//
// كل معالج هنا: يتحقق من الصلاحية عبر ctx.authenticate/requireRoles، ثم يستدعي محرّكًا نقيًا مختبَرًا،
// ثم يبثّ عبر realtime عند الحاجة. لا منطق أعمال مضمّن في المسار نفسه.

import type { Express, Request, Response, NextFunction } from 'express';
import { RealtimeHub } from '../realtime';
import { resolveServerLocale, type ServerLocale } from '../server-locale';
import { buildGhostCohort, type GhostMemberInput } from './ghost-cohort';
import { buildGradeLossMap, alignRubricByTitle } from './grade-loss-map';
import { evaluateReverseAssessment, buildExamBrief, type ReverseAssessmentInput } from './reverse-assessment';
import { answerClarification, applyClarificationPatch, type ClarificationThread } from './clarification-room';
import { evaluateExplanation, applyCredit, creditBalance, type PeerExplanationSubmission, type CreditLedgerEntry } from './peer-explanation';
import { verifyBlackBoxChain, type BlackBoxChain } from './learning-black-box';
import { assessLegacyEligibility, buildLegacyListing, computeRevenueSplit } from './alumni-legacy';
import { verifyWhatsAppSignature, verifyWebhookChallenge, parseWhatsAppWebhook, toNormalizedIntake, buildReply } from './whatsapp-gateway';

// عقد التبعيات المحقونة — يبقيها مستقلة عن التفاصيل الداخلية لـ server.ts.
export interface AdvancedRouteContext {
  authenticate: (req: any, res: Response, next: NextFunction) => void | Promise<void>;
  requireRoles: (...roles: string[]) => (req: any, res: Response, next: NextFunction) => void;
  realtime: RealtimeHub;
  featureEnabled: (tenantId: string, key: string) => Promise<boolean> | boolean;
  data: {
    // كل هذه تُنفّذ فعليًا عبر طبقة db القائمة عند الربط؛ الواجهة هنا هي العقد فقط.
    getGhostCohortMembers: (tenantId: string, assignmentId: string) => Promise<GhostMemberInput[]>;
    getAssignmentSubmissions: (tenantId: string, assignmentId: string) => Promise<any[]>;
    getProjectDNA: (tenantId: string, projectId: string, userId: string) => Promise<any | null>;
    saveProofOfLearning: (tenantId: string, projectId: string, userId: string, pol: unknown) => Promise<void>;
    getClarificationThread: (tenantId: string, threadId: string) => Promise<ClarificationThread | null>;
    saveClarificationThread: (t: ClarificationThread) => Promise<void>;
    listAffectedProjectOwners: (tenantId: string, assignmentId: string) => Promise<Array<{ userId: string; projectId: string }>>;
    applyDnaPatchToProject: (tenantId: string, projectId: string, userId: string, patch: any, version: number) => Promise<void>;
    getPeerCreditLedger: (tenantId: string, courseId: string) => Promise<CreditLedgerEntry[]>;
    savePeerExplanation: (sub: PeerExplanationSubmission, verdict: unknown) => Promise<void>;
    savePeerCreditLedger: (tenantId: string, courseId: string, ledger: CreditLedgerEntry[]) => Promise<void>;
    attachBlackBoxToCapsule: (tenantId: string, projectId: string, verdict: unknown) => Promise<void>;
    getLegacyEligibilityInputs: (tenantId: string, projectId: string, userId: string) => Promise<any>;
    saveLegacyListing: (listing: unknown) => Promise<void>;
  };
}

function reqLocale(req: any): ServerLocale {
  return resolveServerLocale(req?.body?.locale, req?.query?.locale, req?.appLocale);
}
function h(fn: (req: any, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => fn(req, res).catch((e: any) => {
    const status = Number(e?.status) || 500;
    res.status(status).json({ error: e?.message || 'Internal error', code: e?.code || 'ADVANCED_ERROR' });
  });
}
async function gate(ctx: AdvancedRouteContext, req: any, key: string) {
  const on = await ctx.featureEnabled(req.actor.tenantId, key);
  if (!on) throw Object.assign(new Error('Feature not enabled for this tenant'), { status: 403, code: 'FEATURE_DISABLED' });
}

export function registerAdvancedRoutes(app: Express, ctx: AdvancedRouteContext) {
  const { authenticate, requireRoles, realtime, data } = ctx;

  // 1) Ghost Cohort — إيقاع المتفوقين المجهول مقابل الطالب الحالي.
  app.get('/api/assignments/:assignmentId/ghost-cohort', authenticate, h(async (req, res) => {
    await gate(ctx, req, 'GhostCohort');
    const members = await data.getGhostCohortMembers(req.actor.tenantId, req.params.assignmentId);
    const projectId = String(req.query.projectId || '');
    let live: any;
    if (projectId) {
      const dna = await data.getProjectDNA(req.actor.tenantId, projectId, req.actor.userId);
      if (dna?.createdAt && dna?.deadlines?.final) {
        live = { startedAt: new Date(dna.createdAt).getTime(), deadline: new Date(dna.deadlines.final).getTime(), now: Date.now(), milestones: dna.ghostMilestones || [], revisionCount: dna.revision || 0 };
      }
    }
    res.json(buildGhostCohort(members, { live, locale: reqLocale(req) }));
  }));

  // 2) Predictive Grade-Loss Map — أين خسر الفوج درجات، مقابل جاهزية Rubric الحالية.
  app.get('/api/assignments/:assignmentId/grade-loss-map', authenticate, h(async (req, res) => {
    await gate(ctx, req, 'GradeLossMap');
    const submissions = await data.getAssignmentSubmissions(req.actor.tenantId, req.params.assignmentId);
    const projectId = String(req.query.projectId || '');
    const dna = projectId ? await data.getProjectDNA(req.actor.tenantId, projectId, req.actor.userId) : null;
    const locale = reqLocale(req);
    let map = buildGradeLossMap(submissions as any, dna?.rubric || [], locale);
    if (dna?.rubric?.length) map = alignRubricByTitle(map, dna.rubric);
    res.json(map);
  }));

  // 3) Reverse Assessment — «اصنع الامتحان».
  app.get('/api/projects/:id/reverse-assessment/brief', authenticate, h(async (req, res) => {
    const dna = await data.getProjectDNA(req.actor.tenantId, req.params.id, req.actor.userId);
    if (!dna) throw Object.assign(new Error('Project not found'), { status: 404, code: 'NOT_FOUND' });
    res.json(buildExamBrief(dna, reqLocale(req)));
  }));
  app.post('/api/projects/:id/reverse-assessment', authenticate, h(async (req, res) => {
    const dna = await data.getProjectDNA(req.actor.tenantId, req.params.id, req.actor.userId);
    if (!dna) throw Object.assign(new Error('Project not found'), { status: 404, code: 'NOT_FOUND' });
    const input: ReverseAssessmentInput = { projectId: req.params.id, dna, questions: Array.isArray(req.body?.questions) ? req.body.questions.slice(0, 20) : [] };
    const result = evaluateReverseAssessment(input, reqLocale(req));
    if (result.band !== 'surface') await data.saveProofOfLearning(req.actor.tenantId, req.params.id, req.actor.userId, result.proofOfLearning);
    res.json(result);
  }));

  // 4) Live Clarification Room — جواب الأستaذ يُبثّ ويُحدّث DNA لكل الفصل.
  app.post('/api/clarifications/:threadId/answer', authenticate, requireRoles('instructor', 'professor', 'course_coordinator', 'department_admin', 'faculty_admin', 'superadmin', 'root_owner'), h(async (req, res) => {
    const thread = await data.getClarificationThread(req.actor.tenantId, req.params.threadId);
    if (!thread) throw Object.assign(new Error('Thread not found'), { status: 404, code: 'NOT_FOUND' });
    const { thread: next, broadcast } = answerClarification(thread, { answer: String(req.body?.answer || ''), answeredBy: req.actor.userId, addRequirements: req.body?.addRequirements, clarifyDeadline: req.body?.clarifyDeadline });
    await data.saveClarificationThread(next);
    const affected = await data.listAffectedProjectOwners(req.actor.tenantId, thread.assignmentId);
    for (const a of affected) {
      const dna = await data.getProjectDNA(req.actor.tenantId, a.projectId, a.userId);
      if (!dna || !next.dnaPatch) continue;
      const { dna: patched, changed } = applyClarificationPatch(dna, next.dnaPatch);
      if (changed) await data.applyDnaPatchToProject(req.actor.tenantId, a.projectId, a.userId, patched, next.version);
    }
    realtime.publish(RealtimeHub.assignmentChannel(req.actor.tenantId, thread.assignmentId), 'clarification_answered', broadcast);
    res.json({ thread: next, notified: affected.length });
  }));

  // 5) Peer Explanation Economy — شرح ≤60ث بلهجة الطالب، تحقّق + رصيد.
  app.post('/api/courses/:courseId/peer-explanations', authenticate, h(async (req, res) => {
    await gate(ctx, req, 'PeerExplanationEconomy');
    const sub: PeerExplanationSubmission = {
      id: `pex_${Date.now().toString(36)}_${req.actor.userId.slice(0, 6)}`, courseId: req.params.courseId, tenantId: req.actor.tenantId,
      authorId: req.actor.userId, concept: String(req.body?.concept || ''), transcript: String(req.body?.transcript || ''),
      durationSeconds: Number(req.body?.durationSeconds || 0), language: req.body?.language, referenceMaterial: req.body?.referenceMaterial,
    };
    const verdict = evaluateExplanation(sub);
    await data.savePeerExplanation(sub, verdict);
    let balance = creditBalance(await data.getPeerCreditLedger(req.actor.tenantId, req.params.courseId), req.actor.userId);
    if (verdict.accepted) {
      const ledger = await data.getPeerCreditLedger(req.actor.tenantId, req.params.courseId);
      const { ledger: next, applied } = applyCredit(ledger, { authorId: req.actor.userId, submissionId: sub.id, credit: verdict.creditAwarded, at: verdict.generatedAt });
      if (applied) { await data.savePeerCreditLedger(req.actor.tenantId, req.params.courseId, next); balance = creditBalance(next, req.actor.userId); }
    }
    res.json({ verdict, creditBalance: balance });
  }));

  // 6) Learning Black Box — تحقّق سلسلة hash محلية (اختيارية) وإرفاقها بجواز التأليف.
  app.post('/api/projects/:id/black-box/verify', authenticate, h(async (req, res) => {
    const chain: BlackBoxChain = { projectId: req.params.id, algorithm: 'sha256-chain-v1', genesis: String(req.body?.genesis || ''), events: Array.isArray(req.body?.events) ? req.body.events : [] };
    const verdict = verifyBlackBoxChain(chain);
    if (verdict.intact && req.body?.attach) await data.attachBlackBoxToCapsule(req.actor.tenantId, req.params.id, verdict);
    res.json(verdict);
  }));

  // 7) Alumni Legacy — إدراج مشروع خريج متميز (بموافقة) كنموذج مرجعي مرخّص.
  app.post('/api/projects/:id/legacy-listing', authenticate, h(async (req, res) => {
    await gate(ctx, req, 'AlumniLegacy');
    const inputs = await data.getLegacyEligibilityInputs(req.actor.tenantId, req.params.id, req.actor.userId);
    const consent = { granted: Boolean(req.body?.consent?.granted), scope: req.body?.consent?.scope || 'teaching_example', allowContact: Boolean(req.body?.consent?.allowContact) };
    const eligibility = assessLegacyEligibility({ consent, gradeRatio: inputs?.gradeRatio, hasEvidenceCapsule: Boolean(inputs?.hasEvidenceCapsule), hasProofOfLearning: Boolean(inputs?.hasProofOfLearning) });
    if (!eligibility.eligible) return void res.status(422).json({ eligibility });
    const listing = buildLegacyListing({ dna: inputs.dna, authorId: req.actor.userId, scope: consent.scope });
    await data.saveLegacyListing({ ...listing, tenantId: req.actor.tenantId, consent });
    res.json({ eligibility, listing, exampleSplit: computeRevenueSplit(1999) });
  }));

  // 8) WhatsApp Gateway — تحقّق التحدّي (GET) + استقبال webhook (POST).
  app.get('/api/whatsapp/webhook', h(async (req, res) => {
    const { ok, challenge } = verifyWebhookChallenge(req.query as any, String(process.env.WHATSAPP_VERIFY_TOKEN || ''));
    if (!ok) return void res.status(403).end();
    res.status(200).send(challenge);
  }));
  app.post('/api/whatsapp/webhook', h(async (req, res) => {
    const raw = (req as any).rawBody || JSON.stringify(req.body || {});
    const sig = req.header('X-Hub-Signature-256') || '';
    if (!verifyWhatsAppSignature(raw, sig, String(process.env.WHATSAPP_APP_SECRET || ''))) return void res.status(401).json({ code: 'BAD_SIGNATURE' });
    res.status(200).json({ received: true }); // Meta تتطلب 200 سريعًا؛ المعالجة غير متزامنة.
    const parsed = parseWhatsAppWebhook(req.body);
    if (parsed.statusesOnly) return;
    for (const m of parsed.messages) {
      const intake = toNormalizedIntake(m);
      // المعالجة الفعلية (ربط الرقم، رفع الوسائط، compile، إرسال الرد) عبر adapters في الإنتاج.
      void intake; void buildReply;
    }
  }));

  // نقطة صحة موحّدة للقدرات المتقدمة (للمراقبة).
  app.get('/api/advanced/health', h(async (_req, res) => {
    res.json({ ok: true, realtimeClients: realtime.size, engines: ['ghost-cohort', 'grade-loss-map', 'reverse-assessment', 'clarification-room', 'peer-explanation', 'learning-black-box', 'alumni-legacy', 'whatsapp-gateway'] });
  }));

  return app;
}

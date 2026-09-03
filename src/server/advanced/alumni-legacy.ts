// AcademicOS — Alumni Legacy  (إرث الخريجين 🏛️)
// مشاريع الخريجين المتميزة (بموافقتهم الصريحة) تصير نماذج مرجعية مرخّصة تشتريها الجامعات
// كأمثلة تدريس — والخريج يأخذ نسبة من الإيراد. أول loop اقتصادي يجعل الطالب يكسب من واجب قديم.
//
// كل الدوال نقية: تنقيح (redaction) حتمي، أهلية، وحساب توزيع الإيراد بحساب صحيح بالسنتات (بلا فواقد كسور).

import { isoNow, round, digest, normalize } from './_shared';
import type { ProjectDNA } from '../../types';

export interface LegacyConsent {
  granted: boolean;
  scope: 'reference_only' | 'teaching_example' | 'full_showcase';
  allowContact: boolean;
  grantedAt?: string;
}
export interface LegacyEligibility {
  eligible: boolean;
  reasons: string[];
  qualityGate: { gradeRatio?: number; hasEvidenceCapsule: boolean; hasProofOfLearning: boolean };
}

// أهلية: موافقة صريحة + درجة عالية + دليل أصالة (Capsule/PoL). لا يُدرج مشروع بلا هذه الثلاثة.
export function assessLegacyEligibility(params: {
  consent: LegacyConsent; gradeRatio?: number; hasEvidenceCapsule: boolean; hasProofOfLearning: boolean; minGrade?: number;
}): LegacyEligibility {
  const minGrade = params.minGrade ?? 0.85;
  const reasons: string[] = [];
  if (!params.consent?.granted) reasons.push('لا توجد موافقة صريحة من الخريج.');
  if ((params.gradeRatio ?? 0) < minGrade) reasons.push(`الدرجة دون عتبة التميز (${Math.round(minGrade * 100)}%).`);
  if (!params.hasEvidenceCapsule) reasons.push('لا يوجد Evidence Capsule يثبت الأصالة.');
  if (!params.hasProofOfLearning) reasons.push('لا يوجد Proof of Learning.');
  return {
    eligible: reasons.length === 0,
    reasons,
    qualityGate: { gradeRatio: params.gradeRatio, hasEvidenceCapsule: params.hasEvidenceCapsule, hasProofOfLearning: params.hasProofOfLearning },
  };
}

export interface LegacyListing {
  id: string;
  title: string;
  academicDomain: string;
  projectType: string;
  scope: LegacyConsent['scope'];
  redactedOutline: Array<{ section: string; purpose: string }>;
  skills: string[];
  outcomes: string[];
  anonymizedAuthorRef: string;   // hash — لا اسم
  createdAt: string;
  provenanceNote: string;
}

// تنقيح: يحوّل المشروع إلى «هيكل تدريسي» — أغراض الأقسام والمهارات والمخرجات فقط، بلا نص الطالب.
export function buildLegacyListing(params: {
  dna: Pick<ProjectDNA, 'title' | 'academicDomain' | 'projectType' | 'requiredSkills' | 'learningOutcomes' | 'deliverables'>;
  authorId: string; scope: LegacyConsent['scope']; now?: number;
}): LegacyListing {
  const now = params.now ?? Date.now();
  return {
    id: `lgc_${digest(`${params.authorId}|${normalize(params.dna.title)}`).slice(0, 16)}`,
    title: params.dna.title, academicDomain: params.dna.academicDomain, projectType: params.dna.projectType,
    scope: params.scope,
    redactedOutline: (params.dna.deliverables || []).map(d => ({ section: d.title, purpose: d.format || 'deliverable' })),
    skills: params.dna.requiredSkills || [], outcomes: params.dna.learningOutcomes || [],
    anonymizedAuthorRef: `alum_${digest(params.authorId).slice(0, 12)}`,
    createdAt: isoNow(now),
    provenanceNote: 'قائمة مرجعية منقّحة: تُعرض بنية العمل وأغراضه ومهاراته ومخرجاته فقط — لا يُنشر نص الطالب الأصلي. الهوية مُخفاة بـ hash، والإدراج بموافقة صريحة قابلة للسحب.',
  };
}

// توزيع الإيراد بالسنتات — حساب عدد صحيح يمنع فقدان الكسور، ويضمن مجموع الأنصبة = المبلغ.
export interface RevenueSplit { grossCents: number; platformCents: number; authorCents: number; institutionCents: number; authorSharePct: number }
export function computeRevenueSplit(grossCents: number, opts: { authorSharePct?: number; institutionSharePct?: number } = {}): RevenueSplit {
  const gross = Math.max(0, Math.round(grossCents));
  const authorPct = Math.max(0, Math.min(100, opts.authorSharePct ?? 40));
  const instPct = Math.max(0, Math.min(100 - authorPct, opts.institutionSharePct ?? 20));
  const authorCents = Math.floor(gross * authorPct / 100);
  const institutionCents = Math.floor(gross * instPct / 100);
  const platformCents = gross - authorCents - institutionCents; // الباقي للمنصة (يمتص الكسور)
  return { grossCents: gross, platformCents, authorCents, institutionCents, authorSharePct: authorPct };
}

// دفتر إيراد الخريج — يمنع القيد المزدوج لنفس عملية البيع.
export interface LegacySaleEntry { listingId: string; saleId: string; authorCents: number; at: string }
export function recordSale(ledger: LegacySaleEntry[], entry: LegacySaleEntry): { ledger: LegacySaleEntry[]; applied: boolean } {
  if (ledger.some(e => e.saleId === entry.saleId)) return { ledger, applied: false };
  return { ledger: [...ledger, entry], applied: true };
}
export function authorEarningsCents(ledger: LegacySaleEntry[], listingIds: string[]): number {
  const set = new Set(listingIds);
  return ledger.filter(e => set.has(e.listingId)).reduce((n, e) => n + e.authorCents, 0);
}

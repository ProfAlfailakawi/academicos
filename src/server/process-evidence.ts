// Process Evidence — an authorship timeline built from what the student
// actually did (drafts, revisions, viva answers, source checks), exported as a
// printable report with a server-signed verification code.
//
// The report is canonicalised (stable key order) and hashed with SHA-256; the
// hash is then signed with HMAC-SHA256 using a server secret. Anyone holding a
// printed/exported report can ask the public verify endpoint whether the hash
// matches the content and whether the signature was issued by this server.
// Nothing here scores authorship or claims to detect AI.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type {
  AcademicTimeMachine,
  AcademicTimeMachineEvent,
  ProjectDNA,
  ProjectEvidence,
  WorkspaceArtifactVersion,
} from "../types";
import { resolveVariationSecret } from "./variation-secret";

export const PROCESS_EVIDENCE_SCHEMA = "academicos.process-evidence/1" as const;

export type ProcessEvidenceKind =
  | "created"
  | "draft"
  | "revision"
  | "viva"
  | "source_check"
  | "evidence"
  | "ai_assist"
  | "submission"
  | "plan"
  | "review"
  | "other";

export interface ProcessEvidenceEntry {
  id: string;
  at: string;
  kind: ProcessEvidenceKind;
  title: string;
  detail: string;
  actorType: "human" | "ai" | "system";
  version?: number;
}

export interface ProcessEvidenceSummary {
  drafts: number;
  revisions: number;
  vivaAnswers: number;
  sourceChecks: number;
  aiAssists: number;
  totalEntries: number;
  activeDays: number;
  firstAt?: string;
  latestAt?: string;
}

export interface ProcessEvidencePayload {
  schema: typeof PROCESS_EVIDENCE_SCHEMA;
  projectId: string;
  projectTitle: string;
  course: string;
  generatedAt: string;
  entries: ProcessEvidenceEntry[];
  summary: ProcessEvidenceSummary;
}

export interface ProcessEvidenceReport extends ProcessEvidencePayload {
  integrity: {
    algorithm: "SHA-256+HMAC-SHA256";
    contentHash: string;
    signature: string;
    keyId: string;
    /** Short, human-typeable form printed on the report. */
    verificationCode: string;
  };
}

export interface ProcessEvidenceVerification {
  hashValid: boolean;
  signatureValid: boolean;
  status: "valid" | "tampered" | "unknown_signer";
}

const MAX_ENTRIES = 400;

/** Stable JSON: object keys sorted recursively, undefined dropped. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item === undefined ? null : item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function processEvidenceSecret(env: NodeJS.ProcessEnv = process.env): string {
  const configured = String(env.PROCESS_EVIDENCE_SECRET || "").trim();
  return configured ? `process-evidence:${configured}` : resolveVariationSecret("process-evidence");
}

export function processEvidenceKeyId(secret: string): string {
  return createHash("sha256").update(`kid:${secret}`).digest("hex").slice(0, 12);
}

function kindForEvent(event: AcademicTimeMachineEvent, evidenceById: Map<string, ProjectEvidence>): ProcessEvidenceKind {
  if (event.source === "artifact") return (event.version || 1) > 1 ? "revision" : "draft";
  if (event.source === "artifact_version") return (event.version || 1) > 1 ? "revision" : "draft";
  if (event.source === "project_version") return "plan";
  if (event.source === "learning_evidence") return event.kind === "viva" ? "viva" : "evidence";
  if (event.source === "ai_run") return "ai_assist";
  if (event.source === "evidence") {
    const record = evidenceById.get(event.id.replace(/^evidence_/, ""));
    return record?.type === "source" ? "source_check" : "evidence";
  }
  switch (event.kind) {
    case "created":
      return "created";
    case "work":
      return "draft";
    case "version":
      return "revision";
    case "viva":
      return "viva";
    case "evidence":
      return "evidence";
    case "ai":
      return "ai_assist";
    case "submission":
      return "submission";
    case "plan":
      return "plan";
    case "review":
      return "review";
    default:
      return "other";
  }
}

export function buildProcessEvidencePayload(input: {
  project: Pick<ProjectDNA, "id" | "title" | "course">;
  timeMachine: AcademicTimeMachine;
  evidence?: ProjectEvidence[];
  artifactVersions?: WorkspaceArtifactVersion[];
  now?: Date;
}): ProcessEvidencePayload {
  const evidenceById = new Map((input.evidence || []).map((item) => [item.id, item]));
  const events: AcademicTimeMachineEvent[] = [...input.timeMachine.events];
  for (const version of input.artifactVersions || []) {
    events.push({
      id: `artifact_version_${version.id}`,
      at: version.createdAt,
      kind: "version",
      title: version.snapshot?.title || "Draft",
      detail: `${version.snapshot?.module || "workspace"} · v${version.versionNumber} · ${(version.snapshot?.content || "").length} chars`,
      actorType: "human",
      actor: version.actorId,
      source: "artifact_version",
      version: version.versionNumber,
    });
  }
  const seen = new Set<string>();
  const entries: ProcessEvidenceEntry[] = events
    .filter((event) => event.at && !Number.isNaN(Date.parse(event.at)))
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))
    .filter((event) => (seen.has(event.id) ? false : (seen.add(event.id), true)))
    .slice(-MAX_ENTRIES)
    .map((event) => ({
      id: event.id,
      at: event.at,
      kind: kindForEvent(event, evidenceById),
      title: String(event.title || "").slice(0, 240),
      detail: String(event.detail || "").slice(0, 600),
      actorType: event.actorType,
      ...(typeof event.version === "number" ? { version: event.version } : {}),
    }));
  const count = (kind: ProcessEvidenceKind) => entries.filter((entry) => entry.kind === kind).length;
  const days = new Set(entries.filter((e) => e.actorType === "human").map((entry) => entry.at.slice(0, 10)));
  return {
    schema: PROCESS_EVIDENCE_SCHEMA,
    projectId: input.project.id,
    projectTitle: input.project.title,
    course: input.project.course,
    generatedAt: (input.now || new Date()).toISOString(),
    entries,
    summary: {
      drafts: count("draft"),
      revisions: count("revision"),
      vivaAnswers: count("viva"),
      sourceChecks: count("source_check"),
      aiAssists: count("ai_assist"),
      totalEntries: entries.length,
      activeDays: days.size,
      firstAt: entries[0]?.at,
      latestAt: entries[entries.length - 1]?.at,
    },
  };
}

export function hashProcessEvidence(payload: ProcessEvidencePayload): string {
  const { schema, projectId, projectTitle, course, generatedAt, entries, summary } = payload;
  return createHash("sha256")
    .update(canonicalJson({ schema, projectId, projectTitle, course, generatedAt, entries, summary }))
    .digest("hex");
}

export function signProcessEvidence(payload: ProcessEvidencePayload, secret: string): ProcessEvidenceReport {
  const contentHash = hashProcessEvidence(payload);
  const signature = createHmac("sha256", secret).update(`${PROCESS_EVIDENCE_SCHEMA}|${contentHash}`).digest("hex");
  return {
    ...payload,
    integrity: {
      algorithm: "SHA-256+HMAC-SHA256",
      contentHash,
      signature,
      keyId: processEvidenceKeyId(secret),
      verificationCode: formatVerificationCode(signature),
    },
  };
}

export function formatVerificationCode(signature: string): string {
  return (signature.slice(0, 16).toUpperCase().match(/.{1,4}/g) || []).join("-");
}

function safeEqualHex(a: string, b: string) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

/**
 * Verify a full report (content re-hashed) or, when only the printed
 * `contentHash` + `signature` are supplied, verify the signature alone.
 */
export function verifyProcessEvidence(
  input: { report?: Partial<ProcessEvidenceReport>; contentHash?: string; signature?: string },
  secret: string,
): ProcessEvidenceVerification {
  const report = input.report;
  const claimedHash = String(report?.integrity?.contentHash || input.contentHash || "").toLowerCase();
  const signature = String(report?.integrity?.signature || input.signature || "").toLowerCase();
  let hashValid = /^[a-f0-9]{64}$/.test(claimedHash);
  if (report && report.schema === PROCESS_EVIDENCE_SCHEMA && Array.isArray(report.entries) && report.summary) {
    hashValid = hashValid && hashProcessEvidence(report as ProcessEvidencePayload) === claimedHash;
  } else if (report) {
    hashValid = false;
  }
  const expected = createHmac("sha256", secret).update(`${PROCESS_EVIDENCE_SCHEMA}|${claimedHash}`).digest("hex");
  const signatureValid = /^[a-f0-9]{64}$/.test(signature) && safeEqualHex(expected, signature);
  return {
    hashValid,
    signatureValid,
    status: !hashValid ? "tampered" : signatureValid ? "valid" : "unknown_signer",
  };
}

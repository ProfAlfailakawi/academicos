import "dotenv/config";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import path from "node:path";
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getAppCheck } from "firebase-admin/app-check";
import { aiConfigured, aiProviderStatus, getAIProvider } from "./src/server/ai";
import {
  createExtractionBudget,
  extractFileText,
  type IncomingFile,
} from "./src/server/file-extract";
import {
  buildProjectDNA,
  recalculateProject,
} from "./src/server/project-engine";
import { compileAssignmentNative } from "./src/server/native-compiler";
import {
  buildTutorRequest,
  toLesson,
  nativeTutorScaffold,
} from "./src/server/tutor";
import {
  decideSolveMode,
  buildSolveRequest,
  buildSolveVariation,
  toSolveResult,
  nativeSolveScaffold,
} from "./src/server/solver";
import { learnCacheKey, cacheScope } from "./src/server/learn-cache";
import {
  buildDashboard,
  buildPassport,
  buildSkills,
  firestoreStore,
} from "./src/server/db";
import JSZip from "jszip";
import { runSubmissionAudit } from "./src/server/audit";
import { runStyleIntegrityAnalysis, improveScholarlyStyle } from "./src/server/deep-ai-detector";
import { getOriginalFileUrl, storeOriginalFile } from "./src/server/storage";
import {
  exportCitations,
  exportCourseArchive,
  exportLearningEvidenceReport,
  exportProject,
  projectExportHtml,
} from "./src/server/export";
import {
  billingPlan,
  billingStatus,
  getBillingProvider,
  verifyLemonSqueezyWebhook,
  verifyMyFatoorahWebhook,
  verifyTapWebhook,
  type VerifiedPaymentEvent,
} from "./src/server/billing";
import { completeViva, createVivaSession } from "./src/server/viva";
import {
  composeProjectDocument,
  decideProjectWritingAccess,
  inspectProjectDraft,
} from "./src/server/project-writer";
import {
  PREVIEW_PAGE_LIMIT,
  decideProjectGeneration,
  isPaidProjectPlan,
} from "./src/server/project-access";
import { PLATFORM_RESOURCES, platformStore } from "./src/server/platform-store";
import { emitWebhookEvent } from "./src/server/webhooks";
import { platformCapability } from "./src/server/capability-registry";
import {
  buildCurriculumTwin,
  buildEvidenceCapsule,
  buildLearningBrain,
  buildMissionControl,
  buildTimeMachine,
  buildTrustGraph,
  simulateCurriculumTwin,
  verifyEvidenceCapsule,
} from "./src/server/intelligence";
import {
  buildAccreditationDossier,
  buildAuthorshipPassport,
  buildDeadlineCongestion,
  lintAssignmentIntegrity,
  buildGraderFairness,
  buildFederatedGraph,
} from "./src/server/frontier";
import {
  createNotification,
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  saveNotificationPreferences,
  updateNotificationState,
} from "./src/server/notifications";
import { externalServices } from "./src/server/external-adapters";
import {
  assignableRolesFor,
  canManageUserRole,
  canSupportImpersonate,
  normalizeRateRoute,
  privilegedMfaRequired,
  validFutureIso,
} from "./src/server/security-controls";
import { ocrStatus, runOcr } from "./src/server/ocr";
import { fairUseMetrics, finalizeFreeBenefit, reserveFreeBenefit, type FairUseReservation } from "./src/server/abuse-guard";
import {
  buildCopilotPlatformInstruction,
  copilotEnabled,
  copilotFeatureFlag,
  finalizeCopilotRun,
  nativeCopilotResponse,
  shouldBlockCopilot,
} from "./src/server/copilot";
import { embeddingsConfigured, embeddingBackend, groundingConfigured, groundedResearch } from "./src/server/retrieval";
import { ingestRetrievalIndex, projectRawSources, semanticFileSearch } from "./src/server/retrieval-service";
import {
  addConcierge,
  buildFacultyAutomation,
  buildInstitutionCommandCenter,
  buildRescuePlan,
  normalizeRubricGrades,
} from "./src/server/experience-engine";
import type {
  AdminUserRecord,
  AIUsagePolicy,
  AssignmentIntake,
  CopilotMode,
  CourseAssignmentRecord,
  CourseRecord,
  CourseSubmissionRecord,
  FeatureFlagRecord,
  GlobalSearchItem,
  IntegrationStatusRecord,
  JobRecord,
  OcrExtractionRecord,
  PlatformResourceKey,
  ProjectDocument,
  ProjectDNA,
  ProjectWriterRequest,
  ProjectMemberRecord,
  ProjectPresenceRecord,
  ProjectEvidence,
  EvidenceCapsule,
  SupportTicket,
  UserProfile,
  UserRole,
  VivaMode,
  WorkspaceArtifact,
} from "./src/types";
// Production-only runtime. Test data runs through Firebase emulators, never a user-facing bypass.
const PORT = Number(process.env.PORT) || 3000;
const MAX_FILE_BYTES = Number(
  process.env.MAX_ASSIGNMENT_FILE_BYTES || 20 * 1024 * 1024,
);
const MAX_TOTAL_FILE_BYTES = Number(
  process.env.MAX_ASSIGNMENT_TOTAL_BYTES || 60 * 1024 * 1024,
);
const MAX_ASSIGNMENT_FILES = Number(process.env.MAX_ASSIGNMENT_FILES || 10);
const API_RATE_LIMIT_PER_MINUTE = Math.max(
  20,
  Number(process.env.API_RATE_LIMIT_PER_MINUTE || 180),
);
const API_WRITE_RATE_LIMIT_PER_MINUTE = Math.max(
  10,
  Number(process.env.API_WRITE_RATE_LIMIT_PER_MINUTE || 60),
);
const API_USER_RATE_LIMIT_PER_MINUTE = Math.max(
  30,
  Number(process.env.API_USER_RATE_LIMIT_PER_MINUTE || 240),
);
const API_TENANT_RATE_LIMIT_PER_MINUTE = Math.max(
  300,
  Number(process.env.API_TENANT_RATE_LIMIT_PER_MINUTE || 5000),
);
let firebaseInitialized = false;
const FACULTY_ROLES: UserRole[] = [
  "professor",
  "course_coordinator",
  "department_admin",
  "college_admin",
  "university_admin",
  "admin",
  "superadmin",
  "root_owner",
];
const FEATURE_ADMIN_ROLES: UserRole[] = [
  "university_admin",
  "ai_governance_officer",
  "admin",
  "superadmin",
  "root_owner",
];
const SUPPORT_ROLES: UserRole[] = [
  "support_agent",
  "trust_safety_admin",
  "admin",
  "superadmin",
  "root_owner",
];
const USER_ADMIN_ROLES: UserRole[] = [
  "university_admin",
  "admin",
  "superadmin",
  "root_owner",
];
const FEATURE_DEFAULTS = [
  {
    key: "VivaStudio",
    enabled: true,
    description: "Viva Simulator and Proof of Learning sessions",
  },
  {
    key: "ProjectExport",
    enabled: true,
    description: "Project JSON/Markdown/Office/ZIP export",
  },
  {
    key: "EvidenceStudio",
    enabled: true,
    description: "Project evidence inbox and traceability",
  },
  {
    key: "ProfessorOS",
    enabled: true,
    description: "CourseOS and Assignment Builder institutional workflow",
  },
  {
    key: "AcademicPassportV2",
    enabled: true,
    description: "Verified Academic/Career Passport sharing workflow",
  },
  {
    key: "NationalAnalytics",
    enabled: false,
    description:
      "National aggregate analytics; enable only for contracted national tenants",
  },
  {
    key: "Marketplace",
    enabled: false,
    description:
      "Template/skills marketplace; moderation and commercial policy required",
  },
  {
    key: "VoiceViva",
    enabled: false,
    description: "Voice Viva adapter; speech provider credentials required",
  },
  {
    key: "EmployerNetwork",
    enabled: false,
    description:
      "Employer/challenge network sharing with explicit learner consent",
  },
  {
    key: "ProjectCopilot",
    enabled: true,
    description: "Project Copilot shell with rubric/evidence grounded outputs",
  },
  {
    key: "ProjectCopilotFileSearch",
    enabled: true,
    description: "Private project/course semantic file search over a self-hosted vector store with citations",
  },
  {
    key: "ResearchStudioGrounding",
    enabled: false,
    description: "Real Google Search Grounding inside Research Studio (native tool or institution gateway)",
  },
  {
    key: "MultimodalAssignmentCompiler",
    enabled: true,
    description: "Multimodal assignment compiler linked to Project DNA",
  },
  {
    key: "AdaptiveCopilotTutor",
    enabled: true,
    description: "Adaptive tutoring that coaches without doing the submission",
  },
  {
    key: "WorkspaceFunctionCalling",
    enabled: false,
    description: "Governed function calling between project workspaces",
  },
  {
    key: "GeminiLiveViva",
    enabled: false,
    description: "Gemini Live Viva and proof-of-learning adapter",
  },
  {
    key: "ExternalCodeExecution",
    enabled: false,
    description:
      "Isolated code sandbox execution; never runs on the application backend",
  },
  {
    key: "SemanticRAG",
    enabled: false,
    description: "Tenant/project scoped semantic indexing and RAG provider",
  },
] as const;
const ALL_ROLES: UserRole[] = [
  "student",
  "student_group_leader",
  "teaching_assistant",
  "professor",
  "course_coordinator",
  "department_admin",
  "college_admin",
  "university_admin",
  "ai_governance_officer",
  "accreditation_officer",
  "national_admin",
  "employer",
  "support_agent",
  "finance_admin",
  "trust_safety_admin",
  "admin",
  "superadmin",
  "root_owner",
];
function initFirebase() {
  if (getApps().length) {
    firebaseInitialized = getApps().length > 0;
    return;
  }
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    initializeApp({
      credential: raw ? cert(JSON.parse(raw)) : applicationDefault(),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
    firebaseInitialized = true;
  } catch (error) {
    console.error("Firebase Admin initialization failed:", error);
    firebaseInitialized = false;
    if (process.env.NODE_ENV === "production") throw error;
  }
}
interface AuthenticatedRequest extends Request {
  actor?: {
    userId: string;
    tenantId: string;
    role: UserRole;
    displayName: string;
    email?: string;
    impersonatorId?: string;
    impersonationReadOnly?: boolean;
    impersonationExpiresAt?: number;
    mfa?: boolean;
    authTime?: number;
    emailVerified?: boolean;
  };
}
async function verifyAppCheck(req: Request, res: Response, next: NextFunction) {
  const required =
    process.env.REQUIRE_APP_CHECK === "true" ||
    (process.env.NODE_ENV === "production" && process.env.REQUIRE_APP_CHECK !== "false");
  if (!required) return next();
  if (!firebaseInitialized)
    return res.status(503).json({
      error: "Firebase backend is not configured",
      code: "FIREBASE_NOT_CONFIGURED",
    });
  const token = String(req.header("X-Firebase-AppCheck") || "");
  if (!token)
    return res.status(401).json({
      error: "Firebase App Check token required",
      code: "APP_CHECK_REQUIRED",
    });
  try {
    await getAppCheck().verifyToken(token);
    next();
  } catch {
    return res.status(401).json({
      error: "Invalid Firebase App Check token",
      code: "APP_CHECK_INVALID",
    });
  }
}
async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.header("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  
  if (!firebaseInitialized) {
    return res.status(503).json({
      error: "Authentication service is not configured",
      code: "FIREBASE_NOT_CONFIGURED",
    });
  }
  if (!token) {
    return res.status(401).json({
      error: "Authentication required",
      code: "AUTH_REQUIRED",
    });
  }

  try {
    const decoded = await getAuth().verifyIdToken(token, true);
    const rawRole = String(decoded.role || "student");
    const role: UserRole = ALL_ROLES.includes(rawRole as UserRole)
      ? (rawRole as UserRole)
      : "student";
    const tenantId = String(decoded.tenantId || `individual_${decoded.uid}`);
    const impersonatorId = decoded.impersonatorId
      ? String(decoded.impersonatorId)
      : undefined;
    const impersonationExpiresAt = decoded.impersonationExpiresAt
      ? Number(decoded.impersonationExpiresAt)
      : undefined;
    const mfa = Boolean((decoded.firebase as any)?.sign_in_second_factor);
    const authTime = Number(decoded.auth_time || 0);

    if (
      impersonatorId &&
      (!impersonationExpiresAt || impersonationExpiresAt <= Date.now())
    )
      return res.status(401).json({
        error: "Impersonation session has expired",
        code: "IMPERSONATION_EXPIRED",
      });
    if (impersonatorId && !["GET", "HEAD", "OPTIONS"].includes(req.method))
      return res.status(403).json({
        error: "Impersonation sessions are read-only by design",
        code: "IMPERSONATION_READ_ONLY",
      });
    if (privilegedMfaRequired(role) && !mfa)
      return res.status(403).json({
        error:
          "Multi-factor authentication is required for this administrative role",
        code: "ADMIN_MFA_REQUIRED",
      });

    req.actor = {
      userId: decoded.uid,
      tenantId,
      role,
      displayName: decoded.name || decoded.email || "AcademicOS User",
      email: decoded.email,
      impersonatorId,
      impersonationReadOnly: Boolean(impersonatorId),
      impersonationExpiresAt,
      mfa,
      authTime,
      emailVerified: Boolean(decoded.email_verified),
    };
    if (!enforceIdentityRateLimit(req, res, req.actor)) return;
    return next();
  } catch (error: any) {
    const revoked = String(error?.code || "").includes("id-token-revoked");
    return res.status(401).json({
      error: revoked ? "Session has been revoked" : "Invalid or expired authentication token",
      code: revoked ? "AUTH_REVOKED" : "AUTH_INVALID",
    });
  }
}
function requireRoles(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.actor || !roles.includes(req.actor.role))
      return res
        .status(403)
        .json({ error: "Insufficient permission", code: "FORBIDDEN" });
    next();
  };
}
function requireRecentPrivilegedAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const actor = req.actor;
  if (!actor)
    return res
      .status(401)
      .json({ error: "Authentication required", code: "AUTH_REQUIRED" });
  const maxAge = Math.max(
    60,
    Number(process.env.PRIVILEGED_REAUTH_MAX_AGE_SECONDS || 600),
  );
  if (!actor.authTime || Date.now() / 1000 - actor.authTime > maxAge)
    return res.status(401).json({
      error: "Re-authentication is required for this sensitive action",
      code: "REAUTH_REQUIRED",
    });
  if (privilegedMfaRequired(actor.role) && !actor.mfa)
    return res.status(403).json({
      error: "MFA is required for this sensitive action",
      code: "ADMIN_MFA_REQUIRED",
    });
  next();
}
function cleanField(value: unknown, max = 240) {
  return typeof value === "string"
    ? value.replace(/\x00/g, "").trim().slice(0, max)
    : "";
}
function cleanStringList(value: unknown, maxItems = 50, maxChars = 300) {
  return Array.isArray(value)
    ? [
        ...new Set(value.map((v) => cleanField(v, maxChars)).filter(Boolean)),
      ].slice(0, maxItems)
    : [];
}
type CrossrefWork = Record<string, any>;
function crossrefUserAgent() {
  const appUrl = cleanField(process.env.APP_URL, 500) || "https://academicos.app";
  const mailto = cleanField(process.env.CROSSREF_MAILTO, 320);
  return `AcademicOS/0.9 (${appUrl}${mailto ? `; mailto:${mailto}` : ""})`;
}
function crossrefSourceFromWork(work: CrossrefWork) {
  const doi = cleanField(work?.DOI, 500);
  if (!doi) return null;
  const title = cleanField(Array.isArray(work?.title) ? work.title[0] : work?.title, 1000) || doi;
  const authors = Array.isArray(work?.author)
    ? work.author.slice(0, 30).map((author: any) => {
        const given = cleanField(author?.given, 200), family = cleanField(author?.family, 200), name = cleanField(author?.name, 300);
        return [given, family].filter(Boolean).join(" ") || name;
      }).filter(Boolean)
    : [];
  const dateParts = work?.["published-print"]?.["date-parts"]?.[0]
    || work?.["published-online"]?.["date-parts"]?.[0]
    || work?.published?.["date-parts"]?.[0]
    || work?.created?.["date-parts"]?.[0]
    || [];
  const year = Number(dateParts?.[0]);
  const containerTitle = cleanField(Array.isArray(work?.["container-title"]) ? work["container-title"][0] : work?.["container-title"], 600) || undefined;
  const citedByCountRaw = Number(work?.["is-referenced-by-count"]);
  const issn = Array.isArray(work?.ISSN) ? cleanStringList(work.ISSN, 10, 80) : [];
  const licenseUrls = Array.isArray(work?.license)
    ? [...new Set(work.license.map((item: any) => cleanField(item?.URL, 1000)).filter((url: string) => /^https?:\/\//i.test(url)))].slice(0, 10)
    : [];
  return {
    doi,
    title,
    authors,
    ...(Number.isFinite(year) && year > 0 ? { year } : {}),
    ...(containerTitle ? { containerTitle } : {}),
    ...(Number.isFinite(citedByCountRaw) && citedByCountRaw >= 0 ? { citedByCount: citedByCountRaw } : {}),
    ...(issn.length ? { issn } : {}),
    url: `https://doi.org/${doi}`,
    ...(cleanField(work?.type, 160) ? { type: cleanField(work.type, 160) } : {}),
    ...(licenseUrls.length ? { licenseUrls } : {}),
    provider: "crossref" as const,
    metadataVerifiedAt: new Date().toISOString(),
  };
}
async function crossrefJson(path: string, params?: URLSearchParams) {
  const url = new URL(`https://api.crossref.org${path}`);
  if (params) params.forEach((value, key) => url.searchParams.append(key, value));
  const mailto = cleanField(process.env.CROSSREF_MAILTO, 320);
  if (mailto && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailto)) url.searchParams.set("mailto", mailto);
  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": crossrefUserAgent() },
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    throw Object.assign(new Error("Crossref is temporarily unreachable"), { status: 502, code: "CROSSREF_UNAVAILABLE", cause: error });
  }
  if (response.status === 404) throw Object.assign(new Error("DOI was not found in Crossref"), { status: 404, code: "DOI_NOT_FOUND" });
  if (!response.ok) throw Object.assign(new Error("Crossref request failed"), { status: 502, code: "CROSSREF_UPSTREAM_ERROR" });
  return await response.json() as any;
}

function sanitizePlatformData(
  value: unknown,
  depth = 0,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  if (depth > 5)
    throw Object.assign(new Error("Platform data nesting is too deep"), {
      status: 400,
      code: "PLATFORM_DATA_DEPTH",
    });
  const out: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(
    value as Record<string, unknown>,
  ).slice(0, 120)) {
    const key = cleanField(rawKey, 80);
    if (!key) continue;
    const lower = key.toLowerCase();
    if (
      /(password|secret|privatekey|access[_-]?token|refresh[_-]?token|api[_-]?key)$/.test(
        lower,
      ) &&
      !/(envkey|ref|reference)$/.test(lower)
    )
      throw Object.assign(
        new Error(
          `Sensitive value ${key} must be stored in Secret Manager/environment and referenced, not persisted here.`,
        ),
        { status: 400, code: "SECRET_STORAGE_BLOCKED" },
      );
    if (
      rawValue === null ||
      typeof rawValue === "boolean" ||
      typeof rawValue === "number"
    ) {
      out[key] = rawValue;
      continue;
    }
    if (typeof rawValue === "string") {
      out[key] = cleanField(rawValue, 12000);
      continue;
    }
    if (Array.isArray(rawValue)) {
      out[key] = rawValue
        .slice(0, 150)
        .map((v) =>
          typeof v === "string"
            ? cleanField(v, 2000)
            : typeof v === "number" || typeof v === "boolean" || v === null
              ? v
              : typeof v === "object" && !Array.isArray(v)
                ? sanitizePlatformData(v, depth + 1)
                : String(v).slice(0, 2000),
        );
      continue;
    }
    if (typeof rawValue === "object")
      out[key] = sanitizePlatformData(rawValue, depth + 1);
  }
  if (Buffer.byteLength(JSON.stringify(out), "utf8") > 250000)
    throw Object.assign(
      new Error("Platform record exceeds 250 KB safety limit"),
      { status: 413, code: "PLATFORM_DATA_TOO_LARGE" },
    );
  return out;
}
function validatePlatformRecord(
  resource: PlatformResourceKey,
  status: string,
  data: Record<string, unknown>,
) {
  const cap = platformCapability(resource);
  if (cap && cap.statusValues.length && !cap.statusValues.includes(status))
    throw Object.assign(new Error(`Invalid status for ${resource}`), {
      status: 400,
      code: "INVALID_RESOURCE_STATUS",
    });
  if (resource === "webhooks") {
    const url = String(data.url || "");
    if (!url.startsWith("https://"))
      throw Object.assign(new Error("Webhook URL must use HTTPS"), {
        status: 400,
        code: "WEBHOOK_HTTPS_REQUIRED",
      });
    if (!Array.isArray(data.events) || !data.events.length)
      throw Object.assign(
        new Error("Webhook must subscribe to at least one event"),
        { status: 400, code: "WEBHOOK_EVENTS_REQUIRED" },
      );
    if (
      !String(data.signingSecretEnvKey || "").match(/^[A-Z][A-Z0-9_]{2,100}$/)
    )
      throw Object.assign(
        new Error(
          "Webhook signingSecretEnvKey must reference an environment/Secret Manager key",
        ),
        { status: 400, code: "WEBHOOK_SECRET_REFERENCE_REQUIRED" },
      );
  }
  if (resource === "domainClaims") {
    const domain = String(data.domain || "").toLowerCase();
    if (
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)
    )
      throw Object.assign(new Error("A valid domain is required"), {
        status: 400,
        code: "DOMAIN_INVALID",
      });
  }
}
function normalizeAcademicPolicy(value: any): AIUsagePolicy {
  const raw = Number(value?.level);
  const level = (
    Number.isFinite(raw) ? Math.min(5, Math.max(0, raw)) : 2
  ) as AIUsagePolicy["level"];
  const provenance = [
    "published_assignment",
    "course_policy",
    "extracted_unverified",
  ].includes(String(value?.provenance))
    ? value.provenance
    : undefined;
  return {
    level,
    summary: cleanField(value?.summary, 600) || `سياسة AI — المستوى ${level}`,
    allowed: cleanStringList(value?.allowed, 40, 180),
    prohibited: cleanStringList(value?.prohibited, 40, 180),
    disclosureRequired: Boolean(value?.disclosureRequired),
    needsConfirmation: Boolean(value?.needsConfirmation),
    provenance,
    courseId: cleanField(value?.courseId, 180) || undefined,
    assignmentId: cleanField(value?.assignmentId, 180) || undefined,
  };
}
function validateFile(file?: IncomingFile) {
  if (!file) return;
  if (
    !file.name ||
    !file.mimeType ||
    !file.base64 ||
    !Number.isFinite(file.size)
  )
    throw Object.assign(new Error("Invalid file payload"), {
      status: 400,
      code: "INVALID_FILE",
    });
  if (file.size > MAX_FILE_BYTES)
    throw Object.assign(
      new Error(
        `File exceeds configured limit of ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB`,
      ),
      { status: 413, code: "FILE_TOO_LARGE" },
    );
  const estimated = Buffer.byteLength(file.base64, "base64");
  if (Math.abs(estimated - file.size) > Math.max(1024, file.size * 0.02))
    throw Object.assign(new Error("File size does not match payload"), {
      status: 400,
      code: "INVALID_FILE_SIZE",
    });
}
type RateBucket = {
  minute: number;
  reads: number;
  writes: number;
};
const rateBuckets = new Map<string, RateBucket>();
const MAX_RATE_BUCKETS = 20000;
let lastRateSweepMinute = 0;
function apiRateLimit(req: Request, res: Response, next: NextFunction) {
  const nowMinute = Math.floor(Date.now() / 60000);
  if (lastRateSweepMinute !== nowMinute) {
    lastRateSweepMinute = nowMinute;
    for (const [key, value] of rateBuckets)
      if (value.minute < nowMinute - 1) rateBuckets.delete(key);
    for (const [key, value] of identityRateBuckets)
      if (value.minute < nowMinute - 1) identityRateBuckets.delete(key);
  }
  const key = String(req.ip || req.socket.remoteAddress || "unknown");
  let bucket = rateBuckets.get(key);
  if (!bucket || bucket.minute !== nowMinute) {
    if (!bucket && rateBuckets.size >= MAX_RATE_BUCKETS)
      return res.status(503).json({
        error: "Request limiter is at capacity. Try again shortly.",
        code: "RATE_LIMIT_CAPACITY",
      });
    bucket = { minute: nowMinute, reads: 0, writes: 0 };
    rateBuckets.set(key, bucket);
  }
  const write = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (write) bucket.writes += 1;
  else bucket.reads += 1;
  const sharedNetworkMultiplier = 10;
  const limit =
    (write ? API_WRITE_RATE_LIMIT_PER_MINUTE : API_RATE_LIMIT_PER_MINUTE) *
    sharedNetworkMultiplier;
  const used = write ? bucket.writes : bucket.reads;
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - used)));
  if (used > limit)
    return res.status(429).json({
      error: "Too many requests. Try again shortly.",
      code: "RATE_LIMITED",
    });
  next();
}
type IdentityRateBucket = {
  minute: number;
  count: number;
};
const identityRateBuckets = new Map<string, IdentityRateBucket>();
function enforceIdentityRateLimit(
  req: Request,
  res: Response,
  actor: {
    userId: string;
    tenantId: string;
  },
) {
  const minute = Math.floor(Date.now() / 60000);
  const endpoint = normalizeRateRoute(req.path);
  const checks: [string, number][] = [
    [`u:${actor.userId}:${endpoint}`, API_USER_RATE_LIMIT_PER_MINUTE],
    [`t:${actor.tenantId}:${endpoint}`, API_TENANT_RATE_LIMIT_PER_MINUTE],
  ];
  for (const [key, limit] of checks) {
    let bucket = identityRateBuckets.get(key);
    if (!bucket || bucket.minute !== minute) {
      if (!bucket && identityRateBuckets.size >= MAX_RATE_BUCKETS) {
        res.status(503).json({
          error: "Identity limiter is at capacity. Try again shortly.",
          code: "RATE_LIMIT_CAPACITY",
        });
        return false;
      }
      bucket = { minute, count: 0 };
      identityRateBuckets.set(key, bucket);
    }
    bucket.count++;
    if (bucket.count > limit) {
      res.setHeader("Retry-After", "60");
      res.status(429).json({
        error: "Authenticated request limit reached. Try again shortly.",
        code: "RATE_LIMITED",
      });
      return false;
    }
  }
  return true;
}
function maintenanceGate(req: Request, res: Response, next: NextFunction) {
  if (
    process.env.MAINTENANCE_MODE === "true" &&
    !["GET", "HEAD", "OPTIONS"].includes(req.method)
  ) {
    return res.status(503).json({
      error:
        "AcademicOS is in maintenance mode. Write actions are temporarily disabled.",
      code: "MAINTENANCE_MODE",
    });
  }
  next();
}
async function assertFeature(tenantId: string, key: string) {
  const defaultValue =
    FEATURE_DEFAULTS.find((f) => f.key === key)?.enabled ?? false;
  if (!(await firestoreStore.getFeatureFlag(tenantId, key, defaultValue)))
    throw Object.assign(new Error(`${key} is disabled for this tenant`), {
      status: 403,
      code: "FEATURE_DISABLED",
    });
}
async function recordProductEventSafe(
  actor: {
    userId: string;
    tenantId: string;
  },
  name: string,
  extra: {
    projectId?: string;
    courseId?: string;
    properties?: Record<string, string | number | boolean | null>;
  } = {},
) {
  try {
    await platformStore.recordEvent({
      tenantId: actor.tenantId,
      userId: actor.userId,
      name,
      projectId: extra.projectId,
      courseId: extra.courseId,
      properties: extra.properties || {},
      provenance: "server",
    });
  } catch (error) {
    console.warn("Product event failed", name, error);
  }
}
async function emitWebhookSafe(
  tenantId: string,
  type: string,
  data: Record<string, unknown>,
) {
  try {
    await emitWebhookEvent(tenantId, type, data);
  } catch (error) {
    console.warn("Webhook dispatch failed", type, error);
  }
}
async function persistVerifiedPayment(event: VerifiedPaymentEvent) {
  if (!event.eventId || !event.tenantId)
    throw Object.assign(new Error("Payment metadata is incomplete"), {
      status: 400,
      code: "PAYMENT_METADATA_INVALID",
    });
  const claim = await platformStore.claimExternalWebhook(
    event.provider,
    event.eventId,
  );
  if (!claim.claimed) return { duplicate: true };
  try {
    const at = new Date().toISOString();
    await platformStore.create(
      "transactions",
      event.tenantId,
      event.provider,
      {
        title: `${event.provider} ${event.rawType}`,
        status: event.status,
        data: {
          provider: event.provider,
          externalId: event.externalId,
          userId: event.userId || null,
          amount: event.amount,
          currency: event.currency,
          planId: event.planId || null,
          projectId: event.projectId || null,
          receivedAt: at,
        },
      },
      `${event.provider} verified webhook`,
    );
    if (event.status === "paid") {
      if (!event.userId || !event.projectId || !isPaidProjectPlan(event.planId))
        throw Object.assign(new Error("Paid project metadata is incomplete"), {
          status: 400,
          code: "PAYMENT_METADATA_INVALID",
        });
      await platformStore.grantProjectEntitlement({
        tenantId: event.tenantId,
        userId: event.userId,
        projectId: event.projectId,
        planId: event.planId,
        provider: event.provider,
        externalId: event.externalId,
        eventId: event.eventId,
      });
      await platformStore.recordEvent({
        tenantId: event.tenantId,
        userId: event.userId || event.provider,
        name: "project_plan_purchased",
        projectId: event.projectId,
        properties: { provider: event.provider, planId: event.planId },
        provenance: "server",
      });
    } else if (event.status === "refunded" || event.status === "chargeback") {
      if (event.userId && event.projectId)
        await platformStore.revokeProjectEntitlement({
          tenantId: event.tenantId,
          userId: event.userId,
          projectId: event.projectId,
          provider: event.provider,
          externalId: event.externalId,
          eventId: event.eventId,
          reason: event.status,
        });
    }
    await platformStore.completeExternalWebhook(claim.id, "completed");
    return { duplicate: false };
  } catch (error) {
    await platformStore.completeExternalWebhook(
      claim.id,
      "failed",
      error instanceof Error ? error.message : "Payment persistence failed",
    );
    throw error;
  }
}
function userTenantId(user: {
  uid: string;
  customClaims?: Record<string, unknown>;
}) {
  return String(user.customClaims?.tenantId || `individual_${user.uid}`);
}
function userRole(user: { customClaims?: Record<string, unknown> }): UserRole {
  const role = String(user.customClaims?.role || "student");
  return ALL_ROLES.includes(role as UserRole) ? (role as UserRole) : "student";
}
function toAdminUserRecord(user: any): AdminUserRecord {
  return {
    id: user.uid,
    email: user.email,
    displayName: user.displayName,
    role: userRole(user),
    tenantId: userTenantId(user),
    disabled: Boolean(user.disabled),
    emailVerified: Boolean(user.emailVerified),
    createdAt: user.metadata?.creationTime,
    lastSignInAt: user.metadata?.lastSignInTime,
  };
}
function assignableRoles(actorRole: UserRole): UserRole[] {
  return assignableRolesFor(actorRole);
}
const COURSE_ADMIN_ROLES = new Set<UserRole>([
  "department_admin",
  "college_admin",
  "university_admin",
  "admin",
  "superadmin",
  "root_owner",
]);
function canManageCourse(
  actor: {
    userId: string;
    role: UserRole;
  },
  course: CourseRecord,
) {
  return course.ownerId === actor.userId || COURSE_ADMIN_ROLES.has(actor.role);
}
function canReadCourse(
  actor: {
    userId: string;
    role: UserRole;
  },
  course: CourseRecord,
) {
  return canManageCourse(actor, course);
}
const PLATFORM_ADMIN_ROLES = new Set<UserRole>([
  "department_admin",
  "college_admin",
  "university_admin",
  "ai_governance_officer",
  "accreditation_officer",
  "national_admin",
  "finance_admin",
  "trust_safety_admin",
  "admin",
  "superadmin",
  "root_owner",
]);
const PLATFORM_FACULTY_ROLES = new Set<UserRole>([
  "teaching_assistant",
  "professor",
  "course_coordinator",
  ...PLATFORM_ADMIN_ROLES,
]);
const STUDENT_READ_RESOURCES = new Set<PlatformResourceKey>([
  "academicTerms",
  "semesterTemplates",
  "regionalAcademicStyles",
  "challenges",
  "marketplaceItems",
  "announcements",
  "gradingScales",
  "referenceLibrary",
  "minorUserPolicies",
  "privacyPolicies",
  "serviceIncidents",
]);
const FACULTY_WRITE_RESOURCES = new Set<PlatformResourceKey>([
  "templates",
  "templateVersions",
  "semesterTemplates",
  "referenceLibrary",
  "researchSources",
  "courseImports",
  "announcements",
  "gradingScales",
]);
const NATIONAL_ONLY_RESOURCES = new Set<PlatformResourceKey>([
  "nationalFrameworks",
  "institutionBenchmarks",
]);
const FINANCE_RESOURCES = new Set<PlatformResourceKey>([
  "subscriptions",
  "transactions",
  "contracts",
  "entitlements",
  "licenses",
  "seatAssignments",
  "fraudRules",
  "profitGuardrails",
  "salesLeads",
  "slaPolicies",
  "supportEntitlements",
  "currencySettings",
]);
const SECURITY_RESOURCES = new Set<PlatformResourceKey>([
  "securityReports",
  "securityAlerts",
  "securityEventsConfig",
  "userReports",
  "domainClaims",
  "institutionVerifications",
  "serviceIncidents",
]);
const ROOT_SENSITIVE_RESOURCES = new Set<PlatformResourceKey>([
  "systemConfig",
  "brandConfig",
  "backupRuns",
  "backupPolicies",
  "migrationRuns",
  "rolloverRuns",
  "apiKeys",
  "webhooks",
  "integrationConfigs",
  "lmsConfigs",
  "ssoConfigs",
  "emailConfigs",
  "externalTools",
  "retentionPolicies",
  "dataResidencyPolicies",
]);
const AI_GOVERNANCE_RESOURCES = new Set<PlatformResourceKey>([
  "aiModels",
  "aiPrompts",
  "aiEvaluations",
  "aiRoutingPolicies",
  "aiBudgets",
  "aiAuditSamples",
  "externalToolPolicies",
  "privacyPolicies",
  "retentionPolicies",
  "dataResidencyPolicies",
  "minorUserPolicies",
]);
const FULL_PLATFORM_ROLES = new Set<UserRole>([
  "department_admin",
  "college_admin",
  "university_admin",
  "admin",
  "superadmin",
  "root_owner",
]);
const NATIONAL_READ_RESOURCES = new Set<PlatformResourceKey>([
  "institutions",
  "programs",
  "academicTerms",
  "nationalFrameworks",
  "institutionBenchmarks",
  "curriculumMaps",
  "accreditationSnapshots",
  "outcomeSamples",
  "publicTrustIndicators",
  "serviceIncidents",
]);
const ACCREDITATION_RESOURCES = new Set<PlatformResourceKey>([
  "programs",
  "academicTerms",
  "templates",
  "templateVersions",
  "credentials",
  "credentialPolicies",
  "accreditationSnapshots",
  "outcomeSamples",
  "curriculumMaps",
  "nationalFrameworks",
  "institutionBenchmarks",
]);
const AI_GOVERNANCE_READ_RESOURCES = new Set<PlatformResourceKey>([
  ...AI_GOVERNANCE_RESOURCES,
  "integrationConfigs",
  "lmsConfigs",
  "ssoConfigs",
  "externalTools",
  "securityAlerts",
  "serviceIncidents",
]);
const FACULTY_READ_RESOURCES = new Set<PlatformResourceKey>([
  ...FACULTY_WRITE_RESOURCES,
  "academicTerms",
  "semesterTemplates",
  "regionalAcademicStyles",
  "challenges",
  "announcements",
  "researchSources",
  "knowledgeBase",
  "organizationKnowledge",
]);
function canReadPlatformResource(
  role: UserRole,
  resource: PlatformResourceKey,
) {
  if (FULL_PLATFORM_ROLES.has(role)) return true;
  if (role === "national_admin") return NATIONAL_READ_RESOURCES.has(resource);
  if (role === "finance_admin")
    return (
      FINANCE_RESOURCES.has(resource) ||
      ["currencySettings", "serviceIncidents"].includes(resource)
    );
  if (role === "trust_safety_admin")
    return (
      SECURITY_RESOURCES.has(resource) ||
      ["privacyPolicies", "minorUserPolicies", "serviceIncidents"].includes(
        resource,
      )
    );
  if (role === "ai_governance_officer")
    return AI_GOVERNANCE_READ_RESOURCES.has(resource);
  if (role === "accreditation_officer")
    return ACCREDITATION_RESOURCES.has(resource);
  if (["teaching_assistant", "professor", "course_coordinator"].includes(role))
    return FACULTY_READ_RESOURCES.has(resource);
  if (role === "employer")
    return [
      "challenges",
      "marketplaceItems",
      "publicTrustIndicators",
      "serviceIncidents",
    ].includes(resource);
  return STUDENT_READ_RESOURCES.has(resource);
}
function canWritePlatformResource(
  role: UserRole,
  resource: PlatformResourceKey,
) {
  if (role === "root_owner" || role === "superadmin" || role === "admin")
    return true;
  if (NATIONAL_ONLY_RESOURCES.has(resource))
    return role === "national_admin" || role === "university_admin";
  if (FINANCE_RESOURCES.has(resource))
    return role === "finance_admin" || role === "university_admin";
  if (SECURITY_RESOURCES.has(resource))
    return role === "trust_safety_admin" || role === "university_admin";
  if (AI_GOVERNANCE_RESOURCES.has(resource))
    return role === "ai_governance_officer" || role === "university_admin";
  if (ROOT_SENSITIVE_RESOURCES.has(resource))
    return role === "university_admin";
  if (role === "accreditation_officer")
    return ACCREDITATION_RESOURCES.has(resource);
  if (
    role === "department_admin" ||
    role === "college_admin" ||
    role === "university_admin"
  )
    return true;
  return (
    PLATFORM_FACULTY_ROLES.has(role) && FACULTY_WRITE_RESOURCES.has(resource)
  );
}
function parsePlatformResource(resource: string): PlatformResourceKey {
  if (!PLATFORM_RESOURCES.includes(resource as PlatformResourceKey))
    throw Object.assign(
      new Error(`Unsupported platform resource: ${resource}`),
      { status: 404, code: "RESOURCE_NOT_FOUND" },
    );
  return resource as PlatformResourceKey;
}
function requirePlatformRead(
  req: AuthenticatedRequest,
  res: Response,
  resource: string,
): PlatformResourceKey | null {
  const key = parsePlatformResource(resource);
  if (!req.actor || !canReadPlatformResource(req.actor.role, key)) {
    res.status(403).json({
      error: "Insufficient permission for this resource",
      code: "FORBIDDEN",
    });
    return null;
  }
  return key;
}
function requirePlatformWrite(
  req: AuthenticatedRequest,
  res: Response,
  resource: string,
): PlatformResourceKey | null {
  const key = parsePlatformResource(resource);
  if (!req.actor || !canWritePlatformResource(req.actor.role, key)) {
    res.status(403).json({
      error: "Insufficient permission to change this resource",
      code: "FORBIDDEN",
    });
    return null;
  }
  return key;
}
function canManagePlatformRecord(
  actor: {
    userId: string;
    role: UserRole;
  },
  record: {
    ownerId?: string;
  },
) {
  return FULL_PLATFORM_ROLES.has(actor.role) || record.ownerId === actor.userId;
}
function artifactImpact(
  source: WorkspaceArtifact,
  nextContent: string,
  artifacts: WorkspaceArtifact[],
) {
  const rubric = new Set(source.rubricIds || []);
  return artifacts
    .filter(
      (a) =>
        a.id !== source.id &&
        !a.deletedAt &&
        (Boolean(
          source.deliverableId && a.deliverableId === source.deliverableId,
        ) ||
          (a.rubricIds || []).some((id) => rubric.has(id))),
    )
    .map((a) => ({
      id: a.id,
      title: a.title,
      module: a.module,
      deliverableId: a.deliverableId,
      rubricIds: a.rubricIds || [],
      exactReplacePossible: Boolean(
        source.content && a.content.includes(source.content),
      ),
      occurrences: source.content
        ? Math.max(0, a.content.split(source.content).length - 1)
        : 0,
      nextPreview:
        source.content && a.content.includes(source.content)
          ? a.content.replaceAll(source.content, nextContent).slice(0, 500)
          : undefined,
    }));
}
const FACULTY_TASKS: Record<
  string,
  {
    agent: string;
    taskType: string;
    minLevel: number;
    instruction: string;
  }
> = {
  research: {
    agent: "Research Assistant",
    taskType: "research_review",
    minLevel: 2,
    instruction:
      "Review research questions, source needs, claim boundaries, and evidence gaps. Never invent citations or claim that a source was verified unless the supplied context proves it.",
  },
  writing: {
    agent: "Writing Coach",
    taskType: "writing_feedback",
    minLevel: 3,
    instruction:
      "Give feedback and revision guidance on the learner-authored material. Do not replace it with a final submission. Preserve the learner voice and identify unsupported claims.",
  },
  data: {
    agent: "Data Analyst",
    taskType: "data_review",
    minLevel: 3,
    instruction:
      "Review the recorded data workflow, transformations, interpretation, assumptions, and missing validation. Never invent observations or dataset values.",
  },
  spreadsheet: {
    agent: "Spreadsheet Analyst",
    taskType: "spreadsheet_review",
    minLevel: 3,
    instruction:
      "Review formulas, dependencies, units, validation, and error risks from the supplied material. Do not claim to have executed a workbook unless execution evidence is present.",
  },
  code: {
    agent: "Code Reviewer",
    taskType: "code_review",
    minLevel: 3,
    instruction:
      "Review architecture, correctness, tests, security, and documentation. Prefer a change plan or bounded snippets; do not silently generate or apply a whole solution.",
  },
  engineering: {
    agent: "Engineering Advisor",
    taskType: "engineering_review",
    minLevel: 3,
    instruction:
      "Review constraints, units, calculations, assumptions, alternatives, and verification needs. Do not certify safety or fabricate measured values.",
  },
  lab: {
    agent: "Lab Learning Coach",
    taskType: "lab_review",
    minLevel: 3,
    instruction:
      "Review procedure records, observations, calculations, uncertainty, and discussion. Never fabricate experiments, measurements, participants, or lab completion.",
  },
  design: {
    agent: "Design Advisor",
    taskType: "design_review",
    minLevel: 2,
    instruction:
      "Review the design problem, constraints, alternatives, rationale, critique questions, and validation plan. Keep decisions with the learner.",
  },
  media: {
    agent: "Media Advisor",
    taskType: "media_review",
    minLevel: 2,
    instruction:
      "Review narrative purpose, production plan, shot or scene logic, evidence and feasibility. Do not claim production work was completed.",
  },
  presentation: {
    agent: "Presentation Coach",
    taskType: "presentation_review",
    minLevel: 2,
    instruction:
      "Review the presentation story, evidence mapping, slide purpose, timing, and likely questions. Do not invent project facts.",
  },
  portfolio: {
    agent: "Portfolio Coach",
    taskType: "portfolio_review",
    minLevel: 2,
    instruction:
      "Review whether selected evidence demonstrates process, decisions, and skills without overstating verification or contribution.",
  },
  survey: {
    agent: "Research Methods Coach",
    taskType: "survey_review",
    minLevel: 3,
    instruction:
      "Review question wording, variables, sampling, coding, bias, privacy, and analysis readiness. Never fabricate participants or responses.",
  },
  simulation: {
    agent: "Simulation Advisor",
    taskType: "simulation_review",
    minLevel: 3,
    instruction:
      "Review assumptions, parameters, scenarios, validation, sensitivity, and interpretation. Do not claim a simulation was run without supplied execution evidence.",
  },
};
function facultyPolicyBlock(
  project: ProjectDNA,
  module: string,
  title: string,
  content: string,
) {
  if (!Object.hasOwn(FACULTY_TASKS, module))
    return "This workspace does not expose an AI Faculty action.";
  const task = FACULTY_TASKS[module];
  const policy = project.aiPolicy;
  if (policy.needsConfirmation || policy.provenance === "extracted_unverified")
    return "The assignment AI policy must be confirmed from the published course assignment before this action is available.";
  if (policy.level < task.minLevel)
    return `AI Policy Level ${policy.level} does not allow this review action; Level ${task.minLevel} or higher is required.`;
  const prohibited = (policy.prohibited || []).join(" ").toLowerCase();
  const sample = `${title} ${content}`.toLowerCase();
  if (
    /\b(ai not allowed|no ai|all ai|artificial intelligence prohibited)\b/.test(
      prohibited,
    )
  )
    return "The assignment AI policy prohibits this action.";
  if (
    module === "writing" &&
    /(reflection|reflective|انعكاس|تأمل)/i.test(`${prohibited} ${sample}`) &&
    /(reflection|reflective|انعكاس|تأمل)/i.test(prohibited)
  )
    return "The assignment policy prohibits AI assistance for reflection writing.";
  if (
    module === "code" &&
    /(code generation|generate code|برمجة|توليد الكود)/i.test(prohibited) &&
    project.aiPolicy.level < 4
  )
    return "The assignment policy does not allow AI code generation. Use manual work or a permitted review-only workflow.";
  return "";
}
function facultyProjectContext(project: ProjectDNA) {
  return {
    id: project.id,
    title: project.title,
    course: project.course,
    projectType: project.projectType,
    academicDomain: project.academicDomain,
    complexity: project.complexity,
    collaborationMode: project.collaborationMode,
    requiredActions: project.requiredActions,
    requiredSkills: project.requiredSkills,
    learningOutcomes: project.learningOutcomes,
    requirements: project.requirements.map((x) => ({
      label: x.label,
      value: x.value,
      category: x.category,
      confidence: x.confidence,
      source: x.source,
    })),
    deliverables: project.deliverables.map((x) => ({
      id: x.id,
      title: x.title,
      format: x.format,
      status: x.status,
      validationRules: x.validationRules,
    })),
    rubric: project.rubric.map((x) => ({
      id: x.id,
      title: x.title,
      description: x.description,
      weighting: x.weighting,
      readiness: x.readiness,
    })),
    tasks: project.tasks.map((x) => ({
      id: x.id,
      title: x.title,
      status: x.status,
      module: x.module,
      dueDate: x.dueDate,
    })),
    deadlines: project.deadlines,
    citationStyle: project.citationStyle,
    sourceRequirements: project.sourceRequirements,
    softwareRequirements: project.softwareRequirements,
    riskFlags: project.riskFlags,
    aiPolicy: project.aiPolicy,
  };
}
async function loadProjectIntelligence(
  actor: {
    userId: string;
    tenantId: string;
    displayName: string;
  },
  projectId: string,
) {
  const project = await firestoreStore.getProject(
    projectId,
    actor.userId,
    actor.tenantId,
  );
  if (!project) return null;
  const [artifacts, evidence, learning, skills, activity, versions, aiRuns] =
    await Promise.all([
      firestoreStore.listWorkspaceArtifacts(project.id, actor.tenantId),
      firestoreStore.listProjectEvidence(
        project.id,
        actor.userId,
        actor.tenantId,
      ),
      firestoreStore.listLearningEvidence(
        project.id,
        actor.userId,
        actor.tenantId,
      ),
      buildSkills(actor.userId, actor.tenantId),
      firestoreStore.listProjectActivity(project.id, actor.tenantId),
      firestoreStore.listProjectVersions(
        project.id,
        project.userId,
        actor.tenantId,
      ),
      firestoreStore.listProjectAIRuns(project.id, actor.tenantId),
    ]);
  return {
    project,
    artifacts,
    evidence,
    learning,
    skills,
    activity,
    versions,
    aiRuns,
  };
}

async function persistProjectDocument(
  actor: { userId: string; tenantId: string },
  project: ProjectDNA,
  document: ProjectDocument,
) {
  const now = new Date().toISOString();
  const persistedSections = [] as ProjectDocument["sections"];
  for (const section of document.sections) {
    const artifact: WorkspaceArtifact = {
      id: randomUUID(),
      projectId: project.id,
      tenantId: actor.tenantId,
      createdBy: actor.userId,
      updatedBy: actor.userId,
      module: "writing",
      kind: "academic-document-section",
      title: section.title,
      content: section.content,
      status: section.status === "verified" ? "ready" : "in_progress",
      rubricIds: section.rubricIds,
      isCanonical: true,
      createdAt: now,
      updatedAt: now,
    };
    const persisted = await firestoreStore.saveWorkspaceArtifact(
      artifact,
      actor.userId,
    );
    persistedSections.push({ ...section, artifactId: persisted.id });
  }
  const persistedDocument: ProjectDocument = {
    ...document,
    sections: persistedSections,
    updatedAt: now,
  };
  const compactManifest = {
    ...persistedDocument,
    sections: persistedSections.map(({ content: _content, ...section }) =>
      section,
    ),
  };
  await firestoreStore.saveWorkspaceArtifact(
    {
      id: randomUUID(),
      projectId: project.id,
      tenantId: actor.tenantId,
      createdBy: actor.userId,
      updatedBy: actor.userId,
      module: "writing",
      kind: "academic-document-manifest",
      title: `AcademicOS Project Document · ${document.variation.id}`,
      content: JSON.stringify(compactManifest),
      status: "in_progress",
      isCanonical: false,
      createdAt: now,
      updatedAt: now,
    },
    actor.userId,
  );
  return persistedDocument;
}

async function loadLatestProjectDocument(
  projectId: string,
  tenantId: string,
): Promise<ProjectDocument | null> {
  const artifacts = await firestoreStore.listWorkspaceArtifacts(
    projectId,
    tenantId,
  );
  const manifest = artifacts
    .filter((artifact) => artifact.kind === "academic-document-manifest")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!manifest) return null;
  try {
    const parsed = JSON.parse(manifest.content) as ProjectDocument;
    const byId = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
    return {
      ...parsed,
      sections: parsed.sections.map((section) => ({
        ...section,
        content: section.artifactId
          ? byId.get(section.artifactId)?.content || ""
          : section.content || "",
      })),
    };
  } catch {
    return null;
  }
}
async function startServer() {
  initFirebase();
  const app = express();
  app.disable("x-powered-by");
  // خلف موازِن حمل/بروكسي (Cloud Run, GCLB, nginx) يجب الثقة بسلسلة X-Forwarded-For
  // ليعمل تحديد المعدّل لكل عميل فعليًا بدل انهيار كل الحركة في دلو واحد.
  // TRUST_PROXY: عدد قفزات البروكسي الموثوقة (مثال "1")، أو "true"/"false".
  {
    const tp = String(process.env.TRUST_PROXY || "").trim();
    if (tp) app.set("trust proxy", /^\d+$/.test(tp) ? Number(tp) : tp === "true");
  }
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-AcademicOS-API-Version", "1");
    if (process.env.NODE_ENV === "production" && !process.env.ALLOW_IFRAME) {
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
    }
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(self), microphone=(self), geolocation=()",
    );
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    const devScript =
      process.env.NODE_ENV === "production"
        ? "'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://www.recaptcha.net"
        : "'self' 'unsafe-inline' 'unsafe-eval'";
    const configuredEmulator = String(
        process.env.VITE_FIREBASE_AUTH_EMULATOR_URL || "",
      ),
      devConnect =
        process.env.NODE_ENV !== "production" &&
        /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(configuredEmulator)
          ? ` ${new URL(configuredEmulator).origin}`
          : "";
    const csp = `default-src 'self' data: blob:; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src ${devScript}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self'${devConnect} https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://www.google.com https://www.gstatic.com https://www.recaptcha.net; frame-src 'self' https://www.google.com https://recaptcha.google.com https://www.recaptcha.net; worker-src 'self' blob:; manifest-src 'self'`;
    res.setHeader(
      "Content-Security-Policy",
      `${csp}${process.env.NODE_ENV === "production" ? "; upgrade-insecure-requests" : ""}`,
    );
    if (process.env.NODE_ENV === "production")
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload",
      );
    next();
  });

  app.get("/env-config.js", (_req, res) => {
    res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    const envData = {
      VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY || "",
      VITE_FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN || "",
      VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID || "",
      VITE_FIREBASE_STORAGE_BUCKET: process.env.VITE_FIREBASE_STORAGE_BUCKET || "",
      VITE_FIREBASE_MESSAGING_SENDER_ID: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
      VITE_FIREBASE_APP_ID: process.env.VITE_FIREBASE_APP_ID || "",
      VITE_FIREBASE_APPCHECK_SITE_KEY: process.env.VITE_FIREBASE_APPCHECK_SITE_KEY || "",
    };
    res.send(`window.__ENV__ = ${JSON.stringify(envData, null, 2)};`);
  });
  app.post(
    "/api/billing/webhook/stripe",
    apiRateLimit,
    express.raw({ type: "application/json", limit: "2mb" }),
    async (req, res) => {
      let webhookClaimId: string | undefined;
      try {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret)
          return res.status(503).json({
            error: "Stripe webhook is not configured",
            code: "STRIPE_WEBHOOK_NOT_CONFIGURED",
          });
        const signature = String(req.header("stripe-signature") || "");
        const fields = signature
          .split(",")
          .map((part) => part.trim().split("=", 2));
        const timestamp = Number(fields.find(([key]) => key === "t")?.[1] || 0),
          provided = fields
            .filter(([key]) => key === "v1")
            .map(([, value]) => String(value || ""));
        if (
          !timestamp ||
          !provided.length ||
          Math.abs(Date.now() / 1000 - timestamp) > 300
        )
          return res.status(401).json({
            error: "Invalid Stripe signature timestamp",
            code: "STRIPE_SIGNATURE_INVALID",
          });
        const raw = Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(req.body || "");
        const expected = createHmac("sha256", secret)
          .update(`${timestamp}.${raw.toString("utf8")}`)
          .digest("hex");
        const signatureValid = provided.some((value) => {
          const a = Buffer.from(expected),
            b = Buffer.from(value);
          return a.length === b.length && timingSafeEqual(a, b);
        });
        if (!signatureValid)
          return res.status(401).json({
            error: "Invalid Stripe signature",
            code: "STRIPE_SIGNATURE_INVALID",
          });
        const event = JSON.parse(raw.toString("utf8"));
        const eventId = cleanField(event?.id, 240);
        if (!eventId)
          return res.status(400).json({
            error: "Stripe event id is required",
            code: "STRIPE_EVENT_ID_REQUIRED",
          });
        const object = event?.data?.object || {};
        const type = String(event.type || "unknown");
        let stripeMetadata =
          object?.metadata || object?.subscription_details?.metadata || {};
        const paymentIntentId = String(
          typeof object?.payment_intent === "string"
            ? object.payment_intent
            : object?.payment_intent?.id || "",
        );
        if (
          !stripeMetadata?.tenantId &&
          /^pi_[A-Za-z0-9_]+$/.test(paymentIntentId) &&
          process.env.STRIPE_SECRET_KEY
        ) {
          const lookup = await fetch(
            `https://api.stripe.com/v1/payment_intents/${paymentIntentId}`,
            {
              headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
              signal: AbortSignal.timeout(10_000),
            },
          );
          if (lookup.ok) {
            const paymentIntent: any = await lookup.json();
            stripeMetadata = paymentIntent?.metadata || stripeMetadata;
          }
        }
        const tenantId = String(
          stripeMetadata?.tenantId || "",
        );
        const userId = String(stripeMetadata?.userId || "");
        const projectId = String(stripeMetadata?.projectId || "");
        const planId = String(stripeMetadata?.planId || "");
        if (!tenantId)
          return res.status(202).json({ received: true, ignored: true });
        const claim = await platformStore.claimExternalWebhook(
          "stripe",
          eventId,
        );
        webhookClaimId = claim.id;
        if (!claim.claimed)
          return res.json({ received: true, duplicate: true });
        const at = new Date().toISOString();
        if (type.startsWith("customer.subscription.")) {
          const rawStatus = String(object.status || "incomplete");
          const status =
            rawStatus === "canceled"
              ? "cancelled"
              : [
                    "trialing",
                    "active",
                    "past_due",
                    "unpaid",
                    "paused",
                    "incomplete",
                    "incomplete_expired",
                  ].includes(rawStatus)
                ? rawStatus
                : "expired";
          await platformStore.create(
            "subscriptions",
            tenantId,
            "stripe",
            {
              title: `Stripe subscription ${object.id || event.id}`,
              status,
              data: {
                stripeEventId: event.id,
                provider: "stripe",
                externalId: object.id || null,
                userId: userId || null,
                customerId: object.customer || null,
                currentPeriodEnd: object.current_period_end
                  ? new Date(
                      Number(object.current_period_end) * 1000,
                    ).toISOString()
                  : null,
                cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
                receivedAt: at,
              },
            },
            `Stripe webhook ${type}`,
          );
          if (["active", "trialing"].includes(status))
            await platformStore.recordEvent({
              tenantId,
              userId: userId || "stripe",
              name: "subscription_started",
              properties: { provider: "stripe" },
              provenance: "server",
            });
        } else {
          let status = "pending";
          if (["checkout.session.completed", "invoice.paid"].includes(type))
            status = "paid";
          else if (type.includes("payment_failed")) status = "failed";
          else if (type.includes("refunded")) status = "refunded";
          else if (type.includes("dispute")) status = "chargeback";
          await platformStore.create(
            "transactions",
            tenantId,
            "stripe",
            {
              title: `Stripe ${type}`,
              status,
              data: {
                stripeEventId: event.id,
                provider: "stripe",
                externalId: object.id || null,
                userId: userId || null,
                amount: Number(
                  object.amount_total ||
                    object.amount_paid ||
                    object.amount ||
                    0,
                ),
                currency: String(object.currency || "").toUpperCase(),
                planId: planId || null,
                projectId: projectId || null,
                receivedAt: at,
              },
            },
            `Stripe webhook ${type}`,
          );
          if (type === "checkout.session.completed") {
            if (!userId || !projectId || !isPaidProjectPlan(planId))
              throw Object.assign(new Error("Paid project metadata is incomplete"), {
                status: 400,
                code: "PAYMENT_METADATA_INVALID",
              });
            await platformStore.grantProjectEntitlement({
              tenantId,
              userId,
              projectId,
              planId,
              provider: "stripe",
              externalId: String(object.id || paymentIntentId),
              eventId,
              externalRefs: [paymentIntentId],
            });
            await platformStore.recordEvent({
              tenantId,
              userId: userId || "stripe",
              name: "project_plan_purchased",
              projectId,
              properties: { provider: "stripe", planId },
              provenance: "server",
            });
          } else if (status === "refunded" || status === "chargeback") {
            if (userId && projectId)
              await platformStore.revokeProjectEntitlement({
                tenantId,
                userId,
                projectId,
                provider: "stripe",
                externalId: String(paymentIntentId || object.id),
                eventId,
                reason: status,
              });
          }
        }
        await platformStore.completeExternalWebhook(
          webhookClaimId,
          "completed",
        );
        res.json({ received: true });
      } catch (error) {
        if (webhookClaimId)
          await platformStore
            .completeExternalWebhook(
              webhookClaimId,
              "failed",
              error instanceof Error ? error.message : "Webhook failed",
            )
            .catch(() => undefined);
        console.error("Stripe webhook failed", error);
        res.status(400).json({
          error: "Webhook payload could not be processed",
          code: "STRIPE_WEBHOOK_INVALID",
        });
      }
    },
  );
  app.post(
    "/api/billing/webhook/tap",
    apiRateLimit,
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      try {
        const raw = Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(req.body || "");
        const event = verifyTapWebhook(
          raw,
          String(req.header("hashstring") || ""),
        );
        const result = await persistVerifiedPayment(event);
        res.json({ received: true, ...result });
      } catch (error: any) {
        res.status(Number(error?.status || 400)).json({
          error: "Tap webhook could not be verified",
          code: error?.code || "TAP_WEBHOOK_INVALID",
        });
      }
    },
  );
  app.post(
    "/api/billing/webhook/myfatoorah",
    apiRateLimit,
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      try {
        const raw = Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(req.body || "");
        const event = verifyMyFatoorahWebhook(
          raw,
          String(req.header("myfatoorah-signature") || ""),
        );
        const result = await persistVerifiedPayment(event);
        res.json({ received: true, ...result });
      } catch (error: any) {
        res.status(Number(error?.status || 400)).json({
          error: "MyFatoorah webhook could not be verified",
          code: error?.code || "MYFATOORAH_WEBHOOK_INVALID",
        });
      }
    },
  );
  app.post(
    "/api/billing/webhook/lemonsqueezy",
    apiRateLimit,
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      try {
        const raw = Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(req.body || "");
        const event = verifyLemonSqueezyWebhook(
          raw,
          String(req.header("x-signature") || ""),
        );
        const result = await persistVerifiedPayment(event);
        res.json({ received: true, ...result });
      } catch (error: any) {
        res.status(Number(error?.status || 400)).json({
          error: "Lemon Squeezy webhook could not be verified",
          code: error?.code || "LEMONSQUEEZY_WEBHOOK_INVALID",
        });
      }
    },
  );
  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS ||
    process.env.APP_URL ||
    ""
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: allowedOrigins.length
        ? allowedOrigins
        : process.env.NODE_ENV === "production"
          ? false
          : true,
      credentials: true,
    }),
  );
  app.use("/api", apiRateLimit);
  app.use("/api", verifyAppCheck);
  app.use("/api", maintenanceGate);
  const defaultJson = express.json({ limit: "2mb" });
  const assignmentJson = express.json({
    limit: `${Math.ceil((MAX_TOTAL_FILE_BYTES * 1.45) / 1024 / 1024) + 3}mb`,
  });
  app.use((req, res, next) =>
    req.path === "/api/projects/compile"
      ? assignmentJson(req, res, next)
      : defaultJson(req, res, next),
  );
  app.get("/api/health", (_req, res) =>
    res.json({
      status: "ok",
      mode: "production",
      firebase: firebaseInitialized,
      aiConfigured: aiConfigured(),
      storageConfigured: Boolean(process.env.FIREBASE_STORAGE_BUCKET),
      billing: billingStatus(),
      ocr: ocrStatus(),
      malware: {
        configured: externalServices.virusScan.configured(),
        required: process.env.REQUIRE_VIRUS_SCAN === "true",
      },
      notifications: {
        email: Boolean(
          process.env.EMAIL_DELIVERY_ENDPOINT && process.env.EMAIL_API_KEY,
        ),
        push: Boolean(process.env.PUSH_PROVIDER && process.env.PUSH_API_KEY),
        sms: Boolean(process.env.SMS_PROVIDER && process.env.SMS_API_KEY),
      },
      backup: { configured: externalServices.backup.configured() },
      aiProviders: aiProviderStatus(),
      dataRegion: process.env.DATA_REGION || "global",
      maintenance: process.env.MAINTENANCE_MODE === "true",
      incidentBanner: process.env.INCIDENT_BANNER || "",
    }),
  );
  app.get("/api/public/config", (_req, res) => {
    const email = cleanField(process.env.SECURITY_CONTACT_EMAIL, 240);
    const disclosure = cleanField(process.env.RESPONSIBLE_DISCLOSURE_URL, 500);
    res.json({
      securityContactEmail: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
        ? email
        : null,
      responsibleDisclosure: disclosure.startsWith("https://")
        ? disclosure
        : null,
      statusPath: "/status",
    });
  });
  app.get(
    "/api/branding",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const record = (
          await platformStore.list("brandConfig", req.actor!.tenantId, {
            limit: 20,
          })
        ).find((x) => x.status === "active" && !x.deletedAt);
        if (!record) return res.json({ success: true, branding: {} });
        const hex = (v: unknown) => {
          const x = cleanField(v, 24);
          return /^#[0-9A-Fa-f]{6}$/.test(x) ? x : undefined;
        };
        const logo = cleanField(record.data?.logoUrl, 600);
        const supportEmail = cleanField(record.data?.supportEmail, 240);
        res.json({
          success: true,
          branding: {
            institutionName:
              cleanField(record.data?.institutionName || record.title, 160) ||
              undefined,
            logoUrl: logo.startsWith("https://") ? logo : undefined,
            primaryColor: hex(record.data?.primaryColor),
            accentColor: hex(record.data?.accentColor),
            footer: cleanField(record.data?.footer, 500) || undefined,
            supportEmail: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(supportEmail)
              ? supportEmail
              : undefined,
          },
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/integrations/status",
    authenticate,
    async (_req: AuthenticatedRequest, res) => {
      const specs: Array<
        Omit<IntegrationStatusRecord, "configured"> & {
          env: string[];
        }
      > = [
        {
          key: "google-drive",
          name: "Google Drive",
          category: "productivity",
          mode: "tenant_oauth",
          description: "استيراد ملفات وتكليفات من Drive.",
          setupKeys: ["GOOGLE_DRIVE_CLIENT_ID", "GOOGLE_DRIVE_CLIENT_SECRET"],
          env: ["GOOGLE_DRIVE_CLIENT_ID", "GOOGLE_DRIVE_CLIENT_SECRET"],
        },
        {
          key: "onedrive",
          name: "OneDrive / Microsoft 365",
          category: "productivity",
          mode: "tenant_oauth",
          description: "استيراد ملفات Microsoft 365.",
          setupKeys: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
          env: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
        },
        {
          key: "canvas",
          name: "Canvas LMS",
          category: "lms",
          mode: "contract",
          description: "Course/Assignment/Rubric sync عبر Connector layer.",
          setupKeys: ["CANVAS_BASE_URL", "CANVAS_ACCESS_TOKEN"],
          env: ["CANVAS_BASE_URL", "CANVAS_ACCESS_TOKEN"],
        },
        {
          key: "moodle",
          name: "Moodle",
          category: "lms",
          mode: "contract",
          description: "تهيئة مزود Moodle على الخادم قبل المزامنة.",
          setupKeys: ["MOODLE_BASE_URL", "MOODLE_TOKEN"],
          env: ["MOODLE_BASE_URL", "MOODLE_TOKEN"],
        },
        {
          key: "blackboard",
          name: "Blackboard",
          category: "lms",
          mode: "contract",
          description:
            "Blackboard integration adapter requires institutional credentials.",
          setupKeys: [
            "BLACKBOARD_BASE_URL",
            "BLACKBOARD_CLIENT_ID",
            "BLACKBOARD_CLIENT_SECRET",
          ],
          env: [
            "BLACKBOARD_BASE_URL",
            "BLACKBOARD_CLIENT_ID",
            "BLACKBOARD_CLIENT_SECRET",
          ],
        },
        {
          key: "brightspace",
          name: "D2L / Brightspace",
          category: "lms",
          mode: "contract",
          description:
            "Brightspace connector for courses, enrollments, assignments and rubrics.",
          setupKeys: [
            "BRIGHTSPACE_BASE_URL",
            "BRIGHTSPACE_CLIENT_ID",
            "BRIGHTSPACE_CLIENT_SECRET",
          ],
          env: [
            "BRIGHTSPACE_BASE_URL",
            "BRIGHTSPACE_CLIENT_ID",
            "BRIGHTSPACE_CLIENT_SECRET",
          ],
        },
        {
          key: "github",
          name: "GitHub",
          category: "code",
          mode: "tenant_oauth",
          description:
            "Repository workflow for Code Lab / contribution evidence.",
          setupKeys: ["GITHUB_APP_ID", "GITHUB_PRIVATE_KEY"],
          env: ["GITHUB_APP_ID", "GITHUB_PRIVATE_KEY"],
        },
        {
          key: "google-calendar",
          name: "Google Calendar",
          category: "calendar",
          mode: "tenant_oauth",
          description: "Deadline and session calendar sync.",
          setupKeys: [
            "GOOGLE_CALENDAR_CLIENT_ID",
            "GOOGLE_CALENDAR_CLIENT_SECRET",
          ],
          env: ["GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_SECRET"],
        },
        {
          key: "email",
          name: "Transactional Email",
          category: "communications",
          mode: "server",
          description: "Invitation, notification and support email delivery.",
          setupKeys: [
            "EMAIL_PROVIDER",
            "EMAIL_DELIVERY_ENDPOINT",
            "EMAIL_API_KEY",
          ],
          env: ["EMAIL_PROVIDER", "EMAIL_DELIVERY_ENDPOINT", "EMAIL_API_KEY"],
        },
        {
          key: "push",
          name: "Push Notifications",
          category: "communications",
          mode: "server",
          description:
            "Push delivery adapter. In-app notifications work without it.",
          setupKeys: ["PUSH_PROVIDER", "PUSH_API_KEY"],
          env: ["PUSH_PROVIDER", "PUSH_API_KEY"],
        },
        {
          key: "sms",
          name: "SMS",
          category: "communications",
          mode: "server",
          description:
            "Optional SMS delivery for explicitly enabled notification policies.",
          setupKeys: ["SMS_PROVIDER", "SMS_API_KEY"],
          env: ["SMS_PROVIDER", "SMS_API_KEY"],
        },
        {
          key: "sso",
          name: "University SSO (SAML/OIDC)",
          category: "identity",
          mode: "contract",
          description:
            "Institution-specific SSO configuration; not auto-connected.",
          setupKeys: ["SSO_ISSUER", "SSO_CLIENT_ID", "SSO_CLIENT_SECRET"],
          env: ["SSO_ISSUER", "SSO_CLIENT_ID", "SSO_CLIENT_SECRET"],
        },
        {
          key: "paci-mobile-id",
          name: "Regional Digital Identity Adapter",
          category: "identity",
          mode: "contract",
          description:
            "Optional country-specific digital identity adapter. It appears only when its regional credentials are provisioned.",
          setupKeys: [
            "PACI_IDENTITY_BASE_URL",
            "PACI_CLIENT_ID",
            "PACI_CLIENT_SECRET",
            "PACI_CALLBACK_SECRET",
          ],
          env: [
            "PACI_IDENTITY_BASE_URL",
            "PACI_CLIENT_ID",
            "PACI_CLIENT_SECRET",
            "PACI_CALLBACK_SECRET",
          ],
        },
        {
          key: "stripe",
          name: "Stripe",
          category: "billing",
          mode: "server",
          description: "Optional checkout provider behind Billing abstraction.",
          setupKeys: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
          env: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
        },
        {
          key: "tap-payments",
          name: "Tap Payments",
          category: "billing",
          mode: "server",
          description:
            "Optional hosted regional payment adapter with configurable local currency and payment methods.",
          setupKeys: [
            "TAP_SECRET_KEY",
            "TAP_MERCHANT_ID",
          ],
          env: [
            "TAP_SECRET_KEY",
            "TAP_MERCHANT_ID",
          ],
        },
        {
          key: "myfatoorah",
          name: "MyFatoorah",
          category: "billing",
          mode: "server",
          description:
            "Execute Payment وWebhook موثّق جاهزان بعد بيانات التاجر.",
          setupKeys: [
            "MYFATOORAH_API_TOKEN",
            "MYFATOORAH_PAYMENT_METHOD_ID",
            "MYFATOORAH_WEBHOOK_SECRET",
          ],
          env: [
            "MYFATOORAH_API_TOKEN",
            "MYFATOORAH_PAYMENT_METHOD_ID",
            "MYFATOORAH_WEBHOOK_SECRET",
          ],
        },
        {
          key: "gemini",
          name: "Gemini",
          category: "ai",
          mode: "server",
          description:
            "Primary AI adapter in the current Google-oriented deployment.",
          setupKeys: ["GEMINI_API_KEY", "GEMINI_MODEL"],
          env: ["GEMINI_API_KEY", "GEMINI_MODEL"],
        },
        {
          key: "openai",
          name: "OpenAI Provider Gateway",
          category: "ai",
          mode: "server",
          description:
            "Normalized OpenAI adapter gateway; business logic remains provider-neutral.",
          setupKeys: [
            "OPENAI_GATEWAY_URL",
            "OPENAI_GATEWAY_TOKEN",
            "OPENAI_MODEL",
          ],
          env: ["OPENAI_GATEWAY_URL", "OPENAI_GATEWAY_TOKEN", "OPENAI_MODEL"],
        },
        {
          key: "anthropic",
          name: "Anthropic Provider Gateway",
          category: "ai",
          mode: "server",
          description:
            "Normalized Anthropic adapter gateway with the same AcademicOS structured-output contract.",
          setupKeys: [
            "ANTHROPIC_GATEWAY_URL",
            "ANTHROPIC_GATEWAY_TOKEN",
            "ANTHROPIC_MODEL",
          ],
          env: [
            "ANTHROPIC_GATEWAY_URL",
            "ANTHROPIC_GATEWAY_TOKEN",
            "ANTHROPIC_MODEL",
          ],
        },
        {
          key: "local-ai",
          name: "Local / Private AI Gateway",
          category: "ai",
          mode: "server",
          description:
            "Private or sovereign model gateway; HTTPS and tenant policy remain mandatory.",
          setupKeys: [
            "LOCAL_AI_GATEWAY_URL",
            "LOCAL_AI_GATEWAY_TOKEN",
            "LOCAL_AI_MODEL",
          ],
          env: [
            "LOCAL_AI_GATEWAY_URL",
            "LOCAL_AI_GATEWAY_TOKEN",
            "LOCAL_AI_MODEL",
          ],
        },
        {
          key: "institution-ai",
          name: "Institution AI Gateway",
          category: "ai",
          mode: "contract",
          description:
            "Institution-managed model endpoint for dedicated/private deployments.",
          setupKeys: [
            "INSTITUTION_AI_GATEWAY_URL",
            "INSTITUTION_AI_GATEWAY_TOKEN",
            "INSTITUTION_AI_MODEL",
          ],
          env: [
            "INSTITUTION_AI_GATEWAY_URL",
            "INSTITUTION_AI_GATEWAY_TOKEN",
            "INSTITUTION_AI_MODEL",
          ],
        },
        {
          key: "pdf-renderer",
          name: "Isolated PDF Renderer",
          category: "documents",
          mode: "server",
          description:
            "Production PDF rendering service; required for Arabic/font-correct PDF output.",
          setupKeys: ["PDF_RENDER_SERVICE_URL", "PDF_RENDER_SERVICE_TOKEN"],
          env: ["PDF_RENDER_SERVICE_URL", "PDF_RENDER_SERVICE_TOKEN"],
        },
        {
          key: "backup-worker",
          name: "Backup / Restore Worker",
          category: "operations",
          mode: "server",
          description:
            "Dedicated backup/restore execution service. Requests remain disabled until configured.",
          setupKeys: ["BACKUP_WORKER_URL", "BACKUP_WORKER_TOKEN"],
          env: ["BACKUP_WORKER_URL", "BACKUP_WORKER_TOKEN"],
        },
        {
          key: "code-sandbox",
          name: "Code Execution Sandbox",
          category: "code",
          mode: "server",
          description:
            "Isolated runner for user code; never executes on the application backend.",
          setupKeys: ["CODE_SANDBOX_URL", "CODE_SANDBOX_TOKEN"],
          env: ["CODE_SANDBOX_URL", "CODE_SANDBOX_TOKEN"],
        },
        {
          key: "semantic-search",
          name: "Semantic Index / RAG",
          category: "search",
          mode: "server",
          description:
            "Tenant-scoped semantic indexing and retrieval provider.",
          setupKeys: ["SEMANTIC_INDEX_URL", "SEMANTIC_INDEX_TOKEN"],
          env: ["SEMANTIC_INDEX_URL", "SEMANTIC_INDEX_TOKEN"],
        },
        {
          key: "translation",
          name: "Translation Service",
          category: "ai",
          mode: "server",
          description:
            "Optional controlled translation adapter with locale-aware citations.",
          setupKeys: ["TRANSLATION_SERVICE_URL", "TRANSLATION_SERVICE_TOKEN"],
          env: ["TRANSLATION_SERVICE_URL", "TRANSLATION_SERVICE_TOKEN"],
        },
        {
          key: "speech",
          name: "Speech / Voice Viva",
          category: "speech",
          mode: "server",
          description:
            "Optional speech recognition/synthesis adapter for Voice Viva and rehearsal.",
          setupKeys: ["SPEECH_PROVIDER", "SPEECH_API_KEY"],
          env: ["SPEECH_PROVIDER", "SPEECH_API_KEY"],
        },
        {
          key: "ocr",
          name: "Document OCR Ensemble",
          category: "documents",
          mode: "server",
          description:
            "Arabic/English OCR with confidence, layout and optional secondary-provider agreement gates.",
          setupKeys: [
            "OCR_PRIMARY_URL",
            "OCR_PRIMARY_TOKEN",
            "OCR_ALLOWED_HOSTS",
          ],
          env: ["OCR_PRIMARY_URL", "OCR_PRIMARY_TOKEN", "OCR_ALLOWED_HOSTS"],
        },
        {
          key: "crm",
          name: "Institutional Sales CRM",
          category: "crm",
          mode: "server",
          description:
            "Optional CRM hook for institutional sales leads and contracts.",
          setupKeys: ["CRM_WEBHOOK_URL", "CRM_WEBHOOK_TOKEN"],
          env: ["CRM_WEBHOOK_URL", "CRM_WEBHOOK_TOKEN"],
        },
        {
          key: "virus-scan",
          name: "Isolated Malware Scanner",
          category: "operations",
          mode: "server",
          description:
            "Scans uploaded files before academic processing when configured; production can require it.",
          setupKeys: ["VIRUS_SCAN_URL", "VIRUS_SCAN_TOKEN"],
          env: ["VIRUS_SCAN_URL", "VIRUS_SCAN_TOKEN"],
        },
      ];
      const integrations: IntegrationStatusRecord[] = specs
        .filter((spec) => spec.key !== "paci-mobile-id" || spec.env.some((k) => Boolean(process.env[k])))
        .map(({ env, ...x }) => ({
          ...x,
          configured: env.every((k) => Boolean(process.env[k])),
        }));
      res.json({ success: true, integrations });
    },
  );
  app.get(
    "/api/feature-flags",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const stored = await firestoreStore.listFeatureFlags(a.tenantId);
        const map = new Map(stored.map((f) => [f.key, f]));
        const flags = FEATURE_DEFAULTS.map(
          (base) =>
            map.get(base.key) ||
            ({
              key: base.key,
              tenantId: a.tenantId,
              enabled: base.enabled,
              description: base.description,
              updatedAt: "",
              updatedBy: "system",
            } satisfies FeatureFlagRecord),
        );
        res.json({ success: true, flags });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/feature-flags/:key",
    authenticate,
    requireRoles(...FEATURE_ADMIN_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          base = FEATURE_DEFAULTS.find((f) => f.key === req.params.key);
        if (!base)
          return res
            .status(404)
            .json({ error: "Unknown feature flag", code: "FLAG_NOT_FOUND" });
        const flag: FeatureFlagRecord = {
          key: base.key,
          tenantId: a.tenantId,
          enabled: Boolean(req.body?.enabled),
          description: base.description,
          updatedAt: new Date().toISOString(),
          updatedBy: a.userId,
        };
        await firestoreStore.saveFeatureFlag(flag, a.userId);
        res.json({ success: true, flag });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/platform/resources",
    authenticate,
    (req: AuthenticatedRequest, res) => {
      const role = req.actor!.role;
      res.json({
        success: true,
        resources: PLATFORM_RESOURCES.filter((r) =>
          canReadPlatformResource(role, r),
        ).map((key) => {
          const capability = platformCapability(key);
          return {
            key,
            read: true,
            write: canWritePlatformResource(role, key),
            category: capability?.category || "governance",
            label: capability?.label || key,
            description: capability?.description || "",
            statusValues: capability?.statusValues || ["active", "inactive"],
            suggestedFields: capability?.suggestedFields || [],
            external: Boolean(capability?.external),
            sensitive: Boolean(capability?.sensitive),
          };
        }),
      });
    },
  );
  app.get(
    "/api/platform/:resource",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const resource = requirePlatformRead(
          req,
          res,
          String(req.params.resource),
        );
        if (!resource) return;
        const records = await platformStore.list(
          resource,
          req.actor!.tenantId,
          {
            includeDeleted: req.query.deleted === "1",
            status: cleanField(req.query.status, 80) || undefined,
            limit: Number(req.query.limit || 100),
          },
        );
        res.json({ success: true, records });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/platform/:resource",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const resource = requirePlatformWrite(
          req,
          res,
          String(req.params.resource),
        );
        if (!resource) return;
        const a = req.actor!;
        const title = cleanField(req.body?.title, 240);
        if (!title)
          return res
            .status(400)
            .json({ error: "Title is required", code: "TITLE_REQUIRED" });
        const capability = platformCapability(resource);
        const reason = cleanField(req.body?.reason, 500) || undefined;
        if (capability?.sensitive && !reason)
          return res.status(400).json({
            error: "Reason is required for sensitive configuration changes",
            code: "REASON_REQUIRED",
          });
        const data = sanitizePlatformData(req.body?.data);
        const status =
          cleanField(req.body?.status, 80) ||
          capability?.statusValues[0] ||
          "active";
        validatePlatformRecord(resource, status, data);
        const requestedOwner = cleanField(req.body?.ownerId, 160);
        const ownerId = FULL_PLATFORM_ROLES.has(a.role)
          ? requestedOwner || a.userId
          : a.userId;
        const record = await platformStore.create(
          resource,
          a.tenantId,
          a.userId,
          { title, status, data, ownerId },
          reason,
        );
        res.status(201).json({ success: true, record });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/platform/:resource/:id",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const resource = requirePlatformWrite(
          req,
          res,
          String(req.params.resource),
        );
        if (!resource) return;
        const a = req.actor!;
        const capability = platformCapability(resource);
        const reason = cleanField(req.body?.reason, 500) || undefined;
        if (capability?.sensitive && !reason)
          return res.status(400).json({
            error: "Reason is required for sensitive configuration changes",
            code: "REASON_REQUIRED",
          });
        const data =
          req.body?.data !== undefined
            ? sanitizePlatformData(req.body.data)
            : undefined;
        const current = await platformStore.get(
          resource,
          String(req.params.id),
          a.tenantId,
        );
        if (!current || !canManagePlatformRecord(a, current))
          return res
            .status(404)
            .json({ error: "Record not found", code: "NOT_FOUND" });
        const status =
          req.body?.status !== undefined
            ? cleanField(req.body.status, 80)
            : current.status;
        validatePlatformRecord(
          resource,
          status,
          data ? { ...current.data, ...data } : current.data,
        );
        const record = await platformStore.update(
          resource,
          String(req.params.id),
          a.tenantId,
          a.userId,
          {
            title:
              req.body?.title !== undefined
                ? cleanField(req.body.title, 240)
                : undefined,
            status: req.body?.status !== undefined ? status : undefined,
            data,
          },
          reason,
        );
        res.json({ success: true, record });
      } catch (e) {
        next(e);
      }
    },
  );
  app.delete(
    "/api/platform/:resource/:id",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const resource = requirePlatformWrite(
          req,
          res,
          String(req.params.resource),
        );
        if (!resource) return;
        const a = req.actor!,
          reason = cleanField(req.body?.reason || req.query.reason, 500);
        if (!reason)
          return res.status(400).json({
            error: "Reason is required for deletion",
            code: "REASON_REQUIRED",
          });
        const current = await platformStore.get(
          resource,
          String(req.params.id),
          a.tenantId,
        );
        if (!current || !canManagePlatformRecord(a, current))
          return res
            .status(404)
            .json({ error: "Record not found", code: "NOT_FOUND" });
        const ok = await platformStore.softDelete(
          resource,
          current.id,
          a.tenantId,
          a.userId,
          reason,
        );
        if (!ok)
          return res
            .status(404)
            .json({ error: "Record not found", code: "NOT_FOUND" });
        res.json({ success: true });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/platform/:resource/:id/restore",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const resource = requirePlatformWrite(
          req,
          res,
          String(req.params.resource),
        );
        if (!resource) return;
        const a = req.actor!,
          reason = cleanField(req.body?.reason, 500);
        if (!reason)
          return res.status(400).json({
            error: "Reason is required for restore",
            code: "REASON_REQUIRED",
          });
        const current = await platformStore.get(
          resource,
          String(req.params.id),
          a.tenantId,
        );
        if (!current || !canManagePlatformRecord(a, current))
          return res
            .status(404)
            .json({ error: "Record not found", code: "NOT_FOUND" });
        const record = await platformStore.restore(
          resource,
          current.id,
          a.tenantId,
          a.userId,
          reason,
        );
        if (!record)
          return res
            .status(404)
            .json({ error: "Record not found", code: "NOT_FOUND" });
        res.json({ success: true, record });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/platform/:resource/:id/versions",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const resource = requirePlatformRead(
          req,
          res,
          String(req.params.resource),
        );
        if (!resource) return;
        const versions = await platformStore.versions(
          resource,
          String(req.params.id),
          req.actor!.tenantId,
        );
        res.json({ success: true, versions });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/events",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const name = cleanField(req.body?.name, 120);
        const allowedClientEvents = new Set([
          "page_view",
          "navigation",
          "search_used",
          "filter_changed",
          "help_opened",
          "ui_feedback",
        ]);
        if (!allowedClientEvents.has(name))
          return res.status(400).json({
            error: "Unsupported client event",
            code: "EVENT_NOT_ALLOWED",
          });
        const allowedProps: Record<string, string | number | boolean | null> =
          {};
        if (req.body?.properties && typeof req.body.properties === "object")
          for (const [k, v] of Object.entries(req.body.properties).slice(
            0,
            20,
          )) {
            if (
              ["string", "number", "boolean"].includes(typeof v) ||
              v === null
            )
              allowedProps[cleanField(k, 80)] =
                typeof v === "string"
                  ? cleanField(v, 240)
                  : (v as number | boolean | null);
          }
        const event = await platformStore.recordEvent({
          tenantId: a.tenantId,
          userId: a.userId,
          name,
          projectId: cleanField(req.body?.projectId, 160) || undefined,
          courseId: cleanField(req.body?.courseId, 160) || undefined,
          properties: allowedProps,
          provenance: "client",
        });
        res.status(201).json({ success: true, event });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/analytics/product",
    authenticate,
    requireRoles(
      "professor",
      "course_coordinator",
      "department_admin",
      "college_admin",
      "university_admin",
      "ai_governance_officer",
      "national_admin",
      "admin",
      "superadmin",
      "root_owner",
    ),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        res.json({
          success: true,
          metrics: await platformStore.metrics(req.actor!.tenantId),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/ai/feedback",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const verdict = String(req.body?.verdict || "");
        if (!["helpful", "incorrect", "missing", "report"].includes(verdict))
          return res.status(400).json({
            error: "Invalid feedback verdict",
            code: "INVALID_FEEDBACK",
          });
        const runId = cleanField(req.body?.runId, 180);
        if (!runId)
          return res
            .status(400)
            .json({ error: "runId is required", code: "RUN_ID_REQUIRED" });
        const a = req.actor!;
        const feedback = await platformStore.feedback({
          tenantId: a.tenantId,
          userId: a.userId,
          runId,
          verdict: verdict as any,
          note: cleanField(req.body?.note, 2000) || undefined,
        });
        res.status(201).json({ success: true, feedback });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/jobs",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const jobs = await platformStore.listJobs(
          a.tenantId,
          PLATFORM_ADMIN_ROLES.has(a.role) ? undefined : a.userId,
        );
        res.json({ success: true, jobs });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/jobs/:id/cancel",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const jobs = await platformStore.listJobs(
          a.tenantId,
          PLATFORM_ADMIN_ROLES.has(a.role) ? undefined : a.userId,
        );
        const job = jobs.find((j) => j.id === req.params.id);
        if (!job)
          return res
            .status(404)
            .json({ error: "Job not found", code: "NOT_FOUND" });
        if (["completed", "failed", "cancelled"].includes(job.state))
          return res.status(409).json({
            error: "Finished job cannot be cancelled",
            code: "JOB_FINAL",
          });
        const updated = await platformStore.updateJob(job.id, a.tenantId, {
          state: "cancelled",
        });
        res.json({ success: true, job: updated });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/admin/api-keys",
    authenticate,
    requireRoles("university_admin", "admin", "superadmin", "root_owner"),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        res.json({
          success: true,
          keys: await platformStore.listApiKeys(req.actor!.tenantId),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/admin/api-keys",
    authenticate,
    requireRoles("university_admin", "admin", "superadmin", "root_owner"),
    requireRecentPrivilegedAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const name = cleanField(req.body?.name, 120);
        const scopes = cleanStringList(req.body?.scopes, 30, 120);
        if (!name || !scopes.length)
          return res.status(400).json({
            error: "Name and at least one scope are required",
            code: "API_KEY_INPUT_REQUIRED",
          });
        const created = await platformStore.createApiKey(
          a.tenantId,
          a.userId,
          name,
          scopes,
          cleanField(req.body?.expiresAt, 80) || undefined,
        );
        res.status(201).json({
          success: true,
          key: created.record,
          secret: created.secret,
          warning: "This secret is shown once. Store it securely.",
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.delete(
    "/api/admin/api-keys/:id",
    authenticate,
    requireRoles("university_admin", "admin", "superadmin", "root_owner"),
    requireRecentPrivilegedAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const reason = cleanField(req.body?.reason || req.query.reason, 500);
        if (!reason)
          return res
            .status(400)
            .json({ error: "Reason is required", code: "REASON_REQUIRED" });
        const ok = await platformStore.revokeApiKey(
          String(req.params.id),
          req.actor!.tenantId,
          req.actor!.userId,
          reason,
        );
        if (!ok)
          return res
            .status(404)
            .json({ error: "API key not found", code: "NOT_FOUND" });
        res.json({ success: true });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get("/api/v1/tenant/summary", async (req, res, next) => {
    try {
      const raw = String(req.header("X-API-Key") || "");
      const key = await platformStore.authenticateApiKey(raw, "tenant:read");
      if (!key)
        return res
          .status(401)
          .json({ error: "Invalid API key or scope", code: "API_KEY_INVALID" });
      const control = await firestoreStore.getControlPlane(key.tenantId);
      res.json({
        data: {
          tenantId: key.tenantId,
          metrics: control.metrics,
          system: control.system,
        },
        meta: { apiVersion: "v1" },
      });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/v1/jobs/:id", async (req, res, next) => {
    try {
      const raw = String(req.header("X-API-Key") || "");
      const key = await platformStore.authenticateApiKey(raw, "jobs:read");
      if (!key)
        return res
          .status(401)
          .json({ error: "Invalid API key or scope", code: "API_KEY_INVALID" });
      const jobs = await platformStore.listJobs(key.tenantId);
      const job = jobs.find((x) => x.id === req.params.id);
      if (!job)
        return res
          .status(404)
          .json({ error: "Job not found", code: "NOT_FOUND" });
      res.json({ data: job, meta: { apiVersion: "v1" } });
    } catch (e) {
      next(e);
    }
  });
  app.get(
    "/api/shares",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        res.json({
          success: true,
          shares: await platformStore.listPublicShares(a.tenantId, a.userId),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/shares",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          kind = String(req.body?.kind || "");
        if (!["passport", "portfolio", "credential", "project"].includes(kind))
          return res
            .status(400)
            .json({ error: "Invalid share kind", code: "INVALID_SHARE" });
        let snapshot: Record<string, unknown> = {};
        const targetId = cleanField(req.body?.targetId, 180) || a.userId;
        if (kind === "passport") {
          const passport = await buildPassport(
            a.userId,
            a.tenantId,
            a.displayName,
          );
          snapshot = {
            user: passport.user,
            projects: passport.projects,
            skills: passport.skills,
            credentials: passport.credentials,
            visibility: "shared_link",
          };
        } else if (kind === "project") {
          const data = await loadProjectIntelligence(a, targetId);
          if (!data)
            return res
              .status(404)
              .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
          snapshot = buildEvidenceCapsule(
            data.project,
            data.artifacts,
            data.evidence,
            data.learning,
            data.skills,
            data.aiRuns,
            process.env.EVIDENCE_CAPSULE_ED25519_PRIVATE_KEY_B64,
          ) as unknown as Record<string, unknown>;
        } else if (kind === "credential") {
          const record = await platformStore.get(
            "credentials",
            targetId,
            a.tenantId,
          );
          const owned =
            record &&
            (record.ownerId === a.userId ||
              String(
                record.data?.subjectUserId || record.data?.userId || "",
              ) === a.userId);
          if (!record || !owned)
            return res.status(404).json({
              error: "Credential not found",
              code: "CREDENTIAL_NOT_FOUND",
            });
          snapshot = {
            credential: {
              id: record.id,
              title: record.title,
              status: record.status,
              type: cleanField(record.data?.type, 160),
              issuer: cleanField(record.data?.issuer, 240),
              issuedAt: cleanField(record.data?.issuedAt, 80),
              verificationCode: cleanField(record.data?.verificationCode, 180),
            },
          };
        } else {
          const record = await platformStore.get(
            "portfolioItems",
            targetId,
            a.tenantId,
          );
          const owned =
            record &&
            (record.ownerId === a.userId ||
              String(record.data?.ownerId || "") === a.userId);
          if (!record || !owned)
            return res.status(404).json({
              error: "Portfolio item not found",
              code: "PORTFOLIO_NOT_FOUND",
            });
          snapshot = {
            portfolio: {
              id: record.id,
              title: record.title,
              status: record.status,
              kind: cleanField(record.data?.kind, 120),
              targetId: cleanField(record.data?.targetId, 180),
              summary: cleanField(record.data?.summary, 3000),
            },
          };
        }
        const password = cleanField(req.body?.password, 120);
        if (password && password.length < 12)
          return res.status(400).json({
            error: "Share password must be at least 12 characters",
            code: "WEAK_SHARE_PASSWORD",
          });
        const expiresAt = cleanField(req.body?.expiresAt, 80) || undefined;
        if (
          expiresAt &&
          (!validFutureIso(expiresAt) ||
            Date.parse(expiresAt) > Date.now() + 365 * 86400000)
        )
          return res.status(400).json({
            error: "Share expiry must be a valid future date within one year",
            code: "INVALID_SHARE_EXPIRY",
          });
        const created = await platformStore.createPublicShare(
          a.tenantId,
          a.userId,
          {
            kind: kind as any,
            targetId,
            label: cleanField(req.body?.label, 160) || kind,
            expiresAt,
            password: password || undefined,
            watermark: cleanField(req.body?.watermark, 160) || undefined,
            snapshot,
          },
        );
        const appUrl = process.env.APP_URL || "http://localhost:3000";
        res.status(201).json({
          success: true,
          share: created.share,
          url: `${appUrl}/share/${encodeURIComponent(created.token)}`,
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.delete(
    "/api/shares/:id",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          ok = await platformStore.revokePublicShare(
            req.params.id,
            a.tenantId,
            a.userId,
          );
        if (!ok)
          return res
            .status(404)
            .json({ error: "Share not found", code: "SHARE_NOT_FOUND" });
        res.json({ success: true });
      } catch (e) {
        next(e);
      }
    },
  );
  async function publicShareResponse(req: any, res: any, password?: string) {
    const share = await platformStore.resolvePublicShare(
      String(req.params.token),
      password,
    );
    if (!share)
      return res.status(404).json({
        error: "Share link is invalid, expired or revoked",
        code: "SHARE_NOT_FOUND",
      });
    if ((share as any).passwordRequired)
      return res.status((share as any).passwordInvalid ? 403 : 401).json({
        error: (share as any).passwordInvalid
          ? "Incorrect share password"
          : "Password required",
        code: (share as any).passwordInvalid
          ? "SHARE_PASSWORD_INVALID"
          : "SHARE_PASSWORD_REQUIRED",
      });
    res.setHeader("Cache-Control", "private, no-store");
    return res.json({
      success: true,
      share: {
        kind: share.kind,
        label: share.label,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
        watermark: share.watermark,
        viewCount: share.viewCount,
        snapshot: (share as any).snapshot || {},
      },
    });
  }
  app.post("/api/public/evidence-capsule/verify", async (req, res, next) => {
    try {
      const capsule = req.body?.capsule as EvidenceCapsule | undefined;
      if (!capsule || capsule.schemaVersion !== "1.0" || !capsule.integrity)
        return res.status(400).json({
          error: "A valid Evidence Capsule is required",
          code: "CAPSULE_REQUIRED",
        });
      if (JSON.stringify(capsule).length > 500000)
        return res.status(413).json({
          error: "Evidence Capsule is too large",
          code: "CAPSULE_TOO_LARGE",
        });
      res.json({
        success: true,
        verification: verifyEvidenceCapsule(
          capsule,
          process.env.EVIDENCE_CAPSULE_ED25519_PRIVATE_KEY_B64,
          String(process.env.EVIDENCE_CAPSULE_TRUSTED_PUBLIC_KEYS || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean),
        ),
      });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/public/share/:token", async (req, res, next) => {
    try {
      await publicShareResponse(req, res);
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/public/share/:token/access", async (req, res, next) => {
    try {
      await publicShareResponse(req, res, cleanField(req.body?.password, 120));
    } catch (e) {
      next(e);
    }
  });
  app.get(
    "/api/notifications",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const notifications = await listNotifications(
          a.tenantId,
          a.userId,
          a.role,
          120,
        );
        res.json({ success: true, notifications });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/notifications/:id/read",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const ok = await markNotificationRead(
          String(req.params.id),
          a.tenantId,
          a.userId,
        );
        if (!ok)
          return res
            .status(404)
            .json({ error: "Notification not found", code: "NOT_FOUND" });
        res.json({ success: true });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/notifications/read-all",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        res.json({
          success: true,
          count: await markAllNotificationsRead(a.tenantId, a.userId),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/notifications/:id/state",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const ok = await updateNotificationState(
          String(req.params.id),
          a.tenantId,
          a.userId,
          {
            read:
              typeof req.body?.read === "boolean" ? req.body.read : undefined,
            archive: Boolean(req.body?.archive),
            snoozedUntil: cleanField(req.body?.snoozedUntil, 80) || undefined,
          },
        );
        if (!ok)
          return res
            .status(404)
            .json({ error: "Notification not found", code: "NOT_FOUND" });
        res.json({ success: true });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/notification-preferences",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        res.json({
          success: true,
          preferences: await getNotificationPreferences(a.tenantId, a.userId),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/notification-preferences",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        res.json({
          success: true,
          preferences: await saveNotificationPreferences(
            a.tenantId,
            a.userId,
            req.body || {},
          ),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/lifecycle/deletion-request",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const reason = cleanField(req.body?.reason, 1000);
        if (!reason)
          return res
            .status(400)
            .json({ error: "Reason is required", code: "REASON_REQUIRED" });
        const graceDays = Math.min(
          30,
          Math.max(0, Number(process.env.ACCOUNT_DELETION_GRACE_DAYS || 7)),
        );
        const graceEndsAt = new Date(
          Date.now() + graceDays * 86400000,
        ).toISOString();
        const record = await platformStore.create(
          "deletionRequests",
          a.tenantId,
          a.userId,
          {
            title: `Account deletion — ${a.userId}`,
            status: graceDays ? "grace_period" : "requested",
            ownerId: a.userId,
            data: {
              scope: "account",
              userId: a.userId,
              requestedAt: new Date().toISOString(),
              graceEndsAt,
              exportRequested: Boolean(req.body?.exportRequested),
              institutionRetentionMayApply: true,
            },
          },
          reason,
        );
        await createNotification({
          tenantId: a.tenantId,
          userId: a.userId,
          type: "system",
          priority: "important",
          title: "تم تسجيل طلب الحذف",
          body: `فترة السماح حتى ${graceEndsAt}. قد تمنع سياسة المؤسسة حذف بعض السجلات وتحوّلها إلى anonymized/retained evidence.`,
          targetPath: "/app/settings",
          channels: ["in_app"],
        });
        res.status(201).json({ success: true, request: record });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/lifecycle/deletion-request/:id/cancel",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const current = await platformStore.get(
          "deletionRequests",
          String(req.params.id),
          a.tenantId,
        );
        if (!current || current.ownerId !== a.userId)
          return res
            .status(404)
            .json({ error: "Deletion request not found", code: "NOT_FOUND" });
        if (["processing", "completed"].includes(current.status))
          return res.status(409).json({
            error: "This deletion request can no longer be cancelled",
            code: "DELETION_FINAL",
          });
        const record = await platformStore.update(
          "deletionRequests",
          current.id,
          a.tenantId,
          a.userId,
          { status: "cancelled" },
          "Cancelled by account owner",
        );
        res.json({ success: true, request: record });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/admin/backups/run",
    authenticate,
    requireRoles("university_admin", "admin", "superadmin", "root_owner"),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        if (!externalServices.backup.configured())
          return res.status(503).json({
            error:
              "Backup worker is not configured. Set BACKUP_WORKER_URL and BACKUP_WORKER_TOKEN.",
            code: "BACKUP_NOT_CONFIGURED",
          });
        const a = req.actor!,
          kind = ["backup", "restore_test", "tenant_export"].includes(
            String(req.body?.kind),
          )
            ? String(req.body.kind)
            : "backup";
        const reason = cleanField(req.body?.reason, 500);
        if (!reason)
          return res
            .status(400)
            .json({ error: "Reason is required", code: "REASON_REQUIRED" });
        let job = await platformStore.createJob({
          tenantId: a.tenantId,
          userId: a.userId,
          type: `backup:${kind}`,
          state: "running",
          progress: 10,
          stages: [
            {
              key: "dispatch",
              label: "Dispatching isolated backup worker",
              state: "running",
            },
          ],
          idempotencyKey:
            cleanField(req.header("Idempotency-Key"), 180) || undefined,
        });
        try {
          const result: any = await externalServices.backup.run({
            action: kind,
            tenantId: a.tenantId,
            requestedBy: a.userId,
            reason,
          });
          job =
            (await platformStore.updateJob(job.id, a.tenantId, {
              state: "completed",
              progress: 100,
              stages: [
                {
                  key: "dispatch",
                  label: "Dispatching isolated backup worker",
                  state: "completed",
                  at: new Date().toISOString(),
                },
              ],
              resultRef: String(
                result?.jobId || result?.snapshotId || "external",
              ),
            })) || job;
          await platformStore.create(
            "backupRuns",
            a.tenantId,
            a.userId,
            {
              title: `${kind} — ${new Date().toISOString()}`,
              status: "completed",
              data: {
                kind,
                externalRef: result?.jobId || result?.snapshotId || null,
                verified: Boolean(result?.verified),
              },
            },
            reason,
          );
          res.status(201).json({ success: true, job, result });
        } catch (error: any) {
          await platformStore.updateJob(job.id, a.tenantId, {
            state: "failed",
            progress: 100,
            error: cleanField(error?.message, 1000),
            stages: [
              {
                key: "dispatch",
                label: "Dispatching isolated backup worker",
                state: "failed",
                at: new Date().toISOString(),
              },
            ],
          });
          throw error;
        }
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/tools/code/execute",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        await assertFeature(req.actor!.tenantId, "ExternalCodeExecution");
        if (!externalServices.codeSandbox.configured())
          return res.status(503).json({
            error:
              "Code execution is disabled until an isolated sandbox is configured.",
            code: "CODE_SANDBOX_NOT_CONFIGURED",
          });
        const a = req.actor!,
          projectId = cleanField(req.body?.projectId, 180),
          language = cleanField(req.body?.language, 60),
          code = cleanField(req.body?.code, 120000);
        if (!projectId || !language || !code)
          return res.status(400).json({
            error: "projectId, language and code are required",
            code: "CODE_INPUT_REQUIRED",
          });
        const project = await firestoreStore.getProject(
          projectId,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const result = await externalServices.codeSandbox.run({
          tenantId: a.tenantId,
          userId: a.userId,
          projectId,
          language,
          code,
          network: false,
          maxSeconds: 20,
          maxOutputBytes: 200000,
        });
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "tool.code.execute",
          projectId,
          undefined,
          { language, sandboxed: true },
        );
        res.json({ success: true, result });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/semantic",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        await assertFeature(req.actor!.tenantId, "SemanticRAG");
        if (!externalServices.semantic.configured())
          return res.status(503).json({
            error:
              "Semantic index is disabled until its tenant-scoped service is configured.",
            code: "SEMANTIC_NOT_CONFIGURED",
          });
        const a = req.actor!,
          action = String(req.body?.action || "search");
        if (!["index", "search"].includes(action))
          return res.status(400).json({
            error: "Invalid semantic action",
            code: "SEMANTIC_ACTION_INVALID",
          });
        const projectId = cleanField(req.body?.projectId, 180);
        if (projectId) {
          const project = await firestoreStore.getProject(
            projectId,
            a.userId,
            a.tenantId,
          );
          if (!project)
            return res
              .status(404)
              .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        }
        const result = await externalServices.semantic.run({
          action,
          tenantId: a.tenantId,
          userId: a.userId,
          projectId: projectId || undefined,
          query: cleanField(req.body?.query, 4000),
          documents: Array.isArray(req.body?.documents)
            ? req.body.documents.slice(0, 100)
            : undefined,
          requireCitations: true,
        });
        res.json({ success: true, result });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/translate",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        if (!externalServices.translation.configured())
          return res.status(503).json({
            error: "Translation service is not configured",
            code: "TRANSLATION_NOT_CONFIGURED",
          });
        const a = req.actor!,
          text = cleanField(req.body?.text, 30000),
          target = cleanField(req.body?.targetLocale, 30),
          source = cleanField(req.body?.sourceLocale, 30) || "auto";
        if (!text || !target)
          return res.status(400).json({
            error: "text and targetLocale are required",
            code: "TRANSLATION_INPUT_REQUIRED",
          });
        const result = await externalServices.translation.run({
          tenantId: a.tenantId,
          userId: a.userId,
          text,
          sourceLocale: source,
          targetLocale: target,
          preserveCitations: true,
        });
        res.json({ success: true, result });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/dashboard",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const summary = await buildDashboard(a.userId, a.tenantId);
        res.json({ success: true, summary });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/search",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const q = cleanField(req.query.q, 160).toLocaleLowerCase("ar");
        if (q.length < 2) return res.json({ success: true, results: [] });
        const projects = await firestoreStore.listProjects(
          a.userId,
          a.tenantId,
        );
        const results: GlobalSearchItem[] = projects
          .filter((p) =>
            [
              p.title,
              p.course,
              p.academicDomain,
              p.projectType,
              ...p.requiredSkills,
            ]
              .join(" ")
              .toLocaleLowerCase("ar")
              .includes(q),
          )
          .slice(0, 40)
          .map((p) => ({
            id: p.id,
            type: "project",
            title: p.title,
            subtitle: `${p.course} · ${p.projectType}`,
            path: `/app/project/${p.id}`,
            updatedAt: p.updatedAt,
          }));
        if (FACULTY_ROLES.includes(a.role)) {
          const [courses, assignments] = await Promise.all([
            firestoreStore.listCourses(a.tenantId),
            firestoreStore.listTenantAssignments(a.tenantId),
          ]);
          results.push(
            ...courses
              .filter((c) =>
                [c.code, c.title, c.term, c.description, ...c.outcomes]
                  .filter(Boolean)
                  .join(" ")
                  .toLocaleLowerCase("ar")
                  .includes(q),
              )
              .slice(0, 30)
              .map((c) => ({
                id: c.id,
                type: "course" as const,
                title: c.title,
                subtitle: `${c.code}${c.term ? ` · ${c.term}` : ""}`,
                path: `/app/course/${c.id}`,
                updatedAt: c.updatedAt,
              })),
          );
          results.push(
            ...assignments
              .filter((x) =>
                [x.title, x.instructions, ...x.outcomes]
                  .join(" ")
                  .toLocaleLowerCase("ar")
                  .includes(q),
              )
              .slice(0, 30)
              .map((x) => ({
                id: x.id,
                type: "assignment" as const,
                title: x.title,
                subtitle: "Assignment Builder",
                path: `/app/course/${x.courseId}`,
                updatedAt: x.updatedAt,
              })),
          );
        }
        results.sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
        res.json({ success: true, results: results.slice(0, 80) });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/intelligence/brain",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const projects = await firestoreStore.listProjects(
          a.userId,
          a.tenantId,
        );
        const skills = await buildSkills(a.userId, a.tenantId);
        const learning = await firestoreStore.listUserLearningEvidence(
          a.userId,
          a.tenantId,
        );
        res.json({
          success: true,
          brain: buildLearningBrain(projects, skills, learning),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/intelligence/mission-control",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const projects = await firestoreStore.listProjects(
          a.userId,
          a.tenantId,
        );
        const profile = await firestoreStore.getProfile(
          a.userId,
          a.tenantId,
          a,
        );
        const skills = await buildSkills(a.userId, a.tenantId);
        const learning = await firestoreStore.listUserLearningEvidence(
          a.userId,
          a.tenantId,
        );
        const brain = buildLearningBrain(projects, skills, learning);
        res.json({
          success: true,
          mission: addConcierge(buildMissionControl(projects, profile, brain)),
          brain,
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/intelligence/curriculum-twin",
    authenticate,
    requireRoles(
      "department_admin",
      "college_admin",
      "university_admin",
      "accreditation_officer",
      "admin",
      "superadmin",
      "root_owner",
    ),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const [courses, assignments, programs, maps] = await Promise.all([
          firestoreStore.listCourses(a.tenantId),
          firestoreStore.listTenantAssignments(a.tenantId),
          platformStore.list("programs", a.tenantId, { limit: 200 }),
          platformStore.list("curriculumMaps", a.tenantId, { limit: 200 }),
        ]);
        const programId = cleanField(req.query.programId, 180) || undefined;
        res.json({
          success: true,
          twin: buildCurriculumTwin(
            courses,
            assignments,
            programs,
            maps,
            programId,
          ),
          programs: programs.map((p) => ({
            id: p.id,
            title: p.title,
            status: p.status,
          })),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/intelligence/curriculum-twin/simulate",
    authenticate,
    requireRoles(
      "department_admin",
      "college_admin",
      "university_admin",
      "accreditation_officer",
      "admin",
      "superadmin",
      "root_owner",
    ),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const [courses, assignments, programs, maps] = await Promise.all([
          firestoreStore.listCourses(a.tenantId),
          firestoreStore.listTenantAssignments(a.tenantId),
          platformStore.list("programs", a.tenantId, { limit: 200 }),
          platformStore.list("curriculumMaps", a.tenantId, { limit: 200 }),
        ]);
        const body = req.body || {};
        const input = {
          programId: cleanField(body.programId, 180) || undefined,
          removeCourseIds: cleanStringList(body.removeCourseIds, 200, 180),
          courseOutcomeOverrides:
            body.courseOutcomeOverrides &&
            typeof body.courseOutcomeOverrides === "object"
              ? Object.fromEntries(
                  Object.entries(body.courseOutcomeOverrides)
                    .slice(0, 200)
                    .map(([id, v]) => [id, cleanStringList(v, 100, 500)]),
                )
              : undefined,
          termOverrides:
            body.termOverrides && typeof body.termOverrides === "object"
              ? Object.fromEntries(
                  Object.entries(body.termOverrides)
                    .slice(0, 200)
                    .map(([id, v]) => [id, cleanField(v, 100)]),
                )
              : undefined,
        };
        const simulation = simulateCurriculumTwin(
          courses,
          assignments,
          programs,
          maps,
          input,
        );
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "curriculum_twin.simulate",
          input.programId || "tenant",
          undefined,
          {
            removedCourses: input.removeCourseIds.length,
            riskLevel: simulation.impact.riskLevel,
          },
        );
        res.json({ success: true, simulation });
      } catch (e) {
        next(e);
      }
    },
  );
  // --- Frontier engines: accreditation, deadline congestion, integrity lint, grader fairness, federation, authorship passport ---
  const DOSSIER_ROLES: UserRole[] = [
    "course_coordinator",
    "department_admin",
    "college_admin",
    "university_admin",
    "accreditation_officer",
    "admin",
    "superadmin",
    "root_owner",
  ];
  app.get(
    "/api/intelligence/accreditation-dossier",
    authenticate,
    requireRoles(...DOSSIER_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const [courses, assignments, submissions, programs, maps] =
          await Promise.all([
            firestoreStore.listCourses(a.tenantId),
            firestoreStore.listTenantAssignments(a.tenantId),
            firestoreStore.listTenantSubmissions(a.tenantId),
            platformStore.list("programs", a.tenantId, { limit: 200 }),
            platformStore.list("curriculumMaps", a.tenantId, { limit: 200 }),
          ]);
        const programId = cleanField(req.query.programId, 180) || undefined;
        const program = programId
          ? programs.find((p) => p.id === programId)
          : programs[0];
        const map =
          maps.find(
            (x) => String(x.data?.programId || "") === String(program?.id || ""),
          ) || (!programId ? maps[0] : undefined);
        const threshold = Math.min(
          1,
          Math.max(0, Number(req.query.threshold) || 0.7),
        );
        res.json({
          success: true,
          dossier: buildAccreditationDossier(
            courses,
            assignments,
            submissions,
            program,
            map,
            threshold,
          ),
          programs: programs.map((p) => ({
            id: p.id,
            title: p.title,
            status: p.status,
          })),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/intelligence/deadline-congestion",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const assignments = await firestoreStore.listTenantAssignments(
          a.tenantId,
        );
        const courseId = cleanField(req.query.courseId, 180) || undefined;
        const scoped = courseId
          ? assignments.filter((x) => x.courseId === courseId)
          : assignments;
        const cohortSize = Math.min(
          2000,
          Math.max(1, Number(req.query.cohortSize) || 30),
        );
        res.json({
          success: true,
          congestion: buildDeadlineCongestion(
            scoped.map((x) => ({
              id: x.id,
              title: x.title,
              courseId: x.courseId,
              deadline: x.deadline,
            })),
            cohortSize,
          ),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/intelligence/assignment-integrity/:assignmentId",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const assignments = await firestoreStore.listTenantAssignments(
          a.tenantId,
        );
        const assignment = assignments.find(
          (x) => x.id === req.params.assignmentId,
        );
        if (!assignment)
          return res.status(404).json({
            error: "Assignment not found",
            code: "ASSIGNMENT_NOT_FOUND",
          });
        res.json({ success: true, lint: lintAssignmentIntegrity(assignment) });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/intelligence/grader-fairness",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const assignmentId =
          cleanField(req.query.assignmentId, 180) || undefined;
        const all = await firestoreStore.listTenantSubmissions(a.tenantId);
        const submissions = assignmentId
          ? all.filter((x) => x.assignmentId === assignmentId)
          : all;
        res.json({ success: true, fairness: buildGraderFairness(submissions) });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/intelligence/federated-graph",
    authenticate,
    requireRoles("national_admin", "superadmin", "root_owner"),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const body = req.body || {};
        const institutions = Array.isArray(body.institutions)
          ? body.institutions.slice(0, 200).map((x: any) => ({
              institutionId: cleanField(x?.institutionId, 180) || "",
              institutionName: cleanField(x?.institutionName, 180) || "",
              outcomes: Array.isArray(x?.outcomes)
                ? x.outcomes.slice(0, 400).map((o: any) => ({
                    code: cleanField(o?.code, 80) || "",
                    label: cleanField(o?.label, 300) || "",
                  }))
                : [],
              skills: cleanStringList(x?.skills, 400, 200),
            }))
          : [];
        res.json({
          success: true,
          graph: buildFederatedGraph(
            institutions.filter(
              (x: any) => x.institutionId && x.outcomes.length,
            ),
          ),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/learn/intake",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const body = req.body || {};
        const files = (Array.isArray(body.files) ? body.files : []) as IncomingFile[];
        const note = cleanField(body.note, 2000) || "";
        if (!files.length && !note.trim())
          return res.status(400).json({ error: "Provide study material or a note", code: "STUDY_MATERIAL_REQUIRED" });
        if (files.length > MAX_ASSIGNMENT_FILES)
          return res.status(413).json({ error: `A maximum of ${MAX_ASSIGNMENT_FILES} files can be studied together`, code: "TOO_MANY_FILES" });
        files.forEach(validateFile);
        const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
        if (totalBytes > MAX_TOTAL_FILE_BYTES)
          return res.status(413).json({ error: "Combined study files are too large", code: "TOTAL_FILES_TOO_LARGE" });
        if (files.length) {
          if (process.env.REQUIRE_VIRUS_SCAN === "true" && !externalServices.virusScan.configured())
            return res.status(503).json({ error: "Malware scanning is required but not configured", code: "VIRUS_SCAN_REQUIRED" });
          if (externalServices.virusScan.configured()) {
            for (const file of files) {
              const result: any = await externalServices.virusScan.run({
                name: file.name,
                mimeType: file.mimeType,
                size: file.size,
                sha256: createHash("sha256").update(Buffer.from(file.base64, "base64")).digest("hex"),
                base64: file.base64,
              });
              if (result?.clean !== true)
                throw Object.assign(new Error(`Upload blocked by malware scanner: ${file.name}`), { status: 422, code: "MALWARE_DETECTED" });
            }
          }
        }

        const parts = note.trim() ? [`--- STUDENT NOTE ---\n${note.trim()}`] : [];
        const warnings: string[] = [];
        const extractionBudget = createExtractionBudget(MAX_TOTAL_FILE_BYTES, 120_000);
        for (const file of files) {
          const extracted = extractFileText(file, extractionBudget);
          if (extracted.text) parts.push(`--- ${file.name} ---\n${extracted.text}`);
          if (extracted.multimodal) {
            const ocr = await runOcr(file);
            if (ocr?.text) {
              parts.push(`--- ${file.name} (OCR) ---\n${ocr.text}`);
              warnings.push(...ocr.extraction.warnings);
            } else {
              warnings.push(`${file.name}: يحتاج OCR مهيأ لاستخراج نص الصورة/الملف الممسوح.`);
            }
          }
        }
        const materialText = parts.join("\n\n").trim();
        if (!materialText)
          return res.status(422).json({ error: "Could not extract readable study text. Configure OCR for image-only material.", code: "STUDY_TEXT_NOT_EXTRACTED" });

        let guide = {
          summary: materialText.slice(0, 900),
          keyIdeas: materialText.split(/\n+/).map((line) => line.trim()).filter((line) => line.length > 30).slice(0, 6),
          examPrompts: [] as string[],
          warnings,
        };
        let source: "ai" | "scaffold" = "scaffold";
        if (aiConfigured({ taskType: "exam_material_intake", complexity: "medium", risk: "low" })) {
          const gate = await platformStore.reserveAiBudget(a.tenantId, a.userId);
          try {
            const result = await getAIProvider({ taskType: "exam_material_intake", complexity: "medium", risk: "low" }).runAcademicTask({
              taskType: "exam_material_intake",
              agent: "exam_coach",
              projectContext: { fileCount: files.length, learnerId: a.userId },
              artifact: { module: "exam_autopilot", title: "Study material", content: materialText.slice(0, 60_000) },
              platformInstruction: "Build an exam-prep capsule from the supplied study material only. summary = concise map of the material. findings = the most important examinable ideas. suggestions = challenging practice questions that require understanding, not rote copying. warnings = ambiguities, unreadable areas, or evidence gaps. Do not invent facts outside the material and do not claim certainty where the material is incomplete.",
              learnerInstruction: note || "Prepare me for an exam from these materials.",
              policySummary: "Learning and exam preparation only; do not fabricate sources or course policy.",
            });
            await firestoreStore.recordAIUsage(result.usage, a, "exam_autopilot");
            guide = {
              summary: result.output.summary,
              keyIdeas: result.output.findings.slice(0, 10),
              examPrompts: result.output.suggestions.slice(0, 10),
              warnings: [...warnings, ...result.output.warnings].slice(0, 12),
            };
            source = "ai";
          } finally {
            await platformStore.releaseAiBudgetReservation(gate.reservation);
          }
        }
        await recordProductEventSafe(a, "exam_material_ingested", { properties: { files: files.length, source, characters: materialText.length } });
        res.json({ success: true, source, materialText: materialText.slice(0, 24_000), guide });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/learn/explain",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const body = req.body || {};
        const topic = cleanField(body.topic, 600);
        if (!topic)
          return res.status(400).json({
            error: "Provide a topic to explain",
            code: "TOPIC_REQUIRED",
          });
        const language = cleanField(body.language, 40) || "English";
        const level = cleanField(body.level, 20) || "beginner";
        const context = cleanField(body.context, 600) || undefined;
        if (!aiConfigured({ complexity: "medium", risk: "low" })) {
          return res.json({
            success: true,
            lesson: nativeTutorScaffold(topic, language, level),
            source: "scaffold",
          });
        }
        // اتساق: نفس (الموضوع+اللغة+المستوى) داخل نفس المقرر/الجامعة => نفس الشرح.
        const scope = cacheScope("tenant", a.tenantId);
        const key = learnCacheKey("tutor", { topic, language, level });
        const cached = await firestoreStore.getLearnCache(scope, key);
        if (cached)
          return res.json({ success: true, lesson: cached, source: "cache" });
        const gate = await platformStore.reserveAiBudget(a.tenantId, a.userId);
        let result;
        try {
          result = await getAIProvider({
            complexity: "medium",
            risk: "low",
          }).runAcademicTask(
            buildTutorRequest({ topic, language, level, context }),
          );
        } finally {
          await platformStore.releaseAiBudgetReservation(gate.reservation);
        }
        await firestoreStore.recordAIUsage(result.usage, a, "tutor");
        const lesson = toLesson(topic, language, level, result.output);
        await firestoreStore.setLearnCache(scope, key, lesson, {
          kind: "tutor",
          language,
          level,
        });
        await recordProductEventSafe(a, "tutor_explained", {
          properties: { language, level },
        });
        res.json({ success: true, lesson, source: "ai" });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/learn/solve",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const body = req.body || {};
        const problem = cleanField(body.problem, 4000);
        if (!problem)
          return res.status(400).json({
            error: "Provide a problem to solve",
            code: "PROBLEM_REQUIRED",
          });
        const language = cleanField(body.language, 40) || "English";
        const context = cleanField(body.context, 800) || undefined;
        const courseId = cleanField(body.courseId, 180);
        const assignmentId = cleanField(body.assignmentId, 180);
        // إن ربط الطالب المسألة بواجب منشور، نحمّل سياسته الرسمية لتقرير الوضع.
        let policyCtx = { linkedToAssignment: false } as Parameters<
          typeof decideSolveMode
        >[0];
        if (courseId && assignmentId) {
          const [assignment, enrollment, course] = await Promise.all([
            firestoreStore.getCourseAssignment(
              assignmentId,
              courseId,
              a.tenantId,
            ),
            firestoreStore.getCourseEnrollment(courseId, a.userId, a.tenantId),
            firestoreStore.getCourse(courseId, a.tenantId),
          ]);
          if (!assignment || assignment.status !== "published")
            return res.status(404).json({
              error: "Published course assignment not found",
              code: "PUBLISHED_ASSIGNMENT_NOT_FOUND",
            });
          if (!enrollment && !(course && canManageCourse(a, course)))
            return res.status(403).json({
              error: "Active course enrollment is required",
              code: "COURSE_ENROLLMENT_REQUIRED",
            });
          const pol = normalizeAcademicPolicy(assignment.aiPolicy);
          policyCtx = {
            linkedToAssignment: true,
            policyLevel: pol.level,
            policyProhibited: pol.prohibited,
            policyNeedsConfirmation: false,
          };
        }
        const decision = decideSolveMode(policyCtx);
        const variation = buildSolveVariation(a.userId, problem);
        if (!aiConfigured({ complexity: "high", risk: "medium" })) {
          return res.json({
            success: true,
            decision,
            result: nativeSolveScaffold(decision.mode, language),
            source: "scaffold",
          });
        }
        // اتساق للمسائل التدريبية فقط (غير مربوطة بواجب مُقيَّم) — نتجنّب تطابق حلول التسليمات.
        const cacheable =
          !policyCtx.linkedToAssignment && decision.mode === "worked";
        const solveScope = cacheScope("global", a.tenantId);
        const solveKey = learnCacheKey("solve", {
          problem,
          language,
          mode: decision.mode,
          variationId: variation.id,
        });
        if (cacheable) {
          const hit = await firestoreStore.getLearnCache(solveScope, solveKey);
          if (hit)
            return res.json({
              success: true,
              decision,
              result: hit,
              source: "cache",
            });
        }
        const gate = await platformStore.reserveAiBudget(a.tenantId, a.userId);
        let result;
        try {
          result = await getAIProvider({
            complexity: "high",
            risk: "medium",
          }).runAcademicTask(
            buildSolveRequest({
              problem,
              language,
              mode: decision.mode,
              context,
              variation,
            }),
          );
        } finally {
          await platformStore.releaseAiBudgetReservation(gate.reservation);
        }
        await firestoreStore.recordAIUsage(result.usage, a, "solver");
        const solveResult = toSolveResult(decision.mode, language, result.output);
        if (cacheable)
          await firestoreStore.setLearnCache(solveScope, solveKey, solveResult, {
            kind: "solve",
            mode: decision.mode,
            language,
          });
        // إفصاح مسجَّل في السجل التدقيقي (شفافية للأستاذ عند الربط بواجب).
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "learn.solve",
          assignmentId || "practice",
          undefined,
          { mode: decision.mode, linked: policyCtx.linkedToAssignment, variationId: variation.id },
        );
        res.json({ success: true, decision, result: solveResult, source: "ai" });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/authorship-passport",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const data = await loadProjectIntelligence(req.actor!, req.params.id);
        if (!data)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const capsule = buildEvidenceCapsule(
          data.project,
          data.artifacts,
          data.evidence,
          data.learning,
          data.skills,
          data.aiRuns,
          process.env.EVIDENCE_CAPSULE_ED25519_PRIVATE_KEY_B64,
        );
        const trustedKeys = String(
          process.env.EVIDENCE_CAPSULE_TRUSTED_PUBLIC_KEYS_B64URL || "",
        )
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
        res.setHeader("Cache-Control", "private, no-store");
        res.json({
          success: true,
          passport: buildAuthorshipPassport(capsule, {
            trustedPublicKeySpkiB64url: trustedKeys,
          }),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const projects = await firestoreStore.listProjects(
          a.userId,
          a.tenantId,
        );
        res.json({ success: true, projects });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        res.json({ success: true, project });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/rescue-plan",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          project = await firestoreStore.getProject(
            req.params.id,
            a.userId,
            a.tenantId,
          );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const minutes = Math.min(
          720,
          Math.max(30, Number(req.query.minutes || 180)),
        );
        res.json({ success: true, plan: buildRescuePlan(project, minutes) });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/projects/:id/red-team",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(req.params.id, a.userId, a.tenantId);
        if (!project) return res.status(404).json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });

        const categories = ["methodology", "sampling", "generalizability", "theoretical", "requirements", "evidence"] as const;
        const fallback = [
          ...(project.riskFlags || []).slice(0, 3).map((risk, index) => ({
            category: "requirements" as const,
            challengeTitle: `Project DNA risk ${index + 1}`,
            critiqueText: cleanField(risk, 700),
            suggestedDefense: "Verify the requirement against the assignment or course policy, then close it with traceable evidence. Do not claim work, data, or verification that is not recorded.",
          })),
          ...(project.rubric || []).filter((item) => item.readiness && item.readiness !== "covered").slice(0, 4).map((item) => ({
            category: "evidence" as const,
            challengeTitle: `How will you prove: ${cleanField(item.title, 180)}?`,
            critiqueText: cleanField(item.description || "This rubric criterion is not fully evidenced in the recorded project state.", 700),
            suggestedDefense: "Link the criterion to a real artifact, source, or evidence record. If evidence is missing, revise the work instead of inventing a verbal defense.",
          })),
        ].slice(0, 6);

        if (!aiConfigured({ taskType: "project_red_team", complexity: project.complexity, risk: "high" })) {
          return res.json({ success: true, challenges: fallback, provider: "project-dna" });
        }

        const gate = await platformStore.reserveAiBudget(a.tenantId, a.userId);
        try {
          const result = await getAIProvider({ taskType: "project_red_team", complexity: project.complexity, risk: "high" }).runAcademicTask({
            taskType: "project_red_team",
            agent: "adversarial_reviewer",
            projectContext: {
              project: {
                id: project.id,
                title: project.title,
                course: project.course,
                projectType: project.projectType,
                academicDomain: project.academicDomain,
                learningOutcomes: project.learningOutcomes,
                requiredActions: project.requiredActions,
                requirements: project.requirements,
                deliverables: project.deliverables,
                rubric: project.rubric,
                riskFlags: project.riskFlags,
                sourceRequirements: project.sourceRequirements || [],
                aiPolicy: project.aiPolicy,
              },
            },
            platformInstruction: "Act as a hostile but fair academic examiner. Identify only weaknesses supported by the supplied Project DNA. Never invent sample sizes, statistical tests, Cronbach alpha, participant characteristics, findings, citations, sources, theories, completed procedures, grades, or institutional rules. If the context is insufficient for a specific criticism, say so. Each finding must be a concise examiner challenge; each suggestion must explain how to close that exact gap using evidence or project revision, not rhetorical bluffing.",
            learnerInstruction: "Stress-test this project. Prioritize the most consequential methodological, evidence, requirement, theoretical, sampling, or generalizability weaknesses that are actually supported by the recorded project state.",
            policySummary: `Level ${project.aiPolicy.level}. ${project.aiPolicy.summary || ""}`,
          });
          await firestoreStore.recordAIUsage(result.usage, a, project.id);
          const findings = result.output.findings.slice(0, 8);
          const suggestions = result.output.suggestions;
          const challenges = findings.map((finding, index) => {
            const lower = finding.toLowerCase();
            const category = lower.includes("sample") || lower.includes("عينة") ? "sampling"
              : lower.includes("general") || lower.includes("تعميم") ? "generalizability"
              : lower.includes("theor") || lower.includes("نظر") ? "theoretical"
              : lower.includes("method") || lower.includes("منهج") ? "methodology"
              : lower.includes("rubric") || lower.includes("evidence") || lower.includes("دليل") || lower.includes("مصدر") ? "evidence"
              : "requirements";
            return {
              category: (categories as readonly string[]).includes(category) ? category : "requirements",
              challengeTitle: cleanField(finding, 180),
              critiqueText: cleanField(finding, 900),
              suggestedDefense: cleanField(suggestions[index] || suggestions[0] || "Close this gap with recorded evidence or revise the project; do not invent a defense.", 900),
            };
          });
          await firestoreStore.writeAudit(a.tenantId, a.userId, "ai.project_red_team", project.id, undefined, { challengeCount: challenges.length, provider: result.usage.provider });
          return res.json({ success: true, challenges: challenges.length ? challenges : fallback, provider: result.usage.provider });
        } catch (error) {
          return res.json({ success: true, challenges: fallback, provider: "project-dna", warning: cleanField((error as any)?.message || "AI reviewer unavailable", 180) });
        } finally {
          await platformStore.releaseAiBudgetReservation(gate.reservation);
        }
      } catch (e) {
        next(e);
      }
    },
  );

  app.get(
    "/api/courses",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await assertFeature(a.tenantId, "ProfessorOS");
        const all = await firestoreStore.listCourses(a.tenantId);
        const courses = COURSE_ADMIN_ROLES.has(a.role)
          ? all
          : all.filter((course) => course.ownerId === a.userId);
        res.json({ success: true, courses });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/faculty/automation",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await assertFeature(a.tenantId, "ProfessorOS");
        const allCourses = await firestoreStore.listCourses(a.tenantId);
        const courses = COURSE_ADMIN_ROLES.has(a.role)
          ? allCourses
          : allCourses.filter((course) => course.ownerId === a.userId);
        const allAssignments = await firestoreStore.listTenantAssignments(
          a.tenantId,
        );
        const courseIds = new Set(courses.map((c) => c.id)),
          assignments = allAssignments.filter((item) =>
            courseIds.has(item.courseId),
          );
        res.json({
          success: true,
          brief: buildFacultyAutomation(courses, assignments),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/faculty/copilot",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await assertFeature(a.tenantId, "ProfessorOS");
        const query = cleanField(req.body?.query, 1200);
        if (!query) return res.status(400).json({ error: "Ask the faculty copilot a question", code: "FACULTY_QUERY_REQUIRED" });
        const allCourses = await firestoreStore.listCourses(a.tenantId);
        const courses = COURSE_ADMIN_ROLES.has(a.role) ? allCourses : allCourses.filter((course) => course.ownerId === a.userId);
        const courseIds = new Set(courses.map((course) => course.id));
        const assignments = (await firestoreStore.listTenantAssignments(a.tenantId)).filter((assignment) => courseIds.has(assignment.courseId));
        const brief = buildFacultyAutomation(courses, assignments);
        if (!aiConfigured({ taskType: "faculty_copilot", complexity: "medium", risk: "medium" })) {
          return res.json({
            success: true,
            source: "scaffold",
            answer: brief.actions[0]?.detail || "لا توجد إشارة كافية بعد. افتح أحد المقررات وأضف تكليفاً أو rubric حتى تصبح التوصية أدق.",
            suggestions: brief.actions.slice(0, 5).map((action) => action.title),
            warnings: [],
          });
        }
        const gate = await platformStore.reserveAiBudget(a.tenantId, a.userId);
        try {
          const result = await getAIProvider({ taskType: "faculty_copilot", complexity: "medium", risk: "medium" }).runAcademicTask({
            taskType: "faculty_copilot",
            agent: "faculty_copilot",
            projectContext: {
              courses: courses.map((course) => ({ id: course.id, code: course.code, title: course.title, outcomes: course.outcomes, aiPolicy: course.aiPolicy })),
              assignments: assignments.map((assignment) => ({ id: assignment.id, courseId: assignment.courseId, title: assignment.title, status: assignment.status, deadline: assignment.deadline, outcomes: assignment.outcomes, rubric: assignment.rubric })),
              pulse: brief,
            },
            artifact: { module: "faculty", title: "Teacher request", content: query },
            platformInstruction: "Act as a teacher copilot. Use only the supplied course/assignment context. Give concrete pedagogical actions, identify missing alignment or policy details, and prefer questions requiring understanding over rote recall. Never invent student performance data, grades, sources, or submissions. If the requested evidence is not present, state that clearly.",
            learnerInstruction: query,
            policySummary: "Faculty planning and course-design assistance. No invented student analytics.",
          });
          await firestoreStore.recordAIUsage(result.usage, a, "faculty_copilot");
          res.json({ success: true, source: "ai", answer: result.output.summary, suggestions: [...result.output.findings, ...result.output.suggestions].slice(0, 8), warnings: result.output.warnings.slice(0, 6) });
        } finally {
          await platformStore.releaseAiBudgetReservation(gate.reservation);
        }
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/courses",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await assertFeature(a.tenantId, "ProfessorOS");
        const body = req.body || {};
        const code = cleanField(body.code, 50),
          title = cleanField(body.title, 220);
        if (!code || !title)
          return res.status(400).json({
            error: "Course code and title are required",
            code: "COURSE_REQUIRED",
          });
        const now = new Date().toISOString();
        const course: CourseRecord = {
          id: randomUUID(),
          tenantId: a.tenantId,
          ownerId: a.userId,
          code,
          title,
          term: cleanField(body.term, 100) || undefined,
          description: cleanField(body.description, 3000) || undefined,
          outcomes: cleanStringList(body.outcomes, 100, 500),
          aiPolicy: normalizeAcademicPolicy(body.aiPolicy),
          status: ["draft", "active", "archived"].includes(String(body.status))
            ? body.status
            : "draft",
          createdAt: now,
          updatedAt: now,
        };
        await firestoreStore.saveCourse(course, a.userId);
        res.status(201).json({ success: true, course });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/courses/:id",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await assertFeature(a.tenantId, "ProfessorOS");
        const course = await firestoreStore.getCourse(
          req.params.id,
          a.tenantId,
        );
        if (!course || !canReadCourse(a, course))
          return res
            .status(404)
            .json({ error: "Course not found", code: "COURSE_NOT_FOUND" });
        const assignments = await firestoreStore.listCourseAssignments(
          course.id,
          a.tenantId,
        );
        res.json({ success: true, course, assignments });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/courses/:id/archive",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          course = await firestoreStore.getCourse(req.params.id, a.tenantId);
        if (!course)
          return res
            .status(404)
            .json({ error: "Course not found", code: "COURSE_NOT_FOUND" });
        if (
          course.ownerId !== a.userId &&
          ![
            "department_admin",
            "college_admin",
            "university_admin",
            "admin",
            "superadmin",
            "root_owner",
          ].includes(a.role)
        )
          return res.status(403).json({
            error: "Course archive permission required",
            code: "FORBIDDEN",
          });
        const assignments = await firestoreStore.listCourseAssignments(
          course.id,
          a.tenantId,
        );
        const out = exportCourseArchive(course, assignments as any, { locale: String(req.query.locale || "en") });
        res.setHeader("Content-Type", out.contentType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(out.filename)}`,
        );
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "course.archive.export",
          course.id,
          undefined,
          { assignments: assignments.length },
        );
        res.send(out.data);
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/courses/:id/join-codes",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          course = await firestoreStore.getCourse(req.params.id, a.tenantId);
        if (!course)
          return res
            .status(404)
            .json({ error: "Course not found", code: "COURSE_NOT_FOUND" });
        if (
          course.ownerId !== a.userId &&
          ![
            "department_admin",
            "college_admin",
            "university_admin",
            "admin",
            "superadmin",
            "root_owner",
          ].includes(a.role)
        )
          return res.status(403).json({
            error:
              "Only the course owner or authorized administrator can manage join codes",
            code: "COURSE_OWNER_REQUIRED",
          });
        res.json({
          success: true,
          codes: await firestoreStore.listJoinCodes(course.id, a.tenantId),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/courses/:id/join-codes",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          course = await firestoreStore.getCourse(req.params.id, a.tenantId);
        if (!course)
          return res
            .status(404)
            .json({ error: "Course not found", code: "COURSE_NOT_FOUND" });
        if (
          course.ownerId !== a.userId &&
          ![
            "department_admin",
            "college_admin",
            "university_admin",
            "admin",
            "superadmin",
            "root_owner",
          ].includes(a.role)
        )
          return res.status(403).json({
            error:
              "Only the course owner or authorized administrator can manage join codes",
            code: "COURSE_OWNER_REQUIRED",
          });
        const maxUses = Math.min(
          10000,
          Math.max(1, Number(req.body?.maxUses || 100)),
        );
        const days = Math.min(
          365,
          Math.max(1, Number(req.body?.expiresInDays || 30)),
        );
        const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
        const created = await firestoreStore.createJoinCode(
          course.id,
          a.tenantId,
          a.userId,
          { maxUses, expiresAt },
        );
        res.status(201).json({
          success: true,
          code: created.record,
          secret: created.code,
          warning:
            "Join code is shown once. Regenerate it if it is lost or exposed.",
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/courses/:courseId/join-codes/:codeId/regenerate",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          course = await firestoreStore.getCourse(
            req.params.courseId,
            a.tenantId,
          );
        if (!course)
          return res
            .status(404)
            .json({ error: "Course not found", code: "COURSE_NOT_FOUND" });
        if (
          course.ownerId !== a.userId &&
          ![
            "department_admin",
            "college_admin",
            "university_admin",
            "admin",
            "superadmin",
            "root_owner",
          ].includes(a.role)
        )
          return res.status(403).json({
            error: "Course owner permission required",
            code: "COURSE_OWNER_REQUIRED",
          });
        await firestoreStore.revokeJoinCode(
          req.params.codeId,
          course.id,
          a.tenantId,
          a.userId,
        );
        const days = Math.min(
            365,
            Math.max(1, Number(req.body?.expiresInDays || 30)),
          ),
          maxUses = Math.min(
            10000,
            Math.max(1, Number(req.body?.maxUses || 100)),
          );
        const created = await firestoreStore.createJoinCode(
          course.id,
          a.tenantId,
          a.userId,
          {
            maxUses,
            expiresAt: new Date(Date.now() + days * 86400000).toISOString(),
          },
        );
        res
          .status(201)
          .json({ success: true, code: created.record, secret: created.code });
      } catch (e) {
        next(e);
      }
    },
  );
  app.delete(
    "/api/courses/:courseId/join-codes/:codeId",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          course = await firestoreStore.getCourse(
            req.params.courseId,
            a.tenantId,
          );
        if (!course)
          return res
            .status(404)
            .json({ error: "Course not found", code: "COURSE_NOT_FOUND" });
        if (
          course.ownerId !== a.userId &&
          ![
            "department_admin",
            "college_admin",
            "university_admin",
            "admin",
            "superadmin",
            "root_owner",
          ].includes(a.role)
        )
          return res.status(403).json({
            error: "Course owner permission required",
            code: "COURSE_OWNER_REQUIRED",
          });
        const ok = await firestoreStore.revokeJoinCode(
          req.params.codeId,
          course.id,
          a.tenantId,
          a.userId,
        );
        if (!ok)
          return res.status(404).json({
            error: "Join code not found",
            code: "JOIN_CODE_NOT_FOUND",
          });
        res.json({ success: true });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/enrollments/join",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const raw = cleanField(req.body?.code, 40);
        if (!raw)
          return res.status(400).json({
            error: "Join code is required",
            code: "JOIN_CODE_REQUIRED",
          });
        const a = req.actor!,
          enrollment = await firestoreStore.redeemJoinCode(
            raw,
            a.tenantId,
            a.userId,
          );
        res.status(201).json({ success: true, enrollment });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/courses/:id",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await assertFeature(a.tenantId, "ProfessorOS");
        const current = await firestoreStore.getCourse(
          req.params.id,
          a.tenantId,
        );
        if (!current || !canManageCourse(a, current))
          return res
            .status(404)
            .json({ error: "Course not found", code: "COURSE_NOT_FOUND" });
        const body = req.body || {};
        const course: CourseRecord = {
          ...current,
          code: cleanField(body.code, 50) || current.code,
          title: cleanField(body.title, 220) || current.title,
          term:
            body.term === null
              ? undefined
              : cleanField(body.term, 100) || current.term,
          description:
            body.description === null
              ? undefined
              : cleanField(body.description, 3000) || current.description,
          outcomes: Array.isArray(body.outcomes)
            ? cleanStringList(body.outcomes, 100, 500)
            : current.outcomes,
          aiPolicy: body.aiPolicy
            ? normalizeAcademicPolicy(body.aiPolicy)
            : current.aiPolicy,
          status: ["draft", "active", "archived"].includes(String(body.status))
            ? body.status
            : current.status,
          updatedAt: new Date().toISOString(),
        };
        await firestoreStore.saveCourse(course, a.userId);
        res.json({ success: true, course });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/courses/:id/clone",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await assertFeature(a.tenantId, "ProfessorOS");
        const source = await firestoreStore.getCourse(
          req.params.id,
          a.tenantId,
        );
        if (!source || !canReadCourse(a, source))
          return res
            .status(404)
            .json({ error: "Course not found", code: "COURSE_NOT_FOUND" });
        const now = new Date().toISOString();
        const clone: CourseRecord = {
          ...source,
          id: randomUUID(),
          ownerId: a.userId,
          code: cleanField(req.body?.code, 50) || `${source.code}-COPY`,
          title: cleanField(req.body?.title, 220) || `${source.title} — نسخة`,
          term: cleanField(req.body?.term, 100) || undefined,
          status: "draft",
          createdAt: now,
          updatedAt: now,
        };
        await firestoreStore.saveCourse(clone, a.userId);
        const sourceAssignments = await firestoreStore.listCourseAssignments(
          source.id,
          a.tenantId,
        );
        for (const old of sourceAssignments.slice(0, 100)) {
          const copied: CourseAssignmentRecord = {
            ...old,
            id: randomUUID(),
            courseId: clone.id,
            createdBy: a.userId,
            title: old.title,
            deadline: undefined,
            status: "draft",
            deliverables: old.deliverables.map((d) => ({
              ...d,
              id: randomUUID(),
            })),
            rubric: old.rubric.map((r) => ({ ...r, id: randomUUID() })),
            createdAt: now,
            updatedAt: now,
          };
          await firestoreStore.saveCourseAssignment(copied, a.userId);
        }
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "course.clone",
          clone.id,
          undefined,
          {
            sourceCourseId: source.id,
            assignmentCount: sourceAssignments.length,
          },
        );
        res.status(201).json({
          success: true,
          course: clone,
          copiedAssignments: Math.min(sourceAssignments.length, 100),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/courses/:id/assignments",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await assertFeature(a.tenantId, "ProfessorOS");
        const course = await firestoreStore.getCourse(
          req.params.id,
          a.tenantId,
        );
        if (!course || !canReadCourse(a, course))
          return res
            .status(404)
            .json({ error: "Course not found", code: "COURSE_NOT_FOUND" });
        const assignments = await firestoreStore.listCourseAssignments(
          req.params.id,
          a.tenantId,
        );
        res.json({ success: true, assignments });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/courses/:id/assignments",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await assertFeature(a.tenantId, "ProfessorOS");
        const course = await firestoreStore.getCourse(
          req.params.id,
          a.tenantId,
        );
        if (!course || !canManageCourse(a, course))
          return res
            .status(404)
            .json({ error: "Course not found", code: "COURSE_NOT_FOUND" });
        const body = req.body || {},
          title = cleanField(body.title, 260),
          instructions = cleanField(body.instructions, 20000);
        if (!title || !instructions)
          return res.status(400).json({
            error: "Assignment title and instructions are required",
            code: "ASSIGNMENT_REQUIRED",
          });
        const now = new Date().toISOString();
        const deliverables = (
          Array.isArray(body.deliverables) ? body.deliverables : []
        )
          .slice(0, 50)
          .map((d: any) => ({
            id: randomUUID(),
            title: cleanField(d?.title, 240) || "Deliverable",
            format: cleanField(d?.format, 180) || "Needs confirmation",
          }));
        const rubric = (Array.isArray(body.rubric) ? body.rubric : [])
          .slice(0, 100)
          .map((r: any) => ({
            id: randomUUID(),
            title: cleanField(r?.title, 220) || "Criterion",
            description: cleanField(r?.description, 1500),
            weighting: Math.min(100, Math.max(0, Number(r?.weighting) || 0)),
          }));
        const item: CourseAssignmentRecord = {
          id: randomUUID(),
          tenantId: a.tenantId,
          courseId: course.id,
          createdBy: a.userId,
          title,
          instructions,
          deadline: cleanField(body.deadline, 80) || undefined,
          deliverables,
          rubric,
          outcomes: cleanStringList(body.outcomes, 100, 500),
          aiPolicy: normalizeAcademicPolicy(body.aiPolicy || course.aiPolicy),
          groupMode: ["individual", "group", "either"].includes(
            String(body.groupMode),
          )
            ? body.groupMode
            : "individual",
          status: ["draft", "published", "archived"].includes(
            String(body.status),
          )
            ? body.status
            : "draft",
          createdAt: now,
          updatedAt: now,
        };
        await firestoreStore.saveCourseAssignment(item, a.userId);
        await recordProductEventSafe(a, "assignment_created", {
          courseId: course.id,
          properties: { status: item.status },
        });
        await emitWebhookSafe(a.tenantId, "assignment.created", {
          assignmentId: item.id,
          courseId: course.id,
          status: item.status,
        });
        res.status(201).json({ success: true, assignment: item });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/courses/:courseId/assignments/:assignmentId/clone",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await assertFeature(a.tenantId, "ProfessorOS");
        const course = await firestoreStore.getCourse(
            req.params.courseId,
            a.tenantId,
          ),
          source = await firestoreStore.getCourseAssignment(
            req.params.assignmentId,
            req.params.courseId,
            a.tenantId,
          );
        if (!course || !source || !canManageCourse(a, course))
          return res.status(404).json({
            error: "Assignment not found",
            code: "ASSIGNMENT_NOT_FOUND",
          });
        const now = new Date().toISOString();
        const item: CourseAssignmentRecord = {
          ...source,
          id: randomUUID(),
          createdBy: a.userId,
          title: cleanField(req.body?.title, 260) || `${source.title} — نسخة`,
          deadline: undefined,
          status: "draft",
          deliverables: source.deliverables.map((d) => ({
            ...d,
            id: randomUUID(),
          })),
          rubric: source.rubric.map((r) => ({ ...r, id: randomUUID() })),
          createdAt: now,
          updatedAt: now,
        };
        await firestoreStore.saveCourseAssignment(item, a.userId);
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "assignment.clone",
          item.id,
          undefined,
          { sourceAssignmentId: source.id, courseId: source.courseId },
        );
        res.status(201).json({ success: true, assignment: item });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/courses/:courseId/assignments/:assignmentId/quality",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await assertFeature(a.tenantId, "ProfessorOS");
        const course = await firestoreStore.getCourse(
            req.params.courseId,
            a.tenantId,
          ),
          item = await firestoreStore.getCourseAssignment(
            req.params.assignmentId,
            req.params.courseId,
            a.tenantId,
          );
        if (!course || !item || !canReadCourse(a, course))
          return res.status(404).json({
            error: "Assignment not found",
            code: "ASSIGNMENT_NOT_FOUND",
          });
        const weight = item.rubric.reduce((sum, r) => sum + r.weighting, 0);
        const checks = [
          {
            id: "instructions",
            label: "وضوح التعليمات",
            status: item.instructions.trim().length >= 120 ? "pass" : "warning",
            detail:
              item.instructions.trim().length >= 120
                ? "التعليمات تحتوي تفاصيل كافية مبدئيًا."
                : "التعليمات قصيرة؛ وضّح المطلوب والحدود وطريقة التسليم.",
          },
          {
            id: "deliverables",
            label: "المخرجات",
            status: item.deliverables.length ? "pass" : "critical",
            detail: item.deliverables.length
              ? `${item.deliverables.length} مخرجات محددة.`
              : "لا توجد Deliverables محددة.",
          },
          {
            id: "rubric",
            label: "Rubric",
            status:
              item.rubric.length && Math.abs(weight - 100) < 0.01
                ? "pass"
                : item.rubric.length
                  ? "warning"
                  : "critical",
            detail: !item.rubric.length
              ? "لا يوجد Rubric."
              : `مجموع الأوزان ${weight}%.`,
          },
          {
            id: "outcomes",
            label: "Outcome mapping",
            status: item.outcomes.length ? "pass" : "warning",
            detail: item.outcomes.length
              ? `${item.outcomes.length} outcomes مرتبطة.`
              : "لم تُربط مخرجات تعلم بهذا التكليف.",
          },
          {
            id: "policy",
            label: "AI Policy",
            status: item.aiPolicy.needsConfirmation ? "warning" : "pass",
            detail: item.aiPolicy.needsConfirmation
              ? "سياسة AI تحتاج تأكيدًا قبل النشر."
              : `سياسة AI محددة عند Level ${item.aiPolicy.level}.`,
          },
          {
            id: "deadline",
            label: "الموعد",
            status: item.deadline ? "pass" : "warning",
            detail: item.deadline ? "الموعد محدد." : "لم يحدد موعد نهائي بعد.",
          },
        ];
        const critical = checks.filter((c) => c.status === "critical").length,
          warning = checks.filter((c) => c.status === "warning").length;
        res.json({
          success: true,
          quality: {
            status: critical ? "critical" : warning ? "attention" : "ready",
            checks,
          },
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/courses/:courseId/assignments/:assignmentId",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await assertFeature(a.tenantId, "ProfessorOS");
        const course = await firestoreStore.getCourse(
            req.params.courseId,
            a.tenantId,
          ),
          current = await firestoreStore.getCourseAssignment(
            req.params.assignmentId,
            req.params.courseId,
            a.tenantId,
          );
        if (!course || !current || !canManageCourse(a, course))
          return res.status(404).json({
            error: "Assignment not found",
            code: "ASSIGNMENT_NOT_FOUND",
          });
        const body = req.body || {};
        const item: CourseAssignmentRecord = {
          ...current,
          title: cleanField(body.title, 260) || current.title,
          instructions:
            cleanField(body.instructions, 20000) || current.instructions,
          deadline:
            body.deadline === null
              ? undefined
              : cleanField(body.deadline, 80) || current.deadline,
          outcomes: Array.isArray(body.outcomes)
            ? cleanStringList(body.outcomes, 100, 500)
            : current.outcomes,
          aiPolicy: body.aiPolicy
            ? normalizeAcademicPolicy(body.aiPolicy)
            : current.aiPolicy,
          groupMode: ["individual", "group", "either"].includes(
            String(body.groupMode),
          )
            ? body.groupMode
            : current.groupMode,
          status: ["draft", "published", "archived"].includes(
            String(body.status),
          )
            ? body.status
            : current.status,
          updatedAt: new Date().toISOString(),
        };
        await firestoreStore.saveCourseAssignment(item, a.userId);
        res.json({ success: true, assignment: item });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/courses/:courseId/assignments/:assignmentId/submissions",
    authenticate,
    requireRoles("student", "student_group_leader"),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          courseId = cleanField(req.params.courseId, 180),
          assignmentId = cleanField(req.params.assignmentId, 180),
          projectId = cleanField(req.body?.projectId, 180);
        if (!projectId)
          return res
            .status(400)
            .json({ error: "projectId is required", code: "PROJECT_REQUIRED" });
        const [course, assignment, enrollment, project] = await Promise.all([
          firestoreStore.getCourse(courseId, a.tenantId),
          firestoreStore.getCourseAssignment(
            assignmentId,
            courseId,
            a.tenantId,
          ),
          firestoreStore.getCourseEnrollment(courseId, a.userId, a.tenantId),
          firestoreStore.getProject(projectId, a.userId, a.tenantId),
        ]);
        if (!course || !assignment || assignment.status !== "published")
          return res.status(404).json({
            error: "Published assignment not found",
            code: "PUBLISHED_ASSIGNMENT_NOT_FOUND",
          });
        if (!enrollment)
          return res.status(403).json({
            error: "Active course enrollment is required",
            code: "COURSE_ENROLLMENT_REQUIRED",
          });
        if (!project || project.userId !== a.userId)
          return res.status(404).json({
            error: "Owned project not found",
            code: "PROJECT_NOT_FOUND",
          });
        if (
          project.aiPolicy.courseId !== courseId ||
          project.aiPolicy.assignmentId !== assignmentId ||
          project.aiPolicy.provenance !== "published_assignment"
        )
          return res.status(409).json({
            error:
              "This project is not linked to the authoritative published assignment. Recompile it from CourseOS before submission.",
            code: "PROJECT_ASSIGNMENT_MISMATCH",
          });
        const [artifacts, evidence] = await Promise.all([
            firestoreStore.listWorkspaceArtifacts(project.id, a.tenantId),
            firestoreStore.listProjectEvidence(
              project.id,
              a.userId,
              a.tenantId,
            ),
          ]),
          audit = runSubmissionAudit(project, { artifacts, evidence });
        if (audit.blockingIssues)
          return res.status(422).json({
            error: `Submission blocked by ${audit.blockingIssues} critical readiness issue(s)`,
            code: "SUBMISSION_BLOCKED",
            audit,
          });
        if (audit.warnings && !Boolean(req.body?.confirmWarnings))
          return res.status(409).json({
            error:
              "Review and explicitly confirm the non-blocking warnings before submission",
            code: "SUBMISSION_WARNING_CONFIRMATION_REQUIRED",
            audit,
          });
        await firestoreStore.saveAudit(audit, project, a.userId);
        const draft: CourseSubmissionRecord = {
          id: "",
          tenantId: a.tenantId,
          courseId,
          assignmentId,
          projectId: project.id,
          studentId: a.userId,
          studentName: a.displayName,
          attempt: 0,
          status: "submitted",
          submittedAt: "",
          receiptHash: "",
          projectRevision: Number(project.revision || 1),
          audit,
          snapshot: {
            projectTitle: project.title,
            deliverables: project.deliverables.map((d) => ({
              id: d.id,
              title: d.title,
              format: d.format,
              status: d.status,
              ...(d.fileId ? { fileId: d.fileId } : {}),
            })),
            artifactIds: artifacts.map((x) => x.id),
            evidenceIds: evidence.map((x) => x.id),
          },
          rubricGrades: [],
          updatedAt: "",
        };
        const submission = await firestoreStore.createCourseSubmission(draft);
        await createNotification({
          tenantId: a.tenantId,
          userId: course.ownerId,
          type: "assignment",
          priority: "important",
          title: `تسليم جديد: ${assignment.title}`,
          body: `${a.displayName} سلّم المحاولة ${submission.attempt}. إيصال ${submission.receiptHash.slice(0, 12)}.`,
          targetPath: `/app/course/${courseId}/assignment/${assignmentId}/submissions`,
          channels: ["in_app"],
        });
        await emitWebhookSafe(a.tenantId, "submission.created", {
          submissionId: submission.id,
          courseId,
          assignmentId,
          projectId: project.id,
          studentId: a.userId,
          attempt: submission.attempt,
          receiptHash: submission.receiptHash,
        });
        res.status(201).json({ success: true, submission });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:projectId/submission",
    authenticate,
    requireRoles("student", "student_group_leader"),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          submission = await firestoreStore.getProjectSubmission(
            req.params.projectId,
            a.userId,
            a.tenantId,
          );
        res.json({ success: true, submission });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/my/submissions",
    authenticate,
    requireRoles("student", "student_group_leader"),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          submissions = await firestoreStore.listStudentSubmissions(
            a.userId,
            a.tenantId,
          );
        res.json({ success: true, submissions });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/courses/:courseId/assignments/:assignmentId/submissions",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          course = await firestoreStore.getCourse(
            req.params.courseId,
            a.tenantId,
          ),
          assignment = await firestoreStore.getCourseAssignment(
            req.params.assignmentId,
            req.params.courseId,
            a.tenantId,
          );
        if (!course || !assignment || !canReadCourse(a, course))
          return res.status(404).json({
            error: "Assignment not found",
            code: "ASSIGNMENT_NOT_FOUND",
          });
        const submissions = await firestoreStore.listAssignmentSubmissions(
          course.id,
          assignment.id,
          a.tenantId,
        );
        res.json({ success: true, course, assignment, submissions });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/courses/:courseId/assignments/:assignmentId/submissions/:submissionId/grade",
    authenticate,
    requireRoles(...FACULTY_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          course = await firestoreStore.getCourse(
            req.params.courseId,
            a.tenantId,
          ),
          assignment = await firestoreStore.getCourseAssignment(
            req.params.assignmentId,
            req.params.courseId,
            a.tenantId,
          );
        if (!course || !assignment || !canReadCourse(a, course))
          return res.status(404).json({
            error: "Assignment not found",
            code: "ASSIGNMENT_NOT_FOUND",
          });
        const current = (
          await firestoreStore.listAssignmentSubmissions(
            course.id,
            assignment.id,
            a.tenantId,
          )
        ).find((x) => x.id === req.params.submissionId);
        if (!current)
          return res.status(404).json({
            error: "Submission not found",
            code: "SUBMISSION_NOT_FOUND",
          });
        if (current.status === "released")
          return res.status(409).json({
            error:
              "Released grades are immutable. Use the formal grade amendment workflow.",
            code: "GRADE_RELEASED",
          });
        const requested = String(req.body?.status || "graded");
        if (!["returned", "grading", "graded", "released"].includes(requested))
          return res.status(400).json({
            error: "Invalid grading status",
            code: "GRADE_STATUS_INVALID",
          });
        const feedback = cleanField(req.body?.feedback, 8000) || undefined,
          at = new Date().toISOString();
        let patch: Parameters<typeof firestoreStore.gradeCourseSubmission>[3];
        if (requested === "returned") {
          const returnedReason = cleanField(req.body?.returnedReason, 3000);
          if (!returnedReason)
            return res.status(400).json({
              error: "A return reason is required",
              code: "RETURN_REASON_REQUIRED",
            });
          patch = {
            status: "returned",
            rubricGrades: current.rubricGrades || [],
            returnedReason,
            ...(feedback ? { feedback } : {}),
            gradedBy: a.userId,
            gradedAt: at,
          };
        } else {
          const normalized = normalizeRubricGrades(
            assignment,
            req.body?.rubricGrades,
          );
          patch = {
            status: requested as "grading" | "graded" | "released",
            ...normalized,
            ...(feedback ? { feedback } : {}),
            gradedBy: a.userId,
            gradedAt: at,
            ...(requested === "released" ? { releasedAt: at } : {}),
          };
        }
        const submission = await firestoreStore.gradeCourseSubmission(
          current.id,
          a.tenantId,
          a.userId,
          patch,
        );
        if (["returned", "released"].includes(submission.status))
          await createNotification({
            tenantId: a.tenantId,
            userId: submission.studentId,
            type: "assignment",
            priority: "important",
            title:
              submission.status === "released"
                ? `تم نشر درجة ${assignment.title}`
                : `أُعيد ${assignment.title} للمراجعة`,
            body:
              submission.status === "released"
                ? `درجتك ${submission.totalScore}/${submission.maxScore}. افتح الإيصال والتغذية الراجعة.`
                : submission.returnedReason ||
                  "راجع ملاحظات المعلم ثم أعد التسليم.",
            targetPath: `/app/project/${submission.projectId}`,
            channels: ["in_app"],
          });
        await emitWebhookSafe(a.tenantId, "submission.graded", {
          submissionId: submission.id,
          status: submission.status,
          totalScore: submission.totalScore,
          maxScore: submission.maxScore,
          releasedAt: submission.releasedAt,
        });
        res.json({ success: true, submission });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/support/tickets",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const tickets = await firestoreStore.listMySupportTickets(
          a.userId,
          a.tenantId,
        );
        res.json({ success: true, tickets });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/support/tickets",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          subject = cleanField(req.body?.subject, 240),
          message = cleanField(req.body?.message, 8000),
          category = String(req.body?.category || "other"),
          priority = String(req.body?.priority || "normal");
        if (!subject || !message)
          return res.status(400).json({
            error: "Subject and message are required",
            code: "SUPPORT_REQUIRED",
          });
        const categories = new Set([
            "account",
            "academic",
            "billing",
            "technical",
            "security",
            "other",
          ]),
          priorities = new Set(["normal", "important", "critical"]);
        const now = new Date().toISOString();
        const ticket: SupportTicket = {
          id: randomUUID(),
          tenantId: a.tenantId,
          userId: a.userId,
          displayName: a.displayName,
          email: a.email,
          category: (categories.has(category)
            ? category
            : "other") as SupportTicket["category"],
          priority: (priorities.has(priority)
            ? priority
            : "normal") as SupportTicket["priority"],
          subject,
          message,
          status: "open",
          createdAt: now,
          updatedAt: now,
        };
        await firestoreStore.saveSupportTicket(ticket, a.userId);
        res.status(201).json({ success: true, ticket });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/admin/support/tickets",
    authenticate,
    requireRoles(...SUPPORT_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const tickets = await firestoreStore.listTenantSupportTickets(
          a.tenantId,
        );
        res.json({ success: true, tickets });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/admin/support/tickets/:id",
    authenticate,
    requireRoles(...SUPPORT_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          current = await firestoreStore.getSupportTicket(
            req.params.id,
            a.tenantId,
          );
        if (!current)
          return res
            .status(404)
            .json({ error: "Ticket not found", code: "TICKET_NOT_FOUND" });
        const statuses = new Set(["open", "in_progress", "resolved", "closed"]);
        const status = String(req.body?.status || current.status);
        const ticket: SupportTicket = {
          ...current,
          status: (statuses.has(status)
            ? status
            : current.status) as SupportTicket["status"],
          assignedTo:
            req.body?.assignedTo === null
              ? undefined
              : cleanField(req.body?.assignedTo, 160) || current.assignedTo,
          updatedAt: new Date().toISOString(),
        };
        await firestoreStore.saveSupportTicket(ticket, a.userId);
        res.json({ success: true, ticket });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/security/revoke-sessions",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await getAuth().revokeRefreshTokens(a.userId);
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "security.sessions.revoke_all",
          a.userId,
          "User requested sign-out from all sessions",
        );
        res.json({ success: true, revokedAt: new Date().toISOString() });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/profile",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const profile = await firestoreStore.getProfile(
          a.userId,
          a.tenantId,
          a,
        );
        res.json({ success: true, profile });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/profile",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const current = await firestoreStore.getProfile(
          a.userId,
          a.tenantId,
          a,
        );
        const body = req.body || {};
        const cleanString = (value: unknown, max = 160) =>
          typeof value === "string" ? value.trim().slice(0, max) : undefined;
        const courses = Array.isArray(body.courses)
          ? (body.courses
              .map((v: unknown) => cleanString(v, 120))
              .filter(Boolean)
              .slice(0, 30) as string[])
          : current.courses;
        const profile: UserProfile = {
          ...current,
          userId: a.userId,
          tenantId: a.tenantId,
          email: a.email || current.email,
          displayName:
            cleanString(body.displayName, 120) || current.displayName,
          language: ["ar", "en", "tr", "zh", "hi", "es", "fr", "ur"].includes(String(body.language || ""))
            ? (body.language as UserProfile["language"])
            : current.language,
          country: cleanString(body.country, 80) ?? current.country,
          university: cleanString(body.university, 160) ?? current.university,
          specialization:
            cleanString(body.specialization, 160) ?? current.specialization,
          studyYear: cleanString(body.studyYear, 80) ?? current.studyYear,
          academicTerm:
            cleanString(body.academicTerm, 100) ?? current.academicTerm,
          timezone: cleanString(body.timezone, 80) ?? current.timezone,
          dailyStudyMinutes:
            body.dailyStudyMinutes === undefined
              ? current.dailyStudyMinutes
              : Math.min(
                  720,
                  Math.max(
                    30,
                    Math.round(Number(body.dailyStudyMinutes) || 150),
                  ),
                ),
          courses,
          passportProjectIds: Array.isArray(body.passportProjectIds)
            ? cleanStringList(body.passportProjectIds, 100, 180)
            : current.passportProjectIds,
          passportVisibility: [
            "private",
            "institution",
            "shared_link",
            "public",
          ].includes(String(body.passportVisibility))
            ? body.passportVisibility
            : current.passportVisibility,
          onboardingCompleted:
            body.onboardingCompleted === true
              ? true
              : current.onboardingCompleted,
          updatedAt: new Date().toISOString(),
        };
        await firestoreStore.saveProfile(profile, a.userId);
        res.json({ success: true, profile });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/original",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const original = project.originalAssignment;
        if (!original)
          return res.status(404).json({
            error: "Original assignment is not available",
            code: "ORIGINAL_NOT_AVAILABLE",
          });
        const sourceFiles = original.attachments?.length
          ? original.attachments
          : original.fileName
            ? [
                {
                  fileName: original.fileName,
                  fileType: original.fileType,
                  storagePath: original.storagePath,
                },
              ]
            : [];
        const files = await Promise.all(
          sourceFiles.map(async (file) => ({
            fileName: file.fileName,
            fileType: file.fileType,
            size: "size" in file ? file.size : undefined,
            sha256: "sha256" in file ? file.sha256 : undefined,
            url: file.storagePath
              ? await getOriginalFileUrl(file.storagePath, a.tenantId, a.userId)
              : undefined,
          })),
        );
        res.json({
          success: true,
          text: original.text,
          files,
          expiresInSeconds: files.some((f) => f.url) ? 900 : undefined,
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/export",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await assertFeature(a.tenantId, "ProjectExport");
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const format = String(req.query.format || "zip").toLowerCase();
        if (format !== "json") {
          const access = await platformStore.projectEntitlementAccess(
            a.tenantId,
            a.userId,
            project.id,
          );
          if (!access.canExport)
            return res.status(402).json({
              error: "التصدير بصيغة التسليم متاح بعد فتح المشروع الكامل.",
              code: "PROJECT_EXPORT_PAYMENT_REQUIRED",
              access,
            });
        }
        const workspaceArtifacts = await firestoreStore.listWorkspaceArtifacts(
          project.id,
          a.tenantId,
        );
        const [brandRecords, profile] = await Promise.all([
          platformStore.list("brandConfig", a.tenantId, { limit: 20 }),
          firestoreStore.getProfile(a.userId, a.tenantId, { displayName: a.displayName, email: a.email }),
        ]);
        const brandRecord = brandRecords.find((x) => x.status === "active" && !x.deletedAt);
        const branding = {
          institutionName:
            cleanField(
              brandRecord?.data?.institutionName || brandRecord?.title,
              160,
            ) || undefined,
          footer: cleanField(brandRecord?.data?.footer, 500) || undefined,
          locale: cleanField(project.language || profile?.language || "en", 24) || "en",
        };
        if (format === "pdf") {
          if (!externalServices.pdf.configured())
            return res.status(503).json({
              error:
                "PDF export is disabled until the isolated renderer credentials are configured.",
              code: "PDF_RENDER_NOT_CONFIGURED",
            });
          const safe =
            project.title.replace(/[^\p{L}\p{N}._ -]+/gu, "_").slice(0, 80) ||
            "AcademicOS-project";
          const data = await externalServices.pdf.render({
            html: projectExportHtml(project, workspaceArtifacts, branding),
            filename: `${safe}.pdf`,
          });
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename*=UTF-8''${encodeURIComponent(`${safe}.pdf`)}`,
          );
          res.setHeader("Cache-Control", "private, no-store");
          await firestoreStore.writeAudit(
            a.tenantId,
            a.userId,
            "project.export",
            project.id,
            undefined,
            { format: "pdf" },
          );
          return res.send(data);
        }
        const exported = exportProject(
          project,
          format,
          workspaceArtifacts,
          branding,
        );
        res.setHeader("Content-Type", exported.contentType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(exported.filename)}`,
        );
        res.setHeader("Cache-Control", "private, no-store");
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "project.export",
          project.id,
          undefined,
          { format },
        );
        res.send(exported.data);
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/projects/compile",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      let persistedJobId = "";
      let actorForJob: AuthenticatedRequest["actor"];
      try {
        const intake = req.body as AssignmentIntake;
        const incomingFiles = (
          Array.isArray(intake?.files) && intake.files.length
            ? intake.files
            : intake?.file
              ? [intake.file]
              : []
        ) as IncomingFile[];
        if (!intake?.textContext?.trim() && !incomingFiles.length)
          return res.status(400).json({
            error: "Provide assignment text or at least one file",
            code: "ASSIGNMENT_REQUIRED",
          });
        if (incomingFiles.length > MAX_ASSIGNMENT_FILES)
          return res.status(413).json({
            error: `A maximum of ${MAX_ASSIGNMENT_FILES} files can be compiled together`,
            code: "TOO_MANY_FILES",
          });
        incomingFiles.forEach(validateFile);
        const totalBytes = incomingFiles.reduce((sum, f) => sum + f.size, 0);
        if (totalBytes > MAX_TOTAL_FILE_BYTES)
          return res.status(413).json({
            error: `Combined file size exceeds ${Math.round(MAX_TOTAL_FILE_BYTES / 1024 / 1024)} MB`,
            code: "TOTAL_FILES_TOO_LARGE",
          });
        if (incomingFiles.length) {
          if (
            process.env.REQUIRE_VIRUS_SCAN === "true" &&
            !externalServices.virusScan.configured()
          )
            return res.status(503).json({
              error:
                "Malware scanning is required but the isolated scanner is not configured.",
              code: "VIRUS_SCAN_REQUIRED",
            });
          if (externalServices.virusScan.configured())
            for (const file of incomingFiles) {
              const result: any = await externalServices.virusScan.run({
                name: file.name,
                mimeType: file.mimeType,
                size: file.size,
                sha256: createHash("sha256")
                  .update(Buffer.from(file.base64, "base64"))
                  .digest("hex"),
                base64: file.base64,
              });
              if (result?.clean !== true)
                throw Object.assign(
                  new Error(`Upload blocked by malware scanner: ${file.name}`),
                  { status: 422, code: "MALWARE_DETECTED" },
                );
            }
        }
        const a = req.actor!;
        actorForJob = a;
        const intakeHash = createHash("sha256")
          .update(
            JSON.stringify({
              text: intake.textContext || "",
              files: incomingFiles.map((f) => ({
                name: f.name,
                size: f.size,
                mimeType: f.mimeType,
                sha256: createHash("sha256")
                  .update(Buffer.from(f.base64, "base64"))
                  .digest("hex"),
              })),
            }),
          )
          .digest("hex");
        const idempotencyKey =
          cleanField(req.header("Idempotency-Key"), 180) || intakeHash;
        const stages: any[] = [
          {
            key: "reading",
            label: "Reading and OCR verification…",
            state: "running",
            at: new Date().toISOString(),
          },
          {
            key: "deliverables",
            label: "Detecting deliverables…",
            state: "pending",
          },
          { key: "rubric", label: "Mapping rubric…", state: "pending" },
          { key: "workspace", label: "Building workspace…", state: "pending" },
        ];
        const job: JobRecord = await platformStore.createJob({
          tenantId: a.tenantId,
          userId: a.userId,
          type: "assignment_compile",
          state: "running",
          progress: 5,
          stages,
          idempotencyKey,
          inputHash: intakeHash,
        });
        persistedJobId = job.id;
        if (job.state === "completed" && job.resultRef) {
          const existing = await firestoreStore.getProject(
            job.resultRef,
            a.userId,
            a.tenantId,
          );
          if (existing)
            return res
              .status(200)
              .json({ success: true, project: existing, job });
        }
        await recordProductEventSafe(a, "assignment_uploaded", {
          properties: { files: incomingFiles.length, bytes: totalBytes },
        });
        const extractedParts = intake.textContext?.trim()
          ? [intake.textContext.trim().slice(0, 120000)]
          : [];
        const extractionBudget = createExtractionBudget();
        const attachments: Array<{
          fileName: string;
          fileType?: string;
          storagePath?: string;
          size?: number;
          sha256?: string;
          extraction?: OcrExtractionRecord;
        }> = [];
        const filesForAI: IncomingFile[] = [];
        for (const file of incomingFiles) {
          const extracted = extractFileText(file, extractionBudget);
          if (!extracted.text && !extracted.multimodal)
            throw Object.assign(
              new Error(
                `Unsupported or unreadable assignment file: ${file.name}`,
              ),
              { status: 415, code: "UNSUPPORTED_FILE_TYPE" },
            );
          let extraction: OcrExtractionRecord | undefined;
          if (extracted.text) {
            extractedParts.push(`--- ${file.name} ---\n${extracted.text}`);
            extraction = {
              mode: "native_text",
              provider: "AcademicOS native parser",
              needsReview: false,
              warnings: [],
              extractedCharacters: extracted.text.length,
            };
          }
          if (extracted.multimodal) {
            filesForAI.push(file);
            const ocr = await runOcr(file);
            if (ocr) {
              extractedParts.push(
                `--- ${file.name} (verified OCR) ---\n${ocr.text}`,
              );
              extraction = ocr.extraction;
            } else {
              extraction = {
                mode: "multimodal_ai",
                provider: "configured AI gateway",
                needsReview: true,
                warnings: [
                  "Dedicated OCR verification is not configured; compare extracted requirements with the original document before relying on them.",
                ],
              };
            }
          }
          attachments.push({
            fileName: file.name,
            fileType: file.mimeType,
            size: file.size,
            sha256: createHash("sha256")
              .update(Buffer.from(file.base64, "base64"))
              .digest("hex"),
            extraction,
          });
        }
        const extractedText = extractedParts.join("\n\n").slice(0, 240000);
        stages[0] = {
          ...stages[0],
          state: "completed",
          at: new Date().toISOString(),
        };
        stages[1] = {
          ...stages[1],
          state: "running",
          at: new Date().toISOString(),
        };
        await platformStore.updateJob(job.id, a.tenantId, {
          progress: 25,
          stages,
        });
        let parsed;
        let compiledWithNativeFallback = false;
        const aiReady = aiConfigured({ complexity: "high", risk: "high" });
        if (!aiReady && !filesForAI.length && extractedText.trim()) {
          // شبكة أمان: لا مزوّد AI مُهيّأ — استخدم المُجمِّع المحلي الحتمي بدل رفض الطالب.
          // يعمل فقط على النص (لا صور/ملفات تحتاج نموذجًا متعدد الوسائط)، وكل الحقول تُوسم needs_confirmation.
          parsed = compileAssignmentNative({
            text: extractedText,
            timezone: intake.timezone,
          });
          compiledWithNativeFallback = true;
          (parsed as any).__aiUsage = undefined;
        } else {
          const gate = await platformStore.reserveAiBudget(
            a.tenantId,
            a.userId,
          );
          let aiResult;
          try {
            aiResult = await getAIProvider({
              complexity: "high",
              risk: "high",
              requiredModality: filesForAI.length ? "multimodal" : "text",
            }).compileAssignment({
              text: extractedText,
              files: filesForAI,
              timezone: intake.timezone,
            });
          } finally {
            await platformStore.releaseAiBudgetReservation(gate.reservation);
          }
          parsed = aiResult.output;
          (parsed as any).__aiUsage = aiResult.usage;
        }
        {
          const courseId = cleanField(intake.courseId, 180),
            assignmentId = cleanField(intake.assignmentId, 180);
          if (Boolean(courseId) !== Boolean(assignmentId))
            throw Object.assign(
              new Error(
                "Both courseId and assignmentId are required for an authoritative course policy",
              ),
              { status: 400, code: "ASSIGNMENT_POLICY_REFERENCE_REQUIRED" },
            );
          if (courseId && assignmentId) {
            const [course, assignment, enrollment] = await Promise.all([
              firestoreStore.getCourse(courseId, a.tenantId),
              firestoreStore.getCourseAssignment(
                assignmentId,
                courseId,
                a.tenantId,
              ),
              firestoreStore.getCourseEnrollment(
                courseId,
                a.userId,
                a.tenantId,
              ),
            ]);
            if (!course || !assignment || assignment.status !== "published")
              throw Object.assign(
                new Error("Published course assignment not found"),
                { status: 404, code: "PUBLISHED_ASSIGNMENT_NOT_FOUND" },
              );
            if (!enrollment && !canManageCourse(a, course))
              throw Object.assign(
                new Error(
                  "Active course enrollment is required for this assignment",
                ),
                { status: 403, code: "COURSE_ENROLLMENT_REQUIRED" },
              );
            parsed.aiPolicy = {
              ...normalizeAcademicPolicy(assignment.aiPolicy),
              needsConfirmation: false,
              provenance: "published_assignment",
              courseId,
              assignmentId,
            };
          } else {
            const extracted = normalizeAcademicPolicy(parsed.aiPolicy);
            parsed.aiPolicy = {
              ...extracted,
              level: 0,
              allowed: [],
              needsConfirmation: true,
              provenance: "extracted_unverified",
              summary: `سياسة غير موثقة بعد — ${extracted.summary}`,
            };
          }
        }
        stages[1] = {
          ...stages[1],
          state: "completed",
          at: new Date().toISOString(),
        };
        stages[2] = {
          ...stages[2],
          state: "running",
          at: new Date().toISOString(),
        };
        await platformStore.updateJob(job.id, a.tenantId, {
          progress: 55,
          stages,
        });
        await recordProductEventSafe(a, "assignment_parsed");
        const aiUsage = (parsed as any).__aiUsage;
        delete (parsed as any).__aiUsage;
        if (incomingFiles.length)
          for (let i = 0; i < incomingFiles.length; i += 1)
            attachments[i].storagePath = await storeOriginalFile(
              incomingFiles[i],
              a.tenantId,
              a.userId,
            );
        const project = buildProjectDNA(
          parsed,
          { userId: a.userId, tenantId: a.tenantId },
          {
            text: extractedText ? extractedText.slice(0, 120000) : undefined,
            fileName: attachments[0]?.fileName,
            fileType: attachments[0]?.fileType,
            storagePath: attachments[0]?.storagePath,
            attachments,
          },
        );
        stages[2] = {
          ...stages[2],
          state: "completed",
          at: new Date().toISOString(),
        };
        stages[3] = {
          ...stages[3],
          state: "running",
          at: new Date().toISOString(),
        };
        await platformStore.updateJob(job.id, a.tenantId, {
          progress: 80,
          stages,
        });
        {
          await firestoreStore.saveProject(project);
          if (aiUsage)
            await firestoreStore.recordAIUsage(aiUsage, a, project.id);
        }
        stages[3] = {
          ...stages[3],
          state: "completed",
          at: new Date().toISOString(),
        };
        const finished = await platformStore.updateJob(job.id, a.tenantId, {
          state: "completed",
          progress: 100,
          stages,
          resultRef: project.id,
        });
        await recordProductEventSafe(a, "workspace_created", {
          projectId: project.id,
        });
        await recordProductEventSafe(a, "project_started", {
          projectId: project.id,
        });
        await emitWebhookSafe(a.tenantId, "project.created", {
          projectId: project.id,
          title: project.title,
          userId: a.userId,
        });
        res.status(201).json({
          success: true,
          project,
          job: finished,
          compiler: compiledWithNativeFallback ? "native_fallback" : "ai",
          ...(compiledWithNativeFallback
            ? {
                notice:
                  "لا يوجد مزوّد ذكاء اصطناعي مُهيّأ؛ تم التحليل بالمُجمِّع المحلي الحتمي. راجع كل الحقول قبل الاعتماد.",
              }
            : {}),
        });
      } catch (e: any) {
        if (persistedJobId && actorForJob)
          try {
            await platformStore.updateJob(
              persistedJobId,
              actorForJob.tenantId,
              {
                state: "failed",
                error: cleanField(e?.message, 500) || "Compilation failed",
              },
            );
          } catch {}
        next(e);
      }
    },
  );
  app.post(
    "/api/projects/:id/assist",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          project = await firestoreStore.getProject(
            req.params.id,
            a.userId,
            a.tenantId,
          );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const module = cleanField(req.body?.module, 40).toLowerCase();
        if (!Object.hasOwn(FACULTY_TASKS, module))
          return res.status(400).json({
            error: "This workspace has no AI Faculty action",
            code: "AI_TASK_UNSUPPORTED",
          });
        const task = FACULTY_TASKS[module];
        const title = cleanField(req.body?.title, 300),
          content = cleanField(req.body?.content, 24000),
          instruction = cleanField(req.body?.instruction, 1200);
        if (!title && !content)
          return res.status(400).json({
            error:
              "Add learner-authored work before requesting contextual review",
            code: "AI_REVIEW_INPUT_REQUIRED",
          });
        const policyBlock = facultyPolicyBlock(project, module, title, content);
        if (policyBlock)
          return res.status(403).json({
            error: policyBlock,
            code: "AI_POLICY_BLOCKED",
            policy: {
              level: project.aiPolicy.level,
              summary: project.aiPolicy.summary,
            },
          });
        const provider = getAIProvider({
          taskType: task.taskType,
          complexity: project.complexity,
          risk:
            module === "lab" || module === "engineering" ? "high" : "medium",
          requiredModality: "text",
        });
        const gate = await platformStore.reserveAiBudget(a.tenantId, a.userId);
        let result;
        try {
          result = await provider.runAcademicTask({
            taskType: task.taskType,
            agent: task.agent,
            projectContext: facultyProjectContext(project),
            artifact: { module, title, content },
            platformInstruction: task.instruction,
            learnerInstruction: instruction,
            policySummary: `Level ${project.aiPolicy.level}. ${project.aiPolicy.summary} Allowed: ${(project.aiPolicy.allowed || []).join("; ") || "not specified"}. Prohibited: ${(project.aiPolicy.prohibited || []).join("; ") || "none specified"}. Disclosure required: ${project.aiPolicy.disclosureRequired ? "yes" : "no"}.`,
          });
        } finally {
          await platformStore.releaseAiBudgetReservation(gate.reservation);
        }
        const runId = await firestoreStore.recordAIUsage(
          result.usage,
          a,
          project.id,
        );
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "ai.faculty.review",
          project.id,
          undefined,
          {
            module,
            taskType: task.taskType,
            provider: result.usage.provider,
            model: result.usage.model,
            policyLevel: project.aiPolicy.level,
            runId,
          },
        );
        await recordProductEventSafe(a, "ai_faculty_action", {
          projectId: project.id,
          properties: {
            module,
            taskType: task.taskType,
            provider: result.usage.provider,
          },
        });
        res.json({
          success: true,
          faculty: {
            runId,
            agent: task.agent,
            taskType: task.taskType,
            contextUsed: [
              "Project DNA",
              "Requirements",
              "Deliverables",
              "Rubric",
              "Tasks",
              "AI Policy",
              "Current learner-authored work",
            ],
            output: result.output,
            disclosureRequired: project.aiPolicy.disclosureRequired,
          },
          usage: {
            provider: result.usage.provider,
            model: result.usage.model,
            estimatedCostUsd: result.usage.estimatedCostUsd,
            latencyMs: result.usage.latencyMs,
          },
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/projects/:id/copilot",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          project = await firestoreStore.getProject(
            req.params.id,
            a.userId,
            a.tenantId,
          );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const mode = cleanField(req.body?.mode, 40) as CopilotMode;
        const validModes: CopilotMode[] = [
          "file_search",
          "research",
          "assignment_compile",
          "tutor",
          "workspace_function",
          "viva_live",
        ];
        if (!validModes.includes(mode))
          return res
            .status(400)
            .json({ error: "Invalid copilot mode", code: "COPILOT_MODE_INVALID" });
        const query = cleanField(req.body?.query, 4000);
        const storedFlags = await firestoreStore.listFeatureFlags(a.tenantId);
        const flagMap = Object.fromEntries([
          ...FEATURE_DEFAULTS.map((flag) => [flag.key, flag.enabled] as const),
          ...storedFlags.map((flag) => [flag.key, flag.enabled] as const),
        ]);
        if (!copilotEnabled(mode, flagMap))
          return res.status(403).json({
            error: "Project Copilot mode is disabled for this tenant",
            code: "FEATURE_DISABLED",
            featureFlag: copilotFeatureFlag(mode),
          });
        const [artifacts, evidence] = await Promise.all([
          firestoreStore.listWorkspaceArtifacts(project.id, a.tenantId),
          firestoreStore.listProjectEvidence(project.id, a.userId, a.tenantId),
        ]);
        let grounded = mode === "research" && groundingConfigured();
        let response = nativeCopilotResponse({
          mode,
          query,
          project,
          artifacts,
          evidence,
          actor: a,
          grounded,
        });
        const guard = shouldBlockCopilot(project, mode, query);
        let usage;
        let groundedAnswer = "";
        const retrievalMeta: Record<string, unknown> = {};

        // Real semantic File Search over the tenant-scoped, self-hosted vector index.
        if (!guard && mode === "file_search" && embeddingsConfigured()) {
          try {
            const fs = await semanticFileSearch(
              { tenantId: a.tenantId, scopeType: "project", scopeId: project.id, projectId: project.id },
              query,
            );
            retrievalMeta.fileSearch = { ok: fs.ok, reason: fs.reason, matched: fs.matched, indexSize: fs.indexSize, backend: fs.backend };
            if (fs.ok && fs.citations.length) {
              const seen = new Set(fs.citations.map((c) => c.id));
              response = {
                ...response,
                citations: [...fs.citations, ...response.citations.filter((c) => !seen.has(c.id))].slice(0, 24),
                controls: { ...response.controls, defenses: [...new Set([...response.controls.defenses, "semantic-file-search", "self-hosted-vector-store"])] },
                observability: {
                  ...response.observability,
                  evals: [
                    ...response.observability.evals.filter((e) => e.id !== "citation_grounding"),
                    { id: "citation_grounding", status: "pass" as const, detail: `${fs.matched} semantic matches from ${fs.indexSize} indexed chunks (${fs.backend}).` },
                    { id: "semantic_retrieval", status: "pass" as const, detail: `Self-hosted embeddings (${fs.backend}); no student files sent to a managed store.` },
                  ],
                },
              };
            } else {
              response = {
                ...response,
                observability: {
                  ...response.observability,
                  evals: [...response.observability.evals, { id: "semantic_retrieval", status: "warn" as const, detail: fs.reason === "index_empty" ? "No File Search index built yet for this project." : "Semantic retrieval returned no confident match; falling back to the local index." }],
                },
              };
            }
            await firestoreStore.recordAIUsage(
              { provider: `embedding:${fs.backend}`, model: fs.model || embeddingBackend(), latencyMs: fs.latencyMs, taskType: "project_copilot_file_search_retrieval", promptId: "file-search:v1", promptVersion: "1", estimatedCostUsd: 0 },
              a,
              project.id,
            );
          } catch (error) {
            retrievalMeta.fileSearch = { ok: false, error: cleanField((error as any)?.message, 200) };
          }
        }

        // Real Google Search Grounding for Research Studio.
        if (!guard && mode === "research" && grounded) {
          const gate = await platformStore.reserveAiBudget(a.tenantId, a.userId);
          try {
            const g = await groundedResearch(query);
            groundedAnswer = g.answer;
            retrievalMeta.grounding = { citations: g.citations.length, queries: g.queries, provider: g.provider };
            const seen = new Set(g.citations.map((c) => c.id));
            response = {
              ...response,
              citations: [...g.citations, ...response.citations.filter((c) => !seen.has(c.id))].slice(0, 24),
              controls: { ...response.controls, grounded: true, defenses: [...new Set([...response.controls.defenses, "google-search-grounding", "untrusted-search-snippet-boundary"])] },
              observability: {
                ...response.observability,
                evals: [
                  ...response.observability.evals.filter((e) => e.id !== "citation_grounding"),
                  { id: "citation_grounding", status: g.citations.length ? "pass" as const : "warn" as const, detail: `${g.citations.length} grounded web sources via ${g.provider}.` },
                ],
              },
            };
            await firestoreStore.recordAIUsage(
              { provider: `grounding:${g.provider}`, model: g.model, inputTokens: g.usage?.inputTokens, outputTokens: g.usage?.outputTokens, totalTokens: g.usage?.totalTokens, latencyMs: response.observability.latencyMs, taskType: "project_copilot_research_grounding", promptId: "research-grounding:v1", promptVersion: "1", estimatedCostUsd: 0 },
              a,
              project.id,
            );
          } catch (error) {
            grounded = false;
            retrievalMeta.grounding = { ok: false, error: cleanField((error as any)?.message, 200) };
            response = { ...response, controls: { ...response.controls, grounded: false } };
          } finally {
            await platformStore.releaseAiBudgetReservation(gate.reservation);
          }
        }
        if (!guard && aiConfigured({ taskType: `project_copilot_${mode}`, complexity: project.complexity, risk: mode === "research" || mode === "viva_live" ? "high" : "medium" })) {
          const gate = await platformStore.reserveAiBudget(a.tenantId, a.userId);
          try {
            const result = await getAIProvider({
              taskType: `project_copilot_${mode}`,
              complexity: project.complexity,
              risk: mode === "research" || mode === "viva_live" ? "high" : "medium",
              requiredModality: mode === "assignment_compile" ? "multimodal" : "text",
            }).runAcademicTask({
              taskType: `project_copilot_${mode}`,
              agent: "project_copilot",
              projectContext: {
                project: {
                  id: project.id,
                  title: project.title,
                  revision: project.revision,
                  course: project.course,
                  outcomes: project.learningOutcomes,
                  requiredActions: project.requiredActions,
                },
                rubric: project.rubric,
                evidence: evidence.slice(0, 20).map((item) => ({
                  id: item.id,
                  title: item.title,
                  verification: item.verification,
                  rubricIds: item.rubricIds || [],
                })),
                citations: response.citations.slice(0, 12),
                googleGroundingAvailable: grounded,
                groundedFindings: groundedAnswer
                  ? `BEGIN UNTRUSTED GROUNDED SEARCH FINDINGS\n${groundedAnswer.slice(0, 8000)}\nEND UNTRUSTED GROUNDED SEARCH FINDINGS`
                  : "",
              },
              artifact: { module: mode, title: "Project Copilot query", content: query },
              platformInstruction: buildCopilotPlatformInstruction(project, mode),
              learnerInstruction: query,
              policySummary: `Level ${project.aiPolicy.level}. ${project.aiPolicy.summary || ""}`,
            });
            usage = result.usage;
            response = {
              ...response,
              answer: result.output.summary || response.answer,
              guidance: [...result.output.findings, ...result.output.suggestions].slice(0, 8),
            };
          } catch (error) {
            response = {
              ...response,
              guidance: [
                ...response.guidance,
                `AI gateway fallback: ${cleanField((error as any)?.message, 240) || "provider unavailable"}`,
              ].slice(0, 8),
            };
          } finally {
            await platformStore.releaseAiBudgetReservation(gate.reservation);
          }
        }
        // If generation was not available but grounding produced findings, surface them directly.
        if (!usage && groundedAnswer) {
          response = { ...response, answer: groundedAnswer };
        }
        const runId = await firestoreStore.recordAIUsage(
          usage || {
            provider: "native",
            model: "project-copilot-scaffold",
            latencyMs: response.observability.latencyMs,
            taskType: `project_copilot_${mode}`,
            promptId: response.observability.promptId,
            promptVersion: "1",
            estimatedCostUsd: 0,
          },
          a,
          project.id,
        );
        response = finalizeCopilotRun(response, runId, usage);
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "ai.project_copilot",
          project.id,
          undefined,
          {
            mode,
            runId,
            featureFlag: copilotFeatureFlag(mode),
            grounded,
            blocked: response.controls.blocked,
            evals: response.observability.evals,
            retrieval: retrievalMeta,
          },
        );
        await recordProductEventSafe(a, "project_copilot_run", {
          projectId: project.id,
          properties: {
            mode,
            provider: response.controls.provider,
            grounded,
            blocked: response.controls.blocked,
          },
        });
        res.json({ success: true, copilot: response });
      } catch (e) {
        next(e);
      }
    },
  );
  // Build/refresh the self-hosted File Search index for a project (embeddings stay in your Firestore).
  app.post(
    "/api/projects/:id/copilot/index",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(req.params.id, a.userId, a.tenantId);
        if (!project)
          return res.status(404).json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const storedFlags = await firestoreStore.listFeatureFlags(a.tenantId);
        const flagMap = Object.fromEntries([
          ...FEATURE_DEFAULTS.map((flag) => [flag.key, flag.enabled] as const),
          ...storedFlags.map((flag) => [flag.key, flag.enabled] as const),
        ]);
        if (!copilotEnabled("file_search", flagMap))
          return res.status(403).json({ error: "Project Copilot File Search is disabled for this tenant", code: "FEATURE_DISABLED", featureFlag: copilotFeatureFlag("file_search") });
        if (!embeddingsConfigured())
          return res.status(503).json({ error: "No embedding provider is configured for File Search", code: "AI_NOT_CONFIGURED" });
        const [artifacts, evidence] = await Promise.all([
          firestoreStore.listWorkspaceArtifacts(project.id, a.tenantId),
          firestoreStore.listProjectEvidence(project.id, a.userId, a.tenantId),
        ]);
        const extra = Array.isArray(req.body?.sources)
          ? (req.body.sources as any[]).slice(0, 50).map((s, i) => ({
              sourceType: "artifact" as const,
              sourceId: `provided:${cleanField(s?.id, 60) || i}`,
              title: cleanField(s?.title, 200) || `Provided source ${i + 1}`,
              trust: "recorded" as const,
              text: cleanField(s?.text, 40000),
            })).filter((s) => s.text)
          : [];
        const sources = projectRawSources(project, artifacts, evidence, extra);
        const gate = await platformStore.reserveAiBudget(a.tenantId, a.userId);
        let result;
        try {
          result = await ingestRetrievalIndex(
            { tenantId: a.tenantId, scopeType: "project", scopeId: project.id, projectId: project.id },
            sources,
          );
        } finally {
          await platformStore.releaseAiBudgetReservation(gate.reservation);
        }
        await firestoreStore.recordAIUsage(
          { provider: `embedding:${result.backend}`, model: result.model, latencyMs: result.latencyMs, taskType: "project_copilot_file_search_index", promptId: "file-search-index:v1", promptVersion: "1", estimatedCostUsd: 0 },
          a,
          project.id,
        );
        await firestoreStore.writeAudit(a.tenantId, a.userId, "ai.project_copilot_index", project.id, undefined, {
          indexed: result.indexed,
          removed: result.removed,
          truncated: result.truncated,
          backend: result.backend,
          sources: sources.length,
        });
        res.json({ success: true, index: result });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/writer",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const document = await loadLatestProjectDocument(
          project.id,
          a.tenantId,
        );
        const access = await platformStore.projectEntitlementAccess(
          a.tenantId,
          a.userId,
          project.id,
        );
        res.json({ success: true, document, access });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/projects/:id/writer/generate",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      let reservation:
        | { id: string; counterId: string; reservedUsd: number }
        | undefined;
      let fairUseReservation: FairUseReservation | undefined;
      let fairUseConsumed = false;
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const [existingDocument, access] = await Promise.all([
          loadLatestProjectDocument(project.id, a.tenantId),
          platformStore.projectEntitlementAccess(
            a.tenantId,
            a.userId,
            project.id,
          ),
        ]);
        const generation = decideProjectGeneration(
          access,
          existingDocument ? existingDocument.accessTier || "preview" : undefined,
        );
        if (!generation.allowed)
          return res.status(402).json({
            error:
              "استخدمت المعاينة المجانية لهذا المشروع. افتح المشروع الكامل للمتابعة والتعديل والتصدير.",
            code: generation.code,
            access,
          });
        if (generation.preview) {
          const fairUse = await reserveFreeBenefit(req, a, "project_preview");
          if (!fairUse.assessment.allowed) {
            const needsVerification = fairUse.assessment.reasonCodes.includes("EMAIL_NOT_VERIFIED");
            return res.status(needsVerification ? 403 : 429).json({
              error: needsVerification
                ? "Verify your email before using the free project preview."
                : "The free preview has already been used for this device/account window. Paid projects remain available.",
              code: needsVerification ? "FREE_PREVIEW_EMAIL_VERIFICATION_REQUIRED" : "FREE_PREVIEW_FAIR_USE_LIMIT",
              fairUse: { decision: fairUse.assessment.decision, reasonCodes: fairUse.assessment.reasonCodes, windowDays: fairUse.assessment.windowDays },
            });
          }
          fairUseReservation = fairUse.reservation;
        }
        const mode = cleanField(req.body?.mode, 20) as ProjectWriterRequest["mode"];
        const assistanceMode = cleanField(
          req.body?.assistanceMode,
          40,
        ) as ProjectWriterRequest["assistanceMode"];
        if (!new Set(["write", "rescue", "revise"]).has(mode))
          return res.status(400).json({
            error: "Invalid project writer mode",
            code: "PROJECT_WRITER_MODE_INVALID",
          });
        if (
          !new Set(["practice", "disclosed_submission", "policy_strict"]).has(
            assistanceMode,
          )
        )
          return res.status(400).json({
            error: "Invalid assistance mode",
            code: "PROJECT_ASSISTANCE_MODE_INVALID",
          });
        const targetPages = Math.max(
          3,
          Math.min(35, Number(req.body?.desiredPages || 12)),
        );
        const request: ProjectWriterRequest = {
          mode,
          assistanceMode,
          language: cleanField(req.body?.language, 80) || "English",
          desiredPages: generation.preview ? PREVIEW_PAGE_LIMIT : targetPages,
          academicTone: new Set(["clear", "formal", "advanced"]).has(
            String(req.body?.academicTone),
          )
            ? req.body.academicTone
            : "clear",
          topicNotes: cleanField(req.body?.topicNotes, 12_000),
          learnerVoiceSample: cleanField(req.body?.learnerVoiceSample, 4_000),
          existingDraft: cleanField(req.body?.existingDraft, 120_000),
          professorFeedback: cleanField(req.body?.professorFeedback, 20_000),
        };
        if (mode === "rescue" && !request.existingDraft) {
          const previous = await loadLatestProjectDocument(
            project.id,
            a.tenantId,
          );
          request.existingDraft =
            previous?.sections.map((section) => section.content).join("\n\n") ||
            project.originalAssignment?.text ||
            "";
        }
        if (mode === "revise" && !request.professorFeedback)
          return res.status(400).json({
            error: "Professor feedback is required for revision mode",
            code: "PROJECT_FEEDBACK_REQUIRED",
          });

        const evidence = await firestoreStore.listProjectEvidence(
          project.id,
          a.userId,
          a.tenantId,
        );
        const verifiedSources = evidence
          .filter((item) => item.type === "source")
          .map((item) => ({
            title: item.title,
            detail: item.detail,
            sourceUrl: item.sourceUrl,
            verification: item.verification,
          }));
        const ready = aiConfigured({
          taskType: `project_${mode}`,
          complexity: project.complexity,
          risk: "high",
          requiredModality: "text",
        });
        const provider = ready
          ? getAIProvider({
              taskType: `project_${mode}`,
              complexity: project.complexity,
              risk: "high",
              requiredModality: "text",
            })
          : null;
        if (provider) {
          const gate = await platformStore.reserveAiBudget(
            a.tenantId,
            a.userId,
          );
          reservation = gate.reservation;
        }
        const composed = await composeProjectDocument({
          project,
          request,
          userId: a.userId,
          verifiedSources,
          generateSection: provider
            ? async (section) => {
                const result = await provider.runAcademicTask({
                  taskType: `project_${mode}_section`,
                  agent: "Project Co-Writer",
                  projectContext: facultyProjectContext(project),
                  artifact: {
                    module: "writing",
                    title: section.sectionTitle,
                    content: section.previousMemory,
                  },
                  platformInstruction: section.prompt,
                  learnerInstruction: request.topicNotes,
                  policySummary: `Level ${project.aiPolicy.level}. ${project.aiPolicy.summary}. Assistance mode: ${request.assistanceMode}.`,
                });
                await firestoreStore.recordAIUsage(
                  result.usage,
                  a,
                  project.id,
                );
                return result.output;
              }
            : undefined,
        });
        const document: ProjectDocument = {
          ...composed,
          accessTier: generation.preview ? "preview" : "paid",
          planId: access.planId,
          targetPages,
        };
        const persisted = await persistProjectDocument(a, project, document);
        if (generation.preview && fairUseReservation) {
          await finalizeFreeBenefit(fairUseReservation, true);
          fairUseConsumed = true;
        }
        const updatedProject: ProjectDNA = {
          ...project,
          language: request.language || project.language,
          workspaceModules: project.workspaceModules.includes("writing")
            ? project.workspaceModules
            : ["writing", ...project.workspaceModules],
          status: project.status === "not_started" ? "in_progress" : project.status,
          progress: Math.max(project.progress, 42),
          nextAction: "راجع أقسام المشروع، ثبّت المصادر، ثم ابدأ تدريب المناقشة.",
          updatedAt: new Date().toISOString(),
        };
        await firestoreStore.updateProject(
          updatedProject,
          a.userId,
          "Project writer generated",
        );
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "project.writer.generate",
          project.id,
          undefined,
          {
            mode,
            assistanceMode,
            variationId: persisted.variation.id,
            sections: persisted.sections.length,
            ai: Boolean(provider),
            accessTier: persisted.accessTier || "preview",
            planId: persisted.planId || null,
          },
        );
        await recordProductEventSafe(a, "project_writer_generated", {
          projectId: project.id,
          properties: {
            mode,
            assistanceMode,
            sections: persisted.sections.length,
            accessTier: persisted.accessTier || "preview",
          },
        });
        res.status(201).json({
          success: true,
          document: persisted,
          project: updatedProject,
          source: provider ? "ai" : "safe_scaffold",
          access,
          notice: generation.preview
            ? `هذه معاينة مجانية من ${PREVIEW_PAGE_LIMIT} صفحات. افتح المشروع الكامل لإكمال ${targetPages} صفحة والتعديلات والتصدير.`
            : provider
              ? undefined
              : "لا يوجد مزود AI مهيأ؛ تم إنشاء هيكل آمن ومخصص بدل اختلاق محتوى أو مصادر.",
        });
      } catch (e) {
        next(e);
      } finally {
        if (reservation)
          await platformStore
            .releaseAiBudgetReservation(reservation)
            .catch(() => undefined);
        if (fairUseReservation && !fairUseConsumed)
          await finalizeFreeBenefit(fairUseReservation, false).catch(() => undefined);
      }
    },
  );
  app.post(
    "/api/projects/:id/xray",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        let draft = cleanField(req.body?.draft, 160_000);
        if (!draft) {
          const document = await loadLatestProjectDocument(
            project.id,
            a.tenantId,
          );
          draft =
            document?.sections.map((section) => section.content).join("\n\n") ||
            project.originalAssignment?.text ||
            "";
        }
        if (!draft.trim())
          return res.status(400).json({
            error: "Add or generate a draft before running Project X-Ray",
            code: "PROJECT_DRAFT_REQUIRED",
          });
        const report = inspectProjectDraft(project, draft);
        await recordProductEventSafe(a, "project_xray_completed", {
          projectId: project.id,
          properties: report.scores,
        });
        res.json({ success: true, report });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/projects/:projectId/writer/section/:artifactId/action",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      let reservation:
        | { id: string; counterId: string; reservedUsd: number }
        | undefined;
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.projectId,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const access = await platformStore.projectEntitlementAccess(
          a.tenantId,
          a.userId,
          project.id,
        );
        if (!access.canWriteFull)
          return res.status(402).json({
            error: "تعديلات الأقسام متاحة بعد فتح المشروع الكامل.",
            code: "PROJECT_PAYMENT_REQUIRED",
            access,
          });
        const artifact = await firestoreStore.getWorkspaceArtifact(
          req.params.artifactId,
        );
        if (
          !artifact ||
          artifact.projectId !== project.id ||
          artifact.tenantId !== a.tenantId ||
          artifact.kind !== "academic-document-section"
        )
          return res.status(404).json({
            error: "Project section not found",
            code: "PROJECT_SECTION_NOT_FOUND",
          });
        const action = cleanField(req.body?.action, 40);
        const actions: Record<string, string> = {
          explain: "Explain the section in plain language. Do not rewrite it.",
          simplify: "Rewrite with simpler academic wording while preserving every supported meaning.",
          expand: "Expand the analysis with deeper reasoning; mark every new evidence need as [مصدر مطلوب].",
          shorten: "Shorten substantially without removing the central argument or verified evidence.",
          voice: "Rewrite transparently toward the supplied student voice sample; do not evade AI detection.",
          academic: "Improve formal academic tone, transitions, precision, and qualification.",
          translate: "Translate into the requested language while preserving citations and meaning.",
          challenge: "Challenge the section as a strict professor and return objections and questions, not replacement prose.",
          source: "Identify exact claims needing sources and add [مصدر مطلوب] markers; never invent a source.",
        };
        if (!actions[action])
          return res.status(400).json({
            error: "Unsupported section action",
            code: "PROJECT_SECTION_ACTION_INVALID",
          });
        const assistanceMode = new Set([
          "practice",
          "disclosed_submission",
          "policy_strict",
        ]).has(String(req.body?.assistanceMode))
          ? req.body.assistanceMode
          : "practice";
        decideProjectWritingAccess(project, assistanceMode);
        const provider = getAIProvider({
          taskType: `revision_${action}`,
          complexity: project.complexity,
          risk: "medium",
          requiredModality: "text",
        });
        if (!provider.configured())
          return res.status(503).json({
            error: "ميزة إعادة الصياغة تحتاج ربط مزود الذكاء الاصطناعي.",
            code: "AI_NOT_CONFIGURED",
          });
        const gate = await platformStore.reserveAiBudget(
          a.tenantId,
          a.userId,
        );
        reservation = gate.reservation;
        const result = await provider.runAcademicTask({
          taskType: `revision_${action}`,
          agent: action === "challenge" ? "Strict Professor" : "Revision Editor",
          projectContext: facultyProjectContext(project),
          artifact: {
            module: "writing",
            title: artifact.title,
            content: artifact.content,
          },
          platformInstruction: `${actions[action]} Return the rewritten section in summary unless this is explain or challenge. Put explanation or objections in findings.`,
          learnerInstruction: cleanField(req.body?.instruction, 4_000),
          policySummary: `Level ${project.aiPolicy.level}. ${project.aiPolicy.summary}. Assistance mode: ${assistanceMode}.`,
        });
        await firestoreStore.recordAIUsage(result.usage, a, project.id);
        const shouldApply =
          Boolean(req.body?.apply) && !new Set(["explain", "challenge"]).has(action);
        let persisted = artifact;
        if (shouldApply) {
          persisted = await firestoreStore.saveWorkspaceArtifact(
            {
              ...artifact,
              content: result.output.summary,
              updatedBy: a.userId,
              updatedAt: new Date().toISOString(),
            },
            a.userId,
            artifact.revision,
          );
        }
        await recordProductEventSafe(a, "project_section_action", {
          projectId: project.id,
          properties: { action, applied: shouldApply },
        });
        res.json({
          success: true,
          artifact: persisted,
          applied: shouldApply,
          output: result.output,
        });
      } catch (e) {
        next(e);
      } finally {
        if (reservation)
          await platformStore
            .releaseAiBudgetReservation(reservation)
            .catch(() => undefined);
      }
    },
  );
  app.post(
    "/api/projects/:id/presence",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const presence: ProjectPresenceRecord = {
          projectId: project.id,
          tenantId: a.tenantId,
          userId: a.userId,
          displayName: a.displayName,
          location: cleanField(req.body?.location, 120) || "project",
          lastSeenAt: new Date().toISOString(),
        };
        await firestoreStore.heartbeatProjectPresence(presence);
        res.status(202).json({ success: true, presence });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/presence",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const presence = await firestoreStore.listProjectPresence(
          project.id,
          a.tenantId,
        );
        res.json({ success: true, presence });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/members",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const members = await firestoreStore.listProjectMembers(
          project.id,
          a.tenantId,
        );
        res.json({ success: true, members, owner: { userId: project.userId } });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/projects/:id/members",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          project = await firestoreStore.getProject(
            req.params.id,
            a.userId,
            a.tenantId,
          );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        if (project.userId !== a.userId)
          return res.status(403).json({
            error: "Only the project owner can invite members",
            code: "OWNER_REQUIRED",
          });
        if (project.collaborationMode !== "group")
          return res.status(409).json({
            error:
              "This assignment is individual; project-member collaboration is disabled",
            code: "PROJECT_INDIVIDUAL",
          });
        const email = cleanField(req.body?.email, 320).toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          return res
            .status(400)
            .json({ error: "Valid email is required", code: "INVALID_EMAIL" });
        if (a.email && email === a.email.toLowerCase())
          return res.status(400).json({
            error: "You are already the project owner",
            code: "ALREADY_OWNER",
          });
        const existing = await firestoreStore.findProjectInvite(
          project.id,
          email,
          a.tenantId,
        );
        if (existing && existing.status !== "revoked")
          return res.status(409).json({
            error: "This person already has an invitation or membership",
            code: "MEMBER_EXISTS",
          });
        const now = new Date().toISOString();
        const member: ProjectMemberRecord = {
          id: existing?.id || randomUUID(),
          projectId: project.id,
          tenantId: a.tenantId,
          email,
          role: "member",
          status: "pending",
          invitedBy: a.userId,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
        await firestoreStore.saveProjectMember(member, a.userId);
        res.status(201).json({ success: true, member });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/projects/:projectId/members/:memberId",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          project = await firestoreStore.getProject(
            req.params.projectId,
            a.userId,
            a.tenantId,
          );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        if (project.userId !== a.userId)
          return res.status(403).json({
            error: "Only the project owner can change membership",
            code: "OWNER_REQUIRED",
          });
        const current = await firestoreStore.getProjectMember(
          req.params.memberId,
        );
        if (
          !current ||
          current.projectId !== project.id ||
          current.tenantId !== a.tenantId
        )
          return res
            .status(404)
            .json({ error: "Member not found", code: "MEMBER_NOT_FOUND" });
        const status = String(req.body?.status || current.status);
        const member: ProjectMemberRecord = {
          ...current,
          status: (["pending", "active", "revoked"].includes(status)
            ? status
            : current.status) as ProjectMemberRecord["status"],
          updatedAt: new Date().toISOString(),
        };
        await firestoreStore.saveProjectMember(member, a.userId);
        res.json({ success: true, member });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/invitations",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        if (!a.email) return res.json({ success: true, invitations: [] });
        const invitations = await firestoreStore.listPendingInvitations(
          a.email,
          a.tenantId,
        );
        res.json({ success: true, invitations });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/invitations/:id/respond",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          member = await firestoreStore.getProjectMember(req.params.id);
        if (
          !member ||
          member.tenantId !== a.tenantId ||
          member.status !== "pending"
        )
          return res.status(404).json({
            error: "Invitation not found",
            code: "INVITATION_NOT_FOUND",
          });
        if (!a.email || member.email !== a.email.toLowerCase())
          return res.status(403).json({
            error: "Invitation email does not match this account",
            code: "INVITATION_EMAIL_MISMATCH",
          });
        const decision = String(req.body?.decision);
        if (!["accept", "decline"].includes(decision))
          return res.status(400).json({
            error: "Decision must be accept or decline",
            code: "INVALID_DECISION",
          });
        const updated: ProjectMemberRecord = {
          ...member,
          userId: decision === "accept" ? a.userId : member.userId,
          displayName:
            decision === "accept" ? a.displayName : member.displayName,
          status: decision === "accept" ? "active" : "revoked",
          updatedAt: new Date().toISOString(),
        };
        await firestoreStore.saveProjectMember(updated, a.userId);
        res.json({ success: true, member: updated });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/artifacts",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const includeDeleted = req.query.deleted === "1";
        const artifacts = await firestoreStore.listWorkspaceArtifacts(
          project.id,
          a.tenantId,
          includeDeleted,
        );
        res.json({ success: true, artifacts });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/projects/:id/artifacts",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          project = await firestoreStore.getProject(
            req.params.id,
            a.userId,
            a.tenantId,
          );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const module = String(
          req.body?.module || "",
        ) as ProjectDNA["workspaceModules"][number];
        if (!project.workspaceModules.includes(module))
          return res.status(400).json({
            error: "Module is not part of this Project DNA",
            code: "INVALID_WORKSPACE_MODULE",
          });
        const title = cleanField(req.body?.title, 180),
          content = cleanField(req.body?.content, 80000),
          kind = cleanField(req.body?.kind, 80) || "work-item";
        if (!title)
          return res.status(400).json({
            error: "Artifact title is required",
            code: "ARTIFACT_TITLE_REQUIRED",
          });
        const statusRaw = String(req.body?.status || "draft");
        const status = (
          ["draft", "in_progress", "ready"].includes(statusRaw)
            ? statusRaw
            : "draft"
        ) as WorkspaceArtifact["status"];
        const deliverableId =
          cleanField(req.body?.deliverableId, 160) || undefined;
        if (
          deliverableId &&
          !project.deliverables.some((d) => d.id === deliverableId)
        )
          return res.status(400).json({
            error: "Linked deliverable is not part of this project",
            code: "INVALID_DELIVERABLE_LINK",
          });
        const rubricIds = cleanStringList(req.body?.rubricIds, 30, 160).filter(
          (id) => project.rubric.some((r) => r.id === id),
        );
        const now = new Date().toISOString();
        const artifact: WorkspaceArtifact = {
          id: randomUUID(),
          projectId: project.id,
          tenantId: a.tenantId,
          createdBy: a.userId,
          updatedBy: a.userId,
          module,
          kind,
          title,
          content,
          status,
          deliverableId,
          rubricIds,
          isCanonical: Boolean(req.body?.isCanonical),
          createdAt: now,
          updatedAt: now,
        };
        const persisted = await firestoreStore.saveWorkspaceArtifact(
          artifact,
          a.userId,
        );
        res.status(201).json({ success: true, artifact: persisted });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/projects/:projectId/artifacts/:artifactId/impact",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          project = await firestoreStore.getProject(
            req.params.projectId,
            a.userId,
            a.tenantId,
          );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const current = await firestoreStore.getWorkspaceArtifact(
          req.params.artifactId,
        );
        if (
          !current ||
          current.projectId !== project.id ||
          current.tenantId !== a.tenantId ||
          current.deletedAt
        )
          return res
            .status(404)
            .json({ error: "Artifact not found", code: "ARTIFACT_NOT_FOUND" });
        if (!current.isCanonical)
          return res.json({ success: true, impact: [] });
        const nextContent = cleanField(req.body?.nextContent, 80000);
        const artifacts = await firestoreStore.listWorkspaceArtifacts(
          project.id,
          a.tenantId,
        );
        res.json({
          success: true,
          impact: artifactImpact(current, nextContent, artifacts),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/projects/:projectId/artifacts/:artifactId",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          project = await firestoreStore.getProject(
            req.params.projectId,
            a.userId,
            a.tenantId,
          );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const current = await firestoreStore.getWorkspaceArtifact(
          req.params.artifactId,
        );
        if (
          !current ||
          current.projectId !== project.id ||
          current.tenantId !== a.tenantId
        )
          return res
            .status(404)
            .json({ error: "Artifact not found", code: "ARTIFACT_NOT_FOUND" });
        const deliverableId =
          req.body?.deliverableId === null
            ? undefined
            : cleanField(req.body?.deliverableId, 160) || current.deliverableId;
        if (
          deliverableId &&
          !project.deliverables.some((d) => d.id === deliverableId)
        )
          return res.status(400).json({
            error: "Linked deliverable is not part of this project",
            code: "INVALID_DELIVERABLE_LINK",
          });
        const rubricIds =
          req.body?.rubricIds === undefined
            ? current.rubricIds || []
            : cleanStringList(req.body?.rubricIds, 30, 160).filter((id) =>
                project.rubric.some((r) => r.id === id),
              );
        const statusRaw = String(req.body?.status || current.status);
        const status = (
          ["draft", "in_progress", "ready"].includes(statusRaw)
            ? statusRaw
            : current.status
        ) as WorkspaceArtifact["status"];
        const artifact: WorkspaceArtifact = {
          ...current,
          title:
            req.body?.title === undefined
              ? current.title
              : cleanField(req.body.title, 180) || current.title,
          content:
            req.body?.content === undefined
              ? current.content
              : cleanField(req.body.content, 80000),
          kind:
            req.body?.kind === undefined
              ? current.kind
              : cleanField(req.body.kind, 80) || current.kind,
          status,
          deliverableId,
          rubricIds,
          isCanonical:
            req.body?.isCanonical === undefined
              ? current.isCanonical
              : Boolean(req.body.isCanonical),
          updatedBy: a.userId,
          updatedAt: new Date().toISOString(),
        };
        const allArtifacts =
          current.isCanonical && artifact.content !== current.content
            ? await firestoreStore.listWorkspaceArtifacts(
                project.id,
                a.tenantId,
              )
            : [];
        const impact = current.isCanonical
          ? artifactImpact(current, artifact.content, allArtifacts)
          : [];
        const baseRevision =
          req.body?.baseRevision === undefined
            ? undefined
            : Number(req.body.baseRevision);
        if (baseRevision !== undefined && !Number.isFinite(baseRevision))
          return res
            .status(400)
            .json({ error: "Invalid base revision", code: "INVALID_REVISION" });
        const persisted = await firestoreStore.saveWorkspaceArtifact(
          artifact,
          a.userId,
          baseRevision,
        );
        const requested = new Set(
          cleanStringList(req.body?.propagateArtifactIds, 100, 160),
        );
        const propagated: string[] = [];
        if (
          requested.size &&
          current.isCanonical &&
          artifact.content !== current.content &&
          current.content
        ) {
          for (const candidate of impact) {
            if (!requested.has(candidate.id) || !candidate.exactReplacePossible)
              continue;
            const target = allArtifacts.find((x) => x.id === candidate.id);
            if (!target) continue;
            const changed: WorkspaceArtifact = {
              ...target,
              content: target.content.replaceAll(
                current.content,
                artifact.content,
              ),
              updatedBy: a.userId,
              updatedAt: new Date().toISOString(),
            };
            await firestoreStore.saveWorkspaceArtifact(
              changed,
              a.userId,
              target.revision,
            );
            propagated.push(target.id);
          }
        }
        if (impact.length)
          await firestoreStore.writeAudit(
            a.tenantId,
            a.userId,
            "project_twin.impact",
            project.id,
            undefined,
            {
              sourceArtifactId: current.id,
              affected: impact.length,
              autoUpdateable: impact.filter((x) => x.exactReplacePossible)
                .length,
              propagated,
            },
          );
        res.json({ success: true, artifact: persisted, impact, propagated });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:projectId/artifacts/:artifactId/versions",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          project = await firestoreStore.getProject(
            req.params.projectId,
            a.userId,
            a.tenantId,
          );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const current = await firestoreStore.getWorkspaceArtifact(
          req.params.artifactId,
        );
        if (
          !current ||
          current.projectId !== project.id ||
          current.tenantId !== a.tenantId
        )
          return res
            .status(404)
            .json({ error: "Artifact not found", code: "ARTIFACT_NOT_FOUND" });
        const versions = await firestoreStore.listWorkspaceArtifactVersions(
          current.id,
          project.id,
          a.tenantId,
        );
        res.json({ success: true, versions });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/projects/:projectId/artifacts/:artifactId/versions/:versionId/restore",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          project = await firestoreStore.getProject(
            req.params.projectId,
            a.userId,
            a.tenantId,
          );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const artifact = await firestoreStore.restoreWorkspaceArtifactVersion(
          req.params.versionId,
          project,
          req.params.artifactId,
          a.userId,
        );
        if (!artifact)
          return res.status(404).json({
            error: "Artifact version not found",
            code: "ARTIFACT_VERSION_NOT_FOUND",
          });
        res.json({ success: true, artifact });
      } catch (e) {
        next(e);
      }
    },
  );
  app.delete(
    "/api/projects/:projectId/artifacts/:artifactId",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          project = await firestoreStore.getProject(
            req.params.projectId,
            a.userId,
            a.tenantId,
          );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const ok = await firestoreStore.deleteWorkspaceArtifact(
          req.params.artifactId,
          project,
          a.userId,
        );
        if (!ok)
          return res
            .status(404)
            .json({ error: "Artifact not found", code: "ARTIFACT_NOT_FOUND" });
        res.json({ success: true });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/projects/:projectId/artifacts/:artifactId/restore",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          project = await firestoreStore.getProject(
            req.params.projectId,
            a.userId,
            a.tenantId,
          );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const artifact = await firestoreStore.restoreWorkspaceArtifact(
          req.params.artifactId,
          project,
          a.userId,
        );
        if (!artifact)
          return res
            .status(404)
            .json({ error: "Artifact not found", code: "ARTIFACT_NOT_FOUND" });
        res.json({ success: true, artifact });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/time-machine",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const data = await loadProjectIntelligence(req.actor!, req.params.id);
        if (!data)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        res.json({
          success: true,
          timeMachine: buildTimeMachine(
            data.project,
            data.activity,
            data.versions,
            data.artifacts,
            data.evidence,
            data.learning,
            data.aiRuns,
          ),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/trust-graph",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const data = await loadProjectIntelligence(req.actor!, req.params.id);
        if (!data)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        res.json({
          success: true,
          trustGraph: buildTrustGraph(
            data.project,
            data.artifacts,
            data.evidence,
            data.learning,
            data.skills,
          ),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/evidence-capsule",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const data = await loadProjectIntelligence(req.actor!, req.params.id);
        if (!data)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const capsule = buildEvidenceCapsule(
          data.project,
          data.artifacts,
          data.evidence,
          data.learning,
          data.skills,
          data.aiRuns,
          process.env.EVIDENCE_CAPSULE_ED25519_PRIVATE_KEY_B64,
        );
        res.setHeader("Cache-Control", "private, no-store");
        res.json({ success: true, capsule });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/evidence-capsule/export",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const data = await loadProjectIntelligence(a, req.params.id);
        if (!data)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const capsule = buildEvidenceCapsule(
          data.project,
          data.artifacts,
          data.evidence,
          data.learning,
          data.skills,
          data.aiRuns,
          process.env.EVIDENCE_CAPSULE_ED25519_PRIVATE_KEY_B64,
        );
        const safeName =
          data.project.title
            .replace(/[^a-zA-Z0-9\u0600-\u06FF_-]+/g, "-")
            .slice(0, 80) || "project";
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(`${safeName}-evidence-capsule.json`)}`,
        );
        res.setHeader("Cache-Control", "private, no-store");
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "evidence_capsule.export",
          data.project.id,
          undefined,
          { signatureStatus: capsule.integrity.signatureStatus },
        );
        res.send(Buffer.from(JSON.stringify(capsule, null, 2), "utf8"));
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/graph",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        res.json({
          success: true,
          graph: await firestoreStore.listProjectGraph(project.id, a.tenantId),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/research/sources/search",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const query = cleanField(req.query?.q, 300);
        if (query.length < 2)
          return res.status(400).json({ error: "Search query is required", code: "RESEARCH_QUERY_REQUIRED" });
        const payload = await crossrefJson("/works", new URLSearchParams({
          "query.bibliographic": query,
          rows: "8",
        }));
        const sources = Array.isArray(payload?.message?.items)
          ? payload.message.items.map(crossrefSourceFromWork).filter(Boolean)
          : [];
        res.setHeader("Cache-Control", "private, max-age=300");
        res.json({ success: true, provider: "crossref", sources });
      } catch (e) { next(e); }
    },
  );
  app.get(
    "/api/research/sources/doi",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const raw = cleanField(req.query?.doi, 500).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "").trim();
        if (!/^10\.\d{4,9}\/.+/i.test(raw))
          return res.status(400).json({ error: "A valid DOI is required", code: "DOI_INVALID" });
        const payload = await crossrefJson(`/works/${encodeURIComponent(raw)}`);
        const source = crossrefSourceFromWork(payload?.message || {});
        if (!source) return res.status(404).json({ error: "DOI was not found in Crossref", code: "DOI_NOT_FOUND" });
        res.setHeader("Cache-Control", "private, max-age=3600");
        res.json({ success: true, provider: "crossref", source });
      } catch (e) { next(e); }
    },
  );
  app.get(
    "/api/projects/:id/evidence",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await assertFeature(a.tenantId, "EvidenceStudio");
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const evidence = await firestoreStore.listProjectEvidence(
          project.id,
          a.userId,
          a.tenantId,
        );
        res.json({ success: true, evidence });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/projects/:id/evidence",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await assertFeature(a.tenantId, "EvidenceStudio");
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const allowed = new Set([
          "source",
          "claim",
          "note",
          "calculation",
          "chart",
          "code",
          "decision",
          "other",
        ]);
        const type = String(req.body?.type || "note");
        if (!allowed.has(type))
          return res.status(400).json({
            error: "Invalid evidence type",
            code: "INVALID_EVIDENCE_TYPE",
          });
        const title = String(req.body?.title || "")
            .trim()
            .slice(0, 180),
          detail = String(req.body?.detail || "")
            .trim()
            .slice(0, 12000),
          sourceUrl = String(req.body?.sourceUrl || "")
            .trim()
            .slice(0, 2000);
        if (!title || !detail)
          return res.status(400).json({
            error: "Evidence title and detail are required",
            code: "EVIDENCE_REQUIRED",
          });
        if (sourceUrl && !/^https?:\/\//i.test(sourceUrl))
          return res.status(400).json({
            error: "Source URL must use http or https",
            code: "INVALID_SOURCE_URL",
          });
        const relatedEvidenceIds = cleanStringList(
            req.body?.relatedEvidenceIds,
            10,
            180,
          ),
          artifactId = cleanField(req.body?.artifactId, 180) || undefined,
          deliverableId = cleanField(req.body?.deliverableId, 180) || undefined,
          rubricIds = cleanStringList(req.body?.rubricIds, 20, 180);
        if (relatedEvidenceIds.length) {
          const existing = await firestoreStore.listProjectEvidence(
            project.id,
            a.userId,
            a.tenantId,
          );
          const allowedIds = new Set(existing.map((x) => x.id));
          if (relatedEvidenceIds.some((id) => !allowedIds.has(id)))
            return res.status(400).json({
              error: "Related evidence must belong to this project",
              code: "EVIDENCE_LINK_INVALID",
            });
        }
        if (artifactId) {
          const artifacts = await firestoreStore.listWorkspaceArtifacts(
            project.id,
            a.tenantId,
          );
          if (!artifacts.some((x) => x.id === artifactId))
            return res.status(400).json({
              error: "Artifact link must belong to this project",
              code: "ARTIFACT_LINK_INVALID",
            });
        }
        if (
          deliverableId &&
          !project.deliverables.some((x) => x.id === deliverableId)
        )
          return res.status(400).json({
            error: "Deliverable link must belong to this project",
            code: "DELIVERABLE_LINK_INVALID",
          });
        if (rubricIds.some((id) => !project.rubric.some((x) => x.id === id)))
          return res.status(400).json({
            error: "Rubric links must belong to this project",
            code: "RUBRIC_LINK_INVALID",
          });
        const now = new Date().toISOString();
        const item: ProjectEvidence = {
          id: randomUUID(),
          projectId: project.id,
          userId: a.userId,
          tenantId: a.tenantId,
          type: type as ProjectEvidence["type"],
          title,
          detail,
          sourceUrl: sourceUrl || undefined,
          relatedEvidenceIds: relatedEvidenceIds.length
            ? relatedEvidenceIds
            : undefined,
          artifactId,
          deliverableId,
          rubricIds: rubricIds.length ? rubricIds : undefined,
          verification: "unverified",
          createdAt: now,
          updatedAt: now,
        };
        await firestoreStore.saveProjectEvidence(item);
        res.status(201).json({ success: true, evidence: item });
      } catch (e) {
        next(e);
      }
    },
  );
  app.delete(
    "/api/projects/:projectId/evidence/:evidenceId",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await assertFeature(a.tenantId, "EvidenceStudio");
        const project = await firestoreStore.getProject(
          req.params.projectId,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const ok = await firestoreStore.deleteProjectEvidence(
          req.params.evidenceId,
          project.id,
          a.userId,
          a.tenantId,
        );
        if (!ok)
          return res
            .status(404)
            .json({ error: "Evidence not found", code: "EVIDENCE_NOT_FOUND" });
        res.json({ success: true });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/projects/:id/viva",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await assertFeature(a.tenantId, "VivaStudio");
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const access = await platformStore.projectEntitlementAccess(
          a.tenantId,
          a.userId,
          project.id,
        );
        if (!access.canViva)
          return res.status(402).json({
            error: "تدريب المناقشة يحتاج باقة المشروع + المناقشة.",
            code: "PROJECT_VIVA_PLAN_REQUIRED",
            access,
          });
        const allowed = new Set(["easy", "normal", "strict", "external"]);
        const mode = String(req.body?.mode || "normal") as VivaMode;
        if (!allowed.has(mode))
          return res
            .status(400)
            .json({ error: "Invalid viva mode", code: "INVALID_VIVA_MODE" });
        const artifacts = await firestoreStore.listWorkspaceArtifacts(
          project.id,
          a.tenantId,
        );
        const session = createVivaSession(project, mode, artifacts);
        await firestoreStore.saveVivaSession(session);
        res.status(201).json({ success: true, session });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/projects/:projectId/viva/:sessionId/respond",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await assertFeature(a.tenantId, "VivaStudio");
        const project = await firestoreStore.getProject(
          req.params.projectId,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const access = await platformStore.projectEntitlementAccess(
          a.tenantId,
          a.userId,
          project.id,
        );
        if (!access.canViva)
          return res.status(402).json({
            error: "انتهت صلاحية تدريب المناقشة لهذا المشروع.",
            code: "PROJECT_VIVA_PLAN_REQUIRED",
            access,
          });
        const session = await firestoreStore.getVivaSession(
          req.params.sessionId,
          project.id,
          a.userId,
          a.tenantId,
        );
        if (!session)
          return res
            .status(404)
            .json({ error: "Viva session not found", code: "VIVA_NOT_FOUND" });
        if (session.status !== "active")
          return res.status(409).json({
            error: "Viva session is already completed",
            code: "VIVA_COMPLETED",
          });
        const questionId = String(req.body?.questionId || "");
        const answer = String(req.body?.answer || "")
          .trim()
          .slice(0, 8000);
        if (!session.questions.some((q) => q.id === questionId))
          return res.status(400).json({
            error: "Question is not part of this session",
            code: "INVALID_VIVA_QUESTION",
          });
        const now = new Date().toISOString();
        session.responses = [
          ...session.responses.filter((r) => r.questionId !== questionId),
          { questionId, answer, updatedAt: now },
        ];
        await firestoreStore.updateVivaSession(session);
        res.json({ success: true, session });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/projects/:projectId/viva/:sessionId/complete",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        await assertFeature(a.tenantId, "VivaStudio");
        const project = await firestoreStore.getProject(
          req.params.projectId,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const access = await platformStore.projectEntitlementAccess(
          a.tenantId,
          a.userId,
          project.id,
        );
        if (!access.canViva)
          return res.status(402).json({
            error: "انتهت صلاحية تدريب المناقشة لهذا المشروع.",
            code: "PROJECT_VIVA_PLAN_REQUIRED",
            access,
          });
        const session = await firestoreStore.getVivaSession(
          req.params.sessionId,
          project.id,
          a.userId,
          a.tenantId,
        );
        if (!session)
          return res
            .status(404)
            .json({ error: "Viva session not found", code: "VIVA_NOT_FOUND" });
        const result = completeViva(session);
        {
          await firestoreStore.updateVivaSession(result.session);
          await firestoreStore.saveLearningEvidence(result.evidence);
          await recordProductEventSafe(a, "viva_completed", {
            projectId: project.id,
          });
        }
        res.json({ success: true, ...result });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/learning-evidence",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const evidence = await firestoreStore.listLearningEvidence(
          project.id,
          a.userId,
          a.tenantId,
        );
        res.json({ success: true, evidence });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/comments",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const comments = await firestoreStore.listProjectComments(
          project.id,
          a.userId,
          a.tenantId,
        );
        res.json({ success: true, comments });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/projects/:id/comments",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const body = cleanField(req.body?.body, 4000);
        if (!body)
          return res.status(400).json({
            error: "Comment cannot be empty",
            code: "COMMENT_REQUIRED",
          });
        const now = new Date().toISOString();
        const mentions = [
          ...new Set(
            (body.match(/@[\p{L}\p{N}_.-]+/gu) || []).map((v: string) =>
              v.slice(1),
            ),
          ),
        ].slice(0, 20);
        const comment = {
          id: randomUUID(),
          projectId: project.id,
          tenantId: a.tenantId,
          userId: a.userId,
          displayName: a.displayName,
          body,
          mentions,
          createdAt: now,
          updatedAt: now,
        };
        await firestoreStore.saveProjectComment(comment);
        res.status(201).json({ success: true, comment });
      } catch (e) {
        next(e);
      }
    },
  );
  app.delete(
    "/api/projects/:projectId/comments/:commentId",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.projectId,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const deleted = await firestoreStore.deleteProjectComment(
          req.params.commentId,
          project.id,
          a.userId,
          a.tenantId,
        );
        if (!deleted)
          return res
            .status(404)
            .json({ error: "Comment not found", code: "COMMENT_NOT_FOUND" });
        res.json({ success: true });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/versions",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const versions = await firestoreStore.listProjectVersions(
          project.id,
          a.userId,
          a.tenantId,
        );
        res.json({ success: true, versions });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/projects/:projectId/versions/:versionId/restore",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.projectId,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        if (project.userId !== a.userId)
          return res.status(403).json({
            error: "Only the project owner can restore a previous version",
            code: "OWNER_REQUIRED",
          });
        const restored = await firestoreStore.restoreProjectVersion(
          req.params.versionId,
          project,
          a.userId,
        );
        if (!restored)
          return res
            .status(404)
            .json({ error: "Version not found", code: "VERSION_NOT_FOUND" });
        res.json({ success: true, project: restored });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/activity",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const activity = await firestoreStore.listProjectActivity(
          project.id,
          a.tenantId,
        );
        res.json({ success: true, activity });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/projects/:projectId/tasks/:taskId",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.projectId,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const allowed = new Set([
          "not_started",
          "ready",
          "in_progress",
          "blocked",
          "needs_review",
          "completed",
        ]);
        const status = String(req.body?.status || "");
        if (!allowed.has(status))
          return res
            .status(400)
            .json({ error: "Invalid task status", code: "INVALID_STATUS" });
        const idx = project.tasks.findIndex((t) => t.id === req.params.taskId);
        if (idx < 0)
          return res
            .status(404)
            .json({ error: "Task not found", code: "TASK_NOT_FOUND" });
        project.tasks[idx] = {
          ...project.tasks[idx],
          status: status as ProjectDNA["tasks"][number]["status"],
        };
        const updated = recalculateProject(project);
        {
          await firestoreStore.updateProject(updated, a.userId);
          if (status === "completed")
            await recordProductEventSafe(a, "task_completed", {
              projectId: project.id,
            });
          if (
            updated.status === "completed" &&
            project.status !== "completed"
          ) {
            await recordProductEventSafe(a, "project_completed", {
              projectId: project.id,
            });
            await emitWebhookSafe(a.tenantId, "project.completed", {
              projectId: project.id,
            });
          }
        }
        res.json({ success: true, project: updated });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/projects/:projectId/deliverables/:deliverableId",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.projectId,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const allowed = new Set([
          "pending",
          "in_progress",
          "ready",
          "completed",
        ]);
        const status = String(req.body?.status || "");
        if (!allowed.has(status))
          return res.status(400).json({
            error: "Invalid deliverable status",
            code: "INVALID_STATUS",
          });
        const idx = project.deliverables.findIndex(
          (d) => d.id === req.params.deliverableId,
        );
        if (idx < 0)
          return res.status(404).json({
            error: "Deliverable not found",
            code: "DELIVERABLE_NOT_FOUND",
          });
        project.deliverables[idx] = {
          ...project.deliverables[idx],
          status: status as ProjectDNA["deliverables"][number]["status"],
        };
        const updated = recalculateProject(project);
        await firestoreStore.updateProject(updated, a.userId);
        res.json({ success: true, project: updated });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/projects/:projectId/rubric/:criterionId",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.projectId,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const allowed = new Set([
          "covered",
          "partial",
          "not_evidenced",
          "needs_revision",
        ]);
        const readiness = String(req.body?.readiness || "");
        if (!allowed.has(readiness))
          return res.status(400).json({
            error: "Invalid rubric readiness",
            code: "INVALID_RUBRIC_STATUS",
          });
        const idx = project.rubric.findIndex(
          (r) => r.id === req.params.criterionId,
        );
        if (idx < 0)
          return res.status(404).json({
            error: "Rubric criterion not found",
            code: "RUBRIC_NOT_FOUND",
          });
        const evidenceIds = Array.isArray(req.body?.evidenceIds)
          ? req.body.evidenceIds.map(String).filter(Boolean).slice(0, 50)
          : project.rubric[idx].evidenceIds;
        project.rubric[idx] = {
          ...project.rubric[idx],
          readiness: readiness as ProjectDNA["rubric"][number]["readiness"],
          evidenceIds,
        };
        const updated = { ...project, updatedAt: new Date().toISOString() };
        await firestoreStore.updateProject(updated, a.userId);
        res.json({ success: true, project: updated });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/citations/export",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const evidence = await firestoreStore.listProjectEvidence(
          project.id,
          a.userId,
          a.tenantId,
        );
        const out = exportCitations(
          evidence,
          String(req.query.format || "ris").toLowerCase(),
          { locale: String(req.query.locale || project.language || "en") },
        );
        res.setHeader("Content-Type", out.contentType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(out.filename)}`,
        );
        res.send(out.data);
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/learning-evidence/export",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const evidence = await firestoreStore.listLearningEvidence(
          project.id,
          a.userId,
          a.tenantId,
        );
        const out = exportLearningEvidenceReport(
          project,
          evidence,
          String(req.query.format || "md").toLowerCase(),
          { locale: String(req.query.locale || project.language || "en") },
        );
        res.setHeader("Content-Type", out.contentType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(out.filename)}`,
        );
        res.send(out.data);
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/projects/:id/audit",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const [artifacts, evidence] = await Promise.all([
          firestoreStore.listWorkspaceArtifacts(project.id, a.tenantId),
          firestoreStore.listProjectEvidence(project.id, a.userId, a.tenantId),
        ]);
        const audit = runSubmissionAudit(project, { artifacts, evidence });
        {
          await firestoreStore.saveAudit(audit, project, a.userId);
          await recordProductEventSafe(a, "audit_run", {
            projectId: project.id,
            properties: { status: audit.status },
          });
          await emitWebhookSafe(a.tenantId, "submission.audit.completed", {
            projectId: project.id,
            auditId: audit.id,
            status: audit.status,
          });
        }
        res.json({ success: true, audit });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    ["/api/projects/:id/style-integrity", "/api/projects/:id/detect-ai"],
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const text = String(req.body?.text || "").trim();
        let targetText = text;
        if (!targetText) {
          const artifacts = await firestoreStore.listWorkspaceArtifacts(
            project.id,
            a.tenantId,
          );
          targetText = artifacts
            .filter((art) => !art.deletedAt && art.content)
            .map((art) => art.content)
            .join("\n\n");
        }
        const report = runStyleIntegrityAnalysis(targetText, String(req.body?.locale || project.language || "en"));
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "integrity.style_analysis_run",
          project.id,
          undefined,
          {
            styleRiskScore: report.styleRiskScore,
            verdict: report.verdict,
            clichéCount: report.metrics.clichéCount,
            citationVerificationFlags: report.metrics.citationVerificationFlags,
          },
        );
        res.json({ success: true, report });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    ["/api/projects/:id/improve-style", "/api/projects/:id/humanize"],
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const text = String(req.body?.text || "").trim();
        if (!text)
          return res.status(400).json({ error: "Text required" });

        const result = improveScholarlyStyle(text, String(req.body?.locale || project.language || "en"));
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "integrity.style_improved",
          project.id,
          undefined,
          { originalLength: text.length, improvements: result.improvementsMade.length },
        );
        res.json({
          success: true,
          improvedText: result.improvedText,
          // Backward-compatible key for older clients. This is style improvement, not detector evasion.
          humanizedText: result.improvedText,
          improvementsMade: result.improvementsMade,
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/projects/:id/export-bundle",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });

        const [artifacts, evidence] = await Promise.all([
          firestoreStore.listWorkspaceArtifacts(project.id, a.tenantId),
          firestoreStore.listProjectEvidence(project.id, a.userId, a.tenantId),
        ]);
        const audit = runSubmissionAudit(project, { artifacts, evidence });

        const zip = new JSZip();
        
        const combinedMarkdown = artifacts
          .filter(art => !art.deletedAt)
          .map(art => `# ${art.title}\n\n${art.content || ""}\n\n---\n`)
          .join("\n");
        zip.file("research_paper.md", combinedMarkdown || `# ${project.title}\n\n`);

        const dossierData = {
          projectId: project.id,
          title: project.title,
          student: a.displayName || a.email,
          createdAt: project.createdAt,
          hash: createHash("sha256").update(combinedMarkdown + project.id).digest("hex"),
          auditStatus: audit.status,
          score: audit.score,
        };
        zip.file("academic_dossier.json", JSON.stringify(dossierData, null, 2));

        const styleIntegrityReport = runStyleIntegrityAnalysis(combinedMarkdown);
        zip.file("style_integrity_report.json", JSON.stringify(styleIntegrityReport, null, 2));

        const bibText = evidence
          .map((e: any, idx: number) => `@article{ref${idx+1},\n  title = {${e.title || "Reference " + (idx+1)}},\n  url = {${e.url || ""}},\n  note = {${e.snippet || ""}}\n}`)
          .join("\n\n");
        zip.file("references.bib", bibText || "% No references recorded yet");

        zip.file("submission_audit.json", JSON.stringify(audit, null, 2));

        const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="AcademicOS_Turnkey_Bundle_${project.id}.zip"`);
        res.send(zipBuffer);
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/skills",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const skills = await buildSkills(a.userId, a.tenantId);
        res.json({ success: true, skills });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/me/export",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const profile = await firestoreStore.getProfile(a.userId, a.tenantId, {
          displayName: a.displayName,
          email: a.email,
        });
        const projects = await firestoreStore.listProjects(
          a.userId,
          a.tenantId,
        );
        const projectData = [];
        for (const project of projects) {
          const evidence = await firestoreStore.listProjectEvidence(
            project.id,
            a.userId,
            a.tenantId,
          );
          const learningEvidence = await firestoreStore.listLearningEvidence(
            project.id,
            a.userId,
            a.tenantId,
          );
          projectData.push({ project, evidence, learningEvidence });
        }
        const payload = {
          exportedAt: new Date().toISOString(),
          userId: a.userId,
          tenantId: a.tenantId,
          profile,
          projects: projectData,
        };
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent("AcademicOS-my-data.json")}`,
        );
        res.send(Buffer.from(JSON.stringify(payload, null, 2), "utf8"));
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/passport",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const passport = await buildPassport(
          a.userId,
          a.tenantId,
          a.displayName,
        );
        res.json({ success: true, passport });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/control-plane",
    authenticate,
    requireRoles(
      "professor",
      "course_coordinator",
      "department_admin",
      "college_admin",
      "university_admin",
      "ai_governance_officer",
      "accreditation_officer",
      "national_admin",
      "admin",
      "superadmin",
      "root_owner",
    ),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const control = await firestoreStore.getControlPlane(a.tenantId);
        control.system = {
          mode: "production",
          firebase: firebaseInitialized,
          aiConfigured: aiConfigured(),
          storageConfigured: Boolean(process.env.FIREBASE_STORAGE_BUCKET),
          billingConfigured: billingStatus().configured,
          dataRegion: process.env.DATA_REGION || "global",
          maintenance: process.env.MAINTENANCE_MODE === "true",
        };
        res.json({ success: true, control });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/admin/fair-use",
    authenticate,
    requireRoles("trust_safety_admin", "university_admin", "admin", "superadmin", "root_owner"),
    async (_req: AuthenticatedRequest, res, next) => {
      try {
        res.json({ success: true, fairUse: await fairUseMetrics() });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/institution/command-center",
    authenticate,
    requireRoles(
      "department_admin",
      "college_admin",
      "university_admin",
      "ai_governance_officer",
      "accreditation_officer",
      "national_admin",
      "admin",
      "superadmin",
      "root_owner",
    ),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        let control;
        let courses;
        let assignments;
        let submissions: CourseSubmissionRecord[];
        {
          [control, courses, assignments, submissions] = await Promise.all([
            firestoreStore.getControlPlane(a.tenantId),
            firestoreStore.listCourses(a.tenantId),
            firestoreStore.listTenantAssignments(a.tenantId),
            firestoreStore.listTenantSubmissions(a.tenantId, 1000),
          ]);
        }
        const status = ocrStatus(),
          notices = Boolean(
            (process.env.EMAIL_DELIVERY_ENDPOINT &&
              process.env.EMAIL_API_KEY) ||
            (process.env.PUSH_PROVIDER && process.env.PUSH_API_KEY) ||
            (process.env.SMS_PROVIDER && process.env.SMS_API_KEY),
          );
        const serviceState = {
          authentication: firebaseInitialized,
          database: firebaseInitialized,
          storage: Boolean(process.env.FIREBASE_STORAGE_BUCKET),
          ai: aiConfigured(),
          ocr: status.configured,
          malware: externalServices.virusScan.configured(),
          notifications: notices,
          backup: externalServices.backup.configured(),
          billing: billingStatus().configured,
        };
        res.json({
          success: true,
          command: buildInstitutionCommandCenter({
            control,
            courses,
            assignments,
            submissions,
            serviceState,
          }),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/admin/users/:uid/impersonation-token",
    authenticate,
    requireRoles(
      "support_agent",
      "university_admin",
      "admin",
      "superadmin",
      "root_owner",
    ),
    requireRecentPrivilegedAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const reason = cleanField(req.body?.reason, 500);
        if (!reason)
          return res
            .status(400)
            .json({ error: "Reason is required", code: "REASON_REQUIRED" });
        if (process.env.IMPERSONATION_ENABLED !== "true")
          return res.status(403).json({
            error: "Impersonation is disabled by deployment policy",
            code: "IMPERSONATION_DISABLED",
          });
        const config = (
          await platformStore.list("systemConfig", a.tenantId, { limit: 50 })
        ).find((x) => x.data?.impersonationAllowed === true);
        if (!config)
          return res.status(403).json({
            error: "Impersonation is disabled by institution policy",
            code: "IMPERSONATION_TENANT_DISABLED",
          });
        const target = await getAuth().getUser(String(req.params.uid));
        const targetTenant = userTenantId(target as any),
          targetRole = userRole(target as any);
        if (targetTenant !== a.tenantId)
          return res.status(403).json({
            error: "User is outside the authenticated tenant",
            code: "TENANT_SCOPE",
          });
        const permitted =
          a.role === "support_agent"
            ? canSupportImpersonate(targetRole)
            : canManageUserRole(a.role, targetRole);
        if (!permitted)
          return res.status(403).json({
            error: "This role is outside your impersonation support scope",
            code: "IMPERSONATION_PRIVILEGED_BLOCKED",
          });
        const minutes = Math.min(
          30,
          Math.max(5, Number(req.body?.minutes || 15)),
        );
        const expiresAt = Date.now() + minutes * 60000;
        const token = await getAuth().createCustomToken(target.uid, {
          tenantId: targetTenant,
          role: targetRole,
          impersonatorId: a.userId,
          impersonatorRole: a.role,
          impersonationReadOnly: true,
          impersonationExpiresAt: expiresAt,
        });
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "impersonation.token.create",
          target.uid,
          reason,
          {
            readOnly: true,
            targetRole,
            expiresAt: new Date(expiresAt).toISOString(),
          },
        );
        res.status(201).json({
          success: true,
          token,
          expiresAt: new Date(expiresAt).toISOString(),
          readOnly: true,
          warning:
            "Use only in an isolated support session. Every write is blocked server-side.",
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/admin/users",
    authenticate,
    requireRoles(...USER_ADMIN_ROLES),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          limit = Math.min(200, Math.max(20, Number(req.query.limit || 100))),
          pageToken = cleanField(req.query.pageToken, 1000) || undefined;
        const page = await getAuth().listUsers(limit, pageToken);
        const users = page.users
          .filter((u) => userTenantId(u as any) === a.tenantId)
          .map(toAdminUserRecord)
          .sort((x, y) =>
            (x.displayName || x.email || x.id).localeCompare(
              y.displayName || y.email || y.id,
            ),
          );
        res.json({
          success: true,
          users,
          nextPageToken: page.pageToken || null,
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.patch(
    "/api/admin/users/:uid",
    authenticate,
    requireRoles(...USER_ADMIN_ROLES),
    requireRecentPrivilegedAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!,
          uid = String(req.params.uid || "");
        const reason = cleanField(req.body?.reason, 500);
        if (!reason)
          return res.status(400).json({
            error: "Reason is required for user-management changes",
            code: "REASON_REQUIRED",
          });
        const auth = getAuth(),
          target = await auth.getUser(uid);
        const targetTenant = userTenantId(target as any),
          targetRole = userRole(target as any);
        if (targetTenant !== a.tenantId)
          return res.status(403).json({
            error: "User is outside the authenticated tenant",
            code: "TENANT_SCOPE",
          });
        if (targetRole === "root_owner")
          return res.status(403).json({
            error: "Root Owner cannot be changed from routine user management",
            code: "ROOT_PROTECTED",
          });
        if (targetRole === "superadmin" && a.role !== "root_owner")
          return res.status(403).json({
            error: "Only Root Owner can manage a Super Admin",
            code: "ROOT_REQUIRED",
          });
        if (!canManageUserRole(a.role, targetRole))
          return res.status(403).json({
            error: "Your role cannot manage this account",
            code: "TARGET_ROLE_PROTECTED",
          });
        if (
          uid === a.userId &&
          (typeof req.body?.disabled === "boolean" || req.body?.role)
        )
          return res.status(409).json({
            error:
              "Use a separate privileged account to change your own access",
            code: "SELF_PRIVILEGE_CHANGE_BLOCKED",
          });
        const updates: any = {};
        if (typeof req.body?.disabled === "boolean")
          updates.disabled = Boolean(req.body.disabled);
        let nextRole: UserRole = targetRole;
        if (req.body?.role !== undefined) {
          const requested = String(req.body.role) as UserRole;
          if (!assignableRoles(a.role).includes(requested))
            return res.status(403).json({
              error: "Your role cannot grant the requested permission level",
              code: "ROLE_ESCALATION_BLOCKED",
            });
          nextRole = requested;
        }
        if (Object.keys(updates).length) await auth.updateUser(uid, updates);
        if (nextRole !== targetRole)
          await auth.setCustomUserClaims(uid, {
            ...(target.customClaims || {}),
            tenantId: targetTenant,
            role: nextRole,
          });
        // Force privileged role/status changes to take effect on active sessions.
        if (nextRole !== targetRole || updates.disabled !== undefined)
          await auth.revokeRefreshTokens(uid);
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "user.management.update",
          uid,
          reason,
          {
            previousRole: targetRole,
            newRole: nextRole,
            disabled: updates.disabled,
            sessionsRevoked: true,
          },
        );
        const refreshed = await auth.getUser(uid);
        res.json({ success: true, user: toAdminUserRecord(refreshed) });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get(
    "/api/admin/summary",
    authenticate,
    requireRoles("admin", "superadmin", "root_owner", "university_admin"),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const control = await firestoreStore.getControlPlane(a.tenantId);
        res.json({
          success: true,
          metrics: control.metrics,
          system: {
            ...control.system,
            mode: "production",
            firebase: firebaseInitialized,
            aiConfigured: aiConfigured(),
            storageConfigured: Boolean(process.env.FIREBASE_STORAGE_BUCKET),
            billingConfigured: billingStatus().configured,
          },
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get("/api/billing/status", authenticate, (_req, res) =>
    res.json({ success: true, billing: billingStatus() }),
  );
  app.get(
    "/api/projects/:id/access",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const access = await platformStore.projectEntitlementAccess(
          a.tenantId,
          a.userId,
          project.id,
        );
        res.json({ success: true, access });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/billing/checkout",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(
          /\/$/,
          "",
        );
        if (
          process.env.NODE_ENV === "production" &&
          !appUrl.startsWith("https://")
        )
          return res.status(503).json({
            error:
              "Production APP_URL must use HTTPS before billing can be enabled",
            code: "BILLING_APP_URL_INVALID",
          });
        const idempotencyKey =
          cleanField(req.header("x-idempotency-key"), 120) || randomUUID();
        const selectedPlan = billingPlan(cleanField(req.body?.planId, 40));
        if (!selectedPlan || selectedPlan.id === "preview")
          return res.status(400).json({
            error: "اختر باقة مدفوعة صحيحة.",
            code: "BILLING_PLAN_INVALID",
          });
        const projectId = cleanField(req.body?.projectId, 180);
        if (!projectId)
          return res.status(400).json({
            error: "اختر المشروع الذي تريد فتحه قبل الدفع.",
            code: "BILLING_PROJECT_REQUIRED",
          });
        const project = await firestoreStore.getProject(
          projectId,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res.status(404).json({
            error: "المشروع غير موجود أو لا تملكه.",
            code: "PROJECT_NOT_FOUND",
          });
        if (project.collaborationMode === "group" && selectedPlan.id !== "group")
          return res.status(400).json({
            error: "مشروع المجموعة يحتاج باقة المجموعة.",
            code: "GROUP_PLAN_REQUIRED",
          });
        const provider = getBillingProvider();
        const result = await provider.createCheckout({
          customerEmail: a.email,
          customerName: a.displayName,
          tenantId: a.tenantId,
          userId: a.userId,
          projectId: project.id,
          idempotencyKey,
          planId: selectedPlan.id,
          amountUsd: selectedPlan.amountUsd,
          description: `AcademicOS — ${selectedPlan.name} — ${project.title}`,
          webhookUrl: `${appUrl}/api/billing/webhook/${provider.id}`,
          successUrl: `${appUrl}/app/plans?billing=success&plan=${selectedPlan.id}&project=${encodeURIComponent(project.id)}`,
          cancelUrl: `${appUrl}/app/plans?billing=cancelled&project=${encodeURIComponent(project.id)}`,
        });
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "billing.checkout.create",
          a.userId,
          undefined,
          { planId: selectedPlan.id, amountUsd: selectedPlan.amountUsd, projectId: project.id },
        );
        res.json({ success: true, ...result });
      } catch (e) {
        next(e);
      }
    },
  );
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API route not found", code: "NOT_FOUND" }),
  );
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const id = randomUUID();
    console.error(`[${id}]`, err);
    const status = Number(
      err?.status ||
        (err?.code === "AI_NOT_CONFIGURED" ||
        err?.code === "STORAGE_NOT_CONFIGURED" ||
        err?.code === "BILLING_NOT_CONFIGURED"
          ? 503
          : 500),
    );
    res.status(status).json({
      error:
        status >= 500
          ? "تعذر إكمال العملية. راجع إعدادات الخدمة أو حاول مرة أخرى."
          : err?.message,
      code: err?.code || "INTERNAL_ERROR",
      errorId: id,
    });
  });
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(
      express.static(distPath, {
        maxAge: "1h",
        setHeaders: (res, file) => {
          if (file.endsWith(".html") || file.endsWith("sw.js"))
            res.setHeader("Cache-Control", "no-cache");
          else if (/\/assets\/.+\.[a-f0-9]{8,}\./i.test(file))
            res.setHeader(
              "Cache-Control",
              "public, max-age=31536000, immutable",
            );
        },
      }),
    );
    app.get("*", (_req, res) =>
      res.sendFile(path.join(distPath, "index.html")),
    );
  }
  app.listen(PORT, "0.0.0.0", () =>
    console.log(`AcademicOS server running on :${PORT} (${"production"})`),
  );
}
startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});

import type {
  AcademicTimeMachine,
  AcademicSourceRecord,
  AcademicTrustGraph,
  AdminUserRecord,
  ApiKeyRecord,
  AssignmentIntake,
  CopilotMode,
  CopilotResponse,
  ControlPlaneData,
  CourseAssignmentRecord,
  CourseEnrollmentRecord,
  CourseJoinCodeRecord,
  CourseRecord,
  CourseSubmissionRecord,
  CurriculumTwinSimulation,
  CurriculumTwinSnapshot,
  DashboardSummary,
  EvidenceCapsule,
  FacultyAutomationBrief,
  FeatureFlagRecord,
  GlobalSearchItem,
  InstitutionCommandCenter,
  IntegrationStatusRecord,
  JobRecord,
  LearningBrain,
  LearningEvidenceRecord,
  MissionControlPlan,
  NotificationPreferences,
  NotificationRecord,
  PassportData,
  PlatformMetrics,
  PlatformRecord,
  PlatformRecordVersion,
  PlatformResourceKey,
  PublicPlatformShare,
  ProjectActivityRecord,
  ProjectAccess,
  ProjectComment,
  ProjectDocument,
  ProjectDNA,
  ProjectPresenceRecord,
  ProjectEvidence,
  ProjectMemberRecord,
  ProjectVersionRecord,
  ProjectWriterRequest,
  ProjectXRayReport,
  RescuePlan,
  SubmissionAudit,
  DeepAIDetectionReport,
  SupportTicket,
  UserProfile,
  VivaMode,
  VivaSession,
  WorkspaceArtifact,
  WorkspaceArtifactVersion,
} from "../types";
import { deviceTrustHeaders } from "./device-trust";

// The server generates academic content, audits, viva questions and plan copy in
// the learner's language. It reads that language from Accept-Language, so the
// active UI locale travels with every request instead of defaulting to one language.
const LOCALE_STORAGE_KEY = "academicos.locale.v1";
const SUPPORTED_LOCALES = ["ar", "en", "tr", "zh", "hi", "es", "fr", "ur"];

function activeLocale(): string {
  try {
    const documentLocale =
      typeof document !== "undefined"
        ? document.documentElement.getAttribute("lang")
        : null;
    if (documentLocale && SUPPORTED_LOCALES.includes(documentLocale))
      return documentLocale;
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;
  } catch {}
  return "en";
}

type TokenProvider = (forceRefresh?: boolean) => Promise<string | null>;
let tokenProvider: TokenProvider = async () => null;
let appCheckTokenProvider: TokenProvider = async () => null;

export function setApiTokenProvider(provider: TokenProvider) {
  tokenProvider = provider;
}
export function setApiAppCheckTokenProvider(provider: TokenProvider) {
  appCheckTokenProvider = provider;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  errorId?: string;
  constructor(
    message: string,
    status: number,
    code?: string,
    errorId?: string,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.errorId = errorId;
  }
}

async function authHeaders(init?: HeadersInit, forceRefresh = false) {
  const [token, appCheckToken] = await Promise.all([
    tokenProvider(forceRefresh),
    appCheckTokenProvider(forceRefresh),
  ]);
  const headers = new Headers(init || {});
  headers.set("Accept-Language", activeLocale());
  const trustHeaders = await deviceTrustHeaders();
  for (const [key, value] of Object.entries(trustHeaders)) headers.set(key, value);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (appCheckToken) headers.set("X-Firebase-AppCheck", appCheckToken);
  return headers;
}

function shouldRetryWithFreshIdToken(status: number, code?: string) {
  return (
    status === 401 &&
    ["AUTH_INVALID", "AUTH_EXPIRED"].includes(String(code || ""))
  );
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Keep the same idempotency key if a write is retried after refreshing the
  // Firebase ID token. This prevents an auth refresh from duplicating writes.
  const baseHeaders = new Headers(init.headers || {});
  if (!baseHeaders.has("Content-Type") && init.body)
    baseHeaders.set("Content-Type", "application/json");
  if (
    init.method &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(init.method.toUpperCase()) &&
    !baseHeaders.has("X-Idempotency-Key")
  )
    baseHeaders.set("X-Idempotency-Key", crypto.randomUUID());

  const perform = async (forceRefresh = false) => {
    const headers = await authHeaders(baseHeaders, forceRefresh);
    const response = await fetch(path, { ...init, headers });
    const payload = await response.json().catch(() => ({}));
    return { response, payload };
  };

  let result = await perform(false);
  if (
    !result.response.ok &&
    shouldRetryWithFreshIdToken(result.response.status, result.payload?.code)
  ) {
    result = await perform(true);
  }

  if (!result.response.ok)
    throw new ApiError(
      result.payload.error || "REQUEST_FAILED",
      result.response.status,
      result.payload.code,
      result.payload.errorId,
    );
  return result.payload as T;
}

async function download(path: string) {
  const headers = await authHeaders();
  const response = await fetch(path, { headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(
      payload.error || "EXPORT_FAILED",
      response.status,
      payload.code,
      payload.errorId,
    );
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const filename = utf ? decodeURIComponent(utf) : "AcademicOS-export";
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  platformResources: () =>
    request<{
      success: true;
      resources: Array<{
        key: PlatformResourceKey;
        read: boolean;
        write: boolean;
        category: string;
        label: string;
        description: string;
        statusValues: string[];
        suggestedFields: string[];
        external: boolean;
        sensitive: boolean;
      }>;
    }>("/api/platform/resources"),
  platformRecords: (resource: PlatformResourceKey, includeDeleted = false) =>
    request<{ success: true; records: PlatformRecord[] }>(
      `/api/platform/${encodeURIComponent(resource)}${includeDeleted ? "?deleted=1" : ""}`,
    ),
  createPlatformRecord: (
    resource: PlatformResourceKey,
    body: {
      title: string;
      status: string;
      data: Record<string, unknown>;
      reason?: string;
    },
  ) =>
    request<{ success: true; record: PlatformRecord }>(
      `/api/platform/${encodeURIComponent(resource)}`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  updatePlatformRecord: (
    resource: PlatformResourceKey,
    id: string,
    body: {
      title?: string;
      status?: string;
      data?: Record<string, unknown>;
      reason?: string;
    },
  ) =>
    request<{ success: true; record: PlatformRecord }>(
      `/api/platform/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ),
  deletePlatformRecord: (
    resource: PlatformResourceKey,
    id: string,
    reason: string,
  ) =>
    request<{ success: true }>(
      `/api/platform/${encodeURIComponent(resource)}/${encodeURIComponent(id)}`,
      { method: "DELETE", body: JSON.stringify({ reason }) },
    ),
  restorePlatformRecord: (
    resource: PlatformResourceKey,
    id: string,
    reason: string,
  ) =>
    request<{ success: true; record: PlatformRecord }>(
      `/api/platform/${encodeURIComponent(resource)}/${encodeURIComponent(id)}/restore`,
      { method: "POST", body: JSON.stringify({ reason }) },
    ),
  platformVersions: (resource: PlatformResourceKey, id: string) =>
    request<{ success: true; versions: PlatformRecordVersion[] }>(
      `/api/platform/${encodeURIComponent(resource)}/${encodeURIComponent(id)}/versions`,
    ),
  productMetrics: () =>
    request<{ success: true; metrics: PlatformMetrics }>(
      "/api/analytics/product",
    ),
  jobs: () => request<{ success: true; jobs: JobRecord[] }>("/api/jobs"),
  cancelJob: (id: string) =>
    request<{ success: true; job: JobRecord }>(
      `/api/jobs/${encodeURIComponent(id)}/cancel`,
      { method: "POST" },
    ),
  apiKeys: () =>
    request<{ success: true; keys: ApiKeyRecord[] }>("/api/admin/api-keys"),
  createApiKey: (name: string, scopes: string[], expiresAt?: string) =>
    request<{
      success: true;
      key: ApiKeyRecord;
      secret: string;
      warning: string;
    }>("/api/admin/api-keys", {
      method: "POST",
      body: JSON.stringify({ name, scopes, expiresAt }),
    }),
  revokeApiKey: (id: string, reason: string) =>
    request<{ success: true }>(
      `/api/admin/api-keys/${encodeURIComponent(id)}`,
      { method: "DELETE", body: JSON.stringify({ reason }) },
    ),
  notifications: () =>
    request<{ success: true; notifications: NotificationRecord[] }>(
      "/api/notifications",
    ),
  readNotification: (id: string) =>
    request<{ success: true }>(
      `/api/notifications/${encodeURIComponent(id)}/read`,
      { method: "PATCH" },
    ),
  readAllNotifications: () =>
    request<{ success: true; count: number }>("/api/notifications/read-all", {
      method: "POST",
    }),
  updateNotificationState: (
    id: string,
    body: { read?: boolean; archive?: boolean; snoozedUntil?: string },
  ) =>
    request<{ success: true }>(
      `/api/notifications/${encodeURIComponent(id)}/state`,
      { method: "PATCH", body: JSON.stringify(body) },
    ),
  notificationPreferences: () =>
    request<{ success: true; preferences: NotificationPreferences }>(
      "/api/notification-preferences",
    ),
  updateNotificationPreferences: (body: Partial<NotificationPreferences>) =>
    request<{ success: true; preferences: NotificationPreferences }>(
      "/api/notification-preferences",
      { method: "PATCH", body: JSON.stringify(body) },
    ),
  createShare: (body: {
    kind: "passport" | "portfolio" | "credential" | "project";
    targetId?: string;
    label?: string;
    expiresAt?: string;
    password?: string;
    watermark?: string;
    snapshot?: Record<string, unknown>;
  }) =>
    request<{ success: true; share: unknown; url: string }>("/api/shares", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  shares: () =>
    request<{
      success: true;
      shares: Array<{
        id: string;
        kind: string;
        label: string;
        expiresAt?: string;
        revokedAt?: string;
        passwordProtected?: boolean;
        watermark?: string;
        viewCount?: number;
        lastViewedAt?: string;
        createdAt: string;
      }>;
    }>("/api/shares"),
  revokeShare: (id: string) =>
    request<{ success: true }>(`/api/shares/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  accessPublicShare: (token: string, password: string) =>
    request<{ success: true; share: PublicPlatformShare }>(
      `/api/public/share/${encodeURIComponent(token)}/access`,
      { method: "POST", body: JSON.stringify({ password }) },
    ),
  requestDeletion: (reason: string, exportRequested = true) =>
    request<{ success: true; request: PlatformRecord }>(
      "/api/lifecycle/deletion-request",
      { method: "POST", body: JSON.stringify({ reason, exportRequested }) },
    ),
  cancelDeletion: (id: string) =>
    request<{ success: true; request: PlatformRecord }>(
      `/api/lifecycle/deletion-request/${encodeURIComponent(id)}/cancel`,
      { method: "POST" },
    ),
  publicConfig: () =>
    request<{
      securityContactEmail: string | null;
      responsibleDisclosure: string | null;
      statusPath: string;
    }>("/api/public/config"),
  branding: () =>
    request<{
      success: true;
      branding: {
        institutionName?: string;
        logoUrl?: string;
        primaryColor?: string;
        accentColor?: string;
        footer?: string;
        supportEmail?: string;
      };
    }>(`/api/branding`),
  publicShare: (token: string) =>
    request<{ success: true; share: PublicPlatformShare }>(
      `/api/public/share/${encodeURIComponent(token)}`,
    ),
  verifyEvidenceCapsule: (capsule: EvidenceCapsule) =>
    request<{
      success: true;
      verification: {
        hashValid: boolean;
        signatureValid: boolean | null;
        signerTrusted: boolean | null;
        status:
          "signed_trusted" | "signed_untrusted" | "hash_valid" | "invalid";
        keyId?: string;
      };
    }>("/api/public/evidence-capsule/verify", {
      method: "POST",
      body: JSON.stringify({ capsule }),
    }),
  courses: () =>
    request<{ success: true; courses: CourseRecord[] }>("/api/courses"),
  createCourse: (body: Partial<CourseRecord>) =>
    request<{ success: true; course: CourseRecord }>("/api/courses", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  course: (id: string) =>
    request<{
      success: true;
      course: CourseRecord;
      assignments: CourseAssignmentRecord[];
    }>(`/api/courses/${encodeURIComponent(id)}`),
  exportCourseArchive: (courseId: string, locale = "en") =>
    download(`/api/courses/${encodeURIComponent(courseId)}/archive?locale=${encodeURIComponent(locale)}`),
  joinCodes: (courseId: string) =>
    request<{ success: true; codes: CourseJoinCodeRecord[] }>(
      `/api/courses/${encodeURIComponent(courseId)}/join-codes`,
    ),
  createJoinCode: (courseId: string, maxUses = 100, expiresInDays = 30) =>
    request<{
      success: true;
      code: CourseJoinCodeRecord;
      secret: string;
      warning?: string;
    }>(`/api/courses/${encodeURIComponent(courseId)}/join-codes`, {
      method: "POST",
      body: JSON.stringify({ maxUses, expiresInDays }),
    }),
  regenerateJoinCode: (
    courseId: string,
    codeId: string,
    maxUses = 100,
    expiresInDays = 30,
  ) =>
    request<{ success: true; code: CourseJoinCodeRecord; secret: string }>(
      `/api/courses/${encodeURIComponent(courseId)}/join-codes/${encodeURIComponent(codeId)}/regenerate`,
      { method: "POST", body: JSON.stringify({ maxUses, expiresInDays }) },
    ),
  revokeJoinCode: (courseId: string, codeId: string) =>
    request<{ success: true }>(
      `/api/courses/${encodeURIComponent(courseId)}/join-codes/${encodeURIComponent(codeId)}`,
      { method: "DELETE" },
    ),
  joinCourse: (code: string) =>
    request<{ success: true; enrollment: CourseEnrollmentRecord }>(
      "/api/enrollments/join",
      { method: "POST", body: JSON.stringify({ code }) },
    ),
  updateCourse: (id: string, body: Partial<CourseRecord>) =>
    request<{ success: true; course: CourseRecord }>(
      `/api/courses/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ),
  cloneCourse: (
    id: string,
    body: Partial<Pick<CourseRecord, "code" | "title" | "term">> = {},
  ) =>
    request<{ success: true; course: CourseRecord; copiedAssignments: number }>(
      `/api/courses/${encodeURIComponent(id)}/clone`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  createCourseAssignment: (
    courseId: string,
    body: Partial<CourseAssignmentRecord>,
  ) =>
    request<{ success: true; assignment: CourseAssignmentRecord }>(
      `/api/courses/${encodeURIComponent(courseId)}/assignments`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  updateCourseAssignment: (
    courseId: string,
    id: string,
    body: Partial<CourseAssignmentRecord>,
  ) =>
    request<{ success: true; assignment: CourseAssignmentRecord }>(
      `/api/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ),
  cloneCourseAssignment: (courseId: string, id: string) =>
    request<{ success: true; assignment: CourseAssignmentRecord }>(
      `/api/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(id)}/clone`,
      { method: "POST" },
    ),
  assignmentQuality: (courseId: string, id: string) =>
    request<{
      success: true;
      quality: {
        status: "ready" | "attention" | "critical";
        checks: Array<{
          id: string;
          label: string;
          status: "pass" | "warning" | "critical";
          detail: string;
        }>;
      };
    }>(
      `/api/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(id)}/quality`,
    ),
  facultyCopilot: (query: string) =>
    request<{ success: true; source: "ai" | "scaffold"; answer: string; suggestions: string[]; warnings: string[] }>(
      "/api/faculty/copilot",
      { method: "POST", body: JSON.stringify({ query }) },
    ),
  facultyAutomation: () =>
    request<{ success: true; brief: FacultyAutomationBrief }>(
      "/api/faculty/automation",
    ),
  assignmentSubmissions: (courseId: string, assignmentId: string) =>
    request<{
      success: true;
      course: CourseRecord;
      assignment: CourseAssignmentRecord;
      submissions: CourseSubmissionRecord[];
    }>(
      `/api/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}/submissions`,
    ),
  gradeSubmission: (
    courseId: string,
    assignmentId: string,
    submissionId: string,
    body: {
      status: "returned" | "grading" | "graded" | "released";
      rubricGrades?: Array<{
        rubricId: string;
        awardedPoints: number;
        feedback?: string;
      }>;
      feedback?: string;
      returnedReason?: string;
    },
  ) =>
    request<{ success: true; submission: CourseSubmissionRecord }>(
      `/api/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submissionId)}/grade`,
      { method: "PATCH", body: JSON.stringify(body) },
    ),
  health: () =>
    request<{
      status: string;
      mode: string;
      firebase: boolean;
      aiConfigured: boolean;
      storageConfigured: boolean;
      billing: { provider: string; configured: boolean };
      ocr: {
        configured: boolean;
        primary: boolean;
        secondary: boolean;
        ensemble: boolean;
        required: boolean;
        minConfidence: number;
      };
      malware: { configured: boolean; required: boolean };
      notifications: { email: boolean; push: boolean; sms: boolean };
      backup: { configured: boolean };
      dataRegion: string;
      maintenance: boolean;
      incidentBanner?: string;
    }>("/api/health"),
  integrations: () =>
    request<{ success: true; integrations: IntegrationStatusRecord[] }>(
      "/api/integrations/status",
    ),
  featureFlags: () =>
    request<{ success: true; flags: FeatureFlagRecord[] }>(
      "/api/feature-flags",
    ),
  updateFeatureFlag: (key: string, enabled: boolean) =>
    request<{ success: true; flag: FeatureFlagRecord }>(
      `/api/feature-flags/${encodeURIComponent(key)}`,
      { method: "PATCH", body: JSON.stringify({ enabled }) },
    ),
  search: (q: string) =>
    request<{ success: true; results: GlobalSearchItem[] }>(
      `/api/search?q=${encodeURIComponent(q)}`,
    ),
  dashboard: () =>
    request<{ success: true; summary: DashboardSummary }>("/api/dashboard"),
  learningBrain: () =>
    request<{ success: true; brain: LearningBrain }>("/api/intelligence/brain"),
  missionControl: () =>
    request<{
      success: true;
      mission: MissionControlPlan;
      brain: LearningBrain;
    }>("/api/intelligence/mission-control"),
  curriculumTwin: (programId?: string) =>
    request<{
      success: true;
      twin: CurriculumTwinSnapshot;
      programs: Array<{ id: string; title: string; status: string }>;
    }>(
      `/api/intelligence/curriculum-twin${programId ? `?programId=${encodeURIComponent(programId)}` : ""}`,
    ),
  simulateCurriculumTwin: (body: {
    programId?: string;
    removeCourseIds?: string[];
    courseOutcomeOverrides?: Record<string, string[]>;
    termOverrides?: Record<string, string>;
  }) =>
    request<{ success: true; simulation: CurriculumTwinSimulation }>(
      "/api/intelligence/curriculum-twin/simulate",
      { method: "POST", body: JSON.stringify(body) },
    ),
  projects: () =>
    request<{ success: true; projects: ProjectDNA[] }>("/api/projects"),
  project: (id: string) =>
    request<{ success: true; project: ProjectDNA }>(
      `/api/projects/${encodeURIComponent(id)}`,
    ),
  rescuePlan: (id: string, minutes = 180) =>
    request<{ success: true; plan: RescuePlan }>(
      `/api/projects/${encodeURIComponent(id)}/rescue-plan?minutes=${encodeURIComponent(String(minutes))}`,
    ),
  projectSubmission: (id: string) =>
    request<{ success: true; submission: CourseSubmissionRecord | null }>(
      `/api/projects/${encodeURIComponent(id)}/submission`,
    ),
  mySubmissions: () =>
    request<{ success: true; submissions: CourseSubmissionRecord[] }>(
      "/api/my/submissions",
    ),
  submitProject: (
    projectId: string,
    courseId: string,
    assignmentId: string,
    confirmWarnings = false,
  ) =>
    request<{ success: true; submission: CourseSubmissionRecord }>(
      `/api/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(assignmentId)}/submissions`,
      { method: "POST", body: JSON.stringify({ projectId, confirmWarnings }) },
    ),
  original: (id: string) =>
    request<{
      success: true;
      text?: string;
      files: Array<{
        fileName: string;
        fileType?: string;
        url?: string;
        size?: number;
        sha256?: string;
      }>;
      expiresInSeconds?: number;
    }>(`/api/projects/${encodeURIComponent(id)}/original`),
  exportProject: (
    id: string,
    format:
      "zip" | "json" | "md" | "csv" | "docx" | "pptx" | "xlsx" | "pdf" = "zip",
  ) =>
    download(`/api/projects/${encodeURIComponent(id)}/export?format=${format}`),
  exportMyData: () => download("/api/me/export"),
  exportCitations: (id: string, format: "ris" | "bibtex" | "json" = "ris", locale = "en") =>
    download(
      `/api/projects/${encodeURIComponent(id)}/citations/export?format=${format}&locale=${encodeURIComponent(locale)}`,
    ),
  exportLearningEvidence: (id: string, format: "md" | "json" = "md", locale = "en") =>
    download(
      `/api/projects/${encodeURIComponent(id)}/learning-evidence/export?format=${format}&locale=${encodeURIComponent(locale)}`,
    ),
  createProject: (intake: AssignmentIntake) =>
    request<{
      success: true;
      project: ProjectDNA;
      job: {
        id: string;
        state: string;
        progress: number;
        stages: Array<{
          key: string;
          label: string;
          state: string;
          at?: string;
        }>;
      };
    }>("/api/projects/compile", {
      method: "POST",
      body: JSON.stringify(intake),
    }),
  projectDocument: (projectId: string) =>
    request<{ success: true; document: ProjectDocument | null; access: ProjectAccess }>(
      `/api/projects/${encodeURIComponent(projectId)}/writer`,
    ),
  projectAccess: (projectId: string) =>
    request<{ success: true; access: ProjectAccess }>(
      `/api/projects/${encodeURIComponent(projectId)}/access`,
    ),
  generateProjectDocument: (projectId: string, body: ProjectWriterRequest) =>
    request<{
      success: true;
      document: ProjectDocument;
      project: ProjectDNA;
      access: ProjectAccess;
      source: "ai" | "safe_scaffold";
      notice?: string;
    }>(`/api/projects/${encodeURIComponent(projectId)}/writer/generate`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  projectXRay: (projectId: string, draft?: string) =>
    request<{ success: true; report: ProjectXRayReport }>(
      `/api/projects/${encodeURIComponent(projectId)}/xray`,
      { method: "POST", body: JSON.stringify({ draft }) },
    ),
  projectSectionAction: (
    projectId: string,
    artifactId: string,
    body: {
      action:
        | "explain"
        | "simplify"
        | "expand"
        | "shorten"
        | "voice"
        | "academic"
        | "translate"
        | "challenge"
        | "source";
      instruction?: string;
      assistanceMode?: ProjectWriterRequest["assistanceMode"];
      apply?: boolean;
    },
  ) =>
    request<{
      success: true;
      artifact: WorkspaceArtifact;
      applied: boolean;
      output: {
        summary: string;
        findings: string[];
        suggestions: string[];
        warnings: string[];
      };
    }>(
      `/api/projects/${encodeURIComponent(projectId)}/writer/section/${encodeURIComponent(artifactId)}/action`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  updateTask: (projectId: string, taskId: string, status: string) =>
    request<{ success: true; project: ProjectDNA }>(
      `/api/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
    ),
  updateDeliverable: (
    projectId: string,
    deliverableId: string,
    status: string,
  ) =>
    request<{ success: true; project: ProjectDNA }>(
      `/api/projects/${encodeURIComponent(projectId)}/deliverables/${encodeURIComponent(deliverableId)}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
    ),
  updateRubric: (
    projectId: string,
    criterionId: string,
    readiness: string,
    evidenceIds?: string[],
  ) =>
    request<{ success: true; project: ProjectDNA }>(
      `/api/projects/${encodeURIComponent(projectId)}/rubric/${encodeURIComponent(criterionId)}`,
      { method: "PATCH", body: JSON.stringify({ readiness, evidenceIds }) },
    ),
  projectMembers: (projectId: string) =>
    request<{
      success: true;
      members: ProjectMemberRecord[];
      owner: { userId: string };
    }>(`/api/projects/${encodeURIComponent(projectId)}/members`),
  heartbeatPresence: (projectId: string, location = "project") =>
    request<{ success: true; presence?: ProjectPresenceRecord }>(
      `/api/projects/${encodeURIComponent(projectId)}/presence`,
      { method: "POST", body: JSON.stringify({ location }) },
    ),
  projectPresence: (projectId: string) =>
    request<{ success: true; presence: ProjectPresenceRecord[] }>(
      `/api/projects/${encodeURIComponent(projectId)}/presence`,
    ),
  inviteProjectMember: (projectId: string, email: string) =>
    request<{ success: true; member: ProjectMemberRecord }>(
      `/api/projects/${encodeURIComponent(projectId)}/members`,
      { method: "POST", body: JSON.stringify({ email }) },
    ),
  updateProjectMember: (
    projectId: string,
    memberId: string,
    body: Partial<Pick<ProjectMemberRecord, "status">>,
  ) =>
    request<{ success: true; member: ProjectMemberRecord }>(
      `/api/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ),
  invitations: () =>
    request<{ success: true; invitations: ProjectMemberRecord[] }>(
      "/api/invitations",
    ),
  respondInvitation: (id: string, decision: "accept" | "decline") =>
    request<{ success: true; member: ProjectMemberRecord }>(
      `/api/invitations/${encodeURIComponent(id)}/respond`,
      { method: "POST", body: JSON.stringify({ decision }) },
    ),
  artifacts: (projectId: string, deleted = false) =>
    request<{ success: true; artifacts: WorkspaceArtifact[] }>(
      `/api/projects/${encodeURIComponent(projectId)}/artifacts${deleted ? "?deleted=1" : ""}`,
    ),
  createArtifact: (
    projectId: string,
    body: Pick<
      WorkspaceArtifact,
      "module" | "kind" | "title" | "content" | "status"
    > &
      Partial<
        Pick<WorkspaceArtifact, "deliverableId" | "rubricIds" | "isCanonical">
      >,
  ) =>
    request<{ success: true; artifact: WorkspaceArtifact }>(
      `/api/projects/${encodeURIComponent(projectId)}/artifacts`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  updateArtifact: (
    projectId: string,
    id: string,
    body: Partial<
      Pick<
        WorkspaceArtifact,
        "kind" | "title" | "content" | "status" | "rubricIds" | "isCanonical"
      >
    > & {
      deliverableId?: string | null;
      propagateArtifactIds?: string[];
      baseRevision?: number;
    },
  ) =>
    request<{
      success: true;
      artifact: WorkspaceArtifact;
      impact?: Array<{
        id: string;
        title: string;
        exactReplacePossible: boolean;
      }>;
      propagated?: string[];
    }>(
      `/api/projects/${encodeURIComponent(projectId)}/artifacts/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ),
  twinImpact: (projectId: string, id: string, nextContent: string) =>
    request<{
      success: true;
      impact: Array<{
        id: string;
        title: string;
        module: string;
        exactReplacePossible: boolean;
        occurrences: number;
      }>;
    }>(
      `/api/projects/${encodeURIComponent(projectId)}/artifacts/${encodeURIComponent(id)}/impact`,
      { method: "POST", body: JSON.stringify({ nextContent }) },
    ),
  deleteArtifact: (projectId: string, id: string) =>
    request<{ success: true }>(
      `/api/projects/${encodeURIComponent(projectId)}/artifacts/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    ),
  restoreDeletedArtifact: (projectId: string, id: string) =>
    request<{ success: true; artifact: WorkspaceArtifact }>(
      `/api/projects/${encodeURIComponent(projectId)}/artifacts/${encodeURIComponent(id)}/restore`,
      { method: "POST" },
    ),
  artifactVersions: (projectId: string, id: string) =>
    request<{ success: true; versions: WorkspaceArtifactVersion[] }>(
      `/api/projects/${encodeURIComponent(projectId)}/artifacts/${encodeURIComponent(id)}/versions`,
    ),
  restoreArtifactVersion: (projectId: string, id: string, versionId: string) =>
    request<{ success: true; artifact: WorkspaceArtifact }>(
      `/api/projects/${encodeURIComponent(projectId)}/artifacts/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}/restore`,
      { method: "POST" },
    ),
  researchSourcesSearch: (query: string) =>
    request<{ success: true; provider: "crossref"; sources: AcademicSourceRecord[] }>(
      `/api/research/sources/search?q=${encodeURIComponent(query)}`,
    ),
  researchSourceDoi: (doi: string) =>
    request<{ success: true; provider: "crossref"; source: AcademicSourceRecord }>(
      `/api/research/sources/doi?doi=${encodeURIComponent(doi)}`,
    ),
  evidence: (projectId: string) =>
    request<{ success: true; evidence: ProjectEvidence[] }>(
      `/api/projects/${encodeURIComponent(projectId)}/evidence`,
    ),
  addEvidence: (
    projectId: string,
    item: Pick<ProjectEvidence, "type" | "title" | "detail"> & {
      sourceUrl?: string;
      relatedEvidenceIds?: string[];
      artifactId?: string;
      deliverableId?: string;
      rubricIds?: string[];
    },
  ) =>
    request<{ success: true; evidence: ProjectEvidence }>(
      `/api/projects/${encodeURIComponent(projectId)}/evidence`,
      { method: "POST", body: JSON.stringify(item) },
    ),
  deleteEvidence: (projectId: string, evidenceId: string) =>
    request<{ success: true }>(
      `/api/projects/${encodeURIComponent(projectId)}/evidence/${encodeURIComponent(evidenceId)}`,
      { method: "DELETE" },
    ),
  startViva: (projectId: string, mode: VivaMode) =>
    request<{ success: true; session: VivaSession }>(
      `/api/projects/${encodeURIComponent(projectId)}/viva`,
      { method: "POST", body: JSON.stringify({ mode }) },
    ),
  saveVivaResponse: (
    projectId: string,
    sessionId: string,
    questionId: string,
    answer: string,
  ) =>
    request<{ success: true; session: VivaSession }>(
      `/api/projects/${encodeURIComponent(projectId)}/viva/${encodeURIComponent(sessionId)}/respond`,
      { method: "PATCH", body: JSON.stringify({ questionId, answer }) },
    ),
  completeViva: (projectId: string, sessionId: string) =>
    request<{
      success: true;
      session: VivaSession;
      evidence: LearningEvidenceRecord;
    }>(
      `/api/projects/${encodeURIComponent(projectId)}/viva/${encodeURIComponent(sessionId)}/complete`,
      { method: "POST" },
    ),
  learningEvidence: (projectId: string) =>
    request<{ success: true; evidence: LearningEvidenceRecord[] }>(
      `/api/projects/${encodeURIComponent(projectId)}/learning-evidence`,
    ),
  comments: (projectId: string) =>
    request<{ success: true; comments: ProjectComment[] }>(
      `/api/projects/${encodeURIComponent(projectId)}/comments`,
    ),
  addComment: (projectId: string, body: string) =>
    request<{ success: true; comment: ProjectComment }>(
      `/api/projects/${encodeURIComponent(projectId)}/comments`,
      { method: "POST", body: JSON.stringify({ body }) },
    ),
  deleteComment: (projectId: string, commentId: string) =>
    request<{ success: true }>(
      `/api/projects/${encodeURIComponent(projectId)}/comments/${encodeURIComponent(commentId)}`,
      { method: "DELETE" },
    ),
  versions: (projectId: string) =>
    request<{ success: true; versions: ProjectVersionRecord[] }>(
      `/api/projects/${encodeURIComponent(projectId)}/versions`,
    ),
  restoreVersion: (projectId: string, versionId: string) =>
    request<{ success: true; project: ProjectDNA }>(
      `/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/restore`,
      { method: "POST" },
    ),
  activity: (projectId: string) =>
    request<{ success: true; activity: ProjectActivityRecord[] }>(
      `/api/projects/${encodeURIComponent(projectId)}/activity`,
    ),
  projectGraph: (projectId: string) =>
    request<{
      success: true;
      graph: {
        nodes: Array<Record<string, unknown>>;
        edges: Array<Record<string, unknown>>;
      };
    }>(`/api/projects/${encodeURIComponent(projectId)}/graph`),
  projectTimeMachine: (projectId: string) =>
    request<{ success: true; timeMachine: AcademicTimeMachine }>(
      `/api/projects/${encodeURIComponent(projectId)}/time-machine`,
    ),
  projectTrustGraph: (projectId: string) =>
    request<{ success: true; trustGraph: AcademicTrustGraph }>(
      `/api/projects/${encodeURIComponent(projectId)}/trust-graph`,
    ),
  evidenceCapsule: (projectId: string) =>
    request<{ success: true; capsule: EvidenceCapsule }>(
      `/api/projects/${encodeURIComponent(projectId)}/evidence-capsule`,
    ),
  exportEvidenceCapsule: (projectId: string) =>
    download(
      `/api/projects/${encodeURIComponent(projectId)}/evidence-capsule/export`,
    ),
  projectAssist: (
    projectId: string,
    body: {
      module: string;
      title?: string;
      content?: string;
      instruction?: string;
    },
  ) =>
    request<{
      success: true;
      faculty: {
        runId: string;
        agent: string;
        taskType: string;
        contextUsed: string[];
        output: {
          summary: string;
          findings: string[];
          suggestions: string[];
          warnings: string[];
        };
        disclosureRequired: boolean;
      };
      usage: {
        provider: string;
        model: string;
        estimatedCostUsd?: number;
        latencyMs: number;
      };
    }>(`/api/projects/${encodeURIComponent(projectId)}/assist`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  projectCopilot: (
    projectId: string,
    body: { mode: CopilotMode; query?: string },
  ) =>
    request<{ success: true; copilot: CopilotResponse }>(
      `/api/projects/${encodeURIComponent(projectId)}/copilot`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  aiFeedback: (
    runId: string,
    verdict: "helpful" | "incorrect" | "missing" | "report",
    note?: string,
  ) =>
    request<{ success: true }>("/api/ai/feedback", {
      method: "POST",
      body: JSON.stringify({ runId, verdict, note }),
    }),
  audit: (projectId: string) =>
    request<{ success: true; audit: SubmissionAudit }>(
      `/api/projects/${encodeURIComponent(projectId)}/audit`,
      { method: "POST" },
    ),
  redTeam: (projectId: string) =>
    request<{
      success: true;
      challenges: Array<{
        category: "methodology" | "sampling" | "generalizability" | "theoretical" | "requirements" | "evidence";
        challengeTitle: string;
        critiqueText: string;
        suggestedDefense: string;
      }>;
      provider: string;
    }>(`/api/projects/${encodeURIComponent(projectId)}/red-team`, { method: "POST" }),
  styleIntegrity: (projectId: string, text?: string, locale?: string) =>
    request<{ success: true; report: DeepAIDetectionReport }>(
      `/api/projects/${encodeURIComponent(projectId)}/style-integrity`,
      { method: "POST", body: JSON.stringify({ text, locale }) },
    ),
  improveStyle: (projectId: string, text: string, locale?: string) =>
    request<{
      success: true;
      improvedText: string;
      improvementsMade: string[];
    }>(`/api/projects/${encodeURIComponent(projectId)}/improve-style`, {
      method: "POST",
      body: JSON.stringify({ text, locale }),
    }),
  // Compatibility aliases for older callers. No authorship detection/evasion is performed.
  detectAI: (projectId: string, text?: string) =>
    request<{ success: true; report: DeepAIDetectionReport }>(
      `/api/projects/${encodeURIComponent(projectId)}/style-integrity`,
      { method: "POST", body: JSON.stringify({ text }) },
    ),
  humanize: (projectId: string, text: string) =>
    request<{ success: true; humanizedText: string; improvementsMade: string[] }>(
      `/api/projects/${encodeURIComponent(projectId)}/improve-style`,
      { method: "POST", body: JSON.stringify({ text }) },
    ),
  exportBundleUrl: (projectId: string) =>
    `/api/projects/${encodeURIComponent(projectId)}/export-bundle`,
  passport: () =>
    request<{ success: true; passport: PassportData }>("/api/passport"),
  skills: () =>
    request<{ success: true; skills: PassportData["skills"] }>("/api/skills"),
  supportTickets: () =>
    request<{ success: true; tickets: SupportTicket[] }>(
      "/api/support/tickets",
    ),
  createSupportTicket: (
    body: Pick<SupportTicket, "subject" | "message" | "category" | "priority">,
  ) =>
    request<{ success: true; ticket: SupportTicket }>("/api/support/tickets", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  adminSupportTickets: () =>
    request<{ success: true; tickets: SupportTicket[] }>(
      "/api/admin/support/tickets",
    ),
  updateSupportTicket: (
    id: string,
    body: Partial<Pick<SupportTicket, "status" | "assignedTo">>,
  ) =>
    request<{ success: true; ticket: SupportTicket }>(
      `/api/admin/support/tickets/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ),
  revokeSessions: () =>
    request<{ success: true; revokedAt: string }>(
      "/api/security/revoke-sessions",
      { method: "POST" },
    ),
  profile: () =>
    request<{ success: true; profile: UserProfile }>("/api/profile"),
  updateProfile: (patch: Partial<UserProfile>) =>
    request<{ success: true; profile: UserProfile }>("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  controlPlane: () =>
    request<{ success: true; control: ControlPlaneData }>("/api/control-plane"),
  institutionCommandCenter: () =>
    request<{ success: true; command: InstitutionCommandCenter }>(
      "/api/institution/command-center",
    ),
  fairUseMetrics: () =>
    request<{ success: true; fairUse: { eventsReviewed: number; deniedBenefits: number; stepUpSignals: number; suspiciousDevices: number; recent: Array<{ createdAt: string; benefit: string; score: number; reasonCodes: string[] }> } }>(
      "/api/admin/fair-use",
    ),
  adminSummary: () =>
    request<{
      success: true;
      metrics: Record<string, number>;
      system: Record<string, string | boolean | number>;
    }>("/api/admin/summary"),
  adminUsers: (pageToken?: string) =>
    request<{
      success: true;
      users: AdminUserRecord[];
      nextPageToken: string | null;
    }>(
      `/api/admin/users?limit=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`,
    ),
  updateAdminUser: (
    id: string,
    body: { role?: string; disabled?: boolean; reason: string },
  ) =>
    request<{ success: true; user: AdminUserRecord }>(
      `/api/admin/users/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ),
  billingStatus: () =>
    request<{
      success: true;
      billing: {
        provider: string;
        configured: boolean;
        currency: string; localProviderCurrency?: string; plans: Array<{ id: string; name: string; amountUsd: number; pages: number; projects: number; description: string }>;
      };
    }>("/api/billing/status"),
  createCheckout: (
    planId: "project" | "project_viva" | "group",
    projectId: string,
  ) =>
    request<{ success: true; url: string }>("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ planId, projectId }),
    }),
  learnIntake: (body: { note?: string; files?: Array<{ name: string; mimeType: string; base64: string; size: number }> }) =>
    request<{
      success: true;
      source: "ai" | "scaffold";
      materialText: string;
      guide: { summary: string; keyIdeas: string[]; examPrompts: string[]; warnings: string[] };
    }>("/api/learn/intake", { method: "POST", body: JSON.stringify(body) }),
  learnExplain: (body: {
    topic: string;
    language?: string;
    level?: string;
    context?: string;
  }) =>
    request<{
      success: true;
      source: "ai" | "cache" | "scaffold";
      lesson: {
        topic: string;
        language: string;
        level: string;
        intuition: string;
        buildingBlocks: string[];
        workedExample: string[];
        checkYourself: string[];
        commonMistakes: string[];
        source: string;
        notice?: string;
      };
    }>("/api/learn/explain", { method: "POST", body: JSON.stringify(body) }),
  learnSolve: (body: {
    problem: string;
    language?: string;
    context?: string;
    courseId?: string;
    assignmentId?: string;
  }) =>
    request<{
      success: true;
      source: "ai" | "cache" | "scaffold";
      decision: { mode: "worked" | "guided"; reason: string; disclosureRequired: boolean };
      result: {
        mode: "worked" | "guided";
        language: string;
        finalAnswer?: string;
        strategy?: string;
        steps: string[];
        verify: string[];
        practiceQuestion?: string;
        caveats: string[];
        disclosure: string;
        source: string;
        notice?: string;
      };
    }>("/api/learn/solve", { method: "POST", body: JSON.stringify(body) }),
};

// ---------------------------------------------------------------------------
// Advanced capabilities API (Ghost Cohort, Grade-Loss Map, Reverse Assessment,
// Clarification Room, Peer Explanation, Learning Black Box). Reuses the same
// authenticated `request` path as `api` above. See src/server/advanced/*.
// ---------------------------------------------------------------------------
export const advancedApi = {
  ghostCohort: (assignmentId: string, projectId?: string) =>
    request<any>(`/api/assignments/${encodeURIComponent(assignmentId)}/ghost-cohort${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`),
  gradeLossMap: (assignmentId: string, projectId?: string) =>
    request<any>(`/api/assignments/${encodeURIComponent(assignmentId)}/grade-loss-map${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`),
  reverseAssessmentBrief: (projectId: string) =>
    request<{ instruction: string; targets: string[] }>(`/api/projects/${encodeURIComponent(projectId)}/reverse-assessment/brief`),
  reverseAssessment: (projectId: string, questions: unknown[]) =>
    request<any>(`/api/projects/${encodeURIComponent(projectId)}/reverse-assessment`, { method: "POST", body: JSON.stringify({ questions }) }),
  answerClarification: (threadId: string, body: { answer: string; addRequirements?: string[]; clarifyDeadline?: string }) =>
    request<any>(`/api/clarifications/${encodeURIComponent(threadId)}/answer`, { method: "POST", body: JSON.stringify(body) }),
  submitPeerExplanation: (courseId: string, body: { concept: string; transcript: string; durationSeconds: number; language?: string; referenceMaterial?: string }) =>
    request<any>(`/api/courses/${encodeURIComponent(courseId)}/peer-explanations`, { method: "POST", body: JSON.stringify(body) }),
  verifyBlackBox: (projectId: string, chain: unknown, attach = false) =>
    request<any>(`/api/projects/${encodeURIComponent(projectId)}/black-box/verify`, { method: "POST", body: JSON.stringify({ ...(chain as object), attach }) }),
  legacyListing: (projectId: string, consent: { granted: boolean; scope?: string; allowContact?: boolean }) =>
    request<any>(`/api/projects/${encodeURIComponent(projectId)}/legacy-listing`, { method: "POST", body: JSON.stringify({ consent }) }),
};

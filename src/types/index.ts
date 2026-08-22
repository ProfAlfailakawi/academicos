export type UserRole =
  | "student"
  | "student_group_leader"
  | "teaching_assistant"
  | "professor"
  | "course_coordinator"
  | "department_admin"
  | "college_admin"
  | "university_admin"
  | "ai_governance_officer"
  | "accreditation_officer"
  | "national_admin"
  | "employer"
  | "support_agent"
  | "finance_admin"
  | "trust_safety_admin"
  | "admin"
  | "superadmin"
  | "root_owner";

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  tenantId: string;
  locale?: "ar" | "en";
  createdAt?: string;
  impersonation?: { actorId: string; readOnly: true; expiresAt: string };
}

export interface Tenant {
  id: string;
  name: string;
  type: "individual" | "team" | "institution" | "national";
  domain?: string;
  region?: string;
  createdAt: string;
}

export type ProjectStatus =
  | "not_started"
  | "ready"
  | "in_progress"
  | "blocked"
  | "needs_review"
  | "completed";
export type RequirementConfidence = "high" | "medium" | "needs_confirmation";

export interface SourceRequirement {
  description: string;
  minimumCount?: number;
  acceptedTypes?: string[];
}

export interface Requirement {
  id: string;
  label: string;
  value: string;
  source?: string;
  confidence: RequirementConfidence;
  category:
    | "deadline"
    | "format"
    | "content"
    | "policy"
    | "team"
    | "software"
    | "source"
    | "submission"
    | "other";
}

export interface Deliverable {
  id: string;
  title: string;
  format: string;
  status: "pending" | "in_progress" | "ready" | "completed";
  deadline?: string;
  ownerId?: string;
  validationRules?: string[];
  requirementSource?: string;
  fileId?: string;
}

export interface RubricCriterion {
  id: string;
  title: string;
  description: string;
  weighting: number;
  readiness?: "covered" | "partial" | "not_evidenced" | "needs_revision";
  evidenceIds?: string[];
  levels?: { title: string; description: string; points: number }[];
}

export interface ProjectTask {
  id: string;
  title: string;
  description?: string;
  status: ProjectStatus;
  dueDate?: string;
  estimatedMinutes?: number;
  assigneeId?: string;
  dependencyIds?: string[];
  module?: WorkspaceModule;
}

export type WorkspaceModule =
  | "research"
  | "writing"
  | "data"
  | "spreadsheet"
  | "code"
  | "engineering"
  | "lab"
  | "design"
  | "media"
  | "presentation"
  | "portfolio"
  | "survey"
  | "team"
  | "simulation"
  | "viva";

export interface AIUsagePolicy {
  level: 0 | 1 | 2 | 3 | 4 | 5;
  summary: string;
  allowed: string[];
  prohibited: string[];
  disclosureRequired: boolean;
  needsConfirmation?: boolean;
  provenance?:
    "published_assignment" | "course_policy" | "extracted_unverified";
  courseId?: string;
  assignmentId?: string;
}

export interface ProjectDNA {
  id: string;
  revision?: number;
  userId: string;
  tenantId: string;
  title: string;
  course: string;
  instructor?: string;
  projectType: string;
  academicDomain: string;
  complexity: "low" | "medium" | "high";
  collaborationMode: "individual" | "group";
  requiredSkills: string[];
  learningOutcomes: string[];
  requiredActions: string[];
  workspaceModules: WorkspaceModule[];
  requirements: Requirement[];
  deliverables: Deliverable[];
  rubric: RubricCriterion[];
  tasks: ProjectTask[];
  deadlines: {
    final?: string;
    timezone?: string;
    milestones: { id: string; title: string; date: string }[];
  };
  citationStyle?: string;
  sourceRequirements?: SourceRequirement[];
  softwareRequirements?: string[];
  aiPolicy: AIUsagePolicy;
  riskFlags: string[];
  estimatedWorkloadHours?: number;
  status: ProjectStatus;
  progress: number;
  nextAction?: string;
  originalAssignment?: {
    text?: string;
    fileName?: string;
    fileType?: string;
    storagePath?: string;
    attachments?: Array<{
      fileName: string;
      fileType?: string;
      storagePath?: string;
      size?: number;
      sha256?: string;
      extraction?: OcrExtractionRecord;
    }>;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AuditCheck {
  id: string;
  label: string;
  status: "pass" | "warning" | "critical" | "not_applicable";
  detail: string;
  relatedDeliverableId?: string;
  category?:
    | "deliverable"
    | "requirement"
    | "rubric"
    | "evidence"
    | "format"
    | "policy"
    | "deadline"
    | "accessibility"
    | "integrity";
  action?: string;
}

export interface SubmissionAudit {
  id: string;
  projectId: string;
  status: "ready" | "mostly_ready" | "needs_attention" | "critical_issues";
  checks: AuditCheck[];
  score?: number;
  blockingIssues?: number;
  warnings?: number;
  evidenceCoverage?: number;
  createdAt: string;
}

export interface OcrExtractionRecord {
  mode: "native_text" | "ocr" | "multimodal_ai";
  provider: string;
  confidence?: number;
  agreement?: number;
  languages?: string[];
  pageCount?: number;
  layoutPreserved?: boolean;
  needsReview: boolean;
  warnings: string[];
  extractedCharacters?: number;
}

export interface DashboardSummary {
  projects: ProjectDNA[];
  stats: {
    active: number;
    dueSoon: number;
    completed: number;
    workloadHours: number;
  };
  upcoming: {
    id: string;
    title: string;
    date: string;
    type: string;
    projectId?: string;
  }[];
  risks: {
    projectId: string;
    projectTitle: string;
    message: string;
    severity: "critical" | "important" | "normal";
  }[];
}

export interface SkillEvidence {
  id: string;
  skill: string;
  projectId: string;
  projectTitle: string;
  course: string;
  date: string;
  verificationLevel: "self" | "project" | "institution";
  evidence: string;
}

export interface PassportData {
  user: { displayName: string; education?: string; institution?: string };
  projects: Array<{
    id: string;
    title: string;
    course: string;
    status: string;
  }>;
  availableProjects?: Array<{
    id: string;
    title: string;
    course: string;
    status: string;
  }>;
  visibility?: "private" | "institution" | "shared_link" | "public";
  skills: SkillEvidence[];
  credentials: Array<{
    id: string;
    title: string;
    issuer: string;
    verification: string;
    date: string;
  }>;
}

export type VivaMode = "easy" | "normal" | "strict" | "external";

export interface VivaQuestion {
  id: string;
  prompt: string;
  focus: string;
  relatedRubricId?: string;
}

export interface VivaSession {
  id: string;
  projectId: string;
  userId: string;
  tenantId: string;
  mode: VivaMode;
  questions: VivaQuestion[];
  responses: Array<{ questionId: string; answer: string; updatedAt: string }>;
  status: "active" | "completed";
  createdAt: string;
  completedAt?: string;
}

export interface LearningEvidenceRecord {
  id: string;
  projectId: string;
  userId: string;
  tenantId: string;
  source: "viva" | "revision" | "decision" | "manual";
  summary: string;
  evidence: Array<{ label: string; value: string }>;
  createdAt: string;
}

export interface WorkspaceArtifact {
  id: string;
  projectId: string;
  tenantId: string;
  createdBy: string;
  updatedBy: string;
  module: WorkspaceModule;
  kind: string;
  title: string;
  content: string;
  status: "draft" | "in_progress" | "ready";
  deliverableId?: string;
  rubricIds?: string[];
  isCanonical?: boolean;
  createdAt: string;
  revision?: number;
  updatedAt: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface WorkspaceArtifactVersion {
  id: string;
  artifactId: string;
  projectId: string;
  tenantId: string;
  actorId: string;
  versionNumber: number;
  snapshot: WorkspaceArtifact;
  createdAt: string;
}

export type AcademicWorkMode = "write" | "rescue" | "revise";
export type AcademicAssistanceMode =
  | "practice"
  | "disclosed_submission"
  | "policy_strict";

export interface ProjectVariationProfile {
  id: string;
  argumentShape: string;
  structureRhythm: string;
  explanationStyle: string;
  exampleLens: string;
}

export interface ProjectDocumentSection {
  id: string;
  artifactId?: string;
  title: string;
  purpose: string;
  content: string;
  explanation: string;
  sourceNotes: string[];
  defenseQuestions: string[];
  rubricIds: string[];
  status: "planned" | "draft" | "verified";
  wordCount: number;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  mode: AcademicWorkMode;
  assistanceMode: AcademicAssistanceMode;
  language: string;
  title: string;
  abstract: string;
  sections: ProjectDocumentSection[];
  bibliography: string[];
  disclosure: string;
  integrityWarnings: string[];
  variation: ProjectVariationProfile;
  quality: {
    rubricCoverage: number;
    sourceConfidence: number;
    coherence: number;
    discussability: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWriterRequest {
  mode: AcademicWorkMode;
  assistanceMode: AcademicAssistanceMode;
  language?: string;
  desiredPages?: number;
  academicTone?: "clear" | "formal" | "advanced";
  topicNotes?: string;
  learnerVoiceSample?: string;
  existingDraft?: string;
  professorFeedback?: string;
}

export interface ProjectXRayFinding {
  id: string;
  severity: "good" | "attention" | "critical";
  category:
    | "structure"
    | "sources"
    | "rubric"
    | "coherence"
    | "language"
    | "understanding";
  title: string;
  detail: string;
  action: string;
}

export interface ProjectXRayReport {
  projectId: string;
  generatedAt: string;
  wordCount: number;
  estimatedPages: number;
  scores: {
    structure: number;
    sources: number;
    rubric: number;
    coherence: number;
    discussability: number;
  };
  findings: ProjectXRayFinding[];
  professorQuestions: string[];
}

export interface ProjectEvidence {
  id: string;
  projectId: string;
  userId: string;
  tenantId: string;
  type:
    | "source"
    | "claim"
    | "note"
    | "calculation"
    | "chart"
    | "code"
    | "decision"
    | "other";
  title: string;
  detail: string;
  sourceUrl?: string;
  relatedEvidenceIds?: string[];
  artifactId?: string;
  deliverableId?: string;
  rubricIds?: string[];
  verification: "unverified" | "user_verified" | "institution_verified";
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserRecord {
  id: string;
  email?: string;
  displayName?: string;
  role: UserRole;
  tenantId: string;
  disabled: boolean;
  emailVerified: boolean;
  createdAt?: string;
  lastSignInAt?: string;
}

export interface UserProfile {
  userId: string;
  tenantId: string;
  displayName: string;
  email: string;
  language?: "ar" | "en";
  country?: string;
  university?: string;
  specialization?: string;
  studyYear?: string;
  academicTerm?: string;
  courses?: string[];
  timezone?: string;
  dailyStudyMinutes?: number;
  onboardingCompleted: boolean;
  passportProjectIds?: string[];
  passportVisibility?: "private" | "institution" | "shared_link" | "public";
  updatedAt: string;
}

export interface TenantProjectSummary {
  id: string;
  title: string;
  course: string;
  userId: string;
  status: ProjectStatus;
  progress: number;
  deadline?: string;
  riskCount: number;
  aiPolicyLevel: number;
  updatedAt: string;
}

export interface ControlPlaneData {
  metrics: {
    users: number;
    projects: number;
    activeProjects: number;
    dueSoon: number;
    aiCostUsd: number;
    openIncidents: number;
    supportBacklog: number;
  };
  projects: TenantProjectSummary[];
  audit: Array<{
    id: string;
    actor: string;
    action: string;
    target: string;
    timestamp: string;
    reason?: string;
  }>;
  system: Record<string, string | boolean | number>;
}

export interface RescuePlan {
  projectId: string;
  generatedAt: string;
  severity: "steady" | "tight" | "critical";
  availableMinutes: number;
  remainingMinutes: number;
  deadline?: string;
  summary: string;
  phases: Array<{
    id: string;
    title: string;
    minutes: number;
    reason: string;
    taskIds: string[];
    mustDo: boolean;
  }>;
  deferredTaskIds: string[];
  requiresConfirmation: true;
}

export interface FacultyAutomationBrief {
  generatedAt: string;
  courses: number;
  assignments: number;
  publishedAssignments: number;
  actions: Array<{
    id: string;
    priority: "critical" | "important" | "normal";
    title: string;
    detail: string;
    path: string;
    courseId?: string;
    assignmentId?: string;
  }>;
  health: {
    outcomesMapped: number;
    rubricReady: number;
    deadlinesPresent: number;
    policyConfirmed: number;
  };
}

export interface InstitutionCommandCenter {
  generatedAt: string;
  posture: "healthy" | "attention" | "critical";
  decisions: Array<{
    id: string;
    priority: "critical" | "important" | "normal";
    title: string;
    detail: string;
    metric: string;
    recommendation: string;
  }>;
  memory: Array<{
    pattern: string;
    occurrences: number;
    affectedProjects: number;
    suggestedPlaybook: string;
  }>;
  twin: {
    projects: number;
    courses: number;
    assignments: number;
    outcomes: number;
    outcomeCoverage: number;
    submissions: number;
    graded: number;
    released: number;
  };
  operations: Array<{
    key: string;
    label: string;
    state: "ready" | "attention" | "blocked";
    detail: string;
  }>;
}

export interface AssignmentIntake {
  textContext?: string;
  file?: {
    name: string;
    mimeType: string;
    base64: string;
    size: number;
  };
  files?: Array<{
    name: string;
    mimeType: string;
    base64: string;
    size: number;
  }>;
  courseHint?: string;
  courseId?: string;
  assignmentId?: string;
  timezone?: string;
}

export interface CourseRecord {
  id: string;
  tenantId: string;
  ownerId: string;
  code: string;
  title: string;
  term?: string;
  description?: string;
  outcomes: string[];
  aiPolicy: AIUsagePolicy;
  status: "draft" | "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface CourseEnrollmentRecord {
  id: string;
  tenantId: string;
  courseId: string;
  userId: string;
  role: "student" | "teaching_assistant";
  status: "active" | "withdrawn" | "completed";
  source: "join_code" | "invite" | "roster" | "sso" | "sis";
  createdAt: string;
  updatedAt: string;
}

export interface CourseJoinCodeRecord {
  id: string;
  tenantId: string;
  courseId: string;
  prefix: string;
  status: "active" | "revoked" | "expired";
  maxUses: number;
  useCount: number;
  expiresAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseAssignmentRecord {
  id: string;
  tenantId: string;
  courseId: string;
  createdBy: string;
  title: string;
  instructions: string;
  deadline?: string;
  deliverables: Array<{ id: string; title: string; format: string }>;
  rubric: Array<{
    id: string;
    title: string;
    description: string;
    weighting: number;
  }>;
  outcomes: string[];
  aiPolicy: AIUsagePolicy;
  groupMode: "individual" | "group" | "either";
  status: "draft" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface CourseSubmissionRecord {
  id: string;
  tenantId: string;
  courseId: string;
  assignmentId: string;
  projectId: string;
  studentId: string;
  studentName: string;
  attempt: number;
  status: "submitted" | "returned" | "grading" | "graded" | "released";
  submittedAt: string;
  receiptHash: string;
  projectRevision: number;
  audit: SubmissionAudit;
  snapshot: {
    projectTitle: string;
    deliverables: Array<{
      id: string;
      title: string;
      format: string;
      status: string;
      fileId?: string;
    }>;
    artifactIds: string[];
    evidenceIds: string[];
  };
  rubricGrades: Array<{
    rubricId: string;
    title: string;
    maxPoints: number;
    awardedPoints: number;
    feedback?: string;
  }>;
  totalScore?: number;
  maxScore?: number;
  feedback?: string;
  gradedBy?: string;
  gradedAt?: string;
  releasedAt?: string;
  returnedReason?: string;
  updatedAt: string;
}

export interface IntegrationStatusRecord {
  key: string;
  name: string;
  category:
    | "storage"
    | "lms"
    | "productivity"
    | "identity"
    | "code"
    | "calendar"
    | "communications"
    | "billing"
    | "ai"
    | "documents"
    | "operations"
    | "search"
    | "speech"
    | "crm";
  configured: boolean;
  mode: "server" | "tenant_oauth" | "contract";
  description: string;
  setupKeys: string[];
}

export interface FeatureFlagRecord {
  key: string;
  tenantId: string;
  enabled: boolean;
  description: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SupportTicket {
  id: string;
  tenantId: string;
  userId: string;
  displayName: string;
  email?: string;
  category:
    "account" | "academic" | "billing" | "technical" | "security" | "other";
  priority: "normal" | "important" | "critical";
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GlobalSearchItem {
  id: string;
  type: "project" | "course" | "assignment";
  title: string;
  subtitle: string;
  path: string;
  updatedAt: string;
}

export interface ProjectMemberRecord {
  id: string;
  projectId: string;
  tenantId: string;
  userId?: string;
  email: string;
  displayName?: string;
  role: "leader" | "member" | "reviewer";
  status: "pending" | "active" | "revoked";
  invitedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectPresenceRecord {
  projectId: string;
  tenantId: string;
  userId: string;
  displayName: string;
  location?: string;
  lastSeenAt: string;
}

export interface ProjectComment {
  id: string;
  projectId: string;
  tenantId: string;
  userId: string;
  displayName: string;
  body: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectVersionRecord {
  id: string;
  projectId: string;
  tenantId: string;
  userId: string;
  actorId: string;
  summary: string;
  versionNumber: number;
  snapshot: ProjectDNA;
  createdAt: string;
}

export interface ProjectActivityRecord {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  reason?: string;
}

export type PlatformResourceKey =
  | "institutions"
  | "campuses"
  | "departments"
  | "programs"
  | "academicTerms"
  | "enrollments"
  | "affiliations"
  | "institutionDirectory"
  | "templates"
  | "templateVersions"
  | "semesterTemplates"
  | "regionalAcademicStyles"
  | "gradingScales"
  | "accommodations"
  | "alternativeDeadlines"
  | "challenges"
  | "challengePolicies"
  | "marketplaceItems"
  | "marketplacePolicies"
  | "announcements"
  | "notificationRules"
  | "announcementsAudit"
  | "webhooks"
  | "apiKeys"
  | "jobs"
  | "deletionRequests"
  | "backupRuns"
  | "backupPolicies"
  | "migrationRuns"
  | "rolloverRuns"
  | "recycleBin"
  | "aiModels"
  | "aiPrompts"
  | "aiEvaluations"
  | "aiRoutingPolicies"
  | "aiBudgets"
  | "aiAuditSamples"
  | "knowledgeBase"
  | "organizationKnowledge"
  | "retentionPolicies"
  | "dataResidencyPolicies"
  | "minorUserPolicies"
  | "privacyPolicies"
  | "credentials"
  | "credentialPolicies"
  | "nationalFrameworks"
  | "accreditationSnapshots"
  | "outcomeSamples"
  | "institutionBenchmarks"
  | "curriculumMaps"
  | "contracts"
  | "entitlements"
  | "licenses"
  | "seatAssignments"
  | "slaPolicies"
  | "salesLeads"
  | "supportEntitlements"
  | "securityReports"
  | "securityAlerts"
  | "securityEventsConfig"
  | "subscriptions"
  | "transactions"
  | "fraudRules"
  | "profitGuardrails"
  | "externalTools"
  | "externalToolPolicies"
  | "integrationConfigs"
  | "lmsConfigs"
  | "ssoConfigs"
  | "emailConfigs"
  | "emailTemplates"
  | "emailPreferences"
  | "referenceLibrary"
  | "researchSources"
  | "semanticIndexes"
  | "courseImports"
  | "gradeImports"
  | "submissionAttempts"
  | "dataExports"
  | "portfolioItems"
  | "portfolioPolicies"
  | "publicTrustIndicators"
  | "userReports"
  | "institutionFeedback"
  | "ipPolicies"
  | "systemConfig"
  | "brandConfig"
  | "currencySettings"
  | "serviceIncidents"
  | "domainClaims"
  | "institutionVerifications";

export interface PlatformRecord<T = Record<string, unknown>> {
  id: string;
  resource: PlatformResourceKey;
  tenantId: string;
  ownerId?: string;
  status: string;
  title: string;
  data: T;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface PlatformRecordVersion {
  id: string;
  recordId: string;
  resource: PlatformResourceKey;
  tenantId: string;
  version: number;
  snapshot: PlatformRecord;
  actorId: string;
  reason?: string;
  createdAt: string;
}

export interface ProductEventRecord {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  projectId?: string;
  courseId?: string;
  properties: Record<string, string | number | boolean | null>;
  provenance?: "server" | "client";
  createdAt: string;
}

export interface PlatformMetrics {
  activation: number;
  firstAssignmentSuccess: number;
  secondProjectRetention: number;
  projectCompletion: number;
  paidConversion: number;
  submissionAuditUsage: number;
  vivaUsage: number;
  eventCounts: Record<string, number>;
  ai: { runs: number; costUsd: number; failures: number };
}

export interface AIOutputFeedback {
  id: string;
  tenantId: string;
  userId: string;
  runId: string;
  verdict: "helpful" | "incorrect" | "missing" | "report";
  note?: string;
  createdAt: string;
}

export interface ApiKeyRecord {
  id: string;
  tenantId: string;
  name: string;
  prefix: string;
  scopes: string[];
  status: "active" | "revoked";
  createdBy: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

export interface JobRecord {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  state: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  stages: Array<{
    key: string;
    label: string;
    state: "pending" | "running" | "completed" | "failed";
    at?: string;
  }>;
  idempotencyKey?: string;
  inputHash?: string;
  resultRef?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionConfiguration {
  institutionName: string;
  terminology?: Record<string, string>;
  brand?: {
    logoUrl?: string;
    primaryColor?: string;
    accentColor?: string;
    footer?: string;
    supportEmail?: string;
  };
  domain?: string;
  region?: string;
  currency?: string;
  timezone?: string;
  minimumCohortSize?: number;
  ageMinimum?: number;
  impersonationAllowed?: boolean;
  retentionDays?: number;
  ai?: {
    allowedProviders?: string[];
    blockedProviders?: string[];
    sensitiveDataAllowed?: boolean;
    defaultPolicyLevel?: number;
    dataRetentionDays?: number;
  };
}

export interface PublicShareRecord {
  id: string;
  tenantId: string;
  userId: string;
  kind: "passport" | "portfolio" | "credential" | "project";
  targetId: string;
  tokenHash: string;
  label: string;
  expiresAt?: string;
  revokedAt?: string;
  passwordProtected?: boolean;
  watermark?: string;
  viewCount?: number;
  lastViewedAt?: string;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  tenantId: string;
  userId: string;
  type:
    | "deadline"
    | "assignment"
    | "comment"
    | "mention"
    | "audit"
    | "team"
    | "subscription"
    | "announcement"
    | "security"
    | "system";
  priority: "critical" | "important" | "normal";
  title: string;
  body: string;
  targetPath?: string;
  actionLabel?: string;
  groupKey?: string;
  groupCount?: number;
  requiresAction?: boolean;
  channels: Array<"in_app" | "email" | "push" | "sms">;
  delivery: Record<string, "pending" | "sent" | "failed" | "disabled">;
  readAt?: string;
  snoozedUntil?: string;
  archivedAt?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface NotificationPreferences {
  inApp: boolean;
  email: boolean;
  push: boolean;
  smsCriticalOnly: boolean;
  digest: "realtime" | "daily" | "weekly";
  quietHours: { enabled: boolean; start: string; end: string };
  timezone: string;
}

export interface LearningBrainSkill {
  skill: string;
  requiredInProjects: number;
  evidenceCount: number;
  institutionVerifiedCount: number;
  latestEvidenceAt?: string;
  state: "established" | "developing" | "needed";
  projectIds: string[];
}

export interface LearningBrain {
  generatedAt: string;
  projectsAnalyzed: number;
  completedProjects: number;
  evidenceItems: number;
  strengths: LearningBrainSkill[];
  growthAreas: LearningBrainSkill[];
  recurringPatterns: Array<{
    label: string;
    occurrences: number;
    projectIds: string[];
  }>;
  momentum: Array<{
    label: string;
    value: string;
    tone: "positive" | "neutral";
  }>;
  recommendedFocus: Array<{
    skill: string;
    reason: string;
    projectId?: string;
    projectTitle?: string;
  }>;
  basis: string;
}

export interface MissionControlAction {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  reason: string;
  estimatedMinutes: number;
  priority: "critical" | "important" | "normal";
  taskId?: string;
  module?: WorkspaceModule;
  dueAt?: string;
  skillFocus?: string;
  path: string;
}

export interface MissionControlPlan {
  generatedAt: string;
  date: string;
  availableMinutes: number;
  availableMinutesSource: "profile" | "default";
  suggestedMinutes: number;
  pressure: {
    level: "calm" | "busy" | "critical";
    message: string;
    dueWithinSevenDays: number;
  };
  actions: MissionControlAction[];
  deferred: Array<{ projectId: string; projectTitle: string; reason: string }>;
  brainFocus?: { skill: string; reason: string };
  concierge?: {
    headline: string;
    explanation: string;
    automationCandidates: Array<{
      id: string;
      title: string;
      detail: string;
      path: string;
      requiresConfirmation: boolean;
    }>;
  };
}

export interface AcademicTimeMachineEvent {
  id: string;
  at: string;
  kind:
    | "created"
    | "plan"
    | "work"
    | "evidence"
    | "ai"
    | "review"
    | "viva"
    | "submission"
    | "version"
    | "system";
  title: string;
  detail: string;
  actorType: "human" | "ai" | "system";
  actor?: string;
  source: string;
  version?: number;
}

export interface AcademicTimeMachine {
  projectId: string;
  generatedAt: string;
  events: AcademicTimeMachineEvent[];
  summary: {
    humanEvents: number;
    aiEvents: number;
    evidenceEvents: number;
    versions: number;
    firstAt?: string;
    latestAt?: string;
  };
}

export interface TrustGraphNode {
  id: string;
  type:
    | "project"
    | "deliverable"
    | "rubric"
    | "artifact"
    | "evidence"
    | "skill"
    | "learning_evidence";
  label: string;
  trust: "recorded" | "user_verified" | "institution_verified" | "derived";
  meta?: Record<string, string | number | boolean | null>;
}

export interface TrustGraphEdge {
  id: string;
  from: string;
  to: string;
  relation:
    | "requires"
    | "supports"
    | "satisfies"
    | "measures"
    | "proves"
    | "belongs_to"
    | "derived_from";
  basis: "explicit" | "system_derived";
}

export interface AcademicTrustGraph {
  projectId: string;
  generatedAt: string;
  nodes: TrustGraphNode[];
  edges: TrustGraphEdge[];
  canonicalSources: Array<{
    artifactId: string;
    title: string;
    module: WorkspaceModule;
    updatedAt: string;
    linkedDeliverable?: string;
    linkedRubric: string[];
  }>;
  coverage: {
    deliverablesLinked: number;
    deliverablesTotal: number;
    rubricLinked: number;
    rubricTotal: number;
    verifiedEvidence: number;
    totalEvidence: number;
  };
  note: string;
}

export interface EvidenceCapsule {
  schemaVersion: "1.0";
  generatedAt: string;
  project: {
    id: string;
    title: string;
    course: string;
    status: string;
    updatedAt: string;
  };
  skills: Array<{
    skill: string;
    verificationLevel: string;
    evidence: string;
    date: string;
  }>;
  deliverables: Array<{ title: string; format: string; status: string }>;
  rubric: Array<{ title: string; weighting: number; readiness: string }>;
  proofOfLearning: Array<{
    id: string;
    source: string;
    summary: string;
    createdAt: string;
  }>;
  provenance: {
    artifacts: number;
    canonicalArtifacts: number;
    evidenceItems: number;
    verifiedEvidenceItems: number;
    aiAssistedRuns: number;
    humanContributors: number;
  };
  integrity: {
    algorithm: "SHA-256";
    hash: string;
    signatureStatus: "signed" | "hash_only";
    signature?: string;
    signatureAlgorithm?: "Ed25519";
    publicKeySpki?: string;
    keyId?: string;
  };
  disclosure: string;
}

export interface CurriculumTwinCourse {
  id: string;
  code: string;
  title: string;
  term?: string;
  outcomes: string[];
  assignmentCount: number;
  assignmentOutcomeLinks: number;
}

export interface CurriculumTwinOutcome {
  outcome: string;
  courseIds: string[];
  assignmentIds: string[];
  status: "covered" | "thin" | "uncovered";
}

export interface CurriculumTwinSnapshot {
  generatedAt: string;
  programId?: string;
  programTitle?: string;
  courses: CurriculumTwinCourse[];
  outcomes: CurriculumTwinOutcome[];
  uncoveredOutcomes: string[];
  thinOutcomes: string[];
  duplicateSignals: Array<{ outcome: string; courseCount: number }>;
  workloadByTerm: Array<{ term: string; assignments: number; courses: number }>;
  sourceNote: string;
}

export interface CurriculumTwinSimulation {
  baseline: CurriculumTwinSnapshot;
  scenario: CurriculumTwinSnapshot;
  impact: {
    removedCourses: Array<{ id: string; code: string; title: string }>;
    newlyUncoveredOutcomes: string[];
    reducedCoverageOutcomes: string[];
    assignmentEvidenceLinksLost: number;
    riskLevel: "low" | "moderate" | "high";
    summary: string;
  };
}

export interface PublicPlatformShare {
  kind: "passport" | "portfolio" | "credential" | "project";
  label: string;
  createdAt: string;
  expiresAt?: string;
  watermark?: string;
  viewCount?: number;
  snapshot: Record<string, unknown>;
}

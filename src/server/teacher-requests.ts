// Teacher-account requests.
//
// Anyone may sign up as a student and ask for a teacher account. The account
// keeps working as a student until a platform owner approves the request.
// Approval is the ONLY way this flow grants the professor role, it runs
// server-side with Firebase Admin custom claims, and it can never be performed
// by the requester (or by any role outside TEACHER_REQUEST_REVIEWER_ROLES).
//
// This module is pure with respect to infrastructure: the store and the claims
// admin are injected, so the rules can be unit-tested without Firebase.
import type { TeacherRequestRecord, TeacherRequestStatus, UserRole } from "../types";

export type { TeacherRequestRecord, TeacherRequestStatus };

/** Platform owners only: requests come from every tenant, including individual_* ones. */
export const TEACHER_REQUEST_REVIEWER_ROLES: readonly UserRole[] = ["admin", "superadmin", "root_owner"];
/** Roles that may ask for (and be promoted to) a teacher account. */
export const TEACHER_REQUEST_APPLICANT_ROLES: readonly UserRole[] = ["student", "student_group_leader"];
export const MAX_TEACHER_REQUEST_ATTEMPTS = 5;

export interface TeacherRequestStore {
  get(userId: string): Promise<TeacherRequestRecord | null>;
  set(record: TeacherRequestRecord): Promise<void>;
  list(status?: TeacherRequestStatus, limit?: number): Promise<TeacherRequestRecord[]>;
}

export interface ClaimsAdmin {
  getUser(uid: string): Promise<{ customClaims?: Record<string, unknown> | null; email?: string; displayName?: string }>;
  setCustomUserClaims(uid: string, claims: Record<string, unknown>): Promise<void>;
}

export class TeacherRequestError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max).split(String.fromCharCode(0)).join("") : "";

export function validateTeacherRequestInput(body: any): { institution: string; note?: string; displayName?: string } {
  const institution = clean(body?.institution, 160);
  if (institution.length < 2)
    throw new TeacherRequestError(400, "TEACHER_INSTITUTION_REQUIRED", "Institution name is required");
  const note = clean(body?.note, 1000);
  const displayName = clean(body?.displayName, 120);
  return { institution, ...(note ? { note } : {}), ...(displayName ? { displayName } : {}) };
}

export async function submitTeacherRequest(input: {
  store: TeacherRequestStore;
  actor: { userId: string; tenantId: string; role: UserRole; email?: string; displayName: string; emailVerified?: boolean };
  body: unknown;
  now?: () => string;
}): Promise<{ created: boolean; request: TeacherRequestRecord }> {
  const now = (input.now || (() => new Date().toISOString()))();
  const { actor } = input;
  if (!TEACHER_REQUEST_APPLICANT_ROLES.includes(actor.role))
    throw new TeacherRequestError(409, "TEACHER_ALREADY_FACULTY", "This account already has a non-student role");
  const value = validateTeacherRequestInput(input.body);
  const current = await input.store.get(actor.userId);
  if (current?.status === "approved")
    throw new TeacherRequestError(409, "TEACHER_REQUEST_ALREADY_APPROVED", "The request was already approved");
  if (current?.status === "rejected" && current.attempts >= MAX_TEACHER_REQUEST_ATTEMPTS)
    throw new TeacherRequestError(429, "TEACHER_REQUEST_LIMIT", "Too many teacher requests for this account");
  const request: TeacherRequestRecord = {
    id: actor.userId,
    userId: actor.userId,
    tenantId: actor.tenantId,
    email: actor.email || current?.email || "",
    displayName: value.displayName || actor.displayName || current?.displayName || "",
    emailVerified: Boolean(actor.emailVerified),
    institution: value.institution,
    ...(value.note ? { note: value.note } : {}),
    status: "pending",
    attempts: current ? (current.status === "rejected" ? current.attempts + 1 : current.attempts) : 1,
    createdAt: current?.createdAt || now,
    updatedAt: now,
  };
  await input.store.set(request);
  return { created: !current, request };
}

export async function decideTeacherRequest(input: {
  store: TeacherRequestStore;
  auth: ClaimsAdmin;
  reviewer: { userId: string; role: UserRole };
  targetUserId: string;
  decision: unknown;
  reason?: unknown;
  now?: () => string;
}): Promise<{ request: TeacherRequestRecord; role: UserRole }> {
  const now = (input.now || (() => new Date().toISOString()))();
  const { reviewer, targetUserId } = input;
  if (!TEACHER_REQUEST_REVIEWER_ROLES.includes(reviewer.role))
    throw new TeacherRequestError(403, "FORBIDDEN", "Insufficient permission");
  if (reviewer.userId === targetUserId)
    throw new TeacherRequestError(403, "TEACHER_SELF_DECISION_FORBIDDEN", "You cannot decide your own request");
  const decision = input.decision === "approve" || input.decision === "reject" ? input.decision : null;
  if (!decision) throw new TeacherRequestError(400, "TEACHER_DECISION_INVALID", "decision must be approve or reject");
  const reason = clean(input.reason, 1000);
  if (decision === "reject" && reason.length < 3)
    throw new TeacherRequestError(400, "TEACHER_REASON_REQUIRED", "A reason is required to reject a request");
  const current = await input.store.get(targetUserId);
  if (!current) throw new TeacherRequestError(404, "TEACHER_REQUEST_NOT_FOUND", "Request not found");
  if (current.status !== "pending")
    throw new TeacherRequestError(409, "TEACHER_REQUEST_ALREADY_DECIDED", "The request was already decided");

  let role: UserRole = "student";
  if (decision === "approve") {
    const user = await input.auth.getUser(targetUserId);
    const claims = (user.customClaims || {}) as Record<string, unknown>;
    const currentRole = String(claims.role || "student") as UserRole;
    if (currentRole !== "professor" && !TEACHER_REQUEST_APPLICANT_ROLES.includes(currentRole))
      // Never overwrite a higher/other role (e.g. an admin) with "professor".
      throw new TeacherRequestError(409, "TEACHER_TARGET_ROLE_NOT_STUDENT", "The account no longer has a student role");
    await input.auth.setCustomUserClaims(targetUserId, { ...claims, role: "professor" });
    role = "professor";
  }
  const next: TeacherRequestRecord = {
    ...current,
    status: decision === "approve" ? "approved" : "rejected",
    ...(reason ? { reason } : {}),
    decidedBy: reviewer.userId,
    decidedAt: now,
    updatedAt: now,
  };
  await input.store.set(next);
  return { request: next, role };
}

/** Firestore-backed store (collection `teacherRequests`, document id = user id). */
export function firestoreTeacherRequestStore(db: any): TeacherRequestStore {
  const col = () => db.collection("teacherRequests");
  return {
    async get(userId) {
      const doc = await col().doc(userId).get();
      return doc.exists ? (doc.data() as TeacherRequestRecord) : null;
    },
    async set(record) {
      await col().doc(record.id).set(JSON.parse(JSON.stringify(record)));
    },
    async list(status, limit = 200) {
      let query = col();
      if (status) query = query.where("status", "==", status);
      const snap = await query.limit(Math.min(500, Math.max(1, limit))).get();
      return snap.docs
        .map((d: any) => d.data() as TeacherRequestRecord)
        .sort((a: TeacherRequestRecord, b: TeacherRequestRecord) => b.updatedAt.localeCompare(a.updatedAt));
    },
  };
}

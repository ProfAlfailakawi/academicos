import type { UserRole } from '../types';

export const PRIVILEGED_MFA_ROLES = new Set<UserRole>([
  'support_agent', 'university_admin', 'ai_governance_officer', 'accreditation_officer',
  'national_admin', 'finance_admin', 'trust_safety_admin', 'admin', 'superadmin', 'root_owner',
]);

const ASSIGNABLE: Partial<Record<UserRole, ReadonlySet<UserRole>>> = {
  university_admin: new Set(['student','student_group_leader','teaching_assistant','professor','course_coordinator','department_admin','college_admin','ai_governance_officer','accreditation_officer','employer']),
  admin: new Set(['student','student_group_leader','teaching_assistant','professor','course_coordinator','department_admin','college_admin','university_admin','ai_governance_officer','accreditation_officer','employer','support_agent','finance_admin','trust_safety_admin']),
  superadmin: new Set(['student','student_group_leader','teaching_assistant','professor','course_coordinator','department_admin','college_admin','university_admin','ai_governance_officer','accreditation_officer','national_admin','employer','support_agent','finance_admin','trust_safety_admin','admin']),
  root_owner: new Set(['student','student_group_leader','teaching_assistant','professor','course_coordinator','department_admin','college_admin','university_admin','ai_governance_officer','accreditation_officer','national_admin','employer','support_agent','finance_admin','trust_safety_admin','admin','superadmin']),
};

export function privilegedMfaRequired(role: UserRole, env: NodeJS.ProcessEnv = process.env) {
  return PRIVILEGED_MFA_ROLES.has(role) && (env.NODE_ENV === 'production' && env.REQUIRE_ADMIN_MFA === 'true');
}

export function assignableRolesFor(actorRole: UserRole): UserRole[] {
  return [...(ASSIGNABLE[actorRole] || [])];
}

export function canManageUserRole(actorRole: UserRole, targetRole: UserRole) {
  return Boolean(ASSIGNABLE[actorRole]?.has(targetRole));
}

export function canSupportImpersonate(targetRole: UserRole) {
  return targetRole === 'student' || targetRole === 'student_group_leader';
}

export function normalizeRateRoute(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length) return '/';
  return `/${parts.slice(0, 2).map(part => (/^[0-9a-f-]{16,}$/i.test(part) || part.length > 48 ? ':id' : part)).join('/')}`;
}

export function validFutureIso(value: string, now = Date.now()) {
  const time = Date.parse(value);
  return Number.isFinite(time) && time > now;
}

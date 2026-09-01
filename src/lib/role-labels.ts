import type { UserRole } from "../types";

const ROLE_KEYS: Partial<Record<UserRole, string>> = {
  student: "layout.roleStudent",
  student_group_leader: "layout.roleGroupLeader",
  teaching_assistant: "layout.roleTeachingAssistant",
  professor: "layout.roleProfessor",
  course_coordinator: "layout.roleCourseCoordinator",
  department_admin: "layout.roleDepartmentAdmin",
  college_admin: "layout.roleCollegeAdmin",
  university_admin: "layout.roleUniversityAdmin",
  ai_governance_officer: "layout.roleAiGovernance",
  accreditation_officer: "layout.roleAccreditation",
  national_admin: "layout.roleNationalAdmin",
  employer: "layout.roleEmployer",
  support_agent: "layout.roleSupport",
  finance_admin: "layout.roleFinanceAdmin",
  trust_safety_admin: "layout.roleTrustSafety",
  admin: "layout.rolePlatformAdmin",
  superadmin: "layout.roleSuperAdmin",
  root_owner: "layout.roleRootOwner",
};

export function roleTranslationKey(role?: string): string {
  return ROLE_KEYS[role as UserRole] || "layout.roleDefault";
}

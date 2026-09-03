import React, { Suspense, lazy } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { Layout } from "./components/Layout";
import { AppSplash } from "./components/brand/AppSplash";
import { useI18n } from "./lib/i18n";
import { useAuth } from "./contexts/AuthContext";
import { adminMfaRequiredByDeployment } from "./lib/firebase";
const PublicHome = lazy(() =>
  import("./pages/PublicHome").then((m) => ({ default: m.PublicHome })),
);
const Login = lazy(() =>
  import("./pages/Login").then((m) => ({ default: m.Login })),
);
const MfaSetup = lazy(() =>
  import("./pages/MfaSetup").then((m) => ({ default: m.MfaSetup })),
);
const Projects = lazy(() =>
  import("./pages/Projects").then((m) => ({ default: m.Projects })),
);
const UploadAssignment = lazy(() =>
  import("./pages/UploadAssignment").then((m) => ({
    default: m.UploadAssignment,
  })),
);
const ProjectWorkspace = lazy(() =>
  import("./pages/ProjectWorkspace").then((m) => ({
    default: m.ProjectWorkspace,
  })),
);
const LearnStudio = lazy(() =>
  import("./pages/LearnStudio").then((m) => ({ default: m.LearnStudio })),
);
const Plans = lazy(() =>
  import("./pages/Plans").then((m) => ({ default: m.Plans })),
);
const Settings = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.Settings })),
);
const Onboarding = lazy(() =>
  import("./pages/Onboarding").then((m) => ({ default: m.Onboarding })),
);
const PublicPage = lazy(() =>
  import("./pages/PublicPage").then((m) => ({ default: m.PublicPage })),
);
const ProfessorOS = lazy(() =>
  import("./pages/ProfessorOS").then((m) => ({ default: m.ProfessorOS })),
);
const CourseOS = lazy(() =>
  import("./pages/CourseOS").then((m) => ({ default: m.CourseOS })),
);
const AssignmentSubmissions = lazy(() =>
  import("./pages/AssignmentSubmissions").then((m) => ({
    default: m.AssignmentSubmissions,
  })),
);
const SearchWorkspace = lazy(() =>
  import("./pages/SearchWorkspace").then((m) => ({
    default: m.SearchWorkspace,
  })),
);
const Support = lazy(() =>
  import("./pages/Support").then((m) => ({ default: m.Support })),
);
const PublicShare = lazy(() =>
  import("./pages/PublicShare").then((m) => ({ default: m.PublicShare })),
);
const Status = lazy(() =>
  import("./pages/Status").then((m) => ({ default: m.Status })),
);
const SecurityReport = lazy(() =>
  import("./pages/SecurityReport").then((m) => ({ default: m.SecurityReport })),
);
const MissionControl = lazy(() =>
  import("./pages/MissionControl").then((m) => ({ default: m.MissionControl })),
);
const RoleHome = lazy(() =>
  import("./pages/RoleHome").then((m) => ({ default: m.RoleHome })),
);
const ControlPlane = lazy(() =>
  import("./pages/ControlPlane").then((m) => ({ default: m.ControlPlane })),
);
const PlatformHub = lazy(() =>
  import("./pages/PlatformHub").then((m) => ({ default: m.PlatformHub })),
);
const Integrations = lazy(() =>
  import("./pages/Integrations").then((m) => ({ default: m.Integrations })),
);
const UserManagement = lazy(() =>
  import("./pages/UserManagement").then((m) => ({ default: m.UserManagement })),
);
const CurriculumTwin = lazy(() =>
  import("./pages/CurriculumTwin").then((m) => ({ default: m.CurriculumTwin })),
);
const SupportConsole = lazy(() =>
  import("./pages/SupportConsole").then((m) => ({ default: m.SupportConsole })),
);
const Calendar = lazy(() =>
  import("./pages/Calendar").then((m) => ({ default: m.Calendar })),
);
const Notifications = lazy(() =>
  import("./pages/Notifications").then((m) => ({ default: m.Notifications })),
);
const Skills = lazy(() =>
  import("./pages/Skills").then((m) => ({ default: m.Skills })),
);
const Passport = lazy(() =>
  import("./pages/Passport").then((m) => ({ default: m.Passport })),
);
const Archive = lazy(() =>
  import("./pages/Archive").then((m) => ({ default: m.Archive })),
);
const Invitations = lazy(() =>
  import("./pages/Invitations").then((m) => ({ default: m.Invitations })),
);
const Jobs = lazy(() =>
  import("./pages/Jobs").then((m) => ({ default: m.Jobs })),
);

const FACULTY_ROLES = new Set([
  "professor",
  "course_coordinator",
  "department_admin",
  "college_admin",
  "university_admin",
  "admin",
  "superadmin",
  "root_owner",
]);

const CONTROL_ROLES = new Set([
  "department_admin",
  "college_admin",
  "university_admin",
  "ai_governance_officer",
  "accreditation_officer",
  "national_admin",
  "admin",
  "superadmin",
  "root_owner",
]);
const PLATFORM_ADMIN_ROLES = new Set([
  "university_admin",
  "national_admin",
  "finance_admin",
  "trust_safety_admin",
  "admin",
  "superadmin",
  "root_owner",
]);
const USER_ADMIN_ROLES = new Set([
  "university_admin",
  "admin",
  "superadmin",
  "root_owner",
]);
const SUPPORT_ROLES = new Set([
  "support_agent",
  "trust_safety_admin",
  "admin",
  "superadmin",
  "root_owner",
]);

const PRIVILEGED_MFA_ROLES = new Set([
  "support_agent",
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

function ProtectedLayout() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  if (loading) return <AppSplash label={t("app.initializing")} />;
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (
    adminMfaRequiredByDeployment &&
    PRIVILEGED_MFA_ROLES.has(user.role) &&
    !user.mfaSatisfied
  )
    return <Navigate to="/mfa-setup" state={{ from: location.pathname }} replace />;
  return <Layout />;
}

function FacultyGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user && FACULTY_ROLES.has(user.role) ? (
    <>{children}</>
  ) : (
    <Navigate to="/app" replace />
  );
}

function RoleGuard({
  roles,
  children,
}: {
  roles: ReadonlySet<string>;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  return user && roles.has(user.role) ? (
    <>{children}</>
  ) : (
    <Navigate to="/app" replace />
  );
}

function HomeRoute() {
  const { user } = useAuth();
  if (user && ["student", "student_group_leader"].includes(user.role))
    return <MissionControl />;
  if (user && ["professor", "course_coordinator"].includes(user.role))
    return <ProfessorOS />;
  return <RoleHome />;
}

function AppSuspenseFallback() {
  return <AppSplash />;
}

export default function App() {
  return (
    <Suspense fallback={<AppSuspenseFallback />}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicHome />} />
          <Route path="/status" element={<Status />} />
          <Route path="/security-report" element={<SecurityReport />} />
          <Route path="/p/:slug" element={<PublicPage />} />
          <Route path="/share/:token" element={<PublicShare />} />
          <Route path="/login" element={<Login />} />
          <Route path="/mfa-setup" element={<MfaSetup />} />
          <Route path="/app" element={<ProtectedLayout />}>
            <Route index element={<HomeRoute />} />
            <Route path="search" element={<SearchWorkspace />} />
            <Route path="support" element={<Support />} />
            <Route
              path="professor"
              element={
                <FacultyGuard>
                  <ProfessorOS />
                </FacultyGuard>
              }
            />
            <Route
              path="course/:id"
              element={
                <FacultyGuard>
                  <CourseOS />
                </FacultyGuard>
              }
            />
            <Route
              path="course/:courseId/assignment/:assignmentId/submissions"
              element={
                <FacultyGuard>
                  <AssignmentSubmissions />
                </FacultyGuard>
              }
            />
            <Route path="onboarding" element={<Onboarding />} />
            <Route path="projects" element={<Projects />} />
            <Route path="upload" element={<UploadAssignment />} />
            <Route path="project/:id" element={<ProjectWorkspace />} />
            <Route path="learn" element={<LearnStudio />} />
            <Route path="plans" element={<Plans />} />
            <Route path="settings" element={<Settings />} />
            <Route path="semester" element={<Navigate to="/app" replace />} />
            <Route
              path="curriculum-twin"
              element={<RoleGuard roles={CONTROL_ROLES}><CurriculumTwin /></RoleGuard>}
            />
            <Route path="invitations" element={<Invitations />} />
            <Route
              path="support-console"
              element={<RoleGuard roles={SUPPORT_ROLES}><SupportConsole /></RoleGuard>}
            />
            <Route path="calendar" element={<Calendar />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="skills" element={<Skills />} />
            <Route path="passport" element={<Passport />} />
            <Route path="archive" element={<Archive />} />
            <Route path="jobs" element={<Jobs />} />
            <Route
              path="control"
              element={<RoleGuard roles={CONTROL_ROLES}><ControlPlane /></RoleGuard>}
            />
            <Route
              path="platform"
              element={<RoleGuard roles={PLATFORM_ADMIN_ROLES}><PlatformHub /></RoleGuard>}
            />
            <Route
              path="integrations"
              element={<RoleGuard roles={PLATFORM_ADMIN_ROLES}><Integrations /></RoleGuard>}
            />
            <Route
              path="users"
              element={<RoleGuard roles={USER_ADMIN_ROLES}><UserManagement /></RoleGuard>}
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </Suspense>
  );
}

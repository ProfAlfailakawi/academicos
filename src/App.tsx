import React, { Suspense, lazy, useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { Layout } from "./components/Layout";
import { useI18n } from "./lib/i18n";
import { useAuth } from "./contexts/AuthContext";
import { api } from "./lib/api";
const PublicHome = lazy(() =>
  import("./pages/PublicHome").then((m) => ({ default: m.PublicHome })),
);
const Login = lazy(() =>
  import("./pages/Login").then((m) => ({ default: m.Login })),
);
const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })),
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
const Calendar = lazy(() =>
  import("./pages/Calendar").then((m) => ({ default: m.Calendar })),
);
const Notifications = lazy(() =>
  import("./pages/Notifications").then((m) => ({ default: m.Notifications })),
);
const Skills = lazy(() =>
  import("./pages/Skills").then((m) => ({ default: m.Skills })),
);
const LearnStudio = lazy(() =>
  import("./pages/LearnStudio").then((m) => ({ default: m.LearnStudio })),
);
const Passport = lazy(() =>
  import("./pages/Passport").then((m) => ({ default: m.Passport })),
);
const Archive = lazy(() =>
  import("./pages/Archive").then((m) => ({ default: m.Archive })),
);
const Settings = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.Settings })),
);
const Onboarding = lazy(() =>
  import("./pages/Onboarding").then((m) => ({ default: m.Onboarding })),
);
const ControlPlane = lazy(() =>
  import("./pages/ControlPlane").then((m) => ({ default: m.ControlPlane })),
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
const SupportConsole = lazy(() =>
  import("./pages/SupportConsole").then((m) => ({ default: m.SupportConsole })),
);
const Invitations = lazy(() =>
  import("./pages/Invitations").then((m) => ({ default: m.Invitations })),
);
const Integrations = lazy(() =>
  import("./pages/Integrations").then((m) => ({ default: m.Integrations })),
);
const UserManagement = lazy(() =>
  import("./pages/UserManagement").then((m) => ({ default: m.UserManagement })),
);
const PlatformHub = lazy(() =>
  import("./pages/PlatformHub").then((m) => ({ default: m.PlatformHub })),
);
const Jobs = lazy(() =>
  import("./pages/Jobs").then((m) => ({ default: m.Jobs })),
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
const CurriculumTwin = lazy(() =>
  import("./pages/CurriculumTwin").then((m) => ({ default: m.CurriculumTwin })),
);
const RoleHome = lazy(() =>
  import("./pages/RoleHome").then((m) => ({ default: m.RoleHome })),
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
const SUPPORT_ROLES = new Set([
  "support_agent",
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
const CONTROL_ROLES = new Set([
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
]);
const PLATFORM_ROLES = new Set([
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
]);
const CURRICULUM_ROLES = new Set([
  "department_admin",
  "college_admin",
  "university_admin",
  "accreditation_officer",
  "admin",
  "superadmin",
  "root_owner",
]);

function ProtectedLayout() {
  const { user, loading, configured } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const [profileLoading, setProfileLoading] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  useEffect(() => {
    if (
      !user ||
      !["student", "student_group_leader"].includes(user.role)
    ) {
      setNeedsOnboarding(false);
      return;
    }
    let active = true;
    setProfileLoading(true);
    api
      .profile()
      .then((r) => {
        if (active) setNeedsOnboarding(!r.profile.onboardingCompleted);
      })
      .catch(() => {
        if (active) setNeedsOnboarding(false);
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id, user?.role]);
  if (loading || profileLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="eyebrow">{t("app.initializing")}</div>
      </div>
    );
  if (!user) {
    if (!configured)
      return (
        <Navigate to="/login" state={{ from: location.pathname }} replace />
      );
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (needsOnboarding && location.pathname !== "/app/onboarding")
    return <Navigate to="/app/onboarding" replace />;
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

function SupportGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user && SUPPORT_ROLES.has(user.role) ? (
    <>{children}</>
  ) : (
    <Navigate to="/app/support" replace />
  );
}

function UserAdminGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user && USER_ADMIN_ROLES.has(user.role) ? (
    <>{children}</>
  ) : (
    <Navigate to="/app" replace />
  );
}

function ControlGuard() {
  const { user } = useAuth();
  return user && CONTROL_ROLES.has(user.role) ? (
    <ControlPlane />
  ) : (
    <Navigate to="/app" replace />
  );
}
function PlatformGuard() {
  const { user } = useAuth();
  return user && PLATFORM_ROLES.has(user.role) ? (
    <PlatformHub />
  ) : (
    <Navigate to="/app" replace />
  );
}
function CurriculumGuard() {
  const { user } = useAuth();
  return user && CURRICULUM_ROLES.has(user.role) ? (
    <CurriculumTwin />
  ) : (
    <Navigate to="/app" replace />
  );
}
function HomeRoute() {
  const { user } = useAuth();
  return user && ["student", "student_group_leader"].includes(user.role) ? (
    <MissionControl />
  ) : (
    <RoleHome />
  );
}

function AppSuspenseFallback() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen grid place-items-center bg-[var(--bg)]">
      <div className="eyebrow">{t("app.opening")}</div>
    </div>
  );
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
          <Route path="/app" element={<ProtectedLayout />}>
            <Route index element={<HomeRoute />} />
            <Route path="semester" element={<Dashboard />} />
            <Route path="curriculum-twin" element={<CurriculumGuard />} />
            <Route path="invitations" element={<Invitations />} />
            <Route path="search" element={<SearchWorkspace />} />
            <Route path="support" element={<Support />} />
            <Route
              path="support-console"
              element={
                <SupportGuard>
                  <SupportConsole />
                </SupportGuard>
              }
            />
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
            <Route path="calendar" element={<Calendar />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="skills" element={<Skills />} />
            <Route path="learn" element={<LearnStudio />} />
            <Route path="passport" element={<Passport />} />
            <Route path="archive" element={<Archive />} />
            <Route path="jobs" element={<Jobs />} />
            <Route path="control" element={<ControlGuard />} />
            <Route path="platform" element={<PlatformGuard />} />
            <Route path="settings" element={<Settings />} />
            <Route path="integrations" element={<Integrations />} />
            <Route
              path="users"
              element={
                <UserAdminGuard>
                  <UserManagement />
                </UserAdminGuard>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </Suspense>
  );
}

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

function HomeRoute() {
  const { user } = useAuth();
  if (user && ["student", "student_group_leader"].includes(user.role))
    return <MissionControl />;
  if (user && ["professor", "course_coordinator"].includes(user.role))
    return <ProfessorOS />;
  return <RoleHome />;
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
            <Route path="curriculum-twin" element={<Navigate to="/app" replace />} />
            <Route path="invitations" element={<Navigate to="/app" replace />} />
            <Route path="support-console" element={<Navigate to="/app" replace />} />
            <Route path="calendar" element={<Navigate to="/app" replace />} />
            <Route path="notifications" element={<Navigate to="/app" replace />} />
            <Route path="skills" element={<Navigate to="/app" replace />} />
            <Route path="passport" element={<Navigate to="/app" replace />} />
            <Route path="archive" element={<Navigate to="/app" replace />} />
            <Route path="jobs" element={<Navigate to="/app" replace />} />
            <Route path="control" element={<Navigate to="/app" replace />} />
            <Route path="platform" element={<Navigate to="/app" replace />} />
            <Route path="integrations" element={<Navigate to="/app" replace />} />
            <Route path="users" element={<Navigate to="/app" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </Suspense>
  );
}

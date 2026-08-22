import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  Command,
  CreditCard,
  FolderKanban,
  GraduationCap,
  Home,
  ArrowLeft,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { useAppPreferences } from "../contexts/AppContext";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { predictNext, recordNavigation } from "../lib/predictiveNavigation";
import { useI18n } from "../lib/i18n";

type NavItem = {
  to: string;
  label: string;
  short: string;
  icon: React.ElementType;
  end?: boolean;
};
const studentNav: NavItem[] = [
  {
    to: "/app",
    label: "الرئيسية",
    short: "الرئيسية",
    icon: Home,
    end: true,
  },
  {
    to: "/app/projects",
    label: "مشاريعي",
    short: "المشاريع",
    icon: FolderKanban,
  },
  {
    to: "/app/learn",
    label: "مدرب الاختبارات",
    short: "اختباراتي",
    icon: Sparkles,
  },
  {
    to: "/app/plans",
    label: "الباقات",
    short: "الأسعار",
    icon: CreditCard,
  },
];

export function Layout() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useAppPreferences();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({
    ProfessorOS: true,
  });
  const [serviceNotice, setServiceNotice] = useState<{
    incident?: string;
    maintenance?: boolean;
  }>({});
  const [branding, setBranding] = useState<{
    institutionName?: string;
    logoUrl?: string;
    primaryColor?: string;
    accentColor?: string;
  }>({});
  const location = useLocation();
  const navigate = useNavigate();
  const previousPath = useRef<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLElement>(null);
  const menuWasOpen = useRef(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (user) {
      api
        .health()
        .then((h) =>
          setServiceNotice({
            incident: h.incidentBanner,
            maintenance: h.maintenance,
          }),
        )
        .catch(() => undefined);
      api
        .featureFlags()
        .then((r) =>
          setFeatureFlags(
            Object.fromEntries(r.flags.map((f) => [f.key, f.enabled])),
          ),
        )
        .catch(() => undefined);
      api
        .branding()
        .then((r) => setBranding(r.branding))
        .catch(() => setBranding({}));
    }
  }, [user?.id]);
  useEffect(() => {
    const root = document.documentElement;
    const previousTitle = document.title;
    const names = ["--brand", "--accent", "--brand-soft", "--brand-2"];
    const previous = Object.fromEntries(
      names.map((n) => [n, root.style.getPropertyValue(n)]),
    );
    if (branding.primaryColor) {
      root.style.setProperty("--brand", branding.primaryColor);
      root.style.setProperty(
        "--brand-2",
        `color-mix(in srgb, ${branding.primaryColor} 78%, black)`,
      );
      root.style.setProperty(
        "--brand-soft",
        `color-mix(in srgb, ${branding.primaryColor} 16%, var(--panel))`,
      );
    }
    if (branding.accentColor)
      root.style.setProperty("--accent", branding.accentColor);
    document.title = branding.institutionName
      ? `${branding.institutionName} · AcademicOS`
      : "AcademicOS";
    return () => {
      for (const name of names) {
        const value = previous[name];
        value
          ? root.style.setProperty(name, value)
          : root.style.removeProperty(name);
      }
      document.title = previousTitle;
    };
  }, [branding.primaryColor, branding.accentColor, branding.institutionName]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (!menuOpen) {
      if (menuWasOpen.current) menuButtonRef.current?.focus();
      menuWasOpen.current = false;
      return;
    }
    menuWasOpen.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !mobileMenuRef.current) return;
      const focusable = Array.from(
        mobileMenuRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", trapFocus);
    };
  }, [menuOpen]);

  const studentMode = Boolean(
    user && ["student", "student_group_leader"].includes(user.role),
  );
  const canFaculty = Boolean(
    featureFlags.ProfessorOS !== false &&
    user &&
    [
      "professor",
      "course_coordinator",
      "department_admin",
      "college_admin",
      "university_admin",
      "admin",
      "superadmin",
      "root_owner",
    ].includes(user.role),
  );
  const canUserAdmin = Boolean(
    user &&
    ["university_admin", "admin", "superadmin", "root_owner"].includes(
      user.role,
    ),
  );
  const canSupport = Boolean(
    user &&
    [
      "support_agent",
      "trust_safety_admin",
      "admin",
      "superadmin",
      "root_owner",
    ].includes(user.role),
  );
  const canControl = Boolean(
    user &&
    [
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
    ].includes(user.role),
  );
  const canPlatform = Boolean(user && !studentMode);
  const academicWorkMode = studentMode;
  const nav = useMemo(
    () =>
      studentMode
        ? studentNav
        : [
            {
              to: "/app",
              label: "الرئيسية",
              short: "الرئيسية",
              icon: Home,
              end: true,
            },
            ...(canFaculty
              ? [
                  {
                    to: "/app/professor",
                    label: "Teacher Lite",
                    short: "المقررات",
                    icon: GraduationCap,
                  } as NavItem,
                ]
              : []),
            {
              to: "/app/search",
              label: "البحث",
              short: "البحث",
              icon: Search,
            },
            {
              to: "/app/settings",
              label: "الإعدادات",
              short: "الإعدادات",
              icon: Settings,
            },
          ],
    [
      studentMode,
      canFaculty,
      canUserAdmin,
      canSupport,
      canControl,
      canPlatform,
    ],
  );
  const filtered = useMemo(
    () =>
      nav.filter(
        (item) =>
          t(item.label).includes(query) || t(item.short).includes(query),
      ),
    [query, nav, t],
  );
  const predictionStorageKey = `academicos.predictive-nav.v1:${user?.id || user?.role || "anonymous"}`;
  const predictionPool = useMemo(
    () => [
      ...nav.map((item) => ({ to: item.to, label: t(item.label) })),
      ...(studentMode
        ? [
            { to: "/app/upload?mode=write", label: "اكتب مشروعاً" },
            { to: "/app/upload?mode=rescue", label: "طوّر مسودة" },
          ]
        : []),
      { to: "/app/support", label: t("layout.navSupportShort") },
      { to: "/app/settings", label: t("layout.navSettings") },
    ],
    [nav, academicWorkMode, t],
  );
  const prediction = useMemo(
    () =>
      user
        ? predictNext(
            predictionStorageKey,
            location.pathname,
            user.role,
            predictionPool,
          )
        : null,
    [predictionStorageKey, location.pathname, user?.role, predictionPool],
  );

  useEffect(() => {
    if (!user) return;
    recordNavigation(
      predictionStorageKey,
      previousPath.current,
      location.pathname,
    );
    previousPath.current = location.pathname;
  }, [location.pathname, predictionStorageKey, user?.id]);

  const goToPrediction = () => {
    if (prediction) navigate(prediction.to);
  };
  const cycleTheme = () =>
    setTheme(
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light",
    );

  return (
    <div className="app-shell app-surface min-h-screen lg:grid lg:grid-cols-[276px_1fr]">
      <a href="#main-content" className="skip-link focus-ring">
        {t("layout.skipToContent")}
      </a>
      <aside className="app-sidebar hidden lg:flex fixed inset-y-0 right-0 w-[276px] border-l hairline bg-[var(--panel)] flex-col z-40">
        <SidebarContent
          userName={user?.displayName || "AcademicOS"}
          role={user?.role || "student"}
          nav={nav}
          onLogout={logout}
          branding={branding}
          academicWorkMode={academicWorkMode}
        />
      </aside>

      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button
            aria-label={t("layout.closeMenu")}
            className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
            onClick={() => setMenuOpen(false)}
          />
          <aside
            ref={mobileMenuRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("layout.mainMenu")}
            className="app-sidebar absolute inset-y-0 right-0 w-[min(90vw,340px)] bg-[var(--panel)] border-l hairline shadow-2xl"
          >
            <div className="absolute left-3 top-3">
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("layout.closeMenu")}
                autoFocus
                onClick={() => setMenuOpen(false)}
              >
                <X size={19} />
              </Button>
            </div>
            <SidebarContent
              userName={user?.displayName || "AcademicOS"}
              role={user?.role || "student"}
              nav={nav}
              onLogout={logout}
              branding={branding}
              academicWorkMode={academicWorkMode}
            />
          </aside>
        </div>
      )}

      <div
        aria-hidden={menuOpen ? true : undefined}
        className="lg:col-start-2 min-w-0 min-h-screen"
      >
        <header className="app-topbar sticky top-0 z-30 h-[68px] border-b hairline backdrop-blur-xl flex items-center px-4 md:px-7 gap-3">
          <Button
            ref={menuButtonRef}
            size="icon"
            variant="ghost"
            className="lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label={t("layout.openMenu")}
          >
            <Menu size={21} />
          </Button>
          <div className="min-w-0 flex-1">
            <div dir="auto" className="text-xs font-semibold truncate">
              {branding.institutionName || "AcademicOS"}
            </div>
            <div className="text-[11px] muted truncate">
              {t("layout.tagline")}
            </div>
          </div>
          <button
            onClick={() => setPaletteOpen(true)}
            className="command-trigger focus-ring hidden sm:flex h-10 items-center gap-2 rounded-xl border hairline bg-[var(--panel)] px-3 text-xs muted hover:text-[var(--ink)]"
          >
            <Search size={15} />
            <span>{t("layout.searchAndNavigate")}</span>
            <span className="ms-4 rounded-md border hairline px-1.5 py-0.5 text-[10px]">
              <Command size={10} className="inline" /> K
            </span>
          </button>
          {prediction && (
            <button
              onClick={goToPrediction}
              title={prediction.reason}
              className="predictive-chip focus-ring hidden xl:flex h-10 max-w-[260px] items-center gap-2 rounded-xl px-3 text-start"
            >
              <span className="predictive-chip__spark h-7 w-7 shrink-0 rounded-lg flex items-center justify-center">
                <Sparkles size={14} />
              </span>
              <span className="min-w-0">
                <span className="block text-[9px] font-bold uppercase tracking-[.12em] muted">
                  {t("layout.predictedNow")}
                </span>
                <span className="block truncate text-xs font-semibold">
                  {prediction.label}
                </span>
              </span>
              <ArrowLeft size={14} className="shrink-0 muted" />
            </button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={cycleTheme}
            aria-label={t("layout.changeTheme")}
          >
            {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
          </Button>
          <div className="flex items-center gap-2 ps-2 border-s hairline">
            <div className="hidden md:flex items-center gap-2">
              <div className="h-8 w-8 rounded-full brand-soft-bg flex items-center justify-center">
                <UserRound size={15} />
              </div>
              <div className="max-w-28">
                <div className="text-xs font-semibold truncate">
                  {user?.displayName}
                </div>
                <div className="text-[10px] muted">
                  {t(roleLabel(user?.role))}
                </div>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => logout()}
              title={t("layout.logout")}
              aria-label={t("layout.logout")}
              className="text-red-600 dark:text-red-400 hover:bg-red-500/10"
            >
              <LogOut size={18} />
            </Button>
          </div>
        </header>

        {user?.impersonation && (
          <div className="px-4 md:px-7 py-2.5 text-xs border-b border-amber-500/30 bg-amber-500/12 text-amber-900 dark:text-amber-100">
            <div className="mx-auto max-w-[1440px] flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold">
                {t("layout.readOnlySupportSession")}
              </span>
              <span>
                {t("layout.impersonationAudited")}{" "}
                {new Date(user.impersonation.expiresAt).toLocaleTimeString(
                  "ar-KW",
                )}
              </span>
            </div>
          </div>
        )}
        {(serviceNotice.incident || serviceNotice.maintenance) && (
          <div
            className={`px-4 md:px-7 py-2.5 text-xs border-b hairline ${serviceNotice.maintenance ? "bg-amber-500/10 text-amber-800 dark:text-amber-200" : "brand-soft-bg"}`}
          >
            <div className="mx-auto max-w-[1440px] flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold">
                {serviceNotice.maintenance
                  ? t("layout.maintenanceMode")
                  : t("layout.serviceAlert")}
              </span>
              <span>
                {serviceNotice.incident || t("layout.writesPaused")}
              </span>
            </div>
          </div>
        )}

        {prediction && (
          <div className="predictive-mobile-wrap xl:hidden px-4 md:px-7 pt-3">
            <button
              onClick={goToPrediction}
              className="predictive-mobile focus-ring mx-auto w-full max-w-[1440px] flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-start"
            >
              <span className="predictive-chip__spark h-8 w-8 shrink-0 rounded-xl flex items-center justify-center">
                <Sparkles size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-[.12em] muted">
                    {t("layout.predictedNow")}
                  </span>
                  {prediction.strength === "strong" && (
                    <span className="prediction-learned rounded-full px-1.5 py-0.5 text-[9px] font-semibold">
                      {t("layout.learnedFromUsage")}
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs font-semibold mt-0.5">
                  {prediction.label}
                </span>
              </span>
              <ArrowLeft size={15} className="shrink-0 muted" />
            </button>
          </div>
        )}

        <main
          id="main-content"
          tabIndex={-1}
          className="app-main px-4 py-6 md:px-7 md:py-8 lg:px-9 lg:py-10 pb-32 lg:pb-12"
        >
          <div className="mx-auto w-full max-w-[1440px]">
            <Outlet />
          </div>
        </main>
      </div>

      <nav
        aria-label={t("layout.quickNav")}
        aria-hidden={menuOpen ? true : undefined}
        className="mobile-dock lg:hidden fixed inset-x-0 bottom-0 z-40 border-t hairline backdrop-blur-xl px-2 pt-2"
      >
        <div className="grid grid-cols-5 gap-1">
          {nav.slice(0, 2).map((item) => (
            <MobileNav key={item.to} item={item} />
          ))}
          <NavLink
            to={academicWorkMode ? "/app/upload" : "/app/professor"}
            className="focus-ring flex flex-col items-center justify-center -mt-5"
          >
            <span className="mobile-add-button h-12 w-12 rounded-2xl brand-bg flex items-center justify-center">
              {academicWorkMode ? <Plus size={22} /> : <GraduationCap size={20} />}
            </span>
            <span className="text-[10px] font-semibold mt-1">
              {academicWorkMode ? t("layout.add") : t("layout.work")}
            </span>
          </NavLink>
          {nav.slice(2, 4).map((item) => (
            <MobileNav key={item.to} item={item} />
          ))}
        </div>
      </nav>

      {paletteOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="command-title"
        >
          <button
            className="absolute inset-0 bg-black/25 backdrop-blur-sm"
            aria-label={t("layout.closeSearch")}
            onClick={() => setPaletteOpen(false)}
          />
          <div className="command-palette relative w-full max-w-xl panel rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 border-b hairline px-4">
              <Search size={18} className="muted" />
              <input
                id="command-title"
                aria-label={t("layout.searchNavAria")}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("layout.searchPlaceholder")}
                className="h-14 flex-1 bg-transparent outline-none text-sm"
              />
              <kbd className="text-[10px] muted">ESC</kbd>
            </div>
            <div className="p-2 max-h-80 overflow-auto">
              {prediction && (
                <button
                  onClick={() => {
                    goToPrediction();
                    setPaletteOpen(false);
                  }}
                  className="prediction-palette-item focus-ring w-full flex items-center gap-3 rounded-xl px-3 py-3 text-start"
                >
                  <span className="h-8 w-8 rounded-lg predictive-chip__spark flex items-center justify-center">
                    <Sparkles size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold muted">
                      {t("layout.predictedNow")} · {prediction.label}
                    </div>
                    <div className="text-[11px] muted truncate">
                      {prediction.reason}
                    </div>
                  </div>
                  <ArrowLeft size={15} className="muted" />
                </button>
              )}
              {academicWorkMode && (
                <button
                  onClick={() => {
                    navigate("/app/upload");
                    setPaletteOpen(false);
                  }}
                  className="focus-ring w-full flex items-center gap-3 rounded-xl px-3 py-3 text-start hover:bg-[var(--panel-2)]"
                >
                  <span className="h-8 w-8 rounded-lg brand-soft-bg flex items-center justify-center">
                    <Sparkles size={16} />
                  </span>
                  <div>
                    <div className="text-sm font-semibold">
                      {t("layout.actionAnalyzeAssignment")}
                    </div>
                    <div className="text-[11px] muted">
                      Universal Assignment Compiler
                    </div>
                  </div>
                </button>
              )}
              {query.trim().length >= 2 && (
                <button
                  onClick={() => {
                    navigate(
                      `/app/search?q=${encodeURIComponent(query.trim())}`,
                    );
                    setPaletteOpen(false);
                  }}
                  className="focus-ring w-full flex items-center gap-3 rounded-xl px-3 py-3 text-start hover:bg-[var(--panel-2)]"
                >
                  <span className="h-8 w-8 rounded-lg soft-bg flex items-center justify-center">
                    <Search size={16} />
                  </span>
                  <div>
                    <div className="text-sm font-semibold">
                      {t("layout.searchFor")} “{query.trim()}”
                    </div>
                    <div className="text-[11px] muted">
                      {t("layout.searchScope")}
                    </div>
                  </div>
                </button>
              )}
              <div className="eyebrow px-3 pt-4 pb-2">
                {t("layout.navigation")}
              </div>
              {filtered.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.to}
                    onClick={() => {
                      navigate(item.to);
                      setPaletteOpen(false);
                    }}
                    className="focus-ring w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-start hover:bg-[var(--panel-2)]"
                  >
                    <Icon size={16} className="muted" />
                    <span className="text-sm">{t(item.label)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarContent({
  userName,
  role,
  nav,
  onLogout,
  branding,
  academicWorkMode,
}: {
  userName: string;
  role: string;
  nav: NavItem[];
  onLogout: () => Promise<void>;
  branding: { institutionName?: string; logoUrl?: string };
  academicWorkMode: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto overscroll-contain">
      <div className="px-3 pt-3 pb-6">
        <div className="flex items-center gap-3">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="sidebar-brand-mark h-10 w-10 rounded-xl object-contain border hairline bg-white p-1"
            />
          ) : (
            <div className="sidebar-brand-mark h-10 w-10 rounded-xl brand-bg flex items-center justify-center">
              <span className="font-semibold text-sm">AO</span>
            </div>
          )}
          <div className="min-w-0">
            <div
              dir="auto"
              title={branding.institutionName || "AcademicOS"}
              className="text-base font-semibold tracking-[-0.02em] truncate"
            >
              {branding.institutionName || "AcademicOS"}
            </div>
            <div className="text-[10px] muted">
              AcademicOS · Human Learning Infrastructure
            </div>
          </div>
        </div>
      </div>
      <NavLink
        to={academicWorkMode ? "/app/upload" : "/app"}
        className="focus-ring brand-bg rounded-xl min-h-11 px-4 flex items-center justify-center gap-2 text-sm font-semibold mb-5"
      >
        {academicWorkMode ? <Plus size={17} /> : <Sparkles size={17} />}{" "}
        {academicWorkMode ? t("layout.newAssignment") : t("layout.navBriefing")}
      </NavLink>
      <div className="eyebrow px-3 mb-2">{t(roleLabel(role))}</div>
      <nav className="space-y-1">
        {nav.map((item) => (
          <DesktopNav key={item.to} item={item} />
        ))}
      </nav>
      <div className="mt-auto pt-5">
        <div className="eyebrow px-3 mb-2">{t("layout.system")}</div>
        <NavLink
          to="/app/settings"
          className={({ isActive }) =>
            cn(
              "sidebar-nav-link focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
              isActive
                ? "brand-soft-bg font-semibold"
                : "muted hover:bg-[var(--panel-2)] hover:text-[var(--ink)]",
            )
          }
        >
          <Settings size={17} />
          {t("layout.navSettings")}
        </NavLink>
        <div className="mt-3 rounded-xl border hairline p-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg soft-bg flex items-center justify-center">
              <UserRound size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold truncate">{userName}</div>
              <div className="text-[10px] muted">
                {t("layout.verifiedAccount")}
              </div>
            </div>
          </div>
          <button
            onClick={() => onLogout()}
            className="focus-ring mt-3 w-full rounded-xl py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 flex items-center justify-center gap-2 border border-red-200/80 dark:border-red-900/40 transition-colors"
          >
            <LogOut size={15} />
            <span>{t("layout.logout")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function DesktopNav({ item }: { item: NavItem }) {
  const { t } = useI18n();
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "sidebar-nav-link focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
          isActive
            ? "brand-soft-bg font-semibold"
            : "muted hover:bg-[var(--panel-2)] hover:text-[var(--ink)]",
        )
      }
    >
      <Icon size={17} />
      <span>{t(item.label)}</span>
    </NavLink>
  );
}

function MobileNav({ item }: { item: NavItem }) {
  const { t } = useI18n();
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "mobile-nav-link focus-ring min-h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px]",
          isActive ? "brand-text font-semibold" : "muted",
        )
      }
    >
      <Icon size={18} />
      <span>{t(item.short)}</span>
    </NavLink>
  );
}

function roleLabel(role?: string) {
  const labels: Record<string, string> = {
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
  return labels[role || "student"] || "layout.roleDefault";
}

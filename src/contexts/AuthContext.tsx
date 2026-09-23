import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  getIdTokenResult,
  multiFactor,
  onIdTokenChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { getToken as getAppCheckToken } from "firebase/app-check";
import {
  firebaseAppCheck,
  firebaseAuth,
  firebaseClientConfigured,
} from "../lib/firebase";
import { readDemoRole, setApiAppCheckTokenProvider, setApiTokenProvider } from "../lib/api";
import type { User, UserRole } from "../types";

interface AuthState {
  user: User | null;
  loading: boolean;
  configured: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  /** True while this tab is inside an isolated demo tenant. */
  demo: boolean;
  demoAvailable: boolean;
  startDemo: () => Promise<void>;
  resetDemo: () => Promise<void>;
  endDemo: () => Promise<void>;
}

/**
 * Demo sessions.
 *
 * The token the server issues is kept in sessionStorage — one tab, discarded
 * when the tab closes — and is handed to the API layer in place of a Firebase
 * ID token. It unlocks one server-side sandbox and nothing else, so a demo
 * visitor never authenticates against a real identity and never reaches the
 * institution's Firestore. Starting a demo signs out any live session first, so
 * there is no moment where a real account is looking at synthetic data.
 */
const DEMO_SESSION_KEY = "academicos_demo_session_v1";

/**
 * The demo session handle is ISSUED BY THE SERVER and validated by it on every
 * request. Nothing here fabricates an identity: `DEMO_USER` is a display shell
 * that is only ever shown while such a handle is held, and it carries no
 * authority of its own — the server decides what a demo request may see, from
 * the handle alone. `scripts/global-ui-audit.cjs` enforces both halves of that.
 */
function readDemoToken(): string {
  try {
    return window.sessionStorage.getItem(DEMO_SESSION_KEY) || "";
  } catch {
    return "";
  }
}

function writeDemoToken(token: string): void {
  try {
    if (token) window.sessionStorage.setItem(DEMO_SESSION_KEY, token);
    else window.sessionStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    // Private windows and blocked site data throw here. A demo that cannot be
    // remembered simply does not start; nothing else is affected.
  }
}

const DEMO_USER: User = {
  id: "demo_user_instructor",
  email: "demo_user_instructor@demo.academicos.test",
  displayName: "د. سارة الخالد (بيئة تجريبية)",
  role: "professor",
  tenantId: "demo_tenant_academicos",
  emailVerified: true,
  mfaEnrolled: false,
  mfaSatisfied: true,
};

/* يطابق DEMO_ACTORS في src/server/demoSandbox.ts: الخادم يقرّر الفاعل من
   ترويسة x-demo-role، فلا بد أن تبني الواجهة شاشتها على الدور نفسه — وإلا فتح
   دور الطالب لوحةَ الأستاذ وفشلت كل طلباتها بـ403. */
const DEMO_ROLE_USERS: Record<string, Pick<User, "id" | "email" | "displayName" | "role">> = {
  teaching_assistant: { id: "demo_user_ta", email: "demo_user_ta@demo.academicos.test", displayName: "م. عبدالعزيز الشايع (بيئة تجريبية)", role: "teaching_assistant" },
  university_admin: { id: "demo_user_admin", email: "demo_user_admin@demo.academicos.test", displayName: "د. محمد البدر (بيئة تجريبية)", role: "university_admin" },
  student: { id: "demo_user_student_1", email: "demo_user_student_1@demo.academicos.test", displayName: "عبدالله الفيلكاوي (بيئة تجريبية)", role: "student" },
};

function demoUserForRole(): User {
  const profile = DEMO_ROLE_USERS[readDemoRole()];
  return profile ? { ...DEMO_USER, ...profile } : DEMO_USER;
}

const Context = createContext<AuthState | null>(null);
const allowedRoles: UserRole[] = [
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

function normalizeClientRole(rawValue: unknown, fallback: UserRole): UserRole {
  const normalized = String(rawValue || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const aliases: Partial<Record<string, UserRole>> = {
    learner: "student",
    pupil: "student",
    teacher: "professor",
    instructor: "professor",
    faculty: "professor",
    lecturer: "professor",
    administrator: "admin",
  };
  const candidate = aliases[normalized] || normalized;
  return allowedRoles.includes(candidate as UserRole)
    ? (candidate as UserRole)
    : fallback;
}

async function mapFirebaseUser(user: FirebaseUser): Promise<User> {
  const token = await getIdTokenResult(user, false);
  // الدور يأتي حصرًا من مطالبات Firebase التي يضبطها الخادم.
  // كود العميل يُشحن لكل زائر، فلا يحمل أي قائمة صلاحيات.
  const role = normalizeClientRole(token.claims.role, "student");
  return {
    id: user.uid,
    email: user.email || "",
    displayName:
      user.displayName || user.email?.split("@")[0] || "AcademicOS user",
    role,
    tenantId: String(token.claims.tenantId || `individual_${user.uid}`),
    emailVerified: Boolean(user.emailVerified),
    mfaEnrolled: multiFactor(user).enrolledFactors.length > 0,
    mfaSatisfied: Boolean(token.signInSecondFactor),
    impersonation: token.claims.impersonatorId
      ? {
          actorId: String(token.claims.impersonatorId),
          readOnly: true,
          expiresAt: new Date(
            Number(token.claims.impersonationExpiresAt || 0),
          ).toISOString(),
        }
      : undefined,
  };
}

function requireFirebase() {
  if (!firebaseAuth || !firebaseClientConfigured) {
    const error = new Error(
      "Firebase Authentication is not configured for this environment. No local fallback session is available in launch mode.",
    ) as Error & { code?: string };
    error.code = "auth/not-configured";
    throw error;
  }
  return firebaseAuth;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [demoToken, setDemoToken] = useState<string>(() =>
    typeof window === "undefined" ? "" : readDemoToken(),
  );
  const [demoAvailable, setDemoAvailable] = useState(false);
  // A ref, because the token provider is registered once and must read the
  // current value rather than the one captured at registration.
  const demoTokenRef = useRef(demoToken);
  demoTokenRef.current = demoToken;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/demo/config", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setDemoAvailable(Boolean(data?.enabled));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setApiTokenProvider(async (forceRefresh = false) => {
      // A demo token wins: while one is held, this tab must not send a real
      // identity to the server under any circumstance.
      if (demoTokenRef.current) return demoTokenRef.current;
      if (!firebaseAuth?.currentUser) return null;
      try {
        return await firebaseAuth.currentUser.getIdToken(forceRefresh);
      } catch {
        return null;
      }
    });

    setApiAppCheckTokenProvider(async () =>
      firebaseAppCheck
        ? (await getAppCheckToken(firebaseAppCheck, false)).token
        : null,
    );

    if (demoTokenRef.current) {
      setUser(demoUserForRole());
      setLoading(false);
      return;
    }

    if (!firebaseAuth || !firebaseClientConfigured) {
      setUser(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onIdTokenChanged(firebaseAuth, async (current) => {
      try {
        if (demoTokenRef.current) return;
        setUser(current ? await mapFirebaseUser(current) : null);
      } catch (error) {
        console.error("Failed to map authenticated Firebase user", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      configured: firebaseClientConfigured,
      login: async (email, password) => {
        const auth = requireFirebase();
        await signInWithEmailAndPassword(auth, email.trim(), password);
      },
      signup: async (name, email, password) => {
        const auth = requireFirebase();
        const result = await createUserWithEmailAndPassword(
          auth,
          email.trim().toLowerCase(),
          password,
        );
        await updateProfile(result.user, {
          displayName:
            name.trim() || result.user.email?.split("@")[0] || "AcademicOS learner",
        });
        await sendEmailVerification(result.user).catch(() => undefined);
        await result.user.getIdToken(true);
        setUser(await mapFirebaseUser(result.user));
      },
      logout: async () => {
        const auth = requireFirebase();
        await signOut(auth);
        setUser(null);
      },
      resetPassword: async (email) => {
        const auth = requireFirebase();
        await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      },
      resendVerification: async () => {
        const auth = requireFirebase();
        if (auth.currentUser && !auth.currentUser.emailVerified) {
          await sendEmailVerification(auth.currentUser);
        }
      },
      demo: Boolean(demoToken),
      demoAvailable,
      startDemo: async () => {
        // Sign a live session out first; a real identity must never be the one
        // looking at the sandbox.
        if (firebaseAuth?.currentUser) await signOut(firebaseAuth).catch(() => undefined);
        const response = await fetch("/api/demo/session", { method: "POST" });
        if (!response.ok) throw new Error("Demo is not available");
        const data = (await response.json()) as { token: string };
        writeDemoToken(data.token);
        demoTokenRef.current = data.token;
        setDemoToken(data.token);
        setUser(demoUserForRole());
        setLoading(false);
      },
      resetDemo: async () => {
        if (!demoTokenRef.current) return;
        const response = await fetch("/api/demo/reset", {
          method: "POST",
          headers: { Authorization: `Bearer ${demoTokenRef.current}` },
        });
        if (!response.ok) throw new Error("Demo session has expired");
        // Rebuilt server-side; a reload is the simplest way to be sure no screen
        // is still holding a row that no longer exists.
        window.location.reload();
      },
      endDemo: async () => {
        const token = demoTokenRef.current;
        if (token)
          await fetch("/api/demo/end", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => undefined);
        writeDemoToken("");
        demoTokenRef.current = "";
        setDemoToken("");
        setUser(null);
        window.location.reload();
      },
    }),
    [user, loading, demoToken, demoAvailable],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

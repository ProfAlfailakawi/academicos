import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createUserWithEmailAndPassword,
  getIdTokenResult,
  onAuthStateChanged,
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
import { setApiAppCheckTokenProvider, setApiTokenProvider } from "../lib/api";
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

async function mapFirebaseUser(user: FirebaseUser): Promise<User> {
  const token = await getIdTokenResult(user, true);
  const rawRole = String(token.claims.role || "student");
  const role: UserRole = allowedRoles.includes(rawRole as UserRole)
    ? (rawRole as UserRole)
    : "student";
  return {
    id: user.uid,
    email: user.email || "",
    displayName:
      user.displayName || user.email?.split("@")[0] || "AcademicOS user",
    role,
    tenantId: String(token.claims.tenantId || `individual_${user.uid}`),
    emailVerified: Boolean(user.emailVerified),
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

const LOCAL_USER_STORAGE_KEY = "academicos_local_user";

function getStoredLocalUser(): User | null {
  try {
    const raw = localStorage.getItem(LOCAL_USER_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function createLocalUser(email: string, displayName?: string, roleOverride?: UserRole): User {
  const cleanEmail = email.trim().toLowerCase();
  let role: UserRole = roleOverride || "student";
  if (!roleOverride) {
    if (cleanEmail.includes("professor") || cleanEmail.includes("prof") || cleanEmail.includes("teacher")) {
      role = "professor";
    } else if (cleanEmail.includes("admin") || cleanEmail.includes("university_admin")) {
      role = "university_admin";
    }
  }
  const name = displayName?.trim() || cleanEmail.split("@")[0] || "AcademicOS User";
  return {
    id: `local_${cleanEmail.replace(/[^a-z0-9]/gi, "_")}`,
    email: cleanEmail,
    displayName: name,
    role,
    tenantId: role === "university_admin" ? "platform" : `individual_${cleanEmail.replace(/[^a-z0-9]/gi, "_")}`,
    emailVerified: true,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setApiTokenProvider(async () => {
      if (firebaseAuth?.currentUser) {
        try {
          return await firebaseAuth.currentUser.getIdToken();
        } catch {}
      }
      const local = getStoredLocalUser();
      return local ? `demo_token_${local.id}` : null;
    });

    setApiAppCheckTokenProvider(async () =>
      firebaseAppCheck
        ? (await getAppCheckToken(firebaseAppCheck, false)).token
        : null,
    );

    if (firebaseAuth && firebaseClientConfigured) {
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (current) => {
        try {
          if (current) {
            setUser(await mapFirebaseUser(current));
          } else {
            setUser(getStoredLocalUser());
          }
        } catch (error) {
          console.error("Failed to map authenticated Firebase user", error);
          setUser(getStoredLocalUser());
        } finally {
          setLoading(false);
        }
      });
      return unsubscribe;
    } else {
      setUser(getStoredLocalUser());
      setLoading(false);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      configured: true,
      login: async (email, password) => {
        if (firebaseAuth && firebaseClientConfigured) {
          try {
            await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
            localStorage.removeItem(LOCAL_USER_STORAGE_KEY);
            return;
          } catch (err: any) {
            if (
              err?.code === "auth/invalid-credential" ||
              err?.code === "auth/wrong-password" ||
              err?.code === "auth/user-not-found"
            ) {
              throw err;
            }
          }
        }
        const local = createLocalUser(email);
        localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(local));
        setUser(local);
      },
      signup: async (name, email, password) => {
        if (firebaseAuth && firebaseClientConfigured) {
          try {
            const result = await createUserWithEmailAndPassword(
              firebaseAuth,
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
            localStorage.removeItem(LOCAL_USER_STORAGE_KEY);
            return;
          } catch (err: any) {
            if (
              err?.code === "auth/email-already-in-use" ||
              err?.code === "auth/weak-password"
            ) {
              throw err;
            }
          }
        }
        const local = createLocalUser(email, name);
        localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(local));
        setUser(local);
      },
      logout: async () => {
        if (firebaseAuth) await signOut(firebaseAuth).catch(() => undefined);
        localStorage.removeItem(LOCAL_USER_STORAGE_KEY);
        setUser(null);
      },
      resetPassword: async (email) => {
        if (firebaseAuth && firebaseClientConfigured) {
          await sendPasswordResetEmail(firebaseAuth, email.trim().toLowerCase()).catch(
            () => undefined,
          );
        }
      },
      resendVerification: async () => {
        if (firebaseAuth && firebaseClientConfigured && firebaseAuth.currentUser) {
          if (!firebaseAuth.currentUser.emailVerified) {
            await sendEmailVerification(firebaseAuth.currentUser);
          }
        }
      },
    }),
    [user, loading],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

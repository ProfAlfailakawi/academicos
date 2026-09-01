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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setApiTokenProvider(async () => {
      if (!firebaseAuth?.currentUser) return null;
      try {
        return await firebaseAuth.currentUser.getIdToken();
      } catch {
        return null;
      }
    });

    setApiAppCheckTokenProvider(async () =>
      firebaseAppCheck
        ? (await getAppCheckToken(firebaseAppCheck, false)).token
        : null,
    );

    if (!firebaseAuth || !firebaseClientConfigured) {
      setUser(null);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (current) => {
      try {
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

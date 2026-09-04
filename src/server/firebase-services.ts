import { getFirestore } from "firebase-admin/firestore";
import appletConfig from "../../firebase-applet-config.json";

/** Canonical Firebase project used by the web client and backend. */
export function firebaseProjectId(env: NodeJS.ProcessEnv = process.env) {
  return String(
    env.FIREBASE_PROJECT_ID ||
      env.VITE_FIREBASE_PROJECT_ID ||
      appletConfig.projectId ||
      "",
  ).trim();
}

/**
 * Resolve the Firestore database used by the application backend.
 *
 * AcademicOS is configured with a named Firestore database. The Admin SDK
 * otherwise silently targets `(default)`, which makes an otherwise healthy
 * Firebase project look empty/unavailable. Emulator runs intentionally keep
 * using `(default)` unless an explicit database id is provided.
 */
export function firestoreDatabaseId(env: NodeJS.ProcessEnv = process.env) {
  const explicit = String(env.FIREBASE_FIRESTORE_DATABASE_ID || "").trim();
  if (explicit) return explicit;
  if (env.FIRESTORE_EMULATOR_HOST) return "(default)";
  return String(appletConfig.firestoreDatabaseId || "(default)").trim() || "(default)";
}

// يُهيّأ مرة واحدة: الحقول الاختيارية (وصف/فصل دراسي غائب) تصل كـundefined،
// والـAdmin SDK يرفضها افتراضيًا فتفشل كل كتابة تحمل حقلًا غير معبّأ بخطأ داخلي.
let firestoreInstance: ReturnType<typeof getFirestore> | null = null;
export function getAppFirestore(env: NodeJS.ProcessEnv = process.env) {
  if (firestoreInstance) return firestoreInstance;
  const databaseId = firestoreDatabaseId(env);
  const instance = databaseId === "(default)" ? getFirestore() : getFirestore(databaseId);
  try { instance.settings({ ignoreUndefinedProperties: true }); } catch { /* settings مقفلة بعد أول استخدام */ }
  firestoreInstance = instance;
  return instance;
}

/** Resolve the Admin Storage bucket from deployment env or the checked-in Firebase applet config. */
export function firebaseStorageBucketName(env: NodeJS.ProcessEnv = process.env) {
  return String(env.FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || "").trim();
}

/**
 * Detect the common production failure where the app targets Firebase project A
 * while Cloud Run / a supplied service-account credential belongs to project B.
 * Cross-project operation is possible, but must be explicit because it requires
 * separate IAM grants in the Firebase project.
 */
export function assertFirebaseCredentialAlignment(
  rawServiceAccount: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
) {
  const expectedProjectId = firebaseProjectId(env);
  const allowCrossProject = env.ALLOW_CROSS_PROJECT_FIREBASE === "true";
  if (!expectedProjectId || allowCrossProject || env.FIRESTORE_EMULATOR_HOST) return;

  if (rawServiceAccount) {
    try {
      const parsed = JSON.parse(rawServiceAccount);
      const credentialProjectId = String(parsed?.project_id || "").trim();
      if (credentialProjectId && credentialProjectId !== expectedProjectId) {
        throw Object.assign(
          new Error(
            `Firebase service-account project ${credentialProjectId} does not match application project ${expectedProjectId}`,
          ),
          {
            code: "FIREBASE_CREDENTIAL_PROJECT_MISMATCH",
            status: 503,
          },
        );
      }
    } catch (error: any) {
      if (error?.code === "FIREBASE_CREDENTIAL_PROJECT_MISMATCH") throw error;
      throw Object.assign(new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON"), {
        code: "FIREBASE_SERVICE_ACCOUNT_INVALID",
        status: 503,
      });
    }
  }

  const runtimeProjectId = String(
    env.GOOGLE_CLOUD_PROJECT || env.GCLOUD_PROJECT || "",
  ).trim();
  if (runtimeProjectId && runtimeProjectId !== expectedProjectId) {
    throw Object.assign(
      new Error(
        `Runtime project ${runtimeProjectId} does not match Firebase project ${expectedProjectId}`,
      ),
      {
        code: "FIREBASE_RUNTIME_PROJECT_MISMATCH",
        status: 503,
      },
    );
  }
}

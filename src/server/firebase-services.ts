import { getFirestore } from "firebase-admin/firestore";
import appletConfig from "../../firebase-applet-config.json";

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

export function getAppFirestore(env: NodeJS.ProcessEnv = process.env) {
  const databaseId = firestoreDatabaseId(env);
  return databaseId === "(default)" ? getFirestore() : getFirestore(databaseId);
}

/** Resolve the Admin Storage bucket from deployment env or the checked-in Firebase applet config. */
export function firebaseStorageBucketName(env: NodeJS.ProcessEnv = process.env) {
  return String(env.FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || "").trim();
}

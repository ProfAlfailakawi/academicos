import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Refusing to create showcase users outside Firebase Auth + Firestore emulators.");
}
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "academicos-local";
initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const auth = getAuth();
const db = getFirestore();
const tenantId = "showcase-university";
const password = "AcademicOS!Showcase2026";
const accounts = [
  { uid: "showcase-student", email: "student@showcase.academicos.local", role: "student", displayName: "طالب Showcase" },
  { uid: "showcase-professor", email: "professor@showcase.academicos.local", role: "professor", displayName: "د. معلم Showcase" },
  { uid: "showcase-university-admin", email: "university_admin@showcase.academicos.local", role: "university_admin", displayName: "أدمن Showcase" },
];
for (const account of accounts) {
  try {
    await auth.createUser({ uid: account.uid, email: account.email, password, emailVerified: true, displayName: account.displayName });
  } catch (error) {
    if (error?.code !== "auth/uid-already-exists") throw error;
    await auth.updateUser(account.uid, { email: account.email, password, emailVerified: true, displayName: account.displayName });
  }
  await auth.setCustomUserClaims(account.uid, { role: account.role, tenantId });
}
await db.collection("systemConfig").doc(tenantId).set({ tenantId, name: "Showcase University", showcase: true, updatedAt: new Date().toISOString() }, { merge: true });
console.log("Showcase users ready in Firebase Emulator:");
for (const account of accounts) console.log(`${account.role.padEnd(18)} ${account.email}`);
console.log(`Password: ${password}`);

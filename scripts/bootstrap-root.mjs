import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

const appletConfig = JSON.parse(readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf8'));
const email = process.env.ROOT_OWNER_EMAIL;
const tenantId = process.env.ROOT_OWNER_TENANT_ID || 'platform';
if (!email) throw new Error('ROOT_OWNER_EMAIL is required. No credentials are hardcoded.');
if (!getApps().length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket,
    credential: raw ? cert(JSON.parse(raw)) : applicationDefault(),
  });
}
const databaseId = String(
  process.env.FIREBASE_FIRESTORE_DATABASE_ID ||
  (process.env.FIRESTORE_EMULATOR_HOST ? '(default)' : appletConfig.firestoreDatabaseId) ||
  '(default)',
).trim();
const db = databaseId === '(default)' ? getFirestore() : getFirestore(databaseId);
const auth = getAuth();
let user;
try { user = await auth.getUserByEmail(email); }
catch (e) {
  if (e?.code !== 'auth/user-not-found') throw e;
  user = await auth.createUser({ email, emailVerified: false });
  console.log('Created Firebase Auth user. Complete email verification/password setup using your secure identity workflow.');
}
await auth.setCustomUserClaims(user.uid, { role: 'root_owner', tenantId });
await db.collection('users').doc(user.uid).set({ id:user.uid, email, displayName:user.displayName || email, role:'root_owner', tenantId, status:'active', updatedAt:new Date().toISOString() }, { merge:true });
await db.collection('auditLogs').add({ actor:'bootstrap-script', action:'root_owner.bootstrap', target:user.uid, tenant:tenantId, timestamp:new Date().toISOString(), reason:'Initial platform owner setup' });
console.log(`Root Owner claims configured for ${email} in Firestore database ${databaseId}. Sign in again to refresh the ID token.`);

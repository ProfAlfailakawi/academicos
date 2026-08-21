import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const email = process.env.ROOT_OWNER_EMAIL;
const tenantId = process.env.ROOT_OWNER_TENANT_ID || 'platform';
if (!email) throw new Error('ROOT_OWNER_EMAIL is required. No credentials are hardcoded.');
if (!getApps().length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  initializeApp({ credential: raw ? cert(JSON.parse(raw)) : applicationDefault() });
}
const auth = getAuth();
let user;
try { user = await auth.getUserByEmail(email); }
catch (e) {
  if (e?.code !== 'auth/user-not-found') throw e;
  user = await auth.createUser({ email, emailVerified: false });
  console.log('Created Firebase Auth user. Complete email verification/password setup using your secure identity workflow.');
}
await auth.setCustomUserClaims(user.uid, { role: 'root_owner', tenantId });
await getFirestore().collection('users').doc(user.uid).set({ id:user.uid, email, displayName:user.displayName || email, role:'root_owner', tenantId, status:'active', updatedAt:new Date().toISOString() }, { merge:true });
await getFirestore().collection('auditLogs').add({ actor:'bootstrap-script', action:'root_owner.bootstrap', target:user.uid, tenant:tenantId, timestamp:new Date().toISOString(), reason:'Initial platform owner setup' });
console.log(`Root Owner claims configured for ${email}. Sign in again to refresh the ID token.`);

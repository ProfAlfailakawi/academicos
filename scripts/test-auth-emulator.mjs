import assert from 'node:assert/strict';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if(!process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Refusing to run outside Firebase Auth Emulator');initializeApp({projectId:process.env.GCLOUD_PROJECT||'academicos-local'});const auth=getAuth(),tenantId='emulator-university',roles=['student','professor','university_admin','support_agent','finance_admin','root_owner'];
for(const role of roles){const uid=`auth-${role}`;await auth.createUser({uid,email:`${role}@emulator.academicos.local`,emailVerified:true});await auth.setCustomUserClaims(uid,{role,tenantId,emulatorMfaEnrolled:role!=='student'});const user=await auth.getUser(uid);assert.equal(user.customClaims?.role,role);assert.equal(user.customClaims?.tenantId,tenantId);const token=await auth.createCustomToken(uid);assert.ok(token.length>100);}
const page=await auth.listUsers(3);assert.equal(page.users.length,3);assert.ok(page.pageToken);const second=await auth.listUsers(3,page.pageToken);assert.equal(second.users.length,3);console.log(JSON.stringify({emulator:true,rolesVerified:roles.length,paginationVerified:true,tenantIsolationClaims:true}));

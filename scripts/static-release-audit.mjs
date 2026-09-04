import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const checks=[];
const expect=(name,condition,detail)=>checks.push({name,ok:Boolean(condition),detail});
const server=read('server.ts');
const auth=read('src/contexts/AuthContext.tsx');
const login=read('src/pages/Login.tsx');
const detector=read('src/components/project/TurnitinForensicShieldModal.tsx');
const messages=read('src/lib/i18n-messages.ts');
const visual=read('src/components/project/DynamicDataVisualizer.tsx');
const red=read('src/components/project/RedTeamingArena.tsx');
const slides=read('src/components/project/AutoPresentationStudio.tsx');
const refs=read('src/components/project/LiveScholarVerifier.tsx');
const matrix=read('src/components/project/RequirementMatrixStudio.tsx');
const abuse=read('src/server/abuse-guard.ts');
const deviceTrust=read('src/lib/device-trust.ts');
const exports=read('src/server/export.ts');
const firebaseServices=read('src/server/firebase-services.ts');
const storage=read('src/server/storage.ts');
const mfaSetup=read('src/pages/MfaSetup.tsx');
const deployCloudRun=read('scripts/deploy-cloud-run.sh');
const runtimeIam=read('scripts/configure-firebase-runtime-iam.sh');
const runtimeRepair=read('scripts/repair-cloud-run-firebase-access.sh');

const i18n=read('src/lib/i18n.tsx');
const onboarding=read('src/pages/Onboarding.tsx');
const billing=read('src/server/billing.ts');
const runtimeConfig=read('public/env-config.js');
const uiFiles=[];
for (const base of ['src/pages','src/components']) {
  const walk=(dir)=>{ for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){ const rel=path.join(dir,entry.name); if(entry.isDirectory()) walk(rel); else if(/\.(ts|tsx)$/.test(entry.name)) uiFiles.push(read(rel)); } };
  walk(base);
}
const uiCorpus=uiFiles.join('\n');


expect('Missing bearer token fails closed',/if \(!token\)[\s\S]{0,220}AUTH_REQUIRED/.test(server),'authenticate() must return 401 without token');
expect('Firebase token uses Admin SDK verification',server.includes('return getAuth().verifyIdToken(token, checkRevoked)')&&server.includes('const decoded: any = await verifyFirebaseIdToken(token)'),'token acceptance requires Firebase Admin verification');
expect('No unsigned JWT authentication fallback',!/Buffer\.from\(parts\[1\][\s\S]{0,1200}return \{[\s\S]{0,900}uid:/.test(server),'decoded JWT metadata must never become an authenticated actor');
expect('Unsigned JWT payloads are never trusted',server.includes('Diagnostic only')&&server.includes('acceptance still requires Firebase Admin signature validation')&&!server.includes('safeVerifyToken'),'unverified JWT payload may only be used for diagnostics, never authentication');
expect('Named Firestore database is explicit',firebaseServices.includes('appletConfig.firestoreDatabaseId')&&firebaseServices.includes('getFirestore(databaseId)'),'backend must use the configured named Firestore database instead of silently targeting (default)');
expect('Storage uses configured Firebase bucket fallback',storage.includes('firebaseStorageBucketName()')&&!storage.includes('process.env.FIREBASE_STORAGE_BUCKET'),'uploads must use the applet-config bucket when no duplicate server env is present');
expect('Cloud Run deploy is pinned to Firebase project',deployCloudRun.includes('PROJECT_ID="${CLOUD_RUN_PROJECT_ID:-$FIREBASE_PROJECT_ID}"')&&deployCloudRun.includes('Refusing cross-project deployment'),'deployment must not silently use an unrelated current gcloud project');
expect('Cloud Run preserves existing deployment identity',!deployCloudRun.includes('--service-account')&&deployCloudRun.includes('refusing to create a surprise service'),'deployment must not replace the AI Studio/Cloud Run service identity or silently create a second service');
expect('Firebase runtime IAM targets the existing identity',runtimeIam.includes('RUNTIME_SERVICE_ACCOUNT is required')&&runtimeIam.includes('roles/datastore.user')&&runtimeRepair.includes('spec.template.spec.serviceAccountName'),'IAM repair must grant the current Cloud Run identity instead of inventing a new account');
expect('Credential project mismatch fails closed',firebaseServices.includes('FIREBASE_CREDENTIAL_PROJECT_MISMATCH')&&firebaseServices.includes('FIREBASE_RUNTIME_PROJECT_MISMATCH'),'cross-project credential mistakes must be explicit instead of surfacing as Firestore code 7');
expect('MFA is not a global read blocker',!server.includes('Multi-factor authentication is required for this administrative role')&&server.includes('MFA is required for this sensitive action'),'privileged users must reach read-only admin pages while sensitive writes still require MFA');
expect('MFA enrollment and challenge are implemented',mfaSetup.includes('TotpMultiFactorGenerator.generateSecret')&&login.includes('getMultiFactorResolver')&&login.includes('resolveSignIn'),'Firebase MFA must have a complete enrollment and sign-in path');
expect('No local auth fallback',!auth.includes('localStorage') && !auth.includes('localUser'),'AuthContext must never fabricate a signed-in user');
expect('Showcase demo personas are fully removed',!/showcase/i.test(login)&&!login.includes('@showcase.academicos.local'),'demo personas must not exist in production code');
expect('Detector is not branded as external detector',messages.includes('It does not claim to identify who wrote the text or impersonate any external detector.') && messages.includes('integrity.riskNotAi'),'style analysis must state its boundary in i18n and never present its score as AI probability');
expect('Visualizer contains no fabricated research sample',!visual.includes('المجموعة الضابطة')&&!visual.includes('p < 0.001')&&!visual.includes('N = 120'),'visuals must derive from Project DNA only');
expect('Red team contains no fabricated Cronbach/sample result',!red.includes("Cronbach's Alpha =")&&!red.includes('كلية واحدة فقط'),'red team must derive critique from recorded context');
expect('Presentation contains no fabricated findings',!slides.includes('إثبات صحة الفرضيات')&&!slides.includes('التحقق من الصدق')&&!slides.includes('أحدث الأبحاث (2022-2026)'),'presentation cannot invent research execution/results');
expect('Presentation export is a real action',slides.includes('onClick={exportDeck}')&&slides.includes('new Blob'),'export control must generate a file');
expect('Crossref UI has no planted article list',!refs.includes('const mock')&&!refs.includes('mockSources')&&!refs.includes('Sample Article'),'source verification must use API results, not timed simulation');
expect('Requirements have no planted APA/Cronbach rows',!matrix.includes('Cronbach')&&!matrix.includes('8 مراجع'),'requirement matrix must use Project DNA');
expect('Red-team endpoint exists',server.includes('/api/projects/:id/red-team')&&server.includes('Never invent sample sizes'),'AI adversarial review must have a hard evidence boundary');
expect('Free preview is Fair-Use guarded',server.includes('reserveFreeBenefit')&&server.includes('FREE_PREVIEW_FAIR_USE_LIMIT'),'free AI value must be account-scoped and abuse guarded');
expect('Fair-Use requires verified email',server.includes('FREE_PREVIEW_EMAIL_VERIFICATION_REQUIRED'),'free benefit must require verified email');
expect('Device trust avoids invasive fingerprint surfaces',deviceTrust.includes('hardwareConcurrency')&&!/getContext\(|AudioContext|queryLocalFonts|enumerateDevices/i.test(deviceTrust),'use coarse signals, never MAC/canvas/audio/font fingerprinting');
expect('Fair-Use reservations expire safely',abuse.includes('activeReservations')&&abuse.includes('reservationExpiresAt'),'crashed requests must not permanently consume a free benefit');

expect('Global locale defaults are browser-first',i18n.includes('navigator.language') && !i18n.includes('return "ar"'),'language must follow the user/browser with a neutral fallback');
expect('Core UI supports eight launch locales',onboarding.includes('LOCALES.map') && ['ar','en','tr','zh','hi','es','fr','ur'].every((code)=>i18n.includes(`code: \"${code}\"`)),'onboarding must expose the eight supported launch languages');
expect('No Kuwait-only UI defaults',!/(ar-KW|د\.ك|Kuwait-only|الكويت فقط)/i.test(uiCorpus),'Kuwait may be a selectable market, never the product default');
expect('Global billing is USD-first',billing.includes("'USD'") && !billing.includes("process.env.BILLING_CURRENCY || 'KWD'"),'global checkout must not default to KWD');
expect('No environment-specific Firebase project is shipped',!/(AIzaSy|firebaseapp\.com|firebasestorage\.app)/.test(runtimeConfig),'deployment must inject the target Firebase web configuration instead of shipping a developer project');

expect('Global export direction is dynamic',exports.includes('exportLocale(project,branding)')&&exports.includes('rightToLeft="${rtl?1:0}"')&&!exports.includes('<html lang="ar" dir="rtl">'),'Office/HTML export must follow project locale, not Kuwait/Arabic defaults');

for(const c of checks) console.log(`${c.ok?'PASS':'FAIL'}  ${c.name}${c.ok?'':` — ${c.detail}`}`);
const failed=checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} release invariants passed.`);
if(failed.length) process.exit(1);

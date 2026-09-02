import { initializeApp, getApps } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import appletConfig from '../../firebase-applet-config.json';

// يقرأ الإعداد أولًا من window.__ENV__ (حقن وقت التشغيل عبر public/env-config.js)
// ثم يعود لمتغيرات البناء (import.meta.env). لا يوجد أي مشروع Firebase افتراضي مخفي.
const runtimeEnv: Record<string, string | undefined> =
  (typeof window !== 'undefined' && (window as any).__ENV__) || {};

function envValue(key: string, fallback?: string): string | undefined {
  const runtime = runtimeEnv[key];
  if (runtime !== undefined && String(runtime).trim() !== '') return String(runtime);
  const built = (import.meta.env as unknown as Record<string, string | undefined>)[key];
  if (built && String(built).trim() !== '') return built;
  return fallback || undefined;
}

const config = {
  apiKey: envValue('VITE_FIREBASE_API_KEY', appletConfig.apiKey),
  authDomain: envValue('VITE_FIREBASE_AUTH_DOMAIN', appletConfig.authDomain),
  projectId: envValue('VITE_FIREBASE_PROJECT_ID', appletConfig.projectId),
  storageBucket: envValue('VITE_FIREBASE_STORAGE_BUCKET', appletConfig.storageBucket),
  messagingSenderId: envValue('VITE_FIREBASE_MESSAGING_SENDER_ID', appletConfig.messagingSenderId),
  appId: envValue('VITE_FIREBASE_APP_ID', appletConfig.appId),
};

export const adminMfaRequiredByDeployment = envValue('VITE_REQUIRE_ADMIN_MFA') === 'true';
export const firebaseClientConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
export const firebaseApp = firebaseClientConfigured ? (getApps()[0] || initializeApp(config)) : null;
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
const authEmulatorUrl = String(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL || '');
if (firebaseAuth && import.meta.env.DEV && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(authEmulatorUrl)) {
  connectAuthEmulator(firebaseAuth, authEmulatorUrl, { disableWarnings: true });
}

const appCheckSiteKey = envValue('VITE_FIREBASE_APPCHECK_SITE_KEY');
export const firebaseAppCheck = firebaseApp && appCheckSiteKey && typeof window !== 'undefined'
  ? initializeAppCheck(firebaseApp, { provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey), isTokenAutoRefreshEnabled: true })
  : null;


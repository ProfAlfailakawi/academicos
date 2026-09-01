import { initializeApp, getApps } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBTsN8lR4KmWHwH9LM1xvMxh13mn3LvUws",
  authDomain: "tebyan-clean-2026-5f13b.firebaseapp.com",
  projectId: "tebyan-clean-2026-5f13b",
  storageBucket: "tebyan-clean-2026-5f13b.firebasestorage.app",
  messagingSenderId: "522016905178",
  appId: "1:522016905178:web:c5fe247cc7d44a045c52e3",
};

// يقرأ الإعداد أولًا من window.__ENV__ (حقن وقت التشغيل عبر public/env-config.js)
// ثم يعود لمتغيرات البناء (import.meta.env)، ثم إلى التكوين الافتراضي للمشروع.
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
  apiKey: envValue('VITE_FIREBASE_API_KEY', DEFAULT_FIREBASE_CONFIG.apiKey),
  authDomain: envValue('VITE_FIREBASE_AUTH_DOMAIN', DEFAULT_FIREBASE_CONFIG.authDomain),
  projectId: envValue('VITE_FIREBASE_PROJECT_ID', DEFAULT_FIREBASE_CONFIG.projectId),
  storageBucket: envValue('VITE_FIREBASE_STORAGE_BUCKET', DEFAULT_FIREBASE_CONFIG.storageBucket),
  messagingSenderId: envValue('VITE_FIREBASE_MESSAGING_SENDER_ID', DEFAULT_FIREBASE_CONFIG.messagingSenderId),
  appId: envValue('VITE_FIREBASE_APP_ID', DEFAULT_FIREBASE_CONFIG.appId),
};

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


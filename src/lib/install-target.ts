import { isAppleNativeShell } from "./platform";

/** Public App Store page (app is live). */
export const APP_STORE_URL = "https://apps.apple.com/app/id6834583434";
/** Google Play app is in closed testing with no public link yet; fill when it goes public. */
export const PLAY_STORE_URL = "";

export type InstallTarget =
  | { kind: "none" }
  | { kind: "store"; url: string }
  | { kind: "pwa" };

export type InstallEnv = {
  userAgent?: string;
  maxTouchPoints?: number;
  platform?: string;
  nativeIosShell?: boolean;
  appStoreUrl?: string;
  playStoreUrl?: string;
};

/**
 * Decides what an "install the app" banner/prompt should do. Single source of truth:
 * - inside the iOS native shell: never show (kind "none");
 * - iPhone/iPad browser: show, primary action opens the App Store;
 * - Android browser: Play Store link when PLAY_STORE_URL is set, else the PWA install prompt;
 * - everything else (desktop): PWA install prompt, unchanged.
 */
export function resolveInstallTarget(env: InstallEnv = readEnv()): InstallTarget {
  if (env.nativeIosShell) return { kind: "none" };
  const ua = env.userAgent || "";
  // iPadOS 13+ Safari reports a Mac UA; tell it apart by touch support.
  const ios = /iPhone|iPad|iPod/i.test(ua) || (env.platform === "MacIntel" && (env.maxTouchPoints || 0) > 1);
  if (ios) return { kind: "store", url: env.appStoreUrl ?? APP_STORE_URL };
  if (/Android/i.test(ua)) {
    const play = env.playStoreUrl ?? PLAY_STORE_URL;
    return play ? { kind: "store", url: play } : { kind: "pwa" };
  }
  return { kind: "pwa" };
}

function readEnv(): InstallEnv {
  if (typeof navigator === "undefined") return {};
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    platform: navigator.platform,
    nativeIosShell: isAppleNativeShell(),
  };
}

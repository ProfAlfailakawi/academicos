const INSTALL_KEY = "academicos.install.v1";
let cachedFingerprint: Promise<string | null> | null = null;

function safeStorageGet(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeStorageSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch {}
}

export function getInstallId(): string | null {
  if (typeof window === "undefined") return null;
  let value = safeStorageGet(INSTALL_KEY);
  if (value && /^[A-Za-z0-9_-]{16,128}$/.test(value)) return value;
  value = crypto.randomUUID().replace(/-/g, "");
  safeStorageSet(INSTALL_KEY, value);
  return value;
}

function bucket(value: number | undefined, step: number, fallback = 0) {
  if (!Number.isFinite(value)) return fallback;
  return Math.round(Number(value) / step) * step;
}

async function sha256Base64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const raw = String.fromCharCode(...new Uint8Array(digest));
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Coarse, privacy-preserving device cohort hash.
 * No canvas/audio/font enumeration and no raw signal is sent to the server.
 * This is only one anti-abuse signal and is never treated as proof of identity.
 */
export function getDeviceCohortFingerprint(): Promise<string | null> {
  if (cachedFingerprint) return cachedFingerprint;
  cachedFingerprint = (async () => {
    if (typeof window === "undefined" || !window.crypto?.subtle) return null;
    const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { platform?: string; mobile?: boolean } };
    const screenInfo = typeof screen !== "undefined" ? screen : null;
    const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; } })();
    const payload = {
      v: 1,
      platform: nav.userAgentData?.platform || nav.platform || "",
      mobile: Boolean(nav.userAgentData?.mobile),
      languages: Array.from(nav.languages || [nav.language]).slice(0, 4).map((x) => String(x).toLowerCase()),
      timezone: tz,
      screen: screenInfo ? `${bucket(screenInfo.width, 100)}x${bucket(screenInfo.height, 100)}x${screenInfo.colorDepth || 0}` : "",
      concurrency: bucket(nav.hardwareConcurrency, 2),
      memory: bucket(nav.deviceMemory, 2),
      touch: bucket(nav.maxTouchPoints, 2),
    };
    return await sha256Base64Url(JSON.stringify(payload));
  })();
  return cachedFingerprint;
}

export async function deviceTrustHeaders(): Promise<Record<string, string>> {
  const [installId, fingerprint] = await Promise.all([
    Promise.resolve(getInstallId()),
    getDeviceCohortFingerprint(),
  ]);
  return {
    ...(installId ? { "X-Academicos-Install": installId } : {}),
    ...(fingerprint ? { "X-Academicos-Device": fingerprint } : {}),
    "X-Academicos-Device-Version": "1",
  };
}

type CapacitorLike = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

/**
 * True only inside the native iOS app (Capacitor, hosted mode), where Capacitor
 * injects `window.Capacitor`. App Store Guideline 3.1.1 / 3.1.3(b): the iOS app
 * must not offer purchases, show prices, or point to buying elsewhere, so
 * purchase surfaces are hidden there. Always false on the website, SSR and tests.
 */
export function isAppleNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const cap = (window as unknown as { Capacitor?: CapacitorLike }).Capacitor;
    return Boolean(cap?.isNativePlatform?.()) && cap?.getPlatform?.() === "ios";
  } catch {
    return false;
  }
}

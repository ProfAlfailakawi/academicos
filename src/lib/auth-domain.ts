// Firebase Auth runs a helper iframe and (for redirect/popup providers) a handler page on `authDomain`.
// When authDomain differs from the serving host, Safari/ITP partitions that third-party storage and
// sign-in fails ("missing initial state"). So on an explicitly allowlisted serving host we use that
// host as authDomain (Firebase Hosting serves /__/auth/* there). Everything else keeps the configured value.
// Pure (no window/process access) so the browser and the server CSP builder share one rule.
export const SAME_ORIGIN_AUTH_HOSTS: readonly string[] = ['academicos-edu.web.app'];

export function resolveAuthDomain(configured: string | undefined, servingHost: string | undefined): string {
  const fallback = String(configured || '').trim();
  const host = String(servingHost || '').trim().toLowerCase().replace(/:\d+$/, '');
  return SAME_ORIGIN_AUTH_HOSTS.includes(host) ? host : fallback;
}

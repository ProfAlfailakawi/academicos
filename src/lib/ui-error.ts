import { ApiError } from "./api";

export type Translate = (key: string) => string;

/**
 * Converts technical/backend errors into safe, localized UI messages.
 *
 * Important:
 * - Never exposes raw backend/Firebase/Firestore/provider messages.
 * - ApiError.code/status are used only to choose a translation.
 * - Caller may provide a domain-specific fallback key.
 * - Technical details should still be logged separately with console.error().
 */
export function localizedUiError(
  error: unknown,
  t: Translate,
  fallbackKey = "ui.actionError",
): string {
  if (error instanceof ApiError) {
    const code = String(error.code || "").toUpperCase();

    if (code === "AUTH_EXPIRED" || code === "AUTH_INVALID" || error.status === 401) {
      return t("ui.error.sessionExpired");
    }

    if (
      code === "PERMISSION_DENIED" ||
      code === "FORBIDDEN" ||
      code === "AUTH_FORBIDDEN" ||
      error.status === 403
    ) {
      return t("ui.error.permission");
    }

    if (
      code === "RATE_LIMITED" ||
      code === "TOO_MANY_REQUESTS" ||
      code === "FAIR_USE_LIMIT" ||
      error.status === 429
    ) {
      return t("ui.error.rateLimit");
    }

    if (error.status === 404) {
      return t("ui.error.notFound");
    }

    if (error.status === 408 || error.status === 504) {
      return t("ui.error.timeout");
    }

    if (error.status >= 500) {
      return t("ui.error.service");
    }

    if (error.status === 400 || error.status === 422) {
      return t(fallbackKey);
    }

    return t(fallbackKey);
  }

  // fetch() network failures commonly surface as TypeError.
  if (error instanceof TypeError) {
    return t("ui.error.network");
  }

  return t(fallbackKey);
}

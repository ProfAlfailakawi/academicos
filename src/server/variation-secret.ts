// Resolves the HMAC secret used to derive per-student variation profiles.
//
// The secret must never be a literal in source: a fixed value would make every
// deployment produce identical, predictable variation ids for the same input.
// Production deployments are expected to set PROJECT_VARIATION_SECRET (enforced
// by scripts/verify-production-env.mjs). When nothing is configured we fall back
// to a random per-process secret instead of a shipped constant: variation ids
// then stop being stable across restarts, but they are never guessable and no
// secret ships in the repository.

import { randomBytes } from "node:crypto";

let ephemeralSecret = "";
let ephemeralWarningLogged = false;

function configuredVariationSecret(): string {
  return (
    String(process.env.PROJECT_VARIATION_SECRET || "").trim() ||
    String(process.env.CSRF_SIGNING_SECRET || "").trim()
  );
}

export function resolveVariationSecret(domain: string): string {
  const configured = configuredVariationSecret();
  if (configured) return `${domain}:${configured}`;
  if (!ephemeralSecret) ephemeralSecret = randomBytes(32).toString("hex");
  if (!ephemeralWarningLogged) {
    ephemeralWarningLogged = true;
    console.warn(
      "PROJECT_VARIATION_SECRET is not set; using a random per-process secret. " +
        "Variation profiles will not be stable across restarts or instances.",
    );
  }
  return `${domain}:${ephemeralSecret}`;
}

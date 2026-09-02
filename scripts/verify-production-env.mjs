const required = [
  "APP_URL",
  "ALLOWED_ORIGINS",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_APPCHECK_SITE_KEY",
  "PROJECT_VARIATION_SECRET",
  "ABUSE_HASH_SECRET",
];
const errors = [];
const warnings = [];
const env = process.env;

const firebaseProject = String(env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || "").trim();
const runtimeProject = String(env.GOOGLE_CLOUD_PROJECT || env.GCLOUD_PROJECT || "").trim();
if (runtimeProject && firebaseProject && runtimeProject !== firebaseProject && env.ALLOW_CROSS_PROJECT_FIREBASE !== "true")
  errors.push(`Runtime project ${runtimeProject} does not match Firebase project ${firebaseProject}`);
if (env.FIREBASE_SERVICE_ACCOUNT && (env.K_SERVICE || env.K_REVISION))
  errors.push("Cloud Run must use its attached service identity; remove FIREBASE_SERVICE_ACCOUNT to avoid stale/cross-project credentials");
if (!String(env.FIREBASE_FIRESTORE_DATABASE_ID || "").trim())
  warnings.push("FIREBASE_FIRESTORE_DATABASE_ID is not explicit; backend will fall back to firebase-applet-config.json");
for (const key of required) if (!String(env[key] || "").trim()) errors.push(`${key} is required`);
if (env.NODE_ENV !== "production") errors.push("NODE_ENV must be production");
for (const key of ["APP_URL", ...String(env.ALLOWED_ORIGINS || "").split(",").map(() => "ALLOWED_ORIGINS")]) {
  const value = key === "ALLOWED_ORIGINS" ? String(env.ALLOWED_ORIGINS || "").split(",")[0]?.trim() : String(env[key] || "");
  if (value && !/^https:\/\//i.test(value)) errors.push(`${key} must use https in production`);
}
if (env.REQUIRE_APP_CHECK !== "true") errors.push("REQUIRE_APP_CHECK must be true for launch");
if (env.REQUIRE_ADMIN_MFA !== "true") errors.push("REQUIRE_ADMIN_MFA must be true for launch");
if (String(env.PROJECT_VARIATION_SECRET || "").length < 32) errors.push("PROJECT_VARIATION_SECRET must be at least 32 characters");
if (String(env.ABUSE_HASH_SECRET || "").length < 32) errors.push("ABUSE_HASH_SECRET must be at least 32 characters");
if (!String(env.TRUST_PROXY || "").trim()) warnings.push("TRUST_PROXY is not set. Configure it for your actual reverse-proxy topology before relying on network velocity signals.");
const provider = String(env.AI_PROVIDER || "gemini").toLowerCase();
const geminiConfigured = Boolean(env.GEMINI_API_KEY && (env.GEMINI_MODEL || env.GEMINI_MODEL_FAST || env.GEMINI_MODEL_STRONG));
const gatewayConfigured = ["OPENAI", "ANTHROPIC", "LOCAL_AI", "INSTITUTION_AI"].some((prefix) => Boolean(env[`${prefix}_GATEWAY_URL`] && env[`${prefix}_GATEWAY_TOKEN`]));
if (!geminiConfigured && !gatewayConfigured) errors.push("Configure at least one AI provider/model (Gemini or a normalized gateway)");
if (provider === "gemini" && !geminiConfigured) errors.push("AI_PROVIDER=gemini requires GEMINI_API_KEY and at least one GEMINI_MODEL alias");
if (env.EMBEDDING_MODEL && env.EMBEDDING_MODEL !== "gemini-embedding-2") warnings.push(`Embedding model is ${env.EMBEDDING_MODEL}; verify it is intentional and currently supported.`);
if (env.VITE_FIREBASE_AUTH_EMULATOR_URL) errors.push("VITE_FIREBASE_AUTH_EMULATOR_URL must be empty in production");
if (env.IMPERSONATION_ENABLED === "true") warnings.push("Impersonation is enabled; confirm tenant policy and support controls before launch.");
if (env.REQUIRE_VIRUS_SCAN !== "true") warnings.push("Malware scanning is not required. Consider enabling it before broad public file uploads.");
if (env.REQUIRE_OCR !== "true") warnings.push("OCR is optional. Image-only study materials may need a configured OCR provider.");
if (env.BILLING_PROVIDER === "disabled" || !String(env.BILLING_PROVIDER || "").trim()) warnings.push("Billing is disabled. This is acceptable for a closed pilot, but public paid launch requires a configured checkout provider.");
if (Number(env.FREE_BENEFIT_ACCOUNT_LIMIT || 1) > 1) warnings.push("FREE_BENEFIT_ACCOUNT_LIMIT is above 1; review the free-preview economics before launch.");
if (errors.length) {
  console.error("\nAcademicOS production verification: BLOCKED\n");
  for (const error of errors) console.error(`  ✗ ${error}`);
  if (warnings.length) { console.error("\nWarnings:"); for (const warning of warnings) console.error(`  ! ${warning}`); }
  process.exit(1);
}
console.log("\nAcademicOS production verification: PASS");
console.log("  ✓ Firebase client + App Check configuration present");
console.log("  ✓ privileged MFA required");
console.log("  ✓ AI provider/model configured");
console.log("  ✓ HTTPS origins configured");
console.log("  ✓ production variation + Fair-Use hashing secrets present");
if (warnings.length) { console.log("\nWarnings:"); for (const warning of warnings) console.log(`  ! ${warning}`); }

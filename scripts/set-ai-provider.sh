#!/usr/bin/env bash
#
# One-command AI provider wiring for the running AcademicOS Cloud Run service.
#
# WHY THIS EXISTS
#   The deploy script wires Firebase, but the running service starts with
#   aiConfigured=false — so project writing falls back to the offline
#   deterministic scaffold instead of real AI. This script sets the Gemini
#   (Google AI Studio) provider env vars on the EXISTING service, in place,
#   without redeploying code and without touching the service identity.
#
# USAGE
#   GEMINI_API_KEY=AIza... bash scripts/set-ai-provider.sh
#
# OPTIONAL OVERRIDES (sensible defaults are auto-detected)
#   CLOUD_RUN_SERVICE_NAME   default: academicos-app
#   CLOUD_RUN_REGION         default: europe-west2
#   CLOUD_RUN_PROJECT_ID     default: the active gcloud project
#   GEMINI_MODEL             default: gemini-2.5-flash        (used for every task)
#   GEMINI_MODEL_FAST        default: gemini-2.5-flash-lite   (low-complexity tasks)
#   GEMINI_MODEL_STRONG      default: gemini-2.5-flash        (high-risk tasks; kept on the free tier)
#
set -euo pipefail

command -v gcloud >/dev/null 2>&1 || { echo "gcloud is required (install the Google Cloud SDK)." >&2; exit 1; }

: "${GEMINI_API_KEY:?Set GEMINI_API_KEY. Get a free key at https://aistudio.google.com/apikey}"

SERVICE_NAME="${CLOUD_RUN_SERVICE_NAME:-academicos-app}"
REGION="${CLOUD_RUN_REGION:-europe-west2}"
PROJECT_ID="${CLOUD_RUN_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
[[ -n "$PROJECT_ID" && "$PROJECT_ID" != "(unset)" ]] || { echo "No project. Pass CLOUD_RUN_PROJECT_ID=... or run: gcloud config set project <id>" >&2; exit 1; }

GEMINI_MODEL="${GEMINI_MODEL:-gemini-2.5-flash}"
GEMINI_MODEL_FAST="${GEMINI_MODEL_FAST:-gemini-2.5-flash-lite}"
GEMINI_MODEL_STRONG="${GEMINI_MODEL_STRONG:-gemini-2.5-flash}"

echo "Wiring Gemini onto: $SERVICE_NAME ($REGION) in project $PROJECT_ID"

# --update-env-vars keeps every other variable (Firebase, APP_URL, ...) untouched
# and never alters the service identity. The key is passed as an env var; for a
# hardened setup, store it in Secret Manager and use --update-secrets instead.
gcloud run services update "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --update-env-vars "AI_PROVIDER=gemini,GEMINI_API_KEY=$GEMINI_API_KEY,GEMINI_MODEL=$GEMINI_MODEL,GEMINI_MODEL_FAST=$GEMINI_MODEL_FAST,GEMINI_MODEL_STRONG=$GEMINI_MODEL_STRONG" \
  --quiet

URL="$(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"
echo
echo "Done. Verify it took effect (aiConfigured should now be true):"
echo "  curl -s $URL/api/health | grep -o '\"aiConfigured\":[a-z]*'"

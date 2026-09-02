#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/firebase-applet-config.json"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "Google Cloud CLI (gcloud) is required." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required." >&2
  exit 1
fi

read_config() {
  node -e "const c=require(process.argv[1]); const v=c[process.argv[2]]; if(v!==undefined&&v!==null) process.stdout.write(String(v));" "$CONFIG_FILE" "$1"
}

SERVICE_NAME="${CLOUD_RUN_SERVICE_NAME:-academicos-app}"
REGION="${CLOUD_RUN_REGION:-us-central1}"
CONFIG_FIREBASE_PROJECT_ID="$(read_config projectId)"
FIREBASE_PROJECT_ID="${TARGET_FIREBASE_PROJECT_ID:-$CONFIG_FIREBASE_PROJECT_ID}"
FIRESTORE_DATABASE_ID="${TARGET_FIRESTORE_DATABASE_ID:-$(read_config firestoreDatabaseId)}"
FIREBASE_STORAGE_BUCKET="${TARGET_FIREBASE_STORAGE_BUCKET:-$(read_config storageBucket)}"
FIREBASE_API_KEY="$(read_config apiKey)"
FIREBASE_AUTH_DOMAIN="$(read_config authDomain)"
FIREBASE_MESSAGING_SENDER_ID="$(read_config messagingSenderId)"
FIREBASE_APP_ID="$(read_config appId)"
PROJECT_ID="${CLOUD_RUN_PROJECT_ID:-$FIREBASE_PROJECT_ID}"
RUNTIME_SERVICE_ACCOUNT="${CLOUD_RUN_SERVICE_ACCOUNT:-academicos-runtime@${FIREBASE_PROJECT_ID}.iam.gserviceaccount.com}"

if [[ -z "$PROJECT_ID" || -z "$FIREBASE_PROJECT_ID" ]]; then
  echo "Firebase/Cloud Run project id is not configured." >&2
  exit 1
fi
if [[ "$PROJECT_ID" != "$FIREBASE_PROJECT_ID" && "${ALLOW_CROSS_PROJECT_FIREBASE:-false}" != "true" ]]; then
  echo "Refusing an accidental cross-project deployment." >&2
  echo "Cloud Run project: $PROJECT_ID" >&2
  echo "Firebase project:  $FIREBASE_PROJECT_ID" >&2
  echo "AcademicOS should normally deploy to the Firebase project itself." >&2
  echo "Set ALLOW_CROSS_PROJECT_FIREBASE=true only for a deliberately configured cross-project architecture." >&2
  exit 1
fi

if [[ "${SKIP_RUNTIME_IAM_SETUP:-false}" != "true" ]]; then
  CLOUD_RUN_SERVICE_ACCOUNT="$RUNTIME_SERVICE_ACCOUNT" \
  FIREBASE_PROJECT_ID="$FIREBASE_PROJECT_ID" \
  FIREBASE_FIRESTORE_DATABASE_ID="$FIRESTORE_DATABASE_ID" \
  FIREBASE_STORAGE_BUCKET="$FIREBASE_STORAGE_BUCKET" \
  "$ROOT_DIR/scripts/configure-firebase-runtime-iam.sh"
fi

echo "Deploying AcademicOS -> project=$PROJECT_ID region=$REGION service=$SERVICE_NAME"
echo "Runtime identity -> $RUNTIME_SERVICE_ACCOUNT"

gcloud run deploy "$SERVICE_NAME" \
  --source "$ROOT_DIR" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --service-account "$RUNTIME_SERVICE_ACCOUNT" \
  --allow-unauthenticated \
  --update-env-vars "FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID,FIREBASE_FIRESTORE_DATABASE_ID=$FIRESTORE_DATABASE_ID,FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET,VITE_FIREBASE_API_KEY=$FIREBASE_API_KEY,VITE_FIREBASE_AUTH_DOMAIN=$FIREBASE_AUTH_DOMAIN,VITE_FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID,VITE_FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET,VITE_FIREBASE_MESSAGING_SENDER_ID=$FIREBASE_MESSAGING_SENDER_ID,VITE_FIREBASE_APP_ID=$FIREBASE_APP_ID,CHECK_REVOKED_ID_TOKENS=false" \
  --quiet

URL="$(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')"
if [[ -z "$URL" ]]; then
  echo "Deployment completed, but the Cloud Run URL could not be resolved." >&2
  exit 1
fi

# Remove any legacy JSON service-account credential from the service so the
# attached Cloud Run identity is the single source of server credentials.
if gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format=json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const x=JSON.parse(s);const env=x?.spec?.template?.spec?.containers?.[0]?.env||[];process.exit(env.some(e=>e.name==="FIREBASE_SERVICE_ACCOUNT")?0:1)})'; then
  echo "Removing legacy FIREBASE_SERVICE_ACCOUNT from Cloud Run; ADC will use the attached runtime identity."
  gcloud run services update "$SERVICE_NAME" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --remove-env-vars "FIREBASE_SERVICE_ACCOUNT" \
    --quiet >/dev/null
fi

# Keep self-referential URLs and browser CORS on this service's permanent URL.
gcloud run services update "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --update-env-vars "APP_URL=$URL,ALLOWED_ORIGINS=$URL" \
  --quiet >/dev/null

printf '\nAcademicOS Cloud Run service: %s\nURL: %s\nFirebase project: %s\nFirestore database: %s\nRuntime service account: %s\n' \
  "$SERVICE_NAME" "$URL" "$FIREBASE_PROJECT_ID" "$FIRESTORE_DATABASE_ID" "$RUNTIME_SERVICE_ACCOUNT"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/firebase-applet-config.json"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "Google Cloud CLI (gcloud) is required." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to read firebase-applet-config.json." >&2
  exit 1
fi
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "firebase-applet-config.json was not found at $CONFIG_FILE" >&2
  exit 1
fi

read_config() {
  node -e "const c=require(process.argv[1]); const v=c[process.argv[2]]; if(v!==undefined&&v!==null) process.stdout.write(String(v));" "$CONFIG_FILE" "$1"
}

FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-$(read_config projectId)}"
FIRESTORE_DATABASE_ID="${FIREBASE_FIRESTORE_DATABASE_ID:-$(read_config firestoreDatabaseId)}"
FIREBASE_STORAGE_BUCKET="${FIREBASE_STORAGE_BUCKET:-$(read_config storageBucket)}"
RUNTIME_SA_NAME="${ACADEMICOS_RUNTIME_SERVICE_ACCOUNT_NAME:-academicos-runtime}"
RUNTIME_SERVICE_ACCOUNT="${CLOUD_RUN_SERVICE_ACCOUNT:-${RUNTIME_SA_NAME}@${FIREBASE_PROJECT_ID}.iam.gserviceaccount.com}"

if [[ -z "$FIREBASE_PROJECT_ID" ]]; then
  echo "Firebase project id is empty." >&2
  exit 1
fi
if [[ -z "$FIRESTORE_DATABASE_ID" ]]; then
  echo "Firestore database id is empty." >&2
  exit 1
fi

EXPECTED_SUFFIX="@${FIREBASE_PROJECT_ID}.iam.gserviceaccount.com"
if [[ "$RUNTIME_SERVICE_ACCOUNT" != *"$EXPECTED_SUFFIX" && "${ALLOW_CROSS_PROJECT_FIREBASE:-false}" != "true" ]]; then
  echo "Runtime service account belongs to another project: $RUNTIME_SERVICE_ACCOUNT" >&2
  echo "Expected an account in Firebase project $FIREBASE_PROJECT_ID." >&2
  echo "Set ALLOW_CROSS_PROJECT_FIREBASE=true only if you intentionally maintain cross-project IAM." >&2
  exit 1
fi

printf 'AcademicOS Firebase runtime IAM\n'
printf '  project:   %s\n' "$FIREBASE_PROJECT_ID"
printf '  database:  %s\n' "$FIRESTORE_DATABASE_ID"
printf '  bucket:    %s\n' "$FIREBASE_STORAGE_BUCKET"
printf '  identity:  %s\n\n' "$RUNTIME_SERVICE_ACCOUNT"

# These are the APIs used by the runtime identity. Enabling an already-enabled
# API is idempotent.
gcloud services enable \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com \
  firebaseappcheck.googleapis.com \
  iamcredentials.googleapis.com \
  storage.googleapis.com \
  --project "$FIREBASE_PROJECT_ID" \
  --quiet

if ! gcloud iam service-accounts describe "$RUNTIME_SERVICE_ACCOUNT" \
  --project "$FIREBASE_PROJECT_ID" >/dev/null 2>&1; then
  if [[ "$RUNTIME_SERVICE_ACCOUNT" != "${RUNTIME_SA_NAME}@${FIREBASE_PROJECT_ID}.iam.gserviceaccount.com" ]]; then
    echo "Configured runtime service account does not exist: $RUNTIME_SERVICE_ACCOUNT" >&2
    exit 1
  fi
  gcloud iam service-accounts create "$RUNTIME_SA_NAME" \
    --project "$FIREBASE_PROJECT_ID" \
    --display-name "AcademicOS Cloud Run runtime" \
    --description "Least-privilege runtime identity for AcademicOS" \
    --quiet
fi

# Firestore Admin SDK bypasses Firebase Security Rules and is authorized by IAM.
# Authentication administration is used for user/claim/session management.
# App Check verification requires its token-verifier role when enforcement is on.
# Storage Object User is enough for the app's object read/write flow.
PROJECT_ROLES=(
  roles/datastore.user
  roles/firebaseauth.admin
  roles/firebaseappcheck.tokenVerifier
  roles/storage.objectUser
  roles/serviceusage.serviceUsageConsumer
)
for role in "${PROJECT_ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "$FIREBASE_PROJECT_ID" \
    --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
    --role="$role" \
    --quiet >/dev/null
  printf '  ✓ %s\n' "$role"
done

# Needed by Firebase Admin createCustomToken() and by Cloud Storage signed URLs
# when Application Default Credentials are used. Bind only on this service
# account, not project-wide.
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SERVICE_ACCOUNT" \
  --project "$FIREBASE_PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --quiet >/dev/null
printf '  ✓ roles/iam.serviceAccountTokenCreator (self only)\n'

cat <<MSG

Firebase runtime IAM is configured.
Use this Cloud Run service identity:
  $RUNTIME_SERVICE_ACCOUNT

Do not inject FIREBASE_SERVICE_ACCOUNT on Cloud Run. AcademicOS should use
Application Default Credentials from the attached service identity.
MSG

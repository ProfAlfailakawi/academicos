#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/firebase-applet-config.json"
command -v gcloud >/dev/null 2>&1 || { echo "gcloud is required" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 1; }
read_config(){ node -e "const c=require(process.argv[1]);const v=c[process.argv[2]];if(v!=null)process.stdout.write(String(v));" "$CONFIG_FILE" "$1"; }
FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-$(read_config projectId)}"
FIRESTORE_DATABASE_ID="${FIREBASE_FIRESTORE_DATABASE_ID:-$(read_config firestoreDatabaseId)}"
RUNTIME_SERVICE_ACCOUNT="${RUNTIME_SERVICE_ACCOUNT:-${CLOUD_RUN_SERVICE_ACCOUNT:-}}"
[[ -n "$FIREBASE_PROJECT_ID" && -n "$FIRESTORE_DATABASE_ID" ]] || { echo "Firebase project/database missing" >&2; exit 1; }
[[ -n "$RUNTIME_SERVICE_ACCOUNT" ]] || { echo "RUNTIME_SERVICE_ACCOUNT is required; this script never invents or creates a Cloud Run identity." >&2; exit 1; }

echo "Configuring Firebase access for the EXISTING Cloud Run identity"
echo "  project:  $FIREBASE_PROJECT_ID"
echo "  database: $FIRESTORE_DATABASE_ID"
echo "  identity: $RUNTIME_SERVICE_ACCOUNT"

gcloud services enable firestore.googleapis.com identitytoolkit.googleapis.com firebaseappcheck.googleapis.com iamcredentials.googleapis.com storage.googleapis.com --project "$FIREBASE_PROJECT_ID" --quiet

# Firestore access is scoped to the exact AI Studio database instead of replacing the
# deployment identity with a new service account.
COND="expression=resource.name==\"projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}\",title=AcademicOSFirestoreDatabase,description=AcademicOS named Firestore database"
if ! gcloud projects add-iam-policy-binding "$FIREBASE_PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role="roles/datastore.user" \
  --condition="$COND" --quiet >/dev/null; then
  echo "Database-scoped IAM binding failed; retrying with the standard project-level Datastore User role." >&2
  gcloud projects add-iam-policy-binding "$FIREBASE_PROJECT_ID" \
    --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
    --role="roles/datastore.user" --quiet >/dev/null
fi

for role in roles/firebaseauth.admin roles/firebaseappcheck.tokenVerifier roles/storage.objectUser roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$FIREBASE_PROJECT_ID" \
    --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" --role="$role" --quiet >/dev/null
  echo "  ✓ $role"
done

# Needed only for createCustomToken / signed URL paths. Do not fail the core login/database repair if policy editing on the SA is restricted.
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SERVICE_ACCOUNT" \
  --project "$FIREBASE_PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SERVICE_ACCOUNT}" \
  --role="roles/iam.serviceAccountTokenCreator" --quiet >/dev/null 2>&1 || \
  echo "  ! tokenCreator self-binding skipped (core Firestore/Auth access is still configured)"

echo "Firebase runtime IAM configured for the current Cloud Run identity."

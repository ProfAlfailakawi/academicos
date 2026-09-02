#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/firebase-applet-config.json"
command -v gcloud >/dev/null 2>&1 || { echo "gcloud is required" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 1; }
read_config(){ node -e "const c=require(process.argv[1]);const v=c[process.argv[2]];if(v!=null)process.stdout.write(String(v));" "$CONFIG_FILE" "$1"; }
PROJECT_ID="${FIREBASE_PROJECT_ID:-$(read_config projectId)}"
SERVICE_NAME="${CLOUD_RUN_SERVICE_NAME:-}"
REGION="${CLOUD_RUN_REGION:-}"

if [[ -z "$SERVICE_NAME" || -z "$REGION" ]]; then
  SERVICES_JSON="$(gcloud run services list --project "$PROJECT_ID" --platform managed --format=json)"
  DETECTED="$(printf '%s' "$SERVICES_JSON" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s||"[]");
const rows=a.map(x=>({name:x?.metadata?.name||"",region:x?.metadata?.labels?.["cloud.googleapis.com/location"]||x?.metadata?.labels?.["run.googleapis.com/region"]||"",managed:String(x?.metadata?.labels?.["managed-by"]||"")})).filter(x=>x.name&&x.region);
let c=rows.filter(x=>/google-ai-studio/i.test(x.managed)); if(c.length!==1)c=rows.filter(x=>/academicos/i.test(x.name)); if(c.length!==1&&rows.length===1)c=rows;
if(c.length===1)process.stdout.write(c[0].name+"|"+c[0].region); else {console.error("Could not uniquely detect the AcademicOS Cloud Run service. Set CLOUD_RUN_SERVICE_NAME and CLOUD_RUN_REGION. Candidates: "+rows.map(x=>x.name+"@"+x.region).join(", "));process.exit(2)}});')" || exit $?
  SERVICE_NAME="${SERVICE_NAME:-${DETECTED%%|*}}"
  REGION="${REGION:-${DETECTED#*|}}"
fi

IDENTITY="$(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format='value(spec.template.spec.serviceAccountName)')"
if [[ -z "$IDENTITY" ]]; then
  PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
  IDENTITY="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
fi

echo "Repairing the live service WITHOUT replacing its identity"
echo "  service:  $SERVICE_NAME"
echo "  region:   $REGION"
echo "  identity: $IDENTITY"
RUNTIME_SERVICE_ACCOUNT="$IDENTITY" FIREBASE_PROJECT_ID="$PROJECT_ID" \
  "$ROOT_DIR/scripts/configure-firebase-runtime-iam.sh"

echo "Done. IAM changes apply to the existing Cloud Run revision; no new service account was created."

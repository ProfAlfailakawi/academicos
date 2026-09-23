#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/firebase-applet-config.json"
command -v gcloud >/dev/null 2>&1 || { echo "gcloud is required" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 1; }
read_config(){ node -e "const c=require(process.argv[1]);const v=c[process.argv[2]];if(v!=null)process.stdout.write(String(v));" "$CONFIG_FILE" "$1"; }
FIREBASE_PROJECT_ID="${TARGET_FIREBASE_PROJECT_ID:-$(read_config projectId)}"
FIRESTORE_DATABASE_ID="${TARGET_FIRESTORE_DATABASE_ID:-$(read_config firestoreDatabaseId)}"
FIREBASE_STORAGE_BUCKET="${TARGET_FIREBASE_STORAGE_BUCKET:-$(read_config storageBucket)}"
PROJECT_ID="${CLOUD_RUN_PROJECT_ID:-$FIREBASE_PROJECT_ID}"
SERVICE_NAME="${CLOUD_RUN_SERVICE_NAME:-}"
REGION="${CLOUD_RUN_REGION:-}"
[[ "$PROJECT_ID" == "$FIREBASE_PROJECT_ID" || "${ALLOW_CROSS_PROJECT_FIREBASE:-false}" == "true" ]] || { echo "Refusing cross-project deployment" >&2; exit 1; }

# Never invent a second Cloud Run service. Reuse the existing AI Studio service when possible.
if [[ -z "$SERVICE_NAME" || -z "$REGION" ]]; then
  SERVICES_JSON="$(gcloud run services list --project "$PROJECT_ID" --platform managed --format=json)"
  DETECTED="$(printf '%s' "$SERVICES_JSON" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s||"[]");const rows=a.map(x=>({name:x?.metadata?.name||"",region:x?.metadata?.labels?.["cloud.googleapis.com/location"]||x?.metadata?.labels?.["run.googleapis.com/region"]||"",managed:String(x?.metadata?.labels?.["managed-by"]||"")})).filter(x=>x.name&&x.region);let c=rows.filter(x=>/google-ai-studio/i.test(x.managed));if(c.length!==1)c=rows.filter(x=>/academicos/i.test(x.name));if(c.length!==1&&rows.length===1)c=rows;if(c.length===1)process.stdout.write(c[0].name+"|"+c[0].region);else{console.error("Set CLOUD_RUN_SERVICE_NAME and CLOUD_RUN_REGION; refusing to create a surprise service. Candidates: "+rows.map(x=>x.name+"@"+x.region).join(", "));process.exit(2)}});')" || exit $?
  SERVICE_NAME="${SERVICE_NAME:-${DETECTED%%|*}}"; REGION="${REGION:-${DETECTED#*|}}"
fi

FIREBASE_API_KEY="$(read_config apiKey)"; FIREBASE_AUTH_DOMAIN="$(read_config authDomain)"; FIREBASE_MESSAGING_SENDER_ID="$(read_config messagingSenderId)"; FIREBASE_APP_ID="$(read_config appId)"

# Optional AI provider: forwarded only when GEMINI_API_KEY is provided by the caller,
# so a Firebase-only deploy is unchanged. Without it the service runs the offline
# deterministic compiler (aiConfigured=false).
AI_ENV_VARS=""
if [[ -n "${GEMINI_API_KEY:-}" ]]; then
  AI_ENV_VARS=",AI_PROVIDER=gemini,GEMINI_API_KEY=${GEMINI_API_KEY},GEMINI_MODEL=${GEMINI_MODEL:-gemini-2.5-flash},GEMINI_MODEL_FAST=${GEMINI_MODEL_FAST:-gemini-2.5-flash-lite},GEMINI_MODEL_STRONG=${GEMINI_MODEL_STRONG:-gemini-2.5-flash}"
  echo "AI provider: Gemini will be configured on this deploy."
fi

# `gcloud run deploy --source` يبني عبر Cloud Build منتحلاً حساب الحوسبة
# الافتراضي. في المشاريع المنشأة بعد تغيير Google لحساب البناء الافتراضي، هذا
# الحساب يأتي بلا أدوار، فيفشل الرفع بـ "could not resolve source:
# permission_denied" — رسالة تبدو كأنها مشكلة في حسابك أنت لا في حساب الخدمة.
# roles/cloudbuild.builds.builder هو الدور الذي توثّقه Google لهذا الغرض.
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
BUILD_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "Granting Cloud Build role to $BUILD_SA (idempotent)…"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${BUILD_SA}" \
  --role=roles/cloudbuild.builds.builder \
  --condition=None --quiet >/dev/null || {
    echo "⚠ تعذّر منح الدور. إن فشل النشر بخطأ صلاحيات، امنحه يدوياً:" >&2
    echo "  gcloud projects add-iam-policy-binding $PROJECT_ID \\" >&2
    echo "    --member=serviceAccount:${BUILD_SA} \\" >&2
    echo "    --role=roles/cloudbuild.builds.builder" >&2
  }

echo "Deploying to EXISTING Cloud Run service: $SERVICE_NAME ($REGION)"
# Preserve the service identity already managed by AI Studio/Cloud Run; do not override it.
# الخدمة أُنشئت أول مرة بصورة أساس (buildpacks)، والبناء الآن من Dockerfile؛ فيرفض gcloud
# النشر ما لم تُمسح صورة الأساس صراحةً. المسح لا يؤثر إن لم تكن مضبوطة.
gcloud run deploy "$SERVICE_NAME" --source "$ROOT_DIR" --project "$PROJECT_ID" --region "$REGION" --allow-unauthenticated --clear-base-image \
  --update-env-vars "FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID,FIREBASE_FIRESTORE_DATABASE_ID=$FIRESTORE_DATABASE_ID,FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET,VITE_FIREBASE_API_KEY=$FIREBASE_API_KEY,VITE_FIREBASE_AUTH_DOMAIN=$FIREBASE_AUTH_DOMAIN,VITE_FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID,VITE_FIREBASE_STORAGE_BUCKET=$FIREBASE_STORAGE_BUCKET,VITE_FIREBASE_MESSAGING_SENDER_ID=$FIREBASE_MESSAGING_SENDER_ID,VITE_FIREBASE_APP_ID=$FIREBASE_APP_ID,CHECK_REVOKED_ID_TOKENS=true${AI_ENV_VARS}" --quiet

# لا يُسقط بقيةَ النشر: مرّتين حتى الآن فشلت خطوة صلاحيات وسط السكربت، فتوقّف
# قبل ضبط APP_URL و ALLOWED_ORIGINS وترك الخدمة قائمة لكن مُعدّة خطأً — وطبع
# رابطاً كأنه انتهى. الفشل هنا يُعلَن بصوت عالٍ ويُستكمل الإعداد.
IAM_REPAIR_OK=yes
CLOUD_RUN_SERVICE_NAME="$SERVICE_NAME" CLOUD_RUN_REGION="$REGION" CLOUD_RUN_PROJECT_ID="$PROJECT_ID" FIREBASE_PROJECT_ID="$FIREBASE_PROJECT_ID" \
  bash "$ROOT_DIR/scripts/repair-cloud-run-firebase-access.sh" || IAM_REPAIR_OK=no
SERVICE_JSON="$(gcloud run services describe "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --format=json)"
URL="$(printf '%s' "$SERVICE_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s)?.status?.url||""))')"
# APP_URL الموجود يُحترم: بعد ربط نطاق خاص يضبطه المالك مرة واحدة، ولو أعدنا كتابته
# برابط run.app في كل نشر لانكسر CORS للنطاق وذهبت روابط الدفع والـwebhook للرابط القديم.
EXISTING_APP_URL="$(printf '%s' "$SERVICE_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const env=JSON.parse(s)?.spec?.template?.spec?.containers?.[0]?.env||[];process.stdout.write(String(env.find(e=>e.name==="APP_URL")?.value||""))})')"
if [[ -z "$EXISTING_APP_URL" || "$EXISTING_APP_URL" == *".run.app"* ]]; then
  gcloud run services update "$SERVICE_NAME" --project "$PROJECT_ID" --region "$REGION" --update-env-vars "APP_URL=$URL,ALLOWED_ORIGINS=$URL" --quiet >/dev/null
else
  echo "APP_URL مضبوط على نطاق خاص ($EXISTING_APP_URL) — يُترك كما هو."
  URL="$EXISTING_APP_URL"
fi
printf '\nService: %s\nURL: %s\nFirestore: %s\n' "$SERVICE_NAME" "$URL" "$FIRESTORE_DATABASE_ID"
if [[ "$IAM_REPAIR_OK" != yes ]]; then
  # فشل إعادة المنح لا يعني أن الوصول مفقود: حساب النشر قد لا يملك تعديل سياسة
  # مشروع Firebase، والمنح قائم من إعدادٍ سابق. الحَكَم هو الخدمة نفسها.
  LIVE_URL="$(printf '%s' "$SERVICE_JSON" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s)?.status?.url||""))')"
  PROBE=""
  for attempt in 1 2 3 4 5 6; do
    PROBE="$(curl -s --max-time 20 "$LIVE_URL/api/health/firestore" || true)"
    [[ "$PROBE" == *'"ok":true'* ]] && break
    sleep 10
  done
  if [[ "$PROBE" == *'"ok":true'* ]]; then
    printf '\n⚠ لم يُعِد النشر منح صلاحيات Firebase (حساب النشر لا يملك ذلك على %s)،\n' "$FIREBASE_PROJECT_ID"
    printf '  لكن الخدمة تصل إلى Firestore فعلًا، فالمنح قائم. لا شيء مطلوب.\n'
  else
    printf '\n✗ الخدمة منشورة لكنها لا تصل إلى Firestore (%s).\n' "${PROBE:-no response}"
    printf '  نفّذ مرة واحدة من Cloud Shell بحسابك أنت (مالك المشروعين):\n'
    printf '  CLOUD_RUN_PROJECT_ID=%s CLOUD_RUN_SERVICE_NAME=%s CLOUD_RUN_REGION=%s FIREBASE_PROJECT_ID=%s bash scripts/repair-cloud-run-firebase-access.sh\n' \
      "$PROJECT_ID" "$SERVICE_NAME" "$REGION" "$FIREBASE_PROJECT_ID"
    exit 1
  fi
fi

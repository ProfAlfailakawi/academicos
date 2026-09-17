# نشر AcademicOS — إعدادٌ لمرة واحدة

المستودع يحمل سكربت نشر مكتملًا (`scripts/deploy-cloud-run.sh`)، لكنه كان يُشغَّل
باليد. فكل ما يُدمج في `main` يبقى في GitHub ولا يصل إلى الخدمة — ومنه البيئة
التجريبية.

`.github/workflows/deploy-cloud-run.yml` يُشغّل السكربت نفسه عند كل دفع إلى
`main`، بعد اجتياز الفحوص. ويحتاج مرة واحدة إلى هوية نشرٍ بلا مفتاح دائم.

**الهدف:** الخدمة `academicos-app` في المشروع `tebyan-clean-2026-5f13b` بمنطقة
`europe-west2` — مأخوذ من رابط الخدمة الحيّ
`academicos-app-522016905178.europe-west2.run.app`.

> مشروع `academicos-3991f` هو مشروع Firebase، لا موضع الخدمة. وفيه خدمةٌ باسم
> `academicos` — ليست هي التي يفتحها الناس، والنشر عليها لا يغيّر شيئًا.

## الخطوات — من Google Cloud Shell

```sh
set -euo pipefail

PROJECT=tebyan-clean-2026-5f13b
POOL=github
NAME=academicos
SA=academicos-deployer
REPO=ProfAlfailakawi/academicos

gcloud config set project "$PROJECT"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"

# ١. حساب خدمة للنشر — يُسأل عنه ثم يُنشأ، ولا يُبتلع خطأٌ غير «غير موجود»
gcloud iam service-accounts describe "$SA@$PROJECT.iam.gserviceaccount.com" >/dev/null 2>&1 \
  || gcloud iam service-accounts create "$SA"

for ROLE in roles/run.admin \
            roles/cloudbuild.builds.editor \
            roles/artifactregistry.admin \
            roles/storage.admin \
            roles/iam.serviceAccountUser \
            roles/resourcemanager.projectIamAdmin; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member "serviceAccount:$SA@$PROJECT.iam.gserviceaccount.com" \
    --role "$ROLE" --condition=None >/dev/null
done

# ٢. المجمّع — قد يكون منشأً من قبل في هذا المشروع
gcloud iam workload-identity-pools describe "$POOL" --location global >/dev/null 2>&1 \
  || gcloud iam workload-identity-pools create "$POOL" --location global

# ٣. المزوّد — مقيَّد بهذا المستودع وحده
gcloud iam workload-identity-pools providers describe "$NAME" \
  --location global --workload-identity-pool "$POOL" >/dev/null 2>&1 \
  || gcloud iam workload-identity-pools providers create-oidc "$NAME" \
       --location global --workload-identity-pool "$POOL" \
       --issuer-uri "https://token.actions.githubusercontent.com" \
       --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository" \
       --attribute-condition "assertion.repository=='$REPO'"

# ٤. حقّ المستودع في انتحال حساب النشر
gcloud iam service-accounts add-iam-policy-binding \
  "$SA@$PROJECT.iam.gserviceaccount.com" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/$REPO" >/dev/null

# ٥. التحقق قبل الطباعة — لا تُعطى قيمةٌ لا يقابلها مزوّدٌ فعّال.
#    هذا ما كان ناقصًا: طُبعت القيمتان مرةً بينما المزوّد لم يُنشأ، فاجتاز
#    الورك-فلو فحصَ الإعداد ثم سقط عند المصادقة بـ`invalid_target`.
STATE="$(gcloud iam workload-identity-pools providers describe "$NAME" \
           --location global --workload-identity-pool "$POOL" --format='value(state)')"
if [ "$STATE" != "ACTIVE" ]; then
  echo "المزوّد غير فعّال (state=$STATE) — لا تضع المتغيّرات بعد." >&2
  exit 1
fi

echo
echo "تمّ. ضع هذين في إعدادات المستودع:"
echo "GCP_WORKLOAD_IDENTITY_PROVIDER = projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/providers/$NAME"
echo "GCP_DEPLOY_SERVICE_ACCOUNT     = $SA@$PROJECT.iam.gserviceaccount.com"
```

### عن `roles/resourcemanager.projectIamAdmin`

السكربت يمنح حسابَ البناء دورَ `cloudbuild.builds.builder` ويصلح صلاحيات وصول
Firebase بعد النشر — وكلاهما يحتاج تعديل سياسة المشروع. وبدونه يمضي النشر لكن
يشكو، وقد لا يعمل تسجيل الدخول.

وإن لم ترغب في منح هذا الدور لحساب النشر، فالبديل أن تُجري الربطَين مرة واحدة
بنفسك من Cloud Shell ثم تحذف الدور من القائمة أعلاه:

```sh
PROJECT_NUMBER="$(gcloud projects describe tebyan-clean-2026-5f13b --format='value(projectNumber)')"
gcloud projects add-iam-policy-binding tebyan-clean-2026-5f13b \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role=roles/cloudbuild.builds.builder --condition=None
bash scripts/repair-cloud-run-firebase-access.sh
```

## ثم في GitHub

Settings → Secrets and variables → Actions → **Variables** (لا Secrets):

| المتغيّر | القيمة |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | السطر المطبوع أعلاه |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | `academicos-deployer@tebyan-clean-2026-5f13b.iam.gserviceaccount.com` |

`--attribute-condition` يقصر الاتحاد على هذا المستودع وحده، ولا يُحفظ مفتاح دائم
في GitHub.

## ما يحرسه الورك-فلو

* **لا نشر فوق فحصٍ أحمر**: `audit:launch` و`typecheck` و`build` و`test:ci` قبل
  النشر، بنفس ترتيب ورك-فلو التحقق.
* **لا خدمة مفاجئة**: الاسم والمنطقة يُمرَّران صراحةً، فلا يُنشأ اسمٌ جديد لو نمت
  في المشروع خدمةٌ ثانية لاحقًا.
* **الخدمة تردّ بعد النشر**: يُطلب جذرها ويُتحقَّق من الاستجابة. نشرٌ ينتهي بخدمةٍ
  صامتة ليس نشرًا ناجحًا وإن قال `gcloud` إنه تمّ.

## للتجربة قبل الاعتماد

الورك-فلو يقبل `workflow_dispatch`: شغّله يدويًا من تبويب Actions بعد ضبط
المتغيّرين، وراقب النتيجة قبل أن تعتمد على النشر التلقائي.

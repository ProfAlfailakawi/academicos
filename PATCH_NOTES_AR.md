# AcademicOS — Firebase Runtime IAM Root Fix v3

هذه الحزمة **Patch تراكمي فقط** وليست المشروع كاملًا. يمكن تطبيقها مباشرة فوق النسخة الأصلية `academicos(4)` أو فوق v1/v2. لم يتم نشر أو رفع أي شيء إلى Firebase أو Cloud Run أو GitHub.

## التشخيص الصحيح للرسالة الحالية

الرسالة العربية:

`حساب خدمة Firebase لا يملك الصلاحيات اللازمة للوصول إلى المورد المطلوب.`

جاءت من الخطأ gRPC رقم **7 = PERMISSION_DENIED** داخل عمليات Firestore، وليس من تسجيل دخول الطالب/المعلم نفسه. لذلك تغيير Firestore Rules أو تفعيل مزودات Authentication داخل Firebase Console لا يحلها؛ Firebase Admin SDK على الخادم يصل إلى Firestore بهوية حساب خدمة ويُحكَم بواسطة **Google Cloud IAM**.

كان في المشروع سببان يسمحان بظهور هذا العطل على جميع الأدوار:

1. سكربت Cloud Run كان يختار تلقائيًا مشروع `gcloud` الحالي، حتى لو كان مختلفًا عن مشروع Firebase الحقيقي `academicos-3991f`.
2. Cloud Run لم يكن يثبت هوية تشغيل مخصصة ولا يمنحها أدوار Firestore/Auth/App Check/Storage اللازمة. وإذا بقي `FIREBASE_SERVICE_ACCOUNT` قديمًا على الخدمة، كان يمكن أن يتغلب على هوية Cloud Run الصحيحة ويعيد نفس خطأ الصلاحيات.

## الإصلاح الجذري في v3

- Cloud Run أصبح افتراضيًا مربوطًا بمشروع Firebase الموجود في `firebase-applet-config.json`، وليس بالمشروع الحالي في gcloud.
- يمنع النشر عبر مشروعين مختلفين افتراضيًا؛ لا يُسمح بذلك إلا بتفعيل `ALLOW_CROSS_PROJECT_FIREBASE=true` عمدًا.
- أضيف حساب تشغيل مخصص افتراضيًا:
  `academicos-runtime@<firebase-project>.iam.gserviceaccount.com`
- أضيف سكربت IAM آمن ومتكرر التنفيذ `scripts/configure-firebase-runtime-iam.sh` ينشئ الهوية عند الحاجة ويمنح فقط أدوار التشغيل المطلوبة:
  - `roles/datastore.user`
  - `roles/firebaseauth.admin`
  - `roles/firebaseappcheck.tokenVerifier`
  - `roles/storage.objectUser`
  - `roles/serviceusage.serviceUsageConsumer`
  - `roles/iam.serviceAccountTokenCreator` على حساب التشغيل نفسه فقط
- سكربت النشر يشغّل إعداد IAM تلقائيًا ثم ينشر Cloud Run باستخدام `--service-account` الصريح.
- سكربت النشر يزيل `FIREBASE_SERVICE_ACCOUNT` القديم من Cloud Run إن وُجد، حتى يستخدم Firebase Admin **Application Default Credentials** لهوية التشغيل المرفقة بدل JSON قديم/خاطئ.
- يحقن مشروع Firebase وقاعدة Firestore المسماة وStorage bucket وقيم Firebase Web العامة الصحيحة في Cloud Run حتى لا يبقى اختلاف بين العميل والخادم.
- الخادم يرفض مبكرًا أي Service Account JSON تابع لمشروع آخر (`FIREBASE_CREDENTIAL_PROJECT_MISMATCH`) بدل أن يصل المستخدم لاحقًا إلى خطأ غامض رقم 7.
- إذا كانت بيئة Google نفسها تشير إلى مشروع مختلف، يظهر `FIREBASE_RUNTIME_PROJECT_MISMATCH` بدل محاولة التشغيل بصمت.
- خطأ Firestore رقم 7 أصبح يُعاد كـ `FIRESTORE_IAM_PERMISSION_DENIED` مع project/database المستهدفين للتشخيص، بدل رسالة عامة.
- كل إصلاحات v1/v2 محفوظة: قاعدة Firestore المسماة، Storage bucket، التحقق الحقيقي من ID token، refresh retry، تطبيع الأدوار، MFA enrollment/challenge، وعدم جعل MFA حاجزًا لكل صفحات الإدارة.

## طريقة الدمج

فك ZIP فوق جذر المشروع واستبدل الملفات الموجودة. الحزمة تراكميّة لذلك لا تحتاج أن تطبق v1 أو v2 أولًا.

عند النشر بالطريقة المرفقة، الأمر `npm run deploy:cloudrun` سيضبط هوية Cloud Run وIAM تلقائيًا قبل النشر. هذا السكربت يحتاج أن يكون حساب gcloud الذي ينفذه مخولًا بإدارة IAM وإنشاء/ربط Service Accounts.

## التحقق المحلي

- Release security/static audit: **32/32 PASS**
- Global UI audit: **24/24 PASS**
- TypeScript syntax diagnostics للملفات المعدلة في v3: **0**
- `bash -n` لسكريبتَي IAM وCloud Run: **PASS**

لم يتم تنفيذ أوامر gcloud ولم يتم تغيير أي مورد فعلي في حسابك؛ التزامًا بطلب عدم رفع أو نشر أي شيء.

# تشغيل AcademicOS للتجربة — دليل تفصيلي كامل

> آخر تحديث: 2026-09-03 · هذا الدليل مخصّص لموقعك المنشور فعليًا على:
> **https://academicos-app-522016905178.europe-west2.run.app**

---

## 0) الخلاصة في سطرين

فحصتُ موقعك المنشور مباشرةً. **Firebase وتسجيل الدخول يعملان الآن فعليًا** (تأكدتُ أن مفتاح الويب صالح وأن تسجيل الدخول بالبريد/كلمة المرور مُفعّل على مشروع `academicos-3991f`). الشيء **الوحيد** الناقص لتجربة احترافية كاملة هو **مزوّد الذكاء الاصطناعي** — بدونه، كتابة المشاريع تنزل تلقائيًا إلى "الهيكل المحلي" بدل الكتابة الحقيقية.

إذًا خطوتك الوحيدة الجوهرية: **احصل على مفتاح Gemini مجاني، واربطه بالخدمة بأمر واحد.** الباقي كله يعمل.

---

## 1) الوضع الحالي للموقع (مؤكَّد من الفحص المباشر)

| المكوّن | الحالة | المصدر |
|---|---|---|
| تسجيل الدخول / إنشاء حساب (Firebase Auth) | ✅ يعمل | فحص مباشر: `INVALID_LOGIN_CREDENTIALS` = المفتاح صالح والمصادقة مُفعّلة |
| Firebase Admin على الخادم | ✅ يعمل | `/api/health` → `firebase: true`, project `academicos-3991f` |
| قاعدة Firestore | ✅ موجودة | `firestoreDatabase: ai-studio-academicos-…` |
| تخزين الملفات (Storage) | ✅ مهيأ | `/api/health` → `storageConfigured: true` |
| **الذكاء الاصطناعي** | ❌ **غير مهيأ** | `/api/health` → `aiConfigured: false` ← **هذا هو الناقص** |
| الدفع (Billing) | ⚪ معطّل | مقبول تمامًا للتجربة |
| App Check / فرض MFA | ⚪ غير مُفعّل | مقبول للتجربة؛ فعّلهما قبل الإطلاق العام |

معلومات نشرك الثابتة (ستحتاجها في الأوامر):
- **اسم الخدمة (service):** `academicos-app`
- **المنطقة (region):** `europe-west2`
- **رقم مشروع Cloud Run:** `522016905178`
- **مشروع Firebase:** `academicos-3991f`

---

## 2) المزوّد المجاني الاحترافي المُوصى به: Google Gemini (AI Studio)

**لماذا هذا بالذات؟**
- **مجاني فعلاً** — طبقة مجانية سخية بدون بطاقة ائتمان.
- **احترافي** — نماذج Google الحديثة، وهي المزوّد **الأساسي المدمج** في AcademicOS أصلًا (`AI_PROVIDER=gemini`).
- **نفس حساب Google** الذي يملك مشروع Firebase — صفر احتكاك.
- يدعم **المخرجات المنظّمة (JSON Schema)** التي يحتاجها المنتج تحديدًا.

**حدود الطبقة المجانية (تكفي التجربة بسهولة):** نموذج `gemini-2.5-flash` ≈ 10 طلبات/دقيقة، ~250 ألف رمز/دقيقة، 1500 طلب/يوم — إدخال وإخراج مجاني.
> ملاحظة: الطبقة المجانية قد تَستخدم مدخلاتك لتحسين النماذج. للبيانات الحساسة، رقِّ لاحقًا للطبقة المدفوعة أو Vertex AI (نفس الكود، فقط تضيف بطاقة).

**النماذج التي سنضبطها (كلها ضمن المجاني):**
| المتغيّر | القيمة | متى يُستخدم |
|---|---|---|
| `GEMINI_MODEL` | `gemini-2.5-flash` | كل المهام (الافتراضي) |
| `GEMINI_MODEL_FAST` | `gemini-2.5-flash-lite` | المهام البسيطة (أسرع/حدود أعلى) |
| `GEMINI_MODEL_STRONG` | `gemini-2.5-flash` | المهام الصعبة (أبقيناه Flash ليبقى مجانيًا 100%) |

---

## 3) الحصول على مفتاح Gemini المجاني (٤ نقرات)

1. افتح: **https://aistudio.google.com/apikey**
2. سجّل الدخول بنفس حساب Google الذي يملك مشروع Firebase.
3. اضغط **"Create API key"** (أنشئ مفتاح API).
4. اختر مشروع Google Cloud — يُفضّل نفس مشروع `academicos-3991f` — ثم **انسخ المفتاح** (يبدأ بـ `AIza…`).

> المفتاح سرّي. لا تضعه في أي ملف داخل المستودع ولا ترفعه على GitHub. سنمرّره كمتغيّر بيئة فقط.

---

## 4) ربط المفتاح بالخدمة — الطريقة (أ): أمر واحد (الأسهل)

هذا هو **"اعمل كل شي"** — أضفتُ لك سكربت جاهز يضبط المزوّد على الخدمة المنشورة **بدون إعادة نشر الكود وبدون المساس بهوية الخدمة**.

المتطلّب الوحيد: أن يكون `gcloud` مثبّتًا ومسجّلًا دخولك:
```bash
gcloud auth login
gcloud config set project 522016905178
```

ثم من داخل مجلد المشروع، نفّذ (ضع مفتاحك مكان `AIza...`):
```bash
GEMINI_API_KEY=AIza... npm run ai:configure
```

هذا يشغّل `scripts/set-ai-provider.sh` الذي:
- يستهدف الخدمة `academicos-app` في `europe-west2` تلقائيًا (قابلة للتعديل عبر متغيّرات).
- يضبط `AI_PROVIDER=gemini` + المفتاح + النماذج الثلاثة.
- يستخدم `--update-env-vars` فيُبقي كل إعدادات Firebase الأخرى كما هي.

في نهايته يطبع لك أمر التحقق. المفروض بعد ثوانٍ تصير `aiConfigured: true`.

### الطريقة (ب): أمر gcloud يدوي (لو ما تبي السكربت)
```bash
gcloud run services update academicos-app \
  --project 522016905178 \
  --region europe-west2 \
  --update-env-vars "AI_PROVIDER=gemini,GEMINI_API_KEY=AIza...,GEMINI_MODEL=gemini-2.5-flash,GEMINI_MODEL_FAST=gemini-2.5-flash-lite,GEMINI_MODEL_STRONG=gemini-2.5-flash"
```

### الطريقة (ج): من واجهة Cloud Run (بدون سطر أوامر إطلاقًا)
1. افتح **console.cloud.google.com/run** → اختر مشروع الرقم `522016905178`.
2. اضغط الخدمة **academicos-app** → **Edit & deploy new revision**.
3. بويّب **Variables & Secrets** → **Add variable**، وأضف هذه الخمسة:
   | Name | Value |
   |---|---|
   | `AI_PROVIDER` | `gemini` |
   | `GEMINI_API_KEY` | `AIza...` (مفتاحك) |
   | `GEMINI_MODEL` | `gemini-2.5-flash` |
   | `GEMINI_MODEL_FAST` | `gemini-2.5-flash-lite` |
   | `GEMINI_MODEL_STRONG` | `gemini-2.5-flash` |
4. **Deploy**. (لا تغيّر الـ Container image ولا الـ Service account.)

> للأمان الإنتاجي لاحقًا: بدل وضع المفتاح كمتغيّر مكشوف، خزّنه في **Secret Manager** واربطه عبر **Add secret reference** بدل Add variable.

---

## 5) التحقق أن الذكاء الاصطناعي اشتغل

```bash
curl -s https://academicos-app-522016905178.europe-west2.run.app/api/health | grep -o '"aiConfigured":[a-z]*'
```
المطلوب: `"aiConfigured":true`. لو ظهرت `false`، انتظر دقيقة (النشر يحتاج وقتًا) ثم أعد المحاولة، وتأكد أنك على الخدمة والمنطقة الصحيحة.

---

## 6) إنشاء أول حساب وترقيته لمالك المنصة

1. افتح الموقع → **Create a new student account** → أنشئ حسابك (يُنشأ كطالب فقط — هذا مقصود أمنيًا).
2. لترقية نفسك إلى **مالك (root_owner)**، شغّل محليًا (يحتاج صلاحية إدارية على مشروع Firebase عبر ADC):
```bash
gcloud auth application-default login
ROOT_OWNER_EMAIL="بريدك@مثال.com" npm run bootstrap:root
```
   هذا يضبط صلاحيات `root_owner` في Firebase Auth و Firestore. **سجّل خروجًا ثم دخولًا** لتحديث التوكن.

> ملاحظة أمنية مهمة: البريد وحده لا يرفع الصلاحية أبدًا — الترقية تتم فقط عبر هذا السكربت من بيئة موثوقة، أو عبر إدارة المستخدمين لاحقًا. هذا سلوك مقصود.

---

## 7) التجربة الكاملة (٥ دقائق) — جرّبها بنفسك

بعد ضبط الذكاء الاصطناعي:
1. **ارفع تكليفًا**: من `/app/upload` الصق نص تكليف (أو ارفع ملف). اختر اللغة والصفحات ووضع المساعدة.
2. **ولّد المشروع**: افتح المشروع → استوديو الكتابة → ولّد. المفروض الآن نص حقيقي منظّم (مو هيكل).
3. **جرّب التعريب**: بدّل لغة الواجهة إلى الإنجليزية وأعد التوليد — كل النصوص المُولّدة (الأقسام، أسئلة المناقشة، فحص التسليم) يجب أن تظهر بالإنجليزية. (هذا ما أصلحتُه في هذه الجلسة.)
4. **صدّر**: جرّب تصدير العرض التقديمي و الرسم البياني — يجب أن تظهر الخطوط العربية/غير اللاتينية صحيحة.
5. **افحص التسليم**: شغّل Submission Audit و Project X-Ray وتأكد أن الرسائل بلغتك.

إن ظهرت `AI_RATE_LIMIT` أثناء ضغط الاستخدام، فهذا حدّ الطبقة المجانية (10 طلبات/دقيقة) — انتظر قليلًا أو رقِّ للطبقة المدفوعة.

---

## 8) اختياري — لاحقًا قبل الإطلاق العام (ليس ضروريًا للتجربة)

- **الدفع (Lemon Squeezy):** املأ `LEMONSQUEEZY_*` (الشرح كامل في `.env.example`) واضبط الويبهوك على `/api/billing/webhook/lemonsqueezy` بحدثين: `order_created` و `order_refunded`.
- **App Check:** أنشئ مفتاح reCAPTCHA Enterprise، اضبط `VITE_FIREBASE_APPCHECK_SITE_KEY` و `REQUIRE_APP_CHECK=true`.
- **MFA للأدوار الحساسة:** `REQUIRE_ADMIN_MFA=true`.
- **قواعد الأمان:** انشر `firestore.rules` و `storage.rules` و `firestore.indexes.json`.
- **فحص الجاهزية الشامل:** `npm run verify:production` (يرفض الإطلاق لو أي شيء ناقص).

---

## المرجع السريع — كل المتغيّرات

| المتغيّر | للتجربة | القيمة |
|---|---|---|
| `AI_PROVIDER` | ✅ مطلوب | `gemini` |
| `GEMINI_API_KEY` | ✅ مطلوب | مفتاحك من AI Studio |
| `GEMINI_MODEL` | ✅ مطلوب | `gemini-2.5-flash` |
| `GEMINI_MODEL_FAST` | مُستحسن | `gemini-2.5-flash-lite` |
| `GEMINI_MODEL_STRONG` | مُستحسن | `gemini-2.5-flash` |
| Firebase (كل `VITE_FIREBASE_*`) | ✅ يعمل مسبقًا | من `firebase-applet-config.json` |
| `LEMONSQUEEZY_*` | لاحقًا | للدفع فقط |

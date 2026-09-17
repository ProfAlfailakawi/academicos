# AcademicOS — دليل الربط

الكود جاهز والاختبارات خضراء. ما يفصلك عن الإطلاق **إعدادات ومفاتيح**، لا برمجة.

```bash
npm run verify:production    # ما ينقص للإنتاج
npm run verify:launch-gates  # بوابات الإطلاق السبع
```

---

## الخطوة ١ — الأسرار المولَّدة (دقيقتان)

```bash
npm run secrets:generate >> .env
```

يولّد أسرار التنويع وإساءة الاستخدام، **وزوج مفاتيح Ed25519** لتوقيع كبسولات
الأدلة — وهو الجزء الذي يصعب توليده يدوياً: المفتاح الخاص `base64` لنصّ PEM بصيغة
PKCS#8، والعام `base64url` لـSPKI DER. السكربت يولّدهما ثم **يوقّع رسالة ويتحقق
منها فعلياً** قبل أن يطبع، فلا تكتشف خطأ الترميز عند أول كبسولة في الإنتاج.

⚠ لا تغيّر مفتاح التوقيع بعد الإطلاق دون إبقاء العام القديم في
`EVIDENCE_CAPSULE_TRUSTED_PUBLIC_KEYS`، وإلا بدت كل كبسولة وُقّعت سابقاً
«موقَّعة من جهة غير موثوقة».

---

## الخطوة ٢ — Firebase (البوابة ١)

| القيمة | من أين |
|---|---|
| `VITE_FIREBASE_API_KEY` وأخواتها | Firebase Console → Project settings → Your apps |
| `VITE_FIREBASE_APPCHECK_SITE_KEY` | App Check → reCAPTCHA Enterprise → Site key |
| `FIREBASE_SERVICE_ACCOUNT` | Service accounts → Generate new private key (JSON) |
| `FIREBASE_PROJECT_ID` · `FIREBASE_STORAGE_BUCKET` | من نفس الصفحة |

ثم للإطلاق:

```
REQUIRE_APP_CHECK=true
REQUIRE_ADMIN_MFA=true
CHECK_REVOKED_ID_TOKENS=true
```

ارفع القواعد: `firestore.rules` و`storage.rules` و`firestore.indexes.json`.

حساب المالك الأول:

```bash
npm run bootstrap:root
```

---

## الخطوة ٣ — مزوّد الدفع (البوابة ٢)

اضبط `BILLING_PROVIDER` ثم مجموعته: **LemonSqueezy** (`LEMONSQUEEZY_*`) أو
**MyFatoorah** (`MYFATOORAH_*`) أو **Stripe** (`STRIPE_*`) أو **Tap** (`TAP_*`).

لكل منها سرّ webhook لا بد أن يطابق ما في لوحة المزوّد. وجّه الـwebhook إلى
نشرك، واختبر عملية شراء كاملة في وضع الاختبار قبل الإطلاق.

---

## الخطوة ٤ — مزوّد الذكاء الاصطناعي (البوابة ٣)

```
AI_PROVIDER=gemini
GEMINI_API_KEY=<من Google AI Studio>
GEMINI_MODEL=gemini-2.5-flash
```

أو بوابة موحَّدة عبر `*_GATEWAY_URL` + `*_GATEWAY_TOKEN`.

> **انتبه:** أسماء النماذج البديلة وتكاليفها لكل مزوّد **غير Gemini**
> (`OPENAI_MODEL_FAST`، `ANTHROPIC_*_COST_*` وأخواتها) **لا يقرأها أي كود اليوم**.
> ضبطها لا يغيّر شيئاً. القائمة كاملة في آخر `.env.example`.

---

## الخطوة ٥ — حدّ المعدّل (البوابة ٤)

الحدّ في الذاكرة: كل نسخة Cloud Run لها عدّادها، فالحدّ الفعلي = الحدّ × عدد النسخ.

`RATE_LIMIT_BACKEND=firestore` **لا يفعل شيئاً** — لا يوجد تنفيذ موزّع في الكود،
والبوابة تقول ذلك صراحةً بدل أن تدّعي نجاحاً. مخزن مشترك قرار بنية وتكلفة.

حتى تتخذه: اضبط عدد النسخ بما يجعل الحدّ الفعلي مقبولاً، أو أبقِ نسخة واحدة.

---

## الخطوة ٦ — تكاملات اختيارية (موصولة فعلاً)

هذه لها مسارات تستدعيها في `src/server/external-adapters.ts` — اضبط الرابط
والرمز وستعمل:

| التكامل | المتغيّرات |
|---|---|
| فحص الفيروسات | `VIRUS_SCAN_URL` + `VIRUS_SCAN_TOKEN` |
| عرض PDF | `PDF_RENDER_SERVICE_URL` + `_TOKEN` |
| النسخ الاحتياطي | `BACKUP_WORKER_URL` + `_TOKEN` |
| صندوق تنفيذ الكود | `CODE_SANDBOX_URL` + `_TOKEN` |
| الفهرسة الدلالية | `SEMANTIC_INDEX_URL` + `_TOKEN` |
| الترجمة | `TRANSLATION_SERVICE_URL` + `_TOKEN` |
| CRM | `CRM_WEBHOOK_URL` + `_TOKEN` |
| واتساب | `WHATSAPP_APP_SECRET` + `WHATSAPP_VERIFY_TOKEN` |

قبل رفع ملفات من الجمهور، فعّل `REQUIRE_VIRUS_SCAN=true` مع مزوّد مضبوط.

---

## الخطوة ٧ — CSP (يحتاج متصفحاً)

`unsafe-eval` مفعّلة افتراضياً لأن reCAPTCHA Enterprise — أساس App Check — قد
تحتاجها. لم يُتحقق من ذلك: وكيل الشبكة في بيئة التطوير يحجب `www.google.com`.

**جرّبها بنفسك:** انشر بـ`CSP_ALLOW_UNSAFE_EVAL=false`، افتح صفحة الدخول ووحدة
تحكّم المتصفح، وتأكد من غياب `EvalError` ومن نجاح تسجيل الدخول وطلبات الـAPI.
إن نجح فاجعلها دائمة — وإن فشل فستُرفض **كل** طلبات الـAPI ويتعطّل الموقع بالكامل.

---

## قبل الإطلاق

```bash
npm run verify:production    # لا موانع
npm run verify:launch-gates  # البوابات ١–٥ خضراء
npm run audit:launch         # 33/33 + 25/25
npm test                     # 103/103
```

ثم البوابتان ٦ و٧ — **وهما بيدك وحدك**: انشر على staging، ونفّذ سيناريوهات
`GO_LIVE_RUNBOOK.md` كاملة (طالب وأستاذ وأدمن، دفع بوضع الاختبار، رفع ملفات،
مناقشة Viva). لم يُفتح متصفح ولا لُمس حساب دفع حقيقي في أي تحقق حتى الآن.

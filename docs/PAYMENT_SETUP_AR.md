# دليل ربط الدفع — AcademicOS

الكود جاهز، ولم يبقَ إلا إدخال المفاتيح. الخادم يحدد السعر من `BILLING_PLANS` في `src/server/billing.ts`
(6.99 / 8.99 / 12.99 دولار). ينشئ الخادم صفحة الدفع المستضافة لدى المزوّد، ولا يفتح الباقة إلا **webhook موقَّع**
يتحقق منه الخادم (`persistVerifiedPayment` في `server.ts`، و`grantProjectEntitlement` في `src/server/platform-store.ts`).

## 0) متغيرات مشتركة (لكل المزوّدين)

| المتغير | القيمة |
|---|---|
| `BILLING_PROVIDER` | واحد من `tap` أو `myfatoorah` أو `lemonsqueezy` أو `stripe` (والقيمة الافتراضية `disabled`) |
| `APP_URL` | رابط الإنتاج بـ `https://` بلا شرطة مائلة في آخره. بدونه ترفض `/api/billing/checkout` الطلب في الإنتاج بالرمز `BILLING_APP_URL_INVALID`، وتُبنى منه روابط النجاح والإلغاء والـ webhook |
| `BILLING_LOCAL_CURRENCY` | عملة الخصم لدى Tap وMyFatoorah فقط (مثل `USD` أو `KWD`). أما Stripe وLemon Squeezy فيخصمان بالدولار دائمًا |
| `BILLING_LOCAL_UNITS_PER_USD` | سعر تحويل ثابت من الدولار إلى العملة المحلية (مثل `0.307` للدينار الكويتي). حدّثه يدويًا عند تغيّر السعر |
| `BILLING_REQUEST_TIMEOUT_MS` | اختياري (القيمة الافتراضية 15000) |

> ملاحظة: `scripts/deploy-cloud-run.sh` **لا ينقل متغيرات الدفع**. أضفها بنفسك بعد النشر:
> `gcloud run services update <SERVICE> --region <REGION> --update-env-vars BILLING_PROVIDER=tap,BILLING_LOCAL_CURRENCY=KWD,BILLING_LOCAL_UNITS_PER_USD=0.307 --update-secrets TAP_SECRET_KEY=tap-secret:latest`
> ويُفضَّل وضع المفاتيح السرية في Secret Manager.

## 1) Tap Payments (الخيار الافتراضي المقترح لمالك مقيم في الكويت)

| المتغير | من أين تحصل عليه |
|---|---|
| `TAP_SECRET_KEY` | لوحة Tap: ‏goSell / Dashboard ← Developers ← API Keys ← **Secret Key**. استخدم `sk_test_...` للتجربة و`sk_live_...` للإنتاج. يُستعمل المفتاح نفسه للتحقق من توقيع الـ webhook |
| `TAP_MERCHANT_ID` | لوحة Tap ← Account/Business ← **Merchant ID** |
| `TAP_SOURCE_ID` | اختياري. القيمة الافتراضية `src_all` تعرض كل الوسائل المفعّلة (KNET والبطاقات وApple Pay). مثال آخر: `src_kw.knet` |

- **الـ webhook:** لا تسجّله في اللوحة، لأن الخادم يرسله مع كل عملية دفع في الحقل `post.url`: `https://<APP_URL>/api/billing/webhook/tap`.
  يتحقق الخادم من الترويسة `hashstring` (HMAC-SHA256 بالمفتاح `TAP_SECRET_KEY`).
- **الحالات:** `CAPTURED` تفتح الباقة. `REFUNDED` أو أي حالة فيها CHARGEBACK/DISPUTE تسحبها. `FAILED`/`DECLINED`/`CANCELLED` تُسجَّل فشلًا.
- **التجربة:** ضع مفتاح `sk_test_`، ثم ادفع ببطاقة الاختبار التي تنشرها Tap في وثائقها (مثل 4508 7500 1574 1019، والتاريخ 01/39، وCVV ‏100)، أو استخدم KNET التجريبي.
- **تنبيه:** استرداد المبلغ في Tap ينشئ كائن Refund مستقلًا، وقد لا يعيد إرسال الـ charge بالحالة `REFUNDED`. لذلك تحقّق بعد أي استرداد من أن الاستحقاق سُحب، وإلا فاسحبه يدويًا.

## 2) MyFatoorah

| المتغير | من أين تحصل عليه |
|---|---|
| `MYFATOORAH_API_TOKEN` | بوابة MyFatoorah ← Integration Settings ← **API Key**. حساب التجربة يعطي مفتاحًا منفصلًا |
| `MYFATOORAH_PAYMENT_METHOD_ID` | رقم وسيلة الدفع (مثلًا 1 = KNET و2 = Visa/Master). تحصل عليه من نتيجة `InitiatePayment` أو من وثائق MyFatoorah |
| `MYFATOORAH_WEBHOOK_SECRET` | Integration Settings ← Webhook Settings ← فعّل **Webhook V2** وتوقيعه، ثم انسخ **Webhook Secret Key** |
| `MYFATOORAH_API_BASE_URL` | `https://apitest.myfatoorah.com` للتجربة، و`https://api.myfatoorah.com` للإنتاج (الكويت). لا يقبل الكود غير هذين العنوانين |
| `MYFATOORAH_LANGUAGE` | `EN` أو `AR` |

- **الـ webhook:** سجّل الرابط `https://<APP_URL>/api/billing/webhook/myfatoorah` في Webhook Settings، واشترك في الحدث **Payment Status Changed** (V2). الترويسة المطلوبة هي `MyFatoorah-Signature`.
- **مهم:** `InvoiceValue` يُحسب بعملة حسابك الأساسية. إذا كان حسابك كويتيًا فاضبط `BILLING_LOCAL_CURRENCY=KWD` و`BILLING_LOCAL_UNITS_PER_USD=0.307` تقريبًا، وإلا خُصم 6.99 **دينارًا** بدل 6.99 دولار.
- القيد: تختار كل عملية وسيلة دفع واحدة فقط (`MYFATOORAH_PAYMENT_METHOD_ID`).

## 3) Lemon Squeezy (تاجر مسجَّل Merchant of Record يتولى ضرائب المبيعات عالميًا)

| المتغير | من أين تحصل عليه |
|---|---|
| `LEMONSQUEEZY_API_KEY` | Settings ← API ← "+". يظهر المفتاح مرة واحدة فقط، ويوجد وضع Test mode منفصل |
| `LEMONSQUEEZY_STORE_ID` | Settings ← Stores ← الرقم الخاص بالمتجر |
| `LEMONSQUEEZY_VARIANT_ID` | أنشئ منتجًا بمتغير (variant) واحد، ثم انسخ رقم الـ variant. الخادم يستبدل سعره بـ `custom_price` |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Settings ← Webhooks ← "+": ضع الرابط `https://<APP_URL>/api/billing/webhook/lemonsqueezy` واكتب سرًّا من اختيارك، ثم ضع السر نفسه في هذا المتغير |

- **الأحداث:** `order_created` و`order_refunded`. الترويسة المطلوبة هي `X-Signature`.
- **التجربة:** فعّل Test mode وادفع ببطاقة `4242 4242 4242 4242`.

## 4) Stripe

| المتغير | من أين تحصل عليه |
|---|---|
| `STRIPE_SECRET_KEY` | Developers ← API keys ← Secret key (`sk_test_`/`sk_live_`) |
| `STRIPE_WEBHOOK_SECRET` | Developers ← Webhooks ← Add endpoint ← انسخ Signing secret (`whsec_...`) |

- **الرابط:** `https://<APP_URL>/api/billing/webhook/stripe`
- **الأحداث:** `checkout.session.completed` و`checkout.session.async_payment_succeeded` و`charge.refunded` و`charge.dispute.created` و`payment_intent.payment_failed`.
- **التجربة:** شغّل `stripe listen --forward-to localhost:3000/api/billing/webhook/stripe` وادفع ببطاقة 4242.
- **تنبيه:** Stripe لا يفتح حسابات تجارية لشركات مسجلة في الكويت (بحسب قائمة الدول المدعومة وقت كتابة الدليل، فتحقّق منها). لا يصلح إلا إذا كان لديك كيان في دولة مدعومة، كالإمارات.

## 5) أي مزوّد أختار؟

- **Tap:** أبسط خيار لمالك في الكويت. يدعم KNET والبطاقات الدولية وApple Pay، ويدفع إلى حساب بنكي كويتي، والكود مكتمل له. لكنك تتحمل بنفسك ضرائب المبيعات أو VAT للعملاء في الخارج.
- **Lemon Squeezy:** أفضل للبيع عالميًا من دون عبء ضريبي، لأنه التاجر المسجَّل. لكنه لا يدعم KNET، وتأكد أنه يقبل البائعين وطريقة الصرف في الكويت (غير مؤكد).
- **التوصية:** ابدأ بـ **Tap** بعملة `USD` (أو `KWD`)، وأبقِ Lemon Squeezy بديلًا إذا كبرت المبيعات الدولية.

## 6) التحقق

1. ضع المتغيرات، ثم شغّل `npm run verify:launch-gates` وتأكد أن **البوابة 2** تظهر `PASS`.
   السكربت يفحص الآن نفس المفاتيح التي يتطلبها الكود لكل مزوّد، فنتيجة `PASS` تعني أن الدفع مهيّأ فعلًا.
2. سجّل الدخول، ثم افتح `/app/plans`: يجب أن يظهر "متصل عبر <provider>". يمكنك أيضًا طلب `GET /api/billing/status` والتأكد من `configured: true`.
3. نفّذ عملية تجريبية كاملة، ثم تأكد من ثلاثة أشياء: وجود سجل في `transactions`، ووجود استحقاق `entitlements` حالته `active`، وأن `/api/projects/<id>/access` يعيد `unlocked: true`.
4. نفّذ استردادًا تجريبيًا، وتأكد أن حالة الاستحقاق صارت `revoked`.
5. غيّر المفاتيح إلى مفاتيح الإنتاج، واضبط `MYFATOORAH_API_BASE_URL` على عنوان الإنتاج، ثم نفّذ عملية حقيقية صغيرة واستردّها.

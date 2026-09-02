# AcademicOS — Firebase/Auth Root Fix v2

هذه الحزمة **Patch فقط** وليست المشروع كاملًا. لم يتم نشر أو رفع أي شيء إلى Firebase أو Cloud Run أو GitHub.

## سبب رسالة `Invalid or expired authentication token`

المشكلة الجديدة كانت في التحقق من Bearer token على الخادم بعد الإصلاح السابق: تم استخدام
`verifyIdToken(token, true)` لكل طلب API. قيمة `true` لا تتحقق من صحة JWT فقط؛ بل تضيف فحص revocation عبر Firebase Authentication backend. إذا كانت هوية تشغيل Cloud Run لا تملك صلاحية Auth الإضافية، أو كان فحص backend غير متاح، يُرمى استثناء وتظهر كل حسابات الطالب/المعلم/الأدمن وكأن token غير صالح رغم أن تسجيل الدخول نفسه نجح.

## الإصلاح الجذري في v2

1. كل token ما زال **ملزمًا بالتحقق الحقيقي من Firebase Admin SDK**: التوقيع، issuer، audience/project، ووقت الانتهاء. لا يوجد أي fallback يقبل JWT غير موثق.
2. فحص revocation الشبكي أصبح اختياريًا عبر `CHECK_REVOKED_ID_TOKENS=true`. الافتراضي `false` حتى لا تتحول مشكلة IAM في Cloud Run إلى منع دخول لجميع المستخدمين. عند تفعيله يجب أن تملك هوية الخادم صلاحيات Firebase Authentication اللازمة.
3. أضيف تصنيف دقيق للأخطاء بدل دمجها كلها في `Invalid or expired`:
   - `AUTH_EXPIRED`
   - `AUTH_REVOKED`
   - `AUTH_PROJECT_MISMATCH`
   - `AUTH_ADMIN_PERMISSION`
   - `AUTH_USER_DISABLED`
   - `AUTH_INVALID`
4. العميل إذا استلم `AUTH_EXPIRED` أو `AUTH_INVALID` يجبر Firebase على إصدار ID token جديد ثم يعيد الطلب **مرة واحدة فقط**.
5. في طلبات الكتابة، إعادة المحاولة تحتفظ بنفس `X-Idempotency-Key` حتى لا يتكرر POST/PATCH بسبب تحديث التوكن.
6. قراءة payload غير الموثق موجودة فقط لتشخيص `aud/exp` بعد فشل التحقق، ولا تستخدم مطلقًا لإنشاء actor أو منح صلاحية.
7. كل إصلاحات الحزمة السابقة محفوظة: قاعدة Firestore المسماة، Storage bucket، MFA enrollment/challenge، تطبيع الأدوار، وقواعد Firebase.

## التحقق المحلي

- Release security audit: **28/28 PASS**
- TypeScript syntax audit: **109 files / 0 errors**
- Global UI audit: **24/24 PASS**

لم يتم تنفيذ اتصال حي بحساب Firebase الإنتاجي أو نشر الحزمة؛ لذلك لا أدّعي اختبار IAM الخاص ببيئة Cloud Run الفعلية.

## الدمج

فك ZIP فوق جذر نفس نسخة AcademicOS واستبدل الملفات الموجودة. يمكن تطبيق v2 مباشرة فوق المشروع الأصلي أو فوق Patch السابق؛ الحزمة تحتوي فقط الملفات التي تغيرت عن النسخة التي أرسلتها، وليست المشروع كاملًا.

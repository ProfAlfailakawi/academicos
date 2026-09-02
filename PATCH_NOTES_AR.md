# AcademicOS — إصلاح جذري للدخول وFirebase

هذه الحزمة **Patch فقط** وليست المشروع كاملًا. تُفك فوق جذر آخر نسخة من AcademicOS مع استبدال الملفات الموجودة وإضافة الملفين الجديدين.

## ما تم إصلاحه

1. **Firestore كان يتصل بقاعدة خاطئة**: إعداد المشروع يستخدم قاعدة Firestore مسماة:
   `ai-studio-academicos-fbe5103a-df9c-4b49-a3c4-52b205a3c818`
   بينما الخادم كان يستدعي `getFirestore()` بلا Database ID، فيذهب تلقائيًا إلى `(default)`. تم توحيد كل وصول الخادم إلى قاعدة المشروع الصحيحة مع إبقاء المحاكي على `(default)`.

2. **رفع ملفات الطالب كان يشترط متغيرًا مكررًا بلا داعٍ**: Storage كان يرفض الرفع إذا لم يوجد `FIREBASE_STORAGE_BUCKET` حتى مع وجود bucket صحيح داخل `firebase-applet-config.json`. أصبح الآن يستخدم متغير البيئة إن وُجد، وإلا يستخدم إعداد Firebase الحقيقي تلقائيًا.

3. **MFA كان يمنع لوحة الأدمن بالكامل**: Middleware المصادقة كان يمنع كل طلب API للأدوار الإدارية قبل فتح حتى صفحات القراءة. أزيل الحظر العام، وبقي MFA إلزاميًا على العمليات الحساسة فقط عبر `requireRecentPrivilegedAuth`.

4. **تمت إضافة دورة MFA كاملة بدل رسالة المنع**:
   - شاشة تسجيل TOTP للأدوار الإدارية.
   - تسجيل العامل الثاني داخل Firebase فعليًا.
   - تسجيل خروج ثم دخول جديد لضمان وجود إثبات العامل الثاني في ID Token.
   - دعم تحدي TOTP عند الدخول.
   - دعم تحدي SMS للحسابات التي لديها Phone MFA مسبقًا.

5. **إغلاق ثغرة مصادقة خطيرة**: حُذف fallback كان يقرأ Payload من JWT غير موثّق عند فشل Firebase Admin verification. الآن Bearer token لا يُقبل إلا بعد `verifyIdToken(token, true)` من Firebase Admin.

6. **تطبيع الأدوار الشائعة**: claims مثل `teacher`, `instructor`, `faculty`, `lecturer` تُفهم كـ `professor`، و`administrator` كـ `admin` بدل سقوطها بصمت إلى student.

7. **تشخيص أوضح**: `/api/health` يعرض قاعدة Firestore المستخدمة وحالة Storage الفعلية، كما أصبحت أخطاء إعداد Storage/Firestore المعروفة أوضح بدل الرسالة العامة فقط.

8. **firebase.json** أصبح يربط القواعد والفهارس صراحة بقاعدة Firestore المسماة الموجودة في المشروع.

## التحقق المحلي المنفذ

- `node scripts/static-release-audit.mjs` → **27/27 PASS**
- `node scripts/ts-syntax-audit.cjs` → **109 files, 0 syntax errors**
- `node scripts/global-ui-audit.cjs` → **24/24 PASS**

لم يتم تنفيذ build كامل لأن تثبيت npm dependencies غير متاح في بيئة العمل الحالية (npm registry غير متاح/لا توجد cache كاملة). لم يتم رفع أو نشر أي ملف إلى Firebase أو Cloud Run أو GitHub أو أي خدمة خارجية.

## طريقة الدمج

فك محتويات ZIP فوق **جذر نفس نسخة المشروع التي أرسلتها** ثم اسمح باستبدال الملفات. لا تنسخ المجلد كطبقة إضافية؛ المسارات داخل ZIP تبدأ من جذر المشروع (`server.ts`, `src/...`, `firebase.json`).

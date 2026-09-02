# AcademicOS — Firebase / Cloud Run Runtime Identity Fix v4

هذه الحزمة **Patch فقط** وتوضع فوق جذر المشروع الحالي.

## ما الذي صُحح؟
- إلغاء افتراض v3 بإنشاء/فرض حساب خدمة جديد باسم `academicos-runtime`.
- عدم تمرير `--service-account` أثناء النشر؛ تبقى هوية خدمة Cloud Run الحالية كما هي.
- عدم إنشاء خدمة Cloud Run ثانية تلقائيًا؛ سكربت النشر يعيد استخدام خدمة AI Studio/AcademicOS الموجودة، أو يتوقف بدل أن يخمن.
- إضافة `scripts/repair-cloud-run-firebase-access.sh` الذي يكتشف هوية خدمة Cloud Run **الفعلية** ثم يمنحها وصول Firestore إلى قاعدة AcademicOS المسماة.
- منح صلاحية Firestore للقاعدة المسماة أولًا بشرط IAM محدد للقاعدة، مع fallback إلى `roles/datastore.user` القياسي إذا رفضت بيئة gcloud الشرط.
- عدم حذف `FIREBASE_SERVICE_ACCOUNT` تلقائيًا من الخدمة؛ إذا كان المستخدم قد جهز اعتمادًا صالحًا فلن يمسحه السكربت.
- تصحيح رسالة الخطأ التي كانت تطلب استخدام «حساب التشغيل المخصص»؛ لم يعد المشروع يفترض وجود حساب مخصص.

## مهم
مجرد استبدال ملفات المصدر لا يغيّر IAM لخدمة Cloud Run المنشورة مسبقًا. إذا كانت v3 قد غيّرت الهوية أو كانت الهوية الحالية بلا صلاحية Firestore، شغّل مرة واحدة من جذر المشروع:

```bash
npm run firebase:repair-runtime
```

السكربت لا ينشئ حساب خدمة جديدًا ولا يرفع كودًا؛ فقط يكتشف خدمة Cloud Run الحالية ويصلح صلاحيات هويتها الحالية على Firebase/Firestore.

## التحقق المحلي
- Release audit: 32/32
- Global UI audit: 24/24
- TypeScript syntax audit: 109 files / 0 errors
- Bash syntax: passed

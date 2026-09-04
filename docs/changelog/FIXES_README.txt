AcademicOS — إصلاحات ١+٢+٣ (2026-09-04)
=========================================
ملفات معدّلة (بمساراتها الأصلية داخل المشروع):

  server.ts
  src/server/db.ts
  src/pages/Dashboard.tsx
  src/pages/UserManagement.tsx
  src/pages/Notifications.tsx
  src/components/AppDialog.tsx

ضع كل ملف مكان مساره نفسه في المشروع (استبدال).

ما أُصلح:
[1] أمني
  - BUG-001 (P1): إغلاق تسريب لوحة التحكم عبر المستأجرين — نطاق المنصة
    صار يعتمد على الدور فقط (CROSS_TENANT_PLATFORM_ROLES) لا على نص tenantId.
  - BUG-002 (P2): إزالة استنتاج "individual_ = مشرف منصة" وإخراج
    university_admin من مسار عبور المستأجرين + تثبيت فلتر ?tenantId.
[2] منطق/مال
  - BUG-003 (P2): فرض حدّ صفحات الخطة (لا يتجاوز page cap للخطة المدفوعة).
  - BUG-004 (P2): قفل تزامن اختياري على updateProject (409 REVISION_CONFLICT).
  - الدرجات (P2): فحص "released" داخل معاملة gradeCourseSubmission (TOCTOU).
  - BUG-005 (P3): إغلاق تجاوز الدفع للتصدير عبر format=json.
  - BUG-006 (P3): فحص "المبلغ يغطي الخطة" في منح Stripe.
[3] واجهة
  - Notifications: لا "لا جديد" كاذب عند فشل التحميل + رسائل فشل للطفرات.
  - Dashboard + UserManagement: رسائل خطأ مترجمة عبر localizedUiError بدل الخام.
  - AppDialog: حبس تركيز Tab داخل النافذة (focus trap).

تحقق أُجري: typecheck نظيف، 42 اختبارًا ناجحًا، الخادم يقلع، غير المصرّح 401.
لم يُربط أي مزوّد دفع حقيقي (BILLING_PROVIDER=disabled، لا مفاتيح).

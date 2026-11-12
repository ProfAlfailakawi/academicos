# ملاحظات المراجعة — أكاديمك

**ملاحظة للمراجع (EN):** AcademicOS is a native shell around our production service at https://academicos-edu.web.app. Native features: offline detection and banner with automatic recovery, pull-to-refresh, swipe navigation, resume-last-page, iPad multitasking and Mac (Apple silicon) support.

- حساب التجربة: OWNER-TODO: حساب تجربة باشتراك مفعّل.
- المدفوعات: BLOCKER: الموقع يبيع اشتراكات رقمية (LemonSqueezy/MyFatoorah/Stripe). داخل تطبيق iOS يجب إخفاء أزرار الشراء والأسعار والروابط إليها (أو تطبيق StoreKit). علامة المستخدم: UA يحتوي 'AppleShell'.
- مخاطر المراجعة: 3.1.1 In-App Purchase — أعلى خطر رفض حتى يُخفى الشراء في نسخة iOS.

// ---------------------------------------------------------------------------
// AcademicOS — إعداد وقت التشغيل (Runtime configuration)
//
// هذا الملف يُحمَّل قبل تطبيق React ويضبط window.__ENV__ لتقرأ منه قيم Firebase
// دون إعادة بناء الحزمة. عدّل القيم هنا مرة واحدة، أو دع خط النشر يولّده تلقائيًا.
//
// ⚠️ قيم Firebase للويب (apiKey/appId/...) ليست أسرارًا — تُشحن لكل متصفح، والأمان
//    يفرضه Firebase Security Rules + App Check، لا إخفاء هذه القيم. آمنة للوضع هنا.
//    (لا تضع هنا أسرار الخادم مثل مفاتيح الخدمة أو مفاتيح الدفع.)
//
// الحصول على القيم: Firebase Console → Project settings → General → Your apps → Web app → SDK config.
//
// خيار Cloud Run (بلا إعادة بناء): اجعل نقطة الدخول تكتب هذا الملف من متغيرات البيئة، مثال:
//   cat > /app/dist/env-config.js <<EOF
//   window.__ENV__ = { VITE_FIREBASE_API_KEY: "$VITE_FIREBASE_API_KEY", ... };
//   EOF
// ---------------------------------------------------------------------------
window.__ENV__ = {
  // ↓↓↓ ضع قيم مشروع Firebase الخاص بك هنا (استبدل النصوص الفارغة) ↓↓↓
  VITE_FIREBASE_API_KEY: "",
  VITE_FIREBASE_AUTH_DOMAIN: "",          // مثال: your-project.firebaseapp.com
  VITE_FIREBASE_PROJECT_ID: "",           // مثال: academicos-prod
  VITE_FIREBASE_STORAGE_BUCKET: "",       // مثال: your-project.appspot.com
  VITE_FIREBASE_MESSAGING_SENDER_ID: "",  // مثال: 522016905178
  VITE_FIREBASE_APP_ID: "",               // مثال: 1:522016905178:web:xxxxxxxx
  // اختياري:
  VITE_FIREBASE_APPCHECK_SITE_KEY: "",    // مفتاح reCAPTCHA Enterprise (App Check)
};

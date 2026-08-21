# تدويل الواجهة — مكتمل (2026-08-21)

الواجهة الكاملة لـAcademicOS مُعرّبة الآن إلى **٨ لغات**، والتبديل بينها فوري مع دعم RTL/LTR.

## اللغات
العربية · English · Türkçe · 中文 (مبسّط) · हिन्दी · Español · Français · اردو

## البنية
- `src/lib/i18n.tsx`: مزوّد خفيف بلا اعتماديات — `useI18n()` → `{ t, locale, meta, setLocale }`، يبدّل اتجاه الصفحة تلقائيًا ويحفظ الاختيار في `localStorage`.
- `src/lib/i18n-messages.ts`: قاموس الرسائل — **1366 مفتاحًا × ٨ لغات**.
- كل صفحة/مكوّن يستدعي `t('<namespace>.<key>')`.

## التغطية (كل صفحات ومكوّنات الواجهة)
- **الشريط والتنقّل:** Layout (كامل)
- **الطالب:** RoleHome, MissionControl, Dashboard, Projects, UploadAssignment, ProjectWorkspace, Skills, Passport, Calendar, Notifications, Archive, Jobs, LearnStudio, Onboarding, Login, SearchWorkspace, Invitations
- **الأستاذ/المقرر:** ProfessorOS, CourseOS, AssignmentSubmissions
- **المؤسسة/الإدارة:** PlatformHub, ControlPlane, CurriculumTwin, UserManagement, SupportConsole, Integrations, Settings, Status, SecurityReport
- **العامة:** PublicHome, PublicPage, PublicShare
- **مكوّنات مساحة العمل:** WorkspaceStudios, ReviewStudio, TeamStudio, EvidenceStudio, VivaStudio, ProjectIntelligence, StatusPill

## التحقق
- `typecheck` → **0 أخطاء**
- **0 مفاتيح ترجمة ناقصة** عبر كل الصفحات والمكوّنات
- `npm run build` → ناجح
- **53/53 اختبار ناجح**
- لا نص عربي مكتوب في الواجهة (المتبقي: تعليقات كود + فاصلة عربية في منطق التحليل + القاموس نفسه)

## ملاحظات صادقة
- الترجمات **آلية عبر نماذج** — ممتازة للواجهة لكنها تستحق **مراجعة ناطق أصلي** قبل الإطلاق العام (خاصة الصيني والهندي والأردو).
- **مراجعة بصرية حية** لم تُجرَ بعد (تحتاج تشغيل التطبيق + تسجيل دخول Firebase).
- أسماء العلامات (ProfessorOS، Project DNA، Rubric، Workspace، University Control Plane…) تُركت موحّدة عبر اللغات عمدًا.

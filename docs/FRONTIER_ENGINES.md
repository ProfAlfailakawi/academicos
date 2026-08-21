# AcademicOS Frontier Engines — 2026-08-20

ست قدرات منتج جديدة تبني على البنية القائمة دون تكرار الميزات العشر ولا طبقة الذكاء السبع. جميعها دوال نقية حتمية في `src/server/frontier.ts` (لا `Math.random`/`Date.now` داخل الحساب)، مغطاة باختبارات `tests/frontier.test.ts`، وموصولة كمسارات API حقيقية في `server.ts`.

## 1) مُجمِّع ملف الاعتماد التلقائي — Accreditation Dossier Autopilot
`buildAccreditationDossier(courses, assignments, submissions, program?, curriculumMap?, threshold=0.7)`
- يربط كل مخرج تعلم ببرنامجه → المقررات → التكليفات → **درجات تسليمات مصححة فعليًا** (graded/released).
- يحسب نسبة الإتقان من الدرجات الحقيقية فقط؛ المخرج بلا تسليمات مصححة يظهر «غير مُقاس» لا «محقق» (لا اختلاق أرقام).
- يخرج: تغطية، إتقان، فجوات (غير مغطى/غير مقاس/تحت العتبة)، وحكم جاهزية.
- **المسار:** `GET /api/intelligence/accreditation-dossier?programId&threshold` — أدوار: منسق مقرر/أدمن قسم/كلية/جامعة/ضابط اعتماد فأعلى.

## 2) جواز التأليف القابل للتحقق خارجيًا — Authorship Passport
`buildAuthorshipPassport(capsule, opts)` + `verifyAuthorshipPassportAgainstCapsule(passport, capsule)`
- يحوّل Evidence Capsule (SHA-256 + Ed25519) إلى بطاقة اعتماد محمولة يتحقق منها طرف خارجي (رب عمل/جامعة).
- بديل **إيجابي** لكاشفات الذكاء الاصطناعي: يثبت أصالة العملية (أدلة، Proof of Learning، مساهمون بشر) لا يتهم.
- درجات ثقة: `unsigned` / `self_signed` / `institution_signed`؛ يكشف العبث لأن التجزئة تُبطل الربط.
- **المسار:** `GET /api/projects/:id/authorship-passport` (المالك)؛ المفاتيح الموثوقة من `EVIDENCE_CAPSULE_TRUSTED_PUBLIC_KEYS_B64URL`.

## 3) مؤشر ازدحام المواعيد للفوج — Deadline Congestion Index
`buildDeadlineCongestion(assignments, cohortSize=30, now, iterations=1)`
- محاكاة Monte-Carlo **حتمية** (PRNG مبذور mulberry32) لسلوك التسويف: توزيع مثلثي منحاز نحو الموعد.
- يخرج: حِمل يومي/أسبوعي متوقع، أسابيع ساخنة، تصادم مواعيد نفس الفوج، ومؤشر ازدحام 0-100 قبل بدء الفصل.
- **المسار:** `GET /api/intelligence/deadline-congestion?courseId&cohortSize` — أدوار هيئة التدريس فأعلى.

## 4) مُدقّق نزاهة تصميم التكليف — Integrity-by-Design Lint
`lintAssignmentIntegrity(assignment)`
- يعطي التكليف درجة أصالة 0-100 وإشارات: مهمة أصيلة، سياق محلي، دليل عملية/Viva، Rubric يقيس العملية، ليس استرجاعيًا، سياسة AI محددة.
- يقترح إعادة تصميم بدل المراقبة أو اتهام الطلاب — متسق مع فلسفة المنتج.
- **المسار:** `GET /api/intelligence/assignment-integrity/:assignmentId` — أدوار هيئة التدريس فأعلى.

## 5) معايرة عدالة التصحيح — Grader Fairness Calibration
`buildGraderFairness(submissions)`
- يكشف تساهل/تشدد المصحّحين عبر z-score مقابل متوسط الفوج، وتشتت معايير الـRubric، وشذوذات.
- ملاحظة جاهزة للطعون: وصفية إحصائية لا تثبت تحيزًا فرديًا بذاته؛ مؤشر لمراجعة بشرية.
- **المسار:** `GET /api/intelligence/grader-fairness?assignmentId` — أدوار هيئة التدريس فأعلى.

## 6) الرسم الأكاديمي الفيدرالي — Federated Academic Graph
`buildFederatedGraph(institutions)`
- تكافؤ مخرجات/مهارات عبر مؤسسات عبر **تجزئات SHA-256 فقط** — بلا أي بيانات طلاب خام أو درجات.
- يخرج: عُقد مشتركة، مرشحو تحويل الساعات، ونسبة قابلية النقل — يدعم تنقّل الطلاب مع حفظ السيادة والخصوصية.
- **المسار:** `POST /api/intelligence/federated-graph` (national_admin/superadmin/root_owner)؛ المدخلات تجزئات صريحة في الجسم لا قراءة عبر المستأجرين.

---

### التحقق
- `npm run test:frontier` → **6/6 pass**. المجموعة الكاملة **27/27 pass**، `typecheck` 0 أخطاء، `npm run build` ناجح.
- كل الأرقام مشتقة من بيانات محفوظة فعلية؛ لا مسارات وهمية، ولا رفع لمستوى تحقق أي دليل عن المسجّل.

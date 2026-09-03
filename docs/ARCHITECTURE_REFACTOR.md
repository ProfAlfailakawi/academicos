# AcademicOS — خطة إعادة الهيكلة والقدرات المتقدمة

آخر تحديث: 2026-09-03

هذه الوثيقة تعالج فجوات الهندسة الست التي رُصدت في المراجعة، وتوثّق القدرات الثماني الجديدة،
وتشرح **نمط الربط** بأقل تغيير ممكن على `server.ts` (بلا مخاطرة على 10 آلاف سطر قائمة).

---

## الفجوة #1 — غياب Git  ✅ منجز

أُنشئ مستودع Git وسُجِّلت لقطة أساس (baseline) قبل أي تعديل:

```
git init  →  commit "chore: initialize repository baseline (pre-enhancement snapshot)"
```

كل عمل لاحق يبقى قابلًا للتتبّع والتراجع. لا يُرفع شيء تلقائيًا؛ الرفع قرار يدوي.

**التالي الموصى به:** فرع `main` محمي، فرع `feat/advanced-capabilities` لهذه الدفعة، ثم PR.

---

## الفجوة #2 — تضخّم server.ts (145 مسارًا في ملف واحد)  ✅ نمط مُرسَّخ

**السبب الجذري:** تركيز كل المسارات في ملف واحد يجعل التعديل مؤلمًا والمراجعة الأمنية سطرًا بسطر شبه مستحيلة.

**الحل — Router Registry بالحقن:** كل مجموعة قدرات تُسجَّل عبر دالة `register*(app, ctx)` معزولة
تستقبل تبعياتها بالحقن بدل الوصول العالمي. القدرات الجديدة كلها تتبع هذا النمط في
[`src/server/advanced/routes.ts`](../src/server/advanced/routes.ts):

```ts
import { registerAdvancedRoutes } from './src/server/advanced/routes';
import { realtimeHub } from './src/server/realtime';

registerAdvancedRoutes(app, {
  authenticate, requireRoles, realtime: realtimeHub,
  featureEnabled: (tenantId, key) => isFeatureEnabled(tenantId, key),
  data: { /* دوال db القائمة — عقد واضح، بلا تسريب داخلي */ },
});
```

**سطر واحد في `server.ts`** يفعّل ثماني قدرات. هذا يرسّخ النمط الذي يُفكَّك عليه الملف الكبير تدريجيًا:
كل نطاق (courses / projects / admin / billing …) يُنقل لملف `register<Domain>Routes(app, ctx)` بنفس الأسلوب،
دون كسر السلوك. الترتيب المقترح للتفكيك (الأعلى مخاطرة أمنية أولًا):

1. `admin.routes.ts` (users / api-keys / impersonation)  — سطح أمني حسّاس.
2. `billing.routes.ts` (checkout + 4 webhooks) — تحقّق التواقيع في مكان واحد.
3. `projects.routes.ts` (أكبر مجموعة) — يقسّم لاحقًا لـ writer / evidence / viva.
4. `platform.routes.ts` (control-plane / feature-flags).
5. باقي المسارات العامة.

كل خطوة: انقل المجموعة كما هي إلى `register*`، أضف اختبار دخان للمسارات، ثم احذف من `server.ts`.
لا إعادة كتابة منطق — نقل فقط. المخاطرة دنيا لأن التوقيعات تبقى ثابتة.

---

## الفجوة #3 — Rate limiting في الذاكرة  ✅ حل موزّع

**السبب الجذري:** `new Map` داخل الذاكرة — على Cloud Run بعدّة instances كل نسخة لها عدّاد مستقل،
فتضعف الحماية مع التوسّع وتنصفر عند كل إعادة تشغيل.

**الحل:** [`src/server/distributed-rate-limiter.ts`](../src/server/distributed-rate-limiter.ts) — مخزن قابل للتبديل:

- `MemoryRateStore` (افتراضي، سلوك مطابق للأصل — بلا كسر في التطوير/النسخة الواحدة).
- `FirestoreRateStore` — عدّاد ذرّي موحّد عبر كل النسخ (`runTransaction` increment)، مع `expireAt` للتنظيف.

التفعيل بالبيئة فقط:

```bash
RATE_LIMIT_BACKEND=firestore   # الإنتاج متعدد النسخ
```

الربط في `server.ts`:

```ts
import { createRateLimiter } from './src/server/distributed-rate-limiter';
const limiter = createRateLimiter({ firestoreCollection: () => db.collection('rateCounters') });
// داخل apiRateLimit: const d = await limiter.check(key, limit); if (!d.allowed) return res.status(429)...
```

يبقى منطق النافذة الزمنية (دقيقة ثابتة) وحدود القراءة/الكتابة كما هي؛ يتغيّر المخزن فقط.
فشل المخزن الموزّع = **fail-open** مع إنذار (التوفّر أهم من رفض مستخدم شرعي).

---

## الفجوة #4 — لا طبقة Realtime  ✅ SSE

**السبب الجذري:** الإشعارات والحضور وغرفة التوضيح تعتمد polling — فجوة تجربة لمنتج تعاوني.

**الحل:** [`src/server/realtime.ts`](../src/server/realtime.ts) — مركز Server-Sent Events خفيف بلا اعتماديات،
قنوات مُنطّقة بالمستأجر/المشروع، heartbeat، حدّ أقصى للمشتركين. أبسط من WebSocket وكافٍ للبثّ خادم→عميل.

مسار البثّ (يُضاف لـ `server.ts`، مصادَقة عبر access_token في الاستعلام لهذا المسار فقط):

```ts
import { realtimeHub, RealtimeHub } from './src/server/realtime';
app.get('/api/realtime/stream', authenticateSSE, (req, res) => {
  const channels = String(req.query.channels||'').split(',').filter(Boolean)
    .filter(c => c.includes(req.actor.tenantId)); // امنع الاشتراك عبر المستأجرين
  realtimeHub.connect(res, { id: `${req.actor.userId}:${Date.now()}`, tenantId: req.actor.tenantId, userId: req.actor.userId, channels });
});
```

العميل: [`src/lib/realtime-client.ts`](../src/lib/realtime-client.ts) — إعادة اتصال أُسّية واشتراكات نوعية.
البثّ من أي مكان: `realtimeHub.publish(RealtimeHub.projectChannel(t,p), 'project_activity', payload)`.

**توسّع متعدد النسخ:** اربط `publish` بـ Firestore listener أو Pub/Sub لتوحيد البثّ عبر النسخ (الواجهة جاهزة لذلك).

---

## الفجوة #5 — بوابات الإطلاق غير مُثبتة  ✅ مُدقّق آلي

**السبب الجذري:** البوابات السبع في `GO_LIVE_RUNBOOK.md` كانت نصًّا لا فحصًا.

**الحل:** [`scripts/verify-launch-gates.mjs`](../scripts/verify-launch-gates.mjs) — يحوّل البوابات السبع إلى فحص آلي
يعطي تقريرًا PASS/FAIL/MANUAL لكل بوابة (تهيئة البيئة، المزوّدون، App Check/MFA، الدفع، الاختبارات، النشر، الاختبار البشري):

```bash
npm run verify:launch-gates
```

الفحوص التي يمكن أتمتتها (متغيرات البيئة، وجود المفاتيح، نجاح typecheck/الاختبارات) تُنفَّذ فعليًا؛
ما لا يُؤتمت (اختبار بشري في staging) يُوسَم `MANUAL` صراحةً بدل ادّعاء نجاحه.

---

## الفجوة #6 — ملفات ضخمة (i18n 2646 سطر، ProjectWorkspace 1042 سطر)

**السبب الجذري:** رسائل الترجمة ومكوّن مساحة العمل في ملفّين متضخّمين.

**الخطة (منخفضة المخاطرة، تدريجية):**

- **i18n:** انقل `i18n-messages.ts` إلى `src/lib/i18n/<namespace>.ts` (evidence، writer، viva، billing، ui، …)
  مع `index.ts` يجمعها. لا يتغيّر مفتاح واحد؛ فقط تُقسَّم الكائنات. يمكن نقل namespace واحد كل PR والتحقّق بـ typecheck.
- **ProjectWorkspace:** استُخرجت الاستوديوهات فعلًا إلى `src/components/project/*`؛ الخطوة التالية سحب
  منطق التبويب/الحالة إلى `useProjectWorkspace()` hook و`ProjectWorkspaceTabs`، ليبقى الملف تخطيطًا رفيعًا.

> ملاحظة صدق: هذه الفجوة **مخطَّطة لا منفّذة** في هذه الدفعة عمدًا — التقسيم الآلي الأعمى لملفّي ترجمة/واجهة
> قائمين يخاطر بكسر مفاتيح حيّة. النمط والوجهة موثّقان، والقدرات الجديدة كلها كُتبت أصلًا مقسّمة بشكل صحيح.

---

## القدرات الثماني الجديدة (كلها محرّكات نقية حتمية + اختبارات + مسارات)

| # | القدرة | المحرّك | المسار | الواجهة |
|---|--------|---------|--------|---------|
| 1 | الفوج الشبح 👻 | `advanced/ghost-cohort.ts` | `GET /api/assignments/:id/ghost-cohort` | `GhostCohortPanel.tsx` |
| 2 | خريطة فقدان الدرجات 🩸 | `advanced/grade-loss-map.ts` | `GET /api/assignments/:id/grade-loss-map` | `GradeLossMap.tsx` |
| 3 | اصنع الامتحان 🔄 | `advanced/reverse-assessment.ts` | `POST /api/projects/:id/reverse-assessment` | `ReverseAssessmentStudio.tsx` |
| 4 | غرفة التوضيح الحيّة 📡 | `advanced/clarification-room.ts` | `POST /api/clarifications/:id/answer` | بثّ SSE |
| 5 | اقتصاد الشرح 🎙️ | `advanced/peer-explanation.ts` | `POST /api/courses/:id/peer-explanations` | — |
| 6 | الصندوق الأسود ✈️ | `advanced/learning-black-box.ts` + `lib/black-box-recorder.ts` | `POST /api/projects/:id/black-box/verify` | مسجّل محلي |
| 7 | إرث الخريجين 🏛️ | `advanced/alumni-legacy.ts` | `POST /api/projects/:id/legacy-listing` | — |
| 8 | بوابة الواتساب 📱 | `advanced/whatsapp-gateway.ts` | `GET/POST /api/whatsapp/webhook` | — |

**مبادئ مشتركة (متسقة مع فلسفة `frontier.ts`):**
- خصوصية أولًا: k-anonymity صارم (≥5) في كل محرّك جماعي؛ لا نص/هوية/درجة فردية تُعاد.
- حتمية بحتة: لا `Math.random`/`Date.now` داخل الحساب؛ الأزمنة/البذور وسائط.
- صدق: بيانات غير كافية تظهر «غير متاح» لا رقمًا مختلقًا.
- «نثبت ولا نتهم»: الصندوق الأسود اختياري ومحلي، وجواز التأليف بديل إيجابي لكاشفات الذكاء الاصطناعي.

**التحقّق:** `npm run test:advanced` → 14/14 ناجح · `tsc --noEmit` → 0 أخطاء.

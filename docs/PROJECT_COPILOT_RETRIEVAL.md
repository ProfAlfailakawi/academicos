# Project Copilot — File Search المعنوي و Google Search Grounding (2026-08-29)

ترقية «عميقة وضيّقة» لبوابة الـCopilot: تحويل وضعين من سقالة صادقة إلى **قدرات فعلية**،
مع الحفاظ على هوية المنتج السيادية (البيانات تبقى عندك) والنزاهة الأكاديمية.

## ما الذي تغيّر فعليًا

| الوضع | قبل | بعد |
|---|---|---|
| `file_search` | فهرس **لفظي** (substring) على artifacts/evidence | **استرجاع معنوي** (embeddings + تشابه cosine) فوق مخزن متجهات **ذاتي الاستضافة** في Firestore عندك، بنطاق tenant+project، مع citations وثقة محفوظة |
| `research` | مجرد env-gate بلا استدعاء | **Google Search Grounding فعلي** عبر أداة `google_search` الأصلية في Gemini أو بوابة مؤسسية، وتحويل groundingMetadata إلى citations من نوع web بثقة `grounded` |

الأوضاع الأخرى (`assignment_compile` متعدد الوسائط، `tutor` التكيّفي) كانت فعلية مسبقًا ولم تُلمس.
`viva_live` و`workspace_function` **مؤجّلان عمدًا** (سقالة صادقة كما هي) — لأسباب في «القرارات».

## السيادة والخصوصية (القرار الجوهري)

- **File Search ذاتي الاستضافة**: المتجهات تُخزَّن في مجموعة `copilotChunks` داخل Firestore الخاص بك،
  مفصولة بصرامة بـ `scopeKey = tenant__project__id`. **لا تُرفع ملفات الطلاب الخام إلى أي مخزن File Search مُدار من طرف ثالث.**
- **مزوّد embeddings قابل للتبديل** (الأسبقية للذاتي):
  1. نقطة ذاتية الاستضافة عبر `EMBEDDING_GATEWAY_URL`/`_TOKEN` — للمؤسسات التي تريد إبقاء كل شيء داخليًا.
  2. Gemini embeddings (`EMBEDDING_MODEL`, افتراضي `gemini-embedding-2`) — يُرسل نص المقاطع **مؤقتًا** فقط، ولا تخزّنه Google.
- هذا متسق مع فلسفة الـ**Federated Academic Graph** (تكافؤ عبر hashes فقط) في [FRONTIER_ENGINES](FRONTIER_ENGINES.md).

## المسارات (API)

- `POST /api/projects/:id/copilot/index` — يبني/يحدّث فهرس المشروع من Project DNA + Rubric + Artifacts + Evidence
  (واختياريًا `sources: [{title,text}]` لمصادر مقرر يضيفها الأستاذ). محكوم بـ feature flag `ProjectCopilotFileSearch`
  و budget reservation. يعيد إحصاءات: عدد المقاطع المفهرسة/المحذوفة، backend، اقتطاع.
- `POST /api/projects/:id/copilot` (mode=`file_search`) — يضمّن أفضل المقاطع المعنوية كـcitations في مقدمة النتيجة،
  ويغذّي النموذج الموجِّه بها.
- `POST /api/projects/:id/copilot` (mode=`research`) — يشغّل grounding فعليًا (عند تفعيل `ResearchStudioGrounding`)،
  ويضيف مصادر الويب المؤرَّضة، ويغذّي التوجيه بها.

## الضوابط الإنتاجية

- **Feature flags**: `ProjectCopilotFileSearch` (مفعّل)، `ResearchStudioGrounding` (**مطفأ افتراضيًا** — opt-in).
- **Cost controls**: كل استيعاب/grounding يمرّ بـ `reserveAiBudget`/`releaseAiBudgetReservation`، وكل استدعاء يُسجَّل في `aiRuns`.
- **دفاعات prompt-injection**: نص المقاطع المسترجعة ومقتطفات البحث تُعامَل كبيانات غير موثوقة صراحةً
  (حدود `BEGIN/END UNTRUSTED …` + تعليمات المنصّة في `buildCopilotPlatformInstruction`).
- **عدم رفع الثقة**: الاسترجاع لا يرفع ثقة أي دليل عن المسجّل؛ الويب يبقى `grounded` (يحتاج تحقق) لا «مؤكد».
- **Observability**: evals جديدة (`semantic_retrieval`, `citation_grounding`) + `retrieval` في السجل التدقيقي.
- **حتمية**: التقطيع والتشابه والترتيب وتحليل الـgrounding دوال نقية (بلا `Date.now`/`Math.random`) قابلة للاختبار.

## الإعداد (env)

```
# File Search — أحد الخيارين:
EMBEDDING_GATEWAY_URL=...      EMBEDDING_GATEWAY_TOKEN=...   # (أ) ذاتي الاستضافة
EMBEDDING_MODEL=gemini-embedding-2                          # (ب) Gemini (يستخدم GEMINI_API_KEY)

# Grounding — أحد الخيارين + تفعيل الـflag ResearchStudioGrounding:
GOOGLE_SEARCH_GROUNDING_ENDPOINT=... GOOGLE_SEARCH_GROUNDING_TOKEN=...  # (أ) بوابة مؤسسية
# (ب) أداة Gemini الأصلية google_search عبر GEMINI_API_KEY + GEMINI_MODEL
```

عند غياب الإعداد: تدهور **صادق** — يرجع للفهرس المحلي/يعلن الفجوة، بلا اختلاق مصادر.

## التحقق

- `npm run test:retrieval` — تقطيع حتمي، cosine، top-k مع أرضية، تحويل citations، محلّلات grounding، كواشف الإعداد.
- `npm run test:copilot` — حدود النزاهة والحوكمة (كانت غير موصولة بالـtest script؛ وُصلت الآن).

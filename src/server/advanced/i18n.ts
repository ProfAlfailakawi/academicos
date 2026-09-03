// Localized copy for the advanced capability engines.
//
// The engines are pure and deterministic, but their output is rendered directly
// to learners, so every user-facing string follows the request locale instead of
// being emitted in one fixed language — the same contract as the core product.

import { L, resolveServerLocale, tx, txf, type ServerLocale, type LocalizedText } from '../server-locale';
export { resolveServerLocale, type ServerLocale };

// Bloom's taxonomy level labels (shared by reverse-assessment and peer-explanation).
export const BLOOM_LABELS: Record<number, LocalizedText> = {
  1: L('تذكّر', 'Remember', 'Hatırlama', '记忆', 'स्मरण', 'Recordar', 'Mémoriser', 'یاد رکھنا'),
  2: L('فهم', 'Understand', 'Anlama', '理解', 'समझ', 'Comprender', 'Comprendre', 'سمجھنا'),
  3: L('تطبيق', 'Apply', 'Uygulama', '应用', 'अनुप्रयोग', 'Aplicar', 'Appliquer', 'اطلاق'),
  4: L('تحليل', 'Analyze', 'Analiz', '分析', 'विश्लेषण', 'Analizar', 'Analyser', 'تجزیہ'),
  5: L('تقويم', 'Evaluate', 'Değerlendirme', '评价', 'मूल्यांकन', 'Evaluar', 'Évaluer', 'تقویم'),
  6: L('إبداع', 'Create', 'Yaratma', '创造', 'सृजन', 'Crear', 'Créer', 'تخلیق'),
};

export const ADV = {
  // ---- Ghost Cohort ----
  phaseIntake: L('استيعاب التكليف', 'Understanding the brief', 'Ödevi kavrama', '理解任务', 'असाइनमेंट समझना', 'Entender el encargo', 'Comprendre le sujet', 'اسائنمنٹ سمجھنا'),
  phaseResearch: L('البحث وجمع المصادر', 'Research and sourcing', 'Araştırma ve kaynak', '研究与查找资料', 'शोध व स्रोत जुटाना', 'Investigación y fuentes', 'Recherche et sources', 'تحقیق و مآخذ'),
  phaseOutline: L('الهيكلة والمخطط', 'Structure and outline', 'Yapı ve taslak', '结构与提纲', 'ढाँचा व रूपरेखा', 'Estructura y esquema', 'Structure et plan', 'ساخت اور خاکہ'),
  phaseDraft: L('المسودة الأولى', 'First draft', 'İlk taslak', '初稿', 'पहला मसौदा', 'Primer borrador', 'Premier brouillon', 'پہلا مسودہ'),
  phaseRevision: L('المراجعة والتحسين', 'Revision and improvement', 'Gözden geçirme', '修改与提升', 'संशोधन व सुधार', 'Revisión y mejora', 'Révision et amélioration', 'نظرثانی و بہتری'),
  phaseEvidence: L('توثيق الأدلة', 'Documenting evidence', 'Kanıt belgeleme', '证据记录', 'प्रमाण दस्तावेज़ीकरण', 'Documentar la evidencia', 'Documenter les preuves', 'شواہد کی دستاویز'),
  phaseFinalize: L('الإنهاء والتسليم', 'Finalizing and submitting', 'Son işlem ve teslim', '定稿与提交', 'अंतिम रूप व जमा', 'Finalizar y entregar', 'Finaliser et rendre', 'حتمی و جمع'),
  ghostPrivacy: L(
    'كل الأرقام مشتقة من ≥{k} متفوقين ومجهولة الهوية تمامًا (توزيعات زمنية مطبّعة فقط، بلا نصوص أو درجات أو هويات فردية). المصدر: أزمنة نُسخ المشاريع لأفواج سابقة على نفس التكليف.',
    'All figures come from ≥{k} high scorers and are fully anonymized (only normalized timing distributions — no individual text, grades or identities). Source: project-version timings of past cohorts on the same assignment.',
    'Tüm sayılar ≥{k} yüksek puanlıdan gelir ve tümüyle anonimdir (yalnızca normalleştirilmiş zamanlama dağılımları — bireysel metin, not veya kimlik yok). Kaynak: aynı ödevdeki önceki grupların proje sürüm zamanlamaları.',
    '所有数字来自 ≥{k} 名高分者，且完全匿名（仅为归一化的时间分布——无个人文本、成绩或身份）。来源：同一作业往届的项目版本时间。',
    'सभी आँकड़े ≥{k} उच्च अंक पाने वालों से हैं और पूर्णतः अनाम हैं (केवल सामान्यीकृत समय-वितरण — कोई व्यक्तिगत पाठ, ग्रेड या पहचान नहीं)। स्रोत: उसी असाइनमेंट पर पिछली कक्षाओं के प्रोजेक्ट-संस्करण समय।',
    'Todas las cifras provienen de ≥{k} estudiantes de alto puntaje y son totalmente anónimas (solo distribuciones temporales normalizadas — sin texto, notas ni identidades individuales). Fuente: tiempos de versión de proyecto de cohortes anteriores en el mismo encargo.',
    'Tous les chiffres proviennent de ≥{k} étudiants performants et sont totalement anonymisés (uniquement des distributions temporelles normalisées — aucun texte, note ou identité individuels). Source : horodatages des versions de projet de promotions passées sur le même sujet.',
    'تمام اعداد ≥{k} اعلیٰ اسکور کرنے والوں سے ہیں اور مکمل گمنام ہیں (صرف نارملائزڈ وقت کی تقسیم — کوئی انفرادی متن، گریڈ یا شناخت نہیں)۔ ماخذ: اسی اسائنمنٹ پر پچھلی جماعتوں کے پروجیکٹ ورژن اوقات۔',
  ),
  nudgeBehind: L(
    'المتفوقون في هذه المرحلة الزمنية كانوا قد تجاوزوا المسودة الأولى — ركّز على إنجاز هيكل كامل الآن ولو خشِنًا.',
    'By this point in time, high scorers had already passed their first draft — focus on completing a full structure now, even a rough one.',
    'Bu zaman noktasında yüksek puanlılar ilk taslağı çoktan geçmişti — şimdi kaba da olsa tam bir yapı tamamlamaya odaklan.',
    '在这个时间点，高分者早已完成初稿——现在请集中精力完成一个完整的结构，哪怕粗糙。',
    'इस समय-बिंदु तक उच्च अंक पाने वाले पहला मसौदा पार कर चुके थे — अभी एक पूरा ढाँचा, भले ही कच्चा, पूरा करने पर ध्यान दें।',
    'A esta altura, los de alto puntaje ya habían pasado su primer borrador — concéntrate ahora en completar una estructura completa, aunque sea tosca.',
    'À ce stade, les meilleurs avaient déjà dépassé leur premier brouillon — concentrez-vous maintenant sur une structure complète, même grossière.',
    'اس وقت تک اعلیٰ اسکور کرنے والے پہلا مسودہ پار کر چکے تھے — ابھی مکمل ڈھانچہ، خواہ کچا ہو، مکمل کرنے پر توجہ دیں۔',
  ),
  nudgeRevisions: L(
    'المتفوقون راجعوا عملهم ~{n} مرة؛ أنت أقل من ذلك حتى الآن. المراجعة المتكررة أقوى مؤشر على درجة عالية.',
    'High scorers revised their work ~{n} times; you are below that so far. Frequent revision is the strongest predictor of a high grade.',
    'Yüksek puanlılar çalışmalarını ~{n} kez gözden geçirdi; şu ana kadar bunun altındasın. Sık gözden geçirme yüksek notun en güçlü göstergesidir.',
    '高分者修改了约 {n} 次；你目前低于这个数。反复修改是高分最有力的预测指标。',
    'उच्च अंक पाने वालों ने अपना काम ~{n} बार संशोधित किया; अब तक आप उससे कम हैं। बार-बार संशोधन उच्च ग्रेड का सबसे मज़बूत संकेतक है।',
    'Los de alto puntaje revisaron su trabajo ~{n} veces; hasta ahora estás por debajo. La revisión frecuente es el mejor predictor de una nota alta.',
    'Les meilleurs ont révisé leur travail ~{n} fois ; vous êtes en dessous pour l’instant. La révision fréquente est le meilleur prédicteur d’une bonne note.',
    'اعلیٰ اسکور کرنے والوں نے اپنا کام ~{n} بار نظرثانی کیا؛ آپ ابھی اس سے کم ہیں۔ بار بار نظرثانی اعلیٰ گریڈ کی سب سے مضبوط علامت ہے۔',
  ),
  nudgeOverdue: L(
    'مرحلة «{phase}» تأخّرت مقارنة بإيقاع الفوج — ابدأها قبل أن تتراكم.',
    'The "{phase}" phase is running late versus the cohort pace — start it before it piles up.',
    '"{phase}" aşaması grup temposuna göre gecikiyor — birikmeden başla.',
    '「{phase}」阶段已落后于群体节奏——在堆积之前开始它。',
    '"{phase}" चरण समूह की गति से पिछड़ रहा है — इससे पहले कि यह जमा हो, शुरू करें।',
    'La fase «{phase}» va con retraso frente al ritmo de la cohorte — empiézala antes de que se acumule.',
    'La phase « {phase} » est en retard par rapport au rythme de la promotion — commencez-la avant qu’elle ne s’accumule.',
    '«{phase}» مرحلہ گروپ کی رفتار سے پیچھے ہے — جمع ہونے سے پہلے اسے شروع کریں۔',
  ),
  nudgeAhead: L(
    'إيقاعك أسرع من متوسط المتفوقين — استثمر الوقت الفائض في جودة الأدلة والمراجعة لا في التسليم المبكر.',
    'You are pacing faster than the average high scorer — invest the spare time in evidence quality and revision, not in submitting early.',
    'Temponuz ortalama yüksek puanlıdan hızlı — kalan zamanı erken teslime değil, kanıt kalitesine ve gözden geçirmeye yatır.',
    '你的节奏快于高分者的平均水平——把富余时间投入证据质量和修改，而不是提前提交。',
    'आपकी गति औसत उच्च-अंक वाले से तेज़ है — बचा समय जल्दी जमा करने में नहीं, प्रमाण की गुणवत्ता और संशोधन में लगाएँ।',
    'Vas más rápido que el promedio de alto puntaje — invierte el tiempo extra en calidad de evidencia y revisión, no en entregar antes.',
    'Vous allez plus vite que la moyenne des meilleurs — investissez le temps gagné dans la qualité des preuves et la révision, pas dans un rendu anticipé.',
    'آپ کی رفتار اوسط اعلیٰ اسکورر سے تیز ہے — بچا وقت جلد جمع کرانے میں نہیں، شواہد کے معیار اور نظرثانی میں لگائیں۔',
  ),
  // ---- Grade Loss Map ----
  glInsufficientCohort: L(
    'لا تتوفر بيانات فوج كافية بعد لبناء خريطة موثوقة.',
    'Not enough cohort data yet to build a reliable map.',
    'Güvenilir bir harita için henüz yeterli grup verisi yok.',
    '目前群体数据不足，无法构建可靠的地图。',
    'विश्वसनीय मानचित्र बनाने के लिए अभी पर्याप्त कक्षा-डेटा नहीं है।',
    'Aún no hay datos de cohorte suficientes para construir un mapa fiable.',
    'Pas encore assez de données de promotion pour bâtir une carte fiable.',
    'قابلِ اعتماد نقشہ بنانے کے لیے ابھی کافی جماعتی ڈیٹا نہیں۔',
  ),
  glPrivacy: L(
    'الخريطة مبنية على ≥{k} تسليمًا مصححًا مجهول الهوية على نفس التكليف. لا تُعرض درجة أو هوية أي طالب؛ فقط أنماط الفاقد التجميعية.',
    'The map is built from ≥{k} anonymized graded submissions on the same assignment. No student’s grade or identity is shown — only aggregate loss patterns.',
    'Harita, aynı ödevdeki ≥{k} anonim, notlandırılmış teslimden oluşturulur. Hiçbir öğrencinin notu veya kimliği gösterilmez — yalnızca toplu kayıp desenleri.',
    '该地图基于同一作业上 ≥{k} 份匿名的已评分提交构建。不显示任何学生的成绩或身份——仅显示汇总的失分模式。',
    'यह मानचित्र उसी असाइनमेंट पर ≥{k} अनाम, ग्रेडेड सबमिशन से बना है। किसी छात्र का ग्रेड या पहचान नहीं दिखती — केवल समग्र हानि-पैटर्न।',
    'El mapa se construye con ≥{k} entregas calificadas y anónimas del mismo encargo. No se muestra la nota ni la identidad de ningún estudiante — solo patrones agregados de pérdida.',
    'La carte est construite à partir de ≥{k} rendus notés et anonymisés sur le même sujet. Aucune note ni identité d’étudiant n’est montrée — seulement des motifs de perte agrégés.',
    'یہ نقشہ اسی اسائنمنٹ پر ≥{k} گمنام، نمبر شدہ جمعوں سے بنا ہے۔ کسی طالبعلم کا گریڈ یا شناخت ظاہر نہیں — صرف مجموعی نقصان کے پیٹرن۔',
  ),
  glHeadline: L(
    '{prob}% من الفوج السابق خسروا نقاطًا في «{title}»{reason}. عالجها قبل التسليم.',
    '{prob}% of the previous cohort lost points on "{title}"{reason}. Fix it before submitting.',
    'Önceki grubun %{prob}’i "{title}" ölçütünde puan kaybetti{reason}. Teslimden önce düzelt.',
    '上一届有 {prob}% 的人在「{title}」上失分{reason}。请在提交前处理。',
    'पिछली कक्षा के {prob}% ने "{title}" पर अंक खोए{reason}। जमा करने से पहले इसे ठीक करें।',
    'El {prob}% de la cohorte anterior perdió puntos en «{title}»{reason}. Corrígelo antes de entregar.',
    '{prob} % de la promotion précédente a perdu des points sur « {title} »{reason}. Corrigez-le avant de rendre.',
    'پچھلی جماعت کے {prob}% نے «{title}» میں نمبر کھوئے{reason}۔ جمع کرانے سے پہلے اسے درست کریں۔',
  ),
  glReasonSuffix: L(' — الأشيع: {reason}', ' — most common: {reason}', ' — en yaygını: {reason}', '——最常见：{reason}', ' — सबसे आम: {reason}', ' — lo más común: {reason}', ' — le plus fréquent : {reason}', ' — سب سے عام: {reason}'),
  glNoHighRisk: L(
    'لم يظهر معيار عالي الخطورة في بيانات الفوج الحالية.',
    'No high-risk criterion surfaced in the current cohort data.',
    'Mevcut grup verisinde yüksek riskli bir ölçüt görünmedi.',
    '在当前群体数据中未发现高风险标准。',
    'वर्तमान कक्षा-डेटा में कोई उच्च-जोखिम मानदंड नहीं दिखा।',
    'No apareció ningún criterio de alto riesgo en los datos actuales de la cohorte.',
    'Aucun critère à haut risque n’est apparu dans les données actuelles de la promotion.',
    'موجودہ جماعتی ڈیٹا میں کوئی زیادہ خطرے والا معیار سامنے نہیں آیا۔',
  ),
  glReasonSources: L('ضعف المصادر أو الاستشهاد', 'Weak sources or citations', 'Zayıf kaynak veya atıf', '来源或引用薄弱', 'कमज़ोर स्रोत या उद्धरण', 'Fuentes o citas débiles', 'Sources ou citations faibles', 'کمزور مآخذ یا حوالے'),
  glReasonDepth: L('تحليل سطحي لا يكفي المطلوب', 'Shallow analysis below what was required', 'Gerekenin altında yüzeysel analiz', '分析浅显，未达要求', 'आवश्यकता से कम सतही विश्लेषण', 'Análisis superficial por debajo de lo requerido', 'Analyse superficielle en deçà des attentes', 'مطلوبہ سے کم سطحی تجزیہ'),
  glReasonStructure: L('ضعف بنية العمل وتنظيمه', 'Weak structure and organization', 'Zayıf yapı ve düzen', '结构与组织薄弱', 'कमज़ोर संरचना व संगठन', 'Estructura y organización débiles', 'Structure et organisation faibles', 'کمزور ساخت اور تنظیم'),
  glReasonEvidence: L('أدلة غير كافية على الادعاءات', 'Insufficient evidence for claims', 'İddialar için yetersiz kanıt', '论点缺乏足够证据', 'दावों के लिए अपर्याप्त प्रमाण', 'Evidencia insuficiente para las afirmaciones', 'Preuves insuffisantes pour les affirmations', 'دعووں کے لیے ناکافی شواہد'),
  glReasonLanguage: L('مشكلات لغوية/صياغة', 'Language / wording issues', 'Dil / ifade sorunları', '语言/表述问题', 'भाषा/शब्दावली समस्याएँ', 'Problemas de lenguaje / redacción', 'Problèmes de langue / formulation', 'زبان/عبارت کے مسائل'),
  glReasonMissing: L('متطلب مفقود أو غير مكتمل', 'Missing or incomplete requirement', 'Eksik veya tamamlanmamış gereksinim', '要求缺失或不完整', 'अनुपस्थित या अधूरी आवश्यकता', 'Requisito faltante o incompleto', 'Exigence manquante ou incomplète', 'غائب یا نامکمل تقاضا'),
  // ---- Reverse Assessment ----
  raNoteShort: L('سؤال قصير جدًا — وسّعه ليقيس فهمًا حقيقيًا.', 'Question is too short — expand it to test real understanding.', 'Soru çok kısa — gerçek anlamayı ölçecek şekilde genişlet.', '问题太短——扩展它以检验真正的理解。', 'प्रश्न बहुत छोटा — इसे वास्तविक समझ जाँचने के लिए बढ़ाएँ।', 'La pregunta es muy corta — amplíala para medir comprensión real.', 'Question trop courte — développez-la pour tester une vraie compréhension.', 'سوال بہت مختصر — اسے حقیقی فہم جانچنے کے لیے بڑھائیں۔'),
  raNoteNoModel: L('بلا إجابة نموذجية — أضفها لتثبت أنك تعرف الجواب.', 'No model answer — add one to prove you know the answer.', 'Model cevap yok — bildiğini kanıtlamak için ekle.', '没有参考答案——添加一个以证明你知道答案。', 'कोई आदर्श उत्तर नहीं — यह साबित करने के लिए जोड़ें कि आप उत्तर जानते हैं।', 'Sin respuesta modelo — añádela para demostrar que sabes la respuesta.', 'Pas de réponse type — ajoutez-en une pour prouver que vous savez répondre.', 'کوئی نمونہ جواب نہیں — یہ ثابت کرنے کے لیے شامل کریں کہ آپ جواب جانتے ہیں۔'),
  raNoteLowBloom: L('مستوى إدراكي منخفض (تذكّر/فهم) — ارفعه إلى تحليل/تقويم/إبداع.', 'Low cognitive level (recall/understand) — raise it to analyze/evaluate/create.', 'Düşük bilişsel düzey (hatırlama/anlama) — analiz/değerlendirme/yaratmaya yükselt.', '认知层次偏低（记忆/理解）——提升到分析/评价/创造。', 'निम्न संज्ञानात्मक स्तर (स्मरण/समझ) — इसे विश्लेषण/मूल्यांकन/सृजन तक बढ़ाएँ।', 'Nivel cognitivo bajo (recordar/entender) — súbelo a analizar/evaluar/crear.', 'Niveau cognitif faible (mémoriser/comprendre) — élevez-le à analyser/évaluer/créer.', 'کم ادراکی سطح (یاد/سمجھ) — اسے تجزیہ/تقویم/تخلیق تک بڑھائیں۔'),
  raNoteNoLink: L('لا يبدو مرتبطًا بمخرج تعلم للمشروع.', 'Does not appear linked to a project learning outcome.', 'Bir proje öğrenme kazanımına bağlı görünmüyor.', '似乎未与项目学习成果关联。', 'किसी प्रोजेक्ट लर्निंग-आउटकम से जुड़ा नहीं लगता।', 'No parece vinculado a un resultado de aprendizaje del proyecto.', 'Ne semble pas lié à un acquis d’apprentissage du projet.', 'کسی پروجیکٹ لرننگ آؤٹ کم سے جڑا نہیں لگتا۔'),
  raPolTitle: L('صياغة امتحان عن: {title}', 'Exam design about: {title}', 'Sınav tasarımı: {title}', '关于「{title}」的试题设计', '"{title}" पर परीक्षा-रचना', 'Diseño de examen sobre: {title}', 'Conception d’examen sur : {title}', '«{title}» پر امتحان کی تشکیل'),
  raPolSummary: L(
    'صمّم الطالب {n} سؤالًا بمتوسط مستوى بلوم {bloom}/6 وتغطية {coverage}% لمخرجات المشروع. القدرة على توليد أسئلة عالية المستوى دليل إتقان مستقل عن الإجابة.',
    'The student designed {n} questions at an average Bloom level of {bloom}/6 and {coverage}% coverage of project outcomes. Generating high-level questions is a mastery signal independent of answering.',
    'Öğrenci ortalama Bloom düzeyi {bloom}/6 ve proje kazanımlarının %{coverage} kapsamıyla {n} soru tasarladı. Üst düzey soru üretmek, cevaplamadan bağımsız bir ustalık işaretidir.',
    '学生设计了 {n} 道题，平均布鲁姆层次 {bloom}/6，覆盖项目成果 {coverage}%。能生成高层次问题是一种独立于作答的掌握信号。',
    'छात्र ने औसत ब्लूम स्तर {bloom}/6 और परियोजना-परिणामों की {coverage}% कवरेज के साथ {n} प्रश्न रचे। उच्च-स्तरीय प्रश्न बनाना उत्तर देने से स्वतंत्र निपुणता-संकेत है।',
    'El estudiante diseñó {n} preguntas con un nivel Bloom medio de {bloom}/6 y {coverage}% de cobertura de los resultados del proyecto. Generar preguntas de alto nivel es una señal de dominio independiente de responder.',
    'L’étudiant a conçu {n} questions à un niveau de Bloom moyen de {bloom}/6 et {coverage} % de couverture des acquis du projet. Générer des questions de haut niveau est un signe de maîtrise indépendant de la réponse.',
    'طالبعلم نے اوسط بلوم سطح {bloom}/6 اور پروجیکٹ نتائج کی {coverage}% کوریج کے ساتھ {n} سوالات بنائے۔ اعلیٰ سطح کے سوالات بنانا جواب دینے سے آزاد مہارت کی علامت ہے۔',
  ),
  raNote: L(
    'درجة صانع الامتحان مؤشر إتقان تكويني حتمي مشتق من بنية أسئلة الطالب فقط؛ لا تستبدل تقويم الأستاذ ولا تُعدّل درجة رسمية، لكنها تدخل Proof of Learning كدليل عملية أصيل.',
    'The exam-maker score is a deterministic formative mastery signal derived only from the structure of the student’s questions; it does not replace the instructor’s assessment or change any official grade, but it enters Proof of Learning as a genuine process record.',
    'Sınav-yapıcı puanı yalnızca öğrencinin soru yapısından türeyen deterministik biçimlendirici bir ustalık işaretidir; öğretim elemanının değerlendirmesinin yerine geçmez ve resmi notu değiştirmez, ancak gerçek bir süreç kanıtı olarak Proof of Learning’e girer.',
    '出题者得分是仅由学生问题结构推导出的确定性形成性掌握信号；它不替代教师评估，也不改变任何正式成绩，但作为真实的过程记录进入学习证明。',
    'परीक्षा-निर्माता स्कोर केवल छात्र के प्रश्नों की संरचना से व्युत्पन्न एक नियतात्मक रचनात्मक निपुणता-संकेत है; यह शिक्षक के मूल्यांकन का स्थान नहीं लेता और न किसी आधिकारिक ग्रेड को बदलता है, पर यह एक वास्तविक प्रक्रिया-रिकॉर्ड के रूप में Proof of Learning में जुड़ता है।',
    'La puntuación de creador de examen es una señal formativa determinista de dominio derivada solo de la estructura de las preguntas del estudiante; no reemplaza la evaluación del docente ni cambia ninguna nota oficial, pero entra en Proof of Learning como un registro de proceso genuino.',
    'Le score de créateur d’examen est un signal formatif déterministe de maîtrise dérivé uniquement de la structure des questions de l’étudiant ; il ne remplace pas l’évaluation de l’enseignant ni ne modifie une note officielle, mais il entre dans Proof of Learning comme un véritable relevé de processus.',
    'امتحان ساز اسکور صرف طالبعلم کے سوالات کی ساخت سے اخذ کردہ ایک متعین تشکیلی مہارت علامت ہے؛ یہ استاد کے جائزے کی جگہ نہیں لیتا اور نہ کسی سرکاری گریڈ کو بدلتا ہے، مگر یہ ایک حقیقی عمل ریکارڈ کے طور پر Proof of Learning میں شامل ہوتا ہے۔',
  ),
  raBrief: L(
    'صمّم امتحانًا قصيرًا (4–6 أسئلة) يقيس فهم مشروعك. لكل سؤال: صِغه بفعل تحليل/تقويم/تصميم، اربطه بمخرج تعلم، واكتب إجابة نموذجية موجزة. الأسئلة السطحية (اذكر/عرّف) تخفض درجتك.',
    'Design a short exam (4–6 questions) that tests understanding of your project. For each question: phrase it with an analyze/evaluate/design verb, link it to a learning outcome, and write a brief model answer. Shallow questions (list/define) lower your score.',
    'Projeni anlamayı ölçen kısa bir sınav (4–6 soru) tasarla. Her soru için: analiz/değerlendirme/tasarım fiiliyle ifade et, bir öğrenme kazanımına bağla ve kısa bir model cevap yaz. Yüzeysel sorular (say/tanımla) puanını düşürür.',
    '设计一份简短的考试（4–6 题）来检验对你项目的理解。每题：用分析/评价/设计类动词表述，关联一个学习成果，并写一段简短的参考答案。浅显问题（列举/定义）会降低你的得分。',
    'एक छोटी परीक्षा (4–6 प्रश्न) रचें जो आपके प्रोजेक्ट की समझ जाँचे। हर प्रश्न के लिए: विश्लेषण/मूल्यांकन/डिज़ाइन क्रिया से बनाएँ, किसी लर्निंग-आउटकम से जोड़ें, और एक संक्षिप्त आदर्श उत्तर लिखें। सतही प्रश्न (सूची/परिभाषा) आपका स्कोर घटाते हैं।',
    'Diseña un examen breve (4–6 preguntas) que evalúe la comprensión de tu proyecto. Para cada pregunta: redáctala con un verbo de analizar/evaluar/diseñar, vincúlala a un resultado de aprendizaje y escribe una respuesta modelo breve. Las preguntas superficiales (enumerar/definir) bajan tu puntuación.',
    'Concevez un court examen (4 à 6 questions) qui teste la compréhension de votre projet. Pour chaque question : formulez-la avec un verbe analyser/évaluer/concevoir, reliez-la à un acquis d’apprentissage et rédigez une brève réponse type. Les questions superficielles (énumérer/définir) baissent votre score.',
    'ایک مختصر امتحان (4–6 سوالات) تیار کریں جو آپ کے پروجیکٹ کی سمجھ جانچے۔ ہر سوال کے لیے: تجزیہ/تقویم/ڈیزائن فعل سے بنائیں، کسی لرننگ آؤٹ کم سے جوڑیں، اور مختصر نمونہ جواب لکھیں۔ سطحی سوالات (گنیں/تعریف) آپ کا اسکور کم کرتے ہیں۔',
  ),
} as const;

export function tA(text: LocalizedText, locale: ServerLocale): string { return tx(text, locale); }
export function tAf(text: LocalizedText, locale: ServerLocale, vars: Record<string, string | number>): string { return txf(text, locale, vars); }
export function bloomLabelFor(level: number, locale: ServerLocale): string { return tx(BLOOM_LABELS[level] || BLOOM_LABELS[1], locale); }

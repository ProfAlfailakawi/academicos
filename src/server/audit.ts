import { randomUUID } from "node:crypto";
import { runStyleIntegrityAnalysis } from "./deep-ai-detector";
import type {
  AuditCheck,
  ProjectDNA,
  ProjectEvidence,
  SubmissionAudit,
  WorkspaceArtifact,
} from "../types";
import { L, joinList, resolveServerLocale, tx, txf, type ServerLocale } from "./server-locale";

// The submission audit is the last thing a learner reads before handing work in,
// so every check label, detail and action follows the project language.
const A = {
  deliverableLabel: L("المخرج: {title}", "Deliverable: {title}", "Çıktı: {title}", "交付物：{title}", "डिलिवरेबल: {title}", "Entregable: {title}", "Livrable : {title}", "مخرج: {title}"),
  deliverableNotReady: L("{title} غير جاهز. الصيغة المطلوبة: {format}.", "{title} is not ready. Required format: {format}.", "{title} hazır değil. Gerekli biçim: {format}.", "{title} 尚未就绪。要求格式：{format}。", "{title} तैयार नहीं है। आवश्यक प्रारूप: {format}।", "{title} no está listo. Formato requerido: {format}.", "{title} n'est pas prêt. Format requis : {format}.", "{title} تیار نہیں۔ مطلوبہ فارمیٹ: {format}۔"),
  deliverableLinked: L("جاهز ومرتبط بملف أو عنصر عمل محفوظ ({format}).", "Ready and linked to a saved file or work item ({format}).", "Hazır ve kayıtlı bir dosya veya iş öğesine bağlı ({format}).", "已就绪并关联到已保存的文件或工作项（{format}）。", "तैयार है और सहेजी गई फ़ाइल या वर्क आइटम से जुड़ा है ({format})।", "Listo y vinculado a un archivo o elemento de trabajo guardado ({format}).", "Prêt et relié à un fichier ou élément de travail enregistré ({format}).", "تیار ہے اور محفوظ فائل یا ورک آئٹم سے منسلک ہے ({format})۔"),
  deliverableUnlinked: L("وُضع كجاهز لكن لا يوجد ملف أو عنصر عمل مرتبط به؛ اربطه قبل التسليم.", "Marked ready but no file or work item is linked to it; link one before submitting.", "Hazır işaretlendi ama bağlı dosya veya iş öğesi yok; teslimden önce bağlayın.", "已标记为就绪，但未关联任何文件或工作项；提交前请关联。", "तैयार चिह्नित है पर कोई फ़ाइल या वर्क आइटम जुड़ा नहीं; जमा करने से पहले जोड़ें।", "Marcado como listo pero sin archivo ni elemento de trabajo vinculado; vincula uno antes de entregar.", "Marqué prêt mais aucun fichier ni élément de travail n'y est relié ; reliez-en un avant de rendre.", "تیار نشان زد ہے مگر کوئی فائل یا ورک آئٹم منسلک نہیں؛ جمع سے پہلے جوڑیں۔"),
  deliverableAction: L("افتح تبويب المخرجات ثم اربط عنصر Workspace أو ملفًا بالمخرج.", "Open the Deliverables tab and link a workspace item or a file to it.", "Çıktılar sekmesini açıp bir çalışma öğesi veya dosya bağlayın.", "打开“交付物”标签，将工作区条目或文件关联到该交付物。", "डिलिवरेबल्स टैब खोलें और उसमें वर्कस्पेस आइटम या फ़ाइल जोड़ें।", "Abre la pestaña de entregables y vincula un elemento del espacio de trabajo o un archivo.", "Ouvrez l'onglet Livrables et reliez-y un élément de l'espace de travail ou un fichier.", "ڈیلیوریبلز ٹیب کھولیں اور اس سے ورک اسپیس آئٹم یا فائل جوڑیں۔"),
  rulesLabel: L("قواعد {title}", "Validation rules: {title}", "Doğrulama kuralları: {title}", "校验规则：{title}", "सत्यापन नियम: {title}", "Reglas de validación: {title}", "Règles de validation : {title}", "توثیقی قواعد: {title}"),
  rulesDetail: L("توجد {count} قواعد تحقق يجب تأكيدها على الملف النهائي: {rules}.", "There are {count} validation rules to confirm on the final file: {rules}.", "Nihai dosyada doğrulanacak {count} kural var: {rules}.", "最终文件需确认 {count} 条校验规则：{rules}。", "अंतिम फ़ाइल पर पुष्टि हेतु {count} सत्यापन नियम हैं: {rules}।", "Hay {count} reglas de validación que confirmar en el archivo final: {rules}.", "Il y a {count} règles de validation à confirmer sur le fichier final : {rules}.", "حتمی فائل پر تصدیق کے لیے {count} قواعد ہیں: {rules}۔"),
  rulesAction: L("افتح الملف النهائي وراجع قواعد الحجم والصيغة والتسمية.", "Open the final file and check the size, format and naming rules.", "Nihai dosyayı açıp boyut, biçim ve adlandırma kurallarını kontrol edin.", "打开最终文件，检查大小、格式与命名规则。", "अंतिम फ़ाइल खोलें और आकार, प्रारूप व नामकरण नियम जाँचें।", "Abre el archivo final y revisa las reglas de tamaño, formato y nomenclatura.", "Ouvrez le fichier final et vérifiez les règles de taille, de format et de nommage.", "حتمی فائل کھولیں اور سائز، فارمیٹ اور نام کے قواعد دیکھیں۔"),
  requirementsLabel: L("اكتمال المتطلبات", "Requirement completeness", "Gereksinim eksiksizliği", "需求完整性", "आवश्यकताओं की पूर्णता", "Integridad de los requisitos", "Complétude des exigences", "تقاضوں کی تکمیل"),
  requirementsUncertain: L("{count} متطلبات ما زالت غير مؤكدة: {items}.", "{count} requirements are still unconfirmed: {items}.", "{count} gereksinim hâlâ doğrulanmadı: {items}.", "仍有 {count} 项要求未确认：{items}。", "{count} आवश्यकताएँ अब भी अपुष्ट हैं: {items}।", "{count} requisitos siguen sin confirmar: {items}.", "{count} exigences ne sont toujours pas confirmées : {items}.", "{count} تقاضے تاحال غیر مصدقہ ہیں: {items}۔"),
  requirementsOk: L("كل المتطلبات المسجلة ذات ثقة محددة.", "Every recorded requirement has a defined confidence level.", "Kayıtlı her gereksinimin tanımlı bir güven düzeyi var.", "所有已记录的要求都有明确的置信度。", "हर दर्ज आवश्यकता का निश्चित विश्वास-स्तर है।", "Todos los requisitos registrados tienen un nivel de confianza definido.", "Chaque exigence enregistrée a un niveau de confiance défini.", "ہر درج تقاضے کا اعتماد درجہ متعین ہے۔"),
  requirementsAction: L("قارنها بالتكليف المنشور أو اطلب تأكيد الأستاذ.", "Compare them with the published assignment or ask your instructor to confirm.", "Bunları yayımlanan ödevle karşılaştırın veya öğretim elemanınızdan doğrulama isteyin.", "与已发布的作业说明对照，或请老师确认。", "इन्हें प्रकाशित असाइनमेंट से मिलाएँ या शिक्षक से पुष्टि माँगें।", "Compáralos con el enunciado publicado o pide confirmación a tu docente.", "Comparez-les à l'énoncé publié ou demandez confirmation à votre enseignant.", "انہیں شائع شدہ اسائنمنٹ سے ملائیں یا استاد سے تصدیق لیں۔"),
  rubricCoverageLabel: L("تغطية Rubric بالأدلة", "Rubric coverage by evidence", "Kanıtla rubrik kapsamı", "评分标准的证据覆盖", "प्रमाण द्वारा रूब्रिक कवरेज", "Cobertura de la rúbrica con evidencia", "Couverture de la grille par les preuves", "شواہد کے ذریعے روبرک کوریج"),
  rubricCoverageDetail: L("{covered}/{total} معايير مغطاة بدليل مرتبط{extra}.", "{covered}/{total} criteria are covered by linked evidence{extra}.", "{total} ölçütten {covered} tanesi bağlı kanıtla kapsanıyor{extra}.", "{total} 条标准中有 {covered} 条有关联证据支撑{extra}。", "{total} में से {covered} मानदंड संलग्न प्रमाण से आच्छादित हैं{extra}।", "{covered}/{total} criterios están cubiertos por evidencia vinculada{extra}.", "{covered}/{total} critères sont couverts par des preuves reliées{extra}.", "{total} میں سے {covered} معیار منسلک شواہد سے پورے ہیں{extra}۔"),
  rubricSelfMarked: L("؛ {count} موسومة كمغطاة دون رابط دليل", "; {count} are marked covered without a linked evidence item", "; {count} tanesi kanıt bağlantısı olmadan kapsanmış işaretli", "；其中 {count} 条被标为已覆盖但无证据关联", "; {count} बिना प्रमाण-लिंक के आच्छादित चिह्नित हैं", "; {count} están marcados como cubiertos sin evidencia vinculada", "; {count} sont marqués couverts sans preuve reliée", "؛ {count} بغیر شہادت کے پورے نشان زد ہیں"),
  rubricCoverageAction: L("اربط Evidence أو عنصر Workspace جاهزًا بكل معيار.", "Link a piece of evidence or a ready workspace item to every criterion.", "Her ölçüte bir kanıt ya da hazır bir çalışma öğesi bağlayın.", "为每条标准关联一项证据或一个已就绪的工作区条目。", "हर मानदंड से एक प्रमाण या तैयार वर्कस्पेस आइटम जोड़ें।", "Vincula una evidencia o un elemento del espacio de trabajo listo a cada criterio.", "Reliez une preuve ou un élément de l'espace de travail prêt à chaque critère.", "ہر معیار سے ایک شہادت یا تیار ورک اسپیس آئٹم جوڑیں۔"),
  rubricMissingLabel: L("Rubric", "Rubric", "Rubrik", "评分标准", "रूब्रिक", "Rúbrica", "Grille d'évaluation", "روبرک"),
  rubricMissingDetail: L("لم يُستخرج Rubric. قد يكون في ملف منفصل؛ تأكد قبل التسليم.", "No rubric was extracted. It may live in a separate file; confirm it before submitting.", "Rubrik çıkarılamadı. Ayrı bir dosyada olabilir; teslimden önce doğrulayın.", "未提取到评分标准。它可能在单独的文件中；提交前请确认。", "कोई रूब्रिक नहीं निकाला गया। वह अलग फ़ाइल में हो सकता है; जमा करने से पहले पुष्टि करें।", "No se extrajo ninguna rúbrica. Puede estar en un archivo aparte; confírmalo antes de entregar.", "Aucune grille n'a été extraite. Elle peut se trouver dans un fichier séparé ; vérifiez avant de rendre.", "کوئی روبرک اخذ نہیں ہوا۔ ممکن ہے الگ فائل میں ہو؛ جمع سے پہلے تصدیق کریں۔"),
  rubricMissingAction: L("أضف ملف Rubric أو اربط المشروع بالتكليف المنشور.", "Add the rubric file or link the project to the published assignment.", "Rubrik dosyasını ekleyin veya projeyi yayımlanan ödeve bağlayın.", "上传评分标准文件，或将项目关联到已发布的作业。", "रूब्रिक फ़ाइल जोड़ें या प्रोजेक्ट को प्रकाशित असाइनमेंट से जोड़ें।", "Añade el archivo de la rúbrica o vincula el proyecto al enunciado publicado.", "Ajoutez le fichier de la grille ou reliez le projet à l'énoncé publié.", "روبرک فائل شامل کریں یا پروجیکٹ کو شائع شدہ اسائنمنٹ سے جوڑیں۔"),
  sourcesLabel: L("المصادر والاستشهادات", "Sources and citations", "Kaynaklar ve atıflar", "来源与引用", "स्रोत और उद्धरण", "Fuentes y citas", "Sources et citations", "مآخذ اور حوالے"),
  sourcesDetail: L("المطلوب {required}؛ المصادر المتحققة المرتبطة {found}.", "Required: {required}; linked verified sources: {found}.", "Gereken: {required}; bağlı doğrulanmış kaynak: {found}.", "要求：{required}；已关联的已核实来源：{found}。", "आवश्यक: {required}; संलग्न सत्यापित स्रोत: {found}।", "Requeridas: {required}; fuentes verificadas vinculadas: {found}.", "Requis : {required} ; sources vérifiées reliées : {found}.", "درکار: {required}؛ منسلک تصدیق شدہ مآخذ: {found}۔"),
  sourcesUnspecified: L("عدد غير محدد", "an unspecified number", "belirtilmemiş sayı", "数量未指定", "अनिर्दिष्ट संख्या", "un número no especificado", "un nombre non précisé", "غیر متعین تعداد"),
  sourcesAction: L("أضف المصادر إلى Evidence Studio واربطها بالمخرجات أو Rubric.", "Add the sources in Evidence Studio and link them to deliverables or rubric criteria.", "Kaynakları Evidence Studio'ya ekleyip çıktılara veya rubrik ölçütlerine bağlayın.", "在证据工作室中添加来源，并关联到交付物或评分标准。", "एविडेंस स्टूडियो में स्रोत जोड़ें और उन्हें डिलिवरेबल्स या रूब्रिक से जोड़ें।", "Añade las fuentes en Evidence Studio y vincúlalas a entregables o criterios.", "Ajoutez les sources dans Evidence Studio et reliez-les aux livrables ou aux critères.", "ایویڈنس اسٹوڈیو میں مآخذ شامل کریں اور انہیں مخرجات یا روبرک سے جوڑیں۔"),
  policyLabel: L("سياسة استخدام AI", "AI use policy", "Yapay zeka kullanım politikası", "AI 使用政策", "AI उपयोग नीति", "Política de uso de IA", "Politique d'usage de l'IA", "AI استعمال کی پالیسی"),
  policyUnconfirmed: L("السياسة غير مؤكدة من تكليف منشور؛ لا يمكن اعتبار الاستخدام متوافقًا نهائيًا.", "The policy is not confirmed by a published assignment, so use cannot be treated as definitively compliant.", "Politika yayımlanmış bir ödevle doğrulanmadı; kullanım kesin uyumlu sayılamaz.", "该政策未经已发布作业确认，因此不能视为完全合规。", "नीति किसी प्रकाशित असाइनमेंट से पुष्ट नहीं है; इसलिए उपयोग को निश्चित रूप से अनुपालक नहीं माना जा सकता।", "La política no está confirmada por un enunciado publicado, así que el uso no puede considerarse definitivamente conforme.", "La politique n'est pas confirmée par un énoncé publié ; l'usage ne peut donc être considéré comme définitivement conforme.", "پالیسی کسی شائع شدہ اسائنمنٹ سے مصدقہ نہیں؛ اس لیے استعمال کو حتمی طور پر مطابق نہیں مانا جا سکتا۔"),
  policyAction: L("اربط المشروع بتكليف CourseOS منشور.", "Link the project to a published CourseOS assignment.", "Projeyi yayımlanmış bir CourseOS ödevine bağlayın.", "将项目关联到已发布的 CourseOS 作业。", "प्रोजेक्ट को प्रकाशित CourseOS असाइनमेंट से जोड़ें।", "Vincula el proyecto a un enunciado publicado de CourseOS.", "Reliez le projet à un énoncé CourseOS publié.", "پروجیکٹ کو شائع شدہ CourseOS اسائنمنٹ سے جوڑیں۔"),
  disclosureLabel: L("إقرار استخدام AI", "AI use disclosure", "Yapay zeka kullanım beyanı", "AI 使用声明", "AI उपयोग प्रकटीकरण", "Declaración de uso de IA", "Déclaration d'usage de l'IA", "AI استعمال کا اعلان"),
  disclosurePresent: L("ظهر إقرار أو ذكر لاستخدام AI في عناصر العمل. راجع الصياغة النهائية.", "A disclosure or mention of AI use appears in the work items. Review the final wording.", "Çalışma öğelerinde yapay zeka kullanımına dair bir beyan görünüyor. Nihai ifadeyi gözden geçirin.", "工作项中出现了关于使用 AI 的声明或提及。请复核最终措辞。", "वर्क आइटम्स में AI उपयोग का उल्लेख/प्रकटीकरण दिखा। अंतिम शब्दावली जाँचें।", "Aparece una declaración o mención del uso de IA en los elementos de trabajo. Revisa la redacción final.", "Une déclaration ou mention d'usage de l'IA apparaît dans les éléments de travail. Relisez la formulation finale.", "ورک آئٹمز میں AI استعمال کا اعلان یا ذکر ملا۔ حتمی الفاظ دیکھیں۔"),
  disclosureMissing: L("السياسة تتطلب إفصاحًا ولم يظهر إقرار في عناصر العمل الحالية.", "The policy requires a disclosure and none appears in the current work items.", "Politika beyan gerektiriyor ancak mevcut çalışma öğelerinde beyan yok.", "政策要求进行声明，但当前工作项中没有出现声明。", "नीति प्रकटीकरण माँगती है, पर मौजूदा वर्क आइटम्स में कोई नहीं मिला।", "La política exige una declaración y no aparece ninguna en los elementos actuales.", "La politique exige une déclaration, absente des éléments de travail actuels.", "پالیسی اعلان طلب کرتی ہے مگر موجودہ ورک آئٹمز میں کوئی نہیں۔"),
  disclosureAction: L("أضف إقرار الاستخدام المطلوب إلى المخرج النهائي.", "Add the required use disclosure to the final deliverable.", "Gerekli kullanım beyanını nihai çıktıya ekleyin.", "在最终交付物中加入所需的使用声明。", "अंतिम डिलिवरेबल में अपेक्षित उपयोग-प्रकटीकरण जोड़ें।", "Añade la declaración de uso requerida al entregable final.", "Ajoutez la déclaration d'usage requise au livrable final.", "حتمی مخرج میں مطلوبہ استعمال کا اعلان شامل کریں۔"),
  integrityLabel: L("فاحص الأسلوب والنزاهة", "Style and integrity review", "Üslup ve dürüstlük incelemesi", "文风与学术诚信审查", "शैली और सत्यनिष्ठा समीक्षा", "Revisión de estilo e integridad", "Revue de style et d'intégrité", "اسلوب اور دیانت کا جائزہ"),
  integrityNeedsReview: L("مؤشر مراجعة الأسلوب {score}/100 (ليس احتمال AI). توجد {citations} إشارات مراجع تحتاج تحقق و{claims} ادعاءات كمية تحتاج سنداً.", "Style-review index {score}/100 (not an AI probability). {citations} citation signals need verification and {claims} quantitative claims need support.", "Üslup inceleme göstergesi {score}/100 (yapay zeka olasılığı değildir). {citations} atıf işareti doğrulanmalı, {claims} sayısal iddia desteklenmeli.", "文风审查指数 {score}/100（并非 AI 概率）。{citations} 处引用信号需核验，{claims} 处数量主张需佐证。", "शैली-समीक्षा सूचकांक {score}/100 (यह AI संभावना नहीं है)। {citations} उद्धरण संकेतों की जाँच और {claims} संख्यात्मक दावों को समर्थन चाहिए।", "Índice de revisión de estilo {score}/100 (no es una probabilidad de IA). {citations} señales de citas requieren verificación y {claims} afirmaciones cuantitativas necesitan respaldo.", "Indice de revue de style {score}/100 (ce n'est pas une probabilité d'IA). {citations} signaux de citation à vérifier et {claims} affirmations quantitatives à étayer.", "اسلوب جائزہ اشاریہ {score}/100 (یہ AI امکان نہیں)۔ {citations} حوالہ اشارے تصدیق طلب اور {claims} عددی دعوے سند طلب ہیں۔"),
  integrityClear: L("لم تظهر إشارات أسلوب أو أدلة بارزة ضمن الفحص الحالي. هذا لا يثبت هوية الكاتب ولا يحل محل مراجعة المصادر وسياسة المقرر.", "No notable style or evidence signals surfaced in this review. This does not establish who wrote the text, and it does not replace source checks or the course policy.", "Bu incelemede belirgin üslup veya kanıt işareti çıkmadı. Bu, metni kimin yazdığını kanıtlamaz ve kaynak denetimi ile ders politikasının yerini tutmaz.", "本次审查未发现显著的文风或证据信号。这不能证明文本作者身份，也不能替代来源核查与课程政策。", "इस समीक्षा में कोई उल्लेखनीय शैली या प्रमाण संकेत नहीं मिला। यह लेखक की पहचान सिद्ध नहीं करता और न ही स्रोत-जाँच या पाठ्यक्रम नीति का विकल्प है।", "No surgieron señales notables de estilo o evidencia en esta revisión. Esto no determina quién escribió el texto ni sustituye la verificación de fuentes ni la política del curso.", "Aucun signal marquant de style ou de preuve n'est apparu dans cette revue. Cela n'établit pas qui a écrit le texte et ne remplace ni la vérification des sources ni la politique du cours.", "اس جائزے میں کوئی نمایاں اسلوبی یا شہادتی اشارہ نہیں ملا۔ یہ مصنف کی شناخت ثابت نہیں کرتا اور نہ مآخذ کی جانچ یا کورس پالیسی کا متبادل ہے۔"),
  integrityAction: L("افتح فاحص الأسلوب والنزاهة وراجع الادعاءات والمراجع والصياغات المشار إليها؛ لا تستخدم النتيجة للحكم على من كتب النص.", "Open the style and integrity review and check the flagged claims, citations and phrasings; never use the result to judge who wrote the text.", "Üslup ve dürüstlük incelemesini açıp işaretlenen iddiaları, atıfları ve ifadeleri kontrol edin; sonucu metni kimin yazdığına karar vermek için kullanmayın.", "打开文风与诚信审查，检查被标记的主张、引用与措辞；切勿据此判断作者是谁。", "शैली और सत्यनिष्ठा समीक्षा खोलें और चिह्नित दावे, उद्धरण व वाक्यांश जाँचें; परिणाम से लेखक का निर्णय न करें।", "Abre la revisión de estilo e integridad y comprueba las afirmaciones, citas y expresiones señaladas; no uses el resultado para juzgar la autoría.", "Ouvrez la revue de style et d'intégrité et vérifiez les affirmations, citations et formulations signalées ; n'utilisez jamais le résultat pour juger de l'auteur.", "اسلوب و دیانت کا جائزہ کھولیں اور نشان زد دعوے، حوالے اور جملے دیکھیں؛ نتیجے سے مصنف کا فیصلہ نہ کریں۔"),
  deadlineLabel: L("الموعد النهائي", "Deadline", "Teslim tarihi", "截止日期", "समय-सीमा", "Fecha límite", "Échéance", "آخری تاریخ"),
  deadlinePassed: L("الموعد تجاوز الوقت المسجل: {deadline}", "The recorded deadline has passed: {deadline}", "Kayıtlı teslim tarihi geçti: {deadline}", "已超过记录的截止时间：{deadline}", "दर्ज समय-सीमा बीत चुकी है: {deadline}", "La fecha límite registrada ya pasó: {deadline}", "L'échéance enregistrée est dépassée : {deadline}", "درج آخری تاریخ گزر چکی: {deadline}"),
  deadlineUpcoming: L("الموعد المسجل: {deadline}", "Recorded deadline: {deadline}", "Kayıtlı teslim tarihi: {deadline}", "记录的截止时间：{deadline}", "दर्ज समय-सीमा: {deadline}", "Fecha límite registrada: {deadline}", "Échéance enregistrée : {deadline}", "درج آخری تاریخ: {deadline}"),
  deadlineInvalid: L("صيغة الموعد تحتاج مراجعة.", "The deadline format needs review.", "Teslim tarihi biçimi gözden geçirilmeli.", "截止日期格式需要检查。", "समय-सीमा का प्रारूप जाँचना होगा।", "El formato de la fecha límite necesita revisión.", "Le format de l'échéance doit être vérifié.", "آخری تاریخ کا فارمیٹ جانچنا ہوگا۔"),
  deadlineAction: L("تحقق من سياسة التسليم المتأخر قبل الإرسال.", "Check the late-submission policy before sending.", "Göndermeden önce geç teslim politikasını kontrol edin.", "提交前请查看逾期提交政策。", "भेजने से पहले विलंब-सबमिशन नीति देखें।", "Consulta la política de entregas tardías antes de enviar.", "Vérifiez la politique de retard avant d'envoyer.", "بھیجنے سے پہلے تاخیری جمع کی پالیسی دیکھیں۔"),
  provenanceLabel: L("سلامة المصدر", "Source integrity", "Kaynak bütünlüğü", "源文件完整性", "स्रोत अखंडता", "Integridad del origen", "Intégrité de la source", "ماخذ کی سالمیت"),
  provenanceHashed: L("{count} ملفات أصلية لها بصمة SHA-256 محفوظة.", "{count} original files have a stored SHA-256 fingerprint.", "{count} özgün dosyanın kayıtlı SHA-256 parmak izi var.", "{count} 个原始文件已保存 SHA-256 指纹。", "{count} मूल फ़ाइलों के SHA-256 फ़िंगरप्रिंट संग्रहीत हैं।", "{count} archivos originales tienen huella SHA-256 almacenada.", "{count} fichiers originaux ont une empreinte SHA-256 enregistrée.", "{count} اصل فائلوں کے SHA-256 نشان محفوظ ہیں۔"),
  provenanceNone: L("لا يوجد ملف أصلي محفوظ ببصمة للتحقق.", "No original file with a verification fingerprint is stored.", "Doğrulama parmak izi olan kayıtlı özgün dosya yok.", "没有保存带校验指纹的原始文件。", "सत्यापन फ़िंगरप्रिंट वाली कोई मूल फ़ाइल संग्रहीत नहीं है।", "No hay ningún archivo original almacenado con huella de verificación.", "Aucun fichier original avec empreinte de vérification n'est enregistré.", "تصدیقی نشان کے ساتھ کوئی اصل فائل محفوظ نہیں۔"),
  accessibilityLabel: L("قابلية الوصول للملف النهائي", "Accessibility of the final file", "Nihai dosyanın erişilebilirliği", "最终文件的无障碍性", "अंतिम फ़ाइल की सुगम्यता", "Accesibilidad del archivo final", "Accessibilité du fichier final", "حتمی فائل کی رسائی پذیری"),
  accessibilityDetail: L("لا يمكن إثبات العناوين البديلة وترتيب القراءة والتباين من حالة المشروع وحدها. يلزم فحص الملف النهائي.", "Alt text, reading order and contrast cannot be proven from the project state alone. The final file must be checked.", "Alternatif metin, okuma sırası ve kontrast yalnızca proje durumundan kanıtlanamaz. Nihai dosya denetlenmeli.", "仅凭项目状态无法证明替代文本、阅读顺序与对比度，必须检查最终文件。", "वैकल्पिक टेक्स्ट, पठन-क्रम और कंट्रास्ट केवल प्रोजेक्ट स्थिति से सिद्ध नहीं हो सकते। अंतिम फ़ाइल जाँचनी होगी।", "El texto alternativo, el orden de lectura y el contraste no pueden probarse solo con el estado del proyecto. Hay que revisar el archivo final.", "Le texte alternatif, l'ordre de lecture et le contraste ne peuvent être prouvés par le seul état du projet. Le fichier final doit être vérifié.", "متبادل متن، ترتیبِ قرات اور کنٹراسٹ صرف پروجیکٹ کی حالت سے ثابت نہیں ہو سکتے۔ حتمی فائل جانچنا ہوگی۔"),
  accessibilityAction: L("شغّل فحص الوصول على PDF/PPTX النهائي قبل التسليم.", "Run an accessibility check on the final PDF/PPTX before submitting.", "Teslimden önce nihai PDF/PPTX üzerinde erişilebilirlik denetimi çalıştırın.", "提交前对最终 PDF/PPTX 运行无障碍检查。", "जमा करने से पहले अंतिम PDF/PPTX पर एक्सेसिबिलिटी जाँच चलाएँ।", "Ejecuta una comprobación de accesibilidad en el PDF/PPTX final antes de entregar.", "Lancez une vérification d'accessibilité sur le PDF/PPTX final avant de rendre.", "جمع سے پہلے حتمی PDF/PPTX پر رسائی جانچ چلائیں۔"),
} as const;

export interface SubmissionAuditContext {
  artifacts?: WorkspaceArtifact[];
  evidence?: ProjectEvidence[];
  locale?: string;
}
const check = (input: Omit<AuditCheck, "id">): AuditCheck => ({
  id: randomUUID(),
  ...Object.fromEntries(Object.entries(input).filter(([,value])=>value!==undefined)),
}) as AuditCheck;

export function runSubmissionAudit(
  project: ProjectDNA,
  context: SubmissionAuditContext = {},
): SubmissionAudit {
  const locale: ServerLocale = resolveServerLocale(context.locale, project.language);
  const artifacts = (context.artifacts || []).filter((x) => !x.deletedAt),
    evidence = context.evidence || [],
    checks: AuditCheck[] = [];
  const linkedDeliverables = new Set([
    ...artifacts
      .filter((x) => x.status === "ready" && x.deliverableId)
      .map((x) => x.deliverableId!),
    ...evidence
      .map((x) => x.deliverableId)
      .filter((x): x is string => Boolean(x)),
  ]);
  const linkedRubric = new Set([
    ...artifacts
      .filter((x) => x.status === "ready")
      .flatMap((x) => x.rubricIds || []),
    ...evidence
      .filter((x) => x.verification !== "unverified")
      .flatMap((x) => x.rubricIds || []),
  ]);
  for (const deliverable of project.deliverables) {
    const marked =
        deliverable.status === "ready" || deliverable.status === "completed",
      linked =
        Boolean(deliverable.fileId) || linkedDeliverables.has(deliverable.id);
    checks.push(
      check({
        label: txf(A.deliverableLabel, locale, { title: deliverable.title }),
        status: !marked ? "critical" : linked ? "pass" : "warning",
        detail: !marked
          ? txf(A.deliverableNotReady, locale, { title: deliverable.title, format: deliverable.format })
          : linked
            ? txf(A.deliverableLinked, locale, { format: deliverable.format })
            : tx(A.deliverableUnlinked, locale),
        relatedDeliverableId: deliverable.id,
        category: "deliverable",
        action: tx(A.deliverableAction, locale),
      }),
    );
    if (deliverable.validationRules?.length)
      checks.push(
        check({
          label: txf(A.rulesLabel, locale, { title: deliverable.title }),
          status: marked ? "warning" : "critical",
          detail: txf(A.rulesDetail, locale, {
            count: deliverable.validationRules.length,
            rules: joinList(deliverable.validationRules.slice(0, 3), locale),
          }),
          relatedDeliverableId: deliverable.id,
          category: "format",
          action: tx(A.rulesAction, locale),
        }),
      );
  }
  const uncertain = project.requirements.filter(
    (r) => r.confidence === "needs_confirmation",
  );
  checks.push(
    check({
      label: tx(A.requirementsLabel, locale),
      status: uncertain.length ? "warning" : "pass",
      detail: uncertain.length
        ? txf(A.requirementsUncertain, locale, {
            count: uncertain.length,
            items: joinList(uncertain.slice(0, 4).map((r) => r.label), locale),
          })
        : tx(A.requirementsOk, locale),
      category: "requirement",
      action: uncertain.length ? tx(A.requirementsAction, locale) : undefined,
    }),
  );
  if (project.rubric.length) {
    const covered = project.rubric.filter(
        (r) => r.readiness === "covered" && linkedRubric.has(r.id),
      ),
      selfMarked = project.rubric.filter(
        (r) => r.readiness === "covered" && !linkedRubric.has(r.id),
      );
    checks.push(
      check({
        label: tx(A.rubricCoverageLabel, locale),
        status:
          covered.length === project.rubric.length
            ? "pass"
            : covered.length
              ? "warning"
              : "critical",
        detail: txf(A.rubricCoverageDetail, locale, {
          covered: covered.length,
          total: project.rubric.length,
          extra: selfMarked.length
            ? txf(A.rubricSelfMarked, locale, { count: selfMarked.length })
            : "",
        }),
        category: "rubric",
        action:
          covered.length < project.rubric.length
            ? tx(A.rubricCoverageAction, locale)
            : undefined,
      }),
    );
  } else
    checks.push(
      check({
        label: tx(A.rubricMissingLabel, locale),
        status: "warning",
        detail: tx(A.rubricMissingDetail, locale),
        category: "rubric",
        action: tx(A.rubricMissingAction, locale),
      }),
    );
  const minSources = Math.max(
      0,
      ...(project.sourceRequirements || []).map((x) =>
        Number(x.minimumCount || 0),
      ),
    ),
    verifiedSources = evidence.filter(
      (x) => x.type === "source" && x.verification !== "unverified",
    );
  if (minSources || project.sourceRequirements?.length)
    checks.push(
      check({
        label: tx(A.sourcesLabel, locale),
        status:
          verifiedSources.length >= minSources
            ? "pass"
            : verifiedSources.length
              ? "warning"
              : "critical",
        detail: txf(A.sourcesDetail, locale, {
          required: minSources || tx(A.sourcesUnspecified, locale),
          found: verifiedSources.length,
        }),
        category: "evidence",
        action:
          verifiedSources.length < minSources ? tx(A.sourcesAction, locale) : undefined,
      }),
    );
  checks.push(
    check({
      label: tx(A.policyLabel, locale),
      status: project.aiPolicy.needsConfirmation ? "warning" : "pass",
      detail: project.aiPolicy.needsConfirmation
        ? tx(A.policyUnconfirmed, locale)
        : project.aiPolicy.summary,
      category: "policy",
      action: project.aiPolicy.needsConfirmation ? tx(A.policyAction, locale) : undefined,
    }),
  );
  if (project.aiPolicy.disclosureRequired) {
    const disclosure =
      /\b(ai|artificial intelligence|disclosure)\b|ذكاء اصطناعي|إفصاح|yapay zeka|人工智能|कृत्रिम बुद्धि|inteligencia artificial|intelligence artificielle|مصنوعی ذہانت/i.test(
        artifacts.map((x) => x.content).join("\n"),
      );
    checks.push(
      check({
        label: tx(A.disclosureLabel, locale),
        status: disclosure ? "pass" : "warning",
        detail: disclosure ? tx(A.disclosurePresent, locale) : tx(A.disclosureMissing, locale),
        category: "policy",
        action: disclosure ? undefined : tx(A.disclosureAction, locale),
      }),
    );
  }
  const allContent = artifacts.map((x) => x.content || "").join("\n\n");
  if (allContent.length > 80) {
    const integrity = runStyleIntegrityAnalysis(allContent);
    const needsReview = integrity.verdict !== "clear" || integrity.metrics.citationVerificationFlags > 0 || integrity.metrics.unsupportedQuantitativeClaims > 0;
    checks.push(
      check({
        label: tx(A.integrityLabel, locale),
        status: needsReview ? "warning" : "pass",
        detail: needsReview
          ? txf(A.integrityNeedsReview, locale, {
              score: integrity.styleRiskScore,
              citations: integrity.metrics.citationVerificationFlags,
              claims: integrity.metrics.unsupportedQuantitativeClaims,
            })
          : tx(A.integrityClear, locale),
        category: "integrity",
        action: needsReview ? tx(A.integrityAction, locale) : undefined,
      }),
    );
  }
  if (project.deadlines.final) {
    const time = new Date(project.deadlines.final).getTime();
    const passed = Number.isFinite(time) && Date.now() > time;
    checks.push(
      check({
        label: tx(A.deadlineLabel, locale),
        status: Number.isFinite(time) ? (passed ? "warning" : "pass") : "warning",
        detail: Number.isFinite(time)
          ? txf(passed ? A.deadlinePassed : A.deadlineUpcoming, locale, {
              deadline: project.deadlines.final,
            })
          : tx(A.deadlineInvalid, locale),
        category: "deadline",
        action: passed ? tx(A.deadlineAction, locale) : undefined,
      }),
    );
  }
  const hashed =
    project.originalAssignment?.attachments?.filter((x) => x.sha256).length ||
    0;
  checks.push(
    check({
      label: tx(A.provenanceLabel, locale),
      status: hashed ? "pass" : "not_applicable",
      detail: hashed
        ? txf(A.provenanceHashed, locale, { count: hashed })
        : tx(A.provenanceNone, locale),
      category: "integrity",
    }),
  );
  checks.push(
    check({
      label: tx(A.accessibilityLabel, locale),
      status: "warning",
      detail: tx(A.accessibilityDetail, locale),
      category: "accessibility",
      action: tx(A.accessibilityAction, locale),
    }),
  );
  const applicable = checks.filter((x) => x.status !== "not_applicable"),
    blockingIssues = checks.filter((x) => x.status === "critical").length,
    warnings = checks.filter((x) => x.status === "warning").length,
    score = Math.round(
      (applicable.reduce(
        (sum, x) =>
          sum + (x.status === "pass" ? 1 : x.status === "warning" ? 0.5 : 0),
        0,
      ) /
        Math.max(1, applicable.length)) *
        100,
    ),
    evidenceCoverage = project.rubric.length
      ? Math.round(
          (project.rubric.filter((x) => linkedRubric.has(x.id)).length /
            project.rubric.length) *
            100,
        )
      : 0;
  const status: SubmissionAudit["status"] = blockingIssues
    ? "critical_issues"
    : warnings >= 3
      ? "needs_attention"
      : warnings
        ? "mostly_ready"
        : "ready";
  return {
    id: randomUUID(),
    projectId: project.id,
    status,
    checks,
    score,
    blockingIssues,
    warnings,
    evidenceCoverage,
    createdAt: new Date().toISOString(),
  };
}

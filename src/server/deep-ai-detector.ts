/**
 * AcademicOS Style & Integrity Analyzer
 *
 * This module deliberately does NOT claim to determine whether a human or an LLM
 * authored text. Stylometric heuristics cannot establish authorship reliably.
 * It surfaces observable writing patterns and integrity risks that a student can
 * review: formulaic phrasing, repetitive rhythm, transition overuse, citation-like
 * claims that need verification, and unsupported quantitative statements.
 */

export interface SentenceAnalysis {
  text: string;
  styleRiskScore: number;
  rhythmDeviation: number;
  reasons: string[];
  highlightColor: "red" | "orange" | "yellow" | "green";
}

export interface StyleIntegrityReport {
  styleRiskScore: number;
  verdict: "clear" | "review_recommended" | "attention_required";
  verdictLabel: string;
  analysisConfidence: number;
  disclaimer: string;
  metrics: {
    vocabularyDiversity: number;
    sentenceRhythmVariety: number;
    syntacticUniformity: number;
    clichéCount: number;
    citationVerificationFlags: number;
    unsupportedQuantitativeClaims: number;
    transitionOveruseScore: number;
  };
  sentenceBreakdown: SentenceAnalysis[];
  detectedClichés: Array<{
    phrase: string;
    category: "formulaic" | "hedging" | "empty_elaboration" | "robotic_transition";
    occurrences: number;
  }>;
  signals: Array<{
    title: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
  }>;
  recommendations: string[];
}

// Compatibility for older UI imports. Semantics are now style/integrity only.
export type DeepAIDetectionReport = StyleIntegrityReport;


type StyleLocale = "ar" | "en" | "tr" | "zh" | "hi" | "es" | "fr" | "ur";
const STYLE_LOCALES = new Set<StyleLocale>(["ar", "en", "tr", "zh", "hi", "es", "fr", "ur"]);
function styleLocale(value?: string): StyleLocale {
  const code = String(value || "en").trim().toLowerCase().split(/[-_]/)[0] as StyleLocale;
  return STYLE_LOCALES.has(code) ? code : "en";
}

const STYLE_TEXT: Record<string, Record<StyleLocale, string>> = {
  disclaimer: {
    ar: "هذا الفحص لا يحدد من كتب النص ولا يمثل أي أداة كشف خارجية. هو تحليل أنماط أسلوب ونزاهة لمساعدتك على المراجعة والتحقق.",
    en: "This review does not identify who wrote the text and does not represent any external detector. It analyzes observable style and integrity patterns to support review and verification.",
    tr: "Bu inceleme metni kimin yazdığını belirlemez ve herhangi bir harici tespit aracını temsil etmez. Gözlemlenebilir üslup ve akademik dürüstlük örüntülerini inceleyerek doğrulamaya yardımcı olur.",
    zh: "本审查不会判断文本由谁撰写，也不代表任何外部检测工具。它分析可观察到的风格与学术诚信模式，以帮助审阅和核验。",
    hi: "यह समीक्षा यह निर्धारित नहीं करती कि पाठ किसने लिखा और किसी बाहरी डिटेक्टर का प्रतिनिधित्व नहीं करती। यह समीक्षा और सत्यापन के लिए दिखाई देने वाले शैली व ईमानदारी पैटर्न का विश्लेषण करती है।",
    es: "Esta revisión no identifica quién escribió el texto ni representa a ningún detector externo. Analiza patrones observables de estilo e integridad para apoyar la revisión y la verificación.",
    fr: "Cette revue n’identifie pas qui a écrit le texte et ne représente aucun détecteur externe. Elle analyse des motifs observables de style et d’intégrité afin d’aider la vérification.",
    ur: "یہ جائزہ یہ تعین نہیں کرتا کہ متن کس نے لکھا اور کسی بیرونی ڈیٹیکٹر کی نمائندگی نہیں کرتا۔ یہ نظر آنے والے اسلوب اور دیانت کے نمونوں کا جائزہ لے کر تصدیق میں مدد دیتا ہے۔",
  },
  shortVerdict: { ar:"النص أقصر من أن يعطي فحص الأسلوب قيمة كافية", en:"The text is too short for a useful style review", tr:"Metin yararlı bir üslup incelemesi için çok kısa", zh:"文本过短，无法进行有意义的风格审查", hi:"उपयोगी शैली समीक्षा के लिए पाठ बहुत छोटा है", es:"El texto es demasiado corto para una revisión de estilo útil", fr:"Le texte est trop court pour une revue de style utile", ur:"متن مفید اسلوب جائزے کیلئے بہت مختصر ہے" },
  shortTitle: { ar:"نص قصير", en:"Text is too short", tr:"Metin çok kısa", zh:"文本过短", hi:"पाठ बहुत छोटा है", es:"Texto demasiado corto", fr:"Texte trop court", ur:"متن بہت مختصر ہے" },
  shortDesc: { ar:"أدخل فقرة أطول أو افحص المشروع كاملًا للحصول على أنماط قابلة للمراجعة.", en:"Use a longer passage or review the whole project to surface patterns worth checking.", tr:"İncelenebilir örüntüler görmek için daha uzun bir bölüm kullanın veya tüm projeyi inceleyin.", zh:"请输入更长的段落或检查整个项目，以发现值得审查的模式。", hi:"जाँच योग्य पैटर्न देखने के लिए लंबा अंश दें या पूरे प्रोजेक्ट की समीक्षा करें।", es:"Usa un fragmento más largo o revisa todo el proyecto para detectar patrones útiles.", fr:"Utilisez un passage plus long ou analysez tout le projet pour faire ressortir des motifs utiles.", ur:"قابلِ جائزہ پیٹرنز کیلئے لمبا اقتباس دیں یا پورا پروجیکٹ جانچیں۔" },
  shortRec: { ar:"افحص نسخة أطول من النص، ثم راجع كل ادعاء رقمي ومصدر من المصدر الأصلي.", en:"Review a longer version, then verify every quantitative claim and citation against the original source.", tr:"Daha uzun bir sürümü inceleyin; ardından her sayısal iddia ve atfı özgün kaynaktan doğrulayın.", zh:"检查更长的文本，然后对照原始来源核验每个数字性主张和引用。", hi:"लंबा संस्करण जाँचें, फिर हर संख्यात्मक दावे और संदर्भ को मूल स्रोत से सत्यापित करें।", es:"Revisa una versión más larga y verifica cada afirmación cuantitativa y cita contra la fuente original.", fr:"Analysez une version plus longue puis vérifiez chaque affirmation quantitative et chaque citation dans la source originale.", ur:"لمبا ورژن جانچیں، پھر ہر عددی دعوے اور حوالہ کو اصل ماخذ سے تصدیق کریں۔" },
  simplified: { ar:"تم تبسيط {n} أنماط صياغة إنشائية أو متكررة.", en:"Simplified {n} formulaic or repetitive phrasing patterns.", tr:"{n} kalıplaşmış veya tekrarlı ifade örüntüsü sadeleştirildi.", zh:"已简化 {n} 处模板化或重复措辞。", hi:"{n} फ़ॉर्मूलाबद्ध या दोहराव वाली अभिव्यक्तियाँ सरल की गईं।", es:"Se simplificaron {n} patrones de redacción formularia o repetitiva.", fr:"{n} formulations stéréotypées ou répétitives ont été simplifiées.", ur:"{n} فارمولہ نما یا دہرائی گئی عبارتیں سادہ کی گئیں۔" },
  transitionsReduced: { ar:"تم تقليل الروابط الانتقالية الميكانيكية المتكررة.", en:"Reduced repetitive mechanical transitions.", tr:"Tekrarlanan mekanik geçişler azaltıldı.", zh:"已减少重复、机械的过渡语。", hi:"दोहराव वाले यांत्रिक संक्रमण कम किए गए।", es:"Se redujeron las transiciones mecánicas repetitivas.", fr:"Les transitions mécaniques répétitives ont été réduites.", ur:"دہرائے گئے میکانکی انتقالات کم کیے گئے۔" },
  noNewFacts: { ar:"لم تتم إضافة أي حقيقة أو نسبة أو مرجع جديد؛ التحسين لغوي فقط ويحافظ على المعنى الأصلي قدر الإمكان.", en:"No new fact, statistic, or citation was added; the change is linguistic only and preserves the original meaning as closely as possible.", tr:"Yeni gerçek, istatistik veya atıf eklenmedi; değişiklik yalnızca dil düzeyindedir ve özgün anlamı olabildiğince korur.", zh:"未添加任何新事实、统计或引用；仅进行语言优化，并尽量保持原意。", hi:"कोई नया तथ्य, आँकड़ा या संदर्भ नहीं जोड़ा गया; बदलाव केवल भाषाई है और मूल अर्थ को यथासंभव सुरक्षित रखता है।", es:"No se añadió ningún hecho, estadística ni cita; el cambio es solo lingüístico y conserva el significado original tanto como sea posible.", fr:"Aucun fait, chiffre ou citation n’a été ajouté ; la modification est uniquement linguistique et préserve au mieux le sens d’origine.", ur:"کوئی نئی حقیقت، اعداد یا حوالہ شامل نہیں کیا گیا؛ تبدیلی صرف لسانی ہے اور اصل معنی کو حتی الامکان برقرار رکھتی ہے۔" },
  rhythmReason: { ar:"طول الجملة قريب من الإيقاع المتكرر في بقية النص", en:"Sentence length closely matches a repeated rhythm elsewhere in the text", tr:"Cümle uzunluğu metindeki tekrarlanan ritme çok yakın", zh:"句长与文本其他部分反复出现的节奏非常接近", hi:"वाक्य की लंबाई पाठ में दोहराई जाने वाली लय से बहुत मेल खाती है", es:"La longitud de la frase coincide de cerca con un ritmo repetido en el texto", fr:"La longueur de la phrase correspond étroitement à un rythme répété dans le texte", ur:"جملے کی لمبائی متن میں دہرائی جانے والی لے سے بہت ملتی ہے" },
  formulaReason: { ar:"صياغة نمطية قابلة للتبسيط: «{phrase}»", en:"Formulaic phrasing that can be simplified: “{phrase}”", tr:"Sadeleştirilebilecek kalıplaşmış ifade: “{phrase}”", zh:"可简化的模板化措辞：“{phrase}”", hi:"सरल की जा सकने वाली फ़ॉर्मूलाबद्ध भाषा: “{phrase}”", es:"Redacción formularia que puede simplificarse: “{phrase}”", fr:"Formulation stéréotypée pouvant être simplifiée : « {phrase} »", ur:"سادہ کی جا سکنے والی فارمولہ نما عبارت: “{phrase}”" },
  transitionReason: { ar:"بداية انتقالية يمكن الاستغناء عنها إذا كان الترابط واضحًا بدونها", en:"A transition opener may be unnecessary when the relationship is already clear", tr:"İlişki zaten açıksa geçiş ifadesi gereksiz olabilir", zh:"如果逻辑关系已经清晰，开头的过渡语可能多余", hi:"यदि संबंध पहले से स्पष्ट है तो संक्रमण की शुरुआत अनावश्यक हो सकती है", es:"El conector inicial puede ser innecesario si la relación ya es clara", fr:"Le connecteur initial peut être inutile si la relation est déjà claire", ur:"اگر ربط پہلے سے واضح ہو تو ابتدائی انتقالی عبارت غیر ضروری ہو سکتی ہے" },
  quantitativeReason: { ar:"ادعاء رقمي/بحثي يحتاج مصدرًا ظاهرًا أو تحققًا من الدليل", en:"A quantitative/research claim needs visible sourcing or evidence verification", tr:"Sayısal/araştırma iddiası görünür kaynak veya kanıt doğrulaması gerektiriyor", zh:"数字性/研究性主张需要明确来源或证据核验", hi:"संख्यात्मक/शोध दावा स्पष्ट स्रोत या प्रमाण सत्यापन चाहता है", es:"Una afirmación cuantitativa/de investigación requiere fuente visible o verificación de evidencia", fr:"Une affirmation quantitative/de recherche nécessite une source visible ou une vérification des preuves", ur:"عددی/تحقیقی دعوے کیلئے واضح ماخذ یا ثبوت کی تصدیق درکار ہے" },
  noSentenceSignal: { ar:"لا توجد إشارة أسلوبية بارزة في هذه الجملة.", en:"No prominent style signal was found in this sentence.", tr:"Bu cümlede belirgin bir üslup sinyali bulunmadı.", zh:"该句未发现明显风格信号。", hi:"इस वाक्य में कोई प्रमुख शैली संकेत नहीं मिला।", es:"No se encontró una señal de estilo destacada en esta frase.", fr:"Aucun signal de style notable n’a été trouvé dans cette phrase.", ur:"اس جملے میں نمایاں اسلوبی اشارہ نہیں ملا۔" },
  rhythmTitle: { ar:"إيقاع جملي متشابه", en:"Highly similar sentence rhythm", tr:"Çok benzer cümle ritmi", zh:"句子节奏高度相似", hi:"बहुत समान वाक्य लय", es:"Ritmo de frases muy similar", fr:"Rythme de phrases très similaire", ur:"بہت ملتی جملوں کی لے" },
  rhythmDesc: { ar:"أطوال الجمل متقاربة بدرجة قد تجعل القراءة آلية أو رتيبة. هذا نمط أسلوبي فقط وليس دليلًا على هوية الكاتب.", en:"Sentence lengths are similar enough to make the prose feel mechanical or flat. This is a style pattern, not evidence of authorship.", tr:"Cümle uzunlukları metni mekanik veya tekdüze hissettirecek kadar benzer. Bu yalnızca üslup örüntüsüdür; yazarlık kanıtı değildir.", zh:"句长过于接近，可能让阅读感觉机械或单调。这只是风格模式，不是作者身份的证据。", hi:"वाक्य लंबाइयाँ इतनी समान हैं कि गद्य यांत्रिक या सपाट लग सकता है। यह शैली पैटर्न है, लेखकत्व का प्रमाण नहीं।", es:"Las longitudes de las frases son tan similares que el texto puede sonar mecánico o plano. Es un patrón de estilo, no evidencia de autoría.", fr:"Les longueurs de phrases sont suffisamment proches pour rendre le texte mécanique ou monotone. C’est un motif stylistique, pas une preuve d’auteur.", ur:"جملوں کی لمبائیاں اتنی ملتی ہیں کہ متن میکانکی یا یکساں لگ سکتا ہے۔ یہ صرف اسلوبی پیٹرن ہے، مصنفیت کا ثبوت نہیں۔" },
  clicheTitle: { ar:"{n} صياغات نمطية قابلة للمراجعة", en:"{n} formulaic phrases worth reviewing", tr:"İncelenmeye değer {n} kalıplaşmış ifade", zh:"有 {n} 处模板化措辞值得审查", hi:"समीक्षा योग्य {n} फ़ॉर्मूलाबद्ध वाक्यांश", es:"{n} frases formularias para revisar", fr:"{n} formulations stéréotypées à revoir", ur:"{n} فارمولہ نما عبارتیں جائزے کے قابل" },
  clicheDesc: { ar:"يمكن استبدالها بعبارات مباشرة مرتبطة بالدليل أو الفكرة المحددة بدل الإنشاء العام.", en:"Replace them with direct wording tied to the specific idea or evidence instead of generic elaboration.", tr:"Genel ifadeler yerine belirli fikir veya kanıta bağlı doğrudan cümleler kullanın.", zh:"可用直接指向具体观点或证据的措辞替代泛化表达。", hi:"सामान्य विस्तार की जगह विशिष्ट विचार या प्रमाण से जुड़ी सीधी भाषा रखें।", es:"Sustitúyelas por redacción directa ligada a la idea o evidencia específica, en lugar de elaboración genérica.", fr:"Remplacez-les par une formulation directe liée à l’idée ou à la preuve précise, plutôt que par une élaboration générique.", ur:"عمومی عبارت کی بجائے مخصوص خیال یا ثبوت سے جڑی براہِ راست زبان استعمال کریں۔" },
  citationsTitle: { ar:"مراجع داخلية تحتاج تحققًا", en:"In-text citations need verification", tr:"Metin içi atıflar doğrulama gerektiriyor", zh:"文内引用需要核验", hi:"इन-टेक्स्ट संदर्भों को सत्यापन चाहिए", es:"Las citas en el texto necesitan verificación", fr:"Les citations dans le texte doivent être vérifiées", ur:"متن کے حوالہ جات کو تصدیق درکار ہے" },
  citationsDesc: { ar:"وجد الفاحص عدة إحالات مؤلف/سنة دون DOI أو رابط ظاهر في النص. لا يعني أنها وهمية؛ افتح المصدر الأصلي وتحقق منها.", en:"Several author/year citations appear without a visible DOI or URL. This does not mean they are false; open the original source and verify them.", tr:"Görünür DOI veya URL olmadan birden fazla yazar/yıl atfı bulundu. Bu onların sahte olduğu anlamına gelmez; özgün kaynağı açıp doğrulayın.", zh:"发现多条作者/年份引用，但文本中没有明显 DOI 或 URL。这并不意味着引用是虚假的；请打开原始来源核验。", hi:"कई लेखक/वर्ष संदर्भ दिखे जिनके साथ स्पष्ट DOI या URL नहीं है। इसका अर्थ यह नहीं कि वे झूठे हैं; मूल स्रोत खोलकर सत्यापित करें।", es:"Aparecen varias citas autor/año sin DOI ni URL visible. No significa que sean falsas; abre la fuente original y verifícalas.", fr:"Plusieurs citations auteur/année apparaissent sans DOI ni URL visible. Cela ne signifie pas qu’elles sont fausses ; ouvrez la source originale et vérifiez-les.", ur:"کئی مصنف/سال حوالہ جات واضح DOI یا URL کے بغیر ملے۔ اس کا مطلب جعلی ہونا نہیں؛ اصل ماخذ کھول کر تصدیق کریں۔" },
  quantitativeTitle: { ar:"{n} ادعاءات رقمية/بحثية تحتاج سندًا ظاهرًا", en:"{n} quantitative/research claims need visible support", tr:"{n} sayısal/araştırma iddiası görünür dayanak gerektiriyor", zh:"有 {n} 个数字性/研究性主张需要明确支持", hi:"{n} संख्यात्मक/शोध दावों को स्पष्ट समर्थन चाहिए", es:"{n} afirmaciones cuantitativas/de investigación necesitan respaldo visible", fr:"{n} affirmations quantitatives/de recherche nécessitent une preuve visible", ur:"{n} عددی/تحقیقی دعووں کو واضح ثبوت درکار ہے" },
  quantitativeDesc: { ar:"النسب والنتائج البحثية ينبغي ربطها بمصدر يمكن فحصه، خصوصًا قبل التسليم.", en:"Percentages and research findings should be tied to a source that can be checked, especially before submission.", tr:"Yüzdeler ve araştırma bulguları özellikle teslimden önce doğrulanabilir bir kaynağa bağlanmalıdır.", zh:"百分比和研究结果应关联到可核验的来源，尤其是在提交前。", hi:"प्रतिशत और शोध निष्कर्ष ऐसे स्रोत से जुड़े होने चाहिए जिसे जाँचा जा सके, विशेषकर जमा करने से पहले।", es:"Los porcentajes y resultados de investigación deben vincularse a una fuente verificable, especialmente antes de entregar.", fr:"Les pourcentages et résultats de recherche doivent être reliés à une source vérifiable, surtout avant la remise.", ur:"فیصد اور تحقیقی نتائج کو خصوصاً جمع کرانے سے پہلے قابلِ جانچ ماخذ سے جوڑنا چاہیے۔" },
  clearTitle: { ar:"لا توجد إشارات أسلوبية كبيرة", en:"No major style signals found", tr:"Belirgin üslup sinyali bulunmadı", zh:"未发现重大风格信号", hi:"कोई बड़ा शैली संकेत नहीं मिला", es:"No se encontraron señales de estilo importantes", fr:"Aucun signal de style majeur détecté", ur:"کوئی بڑا اسلوبی اشارہ نہیں ملا" },
  clearDesc: { ar:"لم يجد الفاحص أنماطًا بارزة ضمن القواعد الحالية. ما زال التحقق من المصادر والـRubric مطلوبًا قبل التسليم.", en:"No prominent pattern was found under the current rules. Source verification and rubric review are still required before submission.", tr:"Mevcut kurallara göre belirgin örüntü bulunmadı. Teslimden önce kaynak doğrulaması ve rubrik incelemesi yine gereklidir.", zh:"当前规则下未发现明显模式。提交前仍需核验来源并检查评分标准。", hi:"मौजूदा नियमों में कोई प्रमुख पैटर्न नहीं मिला। जमा करने से पहले स्रोत सत्यापन और रूब्रिक समीक्षा अभी भी आवश्यक है।", es:"No se encontraron patrones destacados con las reglas actuales. Aún debes verificar fuentes y revisar la rúbrica antes de entregar.", fr:"Aucun motif notable selon les règles actuelles. La vérification des sources et la revue de la grille restent nécessaires avant la remise.", ur:"موجودہ قواعد میں نمایاں پیٹرن نہیں ملا۔ جمع کرانے سے پہلے ماخذ کی تصدیق اور روبرک جائزہ پھر بھی ضروری ہے۔" },
  recSpecific: { ar:"استبدل الصياغة العامة بجملة محددة تقول ماذا حدث أو لماذا، ثم اربطها بالدليل إن كانت ادعاءً معرفيًا.", en:"Replace generic wording with a specific sentence that says what happened or why, and link it to evidence when it makes a factual claim.", tr:"Genel ifadeyi ne olduğunu veya nedenini söyleyen belirli bir cümleyle değiştirin; olgusal iddiaysa kanıta bağlayın.", zh:"用明确说明发生了什么或为什么的句子替代泛化措辞；若属于事实性主张，请连接证据。", hi:"सामान्य भाषा को ऐसे विशिष्ट वाक्य से बदलें जो बताए क्या हुआ या क्यों, और तथ्यात्मक दावा हो तो प्रमाण से जोड़ें।", es:"Sustituye la redacción genérica por una frase específica que diga qué ocurrió o por qué, y enlázala con evidencia si hace una afirmación factual.", fr:"Remplacez les formulations génériques par une phrase précise indiquant ce qui s’est passé ou pourquoi, et reliez-la à une preuve s’il s’agit d’un fait.", ur:"عمومی عبارت کو واضح جملے سے بدلیں جو بتائے کیا ہوا یا کیوں، اور اگر حقیقی دعویٰ ہو تو ثبوت سے جوڑیں۔" },
  recRhythm: { ar:"نوّع طول الجمل بما يخدم المعنى والوضوح، لا بهدف تجاوز أي كاشف.", en:"Vary sentence length only when it improves meaning and clarity, not to evade any detector.", tr:"Cümle uzunluğunu yalnızca anlamı ve açıklığı geliştirdiğinde çeşitlendirin; herhangi bir tespit aracını aşmak için değil.", zh:"仅在有助于意义和清晰度时调整句长，不要以绕过任何检测工具为目的。", hi:"वाक्य लंबाई केवल तब बदलें जब अर्थ और स्पष्टता बेहतर हो, किसी डिटेक्टर से बचने के लिए नहीं।", es:"Varía la longitud de las frases solo si mejora el significado y la claridad, no para eludir detectores.", fr:"Variez la longueur des phrases uniquement si cela améliore le sens et la clarté, pas pour contourner un détecteur.", ur:"جملوں کی لمبائی صرف معنی اور وضاحت بہتر کرنے کیلئے بدلیں، کسی ڈیٹیکٹر سے بچنے کیلئے نہیں۔" },
  recTransitions: { ar:"احذف الروابط الانتقالية الزائدة عندما يكون ترتيب الأفكار كافيًا لإظهار العلاقة.", en:"Remove unnecessary transitions when the order of ideas already makes the relationship clear.", tr:"Fikirlerin sırası ilişkiyi zaten gösteriyorsa gereksiz geçişleri kaldırın.", zh:"如果思想顺序已经足以表达关系，请删除多余过渡语。", hi:"जब विचारों का क्रम संबंध स्पष्ट कर देता है तो अनावश्यक संक्रमण हटाएँ।", es:"Elimina conectores innecesarios cuando el orden de las ideas ya deja clara la relación.", fr:"Supprimez les transitions inutiles lorsque l’ordre des idées suffit à montrer la relation.", ur:"جب خیالات کی ترتیب ربط واضح کر دے تو غیر ضروری انتقالی عبارتیں ہٹا دیں۔" },
  recSources: { ar:"استخدم Source Guardian: افتح المصدر الأصلي وتأكد أن الصفحة/النتيجة تدعم الادعاء كما كُتب.", en:"Use Source Guardian: open the original source and confirm that the page or result supports the claim as written.", tr:"Source Guardian kullanın: özgün kaynağı açın ve sayfa/sonucun iddiayı yazıldığı biçimde desteklediğini doğrulayın.", zh:"使用 Source Guardian：打开原始来源，确认页面或结果确实支持所写主张。", hi:"Source Guardian का उपयोग करें: मूल स्रोत खोलें और पुष्टि करें कि पेज/परिणाम दावे का समर्थन करता है।", es:"Usa Source Guardian: abre la fuente original y confirma que la página o resultado respalda la afirmación tal como está escrita.", fr:"Utilisez Source Guardian : ouvrez la source originale et confirmez que la page ou le résultat étaye l’affirmation telle qu’elle est formulée.", ur:"Source Guardian استعمال کریں: اصل ماخذ کھولیں اور تصدیق کریں کہ صفحہ/نتیجہ دعوے کو اسی طرح سپورٹ کرتا ہے۔" },
  recPolicy: { ar:"لا تعتمد على أي نسبة «كشف AI» للحكم على النص؛ راجع سياسة المقرر، الإفصاح المطلوب، وصحة الأدلة وفهمك لما ستسلّمه.", en:"Do not rely on any “AI detection percentage” to judge a text; review the course policy, required disclosure, evidence quality, and your own understanding before submission.", tr:"Metni değerlendirmek için herhangi bir “AI tespit yüzdesine” güvenmeyin; teslimden önce ders politikasını, gerekli açıklamayı, kanıt kalitesini ve kendi anlayışınızı gözden geçirin.", zh:"不要依赖任何“AI 检测百分比”来判断文本；提交前请检查课程政策、所需披露、证据质量以及你对内容的理解。", hi:"पाठ का निर्णय करने के लिए किसी “AI detection percentage” पर निर्भर न रहें; जमा करने से पहले कोर्स नीति, आवश्यक प्रकटीकरण, प्रमाण गुणवत्ता और अपनी समझ जाँचें।", es:"No dependas de ningún “porcentaje de detección de IA” para juzgar un texto; revisa la política del curso, la divulgación requerida, la calidad de la evidencia y tu comprensión antes de entregar.", fr:"Ne vous fiez à aucun « pourcentage de détection d’IA » pour juger un texte ; vérifiez la politique du cours, la divulgation requise, la qualité des preuves et votre compréhension avant la remise.", ur:"متن پر فیصلہ کیلئے کسی “AI detection percentage” پر انحصار نہ کریں؛ جمع کرانے سے پہلے کورس پالیسی، مطلوبہ افشاء، ثبوت کا معیار اور اپنی سمجھ جانچیں۔" },
  verdictAttention: { ar:"توجد نقاط أسلوب/نزاهة مهمة راجعها قبل التسليم", en:"Important style or integrity issues need review before submission", tr:"Teslimden önce önemli üslup veya dürüstlük noktalarını inceleyin", zh:"提交前有重要的风格或诚信问题需要检查", hi:"जमा करने से पहले महत्वपूर्ण शैली या ईमानदारी बिंदुओं की समीक्षा करें", es:"Hay aspectos importantes de estilo o integridad que revisar antes de entregar", fr:"Des points importants de style ou d’intégrité doivent être revus avant la remise", ur:"جمع کرانے سے پہلے اہم اسلوب یا دیانت نکات کا جائزہ لیں" },
  verdictReview: { ar:"النص جيد مبدئيًا مع نقاط قابلة للتحسين والتحقق", en:"The text is a solid start with points to improve and verify", tr:"Metin iyi bir başlangıç; iyileştirilecek ve doğrulanacak noktalar var", zh:"文本基础良好，但仍有可优化和核验之处", hi:"पाठ अच्छी शुरुआत है, कुछ बिंदु सुधारने और सत्यापित करने हैं", es:"El texto parte bien, con puntos que mejorar y verificar", fr:"Le texte constitue un bon point de départ, avec des points à améliorer et à vérifier", ur:"متن اچھی ابتدا ہے، کچھ نکات بہتر اور تصدیق طلب ہیں" },
  verdictClear: { ar:"لا توجد إشارات بارزة ضمن هذا الفحص", en:"No prominent issues were found in this review", tr:"Bu incelemede belirgin sorun bulunmadı", zh:"本次审查未发现明显问题", hi:"इस समीक्षा में कोई प्रमुख समस्या नहीं मिली", es:"No se encontraron problemas destacados en esta revisión", fr:"Aucun problème notable n’a été détecté dans cette revue", ur:"اس جائزے میں کوئی نمایاں مسئلہ نہیں ملا" },
};

function sm(locale: StyleLocale, key: keyof typeof STYLE_TEXT, vars?: Record<string, string | number>) {
  let value = STYLE_TEXT[key]?.[locale] || STYLE_TEXT[key]?.en || String(key);
  for (const [name, replacement] of Object.entries(vars || {})) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}

const STYLE_PATTERNS = [
  { pattern: /\b(delve|delving|delved)\s+into\b/gi, label: "delve into", cat: "formulaic" },
  { pattern: /\btestament\s+to\b/gi, label: "testament to", cat: "formulaic" },
  { pattern: /\btapestry\s+of\b/gi, label: "tapestry of", cat: "formulaic" },
  { pattern: /\bbeacon\s+of\b/gi, label: "beacon of", cat: "formulaic" },
  { pattern: /\bpivotal\s+role\b/gi, label: "pivotal role", cat: "formulaic" },
  { pattern: /\bfoster(?:ing)?\s+(?:innovation|collaboration|growth)\b/gi, label: "foster innovation/growth", cat: "formulaic" },
  { pattern: /\blandscape\s+of\b/gi, label: "landscape of", cat: "formulaic" },
  { pattern: /\bseamlessly\s+integrat(?:e|ed|ing)\b/gi, label: "seamlessly integrate", cat: "formulaic" },
  { pattern: /\bit\s+is\s+worth\s+noting\s+that\b/gi, label: "it is worth noting that", cat: "hedging" },
  { pattern: /\bplays\s+a\s+vital\s+role\b/gi, label: "plays a vital role", cat: "formulaic" },
  { pattern: /\bholistic\s+approach\b/gi, label: "holistic approach", cat: "formulaic" },
  { pattern: /(?:في\s+ختام\s+هذا|وفي\s+الختام،?\s+يمكن\s+القول|ومما\s+لا\s+شك\s+فيه)/gu, label: "خاتمة إنشائية عامة", cat: "robotic_transition" },
  { pattern: /(?:يلعب\s+دوراً\s+(?:حاسماً|محورياً|أساسياً|لا\s+غنى\s+عنه)|تلعب\s+دوراً\s+(?:حاسماً|محورياً))/gu, label: "يلعب دوراً محورياً/حاسماً", cat: "formulaic" },
  { pattern: /(?:في\s+ظل\s+التطورات\s+المتسارعة|في\s+عالمنا\s+المعاصر|في\s+عصرنا\s+الحالي)/gu, label: "مقدمة عامة", cat: "hedging" },
  { pattern: /(?:من\s+الجدير\s+بالذكر\s+أن|تجدر\s+الإشارة\s+إلى\s+أن|لا\s+يخفى\s+على\s+أحد\s+أن)/gu, label: "حشو تأكيدي", cat: "hedging" },
  { pattern: /(?:نسيج\s+معقد|خارطة\s+طريق\s+شاملة|نهج\s+شامل\s+ومتكامل)/gu, label: "تعبير إنشائي عام", cat: "empty_elaboration" },
  { pattern: /(?:يسلط\s+الضوء\s+على|إلقاء\s+الضوء\s+على\s+أهمية)/gu, label: "يسلط الضوء على", cat: "formulaic" },
  { pattern: /(?:من\s+ناحية\s+أخرى،?\s+فإن|وعلاوة\s+على\s+ذلك،?\s+فإن|وبالإضافة\s+إلى\s+ما\s+سبق)/gu, label: "روابط انتقالية متكررة", cat: "robotic_transition" },
] as const;

const TRANSITION_START = /^(moreover|furthermore|additionally|consequently|therefore|in addition|in conclusion|علاوة على ذلك|بالإضافة إلى ذلك|ومن هنا|وختاماً|من الجدير بالذكر)/iu;
const CITATION_LIKE = /\([A-Z][\p{L}'-]+(?:\s+et\s+al\.|\s+&\s+[A-Z][\p{L}'-]+)?,\s*(?:19|20)\d{2}[a-z]?\)/gu;
const DOI = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;
const URL = /https?:\/\//i;
const QUANTITATIVE = /(?:\b\d+(?:\.\d+)?\s?%|٪\s?\d+|\b\d+(?:\.\d+)?\s*(?:percent|percentage|million|billion)\b|(?:أظهرت|تشير|وجدت)\s+(?:الدراسة|الدراسات|النتائج))/iu;
const INLINE_CITATION = /(?:\([^)]*(?:19|20)\d{2}[^)]*\)|\[[0-9]{1,3}\]|10\.\d{4,9}\/)/u;

function splitSentences(text: string) {
  return text
    .split(/(?<=[.?!؟!\n])\s+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 10);
}

export function improveScholarlyStyle(rawText: string, localeInput = "en"): {
  improvedText: string;
  improvementsMade: string[];
} {
  const locale = styleLocale(localeInput);
  let text = String(rawText || "").trim();
  const improvements: string[] = [];
  const replacements: Array<[RegExp, string]> = [
    [/\bdelve\s+into\b/gi, "examine"],
    [/\btestament\s+to\b/gi, "evidence of"],
    [/\btapestry\s+of\b/gi, "combination of"],
    [/\bbeacon\s+of\b/gi, "example of"],
    [/\bpivotal\s+role\b/gi, "specific role"],
    [/\bplays\s+a\s+vital\s+role\b/gi, "contributes directly"],
    [/\bholistic\s+approach\b/gi, "comprehensive approach"],
    [/(?:في\s+ختام\s+هذا|وفي\s+الختام،?\s+يمكن\s+القول|ومما\s+لا\s+شك\s+فيه)/gu, "وخلاصة التحليل"],
    [/(?:يلعب\s+دوراً\s+(?:حاسماً|محورياً|أساسياً|لا\s+غنى\s+عنه)|تلعب\s+دوراً\s+(?:حاسماً|محورياً))/gu, "يسهم مباشرة في"],
    [/(?:في\s+ظل\s+التطورات\s+المتسارعة|في\s+عالمنا\s+المعاصر|في\s+عصرنا\s+الحالي)/gu, "في سياق هذه الدراسة"],
    [/(?:من\s+الجدير\s+بالذكر\s+أن|تجدر\s+الإشارة\s+إلى\s+أن|لا\s+يخفى\s+على\s+أحد\s+أن)/gu, "يُظهر الدليل أن"],
    [/(?:يسلط\s+الضوء\s+على|إلقاء\s+الضوء\s+على\s+أهمية)/gu, "يوضح"],
  ];

  let changed = 0;
  for (const [pattern, replacement] of replacements) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      pattern.lastIndex = 0;
      text = text.replace(pattern, replacement);
      changed += 1;
    }
  }
  if (changed) improvements.push(sm(locale, "simplified", { n: changed }));

  const sentences = splitSentences(text).map((sentence) =>
    sentence.replace(/^(?:علاوة على ذلك|بالإضافة إلى ذلك|moreover|furthermore|additionally),?\s*/iu, ""),
  );
  const cleaned = sentences.length ? sentences.join(" ") : text;
  if (cleaned !== text) improvements.push(sm(locale, "transitionsReduced"));
  improvements.push(sm(locale, "noNewFacts"));

  return { improvedText: cleaned, improvementsMade: improvements };
}

// Backward-compatible name for older server imports. It no longer attempts to evade detection.
export function humanizeScholarlyText(rawText: string, localeInput = "en") {
  const result = improveScholarlyStyle(rawText, localeInput);
  return { humanizedText: result.improvedText, improvementsMade: result.improvementsMade };
}

export function runStyleIntegrityAnalysis(rawText: string, localeInput = "en"): StyleIntegrityReport {
  const locale = styleLocale(localeInput);
  const text = String(rawText || "").trim();
  const disclaimer = sm(locale, "disclaimer");

  if (!text || text.length < 80) {
    return {
      styleRiskScore: 0,
      verdict: "review_recommended",
      verdictLabel: sm(locale, "shortVerdict"),
      analysisConfidence: 25,
      disclaimer,
      metrics: {
        vocabularyDiversity: 0,
        sentenceRhythmVariety: 0,
        syntacticUniformity: 0,
        clichéCount: 0,
        citationVerificationFlags: 0,
        unsupportedQuantitativeClaims: 0,
        transitionOveruseScore: 0,
      },
      sentenceBreakdown: [],
      detectedClichés: [],
      signals: [{
        title: sm(locale, "shortTitle"),
        description: sm(locale, "shortDesc"),
        severity: "low",
      }],
      recommendations: [sm(locale, "shortRec")],
    };
  }

  const rawSentences = splitSentences(text);
  const words = text.split(/\s+/u).filter(Boolean);
  const uniqueWords = new Set(words.map((word) => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean));
  const vocabularyDiversity = Math.round(Math.min(100, (uniqueWords.size / Math.max(1, words.length)) * 130));

  const sentenceLengths = rawSentences.map((sentence) => sentence.split(/\s+/u).length);
  const averageLength = sentenceLengths.reduce((sum, length) => sum + length, 0) / Math.max(1, sentenceLengths.length);
  const variance = sentenceLengths.reduce((sum, length) => sum + Math.pow(length - averageLength, 2), 0) / Math.max(1, sentenceLengths.length);
  const stdDev = Math.sqrt(variance);
  const sentenceRhythmVariety = Math.round(Math.min(100, (stdDev / Math.max(1, averageLength)) * 160));
  const syntacticUniformity = Math.max(0, Math.min(100, 100 - sentenceRhythmVariety));

  const clichéCounts = new Map<string, { label: string; cat: StyleIntegrityReport["detectedClichés"][number]["category"]; count: number }>();
  let clichéCount = 0;
  for (const item of STYLE_PATTERNS) {
    item.pattern.lastIndex = 0;
    const matches = text.match(item.pattern);
    if (matches?.length) {
      clichéCounts.set(item.label, { label: item.label, cat: item.cat, count: matches.length });
      clichéCount += matches.length;
    }
  }
  const detectedClichés = [...clichéCounts.values()].map((item) => ({ phrase: item.label, category: item.cat, occurrences: item.count }));

  const transitionStarts = rawSentences.filter((sentence) => TRANSITION_START.test(sentence)).length;
  const transitionRatio = transitionStarts / Math.max(1, rawSentences.length);
  const transitionOveruseScore = Math.round(Math.min(100, transitionRatio * 180));

  const citationLike = text.match(CITATION_LIKE)?.length || 0;
  const hasVerificationAnchor = DOI.test(text) || URL.test(text);
  const citationVerificationFlags = citationLike >= 3 && !hasVerificationAnchor ? citationLike : 0;
  const unsupportedQuantitativeClaims = rawSentences.filter(
    (sentence) => QUANTITATIVE.test(sentence) && !INLINE_CITATION.test(sentence),
  ).length;

  const sentenceBreakdown: SentenceAnalysis[] = rawSentences.map((sentence) => {
    const wordCount = sentence.split(/\s+/u).length;
    let score = 0;
    const reasons: string[] = [];
    if (wordCount >= 16 && wordCount <= 25 && syntacticUniformity > 60) {
      score += 18;
      reasons.push(sm(locale, "rhythmReason"));
    }
    for (const item of STYLE_PATTERNS) {
      item.pattern.lastIndex = 0;
      if (item.pattern.test(sentence)) {
        score += item.cat === "robotic_transition" ? 22 : 28;
        reasons.push(sm(locale, "formulaReason", { phrase: item.label }));
      }
    }
    if (TRANSITION_START.test(sentence)) {
      score += 15;
      reasons.push(sm(locale, "transitionReason"));
    }
    if (QUANTITATIVE.test(sentence) && !INLINE_CITATION.test(sentence)) {
      score += 35;
      reasons.push(sm(locale, "quantitativeReason"));
    }
    score = Math.max(0, Math.min(100, score));
    const highlightColor: SentenceAnalysis["highlightColor"] =
      score >= 65 ? "red" : score >= 40 ? "orange" : score >= 20 ? "yellow" : "green";
    return {
      text: sentence,
      styleRiskScore: score,
      rhythmDeviation: Math.round(Math.abs(wordCount - averageLength) * 5),
      reasons: reasons.length ? reasons : [sm(locale, "noSentenceSignal")],
      highlightColor,
    };
  });

  const flaggedSentences = sentenceBreakdown.filter((sentence) => sentence.styleRiskScore >= 40).length;
  const styleRiskScore = Math.round(Math.min(100,
    syntacticUniformity * 0.22 +
    Math.min(100, clichéCount * 12) * 0.28 +
    transitionOveruseScore * 0.18 +
    Math.min(100, unsupportedQuantitativeClaims * 18) * 0.22 +
    Math.min(100, citationVerificationFlags * 10) * 0.10,
  ));

  const signals: StyleIntegrityReport["signals"] = [];
  if (syntacticUniformity > 68) signals.push({
    title: sm(locale, "rhythmTitle"),
    description: sm(locale, "rhythmDesc"),
    severity: "medium",
  });
  if (clichéCount) signals.push({
    title: sm(locale, "clicheTitle", { n: clichéCount }),
    description: sm(locale, "clicheDesc"),
    severity: clichéCount > 5 ? "high" : "medium",
  });
  if (citationVerificationFlags) signals.push({
    title: sm(locale, "citationsTitle"),
    description: sm(locale, "citationsDesc"),
    severity: "high",
  });
  if (unsupportedQuantitativeClaims) signals.push({
    title: sm(locale, "quantitativeTitle", { n: unsupportedQuantitativeClaims }),
    description: sm(locale, "quantitativeDesc"),
    severity: "high",
  });
  if (!signals.length) signals.push({
    title: sm(locale, "clearTitle"),
    description: sm(locale, "clearDesc"),
    severity: "low",
  });

  const recommendations: string[] = [];
  if (clichéCount) recommendations.push(sm(locale, "recSpecific"));
  if (syntacticUniformity > 50) recommendations.push(sm(locale, "recRhythm"));
  if (transitionRatio > 0.25) recommendations.push(sm(locale, "recTransitions"));
  if (unsupportedQuantitativeClaims || citationVerificationFlags) recommendations.push(sm(locale, "recSources"));
  recommendations.push(sm(locale, "recPolicy"));

  const verdict: StyleIntegrityReport["verdict"] = styleRiskScore >= 60 ? "attention_required" : styleRiskScore >= 30 ? "review_recommended" : "clear";
  const verdictLabel = verdict === "attention_required"
    ? sm(locale, "verdictAttention")
    : verdict === "review_recommended"
      ? sm(locale, "verdictReview")
      : sm(locale, "verdictClear");

  return {
    styleRiskScore,
    verdict,
    verdictLabel,
    analysisConfidence: Math.min(95, 50 + Math.round(Math.min(words.length, 900) / 18)),
    disclaimer,
    metrics: {
      vocabularyDiversity,
      sentenceRhythmVariety,
      syntacticUniformity,
      clichéCount,
      citationVerificationFlags,
      unsupportedQuantitativeClaims,
      transitionOveruseScore,
    },
    sentenceBreakdown,
    detectedClichés,
    signals,
    recommendations,
  };
}

// Backward-compatible name. It now performs style/integrity analysis only.
export const runDeepAIDetection = runStyleIntegrityAnalysis;

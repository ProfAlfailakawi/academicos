import { createHmac, randomUUID } from "node:crypto";
import type {
  AcademicAssistanceMode,
  ProjectDNA,
  ProjectDocument,
  ProjectDocumentSection,
  ProjectVariationProfile,
  ProjectWriterRequest,
  ProjectXRayFinding,
  ProjectXRayReport,
} from "../types";
import type { AcademicTaskOutput } from "./ai";
import {
  L,
  joinList,
  resolveServerLocale,
  tx,
  txf,
  type LocalizedText,
  type ServerLocale,
} from "./server-locale";

export interface GroundedSourceInput {
  title: string;
  url?: string;
  snippet?: string;
  provider?: string;
}

export interface VerifiedSourceInput {
  title: string;
  detail?: string;
  sourceUrl?: string;
  verification?: string;
}

export interface ProjectWriterGeneratorInput {
  sectionTitle: string;
  purpose: string;
  prompt: string;
  previousMemory: string;
  targetWords: number;
}

export type ProjectWriterGenerator = (
  input: ProjectWriterGeneratorInput,
) => Promise<AcademicTaskOutput>;

// ---------------------------------------------------------------------------
// Localized copy. Every learner-visible string produced by this module is
// declared here in the eight launch locales, so a project written in English,
// Turkish, Chinese, Hindi, Spanish, French or Urdu never renders Arabic
// scaffolding.
// ---------------------------------------------------------------------------

const COPY = {
  practiceDisclosure: L(
    "مسودة تدريبية أنشئت بمساعدة AcademicOS. لا تُقدَّم كتسليم نهائي إلا بعد مراجعة سياسة المقرر والتحقق من المصادر والبيانات وفهم المحتوى.",
    "Practice draft produced with AcademicOS. Do not submit it as final work until you have checked the course policy, verified every source and figure, and understood the content.",
    "AcademicOS ile hazırlanan alıştırma taslağı. Ders politikasını kontrol etmeden, her kaynağı ve veriyi doğrulamadan ve içeriği anlamadan nihai teslim olarak sunmayın.",
    "由 AcademicOS 协助生成的练习稿。在核对课程政策、核实每一处来源与数据并真正理解内容之前，请勿作为最终作业提交。",
    "AcademicOS की सहायता से बनाया गया अभ्यास मसौदा। पाठ्यक्रम नीति जाँचने, हर स्रोत और आँकड़े को सत्यापित करने तथा सामग्री समझने से पहले इसे अंतिम रूप में जमा न करें।",
    "Borrador de práctica generado con AcademicOS. No lo entregues como trabajo final hasta revisar la política del curso, verificar cada fuente y dato, y comprender el contenido.",
    "Brouillon d'entraînement produit avec AcademicOS. Ne le rendez pas comme travail final avant d'avoir vérifié la politique du cours, chaque source et chaque donnée, et compris le contenu.",
    "AcademicOS کی مدد سے تیار کردہ مشقی مسودہ۔ کورس پالیسی جانچنے، ہر ماخذ اور اعداد و شمار کی تصدیق کرنے اور مواد سمجھنے سے پہلے اسے حتمی جمع کے طور پر پیش نہ کریں۔",
  ),
  strictDisclosure: L(
    "وضع السياسة الصارمة: تعرض المنصة هيكلًا تفصيليًا وأسئلة إرشادية، ويكتب الطالب النص القابل للتسليم بنفسه.",
    "Policy-strict mode: the platform provides a detailed outline and guiding questions, and you write the submittable text yourself.",
    "Katı politika modu: platform ayrıntılı bir taslak ve yönlendirici sorular verir; teslim edilecek metni siz yazarsınız.",
    "严格政策模式：平台提供详细提纲与引导性问题，可提交的正文由你自己撰写。",
    "सख़्त नीति मोड: प्लेटफ़ॉर्म विस्तृत रूपरेखा और मार्गदर्शक प्रश्न देता है; जमा किया जाने वाला पाठ आप स्वयं लिखते हैं।",
    "Modo de política estricta: la plataforma ofrece un esquema detallado y preguntas guía; el texto entregable lo escribes tú.",
    "Mode politique stricte : la plateforme fournit un plan détaillé et des questions guides ; vous rédigez vous-même le texte à rendre.",
    "سخت پالیسی موڈ: پلیٹ فارم تفصیلی خاکہ اور رہنما سوالات دیتا ہے، جمع کرانے والا متن آپ خود لکھتے ہیں۔",
  ),
  policyBlocked: L(
    "لا يمكن إنشاء تسليم كامل في وضع التسليم المصرّح قبل تأكيد سياسة المقرر أو رفع مستوى السماح إلى L4 على الأقل.",
    "A full submittable draft cannot be generated in authorized-submission mode until the course policy is confirmed or the permitted level is at least L4.",
    "Yetkili teslim modunda tam bir teslim taslağı, ders politikası doğrulanana veya izin düzeyi en az L4 olana kadar oluşturulamaz.",
    "在“已授权提交”模式下，必须先确认课程政策或将许可等级提升到至少 L4，才能生成完整可提交稿。",
    "अधिकृत सबमिशन मोड में पूर्ण मसौदा तब तक नहीं बन सकता जब तक पाठ्यक्रम नीति की पुष्टि न हो या अनुमति स्तर कम से कम L4 न हो।",
    "No se puede generar un borrador entregable completo en modo de entrega autorizada hasta confirmar la política del curso o alcanzar el nivel permitido L4.",
    "Aucun brouillon complet à rendre ne peut être généré en mode soumission autorisée tant que la politique du cours n'est pas confirmée ou que le niveau autorisé n'atteint pas L4.",
    "مجاز جمع موڈ میں مکمل مسودہ اُس وقت تک نہیں بن سکتا جب تک کورس پالیسی کی تصدیق نہ ہو یا اجازت کی سطح کم از کم L4 نہ ہو۔",
  ),
  disclosureRequired: L(
    "تم استخدام AcademicOS في التخطيط والصياغة والمراجعة وفق سياسة المقرر: {policy}",
    "AcademicOS was used for planning, drafting and review under the course policy: {policy}",
    "AcademicOS, ders politikası kapsamında planlama, taslak ve gözden geçirme için kullanıldı: {policy}",
    "本项目在课程政策允许范围内使用 AcademicOS 进行规划、起草与审阅：{policy}",
    "पाठ्यक्रम नीति के अंतर्गत योजना, प्रारूपण और समीक्षा के लिए AcademicOS का उपयोग किया गया: {policy}",
    "Se utilizó AcademicOS para planificar, redactar y revisar conforme a la política del curso: {policy}",
    "AcademicOS a servi à la planification, à la rédaction et à la révision selon la politique du cours : {policy}",
    "کورس پالیسی کے تحت منصوبہ بندی، مسودہ سازی اور نظرثانی کے لیے AcademicOS استعمال ہوا: {policy}",
  ),
  disclosureConfirmed: L(
    "تم إنشاء المشروع بمساعدة AcademicOS وفق سياسة المقرر المؤكدة: {policy}",
    "This project was produced with AcademicOS under the confirmed course policy: {policy}",
    "Bu proje, doğrulanmış ders politikası kapsamında AcademicOS ile hazırlandı: {policy}",
    "本项目在已确认的课程政策下由 AcademicOS 协助完成：{policy}",
    "यह प्रोजेक्ट पुष्ट पाठ्यक्रम नीति के तहत AcademicOS की सहायता से बनाया गया: {policy}",
    "Este proyecto se elaboró con AcademicOS conforme a la política del curso confirmada: {policy}",
    "Ce projet a été réalisé avec AcademicOS selon la politique du cours confirmée : {policy}",
    "یہ پروجیکٹ تصدیق شدہ کورس پالیسی کے تحت AcademicOS کی مدد سے تیار ہوا: {policy}",
  ),
  sourceNeeded: L("[مصدر مطلوب]", "[source needed]", "[kaynak gerekli]", "[需要来源]", "[स्रोत आवश्यक]", "[fuente requerida]", "[source requise]", "[ماخذ درکار]"),
  abstract: L(
    "مشروع «{title}» منظّم في {count} أقسام مترابطة. يوضح الملف هدف كل قسم، الأدلة المطلوبة، وأسئلة المناقشة. راجع النص والمصادر والبيانات بما يتوافق مع سياسة المقرر قبل التسليم.",
    "“{title}” is organised into {count} connected sections. The document sets out the purpose of each section, the evidence it needs, and the questions you should be ready to answer. Review the text, sources and data against your course policy before submitting.",
    "“{title}” birbirine bağlı {count} bölüme ayrılmıştır. Belge her bölümün amacını, gereken kanıtı ve savunmada karşılaşacağınız soruları ortaya koyar. Teslimden önce metni, kaynakları ve verileri ders politikanıza göre gözden geçirin.",
    "《{title}》共分为 {count} 个相互衔接的章节。文档说明了每一节的目的、所需证据以及答辩问题。提交前请依据课程政策核查正文、来源与数据。",
    "“{title}” को {count} परस्पर जुड़े अनुभागों में व्यवस्थित किया गया है। दस्तावेज़ प्रत्येक अनुभाग का उद्देश्य, आवश्यक प्रमाण और बचाव प्रश्न बताता है। जमा करने से पहले पाठ्यक्रम नीति के अनुसार पाठ, स्रोत और डेटा जाँचें।",
    "«{title}» está organizado en {count} secciones conectadas. El documento expone el propósito de cada sección, la evidencia que necesita y las preguntas de defensa. Revisa el texto, las fuentes y los datos según la política de tu curso antes de entregar.",
    "« {title} » est organisé en {count} sections liées. Le document présente l'objectif de chaque section, les preuves nécessaires et les questions de soutenance. Vérifiez le texte, les sources et les données selon la politique du cours avant de rendre.",
    "«{title}» کو {count} باہم مربوط حصوں میں ترتیب دیا گیا ہے۔ دستاویز ہر حصے کا مقصد، درکار شواہد اور دفاعی سوالات بیان کرتی ہے۔ جمع کرانے سے پہلے کورس پالیسی کے مطابق متن، مآخذ اور ڈیٹا کا جائزہ لیں۔",
  ),
  noVerifiedSources: L(
    "لم تُرفق مصادر متحققة؛ يجب استبدال علامات [مصدر مطلوب] قبل التسليم.",
    "No verified sources were attached; replace every [source needed] marker before submitting.",
    "Doğrulanmış kaynak eklenmedi; teslimden önce her [kaynak gerekli] işaretini değiştirin.",
    "未附任何已核实来源；提交前请替换全部 [需要来源] 标记。",
    "कोई सत्यापित स्रोत संलग्न नहीं है; जमा करने से पहले हर [स्रोत आवश्यक] चिह्न बदलें।",
    "No se adjuntaron fuentes verificadas; sustituye cada marca [fuente requerida] antes de entregar.",
    "Aucune source vérifiée n'a été jointe ; remplacez chaque marque [source requise] avant de rendre.",
    "کوئی تصدیق شدہ ماخذ منسلک نہیں؛ جمع کرانے سے پہلے ہر [ماخذ درکار] نشان تبدیل کریں۔",
  ),
  rescueNeedsDraft: L(
    "وضع الإنقاذ يحتاج مسودة مرفوعة للحصول على تشخيص كامل.",
    "Rescue mode needs an uploaded draft to produce a full diagnosis.",
    "Kurtarma modu tam tanı için yüklenmiş bir taslağa ihtiyaç duyar.",
    "拯救模式需要上传现有草稿才能给出完整诊断。",
    "पूर्ण निदान के लिए रेस्क्यू मोड को अपलोड किया गया मसौदा चाहिए।",
    "El modo de rescate necesita un borrador cargado para dar un diagnóstico completo.",
    "Le mode sauvetage nécessite un brouillon téléversé pour établir un diagnostic complet.",
    "ریسکیو موڈ کو مکمل تشخیص کے لیے اپ لوڈ شدہ مسودہ درکار ہے۔",
  ),
  scaffoldIntro: L(
    "## {title}\n\nهدف القسم: {purpose}.\n\nاكتب هذا القسم وفق المسار الآتي:\n1. ابدأ بفكرة محددة مرتبطة بسؤال المشروع.\n2. اربط كل ادعاء بدليل متحقق منه.\n3. ناقش بديلاً أو قيداً واحداً على الأقل.\n4. اختم بما يمهد للقسم التالي.\n\nمتطلبات يجب مراعاتها:\n{requirements}",
    "## {title}\n\nPurpose of this section: {purpose}.\n\nWrite it along this path:\n1. Open with a specific idea tied to the project question.\n2. Attach every claim to verified evidence.\n3. Discuss at least one alternative or limitation.\n4. Close with a bridge into the next section.\n\nRequirements to respect:\n{requirements}",
    "## {title}\n\nBölümün amacı: {purpose}.\n\nBu bölümü şu sıraya göre yazın:\n1. Proje sorusuna bağlı belirli bir fikirle başlayın.\n2. Her iddiayı doğrulanmış bir kanıta bağlayın.\n3. En az bir alternatifi veya sınırlılığı tartışın.\n4. Bir sonraki bölüme geçiş yapan bir kapanışla bitirin.\n\nGözetilecek gereksinimler:\n{requirements}",
    "## {title}\n\n本节目的：{purpose}。\n\n请按以下路径写作：\n1. 以与项目问题直接相关的具体观点开篇。\n2. 每一处主张都要接上可核实的证据。\n3. 至少讨论一种替代方案或局限。\n4. 以承接下一节的过渡收尾。\n\n需要满足的要求：\n{requirements}",
    "## {title}\n\nइस अनुभाग का उद्देश्य: {purpose}।\n\nइसे इस क्रम में लिखें:\n1. प्रोजेक्ट प्रश्न से जुड़े एक ठोस विचार से शुरू करें।\n2. हर दावे को सत्यापित प्रमाण से जोड़ें।\n3. कम से कम एक विकल्प या सीमा पर चर्चा करें।\n4. अगले अनुभाग की ओर ले जाने वाले वाक्य से समाप्त करें।\n\nध्यान रखने योग्य आवश्यकताएँ:\n{requirements}",
    "## {title}\n\nPropósito de la sección: {purpose}.\n\nEscríbela siguiendo esta ruta:\n1. Abre con una idea concreta ligada a la pregunta del proyecto.\n2. Vincula cada afirmación con evidencia verificada.\n3. Discute al menos una alternativa o limitación.\n4. Cierra con un puente hacia la sección siguiente.\n\nRequisitos que debes respetar:\n{requirements}",
    "## {title}\n\nObjectif de la section : {purpose}.\n\nRédigez-la selon ce cheminement :\n1. Commencez par une idée précise liée à la question du projet.\n2. Rattachez chaque affirmation à une preuve vérifiée.\n3. Discutez au moins une alternative ou une limite.\n4. Terminez par une transition vers la section suivante.\n\nExigences à respecter :\n{requirements}",
    "## {title}\n\nاس حصے کا مقصد: {purpose}۔\n\nاسے اس ترتیب سے لکھیں:\n1. پروجیکٹ کے سوال سے جڑے ٹھوس خیال سے آغاز کریں۔\n2. ہر دعوے کو تصدیق شدہ شواہد سے جوڑیں۔\n3. کم از کم ایک متبادل یا حد پر بات کریں۔\n4. اگلے حصے کی طرف لے جانے والے جملے پر ختم کریں۔\n\nجن تقاضوں کا خیال رکھنا ہے:\n{requirements}",
  ),
  scaffoldFallbackRequirement: L(
    "- راجع متطلبات التكليف الأصلية.",
    "- Review the requirements in the original assignment brief.",
    "- Özgün ödev metnindeki gereksinimleri gözden geçirin.",
    "- 请查阅原始作业说明中的要求。",
    "- मूल असाइनमेंट विवरण की आवश्यकताएँ देखें।",
    "- Revisa los requisitos del enunciado original.",
    "- Consultez les exigences de l'énoncé d'origine.",
    "- اصل اسائنمنٹ کی ہدایات میں دیے گئے تقاضے دیکھیں۔",
  ),
  sectionExplanation: L(
    "الفكرة الأساسية في «{title}» هي: {purpose}. عند المناقشة، ابدأ بالهدف ثم اذكر الدليل الذي استخدمته وسبب اختياره وأهم قيد عليه.",
    "The core idea of “{title}” is: {purpose}. In the defense, start from the purpose, then name the evidence you used, why you chose it, and its main limitation.",
    "“{title}” bölümünün özü: {purpose}. Savunmada amaçtan başlayın; ardından kullandığınız kanıtı, onu neden seçtiğinizi ve en önemli sınırlılığını söyleyin.",
    "《{title}》的核心是：{purpose}。答辩时先说明目的，再指出所用证据、选择理由及其主要局限。",
    "“{title}” का मूल विचार है: {purpose}। बचाव में उद्देश्य से शुरू करें, फिर प्रयुक्त प्रमाण, उसका चयन कारण और मुख्य सीमा बताएँ।",
    "La idea central de «{title}» es: {purpose}. En la defensa, parte del propósito y luego nombra la evidencia usada, por qué la elegiste y su principal limitación.",
    "L'idée centrale de « {title} » est : {purpose}. En soutenance, partez de l'objectif, puis citez la preuve utilisée, la raison de ce choix et sa principale limite.",
    "«{title}» کا بنیادی خیال یہ ہے: {purpose}۔ دفاع میں مقصد سے آغاز کریں، پھر استعمال شدہ شواہد، اُن کے انتخاب کی وجہ اور بڑی حد بتائیں۔",
  ),
  defenseQuestionPurpose: L(
    "ما الهدف من قسم «{title}»؟",
    "What is the purpose of the “{title}” section?",
    "“{title}” bölümünün amacı nedir?",
    "《{title}》这一节的目的是什么？",
    "“{title}” अनुभाग का उद्देश्य क्या है?",
    "¿Cuál es el propósito de la sección «{title}»?",
    "Quel est l'objectif de la section « {title} » ?",
    "«{title}» حصے کا مقصد کیا ہے؟",
  ),
  defenseQuestionEvidence: L(
    "ما أقوى دليل فيه، وما القيد الذي يؤثر عليه؟",
    "What is its strongest piece of evidence, and what limitation affects it?",
    "En güçlü kanıtı nedir ve onu etkileyen sınırlılık nedir?",
    "其中最有力的证据是什么？受到什么局限影响？",
    "इसका सबसे मज़बूत प्रमाण क्या है और उस पर कौन-सी सीमा लागू होती है?",
    "¿Cuál es su evidencia más sólida y qué limitación la afecta?",
    "Quelle est sa preuve la plus solide et quelle limite l'affecte ?",
    "اس میں سب سے مضبوط شہادت کیا ہے اور کون سی حد اُس پر اثر ڈالتی ہے؟",
  ),
} as const;

interface SectionCopy { title: LocalizedText; purpose: LocalizedText }
const SECTION = {
  researchIntro: {
    title: L("المقدمة ومشكلة الدراسة", "Introduction and research problem", "Giriş ve araştırma problemi", "引言与研究问题", "परिचय और शोध समस्या", "Introducción y problema de investigación", "Introduction et problématique", "تعارف اور تحقیقی مسئلہ"),
    purpose: L("تحديد السياق والمشكلة وسؤال البحث والأهداف وحدود الدراسة", "Set out the context, the problem, the research question, the objectives and the scope", "Bağlamı, problemi, araştırma sorusunu, amaçları ve kapsamı ortaya koymak", "界定研究背景、问题、研究问题、目标与范围", "संदर्भ, समस्या, शोध प्रश्न, उद्देश्य और सीमा निर्धारित करना", "Definir el contexto, el problema, la pregunta de investigación, los objetivos y el alcance", "Poser le contexte, le problème, la question de recherche, les objectifs et le périmètre", "سیاق، مسئلہ، تحقیقی سوال، اہداف اور دائرہ کار متعین کرنا"),
  },
  researchLiterature: {
    title: L("الإطار النظري والدراسات السابقة", "Theoretical framework and literature review", "Kuramsal çerçeve ve alanyazın", "理论框架与文献综述", "सैद्धांतिक ढाँचा और साहित्य समीक्षा", "Marco teórico y revisión de la literatura", "Cadre théorique et revue de littérature", "نظری فریم ورک اور سابقہ مطالعات"),
    purpose: L("تركيب الأدبيات وتحديد الفجوة دون اختلاق مصادر", "Synthesise the literature and identify the gap without inventing sources", "Alanyazını sentezlemek ve kaynak uydurmadan boşluğu belirlemek", "综合已有文献并指出研究缺口，不得虚构来源", "साहित्य का संश्लेषण कर शोध-अंतर पहचानना, स्रोत गढ़े बिना", "Sintetizar la literatura e identificar el vacío sin inventar fuentes", "Synthétiser la littérature et identifier le manque sans inventer de sources", "ادب کا خلاصہ کر کے خلا کی نشاندہی کرنا، ماخذ گھڑے بغیر"),
  },
  researchMethodology: {
    title: L("المنهجية", "Methodology", "Yöntem", "研究方法", "पद्धति", "Metodología", "Méthodologie", "طریقہ کار"),
    purpose: L("شرح التصميم والعينة والأداة والإجراءات والقيود بما يعكس العمل الفعلي فقط", "Explain the design, sample, instrument, procedure and limitations, reflecting only the work actually done", "Tasarımı, örneklemi, aracı, prosedürü ve sınırlılıkları yalnızca gerçekten yapılan işi yansıtacak biçimde açıklamak", "说明设计、样本、工具、流程与局限，且只反映实际完成的工作", "डिज़ाइन, नमूना, उपकरण, प्रक्रिया और सीमाएँ समझाना — केवल वास्तव में किए गए कार्य के अनुसार", "Explicar el diseño, la muestra, el instrumento, el procedimiento y las limitaciones, reflejando solo el trabajo realmente realizado", "Expliquer le design, l'échantillon, l'instrument, la procédure et les limites, en ne reflétant que le travail réellement effectué", "ڈیزائن، نمونہ، آلہ، طریقۂ عمل اور حدود بیان کرنا، صرف اُسی کام کے مطابق جو واقعی ہوا"),
  },
  researchResults: {
    title: L("النتائج والتحليل", "Results and analysis", "Bulgular ve analiz", "结果与分析", "परिणाम और विश्लेषण", "Resultados y análisis", "Résultats et analyse", "نتائج اور تجزیہ"),
    purpose: L("عرض النتائج الحقيقية أو وضع أماكن واضحة للبيانات التي لم تُجمع بعد", "Present the real results, or leave clearly marked placeholders for data not yet collected", "Gerçek bulguları sunmak ya da henüz toplanmamış veriler için açıkça işaretlenmiş yer tutucular bırakmak", "呈现真实结果，或为尚未收集的数据留下明确标注的占位", "वास्तविक परिणाम प्रस्तुत करना, या अब तक न जुटाए गए डेटा के लिए स्पष्ट प्लेसहोल्डर छोड़ना", "Presentar los resultados reales o dejar marcadores claros para los datos aún no recogidos", "Présenter les résultats réels ou laisser des marqueurs explicites pour les données non encore collectées", "حقیقی نتائج پیش کرنا، یا ابھی تک جمع نہ ہونے والے ڈیٹا کے لیے واضح جگہ چھوڑنا"),
  },
  researchDiscussion: {
    title: L("المناقشة", "Discussion", "Tartışma", "讨论", "चर्चा", "Discusión", "Discussion", "بحث"),
    purpose: L("تفسير النتائج وربطها بالسؤال والأدلة والبدائل والقيود", "Interpret the results against the research question, the evidence, the alternatives and the limitations", "Bulguları araştırma sorusu, kanıtlar, alternatifler ve sınırlılıklarla ilişkilendirerek yorumlamak", "结合研究问题、证据、替代解释与局限来解读结果", "परिणामों की व्याख्या शोध प्रश्न, प्रमाण, विकल्पों और सीमाओं के साथ करना", "Interpretar los resultados frente a la pregunta, la evidencia, las alternativas y las limitaciones", "Interpréter les résultats au regard de la question, des preuves, des alternatives et des limites", "نتائج کی تشریح تحقیقی سوال، شواہد، متبادل اور حدود کے تناظر میں کرنا"),
  },
  researchConclusion: {
    title: L("الخاتمة والتوصيات", "Conclusion and recommendations", "Sonuç ve öneriler", "结论与建议", "निष्कर्ष और सिफ़ारिशें", "Conclusión y recomendaciones", "Conclusion et recommandations", "نتیجہ اور سفارشات"),
    purpose: L("إجابة السؤال وتلخيص القيمة وتقديم توصيات قابلة للتنفيذ", "Answer the question, summarise the value, and give actionable recommendations", "Soruyu yanıtlamak, katkıyı özetlemek ve uygulanabilir öneriler sunmak", "回答研究问题、总结价值并给出可执行建议", "प्रश्न का उत्तर देना, मूल्य का सार देना और क्रियान्वयन-योग्य सिफ़ारिशें देना", "Responder la pregunta, resumir el valor y ofrecer recomendaciones accionables", "Répondre à la question, résumer l'apport et formuler des recommandations actionnables", "سوال کا جواب دینا، افادیت کا خلاصہ اور قابلِ عمل سفارشات دینا"),
  },
  techIntro: {
    title: L("مقدمة المشكلة والمتطلبات", "Problem statement and requirements", "Problem tanımı ve gereksinimler", "问题陈述与需求", "समस्या कथन और आवश्यकताएँ", "Planteamiento del problema y requisitos", "Énoncé du problème et exigences", "مسئلے کا بیان اور تقاضے"),
    purpose: L("تحديد المستخدم والمشكلة والنطاق ومعايير النجاح", "Define the user, the problem, the scope and the success criteria", "Kullanıcıyı, problemi, kapsamı ve başarı ölçütlerini tanımlamak", "界定用户、问题、范围与成功标准", "उपयोगकर्ता, समस्या, दायरा और सफलता मानदंड तय करना", "Definir el usuario, el problema, el alcance y los criterios de éxito", "Définir l'utilisateur, le problème, le périmètre et les critères de réussite", "صارف، مسئلہ، دائرہ کار اور کامیابی کے معیار متعین کرنا"),
  },
  techAlternatives: {
    title: L("التحليل والبدائل", "Analysis and alternatives", "Analiz ve alternatifler", "分析与备选方案", "विश्लेषण और विकल्प", "Análisis y alternativas", "Analyse et alternatives", "تجزیہ اور متبادل"),
    purpose: L("مقارنة البدائل وتبرير القرارات التقنية", "Compare the alternatives and justify the technical decisions", "Alternatifleri karşılaştırmak ve teknik kararları gerekçelendirmek", "比较备选方案并论证技术决策", "विकल्पों की तुलना कर तकनीकी निर्णयों को उचित ठहराना", "Comparar alternativas y justificar las decisiones técnicas", "Comparer les alternatives et justifier les choix techniques", "متبادل کا موازنہ اور تکنیکی فیصلوں کا جواز"),
  },
  techArchitecture: {
    title: L("التصميم المعماري", "Architecture and design", "Mimari tasarım", "架构设计", "आर्किटेक्चर और डिज़ाइन", "Arquitectura y diseño", "Architecture et conception", "فنی ساخت اور ڈیزائن"),
    purpose: L("شرح المكونات وتدفق البيانات والافتراضات والحدود", "Explain the components, the data flow, the assumptions and the boundaries", "Bileşenleri, veri akışını, varsayımları ve sınırları açıklamak", "说明组件、数据流、假设与边界", "घटक, डेटा प्रवाह, मान्यताएँ और सीमाएँ समझाना", "Explicar los componentes, el flujo de datos, los supuestos y los límites", "Expliquer les composants, le flux de données, les hypothèses et les limites", "اجزا، ڈیٹا کے بہاؤ، مفروضات اور حدود کی وضاحت"),
  },
  techImplementation: {
    title: L("التنفيذ", "Implementation", "Uygulama", "实现", "क्रियान्वयन", "Implementación", "Mise en œuvre", "نفاذ"),
    purpose: L("توثيق ما تم تنفيذه فعلياً دون ادعاء تشغيل غير مثبت", "Document what was actually built, without claiming unproven behaviour", "Gerçekten yapılanı, kanıtlanmamış çalışma iddiası olmadan belgelemek", "记录实际完成的部分，不得声称未经验证的运行结果", "जो वास्तव में बनाया गया उसे दर्ज करना, बिना अप्रमाणित दावे के", "Documentar lo que realmente se construyó, sin afirmar comportamientos no probados", "Documenter ce qui a réellement été réalisé, sans affirmer un fonctionnement non prouvé", "جو واقعی بنایا گیا اُسے دستاویز کرنا، غیر ثابت شدہ دعوے کے بغیر"),
  },
  techTesting: {
    title: L("الاختبار والتقييم", "Testing and evaluation", "Test ve değerlendirme", "测试与评估", "परीक्षण और मूल्यांकन", "Pruebas y evaluación", "Tests et évaluation", "جانچ اور تشخیص"),
    purpose: L("ربط الاختبارات بمعايير النجاح وذكر النتائج الحقيقية فقط", "Tie the tests to the success criteria and report only real results", "Testleri başarı ölçütleriyle ilişkilendirmek ve yalnızca gerçek sonuçları bildirmek", "将测试与成功标准对应，只报告真实结果", "परीक्षणों को सफलता मानदंडों से जोड़ना और केवल वास्तविक परिणाम बताना", "Vincular las pruebas con los criterios de éxito y reportar solo resultados reales", "Relier les tests aux critères de réussite et ne rapporter que des résultats réels", "جانچ کو کامیابی کے معیار سے جوڑنا اور صرف حقیقی نتائج بتانا"),
  },
  techConclusion: {
    title: L("الخاتمة والعمل المستقبلي", "Conclusion and future work", "Sonuç ve gelecek çalışmalar", "结论与后续工作", "निष्कर्ष और भावी कार्य", "Conclusión y trabajo futuro", "Conclusion et travaux futurs", "نتیجہ اور آئندہ کام"),
    purpose: L("تلخيص الحل والقيود وخطوات التطوير التالية", "Summarise the solution, its limits and the next development steps", "Çözümü, sınırlılıklarını ve sonraki geliştirme adımlarını özetlemek", "总结解决方案、局限与后续开发步骤", "समाधान, उसकी सीमाएँ और अगले विकास चरण का सार", "Resumir la solución, sus límites y los próximos pasos de desarrollo", "Résumer la solution, ses limites et les prochaines étapes de développement", "حل، اُس کی حدود اور اگلے ترقیاتی مراحل کا خلاصہ"),
  },
  bizSummary: {
    title: L("الملخص التنفيذي", "Executive summary", "Yönetici özeti", "执行摘要", "कार्यकारी सारांश", "Resumen ejecutivo", "Résumé exécutif", "انتظامی خلاصہ"),
    purpose: L("عرض المشكلة والفرصة والاستنتاج المقترح بإيجاز", "State the problem, the opportunity and the proposed conclusion concisely", "Problemi, fırsatı ve önerilen sonucu özlü biçimde ortaya koymak", "简明陈述问题、机会与拟议结论", "समस्या, अवसर और प्रस्तावित निष्कर्ष संक्षेप में रखना", "Exponer con concisión el problema, la oportunidad y la conclusión propuesta", "Exposer avec concision le problème, l'opportunité et la conclusion proposée", "مسئلہ، موقع اور تجویز کردہ نتیجہ مختصراً پیش کرنا"),
  },
  bizContext: {
    title: L("السياق وتحليل السوق", "Context and market analysis", "Bağlam ve pazar analizi", "背景与市场分析", "संदर्भ और बाज़ार विश्लेषण", "Contexto y análisis de mercado", "Contexte et analyse de marché", "سیاق اور مارکیٹ تجزیہ"),
    purpose: L("تحديد النطاق والعملاء والمنافسة والافتراضات", "Define the scope, the customers, the competition and the assumptions", "Kapsamı, müşterileri, rekabeti ve varsayımları belirlemek", "界定范围、客户、竞争与假设", "दायरा, ग्राहक, प्रतिस्पर्धा और मान्यताएँ तय करना", "Definir el alcance, los clientes, la competencia y los supuestos", "Définir le périmètre, les clients, la concurrence et les hypothèses", "دائرہ کار، گاہک، مسابقت اور مفروضات متعین کرنا"),
  },
  bizAnalysis: {
    title: L("التحليل والأدلة", "Analysis and evidence", "Analiz ve kanıt", "分析与证据", "विश्लेषण और प्रमाण", "Análisis y evidencia", "Analyse et preuves", "تجزیہ اور شواہد"),
    purpose: L("تطوير الحجة باستخدام بيانات ومصادر قابلة للتحقق", "Build the argument on data and sources that can be verified", "Savı doğrulanabilir veri ve kaynaklarla kurmak", "以可核实的数据与来源构建论证", "सत्यापन-योग्य डेटा व स्रोतों पर तर्क खड़ा करना", "Construir el argumento con datos y fuentes verificables", "Construire l'argumentation sur des données et sources vérifiables", "قابلِ تصدیق ڈیٹا اور مآخذ پر دلیل کھڑی کرنا"),
  },
  bizOptions: {
    title: L("البدائل والتوصية", "Options and recommendation", "Seçenekler ve öneri", "方案比较与建议", "विकल्प और सिफ़ारिश", "Opciones y recomendación", "Options et recommandation", "متبادل اور سفارش"),
    purpose: L("مقارنة الخيارات وتبرير التوصية والمفاضلات", "Compare the options and justify the recommendation and its trade-offs", "Seçenekleri karşılaştırmak, öneriyi ve ödünleşimleri gerekçelendirmek", "比较各方案，论证推荐意见及其取舍", "विकल्पों की तुलना कर सिफ़ारिश और उसके ट्रेड-ऑफ़ को उचित ठहराना", "Comparar las opciones y justificar la recomendación y sus compensaciones", "Comparer les options et justifier la recommandation et ses arbitrages", "اختیارات کا موازنہ اور سفارش و اُس کے تبادلوں کا جواز"),
  },
  bizPlan: {
    title: L("خطة التنفيذ والقياس", "Implementation and measurement plan", "Uygulama ve ölçüm planı", "实施与衡量计划", "क्रियान्वयन और मापन योजना", "Plan de implementación y medición", "Plan de mise en œuvre et de mesure", "نفاذ اور پیمائش کا منصوبہ"),
    purpose: L("تحديد المراحل والموارد والمخاطر ومؤشرات النجاح", "Set out the phases, resources, risks and success indicators", "Aşamaları, kaynakları, riskleri ve başarı göstergelerini belirlemek", "明确阶段、资源、风险与成功指标", "चरण, संसाधन, जोखिम और सफलता संकेतक निर्धारित करना", "Establecer las fases, los recursos, los riesgos y los indicadores de éxito", "Définir les phases, les ressources, les risques et les indicateurs de réussite", "مراحل، وسائل، خطرات اور کامیابی کے اشاریے طے کرنا"),
  },
  bizConclusion: {
    title: L("الخاتمة", "Conclusion", "Sonuç", "结论", "निष्कर्ष", "Conclusión", "Conclusion", "نتیجہ"),
    purpose: L("تجميع القرار والقيمة والخطوة التالية", "Bring the decision, the value and the next step together", "Kararı, değeri ve sonraki adımı bir araya getirmek", "汇总决策、价值与下一步", "निर्णय, मूल्य और अगला कदम एक साथ रखना", "Reunir la decisión, el valor y el siguiente paso", "Réunir la décision, la valeur et l'étape suivante", "فیصلہ، افادیت اور اگلا قدم یکجا کرنا"),
  },
  genIntro: {
    title: L("المقدمة", "Introduction", "Giriş", "引言", "परिचय", "Introducción", "Introduction", "تعارف"),
    purpose: L("تحديد الموضوع والسؤال والنطاق وخريطة المشروع", "Set out the topic, the question, the scope and the map of the project", "Konuyu, soruyu, kapsamı ve projenin yol haritasını ortaya koymak", "界定主题、问题、范围与全文结构", "विषय, प्रश्न, दायरा और प्रोजेक्ट की रूपरेखा तय करना", "Definir el tema, la pregunta, el alcance y el mapa del proyecto", "Poser le sujet, la question, le périmètre et le plan du projet", "موضوع، سوال، دائرہ کار اور پروجیکٹ کا نقشہ متعین کرنا"),
  },
  genBackground: {
    title: L("الخلفية والمفاهيم", "Background and key concepts", "Arka plan ve temel kavramlar", "背景与核心概念", "पृष्ठभूमि और मुख्य अवधारणाएँ", "Antecedentes y conceptos clave", "Contexte et concepts clés", "پس منظر اور بنیادی تصورات"),
    purpose: L("تعريف المفاهيم وبناء سياق مدعوم بالأدلة", "Define the concepts and build a context supported by evidence", "Kavramları tanımlamak ve kanıta dayalı bir bağlam kurmak", "界定概念并建立有证据支撑的背景", "अवधारणाएँ परिभाषित कर प्रमाण-समर्थित संदर्भ बनाना", "Definir los conceptos y construir un contexto apoyado en evidencia", "Définir les concepts et bâtir un contexte étayé par des preuves", "تصورات کی تعریف اور شواہد پر مبنی سیاق بنانا"),
  },
  genAnalysis: {
    title: L("التحليل", "Analysis", "Analiz", "分析", "विश्लेषण", "Análisis", "Analyse", "تجزیہ"),
    purpose: L("تطوير الحجة ومناقشة البدائل والأدلة", "Develop the argument and discuss the alternatives and the evidence", "Savı geliştirmek, alternatifleri ve kanıtları tartışmak", "推进论证，讨论替代解释与证据", "तर्क विकसित करना और विकल्पों व प्रमाणों पर चर्चा", "Desarrollar el argumento y discutir las alternativas y la evidencia", "Développer l'argumentation et discuter les alternatives et les preuves", "دلیل کو آگے بڑھانا اور متبادل و شواہد پر بحث"),
  },
  genApplication: {
    title: L("التطبيق أو دراسة الحالة", "Application or case study", "Uygulama veya vaka çalışması", "应用或案例研究", "अनुप्रयोग या केस स्टडी", "Aplicación o estudio de caso", "Application ou étude de cas", "اطلاق یا کیس اسٹڈی"),
    purpose: L("تطبيق التحليل على حالة مناسبة دون اختلاق حقائق", "Apply the analysis to a suitable case without inventing facts", "Analizi uygun bir vakaya, olgu uydurmadan uygulamak", "将分析应用于合适案例，不得编造事实", "विश्लेषण को उपयुक्त प्रकरण पर लागू करना, तथ्य गढ़े बिना", "Aplicar el análisis a un caso adecuado sin inventar hechos", "Appliquer l'analyse à un cas approprié sans inventer de faits", "تجزیے کو مناسب مثال پر لاگو کرنا، حقائق گھڑے بغیر"),
  },
  genEvaluation: {
    title: L("المناقشة والتقييم", "Discussion and evaluation", "Tartışma ve değerlendirme", "讨论与评价", "चर्चा और मूल्यांकन", "Discusión y evaluación", "Discussion et évaluation", "بحث اور تشخیص"),
    purpose: L("فحص القوة والقيود والاعتراضات", "Examine the strengths, the limitations and the objections", "Güçlü yanları, sınırlılıkları ve itirazları incelemek", "检视优势、局限与反驳意见", "शक्तियाँ, सीमाएँ और आपत्तियाँ परखना", "Examinar las fortalezas, las limitaciones y las objeciones", "Examiner les forces, les limites et les objections", "قوت، حدود اور اعتراضات کا جائزہ"),
  },
  genConclusion: {
    title: L("الخاتمة والتوصيات", "Conclusion and recommendations", "Sonuç ve öneriler", "结论与建议", "निष्कर्ष और सिफ़ारिशें", "Conclusión y recomendaciones", "Conclusion et recommandations", "نتیجہ اور سفارشات"),
    purpose: L("تلخيص الاستنتاجات والإجابة عن هدف المشروع", "Summarise the conclusions and answer the project objective", "Sonuçları özetlemek ve proje amacını yanıtlamak", "总结结论并回应项目目标", "निष्कर्षों का सार देना और प्रोजेक्ट उद्देश्य का उत्तर देना", "Resumir las conclusiones y responder al objetivo del proyecto", "Résumer les conclusions et répondre à l'objectif du projet", "نتائج کا خلاصہ اور پروجیکٹ کے مقصد کا جواب"),
  },
} as const satisfies Record<string, SectionCopy>;

const XRAY = {
  shortTitle: L("المسودة أقصر من مشروع متكامل", "The draft is shorter than a complete project", "Taslak, tam bir projeden kısa", "草稿篇幅短于一个完整项目", "मसौदा एक पूर्ण प्रोजेक्ट से छोटा है", "El borrador es más corto que un proyecto completo", "Le brouillon est plus court qu'un projet complet", "مسودہ مکمل پروجیکٹ سے چھوٹا ہے"),
  shortDetail: L("تم رصد {words} كلمة تقريباً.", "About {words} words were detected.", "Yaklaşık {words} kelime saptandı.", "检测到约 {words} 个词。", "लगभग {words} शब्द मिले।", "Se detectaron unas {words} palabras.", "Environ {words} mots ont été détectés.", "تقریباً {words} الفاظ ملے۔"),
  shortAction: L("ابنِ الأقسام الناقصة من متطلبات التكليف قبل تحسين الأسلوب.", "Build the missing sections from the assignment requirements before polishing the style.", "Üslubu iyileştirmeden önce eksik bölümleri ödev gereksinimlerinden kurun.", "先依作业要求补齐缺失章节，再打磨文风。", "शैली सुधारने से पहले असाइनमेंट आवश्यकताओं से छूटे अनुभाग बनाएँ।", "Construye las secciones faltantes a partir de los requisitos antes de pulir el estilo.", "Construisez les sections manquantes à partir des exigences avant de peaufiner le style.", "اسلوب سنوارنے سے پہلے اسائنمنٹ کے تقاضوں سے غائب حصے بنائیں۔"),
  sizeOkTitle: L("للمسودة حجم قابل للمراجعة", "The draft has a reviewable size", "Taslak, gözden geçirilebilir uzunlukta", "草稿篇幅已可进入审阅", "मसौदा समीक्षा-योग्य लंबाई का है", "El borrador tiene un tamaño revisable", "Le brouillon a une taille exploitable", "مسودہ قابلِ جائزہ حجم رکھتا ہے"),
  sizeOkDetail: L("تم رصد {words} كلمة و{headings} عناوين.", "{words} words and {headings} headings were detected.", "{words} kelime ve {headings} başlık saptandı.", "检测到 {words} 个词、{headings} 个标题。", "{words} शब्द और {headings} शीर्षक मिले।", "Se detectaron {words} palabras y {headings} encabezados.", "{words} mots et {headings} titres ont été détectés.", "{words} الفاظ اور {headings} عنوانات ملے۔"),
  sizeOkAction: L("راجع توازن طول الأقسام.", "Check that the sections are balanced in length.", "Bölüm uzunluklarının dengesini gözden geçirin.", "检查各章节篇幅是否均衡。", "अनुभागों की लंबाई का संतुलन जाँचें।", "Revisa el equilibrio de longitud entre secciones.", "Vérifiez l'équilibre de longueur entre les sections.", "حصوں کی لمبائی کا توازن دیکھیں۔"),
  sourcesWeakTitle: L("الدعم المرجعي ضعيف", "Referencing support is weak", "Kaynak desteği zayıf", "文献支撑薄弱", "संदर्भ समर्थन कमज़ोर है", "El respaldo de fuentes es débil", "L'appui bibliographique est faible", "حوالہ جاتی معاونت کمزور ہے"),
  sourcesWeakWith: L("تم رصد {citations} إحالات داخلية مع قسم مراجع.", "{citations} in-text citations were detected alongside a references section.", "Kaynakça bölümüyle birlikte {citations} metin içi atıf saptandı.", "检测到 {citations} 处文内引用，并有参考文献部分。", "संदर्भ अनुभाग सहित {citations} इन-टेक्स्ट उद्धरण मिले।", "Se detectaron {citations} citas en el texto junto con una sección de referencias.", "{citations} citations dans le texte ont été détectées avec une section de références.", "حوالہ جات کے حصے کے ساتھ {citations} متنی حوالے ملے۔"),
  sourcesWeakWithout: L("تم رصد {citations} إحالات داخلية دون قسم مراجع واضح.", "{citations} in-text citations were detected with no clear references section.", "Açık bir kaynakça bölümü olmadan {citations} metin içi atıf saptandı.", "检测到 {citations} 处文内引用，但没有明确的参考文献部分。", "स्पष्ट संदर्भ अनुभाग के बिना {citations} इन-टेक्स्ट उद्धरण मिले।", "Se detectaron {citations} citas en el texto sin una sección de referencias clara.", "{citations} citations dans le texte ont été détectées sans section de références claire.", "واضح حوالہ جات کے حصے کے بغیر {citations} متنی حوالے ملے۔"),
  sourcesWeakAction: L("أضف مصادر حقيقية متحققة واربط كل ادعاء رئيسي بها.", "Add real, verified sources and attach every major claim to one.", "Gerçek ve doğrulanmış kaynaklar ekleyip her temel iddiayı bunlara bağlayın.", "补充真实且已核实的来源，并将每个主要论点与之对应。", "वास्तविक, सत्यापित स्रोत जोड़ें और हर मुख्य दावे को उनसे जोड़ें।", "Añade fuentes reales y verificadas y vincula cada afirmación principal a una de ellas.", "Ajoutez des sources réelles et vérifiées et rattachez-y chaque affirmation majeure.", "حقیقی، تصدیق شدہ مآخذ شامل کریں اور ہر بڑے دعوے کو اُن سے جوڑیں۔"),
  sourcesOkTitle: L("يوجد أساس مرجعي", "A referencing base is present", "Kaynak temeli mevcut", "已具备文献基础", "संदर्भ आधार मौजूद है", "Existe una base de referencias", "Une base bibliographique est présente", "حوالہ جاتی بنیاد موجود ہے"),
  sourcesOkDetail: L("تم رصد {citations} إحالات وقسم للمراجع.", "{citations} citations and a references section were detected.", "{citations} atıf ve bir kaynakça bölümü saptandı.", "检测到 {citations} 处引用及参考文献部分。", "{citations} उद्धरण और एक संदर्भ अनुभाग मिला।", "Se detectaron {citations} citas y una sección de referencias.", "{citations} citations et une section de références ont été détectées.", "{citations} حوالے اور حوالہ جات کا حصہ ملا۔"),
  sourcesOkAction: L("تحقق يدوياً من DOI والروابط والصفحات.", "Manually verify the DOIs, links and page numbers.", "DOI, bağlantı ve sayfa numaralarını elle doğrulayın.", "手动核验 DOI、链接与页码。", "DOI, लिंक और पृष्ठ संख्याएँ स्वयं सत्यापित करें।", "Verifica manualmente los DOI, enlaces y páginas.", "Vérifiez manuellement les DOI, liens et pages.", "DOI، روابط اور صفحات خود جانچیں۔"),
  rubricWeakTitle: L("تغطية الـRubric غير واضحة", "Rubric coverage is unclear", "Rubrik kapsamı belirsiz", "评分标准覆盖不清晰", "रूब्रिक कवरेज अस्पष्ट है", "La cobertura de la rúbrica no está clara", "La couverture de la grille n'est pas claire", "روبرک کی کوریج واضح نہیں"),
  rubricDetail: L("التغطية النصية التقديرية {rubric}%.", "Estimated textual coverage is {rubric}%.", "Tahmini metinsel kapsam %{rubric}.", "文本覆盖估计为 {rubric}%。", "अनुमानित पाठ्य कवरेज {rubric}% है।", "La cobertura textual estimada es del {rubric}%.", "La couverture textuelle estimée est de {rubric} %.", "متن میں تخمینی کوریج {rubric}% ہے۔"),
  rubricWeakAction: L("اربط كل معيار بعنوان أو فقرة ودليل محدد.", "Tie every criterion to a heading or paragraph and a specific piece of evidence.", "Her ölçütü bir başlığa ya da paragrafa ve belirli bir kanıta bağlayın.", "将每条标准对应到具体标题或段落及具体证据。", "हर मानदंड को किसी शीर्षक/अनुच्छेद और विशिष्ट प्रमाण से जोड़ें।", "Vincula cada criterio a un encabezado o párrafo y a una evidencia concreta.", "Rattachez chaque critère à un titre ou paragraphe et à une preuve précise.", "ہر معیار کو کسی عنوان یا پیراگراف اور مخصوص شہادت سے جوڑیں۔"),
  rubricOkTitle: L("الـRubric ظاهر في بنية المشروع", "The rubric is visible in the project structure", "Rubrik, proje yapısında görünür", "评分标准已体现在结构中", "रूब्रिक प्रोजेक्ट संरचना में दिखता है", "La rúbrica se refleja en la estructura del proyecto", "La grille apparaît dans la structure du projet", "روبرک پروجیکٹ کی ساخت میں نظر آتا ہے"),
  rubricOkAction: L("أكّد مواضع الأدلة قبل التسليم.", "Confirm where each piece of evidence sits before submitting.", "Teslimden önce kanıtların yerlerini doğrulayın.", "提交前确认各处证据的位置。", "जमा करने से पहले प्रमाणों की स्थिति की पुष्टि करें।", "Confirma la ubicación de cada evidencia antes de entregar.", "Confirmez l'emplacement de chaque preuve avant de rendre.", "جمع کرانے سے پہلے شواہد کے مقامات کی تصدیق کریں۔"),
  duplicateTitle: L("يوجد تكرار حرفي", "There is verbatim repetition", "Birebir tekrar var", "存在逐字重复", "शब्दशः पुनरावृत्ति है", "Hay repetición literal", "Il y a des répétitions littérales", "لفظی تکرار موجود ہے"),
  duplicateDetail: L("تم رصد {duplicates} جمل طويلة مكررة.", "{duplicates} repeated long sentences were detected.", "{duplicates} tekrar eden uzun cümle saptandı.", "检测到 {duplicates} 处重复的长句。", "{duplicates} दोहराए गए लंबे वाक्य मिले।", "Se detectaron {duplicates} oraciones largas repetidas.", "{duplicates} longues phrases répétées ont été détectées.", "{duplicates} دہرائے گئے طویل جملے ملے۔"),
  duplicateAction: L("ادمج الفقرات واحتفظ بالنسخة الأقوى فقط.", "Merge the paragraphs and keep only the stronger version.", "Paragrafları birleştirip yalnızca daha güçlü sürümü tutun.", "合并相关段落，只保留更有力的一版。", "अनुच्छेदों को मिलाएँ और केवल मज़बूत संस्करण रखें।", "Fusiona los párrafos y conserva solo la versión más sólida.", "Fusionnez les paragraphes et ne gardez que la version la plus solide.", "پیراگراف ضم کریں اور صرف مضبوط نسخہ رکھیں۔"),
  residueTitle: L("بقايا توليد ظاهرة", "Visible generation residue", "Görünür üretim artıkları", "存在明显的生成残留", "स्पष्ट जनरेशन अवशेष", "Restos visibles de generación", "Résidus de génération visibles", "نمایاں تخلیقی باقیات"),
  residueDetail: L("توجد عبارات لا تنتمي إلى المستند الأكاديمي.", "The text contains phrases that do not belong in an academic document.", "Metinde akademik bir belgeye ait olmayan ifadeler var.", "文中出现不属于学术文档的表述。", "पाठ में ऐसे वाक्यांश हैं जो अकादमिक दस्तावेज़ में नहीं होने चाहिए।", "El texto contiene frases que no corresponden a un documento académico.", "Le texte contient des formules qui n'ont pas leur place dans un document académique.", "متن میں ایسے جملے ہیں جو تعلیمی دستاویز کا حصہ نہیں ہونے چاہئیں۔"),
  residueAction: L("احذف بقايا المحادثة وراجع الانتقالات.", "Delete the chat residue and review the transitions.", "Sohbet artıklarını silin ve geçişleri gözden geçirin.", "删除对话残留并检查段落过渡。", "चैट अवशेष हटाएँ और संक्रमण जाँचें।", "Elimina los restos de chat y revisa las transiciones.", "Supprimez les résidus de conversation et revoyez les transitions.", "چیٹ کی باقیات حذف کریں اور انتقالات دیکھیں۔"),
  profQ1: L("ما المشكلة التي يحلها مشروع «{title}» تحديداً؟", "What exactly is the problem that “{title}” solves?", "“{title}” tam olarak hangi problemi çözüyor?", "《{title}》究竟解决了什么问题？", "“{title}” वास्तव में किस समस्या को हल करता है?", "¿Qué problema resuelve exactamente «{title}»?", "Quel problème « {title} » résout-il exactement ?", "«{title}» دراصل کون سا مسئلہ حل کرتا ہے؟"),
  profQ2Rubric: L("أين الدليل الذي يثبت تحقيق معيار «{criterion}»؟", "Where is the evidence that the “{criterion}” criterion is met?", "“{criterion}” ölçütünün karşılandığını gösteren kanıt nerede?", "证明满足“{criterion}”标准的证据在哪里？", "“{criterion}” मानदंड पूरा होने का प्रमाण कहाँ है?", "¿Dónde está la evidencia de que se cumple el criterio «{criterion}»?", "Où se trouve la preuve que le critère « {criterion} » est satisfait ?", "«{criterion}» معیار پورا ہونے کا ثبوت کہاں ہے؟"),
  profQ2Fallback: L("ما المعيار الذي استخدمته للحكم على جودة العمل؟", "What criterion did you use to judge the quality of the work?", "Çalışmanın kalitesini hangi ölçüte göre değerlendirdiniz?", "你用什么标准来判断这项工作的质量？", "आपने कार्य की गुणवत्ता आँकने के लिए कौन-सा मानदंड इस्तेमाल किया?", "¿Qué criterio usaste para juzgar la calidad del trabajo?", "Quel critère avez-vous utilisé pour juger la qualité du travail ?", "آپ نے کام کے معیار کو پرکھنے کے لیے کون سا معیار استعمال کیا؟"),
  profQ3: L("ما أضعف افتراض في المشروع؟ وما الذي سيتغير لو كان خاطئاً؟", "What is the weakest assumption in the project, and what would change if it were wrong?", "Projedeki en zayıf varsayım nedir ve yanlış çıkarsa ne değişir?", "项目中最薄弱的假设是什么？若它不成立会有什么变化？", "प्रोजेक्ट की सबसे कमज़ोर मान्यता कौन-सी है, और वह ग़लत हो तो क्या बदलेगा?", "¿Cuál es el supuesto más débil del proyecto y qué cambiaría si fuera falso?", "Quelle est l'hypothèse la plus fragile du projet, et qu'est-ce qui changerait si elle était fausse ?", "پروجیکٹ کا کمزور ترین مفروضہ کون سا ہے، اور غلط ہونے پر کیا بدلے گا؟"),
  profQ4: L("أي نتيجة تعتمد على بيانات فعلية، وأي جزء ما زال مقترحاً أو محاكاة؟", "Which result rests on real data, and which part is still proposed or simulated?", "Hangi sonuç gerçek veriye dayanıyor, hangi kısım hâlâ önerilmiş ya da benzetim?", "哪些结果基于真实数据？哪些部分仍属设想或模拟？", "कौन-सा परिणाम वास्तविक डेटा पर टिका है और कौन-सा हिस्सा अभी प्रस्तावित या नकली है?", "¿Qué resultado se apoya en datos reales y qué parte sigue siendo propuesta o simulada?", "Quel résultat repose sur des données réelles, et quelle partie reste proposée ou simulée ?", "کون سا نتیجہ حقیقی ڈیٹا پر ہے اور کون سا حصہ ابھی تجویز یا نقل ہے؟"),
} as const;

const ARGUMENT_SHAPES = [
  "problem-to-evidence-to-recommendation",
  "question-to-comparison-to-judgement",
  "context-to-mechanism-to-implication",
  "claim-to-counterclaim-to-synthesis",
  "case-to-pattern-to-practical-action",
];
const STRUCTURE_RHYTHMS = [
  "short opening, evidence-rich middle, decisive close",
  "concept first, applied example second, implication last",
  "progressive questions with explicit transitions",
  "comparison-led paragraphs with a compact synthesis",
  "case-led explanation followed by general principles",
];
const EXPLANATION_STYLES = [
  "plain academic prose with compact definitions",
  "formal academic prose with clear signposting",
  "analytical prose using cause-and-effect links",
  "evidence-led prose with careful qualification",
  "direct student voice with disciplined academic wording",
];
const EXAMPLE_LENSES = [
  "locally relevant context where genuinely supported by the assignment or student input",
  "small realistic case comparison",
  "process and decision-making example",
  "stakeholder impact example",
  "implementation and measurement example",
  "risk and alternative-scenario example",
];

function pick<T>(items: T[], digest: Buffer, offset: number) {
  return items[digest[offset % digest.length] % items.length];
}

export function buildVariationProfile(
  project: ProjectDNA,
  userId: string,
  secret = process.env.PROJECT_VARIATION_SECRET ||
    process.env.CSRF_SIGNING_SECRET ||
    "academicos-development-variation-v1",
): ProjectVariationProfile {
  const assignmentFingerprint = [
    project.course,
    project.title,
    project.projectType,
    project.originalAssignment?.text?.slice(0, 800) || "",
  ].join("|");
  const digest = createHmac("sha256", secret)
    .update(`${userId}|${project.id}|${assignmentFingerprint}`)
    .digest();
  return {
    id: digest.toString("hex").slice(0, 12),
    argumentShape: pick(ARGUMENT_SHAPES, digest, 0),
    structureRhythm: pick(STRUCTURE_RHYTHMS, digest, 7),
    explanationStyle: pick(EXPLANATION_STYLES, digest, 13),
    exampleLens: pick(EXAMPLE_LENSES, digest, 19),
  };
}

function normalizeLanguage(value?: string) {
  const language = String(value || "English").trim().slice(0, 80);
  return language || "English";
}

function words(value: string) {
  return value.trim() ? value.trim().split(/\s+/u).length : 0;
}

function sectionSlug(title: string, index: number) {
  const slug = title
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return slug || `section-${index + 1}`;
}

function includesAny(value: string, needles: string[]) {
  const normalized = value.toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}

export function decideProjectWritingAccess(
  project: ProjectDNA,
  assistanceMode: AcademicAssistanceMode,
  locale: ServerLocale = resolveServerLocale(project.language),
) {
  const prohibited = (project.aiPolicy.prohibited || []).join(" ");
  const explicitBan = /no ai|ai not allowed|artificial intelligence prohibited|ممنوع.*ذكاء|منع.*ذكاء/i.test(
    prohibited,
  );
  if (assistanceMode === "practice") {
    return { fullDraft: true, disclosure: tx(COPY.practiceDisclosure, locale) };
  }
  if (assistanceMode === "policy_strict") {
    return { fullDraft: false, disclosure: tx(COPY.strictDisclosure, locale) };
  }
  if (
    project.aiPolicy.needsConfirmation ||
    project.aiPolicy.provenance === "extracted_unverified" ||
    project.aiPolicy.level < 4 ||
    explicitBan
  ) {
    throw Object.assign(new Error(tx(COPY.policyBlocked, locale)), {
      status: 403,
      code: "PROJECT_WRITING_POLICY_BLOCKED",
    });
  }
  return {
    fullDraft: true,
    disclosure: txf(
      project.aiPolicy.disclosureRequired
        ? COPY.disclosureRequired
        : COPY.disclosureConfirmed,
      locale,
      { policy: project.aiPolicy.summary },
    ),
  };
}

function buildSectionPlan(
  project: ProjectDNA,
  desiredPages: number,
  locale: ServerLocale,
) {
  const haystack = `${project.projectType} ${project.academicDomain} ${project.title}`;
  const isResearch = includesAny(haystack, [
    "research",
    "بحث",
    "thesis",
    "رسالة",
    "دراسة",
    "araştırma",
    "研究",
    "शोध",
    "investigación",
    "recherche",
    "تحقیق",
  ]);
  const isTechnical = includesAny(haystack, [
    "engineering",
    "software",
    "computer",
    "تقني",
    "هندس",
    "برمج",
    "code",
    "mühendislik",
    "yazılım",
    "工程",
    "软件",
    "इंजीनियरिंग",
    "सॉफ़्टवेयर",
    "ingeniería",
    "ingénierie",
    "logiciel",
    "انجینئرنگ",
  ]);
  const isBusiness = includesAny(haystack, [
    "business",
    "market",
    "management",
    "تسويق",
    "إدارة",
    "أعمال",
    "işletme",
    "pazarlama",
    "商业",
    "市场",
    "管理",
    "व्यवसाय",
    "प्रबंधन",
    "negocio",
    "mercado",
    "gestión",
    "affaires",
    "marché",
    "کاروبار",
    "انتظام",
  ]);
  const core: SectionCopy[] = isResearch
    ? [
        SECTION.researchIntro,
        SECTION.researchLiterature,
        SECTION.researchMethodology,
        SECTION.researchResults,
        SECTION.researchDiscussion,
        SECTION.researchConclusion,
      ]
    : isTechnical
      ? [
          SECTION.techIntro,
          SECTION.techAlternatives,
          SECTION.techArchitecture,
          SECTION.techImplementation,
          SECTION.techTesting,
          SECTION.techConclusion,
        ]
      : isBusiness
        ? [
            SECTION.bizSummary,
            SECTION.bizContext,
            SECTION.bizAnalysis,
            SECTION.bizOptions,
            SECTION.bizPlan,
            SECTION.bizConclusion,
          ]
        : [
            SECTION.genIntro,
            SECTION.genBackground,
            SECTION.genAnalysis,
            SECTION.genApplication,
            SECTION.genEvaluation,
            SECTION.genConclusion,
          ];
  const totalTargetWords = Math.max(900, Math.min(12_000, desiredPages * 330));
  return core.map((entry, index) => {
    const title = tx(entry.title, locale);
    return {
      // The id stays language-independent so saved artifacts keep matching after
      // a learner switches the project language.
      id: sectionSlug(tx(entry.title, "en"), index),
      title,
      purpose: tx(entry.purpose, locale),
      targetWords: Math.round(totalTargetWords / core.length),
    };
  });
}

function nativeSection(
  project: ProjectDNA,
  title: string,
  purpose: string,
  locale: ServerLocale,
) {
  const required = project.requirements
    .slice(0, 4)
    .map((item) => `- ${item.label}: ${item.value}`)
    .join("\n");
  return txf(COPY.scaffoldIntro, locale, {
    title,
    purpose,
    requirements: required || tx(COPY.scaffoldFallbackRequirement, locale),
  });
}

function sectionExplanation(title: string, purpose: string, locale: ServerLocale) {
  return txf(COPY.sectionExplanation, locale, { title, purpose });
}

function compactMemory(sections: ProjectDocumentSection[]) {
  return sections
    .slice(-3)
    .map((section) => `${section.title}: ${section.content.slice(0, 650)}`)
    .join("\n\n")
    .slice(0, 2500);
}

export async function composeProjectDocument(input: {
  project: ProjectDNA;
  request: ProjectWriterRequest;
  userId: string;
  locale?: string;
  verifiedSources?: VerifiedSourceInput[];
  groundedSources?: GroundedSourceInput[];
  groundedResearchSummary?: string;
  groundedResearchQueries?: string[];
  generateSection?: ProjectWriterGenerator;
  variationSecret?: string;
}): Promise<ProjectDocument> {
  const { project, request, userId } = input;
  const language = normalizeLanguage(request.language);
  // The generated scaffolding, defense questions and disclosures follow the same
  // language the prose is written in, so nothing renders in a foreign script.
  const locale = resolveServerLocale(request.language, input.locale, project.language);
  const desiredPages = Math.max(3, Math.min(35, Number(request.desiredPages || 12)));
  const access = decideProjectWritingAccess(project, request.assistanceMode, locale);
  const variation = buildVariationProfile(project, userId, input.variationSecret);
  const plan = buildSectionPlan(project, desiredPages, locale);
  const verifiedSources = (input.verifiedSources || []).filter(
    (source) =>
      source.verification === "verified" ||
      source.verification === "user_verified" ||
      source.verification === "institution_verified",
  );

  const groundedSources = (input.groundedSources || [])
    .filter((source) => source?.title || source?.url)
    .slice(0, 20);

  const groundedResearchSummary = String(
    input.groundedResearchSummary || "",
  ).trim();

  const groundedResearchQueries = (input.groundedResearchQueries || [])
    .map((query) => String(query || "").trim())
    .filter(Boolean)
    .slice(0, 12);

  const sections: ProjectDocumentSection[] = [];

  const rawTopicNotes = (request.topicNotes || "").trim();
  const rawProjectTitle = (project.title || "").trim();

  const invalidProjectTitle =
    !rawProjectTitle ||
    /EXISTING DRAFT|NEW ASSIGNMENT|TITLE NEEDS CONFIRMATION/i.test(rawProjectTitle);

  const primaryTopic =
    rawTopicNotes ||
    (!invalidProjectTitle ? rawProjectTitle : "");

  if (!primaryTopic) {
    throw new Error(
      "PROJECT_TOPIC_REQUIRED: A clear project topic is required before academic writing can begin.",
    );
  }

  const sourceMarker = tx(COPY.sourceNeeded, locale);

  for (let index = 0; index < plan.length; index += 1) {
    const item = plan[index];
    let output: AcademicTaskOutput | undefined;
    if (input.generateSection) {
      const existing = (request.existingDraft || "").slice(0, 24_000);
      const feedback = (request.professorFeedback || "").slice(0, 8_000);
      output = await input.generateSection({
        sectionTitle: item.title,
        purpose: item.purpose,
        targetWords: item.targetWords,
        previousMemory: compactMemory(sections),
        prompt: [
          `Write section ${index + 1} of ${plan.length} in ${language}.`,
          `PRIMARY PROJECT TOPIC — this is the controlling subject for the entire response: ${primaryTopic}`,
          `Project title metadata: ${invalidProjectTitle ? "not reliably identified" : project.title}. Course: ${project.course}. Domain: ${project.academicDomain}.`,
          `Purpose of this section: ${item.purpose}. Target approximately ${item.targetWords} words.`,
          "Every paragraph must directly advance the PRIMARY PROJECT TOPIC. Do not write generic academic filler that could apply to another topic.",
          "Use the precise concepts, population, setting, variables, technologies, theories, or problems explicitly present in the student's topic whenever applicable.",
          "Begin with substantive content about the topic itself. Never begin with meta-writing such as 'this section discusses', 'this is a preliminary section', 'the purpose of this section is', or instructions to a future writer.",
          "Do not expose internal workflow labels, scaffolding instructions, system terminology, EXISTING DRAFT markers, provider names, or implementation details to the learner.",
          "Distinguish verified evidence from explanation. Never pretend that a source was researched or verified when it was not.",
"Grounded web sources are research-grounded references, not automatically peer-reviewed or bibliographically verified. Never describe them as verified academic sources unless they also appear in VERIFIED ACADEMIC SOURCES.",
groundedResearchSummary
  ? `GROUNDED RESEARCH FINDINGS:\n${groundedResearchSummary.slice(0, 12000)}`
  : "GROUNDED RESEARCH FINDINGS: none available.",
groundedSources.length
  ? `GROUNDED WEB SOURCES:\n${groundedSources.map((source, index) => `${index + 1}. ${source.title}${source.url ? ` — ${source.url}` : ""}${source.snippet ? `\n   Evidence snippet: ${source.snippet}` : ""}`).join("\n")}`
  : "GROUNDED WEB SOURCES: none available.",
groundedResearchQueries.length
  ? `SEARCH QUERIES USED:\n${groundedResearchQueries.join("\n")}`
  : "",
          `Student-specific variation ID: ${variation.id}. Use ${variation.argumentShape}; ${variation.structureRhythm}; ${variation.explanationStyle}; example lens: ${variation.exampleLens}.`,
          "This variation is a deliberate anti-duplication constraint. Do not reuse stock introductions, generic paragraph templates, or identical example sequences across learners.",
          access.fullDraft
            ? "Produce a coherent full draft for learning or policy-permitted use."
            : "Produce a detailed guided scaffold with questions and sentence starters, not final submission prose.",
          "Never invent a citation, DOI, author, dataset, participant, experiment, result, quote, or completed action.",
          verifiedSources.length
            ? `Only the following sources may be described as verified: ${verifiedSources.map((source) => `${source.title}${source.sourceUrl ? ` (${source.sourceUrl})` : ""}`).join("; ")}.`
            : `No verified sources were supplied. Use explicit ${sourceMarker} markers wherever evidence is needed, written in ${language}.`,
          `Student topic/context: ${primaryTopic.slice(0, 5000)}`,
          request.learnerVoiceSample
            ? `Preserve the student's transparent writing preferences without attempting to evade AI detection. Voice sample: ${request.learnerVoiceSample.slice(0, 1800)}`
            : "",
          request.mode === "rescue" && existing
            ? `Rescue the relevant ideas from this existing draft, correcting contradictions and unsupported language: ${existing}`
            : "",
          request.mode === "revise" && feedback
            ? `Apply this professor feedback and make the change visible in the section: ${feedback}`
            : "",
          `Confirmed requirements: ${project.requirements.map((requirement) => `${requirement.label}: ${requirement.value}`).join(" | ")}`,
          `Rubric: ${project.rubric.map((criterion) => `${criterion.id}:${criterion.title} (${criterion.weighting}%)`).join(" | ")}`,
          `Write every part of the response — prose, explanation, defense questions and warnings — in ${language}.`,
          "Return the section prose in summary, a plain-language explanation in findings, defense questions in suggestions, and integrity/source warnings in warnings.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      });
    }
    const generatedContent = output?.summary?.trim();
    const content = input.generateSection
      ? generatedContent
      : nativeSection(project, item.title, item.purpose, locale);

    if (!content) {
      throw new Error(
        `AI_WRITER_NO_CONTENT: The AI writer did not return usable content for section "${item.title}". Refusing to expose a generic fallback as finished academic writing.`,
      );
    }
    const rubricIds = project.rubric
      .filter((_, rubricIndex) => rubricIndex % plan.length === index)
      .map((criterion) => criterion.id);
    sections.push({
      id: item.id,
      title: item.title,
      purpose: item.purpose,
      content,
      explanation:
        output?.findings?.filter(Boolean).slice(0, 3).join(" ") ||
        sectionExplanation(item.title, item.purpose, locale),
      sourceNotes: output?.warnings?.filter(Boolean).slice(0, 8) || [],
      defenseQuestions:
        output?.suggestions?.filter(Boolean).slice(0, 5) || [
          txf(COPY.defenseQuestionPurpose, locale, { title: item.title }),
          tx(COPY.defenseQuestionEvidence, locale),
        ],
      rubricIds,
      status:
        access.fullDraft && verifiedSources.length ? "verified" : "draft",
      wordCount: words(content),
    });
  }

  const now = new Date().toISOString();
  const rubricCovered = new Set(sections.flatMap((section) => section.rubricIds));
  const sourceWarnings = sections.flatMap((section) => section.sourceNotes);
  const integrityWarnings = [
    ...new Set([
      ...sourceWarnings,
      ...(verifiedSources.length
        ? []
        : [txf(COPY.noVerifiedSources, locale, { marker: sourceMarker })]),
      ...(request.mode === "rescue" && !request.existingDraft
        ? [tx(COPY.rescueNeedsDraft, locale)]
        : []),
    ]),
  ].slice(0, 20);
  return {
    id: randomUUID(),
    projectId: project.id,
    mode: request.mode,
    assistanceMode: request.assistanceMode,
    language,
    title: project.title,
    abstract: txf(COPY.abstract, locale, {
      title: project.title,
      count: sections.length,
    }),
    sections,
    bibliography: verifiedSources.map((source) =>
      [source.title, source.sourceUrl].filter(Boolean).join(" — "),
    ),
    disclosure: access.disclosure,
    integrityWarnings,
    variation,
    quality: {
      rubricCoverage: project.rubric.length
        ? Math.round((rubricCovered.size / project.rubric.length) * 100)
        : 65,
      sourceConfidence: verifiedSources.length
        ? Math.min(100, 45 + verifiedSources.length * 7)
        : 15,
      coherence: input.generateSection ? 82 : 58,
      discussability: Math.min(
        96,
        50 + sections.filter((section) => section.defenseQuestions.length).length * 7,
      ),
    },
    createdAt: now,
    updatedAt: now,
  };
}

function sentenceDuplicates(text: string) {
  const sentences = text
    .split(/[.!؟!?\n。]+/u)
    .map((value) => value.trim().replace(/\s+/g, " "))
    .filter((value) => value.length > 55);
  const counts = new Map<string, number>();
  for (const sentence of sentences) {
    const key = sentence.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.values()].filter((count) => count > 1).length;
}

export function inspectProjectDraft(
  project: ProjectDNA,
  rawDraft: string,
  requestedLocale?: string,
): ProjectXRayReport {
  const locale = resolveServerLocale(requestedLocale, project.language);
  const draft = String(rawDraft || "").slice(0, 160_000);
  const wordCount = words(draft);
  const headings = (draft.match(/^#{1,4}\s+.+$/gm) || []).length;
  const citations = (
    draft.match(/\([\p{L}][^()]{1,55},\s*(?:19|20)\d{2}\)|\[[0-9]{1,3}\]/gu) || []
  ).length;
  const hasReferences =
    /(?:المراجع|المصادر|references|bibliography|kaynakça|参考文献|संदर्भ|referencias|bibliografía|bibliographie|حوالہ جات|کتابیات)/i.test(
      draft,
    );
  const duplicateCount = sentenceDuplicates(draft);
  const normalizedDraft = draft.toLowerCase();
  const rubricHits = project.rubric.filter((criterion) => {
    const terms = `${criterion.title} ${criterion.description}`
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((term) => term.length > 4)
      .slice(0, 8);
    return terms.some((term) => normalizedDraft.includes(term));
  }).length;
  const structure = Math.min(100, 20 + headings * 11 + (wordCount > 900 ? 20 : 0));
  const sources = Math.min(100, (hasReferences ? 30 : 0) + citations * 5);
  const rubric = project.rubric.length
    ? Math.round((rubricHits / project.rubric.length) * 100)
    : 60;
  const coherence = Math.max(20, Math.min(94, 78 - duplicateCount * 10 + (headings > 3 ? 8 : 0)));
  const discussability = Math.max(
    20,
    Math.min(92, Math.round((structure + rubric + coherence) / 3) - (sources < 35 ? 10 : 0)),
  );
  const findings: ProjectXRayFinding[] = [];
  const add = (
    severity: ProjectXRayFinding["severity"],
    category: ProjectXRayFinding["category"],
    title: string,
    detail: string,
    action: string,
  ) => findings.push({ id: randomUUID(), severity, category, title, detail, action });
  if (wordCount < 700)
    add(
      "critical",
      "structure",
      tx(XRAY.shortTitle, locale),
      txf(XRAY.shortDetail, locale, { words: wordCount }),
      tx(XRAY.shortAction, locale),
    );
  else
    add(
      "good",
      "structure",
      tx(XRAY.sizeOkTitle, locale),
      txf(XRAY.sizeOkDetail, locale, { words: wordCount, headings }),
      tx(XRAY.sizeOkAction, locale),
    );
  if (!hasReferences || citations < 3)
    add(
      "critical",
      "sources",
      tx(XRAY.sourcesWeakTitle, locale),
      txf(hasReferences ? XRAY.sourcesWeakWith : XRAY.sourcesWeakWithout, locale, { citations }),
      tx(XRAY.sourcesWeakAction, locale),
    );
  else
    add(
      "good",
      "sources",
      tx(XRAY.sourcesOkTitle, locale),
      txf(XRAY.sourcesOkDetail, locale, { citations }),
      tx(XRAY.sourcesOkAction, locale),
    );
  if (rubric < 70)
    add(
      "attention",
      "rubric",
      tx(XRAY.rubricWeakTitle, locale),
      txf(XRAY.rubricDetail, locale, { rubric }),
      tx(XRAY.rubricWeakAction, locale),
    );
  else
    add(
      "good",
      "rubric",
      tx(XRAY.rubricOkTitle, locale),
      txf(XRAY.rubricDetail, locale, { rubric }),
      tx(XRAY.rubricOkAction, locale),
    );
  if (duplicateCount)
    add(
      "attention",
      "language",
      tx(XRAY.duplicateTitle, locale),
      txf(XRAY.duplicateDetail, locale, { duplicates: duplicateCount }),
      tx(XRAY.duplicateAction, locale),
    );
  if (/\b(?:lorem ipsum|as an ai|i cannot|chatgpt)\b/i.test(draft))
    add(
      "critical",
      "language",
      tx(XRAY.residueTitle, locale),
      tx(XRAY.residueDetail, locale),
      tx(XRAY.residueAction, locale),
    );
  return {
    projectId: project.id,
    generatedAt: new Date().toISOString(),
    wordCount,
    estimatedPages: Number((wordCount / 330).toFixed(1)),
    scores: { structure, sources, rubric, coherence, discussability },
    findings,
    professorQuestions: [
      txf(XRAY.profQ1, locale, { title: project.title }),
      project.rubric[0]
        ? txf(XRAY.profQ2Rubric, locale, { criterion: project.rubric[0].title })
        : tx(XRAY.profQ2Fallback, locale),
      tx(XRAY.profQ3, locale),
      tx(XRAY.profQ4, locale),
    ],
  };
}

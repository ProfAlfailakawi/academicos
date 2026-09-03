import { createHash } from "node:crypto";
import type {
  ControlPlaneData,
  CourseAssignmentRecord,
  CourseRecord,
  CourseSubmissionRecord,
  FacultyAutomationBrief,
  InstitutionCommandCenter,
  MissionControlPlan,
  ProjectDNA,
  RescuePlan,
} from "../types";
import { L, joinList, resolveServerLocale, tx, txf, type ServerLocale } from "./server-locale";

// Mission Control, rescue planning and the institution command centre are read by
// learners and staff in eight languages, so their generated copy is localized here
// instead of being emitted in one fixed language.
const EXP = {
  headlineStart: L("ابدأ بـ{title}", "Start with {title}", "{title} ile başlayın", "先从「{title}」开始", "{title} से शुरू करें", "Empieza con {title}", "Commencez par {title}", "{title} سے آغاز کریں"),
  headlineCalm: L("يومك الأكاديمي مستقر", "Your academic day is steady", "Akademik gününüz dengede", "今天的学业节奏平稳", "आपका शैक्षणिक दिन स्थिर है", "Tu día académico está estable", "Votre journée académique est stable", "آپ کا تعلیمی دن مستحکم ہے"),
  headlineExplain: L("{reason} خصصنا لها {minutes} دقيقة ضمن ميزانيتك اليومية.", "{reason} We set aside {minutes} minutes for it within your daily budget.", "{reason} Günlük bütçenizde buna {minutes} dakika ayırdık.", "{reason} 我们在你的每日时间预算中为它安排了 {minutes} 分钟。", "{reason} हमने आपके दैनिक बजट में इसके लिए {minutes} मिनट रखे हैं।", "{reason} Le reservamos {minutes} minutos dentro de tu presupuesto diario.", "{reason} Nous lui avons réservé {minutes} minutes dans votre budget quotidien.", "{reason} ہم نے آپ کے روزانہ بجٹ میں اس کے لیے {minutes} منٹ رکھے ہیں۔"),
  calmExplain: L("لا توجد خطوة ملحّة. راجع الفصل أو أضف تكليفًا عندما يصل إليك.", "Nothing is urgent. Review the term, or add an assignment when one arrives.", "Acil bir iş yok. Dönemi gözden geçirin ya da yeni bir ödev geldiğinde ekleyin.", "暂无紧急事项。可以回顾本学期，或在收到新作业时添加。", "कुछ भी अत्यावश्यक नहीं है। सत्र की समीक्षा करें, या नया असाइनमेंट आने पर जोड़ें।", "No hay nada urgente. Revisa el cuatrimestre o añade una tarea cuando llegue.", "Rien d'urgent. Revoyez le semestre ou ajoutez un devoir dès qu'il arrive.", "کوئی فوری کام نہیں۔ سمسٹر کا جائزہ لیں یا نیا اسائنمنٹ آنے پر شامل کریں۔"),
  rescueBlocked: L("ابدأ بإزالة العائق قبل أي عمل تابع.", "Clear the blocker first, before any dependent work.", "Önce engeli kaldırın, bağımlı işlere sonra geçin.", "先解除阻塞，再做依赖它的工作。", "पहले अवरोध हटाएँ, फिर आश्रित कार्य करें।", "Elimina primero el bloqueo, antes del trabajo dependiente.", "Levez d'abord le blocage, avant tout travail dépendant.", "پہلے رکاوٹ ہٹائیں، پھر منحصر کام کریں۔"),
  rescueInProgress: L("أكمل العمل المفتوح لتقليل تبديل السياق.", "Finish the work already open to reduce context switching.", "Açık işi bitirerek bağlam değiştirmeyi azaltın.", "先完成已开始的工作，减少上下文切换。", "पहले से शुरू काम पूरा करें ताकि संदर्भ-बदलाव घटे।", "Termina el trabajo ya abierto para reducir el cambio de contexto.", "Terminez le travail déjà ouvert pour limiter les changements de contexte.", "پہلے سے کھلا کام مکمل کریں تاکہ سیاق بدلنا کم ہو۔"),
  rescueNext: L("هذه الخطوة تخدم أقرب مخرج غير مكتمل.", "This step serves the nearest incomplete deliverable.", "Bu adım en yakın tamamlanmamış çıktıya hizmet eder.", "这一步服务于最近的未完成交付物。", "यह चरण निकटतम अधूरे डिलिवरेबल के लिए है।", "Este paso sirve al entregable incompleto más cercano.", "Cette étape sert le livrable incomplet le plus proche.", "یہ قدم قریب ترین نامکمل مخرج کے لیے ہے۔"),
  rescueCritical: L("خطة إنقاذ حرجة: ركّز على {focus} خطوات أساسية واترك {deferred} خطوة لما بعد التسليم أو اطلب تمديدًا رسميًا.", "Critical rescue plan: focus on {focus} essential steps and leave {deferred} for after submission, or request a formal extension.", "Kritik kurtarma planı: {focus} temel adıma odaklanın, {deferred} adımı teslim sonrasına bırakın ya da resmî süre uzatımı isteyin.", "紧急拯救计划：集中完成 {focus} 个关键步骤，将 {deferred} 个步骤留到提交之后，或正式申请延期。", "गंभीर रेस्क्यू योजना: {focus} आवश्यक चरणों पर ध्यान दें और {deferred} को सबमिशन के बाद के लिए छोड़ें, या औपचारिक विस्तार माँगें।", "Plan de rescate crítico: céntrate en {focus} pasos esenciales y deja {deferred} para después de la entrega, o pide una prórroga formal.", "Plan de sauvetage critique : concentrez-vous sur {focus} étapes essentielles et reportez {deferred} après le rendu, ou demandez une prolongation formelle.", "نازک ریسکیو منصوبہ: {focus} بنیادی مراحل پر توجہ دیں اور {deferred} کو جمع کے بعد کے لیے چھوڑیں، یا باقاعدہ مہلت طلب کریں۔"),
  rescueTight: L("الوقت ضيق؛ الخطة تضغط العمل في {capacity} دقيقة مع تأجيل {deferred} خطوة منخفضة الأولوية.", "Time is tight; the plan compresses the work into {capacity} minutes and defers {deferred} low-priority steps.", "Süre dar; plan işi {capacity} dakikaya sıkıştırıp {deferred} düşük öncelikli adımı erteliyor.", "时间紧张；该计划把工作压缩到 {capacity} 分钟，并推迟 {deferred} 个低优先级步骤。", "समय कम है; योजना काम को {capacity} मिनट में समेटती है और {deferred} कम-प्राथमिकता चरण टालती है।", "El tiempo es ajustado; el plan comprime el trabajo en {capacity} minutos y aplaza {deferred} pasos de baja prioridad.", "Le temps est serré ; le plan comprime le travail en {capacity} minutes et reporte {deferred} étapes peu prioritaires.", "وقت کم ہے؛ منصوبہ کام کو {capacity} منٹ میں سمیٹتا ہے اور {deferred} کم اہم مراحل مؤخر کرتا ہے۔"),
  rescueSteady: L("الخطة قابلة للتنفيذ ضمن وقتك الحالي دون ضغط غير ضروري.", "The plan fits your current time without unnecessary pressure.", "Plan, gereksiz baskı olmadan mevcut zamanınıza sığıyor.", "在当前时间内，该计划无需额外加压即可完成。", "यह योजना बिना अनावश्यक दबाव के आपके मौजूदा समय में पूरी हो सकती है।", "El plan cabe en tu tiempo actual sin presión innecesaria.", "Le plan tient dans votre temps disponible sans pression inutile.", "یہ منصوبہ غیر ضروری دباؤ کے بغیر آپ کے موجودہ وقت میں سما جاتا ہے۔"),
  facultyLinkOutcomes: L("اربط {count} مخرجًا في {course}", "Link {count} outcomes in {course}", "{course} dersinde {count} kazanımı bağlayın", "在 {course} 中关联 {count} 项学习成果", "{course} में {count} लर्निंग आउटकम जोड़ें", "Vincula {count} resultados en {course}", "Reliez {count} acquis dans {course}", "{course} میں {count} نتائج جوڑیں"),
  facultyLinkDetail: L("لا توجد تكليفات منشورة تقيس هذه المخرجات حتى الآن.", "No published assignment measures these outcomes yet.", "Bu kazanımları ölçen yayımlanmış bir ödev henüz yok.", "目前还没有已发布的作业衡量这些成果。", "अभी कोई प्रकाशित असाइनमेंट इन आउटकम को नहीं मापता।", "Todavía no hay ninguna tarea publicada que mida estos resultados.", "Aucun devoir publié ne mesure encore ces acquis.", "ابھی کوئی شائع شدہ اسائنمنٹ اِن نتائج کو نہیں ماپتا۔"),
  facultyFirstAssignment: L("أنشئ أول تكليف في {course}", "Create the first assignment in {course}", "{course} dersinde ilk ödevi oluşturun", "在 {course} 中创建第一个作业", "{course} में पहला असाइनमेंट बनाएँ", "Crea la primera tarea en {course}", "Créez le premier devoir dans {course}", "{course} میں پہلا اسائنمنٹ بنائیں"),
  facultyFirstDetail: L("المقرر لا يملك تكليفًا يمكن للطالب الارتباط به أو تسليمه.", "The course has no assignment a student can link to or submit against.", "Derste öğrencinin bağlanabileceği ya da teslim edebileceği bir ödev yok.", "该课程还没有学生可关联或提交的作业。", "इस कोर्स में ऐसा कोई असाइनमेंट नहीं जिससे छात्र जुड़ या जमा कर सके।", "El curso no tiene ninguna tarea a la que un estudiante pueda vincularse o entregar.", "Le cours n'a aucun devoir auquel un étudiant peut se rattacher ou rendre un travail.", "کورس میں ایسا کوئی اسائنمنٹ نہیں جس سے طالب علم جڑ یا جمع کرا سکے۔"),
  fieldDeadline: L("الموعد", "the deadline", "teslim tarihi", "截止日期", "समय-सीमा", "la fecha límite", "l'échéance", "آخری تاریخ"),
  fieldDeliverables: L("المخرجات", "the deliverables", "çıktılar", "交付物", "डिलिवरेबल्स", "los entregables", "les livrables", "مخرجات"),
  fieldAiPolicy: L("سياسة AI", "the AI policy", "yapay zeka politikası", "AI 政策", "AI नीति", "la política de IA", "la politique IA", "AI پالیسی"),
  facultyComplete: L("أكمل {title}", "Complete {title}", "{title} ödevini tamamlayın", "补全 {title}", "{title} पूरा करें", "Completa {title}", "Complétez {title}", "{title} مکمل کریں"),
  facultyMissing: L("ينقص التكليف: {problems}.", "The assignment is missing: {problems}.", "Ödevde eksik olan: {problems}.", "该作业缺少：{problems}。", "असाइनमेंट में यह अनुपस्थित है: {problems}।", "A la tarea le falta: {problems}.", "Il manque au devoir : {problems}.", "اسائنمنٹ میں کمی: {problems}۔"),
  decisionDueTitle: L("ضغط تسليم قريب", "Near-term submission pressure", "Yakın teslim baskısı", "近期提交压力", "निकट-अवधि सबमिशन दबाव", "Presión de entregas próximas", "Pression de rendus imminents", "قریبی جمع کا دباؤ"),
  decisionDueDetail: L("{count} مشروعًا لها موعد خلال سبعة أيام.", "{count} projects are due within seven days.", "{count} projenin teslimine yedi gün kaldı.", "有 {count} 个项目将在七天内到期。", "{count} प्रोजेक्ट सात दिनों में देय हैं।", "{count} proyectos vencen en siete días.", "{count} projets arrivent à échéance sous sept jours.", "{count} پروجیکٹس سات دن میں واجب ہیں۔"),
  decisionDueRec: L("راجع توزيع المواعيد والدعم المتاح قبل حدوث موجة تأخير.", "Review deadline spacing and available support before a wave of late work builds up.", "Gecikme dalgası oluşmadan önce teslim tarihi dağılımını ve mevcut desteği gözden geçirin.", "在延期潮出现前，检查截止日期分布与可用支持。", "देरी की लहर बनने से पहले समय-सीमा वितरण और उपलब्ध सहायता की समीक्षा करें।", "Revisa la distribución de plazos y el apoyo disponible antes de que se acumulen las entregas tardías.", "Vérifiez l'étalement des échéances et le soutien disponible avant une vague de retards.", "تاخیر کی لہر بننے سے پہلے آخری تاریخوں کی تقسیم اور دستیاب معاونت دیکھیں۔"),
  decisionRiskTitle: L("مخاطر أكاديمية متكررة", "Recurring academic risk", "Tekrarlayan akademik risk", "反复出现的学术风险", "आवर्ती शैक्षणिक जोखिम", "Riesgo académico recurrente", "Risque académique récurrent", "بار بار آنے والا تعلیمی خطرہ"),
  decisionRiskDetail: L("{count} مشروعًا تحمل إشارات نقص أو سياسة غير مؤكدة.", "{count} projects carry gap signals or an unconfirmed policy.", "{count} proje eksiklik işareti ya da doğrulanmamış politika taşıyor.", "{count} 个项目存在缺口信号或政策未确认。", "{count} प्रोजेक्ट में कमी-संकेत या अपुष्ट नीति है।", "{count} proyectos presentan señales de carencia o política sin confirmar.", "{count} projets présentent des signaux de manque ou une politique non confirmée.", "{count} پروجیکٹس میں کمی کے اشارے یا غیر مصدقہ پالیسی ہے۔"),
  decisionRiskRec: L("فعّل Playbook موحدًا لتأكيد المتطلبات والسياسة من مصدر المقرر.", "Roll out one shared playbook for confirming requirements and policy from the course source.", "Gereksinim ve politikayı ders kaynağından doğrulamak için ortak bir playbook uygulayın.", "推行统一手册，从课程源头确认要求与政策。", "पाठ्यक्रम स्रोत से आवश्यकताएँ व नीति पुष्ट करने हेतु एक साझा प्लेबुक लागू करें।", "Despliega un playbook común para confirmar requisitos y política desde la fuente del curso.", "Déployez un playbook commun pour confirmer exigences et politique à la source du cours.", "کورس ماخذ سے تقاضے اور پالیسی کی تصدیق کے لیے مشترکہ پلے بک نافذ کریں۔"),
  decisionGradingTitle: L("تراكم في التقييم", "Grading backlog", "Değerlendirme birikimi", "评分积压", "मूल्यांकन बैकलॉग", "Retraso en la calificación", "Retard de correction", "درجہ بندی کا بیک لاگ"),
  decisionGradingDetail: L("{count} تسليمًا لم تُنشر درجته بعد.", "{count} submissions have no published grade yet.", "{count} teslimin notu henüz yayımlanmadı.", "{count} 份提交尚未公布成绩。", "{count} सबमिशन के ग्रेड अभी प्रकाशित नहीं हुए।", "{count} entregas aún no tienen nota publicada.", "{count} rendus n'ont pas encore de note publiée.", "{count} جمع شدہ کاموں کے نمبر ابھی جاری نہیں ہوئے۔"),
  decisionGradingRec: L("وزّع قائمة التصحيح حسب المقرر والأقدمية مع SLA واضح.", "Distribute the grading queue by course and age with a clear SLA.", "Değerlendirme kuyruğunu ders ve bekleme süresine göre net bir SLA ile dağıtın.", "按课程与积压时长分配评分队列，并设定明确的 SLA。", "मूल्यांकन कतार को कोर्स व प्रतीक्षा-अवधि के अनुसार स्पष्ट SLA के साथ बाँटें।", "Distribuye la cola de calificación por curso y antigüedad con un SLA claro.", "Répartissez la file de correction par cours et ancienneté avec un SLA clair.", "درجہ بندی کی قطار کورس اور قدامت کے مطابق واضح SLA کے ساتھ تقسیم کریں۔"),
  decisionIncidentTitle: L("حادث خدمة مفتوح", "Open service incident", "Açık servis olayı", "未关闭的服务事件", "खुला सेवा इंसिडेंट", "Incidente de servicio abierto", "Incident de service ouvert", "کھلا سروس واقعہ"),
  decisionIncidentDetail: L("{count} حوادث ما زالت مفتوحة.", "{count} incidents are still open.", "{count} olay hâlâ açık.", "仍有 {count} 起事件未关闭。", "{count} इंसिडेंट अब भी खुले हैं।", "{count} incidentes siguen abiertos.", "{count} incidents sont encore ouverts.", "{count} واقعات ابھی کھلے ہیں۔"),
  decisionIncidentRec: L("افتح غرفة الحادث واعرض أثره للمستخدمين بدل الصمت.", "Open the incident room and show users the impact instead of staying silent.", "Olay odasını açın ve sessiz kalmak yerine kullanıcılara etkiyi gösterin.", "开启事件处理室，向用户公开影响，而不是保持沉默。", "इंसिडेंट रूम खोलें और चुप रहने के बजाय उपयोगकर्ताओं को प्रभाव बताएँ।", "Abre la sala de incidentes y muestra el impacto a los usuarios en lugar de callar.", "Ouvrez la cellule d'incident et exposez l'impact aux utilisateurs au lieu de garder le silence.", "انسیڈنٹ روم کھولیں اور خاموشی کے بجائے صارفین کو اثر بتائیں۔"),
  playbookSubmission: L("راجع أسباب التحذير الشائعة قبل فتح نافذة التسليم التالية.", "Review the common warning causes before the next submission window opens.", "Bir sonraki teslim penceresi açılmadan yaygın uyarı nedenlerini gözden geçirin.", "在下一个提交窗口开启前，检查常见告警原因。", "अगली सबमिशन विंडो खुलने से पहले सामान्य चेतावनी-कारण जाँचें।", "Revisa las causas de aviso más comunes antes de la próxima ventana de entrega.", "Examinez les causes d'alerte fréquentes avant la prochaine fenêtre de rendu.", "اگلی جمع ونڈو کھلنے سے پہلے عام وارننگ اسباب دیکھیں۔"),
  playbookSupport: L("حوّل الحل المتكرر إلى مقالة مساعدة وإجراء آلي آمن.", "Turn the repeated fix into a help article and a safe automated action.", "Tekrarlanan çözümü bir yardım makalesine ve güvenli bir otomasyona dönüştürün.", "把重复的解决方案沉淀为帮助文章和安全的自动化动作。", "बार-बार दोहराए गए समाधान को सहायता लेख और सुरक्षित स्वचालन में बदलें।", "Convierte la solución repetida en un artículo de ayuda y una acción automatizada segura.", "Transformez la correction répétée en article d'aide et en action automatisée sûre.", "بار بار کے حل کو مدد مضمون اور محفوظ خودکار عمل میں بدلیں۔"),
  playbookDefault: L("حوّل الخطوات المتكررة إلى Workflow مدقق قابل لإعادة الاستخدام.", "Turn the repeated steps into an audited, reusable workflow.", "Tekrarlanan adımları denetlenmiş, yeniden kullanılabilir bir iş akışına dönüştürün.", "把重复步骤沉淀为可审计、可复用的工作流。", "दोहराए गए चरणों को ऑडिट-योग्य, पुन:प्रयोज्य वर्कफ़्लो में बदलें।", "Convierte los pasos repetidos en un flujo de trabajo auditado y reutilizable.", "Transformez les étapes répétées en un workflow audité et réutilisable.", "دہرائے گئے مراحل کو قابلِ آڈٹ، دوبارہ قابلِ استعمال ورک فلو میں بدلیں۔"),
  svcAuthentication: L("المصادقة", "Authentication", "Kimlik doğrulama", "身份认证", "प्रमाणीकरण", "Autenticación", "Authentification", "تصدیق"),
  svcDatabase: L("قاعدة البيانات", "Database", "Veritabanı", "数据库", "डेटाबेस", "Base de datos", "Base de données", "ڈیٹابیس"),
  svcStorage: L("الملفات", "File storage", "Dosya depolama", "文件存储", "फ़ाइल संग्रहण", "Almacenamiento de archivos", "Stockage de fichiers", "فائل اسٹوریج"),
  svcAi: L("بوابة AI", "AI gateway", "Yapay zeka geçidi", "AI 网关", "AI गेटवे", "Puerta de enlace de IA", "Passerelle IA", "AI گیٹ وے"),
  svcMalware: L("فحص البرمجيات الضارة", "Malware scanning", "Kötü amaçlı yazılım taraması", "恶意软件扫描", "मैलवेयर स्कैनिंग", "Análisis de malware", "Analyse antivirus", "میلویئر اسکیننگ"),
  svcNotifications: L("الإشعارات الخارجية", "External notifications", "Dış bildirimler", "外部通知", "बाहरी सूचनाएँ", "Notificaciones externas", "Notifications externes", "بیرونی اطلاعات"),
  svcBackup: L("النسخ والاستعادة", "Backup and restore", "Yedekleme ve geri yükleme", "备份与恢复", "बैकअप और पुनर्स्थापन", "Copias de seguridad y restauración", "Sauvegarde et restauration", "بیک اپ اور بحالی"),
  svcBilling: L("الدفع", "Payments", "Ödemeler", "支付", "भुगतान", "Pagos", "Paiements", "ادائیگیاں"),
  svcReady: L("مهيأ على الخادم", "Configured on the server", "Sunucuda yapılandırıldı", "已在服务器上配置", "सर्वर पर कॉन्फ़िगर किया गया", "Configurado en el servidor", "Configuré sur le serveur", "سرور پر ترتیب شدہ"),
  svcBlocked: L("يحتاج مزودًا واعتمادات إنتاجية", "Needs a provider and production credentials", "Bir sağlayıcı ve üretim kimlik bilgileri gerekiyor", "需要服务提供方与生产凭据", "एक प्रदाता और प्रोडक्शन क्रेडेंशियल चाहिए", "Necesita un proveedor y credenciales de producción", "Nécessite un fournisseur et des identifiants de production", "فراہم کنندہ اور پروڈکشن کریڈنشلز درکار"),
} as const;

const nowIso = () => new Date().toISOString();
const pct = (value: number, total: number) =>
  total ? Math.round((value / total) * 100) : 100;
const stableId = (prefix: string, value: string) =>
  `${prefix}_${createHash("sha1").update(value).digest("hex").slice(0, 12)}`;

export function addConcierge(
  plan: MissionControlPlan,
  locale: ServerLocale = "en",
): MissionControlPlan {
  const first = plan.actions[0];
  const headline = first
    ? txf(EXP.headlineStart, locale, { title: first.title })
    : tx(EXP.headlineCalm, locale);
  const explanation = first
    ? txf(EXP.headlineExplain, locale, {
        reason: first.reason,
        minutes: first.estimatedMinutes,
      })
    : tx(EXP.calmExplain, locale);
  const automationCandidates = plan.actions.slice(0, 3).map((action) => ({
    id: `concierge_${action.id}`,
    title: action.title,
    detail: action.reason,
    path: action.path,
    requiresConfirmation: true,
  }));
  return {
    ...plan,
    concierge: { headline, explanation, automationCandidates },
  };
}

export function buildRescuePlan(
  project: ProjectDNA,
  availableMinutes = 180,
  at = Date.now(),
  requestedLocale?: string,
): RescuePlan {
  const locale: ServerLocale = resolveServerLocale(requestedLocale, project.language);
  const incomplete = project.tasks.filter(
    (task) => task.status !== "completed",
  );
  const remainingMinutes = incomplete.reduce(
    (sum, task) => sum + Math.max(15, Number(task.estimatedMinutes || 60)),
    0,
  );
  const deadlineMs = project.deadlines.final
    ? new Date(project.deadlines.final).getTime()
    : NaN;
  const hoursLeft = Number.isFinite(deadlineMs)
    ? Math.max(0, (deadlineMs - at) / 3600000)
    : Number.POSITIVE_INFINITY;
  const capacity = Math.max(30, Math.min(720, Math.floor(availableMinutes)));
  const severity: RescuePlan["severity"] =
    hoursLeft <= 24 || remainingMinutes > capacity * 2
      ? "critical"
      : hoursLeft <= 72 || remainingMinutes > capacity
        ? "tight"
        : "steady";
  const ordered = [...incomplete].sort((a, b) => {
    const state = (v: string) =>
      v === "blocked" ? 0 : v === "in_progress" ? 1 : v === "ready" ? 2 : 3;
    return (
      state(a.status) - state(b.status) ||
      (a.dueDate || project.deadlines.final || "9999").localeCompare(
        b.dueDate || project.deadlines.final || "9999",
      )
    );
  });
  let budget = capacity;
  const phases: RescuePlan["phases"] = [];
  const deferred: string[] = [];
  for (const task of ordered) {
    const requested = Math.max(15, Number(task.estimatedMinutes || 60));
    if (budget <= 0) {
      deferred.push(task.id);
      continue;
    }
    const minutes = Math.min(requested, budget);
    budget -= minutes;
    phases.push({
      id: stableId("rescue", task.id),
      title: task.title,
      minutes,
      reason:
        task.status === "blocked"
          ? tx(EXP.rescueBlocked, locale)
          : task.status === "in_progress"
            ? tx(EXP.rescueInProgress, locale)
            : tx(EXP.rescueNext, locale),
      taskIds: [task.id],
      mustDo: phases.length < 3,
    });
  }
  const summary =
    severity === "critical"
      ? txf(EXP.rescueCritical, locale, {
          focus: Math.min(3, phases.length),
          deferred: deferred.length,
        })
      : severity === "tight"
        ? txf(EXP.rescueTight, locale, { capacity, deferred: deferred.length })
        : tx(EXP.rescueSteady, locale);
  return {
    projectId: project.id,
    generatedAt: new Date(at).toISOString(),
    severity,
    availableMinutes: capacity,
    remainingMinutes,
    deadline: project.deadlines.final,
    summary,
    phases,
    deferredTaskIds: deferred,
    requiresConfirmation: true,
  };
}

export function buildFacultyAutomation(
  courses: CourseRecord[],
  assignments: CourseAssignmentRecord[],
  requestedLocale?: string,
): FacultyAutomationBrief {
  const locale: ServerLocale = resolveServerLocale(requestedLocale);
  const actions: FacultyAutomationBrief["actions"] = [];
  for (const course of courses) {
    const related = assignments.filter((item) => item.courseId === course.id);
    const linked = new Set(
      related.flatMap((item) => item.outcomes.map((x) => x.trim())),
    );
    const uncovered = course.outcomes.filter(
      (outcome) => !linked.has(outcome.trim()),
    );
    if (uncovered.length)
      actions.push({
        id: stableId("faculty", `${course.id}:outcomes`),
        priority: "important",
        title: txf(EXP.facultyLinkOutcomes, locale, {
          count: uncovered.length,
          course: course.code,
        }),
        detail: tx(EXP.facultyLinkDetail, locale),
        path: `/app/course/${course.id}`,
        courseId: course.id,
      });
    if (!related.length)
      actions.push({
        id: stableId("faculty", `${course.id}:assignment`),
        priority: "important",
        title: txf(EXP.facultyFirstAssignment, locale, { course: course.code }),
        detail: tx(EXP.facultyFirstDetail, locale),
        path: `/app/course/${course.id}`,
        courseId: course.id,
      });
  }
  for (const item of assignments) {
    const weight = item.rubric.reduce(
      (sum, row) => sum + Number(row.weighting || 0),
      0,
    );
    const problems = [
      !item.deadline && tx(EXP.fieldDeadline, locale),
      !item.deliverables.length && tx(EXP.fieldDeliverables, locale),
      (!item.rubric.length || Math.abs(weight - 100) > 0.01) && "Rubric",
      !item.outcomes.length && "Outcomes",
      item.aiPolicy.needsConfirmation && tx(EXP.fieldAiPolicy, locale),
    ].filter((value): value is string => Boolean(value));
    if (problems.length)
      actions.push({
        id: stableId("faculty", `${item.id}:quality`),
        priority: item.status === "published" ? "critical" : "important",
        title: txf(EXP.facultyComplete, locale, { title: item.title }),
        detail: txf(EXP.facultyMissing, locale, {
          problems: joinList(problems, locale),
        }),
        path: `/app/course/${item.courseId}`,
        courseId: item.courseId,
        assignmentId: item.id,
      });
  }
  const total = Math.max(1, assignments.length);
  return {
    generatedAt: nowIso(),
    courses: courses.length,
    assignments: assignments.length,
    publishedAssignments: assignments.filter((x) => x.status === "published")
      .length,
    actions: actions
      .sort(
        (a, b) =>
          ({ critical: 0, important: 1, normal: 2 })[a.priority] -
          { critical: 0, important: 1, normal: 2 }[b.priority],
      )
      .slice(0, 20),
    health: {
      outcomesMapped: pct(
        assignments.filter((x) => x.outcomes.length > 0).length,
        total,
      ),
      rubricReady: pct(
        assignments.filter(
          (x) =>
            x.rubric.length > 0 &&
            Math.abs(x.rubric.reduce((s, r) => s + r.weighting, 0) - 100) <
              0.01,
        ).length,
        total,
      ),
      deadlinesPresent: pct(
        assignments.filter((x) => Boolean(x.deadline)).length,
        total,
      ),
      policyConfirmed: pct(
        assignments.filter((x) => !x.aiPolicy.needsConfirmation).length,
        total,
      ),
    },
  };
}

export function normalizeRubricGrades(
  assignment: CourseAssignmentRecord,
  input: unknown,
) {
  if (!assignment.rubric.length)
    throw Object.assign(
      new Error(
        "A published rubric is required before this submission can be graded",
      ),
      { status: 409, code: "RUBRIC_REQUIRED" },
    );
  const rows = Array.isArray(input) ? input : [],
    byId = new Map<string, any>();
  for (const row of rows) {
    const id = String(row?.rubricId || "");
    if (!id || byId.has(id))
      throw Object.assign(
        new Error("Each rubric criterion must appear exactly once"),
        { status: 400, code: "RUBRIC_GRADE_INVALID" },
      );
    byId.set(id, row);
  }
  const rubricGrades = assignment.rubric.map((criterion) => {
    const row = byId.get(criterion.id);
    if (!row)
      throw Object.assign(
        new Error(`Missing grade for rubric criterion: ${criterion.title}`),
        { status: 400, code: "RUBRIC_GRADE_INCOMPLETE" },
      );
    const awardedPoints = Number(row.awardedPoints),
      maxPoints = Number(criterion.weighting);
    if (
      !Number.isFinite(awardedPoints) ||
      awardedPoints < 0 ||
      awardedPoints > maxPoints
    )
      throw Object.assign(
        new Error(
          `Grade for ${criterion.title} must be between 0 and ${maxPoints}`,
        ),
        { status: 400, code: "RUBRIC_GRADE_RANGE" },
      );
    const feedback = String(row.feedback || "")
      .trim()
      .slice(0, 3000);
    return {
      rubricId: criterion.id,
      title: criterion.title,
      maxPoints,
      awardedPoints: Number(awardedPoints.toFixed(2)),
      ...(feedback ? { feedback } : {}),
    };
  });
  if (byId.size !== assignment.rubric.length)
    throw Object.assign(
      new Error(
        "The grade contains a criterion that is not in the published rubric",
      ),
      { status: 400, code: "RUBRIC_GRADE_UNKNOWN" },
    );
  const totalScore = Number(
      rubricGrades.reduce((sum, row) => sum + row.awardedPoints, 0).toFixed(2),
    ),
    maxScore = Number(
      rubricGrades.reduce((sum, row) => sum + row.maxPoints, 0).toFixed(2),
    );
  return { rubricGrades, totalScore, maxScore };
}

export function buildInstitutionCommandCenter(input: {
  control: ControlPlaneData;
  courses: CourseRecord[];
  assignments: CourseAssignmentRecord[];
  submissions: CourseSubmissionRecord[];
  serviceState: Record<string, boolean>;
  locale?: string;
}): InstitutionCommandCenter {
  const { control, courses, assignments, submissions, serviceState } = input;
  const locale: ServerLocale = resolveServerLocale(input.locale);
  const decisions: InstitutionCommandCenter["decisions"] = [];
  const risky = control.projects.filter((x) => x.riskCount > 0).length;
  const due = control.metrics.dueSoon;
  const gradingBacklog = submissions.filter((x) =>
    ["submitted", "grading", "graded"].includes(x.status),
  ).length;
  if (due)
    decisions.push({
      id: "decision_due",
      priority: due > 10 ? "critical" : "important",
      title: tx(EXP.decisionDueTitle, locale),
      detail: txf(EXP.decisionDueDetail, locale, { count: due }),
      metric: String(due),
      recommendation: tx(EXP.decisionDueRec, locale),
    });
  if (risky)
    decisions.push({
      id: "decision_risk",
      priority:
        risky > control.projects.length * 0.3 ? "critical" : "important",
      title: tx(EXP.decisionRiskTitle, locale),
      detail: txf(EXP.decisionRiskDetail, locale, { count: risky }),
      metric: `${pct(risky, control.projects.length)}%`,
      recommendation: tx(EXP.decisionRiskRec, locale),
    });
  if (gradingBacklog)
    decisions.push({
      id: "decision_grading",
      priority: gradingBacklog > 50 ? "critical" : "important",
      title: tx(EXP.decisionGradingTitle, locale),
      detail: txf(EXP.decisionGradingDetail, locale, { count: gradingBacklog }),
      metric: String(gradingBacklog),
      recommendation: tx(EXP.decisionGradingRec, locale),
    });
  if (control.metrics.openIncidents)
    decisions.push({
      id: "decision_incident",
      priority: "critical",
      title: tx(EXP.decisionIncidentTitle, locale),
      detail: txf(EXP.decisionIncidentDetail, locale, {
        count: control.metrics.openIncidents,
      }),
      metric: String(control.metrics.openIncidents),
      recommendation: tx(EXP.decisionIncidentRec, locale),
    });
  const actionCounts = new Map<string, number>();
  for (const item of control.audit) {
    const key = item.action.split(".").slice(0, 2).join(".");
    actionCounts.set(key, (actionCounts.get(key) || 0) + 1);
  }
  const memory = [...actionCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([pattern, occurrences]) => ({
      pattern,
      occurrences,
      affectedProjects: new Set(
        control.audit
          .filter((x) => x.action.startsWith(pattern))
          .map((x) => x.target),
      ).size,
      suggestedPlaybook: pattern.startsWith("submission")
        ? tx(EXP.playbookSubmission, locale)
        : pattern.startsWith("support")
          ? tx(EXP.playbookSupport, locale)
          : tx(EXP.playbookDefault, locale),
    }));
  const outcomes = new Set(
    courses.flatMap((c) => c.outcomes.map((x) => x.trim())).filter(Boolean),
  );
  const linked = new Set(
    assignments.flatMap((a) => a.outcomes.map((x) => x.trim())).filter(Boolean),
  );
  const operations = Object.entries({
    authentication: serviceState.authentication,
    database: serviceState.database,
    storage: serviceState.storage,
    ai: serviceState.ai,
    ocr: serviceState.ocr,
    malware: serviceState.malware,
    notifications: serviceState.notifications,
    backup: serviceState.backup,
    billing: serviceState.billing,
  }).map(([key, ready]) => ({
    key,
    label: (
      {
        authentication: tx(EXP.svcAuthentication, locale),
        database: tx(EXP.svcDatabase, locale),
        storage: tx(EXP.svcStorage, locale),
        ai: tx(EXP.svcAi, locale),
        ocr: "OCR",
        malware: tx(EXP.svcMalware, locale),
        notifications: tx(EXP.svcNotifications, locale),
        backup: tx(EXP.svcBackup, locale),
        billing: tx(EXP.svcBilling, locale),
      } as Record<string, string>
    )[key],
    state: ready
      ? ("ready" as const)
      : ["billing"].includes(key)
        ? ("attention" as const)
        : ("blocked" as const),
    detail: ready ? tx(EXP.svcReady, locale) : tx(EXP.svcBlocked, locale),
  }));
  const blocked = operations.filter((x) => x.state === "blocked").length;
  const posture =
    control.metrics.openIncidents || blocked >= 4
      ? "critical"
      : decisions.some((x) => x.priority === "critical") || blocked
        ? "attention"
        : "healthy";
  return {
    generatedAt: nowIso(),
    posture,
    decisions,
    memory,
    twin: {
      projects: control.projects.length,
      courses: courses.length,
      assignments: assignments.length,
      outcomes: outcomes.size,
      outcomeCoverage: pct(
        [...outcomes].filter((x) => linked.has(x)).length,
        outcomes.size,
      ),
      submissions: submissions.length,
      graded: submissions.filter((x) =>
        ["graded", "released"].includes(x.status),
      ).length,
      released: submissions.filter((x) => x.status === "released").length,
    },
    operations,
  };
}

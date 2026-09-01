import type { ProjectDNA, WorkspaceArtifact } from '../types';

export type ExportLocale = 'ar'|'en'|'tr'|'zh'|'hi'|'es'|'fr'|'ur';
export interface ExportBranding { institutionName?: string; footer?: string; locale?: ExportLocale|string }

const EXPORT_LOCALES:Record<ExportLocale,{dir:'rtl'|'ltr';bcp:string}>={
  ar:{dir:'rtl',bcp:'ar-SA'}, en:{dir:'ltr',bcp:'en-US'}, tr:{dir:'ltr',bcp:'tr-TR'}, zh:{dir:'ltr',bcp:'zh-CN'},
  hi:{dir:'ltr',bcp:'hi-IN'}, es:{dir:'ltr',bcp:'es-ES'}, fr:{dir:'ltr',bcp:'fr-FR'}, ur:{dir:'rtl',bcp:'ur-PK'},
};
const X=(ar:string,en:string,tr:string,zh:string,hi:string,es:string,fr:string,ur:string):Record<ExportLocale,string>=>({ar,en,tr,zh,hi,es,fr,ur});
const WORDS={
  tagline:X('مشروع + فهم + إثبات','Project + understanding + proof','Proje + anlayış + kanıt','项目 + 理解 + 证明','प्रोजेक्ट + समझ + प्रमाण','Proyecto + comprensión + evidencia','Projet + compréhension + preuve','پروجیکٹ + فہم + ثبوت'),
  institution:X('الجهة','Institution','Kurum','机构','संस्थान','Institución','Établissement','ادارہ'), title:X('العنوان','Title','Başlık','标题','शीर्षक','Título','Titre','عنوان'),
  course:X('المقرر','Course','Ders','课程','कोर्स','Curso','Cours','کورس'), projectType:X('نوع المشروع','Project type','Proje türü','项目类型','प्रोजेक्ट प्रकार','Tipo de proyecto','Type de projet','پروجیکٹ کی قسم'),
  domain:X('المجال الأكاديمي','Academic domain','Akademik alan','学术领域','शैक्षणिक क्षेत्र','Área académica','Domaine académique','تعلیمی شعبہ'), status:X('الحالة','Status','Durum','状态','स्थिति','Estado','Statut','حالت'),
  progress:X('التقدم','Progress','İlerleme','进度','प्रगति','Progreso','Progression','پیش رفت'), deadline:X('الموعد','Deadline','Teslim tarihi','截止日期','डेडलाइन','Fecha límite','Échéance','ڈیڈ لائن'),
  aiPolicy:X('سياسة الذكاء الاصطناعي','AI policy','Yapay zeka politikası','AI 政策','AI नीति','Política de IA','Politique IA','AI پالیسی'), deliverables:X('المخرجات','Deliverables','Çıktılar','交付物','डिलिवरेबल्स','Entregables','Livrables','مخرجات'),
  requirements:X('المتطلبات','Requirements','Gereksinimler','要求','आवश्यकताएँ','Requisitos','Exigences','تقاضے'), tasks:X('المهام','Tasks','Görevler','任务','कार्य','Tareas','Tâches','کام'),
  rubric:X('معايير التقييم','Rubric','Rubrik','评分标准','रूब्रिक','Rúbrica','Grille','روبرک'), risks:X('المخاطر والتأكيدات','Risks / confirmations','Riskler / doğrulamalar','风险 / 待确认项','जोखिम / पुष्टियाँ','Riesgos / confirmaciones','Risques / confirmations','خطرات / تصدیقات'),
  artifacts:X('مخرجات مساحة العمل','Workspace artifacts','Çalışma alanı çıktıları','工作区成果','वर्कस्पेस आर्टिफैक्ट','Artefactos del espacio de trabajo','Artefacts de l’espace de travail','ورک اسپیس مواد'),
  academicProject:X('المشروع الأكاديمي','Academic project','Akademik proje','学术项目','शैक्षणिक प्रोजेक्ट','Proyecto académico','Projet académique','تعلیمی پروجیکٹ'),
  noRubric:X('لا يوجد Rubric مورّد أو مكتشف.','No rubric was supplied or detected.','Rubrik sağlanmadı veya algılanmadı.','未提供或检测到评分标准。','कोई रूब्रिक उपलब्ध या पहचाना नहीं गया।','No se proporcionó ni detectó una rúbrica.','Aucune grille n’a été fournie ou détectée.','کوئی روبرک فراہم یا دریافت نہیں ہوا۔'),
  noRisks:X('لا توجد مخاطر مسجلة حاليًا.','No risks are currently recorded.','Şu anda kayıtlı risk yok.','当前没有已记录风险。','अभी कोई दर्ज जोखिम नहीं है।','No hay riesgos registrados actualmente.','Aucun risque n’est actuellement enregistré.','فی الحال کوئی درج خطرہ نہیں۔'),
  noArtifacts:X('لا توجد مخرجات محفوظة في مساحة العمل.','No saved workspace artifacts.','Kaydedilmiş çalışma alanı çıktısı yok.','没有已保存的工作区成果。','कोई सहेजा वर्कस्पेस आर्टिफैक्ट नहीं।','No hay artefactos guardados.','Aucun artefact enregistré.','کوئی محفوظ ورک اسپیس مواد نہیں۔'),
  needsConfirmation:X('يحتاج تأكيدًا','Needs confirmation','Doğrulama gerekli','需要确认','पुष्टि आवश्यक','Necesita confirmación','À confirmer','تصدیق درکار'),
  noDescription:X('لا يوجد وصف','No description','Açıklama yok','无描述','कोई विवरण नहीं','Sin descripción','Aucune description','کوئی وضاحت نہیں'),
  aiDisclosure:X('الإفصاح عن الذكاء الاصطناعي','AI disclosure','AI açıklaması','AI 使用披露','AI उपयोग प्रकटीकरण','Divulgación de IA','Déclaration d’usage de l’IA','AI استعمال کا انکشاف'),
  nextAction:X('الخطوة التالية','Next action','Sonraki adım','下一步','अगला कदम','Siguiente paso','Prochaine étape','اگلا قدم'),
  noDeliverables:X('لا توجد مخرجات مسجلة','No deliverables','Kayıtlı çıktı yok','没有交付物','कोई डिलिवरेबल नहीं','Sin entregables','Aucun livrable','کوئی مخرج نہیں'),
  noRubricShort:X('لا يوجد Rubric','No rubric supplied','Rubrik yok','没有评分标准','कोई रूब्रिक नहीं','Sin rúbrica','Aucune grille','کوئی روبرک نہیں'),
  field:X('الحقل','Field','Alan','字段','फ़ील्ड','Campo','Champ','فیلڈ'), value:X('القيمة','Value','Değer','值','मान','Valor','Valeur','قدر'),
  deliverable:X('مخرج','Deliverable','Çıktı','交付物','डिलिवरेबल','Entregable','Livrable','مخرج'), task:X('مهمة','Task','Görev','任务','कार्य','Tarea','Tâche','کام'),
  rubricReadiness:X('جاهزية التقييم','Rubric readiness','Rubrik hazırlığı','评分标准就绪度','रूब्रिक तैयारी','Preparación de rúbrica','Préparation de la grille','روبرک تیاری'),
  level:X('المستوى','Level','Seviye','级别','स्तर','Nivel','Niveau','سطح'), exportedAt:X('وقت التصدير','Exported at','Dışa aktarma zamanı','导出时间','निर्यात समय','Exportado el','Exporté le','برآمد وقت'),
  submissionPackage:X('حزمة تسليم AcademicOS','AcademicOS Submission Package','AcademicOS Teslim Paketi','AcademicOS 提交包','AcademicOS सबमिशन पैकेज','Paquete de entrega AcademicOS','Dossier de remise AcademicOS','AcademicOS جمع کرانے کا پیکیج'),
  packageNotice:X('تحتوي هذه الحزمة على ملفات Office قابلة للتحرير إضافة إلى JSON وMarkdown وCSV. تحقق من أسماء الملفات ومتطلبات المقرر قبل التسليم، وتبقى متطلبات الإفصاح عن الذكاء الاصطناعي خاضعة لسياسة المشروع.','This package contains editable Office exports plus canonical JSON, Markdown, and CSV. Verify filenames and course submission requirements before final submission; AI disclosure requirements remain governed by the project policy.','Bu paket düzenlenebilir Office çıktıları ile JSON, Markdown ve CSV kayıtlarını içerir. Teslimden önce dosya adlarını ve ders gereksinimlerini doğrulayın; AI açıklama gereksinimleri proje politikasına tabidir.','此包包含可编辑的 Office 导出以及 JSON、Markdown 和 CSV。最终提交前请核验文件名和课程要求；AI 使用披露仍受项目政策约束。','इस पैकेज में संपादन योग्य Office निर्यात के साथ JSON, Markdown और CSV शामिल हैं। अंतिम जमा करने से पहले फ़ाइल नाम और कोर्स आवश्यकताएँ जाँचें; AI प्रकटीकरण प्रोजेक्ट नीति के अधीन है।','Este paquete contiene exportaciones editables de Office además de JSON, Markdown y CSV. Verifica nombres de archivo y requisitos del curso antes de entregar; la divulgación de IA se rige por la política del proyecto.','Ce dossier contient des exports Office modifiables ainsi que JSON, Markdown et CSV. Vérifiez les noms de fichiers et les exigences du cours avant remise ; la déclaration d’usage de l’IA reste régie par la politique du projet.','اس پیکیج میں قابلِ ترمیم Office فائلیں نیز JSON، Markdown اور CSV شامل ہیں۔ حتمی جمع کرانے سے پہلے فائل نام اور کورس تقاضے چیک کریں؛ AI انکشاف پروجیکٹ پالیسی کے تابع ہے۔'),
  verification:X('التحقق','Verification','Doğrulama','验证','सत्यापन','Verificación','Vérification','تصدیق'),
  generatedAt:X('تم الإنشاء','Generated at','Oluşturulma zamanı','生成时间','तैयार किया गया','Generado el','Généré le','تیار کیا گیا'),
  learningEvidence:X('أدلة التعلّم','Learning evidence','Öğrenme kanıtı','学习证据','अधिगम प्रमाण','Evidencia de aprendizaje','Preuves d’apprentissage','سیکھنے کے شواہد'),
  learningEvidenceNotice:X('يوثق هذا التقرير أدلة التعلّم المرصودة، ولا يمثل درجة كشف ذكاء اصطناعي ولا توقعًا للدرجة النهائية.','This report documents observed learning evidence. It is not an AI-detector score or a final-grade prediction.','Bu rapor gözlemlenen öğrenme kanıtlarını belgeler. Bir AI tespit puanı veya final notu tahmini değildir.','本报告记录观察到的学习证据，不是 AI 检测分数，也不是最终成绩预测。','यह रिपोर्ट देखे गए अधिगम प्रमाण को दर्ज करती है। यह AI-डिटेक्टर स्कोर या अंतिम ग्रेड का अनुमान नहीं है।','Este informe documenta evidencias de aprendizaje observadas. No es una puntuación de detector de IA ni una predicción de la nota final.','Ce rapport documente des preuves d’apprentissage observées. Il ne s’agit ni d’un score de détection d’IA ni d’une prédiction de note finale.','یہ رپورٹ مشاہدہ شدہ سیکھنے کے شواہد درج کرتی ہے۔ یہ AI ڈیٹیکٹر اسکور یا حتمی گریڈ کی پیش گوئی نہیں۔'),
  evidence:X('دليل','Evidence','Kanıt','证据','प्रमाण','Evidencia','Preuve','ثبوت'),
  created:X('أُنشئ','Created','Oluşturuldu','创建时间','बनाया गया','Creado','Créé','بنایا گیا'),
  term:X('الفصل','Term','Dönem','学期','टर्म','Periodo','Semestre','سمسٹر'),
  outcomes:X('نواتج التعلّم','Outcomes','Öğrenme çıktıları','学习成果','अधिगम परिणाम','Resultados de aprendizaje','Résultats d’apprentissage','سیکھنے کے نتائج'),
  assignments:X('التكليفات','Assignments','Ödevler','作业','असाइनमेंट','Tareas','Devoirs','اسائنمنٹس'),
  statusLabel:X('الحالة','Status','Durum','状态','स्थिति','Estado','Statut','حالت'),
  unknown:X('غير معروف','Unknown','Bilinmiyor','未知','अज्ञात','Desconocido','Inconnu','نامعلوم'),
  canonical:X('نسخة معتمدة داخل المشروع','Canonical project version','Projedeki kanonik sürüm','项目规范版本','प्रोजेक्ट का कैनोनिकल संस्करण','Versión canónica del proyecto','Version canonique du projet','پروجیکٹ کی کینونیکل ورژن'),
  reviewPlan:X('راجع خطة المشروع ومتطلباته.','Review the project plan and requirements.','Proje planını ve gereksinimlerini gözden geçirin.','审查项目计划与要求。','प्रोजेक्ट योजना और आवश्यकताओं की समीक्षा करें।','Revisa el plan y los requisitos del proyecto.','Examinez le plan et les exigences du projet.','پروجیکٹ پلان اور تقاضوں کا جائزہ لیں۔'),
  exportFooter:X('هذا التصدير سجل للمشروع وليس توقعًا للدرجة. تحقق من المصادر والبيانات وسياسة المقرر قبل التسليم.','This export is a project record, not a grade prediction. Verify sources, data, and course policy before submission.','Bu dışa aktarma bir proje kaydıdır, not tahmini değildir. Teslimden önce kaynakları, verileri ve ders politikasını doğrulayın.','此导出是项目记录，并非成绩预测。提交前请核验来源、数据和课程政策。','यह निर्यात प्रोजेक्ट रिकॉर्ड है, ग्रेड अनुमान नहीं। जमा करने से पहले स्रोत, डेटा और कोर्स नीति सत्यापित करें।','Esta exportación es un registro del proyecto, no una predicción de nota. Verifica fuentes, datos y política del curso antes de entregar.','Cet export est un relevé du projet, pas une prédiction de note. Vérifiez les sources, les données et la politique du cours avant remise.','یہ ایک پروجیکٹ ریکارڈ ہے، گریڈ کی پیش گوئی نہیں۔ جمع کرانے سے پہلے ذرائع، ڈیٹا اور کورس پالیسی کی تصدیق کریں۔'),
};
function exportLocale(project:ProjectDNA,branding:ExportBranding={}):ExportLocale{return normalizeExportLocale(branding.locale||project.language||'en');}
function w<K extends keyof typeof WORDS>(key:K,locale:ExportLocale){return WORDS[key][locale];}

const ENUM_LABELS:Record<string,Record<ExportLocale,string>>={
  not_started:X('لم يبدأ','Not started','Başlanmadı','未开始','शुरू नहीं हुआ','No iniciado','Non commencé','شروع نہیں ہوا'),
  pending:X('قيد الانتظار','Pending','Bekliyor','待处理','लंबित','Pendiente','En attente','زیر التوا'),
  in_progress:X('قيد التنفيذ','In progress','Devam ediyor','进行中','प्रगति पर','En curso','En cours','جاری'),
  ready:X('جاهز','Ready','Hazır','就绪','तैयार','Listo','Prêt','تیار'),
  completed:X('مكتمل','Completed','Tamamlandı','已完成','पूर्ण','Completado','Terminé','مکمل'),
  blocked:X('متوقف','Blocked','Engellendi','已阻塞','अवरुद्ध','Bloqueado','Bloqué','رکا ہوا'),
  needs_review:X('يحتاج مراجعة','Needs review','İnceleme gerekli','需要复核','समीक्षा आवश्यक','Necesita revisión','À réviser','جائزہ درکار'),
  high:X('ثقة عالية','High confidence','Yüksek güven','高置信度','उच्च विश्वास','Alta confianza','Confiance élevée','زیادہ اعتماد'),
  medium:X('ثقة متوسطة','Medium confidence','Orta güven','中等置信度','मध्यम विश्वास','Confianza media','Confiance moyenne','درمیانہ اعتماد'),
  needs_confirmation:X('يحتاج تأكيدًا','Needs confirmation','Doğrulama gerekli','需要确认','पुष्टि आवश्यक','Necesita confirmación','À confirmer','تصدیق درکار'),
  covered:X('مغطّى','Covered','Kapsandı','已覆盖','कवर किया गया','Cubierto','Couvert','مکمل احاطہ'),
  partial:X('جزئي','Partial','Kısmi','部分覆盖','आंशिक','Parcial','Partiel','جزوی'),
  not_evidenced:X('غير مدعوم بدليل بعد','Not evidenced yet','Henüz kanıtlanmadı','尚无证据','अभी प्रमाणित नहीं','Aún sin evidencia','Pas encore étayé','ابھی ثبوت نہیں'),
  needs_revision:X('يحتاج تعديلًا','Needs revision','Revizyon gerekli','需要修改','संशोधन आवश्यक','Necesita revisión','Révision nécessaire','ترمیم درکار'),
  draft:X('مسودة','Draft','Taslak','草稿','मसौदा','Borrador','Brouillon','مسودہ'),
  active:X('نشط','Active','Aktif','启用','सक्रिय','Activo','Actif','فعال'),
  archived:X('مؤرشف','Archived','Arşivlendi','已归档','संग्रहीत','Archivado','Archivé','آرکائیو شدہ'),
  published:X('منشور','Published','Yayınlandı','已发布','प्रकाशित','Publicado','Publié','شائع شدہ'),
  submitted:X('تم التسليم','Submitted','Teslim edildi','已提交','जमा किया गया','Entregado','Remis','جمع شدہ'),
  returned:X('مُعاد','Returned','İade edildi','已退回','वापस किया गया','Devuelto','Retourné','واپس کیا گیا'),
  grading:X('قيد التقييم','Grading','Değerlendiriliyor','评分中','ग्रेडिंग जारी','Calificando','Évaluation en cours','گریڈنگ جاری'),
  graded:X('تم التقييم','Graded','Değerlendirildi','已评分','ग्रेड किया गया','Calificado','Évalué','گریڈ ہو گیا'),
  released:X('تم النشر للطالب','Released','Yayınlandı','已发布给学生','जारी','Publicado al estudiante','Publié à l’étudiant','طالب کے لیے جاری'),
  withdrawn:X('منسحب','Withdrawn','Çekildi','已退出','वापस लिया','Retirado','Retiré','واپس لیا گیا'),
  revoked:X('ملغى','Revoked','İptal edildi','已撤销','रद्द','Revocado','Révoqué','منسوخ'),
  expired:X('منتهي','Expired','Süresi doldu','已过期','समाप्त','Caducado','Expiré','میعاد ختم'),
  verified:X('موثّق','Verified','Doğrulandı','已验证','सत्यापित','Verificado','Vérifié','تصدیق شدہ'),
  unverified:X('غير موثّق','Unverified','Doğrulanmadı','未验证','असत्यापित','No verificado','Non vérifié','غیر تصدیق شدہ'),
  research:X('البحث','Research','Araştırma','研究','शोध','Investigación','Recherche','تحقیق'),
  writing:X('الكتابة','Writing','Yazım','写作','लेखन','Redacción','Rédaction','تحریر'),
  data:X('البيانات','Data','Veri','数据','डेटा','Datos','Données','ڈیٹا'),
  spreadsheet:X('الجداول','Spreadsheet','Elektronik tablo','电子表格','स्प्रेडशीट','Hoja de cálculo','Tableur','اسپریڈ شیٹ'),
  code:X('البرمجة','Code','Kod','代码','कोड','Código','Code','کوڈ'),
  engineering:X('الهندسة','Engineering','Mühendislik','工程','इंजीनियरिंग','Ingeniería','Ingénierie','انجینئرنگ'),
  lab:X('المختبر','Lab','Laboratuvar','实验室','प्रयोगशाला','Laboratorio','Laboratoire','لیب'),
  design:X('التصميم','Design','Tasarım','设计','डिज़ाइन','Diseño','Conception','ڈیزائن'),
  media:X('الوسائط','Media','Medya','媒体','मीडिया','Medios','Médias','میڈیا'),
  presentation:X('العرض','Presentation','Sunum','演示','प्रस्तुति','Presentación','Présentation','پریزنٹیشن'),
  portfolio:X('المحفظة','Portfolio','Portföy','作品集','पोर्टफोलियो','Portafolio','Portfolio','پورٹ فولیو'),
  survey:X('الاستبيان','Survey','Anket','调查','सर्वेक्षण','Encuesta','Enquête','سروے'),
  team:X('الفريق','Team','Ekip','团队','टीम','Equipo','Équipe','ٹیم'),
  simulation:X('المحاكاة','Simulation','Simülasyon','模拟','सिमुलेशन','Simulación','Simulation','سیمیولیشن'),
  viva:X('المناقشة','Viva','Sözlü savunma','口试','मौखिक परीक्षा','Defensa oral','Soutenance orale','زبانی دفاع'),
};
function enumLabel(value:unknown,locale:ExportLocale){const raw=String(value??'').trim();const key=raw.toLowerCase().replace(/[\s-]+/g,'_');return ENUM_LABELS[key]?.[locale]||raw;}
function normalizeExportLocale(raw:unknown):ExportLocale{const short=String(raw||'en').trim().toLowerCase().slice(0,2) as ExportLocale;return short in EXPORT_LOCALES?short:'en';}
function formatExportDate(value:unknown,locale:ExportLocale){const raw=String(value??'').trim();if(!raw)return w('needsConfirmation',locale);const dateOnly=/^\d{4}-\d{2}-\d{2}$/.test(raw);const d=new Date(dateOnly?`${raw}T00:00:00Z`:raw);if(Number.isNaN(d.getTime()))return raw;return new Intl.DateTimeFormat(EXPORT_LOCALES[locale].bcp,{dateStyle:'medium',...(dateOnly?{timeZone:'UTC'}:{})}).format(d);}
function formatExportDateTime(value:Date|number|string,locale:ExportLocale){const d=value instanceof Date?value:new Date(value);if(Number.isNaN(d.getTime()))return String(value);return new Intl.DateTimeFormat(EXPORT_LOCALES[locale].bcp,{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(d);}

function academicSections(artifacts:WorkspaceArtifact[]){
  const manifest=artifacts.filter(a=>a.kind==='academic-document-manifest').sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
  if(manifest){
    try{
      const parsed=JSON.parse(manifest.content) as {sections?:Array<{artifactId?:string}>};
      const byId=new Map(artifacts.map(a=>[a.id,a]));
      const ordered=(parsed.sections||[]).map(section=>section.artifactId?byId.get(section.artifactId):undefined).filter(Boolean) as WorkspaceArtifact[];
      if(ordered.length)return ordered;
    }catch{}
  }
  return artifacts.filter(a=>a.kind==='academic-document-section').sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
}

export function projectExportHtml(project:ProjectDNA,artifacts:WorkspaceArtifact[]=[],branding:ExportBranding={}){
  const locale=exportLocale(project,branding), meta=EXPORT_LOCALES[locale], rtl=meta.dir==='rtl';
  const e=(v:unknown)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const list=(items:string[])=>`<ul>${items.map(x=>`<li>${x}</li>`).join('')}</ul>`;
  const sections=academicSections(artifacts);
  const manuscript=sections.length?`<h2>${w('academicProject',locale)}</h2>${sections.map(section=>`<section><h2>${e(section.title)}</h2><div class="section-content">${e(section.content).replace(/\n/g,'<br>')}</div></section>`).join('')}`:'';
  const deadline=formatExportDate(project.deadlines.final,locale);
  const footer=[w('exportFooter',locale),branding.footer].filter(Boolean).join(' ');
  return `<!doctype html><html lang="${locale}" dir="${meta.dir}"><head><meta charset="utf-8"><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Arial,"Noto Sans","Noto Sans Arabic",sans-serif;color:#17211e;line-height:1.75;font-size:11pt;text-align:start}h1{font-size:25pt;margin:0 0 6mm}h2{font-size:15pt;margin:8mm 0 3mm;border-bottom:1px solid #d9dfdc;padding-bottom:2mm}.meta{display:grid;grid-template-columns:1fr 1fr;gap:2mm 8mm;background:#f6f7f5;padding:4mm;border-radius:3mm}.muted{color:#66736e}.section-content{white-space:normal;text-align:justify}li{margin-bottom:1.5mm}.footer{margin-top:12mm;border-top:1px solid #d9dfdc;padding-top:3mm;font-size:8.5pt;color:#66736e}</style></head><body>${branding.institutionName?`<div class="muted">${e(branding.institutionName)}</div>`:''}<h1>${e(project.title)}</h1><div class="muted">AcademicOS — ${e(w('tagline',locale))}</div><div class="meta"><div><strong>${w('course',locale)}</strong><br>${e(project.course)}</div><div><strong>${w('projectType',locale)}</strong><br>${e(project.projectType)}</div><div><strong>${w('status',locale)}</strong><br>${e(enumLabel(project.status,locale))} — ${e(project.progress)}%</div><div><strong>${w('deadline',locale)}</strong><br>${e(deadline)}</div><div><strong>${w('aiPolicy',locale)}</strong><br>${w('level',locale)} ${e(project.aiPolicy.level)} — ${e(project.aiPolicy.summary)}</div><div><strong>${w('domain',locale)}</strong><br>${e(project.academicDomain)}</div></div>${manuscript}<h2>${w('deliverables',locale)}</h2>${list(project.deliverables.length?project.deliverables.map(d=>`<strong>${e(d.title)}</strong> — ${e(d.format)} — ${e(enumLabel(d.status,locale))}`):[w('noDeliverables',locale)])}<h2>${w('requirements',locale)}</h2>${list(project.requirements.length?project.requirements.map(r=>`<strong>${e(r.label)}</strong>: ${e(r.value)} <span class="muted">(${e(enumLabel(r.confidence,locale))})</span>`):[w('needsConfirmation',locale)])}<h2>${w('rubric',locale)}</h2>${list(project.rubric.length?project.rubric.map(r=>`<strong>${e(r.title)}</strong> (${e(r.weighting)}%) — ${e(enumLabel(r.readiness||'not_evidenced',locale))}`):[w('noRubric',locale)])}<h2>${w('risks',locale)}</h2>${list(project.riskFlags.length?project.riskFlags.map(e):[w('noRisks',locale)])}<div class="footer">${e(w('exportedAt',locale))}: ${e(formatExportDateTime(new Date(),locale))}. ${e(footer)}</div></body></html>`;
}

function markdown(project: ProjectDNA, artifacts: WorkspaceArtifact[] = [], branding:ExportBranding={}) {
  const locale=exportLocale(project,branding), sections=academicSections(artifacts);
  const deadline=formatExportDate(project.deadlines.final,locale);
  const lines = [
    ...(branding.institutionName?[`**${w('institution',locale)}:** ${branding.institutionName}`,'']:[]),`# ${project.title}`,'',`- **${w('course',locale)}:** ${project.course}`,`- **${w('projectType',locale)}:** ${project.projectType}`,`- **${w('status',locale)}:** ${enumLabel(project.status,locale)}`,`- **${w('progress',locale)}:** ${project.progress}%`,
    ...(sections.length?['',`## ${w('academicProject',locale)}`,...sections.flatMap(section=>['',`### ${section.title}`,'',section.content])]:[]),
    `- **${w('deadline',locale)}:** ${deadline}`,`- **${w('aiPolicy',locale)}:** ${w('level',locale)} ${project.aiPolicy.level} — ${project.aiPolicy.summary}`,'',`## ${w('deliverables',locale)}`,
    ...(project.deliverables.length?project.deliverables.map(d => `- [${d.status === 'completed' || d.status === 'ready' ? 'x' : ' '}] ${d.title} — ${d.format} — ${enumLabel(d.status,locale)}`):[`- ${w('noDeliverables',locale)}`]),'',`## ${w('requirements',locale)}`,
    ...(project.requirements.length?project.requirements.map(r => `- **${r.label}:** ${r.value} (${enumLabel(r.confidence,locale)})`):[`- ${w('needsConfirmation',locale)}`]),'',`## ${w('tasks',locale)}`,...project.tasks.map(t => `- [${t.status === 'completed' ? 'x' : ' '}] ${t.title} — ${t.status}`),'',`## ${w('rubric',locale)}`,
    ...(project.rubric.length ? project.rubric.map(r => `- **${r.title}** (${r.weighting}%): ${r.description || w('noDescription',locale)} — ${r.readiness || 'not_evidenced'}`) : [`- ${w('noRubric',locale)}`]),'',`## ${w('risks',locale)}`,
    ...(project.riskFlags.length ? project.riskFlags.map(r => `- ${r}`) : [`- ${w('noRisks',locale)}`]),'',`## ${w('artifacts',locale)}`,
    ...(artifacts.length ? artifacts.map(a => `- **${a.title}** — ${a.module} / ${a.status}${a.deliverableId ? ` → ${w('deliverable',locale)} ${a.deliverableId}` : ''}${a.rubricIds?.length ? ` → ${w('rubric',locale)} ${a.rubricIds.join(', ')}` : ''}${a.isCanonical ? ` — ${w('canonical',locale)}` : ''}`) : [`- ${w('noArtifacts',locale)}`]),'','---',
    `${w('exportedAt',locale)}: ${formatExportDateTime(new Date(),locale)}. ${w('exportFooter',locale)}${branding.footer?` ${branding.footer}`:''}`,
  ]; return lines.join('\n');
}

function crc32(input: Buffer) {let crc=0xffffffff;for(const byte of input){crc^=byte;for(let i=0;i<8;i+=1)crc=(crc>>>1)^(0xedb88320&-(crc&1));}return(crc^0xffffffff)>>>0;}
export function zipStore(files:Array<{name:string;data:Buffer}>){const chunks:Buffer[]=[];const central:Buffer[]=[];let offset=0;for(const file of files){const name=Buffer.from(file.name,'utf8');const crc=crc32(file.data);const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);local.writeUInt16LE(0,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(file.data.length,18);local.writeUInt32LE(file.data.length,22);local.writeUInt16LE(name.length,26);chunks.push(local,name,file.data);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x0800,8);c.writeUInt16LE(0,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(file.data.length,20);c.writeUInt32LE(file.data.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);central.push(c,name);offset+=local.length+name.length+file.data.length;}const centralBuffer=Buffer.concat(central);const eocd=Buffer.alloc(22);eocd.writeUInt32LE(0x06054b50,0);eocd.writeUInt16LE(files.length,8);eocd.writeUInt16LE(files.length,10);eocd.writeUInt32LE(centralBuffer.length,12);eocd.writeUInt32LE(offset,16);return Buffer.concat([...chunks,centralBuffer,eocd]);}

function xml(value:unknown){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function b(value:string){return Buffer.from(value,'utf8');}
function projectRows(project:ProjectDNA,branding:ExportBranding={}){
  const locale=exportLocale(project,branding);
  return [
    [w('field',locale),w('value',locale)],...(branding.institutionName?[[w('institution',locale),branding.institutionName]]:[]),[w('title',locale),project.title],[w('course',locale),project.course],[w('projectType',locale),project.projectType],[w('domain',locale),project.academicDomain],[w('status',locale),enumLabel(project.status,locale)],[w('progress',locale),`${project.progress}%`],[w('deadline',locale),formatExportDate(project.deadlines.final,locale)],[w('aiPolicy',locale),`${w('level',locale)} ${project.aiPolicy.level} — ${project.aiPolicy.summary}`],
    ...project.deliverables.map(d=>[`${w('deliverable',locale)}: ${d.title}`,`${d.format} — ${enumLabel(d.status,locale)}`]),...project.tasks.map(t=>[`${w('task',locale)}: ${t.title}`,enumLabel(t.status,locale)]),...project.rubric.map(r=>[`${w('rubric',locale)}: ${r.title}`,`${r.weighting}% — ${enumLabel(r.readiness||'not_evidenced',locale)}`]),
  ];
}

function docx(project:ProjectDNA,artifacts:WorkspaceArtifact[],branding:ExportBranding={}){
  const locale=exportLocale(project,branding), meta=EXPORT_LOCALES[locale], rtl=meta.dir==='rtl';
  const sections=academicSections(artifacts);
  const paras=[...(branding.institutionName?[branding.institutionName]:[]),project.title,`${w('course',locale)}: ${project.course}`,`${w('projectType',locale)}: ${project.projectType}`,`${w('deadline',locale)}: ${formatExportDate(project.deadlines.final,locale)}`,...sections.flatMap(section=>[section.title,...section.content.split(/\n+/).filter(Boolean)]),w('rubric',locale),...(project.rubric.length?project.rubric.map(r=>`${r.title} (${r.weighting}%): ${r.description||''} — ${enumLabel(r.readiness||'not_evidenced',locale)}`):[w('noRubric',locale)]),w('aiDisclosure',locale),project.aiPolicy.summary,w('exportFooter',locale)];
  const sectionTitles=new Set([w('rubric',locale),w('aiDisclosure',locale),...sections.map(section=>section.title)]);
  const dirP=rtl?'<w:bidi/>':''; const dirR=rtl?'<w:rtl/>':'';
  const p=paras.map((t,i)=>`<w:p${i===0?' w:rsidR="00000000"':''}><w:pPr>${dirP}<w:jc w:val="${i===0?'center':rtl?'right':'left'}"/>${sectionTitles.has(t)?'<w:spacing w:before="300" w:after="120"/>':''}</w:pPr><w:r><w:rPr>${i===0||sectionTitles.has(t)?'<w:b/>':''}${dirR}<w:lang w:val="${meta.bcp}"/></w:rPr><w:t xml:space="preserve">${xml(t)}</w:t></w:r></w:p>`).join('');
  return zipStore([
    {name:'[Content_Types].xml',data:b(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`)},
    {name:'_rels/.rels',data:b(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`)},
    {name:'word/document.xml',data:b(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${p}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`)},
    {name:'docProps/core.xml',data:b(`<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"><dc:title>${xml(project.title)}</dc:title><dc:creator>AcademicOS</dc:creator><dcterms:created xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`)},
  ]);
}

function pptx(project:ProjectDNA,branding:ExportBranding={}){
  const locale=exportLocale(project,branding), meta=EXPORT_LOCALES[locale], rtl=meta.dir==='rtl';
  const slides=[
    [project.title,`${branding.institutionName?branding.institutionName+' · ':''}${project.course} · ${project.projectType}`],
    [w('deliverables',locale),project.deliverables.map(d=>`${d.title} — ${enumLabel(d.status,locale)}`).join('\n')||w('noDeliverables',locale)],
    [w('rubricReadiness',locale),project.rubric.map(r=>`${r.title}: ${enumLabel(r.readiness||'not_evidenced',locale)}`).join('\n')||w('noRubricShort',locale)],
    [w('nextAction',locale),project.nextAction||w('reviewPlan',locale)],
  ];
  const files:Array<{name:string;data:Buffer}>=[
    {name:'[Content_Types].xml',data:b(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${slides.map((_,i)=>`<Override PartName="/ppt/slides/slide${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>`)},
    {name:'_rels/.rels',data:b(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>`)},
    {name:'ppt/presentation.xml',data:b(`<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_,i)=>`<p:sldId id="${256+i}" r:id="rId${i+2}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`)},
    {name:'ppt/_rels/presentation.xml.rels',data:b(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slides.map((_,i)=>`<Relationship Id="rId${i+2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i+1}.xml"/>`).join('')}</Relationships>`)},
    {name:'ppt/slideMasters/slideMaster1.xml',data:b(`<?xml version="1.0" encoding="UTF-8"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm/></p:grpSpPr></p:spTree></p:cSld><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`)},
    {name:'ppt/slideMasters/_rels/slideMaster1.xml.rels',data:b(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`)},
    {name:'ppt/slideLayouts/slideLayout1.xml',data:b(`<?xml version="1.0" encoding="UTF-8"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm/></p:grpSpPr></p:spTree></p:cSld></p:sldLayout>`)},
    {name:'ppt/slideLayouts/_rels/slideLayout1.xml.rels',data:b(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`)},
    {name:'ppt/theme/theme1.xml',data:b(`<?xml version="1.0" encoding="UTF-8"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="AcademicOS"><a:themeElements><a:clrScheme name="AcademicOS"><a:dk1><a:srgbClr val="111111"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="333333"/></a:dk2><a:lt2><a:srgbClr val="F6F5F1"/></a:lt2><a:accent1><a:srgbClr val="335C55"/></a:accent1><a:accent2><a:srgbClr val="6B7A74"/></a:accent2><a:accent3><a:srgbClr val="8D755B"/></a:accent3><a:accent4><a:srgbClr val="566A85"/></a:accent4><a:accent5><a:srgbClr val="7B6B85"/></a:accent5><a:accent6><a:srgbClr val="92706C"/></a:accent6><a:hlink><a:srgbClr val="335C55"/></a:hlink><a:folHlink><a:srgbClr val="6B7A74"/></a:folHlink></a:clrScheme><a:fontScheme name="AcademicOS"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="AcademicOS"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>`)},
  ];
  slides.forEach(([title,body],i)=>{const shape=(id:number,name:string,text:string,y:number,size:number)=>`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="762000" y="${y}"/><a:ext cx="10668000" cy="${id===2?1000000:4300000}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr rtlCol="${rtl?1:0}"/><a:lstStyle/><a:p><a:pPr algn="${rtl?'r':'l'}"${rtl?' rtl="1"':''}/><a:r><a:rPr lang="${meta.bcp}" sz="${size}"/><a:t>${xml(text)}</a:t></a:r></a:p></p:txBody></p:sp>`;files.push({name:`ppt/slides/slide${i+1}.xml`,data:b(`<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm/></p:grpSpPr>${shape(2,'Title',title,600000,2800)}${shape(3,'Body',body,1800000,1600)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`)});files.push({name:`ppt/slides/_rels/slide${i+1}.xml.rels`,data:b(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`)})});
  return zipStore(files);
}

function xlsx(project:ProjectDNA,branding:ExportBranding={}){
  const locale=exportLocale(project,branding), rtl=EXPORT_LOCALES[locale].dir==='rtl';
  const rows=projectRows(project,branding);const sheet=rows.map((row,r)=>`<row r="${r+1}">${row.map((cell,c)=>`<c r="${String.fromCharCode(65+c)}${r+1}" t="inlineStr"><is><t>${xml(cell)}</t></is></c>`).join('')}</row>`).join('');
  return zipStore([
    {name:'[Content_Types].xml',data:b(`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`)},
    {name:'_rels/.rels',data:b(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`)},
    {name:'xl/workbook.xml',data:b(`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Project" sheetId="1" r:id="rId1"/></sheets></workbook>`)},
    {name:'xl/_rels/workbook.xml.rels',data:b(`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`)},
    {name:'xl/worksheets/sheet1.xml',data:b(`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="${rtl?1:0}" workbookViewId="0"/></sheetViews><sheetData>${sheet}</sheetData></worksheet>`)},
  ]);
}

export function safeCsvCell(value:unknown){const raw=String(value??'');const literal=/^[\u0009\u000d\u000a ]*[=+\-@]/.test(raw)?`'${raw}`:raw;return `"${literal.replace(/"/g,'""')}"`;}
function csv(project:ProjectDNA,branding:ExportBranding={}){return Buffer.from('\uFEFF'+projectRows(project,branding).map(row=>row.map(safeCsvCell).join(',')).join('\r\n'),'utf8');}

export function exportProject(project: ProjectDNA, format: string, artifacts: WorkspaceArtifact[] = [], branding:ExportBranding={}) {
  const safe = project.title.replace(/[^\p{L}\p{N}._ -]+/gu, '_').slice(0, 80) || 'AcademicOS-project';
  const json = Buffer.from(JSON.stringify({ ...project, workspaceArtifacts: artifacts }, null, 2), 'utf8');const artifactsJson=Buffer.from(JSON.stringify(artifacts,null,2),'utf8');const md=Buffer.from(markdown(project,artifacts,branding),'utf8');
  if(format==='json')return{data:json,contentType:'application/json; charset=utf-8',filename:`${safe}.json`};
  if(format==='md'||format==='markdown')return{data:md,contentType:'text/markdown; charset=utf-8',filename:`${safe}.md`};
  if(format==='csv')return{data:csv(project,branding),contentType:'text/csv; charset=utf-8',filename:`${safe}.csv`};
  if(format==='docx')return{data:docx(project,artifacts,branding),contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',filename:`${safe}.docx`};
  if(format==='pptx')return{data:pptx(project,branding),contentType:'application/vnd.openxmlformats-officedocument.presentationml.presentation',filename:`${safe}.pptx`};
  if(format==='xlsx')return{data:xlsx(project,branding),contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',filename:`${safe}.xlsx`};
  if(format==='pdf')throw Object.assign(new Error('PDF export requires the isolated PDF renderer configured by PDF_RENDER_SERVICE_URL; AcademicOS does not fake a PDF renderer.'),{status:503,code:'PDF_RENDER_NOT_CONFIGURED'});
  if(format==='zip'){
    const manifest=Buffer.from(JSON.stringify({schemaVersion:1,projectId:project.id,title:project.title,exportedAt:new Date().toISOString(),files:['project.json','project.md','workspace-artifacts.json','project.csv','project.docx','project.pptx','project.xlsx'],deliverables:project.deliverables.map(d=>({id:d.id,title:d.title,format:d.format,status:d.status,ownerId:d.ownerId||null})),branding:{institutionName:branding.institutionName||null,footer:branding.footer||null},aiDisclosure:{required:Boolean(project.aiPolicy?.disclosureRequired),policyLevel:project.aiPolicy?.level,summary:project.aiPolicy?.summary||''}},null,2),'utf8');
    const locale=exportLocale(project,branding); const readme=Buffer.from(`${w('submissionPackage',locale)}\n\n${w('packageNotice',locale)}\n`,'utf8');
    return{data:zipStore([{name:'README.txt',data:readme},{name:'submission-manifest.json',data:manifest},{name:'project.json',data:json},{name:'project.md',data:md},{name:'workspace-artifacts.json',data:artifactsJson},{name:'project.csv',data:csv(project,branding)},{name:'project.docx',data:docx(project,artifacts,branding)},{name:'project.pptx',data:pptx(project,branding)},{name:'project.xlsx',data:xlsx(project,branding)}]),contentType:'application/zip',filename:`${safe}.zip`};
  }
  throw Object.assign(new Error('Supported exports: JSON, Markdown, CSV, DOCX, PPTX, XLSX, ZIP. PDF requires the configured isolated renderer.'),{status:400,code:'EXPORT_FORMAT_UNSUPPORTED'});
}

export function exportCitations(evidence: Array<{id:string;type:string;title:string;detail:string;sourceUrl?:string;verification:string}>, format='ris', branding:ExportBranding={}) {
  const locale=normalizeExportLocale(branding.locale||'en');
  const sources=evidence.filter(x=>x.type==='source'||Boolean(x.sourceUrl));
  const safeTitle=(v:string)=>String(v||'Untitled source').replace(/[{}]/g,'');
  if(format==='json')return{data:Buffer.from(JSON.stringify({sources},null,2),'utf8'),contentType:'application/json; charset=utf-8',filename:'AcademicOS-bibliography.json'};
  if(format==='bib'||format==='bibtex'){
    const text=sources.map((x,i)=>`@misc{academicos_${i+1},\n  title = {${safeTitle(x.title)}},${x.sourceUrl?`\n  howpublished = {\\url{${x.sourceUrl}}},`:''}\n  note = {${w('verification',locale)}: ${enumLabel(x.verification,locale)}; ${safeTitle(x.detail).slice(0,500)}}\n}`).join('\n\n');
    return{data:Buffer.from(text,'utf8'),contentType:'application/x-bibtex; charset=utf-8',filename:'AcademicOS-bibliography.bib'};
  }
  const ris=sources.map(x=>['TY  - ELEC',`TI  - ${x.title}`,x.sourceUrl?`UR  - ${x.sourceUrl}`:'',`N1  - ${w('verification',locale)}: ${enumLabel(x.verification,locale)}; ${x.detail.replace(/\r?\n/g,' ').slice(0,500)}`,'ER  -'].filter(Boolean).join('\r\n')).join('\r\n\r\n');
  return{data:Buffer.from(ris,'utf8'),contentType:'application/x-research-info-systems; charset=utf-8',filename:'AcademicOS-bibliography.ris'};
}

export function exportLearningEvidenceReport(project:ProjectDNA,evidence:Array<{source:string;summary:string;evidence:Array<{label:string;value:string}>;createdAt:string}>,format='md',branding:ExportBranding={}){
  const locale=exportLocale(project,branding);
  const generatedAt=new Date().toISOString();
  const payload={
    project:{id:project.id,title:project.title,course:project.course},
    generatedAt,
    locale,
    learningEvidence:evidence,
    notice:w('learningEvidenceNotice',locale),
  };
  if(format==='json')return{data:Buffer.from(JSON.stringify(payload,null,2),'utf8'),contentType:'application/json; charset=utf-8',filename:'AcademicOS-learning-evidence.json'};
  const lines=[
    `# ${w('learningEvidence',locale)} — ${project.title}`,
    '',
    `${w('course',locale)}: ${project.course}`,
    `${w('generatedAt',locale)}: ${formatExportDateTime(generatedAt,locale)}`,
    '',
    w('learningEvidenceNotice',locale),
    '',
    ...evidence.flatMap((x,i)=>[
      `## ${w('evidence',locale)} ${i+1} — ${x.source}`,
      x.summary,
      `${w('created',locale)}: ${formatExportDateTime(x.createdAt,locale)}`,
      ...x.evidence.map(e=>`- **${e.label}:** ${e.value}`),
      '',
    ]),
  ];
  return{data:Buffer.from(lines.join('\n'),'utf8'),contentType:'text/markdown; charset=utf-8',filename:'AcademicOS-learning-evidence.md'};
}

export function exportCourseArchive(course:{id:string;code:string;title:string;term?:string;outcomes:string[];aiPolicy:unknown;status:string;createdAt:string;updatedAt:string},assignments:Array<Record<string,unknown>>,branding:ExportBranding={}){
  const locale=normalizeExportLocale(branding.locale||'en');
  const exportedAt=new Date().toISOString();
  const humanCourse={...course,statusLabel:enumLabel(course.status,locale)};
  const humanAssignments=assignments.map((x:any)=>({...x,statusLabel:enumLabel(x.status||'unknown',locale)}));
  const md=[
    `# ${course.code} — ${course.title}`,
    course.term?`${w('term',locale)}: ${course.term}`:'',
    `${w('statusLabel',locale)}: ${enumLabel(course.status,locale)}`,
    `${w('exportedAt',locale)}: ${formatExportDateTime(exportedAt,locale)}`,
    '',
    `## ${w('outcomes',locale)}`,
    ...(course.outcomes.length?course.outcomes.map(x=>`- ${x}`):[`- ${w('needsConfirmation',locale)}`]),
    '',
    `## ${w('assignments',locale)}`,
    ...(assignments.length?assignments.map((x:any)=>`- ${x.title||x.id} — ${enumLabel(x.status||'unknown',locale)}`):[`- ${w('needsConfirmation',locale)}`]),
  ].filter(Boolean).join('\n');
  const manifest={schemaVersion:1,courseId:course.id,locale,files:['course.json','course.md','assignments.json'],records:{assignments:assignments.length},exportedAt};
  return{data:zipStore([{name:'course.json',data:Buffer.from(JSON.stringify(humanCourse,null,2),'utf8')},{name:'course.md',data:Buffer.from(md,'utf8')},{name:'assignments.json',data:Buffer.from(JSON.stringify(humanAssignments,null,2),'utf8')},{name:'archive-manifest.json',data:Buffer.from(JSON.stringify(manifest,null,2),'utf8')}]),contentType:'application/zip',filename:`${course.code.replace(/[^A-Za-z0-9._-]+/g,'_')||'AcademicOS-course'}-archive.zip`};
}

import type { LocaleCode } from "./i18n";

const categoryNames: Record<string, Partial<Record<LocaleCode, string>>> = {
  productivity:{ar:"الإنتاجية",en:"Productivity",tr:"Üretkenlik",zh:"生产力",hi:"उत्पादकता",es:"Productividad",fr:"Productivité",ur:"پیداواری صلاحیت"},
  lms:{ar:"نظام إدارة التعلّم",en:"Learning management",tr:"Öğrenme yönetimi",zh:"学习管理",hi:"लर्निंग मैनेजमेंट",es:"Gestión del aprendizaje",fr:"Gestion de l’apprentissage",ur:"لرننگ مینجمنٹ"},
  code:{ar:"البرمجة",en:"Code",tr:"Kod",zh:"代码",hi:"कोड",es:"Código",fr:"Code",ur:"کوڈ"},
  calendar:{ar:"التقويم",en:"Calendar",tr:"Takvim",zh:"日历",hi:"कैलेंडर",es:"Calendario",fr:"Calendrier",ur:"کیلنڈر"},
  communications:{ar:"الاتصالات",en:"Communications",tr:"İletişim",zh:"通信",hi:"संचार",es:"Comunicaciones",fr:"Communications",ur:"مواصلات"},
  identity:{ar:"الهوية",en:"Identity",tr:"Kimlik",zh:"身份",hi:"पहचान",es:"Identidad",fr:"Identité",ur:"شناخت"},
  billing:{ar:"الفوترة",en:"Billing",tr:"Faturalama",zh:"计费",hi:"बिलिंग",es:"Facturación",fr:"Facturation",ur:"بلنگ"},
  ai:{ar:"الذكاء الاصطناعي",en:"AI",tr:"Yapay zekâ",zh:"人工智能",hi:"AI",es:"IA",fr:"IA",ur:"AI"},
  documents:{ar:"المستندات",en:"Documents",tr:"Belgeler",zh:"文档",hi:"दस्तावेज़",es:"Documentos",fr:"Documents",ur:"دستاویزات"},
  operations:{ar:"العمليات",en:"Operations",tr:"Operasyonlar",zh:"运维",hi:"ऑपरेशंस",es:"Operaciones",fr:"Opérations",ur:"آپریشنز"},
  search:{ar:"البحث",en:"Search",tr:"Arama",zh:"搜索",hi:"खोज",es:"Búsqueda",fr:"Recherche",ur:"تلاش"},
  speech:{ar:"الصوت",en:"Speech",tr:"Ses",zh:"语音",hi:"वाणी",es:"Voz",fr:"Voix",ur:"آواز"},
  crm:{ar:"إدارة العلاقات",en:"CRM",tr:"CRM",zh:"CRM",hi:"CRM",es:"CRM",fr:"CRM",ur:"CRM"},
  storage:{ar:"التخزين",en:"Storage",tr:"Depolama",zh:"存储",hi:"स्टोरेज",es:"Almacenamiento",fr:"Stockage",ur:"اسٹوریج"},
};

const modeNames: Record<string, Partial<Record<LocaleCode, string>>> = {
  tenant_oauth:{ar:"OAuth للمؤسسة",en:"Institution OAuth",tr:"Kurum OAuth",zh:"机构 OAuth",hi:"संस्थान OAuth",es:"OAuth institucional",fr:"OAuth établissement",ur:"ادارہ OAuth"},
  contract:{ar:"موصل مؤسسي",en:"Institution connector",tr:"Kurum bağlayıcısı",zh:"机构连接器",hi:"संस्थान कनेक्टर",es:"Conector institucional",fr:"Connecteur établissement",ur:"ادارہ جاتی کنیکٹر"},
  server:{ar:"خدمة خادمية",en:"Server service",tr:"Sunucu hizmeti",zh:"服务器服务",hi:"सर्वर सेवा",es:"Servicio de servidor",fr:"Service serveur",ur:"سرور سروس"},
};

const templates: Record<LocaleCode, (name:string, category:string)=>string> = {
  ar:(name,category)=>`تهيئة ${name} بأمان ضمن ${category} للمؤسسة، بصلاحيات محددة وأسرار محفوظة خارج بيانات التطبيق.`,
  en:(name,category)=>`Configure ${name} securely for institutional ${category}, with scoped access and secrets kept outside application data.`,
  tr:(name,category)=>`${name} entegrasyonunu kurumsal ${category} için kapsamlı erişimle ve sırları uygulama verisinin dışında tutarak güvenli biçimde yapılandırın.`,
  zh:(name,category)=>`为机构的${category}安全配置 ${name}，采用范围化权限，并将密钥保存在应用数据之外。`,
  hi:(name,category)=>`संस्थान के ${category} के लिए ${name} को सीमित एक्सेस के साथ सुरक्षित रूप से कॉन्फ़िगर करें और सीक्रेट्स को ऐप डेटा से बाहर रखें।`,
  es:(name,category)=>`Configura ${name} de forma segura para ${category} institucional, con acceso limitado y secretos fuera de los datos de la aplicación.`,
  fr:(name,category)=>`Configurez ${name} en toute sécurité pour ${category} institutionnel, avec des droits limités et des secrets conservés hors des données applicatives.`,
  ur:(name,category)=>`ادارے کے ${category} کے لیے ${name} کو محدود رسائی کے ساتھ محفوظ طریقے سے ترتیب دیں اور راز ایپ ڈیٹا سے باہر رکھیں۔`,
};

export function integrationCategoryLabel(category:string, locale:LocaleCode):string {
  return categoryNames[category]?.[locale] || categoryNames[category]?.en || category;
}
export function integrationModeLabel(mode:string, locale:LocaleCode):string {
  return modeNames[mode]?.[locale] || modeNames[mode]?.en || mode.replaceAll("_", " ");
}
export function integrationDescription(name:string, category:string, locale:LocaleCode):string {
  return templates[locale](name, integrationCategoryLabel(category, locale));
}

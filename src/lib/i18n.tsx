import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MESSAGES } from "./i18n-messages";

// نظام تدويل خفيف بلا اعتماديات — يدعم لغات الناس الحقيقية مع RTL/LTR والسرد الصوتي.
export type LocaleCode = "ar" | "en" | "tr" | "zh" | "hi" | "es" | "fr" | "ur";

export interface LocaleMeta {
  code: LocaleCode;
  name: string;      // الاسم بلغته الأصلية
  dir: "rtl" | "ltr";
  speech: string;    // وسم BCP-47 للنطق الصوتي
  aiName: string;    // اسم اللغة المُرسل للنموذج
}

export const LOCALES: LocaleMeta[] = [
  { code: "ar", name: "العربية", dir: "rtl", speech: "ar-SA", aiName: "العربية" },
  { code: "en", name: "English", dir: "ltr", speech: "en-US", aiName: "English" },
  { code: "tr", name: "Türkçe", dir: "ltr", speech: "tr-TR", aiName: "Türkçe" },
  { code: "zh", name: "中文", dir: "ltr", speech: "zh-CN", aiName: "中文" },
  { code: "hi", name: "हिन्दी", dir: "ltr", speech: "hi-IN", aiName: "हिन्दी" },
  { code: "es", name: "Español", dir: "ltr", speech: "es-ES", aiName: "Español" },
  { code: "fr", name: "Français", dir: "ltr", speech: "fr-FR", aiName: "Français" },
  { code: "ur", name: "اردو", dir: "rtl", speech: "ur-PK", aiName: "اردو" },
];

export function localeMeta(code: LocaleCode): LocaleMeta {
  return LOCALES.find((l) => l.code === code) || LOCALES.find((l) => l.code === "en") || LOCALES[0];
}

export function localeIntlTag(code: LocaleCode): string {
  return localeMeta(code).speech;
}

export function formatDateTime(value: string | number | Date, locale: LocaleCode, options?: Intl.DateTimeFormatOptions) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(localeIntlTag(locale), options || { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatDate(value: string | number | Date, locale: LocaleCode, options?: Intl.DateTimeFormatOptions) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(localeIntlTag(locale), options || { dateStyle: "medium" }).format(date);
}

export function formatMoney(amount: number, currency: string, locale: LocaleCode) {
  return new Intl.NumberFormat(localeIntlTag(locale), { style: "currency", currency, maximumFractionDigits: currency === "KWD" ? 3 : 2 }).format(amount);
}

type Dict = Record<string, string>;
const S = (
  ar: string, en: string, tr: string, zh: string, hi: string, es: string, fr: string, ur: string,
): Record<LocaleCode, string> => ({ ar, en, tr, zh, hi, es, fr, ur });

// قاموس مركّز على صفحة التعلّم والتنقّل — إطار قابل للتوسّع لبقية الواجهة.
const DICT: Record<string, Record<LocaleCode, string>> = {
  "app.language": S("اللغة", "Language", "Dil", "语言", "भाषा", "Idioma", "Langue", "زبان"),
  "learn.title": S("مركز التعلّم", "Learning Studio", "Öğrenme Stüdyosu", "学习中心", "लर्निंग स्टूडियो", "Estudio de Aprendizaje", "Studio d'apprentissage", "لرننگ اسٹوڈیو"),
  "learn.subtitle": S(
    "اسأل عن أي موضوع فيشرحه معلّم ذكي، أو اطلب حلًّا يحترم سياسة مقررك.",
    "Ask about any topic for a smart tutor, or request a solution that respects your course policy.",
    "Herhangi bir konuyu sorun ya da ders politikanıza uygun bir çözüm isteyin.",
    "询问任何主题获得智能讲解，或请求符合课程政策的解答。",
    "किसी भी विषय पर स्मार्ट शिक्षक से पूछें, या अपनी कोर्स नीति के अनुरूप समाधान मांगें।",
    "Pregunta sobre cualquier tema o pide una solución acorde a la política de tu curso.",
    "Posez une question sur n'importe quel sujet ou demandez une solution conforme à la politique du cours.",
    "کسی بھی موضوع پر ذہین ٹیوٹر سے پوچھیں، یا اپنی کورس پالیسی کے مطابق حل طلب کریں۔",
  ),
  "learn.explainTab": S("اشرح لي", "Explain", "Anlat", "讲解", "समझाएँ", "Explicar", "Expliquer", "سمجھائیں"),
  "learn.solveTab": S("حلّ لي", "Solve", "Çöz", "解答", "हल करें", "Resolver", "Résoudre", "حل کریں"),
  "learn.topic": S("الموضوع", "Topic", "Konu", "主题", "विषय", "Tema", "Sujet", "موضوع"),
  "learn.topicPh": S("مثال: المشتقات في التفاضل", "e.g. Derivatives in calculus", "örn. Türev", "例如：微积分中的导数", "उदा. कैलकुलस में अवकलज", "p.ej. Derivadas", "ex. Les dérivées", "مثلاً: مشتقات"),
  "learn.problem": S("المسألة", "Problem", "Problem", "问题", "समस्या", "Problema", "Problème", "مسئلہ"),
  "learn.problemPh": S("الصق المسألة هنا", "Paste the problem here", "Problemi buraya yapıştırın", "在此粘贴问题", "यहाँ समस्या पेस्ट करें", "Pega el problema aquí", "Collez le problème ici", "مسئلہ یہاں چسپاں کریں"),
  "learn.level": S("المستوى", "Level", "Seviye", "级别", "स्तर", "Nivel", "Niveau", "سطح"),
  "level.beginner": S("مبتدئ", "Beginner", "Başlangıç", "初级", "प्रारंभिक", "Principiante", "Débutant", "ابتدائی"),
  "level.intermediate": S("متوسط", "Intermediate", "Orta", "中级", "मध्यम", "Intermedio", "Intermédiaire", "متوسط"),
  "level.advanced": S("متقدّم", "Advanced", "İleri", "高级", "उन्नत", "Avanzado", "Avancé", "اعلیٰ"),
  "learn.go": S("ابدأ", "Go", "Başlat", "开始", "शुरू करें", "Iniciar", "Lancer", "شروع"),
  "learn.loading": S("جارٍ التحضير…", "Preparing…", "Hazırlanıyor…", "准备中…", "तैयार हो रहा है…", "Preparando…", "Préparation…", "تیاری…"),
  "learn.listen": S("استمع", "Listen", "Dinle", "朗读", "सुनें", "Escuchar", "Écouter", "سنیں"),
  "learn.stop": S("إيقاف", "Stop", "Durdur", "停止", "रोकें", "Detener", "Arrêter", "روکیں"),
  "learn.intuition": S("الحدس", "Intuition", "Sezgi", "直觉", "अंतर्ज्ञान", "Intuición", "Intuition", "بصیرت"),
  "learn.buildingBlocks": S("خطوات البناء", "Building blocks", "Yapı taşları", "构建步骤", "निर्माण खंड", "Bloques", "Étapes", "بنیادی اجزا"),
  "learn.checkYourself": S("اختبر نفسك", "Check yourself", "Kendini sına", "自我检测", "स्वयं जाँचें", "Autoevaluación", "Auto-vérification", "خود جانچیں"),
  "learn.mistakes": S("أخطاء شائعة", "Common mistakes", "Sık hatalar", "常见错误", "सामान्य गलतियाँ", "Errores comunes", "Erreurs fréquentes", "عام غلطیاں"),
  "learn.finalAnswer": S("الإجابة النهائية", "Final answer", "Sonuç", "最终答案", "अंतिम उत्तर", "Respuesta final", "Réponse finale", "حتمی جواب"),
  "learn.strategy": S("طريقة التفكير", "Strategy", "Strateji", "思路", "रणनीति", "Estrategia", "Stratégie", "حکمت عملی"),
  "learn.steps": S("الخطوات", "Steps", "Adımlar", "步骤", "चरण", "Pasos", "Étapes", "مراحل"),
  "learn.verify": S("تحقّق", "Verify", "Doğrula", "验证", "सत्यापित करें", "Verificar", "Vérifier", "تصدیق"),
  "learn.caveats": S("تنبيهات", "Caveats", "Uyarılar", "注意事项", "सावधानियाँ", "Advertencias", "Réserves", "احتیاط"),
  "learn.guidedNote": S("وضع إرشادي — يوصّلك للحل دون تسليم الإجابة.", "Guided mode — leads you to solve it yourself.", "Rehberli mod — çözümü kendiniz bulun.", "引导模式——带你自己解出。", "मार्गदर्शित मोड — आप स्वयं हल करें।", "Modo guiado — te lleva a resolverlo tú mismo.", "Mode guidé — vous résolvez vous-même.", "رہنمائی موڈ — آپ خود حل کریں۔"),
  "learn.workedNote": S("حلّ كامل مع إفصاح عن استخدام الذكاء الاصطناعي.", "Full solution with AI-use disclosure.", "Yapay zeka kullanımı beyanıyla tam çözüm.", "完整解答并声明使用了AI。", "AI उपयोग प्रकटीकरण के साथ पूर्ण हल।", "Solución completa con divulgación de uso de IA.", "Solution complète avec divulgation de l'usage de l'IA.", "AI استعمال کے اعلان کے ساتھ مکمل حل۔"),
  "learn.sourceCache": S("نتيجة متّسقة (مخزّنة)", "Consistent (cached)", "Tutarlı (önbellek)", "一致（缓存）", "सुसंगत (कैश्ड)", "Consistente (caché)", "Cohérent (cache)", "مستقل (کیشڈ)"),
  "learn.sourceScaffold": S("هيكل مؤقت — هيّئ مزوّد ذكاء اصطناعي", "Scaffold — configure an AI provider", "Taslak — bir yapay zeka sağlayıcısı ayarlayın", "占位——请配置AI服务", "ढाँचा — AI प्रदाता कॉन्फ़िगर करें", "Estructura — configura un proveedor de IA", "Ébauche — configurez un fournisseur d'IA", "خاکہ — AI فراہم کنندہ ترتیب دیں"),
  "learn.error": S("تعذّر إكمال الطلب", "Request failed", "İstek başarısız", "请求失败", "अनुरोध विफल", "Solicitud fallida", "Échec de la requête", "درخواست ناکام"),
  "learn.empty": S("اكتب موضوعًا أو مسألة للبدء", "Enter a topic or problem to start", "Başlamak için bir konu veya problem girin", "输入主题或问题开始", "शुरू करने के लिए विषय या समस्या दर्ज करें", "Escribe un tema o problema", "Saisissez un sujet ou un problème", "شروع کرنے کے لیے موضوع یا مسئلہ درج کریں"),
  "nav.learn": S("التعلّم", "Learn", "Öğren", "学习", "सीखें", "Aprender", "Apprendre", "سیکھیں"),
  // القواميس المُولّدة لكل صفحة تُدمج من ملف الرسائل الخارجي (تعريب تدريجي للواجهة).
  ...MESSAGES,
};

interface I18nCtx {
  locale: LocaleCode;
  meta: LocaleMeta;
  setLocale: (code: LocaleCode) => void;
  t: (key: keyof typeof DICT | string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);
const STORAGE_KEY = "academicos.locale.v1";

function initialLocale(): LocaleCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as LocaleCode | null;
    if (saved && LOCALES.some((l) => l.code === saved)) return saved;
    const candidates = Array.isArray(navigator.languages) && navigator.languages.length ? navigator.languages : [navigator.language];
    for (const candidate of candidates) {
      const normalized = String(candidate || "").toLowerCase();
      const exact = LOCALES.find((l) => normalized === l.code || normalized.startsWith(`${l.code}-`));
      if (exact) return exact.code;
      if (normalized.startsWith("zh")) return "zh";
      if (normalized.startsWith("ur")) return "ur";
    }
  } catch {}
  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(initialLocale);
  const meta = useMemo(() => localeMeta(locale), [locale]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("lang", locale);
    root.setAttribute("dir", meta.dir);
    try { localStorage.setItem(STORAGE_KEY, locale); } catch {}
  }, [locale, meta.dir]);

  const setLocale = useCallback((code: LocaleCode) => setLocaleState(code), []);
  const t = useCallback(
    (key: string) => {
      const entry = DICT[key];
      return entry ? entry[locale] || entry.en || key : key;
    },
    [locale],
  );

  return <Ctx.Provider value={{ locale, meta, setLocale, t }}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

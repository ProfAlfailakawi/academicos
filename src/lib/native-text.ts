import { isAppleNativeShell } from "./platform";

/**
 * Inside the iOS app there is no "browser": strings that mention one get
 * neutral wording. The website keeps the original strings untouched.
 */
const NATIVE_TEXT: Record<string, { ar: string; en: string }> = {
  "upload.errClipboard": { ar: "لم يسمح الجهاز بقراءة الحافظة. استخدم اللصق داخل الحقل.", en: "This device blocked clipboard access. Paste directly into the field." },
  "upload.errDictationUnsupported": { ar: "الإملاء الصوتي غير مدعوم على هذا الجهاز.", en: "Voice dictation is not supported on this device." },
  "upload.clipboardDenied": { ar: "لم يسمح الجهاز بقراءة الحافظة. استخدم اللصق داخل الحقل.", en: "This device blocked clipboard access. Paste directly into the field." },
  "upload.dictationUnsupported": { ar: "الإملاء الصوتي غير مدعوم على هذا الجهاز.", en: "Voice dictation is not supported on this device." },
  "mission.voiceUnsupported": { ar: "هذا الجهاز لا يدعم الإملاء الصوتي. اكتب أو ارفع الملف مباشرة.", en: "This device does not support voice dictation. Type or upload instead." },
  "viva.voiceUnsupported": { ar: "هذا الجهاز لا يدعم الإملاء الصوتي. يمكنك الكتابة.", en: "This device does not support voice dictation. You can type your answer." },
};

export function nativeTextOverride(key: string, locale: string): string | undefined {
  if (!isAppleNativeShell()) return undefined;
  const entry = NATIVE_TEXT[key];
  if (!entry) return undefined;
  return locale === "ar" ? entry.ar : locale === "en" ? entry.en : undefined;
}

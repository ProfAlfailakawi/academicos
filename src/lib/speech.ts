// Web Speech API helpers for dictation (viva answers).

import type { LocaleCode } from "./i18n";

/**
 * Recognition language candidates, most specific first. Arabic prefers the
 * Kuwaiti variant (ar-KW) and falls back to other widely supported Arabic
 * tags before the bare language code.
 */
export function speechRecognitionLangs(locale: LocaleCode, speechTag: string): string[] {
  const chain =
    locale === "ar"
      ? ["ar-KW", "ar-SA", "ar-AE", "ar-EG", "ar"]
      : locale === "ur"
        ? [speechTag, "ur-IN", "ur"]
        : [speechTag, speechTag.split("-")[0]];
  return [...new Set(chain.filter(Boolean))];
}

export function speechRecognitionSupported() {
  return typeof window !== "undefined" && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export interface DictationHandlers {
  onFinal: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (code: string) => void;
  onEnd?: () => void;
  onLanguage?: (lang: string) => void;
}

/**
 * Start dictation, walking the language chain when the engine reports the
 * language as unsupported. Returns a stop() function.
 */
export function startDictation(langs: string[], handlers: DictationHandlers): () => void {
  const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Recognition) {
    handlers.onError?.("unsupported");
    return () => undefined;
  }
  let index = 0;
  let current: any = null;
  let stopped = false;

  const begin = () => {
    const recognition = new Recognition();
    current = recognition;
    recognition.lang = langs[index];
    recognition.continuous = true;
    recognition.interimResults = true;
    handlers.onLanguage?.(langs[index]);
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript || "";
        if (result.isFinal) handlers.onFinal(text.trim());
        else interim += text;
      }
      handlers.onInterim?.(interim.trim());
    };
    recognition.onerror = (event: any) => {
      const code = String(event?.error || "error");
      if ((code === "language-not-supported" || code === "bad-grammar") && index < langs.length - 1 && !stopped) {
        index += 1;
        try { recognition.onend = null; recognition.abort?.(); } catch { /* ignore */ }
        begin();
        return;
      }
      handlers.onError?.(code);
    };
    recognition.onend = () => {
      handlers.onInterim?.("");
      handlers.onEnd?.();
    };
    recognition.start();
  };

  begin();
  return () => {
    stopped = true;
    try { current?.stop?.(); } catch { /* ignore */ }
  };
}

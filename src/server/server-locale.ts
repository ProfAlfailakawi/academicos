// Server-side locale resolution for generated academic content.
//
// The product ships eight launch locales, but several server engines used to emit
// hard-coded Arabic strings (section plans, viva questions, submission audit checks,
// Mission Control copy). That leaked Arabic into English/Turkish/Chinese/Hindi/
// Spanish/French/Urdu workspaces. Every generated user-facing string now goes
// through this module so the output follows the learner's language.
//
// Pure and dependency-free: no I/O, no Date, no randomness.

export type ServerLocale = 'ar' | 'en' | 'tr' | 'zh' | 'hi' | 'es' | 'fr' | 'ur';

export const SERVER_LOCALES: readonly ServerLocale[] = ['ar', 'en', 'tr', 'zh', 'hi', 'es', 'fr', 'ur'] as const;

export const DEFAULT_SERVER_LOCALE: ServerLocale = 'en';

export type LocalizedText = Record<ServerLocale, string>;

/** Declare one string in all eight launch locales (same argument order as the export/i18n helpers). */
export const L = (
  ar: string, en: string, tr: string, zh: string, hi: string, es: string, fr: string, ur: string,
): LocalizedText => ({ ar, en, tr, zh, hi, es, fr, ur });

/** Language names the AI layer and older records may store instead of an ISO code. */
const LANGUAGE_NAMES: Record<string, ServerLocale> = {
  arabic: 'ar', 'العربية': 'ar', عربي: 'ar', عربية: 'ar',
  english: 'en', انجليزي: 'en', إنجليزي: 'en', الانجليزية: 'en', الإنجليزية: 'en',
  turkish: 'tr', 'türkçe': 'tr', turkce: 'tr', تركي: 'tr',
  chinese: 'zh', mandarin: 'zh', '中文': 'zh', '简体中文': 'zh', صيني: 'zh',
  hindi: 'hi', 'हिन्दी': 'hi', 'हिंदी': 'hi', هندي: 'hi',
  spanish: 'es', 'español': 'es', espanol: 'es', castellano: 'es', اسباني: 'es', إسباني: 'es',
  french: 'fr', 'français': 'fr', francais: 'fr', فرنسي: 'fr',
  urdu: 'ur', 'اردو': 'ur', 'أردو': 'ur',
};

/** Accept an ISO code, a BCP-47 tag, or a language name. Returns undefined when unrecognised. */
export function normalizeServerLocale(value?: string | null): ServerLocale | undefined {
  const raw = String(value || '').trim();
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  const named = LANGUAGE_NAMES[lower] || LANGUAGE_NAMES[raw];
  if (named) return named;
  const base = lower.split(/[-_]/)[0];
  if ((SERVER_LOCALES as readonly string[]).includes(base)) return base as ServerLocale;
  // Common macro-language tags that map onto a launch locale.
  if (base === 'cmn' || base === 'yue' || base === 'zho') return 'zh';
  if (base === 'ara' || base === 'arb') return 'ar';
  if (base === 'eng') return 'en';
  if (base === 'tur') return 'tr';
  if (base === 'hin') return 'hi';
  if (base === 'spa') return 'es';
  if (base === 'fra' || base === 'fre') return 'fr';
  if (base === 'urd') return 'ur';
  return undefined;
}

/** Parse an HTTP Accept-Language header, honouring q-weights. */
export function parseAcceptLanguage(header?: string | null): ServerLocale | undefined {
  const raw = String(header || '').trim();
  if (!raw) return undefined;
  const entries = raw
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params
        .map((param) => param.trim())
        .filter((param) => param.startsWith('q='))
        .map((param) => Number(param.slice(2)))
        .find((value) => Number.isFinite(value));
      return { tag: tag.trim(), q: q === undefined ? 1 : Math.max(0, Math.min(1, q)) };
    })
    .filter((entry) => entry.tag && entry.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const entry of entries) {
    const locale = normalizeServerLocale(entry.tag);
    if (locale) return locale;
  }
  return undefined;
}

/**
 * Resolve the first recognisable locale from an ordered candidate list.
 * Pass the most specific signal first (explicit request field, then the project
 * language, then the profile language, then the Accept-Language header).
 */
export function resolveServerLocale(...candidates: Array<string | null | undefined>): ServerLocale {
  for (const candidate of candidates) {
    const locale = normalizeServerLocale(candidate);
    if (locale) return locale;
  }
  return DEFAULT_SERVER_LOCALE;
}

/** Read one localized string, falling back to English then Arabic so nothing renders empty. */
export function tx(text: LocalizedText, locale: ServerLocale): string {
  return text[locale] || text.en || text.ar;
}

/** Read one localized string and substitute {placeholders}. */
export function txf(
  text: LocalizedText,
  locale: ServerLocale,
  vars: Record<string, string | number>,
): string {
  return Object.entries(vars).reduce(
    (value, [key, replacement]) => value.split(`{${key}}`).join(String(replacement)),
    tx(text, locale),
  );
}

/** List separator that matches each script's convention. */
export function listSeparator(locale: ServerLocale): string {
  return locale === 'ar' || locale === 'ur' ? '، ' : locale === 'zh' ? '、' : ', ';
}

export function joinList(items: string[], locale: ServerLocale): string {
  return items.filter(Boolean).join(listSeparator(locale));
}

/** Text direction, for generated documents and exports. */
export function localeDirection(locale: ServerLocale): 'rtl' | 'ltr' {
  return locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr';
}

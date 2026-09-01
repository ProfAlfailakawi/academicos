import React from "react";
import { Languages } from "lucide-react";
import { LOCALES, type LocaleCode, useI18n } from "../lib/i18n";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className={`language-switcher ${compact ? "language-switcher--compact" : ""}`}>
      <span className="sr-only">{t("app.language")}</span>
      <Languages size={14} aria-hidden="true" />
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as LocaleCode)}
        aria-label={t("app.language")}
        className="bg-transparent outline-none text-xs font-semibold cursor-pointer min-h-9"
      >
        {LOCALES.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
      </select>
    </label>
  );
}

import React from "react";
import { Link } from "react-router";
import { Logo } from "./brand/Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useI18n } from "../lib/i18n";

/** One header for every public page (status, verifier, shared evidence, info pages). */
export function PublicHeader({ aside, className = "" }: { aside?: React.ReactNode; className?: string }) {
  const { t } = useI18n();
  return (
    <header className={`public-bar ${className}`.trim()}>
      <Link to="/" className="focus-ring rounded-xl min-h-11 inline-flex items-center" aria-label={`AcademicOS — ${t("pub.header.back")}`}>
        <Logo markSize={36} />
      </Link>
      <div className="public-bar__aside">
        {aside}
        <LanguageSwitcher compact />
      </div>
    </header>
  );
}

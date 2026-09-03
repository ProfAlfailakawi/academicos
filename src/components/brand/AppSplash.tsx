import React from "react";
import { LogoMark, Wordmark } from "./Logo";
import { useI18n } from "../../lib/i18n";

/**
 * In-app splash. Visually identical to the pre-boot splash painted by
 * index.html, so the handover from "HTML is ready" to "React is ready"
 * has no visible seam.
 */
export function AppSplash({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="acos-splash acos-splash--react" role="status" aria-live="polite">
      <div className="acos-splash__stage">
        <div className="acos-splash__halo" aria-hidden="true" />
        <LogoMark variant="seal" size={92} animated className="acos-splash__mark" />
        <Wordmark className="acos-splash__word" />
        <p className="acos-splash__tagline">{t("brand.tagline")}</p>
        <div className="acos-splash__rail" aria-hidden="true">
          <span />
        </div>
        <p className="acos-splash__status">{label ?? t("app.opening")}</p>
      </div>
    </div>
  );
}

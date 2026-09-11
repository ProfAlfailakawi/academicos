import React from "react";
import { useI18n } from "../../lib/i18n";
import { LogoMark, Wordmark } from "./Logo";
import { HERO_ELEMENTS } from "./HeroEntrance";

/**
 * «المكتب المرتّب» — the tidy desk. A full-viewport overture for the public
 * page: the six academic cards fly across the screen like loose papers,
 * align into one geometric centered composition under the AcademicOS
 * identity, hold a beat, then the veil slides up to reveal the page.
 *
 * Plays once per browser session (sessionStorage). Never mounts when the
 * visitor prefers reduced motion — via the media query or the app's
 * `.a11y-reduced-motion` class. transform + opacity only, ~2.5s.
 */
const SESSION_KEY = "acos.overture.v1";
const HOLD_END_MS = 1900;
const EXIT_MS = 600;

export function useOverture(): [boolean, () => void] {
  const [active, setActive] = React.useState(() => {
    if (typeof window === "undefined") return false;
    try {
      if (window.sessionStorage.getItem(SESSION_KEY)) return false;
    } catch {
      return false;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
    if (document.documentElement.classList.contains("a11y-reduced-motion")) return false;
    try {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* storage refused — still play this once */
    }
    return true;
  });
  const dismiss = React.useCallback(() => setActive(false), []);
  return [active, dismiss];
}

interface OvertureProps {
  onDone: () => void;
}

export function Overture({ onDone }: OvertureProps) {
  const { t } = useI18n();
  const [leaving, setLeaving] = React.useState(false);

  React.useEffect(() => {
    const hold = window.setTimeout(() => setLeaving(true), HOLD_END_MS);
    return () => window.clearTimeout(hold);
  }, []);

  React.useEffect(() => {
    if (!leaving) return;
    const end = window.setTimeout(onDone, EXIT_MS);
    return () => window.clearTimeout(end);
  }, [leaving, onDone]);

  return (
    <div className={`acos-overture${leaving ? " is-leaving" : ""}`} role="presentation">
      <div className="acos-overture__stage" aria-hidden="true">
        <div className="acos-overture__identity">
          <LogoMark size={52} />
          <Wordmark size={30} />
        </div>
        <div className="acos-overture__deck">
          {HERO_ELEMENTS.map(({ key, icon: Icon, pos }) => (
            <span key={key} className={`hero-el acos-overture__card acos-overture__card--${pos}`}>
              <Icon size={14} />
              {t(key)}
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="acos-overture__skip focus-ring"
        onClick={() => setLeaving(true)}
      >
        {t("onboard.skip")}
      </button>
    </div>
  );
}

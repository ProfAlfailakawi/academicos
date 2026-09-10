import React from "react";
import {
  BookMarked, FileCheck2, FilePenLine, Highlighter, ListChecks, Quote,
} from "lucide-react";
import { useI18n } from "../../lib/i18n";

/**
 * The public hero's cinematic entrance: six scattered academic elements
 * (Assignment, Rubric, Source, Citation, Highlight, Evidence) drift in,
 * rearrange, and settle around the workspace illustration as one composition.
 * Pure CSS choreography — transform + opacity only, ~2.6s, staggered.
 *
 * Plays once per entry to the public page (a module flag guards SPA
 * re-mounts; a fresh page load plays again). Skipped entirely — final
 * state shown immediately — when the visitor prefers reduced motion.
 */
let hasPlayedThisEntry = false;

export function useHeroEntrance(): boolean {
  const [play] = React.useState(() => {
    if (hasPlayedThisEntry) return false;
    if (typeof window !== "undefined") {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
      if (document.documentElement.classList.contains("a11y-reduced-motion")) return false;
    }
    hasPlayedThisEntry = true;
    return true;
  });
  return play;
}

const ELEMENTS = [
  { key: "landing.elAssignment", icon: FilePenLine, pos: "assignment" },
  { key: "landing.elRubric", icon: ListChecks, pos: "rubric" },
  { key: "landing.elSource", icon: BookMarked, pos: "source" },
  { key: "landing.elCitation", icon: Quote, pos: "citation" },
  { key: "landing.elHighlight", icon: Highlighter, pos: "highlight" },
  { key: "landing.elEvidence", icon: FileCheck2, pos: "evidence" },
] as const;

export function HeroConstellation() {
  const { t } = useI18n();
  return (
    <div className="hero-constellation" aria-hidden="true">
      {ELEMENTS.map(({ key, icon: Icon, pos }) => (
        <span key={key} className={`hero-el hero-el--${pos}`}>
          <Icon size={14} />
          {t(key)}
        </span>
      ))}
    </div>
  );
}

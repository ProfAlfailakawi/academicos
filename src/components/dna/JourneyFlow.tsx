import * as React from "react";
import { useJourneyReveal } from "./useJourneyReveal";

export interface JourneyFlowItem {
  key: string;
  icon: React.ElementType;
  title: string;
  text?: string;
}

const STEP_MS = 700;

/**
 * Instructional walkthrough cards (landing «كيف تعمل», Learn Studio). Content is
 * static, so every card is "really" lit: the intro lights them one after another
 * when the row scrolls into view, fills the connector in the reading direction,
 * plays once, and settles with all cards lit. Reduced motion / no JS: final state.
 */
export function JourneyFlow({ items, ariaLabel, className = "", playKey }: { items: JourneyFlowItem[]; ariaLabel?: string; className?: string; playKey?: string }) {
  const { ref, lit } = useJourneyReveal<HTMLDivElement>({ target: items.length, count: items.length, stepMs: STEP_MS, threshold: 0.4, playKey });
  const progress = lit === null ? 1 : Math.max(0, (lit - 1) / Math.max(1, items.length - 1));
  return (
    <div
      ref={ref}
      aria-label={ariaLabel}
      className={`understanding-flow understanding-flow--play${className ? ` ${className}` : ""}`}
      data-reveal={lit ?? "done"}
      style={{ "--flow-p": progress, "--flow-ms": `${STEP_MS}ms` } as React.CSSProperties}
    >
      <span className="understanding-flow__track" aria-hidden="true"><i /></span>
      {items.map(({ key, icon: Icon, title, text }, index) => (
        <div
          key={key}
          className="understanding-step"
          style={{ "--i": index } as React.CSSProperties}
          data-lit={lit === null || index < lit ? "" : undefined}
          data-just={lit !== null && index === lit - 1 ? "" : undefined}
        >
          <span className="understanding-step__number">{index + 1}</span>
          <Icon size={23} />
          <strong>{title}</strong>
          {text && <small>{text}</small>}
        </div>
      ))}
    </div>
  );
}

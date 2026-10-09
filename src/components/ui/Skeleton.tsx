import React from "react";

/**
 * Shared loading placeholder. It is shaped like the real thing (card, row,
 * ring, text lines) and shimmers softly; under reduced motion it is a still
 * tinted block. Purely presentational: the surrounding region owns role/aria.
 */
type Shape = "card" | "panel" | "row" | "ring" | "lines" | "block";

export function Skeleton({
  shape = "block",
  className = "",
  lines = 3,
  style,
}: {
  shape?: Shape;
  className?: string;
  lines?: number;
  style?: React.CSSProperties;
}) {
  if (shape === "lines") {
    return (
      <div aria-hidden="true" className={`skel-lines ${className}`.trim()} style={style}>
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className="skel skel--line" style={{ width: i === lines - 1 ? "58%" : "100%" }} />
        ))}
      </div>
    );
  }
  if (shape === "card" || shape === "panel") {
    return (
      <div aria-hidden="true" className={`skel-card ${shape === "panel" ? "skel-card--panel" : ""} ${className}`.trim()} style={style}>
        <span className="skel skel--tile" />
        <span className="skel-card__body">
          <span className="skel skel--line" style={{ width: "46%" }} />
          <span className="skel skel--line" />
          <span className="skel skel--line" style={{ width: "72%" }} />
        </span>
      </div>
    );
  }
  if (shape === "row") {
    return (
      <div aria-hidden="true" className={`skel-row ${className}`.trim()} style={style}>
        <span className="skel skel--dot" />
        <span className="skel skel--line" style={{ flex: 1 }} />
        <span className="skel skel--chip" />
      </div>
    );
  }
  if (shape === "ring") {
    return <span aria-hidden="true" className={`skel skel--ring ${className}`.trim()} style={style} />;
  }
  return <span aria-hidden="true" className={`skel skel--block ${className}`.trim()} style={style} />;
}

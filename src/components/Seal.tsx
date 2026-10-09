import React from "react";

/** Seal-style ring around an icon (presentational; the caller supplies the meaning and label). */
export function Seal({ tone = "ok", small = false, children }: { tone?: "ok" | "warn" | "bad" | "brand"; small?: boolean; children: React.ReactNode }) {
  const teeth = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return <line key={i} x1={50 + Math.cos(a) * 44} y1={50 + Math.sin(a) * 44} x2={50 + Math.cos(a) * 48.5} y2={50 + Math.sin(a) * 48.5} />;
  });
  return (
    <span className={`seal ${small ? "seal--sm" : ""} ${tone === "brand" ? "" : `seal--${tone}`}`.trim()} aria-hidden="true">
      <svg className="seal__ring" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeLinecap="round">
        <circle cx="50" cy="50" r="41" strokeWidth="2" opacity=".55" />
        <circle cx="50" cy="50" r="36" strokeWidth="1" strokeDasharray="2 4" opacity=".45" />
        <g strokeWidth="2" opacity=".7">{teeth}</g>
      </svg>
      <span className="seal__core">{children}</span>
    </span>
  );
}

import React from "react";

/**
 * The hero illustration, drawn in code so it belongs to the design system:
 * the journey from a raw assignment (left) through the AcademicOS workspace
 * (center) to a sealed evidence capsule (right). Uses brand tokens, so it is
 * correct in both themes with no bitmap to swap.
 */
export function HeroJourney({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 720 560"
      className={`hero-journey ${className}`.trim()}
      role="img"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="hj-field" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-soft)" />
          <stop offset="100%" stopColor="var(--panel)" />
        </linearGradient>
        <linearGradient id="hj-seal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand)" />
          <stop offset="100%" stopColor="var(--brand-2)" />
        </linearGradient>
        <filter id="hj-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="14" stdDeviation="20" floodColor="var(--brand-2)" floodOpacity="0.12" />
        </filter>
      </defs>

      {/* soft field */}
      <rect x="0" y="0" width="720" height="560" rx="34" fill="url(#hj-field)" />
      {/* paper grid */}
      <g stroke="var(--line)" strokeWidth="1" opacity="0.4">
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`v${i}`} x1={40 + i * 80} y1="40" x2={40 + i * 80} y2="520" />
        ))}
        {Array.from({ length: 7 }).map((_, i) => (
          <line key={`h${i}`} x1="40" y1={40 + i * 80} x2="680" y2={40 + i * 80} />
        ))}
      </g>

      {/* the dashed journey path */}
      <path
        className="hj-path"
        d="M150 300 C 240 300, 250 220, 340 220 S 470 300, 560 210"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.4"
        strokeDasharray="6 8"
        strokeLinecap="round"
        opacity="0.75"
      />

      {/* 1 — the raw assignment (left) */}
      <g filter="url(#hj-shadow)">
        <rect x="70" y="212" width="150" height="190" rx="16" fill="var(--panel)" stroke="var(--line)" strokeWidth="1.5" transform="rotate(-6 145 307)" />
        <g transform="rotate(-6 145 307)" stroke="var(--muted)" strokeWidth="6" strokeLinecap="round" opacity="0.55">
          <line x1="98" y1="250" x2="192" y2="250" />
          <line x1="98" y1="274" x2="192" y2="274" />
          <line x1="98" y1="298" x2="168" y2="298" />
          <line x1="98" y1="330" x2="192" y2="330" />
          <line x1="98" y1="354" x2="150" y2="354" />
        </g>
      </g>

      {/* 2 — the AcademicOS workspace (center): the ascent seal */}
      <g filter="url(#hj-shadow)">
        <rect x="286" y="150" width="150" height="150" rx="34" fill="url(#hj-seal)" />
        <g fill="none" stroke="var(--panel)" strokeLinecap="round" strokeLinejoin="round">
          <path d="M330 258 L361 190 L392 258" strokeWidth="11" />
          <path d="M344 236 H378" strokeWidth="9" />
        </g>
        <circle cx="404" cy="176" r="9" fill="var(--accent)" />
      </g>

      {/* three verified facets orbiting the workspace */}
      {[
        { x: 300, y: 340, d: "M-6 0 L-1 6 L7 -6" },
        { x: 361, y: 372, d: "M-6 0 L-1 6 L7 -6" },
        { x: 422, y: 340, d: "M-6 0 L-1 6 L7 -6" },
      ].map((f, i) => (
        <g key={i} transform={`translate(${f.x} ${f.y})`}>
          <circle r="17" fill="var(--panel)" stroke="var(--brand)" strokeWidth="1.5" />
          <path d={f.d} fill="none" stroke="var(--brand)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}

      {/* 3 — the sealed evidence capsule (right) */}
      <g filter="url(#hj-shadow)">
        <rect x="512" y="150" width="150" height="190" rx="16" fill="var(--panel)" stroke="var(--line)" strokeWidth="1.5" transform="rotate(5 587 245)" />
        <g transform="rotate(5 587 245)">
          <g stroke="var(--muted)" strokeWidth="5" strokeLinecap="round" opacity="0.4">
            <line x1="540" y1="188" x2="634" y2="188" />
            <line x1="540" y1="208" x2="634" y2="208" />
            <line x1="540" y1="228" x2="600" y2="228" />
          </g>
          {/* the gold seal stamp */}
          <circle cx="587" cy="288" r="30" fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="3 4" />
          <circle cx="587" cy="288" r="21" fill="color-mix(in srgb, var(--accent) 16%, var(--panel))" />
          <path d="M576 288 L584 296 L599 280" fill="none" stroke="var(--accent)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
    </svg>
  );
}

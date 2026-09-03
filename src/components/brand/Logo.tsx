import React from "react";

/**
 * AcademicOS brand marks — "The Ascent Seal".
 *
 * One idea, drawn two ways so the system stays coherent from a 16px favicon
 * to a full-screen splash:
 *   • the ascent (A)   — the climb from assignment to understanding
 *   • the orbit + seal — the operating system that keeps circling, and the
 *                        gold evidence seal it produces at the end of the loop
 *
 * `seal`  → open orbit, for large canvases (splash, login, hero)
 * `tile`  → contained superellipse, for small canvases (sidebar, dock, favicon)
 */

export type LogoVariant = "seal" | "tile";

interface MarkProps {
  variant?: LogoVariant;
  size?: number;
  animated?: boolean;
  className?: string;
  title?: string;
  /** Renders the mark in currentColor instead of brand tokens (for dark surfaces). */
  inverted?: boolean;
}

let uid = 0;
function useUid(prefix: string) {
  return React.useMemo(() => `${prefix}-${(uid += 1)}`, [prefix]);
}

export function LogoMark({
  variant = "seal",
  size = 40,
  animated = false,
  className = "",
  title,
  inverted = false,
}: MarkProps) {
  const id = useUid("acos");
  const shared = {
    width: size,
    height: size,
    viewBox: "0 0 48 48",
    xmlns: "http://www.w3.org/2000/svg",
    role: title ? ("img" as const) : ("presentation" as const),
    "aria-hidden": title ? undefined : true,
    focusable: "false" as const,
    className: `acos-mark ${animated ? "is-animated" : ""} ${className}`.trim(),
  };

  if (variant === "tile") {
    return (
      <svg {...shared}>
        {title ? <title>{title}</title> : null}
        <defs>
          <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand)" />
            <stop offset="100%" stopColor="var(--brand-2)" />
          </linearGradient>
        </defs>
        <rect
          width="48"
          height="48"
          rx="13.4"
          fill={inverted ? "currentColor" : `url(#${id}-tile)`}
        />
        <g
          className="acos-mark__ascent"
          fill="none"
          stroke="var(--panel)"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.6 34.6 L24 13.4 L33.4 34.6" strokeWidth="3.7" pathLength={1} />
          <path d="M17.7 27.6 H30.3" strokeWidth="3.1" pathLength={1} />
        </g>
        <circle
          className="acos-mark__seal"
          cx="37.4"
          cy="11.6"
          r="3.2"
          fill="var(--accent)"
        />
      </svg>
    );
  }

  return (
    <svg {...shared}>
      {title ? <title>{title}</title> : null}
      {/* the operating system: an orbit that never fully closes — learning keeps going */}
      <path
        className="acos-mark__orbit"
        d="M43.92 22.26 A20 20 0 1 1 25.74 4.08"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.3"
        strokeLinecap="round"
        opacity={0.9}
        pathLength={1}
      />
      <g
        className="acos-mark__ascent"
        fill="none"
        stroke={inverted ? "currentColor" : "var(--brand)"}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12.2 35.6 L24 12.2 L35.8 35.6" strokeWidth="4.2" pathLength={1} />
        <path d="M16.9 26.2 H31.1" strokeWidth="3.4" pathLength={1} />
      </g>
      {/* the evidence seal, stamped where the orbit opens */}
      <circle
        className="acos-mark__seal"
        cx="38.14"
        cy="9.86"
        r="3"
        fill="var(--accent)"
      />
    </svg>
  );
}

interface WordmarkProps {
  className?: string;
  /** Font size in px for the wordmark. */
  size?: number;
}

export function Wordmark({ className = "", size }: WordmarkProps) {
  return (
    <span
      className={`acos-wordmark ${className}`.trim()}
      style={size ? { fontSize: `${size}px` } : undefined}
      dir="ltr"
    >
      Academic<span className="acos-wordmark__os">OS</span>
    </span>
  );
}

interface LockupProps extends MarkProps {
  /** Optional line under the wordmark (institution name, tagline…). */
  caption?: React.ReactNode;
  /** Overrides the wordmark (white-label institutions). */
  label?: React.ReactNode;
  wordmarkSize?: number;
  markSize?: number;
  lockupClassName?: string;
}

export function Logo({
  caption,
  label,
  wordmarkSize,
  markSize = 40,
  lockupClassName = "",
  ...mark
}: LockupProps) {
  return (
    <span className={`acos-lockup ${lockupClassName}`.trim()}>
      <LogoMark size={markSize} {...mark} />
      <span className="acos-lockup__text">
        {label ?? <Wordmark size={wordmarkSize} />}
        {caption ? <span className="acos-lockup__caption">{caption}</span> : null}
      </span>
    </span>
  );
}

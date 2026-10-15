import React from "react";
import { useDrawIn } from "./dna/useDrawIn";
import "./dna/draw.css";

/* Small SVG/HTML infographics that draw only data a screen already shows.
   Colours come from the existing tone tokens, so light and dark both work. */

export type Tone = "brand" | "success" | "warning" | "danger" | "muted";
const TONE_VAR: Record<Tone, string> = {
  brand: "var(--brand)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  muted: "var(--line-strong)",
};
export const toneColor = (tone: Tone) => TONE_VAR[tone];

export function SeverityDot({ tone, size = 8 }: { tone: Tone; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: TONE_VAR[tone] }}
    />
  );
}

/** Donut made of coloured arcs, one per segment; children sit in the middle. */
export function SegmentRing({
  segments,
  size = 64,
  stroke = 8,
  label,
  children,
  playKey,
}: {
  segments: Array<{ value: number; tone: Tone }>;
  size?: number;
  stroke?: number;
  label?: string;
  children?: React.ReactNode;
  /** Opt-in: draw the arcs once per key (shared kit rule, see dna/draw.css). */
  playKey?: string;
}) {
  const drawn = useDrawIn<HTMLDivElement>({ playKey, enabled: Boolean(playKey) });
  let drawIndex = 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  let offset = 0;
  return (
    <div
      ref={drawn.ref}
      data-draw={drawn.draw}
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        {total > 0 &&
          segments.map((s, i) => {
            if (s.value <= 0) return null;
            const len = (s.value / total) * c;
            const gap = segments.filter((x) => x.value > 0).length > 1 ? Math.min(3, len * 0.3) : 0;
            const el = (
              <circle
                key={i}
                className={s.tone === "muted" ? undefined : "dna-sring"}
                style={s.tone === "muted" ? undefined : ({ "--i": drawIndex++ } as React.CSSProperties)}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={TONE_VAR[s.tone]}
                strokeWidth={stroke}
                strokeLinecap="butt"
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">{children}</div>
    </div>
  );
}

/** Single-value progress ring. */
export function ProgressRing({
  pct,
  size = 72,
  stroke = 8,
  tone = "brand",
  label,
  children,
  playKey,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  tone?: Tone;
  label?: string;
  children?: React.ReactNode;
  playKey?: string;
}) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <SegmentRing
      size={size}
      stroke={stroke}
      label={label}
      playKey={playKey}
      segments={[
        { value: p, tone },
        { value: 100 - p, tone: "muted" },
      ]}
    >
      {children}
    </SegmentRing>
  );
}

/** Tapering funnel: each stage is a trapezoid joining its width to the next. */
export function TaperFunnel({ stages, playKey }: { stages: Array<{ label: string; pct: number }>; playKey?: string }) {
  const drawn = useDrawIn<HTMLDivElement>({ playKey, enabled: Boolean(playKey) });
  const rowH = 46;
  const n = stages.length;
  const w = stages.map((s) => Math.max(2, Math.min(100, s.pct)));
  return (
    <div ref={drawn.ref} data-draw={drawn.draw} className="flex items-stretch gap-3" role="list">
      <div className="flex flex-col shrink-0 min-w-[7.5rem] max-w-[11rem]">
        {stages.map((s, i) => (
          <div key={i} role="listitem" className="dna-seq flex flex-col justify-center" style={{ height: rowH, "--i": i } as React.CSSProperties}>
            <span className="text-meta muted leading-4">{s.label}</span>
            <strong className="text-sm mono-number leading-5">{s.pct}%</strong>
          </div>
        ))}
      </div>
      <svg
        className="flex-1 min-w-0"
        height={rowH * n}
        viewBox={`0 0 200 ${rowH * n}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {stages.map((s, i) => {
          const top = w[i];
          const bottom = i < n - 1 ? w[i + 1] : Math.max(1, top * 0.82);
          const y0 = i * rowH + 3;
          const y1 = (i + 1) * rowH - 3;
          const pts = [
            [100 - top, y0],
            [100 + top, y0],
            [100 + bottom, y1],
            [100 - bottom, y1],
          ]
            .map((p) => p.join(","))
            .join(" ");
          return (
            <polygon
              key={i}
              className="dna-seq"
              style={{ "--i": i } as React.CSSProperties}
              points={pts}
              fill="var(--brand)"
              fillOpacity={0.88 - i * 0.16}
              stroke="var(--panel)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
    </div>
  );
}

/** Half-circle gauge with three tone zones and a needle. */
export function ArcGauge({
  value,
  max,
  zones,
  label,
  children,
  playKey,
}: {
  value: number;
  max: number;
  zones: Array<{ to: number; tone: Tone }>;
  label?: string;
  children?: React.ReactNode;
  /** Opt-in: the needle sweeps from the empty end once per key. */
  playKey?: string;
}) {
  const drawn = useDrawIn<HTMLDivElement>({ playKey, enabled: Boolean(playKey) });
  const R = 70;
  const cx = 90;
  const cy = 86;
  const pt = (f: number, r = R) => {
    const a = Math.PI * (1 - f);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
  };
  let prev = 0;
  const arcs = zones.map((z, i) => {
    const a = pt(prev / max);
    const b = pt(Math.min(z.to, max) / max);
    const d = `M ${a[0]} ${a[1]} A ${R} ${R} 0 0 1 ${b[0]} ${b[1]}`;
    prev = Math.min(z.to, max);
    return <path key={i} d={d} fill="none" stroke={TONE_VAR[z.tone]} strokeWidth="12" strokeOpacity="0.85" />;
  });
  const f = Math.max(0, Math.min(1, value / max));
  const tip = pt(f, R - 22);
  const knob = pt(f, R);
  return (
    <div ref={drawn.ref} data-draw={drawn.draw} className="relative mx-auto w-full max-w-[220px]" role={label ? "img" : undefined} aria-label={label}>
      <svg viewBox="0 8 180 90" className="w-full" aria-hidden="true">
        {arcs}
        <g className="dna-needle" style={{ "--ox": `${cx}px`, "--oy": `${cy}px`, "--needle-deg": f * 180 } as React.CSSProperties}>
          <line x1={cx} y1={cy} x2={tip[0]} y2={tip[1]} stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="5" fill="var(--ink)" />
          <circle cx={knob[0]} cy={knob[1]} r="6.5" fill="var(--panel)" stroke="var(--ink)" strokeWidth="2.5" />
        </g>
      </svg>
      <div className="mt-1 text-center leading-tight">{children}</div>
    </div>
  );
}

/** Thin proportional bar (e.g. words per section against the longest one). */
export function MiniBar({ value, max, tone = "brand", playKey }: { value: number; max: number; tone?: Tone; playKey?: string }) {
  const drawn = useDrawIn<HTMLSpanElement>({ playKey, enabled: Boolean(playKey) });
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <span ref={drawn.ref} data-draw={drawn.draw} aria-hidden="true" className="block h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
      <span className="dna-fillx block h-full rounded-full" style={{ width: `${pct}%`, background: TONE_VAR[tone] }} />
    </span>
  );
}

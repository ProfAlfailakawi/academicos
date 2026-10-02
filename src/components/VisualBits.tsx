import React from "react";
import { toneColor, type Tone } from "./Infographics";

/* عناصر عرض صغيرة تعتمد على بيانات تعرضها الشاشة أصلًا؛ ألوانها من التوكنز. */

/** مقياس مستوى بنقاط متصلة (مثل مستوى سياسة الذكاء الاصطناعي). */
export function LevelMeter({ level, max, label }: { level: number; max: number; label?: string }) {
  const lv = Math.max(0, Math.min(max, level));
  return (
    <span role="img" aria-label={label ?? `${lv}/${max}`} className="inline-flex items-center gap-1" dir="ltr">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="block h-2 rounded-full"
          style={{
            width: 14,
            background: i < lv ? "var(--brand)" : "var(--line-strong)",
            opacity: i < lv ? 0.35 + (0.65 * (i + 1)) / Math.max(1, lv) : 1,
          }}
        />
      ))}
    </span>
  );
}

export interface StackedSegment {
  key: string;
  value: number;
  tone: Tone;
  label: string;
  text?: string;
}

/** شريط مكدّس: عرض كل جزء نسبة إلى مجموع القيم. */
export function StackedBar({ segments, ariaLabel, height = 22 }: { segments: StackedSegment[]; ariaLabel: string; height?: number }) {
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  if (total <= 0) return null;
  return (
    <div role="img" aria-label={ariaLabel} className="flex w-full gap-0.5 overflow-hidden rounded-full" style={{ height }}>
      {segments.map((s) => (
        <span
          key={s.key}
          title={s.label}
          className="flex min-w-0 items-center justify-center overflow-hidden text-[11px] font-semibold mono-number"
          style={{
            flex: `${Math.max(0, s.value)} 1 0`,
            background: `color-mix(in srgb, ${toneColor(s.tone)} 78%, var(--panel))`,
            color: s.tone === "muted" ? "var(--ink)" : "var(--panel)",
          }}
        >
          <span aria-hidden="true" className="truncate px-1">{s.text ?? ""}</span>
        </span>
      ))}
    </div>
  );
}

/** خط تقدّم بعقد: العقد حتى `index` (شاملة) ممتلئة. */
export function StepTrack({ steps, index, ariaLabel }: { steps: string[]; index: number; ariaLabel: string }) {
  return (
    <ol className="flex items-center" aria-label={ariaLabel}>
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 items-center last:flex-none" aria-current={i === index ? "step" : undefined}>
          <span
            title={s}
            className="grid h-3 w-3 shrink-0 place-items-center rounded-full border-2"
            style={{
              borderColor: i <= index ? "var(--brand)" : "var(--line-strong)",
              background: i < index ? "var(--brand)" : i === index ? "var(--panel)" : "transparent",
            }}
          >
            <span className="sr-only">{s}</span>
          </span>
          {i < steps.length - 1 && (
            <span aria-hidden="true" className="mx-1 h-0.5 flex-1 rounded" style={{ background: i < index ? "var(--brand)" : "var(--line)" }} />
          )}
        </li>
      ))}
    </ol>
  );
}

/** نص طويل يُعرض مقتطعًا ويُفتح كاملًا بالنقر؛ لا يغيّر المحتوى ولا يحذف منه شيئًا. */
export function FoldText({ text, limit = 110, className = "body-copy" }: { text: string; limit?: number; className?: string }) {
  if (!text || text.length <= limit) return <p className={className}>{text}</p>;
  const cut = text.slice(0, limit).replace(/\s+\S*$/, "");
  return (
    <details className="group">
      <summary className={`${className} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        <span className="group-open:hidden">{cut}…</span>
        <span className="hidden group-open:inline">{text}</span>
      </summary>
    </details>
  );
}

/** رادار مهارات: محاور = أسماء المهارات، القيمة = عدد أدلتها (بيانات الشاشة نفسها). */
export function SkillRadar({ skills, max = 8, ariaLabel }: { skills: Array<{ skill: string }>; max?: number; ariaLabel: string }) {
  const counts = new Map<string, number>();
  skills.forEach((s) => counts.set(s.skill, (counts.get(s.skill) || 0) + 1));
  const axes = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max);
  if (axes.length < 3) return null;
  const top = Math.max(...axes.map(([, n]) => n));
  const size = 340;
  const c = size / 2;
  const R = 80;
  const ang = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / axes.length;
  const pt = (i: number, f: number) => [c + Math.cos(ang(i)) * R * f, c + Math.sin(ang(i)) * R * f] as const;
  const ring = (f: number) => axes.map((_, i) => pt(i, f).map((v) => v.toFixed(1)).join(",")).join(" ");
  const shape = axes.map(([, n], i) => pt(i, Math.max(0.12, n / top)).map((v) => v.toFixed(1)).join(",")).join(" ");
  return (
    <div dir="ltr">
    <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${size} ${size}`} className="mx-auto block w-full max-w-[360px]">
      <title>{ariaLabel}</title>
      {[0.33, 0.66, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="var(--line)" strokeWidth="1" />
      ))}
      {axes.map(([name], i) => {
        const [x, y] = pt(i, 1);
        return <line key={name} x1={c} y1={c} x2={x} y2={y} stroke="var(--line)" strokeWidth="1" />;
      })}
      <polygon points={shape} fill="color-mix(in srgb, var(--brand) 22%, transparent)" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round" />
      {axes.map(([name, n], i) => {
        const [x, y] = pt(i, Math.max(0.12, n / top));
        const [lx, ly] = pt(i, 1.2);
        const cos = Math.cos(ang(i));
        return (
          <g key={name}>
            <circle cx={x} cy={y} r="3" fill="var(--brand)" />
            <text x={lx} y={ly} fontSize="11" fill="var(--ink)" textAnchor={cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle"} dominantBaseline="middle">
              {name.length > 12 ? `${name.slice(0, 11)}…` : name}
            </text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { journeyPlayed, journeyReached, journeyThreshold, markJourneyPlayed, prefersReducedMotion } from "./useJourneyReveal";

/**
 * Shared "draw once" rule for rings, bars, radars, funnels, lists and counters.
 *
 * One hook, one attribute: the host element receives `data-draw="pre"` (initial, drawn-out
 * state) only once JS has decided to play, then `data-draw="go"` when it scrolls into view, then
 * the attribute is removed again so later value changes use the kit's normal transitions.
 * Without IntersectionObserver, with reduced motion, on the server, in a hidden tab or for a
 * playKey that already played this session, the attribute is never set: the final state shows.
 * The CSS lives in draw.css (`[data-draw]`), imported by the components that use the hooks.
 */

const KEY_PREFIX = "draw:";
const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

/** Pure: may the intro play at all? (Used by the hooks and by tests.) */
export function drawEligible(opts: { enabled: boolean; playKey?: string; hasObserver: boolean; reduced: boolean; hidden: boolean; played: boolean }): boolean {
  return opts.enabled && opts.hasObserver && !opts.reduced && !opts.hidden && !opts.played;
}

export function drawPlayed(playKey?: string): boolean {
  return journeyPlayed(playKey ? KEY_PREFIX + playKey : undefined);
}

export function markDrawPlayed(playKey?: string): void {
  markJourneyPlayed(playKey ? KEY_PREFIX + playKey : undefined);
}

export type DrawPhase = "pre" | "go" | undefined;

export interface DrawInOptions {
  /** Entity id: the same entity never replays within the session. */
  playKey?: string;
  enabled?: boolean;
  /** Fraction of the element that must be visible first. */
  threshold?: number;
  /** How long `data-draw="go"` stays on before the attribute is removed. */
  settleMs?: number;
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Browser-only, evaluated during render so an eligible element's very first style is already the drawn-out one. */
function eligibleNow(playKey: string | undefined, enabled: boolean): boolean {
  return drawEligible({
    enabled,
    playKey,
    hasObserver: typeof IntersectionObserver !== "undefined",
    reduced: prefersReducedMotion(),
    hidden: hidden(),
    played: drawPlayed(playKey),
  });
}

export function useDrawIn<T extends Element = HTMLElement>({ playKey, enabled = true, threshold = 0.35, settleMs = 2000 }: DrawInOptions = {}) {
  const ref = useRef<T | null>(null);
  // Initial state is decided synchronously: "pre" only when the intro can really play (never SSR/tests/reduced motion/played).
  // Entering "pre" has no transition (see draw.css), so it is instant even when set after mount.
  const [draw, setDraw] = useState<DrawPhase>(() => (eligibleNow(playKey, enabled) ? "pre" : undefined));
  const setRef = useCallback((node: T | null) => {
    ref.current = node;
  }, []);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el || !eligibleNow(playKey, enabled)) {
      setDraw(undefined); // never leave something drawn-out
      return;
    }
    setDraw("pre");
    const effective = journeyThreshold(threshold, el.getBoundingClientRect().height, window.innerHeight);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting && journeyReached(e.intersectionRatio, effective))) return;
        io.disconnect();
        markDrawPlayed(playKey);
        setDraw("go");
        timer = setTimeout(() => setDraw(undefined), settleMs);
      },
      { threshold: effective },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
      setDraw(undefined); // never leave something drawn-out
    };
    // Armed once per entity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, playKey]);

  return { ref: setRef, draw };
}

/** ease-out cubic, in step with the kit's --dna-ease feel. */
export function countUpEase(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

/** The animated number for a count-up at progress `t` (0..1); integers stay integers. */
export function countUpValue(value: number, t: number): number {
  const v = value * countUpEase(t);
  return Number.isInteger(value) ? Math.round(v) : v;
}

export interface CountUpOptions {
  playKey?: string;
  /** Milliseconds, capped at 900. */
  duration?: number;
  enabled?: boolean;
  threshold?: number;
}

/**
 * Count 0 -> value once per playKey when first visible. `animating` is false whenever the final
 * value is simply shown (no IO, reduced motion, already played, settled); later value changes snap.
 */
export function useCountUp<T extends Element = HTMLElement>(value: number, { playKey, duration = 700, enabled = true, threshold = 0.4 }: CountUpOptions = {}) {
  const ms = Math.min(900, Math.max(0, duration));
  const ok = Number.isFinite(value) && value > 0;
  const { ref, draw } = useDrawIn<T>({ playKey, enabled: enabled && ok, threshold, settleMs: ms + 150 });
  const [t, setT] = useState(0);
  useEffect(() => {
    if (draw !== "go") return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = ms > 0 ? (now - start) / ms : 1;
      setT(Math.min(1, p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setT(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [draw, ms]);
  const animating = draw === "pre" || draw === "go";
  const progress = draw === "pre" ? 0 : draw === "go" ? t : 1;
  return { ref, animating, shown: animating ? countUpValue(value, progress) : value };
}

/* ------------------------------------------------------------ rise once */

const RISE_KEY = "rise";
function setRiseDone() {
  if (typeof document !== "undefined") document.documentElement.setAttribute("data-rise", "done");
}
// Already played earlier in this session (e.g. a reload): never replay.
if (drawPlayed(RISE_KEY)) setRiseDone();

/**
 * The entrance rise of the home cards (`acad-rise`) plays once per session: after it ran, `html[data-rise="done"]`
 * switches it off, so coming back to /app does not replay it. Call from the screen that owns those cards.
 */
export function useRiseOnce(): void {
  useIsoLayoutEffect(() => {
    if (drawPlayed(RISE_KEY)) {
      setRiseDone();
      return;
    }
    const id = setTimeout(() => {
      markDrawPlayed(RISE_KEY);
      setRiseDone();
    }, 1200);
    return () => clearTimeout(id);
  }, []);
}

/* -------------------------------------------------------------- arrival */

/**
 * "go" for ~1.6s when a result arrives (`ready` flips false -> true), else undefined. With `onMount` a result
 * that is already there on first render counts as arrived too (a verdict component that mounts with its result).
 * Never under reduced motion. Drives `data-stamped` (seal) and `data-flash` (badge) in draw.css.
 */
export function useArrival(ready: boolean, { onMount = false }: { onMount?: boolean } = {}): "go" | undefined {
  const prev = useRef<boolean | null>(null);
  // Decided before the first paint, so a verdict that mounts with its result never flashes un-stamped.
  const [on, setOn] = useState(() => onMount && ready && !prefersReducedMotion());
  useIsoLayoutEffect(() => {
    const was = prev.current;
    prev.current = ready;
    if (!ready) return;
    let start = false;
    if (was === null) start = onMount && !prefersReducedMotion();
    else if (was === false) start = !prefersReducedMotion();
    if (!start) return;
    setOn(true);
    const id = setTimeout(() => setOn(false), 1600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  return on ? "go" : undefined;
}

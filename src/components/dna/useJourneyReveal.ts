import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DnaStepState } from "./DnaKit";

/**
 * Intro reveal for DnaStepper ("journey" mode).
 *
 * The step states handed to the stepper are the truth. This hook only decides
 * HOW MANY of the already-true lit stations are shown so far while the stepper
 * scrolls into view: `lit` counts up 0 -> target once, then settles to `null`
 * (= render the real states). It never goes past `target`, never replays on
 * re-render/polling, and renders the final state at once for reduced motion,
 * without IntersectionObserver, or on the server (no-JS output is complete).
 */

const PLAYED = new Set<string>();
const STORAGE_PREFIX = "acos:journey:";
/** How long the last station keeps its one-shot halo before the intro settles. */
const SETTLE_MS = 1500;

/** ~4s in total, between 350ms and 750ms per station. */
export function journeyStepMs(count: number): number {
  return Math.min(750, Math.max(350, Math.round(4000 / Math.max(1, count))));
}

/** Number of leading stations that are really lit: last non-pending index + 1. */
export function journeyTarget(states: readonly DnaStepState[]): number {
  for (let i = states.length - 1; i >= 0; i--) if (states[i] !== "pending") return i + 1;
  return 0;
}

/** Display state during the intro: stations not yet reached stay pending. */
export function journeyDisplayState(real: DnaStepState, index: number, lit: number | null): DnaStepState {
  return lit === null || index < lit ? real : "pending";
}

/** One tick of the intro: light the next station, never past the real target. */
export function journeyAdvance(lit: number, target: number): number {
  return Math.min(lit + 1, Math.max(target, 0));
}

/** An observer entry counts only when it reaches the (attainable) threshold, not on a 1px sliver. */
export function journeyReached(ratio: number, threshold: number): boolean {
  return ratio >= threshold - 0.01;
}

/** The intro can only be armed once at least one station is really lit (data may load async). */
export function journeyHasTarget(target: number): boolean {
  return target > 0;
}

/**
 * A threshold the element can actually reach: an element taller than the viewport can never be
 * `threshold` visible, so its observer callback would never fire and the stations would stay hidden.
 */
export function journeyThreshold(threshold: number, elementHeight: number, viewportHeight: number): number {
  if (!(elementHeight > 0) || !(viewportHeight > 0)) return threshold;
  return Math.max(0.05, Math.min(threshold, (0.9 * viewportHeight) / elementHeight));
}

export function journeyPlayed(playKey?: string): boolean {
  if (!playKey) return false;
  if (PLAYED.has(playKey)) return true;
  try {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(STORAGE_PREFIX + playKey) === "1";
  } catch {
    return false;
  }
}

export function markJourneyPlayed(playKey?: string): void {
  if (!playKey) return;
  PLAYED.add(playKey);
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(STORAGE_PREFIX + playKey, "1");
  } catch {
    /* storage blocked: the module Set still covers SPA remounts */
  }
}

/** Test helper. */
export function resetJourneyPlayed(): void {
  PLAYED.clear();
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return true;
  return document.documentElement.classList.contains("a11y-reduced-motion");
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface JourneyRevealOptions {
  /** Stations that are really lit (see journeyTarget). */
  target: number;
  /** Total stations, only used to derive the default stepMs. */
  count: number;
  stepMs?: number;
  /** Fraction of the element that must be visible before the intro starts. */
  threshold?: number;
  enabled?: boolean;
  /** Keep the settled state out of reach (stay on the last lit station) while true. */
  hold?: boolean;
  /** Entity id: the same entity never replays within the session. */
  playKey?: string;
}

export function useJourneyReveal<T extends Element = HTMLElement>({
  target,
  count,
  stepMs,
  threshold = 0.5,
  enabled = true,
  hold = false,
  playKey,
}: JourneyRevealOptions) {
  const ref = useRef<T | null>(null);
  const [lit, setLit] = useState<number | null>(null);
  const targetRef = useRef(target);
  targetRef.current = target;
  const holdRef = useRef(hold);
  holdRef.current = hold;
  const ms = stepMs ?? journeyStepMs(count);
  
  // Callback ref so a stepper that mounts later (conditional render) still gets observed.
  const setRef = useCallback((node: T | null) => {
    ref.current = node;
  }, []);

  const hasTarget = journeyHasTarget(target);
  const [started, setStarted] = useState(false);

  useIsoLayoutEffect(() => {
    // Nothing is lit yet (async data): stay on the real, all-pending state and arm when stations arrive.
    if (!hasTarget || !enabled || typeof IntersectionObserver === "undefined" || prefersReducedMotion() || journeyPlayed(playKey)) return;
    const el = ref.current;
    if (!el) return;
    setLit(0); // before paint: no flash of the final state
    const effective = journeyThreshold(threshold, el.getBoundingClientRect().height, window.innerHeight);
    const io = new IntersectionObserver(
      (entries) => {
        // The observer also queues an initial entry with whatever sliver is visible: require the (attainable) ratio.
        if (!entries.some((e) => e.isIntersecting && journeyReached(e.intersectionRatio, effective))) return;
        if (targetRef.current <= 0) return; // data went away again: keep observing, do not spend the intro
        io.disconnect();
        markJourneyPlayed(playKey);
        setStarted(true);
        setLit(1);
      },
      { threshold: effective },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      setStarted(false);
      setLit(null); // never leave stations hidden
    };
    // Armed once per entity; later prop changes are handled by the ticker below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, playKey, hasTarget]);

  // Ticker: always converges to the real state. While behind the target (also when the target grows
  // mid-intro) light the next station; once level, keep the last halo a moment, then settle to null.
  useEffect(() => {
    if (!started || lit === null) return;
    if (lit < target) {
      const id = setTimeout(() => setLit((n) => (n === null ? n : journeyAdvance(n, targetRef.current))), ms);
      return () => clearTimeout(id);
    }
    if (hold) return;
    const id = setTimeout(() => setLit(null), SETTLE_MS);
    return () => clearTimeout(id);
  }, [started, lit, target, hold, ms]);

  return { ref: setRef, lit };
}

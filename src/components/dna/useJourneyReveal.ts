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
  const armed = useRef(false);

  // Callback ref so a stepper that mounts later (conditional render) still gets observed.
  const setRef = useCallback((node: T | null) => {
    ref.current = node;
  }, []);

  useIsoLayoutEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined" || prefersReducedMotion() || journeyPlayed(playKey)) return;
    const el = ref.current;
    if (!el) return;
    setLit(0); // before paint: no flash of the final state
    let timer: ReturnType<typeof setInterval> | undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        armed.current = true;
        markJourneyPlayed(playKey);
        if (targetRef.current <= 0) {
          setLit(null);
          return;
        }
        let n = 1;
        setLit(1);
        if (targetRef.current <= 1) return;
        timer = setInterval(() => {
          n += 1;
          setLit(Math.min(n, targetRef.current));
          if (n >= targetRef.current) clearInterval(timer);
        }, ms);
      },
      { threshold },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearInterval(timer);
      armed.current = false;
      setLit(null); // never leave stations hidden
    };
    // Armed once per entity; later prop changes are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, playKey]);

  // After the last lit station arrives, keep its halo for a moment, then settle to real states.
  useEffect(() => {
    if (lit === null || lit < 1 || lit < target || hold || !armed.current) return;
    const id = setTimeout(() => setLit(null), SETTLE_MS);
    return () => clearTimeout(id);
  }, [lit, target, hold]);

  return { ref: setRef, lit };
}

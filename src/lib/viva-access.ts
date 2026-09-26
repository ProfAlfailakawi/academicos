import type { VivaMode } from "../types";

export type VivaTimeSetting = "off" | "standard" | "extended150" | "extended200";

/** Standard per-question thinking/answer time in seconds, by viva mode. */
export const STANDARD_SECONDS: Record<VivaMode, number> = { easy: 240, normal: 180, strict: 120, external: 120 };

/** Seconds allowed for one question under the chosen accommodation (null = no timer). */
export function questionSeconds(mode: VivaMode, setting: VivaTimeSetting): number | null {
  if (setting === "off") return null;
  const base = STANDARD_SECONDS[mode] ?? 180;
  const factor = setting === "extended200" ? 2 : setting === "extended150" ? 1.5 : 1;
  return Math.round(base * factor);
}

// Decaying activity accumulator (Database_Spec 9, format2 R4.22 / R11.2 / R11.4).
//
// The spec stores `{v[k], t}` and does not name a record kind or the scale list.
// This module uses kind `decay` (key = the target rk) and DECAY_SCALES.
// Both choices are gaps: implementation-log.md, 扱い 未対応.
//
// At a commit that touches the target: v_k(now) = v_k(t) * 2^(-(now-t)/2^k seconds) + 1.
// A read multiplies once and does not add: v_k(now) = v_k(t) * 2^(-(now-t)/2^k seconds).

import { canonicalTimeMs } from "./extensions";

/** Seconds-exponents. Not named by the spec; see implementation-log.md. */
export const DECAY_SCALES: readonly number[] = [6, 10, 16, 20, 24];

function timeMs(value: string): number {
  const canonical = canonicalTimeMs(value);
  if (canonical !== undefined) return canonical;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** `2^(-(dtSeconds)/2^k)`, or 1 when no positive time has passed. */
export function decayFactor(dtSeconds: number, k: number): number {
  if (!(dtSeconds > 0)) return 1;
  return 2 ** (-dtSeconds / 2 ** k);
}

/**
 * One commit's increment. `add` is 1 at a commit and 0 is not used here.
 * A missing previous value is 0, so the first commit stores ones.
 */
export function advanceDecay(
  v: readonly number[] | undefined,
  t: string | undefined,
  now: string,
  add: number,
): { v: number[]; t: string } {
  const dt = t === undefined ? 0 : (timeMs(now) - timeMs(t)) / 1000;
  return {
    v: DECAY_SCALES.map((k, i) => (v?.[i] ?? 0) * decayFactor(dt, k) + add),
    t: now,
  };
}

/** The value at `now`: one multiply per scale, no increment. */
export function readDecay(v: readonly number[], t: string, now: string): number[] {
  const dt = (timeMs(now) - timeMs(t)) / 1000;
  return DECAY_SCALES.map((k, i) => (v[i] ?? 0) * decayFactor(dt, k));
}

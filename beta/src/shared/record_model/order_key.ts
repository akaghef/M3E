// Sibling order keys (`ord` of a parent edge): fractional-indexing keys over
// base62 (`0-9A-Za-z`), compared as plain strings (code unit order).
// Generation is delegated to the `fractional-indexing` library; this module
// only fixes the encoding and adapts the API used by the record model.

import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

export function isOrderKey(key: unknown): key is string {
  // The library checks the integer head and the trailing zero, but not the
  // digits of the fraction, so the alphabet is checked here.
  if (typeof key !== "string" || !/^[0-9A-Za-z]+$/.test(key)) return false;
  try {
    generateKeyBetween(key, null);
    return true;
  } catch {
    return false;
  }
}

function assertKey(key: string): void {
  if (!isOrderKey(key)) throw new Error(`Invalid order key: ${JSON.stringify(key)}`);
}

/** `n` keys, strictly increasing. */
export function initialKeys(n: number): string[] {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid key count: ${n}`);
  return generateNKeysBetween(null, null, n);
}

/** A key strictly between `a` and `b`. Either side may be undefined (open end). */
export function keyBetween(a: string | undefined, b: string | undefined): string {
  if (a !== undefined) assertKey(a);
  if (b !== undefined) assertKey(b);
  if (a !== undefined && b !== undefined && !(a < b)) {
    throw new Error(`Order keys out of order: ${JSON.stringify(a)} >= ${JSON.stringify(b)}`);
  }
  return generateKeyBetween(a ?? null, b ?? null);
}

/** `n` keys strictly between `a` and `b`, increasing (a moved block keeps its order and contiguity). */
export function keysBetween(a: string | undefined, b: string | undefined, n: number): string[] {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid key count: ${n}`);
  if (a !== undefined) assertKey(a);
  if (b !== undefined) assertKey(b);
  if (a !== undefined && b !== undefined && !(a < b)) {
    throw new Error(`Order keys out of order: ${JSON.stringify(a)} >= ${JSON.stringify(b)}`);
  }
  return generateNKeysBetween(a ?? null, b ?? null, n);
}

function fillBetween(out: string[], lo: number, hi: number, a: string | undefined, b: string | undefined): void {
  if (lo > hi) return;
  const keys = keysBetween(a, b, hi - lo + 1);
  for (let i = 0; i < keys.length; i += 1) out[lo + i] = keys[i];
}

/**
 * Order keys for siblings in their new order. `previous[i]` is the key the i-th sibling had, if any.
 * The keys kept are a longest strictly increasing subsequence of the previous keys; every other
 * sibling gets a key between its kept neighbours. With nothing to keep, the keys are `initialKeys`.
 */
export function assignOrderKeys(previous: Array<string | undefined>): string[] {
  const n = previous.length;
  let valid = 0;
  let increasing = true;
  let last: string | undefined;
  for (let i = 0; i < n; i += 1) {
    const key = previous[i];
    if (key === undefined || !isOrderKey(key)) {
      increasing = false;
      continue;
    }
    valid += 1;
    if (last !== undefined && !(last < key)) increasing = false;
    last = key;
  }
  if (valid === 0) return initialKeys(n);
  if (increasing && valid === n) return previous as string[];

  // Longest strictly increasing subsequence (patience sorting with predecessor links).
  const tails: number[] = [];
  const before = new Array<number>(n).fill(-1);
  for (let i = 0; i < n; i += 1) {
    const key = previous[i];
    if (key === undefined || !isOrderKey(key)) continue;
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((previous[tails[mid]] as string) < key) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) before[i] = tails[lo - 1];
    tails[lo] = i;
  }
  const kept = new Array<boolean>(n).fill(false);
  for (let i = tails[tails.length - 1]; i >= 0; i = before[i]) kept[i] = true;

  const out = new Array<string>(n);
  let lower: string | undefined;
  let runStart = 0;
  for (let i = 0; i <= n; i += 1) {
    if (i < n && !kept[i]) continue;
    const upper = i < n ? (previous[i] as string) : undefined;
    fillBetween(out, runStart, i - 1, lower, upper);
    if (i < n) out[i] = upper as string;
    lower = upper;
    runStart = i + 1;
  }
  return out;
}

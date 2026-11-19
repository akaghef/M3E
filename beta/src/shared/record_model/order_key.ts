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

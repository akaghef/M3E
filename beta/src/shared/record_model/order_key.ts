// Sibling order keys: strings over `0-9a-z`, compared as plain strings.
// A key never ends in `0`, so there is always room between two keys.

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";
const BASE = DIGITS.length;

export function isOrderKey(key: unknown): key is string {
  return typeof key === "string" && /^[0-9a-z]*[1-9a-z]$/.test(key);
}

function assertKey(key: string): void {
  if (!isOrderKey(key)) throw new Error(`Invalid order key: ${JSON.stringify(key)}`);
}

/** `n` keys, strictly increasing, all of the same length. */
export function initialKeys(n: number): string[] {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid key count: ${n}`);
  if (n === 0) return [];
  const perHead = BASE - 1; // last digit runs over 1..z
  const maxHead = Math.floor((n - 1) / perHead);
  let headWidth = 0;
  for (let rest = maxHead; rest > 0; rest = Math.floor(rest / BASE)) headWidth += 1;
  const keys: string[] = [];
  for (let i = 0; i < n; i += 1) {
    let head = "";
    let rest = Math.floor(i / perHead);
    for (let d = 0; d < headWidth; d += 1) {
      head = DIGITS[rest % BASE] + head;
      rest = Math.floor(rest / BASE);
    }
    keys.push(head + DIGITS[(i % perHead) + 1]);
  }
  return keys;
}

// Keys read as base-36 fractions "0.<key>". `a` may be "" (zero); `b` undefined means one.
function midpoint(a: string, b: string | undefined): string {
  if (b !== undefined) {
    let n = 0;
    while ((a[n] ?? "0") === b[n]) n += 1;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const digitA = a ? DIGITS.indexOf(a[0]) : 0;
  const digitB = b !== undefined ? DIGITS.indexOf(b[0]) : BASE;
  if (digitB - digitA > 1) return DIGITS[Math.round((digitA + digitB) / 2)];
  if (b !== undefined && b.length > 1) return b.slice(0, 1);
  return DIGITS[digitA] + midpoint(a.slice(1), undefined);
}

/** A key strictly between `a` and `b`. Either side may be undefined (open end). */
export function keyBetween(a: string | undefined, b: string | undefined): string {
  if (a !== undefined) assertKey(a);
  if (b !== undefined) assertKey(b);
  if (a !== undefined && b !== undefined && !(a < b)) {
    throw new Error(`Order keys out of order: ${JSON.stringify(a)} >= ${JSON.stringify(b)}`);
  }
  return midpoint(a ?? "", b);
}

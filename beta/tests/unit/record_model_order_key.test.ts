import { describe, expect, it } from "vitest";
import { initialKeys, isOrderKey, keyBetween, keysBetween } from "../../src/shared/record_model/order_key";

function expectStrictlyIncreasing(keys: string[]): void {
  for (let i = 0; i < keys.length; i += 1) {
    expect(isOrderKey(keys[i]), `key ${JSON.stringify(keys[i])}`).toBe(true);
    if (i > 0) expect(keys[i - 1] < keys[i], `${keys[i - 1]} < ${keys[i]}`).toBe(true);
  }
  expect(new Set(keys).size).toBe(keys.length);
}

// Small deterministic generator so a failure can be replayed.
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe("record model order keys (fractional-indexing, base62)", () => {
  it("initialKeys gives strictly increasing keys", () => {
    expect(initialKeys(0)).toEqual([]);
    expect(initialKeys(1)).toEqual(["a0"]);
    for (const n of [1, 2, 61, 62, 63, 1260, 5000, 50000]) {
      const keys = initialKeys(n);
      expect(keys).toHaveLength(n);
      expectStrictlyIncreasing(keys);
    }
    expect(() => initialKeys(-1)).toThrow();
    expect(() => initialKeys(1.5)).toThrow();
  });

  it("isOrderKey accepts library keys and rejects the rest", () => {
    for (const key of ["a0", "a1", "a0V", "Zz", "b10"]) expect(isOrderKey(key), key).toBe(true);
    // Earlier base36 keys, a trailing zero, an empty string and non-strings are not keys.
    for (const key of ["", "1", "h", "0001", "a10", "a0 ", 3, undefined]) expect(isOrderKey(key), String(key)).toBe(false);
  });

  it("keyBetween handles open ends and adjacent keys", () => {
    expectStrictlyIncreasing([keyBetween(undefined, "a0"), "a0"]);
    expectStrictlyIncreasing(["a0", keyBetween("a0", undefined)]);
    expectStrictlyIncreasing(["a0", keyBetween("a0", "a1"), "a1"]);
    expectStrictlyIncreasing(["a0", keyBetween("a0", "a0V"), "a0V"]);
    expect(isOrderKey(keyBetween(undefined, undefined))).toBe(true);
  });

  it("keyBetween rejects malformed or unordered keys, so equal neighbours must be re-keyed first", () => {
    expect(() => keyBetween("a10", undefined)).toThrow();
    expect(() => keyBetween("1", undefined)).toThrow();
    expect(() => keyBetween("", undefined)).toThrow();
    expect(() => keyBetween("a2", "a1")).toThrow();
    expect(() => keyBetween("a1", "a1")).toThrow();
  });

  it("keysBetween gives a contiguous increasing block inside the gap", () => {
    const block = keysBetween("a1", "a2", 5);
    expectStrictlyIncreasing(["a1", ...block, "a2"]);
    expect(keysBetween(undefined, undefined, 0)).toEqual([]);
    expect(() => keysBetween("a2", "a1", 1)).toThrow();
  });

  it("keys do not depend on node IDs", () => {
    // Generation takes only the neighbouring keys; the same gap gives the same key whatever the nodes are.
    expect(keyBetween("a0", "a1")).toBe(keyBetween("a0", "a1"));
  });

  it("random insert sequences keep strict order and uniqueness", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const random = rng(seed);
      const keys = initialKeys(Math.floor(random() * 40));
      for (let step = 0; step < 400; step += 1) {
        const mode = seed % 4;
        const at = mode === 0 ? 0 : mode === 1 ? keys.length : Math.floor(random() * (keys.length + 1));
        keys.splice(at, 0, keyBetween(keys[at - 1], keys[at]));
      }
      expectStrictlyIncreasing(keys);
    }
  });

  it("repeated insertion at the same gap stays ordered", () => {
    const keys = ["a0", "a1"];
    for (let step = 0; step < 300; step += 1) keys.splice(1, 0, keyBetween(keys[0], keys[1]));
    expectStrictlyIncreasing(keys);
  });
});

import { describe, expect, it } from "vitest";
import { initialKeys, isOrderKey, keyBetween } from "../../src/shared/record_model/order_key";

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

describe("record model order keys", () => {
  it("initialKeys gives strictly increasing keys that never end in 0", () => {
    expect(initialKeys(0)).toEqual([]);
    expect(initialKeys(1)).toEqual(["1"]);
    for (const n of [1, 2, 35, 36, 37, 70, 71, 1260, 1261, 5000, 50000]) {
      const keys = initialKeys(n);
      expect(keys).toHaveLength(n);
      expectStrictlyIncreasing(keys);
    }
    expect(() => initialKeys(-1)).toThrow();
    expect(() => initialKeys(1.5)).toThrow();
  });

  it("keyBetween handles open ends and adjacent keys", () => {
    expectStrictlyIncreasing([keyBetween(undefined, "1"), "1"]);
    expectStrictlyIncreasing(["z", keyBetween("z", undefined)]);
    expectStrictlyIncreasing(["1", keyBetween("1", "2"), "2"]);
    expectStrictlyIncreasing(["1", keyBetween("1", "11"), "11"]);
    expectStrictlyIncreasing(["0001", keyBetween("0001", "0002"), "0002"]);
    expectStrictlyIncreasing([keyBetween(undefined, "0001"), "0001"]);
    expect(isOrderKey(keyBetween(undefined, undefined))).toBe(true);
  });

  it("keyBetween rejects malformed or unordered keys", () => {
    expect(() => keyBetween("10", undefined)).toThrow();
    expect(() => keyBetween("A", undefined)).toThrow();
    expect(() => keyBetween("", undefined)).toThrow();
    expect(() => keyBetween("2", "1")).toThrow();
    expect(() => keyBetween("1", "1")).toThrow();
  });

  it("random insert sequences keep strict order and uniqueness", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const random = rng(seed);
      const keys = initialKeys(Math.floor(random() * 40));
      for (let step = 0; step < 400; step += 1) {
        // bias some runs toward one end, where keys grow fastest
        const mode = seed % 4;
        const at = mode === 0 ? 0 : mode === 1 ? keys.length : Math.floor(random() * (keys.length + 1));
        const key = keyBetween(keys[at - 1], keys[at]);
        keys.splice(at, 0, key);
      }
      expectStrictlyIncreasing(keys);
    }
  });

  it("repeated insertion at the same gap stays ordered", () => {
    const keys = ["1", "2"];
    for (let step = 0; step < 300; step += 1) keys.splice(1, 0, keyBetween(keys[0], keys[1]));
    expectStrictlyIncreasing(keys);
  });
});

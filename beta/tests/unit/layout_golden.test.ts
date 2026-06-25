import { describe, expect, test } from "vitest";
import { layout } from "../../src/shared/layout_port";
import { layoutSamples, toVisibleLayoutGraph } from "../../src/labs/layout/layout_samples";

function expectCloseObject(actual: unknown, expected: unknown, path = "result"): void {
  if (typeof expected === "number") {
    expect(typeof actual, path).toBe("number");
    expect(actual as number, path).toBeCloseTo(expected, 6);
    return;
  }
  if (Array.isArray(expected)) {
    expect(actual, path).toEqual(expected);
    return;
  }
  if (expected && typeof expected === "object") {
    expect(actual && typeof actual === "object", path).toBe(true);
    for (const key of Object.keys(expected as Record<string, unknown>)) {
      expectCloseObject(
        (actual as Record<string, unknown>)[key],
        (expected as Record<string, unknown>)[key],
        `${path}.${key}`,
      );
    }
    return;
  }
  expect(actual, path).toEqual(expected);
}

describe("layout golden parity", () => {
  test("first-unit samples are exactly tree, mindmap, and routing-scope", () => {
    expect(layoutSamples.map((sample) => sample.sample_id)).toEqual([
      "tree-basic",
      "mindmap-basic",
      "scope-routing-basic",
    ]);
  });

  test.each(layoutSamples)("$sample_id matches expected LayoutResult", (sample) => {
    const actual = layout(
      toVisibleLayoutGraph(sample),
      sample.input.boxSizes,
      sample.input.mode,
      sample.input.options,
    );
    expectCloseObject(actual, sample.expected, sample.sample_id);
  });

  test("spacing controls change layout output for lab inspection", () => {
    const sample = layoutSamples[1]!;
    const base = layout(toVisibleLayoutGraph(sample), sample.input.boxSizes, sample.input.mode, sample.input.options);
    const changed = layout(toVisibleLayoutGraph(sample), sample.input.boxSizes, sample.input.mode, {
      ...sample.input.options,
      spacing: { nodeGap: 60, levelGap: 220, padding: 160 },
    });
    expect(changed.pos.root?.x).not.toBe(base.pos.root?.x);
  });
});

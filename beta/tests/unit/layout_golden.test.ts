import { describe, expect, test } from "vitest";
import { layout, type LayoutNodePosition, type LayoutResult } from "../../src/shared/layout_port";
import { layoutSamples, toVisibleLayoutGraph } from "../../src/labs/layout/layout_samples";

const STRESS_SAMPLE_IDS = ["tree-stress-30", "radial-stress-30", "scope-routing-stress-30"] as const;
const stressSamples = layoutSamples.filter((sample) => STRESS_SAMPLE_IDS.includes(sample.sample_id as typeof STRESS_SAMPLE_IDS[number]));

interface Rect {
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

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

function rectFor(id: string, pos: LayoutNodePosition): Rect {
  return {
    id,
    left: pos.x,
    right: pos.x + pos.w,
    top: pos.y - pos.h / 2,
    bottom: pos.y + pos.h / 2,
  };
}

function overlapArea(a: Rect, b: Rect): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

function expectLayoutSanity(result: LayoutResult, sampleId: string): void {
  expect(Number.isFinite(result.totalWidth), `${sampleId}.totalWidth finite`).toBe(true);
  expect(Number.isFinite(result.totalHeight), `${sampleId}.totalHeight finite`).toBe(true);
  expect(result.totalWidth, `${sampleId}.totalWidth positive`).toBeGreaterThan(0);
  expect(result.totalHeight, `${sampleId}.totalHeight positive`).toBeGreaterThan(0);

  const rects = result.order.map((nodeId) => {
    const pos = result.pos[nodeId];
    expect(pos, `${sampleId}.${nodeId} has position`).toBeTruthy();
    for (const field of ["x", "y", "w", "h"] as const) {
      expect(Number.isFinite(pos![field]), `${sampleId}.${nodeId}.${field} finite`).toBe(true);
    }
    expect(pos!.w, `${sampleId}.${nodeId}.w positive`).toBeGreaterThan(0);
    expect(pos!.h, `${sampleId}.${nodeId}.h positive`).toBeGreaterThan(0);

    const rect = rectFor(nodeId, pos!);
    expect(rect.left, `${sampleId}.${nodeId} left bound`).toBeGreaterThanOrEqual(0);
    expect(rect.top, `${sampleId}.${nodeId} top bound`).toBeGreaterThanOrEqual(0);
    expect(rect.right, `${sampleId}.${nodeId} right bound`).toBeLessThanOrEqual(result.totalWidth);
    expect(rect.bottom, `${sampleId}.${nodeId} bottom bound`).toBeLessThanOrEqual(result.totalHeight);
    return rect;
  });

  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const a = rects[i]!;
      const b = rects[j]!;
      expect(overlapArea(a, b), `${sampleId} overlap ${a.id} vs ${b.id}`).toBe(0);
    }
  }
}

describe("layout golden parity", () => {
  test("samples include first-unit basics and 30-node stress fixtures", () => {
    expect(layoutSamples.map((sample) => sample.sample_id)).toEqual([
      "tree-basic",
      "radial-basic",
      "scope-routing-basic",
      "tree-stress-30",
      "radial-stress-30",
      "scope-routing-stress-30",
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

  test.each(stressSamples)("$sample_id has 30-node golden parity", (sample) => {
    expect(sample.input.graph.nodeIds).toHaveLength(30);
    const actual = layout(
      toVisibleLayoutGraph(sample),
      sample.input.boxSizes,
      sample.input.mode,
      sample.input.options,
    );
    expectCloseObject(actual, sample.expected, sample.sample_id);
  });

  test.each(stressSamples)("$sample_id passes layout sanity", (sample) => {
    const actual = layout(
      toVisibleLayoutGraph(sample),
      sample.input.boxSizes,
      sample.input.mode,
      sample.input.options,
    );
    expectLayoutSanity(actual, sample.sample_id);
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

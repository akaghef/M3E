import { describe, expect, it, vi } from "vitest";
import { RenderUpdateMetrics, renderUpdateRate } from "../../src/rendering/render_update_metrics";

describe("render update metrics", () => {
  it("counts CPU calls separately without scheduling frames or timers", () => {
    const timer = vi.spyOn(globalThis, "setTimeout");
    const metrics = new RenderUpdateMetrics();
    metrics.record("applyZoom", 2);
    metrics.record("setCamera", 1);
    metrics.record("setCamera", 3);
    const first = metrics.snapshot();
    expect(first.metrics.setCamera).toEqual({ count: 2, maxMs: 3 });
    expect(first.metrics.draw.count).toBe(0);
    metrics.record("draw", 4);
    expect(first.metrics.draw.count).toBe(0); // snapshots are independent
    expect(metrics.snapshot().metrics.draw.count).toBe(1);
    expect(timer).not.toHaveBeenCalled();
    timer.mockRestore();
  });
  it("uses elapsed sampling time and prevents negative rates after reset", () => {
    const metrics = new RenderUpdateMetrics();
    const before = { ...metrics.snapshot(), at: 1000 };
    for (let i = 0; i < 8; i++) metrics.record("draw", 2);
    const after = { ...metrics.snapshot(), at: 3000 };
    expect(renderUpdateRate("draw", before, after)).toBe(4);
    metrics.reset();
    const reset = { ...metrics.snapshot(), at: 4000 };
    expect(renderUpdateRate("draw", after, reset)).toBe(0);
    expect(reset.metrics.draw).toEqual({ count: 0, maxMs: 0 });
  });
});

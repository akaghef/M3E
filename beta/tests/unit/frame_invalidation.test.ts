import { describe, expect, it, vi } from "vitest";
import { FrameInvalidation } from "../../src/browser/frame_invalidation";

function harness(draw: () => void) {
  let nextId = 0;
  const pending = new Map<number, FrameRequestCallback>();
  const frame = new FrameInvalidation(draw,
    fn => { pending.set(++nextId, fn); return nextId; },
    id => { pending.delete(id); });
  const tick = () => {
    const callbacks = [...pending.values()];
    pending.clear();
    callbacks.forEach(fn => fn(0));
  };
  return { frame, pending, tick };
}

describe("frame invalidation", () => {
  it("coalesces invalidations and draws the latest state once", () => {
    let state = 0;
    const draw = vi.fn(() => state);
    const { frame, pending, tick } = harness(draw);
    for (state = 0; state < 100; state++) frame.invalidate();
    expect(pending.size).toBe(1);
    expect(draw).not.toHaveBeenCalled();
    tick();
    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw).toHaveReturnedWith(100);
  });
  it("flush presents atomically without a duplicate scheduled frame", () => {
    const draw = vi.fn();
    const { frame, tick } = harness(draw);
    frame.invalidate(); frame.flush(); tick();
    expect(draw).toHaveBeenCalledTimes(1);
    frame.invalidate(); frame.clear(); tick();
    expect(draw).toHaveBeenCalledTimes(1);
  });
  it("preserves invalidations raised while drawing for the next frame", () => {
    const draw = vi.fn(() => frame.invalidate());
    const { frame, pending, tick } = harness(draw);
    frame.invalidate(); tick();
    expect(draw).toHaveBeenCalledTimes(1);
    expect(pending.size).toBe(1);
    tick(); expect(draw).toHaveBeenCalledTimes(2);
  });
});

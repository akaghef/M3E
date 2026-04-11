import { describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Pure-logic replica of the pinch-zoom state machine from viewer.ts.
// We test the computation layer here, not DOM events.
// ---------------------------------------------------------------------------

function pointerDistance(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function clampZoom(z) {
  return Math.min(2.5, Math.max(0.15, z));
}

/** Minimal replica of the viewer's setZoom + camera adjustment. */
function setZoom(viewState, nextZoom, anchorX, anchorY, boardLeft = 0, boardTop = 0) {
  const previousZoom = viewState.zoom;
  viewState.zoom = clampZoom(nextZoom);
  const localX = anchorX - boardLeft;
  const localY = anchorY - boardTop;
  const contentX = (localX - viewState.cameraX) / previousZoom;
  const contentY = (localY - viewState.cameraY) / previousZoom;
  viewState.cameraX = localX - contentX * viewState.zoom;
  viewState.cameraY = localY - contentY * viewState.zoom;
}

// ---------------------------------------------------------------------------
// State machine that mirrors viewer.ts pointer handlers
// ---------------------------------------------------------------------------
function createPinchMachine() {
  const activePointers = new Map();
  const viewState = { zoom: 1, cameraX: 0, cameraY: 0, panState: null, pinchState: null };

  function startPinch() {
    const ids = Array.from(activePointers.keys());
    if (ids.length < 2) return;
    const a = activePointers.get(ids[0]);
    const b = activePointers.get(ids[1]);
    viewState.panState = null;
    viewState.pinchState = {
      pointerA: { id: ids[0], x: a.x, y: a.y },
      pointerB: { id: ids[1], x: b.x, y: b.y },
      initialDistance: pointerDistance(a, b),
      initialZoom: viewState.zoom,
      initialCameraX: viewState.cameraX,
      initialCameraY: viewState.cameraY,
      initialCenterX: (a.x + b.x) / 2,
      initialCenterY: (a.y + b.y) / 2,
    };
  }

  function pointerdown(id, x, y, pointerType = "touch") {
    if (pointerType === "touch") {
      activePointers.set(id, { x, y });
      if (activePointers.size === 2) {
        startPinch();
        return;
      }
    }
    viewState.panState = { pointerId: id, startX: x, startY: y, cameraX: viewState.cameraX, cameraY: viewState.cameraY };
  }

  function pointermove(id, x, y, pointerType = "touch") {
    if (pointerType === "touch" && activePointers.has(id)) {
      activePointers.set(id, { x, y });
    }
    if (viewState.pinchState) {
      const { pointerA, pointerB } = viewState.pinchState;
      if (id !== pointerA.id && id !== pointerB.id) return;
      const a = activePointers.get(pointerA.id);
      const b = activePointers.get(pointerB.id);
      if (!a || !b) return;
      const currentDistance = pointerDistance(a, b);
      const scale = currentDistance / viewState.pinchState.initialDistance;
      const nextZoom = viewState.pinchState.initialZoom * scale;
      const anchorX = (a.x + b.x) / 2;
      const anchorY = (a.y + b.y) / 2;
      setZoom(viewState, nextZoom, anchorX, anchorY);
      return;
    }
    if (viewState.panState && id === viewState.panState.pointerId) {
      viewState.cameraX = viewState.panState.cameraX + (x - viewState.panState.startX);
      viewState.cameraY = viewState.panState.cameraY + (y - viewState.panState.startY);
    }
  }

  function pointerup(id, pointerType = "touch") {
    if (pointerType === "touch") {
      activePointers.delete(id);
      if (viewState.pinchState) {
        viewState.pinchState = null;
        if (activePointers.size === 1) {
          const [remainingId, pos] = Array.from(activePointers.entries())[0];
          viewState.panState = { pointerId: remainingId, startX: pos.x, startY: pos.y, cameraX: viewState.cameraX, cameraY: viewState.cameraY };
        }
        return;
      }
    }
    if (viewState.panState && id === viewState.panState.pointerId) {
      viewState.panState = null;
    }
  }

  return { viewState, activePointers, pointerdown, pointermove, pointerup };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("pointerDistance", () => {
  it("calculates distance between two points", () => {
    expect(pointerDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
  it("returns 0 for identical points", () => {
    expect(pointerDistance({ x: 10, y: 20 }, { x: 10, y: 20 })).toBe(0);
  });
});

describe("clampZoom", () => {
  it("clamps below minimum", () => {
    expect(clampZoom(0.05)).toBe(0.15);
  });
  it("clamps above maximum", () => {
    expect(clampZoom(5)).toBe(2.5);
  });
  it("passes through valid values", () => {
    expect(clampZoom(1)).toBe(1);
  });
});

describe("pinch-to-zoom state machine", () => {
  let m;
  beforeEach(() => { m = createPinchMachine(); });

  it("single touch starts pan, not pinch", () => {
    m.pointerdown(1, 100, 200);
    expect(m.viewState.panState).not.toBeNull();
    expect(m.viewState.pinchState).toBeNull();
  });

  it("second touch triggers pinch and cancels pan", () => {
    m.pointerdown(1, 100, 200);
    expect(m.viewState.panState).not.toBeNull();
    m.pointerdown(2, 300, 200);
    expect(m.viewState.pinchState).not.toBeNull();
    expect(m.viewState.panState).toBeNull();
  });

  it("spreading fingers apart zooms in", () => {
    m.pointerdown(1, 200, 300);
    m.pointerdown(2, 400, 300);
    const initialZoom = m.viewState.zoom;
    // Spread fingers further apart
    m.pointermove(1, 100, 300);
    m.pointermove(2, 500, 300);
    expect(m.viewState.zoom).toBeGreaterThan(initialZoom);
  });

  it("pinching fingers together zooms out", () => {
    m.pointerdown(1, 100, 300);
    m.pointerdown(2, 500, 300);
    const initialZoom = m.viewState.zoom;
    // Bring fingers closer
    m.pointermove(1, 250, 300);
    m.pointermove(2, 350, 300);
    expect(m.viewState.zoom).toBeLessThan(initialZoom);
  });

  it("zoom is clamped within bounds", () => {
    m.pointerdown(1, 0, 0);
    m.pointerdown(2, 10, 0);
    // Spread massively
    m.pointermove(2, 10000, 0);
    expect(m.viewState.zoom).toBeLessThanOrEqual(2.5);
    // Reset and pinch nearly closed
    m = createPinchMachine();
    m.pointerdown(1, 0, 0);
    m.pointerdown(2, 1000, 0);
    m.pointermove(2, 1, 0);
    expect(m.viewState.zoom).toBeGreaterThanOrEqual(0.15);
  });

  it("lifting one finger ends pinch and restarts pan with remaining finger", () => {
    m.pointerdown(1, 100, 200);
    m.pointerdown(2, 300, 200);
    expect(m.viewState.pinchState).not.toBeNull();
    m.pointerup(2);
    expect(m.viewState.pinchState).toBeNull();
    expect(m.viewState.panState).not.toBeNull();
    expect(m.viewState.panState.pointerId).toBe(1);
  });

  it("lifting both fingers clears all state", () => {
    m.pointerdown(1, 100, 200);
    m.pointerdown(2, 300, 200);
    m.pointerup(2);
    m.pointerup(1);
    expect(m.viewState.pinchState).toBeNull();
    expect(m.viewState.panState).toBeNull();
  });

  it("zoom anchor tracks finger midpoint (symmetric spread)", () => {
    // Symmetric single-step spread: only move one pointer so there's no
    // intermediate state shift, then verify the anchor math.
    m.pointerdown(1, 200, 300);
    m.pointerdown(2, 400, 300);
    // Move pointer 2 outward — midpoint shifts to (350, 300), distance doubles
    m.pointermove(2, 600, 300);
    // distance went from 200 → 400, so zoom = 1 * (400/200) = 2
    expect(m.viewState.zoom).toBe(2);
    // Midpoint of (200,300) & (600,300) = (400,300)
    // Content under anchor was (400-0)/1 = 400
    // cameraX = 400 - 400*2 = -400
    expect(m.viewState.cameraX).toBe(-400);
    expect(m.viewState.cameraY).toBe(-300);
  });

  it("mouse pointer does not enter pinch tracking", () => {
    m.pointerdown(1, 100, 200, "mouse");
    expect(m.activePointers.size).toBe(0);
    expect(m.viewState.panState).not.toBeNull();
  });
});

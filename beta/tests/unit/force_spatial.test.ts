import { expect, test } from "vitest";
import { applySpatialRepulsion, ForceBoxIndex } from "../../src/shared/force_spatial";
import { createOtForce } from "../../src/shared/ot_force";
import { DisperseForceController } from "../../src/browser/disperse_force_controller";
const point = (i: number) => ({ x: Math.sin(i * 71) * 900, y: Math.cos(i * 43) * 900, vx: 0, vy: 0 });
test("Barnes-Hut approximates an independent exact inverse-square reference with OT cutoff", () => {
  const base = Array.from({ length: 400 }, (_, i) => point(i + 1)), approx = base.map(n => ({ ...n }));
  applySpatialRepulsion(approx, 2600, () => false);
  let error = 0, magnitude = 0;
  for (let i = 0; i < base.length; i++) {
    let x = 0, y = 0;
    for (let j = 0; j < base.length; j++) if (j !== i) {
      const dx = base[i].x - base[j].x, dy = base[i].y - base[j].y, d2 = dx * dx + dy * dy;
      if (d2 < 90000) { const f = 2600 / (d2 * Math.sqrt(d2)); x += dx * f; y += dy * f; }
    }
    error += Math.hypot(approx[i].vx - x, approx[i].vy - y); magnitude += Math.hypot(x, y);
  }
  expect(error / magnitude).toBeLessThan(.05);
});
test("spatial boxes cover exact collision candidates and position updates", () => {
  const boxes = Array.from({ length: 400 }, (_, i) => ({ ...point(i), w: 50 + i % 100, h: 30 + i % 70 }));
  const index = new ForceBoxIndex(boxes, 16);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.x <= b.x + b.w + 16 && a.x + a.w + 16 >= b.x && a.y <= b.y + b.h + 16 && a.y + a.h + 16 >= b.y) expect(index.candidates(i)).toContain(j);
  }
  boxes[399].x = boxes[0].x; boxes[399].y = boxes[0].y; index.update(399, boxes[399]);
  expect(index.candidates(0)).toContain(399);
});
test("graph update preserves live positions, pin and temporary drag; reheat then stop", () => {
  const nodes = [{ id: "a", label: "Alpha", x: -100, y: 0, w: 80, h: 40 }, { id: "b", label: "Beta", x: 100, y: 0, w: 80, h: 40 }];
  const sim = createOtForce({ nodes, links: [] });
  sim.setPinned("b", true); sim.beginDrag("a"); sim.moveDrag(0, 80);
  const a = sim.snapshot().nodes[0];
  sim.updateGraph({ nodes: [...nodes.map(n => ({ ...n, label: n.label + " edited" })), { id: "c", label: "Gamma", x: 400, y: 0, w: 80, h: 40 }], links: [] });
  expect(sim.snapshot().status).toBe("running"); sim.step();
  expect(sim.snapshot().nodes[0]).toMatchObject({ x: a.x, y: a.y }); expect(sim.snapshot().nodes[1].pinned).toBe(true);
  sim.endDrag(); for (let i = 0; i < 240; i++) sim.step();
  expect(sim.snapshot().status).not.toBe("running"); const before = sim.snapshot(); sim.step(); expect(sim.snapshot()).toEqual(before);
});
test("Viewer adapter retains drag across projections without authoring mutations", () => {
  const graph = { nodes: [{ id: "a", label: "Alpha", x: -50, y: 0, w: 50, h: 30 }, { id: "b", label: "Beta", x: 50, y: 0, w: 50, h: 30 }], links: [] };
  const before = structuredClone(graph), controller = new DisperseForceController();
  expect(controller.sync("map:scope", graph, new Set(), true)).toBe(true);
  controller.beginDrag("a"); controller.moveDrag(0, 100);
  expect(controller.sync("map:scope", graph, new Set(), true)).toBe(false);
  controller.step(); expect(controller.snapshot()!.nodes[0].y).toBe(100);
  controller.endDrag(); controller.pause(); expect(controller.snapshot()!.status).toBe("paused"); expect(graph).toEqual(before);
});
test.each([400, 2000])("force + collision step budget for %i nodes", count => {
  const nodes = Array.from({ length: count }, (_, i) => ({ id: `n${i}`, label: `Node ${i + 1}`, x: (i % 40) * 180, y: Math.floor(i / 40) * 100, w: 120, h: 50 }));
  const sim = createOtForce({ nodes, links: nodes.slice(1).map((n, i) => ({ id: `e${i}`, source: nodes[i].id, target: n.id })) });
  const times: number[] = [];
  for (let i = 0; i < 40; i++) { const t = performance.now(); sim.step(); if (i >= 5) times.push(performance.now() - t); }
  times.sort((a, b) => a - b); const p95 = times[Math.floor(times.length * .95)];
  console.info(JSON.stringify({ nodes: count, p95StepMs: p95 }));
  expect(p95).toBeLessThanOrEqual(count === 400 ? 16 : 50);
});
test('dense free sibling groups finish without overlaps after the cooling budget', () => {
  const nodes = Array.from({ length: 400 }, (_, i) => ({ id: `n${i}`, label: `Node ${i + 1}`,
    parentId: i < 3 || i % 4 === 0 ? undefined : `n${i % 3}`, x: Math.cos(i * 2.399963) * 200,
    y: Math.sin(i * 2.399963) * 150, w: 200, h: 40 }));
  const sim = createOtForce({ nodes, links: [] });
  let last = sim.snapshot(), previous = last;
  for (let i = 0; i < 240 && last.status === 'running'; i++) { previous = last; last = sim.step(); }
  expect(last.maxMove).toBeCloseTo(Math.max(...last.nodes.map((n,i) => Math.hypot(n.x-previous.nodes[i].x,n.y-previous.nodes[i].y))));
  expect(last.violations).toBe(0); expect(last.status).not.toBe('blocked');
  for (let i = 0; i < last.nodes.length; i++) for (let j = i + 1; j < last.nodes.length; j++) {
    const a = last.nodes[i], b = last.nodes[j];
    expect(Math.abs(a.x - b.x) >= (a.w + b.w) / 2 + 16 - 1e-4 || Math.abs(a.y - b.y) >= (a.h + b.h) / 2 + 16 - 1e-4).toBe(true);
  }
});
test('save coordinates include hidden descendants translated with the collapsed parent', () => {
  const sim = createOtForce({ nodes: [
    { id:'a',label:'Parent',x:0,y:0,w:100,h:40 },
    { id:'b',parentId:'a',label:'Hidden child',x:100,y:80,w:100,h:40 },
  ],links:[] });
  sim.setCollapsed('a',true); sim.beginDrag('a'); sim.moveDrag(40,20); sim.endDrag();
  expect(sim.positions().find(n => n.id === 'b')).toMatchObject({x:140,y:100});
  sim.setCollapsed('a',false); expect(sim.snapshot().nodes.find(n => n.id === 'b')).toMatchObject({x:140,y:100});
});

test("flat constraint passes retain pin positions and resolve moving collision candidates", () => {
  const nodes = Array.from({ length: 32 }, (_, i) => ({
    id: `flat${i}`, label: `Flat ${i}`, x: (i % 8) * 70, y: Math.floor(i / 8) * 35,
    w: 100, h: 40, pinned: i === 0,
  }));
  const original = structuredClone(nodes);
  const sim = createOtForce({ nodes, links: [] });
  let result = sim.snapshot();
  for (let i = 0; i < 240 && result.status === "running"; i++) result = sim.step();
  expect(result.nodes[0]).toMatchObject({ x: 0, y: 0, pinned: true });
  expect(result.violations).toBe(0);
  expect(result.status).not.toBe("blocked");
  for (let i = 0; i < result.nodes.length; i++) for (let j = i + 1; j < result.nodes.length; j++) {
    const a = result.nodes[i], b = result.nodes[j];
    expect(Math.abs(a.x - b.x) >= (a.w + b.w) / 2 + 16 - 1e-4 ||
      Math.abs(a.y - b.y) >= (a.h + b.h) / 2 + 16 - 1e-4).toBe(true);
  }
  expect(nodes).toEqual(original);
});

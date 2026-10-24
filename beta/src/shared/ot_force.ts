/**
 * Adapted from gyroid-eth/orrery-telemetry 22ffe6483530e643c8fc1af486319990e0181de4.
 * Required Notice: Copyright (c) 2026 gyroid
 * PolyForm Perimeter 1.0.1: https://polyformproject.org/licenses/perimeter/1.0.1/
 * See ../labs/force/NOTICE.md for source regions and M3E adaptations.
 */
import { Rectangle, removeOverlaps } from "webcola/dist/src/rectangle";
import { applySpatialRepulsion, ForceBoxIndex } from "./force_spatial";
import type { ForceGraph, ForceGroup, ForceMode, ForceNode, ForceParameters, ForceRect,
  ForceSimulation, ForceSnapshot, ForceStatus, ForceVisibleLink } from "./force_seam_interface";

export const FORCE_DEFAULTS: Readonly<ForceParameters> = Object.freeze({ repulsion: 2600, length: 110, spring: .012, gravity: .012 });
export const FORCE_LIMITS: Readonly<Record<keyof ForceParameters, readonly [number, number]>> = Object.freeze({
  repulsion: [200, 20000], length: [40, 400], spring: [0, .2], gravity: [0, .2],
});
export const FORCE_POLICY = Object.freeze({ gap: 16, padding: 24, header: 28, budget: 240, settleMove: .45, settleFrames: 5, constraintPasses: 12 });
interface Body extends ForceNode { vx: number; vy: number; }
interface Unit { members: string[]; bounds: ForceRect; }
const finite = (n: number): boolean => Number.isFinite(n);
const rect = (n: ForceNode): ForceRect => ({ x: n.x - n.w / 2, y: n.y - n.h / 2, w: n.w, h: n.h });
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

function validate(graph: ForceGraph): void {
  const byId = new Map<string, ForceNode>();
  for (const n of graph.nodes) {
    if (!n.id || byId.has(n.id)) throw new Error("Duplicate or empty node ID");
    if (![n.x, n.y, n.w, n.h].every(finite) || n.w <= 0 || n.h <= 0 || Math.max(Math.abs(n.x), Math.abs(n.y), n.w, n.h) > 1e6) throw new Error("Invalid node geometry");
    byId.set(n.id, n);
  }
  for (const n of graph.nodes) {
    const seen = new Set([n.id]);
    let p = n.parentId;
    while (p !== undefined) {
      if (!byId.has(p)) throw new Error("Unknown parent");
      if (seen.has(p)) throw new Error("Parent cycle");
      seen.add(p); p = byId.get(p)!.parentId;
    }
  }
  const ids = new Set<string>();
  for (const e of graph.links) {
    if (!e.id || ids.has(e.id) || !byId.has(e.source) || !byId.has(e.target)) throw new Error("Invalid link identity or endpoint");
    if (e.weight !== undefined && (!finite(e.weight) || e.weight <= 0 || e.weight > 100)) throw new Error("Invalid link weight");
    ids.add(e.id);
  }
}

export function createOtForce(graph: ForceGraph, mode: ForceMode = "Disperse"): ForceSimulation {
  validate(graph);
  if (mode !== "Radial" && mode !== "Disperse") throw new Error("Unknown mode");
  let original = graph.nodes.map(n => ({ ...n }));
  let originalLinks = graph.links.map(e => ({ ...e }));
  const bodies = new Map<string, Body>(original.map(n => [n.id, { ...n, vx: 0, vy: 0 }]));
  const children = new Map<string, string[]>();
  for (const n of original) if (n.parentId !== undefined) children.set(n.parentId, [...(children.get(n.parentId) || []), n.id]);
  let roots = original.filter(n => n.parentId === undefined).map(n => n.id);
  const collapsed = new Map<string, { x: number; y: number }>();
  let parameters = { ...FORCE_DEFAULTS };
  let status: ForceStatus = "running", remaining = FORCE_POLICY.budget, stable = 0, steps = 0, maxMove = 0;
  let drag: string[] = [];
  let visible: string[] = [], representative = new Map<string, string>(), links: ForceVisibleLink[] = [];
  const body = (id: string): Body => { const b = bodies.get(id); if (!b) throw new Error(`Unknown node: ${id}`); return b; };
  const descendants = (id: string): string[] => (children.get(id) || []).flatMap(child => [child, ...descendants(child)]);
  const fixed = (id: string): boolean => Boolean(body(id).pinned) || drag.includes(id);
  const branchMembers = (source: string, target: string): string[] => {
    if (mode === "Radial") return [source];
    const lineage = (id: string): string[] => { const path = [id]; let p = body(id).parentId; while (p !== undefined) { path.unshift(p); p = body(p).parentId; } return path; };
    const a = lineage(source), b = lineage(target);
    let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    if (i === a.length) return [source];
    const root = a[i];
    return [root, ...descendants(root)].filter(id => representative.get(id) === id);
  };
  // M3E world coordinates are not centred on the origin, so OT's pull towards
  // (0, 0) translated the whole set off-camera on every run. Pull towards the
  // visible centroid captured when the run (re)starts instead: gravity only
  // compacts the set and never moves it as a whole.
  let centre = { x: 0, y: 0 };
  const recentre = (): void => {
    if (!visible.length) return;
    centre = { x: visible.reduce((sum, id) => sum + body(id).x, 0) / visible.length,
      y: visible.reduce((sum, id) => sum + body(id).y, 0) / visible.length };
  };
  const reheat = (): void => { remaining = FORCE_POLICY.budget; stable = 0; status = visible.length ? "running" : "settled"; recentre(); };
  const refresh = (): void => {
    visible = []; representative = new Map(); links = [];
    const visit = (id: string, ancestor?: string): void => {
      const rep = ancestor || id;
      representative.set(id, rep);
      if (!ancestor) visible.push(id);
      for (const child of children.get(id) || []) visit(child, ancestor || (collapsed.has(id) ? id : undefined));
    };
    roots.forEach(id => visit(id));
    // refresh is first called after the geometry cache has been initialized.
    dirtyGeometry();
    const aggregates = new Map<string, ForceVisibleLink>();
    const add = (source: string, target: string, weight: number, kind: "tree" | "graph"): void => {
      const s = representative.get(source)!, t = representative.get(target)!;
      if (s === t) return;
      const key = JSON.stringify([kind, s, t]);
      const e = aggregates.get(key);
      if (e) e.weight += weight;
      else aggregates.set(key, { id: key, source: s, target: t, weight, kind });
    };
    if (mode === "Radial") original.forEach(n => { if (n.parentId !== undefined) add(n.parentId, n.id, 1, "tree"); });
    originalLinks.forEach(e => add(e.source, e.target, e.weight ?? 1, "graph"));
    links = [...aggregates.values()];
  };

  let geometryCache: { groups: ForceGroup[]; siblingSets: Unit[][] } | null = null;
  let violationCache: number | null = null;
  const dirtyGeometry = (): void => { geometryCache = null; violationCache = null; };

  // A group's envelope includes its nested child envelopes, not only leaf rects.
  const units = (id: string, groups: ForceGroup[], siblingSets: Unit[][]): Unit => {
    const own = { members: [id], bounds: rect(body(id)) };
    if (collapsed.has(id) || !(children.get(id)?.length)) return own;
    const parts = [own, ...children.get(id)!.map(c => units(c, groups, siblingSets))];
    siblingSets.push(parts);
    const x = Math.min(...parts.map(p => p.bounds.x)) - FORCE_POLICY.padding;
    const y = Math.min(...parts.map(p => p.bounds.y)) - FORCE_POLICY.padding - FORCE_POLICY.header;
    const b = { x, y, w: Math.max(...parts.map(p => p.bounds.x + p.bounds.w)) + FORCE_POLICY.padding - x,
      h: Math.max(...parts.map(p => p.bounds.y + p.bounds.h)) + FORCE_POLICY.padding - y };
    const members = parts.flatMap(p => p.members);
    groups.push({ id, label: body(id).label, members, ...b });
    return { members, bounds: b };
  };
  const geometry = (): { groups: ForceGroup[]; siblingSets: Unit[][] } => {
    if (geometryCache) return geometryCache;
    const groups: ForceGroup[] = [], siblingSets: Unit[][] = [];
    if (mode === "Disperse") siblingSets.push(roots.map(id => units(id, groups, siblingSets)));
    else siblingSets.push(visible.map(id => ({ members: [id], bounds: rect(body(id)) })));
    return geometryCache = { groups, siblingSets };
  };
  const penetration = (a: ForceRect, b: ForceRect): { dx: number; dy: number } | null => {
    const px = Math.min(a.x + a.w - b.x, b.x + b.w - a.x) + FORCE_POLICY.gap;
    const py = Math.min(a.y + a.h - b.y, b.y + b.h - a.y) + FORCE_POLICY.gap;
    if (px <= 1e-5 || py <= 1e-5) return null;
    return px < py ? { dx: (a.x + a.w / 2 <= b.x + b.w / 2 ? -1 : 1) * px, dy: 0 }
      : { dx: 0, dy: (a.y + a.h / 2 <= b.y + b.h / 2 ? -1 : 1) * py };
  };
  const violations = (): number => violationCache ??= geometry().siblingSets.reduce((total, set) => {
    const index = new ForceBoxIndex(set.map(n => n.bounds), FORCE_POLICY.gap);
    return total + set.reduce((count, a, i) => count + index.candidates(i).filter(j => penetration(a.bounds, set[j].bounds)).length, 0);
  }, 0);
  const shift = (ids: string[], dx: number, dy: number): void => {
    dirtyGeometry();
    ids.forEach(id => { const b = body(id); b.x += dx; b.y += dy; b.vx = 0; b.vy = 0; });
  };
  const projectConstraints = (passes = FORCE_POLICY.constraintPasses): void => {
    // A single sibling set has no enclosing groups to recompute. Its rectangles
    // and RBush entries are updated in place below, so reuse that live index
    // across projection passes. Nested sets still rebuild their envelopes after
    // inner branches move, preserving the containment constraint order.
    const initial = geometry().siblingSets;
    const flatSet = initial.length === 1 ? initial[0] : null;
    const flatIndex = flatSet ? new ForceBoxIndex(flatSet.map(n => n.bounds), FORCE_POLICY.gap) : null;
    for (let pass = 0; pass < passes; pass++) {
      // Rebase from body centres just as geometry() does between passes. Adding
      // shifts to box corners can otherwise accumulate different float rounding.
      if (pass && flatSet) for (let i = 0; i < flatSet.length; i++) {
        const unit = flatSet[i], n = body(unit.members[0]);
        const x = n.x - n.w / 2, y = n.y - n.h / 2;
        if (unit.bounds.x !== x || unit.bounds.y !== y) {
          unit.bounds.x = x; unit.bounds.y = y; flatIndex!.update(i, unit.bounds);
        }
      }
      let moved = false, fixedConflicts = 0;
      // Recompute after each sibling set; nested envelopes can have changed below it.
      const count = flatSet ? 1 : geometry().siblingSets.length;
      for (let si = 0; si < count; si++) {
        const set = flatSet ?? geometry().siblingSets[si], len = set.length;
        const index = flatIndex ?? new ForceBoxIndex(set.map(n => n.bounds), FORCE_POLICY.gap);
        for (let i = 0; i < len; i++) for (const j of index.candidates(i)) {
          const a = set[i], b = set[j];
          const p = penetration(a.bounds, b.bounds);
          if (!p) continue;
          const af = a.members.some(fixed), bf = b.members.some(fixed);
          if (af && bf) { fixedConflicts++; continue; }
          // Split the push by member count so the node centroid does not move.
          // An even split let a parent and its larger child branch, held in
          // contact by cohesion, walk the whole set one way on every frame.
          const total = a.members.length + b.members.length;
          const aShare = bf ? 1 : af ? 0 : b.members.length / total, bShare = af ? 1 : bf ? 0 : a.members.length / total;
          // One world-unit clearance avoids asymptotic contact chains at the
          // exact minimum gap; this is extra room, not a relaxed violation test.
          const px = p.dx ? p.dx + Math.sign(p.dx) : 0, py = p.dy ? p.dy + Math.sign(p.dy) : 0;
          if (!af) { const dx = px * aShare, dy = py * aShare; shift(a.members, dx, dy); a.bounds.x += dx; a.bounds.y += dy; }
          if (!bf) { const dx = px * bShare, dy = py * bShare; shift(b.members, -dx, -dy); b.bounds.x -= dx; b.bounds.y -= dy; }
          index.update(i, a.bounds); index.update(j, b.bounds);
          moved = true;
        }
      }
      if (!moved) {
        // This pass checked every candidate without changing any rectangle.
        // Reuse its exact conflict count instead of rebuilding the same index
        // again for the step status and snapshot. Fixed overlaps still count.
        violationCache = fixedConflicts;
        break;
      }
    }
  };
  const finishConstraints = (): void => {
    // WebCola/VPSC solves dense free rectangle contact chains in one projection.
    // Process inner sibling sets before outer envelopes; moving a branch rigidly
    // preserves every already solved containment relation. Fixed sets retain the
    // interactive pin-aware projector and may correctly report blocked.
    const count = geometry().siblingSets.length;
    for (let si = 0; si < count; si++) {
      const set = geometry().siblingSets[si];
      if (set.length < 2 || set.some(unit => unit.members.some(fixed))) continue;
      const padding = (FORCE_POLICY.gap + 1) / 2;
      const usedX = new Set<number>(), usedY = new Set<number>();
      const boxes = set.map(({ bounds: b }) => {
        let x = b.x, y = b.y;
        // WebCola's sweep-line RBTree compares centres only. Exact ties would
        // collapse distinct rectangles into one tree entry. Break those ties
        // deterministically before invoking the existing solver.
        while (usedX.has(x + b.w / 2)) x += .001;
        while (usedY.has(y + b.h / 2)) y += .001;
        usedX.add(x + b.w / 2); usedY.add(y + b.h / 2);
        return new Rectangle(x - padding, x + b.w + padding, y - padding, y + b.h + padding);
      });
      removeOverlaps(boxes);
      // VPSC weighs every rectangle equally; remove the member-weighted mean
      // displacement so the solved set does not translate as a whole.
      const moves = set.map(({ bounds: b }, i) => ({ x: boxes[i].cx() - (b.x + b.w / 2), y: boxes[i].cy() - (b.y + b.h / 2) }));
      const count = set.reduce((sum, unit) => sum + unit.members.length, 0);
      const mx = set.reduce((sum, unit, i) => sum + moves[i].x * unit.members.length, 0) / count;
      const my = set.reduce((sum, unit, i) => sum + moves[i].y * unit.members.length, 0) / count;
      set.forEach((unit, i) => shift(unit.members, moves[i].x - mx, moves[i].y - my));
    }
  };
  const snapshot = (): ForceSnapshot => ({
    nodes: visible.map(id => { const { vx: _vx, vy: _vy, ...n } = body(id); return { ...n, collapsed: collapsed.has(id), hiddenCount: collapsed.has(id) ? descendants(id).length : 0 }; }),
    groups: geometry().groups.map(g => ({ ...g, members: [...g.members] })), links: links.map(e => ({ ...e })), mode, parameters: { ...parameters }, status, steps, remaining, maxMove, violations: violations(),
  });
  refresh(); recentre();
  if (!visible.length) status = "settled";

  return {
    snapshot,
    positions() {
      return original.map(node => {
        const n = body(node.id), rep = representative.get(n.id), anchor = rep && collapsed.get(rep);
        const dx = anchor && rep !== n.id ? body(rep!).x - anchor.x : 0;
        const dy = anchor && rep !== n.id ? body(rep!).y - anchor.y : 0;
        const { vx: _vx, vy: _vy, ...position } = n;
        return { ...position, x: n.x + dx, y: n.y + dy };
      });
    },
    updateGraph(next) {
      validate(next);
      original = next.nodes.map(n => ({ ...n })); originalLinks = next.links.map(e => ({ ...e }));
      const ids = new Set(original.map(n => n.id));
      for (const id of bodies.keys()) if (!ids.has(id)) { bodies.delete(id); collapsed.delete(id); }
      children.clear();
      for (const n of original) {
        const existing = bodies.get(n.id);
        if (existing) { existing.label = n.label; existing.parentId = n.parentId; existing.w = n.w; existing.h = n.h; }
        else bodies.set(n.id, { ...n, vx: 0, vy: 0 });
        if (n.parentId !== undefined) children.set(n.parentId, [...(children.get(n.parentId) || []), n.id]);
      }
      for (const id of collapsed.keys()) if (!children.has(id)) collapsed.delete(id);
      roots = original.filter(n => n.parentId === undefined).map(n => n.id);
      drag = drag.filter(id => ids.has(id)); refresh(); reheat();
    },
    step() {
      if (status !== "running") return snapshot();
      const arr = visible.map(body), before = new Map(arr.map(n => [n.id, { x: n.x, y: n.y }]));
      // OT step: inverse-square repulsion (300-unit cutoff), Hooke springs,
      // weak centre pull, .86 damping, component velocity cap 18. DOM removed.
      applySpatialRepulsion(arr, parameters.repulsion, n => fixed(n.id));
      for (const e of links) {
        const a = body(e.source), b = body(e.target), dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const f = (d - parameters.length) * parameters.spring * e.weight, ux = dx / d * f, uy = dy / d * f;
        const apply = (ids: string[], sign: number): void => {
          for (const id of ids) if (!fixed(id)) { body(id).vx += sign * ux / ids.length; body(id).vy += sign * uy / ids.length; }
        };
        apply(branchMembers(a.id, b.id), 1); apply(branchMembers(b.id, a.id), -1);
      }
      // M3E containment adaptation: keep each direct sibling set compact without
      // inventing parent-child springs. External link force is distributed over
      // the branch below the endpoints' lowest common ancestor (above).
      if (mode === "Disperse") for (const g of geometry().groups) {
        const cx = g.members.reduce((sum, id) => sum + body(id).x, 0) / g.members.length;
        const cy = g.members.reduce((sum, id) => sum + body(id).y, 0) / g.members.length;
        for (const id of g.members) if (!fixed(id)) {
          body(id).vx += (cx - body(id).x) * .025;
          body(id).vy += (cy - body(id).y) * .025;
        }
      }
      const cool = drag.length ? 1 : remaining < 30 ? .70 : remaining < 60 ? .90 : 1;
      for (const g of arr) {
        if (fixed(g.id)) { g.vx = 0; g.vy = 0; continue; }
        g.vx += (centre.x - g.x) * parameters.gravity * .04; g.vy += (centre.y - g.y) * parameters.gravity * .04;
        g.vx *= .86 * cool; g.vy *= .86 * cool;
        g.x += clamp(g.vx, -18, 18); g.y += clamp(g.vy, -18, 18);
      }
      dirtyGeometry(); projectConstraints();
      steps++; remaining--;
      // Once cooling has exhausted its bounded budget, finish the same exact
      // box constraints without introducing fresh forces. Large contact chains
      // need more projection passes than the per-frame interactive allowance.
      if (remaining <= 0) for (let pass = 0; pass < 4 && violations(); pass++) finishConstraints();
      // Barnes-Hut approximation and the velocity cap are not pairwise
      // symmetric, so a free set still creeps a little each frame. Without a
      // pin or drag nothing may move the set as a whole: undo the translation.
      // A uniform shift leaves every constraint and relative position intact.
      if (arr.length && !arr.some(n => fixed(n.id))) {
        const dx = centre.x - arr.reduce((sum, n) => sum + n.x, 0) / arr.length;
        const dy = centre.y - arr.reduce((sum, n) => sum + n.y, 0) / arr.length;
        if (dx || dy) { dirtyGeometry(); for (const n of arr) { n.x += dx; n.y += dy; } }
      }
      // Stability and finite-state checks include the final constraint projection.
      maxMove = Math.max(0, ...arr.map(n => Math.hypot(n.x - before.get(n.id)!.x, n.y - before.get(n.id)!.y)));
      const invalid = arr.some(n => ![n.x, n.y, n.vx, n.vy].every(finite));
      const conflicts = violations();
      stable = !drag.length && !conflicts && maxMove < FORCE_POLICY.settleMove ? stable + 1 : 0;
      if (invalid) { dirtyGeometry(); for (const n of arr) Object.assign(n, before.get(n.id), { vx: 0, vy: 0 }); status = "blocked"; }
      else if (stable >= FORCE_POLICY.settleFrames) status = "settled";
      else if (remaining <= 0) status = conflicts ? "blocked" : "budget";
      if (status !== "running") arr.forEach(n => { n.vx = 0; n.vy = 0; });
      return snapshot();
    },
    setParameters(patch) {
      for (const [key, value] of Object.entries(patch)) {
        const range = FORCE_LIMITS[key as keyof ForceParameters];
        if (!range || !finite(value) || value < range[0] || value > range[1]) throw new Error(`Invalid parameter: ${key}`);
      }
      parameters = { ...parameters, ...patch }; reheat();
    },
    setMode(next) { if (next !== "Radial" && next !== "Disperse") throw new Error("Unknown mode"); mode = next; refresh(); reheat(); },
    setCollapsed(id, value) {
      const n = body(id);
      if (!(children.get(id)?.length) || collapsed.has(id) === value) return;
      if (representative.get(id) !== id) throw new Error("Cannot toggle a hidden node");
      if (drag.length) throw new Error("End drag before collapse");
      if (value) collapsed.set(id, { x: n.x, y: n.y });
      else {
        const anchor = collapsed.get(id)!, dx = n.x - anchor.x, dy = n.y - anchor.y;
        shift(descendants(id), dx, dy);
        // Nested collapsed subtrees also moved; their stored anchors must follow.
        for (const child of descendants(id)) { const c = collapsed.get(child); if (c) { c.x += dx; c.y += dy; } }
        collapsed.delete(id);
      }
      descendants(id).forEach(child => { body(child).vx = 0; body(child).vy = 0; });
      refresh(); reheat();
    },
    setPinned(id, value) { body(id).pinned = value; body(id).vx = 0; body(id).vy = 0; reheat(); },
    beginDrag(id, group = false, additionalIds = []) {
      body(id);
      if (representative.get(id) !== id) throw new Error("Cannot drag hidden node");
      drag = [...new Set(group ? [id, ...descendants(id)] : [id, ...additionalIds])].filter(x => bodies.has(x) && representative.get(x) === x);
      reheat();
    },
    moveDrag(dx, dy) { if (![dx, dy].every(finite)) throw new Error("Invalid drag delta"); shift(drag, dx, dy); reheat(); },
    endDrag() { drag = []; reheat(); },
    pause() { status = "paused"; }, reheat,
    resetPositions() {
      drag = []; collapsed.clear(); original.forEach(n => Object.assign(body(n.id), n, { pinned: Boolean(n.pinned), vx: 0, vy: 0 }));
      steps = 0; maxMove = 0; refresh(); reheat();
    },
  };
}

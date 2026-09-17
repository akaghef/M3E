/**
 * Adapted from gyroid-eth/orrery-telemetry 22ffe6483530e643c8fc1af486319990e0181de4.
 * Required Notice: Copyright (c) 2026 gyroid
 * PolyForm Perimeter 1.0.1: https://polyformproject.org/licenses/perimeter/1.0.1/
 * See ../labs/force/NOTICE.md for source regions and M3E adaptations.
 */
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
  const original = graph.nodes.map(n => ({ ...n }));
  const originalLinks = graph.links.map(e => ({ ...e }));
  const bodies = new Map<string, Body>(original.map(n => [n.id, { ...n, vx: 0, vy: 0 }]));
  const children = new Map<string, string[]>();
  for (const n of original) if (n.parentId !== undefined) children.set(n.parentId, [...(children.get(n.parentId) || []), n.id]);
  const roots = original.filter(n => n.parentId === undefined).map(n => n.id);
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
  const reheat = (): void => { remaining = FORCE_POLICY.budget; stable = 0; status = visible.length ? "running" : "settled"; };
  const refresh = (): void => {
    visible = []; representative = new Map(); links = [];
    const visit = (id: string, ancestor?: string): void => {
      const rep = ancestor || id;
      representative.set(id, rep);
      if (!ancestor) visible.push(id);
      for (const child of children.get(id) || []) visit(child, ancestor || (collapsed.has(id) ? id : undefined));
    };
    roots.forEach(id => visit(id));
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
    const groups: ForceGroup[] = [], siblingSets: Unit[][] = [];
    if (mode === "Disperse") siblingSets.push(roots.map(id => units(id, groups, siblingSets)));
    else siblingSets.push(visible.map(id => ({ members: [id], bounds: rect(body(id)) })));
    return { groups, siblingSets };
  };
  const penetration = (a: ForceRect, b: ForceRect): { dx: number; dy: number } | null => {
    const px = Math.min(a.x + a.w - b.x, b.x + b.w - a.x) + FORCE_POLICY.gap;
    const py = Math.min(a.y + a.h - b.y, b.y + b.h - a.y) + FORCE_POLICY.gap;
    if (px <= 1e-5 || py <= 1e-5) return null;
    return px < py ? { dx: (a.x + a.w / 2 <= b.x + b.w / 2 ? -1 : 1) * px, dy: 0 }
      : { dx: 0, dy: (a.y + a.h / 2 <= b.y + b.h / 2 ? -1 : 1) * py };
  };
  const violations = (): number => geometry().siblingSets.reduce((total, set) => total + set.reduce((count, a, i) =>
    count + set.slice(i + 1).filter(b => penetration(a.bounds, b.bounds)).length, 0), 0);
  const shift = (ids: string[], dx: number, dy: number): void => {
    ids.forEach(id => { const b = body(id); b.x += dx; b.y += dy; b.vx = 0; b.vy = 0; });
  };
  const projectConstraints = (): void => {
    for (let pass = 0; pass < FORCE_POLICY.constraintPasses; pass++) {
      let moved = false;
      // Recompute after each sibling set; nested envelopes can have changed below it.
      const count = geometry().siblingSets.length;
      for (let si = 0; si < count; si++) {
        const set = geometry().siblingSets[si], len = set.length;
        for (let i = 0; i < len; i++) for (let j = i + 1; j < len; j++) {
          const a = set[i], b = set[j];
          const p = penetration(a.bounds, b.bounds);
          if (!p) continue;
          const af = a.members.some(fixed), bf = b.members.some(fixed);
          if (af && bf) continue;
          const share = af || bf ? 1 : .5;
          // One world-unit clearance avoids asymptotic contact chains at the
          // exact minimum gap; this is extra room, not a relaxed violation test.
          const dx = (p.dx ? p.dx + Math.sign(p.dx) : 0) * share;
          const dy = (p.dy ? p.dy + Math.sign(p.dy) : 0) * share;
          if (!af) { shift(a.members, dx, dy); a.bounds.x += dx; a.bounds.y += dy; }
          if (!bf) { shift(b.members, -dx, -dy); b.bounds.x -= dx; b.bounds.y -= dy; }
          moved = true;
        }
      }
      if (!moved) break;
    }
  };
  const snapshot = (): ForceSnapshot => ({
    nodes: visible.map(id => { const { vx: _vx, vy: _vy, ...n } = body(id); return { ...n, collapsed: collapsed.has(id), hiddenCount: collapsed.has(id) ? descendants(id).length : 0 }; }),
    groups: geometry().groups, links: links.map(e => ({ ...e })), mode, parameters: { ...parameters }, status, steps, remaining, maxMove, violations: violations(),
  });
  refresh();
  if (!visible.length) status = "settled";

  return {
    snapshot,
    step() {
      if (status !== "running") return snapshot();
      const arr = visible.map(body), before = new Map(arr.map(n => [n.id, { x: n.x, y: n.y }]));
      // OT step: inverse-square repulsion (300-unit cutoff), Hooke springs,
      // weak centre pull, .86 damping, component velocity cap 18. DOM removed.
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i], b = arr[j];
        let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < 1e-8) { const angle = (i * 31 + j * 17) * 2.399963; dx = Math.cos(angle); dy = Math.sin(angle); d2 = 1; }
        if (d2 < 90000) {
          const f = parameters.repulsion / d2, d = Math.sqrt(d2), ux = dx / d * f, uy = dy / d * f;
          if (!fixed(a.id)) { a.vx += ux; a.vy += uy; }
          if (!fixed(b.id)) { b.vx -= ux; b.vy -= uy; }
        }
      }
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
        g.vx += -g.x * parameters.gravity * .04; g.vy += -g.y * parameters.gravity * .04;
        g.vx *= .86 * cool; g.vy *= .86 * cool;
        g.x += clamp(g.vx, -18, 18); g.y += clamp(g.vy, -18, 18);
      }
      projectConstraints();
      maxMove = Math.max(0, ...arr.map(n => Math.hypot(n.x - before.get(n.id)!.x, n.y - before.get(n.id)!.y)));
      const invalid = arr.some(n => ![n.x, n.y, n.vx, n.vy].every(finite));
      steps++; remaining--;
      const conflicts = violations();
      stable = !drag.length && !conflicts && maxMove < FORCE_POLICY.settleMove ? stable + 1 : 0;
      if (invalid) { for (const n of arr) Object.assign(n, before.get(n.id), { vx: 0, vy: 0 }); status = "blocked"; }
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
    beginDrag(id, group = false) {
      body(id);
      if (representative.get(id) !== id) throw new Error("Cannot drag hidden node");
      drag = group ? [id, ...descendants(id)].filter(x => representative.get(x) === x) : [id];
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

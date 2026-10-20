import type { ForceSnapshot } from "../shared/force_seam_interface";
import type { LayoutResult, LayoutNodePosition } from "../shared/layout_port";
import type { RenderSnapshot } from "../rendering/webgl_projection";
import type { PaintCommand } from "../rendering/webgl_scene_tiles";

/** The same circle boundary rule used by the canonical SVG guide renderer. */
export function disperseGuideEndpoints(source: LayoutNodePosition, target: LayoutNodePosition) {
  const sr = Math.max(18, source.w / 2), tr = Math.max(18, target.w / 2);
  const sx = source.x + sr, tx = target.x + tr;
  const dx = tx - sx, dy = target.y - source.y, len = Math.max(1, Math.hypot(dx, dy));
  return { x1: sx + dx / len * sr, y1: source.y + dy / len * sr,
    x2: tx - dx / len * tr, y2: target.y - dy / len * tr, mx: (sx + tx) / 2, my: (source.y + target.y) / 2 };
}

/** Move the existing canonical paint, preserving fonts, colors and shapes.
 * Curved/labelled GraphLinks retain the full canonical route until a separate
 * geometry adapter can update them without approximating their appearance. */
export function dispersePositionFrame(previous: RenderSnapshot, layout: LayoutResult, force: ForceSnapshot): { scene: RenderSnapshot; layout: LayoutResult } | null {
  if (!previous.paintScene || previous.graphLinks.length || force.nodes.length !== previous.nodes.length) return null;
  const deltas = new Map(force.nodes.map(n => {
    const p = layout.pos[n.id];
    return [n.id, p ? { x: n.x - n.w / 2 - p.x, y: n.y - p.y } : null];
  }));
  if ([...deltas.values()].some(p => !p)) return null;
  const pos = { ...layout.pos };
  for (const n of force.nodes) pos[n.id] = { ...pos[n.id], x: n.x - n.w / 2, y: n.y };
  const groupById = new Map(force.groups.map(g => [g.id, g]));
  let supported = true;
  const commands = previous.paintScene.commands.map((c): PaintCommand => {
    if (c.groupId) {
      const g = groupById.get(c.groupId); if (!g) { supported = false; return c; }
      const { x, y, w, h } = g, r = Math.min(12, w / 2, h / 2);
      return { ...c, path: `M${x+r} ${y}H${x+w-r}A${r} ${r} 0 0 1 ${x+w} ${y+r}V${y+h-r}A${r} ${r} 0 0 1 ${x+w-r} ${y+h}H${x+r}A${r} ${r} 0 0 1 ${x} ${y+h-r}V${y+r}A${r} ${r} 0 0 1 ${x+r} ${y}Z`,
        matrix: [1,0,0,1,0,0], bounds: { x, y, width: w, height: h } };
    }
    const delta = c.nodeId && deltas.get(c.nodeId);
    if (delta) return { ...c, matrix: [c.matrix[0], c.matrix[1], c.matrix[2], c.matrix[3], c.matrix[4] + delta.x, c.matrix[5] + delta.y],
      bounds: { ...c.bounds, x: c.bounds.x + delta.x, y: c.bounds.y + delta.y } };
    if (c.sourceNodeId || c.targetNodeId) {
      const match = /^M\s*([\d.e+-]+)[ ,]+([\d.e+-]+)\s*L\s*([\d.e+-]+)[ ,]+([\d.e+-]+)$/i.exec(c.path || "");
      if (!match) { supported = false; return c; }
      const source = pos[c.sourceNodeId || ""], target = pos[c.targetNodeId || ""];
      if (!source || !target) { supported = false; return c; }
      const line = disperseGuideEndpoints(source, target);
      const { x1: x, y1: y, x2: X, y2: Y } = line, pad = Math.max(3, c.style.width * 2);
      return { ...c, path: `M${x} ${y}L${X} ${Y}`, bounds: { x: Math.min(x,X)-pad, y: Math.min(y,Y)-pad, width: Math.abs(X-x)+pad*2, height: Math.abs(Y-y)+pad*2 } };
    }
    return c;
  });
  if (!supported) return null;
  const nodes = previous.nodes.map(n => { const d = deltas.get(n.id)!; return { ...n, x: n.x + d.x, y: n.y + d.y }; });
  const groups = previous.groups.map(g => { const next = groupById.get(g.id); return next ? { ...g, x: next.x, y: next.y, width: next.w, height: next.h } : g; });
  const edges = previous.edges.map(e => {
    const line = disperseGuideEndpoints(pos[e.sourceNodeId], pos[e.targetNodeId]);
    return { ...e, points: [{ x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 }] };
  });
  const bounds = force.nodes.reduce((b,n) => ({ minX: Math.min(b.minX,n.x-n.w/2-32), minY: Math.min(b.minY,n.y-n.h/2-32), maxX: Math.max(b.maxX,n.x+n.w/2+32), maxY: Math.max(b.maxY,n.y+n.h/2+32) }), { minX:0,minY:0,maxX:800,maxY:600 });
  force.groups.forEach(g => { bounds.minX=Math.min(bounds.minX,g.x-32); bounds.minY=Math.min(bounds.minY,g.y-32); bounds.maxX=Math.max(bounds.maxX,g.x+g.w+32); bounds.maxY=Math.max(bounds.maxY,g.y+g.h+32); });
  return { scene: { ...previous, revision:`disperse:${force.steps}`, nodes, groups, edges, bounds, paintScene:{commands} },
    layout: { ...layout, pos, groups:force.groups.map(g=>({...g,memberIds:g.members})), totalWidth:bounds.maxX, totalHeight:bounds.maxY } };
}

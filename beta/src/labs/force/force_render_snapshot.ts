import type { ForceSnapshot } from "../../shared/force_seam_interface";
import type { RenderSnapshot, RenderLabel, CameraState } from "../../rendering/webgl_projection";

export interface ForceCamera { x: number; y: number; scale: number; }
export function forceRenderCamera(camera: ForceCamera, width: number, height: number): CameraState {
  return { x: width / 2 - camera.x * camera.scale, y: height / 2 - camera.y * camera.scale, zoom: camera.scale };
}

function boundary(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number }): { x: number; y: number } {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.min(dx ? a.w / 2 / Math.abs(dx) : Infinity, dy ? a.h / 2 / Math.abs(dy) : Infinity);
  return Number.isFinite(t) ? { x: a.x + dx * t, y: a.y + dy * t } : { x: a.x, y: a.y };
}

/** Direct typed conversion; no SVG, DOM measurement, physics or persistence. */
export function forceRenderSnapshot(snapshot: ForceSnapshot, selected: string | null = null): RenderSnapshot {
  const byId = new Map(snapshot.nodes.map(n => [n.id, n]));
  const labels: RenderLabel[] = [];
  const nodes = snapshot.nodes.map(n => ({
    id: n.id, x: n.x - n.w / 2, y: n.y - n.h / 2, width: n.w, height: n.h,
    label: n.label, labelLines: [n.label, ...(n.collapsed || n.pinned ? [`${n.pinned ? "PIN · " : ""}${n.collapsed ? `+${n.hiddenCount} hidden` : "固定"}`] : [])],
    fontSize: 13, textColor: "#e2eaf1", shape: "rect" as const, radius: 7,
    fill: n.id === selected ? "#223e48" : "#1c303f",
    stroke: n.id === selected ? "#70e6c7" : n.pinned ? "#e6bc79" : "#638298",
    strokeWidth: n.id === selected ? 2.5 : 1.2, strokeDash: n.pinned ? [4, 3] : undefined,
  }));
  const groups = [...snapshot.groups].sort((a, b) => b.members.length - a.members.length).map(g => {
    labels.push({ id: `group:${g.id}`, x: g.x + 10, y: g.y + 3, width: Math.max(140, g.label.length * 14 + 90),
      height: 22, lines: [`${g.label} · ${g.members.length}`], fontSize: 11, color: "#a3bacb", align: "left" });
    return { id: g.id, memberIds: [...g.members], x: g.x, y: g.y, width: g.w, height: g.h,
      radius: 10, fill: "rgba(102,140,172,0.03)", stroke: "#4b6375", strokeWidth: 1, dash: [5, 4], headerHeight: 28, headerFill: "#1c2c38" };
  });
  const links = snapshot.links.map(e => {
    const a = byId.get(e.source), b = byId.get(e.target);
    if (!a || !b) throw new Error(`Missing visible endpoint: ${e.id}`);
    if (e.weight > 1) labels.push({ id: `weight:${e.id}`, x: (a.x + b.x) / 2 - 30, y: (a.y + b.y) / 2 - 22,
      width: 60, height: 16, lines: [`×${e.weight}`], fontSize: 10, color: "#a2c6bc" });
    return { id: e.id, sourceNodeId: e.source, targetNodeId: e.target, points: [boundary(a, b), boundary(b, a)],
      color: e.kind === "tree" ? "#d8b37d" : "#7fbdae", width: 1.5, opacity: .6,
      kind: e.kind === "tree" ? "edge" as const : "graph-link" as const, dash: e.kind === "tree" ? [5, 4] : undefined };
  });
  const boxes = [...nodes, ...groups];
  const bounds = boxes.reduce((b, n) => ({ minX: Math.min(b.minX, n.x), minY: Math.min(b.minY, n.y),
    maxX: Math.max(b.maxX, n.x + n.width), maxY: Math.max(b.maxY, n.y + n.height) }),
  boxes.length ? { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity } : { minX: 0, minY: 0, maxX: 0, maxY: 0 });
  return { revision: `${snapshot.mode}:${snapshot.steps}`, nodes, groups, labels,
    edges: links.filter(e => e.kind === "edge"), graphLinks: links.filter(e => e.kind === "graph-link"), bounds };
}

/** Group header is an interaction handle, not a fake physics node. Nested headers win. */
export function hitForceGroupHeader(snapshot: ForceSnapshot, point: { x: number; y: number }): string | null {
  for (const g of [...snapshot.groups].sort((a, b) => a.members.length - b.members.length)) {
    if (point.x >= g.x && point.x <= g.x + g.w && point.y >= g.y && point.y <= g.y + 28) return g.id;
  }
  return null;
}

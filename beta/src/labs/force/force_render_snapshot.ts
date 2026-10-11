import type { PaintCommand, PaintStyle } from "../../rendering/webgl_scene_tiles";
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
  const commands: PaintCommand[] = [];
  const style = (fill = "none", stroke = "none", width = 1, dash: number[] = [], opacity = 1): PaintStyle => ({
    fill, stroke, width, dash, opacity, fillOpacity: 1, strokeOpacity: 1,
    cap: "round", join: "round", dashOffset: 0, fillRule: "nonzero", strokeFirst: false,
  });
  const rectPath = (x: number, y: number, w: number, h: number, r = 0) =>
    `M${x+r} ${y}H${x+w-r}Q${x+w} ${y} ${x+w} ${y+r}V${y+h-r}Q${x+w} ${y+h} ${x+w-r} ${y+h}H${x+r}Q${x} ${y+h} ${x} ${y+h-r}V${y+r}Q${x} ${y} ${x+r} ${y}Z`;
  const box = (x: number, y: number, width: number, height: number, paint: PaintStyle, radius = 0, nodeId?: string) => {
    commands.push({ kind: "path", path: rectPath(x,y,width,height,radius), bounds: {x,y,width,height},
      matrix: [1,0,0,1,0,0], style: paint, nodeId });
  };
  for (const g of groups) {
    box(g.x,g.y,g.width,g.height,style(g.fill,g.stroke,g.strokeWidth,g.dash),g.radius);
    box(g.x,g.y,g.width,g.headerHeight,style(g.headerFill));
  }
  for (const link of links) {
    const [a,b] = link.points;
    commands.push({kind:"path", path:`M${a.x} ${a.y}L${b.x} ${b.y}`,
      bounds:{x:Math.min(a.x,b.x)-2,y:Math.min(a.y,b.y)-2,width:Math.abs(a.x-b.x)+4,height:Math.abs(a.y-b.y)+4},
      matrix:[1,0,0,1,0,0],style:style("none",link.color,link.width,link.dash,link.opacity),
      sourceNodeId:link.sourceNodeId,targetNodeId:link.targetNodeId});
  }
  const label = (lines: string[], x: number, y: number, width: number, fontSize: number, color: string, nodeId?: string) => {
    lines.forEach((text,index) => commands.push({kind:"text",text,x,y:y+fontSize*(index+1),
      font:`${fontSize}px system-ui`,fontSize, bounds:{x,y:y+fontSize*index,width,height:fontSize*1.3},
      matrix:[1,0,0,1,0,0],style:style(color),nodeId}));
  };
  for (const n of nodes) {
    box(n.x,n.y,n.width,n.height,style(n.fill,n.stroke,n.strokeWidth,n.strokeDash),n.radius,n.id);
    label(n.labelLines,n.x+8,n.y+(n.height-n.labelLines.length*16)/2-3,n.width-16,n.fontSize,n.textColor,n.id);
  }
  for (const l of labels) label(l.lines,l.x,l.y,l.width,l.fontSize,l.color);
  return { paintScene: {commands}, revision: `${snapshot.mode}:${snapshot.steps}`, nodes, groups, labels,
    edges: links.filter(e => e.kind === "edge"), graphLinks: links.filter(e => e.kind === "graph-link"), bounds };
}

/** Group header is an interaction handle, not a fake physics node. Nested headers win. */
export function hitForceGroupHeader(snapshot: ForceSnapshot, point: { x: number; y: number }): string | null {
  for (const g of [...snapshot.groups].sort((a, b) => a.members.length - b.members.length)) {
    if (point.x >= g.x && point.x <= g.x + g.w && point.y >= g.y && point.y <= g.y + 28) return g.id;
  }
  return null;
}

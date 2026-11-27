import RBush from "rbush";
import { PaintSlots } from "./paint_slots";
/**
 * Retained vector paint commands, rasterized only for the camera's working set.
 * SVG is the appearance authority, not a bitmap stretched over the whole map.
 * Paths keep their original Bezier commands; hit geometry is a separate concern.
 */
export interface PaintBounds { x: number; y: number; width: number; height: number }
export type PaintMatrix = [number, number, number, number, number, number];
export interface PaintStyle {
  fill: string; stroke: string; width: number; opacity: number;
  fillOpacity: number; strokeOpacity: number;
  cap: CanvasLineCap; join: CanvasLineJoin; dash: number[]; dashOffset: number;
  fillRule: CanvasFillRule; strokeFirst: boolean;
}
export interface PaintCommand {
  bounds: PaintBounds;
  matrix: PaintMatrix;
  style: PaintStyle;
  nodeId?: string;
  groupId?: string;
  /** False for associated edge labels; those stay visible during node editing. */
  editorBody?: boolean;
  sourceNodeId?: string;
  targetNodeId?: string;
  kind: "path" | "text";
  path?: string;
  text?: string;
  x?: number; y?: number;
  font?: string; fontSize?: number; decoration?: string; letterSpacing?: string;
}
export interface PaintScene { commands: PaintCommand[] }
export interface TileCamera { x: number; y: number; zoom: number }

export function sceneWorldBounds(box: PaintBounds, width: number, height: number, pad = 32) {
  return { minX: Math.min(0, box.x-pad), minY: Math.min(0, box.y-pad),
    maxX: Math.max(width,box.x+box.width+pad), maxY: Math.max(height,box.y+box.height+pad) };
}

/** Replace only affected node paint, retaining the scene's stacking order. */
export function replaceNodePaint(scene: PaintScene, updates: PaintScene, ids: Set<string>): PaintScene {
  const byId = new Map<string, PaintCommand[]>();
  updates.commands.forEach((command) => {
    if (!command.nodeId) return;
    const bucket = byId.get(command.nodeId) || [];
    bucket.push(command); byId.set(command.nodeId,bucket);
  });
  const inserted = new Set<string>();
  const commands = scene.commands.flatMap((command) => {
    if (!command.nodeId || !ids.has(command.nodeId)) return [command];
    if (inserted.has(command.nodeId)) return [];
    inserted.add(command.nodeId);
    return byId.get(command.nodeId) || [];
  });
  byId.forEach((paint,id) => { if (!inserted.has(id)) commands.push(...paint); });
  return {commands};
}

/** Disperse's drag preview moves retained paint as well as its hit geometry. */
export function translatePaintScene(scene: PaintScene, moved: Set<string>, delta: {x:number;y:number}): PaintScene {
  return {commands:scene.commands.map((command) => {
    if (command.nodeId && moved.has(command.nodeId)) {
      return {...command, matrix:[...command.matrix.slice(0,4),command.matrix[4]+delta.x,command.matrix[5]+delta.y] as PaintMatrix,
        bounds:{...command.bounds,x:command.bounds.x+delta.x,y:command.bounds.y+delta.y}};
    }
    const source = Boolean(command.sourceNodeId && moved.has(command.sourceNodeId));
    const target = Boolean(command.targetNodeId && moved.has(command.targetNodeId));
    if (!source && !target) return command;
    // Disperse edges are straight paths. Tree curves are not approximated or
    // altered here; their final paths remain owned by the canonical layout.
    const match = /^M\s*([\d.e+-]+)[ ,]+([\d.e+-]+)\s*L\s*([\d.e+-]+)[ ,]+([\d.e+-]+)$/i.exec(command.path || "");
    if (!match) return command;
    const x1=Number(match[1])+(source?delta.x:0), y1=Number(match[2])+(source?delta.y:0);
    const x2=Number(match[3])+(target?delta.x:0), y2=Number(match[4])+(target?delta.y:0);
    const pad=Math.max(3,command.style.width*2);
    return {...command,path:`M ${x1} ${y1} L ${x2} ${y2}`,
      bounds:{x:Math.min(x1,x2)-pad,y:Math.min(y1,y2)-pad,width:Math.abs(x2-x1)+pad*2,height:Math.abs(y2-y1)+pad*2}};
  })};
}

const IDENTITY: PaintMatrix = [1, 0, 0, 1, 0, 0];
const TILE_PIXELS = 512;
const GUTTER = 2;
const CACHE_LIMIT = 64;
/**
 * Rasterising a tile (Canvas 2D paint plus a texture upload) costs milliseconds.
 * A frame spends at most this long on tiles that an already cached tile of another
 * scale can stand in for; the rest follow on the next frames.
 */
const RASTER_BUDGET_MS = 6;

export function intersects(a: PaintBounds, b: PaintBounds): boolean {
  return a.x <= b.x + b.width && a.x + a.width >= b.x &&
    a.y <= b.y + b.height && a.y + a.height >= b.y;
}

export function cameraBounds(camera: TileCamera, width: number, height: number, overscan = 0): PaintBounds {
  return { x: (-camera.x - overscan) / camera.zoom, y: (-camera.y - overscan) / camera.zoom,
    width: (width + overscan * 2) / camera.zoom, height: (height + overscan * 2) / camera.zoom };
}

export function tileCoordinates(bounds: PaintBounds, scale: number): Array<{ x: number; y: number }> {
  const size = TILE_PIXELS / scale;
  const result: Array<{ x: number; y: number }> = [];
  for (let y = Math.floor(bounds.y / size); y <= Math.floor((bounds.y + bounds.height) / size); y++) {
    for (let x = Math.floor(bounds.x / size); x <= Math.floor((bounds.x + bounds.width) / size); x++) result.push({ x, y });
  }
  return result;
}

interface PaintIndexEntry { minX: number; minY: number; maxX: number; maxY: number; slot: number }
/** A long edge is indexed by its bounds, never added to an all-query overflow
 * bucket. Both updates and viewport queries use the same spatial hierarchy. */
export class PaintIndex {
  private tree = new RBush<PaintIndexEntry>();
  private entries = new Map<number, PaintIndexEntry>();
  constructor(private commands: PaintCommand[]) {
    const entries = commands.map((command, slot) => this.entry(slot, command));
    entries.forEach(entry => this.entries.set(entry.slot, entry));
    this.tree.load(entries);
  }
  private entry(slot: number, command: PaintCommand): PaintIndexEntry {
    const b = command.bounds;
    return { minX: b.x, minY: b.y, maxX: b.x + b.width, maxY: b.y + b.height, slot };
  }
  remove(slot: number): void {
    const previous = this.entries.get(slot);
    if (previous) { this.tree.remove(previous); this.entries.delete(slot); }
  }
  replace(slot: number, command: PaintCommand): void {
    this.remove(slot); this.commands[slot] = command;
    const entry = this.entry(slot, command);
    this.entries.set(slot, entry); this.tree.insert(entry);
  }
  query(bounds: PaintBounds): number[] {
    return this.tree.search({ minX: bounds.x, minY: bounds.y, maxX: bounds.x + bounds.width, maxY: bounds.y + bounds.height })
      .map(entry => entry.slot).sort((a, b) => a - b);
  }
}

function multiply(a: PaintMatrix, b: PaintMatrix): PaintMatrix {
  return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3],
    a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
}
function elementMatrix(element: SVGGraphicsElement, root: SVGSVGElement): PaintMatrix {
  let matrix: PaintMatrix = [...IDENTITY];
  for (let current: Element | null = element; current && current !== root; current = current.parentElement) {
    const transforms = (current as SVGGraphicsElement).transform?.baseVal;
    let local: PaintMatrix = [...IDENTITY];
    if (transforms) for (let i = 0; i < transforms.numberOfItems; i++) {
      const m = transforms.getItem(i).matrix;
      local = multiply(local, [m.a, m.b, m.c, m.d, m.e, m.f]);
    }
    matrix = multiply(local, matrix);
  }
  return matrix;
}
function transformedBounds(b: PaintBounds, m: PaintMatrix, pad: number): PaintBounds {
  const corners = [[b.x,b.y], [b.x+b.width,b.y], [b.x,b.y+b.height], [b.x+b.width,b.y+b.height]];
  const xs = corners.map(([x,y]) => m[0]*x!+m[2]*y!+m[4]);
  const ys = corners.map(([x,y]) => m[1]*x!+m[3]*y!+m[5]);
  const x = Math.min(...xs)-pad, y = Math.min(...ys)-pad;
  return { x, y, width: Math.max(...xs)+pad-x, height: Math.max(...ys)+pad-y };
}
function paintStyle(element: Element): PaintStyle {
  const css = getComputedStyle(element);
  return { fill: css.fill, stroke: css.stroke, width: parseFloat(css.strokeWidth) || 0,
    opacity: Number(css.opacity), fillOpacity: Number(css.fillOpacity), strokeOpacity: Number(css.strokeOpacity),
    cap: css.strokeLinecap as CanvasLineCap, join: css.strokeLinejoin as CanvasLineJoin,
    dash: css.strokeDasharray === "none" ? [] : css.strokeDasharray.split(/[ ,]+/).map(parseFloat).filter(Number.isFinite),
    dashOffset: parseFloat(css.strokeDashoffset) || 0, fillRule: css.fillRule as CanvasFillRule,
    strokeFirst: css.paintOrder.startsWith("stroke") };
}
function hasPaint(color: string): boolean {
  return Boolean(color) && color !== "none" && color !== "transparent" && !/rgba\([^)]*,\s*0\s*\)$/.test(color);
}

function shapePath(element: SVGGeometryElement): string {
  const n = (key: string) => parseFloat(element.getAttribute(key) || "0");
  switch (element.tagName.toLowerCase()) {
    case "path": return element.getAttribute("d") || "";
    case "line": return `M ${n("x1")} ${n("y1")} L ${n("x2")} ${n("y2")}`;
    case "polygon": case "polyline": return `M ${element.getAttribute("points") || "0 0"}${element.tagName.toLowerCase() === "polygon" ? " Z" : ""}`;
    case "circle": case "ellipse": {
      const rx = n(element.tagName.toLowerCase() === "circle" ? "r" : "rx");
      const ry = n(element.tagName.toLowerCase() === "circle" ? "r" : "ry");
      const x = n("cx"), y = n("cy");
      return `M ${x-rx} ${y} A ${rx} ${ry} 0 1 0 ${x+rx} ${y} A ${rx} ${ry} 0 1 0 ${x-rx} ${y} Z`;
    }
    case "rect": {
      const x=n("x"), y=n("y"), w=n("width"), h=n("height");
      const rx=Math.min(w/2, n("rx") || n("ry")), ry=Math.min(h/2, n("ry") || rx);
      return `M ${x+rx} ${y} H ${x+w-rx} A ${rx} ${ry} 0 0 1 ${x+w} ${y+ry} V ${y+h-ry} A ${rx} ${ry} 0 0 1 ${x+w-rx} ${y+h} H ${x+rx} A ${rx} ${ry} 0 0 1 ${x} ${y+h-ry} V ${y+ry} A ${rx} ${ry} 0 0 1 ${x+rx} ${y} Z`;
    }
    default: return "";
  }
}

const captureCaches = new WeakMap<SVGSVGElement, WeakMap<SVGGraphicsElement, { key: string; commands: PaintCommand[] }>>();
const captureNodeElements = new WeakMap<SVGSVGElement, Map<string, SVGGraphicsElement[]>>();
const captureDefinitions = new WeakMap<SVGSVGElement, string>();
const captureOwners = new WeakMap<SVGGraphicsElement, string>();
export function capturedNodeElements(root: SVGSVGElement, id: string): readonly SVGGraphicsElement[] {
  return captureNodeElements.get(root)?.get(id) || [];
}
/** A replaced retained fragment invalidates ownership as well as cached paint. */
export function refreshCapturedNodeFragment(root: SVGSVGElement, id: string, fragment: SVGGElement): void {
  const owners = captureNodeElements.get(root);
  if (!owners) return;
  const retained = (owners.get(id) || []).filter(element => element.isConnected && !fragment.contains(element));
  for (const element of fragment.querySelectorAll<SVGGraphicsElement>("path,rect,circle,ellipse,line,polygon,polyline,text")) {
    if (element.closest("defs,marker,clipPath,mask,.link-port-controls")) continue;
    captureOwners.set(element, id); retained.push(element);
  }
  owners.set(id, retained);
}
/** Measure only the changed paint under the same SVG/ancestor CSS context.
 * The retained full SVG stays display:none; exposing it for getBBox/focus would
 * make each small edit lay out every retained node. The temporary sibling is
 * removed synchronously, before a frame or input can observe it. */
export function captureHiddenNodePaint(root: SVGSVGElement, ids: Set<string>): PaintScene {
  if (!root.hasAttribute('hidden')) return captureSvgPaintScene(root, ids, true);
  const owners = captureNodeElements.get(root);
  if (!owners || !root.parentElement) throw new Error('Partial capture requires an attached, previously captured SVG');
  const stage = root.cloneNode(false) as SVGSVGElement;
  stage.removeAttribute('hidden');
  stage.style.position = 'absolute'; stage.style.opacity = '0'; stage.style.pointerEvents = 'none';
  stage.setAttribute('aria-hidden', 'true'); stage.dataset.captureStage = '';
  const definitions = captureDefinitions.get(root) || '';
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = definitions; stage.append(defs);
  const ancestors = new Map<Element, Element>([[root, stage]]);
  const parentClone = (element: Element): Element => {
    const previous = ancestors.get(element); if (previous) return previous;
    if (!element.parentElement) throw new Error('Detached capture element');
    const copy = element.cloneNode(false) as Element;
    parentClone(element.parentElement).append(copy); ancestors.set(element, copy); return copy;
  };
  const copied = new Map<string, SVGGraphicsElement[]>();
  const cache = new WeakMap<SVGGraphicsElement, { key: string; commands: PaintCommand[] }>();
  const originalCache = captureCaches.get(root);
  const originals = new Map<SVGGraphicsElement, SVGGraphicsElement>();
  for (const id of ids) {
    const elements: SVGGraphicsElement[] = [];
    for (const element of owners.get(id) || []) {
      const copy = element.cloneNode(true) as SVGGraphicsElement;
      parentClone(element.parentElement!).append(copy); elements.push(copy);
      captureOwners.set(copy, id); originals.set(copy, element);
      const previous = originalCache?.get(element); if (previous) cache.set(copy, previous);
    }
    copied.set(id, elements);
  }
  captureNodeElements.set(stage, copied); captureDefinitions.set(stage, definitions); captureCaches.set(stage, cache);
  root.parentElement.append(stage);
  try {
    const result = captureSvgPaintScene(stage, ids, true);
    for (const [copy, original] of originals) { const value = cache.get(copy); if (value) originalCache?.set(original, value); }
    return result;
  } finally { stage.remove(); }
}
/** Capture changed SVG elements only during a local edit. Full renders reset CSS dependencies. */
export function captureSvgPaintScene(root: SVGSVGElement, onlyNodeIds?: Set<string>, incremental = false): PaintScene {
  // A partial capture needs ownership/order from a complete scene first.
  if (onlyNodeIds && !captureNodeElements.has(root)) captureSvgPaintScene(root);
  let cache = incremental ? captureCaches.get(root) : undefined;
  if (!cache) { cache = new WeakMap(); captureCaches.set(root, cache); }
  const markerDefinitions = onlyNodeIds ? (captureDefinitions.get(root) || "")
    : [...root.querySelectorAll("defs")].map(element => element.innerHTML).join("");
  if (!onlyNodeIds) captureDefinitions.set(root, markerDefinitions);
  const commands: PaintCommand[] = [];
  let currentNodeId: string | undefined;
  if (!onlyNodeIds && root.querySelector("foreignObject, image, use")) {
    throw new Error("This scene contains embedded HTML/images; preserving its SVG appearance requires SVG rendering.");
  }
  let nodeElements = captureNodeElements.get(root);
  if (!onlyNodeIds || !nodeElements) {
    nodeElements = new Map(); captureNodeElements.set(root, nodeElements);
  }
  const elements = onlyNodeIds
    ? Array.from(onlyNodeIds).flatMap(id => nodeElements!.get(id) || [])
    : Array.from(root.querySelectorAll<SVGGraphicsElement>("path, rect, circle, ellipse, line, polygon, polyline, text"));
  elements.forEach((element) => {
    if (element.classList.contains("node-hit")) currentNodeId = element.getAttribute("data-node-id") || undefined;
    if (element.closest("defs, marker, clipPath, mask, .link-port-controls") || element.classList.contains("graph-link-hit")) return;
    const nodeId = (onlyNodeIds ? captureOwners.get(element) : undefined) || element.getAttribute("data-node-id") ||
      (element.matches(".alias-badge,.confidence-badge,.confidence-badge-text,.status-badge,.status-badge-text,.lock-icon,[data-collapse-node-id]") ? currentNodeId : undefined);
    if (onlyNodeIds && (!nodeId || !onlyNodeIds.has(nodeId))) return;
    if (!onlyNodeIds && nodeId) {
      const owned = nodeElements!.get(nodeId) || [];
      owned.push(element); nodeElements!.set(nodeId, owned); captureOwners.set(element, nodeId);
    }
    const key = `${nodeId || ""}:${element.outerHTML}:${element.hasAttribute("marker-end") || element.hasAttribute("marker-start") ? markerDefinitions : ""}`;
    const retained = cache!.get(element);
    if (retained?.key === key) { commands.push(...retained.commands); return; }
    const start = commands.length;
    const editorBody = element.matches(".node-hit,.node-visual-box,.label-root,.label-node");
    const css = getComputedStyle(element);
    if (css.display === "none" || css.visibility === "hidden") return;
    const style = paintStyle(element);
    if (!hasPaint(style.fill) && !hasPaint(style.stroke) || style.opacity === 0) return;
    const matrix = elementMatrix(element, root);
    const box = element.getBBox();
    const pad = Math.max(3, style.width * 2);
    const bounds = transformedBounds(box, matrix, pad);
    if (element instanceof SVGTextElement) {
      const spans = [...element.querySelectorAll<SVGTSpanElement>("tspan")];
      const runs: SVGTextContentElement[] = spans.length ? spans : [element];
      runs.forEach((run) => {
        const text = run.textContent || "";
        if (!text || !run.getNumberOfChars()) return;
        const position = run.getStartPositionOfChar(0);
        const runCss = getComputedStyle(run);
        commands.push({ kind: "text", bounds, matrix, style: { ...paintStyle(run), opacity: paintStyle(run).opacity * (run === element ? 1 : style.opacity) }, nodeId, editorBody,
          text, x: position.x, y: position.y,
          font: `${runCss.fontStyle} ${runCss.fontWeight} ${runCss.fontSize} ${runCss.fontFamily}`,
          fontSize: parseFloat(runCss.fontSize), decoration: runCss.textDecorationLine,
          letterSpacing: runCss.letterSpacing });
      });
    } else if (element instanceof SVGGeometryElement) {
      const path = shapePath(element);
      if (path) commands.push({ kind: "path", path, bounds, matrix, style, nodeId, editorBody, groupId: element.getAttribute("data-group-id") || undefined,
        sourceNodeId:element.getAttribute("data-source-node-id") || element.getAttribute("data-parent-node-id") || undefined,
        targetNodeId:element.getAttribute("data-target-node-id") || element.getAttribute("data-child-node-id") || undefined });
      // Preserve SVG marker geometry, dimensions and direction rather than
      // replacing every marker by an arbitrary fixed-size triangle.
      for (const end of ["start", "end"] as const) {
        const reference = css.getPropertyValue(`marker-${end}`);
        const id = /#([^\s"')]+)/.exec(reference)?.[1];
        const marker = id ? root.querySelector<SVGMarkerElement>(`marker[id="${CSS.escape(id)}"]`) : null;
        if (!marker) continue;
        const length = element.getTotalLength();
        if (!(length > 0)) continue;
        const a = element.getPointAtLength(end === "start" ? 0 : Math.max(0, length - 0.1));
        const b = element.getPointAtLength(end === "start" ? Math.min(0.1, length) : length);
        const point = end === "start" ? a : b;
        let angle = Math.atan2(b.y-a.y, b.x-a.x);
        const orient = marker.getAttribute("orient") || "0";
        if (orient === "auto-start-reverse" && end === "start") angle += Math.PI;
        else if (!orient.startsWith("auto")) angle = parseFloat(orient)*Math.PI/180;
        const vb = marker.viewBox.baseVal;
        const units = marker.getAttribute("markerUnits") === "userSpaceOnUse" ? 1 : style.width;
        const scale = units * Math.min(marker.markerWidth.baseVal.value/(vb.width || 1), marker.markerHeight.baseVal.value/(vb.height || 1));
        const rotate: PaintMatrix = [Math.cos(angle)*scale,Math.sin(angle)*scale,-Math.sin(angle)*scale,Math.cos(angle)*scale,point.x,point.y];
        const markerMatrix = multiply(matrix, multiply(rotate, [1,0,0,1,-marker.refX.baseVal.value,-marker.refY.baseVal.value]));
        marker.querySelectorAll<SVGGeometryElement>("path, polygon, rect, circle").forEach((child) => {
          commands.push({ kind: "path", path: shapePath(child), matrix: markerMatrix,
            bounds: transformedBounds(child.getBBox(), markerMatrix, pad), style: { ...paintStyle(child), opacity: paintStyle(child).opacity * style.opacity },
            nodeId:element.getAttribute(end === "start" ? "data-source-node-id" : "data-target-node-id") || undefined });
        });
      }
    }
    cache!.set(element, { key, commands: commands.slice(start) });
  });
  return { commands };
}

function paint(context: CanvasRenderingContext2D, command: PaintCommand, path?: Path2D): void {
  const s = command.style;
  context.save();
  context.transform(...command.matrix);
  context.lineWidth = s.width;
  context.lineCap = s.cap;
  context.lineJoin = s.join;
  context.setLineDash(s.dash);
  context.lineDashOffset = s.dashOffset;
  if (command.kind === "text") {
    context.font = command.font!;
    context.textBaseline = "alphabetic";
    context.textAlign = "left";
    if ("letterSpacing" in context) (context as CanvasRenderingContext2D & {letterSpacing: string}).letterSpacing = command.letterSpacing === "normal" ? "0px" : command.letterSpacing || "0px";
  }
  const fill = () => {
    if (!hasPaint(s.fill)) return;
    context.globalAlpha = s.opacity*s.fillOpacity;
    context.fillStyle = s.fill;
    if (path) context.fill(path, s.fillRule);
    else context.fillText(command.text!, command.x!, command.y!);
  };
  const stroke = () => {
    if (!hasPaint(s.stroke) || s.width <= 0) return;
    context.globalAlpha = s.opacity*s.strokeOpacity;
    context.strokeStyle = s.stroke;
    if (path) context.stroke(path);
    else context.strokeText(command.text!, command.x!, command.y!);
  };
  if (s.strokeFirst) { stroke(); fill(); } else { fill(); stroke(); }
  if (command.kind === "text" && command.decoration && command.decoration !== "none") {
    const size = command.fontSize || 14, width = context.measureText(command.text!).width;
    context.fillStyle = s.fill; context.globalAlpha = s.opacity*s.fillOpacity;
    if (command.decoration.includes("underline")) context.fillRect(command.x!, command.y!+size*0.12, width, Math.max(1,size/16));
    if (command.decoration.includes("line-through")) context.fillRect(command.x!, command.y!-size*0.3, width, Math.max(1,size/16));
  }
  context.restore();
}

interface Tile { texture: WebGLTexture; x: number; y: number; size: number; scale: number; used: number }

/**
 * Bounded GPU texture cache. Every visible area shows complete content: a tile not yet
 * rasterised at the current scale is either rasterised in this frame, or, when a cached
 * tile of another scale covers it and the frame's raster budget is spent, drawn from
 * that tile (scaled) until a later frame replaces it.
 */
export class WebGLSceneTiles {
  private slots = new PaintSlots([]);
  private get scene(): PaintScene { return this.slots.scene; }
  private index = new PaintIndex([]);
  private paths: Array<Path2D | undefined> = [];
  private tiles = new Map<string, Tile>();
  private scratch = document.createElement("canvas");
  private scale = 0;
  private clock = 0;
  private editingNodeId: string | null = null;
  private get nodeSlots(): Map<string, number[]> { return this.slots.owners; }
  textureUploads = 0;
  visibleTextCount = 0;
  /** True when the last draw left current-scale tiles to a later frame. */
  pending = false;
  private now: () => number = () => performance.now();
  constructor(private gl: WebGL2RenderingContext) {
    this.scratch.width = this.scratch.height = TILE_PIXELS + GUTTER*2;
  }
  setScene(scene: PaintScene): void {
    // Content equality also covers regenerated edge fragments and refreshed CSS.
    // Reuse unchanged paint/paths and invalidate the union of old/new dirty bounds.
    const buckets = new Map<string, PaintCommand[]>();
    const previousPaths = new Map<PaintCommand, Path2D | undefined>();
    this.forEachPaint((command, slot) => previousPaths.set(command, this.paths[slot]));
    const previousOrder = new Map(this.scene.commands.map((command, index) => [command, index]));
    for (const command of this.scene.commands) {
      const key = JSON.stringify(command);
      const bucket = buckets.get(key) || [];
      bucket.push(command); buckets.set(key, bucket);
    }
    const retained = new Set<PaintCommand>();
    const dirty: PaintBounds[] = [];
    let lastIndex = -1;
    let reordered = false;
    const commands = scene.commands.map(command => {
      const old = buckets.get(JSON.stringify(command))?.shift();
      if (!old) { dirty.push(command.bounds); return command; }
      retained.add(old);
      const index = previousOrder.get(old)!;
      if (index < lastIndex) reordered = true;
      lastIndex = index;
      return old;
    });
    this.scene.commands.forEach(command => { if (!retained.has(command)) dirty.push(command.bounds); });
    // A stacking-order change can alter overlaps even when geometry is identical.
    if (reordered) retained.forEach(command => dirty.push(command.bounds));
    this.tiles.forEach((tile, key) => {
      const gutter = GUTTER / tile.scale;
      if (!dirty.some(box => intersects(box, { x: tile.x-gutter, y: tile.y-gutter, width: tile.size+gutter*2, height: tile.size+gutter*2 }))) return;
      this.gl.deleteTexture(tile.texture); this.tiles.delete(key);
    });
    this.slots = new PaintSlots(commands);
    this.index = new PaintIndex(this.slots.commands);
    this.paths = commands.map(command => previousPaths.get(command) || (command.kind === "path" ? new Path2D(command.path) : undefined));

  }
  /** Stable handles for drag transactions; dense snapshot indices are not handles. */
  forEachPaint(visit: (command: PaintCommand, slot: number) => void): void {
    this.slots.commands.forEach(visit);
  }
  /** Patch stable paint slots and their index memberships, preserving z-order. */
  updateCommands(updates: Map<number, PaintCommand>): PaintScene {
    const dirty: PaintBounds[] = [];
    updates.forEach((command, index) => {
      const old = this.slots.commands[index];
      if (!old) throw new Error(`Unknown paint slot ${index}`);
      if (command.nodeId !== old.nodeId) throw new Error("Paint ownership requires setScene");
      dirty.push(old.bounds, command.bounds);
      this.index.replace(index, command);
      this.slots.set(index, command);
      if (old.kind !== command.kind || old.path !== command.path) {
        this.paths[index] = command.kind === "path" ? new Path2D(command.path) : undefined;
      }
    });
    this.invalidateBounds(dirty);
    return this.scene;
  }
  private invalidateBounds(dirty: PaintBounds[]): void {
    this.tiles.forEach((tile,key) => {
      const gutter = GUTTER / tile.scale;
      if (!dirty.some(box => intersects(box, {x:tile.x-gutter,y:tile.y-gutter,width:tile.size+gutter*2,height:tile.size+gutter*2}))) return;
      this.gl.deleteTexture(tile.texture); this.tiles.delete(key);
    });
  }
  updateNodePaint(updates: PaintScene, ids: Set<string>): PaintScene {
    const byId = new Map<string, PaintCommand[]>();
    updates.commands.forEach(command => {
      if (!command.nodeId || !ids.has(command.nodeId)) return;
      const bucket = byId.get(command.nodeId) || [];
      bucket.push(command); byId.set(command.nodeId, bucket);
    });
    const dirty: PaintBounds[] = [];
    for (const id of ids) {
      this.slots.replace(id, byId.get(id) || [], (slot, command) => {
        const old = this.slots.commands[slot];
        if (old) dirty.push(old.bounds);
        dirty.push(command.bounds);
        this.index.replace(slot, command);
        if (!old || old.kind !== command.kind || old.path !== command.path) {
          this.paths[slot] = command.kind === "path" ? new Path2D(command.path) : undefined;
        }
      }, slot => {
        dirty.push(this.slots.commands[slot]!.bounds);
        this.index.remove(slot); delete this.paths[slot];
      });
    }
    this.invalidateBounds(dirty);
    return this.scene;
  }

  setEditingNode(id: string | null): void {
    if (id === this.editingNodeId) return;
    const slots = new Set([...(this.nodeSlots.get(id || "") || []), ...(this.nodeSlots.get(this.editingNodeId || "") || [])]);
    const dirty = Array.from(slots, slot => this.slots.commands[slot]!).filter(command => command.editorBody !== false).map(command => command.bounds);
    this.editingNodeId = id;
    this.tiles.forEach((tile,key) => {
      const gutter = GUTTER/tile.scale;
      if (!dirty.some((box) => intersects(box,{x:tile.x-gutter,y:tile.y-gutter,width:tile.size+gutter*2,height:tile.size+gutter*2}))) return;
      this.gl.deleteTexture(tile.texture); this.tiles.delete(key);
    });
  }
  refine(camera: TileCamera, dpr: number): void {
    const next = Math.pow(2, Math.ceil(Math.log2(Math.max(0.015625, camera.zoom*dpr))));
    // Tiles of the previous scale stay cached: they stand in until this scale's tiles exist.
    this.scale = next;
  }
  clear(): void {
    this.tiles.forEach((tile) => this.gl.deleteTexture(tile.texture));
    this.tiles.clear();
  }
  get cacheSize(): number { return this.tiles.size; }
  /** Cached tiles of other scales that together cover `bounds`, or null when part of it is uncovered. */
  private standInsFor(bounds: PaintBounds): Array<[string, Tile]> | null {
    const found: Array<[string, Tile]> = [];
    for (const [key, tile] of this.tiles) {
      if (tile.scale === this.scale) continue;
      if (tile.x < bounds.x + bounds.width && tile.x + tile.size > bounds.x && tile.y < bounds.y + bounds.height && tile.y + tile.size > bounds.y) found.push([key, tile]);
    }
    if (!found.length) return null;
    // Coarser tiles first, so a finer one drawn after it wins where both exist.
    found.sort((left, right) => left[1].scale - right[1].scale);
    const covered = (px: number, py: number) => found.some(([, t]) => px >= t.x && px <= t.x + t.size && py >= t.y && py <= t.y + t.size);
    const step = bounds.width / 4;
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) if (!covered(bounds.x + i * step, bounds.y + j * step)) return null;
    return found;
  }
  private rasterise(bounds: PaintBounds): Tile {
    const size = bounds.width;
    const gutter = GUTTER/this.scale;
    const indices = this.index.query({x:bounds.x-gutter,y:bounds.y-gutter,width:size+gutter*2,height:size+gutter*2}).sort(this.slots.compare);
    const context = this.scratch.getContext("2d")!;
    context.setTransform(1,0,0,1,0,0);
    context.clearRect(0,0,this.scratch.width,this.scratch.height);
    context.setTransform(this.scale,0,0,this.scale,GUTTER-bounds.x*this.scale,GUTTER-bounds.y*this.scale);
    indices.forEach((index) => {
      const command = this.slots.commands[index]!;
      if (command.nodeId === this.editingNodeId && command.editorBody !== false) return;
      paint(context, command, this.paths[index]);
    });
    const texture = this.gl.createTexture();
    if (!texture) throw new Error("Unable to allocate a visible map tile");
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MIN_FILTER,this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_MAG_FILTER,this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_S,this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D,this.gl.TEXTURE_WRAP_T,this.gl.CLAMP_TO_EDGE);
    this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    this.gl.texImage2D(this.gl.TEXTURE_2D,0,this.gl.RGBA,this.gl.RGBA,this.gl.UNSIGNED_BYTE,this.scratch);
    this.textureUploads++;
    return { texture, x:bounds.x, y:bounds.y, size, scale:this.scale, used:++this.clock };
  }
  draw(camera: TileCamera, width: number, height: number, dpr: number,
    render: (tile: Tile, gutterUv: number, clip?: PaintBounds) => void): number {
    if (!this.scale) this.refine(camera, dpr);
    const viewport = cameraBounds(camera, width, height);
    this.visibleTextCount = this.index.query(viewport).filter((i) => this.slots.commands[i]!.kind === "text" && this.slots.commands[i]!.nodeId !== this.editingNodeId).length;
    // Work is proportional to viewport pixels, not the dimensions of the map.
    // Bound extreme zoom changes before an idle refinement to avoid huge grids.
    if (this.scale / (camera.zoom*dpr) > 4 || this.scale / (camera.zoom*dpr) < 0.25) this.refine(camera, dpr);
    const needed = tileCoordinates(cameraBounds(camera, width, height, 128), this.scale);
    const size = TILE_PIXELS/this.scale;
    const gutterUv = GUTTER/(TILE_PIXELS+GUTTER*2);
    const started = this.now();
    const active = new Set<string>();
    const standIns = new Set<string>();
    let calls = 0;
    let rasterised = 0;
    this.pending = false;
    for (const {x,y} of needed) {
      const key = `${this.scale}:${x}:${y}`; active.add(key);
      const bounds = { x: x*size, y: y*size, width: size, height: size };
      let tile = this.tiles.get(key);
      if (!tile) {
        // At least one tile per frame, so a slow tile cannot stall progress.
        const cover = rasterised > 0 && this.now() - started >= RASTER_BUDGET_MS ? this.standInsFor(bounds) : null;
        if (cover) {
          this.pending = true;
          for (const [standInKey, standIn] of cover) {
            standIn.used = ++this.clock; standIns.add(standInKey);
            if (intersects(bounds, viewport)) { render(standIn, gutterUv, bounds); calls++; }
          }
          continue;
        }
        tile = this.rasterise(bounds);
        rasterised++;
        this.tiles.set(key, tile);
      }
      tile.used = ++this.clock;
      if (intersects(bounds,viewport)) { render(tile,gutterUv); calls++; }
    }
    standIns.forEach((key) => active.add(key));
    // Never evict this frame's working set, even on a large/high-DPR display.
    const old = [...this.tiles.entries()].filter(([key]) => !active.has(key)).sort((a,b) => a[1].used-b[1].used);
    for (const [key,tile] of old) {
      if (this.tiles.size <= Math.max(CACHE_LIMIT,active.size)) break;
      this.gl.deleteTexture(tile.texture); this.tiles.delete(key);
    }
    return calls;
  }
}

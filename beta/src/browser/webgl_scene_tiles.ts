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
const INDEX_CELL = 1024;
const CACHE_LIMIT = 64;

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

// Large paths are kept in one overflow bucket instead of duplicated in thousands
// of cells. A crossing edge is found even when both endpoints are off screen.
export class PaintIndex {
  private cells = new Map<string, number[]>();
  private large: number[] = [];
  constructor(private commands: PaintCommand[]) {
    commands.forEach((command, index) => {
      const b = command.bounds;
      const x0 = Math.floor(b.x / INDEX_CELL), x1 = Math.floor((b.x + b.width) / INDEX_CELL);
      const y0 = Math.floor(b.y / INDEX_CELL), y1 = Math.floor((b.y + b.height) / INDEX_CELL);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) > 64) { this.large.push(index); return; }
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const key = `${x}:${y}`;
        const bucket = this.cells.get(key) || [];
        bucket.push(index); this.cells.set(key, bucket);
      }
    });
  }
  query(bounds: PaintBounds): number[] {
    const found = new Set(this.large);
    const x0 = Math.floor(bounds.x / INDEX_CELL), x1 = Math.floor((bounds.x + bounds.width) / INDEX_CELL);
    const y0 = Math.floor(bounds.y / INDEX_CELL), y1 = Math.floor((bounds.y + bounds.height) / INDEX_CELL);
    // Extremely distant zoom-out must not scan an unbounded empty grid.
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 4096) {
      return this.commands.map((_, index) => index).filter((index) => intersects(this.commands[index]!.bounds, bounds));
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      this.cells.get(`${x}:${y}`)?.forEach((index) => found.add(index));
    }
    return [...found].filter((index) => intersects(this.commands[index]!.bounds, bounds)).sort((a, b) => a - b);
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

/** Capture once per scene revision, while the SVG is measurable. Never on pan. */
export function captureSvgPaintScene(root: SVGSVGElement, onlyNodeIds?: Set<string>): PaintScene {
  const commands: PaintCommand[] = [];
  let currentNodeId: string | undefined;
  if (root.querySelector("foreignObject, image, use")) {
    throw new Error("This scene contains embedded HTML/images; preserving its SVG appearance requires SVG rendering.");
  }
  root.querySelectorAll<SVGGraphicsElement>("path, rect, circle, ellipse, line, polygon, polyline, text").forEach((element) => {
    if (element.classList.contains("node-hit")) currentNodeId = element.getAttribute("data-node-id") || undefined;
    if (element.closest("defs, marker, clipPath, mask, .link-port-controls") || element.classList.contains("graph-link-hit")) return;
    const nodeId = element.getAttribute("data-node-id") ||
      (element.matches(".alias-badge,.confidence-badge,.confidence-badge-text,.status-badge,.status-badge-text,.lock-icon,[data-collapse-node-id]") ? currentNodeId : undefined);
    if (onlyNodeIds && (!nodeId || !onlyNodeIds.has(nodeId))) return;
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
        commands.push({ kind: "text", bounds, matrix, style: paintStyle(run), nodeId,
          text, x: position.x, y: position.y,
          font: `${runCss.fontStyle} ${runCss.fontWeight} ${runCss.fontSize} ${runCss.fontFamily}`,
          fontSize: parseFloat(runCss.fontSize), decoration: runCss.textDecorationLine,
          letterSpacing: runCss.letterSpacing });
      });
    } else if (element instanceof SVGGeometryElement) {
      const path = shapePath(element);
      if (path) commands.push({ kind: "path", path, bounds, matrix, style, nodeId,
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
            bounds: transformedBounds(child.getBBox(), markerMatrix, pad), style: paintStyle(child),
            nodeId:element.getAttribute(end === "start" ? "data-source-node-id" : "data-target-node-id") || undefined });
        });
      }
    }
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

interface Tile { texture: WebGLTexture; x: number; y: number; size: number; used: number }

/** Bounded GPU texture cache. New visible tiles are complete before presentation. */
export class WebGLSceneTiles {
  private scene: PaintScene = { commands: [] };
  private index = new PaintIndex([]);
  private paths: Array<Path2D | undefined> = [];
  private tiles = new Map<string, Tile>();
  private scratch = document.createElement("canvas");
  private scale = 0;
  private clock = 0;
  private editingNodeId: string | null = null;
  textureUploads = 0;
  visibleTextCount = 0;
  constructor(private gl: WebGL2RenderingContext) {
    this.scratch.width = this.scratch.height = TILE_PIXELS + GUTTER*2;
  }
  setScene(scene: PaintScene): void {
    this.clear();
    this.scene = scene;
    this.index = new PaintIndex(scene.commands);
    this.paths = scene.commands.map((command) => command.kind === "path" ? new Path2D(command.path) : undefined);
  }
  updateNodePaint(updates: PaintScene, ids: Set<string>): PaintScene {
    const previousPaths = new Map(this.scene.commands.map((command,i) => [command,this.paths[i]]));
    const dirty = [...this.scene.commands,...updates.commands]
      .filter((command) => command.nodeId && ids.has(command.nodeId)).map((command) => command.bounds);
    this.tiles.forEach((tile,key) => {
      const gutter = GUTTER / this.scale;
      if (!dirty.some((box) => intersects(box,{x:tile.x-gutter,y:tile.y-gutter,width:tile.size+gutter*2,height:tile.size+gutter*2}))) return;
      this.gl.deleteTexture(tile.texture); this.tiles.delete(key);
    });
    this.scene = replaceNodePaint(this.scene,updates,ids);
    this.index = new PaintIndex(this.scene.commands);
    this.paths = this.scene.commands.map((command) => previousPaths.get(command) ||
      (command.kind === "path" ? new Path2D(command.path) : undefined));
    return this.scene;
  }
  setEditingNode(id: string | null): void {
    if (id === this.editingNodeId) return;
    this.editingNodeId = id; this.clear();
  }
  refine(camera: TileCamera, dpr: number): void {
    const next = Math.pow(2, Math.ceil(Math.log2(Math.max(0.015625, camera.zoom*dpr))));
    if (next !== this.scale) { this.clear(); this.scale = next; }
  }
  clear(): void {
    this.tiles.forEach((tile) => this.gl.deleteTexture(tile.texture));
    this.tiles.clear();
  }
  get cacheSize(): number { return this.tiles.size; }
  draw(camera: TileCamera, width: number, height: number, dpr: number,
    render: (tile: Tile, gutterUv: number) => void): number {
    if (!this.scale) this.refine(camera, dpr);
    const viewport = cameraBounds(camera, width, height);
    this.visibleTextCount = this.index.query(viewport).filter((i) => this.scene.commands[i]!.kind === "text" && this.scene.commands[i]!.nodeId !== this.editingNodeId).length;
    // Work is proportional to viewport pixels, not the dimensions of the map.
    // Bound extreme zoom changes before an idle refinement to avoid huge grids.
    if (this.scale / (camera.zoom*dpr) > 4 || this.scale / (camera.zoom*dpr) < 0.25) this.refine(camera, dpr);
    const needed = tileCoordinates(cameraBounds(camera, width, height, 128), this.scale);
    const size = TILE_PIXELS/this.scale;
    const active = new Set<string>();
    let calls = 0;
    for (const {x,y} of needed) {
      const key = `${x}:${y}`; active.add(key);
      let tile = this.tiles.get(key);
      if (!tile) {
        const bounds = { x: x*size, y: y*size, width: size, height: size };
        const gutter = GUTTER/this.scale;
        const indices = this.index.query({x:bounds.x-gutter,y:bounds.y-gutter,width:size+gutter*2,height:size+gutter*2});
        const context = this.scratch.getContext("2d")!;
        context.setTransform(1,0,0,1,0,0);
        context.clearRect(0,0,this.scratch.width,this.scratch.height);
        context.setTransform(this.scale,0,0,this.scale,GUTTER-bounds.x*this.scale,GUTTER-bounds.y*this.scale);
        indices.forEach((index) => {
          const command = this.scene.commands[index]!;
          if (command.kind === "text" && command.nodeId === this.editingNodeId) return;
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
        tile = { texture, x:bounds.x, y:bounds.y, size, used:++this.clock };
        this.tiles.set(key,tile);
      }
      tile.used = ++this.clock;
      if (intersects({x:tile.x,y:tile.y,width:size,height:size},viewport)) { render(tile,GUTTER/(TILE_PIXELS+GUTTER*2)); calls++; }
    }
    // Never evict this frame's working set, even on a large/high-DPR display.
    const old = [...this.tiles.entries()].filter(([key]) => !active.has(key)).sort((a,b) => a[1].used-b[1].used);
    for (const [key,tile] of old) {
      if (this.tiles.size <= Math.max(CACHE_LIMIT,active.size)) break;
      this.gl.deleteTexture(tile.texture); this.tiles.delete(key);
    }
    return calls;
  }
}

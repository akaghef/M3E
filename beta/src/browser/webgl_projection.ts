export type RenderNodeShape = "rect" | "circle";

export interface RenderNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  labelLines: string[];
  fontSize?: number;
  textColor?: string;
  shape: RenderNodeShape;
  fill: string;
  stroke: string;
}

export interface RenderEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  width: number;
  kind: "edge" | "graph-link";
  direction?: "none" | "forward" | "backward" | "both";
}

/** A drawable Disperse boundary; groups are not nodes and never participate in hit testing. */
export interface RenderGroupBoundary {
  id: string;
  memberIds: string[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RenderSnapshot {
  revision: string;
  nodes: RenderNode[];
  edges: RenderEdge[];
  graphLinks: RenderEdge[];
  groups: RenderGroupBoundary[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface RenderInteractionState {
  selectedNodeIds: string[];
  primarySelectedNodeId: string | null;
  hoveredNodeId: string | null;
  gestureActive: boolean;
}

export type HitResult =
  | { kind: "node"; nodeId: string }
  | { kind: "edge" | "graph-link"; edgeId: string };

/**
 * The public seam used by the viewer.  The renderer owns GPU resources only;
 * it never owns map state or applies Commands.
 */
export interface RenderingProjection {
  mount(): boolean;
  setSnapshot(snapshot: RenderSnapshot): void;
  setCamera(camera: CameraState): void;
  setInteractionState(interaction: RenderInteractionState): void;
  resize(): void;
  hitTest(clientX: number, clientY: number): HitResult | null;
  destroy(): void;
}

export interface WebGLProjectionDebugState {
  active: boolean;
  revision: string;
  nodeCount: number;
  edgeCount: number;
  graphLinkCount: number;
  camera: CameraState;
  selectedNodeIds: string[];
  drawCalls: number;
  geometryUploads: number;
  cameraUpdates: number;
}

type ProjectionOptions = {
  onUnavailable: (reason: string) => void;
  /** Context resources were rebuilt; the owner must make the projection visible again. */
  onRestored: () => void;
};

type PackedLabel = {
  nodeId: string;
  width: number;
  height: number;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
};

const COLOR_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec4 a_color;
uniform vec3 u_camera;
uniform vec2 u_viewport;
out vec4 v_color;
void main() {
  vec2 screen = a_position * u_camera.z + u_camera.xy;
  vec2 clip = vec2((screen.x / u_viewport.x) * 2.0 - 1.0, 1.0 - (screen.y / u_viewport.y) * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  v_color = a_color;
}`;

const COLOR_FRAGMENT_SHADER = `#version 300 es
precision mediump float;
in vec4 v_color;
out vec4 outColor;
void main() { outColor = v_color; }
`;

const TEXT_VERTEX_SHADER = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
uniform vec3 u_camera;
uniform vec2 u_viewport;
out vec2 v_uv;
void main() {
  vec2 screen = a_position * u_camera.z + u_camera.xy;
  vec2 clip = vec2((screen.x / u_viewport.x) * 2.0 - 1.0, 1.0 - (screen.y / u_viewport.y) * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  v_uv = a_uv;
}`;

const TEXT_FRAGMENT_SHADER = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_texture;
out vec4 outColor;
void main() { outColor = texture(u_texture, v_uv); }
`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to allocate WebGL shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Unknown shader compile failure.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("Unable to allocate WebGL program.");
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertex);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Unknown WebGL link failure.";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function rgba(color: string, alpha = 1): [number, number, number, number] {
  const normalized = color.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(normalized);
  const long = /^#([0-9a-f]{6})$/i.exec(normalized);
  if (short) {
    return [
      parseInt(short[1]![0]! + short[1]![0]!, 16) / 255,
      parseInt(short[1]![1]! + short[1]![1]!, 16) / 255,
      parseInt(short[1]![2]! + short[1]![2]!, 16) / 255,
      alpha,
    ];
  }
  if (long) {
    return [
      parseInt(long[1]!.slice(0, 2), 16) / 255,
      parseInt(long[1]!.slice(2, 4), 16) / 255,
      parseInt(long[1]!.slice(4, 6), 16) / 255,
      alpha,
    ];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+\s*([\d.]+)[,\s]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i.exec(normalized);
  if (rgb) {
    return [
      Math.max(0, Math.min(255, Number(rgb[1]))) / 255,
      Math.max(0, Math.min(255, Number(rgb[2]))) / 255,
      Math.max(0, Math.min(255, Number(rgb[3]))) / 255,
      alpha * (rgb[4] == null ? 1 : Math.max(0, Math.min(1, Number(rgb[4])))),
    ];
  }
  // Safari resolves several CSS custom properties to CSS Color 4 syntax.
  // Keep the projection visually equivalent without asking the SVG layer to
  // normalize it during an interaction.
  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/i.exec(normalized);
  if (srgb) {
    return [
      Math.max(0, Math.min(1, Number(srgb[1]))),
      Math.max(0, Math.min(1, Number(srgb[2]))),
      Math.max(0, Math.min(1, Number(srgb[3]))),
      alpha * (srgb[4] == null ? 1 : Math.max(0, Math.min(1, Number(srgb[4])))),
    ];
  }
  return [0.22, 0.24, 0.29, alpha];
}

function pushVertex(target: number[], x: number, y: number, color: [number, number, number, number]): void {
  target.push(x, y, color[0], color[1], color[2], color[3]);
}

function pushRect(target: number[], x: number, y: number, w: number, h: number, color: [number, number, number, number]): void {
  const x2 = x + w;
  const y2 = y + h;
  pushVertex(target, x, y, color);
  pushVertex(target, x2, y, color);
  pushVertex(target, x, y2, color);
  pushVertex(target, x, y2, color);
  pushVertex(target, x2, y, color);
  pushVertex(target, x2, y2, color);
}

function pushCircle(target: number[], cx: number, cy: number, radius: number, color: [number, number, number, number]): void {
  const segments = 20;
  for (let index = 0; index < segments; index += 1) {
    const a = (index / segments) * Math.PI * 2;
    const b = ((index + 1) / segments) * Math.PI * 2;
    pushVertex(target, cx, cy, color);
    pushVertex(target, cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, color);
    pushVertex(target, cx + Math.cos(b) * radius, cy + Math.sin(b) * radius, color);
  }
}

function pushSegment(target: number[], a: { x: number; y: number }, b: { x: number; y: number }, width: number, color: [number, number, number, number]): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return;
  const ox = (-dy / length) * width * 0.5;
  const oy = (dx / length) * width * 0.5;
  pushVertex(target, a.x + ox, a.y + oy, color);
  pushVertex(target, b.x + ox, b.y + oy, color);
  pushVertex(target, a.x - ox, a.y - oy, color);
  pushVertex(target, a.x - ox, a.y - oy, color);
  pushVertex(target, b.x + ox, b.y + oy, color);
  pushVertex(target, b.x - ox, b.y - oy, color);
}

function pushArrow(target: number[], from: { x: number; y: number }, to: { x: number; y: number }, color: [number, number, number, number]): void {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) return;
  const ux = dx / length;
  const uy = dy / length;
  const size = 10;
  const bx = to.x - ux * size;
  const by = to.y - uy * size;
  const ox = -uy * size * 0.55;
  const oy = ux * size * 0.55;
  pushVertex(target, to.x, to.y, color);
  pushVertex(target, bx + ox, by + oy, color);
  pushVertex(target, bx - ox, by - oy, color);
}

function pushOutline(target: number[], node: RenderNode, color: [number, number, number, number], width: number): void {
  const pad = width + 1;
  const x = node.x - pad;
  const y = node.y - pad;
  const w = node.width + pad * 2;
  const h = node.height + pad * 2;
  pushRect(target, x, y, w, width, color);
  pushRect(target, x, y + h - width, w, width, color);
  pushRect(target, x, y, width, h, color);
  pushRect(target, x + w - width, y, width, h, color);
}

function pushGroupBoundary(target: number[], group: RenderGroupBoundary): void {
  const borderWidth = 2;
  const fill = rgba("#5f7fad", 0.06);
  const stroke = rgba("#5f7fad", 0.9);
  pushRect(target, group.x, group.y, group.width, group.height, fill);
  const x = group.x - borderWidth / 2;
  const y = group.y - borderWidth / 2;
  const width = group.width + borderWidth;
  const height = group.height + borderWidth;
  pushRect(target, x, y, width, borderWidth, stroke);
  pushRect(target, x, y + height - borderWidth, width, borderWidth, stroke);
  pushRect(target, x, y, borderWidth, height, stroke);
  pushRect(target, x + width - borderWidth, y, borderWidth, height, stroke);
}

export function screenToWorld(point: { x: number; y: number }, camera: CameraState): { x: number; y: number } {
  return {
    x: (point.x - camera.x) / camera.zoom,
    y: (point.y - camera.y) / camera.zoom,
  };
}

export function worldToScreen(point: { x: number; y: number }, camera: CameraState): { x: number; y: number } {
  return {
    x: point.x * camera.zoom + camera.x,
    y: point.y * camera.zoom + camera.y,
  };
}

function pointInNode(point: { x: number; y: number }, node: RenderNode): boolean {
  if (node.shape === "circle") {
    const radius = Math.max(node.width, node.height) * 0.5;
    const cx = node.x + node.width * 0.5;
    const cy = node.y + node.height * 0.5;
    return Math.hypot(point.x - cx, point.y - cy) <= radius;
  }
  return point.x >= node.x && point.x <= node.x + node.width && point.y >= node.y && point.y <= node.y + node.height;
}

export function hitTestNodes(nodes: RenderNode[], worldPoint: { x: number; y: number }): string | null {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    if (pointInNode(worldPoint, nodes[index]!)) return nodes[index]!.id;
  }
  return null;
}

function distanceToSegment(point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

export function hitTestSnapshot(snapshot: RenderSnapshot, worldPoint: { x: number; y: number }, tolerance = 8): HitResult | null {
  const nodeId = hitTestNodes(snapshot.nodes, worldPoint);
  if (nodeId) return { kind: "node", nodeId };
  for (const edge of [...snapshot.graphLinks, ...snapshot.edges]) {
    for (let index = 1; index < edge.points.length; index += 1) {
      if (distanceToSegment(worldPoint, edge.points[index - 1]!, edge.points[index]!) <= Math.max(tolerance, edge.width * 0.5)) {
        return { kind: edge.kind, edgeId: edge.id };
      }
    }
  }
  return null;
}

const SPATIAL_CELL_SIZE = 256;

function spatialCellKey(x: number, y: number): string {
  return `${Math.floor(x / SPATIAL_CELL_SIZE)}:${Math.floor(y / SPATIAL_CELL_SIZE)}`;
}

function buildNodeSpatialIndex(nodes: RenderNode[]): Map<string, RenderNode[]> {
  const index = new Map<string, RenderNode[]>();
  nodes.forEach((node) => {
    const minX = Math.floor(node.x / SPATIAL_CELL_SIZE);
    const minY = Math.floor(node.y / SPATIAL_CELL_SIZE);
    const maxX = Math.floor((node.x + node.width) / SPATIAL_CELL_SIZE);
    const maxY = Math.floor((node.y + node.height) / SPATIAL_CELL_SIZE);
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const key = `${x}:${y}`;
        const bucket = index.get(key);
        if (bucket) bucket.push(node);
        else index.set(key, [node]);
      }
    }
  });
  return index;
}

export class WebGLRenderingProjection implements RenderingProjection {
  private readonly canvas: HTMLCanvasElement;
  private readonly options: ProjectionOptions;
  private gl: WebGL2RenderingContext | null = null;
  private colorProgram: WebGLProgram | null = null;
  private textProgram: WebGLProgram | null = null;
  private colorBuffer: WebGLBuffer | null = null;
  private overlayBuffer: WebGLBuffer | null = null;
  private textBuffer: WebGLBuffer | null = null;
  private labelTexture: WebGLTexture | null = null;
  private snapshot: RenderSnapshot | null = null;
  private nodeSpatialIndex = new Map<string, RenderNode[]>();
  private camera: CameraState = { x: 0, y: 0, zoom: 1 };
  private interaction: RenderInteractionState = {
    selectedNodeIds: [],
    primarySelectedNodeId: null,
    hoveredNodeId: null,
    gestureActive: false,
  };
  private colorVertexCount = 0;
  private overlayVertexCount = 0;
  private textVertexCount = 0;
  private cssWidth = 1;
  private cssHeight = 1;
  private active = false;
  private drawCalls = 0;
  private geometryUploads = 0;
  private cameraUpdates = 0;

  constructor(canvas: HTMLCanvasElement, options: ProjectionOptions) {
    this.canvas = canvas;
    this.options = options;
    this.canvas.addEventListener("webglcontextlost", this.onContextLost, false);
    this.canvas.addEventListener("webglcontextrestored", this.onContextRestored, false);
  }

  mount(): boolean {
    try {
      this.initializeContext();
      this.active = true;
      this.resize();
      this.draw();
      return true;
    } catch (error) {
      this.active = false;
      this.options.onUnavailable(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private initializeContext(): void {
    const gl = this.canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      depth: false,
      preserveDrawingBuffer: false,
      premultipliedAlpha: true,
    });
    if (!gl) throw new Error("WebGL2 is unavailable.");
    this.gl = gl;
    this.colorProgram = createProgram(gl, COLOR_VERTEX_SHADER, COLOR_FRAGMENT_SHADER);
    this.textProgram = createProgram(gl, TEXT_VERTEX_SHADER, TEXT_FRAGMENT_SHADER);
    this.colorBuffer = gl.createBuffer();
    this.overlayBuffer = gl.createBuffer();
    this.textBuffer = gl.createBuffer();
    this.labelTexture = gl.createTexture();
    if (!this.colorBuffer || !this.overlayBuffer || !this.textBuffer || !this.labelTexture) {
      throw new Error("Unable to allocate WebGL buffers.");
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
  }

  setSnapshot(snapshot: RenderSnapshot): void {
    this.snapshot = snapshot;
    this.nodeSpatialIndex = buildNodeSpatialIndex(snapshot.nodes);
    if (!this.active || !this.gl) return;
    this.uploadSceneGeometry();
    this.uploadTextGeometry();
    this.uploadInteractionGeometry();
    this.draw();
  }

  setCamera(camera: CameraState): void {
    this.camera = { ...camera };
    this.cameraUpdates += 1;
    if (this.active) this.draw();
  }

  setInteractionState(interaction: RenderInteractionState): void {
    this.interaction = {
      ...interaction,
      selectedNodeIds: [...interaction.selectedNodeIds],
    };
    if (!this.active || !this.gl) return;
    this.uploadInteractionGeometry();
    this.draw();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.cssWidth = Math.max(1, rect.width);
    this.cssHeight = Math.max(1, rect.height);
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const width = Math.max(1, Math.round(this.cssWidth * dpr));
    const height = Math.max(1, Math.round(this.cssHeight * dpr));
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.gl?.viewport(0, 0, width, height);
    if (this.active) this.draw();
  }

  hitTest(clientX: number, clientY: number): HitResult | null {
    if (!this.snapshot) return null;
    const rect = this.canvas.getBoundingClientRect();
    const worldPoint = screenToWorld({ x: clientX - rect.left, y: clientY - rect.top }, this.camera);
    const nodeId = hitTestNodes(this.nodeSpatialIndex.get(spatialCellKey(worldPoint.x, worldPoint.y)) || [], worldPoint);
    if (nodeId) return { kind: "node", nodeId };
    const tolerance = 8 / Math.max(0.1, this.camera.zoom);
    for (const edge of [...this.snapshot.graphLinks, ...this.snapshot.edges]) {
      for (let index = 1; index < edge.points.length; index += 1) {
        if (distanceToSegment(worldPoint, edge.points[index - 1]!, edge.points[index]!) <= Math.max(tolerance, edge.width * 0.5)) {
          return { kind: edge.kind, edgeId: edge.id };
        }
      }
    }
    return null;
  }

  getDebugState(): WebGLProjectionDebugState {
    return {
      active: this.active,
      revision: this.snapshot?.revision || "",
      nodeCount: this.snapshot?.nodes.length || 0,
      edgeCount: this.snapshot?.edges.length || 0,
      graphLinkCount: this.snapshot?.graphLinks.length || 0,
      camera: { ...this.camera },
      selectedNodeIds: [...this.interaction.selectedNodeIds],
      drawCalls: this.drawCalls,
      geometryUploads: this.geometryUploads,
      cameraUpdates: this.cameraUpdates,
    };
  }

  destroy(): void {
    this.active = false;
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost, false);
    this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored, false);
    const gl = this.gl;
    if (gl) {
      if (this.colorBuffer) gl.deleteBuffer(this.colorBuffer);
      if (this.overlayBuffer) gl.deleteBuffer(this.overlayBuffer);
      if (this.textBuffer) gl.deleteBuffer(this.textBuffer);
      if (this.labelTexture) gl.deleteTexture(this.labelTexture);
      if (this.colorProgram) gl.deleteProgram(this.colorProgram);
      if (this.textProgram) gl.deleteProgram(this.textProgram);
    }
    this.gl = null;
  }

  private uploadSceneGeometry(): void {
    const gl = this.gl;
    const snapshot = this.snapshot;
    if (!gl || !snapshot || !this.colorBuffer) return;
    const vertices: number[] = [];
    const renderLine = (edge: RenderEdge): void => {
      const color = rgba(edge.color, edge.kind === "graph-link" ? 0.9 : 0.72);
      for (let index = 0; index + 1 < edge.points.length; index += 1) {
        pushSegment(vertices, edge.points[index]!, edge.points[index + 1]!, edge.width, color);
      }
      if (edge.points.length >= 2 && edge.direction && edge.direction !== "none") {
        const first = edge.points[0]!;
        const second = edge.points[1]!;
        const last = edge.points[edge.points.length - 1]!;
        const beforeLast = edge.points[edge.points.length - 2]!;
        if (edge.direction === "forward" || edge.direction === "both") pushArrow(vertices, beforeLast, last, color);
        if (edge.direction === "backward" || edge.direction === "both") pushArrow(vertices, second, first, color);
      }
    };
    snapshot.groups.forEach((group) => pushGroupBoundary(vertices, group));
    snapshot.edges.forEach(renderLine);
    snapshot.graphLinks.forEach(renderLine);
    snapshot.nodes.forEach((node) => {
      const stroke = rgba(node.stroke);
      const fill = rgba(node.fill);
      if (node.shape === "circle") {
        const cx = node.x + node.width / 2;
        const cy = node.y + node.height / 2;
        pushCircle(vertices, cx, cy, Math.max(node.width, node.height) / 2 + 2, stroke);
        pushCircle(vertices, cx, cy, Math.max(1, Math.max(node.width, node.height) / 2 - 1), fill);
      } else {
        pushRect(vertices, node.x - 2, node.y - 2, node.width + 4, node.height + 4, stroke);
        pushRect(vertices, node.x, node.y, node.width, node.height, fill);
      }
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    this.colorVertexCount = vertices.length / 6;
    this.geometryUploads += 1;
  }

  private buildLabelAtlas(): { canvas: HTMLCanvasElement; labels: PackedLabel[] } {
    const snapshot = this.snapshot;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!snapshot || !context) return { canvas, labels: [] };
    const maxTexture = Math.min(4096, this.gl?.getParameter(this.gl.MAX_TEXTURE_SIZE) || 2048);
    canvas.width = maxTexture;
    canvas.height = maxTexture;
    context.clearRect(0, 0, maxTexture, maxTexture);
    context.textBaseline = "top";
    let cursorX = 2;
    let cursorY = 2;
    let rowHeight = 0;
    const labels: PackedLabel[] = [];
    for (const node of snapshot.nodes) {
      const lines = (node.labelLines.length > 0 ? node.labelLines : [node.label]).slice(0, 3);
      const fontSize = Math.max(10, Math.min(52, node.fontSize || 14));
      const lineHeight = Math.ceil(fontSize * 1.22);
      context.font = `${fontSize}px "Segoe UI", "Yu Gothic UI", "Hiragino Sans", "Meiryo", sans-serif`;
      const width = Math.min(Math.max(16, ...lines.map((line) => Math.ceil(context.measureText(line).width))) + 4, Math.max(20, node.width - 12));
      const height = lines.length * lineHeight + 4;
      if (cursorX + width + 2 > maxTexture) {
        cursorX = 2;
        cursorY += rowHeight + 2;
        rowHeight = 0;
      }
      if (cursorY + height + 2 > maxTexture) break;
      context.save();
      context.beginPath();
      context.rect(cursorX, cursorY, width, height);
      context.clip();
      context.fillStyle = node.textColor || "#202124";
      lines.forEach((line, index) => context.fillText(line, cursorX + 2, cursorY + 2 + index * lineHeight));
      context.restore();
      labels.push({
        nodeId: node.id,
        width,
        height,
        u0: cursorX / maxTexture,
        v0: cursorY / maxTexture,
        u1: (cursorX + width) / maxTexture,
        v1: (cursorY + height) / maxTexture,
      });
      cursorX += width + 2;
      rowHeight = Math.max(rowHeight, height);
    }
    return { canvas, labels };
  }

  private uploadTextGeometry(): void {
    const gl = this.gl;
    const snapshot = this.snapshot;
    if (!gl || !snapshot || !this.textBuffer || !this.labelTexture) return;
    const { canvas, labels } = this.buildLabelAtlas();
    gl.bindTexture(gl.TEXTURE_2D, this.labelTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    const byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
    const vertices: number[] = [];
    const vertex = (x: number, y: number, u: number, v: number): void => { vertices.push(x, y, u, v); };
    labels.forEach((label) => {
      const node = byId.get(label.nodeId);
      if (!node) return;
      const x = node.x + Math.max(6, (node.width - label.width) / 2);
      const y = node.y + Math.max(4, (node.height - label.height) / 2);
      const x2 = x + label.width;
      const y2 = y + label.height;
      vertex(x, y, label.u0, label.v0);
      vertex(x2, y, label.u1, label.v0);
      vertex(x, y2, label.u0, label.v1);
      vertex(x, y2, label.u0, label.v1);
      vertex(x2, y, label.u1, label.v0);
      vertex(x2, y2, label.u1, label.v1);
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    this.textVertexCount = vertices.length / 4;
  }

  private uploadInteractionGeometry(): void {
    const gl = this.gl;
    const snapshot = this.snapshot;
    if (!gl || !snapshot || !this.overlayBuffer) return;
    const vertices: number[] = [];
    const selected = new Set(this.interaction.selectedNodeIds);
    snapshot.nodes.forEach((node) => {
      if (selected.has(node.id)) pushOutline(vertices, node, rgba("#6f39ff"), node.id === this.interaction.primarySelectedNodeId ? 4 : 2);
      if (node.id === this.interaction.hoveredNodeId && !selected.has(node.id)) pushOutline(vertices, node, rgba("#2f70ff", 0.82), 2);
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.overlayBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    this.overlayVertexCount = vertices.length / 6;
  }

  private bindCameraUniforms(program: WebGLProgram): void {
    const gl = this.gl!;
    gl.uniform3f(gl.getUniformLocation(program, "u_camera"), this.camera.x, this.camera.y, this.camera.zoom);
    gl.uniform2f(gl.getUniformLocation(program, "u_viewport"), this.cssWidth, this.cssHeight);
  }

  private drawColorBuffer(buffer: WebGLBuffer, count: number): void {
    const gl = this.gl;
    const program = this.colorProgram;
    if (!gl || !program || count === 0) return;
    gl.useProgram(program);
    this.bindCameraUniforms(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const stride = 6 * Float32Array.BYTES_PER_ELEMENT;
    const position = gl.getAttribLocation(program, "a_position");
    const color = gl.getAttribLocation(program, "a_color");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(color);
    gl.vertexAttribPointer(color, 4, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
    gl.drawArrays(gl.TRIANGLES, 0, count);
    this.drawCalls += 1;
  }

  private drawText(): void {
    const gl = this.gl;
    const program = this.textProgram;
    if (!gl || !program || !this.textBuffer || !this.labelTexture || this.textVertexCount === 0 || this.camera.zoom < 0.18) return;
    gl.useProgram(program);
    this.bindCameraUniforms(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.textBuffer);
    const stride = 4 * Float32Array.BYTES_PER_ELEMENT;
    const position = gl.getAttribLocation(program, "a_position");
    const uv = gl.getAttribLocation(program, "a_uv");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(uv);
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, stride, 2 * Float32Array.BYTES_PER_ELEMENT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.labelTexture);
    gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);
    gl.drawArrays(gl.TRIANGLES, 0, this.textVertexCount);
    this.drawCalls += 1;
  }

  private draw(): void {
    const gl = this.gl;
    if (!gl || !this.active || gl.isContextLost()) return;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.colorBuffer) this.drawColorBuffer(this.colorBuffer, this.colorVertexCount);
    this.drawText();
    if (this.overlayBuffer) this.drawColorBuffer(this.overlayBuffer, this.overlayVertexCount);
  }

  private onContextLost = (event: Event): void => {
    event.preventDefault();
    this.active = false;
    this.options.onUnavailable("WebGL context was lost; switched to SVG fallback.");
  };

  private onContextRestored = (): void => {
    try {
      this.initializeContext();
      this.active = true;
      this.resize();
      if (this.snapshot) {
        this.uploadSceneGeometry();
        this.uploadTextGeometry();
        this.uploadInteractionGeometry();
      }
      this.draw();
      this.options.onRestored();
    } catch (error) {
      this.active = false;
      this.options.onUnavailable(error instanceof Error ? error.message : String(error));
    }
  };
}

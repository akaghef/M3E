import { WebGLSceneTiles, type PaintScene } from "./webgl_scene_tiles";

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
  /** Appearance is independent of simplified selection/hit-test geometry. */
  paintScene?: PaintScene;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface RenderInteractionState {
  selectedNodeIds: string[];
  primarySelectedNodeId: string | null;
  selectedGraphLinkId: string | null;
  hoveredNodeId: string | null;
  editingNodeId?: string | null;
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
  selectedGraphLinkId: string | null;
  drawCalls: number;
  geometryUploads: number;
  cameraUpdates: number;
  tileCount: number;
  textureUploads: number;
  visibleTextCount: number;
}

type ProjectionOptions = {
  onUnavailable: (reason: string) => void;
  /** Context resources were rebuilt; the owner must make the projection visible again. */
  onRestored: () => void;
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
  private overlayBuffer: WebGLBuffer | null = null;
  private textBuffer: WebGLBuffer | null = null;
  private snapshot: RenderSnapshot | null = null;
  private nodeSpatialIndex = new Map<string, RenderNode[]>();
  private camera: CameraState = { x: 0, y: 0, zoom: 1 };
  private interaction: RenderInteractionState = {
    selectedNodeIds: [],
    primarySelectedNodeId: null,
    selectedGraphLinkId: null,
    hoveredNodeId: null,
    editingNodeId: null,
    gestureActive: false,
  };
  private overlayVertexCount = 0;
  private cssWidth = 1;
  private cssHeight = 1;
  private active = false;
  private drawCalls = 0;
  private geometryUploads = 0;
  private cameraUpdates = 0;
  private sceneTiles: WebGLSceneTiles | null = null;
  private qualityTimer: ReturnType<typeof setTimeout> | null = null;

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
    this.sceneTiles = new WebGLSceneTiles(gl);
    this.colorProgram = createProgram(gl, COLOR_VERTEX_SHADER, COLOR_FRAGMENT_SHADER);
    this.textProgram = createProgram(gl, TEXT_VERTEX_SHADER, TEXT_FRAGMENT_SHADER);
    this.overlayBuffer = gl.createBuffer();
    this.textBuffer = gl.createBuffer();
    if (!this.overlayBuffer || !this.textBuffer) {
      throw new Error("Unable to allocate WebGL buffers.");
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
  }

  setSnapshot(snapshot: RenderSnapshot): void {
    if (!snapshot.paintScene) throw new Error("A complete paint scene is required for WebGL rendering.");
    this.snapshot = snapshot;
    this.nodeSpatialIndex = buildNodeSpatialIndex(snapshot.nodes);
    if (!this.active || !this.gl) return;
    this.sceneTiles?.setScene(snapshot.paintScene);
    this.geometryUploads += 1;
    this.uploadInteractionGeometry();
    this.draw();
  }

  setCamera(camera: CameraState): void {
    const zoomChanged = camera.zoom !== this.camera.zoom;
    this.camera = { ...camera };
    this.cameraUpdates += 1;
    if (this.active) this.draw();
    const needsRefinement = zoomChanged || this.qualityTimer !== null;
    if (this.qualityTimer) clearTimeout(this.qualityTimer);
    if (needsRefinement) this.qualityTimer = setTimeout(() => {
      this.qualityTimer = null;
      if (!this.active) return;
      this.sceneTiles?.refine(this.camera, this.canvas.width / this.cssWidth);
      this.draw();
    }, 120);
  }

  updateNodePaint(paint: PaintScene, ids: Set<string>): PaintScene | undefined {
    if (!this.snapshot || !this.sceneTiles) return;
    const scene = this.sceneTiles.updateNodePaint(paint, ids);
    this.snapshot = { ...this.snapshot, paintScene: scene };
    return scene;
  }

  setInteractionState(interaction: RenderInteractionState): void {
    const editingNodeChanged = (interaction.editingNodeId ?? null) !== (this.interaction.editingNodeId ?? null);
    this.interaction = {
      ...interaction,
      editingNodeId: interaction.editingNodeId ?? null,
      selectedGraphLinkId: interaction.selectedGraphLinkId ?? null,
      selectedNodeIds: [...interaction.selectedNodeIds],
    };
    if (!this.active || !this.gl) return;
    if (editingNodeChanged) {
      this.sceneTiles?.setEditingNode(interaction.editingNodeId ?? null);
    }
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
      selectedGraphLinkId: this.interaction.selectedGraphLinkId,
      drawCalls: this.drawCalls,
      geometryUploads: this.geometryUploads,
      cameraUpdates: this.cameraUpdates,
      tileCount: this.sceneTiles?.cacheSize || 0,
      textureUploads: this.sceneTiles?.textureUploads || 0,
      visibleTextCount: this.sceneTiles?.visibleTextCount || 0,
    };
  }

  destroy(): void {
    this.active = false;
    if (this.qualityTimer) clearTimeout(this.qualityTimer);
    this.sceneTiles?.clear();
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost, false);
    this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored, false);
    const gl = this.gl;
    if (gl) {
      if (this.overlayBuffer) gl.deleteBuffer(this.overlayBuffer);
      if (this.textBuffer) gl.deleteBuffer(this.textBuffer);
      if (this.colorProgram) gl.deleteProgram(this.colorProgram);
      if (this.textProgram) gl.deleteProgram(this.textProgram);
    }
    this.gl = null;
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

  private draw(): void {
    const gl = this.gl;
    if (!gl || !this.active || gl.isContextLost()) return;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.snapshot?.paintScene && this.sceneTiles && this.textProgram && this.textBuffer) {
      const program = this.textProgram;
      gl.useProgram(program);
      this.bindCameraUniforms(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.textBuffer);
      const position = gl.getAttribLocation(program, "a_position");
      const uv = gl.getAttribLocation(program, "a_uv");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(uv);
      gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
      gl.activeTexture(gl.TEXTURE0);
      gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);
      // Canvas tiles are premultiplied; SRC_ALPHA would multiply alpha twice
      // and darken antialiased glyphs/curves.
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      this.drawCalls += this.sceneTiles.draw(this.camera, this.cssWidth, this.cssHeight, this.canvas.width / this.cssWidth, (tile, g) => {
        const x = tile.x, y = tile.y, r = x + tile.size, b = y + tile.size;
        gl.bindTexture(gl.TEXTURE_2D, tile.texture);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
          x,y,g,g, r,y,1-g,g, x,b,g,1-g,
          x,b,g,1-g, r,y,1-g,g, r,b,1-g,1-g,
        ]), gl.STREAM_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      });
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }
    if (this.overlayBuffer) this.drawColorBuffer(this.overlayBuffer, this.overlayVertexCount);
  }

  private onContextLost = (event: Event): void => {
    event.preventDefault();
    this.active = false;
    if (this.qualityTimer) clearTimeout(this.qualityTimer);
    this.options.onUnavailable("WebGL context was lost; switched to SVG fallback.");
  };

  private onContextRestored = (): void => {
    try {
      this.initializeContext();
      this.active = true;
      this.resize();
      if (this.snapshot) {
        if (this.snapshot.paintScene) this.sceneTiles?.setScene(this.snapshot.paintScene);
        this.sceneTiles?.setEditingNode(this.interaction.editingNodeId ?? null);
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

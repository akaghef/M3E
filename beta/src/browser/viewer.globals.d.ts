// Global type declarations for the browser build (script-mode, no module system).
// ViewerTuning and VIEWER_TUNING are declared in viewer.tuning.ts as globals.

declare const katex: {
  render(latex: string, element: HTMLElement, options?: { displayMode?: boolean; throwOnError?: boolean }): void;
  renderToString(latex: string, options?: { displayMode?: boolean; throwOnError?: boolean }): string;
};
declare const joint: any;

type NodeType = "text" | "image" | "folder" | "alias";
type AliasAccess = "read" | "write";
type ThinkingMode = "flash" | "rapid" | "deep";
type SurfaceViewMode = "tree" | "system" | "scatter" | "mindmap" | "logic-chart" | "timeline";
type GraphLinkDirection = "none" | "forward" | "backward" | "both";
type GraphLinkStyle = "default" | "dashed" | "soft" | "emphasis";
type LinkPort = "auto" | "left" | "right" | "top" | "bottom";
type MapNodeClass = "entity" | "scope";
type SurfaceKind = "tree" | "system" | "scatter" | "mindmap" | "logic-chart" | "timeline";
type SurfaceLayout = "tree" | "flow-lr" | "scatter" | "mindmap" | "logic-chart" | "timeline";
type SurfaceLayoutDensity = "compact" | "balanced" | "spacious";
type SurfaceBranchDirection = "both" | "right" | "left";

interface TreeNode {
  id: string;
  parentId: string | null;
  children: string[];
  nodeType?: NodeType;
  scopeId?: string;
  text: string;
  collapsed: boolean;
  details: string;
  note: string;
  attributes: Record<string, string>;
  link: string;
  targetNodeId?: string;
  aliasLabel?: string;
  access?: AliasAccess;
  targetSnapshotLabel?: string;
  isBroken?: boolean;
}

interface GraphLink {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType?: string;
  label?: string;
  direction?: GraphLinkDirection;
  style?: GraphLinkStyle;
  color?: string;
  sourcePort?: LinkPort;
  targetPort?: LinkPort;
}

interface SurfaceNodeView {
  x?: number;
  y?: number;
  flowCol?: number;
  flowRow?: number;
  shape?: "rect" | "diamond" | "rounded";
}

interface MapSurface {
  id: string;
  scopeId: string;
  kind: SurfaceKind;
  layout: SurfaceLayout;
  nodeViews?: Record<string, SurfaceNodeView>;
}

interface MapScope {
  id: string;
  label: string;
  rootNodeIds: string[];
  relationIds: string[];
  primarySurfaceId?: string;
}

interface PenPoint {
  x: number;
  y: number;
}

interface PenAnnotation {
  id: string;
  kind: "pen";
  scopeId?: string;
  d: string;
  points: PenPoint[];
  stroke: string;
  strokeWidth: number;
  opacity?: number;
  createdAt?: string;
}

interface TextAnnotation {
  id: string;
  kind: "text";
  scopeId?: string;
  x: number;
  y: number;
  text: string;
  fill: string;
  fontSize: number;
  fontWeight?: number;
  variant?: "date" | "label";
  createdAt?: string;
}

type MapAnnotation = PenAnnotation | TextAnnotation;

interface AppState {
  rootId: string;
  nodes: Record<string, TreeNode>;
  links?: Record<string, GraphLink>;
  annotations?: Record<string, MapAnnotation>;
  scopes?: Record<string, MapScope>;
  surfaces?: Record<string, MapSurface>;
  linearNotesByScope?: Record<string, string>;
  linearTextFontScale?: number;
  linearPanelWidth?: number;
}

interface SavedMap {
  version: 1;
  savedAt: string;
  state: AppState;
}

type LinearTransformDirection = "tree-to-linear" | "linear-to-tree";
type LinearTransformTransport = "openai-compatible" | "mcp";

interface LinearTransformStatus {
  ok: true;
  enabled: boolean;
  configured: boolean;
  provider: string | null;
  transport: LinearTransformTransport;
  model: string | null;
  endpoint: string | null;
  promptConfigured: boolean;
  message: string;
}

interface LinearTransformRequest {
  direction: LinearTransformDirection;
  sourceText: string;
  scopeRootId?: string | null;
  scopeLabel?: string | null;
  instruction?: string | null;
}

interface LinearTransformResponse {
  ok: true;
  direction: LinearTransformDirection;
  provider: string;
  model: string;
  outputText: string;
  rawText: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

interface AiFeatureStatus {
  available: boolean;
  promptConfigured: boolean;
}

interface AiStatusResponse {
  ok: true;
  enabled: boolean;
  configured: boolean;
  provider: string | null;
  transport: LinearTransformTransport;
  model: string | null;
  endpoint: string | null;
  message: string;
  features: Record<string, AiFeatureStatus>;
}

interface AiSubagentRequest {
  mapId: string;
  scopeId: string;
  provider?: string | null;
  mode?: "proposal" | "direct-result";
  input: Record<string, unknown>;
  constraints?: {
    timeoutMs?: number;
    maxTokens?: number;
    temperature?: number;
  };
  clientContext?: {
    selectionNodeId?: string;
    requestId?: string;
  };
}

interface AiSubagentSuccessResponse {
  ok: true;
  subagent: string;
  provider: string;
  transport: LinearTransformTransport;
  model: string;
  mode: "proposal" | "direct-result";
  requiresApproval: boolean;
  proposal: {
    kind: string;
    summary?: string;
    result: Record<string, unknown>;
    warnings?: string[];
    explanations?: string[];
  };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  meta: {
    scopeId: string;
    mapId: string;
    latencyMs: number;
  };
}

interface NodePosition {
  x: number;
  y: number;
  depth: number;
  w: number;
  h: number;
  fontSize?: number;
  labelLines?: string[];
  scatterCollapsedGroup?: boolean;
}

interface LayoutResult {
  pos: Record<string, NodePosition>;
  order: string[];
  totalHeight: number;
  totalWidth: number;
}

interface DragState {
  mode?: "structure" | "scatter";
  pointerId: number;
  sourceNodeId: string;
  sourceRootIds: string[];
  proposal: DragDropProposal | null;
  startX: number;
  startY: number;
  dragged: boolean;
  toggleKey: boolean;
  shiftKey: boolean;
  startViews?: Record<string, { x: number; y: number }>;
}

type DragDropProposal =
  | {
    kind: "reparent";
    parentId: string;
  }
  | {
    kind: "reorder";
    parentId: string;
    index: number;
    lineY: number;
  };

interface PanState {
  pointerId: number;
  startX: number;
  startY: number;
  cameraX: number;
  cameraY: number;
}

interface PinchState {
  pointerA: { id: number; x: number; y: number };
  pointerB: { id: number; x: number; y: number };
  initialDistance: number;
  initialZoom: number;
  initialCameraX: number;
  initialCameraY: number;
  initialCenterX: number;
  initialCenterY: number;
}

interface SubtreeSnapshot {
  id: string;
  nodeType?: NodeType;
  text: string;
  collapsed?: boolean;
  details: string;
  note: string;
  attributes: Record<string, string>;
  link?: string;
  targetNodeId?: string;
  aliasLabel?: string;
  access?: AliasAccess;
  targetSnapshotLabel?: string;
  isBroken?: boolean;
  children: SubtreeSnapshot[];
}

interface SubtreeClipboardPayload {
  kind: "m3e.subtree.clipboard";
  version: 1;
  roots: SubtreeSnapshot[];
  links: GraphLink[];
}

type ClipboardState =
  | {
    type: "copy";
    snapshots: SubtreeSnapshot[];
    links: GraphLink[];
  }
  | {
    type: "cut";
    sourceIds: Set<string>;
  }
  | null;

interface ViewState {
  selectedNodeId: string;
  selectedNodeIds: Set<string>;
  selectionAnchorId: string | null;
  currentScopeId: string;
  scopeHistory: string[];
  currentScopeRootId: string;
  thinkingMode: ThinkingMode;
  surfaceViewMode: SurfaceViewMode;
  surfaceLayoutDensity: SurfaceLayoutDensity;
  surfaceBranchDirection: SurfaceBranchDirection;
  zoom: number;
  cameraX: number;
  cameraY: number;
  panState: PanState | null;
  pinchState: PinchState | null;
  clipboardState: ClipboardState;
  linkSourceNodeId: string;
  selectedLinkId: string;
  reparentSourceIds: Set<string>;
  dragState: DragState | null;
  collapsedIds: Set<string>;
  reviewMode: boolean;
  cameraMove: CameraMoveState;
}

type CameraMovePreset = "off" | "minimal" | "follow-selection" | "cinematic" | "locked";
type CameraMoveTrigger = "scope" | "selection" | "layout" | "continuous" | "command";

interface CameraMoveState {
  preset: CameraMovePreset;
  toggle: boolean;
  lockedNodeId: string | null;
  userFitZoom: number | null;
  userInteractedAt: number;
}

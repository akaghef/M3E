// Global type declarations for the browser build (script-mode, no module system).
// ViewerTuning and VIEWER_TUNING are declared in viewer.tuning.ts as globals.

type NodeType = "text" | "image" | "folder" | "alias";
type AliasAccess = "read" | "write";
type ThinkingMode = "flash" | "rapid" | "deep";
type GraphLinkDirection = "none" | "forward" | "backward" | "both";
type GraphLinkStyle = "default" | "dashed" | "soft" | "emphasis";

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
}

interface AppState {
  rootId: string;
  nodes: Record<string, TreeNode>;
  links?: Record<string, GraphLink>;
}

interface SavedDoc {
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
}

interface NodePosition {
  x: number;
  y: number;
  depth: number;
  w: number;
  h: number;
}

interface LayoutResult {
  pos: Record<string, NodePosition>;
  order: string[];
  totalHeight: number;
  totalWidth: number;
}

interface DragState {
  pointerId: number;
  sourceNodeId: string;
  proposal: DragDropProposal | null;
  startX: number;
  startY: number;
  dragged: boolean;
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

interface ViewState {
  selectedNodeId: string;
  currentScopeId: string;
  scopeHistory: string[];
  currentScopeRootId: string;
  thinkingMode: ThinkingMode;
  zoom: number;
  cameraX: number;
  cameraY: number;
  panState: PanState | null;
  reparentSourceId: string;
  dragState: DragState | null;
  collapsedIds: Set<string>;
}

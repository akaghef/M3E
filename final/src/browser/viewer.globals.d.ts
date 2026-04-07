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
  documentId: string;
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
    documentId: string;
    latencyMs: number;
  };
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
  sourceRootIds: string[];
  proposal: DragDropProposal | null;
  startX: number;
  startY: number;
  dragged: boolean;
  toggleKey: boolean;
  shiftKey: boolean;
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

interface SubtreeSnapshot {
  text: string;
  details: string;
  note: string;
  attributes: Record<string, string>;
  children: SubtreeSnapshot[];
}

type ClipboardState =
  | {
    type: "copy";
    snapshots: SubtreeSnapshot[];
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
  zoom: number;
  cameraX: number;
  cameraY: number;
  panState: PanState | null;
  clipboardState: ClipboardState;
  reparentSourceIds: Set<string>;
  dragState: DragState | null;
  collapsedIds: Set<string>;
}

interface M3eActiveNode {
  readonly id: string;
  edit(label: string): void;
  del(): void;
  set(field: string, value: string): void;
  unset(field: string): void;
  attr(key: string, value: string): void;
  attrDel(key: string): void;
  setType(type: NodeType): void;
  info(): TreeNode;
}

interface M3eActiveBranch {
  readonly id: string;
  collapse(): void;
  expand(): void;
  move(newParentId: string): void;
  clone(newParentId?: string): string;
  del(): void;
  tree(): string;
  findAll(text: string): string[];
}

interface M3eActiveScope {
  readonly id: string;
  info(): TreeNode;
  collapse(): void;
  expand(): void;
  tree(): string;
  findAll(text: string): string[];
}

interface M3eApi {
  readonly root: string;
  readonly sel: string | null;
  readonly marked: string[];
  readonly active_node: M3eActiveNode;
  readonly active_branch: M3eActiveBranch;
  readonly active_scope: M3eActiveScope;

  parent(id?: string): string | null;
  children(id?: string): string[];
  node(id: string): TreeNode;
  info(nodeId?: string): TreeNode;

  add(parentId: string, label: string, index?: number): string;
  sibling(nodeId: string, label: string, after?: boolean): string;
  clone(nodeId: string, newParentId?: string): string;
  edit(nodeId: string, newLabel: string): void;
  del(nodeId: string): void;
  move(nodeId: string, newParentId: string, index?: number): void;
  promote(nodeId: string): void;
  demote(nodeId: string): void;
  setType(nodeId: string, type: NodeType): void;

  select(nodeId: string): void;
  nav(direction: "parent" | "first" | "last" | "next" | "prev"): void;

  collapse(nodeId: string): void;
  expand(nodeId: string): void;
  toggle(nodeId: string): void;
  collapseAll(nodeId?: string): void;
  expandAll(nodeId?: string): void;

  set(nodeId: string, field: string, value: string): void;
  unset(nodeId: string, field: string): void;
  attr(nodeId: string, key: string, value: string): void;
  attrDel(nodeId: string, key: string): void;

  undo(): boolean;
  redo(): boolean;

  find(text: string): string | null;
  findAll(text: string): string[];
  tree(nodeId?: string): string;
  depth(nodeId?: string): number;
  count(nodeId?: string): number;
  leaves(nodeId?: string): string[];
  ancestors(nodeId?: string): string[];
  path(nodeId?: string): string[];
  replaceAll(search: string, replacement: string, scopeRootId?: string): number;

  mark(nodeId: string): void;
  unmark(nodeId: string): void;
  clearMarks(): void;

  fit(): void;
  focus(nodeId?: string): void;
  zoom(factor: number): void;
  zoomReset(): void;
  pan(dx: number, dy: number): void;

  "new"(rootLabel?: string): void;
  save(filename?: string): void;
  load(source: string | File): Promise<void>;
  export(format: "json" | "mm"): void;
}

interface Window {
  m3e: M3eApi;
}

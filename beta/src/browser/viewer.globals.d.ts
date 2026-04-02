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

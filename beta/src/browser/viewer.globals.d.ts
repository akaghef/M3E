// Global type declarations for the browser build (script-mode, no module system).
// ViewerTuning and VIEWER_TUNING are declared in viewer.tuning.ts as globals.

interface TreeNode {
  id: string;
  parentId: string | null;
  children: string[];
  text: string;
  details: string;
  note: string;
  attributes: Record<string, string>;
  link: string;
}

interface AppState {
  rootId: string;
  nodes: Record<string, TreeNode>;
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
  zoom: number;
  cameraX: number;
  cameraY: number;
  panState: PanState | null;
  reparentSourceId: string;
  dragState: DragState | null;
  collapsedIds: Set<string>;
}

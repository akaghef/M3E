import {
  layout as layoutPortLayout,
  type LayoutBranchDirection,
  type LayoutDensity,
  type LayoutMode,
  type LayoutNodeMetric,
  type LayoutOptions,
  type LayoutResult,
  type StructuredLayoutMode,
  type VisibleLayoutGraph,
} from "../shared/layout_port";

type PublicLayoutOptions = Pick<LayoutOptions, "spacing" | "direction" | "depthAlign" | "edge" | "link">;

const fileInput = document.getElementById("file-input") as HTMLInputElement;
const loadDefaultBtn = document.getElementById("load-default");
const runAircraftVisualCheckBtn = document.getElementById("run-aircraft-visual-check");
const stopVisualCheckBtn = document.getElementById("stop-visual-check");
const modeFlashBtn = document.getElementById("mode-flash");
const modeRapidBtn = document.getElementById("mode-rapid");
const modeDeepBtn = document.getElementById("mode-deep");
const viewTreeBtn = document.getElementById("view-tree");
const viewMindmapBtn = document.getElementById("view-mindmap");
const viewLogicChartBtn = document.getElementById("view-logic-chart");
const viewTimelineBtn = document.getElementById("view-timeline");
const viewSystemBtn = document.getElementById("view-system");
const viewScatterBtn = document.getElementById("view-scatter");
const themeToggleBtn = document.getElementById("theme-toggle") as HTMLButtonElement | null;
const scopeNavBtn = document.getElementById("scope-nav-btn") as HTMLButtonElement | null;
const localFsToggleBtn = document.getElementById("local-fs-toggle") as HTMLButtonElement | null;
const componentTabularToggleBtn = document.getElementById("component-tabular-toggle") as HTMLButtonElement | null;
const cameraFollowBtn = document.getElementById("camera-follow-btn") as HTMLButtonElement | null;
const scatterToolbarEl = document.getElementById("scatter-toolbar") as HTMLElement | null;
const scatterNormalBtn = document.getElementById("scatter-normal") as HTMLButtonElement | null;
const scatterAddNodeBtn = document.getElementById("scatter-add-node") as HTMLButtonElement | null;
const scatterAddEdgeBtn = document.getElementById("scatter-add-edge") as HTMLButtonElement | null;
const scatterColorizeBtn = document.getElementById("scatter-colorize") as HTMLButtonElement | null;
const scatterDeleteBtn = document.getElementById("scatter-delete") as HTMLButtonElement | null;
const scatterAnimateBtn = document.getElementById("scatter-animate") as HTMLButtonElement | null;
const scatterReflowBtn = document.getElementById("scatter-reflow") as HTMLButtonElement | null;
const scatterRepulsionInput = document.getElementById("scatter-repulsion") as HTMLInputElement | null;
const scatterEdgeLengthInput = document.getElementById("scatter-edge-length") as HTMLInputElement | null;
const penToolBtn = document.getElementById("pen-tool") as HTMLButtonElement | null;
const drawToolbarEl = document.getElementById("draw-toolbar") as HTMLElement | null;
const drawSelectBtn = document.getElementById("draw-select") as HTMLButtonElement | null;
const drawPenBtn = document.getElementById("draw-pen") as HTMLButtonElement | null;
const drawHighlighterBtn = document.getElementById("draw-highlighter") as HTMLButtonElement | null;
const drawDateBtn = document.getElementById("draw-date") as HTMLButtonElement | null;
const drawEraserBtn = document.getElementById("draw-eraser") as HTMLButtonElement | null;
const penWidthInput = document.getElementById("pen-width") as HTMLInputElement | null;
const penColorBtns = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-pen-color]"));
const importBtn = document.getElementById("import-btn");
const importMenu = document.getElementById("import-menu");
const importFileBtn = document.getElementById("import-file-btn") as HTMLButtonElement | null;
const importVaultBtn = document.getElementById("import-vault-btn") as HTMLButtonElement | null;
const downloadBtn = document.getElementById("download-btn");
const downloadMmBtn = document.getElementById("download-mm-btn");
const exportVaultBtn = document.getElementById("export-vault-btn") as HTMLButtonElement | null;
const hamburgerBtn = document.getElementById("hamburger-btn");
const hamburgerMenu = document.getElementById("hamburger-menu");
const exportBtn = document.getElementById("export-btn");
const exportMenu = document.getElementById("export-menu");
const integrateBtn = document.getElementById("integrate-btn");
const integrateMenu = document.getElementById("integrate-menu");
const setVaultPathBtn = document.getElementById("set-vault-path-btn") as HTMLButtonElement | null;
const integrateVaultLiveBtn = document.getElementById("integrate-vault-live-btn") as HTMLButtonElement | null;
const integrateStopBtn = document.getElementById("integrate-stop-btn") as HTMLButtonElement | null;
const vaultSyncBadgeEl = document.getElementById("vault-sync-badge") as HTMLElement | null;
const viewerHomeLinkEl = document.getElementById("viewer-home-link") as HTMLAnchorElement | null;
const metaPanelEl = document.querySelector(".meta-panel") as HTMLElement | null;
const toolbarEl = document.querySelector(".toolbar") as HTMLElement | null;
const modeMetaEl = document.getElementById("mode-meta") as HTMLElement;
const scopeMetaEl = document.getElementById("scope-meta") as HTMLElement;
const scopeSummaryEl = document.getElementById("scope-summary") as HTMLElement;
const metaEl = document.getElementById("meta") as HTMLElement;
const statusEl = document.getElementById("status") as HTMLElement;
const modeBadgeEl = document.getElementById("mode-badge") as HTMLElement | null;
const visualCheckEl = document.getElementById("visual-check");
const board = document.getElementById("board") as HTMLElement;
const canvas = document.getElementById("canvas") as unknown as SVGSVGElement;
const linearPanelEl = document.querySelector(".linear-panel") as HTMLElement | null;
const linearMenuEl = document.getElementById("linear-menu") as HTMLElement | null;
const linearMenuToggleBtn = document.getElementById("linear-menu-toggle") as HTMLButtonElement | null;
const linearAdjustControlsEl = document.getElementById("linear-adjust-controls") as HTMLElement | null;
const linearFontDecBtn = document.getElementById("linear-font-dec") as HTMLButtonElement | null;
const linearFontIncBtn = document.getElementById("linear-font-inc") as HTMLButtonElement | null;
const linearFontResetBtn = document.getElementById("linear-font-reset") as HTMLButtonElement | null;
const linearResizeHandleEl = document.getElementById("linear-resize-handle") as HTMLElement | null;
const linearTextEl = document.getElementById("linear-text") as HTMLTextAreaElement;
const linearMetaEl = document.getElementById("linear-meta") as HTMLElement | null;
const linearApplyBtn = document.getElementById("linear-apply") as HTMLButtonElement | null;
const linearResetBtn = document.getElementById("linear-reset") as HTMLButtonElement | null;
const cheatsheetEl = document.getElementById("shortcut-cheatsheet") as HTMLElement | null;
const homeScreenEl = document.getElementById("home-screen") as HTMLElement | null;
const homeScopeTreeEl = document.getElementById("home-scope-tree") as HTMLElement | null;
const scopeNavCloseBtn = document.getElementById("scope-nav-close") as HTMLButtonElement | null;
const localFsPanelEl = document.getElementById("local-fs-panel") as HTMLElement | null;
const localFsCloseBtn = document.getElementById("local-fs-close") as HTMLButtonElement | null;
const localFsRootInputEl = document.getElementById("local-fs-root-input") as HTMLInputElement | null;
const localFsConnectBtn = document.getElementById("local-fs-connect") as HTMLButtonElement | null;
const localFsRefreshBtn = document.getElementById("local-fs-refresh") as HTMLButtonElement | null;
const localFsStatusEl = document.getElementById("local-fs-status") as HTMLElement | null;
const localFsTreeEl = document.getElementById("local-fs-tree") as HTMLElement | null;
const localFsPreviewTitleEl = document.getElementById("local-fs-preview-title") as HTMLElement | null;
const localFsPreviewEl = document.getElementById("local-fs-preview") as HTMLElement | null;
const appEl = document.querySelector(".app") as HTMLElement | null;
const cloudSyncBadgeEl = document.getElementById("cloud-sync-badge") as HTMLElement;
const cloudPullBtn = document.getElementById("cloud-pull") as HTMLButtonElement;
const cloudPushBtn = document.getElementById("cloud-push") as HTMLButtonElement;
const cloudUseLocalBtn = document.getElementById("cloud-use-local") as HTMLButtonElement;
const cloudUseCloudBtn = document.getElementById("cloud-use-cloud") as HTMLButtonElement;
const collabSyncBadgeEl = document.getElementById("collab-sync-badge") as HTMLElement | null;
const collabDisplayNameInputEl = document.getElementById("collab-display-name") as HTMLInputElement | null;
const collabJoinTokenInputEl = document.getElementById("collab-join-token") as HTMLInputElement | null;
const collabMetaEl = document.getElementById("collab-meta") as HTMLElement | null;
const collabJoinBtn = document.getElementById("collab-join-btn") as HTMLButtonElement | null;
const collabLeaveBtn = document.getElementById("collab-leave-btn") as HTMLButtonElement | null;
const entityListPanelEl = document.getElementById("entity-list-panel") as HTMLElement | null;
const entityListTreeEl = document.getElementById("entity-list-tree") as HTMLElement | null;
const entityListSearchEl = document.getElementById("entity-list-search") as HTMLInputElement | null;
const entityListCloseBtn = document.getElementById("entity-list-close") as HTMLButtonElement | null;
const entityScopeListEl = document.getElementById("entity-scope-list") as HTMLElement | null;
const conflictPanelEl = document.getElementById("conflict-panel") as HTMLElement | null;
const conflictLocalTreeEl = document.getElementById("conflict-local-tree") as HTMLElement | null;
const conflictRemoteTreeEl = document.getElementById("conflict-remote-tree") as HTMLElement | null;
const conflictDiffSummaryEl = document.getElementById("conflict-diff-summary") as HTMLElement | null;
const conflictCloseBtn = document.getElementById("conflict-close") as HTMLButtonElement | null;
const conflictUseLocalBtn = document.getElementById("conflict-use-local") as HTMLButtonElement | null;
const conflictUseRemoteBtn = document.getElementById("conflict-use-remote") as HTMLButtonElement | null;
const markdownPreviewPanelEl = document.getElementById("markdown-preview-panel") as HTMLElement | null;
const markdownPreviewBodyEl = document.getElementById("markdown-preview-body") as HTMLElement | null;
const markdownPreviewCloseBtn = document.getElementById("markdown-preview-close") as HTMLButtonElement | null;
const v4PanelBtn = document.getElementById("v4-panel-btn") as HTMLButtonElement | null;
const v4PanelEl = document.getElementById("v4-panel") as HTMLElement | null;
const v4PanelCloseBtn = document.getElementById("v4-panel-close") as HTMLButtonElement | null;
const v4RefreshBtn = document.getElementById("v4-refresh-btn") as HTMLButtonElement | null;
const v4FlashStatusEl = document.getElementById("v4-flash-status") as HTMLElement | null;
const v4DraftListEl = document.getElementById("v4-draft-list") as HTMLElement | null;
const v4VaultStatusEl = document.getElementById("v4-vault-status") as HTMLElement | null;
const v4VaultPathEl = document.getElementById("v4-vault-path") as HTMLElement | null;
const v4ConflictStatusEl = document.getElementById("v4-conflict-status") as HTMLElement | null;
const v4GithubStatusEl = document.getElementById("v4-github-status") as HTMLElement | null;
const v4SelectedSourceEl = document.getElementById("v4-selected-source") as HTMLElement | null;
const v4AddStickyBtn = document.getElementById("v4-add-sticky-btn") as HTMLButtonElement | null;
const v4AddDecisionBtn = document.getElementById("v4-add-decision-btn") as HTMLButtonElement | null;
const v4SourceTextEl = document.getElementById("v4-source-text") as HTMLTextAreaElement | null;
const v4CreateDraftBtn = document.getElementById("v4-create-draft-btn") as HTMLButtonElement | null;
const v4ApplyDraftBtn = document.getElementById("v4-apply-draft-btn") as HTMLButtonElement | null;

const NODE_COMPONENT_ATTR = "m3e:component";
const LEGACY_VIEW_TYPE_ATTR = "m3e:view-type";

type RegisteredNodeComponentKind = "tabular";
type TabularDensity = "compact" | "regular";
type TabularMaxHeight = "small" | "medium" | "large";

interface TabularComponentProps {
  density: TabularDensity;
  columns: "auto";
  maxHeight: TabularMaxHeight;
}

interface TabularNodeComponent {
  version: 1;
  kind: "tabular";
  props: TabularComponentProps;
  source: "canonical" | "legacy";
}

type NodeComponent = TabularNodeComponent;

const DEFAULT_TABULAR_PROPS: TabularComponentProps = {
  density: "regular",
  columns: "auto",
  maxHeight: "medium",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sanitizeTabularProps(raw: unknown): TabularComponentProps {
  const props = isRecord(raw) ? raw : {};
  const density = props["density"] === "compact" ? "compact" : "regular";
  const maxHeight = props["maxHeight"] === "small" || props["maxHeight"] === "large"
    ? props["maxHeight"]
    : "medium";
  return {
    density,
    columns: "auto",
    maxHeight,
  };
}

function parseNodeComponent(node: TreeNode): NodeComponent | null {
  const attrs = node.attributes || {};
  const raw = attrs[NODE_COMPONENT_ATTR];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isRecord(parsed) || parsed["version"] !== 1) {
        return null;
      }
      if (parsed["kind"] !== "tabular") {
        return null;
      }
      return {
        version: 1,
        kind: "tabular",
        props: sanitizeTabularProps(parsed["props"]),
        source: "canonical",
      };
    } catch {
      return null;
    }
  }

  if ((attrs[LEGACY_VIEW_TYPE_ATTR] || "").trim() === "table") {
    return {
      version: 1,
      kind: "tabular",
      props: { ...DEFAULT_TABULAR_PROPS },
      source: "legacy",
    };
  }

  return null;
}

function serializedTabularComponentSpec(): string {
  return JSON.stringify({
    version: 1,
    kind: "tabular" satisfies RegisteredNodeComponentKind,
    props: DEFAULT_TABULAR_PROPS,
  });
}

type RoutingSwitcherLane = "node" | "scope";

interface RoutingScopeTarget {
  id: string;
  label: string;
  parentId: string | null;
  depth: number;
}

let routingSwitcherEl: HTMLElement | null = null;
let routingSwitcherOpen = false;
let routingSwitcherLane: RoutingSwitcherLane = "scope";
let routingScopeTargets: RoutingScopeTarget[] = [];
let routingScopeIndex = 0;
let routingScopeTargetId: string | null = null;
let routingPanKeyDown = false;
let routingScopeHoldDown = false;
let routingWheelCarryX = 0;
let routingWheelCarryY = 0;

function hideMarkdownPreview(): void {
  if (markdownPreviewPanelEl) markdownPreviewPanelEl.hidden = true;
}

function showMarkdownPreview(src: string, title: string): void {
  if (!markdownPreviewPanelEl || !markdownPreviewBodyEl) return;
  markdownPreviewPanelEl.hidden = false;
  const titleEl = markdownPreviewPanelEl.querySelector(".markdown-preview-title") as HTMLElement | null;
  if (titleEl) titleEl.textContent = title;
  const mdRender = (globalThis as any).renderMarkdownInto as
    | ((target: HTMLElement, src: string) => Promise<void>)
    | undefined;
  if (typeof mdRender === "function") {
    void mdRender(markdownPreviewBodyEl, src);
  } else {
    markdownPreviewBodyEl.textContent = src;
  }
}

function toggleMarkdownPreviewForSelectedNode(): void {
  if (!markdownPreviewPanelEl) return;
  if (!markdownPreviewPanelEl.hidden) {
    hideMarkdownPreview();
    return;
  }
  if (!map || !viewState.selectedNodeId) {
    setStatus("No node selected for markdown preview.");
    return;
  }
  const node = getNode(viewState.selectedNodeId);
  const body = [node.details || "", node.note || ""].filter(Boolean).join("\n\n");
  if (!body.trim()) {
    setStatus("Selected node has no details or note.");
    return;
  }
  showMarkdownPreview(body, `Markdown: ${node.text || "(untitled)"}`);
}

if (markdownPreviewCloseBtn) {
  markdownPreviewCloseBtn.addEventListener("click", () => hideMarkdownPreview());
}

function normalizeDocId(raw: string | null, fallback: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed.replace(/[\\/]/g, "_");
}

function firstQueryParam(params: URLSearchParams, keys: string[]): string | null {
  for (const key of keys) {
    const value = params.get(key);
    if (value && value.trim()) return value;
  }
  return null;
}

function basenameFromPath(rawPath: string): string {
  const trimmed = rawPath.replace(/[\\/]+$/g, "");
  const parts = trimmed.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || trimmed || "root";
}

const queryParams = new URLSearchParams(window.location.search);
const LOCAL_FS_VIEW_ROOT = firstQueryParam(queryParams, ["localFsRoot", "localFsPath"]) || "";
const LOCAL_FS_VIEW_MODE = Boolean(LOCAL_FS_VIEW_ROOT.trim());
const LINK_ACCESS_MODE = (firstQueryParam(queryParams, ["access", "mode", "linkMode"]) || "edit").toLowerCase();
const READ_ONLY_LINK = LOCAL_FS_VIEW_MODE || ["view", "readonly", "read-only", "viewer"].includes(LINK_ACCESS_MODE);
const DEFAULT_WORKSPACE_ID = "ws_REMH1Z5TFA7S93R3HA0XK58JNR";
const DEFAULT_WORKSPACE_LABEL = "Akaghef-personal";
const DEFAULT_MAP_ID = "map_BG9BZP6NRDTEH1JYNDFGS6S3T5";
const DEFAULT_MAP_LABEL = "開発";
const DEFAULT_MAP_SLUG = "beta-dev";
const SECONDARY_MAP_ID = "map_10226A7F0MEKDVNMEXC7HH4GNV";
const MAP_META: Record<string, { label: string; slug: string }> = {
  [DEFAULT_MAP_ID]: { label: DEFAULT_MAP_LABEL, slug: DEFAULT_MAP_SLUG },
  [SECONDARY_MAP_ID]: { label: "研究", slug: "beta-research" },
};
const WORKSPACE_ID = normalizeDocId(firstQueryParam(queryParams, ["ws", "workspaceId"]), DEFAULT_WORKSPACE_ID);
const WORKSPACE_LABEL = DEFAULT_WORKSPACE_LABEL;
const REQUESTED_MAP_ID = firstQueryParam(queryParams, ["map", "localMapId"]);
const HAS_EXPLICIT_MAP_ID = REQUESTED_MAP_ID !== null;
const LOCAL_MAP_ID = normalizeDocId(REQUESTED_MAP_ID, DEFAULT_MAP_ID);
const CLOUD_MAP_ID = normalizeDocId(firstQueryParam(queryParams, ["cloud", "cloudMapId"]), LOCAL_MAP_ID);
const MAP_LABEL = LOCAL_FS_VIEW_MODE ? `Local: ${basenameFromPath(LOCAL_FS_VIEW_ROOT)}` : (MAP_META[LOCAL_MAP_ID]?.label ?? LOCAL_MAP_ID);
const MAP_SLUG = LOCAL_FS_VIEW_MODE ? "local-fs" : (MAP_META[LOCAL_MAP_ID]?.slug ?? LOCAL_MAP_ID);
const COLLAB_PREFS_KEY = `m3e:collab:${WORKSPACE_ID}`;
const THEME_PREFS_KEY = "m3e:viewer-theme";
const AUTOSAVE_DELAY_MS = 700;
const MAX_UNDO_STEPS = 200;
function createTabId(): string {
  const maybeRandomUuid = globalThis.crypto?.randomUUID;
  if (typeof maybeRandomUuid === "function") {
    return maybeRandomUuid.call(globalThis.crypto);
  }
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `tab_${Date.now().toString(36)}_${randomPart}`;
}

const TAB_ID = createTabId();
const LINEAR_TEXT_FONT_SCALE_MIN = 0.6;
const LINEAR_TEXT_FONT_SCALE_MAX = 1.4;
const LINEAR_TEXT_FONT_SCALE_STEP = 0.1;
const LINEAR_PANEL_WIDTH_MIN = 220;
const LINEAR_PANEL_WIDTH_MAX = 10000;
const FLOW_SURFACE_PREVIEW_MAX_DETAIL = 1;
const FLOW_SURFACE_PREVIEW_FONT = 24;
const FLOW_SURFACE_PREVIEW_TITLE_HEIGHT = 38;
const FLOW_SURFACE_PREVIEW_COL_GAP = 28;
const FLOW_SURFACE_PREVIEW_ROW_GAP = 30;
const FLOW_SURFACE_PREVIEW_PAD_X = 26;
const FLOW_SURFACE_PREVIEW_PAD_Y = 18;
const FLOW_SURFACE_PREVIEW_NODE_PAD_X = 14;
const FLOW_SURFACE_PREVIEW_NODE_HEIGHT = 34;
const FLOW_SURFACE_ROW_GAP = 84;

function isReadOnlyLink(): boolean {
  return READ_ONLY_LINK;
}

function blockReadOnlyAction(label = "Read-only link. Use the editor link to change this map."): boolean {
  if (!isReadOnlyLink()) {
    return false;
  }
  setStatus(label, true);
  return true;
}

function isReadOnlyAllowedKey(event: KeyboardEvent): boolean {
  if (event.key === "Escape") return true;
  if (event.key.startsWith("Arrow")) return true;
  if (["[", "]", "-", "=", "+", "0", "?", " "].includes(event.key)) return true;
  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
    return ["i", "j", "k"].includes(event.key.toLowerCase());
  }
  if (event.altKey && !event.ctrlKey && !event.metaKey) {
    return ["h", "v", "d"].includes(event.key.toLowerCase());
  }
  if ((event.ctrlKey || event.metaKey) && !event.altKey) {
    return ["c", "s"].includes(event.key.toLowerCase());
  }
  return false;
}

interface BcStateMessage {
  type: "STATE_UPDATE";
  fromTabId: string;
  state: AppState;
  savedAt: string;
}

interface ClipboardSyncRecord {
  type: "M3E_CLIPBOARD_UPDATE";
  fromTabId: string;
  encoded: string;
  writtenAt: number;
}

let bc: BroadcastChannel | null = null;
let clipboardBc: BroadcastChannel | null = null;
let lastServerSavedAt: string | null = null;
let lastServerBaseState: AppState | null = null;

interface UndoSnapshot {
  state: AppState;
  selectedNodeId: string;
  selectedNodeIds: string[];
  selectionAnchorId: string | null;
}

interface LinearLineMap {
  nodeId: string;
  lineIndex: number;
  startOffset: number;
  endOffset: number;
}

interface LinearNodeDraft {
  label: string;
  children: LinearNodeDraft[];
}

type ImportanceViewMode = "all" | "high-plus" | "high-only";

let map: SavedMap | null = null;
let fatalLoadError = false;
let visibleOrder: string[] = [];
let statusTimer: ReturnType<typeof setTimeout> | null = null;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let cycleViewState: "focus" | "fit" = "focus";
let inlineEditor: { nodeId: string; input: HTMLTextAreaElement; mode: "node-text" | "alias-label" | "target-text" } | null = null;
let inlineEdgeLabelEditor: { nodeId: string; input: HTMLTextAreaElement } | null = null;
let contentWidth = 1600;
let contentHeight = 900;

type CameraTarget = { cameraX: number; cameraY: number; zoom: number };
type CameraMoveOptions = { animate?: boolean; durationMs?: number };
type AnnotationTool = "select" | "pen" | "highlighter" | "date" | "eraser";
type PenStrokeDraft = {
  pointerId: number;
  scopeId: string;
  points: PenPoint[];
  d: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
};
type AnnotationRenderResult = { svg: string; maxX: number; maxY: number };

const CAMERA_MOTION_DURATION_MS = 300;
const PEN_STROKE_COLOR = "#242424";
const PEN_STROKE_WIDTH = 2;
const HIGHLIGHTER_STROKE_COLOR = "#ffd43b";
const HIGHLIGHTER_STROKE_WIDTH = 12;
const HIGHLIGHTER_OPACITY = 0.36;
const TEXT_ANNOTATION_COLOR = "#242424";
const TEXT_ANNOTATION_FONT_SIZE = 34;
const PEN_POINT_MIN_DISTANCE = 2;
const ERASER_HIT_RADIUS = 26;
let cameraMotion: {
  raf: number | null;
  from: CameraTarget;
  to: CameraTarget;
  startedAt: number;
  durationMs: number;
} | null = null;
let annotationTool: AnnotationTool = "select";
let penDraft: PenStrokeDraft | null = null;
let eraserPointerId: number | null = null;
let activePenStrokeColor = PEN_STROKE_COLOR;
let activePenStrokeWidth = PEN_STROKE_WIDTH;

function buildHomeHref(): string {
  const params = new URLSearchParams({ ws: WORKSPACE_ID });
  return `./home.html?${params.toString()}`;
}

if (viewerHomeLinkEl) {
  viewerHomeLinkEl.href = buildHomeHref();
}
let lastLayout: LayoutResult | null = null;
let visualCheckRunId = 0;
let undoStack: UndoSnapshot[] = [];
let redoStack: UndoSnapshot[] = [];
let linearDirty = false;
let linearLineMap: LinearLineMap[] = [];
let suppressLinearSelectionSync = false;
let suppressInlineBlurCommit = false;
let flowSurfaceDetailLevel = 0;
const linearNotesByScope: Record<string, string> = {};
let linearPanelCanvasWidth = 340;
let linearResizeState: { pointerId: number; startClientX: number; startCanvasWidth: number } | null = null;
let importanceViewMode: ImportanceViewMode = "all";
let importanceVisibleNodeIds: Set<string> | null = null;
let cloudSyncEnabled = false;
let cloudSyncExists = false;
let cloudSavedAt: string | null = null;
let cloudConflictPending = false;
let linearTransformStatus: LinearTransformStatus | null = null;
let linearTextFontScale = 1;
let linearAdjustMenuOpen = false;
let linearMenuVisible = false;
let homeScreenVisible = false;
let entityListVisible = false;
let presenceMap: Map<string, { userId: string; color: string; nodeId: string }[]> = new Map();
let presenceEs: EventSource | null = null;
let changedNodeIds: Set<string> = new Set();
let conflictPanelVisible = false;
let conflictRemoteState: AppState | null = null;
let conflictUseLocalAction: (() => void) | null = null;
let conflictUseRemoteAction: (() => void) | null = null;
type VaultIntegrationMode = "off" | "obsidian-live";
interface VaultUiPrefs {
  vaultPath: string;
  integrationMode: VaultIntegrationMode;
  sourceOfTruth: "sqlite" | "vault-md";
}
interface VaultWatchStatusResponse {
  ok: true;
  mapId: string;
  vaultPath: string;
  integrationMode: VaultIntegrationMode;
  sourceOfTruth: "sqlite" | "vault-md";
  running: boolean;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastError: string | null;
}
interface VaultWatchSseEvent {
  type: "watch-started" | "watch-stopped" | "vault-to-m3e" | "m3e-to-vault" | "watch-error";
  mapId: string;
  vaultPath: string;
  timestamp: string;
  detail?: string;
}
interface LocalFsEntry {
  name: string;
  relativePath: string;
  kind: "directory" | "file";
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
  hasChildren?: boolean;
}
interface LocalFsPrefs {
  rootPath: string;
}
interface LocalFsListResponse {
  ok: true;
  rootPath: string;
  relativePath: string;
  absolutePath: string;
  entries: LocalFsEntry[];
  totalEntries: number;
  truncated: boolean;
}
interface LocalFsReadResponse {
  ok: true;
  rootPath: string;
  relativePath: string;
  absolutePath: string;
  name: string;
  extension: string;
  sizeBytes: number;
  modifiedAt: string;
  truncated: boolean;
  content: string;
}
const VAULT_UI_PREFS_KEY = `m3e:vault-ui:${LOCAL_MAP_ID}`;
const LOCAL_FS_PREFS_KEY = `m3e:local-fs:${LOCAL_MAP_ID}`;
let vaultUiPrefs: VaultUiPrefs = {
  vaultPath: "",
  integrationMode: "off",
  sourceOfTruth: "vault-md",
};
let localFsPrefs: LocalFsPrefs = {
  rootPath: "",
};
let vaultWatchEs: EventSource | null = null;
let vaultWatchRunning = false;
let vaultLastInboundAt: string | null = null;
let vaultLastOutboundAt: string | null = null;
let vaultLastError: string | null = null;
let liveStreamVisibilityHandlerInstalled = false;
type ViewerTheme = "light" | "dark";
let viewerTheme: ViewerTheme = readStoredViewerTheme();
let localFsVisible = false;
let localFsSelectedPath: string | null = null;
let localFsLoadingPath: string | null = null;
let localFsChildrenByPath: Map<string, LocalFsEntry[]> = new Map();
let localFsExpandedPaths: Set<string> = new Set();
let v4PanelVisible = false;
let v4LatestDrafts: FlashDraftListItem[] = [];

// ── Scope Lock State ──
interface ClientScopeLock {
  scopeId: string;
  entityId: string;
  displayName: string;
  priority: number;
  lockId?: string;
}
interface CollabConfigResponse {
  ok: true;
  enabled: boolean;
  requiresJoinToken: boolean;
  workspaceId: string;
  workspaceLabel: string;
  mapId: string;
  mapLabel: string;
}
interface CollabPushResponse {
  ok: boolean;
  version: number;
  applied: string[];
  rejected: string[];
  conflicts: Array<{ nodeId: string; winner: string; loser: string }>;
  error?: string;
}
interface CollabPrefs {
  displayName: string;
  joinToken: string;
}
let scopeLockMap: Map<string, ClientScopeLock> = new Map(); // scopeId -> lock
let collabEntityId: string | null = null;
let collabToken: string | null = null;
let collabEventSource: EventSource | null = null;
let collabConfig: CollabConfigResponse | null = null;
let collabHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
let activeContextMenu: HTMLElement | null = null;
type ScatterToolMode = "normal" | "add-node" | "add-edge" | "colorize" | "delete";
let scatterToolMode: ScatterToolMode = "normal";
const SCATTER_DEFAULT_EDGE_COLOR = "#2f7d6d";
const SCATTER_REPULSION_DEFAULT = 200000;
const SCATTER_SPRING_K = 7;
const SCATTER_GUIDE_SPRING_WEIGHT = 0.42;
const SCATTER_DAMPING = 0.73;
const SCATTER_MASS = 10;
const SCATTER_DT = 0.2;
const SCATTER_MAX_V = 100;
const SCATTER_EDGE_LENGTH_DEFAULT = 180;
const SCATTER_NODE_RADIUS = 36;
const SCATTER_MIN_RADIUS = 18;
const SCATTER_DEPTH_SCALE = 2 / 3;
const SCATTER_MIN_SCALE = 0.52;
const STRUCTURED_CLIPBOARD_PREFIX = "M3E_CLIPBOARD_V1\n";
const STRUCTURED_CLIPBOARD_STORAGE_KEY = "m3e:subtree-clipboard:v1";
const STRUCTURED_CLIPBOARD_MAX_AGE_MS = 10 * 60 * 1000;
let scatterAnimationEnabled = false;
let scatterAnimationFrame: number | null = null;
let scatterRepulsion = SCATTER_REPULSION_DEFAULT;
let scatterEdgeLength = SCATTER_EDGE_LENGTH_DEFAULT;
const scatterVelocities = new Map<string, { x: number; y: number }>();
let selectedGraphLinkId: string | null = null;
let linkPortDragState: {
  pointerId: number;
  linkId: string;
  endpoint: LinkEndpointKind;
  startX: number;
  startY: number;
  dragged: boolean;
} | null = null;
const DRAG_CENTER_BAND_HALF = 20;
const DRAG_EDGE_BAND = 14;
const DRAG_REORDER_TAIL = 28;
const DRAG_REORDER_PARENT_LANE_PAD = 96;
let viewState: ViewState = {
  selectedNodeId: "",
  selectedNodeIds: new Set<string>(),
  selectionAnchorId: null,
  currentScopeId: "",
  scopeHistory: [],
  currentScopeRootId: "",
  thinkingMode: "rapid",
  surfaceViewMode: "tree",
  surfaceLayoutDensity: "balanced",
  surfaceBranchDirection: "right",
  surfaceLayoutDirection: "right",
  surfaceDepthAlign: "packed",
  surfaceEdgeRoute: "elbow",
  surfaceLinkRoute: "simple-bezier",
  zoom: 1,
  cameraX: VIEWER_TUNING.pan.initialCameraX,
  cameraY: VIEWER_TUNING.pan.initialCameraY,
  cameraMove: {
    preset: "follow-selection",
    toggle: true,
    lockedNodeId: null,
    userFitZoom: null,
    userInteractedAt: 0,
  },
  panState: null,
  pinchState: null,
  clipboardState: null,
  linkSourceNodeId: "",
  selectedLinkId: "",
  reparentSourceIds: new Set<string>(),
  dragState: null,
  collapsedIds: new Set<string>(),
  reviewMode: false,
};
applyLinearTextFontScale(false);
syncLinearAdjustMenuUi();

function thinkingModeLabel(mode: ThinkingMode): string {
  switch (mode) {
    case "flash":
      return "Flash";
    case "deep":
      return "Deep";
    case "rapid":
    default:
      return "Rapid";
  }
}

function surfaceViewModeLabel(mode: SurfaceViewMode): string {
  if (mode === "system") return "System";
  if (mode === "scatter") return "Scatter";
  if (mode === "mindmap") return "Mind Map";
  if (mode === "logic-chart") return "Logic Chart";
  if (mode === "timeline") return "Timeline";
  return "Tree";
}

function surfaceLayoutDensityLabel(density: SurfaceLayoutDensity): string {
  if (density === "compact") return "Compact";
  if (density === "spacious") return "Spacious";
  return "Balanced";
}

function surfaceBranchDirectionLabel(direction: SurfaceBranchDirection): string {
  if (direction === "both") return "Both";
  if (direction === "left") return "Left";
  return "Right";
}

function surfaceKindForViewMode(mode: SurfaceViewMode): SurfaceKind {
  return mode;
}

function surfaceLayoutForKind(kind: SurfaceKind): SurfaceLayout {
  if (kind === "system") return "flow-lr";
  if (kind === "scatter") return "scatter";
  if (kind === "mindmap") return "mindmap";
  if (kind === "logic-chart") return "logic-chart";
  if (kind === "timeline") return "timeline";
  return "tree";
}

function inferSurfaceViewModeForScope(scopeId: string): SurfaceViewMode {
  if (!map || !map.state.nodes[scopeId]) {
    return "tree";
  }
  const scope = map.state.scopes?.[inferredScopeId(scopeId)];
  const surface = scope?.primarySurfaceId ? map.state.surfaces?.[scope.primarySurfaceId] : null;
  if (surface?.kind) {
    return surface.kind;
  }
  const rawLayout = rawAttr(map.state.nodes[scopeId], "m3e:layout");
  if (rawLayout === "flow-lr") return "system";
  if (rawLayout === "mindmap") return "mindmap";
  if (rawLayout === "logic-chart") return "logic-chart";
  if (rawLayout === "timeline") return "timeline";
  if (rawLayout === "scatter") return "scatter";
  return "tree";
}

function sanitizeSurfaceLayoutDensity(value: unknown): SurfaceLayoutDensity {
  if (value === "compact" || value === "balanced" || value === "spacious") {
    return value;
  }
  return "balanced";
}

function sanitizeSurfaceBranchDirection(value: unknown): SurfaceBranchDirection {
  if (value === "both" || value === "right" || value === "left") {
    return value;
  }
  return "right";
}

function sanitizeSurfaceLayoutDirection(value: unknown): SurfaceLayoutDirection {
  if (value === "right" || value === "left" || value === "down" || value === "up") {
    return value;
  }
  return "right";
}

function sanitizeSurfaceDepthAlign(value: unknown): SurfaceDepthAlign {
  return value === "aligned" ? "aligned" : "packed";
}

function sanitizeSurfaceEdgeRoute(value: unknown): SurfaceEdgeRoute {
  if (value === "elbow" || value === "bezier" || value === "straight") {
    return value;
  }
  return "elbow";
}

function sanitizeSurfaceLinkRoute(value: unknown): SurfaceLinkRoute {
  if (value === "simple-bezier" || value === "orthogonal" || value === "straight") {
    return value;
  }
  return "simple-bezier";
}

function inferSurfaceLayoutDensityForScope(scopeId: string, mode: SurfaceViewMode): SurfaceLayoutDensity {
  if (!map || !map.state.nodes[scopeId]) {
    return "balanced";
  }
  const explicit = rawAttr(map.state.nodes[scopeId], "m3e:layout-density");
  if (explicit) {
    return sanitizeSurfaceLayoutDensity(explicit);
  }
  return mode === "logic-chart" ? "compact" : "balanced";
}

function inferSurfaceBranchDirectionForScope(scopeId: string, mode: SurfaceViewMode): SurfaceBranchDirection {
  if (!map || !map.state.nodes[scopeId]) {
    return "right";
  }
  const explicit = rawAttr(map.state.nodes[scopeId], "m3e:branch-direction");
  if (explicit) {
    return sanitizeSurfaceBranchDirection(explicit);
  }
  return "right";
}

function syncThinkingModeUi(): void {
  const mode = viewState.thinkingMode;
  const surfaceMode = structuredSurfaceMode();
  document.body.classList.toggle("scatter-surface-active", viewState.surfaceViewMode === "scatter");
  document.documentElement.dataset.surfaceLayoutDirection = viewState.surfaceLayoutDirection;
  document.documentElement.dataset.surfaceDepthAlign = viewState.surfaceDepthAlign;
  document.documentElement.dataset.surfaceEdgeRoute = viewState.surfaceEdgeRoute;
  document.documentElement.dataset.surfaceLinkRoute = viewState.surfaceLinkRoute;
  const layoutSuffix = surfaceMode
    ? ` / ${surfaceLayoutDensityLabel(viewState.surfaceLayoutDensity)} / ${surfaceBranchDirectionLabel(viewState.surfaceBranchDirection)}`
    : "";
  modeMetaEl.textContent = `mode: ${thinkingModeLabel(mode)} / ${surfaceViewModeLabel(viewState.surfaceViewMode)}${layoutSuffix}`;
  modeFlashBtn?.classList.toggle("is-active", mode === "flash");
  modeRapidBtn?.classList.toggle("is-active", mode === "rapid");
  modeDeepBtn?.classList.toggle("is-active", mode === "deep");
  viewTreeBtn?.classList.toggle("is-active", viewState.surfaceViewMode === "tree");
  viewMindmapBtn?.classList.toggle("is-active", viewState.surfaceViewMode === "mindmap");
  viewLogicChartBtn?.classList.toggle("is-active", viewState.surfaceViewMode === "logic-chart");
  viewTimelineBtn?.classList.toggle("is-active", viewState.surfaceViewMode === "timeline");
  viewSystemBtn?.classList.toggle("is-active", viewState.surfaceViewMode === "system");
  viewScatterBtn?.classList.toggle("is-active", viewState.surfaceViewMode === "scatter");
  syncScatterToolbarUi();
}

function syncNodeComponentUi(): void {
  const selected = map && viewState.selectedNodeId ? map.state.nodes[viewState.selectedNodeId] : null;
  const component = selected ? parseNodeComponent(selected) : null;
  const isTabular = component?.kind === "tabular";
  if (componentTabularToggleBtn) {
    componentTabularToggleBtn.classList.toggle("is-active", isTabular);
    componentTabularToggleBtn.setAttribute("aria-pressed", isTabular ? "true" : "false");
    componentTabularToggleBtn.disabled = !selected || isAliasNode(selected);
  }
}

function syncAccessModeUi(): void {
  document.body.classList.toggle("readonly-link", isReadOnlyLink());
  const banner = document.getElementById("readonly-banner") as HTMLElement | null;
  if (banner) {
    banner.hidden = !isReadOnlyLink();
  }
  document.querySelectorAll<HTMLElement>("[data-edit-only]").forEach((el) => {
    el.hidden = isReadOnlyLink();
  });
  if (linearTextEl) {
    linearTextEl.readOnly = isReadOnlyLink();
  }
  if (cloudPushBtn) cloudPushBtn.disabled = isReadOnlyLink() || cloudPushBtn.disabled;
  if (cloudUseLocalBtn) cloudUseLocalBtn.disabled = isReadOnlyLink() || cloudUseLocalBtn.disabled;
  if (collabJoinBtn) collabJoinBtn.disabled = isReadOnlyLink() || collabJoinBtn.disabled;
  syncNodeComponentUi();
}

function setThinkingMode(mode: ThinkingMode): void {
  if (viewState.thinkingMode === mode) {
    syncThinkingModeUi();
    return;
  }
  viewState.thinkingMode = mode;
  syncThinkingModeUi();
  setStatus(`Mode: ${thinkingModeLabel(mode)}`);
}

function setSurfaceViewMode(mode: SurfaceViewMode): void {
  if (viewState.surfaceViewMode === mode) {
    syncThinkingModeUi();
    return;
  }
  if (viewState.surfaceViewMode === "scatter" && mode !== "scatter") {
    stopScatterAnimation(true);
  }
  viewState.surfaceViewMode = mode;
  viewState.surfaceLayoutDensity = inferSurfaceLayoutDensityForScope(currentScopeRootId(), mode);
  viewState.surfaceBranchDirection = inferSurfaceBranchDirectionForScope(currentScopeRootId(), mode);
  syncMapModelStateFromRuntime();
  if (mode === "scatter") {
    seedMissingScatterPositions();
  }
  _linearPanelLayoutDirty = true;
  syncThinkingModeUi();
  render();
  fitDocument();
  requestAnimationFrame(() => {
    fitDocument();
  });
  if (mode === "scatter" && scatterAnimationEnabled) {
    startScatterAnimation();
  }
  scheduleAutosave();
  setStatus(`View: ${surfaceViewModeLabel(mode)}`);
}

function setSurfaceLayoutDensity(density: SurfaceLayoutDensity): void {
  viewState.surfaceLayoutDensity = density;
  _linearPanelLayoutDirty = true;
  syncThinkingModeUi();
  render();
  fitDocument();
  requestAnimationFrame(() => {
    fitDocument();
  });
  setStatus(`Layout: ${surfaceLayoutDensityLabel(density)}`);
}

function setSurfaceBranchDirection(direction: SurfaceBranchDirection): void {
  viewState.surfaceBranchDirection = direction;
  _linearPanelLayoutDirty = true;
  syncThinkingModeUi();
  render();
  fitDocument();
  requestAnimationFrame(() => {
    fitDocument();
  });
  setStatus(`Depth: ${surfaceBranchDirectionLabel(direction)}`);
}

function setPublicLayoutOptions(options: Partial<PublicLayoutOptions>): void {
  if (options.direction) {
    viewState.surfaceLayoutDirection = sanitizeSurfaceLayoutDirection(options.direction);
  }
  if (options.depthAlign) {
    viewState.surfaceDepthAlign = sanitizeSurfaceDepthAlign(options.depthAlign);
  }
  if (options.edge?.route) {
    viewState.surfaceEdgeRoute = sanitizeSurfaceEdgeRoute(options.edge.route);
  }
  if (options.link?.route) {
    viewState.surfaceLinkRoute = sanitizeSurfaceLinkRoute(options.link.route);
  }
  _linearPanelLayoutDirty = true;
  syncThinkingModeUi();
  render();
  fitDocument();
  window.dispatchEvent(new CustomEvent("m3e:layout-options-changed", {
    detail: {
      direction: viewState.surfaceLayoutDirection,
      depthAlign: viewState.surfaceDepthAlign,
      edgeRoute: viewState.surfaceEdgeRoute,
      linkRoute: viewState.surfaceLinkRoute,
    },
  }));
  setStatus("Layout options updated.");
}

function syncScatterToolbarUi(): void {
  if (scatterToolbarEl) {
    scatterToolbarEl.hidden = viewState.surfaceViewMode !== "scatter";
  }
  const entries: Array<[HTMLButtonElement | null, ScatterToolMode]> = [
    [scatterNormalBtn, "normal"],
    [scatterAddNodeBtn, "add-node"],
    [scatterAddEdgeBtn, "add-edge"],
    [scatterColorizeBtn, "colorize"],
    [scatterDeleteBtn, "delete"],
  ];
  entries.forEach(([btn, mode]) => {
    btn?.classList.toggle("is-active", scatterToolMode === mode);
    btn?.setAttribute("aria-pressed", scatterToolMode === mode ? "true" : "false");
  });
  scatterAnimateBtn?.classList.toggle("is-active", scatterAnimationEnabled);
  scatterAnimateBtn?.setAttribute("aria-pressed", scatterAnimationEnabled ? "true" : "false");
  if (scatterRepulsionInput && document.activeElement !== scatterRepulsionInput) {
    scatterRepulsionInput.value = String(Math.round(scatterRepulsion));
  }
  if (scatterEdgeLengthInput && document.activeElement !== scatterEdgeLengthInput) {
    scatterEdgeLengthInput.value = String(Math.round(scatterEdgeLength));
  }
}

function setScatterToolMode(mode: ScatterToolMode): void {
  scatterToolMode = mode;
  if (mode !== "add-edge") {
    viewState.linkSourceNodeId = "";
  }
  syncScatterToolbarUi();
  scheduleRender();
  setStatus(`Scatter: ${mode.replace("-", " ")}`);
}

function toggleScatterAnimation(): void {
  setScatterAnimationEnabled(!scatterAnimationEnabled);
}

function setScatterAnimationEnabled(enabled: boolean): void {
  scatterAnimationEnabled = enabled;
  syncScatterToolbarUi();
  if (!enabled) {
    stopScatterAnimation(true);
    setStatus("Scatter animation stopped.");
    return;
  }
  if (!currentSurfaceIsScatterMode()) {
    setStatus("Switch to Scatter to animate layout.", true);
    return;
  }
  seedMissingScatterPositions();
  startScatterAnimation();
  setStatus("Scatter animation running.");
}

function syncMetaPanelToggleUi(): void {
  // no-op: toolbar button removed, meta panel toggled via "I" key
}

function toggleMetaPanelVisibility(): void {
  if (!metaPanelEl) {
    return;
  }
  metaPanelEl.hidden = !metaPanelEl.hidden;
  syncMetaPanelToggleUi();
}

function nowIso(): string {
  return new Date().toISOString();
}

function isImeComposingEvent(event: KeyboardEvent): boolean {
  if (event.isComposing) {
    return true;
  }
  const legacy = event as KeyboardEvent & { keyCode?: number };
  if (legacy.keyCode === 229) {
    return true;
  }
  return event.key === "Process";
}

function isTextEntryElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable ||
    Boolean(target.closest("input, textarea, select, [contenteditable]"))
  );
}

function isShortcutLetter(event: KeyboardEvent, lowerKey: string, code: string): boolean {
  return event.key.toLowerCase() === lowerKey || event.code === code;
}

function isCopyNodePathShortcut(event: KeyboardEvent): boolean {
  if (!isShortcutLetter(event, "c", "KeyC")) {
    return false;
  }
  if (event.ctrlKey && event.altKey && !event.metaKey && !event.shiftKey) {
    return true;
  }
  return (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey;
}

function isCopyScopeIdShortcut(event: KeyboardEvent): boolean {
  if (!isShortcutLetter(event, "i", "KeyI")) {
    return false;
  }
  if (event.ctrlKey && event.altKey && !event.metaKey && !event.shiftKey) {
    return true;
  }
  return (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey;
}

function updateCloudSyncUi(): void {
  if (!cloudSyncBadgeEl) {
    return;
  }

  cloudSyncBadgeEl.classList.remove("on", "conflict");
  if (!cloudSyncEnabled) {
    cloudSyncBadgeEl.textContent = "Cloud: off";
    if (cloudPullBtn) cloudPullBtn.disabled = true;
    if (cloudPushBtn) cloudPushBtn.disabled = true;
    if (cloudUseLocalBtn) cloudUseLocalBtn.hidden = true;
    if (cloudUseCloudBtn) cloudUseCloudBtn.hidden = true;
    return;
  }

  cloudSyncBadgeEl.classList.add(cloudConflictPending ? "conflict" : "on");
  const savedAtLabel = cloudSavedAt ? cloudSavedAt : "none";
  cloudSyncBadgeEl.textContent = cloudConflictPending
    ? `Cloud: conflict (${savedAtLabel})`
    : `Cloud: on (${savedAtLabel})`;

  if (cloudPullBtn) cloudPullBtn.disabled = false;
  if (cloudPushBtn) cloudPushBtn.disabled = isReadOnlyLink();
  if (cloudUseLocalBtn) cloudUseLocalBtn.hidden = !cloudConflictPending;
  if (cloudUseCloudBtn) cloudUseCloudBtn.hidden = !cloudConflictPending;
  if (cloudUseLocalBtn) cloudUseLocalBtn.disabled = isReadOnlyLink();
}

function loadVaultUiPrefs(): void {
  try {
    const raw = window.localStorage.getItem(VAULT_UI_PREFS_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as Partial<VaultUiPrefs>;
    const storedMode = String(parsed.integrationMode || "");
    vaultUiPrefs = {
      vaultPath: String(parsed.vaultPath || ""),
      integrationMode: storedMode === "obsidian-live" || storedMode === "vault-live" ? "obsidian-live" : "off",
      sourceOfTruth: "vault-md",
    };
  } catch {
    vaultUiPrefs = {
      vaultPath: "",
      integrationMode: "off",
      sourceOfTruth: "vault-md",
    };
  }
}

function saveVaultUiPrefs(): void {
  window.localStorage.setItem(VAULT_UI_PREFS_KEY, JSON.stringify(vaultUiPrefs));
}

function closeToolbarMenus(): void {
  if (hamburgerMenu && !hamburgerMenu.hidden) hamburgerMenu.hidden = true;
  if (importMenu && !importMenu.hidden) importMenu.hidden = true;
  if (exportMenu && !exportMenu.hidden) exportMenu.hidden = true;
  if (integrateMenu && !integrateMenu.hidden) integrateMenu.hidden = true;
}

function syncVaultUi(): void {
  const pathLabel = vaultUiPrefs.vaultPath
    ? `Live: ${vaultWatchRunning ? "on (.md SoT)" : "ready (.md SoT)"}`
    : "Live: off";
  if (vaultSyncBadgeEl) {
    vaultSyncBadgeEl.textContent = pathLabel;
    vaultSyncBadgeEl.classList.toggle("on", vaultWatchRunning);
    vaultSyncBadgeEl.classList.toggle("conflict", Boolean(vaultLastError));
    if (vaultLastError) {
      vaultSyncBadgeEl.textContent = "Live: error";
    }
  }
  integrateVaultLiveBtn?.classList.toggle("is-active", vaultUiPrefs.integrationMode === "obsidian-live");
  integrateStopBtn!.disabled = !vaultWatchRunning;
  syncV4Panel(false);
}

function loadLocalFsPrefs(): void {
  try {
    const raw = window.localStorage.getItem(LOCAL_FS_PREFS_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as Partial<LocalFsPrefs>;
    localFsPrefs = {
      rootPath: String(parsed.rootPath || ""),
    };
  } catch {
    localFsPrefs = { rootPath: "" };
  }
  if (localFsRootInputEl) {
    localFsRootInputEl.value = localFsPrefs.rootPath;
  }
}

function saveLocalFsPrefs(): void {
  window.localStorage.setItem(LOCAL_FS_PREFS_KEY, JSON.stringify(localFsPrefs));
}

function setLocalFsStatus(message: string, isError = false): void {
  if (!localFsStatusEl) return;
  localFsStatusEl.textContent = message;
  localFsStatusEl.classList.toggle("is-error", isError);
}

function localFsRootLabel(rootPath: string): string {
  return basenameFromPath(rootPath);
}

function setLocalFsPreview(title: string, content: string): void {
  if (localFsPreviewTitleEl) localFsPreviewTitleEl.textContent = title;
  if (localFsPreviewEl) localFsPreviewEl.textContent = content;
}

function resetLocalFsTree(): void {
  localFsChildrenByPath = new Map();
  localFsExpandedPaths = new Set();
  localFsSelectedPath = null;
  localFsLoadingPath = null;
  setLocalFsPreview("Preview", "");
}

async function fetchLocalFsJson<T>(action: "list" | "read", params: Record<string, string>): Promise<T> {
  const url = new URL(`/api/local-fs/${action}`, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = await fetch(url.toString());
  const payload = await response.json().catch(() => null) as T | { error?: { message?: string } } | null;
  if (!response.ok) {
    const errorPayload = payload && typeof payload === "object" && "error" in payload ? payload : null;
    const message = errorPayload?.error?.message
      ? errorPayload.error.message
      : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

async function loadLocalFsDirectory(relativePath = "", expand = true): Promise<void> {
  const rootPath = localFsPrefs.rootPath.trim();
  if (!rootPath) {
    setLocalFsStatus("Root path is empty.", true);
    return;
  }
  localFsLoadingPath = relativePath;
  renderLocalFsTree();
  try {
    const payload = await fetchLocalFsJson<LocalFsListResponse>("list", {
      rootPath,
      relativePath,
      maxEntries: "1000",
    });
    localFsPrefs.rootPath = payload.rootPath;
    saveLocalFsPrefs();
    if (localFsRootInputEl) localFsRootInputEl.value = payload.rootPath;
    localFsChildrenByPath.set(payload.relativePath, payload.entries);
    if (expand) {
      localFsExpandedPaths.add(payload.relativePath);
    }
    setLocalFsStatus(`${payload.absolutePath} (${payload.entries.length}/${payload.totalEntries})`);
  } catch (err) {
    setLocalFsStatus((err as Error).message, true);
  } finally {
    localFsLoadingPath = null;
    renderLocalFsTree();
  }
}

async function readLocalFsFile(relativePath: string, title: string): Promise<void> {
  const rootPath = localFsPrefs.rootPath.trim();
  if (!rootPath) return;
  localFsSelectedPath = relativePath;
  renderLocalFsTree();
  try {
    const payload = await fetchLocalFsJson<LocalFsReadResponse>("read", {
      rootPath,
      relativePath,
      maxBytes: String(256 * 1024),
    });
    setLocalFsPreview(
      `${payload.relativePath}${payload.truncated ? " (truncated)" : ""}`,
      payload.content,
    );
    setLocalFsStatus(`${payload.absolutePath} (${payload.sizeBytes} bytes)`);
  } catch (err) {
    setLocalFsPreview(title, "");
    setLocalFsStatus((err as Error).message, true);
  }
}

function renderLocalFsRow(entry: LocalFsEntry, depth: number, container: HTMLElement): void {
  const isDirectory = entry.kind === "directory";
  const isExpanded = localFsExpandedPaths.has(entry.relativePath);
  const isSelected = localFsSelectedPath === entry.relativePath;

  const row = document.createElement("div");
  row.className = `local-fs-row${isSelected ? " is-selected" : ""}`;
  row.style.setProperty("--local-fs-indent", `${10 + depth * 18}px`);
  row.dataset.path = entry.relativePath;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "local-fs-toggle" + (!isDirectory || !entry.hasChildren ? " is-empty" : "");
  toggle.textContent = isExpanded ? "v" : ">";
  toggle.disabled = !isDirectory || !entry.hasChildren;
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!isDirectory) return;
    void toggleLocalFsDirectory(entry.relativePath);
  });

  const kind = document.createElement("span");
  kind.className = "local-fs-kind";
  kind.textContent = isDirectory ? "dir" : (entry.extension || "file").replace(/^\./, "");

  const name = document.createElement("span");
  name.className = "local-fs-name";
  name.textContent = entry.name;
  name.title = entry.relativePath;

  row.appendChild(toggle);
  row.appendChild(kind);
  row.appendChild(name);
  row.addEventListener("click", () => {
    if (isDirectory) {
      void toggleLocalFsDirectory(entry.relativePath);
      return;
    }
    void readLocalFsFile(entry.relativePath, entry.name);
  });
  container.appendChild(row);

  if (isDirectory && isExpanded) {
    const childContainer = document.createElement("div");
    childContainer.className = "local-fs-children";
    container.appendChild(childContainer);
    const children = localFsChildrenByPath.get(entry.relativePath);
    if (children) {
      renderLocalFsEntries(entry.relativePath, depth + 1, childContainer);
    } else if (localFsLoadingPath === entry.relativePath) {
      const loading = document.createElement("div");
      loading.className = "local-fs-row";
      loading.style.setProperty("--local-fs-indent", `${10 + (depth + 1) * 18}px`);
      loading.textContent = "Loading...";
      childContainer.appendChild(loading);
    }
  }
}

function renderLocalFsEntries(parentPath: string, depth: number, container: HTMLElement): void {
  const entries = localFsChildrenByPath.get(parentPath) ?? [];
  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "local-fs-row";
    empty.style.setProperty("--local-fs-indent", `${10 + depth * 18}px`);
    empty.textContent = "Empty";
    container.appendChild(empty);
    return;
  }
  for (const entry of entries) {
    renderLocalFsRow(entry, depth, container);
  }
}

function renderLocalFsTree(): void {
  if (!localFsTreeEl) return;
  localFsTreeEl.innerHTML = "";
  const rootPath = localFsPrefs.rootPath.trim();
  if (!rootPath) {
    setLocalFsPreview("Preview", "");
    return;
  }

  const rootRow = document.createElement("div");
  rootRow.className = "local-fs-row" + (localFsSelectedPath === "" ? " is-selected" : "");
  rootRow.style.setProperty("--local-fs-indent", "10px");

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "local-fs-toggle";
  toggle.textContent = localFsExpandedPaths.has("") ? "v" : ">";
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    void toggleLocalFsDirectory("");
  });

  const kind = document.createElement("span");
  kind.className = "local-fs-kind";
  kind.textContent = "root";

  const name = document.createElement("span");
  name.className = "local-fs-name";
  name.textContent = localFsRootLabel(rootPath);
  name.title = rootPath;

  rootRow.appendChild(toggle);
  rootRow.appendChild(kind);
  rootRow.appendChild(name);
  rootRow.addEventListener("click", () => {
    void toggleLocalFsDirectory("");
  });
  localFsTreeEl.appendChild(rootRow);

  if (localFsExpandedPaths.has("")) {
    const children = document.createElement("div");
    children.className = "local-fs-children";
    localFsTreeEl.appendChild(children);
    if (localFsChildrenByPath.has("")) {
      renderLocalFsEntries("", 1, children);
    } else if (localFsLoadingPath === "") {
      const loading = document.createElement("div");
      loading.className = "local-fs-row";
      loading.style.setProperty("--local-fs-indent", "28px");
      loading.textContent = "Loading...";
      children.appendChild(loading);
    }
  }
}

async function toggleLocalFsDirectory(relativePath: string): Promise<void> {
  if (localFsExpandedPaths.has(relativePath)) {
    localFsExpandedPaths.delete(relativePath);
    renderLocalFsTree();
    return;
  }
  localFsExpandedPaths.add(relativePath);
  if (!localFsChildrenByPath.has(relativePath)) {
    await loadLocalFsDirectory(relativePath, true);
    return;
  }
  renderLocalFsTree();
}

async function connectLocalFsRoot(): Promise<void> {
  const rootPath = (localFsRootInputEl?.value || "").trim();
  localFsPrefs.rootPath = rootPath;
  saveLocalFsPrefs();
  resetLocalFsTree();
  await loadLocalFsDirectory("", true);
}

function showLocalFsPanel(): void {
  if (!localFsPanelEl) return;
  localFsVisible = true;
  localFsPanelEl.hidden = false;
  localFsToggleBtn?.setAttribute("aria-expanded", "true");
  localFsToggleBtn?.classList.add("is-active");
  if (localFsPrefs.rootPath && !localFsChildrenByPath.has("")) {
    void loadLocalFsDirectory("", true);
  } else {
    renderLocalFsTree();
  }
  localFsRootInputEl?.focus();
}

function hideLocalFsPanel(): void {
  if (!localFsPanelEl) return;
  localFsVisible = false;
  localFsPanelEl.hidden = true;
  localFsToggleBtn?.setAttribute("aria-expanded", "false");
  localFsToggleBtn?.classList.remove("is-active");
  board.focus();
}

function toggleLocalFsPanel(): void {
  if (localFsVisible) {
    hideLocalFsPanel();
    return;
  }
  showLocalFsPanel();
}

function localFsNodeId(relativePath: string): string {
  const raw = relativePath || "__root__";
  return `localfs:${encodeURIComponent(raw)}`;
}

function createLocalFsNode(entry: LocalFsEntry | null, parentId: string | null, rootPath: string): TreeNode {
  const relativePath = entry?.relativePath ?? "";
  const node = createNodeRecord(localFsNodeId(relativePath), parentId, entry?.name || localFsRootLabel(rootPath));
  const kind = entry?.kind ?? "directory";
  node.nodeType = kind === "directory" ? "folder" : "text";
  node.collapsed = false;
  node.details = kind === "directory"
    ? `local-fs directory\nroot: ${rootPath}\nrelative: ${relativePath || "."}`
    : `local-fs file\nroot: ${rootPath}\nrelative: ${relativePath}`;
  node.attributes = {
    ...node.attributes,
    "m3e:source-kind": "local-fs",
    "local-fs:root-path": rootPath,
    "local-fs:relative-path": relativePath,
    "local-fs:kind": kind,
  };
  return node;
}

async function createLocalFsMap(rootPath: string): Promise<SavedMap> {
  const normalizedRoot = rootPath.trim();
  const rootNode = createLocalFsNode(null, null, normalizedRoot);
  const state: AppState = {
    rootId: rootNode.id,
    nodes: {
      [rootNode.id]: rootNode,
    },
  };

  const maxDepth = 4;
  const maxNodes = 700;
  let nodeCount = 1;
  let truncated = false;

  async function addChildren(parentNode: TreeNode, relativePath: string, depth: number): Promise<void> {
    if (depth >= maxDepth || nodeCount >= maxNodes) {
      if (depth >= maxDepth) parentNode.collapsed = true;
      truncated = truncated || nodeCount >= maxNodes;
      return;
    }
    const payload = await fetchLocalFsJson<LocalFsListResponse>("list", {
      rootPath: normalizedRoot,
      relativePath,
      maxEntries: "200",
    });
    if (relativePath === "") {
      localFsPrefs.rootPath = payload.rootPath;
      if (localFsRootInputEl) localFsRootInputEl.value = payload.rootPath;
      saveLocalFsPrefs();
      localFsChildrenByPath.set("", payload.entries);
      localFsExpandedPaths.add("");
    }

    for (const entry of payload.entries) {
      if (nodeCount >= maxNodes) {
        truncated = true;
        break;
      }
      const childNode = createLocalFsNode(entry, parentNode.id, payload.rootPath);
      state.nodes[childNode.id] = childNode;
      parentNode.children.push(childNode.id);
      nodeCount += 1;
      if (entry.kind === "directory" && entry.hasChildren) {
        await addChildren(childNode, entry.relativePath, depth + 1);
      }
    }
    if (payload.truncated) {
      truncated = true;
    }
  }

  await addChildren(rootNode, "", 0);

  const rootScopeId = `scope:${rootNode.id}`;
  const rootSurfaceId = `surface:${rootNode.id}:tree`;
  state.scopes = {
    [rootScopeId]: {
      id: rootScopeId,
      label: localFsRootLabel(normalizedRoot),
      rootNodeIds: [rootNode.id],
      relationIds: [],
      primarySurfaceId: rootSurfaceId,
    },
  };
  state.surfaces = {
    [rootSurfaceId]: {
      id: rootSurfaceId,
      scopeId: rootScopeId,
      kind: "tree",
      layout: "tree",
      nodeViews: {},
    },
  };

  if (truncated) {
    rootNode.note = `Local filesystem view truncated at ${nodeCount} nodes.`;
  }

  return {
    version: 1,
    savedAt: nowIso(),
    state,
  };
}

async function loadLocalFsMap(rootPath: string): Promise<void> {
  resetLocalFsTree();
  localFsPrefs.rootPath = rootPath.trim();
  saveLocalFsPrefs();
  setStatus("Loading local filesystem tree...");
  const payload = await createLocalFsMap(rootPath);
  loadPayload(payload);
  setLocalFsStatus(`${localFsPrefs.rootPath} (${Object.keys(payload.state.nodes).length} nodes)`);
  setStatus(`Local filesystem tree loaded (${Object.keys(payload.state.nodes).length} nodes, read-only).`);
  fitDocument();
}

interface FlashDraftListItem {
  id: string;
  mapId: string;
  sourceType: string;
  sourceRef: string;
  title: string;
  nodeCount: number;
  status: string;
  createdAt: string;
}

async function fetchV4FlashDrafts(): Promise<FlashDraftListItem[]> {
  const response = await fetch(`/api/flash/drafts?mapId=${encodeURIComponent(LOCAL_MAP_ID)}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = await response.json() as { drafts?: FlashDraftListItem[] };
  return Array.isArray(payload.drafts) ? payload.drafts : [];
}

async function createV4MapifyDraft(): Promise<void> {
  if (blockReadOnlyAction("Read-only link. Mapify draft creation is disabled.")) {
    return;
  }
  const content = v4SourceTextEl?.value.trim() || "";
  if (!content) {
    setStatus("Paste source text before creating a Mapify draft.", true);
    return;
  }
  const targetNodeId = selectedNodeForV4()?.id || null;
  const sourceType = /^#{1,6}\s+/m.test(content) || /^\s*[-*]\s+/m.test(content) ? "markdown" : "text";
  const response = await fetch("/api/flash/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      mapId: LOCAL_MAP_ID,
      sourceType,
      content,
      options: {
        targetNodeId,
        maxDepth: 4,
      },
    }),
  });
  if (!response.ok && response.status !== 202) {
    const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(String((payload as { error?: string }).error || `HTTP ${response.status}`));
  }
  const payload = await response.json().catch(() => ({ nodeCount: "?" })) as { draftId?: string; nodeCount?: number };
  setStatus(`Mapify draft created (${payload.nodeCount ?? "?"} nodes).`);
  syncV4Panel(true);
}

async function applyLatestV4MapifyDraft(): Promise<void> {
  if (blockReadOnlyAction("Read-only link. Mapify draft apply is disabled.")) {
    return;
  }
  const draft = v4LatestDrafts.find((item) => item.status === "pending");
  if (!draft) {
    setStatus("No pending Mapify draft to apply.", true);
    return;
  }
  const targetParentId = selectedNodeForV4()?.id || undefined;
  const response = await fetch(`/api/flash/draft/${encodeURIComponent(draft.id)}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      mode: "all",
      targetParentId,
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(String((payload as { error?: string }).error || `HTTP ${response.status}`));
  }
  const payload = await response.json().catch(() => ({ committedNodeIds: [] })) as { committedNodeIds?: string[] };
  await loadDocFromLocalDb(false);
  render();
  setStatus(`Applied Mapify draft (${payload.committedNodeIds?.length ?? 0} nodes).`);
  syncV4Panel(true);
}

function selectedNodeForV4(): TreeNode | null {
  if (!map || !viewState.selectedNodeId) {
    return null;
  }
  return map.state.nodes[viewState.selectedNodeId] || null;
}

function syncV4Panel(updateDrafts = false): void {
  if (!v4PanelEl || !v4PanelVisible) {
    return;
  }

  if (v4VaultStatusEl) {
    if (vaultLastError) {
      v4VaultStatusEl.textContent = `Vault: error (${vaultLastError})`;
    } else if (vaultWatchRunning) {
      v4VaultStatusEl.textContent = `Vault: live, source=${vaultUiPrefs.sourceOfTruth}, inbound=${vaultLastInboundAt || "none"}, outbound=${vaultLastOutboundAt || "none"}`;
    } else if (vaultUiPrefs.vaultPath) {
      v4VaultStatusEl.textContent = "Vault: path set, live off";
    } else {
      v4VaultStatusEl.textContent = "Vault: not bound";
    }
  }
  if (v4VaultPathEl) {
    v4VaultPathEl.textContent = vaultUiPrefs.vaultPath || "No vault path set.";
  }
  if (v4ConflictStatusEl) {
    v4ConflictStatusEl.textContent = conflictPanelVisible
      ? "Conflict workbench is open. Current UI is local/remote; V4 target is local/remote/resolution."
      : "No conflict panel open.";
  }
  if (v4GithubStatusEl) {
    const selected = selectedNodeForV4();
    const lock = selected?.attributes?.["secret:lock"] || selected?.attributes?.["m3e:secretLock"] || "none";
    v4GithubStatusEl.textContent = `Publish plan: design-only. Staged proposal model active. Selected secret lock: ${lock}.`;
  }
  if (v4SelectedSourceEl) {
    const selected = selectedNodeForV4();
    const sourceType = selected?.attributes?.["m3e:sourceType"] || selected?.attributes?.["vault:kind"] || selected?.attributes?.["v4:service"] || "none";
    const sourceRef = selected?.attributes?.["m3e:sourceUrl"] || selected?.attributes?.["vault:path"] || "";
    v4SelectedSourceEl.textContent = selected
      ? `Selected: ${selected.text || selected.id} | source=${sourceType}${sourceRef ? ` | ${sourceRef}` : ""}`
      : "No selected node.";
  }

  if (updateDrafts) {
    if (v4FlashStatusEl) {
      v4FlashStatusEl.textContent = "Drafts: loading...";
    }
    void fetchV4FlashDrafts()
      .then((drafts) => {
        v4LatestDrafts = drafts;
        if (v4FlashStatusEl) {
          const pending = drafts.filter((draft) => draft.status === "pending").length;
          v4FlashStatusEl.textContent = `Drafts: ${drafts.length} total, ${pending} pending`;
        }
        if (v4DraftListEl) {
          v4DraftListEl.innerHTML = "";
          const visibleDrafts = drafts.slice(0, 6);
          if (visibleDrafts.length === 0) {
            const empty = document.createElement("div");
            empty.className = "v4-status-line";
            empty.textContent = "No Flash drafts in memory.";
            v4DraftListEl.appendChild(empty);
          }
          visibleDrafts.forEach((draft) => {
            const item = document.createElement("div");
            item.className = "v4-list-item";
            item.textContent = draft.title || draft.id;
            const meta = document.createElement("small");
            meta.textContent = `${draft.status} | ${draft.nodeCount} nodes | ${draft.sourceType}`;
            item.appendChild(meta);
            v4DraftListEl.appendChild(item);
          });
        }
      })
      .catch((err) => {
        if (v4FlashStatusEl) {
          v4FlashStatusEl.textContent = `Drafts: error (${(err as Error).message})`;
        }
      });
  }
}

function showV4Panel(): void {
  if (!v4PanelEl) {
    return;
  }
  v4PanelVisible = true;
  v4PanelEl.hidden = false;
  syncV4Panel(true);
}

function hideV4Panel(): void {
  if (!v4PanelEl) {
    return;
  }
  v4PanelVisible = false;
  v4PanelEl.hidden = true;
  board.focus();
}

function addV4DiscussionNode(kind: "sticky" | "decision"): void {
  if (blockReadOnlyAction("Read-only link. V4 discussion edits are disabled.")) {
    return;
  }
  if (!map || !viewState.selectedNodeId) {
    setStatus("Select a parent node for the V4 discussion item.", true);
    return;
  }
  const parent = selectedNodeForV4();
  if (!parent || isAliasNode(parent)) {
    setStatus("Select a non-alias parent node for the V4 discussion item.", true);
    return;
  }
  pushUndoSnapshot();
  const id = newId();
  const text = kind === "decision" ? "Decision: " : "Sticky: ";
  map.state.nodes[id] = createNodeRecord(id, parent.id, `${text}${nowIso()}`);
  map.state.nodes[id]!.attributes = {
    ...map.state.nodes[id]!.attributes,
    "m3e:surface": "discussion",
    "discussion:kind": kind,
    "discussion:status": kind === "decision" ? "decided" : "open",
    "discussion:sourceNodeId": parent.id,
  };
  parent.children.push(id);
  parent.collapsed = false;
  viewState.collapsedIds.delete(parent.id);
  setSingleSelection(id, false);
  touchDocument();
  syncV4Panel(false);
  setStatus(`V4 ${kind} node added.`);
  board.focus();
}

function parseSseFrames(text: string): Array<{ event: string; data: unknown }> {
  return text
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const lines = chunk.split("\n");
      const event = lines.find((line) => line.startsWith("event: "))?.slice(7) ?? "";
      const dataText = lines.find((line) => line.startsWith("data: "))?.slice(6) ?? "null";
      let data: unknown = null;
      try {
        data = JSON.parse(dataText);
      } catch {
        data = dataText;
      }
      return { event, data };
    })
    .filter((entry) => Boolean(entry.event));
}

async function promptVaultPath(defaultValue = ""): Promise<string | null> {
  const next = window.prompt("Vault path for Obsidian Live Mode", defaultValue || vaultUiPrefs.vaultPath || "");
  if (next === null) {
    return null;
  }
  const trimmed = next.trim();
  if (!trimmed) {
    setStatus("Vault path is required.", true);
    return null;
  }
  vaultUiPrefs.vaultPath = trimmed;
  saveVaultUiPrefs();
  syncVaultUi();
  return trimmed;
}

function applyVaultWatchStatus(status: VaultWatchStatusResponse | null): void {
  vaultWatchRunning = Boolean(status?.running);
  vaultLastInboundAt = status?.lastInboundAt ?? null;
  vaultLastOutboundAt = status?.lastOutboundAt ?? null;
  vaultLastError = status?.lastError ?? null;
  if (status?.vaultPath) {
    vaultUiPrefs.vaultPath = status.vaultPath;
  }
  if (status?.integrationMode) {
    vaultUiPrefs.integrationMode = status.integrationMode;
  }
  if (status?.sourceOfTruth) {
    vaultUiPrefs.sourceOfTruth = status.sourceOfTruth;
  }
  syncVaultUi();
}

async function fetchVaultWatchStatus(): Promise<void> {
  try {
    const response = await fetch(`/api/vault/status?mapId=${encodeURIComponent(LOCAL_MAP_ID)}`, { cache: "no-store" });
    if (response.status === 404) {
      applyVaultWatchStatus(null);
      return;
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json() as VaultWatchStatusResponse;
    applyVaultWatchStatus(payload);
  } catch (err) {
    vaultLastError = (err as Error).message;
    syncVaultUi();
  }
}

function initVaultWatchStream(): void {
  if (vaultWatchEs) {
    return;
  }
  if (document.visibilityState === "hidden") {
    return;
  }
  vaultWatchEs = new EventSource(`/api/vault/watch?mapId=${encodeURIComponent(LOCAL_MAP_ID)}`);
  vaultWatchEs.addEventListener("vault-watch", (event: MessageEvent) => {
    try {
      const payload = JSON.parse(event.data) as VaultWatchSseEvent;
      if (payload.mapId !== LOCAL_MAP_ID) {
        return;
      }
      if (payload.type === "watch-started") {
        vaultWatchRunning = true;
        vaultLastError = null;
      } else if (payload.type === "watch-stopped") {
        vaultWatchRunning = false;
      } else if (payload.type === "vault-to-m3e") {
        vaultLastInboundAt = payload.timestamp;
      } else if (payload.type === "m3e-to-vault") {
        vaultLastOutboundAt = payload.timestamp;
      } else if (payload.type === "watch-error") {
        vaultLastError = payload.detail || "Vault watch error";
      }
      syncVaultUi();
      if (payload.detail) {
        setStatus(payload.detail, payload.type === "watch-error");
      }
    } catch {
      // ignore malformed event
    }
  });
}

function stopVaultWatchStream(): void {
  if (!vaultWatchEs) {
    return;
  }
  vaultWatchEs.close();
  vaultWatchEs = null;
}

async function runVaultImport(vaultPath: string): Promise<boolean> {
  const response = await fetch("/api/vault/import", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      vaultPath,
      mapId: LOCAL_MAP_ID,
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(String((payload as { error?: string }).error || `HTTP ${response.status}`));
  }
  const frames = parseSseFrames(await response.text());
  const errorFrame = frames.find((frame) => frame.event === "vault-import-error");
  if (errorFrame) {
    throw new Error(String((errorFrame.data as { error?: string })?.error || "Vault import failed."));
  }
  const complete = frames.find((frame) => frame.event === "vault-import-complete");
  if (!complete) {
    throw new Error("Vault import did not complete.");
  }
  await loadDocFromLocalDb(false);
  render();
  setStatus("Imported from Vault markdown.");
  return true;
}

async function runVaultExport(vaultPath: string): Promise<boolean> {
  const response = await fetch("/api/vault/export", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      mapId: LOCAL_MAP_ID,
      vaultPath,
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(String((payload as { error?: string }).error || `HTTP ${response.status}`));
  }
  const frames = parseSseFrames(await response.text());
  const errorFrame = frames.find((frame) => frame.event === "vault-export-error");
  if (errorFrame) {
    throw new Error(String((errorFrame.data as { error?: string })?.error || "Vault export failed."));
  }
  const complete = frames.find((frame) => frame.event === "vault-export-complete");
  if (!complete) {
    throw new Error("Vault export did not complete.");
  }
  setStatus("Exported to Vault markdown.");
  return true;
}

async function startVaultLiveIntegration(vaultPath: string): Promise<void> {
  await runVaultImport(vaultPath);
  const response = await fetch("/api/vault/watch/start", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      mapId: LOCAL_MAP_ID,
      vaultPath,
      debounceMs: 1000,
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(String((payload as { error?: string }).error || `HTTP ${response.status}`));
  }
  const payload = await response.json() as VaultWatchStatusResponse;
  applyVaultWatchStatus(payload);
  vaultUiPrefs.integrationMode = "obsidian-live";
  vaultUiPrefs.sourceOfTruth = "vault-md";
  saveVaultUiPrefs();
  syncVaultUi();
  setStatus("Obsidian Live Mode started. Vault markdown is the source of truth.");
}

async function stopVaultLiveIntegration(showStatus = true): Promise<void> {
  const response = await fetch("/api/vault/watch", {
    method: "DELETE",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      mapId: LOCAL_MAP_ID,
    }),
  });
  if (response.ok) {
    await response.json().catch(() => null);
  }
  vaultUiPrefs.integrationMode = "off";
  saveVaultUiPrefs();
  applyVaultWatchStatus(null);
  if (showStatus) {
    setStatus("Obsidian Live Mode stopped.");
  }
}

function createNodeRecord(id: string, parentId: string | null, text = "New Node"): TreeNode {
  return {
    id,
    parentId,
    children: [],
    nodeType: "text",
    text,
    collapsed: false,
    details: "",
    note: "",
    attributes: {},
    link: "",
  };
}

function createEmptyDoc(): SavedMap {
  const rootId = newId();
  const rootScopeId = `scope:${rootId}`;
  const rootSurfaceId = `surface:${rootId}:tree`;
  return {
    version: 1,
    savedAt: nowIso(),
    state: {
      rootId,
      nodes: {
        [rootId]: createNodeRecord(rootId, null, "Research Root"),
      },
      annotations: {},
      scopes: {
        [rootScopeId]: {
          id: rootScopeId,
          label: "Root",
          rootNodeIds: [rootId],
          relationIds: [],
          primarySurfaceId: rootSurfaceId,
        },
      },
      surfaces: {
        [rootSurfaceId]: {
          id: rootSurfaceId,
          scopeId: rootScopeId,
          kind: "tree",
          layout: "tree",
          nodeViews: {},
        },
      },
    },
  };
}

function sanitizeLinearNotesByScope(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const sanitized: Record<string, string> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([scopeId, memo]) => {
    if (!scopeId) {
      return;
    }
    sanitized[scopeId] = String(memo ?? "");
  });
  return sanitized;
}

function hydrateLinearNotesFromDocState(): void {
  Object.keys(linearNotesByScope).forEach((scopeId) => {
    delete linearNotesByScope[scopeId];
  });
  if (!map) {
    return;
  }
  Object.assign(linearNotesByScope, sanitizeLinearNotesByScope(map.state.linearNotesByScope));
}

function syncLinearNotesToDocState(): void {
  if (!map) {
    return;
  }
  map.state.linearNotesByScope = { ...linearNotesByScope };
}

function hasLinearNotes(notes: Record<string, string> | undefined): boolean {
  return Boolean(notes && Object.keys(notes).length > 0);
}

function normalizeLinearTextFontScale(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return 1;
  }
  return Math.max(LINEAR_TEXT_FONT_SCALE_MIN, Math.min(LINEAR_TEXT_FONT_SCALE_MAX, n));
}

function applyLinearTextFontScale(syncToState = true): void {
  const clamped = normalizeLinearTextFontScale(linearTextFontScale);
  linearTextFontScale = clamped;
  const px = Math.round(VIEWER_TUNING.typography.nodeFont * clamped);
  document.documentElement.style.setProperty("--linear-text-font-size", `${px}px`);
  if (syncToState && map) {
    map.state.linearTextFontScale = clamped;
  }
}

function hydrateLinearTextFontScaleFromDocState(): void {
  linearTextFontScale = normalizeLinearTextFontScale(map?.state.linearTextFontScale);
  applyLinearTextFontScale(false);
}

function syncLinearAdjustMenuUi(): void {
  if (linearPanelEl) {
    linearPanelEl.classList.toggle("menu-visible", linearMenuVisible || linearAdjustMenuOpen);
  }
  if (linearAdjustControlsEl) {
    linearAdjustControlsEl.hidden = !linearAdjustMenuOpen;
  }
  if (linearMenuToggleBtn) {
    linearMenuToggleBtn.setAttribute("aria-expanded", linearAdjustMenuOpen ? "true" : "false");
  }
}

function isMarkdownFilename(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".markdown");
}

function markdownToLinearText(markdown: string): string {
  const lines = String(markdown || "").replaceAll("\r", "").split("\n");
  const converted: string[] = [];
  lines.forEach((rawLine) => {
    const line = rawLine.replace(/\t/g, "  ").trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const depth = Math.max(0, heading[1]!.length - 1);
      converted.push(`${"  ".repeat(depth)}${heading[2]!.trim()}`);
      return;
    }
    const list = line.match(/^(\s*)(?:[-*+]|\d+\.)\s+(.+)$/);
    if (list) {
      const leadingSpaces = list[1]?.length ?? 0;
      const depth = Math.floor(leadingSpaces / 2);
      converted.push(`${"  ".repeat(depth)}${list[2]!.trim()}`);
      return;
    }
    const quote = line.match(/^(\s*)>\s*(.+)$/);
    if (quote) {
      const leadingSpaces = quote[1]?.length ?? 0;
      const depth = Math.floor(leadingSpaces / 2);
      converted.push(`${"  ".repeat(depth)}${quote[2]!.trim()}`);
      return;
    }
    converted.push(trimmed);
  });
  return converted.join("\n");
}

function setLinearTextFontScale(nextScale: number, showStatus = true): void {
  const normalized = normalizeLinearTextFontScale(nextScale);
  if (Math.abs(normalized - linearTextFontScale) < 0.0001) {
    return;
  }
  linearTextFontScale = normalized;
  applyLinearTextFontScale(true);
  scheduleAutosave();
  if (showStatus) {
    const px = Math.round(VIEWER_TUNING.typography.nodeFont * linearTextFontScale);
    setStatus(`Linear font: ${px}px (${Math.round(linearTextFontScale * 100)}%).`);
  }
}

function inferredScopeId(nodeId: string): string {
  return `scope:${nodeId}`;
}

function inferredSurfaceId(nodeId: string, kind: SurfaceKind): string {
  return `surface:${nodeId}:${kind}`;
}

function sanitizeSurfaceKind(raw: unknown): SurfaceKind | null {
  return raw === "tree"
    || raw === "system"
    || raw === "scatter"
    || raw === "mindmap"
    || raw === "logic-chart"
    || raw === "timeline"
    ? raw
    : null;
}

function sanitizeSurfaceLayout(raw: unknown): SurfaceLayout | null {
  return raw === "tree"
    || raw === "flow-lr"
    || raw === "scatter"
    || raw === "mindmap"
    || raw === "logic-chart"
    || raw === "timeline"
    ? raw
    : null;
}

function defaultSurfaceKindForScopeNode(node: TreeNode): SurfaceKind {
  const rawLayout = rawAttr(node, "m3e:layout");
  if (rawLayout === "flow-lr") return "system";
  if (rawLayout === "mindmap") return "mindmap";
  if (rawLayout === "logic-chart") return "logic-chart";
  if (rawLayout === "timeline") return "timeline";
  if (rawLayout === "scatter") return "scatter";
  return "tree";
}

function sanitizeSurfaceNodeViews(raw: unknown, nodes: Record<string, TreeNode>): Record<string, SurfaceNodeView> {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const views: Record<string, SurfaceNodeView> = {};
  Object.entries(raw as Record<string, SurfaceNodeView>).forEach(([nodeId, view]) => {
    if (!nodes[nodeId] || !view || typeof view !== "object") {
      return;
    }
    const next: SurfaceNodeView = {};
    if (Number.isFinite(view.x)) next.x = Number(view.x);
    if (Number.isFinite(view.y)) next.y = Number(view.y);
    if (Number.isFinite(view.flowCol)) next.flowCol = Number(view.flowCol);
    if (Number.isFinite(view.flowRow)) next.flowRow = Number(view.flowRow);
    if (view.shape === "rect" || view.shape === "diamond" || view.shape === "rounded") {
      next.shape = view.shape;
    }
    if (Object.keys(next).length > 0) {
      views[nodeId] = next;
    }
  });
  return views;
}

function sanitizeMapModelState(state: AppState): void {
  const rawScopes = state.scopes && typeof state.scopes === "object" ? state.scopes : {};
  const rawSurfaces = state.surfaces && typeof state.surfaces === "object" ? state.surfaces : {};
  const scopes: Record<string, MapScope> = {};
  const surfaces: Record<string, MapSurface> = {};
  const folderScopeNodeIds = Object.values(state.nodes)
    .filter((node) => node.id === state.rootId || isFolderNode(node))
    .map((node) => node.id);
  const localScopeRootForNode = (nodeId: string): string => {
    let cursor: string | null = nodeId;
    while (cursor) {
      const current: TreeNode | undefined = state.nodes[cursor];
      if (!current) break;
      if (current.nodeType === "folder") {
        return current.id;
      }
      cursor = current.parentId ?? null;
    }
    return state.rootId;
  };
  const validScopeIds = new Set(folderScopeNodeIds.map((nodeId) => inferredScopeId(nodeId)));

  Object.entries(rawSurfaces).forEach(([surfaceKey, rawSurface]) => {
    if (!rawSurface || typeof rawSurface !== "object") {
      return;
    }
    const surface = rawSurface as MapSurface;
    const scopeId = typeof surface.scopeId === "string" ? surface.scopeId : "";
    if (!validScopeIds.has(scopeId)) {
      return;
    }
    const kind = sanitizeSurfaceKind(surface.kind) || "tree";
    surfaces[surfaceKey] = {
      id: typeof surface.id === "string" && surface.id ? surface.id : surfaceKey,
      scopeId,
      kind,
      layout: sanitizeSurfaceLayout(surface.layout) || surfaceLayoutForKind(kind),
      nodeViews: sanitizeSurfaceNodeViews(surface.nodeViews, state.nodes),
    };
  });

  folderScopeNodeIds.forEach((nodeId) => {
    const node = state.nodes[nodeId];
    if (!node) return;
    const scopeId = inferredScopeId(nodeId);
    const existingScope = rawScopes[scopeId];
    const surfaceKind = defaultSurfaceKindForScopeNode(node);
    const preferredPrimarySurfaceId = typeof existingScope?.primarySurfaceId === "string" && surfaces[existingScope.primarySurfaceId]
      ? existingScope.primarySurfaceId
      : inferredSurfaceId(nodeId, surfaceKind);
    const relationIds = Object.values(state.links || {})
      .filter((link) => {
        const source = state.nodes[link.sourceNodeId];
        const target = state.nodes[link.targetNodeId];
        if (!source || !target) return false;
        return localScopeRootForNode(source.id) === nodeId || localScopeRootForNode(target.id) === nodeId;
      })
      .map((link) => link.id);

    scopes[scopeId] = {
      id: existingScope?.id || scopeId,
      label: existingScope?.label || uiLabel(node) || (nodeId === state.rootId ? "Root" : nodeId),
      rootNodeIds: Array.isArray(existingScope?.rootNodeIds) && existingScope!.rootNodeIds.length > 0
        ? existingScope!.rootNodeIds.filter((id) => Boolean(state.nodes[id]))
        : [nodeId],
      relationIds,
      primarySurfaceId: preferredPrimarySurfaceId,
    };

    const existingSurface = surfaces[preferredPrimarySurfaceId];
    surfaces[preferredPrimarySurfaceId] = {
      id: existingSurface?.id || preferredPrimarySurfaceId,
      scopeId,
      kind: existingSurface?.kind || surfaceKind,
      layout: existingSurface?.layout || surfaceLayoutForKind(existingSurface?.kind || surfaceKind),
      nodeViews: existingSurface?.nodeViews || {},
    };
  });

  state.scopes = scopes;
  state.surfaces = surfaces;
}

function syncMapModelStateFromRuntime(): void {
  if (!map) {
    return;
  }
  sanitizeMapModelState(map.state);
  const scopeId = currentScopeRootId();
  const modelScopeId = inferredScopeId(scopeId);
  const scope = map.state.scopes?.[modelScopeId];
  if (!scope) {
    return;
  }
  if (!map.state.surfaces) {
    map.state.surfaces = {};
  }
  const surfaceKind = surfaceKindForViewMode(viewState.surfaceViewMode);
  const surfaceId = inferredSurfaceId(scopeId, surfaceKind);
  scope.primarySurfaceId = surfaceId;
  if (!map.state.surfaces[surfaceId]) {
    map.state.surfaces[surfaceId] = {
      id: surfaceId,
      scopeId: modelScopeId,
      kind: surfaceKind,
      layout: surfaceLayoutForKind(surfaceKind),
      nodeViews: {},
    };
  }
  const surface = map.state.surfaces[surfaceId]!;
  surface.scopeId = modelScopeId;
  surface.kind = surfaceKind;
  surface.layout = surfaceLayoutForKind(surfaceKind);
  if (!surface.nodeViews) {
    surface.nodeViews = {};
  }
  Object.values(map.state.nodes).forEach((node) => {
    const nodeView = surface.nodeViews![node.id] || {};
    const flowCol = rawAttr(node, "m3e:flow-col");
    const flowRow = rawAttr(node, "m3e:flow-row");
    const shape = rawAttr(node, "m3e:shape") || rawAttr(node, "pj04:shape");
    if (flowCol) nodeView.flowCol = Number(flowCol);
    if (flowRow) nodeView.flowRow = Number(flowRow);
    if (shape === "rect" || shape === "diamond" || shape === "rounded") {
      nodeView.shape = shape;
    }
    surface.nodeViews![node.id] = nodeView;
  });
}

function ensureDocShape(payload: unknown): SavedMap {
  const p = payload as Record<string, unknown>;
  const candidate = (p && p["state"])
    ? p as { version: 1; savedAt: string; state: AppState }
    : { version: 1 as const, savedAt: nowIso(), state: p as unknown as AppState };
  if (!candidate || !candidate.state || !candidate.state.nodes || !candidate.state.rootId) {
    throw new Error("Invalid JSON format");
  }
  Object.values(candidate.state.nodes).forEach((node) => {
    node.children = Array.isArray(node.children) ? node.children : [];
    node.nodeType = node.nodeType || "text";
    node.scopeId = node.scopeId || undefined;
    node.text = node.text || "";
    node.collapsed = node.collapsed === true;
    node.details = node.details || "";
    node.note = node.note || "";
    node.attributes = (node.attributes && typeof node.attributes === "object") ? node.attributes : {};
    node.link = node.link || "";
    node.targetNodeId = node.targetNodeId || undefined;
    node.aliasLabel = node.aliasLabel || undefined;
    node.access = node.nodeType === "alias" ? (node.access || "read") : undefined;
    node.targetSnapshotLabel = node.targetSnapshotLabel || undefined;
    node.isBroken = node.nodeType === "alias" ? Boolean(node.isBroken) : undefined;
  });
  const rawLinks = candidate.state.links && typeof candidate.state.links === "object"
    ? candidate.state.links
    : {};
  candidate.state.links = {};
  Object.entries(rawLinks).forEach(([linkId, link]) => {
    if (!link || typeof link !== "object") {
      return;
    }
    const record = link as GraphLink;
    candidate.state.links![linkId] = {
      id: record.id || linkId,
      sourceNodeId: String(record.sourceNodeId || ""),
      targetNodeId: String(record.targetNodeId || ""),
      relationType: record.relationType || undefined,
      label: record.label || undefined,
      direction: record.direction || "none",
      style: record.style || "default",
      color: sanitizeColor(record.color) || undefined,
      sourcePort: sanitizeLinkPort(record.sourcePort),
      targetPort: sanitizeLinkPort(record.targetPort),
    };
  });
  candidate.state.annotations = sanitizeAnnotations(candidate.state.annotations);
  candidate.state.linearNotesByScope = sanitizeLinearNotesByScope(candidate.state.linearNotesByScope);
  candidate.state.linearTextFontScale = normalizeLinearTextFontScale(candidate.state.linearTextFontScale);
  if (candidate.state.linearPanelWidth != null) {
    candidate.state.linearPanelWidth = Math.max(LINEAR_PANEL_WIDTH_MIN, Math.min(LINEAR_PANEL_WIDTH_MAX, Number(candidate.state.linearPanelWidth) || 340));
  }
  sanitizeMapModelState(candidate.state);
  return candidate as SavedMap;
}

function newId(): string {
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeXml(text: string): string {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ensureAnnotations(state: AppState): Record<string, MapAnnotation> {
  if (!state.annotations || typeof state.annotations !== "object") {
    state.annotations = {};
  }
  return state.annotations;
}

function safeAnnotationColor(raw: unknown, fallback: string): string {
  const value = String(raw || "").trim();
  return /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)
    ? value
    : fallback;
}

function sanitizePenPoints(raw: unknown): PenPoint[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((point) => {
      const candidate = point as Partial<PenPoint>;
      const x = Number(candidate.x);
      const y = Number(candidate.y);
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
    })
    .filter((point): point is PenPoint => Boolean(point));
}

function pathDFromPoints(points: PenPoint[]): string {
  if (points.length === 0) {
    return "";
  }
  const fmt = (value: number) => Number(value.toFixed(1));
  if (points.length === 1) {
    const p = points[0]!;
    return `M ${fmt(p.x)} ${fmt(p.y)}`;
  }
  if (points.length === 2) {
    const first = points[0]!;
    const last = points[1]!;
    return `M ${fmt(first.x)} ${fmt(first.y)} L ${fmt(last.x)} ${fmt(last.y)}`;
  }
  const first = points[0]!;
  let d = `M ${fmt(first.x)} ${fmt(first.y)}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const current = points[i]!;
    const next = points[i + 1]!;
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    d += ` Q ${fmt(current.x)} ${fmt(current.y)} ${fmt(midX)} ${fmt(midY)}`;
  }
  const last = points[points.length - 1]!;
  d += ` L ${fmt(last.x)} ${fmt(last.y)}`;
  return d;
}

function defaultDateAnnotationText(date = new Date()): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function normalizePenAnnotation(id: string, raw: Partial<PenAnnotation>): PenAnnotation | null {
  const points = sanitizePenPoints(raw.points);
  const d = String(raw.d || pathDFromPoints(points)).trim();
  if (!d || points.length < 2) {
    return null;
  }
  const strokeWidth = Number(raw.strokeWidth);
  const opacity = raw.opacity == null ? undefined : Math.max(0.05, Math.min(1, Number(raw.opacity) || 1));
  return {
    id: String(raw.id || id),
    kind: "pen",
    scopeId: raw.scopeId ? String(raw.scopeId) : undefined,
    d,
    points,
    stroke: safeAnnotationColor(raw.stroke, PEN_STROKE_COLOR),
    strokeWidth: Number.isFinite(strokeWidth) && strokeWidth > 0 ? strokeWidth : PEN_STROKE_WIDTH,
    opacity,
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
  };
}

function normalizeTextAnnotation(id: string, raw: Partial<TextAnnotation>): TextAnnotation | null {
  const text = String(raw.text || "").trim();
  const x = Number(raw.x);
  const y = Number(raw.y);
  if (!text || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const fontSize = Number(raw.fontSize);
  const fontWeight = Number(raw.fontWeight);
  const variant = raw.variant === "date" ? "date" : "label";
  return {
    id: String(raw.id || id),
    kind: "text",
    scopeId: raw.scopeId ? String(raw.scopeId) : undefined,
    x,
    y,
    text,
    fill: safeAnnotationColor(raw.fill, TEXT_ANNOTATION_COLOR),
    fontSize: Number.isFinite(fontSize) && fontSize > 0 ? fontSize : TEXT_ANNOTATION_FONT_SIZE,
    fontWeight: Number.isFinite(fontWeight) && fontWeight > 0 ? fontWeight : undefined,
    variant,
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
  };
}

function sanitizeAnnotations(raw: unknown): Record<string, MapAnnotation> {
  const sanitized: Record<string, MapAnnotation> = {};
  if (!raw || typeof raw !== "object") {
    return sanitized;
  }
  Object.entries(raw as Record<string, unknown>).forEach(([id, annotation]) => {
    if (!annotation || typeof annotation !== "object") {
      return;
    }
    const candidate = annotation as Partial<MapAnnotation>;
    const normalized = candidate.kind === "pen"
      ? normalizePenAnnotation(id, candidate as Partial<PenAnnotation>)
      : candidate.kind === "text"
        ? normalizeTextAnnotation(id, candidate as Partial<TextAnnotation>)
        : null;
    if (normalized) {
      sanitized[normalized.id] = normalized;
    }
  });
  return sanitized;
}

function isStrokeAnnotationTool(tool: AnnotationTool): boolean {
  return tool === "pen" || tool === "highlighter";
}

function activeStrokeColor(): string {
  return annotationTool === "highlighter" ? HIGHLIGHTER_STROKE_COLOR : activePenStrokeColor;
}

function activeStrokeWidth(): number {
  return annotationTool === "highlighter" ? HIGHLIGHTER_STROKE_WIDTH : activePenStrokeWidth;
}

function activeStrokeOpacity(): number {
  return annotationTool === "highlighter" ? HIGHLIGHTER_OPACITY : 0.95;
}

function setAnnotationTool(tool: AnnotationTool): void {
  annotationTool = tool;
  if (!isStrokeAnnotationTool(tool)) {
    penDraft = null;
  }
  if (tool !== "eraser") {
    eraserPointerId = null;
  }
  board.classList.toggle("pen-mode", isStrokeAnnotationTool(annotationTool));
  board.classList.toggle("text-mode", annotationTool === "date");
  board.classList.toggle("eraser-mode", annotationTool === "eraser");
  if (penToolBtn) {
    penToolBtn.classList.toggle("is-active", annotationTool !== "select");
    penToolBtn.setAttribute("aria-pressed", annotationTool !== "select" ? "true" : "false");
  }
  const toolButtons: Array<[HTMLButtonElement | null, AnnotationTool]> = [
    [drawSelectBtn, "select"],
    [drawPenBtn, "pen"],
    [drawHighlighterBtn, "highlighter"],
    [drawDateBtn, "date"],
    [drawEraserBtn, "eraser"],
  ];
  toolButtons.forEach(([button, buttonTool]) => {
    if (!button) return;
    const active = annotationTool === buttonTool;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  drawToolbarEl?.classList.toggle("is-drawing", annotationTool !== "select");
  scheduleRender();
}

function togglePenTool(): void {
  setAnnotationTool(annotationTool === "pen" ? "select" : "pen");
  setStatus(annotationTool === "pen" ? "Pen tool: draw on the map surface." : "Pen tool off.");
}

function cancelPenStroke(showStatus = false): void {
  if (!penDraft) {
    return;
  }
  penDraft = null;
  scheduleRender();
  if (showStatus) {
    setStatus("Pen stroke cancelled.");
  }
}

function appendPenPoint(draft: PenStrokeDraft, point: PenPoint): boolean {
  const prev = draft.points[draft.points.length - 1];
  if (prev) {
    const minDistance = Math.max(PEN_POINT_MIN_DISTANCE, PEN_POINT_MIN_DISTANCE / Math.max(0.2, viewState.zoom));
    if (Math.hypot(point.x - prev.x, point.y - prev.y) < minDistance) {
      return false;
    }
  }
  draft.points.push(point);
  draft.d = pathDFromPoints(draft.points);
  return true;
}

function startPenStroke(event: PointerEvent): void {
  if (!map || event.button !== 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  cancelCameraMotion();
  const firstPoint = clientToCanvasPoint(event.clientX, event.clientY);
  penDraft = {
    pointerId: event.pointerId,
    scopeId: normalizedCurrentScopeId(),
    points: [firstPoint],
    d: pathDFromPoints([firstPoint]),
    stroke: activeStrokeColor(),
    strokeWidth: activeStrokeWidth(),
    opacity: activeStrokeOpacity(),
  };
  board.setPointerCapture(event.pointerId);
  scheduleRender();
}

function updatePenDraftElement(): void {
  if (!penDraft) {
    return;
  }
  const draftPath = canvas.querySelector<SVGPathElement>(".annotation-pen-draft");
  if (!draftPath) {
    scheduleRender();
    return;
  }
  draftPath.setAttribute("d", penDraft.d);
  draftPath.setAttribute("stroke", penDraft.stroke);
  draftPath.setAttribute("stroke-width", String(penDraft.strokeWidth));
  draftPath.setAttribute("opacity", String(penDraft.opacity));
}

function updatePenStroke(event: PointerEvent): boolean {
  if (!penDraft || event.pointerId !== penDraft.pointerId) {
    return false;
  }
  event.preventDefault();
  const changed = appendPenPoint(penDraft, clientToCanvasPoint(event.clientX, event.clientY));
  if (changed) {
    updatePenDraftElement();
  }
  return true;
}

function finishPenStroke(event: PointerEvent): boolean {
  if (!penDraft || event.pointerId !== penDraft.pointerId) {
    return false;
  }
  event.preventDefault();
  const draft = penDraft;
  appendPenPoint(draft, clientToCanvasPoint(event.clientX, event.clientY));
  penDraft = null;
  try {
    board.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture may already be gone after pointercancel.
  }
  if (!map || draft.points.length < 2 || !draft.d) {
    scheduleRender();
    return true;
  }
  pushUndoSnapshot();
  const id = `anno_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  ensureAnnotations(map.state)[id] = {
    id,
    kind: "pen",
    scopeId: draft.scopeId,
    d: draft.d,
    points: draft.points,
    stroke: draft.stroke,
    strokeWidth: draft.strokeWidth,
    opacity: draft.opacity,
    createdAt: nowIso(),
  };
  touchDocument();
  setStatus("Pen stroke added.");
  return true;
}

function distancePointToSegment(point: PenPoint, a: PenPoint, b: PenPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.0001) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq));
  const projectionX = a.x + t * dx;
  const projectionY = a.y + t * dy;
  return Math.hypot(point.x - projectionX, point.y - projectionY);
}

function textAnnotationBounds(annotation: TextAnnotation): { left: number; right: number; top: number; bottom: number } {
  const width = Math.max(40, annotation.text.length * annotation.fontSize * 0.62);
  const height = annotation.fontSize * 1.28;
  return {
    left: annotation.x - 9,
    right: annotation.x + width + 9,
    top: annotation.y - height + 4,
    bottom: annotation.y + 10,
  };
}

function annotationHitDistance(annotation: MapAnnotation, point: PenPoint): number {
  if (annotation.kind === "text") {
    const bounds = textAnnotationBounds(annotation);
    if (point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom) {
      return 0;
    }
    const dx = point.x < bounds.left ? bounds.left - point.x : point.x > bounds.right ? point.x - bounds.right : 0;
    const dy = point.y < bounds.top ? bounds.top - point.y : point.y > bounds.bottom ? point.y - bounds.bottom : 0;
    return Math.hypot(dx, dy);
  }

  if (annotation.points.length < 2) {
    return Number.POSITIVE_INFINITY;
  }
  let minDistance = Number.POSITIVE_INFINITY;
  for (let i = 1; i < annotation.points.length; i += 1) {
    minDistance = Math.min(minDistance, distancePointToSegment(point, annotation.points[i - 1]!, annotation.points[i]!));
  }
  return minDistance;
}

function eraseAnnotationAtPoint(point: PenPoint): boolean {
  if (!map) {
    return false;
  }
  const scopeId = normalizedCurrentScopeId();
  const entries = Object.entries(ensureAnnotations(map.state)).reverse();
  let bestId: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  entries.forEach(([id, annotation]) => {
    if (annotation.scopeId && annotation.scopeId !== scopeId) {
      return;
    }
    const distance = annotationHitDistance(annotation, point);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = id;
    }
  });
  const threshold = ERASER_HIT_RADIUS / Math.max(0.35, viewState.zoom);
  if (!bestId || bestDistance > threshold) {
    return false;
  }
  pushUndoSnapshot();
  delete map.state.annotations![bestId];
  touchDocument();
  setStatus("Annotation erased.");
  return true;
}

function startEraserStroke(event: PointerEvent): void {
  if (!map || event.button !== 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  eraserPointerId = event.pointerId;
  board.setPointerCapture(event.pointerId);
  eraseAnnotationAtPoint(clientToCanvasPoint(event.clientX, event.clientY));
}

function updateEraserStroke(event: PointerEvent): boolean {
  if (eraserPointerId !== event.pointerId) {
    return false;
  }
  event.preventDefault();
  eraseAnnotationAtPoint(clientToCanvasPoint(event.clientX, event.clientY));
  return true;
}

function finishEraserStroke(event: PointerEvent): boolean {
  if (eraserPointerId !== event.pointerId) {
    return false;
  }
  event.preventDefault();
  eraserPointerId = null;
  try {
    board.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture may already be gone after pointercancel.
  }
  return true;
}

function addDateAnnotationAt(event: PointerEvent): void {
  if (!map || event.button !== 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const point = clientToCanvasPoint(event.clientX, event.clientY);
  const initial = defaultDateAnnotationText();
  const text = window.prompt("Date label", initial)?.trim();
  if (!text) {
    return;
  }
  pushUndoSnapshot();
  const id = `anno_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  ensureAnnotations(map.state)[id] = {
    id,
    kind: "text",
    scopeId: normalizedCurrentScopeId(),
    x: point.x,
    y: point.y,
    text,
    fill: TEXT_ANNOTATION_COLOR,
    fontSize: TEXT_ANNOTATION_FONT_SIZE,
    fontWeight: 720,
    variant: "date",
    createdAt: nowIso(),
  };
  touchDocument();
  setStatus(`Date label added: ${text}`);
}

function renderAnnotationsForCurrentScope(state: AppState): AnnotationRenderResult {
  const scopeId = normalizedCurrentScopeId();
  let svg = "";
  let maxX = 0;
  let maxY = 0;
  const renderPen = (annotation: PenAnnotation, className: string): void => {
    const stroke = escapeXml(annotation.stroke || PEN_STROKE_COLOR);
    const opacity = annotation.opacity == null ? "" : ` opacity="${Math.max(0.05, Math.min(1, annotation.opacity))}"`;
    svg += `<path class="${className}" data-annotation-id="${escapeXml(annotation.id)}" d="${escapeXml(annotation.d)}" stroke="${stroke}" stroke-width="${annotation.strokeWidth || PEN_STROKE_WIDTH}"${opacity} />`;
    annotation.points.forEach((point) => {
      maxX = Math.max(maxX, point.x + 48);
      maxY = Math.max(maxY, point.y + 48);
    });
  };
  const renderText = (annotation: TextAnnotation): void => {
    const fill = escapeXml(annotation.fill || TEXT_ANNOTATION_COLOR);
    const fontSize = annotation.fontSize || TEXT_ANNOTATION_FONT_SIZE;
    const fontWeight = annotation.fontWeight || 650;
    const variantClass = annotation.variant === "date" ? " annotation-text-date" : "";
    const bounds = textAnnotationBounds(annotation);
    const bgWidth = bounds.right - bounds.left;
    const bgHeight = bounds.bottom - bounds.top;
    svg += `<rect class="annotation-text-bg${variantClass}" data-annotation-id="${escapeXml(annotation.id)}" x="${bounds.left}" y="${bounds.top}" width="${bgWidth}" height="${bgHeight}" rx="8" />`;
    svg += `<text class="annotation-text${variantClass}" data-annotation-id="${escapeXml(annotation.id)}" x="${annotation.x}" y="${annotation.y}" fill="${fill}" font-size="${fontSize}" font-weight="${fontWeight}">${escapeXml(annotation.text)}</text>`;
    maxX = Math.max(maxX, bounds.right + 48);
    maxY = Math.max(maxY, bounds.bottom + 48);
  };

  Object.values(state.annotations || {}).forEach((annotation) => {
    if (annotation.scopeId && annotation.scopeId !== scopeId) {
      return;
    }
    if (annotation.kind === "pen") {
      renderPen(annotation, "annotation-pen");
    } else if (annotation.kind === "text") {
      renderText(annotation);
    }
  });
  if (penDraft && penDraft.scopeId === scopeId && penDraft.d) {
    renderPen({
      id: "draft",
      kind: "pen",
      scopeId,
      d: penDraft.d,
      points: penDraft.points,
      stroke: penDraft.stroke,
      strokeWidth: penDraft.strokeWidth,
      opacity: penDraft.opacity,
    }, "annotation-pen annotation-pen-draft");
  }
  return { svg, maxX, maxY };
}

// ── m3e: visual style attributes ──────────────────────────────────────

/** Allowed CSS named colors (subset) and hex pattern for XSS-safe color values. */
const SAFE_COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const NAMED_COLORS = new Set([
  "transparent", "currentcolor",
  "black", "white", "red", "green", "blue", "yellow", "orange", "purple",
  "pink", "gray", "grey", "brown", "cyan", "magenta", "lime", "navy",
  "teal", "maroon", "olive", "aqua", "fuchsia", "silver", "gold",
  "coral", "salmon", "tomato", "crimson", "indigo", "violet",
  "turquoise", "tan", "sienna", "peru", "orchid", "plum", "khaki",
]);

function sanitizeColor(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (NAMED_COLORS.has(v)) return v;
  if (SAFE_COLOR_RE.test(raw.trim())) return raw.trim();
  return null;
}

function sanitizeBorderStyle(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "solid" || v === "dashed" || v === "dotted" || v === "none") return v;
  return null;
}

function sanitizeNumeric(raw: string | undefined, min: number, max: number): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function sanitizeShape(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "rect" || v === "rounded" || v === "pill" || v === "diamond") return v;
  return null;
}

function sanitizeBand(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "flash" || v === "rapid" || v === "deep") return v;
  return null;
}

/** Sanitize icon: allow single emoji/short string, strip anything dangerous. */
function sanitizeIcon(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  // Allow up to 4 characters (covers multi-codepoint emoji)
  if (v.length === 0 || [...v].length > 4) return null;
  return v;
}

/** Compute confidence badge color: 0=red, 0.5=yellow, 1=green */
function confidenceColor(c: number): string {
  if (c <= 0.5) {
    const r = 220;
    const g = Math.round(60 + c * 2 * 160);
    return `rgb(${r},${g},40)`;
  }
  const r = Math.round(220 - (c - 0.5) * 2 * 180);
  const g = Math.round(180 + (c - 0.5) * 2 * 40);
  return `rgb(${r},${g},40)`;
}

interface NodeStyleAttrs {
  bg: string | null;
  color: string | null;
  border: string | null;
  borderStyle: string | null;
  borderWidth: number | null;
  shape: string | null;
  icon: string | null;
  edgeColor: string | null;
  edgeStyle: string | null;
  edgeWidth: number | null;
  edgeLabel: string | null;
  band: string | null;
  confidence: number | null;
  status: string | null;
}

const VALID_STATUSES = new Set(["placeholder", "confirmed", "contested", "frozen", "active", "review"]);
function sanitizeStatus(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  return VALID_STATUSES.has(s) ? s : null;
}

/**
 * Parse `attributes["m3e:style"]` — a V1-compatible JSON string storing
 * decoration fields under a single attribute key (keeps `attributes` as
 * `Record<string,string>`, no schema change). Returns `{}` on any error.
 */
function readNodeStyleJson(attrs: Record<string, string>): {
  fill?: string;
  border?: string;
  text?: string;
  urgency?: number;
  importance?: number;
  status?: string;
} {
  const raw = attrs["m3e:style"];
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, never>;
  } catch {
    return {};
  }
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Derive a fill color via bilinear interpolation across a 2D
 * (urgency × importance) grid. Matches the matrix in
 * `docs/ideas/UrgentImportanceView.mlx` (Method 2, blue variant):
 *   C00 (U=0,I=0) = white   C01 (U=0,I=1) = yellow
 *   C10 (U=1,I=0) = blue    C11 (U=1,I=1) = red
 * Inputs accept 0..3 (integer urgency/importance levels) and are normalized to 0..1.
 */
function deriveFillFromUrgencyImportance(urgency: number, importance: number): string | null {
  if (!Number.isFinite(urgency) && !Number.isFinite(importance)) return null;
  const u = clamp01((Number.isFinite(urgency) ? urgency : 0) / 3);
  const i = clamp01((Number.isFinite(importance) ? importance : 0) / 3);
  // C00=white(255,255,255), C01=yellow(255,255,0), C10=blue(0,0,255), C11=red(255,0,0)
  const w00 = (1 - u) * (1 - i);
  const w01 = (1 - u) * i;
  const w10 = u * (1 - i);
  const w11 = u * i;
  const r = Math.round(w00 * 255 + w01 * 255 + w10 * 0   + w11 * 255);
  const g = Math.round(w00 * 255 + w01 * 255 + w10 * 0   + w11 * 0);
  const b = Math.round(w00 * 255 + w01 * 0   + w10 * 255 + w11 * 0);
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function readNodeStyleAttrs(attrs: Record<string, string>): NodeStyleAttrs {
  // V1-compatible JSON decoration layer (Miro-style). Takes priority over
  // legacy m3e:bg/m3e:border/m3e:color if present.
  const style = readNodeStyleJson(attrs);
  const jsonFill = typeof style.fill === "string" ? sanitizeColor(style.fill) : null;
  const jsonBorder = typeof style.border === "string" ? sanitizeColor(style.border) : null;
  const jsonText = typeof style.text === "string" ? sanitizeColor(style.text) : null;
  const urgency = typeof style.urgency === "number" ? style.urgency : NaN;
  const importance = typeof style.importance === "number" ? style.importance : NaN;
  // Derived fill only applies when explicit fill is absent (both legacy and JSON).
  const legacyBg = sanitizeColor(attrs["m3e:bg"]);
  let effectiveBg = jsonFill ?? legacyBg;
  if (!effectiveBg && (Number.isFinite(urgency) || Number.isFinite(importance))) {
    effectiveBg = deriveFillFromUrgencyImportance(urgency, importance);
  }
  return {
    bg: effectiveBg,
    color: jsonText ?? sanitizeColor(attrs["m3e:color"]),
    border: jsonBorder ?? sanitizeColor(attrs["m3e:border"]),
    borderStyle: sanitizeBorderStyle(attrs["m3e:border-style"]),
    borderWidth: sanitizeNumeric(attrs["m3e:border-width"], 0, 8),
    shape: sanitizeShape(attrs["m3e:shape"]),
    icon: sanitizeIcon(attrs["m3e:icon"]),
    edgeColor: sanitizeColor(attrs["m3e:edge-color"]),
    edgeStyle: sanitizeBorderStyle(attrs["m3e:edge-style"]),
    edgeWidth: sanitizeNumeric(attrs["m3e:edge-width"], 1, 10),
    edgeLabel: (attrs["m3e:edge-label"] || "").trim() || null,
    band: sanitizeBand(attrs["m3e:band"]),
    confidence: sanitizeNumeric(attrs["m3e:confidence"], 0, 1),
    status: sanitizeStatus(style.status) ?? sanitizeStatus(attrs["m3e:status"]),
  };
}

function buildNodeVisualStyle(s: NodeStyleAttrs): string {
  const parts: string[] = [];
  if (s.bg) parts.push(`fill:${s.bg}`);
  if (s.border) parts.push(`stroke:${s.border}`);
  if (s.borderWidth != null) parts.push(`stroke-width:${s.borderWidth}px`);
  if (s.borderStyle === "dashed") parts.push("stroke-dasharray:8 5");
  if (s.borderStyle === "dotted") parts.push("stroke-dasharray:3 3");
  if (s.borderStyle === "none") parts.push("stroke:none");
  // Band overrides
  if (s.band === "flash") {
    parts.push("opacity:0.6");
    if (!s.borderStyle) parts.push("stroke-dasharray:6 4");
  } else if (s.band === "deep") {
    if (s.borderWidth == null) parts.push("stroke-width:4px");
    if (!s.border) parts.push("stroke:#333");
  }
  // Status-based default decoration (only if no explicit bg/border)
  if (s.status && !s.bg && !s.border) {
    switch (s.status) {
      case "placeholder": parts.push("stroke:#999;stroke-dasharray:4 4;stroke-width:3px"); break;
      case "confirmed": parts.push("stroke:#2d8c4e;stroke-width:6px"); break;
      case "contested": parts.push("stroke:#d94040;stroke-width:6px"); break;
      case "frozen": parts.push("stroke:#4a7fb5;stroke-width:4.5px;stroke-dasharray:2 3"); break;
      case "active": parts.push("stroke:#e89b1a;stroke-width:7.5px"); break;
      case "review": parts.push("stroke:#9b59b6;stroke-width:6px;stroke-dasharray:6 3"); break;
    }
  }
  return parts.length ? parts.join(";") : "";
}

function buildLabelStyle(s: NodeStyleAttrs): string {
  const parts: string[] = [];
  if (s.color) parts.push(`fill:${s.color}`);
  return parts.length ? parts.join(";") : "";
}

function buildEdgeStyle(s: NodeStyleAttrs): string {
  const parts: string[] = [];
  if (s.edgeColor) parts.push(`stroke:${s.edgeColor}`);
  if (s.edgeWidth != null) parts.push(`stroke-width:${s.edgeWidth}px`);
  if (s.edgeStyle === "dashed") parts.push("stroke-dasharray:10 6");
  if (s.edgeStyle === "dotted") parts.push("stroke-dasharray:3 3");
  return parts.length ? parts.join(";") : "";
}

function shapeRx(shape: string | null, isRoot: boolean): number {
  if (!shape) return isRoot ? 60 : 12;
  if (shape === "rect") return isRoot ? 8 : 2;
  if (shape === "rounded") return isRoot ? 24 : 12;
  if (shape === "pill") return 999;
  if (shape === "diamond") return 0;
  return isRoot ? 60 : 12;
}

function effectiveNodeStyleAttrs(node: TreeNode): NodeStyleAttrs {
  const base = readNodeStyleAttrs(node.attributes || {});
  const view = surfaceNodeView(node.id);
  if (view?.shape) {
    base.shape = view.shape;
  }
  return base;
}

function rawAttr(node: TreeNode | null | undefined, key: string): string {
  return (node?.attributes?.[key] || "").trim();
}

function isFlowSurfaceNode(node: TreeNode | null | undefined): boolean {
  if (!node) return false;
  return rawAttr(node, "m3e:layout") === "flow-lr";
}

function isScopePortalNode(node: TreeNode | null | undefined): boolean {
  if (!isFolderNode(node)) return false;
  return rawAttr(node, "m3e:display-role") === "subsystem"
    || rawAttr(node, "pj04:scope-backed") === "true"
    || rawAttr(node, "m3e:scope-portal") === "true";
}

function isReferenceNode(node: TreeNode | null | undefined): boolean {
  if (!node) return false;
  return rawAttr(node, "m3e:display-role") === "reference";
}

function currentMapSurface(): MapSurface | null {
  if (!map) return null;
  const scope = map.state.scopes?.[inferredScopeId(currentScopeRootId())];
  if (!scope?.primarySurfaceId) return null;
  return map.state.surfaces?.[scope.primarySurfaceId] || null;
}

function surfaceNodeView(nodeId: string): SurfaceNodeView | null {
  const surface = currentMapSurface();
  return surface?.nodeViews?.[nodeId] || null;
}

function ensureSurfaceNodeView(nodeId: string): SurfaceNodeView | null {
  const surface = currentMapSurface();
  if (!surface) return null;
  if (!surface.nodeViews) {
    surface.nodeViews = {};
  }
  if (!surface.nodeViews[nodeId]) {
    surface.nodeViews[nodeId] = {};
  }
  return surface.nodeViews[nodeId]!;
}

function flowColOf(node: TreeNode | null | undefined, fallback: number): number {
  if (node) {
    const surfaceValue = surfaceNodeView(node.id)?.flowCol;
    if (Number.isFinite(surfaceValue)) {
      return Number(surfaceValue);
    }
  }
  const raw = rawAttr(node, "m3e:flow-col");
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function flowRowOf(node: TreeNode | null | undefined, fallback = 0): number {
  if (node) {
    const surfaceValue = surfaceNodeView(node.id)?.flowRow;
    if (Number.isFinite(surfaceValue)) {
      return Number(surfaceValue);
    }
  }
  const raw = rawAttr(node, "m3e:flow-row");
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function diagramLabel(node: TreeNode, nodeStyles: NodeStyleAttrs): string {
  const base = uiLabel(node) || "(empty)";
  const withIcon = nodeStyles.icon ? `${nodeStyles.icon} ${base}` : base;
  if (isScopePortalNode(node)) {
    return `[${withIcon}]`;
  }
  return withIcon;
}

function rectPath(x: number, y: number, w: number, h: number, rx: number): string {
  if (rx <= 0) {
    return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  }
  const r = Math.min(rx, w / 2, h / 2);
  return [
    `M ${x + r} ${y}`,
    `H ${x + w - r}`,
    `Q ${x + w} ${y} ${x + w} ${y + r}`,
    `V ${y + h - r}`,
    `Q ${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `H ${x + r}`,
    `Q ${x} ${y + h} ${x} ${y + h - r}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    "Z",
  ].join(" ");
}

function diamondPath(cx: number, cy: number, w: number, h: number): string {
  const halfW = w / 2;
  const halfH = h / 2;
  return `M ${cx} ${cy - halfH} L ${cx + halfW} ${cy} L ${cx} ${cy + halfH} L ${cx - halfW} ${cy} Z`;
}

const TEXT_MEASURE_FONT_FAMILY = "\"Segoe UI\", \"Yu Gothic UI\", sans-serif";
let textMeasureContext: CanvasRenderingContext2D | null | undefined;

function getTextMeasureContext(): CanvasRenderingContext2D | null {
  if (textMeasureContext !== undefined) {
    return textMeasureContext;
  }
  const measureCanvas = document.createElement("canvas");
  textMeasureContext = measureCanvas.getContext("2d");
  return textMeasureContext;
}

function textWidth(str: string, fontSize: number): number {
  const normalized = String(str || "");
  const measureContext = getTextMeasureContext();
  if (measureContext) {
    measureContext.font = `${fontSize}px ${TEXT_MEASURE_FONT_FAMILY}`;
    return Math.max(80, Math.ceil(measureContext.measureText(normalized).width));
  }
  return Math.max(80, normalized.length * fontSize * 0.62);
}

function splitLabelLines(text: string): string[] {
  const lines = String(text || "").replaceAll("\r", "").split("\n");
  return lines.length > 0 ? lines : [""];
}

function lineHeightForFont(fontSize: number): number {
  return Math.ceil(fontSize * 1.2);
}

function multilineTextStartY(centerY: number, lineCount: number, fontSize: number, lineHeight: number): number {
  const glyphHeight = Math.ceil(fontSize);
  const blockHeight = (lineCount - 1) * lineHeight + glyphHeight;
  const ascent = Math.ceil(fontSize * 0.8);
  return centerY - blockHeight / 2 + ascent;
}

function multilineTspans(lines: string[], x: number, lineHeight: number): string {
  return lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line || " ")}</tspan>`)
    .join("");
}

function measureNodeLabel(text: string, fontSize: number): { w: number; h: number } {
  const lines = splitLabelLines(text);
  const maxLineWidth = lines.reduce((max, line) => Math.max(max, textWidth(line, fontSize)), 80);
  const lineHeight = lineHeightForFont(fontSize);
  const verticalPadding = 0;
  return {
    w: maxLineWidth + 20,
    h: Math.max(VIEWER_TUNING.layout.leafHeight, lines.length * lineHeight + verticalPadding),
  };
}

function wrapLineToWidth(line: string, fontSize: number, maxWidth: number): string[] {
  if (!line) return [""];
  if (textWidth(line, fontSize) <= maxWidth) return [line];
  const parts: string[] = [];
  let current = "";
  for (const char of Array.from(line)) {
    const next = current + char;
    if (current && textWidth(next, fontSize) > maxWidth) {
      parts.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) parts.push(current);
  return parts.length > 0 ? parts : [line];
}

function wrapLabelLines(text: string, fontSize: number, maxTextWidth: number): string[] {
  return splitLabelLines(text)
    .flatMap((line) => wrapLineToWidth(line, fontSize, maxTextWidth))
    .filter((line, index, lines) => line.length > 0 || lines.length === 1 || index < lines.length);
}

function measureWrappedNodeLabel(
  text: string,
  fontSize: number,
  maxBoxWidth: number,
  options: { minWidth?: number; minHeight?: number; padX?: number; padY?: number } = {},
): { w: number; h: number; labelLines: string[]; fontSize: number } {
  const padX = options.padX ?? 20;
  const padY = options.padY ?? 8;
  const minWidth = options.minWidth ?? 80;
  const minHeight = options.minHeight ?? VIEWER_TUNING.layout.leafHeight;
  const labelLines = wrapLabelLines(text, fontSize, Math.max(40, maxBoxWidth - padX));
  const maxLineWidth = labelLines.reduce((max, line) => Math.max(max, textWidth(line, fontSize)), 0);
  const lineHeight = lineHeightForFont(fontSize);
  return {
    w: Math.max(minWidth, Math.min(maxBoxWidth, maxLineWidth + padX)),
    h: Math.max(minHeight, labelLines.length * lineHeight + padY),
    labelLines,
    fontSize,
  };
}

const LATEX_DISPLAY_RE = /^\$\$([\s\S]+)\$\$$/;
const LATEX_INLINE_RE = /^\$([^$]+)\$$/;

function isLatexNode(node: TreeNode): boolean {
  const t = (node.text || "").trim();
  return LATEX_DISPLAY_RE.test(t) || LATEX_INLINE_RE.test(t);
}

function latexSource(text: string): { latex: string; displayMode: boolean } {
  const t = (text || "").trim();
  const dm = LATEX_DISPLAY_RE.exec(t);
  if (dm) return { latex: dm[1]!, displayMode: true };
  const im = LATEX_INLINE_RE.exec(t);
  return { latex: im ? im[1]! : t, displayMode: false };
}

const latexMetricsCache = new Map<string, { w: number; h: number }>();
const latexHtmlCache = new Map<string, string>();

function measureLatex(text: string): { w: number; h: number } {
  if (latexMetricsCache.has(text)) return latexMetricsCache.get(text)!;
  const { latex, displayMode } = latexSource(text);
  const probe = document.createElement("div");
  probe.style.cssText = [
    "position:absolute",
    "visibility:hidden",
    "top:-9999px",
    "left:-9999px",
    "display:inline-flex",
    "align-items:center",
    "padding:0 4px",
    "box-sizing:border-box",
    `font-size:${VIEWER_TUNING.typography.nodeFont}px`,
    "line-height:1",
    "white-space:nowrap",
  ].join(";");
  document.body.appendChild(probe);
  try {
    katex.render(latex, probe, { displayMode, throwOnError: false });
    const displayBlock = probe.querySelector(".katex-display") as HTMLElement | null;
    if (displayBlock) {
      displayBlock.style.margin = "0";
    }
    const rect = probe.getBoundingClientRect();
    const result = {
      w: Math.max(80, Math.ceil(rect.width) + 8),
      h: Math.max(VIEWER_TUNING.layout.leafHeight, Math.ceil(rect.height) + 12),
    };
    latexMetricsCache.set(text, result);
    return result;
  } catch {
    const fallback = { w: textWidth(text, VIEWER_TUNING.typography.nodeFont) + 20, h: 56 };
    latexMetricsCache.set(text, fallback);
    return fallback;
  } finally {
    probe.remove();
  }
}

function richContentText(element: Element, type: string): string {
  const richNodes = Array.from(element.children).filter((child) => {
    return child.tagName === "richcontent" && (child.getAttribute("TYPE") || "").toUpperCase() === type;
  });
  return richNodes
    .map((node) => (node.textContent || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function parseMmText(xmlText: string): SavedMap {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, "application/xml");
  const parserError = xml.querySelector("parsererror");
  if (parserError) {
    throw new Error("Invalid .mm XML");
  }

  const mapNode = xml.querySelector("map > node");
  if (!mapNode) {
    throw new Error("No root node found in .mm file");
  }

  const state: AppState = {
    rootId: "",
    nodes: {},
  };

  function convertNode(mmNode: Element, parentId: string | null = null): string {
    const id = newId();
    const text =
      mmNode.getAttribute("TEXT") ||
      richContentText(mmNode, "NODE") ||
      "(empty)";
    const record = createNodeRecord(id, parentId, text);
    record.collapsed = (mmNode.getAttribute("FOLDED") || "").toLowerCase() === "true";
    record.link = mmNode.getAttribute("LINK") || "";
    record.details = richContentText(mmNode, "DETAILS");
    record.note = richContentText(mmNode, "NOTE");

    const attributesEl = Array.from(mmNode.children).find((child) => child.tagName === "attributes");
    if (attributesEl) {
      Array.from(attributesEl.children)
        .filter((child) => child.tagName === "attribute")
        .forEach((attribute) => {
          const key = attribute.getAttribute("NAME");
          if (!key) {
            return;
          }
          record.attributes[key] = attribute.getAttribute("VALUE") || "";
        });
    }

    state.nodes[id] = record;
    if (!state.rootId) {
      state.rootId = id;
    }

    Array.from(mmNode.children)
      .filter((child) => child.tagName === "node")
      .forEach((childNode) => {
        const childId = convertNode(childNode, id);
        record.children.push(childId);
      });

    return id;
  }

  convertNode(mapNode, null);

  return {
    version: 1,
    savedAt: nowIso(),
    state,
  };
}

function getNode(nodeId: string): TreeNode {
  const node = map!.state.nodes[nodeId];
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }
  return node;
}

function isFolderNode(node: TreeNode | null | undefined): boolean {
  return Boolean(node && node.nodeType === "folder");
}

function currentScopeRootId(): string {
  if (!map) {
    return "";
  }
  return viewState.currentScopeRootId || map.state.rootId;
}

function currentScopeRootNode(): TreeNode | null {
  if (!map) {
    return null;
  }
  return map.state.nodes[currentScopeRootId()] || null;
}

function scopeRootForNode(nodeId: string): string {
  if (!map || !map.state.nodes[nodeId]) {
    return "";
  }
  let cursor: string | null = nodeId;
  while (cursor) {
    const node: TreeNode | undefined = map.state.nodes[cursor];
    if (!node) {
      break;
    }
    if (isFolderNode(node)) {
      return node.id;
    }
    cursor = node.parentId ?? null;
  }
  return map.state.rootId;
}

function scopePathIds(scopeRootId: string): string[] {
  if (!map || !scopeRootId) {
    return [];
  }
  const path: string[] = [];
  let cursor: string | null = scopeRootId;
  while (cursor) {
    path.push(cursor);
    const node: TreeNode | undefined = map.state.nodes[cursor];
    if (!node) {
      break;
    }
    if (cursor === map.state.rootId) {
      break;
    }
    cursor = node.parentId ?? null;
    while (cursor) {
      const parent = map.state.nodes[cursor];
      if (!parent) {
        cursor = null;
        break;
      }
      if (parent.id === map.state.rootId || isFolderNode(parent)) {
        break;
      }
      cursor = parent.parentId ?? null;
    }
  }
  return path.reverse();
}

function updateScopeMeta(): void {
  if (!map) {
    scopeMetaEl.textContent = "scope: n/a";
    return;
  }
  const parts = scopePathIds(currentScopeRootId()).map((nodeId) => {
    if (nodeId === map!.state.rootId) {
      return "root";
    }
    return uiLabel(map!.state.nodes[nodeId]);
  });
  scopeMetaEl.textContent = `scope: ${parts.join(" / ")}`;
}

function updateScopeSummary(): void {
  if (!map) {
    scopeSummaryEl.textContent = "outside: n/a";
    return;
  }
  const scopeRootId = currentScopeRootId();
  const scopeRoot = map.state.nodes[scopeRootId];
  if (!scopeRoot) {
    scopeSummaryEl.textContent = "outside: n/a";
    return;
  }

  const parentScopeId = scopeRootId === map.state.rootId
    ? null
    : scopeRoot.parentId
      ? scopeRootForNode(scopeRoot.parentId)
      : map.state.rootId;
  const parentLabel = parentScopeId
    ? (parentScopeId === map.state.rootId ? "root" : uiLabel(map.state.nodes[parentScopeId]))
    : "none";

  const childScopeSummaries = (scopeRoot.children || [])
    .map((childId) => map!.state.nodes[childId])
    .filter((node): node is TreeNode => Boolean(node))
    .filter((node) => isFolderNode(node))
    .map((node) => `${uiLabel(node)}(${countHiddenDescendants(node.id)})`);

  const childSummary = childScopeSummaries.length > 0 ? childScopeSummaries.join(", ") : "none";
  scopeSummaryEl.textContent = `outside: parent ${parentLabel} | child scopes ${childSummary}`;
}

function enterScope(scopeNodeId: string): boolean {
  if (!map) {
    return false;
  }
  const node = getNode(scopeNodeId);
  if (!isFolderNode(node)) {
    setStatus("Only folder nodes can open a scope.", true);
    return false;
  }
  viewState.currentScopeRootId = node.id;
  viewState.currentScopeId = node.id;
  viewState.surfaceViewMode = inferSurfaceViewModeForScope(node.id);
  viewState.surfaceLayoutDensity = inferSurfaceLayoutDensityForScope(node.id, viewState.surfaceViewMode);
  viewState.surfaceBranchDirection = inferSurfaceBranchDirectionForScope(node.id, viewState.surfaceViewMode);
  setSingleSelection(preferredSelectionForScope(node.id), false);
  render();
  triggerCameraMove("scope");
  setStatus(`Entered scope: ${uiLabel(node)}`);
  board.focus();
  return true;
}

function exitScope(): boolean {
  if (!map) {
    return false;
  }
  const scopeRoot = currentScopeRootNode();
  if (!scopeRoot || scopeRoot.id === map.state.rootId) {
    setStatus("Already at root scope.");
    return false;
  }
  let nextScopeId = map.state.rootId;
  let cursor = scopeRoot.parentId;
  while (cursor) {
    const parent = map.state.nodes[cursor];
    if (!parent) {
      break;
    }
    if (parent.id === map.state.rootId || isFolderNode(parent)) {
      nextScopeId = parent.id;
      break;
    }
    cursor = parent.parentId ?? null;
  }
  const exitedScopeId = scopeRoot.id;
  viewState.currentScopeRootId = nextScopeId;
  viewState.currentScopeId = nextScopeId;
  viewState.surfaceViewMode = inferSurfaceViewModeForScope(nextScopeId);
  viewState.surfaceLayoutDensity = inferSurfaceLayoutDensityForScope(nextScopeId, viewState.surfaceViewMode);
  viewState.surfaceBranchDirection = inferSurfaceBranchDirectionForScope(nextScopeId, viewState.surfaceViewMode);
  const selectionAfterExit =
    map.state.nodes[exitedScopeId] && isNodeInScope(exitedScopeId)
      ? exitedScopeId
      : preferredSelectionForScope(nextScopeId);
  setSingleSelection(selectionAfterExit, false);
  render();
  triggerCameraMove("scope");
  setStatus("Returned to parent scope.");
  board.focus();
  return true;
}

function makeSelectedFolder(): boolean {
  if (!map) {
    return false;
  }
  const node = getNode(viewState.selectedNodeId);
  if (isAliasNode(node)) {
    setStatus("Alias nodes cannot become folders.", true);
    return false;
  }
  pushUndoSnapshot();
  if (isFolderNode(node)) {
    node.nodeType = undefined;
    touchDocument();
    setStatus(`Removed folder scope: ${uiLabel(node)}`);
  } else {
    node.nodeType = "folder";
    touchDocument();
    setStatus(`Marked as folder scope: ${uiLabel(node)}`);
  }
  board.focus();
  return true;
}

function addAliasInCurrentScope(): boolean {
  if (!map) {
    return false;
  }
  const target = getNode(viewState.selectedNodeId);
  if (isAliasNode(target)) {
    setStatus("Alias cannot target another alias.", true);
    return false;
  }
  const scopeRoot = currentScopeRootNode();
  if (!scopeRoot) {
    return false;
  }
  pushUndoSnapshot();
  const aliasId = newId();
  map.state.nodes[aliasId] = {
    id: aliasId,
    parentId: scopeRoot.id,
    children: [],
    collapsed: false,
    nodeType: "alias",
    scopeId: scopeRoot.id,
    text: uiLabel(target),
    details: "",
    note: "",
    attributes: {},
    link: "",
    targetNodeId: target.id,
    aliasLabel: undefined,
    access: "read",
    targetSnapshotLabel: undefined,
    isBroken: false,
  };
  scopeRoot.children.push(aliasId);
  setSingleSelection(aliasId, false);
  touchDocument();
  setStatus(`Alias added in current scope for ${uiLabel(target)}.`);
  board.focus();
  return true;
}

function addAliasAsChild(): boolean {
  if (!map) {
    return false;
  }
  const target = getNode(viewState.selectedNodeId);
  if (!target) {
    return false;
  }
  if (isAliasNode(target)) {
    setStatus("Alias cannot target another alias.", true);
    return false;
  }
  pushUndoSnapshot();
  const aliasId = newId();
  map.state.nodes[aliasId] = {
    id: aliasId,
    parentId: target.id,
    children: [],
    collapsed: false,
    nodeType: "alias",
    scopeId: target.scopeId,
    text: uiLabel(target),
    details: "",
    note: "",
    attributes: {},
    link: "",
    targetNodeId: target.id,
    aliasLabel: undefined,
    access: "read",
    targetSnapshotLabel: undefined,
    isBroken: false,
  };
  target.children.push(aliasId);
  viewState.selectedNodeId = aliasId;
  touchDocument();
  setStatus(`Alias created as child of ${uiLabel(target)}.`);
  board.focus();
  return true;
}

function jumpToAliasTarget(): boolean {
  if (!map) {
    return false;
  }
  const node = getNode(viewState.selectedNodeId);
  if (!isAliasNode(node)) {
    setStatus("Selected node is not an alias.", true);
    return false;
  }
  const target = resolveAliasTarget(node);
  if (!target || isBrokenAlias(node)) {
    setStatus("Broken alias cannot jump to target.", true);
    return false;
  }
  const targetScopeId = scopeRootForNode(target.id);
  const currentScopeId = normalizedCurrentScopeId();
  if (targetScopeId !== currentScopeId) {
    viewState.scopeHistory.push(currentScopeId);
    viewState.currentScopeId = targetScopeId;
    viewState.currentScopeRootId = targetScopeId;
    viewState.surfaceViewMode = inferSurfaceViewModeForScope(targetScopeId);
    viewState.surfaceLayoutDensity = inferSurfaceLayoutDensityForScope(targetScopeId, viewState.surfaceViewMode);
    viewState.surfaceBranchDirection = inferSurfaceBranchDirectionForScope(targetScopeId, viewState.surfaceViewMode);
  }
  setSingleSelection(target.id, false);
  normalizeSelectionState();
  render();
  triggerCameraMove("scope");
  updateScopeInUrl(targetScopeId);
  setStatus(`Jumped to target: ${uiLabel(target)}`);
  board.focus();
  return true;
}

function isAliasNode(node: TreeNode | null | undefined): boolean {
  return Boolean(node && node.nodeType === "alias");
}

function isBrokenAlias(node: TreeNode | null | undefined): boolean {
  return isAliasNode(node) && Boolean(node!.isBroken);
}

function aliasAccess(node: TreeNode | null | undefined): AliasAccess {
  return isAliasNode(node) ? (node!.access || "read") : "read";
}

function resolveAliasTarget(node: TreeNode | null | undefined): TreeNode | null {
  if (!isAliasNode(node) || !node!.targetNodeId || !map) {
    return null;
  }
  return map.state.nodes[node!.targetNodeId] || null;
}

function uiLabel(node: TreeNode | null | undefined): string {
  if (!node) {
    return "n/a";
  }
  if (node.aliasLabel && node.aliasLabel.trim()) {
    return node.aliasLabel;
  }
  if (isBrokenAlias(node)) {
    const snapshot = node.targetSnapshotLabel || node.text || "Untitled";
    return `${snapshot} (deleted)`;
  }
  if (isAliasNode(node)) {
    const target = resolveAliasTarget(node);
    if (target) {
      return target.text || "Untitled";
    }
  }
  return node.text || "Untitled";
}

function syncAliasDisplayForTarget(targetNodeId: string): void {
  if (!map) {
    return;
  }
  Object.values(map.state.nodes).forEach((node) => {
    if (!isAliasNode(node) || node.targetNodeId !== targetNodeId || node.aliasLabel || node.isBroken) {
      return;
    }
    const target = map!.state.nodes[targetNodeId];
    if (target) {
      node.text = target.text;
    }
  });
}

function markAliasesBrokenInViewer(targetNodeId: string, targetLabel: string): void {
  if (!map) {
    return;
  }
  Object.values(map.state.nodes).forEach((node) => {
    if (!isAliasNode(node) || node.targetNodeId !== targetNodeId) {
      return;
    }
    node.isBroken = true;
    node.targetSnapshotLabel = targetLabel;
    node.text = `${targetLabel} (deleted)`;
  });
}

function aliasBadge(node: TreeNode): string {
  if (!isAliasNode(node)) {
    return "";
  }
  if (isBrokenAlias(node)) {
    return "broken";
  }
  return aliasAccess(node) === "write" ? "write" : "read";
}

function normalizeGraphLink(link: GraphLink): GraphLink {
  const validPort = (port: unknown): LinkPort => (
    port === "left" || port === "right" || port === "top" || port === "bottom" || port === "auto"
      ? port
      : "auto"
  );
  return {
    ...link,
    relationType: link.relationType ?? undefined,
    label: link.label ?? undefined,
    direction: link.direction ?? "none",
    style: link.style ?? "default",
    color: sanitizeColor(link.color) ?? undefined,
    sourcePort: sanitizeLinkPort(link.sourcePort),
    targetPort: sanitizeLinkPort(link.targetPort),
  };
}

function sanitizeLinkPort(value: unknown): EdgeAnchorSide | undefined {
  return value === "left" || value === "right" || value === "top" || value === "bottom"
    ? value
    : undefined;
}

function nodeBadge(node: TreeNode): string {
  if (isFolderNode(node) && node.id !== currentScopeRootId()) {
    return "scope";
  }
  return aliasBadge(node);
}

function cloneState(state: AppState): AppState {
  return JSON.parse(JSON.stringify(state)) as AppState;
}

function pushUndoSnapshot(): void {
  if (!map) {
    return;
  }
  undoStack.push({
    state: cloneState(map.state),
    selectedNodeId: viewState.selectedNodeId,
    selectedNodeIds: Array.from(viewState.selectedNodeIds),
    selectionAnchorId: viewState.selectionAnchorId,
  });
  if (undoStack.length > MAX_UNDO_STEPS) {
    undoStack.shift();
  }
  redoStack = [];
}

function undoLastChange(): void {
  if (!map || undoStack.length === 0) {
    setStatus("Nothing to undo.");
    return;
  }

  redoStack.push({
    state: cloneState(map.state),
    selectedNodeId: viewState.selectedNodeId,
    selectedNodeIds: Array.from(viewState.selectedNodeIds),
    selectionAnchorId: viewState.selectionAnchorId,
  });
  if (redoStack.length > MAX_UNDO_STEPS) {
    redoStack.shift();
  }

  const snapshot = undoStack.pop()!;
  map.state = snapshot.state;
  const undoState = map.state;
  viewState.selectedNodeId = undoState.nodes[snapshot.selectedNodeId] ? snapshot.selectedNodeId : undoState.rootId;
  viewState.selectedNodeIds = new Set(snapshot.selectedNodeIds.filter((nodeId) => Boolean(undoState.nodes[nodeId])));
  viewState.selectionAnchorId = snapshot.selectionAnchorId && undoState.nodes[snapshot.selectionAnchorId]
    ? snapshot.selectionAnchorId
    : null;
  viewState.reparentSourceIds.clear();
  normalizeSelectionState();
  map.savedAt = nowIso();
  render();
  scheduleAutosave();
  setStatus("Undo applied.");
  board.focus();
}

function redoLastChange(): void {
  if (!map || redoStack.length === 0) {
    setStatus("Nothing to redo.");
    return;
  }

  undoStack.push({
    state: cloneState(map.state),
    selectedNodeId: viewState.selectedNodeId,
    selectedNodeIds: Array.from(viewState.selectedNodeIds),
    selectionAnchorId: viewState.selectionAnchorId,
  });
  if (undoStack.length > MAX_UNDO_STEPS) {
    undoStack.shift();
  }

  const snapshot = redoStack.pop()!;
  map.state = snapshot.state;
  const redoState = map.state;
  viewState.selectedNodeId = redoState.nodes[snapshot.selectedNodeId] ? snapshot.selectedNodeId : redoState.rootId;
  viewState.selectedNodeIds = new Set(snapshot.selectedNodeIds.filter((nodeId) => Boolean(redoState.nodes[nodeId])));
  viewState.selectionAnchorId = snapshot.selectionAnchorId && redoState.nodes[snapshot.selectionAnchorId]
    ? snapshot.selectionAnchorId
    : null;
  viewState.reparentSourceIds.clear();
  normalizeSelectionState();
  map.savedAt = nowIso();
  render();
  scheduleAutosave();
  setStatus("Redo applied.");
  board.focus();
}

function setStatus(message: string, isError = false): void {
  if (statusTimer !== null) clearTimeout(statusTimer);
  statusEl.textContent = message;
  statusEl.style.color = isError ? "var(--danger)" : "var(--status-ink)";
  if (message) {
    statusTimer = setTimeout(() => {
      statusEl.textContent = "";
    }, 2500);
  }
}

function normalizeViewerTheme(value: unknown): ViewerTheme {
  return value === "dark" ? "dark" : "light";
}

function readStoredViewerTheme(): ViewerTheme {
  try {
    return normalizeViewerTheme(window.localStorage.getItem(THEME_PREFS_KEY));
  } catch {
    return "light";
  }
}

function applyViewerTheme(theme: ViewerTheme, options: { persist?: boolean; announce?: boolean } = {}): void {
  viewerTheme = normalizeViewerTheme(theme);
  document.documentElement.dataset.theme = viewerTheme;
  document.documentElement.style.colorScheme = viewerTheme;
  document.body.dataset.theme = viewerTheme;
  if (themeToggleBtn) {
    themeToggleBtn.textContent = viewerTheme === "dark" ? "Light" : "Dark";
    themeToggleBtn.setAttribute("aria-pressed", viewerTheme === "dark" ? "true" : "false");
    themeToggleBtn.title = viewerTheme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  }
  if (options.persist) {
    try {
      window.localStorage.setItem(THEME_PREFS_KEY, viewerTheme);
    } catch {
      // Local storage may be unavailable in restricted browser contexts.
    }
  }
  window.dispatchEvent(new CustomEvent("m3e:theme-changed", { detail: { theme: viewerTheme } }));
  if (options.announce) {
    setStatus(viewerTheme === "dark" ? "Dark mode enabled." : "Light mode enabled.");
  }
}

function toggleViewerTheme(): void {
  applyViewerTheme(viewerTheme === "dark" ? "light" : "dark", { persist: true, announce: true });
}

applyViewerTheme(viewerTheme);

function showFatalLoadError(title: string, detail: string): void {
  fatalLoadError = true;
  document.body.classList.add("is-fatal-load-error");
  document.title = "M3E - Error";
  statusEl.textContent = title;
  statusEl.style.color = "var(--danger)";
  if (statusTimer !== null) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
  const existing = document.getElementById("fatal-load-error");
  if (existing) existing.remove();
  const panel = document.createElement("section");
  panel.id = "fatal-load-error";
  panel.className = "fatal-load-error";
  panel.setAttribute("role", "alert");
  const eyebrow = document.createElement("div");
  eyebrow.className = "fatal-load-error__eyebrow";
  eyebrow.textContent = "M3E load error";
  const heading = document.createElement("h1");
  heading.textContent = title;
  const body = document.createElement("p");
  body.textContent = detail;
  const meta = document.createElement("code");
  meta.textContent = `workspace=${WORKSPACE_ID} map=${LOCAL_MAP_ID}`;
  const home = document.createElement("a");
  home.href = `./home.html?ws=${encodeURIComponent(WORKSPACE_ID)}`;
  home.textContent = "Open Home";
  panel.append(eyebrow, heading, body, meta, home);
  document.body.append(panel);
}

function clampZoom(nextZoom: number): number {
  return Math.min(VIEWER_TUNING.zoom.max, Math.max(VIEWER_TUNING.zoom.min, nextZoom));
}

function setVisualCheckStatus(lines: string | string[]): void {
  if (!visualCheckEl) {
    return;
  }
  visualCheckEl.textContent = Array.isArray(lines) ? lines.join("\n") : String(lines || "");
}

let _appliedCanvasWidth = "";
let _appliedCanvasHeight = "";
let _appliedCanvasTransform = "";
let _linearPanelLayoutDirty = true;
let _linearPanelAnchorCanvasX = VIEWER_TUNING.layout.leftPad;
let _linearPanelAnchorCanvasY = VIEWER_TUNING.layout.topPad;
let _linearPanelCanvasHeight = 380;
let _lastZoomStatusAt = 0;

function refreshLinearPanelCanvasLayout(): boolean {
  if (!map || !lastLayout || visibleOrder.length === 0) {
    _linearPanelLayoutDirty = true;
    return false;
  }

  if (!_linearPanelLayoutDirty) {
    return true;
  }

  const layout = lastLayout;
  let deepestDepth = -1;
  let deepestRightEdge = VIEWER_TUNING.layout.leftPad;
  let treeMinY = Number.POSITIVE_INFINITY;
  let treeMaxY = Number.NEGATIVE_INFINITY;
  visibleOrder.forEach((nodeId) => {
    const p = layout.pos[nodeId];
    if (!p) {
      return;
    }
    treeMinY = Math.min(treeMinY, p.y - p.h / 2);
    treeMaxY = Math.max(treeMaxY, p.y + p.h / 2);
    if (p.depth > deepestDepth) {
      deepestDepth = p.depth;
      deepestRightEdge = p.x + p.w;
      return;
    }
    if (p.depth === deepestDepth) {
      deepestRightEdge = Math.max(deepestRightEdge, p.x + p.w);
    }
  });
  if (!Number.isFinite(treeMinY) || !Number.isFinite(treeMaxY)) {
    treeMinY = VIEWER_TUNING.layout.topPad;
    treeMaxY = treeMinY + 380;
  }
  const depthOffset = Math.max(56, VIEWER_TUNING.layout.columnGap * 0.45);
  _linearPanelAnchorCanvasX = deepestRightEdge + depthOffset;
  _linearPanelAnchorCanvasY = Math.max(VIEWER_TUNING.layout.topPad, treeMinY - 12);
  _linearPanelCanvasHeight = Math.max(220, treeMaxY - treeMinY + 24);
  _linearPanelLayoutDirty = false;
  return true;
}

function applyZoom(): void {
  const widthValue = `${contentWidth}px`;
  if (_appliedCanvasWidth !== widthValue) {
    canvas.style.width = widthValue;
    _appliedCanvasWidth = widthValue;
  }
  const heightValue = `${contentHeight}px`;
  if (_appliedCanvasHeight !== heightValue) {
    canvas.style.height = heightValue;
    _appliedCanvasHeight = heightValue;
  }
  const transformValue = `translate(${viewState.cameraX}px, ${viewState.cameraY}px) scale(${viewState.zoom})`;
  if (_appliedCanvasTransform !== transformValue) {
    canvas.style.transform = transformValue;
    _appliedCanvasTransform = transformValue;
  }
  syncInlineEditorPosition();
  syncInlineEdgeLabelEditorPosition();
  syncLinearPanelPosition();
  syncTemplateCompletionPlacement();
  window.dispatchEvent(new CustomEvent("m3e:viewport-changed"));
}

function currentCameraTarget(): CameraTarget {
  return {
    cameraX: viewState.cameraX,
    cameraY: viewState.cameraY,
    zoom: viewState.zoom,
  };
}

function cancelCameraMotion(): void {
  if (!cameraMotion) {
    return;
  }
  if (cameraMotion.raf !== null) {
    cancelAnimationFrame(cameraMotion.raf);
  }
  cameraMotion = null;
}

function applyCameraTarget(target: CameraTarget): void {
  viewState.cameraX = target.cameraX;
  viewState.cameraY = target.cameraY;
  viewState.zoom = clampZoom(target.zoom);
  applyZoom();
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function shouldSnapCamera(from: CameraTarget, to: CameraTarget, durationMs: number): boolean {
  if (durationMs <= 0) {
    return true;
  }
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return true;
  }
  return Math.abs(from.cameraX - to.cameraX) < 0.5 &&
    Math.abs(from.cameraY - to.cameraY) < 0.5 &&
    Math.abs(from.zoom - to.zoom) < 0.001;
}

function moveCameraTo(target: CameraTarget, options: CameraMoveOptions = {}): void {
  const clampedTarget = { ...target, zoom: clampZoom(target.zoom) };
  const durationMs = options.durationMs ?? CAMERA_MOTION_DURATION_MS;
  const animate = options.animate !== false;
  const from = currentCameraTarget();
  cancelCameraMotion();

  if (!animate || shouldSnapCamera(from, clampedTarget, durationMs)) {
    applyCameraTarget(clampedTarget);
    return;
  }

  cameraMotion = {
    raf: null,
    from,
    to: clampedTarget,
    startedAt: performance.now(),
    durationMs,
  };

  const step = (now: number): void => {
    if (!cameraMotion) {
      return;
    }
    const motion = cameraMotion;
    const rawT = Math.min(1, Math.max(0, (now - motion.startedAt) / motion.durationMs));
    const t = easeInOutCubic(rawT);
    viewState.cameraX = lerp(motion.from.cameraX, motion.to.cameraX, t);
    viewState.cameraY = lerp(motion.from.cameraY, motion.to.cameraY, t);
    viewState.zoom = lerp(motion.from.zoom, motion.to.zoom, t);
    applyZoom();
    if (rawT >= 1) {
      applyCameraTarget(motion.to);
      cameraMotion = null;
      return;
    }
    motion.raf = requestAnimationFrame(step);
  };

  cameraMotion.raf = requestAnimationFrame(step);
}

function syncLinearPanelPosition(): void {
  if (!linearPanelEl) {
    return;
  }

  if (LOCAL_FS_VIEW_MODE || viewState.surfaceViewMode !== "tree") {
    linearPanelEl.hidden = true;
    return;
  }
  linearPanelEl.hidden = false;

  if (!map || !lastLayout || visibleOrder.length === 0) {
    linearPanelEl.style.removeProperty("left");
    linearPanelEl.style.removeProperty("top");
    linearPanelEl.style.removeProperty("width");
    linearPanelEl.style.removeProperty("height");
    linearPanelEl.style.removeProperty("transform");
    _linearPanelLayoutDirty = true;
    return;
  }

  if (!refreshLinearPanelCanvasLayout()) {
    return;
  }

  const panelCanvasWidth = linearPanelCanvasWidth;
  const panelCanvasHeight = _linearPanelCanvasHeight;
  const zoomScale = viewState.zoom;
  const panelWidth = panelCanvasWidth * zoomScale;
  const panelHeight = panelCanvasHeight * zoomScale;

  const panelLeft = viewState.cameraX + _linearPanelAnchorCanvasX * viewState.zoom;
  const panelTop = viewState.cameraY + _linearPanelAnchorCanvasY * viewState.zoom;

  linearPanelEl.style.left = `${Math.round(panelLeft)}px`;
  linearPanelEl.style.top = `${Math.round(panelTop)}px`;
  linearPanelEl.style.width = `${panelCanvasWidth}px`;
  linearPanelEl.style.height = `${panelCanvasHeight}px`;
  linearPanelEl.style.transform = `scale(${zoomScale})`;
}

function captureManualLinearPanelWidth(): void {
  if (!linearPanelEl || viewState.zoom <= 0) {
    return;
  }
  const renderedWidth = linearPanelEl.getBoundingClientRect().width;
  if (!Number.isFinite(renderedWidth) || renderedWidth <= 0) {
    return;
  }
  const canvasWidth = renderedWidth / viewState.zoom;
  linearPanelCanvasWidth = Math.max(LINEAR_PANEL_WIDTH_MIN, Math.min(LINEAR_PANEL_WIDTH_MAX, canvasWidth));
  if (map) {
    map.state.linearPanelWidth = linearPanelCanvasWidth;
  }
}

function syncInlineEditorPosition(): void {
  if (!inlineEditor || !map || !lastLayout) {
    return;
  }

  const nodeId = inlineEditor.nodeId;
  const nodePos = lastLayout.pos[nodeId];
  if (!nodePos) {
    return;
  }

  const node = getNode(nodeId);
  const isRootLabel = nodeId === map.state.rootId;
  const nodeStyles = readNodeStyleAttrs(node.attributes || {});
  const label = isRootLabel ? uiLabel(node) : diagramLabel(node, nodeStyles);
  const labelLines = splitLabelLines(label || "(empty)");
  const fontSize = nodePos.fontSize ?? (isRootLabel ? VIEWER_TUNING.typography.rootFont : VIEWER_TUNING.typography.nodeFont);
  const lineHeight = lineHeightForFont(fontSize);
  const labelX = isRootLabel
    ? nodePos.x + nodePos.w / 2
    : (isScopePortalNode(node) ? nodePos.x + 12 : nodePos.x);
  const textStartY = multilineTextStartY(nodePos.y, labelLines.length, fontSize, lineHeight);
  const textHeight = Math.max(lineHeight, labelLines.length * lineHeight);
  const left = viewState.cameraX + labelX * viewState.zoom;
  const top = viewState.cameraY + (textStartY - fontSize * 0.82) * viewState.zoom;
  const width = Math.max(28, nodePos.w + (isRootLabel ? 0 : 12));
  const height = Math.max(lineHeight, textHeight);

  inlineEditor.input.style.left = `${left}px`;
  inlineEditor.input.style.top = `${top}px`;
  inlineEditor.input.style.width = `${width}px`;
  inlineEditor.input.style.minWidth = `${width}px`;
  inlineEditor.input.style.minHeight = `${height}px`;
  inlineEditor.input.style.fontSize = `${fontSize}px`;
  inlineEditor.input.style.lineHeight = `${lineHeight}px`;
  inlineEditor.input.style.fontWeight = isRootLabel ? "500" : "450";
  inlineEditor.input.style.transform = isRootLabel
    ? `translateX(-50%) scale(${viewState.zoom})`
    : `scale(${viewState.zoom})`;
  inlineEditor.input.style.transformOrigin = isRootLabel ? "top center" : "top left";
  inlineEditor.input.style.textAlign = isRootLabel ? "center" : "left";
  setEditedSvgLabelVisibility(nodeId, false);
}

function setEditedSvgLabelVisibility(nodeId: string, visible: boolean): void {
  canvas
    .querySelectorAll<SVGTextElement>(`text.label-root[data-node-id="${CSS.escape(nodeId)}"], text.label-node[data-node-id="${CSS.escape(nodeId)}"]`)
    .forEach((label) => {
      label.style.visibility = visible ? "" : "hidden";
    });
}

function incomingTreeEdgeLabelLayout(nodeId: string): { x: number; y: number; width: number } | null {
  if (!map || !lastLayout) {
    return null;
  }
  const node = map.state.nodes[nodeId];
  if (!node?.parentId) {
    return null;
  }
  const parentPos = lastLayout.pos[node.parentId];
  const childPos = lastLayout.pos[nodeId];
  if (!parentPos || !childPos) {
    return null;
  }
  const startX = parentPos.x + parentPos.w + VIEWER_TUNING.layout.edgeStartPad;
  const startY = parentPos.y;
  const endX = childPos.x - VIEWER_TUNING.layout.edgeEndPad;
  const endY = childPos.y;
  const curve = Math.max(48, (endX - startX) * 0.45);
  const c1x = startX + curve;
  const c2x = endX - curve;
  return {
    x: (c1x + c2x) / 2,
    y: (startY + endY) / 2 - 8,
    width: Math.max(72, Math.abs(c2x - c1x) * 0.65),
  };
}

function syncInlineEdgeLabelEditorPosition(): void {
  if (!inlineEdgeLabelEditor) {
    return;
  }
  const edgeLabel = incomingTreeEdgeLabelLayout(inlineEdgeLabelEditor.nodeId);
  if (!edgeLabel) {
    return;
  }
  const left = viewState.cameraX + edgeLabel.x * viewState.zoom;
  const top = viewState.cameraY + (edgeLabel.y - 10) * viewState.zoom;
  inlineEdgeLabelEditor.input.style.left = `${left}px`;
  inlineEdgeLabelEditor.input.style.top = `${top}px`;
  inlineEdgeLabelEditor.input.style.width = `${edgeLabel.width}px`;
  inlineEdgeLabelEditor.input.style.minWidth = `${edgeLabel.width}px`;
  inlineEdgeLabelEditor.input.style.fontSize = "11px";
  inlineEdgeLabelEditor.input.style.lineHeight = "14px";
  inlineEdgeLabelEditor.input.style.transform = `translateX(-50%) scale(${viewState.zoom})`;
  inlineEdgeLabelEditor.input.style.transformOrigin = "top center";
  setEditedEdgeLabelVisibility(inlineEdgeLabelEditor.nodeId, false);
}

function setEditedEdgeLabelVisibility(nodeId: string, visible: boolean): void {
  canvas
    .querySelectorAll<SVGTextElement>(`text.edge-label[data-node-id="${CSS.escape(nodeId)}"]`)
    .forEach((label) => {
      label.style.visibility = visible ? "" : "hidden";
    });
}

function nodeViewportCenter(nodeId: string): { x: number; y: number } | null {
  if (!map || !lastLayout) {
    return null;
  }
  const nodePos = lastLayout.pos[nodeId];
  if (!nodePos) {
    return null;
  }
  const centerX = nodeId === map.state.rootId ? nodePos.x + nodePos.w / 2 : nodePos.x + nodePos.w * 0.5;
  return {
    x: viewState.cameraX + centerX * viewState.zoom,
    y: viewState.cameraY + nodePos.y * viewState.zoom,
  };
}

function preserveNodeViewportCenter(nodeId: string, before: { x: number; y: number } | null): void {
  if (!before) {
    return;
  }
  const after = nodeViewportCenter(nodeId);
  if (!after) {
    return;
  }
  moveCameraTo({
    cameraX: viewState.cameraX + before.x - after.x,
    cameraY: viewState.cameraY + before.y - after.y,
    zoom: viewState.zoom,
  });
}

function nodeViewportRect(nodeId: string): { left: number; right: number; top: number; bottom: number } | null {
  if (!map || !lastLayout) {
    return null;
  }
  const nodePos = lastLayout.pos[nodeId];
  if (!nodePos) {
    return null;
  }
  const nodeHeight = Math.max(VIEWER_TUNING.layout.nodeHitHeight, nodePos.h);
  const left = viewState.cameraX + nodePos.x * viewState.zoom;
  const right = viewState.cameraX + (nodePos.x + nodePos.w) * viewState.zoom;
  const top = viewState.cameraY + (nodePos.y - nodeHeight / 2) * viewState.zoom;
  const bottom = viewState.cameraY + (nodePos.y + nodeHeight / 2) * viewState.zoom;
  return { left, right, top, bottom };
}

function activeSafeViewport(): { left: number; right: number; top: number; bottom: number } {
  const boardRect = board.getBoundingClientRect();
  const toolbarRect = toolbarEl?.getBoundingClientRect();
  const toolbarBottom = toolbarRect ? Math.max(0, toolbarRect.bottom - boardRect.top) : 0;
  const pad = 52;
  return {
    left: pad,
    right: Math.max(pad, boardRect.width - pad),
    top: Math.max(pad, toolbarBottom + 28),
    bottom: Math.max(pad, boardRect.height - pad),
  };
}

function nudgeNodeIntoView(nodeId: string, options: CameraMoveOptions = {}): boolean {
  const rect = nodeViewportRect(nodeId);
  if (!rect) {
    return false;
  }
  const safe = activeSafeViewport();
  let dx = 0;
  let dy = 0;
  if (rect.left < safe.left) {
    dx = safe.left - rect.left;
  } else if (rect.right > safe.right) {
    dx = safe.right - rect.right;
  }
  if (rect.top < safe.top) {
    dy = safe.top - rect.top;
  } else if (rect.bottom > safe.bottom) {
    dy = safe.bottom - rect.bottom;
  }
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
    return false;
  }
  moveCameraTo({
    cameraX: viewState.cameraX + dx,
    cameraY: viewState.cameraY + dy,
    zoom: viewState.zoom,
  }, options);
  return true;
}

function nudgeActiveNodeIntoView(options: CameraMoveOptions = {}): boolean {
  if (!viewState.selectedNodeId) {
    return false;
  }
  return nudgeNodeIntoView(viewState.selectedNodeId, options);
}

function setZoom(
  nextZoom: number,
  anchorClientX: number | null = null,
  anchorClientY: number | null = null,
  statusMode: "immediate" | "throttled" | "silent" = "immediate",
): void {
  cancelCameraMotion();
  const previousZoom = viewState.zoom;
  viewState.zoom = clampZoom(nextZoom);

  const boardRect = board.getBoundingClientRect();
  const pointerX = anchorClientX ?? boardRect.left + boardRect.width / 2;
  const pointerY = anchorClientY ?? boardRect.top + boardRect.height / 2;
  const localViewportX = pointerX - boardRect.left;
  const localViewportY = pointerY - boardRect.top;
  const contentX = (localViewportX - viewState.cameraX) / previousZoom;
  const contentY = (localViewportY - viewState.cameraY) / previousZoom;

  viewState.cameraX = localViewportX - contentX * viewState.zoom;
  viewState.cameraY = localViewportY - contentY * viewState.zoom;
  applyZoom();
  if (statusMode === "silent") {
    return;
  }
  if (statusMode === "throttled") {
    const now = performance.now();
    if (now - _lastZoomStatusAt < 120) {
      return;
    }
    _lastZoomStatusAt = now;
  }
  setStatus(`Zoom ${Math.round(viewState.zoom * 100)}%`);
}

let _zoomSetScheduled = false;
let _pendingZoom: number | null = null;
let _pendingZoomAnchorX: number | null = null;
let _pendingZoomAnchorY: number | null = null;

function scheduleSetZoom(nextZoom: number, anchorClientX: number | null = null, anchorClientY: number | null = null): void {
  cancelCameraMotion();
  _pendingZoom = clampZoom(nextZoom);
  _pendingZoomAnchorX = anchorClientX;
  _pendingZoomAnchorY = anchorClientY;
  if (_zoomSetScheduled) {
    return;
  }
  _zoomSetScheduled = true;
  requestAnimationFrame(() => {
    _zoomSetScheduled = false;
    const zoom = _pendingZoom;
    const anchorX = _pendingZoomAnchorX;
    const anchorY = _pendingZoomAnchorY;
    _pendingZoom = null;
    _pendingZoomAnchorX = null;
    _pendingZoomAnchorY = null;
    if (zoom === null) {
      return;
    }
    setZoom(zoom, anchorX, anchorY, "throttled");
  });
}

let visibleChildrenOverride: ((node: TreeNode) => string[]) | null = null;

function withVisibleChildrenOverride<T>(override: (node: TreeNode) => string[], fn: () => T): T {
  const previous = visibleChildrenOverride;
  visibleChildrenOverride = override;
  try {
    return fn();
  } finally {
    visibleChildrenOverride = previous;
  }
}

function visibleChildren(node: TreeNode): string[] {
  if (visibleChildrenOverride) {
    return visibleChildrenOverride(node);
  }
  if (!node || isAliasNode(node) || viewState.collapsedIds.has(node.id)) {
    return [];
  }
  // Folder nodes work as scope boundaries: hide deeper details unless that folder is the active scope root.
  if (isFolderNode(node) && node.id !== currentScopeRootId()) {
    return [];
  }
  return (node.children || []).filter((childId) => isNodeInScope(childId));
}

function currentSurfaceNode(): TreeNode | null {
  return currentScopeRootNode();
}

function currentSurfaceIsFlowMode(): boolean {
  return viewState.surfaceViewMode === "system";
}

function currentSurfaceIsScatterMode(): boolean {
  return viewState.surfaceViewMode === "scatter";
}

interface FlowPreviewLayout {
  childIds: string[];
  totalWidth: number;
  totalHeight: number;
  positions: Record<string, { x: number; y: number; w: number; h: number }>;
}

function currentFlowSurfaceDetailLevel(): number {
  return currentSurfaceIsFlowMode() ? flowSurfaceDetailLevel : 0;
}

function buildFlowPreviewLayout(node: TreeNode | null | undefined): FlowPreviewLayout | null {
  if (!map || !node || !isFolderNode(node) || currentFlowSurfaceDetailLevel() <= 0) {
    return null;
  }
  const childIds = (node.children || []).filter((childId) => Boolean(map!.state.nodes[childId]));
  if (childIds.length === 0) {
    return null;
  }

  const colMaxWidth: Record<number, number> = {};
  const rowMaxHeight: Record<number, number> = {};
  const childMetrics: Record<string, { w: number; h: number; col: number; row: number }> = {};
  const occupiedRowsByCol: Record<number, Set<number>> = {};
  let maxCol = 0;
  let maxRow = 0;

  childIds.forEach((childId, index) => {
    const child = map!.state.nodes[childId]!;
    const childStyles = readNodeStyleAttrs(child.attributes || {});
    const childLabel = diagramLabel(child, childStyles);
    const measured = isLatexNode(child)
      ? measureLatex(child.text)
      : measureNodeLabel(childLabel, FLOW_SURFACE_PREVIEW_FONT);
    const w = Math.max(110, measured.w + FLOW_SURFACE_PREVIEW_NODE_PAD_X * 2);
    const h = Math.max(FLOW_SURFACE_PREVIEW_NODE_HEIGHT, measured.h + 10);
    const col = flowColOf(child, index);
    const occupiedRows = occupiedRowsByCol[col] || new Set<number>();
    let row = flowRowOf(child, 0);
    while (occupiedRows.has(row)) {
      row += 1;
    }
    occupiedRows.add(row);
    occupiedRowsByCol[col] = occupiedRows;
    childMetrics[childId] = { w, h, col, row };
    colMaxWidth[col] = Math.max(colMaxWidth[col] ?? 0, w);
    rowMaxHeight[row] = Math.max(rowMaxHeight[row] ?? 0, h);
    maxCol = Math.max(maxCol, col);
    maxRow = Math.max(maxRow, row);
  });

  const xByCol: Record<number, number> = {};
  let cursorX = FLOW_SURFACE_PREVIEW_PAD_X;
  for (let col = 0; col <= maxCol; col += 1) {
    xByCol[col] = cursorX;
    cursorX += (colMaxWidth[col] ?? 120) + FLOW_SURFACE_PREVIEW_COL_GAP;
  }

  const yByRow: Record<number, number> = {};
  let cursorY = FLOW_SURFACE_PREVIEW_PAD_Y + FLOW_SURFACE_PREVIEW_TITLE_HEIGHT;
  for (let row = 0; row <= maxRow; row += 1) {
    yByRow[row] = cursorY;
    cursorY += (rowMaxHeight[row] ?? FLOW_SURFACE_PREVIEW_NODE_HEIGHT) + FLOW_SURFACE_PREVIEW_ROW_GAP;
  }

  const positions: Record<string, { x: number; y: number; w: number; h: number }> = {};
  childIds.forEach((childId) => {
    const metric = childMetrics[childId]!;
    positions[childId] = {
      x: xByCol[metric.col]!,
      y: yByRow[metric.row]!,
      w: metric.w,
      h: metric.h,
    };
  });

  return {
    childIds,
    positions,
    totalWidth: Math.max(220, cursorX - FLOW_SURFACE_PREVIEW_COL_GAP + FLOW_SURFACE_PREVIEW_PAD_X),
    totalHeight: Math.max(120, cursorY - FLOW_SURFACE_PREVIEW_ROW_GAP + FLOW_SURFACE_PREVIEW_PAD_Y),
  };
}

function preferredSelectionForScope(scopeId: string): string {
  if (!map || !map.state.nodes[scopeId]) {
    return scopeId;
  }
  const scopeNode = map.state.nodes[scopeId]!;
  if (isFlowSurfaceNode(scopeNode)) {
    const firstVisibleChild = visibleChildren(scopeNode)[0];
    if (firstVisibleChild && map.state.nodes[firstVisibleChild]) {
      return firstVisibleChild;
    }
  }
  return scopeId;
}

function representativeNodeIdInCurrentScope(nodeId: string): string | null {
  if (!map) return null;
  const scopeId = currentScopeRootId();
  if (!scopeId || !map.state.nodes[nodeId]) return null;
  if (nodeId === scopeId) return nodeId;
  let cursor: string | null = nodeId;
  let prev: string | null = null;
  while (cursor) {
    if (cursor === scopeId) {
      return prev;
    }
    prev = cursor;
    cursor = map.state.nodes[cursor]?.parentId ?? null;
  }
  return null;
}

type EdgeAnchorSide = "left" | "right" | "top" | "bottom";

type EdgeConnectionPoint = { x: number; y: number; side: EdgeAnchorSide };

type EdgeConnectionPair = { source: EdgeConnectionPoint; target: EdgeConnectionPoint };

type LinkEndpointKind = "source" | "target";

function positionRect(pos: NodePosition): { x: number; y: number; w: number; h: number } {
  const hitHeight = Math.max(VIEWER_TUNING.layout.nodeHitHeight, pos.h);
  const treatAsRoot = pos.depth === 0;
  return {
    x: treatAsRoot ? pos.x : pos.x - 8,
    y: pos.y - hitHeight / 2,
    w: treatAsRoot ? pos.w : pos.w + 36,
    h: hitHeight,
  };
}

function isParentChildPair(source: TreeNode, target: TreeNode): boolean {
  return source.parentId === target.id || target.parentId === source.id;
}

type LinkConnectionBoundsMode = "hit" | "box" | "mindmap";

function renderedBoxRect(pos: NodePosition): { x: number; y: number; w: number; h: number } {
  const h = Math.max(VIEWER_TUNING.layout.nodeHitHeight, pos.h);
  if (pos.depth === 0) {
    return {
      x: pos.x,
      y: pos.y - h / 2,
      w: pos.w,
      h,
    };
  }
  return {
    x: pos.x - 14,
    y: pos.y - h / 2 + 6,
    w: pos.w + 28,
    h: Math.max(1, h - 12),
  };
}

function mindmapBoxRect(pos: NodePosition): { x: number; y: number; w: number; h: number } {
  const h = Math.max(VIEWER_TUNING.layout.nodeHitHeight, pos.h);
  return {
    x: pos.x,
    y: pos.y - h / 2,
    w: pos.w,
    h,
  };
}

function linkConnectionRect(pos: NodePosition, boundsMode: LinkConnectionBoundsMode = "hit"): { x: number; y: number; w: number; h: number } {
  if (boundsMode === "mindmap") return mindmapBoxRect(pos);
  if (boundsMode === "box") return renderedBoxRect(pos);
  return positionRect(pos);
}

function rectCenter(rect: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function inferBoundarySide(
  rect: { x: number; y: number; w: number; h: number },
  point: { x: number; y: number },
): EdgeAnchorSide {
  const distances: Array<{ side: EdgeAnchorSide; d: number }> = [
    { side: "left", d: Math.abs(point.x - rect.x) },
    { side: "right", d: Math.abs(point.x - (rect.x + rect.w)) },
    { side: "top", d: Math.abs(point.y - rect.y) },
    { side: "bottom", d: Math.abs(point.y - (rect.y + rect.h)) },
  ];
  distances.sort((a, b) => a.d - b.d);
  return distances[0]!.side;
}

function fallbackBoundaryPointBetweenRects(  fromRect: { x: number; y: number; w: number; h: number },
  toRect: { x: number; y: number; w: number; h: number },
): EdgeConnectionPoint {
  const fromCx = fromRect.x + fromRect.w / 2;
  const fromCy = fromRect.y + fromRect.h / 2;
  const toCx = toRect.x + toRect.w / 2;
  const toCy = toRect.y + toRect.h / 2;
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { x: fromRect.x + fromRect.w, y: fromCy, side: "right" }
      : { x: fromRect.x, y: fromCy, side: "left" };
  }
  return dy >= 0
    ? { x: fromCx, y: fromRect.y + fromRect.h, side: "bottom" }
    : { x: fromCx, y: fromRect.y, side: "top" };
}

function offsetConnectionPoint(point: EdgeConnectionPoint, pad: number): EdgeConnectionPoint {
  if (!pad) return point;
  if (point.side === "left") return { ...point, x: point.x - pad };
  if (point.side === "right") return { ...point, x: point.x + pad };
  if (point.side === "top") return { ...point, y: point.y - pad };
  return { ...point, y: point.y + pad };
}

function legacyEdgeEndBetweenRects(
  fromRect: { x: number; y: number; w: number; h: number },
  toRect: { x: number; y: number; w: number; h: number },
  pad = 0,
): EdgeConnectionPoint {
  try {
    const g = joint?.g;
    if (g?.Rect && g?.Point) {
      const to = rectCenter(toRect);
      const intersection = new g.Rect(fromRect.x, fromRect.y, fromRect.w, fromRect.h)
        .intersectionWithLineFromCenterToPoint(new g.Point(to.x, to.y));
      if (intersection && Number.isFinite(intersection.x) && Number.isFinite(intersection.y)) {
        return offsetConnectionPoint({
          x: intersection.x,
          y: intersection.y,
          side: inferBoundarySide(fromRect, intersection),
        }, pad);
      }
    }
  } catch {
    // Fall back to deterministic side anchors if JointJS geometry is unavailable.
  }
  return offsetConnectionPoint(fallbackBoundaryPointBetweenRects(fromRect, toRect), pad);
}

function legacyEdgeEndsBetween(fromPos: NodePosition, toPos: NodePosition, pad = 0): EdgeConnectionPair {
  const sourceRect = positionRect(fromPos);
  const targetRect = positionRect(toPos);
  return {
    source: legacyEdgeEndBetweenRects(sourceRect, targetRect, pad),
    target: legacyEdgeEndBetweenRects(targetRect, sourceRect, pad),
  };
}

function edgePortForSide(
  rect: { x: number; y: number; w: number; h: number },
  side: EdgeAnchorSide,
  pad = 0,
): EdgeConnectionPoint {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  if (side === "left") return { x: rect.x - pad, y: cy, side };
  if (side === "right") return { x: rect.x + rect.w + pad, y: cy, side };
  if (side === "top") return { x: cx, y: rect.y - pad, side };
  return { x: cx, y: rect.y + rect.h + pad, side };
}

function edgePortNormal(side: EdgeAnchorSide): { x: number; y: number } {
  if (side === "left") return { x: -1, y: 0 };
  if (side === "right") return { x: 1, y: 0 };
  if (side === "top") return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

function edgePorts(
  rect: { x: number; y: number; w: number; h: number },
  pad = 0,
): EdgeConnectionPoint[] {
  return [
    edgePortForSide(rect, "left", pad),
    edgePortForSide(rect, "right", pad),
    edgePortForSide(rect, "top", pad),
    edgePortForSide(rect, "bottom", pad),
  ];
}

function outwardPortPenalty(port: EdgeConnectionPoint, vector: { x: number; y: number }): number {
  const normal = edgePortNormal(port.side);
  const dot = normal.x * vector.x + normal.y * vector.y;
  if (dot >= 0) return 0;
  return Math.min(2400, Math.abs(dot) * 8);
}

function edgeSideBiasPenalty(
  source: EdgeConnectionPoint,
  target: EdgeConnectionPoint,
  dx: number,
  dy: number,
): number {
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  if (horizontal) {
    let penalty = 0;
    if (source.side === "top" || source.side === "bottom") penalty += 260;
    if (target.side === "top" || target.side === "bottom") penalty += 260;
    return penalty;
  }
  let penalty = 0;
  if (source.side === "left" || source.side === "right") penalty += 260;
  if (target.side === "left" || target.side === "right") penalty += 260;
  return penalty;
}

function edgePortPairBetweenRects(
  fromRect: { x: number; y: number; w: number; h: number },
  toRect: { x: number; y: number; w: number; h: number },
  pad = 0,
  opts: { sourceSide?: EdgeAnchorSide; targetSide?: EdgeAnchorSide } = {},
): EdgeConnectionPair {
  const fromCenter = { x: fromRect.x + fromRect.w / 2, y: fromRect.y + fromRect.h / 2 };
  const toCenter = { x: toRect.x + toRect.w / 2, y: toRect.y + toRect.h / 2 };
  const centerDx = toCenter.x - fromCenter.x;
  const centerDy = toCenter.y - fromCenter.y;
  let best: (EdgeConnectionPair & { score: number }) | null = null;
  const sourcePorts = opts.sourceSide ? [edgePortForSide(fromRect, opts.sourceSide, pad)] : edgePorts(fromRect, pad);
  const targetPorts = opts.targetSide ? [edgePortForSide(toRect, opts.targetSide, pad)] : edgePorts(toRect, pad);
  for (const source of sourcePorts) {
    for (const target of targetPorts) {
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const score = dx * dx
        + dy * dy
        + outwardPortPenalty(source, { x: centerDx, y: centerDy })
        + outwardPortPenalty(target, { x: -centerDx, y: -centerDy })
        + edgeSideBiasPenalty(source, target, centerDx, centerDy);
      if (!best || score < best.score) {
        best = { source, target, score };
      }
    }
  }
  return best || {
    source: edgePortForSide(fromRect, "right", pad),
    target: edgePortForSide(toRect, "left", pad),
  };
}

function edgeEndsBetween(fromPos: NodePosition, toPos: NodePosition, pad = 0): EdgeConnectionPair {
  return edgePortPairBetweenRects(positionRect(fromPos), positionRect(toPos), pad);
}

function treeRightEdgeEndsBetween(parentPos: NodePosition, childPos: NodePosition): EdgeConnectionPair {
  return edgePortPairBetweenRects(mindmapBoxRect(parentPos), mindmapBoxRect(childPos), 0, {
    sourceSide: "right",
    targetSide: "left",
  });
}

function edgeEndsForGraphLink(sourcePos: NodePosition, targetPos: NodePosition, link: GraphLink, pad = 0, boundsMode: LinkConnectionBoundsMode = "hit"): EdgeConnectionPair {
  return edgePortPairBetweenRects(linkConnectionRect(sourcePos, boundsMode), linkConnectionRect(targetPos, boundsMode), pad, {
    sourceSide: sanitizeLinkPort(link.sourcePort),
    targetSide: sanitizeLinkPort(link.targetPort),
  });
}

function nearestEdgePortSide(
  rect: { x: number; y: number; w: number; h: number },
  point: { x: number; y: number },
): EdgeAnchorSide {
  const candidates = edgePorts(rect, 0).map((port) => ({
    side: port.side,
    distance: Math.hypot(point.x - port.x, point.y - port.y),
  }));
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0]?.side || "right";
}

function renderGraphLinkPortControls(
  link: GraphLink,
  sourcePos: NodePosition,
  targetPos: NodePosition,
  sourceEnd: EdgeConnectionPoint,
  targetEnd: EdgeConnectionPoint,
  boundsMode: LinkConnectionBoundsMode = "hit",
): string {
  const sourceRect = linkConnectionRect(sourcePos, boundsMode);
  const targetRect = linkConnectionRect(targetPos, boundsMode);
  const renderEndpoint = (endpoint: LinkEndpointKind, p: EdgeConnectionPoint): string => {
    const activeClass = endpoint === "source" ? " link-port-handle-source" : " link-port-handle-target";
    return `<circle class="link-port-handle${activeClass}" data-link-port-handle="${endpoint}" data-link-id="${escapeXml(link.id)}" cx="${p.x}" cy="${p.y}" r="7" />`;
  };
  const renderPortDots = (endpoint: LinkEndpointKind, rect: { x: number; y: number; w: number; h: number }, activeSide: EdgeAnchorSide): string =>
    edgePorts(rect, 0)
      .map((port) => {
        const active = port.side === activeSide ? " is-active" : "";
        return `<circle class="link-port-dot${active}" data-link-port-choice="${endpoint}" data-link-port-side="${port.side}" data-link-id="${escapeXml(link.id)}" cx="${port.x}" cy="${port.y}" r="4.5" />`;
      })
      .join("");
  const toolbarX = (sourceEnd.x + targetEnd.x) / 2;
  const toolbarY = (sourceEnd.y + targetEnd.y) / 2 - 30;
  return `<g class="link-port-controls" data-link-id="${escapeXml(link.id)}">
    <rect class="link-mini-toolbar" x="${toolbarX - 31}" y="${toolbarY - 12}" width="62" height="24" rx="6" />
    <circle class="link-mini-toolbar-icon" cx="${toolbarX - 13}" cy="${toolbarY}" r="3" />
    <path class="link-mini-toolbar-icon-line" d="M ${toolbarX - 10} ${toolbarY} C ${toolbarX - 3} ${toolbarY - 10}, ${toolbarX + 3} ${toolbarY + 10}, ${toolbarX + 10} ${toolbarY}" />
    <circle class="link-mini-toolbar-icon" cx="${toolbarX + 13}" cy="${toolbarY}" r="3" />
    ${renderPortDots("source", sourceRect, sourceEnd.side)}
    ${renderPortDots("target", targetRect, targetEnd.side)}
    ${renderEndpoint("source", sourceEnd)}
    ${renderEndpoint("target", targetEnd)}
  </g>`;
}

function roundedOrthogonalPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  opts: { radius?: number; midX?: number } = {},
): string {
  const absDx = Math.abs(tx - sx);
  const absDy = Math.abs(ty - sy);
  if (absDy < 0.5 || absDx < 0.5) {
    return `M ${sx} ${sy} L ${tx} ${ty}`;
  }
  const dirX = tx >= sx ? 1 : -1;
  const dirY = ty >= sy ? 1 : -1;
  const midX = opts.midX ?? sx + (tx - sx) / 2;
  const maxR = Math.min(
    Math.abs(midX - sx) - 0.5,
    Math.abs(tx - midX) - 0.5,
    absDy / 2 - 0.5,
  );
  const r = Math.max(0, Math.min(opts.radius ?? 8, maxR));
  if (r <= 0.5) {
    return `M ${sx} ${sy} H ${midX} V ${ty} H ${tx}`;
  }
  const sweep1 = dirX * dirY > 0 ? 1 : 0;
  const sweep2 = dirX * dirY > 0 ? 0 : 1;
  return `M ${sx} ${sy} H ${midX - dirX * r} A ${r} ${r} 0 0 ${sweep1} ${midX} ${sy + dirY * r} V ${ty - dirY * r} A ${r} ${r} 0 0 ${sweep2} ${midX + dirX * r} ${ty} H ${tx}`;
}

type EdgeAvoidBox = { left: number; right: number; top: number; bottom: number };

function collectEdgeAvoidBoxes(
  positions: Record<string, NodePosition>,
  predicate: (id: string) => boolean,
  bracketExt: number = 0,
): EdgeAvoidBox[] {
  // Layout convention (NodePosition): x = LEFT edge, y = CENTER Y, w / h = full size.
  // bracketExt adds horizontal margin on both sides to account for portal-bracket glyphs.
  const rects: EdgeAvoidBox[] = [];
  for (const id of Object.keys(positions)) {
    if (!predicate(id)) continue;
    const p = positions[id];
    if (!p) continue;
    rects.push({
      left: p.x - bracketExt,
      right: p.x + p.w + bracketExt,
      top: p.y - p.h / 2,
      bottom: p.y + p.h / 2,
    });
  }
  return rects;
}

function midXHitsBox(boxes: EdgeAvoidBox[], x: number, pad: number = 8): EdgeAvoidBox | null {
  for (const b of boxes) {
    if (x >= b.left - pad && x <= b.right + pad) return b;
  }
  return null;
}

function chooseClearMidX(
  sx: number,
  tx: number,
  boxes: EdgeAvoidBox[],
  preferred: number,
  pad: number = 10,
): number {
  if (!midXHitsBox(boxes, preferred, pad)) return preferred;
  const sorted = [...boxes].sort((a, b) => a.left - b.left);
  const candidates: number[] = [];
  const lo = Math.min(sx, tx) - 20;
  const hi = Math.max(sx, tx) + 20;
  // Gaps between consecutive boxes
  for (let i = 0; i < sorted.length - 1; i++) {
    const gapL = sorted[i].right + pad;
    const gapR = sorted[i + 1].left - pad;
    if (gapR > gapL + 4) {
      const mid = (gapL + gapR) / 2;
      if (mid >= lo && mid <= hi) candidates.push(mid);
    }
  }
  if (!candidates.length) return preferred;
  candidates.sort((a, b) => Math.abs(a - preferred) - Math.abs(b - preferred));
  return candidates[0];
}

function uArchTopApex(boxes: EdgeAvoidBox[], sourceTop: number, targetTop: number, lift: number): number {
  let minTop = Math.min(sourceTop, targetTop);
  for (const b of boxes) minTop = Math.min(minTop, b.top);
  return minTop - lift;
}

function uArchBottomApex(boxes: EdgeAvoidBox[], sourceBottom: number, targetBottom: number, drop: number): number {
  let maxBot = Math.max(sourceBottom, targetBottom);
  for (const b of boxes) maxBot = Math.max(maxBot, b.bottom);
  return maxBot + drop;
}

function uArchOrthogonalPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  apexY: number,
  r: number = 8,
): string {
  const dirX = tx >= sx ? 1 : -1;
  const horizontalSpan = Math.abs(tx - sx);
  const goUp = apexY < sy;
  const verticalReach = goUp ? sy - apexY : apexY - sy;
  const verticalReachT = goUp ? ty - apexY : apexY - ty;
  if (horizontalSpan <= r * 2 + 1 || verticalReach <= r + 0.5 || verticalReachT <= r + 0.5) {
    return `M ${sx} ${sy} V ${apexY} H ${tx} V ${ty}`;
  }
  if (goUp) {
    const sweep = dirX > 0 ? 1 : 0;
    return `M ${sx} ${sy} V ${apexY + r} A ${r} ${r} 0 0 ${sweep} ${sx + dirX * r} ${apexY} H ${tx - dirX * r} A ${r} ${r} 0 0 ${sweep} ${tx} ${apexY + r} V ${ty}`;
  } else {
    const sweep = dirX > 0 ? 0 : 1;
    return `M ${sx} ${sy} V ${apexY - r} A ${r} ${r} 0 0 ${sweep} ${sx + dirX * r} ${apexY} H ${tx - dirX * r} A ${r} ${r} 0 0 ${sweep} ${tx} ${apexY - r} V ${ty}`;
  }
}

function smoothGraphLinkPath(sx: number, sy: number, tx: number, ty: number, waveOffset = 0): string {
  const dx = tx - sx;
  const dy = ty - sy;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  if (absDx < 0.5 && absDy < 0.5) {
    return `M ${sx} ${sy}`;
  }
  if (absDx >= absDy) {
    const dirX = dx >= 0 ? 1 : -1;
    const handle = Math.max(44, Math.min(260, absDx * 0.46 + absDy * 0.16));
    return `M ${sx} ${sy} C ${sx + dirX * handle} ${sy + waveOffset}, ${tx - dirX * handle} ${ty - waveOffset}, ${tx} ${ty}`;
  }
  const dirY = dy >= 0 ? 1 : -1;
  const handle = Math.max(44, Math.min(220, absDy * 0.46 + absDx * 0.16));
  return `M ${sx} ${sy} C ${sx + waveOffset} ${sy + dirY * handle}, ${tx - waveOffset} ${ty - dirY * handle}, ${tx} ${ty}`;
}

function graphLinkControlPoints(
  source: EdgeConnectionPoint,
  target: EdgeConnectionPoint,
  waveOffset = 0,
): { c1x: number; c1y: number; c2x: number; c2y: number } {
  const normalSource = edgePortNormal(source.side);
  const normalTarget = edgePortNormal(target.side);
  const distance = Math.hypot(target.x - source.x, target.y - source.y);
  const handle = Math.max(38, Math.min(180, distance * 0.42));
  const waveX = waveOffset * 0.18;
  const waveY = waveOffset * 0.18;
  return {
    c1x: source.x + normalSource.x * handle + (normalSource.y ? waveX : 0),
    c1y: source.y + normalSource.y * handle + (normalSource.x ? waveY : 0),
    c2x: target.x + normalTarget.x * handle - (normalTarget.y ? waveX : 0),
    c2y: target.y + normalTarget.y * handle - (normalTarget.x ? waveY : 0),
  };
}

function graphLinkPathWithPorts(source: EdgeConnectionPoint, target: EdgeConnectionPoint, waveOffset = 0): string {
  if (Math.abs(target.x - source.x) < 0.5 && Math.abs(target.y - source.y) < 0.5) {
    return `M ${source.x} ${source.y}`;
  }
  const c = graphLinkControlPoints(source, target, waveOffset);
  return `M ${source.x} ${source.y} C ${c.c1x} ${c.c1y}, ${c.c2x} ${c.c2y}, ${target.x} ${target.y}`;
}

function graphLinkLabelPointWithPorts(source: EdgeConnectionPoint, target: EdgeConnectionPoint, waveOffset = 0): { x: number; y: number } {
  const c = graphLinkControlPoints(source, target, waveOffset);
  return cubicPointAtHalf(source.x, source.y, c.c1x, c.c1y, c.c2x, c.c2y, target.x, target.y);
}

function smoothArchLinkPath(sx: number, sy: number, tx: number, ty: number, apexY: number): string {
  const handleY = apexY;
  const dx = tx - sx;
  const sideOffset = Math.max(24, Math.min(140, Math.abs(dx) * 0.18));
  const dirX = dx >= 0 ? 1 : -1;
  return `M ${sx} ${sy} C ${sx + dirX * sideOffset} ${handleY}, ${tx - dirX * sideOffset} ${handleY}, ${tx} ${ty}`;
}

function cubicPointAtHalf(sx: number, sy: number, c1x: number, c1y: number, c2x: number, c2y: number, tx: number, ty: number): { x: number; y: number } {
  return {
    x: (sx + 3 * c1x + 3 * c2x + tx) / 8,
    y: (sy + 3 * c1y + 3 * c2y + ty) / 8,
  };
}

function smoothGraphLinkLabelPoint(sx: number, sy: number, tx: number, ty: number, waveOffset = 0): { x: number; y: number } {
  const dx = tx - sx;
  const dy = ty - sy;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  if (absDx >= absDy) {
    const dirX = dx >= 0 ? 1 : -1;
    const handle = Math.max(44, Math.min(260, absDx * 0.46 + absDy * 0.16));
    return cubicPointAtHalf(sx, sy, sx + dirX * handle, sy + waveOffset, tx - dirX * handle, ty - waveOffset, tx, ty);
  }
  const dirY = dy >= 0 ? 1 : -1;
  const handle = Math.max(44, Math.min(220, absDy * 0.46 + absDx * 0.16));
  return cubicPointAtHalf(sx, sy, sx + waveOffset, sy + dirY * handle, tx - waveOffset, ty - dirY * handle, tx, ty);
}

function currentLinearMemoScopeId(): string {
  return normalizedCurrentScopeId();
}

function normalizedCurrentScopeId(): string {
  if (!map) {
    return "";
  }
  if (map.state.nodes[viewState.currentScopeId]) {
    return viewState.currentScopeId;
  }
  return map.state.rootId;
}

function isNodeInScope(nodeId: string): boolean {
  if (!map) {
    return false;
  }
  const scopeId = normalizedCurrentScopeId();
  if (!scopeId) {
    return false;
  }
  let currentId: string | null = nodeId;
  while (currentId) {
    if (currentId === scopeId) {
      return true;
    }
    currentId = map.state.nodes[currentId]?.parentId ?? null;
  }
  return false;
}

function scopedChildrenRaw(nodeId: string): string[] {
  if (!map) {
    return [];
  }
  const node = map.state.nodes[nodeId];
  if (!node) {
    return [];
  }
  return (node.children || []).filter((childId) => isNodeInScope(childId));
}

function importanceScore(nodeId: string): number {
  if (!map) {
    return 0;
  }
  const node = map.state.nodes[nodeId];
  if (!node) {
    return 0;
  }
  const attrs = node.attributes || {};
  const raw = String(attrs["importance"] ?? attrs["priority"] ?? attrs["重要度"] ?? "").trim().toLowerCase();
  if (!raw) {
    return 0;
  }
  if (/^[0-9]+$/.test(raw)) {
    return Math.max(0, Number(raw));
  }
  if (raw.includes("critical") || raw.includes("urgent") || raw.includes("highest") || raw.includes("緊急")) {
    return 4;
  }
  if (raw === "h" || raw.includes("high") || raw.includes("top") || raw.includes("高")) {
    return 3;
  }
  if (raw === "m" || raw.includes("medium") || raw.includes("mid") || raw.includes("中")) {
    return 2;
  }
  if (raw === "l" || raw.includes("low") || raw.includes("低")) {
    return 1;
  }
  return 0;
}

function isNodeVisibleByImportance(nodeId: string): boolean {
  if (!importanceVisibleNodeIds) {
    return true;
  }
  return importanceVisibleNodeIds.has(nodeId);
}

function rebuildImportanceVisibility(): void {
  if (!map || importanceViewMode === "all") {
    importanceVisibleNodeIds = null;
    return;
  }

  const threshold = importanceViewMode === "high-only" ? 3 : 2;
  const scopeRootId = normalizedCurrentScopeId();
  const visible = new Set<string>();

  function walk(nodeId: string): boolean {
    const node = map!.state.nodes[nodeId];
    if (!node) {
      return false;
    }
    const selfMatched = importanceScore(nodeId) >= threshold;
    let childMatched = false;
    scopedChildrenRaw(nodeId).forEach((childId) => {
      if (walk(childId)) {
        childMatched = true;
      }
    });
    const keep = selfMatched || childMatched;
    if (keep) {
      visible.add(nodeId);
    }
    return keep;
  }

  walk(scopeRootId);
  visible.add(scopeRootId);
  importanceVisibleNodeIds = visible;
}

function scopeChildren(nodeId: string): string[] {
  if (!map) {
    return [];
  }
  const node = map.state.nodes[nodeId];
  if (!node) {
    return [];
  }
  return scopedChildrenRaw(nodeId).filter((childId) => isNodeVisibleByImportance(childId));
}

function buildLinearFromScope(): { text: string; map: LinearLineMap[] } {
  if (!map) {
    return { text: "", map: [] };
  }

  const scopeRootId = normalizedCurrentScopeId();
  const lines: string[] = [];
  const lineMap: LinearLineMap[] = [];

  function walk(nodeId: string, depth: number): void {
    const node = map!.state.nodes[nodeId];
    if (!node) {
      return;
    }

    const label = String(node.text || "").trim() || "(empty)";
    const indent = "  ".repeat(depth);
    lines.push(`${indent}- ${label}`);
    lines.push(`${indent}  note: `);
    lines.push("");

    scopeChildren(nodeId).forEach((childId) => walk(childId, depth + 1));
  }

  walk(scopeRootId, 0);
  return {
    text: lines.join("\n"),
    map: lineMap,
  };
}

function buildTreeScopeTransformSource(): string {
  if (!map) {
    return "";
  }

  const scopeRootId = normalizedCurrentScopeId();
  const chunks: string[] = [];

  function walk(nodeId: string, depth: number): void {
    const node = map!.state.nodes[nodeId];
    if (!node) {
      return;
    }

    const indent = "  ".repeat(depth);
    chunks.push(`${indent}- id: ${node.id}`);
    chunks.push(`${indent}  text: ${JSON.stringify(node.text || "")}`);
    chunks.push(`${indent}  type: ${node.nodeType || "text"}`);
    if (node.details) {
      chunks.push(`${indent}  details: ${JSON.stringify(node.details)}`);
    }
    if (node.note) {
      chunks.push(`${indent}  note: ${JSON.stringify(node.note)}`);
    }
    if (node.scopeId) {
      chunks.push(`${indent}  scopeId: ${JSON.stringify(node.scopeId)}`);
    }
    const attributes = Object.entries(node.attributes || {});
    if (attributes.length > 0) {
      chunks.push(`${indent}  attributes:`);
      attributes.forEach(([key, value]) => {
        chunks.push(`${indent}    ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
      });
    }
    scopeChildren(nodeId).forEach((childId) => walk(childId, depth + 1));
  }

  walk(scopeRootId, 0);
  return chunks.join("\n");
}

async function fetchLinearTransformStatus(): Promise<LinearTransformStatus | null> {
  try {
    const response = await fetch("/api/ai/status", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json() as AiStatusResponse;
    linearTransformStatus = {
      ok: true,
      enabled: payload.enabled,
      configured: payload.configured,
      provider: payload.provider,
      transport: payload.transport,
      model: payload.model,
      endpoint: payload.endpoint,
      promptConfigured: Boolean(payload.features["linear-transform"]?.promptConfigured),
      message: payload.message,
    };
    return linearTransformStatus;
  } catch {
    return null;
  }
}

async function requestLinearSubagentTransform(
  direction: LinearTransformDirection,
  instruction?: string,
): Promise<LinearTransformResponse> {
  const scopeRootId = normalizedCurrentScopeId();
  const scopeLabel = map?.state.nodes[scopeRootId]?.text || scopeRootId;
  const payload: AiSubagentRequest = {
    mapId: LOCAL_MAP_ID,
    scopeId: scopeRootId,
    mode: "direct-result",
    input: {
      direction,
      sourceText: direction === "tree-to-linear" ? buildTreeScopeTransformSource() : linearTextEl.value,
      scopeLabel,
      instruction: instruction || null,
    },
  };

  const response = await fetch("/api/ai/subagent/linear-transform", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Linear transform request failed.");
  }
  return {
    ok: true,
    direction,
    provider: String(result.provider || linearTransformStatus?.provider || "deepseek"),
    model: String(result.model || linearTransformStatus?.model || ""),
    outputText: String(result.proposal?.result?.outputText || ""),
    rawText: String(result.proposal?.result?.rawText || ""),
    usage: result.usage || undefined,
  };
}

type RapidGenerateAction = "detail" | "examples" | "classify" | "related";

const RAPID_GENERATE_INSTRUCTIONS: Record<RapidGenerateAction, string> = {
  detail: "詳細を追加。選択nodeを具体化する子topicを返す。",
  examples: "例を追加。選択nodeの理解に役立つ具体例の子topicを返す。",
  classify: "子分類を追加。選択nodeを分解する分類カテゴリの子topicを返す。",
  related: "関連topicを追加。選択nodeと隣接する概念や次に調べるtopicを返す。",
};

const RAPID_MAPIFY_OP_BY_ACTION: Record<RapidGenerateAction, string> = {
  detail: "RF1.expandSelectedNode",
  examples: "RF2.addExamples",
  classify: "RF3.addSubtypes",
  related: "RF6.addRelatedTopics",
};

interface RapidMapifyOracleApplyResponse {
  ok: true;
  savedAt?: string;
  opId: string;
  action: RapidGenerateAction;
  source: "mapify_teacher_fixture" | "m3e_local_mf_h_fallback";
  fragment: string;
  added: Array<{ id: string; parentId: string; label: string }>;
  merged: Array<{ id: string; parentId: string; label: string }>;
  diagnostics?: string[];
  oracle?: {
    teacherLabels?: string[];
    teacherProximity?: number | null;
  };
}

async function requestRapidMapifyOracleForSelectedNode(action: RapidGenerateAction): Promise<RapidMapifyOracleApplyResponse> {
  if (!map || !viewState.selectedNodeId) {
    throw new Error("No node is selected.");
  }
  const response = await fetch(`/api/maps/${encodeURIComponent(LOCAL_MAP_ID)}/rapid/mapify-oracle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-M3E-Tab-Id": TAB_ID,
    },
    body: JSON.stringify({
      workspaceId: WORKSPACE_ID,
      agentId: "rapid-mapify-oracle",
      selectedNodeId: viewState.selectedNodeId,
      opId: RAPID_MAPIFY_OP_BY_ACTION[action],
      action,
      baseSavedAt: lastServerSavedAt,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(result.error || "Rapid Mapify Oracle request failed."));
  }
  return result as RapidMapifyOracleApplyResponse;
}

async function requestTopicSuggestionsForSelectedNode(maxTopics = 5, instructionOverride = ""): Promise<string[]> {
  if (!map || !viewState.selectedNodeId) {
    throw new Error("No node is selected.");
  }
  const selected = getNode(viewState.selectedNodeId);
  const payload: AiSubagentRequest = {
    mapId: LOCAL_MAP_ID,
    scopeId: normalizedCurrentScopeId(),
    mode: "proposal",
    input: {
      nodeText: selected.text,
      nodeDetails: instructionOverride || selected.details || "",
      maxTopics,
    },
  };

  const response = await fetch("/api/ai/subagent/topic-suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(result.error || "Topic suggestion request failed."));
  }

  const rawTopics = result.proposal?.result?.topics;
  if (!Array.isArray(rawTopics)) {
    return [];
  }
  return rawTopics
    .map((value) => String(value || "").trim())
    .filter((value) => value.length > 0)
    .slice(0, maxTopics);
}

/** Build a structured query prompt about the selected node for pasting into Claude */
function buildNodeQueryPrompt(): string | null {
  if (!map || !viewState.selectedNodeId) return null;
  const state = map.state;
  const node = getNode(viewState.selectedNodeId);
  if (!node) return null;

  // Build ancestor path
  const ancestors: string[] = [];
  let curId: string | null = node.parentId;
  while (curId && curId !== state.rootId) {
    const ancestor = state.nodes[curId];
    if (!ancestor) break;
    ancestors.unshift(ancestor.text);
    curId = ancestor.parentId;
  }
  const nodePath = [...ancestors, node.text].join(" > ");

  // Collect attributes
  const attrLines = Object.entries(node.attributes || {})
    .filter(([k]) => !k.startsWith("m3e:"))
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");

  // Collect graph links
  const links = Object.values(state.links || {})
    .filter((l) => l.sourceNodeId === node.id || l.targetNodeId === node.id)
    .map((l) => {
      const other = l.sourceNodeId === node.id
        ? state.nodes[l.targetNodeId]
        : state.nodes[l.sourceNodeId];
      const dir = l.sourceNodeId === node.id ? "\u2192" : "\u2190";
      const rel = l.relationType || l.label || "";
      return `  ${dir} ${rel ? rel + ": " : ""}${other?.text || "(unknown)"}`;
    })
    .join("\n");

  // Collect children (first 10)
  const children = (node.children || [])
    .slice(0, 10)
    .map((cid: string) => state.nodes[cid]?.text || "(empty)")
    .join(", ");
  const childSuffix = (node.children || []).length > 10 ? ` (+${(node.children || []).length - 10} more)` : "";

  let prompt = `# M3E Node Query\n\n`;
  prompt += `**Node:** ${node.text}\n`;
  prompt += `**Path:** ${nodePath}\n`;
  if (node.details) prompt += `**Details:** ${node.details}\n`;
  if (node.note) prompt += `**Note:** ${node.note}\n`;
  if (attrLines) prompt += `**Attributes:**\n${attrLines}\n`;
  if (links) prompt += `**Links:**\n${links}\n`;
  if (children) prompt += `**Children:** ${children}${childSuffix}\n`;
  prompt += `\n---\nPlease explain this node, identify missing information, and suggest how it relates to its parent concepts.\n`;

  return prompt;
}

async function copyNodeQueryToClipboard(): Promise<void> {
  const prompt = buildNodeQueryPrompt();
  if (!prompt) {
    setStatus("No node selected.", true);
    return;
  }
  if (await copyTextToSystemClipboard(prompt)) {
    setStatus("Node query copied to clipboard \u2014 paste into Claude.");
    return;
  }
  setStatus("Failed to copy to system clipboard.", true);
}

/** Compute and display scope-level statistics as a dashboard overlay */
function showScopeDashboard(): void {
  if (!map) { setStatus("No map loaded.", true); return; }
  const state = map.state;
  const scopeId = normalizedCurrentScopeId();
  const scopeNode = state.nodes[scopeId];
  if (!scopeNode) { setStatus("No scope node.", true); return; }

  // Collect all nodes in current scope via BFS
  const ids: string[] = [];
  const stack = [scopeId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    const n = state.nodes[id];
    if (!n) continue;
    ids.push(id);
    for (const cid of n.children || []) stack.push(cid);
  }

  // Aggregate stats
  const total = ids.length;
  let aliasCount = 0;
  let folderCount = 0;
  let withDetails = 0;
  let withLinks = 0;
  const statusCounts: Record<string, number> = {};
  const linkSet = new Set<string>();

  for (const id of ids) {
    const n = state.nodes[id]!;
    if (n.nodeType === "alias") aliasCount++;
    if (n.nodeType === "folder") folderCount++;
    if (n.details && n.details.trim().length > 0) withDetails++;
    const st = n.attributes?.["m3e:status"];
    if (st) statusCounts[st] = (statusCounts[st] || 0) + 1;
  }

  // Count links touching this scope
  for (const link of Object.values(state.links || {})) {
    const idSet = new Set(ids);
    if (idSet.has(link.sourceNodeId) || idSet.has(link.targetNodeId)) {
      linkSet.add(link.id);
    }
  }

  // Build dashboard text
  const lines: string[] = [];
  lines.push(`\u2500\u2500 Scope Dashboard: ${scopeNode.text} \u2500\u2500`);
  lines.push(`Nodes: ${total}  |  Folders: ${folderCount}  |  Aliases: ${aliasCount}`);
  lines.push(`With details: ${withDetails}/${total} (${total > 0 ? Math.round(withDetails/total*100) : 0}%)`);
  lines.push(`Links: ${linkSet.size}`);
  if (Object.keys(statusCounts).length > 0) {
    const statusLine = Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([s, c]) => `${s}:${c}`)
      .join("  ");
    lines.push(`Status: ${statusLine}`);
  } else {
    lines.push(`Status: (none tagged)`);
  }

  // Depth stats
  let maxDepth = 0;
  const depthStack: Array<{ id: string; d: number }> = [{ id: scopeId, d: 0 }];
  while (depthStack.length > 0) {
    const { id, d } = depthStack.pop()!;
    if (d > maxDepth) maxDepth = d;
    const n = state.nodes[id];
    if (n) for (const cid of n.children || []) depthStack.push({ id: cid, d: d + 1 });
  }
  lines.push(`Max depth: ${maxDepth}`);

  setVisualCheckStatus(lines);
  setTimeout(() => setVisualCheckStatus(""), 8000);
}

function appendTopicSuggestionsToNode(topics: string[], targetNodeId = viewState.selectedNodeId): number {
  if (!map || !targetNodeId || topics.length === 0) {
    return 0;
  }
  const parent = getNode(targetNodeId);
  if (!parent) {
    throw new Error(`Target node not found: ${targetNodeId}`);
  }
  if (isAliasNode(parent)) {
    throw new Error("Alias nodes cannot own children.");
  }

  const existingLabels = new Set(
    (parent.children || [])
      .map((childId) => map!.state.nodes[childId]?.text?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value)),
  );

  const normalized = topics
    .map((topic) => topic.trim())
    .filter((topic) => topic.length > 0)
    .filter((topic) => !existingLabels.has(topic.toLowerCase()));
  if (normalized.length === 0) {
    return 0;
  }

  pushUndoSnapshot();
  normalized.forEach((topic) => {
    const id = newId();
    map!.state.nodes[id] = createNodeRecord(id, parent.id, topic);
    parent.children.push(id);
  });
  viewState.collapsedIds.delete(parent.id);
  parent.collapsed = false;
  touchDocument();
  return normalized.length;
}

function appendTopicSuggestionsToSelectedNode(topics: string[]): number {
  return appendTopicSuggestionsToNode(topics, viewState.selectedNodeId);
}

async function generateRelatedTopicsForSelectedNode(): Promise<void> {
  if (!map || !viewState.selectedNodeId) {
    setStatus("Select a node first.", true);
    return;
  }
  try {
    const topics = await requestTopicSuggestionsForSelectedNode(5);
    const added = appendTopicSuggestionsToSelectedNode(topics);
    if (added === 0) {
      setStatus("No new related topics were suggested.");
      return;
    }
    setStatus(`AI suggested ${added} related topic(s).`);
    render();
    board.focus();
  } catch (err) {
    setStatus(`AI topic suggestion failed (${(err as Error).message}).`, true);
  }
}

async function generateRapidActionForSelectedNode(
  action: RapidGenerateAction,
  label: string,
  instruction: string,
): Promise<void> {
  if (!map || !viewState.selectedNodeId) {
    setStatus("Select a node first.", true);
    return;
  }
  void instruction;
  try {
    const result = await requestRapidMapifyOracleForSelectedNode(action);
    if (result.savedAt) {
      await applyExternalUpdate(result.savedAt);
    }
    const added = result.added.length;
    const merged = result.merged.length;
    const sourceLabel = "Mapify Oracle";
    if (added === 0 && merged === 0) {
      setStatus(`${sourceLabel} generated no new nodes: ${label || action}`);
      return;
    }
    const mergedSuffix = merged > 0 ? `, merged ${merged}` : "";
    setStatus(`${sourceLabel} generated ${added} node(s)${mergedSuffix}: ${label || action}`);
    render();
    board.focus();
  } catch (err) {
    setStatus(`Rapid generation failed: ${(err as Error).message}`, true);
  }
}

window.addEventListener("m3e:ai-append-topics", (event: Event) => {
  const detail = (event as CustomEvent<{ topics?: unknown[]; targetNodeId?: unknown }>).detail;
  const topics = Array.isArray(detail?.topics)
    ? detail.topics.map((topic) => String(topic || "").trim()).filter(Boolean)
    : [];
  const targetNodeId = typeof detail?.targetNodeId === "string" && detail.targetNodeId.trim().length > 0
    ? detail.targetNodeId.trim()
    : viewState.selectedNodeId;
  try {
    const added = appendTopicSuggestionsToNode(topics, targetNodeId);
    if (added === 0) {
      setStatus("No new AI topics to apply.");
      return;
    }
    setStatus(`AI applied ${added} topic node(s).`);
    render();
    board.focus();
  } catch (err) {
    setStatus(`AI apply failed: ${(err as Error).message}`, true);
  }
});

window.addEventListener("m3e:ai-detail-active-node", () => {
  void generateRelatedTopicsForSelectedNode();
});

window.addEventListener("m3e:rapid-action-preview", (event: Event) => {
  const label = String((event as CustomEvent<{ label?: unknown }>).detail?.label || "").trim();
  setStatus(`Rapid: ${label || "action"}`);
  board.focus();
});

window.addEventListener("m3e:rapid-action-generate", (event: Event) => {
  const detail = (event as CustomEvent<{
    action?: unknown;
    label?: unknown;
    instruction?: unknown;
  }>).detail || {};
  const action = String(detail.action || "detail").trim() as RapidGenerateAction;
  const label = String(detail.label || action).trim();
  const instruction = String(detail.instruction || "").trim();
  if (!Object.prototype.hasOwnProperty.call(RAPID_GENERATE_INSTRUCTIONS, action)) {
    setStatus(`Rapid generation failed: unknown action ${action}`, true);
    return;
  }
  void generateRapidActionForSelectedNode(action, label, instruction);
});

function linearOffsetToLineIndex(text: string, offset: number): number {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  if (safeOffset === 0) {
    return 0;
  }
  let lineIndex = 0;
  for (let i = 0; i < safeOffset; i += 1) {
    if (text.charCodeAt(i) === 10) {
      lineIndex += 1;
    }
  }
  return lineIndex;
}

function syncLinearCaretToSelectedNode(): void {
  if (!linearTextEl || linearLineMap.length === 0) {
    return;
  }
  const entry = linearLineMap.find((item) => item.nodeId === viewState.selectedNodeId);
  if (!entry) {
    return;
  }
  suppressLinearSelectionSync = true;
  if (document.activeElement === linearTextEl) {
    linearTextEl.setSelectionRange(entry.startOffset, entry.endOffset);
  }
  suppressLinearSelectionSync = false;
}

function renderLinearPanel(): void {
  if (linearPanelEl) {
    linearPanelEl.hidden = LOCAL_FS_VIEW_MODE || viewState.surfaceViewMode !== "tree";
  }
  if (LOCAL_FS_VIEW_MODE || viewState.surfaceViewMode !== "tree") {
    return;
  }
  if (!linearTextEl) {
    return;
  }
  if (!map) {
    linearTextEl.value = "";
    if (linearMetaEl) {
      linearMetaEl.textContent = "No scope loaded";
    }
    if (linearApplyBtn) linearApplyBtn.disabled = true;
    if (linearResetBtn) linearResetBtn.disabled = true;
    return;
  }

  const scopeRootId = currentLinearMemoScopeId();
  const templateText = buildLinearFromScope().text;
  if (!(scopeRootId in linearNotesByScope)) {
    linearNotesByScope[scopeRootId] = templateText;
    syncLinearNotesToDocState();
  }
  const scopeMemo = linearNotesByScope[scopeRootId] || "";
  linearDirty = scopeMemo !== templateText;

  if (document.activeElement !== linearTextEl) {
    linearTextEl.value = scopeMemo;
  }
  linearLineMap = [];

  const scopeLabel = map.state.nodes[scopeRootId]?.text || scopeRootId;
  if (linearMetaEl) {
    linearMetaEl.textContent = `scope memo: ${scopeLabel} | ${linearDirty ? "dirty" : "synced"}`;
  }
  if (linearApplyBtn) linearApplyBtn.disabled = !linearDirty;
  if (linearResetBtn) linearResetBtn.disabled = !linearDirty;
}

function parseLinearText(text: string): LinearNodeDraft {
  const sourceLines = String(text || "").replaceAll("\r", "").split("\n");
  const lines = sourceLines
    .map((raw, index) => ({ raw, index: index + 1 }))
    .filter((line) => line.raw.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("Linear text is empty.");
  }

  const stack: LinearNodeDraft[] = [];
  let root: LinearNodeDraft | null = null;
  let previousDepth = 0;

  lines.forEach((line, idx) => {
    if (/\t/.test(line.raw)) {
      throw new Error(`Invalid indentation at line ${line.index}: tab is not allowed.`);
    }
    const leadingSpaces = line.raw.match(/^ */)?.[0].length ?? 0;
    if (leadingSpaces % 2 !== 0) {
      throw new Error(`Invalid indentation at line ${line.index}: use multiples of 2 spaces.`);
    }
    const depth = Math.floor(leadingSpaces / 2);
    const label = line.raw.trim();
    if (!label) {
      throw new Error(`Empty label at line ${line.index}.`);
    }
    if (idx === 0 && depth !== 0) {
      throw new Error(`Invalid root depth at line ${line.index}: root must start at depth 0.`);
    }
    if (idx > 0 && depth > previousDepth + 1) {
      throw new Error(`Invalid depth transition at line ${line.index}: skipped hierarchy level.`);
    }

    const node: LinearNodeDraft = {
      label,
      children: [],
    };

    if (depth === 0) {
      if (root) {
        throw new Error(`Invalid root at line ${line.index}: multiple root lines are not allowed.`);
      }
      root = node;
    } else {
      const parent = stack[depth - 1];
      if (!parent) {
        throw new Error(`Invalid parent reference at line ${line.index}.`);
      }
      parent.children.push(node);
    }

    stack[depth] = node;
    stack.length = depth + 1;
    previousDepth = depth;
  });

  if (!root) {
    throw new Error("Linear root node is missing.");
  }
  return root;
}

function deleteSubtree(nodeId: string): void {
  if (!map) {
    return;
  }
  const stack: string[] = [nodeId];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const current = map.state.nodes[currentId];
    if (!current) {
      continue;
    }
    stack.push(...(current.children || []));
    delete map.state.nodes[currentId];
  }
}

function reconcileLinearSubtree(nodeId: string, draft: LinearNodeDraft): void {
  if (!map) {
    return;
  }

  const node = getNode(nodeId);
  node.text = draft.label;
  const existingChildren = [...(node.children || [])];
  const nextChildren: string[] = [];

  draft.children.forEach((childDraft, index) => {
    const existingId = existingChildren[index];
    if (existingId && map!.state.nodes[existingId]) {
      reconcileLinearSubtree(existingId, childDraft);
      nextChildren.push(existingId);
      return;
    }

    const newChildId = newId();
    map!.state.nodes[newChildId] = createNodeRecord(newChildId, nodeId, childDraft.label);
    reconcileLinearSubtree(newChildId, childDraft);
    nextChildren.push(newChildId);
  });

  existingChildren.slice(draft.children.length).forEach((redundantId) => {
    deleteSubtree(redundantId);
  });

  node.children = nextChildren;
}

function applyLinearTextToScope(): void {
  if (!map) {
    return;
  }
  try {
    const parsed = parseLinearText(linearTextEl.value);
    const scopeRootId = normalizedCurrentScopeId();

    pushUndoSnapshot();
    reconcileLinearSubtree(scopeRootId, parsed);

    if (!map.state.nodes[viewState.selectedNodeId] || !isNodeInScope(viewState.selectedNodeId)) {
      viewState.selectedNodeId = scopeRootId;
    }

    linearDirty = false;
    touchDocument();
    setStatus("Linear text applied to current scope.");
    board.focus();
  } catch (err) {
    setStatus(`Linear apply failed: ${(err as Error).message}`, true);
  }
}

function countHiddenDescendants(nodeId: string): number {
  if (!map) {
    return 0;
  }
  const node = map.state.nodes[nodeId];
  if (!node) {
    return 0;
  }
  let count = 0;
  const stack = [...(node.children || [])];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const current = map.state.nodes[currentId];
    if (!current) {
      continue;
    }
    count += 1;
    stack.push(...(current.children || []));
  }
  return count;
}

type ScatterNodeSet = {
  ids: string[];
  depthOf: Record<string, number>;
};

type ScatterSimEdge = {
  sourceId: string;
  targetId: string;
  weight: number;
};

function collectScatterNodes(state: AppState, rootId: string): ScatterNodeSet {
  const ids: string[] = [];
  const depthOf: Record<string, number> = {};
  const visit = (nodeId: string, depth: number): void => {
    const node = state.nodes[nodeId];
    if (!node) {
      return;
    }
    ids.push(nodeId);
    depthOf[nodeId] = depth;
    if (viewState.collapsedIds.has(nodeId)) {
      return;
    }
    (node.children || []).forEach((childId) => visit(childId, depth + 1));
  };
  (state.nodes[rootId]?.children || []).forEach((childId) => visit(childId, 0));
  return { ids, depthOf };
}

function scatterNodeIsCollapsedGroup(state: AppState, nodeId: string): boolean {
  const node = state.nodes[nodeId];
  return Boolean(node && viewState.collapsedIds.has(nodeId) && (node.children || []).length > 0);
}

function scatterCountScale(vertexCount: number): number {
  if (vertexCount <= 16) {
    return 1;
  }
  return Math.min(1, Math.max(0.65, Math.pow(16 / vertexCount, 0.6)));
}

function scatterDepthScale(depth: number): number {
  return Math.max(SCATTER_MIN_SCALE, Math.pow(SCATTER_DEPTH_SCALE, Math.max(0, depth)));
}

function scatterRadiusFor(nodeId: string, depth: number, vertexCount: number): number {
  const hiddenBoost = map && scatterNodeIsCollapsedGroup(map.state, nodeId)
    ? Math.min(18, Math.sqrt(countHiddenDescendants(nodeId)) * 5)
    : 0;
  return Math.max(SCATTER_MIN_RADIUS, SCATTER_NODE_RADIUS * scatterCountScale(vertexCount) * scatterDepthScale(depth) + hiddenBoost);
}

function scatterFontSizeFor(radius: number): number {
  return Math.max(13, Math.min(18, radius * 0.56));
}

function scatterSeedCenter(): { x: number; y: number } {
  return {
    x: VIEWER_TUNING.layout.leftPad + 620,
    y: VIEWER_TUNING.layout.topPad + 390,
  };
}

function scatterSeedPositions(
  state: AppState,
  rootId: string,
  ids: string[],
  depthOf: Record<string, number>,
): Record<string, { x: number; y: number }> {
  const center = scatterSeedCenter();
  const idSet = new Set(ids);
  const visibleChildrenForSeed = (nodeId: string): string[] =>
    (state.nodes[nodeId]?.children || []).filter((childId) => idSet.has(childId));
  const childLeafCount = new Map<string, number>();
  const leafCount = (nodeId: string): number => {
    const cached = childLeafCount.get(nodeId);
    if (cached != null) return cached;
    const children = visibleChildrenForSeed(nodeId);
    const count = children.length ? children.reduce((sum, childId) => sum + leafCount(childId), 0) : 1;
    childLeafCount.set(nodeId, count);
    return count;
  };

  const yByNode: Record<string, number> = {};
  const assignBreadth = (nodeId: string, top: number): number => {
    const children = visibleChildrenForSeed(nodeId);
    if (!children.length) {
      yByNode[nodeId] = top;
      return top + scatterEdgeLength * 0.76;
    }
    let cursor = top;
    children.forEach((childId) => {
      cursor = assignBreadth(childId, cursor);
    });
    yByNode[nodeId] = (yByNode[children[0]!]! + yByNode[children[children.length - 1]!]!) / 2;
    return cursor;
  };
  const totalBreadth = leafCount(rootId) * scatterEdgeLength * 0.76;
  assignBreadth(rootId, center.y - totalBreadth / 2);

  const rankPeers: Record<number, string[]> = {};
  ids.forEach((nodeId) => {
    const depth = depthOf[nodeId] ?? 0;
    if (!rankPeers[depth]) rankPeers[depth] = [];
    rankPeers[depth]!.push(nodeId);
  });

  const seeded: Record<string, { x: number; y: number }> = {};
  ids.forEach((nodeId) => {
    const depth = depthOf[nodeId] ?? 0;
    const peers = rankPeers[depth] || [];
    const peerIndex = Math.max(0, peers.indexOf(nodeId));
    const siblingNudge = ((peerIndex % 3) - 1) * 12;
    seeded[nodeId] = {
      x: center.x + (depth - 1) * scatterEdgeLength * 1.26,
      y: (yByNode[nodeId] ?? center.y) + siblingNudge,
    };
  });
  if (ids.includes(rootId)) {
    seeded[rootId] = {
      x: center.x - scatterEdgeLength * 1.18,
      y: yByNode[rootId] ?? center.y,
    };
  }
  return seeded;
}

function scatterApplyRankFlowSeed(state: AppState, rootId: string, ids: string[], depthOf: Record<string, number>): void {
  const seeds = scatterSeedPositions(state, rootId, ids, depthOf);
  ids.forEach((nodeId) => {
    const depth = depthOf[nodeId] ?? 0;
    const radius = scatterRadiusFor(nodeId, depth, ids.length);
    const view = ensureSurfaceNodeView(nodeId);
    const seed = seeds[nodeId];
    if (!view || !seed) return;
    view.x = Math.round(seed.x - radius);
    view.y = Math.round(seed.y);
    scatterVelocities.set(nodeId, { x: 0, y: 0 });
  });
}

function scatterRenderNodeIdFor(state: AppState, nodeId: string, pos: Record<string, NodePosition>): string | null {
  if (pos[nodeId]) {
    return nodeId;
  }
  let current = state.nodes[nodeId]?.parentId ?? null;
  while (current) {
    if (pos[current] && scatterNodeIsCollapsedGroup(state, current)) {
      return current;
    }
    current = state.nodes[current]?.parentId ?? null;
  }
  return null;
}

function scatterDisplayLabel(node: TreeNode): string {
  const label = scatterLabel(node);
  if (scatterNodeIsCollapsedGroup(map!.state, node.id)) {
    return `${label} ×${countHiddenDescendants(node.id)}`;
  }
  return label;
}

function seedMissingScatterPositions(): void {
  if (!map || !currentSurfaceIsScatterMode()) {
    return;
  }
  syncMapModelStateFromRuntime();
  const rootId = currentScopeRootId();
  const { ids, depthOf } = collectScatterNodes(map.state, rootId);
  const seeds = scatterSeedPositions(map.state, rootId, ids, depthOf);
  ids.forEach((nodeId) => {
    const depth = depthOf[nodeId] ?? 0;
    const radius = scatterRadiusFor(nodeId, depth, ids.length);
    const seed = seeds[nodeId];
    const view = ensureSurfaceNodeView(nodeId);
    if (!view || !seed) return;
    if (!Number.isFinite(view.x)) view.x = Math.round(seed.x - radius);
    if (!Number.isFinite(view.y)) view.y = Math.round(seed.y);
  });
}

function scatterCircleGeometry(p: NodePosition): { cx: number; cy: number; r: number } {
  const r = Math.max(SCATTER_MIN_RADIUS, p.w / 2);
  return {
    cx: p.x + r,
    cy: p.y,
    r,
  };
}

function scatterLineEndpoints(
  source: NodePosition,
  target: NodePosition,
): { x1: number; y1: number; x2: number; y2: number; mx: number; my: number } {
  const s = scatterCircleGeometry(source);
  const t = scatterCircleGeometry(target);
  const dx = t.cx - s.cx;
  const dy = t.cy - s.cy;
  const len = Math.max(1, Math.hypot(dx, dy));
  return {
    x1: s.cx + (dx / len) * s.r,
    y1: s.cy + (dy / len) * s.r,
    x2: t.cx - (dx / len) * t.r,
    y2: t.cy - (dy / len) * t.r,
    mx: (s.cx + t.cx) / 2,
    my: (s.cy + t.cy) / 2,
  };
}

function scatterLabel(node: TreeNode): string {
  return (uiLabel(node) || node.id || "").trim();
}

function collectScatterSimulationEdges(state: AppState, ids: string[]): ScatterSimEdge[] {
  const idSet = new Set(ids);
  const pairSeen = new Set<string>();
  const edges: ScatterSimEdge[] = [];
  const renderIdFor = (nodeId: string): string | null => {
    if (idSet.has(nodeId)) return nodeId;
    let current = state.nodes[nodeId]?.parentId ?? null;
    while (current) {
      if (idSet.has(current) && scatterNodeIsCollapsedGroup(state, current)) {
        return current;
      }
      current = state.nodes[current]?.parentId ?? null;
    }
    return null;
  };
  const pushEdge = (sourceId: string, targetId: string, weight: number): void => {
    if (!idSet.has(sourceId) || !idSet.has(targetId) || sourceId === targetId) return;
    const key = `${sourceId}->${targetId}`;
    if (pairSeen.has(key)) return;
    pairSeen.add(key);
    edges.push({ sourceId, targetId, weight });
  };
  ids.forEach((nodeId) => {
    const parentId = state.nodes[nodeId]?.parentId;
    if (parentId) {
      pushEdge(parentId, nodeId, SCATTER_GUIDE_SPRING_WEIGHT);
    }
  });
  Object.values(state.links || {}).forEach((rawLink) => {
    const link = normalizeGraphLink(rawLink);
    const sourceId = renderIdFor(link.sourceNodeId);
    const targetId = renderIdFor(link.targetNodeId);
    if (sourceId && targetId) {
      pushEdge(sourceId, targetId, 1);
    }
  });
  return edges;
}

function runScatterSimulation(iterations: number): boolean {
  if (!map || !currentSurfaceIsScatterMode()) {
    return false;
  }
  syncMapModelStateFromRuntime();
  seedMissingScatterPositions();
  const rootId = currentScopeRootId();
  const { ids, depthOf } = collectScatterNodes(map.state, rootId);
  if (ids.length === 0) {
    return false;
  }
  const surface = currentMapSurface();
  const seeds = scatterSeedPositions(map.state, rootId, ids, depthOf);
  const particles: Record<string, { cx: number; cy: number; r: number; vx: number; vy: number }> = {};
  ids.forEach((nodeId) => {
    const depth = depthOf[nodeId] ?? 0;
    const r = scatterRadiusFor(nodeId, depth, ids.length);
    const view = surface?.nodeViews?.[nodeId];
    const seed = seeds[nodeId] || scatterSeedCenter();
    const x = Number.isFinite(view?.x) ? Number(view!.x) : seed.x - r;
    const y = Number.isFinite(view?.y) ? Number(view!.y) : seed.y;
    const velocity = scatterVelocities.get(nodeId) || { x: 0, y: 0 };
    particles[nodeId] = { cx: x + r, cy: y, r, vx: velocity.x, vy: velocity.y };
  });
  const simEdges = collectScatterSimulationEdges(map.state, ids);
  const center = scatterSeedCenter();
  let changed = false;
  for (let step = 0; step < iterations; step += 1) {
    const forces: Record<string, { x: number; y: number }> = {};
    ids.forEach((nodeId) => {
      forces[nodeId] = { x: 0, y: 0 };
    });

    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const aId = ids[i]!;
        const bId = ids[j]!;
        const a = particles[aId]!;
        const b = particles[bId]!;
        let dx = a.cx - b.cx;
        let dy = a.cy - b.cy;
        let distSq = dx * dx + dy * dy;
        if (distSq < 1) {
          dx = seededJitter(aId, bId);
          dy = seededJitter(bId, aId);
          distSq = dx * dx + dy * dy;
        }
        const dist = Math.sqrt(Math.max(1, distSq));
        const force = scatterRepulsion / Math.max(1600, distSq);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        forces[aId]!.x += fx;
        forces[aId]!.y += fy;
        forces[bId]!.x -= fx;
        forces[bId]!.y -= fy;
      }
    }

    simEdges.forEach((edge) => {
      const a = particles[edge.sourceId];
      const b = particles[edge.targetId];
      if (!a || !b) return;
      const dx = b.cx - a.cx;
      const dy = b.cy - a.cy;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const force = (dist - scatterEdgeLength) * SCATTER_SPRING_K * edge.weight;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      forces[edge.sourceId]!.x += fx;
      forces[edge.sourceId]!.y += fy;
      forces[edge.targetId]!.x -= fx;
      forces[edge.targetId]!.y -= fy;
    });

    ids.forEach((nodeId) => {
      const p = particles[nodeId]!;
      const depth = depthOf[nodeId] ?? 0;
      const centeringStrength = nodeId === rootId ? 0.12 : Math.max(0.012, 0.04 / (depth + 1));
      forces[nodeId]!.x += (center.x - p.cx) * centeringStrength;
      forces[nodeId]!.y += (center.y - p.cy) * centeringStrength;
    });

    ids.forEach((nodeId) => {
      const p = particles[nodeId]!;
      const f = forces[nodeId]!;
      p.vx = (p.vx + (f.x * SCATTER_DT) / SCATTER_MASS) * SCATTER_DAMPING;
      p.vy = (p.vy + (f.y * SCATTER_DT) / SCATTER_MASS) * SCATTER_DAMPING;
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > SCATTER_MAX_V) {
        p.vx = (p.vx / speed) * SCATTER_MAX_V;
        p.vy = (p.vy / speed) * SCATTER_MAX_V;
      }
      const prevCx = p.cx;
      const prevCy = p.cy;
      p.cx = Math.max(80, p.cx + p.vx * SCATTER_DT);
      p.cy = Math.max(80, p.cy + p.vy * SCATTER_DT);
      if (Math.hypot(p.cx - prevCx, p.cy - prevCy) > 0.1) {
        changed = true;
      }
    });
  }

  ids.forEach((nodeId) => {
    const particle = particles[nodeId]!;
    const view = ensureSurfaceNodeView(nodeId);
    if (!view) return;
    view.x = Math.round(particle.cx - particle.r);
    view.y = Math.round(particle.cy);
    scatterVelocities.set(nodeId, { x: particle.vx, y: particle.vy });
  });
  return changed;
}

function seededJitter(a: string, b: string): number {
  let hash = 0;
  const input = `${a}:${b}`;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return ((hash % 200) - 100) / 10 || 1;
}

function runScatterReflow(iterations = 160, opts: { withUndo?: boolean; withTouch?: boolean } = {}): void {
  if (!map || !currentSurfaceIsScatterMode()) {
    return;
  }
  const withUndo = opts.withUndo ?? true;
  const withTouch = opts.withTouch ?? true;
  if (withUndo) {
    pushUndoSnapshot();
  }
  syncMapModelStateFromRuntime();
  const rootId = currentScopeRootId();
  const { ids, depthOf } = collectScatterNodes(map.state, rootId);
  scatterApplyRankFlowSeed(map.state, rootId, ids, depthOf);
  runScatterSimulation(Math.min(iterations, 44));
  if (withTouch) {
    touchDocument();
  } else {
    render();
  }
  setStatus("Scatter rank-flow reflow applied.");
}

function startScatterAnimation(): void {
  if (scatterAnimationFrame !== null || !scatterAnimationEnabled || !currentSurfaceIsScatterMode()) {
    return;
  }
  scatterAnimationFrame = requestAnimationFrame(tickScatterAnimation);
}

function tickScatterAnimation(): void {
  scatterAnimationFrame = null;
  if (!scatterAnimationEnabled || !currentSurfaceIsScatterMode() || !map) {
    return;
  }
  runScatterSimulation(1);
  scheduleRender();
  scatterAnimationFrame = requestAnimationFrame(tickScatterAnimation);
}

function stopScatterAnimation(saveCurrentPositions: boolean): void {
  if (scatterAnimationFrame !== null) {
    cancelAnimationFrame(scatterAnimationFrame);
    scatterAnimationFrame = null;
  }
  if (saveCurrentPositions && map && currentSurfaceIsScatterMode()) {
    map.savedAt = nowIso();
    scheduleAutosave();
    broadcastState();
  }
}

type StructuredSurfaceMode = StructuredLayoutMode;

interface StructuredLayoutConfig {
  mode: StructuredSurfaceMode;
  density: LayoutDensity;
  branchDirection: LayoutBranchDirection;
  columnGap: number;
  siblingGap: number;
  sideGap: number;
  rootMaxWidth: number;
  nodeMaxWidth: number;
  leafMaxWidth: number;
  rootMinWidth: number;
  fontSize: number;
  rootFontSize: number;
}

function structuredSurfaceMode(): StructuredSurfaceMode | null {
  if (
    viewState.surfaceViewMode === "tree"
    || viewState.surfaceViewMode === "mindmap"
    || viewState.surfaceViewMode === "logic-chart"
    || viewState.surfaceViewMode === "timeline"
  ) {
    return viewState.surfaceViewMode;
  }
  return null;
}

function structuredLayoutConfig(
  mode: StructuredSurfaceMode,
  density: LayoutDensity = viewState.surfaceLayoutDensity,
  branchDirection: LayoutBranchDirection = viewState.surfaceBranchDirection,
): StructuredLayoutConfig {
  const compact = density === "compact";
  const spacious = density === "spacious";
  const mapLike = mode === "mindmap";
  return {
    mode,
    density,
    branchDirection,
    columnGap: mapLike ? (compact ? 78 : spacious ? 148 : 112) : compact ? 48 : spacious ? 142 : 86,
    siblingGap: mapLike ? (compact ? 18 : spacious ? 34 : 26) : compact ? 7 : spacious ? 24 : 14,
    sideGap: mapLike ? (compact ? 64 : spacious ? 132 : 92) : compact ? 46 : spacious ? 110 : 72,
    rootMaxWidth: mapLike ? (compact ? 220 : spacious ? 360 : 300) : compact ? 214 : spacious ? 320 : 260,
    nodeMaxWidth: mapLike ? (compact ? 190 : spacious ? 300 : 240) : compact ? 156 : spacious ? 260 : 206,
    leafMaxWidth: mapLike ? (compact ? 210 : spacious ? 320 : 260) : compact ? 194 : spacious ? 320 : 248,
    rootMinWidth: mapLike ? (compact ? 112 : spacious ? 180 : 144) : compact ? 176 : spacious ? 280 : 220,
    fontSize: mapLike ? (compact ? 16 : spacious ? 20 : 18) : compact ? 12 : spacious ? VIEWER_TUNING.typography.nodeFont : 13,
    rootFontSize: mapLike ? (compact ? 18 : spacious ? 24 : 21) : compact ? 13 : spacious ? VIEWER_TUNING.typography.rootFont : 14,
  };
}

function measureLayoutNode(state: AppState, nodeId: string, displayRootId: string, config: StructuredLayoutConfig): LayoutNodeMetric {
  const node = state.nodes[nodeId];
  if (!node) {
    return { w: 120, h: VIEWER_TUNING.layout.leafHeight };
  }
  if (nodeId === displayRootId) {
    if (config.mode === "tree") {
      const rootLabelMeasure = measureNodeLabel(uiLabel(node), VIEWER_TUNING.typography.rootFont);
      return {
        w: Math.max(280, rootLabelMeasure.w + 100),
        h: Math.max(VIEWER_TUNING.layout.rootHeight, rootLabelMeasure.h + 8),
      };
    }
    return measureWrappedNodeLabel(uiLabel(node), config.rootFontSize, config.rootMaxWidth, {
      minWidth: config.rootMinWidth,
      minHeight: config.mode === "mindmap" ? (config.density === "compact" ? 48 : config.density === "spacious" ? 66 : 56) : VIEWER_TUNING.layout.rootHeight,
      padX: config.mode === "mindmap" ? (config.density === "compact" ? 34 : 44) : 34,
      padY: config.mode === "mindmap" ? (config.density === "compact" ? 16 : 22) : 16,
    });
  }
  if (isLatexNode(node)) {
    const m = measureLatex(node.text);
    return { w: m.w, h: m.h };
  }
  if (config.mode === "tree") {
    return measureNodeLabel(uiLabel(node), VIEWER_TUNING.typography.nodeFont);
  }
  const children = visibleChildren(node);
  const maxWidth = children.length === 0 ? config.leafMaxWidth : config.nodeMaxWidth;
  return measureWrappedNodeLabel(uiLabel(node), config.fontSize, maxWidth, {
    minWidth: config.mode === "mindmap" ? (config.density === "compact" ? 72 : 88) : 78,
    minHeight: compactNodeMinHeight(config),
    padX: config.mode === "mindmap" ? (config.density === "compact" ? 28 : 36) : 18,
    padY: config.mode === "mindmap" ? (config.density === "compact" ? 14 : 18) : 7,
  });
}

function compactNodeMinHeight(config: StructuredLayoutConfig): number {
  if (config.mode === "mindmap") {
    if (config.density === "compact") return 42;
    if (config.density === "spacious") return 58;
    return 50;
  }
  return config.density === "compact" ? 22 : VIEWER_TUNING.layout.leafHeight;
}

window.m3eLayout = (
  graph: VisibleLayoutGraph,
  boxSizes: Record<string, LayoutNodeMetric>,
  mode: SurfaceKind,
  options: LayoutOptions = {},
): LayoutResult => layoutPortLayout(graph, boxSizes, mode, options);

function buildLayout(state: AppState): LayoutResult {
  const displayRootId = currentScopeRootId();
  const displayRootNode = state.nodes[displayRootId];
  const mode = surfaceKindForViewMode(viewState.surfaceViewMode);
  const structuredMode = structuredSurfaceMode() || "tree";
  const graphLinks = Object.values(state.links || {}).map((rawLink) => normalizeGraphLink(rawLink));
  const childrenOf = (nodeId: string): string[] => {
    const node = state.nodes[nodeId];
    return node ? visibleChildren(node) : [];
  };
  const visibleNodeIds = new Set<string>();
  const collectVisible = (nodeId: string): void => {
    if (visibleNodeIds.has(nodeId) || !state.nodes[nodeId]) return;
    visibleNodeIds.add(nodeId);
    childrenOf(nodeId).forEach(collectVisible);
  };
  collectVisible(displayRootId);
  const boxSizes: Record<string, LayoutNodeMetric> = {};
  Array.from(visibleNodeIds).forEach((nodeId) => {
    boxSizes[nodeId] = measureLayoutNode(state, nodeId, displayRootId, structuredLayoutConfig(structuredMode));
  });

  const publicOptions: PublicLayoutOptions = {
    direction: viewState.surfaceLayoutDirection,
    depthAlign: viewState.surfaceDepthAlign,
    edge: { route: viewState.surfaceEdgeRoute },
    link: { route: viewState.surfaceLinkRoute },
  };
  const options: LayoutOptions = {
    ...publicOptions,
    displayRootId,
    structuredMode,
    density: viewState.surfaceLayoutDensity,
    branchDirection: viewState.surfaceBranchDirection,
  };

  if (mode === "scatter" && displayRootNode) {
    const surface = currentMapSurface();
    const { ids: descendants, depthOf: scatterDepthOf } = collectScatterNodes(state, displayRootId);
    visibleNodeIds.clear();
    descendants.forEach((nodeId) => visibleNodeIds.add(nodeId));
    descendants.forEach((nodeId) => {
      const depth = scatterDepthOf[nodeId] ?? 0;
      const radius = scatterRadiusFor(nodeId, depth, descendants.length);
      boxSizes[nodeId] = { w: radius * 2, h: radius * 2 };
    });
    options.surfaceNodeViews = surface?.nodeViews || {};
    options.scatterCollapsedGroups = Object.fromEntries(descendants.map((nodeId) => [nodeId, scatterNodeIsCollapsedGroup(state, nodeId)]));
    // Scatter layout reads persisted per-node view coordinates; scatter simulation writes them elsewhere.
    options.scatter = { edgeLength: scatterEdgeLength };
    return layoutPortLayout(
      {
        nodeIds: descendants,
        childrenOf: (nodeId) => {
          const node = state.nodes[nodeId];
          return node && (nodeId === displayRootId || !viewState.collapsedIds.has(nodeId))
            ? (node.children || []).filter((childId) => descendants.includes(childId))
            : [];
        },
        graphLinks,
      },
      boxSizes,
      mode,
      options,
    );
  }

  if (mode === "system" && displayRootNode) {
    const surfaceNodes = visibleChildren(displayRootNode);
    const flowCells: Record<string, { col: number; row: number; isReference: boolean }> = {};
    visibleNodeIds.clear();
    visibleNodeIds.add(displayRootId);
    surfaceNodes.forEach((nodeId) => {
      const node = state.nodes[nodeId];
      if (!node) return;
      visibleNodeIds.add(nodeId);
      const nodeStyles = effectiveNodeStyleAttrs(node);
      const label = diagramLabel(node, nodeStyles);
      const baseMetric = isLatexNode(node)
        ? measureLatex(node.text)
        : measureNodeLabel(label, VIEWER_TUNING.typography.nodeFont);
      const previewLayout = buildFlowPreviewLayout(node);
      boxSizes[nodeId] = previewLayout
        ? {
            w: Math.max(baseMetric.w + 28, previewLayout.totalWidth),
            h: Math.max(VIEWER_TUNING.layout.leafHeight + 18, previewLayout.totalHeight),
          }
        : baseMetric;
      flowCells[nodeId] = { col: flowColOf(node, surfaceNodes.indexOf(nodeId)), row: flowRowOf(node, 0), isReference: isReferenceNode(node) };
    });
    options.flowCells = flowCells;
  }

  return layoutPortLayout(
    {
      nodeIds: Array.from(visibleNodeIds),
      childrenOf,
      graphLinks,
    },
    boxSizes,
    mode,
    options,
  );
}

function updateMapTitle(): void {
  const appTitle = "M3E";
  if (!map) {
    document.title = appTitle;
    return;
  }

  const scopeId = normalizedCurrentScopeId();
  const scopeNode = map.state.nodes[scopeId];
  const scopeLabel = uiLabel(scopeNode).trim();
  document.title = scopeLabel ? `${appTitle} - ${scopeLabel}` : appTitle;
}

let _renderScheduled = false;
function scheduleRender(): void {
  if (_renderScheduled) {
    return;
  }
  _renderScheduled = true;
  requestAnimationFrame(() => {
    _renderScheduled = false;
    render();
  });
}

let _zoomApplyScheduled = false;
function scheduleApplyZoom(): void {
  if (_zoomApplyScheduled) {
    return;
  }
  _zoomApplyScheduled = true;
  requestAnimationFrame(() => {
    _zoomApplyScheduled = false;
    applyZoom();
  });
}

function layoutEdgePath(
  mode: StructuredSurfaceMode,
  parent: NodePosition,
  child: NodePosition,
  route: SurfaceEdgeRoute = viewState.surfaceEdgeRoute,
): { d: string; labelX: number; labelY: number; sourceSide: EdgeAnchorSide; targetSide: EdgeAnchorSide } {
  const { source, target } = mode === "tree"
    ? treeRightEdgeEndsBetween(parent, child)
    : legacyEdgeEndsBetween(parent, child);
  if (route === "straight") {
    return {
      d: `M ${source.x} ${source.y} L ${target.x} ${target.y}`,
      labelX: (source.x + target.x) / 2,
      labelY: (source.y + target.y) / 2 - 8,
      sourceSide: source.side,
      targetSide: target.side,
    };
  }
  if (route === "elbow") {
    const midX = source.x + (target.x - source.x) * 0.5;
    return {
      d: `M ${source.x} ${source.y} H ${midX} V ${target.y} H ${target.x}`,
      labelX: midX,
      labelY: (source.y + target.y) / 2 - 8,
      sourceSide: source.side,
      targetSide: target.side,
    };
  }
  if (mode === "mindmap") {
    const rightward = target.x >= source.x;
    const dir = rightward ? 1 : -1;
    const curve = Math.max(44, Math.abs(target.x - source.x) * 0.45);
    const c1x = source.x + dir * curve;
    const c2x = target.x - dir * curve;
    return {
      d: `M ${source.x} ${source.y} C ${c1x} ${source.y}, ${c2x} ${target.y}, ${target.x} ${target.y}`,
      labelX: (c1x + c2x) / 2,
      labelY: (source.y + target.y) / 2 - 8,
      sourceSide: source.side,
      targetSide: target.side,
    };
  }

  if (mode === "logic-chart") {
    const midX = source.x + (target.x - source.x) * 0.5;
    return {
      d: roundedOrthogonalPath(source.x, source.y, target.x, target.y, { radius: 9, midX }),
      labelX: midX,
      labelY: (source.y + target.y) / 2 - 8,
      sourceSide: source.side,
      targetSide: target.side,
    };
  }

  if (mode === "timeline") {
    const midY = source.y + (target.y - source.y) * 0.52;
    return {
      d: `M ${source.x} ${source.y} V ${midY} H ${target.x} V ${target.y}`,
      labelX: (source.x + target.x) / 2,
      labelY: midY - 8,
      sourceSide: source.side,
      targetSide: target.side,
    };
  }

  const rightward = target.x >= source.x;
  const dir = rightward ? 1 : -1;
  const curve = Math.max(44, Math.abs(target.x - source.x) * 0.45);
  const c1x = source.x + dir * curve;
  const c2x = target.x - dir * curve;
  return {
    d: `M ${source.x} ${source.y} C ${c1x} ${source.y}, ${c2x} ${target.y}, ${target.x} ${target.y}`,
    labelX: (c1x + c2x) / 2,
    labelY: (source.y + target.y) / 2 - 8,
    sourceSide: source.side,
    targetSide: target.side,
  };
}

function graphLinkPathForRoute(
  source: EdgeConnectionPoint,
  target: EdgeConnectionPoint,
  route: SurfaceLinkRoute,
  waveOffset = 0,
): string {
  if (route === "straight") {
    return `M ${source.x} ${source.y} L ${target.x} ${target.y}`;
  }
  if (route === "orthogonal") {
    const midX = source.x + (target.x - source.x) * 0.5;
    return roundedOrthogonalPath(source.x, source.y, target.x, target.y, { radius: 9, midX });
  }
  return graphLinkPathWithPorts(source, target, waveOffset);
}

function graphLinkLabelPointForRoute(
  source: EdgeConnectionPoint,
  target: EdgeConnectionPoint,
  route: SurfaceLinkRoute,
  waveOffset = 0,
): { x: number; y: number } {
  if (route === "straight" || route === "orthogonal") {
    return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
  }
  return graphLinkLabelPointWithPorts(source, target, waveOffset);
}

function render(): void {
  updateModeBadge();
  if (!map) {
    syncThinkingModeUi();
    syncNodeComponentUi();
    updateScopeMeta();
    updateScopeSummary();
    metaEl.textContent = "No data loaded";
    (canvas as Element).innerHTML = "";
    updateMapTitle();
    renderLinearPanel();
    syncLinearPanelPosition();
    return;
  }

  rebuildImportanceVisibility();
  normalizeSelectionState();

  const state = map.state;
  if (!viewState.currentScopeRootId || !state.nodes[viewState.currentScopeRootId]) {
    viewState.currentScopeRootId = state.rootId;
  }
  const layout = buildLayout(state);
  lastLayout = layout;
  visibleOrder = layout.order;
  _linearPanelLayoutDirty = true;
  const displayRootId = currentScopeRootId();
  const displayRootNode = state.nodes[displayRootId];
  const flowSurface = currentSurfaceIsFlowMode();
  const scatterSurface = currentSurfaceIsScatterMode();
  const structuredMode = structuredSurfaceMode() || "tree";
  const rootlessSurface = flowSurface || scatterSurface;
  const scatterNodeRenderable = (nodeId: string): boolean =>
    !scatterSurface || nodeId !== displayRootId;

  const pos = layout.pos;
  let maxX = Math.max(VIEWER_TUNING.layout.minCanvasWidth, layout.totalWidth);
  let maxY = Math.max(
    VIEWER_TUNING.layout.minCanvasHeight,
    layout.totalHeight + VIEWER_TUNING.layout.topPad + VIEWER_TUNING.layout.canvasBottomPad
  );
  let defs = "<defs>";
  let surfaceFrames = "";
  let edges = "";
  let scatterGuides = "";
  let graphLinks = "";
  let overlays = "";
  let annotations = "";
  let nodes = "";

  let topArchCount = 0;
  let bottomArchCount = 0;
  const renderedSurfaceLinks = new Set<string>();
  const renderedPairOffsets = new Map<string, number>();
  const parentChildLinkLabels = new Map<string, string>();
  const parentChildEdgeKey = (parentId: string, childId: string): string => `${parentId}->${childId}`;
  const recordParentChildLinkLabel = (parentId: string, childId: string, label: string): void => {
    const key = parentChildEdgeKey(parentId, childId);
    const existing = parentChildLinkLabels.get(key);
    if (!existing) {
      parentChildLinkLabels.set(key, label);
      return;
    }
    const parts = existing.split(" / ");
    if (!parts.includes(label)) {
      parentChildLinkLabels.set(key, `${existing} / ${label}`);
    }
  };
  Object.values(state.links || {}).forEach((rawLink) => {
    const link = normalizeGraphLink(rawLink);
    const label = (link.label || link.relationType || "").trim();
    if (!label) {
      return;
    }
    const source = state.nodes[link.sourceNodeId];
    const target = state.nodes[link.targetNodeId];
    if (!source || !target || !isParentChildPair(source, target)) {
      return;
    }
    if (target.parentId === source.id) {
      recordParentChildLinkLabel(source.id, target.id, label);
    } else if (source.parentId === target.id) {
      recordParentChildLinkLabel(target.id, source.id, label);
    }
  });
  const PORTAL_BRACKET_ARM = 14;
  // Include every positioned node in avoid set so U-arches clear them even if the
  // scope predicate is stricter than visibility (representatives, siblings etc).
  const linkAvoidBoxes = collectEdgeAvoidBoxes(
    pos,
    () => true,
    flowSurface ? PORTAL_BRACKET_ARM : 0,
  );

  if (scatterSurface) {
    visibleOrder.forEach((nodeId) => {
      const node = state.nodes[nodeId];
      const childPos = pos[nodeId];
      const parentId = node?.parentId ?? null;
      const parentPos = parentId ? pos[parentId] : null;
      if (!node || !childPos || !parentId || !parentPos || !scatterNodeRenderable(nodeId) || !scatterNodeRenderable(parentId)) {
        return;
      }
      const line = scatterLineEndpoints(parentPos, childPos);
      scatterGuides += `<line class="scatter-guide" data-parent-node-id="${parentId}" data-child-node-id="${nodeId}" x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" />`;
    });
  }

  if (structuredMode === "timeline" && displayRootNode) {
    const rootPos = pos[displayRootId];
    const timelineChildren = visibleChildren(displayRootNode).filter((nodeId) => Boolean(pos[nodeId]));
    if (rootPos && timelineChildren.length > 0) {
      const first = pos[timelineChildren[0]!]!;
      const last = pos[timelineChildren[timelineChildren.length - 1]!]!;
      const axisStart = rootPos.x + rootPos.w + 32;
      const axisEnd = last.x + last.w / 2 + 44;
      surfaceFrames += `<line class="timeline-axis" x1="${axisStart}" y1="${rootPos.y}" x2="${axisEnd}" y2="${rootPos.y}" />`;
      timelineChildren.forEach((nodeId) => {
        const child = pos[nodeId]!;
        surfaceFrames += `<circle class="timeline-dot" data-node-id="${nodeId}" cx="${child.x + child.w / 2}" cy="${rootPos.y}" r="5" />`;
        const connector = layoutEdgePath("timeline", { ...rootPos, x: child.x, w: child.w }, child);
        surfaceFrames += `<path class="timeline-stem" data-node-id="${nodeId}" d="${connector.d}" />`;
      });
      maxX = Math.max(maxX, axisEnd + VIEWER_TUNING.layout.canvasRightPad);
    }
  }

  Object.values(state.links || {}).forEach((rawLink) => {
    const link = normalizeGraphLink(rawLink);
    const source = state.nodes[link.sourceNodeId];
    const target = state.nodes[link.targetNodeId];
    let sourceRenderId = link.sourceNodeId;
    let targetRenderId = link.targetNodeId;
    let sourcePos = pos[sourceRenderId];
    let targetPos = pos[targetRenderId];
    if ((!sourcePos || !targetPos) && scatterSurface) {
      sourceRenderId = scatterRenderNodeIdFor(state, link.sourceNodeId, pos) || sourceRenderId;
      targetRenderId = scatterRenderNodeIdFor(state, link.targetNodeId, pos) || targetRenderId;
      sourcePos = pos[sourceRenderId];
      targetPos = pos[targetRenderId];
    }
    if ((!sourcePos || !targetPos) && flowSurface) {
      sourceRenderId = representativeNodeIdInCurrentScope(link.sourceNodeId) || sourceRenderId;
      targetRenderId = representativeNodeIdInCurrentScope(link.targetNodeId) || targetRenderId;
      sourcePos = pos[sourceRenderId];
      targetPos = pos[targetRenderId];
    }
    if (!source || !target || !sourcePos || !targetPos) {
      return;
    }
    if (!scatterNodeRenderable(sourceRenderId) || !scatterNodeRenderable(targetRenderId)) {
      return;
    }
    if (isParentChildPair(source, target)) {
      return;
    }
    if (!isNodeInScope(source.id) || !isNodeInScope(target.id)) {
      return;
    }
    if (!scatterSurface && (!isNodeVisibleByImportance(source.id) || !isNodeVisibleByImportance(target.id))) {
      return;
    }
    if (sourceRenderId === targetRenderId) {
      return;
    }
    const sourceRenderNode = state.nodes[sourceRenderId] || source;
    const targetRenderNode = state.nodes[targetRenderId] || target;
    if (isParentChildPair(sourceRenderNode, targetRenderNode)) {
      return;
    }
    const surfaceKey = flowSurface
      ? `${sourceRenderId}->${targetRenderId}:${link.label || link.relationType || ""}`
      : link.id;
    if (renderedSurfaceLinks.has(surfaceKey)) {
      return;
    }
    renderedSurfaceLinks.add(surfaceKey);
    if (scatterSurface) {
      const line = scatterLineEndpoints(sourcePos, targetPos);
      const stroke = sanitizeColor(link.color) || "#555555";
      const markerEndId = `graph-link-arrow-end-${link.id}`;
      const markerStartId = `graph-link-arrow-start-${link.id}`;
      const markerStart = link.direction === "backward" || link.direction === "both"
        ? ` marker-start="url(#${markerStartId})"`
        : "";
      const markerEnd = link.direction === "forward" || link.direction === "both"
        ? ` marker-end="url(#${markerEndId})"`
        : "";
      const styleClass = `${link.style === "default" ? "" : ` graph-link-${link.style}`}`;
      const label = (link.label || link.relationType || "").trim();
      defs += `
      <marker id="${markerEndId}" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M 0 1 L 10 6 L 0 11 z" fill="${stroke}" />
      </marker>
      <marker id="${markerStartId}" viewBox="0 0 12 12" refX="2" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M 10 1 L 0 6 L 10 11 z" fill="${stroke}" />
      </marker>`;
      graphLinks += `<line class="graph-link scatter-edge${styleClass}" data-link-id="${link.id}" data-edge-id="${link.id}" data-source-node-id="${sourceRenderId}" data-target-node-id="${targetRenderId}" stroke="${stroke}" x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}"${markerStart}${markerEnd} />`;
      graphLinks += `<line class="graph-link-hit" data-link-id="${link.id}" data-edge-id="${link.id}" data-source-node-id="${sourceRenderId}" data-target-node-id="${targetRenderId}" x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" />`;
      if (label) {
        graphLinks += `<text class="graph-link-label" data-link-id="${link.id}" x="${line.mx}" y="${line.my - 10}" text-anchor="middle">${escapeXml(label)}</text>`;
      }
      return;
    }
    const pairKey = [sourceRenderId, targetRenderId].sort().join("<->");
    const pairOffsetIndex = renderedPairOffsets.get(pairKey) ?? 0;
    renderedPairOffsets.set(pairKey, pairOffsetIndex + 1);

    const linkBoundsMode: LinkConnectionBoundsMode = structuredMode === "mindmap" ? "mindmap" : "box";
    const { source: sourceEnd, target: targetEnd } = edgeEndsForGraphLink(sourcePos, targetPos, link, 0, linkBoundsMode);
    // If the rendered node appears as a portal subsystem (`[[...]]`), push the edge end past the bracket glyph.
    const sourceIsPortal = isScopePortalNode(sourceRenderNode);
    const targetIsPortal = isScopePortalNode(targetRenderNode);
    const srcCx = sourcePos.x + sourcePos.w / 2;
    const tgtCx = targetPos.x + targetPos.w / 2;
    const srcCy = sourcePos.y;
    const tgtCy = targetPos.y;
    const facingHorizontal = Math.abs(tgtCx - srcCx) >= Math.abs(tgtCy - srcCy);
    if (facingHorizontal && sourceEnd.side !== "top" && sourceEnd.side !== "bottom" && targetEnd.side !== "top" && targetEnd.side !== "bottom") {
      const rightward = tgtCx >= srcCx;
      if (sourceIsPortal) sourceEnd.x += (rightward ? 1 : -1) * PORTAL_BRACKET_ARM;
      if (targetIsPortal) targetEnd.x += (rightward ? -1 : 1) * PORTAL_BRACKET_ARM;
    }
    const sourceX = sourceEnd.x;
    const sourceY = sourceEnd.y;
    const targetX = targetEnd.x;
    const targetY = targetEnd.y;
    const forward = targetX >= sourceX;
    const depthBack = targetPos.depth < sourcePos.depth
      || (targetPos.depth === sourcePos.depth && targetY < sourceY);
    const isReverseFlow = flowSurface && !forward;
    const needsUArch = flowSurface && (depthBack || isReverseFlow);
    const pairWaveOffset = pairOffsetIndex === 0
      ? 0
      : Math.ceil(pairOffsetIndex / 2) * 26 * (pairOffsetIndex % 2 === 0 ? -1 : 1);

    let controlX: number;
    let controlY: number;
    let graphLinkPathD: string;
    if (needsUArch) {
      // Decide side (TOP / BOTTOM) based on where OTHER boxes sit relative to the edge row.
      // Placing verticals on the clearer side avoids passing through unrelated boxes.
      const edgeMidY = (srcCy + tgtCy) / 2;
      let boxesAbove = 0;
      let boxesBelow = 0;
      for (const b of linkAvoidBoxes) {
        const bMid = (b.top + b.bottom) / 2;
        if (Math.abs(bMid - edgeMidY) < 8) continue; // same row — source/target themselves
        if (bMid < edgeMidY) boxesAbove += 1; else boxesBelow += 1;
      }
      // Prefer the side with fewer obstructions. Tie → TOP (visually cleaner for LR flow).
      const useTop = boxesBelow >= boxesAbove;
      const archIndex = useTop ? topArchCount++ : bottomArchCount++;
      const srcPad = VIEWER_TUNING.layout.edgeStartPad;
      const tgtPad = VIEWER_TUNING.layout.edgeEndPad;
      const archSourcePort = edgePortForSide(positionRect(sourcePos), useTop ? "top" : "bottom", srcPad);
      const archTargetPort = edgePortForSide(positionRect(targetPos), useTop ? "top" : "bottom", tgtPad);
      const sxArch = archSourcePort.x;
      const txArch = archTargetPort.x;
      // Extra lift reserved for scope-frame title band (top-side only).
      const titleReserve = useTop ? 48 : 14;
      // Stagger each back-edge on same side so horizontal segments don't overlap.
      const lift = titleReserve + archIndex * 18;
      const syArch = archSourcePort.y;
      const tyArch = archTargetPort.y;
      let apexY: number;
      if (useTop) {
        apexY = uArchTopApex(linkAvoidBoxes, syArch, tyArch, lift);
      } else {
        apexY = uArchBottomApex(linkAvoidBoxes, syArch, tyArch, lift);
      }
      graphLinkPathD = smoothArchLinkPath(sxArch, syArch, txArch, tyArch, apexY);
      controlX = (sxArch + txArch) / 2;
      controlY = useTop ? apexY - 10 : apexY + 16;
    } else {
      graphLinkPathD = graphLinkPathForRoute(sourceEnd, targetEnd, viewState.surfaceLinkRoute, pairWaveOffset);
      const labelPoint = graphLinkLabelPointForRoute(sourceEnd, targetEnd, viewState.surfaceLinkRoute, pairWaveOffset);
      controlX = labelPoint.x;
      controlY = labelPoint.y - 12 - Math.abs(pairWaveOffset) * 0.35;
    }
    const selectedLinkClass = selectedGraphLinkId === link.id ? " is-selected" : "";
    const styleClass = `${scatterSurface ? " scatter-edge" : ""}${selectedLinkClass}${link.style === "default" ? "" : ` graph-link-${link.style}`}`;
    const colorSeed = Math.round(Math.abs(sourcePos.depth * 31 + targetPos.depth * 17 + sourceY + targetY));
    const stroke = sanitizeColor(link.color) || (scatterSurface ? "#6b8f2a" : VIEWER_TUNING.palette.edgeColors[colorSeed % VIEWER_TUNING.palette.edgeColors.length]!);
    const markerEndId = `graph-link-arrow-end-${link.id}`;
    const markerStartId = `graph-link-arrow-start-${link.id}`;
    const markerStart = link.direction === "backward" || link.direction === "both"
      ? ` marker-start="url(#${markerStartId})"`
      : "";
    const markerEnd = link.direction === "forward" || link.direction === "both"
      ? ` marker-end="url(#${markerEndId})"`
      : "";
    const label = (link.label || link.relationType || "").trim();

    defs += `
      <marker id="${markerEndId}" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M 0 1 L 10 6 L 0 11 z" fill="${stroke}" />
      </marker>
      <marker id="${markerStartId}" viewBox="0 0 12 12" refX="2" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M 10 1 L 0 6 L 10 11 z" fill="${stroke}" />
      </marker>`;

    const selectedClass = viewState.selectedLinkId === link.id || selectedGraphLinkId === link.id ? " selected" : "";
    graphLinks += `<path class="graph-link${styleClass}${selectedClass}" data-link-id="${link.id}" data-edge-id="${link.id}" data-source-node-id="${sourceRenderId}" data-target-node-id="${targetRenderId}" stroke="${stroke}" d="${graphLinkPathD}"${markerStart}${markerEnd} />`;
    graphLinks += `<path class="graph-link-hit" data-link-id="${link.id}" data-edge-id="${link.id}" data-source-node-id="${sourceRenderId}" data-target-node-id="${targetRenderId}" d="${graphLinkPathD}" />`;
    if (label) {
      const labelWidth = Math.max(48, label.length * 7 + 18);
      const labelY = controlY - 10;
      graphLinks += `<rect class="graph-link-label-bg" data-link-id="${link.id}" x="${controlX - labelWidth / 2}" y="${labelY - 14}" width="${labelWidth}" height="19" rx="9.5" />`;
      graphLinks += `<text class="graph-link-label" data-link-id="${link.id}" x="${controlX}" y="${labelY}" text-anchor="middle">${escapeXml(label)}</text>`;
    }
    if (selectedGraphLinkId === link.id) {
      overlays += renderGraphLinkPortControls(link, sourcePos, targetPos, sourceEnd, targetEnd, linkBoundsMode);
    }
  });
  defs += "</defs>";

  function renderNodeComponent(
    component: NodeComponent,
    parentId: string,
    parentPos: { x: number; y: number; w: number; h: number },
  ): string {
    if (component.kind === "tabular") {
      return renderTabularComponent(component, parentId, parentPos);
    }
    return "";
  }

  function renderTabularComponent(
    component: TabularNodeComponent,
    parentId: string,
    parentPos: { x: number; y: number; w: number; h: number },
  ): string {
    const parent = state.nodes[parentId];
    if (!parent) return "";

    const childNodes = parent.children
      .map((cid) => state.nodes[cid])
      .filter((n): n is TreeNode => !!n);

    const colSet = new Set<string>();
    for (const child of childNodes) {
      for (const key of Object.keys(child.attributes || {})) {
        if (!key.startsWith("m3e:")) colSet.add(key);
      }
      if (child.details) colSet.add("_details");
    }
    const columns = Array.from(colSet).sort();

    const esc = (s: string) => escapeXml(s);

    const densityClass = component.props.density === "compact"
      ? "m3e-component--density-compact"
      : "m3e-component--density-regular";
    const maxHeightClass = `m3e-component--max-${component.props.maxHeight}`;

    let html = `<table class="m3e-table-view" data-component-kind="tabular"><thead><tr><th>Name</th>`;
    for (const col of columns) {
      html += `<th>${esc(col === "_details" ? "Details" : col)}</th>`;
    }
    html += `</tr></thead><tbody>`;

    if (childNodes.length === 0) {
      html += `<tr class="m3e-table-empty-row"><td class="m3e-table-empty" colspan="${Math.max(1, columns.length + 1)}">No rows</td></tr>`;
    } else {
      for (const child of childNodes) {
        const status = sanitizeStatus(child.attributes?.["m3e:status"]);
        const statusClass = status ? ` class="status-${status}"` : "";
        const childIdAttr = escapeXmlAttr(child.id);
        html += `<tr data-node-id="${childIdAttr}"${statusClass}>`;
        html += `<td class="m3e-table-name" data-node-id="${childIdAttr}">${esc(child.text || "(empty)")}</td>`;
        for (const col of columns) {
          if (col === "_details") {
            html += `<td data-node-id="${childIdAttr}">${esc(child.details || "")}</td>`;
          } else {
            html += `<td data-node-id="${childIdAttr}">${esc(child.attributes?.[col] || "")}</td>`;
          }
        }
        html += `</tr>`;
      }
    }
    html += `</tbody></table>`;

    const tableW = Math.max(columns.length * 150 + 200, 600);
    const maxHeightPx = component.props.maxHeight === "small" ? 360 : component.props.maxHeight === "large" ? 960 : 720;
    const rowHeight = component.props.density === "compact" ? 28 : 32;
    const tableH = Math.min((Math.max(1, childNodes.length) + 1) * rowHeight + 16, maxHeightPx);
    const foX = parentPos.x - 20;
    const foY = parentPos.y + parentPos.h / 2 + 20;
    maxX = Math.max(maxX, foX + tableW + VIEWER_TUNING.layout.nodeRightPad);
    maxY = Math.max(maxY, foY + tableH + VIEWER_TUNING.layout.nodeBottomPad);

    return `<foreignObject data-node-id="${escapeXmlAttr(parentId)}" data-component-kind="tabular" x="${foX}" y="${foY}" width="${tableW}" height="${tableH}"><div xmlns="http://www.w3.org/1999/xhtml" class="m3e-component m3e-component--tabular ${densityClass} ${maxHeightClass}">${html}</div></foreignObject>`;
  }

  function drawNode(nodeId: string): void {
    const node = state.nodes[nodeId];
    const p = pos[nodeId];
    if (!node || !p || !scatterNodeRenderable(nodeId)) {
      return;
    }

    maxX = Math.max(maxX, p.x + p.w + VIEWER_TUNING.layout.nodeRightPad);
    maxY = Math.max(maxY, p.y + p.h + VIEWER_TUNING.layout.nodeBottomPad);

    const children = scatterSurface ? [] : visibleChildren(node);
    const nodeComponent = scatterSurface ? null : parseNodeComponent(node);
    const nodeStyles = effectiveNodeStyleAttrs(node);
    const previewLayout = buildFlowPreviewLayout(node);
    if (scatterSurface) {
      const { cx, cy, r } = scatterCircleGeometry(p);
      const circleClasses = ["node-hit", "scatter-node-circle"];
      if (nodeId === displayRootId) {
        circleClasses.push("scatter-root");
      }
      if (p.scatterCollapsedGroup) {
        circleClasses.push("scatter-group");
      } else {
        circleClasses.push("scatter-branch");
      }
      const scatterRole = rawAttr(node, "m3e:scatter-role");
      if (scatterRole === "downstream") {
        circleClasses.push("scatter-role-downstream");
      } else if (scatterRole === "sample") {
        circleClasses.push("scatter-role-sample");
      } else if (scatterRole === "upstream") {
        circleClasses.push("scatter-role-upstream");
      }
      if (viewState.selectedNodeIds.has(nodeId)) {
        circleClasses.push("selected");
        circleClasses.push("multi-selected");
      }
      if (nodeId === viewState.selectedNodeId) {
        circleClasses.push("primary-selected");
      }
      if (isAliasNode(node)) {
        circleClasses.push("alias");
        circleClasses.push(isBrokenAlias(node) ? "alias-broken" : (aliasAccess(node) === "write" ? "alias-write" : "alias-read"));
      }
      if (viewState.linkSourceNodeId === nodeId) {
        circleClasses.push("link-source");
      }
      if (viewState.dragState && nodeId === viewState.dragState.sourceNodeId) {
        circleClasses.push("drag-source");
      }
      const circleStyle: string[] = [];
      if (nodeStyles.bg) circleStyle.push(`fill:${nodeStyles.bg}`);
      if (nodeStyles.border) circleStyle.push(`stroke:${nodeStyles.border}`);
      if (nodeStyles.borderWidth != null) circleStyle.push(`stroke-width:${nodeStyles.borderWidth}px`);
      if (nodeStyles.borderStyle === "dashed") circleStyle.push("stroke-dasharray:8 5");
      if (nodeStyles.borderStyle === "dotted") circleStyle.push("stroke-dasharray:3 3");
      if (nodeStyles.borderStyle === "none") circleStyle.push("stroke:none");
      const inline = circleStyle.length ? ` style="${circleStyle.join(";")}"` : "";
      nodes += `<circle class="${circleClasses.join(" ")}" data-node-id="${nodeId}" cx="${cx}" cy="${cy}" r="${r}"${inline} />`;
      const labelClass = nodeId === displayRootId ? "label-root scatter-label" : "label-node scatter-label";
      const labelStyles = [`font-size:${p.fontSize ?? scatterFontSizeFor(r)}px`];
      const labelInline = buildLabelStyle(nodeStyles);
      if (labelInline) labelStyles.push(labelInline);
      const label = scatterDisplayLabel(node);
      const fontSize = p.fontSize ?? scatterFontSizeFor(r);
      const labelMeasure = measureNodeLabel(label || node.id, fontSize);
      const labelX = cx + r + 7;
      const labelY = cy;
      maxX = Math.max(maxX, labelX + labelMeasure.w + VIEWER_TUNING.layout.nodeRightPad);
      maxY = Math.max(maxY, labelY + Math.max(r, labelMeasure.h / 2) + VIEWER_TUNING.layout.nodeBottomPad);
      nodes += `<text class="${labelClass}" data-node-id="${nodeId}" x="${labelX}" y="${labelY}" text-anchor="start" dominant-baseline="middle" style="${labelStyles.join(";")}">${escapeXml(label)}</text>`;
      return;
    }
    if (!nodeComponent) children.forEach((childId, i) => {
      const child = pos[childId];
      if (!child) {
        return;
      }

      const defaultStroke =
        VIEWER_TUNING.palette.edgeColors[(p.depth + i) % VIEWER_TUNING.palette.edgeColors.length];
      const stroke = nodeStyles.edgeColor || defaultStroke;
      const edgeInline = buildEdgeStyle(nodeStyles);
      const edgePath = layoutEdgePath(structuredMode, p, child);
      edges += `<path class="edge edge-${structuredMode}" data-source-node-id="${nodeId}" data-target-node-id="${childId}" data-source-port-side="${edgePath.sourceSide}" data-target-port-side="${edgePath.targetSide}" stroke="${stroke}" d="${edgePath.d}"${edgeInline ? ` style="${edgeInline}"` : ""} />`;

      // Edge label — stored on the child node (parent is unique per child)
      const childNode = state.nodes[childId];
      const childStyles = readNodeStyleAttrs(childNode?.attributes || {});
      const edgeLabel = childStyles.edgeLabel || parentChildLinkLabels.get(parentChildEdgeKey(nodeId, childId));
      if (edgeLabel) {
        edges += `<text class="edge-label" data-node-id="${childId}" x="${edgePath.labelX}" y="${edgePath.labelY}" text-anchor="middle">${escapeXml(edgeLabel)}</text>`;
      }
    });

    const classNames = ["node-hit"];
    if (scatterSurface) {
      classNames.push("scatter-node");
    }
    if (viewState.selectedNodeIds.has(nodeId)) {
      classNames.push("selected");
      classNames.push("multi-selected");
    }
    if (nodeId === viewState.selectedNodeId) {
      classNames.push("primary-selected");
    }
    if (isAliasNode(node)) {
      classNames.push("alias");
      classNames.push(isBrokenAlias(node) ? "alias-broken" : (aliasAccess(node) === "write" ? "alias-write" : "alias-read"));
    }
    if (nodeStyles.status) {
      classNames.push(`status-${nodeStyles.status}`);
    }
    if (viewState.reparentSourceIds.has(nodeId)) {
      classNames.push("reparent-source");
    }
    if (viewState.linkSourceNodeId === nodeId) {
      classNames.push("link-source");
    }
    if (viewState.clipboardState?.type === "cut" && viewState.clipboardState.sourceIds.has(nodeId)) {
      classNames.push("cut-pending");
    }
    if (viewState.dragState?.proposal?.kind === "reparent" && nodeId === viewState.dragState.proposal.parentId) {
      classNames.push("drop-target");
    }
    if (viewState.dragState && nodeId === viewState.dragState.sourceNodeId) {
      classNames.push("drag-source");
    }
    // Scope lock visual indicator
    const nodeLock = scopeLockMap.get(nodeId);
    if (nodeLock) {
      classNames.push("scope-locked");
      if (nodeLock.entityId !== collabEntityId) {
        classNames.push("scope-locked-by-other");
      }
    }
    const treatAsRoot = nodeId === displayRootId && !rootlessSurface;
    const hitX = treatAsRoot ? p.x : p.x - 8;
    const hitH = Math.max(VIEWER_TUNING.layout.nodeHitHeight, p.h);
    const hitY = p.y - hitH / 2;
    const hitW = treatAsRoot ? p.w : p.w + 36;
    const hitRx = shapeRx(nodeStyles.shape, treatAsRoot);
    nodes += `<rect class="${classNames.join(" ")}" data-node-id="${nodeId}" x="${hitX}" y="${hitY}" width="${hitW}" height="${hitH}" rx="${hitRx}" />`;
    const visualClasses = ["node-visual-box"];
    if (structuredMode === "mindmap") {
      visualClasses.push("mindmap-box");
    }
    if (viewState.selectedNodeIds.has(nodeId)) {
      visualClasses.push("selected");
      visualClasses.push("multi-selected");
    }
    if (nodeId === viewState.selectedNodeId) {
      visualClasses.push("primary-selected");
    }
    if (isAliasNode(node)) {
      visualClasses.push("alias");
      visualClasses.push(isBrokenAlias(node) ? "alias-broken" : (aliasAccess(node) === "write" ? "alias-write" : "alias-read"));
    }
    if (nodeStyles.status) {
      visualClasses.push(`status-${nodeStyles.status}`);
    }
    if (viewState.reparentSourceIds.has(nodeId)) {
      visualClasses.push("reparent-source");
    }
    if (viewState.linkSourceNodeId === nodeId) {
      visualClasses.push("link-source");
    }
    if (viewState.dragState?.proposal?.kind === "reparent" && nodeId === viewState.dragState.proposal.parentId) {
      visualClasses.push("drop-target");
    }
    if (viewState.dragState && nodeId === viewState.dragState.sourceNodeId) {
      visualClasses.push("drag-source");
    }
    if (viewState.clipboardState?.type === "cut" && viewState.clipboardState.sourceIds.has(nodeId)) {
      visualClasses.push("cut-pending");
    }
    if (nodeLock) {
      visualClasses.push("scope-locked");
      if (nodeLock.entityId !== collabEntityId) {
        visualClasses.push("scope-locked-by-other");
      }
    }

    if (treatAsRoot) {
      const rootLabelLines = p.labelLines || splitLabelLines(uiLabel(node) || "(empty)");
      const rootFont = p.fontSize ?? VIEWER_TUNING.typography.rootFont;
      const rootLineHeight = lineHeightForFont(rootFont);
      const rootStartY = multilineTextStartY(p.y, rootLabelLines.length, rootFont, rootLineHeight);
      const rootTspans = multilineTspans(rootLabelLines, p.x + p.w / 2, rootLineHeight);
      const w = p.w;
      const h = p.h;
      const rx = structuredMode === "mindmap" ? Math.min(28, h / 2) : shapeRx(nodeStyles.shape, true);
      const x = p.x;
      const y = p.y - h / 2;
      const rootBoxStyle = buildNodeVisualStyle(nodeStyles);
      const rootBoxInline = rootBoxStyle ? ` style="${rootBoxStyle}"` : "";
      nodes += `<rect class="root-box ${visualClasses.join(" ")}" data-node-id="${nodeId}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"${rootBoxInline} />`;
      const rootLabelInline = buildLabelStyle(nodeStyles);
      const rootLabelStyle = [`font-size:${rootFont}px`];
      if (rootLabelInline) rootLabelStyle.push(rootLabelInline);
      nodes += `<text class="label-root" data-node-id="${nodeId}" x="${x + w / 2}" y="${rootStartY}" text-anchor="middle" style="${rootLabelStyle.join(";")}">${rootTspans}</text>`;
    } else {
      const rawLabel = diagramLabel(node, nodeStyles);
      const labelLines = p.labelLines || splitLabelLines(rawLabel);
      const labelClasses = ["label-node"];
      if (viewState.selectedNodeIds.has(nodeId)) {
        labelClasses.push("selected");
      }
      if (nodeId === viewState.selectedNodeId) {
        labelClasses.push("primary-selected");
      }
      if (isAliasNode(node)) {
        labelClasses.push("alias-label");
        labelClasses.push(isBrokenAlias(node) ? "alias-broken-label" : (aliasAccess(node) === "write" ? "alias-write-label" : "alias-read-label"));
      }
      if (nodeStyles.status) {
        labelClasses.push(`status-${nodeStyles.status}`);
      }
      const hasExplicitNodeBox = nodeStyles.shape === "diamond"
        || nodeStyles.bg
        || nodeStyles.border
        || nodeStyles.borderWidth != null;
      const needsStateVisualBox = structuredMode === "mindmap" || visualClasses.length > 1;
      if (!isFolderNode(node) && (hasExplicitNodeBox || needsStateVisualBox)) {
        const shapePadX = structuredMode === "mindmap" ? 0 : 14;
        const shapePadY = structuredMode === "mindmap" ? 0 : 6;
        const shapeX = p.x - shapePadX;
        const shapeY = p.y - Math.max(VIEWER_TUNING.layout.nodeHitHeight, p.h) / 2 + shapePadY;
        const shapeW = p.w + shapePadX * 2;
        const shapeH = Math.max(VIEWER_TUNING.layout.nodeHitHeight, p.h) - shapePadY * 2;
        const shapeInline = buildNodeVisualStyle(nodeStyles);
        if (nodeStyles.shape === "diamond") {
          nodes += `<path class="node-shape ${visualClasses.join(" ")}" data-node-id="${nodeId}" d="${diamondPath(p.x + p.w / 2, p.y, shapeW, shapeH)}"${shapeInline ? ` style="${shapeInline}"` : ""} />`;
        } else {
          const rx = structuredMode === "mindmap" ? 4 : shapeRx(nodeStyles.shape, false);
          nodes += `<path class="node-shape ${visualClasses.join(" ")}" data-node-id="${nodeId}" d="${rectPath(shapeX, shapeY, shapeW, shapeH, rx)}"${shapeInline ? ` style="${shapeInline}"` : ""} />`;
        }
      }
      if (isFolderNode(node)) {
        const frameInsetY = structuredMode === "mindmap" ? 0 : 12;
        const framePadX = structuredMode === "mindmap" ? 0 : 14;
        const frameH = Math.max(VIEWER_TUNING.layout.nodeHitHeight, p.h) - frameInsetY;
        const folderFrameX = p.x - framePadX;
        const folderFrameY = p.y - frameH / 2;
        const folderFrameW = p.w + framePadX * 2;
        const folderFrameH = frameH;
        const folderBoxStyle = buildNodeVisualStyle(nodeStyles);
        const folderBoxInline = folderBoxStyle ? ` style="${folderBoxStyle}"` : "";
        if (isScopePortalNode(node)) {
          const leftX = folderFrameX + 2;
          const rightX = folderFrameX + folderFrameW - 2;
          const topY = folderFrameY;
          const bottomY = folderFrameY + folderFrameH;
          const arm = 12;
          nodes += `<path class="portal-bracket ${visualClasses.join(" ")}" data-node-id="${nodeId}" d="M ${leftX + arm} ${topY} H ${leftX} V ${bottomY} H ${leftX + arm}"${folderBoxInline} />`;
          nodes += `<path class="portal-bracket ${visualClasses.join(" ")}" data-node-id="${nodeId}" d="M ${rightX - arm} ${topY} H ${rightX} V ${bottomY} H ${rightX - arm}"${folderBoxInline} />`;
        } else if (nodeStyles.shape === "diamond") {
          nodes += `<path class="folder-box ${visualClasses.join(" ")}" data-node-id="${nodeId}" d="${diamondPath(p.x + p.w / 2, p.y, folderFrameW, folderFrameH)}"${folderBoxInline} />`;
        } else {
          nodes += `<rect class="folder-box ${visualClasses.join(" ")}" data-node-id="${nodeId}" x="${folderFrameX}" y="${folderFrameY}" width="${folderFrameW}" height="${folderFrameH}" rx="${structuredMode === "mindmap" ? 4 : 8}"${folderBoxInline} />`;
        }
        if (previewLayout) {
          const previewIds = new Set(previewLayout.childIds);
          Object.values(state.links || {}).forEach((rawLink) => {
            const link = normalizeGraphLink(rawLink);
            const sourceNode = state.nodes[link.sourceNodeId];
            const targetNode = state.nodes[link.targetNodeId];
            if (!sourceNode || !targetNode || isParentChildPair(sourceNode, targetNode)) {
              return;
            }
            if (!previewIds.has(link.sourceNodeId) || !previewIds.has(link.targetNodeId)) {
              return;
            }
            const sourcePreview = previewLayout.positions[link.sourceNodeId];
            const targetPreview = previewLayout.positions[link.targetNodeId];
            if (!sourcePreview || !targetPreview) {
              return;
            }
            const sourceRect = {
              x: folderFrameX + sourcePreview.x,
              y: folderFrameY + sourcePreview.y,
              w: sourcePreview.w,
              h: sourcePreview.h,
            };
            const targetRect = {
              x: folderFrameX + targetPreview.x,
              y: folderFrameY + targetPreview.y,
              w: targetPreview.w,
              h: targetPreview.h,
            };
            const { source: sourceEnd, target: targetEnd } = edgePortPairBetweenRects(sourceRect, targetRect);
            const sx = sourceEnd.x;
            const sy = sourceEnd.y;
            const tx = targetEnd.x;
            const ty = targetEnd.y;
            const previewEdgePath = smoothGraphLinkPath(sx, sy, tx, ty);
            nodes += `<path class="flow-preview-edge" d="${previewEdgePath}" />`;
            const edgeLabel = (link.label || link.relationType || "").trim();
            if (edgeLabel) {
              nodes += `<text class="flow-preview-edge-label" x="${(sx + tx) / 2}" y="${(sy + ty) / 2 - 6}" text-anchor="middle">${escapeXml(edgeLabel)}</text>`;
            }
          });

          previewLayout.childIds.forEach((previewChildId) => {
            const previewChild = state.nodes[previewChildId];
            const previewPos = previewLayout.positions[previewChildId];
            if (!previewChild || !previewPos) {
              return;
            }
            const previewStyles = readNodeStyleAttrs(previewChild.attributes || {});
            const previewLabel = escapeXml(diagramLabel(previewChild, previewStyles));
            const previewX = folderFrameX + previewPos.x;
            const previewY = folderFrameY + previewPos.y;
            const previewClass = isFolderNode(previewChild) ? "flow-preview-node flow-preview-node-scope" : "flow-preview-node";
            nodes += `<rect class="${previewClass}" x="${previewX}" y="${previewY}" width="${previewPos.w}" height="${previewPos.h}" rx="8" />`;
            nodes += `<text class="flow-preview-node-label" x="${previewX + 10}" y="${previewY + previewPos.h / 2}" dominant-baseline="middle" text-anchor="start">${previewLabel}</text>`;
          });
        }
        // Lock icon on locked folder nodes
        if (nodeLock) {
          const lockIconX = folderFrameX + folderFrameW - 14;
          const lockIconY = folderFrameY + 14;
          const lockClass = nodeLock.entityId === collabEntityId ? "lock-icon" : "lock-icon lock-icon-other";
          nodes += `<text class="${lockClass}" x="${lockIconX}" y="${lockIconY}" text-anchor="middle" dominant-baseline="middle">\uD83D\uDD12</text>`;
        }
      }
      if (isLatexNode(node)) {
        let htmlStr = latexHtmlCache.get(node.text);
        if (!htmlStr) {
          const { latex, displayMode } = latexSource(node.text);
          htmlStr = katex.renderToString(latex, { displayMode, throwOnError: false });
          latexHtmlCache.set(node.text, htmlStr);
        }
        const foH = p.h;
        const foY = p.y - foH / 2;
        nodes += `<foreignObject data-node-id="${nodeId}" x="${p.x}" y="${foY}" width="${p.w}" height="${foH}"><div xmlns="http://www.w3.org/1999/xhtml" class="latex-node-content">${htmlStr}</div></foreignObject>`;
      } else {
        const nodeFont = p.fontSize ?? VIEWER_TUNING.typography.nodeFont;
        const lineHeight = lineHeightForFont(nodeFont);
        const startY = previewLayout
          ? p.y - Math.max(VIEWER_TUNING.layout.nodeHitHeight, p.h) / 2 + 36
          : multilineTextStartY(p.y, labelLines.length, nodeFont, lineHeight);
        const labelX = structuredMode === "mindmap"
          ? p.x + p.w / 2
          : isScopePortalNode(node)
          ? p.x + 12
          : p.x;
        const tspans = multilineTspans(labelLines, labelX, lineHeight);
        const labelInline = buildLabelStyle(nodeStyles);
        const labelStyle = [`font-size:${nodeFont}px`];
        if (labelInline) labelStyle.push(labelInline);
        nodes += `<text class="${labelClasses.join(" ")}" data-node-id="${nodeId}" x="${labelX}" y="${startY}" text-anchor="${structuredMode === "mindmap" ? "middle" : "start"}" style="${labelStyle.join(";")}">${tspans}</text>`;
      }
      const badge = nodeBadge(node);
      if (badge) {
        nodes += `<text class="alias-badge alias-badge-${badge}" x="${p.x + p.w + 18}" y="${p.y}" dominant-baseline="middle">${escapeXml(badge)}</text>`;
      }
      // Band confidence badge (deep band or explicit confidence)
      if (nodeStyles.confidence != null) {
        const cColor = confidenceColor(nodeStyles.confidence);
        const cLabel = (nodeStyles.confidence * 100).toFixed(0) + "%";
        const cX = p.x + p.w + (badge ? 60 : 18);
        nodes += `<rect class="confidence-badge" x="${cX}" y="${p.y - 12}" width="42" height="22" rx="11" style="fill:${cColor}" />`;
        nodes += `<text class="confidence-badge-text" x="${cX + 21}" y="${p.y + 1}" text-anchor="middle" dominant-baseline="middle">${escapeXml(cLabel)}</text>`;
      }
      // Status badge
      if (nodeStyles.status) {
        const statusColors: Record<string, string> = {
          placeholder: "#999", confirmed: "#2d8c4e", contested: "#d94040",
          frozen: "#4a7fb5", active: "#e89b1a", review: "#9b59b6",
        };
        const sColor = statusColors[nodeStyles.status] || "#666";
        const sX = p.x + p.w + (badge ? 60 : 18) + (nodeStyles.confidence != null ? 56 : 0);
        nodes += `<rect class="status-badge" x="${sX}" y="${p.y - 12}" width="${nodeStyles.status.length * 8 + 12}" height="22" rx="11" style="fill:${sColor}" />`;
        nodes += `<text class="status-badge-text" x="${sX + nodeStyles.status.length * 4 + 6}" y="${p.y + 1}" text-anchor="middle" dominant-baseline="middle">${escapeXml(nodeStyles.status)}</text>`;
      }
    }

    if (viewState.collapsedIds.has(nodeId) && (node.children || []).length > 0) {
      const indicatorX =
        treatAsRoot
          ? p.x + p.w + VIEWER_TUNING.layout.rootIndicatorPad
          : p.x + p.w + VIEWER_TUNING.layout.nodeIndicatorPad;
      const hiddenCount = countHiddenDescendants(nodeId);
      const badgeLabel = String(Math.max(1, hiddenCount));
      const badgeWidth = Math.max(26, badgeLabel.length * 14 + 14);
      const badgeHeight = 24;
      const badgeX = indicatorX - badgeWidth / 2;
      const badgeY = p.y - badgeHeight / 2;
      nodes += `<rect class="collapsed-badge" data-collapse-node-id="${nodeId}" x="${badgeX}" y="${badgeY}" width="${badgeWidth}" height="${badgeHeight}" rx="12" />`;
      nodes += `<circle class="collapsed-badge-node" data-collapse-node-id="${nodeId}" cx="${badgeX - 8}" cy="${p.y}" r="8" />`;
      nodes += `<text class="collapsed-badge-count" data-collapse-node-id="${nodeId}" x="${indicatorX}" y="${p.y}" text-anchor="middle" dominant-baseline="middle">${escapeXml(badgeLabel)}</text>`;
    }

    if (nodeComponent) {
      nodes += renderNodeComponent(nodeComponent, nodeId, p);
    } else {
      children.forEach((cid) => drawNode(cid));
    }
  }

  if (scatterSurface) {
    visibleOrder.filter(scatterNodeRenderable).forEach((nodeId) => drawNode(nodeId));
  } else if (rootlessSurface && displayRootNode) {
    const surfaceNodeIds = visibleChildren(displayRootNode).filter((nodeId) => Boolean(pos[nodeId]));
    if (surfaceNodeIds.length > 0) {
      let left = Number.POSITIVE_INFINITY;
      let right = Number.NEGATIVE_INFINITY;
      let top = Number.POSITIVE_INFINITY;
      let bottom = Number.NEGATIVE_INFINITY;
      surfaceNodeIds.forEach((nodeId) => {
        const p = pos[nodeId]!;
        const boxHeight = Math.max(VIEWER_TUNING.layout.nodeHitHeight, p.h);
        left = Math.min(left, p.x - 42);
        right = Math.max(right, p.x + p.w + 42);
        top = Math.min(top, p.y - boxHeight / 2 - 46);
        bottom = Math.max(bottom, p.y + boxHeight / 2 + 38);
      });
      const frameX = Math.max(24, left);
      const frameY = Math.max(24, top);
      const frameW = Math.max(320, right - frameX);
      const frameH = Math.max(180, bottom - frameY);
      const frameLabel = escapeXml(diagramLabel(displayRootNode, readNodeStyleAttrs(displayRootNode.attributes || {})));
      surfaceFrames += `<rect class="surface-scope-box" x="${frameX}" y="${frameY}" width="${frameW}" height="${frameH}" rx="20" />`;
      surfaceFrames += `<text class="surface-scope-title" x="${frameX + 22}" y="${frameY + 30}" text-anchor="start">${frameLabel}</text>`;
      maxX = Math.max(maxX, frameX + frameW + 28);
      maxY = Math.max(maxY, frameY + frameH + 28);
    }
    visibleChildren(displayRootNode).forEach((cid) => drawNode(cid));
  } else {
    drawNode(displayRootId);
  }

  if (viewState.surfaceViewMode === "tree" && refreshLinearPanelCanvasLayout()) {
    const panelRightPad = 640;
    const panelBottomPad = 80;
    maxX = Math.max(maxX, _linearPanelAnchorCanvasX + linearPanelCanvasWidth + panelRightPad);
    maxY = Math.max(maxY, _linearPanelAnchorCanvasY + _linearPanelCanvasHeight + panelBottomPad);
  }

  if (viewState.dragState?.proposal?.kind === "reorder") {
    const proposal = viewState.dragState.proposal;
    const bounds = getReorderLineBounds(proposal.parentId, proposal.index, viewState.dragState.sourceNodeId);
    if (bounds) {
      overlays += `<line class="reorder-line" x1="${bounds.x1}" y1="${proposal.lineY}" x2="${bounds.x2}" y2="${proposal.lineY}" />`;
    }
  }

  const annotationRender = renderAnnotationsForCurrentScope(state);
  annotations = annotationRender.svg;
  maxX = Math.max(maxX, annotationRender.maxX);
  maxY = Math.max(maxY, annotationRender.maxY);

  contentWidth = maxX;
  contentHeight = maxY;
  canvas.setAttribute("width", String(maxX));
  canvas.setAttribute("height", String(maxY));
  canvas.setAttribute("viewBox", `0 0 ${maxX} ${maxY}`);
  (canvas as Element).innerHTML = `${defs}${surfaceFrames}${edges}${scatterGuides}${graphLinks}${overlays}${nodes}${annotations}`;
  applyZoom();

  const version = map.version ?? "n/a";
  const savedAt = map.savedAt ?? "n/a";
  const nodeCount = Object.keys(state.nodes).length;
  const linkCount = Object.values(state.links || {}).filter((rawLink) => {
    const link = normalizeGraphLink(rawLink);
    const source = state.nodes[link.sourceNodeId];
    const target = state.nodes[link.targetNodeId];
    return !!source && !!target && !isParentChildPair(source, target) && !!pos[link.sourceNodeId] && !!pos[link.targetNodeId];
  }).length;
  const annotationCount = Object.keys(state.annotations || {}).length;
  const selected = state.nodes[viewState.selectedNodeId];
  const linkSourceLabel = viewState.linkSourceNodeId && state.nodes[viewState.linkSourceNodeId]
    ? uiLabel(state.nodes[viewState.linkSourceNodeId]!)
    : "none";
  const moveNodes = Array.from(viewState.reparentSourceIds)
    .map((nodeId) => state.nodes[nodeId])
    .filter((node): node is TreeNode => Boolean(node));
  const dragProposal = viewState.dragState?.proposal;
  let dropLabel = "none";
  if (dragProposal?.kind === "reparent") {
    dropLabel = `child of ${state.nodes[dragProposal.parentId]?.text ?? dragProposal.parentId}`;
  } else if (dragProposal?.kind === "reorder") {
    const parentText = state.nodes[dragProposal.parentId]?.text ?? dragProposal.parentId;
    dropLabel = `reorder in ${parentText} @ ${dragProposal.index}`;
  }
  syncThinkingModeUi();
  syncNodeComponentUi();
  metaEl.dataset.selectedNodeId = selected?.id || "";
  metaEl.dataset.selectedNodeLabel = selected ? uiLabel(selected) : "";
  metaEl.dataset.scopeId = normalizedCurrentScopeId();
  metaEl.dataset.mapId = LOCAL_MAP_ID;
  metaEl.textContent = `workspace: ${WORKSPACE_LABEL} (${WORKSPACE_ID}) | map: ${MAP_LABEL} (${LOCAL_MAP_ID}) | slug: ${MAP_SLUG} | cloud: ${CLOUD_MAP_ID} | version: ${version} | savedAt: ${savedAt} | nodes: ${nodeCount} | links: ${linkCount} | annotations: ${annotationCount} | scope: ${normalizedCurrentScopeId()} | importance: ${importanceViewMode} | selected: ${selected ? uiLabel(selected) : "n/a"} (${viewState.selectedNodeIds.size}) | link-source: ${linkSourceLabel} | move-node: ${moveNodes.length > 0 ? `${moveNodes.length} selected` : "none"} | drop-target: ${dropLabel}`;
  updateScopeMeta();
  updateScopeSummary();
  updateMapTitle();
  syncInlineEditorPosition();
  renderLinearPanel();
}

interface LayoutDiagnosticBox {
  nodeId: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LayoutDiagnosticIssue {
  kind:
    | "label-overlap"
    | "hit-overlap"
    | "direction-violation"
    | "edge-endpoint-inside"
    | "edge-dangling-endpoint"
    | "edge-continuity"
    | "edge-node-penetration";
  nodeId?: string;
  otherNodeId?: string;
  edgeId?: string;
  area?: number;
  message: string;
}

interface LayoutDiagnosticResult {
  ok: boolean;
  mode: SurfaceViewMode;
  density: SurfaceLayoutDensity;
  direction: SurfaceBranchDirection;
  labelCount: number;
  hitCount: number;
  issues: LayoutDiagnosticIssue[];
}

function svgBoxFor(el: SVGGraphicsElement): LayoutDiagnosticBox | null {
  const nodeId = el.getAttribute("data-node-id");
  if (!nodeId) return null;
  try {
    const box = el.getBBox();
    return {
      nodeId,
      text: (el.textContent || "").trim(),
      x: box.x,
      y: box.y,
      w: box.width,
      h: box.height,
    };
  } catch {
    return null;
  }
}

function overlapArea(a: LayoutDiagnosticBox, b: LayoutDiagnosticBox, pad = 1): number {
  const left = Math.max(a.x - pad, b.x - pad);
  const right = Math.min(a.x + a.w + pad, b.x + b.w + pad);
  const top = Math.max(a.y - pad, b.y - pad);
  const bottom = Math.min(a.y + a.h + pad, b.y + b.h + pad);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function pointInsideBox(point: { x: number; y: number }, box: LayoutDiagnosticBox, epsilon = 1.5): boolean {
  return point.x > box.x + epsilon
    && point.x < box.x + box.w - epsilon
    && point.y > box.y + epsilon
    && point.y < box.y + box.h - epsilon;
}

function endpointDistanceToBox(point: { x: number; y: number }, box: LayoutDiagnosticBox): number {
  const dx = point.x < box.x ? box.x - point.x : point.x > box.x + box.w ? point.x - (box.x + box.w) : 0;
  const dy = point.y < box.y ? box.y - point.y : point.y > box.y + box.h ? point.y - (box.y + box.h) : 0;
  return Math.hypot(dx, dy);
}

function svgEdgeEndpoints(el: SVGGeometryElement): { start: DOMPoint; end: DOMPoint; length: number } | null {
  try {
    const length = el.getTotalLength();
    if (!Number.isFinite(length) || length < 2) {
      return null;
    }
    return {
      start: el.getPointAtLength(0),
      end: el.getPointAtLength(length),
      length,
    };
  } catch {
    return null;
  }
}

function collectLayoutDiagnostics(): LayoutDiagnosticResult {
  const issues: LayoutDiagnosticIssue[] = [];
  const labels = Array.from(canvas.querySelectorAll<SVGGraphicsElement>("text.label-root[data-node-id], text.label-node[data-node-id]"))
    .map(svgBoxFor)
    .filter((box): box is LayoutDiagnosticBox => Boolean(box));
  const hits = Array.from(canvas.querySelectorAll<SVGGraphicsElement>("rect.node-hit[data-node-id], circle.scatter-node-circle[data-node-id]"))
    .map(svgBoxFor)
    .filter((box): box is LayoutDiagnosticBox => Boolean(box));
  const edgeAnchorBoxes = Array.from(canvas.querySelectorAll<SVGGraphicsElement>(
    [
      "rect.root-box[data-node-id]",
      "rect.folder-box[data-node-id]",
      "path.folder-box[data-node-id]",
      "path.node-shape[data-node-id]",
      "text.label-root[data-node-id]",
      "text.label-node[data-node-id]",
      "rect.node-hit[data-node-id]",
      "circle.scatter-node-circle[data-node-id]",
    ].join(", "),
  ))
    .map(svgBoxFor)
    .filter((box): box is LayoutDiagnosticBox => Boolean(box));

  function collectOverlapIssues(kind: "label-overlap" | "hit-overlap", boxes: LayoutDiagnosticBox[], threshold: number): void {
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        if (a.nodeId === b.nodeId) continue;
        const area = overlapArea(a, b);
        if (area > threshold) {
          issues.push({
            kind,
            nodeId: a.nodeId,
            otherNodeId: b.nodeId,
            area,
            message: `${kind}: ${a.nodeId} intersects ${b.nodeId} (${area.toFixed(1)}px^2)`,
          });
        }
      }
    }
  }

  collectOverlapIssues("label-overlap", labels, 6);
  collectOverlapIssues("hit-overlap", hits, 18);
  const hitByNodeId = new Map(hits.map((box) => [box.nodeId, box]));
  const edgeAnchorBoxByNodeId = new Map<string, LayoutDiagnosticBox>();
  const layoutEdgeAnchorBoxByNodeId = new Map<string, LayoutDiagnosticBox>();
  edgeAnchorBoxes.forEach((box) => {
    if (!edgeAnchorBoxByNodeId.has(box.nodeId)) {
      edgeAnchorBoxByNodeId.set(box.nodeId, box);
    }
  });
  if (lastLayout && viewState.surfaceViewMode !== "scatter") {
    const mode = structuredSurfaceMode() || "tree";
    Object.entries(lastLayout.pos).forEach(([nodeId, p]) => {
      const rect = mode === "tree" || mode === "mindmap" ? mindmapBoxRect(p) : renderedBoxRect(p);
      layoutEdgeAnchorBoxByNodeId.set(nodeId, {
        nodeId,
        text: map?.state.nodes[nodeId]?.text || "",
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
      });
    });
  }
  const edgeElements = Array.from(canvas.querySelectorAll<SVGGeometryElement>(
    "path.edge[data-source-node-id][data-target-node-id], path.graph-link[data-source-node-id][data-target-node-id], line.graph-link[data-source-node-id][data-target-node-id]",
  ));
  edgeElements.forEach((edgeEl, index) => {
    const sourceId = edgeEl.getAttribute("data-source-node-id") || "";
    const targetId = edgeEl.getAttribute("data-target-node-id") || "";
    const edgeId = edgeEl.getAttribute("data-edge-id") || edgeEl.getAttribute("data-link-id") || `edge-${index}`;
    const isTreeEdge = edgeEl.classList.contains("edge-tree");
    const sourceBox = (isTreeEdge ? layoutEdgeAnchorBoxByNodeId.get(sourceId) : null)
      || edgeAnchorBoxByNodeId.get(sourceId)
      || hitByNodeId.get(sourceId);
    const targetBox = (isTreeEdge ? layoutEdgeAnchorBoxByNodeId.get(targetId) : null)
      || edgeAnchorBoxByNodeId.get(targetId)
      || hitByNodeId.get(targetId);
    const endpoints = svgEdgeEndpoints(edgeEl);
    if (!sourceBox || !targetBox || !endpoints) {
      issues.push({
        kind: "edge-dangling-endpoint",
        edgeId,
        nodeId: sourceId || targetId || undefined,
        message: `edge-dangling-endpoint: ${edgeId} cannot resolve source/target geometry`,
      });
      return;
    }
    if (!Number.isFinite(endpoints.start.x + endpoints.start.y + endpoints.end.x + endpoints.end.y)) {
      issues.push({
        kind: "edge-continuity",
        edgeId,
        nodeId: sourceId,
        otherNodeId: targetId,
        message: `edge-continuity: ${edgeId} has a non-finite endpoint`,
      });
      return;
    }
    if (pointInsideBox(endpoints.start, sourceBox)) {
      issues.push({
        kind: "edge-endpoint-inside",
        edgeId,
        nodeId: sourceId,
        message: `edge-endpoint-inside: ${edgeId} starts inside ${sourceId}`,
      });
    }
    if (pointInsideBox(endpoints.end, targetBox)) {
      issues.push({
        kind: "edge-endpoint-inside",
        edgeId,
        nodeId: targetId,
        message: `edge-endpoint-inside: ${edgeId} ends inside ${targetId}`,
      });
    }
    if (endpointDistanceToBox(endpoints.start, sourceBox) > 5 || endpointDistanceToBox(endpoints.end, targetBox) > 5) {
      issues.push({
        kind: "edge-dangling-endpoint",
        edgeId,
        nodeId: sourceId,
        otherNodeId: targetId,
        message: `edge-dangling-endpoint: ${edgeId} is detached from source or target bbox`,
      });
    }
    const sampleCount = Math.min(36, Math.max(10, Math.floor(endpoints.length / 42)));
    for (let sample = 1; sample < sampleCount; sample += 1) {
      const point = edgeEl.getPointAtLength((endpoints.length * sample) / sampleCount);
      for (const box of hits) {
        if (box.nodeId === sourceId || box.nodeId === targetId) continue;
        if (pointInsideBox(point, box, 3)) {
          issues.push({
            kind: "edge-node-penetration",
            edgeId,
            nodeId: box.nodeId,
            message: `edge-node-penetration: ${edgeId} crosses ${box.nodeId}`,
          });
          return;
        }
      }
    }
  });

  if (map && lastLayout && viewState.surfaceViewMode !== "scatter") {
    const pos = lastLayout.pos;
    const direction = viewState.surfaceBranchDirection;
    Object.values(map.state.nodes).forEach((node) => {
      const parentId = node.parentId;
      if (!parentId) return;
      const parent = pos[parentId];
      const child = pos[node.id];
      if (!parent || !child) return;
      const parentCenter = parent.x + parent.w / 2;
      const childCenter = child.x + child.w / 2;
      const minDelta = 8;
      if (direction === "right" && childCenter < parentCenter + minDelta) {
        issues.push({
          kind: "direction-violation",
          nodeId: node.id,
          otherNodeId: parentId,
          message: `right depth violation: ${node.id} is not right of ${parentId}`,
        });
      }
      if (direction === "left" && childCenter > parentCenter - minDelta) {
        issues.push({
          kind: "direction-violation",
          nodeId: node.id,
          otherNodeId: parentId,
          message: `left depth violation: ${node.id} is not left of ${parentId}`,
        });
      }
    });
  }

  return {
    ok: issues.length === 0,
    mode: viewState.surfaceViewMode,
    density: viewState.surfaceLayoutDensity,
    direction: viewState.surfaceBranchDirection,
    labelCount: labels.length,
    hitCount: hits.length,
    issues,
  };
}

(globalThis as any).__m3eDiagnoseLayout = collectLayoutDiagnostics;

function clientToCanvasPoint(clientX: number, clientY: number): { x: number; y: number } {
  const boardRect = board.getBoundingClientRect();
  return {
    x: (clientX - boardRect.left - viewState.cameraX) / viewState.zoom,
    y: (clientY - boardRect.top - viewState.cameraY) / viewState.zoom,
  };
}

function interactionHalfHeight(nodePos: NodePosition): number {
  return Math.max(VIEWER_TUNING.layout.nodeHitHeight, nodePos.h) / 2;
}

function getNodeHitBounds(nodeId: string): { left: number; right: number; top: number; bottom: number } | null {
  if (!map || !lastLayout) {
    return null;
  }
  const p = lastLayout.pos[nodeId];
  if (!p) {
    return null;
  }
  const displayRootId = currentScopeRootId();
  const left = nodeId === displayRootId ? p.x : p.x - 8;
  const width = nodeId === displayRootId ? p.w : p.w + 36;
  const halfH = interactionHalfHeight(p);
  return {
    left,
    right: left + width,
    top: p.y - halfH,
    bottom: p.y + halfH,
  };
}

function findNodeAtCanvasPoint(x: number, y: number): string | null {
  if (!lastLayout) {
    return null;
  }
  let hitNodeId: string | null = null;
  visibleOrder.forEach((nodeId) => {
    const bounds = getNodeHitBounds(nodeId);
    if (!bounds) {
      return;
    }
    if (x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom) {
      hitNodeId = nodeId;
    }
  });
  return hitNodeId;
}

function getVisibleChildrenForDrop(parentId: string, sourceId: string): string[] {
  const parent = getNode(parentId);
  const children = visibleChildren(parent);
  const sourceNode = getNode(sourceId);
  if (sourceNode.parentId === parentId) {
    return children.filter((childId) => childId !== sourceId);
  }
  return children;
}

function getReorderLineBounds(parentId: string, index: number, sourceId: string): { x1: number; x2: number } | null {
  if (!lastLayout) {
    return null;
  }
  const parentPos = lastLayout.pos[parentId];
  if (!parentPos) {
    return null;
  }
  const children = getVisibleChildrenForDrop(parentId, sourceId);
  if (children.length === 0) {
    return null;
  }
  const childBounds = children
    .map((childId) => getNodeHitBounds(childId))
    .filter((bounds): bounds is { left: number; right: number; top: number; bottom: number } => Boolean(bounds));
  if (childBounds.length === 0) {
    return null;
  }
  const x1 = Math.min(
    ...childBounds.map((bounds) => bounds.left),
    parentPos.x + parentPos.w - DRAG_REORDER_PARENT_LANE_PAD
  );
  const x2 = Math.max(...childBounds.map((bounds) => bounds.right)) + 20;
  return { x1, x2 };
}

function getSiblingMidpointBand(
  childBounds: Array<{ id: string; top: number; bottom: number; hitLeft: number; hitRight: number }>,
  index: number,
  parentBandBottom: number
): { startY: number; endY: number; lineY: number } {
  const current = childBounds[index]!;
  const prev = childBounds[index - 1];
  const next = childBounds[index + 1];
  const prevMid = prev ? (prev.top + prev.bottom) / 2 : parentBandBottom;
  const currentMid = (current.top + current.bottom) / 2;
  const nextMid = next ? (next.top + next.bottom) / 2 : current.bottom + DRAG_REORDER_TAIL;
  return {
    startY: prev ? (prevMid + currentMid) / 2 : parentBandBottom,
    endY: (currentMid + nextMid) / 2,
    lineY: current.top,
  };
}

function getNextVisibleNodeTopAtDepth(nodeId: string, depth: number): number | null {
  if (!lastLayout) {
    return null;
  }
  const currentIndex = visibleOrder.indexOf(nodeId);
  if (currentIndex < 0) {
    return null;
  }
  for (let index = currentIndex + 1; index < visibleOrder.length; index += 1) {
    const nextNodeId = visibleOrder[index]!;
    const nextPos = lastLayout.pos[nextNodeId];
    if (!nextPos || nextPos.depth !== depth) {
      continue;
    }
    return nextPos.y - interactionHalfHeight(nextPos);
  }
  return null;
}

function canDropUnderParent(sourceId: string | null | undefined, targetParentId: string | null | undefined): boolean {
  if (!sourceId || !targetParentId) {
    return false;
  }
  if (sourceId === targetParentId) {
    return false;
  }
  const sourceNode = getNode(sourceId);
  if (sourceNode.parentId === null) {
    return false;
  }
  if (isDescendant(targetParentId, sourceId)) {
    return false;
  }
  return true;
}

function isInExplicitReparentZone(nodeId: string, x: number, y: number): boolean {
  if (!lastLayout) {
    return false;
  }
  const nodePos = lastLayout.pos[nodeId];
  if (!nodePos) {
    return false;
  }
  const horizontalInset = Math.min(48, Math.max(14, nodePos.w * 0.2));
  const left = nodePos.x + horizontalInset;
  const right = nodePos.x + nodePos.w - horizontalInset;
  const halfH = interactionHalfHeight(nodePos);
  const topEdge = nodePos.y - halfH + DRAG_EDGE_BAND;
  const bottomEdge = nodePos.y + halfH - DRAG_EDGE_BAND;
  return x >= left && x <= right && y >= topEdge && y <= bottomEdge;
}

function proposeReorderDrop(sourceId: string, x: number, y: number): DragDropProposal | null {
  if (!lastLayout) {
    return null;
  }
  const layout = lastLayout;

  for (const parentId of visibleOrder) {
    const parentPos = layout.pos[parentId];
    if (!parentPos || !canDropUnderParent(sourceId, parentId)) {
      continue;
    }

    const children = getVisibleChildrenForDrop(parentId, sourceId);
    if (children.length === 0) {
      continue;
    }

    const childBounds = children
      .map((childId) => {
        const p = layout.pos[childId];
        const hit = getNodeHitBounds(childId);
        if (!p || !hit) {
          return null;
        }
        return {
          id: childId,
          top: hit.top,
          bottom: hit.bottom,
          hitLeft: hit.left,
          hitRight: hit.right,
        };
      })
      .filter((entry): entry is { id: string; top: number; bottom: number; hitLeft: number; hitRight: number } => Boolean(entry));

    if (childBounds.length === 0) {
      continue;
    }

    const x1 = Math.min(
      ...childBounds.map((entry) => entry.hitLeft),
      parentPos.x + parentPos.w - DRAG_REORDER_PARENT_LANE_PAD
    );
    const x2 = Math.max(...childBounds.map((entry) => entry.hitRight)) + 20;
    if (x < x1 || x > x2) {
      continue;
    }

    const parentBandBottom = Math.min(
      parentPos.y + DRAG_CENTER_BAND_HALF,
      childBounds[0]!.top - DRAG_EDGE_BAND
    );
    for (let index = 0; index < childBounds.length; index += 1) {
      const current = childBounds[index]!;
      const beforeBand = getSiblingMidpointBand(childBounds, index, parentBandBottom);
      const isInParentLane = x < current.hitLeft;
      const beforeStart = isInParentLane ? beforeBand.startY : Math.max(beforeBand.startY, current.top - DRAG_EDGE_BAND);
      const beforeEnd = isInParentLane ? beforeBand.endY : current.top + DRAG_EDGE_BAND;
      if (y >= beforeStart && y <= beforeEnd) {
        return {
          kind: "reorder",
          parentId,
          index,
          lineY: beforeBand.lineY,
        };
      }

      const next = childBounds[index + 1];
      if (!next) {
        const nextSameDepthTop = getNextVisibleNodeTopAtDepth(current.id, parentPos.depth + 1);
        const tailBottom = nextSameDepthTop === null
          ? current.bottom + DRAG_REORDER_TAIL
          : Math.min(current.bottom + DRAG_REORDER_TAIL, nextSameDepthTop);
        if (y >= current.bottom && y <= tailBottom) {
          return {
            kind: "reorder",
            parentId,
            index: childBounds.length,
            lineY: (current.bottom + tailBottom) / 2,
          };
        }
        continue;
      }
      if (y >= current.bottom && y <= next.top) {
        return {
          kind: "reorder",
          parentId,
          index: index + 1,
          lineY: (current.bottom + next.top) / 2,
        };
      }
    }
  }

  return null;
}

function proposeDrop(sourceId: string, clientX: number, clientY: number): DragDropProposal | null {
  const point = clientToCanvasPoint(clientX, clientY);
  const reorderProposal = proposeReorderDrop(sourceId, point.x, point.y);
  const targetNodeId = findNodeAtCanvasPoint(point.x, point.y);
  if (targetNodeId) {
    const targetPos = lastLayout?.pos[targetNodeId];
    const targetNode = map?.state.nodes[targetNodeId];
    if (targetPos && targetNode?.parentId) {
      const targetIndex = getVisibleChildrenForDrop(targetNode.parentId, sourceId).indexOf(targetNodeId);
      const targetHalfH = interactionHalfHeight(targetPos);
      const topEdge = targetPos.y - targetHalfH + DRAG_EDGE_BAND;
      const bottomEdge = targetPos.y + targetHalfH - DRAG_EDGE_BAND;
      if (point.y < topEdge && targetIndex >= 0 && canDropUnderParent(sourceId, targetNode.parentId)) {
        return {
          kind: "reorder",
          parentId: targetNode.parentId,
          index: targetIndex,
          lineY: targetPos.y - targetHalfH,
        };
      }
      if (point.y > bottomEdge && targetIndex >= 0 && canDropUnderParent(sourceId, targetNode.parentId)) {
        return {
          kind: "reorder",
          parentId: targetNode.parentId,
          index: targetIndex + 1,
          lineY: targetPos.y + targetHalfH,
        };
      }
    }

    if (reorderProposal) {
      return reorderProposal;
    }

    if (canDropUnderParent(sourceId, targetNodeId) && isInExplicitReparentZone(targetNodeId, point.x, point.y)) {
      return {
        kind: "reparent",
        parentId: targetNodeId,
      };
    }
  }

  return reorderProposal;
}

function canDropAllUnderParent(sourceIds: string[], targetParentId: string): boolean {
  return sourceIds.every((sourceId) => canDropUnderParent(sourceId, targetParentId));
}

function proposeDropForSources(sourceIds: string[], clientX: number, clientY: number): DragDropProposal | null {
  if (sourceIds.length === 0) {
    return null;
  }
  if (sourceIds.length === 1) {
    return proposeDrop(sourceIds[0]!, clientX, clientY);
  }
  const point = clientToCanvasPoint(clientX, clientY);
  const targetNodeId = findNodeAtCanvasPoint(point.x, point.y);
  if (!targetNodeId) {
    return null;
  }
  if (!canDropAllUnderParent(sourceIds, targetNodeId)) {
    return null;
  }
  return {
    kind: "reparent",
    parentId: targetNodeId,
  };
}

function normalizeSelectionState(): void {
  if (!map) {
    return;
  }

  if (!map.state.nodes[viewState.selectedNodeId] || !isNodeInScope(viewState.selectedNodeId) || !isNodeVisibleByImportance(viewState.selectedNodeId)) {
    viewState.selectedNodeId = preferredSelectionForScope(normalizedCurrentScopeId());
  }

  const normalizedSelectedIds = new Set<string>();
  viewState.selectedNodeIds.forEach((nodeId) => {
    if (map!.state.nodes[nodeId] && isNodeInScope(nodeId) && isNodeVisibleByImportance(nodeId)) {
      normalizedSelectedIds.add(nodeId);
    }
  });
  viewState.selectedNodeIds = normalizedSelectedIds;

  if (!viewState.selectedNodeIds.has(viewState.selectedNodeId)) {
    viewState.selectedNodeIds.add(viewState.selectedNodeId);
  }

  if (viewState.selectionAnchorId && !viewState.selectedNodeIds.has(viewState.selectionAnchorId)) {
    viewState.selectionAnchorId = null;
  }

  const normalizedReparentSourceIds = new Set<string>();
  viewState.reparentSourceIds.forEach((nodeId) => {
    if (map!.state.nodes[nodeId]) {
      normalizedReparentSourceIds.add(nodeId);
    }
  });
  viewState.reparentSourceIds = normalizedReparentSourceIds;

  if (viewState.clipboardState?.type === "cut") {
    const normalizedCutSourceIds = new Set<string>();
    viewState.clipboardState.sourceIds.forEach((nodeId) => {
      if (map!.state.nodes[nodeId]) {
        normalizedCutSourceIds.add(nodeId);
      }
    });
    viewState.clipboardState = normalizedCutSourceIds.size > 0
      ? { type: "cut", sourceIds: normalizedCutSourceIds }
      : null;
  }

  if (viewState.linkSourceNodeId && !map.state.nodes[viewState.linkSourceNodeId]) {
    viewState.linkSourceNodeId = "";
  }
  if (viewState.selectedLinkId && !map.state.links?.[viewState.selectedLinkId]) {
    viewState.selectedLinkId = "";
  }
  if (selectedGraphLinkId && !map.state.links?.[selectedGraphLinkId]) {
    selectedGraphLinkId = null;
  }
}

function setSingleSelection(nodeId: string, renderNow = true): void {
  getNode(nodeId);
  if (!isNodeInScope(nodeId) || !isNodeVisibleByImportance(nodeId)) {
    return;
  }
  viewState.selectedLinkId = "";
  selectedGraphLinkId = null;
  viewState.selectedNodeId = nodeId;
  viewState.selectedNodeIds = new Set([nodeId]);
  viewState.selectionAnchorId = null;
  syncV4Panel(false);
  if (renderNow) {
    scheduleRender();
  }
}

function getVisibleRangeSelection(anchorId: string, targetId: string): Set<string> {
  const anchorIndex = visibleOrder.indexOf(anchorId);
  const targetIndex = visibleOrder.indexOf(targetId);
  if (anchorIndex < 0 || targetIndex < 0) {
    return new Set([targetId]);
  }
  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  return new Set(visibleOrder.slice(start, end + 1));
}

function setRangeSelection(targetId: string): void {
  viewState.selectedLinkId = "";
  const anchorId = viewState.selectionAnchorId && map?.state.nodes[viewState.selectionAnchorId]
    ? viewState.selectionAnchorId
    : viewState.selectedNodeId;
  if (!anchorId) {
    setSingleSelection(targetId);
    return;
  }
  viewState.selectedNodeId = targetId;
  viewState.selectionAnchorId = anchorId;
  viewState.selectedNodeIds = getVisibleRangeSelection(anchorId, targetId);
  viewState.selectedNodeIds.add(targetId);
  syncV4Panel(false);
  scheduleRender();
}

function toggleNodeSelection(nodeId: string): void {
  viewState.selectedLinkId = "";
  viewState.selectionAnchorId = nodeId;
  if (viewState.selectedNodeIds.has(nodeId)) {
    if (viewState.selectedNodeIds.size === 1) {
      viewState.selectedNodeId = nodeId;
      scheduleRender();
      return;
    }
    viewState.selectedNodeIds.delete(nodeId);
    if (viewState.selectedNodeId === nodeId) {
      viewState.selectedNodeId = viewState.selectedNodeIds.values().next().value as string;
    }
    syncV4Panel(false);
    scheduleRender();
    return;
  }

  viewState.selectedNodeIds.add(nodeId);
  viewState.selectedNodeId = nodeId;
  syncV4Panel(false);
  scheduleRender();
}

function selectNode(nodeId: string): void {
  setSingleSelection(nodeId);
}

function selectGraphLink(linkId: string, renderNow = true): void {
  if (!map?.state.links?.[linkId]) {
    return;
  }
  viewState.selectedLinkId = linkId;
  selectedGraphLinkId = linkId;
  viewState.selectedNodeIds = new Set();
  viewState.selectionAnchorId = null;
  viewState.reparentSourceIds.clear();
  clearCutClipboard();
  const link = map.state.links[linkId];
  const source = map.state.nodes[link.sourceNodeId];
  const target = map.state.nodes[link.targetNodeId];
  setStatus(`Selected link: ${source ? uiLabel(source) : link.sourceNodeId} -> ${target ? uiLabel(target) : link.targetNodeId}. [ and ] adjust ports, Delete removes.`);
  if (renderNow) {
    scheduleRender();
  }
  board.focus();
}

function selectByPointerModifiers(nodeId: string, options: { toggle: boolean; range: boolean }): void {
  getNode(nodeId);
  if (!isNodeInScope(nodeId) || !isNodeVisibleByImportance(nodeId)) {
    return;
  }
  if (options.range) {
    setRangeSelection(nodeId);
    return;
  }
  if (options.toggle) {
    toggleNodeSelection(nodeId);
    return;
  }
  setSingleSelection(nodeId);
}

function updateScopeInUrl(scopeId: string): void {
  const params = new URLSearchParams(window.location.search);
  if (!map || scopeId === map.state.rootId) {
    params.delete("scope");
    params.delete("scopeId");
  } else {
    params.set("scope", scopeId);
    params.delete("scopeId");
  }
  history.replaceState(null, "", `?${params.toString()}`);
}

function EnterScopeCommand(scopeId = viewState.selectedNodeId): void {
  if (!map || !map.state.nodes[scopeId]) {
    return;
  }
  const currentScopeId = normalizedCurrentScopeId();
  if (scopeId === currentScopeId) {
    return;
  }
  viewState.scopeHistory.push(currentScopeId);
  viewState.currentScopeId = scopeId;
  viewState.currentScopeRootId = scopeId;
  viewState.surfaceViewMode = inferSurfaceViewModeForScope(scopeId);
  viewState.surfaceLayoutDensity = inferSurfaceLayoutDensityForScope(scopeId, viewState.surfaceViewMode);
  viewState.surfaceBranchDirection = inferSurfaceBranchDirectionForScope(scopeId, viewState.surfaceViewMode);
  setSingleSelection(preferredSelectionForScope(scopeId), false);
  normalizeSelectionState();
  render();
  triggerCameraMove("scope");
  setStatus(`Entered scope: ${getNode(scopeId).text}`);
  updateScopeInUrl(scopeId);
}

function ExitScopeCommand(): void {
  if (!map || viewState.scopeHistory.length === 0) {
    return;
  }
  const exitedScopeId = normalizedCurrentScopeId();
  const previousScopeId = viewState.scopeHistory.pop()!;
  viewState.currentScopeId = map.state.nodes[previousScopeId] ? previousScopeId : map.state.rootId;
  viewState.currentScopeRootId = viewState.currentScopeId;
  viewState.surfaceViewMode = inferSurfaceViewModeForScope(viewState.currentScopeId);
  viewState.surfaceLayoutDensity = inferSurfaceLayoutDensityForScope(viewState.currentScopeId, viewState.surfaceViewMode);
  viewState.surfaceBranchDirection = inferSurfaceBranchDirectionForScope(viewState.currentScopeId, viewState.surfaceViewMode);
  const selectionAfterExit =
    map.state.nodes[exitedScopeId] && isNodeInScope(exitedScopeId)
      ? exitedScopeId
      : preferredSelectionForScope(viewState.currentScopeId);
  setSingleSelection(selectionAfterExit, false);
  normalizeSelectionState();
  render();
  triggerCameraMove("scope");
  setStatus(`Exited scope: ${getNode(viewState.currentScopeId).text}`);
  updateScopeInUrl(viewState.currentScopeId);
}

// ---- .mm (Freeplane/FreeMind) export ----

function escapeXmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mmRichContent(type: string, text: string): string {
  return `<richcontent TYPE="${type}"><html><body>${escapeXmlAttr(text)}</body></html></richcontent>`;
}

function mmNodeToXml(node: TreeNode, state: AppState, indent: string): string {
  if (node.nodeType === "alias") return "";

  const attrs: string[] = [];
  attrs.push(`TEXT="${escapeXmlAttr(node.text)}"`);
  if (node.collapsed) attrs.push(`FOLDED="true"`);
  if (node.link) attrs.push(`LINK="${escapeXmlAttr(node.link)}"`);

  const parts: string[] = [];
  if (node.details) parts.push(`${indent}  ${mmRichContent("DETAILS", node.details)}`);
  if (node.note) parts.push(`${indent}  ${mmRichContent("NOTE", node.note)}`);

  const attrEntries = Object.entries(node.attributes || {});
  for (const [name, value] of attrEntries) {
    parts.push(`${indent}  <attribute NAME="${escapeXmlAttr(name)}" VALUE="${escapeXmlAttr(value)}"/>`);
  }

  for (const childId of node.children) {
    const child = state.nodes[childId];
    if (child) {
      const xml = mmNodeToXml(child, state, indent + "  ");
      if (xml) parts.push(xml);
    }
  }

  if (parts.length === 0) return `${indent}<node ${attrs.join(" ")}/>`;
  return `${indent}<node ${attrs.join(" ")}>\n${parts.join("\n")}\n${indent}</node>`;
}

function treeToMm(state: AppState): string {
  const root = state.nodes[state.rootId];
  if (!root) throw new Error("Root node not found");
  const body = mmNodeToXml(root, state, "  ");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<map version="freeplane 1.7.0">\n${body}\n</map>\n`;
}

function downloadMm(): void {
  const state = map!.state;
  const xml = treeToMm(state);
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const rootText = state.nodes[state.rootId]?.text || "export";
  const safeName = rootText.replace(/[<>:"/\\|?*]/g, "_").substring(0, 100);
  anchor.download = `${safeName}.mm`;
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus("Exported as .mm (FreeMind/Freeplane)");
}

// ── Home Screen ──

function collectFolderTree(parentId: string): { id: string; label: string; childCount: number; subFolders: ReturnType<typeof collectFolderTree> }[] {
  if (!map) {
    return [];
  }
  const parent = map.state.nodes[parentId];
  if (!parent) {
    return [];
  }
  const result: { id: string; label: string; childCount: number; subFolders: ReturnType<typeof collectFolderTree> }[] = [];
  for (const childId of parent.children || []) {
    const child = map.state.nodes[childId];
    if (!child) {
      continue;
    }
    if (isFolderNode(child)) {
      result.push({
        id: child.id,
        label: uiLabel(child),
        childCount: countHiddenDescendants(child.id),
        subFolders: collectFolderTree(child.id),
      });
    }
  }
  return result;
}

function renderScopeTree(
  container: HTMLElement,
  folders: ReturnType<typeof collectFolderTree>,
): void {
  container.innerHTML = "";
  for (const folder of folders) {
    const hasChildren = folder.subFolders.length > 0;

    const row = document.createElement("div");
    row.className = "home-scope-row";
    row.dataset.scopeId = folder.id;

    const toggle = document.createElement("button");
    toggle.className = "home-scope-toggle" + (hasChildren ? "" : " no-children");
    toggle.textContent = "\u25B6";
    toggle.type = "button";

    const name = document.createElement("span");
    name.className = "home-scope-name";
    name.textContent = folder.label;

    const count = document.createElement("span");
    count.className = "home-scope-count";
    count.textContent = `${folder.childCount} nodes`;

    row.appendChild(toggle);
    row.appendChild(name);
    row.appendChild(count);
    container.appendChild(row);

    let childContainer: HTMLElement | null = null;
    if (hasChildren) {
      childContainer = document.createElement("div");
      childContainer.className = "home-scope-children";
      childContainer.hidden = true;
      renderScopeTree(childContainer, folder.subFolders);
      container.appendChild(childContainer);
    }

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!childContainer) {
        return;
      }
      const isExpanded = !childContainer.hidden;
      childContainer.hidden = isExpanded;
      toggle.classList.toggle("expanded", !isExpanded);
    });

    row.addEventListener("click", () => {
      hideHomeScreen();
      EnterScopeCommand(folder.id);
    });
  }
}

function buildHomeBreadcrumb(): void {
  if (!map || !homeScreenEl) {
    return;
  }
  const existingBreadcrumb = homeScreenEl.querySelector(".home-breadcrumb");
  if (existingBreadcrumb) {
    existingBreadcrumb.remove();
  }

  const scopeId = currentScopeRootId();
  if (!scopeId || scopeId === map.state.rootId) {
    return;
  }

  const pathIds = scopePathIds(scopeId);
  if (pathIds.length <= 1) {
    return;
  }

  const breadcrumb = document.createElement("div");
  breadcrumb.className = "home-breadcrumb";

  for (let i = 0; i < pathIds.length; i++) {
    if (i > 0) {
      const sep = document.createElement("span");
      sep.className = "home-breadcrumb-sep";
      sep.textContent = "/";
      breadcrumb.appendChild(sep);
    }

    const nodeId = pathIds[i];
    const isLast = i === pathIds.length - 1;
    const label = nodeId === map.state.rootId ? "root" : uiLabel(map.state.nodes[nodeId]);

    const item = document.createElement("button");
    item.className = "home-breadcrumb-item" + (isLast ? " current" : "");
    item.textContent = label;
    item.type = "button";

    if (!isLast) {
      item.addEventListener("click", () => {
        hideHomeScreen();
        EnterScopeCommand(nodeId);
      });
    }

    breadcrumb.appendChild(item);
  }

  const homeBody = homeScreenEl.querySelector(".home-body");
  if (homeBody) {
    homeBody.insertBefore(breadcrumb, homeBody.firstChild);
  }
}

function showHomeScreen(): void {
  if (!homeScreenEl || !homeScopeTreeEl || !map) {
    return;
  }
  homeScreenVisible = true;
  homeScreenEl.hidden = false;
  scopeNavBtn?.setAttribute("aria-expanded", "true");
  appEl?.classList.add("home-active");

  const rootId = map.state.rootId;
  const folders = collectFolderTree(rootId);
  renderScopeTree(homeScopeTreeEl, folders);
  buildHomeBreadcrumb();
}

function hideHomeScreen(): void {
  if (!homeScreenEl) {
    return;
  }
  homeScreenVisible = false;
  homeScreenEl.hidden = true;
  scopeNavBtn?.setAttribute("aria-expanded", "false");
  appEl?.classList.remove("home-active");
  board.focus();
}

function toggleHomeScreen(): void {
  if (homeScreenVisible) {
    hideHomeScreen();
    return;
  }
  showHomeScreen();
}

scopeNavBtn?.addEventListener("click", () => {
  toggleHomeScreen();
});

scopeNavCloseBtn?.addEventListener("click", () => {
  hideHomeScreen();
});

localFsToggleBtn?.addEventListener("click", () => {
  toggleLocalFsPanel();
});

localFsCloseBtn?.addEventListener("click", () => {
  hideLocalFsPanel();
});

localFsConnectBtn?.addEventListener("click", () => {
  void connectLocalFsRoot();
});

localFsRefreshBtn?.addEventListener("click", () => {
  resetLocalFsTree();
  void loadLocalFsDirectory("", true);
});

localFsRootInputEl?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void connectLocalFsRoot();
  }
});

// ---- Entity List Panel ----

function collectEntityTree(parentId: string): { id: string; label: string; nodeType: string; children: ReturnType<typeof collectEntityTree> }[] {
  if (!map) {
    return [];
  }
  const parent = map.state.nodes[parentId];
  if (!parent) {
    return [];
  }
  const result: { id: string; label: string; nodeType: string; children: ReturnType<typeof collectEntityTree> }[] = [];
  for (const childId of parent.children || []) {
    const child = map.state.nodes[childId];
    if (!child) {
      continue;
    }
    result.push({
      id: child.id,
      label: uiLabel(child),
      nodeType: child.nodeType || "text",
      children: collectEntityTree(child.id),
    });
  }
  return result;
}

function highlightText(text: string, query: string): string {
  if (!query) {
    return escapeHtml(text);
  }
  const escaped = escapeHtml(text);
  const escapedQuery = escapeHtml(query);
  const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return escaped.replace(regex, '<span class="entity-highlight">$1</span>');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function filterEntityTree(
  nodes: ReturnType<typeof collectEntityTree>,
  query: string,
): ReturnType<typeof collectEntityTree> {
  if (!query) {
    return nodes;
  }
  const lowerQuery = query.toLowerCase();
  const result: ReturnType<typeof collectEntityTree> = [];
  for (const node of nodes) {
    const filteredChildren = filterEntityTree(node.children, query);
    if (node.label.toLowerCase().includes(lowerQuery) || filteredChildren.length > 0) {
      result.push({
        ...node,
        children: filteredChildren,
      });
    }
  }
  return result;
}

function renderEntityTree(
  container: HTMLElement,
  nodes: ReturnType<typeof collectEntityTree>,
  query: string,
  forceExpand: boolean,
): void {
  container.innerHTML = "";
  for (const node of nodes) {
    const hasChildren = node.children.length > 0;

    const row = document.createElement("div");
    row.className = "entity-row";
    if (viewState.selectedNodeId === node.id) {
      row.classList.add("is-selected");
    }
    row.dataset.nodeId = node.id;

    const toggle = document.createElement("button");
    toggle.className = "entity-toggle" + (hasChildren ? "" : " no-children");
    toggle.textContent = "\u25B6";
    toggle.type = "button";
    if (forceExpand && hasChildren) {
      toggle.classList.add("expanded");
    }

    const name = document.createElement("span");
    name.className = "entity-name";
    name.innerHTML = highlightText(node.label, query);

    row.appendChild(toggle);
    row.appendChild(name);

    if (node.nodeType === "folder") {
      const badge = document.createElement("span");
      badge.className = "entity-badge entity-badge-folder";
      badge.textContent = "folder";
      row.appendChild(badge);
      // Show lock badge on folder nodes in entity tree
      const folderLock = scopeLockMap.get(node.id);
      if (folderLock) {
        const lockBadge = document.createElement("span");
        const isOwn = folderLock.entityId === collabEntityId;
        lockBadge.className = "entity-scope-lock-badge " + (isOwn ? "lock-own" : "lock-other");
        lockBadge.textContent = isOwn ? "\uD83D\uDD12" : "\uD83D\uDD12";
        lockBadge.title = `Locked by ${folderLock.displayName}`;
        row.appendChild(lockBadge);
      }
    } else if (node.nodeType === "alias") {
      const actualNode = map ? map.state.nodes[node.id] : null;
      const broken = actualNode ? isBrokenAlias(actualNode) : false;
      const badge = document.createElement("span");
      if (broken) {
        badge.className = "entity-badge entity-badge-broken";
        badge.textContent = "broken";
        row.classList.add("alias-broken-row");
        // Add repair and delete buttons
        const repairBtn = document.createElement("button");
        repairBtn.className = "entity-alias-action-btn repair-btn";
        repairBtn.textContent = "Repair";
        repairBtn.title = "Convert to text node";
        repairBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          repairBrokenAlias(node.id);
        });
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "entity-alias-action-btn delete-btn";
        deleteBtn.textContent = "Delete";
        deleteBtn.title = "Remove broken alias";
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteBrokenAlias(node.id);
        });
        row.appendChild(badge);
        row.appendChild(repairBtn);
        row.appendChild(deleteBtn);
      } else {
        badge.className = "entity-badge entity-badge-alias";
        badge.textContent = "alias";
        row.appendChild(badge);
      }
    }

    container.appendChild(row);

    let childContainer: HTMLElement | null = null;
    if (hasChildren) {
      childContainer = document.createElement("div");
      childContainer.className = "entity-children";
      childContainer.hidden = !forceExpand;
      renderEntityTree(childContainer, node.children, query, forceExpand);
      container.appendChild(childContainer);
    }

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!childContainer) {
        return;
      }
      const isExpanded = !childContainer.hidden;
      childContainer.hidden = isExpanded;
      toggle.classList.toggle("expanded", !isExpanded);
    });

    row.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest(".entity-toggle")) {
        return;
      }
      hideEntityListPanel();
      setSingleSelection(node.id);
      centerOnNode(node.id, Math.max(1, viewState.zoom));
      setStatus(`Focused: ${node.label}`);
    });
  }
}

function buildEntityList(query = ""): void {
  if (!map || !entityListTreeEl) {
    return;
  }
  const scopeRoot = currentScopeRootId();
  const allNodes = collectEntityTree(scopeRoot);
  const filtered = filterEntityTree(allNodes, query);
  const forceExpand = Boolean(query);
  renderEntityTree(entityListTreeEl, filtered, query, forceExpand);
  applyPresenceBadges();
  applyChangeHighlights();
}

function showEntityListPanel(): void {
  if (!entityListPanelEl || !map) {
    return;
  }
  entityListVisible = true;
  entityListPanelEl.hidden = false;
  if (entityListSearchEl) {
    entityListSearchEl.value = "";
  }
  buildEntityScopeList();
  buildEntityList();
  startPresenceWatch();
  applyPresenceBadges();
  fetchChangedNodes();
}

function hideEntityListPanel(): void {
  if (!entityListPanelEl) {
    return;
  }
  entityListVisible = false;
  entityListPanelEl.hidden = true;
  stopPresenceWatch();
  board.focus();
}

function toggleEntityListPanel(): void {
  if (entityListVisible) {
    hideEntityListPanel();
  } else {
    showEntityListPanel();
  }
}

if (entityListSearchEl) {
  entityListSearchEl.addEventListener("input", () => {
    buildEntityList(entityListSearchEl!.value.trim());
  });
  entityListSearchEl.addEventListener("keydown", (e) => {
    e.stopPropagation();
  });
}

if (entityListCloseBtn) {
  entityListCloseBtn.addEventListener("click", () => {
    hideEntityListPanel();
  });
}

// ---- Entity Scope List (Frames-style) ----

function buildEntityScopeList(): void {
  if (!entityScopeListEl || !map) {
    return;
  }
  entityScopeListEl.innerHTML = "";

  const rootId = map.state.rootId;
  const folders = collectFolderTree(rootId);
  const currentScope = currentScopeRootId();

  // Add root scope entry
  const rootRow = document.createElement("div");
  rootRow.className = "entity-scope-row" + (currentScope === rootId ? " is-current-scope" : "");
  rootRow.dataset.scopeId = rootId;

  const rootIcon = document.createElement("span");
  rootIcon.className = "entity-scope-icon";
  rootIcon.textContent = "\u25C6";

  const rootName = document.createElement("span");
  rootName.className = "entity-scope-name";
  rootName.textContent = uiLabel(map.state.nodes[rootId]) || "Root";

  rootRow.appendChild(rootIcon);
  rootRow.appendChild(rootName);

  // Lock badge for root scope
  appendScopeLockBadge(rootRow, rootId);

  entityScopeListEl.appendChild(rootRow);

  rootRow.addEventListener("click", () => {
    EnterScopeCommand(rootId);
    buildEntityScopeList();
    buildEntityList(entityListSearchEl?.value.trim() || "");
  });

  rootRow.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    showScopeLockContextMenu(e.clientX, e.clientY, rootId);
  });

  // Add folder scopes recursively
  renderEntityScopeItems(entityScopeListEl, folders, currentScope, 1);
}

function renderEntityScopeItems(
  container: HTMLElement,
  folders: ReturnType<typeof collectFolderTree>,
  currentScope: string,
  depth: number,
): void {
  for (const folder of folders) {
    const row = document.createElement("div");
    row.className = "entity-scope-row" + (currentScope === folder.id ? " is-current-scope" : "");
    row.dataset.scopeId = folder.id;
    row.style.paddingLeft = `${8 + depth * 12}px`;

    const icon = document.createElement("span");
    icon.className = "entity-scope-icon";
    icon.textContent = "\u25C7";

    const name = document.createElement("span");
    name.className = "entity-scope-name";
    name.textContent = folder.label;

    const count = document.createElement("span");
    count.className = "entity-scope-count";
    count.textContent = `${folder.childCount}`;

    row.appendChild(icon);
    row.appendChild(name);
    row.appendChild(count);

    // Lock badge for this folder scope
    appendScopeLockBadge(row, folder.id);

    container.appendChild(row);

    row.addEventListener("click", () => {
      EnterScopeCommand(folder.id);
      buildEntityScopeList();
      buildEntityList(entityListSearchEl?.value.trim() || "");
    });

    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showScopeLockContextMenu(e.clientX, e.clientY, folder.id);
    });

    if (folder.subFolders.length > 0) {
      renderEntityScopeItems(container, folder.subFolders, currentScope, depth + 1);
    }
  }
}

function appendScopeLockBadge(row: HTMLElement, scopeId: string): void {
  const lock = scopeLockMap.get(scopeId);
  if (!lock) {
    return;
  }
  const badge = document.createElement("span");
  const isOwn = lock.entityId === collabEntityId;
  badge.className = "entity-scope-lock-badge " + (isOwn ? "lock-own" : "lock-other");
  badge.textContent = isOwn ? "\uD83D\uDD12 You" : "\uD83D\uDD12 " + lock.displayName;
  badge.title = `Locked by ${lock.displayName} (priority ${lock.priority})`;
  row.appendChild(badge);
}

function buildMapPath(nodeId: string): string | null {
  if (!map) return null;
  const nodes = map.state.nodes;
  const pathNodes: TreeNode[] = [];
  let cur: TreeNode | undefined = nodes[nodeId];
  let guard = 0;
  while (cur && guard++ < 10000) {
    pathNodes.unshift(cur);
    if (cur.parentId === null || cur.parentId === undefined) break;
    cur = nodes[cur.parentId];
  }
  if (pathNodes.length === 0) return null;
  return formatMapPath(pathNodes);
}

function formatMapPath(pathNodes: TreeNode[]): string {
  const parts = pathNodes
    .filter((node) => node.id !== map?.state.rootId)
    .map((node) => ({ label: uiLabel(node), isScopeRoot: isFolderNode(node) }));
  if (parts.length === 0) {
    return `M:(${MAP_LABEL})> root`;
  }
  let path = `M:(${MAP_LABEL})> ${parts[0].label}`;
  for (let i = 1; i < parts.length; i++) {
    path += parts[i].isScopeRoot ? " >> " : " > ";
    path += parts[i].label;
  }
  return path;
}

async function copyMapPathToClipboard(nodeId: string): Promise<void> {
  const path = buildMapPath(nodeId);
  if (!path) return;
  try {
    await navigator.clipboard.writeText(path);
  } catch {
    // Fallback: textarea + execCommand for older contexts
    const ta = document.createElement("textarea");
    ta.value = path;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } finally { ta.remove(); }
  }
}

function showScopeLockContextMenu(x: number, y: number, scopeId: string): void {
  const lock = scopeLockMap.get(scopeId);
  const items: { label: string; danger?: boolean; action: () => void }[] = [];

  items.push({
    label: "\uD83D\uDCCB Copy path (M:(map)> \u2026)",
    action: () => void copyMapPathToClipboard(scopeId),
  });

  if (!lock) {
    items.push({
      label: "\uD83D\uDD12 Lock this scope",
      action: () => void acquireScopeLockFromUi(scopeId),
    });
  } else if (lock.entityId === collabEntityId) {
    items.push({
      label: "\uD83D\uDD13 Unlock this scope",
      action: () => void releaseScopeLockFromUi(scopeId),
    });
  } else {
    items.push({
      label: `Locked by ${lock.displayName}`,
      action: () => { /* no-op, info only */ },
    });
  }

  showContextMenu(x, y, items);
}

// ---- Presence Badges ----

function startPresenceWatch(): void {
  if (presenceEs) {
    return;
  }
  const url = `/api/maps/${encodeURIComponent(LOCAL_MAP_ID)}/presence`;
  presenceEs = new EventSource(url);
  presenceEs.addEventListener("message", (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data && typeof data === "object") {
        updatePresenceMap(data);
        if (entityListVisible) {
          applyPresenceBadges();
        }
      }
    } catch {
      // ignore parse errors
    }
  });
  presenceEs.addEventListener("error", () => {
    stopPresenceWatch();
  });
}

function stopPresenceWatch(): void {
  if (presenceEs) {
    presenceEs.close();
    presenceEs = null;
  }
}

function updatePresenceMap(data: Record<string, unknown>): void {
  presenceMap.clear();
  const users = (data as { users?: { userId: string; color?: string; nodeId?: string }[] }).users;
  if (!Array.isArray(users)) {
    return;
  }
  for (const user of users) {
    if (!user.nodeId) {
      continue;
    }
    const existing = presenceMap.get(user.nodeId) || [];
    existing.push({
      userId: user.userId,
      color: user.color || "#ff6b6b",
      nodeId: user.nodeId,
    });
    presenceMap.set(user.nodeId, existing);
  }
}

function applyPresenceBadges(): void {
  if (!entityListTreeEl) {
    return;
  }
  // Remove existing badges
  const existingBadges = entityListTreeEl.querySelectorAll(".presence-badges");
  existingBadges.forEach((el) => el.remove());

  // Apply new badges
  presenceMap.forEach((users, nodeId) => {
    const row = entityListTreeEl!.querySelector(`[data-node-id="${nodeId}"]`);
    if (!row) {
      return;
    }
    const badgesContainer = document.createElement("span");
    badgesContainer.className = "presence-badges";
    for (const user of users.slice(0, 3)) {
      const badge = document.createElement("span");
      badge.className = "presence-badge";
      badge.style.backgroundColor = user.color;
      badge.title = user.userId;
      badgesContainer.appendChild(badge);
    }
    if (users.length > 3) {
      const more = document.createElement("span");
      more.className = "presence-badge";
      more.style.backgroundColor = "#999";
      more.title = `+${users.length - 3} more`;
      badgesContainer.appendChild(more);
    }
    row.appendChild(badgesContainer);
  });
}

// ---- Away Changes (audit infrastructure) ----

function fetchChangedNodes(): void {
  const url = `/api/maps/${encodeURIComponent(LOCAL_MAP_ID)}/audit?since=last-session`;
  fetch(url, { cache: "no-store" })
    .then((r) => {
      if (!r.ok) {
        return null;
      }
      return r.json();
    })
    .then((data) => {
      if (!data || !Array.isArray(data.changedNodeIds)) {
        return;
      }
      changedNodeIds = new Set(data.changedNodeIds as string[]);
      if (entityListVisible) {
        applyChangeHighlights();
      }
    })
    .catch(() => {
      // audit endpoint may not exist yet
    });
}

function applyChangeHighlights(): void {
  if (!entityListTreeEl || changedNodeIds.size === 0) {
    return;
  }
  changedNodeIds.forEach((nodeId) => {
    const row = entityListTreeEl!.querySelector(`[data-node-id="${nodeId}"]`);
    if (row) {
      row.classList.add("has-changes");
    }
  });
}

function loadCollabPrefs(): CollabPrefs {
  try {
    const raw = window.localStorage.getItem(COLLAB_PREFS_KEY);
    if (!raw) return { displayName: "", joinToken: "" };
    const parsed = JSON.parse(raw) as Partial<CollabPrefs>;
    return {
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : "",
      joinToken: typeof parsed.joinToken === "string" ? parsed.joinToken : "",
    };
  } catch {
    return { displayName: "", joinToken: "" };
  }
}

function saveCollabPrefs(prefs: CollabPrefs): void {
  window.localStorage.setItem(COLLAB_PREFS_KEY, JSON.stringify(prefs));
}

function syncCollabUi(): void {
  const prefs = loadCollabPrefs();
  if (collabDisplayNameInputEl && !collabDisplayNameInputEl.value && prefs.displayName) {
    collabDisplayNameInputEl.value = prefs.displayName;
  }
  if (collabJoinTokenInputEl) {
    if (!collabJoinTokenInputEl.value && prefs.joinToken) {
      collabJoinTokenInputEl.value = prefs.joinToken;
    }
    collabJoinTokenInputEl.hidden = !(collabConfig?.requiresJoinToken ?? false);
  }
  if (collabMetaEl) {
    collabMetaEl.textContent = collabConfig
      ? `Workspace: ${collabConfig.workspaceId} | Map: ${collabConfig.mapLabel}`
      : "Workspace: n/a";
  }
  if (collabSyncBadgeEl) {
    collabSyncBadgeEl.classList.remove("on", "conflict");
    if (!collabConfig?.enabled) {
      collabSyncBadgeEl.textContent = "Collab: off";
    } else if (collabEntityId && collabToken) {
      collabSyncBadgeEl.textContent = "Collab: joined";
      collabSyncBadgeEl.classList.add("on");
    } else if (collabConfig.requiresJoinToken) {
      collabSyncBadgeEl.textContent = "Collab: join required";
      collabSyncBadgeEl.classList.add("conflict");
    } else {
      collabSyncBadgeEl.textContent = "Collab: ready";
    }
  }
  if (collabJoinBtn) {
    collabJoinBtn.disabled = !collabConfig?.enabled;
  }
  if (collabLeaveBtn) {
    collabLeaveBtn.disabled = !collabEntityId;
  }
}

function getOwnedScopeLock(scopeId: string): ClientScopeLock | null {
  const lock = scopeLockMap.get(scopeId);
  if (!lock || lock.entityId !== collabEntityId || !lock.lockId) {
    return null;
  }
  return lock;
}

function cloneNodeForCollab(nodeId: string): TreeNode | null {
  if (!map) {
    return null;
  }
  const node = map.state.nodes[nodeId];
  if (!node) {
    return null;
  }
  return {
    ...node,
    children: [...(node.children || [])],
    attributes: { ...(node.attributes || {}) },
  };
}

function collectScopeNodeChanges(scopeId: string): Record<string, TreeNode> {
  const changes: Record<string, TreeNode> = {};
  if (!map || !map.state.nodes[scopeId]) {
    return changes;
  }
  const stack = [scopeId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const nodeId = stack.pop()!;
    if (seen.has(nodeId)) {
      continue;
    }
    seen.add(nodeId);
    const snapshot = cloneNodeForCollab(nodeId);
    if (!snapshot) {
      continue;
    }
    changes[nodeId] = snapshot;
    for (const childId of snapshot.children || []) {
      if (!seen.has(childId)) {
        stack.push(childId);
      }
    }
  }
  return changes;
}

async function pushCurrentScopeToCollab(showStatus = false): Promise<boolean> {
  if (!map || !collabToken || !collabEntityId) {
    return false;
  }
  const mapWithVersion = map as SavedMap & { mapVersion?: number };
  const scopeId = currentScopeRootId();
  const lock = getOwnedScopeLock(scopeId);
  if (!lock) {
    return false;
  }
  const nodes = collectScopeNodeChanges(scopeId);
  if (Object.keys(nodes).length === 0) {
    return false;
  }
  const pushNodesWithBaseVersion = async (baseVersion: number): Promise<CollabPushResponse> => {
    const res = await fetch(`/api/collab/push/${encodeURIComponent(LOCAL_MAP_ID)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${collabToken}`,
        "X-M3E-Tab-Id": TAB_ID,
      },
      body: JSON.stringify({
        scopeId,
        lockId: lock.lockId,
        baseVersion,
        changes: { nodes },
      }),
    });
    const payload = await res.json().catch(() => ({ ok: false, version: baseVersion, applied: [], rejected: [], conflicts: [], error: `HTTP ${res.status}` })) as CollabPushResponse;
    if (!res.ok) {
      payload.ok = false;
      if (!payload.error) {
        payload.error = `HTTP ${res.status}`;
      }
    }
    return payload;
  };

  try {
    const payload = await pushNodesWithBaseVersion(mapWithVersion.mapVersion ?? 0);
    if (!payload.ok) {
      if (payload.error === "Version conflict.") {
        const remoteResponse = await fetch(`/api/maps/${encodeURIComponent(LOCAL_MAP_ID)}`, { cache: "no-store" });
        if (remoteResponse.ok) {
          const remotePayload = ensureDocShape(await remoteResponse.json()) as SavedMap & { mapVersion?: number };
          showConflictPanel(remotePayload.state, {
            localLabel: "Use Local",
            remoteLabel: "Use Team",
            onUseLocal: () => {
              void (async () => {
                const retry = await pushNodesWithBaseVersion(remotePayload.mapVersion ?? 0);
                if (retry.ok) {
                  mapWithVersion.mapVersion = retry.version;
                  void loadDocFromLocalDb(false);
                  setStatus(`Collab push completed (${retry.applied.length} nodes).`);
                } else {
                  setStatus(`Collab push failed: ${retry.error || "Unknown error"}`, true);
                }
              })();
            },
            onUseRemote: () => {
              loadPayload(remotePayload);
              setStatus("Loaded team version.");
            },
          });
          setStatus("Collab conflict detected. Choose Use Local or Use Team.", true);
          return false;
        }
      }
      if (showStatus) {
        setStatus(`Collab push failed: ${payload.error || "Unknown error"}`, true);
      }
      return false;
    }
    mapWithVersion.mapVersion = payload.version;
    if (showStatus) {
      setStatus(`Collab push completed (${payload.applied.length} nodes).`);
    }
    return true;
  } catch (err) {
    if (showStatus) {
      setStatus(`Collab push failed: ${(err as Error).message}`, true);
    }
    return false;
  }
}

async function fetchCollabConfig(): Promise<void> {
  try {
    const res = await fetch("/api/collab/config", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json() as CollabConfigResponse;
      if (data.ok) {
        collabConfig = data;
      }
    } else {
      collabConfig = null;
    }
  } catch {
    collabConfig = null;
  }
  syncCollabUi();
}

function stopCollabHeartbeat(): void {
  if (collabHeartbeatTimer) {
    clearInterval(collabHeartbeatTimer);
    collabHeartbeatTimer = null;
  }
}

function startCollabHeartbeat(): void {
  stopCollabHeartbeat();
  if (!collabToken) {
    return;
  }
  collabHeartbeatTimer = setInterval(() => {
    if (!collabToken) return;
    const ownLockIds = Array.from(scopeLockMap.values())
      .filter((lock) => lock.entityId === collabEntityId)
      .map((lock) => lock.lockId)
      .filter((lockId): lockId is string => Boolean(lockId));
    void fetch("/api/collab/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${collabToken}`,
      },
      body: JSON.stringify({ lockIds: ownLockIds, mapId: LOCAL_MAP_ID }),
    }).catch(() => undefined);
  }, 10_000);
}

async function unregisterCollabEntity(showStatus = false): Promise<void> {
  stopCollabHeartbeat();
  stopCollabEventSource();
  if (collabToken) {
    try {
      await fetch("/api/collab/unregister", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${collabToken}` },
      });
    } catch {
      // ignore unregister errors on reconnect/shutdown
    }
  }
  collabEntityId = null;
  collabToken = null;
  scopeLockMap.clear();
  syncCollabUi();
  if (showStatus) {
    setStatus("Left team collaboration.");
  }
}

async function registerCollabEntity(displayName: string, joinToken: string): Promise<boolean> {
  if (!collabConfig?.enabled) {
    setStatus("Collaboration is not enabled on this server.", true);
    return false;
  }
  const trimmedName = displayName.trim();
  const trimmedJoinToken = joinToken.trim();
  if (!trimmedName) {
    setStatus("Display name is required.", true);
    return false;
  }
  if (collabConfig.requiresJoinToken && !trimmedJoinToken) {
    setStatus("Join token is required.", true);
    return false;
  }
  await unregisterCollabEntity(false);
  try {
    const res = await fetch("/api/collab/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: trimmedName,
        role: "human",
        capabilities: ["read", "write"],
        joinToken: trimmedJoinToken || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok || !data.entityId || !data.token) {
      setStatus(`Collab join failed: ${data?.error || `HTTP ${res.status}`}`, true);
      syncCollabUi();
      return false;
    }
    collabEntityId = data.entityId;
    collabToken = data.token;
    saveCollabPrefs({ displayName: trimmedName, joinToken: trimmedJoinToken });
    startCollabEventSource();
    startCollabHeartbeat();
    syncCollabUi();
    setStatus(`Joined team collaboration as ${trimmedName}.`);
    return true;
  } catch (err) {
    setStatus(`Collab join failed: ${(err as Error).message}`, true);
    syncCollabUi();
    return false;
  }
}

// ---- Scope Lock Management ----

function startCollabEventSource(): void {
  if (collabEventSource || !collabToken || !collabEntityId) {
    return;
  }
  const params = new URLSearchParams({ token: collabToken });
  const url = `/api/collab/events/${encodeURIComponent(collabEntityId)}?${params.toString()}`;
  collabEventSource = new EventSource(url);

  collabEventSource.addEventListener("lock_acquired", (event: Event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data);
      const existing = scopeLockMap.get(data.scopeId);
      scopeLockMap.set(data.scopeId, {
        scopeId: data.scopeId,
        entityId: data.entityId,
        displayName: data.displayName || data.entityId,
        priority: data.priority || 0,
        lockId: existing && existing.entityId === data.entityId ? existing.lockId : undefined,
      });
      render();
      if (entityListVisible) {
        buildEntityScopeList();
      }
    } catch { /* ignore */ }
  });

  collabEventSource.addEventListener("lock_released", (event: Event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data);
      scopeLockMap.delete(data.scopeId);
      render();
      if (entityListVisible) {
        buildEntityScopeList();
      }
    } catch { /* ignore */ }
  });

  collabEventSource.addEventListener("lock_preempted", (event: Event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data);
      // The old lock holder lost the lock; update to new holder
      scopeLockMap.set(data.scopeId, {
        scopeId: data.scopeId,
        entityId: data.newEntity,
        displayName: data.newEntity,
        priority: 0,
      });
      if (data.oldEntity === collabEntityId) {
        setStatus(`Lock on scope preempted by higher-priority entity.`, true);
      }
      render();
      if (entityListVisible) {
        buildEntityScopeList();
      }
    } catch { /* ignore */ }
  });

  collabEventSource.addEventListener("state_update", (event: Event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as { version?: number; entityId?: string };
      if (map && typeof data.version === "number") {
        (map as SavedMap & { mapVersion?: number }).mapVersion = data.version;
      }
      if (data.entityId === collabEntityId) {
        return;
      }
      if (autosaveTimer !== null) {
        setStatus("Collab update available — save your edits first.", false);
        return;
      }
      void loadDocFromLocalDb(false);
    } catch {
      // ignore malformed state updates
    }
  });

  collabEventSource.addEventListener("error", () => {
    if (collabEventSource) {
      collabEventSource.close();
      collabEventSource = null;
    }
  });
}

function stopCollabEventSource(): void {
  if (collabEventSource) {
    collabEventSource.close();
    collabEventSource = null;
  }
}

async function acquireScopeLockFromUi(scopeId: string): Promise<void> {
  if (!collabToken) {
    setStatus("Collab not registered. Lock unavailable.", true);
    return;
  }
  try {
    const res = await fetch(`/api/collab/scope/${encodeURIComponent(scopeId)}/lock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${collabToken}` },
    });
    const data = await res.json();
    if (data.ok) {
      setStatus(`Scope locked.`);
      // SSE will update the map, but update eagerly for responsiveness
      scopeLockMap.set(scopeId, {
        scopeId,
        entityId: collabEntityId!,
        displayName: "You",
        priority: 0,
        lockId: data.lockId,
      });
      render();
      if (entityListVisible) {
        buildEntityScopeList();
      }
    } else {
      setStatus(`Lock failed: ${data.error || "Unknown error"}`, true);
    }
  } catch (err) {
    setStatus(`Lock request failed: ${(err as Error).message}`, true);
  }
}

async function releaseScopeLockFromUi(scopeId: string): Promise<void> {
  if (!collabToken) {
    return;
  }
  try {
    const res = await fetch(`/api/collab/scope/${encodeURIComponent(scopeId)}/lock`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${collabToken}` },
    });
    const data = await res.json();
    if (data.ok) {
      setStatus(`Scope unlocked.`);
      scopeLockMap.delete(scopeId);
      render();
      if (entityListVisible) {
        buildEntityScopeList();
      }
    } else {
      setStatus(`Unlock failed: ${data.error || "Unknown error"}`, true);
    }
  } catch (err) {
    setStatus(`Unlock request failed: ${(err as Error).message}`, true);
  }
}

// Try to register as collab entity on startup (only when M3E_COLLAB is active)
function tryCollabRegister(): void {
  const prefs = loadCollabPrefs();
  const displayName = prefs.displayName || "Viewer";
  const joinToken = prefs.joinToken || "";
  if (collabConfig?.requiresJoinToken && !joinToken) {
    syncCollabUi();
    return;
  }
  void registerCollabEntity(displayName, joinToken);
}

if (collabJoinBtn) {
  collabJoinBtn.addEventListener("click", () => {
    const displayName = collabDisplayNameInputEl?.value || "";
    const joinToken = collabJoinTokenInputEl?.value || "";
    void registerCollabEntity(displayName, joinToken);
  });
}

if (collabLeaveBtn) {
  collabLeaveBtn.addEventListener("click", () => {
    void unregisterCollabEntity(true);
  });
}

// ---- Template Completion (VS Code-style framework snippets) ----

type TemplateCompletionCandidate = {
  id: string;
  label: string;
  path: string;
  childCount: number;
  searchText: string;
};

type TemplateCompletionState = {
  root: HTMLElement;
  input: HTMLInputElement;
  list: HTMLElement;
  detail: HTMLElement;
  anchorNodeId: string;
  candidates: TemplateCompletionCandidate[];
  filtered: TemplateCompletionCandidate[];
  selectedIndex: number;
  closeHandler: (event: MouseEvent) => void;
};

const TEMPLATE_CACHE_PATH = ["SYSTEM", "TEMPLATE", "cache"];
let templateCompletionState: TemplateCompletionState | null = null;

function normalizedTemplateToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]/g, "");
}

function templateSearchText(node: TreeNode, path: string): string {
  const attributes = node.attributes || {};
  return [
    node.text,
    path,
    attributes["m3e:aliases"],
    attributes["m3e:keywords"],
    attributes["template:aliases"],
    attributes["template:keywords"],
  ].filter(Boolean).join(" ");
}

function nodePathText(nodeId: string): string {
  if (!map) return "";
  const labels: string[] = [];
  let current: TreeNode | undefined = map.state.nodes[nodeId];
  while (current) {
    labels.unshift(current.text || "(untitled)");
    if (!current.parentId) break;
    current = map.state.nodes[current.parentId];
  }
  return labels.join(" > ");
}

function findChildByLabel(parentId: string, label: string): TreeNode | null {
  if (!map) return null;
  const parent = map.state.nodes[parentId];
  if (!parent) return null;
  const normalizedLabel = label.trim().toLowerCase();
  for (const childId of parent.children || []) {
    const child = map.state.nodes[childId];
    if (child && child.text.trim().toLowerCase() === normalizedLabel) {
      return child;
    }
  }
  return null;
}

function resolveTemplateCacheNode(): TreeNode | null {
  if (!map) return null;
  let current = map.state.nodes[map.state.rootId];
  if (!current) return null;
  for (const segment of TEMPLATE_CACHE_PATH) {
    const next = findChildByLabel(current.id, segment);
    if (!next) return null;
    current = next;
  }
  return current;
}

function collectTemplateCandidates(): TemplateCompletionCandidate[] {
  if (!map) return [];
  const cache = resolveTemplateCacheNode();
  if (!cache) return [];
  return (cache.children || [])
    .map((nodeId) => map!.state.nodes[nodeId])
    .filter((node): node is TreeNode => Boolean(node))
    .map((node) => {
      const path = nodePathText(node.id);
      return {
        id: node.id,
        label: node.text || "(untitled)",
        path,
        childCount: (node.children || []).length,
        searchText: templateSearchText(node, path),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "ja"));
}

function filterTemplateCandidates(candidates: TemplateCompletionCandidate[], query: string): TemplateCompletionCandidate[] {
  const normalizedQuery = normalizedTemplateToken(query);
  if (!normalizedQuery) {
    return candidates.slice(0, 12);
  }
  return candidates
    .map((candidate) => {
      const normalizedLabel = normalizedTemplateToken(candidate.label);
      const normalizedSearch = normalizedTemplateToken(candidate.searchText);
      const score = normalizedLabel.startsWith(normalizedQuery)
        ? 0
        : normalizedLabel.includes(normalizedQuery)
          ? 1
          : normalizedSearch.includes(normalizedQuery)
            ? 2
            : 99;
      return { candidate, score };
    })
    .filter((entry) => entry.score < 99)
    .sort((a, b) => a.score - b.score || a.candidate.label.localeCompare(b.candidate.label, "ja"))
    .slice(0, 12)
    .map((entry) => entry.candidate);
}

function templateCompletionPlacement(nodeId: string): { left: number; top: number } {
  if (!lastLayout || !lastLayout.pos[nodeId]) {
    return { left: Math.max(16, window.innerWidth / 2 - 170), top: Math.max(16, window.innerHeight / 2 - 90) };
  }
  const nodePos = lastLayout.pos[nodeId]!;
  const boardRect = board.getBoundingClientRect();
  const screenX = boardRect.left + viewState.cameraX + (nodePos.x + nodePos.w) * viewState.zoom + 10;
  const screenY = boardRect.top + viewState.cameraY + (nodePos.y - nodePos.h / 2) * viewState.zoom;
  return {
    left: Math.max(8, Math.min(window.innerWidth - 380, screenX)),
    top: Math.max(8, Math.min(window.innerHeight - 260, screenY)),
  };
}

function syncTemplateCompletionPlacement(): void {
  const state = templateCompletionState;
  if (!state) return;
  const placement = templateCompletionPlacement(state.anchorNodeId);
  state.root.style.left = `${placement.left}px`;
  state.root.style.top = `${placement.top}px`;
}

function renderTemplateCompletion(): void {
  const state = templateCompletionState;
  if (!state) return;
  const query = state.input.value.trim();
  state.filtered = filterTemplateCandidates(state.candidates, query);
  if (state.selectedIndex >= state.filtered.length) {
    state.selectedIndex = Math.max(0, state.filtered.length - 1);
  }
  if (state.selectedIndex < 0) {
    state.selectedIndex = 0;
  }
  state.list.textContent = "";

  if (state.filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "template-completion-empty";
    empty.textContent = query ? "No matching templates" : "No templates";
    state.list.appendChild(empty);
    state.detail.textContent = "SYSTEM > TEMPLATE > cache";
    return;
  }

  state.filtered.forEach((candidate, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `template-completion-item${index === state.selectedIndex ? " is-selected" : ""}`;
    item.dataset.templateId = candidate.id;
    item.innerHTML = `<span>${escapeHtml(candidate.label)}</span><small>${candidate.childCount} child${candidate.childCount === 1 ? "" : "ren"}</small>`;
    item.addEventListener("mouseenter", () => {
      state.selectedIndex = index;
      renderTemplateCompletion();
    });
    item.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.selectedIndex = index;
      applySelectedTemplateCompletion();
    });
    state.list.appendChild(item);
  });

  const selected = state.filtered[state.selectedIndex];
  state.detail.textContent = selected ? `${selected.path} · ${selected.childCount} child${selected.childCount === 1 ? "" : "ren"}` : "";
}

function hideTemplateCompletion(): void {
  if (!templateCompletionState) return;
  document.removeEventListener("mousedown", templateCompletionState.closeHandler, true);
  templateCompletionState.root.remove();
  templateCompletionState = null;
  board.focus();
}

function cloneTemplateNodeSubtree(sourceId: string, parentId: string): number {
  if (!map) return 0;
  const source = map.state.nodes[sourceId];
  if (!source) return 0;
  const id = newId();
  map.state.nodes[id] = {
    ...source,
    id,
    parentId,
    children: [],
    scopeId: undefined,
  };
  const parent = map.state.nodes[parentId];
  parent.children.push(id);
  let added = 1;
  for (const childId of source.children || []) {
    added += cloneTemplateNodeSubtree(childId, id);
  }
  return added;
}

function applyTemplateToActiveNode(templateId: string): { added: number; skipped: number; label: string } {
  if (!map || !viewState.selectedNodeId) {
    throw new Error("Select a node first.");
  }
  const template = map.state.nodes[templateId];
  if (!template) {
    throw new Error("Template not found.");
  }
  if ((template.children || []).length === 0) {
    return { added: 0, skipped: 0, label: template.text || "(untitled)" };
  }

  const target = getNode(viewState.selectedNodeId);
  if (isAliasNode(target)) {
    throw new Error("Alias nodes cannot own template children.");
  }
  const existingLabels = new Set(
    (target.children || [])
      .map((childId) => map!.state.nodes[childId]?.text?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value)),
  );

  pushUndoSnapshot();
  let added = 0;
  let skipped = 0;
  for (const childId of template.children || []) {
    const child = map.state.nodes[childId];
    const key = child?.text?.trim().toLowerCase();
    if (!child || !key || existingLabels.has(key)) {
      skipped += 1;
      continue;
    }
    added += cloneTemplateNodeSubtree(childId, target.id);
    existingLabels.add(key);
  }

  if (added > 0) {
    viewState.collapsedIds.delete(target.id);
    target.collapsed = false;
    touchDocument();
    render();
  } else {
    undoStack.pop();
  }
  return { added, skipped, label: template.text || "(untitled)" };
}

function applySelectedTemplateCompletion(): void {
  const state = templateCompletionState;
  if (!state) return;
  const selected = state.filtered[state.selectedIndex];
  if (!selected) {
    setStatus("No template selected.", true);
    return;
  }
  try {
    const result = applyTemplateToActiveNode(selected.id);
    hideTemplateCompletion();
    if (result.added === 0) {
      setStatus(`Template has no new children: ${result.label}`, true);
      return;
    }
    setStatus(`Template applied: ${result.label} (${result.added} node(s), ${result.skipped} skipped)`);
  } catch (err) {
    hideTemplateCompletion();
    setStatus(`Template apply failed: ${(err as Error).message}`, true);
  }
}

function showTemplateCompletion(): void {
  hideTemplateCompletion();
  if (!map || !viewState.selectedNodeId) {
    setStatus("Select a node first.", true);
    return;
  }
  const candidates = collectTemplateCandidates();
  if (candidates.length === 0) {
    setStatus("No templates found at SYSTEM > TEMPLATE > cache.", true);
    return;
  }

  const root = document.createElement("div");
  root.className = "template-completion-popover";
  const placement = templateCompletionPlacement(viewState.selectedNodeId);
  root.style.left = `${placement.left}px`;
  root.style.top = `${placement.top}px`;
  root.innerHTML = `
    <input class="template-completion-input" type="text" autocomplete="off" spellcheck="false" placeholder="Template..." />
    <div class="template-completion-list" role="listbox"></div>
    <div class="template-completion-detail"></div>
  `;
  const input = root.querySelector<HTMLInputElement>(".template-completion-input")!;
  const list = root.querySelector<HTMLElement>(".template-completion-list")!;
  const detail = root.querySelector<HTMLElement>(".template-completion-detail")!;
  const closeHandler = (event: MouseEvent) => {
    if (!root.contains(event.target as Node)) {
      hideTemplateCompletion();
    }
  };

  root.addEventListener("mousedown", (event) => event.stopPropagation());
  root.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("input", () => {
    const state = templateCompletionState;
    if (!state) return;
    state.selectedIndex = 0;
    renderTemplateCompletion();
  });
  input.addEventListener("keydown", (event) => {
    if (isImeComposingEvent(event)) return;
    const state = templateCompletionState;
    if (!state) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      hideTemplateCompletion();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      state.selectedIndex = Math.min(state.filtered.length - 1, state.selectedIndex + 1);
      renderTemplateCompletion();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      state.selectedIndex = Math.max(0, state.selectedIndex - 1);
      renderTemplateCompletion();
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      applySelectedTemplateCompletion();
      return;
    }
    event.stopPropagation();
  });

  document.body.appendChild(root);
  templateCompletionState = {
    root,
    input,
    list,
    detail,
    anchorNodeId: viewState.selectedNodeId,
    candidates,
    filtered: candidates,
    selectedIndex: 0,
    closeHandler,
  };
  renderTemplateCompletion();
  setTimeout(() => document.addEventListener("mousedown", closeHandler, true), 0);
  input.focus();
  input.select();
}

// ---- Broken Alias Detection ----

function findBrokenAliases(): { nodeId: string; label: string; targetNodeId: string }[] {
  if (!map) {
    return [];
  }
  const result: { nodeId: string; label: string; targetNodeId: string }[] = [];
  for (const node of Object.values(map.state.nodes)) {
    if (node.nodeType !== "alias") {
      continue;
    }
    if (!node.targetNodeId || !map.state.nodes[node.targetNodeId]) {
      result.push({
        nodeId: node.id,
        label: uiLabel(node),
        targetNodeId: node.targetNodeId || "",
      });
    }
  }
  return result;
}

function deleteBrokenAlias(aliasNodeId: string): void {
  if (!map) {
    return;
  }
  const node = map.state.nodes[aliasNodeId];
  if (!node) {
    return;
  }
  pushUndoSnapshot();
  const parentId = node.parentId;
  if (parentId && map.state.nodes[parentId]) {
    map.state.nodes[parentId].children = map.state.nodes[parentId].children.filter((c) => c !== aliasNodeId);
  }
  delete map.state.nodes[aliasNodeId];
  if (viewState.selectedNodeId === aliasNodeId) {
    viewState.selectedNodeId = parentId || map.state.rootId;
    viewState.selectedNodeIds = new Set([viewState.selectedNodeId]);
  }
  viewState.selectedNodeIds.delete(aliasNodeId);
  setStatus(`Deleted broken alias.`);
  scheduleAutosave();
  render();
  if (entityListVisible) {
    buildEntityList(entityListSearchEl?.value.trim() || "");
  }
}

function repairBrokenAlias(aliasNodeId: string): void {
  if (!map) {
    return;
  }
  const node = map.state.nodes[aliasNodeId];
  if (!node || node.nodeType !== "alias") {
    return;
  }
  // Convert broken alias to a regular text node, keeping the snapshot label
  pushUndoSnapshot();
  node.nodeType = "text";
  node.isBroken = undefined;
  node.targetNodeId = undefined;
  node.aliasLabel = undefined;
  node.access = undefined;
  node.targetSnapshotLabel = undefined;
  if (!node.text || node.text.endsWith("(deleted)")) {
    node.text = node.targetSnapshotLabel || "Repaired node";
  }
  setStatus(`Repaired alias: converted to text node.`);
  scheduleAutosave();
  render();
  if (entityListVisible) {
    buildEntityList(entityListSearchEl?.value.trim() || "");
  }
}

function toggleSelectedTabularComponent(): void {
  if (!map || !viewState.selectedNodeId) {
    setStatus("Select a node to toggle tabular component.", true);
    return;
  }
  const node = getNode(viewState.selectedNodeId);
  if (isAliasNode(node)) {
    setStatus("Alias nodes cannot own HTML object components.", true);
    return;
  }

  pushUndoSnapshot();
  const attrs = ensureNodeAttributes(node);
  const existing = parseNodeComponent(node);
  if (existing?.kind === "tabular") {
    delete attrs[NODE_COMPONENT_ATTR];
    delete attrs[LEGACY_VIEW_TYPE_ATTR];
    touchDocument();
    setStatus("Tabular component removed.");
    board.focus();
    return;
  }

  attrs[NODE_COMPONENT_ATTR] = serializedTabularComponentSpec();
  delete attrs[LEGACY_VIEW_TYPE_ATTR];
  touchDocument();
  setStatus("Tabular component enabled.");
  board.focus();
}

// ---- Context Menu ----

function showContextMenu(x: number, y: number, items: { label: string; danger?: boolean; action: () => void }[]): void {
  hideContextMenu();
  const menu = document.createElement("div");
  menu.className = "scope-context-menu";
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  for (const item of items) {
    const row = document.createElement("div");
    row.className = "scope-context-menu-item" + (item.danger ? " danger" : "");
    row.textContent = item.label;
    row.addEventListener("click", (e) => {
      e.stopPropagation();
      hideContextMenu();
      item.action();
    });
    menu.appendChild(row);
  }

  document.body.appendChild(menu);
  activeContextMenu = menu;

  // Close on outside click
  const closeHandler = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      hideContextMenu();
      document.removeEventListener("click", closeHandler, true);
    }
  };
  setTimeout(() => document.addEventListener("click", closeHandler, true), 0);
}

function hideContextMenu(): void {
  if (activeContextMenu) {
    activeContextMenu.remove();
    activeContextMenu = null;
  }
}

// ---- Color Palette Popover (Miro-style node decoration) ----

/** Preset swatches: neutral + 4 urgency tints + 4 importance tints + accents. */
const COLOR_PALETTE_SWATCHES: { label: string; color: string }[] = [
  { label: "Clear",          color: "" },             // special: clear fill
  { label: "White",          color: "#ffffff" },
  { label: "Urgent low",     color: "#ffe5b4" },      // light peach
  { label: "Urgent mid",     color: "#ffb074" },
  { label: "Urgent high",    color: "#ff6b4a" },
  { label: "Urgent top",     color: "#ff0000" },
  { label: "Important low",  color: "#e1ecff" },      // light blue
  { label: "Important mid",  color: "#9ec5ff" },
  { label: "Important high", color: "#5a8dff" },
  { label: "Important top",  color: "#0000ff" },
];

let activeColorPalette: HTMLElement | null = null;

/** Update `m3e:style` JSON attribute on a single node. Removes the attribute
 *  entirely when the resulting object is empty. */
function updateStyleJson(
  nodeId: string,
  mutate: (style: Record<string, unknown>) => void,
): boolean {
  if (!map) return false;
  const node = map.state.nodes[nodeId];
  if (!node) return false;
  node.attributes = node.attributes || {};
  const attrs = node.attributes as Record<string, string>;
  let style: Record<string, unknown> = {};
  const raw = attrs["m3e:style"];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") style = parsed as Record<string, unknown>;
    } catch {
      style = {};
    }
  }
  mutate(style);
  const hasKeys = Object.keys(style).length > 0;
  if (hasKeys) {
    attrs["m3e:style"] = JSON.stringify(style);
  } else {
    delete attrs["m3e:style"];
  }
  return true;
}

function applyFillToSelection(color: string | null): void {
  if (!map) return;
  const ids = viewState.selectedNodeIds.size > 0
    ? Array.from(viewState.selectedNodeIds)
    : (viewState.selectedNodeId ? [viewState.selectedNodeId] : []);
  if (ids.length === 0) return;
  let changed = 0;
  for (const id of ids) {
    const ok = updateStyleJson(id, (style) => {
      if (color === null) {
        delete style.fill;
      } else {
        style.fill = color;
      }
    });
    if (ok) changed++;
  }
  if (changed > 0) {
    setStatus(`Color: ${color === null ? "cleared" : color} on ${changed} node${changed === 1 ? "" : "s"}.`);
    touchDocument();
  }
}

function clearDecorationOnSelection(): void {
  if (!map) return;
  const ids = viewState.selectedNodeIds.size > 0
    ? Array.from(viewState.selectedNodeIds)
    : (viewState.selectedNodeId ? [viewState.selectedNodeId] : []);
  if (ids.length === 0) return;
  let changed = 0;
  for (const id of ids) {
    const ok = updateStyleJson(id, (style) => {
      delete style.fill;
      delete style.border;
      delete style.text;
    });
    if (ok) changed++;
  }
  if (changed > 0) {
    setStatus(`Cleared decoration on ${changed} node${changed === 1 ? "" : "s"}.`);
    touchDocument();
  }
}

function editEdgeLabelForSelectedNode(): void {
  if (!map) return;
  const node = getNode(viewState.selectedNodeId);
  if (!node || !node.parentId) {
    setStatus("Select a child node to label its parent edge.", true);
    return;
  }
  const attrs = node.attributes || {};
  const current = attrs["m3e:edge-label"] || "";
  const next = window.prompt("Edge label", current);
  if (next === null) {
    return;
  }
  const trimmed = next.trim();
  if (trimmed === current.trim()) {
    return;
  }
  pushUndoSnapshot();
  node.attributes = node.attributes || {};
  if (trimmed) {
    node.attributes["m3e:edge-label"] = trimmed;
    setStatus(`Edge label: ${trimmed}`);
  } else {
    delete node.attributes["m3e:edge-label"];
    setStatus("Edge label cleared.");
  }
  touchDocument();
  board.focus();
}

function hideColorPalette(): void {
  if (activeColorPalette) {
    activeColorPalette.remove();
    activeColorPalette = null;
  }
}

function showColorPalette(): void {
  hideColorPalette();
  if (!map) return;
  const anchorId = viewState.selectedNodeId;
  if (!anchorId || !lastLayout || !lastLayout.pos[anchorId]) return;

  // Compute screen position near the anchor node.
  const nodePos = lastLayout.pos[anchorId]!;
  const boardRect = board.getBoundingClientRect();
  const screenX = boardRect.left + viewState.cameraX + (nodePos.x + nodePos.w) * viewState.zoom + 8;
  const screenY = boardRect.top + viewState.cameraY + nodePos.y * viewState.zoom;

  const menu = document.createElement("div");
  menu.className = "color-palette-popover";
  menu.style.left = `${Math.max(8, Math.min(window.innerWidth - 220, screenX))}px`;
  menu.style.top = `${Math.max(8, Math.min(window.innerHeight - 80, screenY))}px`;

  for (const swatch of COLOR_PALETTE_SWATCHES) {
    const btn = document.createElement("button");
    btn.className = "color-palette-swatch";
    btn.type = "button";
    btn.title = swatch.label;
    if (swatch.color === "") {
      btn.classList.add("clear");
      btn.textContent = "✕";
    } else {
      btn.style.background = swatch.color;
    }
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      applyFillToSelection(swatch.color === "" ? null : swatch.color);
      hideColorPalette();
    });
    menu.appendChild(btn);
  }

  document.body.appendChild(menu);
  activeColorPalette = menu;

  const closeHandler = (e: MouseEvent) => {
    if (!menu.contains(e.target as Node)) {
      hideColorPalette();
      document.removeEventListener("click", closeHandler, true);
    }
  };
  setTimeout(() => document.addEventListener("click", closeHandler, true), 0);
}

// ---- Conflict Panel ----

function collectFlatNodes(state: AppState, rootId: string): { id: string; text: string; depth: number }[] {
  const result: { id: string; text: string; depth: number }[] = [];
  const stack: { id: string; depth: number }[] = [{ id: rootId, depth: 0 }];
  while (stack.length > 0) {
    const { id, depth } = stack.pop()!;
    const node = state.nodes[id];
    if (!node) {
      continue;
    }
    result.push({ id, text: node.text || "Untitled", depth });
    const children = [...(node.children || [])].reverse();
    for (const childId of children) {
      stack.push({ id: childId, depth: depth + 1 });
    }
  }
  return result;
}

interface ConflictDiffResult {
  localOnly: Set<string>;
  remoteOnly: Set<string>;
  changed: Set<string>;
  addedCount: number;
  removedCount: number;
  changedCount: number;
}

function diffStates(localState: AppState, remoteState: AppState): ConflictDiffResult {
  const localIds = new Set(Object.keys(localState.nodes));
  const remoteIds = new Set(Object.keys(remoteState.nodes));

  const localOnly = new Set<string>();
  const remoteOnly = new Set<string>();
  const changed = new Set<string>();

  for (const id of localIds) {
    if (!remoteIds.has(id)) {
      localOnly.add(id);
    }
  }

  for (const id of remoteIds) {
    if (!localIds.has(id)) {
      remoteOnly.add(id);
    }
  }

  for (const id of localIds) {
    if (remoteIds.has(id)) {
      const localNode = localState.nodes[id];
      const remoteNode = remoteState.nodes[id];
      if (localNode.text !== remoteNode.text ||
          JSON.stringify(localNode.children) !== JSON.stringify(remoteNode.children) ||
          localNode.parentId !== remoteNode.parentId ||
          localNode.nodeType !== remoteNode.nodeType) {
        changed.add(id);
      }
    }
  }

  return {
    localOnly,
    remoteOnly,
    changed,
    addedCount: remoteOnly.size,
    removedCount: localOnly.size,
    changedCount: changed.size,
  };
}

function renderConflictTree(
  container: HTMLElement,
  flatNodes: { id: string; text: string; depth: number }[],
  diffClasses: Map<string, string>,
): void {
  container.innerHTML = "";
  for (const node of flatNodes) {
    const row = document.createElement("div");
    row.className = "conflict-node-row";
    const diffClass = diffClasses.get(node.id);
    if (diffClass) {
      row.classList.add(diffClass);
    }

    const indent = document.createElement("span");
    indent.className = "conflict-node-indent";
    indent.style.width = `${node.depth * 16}px`;

    const text = document.createElement("span");
    text.className = "conflict-node-text";
    text.textContent = node.text;

    row.appendChild(indent);
    row.appendChild(text);
    container.appendChild(row);
  }
}

function showConflictPanel(
  remoteState: AppState,
  options?: {
    localLabel?: string;
    remoteLabel?: string;
    onUseLocal?: () => void;
    onUseRemote?: () => void;
  },
): void {
  if (!conflictPanelEl || !conflictLocalTreeEl || !conflictRemoteTreeEl || !conflictDiffSummaryEl || !map) {
    return;
  }

  conflictRemoteState = remoteState;
  conflictUseLocalAction = options?.onUseLocal ?? null;
  conflictUseRemoteAction = options?.onUseRemote ?? null;
  conflictPanelVisible = true;
  conflictPanelEl.hidden = false;
  if (conflictUseLocalBtn) {
    conflictUseLocalBtn.textContent = options?.localLabel || "Use Local";
  }
  if (conflictUseRemoteBtn) {
    conflictUseRemoteBtn.textContent = options?.remoteLabel || "Use Remote";
  }

  const localState = map.state;
  const diff = diffStates(localState, remoteState);

  // Build diff class maps
  const localDiffClasses = new Map<string, string>();
  const remoteDiffClasses = new Map<string, string>();

  for (const id of diff.localOnly) {
    localDiffClasses.set(id, "diff-removed");
  }
  for (const id of diff.remoteOnly) {
    remoteDiffClasses.set(id, "diff-added");
  }
  for (const id of diff.changed) {
    localDiffClasses.set(id, "diff-changed");
    remoteDiffClasses.set(id, "diff-changed");
  }

  const localFlat = collectFlatNodes(localState, localState.rootId);
  const remoteFlat = collectFlatNodes(remoteState, remoteState.rootId);

  renderConflictTree(conflictLocalTreeEl, localFlat, localDiffClasses);
  renderConflictTree(conflictRemoteTreeEl, remoteFlat, remoteDiffClasses);

  const parts: string[] = [];
  if (diff.addedCount > 0) {
    parts.push(`${diff.addedCount} node(s) added in remote`);
  }
  if (diff.removedCount > 0) {
    parts.push(`${diff.removedCount} node(s) removed in remote`);
  }
  if (diff.changedCount > 0) {
    parts.push(`${diff.changedCount} node(s) modified`);
  }
  if (parts.length === 0) {
    parts.push("No structural differences detected (metadata may differ).");
  }
  conflictDiffSummaryEl.textContent = parts.join(" | ");
}

function hideConflictPanel(): void {
  if (!conflictPanelEl) {
    return;
  }
  conflictPanelVisible = false;
  conflictPanelEl.hidden = true;
  conflictRemoteState = null;
  conflictUseLocalAction = null;
  conflictUseRemoteAction = null;
  if (conflictUseLocalBtn) {
    conflictUseLocalBtn.textContent = "Use Local";
  }
  if (conflictUseRemoteBtn) {
    conflictUseRemoteBtn.textContent = "Use Remote";
  }
  board.focus();
}

if (conflictCloseBtn) {
  conflictCloseBtn.addEventListener("click", () => {
    hideConflictPanel();
  });
}

if (conflictUseLocalBtn) {
  conflictUseLocalBtn.addEventListener("click", () => {
    const action = conflictUseLocalAction;
    hideConflictPanel();
    if (action) {
      action();
      return;
    }
    void pushDocToCloud(true, true);
  });
}

if (conflictUseRemoteBtn) {
  conflictUseRemoteBtn.addEventListener("click", () => {
    const action = conflictUseRemoteAction;
    if (action) {
      hideConflictPanel();
      action();
      return;
    }
    if (conflictRemoteState && map) {
      hideConflictPanel();
      void pullDocFromCloud(true);
    }
  });
}

function addChild(): void {
  const parentId = viewState.selectedNodeId;
  const parent = getNode(parentId);
  if (isAliasNode(parent)) {
    setStatus("Alias nodes cannot own children.", true);
    return;
  }
  pushUndoSnapshot();
  const id = newId();
  map!.state.nodes[id] = createNodeRecord(id, parentId, "New Node");
  parent.children.push(id);
  viewState.collapsedIds.delete(parentId);
  parent.collapsed = false;
  setSingleSelection(id, false);
  touchDocument();
  nudgeActiveNodeIntoView({ animate: false });
  board.focus();
}

function addSibling(): void {
  const node = getNode(viewState.selectedNodeId);
  if (node.parentId === null) {
    addChild();
    return;
  }
  const parent = getNode(node.parentId);
  pushUndoSnapshot();
  const currentIndex = parent.children.indexOf(node.id);
  const id = newId();
  map!.state.nodes[id] = createNodeRecord(id, parent.id, "New Sibling");
  parent.children.splice(currentIndex + 1, 0, id);
  setSingleSelection(id, false);
  touchDocument();
  nudgeActiveNodeIntoView({ animate: false });
  board.focus();
}

function selectedLinkableNode(): TreeNode | null {
  if (!map || !viewState.selectedNodeId) {
    return null;
  }
  const node = map.state.nodes[viewState.selectedNodeId];
  if (!node || isAliasNode(node)) {
    return null;
  }
  return node;
}

function findExistingGraphLink(sourceNodeId: string, targetNodeId: string): GraphLink | null {
  if (!map) {
    return null;
  }
  const links = Object.values(map.state.links || {});
  return links.find((link) => link.sourceNodeId === sourceNodeId && link.targetNodeId === targetNodeId) || null;
}

function markLinkSource(): void {
  if (!map) {
    return;
  }
  const node = selectedLinkableNode();
  if (!node) {
    setStatus("Select a non-alias node to mark link source.", true);
    return;
  }
  if (viewState.linkSourceNodeId === node.id) {
    viewState.linkSourceNodeId = "";
    setStatus("Link source mark cleared.");
    scheduleRender();
    return;
  }
  viewState.linkSourceNodeId = node.id;
  setStatus(`Marked link source: ${uiLabel(node)}`);
  scheduleRender();
}

function applyMarkedLink(): void {
  if (!map) {
    return;
  }
  const sourceId = viewState.linkSourceNodeId;
  if (!sourceId) {
    setStatus("No link source marked.", true);
    return;
  }
  const source = map.state.nodes[sourceId];
  const target = selectedLinkableNode();
  if (!source || !target) {
    setStatus("Select a non-alias target node.", true);
    return;
  }
  if (isAliasNode(source)) {
    setStatus("Alias nodes cannot be graph link endpoints.", true);
    return;
  }
  if (source.id === target.id) {
    setStatus("Graph links cannot connect a node to itself.", true);
    return;
  }
  if (findExistingGraphLink(source.id, target.id)) {
    setStatus("That link already exists.");
    return;
  }

  pushUndoSnapshot();
  const linkId = newId();
  if (!map.state.links) {
    map.state.links = {};
  }
  map.state.links[linkId] = normalizeGraphLink({
    id: linkId,
    sourceNodeId: source.id,
    targetNodeId: target.id,
    direction: "forward",
    style: "default",
  });
  viewState.linkSourceNodeId = "";
  touchDocument();
  setStatus(`Linked ${uiLabel(source)} -> ${uiLabel(target)}.`);
  board.focus();
}

function createGraphLinkBetween(sourceId: string, targetId: string): boolean {
  if (!map) return false;
  const source = map.state.nodes[sourceId];
  const target = map.state.nodes[targetId];
  if (!source || !target || isAliasNode(source) || isAliasNode(target)) {
    setStatus("Edge endpoints must be non-alias nodes.", true);
    return false;
  }
  if (sourceId === targetId) {
    setStatus("Edges cannot connect a node to itself.", true);
    return false;
  }
  if (findExistingGraphLink(sourceId, targetId)) {
    setStatus("That edge already exists.");
    return false;
  }
  pushUndoSnapshot();
  const linkId = newId();
  if (!map.state.links) {
    map.state.links = {};
  }
  map.state.links[linkId] = normalizeGraphLink({
    id: linkId,
    sourceNodeId: sourceId,
    targetNodeId: targetId,
    direction: "forward",
    style: "default",
  });
  touchDocument();
  setStatus(`Edge added: ${uiLabel(source)} -> ${uiLabel(target)}.`);
  return true;
}

function addScatterNodeAt(clientX: number, clientY: number): void {
  if (!map || !currentSurfaceIsScatterMode()) {
    return;
  }
  syncMapModelStateFromRuntime();
  const parentId = currentScopeRootId();
  const parent = map.state.nodes[parentId];
  if (!parent || isAliasNode(parent)) {
    setStatus("Current scope cannot own new nodes.", true);
    return;
  }
  const point = clientToCanvasPoint(clientX, clientY);
  pushUndoSnapshot();
  const id = newId();
  map.state.nodes[id] = createNodeRecord(id, parentId, "New Node");
  parent.children.push(id);
  viewState.collapsedIds.delete(parentId);
  parent.collapsed = false;
  const view = ensureSurfaceNodeView(id);
  if (view) {
    view.x = Math.round(point.x);
    view.y = Math.round(point.y);
  }
  setSingleSelection(id, false);
  touchDocument();
  setStatus("Scatter node added.");
  board.focus();
}

function deleteScatterEdge(linkId: string): void {
  if (!map?.state.links?.[linkId]) {
    return;
  }
  pushUndoSnapshot();
  delete map.state.links[linkId];
  touchDocument();
  setStatus("Edge deleted.");
}

function colorizeScatterEdge(linkId: string): void {
  if (!map?.state.links?.[linkId]) {
    return;
  }
  pushUndoSnapshot();
  map.state.links[linkId] = normalizeGraphLink({
    ...map.state.links[linkId]!,
    color: SCATTER_DEFAULT_EDGE_COLOR,
  });
  touchDocument();
  setStatus("Edge color updated.");
}

function setGraphLinkEndpointPort(linkId: string, endpoint: LinkEndpointKind, side: EdgeAnchorSide, withUndo = true): boolean {
  if (!map?.state.links?.[linkId]) {
    return false;
  }
  if (withUndo) {
    pushUndoSnapshot();
  }
  const current = normalizeGraphLink(map.state.links[linkId]!);
  map.state.links[linkId] = normalizeGraphLink({
    ...current,
    sourcePort: endpoint === "source" ? side : current.sourcePort,
    targetPort: endpoint === "target" ? side : current.targetPort,
  });
  viewState.selectedLinkId = linkId;
  selectedGraphLinkId = linkId;
  scheduleRender();
  return true;
}

function setGraphLinkEndpointPortNearPointer(linkId: string, endpoint: LinkEndpointKind, clientX: number, clientY: number): boolean {
  const link = map?.state.links?.[linkId];
  if (!map || !link || !lastLayout) {
    return false;
  }
  const nodeId = endpoint === "source" ? link.sourceNodeId : link.targetNodeId;
  const renderNodeId = currentSurfaceIsFlowMode() ? (representativeNodeIdInCurrentScope(nodeId) || nodeId) : nodeId;
  const pos = lastLayout.pos[renderNodeId];
  if (!pos) {
    return false;
  }
  const point = clientToCanvasPoint(clientX, clientY);
  const linkBoundsMode: LinkConnectionBoundsMode = structuredSurfaceMode() === "mindmap" ? "mindmap" : "box";
  const side = nearestEdgePortSide(linkConnectionRect(pos, linkBoundsMode), point);
  return setGraphLinkEndpointPort(linkId, endpoint, side, false);
}

function scatterDragStartViews(nodeIds: string[]): Record<string, { x: number; y: number }> {
  const starts: Record<string, { x: number; y: number }> = {};
  nodeIds.forEach((nodeId) => {
    const p = lastLayout?.pos[nodeId];
    if (p) {
      starts[nodeId] = { x: p.x, y: p.y };
    }
  });
  return starts;
}

function deleteSelectedGraphLink(): boolean {
  if (!map || !viewState.selectedLinkId) {
    return false;
  }
  const link = map.state.links?.[viewState.selectedLinkId];
  if (!link) {
    viewState.selectedLinkId = "";
    return false;
  }
  const source = map.state.nodes[link.sourceNodeId];
  const target = map.state.nodes[link.targetNodeId];
  pushUndoSnapshot();
  delete map.state.links![link.id];
  viewState.selectedLinkId = "";
  selectedGraphLinkId = null;
  touchDocument();
  flushAutosaveNow();
  setStatus(`Deleted link: ${source ? uiLabel(source) : link.sourceNodeId} -> ${target ? uiLabel(target) : link.targetNodeId}.`);
  return true;
}

function deleteGraphLinksForNode(nodeId: string): void {
  if (!map?.state.links) {
    return;
  }
  Object.entries(map.state.links).forEach(([linkId, link]) => {
    if (link.sourceNodeId === nodeId || link.targetNodeId === nodeId) {
      delete map!.state.links![linkId];
    }
  });
}

function cycleSelectedGraphLinkPort(endpoint: "source" | "target"): boolean {
  if (!map || !viewState.selectedLinkId) {
    return false;
  }
  const link = map.state.links?.[viewState.selectedLinkId];
  if (!link) {
    viewState.selectedLinkId = "";
    return false;
  }
  const normalized = normalizeGraphLink(link);
  const key = endpoint === "source" ? "sourcePort" : "targetPort";
  const ports: EdgeAnchorSide[] = ["right", "bottom", "left", "top"];
  const current = sanitizeLinkPort(normalized[key]);
  const next = ports[((current ? ports.indexOf(current) : -1) + 1) % ports.length] || "right";
  pushUndoSnapshot();
  link[key] = next;
  selectedGraphLinkId = link.id;
  touchDocument();
  setStatus(`${endpoint === "source" ? "Source" : "Target"} port: ${next}`);
  return true;
}

function applyNodeTextEdit(nodeId: string, nextRaw: string, mode: "node-text" | "alias-label" | "target-text" = "node-text"): boolean {
  const node = getNode(nodeId);
  const viewportCenterBefore = nodeViewportCenter(nodeId);
  const next = String(nextRaw || "").trim();
  if (next === "") {
    setStatus("Node text cannot be empty.", true);
    return false;
  }
  if (isAliasNode(node)) {
    if (mode === "target-text") {
      const target = resolveAliasTarget(node);
      if (!target || isBrokenAlias(node)) {
        setStatus("Broken alias cannot edit target text.", true);
        return false;
      }
      if (target.text === next) {
        return true;
      }
      pushUndoSnapshot();
      latexMetricsCache.delete(target.text);
      latexHtmlCache.delete(target.text);
      target.text = next;
      syncAliasDisplayForTarget(target.id);
      touchDocument();
      preserveNodeViewportCenter(nodeId, viewportCenterBefore);
      return true;
    }
    if ((node.aliasLabel || node.text) === next) {
      return true;
    }
    pushUndoSnapshot();
    node.aliasLabel = next;
    node.text = next;
    touchDocument();
    preserveNodeViewportCenter(nodeId, viewportCenterBefore);
    return true;
  }
  if (node.text === next) {
    return true;
  }
  pushUndoSnapshot();
  latexMetricsCache.delete(node.text);
  latexHtmlCache.delete(node.text);
  node.text = next;
  syncAliasDisplayForTarget(node.id);
  touchDocument();
  preserveNodeViewportCenter(nodeId, viewportCenterBefore);
  return true;
}

function stopInlineEdit(commit: boolean, options?: { focusBoard?: boolean }): void {
  if (!inlineEditor) {
    return;
  }

  const { nodeId, input, mode } = inlineEditor;
  const next = input.value;
  setEditedSvgLabelVisibility(nodeId, true);
  input.remove();
  inlineEditor = null;

  if (commit) {
    applyNodeTextEdit(nodeId, next, mode);
  }

  if (options?.focusBoard !== false) {
    board.focus();
  }
}

function applyIncomingEdgeLabelEdit(nodeId: string, nextRaw: string): boolean {
  if (!map) {
    return false;
  }
  const node = getNode(nodeId);
  if (!node.parentId) {
    setStatus("Root has no incoming edge label.", true);
    return false;
  }
  const next = String(nextRaw || "").trim();
  const current = (node.attributes?.["m3e:edge-label"] || "").trim();
  if (current === next) {
    return true;
  }
  pushUndoSnapshot();
  node.attributes = node.attributes || {};
  if (next) {
    node.attributes["m3e:edge-label"] = next;
  } else {
    delete node.attributes["m3e:edge-label"];
  }
  touchDocument();
  setStatus(next ? "Edge label updated." : "Edge label cleared.");
  return true;
}

function stopInlineEdgeLabelEdit(commit: boolean, options?: { focusBoard?: boolean }): void {
  if (!inlineEdgeLabelEditor) {
    return;
  }
  const { nodeId, input } = inlineEdgeLabelEditor;
  const next = input.value;
  setEditedEdgeLabelVisibility(nodeId, true);
  input.remove();
  inlineEdgeLabelEditor = null;
  if (commit) {
    applyIncomingEdgeLabelEdit(nodeId, next);
  }
  if (options?.focusBoard !== false) {
    board.focus();
  }
}

function startIncomingEdgeLabelEdit(nodeId = viewState.selectedNodeId): void {
  if (!map || !lastLayout) {
    return;
  }
  const node = getNode(nodeId);
  if (!node.parentId) {
    setStatus("Root has no incoming edge label.", true);
    return;
  }
  if (!incomingTreeEdgeLabelLayout(nodeId)) {
    return;
  }
  if (inlineEditor) {
    stopInlineEdit(true, { focusBoard: false });
  }
  if (inlineEdgeLabelEditor) {
    stopInlineEdgeLabelEdit(true, { focusBoard: false });
  }
  const input = document.createElement("textarea");
  input.rows = 1;
  input.value = (node.attributes?.["m3e:edge-label"] || "").trim();
  input.className = "inline-edge-label-editor";
  input.setAttribute("aria-label", "Edit incoming edge label");
  input.placeholder = "edge label";
  board.appendChild(input);
  inlineEdgeLabelEditor = { nodeId, input };
  syncInlineEdgeLabelEditorPosition();
  autoSizeInlineEdgeLabelEditor(input);
  input.focus();
  input.select();

  input.addEventListener("keydown", (event: KeyboardEvent) => {
    if (isImeComposingEvent(event)) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      stopInlineEdgeLabelEdit(true);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      stopInlineEdgeLabelEdit(false);
    }
  });
  input.addEventListener("blur", () => {
    stopInlineEdgeLabelEdit(true);
  });
  input.addEventListener("input", () => {
    autoSizeInlineEdgeLabelEditor(input);
  });
}

function createNodeByDirectionAndEdit(direction: "breadth" | "depth"): void {
  if (!map) {
    return;
  }
  if (direction === "depth") {
    addChild();
  } else {
    addSibling();
  }
  startInlineEdit(viewState.selectedNodeId, { nudgeIntoView: false });
}

function autoSizeInlineEditor(input: HTMLTextAreaElement): void {
  input.style.height = "auto";
  input.style.height = `${Math.max(44, input.scrollHeight)}px`;
}

function autoSizeInlineEdgeLabelEditor(input: HTMLTextAreaElement): void {
  input.style.height = "auto";
  input.style.height = `${Math.max(16, input.scrollHeight)}px`;
}

function startInlineEdit(nodeId: string, options?: { selectAll?: boolean; nudgeIntoView?: boolean }): void {
  if (!map || !lastLayout || !lastLayout.pos[nodeId]) {
    return;
  }

  if (inlineEdgeLabelEditor) {
    stopInlineEdgeLabelEdit(true, { focusBoard: false });
  }
  if (inlineEditor) {
    stopInlineEdit(true);
  }

  const node = getNode(nodeId);
  const mode = isAliasNode(node)
    ? ((isBrokenAlias(node) || aliasAccess(node) === "read") ? "alias-label" : "target-text")
    : "node-text";
  const input = document.createElement("textarea");
  input.rows = 1;
  input.value = mode === "target-text" ? (resolveAliasTarget(node)?.text || node.text || "") : uiLabel(node);
  input.className = "inline-node-editor";
  input.setAttribute("aria-label", mode === "target-text" ? "Edit target node text" : "Edit node label");
  board.appendChild(input);

  inlineEditor = { nodeId, input, mode };
  syncInlineEditorPosition();
  autoSizeInlineEditor(input);
  if (options?.nudgeIntoView !== false) {
    nudgeNodeIntoView(nodeId);
  }
  input.focus();
  if (options?.selectAll ?? true) {
    input.select();
  } else {
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }

  input.addEventListener("keydown", (event: KeyboardEvent) => {
    if (isImeComposingEvent(event)) {
      return;
    }
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key === "Enter") {
      event.preventDefault();
      // Equivalent to Esc -> DownArrow -> Enter while editing.
      stopInlineEdit(false, { focusBoard: false });
      selectBreadth(1);
      startInlineEdit(viewState.selectedNodeId, { selectAll: false });
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      stopInlineEdit(true, { focusBoard: false });
      createNodeByDirectionAndEdit("depth");
      return;
    }

    if (event.key === "Enter") {
      if (event.shiftKey) {
        // Keep default textarea behavior: Shift+Enter inserts a newline.
        return;
      }
      event.preventDefault();
      suppressInlineBlurCommit = true;
      stopInlineEdit(true, { focusBoard: false });
      createNodeByDirectionAndEdit("breadth");
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      stopInlineEdit(false);
    }
  });

  input.addEventListener("blur", () => {
    if (suppressInlineBlurCommit) {
      suppressInlineBlurCommit = false;
      return;
    }
    stopInlineEdit(true);
  });

  input.addEventListener("input", () => {
    autoSizeInlineEditor(input);
  });
}

function nodeDepth(nodeId: string): number {
  if (!map) {
    return 0;
  }
  const stateNodes = map.state.nodes;
  let depth = 0;
  let cursor: string | null = nodeId;
  while (cursor) {
    const node: TreeNode | undefined = stateNodes[cursor];
    if (!node) {
      break;
    }
    cursor = node.parentId;
    if (cursor) {
      depth += 1;
    }
  }
  return depth;
}

function getSelectionRoots(selectedIds = viewState.selectedNodeIds): string[] {
  if (!map) {
    return [];
  }
  const selectedSet = new Set<string>(Array.from(selectedIds).filter((nodeId) => Boolean(map!.state.nodes[nodeId])));
  return Array.from(selectedSet).filter((nodeId) => {
    const parentId = map!.state.nodes[nodeId]?.parentId ?? null;
    return !parentId || !selectedSet.has(parentId);
  });
}

function getMovableSelectionRoots(selectedIds = viewState.selectedNodeIds): string[] {
  if (!map) {
    return [];
  }
  const movableIds = new Set<string>();
  selectedIds.forEach((nodeId) => {
    const node = map!.state.nodes[nodeId];
    if (node && node.parentId !== null) {
      movableIds.add(nodeId);
    }
  });
  return getSelectionRoots(movableIds);
}

function deleteSelected(): void {
  if (deleteSelectedGraphLink()) {
    return;
  }
  const roots = getSelectionRoots();
  if (roots.length === 0) {
    return;
  }

  const deletableRoots = roots.filter((rootId) => getNode(rootId).parentId !== null);
  if (deletableRoots.length === 0) {
    setStatus("Root node cannot be deleted.", true);
    return;
  }

  const firstRootParentId = getNode(deletableRoots[0]!).parentId;
  const sortedRoots = [...deletableRoots].sort((a, b) => nodeDepth(b) - nodeDepth(a));
  pushUndoSnapshot();

  sortedRoots.forEach((rootId) => {
    const rootNode = map!.state.nodes[rootId];
    if (!rootNode || rootNode.parentId === null) {
      return;
    }
    const parent = getNode(rootNode.parentId);
    parent.children = parent.children.filter((id) => id !== rootId);
    const stack: string[] = [rootId];
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      const current = map!.state.nodes[currentId];
      if (!current) {
        continue;
      }
      if (!isAliasNode(current)) {
        markAliasesBrokenInViewer(currentId, uiLabel(current));
      }
      deleteGraphLinksForNode(currentId);
      stack.push(...(current.children || []));
      viewState.reparentSourceIds.delete(currentId);
      delete map!.state.nodes[currentId];
    }
  });

  let cursor: string | null = firstRootParentId ?? map!.state.rootId;
  while (cursor && !map!.state.nodes[cursor]) {
    cursor = cursor === map!.state.rootId ? null : (map!.state.nodes[cursor]?.parentId ?? null);
  }
  setSingleSelection(cursor || map!.state.rootId, false);

  if (!map!.state.nodes[viewState.currentScopeId]) {
    viewState.currentScopeId = viewState.selectedNodeId;
  }
  if (!map!.state.nodes[viewState.currentScopeRootId]) {
    viewState.currentScopeRootId = viewState.currentScopeId;
  }
  touchDocument();
  flushAutosaveNow();
}

function toggleCollapse(): void {
  const targetIds = Array.from(viewState.selectedNodeIds);
  const collapsibleIds = targetIds.filter((nodeId) => {
    const node = getNode(nodeId);
    return (node.children || []).length > 0;
  });
  if (collapsibleIds.length === 0) {
    return;
  }

  const shouldExpand = collapsibleIds.every((nodeId) => viewState.collapsedIds.has(nodeId));
  collapsibleIds.forEach((nodeId) => {
    const node = getNode(nodeId);
    if (shouldExpand) {
      viewState.collapsedIds.delete(nodeId);
      node.collapsed = false;
    } else {
      viewState.collapsedIds.add(nodeId);
      node.collapsed = true;
    }
  });
  touchDocument();
}

function downloadJson(): void {
  const blob = new Blob([JSON.stringify({ version: map!.version, savedAt: nowIso(), state: map!.state }, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "rapid-edited.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function currentDocSnapshot(): SavedMap {
  syncLinearNotesToDocState();
  syncMapModelStateFromRuntime();
  return {
    version: 1,
    savedAt: nowIso(),
    state: map!.state,
  };
}

function cloneStateForSave(state: AppState | null): AppState | null {
  return state ? JSON.parse(JSON.stringify(state)) as AppState : null;
}

async function saveDocToLocalDb(showStatus = false, force = false): Promise<boolean> {
  if (!map) {
    return false;
  }
  if (isReadOnlyLink()) {
    if (showStatus) {
      setStatus("Read-only link. Local save is disabled.", true);
    }
    return false;
  }

  if (collabEntityId && collabToken && !force) {
    return await pushCurrentScopeToCollab(showStatus);
  }

  try {
    const response = await fetch(`/api/maps/${encodeURIComponent(LOCAL_MAP_ID)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-M3E-Tab-Id": TAB_ID,
      },
      body: JSON.stringify({
        ...currentDocSnapshot(),
        baseSavedAt: lastServerSavedAt,
        baseState: cloneStateForSave(lastServerBaseState),
        force,
      }),
    });

    if (response.status === 409) {
      const conflict = await response.json().catch(() => ({ error: "Map conflict." }));
      const remoteState = (conflict as { state?: AppState }).state;
      const conflictCode = String((conflict as { code?: unknown }).code || "");
      const isQuestionConflict = conflictCode === "DOC_NODE_CONFLICT_Q";
      if (remoteState) {
        showConflictPanel(remoteState, {
          localLabel: "Use Local",
          remoteLabel: isQuestionConflict ? "Use Current" : "Use Vault",
          onUseLocal: () => {
            void saveDocToLocalDb(showStatus, true);
          },
          onUseRemote: () => {
            if (!map) {
              return;
            }
            const savedAt = typeof (conflict as { savedAt?: unknown }).savedAt === "string"
              ? String((conflict as { savedAt?: string }).savedAt)
              : nowIso();
            loadPayload({
              version: 1,
              savedAt,
              state: remoteState,
            });
            setStatus("Loaded vault version. Local changes were kept out of the database.", true);
          },
        });
      }
      setStatus(
        isQuestionConflict
          ? "Q conflict: same node changed differently. Choose a result."
          : "Vault conflict detected. Choose Use Local or Use Vault.",
        true,
      );
      throw new Error(String((conflict as { error?: string }).error || "Map changed externally."));
    }

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(String(errorPayload.error || `HTTP ${response.status}`));
    }

    const payload = await response.json().catch(() => ({ savedAt: nowIso() }));
    map.savedAt = String(payload.savedAt || nowIso());
    if (typeof payload.mapVersion === "number") {
      (map as SavedMap & { mapVersion?: number }).mapVersion = Number(payload.mapVersion);
    }
    lastServerSavedAt = map.savedAt;
    lastServerBaseState = cloneStateForSave(map.state);
    broadcastState();
    if (collabEntityId && collabToken) {
      void pushCurrentScopeToCollab(false);
    }
    if (cloudSyncEnabled) {
      void pushDocToCloud(false);
    }
    if (showStatus) {
      setStatus("Saved locally.");
    }
    scheduleRender();
    return true;
  } catch (err) {
    if (showStatus) {
      setStatus(`Local save failed (${(err as Error).message}).`, true);
    }
    return false;
  }
}

async function fetchCloudSyncStatus(): Promise<void> {
  try {
    const response = await fetch(`/api/sync/status/${encodeURIComponent(CLOUD_MAP_ID)}`, { cache: "no-store" });
    if (!response.ok) {
      cloudSyncEnabled = false;
      cloudSyncExists = false;
      cloudSavedAt = null;
      updateCloudSyncUi();
      return;
    }
    const payload = await response.json().catch(() => ({ enabled: false, exists: false, cloudSavedAt: null }));
    cloudSyncEnabled = Boolean(payload.enabled);
    cloudSyncExists = Boolean(payload.exists);
    cloudSavedAt = payload.cloudSavedAt ? String(payload.cloudSavedAt) : null;
    cloudConflictPending = false;
    updateCloudSyncUi();
  } catch {
    cloudSyncEnabled = false;
    cloudSyncExists = false;
    cloudSavedAt = null;
    cloudConflictPending = false;
    updateCloudSyncUi();
  }
}

async function pushDocToCloud(showStatus = false, force = false): Promise<boolean> {
  if (!map || !cloudSyncEnabled) {
    return false;
  }
  if (isReadOnlyLink()) {
    if (showStatus) {
      setStatus("Read-only link. Cloud push is disabled.", true);
    }
    return false;
  }
  try {
    const baseSavedAt = cloudSavedAt;
    const response = await fetch(`/api/sync/push/${encodeURIComponent(CLOUD_MAP_ID)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        ...currentDocSnapshot(),
        baseSavedAt,
        force,
      }),
    });

    if (response.status === 409) {
      const conflict = await response.json().catch(() => ({ cloudSavedAt: null }));
      cloudConflictPending = true;
      cloudSavedAt = conflict.cloudSavedAt ? String(conflict.cloudSavedAt) : cloudSavedAt;
      updateCloudSyncUi();
      if (showStatus) {
        setStatus("Cloud conflict detected. Choose Use Local or Use Cloud.", true);
      }
      // Attempt to fetch remote state to populate conflict panel
      try {
        const pullResp = await fetch(`/api/sync/pull/${encodeURIComponent(CLOUD_MAP_ID)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({}),
        });
        if (pullResp.ok) {
          const pullPayload = await pullResp.json();
          if (pullPayload.state) {
            showConflictPanel(pullPayload.state as AppState);
          }
        }
      } catch {
        // Conflict panel will not be shown if remote fetch fails
      }
      return false;
    }

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(String(errorPayload.error || `HTTP ${response.status}`));
    }

    const payload = await response.json().catch(() => ({ savedAt: nowIso() }));
    map.savedAt = String(payload.savedAt || nowIso());
    cloudSavedAt = String(payload.savedAt || nowIso());
    cloudSyncExists = true;
    cloudConflictPending = false;
    updateCloudSyncUi();
    if (showStatus) {
      setStatus(force ? "Cloud sync force-push completed." : "Cloud sync push completed.");
    }
    scheduleRender();
    return true;
  } catch (err) {
    if (showStatus) {
      setStatus(`Cloud push failed (${(err as Error).message}).`, true);
    }
    return false;
  }
}

async function pullDocFromCloud(showStatus = false): Promise<boolean> {
  if (!cloudSyncEnabled) {
    return false;
  }
  try {
    const response = await fetch(`/api/sync/pull/${encodeURIComponent(CLOUD_MAP_ID)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({}),
    });

    if (response.status === 404) {
      cloudSyncExists = false;
      cloudSavedAt = null;
      updateCloudSyncUi();
      return false;
    }

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(String(errorPayload.error || `HTTP ${response.status}`));
    }

    const payload = await response.json();
    loadPayload(payload);
    cloudSyncExists = true;
    cloudSavedAt = payload.savedAt ? String(payload.savedAt) : null;
    cloudConflictPending = false;
    updateCloudSyncUi();
    broadcastState();
    if (showStatus) {
      setStatus("Loaded cloud map.");
    }
    return true;
  } catch (err) {
    if (showStatus) {
      setStatus(`Cloud pull failed (${(err as Error).message}).`, true);
    }
    return false;
  }
}

type LocalMapLoadResult =
  | { ok: true; payload: unknown }
  | { ok: false; reason: "not-found" | "failed"; message: string };

async function fetchLocalMapPayload(): Promise<LocalMapLoadResult> {
  try {
    const response = await fetch(`/api/maps/${encodeURIComponent(LOCAL_MAP_ID)}`, { cache: "no-store" });
    if (response.status === 404) {
      return { ok: false, reason: "not-found", message: `Map not found: ${LOCAL_MAP_ID}` };
    }
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      return { ok: false, reason: "failed", message: String(errorPayload.error || `HTTP ${response.status}`) };
    }
    return { ok: true, payload: await response.json() };
  } catch (err) {
    return { ok: false, reason: "failed", message: (err as Error).message };
  }
}

async function loadDocFromLocalDb(showStatus = false): Promise<boolean> {
  const result = await fetchLocalMapPayload();
  if (!result.ok) {
    if (showStatus) {
      setStatus(`Local load failed (${result.message}).`, true);
    }
    return false;
  }
  try {
    loadPayload(result.payload);
    if (showStatus) {
      setStatus("Loaded local map.");
    }
    return true;
  } catch (err) {
    if (showStatus) {
      setStatus(`Local load failed (${(err as Error).message}).`, true);
    }
    return false;
  }
}

async function loadLinearNotesFromLocalDbFallback(): Promise<void> {
  if (!map || hasLinearNotes(sanitizeLinearNotesByScope(map.state.linearNotesByScope))) {
    return;
  }
  try {
    const response = await fetch(`/api/maps/${encodeURIComponent(LOCAL_MAP_ID)}`, { cache: "no-store" });
    if (response.status === 404 || !response.ok) {
      return;
    }
    const payload = await response.json();
    const candidate = ensureDocShape(payload);
    const fallbackNotes = sanitizeLinearNotesByScope(candidate.state.linearNotesByScope);
    if (!hasLinearNotes(fallbackNotes)) {
      return;
    }
    Object.keys(linearNotesByScope).forEach((scopeId) => {
      delete linearNotesByScope[scopeId];
    });
    Object.assign(linearNotesByScope, fallbackNotes);
    syncLinearNotesToDocState();
    scheduleRender();
  } catch {
    // Fallback load is best-effort. Keep current map as-is when unavailable.
  }
}

function scheduleAutosave(): void {
  if (!map) {
    return;
  }
  if (isReadOnlyLink()) {
    return;
  }
  if (autosaveTimer !== null) {
    clearTimeout(autosaveTimer);
  }
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    void saveDocToLocalDb(false);
  }, AUTOSAVE_DELAY_MS);
}

function flushAutosaveNow(): void {
  if (!map || isReadOnlyLink()) {
    return;
  }
  if (autosaveTimer !== null) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
  void saveDocToLocalDb(false).then((ok) => {
    if (!ok) {
      setStatus("Local save failed after delete.", true);
    }
  });
}

function isValidAppState(s: unknown): s is AppState {
  if (!s || typeof s !== "object") return false;
  const obj = s as Record<string, unknown>;
  return typeof obj.rootId === "string" && !!obj.nodes && typeof obj.nodes === "object";
}

function initBroadcastSync(): void {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    bc = new BroadcastChannel(`m3e-map-${LOCAL_MAP_ID}`);
  } catch {
    return;
  }
  bc.onmessage = (ev: MessageEvent<BcStateMessage>) => {
    if (!map || ev.data.fromTabId === TAB_ID) {
      return;
    }
    if (ev.data.type === "STATE_UPDATE" && isValidAppState(ev.data.state)) {
      map.state = ev.data.state;
      if (typeof ev.data.savedAt === "string" && ev.data.savedAt) {
        // BcStateMessage.savedAt carries the sender's lastServerSavedAt baseline.
        lastServerSavedAt = ev.data.savedAt;
      }
      lastServerBaseState = cloneStateForSave(map.state);
      scheduleRender();
    }
  };
  window.addEventListener("beforeunload", () => bc?.close());
}

function broadcastState(): void {
  if (!bc || !map) {
    return;
  }
  const msg: BcStateMessage = {
    type: "STATE_UPDATE",
    fromTabId: TAB_ID,
    state: map.state,
    savedAt: lastServerSavedAt || "",
  };
  bc.postMessage(msg);
}

// ---------------------------------------------------------------------------
// Map-watch SSE — auto-refresh on external DB changes
// ---------------------------------------------------------------------------

let mapWatchEs: EventSource | null = null;
let lastAppliedSavedAt: string | null = null;

function initDocWatch(): void {
  if (mapWatchEs) return;
  if (document.visibilityState === "hidden") return;
  const url = `/api/maps/${encodeURIComponent(LOCAL_MAP_ID)}/watch`;
  mapWatchEs = new EventSource(url);

  mapWatchEs.addEventListener("map_updated", (ev: MessageEvent) => {
    try {
      const data = JSON.parse(ev.data) as { mapId: string; savedAt: string; sourceTabId: string | null };
      // Ignore our own saves
      if (data.sourceTabId === TAB_ID) return;
      // Advance the conflict-detection baseline even if we skip state overwrite,
      // so a pending autosave doesn't 409 against the just-committed server savedAt.
      if (typeof data.savedAt === "string" && data.savedAt) {
        lastServerSavedAt = data.savedAt;
      }
      // Ignore duplicate events
      if (data.savedAt === lastAppliedSavedAt) return;
      // If user has unsaved edits, notify instead of overwriting
      if (autosaveTimer !== null) {
        setStatus("External update available — save your edits first.", false);
        return;
      }
      void applyExternalUpdate(data.savedAt);
    } catch {
      // ignore malformed events
    }
  });
}

function stopDocWatch(): void {
  if (!mapWatchEs) {
    return;
  }
  mapWatchEs.close();
  mapWatchEs = null;
}

function syncLiveStreamsForVisibility(): void {
  if (document.visibilityState === "hidden") {
    stopDocWatch();
    stopVaultWatchStream();
    return;
  }
  initDocWatch();
  initVaultWatchStream();
}

function initVisibilityManagedLiveStreams(): void {
  if (!liveStreamVisibilityHandlerInstalled) {
    liveStreamVisibilityHandlerInstalled = true;
    document.addEventListener("visibilitychange", syncLiveStreamsForVisibility);
    window.addEventListener("pagehide", () => {
      stopDocWatch();
      stopVaultWatchStream();
    });
    window.addEventListener("beforeunload", () => {
      stopDocWatch();
      stopVaultWatchStream();
    });
  }
  syncLiveStreamsForVisibility();
}

async function applyExternalUpdate(savedAt: string): Promise<void> {
  try {
    const response = await fetch(`/api/maps/${encodeURIComponent(LOCAL_MAP_ID)}`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    const newDoc = ensureDocShape(payload);
    // Only apply if actually newer
    if (map && newDoc.savedAt <= (map.savedAt || "")) return;
    lastAppliedSavedAt = savedAt;

    // Preserve view state
    const prevScopeId = viewState.currentScopeId;
    const prevSelectedId = viewState.selectedNodeId;
    const prevCollapsed = new Set(viewState.collapsedIds);
    const prevScopeHistory = [...viewState.scopeHistory];

    map = newDoc;
    lastServerSavedAt = newDoc.savedAt || lastServerSavedAt;
    lastServerBaseState = cloneStateForSave(newDoc.state);
    hydrateLinearNotesFromDocState();
    hydrateLinearTextFontScaleFromDocState();
    if (map.state.linearPanelWidth != null) {
      linearPanelCanvasWidth = map.state.linearPanelWidth;
    }

    // Restore view state if nodes still exist
    if (map.state.nodes[prevScopeId]) {
      viewState.currentScopeId = prevScopeId;
      viewState.currentScopeRootId = prevScopeId;
      viewState.scopeHistory = prevScopeHistory;
    }
    if (map.state.nodes[prevSelectedId]) {
      viewState.selectedNodeId = prevSelectedId;
      viewState.selectedNodeIds = new Set([prevSelectedId]);
    }
    viewState.collapsedIds = prevCollapsed;

    render();
    setStatus("Map updated externally.");
    broadcastState();
  } catch {
    // will retry on next SSE event
  }
}

// ── Review Mode ──────────────────────────────────────────────

function advanceToNextVisibleNode(): void {
  const sel = viewState.selectedNodeId;
  const idx = visibleOrder.indexOf(sel);
  if (idx < 0 || idx >= visibleOrder.length - 1) return;
  const next = visibleOrder[idx + 1];
  if (next) setSingleSelection(next);
}

function ensureNodeAttributes(node: TreeNode): Record<string, string> {
  node.attributes = node.attributes || {};
  return node.attributes as Record<string, string>;
}

function resolveReviewQuestionNode(node: TreeNode): TreeNode {
  if (!map) return node;
  if (node.attributes?.["runtime:kind"] === "review-question") {
    return node;
  }
  if (node.parentId) {
    const parent = map.state.nodes[node.parentId];
    if (parent?.attributes?.["runtime:kind"] === "review-question") {
      return parent;
    }
  }
  return node;
}

function reviewAccept(): void {
  if (!map) return;
  const sel = viewState.selectedNodeId;
  const node = map.state.nodes[sel];
  if (!node || !node.parentId) { setStatus("Select an option node to accept.", true); return; }
  const parent = map.state.nodes[node.parentId];
  if (!parent) { setStatus("Parent question not found.", true); return; }

  const optionAttrs = ensureNodeAttributes(node);
  optionAttrs["selected"] = "yes";

  for (const childId of parent.children) {
    if (childId === node.id) continue;
    const sibling = map.state.nodes[childId];
    if (!sibling) continue;
    const siblingAttrs = ensureNodeAttributes(sibling);
    delete siblingAttrs["selected"];
  }

  const parentAttrs = ensureNodeAttributes(parent);
  parentAttrs["status"] = "decided";
  parentAttrs["decided"] = nowIso();

  updateStyleJson(parent.id, (s) => {
    s.fill = "#d4edda";
    s.border = "#2d8c4e";
  });
  updateStyleJson(sel, (s) => { s.border = "#2d8c4e"; });
  touchDocument();
  setStatus(`Accepted: ${node.text.substring(0, 40)}`);
  advanceToNextVisibleNode();
}

function reviewReject(): void {
  if (!map) return;
  const sel = viewState.selectedNodeId;
  const node = map.state.nodes[sel];
  if (!node) { setStatus("No node selected.", true); return; }

  const qNode = resolveReviewQuestionNode(node);
  const qAttrs = ensureNodeAttributes(qNode);
  qAttrs["status"] = "rejected";
  qAttrs["decided"] = nowIso();

  for (const childId of qNode.children) {
    const child = map.state.nodes[childId];
    if (!child) continue;
    const childAttrs = ensureNodeAttributes(child);
    delete childAttrs["selected"];
  }

  updateStyleJson(qNode.id, (s) => {
    s.fill = "#f8d7da";
    s.border = "#d94040";
  });
  touchDocument();
  setStatus(`Rejected: ${qNode.text.substring(0, 40)}`);
  advanceToNextVisibleNode();
}

function reviewExplain(): void {
  if (!map) return;
  const sel = viewState.selectedNodeId;
  const node = map.state.nodes[sel];
  if (!node) return;
  const details = node.details || node.note || "(no details)";
  setStatus(details.substring(0, 200));
  viewState.collapsedIds.delete(sel);
  node.collapsed = false;
  render();
}

function updateModeBadge(): void {
  if (!modeBadgeEl) return;
  if (isReadOnlyLink()) {
    modeBadgeEl.textContent = "VIEW";
    modeBadgeEl.classList.remove("review");
    modeBadgeEl.classList.add("readonly");
    return;
  }
  modeBadgeEl.classList.remove("readonly");
  if (viewState.reviewMode) {
    modeBadgeEl.textContent = "REVIEW";
    modeBadgeEl.classList.add("review");
  } else {
    modeBadgeEl.textContent = "EDIT";
    modeBadgeEl.classList.remove("review");
  }
}

function toggleReviewMode(): void {
  viewState.reviewMode = !viewState.reviewMode;
  if (viewState.reviewMode) {
    setStatus("REVIEW MODE — [a]ccept(green) [x]reject(red) [e]xplain [Esc]exit");
  } else {
    setStatus("Review mode off.");
  }
  render();
}

function touchDocument(): void {
  if (!map) {
    return;
  }
  syncMapModelStateFromRuntime();
  map.savedAt = nowIso();
  render();
  scheduleAutosave();
  broadcastState();
}

async function loadDefaultSample(): Promise<void> {
  const response = await fetch("./data/rapid-sample.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = await response.json();
  loadPayload(payload);
}

async function initializeDocument(): Promise<void> {
  await fetchLinearTransformStatus();

  if (LOCAL_FS_VIEW_MODE) {
    await loadLocalFsMap(LOCAL_FS_VIEW_ROOT);
    return;
  }

  const localResult = await fetchLocalMapPayload();
  if (localResult.ok) {
    loadPayload(localResult.payload);
    await fetchCloudSyncStatus();
    if (cloudSyncEnabled && cloudSyncExists) {
      const loadedFromCloud = await pullDocFromCloud(false);
      if (loadedFromCloud) {
        await loadLinearNotesFromLocalDbFallback();
      }
    }
    return;
  }
  if (HAS_EXPLICIT_MAP_ID && localResult.reason === "failed") {
    showFatalLoadError("Map load failed", localResult.message);
    return;
  }

  await fetchCloudSyncStatus();
  if (cloudSyncEnabled && cloudSyncExists) {
    const loadedFromCloud = await pullDocFromCloud(false);
    if (loadedFromCloud) {
      await loadLinearNotesFromLocalDbFallback();
      return;
    }
  }
  if (HAS_EXPLICIT_MAP_ID) {
    showFatalLoadError("Map not found", `The requested map could not be loaded. M3E will not show a sample map in place of an explicit map URL.`);
    return;
  }

  try {
    await loadDefaultSample();
  } catch {
    loadPayload(createEmptyDoc());
  }
}

function selectRelative(offset: number): void {
  if (!visibleOrder.length) {
    return;
  }
  const currentIndex = Math.max(0, visibleOrder.indexOf(viewState.selectedNodeId));
  const nextIndex = Math.min(visibleOrder.length - 1, Math.max(0, currentIndex + offset));
  selectNode(visibleOrder[nextIndex]!);
}

function selectParent(): void {
  if (!map) {
    return;
  }
  const node = getNode(viewState.selectedNodeId);
  if (node.parentId && isNodeInScope(node.parentId)) {
    selectNode(node.parentId);
  }
}

function selectChild(): void {
  if (!map) {
    return;
  }
  const node = getNode(viewState.selectedNodeId);
  const children = visibleChildren(node);
  if (children.length === 0) {
    return;
  }
  selectNode(children[0]!);
}

function getFlowDirectionalTarget(axis: "horizontal" | "vertical", direction: -1 | 1): string | null {
  if (!map || !lastLayout || !visibleOrder.length) {
    return null;
  }
  const currentId = viewState.selectedNodeId;
  const currentPos = lastLayout.pos[currentId];
  if (!currentPos) {
    return null;
  }
  const candidates = visibleOrder
    .filter((id) => id !== currentId)
    .map((id) => ({ id, pos: lastLayout!.pos[id]! }))
    .filter((entry) => Boolean(entry.pos));

  const filtered = candidates.filter((entry) => {
    if (axis === "horizontal") {
      return direction < 0 ? entry.pos.x < currentPos.x : entry.pos.x > currentPos.x;
    }
    return direction < 0 ? entry.pos.y < currentPos.y : entry.pos.y > currentPos.y;
  });
  if (filtered.length === 0) {
    return null;
  }
  filtered.sort((a, b) => {
    const primaryA = axis === "horizontal" ? Math.abs(a.pos.x - currentPos.x) : Math.abs(a.pos.y - currentPos.y);
    const primaryB = axis === "horizontal" ? Math.abs(b.pos.x - currentPos.x) : Math.abs(b.pos.y - currentPos.y);
    if (primaryA !== primaryB) return primaryA - primaryB;
    const secondaryA = axis === "horizontal" ? Math.abs(a.pos.y - currentPos.y) : Math.abs(a.pos.x - currentPos.x);
    const secondaryB = axis === "horizontal" ? Math.abs(b.pos.y - currentPos.y) : Math.abs(b.pos.x - currentPos.x);
    return secondaryA - secondaryB;
  });
  return filtered[0]!.id;
}

function selectFlowHorizontal(direction: -1 | 1): void {
  const target = getFlowDirectionalTarget("horizontal", direction);
  if (target) selectNode(target);
}

function selectFlowVertical(direction: -1 | 1): void {
  const target = getFlowDirectionalTarget("vertical", direction);
  if (target) selectNode(target);
}

function getBreadthSelectionTarget(direction: -1 | 1): string | null {
  if (!map || !lastLayout) {
    if (!visibleOrder.length) {
      return null;
    }
    const currentIndex = Math.max(0, visibleOrder.indexOf(viewState.selectedNodeId));
    const nextIndex = Math.min(visibleOrder.length - 1, Math.max(0, currentIndex + direction));
    return visibleOrder[nextIndex] ?? null;
  }
  const layout = lastLayout;

  const currentId = viewState.selectedNodeId;
  const currentNode = getNode(currentId);
  if (currentNode.parentId) {
    const parent = getNode(currentNode.parentId);
    const siblings = visibleChildren(parent);
    const siblingIndex = siblings.indexOf(currentId);
    const nextSiblingIndex = siblingIndex + direction;
    if (nextSiblingIndex >= 0 && nextSiblingIndex < siblings.length) {
      return siblings[nextSiblingIndex]!;
    }
  }

  const currentPos = layout.pos[currentId];
  if (!currentPos) {
    if (!visibleOrder.length) {
      return null;
    }
    const currentIndex = Math.max(0, visibleOrder.indexOf(viewState.selectedNodeId));
    const nextIndex = Math.min(visibleOrder.length - 1, Math.max(0, currentIndex + direction));
    return visibleOrder[nextIndex] ?? null;
  }

  const sameDepth = visibleOrder
    .filter((id) => id !== currentId)
    .filter((id) => layout.pos[id]?.depth === currentPos.depth)
    .sort((a, b) => layout.pos[a]!.y - layout.pos[b]!.y);

  const target = direction < 0
    ? [...sameDepth].reverse().find((id) => layout.pos[id]!.y < currentPos.y)
    : sameDepth.find((id) => layout.pos[id]!.y > currentPos.y);

  if (target) {
    return target;
  }

  if (!visibleOrder.length) {
    return null;
  }
  const currentIndex = Math.max(0, visibleOrder.indexOf(viewState.selectedNodeId));
  const nextIndex = Math.min(visibleOrder.length - 1, Math.max(0, currentIndex + direction));
  return visibleOrder[nextIndex] ?? null;
}

function selectBreadth(direction: -1 | 1): void {
  const target = getBreadthSelectionTarget(direction);
  if (target) {
    selectNode(target);
  }
}

function extendSelectionBreadth(direction: -1 | 1): void {
  if (!visibleOrder.length) {
    return;
  }
  const currentIndex = Math.max(0, visibleOrder.indexOf(viewState.selectedNodeId));
  const nextIndex = Math.min(visibleOrder.length - 1, Math.max(0, currentIndex + direction));
  const target = visibleOrder[nextIndex] ?? null;
  if (!target) {
    return;
  }
  if (!viewState.selectionAnchorId) {
    viewState.selectionAnchorId = viewState.selectedNodeId;
  }
  viewState.selectedNodeId = target;
  const anchorId = viewState.selectionAnchorId || viewState.selectedNodeId;
  viewState.selectedNodeIds = getVisibleRangeSelection(anchorId, target);
  viewState.selectedNodeIds.add(target);
  scheduleRender();
  setStatus(`Selected ${viewState.selectedNodeIds.size} node(s).`);
}

function loadPayload(payload: unknown): void {
  try {
    map = ensureDocShape(payload);
    lastServerSavedAt = map.savedAt || null;
    lastServerBaseState = cloneStateForSave(map.state);
    hydrateLinearNotesFromDocState();
    hydrateLinearTextFontScaleFromDocState();
    if (map.state.linearPanelWidth != null) {
      linearPanelCanvasWidth = map.state.linearPanelWidth;
    }
    undoStack = [];
    redoStack = [];
    linearDirty = false;
    viewState.currentScopeId = map.state.rootId;
    viewState.scopeHistory = [];
    viewState.selectedNodeId = map.state.rootId;
    viewState.selectedNodeIds = new Set([map.state.rootId]);
    viewState.selectionAnchorId = null;
    viewState.currentScopeRootId = map.state.rootId;
    viewState.thinkingMode = "rapid";
    viewState.surfaceViewMode = inferSurfaceViewModeForScope(map.state.rootId);
    viewState.surfaceLayoutDensity = inferSurfaceLayoutDensityForScope(map.state.rootId, viewState.surfaceViewMode);
    viewState.surfaceBranchDirection = inferSurfaceBranchDirectionForScope(map.state.rootId, viewState.surfaceViewMode);
    viewState.clipboardState = null;
    viewState.linkSourceNodeId = "";
    viewState.reparentSourceIds = new Set<string>();
    viewState.collapsedIds = new Set(
      Object.values(map.state.nodes)
        .filter((n) => n.collapsed === true)
        .map((n) => n.id),
    );
    render();
    setStatus("Loaded.");
  } catch (err) {
    setStatus((err as Error).message, true);
  }
}

function resetCamera(): void {
  cancelCameraMotion();
  applyCameraTarget({
    zoom: 1,
    cameraX: VIEWER_TUNING.pan.initialCameraX,
    cameraY: VIEWER_TUNING.pan.initialCameraY,
  });
}

function centerOnNode(nodeId: string, zoom = viewState.zoom, options: CameraMoveOptions = {}): boolean {
  if (!map || !lastLayout || !lastLayout.pos[nodeId]) {
    return false;
  }
  const nodePos = lastLayout.pos[nodeId]!;
  const boardRect = board.getBoundingClientRect();
  const targetZoom = clampZoom(zoom);
  moveCameraTo({
    zoom: targetZoom,
    cameraX: boardRect.width / 2 - (nodePos.x + nodePos.w / 2) * targetZoom,
    cameraY: boardRect.height / 2 - nodePos.y * targetZoom,
  }, options);
  return true;
}

function fitDocument(options: CameraMoveOptions = {}): boolean {
  if (!map) {
    return false;
  }
  render();
  const boardRect = board.getBoundingClientRect();
  if (!boardRect.width || !boardRect.height || !contentWidth || !contentHeight) {
    return false;
  }
  const fitX = boardRect.width / contentWidth;
  const fitY = boardRect.height / contentHeight;
  const zoom = clampZoom(Math.min(fitX, fitY) * 0.92);
  moveCameraTo({
    zoom,
    cameraX: (boardRect.width - contentWidth * zoom) / 2,
    cameraY: (boardRect.height - contentHeight * zoom) / 2,
  }, options);
  return true;
}

function syncCameraMoveUi(): void {
  if (!cameraFollowBtn) {
    return;
  }
  const active = viewState.cameraMove.toggle && viewState.cameraMove.preset !== "off";
  cameraFollowBtn.classList.toggle("is-active", active);
  cameraFollowBtn.setAttribute("aria-pressed", active ? "true" : "false");
  cameraFollowBtn.title = active
    ? "Auto-fit on scope change"
    : "Auto-fit disabled";
}

function toggleCameraMove(): void {
  viewState.cameraMove.toggle = !viewState.cameraMove.toggle;
  syncCameraMoveUi();
  setStatus(`Camera follow: ${viewState.cameraMove.toggle ? "on" : "off"}`);
}

function triggerCameraMove(reason: CameraMoveTrigger): void {
  if (!viewState.cameraMove.toggle || viewState.cameraMove.preset === "off") {
    return;
  }
  if (reason === "scope" || reason === "layout" || reason === "command") {
    fitDocument({ animate: reason !== "command" });
    requestAnimationFrame(() => {
      fitDocument({ animate: reason !== "command" });
    });
    return;
  }
  if (reason === "selection" && viewState.selectedNodeId) {
    nudgeActiveNodeIntoView({ animate: true });
  }
}

function findNodeIdByText(text: string): string {
  if (!map) {
    return "";
  }
  const target = String(text || "").trim().toLowerCase();
  const node = Object.values(map.state.nodes).find((entry) => String(entry.text || "").trim().toLowerCase() === target);
  return node ? node.id : "";
}

async function loadAircraftMmDemo(): Promise<void> {
  const response = await fetch("./data/aircraft.mm", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = parseMmText(await response.text());
  loadPayload(payload);
  setStatus("aircraft.mm demo loaded.");
}

function stopVisualCheck(message = "Visual check stopped."): void {
  visualCheckRunId += 1;
  setVisualCheckStatus(message);
}

async function runAircraftVisualCheck(): Promise<void> {
  const runId = visualCheckRunId + 1;
  visualCheckRunId = runId;

  const steps: Array<{ label: string; run: () => Promise<void> }> = [
    { label: "Load aircraft.mm", run: async () => { await loadAircraftMmDemo(); resetCamera(); centerOnNode(map!.state.rootId, 1); } },
    { label: "Zoom out for whole-map scan", run: async () => { centerOnNode(map!.state.rootId, 0.72); } },
    { label: "Select Body branch", run: async () => { const nodeId = findNodeIdByText("Body"); selectNode(nodeId); centerOnNode(nodeId, 0.95); } },
    { label: "Collapse Body branch", run: async () => { const nodeId = findNodeIdByText("Body"); selectNode(nodeId); if (!viewState.collapsedIds.has(nodeId)) { toggleCollapse(); } centerOnNode(nodeId, 0.95); } },
    { label: "Expand Body branch", run: async () => { const nodeId = findNodeIdByText("Body"); selectNode(nodeId); if (viewState.collapsedIds.has(nodeId)) { toggleCollapse(); } centerOnNode(nodeId, 0.95); } },
    { label: "Select Wing branch", run: async () => { const nodeId = findNodeIdByText("Wing"); selectNode(nodeId); centerOnNode(nodeId, 0.92); } },
    { label: "Collapse Wing branch", run: async () => { const nodeId = findNodeIdByText("Wing"); selectNode(nodeId); if (!viewState.collapsedIds.has(nodeId)) { toggleCollapse(); } centerOnNode(nodeId, 0.92); } },
    { label: "Expand Wing branch", run: async () => { const nodeId = findNodeIdByText("Wing"); selectNode(nodeId); if (viewState.collapsedIds.has(nodeId)) { toggleCollapse(); } centerOnNode(nodeId, 0.92); } },
    { label: "Inspect Main Wing label scale", run: async () => { const nodeId = findNodeIdByText("Main Wing"); selectNode(nodeId); centerOnNode(nodeId, 1.15); } },
    { label: "Inspect Propeller label scale", run: async () => { const nodeId = findNodeIdByText("Propeller"); selectNode(nodeId); centerOnNode(nodeId, 1.15); } },
    { label: "Return to root overview", run: async () => { selectNode(map!.state.rootId); centerOnNode(map!.state.rootId, 0.8); } },
  ];

  function renderProgress(activeIndex: number): void {
    setVisualCheckStatus(steps.map((step, index) => {
      if (index < activeIndex) return `[done] ${step.label}`;
      if (index === activeIndex) return `[run ] ${step.label}`;
      return `[todo] ${step.label}`;
    }));
  }

  try {
    renderProgress(0);
    for (let index = 0; index < steps.length; index += 1) {
      if (visualCheckRunId !== runId) {
        return;
      }
      renderProgress(index);
      await steps[index]!.run();
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
    if (visualCheckRunId !== runId) {
      return;
    }
    setVisualCheckStatus(steps.map((step) => `[done] ${step.label}`).concat("Completed: aircraft visual check"));
    setStatus("Aircraft visual check completed.");
  } catch (err) {
    if (visualCheckRunId !== runId) {
      return;
    }
    setVisualCheckStatus(`Aircraft visual check failed: ${(err as Error).message}`);
    setStatus(`Aircraft visual check failed (${(err as Error).message}).`, true);
  }
}

function isDescendant(candidateParentId: string, nodeId: string): boolean {
  let currentId: string | null = candidateParentId;
  while (currentId) {
    if (currentId === nodeId) {
      return true;
    }
    const current: TreeNode | undefined = map!.state.nodes[currentId];
    currentId = current ? current.parentId : null;
  }
  return false;
}

function ancestorPathToRoot(nodeId: string): string[] {
  if (!map) {
    return [];
  }
  const path: string[] = [];
  let cursor: string | null = nodeId;
  while (cursor) {
    path.push(cursor);
    cursor = map.state.nodes[cursor]?.parentId ?? null;
  }
  return path;
}

function findLowestCommonAncestor(nodeIds: string[]): string | null {
  if (!map || nodeIds.length === 0) {
    return null;
  }
  const paths = nodeIds.map((nodeId) => ancestorPathToRoot(nodeId).reverse());
  const shortestLen = Math.min(...paths.map((path) => path.length));
  let lca: string | null = null;
  for (let index = 0; index < shortestLen; index += 1) {
    const candidate = paths[0]![index]!;
    if (paths.every((path) => path[index] === candidate)) {
      lca = candidate;
      continue;
    }
    break;
  }
  return lca;
}

function markReparentSource(): void {
  if (!map || viewState.selectedNodeIds.size === 0) {
    return;
  }
  viewState.reparentSourceIds = new Set(viewState.selectedNodeIds);
  const roots = getMovableSelectionRoots(viewState.reparentSourceIds);
  setStatus(`Marked move nodes: ${roots.length}`);
  scheduleRender();
}

function sameIdSet(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }
  for (const id of left) {
    if (!right.has(id)) {
      return false;
    }
  }
  return true;
}

function toggleReparentSource(): void {
  if (!map) {
    return;
  }
  const nextSourceIds = new Set(viewState.selectedNodeIds);
  const currentRoots = new Set(getMovableSelectionRoots(viewState.reparentSourceIds));
  const nextRoots = new Set(getMovableSelectionRoots(nextSourceIds));

  if (nextRoots.size === 0) {
    viewState.reparentSourceIds.clear();
    setStatus("No move node selected.", true);
    scheduleRender();
    return;
  }

  if (sameIdSet(currentRoots, nextRoots)) {
    viewState.reparentSourceIds.clear();
    setStatus("Move node mark cleared.");
    scheduleRender();
    return;
  }

  viewState.reparentSourceIds = nextSourceIds;
  setStatus(`Marked move nodes: ${nextRoots.size}`);
  scheduleRender();
}

function toggleHoldReparent(): void {
  if (viewState.reparentSourceIds.size > 0) {
    applyReparent();
  } else {
    markReparentSource();
  }
}

function applyReparent(): void {
  const sourceRoots = getMovableSelectionRoots(viewState.reparentSourceIds);
  const targetParentId = viewState.selectedNodeId;
  if (sourceRoots.length === 0) {
    setStatus("No move node marked.", true);
    return;
  }
  if (sourceRoots.some((sourceId) => sourceId === targetParentId)) {
    setStatus("Cannot move a node under itself.", true);
    return;
  }
  if (sourceRoots.some((sourceId) => isDescendant(targetParentId, sourceId))) {
    setStatus("Cannot move a node under its descendant.", true);
    return;
  }

  pushUndoSnapshot();
  let movedCount = 0;
  sourceRoots.forEach((sourceId) => {
    const applied = applyMoveByParentAndIndex(sourceId, targetParentId, getNode(targetParentId).children.length, true, {
      withUndo: false,
      withTouch: false,
      withStatus: false,
    });
    if (applied) {
      movedCount += 1;
    }
  });

  if (movedCount === 0) {
    setStatus("No valid move target for selected nodes.", true);
    return;
  }

  setSingleSelection(targetParentId, false);
  viewState.reparentSourceIds.clear();
  touchDocument();
  setStatus(`Moved ${movedCount} node(s).`);
}

function collectRoutingScopeTargets(): RoutingScopeTarget[] {
  if (!map) {
    return [];
  }
  const targets: RoutingScopeTarget[] = [];
  const visit = (nodeId: string, scopeDepth: number, parentScopeId: string | null): void => {
    const node = map!.state.nodes[nodeId];
    if (!node) {
      return;
    }
    let nextScopeDepth = scopeDepth;
    let nextParentScopeId = parentScopeId;
    if (nodeId === map!.state.rootId || isFolderNode(node)) {
      targets.push({
        id: nodeId,
        label: uiLabel(node) || nodeId,
        parentId: parentScopeId,
        depth: scopeDepth,
      });
      nextScopeDepth = scopeDepth + 1;
      nextParentScopeId = nodeId;
    }
    (node.children || []).forEach((childId) => visit(childId, nextScopeDepth, nextParentScopeId));
  };
  visit(map.state.rootId, 0, null);
  return targets;
}

function ensureRoutingSwitcherEl(): HTMLElement {
  if (routingSwitcherEl) {
    return routingSwitcherEl;
  }
  const el = document.createElement("div");
  el.id = "routing-switcher";
  el.className = "routing-switcher";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "Scope routing switcher");
  el.addEventListener("wheel", (event: WheelEvent) => {
    if (!routingScopeHoldDown || !routingSwitcherOpen || event.ctrlKey || event.metaKey) {
      return;
    }
    event.preventDefault();
    cancelCameraMotion();
    const { deltaX, deltaY } = normalizedWheelDeltas(event);
    routePanMoveRoutingScope(deltaX, deltaY);
  }, { passive: false });
  document.body.appendChild(el);
  routingSwitcherEl = el;
  return el;
}

function normalizedWheelDeltas(event: WheelEvent): { deltaX: number; deltaY: number } {
  const deltaScale = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? 800 : 1;
  return {
    deltaX: event.deltaX * deltaScale,
    deltaY: event.deltaY * deltaScale,
  };
}

function routingScopeState(targets: RoutingScopeTarget[]): AppState {
  const rootId = targets.find((target) => !target.parentId)?.id || targets[0]?.id || "routing-root";
  const nodes: Record<string, TreeNode> = {};
  targets.forEach((target) => {
    nodes[target.id] = {
      ...createNodeRecord(target.id, target.parentId, target.label),
      nodeType: "folder",
      attributes: { "m3e:class": "scope" },
    };
  });
  targets.forEach((target) => {
    if (!target.parentId || !nodes[target.parentId]) {
      return;
    }
    nodes[target.parentId]!.children.push(target.id);
  });
  return { rootId, nodes, links: {}, annotations: {}, scopes: {}, surfaces: {} };
}

function routingSurfaceViewBox(layout: LayoutResult): string {
  const padding = 36;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  layout.order.forEach((nodeId) => {
    const pos = layout.pos[nodeId];
    if (!pos) return;
    const h = Math.max(VIEWER_TUNING.layout.nodeHitHeight, pos.h);
    minX = Math.min(minX, pos.x - 24);
    minY = Math.min(minY, pos.y - h / 2 - 18);
    maxX = Math.max(maxX, pos.x + pos.w + 42);
    maxY = Math.max(maxY, pos.y + h / 2 + 18);
  });
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return "0 0 720 430";
  }
  return `${minX - padding} ${minY - padding} ${Math.max(1, maxX - minX + padding * 2)} ${Math.max(1, maxY - minY + padding * 2)}`;
}

function renderRoutingScopeSurface(selectedNodeId: string | null): string {
  const state = routingScopeState(routingScopeTargets);
  const rootId = state.rootId;
  const activeScopeId = selectedRoutingScopeTarget()?.id;
  const routingGraph: VisibleLayoutGraph = {
    nodeIds: Object.keys(state.nodes),
    childrenOf: (nodeId) => state.nodes[nodeId]?.children || [],
    graphLinks: [],
  };
  const routingConfig = structuredLayoutConfig("tree");
  const routingBoxSizes: Record<string, LayoutNodeMetric> = {};
  Object.keys(state.nodes).forEach((nodeId) => {
    routingBoxSizes[nodeId] = measureLayoutNode(state, nodeId, rootId, routingConfig);
  });
  const layout = layoutPortLayout(routingGraph, routingBoxSizes, "Tree", {
    displayRootId: rootId,
    structuredMode: "tree",
    density: viewState.surfaceLayoutDensity,
    branchDirection: viewState.surfaceBranchDirection,
  });
  let edges = "";
  let nodes = "";
  layout.order.forEach((nodeId) => {
    const node = state.nodes[nodeId];
    const parentPos = layout.pos[nodeId];
    if (!node || !parentPos) return;
    (node.children || []).forEach((childId, index) => {
      const childPos = layout.pos[childId];
      if (!childPos) return;
      const edgePath = layoutEdgePath("tree", parentPos, childPos);
      const stroke = VIEWER_TUNING.palette.edgeColors[(parentPos.depth + index) % VIEWER_TUNING.palette.edgeColors.length];
      edges += `<path class="edge edge-tree routing-surface-edge" data-source-node-id="${escapeXml(nodeId)}" data-target-node-id="${escapeXml(childId)}" data-source-port-side="${edgePath.sourceSide}" data-target-port-side="${edgePath.targetSide}" stroke="${stroke}" d="${edgePath.d}" />`;
    });
  });
  layout.order.forEach((nodeId) => {
    const node = state.nodes[nodeId];
    const pos = layout.pos[nodeId];
    if (!node || !pos) return;
    const active = nodeId === activeScopeId;
    const disabled = selectedNodeId ? !canDropUnderParent(selectedNodeId, nodeId) : true;
    const visualClasses = ["node-visual-box", nodeId === rootId ? "root-box" : "folder-box", "routing-surface-node"];
    if (active) visualClasses.push("primary-selected", "selected");
    if (disabled) visualClasses.push("routing-disabled");
    const labelClasses = [nodeId === rootId ? "label-root" : "label-node", "routing-surface-label"];
    if (active) labelClasses.push("primary-selected", "selected");
    const labelLines = pos.labelLines || splitLabelLines(uiLabel(node) || "(empty)");
    const fontSize = pos.fontSize ?? (nodeId === rootId ? VIEWER_TUNING.typography.rootFont : VIEWER_TUNING.typography.nodeFont);
    const lineHeight = lineHeightForFont(fontSize);
    const textY = multilineTextStartY(pos.y, labelLines.length, fontSize, lineHeight);
    const dataAttr = `data-routing-scope-id="${escapeXml(nodeId)}" data-node-id="${escapeXml(nodeId)}"`;
    if (nodeId === rootId) {
      const y = pos.y - pos.h / 2;
      nodes += `<g class="routing-surface-scope" ${dataAttr}>`;
      nodes += `<rect class="${visualClasses.join(" ")}" ${dataAttr} x="${pos.x}" y="${y}" width="${pos.w}" height="${pos.h}" rx="8" />`;
      nodes += `<text class="${labelClasses.join(" ")}" ${dataAttr} x="${pos.x + pos.w / 2}" y="${textY}" text-anchor="middle" style="font-size:${fontSize}px">${multilineTspans(labelLines, pos.x + pos.w / 2, lineHeight)}</text>`;
      nodes += `</g>`;
      return;
    }
    const frameInsetY = 12;
    const framePadX = 14;
    const frameH = Math.max(VIEWER_TUNING.layout.nodeHitHeight, pos.h) - frameInsetY;
    const frameX = pos.x - framePadX;
    const frameY = pos.y - frameH / 2;
    const frameW = pos.w + framePadX * 2;
    nodes += `<g class="routing-surface-scope" ${dataAttr}>`;
    nodes += `<rect class="${visualClasses.join(" ")}" ${dataAttr} x="${frameX}" y="${frameY}" width="${frameW}" height="${frameH}" rx="8" />`;
    nodes += `<text class="${labelClasses.join(" ")}" ${dataAttr} x="${pos.x}" y="${textY}" text-anchor="start" style="font-size:${fontSize}px">${multilineTspans(labelLines, pos.x, lineHeight)}</text>`;
    nodes += `</g>`;
  });
  return `<svg class="routing-scope-surface" viewBox="${routingSurfaceViewBox(layout)}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Scope routing surface">${edges}${nodes}</svg>`;
}

function syncRoutingSwitcher(): void {
  if (!routingSwitcherOpen || !map) {
    if (routingSwitcherEl) {
      routingSwitcherEl.hidden = true;
      routingSwitcherEl.innerHTML = "";
    }
    return;
  }
  const el = ensureRoutingSwitcherEl();
  const selectedNode = map.state.nodes[viewState.selectedNodeId];
  const selectedScope = selectedRoutingScopeTarget();
  const nodeLabel = selectedNode ? uiLabel(selectedNode) : viewState.selectedNodeId;
  const scopeLabel = selectedScope ? selectedScope.label : "No scope";
  const routeEnabled = Boolean(selectedNode && selectedScope && canDropUnderParent(selectedNode.id, selectedScope.id));

  el.hidden = false;
  el.innerHTML = `
    <section class="routing-switcher-panel">
      <div class="routing-switcher-head">
        <span>Scope route</span>
        <strong>${escapeHtml(nodeLabel)} -> ${escapeHtml(scopeLabel)}</strong>
      </div>
      ${renderRoutingScopeSurface(selectedNode?.id || null)}
      <div class="routing-switcher-foot">
        <span>${routeEnabled ? "Ready" : "Invalid target"}</span>
        <span>${routingScopeTargets.length} scopes</span>
      </div>
    </section>
  `;
  el.querySelectorAll<SVGGraphicsElement>(".routing-surface-scope[data-routing-scope-id]").forEach((scopeEl) => {
    scopeEl.addEventListener("click", () => {
      const scopeId = scopeEl.dataset.routingScopeId || "";
      const nextIndex = routingScopeTargets.findIndex((target) => target.id === scopeId);
      if (nextIndex >= 0) {
        setRoutingScopeIndex(nextIndex);
        routingSwitcherLane = "scope";
        syncRoutingSwitcher();
      }
    });
  });
}

function openRoutingSwitcher(lane: RoutingSwitcherLane): void {
  if (!map) {
    return;
  }
  routingScopeTargets = collectRoutingScopeTargets();
  const currentScopeIndex = routingScopeTargets.findIndex((target) => target.id === normalizedCurrentScopeId());
  setRoutingScopeIndex(currentScopeIndex >= 0 ? currentScopeIndex : 0);
  routingSwitcherLane = lane;
  routingSwitcherOpen = true;
  syncRoutingSwitcher();
  setStatus(lane === "scope" ? "Routing: active scope." : "Routing: active node.");
}

function closeRoutingSwitcher(): void {
  routingSwitcherOpen = false;
  syncRoutingSwitcher();
}

function setRoutingScopeIndex(index: number): void {
  if (routingScopeTargets.length === 0) {
    routingScopeIndex = 0;
    routingScopeTargetId = null;
    return;
  }
  routingScopeIndex = ((index % routingScopeTargets.length) + routingScopeTargets.length) % routingScopeTargets.length;
  routingScopeTargetId = routingScopeTargets[routingScopeIndex]?.id || null;
}

function selectedRoutingScopeTarget(): RoutingScopeTarget | undefined {
  return routingScopeTargets.find((target) => target.id === routingScopeTargetId) || routingScopeTargets[routingScopeIndex] || routingScopeTargets[0];
}

function moveRoutingScope(direction: -1 | 1): void {
  if (routingScopeTargets.length === 0) {
    return;
  }
  const currentIndex = routingScopeTargets.findIndex((target) => target.id === routingScopeTargetId);
  const baseIndex = currentIndex >= 0 ? currentIndex : routingScopeIndex;
  setRoutingScopeIndex(baseIndex + direction);
  routingSwitcherLane = "scope";
  syncRoutingSwitcher();
}

function moveRoutingScopeHorizontal(direction: "parent" | "child"): void {
  const current = selectedRoutingScopeTarget();
  if (!current) {
    return;
  }
  const nextScopeId = direction === "parent"
    ? current.parentId
    : routingScopeTargets.find((target) => target.parentId === current.id)?.id || null;
  if (!nextScopeId) {
    return;
  }
  const nextIndex = routingScopeTargets.findIndex((target) => target.id === nextScopeId);
  if (nextIndex < 0) {
    return;
  }
  setRoutingScopeIndex(nextIndex);
  routingSwitcherLane = "scope";
  syncRoutingSwitcher();
}

function moveRoutingNode(direction: -1 | 1): void {
  selectBreadth(direction);
  routingSwitcherLane = "node";
  syncRoutingSwitcher();
}

function routePanMoveRoutingScope(deltaX: number, deltaY: number): void {
  const threshold = 48;
  routingWheelCarryX += deltaX;
  routingWheelCarryY += deltaY;

  let moved = false;
  while (Math.abs(routingWheelCarryY) >= threshold) {
    moveRoutingScope(routingWheelCarryY > 0 ? -1 : 1);
    routingWheelCarryY += routingWheelCarryY > 0 ? -threshold : threshold;
    moved = true;
  }
  while (Math.abs(routingWheelCarryX) >= threshold) {
    moveRoutingScopeHorizontal(routingWheelCarryX > 0 ? "parent" : "child");
    routingWheelCarryX += routingWheelCarryX > 0 ? -threshold : threshold;
    moved = true;
  }

  if (moved) {
    setStatus("Routing pan: active scope.");
  }
}

function routePanMoveActiveNode(deltaX: number, deltaY: number): void {
  const threshold = 48;
  routingWheelCarryX += deltaX;
  routingWheelCarryY += deltaY;

  let moved = false;
  while (Math.abs(routingWheelCarryY) >= threshold) {
    selectBreadth(routingWheelCarryY > 0 ? -1 : 1);
    routingWheelCarryY += routingWheelCarryY > 0 ? -threshold : threshold;
    moved = true;
  }
  while (Math.abs(routingWheelCarryX) >= threshold) {
    if (routingWheelCarryX > 0) {
      selectParent();
    } else {
      selectChild();
    }
    routingWheelCarryX += routingWheelCarryX > 0 ? -threshold : threshold;
    moved = true;
  }

  if (moved) {
    setStatus("Routing pan: active node.");
  }
}

document.addEventListener("wheel", (event: WheelEvent) => {
  if (!routingScopeHoldDown || !routingSwitcherOpen || event.ctrlKey || event.metaKey) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  cancelCameraMotion();
  const { deltaX, deltaY } = normalizedWheelDeltas(event);
  routePanMoveRoutingScope(deltaX, deltaY);
}, { capture: true, passive: false });

function applyRoutingSwitcherRoute(): boolean {
  if (!map || !routingSwitcherOpen) {
    return false;
  }
  const target = selectedRoutingScopeTarget();
  if (!target) {
    setStatus("No route target.", true);
    return false;
  }
  routingScopeTargets = collectRoutingScopeTargets();
  const nextIndex = routingScopeTargets.findIndex((scope) => scope.id === target.id);
  setRoutingScopeIndex(nextIndex >= 0 ? nextIndex : 0);
  routingScopeHoldDown = false;
  closeRoutingSwitcher();
  EnterScopeCommand(target.id);
  setStatus(`Entered scope: ${target.label}.`);
  return true;
}

function groupSelected(): void {
  if (!map) {
    return;
  }
  const roots = getSelectionRoots().filter((nodeId) => getNode(nodeId).parentId !== null);
  if (roots.length <= 1) {
    setStatus("Select multiple nodes to group.", true);
    return;
  }

  const lcaId = findLowestCommonAncestor(roots) || map.state.rootId;
  const lca = getNode(lcaId);
  const childIndexes = roots
    .map((rootId) => lca.children.indexOf(rootId))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
  const insertIndex = childIndexes.length > 0 ? childIndexes[0]! : lca.children.length;

  pushUndoSnapshot();
  const newGroupId = newId();
  map.state.nodes[newGroupId] = createNodeRecord(newGroupId, lca.id, "");
  lca.children.splice(insertIndex, 0, newGroupId);
  roots.forEach((rootId) => {
    applyMoveByParentAndIndex(rootId, newGroupId, getNode(newGroupId).children.length, true, {
      withTouch: false,
      withStatus: false,
    });
  });

  setSingleSelection(newGroupId, false);
  touchDocument();
  startInlineEdit(newGroupId);
  setStatus(`Grouped ${roots.length} nodes.`);
}

function selectAllVisibleInScope(): void {
  if (!visibleOrder.length) {
    return;
  }
  const firstVisibleId = visibleOrder[0]!;
  viewState.selectedNodeId = firstVisibleId;
  viewState.selectedNodeIds = new Set(visibleOrder);
  viewState.selectionAnchorId = firstVisibleId;
  scheduleRender();
  setStatus(`Selected ${viewState.selectedNodeIds.size} node(s).`);
}

function toSubtreeSnapshot(nodeId: string): SubtreeSnapshot {
  const node = getNode(nodeId);
  return {
    id: node.id,
    nodeType: node.nodeType || "text",
    text: node.text || "",
    collapsed: node.collapsed === true,
    details: node.details || "",
    note: node.note || "",
    attributes: JSON.parse(JSON.stringify(node.attributes || {})) as Record<string, string>,
    link: node.link || "",
    targetNodeId: node.targetNodeId || undefined,
    aliasLabel: node.aliasLabel || undefined,
    access: node.nodeType === "alias" ? aliasAccess(node) : undefined,
    targetSnapshotLabel: node.targetSnapshotLabel || undefined,
    isBroken: node.nodeType === "alias" ? Boolean(node.isBroken) : undefined,
    children: (node.children || []).map((childId) => toSubtreeSnapshot(childId)),
  };
}

function collectSnapshotNodeIds(snapshot: SubtreeSnapshot, ids: Set<string>): void {
  if (snapshot.id) {
    ids.add(snapshot.id);
  }
  (snapshot.children || []).forEach((child) => collectSnapshotNodeIds(child, ids));
}

function collectSubtreeNodeIds(nodeId: string, ids: Set<string>): void {
  if (ids.has(nodeId)) {
    return;
  }
  ids.add(nodeId);
  (getNode(nodeId).children || []).forEach((childId) => collectSubtreeNodeIds(childId, ids));
}

function collectInternalLinksForRoots(rootIds: string[]): GraphLink[] {
  if (!map) {
    return [];
  }
  const copiedNodeIds = new Set<string>();
  rootIds.forEach((rootId) => collectSubtreeNodeIds(rootId, copiedNodeIds));
  return Object.values(map.state.links || {})
    .map((link) => normalizeGraphLink(link))
    .filter((link) => copiedNodeIds.has(link.sourceNodeId) && copiedNodeIds.has(link.targetNodeId))
    .map((link) => JSON.parse(JSON.stringify(link)) as GraphLink);
}

function cloneSnapshotUnderParent(parentId: string, snapshot: SubtreeSnapshot, idMap?: Map<string, string>): string {
  const parent = getNode(parentId);
  const createdId = newId();
  map!.state.nodes[createdId] = createNodeRecord(createdId, parentId, snapshot.text || "New Node");
  const created = map!.state.nodes[createdId]!;
  created.nodeType = snapshot.nodeType || "text";
  created.collapsed = snapshot.collapsed === true;
  created.details = snapshot.details || "";
  created.note = snapshot.note || "";
  created.attributes = JSON.parse(JSON.stringify(snapshot.attributes || {})) as Record<string, string>;
  created.link = snapshot.link || "";
  created.targetNodeId = snapshot.targetNodeId || undefined;
  created.aliasLabel = snapshot.aliasLabel || undefined;
  created.access = created.nodeType === "alias" ? (snapshot.access || "read") : undefined;
  created.targetSnapshotLabel = snapshot.targetSnapshotLabel || undefined;
  created.isBroken = created.nodeType === "alias" ? Boolean(snapshot.isBroken) : undefined;
  idMap?.set(snapshot.id, createdId);
  parent.children.push(createdId);
  (snapshot.children || []).forEach((childSnapshot) => {
    cloneSnapshotUnderParent(createdId, childSnapshot, idMap);
  });
  return createdId;
}

function remapAliasTargetsInClonedSnapshots(idMap: Map<string, string>): void {
  if (!map) {
    return;
  }
  idMap.forEach((newId) => {
    const node = map!.state.nodes[newId];
    if (!isAliasNode(node) || !node.targetNodeId) {
      return;
    }
    const remappedTargetId = idMap.get(node.targetNodeId);
    if (remappedTargetId) {
      node.targetNodeId = remappedTargetId;
      node.isBroken = false;
      return;
    }
    if (!map!.state.nodes[node.targetNodeId]) {
      node.isBroken = true;
    }
  });
}

function pasteCopiedPayload(targetParentId: string, snapshots: SubtreeSnapshot[], links: GraphLink[]): void {
  if (!map || snapshots.length === 0) {
    setStatus("Clipboard is empty.", true);
    return;
  }
  pushUndoSnapshot();
  const idMap = new Map<string, string>();
  let firstPastedId: string | null = null;
  snapshots.forEach((snapshot) => {
    const pastedId = cloneSnapshotUnderParent(targetParentId, snapshot, idMap);
    if (!firstPastedId) {
      firstPastedId = pastedId;
    }
  });
  remapAliasTargetsInClonedSnapshots(idMap);
  let pastedLinks = 0;
  (links || []).forEach((rawLink) => {
    const link = normalizeGraphLink(rawLink);
    const sourceNodeId = idMap.get(link.sourceNodeId);
    const targetNodeId = idMap.get(link.targetNodeId);
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) {
      return;
    }
    if (findExistingGraphLink(sourceNodeId, targetNodeId)) {
      return;
    }
    const linkId = newId();
    if (!map!.state.links) {
      map!.state.links = {};
    }
    map!.state.links[linkId] = normalizeGraphLink({
      ...link,
      id: linkId,
      sourceNodeId,
      targetNodeId,
    });
    pastedLinks += 1;
  });
  if (firstPastedId) {
    setSingleSelection(firstPastedId, false);
  }
  touchDocument();
  setStatus(`Pasted ${snapshots.length} copied node(s)${pastedLinks ? ` and ${pastedLinks} link(s)` : ""}.`);
}

function buildStructuredClipboardPayload(snapshots: SubtreeSnapshot[], links: GraphLink[]): SubtreeClipboardPayload {
  const snapshotIds = new Set<string>();
  snapshots.forEach((snapshot) => collectSnapshotNodeIds(snapshot, snapshotIds));
  return {
    kind: "m3e.subtree.clipboard",
    version: 1,
    roots: snapshots,
    links: links.filter((link) => snapshotIds.has(link.sourceNodeId) && snapshotIds.has(link.targetNodeId)),
  };
}

function encodeStructuredClipboardPayload(payload: SubtreeClipboardPayload): string {
  return `${STRUCTURED_CLIPBOARD_PREFIX}${JSON.stringify(payload)}`;
}

function sanitizeSubtreeSnapshot(raw: unknown): SubtreeSnapshot | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Partial<SubtreeSnapshot>;
  const nodeType = record.nodeType === "image" || record.nodeType === "folder" || record.nodeType === "alias"
    ? record.nodeType
    : "text";
  return {
    id: String(record.id || newId()),
    nodeType,
    text: String(record.text || ""),
    collapsed: record.collapsed === true,
    details: String(record.details || ""),
    note: String(record.note || ""),
    attributes: record.attributes && typeof record.attributes === "object"
      ? JSON.parse(JSON.stringify(record.attributes)) as Record<string, string>
      : {},
    link: String(record.link || ""),
    targetNodeId: typeof record.targetNodeId === "string" && record.targetNodeId ? record.targetNodeId : undefined,
    aliasLabel: typeof record.aliasLabel === "string" && record.aliasLabel ? record.aliasLabel : undefined,
    access: nodeType === "alias" && record.access === "write" ? "write" : (nodeType === "alias" ? "read" : undefined),
    targetSnapshotLabel: typeof record.targetSnapshotLabel === "string" && record.targetSnapshotLabel ? record.targetSnapshotLabel : undefined,
    isBroken: nodeType === "alias" ? Boolean(record.isBroken) : undefined,
    children: Array.isArray(record.children)
      ? record.children.map((child) => sanitizeSubtreeSnapshot(child)).filter((child): child is SubtreeSnapshot => Boolean(child))
      : [],
  };
}

function parseStructuredClipboardPayload(text: string): SubtreeClipboardPayload | null {
  if (!text.startsWith(STRUCTURED_CLIPBOARD_PREFIX)) {
    return null;
  }
  try {
    const payload = JSON.parse(text.slice(STRUCTURED_CLIPBOARD_PREFIX.length)) as Partial<SubtreeClipboardPayload>;
    if (payload.kind !== "m3e.subtree.clipboard" || payload.version !== 1 || !Array.isArray(payload.roots)) {
      return null;
    }
    const roots = payload.roots
      .map((snapshot) => sanitizeSubtreeSnapshot(snapshot))
      .filter((snapshot): snapshot is SubtreeSnapshot => Boolean(snapshot));
    if (!roots.length) {
      return null;
    }
    const snapshotIds = new Set<string>();
    roots.forEach((snapshot) => collectSnapshotNodeIds(snapshot, snapshotIds));
    const links = Array.isArray(payload.links)
      ? payload.links
        .filter((link): link is GraphLink => Boolean(link && typeof link === "object"))
        .map((link) => normalizeGraphLink(link))
        .filter((link) => snapshotIds.has(link.sourceNodeId) && snapshotIds.has(link.targetNodeId))
      : [];
    return { kind: "m3e.subtree.clipboard", version: 1, roots, links };
  } catch {
    return null;
  }
}

function normalizeClipboardSyncRecord(raw: unknown): ClipboardSyncRecord | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Partial<ClipboardSyncRecord>;
  if (
    record.type !== "M3E_CLIPBOARD_UPDATE" ||
    typeof record.fromTabId !== "string" ||
    typeof record.encoded !== "string" ||
    typeof record.writtenAt !== "number"
  ) {
    return null;
  }
  if (!record.encoded.startsWith(STRUCTURED_CLIPBOARD_PREFIX)) {
    return null;
  }
  if (Date.now() - record.writtenAt > STRUCTURED_CLIPBOARD_MAX_AGE_MS) {
    return null;
  }
  return {
    type: "M3E_CLIPBOARD_UPDATE",
    fromTabId: record.fromTabId,
    encoded: record.encoded,
    writtenAt: record.writtenAt,
  };
}

function applyStructuredClipboardPayload(payload: SubtreeClipboardPayload): void {
  viewState.clipboardState = {
    type: "copy",
    snapshots: payload.roots,
    links: payload.links,
  };
  scheduleRender();
}

function applyStructuredClipboardText(encoded: string): boolean {
  const payload = parseStructuredClipboardPayload(encoded);
  if (!payload) {
    return false;
  }
  applyStructuredClipboardPayload(payload);
  return true;
}

function writeStructuredClipboardFallback(encoded: string): boolean {
  const record: ClipboardSyncRecord = {
    type: "M3E_CLIPBOARD_UPDATE",
    fromTabId: TAB_ID,
    encoded,
    writtenAt: Date.now(),
  };
  let stored = false;
  try {
    window.localStorage.setItem(STRUCTURED_CLIPBOARD_STORAGE_KEY, JSON.stringify(record));
    stored = true;
  } catch {
    stored = false;
  }
  try {
    clipboardBc?.postMessage(record);
  } catch {
    // localStorage is the durable same-origin fallback; BroadcastChannel is best-effort.
  }
  return stored || Boolean(clipboardBc);
}

function readStructuredClipboardFallback(): SubtreeClipboardPayload | null {
  try {
    const record = normalizeClipboardSyncRecord(JSON.parse(window.localStorage.getItem(STRUCTURED_CLIPBOARD_STORAGE_KEY) || "null"));
    return record ? parseStructuredClipboardPayload(record.encoded) : null;
  } catch {
    return null;
  }
}

function initClipboardSync(): void {
  if (typeof BroadcastChannel !== "undefined") {
    try {
      clipboardBc = new BroadcastChannel("m3e-subtree-clipboard");
      clipboardBc.onmessage = (ev: MessageEvent<ClipboardSyncRecord>) => {
        const record = normalizeClipboardSyncRecord(ev.data);
        if (!record || record.fromTabId === TAB_ID) {
          return;
        }
        applyStructuredClipboardText(record.encoded);
      };
    } catch {
      clipboardBc = null;
    }
  }
  window.addEventListener("storage", (ev: StorageEvent) => {
    if (ev.key !== STRUCTURED_CLIPBOARD_STORAGE_KEY || !ev.newValue) {
      return;
    }
    try {
      const record = normalizeClipboardSyncRecord(JSON.parse(ev.newValue));
      if (!record || record.fromTabId === TAB_ID) {
        return;
      }
      applyStructuredClipboardText(record.encoded);
    } catch {
      // Ignore malformed same-origin clipboard fallback records.
    }
  });
  window.addEventListener("beforeunload", () => clipboardBc?.close());
}

async function copyTextViaLocalClipboardApi(text: string): Promise<boolean> {
  if (!text || typeof fetch !== "function" || !/^https?:$/.test(window.location.protocol)) {
    return false;
  }
  try {
    const res = await fetch("/api/system-clipboard/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      return false;
    }
    const payload = (await res.json().catch(() => null)) as { ok?: unknown } | null;
    return payload?.ok === true;
  } catch {
    return false;
  }
}

async function copyTextViaBrowserClipboard(text: string): Promise<boolean> {
  if (!text || !navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function copyTextToSystemClipboard(text: string): Promise<boolean> {
  return (await copyTextViaLocalClipboardApi(text)) || (await copyTextViaBrowserClipboard(text));
}

async function readTextViaLocalClipboardApi(): Promise<string | null> {
  if (typeof fetch !== "function" || !/^https?:$/.test(window.location.protocol)) {
    return null;
  }
  try {
    const res = await fetch("/api/system-clipboard/read", { method: "GET" });
    if (!res.ok) {
      return null;
    }
    const payload = (await res.json().catch(() => null)) as { ok?: unknown; text?: unknown } | null;
    return payload?.ok === true && typeof payload.text === "string" ? payload.text : null;
  } catch {
    return null;
  }
}

async function readTextViaBrowserClipboard(): Promise<string | null> {
  if (!navigator.clipboard || typeof navigator.clipboard.readText !== "function") {
    return null;
  }
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

async function readTextFromSystemClipboard(): Promise<string | null> {
  return (await readTextViaLocalClipboardApi()) || (await readTextViaBrowserClipboard());
}

function buildNodePath(nodeId: string): string {
  if (!map) return "";
  const pathNodes: TreeNode[] = [];
  let cursor: string | null = nodeId;
  while (cursor) {
    const n: TreeNode | undefined = map.state.nodes[cursor];
    if (!n) break;
    pathNodes.unshift(n);
    cursor = n.parentId ?? null;
  }
  return formatMapPath(pathNodes);
}

async function copyNodePath(): Promise<void> {
  if (!map) return;
  const path = buildNodePath(viewState.selectedNodeId);
  if (await copyTextToSystemClipboard(path)) {
    setStatus(`Path copied: ${path}`);
    return;
  }
  setStatus("Failed to copy path to system clipboard.", true);
}

async function copyScopeId(): Promise<void> {
  if (!map) return;
  const id = normalizedCurrentScopeId();
  if (await copyTextToSystemClipboard(id)) {
    setStatus(`Scope ID copied: ${id}`);
    return;
  }
  setStatus("Failed to copy scope ID to system clipboard.", true);
}

async function copySelected(): Promise<void> {
  const roots = getSelectionRoots();
  if (roots.length === 0) {
    return;
  }
  const snapshots = roots.map((rootId) => toSubtreeSnapshot(rootId));
  const links = collectInternalLinksForRoots(roots);
  const payload = buildStructuredClipboardPayload(snapshots, links);
  const encoded = encodeStructuredClipboardPayload(payload);
  viewState.clipboardState = {
    type: "copy",
    snapshots,
    links,
  };
  const copiedToM3eTabs = writeStructuredClipboardFallback(encoded);
  scheduleRender();
  const message = `Copied ${roots.length} node(s)${links.length ? ` and ${links.length} link(s)` : ""}`;
  if (await copyTextToSystemClipboard(encoded)) {
    setStatus(`${message}.`);
    return;
  }
  if (copiedToM3eTabs) {
    setStatus(`${message} for M3E tabs. System clipboard unavailable.`);
    return;
  }
  setStatus("Failed to copy nodes.", true);
}

function cutSelected(): void {
  const roots = getMovableSelectionRoots();
  if (roots.length === 0) {
    setStatus("Root node cannot be cut.", true);
    return;
  }
  viewState.clipboardState = {
    type: "cut",
    sourceIds: new Set(roots),
  };
  scheduleRender();
  setStatus(`Cut pending: ${roots.length} node(s).`);
}

async function pasteClipboard(): Promise<void> {
  if (!map) {
    return;
  }
  if (!viewState.clipboardState) {
    const clipboardText = await readTextFromSystemClipboard();
    const payload = (clipboardText ? parseStructuredClipboardPayload(clipboardText) : null) || readStructuredClipboardFallback();
    if (!payload) {
      setStatus("Clipboard is empty.", true);
      return;
    }
    const targetParentId = viewState.selectedNodeId;
    const targetParent = getNode(targetParentId);
    if (isAliasNode(targetParent)) {
      setStatus("Alias nodes cannot own children.", true);
      return;
    }
    pasteCopiedPayload(targetParentId, payload.roots, payload.links);
    return;
  }
  const targetParentId = viewState.selectedNodeId;
  const targetParent = getNode(targetParentId);
  if (isAliasNode(targetParent)) {
    setStatus("Alias nodes cannot own children.", true);
    return;
  }

  if (viewState.clipboardState.type === "copy") {
    const snapshots = viewState.clipboardState.snapshots;
    if (!snapshots.length) {
      setStatus("Clipboard is empty.", true);
      return;
    }
    pasteCopiedPayload(targetParentId, snapshots, viewState.clipboardState.links || []);
    return;
  }

  const cutRoots = getSelectionRoots(viewState.clipboardState.sourceIds)
    .filter((nodeId) => getNode(nodeId).parentId !== null);
  if (cutRoots.length === 0) {
    viewState.clipboardState = null;
    scheduleRender();
    setStatus("No cut nodes available.", true);
    return;
  }
  if (cutRoots.some((sourceId) => sourceId === targetParentId || isDescendant(targetParentId, sourceId))) {
    setStatus("Cannot paste cut nodes under their descendant.", true);
    return;
  }

  pushUndoSnapshot();
  cutRoots.forEach((sourceId) => {
    applyMoveByParentAndIndex(sourceId, targetParentId, getNode(targetParentId).children.length, true, {
      withUndo: false,
      withTouch: false,
      withStatus: false,
    });
  });
  setSingleSelection(cutRoots[0]!, false);
  viewState.clipboardState = null;
  touchDocument();
  setStatus(`Moved ${cutRoots.length} cut node(s).`);
}

function clearCutClipboard(): boolean {
  if (viewState.clipboardState?.type !== "cut") {
    return false;
  }
  viewState.clipboardState = null;
  scheduleRender();
  setStatus("Cut pending cleared.");
  return true;
}

function canReparent(sourceId: string | null | undefined, targetParentId: string | null | undefined): boolean {
  return canDropUnderParent(sourceId, targetParentId);
}

function applyMoveByParentAndIndex(
  sourceId: string,
  targetParentId: string,
  targetIndex: number,
  expandParent: boolean,
  options?: { withUndo?: boolean; withTouch?: boolean; withStatus?: boolean }
): boolean {
  const withUndo = options?.withUndo ?? true;
  const withTouch = options?.withTouch ?? true;
  const withStatus = options?.withStatus ?? true;
  if (!canDropUnderParent(sourceId, targetParentId)) {
    return false;
  }
  const sourceNode = getNode(sourceId);
  const oldParent = getNode(sourceNode.parentId!);
  const newParent = getNode(targetParentId);

  const oldIndex = oldParent.children.indexOf(sourceId);
  let normalizedIndex = Math.max(0, Math.min(targetIndex, newParent.children.length));
  if (oldParent.id === newParent.id && oldIndex >= 0) {
    if (oldIndex < normalizedIndex) {
      normalizedIndex -= 1;
    }
    if (normalizedIndex === oldIndex) {
      return false;
    }
  }

  if (withUndo) {
    pushUndoSnapshot();
  }
  oldParent.children = oldParent.children.filter((id) => id !== sourceId);
  const boundedIndex = Math.max(0, Math.min(normalizedIndex, newParent.children.length));
  newParent.children.splice(boundedIndex, 0, sourceId);
  if (expandParent) {
    viewState.collapsedIds.delete(targetParentId);
    newParent.collapsed = false;
  }
  sourceNode.parentId = targetParentId;
  viewState.reparentSourceIds.delete(sourceId);
  if (withTouch) {
    touchDocument();
  }
  if (withStatus) {
    if (oldParent.id === newParent.id) {
      setStatus(`Reordered "${sourceNode.text}" in "${newParent.text}".`);
    } else {
      setStatus(`Moved "${sourceNode.text}" under "${newParent.text}".`);
    }
  }
  return true;
}

loadDefaultBtn?.addEventListener("click", async () => {
  try {
    await loadDefaultSample();
  } catch (err) {
    setStatus(`Default load failed (${(err as Error).message}). Use file picker.`, true);
  }
});


runAircraftVisualCheckBtn?.addEventListener("click", () => {
  runAircraftVisualCheck();
});

stopVisualCheckBtn?.addEventListener("click", () => {
  stopVisualCheck();
});

modeFlashBtn?.addEventListener("click", () => {
  setThinkingMode("flash");
});

modeRapidBtn?.addEventListener("click", () => {
  setThinkingMode("rapid");
});

modeDeepBtn?.addEventListener("click", () => {
  setThinkingMode("deep");
});

viewTreeBtn?.addEventListener("click", () => {
  setSurfaceViewMode("tree");
});

viewMindmapBtn?.addEventListener("click", () => {
  setSurfaceViewMode("mindmap");
});

viewLogicChartBtn?.addEventListener("click", () => {
  setSurfaceViewMode("logic-chart");
});

viewTimelineBtn?.addEventListener("click", () => {
  setSurfaceViewMode("timeline");
});

viewSystemBtn?.addEventListener("click", () => {
  setSurfaceViewMode("system");
});

viewScatterBtn?.addEventListener("click", () => {
  setSurfaceViewMode("scatter");
});

themeToggleBtn?.addEventListener("click", () => {
  toggleViewerTheme();
});

componentTabularToggleBtn?.addEventListener("click", () => {
  toggleSelectedTabularComponent();
});

window.addEventListener("m3e:set-theme", (event: Event) => {
  const theme = normalizeViewerTheme((event as CustomEvent<{ theme?: unknown }>).detail?.theme);
  applyViewerTheme(theme, { persist: true, announce: Boolean((event as CustomEvent<{ announce?: unknown }>).detail?.announce) });
});

window.addEventListener("m3e:toggle-theme", () => {
  toggleViewerTheme();
});

window.addEventListener("m3e:set-surface-layout", (event: Event) => {
  const detail = (event as CustomEvent<{
    mode?: SurfaceViewMode;
    density?: SurfaceLayoutDensity;
    direction?: SurfaceBranchDirection;
  }>).detail || {};
  if (detail.mode) {
    setSurfaceViewMode(detail.mode);
  }
  if (detail.density) {
    setSurfaceLayoutDensity(sanitizeSurfaceLayoutDensity(detail.density));
  }
  if (detail.direction) {
    setSurfaceBranchDirection(sanitizeSurfaceBranchDirection(detail.direction));
  }
});

window.addEventListener("m3e:set-layout-options", (event: Event) => {
  const detail = (event as CustomEvent<{
    direction?: SurfaceLayoutDirection;
    depthAlign?: SurfaceDepthAlign;
    edgeRoute?: SurfaceEdgeRoute;
    linkRoute?: SurfaceLinkRoute;
  }>).detail || {};
  setPublicLayoutOptions({
    direction: detail.direction,
    depthAlign: detail.depthAlign,
    edge: detail.edgeRoute ? { route: detail.edgeRoute } : undefined,
    link: detail.linkRoute ? { route: detail.linkRoute } : undefined,
  });
});

scatterNormalBtn?.addEventListener("click", () => setScatterToolMode("normal"));
scatterAddNodeBtn?.addEventListener("click", () => setScatterToolMode("add-node"));
scatterAddEdgeBtn?.addEventListener("click", () => setScatterToolMode("add-edge"));
scatterColorizeBtn?.addEventListener("click", () => setScatterToolMode("colorize"));
scatterDeleteBtn?.addEventListener("click", () => setScatterToolMode("delete"));
scatterAnimateBtn?.addEventListener("click", () => toggleScatterAnimation());
scatterReflowBtn?.addEventListener("click", () => {
  runScatterReflow(180);
  fitDocument();
});
scatterRepulsionInput?.addEventListener("input", () => {
  scatterRepulsion = Number(scatterRepulsionInput.value) || SCATTER_REPULSION_DEFAULT;
});
scatterRepulsionInput?.addEventListener("change", () => {
  runScatterReflow(60);
});
scatterEdgeLengthInput?.addEventListener("input", () => {
  scatterEdgeLength = Number(scatterEdgeLengthInput.value) || SCATTER_EDGE_LENGTH_DEFAULT;
});
scatterEdgeLengthInput?.addEventListener("change", () => {
  runScatterReflow(60);
});

penToolBtn?.addEventListener("click", () => {
  togglePenTool();
});

drawSelectBtn?.addEventListener("click", () => {
  setAnnotationTool("select");
  setStatus("Select tool.");
});

drawPenBtn?.addEventListener("click", () => {
  setAnnotationTool("pen");
  setStatus("Pen tool: draw on the map surface.");
});

drawHighlighterBtn?.addEventListener("click", () => {
  setAnnotationTool("highlighter");
  setStatus("Highlighter tool: drag to highlight.");
});

drawDateBtn?.addEventListener("click", () => {
  setAnnotationTool("date");
  setStatus("Date tool: click the map to place a date label.");
});

drawEraserBtn?.addEventListener("click", () => {
  setAnnotationTool("eraser");
  setStatus("Eraser tool: drag over annotations.");
});

penColorBtns.forEach((button) => {
  button.addEventListener("click", () => {
    activePenStrokeColor = safeAnnotationColor(button.dataset["penColor"], PEN_STROKE_COLOR);
    penColorBtns.forEach((candidate) => candidate.classList.toggle("is-active", candidate === button));
    if (annotationTool === "select") {
      setAnnotationTool("pen");
    }
  });
});

penWidthInput?.addEventListener("input", () => {
  const width = Number(penWidthInput.value);
  if (Number.isFinite(width) && width > 0) {
    activePenStrokeWidth = width;
  }
});

cameraFollowBtn?.addEventListener("click", () => {
  toggleCameraMove();
});
syncCameraMoveUi();

fileInput.addEventListener("change", (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files && target.files[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || "");
      const isMm = file.name.toLowerCase().endsWith(".mm");
      const isMd = isMarkdownFilename(file.name);
      if (isMd) {
        if (!map) {
          loadPayload(createEmptyDoc());
        }
        const scopeRootId = currentLinearMemoScopeId();
        linearNotesByScope[scopeRootId] = markdownToLinearText(text);
        syncLinearNotesToDocState();
        scheduleAutosave();
        renderLinearPanel();
        setStatus(`Imported .md file to Linear Text: ${file.name}`);
        return;
      }
      const payload = isMm ? parseMmText(text) : JSON.parse(text);
      loadPayload(payload);
      if (isMm) {
        setStatus(`Imported .mm file: ${file.name}`);
      }
    } catch (err) {
      setStatus(`Import error: ${(err as Error).message}`, true);
    }
  };
  reader.readAsText(file, "utf-8");
});

linearMenuToggleBtn?.addEventListener("click", (event: MouseEvent) => {
  event.preventDefault();
  linearMenuVisible = true;
  linearAdjustMenuOpen = !linearAdjustMenuOpen;
  syncLinearAdjustMenuUi();
});

linearFontDecBtn?.addEventListener("click", (event: MouseEvent) => {
  event.preventDefault();
  setLinearTextFontScale(linearTextFontScale - LINEAR_TEXT_FONT_SCALE_STEP);
});

linearFontIncBtn?.addEventListener("click", (event: MouseEvent) => {
  event.preventDefault();
  setLinearTextFontScale(linearTextFontScale + LINEAR_TEXT_FONT_SCALE_STEP);
});

linearFontResetBtn?.addEventListener("click", (event: MouseEvent) => {
  event.preventDefault();
  setLinearTextFontScale(1);
});

linearTextEl?.addEventListener("pointerdown", () => {
  linearMenuVisible = true;
  syncLinearAdjustMenuUi();
});

linearTextEl?.addEventListener("focus", () => {
  linearMenuVisible = true;
  syncLinearAdjustMenuUi();
});

linearTextEl?.addEventListener("input", () => {
  if (!map) {
    return;
  }
  const scopeRootId = currentLinearMemoScopeId();
  linearNotesByScope[scopeRootId] = linearTextEl.value;
  syncLinearNotesToDocState();
  scheduleAutosave();
  const templateText = buildLinearFromScope().text;
  linearDirty = linearTextEl.value !== templateText;
  if (linearMetaEl) {
    const scopeLabel = map.state.nodes[scopeRootId]?.text || scopeRootId;
    linearMetaEl.textContent = `scope memo: ${scopeLabel} | ${linearDirty ? "dirty" : "synced"}`;
  }
  if (linearApplyBtn) linearApplyBtn.disabled = !linearDirty;
  if (linearResetBtn) linearResetBtn.disabled = !linearDirty;
});

linearTextEl?.addEventListener("keydown", (event: KeyboardEvent) => {
  if (!map) {
    return;
  }
  if (isImeComposingEvent(event)) {
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    linearNotesByScope[currentLinearMemoScopeId()] = linearTextEl.value;
    syncLinearNotesToDocState();
    scheduleAutosave();
    setStatus("Linear memo saved in current scope.");
    return;
  }
});

linearPanelEl?.addEventListener("pointerup", () => {
  captureManualLinearPanelWidth();
  syncLinearPanelPosition();
  scheduleAutosave();
});

linearResizeHandleEl?.addEventListener("pointerdown", (event: PointerEvent) => {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  linearResizeState = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startCanvasWidth: linearPanelCanvasWidth,
  };
  linearResizeHandleEl.setPointerCapture(event.pointerId);
});

linearResizeHandleEl?.addEventListener("pointermove", (event: PointerEvent) => {
  if (!linearResizeState || event.pointerId !== linearResizeState.pointerId) {
    return;
  }
  event.preventDefault();
  const dx = event.clientX - linearResizeState.startClientX;
  const zoom = Math.max(0.0001, viewState.zoom);
  const nextWidth = linearResizeState.startCanvasWidth + dx / zoom;
  linearPanelCanvasWidth = Math.max(LINEAR_PANEL_WIDTH_MIN, Math.min(LINEAR_PANEL_WIDTH_MAX, nextWidth));
  syncLinearPanelPosition();
});

function endLinearResize(event: PointerEvent): void {
  if (!linearResizeState || event.pointerId !== linearResizeState.pointerId) {
    return;
  }
  event.preventDefault();
  linearResizeHandleEl?.releasePointerCapture(event.pointerId);
  linearResizeState = null;
  syncLinearPanelPosition();
  if (map) {
    map.state.linearPanelWidth = linearPanelCanvasWidth;
    scheduleAutosave();
  }
}

linearResizeHandleEl?.addEventListener("pointerup", endLinearResize);
linearResizeHandleEl?.addEventListener("pointercancel", endLinearResize);

linearApplyBtn?.addEventListener("click", () => {
  if (blockReadOnlyAction("Read-only link. Linear edits are disabled.")) {
    return;
  }
  if (!map || !linearDirty) {
    return;
  }
  applyLinearTextToScope();
});

linearResetBtn?.addEventListener("click", () => {
  linearDirty = false;
  renderLinearPanel();
  setStatus("Linear text reset to tree state.");
});

cloudPullBtn?.addEventListener("click", async () => {
  const pulled = await pullDocFromCloud(true);
  if (!pulled) {
    setStatus("Cloud map not found.", true);
  }
});

cloudPushBtn?.addEventListener("click", async () => {
  if (blockReadOnlyAction("Read-only link. Cloud push is disabled.")) {
    return;
  }
  await pushDocToCloud(true);
});

cloudUseLocalBtn?.addEventListener("click", async () => {
  if (blockReadOnlyAction("Read-only link. Force push is disabled.")) {
    return;
  }
  await pushDocToCloud(true, true);
});

cloudUseCloudBtn?.addEventListener("click", async () => {
  const pulled = await pullDocFromCloud(true);
  if (!pulled) {
    setStatus("Cloud map not found.", true);
  }
});

importFileBtn?.addEventListener("click", () => {
  if (blockReadOnlyAction("Read-only link. Import is disabled.")) {
    return;
  }
  fileInput.click();
});

importVaultBtn?.addEventListener("click", () => {
  if (blockReadOnlyAction("Read-only link. Import is disabled.")) {
    return;
  }
  void (async () => {
    try {
      const vaultPath = await promptVaultPath(vaultUiPrefs.vaultPath);
      if (!vaultPath) {
        return;
      }
      await runVaultImport(vaultPath);
    } catch (err) {
      setStatus(`Vault import failed (${(err as Error).message}).`, true);
    }
  })();
});

downloadBtn?.addEventListener("click", () => {
  if (!map) return;
  downloadJson();
});

downloadMmBtn?.addEventListener("click", () => {
  if (!map) return;
  downloadMm();
});

exportVaultBtn?.addEventListener("click", () => {
  void (async () => {
    try {
      const vaultPath = await promptVaultPath(vaultUiPrefs.vaultPath);
      if (!vaultPath) {
        return;
      }
      await runVaultExport(vaultPath);
    } catch (err) {
      setStatus(`Vault export failed (${(err as Error).message}).`, true);
    }
  })();
});

/* ── Hamburger & Export dropdown toggle ── */
function toggleDropdown(menu: HTMLElement | null, btn: HTMLElement | null): void {
  if (!menu || !btn) return;
  const open = menu.hidden;
  menu.hidden = !open;
  btn.setAttribute("aria-expanded", open ? "true" : "false");
}

hamburgerBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  closeToolbarMenus();
  toggleDropdown(hamburgerMenu, hamburgerBtn);
});

importBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  closeToolbarMenus();
  toggleDropdown(importMenu, importBtn);
});

exportBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  closeToolbarMenus();
  toggleDropdown(exportMenu, exportBtn);
});

integrateBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  closeToolbarMenus();
  toggleDropdown(integrateMenu, integrateBtn);
});

setVaultPathBtn?.addEventListener("click", () => {
  void promptVaultPath(vaultUiPrefs.vaultPath);
});

integrateVaultLiveBtn?.addEventListener("click", () => {
  if (blockReadOnlyAction("Read-only link. Live write is disabled.")) {
    return;
  }
  void (async () => {
    try {
      const vaultPath = await promptVaultPath(vaultUiPrefs.vaultPath);
      if (!vaultPath) {
        return;
      }
      await startVaultLiveIntegration(vaultPath);
    } catch (err) {
      setStatus(`Obsidian Live Mode failed (${(err as Error).message}).`, true);
    }
  })();
});

integrateStopBtn?.addEventListener("click", () => {
  void stopVaultLiveIntegration(true).catch((err) => {
    setStatus(`Failed to stop Obsidian Live Mode (${(err as Error).message}).`, true);
  });
});

v4PanelBtn?.addEventListener("click", () => {
  if (v4PanelVisible) {
    hideV4Panel();
    return;
  }
  showV4Panel();
});

v4PanelCloseBtn?.addEventListener("click", () => {
  hideV4Panel();
});

v4RefreshBtn?.addEventListener("click", () => {
  syncV4Panel(true);
});

v4AddStickyBtn?.addEventListener("click", () => {
  addV4DiscussionNode("sticky");
});

v4AddDecisionBtn?.addEventListener("click", () => {
  addV4DiscussionNode("decision");
});

v4CreateDraftBtn?.addEventListener("click", () => {
  void createV4MapifyDraft().catch((err) => {
    setStatus(`Mapify draft creation failed (${(err as Error).message}).`, true);
  });
});

v4ApplyDraftBtn?.addEventListener("click", () => {
  void applyLatestV4MapifyDraft().catch((err) => {
    setStatus(`Mapify draft apply failed (${(err as Error).message}).`, true);
  });
});

document.addEventListener("click", () => {
  closeToolbarMenus();
});

canvas.addEventListener("pointerdown", (event: PointerEvent) => {
  if (annotationTool !== "select") {
    return;
  }
  const targetEl = event.target as Element | null;
  const linkPortHandle = targetEl?.getAttribute("data-link-port-handle") as LinkEndpointKind | null;
  const handleLinkId = targetEl?.getAttribute("data-link-id") ?? null;
  if (map && handleLinkId && (linkPortHandle === "source" || linkPortHandle === "target") && event.button === 0) {
    event.preventDefault();
    event.stopPropagation();
    pushUndoSnapshot();
    selectedGraphLinkId = handleLinkId;
    linkPortDragState = {
      pointerId: event.pointerId,
      linkId: handleLinkId,
      endpoint: linkPortHandle,
      startX: event.clientX,
      startY: event.clientY,
      dragged: false,
    };
    canvas.setPointerCapture(event.pointerId);
    board.focus();
    return;
  }
  const linkPortChoice = targetEl?.getAttribute("data-link-port-choice") as LinkEndpointKind | null;
  const linkPortSide = sanitizeLinkPort(targetEl?.getAttribute("data-link-port-side"));
  const choiceLinkId = targetEl?.getAttribute("data-link-id") ?? null;
  if (map && choiceLinkId && (linkPortChoice === "source" || linkPortChoice === "target") && linkPortSide && event.button === 0) {
    event.preventDefault();
    event.stopPropagation();
    setGraphLinkEndpointPort(choiceLinkId, linkPortChoice, linkPortSide);
    touchDocument();
    setStatus(`Link ${linkPortChoice} port: ${linkPortSide}.`);
    board.focus();
    return;
  }
  const linkId = targetEl?.getAttribute("data-link-id") ?? null;
  if (map && currentSurfaceIsScatterMode() && linkId && event.button === 0) {
    event.preventDefault();
    event.stopPropagation();
    if (scatterToolMode === "delete") {
      deleteScatterEdge(linkId);
    } else if (map && currentSurfaceIsScatterMode() && scatterToolMode === "colorize") {
      colorizeScatterEdge(linkId);
    } else {
      selectGraphLink(linkId);
    }
    board.focus();
    return;
  }
  if (map && linkId && event.button === 0) {
    event.preventDefault();
    event.stopPropagation();
    selectGraphLink(linkId);
    return;
  }
  const collapseNodeId = (event.target as Element | null)?.getAttribute("data-collapse-node-id");
  if (collapseNodeId && event.button === 0) {
    event.preventDefault();
    setSingleSelection(collapseNodeId, false);
    if (viewState.collapsedIds.has(collapseNodeId)) {
      viewState.collapsedIds.delete(collapseNodeId);
      scheduleRender();
      setStatus("Expanded collapsed branch.");
    }
    board.focus();
    return;
  }
  const nodeId = (event.target as Element | null)?.getAttribute("data-node-id") ??
    ((event.target as HTMLElement | null)?.dataset?.["nodeId"] ?? null);
  if (map && currentSurfaceIsScatterMode() && !nodeId && event.button === 0) {
    if (scatterToolMode === "add-node") {
      event.preventDefault();
      addScatterNodeAt(event.clientX, event.clientY);
    }
    return;
  }
  if (!map || !nodeId || event.button !== 0) {
    return;
  }
  if (currentSurfaceIsScatterMode()) {
    if (scatterToolMode === "normal" && viewState.collapsedIds.has(nodeId)) {
      const node = map.state.nodes[nodeId];
      if (node && (node.children || []).length > 0) {
        event.preventDefault();
        viewState.collapsedIds.delete(nodeId);
        node.collapsed = false;
        setSingleSelection(nodeId, false);
        runScatterReflow(60, { withUndo: false, withTouch: true });
        setStatus("Expanded scatter group.");
        board.focus();
        return;
      }
    }
    if (scatterToolMode === "delete") {
      event.preventDefault();
      setSingleSelection(nodeId, false);
      deleteSelected();
      board.focus();
      return;
    }
    if (scatterToolMode === "colorize") {
      event.preventDefault();
      setSingleSelection(nodeId, false);
      showColorPalette();
      board.focus();
      return;
    }
    if (scatterToolMode === "add-edge") {
      event.preventDefault();
      if (!viewState.linkSourceNodeId) {
        setSingleSelection(nodeId, false);
        markLinkSource();
      } else {
        const sourceId = viewState.linkSourceNodeId;
        setSingleSelection(nodeId, false);
        if (createGraphLinkBetween(sourceId, nodeId)) {
          viewState.linkSourceNodeId = "";
          scheduleRender();
        }
      }
      board.focus();
      return;
    }
    const rootIds = viewState.selectedNodeIds.has(nodeId)
      ? getMovableSelectionRoots(viewState.selectedNodeIds)
      : getMovableSelectionRoots(new Set([nodeId]));
    viewState.dragState = {
      mode: "scatter",
      pointerId: event.pointerId,
      sourceNodeId: nodeId,
      sourceRootIds: rootIds,
      proposal: null,
      startX: event.clientX,
      startY: event.clientY,
      dragged: false,
      toggleKey: event.ctrlKey || event.metaKey,
      shiftKey: event.shiftKey,
      startViews: scatterDragStartViews(rootIds),
    };
    canvas.setPointerCapture(event.pointerId);
    return;
  }

  if (isReadOnlyLink()) {
    event.preventDefault();
    setSingleSelection(nodeId, event.shiftKey);
    board.focus();
    scheduleRender();
    return;
  }
  viewState.dragState = {
    mode: "structure",
    pointerId: event.pointerId,
    sourceNodeId: nodeId,
    sourceRootIds: viewState.selectedNodeIds.has(nodeId)
      ? getMovableSelectionRoots(viewState.selectedNodeIds)
      : getMovableSelectionRoots(new Set([nodeId])),
    proposal: null,
    startX: event.clientX,
    startY: event.clientY,
    dragged: false,
    toggleKey: event.ctrlKey || event.metaKey,
    shiftKey: event.shiftKey,
  };
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener("pointermove", (event: PointerEvent) => {
  if (linkPortDragState && event.pointerId === linkPortDragState.pointerId) {
    const dx = event.clientX - linkPortDragState.startX;
    const dy = event.clientY - linkPortDragState.startY;
    if (!linkPortDragState.dragged && Math.hypot(dx, dy) < VIEWER_TUNING.drag.reparentThreshold) {
      return;
    }
    linkPortDragState.dragged = true;
    setGraphLinkEndpointPortNearPointer(linkPortDragState.linkId, linkPortDragState.endpoint, event.clientX, event.clientY);
    return;
  }
  if (!viewState.dragState || event.pointerId !== viewState.dragState.pointerId) {
    return;
  }
  const dx = event.clientX - viewState.dragState.startX;
  const dy = event.clientY - viewState.dragState.startY;
  const distance = Math.hypot(dx, dy);
  if (!viewState.dragState.dragged && distance < VIEWER_TUNING.drag.reparentThreshold) {
    return;
  }
  if (!viewState.dragState.dragged && viewState.dragState.mode === "scatter") {
    if (scatterAnimationEnabled) {
      scatterAnimationEnabled = false;
      stopScatterAnimation(true);
      syncScatterToolbarUi();
    }
    pushUndoSnapshot();
  }
  viewState.dragState.dragged = true;
  if (viewState.dragState.mode === "scatter") {
    syncMapModelStateFromRuntime();
    const startViews = viewState.dragState.startViews || {};
    const canvasDx = dx / viewState.zoom;
    const canvasDy = dy / viewState.zoom;
    viewState.dragState.sourceRootIds.forEach((nodeId) => {
      const start = startViews[nodeId];
      if (!start) return;
      const view = ensureSurfaceNodeView(nodeId);
      if (!view) return;
      view.x = Math.round(start.x + canvasDx);
      view.y = Math.round(start.y + canvasDy);
    });
    scheduleRender();
    return;
  }
  viewState.dragState.proposal = proposeDropForSources(viewState.dragState.sourceRootIds, event.clientX, event.clientY);
  scheduleRender();
});

function finishNodeDrag(event: PointerEvent): void {
  if (linkPortDragState && event.pointerId === linkPortDragState.pointerId) {
    const { linkId, endpoint, dragged } = linkPortDragState;
    if (!dragged) {
      setGraphLinkEndpointPortNearPointer(linkId, endpoint, event.clientX, event.clientY);
    }
    linkPortDragState = null;
    canvas.releasePointerCapture(event.pointerId);
    touchDocument();
    setStatus("Link port updated.");
    board.focus();
    return;
  }
  if (!viewState.dragState || event.pointerId !== viewState.dragState.pointerId) {
    return;
  }
  const { sourceNodeId, sourceRootIds, proposal, dragged, mode } = viewState.dragState;
  const { toggleKey, shiftKey } = viewState.dragState;
  viewState.dragState = null;
  canvas.releasePointerCapture(event.pointerId);

  if (!dragged) {
    selectByPointerModifiers(sourceNodeId, {
      toggle: toggleKey,
      range: shiftKey,
    });
    board.focus();
    return;
  }

  if (mode === "scatter") {
    touchDocument();
    setStatus("Scatter position updated.");
    board.focus();
    return;
  }

  if (proposal) {
    if (proposal.kind === "reparent" && sourceRootIds.length > 1) {
      pushUndoSnapshot();
      let movedCount = 0;
      sourceRootIds.forEach((sourceId) => {
        const applied = applyMoveByParentAndIndex(sourceId, proposal.parentId, getNode(proposal.parentId).children.length, false, {
          withUndo: false,
          withTouch: false,
          withStatus: false,
        });
        if (applied) {
          movedCount += 1;
        }
      });
      if (movedCount > 0) {
        setSingleSelection(proposal.parentId, false);
        touchDocument();
        setStatus(`Moved ${movedCount} node(s).`);
        board.focus();
        return;
      }
    } else {
      const applied = proposal.kind === "reparent"
        ? applyMoveByParentAndIndex(sourceNodeId, proposal.parentId, getNode(proposal.parentId).children.length, false)
        : applyMoveByParentAndIndex(sourceNodeId, proposal.parentId, proposal.index, false);
      if (applied) {
        setSingleSelection(sourceNodeId, false);
        scheduleRender();
        board.focus();
        return;
      }
    }
  }

  setStatus("No valid drop target.", true);
  scheduleRender();
  board.focus();
}

canvas.addEventListener("pointerup", finishNodeDrag);
canvas.addEventListener("pointercancel", finishNodeDrag);
canvas.addEventListener("dblclick", (event: MouseEvent) => {
  const nodeId = (event.target as Element | null)?.getAttribute("data-node-id") ??
    ((event.target as HTMLElement | null)?.dataset?.["nodeId"] ?? null);
  if (!map || !nodeId) {
    return;
  }
  selectNode(nodeId);
  startInlineEdit(nodeId, { selectAll: false });
});

// Right-click context menu for scope lock on folder nodes
canvas.addEventListener("contextmenu", (event: MouseEvent) => {
  const target = event.target as Element | null;
  const nodeId = target?.closest("[data-node-id]")?.getAttribute("data-node-id");
  if (!nodeId || !map) {
    return;
  }
  const node = map.state.nodes[nodeId];
  if (!node || !isFolderNode(node)) {
    return;
  }
  event.preventDefault();
  showScopeLockContextMenu(event.clientX, event.clientY, nodeId);
});

board.addEventListener("wheel", (event: WheelEvent) => {
  if ((event.target as HTMLElement | null)?.closest(".linear-panel")) {
    return;
  }
  event.preventDefault();
  cancelCameraMotion();
  // Normalize deltas to pixels so zoom/pan feel identical across browsers and
  // operating systems. deltaMode=0 (pixel) is left as-is — that is the Mac
  // trackpad baseline everything else is scaled to match.
  const { deltaX, deltaY } = normalizedWheelDeltas(event);
  if (routingSwitcherOpen && routingScopeHoldDown && !event.ctrlKey && !event.metaKey) {
    routePanMoveRoutingScope(deltaX, deltaY);
    return;
  }
  if (routingPanKeyDown && !event.ctrlKey && !event.metaKey) {
    routePanMoveActiveNode(deltaX, deltaY);
    return;
  }
  if (!event.ctrlKey && !event.metaKey) {
    viewState.cameraX -= deltaX * VIEWER_TUNING.pan.wheelFactor;
    viewState.cameraY -= deltaY * VIEWER_TUNING.pan.wheelFactor;
    scheduleApplyZoom();
    return;
  }
  const intensity = Math.min(
    VIEWER_TUNING.zoom.wheelIntensityCap,
    Math.abs(deltaY) / VIEWER_TUNING.zoom.wheelIntensityDivisor
  );
  const factor = Math.exp(-Math.sign(deltaY) * intensity);
  scheduleSetZoom((_pendingZoom ?? viewState.zoom) * factor, event.clientX, event.clientY);
}, { passive: false });

// --- Pointer-based pan & pinch-to-zoom ---
// Tracks all active touch pointers for multi-touch pinch detection.
const activePointers = new Map<number, { x: number; y: number }>();

function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function startPinch(): void {
  const ids = Array.from(activePointers.keys());
  if (ids.length < 2) return;
  const a = activePointers.get(ids[0])!;
  const b = activePointers.get(ids[1])!;
  // Cancel single-finger pan
  if (viewState.panState) {
    viewState.panState = null;
    board.classList.remove("panning");
  }
  viewState.pinchState = {
    pointerA: { id: ids[0], x: a.x, y: a.y },
    pointerB: { id: ids[1], x: b.x, y: b.y },
    initialDistance: pointerDistance(a, b),
    initialZoom: viewState.zoom,
    initialCameraX: viewState.cameraX,
    initialCameraY: viewState.cameraY,
    initialCenterX: (a.x + b.x) / 2,
    initialCenterY: (a.y + b.y) / 2,
  };
}

board.addEventListener("pointerdown", (event: PointerEvent) => {
  if (event.button !== 0) {
    return;
  }
  if ((event.target as HTMLElement | null)?.closest(".linear-panel")) {
    return;
  }
  if (isStrokeAnnotationTool(annotationTool)) {
    startPenStroke(event);
    return;
  }
  if (annotationTool === "date") {
    addDateAnnotationAt(event);
    return;
  }
  if (annotationTool === "eraser") {
    startEraserStroke(event);
    return;
  }
  cancelCameraMotion();

  // Track touch pointers for pinch
  if (event.pointerType === "touch") {
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    board.setPointerCapture(event.pointerId);
    if (activePointers.size === 2) {
      startPinch();
      return;
    }
  }

  const onNode = (event.target as HTMLElement | null)?.dataset?.["nodeId"];
  if (onNode) {
    return;
  }
  viewState.panState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    cameraX: viewState.cameraX,
    cameraY: viewState.cameraY,
  };
  board.classList.add("panning");
  board.setPointerCapture(event.pointerId);
});

board.addEventListener("pointermove", (event: PointerEvent) => {
  if (updatePenStroke(event)) {
    return;
  }
  if (updateEraserStroke(event)) {
    return;
  }

  // Update tracked pointer position
  if (event.pointerType === "touch" && activePointers.has(event.pointerId)) {
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  // Pinch-zoom handling
  if (viewState.pinchState) {
    const { pointerA, pointerB } = viewState.pinchState;
    if (event.pointerId !== pointerA.id && event.pointerId !== pointerB.id) return;
    const a = activePointers.get(pointerA.id);
    const b = activePointers.get(pointerB.id);
    if (!a || !b) return;

    const currentDistance = pointerDistance(a, b);
    const scale = currentDistance / viewState.pinchState.initialDistance;
    const nextZoom = viewState.pinchState.initialZoom * scale;

    // Zoom anchored to the current midpoint of the two fingers
    const anchorX = (a.x + b.x) / 2;
    const anchorY = (a.y + b.y) / 2;
    scheduleSetZoom(nextZoom, anchorX, anchorY);
    return;
  }

  // Single-pointer pan
  if (!viewState.panState || event.pointerId !== viewState.panState.pointerId) {
    return;
  }
  cancelCameraMotion();
  viewState.cameraX = viewState.panState.cameraX + (event.clientX - viewState.panState.startX);
  viewState.cameraY = viewState.panState.cameraY + (event.clientY - viewState.panState.startY);
  scheduleApplyZoom();
});

function endPointer(event: PointerEvent): void {
  if (finishPenStroke(event)) {
    return;
  }
  if (finishEraserStroke(event)) {
    return;
  }

  // Clean up pinch state
  if (event.pointerType === "touch") {
    activePointers.delete(event.pointerId);
    if (viewState.pinchState) {
      viewState.pinchState = null;
      // If one finger remains, start a fresh pan from current position
      if (activePointers.size === 1) {
        const [remainingId, pos] = Array.from(activePointers.entries())[0];
        viewState.panState = {
          pointerId: remainingId,
          startX: pos.x,
          startY: pos.y,
          cameraX: viewState.cameraX,
          cameraY: viewState.cameraY,
        };
        board.classList.add("panning");
      }
      return;
    }
  }

  // Clean up pan state
  if (viewState.panState && event.pointerId === viewState.panState.pointerId) {
    viewState.panState = null;
    board.classList.remove("panning");
  }

  try { board.releasePointerCapture(event.pointerId); } catch { /* already released */ }
}

board.addEventListener("pointerup", endPointer);
board.addEventListener("pointercancel", endPointer);

document.addEventListener("pointerdown", (event: PointerEvent) => {
  const target = event.target as HTMLElement | null;
  if (target?.closest(".linear-panel")) {
    return;
  }
  linearMenuVisible = false;
  linearAdjustMenuOpen = false;
  syncLinearAdjustMenuUi();
});

document.addEventListener("keydown", (event: KeyboardEvent) => {
  if (!map) {
    return;
  }
  if (isImeComposingEvent(event)) {
    return;
  }

  if (templateCompletionState && event.key === "Escape") {
    event.preventDefault();
    hideTemplateCompletion();
    return;
  }

  if (entityListVisible && event.key === "Escape") {
    event.preventDefault();
    hideEntityListPanel();
    return;
  }

  if (conflictPanelVisible && event.key === "Escape") {
    event.preventDefault();
    hideConflictPanel();
    return;
  }

  if (homeScreenVisible && event.key === "Escape") {
    event.preventDefault();
    hideHomeScreen();
    return;
  }

  if (activeColorPalette && event.key === "Escape") {
    event.preventDefault();
    hideColorPalette();
    return;
  }

  if (linearAdjustMenuOpen && event.key === "Escape") {
    linearMenuVisible = false;
    linearAdjustMenuOpen = false;
    syncLinearAdjustMenuUi();
    event.preventDefault();
    return;
  }

  if (inlineEditor && document.activeElement === inlineEditor.input) {
    return;
  }
  if (inlineEdgeLabelEditor && document.activeElement === inlineEdgeLabelEditor.input) {
    return;
  }

  if (document.activeElement === linearTextEl) {
    return;
  }

  if (isReadOnlyLink() && !isReadOnlyAllowedKey(event)) {
    event.preventDefault();
    setStatus("Read-only link. Use the editor link to change this map.", true);
    return;
  }

  if (routingSwitcherOpen) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeRoutingSwitcher();
      setStatus("Routing closed.");
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      routingSwitcherLane = "scope";
      syncRoutingSwitcher();
      setStatus("Routing: active scope.");
      return;
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === "Enter") {
      event.preventDefault();
      applyRoutingSwitcherRoute();
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      if (routingSwitcherLane === "scope") {
        if (event.key === "ArrowLeft") {
          moveRoutingScopeHorizontal("parent");
        } else {
          moveRoutingScope(-1);
        }
      } else {
        moveRoutingNode(-1);
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      if (routingSwitcherLane === "scope") {
        if (event.key === "ArrowRight") {
          moveRoutingScopeHorizontal("child");
        } else {
          moveRoutingScope(1);
        }
      } else {
        moveRoutingNode(1);
      }
      return;
    }
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.shiftKey && event.key.toLowerCase() === "r") {
    event.preventDefault();
    if (!event.repeat) {
      routingScopeHoldDown = true;
      routingWheelCarryX = 0;
      routingWheelCarryY = 0;
      openRoutingSwitcher("scope");
    }
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "r" && !viewState.reviewMode) {
    event.preventDefault();
    if (!event.repeat) {
      routingPanKeyDown = true;
      routingWheelCarryX = 0;
      routingWheelCarryY = 0;
      setStatus("Routing pan: active node.");
    }
    return;
  }

  if (
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.shiftKey &&
    !event.repeat &&
    event.key.toLowerCase() === "t" &&
    !isTextEntryElement(event.target)
  ) {
    event.preventDefault();
    showTemplateCompletion();
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.shiftKey && event.key.toLowerCase() === "p") {
    event.preventDefault();
    togglePenTool();
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.shiftKey && event.key.toLowerCase() === "h") {
    event.preventDefault();
    setAnnotationTool(annotationTool === "highlighter" ? "select" : "highlighter");
    setStatus(annotationTool === "highlighter" ? "Highlighter tool: drag to highlight." : "Drawing tool off.");
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.shiftKey && event.key.toLowerCase() === "d") {
    event.preventDefault();
    setAnnotationTool(annotationTool === "date" ? "select" : "date");
    setStatus(annotationTool === "date" ? "Date tool: click the map to place a date label." : "Drawing tool off.");
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.shiftKey && event.key.toLowerCase() === "e") {
    event.preventDefault();
    setAnnotationTool(annotationTool === "eraser" ? "select" : "eraser");
    setStatus(annotationTool === "eraser" ? "Eraser tool: drag over annotations." : "Drawing tool off.");
    return;
  }

  if (annotationTool !== "select" && event.key === "Escape") {
    event.preventDefault();
    if (penDraft) {
      cancelPenStroke(true);
    } else {
      setAnnotationTool("select");
      setStatus("Drawing tool off.");
    }
    return;
  }

  if (currentSurfaceIsScatterMode() && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
    const key = event.key.toLowerCase();
    if (key === "escape") {
      event.preventDefault();
      setScatterToolMode("normal");
      return;
    }
    if (key === "a") {
      event.preventDefault();
      toggleScatterAnimation();
      return;
    }
    if (key === "v") {
      event.preventDefault();
      setScatterToolMode("add-node");
      return;
    }
    if (key === "e") {
      event.preventDefault();
      setScatterToolMode("add-edge");
      return;
    }
    if (key === "c") {
      event.preventDefault();
      setScatterToolMode("colorize");
      return;
    }
    if (key === "d") {
      event.preventDefault();
      setScatterToolMode("delete");
      return;
    }
  }

  // ── Review Mode keybindings ──
  if (viewState.reviewMode) {
    if (event.key === "Escape") {
      event.preventDefault();
      viewState.reviewMode = false;
      setStatus("Review mode off.");
      render();
      return;
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
      if (event.key === "a") {
        event.preventDefault();
        reviewAccept();
        return;
      }
      if (event.key === "x") {
        event.preventDefault();
        reviewReject();
        return;
      }
      if (event.key === "e") {
        event.preventDefault();
        reviewExplain();
        return;
      }
    }
    // Arrow keys fall through to normal navigation
  }
  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undoLastChange();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && (event.shiftKey && event.key.toLowerCase() === "z")) {
    event.preventDefault();
    redoLastChange();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "y") {
    event.preventDefault();
    redoLastChange();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "a") {
    event.preventDefault();
    selectAllVisibleInScope();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "c") {
    event.preventDefault();
    void copySelected();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "x") {
    event.preventDefault();
    cutSelected();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "v") {
    event.preventDefault();
    void pasteClipboard();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key === "Enter") {
    event.preventDefault();
    // Equivalent to Esc -> DownArrow -> Enter in normal mode.
    clearCutClipboard();
    selectBreadth(1);
    startInlineEdit(viewState.selectedNodeId, { selectAll: false });
    return;
  }

  if (event.key === "Escape") {
    if (clearCutClipboard()) {
      event.preventDefault();
    }
    return;
  }

  if (event.key === "Tab") {
    event.preventDefault();
    createNodeByDirectionAndEdit("depth");
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    startInlineEdit(viewState.selectedNodeId, { selectAll: event.shiftKey });
    return;
  }

  if (event.key === "F2") {
    event.preventDefault();
    startInlineEdit(viewState.selectedNodeId, { selectAll: true });
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
    if (event.key === "1") {
      event.preventDefault();
      setThinkingMode("flash");
      return;
    }
    if (event.key === "2") {
      event.preventDefault();
      setThinkingMode("rapid");
      return;
    }
    if (event.key === "3") {
      event.preventDefault();
      setThinkingMode("deep");
      return;
    }
  }

  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "s") {
    event.preventDefault();
    downloadJson();
    return;
  }

  if (isCopyNodePathShortcut(event)) {
    event.preventDefault();
    void copyNodePath();
    return;
  }

  if (isCopyScopeIdShortcut(event)) {
    event.preventDefault();
    void copyScopeId();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === "t") {
    event.preventDefault();
    void generateRelatedTopicsForSelectedNode();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === "d") {
    event.preventDefault();
    showScopeDashboard();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key === "0") {
    event.preventDefault();
    fitDocument();
    return;
  }

  if (viewState.selectedLinkId && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (event.key === "[") {
      event.preventDefault();
      cycleSelectedGraphLinkPort("source");
      return;
    }
    if (event.key === "]") {
      event.preventDefault();
      cycleSelectedGraphLinkPort("target");
      return;
    }
  }

  if (!event.shiftKey && !event.altKey && event.key === "]") {
    event.preventDefault();
    EnterScopeCommand(viewState.selectedNodeId);
    board.focus();
    return;
  }

  if (!event.shiftKey && !event.altKey && event.key === "[") {
    event.preventDefault();
    ExitScopeCommand();
    board.focus();
    return;
  }

  if (event.key === "Delete" || event.key === "Backspace") {
        if (
          event.key === "Backspace" &&
          !inlineEditor &&
          viewState.scopeHistory.length > 0 &&
          viewState.selectedNodeId === normalizedCurrentScopeId()
        ) {
          event.preventDefault();
          ExitScopeCommand();
          return;
        }
    event.preventDefault();
    deleteSelected();
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key === "-") {
    event.preventDefault();
    setZoom(viewState.zoom / VIEWER_TUNING.zoom.buttonFactor);
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && (event.key === "=" || event.key === "+")) {
    event.preventDefault();
    setZoom(viewState.zoom * VIEWER_TUNING.zoom.buttonFactor);
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key === "0") {
    event.preventDefault();
    setZoom(1);
    return;
  }

      if (event.altKey && event.key === "Enter") {
        event.preventDefault();
        EnterScopeCommand();
        return;
      }

  if (event.altKey && event.key.toLowerCase() === "e") {
    event.preventDefault();
    toggleEntityListPanel();
    return;
  }

  if (event.altKey && event.key.toLowerCase() === "d") {
    event.preventDefault();
    toggleMarkdownPreviewForSelectedNode();
    return;
  }

  if (event.altKey && event.key.toLowerCase() === "h") {
    event.preventDefault();
    window.location.href = buildHomeHref();
    return;
  }

  if (event.altKey && event.key.toLowerCase() === "s") {
    event.preventDefault();
    toggleHomeScreen();
    return;
  }

  if (event.altKey && event.key.toLowerCase() === "v") {
    event.preventDefault();
    if (cycleViewState === "focus") {
      if (map && viewState.selectedNodeId) {
        centerOnNode(viewState.selectedNodeId, Math.max(1, viewState.zoom));
        setStatus("Focus: centered on selected node.");
      }
      cycleViewState = "fit";
    } else {
      fitDocument();
      setStatus("Fit all.");
      cycleViewState = "focus";
    }
    return;
  }

  if (event.altKey && event.key.toLowerCase() === "j") {
    event.preventDefault();
    jumpToAliasTarget();
    return;
  }

  if (event.altKey && event.key.toLowerCase() === "l") {
    event.preventDefault();
    editEdgeLabelForSelectedNode();
    return;
  }

  if (event.altKey && event.key.toLowerCase() === "a") {
    event.preventDefault();
    addAliasAsChild();
    return;
  }

  if (event.altKey && event.key.toLowerCase() === "p") {
    event.preventDefault();
    makeSelectedFolder();
    return;
  }

  if (event.altKey && event.key.toLowerCase() === "m") {
    event.preventDefault();
    toggleHoldReparent();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "m") {
    event.preventDefault();
    if (!event.repeat) {
      toggleReparentSource();
    }
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "a") {
    event.preventDefault();
    if (!event.repeat) {
      addAliasAsChild();
    }
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "f") {
    event.preventDefault();
    makeSelectedFolder();
    return;
  }

  // Node color decoration (Phase 1, Miro-style)
  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key === "c") {
    event.preventDefault();
    showColorPalette();
    return;
  }
  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.shiftKey && event.key === "C") {
    event.preventDefault();
    clearDecorationOnSelection();
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "i") {
    event.preventDefault();
    toggleMetaPanelVisibility();
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === "?") {
    event.preventDefault();
    copyNodeQueryToClipboard();
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "j") {
    event.preventDefault();
    if (currentSurfaceIsFlowMode()) {
      flowSurfaceDetailLevel = Math.min(FLOW_SURFACE_PREVIEW_MAX_DETAIL, flowSurfaceDetailLevel + 1);
      render();
      setStatus(`System detail ${flowSurfaceDetailLevel}/${FLOW_SURFACE_PREVIEW_MAX_DETAIL}`);
      return;
    }
    const selected = getNode(viewState.selectedNodeId);
    if (isFolderNode(selected) && selected.id !== normalizedCurrentScopeId()) {
      EnterScopeCommand(selected.id);
      return;
    }
    selectChild();
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (currentSurfaceIsFlowMode()) {
      flowSurfaceDetailLevel = Math.max(0, flowSurfaceDetailLevel - 1);
      render();
      setStatus(`System detail ${flowSurfaceDetailLevel}/${FLOW_SURFACE_PREVIEW_MAX_DETAIL}`);
      return;
    }
    if (viewState.selectedNodeId === normalizedCurrentScopeId() && viewState.scopeHistory.length > 0) {
      ExitScopeCommand();
      return;
    }
    selectParent();
    return;
  }

  if (event.key.toLowerCase() === "m") {
    event.preventDefault();
    if (!event.repeat) {
      toggleReparentSource();
    }
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.shiftKey && event.key.toLowerCase() === "l") {
    event.preventDefault();
    applyMarkedLink();
    return;
  }

  if (!event.ctrlKey && !event.metaKey && event.altKey && !event.shiftKey && event.key.toLowerCase() === "l") {
    event.preventDefault();
    startIncomingEdgeLabelEdit();
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "l") {
    event.preventDefault();
    if (!event.repeat) {
      markLinkSource();
    }
    return;
  }

  if (event.key.toLowerCase() === "p") {
    event.preventDefault();
    applyReparent();
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "e") {
    event.preventDefault();
    toggleCollapse();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (event.shiftKey) {
      extendSelectionBreadth(-1);
      return;
    }
    if (currentSurfaceIsFlowMode()) {
      selectFlowVertical(-1);
      return;
    }
    selectBreadth(-1);
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (event.shiftKey) {
      extendSelectionBreadth(1);
      return;
    }
    if (currentSurfaceIsFlowMode()) {
      selectFlowVertical(1);
      return;
    }
    selectBreadth(1);
    return;
  }

  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "g") {
    event.preventDefault();
    groupSelected();
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    if (currentSurfaceIsFlowMode()) {
      selectFlowHorizontal(-1);
      return;
    }
    if (viewState.selectedNodeId === normalizedCurrentScopeId() && viewState.scopeHistory.length > 0) {
      ExitScopeCommand();
      return;
    }
    selectParent();
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    const selected = getNode(viewState.selectedNodeId);
    if (currentSurfaceIsFlowMode()) {
      selectFlowHorizontal(1);
      return;
    }
    if (isFolderNode(selected) && selected.id !== normalizedCurrentScopeId()) {
      EnterScopeCommand(selected.id);
      return;
    }
    selectChild();
  }
});

document.addEventListener("keyup", (event: KeyboardEvent) => {
  const key = event.key.toLowerCase();
  if (routingScopeHoldDown && (key === "r" || event.key === "Shift")) {
    if (routingSwitcherOpen) {
      const routed = applyRoutingSwitcherRoute();
      if (routed) {
        return;
      }
    }
    routingScopeHoldDown = false;
    routingWheelCarryX = 0;
    routingWheelCarryY = 0;
    if (routingSwitcherOpen) {
      closeRoutingSwitcher();
    }
    return;
  }
  if (key === "r" && routingPanKeyDown) {
    routingPanKeyDown = false;
    routingWheelCarryX = 0;
    routingWheelCarryY = 0;
  }
});

window.addEventListener("blur", () => {
  routingPanKeyDown = false;
  routingScopeHoldDown = false;
  routingWheelCarryX = 0;
  routingWheelCarryY = 0;
  if (routingSwitcherOpen) {
    closeRoutingSwitcher();
  }
});

/* ── Shortcut cheatsheet: show on Ctrl/Alt hold ── */
{
  let cheatsheetTimer: ReturnType<typeof setTimeout> | null = null;
  const HOLD_MS = 400;

  function showCheatsheet(): void {
    if (!cheatsheetEl) return;
    cheatsheetEl.hidden = false;
  }

  function hideCheatsheet(): void {
    if (!cheatsheetEl) return;
    cheatsheetEl.hidden = true;
  }

  function clearTimer(): void {
    if (cheatsheetTimer !== null) {
      clearTimeout(cheatsheetTimer);
      cheatsheetTimer = null;
    }
  }

  document.addEventListener("keydown", (event: KeyboardEvent) => {
    // Only trigger on bare Ctrl or Alt (no other modifier, no repeat)
    if (event.repeat) return;
    const isBareMod =
      (event.key === "Control" && !event.altKey && !event.shiftKey) ||
      (event.key === "Alt" && !event.ctrlKey && !event.metaKey && !event.shiftKey);
    if (!isBareMod) {
      clearTimer();
      return;
    }
    if (cheatsheetTimer === null) {
      cheatsheetTimer = setTimeout(showCheatsheet, HOLD_MS);
    }
  });

  document.addEventListener("keyup", (event: KeyboardEvent) => {
    if (event.key === "Control" || event.key === "Alt" || event.key === "Meta") {
      clearTimer();
      if (cheatsheetEl && !cheatsheetEl.hidden) {
        hideCheatsheet();
      }
    }
  });

  // Also hide if window loses focus
  window.addEventListener("blur", () => {
    clearTimer();
    if (cheatsheetEl && !cheatsheetEl.hidden) {
      hideCheatsheet();
    }
  });
}

setVisualCheckStatus("Visual check idle");
syncMetaPanelToggleUi();
loadVaultUiPrefs();
loadLocalFsPrefs();
syncVaultUi();
syncAccessModeUi();
updateCloudSyncUi();

void initializeDocument().then(() => {
  if (fatalLoadError || !map) {
    return;
  }
  initClipboardSync();
  if (!LOCAL_FS_VIEW_MODE) {
    initBroadcastSync();
    initVisibilityManagedLiveStreams();
    void fetchVaultWatchStatus().then(() => {
      if (vaultUiPrefs.integrationMode === "obsidian-live" && vaultUiPrefs.vaultPath && !vaultWatchRunning) {
        void startVaultLiveIntegration(vaultUiPrefs.vaultPath).catch((err) => {
          setStatus(`Obsidian Live Mode resume failed (${(err as Error).message}).`, true);
        });
      }
    });
    void fetchCollabConfig().then(() => {
      tryCollabRegister();
    });
  }
  const initialScopeId = firstQueryParam(queryParams, ["scope", "scopeId"]);
  if (initialScopeId && map && map.state.nodes[initialScopeId] && initialScopeId !== map.state.rootId) {
    // Build ancestor chain so ExitScopeCommand can step back through each level
    const ancestors: string[] = [];
    let cur = map.state.nodes[initialScopeId];
    while (cur && cur.parentId && cur.id !== map.state.rootId) {
      ancestors.unshift(cur.parentId);
      cur = map.state.nodes[cur.parentId];
    }
    viewState.scopeHistory = ancestors;
    viewState.currentScopeId = initialScopeId;
    viewState.currentScopeRootId = initialScopeId;
    viewState.surfaceViewMode = inferSurfaceViewModeForScope(initialScopeId);
    viewState.surfaceLayoutDensity = inferSurfaceLayoutDensityForScope(initialScopeId, viewState.surfaceViewMode);
    viewState.surfaceBranchDirection = inferSurfaceBranchDirectionForScope(initialScopeId, viewState.surfaceViewMode);
    syncThinkingModeUi();
    setSingleSelection(initialScopeId, false);
    normalizeSelectionState();
    render();
    updateScopeInUrl(initialScopeId);
    setStatus(`Loaded scope: ${uiLabel(map.state.nodes[initialScopeId])}. Use Exit scope to return to the map root.`);
  } else if (initialScopeId && map) {
    setStatus(`Scope not found: ${initialScopeId}. Loaded map root.`, true);
    updateScopeInUrl(map.state.rootId);
  }
  fitDocument({ animate: false }) || applyZoom();

  // Skip home screen — go straight to map root
  // To open home screen, user can press the toggle shortcut
});

window.addEventListener("beforeunload", () => {
  if (collabToken) {
    void unregisterCollabEntity(false);
  }
});

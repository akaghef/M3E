const fileInput = document.getElementById("file-input") as HTMLInputElement;
const loadDefaultBtn = document.getElementById("load-default");
const runAircraftVisualCheckBtn = document.getElementById("run-aircraft-visual-check");
const stopVisualCheckBtn = document.getElementById("stop-visual-check");
const modeFlashBtn = document.getElementById("mode-flash");
const modeRapidBtn = document.getElementById("mode-rapid");
const modeDeepBtn = document.getElementById("mode-deep");
const viewTreeBtn = document.getElementById("view-tree");
const viewSystemBtn = document.getElementById("view-system");
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

const queryParams = new URLSearchParams(window.location.search);
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
const LOCAL_MAP_ID = normalizeDocId(firstQueryParam(queryParams, ["map", "localMapId"]), DEFAULT_MAP_ID);
const CLOUD_MAP_ID = normalizeDocId(firstQueryParam(queryParams, ["cloud", "cloudMapId"]), LOCAL_MAP_ID);
const MAP_LABEL = MAP_META[LOCAL_MAP_ID]?.label ?? LOCAL_MAP_ID;
const MAP_SLUG = MAP_META[LOCAL_MAP_ID]?.slug ?? LOCAL_MAP_ID;
const COLLAB_PREFS_KEY = `m3e:collab:${WORKSPACE_ID}`;
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

interface BcStateMessage {
  type: "STATE_UPDATE";
  fromTabId: string;
  state: AppState;
  savedAt: string;
}

let bc: BroadcastChannel | null = null;
let lastServerSavedAt: string | null = null;

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
let visibleOrder: string[] = [];
let statusTimer: ReturnType<typeof setTimeout> | null = null;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let cycleViewState: "focus" | "fit" = "focus";
let inlineEditor: { nodeId: string; input: HTMLTextAreaElement; mode: "node-text" | "alias-label" | "target-text" } | null = null;
let contentWidth = 1600;
let contentHeight = 900;

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
  sourceOfTruth: "vault-md";
}
interface VaultWatchStatusResponse {
  ok: true;
  mapId: string;
  vaultPath: string;
  integrationMode: "obsidian-live";
  sourceOfTruth: "vault-md";
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
const VAULT_UI_PREFS_KEY = `m3e:vault-ui:${LOCAL_MAP_ID}`;
let vaultUiPrefs: VaultUiPrefs = {
  vaultPath: "",
  integrationMode: "off",
  sourceOfTruth: "vault-md",
};
let vaultWatchEs: EventSource | null = null;
let vaultWatchRunning = false;
let vaultLastInboundAt: string | null = null;
let vaultLastOutboundAt: string | null = null;
let vaultLastError: string | null = null;

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
  zoom: 1,
  cameraX: VIEWER_TUNING.pan.initialCameraX,
  cameraY: VIEWER_TUNING.pan.initialCameraY,
  panState: null,
  pinchState: null,
  clipboardState: null,
  linkSourceNodeId: "",
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
  return mode === "system" ? "System" : "Tree";
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
  return rawAttr(map.state.nodes[scopeId], "m3e:layout") === "flow-lr" ? "system" : "tree";
}

function syncThinkingModeUi(): void {
  const mode = viewState.thinkingMode;
  modeMetaEl.textContent = `mode: ${thinkingModeLabel(mode)} / ${surfaceViewModeLabel(viewState.surfaceViewMode)}`;
  modeFlashBtn?.classList.toggle("is-active", mode === "flash");
  modeRapidBtn?.classList.toggle("is-active", mode === "rapid");
  modeDeepBtn?.classList.toggle("is-active", mode === "deep");
  viewTreeBtn?.classList.toggle("is-active", viewState.surfaceViewMode === "tree");
  viewSystemBtn?.classList.toggle("is-active", viewState.surfaceViewMode === "system");
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
  viewState.surfaceViewMode = mode;
  syncMapModelStateFromRuntime();
  _linearPanelLayoutDirty = true;
  syncThinkingModeUi();
  render();
  fitDocument();
  requestAnimationFrame(() => {
    fitDocument();
  });
  scheduleAutosave();
  setStatus(`View: ${surfaceViewModeLabel(mode)}`);
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
  if (cloudPushBtn) cloudPushBtn.disabled = false;
  if (cloudUseLocalBtn) cloudUseLocalBtn.hidden = !cloudConflictPending;
  if (cloudUseCloudBtn) cloudUseCloudBtn.hidden = !cloudConflictPending;
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
  window.addEventListener("beforeunload", () => vaultWatchEs?.close());
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
    let nearestFolderId: string | null = null;
    while (cursor) {
      const current: TreeNode | undefined = state.nodes[cursor];
      if (!current) break;
      if (current.nodeType === "folder") {
        nearestFolderId = current.id;
      }
      cursor = current.parentId ?? null;
    }
    return nearestFolderId || state.rootId;
  };

  folderScopeNodeIds.forEach((nodeId) => {
    const node = state.nodes[nodeId];
    if (!node) return;
    const scopeId = inferredScopeId(nodeId);
    const existingScope = rawScopes[scopeId];
    const surfaceKind: SurfaceKind = rawAttr(node, "m3e:layout") === "flow-lr" ? "system" : "tree";
    const surfaceId = existingScope?.primarySurfaceId || inferredSurfaceId(nodeId, surfaceKind);
    const existingSurface = rawSurfaces[surfaceId];
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
      primarySurfaceId: surfaceId,
    };

    surfaces[surfaceId] = {
      id: existingSurface?.id || surfaceId,
      scopeId,
      kind: existingSurface?.kind || surfaceKind,
      layout: existingSurface?.layout || (surfaceKind === "system" ? "flow-lr" : "tree"),
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
  const surfaceId = scope?.primarySurfaceId;
  if (!scope || !surfaceId || !map.state.surfaces?.[surfaceId]) {
    return;
  }
  const surface = map.state.surfaces[surfaceId]!;
  surface.kind = viewState.surfaceViewMode;
  surface.layout = viewState.surfaceViewMode === "system" ? "flow-lr" : "tree";
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
    };
  });
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

function buildNodeHitStyle(s: NodeStyleAttrs): string {
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
  let nearestFolderId: string | null = null;
  while (cursor) {
    const node: TreeNode | undefined = map.state.nodes[cursor];
    if (!node) {
      break;
    }
    if (isFolderNode(node)) {
      nearestFolderId = node.id;
    }
    cursor = node.parentId ?? null;
  }
  return nearestFolderId || map.state.rootId;
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
  setSingleSelection(preferredSelectionForScope(node.id), false);
  render();
  fitDocument();
  // Re-fit on next frame in case surrounding UI (breadcrumb/scope bar) reflowed
  // and board dimensions shifted after the scope change.
  requestAnimationFrame(() => {
    fitDocument();
  });
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
  const selectionAfterExit =
    map.state.nodes[exitedScopeId] && isNodeInScope(exitedScopeId)
      ? exitedScopeId
      : preferredSelectionForScope(nextScopeId);
  setSingleSelection(selectionAfterExit, false);
  render();
  fitDocument();
  // Re-fit on next frame in case surrounding UI (breadcrumb/scope bar) reflowed
  // and board dimensions shifted after the scope change.
  requestAnimationFrame(() => {
    fitDocument();
  });
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
  viewState.currentScopeRootId = scopeRootForNode(target.id);
  setSingleSelection(target.id, false);
  render();
  fitDocument();
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
  return {
    ...link,
    relationType: link.relationType ?? undefined,
    label: link.label ?? undefined,
    direction: link.direction ?? "none",
    style: link.style ?? "default",
  };
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
  statusEl.style.color = isError ? "var(--danger)" : "#5d5d5d";
  if (message) {
    statusTimer = setTimeout(() => {
      statusEl.textContent = "";
    }, 2500);
  }
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
  syncLinearPanelPosition();
}

function syncLinearPanelPosition(): void {
  if (!linearPanelEl) {
    return;
  }

  if (viewState.surfaceViewMode === "system") {
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

  const centerX = nodeId === map.state.rootId ? nodePos.x + nodePos.w / 2 : nodePos.x + nodePos.w * 0.5;
  const centerY = nodePos.y;
  const left = viewState.cameraX + centerX * viewState.zoom;
  const top = viewState.cameraY + centerY * viewState.zoom;

  inlineEditor.input.style.left = `${left}px`;
  inlineEditor.input.style.top = `${top}px`;
  inlineEditor.input.style.transform = "translate(-50%, -50%)";
  inlineEditor.input.style.minWidth = `${Math.max(140, nodePos.w * viewState.zoom * 0.6)}px`;
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
  viewState.cameraX += before.x - after.x;
  viewState.cameraY += before.y - after.y;
  applyZoom();
}

function setZoom(
  nextZoom: number,
  anchorClientX: number | null = null,
  anchorClientY: number | null = null,
  statusMode: "immediate" | "throttled" | "silent" = "immediate",
): void {
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

function visibleChildren(node: TreeNode): string[] {
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

function edgeEndBetween(fromPos: NodePosition, toPos: NodePosition): { x: number; y: number } {
  const fromCx = fromPos.x + fromPos.w / 2;
  const fromCy = fromPos.y;
  const toCx = toPos.x + toPos.w / 2;
  const toCy = toPos.y;
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { x: fromPos.x + fromPos.w + VIEWER_TUNING.layout.edgeStartPad, y: fromCy }
      : { x: fromPos.x - VIEWER_TUNING.layout.edgeEndPad, y: fromCy };
  }
  return dy >= 0
    ? { x: fromCx, y: fromPos.y + fromPos.h / 2 + VIEWER_TUNING.layout.edgeStartPad }
    : { x: fromCx, y: fromPos.y - fromPos.h / 2 - VIEWER_TUNING.layout.edgeEndPad };
}

function edgeEndBetweenRects(
  fromRect: { x: number; y: number; w: number; h: number },
  toRect: { x: number; y: number; w: number; h: number },
): { x: number; y: number } {
  const fromCx = fromRect.x + fromRect.w / 2;
  const fromCy = fromRect.y + fromRect.h / 2;
  const toCx = toRect.x + toRect.w / 2;
  const toCy = toRect.y + toRect.h / 2;
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { x: fromRect.x + fromRect.w + VIEWER_TUNING.layout.edgeStartPad, y: fromCy }
      : { x: fromRect.x - VIEWER_TUNING.layout.edgeEndPad, y: fromCy };
  }
  return dy >= 0
    ? { x: fromCx, y: fromRect.y + fromRect.h + VIEWER_TUNING.layout.edgeStartPad }
    : { x: fromCx, y: fromRect.y - VIEWER_TUNING.layout.edgeEndPad };
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

async function requestTopicSuggestionsForSelectedNode(maxTopics = 5): Promise<string[]> {
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
      nodeDetails: selected.details || "",
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
  try {
    await navigator.clipboard.writeText(prompt);
    setStatus("Node query copied to clipboard \u2014 paste into Claude.");
  } catch {
    setStatus("Failed to copy to clipboard.", true);
  }
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

function appendTopicSuggestionsToSelectedNode(topics: string[]): number {
  if (!map || !viewState.selectedNodeId || topics.length === 0) {
    return 0;
  }
  const parent = getNode(viewState.selectedNodeId);
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
    linearPanelEl.hidden = viewState.surfaceViewMode === "system";
  }
  if (viewState.surfaceViewMode === "system") {
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

function buildLayout(state: AppState): LayoutResult {
  const displayRootId = currentScopeRootId();
  const displayRootNode = state.nodes[displayRootId];
  const flowSurface = currentSurfaceIsFlowMode();
  const metrics: Record<string, { w: number; h: number }> = {};
  const depthOf: Record<string, number> = {};
  const depthMaxWidth: Record<number, number> = {};
  let maxDepth = 0;

  if (flowSurface && displayRootNode) {
    const surfaceNodes = visibleChildren(displayRootNode);
    const primarySurfaceNodes = surfaceNodes.filter((nodeId) => !isReferenceNode(state.nodes[nodeId]));
    const referenceSurfaceNodes = surfaceNodes.filter((nodeId) => isReferenceNode(state.nodes[nodeId]));
    const pos: Record<string, NodePosition> = {};
    const order: string[] = [];
    const colMaxWidth: Record<number, number> = {};
    const rowMaxHeight: Record<number, number> = {};
    const surfaceCells: Record<string, { col: number; row: number }> = {};
    const occupiedRowsByCol: Record<number, Set<number>> = {};
    let maxCol = 0;
    let maxRow = 0;

    surfaceNodes.forEach((nodeId, index) => {
      const node = state.nodes[nodeId];
      if (!node) return;
      const nodeStyles = effectiveNodeStyleAttrs(node);
      const label = diagramLabel(node, nodeStyles);
      const baseMetric = isLatexNode(node)
        ? measureLatex(node.text)
        : measureNodeLabel(label, VIEWER_TUNING.typography.nodeFont);
      const previewLayout = buildFlowPreviewLayout(node);
      const metric = previewLayout
        ? {
            w: Math.max(baseMetric.w + 28, previewLayout.totalWidth),
            h: Math.max(VIEWER_TUNING.layout.leafHeight + 18, previewLayout.totalHeight),
          }
        : baseMetric;
      metrics[nodeId] = metric;
      if (isReferenceNode(node)) {
        return;
      }
      const col = flowColOf(node, index);
      const occupiedRows = occupiedRowsByCol[col] || new Set<number>();
      let row = flowRowOf(node, 0);
      while (occupiedRows.has(row)) {
        row += 1;
      }
      occupiedRows.add(row);
      occupiedRowsByCol[col] = occupiedRows;
      surfaceCells[nodeId] = { col, row };
      depthOf[nodeId] = col;
      maxCol = Math.max(maxCol, col);
      maxRow = Math.max(maxRow, row);
      colMaxWidth[col] = Math.max(colMaxWidth[col] ?? 0, metric.w);
      rowMaxHeight[row] = Math.max(rowMaxHeight[row] ?? 0, Math.max(VIEWER_TUNING.layout.leafHeight + 18, metric.h + 18));
    });

    const xByCol: Record<number, number> = {};
    let cursorX = VIEWER_TUNING.layout.leftPad;
    for (let col = 0; col <= maxCol; col += 1) {
      xByCol[col] = cursorX;
      cursorX += (colMaxWidth[col] ?? 180) + VIEWER_TUNING.layout.columnGap;
    }

    const yByRow: Record<number, number> = {};
    let cursorY = VIEWER_TUNING.layout.topPad + 132;
    for (let row = 0; row <= maxRow; row += 1) {
      const rowHeight = rowMaxHeight[row] ?? (VIEWER_TUNING.layout.leafHeight + 18);
      yByRow[row] = cursorY + rowHeight / 2;
      cursorY += rowHeight + FLOW_SURFACE_ROW_GAP;
    }

    primarySurfaceNodes.forEach((nodeId, index) => {
      const node = state.nodes[nodeId];
      if (!node) return;
      const resolvedCell = surfaceCells[nodeId] || { col: flowColOf(node, index), row: flowRowOf(node, 0) };
      const { col, row } = resolvedCell;
      const metric = metrics[nodeId]!;
      pos[nodeId] = {
        x: xByCol[col]!,
        y: yByRow[row]!,
        depth: col,
        w: metric.w,
        h: metric.h,
      };
      order.push(nodeId);
    });

    if (referenceSurfaceNodes.length > 0) {
      const referenceTop = cursorY + 26;
      let referenceCursorX = VIEWER_TUNING.layout.leftPad;
      referenceSurfaceNodes.forEach((nodeId) => {
        const metric = metrics[nodeId]!;
        pos[nodeId] = {
          x: referenceCursorX,
          y: referenceTop + metric.h / 2,
          depth: maxCol + 1,
          w: metric.w,
          h: metric.h,
        };
        order.push(nodeId);
        referenceCursorX += metric.w + VIEWER_TUNING.layout.columnGap;
      });
      cursorY = referenceTop + Math.max(...referenceSurfaceNodes.map((nodeId) => metrics[nodeId]!.h)) + FLOW_SURFACE_ROW_GAP;
      cursorX = Math.max(cursorX, referenceCursorX);
    }

    return {
      pos,
      order,
      totalHeight: Math.max(cursorY + VIEWER_TUNING.layout.canvasBottomPad, VIEWER_TUNING.layout.minCanvasHeight),
      totalWidth: Math.max(cursorX + VIEWER_TUNING.layout.canvasRightPad, VIEWER_TUNING.layout.minCanvasWidth),
    };
  }

  function visit(nodeId: string, depth: number): void {
    const node = state.nodes[nodeId];
    if (!node) {
      return;
    }

    maxDepth = Math.max(maxDepth, depth);
    depthOf[nodeId] = depth;

    if (nodeId === state.rootId) {
      const rootLabelMeasure = measureNodeLabel(uiLabel(node), VIEWER_TUNING.typography.rootFont);
      metrics[nodeId] = {
        w: Math.max(280, rootLabelMeasure.w + 100),
        h: Math.max(VIEWER_TUNING.layout.rootHeight, rootLabelMeasure.h + 8),
      };
    } else if (isLatexNode(node)) {
      const m = measureLatex(node.text);
      metrics[nodeId] = { w: m.w, h: m.h };
    } else {
      metrics[nodeId] = measureNodeLabel(uiLabel(node), VIEWER_TUNING.typography.nodeFont);
    }

    depthMaxWidth[depth] = Math.max(depthMaxWidth[depth] ?? 0, metrics[nodeId]!.w);
    visibleChildren(node).forEach((childId) => visit(childId, depth + 1));
  }

  visit(displayRootId, 0);

  const xByDepth: Record<number, number> = {};
  let cursorX = VIEWER_TUNING.layout.leftPad;
  for (let d = 0; d <= maxDepth; d += 1) {
    xByDepth[d] = cursorX;
    cursorX += (depthMaxWidth[d] ?? 120) + VIEWER_TUNING.layout.columnGap;
  }

  const subtreeHeightCache: Record<string, number> = {};
  function subtreeHeight(nodeId: string): number {
    if (subtreeHeightCache[nodeId] !== undefined) {
      return subtreeHeightCache[nodeId]!;
    }

    const node = state.nodes[nodeId];
    if (!node) {
      return VIEWER_TUNING.layout.leafHeight;
    }

    const children = visibleChildren(node);
    if (children.length === 0) {
      const leafSpan = Math.max(VIEWER_TUNING.layout.leafHeight, metrics[nodeId]!.h + 12);
      subtreeHeightCache[nodeId] = leafSpan;
      return leafSpan;
    }

    let sum = 0;
    children.forEach((childId, i) => {
      sum += subtreeHeight(childId);
      if (i < children.length - 1) {
        sum += VIEWER_TUNING.layout.siblingGap;
      }
    });

    const result = Math.max(sum, metrics[nodeId]!.h + 24);
    subtreeHeightCache[nodeId] = result;
    return result;
  }

  const pos: Record<string, NodePosition> = {};
  const order: string[] = [];

  const depthOffsetFactor = VIEWER_TUNING.layout.depthOffsetFactor;

  function place(
    nodeId: string,
    topY: number,
    parentX: number | null,
    parentW: number | null,
  ): number {
    const node = state.nodes[nodeId];
    if (!node) {
      return VIEWER_TUNING.layout.leafHeight;
    }

    const depth = depthOf[nodeId] ?? 0;
    const h = subtreeHeight(nodeId);
    const centerY = topY + h / 2;

    // Blend between depth-aligned X (legacy) and parent-relative X
    const baseX = xByDepth[depth]!;
    let nodeX: number;
    if (parentX === null || parentW === null) {
      nodeX = baseX; // root node
    } else {
      const parentRelX = parentX + parentW + VIEWER_TUNING.layout.columnGap;
      nodeX = baseX + (parentRelX - baseX) * depthOffsetFactor;
    }

    pos[nodeId] = {
      x: nodeX,
      y: centerY,
      depth,
      w: metrics[nodeId]!.w,
      h: metrics[nodeId]!.h,
    };
    order.push(nodeId);

    let placeCursorY = topY;
    visibleChildren(node).forEach((childId, i, arr) => {
      const childH = place(childId, placeCursorY, nodeX, metrics[nodeId]!.w);
      placeCursorY += childH;
      if (i < arr.length - 1) {
        placeCursorY += VIEWER_TUNING.layout.siblingGap;
      }
    });

    return h;
  }

  const totalHeight = place(displayRootId, VIEWER_TUNING.layout.topPad, null, null);

  // Compute totalWidth from placed node positions (parent-relative X may exceed cursorX)
  let maxRight = VIEWER_TUNING.layout.minCanvasWidth;
  for (const nodeId of order) {
    const p = pos[nodeId]!;
    maxRight = Math.max(maxRight, p.x + p.w + VIEWER_TUNING.layout.nodeRightPad);
  }

  return {
    pos,
    order,
    totalHeight,
    totalWidth: Math.max(maxRight + VIEWER_TUNING.layout.canvasRightPad, VIEWER_TUNING.layout.minCanvasWidth),
  };
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

function render(): void {
  updateModeBadge();
  if (!map) {
    syncThinkingModeUi();
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
  const rootlessSurface = flowSurface;

  const pos = layout.pos;
  let maxX = Math.max(VIEWER_TUNING.layout.minCanvasWidth, layout.totalWidth);
  let maxY = Math.max(
    VIEWER_TUNING.layout.minCanvasHeight,
    layout.totalHeight + VIEWER_TUNING.layout.topPad + VIEWER_TUNING.layout.canvasBottomPad
  );
  let defs = "<defs>";
  let surfaceFrames = "";
  let edges = "";
  let graphLinks = "";
  let overlays = "";
  let nodes = "";

  const renderedSurfaceLinks = new Set<string>();
  const renderedPairOffsets = new Map<string, number>();
  // Running counters so multiple distinct back-edges routed on the same face stack at different heights.
  let topArchCount = 0;
  let bottomArchCount = 0;
  // Portal brackets extend ~14px on each side; extend avoid rects so routing steers around them too.
  const PORTAL_BRACKET_ARM = 14;
  // Include every positioned node in avoid set so U-arches clear them even if the
  // scope predicate is stricter than visibility (representatives, siblings etc).
  const linkAvoidBoxes = collectEdgeAvoidBoxes(
    pos,
    () => true,
    flowSurface ? PORTAL_BRACKET_ARM : 0,
  );
  Object.values(state.links || {}).forEach((rawLink) => {
    const link = normalizeGraphLink(rawLink);
    const source = state.nodes[link.sourceNodeId];
    const target = state.nodes[link.targetNodeId];
    let sourceRenderId = link.sourceNodeId;
    let targetRenderId = link.targetNodeId;
    let sourcePos = pos[sourceRenderId];
    let targetPos = pos[targetRenderId];
    if ((!sourcePos || !targetPos) && flowSurface) {
      sourceRenderId = representativeNodeIdInCurrentScope(link.sourceNodeId) || sourceRenderId;
      targetRenderId = representativeNodeIdInCurrentScope(link.targetNodeId) || targetRenderId;
      sourcePos = pos[sourceRenderId];
      targetPos = pos[targetRenderId];
    }
    if (!source || !target || !sourcePos || !targetPos) {
      return;
    }
    if (!isNodeInScope(source.id) || !isNodeInScope(target.id) || !isNodeVisibleByImportance(source.id) || !isNodeVisibleByImportance(target.id)) {
      return;
    }
    if (sourceRenderId === targetRenderId) {
      return;
    }
    const surfaceKey = flowSurface
      ? `${sourceRenderId}->${targetRenderId}:${link.label || link.relationType || ""}`
      : link.id;
    if (renderedSurfaceLinks.has(surfaceKey)) {
      return;
    }
    renderedSurfaceLinks.add(surfaceKey);
    const pairKey = [sourceRenderId, targetRenderId].sort().join("<->");
    const pairOffsetIndex = renderedPairOffsets.get(pairKey) ?? 0;
    renderedPairOffsets.set(pairKey, pairOffsetIndex + 1);

    const sourceEnd = edgeEndBetween(sourcePos, targetPos);
    const targetEnd = edgeEndBetween(targetPos, sourcePos);
    // The node physically rendered in current scope may differ from link.source/target (representative).
    const sourceRenderNode = state.nodes[sourceRenderId] || source;
    const targetRenderNode = state.nodes[targetRenderId] || target;
    // If the rendered node appears as a portal subsystem (`[[...]]`), push the edge end past the bracket glyph.
    const sourceIsPortal = isScopePortalNode(sourceRenderNode);
    const targetIsPortal = isScopePortalNode(targetRenderNode);
    const srcCx = sourcePos.x + sourcePos.w / 2;
    const tgtCx = targetPos.x + targetPos.w / 2;
    const srcCy = sourcePos.y;
    const tgtCy = targetPos.y;
    const facingHorizontal = Math.abs(tgtCx - srcCx) >= Math.abs(tgtCy - srcCy);
    if (facingHorizontal) {
      const rightward = tgtCx >= srcCx;
      if (sourceIsPortal) sourceEnd.x += (rightward ? 1 : -1) * PORTAL_BRACKET_ARM;
      if (targetIsPortal) targetEnd.x += (rightward ? -1 : 1) * PORTAL_BRACKET_ARM;
    }
    const sourceX = sourceEnd.x;
    const sourceY = sourceEnd.y;
    const targetX = targetEnd.x;
    const targetY = targetEnd.y;
    const forward = targetX >= sourceX;
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const horizontalSpan = Math.abs(dx);
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
      const sxArch = srcCx;
      const txArch = tgtCx;
      // Extra lift reserved for scope-frame title band (top-side only).
      const titleReserve = useTop ? 48 : 14;
      // Stagger each back-edge on same side so horizontal segments don't overlap.
      const lift = titleReserve + archIndex * 18;
      let syArch: number;
      let tyArch: number;
      let apexY: number;
      if (useTop) {
        syArch = sourcePos.y - sourcePos.h / 2 - srcPad;
        tyArch = targetPos.y - targetPos.h / 2 - tgtPad;
        apexY = uArchTopApex(linkAvoidBoxes, syArch, tyArch, lift);
      } else {
        syArch = sourcePos.y + sourcePos.h / 2 + srcPad;
        tyArch = targetPos.y + targetPos.h / 2 + tgtPad;
        apexY = uArchBottomApex(linkAvoidBoxes, syArch, tyArch, lift);
      }
      graphLinkPathD = uArchOrthogonalPath(sxArch, syArch, txArch, tyArch, apexY);
      controlX = (sxArch + txArch) / 2;
      controlY = useTop ? apexY - 10 : apexY + 16;
    } else {
      const preferredMidX = sourceX + (targetX - sourceX) / 2 + pairWaveOffset;
      const midX = chooseClearMidX(sourceX, targetX, linkAvoidBoxes, preferredMidX, 10);
      graphLinkPathD = roundedOrthogonalPath(sourceX, sourceY, targetX, targetY, { midX });
      controlX = midX;
      // Lift label above the edge line so it doesn't collide with box content / pills.
      const isStraightH = Math.abs(sourceY - targetY) < 4;
      controlY = isStraightH
        ? sourceY - 16 - Math.abs(pairWaveOffset)
        : (sourceY + targetY) / 2 - 10 - pairWaveOffset;
    }
    const styleClass = link.style === "default" ? "" : ` graph-link-${link.style}`;
    const colorSeed = Math.round(Math.abs(sourcePos.depth * 31 + targetPos.depth * 17 + sourceY + targetY));
    const stroke = VIEWER_TUNING.palette.edgeColors[colorSeed % VIEWER_TUNING.palette.edgeColors.length]!;
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

    graphLinks += `<path class="graph-link${styleClass}" data-link-id="${link.id}" stroke="${stroke}" d="${graphLinkPathD}"${markerStart}${markerEnd} />`;
    if (label) {
      graphLinks += `<text class="graph-link-label" data-link-id="${link.id}" x="${controlX}" y="${controlY - 10}" text-anchor="middle">${escapeXml(label)}</text>`;
    }
  });
  defs += "</defs>";

  /**
   * Render children of a node as an HTML table via foreignObject.
   * Columns are auto-derived from the union of all children's attribute keys
   * (excluding m3e: internal attributes). First column is always the node text.
   */
  function renderTableView(parentId: string, parentPos: { x: number; y: number; w: number; h: number }): string {
    const parent = state.nodes[parentId];
    if (!parent || parent.children.length === 0) return "";

    const childNodes = parent.children
      .map((cid) => state.nodes[cid])
      .filter((n): n is TreeNode => !!n);

    // Collect column keys from all children's attributes (exclude m3e: internals)
    const colSet = new Set<string>();
    for (const child of childNodes) {
      for (const key of Object.keys(child.attributes || {})) {
        if (!key.startsWith("m3e:")) colSet.add(key);
      }
      if (child.details) colSet.add("_details");
    }
    const columns = Array.from(colSet).sort();

    // Build HTML table
    const esc = (s: string) => escapeXml(s);

    let html = `<table class="m3e-table-view"><thead><tr><th>Name</th>`;
    for (const col of columns) {
      html += `<th>${esc(col === "_details" ? "Details" : col)}</th>`;
    }
    html += `</tr></thead><tbody>`;

    for (const child of childNodes) {
      const statusClass = child.attributes?.["m3e:status"] ? ` class="status-${esc(child.attributes["m3e:status"])}"` : "";
      html += `<tr data-node-id="${esc(child.id)}"${statusClass}>`;
      html += `<td class="m3e-table-name">${esc(child.text || "(empty)")}</td>`;
      for (const col of columns) {
        if (col === "_details") {
          html += `<td>${esc(child.details || "")}</td>`;
        } else {
          html += `<td>${esc(child.attributes?.[col] || "")}</td>`;
        }
      }
      html += `</tr>`;
    }
    html += `</tbody></table>`;

    // Size: estimate based on columns and rows
    const tableW = Math.max(columns.length * 150 + 200, 600);
    const tableH = Math.min((childNodes.length + 1) * 32 + 16, 800);
    const foX = parentPos.x - 20;
    const foY = parentPos.y + parentPos.h / 2 + 20;

    return `<foreignObject x="${foX}" y="${foY}" width="${tableW}" height="${tableH}"><div xmlns="http://www.w3.org/1999/xhtml" class="m3e-table-container">${html}</div></foreignObject>`;
  }

  function drawNode(nodeId: string): void {
    const node = state.nodes[nodeId];
    const p = pos[nodeId];
    if (!node || !p) {
      return;
    }

    maxX = Math.max(maxX, p.x + p.w + VIEWER_TUNING.layout.nodeRightPad);
    maxY = Math.max(maxY, p.y + p.h + VIEWER_TUNING.layout.nodeBottomPad);

    const children = visibleChildren(node);
    const nodeStyles = effectiveNodeStyleAttrs(node);
    const previewLayout = buildFlowPreviewLayout(node);
    children.forEach((childId, i) => {
      const child = pos[childId];
      if (!child) {
        return;
      }

      const defaultStroke =
        VIEWER_TUNING.palette.edgeColors[(p.depth + i) % VIEWER_TUNING.palette.edgeColors.length];
      const stroke = nodeStyles.edgeColor || defaultStroke;
      const startX = p.x + p.w + VIEWER_TUNING.layout.edgeStartPad;
      const startY = p.y;
      const endX = child.x - VIEWER_TUNING.layout.edgeEndPad;
      const endY = child.y;
      const edgeInline = buildEdgeStyle(nodeStyles);
      const curve = Math.max(48, (endX - startX) * 0.45);
      const c1x = startX + curve;
      const c2x = endX - curve;
      const edgePath = `M ${startX} ${startY} C ${c1x} ${startY}, ${c2x} ${endY}, ${endX} ${endY}`;
      edges += `<path class="edge" stroke="${stroke}" d="${edgePath}"${edgeInline ? ` style="${edgeInline}"` : ""} />`;

      // Edge label — stored on the child node (parent is unique per child)
      const childNode = state.nodes[childId];
      const childStyles = readNodeStyleAttrs(childNode?.attributes || {});
      if (childStyles.edgeLabel) {
        const labelX = (c1x + c2x) / 2;
        const labelY = (startY + endY) / 2 - 8;
        edges += `<text class="edge-label" x="${labelX}" y="${labelY}" text-anchor="middle">${escapeXml(childStyles.edgeLabel)}</text>`;
      }
    });

    const classNames = ["node-hit"];
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
    const hitInline = buildNodeHitStyle(nodeStyles);
    nodes += `<rect class="${classNames.join(" ")}" data-node-id="${nodeId}" x="${hitX}" y="${hitY}" width="${hitW}" height="${hitH}" rx="${hitRx}"${hitInline ? ` style="${hitInline}"` : ""} />`;

    if (treatAsRoot) {
      const rootLabelLines = splitLabelLines(uiLabel(node) || "(empty)");
      const rootLineHeight = lineHeightForFont(VIEWER_TUNING.typography.rootFont);
      const rootStartY = multilineTextStartY(p.y, rootLabelLines.length, VIEWER_TUNING.typography.rootFont, rootLineHeight);
      const rootTspans = multilineTspans(rootLabelLines, p.x + p.w / 2, rootLineHeight);
      const w = p.w;
      const h = p.h;
      const rx = shapeRx(nodeStyles.shape, true);
      const x = p.x;
      const y = p.y - h / 2;
      const rootBoxStyle: string[] = [];
      if (nodeStyles.bg) rootBoxStyle.push(`fill:${nodeStyles.bg}`);
      if (nodeStyles.border) rootBoxStyle.push(`stroke:${nodeStyles.border}`);
      if (nodeStyles.borderWidth != null) rootBoxStyle.push(`stroke-width:${nodeStyles.borderWidth}px`);
      if (nodeStyles.borderStyle === "dashed") rootBoxStyle.push("stroke-dasharray:8 5");
      if (nodeStyles.borderStyle === "dotted") rootBoxStyle.push("stroke-dasharray:3 3");
      if (nodeStyles.borderStyle === "none") rootBoxStyle.push("stroke:none");
      const rootBoxInline = rootBoxStyle.length ? ` style="${rootBoxStyle.join(";")}"` : "";
      nodes += `<rect class="root-box" data-node-id="${nodeId}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"${rootBoxInline} />`;
      const rootLabelInline = buildLabelStyle(nodeStyles);
      nodes += `<text class="label-root" data-node-id="${nodeId}" x="${x + w / 2}" y="${rootStartY}" text-anchor="middle" font-size="${VIEWER_TUNING.typography.rootFont}"${rootLabelInline ? ` style="${rootLabelInline}"` : ""}>${rootTspans}</text>`;
    } else {
      const rawLabel = diagramLabel(node, nodeStyles);
      const labelLines = splitLabelLines(rawLabel);
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
      if (!isFolderNode(node) && (nodeStyles.shape === "diamond" || nodeStyles.bg || nodeStyles.border || nodeStyles.borderWidth != null)) {
        const shapeX = p.x - 14;
        const shapeY = p.y - Math.max(VIEWER_TUNING.layout.nodeHitHeight, p.h) / 2 + 6;
        const shapeW = p.w + 28;
        const shapeH = Math.max(VIEWER_TUNING.layout.nodeHitHeight, p.h) - 12;
        const shapeParts: string[] = [];
        if (nodeStyles.bg) shapeParts.push(`fill:${nodeStyles.bg}`);
        if (nodeStyles.border) shapeParts.push(`stroke:${nodeStyles.border}`);
        if (nodeStyles.borderWidth != null) shapeParts.push(`stroke-width:${nodeStyles.borderWidth}px`);
        if (nodeStyles.borderStyle === "dashed") shapeParts.push("stroke-dasharray:8 5");
        if (nodeStyles.borderStyle === "dotted") shapeParts.push("stroke-dasharray:3 3");
        if (nodeStyles.borderStyle === "none") shapeParts.push("stroke:none");
        const shapeInline = shapeParts.length ? ` style="${shapeParts.join(";")}"` : "";
        if (nodeStyles.shape === "diamond") {
          nodes += `<path class="node-shape" data-node-id="${nodeId}" d="${diamondPath(p.x + p.w / 2, p.y, shapeW, shapeH)}"${shapeInline} />`;
        } else {
          nodes += `<path class="node-shape" data-node-id="${nodeId}" d="${rectPath(shapeX, shapeY, shapeW, shapeH, shapeRx(nodeStyles.shape, false))}"${shapeInline} />`;
        }
      }
      if (isFolderNode(node)) {
        const frameH = Math.max(VIEWER_TUNING.layout.nodeHitHeight, p.h) - 12;
        const folderFrameX = p.x - 14;
        const folderFrameY = p.y - frameH / 2;
        const folderFrameW = p.w + 28;
        const folderFrameH = frameH;
        const folderBoxParts: string[] = [];
        if (nodeStyles.bg) folderBoxParts.push(`fill:${nodeStyles.bg}`);
        if (nodeStyles.border) folderBoxParts.push(`stroke:${nodeStyles.border}`);
        if (nodeStyles.borderWidth != null) folderBoxParts.push(`stroke-width:${nodeStyles.borderWidth}px`);
        const folderBoxInline = folderBoxParts.length ? ` style="${folderBoxParts.join(";")}"` : "";
        if (isScopePortalNode(node)) {
          const leftX = folderFrameX + 2;
          const rightX = folderFrameX + folderFrameW - 2;
          const topY = folderFrameY;
          const bottomY = folderFrameY + folderFrameH;
          const arm = 12;
          nodes += `<path class="portal-bracket" data-node-id="${nodeId}" d="M ${leftX + arm} ${topY} H ${leftX} V ${bottomY} H ${leftX + arm}"${folderBoxInline} />`;
          nodes += `<path class="portal-bracket" data-node-id="${nodeId}" d="M ${rightX - arm} ${topY} H ${rightX} V ${bottomY} H ${rightX - arm}"${folderBoxInline} />`;
        } else if (nodeStyles.shape === "diamond") {
          nodes += `<path class="folder-box" data-node-id="${nodeId}" d="${diamondPath(p.x + p.w / 2, p.y, folderFrameW, folderFrameH)}"${folderBoxInline} />`;
        } else {
          nodes += `<rect class="folder-box" data-node-id="${nodeId}" x="${folderFrameX}" y="${folderFrameY}" width="${folderFrameW}" height="${folderFrameH}" rx="8"${folderBoxInline} />`;
        }
        if (previewLayout) {
          const previewIds = new Set(previewLayout.childIds);
          Object.values(state.links || {}).forEach((rawLink) => {
            const link = normalizeGraphLink(rawLink);
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
            const sourceEnd = edgeEndBetweenRects(sourceRect, targetRect);
            const targetEnd = edgeEndBetweenRects(targetRect, sourceRect);
            const sx = sourceEnd.x;
            const sy = sourceEnd.y;
            const tx = targetEnd.x;
            const ty = targetEnd.y;
            const previewEdgePath = roundedOrthogonalPath(sx, sy, tx, ty, { radius: 6 });
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
        const lineHeight = lineHeightForFont(VIEWER_TUNING.typography.nodeFont);
        const startY = previewLayout
          ? p.y - Math.max(VIEWER_TUNING.layout.nodeHitHeight, p.h) / 2 + 36
          : multilineTextStartY(p.y, labelLines.length, VIEWER_TUNING.typography.nodeFont, lineHeight);
        const tspans = multilineTspans(labelLines, p.x, lineHeight);
        const labelInline = buildLabelStyle(nodeStyles);
        const labelX = isScopePortalNode(node) ? p.x + 12 : p.x;
        nodes += `<text class="${labelClasses.join(" ")}" data-node-id="${nodeId}" x="${labelX}" y="${startY}" text-anchor="start" font-size="${VIEWER_TUNING.typography.nodeFont}"${labelInline ? ` style="${labelInline}"` : ""}>${tspans}</text>`;
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

    // Table view mode: render children as table instead of tree
    const viewType = node.attributes?.["m3e:view-type"];
    if (viewType === "table" && children.length > 0 && nodeId !== displayRootId) {
      // Skip recursive tree rendering for children — they'll be shown as table
      nodes += renderTableView(nodeId, p);
    } else {
      children.forEach((cid) => drawNode(cid));
    }
  }

  if (rootlessSurface && displayRootNode) {
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

  if (viewState.surfaceViewMode !== "system" && refreshLinearPanelCanvasLayout()) {
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

  contentWidth = maxX;
  contentHeight = maxY;
  canvas.setAttribute("width", String(maxX));
  canvas.setAttribute("height", String(maxY));
  canvas.setAttribute("viewBox", `0 0 ${maxX} ${maxY}`);
  (canvas as Element).innerHTML = `${defs}${surfaceFrames}${edges}${graphLinks}${overlays}${nodes}`;
  applyZoom();

  const version = map.version ?? "n/a";
  const savedAt = map.savedAt ?? "n/a";
  const nodeCount = Object.keys(state.nodes).length;
  const linkCount = Object.values(state.links || {}).filter((link) => pos[link.sourceNodeId] && pos[link.targetNodeId]).length;
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
  metaEl.textContent = `workspace: ${WORKSPACE_LABEL} (${WORKSPACE_ID}) | map: ${MAP_LABEL} (${LOCAL_MAP_ID}) | slug: ${MAP_SLUG} | cloud: ${CLOUD_MAP_ID} | version: ${version} | savedAt: ${savedAt} | nodes: ${nodeCount} | links: ${linkCount} | scope: ${normalizedCurrentScopeId()} | importance: ${importanceViewMode} | selected: ${selected ? uiLabel(selected) : "n/a"} (${viewState.selectedNodeIds.size}) | link-source: ${linkSourceLabel} | move-node: ${moveNodes.length > 0 ? `${moveNodes.length} selected` : "none"} | drop-target: ${dropLabel}`;
  updateScopeMeta();
  updateScopeSummary();
  updateMapTitle();
  syncInlineEditorPosition();
  renderLinearPanel();
}

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
}

function setSingleSelection(nodeId: string, renderNow = true): void {
  getNode(nodeId);
  if (!isNodeInScope(nodeId) || !isNodeVisibleByImportance(nodeId)) {
    return;
  }
  viewState.selectedNodeId = nodeId;
  viewState.selectedNodeIds = new Set([nodeId]);
  viewState.selectionAnchorId = null;
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
  scheduleRender();
}

function toggleNodeSelection(nodeId: string): void {
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
    scheduleRender();
    return;
  }

  viewState.selectedNodeIds.add(nodeId);
  viewState.selectedNodeId = nodeId;
  scheduleRender();
}

function selectNode(nodeId: string): void {
  setSingleSelection(nodeId);
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
  setSingleSelection(preferredSelectionForScope(scopeId), false);
  normalizeSelectionState();
  render();
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
  const selectionAfterExit =
    map.state.nodes[exitedScopeId] && isNodeInScope(exitedScopeId)
      ? exitedScopeId
      : preferredSelectionForScope(viewState.currentScopeId);
  setSingleSelection(selectionAfterExit, false);
  normalizeSelectionState();
  render();
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
  appEl?.classList.remove("home-active");
  board.focus();
}

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
  const parts: string[] = [];
  let cur: TreeNode | undefined = nodes[nodeId];
  let guard = 0;
  while (cur && guard++ < 10000) {
    parts.unshift(cur.text ?? "");
    if (cur.parentId === null || cur.parentId === undefined) break;
    cur = nodes[cur.parentId];
  }
  if (parts.length === 0) return null;
  return "Map:" + parts.join("/");
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
    label: "\uD83D\uDCCB Copy path (Map:Root/\u2026)",
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
  input.remove();
  inlineEditor = null;

  if (commit) {
    applyNodeTextEdit(nodeId, next, mode);
  }

  if (options?.focusBoard !== false) {
    board.focus();
  }
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
  startInlineEdit(viewState.selectedNodeId);
}

function autoSizeInlineEditor(input: HTMLTextAreaElement): void {
  input.style.height = "auto";
  input.style.height = `${Math.max(44, input.scrollHeight)}px`;
}

function startInlineEdit(nodeId: string, options?: { selectAll?: boolean }): void {
  if (!map || !lastLayout || !lastLayout.pos[nodeId]) {
    return;
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

async function saveDocToLocalDb(showStatus = false, force = false): Promise<boolean> {
  if (!map) {
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
        force,
      }),
    });

    if (response.status === 409) {
      const conflict = await response.json().catch(() => ({ error: "Map conflict." }));
      const remoteState = (conflict as { state?: AppState }).state;
      if (remoteState) {
        showConflictPanel(remoteState, {
          localLabel: "Use Local",
          remoteLabel: "Use Vault",
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
      setStatus("Vault conflict detected. Choose Use Local or Use Vault.", true);
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

async function loadDocFromLocalDb(showStatus = false): Promise<boolean> {
  try {
    const response = await fetch(`/api/maps/${encodeURIComponent(LOCAL_MAP_ID)}`, { cache: "no-store" });
    if (response.status === 404) {
      return false;
    }
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(String(errorPayload.error || `HTTP ${response.status}`));
    }

    const payload = await response.json();
    loadPayload(payload);
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
  if (autosaveTimer !== null) {
    clearTimeout(autosaveTimer);
  }
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    void saveDocToLocalDb(false);
  }, AUTOSAVE_DELAY_MS);
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

  window.addEventListener("beforeunload", () => mapWatchEs?.close());
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
  await fetchCloudSyncStatus();

  if (cloudSyncEnabled && cloudSyncExists) {
    const loadedFromCloud = await pullDocFromCloud(false);
    if (loadedFromCloud) {
      await loadLinearNotesFromLocalDbFallback();
      return;
    }
  }

  const loadedFromDb = await loadDocFromLocalDb(false);
  if (loadedFromDb) {
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
  viewState.zoom = 1;
  viewState.cameraX = VIEWER_TUNING.pan.initialCameraX;
  viewState.cameraY = VIEWER_TUNING.pan.initialCameraY;
  applyZoom();
}

function centerOnNode(nodeId: string, zoom = viewState.zoom): boolean {
  if (!map || !lastLayout || !lastLayout.pos[nodeId]) {
    return false;
  }
  const nodePos = lastLayout.pos[nodeId]!;
  const boardRect = board.getBoundingClientRect();
  viewState.zoom = clampZoom(zoom);
  viewState.cameraX = boardRect.width / 2 - (nodePos.x + nodePos.w / 2) * viewState.zoom;
  viewState.cameraY = boardRect.height / 2 - nodePos.y * viewState.zoom;
  applyZoom();
  return true;
}

function fitDocument(): boolean {
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
  viewState.zoom = zoom;
  viewState.cameraX = (boardRect.width - contentWidth * zoom) / 2;
  viewState.cameraY = (boardRect.height - contentHeight * zoom) / 2;
  applyZoom();
  return true;
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
    text: node.text || "",
    details: node.details || "",
    note: node.note || "",
    attributes: JSON.parse(JSON.stringify(node.attributes || {})) as Record<string, string>,
    children: (node.children || []).map((childId) => toSubtreeSnapshot(childId)),
  };
}

function cloneSnapshotUnderParent(parentId: string, snapshot: SubtreeSnapshot): string {
  const parent = getNode(parentId);
  const createdId = newId();
  map!.state.nodes[createdId] = createNodeRecord(createdId, parentId, snapshot.text || "New Node");
  const created = map!.state.nodes[createdId]!;
  created.details = snapshot.details || "";
  created.note = snapshot.note || "";
  created.attributes = JSON.parse(JSON.stringify(snapshot.attributes || {})) as Record<string, string>;
  parent.children.push(createdId);
  (snapshot.children || []).forEach((childSnapshot) => {
    cloneSnapshotUnderParent(createdId, childSnapshot);
  });
  return createdId;
}

async function copyTextToSystemClipboard(text: string): Promise<void> {
  if (!text || !navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Ignore clipboard permission failures and keep internal clipboard available.
  }
}

function buildNodePath(nodeId: string): string {
  if (!map) return "";
  const parts: string[] = [];
  let cursor: string | null = nodeId;
  while (cursor) {
    const n: TreeNode | undefined = map.state.nodes[cursor];
    if (!n) break;
    parts.unshift(uiLabel(n));
    cursor = n.parentId ?? null;
  }
  return parts.join(" / ");
}

function copyNodePath(): void {
  if (!map) return;
  const path = buildNodePath(viewState.selectedNodeId);
  void copyTextToSystemClipboard(path);
  setStatus(`Path copied: ${path}`);
}

function copyScopeId(): void {
  if (!map) return;
  const id = normalizedCurrentScopeId();
  void copyTextToSystemClipboard(id);
  setStatus(`Scope ID copied: ${id}`);
}

function copySelected(): void {
  const roots = getSelectionRoots();
  if (roots.length === 0) {
    return;
  }
  const snapshots = roots.map((rootId) => toSubtreeSnapshot(rootId));
  viewState.clipboardState = {
    type: "copy",
    snapshots,
  };
  void copyTextToSystemClipboard(roots.map((rootId) => uiLabel(getNode(rootId))).join("\n"));
  scheduleRender();
  setStatus(`Copied ${roots.length} node(s).`);
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

function pasteClipboard(): void {
  if (!map || !viewState.clipboardState) {
    setStatus("Clipboard is empty.", true);
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
    pushUndoSnapshot();
    let firstPastedId: string | null = null;
    snapshots.forEach((snapshot) => {
      const pastedId = cloneSnapshotUnderParent(targetParentId, snapshot);
      if (!firstPastedId) {
        firstPastedId = pastedId;
      }
    });
    if (firstPastedId) {
      setSingleSelection(firstPastedId, false);
    }
    touchDocument();
    setStatus(`Pasted ${snapshots.length} copied node(s).`);
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

viewSystemBtn?.addEventListener("click", () => {
  setSurfaceViewMode("system");
});

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
  await pushDocToCloud(true);
});

cloudUseLocalBtn?.addEventListener("click", async () => {
  await pushDocToCloud(true, true);
});

cloudUseCloudBtn?.addEventListener("click", async () => {
  const pulled = await pullDocFromCloud(true);
  if (!pulled) {
    setStatus("Cloud map not found.", true);
  }
});

importFileBtn?.addEventListener("click", () => {
  fileInput.click();
});

importVaultBtn?.addEventListener("click", () => {
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

document.addEventListener("click", () => {
  closeToolbarMenus();
});

canvas.addEventListener("pointerdown", (event: PointerEvent) => {
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
  if (!map || !nodeId || event.button !== 0) {
    return;
  }
  viewState.dragState = {
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
  if (!viewState.dragState || event.pointerId !== viewState.dragState.pointerId) {
    return;
  }
  const dx = event.clientX - viewState.dragState.startX;
  const dy = event.clientY - viewState.dragState.startY;
  const distance = Math.hypot(dx, dy);
  if (!viewState.dragState.dragged && distance < VIEWER_TUNING.drag.reparentThreshold) {
    return;
  }
  viewState.dragState.dragged = true;
  viewState.dragState.proposal = proposeDropForSources(viewState.dragState.sourceRootIds, event.clientX, event.clientY);
  scheduleRender();
});

function finishNodeDrag(event: PointerEvent): void {
  if (!viewState.dragState || event.pointerId !== viewState.dragState.pointerId) {
    return;
  }
  const { sourceNodeId, sourceRootIds, proposal, dragged } = viewState.dragState;
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
  startInlineEdit(nodeId);
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
  // Normalize deltas to pixels so zoom/pan feel identical across browsers and
  // operating systems. deltaMode=0 (pixel) is left as-is — that is the Mac
  // trackpad baseline everything else is scaled to match.
  const deltaScale = event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? 800 : 1;
  const deltaX = event.deltaX * deltaScale;
  const deltaY = event.deltaY * deltaScale;
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
  console.log("[pinch-debug] pointerdown", { id: event.pointerId, type: event.pointerType, button: event.button, isPrimary: event.isPrimary, x: event.clientX, y: event.clientY, activeCount: activePointers.size });
  if (event.button !== 0) {
    return;
  }
  if ((event.target as HTMLElement | null)?.closest(".linear-panel")) {
    return;
  }

  // Track touch pointers for pinch
  if (event.pointerType === "touch") {
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    board.setPointerCapture(event.pointerId);
    console.log("[pinch-debug] touch pointer added, activePointers.size =", activePointers.size);
    if (activePointers.size === 2) {
      startPinch();
      console.log("[pinch-debug] pinch started!", viewState.pinchState);
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
  viewState.cameraX = viewState.panState.cameraX + (event.clientX - viewState.panState.startX);
  viewState.cameraY = viewState.panState.cameraY + (event.clientY - viewState.panState.startY);
  scheduleApplyZoom();
});

function endPointer(event: PointerEvent): void {
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

  if (document.activeElement === linearTextEl) {
    return;
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
  // Toggle review mode with bare R (when not already in review mode)
  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === "r" && !viewState.reviewMode) {
    event.preventDefault();
    toggleReviewMode();
    return;
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
    copySelected();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "x") {
    event.preventDefault();
    cutSelected();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "v") {
    event.preventDefault();
    pasteClipboard();
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

  if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === "c") {
    event.preventDefault();
    copyNodePath();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === "i") {
    event.preventDefault();
    copyScopeId();
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

  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === "]") {
    event.preventDefault();
    EnterScopeCommand(viewState.selectedNodeId);
    fitDocument();
    requestAnimationFrame(() => {
      fitDocument();
    });
    board.focus();
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key === "[") {
    event.preventDefault();
    ExitScopeCommand();
    fitDocument();
    requestAnimationFrame(() => {
      fitDocument();
    });
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

  if (event.key === " ") {
    event.preventDefault();
    toggleCollapse();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    if (currentSurfaceIsFlowMode()) {
      selectFlowVertical(-1);
      return;
    }
    if (event.shiftKey) {
      extendSelectionBreadth(-1);
      return;
    }
    selectBreadth(-1);
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (currentSurfaceIsFlowMode()) {
      selectFlowVertical(1);
      return;
    }
    if (event.shiftKey) {
      extendSelectionBreadth(1);
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
syncVaultUi();
updateCloudSyncUi();

void initializeDocument().then(() => {
  initBroadcastSync();
  initDocWatch();
  initVaultWatchStream();
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
    syncThinkingModeUi();
    setSingleSelection(initialScopeId, false);
    normalizeSelectionState();
    render();
    updateScopeInUrl(initialScopeId);
  }
  fitDocument() || applyZoom();

  // Skip home screen — go straight to map root
  // To open home screen, user can press the toggle shortcut
});

window.addEventListener("beforeunload", () => {
  if (collabToken) {
    void unregisterCollabEntity(false);
  }
});

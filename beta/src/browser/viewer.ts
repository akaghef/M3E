const fileInput = document.getElementById("file-input") as HTMLInputElement;
const loadDefaultBtn = document.getElementById("load-default");
const runAircraftVisualCheckBtn = document.getElementById("run-aircraft-visual-check");
const stopVisualCheckBtn = document.getElementById("stop-visual-check");
const modeFlashBtn = document.getElementById("mode-flash");
const modeRapidBtn = document.getElementById("mode-rapid");
const modeDeepBtn = document.getElementById("mode-deep");
const downloadBtn = document.getElementById("download-btn");
const downloadMmBtn = document.getElementById("download-mm-btn");
const hamburgerBtn = document.getElementById("hamburger-btn");
const hamburgerMenu = document.getElementById("hamburger-menu");
const exportBtn = document.getElementById("export-btn");
const exportMenu = document.getElementById("export-menu");
const metaPanelEl = document.querySelector(".meta-panel") as HTMLElement | null;
const modeMetaEl = document.getElementById("mode-meta") as HTMLElement;
const scopeMetaEl = document.getElementById("scope-meta") as HTMLElement;
const scopeSummaryEl = document.getElementById("scope-summary") as HTMLElement;
const metaEl = document.getElementById("meta") as HTMLElement;
const statusEl = document.getElementById("status") as HTMLElement;
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

function normalizeDocId(raw: string | null, fallback: string): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed.replace(/[\\/]/g, "_");
}

const queryParams = new URLSearchParams(window.location.search);
const WORKSPACE_ID = normalizeDocId(queryParams.get("workspaceId"), "local");
const LOCAL_DOC_ID = normalizeDocId(queryParams.get("localDocId"), "akaghef-beta");
const CLOUD_DOC_ID = normalizeDocId(queryParams.get("cloudDocId"), LOCAL_DOC_ID);
const AUTOSAVE_DELAY_MS = 700;
const MAX_UNDO_STEPS = 200;
const TAB_ID = crypto.randomUUID();
const LINEAR_TEXT_FONT_SCALE_MIN = 0.6;
const LINEAR_TEXT_FONT_SCALE_MAX = 1.4;
const LINEAR_TEXT_FONT_SCALE_STEP = 0.1;
const LINEAR_PANEL_WIDTH_MIN = 220;
const LINEAR_PANEL_WIDTH_MAX = 10000;

interface BcStateMessage {
  type: "STATE_UPDATE";
  fromTabId: string;
  state: AppState;
}

let bc: BroadcastChannel | null = null;

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

let doc: SavedDoc | null = null;
let visibleOrder: string[] = [];
let statusTimer: ReturnType<typeof setTimeout> | null = null;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let cycleViewState: "focus" | "fit" = "focus";
let inlineEditor: { nodeId: string; input: HTMLTextAreaElement; mode: "node-text" | "alias-label" | "target-text" } | null = null;
let contentWidth = 1600;
let contentHeight = 900;
let lastLayout: LayoutResult | null = null;
let visualCheckRunId = 0;
let undoStack: UndoSnapshot[] = [];
let redoStack: UndoSnapshot[] = [];
let linearDirty = false;
let linearLineMap: LinearLineMap[] = [];
let suppressLinearSelectionSync = false;
let suppressInlineBlurCommit = false;
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

// ── Scope Lock State ──
interface ClientScopeLock {
  scopeId: string;
  entityId: string;
  displayName: string;
  priority: number;
}
let scopeLockMap: Map<string, ClientScopeLock> = new Map(); // scopeId -> lock
let collabEntityId: string | null = null;
let collabToken: string | null = null;
let collabEventSource: EventSource | null = null;
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

function syncThinkingModeUi(): void {
  const mode = viewState.thinkingMode;
  modeMetaEl.textContent = `mode: ${thinkingModeLabel(mode)}`;
  modeFlashBtn?.classList.toggle("is-active", mode === "flash");
  modeRapidBtn?.classList.toggle("is-active", mode === "rapid");
  modeDeepBtn?.classList.toggle("is-active", mode === "deep");
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

function createEmptyDoc(): SavedDoc {
  const rootId = newId();
  return {
    version: 1,
    savedAt: nowIso(),
    state: {
      rootId,
      nodes: {
        [rootId]: createNodeRecord(rootId, null, "Research Root"),
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
  if (!doc) {
    return;
  }
  Object.assign(linearNotesByScope, sanitizeLinearNotesByScope(doc.state.linearNotesByScope));
}

function syncLinearNotesToDocState(): void {
  if (!doc) {
    return;
  }
  doc.state.linearNotesByScope = { ...linearNotesByScope };
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
  if (syncToState && doc) {
    doc.state.linearTextFontScale = clamped;
  }
}

function hydrateLinearTextFontScaleFromDocState(): void {
  linearTextFontScale = normalizeLinearTextFontScale(doc?.state.linearTextFontScale);
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

function ensureDocShape(payload: unknown): SavedDoc {
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
  return candidate as SavedDoc;
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
  if (v === "rect" || v === "rounded" || v === "pill") return v;
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
  band: string | null;
  confidence: number | null;
}

function readNodeStyleAttrs(attrs: Record<string, string>): NodeStyleAttrs {
  return {
    bg: sanitizeColor(attrs["m3e:bg"]),
    color: sanitizeColor(attrs["m3e:color"]),
    border: sanitizeColor(attrs["m3e:border"]),
    borderStyle: sanitizeBorderStyle(attrs["m3e:border-style"]),
    borderWidth: sanitizeNumeric(attrs["m3e:border-width"], 0, 8),
    shape: sanitizeShape(attrs["m3e:shape"]),
    icon: sanitizeIcon(attrs["m3e:icon"]),
    edgeColor: sanitizeColor(attrs["m3e:edge-color"]),
    edgeStyle: sanitizeBorderStyle(attrs["m3e:edge-style"]),
    edgeWidth: sanitizeNumeric(attrs["m3e:edge-width"], 1, 10),
    band: sanitizeBand(attrs["m3e:band"]),
    confidence: sanitizeNumeric(attrs["m3e:confidence"], 0, 1),
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
  return isRoot ? 60 : 12;
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

function parseMmText(xmlText: string): SavedDoc {
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
  const node = doc!.state.nodes[nodeId];
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }
  return node;
}

function isFolderNode(node: TreeNode | null | undefined): boolean {
  return Boolean(node && node.nodeType === "folder");
}

function currentScopeRootId(): string {
  if (!doc) {
    return "";
  }
  return viewState.currentScopeRootId || doc.state.rootId;
}

function currentScopeRootNode(): TreeNode | null {
  if (!doc) {
    return null;
  }
  return doc.state.nodes[currentScopeRootId()] || null;
}

function scopeRootForNode(nodeId: string): string {
  if (!doc || !doc.state.nodes[nodeId]) {
    return "";
  }
  let cursor: string | null = nodeId;
  let nearestFolderId: string | null = null;
  while (cursor) {
    const node: TreeNode | undefined = doc.state.nodes[cursor];
    if (!node) {
      break;
    }
    if (isFolderNode(node)) {
      nearestFolderId = node.id;
    }
    cursor = node.parentId ?? null;
  }
  return nearestFolderId || doc.state.rootId;
}

function scopePathIds(scopeRootId: string): string[] {
  if (!doc || !scopeRootId) {
    return [];
  }
  const path: string[] = [];
  let cursor: string | null = scopeRootId;
  while (cursor) {
    path.push(cursor);
    const node: TreeNode | undefined = doc.state.nodes[cursor];
    if (!node) {
      break;
    }
    if (cursor === doc.state.rootId) {
      break;
    }
    cursor = node.parentId ?? null;
    while (cursor) {
      const parent = doc.state.nodes[cursor];
      if (!parent) {
        cursor = null;
        break;
      }
      if (parent.id === doc.state.rootId || isFolderNode(parent)) {
        break;
      }
      cursor = parent.parentId ?? null;
    }
  }
  return path.reverse();
}

function updateScopeMeta(): void {
  if (!doc) {
    scopeMetaEl.textContent = "scope: n/a";
    return;
  }
  const parts = scopePathIds(currentScopeRootId()).map((nodeId) => {
    if (nodeId === doc!.state.rootId) {
      return "root";
    }
    return uiLabel(doc!.state.nodes[nodeId]);
  });
  scopeMetaEl.textContent = `scope: ${parts.join(" / ")}`;
}

function updateScopeSummary(): void {
  if (!doc) {
    scopeSummaryEl.textContent = "outside: n/a";
    return;
  }
  const scopeRootId = currentScopeRootId();
  const scopeRoot = doc.state.nodes[scopeRootId];
  if (!scopeRoot) {
    scopeSummaryEl.textContent = "outside: n/a";
    return;
  }

  const parentScopeId = scopeRootId === doc.state.rootId
    ? null
    : scopeRoot.parentId
      ? scopeRootForNode(scopeRoot.parentId)
      : doc.state.rootId;
  const parentLabel = parentScopeId
    ? (parentScopeId === doc.state.rootId ? "root" : uiLabel(doc.state.nodes[parentScopeId]))
    : "none";

  const childScopeSummaries = (scopeRoot.children || [])
    .map((childId) => doc!.state.nodes[childId])
    .filter((node): node is TreeNode => Boolean(node))
    .filter((node) => isFolderNode(node))
    .map((node) => `${uiLabel(node)}(${countHiddenDescendants(node.id)})`);

  const childSummary = childScopeSummaries.length > 0 ? childScopeSummaries.join(", ") : "none";
  scopeSummaryEl.textContent = `outside: parent ${parentLabel} | child scopes ${childSummary}`;
}

function enterScope(scopeNodeId: string): boolean {
  if (!doc) {
    return false;
  }
  const node = getNode(scopeNodeId);
  if (!isFolderNode(node)) {
    setStatus("Only folder nodes can open a scope.", true);
    return false;
  }
  viewState.currentScopeRootId = node.id;
  setSingleSelection(node.id, false);
  render();
  fitDocument();
  setStatus(`Entered scope: ${uiLabel(node)}`);
  board.focus();
  return true;
}

function exitScope(): boolean {
  if (!doc) {
    return false;
  }
  const scopeRoot = currentScopeRootNode();
  if (!scopeRoot || scopeRoot.id === doc.state.rootId) {
    setStatus("Already at root scope.");
    return false;
  }
  let nextScopeId = doc.state.rootId;
  let cursor = scopeRoot.parentId;
  while (cursor) {
    const parent = doc.state.nodes[cursor];
    if (!parent) {
      break;
    }
    if (parent.id === doc.state.rootId || isFolderNode(parent)) {
      nextScopeId = parent.id;
      break;
    }
    cursor = parent.parentId ?? null;
  }
  viewState.currentScopeRootId = nextScopeId;
  setSingleSelection(scopeRoot.parentId && doc.state.nodes[scopeRoot.parentId] ? scopeRoot.parentId : nextScopeId, false);
  render();
  fitDocument();
  setStatus("Returned to parent scope.");
  board.focus();
  return true;
}

function makeSelectedFolder(): boolean {
  if (!doc) {
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
  if (!doc) {
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
  doc.state.nodes[aliasId] = {
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
  if (!doc) {
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
  doc.state.nodes[aliasId] = {
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
  if (!doc) {
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
  if (!isAliasNode(node) || !node!.targetNodeId || !doc) {
    return null;
  }
  return doc.state.nodes[node!.targetNodeId] || null;
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
  if (!doc) {
    return;
  }
  Object.values(doc.state.nodes).forEach((node) => {
    if (!isAliasNode(node) || node.targetNodeId !== targetNodeId || node.aliasLabel || node.isBroken) {
      return;
    }
    const target = doc!.state.nodes[targetNodeId];
    if (target) {
      node.text = target.text;
    }
  });
}

function markAliasesBrokenInViewer(targetNodeId: string, targetLabel: string): void {
  if (!doc) {
    return;
  }
  Object.values(doc.state.nodes).forEach((node) => {
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
  if (!doc) {
    return;
  }
  undoStack.push({
    state: cloneState(doc.state),
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
  if (!doc || undoStack.length === 0) {
    setStatus("Nothing to undo.");
    return;
  }

  redoStack.push({
    state: cloneState(doc.state),
    selectedNodeId: viewState.selectedNodeId,
    selectedNodeIds: Array.from(viewState.selectedNodeIds),
    selectionAnchorId: viewState.selectionAnchorId,
  });
  if (redoStack.length > MAX_UNDO_STEPS) {
    redoStack.shift();
  }

  const snapshot = undoStack.pop()!;
  doc.state = snapshot.state;
  const undoState = doc.state;
  viewState.selectedNodeId = undoState.nodes[snapshot.selectedNodeId] ? snapshot.selectedNodeId : undoState.rootId;
  viewState.selectedNodeIds = new Set(snapshot.selectedNodeIds.filter((nodeId) => Boolean(undoState.nodes[nodeId])));
  viewState.selectionAnchorId = snapshot.selectionAnchorId && undoState.nodes[snapshot.selectionAnchorId]
    ? snapshot.selectionAnchorId
    : null;
  viewState.reparentSourceIds.clear();
  normalizeSelectionState();
  doc.savedAt = nowIso();
  render();
  scheduleAutosave();
  setStatus("Undo applied.");
  board.focus();
}

function redoLastChange(): void {
  if (!doc || redoStack.length === 0) {
    setStatus("Nothing to redo.");
    return;
  }

  undoStack.push({
    state: cloneState(doc.state),
    selectedNodeId: viewState.selectedNodeId,
    selectedNodeIds: Array.from(viewState.selectedNodeIds),
    selectionAnchorId: viewState.selectionAnchorId,
  });
  if (undoStack.length > MAX_UNDO_STEPS) {
    undoStack.shift();
  }

  const snapshot = redoStack.pop()!;
  doc.state = snapshot.state;
  const redoState = doc.state;
  viewState.selectedNodeId = redoState.nodes[snapshot.selectedNodeId] ? snapshot.selectedNodeId : redoState.rootId;
  viewState.selectedNodeIds = new Set(snapshot.selectedNodeIds.filter((nodeId) => Boolean(redoState.nodes[nodeId])));
  viewState.selectionAnchorId = snapshot.selectionAnchorId && redoState.nodes[snapshot.selectionAnchorId]
    ? snapshot.selectionAnchorId
    : null;
  viewState.reparentSourceIds.clear();
  normalizeSelectionState();
  doc.savedAt = nowIso();
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

  if (!doc || !lastLayout || visibleOrder.length === 0) {
    linearPanelEl.style.removeProperty("left");
    linearPanelEl.style.removeProperty("top");
    linearPanelEl.style.removeProperty("width");
    linearPanelEl.style.removeProperty("height");
    linearPanelEl.style.removeProperty("transform");
    _linearPanelLayoutDirty = true;
    return;
  }

  if (_linearPanelLayoutDirty) {
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
  if (doc) {
    doc.state.linearPanelWidth = linearPanelCanvasWidth;
  }
}

function syncInlineEditorPosition(): void {
  if (!inlineEditor || !doc || !lastLayout) {
    return;
  }

  const nodeId = inlineEditor.nodeId;
  const nodePos = lastLayout.pos[nodeId];
  if (!nodePos) {
    return;
  }

  const centerX = nodeId === doc.state.rootId ? nodePos.x + nodePos.w / 2 : nodePos.x + nodePos.w * 0.5;
  const centerY = nodePos.y;
  const left = viewState.cameraX + centerX * viewState.zoom;
  const top = viewState.cameraY + centerY * viewState.zoom;

  inlineEditor.input.style.left = `${left}px`;
  inlineEditor.input.style.top = `${top}px`;
  inlineEditor.input.style.transform = "translate(-50%, -50%)";
  inlineEditor.input.style.minWidth = `${Math.max(140, nodePos.w * viewState.zoom * 0.6)}px`;
}

function setZoom(nextZoom: number, anchorClientX: number | null = null, anchorClientY: number | null = null): void {
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
  setStatus(`Zoom ${Math.round(viewState.zoom * 100)}%`);
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

function currentLinearMemoScopeId(): string {
  return normalizedCurrentScopeId();
}

function normalizedCurrentScopeId(): string {
  if (!doc) {
    return "";
  }
  if (doc.state.nodes[viewState.currentScopeId]) {
    return viewState.currentScopeId;
  }
  return doc.state.rootId;
}

function isNodeInScope(nodeId: string): boolean {
  if (!doc) {
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
    currentId = doc.state.nodes[currentId]?.parentId ?? null;
  }
  return false;
}

function scopedChildrenRaw(nodeId: string): string[] {
  if (!doc) {
    return [];
  }
  const node = doc.state.nodes[nodeId];
  if (!node) {
    return [];
  }
  return (node.children || []).filter((childId) => isNodeInScope(childId));
}

function importanceScore(nodeId: string): number {
  if (!doc) {
    return 0;
  }
  const node = doc.state.nodes[nodeId];
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
  if (!doc || importanceViewMode === "all") {
    importanceVisibleNodeIds = null;
    return;
  }

  const threshold = importanceViewMode === "high-only" ? 3 : 2;
  const scopeRootId = normalizedCurrentScopeId();
  const visible = new Set<string>();

  function walk(nodeId: string): boolean {
    const node = doc!.state.nodes[nodeId];
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
  if (!doc) {
    return [];
  }
  const node = doc.state.nodes[nodeId];
  if (!node) {
    return [];
  }
  return scopedChildrenRaw(nodeId).filter((childId) => isNodeVisibleByImportance(childId));
}

function buildLinearFromScope(): { text: string; map: LinearLineMap[] } {
  if (!doc) {
    return { text: "", map: [] };
  }

  const scopeRootId = normalizedCurrentScopeId();
  const lines: string[] = [];
  const map: LinearLineMap[] = [];

  function walk(nodeId: string, depth: number): void {
    const node = doc!.state.nodes[nodeId];
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
    map,
  };
}

function buildTreeScopeTransformSource(): string {
  if (!doc) {
    return "";
  }

  const scopeRootId = normalizedCurrentScopeId();
  const chunks: string[] = [];

  function walk(nodeId: string, depth: number): void {
    const node = doc!.state.nodes[nodeId];
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
  const scopeLabel = doc?.state.nodes[scopeRootId]?.text || scopeRootId;
  const payload: AiSubagentRequest = {
    documentId: LOCAL_DOC_ID,
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
  if (!doc || !viewState.selectedNodeId) {
    throw new Error("No node is selected.");
  }
  const selected = getNode(viewState.selectedNodeId);
  const payload: AiSubagentRequest = {
    documentId: LOCAL_DOC_ID,
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

function appendTopicSuggestionsToSelectedNode(topics: string[]): number {
  if (!doc || !viewState.selectedNodeId || topics.length === 0) {
    return 0;
  }
  const parent = getNode(viewState.selectedNodeId);
  if (isAliasNode(parent)) {
    throw new Error("Alias nodes cannot own children.");
  }

  const existingLabels = new Set(
    (parent.children || [])
      .map((childId) => doc!.state.nodes[childId]?.text?.trim().toLowerCase())
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
    doc!.state.nodes[id] = createNodeRecord(id, parent.id, topic);
    parent.children.push(id);
  });
  viewState.collapsedIds.delete(parent.id);
  parent.collapsed = false;
  touchDocument();
  return normalized.length;
}

async function generateRelatedTopicsForSelectedNode(): Promise<void> {
  if (!doc || !viewState.selectedNodeId) {
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
  if (!linearTextEl) {
    return;
  }
  if (!doc) {
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

  const scopeLabel = doc.state.nodes[scopeRootId]?.text || scopeRootId;
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
  if (!doc) {
    return;
  }
  const stack: string[] = [nodeId];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const current = doc.state.nodes[currentId];
    if (!current) {
      continue;
    }
    stack.push(...(current.children || []));
    delete doc.state.nodes[currentId];
  }
}

function reconcileLinearSubtree(nodeId: string, draft: LinearNodeDraft): void {
  if (!doc) {
    return;
  }

  const node = getNode(nodeId);
  node.text = draft.label;
  const existingChildren = [...(node.children || [])];
  const nextChildren: string[] = [];

  draft.children.forEach((childDraft, index) => {
    const existingId = existingChildren[index];
    if (existingId && doc!.state.nodes[existingId]) {
      reconcileLinearSubtree(existingId, childDraft);
      nextChildren.push(existingId);
      return;
    }

    const newChildId = newId();
    doc!.state.nodes[newChildId] = createNodeRecord(newChildId, nodeId, childDraft.label);
    reconcileLinearSubtree(newChildId, childDraft);
    nextChildren.push(newChildId);
  });

  existingChildren.slice(draft.children.length).forEach((redundantId) => {
    deleteSubtree(redundantId);
  });

  node.children = nextChildren;
}

function applyLinearTextToScope(): void {
  if (!doc) {
    return;
  }
  try {
    const parsed = parseLinearText(linearTextEl.value);
    const scopeRootId = normalizedCurrentScopeId();

    pushUndoSnapshot();
    reconcileLinearSubtree(scopeRootId, parsed);

    if (!doc.state.nodes[viewState.selectedNodeId] || !isNodeInScope(viewState.selectedNodeId)) {
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
  if (!doc) {
    return 0;
  }
  const node = doc.state.nodes[nodeId];
  if (!node) {
    return 0;
  }
  let count = 0;
  const stack = [...(node.children || [])];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const current = doc.state.nodes[currentId];
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
  const metrics: Record<string, { w: number; h: number }> = {};
  const depthOf: Record<string, number> = {};
  const depthMaxWidth: Record<number, number> = {};
  let maxDepth = 0;

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
    totalWidth: Math.max(maxRight + VIEWER_TUNING.layout.canvasRightPad, cursorX + VIEWER_TUNING.layout.canvasRightPad),
  };
}

function updateDocumentTitle(): void {
  const appTitle = "M3E";
  if (!doc) {
    document.title = appTitle;
    return;
  }

  const scopeId = normalizedCurrentScopeId();
  const scopeNode = doc.state.nodes[scopeId];
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
  if (!doc) {
    syncThinkingModeUi();
    updateScopeMeta();
    updateScopeSummary();
    metaEl.textContent = "No data loaded";
    (canvas as Element).innerHTML = "";
    updateDocumentTitle();
    renderLinearPanel();
    syncLinearPanelPosition();
    return;
  }

  rebuildImportanceVisibility();
  normalizeSelectionState();

  const state = doc.state;
  if (!viewState.currentScopeRootId || !state.nodes[viewState.currentScopeRootId]) {
    viewState.currentScopeRootId = state.rootId;
  }
  const layout = buildLayout(state);
  lastLayout = layout;
  visibleOrder = layout.order;
  _linearPanelLayoutDirty = true;
  const displayRootId = currentScopeRootId();

  const pos = layout.pos;
  let maxX = Math.max(VIEWER_TUNING.layout.minCanvasWidth, layout.totalWidth);
  let maxY = Math.max(
    VIEWER_TUNING.layout.minCanvasHeight,
    layout.totalHeight + VIEWER_TUNING.layout.topPad + VIEWER_TUNING.layout.canvasBottomPad
  );
  let defs = "<defs>";
  let edges = "";
  let graphLinks = "";
  let overlays = "";
  let nodes = "";

  Object.values(state.links || {}).forEach((rawLink) => {
    const link = normalizeGraphLink(rawLink);
    const source = state.nodes[link.sourceNodeId];
    const target = state.nodes[link.targetNodeId];
    const sourcePos = pos[link.sourceNodeId];
    const targetPos = pos[link.targetNodeId];
    if (!source || !target || !sourcePos || !targetPos) {
      return;
    }
    if (!isNodeInScope(source.id) || !isNodeInScope(target.id) || !isNodeVisibleByImportance(source.id) || !isNodeVisibleByImportance(target.id)) {
      return;
    }

    const forward = targetPos.x >= sourcePos.x;
    const sourceX = forward
      ? sourcePos.x + sourcePos.w + VIEWER_TUNING.layout.edgeStartPad
      : sourcePos.x - VIEWER_TUNING.layout.edgeEndPad;
    const sourceY = sourcePos.y;
    const targetX = forward
      ? targetPos.x - VIEWER_TUNING.layout.edgeEndPad
      : targetPos.x + targetPos.w + VIEWER_TUNING.layout.edgeStartPad;
    const targetY = targetPos.y;
    const curve = Math.max(48, Math.abs(targetX - sourceX) * 0.45);
    const c1x = forward ? sourceX + curve : sourceX - curve;
    const c1y = sourceY;
    const c2x = forward ? targetX - curve : targetX + curve;
    const c2y = targetY;
    const controlX = (c1x + c2x) / 2;
    const controlY = (sourceY + targetY) / 2;
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

    graphLinks += `<path class="graph-link${styleClass}" data-link-id="${link.id}" stroke="${stroke}" d="M ${sourceX} ${sourceY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${targetX} ${targetY}"${markerStart}${markerEnd} />`;
    if (label) {
      graphLinks += `<text class="graph-link-label" data-link-id="${link.id}" x="${controlX}" y="${controlY - 8}" text-anchor="middle">${escapeXml(label)}</text>`;
    }
  });
  defs += "</defs>";

  function drawNode(nodeId: string): void {
    const node = state.nodes[nodeId];
    const p = pos[nodeId];
    if (!node || !p) {
      return;
    }

    maxX = Math.max(maxX, p.x + p.w + VIEWER_TUNING.layout.nodeRightPad);
    maxY = Math.max(maxY, p.y + p.h + VIEWER_TUNING.layout.nodeBottomPad);

    const children = visibleChildren(node);
    const nodeStyles = readNodeStyleAttrs(node.attributes || {});
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
      const curve = Math.max(48, (endX - startX) * 0.45);
      const c1x = startX + curve;
      const c1y = startY;
      const c2x = endX - curve;
      const c2y = endY;
      const edgeInline = buildEdgeStyle(nodeStyles);
      edges += `<path class="edge" stroke="${stroke}" d="M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}"${edgeInline ? ` style="${edgeInline}"` : ""} />`;
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
    const hitX = nodeId === displayRootId ? p.x : p.x - 8;
    const hitH = Math.max(VIEWER_TUNING.layout.nodeHitHeight, p.h);
    const hitY = p.y - hitH / 2;
    const hitW = nodeId === displayRootId ? p.w : p.w + 36;
    const hitRx = shapeRx(nodeStyles.shape, nodeId === displayRootId);
    const hitInline = buildNodeHitStyle(nodeStyles);
    nodes += `<rect class="${classNames.join(" ")}" data-node-id="${nodeId}" x="${hitX}" y="${hitY}" width="${hitW}" height="${hitH}" rx="${hitRx}"${hitInline ? ` style="${hitInline}"` : ""} />`;

    if (nodeId === displayRootId) {
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
      const rawLabelBase = uiLabel(node) || "(empty)";
      const rawLabel = nodeStyles.icon ? nodeStyles.icon + " " + rawLabelBase : rawLabelBase;
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
        nodes += `<rect class="folder-box" data-node-id="${nodeId}" x="${folderFrameX}" y="${folderFrameY}" width="${folderFrameW}" height="${folderFrameH}" rx="8"${folderBoxInline} />`;
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
        const startY = multilineTextStartY(p.y, labelLines.length, VIEWER_TUNING.typography.nodeFont, lineHeight);
        const tspans = multilineTspans(labelLines, p.x, lineHeight);
        const labelInline = buildLabelStyle(nodeStyles);
        nodes += `<text class="${labelClasses.join(" ")}" data-node-id="${nodeId}" x="${p.x}" y="${startY}" text-anchor="start" font-size="${VIEWER_TUNING.typography.nodeFont}"${labelInline ? ` style="${labelInline}"` : ""}>${tspans}</text>`;
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
    }

    if (viewState.collapsedIds.has(nodeId) && (node.children || []).length > 0) {
      const indicatorX =
        nodeId === displayRootId
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

    children.forEach((cid) => drawNode(cid));
  }

  drawNode(displayRootId);

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
  (canvas as Element).innerHTML = `${defs}${edges}${graphLinks}${overlays}${nodes}`;
  applyZoom();

  const version = doc.version ?? "n/a";
  const savedAt = doc.savedAt ?? "n/a";
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
  metaEl.textContent = `workspace: ${WORKSPACE_ID} | doc: ${LOCAL_DOC_ID} | cloud: ${CLOUD_DOC_ID} | version: ${version} | savedAt: ${savedAt} | nodes: ${nodeCount} | links: ${linkCount} | scope: ${normalizedCurrentScopeId()} | importance: ${importanceViewMode} | selected: ${selected ? uiLabel(selected) : "n/a"} (${viewState.selectedNodeIds.size}) | link-source: ${linkSourceLabel} | move-node: ${moveNodes.length > 0 ? `${moveNodes.length} selected` : "none"} | drop-target: ${dropLabel}`;
  updateScopeMeta();
  updateScopeSummary();
  updateDocumentTitle();
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
  if (!doc || !lastLayout) {
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
    const targetNode = doc?.state.nodes[targetNodeId];
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
  if (!doc) {
    return;
  }

  if (!doc.state.nodes[viewState.selectedNodeId] || !isNodeInScope(viewState.selectedNodeId) || !isNodeVisibleByImportance(viewState.selectedNodeId)) {
    viewState.selectedNodeId = normalizedCurrentScopeId();
  }

  const normalizedSelectedIds = new Set<string>();
  viewState.selectedNodeIds.forEach((nodeId) => {
    if (doc!.state.nodes[nodeId] && isNodeInScope(nodeId) && isNodeVisibleByImportance(nodeId)) {
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
    if (doc!.state.nodes[nodeId]) {
      normalizedReparentSourceIds.add(nodeId);
    }
  });
  viewState.reparentSourceIds = normalizedReparentSourceIds;

  if (viewState.clipboardState?.type === "cut") {
    const normalizedCutSourceIds = new Set<string>();
    viewState.clipboardState.sourceIds.forEach((nodeId) => {
      if (doc!.state.nodes[nodeId]) {
        normalizedCutSourceIds.add(nodeId);
      }
    });
    viewState.clipboardState = normalizedCutSourceIds.size > 0
      ? { type: "cut", sourceIds: normalizedCutSourceIds }
      : null;
  }

  if (viewState.linkSourceNodeId && !doc.state.nodes[viewState.linkSourceNodeId]) {
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
  const anchorId = viewState.selectionAnchorId && doc?.state.nodes[viewState.selectionAnchorId]
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
  if (!doc || scopeId === doc.state.rootId) {
    params.delete("scopeId");
  } else {
    params.set("scopeId", scopeId);
  }
  history.replaceState(null, "", `?${params.toString()}`);
}

function EnterScopeCommand(scopeId = viewState.selectedNodeId): void {
  if (!doc || !doc.state.nodes[scopeId]) {
    return;
  }
  const currentScopeId = normalizedCurrentScopeId();
  if (scopeId === currentScopeId) {
    return;
  }
  viewState.scopeHistory.push(currentScopeId);
  viewState.currentScopeId = scopeId;
  viewState.currentScopeRootId = scopeId;
  if (!isNodeInScope(viewState.selectedNodeId)) {
    setSingleSelection(scopeId, false);
  }
  normalizeSelectionState();
  render();
  setStatus(`Entered scope: ${getNode(scopeId).text}`);
  updateScopeInUrl(scopeId);
}

function ExitScopeCommand(): void {
  if (!doc || viewState.scopeHistory.length === 0) {
    return;
  }
  const previousScopeId = viewState.scopeHistory.pop()!;
  viewState.currentScopeId = doc.state.nodes[previousScopeId] ? previousScopeId : doc.state.rootId;
  viewState.currentScopeRootId = viewState.currentScopeId;
  if (!isNodeInScope(viewState.selectedNodeId)) {
    setSingleSelection(viewState.currentScopeId, false);
  }
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
  const state = doc!.state;
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
  if (!doc) {
    return [];
  }
  const parent = doc.state.nodes[parentId];
  if (!parent) {
    return [];
  }
  const result: { id: string; label: string; childCount: number; subFolders: ReturnType<typeof collectFolderTree> }[] = [];
  for (const childId of parent.children || []) {
    const child = doc.state.nodes[childId];
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
  if (!doc || !homeScreenEl) {
    return;
  }
  const existingBreadcrumb = homeScreenEl.querySelector(".home-breadcrumb");
  if (existingBreadcrumb) {
    existingBreadcrumb.remove();
  }

  const scopeId = currentScopeRootId();
  if (!scopeId || scopeId === doc.state.rootId) {
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
    const label = nodeId === doc.state.rootId ? "root" : uiLabel(doc.state.nodes[nodeId]);

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
  if (!homeScreenEl || !homeScopeTreeEl || !doc) {
    return;
  }
  homeScreenVisible = true;
  homeScreenEl.hidden = false;
  appEl?.classList.add("home-active");

  const rootId = doc.state.rootId;
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
  if (!doc) {
    return [];
  }
  const parent = doc.state.nodes[parentId];
  if (!parent) {
    return [];
  }
  const result: { id: string; label: string; nodeType: string; children: ReturnType<typeof collectEntityTree> }[] = [];
  for (const childId of parent.children || []) {
    const child = doc.state.nodes[childId];
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
      const actualNode = doc ? doc.state.nodes[node.id] : null;
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
  if (!doc || !entityListTreeEl) {
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
  if (!entityListPanelEl || !doc) {
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
  if (!entityScopeListEl || !doc) {
    return;
  }
  entityScopeListEl.innerHTML = "";

  const rootId = doc.state.rootId;
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
  rootName.textContent = uiLabel(doc.state.nodes[rootId]) || "Root";

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

function showScopeLockContextMenu(x: number, y: number, scopeId: string): void {
  const lock = scopeLockMap.get(scopeId);
  const items: { label: string; danger?: boolean; action: () => void }[] = [];

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
  const url = `/api/docs/${encodeURIComponent(LOCAL_DOC_ID)}/presence`;
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
  const url = `/api/docs/${encodeURIComponent(LOCAL_DOC_ID)}/audit?since=last-session`;
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

// ---- Scope Lock Management ----

function startCollabEventSource(): void {
  if (collabEventSource || !collabToken || !collabEntityId) {
    return;
  }
  const url = `/api/collab/events/${encodeURIComponent(collabEntityId)}`;
  const headers = new Headers({ Authorization: `Bearer ${collabToken}` });
  // EventSource does not support custom headers; use fetch-based SSE instead
  // For now, try the standard endpoint (auth may be checked via query or cookie)
  collabEventSource = new EventSource(url);

  collabEventSource.addEventListener("lock_acquired", (event: Event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data);
      scopeLockMap.set(data.scopeId, {
        scopeId: data.scopeId,
        entityId: data.entityId,
        displayName: data.displayName || data.entityId,
        priority: data.priority || 0,
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
  fetch("/api/collab/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "Viewer", role: "human", capabilities: ["read", "write"] }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.ok && data.entityId && data.token) {
        collabEntityId = data.entityId;
        collabToken = data.token;
        startCollabEventSource();
      }
    })
    .catch(() => {
      // Collab not available, ignore
    });
}

// ---- Broken Alias Detection ----

function findBrokenAliases(): { nodeId: string; label: string; targetNodeId: string }[] {
  if (!doc) {
    return [];
  }
  const result: { nodeId: string; label: string; targetNodeId: string }[] = [];
  for (const node of Object.values(doc.state.nodes)) {
    if (node.nodeType !== "alias") {
      continue;
    }
    if (!node.targetNodeId || !doc.state.nodes[node.targetNodeId]) {
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
  if (!doc) {
    return;
  }
  const node = doc.state.nodes[aliasNodeId];
  if (!node) {
    return;
  }
  pushUndoSnapshot();
  const parentId = node.parentId;
  if (parentId && doc.state.nodes[parentId]) {
    doc.state.nodes[parentId].children = doc.state.nodes[parentId].children.filter((c) => c !== aliasNodeId);
  }
  delete doc.state.nodes[aliasNodeId];
  if (viewState.selectedNodeId === aliasNodeId) {
    viewState.selectedNodeId = parentId || doc.state.rootId;
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
  if (!doc) {
    return;
  }
  const node = doc.state.nodes[aliasNodeId];
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

function showConflictPanel(remoteState: AppState): void {
  if (!conflictPanelEl || !conflictLocalTreeEl || !conflictRemoteTreeEl || !conflictDiffSummaryEl || !doc) {
    return;
  }

  conflictRemoteState = remoteState;
  conflictPanelVisible = true;
  conflictPanelEl.hidden = false;

  const localState = doc.state;
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
  board.focus();
}

if (conflictCloseBtn) {
  conflictCloseBtn.addEventListener("click", () => {
    hideConflictPanel();
  });
}

if (conflictUseLocalBtn) {
  conflictUseLocalBtn.addEventListener("click", () => {
    hideConflictPanel();
    pushDocToCloud(true, true);
  });
}

if (conflictUseRemoteBtn) {
  conflictUseRemoteBtn.addEventListener("click", () => {
    if (conflictRemoteState && doc) {
      hideConflictPanel();
      pullDocFromCloud(true);
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
  doc!.state.nodes[id] = createNodeRecord(id, parentId, "New Node");
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
  doc!.state.nodes[id] = createNodeRecord(id, parent.id, "New Sibling");
  parent.children.splice(currentIndex + 1, 0, id);
  setSingleSelection(id, false);
  touchDocument();
  board.focus();
}

function selectedLinkableNode(): TreeNode | null {
  if (!doc || !viewState.selectedNodeId) {
    return null;
  }
  const node = doc.state.nodes[viewState.selectedNodeId];
  if (!node || isAliasNode(node)) {
    return null;
  }
  return node;
}

function findExistingGraphLink(sourceNodeId: string, targetNodeId: string): GraphLink | null {
  if (!doc) {
    return null;
  }
  const links = Object.values(doc.state.links || {});
  return links.find((link) => link.sourceNodeId === sourceNodeId && link.targetNodeId === targetNodeId) || null;
}

function markLinkSource(): void {
  if (!doc) {
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
  if (!doc) {
    return;
  }
  const sourceId = viewState.linkSourceNodeId;
  if (!sourceId) {
    setStatus("No link source marked.", true);
    return;
  }
  const source = doc.state.nodes[sourceId];
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
  if (!doc.state.links) {
    doc.state.links = {};
  }
  doc.state.links[linkId] = normalizeGraphLink({
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
      return true;
    }
    if ((node.aliasLabel || node.text) === next) {
      return true;
    }
    pushUndoSnapshot();
    node.aliasLabel = next;
    node.text = next;
    touchDocument();
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
  if (!doc) {
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
  if (!doc || !lastLayout || !lastLayout.pos[nodeId]) {
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
  if (!doc) {
    return 0;
  }
  const stateNodes = doc.state.nodes;
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
  if (!doc) {
    return [];
  }
  const selectedSet = new Set<string>(Array.from(selectedIds).filter((nodeId) => Boolean(doc!.state.nodes[nodeId])));
  return Array.from(selectedSet).filter((nodeId) => {
    const parentId = doc!.state.nodes[nodeId]?.parentId ?? null;
    return !parentId || !selectedSet.has(parentId);
  });
}

function getMovableSelectionRoots(selectedIds = viewState.selectedNodeIds): string[] {
  if (!doc) {
    return [];
  }
  const movableIds = new Set<string>();
  selectedIds.forEach((nodeId) => {
    const node = doc!.state.nodes[nodeId];
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
    const rootNode = doc!.state.nodes[rootId];
    if (!rootNode || rootNode.parentId === null) {
      return;
    }
    const parent = getNode(rootNode.parentId);
    parent.children = parent.children.filter((id) => id !== rootId);
    const stack: string[] = [rootId];
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      const current = doc!.state.nodes[currentId];
      if (!current) {
        continue;
      }
      if (!isAliasNode(current)) {
        markAliasesBrokenInViewer(currentId, uiLabel(current));
      }
      stack.push(...(current.children || []));
      viewState.reparentSourceIds.delete(currentId);
      delete doc!.state.nodes[currentId];
    }
  });

  let cursor: string | null = firstRootParentId ?? doc!.state.rootId;
  while (cursor && !doc!.state.nodes[cursor]) {
    cursor = cursor === doc!.state.rootId ? null : (doc!.state.nodes[cursor]?.parentId ?? null);
  }
  setSingleSelection(cursor || doc!.state.rootId, false);

  if (!doc!.state.nodes[viewState.currentScopeId]) {
    viewState.currentScopeId = viewState.selectedNodeId;
  }
  if (!doc!.state.nodes[viewState.currentScopeRootId]) {
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
  const blob = new Blob([JSON.stringify({ version: doc!.version, savedAt: nowIso(), state: doc!.state }, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "rapid-edited.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function currentDocSnapshot(): SavedDoc {
  syncLinearNotesToDocState();
  return {
    version: 1,
    savedAt: nowIso(),
    state: doc!.state,
  };
}

async function saveDocToLocalDb(showStatus = false): Promise<boolean> {
  if (!doc) {
    return false;
  }

  try {
    const response = await fetch(`/api/docs/${encodeURIComponent(LOCAL_DOC_ID)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-M3E-Tab-Id": TAB_ID,
      },
      body: JSON.stringify(currentDocSnapshot()),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(String(errorPayload.error || `HTTP ${response.status}`));
    }

    const payload = await response.json().catch(() => ({ savedAt: nowIso() }));
    doc.savedAt = String(payload.savedAt || nowIso());
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
    const response = await fetch(`/api/sync/status/${encodeURIComponent(CLOUD_DOC_ID)}`, { cache: "no-store" });
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
  if (!doc || !cloudSyncEnabled) {
    return false;
  }
  try {
    const baseSavedAt = cloudSavedAt;
    const response = await fetch(`/api/sync/push/${encodeURIComponent(CLOUD_DOC_ID)}`, {
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
        const pullResp = await fetch(`/api/sync/pull/${encodeURIComponent(CLOUD_DOC_ID)}`, {
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
    doc.savedAt = String(payload.savedAt || nowIso());
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
    const response = await fetch(`/api/sync/pull/${encodeURIComponent(CLOUD_DOC_ID)}`, {
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
      setStatus("Loaded cloud document.");
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
    const response = await fetch(`/api/docs/${encodeURIComponent(LOCAL_DOC_ID)}`, { cache: "no-store" });
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
      setStatus("Loaded local document.");
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
  if (!doc || hasLinearNotes(sanitizeLinearNotesByScope(doc.state.linearNotesByScope))) {
    return;
  }
  try {
    const response = await fetch(`/api/docs/${encodeURIComponent(LOCAL_DOC_ID)}`, { cache: "no-store" });
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
    // Fallback load is best-effort. Keep current document as-is when unavailable.
  }
}

function scheduleAutosave(): void {
  if (!doc) {
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
    bc = new BroadcastChannel(`m3e-doc-${LOCAL_DOC_ID}`);
  } catch {
    return;
  }
  bc.onmessage = (ev: MessageEvent<BcStateMessage>) => {
    if (!doc || ev.data.fromTabId === TAB_ID) {
      return;
    }
    if (ev.data.type === "STATE_UPDATE" && isValidAppState(ev.data.state)) {
      doc.state = ev.data.state;
      scheduleRender();
    }
  };
  window.addEventListener("beforeunload", () => bc?.close());
}

function broadcastState(): void {
  if (!bc || !doc) {
    return;
  }
  const msg: BcStateMessage = { type: "STATE_UPDATE", fromTabId: TAB_ID, state: doc.state };
  bc.postMessage(msg);
}

// ---------------------------------------------------------------------------
// Doc-watch SSE — auto-refresh on external DB changes
// ---------------------------------------------------------------------------

let docWatchEs: EventSource | null = null;
let lastAppliedSavedAt: string | null = null;

function initDocWatch(): void {
  if (docWatchEs) return;
  const url = `/api/docs/${encodeURIComponent(LOCAL_DOC_ID)}/watch`;
  docWatchEs = new EventSource(url);

  docWatchEs.addEventListener("doc_updated", (ev: MessageEvent) => {
    try {
      const data = JSON.parse(ev.data) as { docId: string; savedAt: string; sourceTabId: string | null };
      // Ignore our own saves
      if (data.sourceTabId === TAB_ID) return;
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

  window.addEventListener("beforeunload", () => docWatchEs?.close());
}

async function applyExternalUpdate(savedAt: string): Promise<void> {
  try {
    const response = await fetch(`/api/docs/${encodeURIComponent(LOCAL_DOC_ID)}`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    const newDoc = ensureDocShape(payload);
    // Only apply if actually newer
    if (doc && newDoc.savedAt <= (doc.savedAt || "")) return;
    lastAppliedSavedAt = savedAt;

    // Preserve view state
    const prevScopeId = viewState.currentScopeId;
    const prevSelectedId = viewState.selectedNodeId;
    const prevCollapsed = new Set(viewState.collapsedIds);
    const prevScopeHistory = [...viewState.scopeHistory];

    doc = newDoc;
    hydrateLinearNotesFromDocState();
    hydrateLinearTextFontScaleFromDocState();
    if (doc.state.linearPanelWidth != null) {
      linearPanelCanvasWidth = doc.state.linearPanelWidth;
    }

    // Restore view state if nodes still exist
    if (doc.state.nodes[prevScopeId]) {
      viewState.currentScopeId = prevScopeId;
      viewState.currentScopeRootId = prevScopeId;
      viewState.scopeHistory = prevScopeHistory;
    }
    if (doc.state.nodes[prevSelectedId]) {
      viewState.selectedNodeId = prevSelectedId;
      viewState.selectedNodeIds = new Set([prevSelectedId]);
    }
    viewState.collapsedIds = prevCollapsed;

    render();
    setStatus("Document updated externally.");
    broadcastState();
  } catch {
    // will retry on next SSE event
  }
}

function touchDocument(): void {
  if (!doc) {
    return;
  }
  doc.savedAt = nowIso();
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
  if (!doc) {
    return;
  }
  const node = getNode(viewState.selectedNodeId);
  if (node.parentId && isNodeInScope(node.parentId)) {
    selectNode(node.parentId);
  }
}

function selectChild(): void {
  if (!doc) {
    return;
  }
  const node = getNode(viewState.selectedNodeId);
  const children = visibleChildren(node);
  if (children.length === 0) {
    return;
  }
  selectNode(children[0]!);
}

function getBreadthSelectionTarget(direction: -1 | 1): string | null {
  if (!doc || !lastLayout) {
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
    doc = ensureDocShape(payload);
    hydrateLinearNotesFromDocState();
    hydrateLinearTextFontScaleFromDocState();
    if (doc.state.linearPanelWidth != null) {
      linearPanelCanvasWidth = doc.state.linearPanelWidth;
    }
    undoStack = [];
    redoStack = [];
    linearDirty = false;
    viewState.currentScopeId = doc.state.rootId;
    viewState.scopeHistory = [];
    viewState.selectedNodeId = doc.state.rootId;
    viewState.selectedNodeIds = new Set([doc.state.rootId]);
    viewState.selectionAnchorId = null;
    viewState.currentScopeRootId = doc.state.rootId;
    viewState.thinkingMode = "rapid";
    viewState.clipboardState = null;
    viewState.linkSourceNodeId = "";
    viewState.reparentSourceIds = new Set<string>();
    viewState.collapsedIds = new Set(
      Object.values(doc.state.nodes)
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
  if (!doc || !lastLayout || !lastLayout.pos[nodeId]) {
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
  if (!doc) {
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
  if (!doc) {
    return "";
  }
  const target = String(text || "").trim().toLowerCase();
  const node = Object.values(doc.state.nodes).find((entry) => String(entry.text || "").trim().toLowerCase() === target);
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
    { label: "Load aircraft.mm", run: async () => { await loadAircraftMmDemo(); resetCamera(); centerOnNode(doc!.state.rootId, 1); } },
    { label: "Zoom out for whole-map scan", run: async () => { centerOnNode(doc!.state.rootId, 0.72); } },
    { label: "Select Body branch", run: async () => { const nodeId = findNodeIdByText("Body"); selectNode(nodeId); centerOnNode(nodeId, 0.95); } },
    { label: "Collapse Body branch", run: async () => { const nodeId = findNodeIdByText("Body"); selectNode(nodeId); if (!viewState.collapsedIds.has(nodeId)) { toggleCollapse(); } centerOnNode(nodeId, 0.95); } },
    { label: "Expand Body branch", run: async () => { const nodeId = findNodeIdByText("Body"); selectNode(nodeId); if (viewState.collapsedIds.has(nodeId)) { toggleCollapse(); } centerOnNode(nodeId, 0.95); } },
    { label: "Select Wing branch", run: async () => { const nodeId = findNodeIdByText("Wing"); selectNode(nodeId); centerOnNode(nodeId, 0.92); } },
    { label: "Collapse Wing branch", run: async () => { const nodeId = findNodeIdByText("Wing"); selectNode(nodeId); if (!viewState.collapsedIds.has(nodeId)) { toggleCollapse(); } centerOnNode(nodeId, 0.92); } },
    { label: "Expand Wing branch", run: async () => { const nodeId = findNodeIdByText("Wing"); selectNode(nodeId); if (viewState.collapsedIds.has(nodeId)) { toggleCollapse(); } centerOnNode(nodeId, 0.92); } },
    { label: "Inspect Main Wing label scale", run: async () => { const nodeId = findNodeIdByText("Main Wing"); selectNode(nodeId); centerOnNode(nodeId, 1.15); } },
    { label: "Inspect Propeller label scale", run: async () => { const nodeId = findNodeIdByText("Propeller"); selectNode(nodeId); centerOnNode(nodeId, 1.15); } },
    { label: "Return to root overview", run: async () => { selectNode(doc!.state.rootId); centerOnNode(doc!.state.rootId, 0.8); } },
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
    const current: TreeNode | undefined = doc!.state.nodes[currentId];
    currentId = current ? current.parentId : null;
  }
  return false;
}

function ancestorPathToRoot(nodeId: string): string[] {
  if (!doc) {
    return [];
  }
  const path: string[] = [];
  let cursor: string | null = nodeId;
  while (cursor) {
    path.push(cursor);
    cursor = doc.state.nodes[cursor]?.parentId ?? null;
  }
  return path;
}

function findLowestCommonAncestor(nodeIds: string[]): string | null {
  if (!doc || nodeIds.length === 0) {
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
  if (!doc || viewState.selectedNodeIds.size === 0) {
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
  if (!doc) {
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
  if (!doc) {
    return;
  }
  const roots = getSelectionRoots().filter((nodeId) => getNode(nodeId).parentId !== null);
  if (roots.length <= 1) {
    setStatus("Select multiple nodes to group.", true);
    return;
  }

  const lcaId = findLowestCommonAncestor(roots) || doc.state.rootId;
  const lca = getNode(lcaId);
  const childIndexes = roots
    .map((rootId) => lca.children.indexOf(rootId))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
  const insertIndex = childIndexes.length > 0 ? childIndexes[0]! : lca.children.length;

  pushUndoSnapshot();
  const newGroupId = newId();
  doc.state.nodes[newGroupId] = createNodeRecord(newGroupId, lca.id, "");
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
  doc!.state.nodes[createdId] = createNodeRecord(createdId, parentId, snapshot.text || "New Node");
  const created = doc!.state.nodes[createdId]!;
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
  if (!doc) return "";
  const parts: string[] = [];
  let cursor: string | null = nodeId;
  while (cursor) {
    const n: TreeNode | undefined = doc.state.nodes[cursor];
    if (!n) break;
    parts.unshift(uiLabel(n));
    cursor = n.parentId ?? null;
  }
  return parts.join(" / ");
}

function copyNodePath(): void {
  if (!doc) return;
  const path = buildNodePath(viewState.selectedNodeId);
  void copyTextToSystemClipboard(path);
  setStatus(`Path copied: ${path}`);
}

function copyScopeId(): void {
  if (!doc) return;
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
  if (!doc || !viewState.clipboardState) {
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
        if (!doc) {
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
  if (!doc) {
    return;
  }
  const scopeRootId = currentLinearMemoScopeId();
  linearNotesByScope[scopeRootId] = linearTextEl.value;
  syncLinearNotesToDocState();
  scheduleAutosave();
  const templateText = buildLinearFromScope().text;
  linearDirty = linearTextEl.value !== templateText;
  if (linearMetaEl) {
    const scopeLabel = doc.state.nodes[scopeRootId]?.text || scopeRootId;
    linearMetaEl.textContent = `scope memo: ${scopeLabel} | ${linearDirty ? "dirty" : "synced"}`;
  }
  if (linearApplyBtn) linearApplyBtn.disabled = !linearDirty;
  if (linearResetBtn) linearResetBtn.disabled = !linearDirty;
});

linearTextEl?.addEventListener("keydown", (event: KeyboardEvent) => {
  if (!doc) {
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
  if (doc) {
    doc.state.linearPanelWidth = linearPanelCanvasWidth;
    scheduleAutosave();
  }
}

linearResizeHandleEl?.addEventListener("pointerup", endLinearResize);
linearResizeHandleEl?.addEventListener("pointercancel", endLinearResize);

linearApplyBtn?.addEventListener("click", () => {
  if (!doc || !linearDirty) {
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
    setStatus("Cloud document not found.", true);
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
    setStatus("Cloud document not found.", true);
  }
});

downloadBtn?.addEventListener("click", () => {
  if (!doc) return;
  downloadJson();
});

downloadMmBtn?.addEventListener("click", () => {
  if (!doc) return;
  downloadMm();
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
  exportMenu && (exportMenu.hidden = true);
  toggleDropdown(hamburgerMenu, hamburgerBtn);
});

exportBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  hamburgerMenu && (hamburgerMenu.hidden = true);
  toggleDropdown(exportMenu, exportBtn);
});

document.addEventListener("click", () => {
  if (hamburgerMenu && !hamburgerMenu.hidden) hamburgerMenu.hidden = true;
  if (exportMenu && !exportMenu.hidden) exportMenu.hidden = true;
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
  if (!doc || !nodeId || event.button !== 0) {
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
  if (!doc || !nodeId) {
    return;
  }
  selectNode(nodeId);
  startInlineEdit(nodeId);
});

// Right-click context menu for scope lock on folder nodes
canvas.addEventListener("contextmenu", (event: MouseEvent) => {
  const target = event.target as Element | null;
  const nodeId = target?.closest("[data-node-id]")?.getAttribute("data-node-id");
  if (!nodeId || !doc) {
    return;
  }
  const node = doc.state.nodes[nodeId];
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
  setZoom(viewState.zoom * factor, event.clientX, event.clientY);
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
    setZoom(nextZoom, anchorX, anchorY);
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
  if (!doc) {
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

  if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key === "0") {
    event.preventDefault();
    fitDocument();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key === "]") {
    event.preventDefault();
    enterScope(viewState.selectedNodeId);
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key === "[") {
    event.preventDefault();
    exitScope();
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

  if (event.altKey && event.key.toLowerCase() === "h") {
    event.preventDefault();
    if (homeScreenVisible) {
      hideHomeScreen();
    } else {
      showHomeScreen();
    }
    return;
  }

  if (event.altKey && event.key.toLowerCase() === "v") {
    event.preventDefault();
    if (cycleViewState === "focus") {
      if (doc && viewState.selectedNodeId) {
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

  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "f") {
    event.preventDefault();
    makeSelectedFolder();
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "i") {
    event.preventDefault();
    toggleMetaPanelVisibility();
    return;
  }

  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "j") {
    event.preventDefault();
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
    if (event.shiftKey) {
      extendSelectionBreadth(-1);
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

updateCloudSyncUi();

void initializeDocument().then(() => {
  initBroadcastSync();
  initDocWatch();
  tryCollabRegister();
  const initialScopeId = queryParams.get("scopeId");
  if (initialScopeId && doc && doc.state.nodes[initialScopeId] && initialScopeId !== doc.state.rootId) {
    // Build ancestor chain so ExitScopeCommand can step back through each level
    const ancestors: string[] = [];
    let cur = doc.state.nodes[initialScopeId];
    while (cur && cur.parentId && cur.id !== doc.state.rootId) {
      ancestors.unshift(cur.parentId);
      cur = doc.state.nodes[cur.parentId];
    }
    viewState.scopeHistory = ancestors;
    viewState.currentScopeId = initialScopeId;
    viewState.currentScopeRootId = initialScopeId;
    setSingleSelection(initialScopeId, false);
    normalizeSelectionState();
    render();
    updateScopeInUrl(initialScopeId);
  }
  fitDocument() || applyZoom();

  // Skip home screen — go straight to map root
  // To open home screen, user can press the toggle shortcut
});

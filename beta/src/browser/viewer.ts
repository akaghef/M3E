const fileInput = document.getElementById("file-input") as HTMLInputElement;
const loadDefaultBtn = document.getElementById("load-default");
const loadAirplaneBtn = document.getElementById("load-airplane");
const loadAircraftMmBtn = document.getElementById("load-aircraft-mm");
const runAircraftVisualCheckBtn = document.getElementById("run-aircraft-visual-check");
const stopVisualCheckBtn = document.getElementById("stop-visual-check");
const modeFlashBtn = document.getElementById("mode-flash");
const modeRapidBtn = document.getElementById("mode-rapid");
const modeDeepBtn = document.getElementById("mode-deep");
const fitAllBtn = document.getElementById("fit-all");
const focusSelectedBtn = document.getElementById("focus-selected");
const addChildBtn = document.getElementById("add-child");
const addSiblingBtn = document.getElementById("add-sibling");
const makeFolderBtn = document.getElementById("make-folder");
const enterScopeBtn = document.getElementById("enter-scope");
const exitScopeBtn = document.getElementById("exit-scope");
const addAliasBtn = document.getElementById("add-alias");
const jumpTargetBtn = document.getElementById("jump-target");
const toggleCollapseBtn = document.getElementById("toggle-collapse");
const deleteNodeBtn = document.getElementById("delete-node");
const markReparentBtn = document.getElementById("mark-reparent");
const applyReparentBtn = document.getElementById("apply-reparent");
const importanceViewSelect = document.getElementById("importance-view") as HTMLSelectElement;
const zoomOutBtn = document.getElementById("zoom-out");
const zoomResetBtn = document.getElementById("zoom-reset");
const zoomInBtn = document.getElementById("zoom-in");
const downloadBtn = document.getElementById("download-btn");
const modeMetaEl = document.getElementById("mode-meta") as HTMLElement;
const scopeMetaEl = document.getElementById("scope-meta") as HTMLElement;
const scopeSummaryEl = document.getElementById("scope-summary") as HTMLElement;
const metaEl = document.getElementById("meta") as HTMLElement;
const statusEl = document.getElementById("status") as HTMLElement;
const visualCheckEl = document.getElementById("visual-check");
const board = document.getElementById("board") as HTMLElement;
const canvas = document.getElementById("canvas") as unknown as SVGSVGElement;
const linearTextEl = document.getElementById("linear-text") as HTMLTextAreaElement;
const linearMetaEl = document.getElementById("linear-meta") as HTMLElement;
const linearApplyBtn = document.getElementById("linear-apply") as HTMLButtonElement;
const linearResetBtn = document.getElementById("linear-reset") as HTMLButtonElement;
const cloudSyncBadgeEl = document.getElementById("cloud-sync-badge") as HTMLElement;
const cloudPullBtn = document.getElementById("cloud-pull") as HTMLButtonElement;
const cloudPushBtn = document.getElementById("cloud-push") as HTMLButtonElement;
const cloudUseLocalBtn = document.getElementById("cloud-use-local") as HTMLButtonElement;
const cloudUseCloudBtn = document.getElementById("cloud-use-cloud") as HTMLButtonElement;
const LOCAL_DOC_ID = "rapid-main";
const CLOUD_DOC_ID = "rapid-main";
const AUTOSAVE_DELAY_MS = 700;
const MAX_UNDO_STEPS = 100;

interface UndoSnapshot {
  state: AppState;
  selectedNodeId: string;
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
let inlineEditor: { nodeId: string; input: HTMLInputElement; mode: "node-text" | "alias-label" | "target-text" } | null = null;
let contentWidth = 1600;
let contentHeight = 900;
let lastLayout: LayoutResult | null = null;
let visualCheckRunId = 0;
let undoStack: UndoSnapshot[] = [];
let redoStack: UndoSnapshot[] = [];
let linearDirty = false;
let linearLineMap: LinearLineMap[] = [];
let suppressLinearSelectionSync = false;
let importanceViewMode: ImportanceViewMode = "all";
let importanceVisibleNodeIds: Set<string> | null = null;
let cloudSyncEnabled = false;
let cloudSyncExists = false;
let cloudSavedAt: string | null = null;
let cloudConflictPending = false;
const DRAG_CENTER_BAND_HALF = 20;
const DRAG_EDGE_BAND = 14;
const DRAG_REORDER_TAIL = 28;
const DRAG_REORDER_PARENT_LANE_PAD = 96;
let viewState: ViewState = {
  selectedNodeId: "",
  currentScopeId: "",
  scopeHistory: [],
  currentScopeRootId: "",
  thinkingMode: "rapid",
  zoom: 1,
  cameraX: VIEWER_TUNING.pan.initialCameraX,
  cameraY: VIEWER_TUNING.pan.initialCameraY,
  panState: null,
  reparentSourceId: "",
  dragState: null,
  collapsedIds: new Set<string>(),
};

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

function nowIso(): string {
  return new Date().toISOString();
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

function textWidth(str: string, fontSize: number): number {
  return Math.max(80, String(str || "").length * fontSize * 0.56);
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
  viewState.selectedNodeId = node.id;
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
  viewState.selectedNodeId = scopeRoot.parentId && doc.state.nodes[scopeRoot.parentId] ? scopeRoot.parentId : nextScopeId;
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
  if (isFolderNode(node)) {
    setStatus("Selected node is already a folder scope.");
    return false;
  }
  pushUndoSnapshot();
  node.nodeType = "folder";
  touchDocument();
  setStatus(`Marked as folder scope: ${uiLabel(node)}`);
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
  viewState.selectedNodeId = aliasId;
  touchDocument();
  setStatus(`Alias added in current scope for ${uiLabel(target)}.`);
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
  viewState.selectedNodeId = target.id;
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
  });
  if (redoStack.length > MAX_UNDO_STEPS) {
    redoStack.shift();
  }

  const snapshot = undoStack.pop()!;
  doc.state = snapshot.state;
  viewState.selectedNodeId = doc.state.nodes[snapshot.selectedNodeId] ? snapshot.selectedNodeId : doc.state.rootId;
  viewState.reparentSourceId = "";
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
  });
  if (undoStack.length > MAX_UNDO_STEPS) {
    undoStack.shift();
  }

  const snapshot = redoStack.pop()!;
  doc.state = snapshot.state;
  viewState.selectedNodeId = doc.state.nodes[snapshot.selectedNodeId] ? snapshot.selectedNodeId : doc.state.rootId;
  viewState.reparentSourceId = "";
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

function applyZoom(): void {
  canvas.style.width = `${contentWidth}px`;
  canvas.style.height = `${contentHeight}px`;
  canvas.style.transform = `translate(${viewState.cameraX}px, ${viewState.cameraY}px) scale(${viewState.zoom})`;
  syncInlineEditorPosition();
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
  return (node.children || []).filter((childId) => isNodeInScope(childId));
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
  let cursor = 0;

  function walk(nodeId: string, depth: number): void {
    const node = doc!.state.nodes[nodeId];
    if (!node) {
      return;
    }

    const line = `${"  ".repeat(depth)}${String(node.text || "").trim() || "(empty)"}`;
    const lineIndex = lines.length;
    lines.push(line);
    const startOffset = cursor;
    const endOffset = startOffset + line.length;
    map.push({ nodeId, lineIndex, startOffset, endOffset });
    cursor = endOffset + 1;

    scopeChildren(nodeId).forEach((childId) => walk(childId, depth + 1));
  }

  walk(scopeRootId, 0);
  return {
    text: lines.join("\n"),
    map,
  };
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
  if (!linearTextEl || !linearMetaEl) {
    return;
  }
  if (!doc) {
    linearTextEl.value = "";
    linearMetaEl.textContent = "No scope loaded";
    linearApplyBtn.disabled = true;
    linearResetBtn.disabled = true;
    return;
  }

  const linear = buildLinearFromScope();
  linearLineMap = linear.map;

  if (!linearDirty) {
    linearTextEl.value = linear.text;
  }

  const scopeRootId = normalizedCurrentScopeId();
  const scopeLabel = doc.state.nodes[scopeRootId]?.text || scopeRootId;
  const dirtyLabel = linearDirty ? "dirty" : "synced";
  linearMetaEl.textContent = `scope: ${scopeLabel} | importance: ${importanceViewMode} | lines: ${linearLineMap.length} | ${dirtyLabel}`;
  linearApplyBtn.disabled = !linearDirty;
  linearResetBtn.disabled = !linearDirty;

  if (!linearDirty) {
    syncLinearCaretToSelectedNode();
  }
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
  let cursor = 0;

  function walk(nodeId: string, depth: number): void {
    const node = doc!.state.nodes[nodeId];
    if (!node) {
      return;
    }

    const line = `${"  ".repeat(depth)}${String(node.text || "").trim() || "(empty)"}`;
    const lineIndex = lines.length;
    lines.push(line);
    const startOffset = cursor;
    const endOffset = startOffset + line.length;
    map.push({ nodeId, lineIndex, startOffset, endOffset });
    cursor = endOffset + 1;

    scopeChildren(nodeId).forEach((childId) => walk(childId, depth + 1));
  }

  walk(scopeRootId, 0);
  return {
    text: lines.join("\n"),
    map,
  };
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
  if (!linearTextEl || !linearMetaEl) {
    return;
  }
  if (!doc) {
    linearTextEl.value = "";
    linearMetaEl.textContent = "No scope loaded";
    linearApplyBtn.disabled = true;
    linearResetBtn.disabled = true;
    return;
  }

  const linear = buildLinearFromScope();
  linearLineMap = linear.map;

  if (!linearDirty) {
    linearTextEl.value = linear.text;
  }

  const scopeRootId = normalizedCurrentScopeId();
  const scopeLabel = doc.state.nodes[scopeRootId]?.text || scopeRootId;
  const dirtyLabel = linearDirty ? "dirty" : "synced";
  linearMetaEl.textContent = `scope: ${scopeLabel} | importance: ${importanceViewMode} | lines: ${linearLineMap.length} | ${dirtyLabel}`;
  linearApplyBtn.disabled = !linearDirty;
  linearResetBtn.disabled = !linearDirty;

  if (!linearDirty) {
    syncLinearCaretToSelectedNode();
  }
}

function parseLinearText(text: string): LinearNodeDraft {
  const sourceLines = String(text || "").replaceAll("\r", "").split("\n");
  const lines = sourceLines
    .map((raw, index) => ({ raw, index: index + 1 }))
    .filter((line) => line.raw.trim().length > 0);

  if (lines.length === 0) {
    throw new Error("リニアテキストが空です。");
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
    throw new Error("リニアテキストのルート行がありません。");
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
    setStatus("リニアテキストを現在スコープへ適用しました。");
    board.focus();
  } catch (err) {
    setStatus(`リニアテキスト適用に失敗: ${(err as Error).message}`, true);
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
      metrics[nodeId] = {
        w: Math.max(280, textWidth(node.text || "", VIEWER_TUNING.typography.rootFont) + 120),
        h: VIEWER_TUNING.layout.rootHeight,
      };
    } else {
      metrics[nodeId] = {
        w: textWidth(node.text || "", VIEWER_TUNING.typography.nodeFont) + 20,
        h: 56,
      };
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
      subtreeHeightCache[nodeId] = VIEWER_TUNING.layout.leafHeight;
      return VIEWER_TUNING.layout.leafHeight;
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

  function place(nodeId: string, topY: number): number {
    const node = state.nodes[nodeId];
    if (!node) {
      return VIEWER_TUNING.layout.leafHeight;
    }

    const depth = depthOf[nodeId] ?? 0;
    const h = subtreeHeight(nodeId);
    const centerY = topY + h / 2;

    pos[nodeId] = {
      x: xByDepth[depth]!,
      y: centerY,
      depth,
      w: metrics[nodeId]!.w,
      h: metrics[nodeId]!.h,
    };
    order.push(nodeId);

    let placeCursorY = topY;
    visibleChildren(node).forEach((childId, i, arr) => {
      const childH = place(childId, placeCursorY);
      placeCursorY += childH;
      if (i < arr.length - 1) {
        placeCursorY += VIEWER_TUNING.layout.siblingGap;
      }
    });

    return h;
  }

  const totalHeight = place(displayRootId, VIEWER_TUNING.layout.topPad);
  return {
    pos,
    order,
    totalHeight,
    totalWidth: cursorX + VIEWER_TUNING.layout.canvasRightPad,
  };
}

function render(): void {
  if (!doc) {
    syncThinkingModeUi();
    updateScopeMeta();
    updateScopeSummary();
    metaEl.textContent = "No data loaded";
    (canvas as Element).innerHTML = "";
    renderLinearPanel();
    return;
  }

  rebuildImportanceVisibility();
  if (!isNodeInScope(viewState.selectedNodeId) || !isNodeVisibleByImportance(viewState.selectedNodeId)) {
    viewState.selectedNodeId = normalizedCurrentScopeId();
  }

  const state = doc.state;
  if (!viewState.currentScopeRootId || !state.nodes[viewState.currentScopeRootId]) {
    viewState.currentScopeRootId = state.rootId;
  }
  const layout = buildLayout(state);
  lastLayout = layout;
  visibleOrder = layout.order;
  const displayRootId = currentScopeRootId();

  const pos = layout.pos;
  let maxX = Math.max(VIEWER_TUNING.layout.minCanvasWidth, layout.totalWidth);
  let maxY = Math.max(
    VIEWER_TUNING.layout.minCanvasHeight,
    layout.totalHeight + VIEWER_TUNING.layout.topPad + VIEWER_TUNING.layout.canvasBottomPad
  );
  let edges = "";
  let overlays = "";
  let nodes = "";

  function drawNode(nodeId: string): void {
    const node = state.nodes[nodeId];
    const p = pos[nodeId];
    if (!node || !p) {
      return;
    }

    maxX = Math.max(maxX, p.x + p.w + VIEWER_TUNING.layout.nodeRightPad);
    maxY = Math.max(maxY, p.y + p.h + VIEWER_TUNING.layout.nodeBottomPad);

    const children = visibleChildren(node);
    children.forEach((childId, i) => {
      const child = pos[childId];
      if (!child) {
        return;
      }

      const stroke =
        VIEWER_TUNING.palette.edgeColors[(p.depth + i) % VIEWER_TUNING.palette.edgeColors.length];
      const startX = p.x + p.w + VIEWER_TUNING.layout.edgeStartPad;
      const startY = p.y;
      const endX = child.x - VIEWER_TUNING.layout.edgeEndPad;
      const endY = child.y;
      const curve = Math.max(48, (endX - startX) * 0.45);
      const c1x = startX + curve;
      const c1y = startY;
      const c2x = endX - curve;
      const c2y = endY;
      edges += `<path class="edge" stroke="${stroke}" d="M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}" />`;
    });

    const classNames = ["node-hit"];
    if (nodeId === viewState.selectedNodeId) {
      classNames.push("selected");
    }
    if (isAliasNode(node)) {
      classNames.push("alias");
      classNames.push(isBrokenAlias(node) ? "alias-broken" : (aliasAccess(node) === "write" ? "alias-write" : "alias-read"));
    }
    if (viewState.dragState?.proposal?.kind === "reparent" && nodeId === viewState.dragState.proposal.parentId) {
      classNames.push("drop-target");
    }
    if (viewState.dragState && nodeId === viewState.dragState.sourceNodeId) {
      classNames.push("drag-source");
    }
    const hitX = nodeId === displayRootId ? p.x : p.x - 8;
    const hitY = p.y - VIEWER_TUNING.layout.nodeHitHeight / 2;
    const hitW = nodeId === displayRootId ? p.w : p.w + 36;
    nodes += `<rect class="${classNames.join(" ")}" data-node-id="${nodeId}" x="${hitX}" y="${hitY}" width="${hitW}" height="${VIEWER_TUNING.layout.nodeHitHeight}" rx="12" />`;

    if (nodeId === displayRootId) {
      const label = escapeXml(uiLabel(node) || "(empty)");
      const w = p.w;
      const h = p.h;
      const rx = 60;
      const x = p.x;
      const y = p.y - h / 2;
      nodes += `<rect class="root-box" data-node-id="${nodeId}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" />`;
      nodes += `<text class="label-root" data-node-id="${nodeId}" x="${x + w / 2}" y="${p.y}" text-anchor="middle" dominant-baseline="middle">${label}</text>`;
    } else {
      const label = escapeXml(uiLabel(node) || "(empty)");
      const labelClasses = ["label-node"];
      if (nodeId === viewState.selectedNodeId) {
        labelClasses.push("selected");
      }
      if (isAliasNode(node)) {
        labelClasses.push("alias-label");
        labelClasses.push(isBrokenAlias(node) ? "alias-broken-label" : (aliasAccess(node) === "write" ? "alias-write-label" : "alias-read-label"));
      }
      nodes += `<text class="${labelClasses.join(" ")}" data-node-id="${nodeId}" x="${p.x}" y="${p.y}" text-anchor="start" dominant-baseline="middle">${label}</text>`;
      const badge = nodeBadge(node);
      if (badge) {
        nodes += `<text class="alias-badge alias-badge-${badge}" x="${p.x + p.w + 18}" y="${p.y}" dominant-baseline="middle">${escapeXml(badge)}</text>`;
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
  (canvas as Element).innerHTML = `${edges}${overlays}${nodes}`;
  applyZoom();

  const version = doc.version ?? "n/a";
  const savedAt = doc.savedAt ?? "n/a";
  const nodeCount = Object.keys(state.nodes).length;
  const selected = state.nodes[viewState.selectedNodeId];
  const moveNode = state.nodes[viewState.reparentSourceId];
  const dragProposal = viewState.dragState?.proposal;
  let dropLabel = "none";
  if (dragProposal?.kind === "reparent") {
    dropLabel = `child of ${state.nodes[dragProposal.parentId]?.text ?? dragProposal.parentId}`;
  } else if (dragProposal?.kind === "reorder") {
    const parentText = state.nodes[dragProposal.parentId]?.text ?? dragProposal.parentId;
    dropLabel = `reorder in ${parentText} @ ${dragProposal.index}`;
  }
  syncThinkingModeUi();
  metaEl.textContent = `version: ${version} | savedAt: ${savedAt} | nodes: ${nodeCount} | scope: ${normalizedCurrentScopeId()} | importance: ${importanceViewMode} | selected: ${selected ? uiLabel(selected) : "n/a"} | move-node: ${moveNode ? uiLabel(moveNode) : "none"} | drop-target: ${dropLabel}`;
  updateScopeMeta();
  updateScopeSummary();
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
  return {
    left,
    right: left + width,
    top: p.y - VIEWER_TUNING.layout.nodeHitHeight / 2,
    bottom: p.y + VIEWER_TUNING.layout.nodeHitHeight / 2,
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
          top: p.y - VIEWER_TUNING.layout.leafHeight / 2,
          bottom: p.y + VIEWER_TUNING.layout.leafHeight / 2,
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

    const parentBandBottom = parentPos.y + DRAG_CENTER_BAND_HALF;
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
        const tailBottom = current.bottom + DRAG_REORDER_TAIL;
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
  const targetNodeId = findNodeAtCanvasPoint(point.x, point.y);
  if (targetNodeId) {
    const targetPos = lastLayout?.pos[targetNodeId];
    const targetNode = doc?.state.nodes[targetNodeId];
    if (targetPos && targetNode?.parentId) {
      const targetIndex = getVisibleChildrenForDrop(targetNode.parentId, sourceId).indexOf(targetNodeId);
      const topEdge = targetPos.y - VIEWER_TUNING.layout.nodeHitHeight / 2 + DRAG_EDGE_BAND;
      const bottomEdge = targetPos.y + VIEWER_TUNING.layout.nodeHitHeight / 2 - DRAG_EDGE_BAND;
      if (point.y < topEdge && targetIndex >= 0 && canDropUnderParent(sourceId, targetNode.parentId)) {
        return {
          kind: "reorder",
          parentId: targetNode.parentId,
          index: targetIndex,
          lineY: targetPos.y - VIEWER_TUNING.layout.nodeHitHeight / 2,
        };
      }
      if (point.y > bottomEdge && targetIndex >= 0 && canDropUnderParent(sourceId, targetNode.parentId)) {
        return {
          kind: "reorder",
          parentId: targetNode.parentId,
          index: targetIndex + 1,
          lineY: targetPos.y + VIEWER_TUNING.layout.nodeHitHeight / 2,
        };
      }
    }

    if (canDropUnderParent(sourceId, targetNodeId)) {
      return {
        kind: "reparent",
        parentId: targetNodeId,
      };
    }
  }

  return proposeReorderDrop(sourceId, point.x, point.y);
}

function selectNode(nodeId: string): void {
  getNode(nodeId);
  if (!isNodeInScope(nodeId) || !isNodeVisibleByImportance(nodeId)) {
    return;
  }
  viewState.selectedNodeId = nodeId;
  render();
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
  viewState.reparentSourceId = "";
  if (!isNodeInScope(viewState.selectedNodeId)) {
    viewState.selectedNodeId = scopeId;
  }
  render();
  setStatus(`Entered scope: ${getNode(scopeId).text}`);
}

function ExitScopeCommand(): void {
  if (!doc || viewState.scopeHistory.length === 0) {
    return;
  }
  const previousScopeId = viewState.scopeHistory.pop()!;
  viewState.currentScopeId = doc.state.nodes[previousScopeId] ? previousScopeId : doc.state.rootId;
  viewState.reparentSourceId = "";
  if (!isNodeInScope(viewState.selectedNodeId)) {
    viewState.selectedNodeId = viewState.currentScopeId;
  }
  render();
  setStatus(`Exited scope: ${getNode(viewState.currentScopeId).text}`);
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
  viewState.selectedNodeId = id;
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
  viewState.selectedNodeId = id;
  touchDocument();
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
  node.text = next;
  syncAliasDisplayForTarget(node.id);
  touchDocument();
  return true;
}

function stopInlineEdit(commit: boolean): void {
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

  board.focus();
}

function startInlineEdit(nodeId: string): void {
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
  const input = document.createElement("input");
  input.type = "text";
  input.value = mode === "target-text" ? (resolveAliasTarget(node)?.text || node.text || "") : uiLabel(node);
  input.className = "inline-node-editor";
  input.setAttribute("aria-label", mode === "target-text" ? "Edit target node text" : "Edit node label");
  board.appendChild(input);

  inlineEditor = { nodeId, input, mode };
  syncInlineEditorPosition();
  input.focus();
  input.select();

  input.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      stopInlineEdit(true);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      stopInlineEdit(false);
    }
  });

  input.addEventListener("blur", () => {
    stopInlineEdit(true);
  });
}

function deleteSelected(): void {
  const node = getNode(viewState.selectedNodeId);
  if (node.parentId === null) {
    setStatus("Root node cannot be deleted.", true);
    return;
  }
  pushUndoSnapshot();
  const parent = getNode(node.parentId);
  parent.children = parent.children.filter((id) => id !== node.id);
  const stack: string[] = [node.id];
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
    delete doc!.state.nodes[currentId];
  }
  if (viewState.reparentSourceId === node.id) {
    viewState.reparentSourceId = "";
  }
  viewState.selectedNodeId = parent.id;
  touchDocument();
}

function toggleCollapse(): void {
  const nodeId = viewState.selectedNodeId;
  const node = getNode(nodeId);
  if ((node.children || []).length === 0) {
    return;
  }
  if (viewState.collapsedIds.has(nodeId)) {
    viewState.collapsedIds.delete(nodeId);
    node.collapsed = false;
  } else {
    viewState.collapsedIds.add(nodeId);
    node.collapsed = true;
  }
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
    render();
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
    render();
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

function scheduleAutosave(): void {
  if (!doc) {
    return;
  }
  if (autosaveTimer !== null) {
    clearTimeout(autosaveTimer);
  }
  autosaveTimer = setTimeout(() => {
    void saveDocToLocalDb(false);
  }, AUTOSAVE_DELAY_MS);
}

function touchDocument(): void {
  if (!doc) {
    return;
  }
  doc.savedAt = nowIso();
  render();
  scheduleAutosave();
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
  await fetchCloudSyncStatus();

  if (cloudSyncEnabled && cloudSyncExists) {
    const loadedFromCloud = await pullDocFromCloud(false);
    if (loadedFromCloud) {
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

function selectVertical(direction: -1 | 1): void {
  if (!doc || !lastLayout) {
    selectRelative(direction);
    return;
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
      selectNode(siblings[nextSiblingIndex]!);
      return;
    }
  }

  const currentPos = layout.pos[currentId];
  if (!currentPos) {
    selectRelative(direction);
    return;
  }

  const sameDepth = visibleOrder
    .filter((id) => id !== currentId)
    .filter((id) => layout.pos[id]?.depth === currentPos.depth)
    .sort((a, b) => layout.pos[a]!.y - layout.pos[b]!.y);

  const target = direction < 0
    ? [...sameDepth].reverse().find((id) => layout.pos[id]!.y < currentPos.y)
    : sameDepth.find((id) => layout.pos[id]!.y > currentPos.y);

  if (target) {
    selectNode(target);
    return;
  }

  selectRelative(direction);
}

function loadPayload(payload: unknown): void {
  try {
    doc = ensureDocShape(payload);
    undoStack = [];
    redoStack = [];
    linearDirty = false;
    viewState.currentScopeId = doc.state.rootId;
    viewState.scopeHistory = [];
    viewState.selectedNodeId = doc.state.rootId;
    viewState.currentScopeRootId = doc.state.rootId;
    viewState.thinkingMode = "rapid";
    viewState.reparentSourceId = "";
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

function markReparentSource(): void {
  if (!viewState.selectedNodeId) {
    return;
  }
  viewState.reparentSourceId = viewState.selectedNodeId;
  setStatus(`Marked move node: ${getNode(viewState.reparentSourceId).text}`);
  render();
}

function applyReparent(): void {
  const sourceId = viewState.reparentSourceId;
  const targetParentId = viewState.selectedNodeId;
  if (!sourceId) {
    setStatus("No move node marked.", true);
    return;
  }
  if (sourceId === targetParentId) {
    setStatus("Cannot move a node under itself.", true);
    return;
  }
  const sourceNode = getNode(sourceId);
  if (sourceNode.parentId === null) {
    setStatus("Root node cannot be moved.", true);
    return;
  }
  if (isDescendant(targetParentId, sourceId)) {
    setStatus("Cannot move a node under its descendant.", true);
    return;
  }

  applyMoveByParentAndIndex(sourceId, targetParentId, getNode(targetParentId).children.length, true);
}

function canReparent(sourceId: string | null | undefined, targetParentId: string | null | undefined): boolean {
  return canDropUnderParent(sourceId, targetParentId);
}

function applyMoveByParentAndIndex(sourceId: string, targetParentId: string, targetIndex: number, expandParent: boolean): boolean {
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

  pushUndoSnapshot();
  oldParent.children = oldParent.children.filter((id) => id !== sourceId);
  const boundedIndex = Math.max(0, Math.min(normalizedIndex, newParent.children.length));
  newParent.children.splice(boundedIndex, 0, sourceId);
  if (expandParent) {
    viewState.collapsedIds.delete(targetParentId);
    newParent.collapsed = false;
  }
  sourceNode.parentId = targetParentId;
  viewState.reparentSourceId = "";
  touchDocument();
  if (oldParent.id === newParent.id) {
    setStatus(`Reordered "${sourceNode.text}" in "${newParent.text}".`);
  } else {
    setStatus(`Moved "${sourceNode.text}" under "${newParent.text}".`);
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

loadAirplaneBtn?.addEventListener("click", async () => {
  try {
    const response = await fetch("./data/airplane-parts-demo.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    loadPayload(payload);
    setStatus("Airplane demo loaded.");
  } catch (err) {
    setStatus(`Airplane demo load failed (${(err as Error).message}).`, true);
  }
});

loadAircraftMmBtn?.addEventListener("click", async () => {
  try {
    await loadAircraftMmDemo();
  } catch (err) {
    setStatus(`aircraft.mm load failed (${(err as Error).message}).`, true);
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

linearTextEl?.addEventListener("input", () => {
  linearDirty = true;
  renderLinearPanel();
});

linearTextEl?.addEventListener("click", () => {
  if (!doc || linearDirty || suppressLinearSelectionSync) {
    return;
  }
  const lineIndex = linearOffsetToLineIndex(linearTextEl.value, linearTextEl.selectionStart || 0);
  const entry = linearLineMap.find((line) => line.lineIndex === lineIndex);
  if (!entry) {
    return;
  }
  selectNode(entry.nodeId);
});

linearTextEl?.addEventListener("keyup", () => {
  if (!doc || linearDirty || suppressLinearSelectionSync) {
    return;
  }
  const lineIndex = linearOffsetToLineIndex(linearTextEl.value, linearTextEl.selectionStart || 0);
  const entry = linearLineMap.find((line) => line.lineIndex === lineIndex);
  if (!entry) {
    return;
  }
  selectNode(entry.nodeId);
});

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

importanceViewSelect?.addEventListener("change", () => {
  const nextMode = importanceViewSelect.value as ImportanceViewMode;
  importanceViewMode = nextMode;
  linearDirty = false;
  render();
  setStatus(`Importance view: ${nextMode}`);
});

addChildBtn?.addEventListener("click", () => {
  if (!doc) return;
  addChild();
});

addSiblingBtn?.addEventListener("click", () => {
  if (!doc) return;
  addSibling();
});

makeFolderBtn?.addEventListener("click", () => {
  if (!doc) return;
  makeSelectedFolder();
});

enterScopeBtn?.addEventListener("click", () => {
  if (!doc) return;
  enterScope(viewState.selectedNodeId);
});

exitScopeBtn?.addEventListener("click", () => {
  if (!doc) return;
  exitScope();
});

addAliasBtn?.addEventListener("click", () => {
  if (!doc) return;
  addAliasInCurrentScope();
});

jumpTargetBtn?.addEventListener("click", () => {
  if (!doc) return;
  jumpToAliasTarget();
});

toggleCollapseBtn?.addEventListener("click", () => {
  if (!doc) return;
  toggleCollapse();
});

deleteNodeBtn?.addEventListener("click", () => {
  if (!doc) return;
  deleteSelected();
});

markReparentBtn?.addEventListener("click", () => {
  if (!doc) return;
  markReparentSource();
});

applyReparentBtn?.addEventListener("click", () => {
  if (!doc) return;
  applyReparent();
});

downloadBtn?.addEventListener("click", () => {
  if (!doc) return;
  downloadJson();
});

zoomOutBtn?.addEventListener("click", () => {
  setZoom(viewState.zoom / VIEWER_TUNING.zoom.buttonFactor);
});

zoomResetBtn?.addEventListener("click", () => {
  setZoom(1);
});

zoomInBtn?.addEventListener("click", () => {
  setZoom(viewState.zoom * VIEWER_TUNING.zoom.buttonFactor);
});

fitAllBtn?.addEventListener("click", () => {
  fitDocument();
});

focusSelectedBtn?.addEventListener("click", () => {
  if (!doc || !viewState.selectedNodeId) {
    return;
  }
  centerOnNode(viewState.selectedNodeId, Math.max(1, viewState.zoom));
});

canvas.addEventListener("pointerdown", (event: PointerEvent) => {
  const collapseNodeId = (event.target as Element | null)?.getAttribute("data-collapse-node-id");
  if (collapseNodeId && event.button === 0) {
    event.preventDefault();
    selectNode(collapseNodeId);
    if (viewState.collapsedIds.has(collapseNodeId)) {
      viewState.collapsedIds.delete(collapseNodeId);
      render();
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
    proposal: null,
    startX: event.clientX,
    startY: event.clientY,
    dragged: false,
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
  viewState.dragState.proposal = proposeDrop(viewState.dragState.sourceNodeId, event.clientX, event.clientY);
  render();
});

function finishNodeDrag(event: PointerEvent): void {
  if (!viewState.dragState || event.pointerId !== viewState.dragState.pointerId) {
    return;
  }
  const { sourceNodeId, proposal, dragged } = viewState.dragState;
  viewState.dragState = null;
  canvas.releasePointerCapture(event.pointerId);

  if (!dragged) {
    selectNode(sourceNodeId);
    board.focus();
    return;
  }

  if (proposal) {
    const applied = proposal.kind === "reparent"
      ? applyMoveByParentAndIndex(sourceNodeId, proposal.parentId, getNode(proposal.parentId).children.length, false)
      : applyMoveByParentAndIndex(sourceNodeId, proposal.parentId, proposal.index, false);
    if (applied) {
      viewState.selectedNodeId = sourceNodeId;
      render();
      board.focus();
      return;
    }
  }

  setStatus("No valid drop target.", true);
  render();
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
      const node = getNode(nodeId);
      if ((node.children || []).length > 0) {
        EnterScopeCommand(nodeId);
        return;
      }
      startInlineEdit(nodeId);
});

board.addEventListener("wheel", (event: WheelEvent) => {
  if ((event.target as HTMLElement | null)?.closest(".linear-panel")) {
    return;
  }
  event.preventDefault();
  if (!event.ctrlKey && !event.metaKey) {
    viewState.cameraX -= event.deltaX * VIEWER_TUNING.pan.wheelFactor;
    viewState.cameraY -= event.deltaY * VIEWER_TUNING.pan.wheelFactor;
    applyZoom();
    return;
  }
  const intensity = Math.min(
    VIEWER_TUNING.zoom.wheelIntensityCap,
    Math.abs(event.deltaY) / VIEWER_TUNING.zoom.wheelIntensityDivisor
  );
  const factor = Math.exp(-Math.sign(event.deltaY) * intensity);
  setZoom(viewState.zoom * factor, event.clientX, event.clientY);
}, { passive: false });

board.addEventListener("pointerdown", (event: PointerEvent) => {
  if (event.button !== 0) {
    return;
  }
  if ((event.target as HTMLElement | null)?.closest(".linear-panel")) {
    return;
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
  if (!viewState.panState || event.pointerId !== viewState.panState.pointerId) {
    return;
  }
  viewState.cameraX = viewState.panState.cameraX + (event.clientX - viewState.panState.startX);
  viewState.cameraY = viewState.panState.cameraY + (event.clientY - viewState.panState.startY);
  applyZoom();
});

function endPan(event: PointerEvent): void {
  if (!viewState.panState || event.pointerId !== viewState.panState.pointerId) {
    return;
  }
  viewState.panState = null;
  board.classList.remove("panning");
  board.releasePointerCapture(event.pointerId);
}

board.addEventListener("pointerup", endPan);
board.addEventListener("pointercancel", endPan);

document.addEventListener("keydown", (event: KeyboardEvent) => {
  if (!doc) {
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

  if (event.key === "Tab") {
    event.preventDefault();
    addChild();
    return;
  }

  if (event.key === "Enter") {
    if (event.shiftKey) {
      event.preventDefault();
      startInlineEdit(viewState.selectedNodeId);
      return;
    }
    event.preventDefault();
    addSibling();
    return;
  }

  if (event.key === "F2") {
    event.preventDefault();
    startInlineEdit(viewState.selectedNodeId);
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
        if (event.key === "Backspace" && !inlineEditor && viewState.scopeHistory.length > 0) {
          event.preventDefault();
          ExitScopeCommand();
          return;
        }
    event.preventDefault();
    deleteSelected();
    return;
  }

      if (event.altKey && event.key === "Enter") {
        event.preventDefault();
        EnterScopeCommand();
        return;
      }

  if (event.key.toLowerCase() === "m") {
    event.preventDefault();
    markReparentSource();
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
    selectVertical(-1);
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    selectVertical(1);
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    selectParent();
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    selectChild();
  }
});

setVisualCheckStatus("Visual check idle");

updateCloudSyncUi();

void initializeDocument().then(() => {
  fitDocument() || applyZoom();
});

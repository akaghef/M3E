const fileInput = document.getElementById("file-input") as HTMLInputElement;
const loadDefaultBtn = document.getElementById("load-default");
const loadAirplaneBtn = document.getElementById("load-airplane");
const loadAircraftMmBtn = document.getElementById("load-aircraft-mm");
const runAircraftVisualCheckBtn = document.getElementById("run-aircraft-visual-check");
const stopVisualCheckBtn = document.getElementById("stop-visual-check");
const fitAllBtn = document.getElementById("fit-all");
const focusSelectedBtn = document.getElementById("focus-selected");
const addChildBtn = document.getElementById("add-child");
const addSiblingBtn = document.getElementById("add-sibling");
const toggleCollapseBtn = document.getElementById("toggle-collapse");
const deleteNodeBtn = document.getElementById("delete-node");
const markReparentBtn = document.getElementById("mark-reparent");
const applyReparentBtn = document.getElementById("apply-reparent");
const zoomOutBtn = document.getElementById("zoom-out");
const zoomResetBtn = document.getElementById("zoom-reset");
const zoomInBtn = document.getElementById("zoom-in");
const downloadBtn = document.getElementById("download-btn");
const applyEditBtn = document.getElementById("apply-edit");
const editInput = document.getElementById("edit-input") as HTMLInputElement;
const metaEl = document.getElementById("meta") as HTMLElement;
const statusEl = document.getElementById("status") as HTMLElement;
const visualCheckEl = document.getElementById("visual-check");
const board = document.getElementById("board") as HTMLElement;
const canvas = document.getElementById("canvas") as unknown as SVGSVGElement;
const LOCAL_DOC_ID = "rapid-main";
const AUTOSAVE_DELAY_MS = 700;

let doc: SavedDoc | null = null;
let visibleOrder: string[] = [];
let statusTimer: ReturnType<typeof setTimeout> | null = null;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
let contentWidth = 1600;
let contentHeight = 900;
let lastLayout: LayoutResult | null = null;
let visualCheckRunId = 0;
let viewState: ViewState = {
  selectedNodeId: "",
  zoom: 1,
  cameraX: VIEWER_TUNING.pan.initialCameraX,
  cameraY: VIEWER_TUNING.pan.initialCameraY,
  panState: null,
  reparentSourceId: "",
  dragState: null,
};

function nowIso(): string {
  return new Date().toISOString();
}

function createNodeRecord(id: string, parentId: string | null, text = "New Node"): TreeNode {
  return {
    id,
    parentId,
    children: [],
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
    node.text = node.text || "";
    node.collapsed = Boolean(node.collapsed);
    node.details = node.details || "";
    node.note = node.note || "";
    node.attributes = (node.attributes && typeof node.attributes === "object") ? node.attributes : {};
    node.link = node.link || "";
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
  if (!node || node.collapsed) {
    return [];
  }
  return node.children || [];
}

function buildLayout(state: AppState): LayoutResult {
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

  visit(state.rootId, 0);

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

  const totalHeight = place(state.rootId, VIEWER_TUNING.layout.topPad);
  return {
    pos,
    order,
    totalHeight,
    totalWidth: cursorX + VIEWER_TUNING.layout.canvasRightPad,
  };
}

function syncEditInput(): void {
  if (!doc) {
    editInput.value = "";
    return;
  }
  const selected = doc.state.nodes[viewState.selectedNodeId];
  editInput.value = selected ? selected.text || "" : "";
}

function render(): void {
  if (!doc) {
    metaEl.textContent = "No data loaded";
    (canvas as Element).innerHTML = "";
    return;
  }

  const state = doc.state;
  const layout = buildLayout(state);
  lastLayout = layout;
  visibleOrder = layout.order;

  const pos = layout.pos;
  let maxX = Math.max(VIEWER_TUNING.layout.minCanvasWidth, layout.totalWidth);
  let maxY = Math.max(
    VIEWER_TUNING.layout.minCanvasHeight,
    layout.totalHeight + VIEWER_TUNING.layout.topPad + VIEWER_TUNING.layout.canvasBottomPad
  );
  let edges = "";
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
    if (viewState.dragState && nodeId === viewState.dragState.targetNodeId) {
      classNames.push("drop-target");
    }
    if (viewState.dragState && nodeId === viewState.dragState.sourceNodeId) {
      classNames.push("drag-source");
    }
    const hitX = nodeId === state.rootId ? p.x : p.x - 8;
    const hitY = p.y - VIEWER_TUNING.layout.nodeHitHeight / 2;
    const hitW = nodeId === state.rootId ? p.w : p.w + 36;
    nodes += `<rect class="${classNames.join(" ")}" data-node-id="${nodeId}" x="${hitX}" y="${hitY}" width="${hitW}" height="${VIEWER_TUNING.layout.nodeHitHeight}" rx="12" />`;

    if (nodeId === state.rootId) {
      const label = escapeXml(node.text || "(empty)");
      const w = p.w;
      const h = p.h;
      const rx = 60;
      const x = p.x;
      const y = p.y - h / 2;
      nodes += `<rect class="root-box" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" />`;
      nodes += `<text class="label-root" x="${x + w / 2}" y="${p.y}" text-anchor="middle" dominant-baseline="middle">${label}</text>`;
    } else {
      const label = escapeXml(node.text || "(empty)");
      const selectedStyle = nodeId === viewState.selectedNodeId ? ' style="fill:#6f39ff;font-weight:600;"' : "";
      nodes += `<text class="label-node" x="${p.x}" y="${p.y}" text-anchor="start" dominant-baseline="middle"${selectedStyle}>${label}</text>`;
    }

    if (node.collapsed && (node.children || []).length > 0) {
      const indicatorX =
        nodeId === state.rootId
          ? p.x + p.w + VIEWER_TUNING.layout.rootIndicatorPad
          : p.x + p.w + VIEWER_TUNING.layout.nodeIndicatorPad;
      nodes += `<text class="collapsed-indicator" x="${indicatorX}" y="${p.y}" dominant-baseline="middle">+</text>`;
    }

    children.forEach((cid) => drawNode(cid));
  }

  drawNode(state.rootId);

  contentWidth = maxX;
  contentHeight = maxY;
  canvas.setAttribute("width", String(maxX));
  canvas.setAttribute("height", String(maxY));
  canvas.setAttribute("viewBox", `0 0 ${maxX} ${maxY}`);
  (canvas as Element).innerHTML = `${edges}${nodes}`;
  applyZoom();

  const version = doc.version ?? "n/a";
  const savedAt = doc.savedAt ?? "n/a";
  const nodeCount = Object.keys(state.nodes).length;
  const selected = state.nodes[viewState.selectedNodeId];
  const moveNode = state.nodes[viewState.reparentSourceId];
  const dragTargetId = viewState.dragState?.targetNodeId;
  const dragTarget = dragTargetId ? state.nodes[dragTargetId] : null;
  metaEl.textContent = `version: ${version} | savedAt: ${savedAt} | nodes: ${nodeCount} | selected: ${selected ? selected.text : "n/a"} | move-node: ${moveNode ? moveNode.text : "none"} | drop-target: ${dragTarget ? dragTarget.text : "none"}`;
  syncEditInput();
}

function selectNode(nodeId: string): void {
  getNode(nodeId);
  viewState.selectedNodeId = nodeId;
  render();
}

function addChild(): void {
  const parentId = viewState.selectedNodeId;
  const parent = getNode(parentId);
  const id = newId();
  doc!.state.nodes[id] = createNodeRecord(id, parentId, "New Node");
  parent.children.push(id);
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
  const currentIndex = parent.children.indexOf(node.id);
  const id = newId();
  doc!.state.nodes[id] = createNodeRecord(id, parent.id, "New Sibling");
  parent.children.splice(currentIndex + 1, 0, id);
  viewState.selectedNodeId = id;
  touchDocument();
  board.focus();
}

function applyEdit(): void {
  const node = getNode(viewState.selectedNodeId);
  const next = String(editInput.value || "").trim();
  if (next === "") {
    setStatus("Node text cannot be empty.", true);
    syncEditInput();
    return;
  }
  if (node.text === next) {
    return;
  }
  node.text = next;
  touchDocument();
}

function deleteSelected(): void {
  const node = getNode(viewState.selectedNodeId);
  if (node.parentId === null) {
    setStatus("Root node cannot be deleted.", true);
    return;
  }
  const parent = getNode(node.parentId);
  parent.children = parent.children.filter((id) => id !== node.id);
  const stack: string[] = [node.id];
  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const current = doc!.state.nodes[currentId];
    if (!current) {
      continue;
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
  const node = getNode(viewState.selectedNodeId);
  if ((node.children || []).length === 0) {
    return;
  }
  node.collapsed = !node.collapsed;
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

function loadPayload(payload: unknown): void {
  try {
    doc = ensureDocShape(payload);
    viewState.selectedNodeId = doc.state.rootId;
    viewState.reparentSourceId = "";
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
    { label: "Collapse Body branch", run: async () => { const nodeId = findNodeIdByText("Body"); selectNode(nodeId); if (!getNode(nodeId).collapsed) { toggleCollapse(); } centerOnNode(nodeId, 0.95); } },
    { label: "Expand Body branch", run: async () => { const nodeId = findNodeIdByText("Body"); selectNode(nodeId); if (getNode(nodeId).collapsed) { toggleCollapse(); } centerOnNode(nodeId, 0.95); } },
    { label: "Select Wing branch", run: async () => { const nodeId = findNodeIdByText("Wing"); selectNode(nodeId); centerOnNode(nodeId, 0.92); } },
    { label: "Collapse Wing branch", run: async () => { const nodeId = findNodeIdByText("Wing"); selectNode(nodeId); if (!getNode(nodeId).collapsed) { toggleCollapse(); } centerOnNode(nodeId, 0.92); } },
    { label: "Expand Wing branch", run: async () => { const nodeId = findNodeIdByText("Wing"); selectNode(nodeId); if (getNode(nodeId).collapsed) { toggleCollapse(); } centerOnNode(nodeId, 0.92); } },
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

  const oldParent = getNode(sourceNode.parentId);
  const newParent = getNode(targetParentId);
  oldParent.children = oldParent.children.filter((id) => id !== sourceId);
  newParent.children.push(sourceId);
  newParent.collapsed = false;
  sourceNode.parentId = targetParentId;
  viewState.reparentSourceId = "";
  touchDocument();
  setStatus(`Moved "${sourceNode.text}" under "${newParent.text}".`);
}

function canReparent(sourceId: string | null | undefined, targetParentId: string | null | undefined): boolean {
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

function applyReparentByIds(sourceId: string, targetParentId: string): boolean {
  if (!canReparent(sourceId, targetParentId)) {
    return false;
  }
  const sourceNode = getNode(sourceId);
  const oldParent = getNode(sourceNode.parentId!);
  const newParent = getNode(targetParentId);
  oldParent.children = oldParent.children.filter((id) => id !== sourceId);
  newParent.children.push(sourceId);
  newParent.collapsed = false;
  sourceNode.parentId = targetParentId;
  viewState.reparentSourceId = "";
  touchDocument();
  setStatus(`Moved "${sourceNode.text}" under "${newParent.text}".`);
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

addChildBtn?.addEventListener("click", () => {
  if (!doc) return;
  addChild();
});

addSiblingBtn?.addEventListener("click", () => {
  if (!doc) return;
  addSibling();
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

applyEditBtn?.addEventListener("click", () => {
  if (!doc) return;
  applyEdit();
});

editInput.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    event.preventDefault();
    if (doc) {
      applyEdit();
      board.focus();
    }
  }
  if (event.key === "Escape") {
    event.preventDefault();
    syncEditInput();
    board.focus();
  }
});

canvas.addEventListener("pointerdown", (event: PointerEvent) => {
  const nodeId = (event.target as Element | null)?.getAttribute("data-node-id") ??
    ((event.target as HTMLElement | null)?.dataset?.["nodeId"] ?? null);
  if (!doc || !nodeId || event.button !== 0) {
    return;
  }
  viewState.dragState = {
    pointerId: event.pointerId,
    sourceNodeId: nodeId,
    targetNodeId: null,
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
  const el = document.elementFromPoint(event.clientX, event.clientY);
  const targetNodeId = (el as HTMLElement | null)?.dataset?.["nodeId"] ?? null;
  viewState.dragState.targetNodeId = canReparent(viewState.dragState.sourceNodeId, targetNodeId) ? targetNodeId : null;
  render();
});

function finishNodeDrag(event: PointerEvent): void {
  if (!viewState.dragState || event.pointerId !== viewState.dragState.pointerId) {
    return;
  }
  const { sourceNodeId, targetNodeId, dragged } = viewState.dragState;
  viewState.dragState = null;
  canvas.releasePointerCapture(event.pointerId);

  if (!dragged) {
    selectNode(sourceNodeId);
    board.focus();
    return;
  }

  if (targetNodeId && applyReparentByIds(sourceNodeId, targetNodeId)) {
    viewState.selectedNodeId = sourceNodeId;
    render();
    board.focus();
    return;
  }

  setStatus("No valid drop target.", true);
  render();
  board.focus();
}

canvas.addEventListener("pointerup", finishNodeDrag);
canvas.addEventListener("pointercancel", finishNodeDrag);

board.addEventListener("wheel", (event: WheelEvent) => {
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

  const activeTag = document.activeElement ? document.activeElement.tagName : "";
  const editingInput = activeTag === "INPUT" && document.activeElement === editInput;

  if (editingInput) {
    if (event.key === "Escape") {
      syncEditInput();
      board.focus();
    }
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
      editInput.focus();
      editInput.select();
      return;
    }
    event.preventDefault();
    addSibling();
    return;
  }

  if (event.key === "F2") {
    event.preventDefault();
    editInput.focus();
    editInput.select();
    return;
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    deleteSelected();
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
    selectRelative(-1);
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    selectRelative(1);
  }
});

setVisualCheckStatus("Visual check idle");

void initializeDocument().then(() => {
  fitDocument() || applyZoom();
});

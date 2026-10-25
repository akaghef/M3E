import "../../browser/markdown_renderer";
import {
  clonePanelFixtureState,
  createViewerPanelFixture,
  type PanelFixture,
  type PanelFixtureFileEntry,
  type PanelFixtureFileTree,
  type PanelFixtureNode,
  type PanelFixtureState,
  type PanelSelectionKind,
} from "./viewer-panel-seam-lab-fixture";
import "./viewer-panel-seam-lab.css";

type PanelId = "meta-panel" | "entity-list-panel" | "markdown-preview-panel" | "local-fs-panel" | "conflict-panel" | "v4-panel";
type ConflictFixtureId = "same" | "changed" | "added";
type LocalFsFixtureId = PanelFixtureFileTree["id"];
type SelectionState = {
  kind: PanelSelectionKind;
  nodeId: string | null;
  nodeIds: Set<string>;
  linkId: string | null;
};

interface EntityTreeItem {
  id: string;
  label: string;
  nodeType: string;
  children: EntityTreeItem[];
}

interface FlatConflictNode {
  id: string;
  text: string;
  depth: number;
}

interface ConflictDiffResult {
  localOnly: Set<string>;
  remoteOnly: Set<string>;
  changed: Set<string>;
  addedCount: number;
  removedCount: number;
  changedCount: number;
}

interface MarkdownGlobals {
  renderMarkdownInto?: (target: HTMLElement, source: string) => Promise<void>;
}

const fixture: PanelFixture = createViewerPanelFixture();
let appState: PanelFixtureState = clonePanelFixtureState(fixture.localState);
let selection: SelectionState = {
  kind: "node",
  nodeId: "overview",
  nodeIds: new Set(["overview"]),
  linkId: null,
};
let currentScopeRootId = appState.rootId;
let conflictFixtureId: ConflictFixtureId = "changed";
let localFsFixtureId: LocalFsFixtureId = "workspace";
let localFsSelectedPath: string | null = null;
let localFsChildrenByPath = new Map<string, PanelFixtureFileEntry[]>();
let localFsExpandedPaths = new Set<string>([""]);
let v4Drafts = fixture.drafts.map((draft) => ({ ...draft }));
let lastStatus = "Loaded deterministic AppState fixture.";
let markdownRenderRun = 0;

const panelElements: Record<PanelId, HTMLElement> = {
  "meta-panel": document.querySelector<HTMLElement>(".meta-panel")!,
  "entity-list-panel": document.getElementById("entity-list-panel")!,
  "markdown-preview-panel": document.getElementById("markdown-preview-panel")!,
  "local-fs-panel": document.getElementById("local-fs-panel")!,
  "conflict-panel": document.getElementById("conflict-panel")!,
  "v4-panel": document.getElementById("v4-panel")!,
};
const panelToggleInputs = Array.from(document.querySelectorAll<HTMLInputElement>("[data-panel-toggle]"));
const selectionEl = document.getElementById("panel-lab-selection") as HTMLSelectElement;
const conflictFixtureEl = document.getElementById("panel-lab-conflict-state") as HTMLSelectElement;
const localFsFixtureEl = document.getElementById("panel-lab-files-state") as HTMLSelectElement;
const labStatusEl = document.querySelector<HTMLElement>("[data-testid='viewer-panel-lab-status']")!;
const selectionSummaryEl = document.getElementById("panel-lab-selection-summary")!;
const boardEl = document.getElementById("board")!;
const localFsRootInputEl = document.getElementById("local-fs-root-input") as HTMLInputElement;
const localFsStatusEl = document.getElementById("local-fs-status")!;
const localFsTreeEl = document.getElementById("local-fs-tree")!;
const localFsPreviewTitleEl = document.getElementById("local-fs-preview-title")!;
const localFsPreviewEl = document.getElementById("local-fs-preview")!;
const entityListTreeEl = document.getElementById("entity-list-tree")!;
const entityListSearchEl = document.getElementById("entity-list-search") as HTMLInputElement;
const entityScopeListEl = document.getElementById("entity-scope-list")!;
const conflictLocalTreeEl = document.getElementById("conflict-local-tree")!;
const conflictRemoteTreeEl = document.getElementById("conflict-remote-tree")!;
const conflictDiffSummaryEl = document.getElementById("conflict-diff-summary")!;
const markdownPreviewPanelEl = document.getElementById("markdown-preview-panel")!;
const markdownPreviewBodyEl = document.getElementById("markdown-preview-body")!;
const markdownPreviewTitleEl = markdownPreviewPanelEl.querySelector<HTMLElement>(".markdown-preview-title")!;
const v4PanelEl = document.getElementById("v4-panel")!;
const v4FlashStatusEl = document.getElementById("v4-flash-status")!;
const v4DraftListEl = document.getElementById("v4-draft-list")!;
const v4VaultStatusEl = document.getElementById("v4-vault-status")!;
const v4VaultPathEl = document.getElementById("v4-vault-path")!;
const v4ConflictStatusEl = document.getElementById("v4-conflict-status")!;
const v4GithubStatusEl = document.getElementById("v4-github-status")!;
const v4SelectedSourceEl = document.getElementById("v4-selected-source")!;
const v4SourceTextEl = document.getElementById("v4-source-text") as HTMLTextAreaElement;

function isFolderNode(node: PanelFixtureNode | undefined): boolean {
  return node?.nodeType === "folder";
}

function getNode(nodeId: string | null): PanelFixtureNode | null {
  return nodeId ? appState.nodes[nodeId] || null : null;
}

function uiLabel(node: PanelFixtureNode | undefined): string {
  if (!node) return "n/a";
  if (node.aliasLabel?.trim()) return node.aliasLabel;
  if (node.isBroken) return `${node.targetSnapshotLabel || node.text || "Untitled"} (deleted)`;
  if (node.nodeType === "alias" && node.targetNodeId) {
    return appState.nodes[node.targetNodeId]?.text || "Untitled";
  }
  return node.text || "Untitled";
}

function currentSelectedNode(): PanelFixtureNode | null {
  return selection.kind === "node" ? getNode(selection.nodeId) : null;
}

function panelIsVisible(panelId: PanelId): boolean {
  return !panelElements[panelId].hidden;
}

function setStatus(message: string): void {
  lastStatus = message;
  labStatusEl.textContent = message;
  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.textContent = message;
}

function scopePathIds(scopeId: string): string[] {
  const path: string[] = [];
  let cursor: string | null = scopeId;
  while (cursor) {
    path.unshift(cursor);
    if (cursor === appState.rootId) break;
    cursor = appState.nodes[cursor]?.parentId || null;
  }
  return path;
}

function countDescendants(nodeId: string): number {
  const node = appState.nodes[nodeId];
  if (!node) return 0;
  return node.children.reduce((count, childId) => count + 1 + countDescendants(childId), 0);
}

function scopeLabel(scopeId: string): string {
  return scopePathIds(scopeId)
    .map((nodeId) => nodeId === appState.rootId ? "root" : uiLabel(appState.nodes[nodeId]))
    .join(" / ");
}

function currentScopeSummary(): string {
  const scopeRoot = appState.nodes[currentScopeRootId];
  if (!scopeRoot) return "outside: n/a";
  const parentScope = scopeRoot.parentId
    ? scopePathIds(scopeRoot.parentId).filter((nodeId) => nodeId === appState.rootId || isFolderNode(appState.nodes[nodeId])).pop()
    : null;
  const parentLabel = parentScope ? (parentScope === appState.rootId ? "root" : uiLabel(appState.nodes[parentScope])) : "none";
  const childScopes = scopeRoot.children
    .map((id) => appState.nodes[id])
    .filter((node): node is PanelFixtureNode => Boolean(node && isFolderNode(node)))
    .map((node) => `${uiLabel(node)}(${countDescendants(node.id)})`);
  return `outside: parent ${parentLabel} | child scopes ${childScopes.length > 0 ? childScopes.join(", ") : "none"}`;
}

function selectionLabel(): string {
  if (selection.kind === "node") return `node / ${uiLabel(currentSelectedNode() || undefined)}`;
  if (selection.kind === "graph-link") {
    const link = selection.linkId ? appState.links[selection.linkId] : undefined;
    return `GraphLink / ${link?.label || link?.relationType || "n/a"}`;
  }
  if (selection.kind === "multiple") return `multiple / ${selection.nodeIds.size} nodes`;
  return "none";
}

function setNodeSelection(nodeId: string | null): void {
  if (!nodeId || !appState.nodes[nodeId]) {
    selection = { kind: "none", nodeId: null, nodeIds: new Set(), linkId: null };
  } else {
    selection = { kind: "node", nodeId, nodeIds: new Set([nodeId]), linkId: null };
  }
  selectionEl.value = nodeId ? `node:${nodeId}` : "none";
  renderAll();
}

function setSelection(value: string): void {
  if (value === "multiple") {
    selection = { kind: "multiple", nodeId: "node-a", nodeIds: new Set(["node-a", "node-b"]), linkId: null };
  } else if (value === "none") {
    selection = { kind: "none", nodeId: null, nodeIds: new Set(), linkId: null };
  } else if (value.startsWith("graph-link:")) {
    const linkId = value.slice("graph-link:".length);
    selection = { kind: "graph-link", nodeId: null, nodeIds: new Set(), linkId };
  } else if (value.startsWith("node:")) {
    const nodeId = value.slice("node:".length);
    if (appState.nodes[nodeId]) {
      selection = { kind: "node", nodeId, nodeIds: new Set([nodeId]), linkId: null };
    } else {
      selection = { kind: "none", nodeId: null, nodeIds: new Set(), linkId: null };
    }
  }
  selectionEl.value = value;
  renderAll();
}

function ensureNodeSelectionOption(nodeId: string): void {
  if (selectionEl.querySelector(`option[value="node:${nodeId}"]`)) return;
  const option = document.createElement("option");
  option.value = `node:${nodeId}`;
  option.textContent = `node — ${uiLabel(appState.nodes[nodeId])}`;
  selectionEl.appendChild(option);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlightText(text: string, query: string): string {
  const escaped = escapeHtml(text);
  if (!query) return escaped;
  const escapedQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return escaped.replace(new RegExp(`(${escapedQuery})`, "gi"), '<span class="entity-highlight">$1</span>');
}

function renderMetaPanel(): void {
  const selected = currentSelectedNode();
  const modeMetaEl = document.getElementById("mode-meta");
  const scopeMetaEl = document.getElementById("scope-meta");
  const scopeSummaryEl = document.getElementById("scope-summary");
  const metaEl = document.getElementById("meta");
  const visualCheckEl = document.getElementById("visual-check");
  if (modeMetaEl) modeMetaEl.textContent = "mode: Rapid";
  if (scopeMetaEl) scopeMetaEl.textContent = `scope: ${scopeLabel(currentScopeRootId)}`;
  if (scopeSummaryEl) scopeSummaryEl.textContent = currentScopeSummary();
  if (metaEl) {
    const linkCount = Object.keys(appState.links).length;
    metaEl.dataset.selectedNodeId = selected?.id || "";
    metaEl.dataset.selectedNodeLabel = selected ? uiLabel(selected) : "";
    metaEl.dataset.scopeId = currentScopeRootId;
    metaEl.dataset.mapId = fixture.mapId;
    metaEl.textContent = `workspace: ${fixture.workspaceLabel} (${fixture.workspaceId}) | map: ${fixture.mapLabel} (${fixture.mapId}) | slug: ${fixture.mapSlug} | cloud: ${fixture.mapId} | version: 1 | savedAt: ${fixture.savedAt} | nodes: ${Object.keys(appState.nodes).length} | links: ${linkCount} | annotations: ${Object.keys(appState.annotations).length} | scope: ${currentScopeRootId} | importance: all | selected: ${selected ? uiLabel(selected) : "n/a"} (${selection.nodeIds.size}) | link-source: none | move-node: none | drop-target: none`;
  }
  if (visualCheckEl) visualCheckEl.textContent = "Visual check idle";
}

function collectEntityTree(parentId: string): EntityTreeItem[] {
  const parent = appState.nodes[parentId];
  if (!parent) return [];
  return parent.children
    .map((childId) => appState.nodes[childId])
    .filter((child): child is PanelFixtureNode => Boolean(child))
    .map((child) => ({
      id: child.id,
      label: uiLabel(child),
      nodeType: child.nodeType,
      children: collectEntityTree(child.id),
    }));
}

function filterEntityTree(nodes: EntityTreeItem[], query: string): EntityTreeItem[] {
  if (!query) return nodes;
  const lowerQuery = query.toLowerCase();
  return nodes.reduce<EntityTreeItem[]>((result, item) => {
    const children = filterEntityTree(item.children, query);
    if (item.label.toLowerCase().includes(lowerQuery) || children.length > 0) {
      result.push({ ...item, children });
    }
    return result;
  }, []);
}

function appendScopeLockBadge(row: HTMLElement, scopeId: string): void {
  const lock = fixture.scopeLocks[scopeId];
  if (!lock) return;
  const badge = document.createElement("span");
  badge.className = "entity-scope-lock-badge lock-other";
  badge.textContent = `🔒 ${lock.displayName}`;
  badge.title = `Locked by ${lock.displayName} (priority ${lock.priority})`;
  row.appendChild(badge);
}

function applyPresenceBadges(): void {
  entityListTreeEl.querySelectorAll(".presence-badges").forEach((element) => element.remove());
  Object.entries(fixture.presence).forEach(([nodeId, users]) => {
    const row = entityListTreeEl.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`);
    if (!row) return;
    const badges = document.createElement("span");
    badges.className = "presence-badges";
    users.slice(0, 3).forEach((user) => {
      const badge = document.createElement("span");
      badge.className = "presence-badge";
      badge.style.backgroundColor = user.color;
      badge.title = user.userId;
      badges.appendChild(badge);
    });
    row.appendChild(badges);
  });
}

function applyChangeHighlights(): void {
  fixture.changedNodeIds.forEach((nodeId) => {
    entityListTreeEl.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`)?.classList.add("has-changes");
  });
}

function renderEntityTree(container: HTMLElement, nodes: EntityTreeItem[], query: string, forceExpand: boolean): void {
  container.innerHTML = "";
  nodes.forEach((item) => {
    const row = document.createElement("div");
    row.className = "entity-row";
    if (selection.nodeId === item.id && selection.kind === "node") row.classList.add("is-selected");
    if (selection.nodeIds.has(item.id)) row.classList.add("is-multi-selected");
    row.dataset.nodeId = item.id;

    const toggle = document.createElement("button");
    toggle.className = `entity-toggle${item.children.length > 0 ? "" : " no-children"}`;
    toggle.textContent = "▶";
    toggle.type = "button";

    const name = document.createElement("span");
    name.className = "entity-name";
    name.innerHTML = highlightText(item.label, query);
    row.append(toggle, name);

    if (item.nodeType === "folder") {
      const badge = document.createElement("span");
      badge.className = "entity-badge entity-badge-folder";
      badge.textContent = "folder";
      row.appendChild(badge);
      appendScopeLockBadge(row, item.id);
    } else if (item.nodeType === "alias") {
      const badge = document.createElement("span");
      badge.className = "entity-badge entity-badge-alias";
      badge.textContent = "alias";
      row.appendChild(badge);
    }
    container.appendChild(row);

    let childContainer: HTMLElement | null = null;
    if (item.children.length > 0) {
      childContainer = document.createElement("div");
      childContainer.className = "entity-children";
      childContainer.hidden = !forceExpand;
      renderEntityTree(childContainer, item.children, query, forceExpand);
      container.appendChild(childContainer);
      toggle.classList.toggle("expanded", forceExpand);
    }

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!childContainer) return;
      childContainer.hidden = !childContainer.hidden;
      toggle.classList.toggle("expanded", !childContainer.hidden);
    });
    row.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest(".entity-toggle")) return;
      setNodeSelection(item.id);
      setPanelVisible("entity-list-panel", false);
      setStatus(`Focused: ${item.label}`);
    });
  });
}

function collectFolderTree(parentId: string): Array<{ id: string; label: string; childCount: number; subFolders: ReturnType<typeof collectFolderTree> }> {
  const parent = appState.nodes[parentId];
  if (!parent) return [];
  return parent.children
    .map((childId) => appState.nodes[childId])
    .filter((child): child is PanelFixtureNode => Boolean(child && isFolderNode(child)))
    .map((child) => ({
      id: child.id,
      label: uiLabel(child),
      childCount: countDescendants(child.id),
      subFolders: collectFolderTree(child.id),
    }));
}

function renderEntityScopeItems(
  container: HTMLElement,
  folders: ReturnType<typeof collectFolderTree>,
  depth: number,
): void {
  folders.forEach((folder) => {
    const row = document.createElement("div");
    row.className = `entity-scope-row${currentScopeRootId === folder.id ? " is-current-scope" : ""}`;
    row.dataset.scopeId = folder.id;
    row.style.paddingLeft = `${8 + depth * 12}px`;
    const icon = document.createElement("span");
    icon.className = "entity-scope-icon";
    icon.textContent = "◇";
    const name = document.createElement("span");
    name.className = "entity-scope-name";
    name.textContent = folder.label;
    const count = document.createElement("span");
    count.className = "entity-scope-count";
    count.textContent = `${folder.childCount}`;
    row.append(icon, name, count);
    appendScopeLockBadge(row, folder.id);
    row.addEventListener("click", () => enterScope(folder.id));
    container.appendChild(row);
    renderEntityScopeItems(container, folder.subFolders, depth + 1);
  });
}

function renderEntityScopeList(): void {
  entityScopeListEl.innerHTML = "";
  const rootRow = document.createElement("div");
  rootRow.className = `entity-scope-row${currentScopeRootId === appState.rootId ? " is-current-scope" : ""}`;
  rootRow.dataset.scopeId = appState.rootId;
  const rootIcon = document.createElement("span");
  rootIcon.className = "entity-scope-icon";
  rootIcon.textContent = "◆";
  const rootName = document.createElement("span");
  rootName.className = "entity-scope-name";
  rootName.textContent = uiLabel(appState.nodes[appState.rootId]);
  rootRow.append(rootIcon, rootName);
  appendScopeLockBadge(rootRow, appState.rootId);
  rootRow.addEventListener("click", () => enterScope(appState.rootId));
  entityScopeListEl.appendChild(rootRow);
  renderEntityScopeItems(entityScopeListEl, collectFolderTree(appState.rootId), 1);
}

function renderEntityPanel(): void {
  const query = entityListSearchEl.value.trim();
  const tree = filterEntityTree(collectEntityTree(currentScopeRootId), query);
  renderEntityScopeList();
  renderEntityTree(entityListTreeEl, tree, query, Boolean(query));
  applyPresenceBadges();
  applyChangeHighlights();
}

function enterScope(scopeId: string): void {
  if (!appState.nodes[scopeId]) return;
  currentScopeRootId = scopeId;
  const firstChild = appState.nodes[scopeId]?.children[0] || null;
  if (firstChild) {
    selection = { kind: "node", nodeId: firstChild, nodeIds: new Set([firstChild]), linkId: null };
    selectionEl.value = `node:${firstChild}`;
  }
  renderAll();
  setStatus(`Entered scope: ${uiLabel(appState.nodes[scopeId])}`);
}

function resetLocalFsTree(): void {
  localFsSelectedPath = null;
  localFsExpandedPaths = new Set([""]);
  localFsChildrenByPath = new Map(Object.entries(fixture.fileTrees[localFsFixtureId].entriesByPath));
  localFsPreviewTitleEl.textContent = "Preview";
  localFsPreviewEl.textContent = "";
}

function localFsRootLabel(rootPath: string): string {
  return rootPath.replace(/[\\/]+$/g, "").split(/[\\/]/).filter(Boolean).pop() || "root";
}

function renderLocalFsEntries(parentPath: string, depth: number, container: HTMLElement): void {
  const entries = localFsChildrenByPath.get(parentPath) || [];
  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "local-fs-row";
    empty.style.setProperty("--local-fs-indent", `${10 + depth * 18}px`);
    empty.textContent = "Empty";
    container.appendChild(empty);
    return;
  }
  entries.forEach((entry) => renderLocalFsRow(entry, depth, container));
}

function readLocalFsFile(entry: PanelFixtureFileEntry): void {
  localFsSelectedPath = entry.relativePath;
  localFsPreviewTitleEl.textContent = entry.relativePath;
  localFsPreviewEl.textContent = fixture.fileTrees[localFsFixtureId].contents[entry.relativePath] || "";
  localFsStatusEl.textContent = `${fixture.fileTrees[localFsFixtureId].rootPath} (${entry.sizeBytes} bytes)`;
  renderLocalFsTree();
}

function toggleLocalFsDirectory(relativePath: string): void {
  if (localFsExpandedPaths.has(relativePath)) {
    localFsExpandedPaths.delete(relativePath);
  } else {
    localFsExpandedPaths.add(relativePath);
  }
  renderLocalFsTree();
}

function renderLocalFsRow(entry: PanelFixtureFileEntry, depth: number, container: HTMLElement): void {
  const isDirectory = entry.kind === "directory";
  const row = document.createElement("div");
  row.className = `local-fs-row${localFsSelectedPath === entry.relativePath ? " is-selected" : ""}`;
  row.style.setProperty("--local-fs-indent", `${10 + depth * 18}px`);
  row.dataset.path = entry.relativePath;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = `local-fs-toggle${!isDirectory || !entry.hasChildren ? " is-empty" : ""}`;
  toggle.textContent = localFsExpandedPaths.has(entry.relativePath) ? "v" : ">";
  toggle.disabled = !isDirectory || !entry.hasChildren;
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    if (isDirectory) toggleLocalFsDirectory(entry.relativePath);
  });
  const kind = document.createElement("span");
  kind.className = "local-fs-kind";
  kind.textContent = isDirectory ? "dir" : (entry.extension || "file").replace(/^\./, "");
  const name = document.createElement("span");
  name.className = "local-fs-name";
  name.textContent = entry.name;
  name.title = entry.relativePath;
  row.append(toggle, kind, name);
  row.addEventListener("click", () => {
    if (isDirectory) toggleLocalFsDirectory(entry.relativePath);
    else readLocalFsFile(entry);
  });
  container.appendChild(row);
  if (isDirectory && localFsExpandedPaths.has(entry.relativePath)) {
    const children = document.createElement("div");
    children.className = "local-fs-children";
    renderLocalFsEntries(entry.relativePath, depth + 1, children);
    container.appendChild(children);
  }
}

function renderLocalFsTree(): void {
  localFsTreeEl.innerHTML = "";
  const rootPath = localFsRootInputEl.value.trim();
  if (!rootPath) {
    localFsPreviewTitleEl.textContent = "Preview";
    localFsPreviewEl.textContent = "";
    return;
  }
  const rootRow = document.createElement("div");
  rootRow.className = `local-fs-row${localFsSelectedPath === "" ? " is-selected" : ""}`;
  rootRow.style.setProperty("--local-fs-indent", "10px");
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "local-fs-toggle";
  toggle.textContent = localFsExpandedPaths.has("") ? "v" : ">";
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleLocalFsDirectory("");
  });
  const kind = document.createElement("span");
  kind.className = "local-fs-kind";
  kind.textContent = "root";
  const name = document.createElement("span");
  name.className = "local-fs-name";
  name.textContent = localFsRootLabel(rootPath);
  name.title = rootPath;
  rootRow.append(toggle, kind, name);
  rootRow.addEventListener("click", () => toggleLocalFsDirectory(""));
  localFsTreeEl.appendChild(rootRow);
  if (localFsExpandedPaths.has("")) {
    const children = document.createElement("div");
    children.className = "local-fs-children";
    renderLocalFsEntries("", 1, children);
    localFsTreeEl.appendChild(children);
  }
}

function setLocalFsFixture(nextId: LocalFsFixtureId): void {
  localFsFixtureId = nextId;
  localFsFixtureEl.value = nextId;
  localFsRootInputEl.value = fixture.fileTrees[nextId].rootPath;
  resetLocalFsTree();
  localFsStatusEl.textContent = `${fixture.fileTrees[nextId].rootPath} (fixture, disconnected)`;
  renderLocalFsTree();
  setStatus(`Local filesystem fixture: ${nextId}. No /api/local-fs request was made.`);
}

function collectFlatNodes(state: PanelFixtureState, rootId: string): FlatConflictNode[] {
  const result: FlatConflictNode[] = [];
  const stack: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const node = state.nodes[current.id];
    if (!node) continue;
    result.push({ id: current.id, text: node.text || "Untitled", depth: current.depth });
    [...node.children].reverse().forEach((childId) => stack.push({ id: childId, depth: current.depth + 1 }));
  }
  return result;
}

function diffStates(localState: PanelFixtureState, remoteState: PanelFixtureState): ConflictDiffResult {
  const localIds = new Set(Object.keys(localState.nodes));
  const remoteIds = new Set(Object.keys(remoteState.nodes));
  const localOnly = new Set([...localIds].filter((id) => !remoteIds.has(id)));
  const remoteOnly = new Set([...remoteIds].filter((id) => !localIds.has(id)));
  const changed = new Set<string>();
  [...localIds].forEach((id) => {
    const localNode = localState.nodes[id];
    const remoteNode = remoteState.nodes[id];
    if (localNode && remoteNode && (
      localNode.text !== remoteNode.text
      || JSON.stringify(localNode.children) !== JSON.stringify(remoteNode.children)
      || localNode.parentId !== remoteNode.parentId
      || localNode.nodeType !== remoteNode.nodeType
    )) {
      changed.add(id);
    }
  });
  return {
    localOnly,
    remoteOnly,
    changed,
    addedCount: remoteOnly.size,
    removedCount: localOnly.size,
    changedCount: changed.size,
  };
}

function renderConflictTree(container: HTMLElement, nodes: FlatConflictNode[], diffClasses: Map<string, string>): void {
  container.innerHTML = "";
  nodes.forEach((item) => {
    const row = document.createElement("div");
    row.className = `conflict-node-row${diffClasses.has(item.id) ? ` ${diffClasses.get(item.id)}` : ""}`;
    const indent = document.createElement("span");
    indent.className = "conflict-node-indent";
    indent.style.width = `${item.depth * 16}px`;
    const text = document.createElement("span");
    text.className = "conflict-node-text";
    text.textContent = item.text;
    row.append(indent, text);
    container.appendChild(row);
  });
}

function renderConflictPanel(): void {
  const remoteState = fixture.remoteStates[conflictFixtureId];
  const diff = diffStates(appState, remoteState);
  const localClasses = new Map<string, string>();
  const remoteClasses = new Map<string, string>();
  diff.localOnly.forEach((id) => localClasses.set(id, "diff-removed"));
  diff.remoteOnly.forEach((id) => remoteClasses.set(id, "diff-added"));
  diff.changed.forEach((id) => {
    localClasses.set(id, "diff-changed");
    remoteClasses.set(id, "diff-changed");
  });
  renderConflictTree(conflictLocalTreeEl, collectFlatNodes(appState, appState.rootId), localClasses);
  renderConflictTree(conflictRemoteTreeEl, collectFlatNodes(remoteState, remoteState.rootId), remoteClasses);
  const parts: string[] = [];
  if (diff.addedCount > 0) parts.push(`${diff.addedCount} node(s) added in remote`);
  if (diff.removedCount > 0) parts.push(`${diff.removedCount} node(s) removed in remote`);
  if (diff.changedCount > 0) parts.push(`${diff.changedCount} node(s) modified`);
  conflictDiffSummaryEl.textContent = parts.length > 0
    ? parts.join(" | ")
    : "No structural differences detected (metadata may differ).";
}

function selectedNodeForV4(): PanelFixtureNode | null {
  return currentSelectedNode();
}

function renderV4Drafts(): void {
  const pending = v4Drafts.filter((draft) => draft.status === "pending").length;
  v4FlashStatusEl.textContent = `Drafts: ${v4Drafts.length} total, ${pending} pending`;
  v4DraftListEl.innerHTML = "";
  v4Drafts.slice(0, 6).forEach((draft) => {
    const item = document.createElement("div");
    item.className = "v4-list-item";
    item.textContent = draft.title || draft.id;
    const meta = document.createElement("small");
    meta.textContent = `${draft.status} | ${draft.nodeCount} nodes | ${draft.sourceType}`;
    item.appendChild(meta);
    v4DraftListEl.appendChild(item);
  });
}

function renderV4Panel(): void {
  const selected = selectedNodeForV4();
  const vault = fixture.vault;
  v4VaultStatusEl.textContent = vault.lastError
    ? `Vault: error (${vault.lastError})`
    : vault.running
      ? `Vault: live, source=${vault.sourceOfTruth}, inbound=${vault.lastInboundAt || "none"}, outbound=${vault.lastOutboundAt || "none"}`
      : "Vault: path set, live off";
  v4VaultPathEl.textContent = vault.path;
  v4ConflictStatusEl.textContent = panelIsVisible("conflict-panel")
    ? "Conflict workbench is open. Current UI is local/remote; V4 target is local/remote/resolution."
    : "No conflict panel open.";
  const lock = selected?.attributes["secret:lock"] || selected?.attributes["m3e:secretLock"] || "none";
  v4GithubStatusEl.textContent = `Publish plan: design-only. Staged proposal model active. Selected secret lock: ${lock}.`;
  if (selected) {
    const sourceType = selected.attributes["m3e:sourceType"] || selected.attributes["vault:kind"] || "none";
    const sourceRef = selected.attributes["m3e:sourceUrl"] || selected.attributes["vault:path"] || "";
    v4SelectedSourceEl.textContent = `Selected: ${uiLabel(selected)} | source=${sourceType}${sourceRef ? ` | ${sourceRef}` : ""}`;
  } else {
    v4SelectedSourceEl.textContent = "No selected node.";
  }
  renderV4Drafts();
}

function setPanelVisible(panelId: PanelId, visible: boolean): void {
  panelElements[panelId].hidden = !visible;
  const toggle = panelToggleInputs.find((input) => input.dataset.panelToggle === panelId);
  if (toggle) toggle.checked = visible;
  if (visible && panelId === "local-fs-panel") renderLocalFsTree();
  if (visible && panelId === "entity-list-panel") renderEntityPanel();
  if (visible && panelId === "conflict-panel") renderConflictPanel();
  if (visible && panelId === "v4-panel") renderV4Panel();
  if (visible && panelId === "markdown-preview-panel") renderMarkdownPreview();
}

function renderMarkdownPreview(): void {
  if (!panelIsVisible("markdown-preview-panel")) return;
  const run = ++markdownRenderRun;
  const selected = currentSelectedNode();
  if (!selected) {
    markdownPreviewTitleEl.textContent = "Markdown Preview";
    markdownPreviewBodyEl.textContent = "No node selected for markdown preview.";
    return;
  }
  const source = [selected.details || "", selected.note || ""].filter(Boolean).join("\n\n");
  markdownPreviewTitleEl.textContent = `Markdown: ${uiLabel(selected)}`;
  if (!source.trim()) {
    markdownPreviewBodyEl.textContent = "Selected node has no details or note.";
    return;
  }
  const markdownGlobals = globalThis as MarkdownGlobals;
  if (typeof markdownGlobals.renderMarkdownInto !== "function") {
    markdownPreviewBodyEl.textContent = source;
    return;
  }
  markdownPreviewBodyEl.textContent = "Rendering fixture Markdown...";
  void markdownGlobals.renderMarkdownInto(markdownPreviewBodyEl, source).catch((error: unknown) => {
    if (run !== markdownRenderRun) return;
    markdownPreviewBodyEl.textContent = `Markdown render failed: ${String(error)}`;
  });
}

function renderGraphSelection(): void {
  document.querySelectorAll<HTMLElement>("[data-fixture-node]").forEach((nodeEl) => {
    const nodeId = nodeEl.dataset.fixtureNode || "";
    nodeEl.classList.toggle("is-selected", selection.kind === "node" && selection.nodeId === nodeId);
    nodeEl.classList.toggle("is-multi-selected", selection.nodeIds.has(nodeId) && selection.kind === "multiple");
  });
  selectionSummaryEl.textContent = `selection: ${selectionLabel()}`;
}

function renderAll(): void {
  renderGraphSelection();
  renderMetaPanel();
  if (panelIsVisible("entity-list-panel")) renderEntityPanel();
  if (panelIsVisible("local-fs-panel")) renderLocalFsTree();
  if (panelIsVisible("conflict-panel")) renderConflictPanel();
  if (panelIsVisible("v4-panel")) renderV4Panel();
  renderMarkdownPreview();
}

function addV4DiscussionNode(kind: "sticky" | "decision"): void {
  const parent = selectedNodeForV4();
  if (!parent) {
    setStatus("Select a parent node for the V4 discussion item.");
    return;
  }
  if (parent.nodeType === "alias") {
    setStatus("Select a non-alias parent node for the V4 discussion item.");
    return;
  }
  const id = `fixture-discussion-${kind}`;
  if (!appState.nodes[id]) {
    const child: PanelFixtureNode = {
      id,
      parentId: parent.id,
      children: [],
      nodeType: "text",
      text: kind === "decision" ? "Decision: fixture" : "Sticky: fixture",
      details: "Created by the deterministic V4 fixture adapter.",
      note: "",
      attributes: {
        "m3e:surface": "discussion",
        "discussion:kind": kind,
        "discussion:status": kind === "decision" ? "decided" : "open",
        "discussion:sourceNodeId": parent.id,
      },
    };
    appState.nodes[id] = child;
    parent.children.push(id);
    ensureNodeSelectionOption(id);
  }
  setNodeSelection(id);
  setStatus(`V4 ${kind} node staged in fixture memory; no map write was made.`);
}

function installEventHandlers(): void {
  panelToggleInputs.forEach((input) => {
    input.addEventListener("change", () => {
      const panelId = input.dataset.panelToggle as PanelId;
      setPanelVisible(panelId, input.checked);
    });
  });
  selectionEl.addEventListener("change", () => setSelection(selectionEl.value));
  conflictFixtureEl.addEventListener("change", () => {
    conflictFixtureId = conflictFixtureEl.value as ConflictFixtureId;
    if (panelIsVisible("conflict-panel")) renderConflictPanel();
    setStatus(`Conflict fixture: ${conflictFixtureId}.`);
  });
  localFsFixtureEl.addEventListener("change", () => setLocalFsFixture(localFsFixtureEl.value as LocalFsFixtureId));
  document.querySelectorAll<HTMLElement>("[data-fixture-node]").forEach((nodeEl) => {
    nodeEl.addEventListener("click", () => setSelection(`node:${nodeEl.dataset.fixtureNode || ""}`));
  });

  entityListSearchEl.addEventListener("input", () => renderEntityPanel());
  entityListSearchEl.addEventListener("keydown", (event) => event.stopPropagation());
  document.getElementById("entity-list-close")?.addEventListener("click", () => {
    setPanelVisible("entity-list-panel", false);
    boardEl.focus();
  });

  document.getElementById("local-fs-close")?.addEventListener("click", () => {
    setPanelVisible("local-fs-panel", false);
    boardEl.focus();
  });
  document.getElementById("local-fs-connect")?.addEventListener("click", () => {
    localFsStatusEl.textContent = `${localFsRootInputEl.value.trim() || "(empty root)"} (fixture, disconnected)`;
    resetLocalFsTree();
    renderLocalFsTree();
    setStatus("Local filesystem Connect is fixture-only; no server request was made.");
  });
  document.getElementById("local-fs-refresh")?.addEventListener("click", () => {
    resetLocalFsTree();
    localFsStatusEl.textContent = `${fixture.fileTrees[localFsFixtureId].rootPath} (fixture, disconnected)`;
    renderLocalFsTree();
    setStatus("Local filesystem fixture refreshed.");
  });
  localFsRootInputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      document.getElementById("local-fs-connect")?.dispatchEvent(new MouseEvent("click"));
    }
  });

  document.getElementById("conflict-close")?.addEventListener("click", () => {
    setPanelVisible("conflict-panel", false);
    boardEl.focus();
  });
  document.getElementById("conflict-use-local")?.addEventListener("click", () => {
    setPanelVisible("conflict-panel", false);
    setStatus("Conflict resolved as Use Local in fixture memory; product save/push route was not called.");
  });
  document.getElementById("conflict-use-remote")?.addEventListener("click", () => {
    appState = clonePanelFixtureState(fixture.remoteStates[conflictFixtureId]);
    setPanelVisible("conflict-panel", false);
    setStatus("Conflict resolved as Use Remote in fixture memory; product load/pull route was not called.");
    renderAll();
  });

  document.getElementById("markdown-preview-close")?.addEventListener("click", () => {
    setPanelVisible("markdown-preview-panel", false);
    boardEl.focus();
  });

  document.getElementById("v4-panel-close")?.addEventListener("click", () => {
    setPanelVisible("v4-panel", false);
    boardEl.focus();
  });
  document.getElementById("v4-refresh-btn")?.addEventListener("click", () => {
    v4Drafts = fixture.drafts.map((draft) => ({ ...draft }));
    renderV4Panel();
    setStatus("V4 drafts refreshed from deterministic fixture; no /api/flash/drafts request was made.");
  });
  document.getElementById("v4-create-draft-btn")?.addEventListener("click", () => {
    const content = v4SourceTextEl.value.trim();
    if (!content) {
      setStatus("Paste source text before creating a Mapify draft.");
      return;
    }
    const existing = v4Drafts.find((draft) => draft.id === "draft-fixture-created");
    if (existing) {
      existing.status = "pending";
    } else {
      v4Drafts.unshift({
        id: "draft-fixture-created",
        mapId: fixture.mapId,
        sourceType: content.includes("#") ? "markdown" : "text",
        sourceRef: "fixture://created-draft",
        title: "Created fixture draft",
        nodeCount: 3,
        status: "pending",
        createdAt: fixture.savedAt,
      });
    }
    renderV4Panel();
    setStatus("Mapify draft staged in fixture memory; product POST /api/flash/ingest was not called.");
  });
  document.getElementById("v4-apply-draft-btn")?.addEventListener("click", () => {
    const draft = v4Drafts.find((item) => item.status === "pending");
    if (!draft) {
      setStatus("No pending Mapify draft to apply.");
      return;
    }
    draft.status = "applied";
    renderV4Panel();
    setStatus("Mapify draft marked applied in fixture memory; product approve/map write was not called.");
  });
  document.getElementById("v4-add-sticky-btn")?.addEventListener("click", () => addV4DiscussionNode("sticky"));
  document.getElementById("v4-add-decision-btn")?.addEventListener("click", () => addV4DiscussionNode("decision"));
}

function initialize(): void {
  panelToggleInputs.forEach((input) => {
    const panelId = input.dataset.panelToggle as PanelId;
    panelElements[panelId].hidden = !input.checked;
  });
  localFsRootInputEl.value = fixture.fileTrees[localFsFixtureId].rootPath;
  resetLocalFsTree();
  installEventHandlers();
  setStatus(lastStatus);
  renderAll();
}

initialize();

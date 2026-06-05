const nodes = [
  { id: "N1", title: "Flash note", detail: "raw thought fragment" },
  { id: "N2", title: "Draft branch", detail: "Rapid outline candidate" },
  { id: "N3", title: "Active paragraph", detail: "selected canvas node" },
  { id: "N4", title: "Evidence link", detail: "supporting material" },
  { id: "N5", title: "Decision note", detail: "manager review target" },
];

const scopes = [
  { id: "S:Rapid", title: "Rapid", detail: "document-level syntax tree", parent: null, tone: "blue" },
  { id: "S:Flash", title: "Flash", detail: "inbox and loose fragments", parent: null, tone: "amber" },
  { id: "S:Deep", title: "Deep", detail: "semantic graph assets", parent: null, tone: "green" },
  { id: "S:Rapid/PJ05", title: "PJ05 Presentation", detail: "embedded HTML work", parent: "S:Rapid", tone: "blue" },
  { id: "S:Rapid/DEV", title: "DEV strategy", detail: "current manager board", parent: "S:Rapid", tone: "blue" },
  { id: "S:Deep/Projection", title: "Projection rules", detail: "Deep to Rapid route", parent: "S:Deep", tone: "green" },
  { id: "S:Flash/Inbox", title: "Inbox", detail: "unclassified queue", parent: "S:Flash", tone: "amber" },
];

const nodeList = document.getElementById("nodeList");
const scopeTree = document.getElementById("scopeTree");
const scopeCarousel = document.getElementById("scopeCarousel");
const activeNodeLabel = document.getElementById("activeNodeLabel");
const activeScopeLabel = document.getElementById("activeScopeLabel");
const routePreview = document.getElementById("routePreview");
const statusLabel = document.getElementById("statusLabel");
const routeCount = document.getElementById("routeCount");
const modeLabel = document.getElementById("modeLabel");
const scopeModeButton = document.getElementById("scopeModeButton");
const routeButton = document.getElementById("routeButton");

let activeNodeIndex = 2;
let activeScopeIndex = 2;
let activeMode = "scope";
const routeLog = [];

function scopeDepth(scope) {
  let depth = 0;
  let parent = scope.parent;
  while (parent) {
    depth += 1;
    parent = scopes.find((candidate) => candidate.id === parent)?.parent || null;
  }
  return depth;
}

function renderNodes() {
  nodeList.innerHTML = "";
  nodes.forEach((node, index) => {
    const button = document.createElement("button");
    const routed = routeLog.find((entry) => entry.nodeId === node.id);
    button.type = "button";
    button.className = `node-item${index === activeNodeIndex ? " is-active" : ""}${routed ? " is-routed" : ""}`;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", index === activeNodeIndex ? "true" : "false");
    button.innerHTML = `<strong>${node.id} ${node.title}</strong><span>${routed ? `routed to ${routed.scopeId}` : node.detail}</span>`;
    button.addEventListener("click", () => {
      activeNodeIndex = index;
      activeMode = "node";
      render();
    });
    nodeList.appendChild(button);
  });
}

function renderScopes() {
  scopeTree.innerHTML = "";
  scopes.forEach((scope, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `scope-item${index === activeScopeIndex ? " is-active" : ""}`;
    button.dataset.depth = String(scopeDepth(scope));
    button.dataset.tone = scope.tone;
    button.setAttribute("role", "treeitem");
    button.setAttribute("aria-selected", index === activeScopeIndex ? "true" : "false");
    button.innerHTML = `<strong>${scope.id}</strong><span>${scope.title} - ${scope.detail}</span>`;
    button.addEventListener("click", () => {
      activeScopeIndex = index;
      activeMode = "scope";
      render();
    });
    scopeTree.appendChild(button);
  });
}

function renderCarousel() {
  scopeCarousel.innerHTML = "";
  visibleCarouselScopes().forEach(({ scope, index }) => {
    const distance = Math.abs(index - activeScopeIndex);
    const card = document.createElement("div");
    card.className = `scope-card${index === activeScopeIndex ? " is-active" : ""}${distance === 1 ? " is-near" : ""}`;
    card.innerHTML = `<strong>${scope.title}</strong><span>${scope.id}<br>${scope.detail}</span>`;
    scopeCarousel.appendChild(card);
  });
}

function visibleCarouselScopes() {
  const windowSize = 5;
  let start = Math.max(0, activeScopeIndex - Math.floor(windowSize / 2));
  start = Math.min(start, Math.max(0, scopes.length - windowSize));
  return scopes.slice(start, start + windowSize).map((scope, offset) => ({ scope, index: start + offset }));
}

function moveActiveNode(delta) {
  activeNodeIndex = wrap(activeNodeIndex + delta, nodes.length);
  activeMode = "node";
  statusLabel.textContent = "Active node changed.";
  render();
}

function moveActiveScope(delta) {
  activeScopeIndex = wrap(activeScopeIndex + delta, scopes.length);
  activeMode = "scope";
  statusLabel.textContent = "Active scope changed.";
  render();
}

function executeRoute() {
  const node = nodes[activeNodeIndex];
  const scope = scopes[activeScopeIndex];
  const existingIndex = routeLog.findIndex((entry) => entry.nodeId === node.id);
  const entry = { nodeId: node.id, scopeId: scope.id };
  if (existingIndex >= 0) routeLog.splice(existingIndex, 1, entry);
  else routeLog.push(entry);
  statusLabel.textContent = `${node.id} routed to ${scope.id}.`;
  render();
}

function wrap(value, length) {
  return ((value % length) + length) % length;
}

function render() {
  const node = nodes[activeNodeIndex];
  const scope = scopes[activeScopeIndex];
  activeNodeLabel.textContent = node.id;
  activeScopeLabel.textContent = scope.id;
  routePreview.textContent = `${node.id} -> ${scope.id}`;
  routeCount.textContent = `${routeLog.length} route${routeLog.length === 1 ? "" : "s"}`;
  modeLabel.textContent = activeMode === "scope" ? "Scope route" : "Node route";
  renderNodes();
  renderScopes();
  renderCarousel();
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "r" && event.shiftKey) {
    event.preventDefault();
    activeMode = "scope";
    statusLabel.textContent = "Scope routing selected.";
    render();
    return;
  }
  if (key === "r") {
    event.preventDefault();
    executeRoute();
    return;
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    event.preventDefault();
    if (activeMode === "node") moveActiveNode(-1);
    else moveActiveScope(-1);
    return;
  }
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    event.preventDefault();
    if (activeMode === "node") moveActiveNode(1);
    else moveActiveScope(1);
    return;
  }
  if (event.key === "Tab") {
    event.preventDefault();
    activeMode = activeMode === "scope" ? "node" : "scope";
    statusLabel.textContent = activeMode === "scope" ? "Scope routing selected." : "Node routing selected.";
    render();
  }
});

scopeModeButton.addEventListener("click", () => {
  activeMode = "scope";
  statusLabel.textContent = "Scope routing selected.";
  render();
});

routeButton.addEventListener("click", executeRoute);

render();

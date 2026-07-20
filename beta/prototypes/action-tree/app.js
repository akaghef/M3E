const tree = [
  { id: "root", parent: null, label: "[GUI]", meta: "overlay entry", tone: "root" },

  { id: "board", parent: "root", label: "Board Bar", meta: "top surface", tone: "blue" },
  { id: "create", parent: "root", label: "Creation Bar", meta: "make objects", tone: "green" },
  { id: "object", parent: "root", label: "Object Context", meta: "selection layer", tone: "green" },
  { id: "navigate", parent: "root", label: "Navigation", meta: "move / zoom", tone: "blue" },
  { id: "collab", parent: "root", label: "Collaboration", meta: "people layer", tone: "red" },

  { id: "main-menu", parent: "board", label: "Main Menu", meta: "board/edit/view", tone: "blue" },
  { id: "board-name", parent: "board", label: "Board Name", meta: "rename/share", tone: "blue" },
  { id: "history", parent: "board", label: "Board History", meta: "audit changes", tone: "blue" },

  { id: "ai", parent: "create", label: "Create with AI", meta: "prompt entry", tone: "green" },
  { id: "sticky", parent: "create", label: "Sticky / Text", meta: "fast notes", tone: "green" },
  { id: "shape", parent: "create", label: "Shapes / Lines", meta: "diagram tools", tone: "green" },

  { id: "context-toolbar", parent: "object", label: "Context Toolbar", meta: "near object", tone: "green" },
  { id: "quick-connect", parent: "object", label: "Quick Connect", meta: "blue dot", tone: "green" },

  { id: "zoom", parent: "navigate", label: "Zoom", meta: "scale controls", tone: "blue" },
  { id: "frames", parent: "navigate", label: "Frames / Layers", meta: "structure panel", tone: "blue" },
  { id: "minimap", parent: "navigate", label: "Minimap", meta: "spatial overview", tone: "blue" },

  { id: "comments", parent: "collab", label: "Comments", meta: "review layer", tone: "red" },
  { id: "cursors", parent: "collab", label: "Cursors", meta: "presence", tone: "red" },

  { id: "menu-settings", parent: "main-menu", label: "Settings", meta: "board prefs", tone: "blue" },
  { id: "menu-export", parent: "main-menu", label: "Export", meta: "file outputs", tone: "blue" },
  { id: "ai-prompt", parent: "ai", label: "Prompt Box", meta: "describe output", tone: "green" },
  { id: "ai-presets", parent: "ai", label: "Presets", meta: "diagram / notes", tone: "green" },
  { id: "sticky-color", parent: "sticky", label: "Color Swatch", meta: "visual status", tone: "green" },
  { id: "shape-style", parent: "shape", label: "Style Sheet", meta: "border / fill", tone: "green" },
  { id: "object-actions", parent: "context-toolbar", label: "Action Sheet", meta: "copy / lock / link", tone: "green" },
  { id: "connect-target", parent: "quick-connect", label: "Target Picker", meta: "new relation", tone: "green" },
  { id: "zoom-detail", parent: "zoom", label: "Fit / Percent", meta: "view setting", tone: "blue" },
  { id: "frame-list", parent: "frames", label: "Frame List", meta: "jump / reorder", tone: "blue" },
  { id: "minimap-detail", parent: "minimap", label: "Viewport Box", meta: "drag canvas", tone: "blue" },
  { id: "comment-filter", parent: "comments", label: "Filter", meta: "open / resolved", tone: "red" },
  { id: "cursor-mode", parent: "cursors", label: "Follow Mode", meta: "jump to user", tone: "red" },
];

const svg = document.getElementById("treeSvg");
const nodeLayer = document.getElementById("nodeLayer");
const selectedLabel = document.getElementById("selectedLabel");
const variantLabel = document.getElementById("variantLabel");
const variantToggle = document.getElementById("variantToggle");
const commandList = document.getElementById("commandList");
const search = document.getElementById("commandSearch");
const toast = document.getElementById("toast");
const detailSheet = document.getElementById("detailSheet");

let activeId = null;
let focusedIndex = 0;
let visibleIds = ["root"];
let visibleRows = [];
let hoverTimer = 0;
let layout = new Map();
let suppressRootRevealUntil = 0;
let variant = new URLSearchParams(window.location.search).get("v") === "v2" ? "v2" : "v1";

function byId(id) {
  return tree.find((node) => node.id === id);
}

function childrenOf(id) {
  return tree.filter((node) => node.parent === id);
}

function ancestorsOf(id) {
  const path = [];
  let current = byId(id);
  while (current) {
    path.unshift(current.id);
    current = current.parent ? byId(current.parent) : null;
  }
  return path;
}

function computeVisible(id) {
  if (!id) return ["root"];
  const path = ancestorsOf(id);
  const visible = new Set(path);
  childrenOf(id).forEach((child) => visible.add(child.id));
  if (variant === "v2") {
    path.forEach((pathId) => {
      visible.add(pathId);
      const pathNode = byId(pathId);
      if (pathNode?.parent) childrenOf(pathNode.parent).forEach((sibling) => visible.add(sibling.id));
    });
    childrenOf(id).forEach((child) => visible.add(child.id));
  } else {
    const parent = byId(id)?.parent;
    if (parent) childrenOf(parent).forEach((sibling) => visible.add(sibling.id));
  }
  if (id === "root") childrenOf("root").forEach((child) => visible.add(child.id));
  return tree.filter((node) => visible.has(node.id)).map((node) => node.id);
}

function activate(id, mode = "focus") {
  if (activeId === id && mode !== "click") return;
  if (id === "root" && mode === "click") {
    collapseToRoot();
    showToast("Collapsed to [GUI]");
    return;
  }
  activeId = id;
  visibleIds = computeVisible(id);
  render();
  if (mode === "click") showToast(`Pinned ${byId(id).label}`);
}

function scheduleHover(id) {
  if (id === "root" && Date.now() < suppressRootRevealUntil) return;
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => activate(id, "hover"), 90);
}

function reset() {
  collapseToRoot();
  showToast("Reset to [GUI]");
}

function collapseToRoot() {
  suppressRootRevealUntil = Date.now() + 450;
  clearTimeout(hoverTimer);
  activeId = null;
  visibleIds = ["root"];
  search.value = "";
  render();
}

function drawLinks() {
  svg.innerHTML = "";
  const canvas = document.querySelector(".canvas-wrap");
  const canvasRect = canvas.getBoundingClientRect();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", `${width}`);
  svg.setAttribute("height", `${height}`);
  visibleIds.forEach((id) => {
    const node = byId(id);
    if (!node.parent || !visibleIds.includes(node.parent)) return;
    const from = edgeAnchor(node.parent, "right", canvasRect);
    const to = edgeAnchor(node.id, "left", canvasRect);
    if (!from || !to) return;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const midX = from.x + (to.x - from.x) * 0.5;
    path.setAttribute("class", "tree-link");
    path.setAttribute("d", `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`);
    svg.appendChild(path);
  });
}

function edgeAnchor(id, side, canvasRect) {
  const el = nodeLayer.querySelector(`[data-node-id="${id}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    x: side === "right" ? rect.right - canvasRect.left : rect.left - canvasRect.left,
    y: rect.top - canvasRect.top + rect.height / 2,
  };
}

function renderNodes() {
  nodeLayer.innerHTML = "";
  layout = computeLayout();
  visibleIds.forEach((id) => {
    const node = byId(id);
    const point = layout.get(id);
    const el = document.createElement("div");
    const pathIds = activeId ? ancestorsOf(activeId) : ["root"];
    const isPath = pathIds.includes(id) && id !== activeId;
    el.className = `map-node${id === activeId ? " is-selected" : ""}${isPath ? " is-path" : ""}${node.tone === "root" ? " is-root" : ""}`;
    el.dataset.nodeId = id;
    el.dataset.tone = node.tone;
    el.style.left = `${point.x}px`;
    el.style.top = `${point.y}px`;
    el.innerHTML = `<button type="button" aria-label="${node.label}"><strong>${node.label}</strong><span>${node.meta}</span></button>`;
    const button = el.querySelector("button");
    button.addEventListener("pointerdown", (event) => {
      if (id === "root" && visibleIds.length > 1) {
        event.preventDefault();
        collapseToRoot();
        showToast("Collapsed to [GUI]");
      }
    });
    button.addEventListener("mouseenter", () => scheduleHover(id));
    button.addEventListener("focus", () => activate(id));
    button.addEventListener("click", () => activate(id, "click"));
    nodeLayer.appendChild(el);
  });
  updateSelectionLabel();
  renderDetailSheet();
}

function depthOf(id) {
  return ancestorsOf(id).length - 1;
}

function computeLayout() {
  const canvas = document.querySelector(".canvas-wrap");
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const centerY = height / 2;
  const byDepth = new Map();
  visibleIds.forEach((id) => {
    const depth = depthOf(id);
    const items = byDepth.get(depth) || [];
    items.push(id);
    byDepth.set(depth, items);
  });

  const columnByDepth = new Map([
    [1, Math.max(320, Math.min(340, width - 520))],
    [2, Math.max(500, Math.min(520, width - 340))],
    [3, Math.max(680, Math.min(700, width - 160))],
  ]);
  const points = new Map();
  if (byDepth.has(0)) {
    points.set("root", {
      x: Math.max(130, Math.min(190, width * 0.18)),
      y: centerY,
    });
  }
  for (const [depth, ids] of byDepth.entries()) {
    if (depth === 0) continue;
    const gap = ids.length >= 5 ? 72 : ids.length >= 3 ? 82 : 92;
    const total = (ids.length - 1) * gap;
    const startY = centerY - total / 2;
    ids.forEach((id, index) => {
      points.set(id, {
        x: columnByDepth.get(depth) || Math.min(700, width - 120),
        y: startY + index * gap,
      });
    });
  }
  return points;
}

function updateSelectionLabel() {
  const selected = byId(activeId || "root");
  variantLabel.textContent = variant;
  variantToggle.textContent = variant === "v1" ? "v2" : "v1";
  selectedLabel.textContent = `Focus: ${selected.label}`;
}

function renderDetailSheet() {
  const selected = byId(activeId || "root");
  const childCount = childrenOf(selected.id).length;
  const path = ancestorsOf(selected.id).map((id) => byId(id).label).join(" / ");
  detailSheet.innerHTML = `
    <strong>${selected.label}</strong>
    <span>${path}</span>
    <small>${childCount ? `${childCount} deeper choices available` : "leaf action settings available"}</small>
  `;
}

function renderCommandList() {
  const term = search.value.trim().toLowerCase();
  const rows = visibleIds
    .map((id) => byId(id))
    .filter((node) => !term || `${node.label} ${node.meta}`.toLowerCase().includes(term));
  commandList.innerHTML = "";
  visibleRows = [];
  rows.forEach((node) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `command-row is-command${node.id === activeId ? " is-focused" : ""}`;
    row.innerHTML = `<span class="command-icon" aria-hidden="true"></span><span><strong>${node.label}</strong><small>${node.meta}</small></span><span>${childrenOf(node.id).length ? ">" : ""}</span>`;
    row.addEventListener("click", () => activate(node.id, "click"));
    commandList.appendChild(row);
    visibleRows.push({ id: node.id, el: row });
  });
  focusedIndex = Math.min(focusedIndex, Math.max(visibleRows.length - 1, 0));
  updateFocus();
}

function updateFocus() {
  document.querySelectorAll(".command-row.is-focused").forEach((row) => row.classList.remove("is-focused"));
  if (!visibleRows.length) return;
  visibleRows[focusedIndex].el.classList.add("is-focused");
  visibleRows[focusedIndex].el.scrollIntoView({ block: "nearest" });
}

function moveFocus(delta) {
  if (!visibleRows.length) return;
  focusedIndex = (focusedIndex + delta + visibleRows.length) % visibleRows.length;
  updateFocus();
}

function activateFocused() {
  if (!visibleRows.length) return;
  activate(visibleRows[focusedIndex].id, "click");
}

function render() {
  renderNodes();
  drawLinks();
  renderCommandList();
}

let toastTimer = 0;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1600);
}

document.getElementById("resetNavigator").addEventListener("click", reset);
variantToggle.addEventListener("click", () => {
  variant = variant === "v1" ? "v2" : "v1";
  visibleIds = computeVisible(activeId || "root");
  render();
  showToast(`Switched to ${variant}`);
});
document.getElementById("closeNavigator").addEventListener("click", () => {
  document.getElementById("navigator").classList.remove("is-open");
});

search.addEventListener("input", () => {
  focusedIndex = 0;
  renderCommandList();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveFocus(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    moveFocus(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    const selected = byId(activeId || "root");
    const child = childrenOf(selected.id)[0];
    if (child) activate(child.id, "click");
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    const selected = byId(activeId || "root");
    if (selected.parent === "root") collapseToRoot();
    else if (selected.parent) activate(selected.parent, "click");
  } else if (event.key === "Enter") {
    event.preventDefault();
    activateFocused();
  } else if (event.key === "Escape") {
    reset();
  }
});

window.addEventListener("resize", drawLinks);

render();

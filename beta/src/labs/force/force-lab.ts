import { createOtForce, FORCE_DEFAULTS } from "../../shared/ot_force";
import type { ForceMode, ForceParameters, ForceSnapshot } from "../../shared/force_seam_interface";
import { forceFixture } from "./force_fixtures";
import "./force-lab.css";

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const svg = document.getElementById("canvas") as unknown as SVGSVGElement;
const scene = document.getElementById("scene") as unknown as SVGGElement;
const fixture = el<HTMLSelectElement>("fixture"), mode = el<HTMLSelectElement>("mode");
el<HTMLAnchorElement>("source-notice").href = new URL("./NOTICE.md", import.meta.url).href;
let graph = forceFixture(fixture.value), simulation = createOtForce(graph), snapshot = simulation.snapshot();
let selected: string | null = null, raf = 0, previousTime = 0, accumulator = 0, lastStepMs = 0;
let camera = { x: 150, y: -60, scale: .8 };
let pointer: { id: number; x: number; y: number; kind: "pan" | "node" | "group"; nodeId?: string; moved: boolean } | null = null;
const escape = (s: string): string => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const statuses = { running: "計算中", paused: "一時停止", settled: "収束", budget: "計算予算で停止", blocked: "制約未解消" };

function updateCamera(): void {
  const { width, height } = svg.getBoundingClientRect();
  svg.setAttribute("viewBox", `${camera.x - width / camera.scale / 2} ${camera.y - height / camera.scale / 2} ${width / camera.scale} ${height / camera.scale}`);
}
function fit(): void {
  const boxes = [...snapshot.nodes.map(n => ({ x: n.x - n.w / 2, y: n.y - n.h / 2, w: n.w, h: n.h })), ...snapshot.groups];
  if (!boxes.length) return;
  const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
  const w = Math.max(...boxes.map(b => b.x + b.w)) - x, h = Math.max(...boxes.map(b => b.y + b.h)) - y;
  const viewport = svg.getBoundingClientRect();
  camera = { x: x + w / 2, y: y + h / 2, scale: Math.min(1.4, (viewport.width - 100) / (w + 40), (viewport.height - 100) / (h + 40)) };
  updateCamera();
}
function boundary(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number }): { x: number; y: number } {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.min(dx ? a.w / 2 / Math.abs(dx) : Infinity, dy ? a.h / 2 / Math.abs(dy) : Infinity);
  return Number.isFinite(t) ? { x: a.x + dx * t, y: a.y + dy * t } : { x: a.x, y: a.y };
}
function render(next: ForceSnapshot = simulation.snapshot()): void {
  snapshot = next;
  const nodes = new Map(next.nodes.map(n => [n.id, n]));
  const groups = [...next.groups].sort((a, b) => b.members.length - a.members.length).map(g =>
    `<g data-group="${escape(g.id)}"><rect class="group-box" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="10"/><rect class="group-handle" data-drag-group="${escape(g.id)}" x="${g.x + 1}" y="${g.y + 1}" width="${g.w - 2}" height="28" rx="6"/><text class="group-label" x="${g.x + 12}" y="${g.y + 19}">${escape(g.label)} · ${g.members.length}</text></g>`).join("");
  const edges = next.links.map(e => {
    const a = nodes.get(e.source)!, b = nodes.get(e.target)!, s = boundary(a, b), t = boundary(b, a);
    return `<g><line class="edge ${e.kind}" x1="${s.x}" y1="${s.y}" x2="${t.x}" y2="${t.y}"/>${e.weight > 1 ? `<text class="weight" x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 5}">×${e.weight}</text>` : ""}</g>`;
  }).join("");
  const cards = next.nodes.map(n => `<g class="node" data-node="${escape(n.id)}" data-pinned="${Boolean(n.pinned)}" data-selected="${n.id === selected}" role="button" aria-label="${escape(n.label)}" tabindex="0" transform="translate(${n.x} ${n.y})"><rect x="${-n.w / 2}" y="${-n.h / 2}" width="${n.w}" height="${n.h}" rx="7"/><text text-anchor="middle" y="${n.collapsed || n.pinned ? -3 : 4}">${escape(n.label)}</text>${n.collapsed || n.pinned ? `<text class="meta" text-anchor="middle" y="17">${n.pinned ? "PIN · " : ""}${n.collapsed ? `+${n.hiddenCount} hidden` : "固定"}</text>` : ""}</g>`).join("");
  const focused = (document.activeElement as Element | null)?.getAttribute("data-node");
  scene.innerHTML = groups + edges + cards;
  if (focused) scene.querySelector<SVGGElement>(`[data-node="${CSS.escape(focused)}"]`)?.focus();
  el("status").textContent = statuses[next.status]; el("status").dataset.state = next.status;
  el("counts").textContent = `${next.nodes.length} nodes · ${next.groups.length} groups · ${next.links.length} links`;
  el("metrics").textContent = `step ${next.steps} · Δ ${next.maxMove.toFixed(2)} · violations ${next.violations} · ${lastStepMs.toFixed(1)} ms/step`;
  el<HTMLButtonElement>("pause").disabled = next.status !== "running";
  const n = selected ? nodes.get(selected) : undefined;
  el("selection").hidden = !n;
  if (n) {
    el("selected-label").textContent = n.label;
    el<HTMLButtonElement>("collapse").disabled = !graph.nodes.some(child => child.parentId === n.id);
    el("collapse").textContent = n.collapsed ? "子孫を展開" : "子孫を畳む";
    el("pin").textContent = n.pinned ? "固定解除" : "固定";
  }
  for (const key of Object.keys(FORCE_DEFAULTS) as (keyof ForceParameters)[]) {
    el<HTMLInputElement>(key).value = String(next.parameters[key]);
    document.querySelector(`output[for="${key}"]`)!.textContent = String(next.parameters[key]);
  }
}
function frame(time: number): void {
  raf = 0;
  if (document.hidden) return;
  accumulator += previousTime ? Math.min(64, time - previousTime) : 1000 / 60;
  previousTime = time;
  while (accumulator >= 1000 / 60 && simulation.snapshot().status === "running") {
    const start = performance.now(); snapshot = simulation.step(); lastStepMs = performance.now() - start;
    accumulator -= 1000 / 60;
  }
  render(snapshot);
  if (snapshot.status === "running") raf = requestAnimationFrame(frame);
}
function wake(): void {
  render();
  if (!raf && snapshot.status === "running" && !document.hidden) { previousTime = 0; accumulator = 0; raf = requestAnimationFrame(frame); }
}
function tuning(open: boolean): void {
  el("tuning").hidden = !open; el("tune-toggle").setAttribute("aria-expanded", String(open));
}
el("tune-toggle").onclick = () => tuning(el("tuning").hidden);
el("close-tuning").onclick = () => tuning(false);
el("pause").onclick = () => { simulation.pause(); render(); };
el("reheat").onclick = () => { simulation.reheat(); wake(); };
el("fit").onclick = fit;
el("reset").onclick = () => { simulation.resetPositions(); selected = null; render(simulation.step()); fit(); wake(); };
el("defaults").onclick = () => { simulation.setParameters({ ...FORCE_DEFAULTS }); wake(); };
el("clear-selection").onclick = () => { selected = null; render(); };
el("collapse").onclick = () => { if (selected) { simulation.setCollapsed(selected, !snapshot.nodes.find(n => n.id === selected)!.collapsed); wake(); } };
el("pin").onclick = () => { if (selected) { simulation.setPinned(selected, !snapshot.nodes.find(n => n.id === selected)!.pinned); wake(); } };
for (const key of Object.keys(FORCE_DEFAULTS) as (keyof ForceParameters)[]) {
  el<HTMLInputElement>(key).oninput = () => { simulation.setParameters({ [key]: Number(el<HTMLInputElement>(key).value) }); wake(); };
}
fixture.onchange = () => { graph = forceFixture(fixture.value); simulation = createOtForce(graph, mode.value as ForceMode); selected = null; render(simulation.step()); fit(); wake(); };
mode.onchange = () => { simulation.setMode(mode.value as ForceMode); wake(); };
svg.addEventListener("keydown", event => {
  if (event.key === "Enter" || event.key === " ") {
    const target = (event.target as Element).closest("[data-node]");
    if (target) { event.preventDefault(); selected = target.getAttribute("data-node"); render(); }
  }
});
svg.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;
  event.preventDefault(); // A graph drag must not start native text selection.
  const target = event.target as Element, group = target.closest("[data-drag-group]"), n = target.closest("[data-node]");
  const id = group?.getAttribute("data-drag-group") || n?.getAttribute("data-node") || undefined;
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, kind: group ? "group" : n ? "node" : "pan", nodeId: id, moved: false };
  svg.setPointerCapture(event.pointerId);
  if (id) { selected = id; render(); }
});
svg.addEventListener("pointermove", event => {
  if (!pointer || pointer.id !== event.pointerId) return;
  const dx = (event.clientX - pointer.x) / camera.scale, dy = (event.clientY - pointer.y) / camera.scale;
  if (!pointer.moved && Math.hypot(dx, dy) * camera.scale < 3) return;
  if (!pointer.moved && pointer.nodeId) simulation.beginDrag(pointer.nodeId, pointer.kind === "group");
  pointer.moved = true;
  if (pointer.nodeId) { simulation.moveDrag(dx, dy); wake(); }
  else { camera.x -= dx; camera.y -= dy; updateCamera(); }
  pointer.x = event.clientX; pointer.y = event.clientY;
});
function endPointer(): void {
  const ended = pointer;
  pointer = null;
  if (ended?.nodeId && ended.moved) { simulation.endDrag(); wake(); }
}
svg.addEventListener("pointerup", endPointer);
svg.addEventListener("pointercancel", endPointer);
svg.addEventListener("lostpointercapture", endPointer);
svg.addEventListener("wheel", event => {
  event.preventDefault();
  const b = svg.getBoundingClientRect(), px = event.clientX - b.left - b.width / 2, py = event.clientY - b.top - b.height / 2;
  const next = Math.max(.08, Math.min(4, camera.scale * Math.exp(-event.deltaY * .001)));
  camera.x += px / camera.scale - px / next; camera.y += py / camera.scale - py / next; camera.scale = next; updateCamera();
}, { passive: false });
new ResizeObserver(updateCamera).observe(el("canvas-host"));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { cancelAnimationFrame(raf); raf = 0; previousTime = 0; accumulator = 0; }
  else wake();
});
// Read-only diagnostic surface for browser acceptance; commands stay behind UI.
Object.assign(window, { forceLab: { snapshot: () => simulation.snapshot(), camera: () => ({ ...camera }), pendingFrame: () => Boolean(raf) } });
render(simulation.step()); fit(); wake();

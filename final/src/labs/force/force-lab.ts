import { createOtForce, FORCE_DEFAULTS } from "../../shared/ot_force";
import type { ForceMode, ForceParameters, ForceSnapshot } from "../../shared/force_seam_interface";
import { WebGLRenderingProjection, hitTestNodes } from "../../rendering/webgl_projection";
import { forceRenderCamera, forceRenderSnapshot, hitForceGroupHeader } from "./force_render_snapshot";
import { createForceSvgRenderer } from "./force_svg_renderer";
import { forceFixture } from "./force_fixtures";
import "./force-lab.css";

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const fixture = el<HTMLSelectElement>("fixture"), mode = el<HTMLSelectElement>("mode");
const picker = el<HTMLSelectElement>("node-picker");
const rendererKind = new URLSearchParams(location.search).get("renderer") === "svg" ? "svg" : "webgl";
const surface = rendererKind === "webgl" ? document.createElement("canvas") : document.createElementNS("http://www.w3.org/2000/svg", "svg");
surface.id = "canvas";
surface.setAttribute("tabindex", "0");
surface.setAttribute("role", "img");
surface.setAttribute("aria-label", "力学グラフ。ノード選択欄または矢印キーで選択");
surface.setAttribute("aria-describedby", "canvas-help");
el("render-host").append(surface);
el<HTMLAnchorElement>("source-notice").href = new URL("./NOTICE.md", import.meta.url).href;
let graph = forceFixture(fixture.value), simulation = createOtForce(graph), snapshot = simulation.snapshot();
let renderOnly = false, available = true, resumeAfterRestore = false;
let selected: string | null = null, raf = 0, previousTime = 0, accumulator = 0, lastStepMs = 0, lastRenderMs = 0;
let pickerKey = "", camera = { x: 150, y: -60, scale: .8 };
let pointer: { id: number; x: number; y: number; kind: "pan" | "node" | "group"; nodeId?: string; moved: boolean } | null = null;
const statuses = { running: "計算中", paused: "一時停止", settled: "安定", budget: "計算上限で停止", blocked: "制約未解消" };
const svgRenderer = rendererKind === "svg" ? createForceSvgRenderer(surface as SVGSVGElement) : null;
const projection = rendererKind === "webgl" ? new WebGLRenderingProjection(surface as HTMLCanvasElement, {
  labelMinZoom: 0,
  onUnavailable: unavailable,
  onRestored: () => {
    available = true; el("renderer-error").hidden = true;
    el("renderer-status").textContent = "WebGL2";
    if (resumeAfterRestore && !renderOnly) simulation.reheat();
    resumeAfterRestore = false; updateCamera(); wake();
  },
}) : null;
let scene = forceRenderSnapshot(snapshot);

function readSnapshot(): ForceSnapshot { return renderOnly ? snapshot : simulation.snapshot(); }
function stopFrame(): void { cancelAnimationFrame(raf); raf = 0; previousTime = 0; accumulator = 0; }
function unavailable(reason: string): void {
  resumeAfterRestore = available && snapshot.status === "running";
  available = false; stopFrame();
  if (pointer?.moved && pointer.nodeId) simulation.endDrag();
  pointer = null; simulation.pause();
  const error = el("renderer-error"); error.hidden = false;
  error.textContent = "WebGL描画を停止しました。" + reason + " GPUの復旧を待つか、このページを再読み込みしてください。";
  el("renderer-status").textContent = "WebGL停止";
  el("status").textContent = "描画停止";
  for (const id of ["fixture", "pause", "reheat", "reset", "defaults", "mode", "collapse", "pin", ...Object.keys(FORCE_DEFAULTS)]) {
    el<HTMLButtonElement>(id).disabled = true;
  }
}
function updateCamera(): void {
  const { width, height } = surface.getBoundingClientRect();
  const next = forceRenderCamera(camera, width, height);
  projection?.setCamera(next); svgRenderer?.setCamera(next);
}
function fit(): void {
  if (!scene.nodes.length) return;
  const { minX, minY, maxX, maxY } = scene.bounds;
  const viewport = surface.getBoundingClientRect();
  camera = { x: (minX + maxX) / 2, y: (minY + maxY) / 2,
    scale: Math.max(.02, Math.min(1.4, (viewport.width - 100) / (maxX - minX + 40), (viewport.height - 100) / (maxY - minY + 40))) };
  updateCamera();
}
function render(next: ForceSnapshot = readSnapshot()): void {
  snapshot = next;
  if (selected && !next.nodes.some(n => n.id === selected)) selected = null;
  const start = performance.now();
  scene = forceRenderSnapshot(next, selected);
  try { projection?.setSnapshot(scene); svgRenderer?.setSnapshot(scene); }
  catch (error) { unavailable(error instanceof Error ? error.message : String(error)); }
  lastRenderMs = performance.now() - start;
  el("status").textContent = !available ? "描画停止" : renderOnly ? "描画のみ・力学停止" : statuses[next.status];
  el("status").dataset.state = next.status;
  el("counts").textContent = `${next.nodes.length} nodes · ${next.groups.length} groups · ${next.links.length} links`;
  el("metrics").textContent = `step ${next.steps} · Δ ${next.maxMove.toFixed(2)} · violations ${next.violations} · ${lastStepMs.toFixed(1)} ms/step · ${lastRenderMs.toFixed(1)} ms/描画送信`;
  el<HTMLButtonElement>("pause").disabled = renderOnly || !available || next.status !== "running";
  fixture.disabled = !available;
  for (const id of ["reheat", "reset", "defaults", "mode"]) el<HTMLButtonElement>(id).disabled = renderOnly || !available;
  const key = JSON.stringify(next.nodes.map(n => [n.id, n.label]));
  if (key !== pickerKey) {
    picker.replaceChildren(new Option("ノードを選択", ""), ...next.nodes.map(n => new Option(n.label, n.id)));
    pickerKey = key;
  }
  picker.value = selected || "";
  const n = next.nodes.find(n => n.id === selected);
  el("selection").hidden = !n;
  if (n) {
    el("selected-label").textContent = n.label;
    el<HTMLButtonElement>("collapse").disabled = renderOnly || !available || !graph.nodes.some(child => child.parentId === n.id);
    el("collapse").textContent = n.collapsed ? "子孫を展開" : "子孫を畳む";
    el<HTMLButtonElement>("pin").disabled = renderOnly || !available;
    el("pin").textContent = n.pinned ? "固定解除" : "固定";
  }
  for (const key of Object.keys(FORCE_DEFAULTS) as (keyof ForceParameters)[]) {
    el<HTMLInputElement>(key).disabled = renderOnly || !available;
    el<HTMLInputElement>(key).value = String(next.parameters[key]);
    document.querySelector(`output[for="${key}"]`)!.textContent = String(next.parameters[key]);
  }
}
function frame(time: number): void {
  raf = 0;
  if (document.hidden || !available || renderOnly) return;
  accumulator += previousTime ? Math.min(64, time - previousTime) : 1000 / 60;
  previousTime = time;
  while (accumulator >= 1000 / 60 && snapshot.status === "running") {
    const start = performance.now(); snapshot = simulation.step(); lastStepMs = performance.now() - start;
    accumulator -= 1000 / 60;
  }
  render(snapshot);
  if (snapshot.status === "running" && available) raf = requestAnimationFrame(frame);
}
function wake(): void {
  render();
  if (!raf && !renderOnly && available && snapshot.status === "running" && !document.hidden) {
    previousTime = 0; accumulator = 0; raf = requestAnimationFrame(frame);
  }
}
function tuning(open: boolean): void { el("tuning").hidden = !open; el("tune-toggle").setAttribute("aria-expanded", String(open)); }
function collapse(): void {
  if (!selected || renderOnly || !available || el<HTMLButtonElement>("collapse").disabled) return;
  simulation.setCollapsed(selected, !snapshot.nodes.find(n => n.id === selected)!.collapsed); wake();
}
function pin(): void {
  if (!selected || renderOnly || !available) return;
  simulation.setPinned(selected, !snapshot.nodes.find(n => n.id === selected)!.pinned); wake();
}
el("tune-toggle").onclick = () => tuning(el("tuning").hidden);
el("close-tuning").onclick = () => tuning(false);
el("pause").onclick = () => { simulation.pause(); stopFrame(); render(); };
el("reheat").onclick = () => { simulation.reheat(); wake(); };
el("fit").onclick = fit;
el("reset").onclick = () => { endPointer(); simulation.resetPositions(); selected = null; render(simulation.step()); fit(); wake(); };
el("defaults").onclick = () => { simulation.setParameters({ ...FORCE_DEFAULTS }); wake(); };
el("clear-selection").onclick = () => { selected = null; render(); };
el("collapse").onclick = collapse; el("pin").onclick = pin;
picker.onchange = () => { selected = picker.value || null; render(); };
for (const key of Object.keys(FORCE_DEFAULTS) as (keyof ForceParameters)[]) {
  el<HTMLInputElement>(key).oninput = () => { simulation.setParameters({ [key]: Number(el<HTMLInputElement>(key).value) }); wake(); };
}
fixture.onchange = () => {
  endPointer(); stopFrame(); graph = forceFixture(fixture.value); renderOnly = fixture.value === "render-2000"; selected = null; lastStepMs = 0;
  if (renderOnly) {
    // Isolate rendering cost: never construct or step the quadratic force solver for this fixture.
    snapshot = { nodes: graph.nodes.map(n => ({ ...n, collapsed: false, hiddenCount: 0 })), groups: [],
      links: graph.links.map(e => ({ ...e, kind: "graph", weight: 1 })), mode: mode.value as ForceMode,
      parameters: { ...FORCE_DEFAULTS }, status: "paused", steps: 0, remaining: 0, maxMove: 0, violations: 0 };
  } else { simulation = createOtForce(graph, mode.value as ForceMode); snapshot = simulation.step(); }
  render(snapshot); fit(); if (!renderOnly) wake();
};
mode.onchange = () => { endPointer(); simulation.setMode(mode.value as ForceMode); wake(); };
surface.addEventListener("keydown", ((event: KeyboardEvent) => {
  if (["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) {
    event.preventDefault(); const n = snapshot.nodes.length; if (!n) return;
    const index = snapshot.nodes.findIndex(n => n.id === selected), delta = ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1;
    selected = snapshot.nodes[index < 0 ? (delta > 0 ? 0 : n - 1) : (index + delta + n) % n].id; render();
  } else if (event.key.toLowerCase() === "c") { event.preventDefault(); collapse(); }
  else if (event.key.toLowerCase() === "p") { event.preventDefault(); pin(); }
  else if (event.key === "Escape") { selected = null; render(); }
}) as EventListener);
surface.addEventListener("pointerdown", ((event: PointerEvent) => {
  if (event.button !== 0 || !available) return;
  event.preventDefault(); surface.focus();
  const b = surface.getBoundingClientRect();
  const world = { x: camera.x + (event.clientX - b.left - b.width / 2) / camera.scale,
    y: camera.y + (event.clientY - b.top - b.height / 2) / camera.scale };
  const nodeId = hitTestNodes(scene.nodes, world), groupId = nodeId ? null : hitForceGroupHeader(snapshot, world);
  const id = nodeId || groupId || undefined;
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY,
    kind: groupId ? "group" : nodeId ? "node" : "pan", nodeId: renderOnly ? undefined : id, moved: false };
  surface.setPointerCapture(event.pointerId);
  if (id) { selected = id; render(); }
}) as EventListener);
surface.addEventListener("pointermove", ((event: PointerEvent) => {
  if (!pointer || pointer.id !== event.pointerId || !available) return;
  const dx = (event.clientX - pointer.x) / camera.scale, dy = (event.clientY - pointer.y) / camera.scale;
  if (!pointer.moved && Math.hypot(dx, dy) * camera.scale < 3) return;
  if (!pointer.moved && pointer.nodeId) simulation.beginDrag(pointer.nodeId, pointer.kind === "group");
  pointer.moved = true;
  if (pointer.nodeId) { simulation.moveDrag(dx, dy); wake(); }
  else { camera.x -= dx; camera.y -= dy; updateCamera(); }
  pointer.x = event.clientX; pointer.y = event.clientY;
}) as EventListener);
function endPointer(): void {
  const ended = pointer; pointer = null;
  if (ended && surface.hasPointerCapture(ended.id)) surface.releasePointerCapture(ended.id);
  if (ended?.nodeId && ended.moved) { simulation.endDrag(); wake(); }
}
surface.addEventListener("pointerup", endPointer);
surface.addEventListener("pointercancel", endPointer);
surface.addEventListener("lostpointercapture", endPointer);
surface.addEventListener("wheel", ((event: WheelEvent) => {
  event.preventDefault();
  const b = surface.getBoundingClientRect(), px = event.clientX - b.left - b.width / 2, py = event.clientY - b.top - b.height / 2;
  const next = Math.max(.02, Math.min(4, camera.scale * Math.exp(-event.deltaY * .001)));
  camera.x += px / camera.scale - px / next; camera.y += py / camera.scale - py / next; camera.scale = next; updateCamera();
}) as EventListener, { passive: false });
new ResizeObserver(() => { projection?.resize(); updateCamera(); }).observe(el("canvas-host"));
document.addEventListener("visibilitychange", () => { if (document.hidden) { endPointer(); stopFrame(); } else wake(); });
window.addEventListener("pagehide", () => { stopFrame(); projection?.destroy(); });
// Read-only acceptance diagnostics; mutations go through the visible UI.
Object.assign(window, { forceLab: { snapshot: () => structuredClone(readSnapshot()), camera: () => ({ ...camera }),
  pendingFrame: () => Boolean(raf), renderSnapshot: () => structuredClone(scene),
  renderer: () => ({ kind: rendererKind, available, renderOnly, lastRenderMs, ...projection?.getDebugState(), ...svgRenderer?.getDebugState() }) } });
el("renderer-status").textContent = rendererKind === "webgl" ? "WebGL2" : "SVG・比較用";
projection?.mount();
if (available) render(simulation.step()); else render();
fit(); wake();

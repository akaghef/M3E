import type { AppState } from "../shared/types";
import type { LayoutResult, LayoutNodePosition } from "../shared/layout_port";
import { projectOrreryMap, type OrreryMapProjection } from "../shared/orrery_map";
import { validateOrrerySnapshot } from "../shared/orrery_observation";
import type { OrrerySnapshot } from "../shared/orrery_seam_interface";
import { renderAgentCard } from "../shared/agent_card";
import { createOtForce } from "../shared/ot_force";
import type { ForceSimulation, ForceParameters } from "../shared/force_seam_interface";

interface NetworkHost {
  board: HTMLElement;
  canvas: SVGSVGElement;
  toolbar: HTMLElement | null;
  render(): void;
  fit(): void;
  point(x: number, y: number): { x: number; y: number };
}
const escape = (value: string): string => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));

/** Runtime-only owner: never receives persistence, authoring commands, or undo access. */
export class OrreryNetwork {
  enabled = false;
  private snapshot: OrrerySnapshot | null = null;
  private projection: OrreryMapProjection | null = null;
  private simulation: ForceSimulation | null = null;
  private positions = new Map<string, { x: number; y: number; pinned: boolean }>();
  private signature = "";
  private selected: string | null = null;
  private drag: { pointer: number; x: number; y: number } | null = null;
  private frame = 0;
  private stream: EventSource | null = null;
  private abort: AbortController | null = null;
  private generation = 0;
  private pending: OrrerySnapshot | null = null;
  private transport = "disabled";
  private parameters: Partial<ForceParameters> = {};
  private readonly toggle = document.createElement("button");
  private readonly panel = document.createElement("aside");
  private readonly status = document.createElement("span");
  private readonly detail = document.createElement("pre");
  private readonly tune = document.createElement("details");

  constructor(private readonly host: NetworkHost) {
    this.toggle.id = "orrery-network-toggle";
    this.toggle.textContent = "NETWORK";
    this.toggle.type = "button";
    this.toggle.className = "wb-pill";
    this.toggle.setAttribute("aria-pressed", "false");
    this.toggle.addEventListener("click", () => this.setEnabled(!this.enabled));
    const mountToggle = (): void => {
      const slot = document.getElementById("orrery-network-control-slot");
      (slot ?? host.toolbar ?? host.board.parentElement)?.append(this.toggle);
    };
    window.addEventListener("m3e:orrery-control-slot-ready", mountToggle);
    mountToggle();
    this.panel.id = "orrery-network-panel";
    this.panel.hidden = true;
    this.panel.setAttribute("aria-label", "NETWORK runtime observation");
    this.status.id = "orrery-network-status";
    this.status.setAttribute("role", "status");
    this.detail.id = "orrery-network-detail";
    const close = document.createElement("button");
    close.textContent = "Clear runtime selection";
    close.addEventListener("click", () => { this.selected = null; this.updateDetail(); host.render(); });
    const unavailable = document.createElement("button");
    unavailable.textContent = "Send instruction — unavailable";
    unavailable.disabled = true;
    unavailable.title = "No owner command adapter is configured. No instruction has been sent.";
    const summary = document.createElement("summary");
    summary.textContent = "Tune runtime force";
    this.tune.append(summary);
    for (const [key, min, max, value] of [["repulsion", 200, 20000, 2600], ["length", 40, 400, 110]] as const) {
      const label = document.createElement("label");
      label.textContent = `${key} `;
      const input = document.createElement("input");
      input.type = "range"; input.min = String(min); input.max = String(max); input.value = String(value);
      input.setAttribute("aria-label", `NETWORK ${key}`);
      input.addEventListener("input", () => {
        this.parameters[key] = Number(input.value);
        this.simulation?.setParameters(this.parameters); this.wake();
      });
      label.append(input); this.tune.append(label);
    }
    const reheat = document.createElement("button");
    reheat.textContent = "Reheat";
    reheat.addEventListener("click", () => { this.simulation?.reheat(); this.wake(); });
    const pause = document.createElement("button");
    pause.textContent = "Pause";
    pause.addEventListener("click", () => { this.simulation?.pause(); this.stopFrame(); });
    this.tune.append(reheat, pause);
    const fit = document.createElement("button");
    fit.textContent = "Fit map + NETWORK";
    fit.addEventListener("click", () => host.fit());
    this.panel.append(this.status, this.tune, fit, close, unavailable, this.detail);
    document.body.append(this.panel);
    const style = document.createElement("style");
    style.textContent = `
      #orrery-network-toggle{min-height:32px;padding:0 10px;border-radius:7px;font-weight:650}
      #orrery-network-toggle[aria-pressed="true"]{background:#e9ddff;color:#6d31f5}
      #orrery-network-panel{position:fixed;right:16px;bottom:36px;width:min(360px,45vw);max-height:55vh;overflow:auto;background:var(--panel-bg,#fff);color:var(--text-color,#243044);border:1px solid #8494ab;border-radius:10px;padding:12px;z-index:45;font:12px system-ui;box-shadow:0 4px 18px #0002}
      #orrery-network-panel[hidden]{display:none} #orrery-network-panel pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px system-ui} #orrery-network-panel label{display:block} #orrery-network-panel button{margin:5px 4px 5px 0} #orrery-network-status{display:block;font-weight:650}
      [data-orrery-node-id]{cursor:grab;--agent-color:#8297b3;--agent-color-ink:#425979;--agent-awaiting:#e5b91f}
      [data-orrery-node-id].orrery-selected{filter:drop-shadow(0 0 4px #3c8dff)}
      [data-orrery-node-id] .agent-card-outer{fill:#fff;stroke:var(--agent-color);stroke-width:2}
      [data-orrery-node-id] .agent-card-attention{stroke:#e5b91f;stroke-width:3}
      [data-orrery-node-id] .agent-card-surface{fill:#f8fafc;stroke:#9aa9bc}
      [data-orrery-node-id] text{fill:#243044;font-family:system-ui}
      [data-orrery-node-id] .agent-card-rule{stroke:#9aa9bc}
      [data-orrery-node-id] .agent-card-pet-placeholder{fill:#e8edf5;stroke:#9aa9bc}
      [data-orrery-node-id] .agent-card-semantic-dot{fill:#8297b3}
    `;
    document.head.append(style);
    // Capture before legacy authoring listeners. The runtime owner never hands its IDs to them.
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "click", "dblclick", "contextmenu"] as const) {
      host.board.addEventListener(type, event => this.pointer(event), true);
    }
    for (const type of ["click", "input", "change", "beforeinput"] as const) {
      document.addEventListener(type, event => {
        if (!this.enabled || !this.selected || !(event.target instanceof Element)) return;
        const target = event.target;
        if (target.closest("#orrery-network-panel,#orrery-network-toggle,.export-wrap,#scatter-normal,#draw-select")) return;
        if (!target.closest('[data-edit-only], [data-pn-mode="active-node"], #v4-add-sticky-btn, #v4-add-decision-btn, #v4-create-draft-btn, #v4-apply-draft-btn, #linear-apply, #linear-text')) return;
        event.preventDefault(); event.stopImmediatePropagation();
        this.status.textContent = "NETWORK · read-only runtime selection — select an authoring node to edit";
      }, true);
    }
    for (const type of ["m3e:ai-append-topics", "m3e:ai-detail-active-node", "m3e:rapid-action-generate"]) {
      window.addEventListener(type, event => {
        if (!this.enabled || !this.selected) return;
        event.preventDefault(); event.stopImmediatePropagation();
        this.status.textContent = "NETWORK · read-only runtime selection — select an authoring node to edit";
      }, true);
    }
    document.addEventListener("keydown", event => {
      if (!this.enabled || !this.selected || (event.target instanceof Element && event.target.closest("input,textarea,[contenteditable=true]"))) return;
      // Preserve browser-owned shortcuts; runtime selection has no authoring command target.
      if ((event.metaKey || event.ctrlKey) && ["l", "r", "t", "n", "w", "f", "p", "s", "+", "-", "=", "0"].includes(event.key.toLowerCase())) return;
      if (["F5", "F11", "F12", "-", "=", "+", "0", "[", "]"].includes(event.key)) return;
      if (event.altKey && event.key.toLowerCase() === "v") { event.preventDefault(); event.stopImmediatePropagation(); host.fit(); return; }
      if (event.key === "Escape") { this.selected = null; this.updateDetail(); host.render(); }
      event.preventDefault(); event.stopImmediatePropagation();
    }, true);
    window.addEventListener("pagehide", () => this.disconnect());
    if (new URLSearchParams(location.search).get("network") === "1") this.setEnabled(true);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.toggle.setAttribute("aria-pressed", String(enabled));
    this.panel.hidden = !enabled;
    this.disconnect();
    this.projection = null; this.signature = ""; this.simulation = null; this.selected = null;
    if (enabled) {
      const generation = this.generation;
      this.transport = "connecting";
      this.abort = new AbortController();
      void fetch("/api/orrery/runtime", { signal: this.abort.signal }).then(response => {
        if (!response.ok) throw new Error("runtime_unavailable");
        return response.json();
      }).then(snapshot => { if (this.enabled && generation === this.generation) this.accept(snapshot); }).catch(() => {
        if (this.enabled && generation === this.generation) { this.transport = "unobservable"; this.updateDetail(); }
      });
      this.stream = new EventSource("/api/orrery/events");
      this.stream.addEventListener("snapshot", event => {
        if (generation !== this.generation) return;
        try { this.accept(JSON.parse((event as MessageEvent).data)); }
        catch { this.transport = "invalid observation — last valid state retained"; this.updateDetail(); }
      });
      this.stream.onerror = () => { if (generation === this.generation) { this.transport = "disconnected — last observation retained"; this.updateDetail(); } };
    }
    this.updateDetail();
    // Construction can precede the Viewer's remaining state initialization.
    queueMicrotask(() => this.host.render());
  }

  private disconnect(): void {
    this.generation++; this.abort?.abort(); this.abort = null; this.pending = null;
    this.stream?.close(); this.stream = null; this.stopFrame();
    if (this.drag) this.endDrag();
  }

  private accept(raw: unknown): void {
    const next = validateOrrerySnapshot(raw);
    const newestAt = Math.max(
      this.snapshot ? Date.parse(this.snapshot.generatedAt) : -Infinity,
      this.pending ? Date.parse(this.pending.generatedAt) : -Infinity,
    );
    if (Date.parse(next.generatedAt) < newestAt) return;
    if (this.drag) { this.pending = next; return; }
    this.snapshot = next;
    this.transport = next.sources.map(source => `${source.hostId}: ${source.state}`).join(" · ") || "no observation source";
    this.host.render(); this.updateDetail();
  }

  readView(authoring: AppState): AppState {
    if (!this.enabled || !this.snapshot) { this.projection = null; return authoring; }
    try {
      this.projection = projectOrreryMap(authoring, this.snapshot);
      if (this.selected && !this.isRuntimeNode(this.selected) && !this.isRuntimeLink(this.selected)) this.selected = null;
      return this.projection.state;
    } catch {
      this.projection = null; this.transport = "projection unavailable — authoring retained";
      this.stopFrame(); this.updateDetail(); return authoring;
    }
  }
  isRuntimeNode(id: string): boolean { return Boolean(this.projection?.actorByNodeId[id]); }
  isRuntimeLink(id: string): boolean { return Boolean(this.projection?.relationByLinkId[id]); }
  get runtimeNodeIds(): readonly string[] { return this.projection?.runtimeNodeIds ?? []; }

  /** Compose a read-only layout; authoring coordinates remain pinned and never written back. */
  extendLayout(base: LayoutResult): LayoutResult {
    if (!this.enabled || !this.projection?.runtimeNodeIds.length) {
      this.stopFrame(); this.simulation = null; this.signature = ""; return base;
    }
    const ids = this.projection.runtimeNodeIds;
    const signature = JSON.stringify([ids, Object.entries(this.projection.state.links ?? {}).map(([id, link]) => [id, link.sourceNodeId, link.targetNodeId]), base.order.map(id => [id, base.pos[id]?.x, base.pos[id]?.y])]);
    if (signature !== this.signature) {
      this.signature = signature;
      const nodes = base.order.filter(id => base.pos[id]).map(id => {
        const p = base.pos[id];
        return { id, label: id, x: p.x + p.w / 2, y: p.y, w: Math.max(1, p.w), h: Math.max(1, p.h), pinned: true };
      });
      ids.forEach((id, i) => {
        const saved = this.positions.get(id);
        nodes.push({ id, label: this.projection!.actorByNodeId[id].name, x: saved?.x ?? Math.max(280, base.totalWidth + 200) + (i % 3) * 340, y: saved?.y ?? 160 + Math.floor(i / 3) * 200, w: 320, h: 160, pinned: saved?.pinned ?? false });
      });
      const links = Object.entries(this.projection.state.links ?? {}).filter(([, link]) => nodes.some(n => n.id === link.sourceNodeId) && nodes.some(n => n.id === link.targetNodeId)).map(([id, link]) => ({ id, source: link.sourceNodeId, target: link.targetNodeId }));
      this.simulation = createOtForce({ nodes, links });
      this.simulation.setParameters(this.parameters); this.wake();
    }
    const result: LayoutResult = { ...base, pos: { ...base.pos }, order: [...base.order, ...ids] };
    for (const node of this.simulation!.snapshot().nodes) {
      if (!this.isRuntimeNode(node.id)) continue;
      result.pos[node.id] = { x: node.x - node.w / 2, y: node.y, w: node.w, h: node.h, depth: 1 };
      result.totalWidth = Math.max(result.totalWidth, node.x + node.w / 2 + 80);
      result.totalHeight = Math.max(result.totalHeight, node.y + node.h / 2 + 80);
    }
    return result;
  }

  drawCard(id: string, position: LayoutNodePosition): string | null {
    const actor = this.projection?.actorByNodeId[id];
    if (!actor) return null;
    const output = renderAgentCard({ card: {
      id, agentKind: actor.kind, icon: "", realm: actor.provenance.hostId, name: actor.name,
      title: actor.title ?? "", message: actor.message ?? "", model: actor.model ?? actor.backend,
      lifecycleState: actor.observationState === "unobservable" ? "unobservable" : actor.lifecycleState,
      lastActiveAt: actor.lastActiveAt, attention: Boolean(this.snapshot?.attention.some(a => a.actorId === actor.id && a.state === "open")), actorCount: 1,
    }, width: position.w, lod: "near", displayAt: this.snapshot!.generatedAt });
    return `<g data-node-id="${escape(id)}" data-orrery-node-id="${escape(id)}" class="orrery-runtime-card${this.selected === id ? " orrery-selected" : ""}" transform="translate(${position.x},${position.y - position.h / 2})"><title>${escape(`${actor.name}\n${actor.title ?? ""}\n${actor.message ?? ""}\n${actor.rawState}\n${actor.provenance.hostId}`)}</title>${output.svg}</g>`;
  }

  private pointer(event: Event): void {
    if (!this.enabled) return;
    const target = event.target instanceof Element ? event.target : null;
    const id = target?.closest("[data-orrery-node-id]")?.getAttribute("data-orrery-node-id");
    const link = target?.closest("[data-link-id]")?.getAttribute("data-link-id");
    if (!id && !(link && this.isRuntimeLink(link)) && !this.drag) {
      if (event.type === "pointerdown" && this.selected) { this.selected = null; this.updateDetail(); }
      return;
    }
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.type === "pointerdown") {
      const pointer = event as PointerEvent;
      this.selected = id ?? link ?? null; this.updateDetail();
      if (id && pointer.button === 0 && this.simulation) {
        const p = this.host.point(pointer.clientX, pointer.clientY);
        this.simulation.beginDrag(id); this.drag = { pointer: pointer.pointerId, ...p };
        this.host.board.setPointerCapture(pointer.pointerId);
      }
      this.host.render();
    } else if (event.type === "pointermove" && this.drag) {
      const pointer = event as PointerEvent;
      if (pointer.pointerId !== this.drag.pointer) return;
      const p = this.host.point(pointer.clientX, pointer.clientY);
      this.simulation?.moveDrag(p.x - this.drag.x, p.y - this.drag.y);
      this.drag.x = p.x; this.drag.y = p.y;
      this.remember(); this.host.render();
    } else if ((event.type === "pointerup" || event.type === "pointercancel") && this.drag) {
      this.endDrag(); this.wake();
    }
  }
  private endDrag(): void {
    if (!this.drag) return;
    if (this.host.board.hasPointerCapture(this.drag.pointer)) this.host.board.releasePointerCapture(this.drag.pointer);
    this.simulation?.endDrag();
    if (this.selected && this.isRuntimeNode(this.selected)) this.simulation?.setPinned(this.selected, true);
    this.drag = null; this.remember();
    if (this.pending && this.enabled) { const pending = this.pending; this.pending = null; this.accept(pending); }
  }
  private remember(): void {
    for (const node of this.simulation?.snapshot().nodes ?? []) if (this.isRuntimeNode(node.id)) this.positions.set(node.id, { x: node.x, y: node.y, pinned: Boolean(node.pinned) });
  }
  private stopFrame(): void { if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0; }
  private wake(): void {
    if (this.frame || !this.enabled) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (!this.enabled || !this.simulation || this.drag) return;
      const state = this.simulation.step(); this.panel.dataset.forceStatus = state.status; this.remember(); this.host.render();
      if (state.status === "running") this.wake();
    });
  }
  private updateDetail(): void {
    this.status.textContent = `NETWORK · ${this.transport}`;
    const actor = this.projection?.actorByNodeId[this.selected ?? ""];
    const relation = this.projection?.relationByLinkId[this.selected ?? ""];
    if (actor) {
      const attention = this.snapshot?.attention.filter(a => a.actorId === actor.id && a.state === "open") ?? [];
      this.detail.textContent = [`${actor.name} (${actor.kind === "human" ? "human" : "AI agent"})`, actor.title, actor.message, `State: ${actor.lifecycleState ?? "unknown"} · raw: ${actor.rawState}`, `Observation: ${actor.observationState}`, `Source: ${actor.provenance.sourceId} / ${actor.provenance.hostId}`, `Identity: ${actor.externalId}`, `Observed: ${actor.provenance.observedAt}`, ...attention.map(a => `Attention: ${a.text}`), "Runtime observation — read only. Drag pins this runtime card for this page session."].filter(Boolean).join("\n\n");
    } else if (relation) {
      const evidence = this.snapshot?.evidence.filter(e => relation.evidenceIds.includes(e.id)) ?? [];
      this.detail.textContent = [`Relation: ${relation.type}`, `Source: ${relation.provenance.sourceId} / ${relation.provenance.hostId}`, ...evidence.map(e => `${e.sentAt} · ${e.deliveryState ?? "unknown delivery"}\n${e.subject ?? ""}\n${e.body ?? ""}\nEvidence: ${e.id}`), evidence.length ? "Delivery evidence is not verified completion." : "No transport evidence is available."].join("\n\n");
    } else this.detail.textContent = "Select a runtime card or relation for observation and evidence. Authoring content remains independently editable.";
  }
}

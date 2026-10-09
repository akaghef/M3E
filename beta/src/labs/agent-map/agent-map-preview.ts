import type { AppState } from "../../shared/types";
import type { LayoutNodePosition, LayoutResult } from "../../shared/layout_port";
import { AGENT_LIFECYCLE_STATES, renderAgentCard, type AgentCardData, type AgentCardLod, type AgentSemanticColor } from "../node/agent_node";
import { initialLifecycleAnimationMapping, resolvePetSprite } from "../node/pet_catalog";
import example from "../node/fixtures/current-session.json";
import "./agent-map-preview.css";

interface PreviewHost {
  board: HTMLElement;
  canvas: SVGSVGElement;
  render(): void;
  fit(): void;
  point(x: number, y: number): { x: number; y: number };
  zoom(): number;
}
const escape = (text: string): string => text.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));

/** Frontend-only materialization on the normal Viewer canvas. No persistence or transport. */
export class AgentNodeMapPreview {
  readonly enabled = true;
  readonly runtimeNodeIds: string[];
  private readonly cards: Map<string, AgentCardData>;
  private readonly positions = new Map<string, { x: number; y: number }>();
  private selected: string | null = null;
  private drag: { pointer: number; id: string; x: number; y: number } | null = null;
  private lod: AgentCardLod = "near";
  private mode: AgentCardLod | "auto" = "auto";
  private animate = true;
  private readonly displayAt = new Date().toISOString();
  private readonly zoomLabel = document.createElement("output");
  private readonly abort = new AbortController();

  constructor(private readonly host: PreviewHost) {
    this.cards = new Map(AGENT_LIFECYCLE_STATES.map((state, index) => {
      const id = `${example.id}-${state}`;
      const card: AgentCardData = { ...example, id, agentKind: "ai", actorCount: 1,
        name: `Agent ${String(index + 1).padStart(2, "0")}`, lifecycleState: state,
        lastActiveAt: new Date(Date.parse(this.displayAt) - (index + 1) * 180000).toISOString(),
        semanticColor: ({ "awaiting-user": "awaiting", blocked: "stalled", completed: "done", failed: "error", disconnected: "archived", unobservable: "unset" } as Partial<Record<string, AgentSemanticColor>>)[state] ?? "normal",
      };
      return [id, card];
    }));
    this.runtimeNodeIds = [...this.cards.keys()];
    this.resetPositions();
    document.body.classList.add("agent-map-preview");
    const banner = document.getElementById("readonly-banner");
    if (banner) banner.textContent = "Agent nodes · サンプルデータ · 配置はこの画面だけに保持";
    const bar = document.createElement("nav");
    bar.className = "agent-map-controls";
    bar.setAttribute("aria-label", "Agent node map controls");
    bar.innerHTML = `<a href="/src/labs/index.html">M3E Seam Labs</a><a href="/src/labs/node/node-lab.html">Agent node Lab</a><strong>Agent nodes</strong><label>表示 <select aria-label="Agent node display"><option value="auto">ズームに連動</option><option>near</option><option>middle</option><option>far</option></select></label><button type="button" data-action="fit">全体表示</button><button type="button" data-action="reset">配置を戻す</button><label><input type="checkbox" checked aria-label="Icon animation"> 動画</label>`;
    bar.append(this.zoomLabel);
    document.body.append(bar);
    bar.querySelector("select")!.addEventListener("change", event => {
      this.mode = (event.target as HTMLSelectElement).value as typeof this.mode;
      this.updateLod(); this.host.render();
    }, { signal: this.abort.signal });
    bar.querySelector('[data-action="fit"]')!.addEventListener("click", () => host.fit(), { signal: this.abort.signal });
    bar.querySelector('[data-action="reset"]')!.addEventListener("click", () => { this.resetPositions(); host.render(); host.fit(); }, { signal: this.abort.signal });
    bar.querySelector("input")!.addEventListener("change", event => {
      this.animate = (event.target as HTMLInputElement).checked; host.render();
    }, { signal: this.abort.signal });
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "click", "dblclick", "contextmenu"] as const) {
      host.board.addEventListener(type, event => this.pointer(event), { capture: true, signal: this.abort.signal });
    }
    document.addEventListener("keydown", event => {
      if (event.target instanceof Element && event.target.closest("input,select,textarea,[contenteditable=true]")) return;
      if (event.key === "Escape") { this.selected = null; host.render(); }
    }, { signal: this.abort.signal });
    window.addEventListener("m3e:viewport-changed", () => {
      if (this.updateLod()) host.render();
    }, { signal: this.abort.signal });
    window.addEventListener("pagehide", () => this.abort.abort(), { once: true });
    this.updateLod();
  }

  private updateLod(): boolean {
    const zoom = this.host.zoom();
    const next = this.mode === "auto" ? (zoom < .4 ? "far" : zoom < .8 ? "middle" : "near") : this.mode;
    this.zoomLabel.value = `${Math.round(zoom * 100)}% · ${next}`;
    const changed = next !== this.lod;
    this.lod = next;
    return changed;
  }
  private resetPositions(): void {
    this.runtimeNodeIds.forEach((id, index) => this.positions.set(id, { x: 100 + (index % 3) * 370, y: 170 + Math.floor(index / 3) * 175 }));
  }
  isRuntimeNode(id: string): boolean { return this.cards.has(id); }
  readView(authoring: AppState): AppState {
    const nodes = { ...authoring.nodes };
    for (const card of this.cards.values()) nodes[card.id] = {
      id: card.id, parentId: authoring.rootId, children: [], nodeType: "text", text: card.name!,
      collapsed: false, details: "", note: "", link: "", attributes: {},
    };
    return { ...authoring, nodes };
  }
  extendLayout(_base: LayoutResult): LayoutResult {
    const result: LayoutResult = { order: [...this.runtimeNodeIds], pos: {}, totalWidth: 0, totalHeight: 0 };
    for (const [id, point] of this.positions) {
      // Stable near-sized slots prevent fit <-> LOD oscillation; only glyph detail changes.
      result.pos[id] = { ...point, w: 320, h: 128, depth: 1 };
      result.totalWidth = Math.max(result.totalWidth, point.x + 360);
      result.totalHeight = Math.max(result.totalHeight, point.y + 110);
    }
    return result;
  }
  drawCard(id: string, position: LayoutNodePosition): string | null {
    const card = this.cards.get(id);
    if (!card) return null;
    const sprite = resolvePetSprite(card.icon, card.lifecycleState, initialLifecycleAnimationMapping, this.animate);
    const output = renderAgentCard({ card, width: position.w, lod: this.lod, displayAt: this.displayAt, sprite });
    const x = position.x + (position.w - output.bounds.w) / 2;
    const y = position.y - output.bounds.h / 2;
    return `<g data-node-id="${escape(id)}" data-agent-node-id="${escape(id)}" data-lod="${this.lod}" role="button" aria-label="${escape(`${card.name}: ${card.lifecycleState}`)}" aria-pressed="${this.selected === id}" class="agent-map-node${this.selected === id ? " selected" : ""}" transform="translate(${x},${y})"><title>${escape(`${card.name}\n${card.lifecycleState}\n${card.title}`)}</title>${output.svg}</g>`;
  }
  private pointer(event: Event): void {
    const target = event.target instanceof Element ? event.target : null;
    const id = target?.closest("[data-agent-node-id]")?.getAttribute("data-agent-node-id");
    if (!id && !this.drag) {
      if (event.type === "pointerdown" && this.selected) { this.selected = null; this.host.render(); }
      return; // Empty canvas retains the Viewer's pan and zoom handling.
    }
    const pointer = event as PointerEvent;
    // Middle/right buttons retain the Viewer's canvas-pan behavior.
    if (event.type === "pointerdown" && pointer.button !== 0) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.type === "pointerdown" && id) {
      const point = this.host.point(pointer.clientX, pointer.clientY);
      this.selected = id;
      this.drag = { pointer: pointer.pointerId, id, ...point };
      this.host.board.setPointerCapture(pointer.pointerId);
      this.host.render();
    } else if (event.type === "pointermove" && this.drag && pointer.pointerId === this.drag.pointer) {
      const point = this.host.point(pointer.clientX, pointer.clientY);
      const old = this.positions.get(this.drag.id)!;
      this.positions.set(this.drag.id, { x: Math.max(0, old.x + point.x - this.drag.x), y: Math.max(70, old.y + point.y - this.drag.y) });
      this.drag.x = point.x; this.drag.y = point.y;
      this.host.render();
    } else if ((event.type === "pointerup" || event.type === "pointercancel") && this.drag && pointer.pointerId === this.drag.pointer) {
      if (this.host.board.hasPointerCapture(this.drag.pointer)) this.host.board.releasePointerCapture(this.drag.pointer);
      this.drag = null;
    }
  }
}

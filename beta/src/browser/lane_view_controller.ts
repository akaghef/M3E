import ELK from "elkjs/lib/elk-api.js";
import workerUrl from "elkjs/lib/elk-worker.min.js?url";
import { layout, type LayoutNodeMetric, type LayoutResult } from "../shared/layout_port";
import { computeLaneLayout, LaneLayoutCache } from "../shared/lane_layout";
import { laneDirection, projectLane, resolveLaneRoot, selectLaneSurface } from "../shared/lane_view";
import type { AppState, SurfaceKind } from "../shared/types";

interface LaneBridge {
  state(): AppState | null;
  scopeRoot(): string;
  view(): { surfaceViewMode: SurfaceKind; surfaceSpace: "tight" | "normal" | "loose"; surfaceLayoutDirection: string; collapsedIds: Set<string>; selectedNodeId: string };
  measure(id: string, root: string): LayoutNodeMetric;
  render(): void;
  fit(): void;
  clear(): void;
  status(text: string): void;
  apply(mode: SurfaceKind): void;
  undo(): void;
  save(): void;
  writable(): boolean;
}

/** Lane owns only its derived layout lifecycle; the viewer retains rendering. */
export class LaneViewController {
  private engine?: InstanceType<typeof ELK>;
  private state?: AppState;
  private active = false;
  private result?: LayoutResult;
  private slowTimer?: ReturnType<typeof setTimeout>;
  private cache = new LaneLayoutCache(input => {
    this.engine ??= new ELK({ workerFactory: () => new Worker(workerUrl) });
    clearTimeout(this.slowTimer);
    const timer = setTimeout(() => this.bridge.status("Lane の配置に時間がかかっています。"), 1000);
    this.slowTimer = timer;
    return computeLaneLayout(input, this.engine).finally(() => clearTimeout(timer));
  }, () => {
    this.bridge.render();
    requestAnimationFrame(() => { if (this.active && this.cache.phase === "ready") this.bridge.fit(); });
  });

  constructor(private bridge: LaneBridge) {
    window.addEventListener("m3e:lane-root", () => {
      const state = bridge.state();
      if (!state || !bridge.writable()) return;
      try {
        // Validate before adding undo history or changing persistent settings.
        resolveLaneRoot(state, bridge.scopeRoot(), { displayRootId: bridge.view().selectedNodeId } as never);
        bridge.undo();
        selectLaneSurface(state, bridge.scopeRoot(), bridge.view().selectedNodeId);
        bridge.apply("lane"); bridge.render(); bridge.save();
      } catch { bridge.status("この node を現在の scope の Lane root に指定できません。"); }
    });
    window.addEventListener("beforeunload", () => this.cancel());
    window.addEventListener("keydown", event => {
      if (this.active && this.cache.phase !== "ready" && !["Escape", "Alt", "Meta", "Control", "Shift"].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
  }

  selectSurface(mode: SurfaceKind): void {
    const state = this.bridge.state(), view = this.bridge.view();
    if (!state || (mode !== "lane" && view.surfaceViewMode !== "lane")) return;
    if (mode === "lane") selectLaneSurface(state, this.bridge.scopeRoot());
    else {
      this.cancel();
      const scope = state.scopes?.[`scope:${this.bridge.scopeRoot()}`];
      const id = `surface:${this.bridge.scopeRoot()}:${mode}`;
      if (scope && state.surfaces?.[id]) scope.primarySurfaceId = id;
    }
  }

  displayRootId(): string {
    const state = this.bridge.state();
    if (!state || this.bridge.view().surfaceViewMode !== "lane") return this.bridge.scopeRoot();
    const scope = state.scopes?.[`scope:${this.bridge.scopeRoot()}`];
    return resolveLaneRoot(state, this.bridge.scopeRoot(), state.surfaces?.[scope?.primarySurfaceId ?? ""]);
  }

  prepare(): boolean {
    const state = this.bridge.state(), view = this.bridge.view(), board = document.getElementById("board");
    if (!state || view.surfaceViewMode !== "lane") {
      if (this.active) this.cancel();
      this.state = state ?? undefined;
      if (board) delete board.dataset.laneState;
      return true;
    }
    this.active = true;
    if (this.state !== state) { this.cache.invalidate(); this.bridge.clear(); this.state = state; }
    try {
      const rootId = this.displayRootId();
      view.surfaceLayoutDirection = laneDirection(view.surfaceLayoutDirection);
      const projection = projectLane(state, rootId, view.collapsedIds);
      const metrics = Object.fromEntries([...projection.lanes.map(l => l.id), ...projection.nodeIds].map(id => [id, this.bridge.measure(id, rootId)]));
      const input = { projection, metrics, direction: laneDirection(view.surfaceLayoutDirection), space: view.surfaceSpace };
      const key = JSON.stringify(["lane-layered-v1", rootId, projection.lanes, metrics, input.direction, input.space,
        projection.links.map(l => [l.id, l.sourceNodeId, l.targetNodeId]), projection.hiddenCounts, projection.omittedLinkCount]);
      this.result = this.cache.read(key, input);
      if (board) { board.dataset.laneState = this.cache.phase; board.dataset.laneRoot = rootId; }
      if (this.result) this.bridge.status(`Lane · 表示しない GraphLink: ${projection.omittedLinkCount}`);
      else this.bridge.status("Lane を配置中");
      return Boolean(this.result);
    } catch {
      if (this.cache.phase !== "failed") {
        this.cache.invalidate(); this.result = undefined; clearTimeout(this.slowTimer);
        this.engine?.terminateWorker(); this.engine = undefined;
      }
      if (board) board.dataset.laneState = "failed";
      this.bridge.status("Lane を配置できません。root node または配置結果を確認してください。");
      return false;
    }
  }

  layout(): LayoutResult {
    return layout({ nodeIds: [], childrenOf: () => [], graphLinks: [] }, {}, "Lane", { laneResult: this.result });
  }

  private cancel(): void {
    this.active = false; this.result = undefined; this.cache.invalidate();
    clearTimeout(this.slowTimer); this.engine?.terminateWorker(); this.engine = undefined;
  }
}

import { layout, type LayoutNodeMetric, type LayoutResult } from "../shared/layout_port";
import { computeLaneLayout } from "../shared/lane_layout";
import { laneDirection, projectLane, resolveLaneRoot, selectLaneSurface } from "../shared/lane_view";
import type { AppState, SurfaceKind } from "../shared/types";

interface LaneBridge {
  state(): AppState | null;
  scopeRoot(): string;
  view(): { surfaceViewMode: SurfaceKind; surfaceSpace: "tight" | "normal" | "loose"; surfaceLayoutDirection: string; collapsedIds: Set<string>; selectedNodeId: string };
  measure(id: string, root: string): LayoutNodeMetric;
  render(): void;
  fit(): void;
  status(text: string): void;
  apply(mode: SurfaceKind): void;
  undo(): void;
  save(): void;
  writable(): boolean;
}

/** Lane owns only its synchronous projection; the viewer retains rendering. */
export class LaneViewController {
  private result?: LayoutResult;

  constructor(private bridge: LaneBridge) {
    window.addEventListener("m3e:lane-root", () => {
      const state = bridge.state();
      if (!state || !bridge.writable()) return;
      try {
        // Validate before adding undo history or changing persistent settings.
        resolveLaneRoot(state, bridge.scopeRoot(), { displayRootId: bridge.view().selectedNodeId } as never);
        bridge.undo();
        selectLaneSurface(state, bridge.scopeRoot(), bridge.view().selectedNodeId);
        bridge.apply("lane"); bridge.render(); bridge.fit(); bridge.save();
      } catch { bridge.status("この node を現在の scope の Lane root に指定できません。"); }
    });
    window.addEventListener("keydown", event => {
      if (bridge.view().surfaceViewMode === "lane" && document.getElementById("board")?.dataset.laneState === "failed" && !["Escape", "Alt", "Meta", "Control", "Shift"].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
  }

  selectSurface(mode: SurfaceKind): void {
    const state = this.bridge.state(), view = this.bridge.view();
    if (!state || (mode !== "lane" && view.surfaceViewMode !== "lane")) return;
    if (mode === "lane") selectLaneSurface(state, this.bridge.scopeRoot());
    else {
      this.result = undefined;
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
      this.result = undefined;
      if (board) { delete board.dataset.laneState; delete board.dataset.laneRoot; }
      return true;
    }
    try {
      const rootId = this.displayRootId();
      view.surfaceLayoutDirection = laneDirection(view.surfaceLayoutDirection);
      const projection = projectLane(state, rootId, view.collapsedIds);
      const metrics = Object.fromEntries([
        [rootId, this.bridge.measure(rootId, rootId)],
        ...projection.lanes.map(l => [l.id, this.bridge.measure(l.id, rootId)]),
        ...projection.nodeIds.map(id => [id, this.bridge.measure(id, rootId)]),
      ]);
      this.result = computeLaneLayout({ projection: { rootId, lanes: projection.lanes }, metrics,
        direction: laneDirection(view.surfaceLayoutDirection), space: view.surfaceSpace });
      this.result.lane!.rootLabel = state.nodes[rootId].text || "名称未設定";
      this.result.lane!.hiddenCounts = projection.hiddenCounts;
      this.result.lane!.omittedLinkCount = projection.omittedLinkCount;
      if (board) { board.dataset.laneState = "ready"; board.dataset.laneRoot = rootId; }
      this.bridge.status(`Lane · 表示しない GraphLink: ${projection.omittedLinkCount}`);
      return true;
    } catch {
      this.result = undefined;
      if (board) board.dataset.laneState = "failed";
      this.bridge.status("Lane を配置できません。root node または配置結果を確認してください。");
      return false;
    }
  }

  layout(): LayoutResult {
    return layout({ nodeIds: [], childrenOf: () => [], graphLinks: [] }, {}, "Lane", { laneResult: this.result });
  }

}

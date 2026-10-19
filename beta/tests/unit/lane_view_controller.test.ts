// @vitest-environment jsdom
import { expect, test, vi } from "vitest";
import { LaneViewController } from "../../src/browser/lane_view_controller";
import { selectLaneSurface } from "../../src/shared/lane_view";
import type { AppState, SurfaceKind } from "../../src/shared/types";
import fixture from "../fixtures/lane_view.json";

test("synchronous Lane switches direction and map immediately, rejects invalid roots, and reuses the root action", () => {
  document.body.innerHTML = '<div id="board"></div>';
  let state = structuredClone(fixture.state) as AppState;
  state.scopes = { "scope:workspace": { id: "scope:workspace", label: "Workspace", rootNodeIds: ["workspace"], relationIds: [] } };
  selectLaneSurface(state, "workspace", "diagram");
  const view = { surfaceViewMode: "lane" as SurfaceKind, surfaceSpace: "normal" as const, surfaceLayoutDirection: "down", collapsedIds: new Set<string>(), selectedNodeId: "diagram" };
  const save = vi.fn(), fit = vi.fn(), undo = vi.fn();
  const measure = vi.fn((id: string, _root: string) => ({w: 100, h: id === "reading" ? 96 : 40, labelLines: ["wrapped", "label"]}));
  const controller = new LaneViewController({ state: () => state, scopeRoot: () => "workspace", view: () => view,
    measure, render: () => { controller.prepare(); }, fit, status: () => {},
    apply: mode => { view.surfaceViewMode = mode; }, undo, save, writable: () => true });
  const board = document.getElementById("board")!;
  expect(controller.prepare()).toBe(true); expect(board.dataset.laneState).toBe("ready");
  expect(controller.layout().pos.reading.y).toBe(controller.layout().pos.analysis.y);
  expect(measure).toHaveBeenCalledWith("reading", "diagram");
  expect(controller.layout().pos.analysis.h).toBeLessThan(controller.layout().pos.reading.h);
  expect(controller.layout().pos.reading.labelLines).toEqual(["wrapped", "label"]);
  view.surfaceLayoutDirection = "right"; expect(controller.prepare()).toBe(true);
  expect(controller.layout().pos.reading.x).toBe(controller.layout().pos.analysis.x);
  expect(measure).toHaveBeenCalledWith("reading", "diagram");
  state = structuredClone(state); state.nodes.diagram.children.reverse(); expect(controller.prepare()).toBe(true);
  expect(controller.layout().lane!.boundaries.map(b => b.id)).toEqual(["operations","development","research"]);
  state.surfaces!["surface:workspace:lane"].displayRootId = "missing";
  expect(controller.prepare()).toBe(false); expect(board.dataset.laneState).toBe("failed"); expect(() => controller.layout()).toThrow();
  view.surfaceViewMode = "tree"; expect(controller.prepare()).toBe(true); expect(board.dataset.laneState).toBeUndefined();
  window.dispatchEvent(new CustomEvent("m3e:lane-root"));
  expect(undo).toHaveBeenCalledOnce(); expect(save).toHaveBeenCalledOnce(); expect(fit).toHaveBeenCalledOnce();
  expect(view.surfaceViewMode).toBe("lane"); expect(board.dataset.laneState).toBe("ready");
  expect(state.surfaces!["surface:workspace:lane"].displayRootId).toBe("diagram");
});

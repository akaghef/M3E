// @vitest-environment jsdom
import { expect, test, vi } from "vitest";
import { LaneViewController } from "../../src/browser/lane_view_controller";
import { selectLaneSurface } from "../../src/shared/lane_view";
import type { AppState, SurfaceKind } from "../../src/shared/types";
import fixture from "../fixtures/lane_view.json";

test("synchronous Lane uses the scope root and switches direction and order immediately", () => {
  document.body.innerHTML = '<div id="board"></div>';
  let state = structuredClone(fixture.state) as AppState;
  state.scopes = { "scope:diagram": { id: "scope:diagram", label: "Project structure", rootNodeIds: ["diagram"], relationIds: [] } };
  selectLaneSurface(state, "diagram");
  const view = { surfaceViewMode: "lane" as SurfaceKind, surfaceSpace: "normal" as const, surfaceLayoutDirection: "down", collapsedIds: new Set<string>(), selectedNodeId: "diagram" };
  const measure = vi.fn((id: string, _root: string) => ({w: 100, h: id === "reading" ? 96 : 40, labelLines: ["wrapped", "label"]}));
  let root = "diagram";
  const controller = new LaneViewController({ state: () => state, scopeRoot: () => root, view: () => view,
    measure, cache: (_key, compute) => compute(), render: () => { controller.prepare(); }, fit: vi.fn(), status: () => {},
    apply: mode => { view.surfaceViewMode = mode; }, undo: vi.fn(), save: vi.fn(), writable: () => true });
  const board = document.getElementById("board")!;
  expect(controller.prepare()).toBe(true); expect(board.dataset.laneState).toBe("ready"); expect(board.dataset.laneRoot).toBe("diagram");
  expect(controller.layout().pos.reading.y).toBe(controller.layout().pos.analysis.y);
  expect(measure).toHaveBeenCalledWith("reading", "diagram");
  expect(controller.layout().pos.analysis.h).toBeLessThan(controller.layout().pos.reading.h);
  expect(controller.layout().pos.reading.labelLines).toEqual(["wrapped", "label"]);
  view.surfaceLayoutDirection = "right"; expect(controller.prepare()).toBe(true);
  expect(controller.layout().pos.reading.x).toBe(controller.layout().pos.analysis.x);
  state = structuredClone(state); state.nodes.diagram.children.reverse(); expect(controller.prepare()).toBe(true);
  expect(controller.layout().lane!.boundaries.map(b => b.id)).toEqual(["operations","development","research"]);
  root = "missing";
  expect(controller.prepare()).toBe(false); expect(board.dataset.laneState).toBe("failed"); expect(() => controller.layout()).toThrow();
  view.surfaceViewMode = "tree"; expect(controller.prepare()).toBe(true); expect(board.dataset.laneState).toBeUndefined();
});

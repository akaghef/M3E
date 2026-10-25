import { describe, expect, test } from "vitest";
import { laneGrabMove, laneNavigationTarget, type LaneGrid } from "../../src/shared/lane_navigation";

// Three lanes as drawn rows (down): AI [a1 a2 a3], Cloud [] (empty), Device [d1 d2].
const grid: LaneGrid = { rootId: "root", laneIds: ["ai", "cloud", "device"], lanes: [["a1", "a2", "a3"], [], ["d1", "d2"]] };
const row = (x: number, y: number) => ({ x, y, w: 100, h: 40 });
const down = { a1: row(0, 0), a2: row(300, 0), a3: row(600, 0), d1: row(100, 200), d2: row(500, 200) };
// The same lanes as columns (right): positions transposed.
const col = (x: number, y: number) => ({ x, y, w: 100, h: 40 });
const right = { a1: col(0, 0), a2: col(0, 300), a3: col(0, 600), d1: col(400, 100), d2: col(400, 500) };

describe("Lane arrow keys follow the drawn rows/columns", () => {
  test("down: left/right move within the lane; left past the first item reaches the lane name", () => {
    expect(laneNavigationTarget(grid, down, "a2", "down", "ArrowRight")).toBe("a3");
    expect(laneNavigationTarget(grid, down, "a2", "down", "ArrowLeft")).toBe("a1");
    expect(laneNavigationTarget(grid, down, "a3", "down", "ArrowRight")).toBeNull();
    expect(laneNavigationTarget(grid, down, "a1", "down", "ArrowLeft")).toBe("ai");
    expect(laneNavigationTarget(grid, down, "d1", "down", "ArrowLeft")).toBe("device");
  });

  test("down: up/down move to the nearest item of the next non-empty lane", () => {
    expect(laneNavigationTarget(grid, down, "a1", "down", "ArrowDown")).toBe("d1");
    expect(laneNavigationTarget(grid, down, "a3", "down", "ArrowDown")).toBe("d2");
    expect(laneNavigationTarget(grid, down, "d2", "down", "ArrowUp")).toBe("a3");
    expect(laneNavigationTarget(grid, down, "d1", "down", "ArrowDown")).toBeNull();
  });

  test("down: up from the top lane reaches its lane name, then the root", () => {
    expect(laneNavigationTarget(grid, down, "a2", "down", "ArrowUp")).toBe("ai");
    expect(laneNavigationTarget(grid, down, "ai", "down", "ArrowUp")).toBe("root");
    expect(laneNavigationTarget(grid, down, "root", "down", "ArrowUp")).toBeNull();
    expect(laneNavigationTarget(grid, down, "root", "down", "ArrowDown")).toBe("ai");
  });

  test("lane names: across moves between names, forward enters the first item", () => {
    expect(laneNavigationTarget(grid, down, "ai", "down", "ArrowDown")).toBe("cloud");
    expect(laneNavigationTarget(grid, down, "cloud", "down", "ArrowDown")).toBe("device");
    expect(laneNavigationTarget(grid, down, "device", "down", "ArrowRight")).toBe("d1");
    expect(laneNavigationTarget(grid, down, "cloud", "down", "ArrowRight")).toBeNull();
    expect(laneNavigationTarget(grid, down, "ai", "down", "ArrowLeft")).toBe("root");
  });

  test("right: the axes swap", () => {
    expect(laneNavigationTarget(grid, right, "a1", "right", "ArrowDown")).toBe("a2");
    expect(laneNavigationTarget(grid, right, "a1", "right", "ArrowRight")).toBe("d1");
    expect(laneNavigationTarget(grid, right, "d2", "right", "ArrowLeft")).toBe("a3");
    expect(laneNavigationTarget(grid, right, "d1", "right", "ArrowLeft")).toBe("a1");
    expect(laneNavigationTarget(grid, right, "a2", "right", "ArrowLeft")).toBe("ai");
    expect(laneNavigationTarget(grid, right, "ai", "right", "ArrowLeft")).toBe("root");
    expect(laneNavigationTarget(grid, right, "a1", "right", "ArrowUp")).toBe("ai");
    expect(laneNavigationTarget(grid, right, "ai", "right", "ArrowRight")).toBe("cloud");
    expect(laneNavigationTarget(grid, right, "ai", "right", "ArrowDown")).toBe("a1");
  });

  test("a node Lane does not draw starts at the first drawn grandchild", () => {
    expect(laneNavigationTarget(grid, down, "elsewhere", "down", "ArrowDown")).toBe("a1");
  });
});

describe("Lane grab-move", () => {
  test("along the lane reorders with the existing index convention", () => {
    expect(laneGrabMove(grid, down, "a1", "down", "ArrowRight")).toEqual({ parentId: "ai", index: 2 });
    expect(laneGrabMove(grid, down, "a3", "down", "ArrowLeft")).toEqual({ parentId: "ai", index: 1 });
    expect(laneGrabMove(grid, down, "a3", "down", "ArrowRight")).toBeNull();
  });

  test("across lanes moves into the adjacent lane at the nearest position", () => {
    expect(laneGrabMove(grid, down, "d2", "down", "ArrowUp")).toEqual({ parentId: "cloud", index: 0 });
    expect(laneGrabMove(grid, down, "a3", "down", "ArrowDown")).toEqual({ parentId: "cloud", index: 0 });
    expect(laneGrabMove(grid, down, "a2", "down", "ArrowUp")).toBeNull();
  });
});

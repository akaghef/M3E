import { describe, expect, test } from "vitest";
import { selectPorts, type EdgeBranchDirection, type EdgeRect, type EdgePortSide } from "../../src/shared/edge_port";

const srcRect: EdgeRect = { x: 100, y: 100, w: 80, h: 40 };
const dstRight: EdgeRect = { x: 300, y: 105, w: 90, h: 50 };
const dstLeft: EdgeRect = { x: -80, y: 105, w: 90, h: 50 };
const dstUp: EdgeRect = { x: 105, y: -100, w: 90, h: 50 };
const dstDown: EdgeRect = { x: 105, y: 260, w: 90, h: 50 };

function expectSides(direction: EdgeBranchDirection, expected: [EdgePortSide, EdgePortSide], dstRect = dstRight): void {
  const ports = selectPorts(srcRect, dstRect, direction);
  expect([ports.source.side, ports.target.side]).toEqual(expected);
}

describe("EdgePort selectPorts contract", () => {
  test("Tree direction matrix is explicit and branch-aware", () => {
    expectSides({ view: "Tree", direction: "right" }, ["right", "left"]);
    expectSides({ view: "Tree", direction: "left" }, ["left", "right"]);
    expectSides({ view: "Tree", direction: "up" }, ["top", "bottom"]);
    expectSides({ view: "Tree", direction: "down" }, ["bottom", "top"]);
    expectSides({ view: "Tree", direction: "both", branchSide: "left" }, ["left", "right"]);
    expectSides({ view: "Tree", direction: "both", branchSide: "right" }, ["right", "left"]);
  });

  test("Axial uses the primary axis rules", () => {
    expectSides({ view: "Axial", direction: "right" }, ["right", "left"]);
    expectSides({ view: "Axial", direction: "left" }, ["left", "right"]);
    expectSides({ view: "Axial", direction: "up" }, ["top", "bottom"]);
    expectSides({ view: "Axial", direction: "down" }, ["bottom", "top"]);
  });

  test("Radial, Disperse, and System free use deterministic vectors", () => {
    expectSides({ view: "Radial", direction: "balanced" }, ["right", "left"], dstRight);
    expectSides({ view: "Radial", direction: "clockwise" }, ["left", "right"], dstLeft);
    expectSides({ view: "Radial", direction: "counterclockwise" }, ["top", "bottom"], dstUp);
    expectSides({ view: "Disperse", direction: "free" }, ["bottom", "top"], dstDown);
    expectSides({ view: "System", direction: "free" }, ["right", "left"], { x: 205, y: 135, w: 90, h: 50 });
  });

  test("System fixed directions do not fall back to nearest geometry", () => {
    expectSides({ view: "System", direction: "right" }, ["right", "left"], dstDown);
    expectSides({ view: "System", direction: "down" }, ["bottom", "top"], dstRight);
  });
});


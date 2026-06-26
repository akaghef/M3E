import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { selectPorts, type EdgeBranchDirection, type EdgePortSide, type EdgeRect } from "../../src/shared/edge_port";
import { route, type EdgeRouteStyle } from "../../src/shared/edge_route";

interface EdgePortGoldenSample {
  schema_version: 1;
  sample_id: string;
  input: {
    srcRect: EdgeRect;
    dstRect: EdgeRect;
    branchDirection: EdgeBranchDirection;
    routeStyle: EdgeRouteStyle;
  };
  expected: {
    ports: { sourceSide: EdgePortSide; targetSide: EdgePortSide };
  };
}

const samples = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../fixtures/edge-port-golden/samples.json"), "utf8"),
) as EdgePortGoldenSample[];

function expectBoundary(rect: EdgeRect, side: EdgePortSide, point: { x: number; y: number }): void {
  if (side === "left") expect(point.x).toBe(rect.x);
  if (side === "right") expect(point.x).toBe(rect.x + rect.w);
  if (side === "top") expect(point.y).toBe(rect.y);
  if (side === "bottom") expect(point.y).toBe(rect.y + rect.h);
}

describe("edge-port golden parity", () => {
  test("contains the approved first-unit sample set", () => {
    expect(samples.map((sample) => sample.sample_id)).toEqual([
      "tree-right-basic",
      "tree-left-basic",
      "tree-both-left-branch",
      "tree-both-right-branch",
      "tree-up-basic",
      "tree-down-basic",
      "axial-right-sequence",
      "axial-up-sequence",
      "radial-balanced-quadrants",
      "disperse-force-vector",
      "system-right-module",
      "system-down-containment",
    ]);
  });

  test.each(samples)("$sample_id selected sides and route endpoints match", (sample) => {
    const ports = selectPorts(sample.input.srcRect, sample.input.dstRect, sample.input.branchDirection);
    expect(ports.source.side).toBe(sample.expected.ports.sourceSide);
    expect(ports.target.side).toBe(sample.expected.ports.targetSide);
    expectBoundary(sample.input.srcRect, ports.source.side, ports.source);
    expectBoundary(sample.input.dstRect, ports.target.side, ports.target);
    const pathResult = route(ports, sample.input.routeStyle);
    expect(pathResult.commands[0]).toMatchObject({ op: "M", x: ports.source.x, y: ports.source.y });
    expect(pathResult.commands[pathResult.commands.length - 1]).toMatchObject({ x: ports.target.x, y: ports.target.y });
  });
});


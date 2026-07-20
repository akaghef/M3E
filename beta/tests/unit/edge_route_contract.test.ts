import { describe, expect, test } from "vitest";
import { selectPorts } from "../../src/shared/edge_port";
import { route, type EdgeRouteStyle } from "../../src/shared/edge_route";

const styles: EdgeRouteStyle[] = ["orthogonal", "line", "curve", "force-link"];

describe("EdgeRoute route contract", () => {
  test.each(styles)("%s preserves selected port endpoints", (style) => {
    const ports = selectPorts(
      { x: 20, y: 30, w: 100, h: 60 },
      { x: 260, y: 70, w: 80, h: 50 },
      { view: "Tree", direction: "right" },
    );
    const path = route(ports, style);
    expect(path.source).toEqual(ports.source);
    expect(path.target).toEqual(ports.target);
    expect(path.commands[0]).toMatchObject({ op: "M", x: ports.source.x, y: ports.source.y });
    expect(path.commands[path.commands.length - 1]).toMatchObject({ x: ports.target.x, y: ports.target.y });
  });
});


import { describe, expect, test } from "vitest";
import type { AppState, GraphLink, TreeNode } from "../../../src/shared/types";
import {
  graphLinksToRecords,
  recordsToAppStateLinks,
  type GraphLinkRecord,
} from "../../../src/cutover/graphlink/records";

function node(id: string, parentId: string | null, children: string[]): TreeNode {
  return {
    id,
    parentId,
    children,
    text: id,
    collapsed: false,
    details: "",
    note: "",
    attributes: {},
    link: "",
  };
}

describe("GraphLink records", () => {
  test("二つの node を結ぶ GraphLink は往復し、親子 edge と混ざらない", () => {
    const graphLink: GraphLink = {
      id: "gl-depends",
      sourceNodeId: "left",
      targetNodeId: "right",
      relationType: "depends-on",
      label: "前提",
      direction: "forward",
      style: "dashed",
      color: "#336699",
      sourcePort: "right",
      targetPort: "left",
      attributes: { confidence: "CURRENT" },
    };
    const state: AppState = {
      rootId: "root",
      nodes: {
        root: node("root", null, ["left", "right"]),
        left: node("left", "root", []),
        right: node("right", "root", []),
      },
      links: { "gl-depends": graphLink },
    };

    const records = graphLinksToRecords(state.links);
    expect(records).toEqual([
      {
        linksKey: "gl-depends",
        id: "gl-depends",
        sourceNodeId: "left",
        targetNodeId: "right",
        relationType: "depends-on",
        label: "前提",
        direction: "forward",
        style: "dashed",
        color: "#336699",
        sourcePort: "right",
        targetPort: "left",
        attributes: { confidence: "CURRENT" },
      },
    ]);
    expect(records.every((record) => !("parentId" in record) && !("childId" in record) && !("children" in record))).toBe(true);
    expect(records.some((record) => record.sourceNodeId === "root" || record.targetNodeId === "root")).toBe(false);

    state.links!["gl-depends"]!.attributes!.confidence = "TO-BE";
    expect(records[0]?.attributes).toEqual({ confidence: "CURRENT" });

    const links = recordsToAppStateLinks(records);
    expect(links).toEqual({
      "gl-depends": { ...graphLink, attributes: { confidence: "CURRENT" } },
    });
    const copied = records[0]?.attributes as { confidence: string } | undefined;
    copied!.confidence = "TO-BE";
    expect(links["gl-depends"]?.attributes).toEqual({ confidence: "CURRENT" });

    const restored: AppState = { ...state, links };
    expect(restored.nodes.root?.parentId).toBeNull();
    expect(restored.nodes.root?.children).toEqual(["left", "right"]);
    expect(restored.nodes.left?.parentId).toBe("root");
    expect(restored.nodes.right?.parentId).toBe("root");
    expect(restored.nodes.left?.children).toEqual([]);
    expect(restored.nodes.right?.children).toEqual([]);
    expect(Object.values(restored.links ?? {}).map((link) => [link.sourceNodeId, link.targetNodeId])).toEqual([
      ["left", "right"],
    ]);
  });

  test("親子 edge の形は GraphLink として戻さない", () => {
    expect(graphLinksToRecords(undefined)).toEqual([]);
    expect(recordsToAppStateLinks([])).toEqual({});
    expect(() => recordsToAppStateLinks([{
      linksKey: "edge-1",
      id: "edge-1",
      parentId: "root",
      childId: "left",
    } as unknown as GraphLinkRecord])).toThrow(/sourceNodeId/);
  });
});

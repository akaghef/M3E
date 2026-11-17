// Scope as a plane (record-schema DA59): which scope each edge and node lies on. Synthetic data only.
import { describe, expect, it } from "vitest";
import { childrenOnScope, edgeOutsideFor, edgeScopeProblems, edgeScopeRootOf, isOnScope, isWithinScope, parentScopeRootOf } from "../../src/shared/scope_plane";
import { extractScopeView, scopeViewChanges } from "../../src/shared/scope_view";
import { RapidMvpModel } from "../../src/node/rapid_mvp";
import type { AppState, TreeNode } from "../../src/shared/types";

function node(id: string, parentId: string | null, children: string[] = [], more: Partial<TreeNode> = {}): TreeNode {
  return { id, parentId, children, text: id, collapsed: false, details: "", note: "", attributes: {}, link: "", ...more };
}

// root > P (scope) > X (scope) > [yp (outside X) > z, yc > w]; X sits on P's scope.
function planes(): AppState {
  return {
    rootId: "root",
    nodes: {
      root: node("root", null, ["P"]),
      P: node("P", "root", ["X"], { nodeType: "folder" }),
      X: node("X", "P", ["yp", "yc"], { nodeType: "folder" }),
      yp: node("yp", "X", ["z"], { edgeOutsideScope: true }),
      z: node("z", "yp"),
      yc: node("yc", "X", ["w"]),
      w: node("w", "yc"),
    },
  } as AppState;
}

describe("scope_plane", () => {
  it("puts each edge on one scope; a child outside its parent's scope lies where the parent lies", () => {
    const { nodes, rootId } = planes();
    expect(edgeScopeRootOf(nodes, rootId, "X")).toBe("P");
    expect(edgeScopeRootOf(nodes, rootId, "yp")).toBe("P");
    expect(edgeScopeRootOf(nodes, rootId, "z")).toBe("P");
    expect(edgeScopeRootOf(nodes, rootId, "yc")).toBe("X");
    expect(edgeScopeRootOf(nodes, rootId, "w")).toBe("X");
    expect(childrenOnScope(nodes, rootId, nodes.X!, "P")).toEqual(["yp"]);
    expect(childrenOnScope(nodes, rootId, nodes.X!, "X")).toEqual(["yc"]);
    expect(isOnScope(nodes, rootId, "X", "X")).toBe(true);
    expect(isOnScope(nodes, rootId, "X", "P")).toBe(true);
    expect(isOnScope(nodes, rootId, "z", "X")).toBe(false);
    expect(parentScopeRootOf(nodes, rootId, "X")).toBe("P");
    expect(isWithinScope(nodes, rootId, "w", "P")).toBe(true);
    expect(isWithinScope(nodes, rootId, "z", "X")).toBe(false);
    expect(isWithinScope(nodes, rootId, "z", "P")).toBe(true);
  });

  it("follows the outer scope when an ancestor is scoped: the mark is relative", () => {
    const state = planes();
    state.nodes.P!.nodeType = undefined;
    expect(edgeScopeRootOf(state.nodes, state.rootId, "yp")).toBe("root");
    expect(edgeScopeRootOf(state.nodes, state.rootId, "yc")).toBe("X");
  });

  it("names the mark a placement needs, and flags marks that make no sense", () => {
    const { nodes, rootId } = planes();
    expect(edgeOutsideFor(nodes, rootId, "X", "X")).toBe(false);
    expect(edgeOutsideFor(nodes, rootId, "X", "P")).toBe(true);
    expect(edgeOutsideFor(nodes, rootId, "X", "root")).toBe(null);
    expect(edgeScopeProblems(nodes, rootId)).toEqual([]);
    nodes.w!.edgeOutsideScope = true;
    expect(edgeScopeProblems(nodes, rootId)).toHaveLength(1);
  });

  it("the model keeps the mark on a move outside, drops it on unscopen and rejects it where it cannot apply", () => {
    const model = RapidMvpModel.fromJSON(planes());
    model.reparentNode("w", "X", null, true);
    expect(model.state.nodes.w!.edgeOutsideScope).toBe(true);
    expect(model.validate()).toEqual([]);
    expect(() => model.reparentNode("w", "yc", null, true)).toThrow(/outside/);
    model.reparentNode("w", "yc");
    expect(model.state.nodes.w!.edgeOutsideScope).toBeUndefined();
    model.setScopeBoundary("X", false);
    expect(model.state.nodes.yp!.edgeOutsideScope).toBeUndefined();
  });

  it("scope view loads the outside children with the entry, leaves them out of the inside, and refuses moves there", () => {
    const state = planes();
    const outer = extractScopeView(state, "P");
    expect(outer.state.nodes.X!.children).toEqual(["yp"]);
    expect(Object.keys(outer.state.nodes).sort()).toEqual(["P", "X", "root", "yp", "z"]);
    expect(outer.view.partialChildren).toEqual({ X: true });
    expect(outer.view.scopeDescendantCount).toBe(5); // X, yp, z, yc, w
    const inner = extractScopeView(state, "X");
    expect(inner.state.nodes.X!.children).toEqual(["yc"]);
    expect(Object.keys(inner.state.nodes).sort()).toEqual(["P", "X", "root", "w", "yc"]);
    expect(inner.view.partialChildren).toEqual({ X: true });
    const moved = scopeViewChanges(
      [{ kind: "edge", key: ["z"], op: "update", before: { parentId: "yp", index: 0 }, after: { parentId: "X", index: 1 } }],
      outer.view,
      outer.state,
      { ...outer.state, nodes: { ...outer.state.nodes, z: { ...outer.state.nodes.z!, parentId: "X" }, X: { ...outer.state.nodes.X!, children: ["yp", "z"] }, yp: { ...outer.state.nodes.yp!, children: [] } } },
    );
    expect(moved.ok).toBe(false);
  });
});

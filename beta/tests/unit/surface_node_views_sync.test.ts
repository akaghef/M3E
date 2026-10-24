import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";

// Execute the viewer's actual pre-save surface sync without booting its UI.
const source = ts.createSourceFile("viewer.ts", fs.readFileSync(path.join(__dirname, "../../src/browser/viewer.ts"), "utf8"), ts.ScriptTarget.Latest, true);
const fn = source.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === "syncMapModelStateFromRuntime");
const code = ts.transpileModule(fn!.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;

function run(state: Record<string, unknown>) {
  return new Function("state", `
    const map = { state };
    const viewState = { concretenessLevel: 0, surfaceViewMode: "tree", surfaceLayoutDirection: "right", surfaceSpace: "normal" };
    const sanitizeMapModelState = () => {};
    const currentScopeRootId = () => "root";
    const inferredScopeId = (id) => "scope:" + id;
    const surfaceKindForViewMode = () => "tree";
    const inferredSurfaceId = (scopeId, kind) => "surface:" + scopeId + ":" + kind;
    const surfaceLayoutForKind = () => "tree";
    const rawAttr = (node, key) => node.attributes?.[key];
    ${code}
    syncMapModelStateFromRuntime();
    return map.state;
  `)(state);
}

test("pre-save surface sync writes node views only for nodes that carry a value", () => {
  const nodes: Record<string, unknown> = {
    root: { id: "root", text: "Root", children: ["a", "b", "c"] },
    a: { id: "a", text: "A", parentId: "root", children: [], attributes: { "m3e:flow-col": "2", "m3e:shape": "diamond" } },
    b: { id: "b", text: "B", parentId: "root", children: [] },
    c: { id: "c", text: "C", parentId: "root", children: [] },
  };
  for (let i = 0; i < 200; i += 1) nodes[`n${i}`] = { id: `n${i}`, text: `N${i}`, parentId: "root", children: [] };
  const state = run({
    rootId: "root",
    nodes,
    scopes: { "scope:root": { id: "scope:root" } },
    surfaces: { "surface:root:tree": { id: "surface:root:tree", nodeViews: { c: { x: 10, y: 20 }, b: {} } } },
  });
  const nodeViews = (state.surfaces as Record<string, { nodeViews: Record<string, unknown> }>)["surface:root:tree"].nodeViews;
  expect(Object.keys(nodeViews).sort()).toEqual(["a", "c"]);
  expect(nodeViews.a).toEqual({ flowCol: 2, shape: "diamond" });
  expect(nodeViews.c).toEqual({ x: 10, y: 20 });
});

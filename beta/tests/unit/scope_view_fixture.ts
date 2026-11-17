// Synthetic maps for the scope view tests. No real data.
import type { AppState, TreeNode } from "../../src/shared/types";

export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function node(id: string, parentId: string | null, text: string, more: Partial<TreeNode> = {}): TreeNode {
  return { id, parentId, children: [], nodeType: "text", text, collapsed: false, details: "", note: "", attributes: {}, link: "", ...more };
}

/**
 * A random tree with scope nodes at several depths, alias nodes and GraphLinks that
 * cross scopes, and scope settings / Surface View / linear-text / annotation records.
 */
export function randomMap(seed: number, size = 160): AppState {
  const random = rng(seed);
  const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)]!;
  const nodes: Record<string, TreeNode> = { root: node("root", null, "Root") };
  const plain: string[] = ["root"];
  const scopeRoots: string[] = ["root"];
  for (let i = 0; i < size; i += 1) {
    const id = `n${i}`;
    const parentId = pick(plain);
    const isScope = random() < 0.12;
    nodes[id] = node(id, parentId, `Node ${i}`, isScope ? { nodeType: "folder" } : {});
    nodes[parentId]!.children.push(id);
    plain.push(id);
    if (isScope) scopeRoots.push(id);
  }
  const targets = plain.filter((id) => id !== "root");
  for (let i = 0; i < Math.floor(size / 12); i += 1) {
    const id = `a${i}`;
    const parentId = pick(plain);
    const targetNodeId = pick(targets);
    nodes[id] = node(id, parentId, nodes[targetNodeId]!.text, { nodeType: "alias", targetNodeId, access: "read", isBroken: false });
    nodes[parentId]!.children.push(id);
  }
  const state: AppState = { rootId: "root", nodes, links: {}, scopes: {}, surfaces: {}, linearNotesByScope: {}, annotations: {}, linearTextFontScale: 1 };
  for (let i = 0; i < Math.floor(size / 8); i += 1) {
    const sourceNodeId = pick(targets);
    const targetNodeId = pick(targets);
    if (sourceNodeId === targetNodeId) continue;
    state.links![`l${i}`] = { id: `l${i}`, sourceNodeId, targetNodeId, direction: "forward", style: "default", attributes: {} };
  }
  for (const id of scopeRoots) {
    state.scopes![`scope:${id}`] = { id: `scope:${id}`, label: nodes[id]!.text, rootNodeIds: [id], relationIds: Object.keys(state.links!), primarySurfaceId: `surface:${id}:tree` };
    state.surfaces![`surface:${id}:tree`] = {
      id: `surface:${id}:tree`, scopeId: `scope:${id}`, kind: "tree", layout: "tree",
      nodeViews: Object.fromEntries(targets.filter(() => random() < 0.1).map((nodeId) => [nodeId, { x: 1, y: 2 }])),
    };
    state.linearNotesByScope![id] = `memo of ${id}`;
    state.annotations![`an_${id}`] = { id: `an_${id}`, kind: "text", scopeId: id, x: 0, y: 0, text: "t", fill: "#000000", fontSize: 12 };
  }
  return state;
}

export function scopeRootIds(state: AppState): string[] {
  return Object.values(state.nodes).filter((item) => item.id === state.rootId || item.nodeType === "folder").map((item) => item.id);
}

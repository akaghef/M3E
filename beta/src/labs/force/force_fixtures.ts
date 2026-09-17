import type { ForceGraph, ForceNode } from "../../shared/force_seam_interface";

const node = (id: string, label: string, x: number, y: number, parentId?: string, w = 132, h = 56): ForceNode => ({ id, label, x, y, parentId, w, h });
export function forceFixture(name: string): ForceGraph {
  if (name === "blocked") return { nodes: [{ ...node("a", "固定 A", -20, 0), pinned: true }, { ...node("b", "固定 B", 20, 0), pinned: true }], links: [] };
  if (name === "hundred") {
    const nodes = Array.from({ length: 100 }, (_, i) => node(`n${i}`, `Node ${i + 1}`, (i % 10 - 4.5) * 160, (Math.floor(i / 10) - 4.5) * 105, undefined, 70 + (i % 5) * 24, 38 + (i % 3) * 14));
    return { nodes, links: nodes.slice(1).map((n, i) => ({ id: `e${i}`, source: nodes[i].id, target: n.id })) };
  }
  if (name === "flat") return {
    nodes: [node("human", "Human · Akaghef", 0, -170, undefined, 168), node("claude", "Claude", -230, 0), node("codex", "Codex", 220, 0), node("hermes", "Hermes", 0, 190)],
    links: [ { id: "a", source: "human", target: "claude" }, { id: "b", source: "claude", target: "codex" }, { id: "c", source: "codex", target: "hermes" }, { id: "d", source: "hermes", target: "human" } ],
  };
  return {
    nodes: [
      node("design", "Design", -370, -220), node("intent", "意図・受入条件", -480, -110, "design", 170),
      node("visual", "Visual", -255, -110, "design"), node("card", "Agent Card", -350, 0, "visual", 154, 76),
      node("panel", "調整 UI", -140, 0, "visual"), node("engine", "Physics", 180, -220),
      node("force", "OT force", 65, -90, "engine"), node("boxes", "Box constraints", 265, -90, "engine", 170),
      node("test", "Verification", 620, -220, undefined, 160), node("unit", "契約テスト", 510, -90, "test"),
      node("browser", "Browser", 710, -90, "test"), node("review", "Human review", 620, 60, "test", 180, 72),
    ],
    links: [ { id: "a", source: "intent", target: "force" }, { id: "b", source: "card", target: "boxes" },
      { id: "c", source: "panel", target: "force" }, { id: "d", source: "boxes", target: "unit" },
      { id: "e", source: "force", target: "unit" }, { id: "f", source: "panel", target: "browser" }, { id: "g", source: "browser", target: "review" } ],
  };
}

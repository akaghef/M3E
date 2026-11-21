import { describe, expect, test } from "vitest";
import {
  captureClipboard,
  pasteClipboard,
  type ClipboardNodeSource,
  type ClipboardRelationEdge,
  type ClipboardSnapshotNode,
  type PastedSnapshotNode,
} from "../../src/shared/clipboard_subtree";

function source(partial: ClipboardNodeSource): ClipboardNodeSource {
  return partial;
}

function findPasted(roots: readonly PastedSnapshotNode[], sourceId: string): PastedSnapshotNode | undefined {
  for (const root of roots) {
    if (root.sourceId === sourceId) return root;
    const child = findPasted(root.children, sourceId);
    if (child) return child;
  }
  return undefined;
}

function fixture(): { nodes: Record<string, ClipboardNodeSource>; links: ClipboardRelationEdge[] } {
  const nodes: Record<string, ClipboardNodeSource> = {
    entity: source({ id: "entity", nodeType: "text", text: "Aさん", children: [] }),
    via: source({ id: "via", nodeType: "alias", text: "Aさん", targetNodeId: "entity", children: [] }),
    alias: source({
      id: "alias",
      nodeType: "alias",
      text: "Aさん",
      collapsed: true,
      children: ["task"],
      targetNodeId: "via",
      aliasLabel: "窓",
      access: "write",
      targetSnapshotLabel: "Aさん",
      isBroken: false,
      attributes: { role: "owner" },
    }),
    task: source({ id: "task", nodeType: "text", text: "課題", collapsed: false, children: [] }),
    left: source({ id: "left", nodeType: "text", text: "左", collapsed: true, children: ["right", "inner"] }),
    right: source({ id: "right", nodeType: "text", text: "右", collapsed: false, children: [] }),
    inner: source({
      id: "inner",
      nodeType: "alias",
      text: "Aさん",
      targetNodeId: "entity",
      aliasLabel: "内",
      access: "read",
      children: [],
    }),
    outside: source({ id: "outside", nodeType: "text", text: "外", children: [] }),
  };
  const links: ClipboardRelationEdge[] = [
    {
      id: "closed",
      sourceNodeId: "left",
      targetNodeId: "right",
      relationType: "m3e:relates",
      label: "内側",
      direction: "forward",
      style: "dashed",
      attributes: { weight: "1" },
    },
    {
      id: "leaving",
      sourceNodeId: "left",
      targetNodeId: "outside",
      relationType: "m3e:out",
      label: "外向き",
      direction: "backward",
      style: "emphasis",
      attributes: { keep: "no" },
    },
  ];
  return { nodes, links };
}

function copied() {
  const { nodes, links } = fixture();
  return captureClipboard(["alias", "left"], nodes, links, nodes);
}

describe("clipboard subtree paste", () => {
  test("an alias in range pastes as an alias of the same non-alias entity", () => {
    const captured = copied();
    const alias = captured.snapshots.find((snapshot) => snapshot.id === "alias");
    expect(alias?.nodeType).toBe("alias");
    expect(alias?.alias).toEqual({
      target: "entity",
      label: "窓",
      access: "write",
      snapshotLabel: "Aさん",
      broken: false,
    });
    expect(alias?.alias?.target).not.toBe("via");

    let n = 0;
    const plan = pasteClipboard(captured.snapshots, captured.links, () => `new-${n++}`);
    const pasted = findPasted(plan.roots, "alias");
    const pastedEntity = findPasted(plan.roots, "entity");
    expect(pasted?.nodeType).toBe("alias");
    expect(pasted?.alias?.target).toBe("entity");
    expect(pasted?.alias?.target).not.toBe("via");
    expect(pasted?.alias?.target).not.toBe(pasted?.id);
    expect(pastedEntity).toBeUndefined();
    expect(plan.idMap.get("alias")).not.toBe("entity");
  });

  test("an alias whose entity is also copied points at the pasted copy of that entity (Database_Spec 12.8 JA4)", () => {
    const { nodes } = fixture();
    nodes.bundle = source({
      id: "bundle",
      nodeType: "text",
      text: "束",
      collapsed: false,
      children: ["entity", "inner"],
    });
    const captured = captureClipboard(["bundle"], nodes, [], nodes);
    let n = 0;
    const plan = pasteClipboard(captured.snapshots, captured.links, () => `new-${n++}`);
    const inner = findPasted(plan.roots, "inner");
    const entityCopy = findPasted(plan.roots, "entity");
    expect(inner?.nodeType).toBe("alias");
    expect(entityCopy?.nodeType).not.toBe("alias");
    expect(entityCopy?.id).not.toBe("entity");
    expect(inner?.alias?.target).toBe(entityCopy?.id);
    expect(inner?.alias?.broken).toBe(false);
    expect(inner?.alias?.target).not.toBe(inner?.id);
  });

  test("a relation edge closed in the range is pasted between the new nodes with its attributes", () => {
    const captured = copied();
    let n = 0;
    const plan = pasteClipboard(captured.snapshots, captured.links, () => `new-${n++}`);
    expect(plan.links).toHaveLength(1);
    expect(plan.links[0]).toMatchObject({
      sourceNodeId: plan.idMap.get("left"),
      targetNodeId: plan.idMap.get("right"),
      relationType: "m3e:relates",
      label: "内側",
      direction: "forward",
      style: "dashed",
      attributes: { weight: "1" },
    });
    expect(plan.links[0]?.id).not.toBe("closed");
    expect(plan.links[0]?.sourceNodeId).not.toBe("left");
    expect(plan.links[0]?.targetNodeId).not.toBe("right");
  });

  test("a relation edge that leaves the range is not pasted", () => {
    const captured = copied();
    expect(captured.links.map((link) => link.id)).toEqual(["closed"]);
    let n = 0;
    const plan = pasteClipboard(
      captured.snapshots,
      [...captured.links, fixture().links[1]!],
      () => `new-${n++}`,
    );
    expect(plan.links.map((link) => link.label)).toEqual(["内側"]);
    expect(plan.links.some((link) => link.targetNodeId === "outside" || link.label === "外向き")).toBe(false);
  });

  test("collapsed survives paste and every id is new", () => {
    const captured = copied();
    const sourceIds = new Set<string>();
    const walk = (snapshot: ClipboardSnapshotNode): void => {
      sourceIds.add(snapshot.id);
      snapshot.children.forEach(walk);
    };
    captured.snapshots.forEach(walk);
    let n = 0;
    const allocated: string[] = [];
    const plan = pasteClipboard(captured.snapshots, captured.links, () => {
      const id = `new-${n++}`;
      allocated.push(id);
      return id;
    });
    expect(findPasted(plan.roots, "alias")?.collapsed).toBe(true);
    expect(findPasted(plan.roots, "task")?.collapsed).toBe(false);
    expect(findPasted(plan.roots, "left")?.collapsed).toBe(true);
    expect(findPasted(plan.roots, "right")?.collapsed).toBe(false);
    const pastedIds = [...plan.idMap.values(), ...plan.links.map((link) => link.id)];
    expect(pastedIds.length).toBe(new Set(pastedIds).size);
    for (const id of pastedIds) {
      expect(sourceIds.has(id)).toBe(false);
      expect(allocated).toContain(id);
    }
    expect(plan.idMap.size).toBe(sourceIds.size);
  });
});

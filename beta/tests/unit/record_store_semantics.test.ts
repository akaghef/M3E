// Commit-time locks, grants, OC1–OC4, copy provenance and event kinds. Synthetic data only.

import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { COMMIT_INDEX_FILE, JOURNAL_FILE, RecordWorkspaceStore, type CommitResult } from "../../src/node/record_store";
import { decodeRecord, encodeRecord } from "../../src/node/neo4j_store/encoding";
import { diffState, type MapCommand } from "../../src/shared/map_changes";
import { recordRk } from "../../src/shared/record_model/steady";
import type { SnapshotRecord } from "../../src/shared/record_model/types";
import type { AppState } from "../../src/shared/types";
import { applyDelete, copyEntities } from "../../src/node/record_store/operations";
import { ISSUER, command, node, richState, snapshotOf, tempDir, type Loose } from "./record_store_helpers";

const open: RecordWorkspaceStore[] = [];

afterEach(async () => {
  for (const store of open.splice(0)) await store.close();
});

function newDir(name: string): string {
  const dir = path.join(tempDir(name), "store");
  RecordWorkspaceStore.create(dir, snapshotOf([{ id: "map_a", state: richState() }]));
  return dir;
}

let clock = 0;
function tick(): string {
  clock += 1;
  return new Date(Date.UTC(2026, 10, 17, 0, 0, clock)).toISOString();
}

function openStore(dir: string, now: () => string = tick): RecordWorkspaceStore {
  const store = RecordWorkspaceStore.open(dir, { now });
  open.push(store);
  return store;
}

function stateOf(store: RecordWorkspaceStore): Loose {
  return store.getMapRow("map_a").state as unknown as Loose;
}

function nodesOf(state: Loose): Record<string, Loose> {
  return state.nodes as Record<string, Loose>;
}

function commit(store: RecordWorkspaceStore, intent: string, change: (state: Loose) => void, actor?: MapCommand["actor"]): CommitResult {
  const before = stateOf(store);
  const after = JSON.parse(JSON.stringify(before)) as Loose;
  change(after);
  const changes = diffState(before, after);
  const cmd = command(changes, intent);
  if (actor) cmd.actor = actor;
  return store.commitMapCommand("map_a", cmd, ISSUER);
}

function accepted(result: CommitResult): Extract<CommitResult, { ok: true }> {
  if (!result.ok) throw new Error(`${result.code} ${result.message ?? ""}`);
  return result;
}

function refused(result: CommitResult, pattern: RegExp): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.code).toBe("INVALID_STATE");
  expect(result.message ?? "").toMatch(pattern);
}

function lock(store: RecordWorkspaceStore, target: string): void {
  accepted(commit(store, "lock", (state) => {
    const locks = { ...((state.locks as Loose) ?? {}) };
    locks[target] = { target };
    state.locks = locks;
  }));
}

function unlock(store: RecordWorkspaceStore, target: string, actor?: MapCommand["actor"]): CommitResult {
  return commit(store, "unlock", (state) => {
    const locks = { ...((state.locks as Loose) ?? {}) };
    delete locks[target];
    state.locks = locks;
  }, actor);
}

function drop(state: Loose, id: string): void {
  const nodes = nodesOf(state);
  const links = (state.links ?? {}) as Record<string, Loose>;
  const gone = new Set<string>();
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || gone.has(current)) continue;
    gone.add(current);
    stack.push(...((nodes[current]?.children as string[]) ?? []));
  }
  for (const item of Object.values(nodes)) {
    if (gone.has(String(item.id))) continue;
    item.children = (item.children as string[]).filter((child) => !gone.has(child));
  }
  for (const [linkId, link] of Object.entries(links)) {
    if (gone.has(String(link.sourceNodeId)) || gone.has(String(link.targetNodeId))) delete links[linkId];
  }
  for (const goneId of gone) delete nodes[goneId];
}

function move(state: Loose, id: string, parentId: string): void {
  const nodes = nodesOf(state);
  const item = nodes[id];
  const old = nodes[String(item.parentId)];
  old.children = (old.children as string[]).filter((child) => child !== id);
  item.parentId = parentId;
  delete item.edgeOutsideScope;
  (nodes[parentId].children as string[]).push(id);
}

function addChild(state: Loose, id: string, parentId: string): void {
  const nodes = nodesOf(state);
  nodes[id] = node(id, parentId);
  (nodes[parentId].children as string[]).push(id);
}

function parentScope(store: RecordWorkspaceStore, nodeId: string): string {
  for (const record of store.records()) {
    if (record.kind === "connection" && record.type === "edge" && record.target === nodeId && record.scopeId) return record.scopeId;
  }
  throw new Error(`no parent scope for ${nodeId}`);
}

function nodeRecord(store: RecordWorkspaceStore, id: string): Extract<SnapshotRecord, { kind: "node" }> | undefined {
  const found = store.records().find((record) => record.kind === "node" && record.id === id);
  return found?.kind === "node" ? found : undefined;
}

function lastJournal(dir: string): Loose {
  const text = fs.readFileSync(path.join(dir, JOURNAL_FILE), "utf8").trim();
  return JSON.parse(text.split("\n").at(-1) ?? "{}") as Loose;
}

function touched(dir: string): Array<{ rk: string; ev: string[] }> {
  return (lastJournal(dir).touched as Array<{ rk: string; ev: string[] }> | undefined) ?? [];
}

const AI = { kind: "ai-agent" as const, id: "agent-1" };

describe("locks and grants", () => {
  it("rejects removal, removal through an ancestor, reparent and ending through another alias", () => {
    const store = openStore(newDir("lock-block"));
    lock(store, "node|img");
    refused(commit(store, "delete", (state) => drop(state, "img")), /locked node\|img/);
    expect(nodesOf(stateOf(store)).img).toBeTruthy();

    lock(store, "node|inner");
    refused(commit(store, "delete", (state) => drop(state, "f1")), /locked node\|inner/);
    expect(nodesOf(stateOf(store)).inner).toBeTruthy();
    expect(nodesOf(stateOf(store)).f1).toBeTruthy();

    refused(commit(store, "reparent", (state) => move(state, "inner", "leaf")), /locked node\|inner/);
    expect(nodesOf(stateOf(store)).inner.parentId).toBe("f1");

    accepted(commit(store, "alias", (state) => {
      const nodes = nodesOf(state);
      nodes.al2 = node("al2", "root", [], { nodeType: "alias", targetNodeId: "leaf", aliasLabel: "L2", access: "write" });
      (nodes.root.children as string[]).push("al2");
    }));
    lock(store, "node|al");
    refused(commit(store, "oc3", (state) => {
      const applied = applyDelete(state as unknown as AppState, "oc3", "al2", { at: "2026-11-17T01:00:00.000Z" });
      if (!applied.ok) throw new Error(applied.message);
    }), /locked node\|al/);
    expect(nodesOf(stateOf(store)).leaf.valid).toBeUndefined();
    expect(nodesOf(stateOf(store)).al2.nodeType).toBe("alias");
  });

  it("allows a content edit, a new child, a sibling reorder and an ancestor move", () => {
    const store = openStore(newDir("lock-allow"));
    lock(store, "node|inner");
    accepted(commit(store, "rename", (state) => { nodesOf(state).inner.text = "edited"; }));
    expect(nodesOf(stateOf(store)).inner.text).toBe("edited");
    accepted(commit(store, "create", (state) => addChild(state, "kid", "inner")));
    expect(nodesOf(stateOf(store)).kid.parentId).toBe("inner");
    accepted(commit(store, "order", (state) => {
      const children = nodesOf(state).f1.children as string[];
      nodesOf(state).f1.children = [children[1], children[0], ...children.slice(2)];
    }));
    expect(nodesOf(stateOf(store)).f1.children).toEqual(["al", "inner"]);
    accepted(commit(store, "reparent", (state) => move(state, "f1", "img")));
    const nodes = nodesOf(stateOf(store));
    expect(nodes.f1.parentId).toBe("img");
    expect(nodes.inner.parentId).toBe("f1");
    expect(nodes.kid.parentId).toBe("inner");
    expect(store.records().some((record) => record.kind === "lock" && record.target === "node|inner")).toBe(true);
  });

  it("lets an AI agent unlock only with a grant that is still inside its expiry", () => {
    let nowIso = "2026-11-17T00:00:10.000Z";
    const store = openStore(newDir("grant"), () => nowIso);
    const at = (iso: string): void => { nowIso = iso; };
    at("2026-11-17T00:00:11.000Z");
    lock(store, "node|leaf");
    const scopeId = parentScope(store, "leaf");
    at("2026-11-17T00:00:12.000Z");
    refused(unlock(store, "node|leaf", AI), /locked node\|leaf.*m3e:unlock/);
    expect(store.records().some((record) => record.kind === "lock" && record.target === "node|leaf")).toBe(true);

    at("2026-11-17T00:00:13.000Z");
    accepted(commit(store, "grant", (state) => {
      state.grants = {
        g1: {
          scopeId,
          principal: { account: "agent-1" },
          capability: "m3e:unlock",
          grantedBy: "human-1",
          expiresAt: "2026-11-17T00:00:30.000Z",
        },
      };
    }));
    at("2026-11-17T00:00:14.000Z");
    accepted(unlock(store, "node|leaf", AI));
    expect(store.records().some((record) => record.kind === "lock")).toBe(false);

    at("2026-11-17T00:00:15.000Z");
    lock(store, "node|leaf");
    at("2026-11-17T00:00:30.000Z");
    refused(unlock(store, "node|leaf", AI), /locked node\|leaf.*m3e:unlock/);
    expect(store.records().some((record) => record.kind === "lock" && record.target === "node|leaf")).toBe(true);
    at("2026-11-17T00:00:31.000Z");
    accepted(unlock(store, "node|leaf"));
    expect(store.records().some((record) => record.kind === "lock")).toBe(false);
  });
});

describe("touched event kinds", () => {
  it("emits m3e:reparent and m3e:order separately, and no m3e:content for a position change", () => {
    const dir = newDir("kinds");
    const store = openStore(dir);
    accepted(commit(store, "reparent", (state) => move(state, "inner", "leaf")));
    const edge = store.records().find((record) => record.kind === "connection" && record.type === "edge" && record.target === "inner");
    expect(edge).toBeTruthy();
    expect(touched(dir).find((entry) => entry.rk === recordRk(edge!))?.ev).toContain("m3e:reparent");

    accepted(commit(store, "order", (state) => {
      nodesOf(state).root.children = ["leaf", "f1", "img"];
    }));
    const ordered = touched(dir).filter((entry) => entry.ev.includes("m3e:order"));
    expect(ordered.length).toBeGreaterThan(0);
    expect(ordered.every((entry) => !entry.ev.includes("m3e:reparent"))).toBe(true);

    accepted(commit(store, "position", (state) => {
      const surface = Object.values(state.surfaces as Record<string, Loose>).find((item) => item.kind === "scatter");
      const views = surface?.nodeViews as Record<string, Loose>;
      views.leaf = { ...(views.leaf ?? {}), x: 9 };
    }));
    expect(touched(dir).some((entry) => entry.ev.includes("m3e:content"))).toBe(false);
    expect(store.records().some((record) => record.kind === "nodeView" && record.nodeId === "leaf" && record.x === 9)).toBe(true);
  });
});

describe("delete operations and copy", () => {
  it("OC1 removes an alias occurrence and refuses a non-alias", () => {
    const store = openStore(newDir("oc1"));
    accepted(commit(store, "setup", (state) => {
      addChild(state, "task", "al");
      const nodes = nodesOf(state);
      nodes.al2 = node("al2", "root", [], { nodeType: "alias", targetNodeId: "leaf", aliasLabel: "L2", access: "write" });
      (nodes.root.children as string[]).push("al2");
    }));
    refused(commit(store, "oc1", (state) => drop(state, "img")), /OC1 removes an alias occurrence only/);
    expect(nodesOf(stateOf(store)).img).toBeTruthy();

    accepted(commit(store, "oc1", (state) => {
      const applied = applyDelete(state as unknown as AppState, "oc1", "al");
      if (!applied.ok) throw new Error(applied.message);
    }));
    const nodes = nodesOf(stateOf(store));
    expect(nodes.al).toBeUndefined();
    expect(nodes.task).toBeUndefined();
    expect(nodes.leaf.text).toBe("text of leaf");
    expect(nodes.al2.nodeType).toBe("alias");
    expect(nodes.al2.targetNodeId).toBe("leaf");
    expect(nodes.al2.isBroken).toBeFalsy();
  });

  it("OC3 fills valid.to, keeps aliases and emits m3e:end", () => {
    const dir = newDir("oc3");
    const store = openStore(dir);
    accepted(commit(store, "oc3", (state) => {
      const applied = applyDelete(state as unknown as AppState, "oc3", "al", { at: "2026-11-17T03:00:00.000Z" });
      if (!applied.ok) throw new Error(applied.message);
    }));
    const nodes = nodesOf(stateOf(store));
    expect(nodes.leaf.valid).toEqual({ to: "2026-11-17T03:00:00.000Z" });
    expect(nodes.al.nodeType).toBe("alias");
    expect(nodes.al.isBroken).toBeFalsy();
    expect(nodes.al.targetNodeId).toBe("leaf");
    expect(touched(dir).find((entry) => entry.rk === "node|leaf")?.ev).toEqual(["m3e:end"]);
  });

  it("OC4 breaks other aliases and keeps their children", () => {
    const store = openStore(newDir("oc4"));
    accepted(commit(store, "setup", (state) => addChild(state, "task", "al")));
    accepted(commit(store, "oc4", (state) => {
      const applied = applyDelete(state as unknown as AppState, "oc4", "al");
      if (!applied.ok) throw new Error(applied.message);
    }));
    const nodes = nodesOf(stateOf(store));
    expect(nodes.leaf).toBeUndefined();
    expect(nodes.al.isBroken).toBe(true);
    expect(nodes.al.targetSnapshotLabel).toBeTruthy();
    expect(nodes.task.parentId).toBe("al");
    expect(nodes.al.children).toEqual(["task"]);
  });

  it("OC2 moves on the canonical plane and refuses a deletion", () => {
    const store = openStore(newDir("oc2"));
    accepted(commit(store, "oc2", (state) => {
      const applied = applyDelete(state as unknown as AppState, "oc2", "inner", { parentId: "leaf" });
      if (!applied.ok) throw new Error(applied.message);
    }));
    expect(nodesOf(stateOf(store)).inner.parentId).toBe("leaf");
    refused(commit(store, "oc2", (state) => drop(state, "img")), /projection\.dissolved/);
  });

  it("copies an alias in range as an alias and records copyOf", () => {
    const store = openStore(newDir("copy"));
    const before = stateOf(store);
    const after = JSON.parse(JSON.stringify(before)) as Loose;
    const copied = copyEntities(after as unknown as AppState, "f1", "img", { seq: store.seq() + 1, mapId: "map_a" });
    expect(copied.ok).toBe(true);
    if (!copied.ok) return;
    accepted(store.commitMapCommand("map_a", command(diffState(before, after), "copy"), ISSUER));
    const alias = nodeRecord(store, copied.ids.al);
    expect(alias?.nodeType).toBe("alias");
    expect(alias?.alias?.target).toBe("leaf");
    expect(alias?.copyOf).toMatchObject({
      source: "al",
      mapId: "map_a",
      mode: "range=subtree;alias=keep",
      seq: store.seq(),
    });
    expect(alias?.copyOf?.ids.al).toBe(copied.ids.al);
    expect(nodesOf(stateOf(store))[copied.ids.al].targetNodeId).toBe("leaf");
  });

  it("keeps lock, grant and valid across snapshot write, journal replay and Neo4j encode", async () => {
    const dir = newDir("round");
    const first = openStore(dir);
    accepted(commit(first, "valid", (state) => {
      nodesOf(state).leaf.valid = { from: "2026-01-01T00:00:00.000Z", to: "2026-06-01T00:00:00.000Z" };
    }));
    lock(first, "node|leaf");
    const scopeId = parentScope(first, "leaf");
    accepted(commit(first, "grant", (state) => {
      state.grants = {
        g1: { scopeId, principal: { account: "agent-1" }, capability: "m3e:unlock", grantedBy: "human-1", expiresAt: "2026-12-01T00:00:00.000Z" },
      };
    }));
    await first.close();

    const replayed = openStore(dir);
    expect(replayed.records().some((record) => record.kind === "lock" && record.target === "node|leaf")).toBe(true);
    expect(replayed.records().some((record) => record.kind === "grant" && record.id === "g1")).toBe(true);
    expect(nodeRecord(replayed, "leaf")?.valid).toEqual({ from: "2026-01-01T00:00:00.000Z", to: "2026-06-01T00:00:00.000Z" });
    replayed.compact();
    await replayed.close();

    const stored = openStore(dir);
    const lockRecord = stored.records().find((record) => record.kind === "lock");
    const grantRecord = stored.records().find((record) => record.kind === "grant");
    const leaf = nodeRecord(stored, "leaf");
    expect(lockRecord?.kind).toBe("lock");
    expect(grantRecord?.kind).toBe("grant");
    expect(leaf?.valid?.to).toBe("2026-06-01T00:00:00.000Z");
    for (const record of [lockRecord, grantRecord, leaf]) {
      expect(record).toBeTruthy();
      const encoded = encodeRecord(record!);
      expect(JSON.stringify(decodeRecord(encoded.props))).toBe(JSON.stringify(record));
    }
    expect(encodeRecord(lockRecord!).labels).toContain("Lock");
    expect(encodeRecord(grantRecord!).labels).toContain("Grant");
  });

  it("refuses reuse of a deleted id, including after compaction, and accepts the Undo", async () => {
    const dir = newDir("reuse");
    const store = openStore(dir);
    const original = JSON.parse(JSON.stringify(stateOf(store))) as Loose;
    accepted(commit(store, "delete", (state) => drop(state, "img")));
    refused(commit(store, "create", (state) => {
      const nodes = nodesOf(state);
      nodes.img = node("img", "root", [], { nodeType: "image", text: "different" });
      (nodes.root.children as string[]).push("img");
    }), /deleted id cannot be reused \(img\)/);
    expect(nodesOf(stateOf(store)).img).toBeUndefined();

    accepted(commit(store, "undo", (state) => {
      const nodes = nodesOf(state);
      nodes.img = JSON.parse(JSON.stringify(nodesOf(original).img)) as Loose;
      nodes.root.children = [...(nodesOf(original).root.children as string[])];
      state.links = JSON.parse(JSON.stringify(original.links)) as Loose;
    }));
    expect(nodesOf(stateOf(store)).img.nodeType).toBe("image");

    accepted(commit(store, "delete", (state) => drop(state, "img")));
    store.compact();
    const index = JSON.parse(fs.readFileSync(path.join(dir, COMMIT_INDEX_FILE), "utf8")) as { retired?: Record<string, string> };
    expect(typeof index.retired?.img).toBe("string");
    await store.close();

    const again = openStore(dir);
    refused(commit(again, "create", (state) => {
      const nodes = nodesOf(state);
      nodes.img = node("img", "root", [], { nodeType: "image", text: "different" });
      (nodes.root.children as string[]).push("img");
    }), /deleted id cannot be reused \(img\)/);
    accepted(commit(again, "undo", (state) => {
      const nodes = nodesOf(state);
      nodes.img = JSON.parse(JSON.stringify(nodesOf(original).img)) as Loose;
      nodes.root.children = [...(nodesOf(original).root.children as string[])];
      state.links = JSON.parse(JSON.stringify(original.links)) as Loose;
    }));
    expect(nodeRecord(again, "img")?.nodeType).toBe("image");
  });
});

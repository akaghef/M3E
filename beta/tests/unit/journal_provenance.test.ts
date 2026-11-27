// Provenance of a commit in the journal (Database_Spec 6): `{items: [{mode, rk, rev}], truncated?}`.
// observed = records the MCP participation was shown, at the rev it saw; declared = the copy source.
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RapidMvpModel } from "../../src/node/rapid_mvp";
import { M3eMcpService } from "../../src/node/mcp_service";
import { normalizeProvenance, type RecordWorkspaceStore } from "../../src/node/record_store";
import { diffState } from "../../src/shared/map_changes";
import { command, snapshotOf } from "./record_store_helpers";
import { createTestStore, dropTestStores } from "./neo4j_test_store";

const holder: { store: RecordWorkspaceStore | null } = { store: null };

vi.mock("../../src/node/record_store/active", async () => {
  const actual = await vi.importActual<typeof import("../../src/node/record_store/active")>("../../src/node/record_store/active");
  return {
    ...actual,
    activeRecordStore: () => holder.store,
    closeActiveRecordStore: async () => { holder.store = null; },
  };
});

const saved = { forbid: process.env.M3E_FORBID_LIVE_DATA };
const MAP = "prov";
let service: M3eMcpService;
let ids: { a: string; b: string; a1: string };

async function last(): Promise<Record<string, any>> {
  const lines = await holder.store!.readJournalAfter(0);
  return lines!.at(-1)!;
}
function nodeUri(id: string): string { return `m3e://maps/${MAP}/nodes/${encodeURIComponent(id)}`; }
function revOf(rk: string): number { return holder.store!.revsOf([rk]).get(rk)!; }

beforeEach(async () => {
  process.env.M3E_FORBID_LIVE_DATA = "1";
  const handle = await createTestStore(snapshotOf([]));
  holder.store = handle.store;
  const model = new RapidMvpModel("Root");
  const a = model.addNode(model.state.rootId, "A");
  const a1 = model.addNode(a, "A1");
  const b = model.addNode(model.state.rootId, "B");
  ids = { a, b, a1 };
  model.saveToSqlite("unused.sqlite", MAP);
  expect(holder.store.hasMap(MAP)).toBe(true);
  service = new M3eMcpService({ dbPath: () => "unused.sqlite", feedbackDir: () => path.join(os.tmpdir(), "m3e-provenance-feedback") });
});

afterEach(async () => {
  holder.store = null;
  await dropTestStores();
  if (saved.forbid === undefined) delete process.env.M3E_FORBID_LIVE_DATA; else process.env.M3E_FORBID_LIVE_DATA = saved.forbid;
});

describe("journal provenance", () => {
  it("a commit lists the records the participation read, at the rev it read, and no session fields", async () => {
    const ctx = service.call("m3e_context", { action: "enter", target: `m3e://maps/${MAP}` });
    expect(service.call("m3e_get", { kind: "state", context_id: ctx.context_id }).ok).toBe(true);
    const revA = revOf(`node|${ids.a}`);
    expect(service.call("m3e_create", { kind: "node", context_id: ctx.context_id, target: nodeUri(ids.a), text: "new" }).ok).toBe(true);

    const line = await last();
    expect(Object.keys(line.provenance).sort()).toEqual(["items"]);
    const items = line.provenance.items as Array<{ mode: string; rk: string; rev: number }>;
    expect(items.every((item) => item.mode === "observed")).toBe(true);
    expect(items).toContainEqual({ mode: "observed", rk: `node|${ids.a}`, rev: revA });
    expect(items.map((item) => item.rk)).toEqual(expect.arrayContaining([`node|${ids.a1}`, `node|${ids.b}`]));
    expect(new Set(items.map((item) => item.rk)).size).toBe(items.length);
  });

  it("a record another participant changed after the read is left out; one the participation rewrote stays at the rev it read", async () => {
    const ctx = service.call("m3e_context", { action: "enter", target: nodeUri(ids.a) });
    expect(service.call("m3e_get", { kind: "state", context_id: ctx.context_id }).ok).toBe(true);
    expect(service.call("m3e_get", { kind: "state", context_id: ctx.context_id, target: nodeUri(ids.b) }).ok).toBe(true);
    const revA1 = revOf(`node|${ids.a1}`);

    // Another participant changes B, outside what the first one watches: it is not shown that change.
    const other = service.call("m3e_context", { action: "enter", target: nodeUri(ids.b) });
    expect(service.call("m3e_update", { kind: "content", context_id: other.context_id, target: nodeUri(ids.b), text: "B changed" }).ok).toBe(true);

    // The first participant rewrites A1 itself, then makes another commit.
    expect(service.call("m3e_update", { kind: "content", context_id: ctx.context_id, target: nodeUri(ids.a1), text: "A1 rewritten" }).ok).toBe(true);
    expect(service.call("m3e_create", { kind: "node", context_id: ctx.context_id, target: nodeUri(ids.a), text: "next" }).ok).toBe(true);

    const items = (await last()).provenance.items as Array<{ mode: string; rk: string; rev: number }>;
    expect(items.map((item) => item.rk)).not.toContain(`node|${ids.b}`);
    expect(items).toContainEqual({ mode: "observed", rk: `node|${ids.a1}`, rev: revA1 });
  });

  it("a copy declares its source subtree", async () => {
    const ctx = service.call("m3e_context", { action: "enter", target: `m3e://maps/${MAP}` });
    expect(service.call("m3e_create", { kind: "copy", context_id: ctx.context_id, target: nodeUri(ids.b), source: nodeUri(ids.a) }).ok).toBe(true);
    const items = (await last()).provenance.items as Array<{ mode: string; rk: string; rev: number }>;
    const declared = items.filter((item) => item.mode === "declared").map((item) => item.rk);
    expect(declared).toEqual(expect.arrayContaining([`node|${ids.a}`, `node|${ids.a1}`]));
    expect(declared).not.toContain(`node|${ids.b}`);
  });

  it("the store keeps only the decided shape, refuses malformed items and cuts at 100", async () => {
    const store = holder.store!;
    const state = store.getMapRow(MAP).state as unknown as { nodes: Record<string, { text: string }> };
    const edit = (provenance: unknown, text: string) => {
      const next = JSON.parse(JSON.stringify(state));
      next.nodes[ids.b].text = text;
      const cmd = command(diffState(state, next));
      return store.commitMapCommand(MAP, { ...cmd, provenance }, "tester");
    };
    expect(edit({ contextId: "x", tool: "m3e_update" }, "legacy").ok).toBe(true);
    expect((await last()).provenance).toBeUndefined();

    const bad = edit({ items: [{ mode: "guessed", rk: "node|x", rev: 1 }] }, "bad");
    expect(bad.ok).toBe(false);
    expect(bad.ok ? "" : bad.code).toBe("INVALID_COMMAND");

    const many = Array.from({ length: 150 }, (_, i) => ({ mode: "observed", rk: `node|n${i}`, rev: i }));
    expect(normalizeProvenance({ items: many })).toEqual({ items: many.slice(0, 100), truncated: true });
  });
});

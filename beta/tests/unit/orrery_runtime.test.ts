import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrreryRuntime, orreryRuntimeOptionsFromEnv } from "../../src/node/orrery_runtime";
import { emptyOrrerySnapshot, orreryActorId } from "../../src/shared/orrery_observation";
const roots: string[] = [];
const readers: ReturnType<typeof createOrreryRuntime>[] = [];
afterEach(() => { readers.splice(0).forEach(r => r.close()); roots.splice(0).forEach(p => fs.rmSync(p, { recursive: true, force: true })); vi.useRealTimers(); });
function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "orrery-test-")); roots.push(root);
  const config = { id: "test", hostId: "host", path: path.join(root, "snapshot.json"), format: "orrery-v1" as const };
  const at = "2026-09-22T01:00:00Z";
  const snapshot = { ...emptyOrrerySnapshot(at), revision: "1", sources: [{ id: config.id, hostId: config.hostId, state: "connected" as const, observedAt: at, revision: "1" }], actors: [{ id: orreryActorId(config.id, config.hostId, "a"), externalId: "a", kind: "ai" as const, name: "actor", backend: "codex", rawState: "thinking", observationState: "observed" as const, lastActiveAt: at, capabilities: ["send"], provenance: { sourceId: config.id, hostId: config.hostId, sourceRecordId: "a", observedAt: at, revision: "1" } }] };
  const write = () => fs.writeFileSync(config.path, JSON.stringify(snapshot));
  const create = (extra = {}) => { const reader = createOrreryRuntime({ sources: [config], now: () => Date.parse(at), ...extra }); readers.push(reader); return reader; };
  return { config, snapshot, write, create };
}
describe("read-only runtime", () => {
  it("defaults disabled and rejects malformed env without leaking paths", () => {
    const reader = createOrreryRuntime(orreryRuntimeOptionsFromEnv({ M3E_ORRERY_SOURCES: "secret-path" })); readers.push(reader);
    expect(reader.snapshot().sources[0]).toMatchObject({ state: "disabled", problem: "configuration_invalid" });
    expect(JSON.stringify(reader.snapshot())).not.toContain("secret-path");
    expect(orreryRuntimeOptionsFromEnv({})).not.toHaveProperty("sources");
    expect(orreryRuntimeOptionsFromEnv({ M3E_ORRERY_SOURCES: JSON.stringify([{ path: "/snapshot.json", format: "orrery-v1" }]) }).configurationProblem).toBe("configuration_invalid");
  });
  it("loads updates, strips command capabilities and preserves last good after corrupt/missing input", () => {
    const f = setup(); f.write(); const reader = f.create(); const listener = vi.fn(); reader.subscribe(listener);
    expect(reader.snapshot().actors[0].capabilities).toEqual([]);
    f.snapshot.revision = "2"; f.snapshot.actors[0].name = "updated"; f.write(); reader.refresh();
    expect(reader.snapshot().actors[0].name).toBe("updated"); expect(listener).toHaveBeenCalledOnce();
    fs.writeFileSync(f.config.path, "{secret-path"); reader.refresh();
    expect(reader.snapshot().sources[0]).toMatchObject({ state: "unobservable", problem: "source_invalid" });
    expect(reader.snapshot().actors[0]).toMatchObject({ name: "updated", observationState: "unobservable" });
    fs.unlinkSync(f.config.path); reader.refresh(); expect(reader.snapshot().sources[0].problem).toBe("source_missing");
    f.write(); reader.refresh(); expect(reader.snapshot().sources[0].state).toBe("connected");
  });
  it("marks stale and rejects regressions, retaining the last valid snapshot", () => {
    const f = setup(); f.write(); let now = Date.parse(f.snapshot.generatedAt); const reader = f.create({ now: () => now, staleMs: 100 });
    now += 101; reader.refresh(); expect(reader.snapshot().sources[0].state).toBe("stale");
    f.snapshot.generatedAt = "2026-09-21T00:00:00Z"; f.snapshot.actors[0].name = "old"; f.write(); reader.refresh();
    expect(reader.snapshot().sources[0].problem).toBe("source_out_of_order"); expect(reader.snapshot().actors[0].name).toBe("actor");
  });
  it("isolates failed hosts and releases polling/subscriptions on close", () => {
    vi.useFakeTimers(); const f = setup(); f.write(); const reader = f.create({ sources: [f.config, { ...f.config, hostId: "other", path: `${f.config.path}.missing` }], pollMs: 10 });
    expect(reader.snapshot().sources.map(s => s.state)).toEqual(["connected", "unobservable"]);
    const listener = vi.fn(); reader.subscribe(listener); f.snapshot.actors[0].name = "poll"; f.write(); vi.advanceTimersByTime(10);
    expect(listener).toHaveBeenCalledOnce(); reader.close(); f.snapshot.actors[0].name = "closed"; f.write(); vi.advanceTimersByTime(100);
    expect(listener).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it("retains vanished portable actors as unobservable", () => {
    const f = setup(); f.write(); const reader = f.create(); f.snapshot.actors = []; f.snapshot.revision = "gone"; f.write(); reader.refresh();
    expect(reader.snapshot().actors[0]).toMatchObject({ observationState: "unobservable", capabilities: [] });
  });
  it("normalizes sanitized Codex snapshots", () => {
    const f = setup(); fs.writeFileSync(f.config.path, JSON.stringify({ schema_version: 1, generated_at: f.snapshot.generatedAt, runtimes: [{ external_id: "a", agent_name: "test", program: "codex", state: "thinking", session_id: "s", last_seen_at: f.snapshot.generatedAt, capabilities: [] }] }));
    expect(f.create({ sources: [{ ...f.config, format: "codex-app-v1" }] }).snapshot().actors[0].name).toBe("test");
  });
});

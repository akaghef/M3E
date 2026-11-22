// Record store CLI without Neo4j. Synthetic data only.

import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { main } from "../../src/node/record_store_cli";
import { RecordWorkspaceStore } from "../../src/node/record_store";
import { diffState } from "../../src/shared/map_changes";
import { parseSnapshot, serializeSnapshot } from "../../src/shared/record_model/jsonl";
import { ISSUER, clone, command, richState, snapshotOf, tempDir, type Loose } from "./record_store_helpers";

function io(): { lines: string[]; out: (line: string) => void; err: (line: string) => void } {
  const lines: string[] = [];
  return { lines, out: (line) => lines.push(line), err: (line) => lines.push(line) };
}

describe("record store CLI", () => {
  it("creates a store from a snapshot, verifies it and exports it", async () => {
    const work = tempDir("cli");
    const snapshotPath = path.join(work, "in.jsonl");
    const snapshot = serializeSnapshot(snapshotOf([{ id: "map_a", state: richState() }]));
    fs.writeFileSync(snapshotPath, snapshot);
    const dir = path.join(work, "store");
    const created = io();
    expect(await main(["--create", dir, "--from-snapshot", snapshotPath], created)).toBe(0);
    expect(fs.readFileSync(path.join(dir, "snapshot.jsonl"), "utf8")).toBe(snapshot);
    expect(fs.readFileSync(path.join(dir, "journal.jsonl"), "utf8")).toBe("");
    // A second create into the same directory is refused.
    expect(await main(["--create", dir, "--from-snapshot", snapshotPath], io())).toBe(2);

    const store = RecordWorkspaceStore.open(dir);
    const before = store.getMapRow("map_a").state as unknown as Loose;
    const after = clone(before);
    (after.nodes as Record<string, Loose>).leaf.text = "edited";
    expect(store.commitMapCommand("map_a", command(diffState(before, after)), ISSUER).ok).toBe(true);
    const expected = serializeSnapshot(store.records());
    await store.close();

    const verified = io();
    expect(await main(["--verify", dir], verified)).toBe(0);
    expect(verified.lines.join("\n")).toMatch(/at commit 1, 1 maps[\s\S]*invariant problems: 0/);

    const outPath = path.join(work, "out.jsonl");
    expect(await main(["--export", dir, "--out", outPath], io())).toBe(0);
    expect(fs.readFileSync(outPath, "utf8")).toBe(expected);
    expect(parseSnapshot(fs.readFileSync(outPath, "utf8"))[0]).toMatchObject({ kind: "snapshot", seq: 1 });
  });

  it("can create a replacement remote with a new history and an increased epoch", async () => {
    const work = tempDir("cli-new-history");
    const records = snapshotOf([{ id: "map_a", state: richState() }]);
    const header = records[0];
    if (header.kind !== "snapshot") throw new Error("Expected a snapshot header.");
    header.historyId = "previous-history";
    header.epoch = 7;
    const snapshot = path.join(work, "in.jsonl");
    fs.writeFileSync(snapshot, serializeSnapshot(records));
    const dir = path.join(work, "replacement");
    expect(await main(["--create", dir, "--from-snapshot", snapshot, "--new-history"], io())).toBe(0);
    const restored = RecordWorkspaceStore.open(dir);
    try {
      expect(restored.syncIdentity()).toMatchObject({ epoch: 8, workspaceId: header.workspaceId });
      expect(restored.syncIdentity().historyId).not.toBe(header.historyId);
      expect(restored.seq()).toBe(header.seq);
    } finally {
      await restored.close();
    }
  });

  it("reports invariant problems with exit code 1 and bad usage with 2", async () => {
    const work = tempDir("cli-bad");
    const records = snapshotOf([{ id: "map_a", state: richState() }]).filter((record) => !(record.kind === "node" && record.id === "inner"));
    const dir = path.join(work, "store");
    RecordWorkspaceStore.create(dir, records);
    const verified = io();
    expect(await main(["--verify", dir], verified)).toBe(1);
    expect(verified.lines.join("\n")).toMatch(/invariant problems: [1-9]/);
    expect(await main(["--verify"], io())).toBe(2);
    expect(await main(["--create", dir], io())).toBe(2);
    expect(await main(["--export", dir], io())).toBe(2);
    expect(await main(["--verify", path.join(work, "nothing")], io())).toBe(1);
  });
});

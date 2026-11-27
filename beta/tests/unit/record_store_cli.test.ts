// Record store CLI on a disposable Neo4j. The export file is not a store.

import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { main } from "../../src/node/record_store_cli";
import { diffState } from "../../src/shared/map_changes";
import { parseSnapshot, serializeSnapshot } from "../../src/shared/record_model/jsonl";
import { ISSUER, clone, command, richState, snapshotOf, tempDir, type Loose } from "./record_store_helpers";
import { dropTestStores, openTestStore, testStoreName, TEST_NEO4J } from "./neo4j_test_store";

function io(): { lines: string[]; out: (line: string) => void; err: (line: string) => void } {
  const lines: string[] = [];
  return { lines, out: (line) => lines.push(line), err: (line) => lines.push(line) };
}

function useTestNeo4j(): void {
  process.env.M3E_NEO4J_BOLT = TEST_NEO4J.uri;
  delete process.env.M3E_NEO4J_USER;
  delete process.env.M3E_NEO4J_PASSWORD;
  delete process.env.M3E_NEO4J_DATABASE;
}

afterEach(async () => {
  await dropTestStores();
});

describe("record store CLI", () => {
  it("creates a store from an export, inspects it after a commit", async () => {
    useTestNeo4j();
    const work = tempDir("cli");
    const exportPath = path.join(work, "in.jsonl");
    const snapshot = serializeSnapshot(snapshotOf([{ id: "map_a", state: richState() }]));
    fs.writeFileSync(exportPath, snapshot);
    const name = testStoreName();
    const created = io();
    expect(await main(["--create", name, "--from-export", exportPath], created)).toBe(0);
    expect(created.lines.join("\n")).toContain(`created ${name}:`);
    expect(await main(["--create", name, "--from-export", exportPath], io())).toBe(2);

    const store = await openTestStore(name);
    const before = store.getMapRow("map_a").state as unknown as Loose;
    const after = clone(before);
    (after.nodes as Record<string, Loose>).leaf.text = "edited";
    expect(store.commitMapCommand("map_a", command(diffState(before, after)), ISSUER).ok).toBe(true);
    await store.durable();
    const expected = serializeSnapshot(store.records());
    await store.close();

    const verified = io();
    expect(await main(["--inspect", name], verified)).toBe(0);
    expect(verified.lines.join("\n")).toMatch(/at commit 1, 1 maps[\s\S]*invariant problems: 0/);
    const reopened = await openTestStore(name);
    try {
      expect(serializeSnapshot(reopened.records())).toBe(expected);
      expect(parseSnapshot(expected)[0]).toMatchObject({ kind: "snapshot", seq: 1 });
    } finally {
      await reopened.close();
    }
  });

  it("can create a replacement remote with a new history and an increased epoch", async () => {
    useTestNeo4j();
    const work = tempDir("cli-new-history");
    const records = snapshotOf([{ id: "map_a", state: richState() }]);
    const header = records[0];
    if (header.kind !== "snapshot") throw new Error("Expected a snapshot header.");
    header.historyId = "previous-history";
    header.epoch = 7;
    const snapshot = path.join(work, "in.jsonl");
    fs.writeFileSync(snapshot, serializeSnapshot(records));
    const name = testStoreName();
    expect(await main(["--create", name, "--from-export", snapshot, "--new-history"], io())).toBe(0);
    const restored = await openTestStore(name);
    try {
      expect(restored.syncIdentity()).toMatchObject({ epoch: 8, workspaceId: header.workspaceId });
      expect(restored.syncIdentity().historyId).not.toBe(header.historyId);
      expect(restored.seq()).toBe(header.seq);
    } finally {
      await restored.close();
    }
  });

  it("reports invariant problems with exit code 1 and bad usage with 2", async () => {
    useTestNeo4j();
    const work = tempDir("cli-bad");
    const records = snapshotOf([{ id: "map_a", state: richState() }]).filter((record) => !(record.kind === "node" && record.id === "inner"));
    const exportPath = path.join(work, "in.jsonl");
    fs.writeFileSync(exportPath, serializeSnapshot(records));
    const name = testStoreName();
    expect(await main(["--create", name, "--from-export", exportPath], io())).toBe(0);
    const verified = io();
    expect(await main(["--inspect", name], verified)).toBe(1);
    expect(verified.lines.join("\n")).toMatch(/invariant problems: [1-9]/);
    expect(await main(["--inspect"], io())).toBe(2);
    expect(await main(["--create", name], io())).toBe(2);
    expect(await main(["--drop"], io())).toBe(2);
    expect(await main(["--inspect", testStoreName()], io())).toBe(1);
  });
});

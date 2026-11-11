import { expect, it } from "vitest";
import { applyCommand, type RecordLog } from "../../../src/cutover/apply/command";

/** 合成データ。生きている map は使わない。 */
const log: RecordLog = {
  revision: "0",
  records: [{ id: "root", text: "Root", parentId: null }],
  appliedCommandIds: [],
};

it("追加、改名、親の変更、削除を適用する", () => {
  const added = applyCommand(log, {
    commandId: "c-assert",
    baseRevision: "0",
    intent: "assert",
    nodeId: "mammal",
    text: "Mammals",
    parentId: "root",
  });
  expect(added.outcome).toBe("applied");
  if (added.outcome !== "applied") return;
  expect(added.log.revision).toBe("1");
  expect(added.log.records).toEqual([
    { id: "root", text: "Root", parentId: null },
    { id: "mammal", text: "Mammals", parentId: "root" },
  ]);
  expect(log.records).toEqual([{ id: "root", text: "Root", parentId: null }]);
  expect(log.revision).toBe("0");

  const child = applyCommand(added.log, {
    commandId: "c-child",
    baseRevision: "1",
    intent: "assert",
    nodeId: "whale",
    text: "cetacean",
    parentId: "mammal",
  });
  expect(child.outcome).toBe("applied");
  if (child.outcome !== "applied") return;

  const renamed = applyCommand(child.log, {
    commandId: "c-rename",
    baseRevision: "2",
    intent: "rename",
    nodeId: "whale",
    text: "Whale",
  });
  expect(renamed.outcome).toBe("applied");
  if (renamed.outcome !== "applied") return;
  expect(renamed.log.records.find((record) => record.id === "whale")).toEqual({
    id: "whale",
    text: "Whale",
    parentId: "mammal",
  });

  const subtree = applyCommand(renamed.log, {
    commandId: "c-subtree",
    baseRevision: "3",
    intent: "delete",
    nodeId: "mammal",
  });
  expect(subtree.outcome).toBe("applied");
  if (subtree.outcome !== "applied") return;
  expect(subtree.log.records.map((record) => record.id)).toEqual(["root"]);

  const moved = applyCommand(renamed.log, {
    commandId: "c-reparent",
    baseRevision: "3",
    intent: "reparent",
    nodeId: "whale",
    parentId: "root",
  });
  expect(moved.outcome).toBe("applied");
  if (moved.outcome !== "applied") return;
  expect(moved.log.records.find((record) => record.id === "whale")?.parentId).toBe("root");

  const removed = applyCommand(moved.log, {
    commandId: "c-delete",
    baseRevision: "4",
    intent: "delete",
    nodeId: "mammal",
  });
  expect(removed.outcome).toBe("applied");
  if (removed.outcome !== "applied") return;
  expect(removed.log.revision).toBe("5");
  expect(removed.log.records.map((record) => record.id)).toEqual(["root", "whale"]);
  expect(removed.log.appliedCommandIds).toEqual(["c-assert", "c-child", "c-rename", "c-reparent", "c-delete"]);

  const cycle = applyCommand(removed.log, {
    commandId: "c-cycle",
    baseRevision: "5",
    intent: "reparent",
    nodeId: "root",
    parentId: "whale",
  });
  expect(cycle.outcome).toBe("rejected");
  if (cycle.outcome === "rejected") expect(cycle.reason).toBe("cycle");
  expect(cycle.log.revision).toBe("5");

  const rootDelete = applyCommand(removed.log, {
    commandId: "c-root",
    baseRevision: "5",
    intent: "delete",
    nodeId: "root",
  });
  expect(rootDelete.outcome).toBe("rejected");
  if (rootDelete.outcome === "rejected") expect(rootDelete.reason).toBe("root-delete");
  expect(rootDelete.log.records.map((record) => record.id)).toEqual(["root", "whale"]);
});

it("同じ commandId の再送は適用しない", () => {
  const assertNode = {
    commandId: "c-once",
    baseRevision: "0",
    intent: "assert" as const,
    nodeId: "mammal",
    text: "Mammals",
    parentId: "root",
  };
  const once = applyCommand(log, assertNode);
  expect(once.outcome).toBe("applied");
  if (once.outcome !== "applied") return;

  const again = applyCommand(once.log, assertNode);
  expect(again.outcome).toBe("ignored");
  expect(again.log).toBe(once.log);
  expect(again.log.records.filter((record) => record.id === "mammal")).toHaveLength(1);
  expect(again.log.revision).toBe("1");

  const later = applyCommand(once.log, { ...assertNode, baseRevision: "0", text: "Other" });
  expect(later.outcome).toBe("ignored");
  expect(later.log.records.find((record) => record.id === "mammal")?.text).toBe("Mammals");
  expect(later.log.appliedCommandIds).toEqual(["c-once"]);
});

it("現在と違う base revision は拒否する", () => {
  const once = applyCommand(log, {
    commandId: "c-assert",
    baseRevision: "0",
    intent: "assert",
    nodeId: "mammal",
    text: "Mammals",
    parentId: "root",
  });
  expect(once.outcome).toBe("applied");
  if (once.outcome !== "applied") return;

  const stale = applyCommand(once.log, {
    commandId: "c-stale",
    baseRevision: "0",
    intent: "rename",
    nodeId: "mammal",
    text: "Old",
  });
  expect(stale.outcome).toBe("rejected");
  if (stale.outcome === "rejected") expect(stale.reason).toBe("stale-revision");
  expect(stale.log).toBe(once.log);
  expect(stale.log.revision).toBe("1");
  expect(stale.log.records.find((record) => record.id === "mammal")?.text).toBe("Mammals");
  expect(stale.log.appliedCommandIds).toEqual(["c-assert"]);

  const retried = applyCommand(stale.log, {
    commandId: "c-stale",
    baseRevision: "1",
    intent: "rename",
    nodeId: "mammal",
    text: "Whale",
  });
  expect(retried.outcome).toBe("applied");
  if (retried.outcome !== "applied") return;
  expect(retried.log.records.find((record) => record.id === "mammal")?.text).toBe("Whale");
  expect(retried.log.revision).toBe("2");
});

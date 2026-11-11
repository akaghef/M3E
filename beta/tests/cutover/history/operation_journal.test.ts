import { expect, test } from "vitest";
import {
  appendOperation,
  createOperationJournal,
  redo,
  subject,
  undo,
} from "../../../src/cutover/history/operation_journal";

type Label = { text: string };

test("three operations undo once to the previous subject, redo restores it, and a resend is not stored twice", () => {
  const op1 = { operationId: "op-1", before: { text: "" }, after: { text: "one" } };
  const op2 = { operationId: "op-2", before: { text: "one" }, after: { text: "two" } };
  const op3 = { operationId: "op-3", before: { text: "two" }, after: { text: "three" } };

  const stacked = [op1, op2, op3].reduce(
    (journal, operation) => appendOperation(journal, operation),
    createOperationJournal<Label>({ text: "" }),
  );

  expect(stacked.operations.map((operation) => operation.operationId)).toEqual(["op-1", "op-2", "op-3"]);
  expect(stacked.cursor).toBe(2);
  expect(subject(stacked)).toEqual({ text: "three" });
  expect(stacked.operations[2]?.before).toEqual(stacked.operations[1]?.after);

  const undone = undo(stacked);
  expect(undone).not.toBe(stacked);
  expect(stacked.cursor).toBe(2);
  expect(undone.cursor).toBe(1);
  expect(subject(undone)).toEqual({ text: "two" });

  const redone = redo(undone);
  expect(subject(redone)).toEqual({ text: "three" });
  expect(redone.cursor).toBe(2);

  const resent = appendOperation(redone, op3);
  expect(resent).toBe(redone);
  expect(resent.operations).toHaveLength(3);

  const resentWhileUndone = appendOperation(undone, op3);
  expect(resentWhileUndone).toBe(undone);
  expect(resentWhileUndone.operations).toHaveLength(3);
  expect(subject(resentWhileUndone)).toEqual({ text: "two" });

  const viewed = subject(redone);
  viewed.text = "mutated";
  expect(subject(redone)).toEqual({ text: "three" });
});

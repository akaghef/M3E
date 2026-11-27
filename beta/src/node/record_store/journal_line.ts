// A journal line's record operations and its `touched` field.
//
// `touched` lists the records whose canonical value a commit changed, with the kinds of change.
// The store derives it from the commit's record operations and the records before the commit;
// clients never send it. A change of `rev` alone is not a change.
//
// Spec: Database_Spec.md 6.

import { createHash } from "crypto";
import { sameJson } from "../../shared/record_model/steady";
import type { SnapshotRecord } from "../../shared/record_model/types";
import type { RecordOp } from "../neo4j_store/apply";

export type { RecordOp };

/** The record operations one commit writes to Neo4j, including its commit record and the snapshot header. */
export interface CommitOps {
  seq: number;
  ops: RecordOp[];
}

export interface TouchedRecord {
  rk: string;
  /** Kinds of change, prefixed names in string order. Readers ignore kinds they do not know. */
  ev: string[];
}

/** Parent edge and scope membership. Sibling order is separate (`m3e:order`). */
const REPARENT_FIELDS: Record<string, ReadonlySet<string>> = {
  connection: new Set(["source", "target", "scopeId", "type"]),
  scope: new Set(["rootNodeId"]),
};
const ORDER_FIELDS: Record<string, ReadonlySet<string>> = {
  connection: new Set(["ord"]),
};

function validityTo(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const to = (value as { to?: unknown }).to;
  return typeof to === "string" && to !== "" ? to : undefined;
}

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function fieldsOf(record: SnapshotRecord | undefined): Record<string, unknown> {
  return (record ?? {}) as Record<string, unknown>;
}

/** The kinds of change between two versions of one record; empty when only `rev` differs. */
function changeKinds(before: SnapshotRecord, after: SnapshotRecord): string[] {
  const a = fieldsOf(before);
  const b = fieldsOf(after);
  const kinds = new Set<string>();
  const reparent = REPARENT_FIELDS[after.kind];
  const order = ORDER_FIELDS[after.kind];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (key === "rev") continue;
    if (sameJson(a[key], b[key])) continue;
    // Section 6 names no event kind for nodeView position. A position-only change emits nothing.
    if (after.kind === "nodeView" && (key === "x" || key === "y")) continue;
    if (key === "valid") {
      // Filling valid.to ends the entity. A from-only change has no named kind.
      if (validityTo(a[key]) === undefined && validityTo(b[key]) !== undefined) kinds.add("m3e:end");
      continue;
    }
    if (key === "attributes") kinds.add("m3e:attribute");
    else if (key === "extensions") kinds.add("m3e:extension");
    else if (reparent?.has(key)) kinds.add("m3e:reparent");
    else if (order?.has(key)) kinds.add("m3e:order");
    else kinds.add("m3e:content");
  }
  return [...kinds].sort();
}

/**
 * The records a commit changes. `before` reads the record set as it was before the commit.
 * Sorted by rk; one entry per rk.
 */
export function touchedOf(ops: readonly RecordOp[], before: (rk: string) => SnapshotRecord | undefined): TouchedRecord[] {
  const last = new Map<string, RecordOp>();
  for (const op of ops) last.set(op.rk, op);
  const touched: TouchedRecord[] = [];
  for (const [rk, op] of last) {
    const prior = before(rk);
    let ev: string[];
    if (op.op === "delete") {
      if (prior === undefined) continue;
      ev = ["m3e:delete"];
    } else if (prior === undefined) {
      ev = ["m3e:create"];
    } else {
      ev = changeKinds(prior, op.record as SnapshotRecord);
      if (ev.length === 0) continue;
    }
    touched.push({ rk, ev });
  }
  return touched.sort((x, y) => (x.rk < y.rk ? -1 : x.rk > y.rk ? 1 : 0));
}

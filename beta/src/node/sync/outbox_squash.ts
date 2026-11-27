import { randomUUID } from "node:crypto";
import { sameValue, type RecordChange } from "../../shared/map_changes";
import type { OutboxEntry } from "./outbox";

type Bag = Record<string, unknown>;
const fields = (change: RecordChange) => new Set([...Object.keys(change.before ?? {}), ...Object.keys(change.after ?? {})]);
function assign(target: Bag, source: Bag, keys: Iterable<string>): void {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
    else delete target[key];
  }
}

/** Compose only the records carried by an unsent run; never read the working store. */
function merge(run: OutboxEntry[]): OutboxEntry[] {
  if (run.length < 2) return run;
  const changes = new Map<string, { change: RecordChange; touched: Set<string> }>();
  for (const entry of run) for (const next of entry.command.changes) {
    const key = JSON.stringify([next.kind, next.key]);
    const accumulated = changes.get(key);
    const previous = accumulated?.change;
    if (!previous) {
      changes.set(key, { change: { ...next, before: { ...next.before }, after: { ...next.after } }, touched: fields(next) });
      continue;
    }
    // Re-creation and invalid chains are not the decided create/delete cancellation.
    // Retain the original Commands rather than changing their preconditions.
    if (previous.op === "delete" || next.op === "create") return run;
    if (previous.op === "create") {
      if (next.op === "delete") changes.delete(key);
      else assign(previous.after!, next.after ?? {}, fields(next));
    } else if (next.op === "delete") {
      const before = { ...next.before };
      assign(before, previous.before ?? {}, accumulated!.touched);
      changes.set(key, { change: { kind: next.kind, key: next.key, op: "delete", before }, touched: new Set(Object.keys(before)) });
    } else {
      const seen = accumulated!.touched;
      for (const field of fields(next)) {
        if (!seen.has(field)) assign(previous.before!, next.before ?? {}, [field]);
        seen.add(field);
      }
      assign(previous.after!, next.after ?? {}, fields(next));
    }
  }
  const result = [...changes.values()].map(({ change }) => change).filter((change) => change.op !== "update" || !sameValue(change.before, change.after));
  if (result.length === 0) return [];
  const first = run[0]!;
  const commandId = randomUUID();
  return [{ ...first, commandId, command: { ...first.command, commandId, changes: result } }];
}

export function squashUnsent(entries: OutboxEntry[], protectedIds: ReadonlySet<string>): OutboxEntry[] {
  const result: OutboxEntry[] = [];
  let run: OutboxEntry[] = [];
  const flush = () => { for (const entry of merge(run)) result.push(entry); run = []; };
  for (const entry of entries) {
    // Legacy entries have no proof that they have never been sent.
    if (entry.attempted !== false || protectedIds.has(entry.commandId) || entry.mapOp !== undefined) {
      flush(); result.push(entry); continue;
    }
    const first = run[0];
    if (first && (entry.mapId !== first.mapId || entry.issuer !== first.issuer
      || !sameValue(entry.command.actor, first.command.actor)
      || !sameValue(entry.command.provenance, first.command.provenance)
      || entry.command.reason !== first.command.reason || entry.command.confirm !== first.command.confirm)) flush();
    run.push(entry);
  }
  flush();
  return result;
}

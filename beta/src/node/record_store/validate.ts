// The app's own structural validation of a map state: what
// `RapidMvpModel.fromJSON(state).validate()` returns.
//
// `fromJSON` first copies the whole state through JSON text and then replaces every node and link
// by its normalised form; on a 20,000-node map that costs about 30 ms per commit, more than
// everything else in a commit together. Neither step changes what `validate` reports for the
// states of the record store:
//   - the copy changes nothing for plain JSON data, and these states are (they are built from
//     parsed records and from changes that went through JSON);
//   - `validate` normalises every node and link itself before it looks at the normalised fields,
//     normalising twice gives the same as once, and the fields it reads without normalising
//     (`id`, `parentId`, `children`, link `attributes`) are not changed by normalising.
// So this runs the model's `validate` on the state as it is. The state is not modified.
// tests/unit/record_store_validate.test.ts holds this against `fromJSON(state).validate()`.

import type { AppState } from "../../shared/types";
import { RapidMvpModel } from "../rapid_mvp";

export function validateState(state: object): string[] {
  const source = state as AppState;
  const model = new RapidMvpModel("tmp");
  const nodes = source.nodes && typeof source.nodes === "object" ? source.nodes : {};
  model.state = { ...source, nodes };
  return model.validate();
}

/** Number of validation errors; infinite when the state cannot be validated at all. */
export function validationErrorCount(state: object): number {
  try {
    return validateState(state).length;
  } catch {
    try {
      return RapidMvpModel.fromJSON(state as AppState).validate().length;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }
}

/**
 * Errors the viewer model still reports, and that a commit no longer counts.
 * Database_Spec 3.2: an alias may have children. Invariant 3 rejects an alias
 * whose target is an alias; that check is the commit's, not this model's.
 */
const SUPERSEDED_AT_COMMIT = [/cannot have children\./, /cannot target alias node /];

function countCommitFailures(errors: string[]): number {
  return errors.filter((error) => !SUPERSEDED_AT_COMMIT.some((pattern) => pattern.test(error))).length;
}

/** Validation errors that still refuse a commit. Infinite when the state cannot be validated. */
export function commitValidationErrorCount(state: object): number {
  try {
    return countCommitFailures(validateState(state));
  } catch {
    try {
      return countCommitFailures(RapidMvpModel.fromJSON(state as AppState).validate());
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }
}

/**
 * Node fields `validate` never reads: it reads ids, `parentId`, `children`, the alias fields
 * (`nodeType`, `access`, `targetNodeId`, `isBroken`, `targetSnapshotLabel`), `edgeOutsideScope`,
 * `scopeId` and the relation edges. A Command that only updates these fields on existing nodes
 * leaves the validation result as it was, so a commit need not walk the whole map again.
 */
const CONTENT_ONLY_NODE_FIELDS = new Set(["text", "details", "note", "collapsed", "link"]);

/** True when every change updates only `CONTENT_ONLY_NODE_FIELDS` of an existing node. */
export function validationUnaffected(changes: readonly { kind: string; op: string; before?: Record<string, unknown>; after?: Record<string, unknown> }[]): boolean {
  if (changes.length === 0) return false;
  for (const change of changes) {
    if (change.kind !== "node" || change.op !== "update") return false;
    for (const side of [change.before, change.after]) {
      if (!side) continue;
      for (const field of Object.keys(side)) if (!CONTENT_ONLY_NODE_FIELDS.has(field)) return false;
    }
  }
  return true;
}

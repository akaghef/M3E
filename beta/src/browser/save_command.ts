/**
 * Build the Command for one viewer save.
 * The state transition is `changes`. `intent` is only the audit classification:
 * a viewer save may touch several record kinds at once, so it uses `assert`.
 */
import { diffState, type MapCommand, type RecordChange } from "../shared/map_changes";

export function buildSaveCommand(before: object, after: object, tabId: string): MapCommand {
  const changes = diffState(before, after);
  return {
    commandId: commandId(changes),
    actor: { kind: "human", id: tabId },
    intent: "assert",
    provenance: { tabId },
    changes,
  };
}

function commandId(changes: readonly RecordChange[]): string {
  const text = JSON.stringify(changes);
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ code, 0x01000193);
  }
  return `cmd_${(left >>> 0).toString(16).padStart(8, "0")}${(right >>> 0).toString(16).padStart(8, "0")}`;
}

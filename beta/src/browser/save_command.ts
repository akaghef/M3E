/**
 * One viewer save as a Command.
 * The state transition is `changes`. `intent` is only the audit classification:
 * a viewer save may touch several record kinds at once, so it uses `assert`.
 */
import { diffState, type MapCommand, type RecordChange } from "../shared/map_changes";

const JSON_HEADERS = "application/json; charset=utf-8";

/** The Command that was sent but not yet confirmed, kept so that a resend of the same edit reuses its id. */
let unconfirmed: { commandId: string; changesJson: string } | null = null;

function newCommandId(): string {
  return `cmd_${globalThis.crypto.randomUUID()}`;
}

/**
 * A new save gets a new commandId. Only a resend of the identical, still
 * unconfirmed changes reuses the id, so the server applies it once.
 * The id must not be derived from the changes: the same edit made again later
 * (rename back and forth, collapse twice) is a different Command.
 */
export function buildSaveCommand(before: object, after: object, tabId: string): MapCommand {
  return commandForChanges(diffState(before, after), tabId);
}

/** The Command for changes that are already computed (scope view). Same commandId rule as `buildSaveCommand`. */
export function commandForChanges(changes: RecordChange[], tabId: string): MapCommand {
  const changesJson = JSON.stringify(changes);
  if (!unconfirmed || unconfirmed.changesJson !== changesJson) {
    unconfirmed = { commandId: newCommandId(), changesJson };
  }
  return {
    commandId: unconfirmed.commandId,
    actor: { kind: "human", id: tabId },
    intent: "assert",
    changes,
  };
}

/** The sent Command was confirmed or rejected (any status below 500), or there was nothing to send. */
export function settleSaveCommand(): void {
  unconfirmed = null;
}

/**
 * Sends the edits since `base` as one Command.
 * Nothing changed: no request, answers as saved at `savedAt`.
 * The map has no row yet (404): falls back to the whole-map save.
 */
export async function postSaveCommand(
  saveUrl: string,
  tabId: string,
  base: object,
  state: object,
  savedAt: string | null,
  wholeBody: () => string,
): Promise<Response> {
  const headers = { "Content-Type": JSON_HEADERS, "X-M3E-Tab-Id": tabId };
  const command = buildSaveCommand(base, state, tabId);
  if (command.changes.length === 0) {
    unconfirmed = null;
    return new Response(JSON.stringify(savedAt ? { ok: true, savedAt } : { ok: true }), { status: 200, headers: { "Content-Type": JSON_HEADERS } });
  }
  const response = await fetch(`${saveUrl}/commands`, { method: "POST", headers, body: JSON.stringify(command) });
  if (response.status === 404) {
    unconfirmed = null;
    return fetch(saveUrl, { method: "POST", headers, body: wholeBody() });
  }
  // Confirmed or rejected: either way the next save is a new Command.
  if (response.status < 500) unconfirmed = null;
  return response;
}

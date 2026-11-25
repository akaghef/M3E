/**
 * One viewer save as a Command.
 * The state transition is `changes`. `intent` is only the audit classification:
 * a viewer save may touch several record kinds at once, so it uses `assert`.
 */
import { diffState, sameValue, type MapCommand, type RecordChange } from "../shared/map_changes";

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
  // Undefined fields disappear on the wire; compare the actual JSON payload.
  changes = JSON.parse(JSON.stringify(changes)) as RecordChange[];
  changes = changes.filter(change => change.op !== "update"
    || !sameValue(change.before ?? {}, change.after ?? {}));
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
  changes?: RecordChange[],
): Promise<Response> {
  const headers = { "Content-Type": JSON_HEADERS, "X-M3E-Tab-Id": tabId };
  const command = changes ? commandForChanges(changes, tabId) : buildSaveCommand(base, state, tabId);
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


type Bag = Record<string, any>;
const collections = new Set(["nodes", "links", "scopes", "surfaces", "annotations", "linearNotesByScope"]);
const copy = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
const has = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);

/** Complete write set for an edit. Omission means unknown, never "nothing changed". */
export type SaveTouches = Partial<Record<"nodes" | "links" | "scopes" | "surfaces" | "annotations" | "linearNotesByScope" | "$map", readonly string[]>>;

/** Owns a JSON baseline. Reads of the live state are ordinary object reads. */
export class SaveStateTracker<T extends object> {
  private full = false;
  private dirty = new Map<string, Set<string>>();

  constructor(readonly base: T, readonly state: T) {}

  get needsFullSave(): boolean { return this.full; }

  mark(touches?: SaveTouches): void {
    if (!touches) { this.full = true; return; }
    for (const [field, ids] of Object.entries(touches)) {
      const pending = this.dirty.get(field) ?? new Set<string>();
      for (const id of ids) pending.add(id);
      this.dirty.set(field, pending);
    }
  }

  capture(): { changes: RecordChange[]; materialize(): T; accept(): void; retry(): void } {
    const full = this.full;
    const dirty = this.dirty;
    const base = this.base as Bag;
    const live = this.state as Bag;
    // Only these copies survive the asynchronous request. Never keep a reference
    // to a mutable edited entry as the submitted baseline.
    const snapshot = full ? copy(live) : null;
    const patches = new Map<string, Bag>();
    const presence = new Map<string, boolean>();
    if (!full) {
      for (const [field, ids] of dirty) {
        const patch: Bag = {};
        if (field === "$map") {
          for (const id of ids) patch[id] = copy(live[id]);
        } else {
          presence.set(field, has(live, field));
          // Array annotations carry index/shape semantics: use the full fallback.
          if (!collections.has(field) || Array.isArray(live[field]) || Array.isArray(base[field])) {
            this.full = true;
            return this.capture();
          }
          for (const id of ids) patch[id] = copy(live[field]?.[id]);
        }
        patches.set(field, patch);
      }
    }
    const changes = diffState(base, snapshot ?? live, full ? undefined : dirty);
    this.full = false;
    this.dirty = new Map();
    const apply = (target: Bag, ownCollections: boolean): void => {
      for (const [field, patch] of patches) {
        if (field !== "$map" && !presence.get(field)) { delete target[field]; continue; }
        const destination = field === "$map" ? target
          : (target[field] = ownCollections ? { ...target[field] } : target[field] ?? {});
        for (const [id, value] of Object.entries(patch)) {
          if (value === undefined) delete destination[id];
          else destination[id] = value;
        }
      }
    };
    return {
      changes,
      // Whole-map POST is rare (404/force); pay for the dictionary copies only then.
      materialize: () => {
        if (snapshot) return snapshot as T;
        const submitted = { ...base };
        apply(submitted, true);
        return submitted as T;
      },
      accept: () => {
        if (snapshot) {
          for (const key of Object.keys(base)) delete base[key];
          Object.assign(base, snapshot);
        } else apply(base, false);
      },
      retry: () => {
        if (full) this.full = true;
        for (const [field, ids] of dirty) {
          const pending = this.dirty.get(field) ?? new Set<string>();
          for (const id of ids) pending.add(id);
          this.dirty.set(field, pending);
        }
      },
    };
  }
}

/**
 * One viewer save as a Command.
 * The state transition is `changes`. `intent` is only the audit classification:
 * a viewer save may touch several record kinds at once, so it uses `assert`.
 */
import { keysBetween, isOrderKey } from "../shared/record_model/order_key";
import { applyChanges, diffState, nonEmptyChanges, acceptEdgeOrders, type MapCommand, type RecordChange } from "../shared/map_changes";

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
  changes = nonEmptyChanges(changes);
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
  // A supplied capture owns acknowledgement, including edits made while awaiting this response.
  // Confirmed or rejected: either way the next save is a new Command.
  if (response.ok && !changes) acceptEdgeOrders(state, command.changes);
  if (response.status < 500) unconfirmed = null;
  return response;
}


type Bag = Record<string, any>;
const collections = new Set(["nodes", "links", "scopes", "surfaces", "annotations", "linearNotesByScope"]);
const copy = <T>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
const has = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);

/** Complete write set for an edit. Omission means unknown, never "nothing changed". */
export type SaveTouches = Partial<Record<"nodes" | "links" | "scopes" | "surfaces" | "annotations" | "linearNotesByScope" | "$map" | "edges", readonly string[]>>;

/** Owns a JSON baseline. Reads of the live state are ordinary object reads. */
export class SaveStateTracker<T extends object> {
  private full = false;
  private dirty = new Map<string, Set<string>>();
  private unknownTopology = false;

  private edgeChildren = new Map<string, Map<string, string>>();
  private indexedEdges: boolean;

  constructor(readonly base: T, readonly state: T, options: { indexedEdges?: boolean } = {}) {
    this.indexedEdges = options.indexedEdges === true;
    if (this.indexedEdges) this.indexBaseline();
  }

  private indexBaseline(): void {
    this.indexedEdges = true; this.edgeChildren.clear();
    // Called at load or a whole-state replacement, never on a keyed capture.
    for (const node of Object.values((this.base as Bag).nodes ?? {}) as Bag[]) {
      if (typeof node.parentId !== "string") continue;
      if (!isOrderKey(node.edgeOrder)) { this.indexedEdges = false; this.edgeChildren.clear(); break; }
      let children = this.edgeChildren.get(node.parentId);
      if (!children) this.edgeChildren.set(node.parentId, children = new Map());
      children.set(node.id, node.edgeOrder);
    }
  }

  /** Called at the write site, where the new array position is already known. */
  markParentEdge(id: string, index: number): void {
    if (!this.indexedEdges) { this.mark(); return; }
    const live = this.state as Bag, node = live.nodes[id], parent = live.nodes[node.parentId];
    const list = parent.children as string[];
    // Missing keys belong to newly inserted neighbours. Fill only that contiguous new block.
    let lo = index, hi = index;
    while (lo > 0 && !isOrderKey(live.nodes[list[lo - 1]]?.edgeOrder)) lo--;
    while (hi + 1 < list.length && !isOrderKey(live.nodes[list[hi + 1]]?.edgeOrder)) hi++;
    const left = lo ? live.nodes[list[lo - 1]].edgeOrder : undefined;
    const right = hi + 1 < list.length ? live.nodes[list[hi + 1]].edgeOrder : undefined;
    const keys = keysBetween(left, right, hi - lo + 1), ids: string[] = [];
    for (let i = lo; i <= hi; i++) { live.nodes[list[i]].edgeOrder = keys[i - lo]; ids.push(list[i]); }
    this.mark({ nodes: [...ids, node.parentId], edges: ids });
  }

  /** A peer's acknowledged delta updates only its baseline fields. Pending local
   * edits remain dirty. The callback omits child slots when edge keys own order. */
  acceptExternal(touches: SaveTouches, apply: (base: T, keyed: boolean) => void): void {
    const keyed = this.indexedEdges && Boolean(touches.edges?.length);
    const base = this.base as Bag, parents = new Set<string>();
    if (keyed) for (const id of touches.edges!) {
      const parent = base.nodes?.[id]?.parentId;
      if (typeof parent === "string") { parents.add(parent); this.edgeChildren.get(parent)?.delete(id); }
    }
    apply(this.base, keyed);
    if (keyed) for (const id of touches.edges!) {
      const node = base.nodes?.[id], parent = node?.parentId;
      if (typeof parent !== "string") continue;
      parents.add(parent);
      let children = this.edgeChildren.get(parent);
      if (!children) this.edgeChildren.set(parent, children = new Map());
      children.set(id, node.edgeOrder);
    }
    for (const parent of parents) this.installChildOrder(parent);
  }

  private installChildOrder(parent: string): void {
    const base = this.base as Bag;
    if (base.nodes[parent]) Object.defineProperty(base.nodes[parent], "children", {
      enumerable: true, configurable: true, get: () => [...(this.edgeChildren.get(parent) ?? [])]
        .sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0).map(([id]) => id),
    });
  }

  get needsFullSave(): boolean { return this.full; }
  get hasIndexedEdges(): boolean { return this.indexedEdges; }

  mark(touches?: SaveTouches): void {
    if (!touches) { this.full = true; return; }
    if (touches.nodes && !touches.edges) this.unknownTopology = true;
    for (const [name, ids] of Object.entries(touches)) {
      const field = name === "edges" ? "$edges" : name;
      const pending = this.dirty.get(field) ?? new Set<string>();
      for (const id of ids) pending.add(id);
      this.dirty.set(field, pending);
    }
  }

  capture(): { changes: RecordChange[]; materialize(): T; accept(): void; retry(): void } {
    const full = this.full;
    const unknownTopology = this.unknownTopology;
    const keyed = !full && !unknownTopology && this.indexedEdges && this.dirty.has("$edges");
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
        if (field === "$edges") continue;
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
          for (const id of ids) {
            const value = live[field]?.[id];
            if (keyed && field === "nodes" && value && base.nodes?.[id]) {
              const node: Bag = {};
              for (const key of Object.keys(value)) if (key !== "children") node[key] = copy(value[key]);
              patch[id] = node;
            } else patch[id] = copy(value);
          }
        }
        patches.set(field, patch);
      }
    }
    const diffEntries = !keyed && dirty.has("$edges") ? new Map([...dirty].filter(([key]) => key !== "$edges")) : dirty;
    const changes = diffState(base, snapshot ?? live, full ? undefined : diffEntries);
    const submittedEdges = new Map((keyed ? [] : changes.filter(change => change.kind === "edge")).map(change => {
      const node = live.nodes?.[change.key[0]];
      return [change.key[0], [node?.parentId, node?.edgeOrder]] as const;
    }));
    this.full = false;
    this.dirty = new Map();
    this.unknownTopology = false;
    const apply = (target: Bag, ownCollections: boolean): void => {
      for (const [field, patch] of patches) {
        if (field !== "$map" && !presence.get(field)) { delete target[field]; continue; }
        const destination = field === "$map" ? target
          : (target[field] = ownCollections ? { ...target[field] } : target[field] ?? {});
        for (const [id, value] of Object.entries(patch)) {
          if (value === undefined) delete destination[id];
          else if (keyed && field === "nodes" && !has(value, "children")) {
            const previous = destination[id];
            destination[id] = { ...value };
            Object.defineProperty(destination[id], "children", Object.getOwnPropertyDescriptor(previous, "children") ?? { value: [], enumerable: true, configurable: true, writable: true });
          } else destination[id] = value;
        }
      }
    };
    return {
      changes,
      // Whole-map POST is rare (404/force); pay for the dictionary copies only then.
      materialize: () => {
        if (snapshot) return snapshot as T;
        if (keyed) {
          const result = applyChanges(base, changes);
          if (!result.ok) throw new Error("Captured save no longer matches its baseline.");
          return result.state as T;
        }
        const submitted = { ...base };
        apply(submitted, true);
        return submitted as T;
      },
      accept: () => {
        if (snapshot) {
          for (const key of Object.keys(base)) delete base[key];
          Object.assign(base, snapshot);
        } else apply(base, false);
        acceptEdgeOrders(base, changes);
        if (!keyed) acceptEdgeOrders(live, changes.filter(change => {
          const submitted = submittedEdges.get(change.key[0]), node = live.nodes?.[change.key[0]];
          return submitted && node?.parentId === submitted[0] && node?.edgeOrder === submitted[1];
        }));
        if (snapshot) this.indexBaseline();
        else if (this.indexedEdges) {
          const parents = new Set<string>();
          for (const change of changes) {
            if (change.kind !== "edge") continue;
            const id = change.key[0], from = change.before?.parentId, to = change.after?.parentId;
            if (typeof from === "string") { parents.add(from); this.edgeChildren.get(from)?.delete(id); }
            if (typeof to === "string") {
              parents.add(to);
              let children = this.edgeChildren.get(to);
              if (!children) this.edgeChildren.set(to, children = new Map());
              children.set(id, change.after!.ord as string);
            }
          }
          for (const parent of parents) this.installChildOrder(parent);
        }
      },
      retry: () => {
        if (full) this.full = true;
        this.unknownTopology ||= unknownTopology;
        for (const [field, ids] of dirty) {
          const pending = this.dirty.get(field) ?? new Set<string>();
          for (const id of ids) pending.add(id);
          this.dirty.set(field, pending);
        }
      },
    };
  }
}

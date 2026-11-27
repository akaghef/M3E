import { randomUUID } from "crypto";

/** An opaque, process-scoped cursor; seq alone cannot detect a replaced local working store. */
export interface MapRecordChange {
  mapId: string;
  previousRevision: string;
  revision: string;
  seq: number;
  savedAt: string;
  recordKeys: string[];
}

/** Bounded per-map change chains. Neither append nor lookup walks unrelated records/commits. */
export class MapRecordChanges {
  private generation = randomUUID();
  private readonly maps = new Map<string, {
    revision: string; seq: number; savedAt: string;
    events: Map<string, MapRecordChange>; keys: number;
  }>();
  private readonly listeners = new Set<(event: MapRecordChange) => void>();
  constructor(private readonly retainedKeys = 4096) {}

  cursor(mapId: string, seq: number) {
    const map = this.maps.get(mapId);
    return { revision: map?.revision ?? `${this.generation}:0`, seq: map?.seq ?? seq };
  }

  latest(mapId: string, seq: number) {
    const map = this.maps.get(mapId);
    // A retained event is also indexed by its predecessor; the tail is stored separately
    // through its predecessor cursor so there is no scan of the history.
    const last = this.tails.get(mapId);
    const event = last === undefined ? undefined : map?.events.get(last);
    return event ?? { mapId, ...this.cursor(mapId, seq), fullReadRequired: true as const };
  }
  private readonly tails = new Map<string, string>();

  append(mapId: string, seq: number, savedAt: string, keys: Set<string>): void {
    if (keys.size === 0) return;
    let map = this.maps.get(mapId);
    if (!map) {
      map = { revision: this.cursor(mapId, seq).revision, seq, savedAt, events: new Map(), keys: 0 };
      this.maps.set(mapId, map);
    }
    const event: MapRecordChange = { mapId, previousRevision: map.revision,
      revision: `${this.generation}:${seq}`, seq, savedAt, recordKeys: [...keys] };
    map.events.set(event.previousRevision, event);
    this.tails.set(mapId, event.previousRevision);
    map.revision = event.revision; map.seq = seq; map.savedAt = savedAt;
    map.keys += keys.size;
    while (map.keys > this.retainedKeys) {
      const first = map.events.entries().next().value!;
      map.keys -= first[1].recordKeys.length;
      map.events.delete(first[0]);
    }
    // Commit callers finish their derived caches before any observer can read them.
    for (const listener of this.listeners) queueMicrotask(() => {
      if (this.listeners.has(listener)) {
        try { listener(event); } catch { /* an observer must never undo a durable commit */ }
      }
    });
  }

  since(mapId: string, revision: string, seq: number): { revision: string; seq: number; recordKeys: string[] } | null {
    const cursor = this.cursor(mapId, seq);
    const events = this.maps.get(mapId)?.events;
    const keys = new Set<string>();
    while (revision !== cursor.revision) {
      const event = events?.get(revision);
      if (!event) return null;
      for (const key of event.recordKeys) keys.add(key);
      revision = event.revision;
    }
    return { ...cursor, recordKeys: [...keys] };
  }

  /** Forgets every chain: after the store is read again from Neo4j, every client reads its map in full. */
  reset(): void {
    this.generation = randomUUID();
    this.maps.clear();
    this.tails.clear();
  }

  subscribe(listener: (event: MapRecordChange) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}

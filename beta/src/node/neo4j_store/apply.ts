// Incremental writes for the record store: record operations of one commit and the marker that
// says which commit the database holds. `load` / `dump` in ./store.ts are unchanged; a database
// kept current with `applyCommit` dumps the same records, and carries the same derived
// relationships, as a fresh `load` of the same record set, with one exception: an `ALIAS_OF`
// relationship from an alias that existed before its target is not added when the target is
// created later (the alias target is not stored as a queryable property).

import type { Driver, ManagedTransaction, Session } from "neo4j-driver";
import neo4j from "neo4j-driver";
import type { RecordKind, SnapshotRecord } from "../../shared/record_model/types";
import {
  COMMON_LABEL,
  storeLabel,
  KIND_LABELS,
  RELATIONSHIP_TYPES,
  cypherLabelList,
  encodeRecord,
  type PropertyMap,
  type RelationshipType,
} from "./encoding";

export const MARKER_LABEL = "RecordStoreMarker";
/** Marker name of the single store a database held before stores were named. */
export const DEFAULT_MARKER = "record-store";

export interface RecordOp {
  op: "put" | "delete";
  rk: string;
  record?: SnapshotRecord;
}

export interface StoreMarker {
  workspaceId: string;
  appliedSeq: number;
}

export interface EngineState {
  /** Number of record nodes. */
  records: number;
  marker: StoreMarker | null;
  /** The snapshot header record, when the database holds one. */
  header: StoreMarker | null;
}

type Runner = Pick<Session, "run"> | Pick<ManagedTransaction, "run">;

function toNumber(value: unknown): number {
  return neo4j.isInt(value) ? value.toNumber() : Number(value);
}

/** Properties read by the reverse lookups of `applyOps`; indexed so that a lookup is not a scan. */
const REFERENCE_PROPERTIES = ["f_source", "f_target", "f_rootNodeId", "f_nodeId", "f_scopeId", "f_surfaceId", "f_mapId"];

/** Constraint and indexes the incremental writes rely on. Safe to run again. */
/**
 * Constraint and indexes the writes rely on, made once for the whole database: every record node
 * carries the name of its store (`store`), and `(store, rk)` is unique. Safe to run again.
 */
export async function ensureSchema(session: Session): Promise<void> {
  await session.run(`CREATE CONSTRAINT rec_store_rk IF NOT EXISTS FOR (r:${COMMON_LABEL}) REQUIRE (r.store, r.rk) IS UNIQUE`);
  await session.run(`CREATE INDEX rec_store_id IF NOT EXISTS FOR (r:${COMMON_LABEL}) ON (r.store, r.id)`);
  for (const property of REFERENCE_PROPERTIES) {
    await session.run(`CREATE INDEX rec_store_${property} IF NOT EXISTS FOR (r:${COMMON_LABEL}) ON (r.store, r.${property})`);
  }
  await session.run("CALL db.awaitIndexes(600)");
}

export async function readEngineState(runner: Runner, store: string = DEFAULT_MARKER): Promise<EngineState> {
  const count = await runner.run(`MATCH (r:${COMMON_LABEL} {store: $store}) RETURN count(r) AS n`, { store });
  const markerRows = await runner.run(`MATCH (m:${MARKER_LABEL} {name: $store}) RETURN m.workspaceId AS workspaceId, m.appliedSeq AS appliedSeq LIMIT 1`, { store });
  const headerRows = await runner.run(
    `MATCH (h:${COMMON_LABEL}:${KIND_LABELS.snapshot} {store: $store}) RETURN h.f_workspaceId AS workspaceId, h.f_seq AS appliedSeq LIMIT 1`, { store });
  const read = (rows: typeof markerRows): StoreMarker | null => {
    const row = rows.records[0];
    if (!row || row.get("workspaceId") === null || row.get("appliedSeq") === null) return null;
    return { workspaceId: String(row.get("workspaceId")), appliedSeq: toNumber(row.get("appliedSeq")) };
  };
  return { records: toNumber(count.records[0].get("n")), marker: read(markerRows), header: read(headerRows) };
}

export async function writeMarker(runner: Runner, marker: StoreMarker, store: string = DEFAULT_MARKER): Promise<void> {
  await runner.run(
    `MERGE (m:${MARKER_LABEL} {name: $store}) SET m.workspaceId = $workspaceId, m.appliedSeq = $appliedSeq`,
    { store, workspaceId: marker.workspaceId, appliedSeq: neo4j.int(marker.appliedSeq) },
  );
}

function idOf(record: SnapshotRecord): string | undefined {
  const id = (record as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
}

/**
 * Applies record operations inside one transaction: deletes the record nodes of `delete`,
 * creates or replaces those of `put`, and brings the derived relationships in line.
 */
/**
 * Applies record operations of the store `store` inside one transaction: deletes the record nodes
 * of `delete`, creates or replaces those of `put`, and brings the derived relationships in line.
 */
export async function applyOps(tx: Runner, ops: RecordOp[], store: string): Promise<void> {
  const L = storeLabel(store);
  // The last operation on a key wins.
  const last = new Map<string, RecordOp>();
  for (const op of ops) last.set(op.rk, op);
  const deletes: string[] = [];
  const puts: Array<{ record: SnapshotRecord; rk: string; props: PropertyMap; kind: RecordKind; labels: string[] }> = [];
  const pairsByType = new Map<RelationshipType, Array<{ a: string; b: string }>>();
  for (const op of last.values()) {
    if (op.op === "delete") {
      deletes.push(op.rk);
      continue;
    }
    if (op.record === undefined) throw new Error(`A put operation has no record (${op.rk}).`);
    const encoded = encodeRecord(op.record);
    if (encoded.rk !== op.rk) throw new Error(`Operation key ${JSON.stringify(op.rk)} does not match its record (${encoded.rk}).`);
    puts.push({ record: op.record, rk: encoded.rk, props: encoded.props, kind: encoded.kind, labels: encoded.labels });
    for (const wish of encoded.relationships) {
      for (const a of wish.from) {
        for (const b of wish.to) {
          const list = pairsByType.get(wish.type);
          if (list) list.push({ a, b });
          else pairsByType.set(wish.type, [{ a, b }]);
        }
      }
    }
  }

  if (deletes.length > 0) {
    await tx.run(`UNWIND $rks AS rk MATCH (r:${COMMON_LABEL} {store: $store, rk: rk}) DETACH DELETE r`, { rks: deletes, store });
  }
  if (puts.length === 0) return;

  const putRks = puts.map((put) => put.rk);
  const existing = new Set<string>();
  const found = await tx.run(`UNWIND $rks AS rk MATCH (r:${COMMON_LABEL} {store: $store, rk: rk}) RETURN rk`, { rks: putRks, store });
  for (const row of found.records) existing.add(String(row.get("rk")));

  const rowsByLabels = new Map<string, { labels: string[]; rows: PropertyMap[] }>();
  for (const put of puts) {
    const key = put.labels.join(":");
    const group = rowsByLabels.get(key);
    if (group) group.rows.push(put.props);
    else rowsByLabels.set(key, { labels: put.labels, rows: [put.props] });
  }
  for (const group of rowsByLabels.values()) {
    const extra = group.labels.filter((label) => label !== COMMON_LABEL);
    await tx.run(
      `UNWIND $rows AS row MERGE (r:${COMMON_LABEL} {store: $store, rk: row.rk}) SET r = row, r.store = $store SET r:${cypherLabelList([L, ...extra])}`,
      { rows: group.rows, store },
    );
  }
  const wanted = new Map(puts.map((put) => [put.rk, new Set(put.labels)]));
  const replacedNow = putRks.filter((rk) => existing.has(rk));
  if (replacedNow.length > 0) {
    const labeled = await tx.run(
      `UNWIND $rks AS rk MATCH (r:${COMMON_LABEL} {store: $store, rk: rk}) RETURN r.rk AS rk, labels(r) AS labels`,
      { rks: replacedNow, store },
    );
    const drop = new Map<string, string[]>();
    for (const row of labeled.records) {
      const rk = String(row.get("rk"));
      const keep = wanted.get(rk) ?? new Set<string>();
      const labels = row.get("labels");
      if (!Array.isArray(labels)) continue;
      for (const label of labels) {
        if (typeof label !== "string" || !label.startsWith("Ext_") || keep.has(label)) continue;
        const list = drop.get(label) ?? [];
        list.push(rk);
        drop.set(label, list);
      }
    }
    for (const [label, rks] of drop) {
      await tx.run(`UNWIND $rks AS rk MATCH (r:${COMMON_LABEL} {store: $store, rk: rk}) REMOVE r:${cypherLabelList([label])}`, { rks, store });
    }
  }

  // Relationships derived from the put records themselves: drop the old ones, create the current ones.
  // A record owns its outgoing relationships, except SOURCE, which points at the connection that owns it.
  const replaced = putRks.filter((rk) => existing.has(rk));
  if (replaced.length > 0) {
    await tx.run(
      `UNWIND $rks AS rk MATCH (r:${COMMON_LABEL} {store: $store, rk: rk})-[x]->() WHERE type(x) <> 'SOURCE' DELETE x`,
      { rks: replaced, store },
    );
    await tx.run(`UNWIND $rks AS rk MATCH ()-[x:SOURCE]->(r:${COMMON_LABEL} {store: $store, rk: rk}) DELETE x`, { rks: replaced, store });
  }
  for (const type of RELATIONSHIP_TYPES) {
    const rows = pairsByType.get(type);
    if (!rows || rows.length === 0) continue;
    await tx.run(
      `UNWIND $rows AS row MATCH (a:${COMMON_LABEL} {store: $store, rk: row.a}) MATCH (b:${COMMON_LABEL} {store: $store, rk: row.b}) MERGE (a)-[:${type}]->(b)`,
      { rows, store },
    );
  }

  // Relationships other records want to a record that did not exist before.
  const created = puts.filter((put) => !existing.has(put.rk));
  const reverse = async (kind: RecordKind, query: string): Promise<void> => {
    const rows = created
      .filter((put) => put.kind === kind && idOf(put.record) !== undefined)
      .map((put) => ({ rk: put.rk, id: idOf(put.record) }));
    if (rows.length === 0) return;
    await tx.run(`UNWIND $rows AS row MATCH (n:${COMMON_LABEL} {store: $store, rk: row.rk}) ${query}`, { rows, store });
  };
  const all = COMMON_LABEL;
  await reverse("node", `MATCH (c:${all}:Connection {store: $store, f_source: row.id}) MERGE (n)-[:SOURCE]->(c)`);
  await reverse("node", `MATCH (c:${all}:Connection {store: $store, f_target: row.id}) MERGE (c)-[:TARGET]->(n)`);
  await reverse("node", `MATCH (s:${all}:Scope {store: $store, f_rootNodeId: row.id}) MERGE (s)-[:ROOT]->(n)`);
  await reverse("node", `MATCH (d:${all}:Details {store: $store, f_nodeId: row.id}) MERGE (d)-[:OF]->(n)`);
  await reverse("node", `MATCH (v:${all}:NodeView {store: $store, f_nodeId: row.id}) MERGE (v)-[:PLACES]->(n)`);
  await reverse("connection", `MATCH (c:${all}:Connection {store: $store, f_source: row.id, f_type: 'graphlink'}) WHERE c <> n MERGE (n)-[:SOURCE]->(c)`);
  await reverse("connection", `MATCH (c:${all}:Connection {store: $store, f_target: row.id, f_type: 'graphlink'}) WHERE c <> n MERGE (c)-[:TARGET]->(n)`);
  await reverse("scope", `MATCH (s:${all}:Surface {store: $store, f_scopeId: row.id}) MERGE (s)-[:IN]->(n)`);
  await reverse("surface", `MATCH (v:${all}:NodeView {store: $store, f_surfaceId: row.id}) MERGE (v)-[:ON]->(n)`);
  await reverse("map", `MATCH (r:${all} {store: $store, f_mapId: row.id}) WHERE NOT r:Map MERGE (r)-[:IN_MAP]->(n)`);
}

/** Applies one commit and moves the marker to its sequence number, in one transaction. */
export async function applyCommit(
  driver: Driver,
  workspaceId: string,
  commit: { seq: number; ops: RecordOp[] },
  options: { database?: string; store: string },
): Promise<void> {
  const session = driver.session({ database: options.database, defaultAccessMode: neo4j.session.WRITE });
  try {
    await session.executeWrite(async (tx) => {
      await applyOps(tx, commit.ops, options.store);
      await writeMarker(tx, { workspaceId, appliedSeq: commit.seq }, options.store);
    });
  } finally {
    await session.close();
  }
}

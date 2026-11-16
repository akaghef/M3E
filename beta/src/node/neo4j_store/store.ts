// Neo4j store adapter for the portable snapshot: load records into an empty database and
// dump them back. `serializeSnapshot(dump(load(x)))` is byte-identical to `serializeSnapshot(x)`.
// The property scheme is described in ./encoding.ts.
//
// Graph shape written by `load` (all nodes also carry the label `Rec`):
//   (:M3eNode|Connection)-[:SOURCE]->(:Connection)-[:TARGET]->(:M3eNode|Connection)
//   (:Scope)-[:ROOT]->(:M3eNode)        (:Details)-[:OF]->(:M3eNode)
//   (:Surface)-[:IN]->(:Scope)          (:NodeView)-[:ON]->(:Surface), -[:PLACES]->(:M3eNode)
//   (:M3eNode)-[:ALIAS_OF]->(:M3eNode)  (any record with mapId)-[:IN_MAP]->(:Map)
// A relationship is created only when the record at the other end exists; the endpoint id is
// always kept as a property (`f_source`, `f_target`, …), so a broken reference still round-trips.

import type { Driver, Session } from "neo4j-driver";
import neo4j from "neo4j-driver";
import { sortRecords } from "../../shared/record_model/jsonl";
import type { RecordKind, SnapshotRecord } from "../../shared/record_model/types";
import {
  COMMON_LABEL,
  KIND_LABELS,
  RELATIONSHIP_TYPES,
  decodeRecord,
  encodeRecord,
  type PropertyMap,
  type RelationshipType,
} from "./encoding";

export const DEFAULT_BATCH_SIZE = 10000;

export interface StoreOptions {
  /** Rows per transaction. */
  batchSize?: number;
  /** Database name; the server default when omitted. */
  database?: string;
}

export interface LoadResult {
  recordCounts: Record<string, number>;
  relationshipCounts: Record<string, number>;
  records: number;
  relationships: number;
}

function openSession(driver: Driver, options: StoreOptions, write: boolean): Session {
  return driver.session({
    database: options.database,
    defaultAccessMode: write ? neo4j.session.WRITE : neo4j.session.READ,
  });
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function toNumber(value: unknown): number {
  return neo4j.isInt(value) ? value.toNumber() : Number(value);
}

async function countRecords(session: Session): Promise<number> {
  const result = await session.run(`MATCH (r:${COMMON_LABEL}) RETURN count(r) AS n`);
  return toNumber(result.records[0].get("n"));
}

function sortedCounts(counts: Map<string, number>): Record<string, number> {
  return Object.fromEntries([...counts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
}

function assertSameCounts(what: string, expected: Map<string, number>, actual: Map<string, number>): void {
  const problems: string[] = [];
  for (const name of new Set([...expected.keys(), ...actual.keys()])) {
    const want = expected.get(name) ?? 0;
    const got = actual.get(name) ?? 0;
    if (want !== got) problems.push(`${name}: expected ${want}, stored ${got}`);
  }
  if (problems.length > 0) throw new Error(`Load verification failed (${what}): ${problems.join("; ")}`);
}

/**
 * Loads records into an empty database. Refuses to run when any `Rec` node exists.
 * Each batch is its own transaction; a failure part-way leaves the batches already written.
 */
export async function load(driver: Driver, records: SnapshotRecord[], options: StoreOptions = {}): Promise<LoadResult> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  if (!Number.isInteger(batchSize) || batchSize < 1) throw new Error(`Bad batch size: ${String(batchSize)}`);

  // Encode everything first, so that an unstorable or duplicate record is found before any write.
  const propsByKind = new Map<RecordKind, PropertyMap[]>();
  const rks = new Set<string>();
  const wishes = [];
  for (const record of records) {
    const encoded = encodeRecord(record);
    if (rks.has(encoded.rk)) throw new Error(`Two records share the key ${JSON.stringify(encoded.rk)}.`);
    rks.add(encoded.rk);
    const list = propsByKind.get(encoded.kind);
    if (list) list.push(encoded.props);
    else propsByKind.set(encoded.kind, [encoded.props]);
    wishes.push(...encoded.relationships);
  }
  const pairsByType = new Map<RelationshipType, Array<{ a: string; b: string }>>();
  for (const wish of wishes) {
    for (const a of wish.from) {
      if (!rks.has(a)) continue;
      for (const b of wish.to) {
        if (!rks.has(b)) continue;
        const list = pairsByType.get(wish.type);
        if (list) list.push({ a, b });
        else pairsByType.set(wish.type, [{ a, b }]);
      }
    }
  }

  const session = openSession(driver, options, true);
  try {
    const existing = await countRecords(session);
    if (existing > 0) throw new Error(`Refusing to load: the database already holds ${existing} records.`);

    await session.run(`CREATE CONSTRAINT rec_rk IF NOT EXISTS FOR (r:${COMMON_LABEL}) REQUIRE r.rk IS UNIQUE`);
    await session.run(`CREATE INDEX rec_id IF NOT EXISTS FOR (r:${COMMON_LABEL}) ON (r.id)`);
    await session.run("CALL db.awaitIndexes(600)");

    for (const [kind, propsList] of propsByKind) {
      const query = `UNWIND $rows AS row CREATE (r:${COMMON_LABEL}:${KIND_LABELS[kind]}) SET r = row`;
      for (const rows of chunks(propsList, batchSize)) {
        await session.executeWrite((tx) => tx.run(query, { rows }));
      }
    }
    for (const type of RELATIONSHIP_TYPES) {
      const query =
        `UNWIND $rows AS row MATCH (a:${COMMON_LABEL} {rk: row.a}) MATCH (b:${COMMON_LABEL} {rk: row.b}) ` +
        `CREATE (a)-[:${type}]->(b)`;
      for (const rows of chunks(pairsByType.get(type) ?? [], batchSize)) {
        await session.executeWrite((tx) => tx.run(query, { rows }));
      }
    }

    const expectedRecords = new Map<string, number>();
    for (const [kind, propsList] of propsByKind) expectedRecords.set(kind, propsList.length);
    const storedRecords = new Map<string, number>();
    const byKind = await session.run(`MATCH (r:${COMMON_LABEL}) RETURN r.kind AS name, count(*) AS n`);
    for (const row of byKind.records) storedRecords.set(String(row.get("name")), toNumber(row.get("n")));
    assertSameCounts("records per kind", expectedRecords, storedRecords);

    const expectedRelationships = new Map<string, number>();
    for (const [type, pairs] of pairsByType) expectedRelationships.set(type, pairs.length);
    const storedRelationships = new Map<string, number>();
    const byType = await session.run(
      `MATCH (:${COMMON_LABEL})-[x]->(:${COMMON_LABEL}) RETURN type(x) AS name, count(*) AS n`,
    );
    for (const row of byType.records) storedRelationships.set(String(row.get("name")), toNumber(row.get("n")));
    assertSameCounts("relationships per type", expectedRelationships, storedRelationships);

    return {
      recordCounts: sortedCounts(storedRecords),
      relationshipCounts: sortedCounts(storedRelationships),
      records: records.length,
      relationships: [...storedRelationships.values()].reduce((sum, n) => sum + n, 0),
    };
  } finally {
    await session.close();
  }
}

/** Reads every record back, in the canonical order of the JSON Lines form. */
export async function dump(driver: Driver, options: StoreOptions = {}): Promise<SnapshotRecord[]> {
  const session = openSession(driver, options, false);
  try {
    const records: SnapshotRecord[] = [];
    const result = session.run(`MATCH (r:${COMMON_LABEL}) RETURN properties(r) AS p`);
    for await (const row of result) records.push(decodeRecord(row.get("p") as PropertyMap));
    return sortRecords(records);
  } finally {
    await session.close();
  }
}

/** Deletes every `Rec` node and its relationships, in batches. Returns the number of nodes deleted. */
export async function deleteAllRecords(driver: Driver, options: StoreOptions = {}): Promise<number> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const session = openSession(driver, options, true);
  try {
    let total = 0;
    for (;;) {
      const result = await session.executeWrite((tx) =>
        tx.run(`MATCH (r:${COMMON_LABEL}) WITH r LIMIT $limit DETACH DELETE r RETURN count(*) AS n`, {
          limit: neo4j.int(batchSize),
        }),
      );
      const deleted = toNumber(result.records[0].get("n"));
      total += deleted;
      if (deleted === 0) return total;
    }
  } finally {
    await session.close();
  }
}

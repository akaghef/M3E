// Round trip of a portable snapshot through the Neo4j store adapter.
// The encoding tests always run. The database tests run only when M3E_TEST_NEO4J_BOLT points
// at a throwaway Neo4j instance (for example bolt://127.0.0.1:37687); they delete every `Rec`
// node of that instance.

import neo4j, { type Driver } from "neo4j-driver";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { decodeRecord, encodeRecord } from "../../src/node/neo4j_store/encoding";
import { deleteAllRecords, dump, load } from "../../src/node/neo4j_store/store";
import { parseSnapshot, serializeSnapshot } from "../../src/shared/record_model/jsonl";
import type { SnapshotRecord } from "../../src/shared/record_model/types";

const BOLT = process.env.M3E_TEST_NEO4J_BOLT;

const ID64 = "n_" + "0123456789abcdef".repeat(4).slice(0, 62);
const BIG_TEXT = "線形テキスト linear text 😀 \"quoted\" \\ back\tslash\n".repeat(15000);

const AWKWARD_ATTRIBUTES = {
  plain: "value",
  "": "empty key",
  "m3e:status": "done",
  "dotted.key": 1,
  "with space": true,
  "日本語のキー": "値",
  Case: "upper",
  case: "lower",
  CASE: "all upper",
  j_literal: "starts with j_",
  "aj_literal": { nested: "object under a key that looks like a prefix" },
  "back`tick": "`",
  "quote'\"\\": "q",
  "new\nline\tkey": "n",
  "😀": "emoji key",
  emptyString: "",
  zero: 0,
  negative: -12,
  integerValued: 1,
  float: 1.5,
  exponent: 1e21,
  tiny: 1.5e-7,
  maxSafe: 9007199254740991,
  beyondSafe: 9007199254740993,
  yes: true,
  no: false,
  nested: { a: { b: [1, { c: null }] }, z: "last", "1": "integer-like key" },
  heterogeneous: [1, "two", true, { three: 3 }, [4]],
  withNull: ["a", null, "b"],
  strings: ["a", "", "日本語"],
  integers: [3, 1, 2],
  mixedNumbers: [1, 1.5, -2],
  floats: [0.5, 2.25],
  booleans: [true, false, true],
  emptyList: [],
  emptyObject: {},
  nestedLists: [[1, 2], [3]],
  loneSurrogateValue: "broken \ud800 text",
  loneSurrogateInList: ["ok", "\udc00"],
  nulValue: "a\u0000b",
};

function syntheticSnapshot(): SnapshotRecord[] {
  const records: unknown[] = [
    { kind: "snapshot", format: 1, workspaceId: "ws_テスト", seq: 0 },

    { kind: "map", id: "map_a", rootNodeId: "root_a", tags: ["t1", "t2"], archived: 0, pinned: 1, source: "{\"from\":\"x\"}", legacyVersion: 12, legacySavedAt: "2026-10-01T00:00:00.000Z", linearTextFontScale: 1.25, linearPanelWidth: 420, extra: { "custom:top": { deep: [1, 2, { x: "y" }] }, "": 0, flag: false }, rev: 0 },
    { kind: "map", id: "map_b", rootNodeId: "root_b", tags: "[\"as text\"]", rev: 3 },
    // A map whose id equals a node id: kinds must not collide.
    { kind: "map", id: "root_a", rev: 0 },

    { kind: "node", id: "root_a", mapId: "map_a", text: "ルート 😀", rev: 0 },
    { kind: "node", id: "child_1", mapId: "map_a", text: "", collapsed: true, attributes: AWKWARD_ATTRIBUTES, extra: { type: "legacy", createdAt: 1760000000000, notes: ["a", 1], "x_looks": "like a prefix", "__proto__": "own key" }, rev: 7 },
    { kind: "node", id: ID64, mapId: "map_a", nodeType: "image", text: "x".repeat(3000), attributes: {}, rev: 0 },
    { kind: "node", id: "alias_ok", mapId: "map_a", nodeType: "alias", text: "alias", alias: { target: "child_1", label: "ラベル", access: "write", snapshotLabel: "snap" }, rev: 0 },
    { kind: "node", id: "alias_broken", mapId: "map_a", nodeType: "alias", text: "broken", alias: { target: "node_that_does_not_exist", broken: true }, rev: 0 },
    { kind: "node", id: "root_b", mapId: "map_b", text: "other map", rev: 0 },
    { kind: "node", id: "orphan_map_node", mapId: "map_that_does_not_exist", text: "no map", rev: 0 },
    { kind: "node", id: "weird:id.with-all_Chars", mapId: "map_a", text: "\u0001 control   separators  ", attributes: { "nul\u0000key": "forces the JSON form of the map", other: [1, 2] }, extra: { "lone\ud83dkey": 1 }, rev: 0 },

    { kind: "details", nodeId: "child_1", mapId: "map_a", v: 1, body: "本文\n**markdown**", note: "note", link: "https://example.invalid/?a=1&b=2", rev: 0 },
    { kind: "details", nodeId: "node_that_does_not_exist", mapId: "map_a", v: 1, body: "dangling", rev: 0 },

    { kind: "connection", id: "c_edge_1", mapId: "map_a", type: "edge", source: "root_a", target: "child_1", label: "is", ord: "a", rev: 0 },
    { kind: "connection", id: "c_edge_2", mapId: "map_a", type: "edge", source: "root_a", target: ID64, ord: "b", rev: 0 },
    { kind: "connection", id: "c_edge_broken", mapId: "map_a", type: "edge", source: "node_that_does_not_exist", target: "alias_ok", ord: "a", rev: 0 },
    { kind: "connection", id: "c_link_1", mapId: "map_a", type: "graphlink", source: "child_1", target: ID64, relationType: "rdfs:subClassOf", label: "関係", attributes: { weight: 0.5, tags: ["a", "b"] }, direction: "forward", style: "dashed", color: "#ff0000", sourcePort: "right", targetPort: "left", extra: { legacy: { any: "thing" } }, rev: 2 },
    // A graphlink whose endpoints are other connections.
    { kind: "connection", id: "c_link_on_link", mapId: "map_a", type: "graphlink", source: "c_link_1", target: "c_edge_1", rev: 0 },
    { kind: "connection", id: "c_link_broken", mapId: "map_a", type: "graphlink", source: "gone_1", target: "gone_2", rev: 0 },

    { kind: "scope", id: "s_root_a", mapId: "map_a", rootNodeId: "root_a", primarySurfaceId: "v_surface_1", rev: 0 },
    { kind: "scope", id: "s_root_b", mapId: "map_b", rootNodeId: "root_b", rev: 0 },

    { kind: "linearText", scopeId: "s_root_a", mapId: "map_a", text: BIG_TEXT, rev: 0 },
    { kind: "linearText", mapId: "map_a", orphanKey: "scope:gone node", text: "orphan", anchorNodeId: "child_1", rev: 0 },
    { kind: "linearText", mapId: "map_a", orphanKey: "", text: "orphan with an empty key", rev: 0 },

    { kind: "surface", id: "v_surface_1", mapId: "map_a", scopeId: "s_root_a", surfaceKind: "canvas", layout: "tree", surfaceView: { zoom: 1.5, pan: { x: -10, y: 20.25 }, flags: [] }, rev: 4 },
    { kind: "surface", id: "v_surface_2", mapId: "map_a", scopeId: "scope_that_does_not_exist", surfaceKind: "flow", layout: "lane", rev: 0 },

    { kind: "nodeView", surfaceId: "v_surface_1", nodeId: "child_1", mapId: "map_a", x: 10, y: -20.5, shape: "ellipse" },
    { kind: "nodeView", surfaceId: "v_surface_1", nodeId: ID64, mapId: "map_a", flowCol: 2, flowRow: 0 },
    { kind: "nodeView", surfaceId: "v_surface_1", nodeId: "node_that_does_not_exist", mapId: "map_a", x: 0 },

    { kind: "annotation", id: "a_pen", mapId: "map_a", scopeId: "s_root_a", annotationKind: "pen", d: "M0 0 L10 10", points: [[0, 0], [10, 10.5]], stroke: "#000", strokeWidth: 2, opacity: 0.5, createdAt: 1760000000000, rev: 0 },
    { kind: "annotation", id: "a_text", mapId: "map_a", annotationKind: "text", x: 1.5, y: 2, text: "注釈", fill: "#fff", fontSize: 14, fontWeight: "bold", variant: "note", extra: { scopeId: "scope:lost" }, rev: 0 },
    // A field name Neo4j cannot use as a property name: the whole record is kept as JSON text.
    { kind: "annotation", id: "a_unknown_field", mapId: "map_a", annotationKind: "pen", "strange\u0000field": { a: 1 }, "ほかの欄": [1, "x"], rev: 0 },

    { kind: "relationTypeDef", name: "rdfs:subClassOf", label: "is a", description: "説明", reads: "target-to-source", rev: 0 },
    { kind: "relationTypeDef", name: "consist-of", reads: "source-to-target", rev: 0 },
    { kind: "prefix", prefix: "rdf", uri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#", rev: 0 },
    { kind: "account", id: "acct_migration", accountKind: "system", displayName: "移行", externalIds: { github: "x" }, roles: ["owner", "editor"], rev: 0 },
    { kind: "commit", seq: 0, committedAt: "2026-11-17T00:00:00.000Z", issuer: "acct_migration", sessionId: "sess-1" },
    { kind: "commit", seq: 10, committedAt: "2026-11-17T00:00:01.000Z", issuer: "acct_migration" },
    { kind: "idMap", recordKind: "node", mapId: "map_a", oldId: "an old id / with spaces", newId: ID64 },
    { kind: "idMap", recordKind: "surface", mapId: "map_a", oldId: "surface:old", newId: "v_surface_1" },
  ];
  // Through JSON text, as a file would be read.
  return parseSnapshot(records.map((record) => JSON.stringify(record)).join("\n") + "\n");
}

const ALL_KINDS = [
  "account", "annotation", "commit", "connection", "details", "idMap", "linearText", "map", "node",
  "nodeView", "prefix", "relationTypeDef", "scope", "snapshot", "surface",
];

describe("neo4j store encoding", () => {
  it("covers every record kind in the synthetic snapshot", () => {
    const kinds = new Set(syntheticSnapshot().map((record) => record.kind));
    expect([...kinds].sort()).toEqual(ALL_KINDS);
    const linear = syntheticSnapshot().find((record) => record.kind === "linearText" && record.scopeId === "s_root_a");
    expect(Buffer.byteLength((linear as { text: string }).text, "utf8")).toBeGreaterThan(850_000);
  });

  it("rebuilds each record byte-identically from its properties", () => {
    for (const record of syntheticSnapshot()) {
      const encoded = encodeRecord(record);
      expect(JSON.stringify(decodeRecord(encoded.props))).toBe(JSON.stringify(record));
    }
  });

  it("stores integers as integers, other numbers as floats, and unstorable values as JSON text", () => {
    const record = syntheticSnapshot().find((r) => r.kind === "node" && r.id === "child_1") as SnapshotRecord;
    const props = encodeRecord(record).props;
    expect(neo4j.isInt(props.f_rev)).toBe(true);
    expect(neo4j.isInt(props.a_integerValued)).toBe(true);
    expect(props.a_float).toBe(1.5);
    expect(props.a_beyondSafe).toBe(9007199254740993);
    expect(props.f_collapsed).toBe(true);
    expect(props["a_"]).toBe("empty key");
    expect(props.a_j_literal).toBe("starts with j_");
    expect(typeof props.aj_aj_literal).toBe("string");
    expect(props.aj_heterogeneous).toBe(JSON.stringify([1, "two", true, { three: 3 }, [4]]));
    expect(props.aj_withNull).toBe("[\"a\",null,\"b\"]");
    expect(props.a_mixedNumbers).toEqual([1, 1.5, -2]);
    expect((props.a_integers as unknown[]).every((item) => neo4j.isInt(item))).toBe(true);
    expect(props.a_emptyList).toEqual([]);
    expect(typeof props.aj_loneSurrogateValue).toBe("string");
    expect(props.a_Case).toBe("upper");
    expect(props.a_case).toBe("lower");
    expect(props.id).toBe("child_1");
    expect(props.rk).toBe("node|child_1");
  });

  it("refuses a record key with a lone surrogate", () => {
    expect(() => encodeRecord({ kind: "node", id: "bad\ud800", mapId: "m", text: "", rev: 0 })).toThrow(/lone surrogate/);
  });
});

describe.skipIf(!BOLT)("neo4j store round trip (needs M3E_TEST_NEO4J_BOLT)", () => {
  let driver: Driver;

  beforeAll(() => {
    driver = neo4j.driver(BOLT as string);
  });
  beforeEach(async () => {
    await deleteAllRecords(driver, { batchSize: 1000 });
  });
  afterAll(async () => {
    await deleteAllRecords(driver, { batchSize: 1000 });
    await driver.close();
  });

  async function count(query: string): Promise<number> {
    const session = driver.session();
    try {
      const result = await session.run(query);
      return result.records[0].get("n").toNumber();
    } finally {
      await session.close();
    }
  }

  it("dumps a loaded snapshot byte-identically", async () => {
    const records = syntheticSnapshot();
    const expected = serializeSnapshot(records);
    const result = await load(driver, records);
    expect(result.records).toBe(records.length);
    expect(Object.keys(result.recordCounts)).toEqual(ALL_KINDS);

    const actual = serializeSnapshot(await dump(driver));
    expect(actual === expected).toBe(true);
    expect(Buffer.from(actual, "utf8").equals(Buffer.from(expected, "utf8"))).toBe(true);
  }, 120000);

  it("round-trips with a batch size smaller than the snapshot", async () => {
    const records = syntheticSnapshot();
    await load(driver, records, { batchSize: 3 });
    expect(serializeSnapshot(await dump(driver)) === serializeSnapshot(records)).toBe(true);
  }, 120000);

  it("creates relationships only to records that exist", async () => {
    const result = await load(driver, syntheticSnapshot());
    expect(result.relationshipCounts).toEqual({
      ALIAS_OF: 1,
      IN: 1,
      IN_MAP: 30,
      OF: 1,
      ON: 3,
      PLACES: 2,
      ROOT: 2,
      SOURCE: 4,
      TARGET: 5,
    });
    // The graphlink between connections is attached to both connections.
    expect(await count(
      "MATCH (:Connection {id: 'c_link_1'})-[:SOURCE]->(l:Connection {id: 'c_link_on_link'})-[:TARGET]->(:Connection {id: 'c_edge_1'}) RETURN count(l) AS n",
    )).toBe(1);
    // The broken alias and the edge without a source keep the id but have no relationship.
    expect(await count("MATCH (:M3eNode {id: 'alias_broken'})-[x:ALIAS_OF]->() RETURN count(x) AS n")).toBe(0);
    expect(await count("MATCH ()-[x:SOURCE]->(:Connection {id: 'c_edge_broken'}) RETURN count(x) AS n")).toBe(0);
    expect(await count("MATCH (c:Connection {id: 'c_edge_broken', f_source: 'node_that_does_not_exist'}) RETURN count(c) AS n")).toBe(1);
    // A node and a map with the same id stay separate records.
    expect(await count("MATCH (r:Rec {id: 'root_a'}) RETURN count(r) AS n")).toBe(2);
    expect(await count("MATCH (:M3eNode {id: 'root_a'})-[:IN_MAP]->(m:Map {id: 'map_a'}) RETURN count(m) AS n")).toBe(1);
  }, 120000);

  it("refuses to load into a database that already holds records", async () => {
    const records = syntheticSnapshot();
    await load(driver, records);
    await expect(load(driver, records)).rejects.toThrow(/Refusing to load/);
    expect(serializeSnapshot(await dump(driver)) === serializeSnapshot(records)).toBe(true);
  }, 120000);

  it("refuses two records with the same key before writing anything", async () => {
    const records = syntheticSnapshot();
    records.push({ kind: "node", id: "child_1", mapId: "map_a", text: "duplicate", rev: 0 });
    await expect(load(driver, records)).rejects.toThrow(/share the key/);
    expect(await count("MATCH (r:Rec) RETURN count(r) AS n")).toBe(0);
  }, 120000);
});

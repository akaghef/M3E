// Format 2 Neo4j encoding: extension labels and epoch-millisecond properties.
// Unit level on the encoding functions. A live Neo4j is not required.

import neo4j from "neo4j-driver";
import { describe, expect, it } from "vitest";
import { decodeRecord, encodeRecord } from "../../src/node/neo4j_store/encoding";
import type { SnapshotRecord } from "../../src/shared/record_model/types";

const DUE = "2026-11-22T00:00:00.000Z";

describe("neo4j format 2 encoding", () => {
  it("adds extension labels and epoch-millisecond properties and decodes the same record", () => {
    const node: SnapshotRecord = {
      kind: "node",
      id: "n1",
      mapId: "m",
      text: "t",
      extensions: ["m3e:nodeType:task@1", "misc:nodeType:mood@2"],
      attributes: { "m3e:nodeType:task/due": DUE },
      rev: 1,
    };
    const encoded = encodeRecord(node);
    expect(encoded.labels).toEqual(["Rec", "M3eNode", "Ext_m3e_nodeType_task_1", "Ext_misc_nodeType_mood_2"]);
    const due = encoded.props["am_m3e:nodeType:task/due"];
    expect(neo4j.isInt(due)).toBe(true);
    expect((due as { toNumber: () => number }).toNumber()).toBe(Date.parse(DUE));
    expect(encoded.props.o).not.toContain("am_m3e:nodeType:task/due");
    expect(JSON.stringify(decodeRecord(encoded.props))).toBe(JSON.stringify(node));

    const edge: SnapshotRecord = {
      kind: "connection",
      id: "e1",
      mapId: "m",
      type: "edge",
      source: "a",
      target: "b",
      ord: "a0",
      extensions: ["m3e:parentEdge:polarity@1"],
      rev: 0,
    };
    const edgeEncoded = encodeRecord(edge);
    expect(edgeEncoded.labels).toEqual(["Rec", "Connection", "Ext_m3e_parentEdge_polarity_1"]);
    expect(JSON.stringify(decodeRecord(edgeEncoded.props))).toBe(JSON.stringify(edge));

    const link: SnapshotRecord = {
      kind: "connection",
      id: "g1",
      mapId: "m",
      type: "graphlink",
      source: "a",
      target: "b",
      extensions: ["misc:relationEdge:cites@3"],
      rev: 0,
    };
    const linkEncoded = encodeRecord(link);
    expect(linkEncoded.labels).toEqual(["Rec", "Connection", "Ext_misc_relationEdge_cites_3"]);
    expect(JSON.stringify(decodeRecord(linkEncoded.props))).toBe(JSON.stringify(link));

    const commit: SnapshotRecord = { kind: "commit", seq: 1, committedAt: "2026-11-17T00:00:00.000Z", issuer: "acct_tester" };
    const commitEncoded = encodeRecord(commit);
    const ms = commitEncoded.props.ms_committedAt;
    expect(neo4j.isInt(ms)).toBe(true);
    expect((ms as { toNumber: () => number }).toNumber()).toBe(Date.parse("2026-11-17T00:00:00.000Z"));
    expect(JSON.stringify(decodeRecord(commitEncoded.props))).toBe(JSON.stringify(commit));
  });
});

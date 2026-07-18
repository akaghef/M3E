import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  FileSemanticSourceAdapter,
  makeGlobalSemanticId,
  validateSemanticSourcePackage,
} from "../../src/node/semantic_source";

const fixture = (name: string): string => resolve(process.cwd(), "tests/fixtures/semantic-source", name);
const readFixture = (name: string): Record<string, unknown> => JSON.parse(readFileSync(fixture(name), "utf8"));

describe("repository-local semantic source Phase 1 contract", () => {
  test("SourceDescriptor exposes a read-only file route and required capabilities", () => {
    const adapter = new FileSemanticSourceAdapter(fixture("revision-002-renamed.json"));
    expect(adapter.describe()).toMatchObject({
      sourceId: "src:m3e-repository-math-specimen",
      sourceKind: "git-backed",
      schemaVersion: "1",
      currentRevision: "2222222222222222222222222222222222222222",
      readRoute: "file:tests/fixtures/semantic-source/revision-002-renamed.json",
      writeRoute: "reject:read-only-phase1",
      capabilities: { read: true, directWrite: false, history: true },
    });
  });

  test("rename fixture preserves entity and assertion identity across document path changes", () => {
    const before = new FileSemanticSourceAdapter(fixture("revision-001.json")).rebuild();
    const after = new FileSemanticSourceAdapter(fixture("revision-002-renamed.json")).rebuild();

    expect(after.sourceId).toBe(before.sourceId);
    expect(after.entities.map((entity) => entity.globalEntityId)).toEqual(
      before.entities.map((entity) => entity.globalEntityId),
    );
    expect(after.assertions.map((assertion) => assertion.globalAssertionId)).toEqual(
      before.assertions.map((assertion) => assertion.globalAssertionId),
    );
    expect(before.entities[0].documentRef).not.toBe(after.entities[0].documentRef);
  });

  test("revision fixture records the previous indexed revision without deriving identity from revision", () => {
    const before = new FileSemanticSourceAdapter(fixture("revision-001.json"));
    const after = new FileSemanticSourceAdapter(fixture("revision-002-renamed.json"));

    expect(after.describe().currentRevision).not.toBe(before.describe().currentRevision);
    expect(after.describe().lastIndexedRevision).toBe(before.describe().currentRevision);
    expect(makeGlobalSemanticId(after.describe().sourceId, "math:monoid")).toBe(
      makeGlobalSemanticId(before.describe().sourceId, "math:monoid"),
    );
  });

  test("read-only adapter returns defensive copies instead of mutable source state", () => {
    const adapter = new FileSemanticSourceAdapter(fixture("revision-002-renamed.json"));
    const entity = adapter.readEntity("math:monoid")!;
    const assertion = adapter.readAssertion("assertion:monoid-specializes-semigroup")!;
    entity.provenance.sourceRef = "mutated.md";
    assertion.to.localEntityId = "math:mutated";

    expect(adapter.readEntity("math:monoid")?.provenance.sourceRef).toBe(
      "docs/ideas/260719_math_ontology_graphdb_thesis.md",
    );
    expect(adapter.readAssertion("assertion:monoid-specializes-semigroup")?.to.localEntityId).toBe("math:semigroup");
  });

  test("rebuild is byte-deterministic for the same source revision", () => {
    const adapter = new FileSemanticSourceAdapter(fixture("revision-002-renamed.json"));
    const first = adapter.rebuild();
    const second = new FileSemanticSourceAdapter(fixture("revision-002-renamed.json")).rebuild();

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.semanticContentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.entities).toHaveLength(4);
    expect(first.assertions).toHaveLength(2);
  });

  test("validator rejects unselected D2 materialization and missing transformation provenance", () => {
    const candidate = readFixture("revision-002-renamed.json");
    const entities = candidate.entities as Array<Record<string, unknown>>;
    const trend = entities.find((entity) => entity.localEntityId === "trend:math-ontology-demand")!;
    trend.selectedForGraph = false;
    trend.provenance = { sourceRef: "docs/ideas/260719_math_ontology_graphdb_thesis.md" };

    const result = validateSemanticSourcePackage(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining(["D2_NOT_SELECTED", "REQUIRED_STRING"]),
      );
    }
  });

  test("validator rejects unresolved local references and direct write capability", () => {
    const candidate = readFixture("revision-002-renamed.json");
    const descriptor = candidate.descriptor as Record<string, unknown>;
    (descriptor.capabilities as Record<string, unknown>).directWrite = true;
    const assertions = candidate.assertions as Array<Record<string, unknown>>;
    (assertions[0].to as Record<string, unknown>).localEntityId = "math:missing";

    const result = validateSemanticSourcePackage(candidate);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toEqual(
        expect.arrayContaining(["DIRECT_WRITE_FORBIDDEN", "LOCAL_ENTITY_UNRESOLVED"]),
      );
    }
  });

  test("agent and CI CLI validates both revision fixtures", () => {
    const result = spawnSync(process.execPath, [
      resolve(process.cwd(), "dist/node/semantic_source_validate_cli.js"),
      "tests/fixtures/semantic-source/revision-001.json",
      "tests/fixtures/semantic-source/revision-002-renamed.json",
    ], { cwd: process.cwd(), encoding: "utf8" });

    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split("\n").map((line) => JSON.parse(line));
    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.ok === true)).toBe(true);
  });
});

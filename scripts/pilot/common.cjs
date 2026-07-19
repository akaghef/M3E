const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { createRequire } = require("node:module");

const REPO_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_SOURCE = path.join(REPO_ROOT, "docs/semantic/m3e-design.source.json");
const DEFAULT_ENV = "/Users/nisimoriyuuya/dev/M3E-private/pilot/neo4j-credentials.env";
const DEFAULT_URI = "bolt://127.0.0.1:7687";
const PILOT_KEY = "orchestration-map-pilot-260719";
const SNAPSHOT_SCHEMA = "m3e.orchestration-map-pilot.snapshot.v1";
const MATERIALIZED_SOURCE_ID = "src:m3e-design-corpus";
const ACCEPTED_SOURCE_ID = "m3e:semantic-source";
const ALLOWED_RELATION_TYPES = new Set([
  "REFS",
  "DECOMPOSES",
  "ASSIGNED_TO",
  "BLOCKED_BY",
  "SUPERSEDES",
  "PROPOSES",
  "SPECIFIES",
]);
const REQUIRED_PROPERTIES = ["id", "provenance", "refinementLevel", "recordRole", "canonicalOwner"];

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      args._.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    if (eq !== -1) {
      args[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function jsonOut(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function jsonErr(value) {
  process.stderr.write(`${JSON.stringify(value)}\n`);
}

function fail(code, message, extra = {}) {
  jsonErr({ ok: false, code, message, ...extra });
  process.exitCode = 1;
}

function labelForEntityType(entityType) {
  const table = {
    strategy: "Strategy",
    vision: "Vision",
    principle: "Principle",
    adr: "ADR",
    spec: "Spec",
    architecture: "Architecture",
  };
  return table[entityType] || "SemanticRecord";
}

function cypherString(value) {
  return JSON.stringify(String(value));
}

function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function loadNeo4jConfig(args) {
  const envPath = path.resolve(String(args.env || DEFAULT_ENV));
  const fileEnv = parseEnvFile(envPath);
  const merged = { ...process.env, ...fileEnv };
  return {
    envPath,
    uri: String(args.uri || merged.NEO4J_URI || merged.NEO4J_URL || DEFAULT_URI),
    user: String(args.user || merged.NEO4J_USER || merged.NEO4J_USERNAME || merged.NEO4J_AUTH_USER || "neo4j"),
    password: String(args.password || merged.NEO4J_PASSWORD || merged.NEO4J_PASS || ""),
    database: args.database || merged.NEO4J_DATABASE || "neo4j",
  };
}

function loadDriver() {
  const candidates = [
    path.join(REPO_ROOT, "beta/node_modules"),
    path.join(REPO_ROOT, "node_modules"),
  ];
  let lastError;
  for (const base of candidates) {
    try {
      return createRequire(path.join(base, "package.json"))("neo4j-driver");
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`neo4j-driver is not installed. Run npm install in beta/. ${lastError ? lastError.message : ""}`.trim());
}

async function withSession(args, fn) {
  const config = loadNeo4jConfig(args);
  if (!config.password) throw new Error("Neo4j password is missing from env or --password.");
  const neo4j = loadDriver();
  const driver = neo4j.driver(config.uri, neo4j.auth.basic(config.user, config.password));
  const session = driver.session({ database: config.database });
  try {
    return await fn(session, config);
  } finally {
    await session.close();
    await driver.close();
  }
}

function validateSourcePackage(sourcePath) {
  const source = readJson(sourcePath);
  const issues = [];
  if (source.schema !== "m3e.semantic-source.specimen.v1") issues.push({ code: "SOURCE_SCHEMA", path: "schema" });
  if (!source.descriptor || source.descriptor.sourceId !== MATERIALIZED_SOURCE_ID) {
    issues.push({ code: "SOURCE_ID", path: "descriptor.sourceId" });
  }
  const entityIds = new Set();
  for (const [index, entity] of (source.entities || []).entries()) {
    for (const key of ["localEntityId", "entityType", "label", "documentRef", "refinementLevel", "classification", "provenance"]) {
      if (entity[key] === undefined || entity[key] === "") issues.push({ code: "ENTITY_REQUIRED", path: `entities[${index}].${key}` });
    }
    if (entityIds.has(entity.localEntityId)) issues.push({ code: "ENTITY_DUPLICATE", path: `entities[${index}].localEntityId` });
    entityIds.add(entity.localEntityId);
  }
  const assertionIds = new Set();
  for (const [index, assertion] of (source.assertions || []).entries()) {
    if (!ALLOWED_RELATION_TYPES.has(assertion.relationType)) {
      issues.push({ code: "RELATION_TYPE", path: `assertions[${index}].relationType`, value: assertion.relationType });
    }
    if (assertionIds.has(assertion.localAssertionId)) issues.push({ code: "ASSERTION_DUPLICATE", path: `assertions[${index}].localAssertionId` });
    assertionIds.add(assertion.localAssertionId);
    for (const endpoint of ["from", "to"]) {
      if (assertion[endpoint]?.sourceId === MATERIALIZED_SOURCE_ID && !entityIds.has(assertion[endpoint].localEntityId)) {
        issues.push({ code: "ASSERTION_UNRESOLVED", path: `assertions[${index}].${endpoint}` });
      }
    }
  }
  return { source, issues };
}

async function ensureConstraints(session) {
  await session.run("CREATE CONSTRAINT m3e_record_id_unique IF NOT EXISTS FOR (n:SemanticRecord) REQUIRE n.id IS UNIQUE");
}

function materializedNode(entity, descriptor) {
  return {
    id: `source:${descriptor.sourceId}:${entity.localEntityId}`,
    localEntityId: entity.localEntityId,
    sourceId: descriptor.sourceId,
    text: entity.label,
    nodeType: entity.entityType,
    documentRef: entity.documentRef,
    refinementLevel: entity.refinementLevel,
    classification: entity.classification,
    recordRole: "source-materialized",
    canonicalOwner: "docs/",
    sourceRevision: descriptor.currentRevision,
    provenance: JSON.stringify({
      sourceRef: entity.provenance.sourceRef,
      sourceId: descriptor.sourceId,
      revision: descriptor.currentRevision,
      materialize: PILOT_KEY,
    }),
    pilotKey: PILOT_KEY,
  };
}

async function upsertNode(session, node, labels) {
  const labelText = ["SemanticRecord", ...labels.filter((label) => label !== "SemanticRecord")].map((label) => `:${label}`).join("");
  await session.run(`MERGE (n:SemanticRecord {id: $id}) SET n${labelText.replace(/:[^:]+/g, "")} += $props`, { id: node.id, props: node });
  for (const label of labels) {
    if (label !== "SemanticRecord") await session.run(`MATCH (n:SemanticRecord {id: $id}) SET n:${label}`, { id: node.id });
  }
}

async function upsertRelationship(session, fromId, toId, type, props) {
  if (!ALLOWED_RELATION_TYPES.has(type)) throw new Error(`Unsupported relationType: ${type}`);
  await session.run(
    `MATCH (from:SemanticRecord {id: $fromId}), (to:SemanticRecord {id: $toId})
     MERGE (from)-[r:${type} {id: $id}]->(to)
     SET r += $props`,
    { fromId, toId, id: props.id, props },
  );
}

async function importSource(session, sourcePath) {
  const { source, issues } = validateSourcePackage(sourcePath);
  if (issues.length) return { ok: false, issues };
  await ensureConstraints(session);
  const descriptor = source.descriptor;
  for (const entity of source.entities) {
    await upsertNode(session, materializedNode(entity, descriptor), ["SourceMaterialized", labelForEntityType(entity.entityType)]);
  }
  for (const assertion of source.assertions) {
    await upsertRelationship(
      session,
      `source:${assertion.from.sourceId}:${assertion.from.localEntityId}`,
      `source:${assertion.to.sourceId}:${assertion.to.localEntityId}`,
      assertion.relationType,
      {
        id: `source:${descriptor.sourceId}:${assertion.localAssertionId}`,
        relationType: assertion.relationType,
        recordRole: "source-materialized",
        canonicalOwner: "docs/",
        refinementLevel: assertion.refinementLevel,
        sourceRevision: descriptor.currentRevision,
        provenance: JSON.stringify({
          sourceRef: assertion.provenance.sourceRef,
          sourceId: descriptor.sourceId,
          revision: descriptor.currentRevision,
          materialize: PILOT_KEY,
        }),
        pilotKey: PILOT_KEY,
      },
    );
  }
  return { ok: true, sourceId: descriptor.sourceId, revision: descriptor.currentRevision, entities: source.entities.length, assertions: source.assertions.length };
}

const OWNED_NODES = [
  { id: "agent:claude-director", label: "Claude Director", labelName: "Agent", nodeType: "Agent", status: "active" },
  { id: "agent:codex-worker", label: "Codex worker", labelName: "Agent", nodeType: "Agent", status: "active" },
  { id: "goal:S16-orchestration-map-pilot", label: "S16 orchestration map pilot", labelName: "Goal", nodeType: "Goal", status: "in_progress" },
  { id: "task:S16-pilot-import-source", label: "Import docs/semantic/m3e-design.source.json as source-materialized records", labelName: "Task", nodeType: "Task", status: "ready" },
  { id: "task:S16-pilot-seed-owned", label: "Seed M3E-owned Goal / Task / Agent / Gate / status records", labelName: "Task", nodeType: "Task", status: "in_progress" },
  { id: "task:S16-pilot-lint", label: "Run graph lint for ownership, role, required property, and proposal invariants", labelName: "Task", nodeType: "Task", status: "ready" },
  { id: "task:S16-pilot-recovery", label: "Prove portable snapshot plus replay recovery for pilot records", labelName: "Task", nodeType: "Task", status: "blocked" },
  { id: "task:S16-pilot-query", label: "Answer Q1 to Q3 demand queries with provenance and revision", labelName: "Task", nodeType: "Task", status: "ready" },
  { id: "gate:S16-rebuild", label: "Rebuild Gate", labelName: "Gate", nodeType: "Gate", status: "pending" },
  { id: "gate:S16-recovery", label: "Recovery Gate", labelName: "Gate", nodeType: "Gate", status: "blocked" },
  { id: "gate:S16-demand", label: "Demand Gate", labelName: "Gate", nodeType: "Gate", status: "pending" },
  { id: "proposal:S16-neo4j-activation-review", label: "Neo4j activation after Recovery Gate evidence", labelName: "Proposal", nodeType: "Proposal", status: "proposal" },
  { id: "proposal:S16-mcp-readonly-query", label: "Claude / Codex read-only query route through Neo4j MCP", labelName: "Proposal", nodeType: "Proposal", status: "proposal" },
];

const OWNED_RELATIONSHIPS = [
  ["source:src:m3e-design-corpus:strategy:S16", "goal:S16-orchestration-map-pilot", "DECOMPOSES"],
  ["goal:S16-orchestration-map-pilot", "task:S16-pilot-import-source", "DECOMPOSES"],
  ["goal:S16-orchestration-map-pilot", "task:S16-pilot-seed-owned", "DECOMPOSES"],
  ["goal:S16-orchestration-map-pilot", "task:S16-pilot-lint", "DECOMPOSES"],
  ["goal:S16-orchestration-map-pilot", "task:S16-pilot-recovery", "DECOMPOSES"],
  ["goal:S16-orchestration-map-pilot", "task:S16-pilot-query", "DECOMPOSES"],
  ["agent:codex-worker", "task:S16-pilot-import-source", "ASSIGNED_TO"],
  ["agent:codex-worker", "task:S16-pilot-seed-owned", "ASSIGNED_TO"],
  ["agent:codex-worker", "task:S16-pilot-lint", "ASSIGNED_TO"],
  ["agent:codex-worker", "task:S16-pilot-recovery", "ASSIGNED_TO"],
  ["agent:codex-worker", "task:S16-pilot-query", "ASSIGNED_TO"],
  ["task:S16-pilot-import-source", "gate:S16-rebuild", "BLOCKED_BY"],
  ["task:S16-pilot-recovery", "gate:S16-recovery", "BLOCKED_BY"],
  ["task:S16-pilot-query", "gate:S16-demand", "BLOCKED_BY"],
  ["agent:claude-director", "proposal:S16-neo4j-activation-review", "PROPOSES"],
  ["agent:claude-director", "proposal:S16-mcp-readonly-query", "PROPOSES"],
  ["proposal:S16-neo4j-activation-review", "source:src:m3e-design-corpus:adr:ADR008", "REFS"],
  ["proposal:S16-neo4j-activation-review", "source:src:m3e-design-corpus:spec:Federated_Semantic_Source", "REFS"],
  ["proposal:S16-mcp-readonly-query", "source:src:m3e-design-corpus:spec:Command_Language", "REFS"],
  ["proposal:S16-mcp-readonly-query", "source:src:m3e-design-corpus:strategy:S16", "REFS"],
];

function ownedNodeProps(node) {
  return {
    id: node.id,
    text: node.label,
    nodeType: node.nodeType,
    status: node.status,
    refinementLevel: "D3",
    recordRole: node.labelName === "Proposal" ? "proposal" : "M3E-owned accepted",
    canonicalOwner: node.labelName === "Proposal" ? "proposal journal" : "M3E Semantic Source",
    sourceId: ACCEPTED_SOURCE_ID,
    sourceRevision: PILOT_KEY,
    provenance: JSON.stringify({
      sourceRef: "docs/tasks/handoff_orchestration_map_pilot_260719.md",
      acceptedBy: "Claude Director handoff",
      materialize: PILOT_KEY,
    }),
    pilotKey: PILOT_KEY,
  };
}

async function seedOwned(session) {
  await ensureConstraints(session);
  for (const node of OWNED_NODES) {
    await upsertNode(session, ownedNodeProps(node), [node.labelName]);
  }
  for (const [fromId, toId, type] of OWNED_RELATIONSHIPS) {
    await upsertRelationship(session, fromId, toId, type, {
      id: `${fromId}-${type}-${toId}`,
      relationType: type,
      recordRole: type === "PROPOSES" ? "proposal" : "M3E-owned accepted",
      canonicalOwner: type === "PROPOSES" ? "proposal journal" : "M3E Semantic Source",
      refinementLevel: "D3",
      sourceRevision: PILOT_KEY,
      provenance: JSON.stringify({
        sourceRef: "docs/tasks/handoff_orchestration_map_pilot_260719.md",
        acceptedBy: "Claude Director handoff",
        materialize: PILOT_KEY,
      }),
      pilotKey: PILOT_KEY,
    });
  }
  return { ok: true, nodes: OWNED_NODES.length, relationships: OWNED_RELATIONSHIPS.length };
}

const LINT_QUERIES = [
  {
    code: "DUPLICATE_ID",
    cypher: "MATCH (n:SemanticRecord) WITH n.id AS id, count(n) AS count WHERE id IS NULL OR count > 1 RETURN id, count",
  },
  {
    code: "MISSING_REQUIRED_PROPERTY",
    cypher: `MATCH (n:SemanticRecord)
      UNWIND $required AS key
      WITH n, key WHERE n[key] IS NULL
      RETURN n.id AS id, key`,
    params: { required: REQUIRED_PROPERTIES },
  },
  {
    code: "ROLE_MIXED_SOURCE_MATERIALIZED",
    cypher: "MATCH (n:SourceMaterialized) WHERE n.recordRole <> 'source-materialized' RETURN n.id AS id, n.recordRole AS recordRole",
  },
  {
    code: "ROLE_MIXED_M3E_ACCEPTED",
    cypher: "MATCH (n) WHERE (n:Goal OR n:Task OR n:Agent OR n:Gate) AND n.recordRole <> 'M3E-owned accepted' RETURN n.id AS id, labels(n) AS labels, n.recordRole AS recordRole",
  },
  {
    code: "ISOLATED_PROPOSAL",
    cypher: "MATCH (p:Proposal) WHERE NOT (p)<-[:PROPOSES]-(:Agent) OR NOT (p)-[:REFS]->(:SourceMaterialized) RETURN p.id AS id",
  },
  {
    code: "RELATION_REQUIRED_PROPERTY",
    cypher: `MATCH (:SemanticRecord)-[r]->(:SemanticRecord)
      WHERE type(r) IN $types
      UNWIND $required AS key
      WITH r, key WHERE r[key] IS NULL
      RETURN r.id AS id, type(r) AS type, key`,
    params: { required: ["id", "provenance", "refinementLevel", "recordRole", "canonicalOwner"], types: Array.from(ALLOWED_RELATION_TYPES) },
  },
];

async function runLint(session) {
  const violations = [];
  for (const query of LINT_QUERIES) {
    const result = await session.run(query.cypher, query.params || {});
    for (const record of result.records) {
      violations.push({ code: query.code, ...record.toObject() });
    }
  }
  return { ok: violations.length === 0, violations, checked: LINT_QUERIES.map((query) => query.code) };
}

async function exportSnapshot(session) {
  const nodeResult = await session.run(
    "MATCH (n:SemanticRecord {pilotKey: $pilotKey}) RETURN n ORDER BY n.id",
    { pilotKey: PILOT_KEY },
  );
  const relResult = await session.run(
    `MATCH (a:SemanticRecord {pilotKey: $pilotKey})-[r]->(b:SemanticRecord {pilotKey: $pilotKey})
     RETURN a.id AS fromId, type(r) AS type, b.id AS toId, properties(r) AS properties
     ORDER BY fromId, type, toId`,
    { pilotKey: PILOT_KEY },
  );
  const nodes = nodeResult.records.map((record) => {
    const node = record.get("n");
    return { labels: node.labels, properties: node.properties };
  });
  const relationships = relResult.records.map((record) => record.toObject());
  const snapshot = {
    schema: SNAPSHOT_SCHEMA,
    pilotKey: PILOT_KEY,
    exportedAt: new Date().toISOString(),
    nodes,
    relationships,
  };
  return { ...snapshot, semanticContentHash: hash({ nodes, relationships }) };
}

async function restoreSnapshot(session, snapshot) {
  if (snapshot.schema !== SNAPSHOT_SCHEMA) throw new Error(`Unsupported snapshot schema: ${snapshot.schema}`);
  await ensureConstraints(session);
  await session.run("MATCH (n:SemanticRecord {pilotKey: $pilotKey}) DETACH DELETE n", { pilotKey: snapshot.pilotKey || PILOT_KEY });
  for (const node of snapshot.nodes) {
    const labels = node.labels.filter((label) => /^[A-Za-z][A-Za-z0-9_]*$/.test(label));
    await upsertNode(session, node.properties, labels);
  }
  for (const rel of snapshot.relationships) {
    await upsertRelationship(session, rel.fromId, rel.toId, rel.type, rel.properties);
  }
  return { ok: true, restoredNodes: snapshot.nodes.length, restoredRelationships: snapshot.relationships.length };
}

const QUERY_DEFS = {
  Q1: {
    description: "Goal-linked unfinished Task records and blocking Gate records.",
    cypher: `MATCH (g:Goal {id: $goalId})-[:DECOMPOSES]->(t:Task)
      OPTIONAL MATCH (t)-[:BLOCKED_BY]->(gate:Gate)
      WHERE coalesce(t.status, '') <> 'done'
      RETURN g.id AS goalId, t.id AS taskId, t.text AS task, t.status AS taskStatus,
        collect({id: gate.id, text: gate.text, status: gate.status, provenance: gate.provenance, revision: gate.sourceRevision}) AS blockingGates,
        t.provenance AS provenance, t.sourceRevision AS revision
      ORDER BY taskId`,
    params: { goalId: "goal:S16-orchestration-map-pilot" },
  },
  Q2: {
    description: "Agent-owned Task records and wait state.",
    cypher: `MATCH (agent:Agent {id: $agentId})-[:ASSIGNED_TO]->(task:Task)
      OPTIONAL MATCH (task)-[:BLOCKED_BY]->(gate:Gate)
      RETURN agent.id AS agentId, task.id AS taskId, task.text AS task, task.status AS taskStatus,
        collect({id: gate.id, text: gate.text, status: gate.status}) AS blockingGates,
        task.provenance AS provenance, task.sourceRevision AS revision
      ORDER BY taskId`,
    params: { agentId: "agent:codex-worker" },
  },
  Q3: {
    description: "S16 proposal records and source-materialized evidence documents.",
    cypher: `MATCH (agent:Agent)-[:PROPOSES]->(proposal:Proposal)-[:REFS]->(doc:SourceMaterialized)
      WHERE proposal.id STARTS WITH 'proposal:S16'
      RETURN proposal.id AS proposalId, proposal.text AS proposal, proposal.status AS proposalStatus,
        agent.id AS proposedBy, doc.id AS evidenceId, doc.text AS evidence, doc.documentRef AS documentRef,
        doc.recordRole AS evidenceRole, doc.provenance AS evidenceProvenance, doc.sourceRevision AS evidenceRevision,
        proposal.provenance AS proposalProvenance, proposal.sourceRevision AS proposalRevision
      ORDER BY proposalId, evidenceId`,
    params: {},
  },
};

async function runPilotQuery(session, id, overrides = {}) {
  const query = QUERY_DEFS[id];
  if (!query) throw new Error(`Unknown query id: ${id}`);
  const result = await session.run(query.cypher, { ...query.params, ...overrides });
  return { ok: true, id, description: query.description, rows: result.records.map((record) => record.toObject()) };
}

function writeOutputMaybe(args, value) {
  if (args.out) {
    const outPath = path.resolve(String(args.out));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(value, null, 2)}\n`);
    return { ...value, outputPath: path.relative(REPO_ROOT, outPath) };
  }
  return value;
}

module.exports = {
  ACCEPTED_SOURCE_ID,
  DEFAULT_ENV,
  DEFAULT_SOURCE,
  PILOT_KEY,
  QUERY_DEFS,
  REPO_ROOT,
  SNAPSHOT_SCHEMA,
  fail,
  importSource,
  jsonOut,
  parseArgs,
  readJson,
  restoreSnapshot,
  runLint,
  runPilotQuery,
  seedOwned,
  validateSourcePackage,
  withSession,
  writeOutputMaybe,
  exportSnapshot,
};

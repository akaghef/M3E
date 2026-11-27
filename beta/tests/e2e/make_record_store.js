"use strict";
// Creates an empty record store in a given Neo4j and prints the environment that starts a server on it.
//   node tests/e2e/make_record_store.js <bolt uri> [store name] [workspace id]
// When the Neo4j requires authentication, M3E_NEO4J_USER and M3E_NEO4J_PASSWORD
// (or M3E_NEO4J_PASSWORD_FILE) and M3E_NEO4J_DATABASE are read and, except the password, printed back.
// Refuses port 7687. Needs `npm run build` first.
const { randomUUID } = require("crypto");
const { RecordWorkspaceStore } = require("../../dist/node/record_store/store");
const { toSnapshot } = require("../../dist/shared/record_model/to_snapshot");
const { neo4jConnectionFromEnv } = require("../../dist/node/record_store/neo4j_durability");

async function main() {
  const bolt = process.argv[2];
  const storeName = process.argv[3] || `e2e-${randomUUID()}`;
  const workspaceId = process.argv[4] || "ws_e2e_store";
  if (!bolt || bolt.startsWith("-")) {
    console.error("Usage: node tests/e2e/make_record_store.js <bolt uri> [store name] [workspace id]");
    process.exit(2);
  }
  if (/:7687\b/.test(bolt)) {
    console.error("Refusing port 7687 (the Neo4j that holds real data).");
    process.exit(2);
  }
  const fromEnv = neo4jConnectionFromEnv(process.env, "M3E_NEO4J");
  const connection = { uri: bolt };
  if (fromEnv && fromEnv.user) {
    connection.user = fromEnv.user;
    connection.password = fromEnv.password ?? "";
  }
  if (fromEnv && fromEnv.database) connection.database = fromEnv.database;
  await RecordWorkspaceStore.createInNeo4j(connection, storeName, toSnapshot(workspaceId, [], { now: new Date().toISOString() }));
  const lines = [
    `M3E_RECORD_STORE=${storeName}`,
    `M3E_NEO4J_BOLT=${bolt}`,
    `M3E_WORKSPACE_ID=${workspaceId}`,
  ];
  if (connection.user) lines.push(`M3E_NEO4J_USER=${connection.user}`);
  if (connection.database) lines.push(`M3E_NEO4J_DATABASE=${connection.database}`);
  const passwordFile = process.env.M3E_NEO4J_PASSWORD_FILE;
  if (passwordFile) lines.push(`M3E_NEO4J_PASSWORD_FILE=${passwordFile}`);
  else if (connection.user) console.error("M3E_NEO4J_PASSWORD is not printed; export the same value for the server.");
  for (const line of lines) console.log(line);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

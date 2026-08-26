#!/usr/bin/env node
/**
 * Create a separately named, whole-map performance fixture with all folder
 * scope boundaries removed. The source map is read-only: only the map ID
 * created by this invocation is written.
 */
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(here, "fixtures");
const defaultManifestPath = path.join(fixturesDir, "pfr-blueprint.unscoped-full.performance-fixture.manifest.json");

function usage() {
  return `Usage: node perf/make_unscoped_fixture.mjs [options]

  --base-url URL       Viewer/API origin (required; no default server)
  --source-map-id ID   Source map to read (required)
  --workspace-id ID    Workspace ID to put in the viewer manifest (required)
  --output PATH        Manifest path under beta/perf/fixtures/ (default: ${path.basename(defaultManifestPath)})
  --help               Show this text`;
}

function parseArgs(argv) {
  const options = {
    baseUrl: undefined,
    sourceMapId: undefined,
    workspaceId: undefined,
    outputPath: defaultManifestPath,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help") {
      console.log(usage());
      process.exit(0);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
    index += 1;
    if (arg === "--base-url") options.baseUrl = value.replace(/\/$/, "");
    else if (arg === "--source-map-id") options.sourceMapId = value;
    else if (arg === "--workspace-id") options.workspaceId = value;
    else if (arg === "--output") options.outputPath = path.resolve(value);
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (!options.baseUrl) throw new Error("--base-url is required");
  if (!options.sourceMapId) throw new Error("--source-map-id is required");
  if (!options.workspaceId) throw new Error("--workspace-id is required");
  const relativeOutput = path.relative(fixturesDir, options.outputPath);
  if (relativeOutput.startsWith("..") || path.isAbsolute(relativeOutput)) {
    throw new Error(`--output must stay under ${fixturesDir}`);
  }
  return options;
}

// Keep this byte-for-byte equivalent to the runner's canonicalization.
function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function stateHash(state) {
  return createHash("sha256").update(stableSerialize(state), "utf8").digest("hex");
}

function countCollection(value) {
  return Array.isArray(value) ? value.length : Object.keys(value || {}).length;
}

function jsonPointer(key) {
  return key.replaceAll("~", "~0").replaceAll("/", "~1");
}

async function apiJson(baseUrl, pathname, init = {}) {
  const headers = {
    Accept: "application/json",
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(init.headers || {}),
  };
  const response = await fetch(`${baseUrl}${pathname}`, { ...init, headers });
  const text = await response.text();
  let body = null;
  if (text.trim().length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`API ${pathname} returned non-JSON response (${response.status})`);
    }
  }
  if (!response.ok) {
    throw new Error(`API ${pathname} returned ${response.status}: ${text}`);
  }
  return body;
}

function savedState(document, label) {
  const state = document?.state;
  if (!state || typeof state !== "object" || typeof state.rootId !== "string" || !state.nodes || typeof state.nodes !== "object") {
    throw new Error(`${label} API response has no valid map state`);
  }
  return state;
}

export function unscopenState(sourceState) {
  const transformedState = structuredClone(sourceState);
  let unscopedFolderCount = 0;
  for (const node of Object.values(transformedState.nodes)) {
    if (!node || typeof node !== "object") throw new Error("Source state contains an invalid node");
    if (node.nodeType === "folder") {
      // This is the persisted form of viewer.ts makeSelectedFolder(): the
      // boundary is removed while the node and its children remain intact.
      node.nodeType = "text";
      unscopedFolderCount += 1;
    }
  }
  return { state: transformedState, unscopedFolderCount };
}

function assertSameState(actual, expected, label) {
  if (stableSerialize(actual) !== stableSerialize(expected)) {
    throw new Error(`${label} changed fields beyond the requested folder unscopen transformation`);
  }
}

function assertGeneratedMapResponse(response, label) {
  if (!response || response.ok !== true || typeof response.id !== "string" || response.id.length === 0) {
    throw new Error(`${label} did not return a new map ID`);
  }
  return response.id;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourcePath = `/api/maps/${encodeURIComponent(options.sourceMapId)}`;

  // Read the source state first. No source-map mutation endpoint is called.
  const sourceDocument = await apiJson(options.baseUrl, sourcePath);
  const sourceState = savedState(sourceDocument, "Source map");
  const sourceStateHash = stateHash(sourceState);
  const { state: transformedState, unscopedFolderCount } = unscopenState(sourceState);
  const existingMapsDocument = await apiJson(options.baseUrl, "/api/maps?includeArchived=true");
  if (!Array.isArray(existingMapsDocument?.maps)) throw new Error("GET /api/maps returned no map list");
  const existingMapIds = new Set(existingMapsDocument.maps.map((entry) => entry?.id).filter((id) => typeof id === "string"));

  // The duplicate endpoint is the server's canonical new-map operation. The
  // returned ID is the only ID this script will POST to after this point.
  const duplicateAt = new Date().toISOString();
  const duplicateResponse = await apiJson(options.baseUrl, `${sourcePath}/duplicate`, { method: "POST" });
  const generatedMapId = assertGeneratedMapResponse(duplicateResponse, "Duplicate API");
  if (generatedMapId === options.sourceMapId || existingMapIds.has(generatedMapId)) {
    throw new Error("Duplicate API returned an existing map ID; refusing to overwrite it");
  }

  const duplicateDocument = await apiJson(options.baseUrl, `/api/maps/${encodeURIComponent(generatedMapId)}`);
  const duplicateState = savedState(duplicateDocument, "Generated duplicate");
  assertSameState(duplicateState, sourceState, "Generated duplicate");

  // This POST targets only the map just created by the duplicate operation.
  await apiJson(options.baseUrl, `/api/maps/${encodeURIComponent(generatedMapId)}`, {
    method: "POST",
    body: JSON.stringify({ state: transformedState }),
  });

  const [savedDocument, scopedDocument, listDocument] = await Promise.all([
    apiJson(options.baseUrl, `/api/maps/${encodeURIComponent(generatedMapId)}`),
    apiJson(options.baseUrl, `/api/maps/${encodeURIComponent(generatedMapId)}?scope=${encodeURIComponent(transformedState.rootId)}`),
    apiJson(options.baseUrl, "/api/maps?includeArchived=true"),
  ]);
  const finalState = savedState(savedDocument, "Generated fixture");
  assertSameState(finalState, transformedState, "Generated fixture");
  const scopedState = savedState(scopedDocument, "Generated fixture root scope");
  const metadata = (listDocument?.maps || []).find((entry) => entry.id === generatedMapId);
  if (!metadata) throw new Error(`Generated map ${generatedMapId} was not returned by GET /api/maps`);

  const root = finalState.nodes[finalState.rootId];
  if (!root || typeof root.text !== "string") throw new Error("Generated fixture root node has no text label");
  const createdAt = new Date().toISOString();
  const manifest = {
    $schema: "../schemas/webgl-pan-zoom-result.schema.json",
    schemaVersion: 1,
    kind: "m3e-webgl-pan-zoom-fixture",
    fixture: {
      workspaceId: options.workspaceId,
      mapId: generatedMapId,
      scopeId: finalState.rootId,
      label: root.text,
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
    },
    integrity: {
      canonicalization: "recursive sorted object keys; array order preserved; SHA-256 over UTF-8 JSON scalar serialization",
      fixtureContentHash: stateHash(finalState),
      normalizedRootText: root.text,
      allowedMutableStatePaths: [`/nodes/${jsonPointer(finalState.rootId)}/text`],
      counts: {
        nodeCount: countCollection(finalState.nodes),
        linkCount: countCollection(finalState.links),
        scopeNodeCount: countCollection(scopedState.nodes),
        scopeLinkCount: countCollection(scopedState.links),
      },
    },
    provenance: {
      createdAt,
      duplicateAt,
      sourceMapId: options.sourceMapId,
      sourceStateHash,
      duplicateRawStateHashBeforeTransform: stateHash(duplicateState),
      rawStateEqualityVerified: true,
      unscopedFolderCount,
    },
    notes: [
      "Created by POST /api/maps/{sourceMapId}/duplicate, then saved only to the returned new map ID.",
      "Every source node with nodeType=folder was changed to nodeType=text; node identity, children, text, attributes, links, and all other state fields were preserved.",
      "scopeId is the generated map rootId so the runner reads the complete map subtree after all folder boundaries are removed.",
      "The output path is created with exclusive write semantics; an existing manifest is never overwritten.",
    ],
  };

  await writeFile(options.outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({
    status: "fixture-created",
    sourceMapId: options.sourceMapId,
    mapId: generatedMapId,
    scopeId: finalState.rootId,
    manifestPath: options.outputPath,
    counts: manifest.integrity.counts,
    unscopedFolderCount,
  }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}

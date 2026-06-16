import { test, expect } from "vitest";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Database = require("better-sqlite3");

const {
  installBindingCopy,
  loadBindingCopy,
  ensureBindingAnchor,
  buildMirrorRelationToOwnerPatch,
  validateBindingPatch,
  applyBindingPatchToState,
  persistBindingRun,
} = require("../../dist/node/scope_binding.js");

function tmpWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "m3e-binding-"));
}

function node(id, parentId, text, children = [], nodeType = "text") {
  return {
    id,
    parentId,
    children,
    nodeType,
    text,
    collapsed: false,
    details: "",
    note: "",
    attributes: {},
    link: "",
  };
}

function bindingFixture() {
  return {
    rootId: "scope_common",
    nodes: {
      scope_common: node("scope_common", null, "具体例", ["scope_target", "scope_relation"], "folder"),
      scope_target: node("scope_target", "scope_common", "対象図", ["akaghef"], "folder"),
      akaghef: node("akaghef", "scope_target", "Akaghef", ["fallback"], "text"),
      fallback: node("fallback", "akaghef", "_", ["target_A"], "text"),
      target_A: node("target_A", "fallback", "A", [], "text"),
      scope_relation: node("scope_relation", "scope_common", "関係図", ["rel_A", "rel_E"], "folder"),
      rel_A: node("rel_A", "scope_relation", "A", [], "text"),
      rel_E: node("rel_E", "scope_relation", "E", [], "text"),
    },
    links: {
      link_line: {
        id: "link_line",
        sourceNodeId: "rel_A",
        targetNodeId: "rel_E",
        label: "LINE",
        direction: "forward",
        style: "default",
      },
    },
  };
}

test("scope binding reconcile mirrors relation scope nodes into owner fallback path", () => {
  const workspace = tmpWorkspace();
  const dbPath = path.join(workspace, "data.sqlite");
  try {
    const copy = installBindingCopy(dbPath, workspace, {
      bindingId: "friends-target-relation",
      mapId: "map_binding_test",
      templateId: "mirror-relation-node-to-owner-scope",
      templateVersion: "1.0.0",
      commonScopeId: "scope_common",
      anchorScopeId: "scope_common",
      anchorNodeId: "binding_anchor",
      participantScopeIds: {
        target: "scope_target",
        relation: "scope_relation",
      },
      params: {
        ownerFallbackPath: ["Akaghef", "_"],
      },
    });

    const anchored = ensureBindingAnchor(bindingFixture(), "scope_common", "friends-target-relation");
    expect(anchored.state.nodes[anchored.dotNodeId].text).toBe(".");
    expect(anchored.state.nodes[anchored.bindingsNodeId].text).toBe("bindings");
    expect(anchored.state.nodes[anchored.anchorNodeId].text).toBe("friends-target-relation");
    expect(anchored.state.nodes[anchored.anchorNodeId].attributes["m3e:binding-id"]).toBe("friends-target-relation");

    const loadedCopy = loadBindingCopy(dbPath, "friends-target-relation");
    expect(loadedCopy.participantScopeIds).toEqual(copy.participantScopeIds);
    expect(fs.existsSync(path.join(workspace, "bindings", "scope_common", "friends-target-relation", "binding.ts"))).toBe(true);
    expect(fs.existsSync(path.join(workspace, "bindings", "scope_common", "friends-target-relation", "manifest.json"))).toBe(true);

    const state = bindingFixture();
    const patch = buildMirrorRelationToOwnerPatch({
      workspaceId: "ws_test",
      mapId: "map_binding_test",
      binding: loadedCopy,
      state,
    });

    expect(patch.operations.filter((op) => op.op === "node.create").map((op) => op.payload.text)).toEqual(["E"]);
    expect(patch.operations.some((op) => op.op === "node.create" && op.payload.text === "LINE")).toBe(false);
    expect(validateBindingPatch(state, patch).filter((d) => d.level === "error")).toEqual([]);

    const next = applyBindingPatchToState(state, patch);
    const fallbackChildren = next.nodes.fallback.children.map((id) => next.nodes[id].text);
    expect(fallbackChildren).toEqual(["A", "E"]);
    expect(Object.values(next.nodes).some((n) => n.text === "LINE")).toBe(false);
    expect(next.links.link_line.label).toBe("LINE");

    const run = persistBindingRun(dbPath, patch, { dryRun: false });
    expect(run.status).toBe("applied");

    const db = new Database(dbPath);
    try {
      const entities = db.prepare("SELECT entity_id, label FROM binding_entity ORDER BY label").all();
      expect(entities).toEqual([
        { entity_id: "person:A", label: "A" },
        { entity_id: "person:E", label: "E" },
      ]);
      const memberCount = db.prepare("SELECT COUNT(*) AS count FROM binding_member").get().count;
      expect(memberCount).toBe(4);
      const patchRows = db.prepare("SELECT operation, apply_status FROM binding_patch ORDER BY operation").all();
      expect(patchRows.some((row) => row.operation === "node.create" && row.apply_status === "applied")).toBe(true);
    } finally {
      db.close();
    }
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("scope binding onEvent mirrors a newly created relation node only", () => {
  const workspace = tmpWorkspace();
  const dbPath = path.join(workspace, "data.sqlite");
  try {
    const copy = installBindingCopy(dbPath, workspace, {
      bindingId: "friends-target-relation",
      mapId: "map_binding_event",
      templateId: "mirror-relation-node-to-owner-scope",
      templateVersion: "1.0.0",
      commonScopeId: "scope_common",
      participantScopeIds: {
        target: "scope_target",
        relation: "scope_relation",
      },
      params: {
        ownerFallbackPath: ["Akaghef", "_"],
      },
    });
    const state = bindingFixture();
    state.nodes.scope_relation.children.push("rel_N");
    state.nodes.rel_N = node("rel_N", "scope_relation", "N", [], "text");

    const event = {
      eventId: "event_node_created_N",
      mapId: "map_binding_event",
      type: "node.created",
      sourceScopeId: "scope_relation",
      sourceNodeId: "rel_N",
      payload: { nodeId: "rel_N" },
    };
    const patch = buildMirrorRelationToOwnerPatch({
      workspaceId: "ws_test",
      mapId: "map_binding_event",
      binding: copy,
      event,
      state,
    });

    expect(patch.operations.filter((op) => op.op === "node.create").map((op) => op.payload.text)).toEqual(["N"]);
    const next = applyBindingPatchToState(state, patch);
    expect(next.nodes.fallback.children.map((id) => next.nodes[id].text)).toEqual(["A", "N"]);

    persistBindingRun(dbPath, patch, { event, dryRun: false });
    const db = new Database(dbPath);
    try {
      const eventRow = db.prepare("SELECT type, source_node_id AS sourceNodeId FROM binding_event WHERE event_id = ?").get("event_node_created_N");
      expect(eventRow).toEqual({ type: "node.created", sourceNodeId: "rel_N" });
      const entity = db.prepare("SELECT entity_id AS entityId, label FROM binding_entity WHERE entity_id = ?").get("person:N");
      expect(entity).toEqual({ entityId: "person:N", label: "N" });
    } finally {
      db.close();
    }
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

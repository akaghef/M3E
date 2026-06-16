"use strict";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { AppState, TreeNode } from "../shared/types";

type SqliteDatabase = InstanceType<typeof Database>;

export type BindingStatus = "active" | "paused" | "broken";
export type BindingEntityStatus = "active" | "orphan" | "review" | "deleted";
export type BindingMemberRole = "owner" | "view" | "relation" | "derived";

export interface BindingCopyRecord {
  bindingId: string;
  mapId: string;
  templateId: string;
  templateVersion: string;
  commonScopeId: string;
  anchorScopeId?: string;
  anchorNodeId?: string;
  participantScopeIds: Record<string, string>;
  params: Record<string, unknown>;
  scriptRef?: string;
  scriptHash?: string;
  status?: BindingStatus;
}

export interface BindingEventRecord {
  eventId: string;
  mapId: string;
  type: string;
  sourceScopeId?: string;
  sourceNodeId?: string;
  sourceGraphLinkId?: string;
  originBindingId?: string;
  payload?: unknown;
  createdAt?: string;
}

export interface BindingContext {
  workspaceId: string;
  mapId: string;
  binding: BindingCopyRecord;
  event?: BindingEventRecord;
  state: AppState;
}

export interface BindingPatch {
  bindingId: string;
  idempotencyKey: string;
  operations: BindingOperation[];
  diagnostics: BindingDiagnostic[];
}

export type BindingOperation =
  | { op: "node.create"; payload: NodeCreatePayload }
  | { op: "bindingEntity.upsert"; payload: BindingEntityUpsertPayload }
  | { op: "bindingMember.upsert"; payload: BindingMemberUpsertPayload }
  | { op: "review.create"; payload: ReviewCreatePayload };

export interface NodeCreatePayload {
  nodeId: string;
  parentId: string;
  text: string;
  nodeType?: "text" | "folder";
  attributes?: Record<string, string>;
}

export interface BindingEntityUpsertPayload {
  bindingEntityId: string;
  bindingId: string;
  entityId: string;
  label: string;
  status: BindingEntityStatus;
}

export interface BindingMemberUpsertPayload {
  memberId: string;
  bindingEntityId: string;
  scopeId: string;
  nodeId: string;
  role: BindingMemberRole;
}

export interface ReviewCreatePayload {
  reason: string;
  scopeId?: string;
  nodeId?: string;
  detail?: string;
}

export interface BindingDiagnostic {
  level: "info" | "warning" | "error";
  code: string;
  message: string;
  nodeId?: string;
}

export interface PersistedBindingRun {
  runId: string;
  status: "dry_run" | "applied" | "failed";
  patchCount: number;
}

export interface BindingAnchorResult {
  state: AppState;
  dotNodeId: string;
  bindingsNodeId: string;
  anchorNodeId: string;
}

const DEFAULT_SCRIPT = `export { onEvent, reconcile } from "@m3e/builtins/mirror-relation-node-to-owner-scope";\n`;

function stableHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function stableId(prefix: string, ...parts: string[]): string {
  return `${prefix}_${stableHash(parts.join("\u001f"))}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function asJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function parseJsonRecord(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  const parsed = JSON.parse(raw) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

function openBindingDb(dbPath: string): SqliteDatabase {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  ensureScopeBindingSchema(db);
  return db;
}

export function ensureScopeBindingSchema(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS binding_template (
      template_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      schema_version TEXT NOT NULL,
      params_schema TEXT NOT NULL,
      trigger_schema TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS binding_template_script (
      script_id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      language TEXT NOT NULL,
      script_ref TEXT NOT NULL,
      script_hash TEXT NOT NULL,
      FOREIGN KEY (template_id) REFERENCES binding_template(template_id)
    );

    CREATE TABLE IF NOT EXISTS binding_copy (
      binding_id TEXT PRIMARY KEY,
      map_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      template_version TEXT NOT NULL,
      common_scope_id TEXT NOT NULL,
      anchor_scope_id TEXT,
      anchor_node_id TEXT,
      params TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS binding_copy_script (
      binding_id TEXT PRIMARY KEY,
      language TEXT NOT NULL,
      script_ref TEXT NOT NULL,
      script_hash TEXT NOT NULL,
      compiled_ref TEXT,
      FOREIGN KEY (binding_id) REFERENCES binding_copy(binding_id)
    );

    CREATE TABLE IF NOT EXISTS binding_participant_scope (
      id TEXT PRIMARY KEY,
      binding_id TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      role TEXT NOT NULL,
      FOREIGN KEY (binding_id) REFERENCES binding_copy(binding_id)
    );

    CREATE TABLE IF NOT EXISTS binding_entity (
      binding_entity_id TEXT PRIMARY KEY,
      binding_id TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      label TEXT NOT NULL,
      status TEXT NOT NULL,
      UNIQUE (binding_id, entity_id),
      FOREIGN KEY (binding_id) REFERENCES binding_copy(binding_id)
    );

    CREATE TABLE IF NOT EXISTS binding_member (
      member_id TEXT PRIMARY KEY,
      binding_entity_id TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      role TEXT NOT NULL,
      UNIQUE (binding_entity_id, scope_id, node_id),
      FOREIGN KEY (binding_entity_id) REFERENCES binding_entity(binding_entity_id)
    );

    CREATE TABLE IF NOT EXISTS binding_event (
      event_id TEXT PRIMARY KEY,
      map_id TEXT NOT NULL,
      type TEXT NOT NULL,
      source_scope_id TEXT,
      source_node_id TEXT,
      source_graph_link_id TEXT,
      origin_binding_id TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS binding_run (
      run_id TEXT PRIMARY KEY,
      binding_id TEXT NOT NULL,
      event_id TEXT,
      mode TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL,
      FOREIGN KEY (binding_id) REFERENCES binding_copy(binding_id)
    );

    CREATE TABLE IF NOT EXISTS binding_patch (
      patch_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      patch_hash TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      validation_status TEXT NOT NULL,
      apply_status TEXT NOT NULL,
      UNIQUE (run_id, idempotency_key, operation, patch_hash),
      FOREIGN KEY (run_id) REFERENCES binding_run(run_id)
    );
  `);
}

export function installBindingCopy(dbPath: string, workspaceDir: string, copy: BindingCopyRecord, scriptBody = DEFAULT_SCRIPT): BindingCopyRecord {
  const bindingDir = path.join(workspaceDir, "bindings", copy.commonScopeId, copy.bindingId);
  fs.mkdirSync(bindingDir, { recursive: true });
  const scriptRef = copy.scriptRef || path.join("bindings", copy.commonScopeId, copy.bindingId, "binding.ts");
  const scriptPath = path.join(workspaceDir, scriptRef);
  const scriptHash = copy.scriptHash || `sha256:${crypto.createHash("sha256").update(scriptBody).digest("hex")}`;
  fs.writeFileSync(scriptPath, scriptBody, "utf8");

  const normalized: BindingCopyRecord = {
    ...copy,
    scriptRef,
    scriptHash,
    status: copy.status || "active",
  };
  const manifestPath = path.join(bindingDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(normalized, null, 2), "utf8");

  const db = openBindingDb(dbPath);
  try {
    db.prepare(`
      INSERT INTO binding_template (template_id, name, version, schema_version, params_schema, trigger_schema, status)
      VALUES (@templateId, @name, @version, @schemaVersion, @paramsSchema, @triggerSchema, 'active')
      ON CONFLICT(template_id) DO UPDATE SET
        name = excluded.name,
        version = excluded.version,
        schema_version = excluded.schema_version,
        params_schema = excluded.params_schema,
        trigger_schema = excluded.trigger_schema,
        status = excluded.status
    `).run({
      templateId: normalized.templateId,
      name: normalized.templateId,
      version: normalized.templateVersion,
      schemaVersion: "1",
      paramsSchema: asJson({ ownerFallbackPath: "string[]" }),
      triggerSchema: asJson(["node.created", "node.renamed", "graphLink.created", "graphLink.updated"]),
    });
    db.prepare(`
      INSERT INTO binding_copy (binding_id, map_id, template_id, template_version, common_scope_id, anchor_scope_id, anchor_node_id, params, status)
      VALUES (@bindingId, @mapId, @templateId, @templateVersion, @commonScopeId, @anchorScopeId, @anchorNodeId, @params, @status)
      ON CONFLICT(binding_id) DO UPDATE SET
        map_id = excluded.map_id,
        template_id = excluded.template_id,
        template_version = excluded.template_version,
        common_scope_id = excluded.common_scope_id,
        anchor_scope_id = excluded.anchor_scope_id,
        anchor_node_id = excluded.anchor_node_id,
        params = excluded.params,
        status = excluded.status
    `).run({
      bindingId: normalized.bindingId,
      mapId: normalized.mapId,
      templateId: normalized.templateId,
      templateVersion: normalized.templateVersion,
      commonScopeId: normalized.commonScopeId,
      anchorScopeId: normalized.anchorScopeId || null,
      anchorNodeId: normalized.anchorNodeId || null,
      params: asJson(normalized.params),
      status: normalized.status,
    });
    db.prepare(`
      INSERT INTO binding_copy_script (binding_id, language, script_ref, script_hash, compiled_ref)
      VALUES (?, 'ts', ?, ?, NULL)
      ON CONFLICT(binding_id) DO UPDATE SET
        language = excluded.language,
        script_ref = excluded.script_ref,
        script_hash = excluded.script_hash,
        compiled_ref = excluded.compiled_ref
    `).run(normalized.bindingId, normalized.scriptRef, normalized.scriptHash);

    const deleteParticipants = db.prepare(`DELETE FROM binding_participant_scope WHERE binding_id = ?`);
    deleteParticipants.run(normalized.bindingId);
    const insertParticipant = db.prepare(`
      INSERT INTO binding_participant_scope (id, binding_id, scope_id, role)
      VALUES (@id, @bindingId, @scopeId, @role)
    `);
    Object.entries(normalized.participantScopeIds).forEach(([role, scopeId]) => {
      insertParticipant.run({
        id: stableId("bps", normalized.bindingId, role, scopeId),
        bindingId: normalized.bindingId,
        scopeId,
        role,
      });
    });
  } finally {
    db.close();
  }
  return normalized;
}

export function loadBindingCopy(dbPath: string, bindingId: string): BindingCopyRecord | null {
  const db = openBindingDb(dbPath);
  try {
    const row = db.prepare(`
      SELECT binding_id AS bindingId, map_id AS mapId, template_id AS templateId,
             template_version AS templateVersion, common_scope_id AS commonScopeId,
             anchor_scope_id AS anchorScopeId, anchor_node_id AS anchorNodeId,
             params, status
      FROM binding_copy WHERE binding_id = ?
    `).get(bindingId) as (Omit<BindingCopyRecord, "participantScopeIds" | "params"> & { params: string }) | undefined;
    if (!row) return null;
    const script = db.prepare(`
      SELECT script_ref AS scriptRef, script_hash AS scriptHash FROM binding_copy_script WHERE binding_id = ?
    `).get(bindingId) as { scriptRef: string; scriptHash: string } | undefined;
    const participants = db.prepare(`
      SELECT role, scope_id AS scopeId FROM binding_participant_scope WHERE binding_id = ?
    `).all(bindingId) as Array<{ role: string; scopeId: string }>;
    const participantScopeIds: Record<string, string> = {};
    participants.forEach((p) => {
      participantScopeIds[p.role] = p.scopeId;
    });
    return {
      ...row,
      anchorScopeId: row.anchorScopeId || undefined,
      anchorNodeId: row.anchorNodeId || undefined,
      params: parseJsonRecord(row.params),
      participantScopeIds,
      scriptRef: script?.scriptRef,
      scriptHash: script?.scriptHash,
    };
  } finally {
    db.close();
  }
}

function nodeLabel(node: TreeNode | undefined): string {
  return (node?.text || "").trim();
}

function directChildByLabel(state: AppState, parentId: string, label: string): TreeNode | undefined {
  const parent = state.nodes[parentId];
  if (!parent) return undefined;
  const normalized = label.trim().toLowerCase();
  for (const childId of parent.children || []) {
    const child = state.nodes[childId];
    if (nodeLabel(child).toLowerCase() === normalized) {
      return child;
    }
  }
  return undefined;
}

function appendChildNode(state: AppState, parentId: string, child: TreeNode): void {
  const parent = state.nodes[parentId];
  if (!parent) {
    throw new Error(`Parent node not found: ${parentId}`);
  }
  state.nodes[child.id] = child;
  if (!parent.children.includes(child.id)) {
    parent.children.push(child.id);
  }
}

function createTextNode(id: string, parentId: string, text: string, attributes: Record<string, string> = {}): TreeNode {
  return {
    id,
    parentId,
    children: [],
    nodeType: "text",
    text,
    collapsed: false,
    details: "",
    note: "",
    attributes,
    link: "",
  };
}

export function ensureBindingAnchor(state: AppState, commonScopeId: string, bindingId: string): BindingAnchorResult {
  if (!state.nodes[commonScopeId]) {
    throw new Error(`Common scope node not found: ${commonScopeId}`);
  }
  const next: AppState = JSON.parse(JSON.stringify(state)) as AppState;
  let dot = directChildByLabel(next, commonScopeId, ".");
  if (!dot) {
    dot = createTextNode(stableId("n_bind_anchor", commonScopeId, "."), commonScopeId, ".", {
      "m3e:hidden": "true",
      "m3e:binding-anchor": "hidden-root",
    });
    appendChildNode(next, commonScopeId, dot);
  }
  let bindings = directChildByLabel(next, dot.id, "bindings");
  if (!bindings) {
    bindings = createTextNode(stableId("n_bind_anchor", dot.id, "bindings"), dot.id, "bindings", {
      "m3e:hidden": "true",
      "m3e:binding-anchor": "collection",
    });
    appendChildNode(next, dot.id, bindings);
  }
  let anchor = directChildByLabel(next, bindings.id, bindingId);
  if (!anchor) {
    anchor = createTextNode(stableId("n_bind_anchor", bindings.id, bindingId), bindings.id, bindingId, {
      "m3e:hidden": "true",
      "m3e:binding-id": bindingId,
      "m3e:binding-anchor": "copy",
    });
    appendChildNode(next, bindings.id, anchor);
  }
  return {
    state: next,
    dotNodeId: dot.id,
    bindingsNodeId: bindings.id,
    anchorNodeId: anchor.id,
  };
}

function scopeDirectChildren(state: AppState, scopeId: string): TreeNode[] {
  const scope = state.nodes[scopeId];
  if (!scope) return [];
  return (scope.children || [])
    .map((id) => state.nodes[id])
    .filter((node): node is TreeNode => Boolean(node));
}

function syntheticNodeId(bindingId: string, parentId: string, label: string): string {
  return stableId("n_bind", bindingId, parentId, label.trim().toLowerCase());
}

function entityIdForLabel(label: string): string {
  return `person:${label.trim()}`;
}

function bindingEntityId(bindingId: string, entityId: string): string {
  return stableId("be", bindingId, entityId);
}

function bindingMemberId(bindingEntity: string, scopeId: string, nodeId: string, role: string): string {
  return stableId("bm", bindingEntity, scopeId, nodeId, role);
}

function ownerFallbackPath(binding: BindingCopyRecord): string[] {
  const raw = binding.params.ownerFallbackPath;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function ensurePathOps(state: AppState, bindingId: string, rootScopeId: string, labels: string[]): { parentId: string; ops: BindingOperation[] } {
  let parentId = rootScopeId;
  const ops: BindingOperation[] = [];
  const virtualState: AppState = JSON.parse(JSON.stringify(state)) as AppState;
  for (const label of labels) {
    const existing = directChildByLabel(virtualState, parentId, label);
    if (existing) {
      parentId = existing.id;
      continue;
    }
    const nodeId = syntheticNodeId(bindingId, parentId, label);
    const payload: NodeCreatePayload = {
      nodeId,
      parentId,
      text: label,
      nodeType: "text",
      attributes: { "m3e:binding-generated": bindingId },
    };
    ops.push({ op: "node.create", payload });
    appendChildNode(virtualState, parentId, createTextNode(nodeId, parentId, label, payload.attributes || {}));
    parentId = nodeId;
  }
  return { parentId, ops };
}

function upsertEntityMemberOps(binding: BindingCopyRecord, entityLabel: string, ownerScopeId: string, ownerNodeId: string, relationScopeId: string, relationNodeId: string): BindingOperation[] {
  const entityId = entityIdForLabel(entityLabel);
  const beId = bindingEntityId(binding.bindingId, entityId);
  return [
    {
      op: "bindingEntity.upsert",
      payload: {
        bindingEntityId: beId,
        bindingId: binding.bindingId,
        entityId,
        label: entityLabel,
        status: "active",
      },
    },
    {
      op: "bindingMember.upsert",
      payload: {
        memberId: bindingMemberId(beId, ownerScopeId, ownerNodeId, "owner"),
        bindingEntityId: beId,
        scopeId: ownerScopeId,
        nodeId: ownerNodeId,
        role: "owner",
      },
    },
    {
      op: "bindingMember.upsert",
      payload: {
        memberId: bindingMemberId(beId, relationScopeId, relationNodeId, "relation"),
        bindingEntityId: beId,
        scopeId: relationScopeId,
        nodeId: relationNodeId,
        role: "relation",
      },
    },
  ];
}

export function buildMirrorRelationToOwnerPatch(ctx: BindingContext): BindingPatch {
  const { binding, state, event } = ctx;
  const targetScopeId = binding.participantScopeIds.target;
  const relationScopeId = binding.participantScopeIds.relation;
  const diagnostics: BindingDiagnostic[] = [];
  const operations: BindingOperation[] = [];

  if (!targetScopeId || !relationScopeId) {
    return {
      bindingId: binding.bindingId,
      idempotencyKey: stableId("bp", binding.bindingId, event?.eventId || "reconcile", "invalid-participants"),
      operations: [],
      diagnostics: [{ level: "error", code: "missing-participant-scope", message: "Binding copy requires target and relation participant scopes." }],
    };
  }
  if (!state.nodes[targetScopeId] || !state.nodes[relationScopeId]) {
    return {
      bindingId: binding.bindingId,
      idempotencyKey: stableId("bp", binding.bindingId, event?.eventId || "reconcile", "missing-scope"),
      operations: [],
      diagnostics: [{ level: "error", code: "missing-scope", message: "Participant scope node was not found." }],
    };
  }

  const relationNodes = event?.type === "node.created" && event.sourceNodeId
    ? [state.nodes[event.sourceNodeId]].filter((node): node is TreeNode => Boolean(node))
    : scopeDirectChildren(state, relationScopeId);

  relationNodes.forEach((relationNode) => {
    const label = nodeLabel(relationNode);
    if (!label || label === "." || label === "_") return;
    if (relationNode.nodeType === "alias") {
      diagnostics.push({ level: "warning", code: "alias-skipped", message: "Alias nodes are not binding entity owners.", nodeId: relationNode.id });
      return;
    }
    const pathResult = ensurePathOps(state, binding.bindingId, targetScopeId, ownerFallbackPath(binding));
    operations.push(...pathResult.ops);
    const ownerParentId = pathResult.parentId;
    const existingOwner = directChildByLabel(state, ownerParentId, label);
    const ownerNodeId = existingOwner?.id || syntheticNodeId(binding.bindingId, ownerParentId, label);
    if (!existingOwner) {
      operations.push({
        op: "node.create",
        payload: {
          nodeId: ownerNodeId,
          parentId: ownerParentId,
          text: label,
          nodeType: "text",
          attributes: {
            "m3e:binding-generated": binding.bindingId,
            "m3e:entity-id": entityIdForLabel(label),
          },
        },
      });
    }
    operations.push(...upsertEntityMemberOps(binding, label, targetScopeId, ownerNodeId, relationScopeId, relationNode.id));
  });

  for (const link of Object.values(state.links || {})) {
    if (!state.nodes[link.sourceNodeId] || !state.nodes[link.targetNodeId]) {
      diagnostics.push({
        level: "warning",
        code: "graphlink-missing-endpoint",
        message: `GraphLink ${link.id} has a missing endpoint.`,
      });
    }
  }

  return {
    bindingId: binding.bindingId,
    idempotencyKey: stableId("bp", binding.bindingId, event?.eventId || "reconcile", String(operations.length)),
    operations,
    diagnostics,
  };
}

export function validateBindingPatch(state: AppState, patch: BindingPatch): BindingDiagnostic[] {
  const diagnostics: BindingDiagnostic[] = [];
  const virtualNodes: Record<string, TreeNode> = {};
  const nodeExists = (nodeId: string): boolean => Boolean(state.nodes[nodeId] || virtualNodes[nodeId]);
  patch.operations.forEach((operation) => {
    if (operation.op === "node.create") {
      if (nodeExists(operation.payload.nodeId)) {
        diagnostics.push({ level: "warning", code: "node-already-exists", message: `Node already exists: ${operation.payload.nodeId}`, nodeId: operation.payload.nodeId });
      }
      if (!nodeExists(operation.payload.parentId)) {
        diagnostics.push({ level: "error", code: "missing-parent", message: `Parent node not found: ${operation.payload.parentId}` });
      }
      virtualNodes[operation.payload.nodeId] = {
        id: operation.payload.nodeId,
        parentId: operation.payload.parentId,
        children: [],
        nodeType: operation.payload.nodeType || "text",
        text: operation.payload.text,
        collapsed: false,
        details: "",
        note: "",
        attributes: operation.payload.attributes || {},
        link: "",
      };
    }
    if (operation.op === "bindingMember.upsert" && !nodeExists(operation.payload.nodeId)) {
      diagnostics.push({ level: "error", code: "missing-member-node", message: `Binding member node not found: ${operation.payload.nodeId}`, nodeId: operation.payload.nodeId });
    }
  });
  return diagnostics;
}

export function applyBindingPatchToState(state: AppState, patch: BindingPatch): AppState {
  const next: AppState = JSON.parse(JSON.stringify(state)) as AppState;
  patch.operations.forEach((operation) => {
    if (operation.op !== "node.create") return;
    const { nodeId, parentId, text, nodeType, attributes } = operation.payload;
    if (next.nodes[nodeId]) return;
    const parent = next.nodes[parentId];
    if (!parent) {
      throw new Error(`Parent node not found: ${parentId}`);
    }
    next.nodes[nodeId] = {
      id: nodeId,
      parentId,
      children: [],
      nodeType: nodeType || "text",
      text,
      collapsed: false,
      details: "",
      note: "",
      attributes: attributes || {},
      link: "",
    };
    parent.children.push(nodeId);
  });
  return next;
}

export function persistBindingRun(dbPath: string, patch: BindingPatch, options: { event?: BindingEventRecord; dryRun?: boolean } = {}): PersistedBindingRun {
  const db = openBindingDb(dbPath);
  const runId = stableId("br", patch.bindingId, options.event?.eventId || "manual", patch.idempotencyKey, nowIso());
  const startedAt = nowIso();
  try {
    const transaction = db.transaction(() => {
      if (options.event) {
        db.prepare(`
          INSERT INTO binding_event (event_id, map_id, type, source_scope_id, source_node_id, source_graph_link_id, origin_binding_id, payload, created_at)
          VALUES (@eventId, @mapId, @type, @sourceScopeId, @sourceNodeId, @sourceGraphLinkId, @originBindingId, @payload, @createdAt)
          ON CONFLICT(event_id) DO NOTHING
        `).run({
          eventId: options.event.eventId,
          mapId: options.event.mapId,
          type: options.event.type,
          sourceScopeId: options.event.sourceScopeId || null,
          sourceNodeId: options.event.sourceNodeId || null,
          sourceGraphLinkId: options.event.sourceGraphLinkId || null,
          originBindingId: options.event.originBindingId || null,
          payload: asJson(options.event.payload || {}),
          createdAt: options.event.createdAt || startedAt,
        });
      }
      db.prepare(`
        INSERT INTO binding_run (run_id, binding_id, event_id, mode, started_at, finished_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(runId, patch.bindingId, options.event?.eventId || null, options.dryRun ? "dry_run" : "apply", startedAt, nowIso(), options.dryRun ? "dry_run" : "applied");

      const insertPatch = db.prepare(`
        INSERT OR IGNORE INTO binding_patch (patch_id, run_id, operation, payload, patch_hash, idempotency_key, validation_status, apply_status)
        VALUES (@patchId, @runId, @operation, @payload, @patchHash, @idempotencyKey, @validationStatus, @applyStatus)
      `);
      const upsertEntity = db.prepare(`
        INSERT INTO binding_entity (binding_entity_id, binding_id, entity_id, label, status)
        VALUES (@bindingEntityId, @bindingId, @entityId, @label, @status)
        ON CONFLICT(binding_id, entity_id) DO UPDATE SET
          label = excluded.label,
          status = excluded.status
      `);
      const upsertMember = db.prepare(`
        INSERT INTO binding_member (member_id, binding_entity_id, scope_id, node_id, role)
        VALUES (@memberId, @bindingEntityId, @scopeId, @nodeId, @role)
        ON CONFLICT(binding_entity_id, scope_id, node_id) DO UPDATE SET
          role = excluded.role
      `);
      patch.operations.forEach((operation, index) => {
        const payload = asJson(operation.payload);
        const patchHash = `sha256:${crypto.createHash("sha256").update(`${operation.op}:${payload}`).digest("hex")}`;
        insertPatch.run({
          patchId: stableId("bp", runId, String(index), operation.op, patchHash),
          runId,
          operation: operation.op,
          payload,
          patchHash,
          idempotencyKey: patch.idempotencyKey,
          validationStatus: "valid",
          applyStatus: options.dryRun ? "dry_run" : "applied",
        });
        if (!options.dryRun && operation.op === "bindingEntity.upsert") {
          upsertEntity.run(operation.payload);
        }
        if (!options.dryRun && operation.op === "bindingMember.upsert") {
          upsertMember.run(operation.payload);
        }
      });
    });
    transaction();
  } finally {
    db.close();
  }
  return { runId, status: options.dryRun ? "dry_run" : "applied", patchCount: patch.operations.length };
}

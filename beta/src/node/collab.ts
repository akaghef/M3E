"use strict";

import http from "http";
import crypto from "crypto";
import { RapidMvpModel } from "./rapid_mvp";
import type { TreeNode } from "../shared/types";
import { recordAudit, type OperationType } from "./audit_log";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CollabRole = "owner" | "human" | "ai-supervised" | "ai" | "ai-readonly";

const ROLE_PRIORITY: Record<CollabRole, number> = {
  owner: 1000,
  human: 100,
  "ai-supervised": 50,
  ai: 10,
  "ai-readonly": 1,
};

export interface CollabEntity {
  entityId: string;
  token: string;
  displayName: string;
  role: CollabRole;
  priority: number;
  capabilities: ("read" | "write")[];
  lastHeartbeat: number; // Date.now()
}

export interface ScopeLock {
  lockId: string;
  scopeId: string;
  entityId: string;
  priority: number;
  acquiredAt: number;
  expiresAt: number;
  leaseDuration: number; // seconds
}

export interface SseClient {
  entityId: string;
  res: http.ServerResponse;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const entities = new Map<string, CollabEntity>(); // entityId -> entity
const tokenIndex = new Map<string, string>(); // token -> entityId
const scopeLocks = new Map<string, ScopeLock>(); // scopeId -> lock
const sseClients: SseClient[] = [];
let docVersion = 0;

const HEARTBEAT_TIMEOUT_MS = 30_000;
const DEFAULT_LEASE_SEC = 30;

// ---------------------------------------------------------------------------
// Entity management
// ---------------------------------------------------------------------------

export function registerEntity(
  displayName: string,
  role: CollabRole,
  capabilities: ("read" | "write")[],
): CollabEntity {
  const entityId = `e_${crypto.randomUUID()}`;
  const token = `tok_${crypto.randomUUID()}`;
  const priority = ROLE_PRIORITY[role] ?? 1;

  const entity: CollabEntity = {
    entityId,
    token,
    displayName,
    role,
    priority,
    capabilities,
    lastHeartbeat: Date.now(),
  };

  entities.set(entityId, entity);
  tokenIndex.set(token, entityId);
  broadcastSseEvent("entity_joined", {
    entityId,
    displayName,
    role,
    priority,
  });
  return entity;
}

export function unregisterEntity(entityId: string): boolean {
  const entity = entities.get(entityId);
  if (!entity) return false;

  // Release any locks held by this entity
  for (const [scopeId, lock] of scopeLocks) {
    if (lock.entityId === entityId) {
      scopeLocks.delete(scopeId);
      broadcastSseEvent("lock_released", { scopeId, entityId });
    }
  }

  tokenIndex.delete(entity.token);
  entities.delete(entityId);

  // Remove SSE connections
  for (let i = sseClients.length - 1; i >= 0; i--) {
    if (sseClients[i].entityId === entityId) {
      sseClients[i].res.end();
      sseClients.splice(i, 1);
    }
  }

  broadcastSseEvent("entity_left", { entityId });
  return true;
}

export function authenticateRequest(req: http.IncomingMessage): CollabEntity | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const entityId = tokenIndex.get(token);
  if (!entityId) return null;
  const entity = entities.get(entityId);
  if (!entity) return null;

  // Check heartbeat timeout
  if (Date.now() - entity.lastHeartbeat > HEARTBEAT_TIMEOUT_MS) {
    unregisterEntity(entityId);
    return null;
  }
  return entity;
}

export function heartbeat(entityId: string, lockIds: string[]): boolean {
  const entity = entities.get(entityId);
  if (!entity) return false;
  entity.lastHeartbeat = Date.now();

  // Extend locks
  for (const lockId of lockIds) {
    for (const lock of scopeLocks.values()) {
      if (lock.lockId === lockId && lock.entityId === entityId) {
        lock.expiresAt = Date.now() + lock.leaseDuration * 1000;
      }
    }
  }
  return true;
}

export function getActiveEntities(): CollabEntity[] {
  const now = Date.now();
  const result: CollabEntity[] = [];
  for (const entity of entities.values()) {
    if (now - entity.lastHeartbeat <= HEARTBEAT_TIMEOUT_MS) {
      result.push(entity);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Scope locking
// ---------------------------------------------------------------------------

function cleanExpiredLocks(): void {
  const now = Date.now();
  for (const [scopeId, lock] of scopeLocks) {
    if (lock.expiresAt < now) {
      scopeLocks.delete(scopeId);
      broadcastSseEvent("lock_released", { scopeId, entityId: lock.entityId });
    }
  }
}

export function acquireScopeLock(
  scopeId: string,
  entity: CollabEntity,
): { ok: true; lock: ScopeLock } | { ok: false; error: string; status: number } {
  cleanExpiredLocks();

  const existing = scopeLocks.get(scopeId);

  if (existing) {
    // Priority-based preemption
    if (entity.priority > existing.priority) {
      // Preempt
      broadcastSseEvent("lock_preempted", {
        scopeId,
        oldEntity: existing.entityId,
        newEntity: entity.entityId,
      });
    } else if (existing.entityId === entity.entityId) {
      // Refresh own lock
      existing.expiresAt = Date.now() + existing.leaseDuration * 1000;
      return { ok: true, lock: existing };
    } else {
      return {
        ok: false,
        error: `Scope locked by ${existing.entityId} (priority ${existing.priority})`,
        status: 409,
      };
    }
  }

  const lock: ScopeLock = {
    lockId: `lock_${crypto.randomUUID()}`,
    scopeId,
    entityId: entity.entityId,
    priority: entity.priority,
    acquiredAt: Date.now(),
    expiresAt: Date.now() + DEFAULT_LEASE_SEC * 1000,
    leaseDuration: DEFAULT_LEASE_SEC,
  };

  scopeLocks.set(scopeId, lock);
  broadcastSseEvent("lock_acquired", {
    scopeId,
    entityId: entity.entityId,
    priority: entity.priority,
  });
  return { ok: true, lock };
}

export function releaseScopeLock(scopeId: string, entity: CollabEntity): boolean {
  const existing = scopeLocks.get(scopeId);
  if (!existing || existing.entityId !== entity.entityId) return false;
  scopeLocks.delete(scopeId);
  broadcastSseEvent("lock_released", { scopeId, entityId: entity.entityId });
  return true;
}

export function getScopeLocks(): ScopeLock[] {
  cleanExpiredLocks();
  return Array.from(scopeLocks.values());
}

// ---------------------------------------------------------------------------
// SSE
// ---------------------------------------------------------------------------

export function addSseClient(entityId: string, res: http.ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(": connected\n\n");

  sseClients.push({ entityId, res });

  res.on("close", () => {
    const idx = sseClients.findIndex((c) => c.res === res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
}

export function broadcastSseEvent(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].res.write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

export function getDocVersion(): number {
  return docVersion;
}

export function incrementDocVersion(): number {
  return ++docVersion;
}

export function setDocVersion(v: number): void {
  docVersion = v;
}

// ---------------------------------------------------------------------------
// Scope helpers
// ---------------------------------------------------------------------------

export function findScopeRoot(nodes: Record<string, TreeNode>, nodeId: string, rootId: string): string {
  let current = nodes[nodeId];
  while (current) {
    if (current.nodeType === "folder") return current.id;
    if (current.parentId === null) return rootId;
    current = nodes[current.parentId];
  }
  return rootId;
}

export function isInScope(nodes: Record<string, TreeNode>, nodeId: string, scopeId: string, rootId: string): boolean {
  if (scopeId === rootId) return true;
  let current = nodes[nodeId];
  while (current) {
    if (current.id === scopeId) return true;
    if (current.parentId === null) return false;
    current = nodes[current.parentId];
  }
  return false;
}

// ---------------------------------------------------------------------------
// Scope push / auto-merge
// ---------------------------------------------------------------------------

export interface MergePushResult {
  ok: boolean;
  version: number;
  applied: string[];
  rejected: string[];
  conflicts: Array<{ nodeId: string; winner: string; loser: string }>;
  error?: string;
}

export function mergeScopePush(
  docId: string,
  scopeId: string,
  entity: CollabEntity,
  lockId: string,
  baseVersion: number,
  changedNodes: Record<string, TreeNode | null>,
  sqlitePath: string,
): MergePushResult {
  // Check scope lock
  const lock = scopeLocks.get(scopeId);
  if (!lock || lock.entityId !== entity.entityId || lock.lockId !== lockId) {
    return { ok: false, version: docVersion, applied: [], rejected: [], conflicts: [], error: "Scope lock not held." };
  }

  // Load current doc
  let model: RapidMvpModel;
  try {
    model = RapidMvpModel.loadFromSqlite(sqlitePath, docId);
  } catch (err) {
    return { ok: false, version: docVersion, applied: [], rejected: [], conflicts: [], error: (err as Error).message };
  }

  const nodes = model.state.nodes;
  const rootId = model.state.rootId;
  const hasVersionConflict = baseVersion !== docVersion;
  const originalNodeIds = new Set(Object.keys(nodes));

  const applied: string[] = [];
  const rejected: string[] = [];
  const conflicts: Array<{ nodeId: string; winner: string; loser: string }> = [];

  for (const [nodeId, change] of Object.entries(changedNodes)) {
    // Scope check
    if (change !== null) {
      const existingNode = nodes[nodeId];
      const checkId = existingNode ? nodeId : change.parentId ?? "";
      if (checkId && !isInScope(nodes, checkId, scopeId, rootId)) {
        rejected.push(nodeId);
        continue;
      }
    } else {
      if (nodes[nodeId] && !isInScope(nodes, nodeId, scopeId, rootId)) {
        rejected.push(nodeId);
        continue;
      }
    }

    // Version conflict → priority resolution
    if (hasVersionConflict && nodes[nodeId]) {
      if (entity.priority < lock.priority) {
        conflicts.push({ nodeId, winner: "current", loser: entity.entityId });
        rejected.push(nodeId);
        continue;
      }
    }

    // Apply
    if (change === null) {
      if (nodes[nodeId] && nodeId !== rootId) {
        const parent = nodes[nodeId].parentId;
        if (parent && nodes[parent]) {
          nodes[parent].children = nodes[parent].children.filter((c) => c !== nodeId);
        }
        const toDelete = [nodeId];
        while (toDelete.length > 0) {
          const cur = toDelete.pop()!;
          if (nodes[cur]) {
            toDelete.push(...nodes[cur].children);
            delete nodes[cur];
          }
        }
        applied.push(nodeId);
      }
    } else {
      const existingNode = nodes[nodeId];
      if (existingNode) {
        nodes[nodeId] = { ...change, id: nodeId, parentId: existingNode.parentId, children: existingNode.children };
      } else {
        nodes[nodeId] = change;
        const parentId = change.parentId;
        if (parentId && nodes[parentId] && !nodes[parentId].children.includes(nodeId)) {
          nodes[parentId].children.push(nodeId);
        }
      }
      applied.push(nodeId);
    }
  }

  if (applied.length === 0) {
    return { ok: true, version: docVersion, applied, rejected, conflicts };
  }

  // Validate full tree
  const validationModel = RapidMvpModel.fromJSON(model.state);
  const errors = validationModel.validate();
  if (errors.length > 0) {
    return { ok: false, version: docVersion, applied: [], rejected: Object.keys(changedNodes), conflicts: [], error: `Validation failed: ${errors.join(" | ")}` };
  }

  // Save + version bump
  validationModel.saveToSqlite(sqlitePath, docId);
  const newVersion = ++docVersion;

  // Audit log for each applied change
  for (const nodeId of applied) {
    const change = changedNodes[nodeId];
    let opType: OperationType;
    if (change === null) {
      opType = "delete";
    } else if (nodes[nodeId] && change.parentId !== nodes[nodeId]?.parentId) {
      opType = "move";
    } else if (!originalNodeIds.has(nodeId)) {
      opType = "add";
    } else {
      opType = "edit";
    }
    recordAudit({
      userId: entity.entityId,
      operationType: opType,
      targetNodeId: nodeId,
      details: { docId, version: newVersion, scopeId },
    });
  }

  broadcastSseEvent("state_update", { docId, version: newVersion, entityId: entity.entityId, applied, rejected, conflicts });

  return { ok: true, version: newVersion, applied, rejected, conflicts };
}

// ---------------------------------------------------------------------------
// Reset (for testing)
// ---------------------------------------------------------------------------

export function resetCollab(): void {
  entities.clear();
  tokenIndex.clear();
  scopeLocks.clear();
  sseClients.length = 0;
  docVersion = 0;
}

// ---------------------------------------------------------------------------
// Collab enabled flag
// ---------------------------------------------------------------------------

export const COLLAB_ENABLED = process.env.M3E_COLLAB === "1";

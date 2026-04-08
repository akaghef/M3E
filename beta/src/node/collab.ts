"use strict";

import http from "http";
import crypto from "crypto";

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
// Collab enabled flag
// ---------------------------------------------------------------------------

export const COLLAB_ENABLED = process.env.M3E_COLLAB === "1";

"use strict";

// ---------------------------------------------------------------------------
// Presence tracking — per-document connected user state
// ---------------------------------------------------------------------------

export interface PresenceEntry {
  entityId: string;
  displayName: string;
  role: string;
  status: "active" | "inactive";
  lastOperationAt: string;   // ISO 8601
  connectedAt: string;       // ISO 8601
}

// mapId -> entityId -> entry
const presenceMap = new Map<string, Map<string, PresenceEntry>>();

const INACTIVE_THRESHOLD_MS = 60_000; // 1 minute without activity -> inactive

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

export function touchPresence(
  mapId: string,
  entityId: string,
  displayName: string,
  role: string,
): PresenceEntry {
  let docPresence = presenceMap.get(mapId);
  if (!docPresence) {
    docPresence = new Map();
    presenceMap.set(mapId, docPresence);
  }

  const now = new Date().toISOString();
  const existing = docPresence.get(entityId);

  if (existing) {
    existing.lastOperationAt = now;
    existing.status = "active";
    existing.displayName = displayName;
    existing.role = role;
    return existing;
  }

  const entry: PresenceEntry = {
    entityId,
    displayName,
    role,
    status: "active",
    lastOperationAt: now,
    connectedAt: now,
  };
  docPresence.set(entityId, entry);
  return entry;
}

export function removePresence(mapId: string, entityId: string): boolean {
  const docPresence = presenceMap.get(mapId);
  if (!docPresence) return false;
  const deleted = docPresence.delete(entityId);
  if (docPresence.size === 0) {
    presenceMap.delete(mapId);
  }
  return deleted;
}

export function getPresenceList(mapId: string): PresenceEntry[] {
  const docPresence = presenceMap.get(mapId);
  if (!docPresence) return [];

  const now = Date.now();
  const result: PresenceEntry[] = [];

  for (const entry of docPresence.values()) {
    // Update status based on inactivity threshold
    const lastOp = new Date(entry.lastOperationAt).getTime();
    if (now - lastOp > INACTIVE_THRESHOLD_MS) {
      entry.status = "inactive";
    } else {
      entry.status = "active";
    }
    result.push({ ...entry });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Reset (for testing)
// ---------------------------------------------------------------------------

export function resetPresence(): void {
  presenceMap.clear();
}

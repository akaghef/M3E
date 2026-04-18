"use strict";

// ---------------------------------------------------------------------------
// Presence tracking — per-map connected user state
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
  let mapPresence = presenceMap.get(mapId);
  if (!mapPresence) {
    mapPresence = new Map();
    presenceMap.set(mapId, mapPresence);
  }

  const now = new Date().toISOString();
  const existing = mapPresence.get(entityId);

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
  mapPresence.set(entityId, entry);
  return entry;
}

export function removePresence(mapId: string, entityId: string): boolean {
  const mapPresence = presenceMap.get(mapId);
  if (!mapPresence) return false;
  const deleted = mapPresence.delete(entityId);
  if (mapPresence.size === 0) {
    presenceMap.delete(mapId);
  }
  return deleted;
}

export function getPresenceList(mapId: string): PresenceEntry[] {
  const mapPresence = presenceMap.get(mapId);
  if (!mapPresence) return [];

  const now = Date.now();
  const result: PresenceEntry[] = [];

  for (const entry of mapPresence.values()) {
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

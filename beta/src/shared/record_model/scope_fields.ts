// Scope band, projection and retention. Absent band reads as rapid.
// Absent retention.ms reads as 30 days. Bytes are stored and not applied (what they count is undecided).

import type { ScopeBand, ScopeProjection, ScopeRetention } from "./types";

/** 30 days. Authoritative when a scope does not set retention.ms. */
export const DEFAULT_SCOPE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function readBand(band: string | undefined): ScopeBand {
  return band === "deep" ? "deep" : "rapid";
}

/** Effective retention window. An explicit ms replaces the 30-day default; it does not change the archive floor. */
export function readRetentionMs(retention: { ms?: number } | undefined): number {
  return typeof retention?.ms === "number" && Number.isFinite(retention.ms) ? retention.ms : DEFAULT_SCOPE_RETENTION_MS;
}

/** Copies the scope fields a record stores. Omits empty dissolved and baseSeq on an observe projection. */
export function scopeFieldsOf(source: unknown): { band?: ScopeBand; projection?: ScopeProjection; retention?: ScopeRetention } {
  if (typeof source !== "object" || source === null) return {};
  const raw = source as { band?: unknown; projection?: unknown; retention?: unknown };
  const out: { band?: ScopeBand; projection?: ScopeProjection; retention?: ScopeRetention } = {};
  if (raw.band === "rapid" || raw.band === "deep") out.band = raw.band;
  const projection = normalizeProjection(raw.projection);
  if (projection) out.projection = projection;
  const retention = normalizeRetention(raw.retention);
  if (retention) out.retention = retention;
  return out;
}

function normalizeProjection(value: unknown): ScopeProjection | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const raw = value as { mode?: unknown; from?: unknown; range?: unknown; baseSeq?: unknown; dissolved?: unknown };
  if (raw.mode !== "observe" && raw.mode !== "work") return undefined;
  const from = normalizeFrom(raw.from);
  const range = normalizeRange(raw.range);
  if (!from || !range) return undefined;
  const projection: ScopeProjection = { mode: raw.mode, from, range };
  if (raw.mode === "work" && typeof raw.baseSeq === "number" && Number.isInteger(raw.baseSeq) && raw.baseSeq >= 0) {
    projection.baseSeq = raw.baseSeq;
  }
  if (Array.isArray(raw.dissolved)) {
    const dissolved = raw.dissolved.filter((item): item is { parent: string; child: string } =>
      typeof item === "object" && item !== null &&
      typeof (item as { parent?: unknown }).parent === "string" &&
      typeof (item as { child?: unknown }).child === "string");
    if (dissolved.length > 0) projection.dissolved = dissolved.map((item) => ({ parent: item.parent, child: item.child }));
  }
  return projection;
}

function normalizeFrom(value: unknown): ScopeProjection["from"] | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const raw = value as { scopeId?: unknown; relationType?: unknown };
  if (typeof raw.scopeId === "string" && raw.scopeId !== "") return { scopeId: raw.scopeId };
  if (typeof raw.relationType === "string" && raw.relationType !== "") return { relationType: raw.relationType };
  return undefined;
}

function normalizeRange(value: unknown): ScopeProjection["range"] | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const raw = value as { root?: unknown; depth?: unknown; entities?: unknown };
  if (Array.isArray(raw.entities) && raw.entities.every((item) => typeof item === "string" && item !== "")) {
    return { entities: [...raw.entities] };
  }
  if (typeof raw.root === "string" && raw.root !== "") {
    const range: { root: string; depth?: number } = { root: raw.root };
    if (typeof raw.depth === "number" && Number.isInteger(raw.depth) && raw.depth >= 0) range.depth = raw.depth;
    return range;
  }
  return undefined;
}

function normalizeRetention(value: unknown): ScopeRetention | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const raw = value as { ms?: unknown; bytes?: unknown };
  const retention: ScopeRetention = {};
  if (typeof raw.ms === "number" && Number.isFinite(raw.ms) && raw.ms >= 0) retention.ms = raw.ms;
  if (typeof raw.bytes === "number" && Number.isFinite(raw.bytes) && raw.bytes >= 0) retention.bytes = raw.bytes;
  return retention.ms !== undefined || retention.bytes !== undefined ? retention : undefined;
}

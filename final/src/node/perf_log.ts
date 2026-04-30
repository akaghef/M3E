"use strict";

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PerfLogEntry {
  ts: string;
  method: string;
  path: string;
  route: string;
  status: number;
  duration_ms: number;
  ttfb_ms: number | null;
  req_bytes: number | null;
  res_bytes: number;
  map_id: string | null;
  scope: string | null;
  client: string | null;
  sse: boolean;
  error_code: string | null;
}

// ---------------------------------------------------------------------------
// Repo root resolution
// ---------------------------------------------------------------------------

let cachedRepoRoot: string | null = null;

export function findRepoRoot(startDir?: string): string {
  if (cachedRepoRoot) return cachedRepoRoot;
  const start = startDir ?? __dirname;
  let dir = path.resolve(start);
  // Walk up until .git is found, or filesystem root.
  while (true) {
    if (fs.existsSync(path.join(dir, ".git"))) {
      cachedRepoRoot = dir;
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: process cwd.
  cachedRepoRoot = process.cwd();
  return cachedRepoRoot;
}

export function perfLogPath(): string {
  return path.join(findRepoRoot(), "logs", "api_perf.jsonl");
}

// ---------------------------------------------------------------------------
// File append (fire-and-forget, never throws to caller)
// ---------------------------------------------------------------------------

let dirEnsuredFor: string | null = null;

function ensureDir(target: string): boolean {
  if (dirEnsuredFor === target) return true;
  try {
    const dir = path.dirname(target);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    dirEnsuredFor = target;
    return true;
  } catch {
    return false;
  }
}

export function appendPerfLog(entry: PerfLogEntry): void {
  try {
    const target = perfLogPath();
    if (!ensureDir(target)) return;
    fs.appendFileSync(target, JSON.stringify(entry) + "\n");
  } catch {
    // Intentionally swallow — perf logging must never break requests.
  }
}

export function resetPerfLogForTest(overridePath?: string): void {
  dirEnsuredFor = null;
  if (overridePath) {
    cachedRepoRoot = path.dirname(path.dirname(overridePath));
  } else {
    cachedRepoRoot = null;
  }
}

// ---------------------------------------------------------------------------
// Route normalization
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_ID_RE = /^[A-Za-z0-9._-]{8,}$/;

function isIdSegment(segment: string): boolean {
  if (UUID_RE.test(segment)) return true;
  if (LONG_ID_RE.test(segment) && /[0-9]/.test(segment)) return true;
  return false;
}

const KNOWN_TOP_LEVEL = new Set([
  "api",
  "maps",
  "collab",
  "ai",
  "flash",
  "vault",
  "blueprint",
  "sync",
  "backup",
  "linear-transform",
]);

const MAP_SUBROUTES = new Set([
  "audit",
  "presence",
  "resolve",
  "watch",
  "links",
  "pin",
  "rename",
  "duplicate",
  "archive",
  "restore",
  "tags",
  "bind-vault",
  "unbind-vault",
  "new",
  "import-file",
  "import-vault",
  "bulk",
]);

export function normalizeRoute(method: string, pathname: string): string {
  if (!pathname.startsWith("/api/")) {
    return "/static";
  }
  const parts = pathname.split("/").filter((s) => s.length > 0);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i];
    const prev = parts[i - 1];
    if (i === 1 && seg === "maps") {
      out.push(seg);
      continue;
    }
    if (prev === "maps" && !MAP_SUBROUTES.has(seg)) {
      out.push(":id");
      continue;
    }
    if (i >= 2 && isIdSegment(seg) && !KNOWN_TOP_LEVEL.has(seg) && !MAP_SUBROUTES.has(seg)) {
      out.push(":id");
      continue;
    }
    out.push(seg);
  }
  return "/" + out.join("/");
}

// ---------------------------------------------------------------------------
// Helpers: extract map_id, detect SSE, build client tag
// ---------------------------------------------------------------------------

export function extractMapId(pathname: string): string | null {
  const match = pathname.match(/^\/api\/maps\/([^/]+)(\/|$)/);
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  if (MAP_SUBROUTES.has(id)) return null;
  return id;
}

const SSE_ROUTES = new Set([
  "/api/maps/:id/watch",
  "/api/vault/watch",
  "/api/collab/events",
]);

export function isSseRoute(route: string): boolean {
  return SSE_ROUTES.has(route);
}

export function buildClientTag(headers: Record<string, string | string[] | undefined>): string | null {
  const pick = (v: string | string[] | undefined): string | null => {
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
  };
  const xClient = pick(headers["x-client-id"]);
  if (xClient) return xClient.slice(0, 64);
  const ua = pick(headers["user-agent"]);
  if (ua) return ua.slice(0, 64);
  return null;
}

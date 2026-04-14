"use strict";

import "dotenv/config";
import fs from "fs";
import path from "path";
import http from "http";
import { spawnSync, exec } from "child_process";
import { RapidMvpModel } from "./rapid_mvp";
import { loadCloudSyncConfig, pushWithConflictBackup, startAutoSync, type AutoSyncHandle } from "./cloud_sync";
import type { CloudSyncTransport } from "../shared/types";
import { createBackup, pruneOldBackups, startAutoBackup } from "./backup";
import {
  createConflictBackup,
  listConflictBackups,
  getConflictBackup,
  deleteConflictBackup,
} from "./conflict_backup";
import { getAiStatus, runAiSubagent } from "./ai_subagent";
import { getLinearTransformStatus, runLinearTransform } from "./linear_agent";
import {
  COLLAB_ENABLED,
  registerEntity,
  unregisterEntity,
  authenticateRequest,
  heartbeat,
  getActiveEntities,
  acquireScopeLock,
  releaseScopeLock,
  addSseClient,
  broadcastSseEvent,
  incrementDocVersion,
  getDocVersion,
  mergeScopePush,
  resetCollab,
  setDocVersion,
  type CollabRole,
} from "./collab";
import { initAuditFile, recordAudit, getRecentAuditEntries } from "./audit_log";
import { getPresenceList, touchPresence, removePresence } from "./presence";
import {
  ingestSingle,
  ingestBatch,
  listDrafts,
  getDraft,
  deleteDraft,
  approveDraft,
} from "./flash_ingest";
import type {
  AiSubagentRequest,
  AppState,
  LinearTransformRequest,
  SavedDoc,
  FlashIngestRequest,
  FlashIngestBatchRequest,
  FlashApproveRequest,
  FlashDraftStatus,
  LinkDirection,
  LinkStyle,
} from "../shared/types";
import type {
  DocErrorCode,
  DocSummary,
} from "../shared/home_types";

// After compilation, this file lives at dist/node/start_viewer.js.
// ROOT must point two levels up to the mvp/ directory.
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.M3E_PORT || "4173");
const DEFAULT_PAGE = "viewer.html";
const DATA_DIR = process.env.M3E_DATA_DIR ?? path.join(ROOT, "data");
const DEFAULT_DB_FILE = "data.sqlite";
const DB_FILE = process.env.M3E_DB_FILE || DEFAULT_DB_FILE;
const SQLITE_DB_PATH = path.join(DATA_DIR, DB_FILE);
const FIRST_RUN_MARKER = path.join(DATA_DIR, ".m3e-launched");
const DEFAULT_DOC_ID = process.env.M3E_DOC_ID || "akaghef-beta";
const WORKSPACE_ID = process.env.M3E_WORKSPACE_ID || "sandbox";

// Startup diagnostics — log resolved data paths so misconfigurations are visible
console.log(`[M3E] DATA_DIR = ${DATA_DIR}${process.env.M3E_DATA_DIR ? " (from M3E_DATA_DIR env)" : " (default)"}`);
console.log(`[M3E] DB_FILE  = ${SQLITE_DB_PATH}`);
const TUTORIAL_SCOPE_ID = "n_1775650869381_rns0cp";
const cloudSyncConfig = loadCloudSyncConfig();
const CLOUD_SYNC_ENABLED = cloudSyncConfig.enabled;
let cloudTransport: CloudSyncTransport | null = cloudSyncConfig.transport;
let autoSyncHandle: AutoSyncHandle | null = null;

// ---------------------------------------------------------------------------
// Doc-watch SSE (standalone, independent of collab SSE)
// ---------------------------------------------------------------------------

interface DocWatchClient {
  docId: string;
  res: http.ServerResponse;
}

const docWatchClients: DocWatchClient[] = [];

function addDocWatchClient(docId: string, res: http.ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(": connected\n\n");
  docWatchClients.push({ docId, res });
  res.on("close", () => {
    const idx = docWatchClients.findIndex((c) => c.res === res);
    if (idx !== -1) docWatchClients.splice(idx, 1);
  });
}

function broadcastDocUpdate(docId: string, savedAt: string, sourceTabId: string | null): void {
  const payload = JSON.stringify({ docId, savedAt, sourceTabId });
  const frame = `event: doc_updated\ndata: ${payload}\n\n`;
  for (let i = docWatchClients.length - 1; i >= 0; i--) {
    if (docWatchClients[i].docId === docId) {
      try {
        docWatchClients[i].res.write(frame);
      } catch {
        docWatchClients.splice(i, 1);
      }
    }
  }
}

function parseDocWatchRoute(urlPath: string): string | null {
  const pathname = new URL(urlPath, "http://localhost").pathname;
  const match = pathname.match(/^\/api\/docs\/([^/]+)\/watch$/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

function parseDocAuditRoute(urlPath: string): string | null {
  const pathname = new URL(urlPath, "http://localhost").pathname;
  const match = pathname.match(/^\/api\/docs\/([^/]+)\/audit$/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

function parseDocPresenceRoute(urlPath: string): string | null {
  const pathname = new URL(urlPath, "http://localhost").pathname;
  const match = pathname.match(/^\/api\/docs\/([^/]+)\/presence$/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

const MIME_BY_EXT: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mm": "application/xml; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function mimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function safeResolve(urlPath: string): string | null {
  const pathname = new URL(urlPath, "http://localhost").pathname;
  const clean = decodeURIComponent(pathname).replace(/^\/+/, "");
  const rel = clean === "" ? DEFAULT_PAGE : clean;
  const abs = path.resolve(ROOT, rel);

  const relative = path.relative(ROOT, abs);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  return abs;
}

function runSampleGeneration(): void {
  // Spawn the compiled rapid_mvp.js in the dist/node/ sibling directory.
  const rapidPath = path.join(ROOT, "dist", "node", "rapid_mvp.js");
  const run = spawnSync(process.execPath, [rapidPath], {
    cwd: ROOT,
    stdio: "inherit",
  });

  if (run.status !== 0) {
    process.exit(run.status ?? 1);
  }
}

function sendFile(res: http.ServerResponse, target: string): void {
  fs.stat(target, (statErr, stats) => {
    if (statErr || !stats.isFile()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    res.setHeader("Content-Type", mimeType(target));
    fs.createReadStream(target).pipe(res);
  });
}

function openBrowser(url: string): void {
  // Open default browser on Windows.
  exec(`start "" "${url}"`);
}

function sendJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function sendSyncError(
  res: http.ServerResponse,
  statusCode: number,
  code: string,
  message: string,
  documentId: string,
  extra: Record<string, unknown> = {},
): void {
  sendJson(res, statusCode, {
    ok: false,
    code,
    error: message,
    documentId,
    ...extra,
  });
}

function parseDocId(urlPath: string): string | null {
  const pathname = new URL(urlPath, "http://localhost").pathname;
  if (!pathname.startsWith("/api/docs/")) {
    return null;
  }
  const raw = pathname.slice("/api/docs/".length).trim();
  if (!raw || raw.includes("/")) {
    return "";
  }
  return decodeURIComponent(raw);
}

type HomeRouteAction =
  | { kind: "list" }
  | { kind: "new" }
  | { kind: "duplicate"; docId: string }
  | { kind: "rename"; docId: string }
  | { kind: "archive"; docId: string }
  | { kind: "restore"; docId: string }
  | { kind: "tags"; docId: string }
  | { kind: "delete"; docId: string };

function parseHomeRoute(urlPath: string, method: string): HomeRouteAction | null {
  const pathname = new URL(urlPath, "http://localhost").pathname;

  if (pathname === "/api/docs" && method === "GET") {
    return { kind: "list" };
  }
  if (pathname === "/api/docs/new" && method === "POST") {
    return { kind: "new" };
  }

  const subMatch = pathname.match(/^\/api\/docs\/([^/]+)\/(duplicate|rename|archive|restore|tags)$/);
  if (subMatch && method === "POST") {
    const id = decodeURIComponent(subMatch[1]);
    const action = subMatch[2] as "duplicate" | "rename" | "archive" | "restore" | "tags";
    return { kind: action, docId: id };
  }

  // DELETE /api/docs/:id  (single segment, no sub-path)
  const idMatch = pathname.match(/^\/api\/docs\/([^/]+)$/);
  if (idMatch && method === "DELETE") {
    return { kind: "delete", docId: decodeURIComponent(idMatch[1]) };
  }

  return null;
}

function sendHomeError(
  res: http.ServerResponse,
  status: number,
  code: DocErrorCode | string,
  message: string,
  details?: unknown,
): void {
  const payload: { ok: false; error: { code: string; message: string; details?: unknown } } = {
    ok: false,
    error: { code, message },
  };
  if (details !== undefined) payload.error.details = details;
  sendJson(res, status, payload);
}

function newDocId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function handleHomeApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  route: HomeRouteAction,
): Promise<boolean> {
  try {
    if (route.kind === "list") {
      const url = new URL(req.url ?? "/", "http://localhost");
      const includeArchived = url.searchParams.get("includeArchived") === "true";
      const docs = RapidMvpModel.listDocuments(SQLITE_DB_PATH, { includeArchived }) as DocSummary[];
      sendJson(res, 200, { docs });
      return true;
    }

    if (route.kind === "new") {
      let label: string | undefined;
      try {
        const raw = await readRequestBody(req);
        if (raw.trim().length > 0) {
          const parsed = JSON.parse(raw) as { label?: unknown };
          if (parsed && typeof parsed.label === "string") {
            label = parsed.label.trim();
          }
        }
      } catch (err) {
        if (err instanceof SyntaxError) {
          sendHomeError(res, 400, "INVALID_BODY", "Invalid JSON body.");
          return true;
        }
        throw err;
      }
      if (label !== undefined && label.length === 0) {
        sendHomeError(res, 400, "INVALID_LABEL", "Label cannot be empty.");
        return true;
      }
      const id = newDocId();
      RapidMvpModel.createDocument(SQLITE_DB_PATH, id, label && label.length > 0 ? label : "Untitled");
      sendJson(res, 200, { ok: true, id });
      return true;
    }

    if (route.kind === "duplicate") {
      if (!RapidMvpModel.documentExists(SQLITE_DB_PATH, route.docId)) {
        sendHomeError(res, 404, "DOC_NOT_FOUND", `Document not found: ${route.docId}`);
        return true;
      }
      const newId = newDocId();
      RapidMvpModel.duplicateDocument(SQLITE_DB_PATH, route.docId, newId);
      sendJson(res, 200, { ok: true, id: newId });
      return true;
    }

    if (route.kind === "rename") {
      let label: string;
      try {
        const raw = await readRequestBody(req);
        const parsed = JSON.parse(raw) as { label?: unknown };
        if (!parsed || typeof parsed.label !== "string") {
          sendHomeError(res, 400, "INVALID_LABEL", "label (string) is required.");
          return true;
        }
        label = parsed.label;
      } catch (err) {
        if (err instanceof SyntaxError) {
          sendHomeError(res, 400, "INVALID_BODY", "Invalid JSON body.");
          return true;
        }
        throw err;
      }
      if (label.trim().length === 0) {
        sendHomeError(res, 400, "INVALID_LABEL", "Label cannot be empty.");
        return true;
      }
      try {
        RapidMvpModel.renameDocument(SQLITE_DB_PATH, route.docId, label);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === "Document not found.") {
          sendHomeError(res, 404, "DOC_NOT_FOUND", `Document not found: ${route.docId}`);
          return true;
        }
        throw err;
      }
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (route.kind === "archive" || route.kind === "restore") {
      try {
        RapidMvpModel.setArchived(SQLITE_DB_PATH, route.docId, route.kind === "archive");
      } catch (err) {
        if ((err as Error).message === "Document not found.") {
          sendHomeError(res, 404, "DOC_NOT_FOUND", `Document not found: ${route.docId}`);
          return true;
        }
        throw err;
      }
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (route.kind === "tags") {
      let tags: string[];
      try {
        const raw = await readRequestBody(req);
        const parsed = JSON.parse(raw) as { tags?: unknown };
        if (!parsed || !Array.isArray(parsed.tags) || !parsed.tags.every((t) => typeof t === "string")) {
          sendHomeError(res, 400, "INVALID_TAGS", "tags must be a string[].");
          return true;
        }
        tags = parsed.tags as string[];
      } catch (err) {
        if (err instanceof SyntaxError) {
          sendHomeError(res, 400, "INVALID_BODY", "Invalid JSON body.");
          return true;
        }
        throw err;
      }
      try {
        RapidMvpModel.setDocumentTags(SQLITE_DB_PATH, route.docId, tags);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === "Document not found.") {
          sendHomeError(res, 404, "DOC_NOT_FOUND", `Document not found: ${route.docId}`);
          return true;
        }
        if (msg === "Invalid tags.") {
          sendHomeError(res, 400, "INVALID_TAGS", msg);
          return true;
        }
        throw err;
      }
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (route.kind === "delete") {
      try {
        RapidMvpModel.deleteDocument(SQLITE_DB_PATH, route.docId);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === "Document not found.") {
          sendHomeError(res, 404, "DOC_NOT_FOUND", `Document not found: ${route.docId}`);
          return true;
        }
        if (msg === "Document is not archived.") {
          sendHomeError(res, 409, "NOT_ARCHIVED", "Document must be archived before delete. Call /archive first.");
          return true;
        }
        throw err;
      }
      sendJson(res, 200, { ok: true });
      return true;
    }

    sendHomeError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    return true;
  } catch (err) {
    sendHomeError(res, 500, "INTERNAL_ERROR", (err as Error).message || "Unknown error.");
    return true;
  }
}

function parseSyncRoute(urlPath: string): { action: "status" | "push" | "pull"; docId: string } | null {
  const pathname = new URL(urlPath, "http://localhost").pathname;
  const match = pathname.match(/^\/api\/sync\/(status|push|pull)\/([^/]+)$/);
  if (!match) {
    return null;
  }
  return {
    action: match[1] as "status" | "push" | "pull",
    docId: decodeURIComponent(match[2] || ""),
  };
}

function parseBackupRoute(urlPath: string): { docId: string; backupId?: string; action?: "restore" } | null {
  const pathname = new URL(urlPath, "http://localhost").pathname;
  // /api/sync/backups/{docId}/restore/{backupId}
  const restoreMatch = pathname.match(/^\/api\/sync\/backups\/([^/]+)\/restore\/([^/]+)$/);
  if (restoreMatch) {
    return { docId: decodeURIComponent(restoreMatch[1]), backupId: decodeURIComponent(restoreMatch[2]), action: "restore" };
  }
  // /api/sync/backups/{docId}/{backupId}
  const singleMatch = pathname.match(/^\/api\/sync\/backups\/([^/]+)\/([^/]+)$/);
  if (singleMatch) {
    return { docId: decodeURIComponent(singleMatch[1]), backupId: decodeURIComponent(singleMatch[2]) };
  }
  // /api/sync/backups/{docId}
  const listMatch = pathname.match(/^\/api\/sync\/backups\/([^/]+)$/);
  if (listMatch) {
    return { docId: decodeURIComponent(listMatch[1]) };
  }
  return null;
}

async function handleBackupApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  route: { docId: string; backupId?: string; action?: "restore" },
): Promise<void> {
  // Restore endpoint
  if (route.action === "restore" && route.backupId) {
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "Method not allowed." });
      return;
    }
    const backup = getConflictBackup(DATA_DIR, route.docId, route.backupId);
    if (!backup) {
      sendJson(res, 404, { ok: false, error: "Backup not found." });
      return;
    }
    // Save the backup state to SQLite
    const model = RapidMvpModel.fromJSON(backup.state as never);
    const errors = model.validate();
    if (errors.length > 0) {
      sendJson(res, 400, { ok: false, error: `Invalid backup state: ${errors.join(" | ")}` });
      return;
    }
    model.saveToSqlite(SQLITE_DB_PATH, route.docId);
    const savedAt = new Date().toISOString();
    sendJson(res, 200, { ok: true, restored: true, backupId: route.backupId, documentId: route.docId, savedAt });
    return;
  }

  // Single backup get/delete
  if (route.backupId) {
    if (req.method === "GET") {
      const backup = getConflictBackup(DATA_DIR, route.docId, route.backupId);
      if (!backup) {
        sendJson(res, 404, { ok: false, error: "Backup not found." });
        return;
      }
      sendJson(res, 200, { ok: true, backup });
      return;
    }
    if (req.method === "DELETE") {
      const deleted = deleteConflictBackup(DATA_DIR, route.docId, route.backupId);
      sendJson(res, deleted ? 200 : 404, { ok: deleted, deleted, ...(deleted ? {} : { error: "Backup not found." }) });
      return;
    }
    sendJson(res, 405, { ok: false, error: "Method not allowed." });
    return;
  }

  // List backups
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed." });
    return;
  }
  const backups = listConflictBackups(DATA_DIR, route.docId);
  sendJson(res, 200, { ok: true, documentId: route.docId, backups });
}

// ---------------------------------------------------------------------------
// Linear-note-box API (per-scope text editor backing store)
// ---------------------------------------------------------------------------

function parseLinearNoteRoute(urlPath: string): { docId: string; scopeId: string } | null {
  const pathname = new URL(urlPath, "http://localhost").pathname;
  const match = pathname.match(/^\/api\/docs\/([^/]+)\/linear\/([^/]+)$/);
  if (!match) return null;
  return {
    docId: decodeURIComponent(match[1]),
    scopeId: decodeURIComponent(match[2]),
  };
}

async function handleLinearNoteApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  route: { docId: string; scopeId: string },
): Promise<void> {
  const { docId, scopeId } = route;
  if (!docId || !scopeId) {
    sendJson(res, 400, { ok: false, error: "Document id and scope id are required." });
    return;
  }

  let model: RapidMvpModel;
  try {
    model = RapidMvpModel.loadFromSqlite(SQLITE_DB_PATH, docId);
  } catch (err) {
    const message = (err as Error).message || "Unknown error";
    if (message === "Document not found.") {
      sendJson(res, 404, { ok: false, error: message });
    } else {
      sendJson(res, 500, { ok: false, error: message });
    }
    return;
  }

  const state = model.toJSON();
  // Validate scopeId is an existing nodeId.
  if (!state.nodes || !state.nodes[scopeId]) {
    sendJson(res, 404, { ok: false, error: `Scope node not found: ${scopeId}` });
    return;
  }

  if (req.method === "GET") {
    const map = state.linearNotesByScope ?? {};
    const text = typeof map[scopeId] === "string" ? map[scopeId] : "";
    sendJson(res, 200, { ok: true, scopeId, text });
    return;
  }

  if (req.method === "PUT") {
    let text: string;
    try {
      const rawBody = await readRequestBody(req);
      const parsed = JSON.parse(rawBody) as { text?: unknown };
      if (typeof parsed.text !== "string") {
        sendJson(res, 400, { ok: false, error: "Field 'text' (string) is required." });
        return;
      }
      text = parsed.text;
    } catch (err) {
      if (err instanceof SyntaxError) {
        sendJson(res, 400, { ok: false, error: "Invalid JSON body." });
        return;
      }
      sendJson(res, 400, { ok: false, error: (err as Error).message || "Invalid body." });
      return;
    }

    // Mutate in place: lazy-init the map, write the entry, persist.
    const nextState: AppState = { ...state };
    const nextMap: Record<string, string> = { ...(nextState.linearNotesByScope ?? {}) };
    nextMap[scopeId] = text;
    nextState.linearNotesByScope = nextMap;

    const nextModel = RapidMvpModel.fromJSON(nextState);
    const errors = nextModel.validate();
    if (errors.length > 0) {
      sendJson(res, 400, { ok: false, error: `Invalid model before save: ${errors.join(" | ")}` });
      return;
    }
    nextModel.saveToSqlite(SQLITE_DB_PATH, docId);
    const savedAt = new Date().toISOString();
    const sourceTabId = (req.headers["x-m3e-tab-id"] as string) || null;
    incrementDocVersion();
    broadcastDocUpdate(docId, savedAt, sourceTabId);
    sendJson(res, 200, { ok: true, scopeId, savedAt });
    return;
  }

  if (req.method === "DELETE") {
    const nextState: AppState = { ...state };
    const currentMap = nextState.linearNotesByScope ?? {};
    if (!(scopeId in currentMap)) {
      // Idempotent: still report ok with savedAt of now but note unchanged.
      sendJson(res, 200, { ok: true, scopeId, savedAt: new Date().toISOString(), removed: false });
      return;
    }
    const nextMap: Record<string, string> = { ...currentMap };
    delete nextMap[scopeId];
    nextState.linearNotesByScope = nextMap;

    const nextModel = RapidMvpModel.fromJSON(nextState);
    const errors = nextModel.validate();
    if (errors.length > 0) {
      sendJson(res, 400, { ok: false, error: `Invalid model before save: ${errors.join(" | ")}` });
      return;
    }
    nextModel.saveToSqlite(SQLITE_DB_PATH, docId);
    const savedAt = new Date().toISOString();
    const sourceTabId = (req.headers["x-m3e-tab-id"] as string) || null;
    incrementDocVersion();
    broadcastDocUpdate(docId, savedAt, sourceTabId);
    sendJson(res, 200, { ok: true, scopeId, savedAt, removed: true });
    return;
  }

  sendJson(res, 405, { ok: false, error: "Method not allowed." });
}

function isLinearTransformRoute(urlPath: string): boolean {
  const pathname = new URL(urlPath, "http://localhost").pathname;
  return pathname === "/api/linear-transform/status" || pathname === "/api/linear-transform/convert";
}

function parseAiSubagentRoute(urlPath: string): { subagent: string } | null {
  const pathname = new URL(urlPath, "http://localhost").pathname;
  const match = pathname.match(/^\/api\/ai\/subagent\/([^/]+)$/);
  if (!match) {
    return null;
  }
  return {
    subagent: decodeURIComponent(match[1] || ""),
  };
}

function isAiStatusRoute(urlPath: string): boolean {
  const pathname = new URL(urlPath, "http://localhost").pathname;
  return pathname === "/api/ai/status";
}

// ---------------------------------------------------------------------------
// Flash API route parsing
// ---------------------------------------------------------------------------

type FlashRoute =
  | { action: "ingest" }
  | { action: "drafts" }
  | { action: "draft"; draftId: string }
  | { action: "approve"; draftId: string }
  | { action: "delete"; draftId: string }
  | null;

function parseFlashRoute(urlPath: string, method: string): FlashRoute {
  const pathname = new URL(urlPath, "http://localhost").pathname;
  if (!pathname.startsWith("/api/flash/")) return null;

  if (pathname === "/api/flash/ingest" && method === "POST") {
    return { action: "ingest" };
  }

  if (pathname === "/api/flash/drafts" && method === "GET") {
    return { action: "drafts" };
  }

  const draftMatch = pathname.match(/^\/api\/flash\/draft\/([^/]+)$/);
  if (draftMatch) {
    const draftId = decodeURIComponent(draftMatch[1]);
    if (method === "GET") return { action: "draft", draftId };
    if (method === "DELETE") return { action: "delete", draftId };
  }

  const approveMatch = pathname.match(/^\/api\/flash\/draft\/([^/]+)\/approve$/);
  if (approveMatch && method === "POST") {
    return { action: "approve", draftId: decodeURIComponent(approveMatch[1]) };
  }

  return null;
}

async function handleFlashApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  route: Exclude<FlashRoute, null>,
): Promise<void> {
  try {
    switch (route.action) {
      case "ingest": {
        const rawBody = await readRequestBody(req);
        const parsed = JSON.parse(rawBody);

        // Support batch: { items: [...] }
        if (parsed && Array.isArray(parsed.items)) {
          const results = ingestBatch(parsed.items as FlashIngestRequest[]);
          sendJson(res, 202, {
            ok: true,
            drafts: results.map((d) => ({
              draftId: d.id,
              status: d.status,
              title: d.title,
              nodeCount: d.structured.nodes.length,
            })),
            message: `${results.length} draft(s) created.`,
          });
          return;
        }

        // Single ingest
        const request = parsed as FlashIngestRequest;
        const draft = ingestSingle(request);
        sendJson(res, 202, {
          ok: true,
          draftId: draft.id,
          status: draft.status,
          title: draft.title,
          nodeCount: draft.structured.nodes.length,
          message: "Draft created.",
        });
        return;
      }

      case "drafts": {
        const url = new URL(req.url ?? "/", "http://localhost");
        const docId = url.searchParams.get("docId") ?? undefined;
        const status = url.searchParams.get("status") as FlashDraftStatus | undefined;
        const results = listDrafts({ docId, status: status || undefined });
        sendJson(res, 200, {
          ok: true,
          drafts: results.map((d) => ({
            id: d.id,
            docId: d.docId,
            sourceType: d.sourceType,
            sourceRef: d.sourceRef,
            title: d.title,
            nodeCount: d.structured.nodes.length,
            status: d.status,
            createdAt: d.createdAt,
          })),
        });
        return;
      }

      case "draft": {
        const draft = getDraft(route.draftId);
        if (!draft) {
          sendJson(res, 404, { ok: false, error: `Draft not found: ${route.draftId}` });
          return;
        }
        sendJson(res, 200, { ok: true, draft });
        return;
      }

      case "approve": {
        const rawBody = await readRequestBody(req);
        const request = JSON.parse(rawBody) as FlashApproveRequest;
        const draft = getDraft(route.draftId);
        if (!draft) {
          sendJson(res, 404, { ok: false, error: `Draft not found: ${route.draftId}` });
          return;
        }

        // Load model to commit nodes
        const model = RapidMvpModel.loadFromSqlite(SQLITE_DB_PATH, draft.docId);
        const result = approveDraft(route.draftId, request, model);

        // Save updated model
        model.saveToSqlite(SQLITE_DB_PATH, draft.docId);

        sendJson(res, 200, {
          ok: true,
          committedNodeIds: result.committedNodeIds,
          parentId: result.parentId,
          message: `${result.committedNodeIds.length} nodes committed to ${draft.docId}`,
        });
        return;
      }

      case "delete": {
        const deleted = deleteDraft(route.draftId);
        if (!deleted) {
          sendJson(res, 404, { ok: false, error: `Draft not found: ${route.draftId}` });
          return;
        }
        sendJson(res, 200, { ok: true, message: `Draft ${route.draftId} deleted` });
        return;
      }
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      sendJson(res, 400, { ok: false, error: "Invalid JSON body." });
      return;
    }
    const message = (err as Error).message || "Flash API error.";
    sendJson(res, 400, { ok: false, error: message });
  }
}

// Cloud sync helpers removed — now handled by CloudSyncTransport implementations

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", (err) => {
      reject(err);
    });
  });
}

type LinkRouteAction =
  | { kind: "create"; docId: string }
  | { kind: "delete"; docId: string; linkId: string };

function parseLinkRoute(urlPath: string, method: string): LinkRouteAction | null {
  const pathname = new URL(urlPath, "http://localhost").pathname;
  const createMatch = pathname.match(/^\/api\/docs\/([^/]+)\/links\/?$/);
  if (createMatch && method === "POST") {
    return { kind: "create", docId: decodeURIComponent(createMatch[1]) };
  }
  const deleteMatch = pathname.match(/^\/api\/docs\/([^/]+)\/links\/([^/]+)\/?$/);
  if (deleteMatch && method === "DELETE") {
    return {
      kind: "delete",
      docId: decodeURIComponent(deleteMatch[1]),
      linkId: decodeURIComponent(deleteMatch[2]),
    };
  }
  return null;
}

async function handleLinkApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  route: LinkRouteAction,
): Promise<void> {
  if (!route.docId) {
    sendJson(res, 400, { ok: false, error: "Document id is required." });
    return;
  }

  let model: RapidMvpModel;
  try {
    model = RapidMvpModel.loadFromSqlite(SQLITE_DB_PATH, route.docId);
  } catch (err) {
    const message = (err as Error).message || "Unknown error";
    if (message === "Document not found.") {
      sendJson(res, 404, { ok: false, error: message });
    } else {
      sendJson(res, 500, { ok: false, error: message });
    }
    return;
  }

  try {
    if (route.kind === "create") {
      let body: {
        sourceNodeId?: unknown;
        targetNodeId?: unknown;
        relationType?: unknown;
        label?: unknown;
        direction?: unknown;
        style?: unknown;
      };
      try {
        const raw = await readRequestBody(req);
        body = raw.trim().length > 0 ? JSON.parse(raw) : {};
      } catch (err) {
        if (err instanceof SyntaxError) {
          sendJson(res, 400, { ok: false, error: "Invalid JSON body." });
          return;
        }
        throw err;
      }
      if (typeof body.sourceNodeId !== "string" || typeof body.targetNodeId !== "string") {
        sendJson(res, 400, { ok: false, error: "sourceNodeId and targetNodeId are required strings." });
        return;
      }
      const options: {
        relationType?: string;
        label?: string;
        direction?: LinkDirection;
        style?: LinkStyle;
      } = {};
      if (typeof body.relationType === "string") options.relationType = body.relationType;
      if (typeof body.label === "string") options.label = body.label;
      if (typeof body.direction === "string") options.direction = body.direction as LinkDirection;
      if (typeof body.style === "string") options.style = body.style as LinkStyle;

      let linkId: string;
      try {
        linkId = model.addLink(body.sourceNodeId, body.targetNodeId, options);
      } catch (err) {
        sendJson(res, 400, { ok: false, error: (err as Error).message });
        return;
      }
      model.saveToSqlite(SQLITE_DB_PATH, route.docId);
      const savedAt = new Date().toISOString();
      const sourceTabId = (req.headers["x-m3e-tab-id"] as string) || null;
      broadcastDocUpdate(route.docId, savedAt, sourceTabId);
      const link = model.state.links?.[linkId];
      sendJson(res, 200, { ok: true, link });
      return;
    }

    if (route.kind === "delete") {
      try {
        model.removeLink(route.linkId);
      } catch (err) {
        const message = (err as Error).message || "Unknown error";
        if (message.startsWith("Link not found")) {
          sendJson(res, 404, { ok: false, error: message });
          return;
        }
        sendJson(res, 400, { ok: false, error: message });
        return;
      }
      model.saveToSqlite(SQLITE_DB_PATH, route.docId);
      const savedAt = new Date().toISOString();
      const sourceTabId = (req.headers["x-m3e-tab-id"] as string) || null;
      broadcastDocUpdate(route.docId, savedAt, sourceTabId);
      sendJson(res, 200, { ok: true });
      return;
    }
  } catch (err) {
    sendJson(res, 500, { ok: false, error: (err as Error).message || "Unknown error." });
  }
}

async function handleApi(req: http.IncomingMessage, res: http.ServerResponse, docId: string): Promise<boolean> {
  if (!docId) {
    sendJson(res, 400, { error: "Document id is required." });
    return true;
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  const scopeParam = url.searchParams.get("scope");
  const depthParam = url.searchParams.get("depth");

  if (req.method === "GET") {
    try {
      if (scopeParam && scopeParam.trim().length > 0) {
        const scopeId = scopeParam.trim();
        let depth: number | undefined;
        if (depthParam !== null) {
          const n = Number(depthParam);
          if (!Number.isFinite(n) || n < 0) {
            sendJson(res, 400, {
              ok: false,
              error: { code: "SCOPE_INVALID", message: `Invalid depth parameter: ${depthParam}` },
            });
            return true;
          }
          depth = Math.floor(n);
        }
        const result = RapidMvpModel.readScopedState(SQLITE_DB_PATH, docId, scopeId, depth);
        if (!result.ok) {
          sendJson(res, 404, { ok: false, error: result.error });
          return true;
        }
        sendJson(res, 200, {
          version: result.doc.version,
          savedAt: result.doc.savedAt,
          state: result.doc.state,
          scope: {
            rootId: scopeId,
            depth: depth === undefined ? null : depth,
            nodeCount: result.nodeCount,
          },
        });
        return true;
      }
      const model = RapidMvpModel.loadFromSqlite(SQLITE_DB_PATH, docId);
      sendJson(res, 200, {
        version: 1,
        savedAt: new Date().toISOString(),
        state: model.toJSON(),
      });
    } catch (err) {
      const message = (err as Error).message || "Unknown error";
      if (message === "Document not found.") {
        sendJson(res, 404, { error: message });
      } else if (message === "Unsupported or invalid save format." || message.startsWith("Invalid model after load:")) {
        sendJson(res, 400, { error: message });
      } else {
        sendJson(res, 500, { error: message });
      }
    }
    return true;
  }

  if (req.method === "POST") {
    try {
      const rawBody = await readRequestBody(req);
      const parsed = JSON.parse(rawBody) as { state?: unknown };
      const candidate = parsed && parsed.state ? parsed : { state: parsed };
      if (!candidate.state || typeof candidate.state !== "object") {
        sendJson(res, 400, { error: "Invalid JSON format." });
        return true;
      }
      if (!(candidate.state as Record<string, unknown>).nodes) {
        sendJson(res, 400, { error: "Missing required field: nodes." });
        return true;
      }
      const nodesObj = (candidate.state as Record<string, unknown>).nodes;
      if (typeof nodesObj === "object" && nodesObj !== null && Object.keys(nodesObj).length === 0) {
        sendJson(res, 400, { error: "State contains no nodes — refusing to save empty document." });
        return true;
      }

      // Scoped write: only replace the subtree rooted at scope.
      if (scopeParam && scopeParam.trim().length > 0) {
        const scopeId = scopeParam.trim();
        const result = RapidMvpModel.writeScopedState(
          SQLITE_DB_PATH,
          docId,
          scopeId,
          candidate.state as never,
        );
        if (!result.ok) {
          const status = result.error.code === "SCOPE_NOT_FOUND" ? 404 : 400;
          sendJson(res, status, { ok: false, error: result.error });
          return true;
        }
        const sourceTabId = (req.headers["x-m3e-tab-id"] as string) || null;
        broadcastDocUpdate(docId, result.savedAt, sourceTabId);
        sendJson(res, 200, {
          ok: true,
          savedAt: result.savedAt,
          documentId: docId,
          scope: { rootId: scopeId, replacedNodeCount: result.replacedNodeCount },
        });
        return true;
      }

      const model = RapidMvpModel.fromJSON(candidate.state as never);
      const errors = model.validate();
      if (errors.length > 0) {
        sendJson(res, 400, { error: `Invalid model before save: ${errors.join(" | ")}` });
        return true;
      }

      model.saveToSqlite(SQLITE_DB_PATH, docId);
      const savedAt = new Date().toISOString();
      const sourceTabId = (req.headers["x-m3e-tab-id"] as string) || null;
      broadcastDocUpdate(docId, savedAt, sourceTabId);
      sendJson(res, 200, { ok: true, savedAt, documentId: docId });
    } catch (err) {
      const message = (err as Error).message || "Unknown error";
      if (err instanceof SyntaxError) {
        sendJson(res, 400, { error: "Invalid JSON body." });
      } else {
        sendJson(res, 400, { error: message });
      }
    }
    return true;
  }

  sendJson(res, 405, { error: "Method not allowed." });
  return true;
}

async function handleSyncApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  route: { action: "status" | "push" | "pull"; docId: string },
): Promise<boolean> {
  if (!route.docId) {
    sendSyncError(res, 400, "SYNC_DOC_ID_REQUIRED", "Document id is required.", route.docId);
    return true;
  }

  if (!CLOUD_SYNC_ENABLED || !cloudTransport) {
    if (route.action === "status") {
      // Status endpoint: return 200 with enabled:false so browser can update UI
      sendJson(res, 200, {
        ok: true,
        enabled: false,
        mode: "disabled",
        documentId: route.docId,
      });
    } else {
      // Push/pull endpoints: return 503 so browser knows sync is unavailable
      sendSyncError(res, 503, "SYNC_DISABLED", "Cloud sync is not enabled on this server.", route.docId);
    }
    return true;
  }

  const transport = cloudTransport;
  const modeLabel = transport.mode === "file" ? "file-mirror" : transport.mode;

  if (route.action === "status" && req.method === "GET") {
    try {
      const result = await transport.status(route.docId);
      sendJson(res, 200, { ...result, mode: modeLabel });
    } catch (err) {
      sendSyncError(res, 500, "SYNC_STATUS_FAILED", (err as Error).message, route.docId);
    }
    return true;
  }

  if (route.action === "pull" && req.method === "POST") {
    try {
      // Parse body to check for localState (for conflict backup)
      let localState: AppState | null = null;
      try {
        const rawBody = await readRequestBody(req);
        const body = JSON.parse(rawBody) as { localState?: AppState };
        if (body.localState && typeof body.localState === "object") {
          localState = body.localState;
        }
      } catch {
        // Empty or invalid body is fine for pull
      }

      const result = await transport.pull(route.docId);
      if (!result.ok) {
        const isUnsupported = result.error?.includes("unsupported");
        const statusCode = isUnsupported ? 400 : 404;
        const code = isUnsupported ? "SYNC_CLOUD_UNSUPPORTED_FORMAT" : "SYNC_CLOUD_NOT_FOUND";
        sendSyncError(res, statusCode, code, result.error || "Cloud document not found.", route.docId);
        return true;
      }
      const model = RapidMvpModel.fromJSON(result.state);
      const errors = model.validate();
      if (errors.length > 0) {
        sendSyncError(res, 400, "SYNC_CLOUD_INVALID_MODEL", `Cloud document is invalid: ${errors.join(" | ")}`, route.docId);
        return true;
      }

      // Create conflict backup of local state if provided
      let backup: { backupId: string; reason: string; createdAt: string } | undefined;
      if (localState) {
        const entry = createConflictBackup(DATA_DIR, route.docId, localState, "cloud-sync-pull");
        backup = { backupId: entry.backupId, reason: entry.reason, createdAt: entry.createdAt };
      }

      sendJson(res, 200, {
        ok: true,
        mode: modeLabel,
        version: 1,
        savedAt: result.savedAt,
        state: model.toJSON(),
        documentId: route.docId,
        docVersion: result.docVersion ?? undefined,
        ...(backup ? { backup } : {}),
      });
    } catch (err) {
      sendSyncError(res, 500, "SYNC_PULL_FAILED", (err as Error).message || "Cloud pull failed.", route.docId);
    }
    return true;
  }

  if (route.action === "push" && req.method === "POST") {
    try {
      const rawBody = await readRequestBody(req);
      const parsed = JSON.parse(rawBody) as { state?: unknown; savedAt?: string; baseSavedAt?: string | null; baseDocVersion?: number | null; force?: boolean };
      const candidate = parsed && parsed.state ? parsed : { state: parsed, savedAt: new Date().toISOString() };
      if (!candidate.state || typeof candidate.state !== "object") {
        sendSyncError(res, 400, "SYNC_INVALID_JSON_FORMAT", "Invalid JSON format.", route.docId);
        return true;
      }
      if (!(candidate.state as Record<string, unknown>).nodes) {
        sendSyncError(res, 400, "SYNC_PUSH_INVALID_MODEL", "Missing required field: nodes.", route.docId);
        return true;
      }

      const model = RapidMvpModel.fromJSON(candidate.state as never);
      const errors = model.validate();
      if (errors.length > 0) {
        sendSyncError(res, 400, "SYNC_PUSH_INVALID_MODEL", `Invalid model before cloud push: ${errors.join(" | ")}`, route.docId);
        return true;
      }

      const payload: SavedDoc = {
        version: 1,
        savedAt: String(candidate.savedAt || new Date().toISOString()),
        state: model.toJSON(),
      };
      // Use pushWithConflictBackup for automatic conflict backup creation
      const result = await pushWithConflictBackup(
        transport,
        route.docId,
        payload,
        parsed.baseSavedAt ?? null,
        Boolean(parsed.force),
        DATA_DIR,
        parsed.baseDocVersion ?? null,
      );
      if (!result.ok) {
        const statusCode = result.conflict ? 409 : 500;
        const code = result.conflict ? "CLOUD_CONFLICT" : "SYNC_PUSH_FAILED";
        const extra: Record<string, unknown> = {};
        if (result.conflict) {
          extra.cloudSavedAt = result.cloudSavedAt ?? null;
          extra.cloudDocVersion = result.cloudDocVersion ?? null;
          if (result.remoteState) {
            extra.remoteState = result.remoteState;
          }
          // pushWithConflictBackup already created a backup; list the latest one
          const backups = listConflictBackups(DATA_DIR, route.docId);
          if (backups.length > 0) {
            extra.backup = {
              backupId: backups[0].backupId,
              reason: backups[0].reason,
              createdAt: backups[0].createdAt,
            };
          }
        }
        sendSyncError(res, statusCode, code, result.error || "Cloud push failed.", route.docId, extra);
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        mode: modeLabel,
        savedAt: result.savedAt,
        documentId: route.docId,
        forced: result.forced,
        docVersion: result.cloudDocVersion ?? undefined,
      });
    } catch (err) {
      if (err instanceof SyntaxError) {
        sendSyncError(res, 400, "SYNC_INVALID_JSON_BODY", "Invalid JSON body.", route.docId);
        return true;
      }
      sendSyncError(res, 500, "SYNC_PUSH_FAILED", (err as Error).message || "Cloud push failed.", route.docId);
    }
    return true;
  }

  sendSyncError(res, 405, "SYNC_METHOD_NOT_ALLOWED", "Method not allowed.", route.docId);
  return true;
}

async function handleLinearTransformApi(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

  if (pathname === "/api/linear-transform/status") {
    if (req.method !== "GET") {
      sendJson(res, 405, {
        ok: false,
        code: "LINEAR_TRANSFORM_METHOD_NOT_ALLOWED",
        error: "Method not allowed.",
      });
      return true;
    }

    sendJson(res, 200, getLinearTransformStatus());
    return true;
  }

  if (pathname === "/api/linear-transform/convert") {
    if (req.method !== "POST") {
      sendJson(res, 405, {
        ok: false,
        code: "LINEAR_TRANSFORM_METHOD_NOT_ALLOWED",
        error: "Method not allowed.",
      });
      return true;
    }

    try {
      const rawBody = await readRequestBody(req);
      const parsed = JSON.parse(rawBody) as LinearTransformRequest;
      if (!parsed || (parsed.direction !== "tree-to-linear" && parsed.direction !== "linear-to-tree")) {
        sendJson(res, 400, {
          ok: false,
          code: "LINEAR_TRANSFORM_INVALID_DIRECTION",
          error: "Direction must be tree-to-linear or linear-to-tree.",
        });
        return true;
      }
      if (typeof parsed.sourceText !== "string" || parsed.sourceText.trim().length === 0) {
        sendJson(res, 400, {
          ok: false,
          code: "LINEAR_TRANSFORM_SOURCE_REQUIRED",
          error: "sourceText is required.",
        });
        return true;
      }

      const result = await runLinearTransform(parsed);
      sendJson(res, 200, result);
      return true;
    } catch (err) {
      const status = (err as Error).message.includes("not implemented") || (err as Error).message.includes("disabled")
        || (err as Error).message.includes("not fully configured")
        ? 503
        : err instanceof SyntaxError
          ? 400
          : 502;
      sendJson(res, status, {
        ok: false,
        code: err instanceof SyntaxError
          ? "LINEAR_TRANSFORM_INVALID_JSON_BODY"
          : "LINEAR_TRANSFORM_FAILED",
        error: err instanceof SyntaxError
          ? "Invalid JSON body."
          : ((err as Error).message || "Linear transform failed."),
      });
      return true;
    }
  }

  return false;
}

function mapAiErrorToResponse(err: unknown): { status: number; code: string; message: string } {
  const message = (err as Error)?.message || "AI request failed.";
  switch (message) {
    case "AI_DOCUMENT_ID_REQUIRED":
      return { status: 400, code: message, message: "documentId is required." };
    case "AI_SCOPE_ID_REQUIRED":
      return { status: 400, code: message, message: "scopeId is required." };
    case "AI_INPUT_REQUIRED":
      return { status: 400, code: message, message: "input is required." };
    case "AI_INPUT_DIRECTION_REQUIRED":
      return { status: 400, code: message, message: "input.direction is required." };
    case "AI_INPUT_DIRECTION_INVALID":
      return { status: 400, code: message, message: "input.direction must be tree-to-linear or linear-to-tree." };
    case "AI_INPUT_SOURCE_TEXT_REQUIRED":
      return { status: 400, code: message, message: "input.sourceText is required." };
    case "AI_INPUT_NODE_TEXT_REQUIRED":
      return { status: 400, code: message, message: "input.nodeText is required." };
    case "AI_UNSUPPORTED_SUBAGENT":
      return { status: 404, code: message, message: "Unsupported subagent." };
    default:
      if (message.includes("disabled")) {
        return { status: 503, code: "AI_DISABLED", message };
      }
      if (message.includes("not fully configured")) {
        return { status: 503, code: "AI_NOT_CONFIGURED", message };
      }
      if (message.includes("not implemented")) {
        return { status: 503, code: "AI_TRANSPORT_NOT_IMPLEMENTED", message };
      }
      return { status: 502, code: "AI_PROVIDER_UNAVAILABLE", message };
  }
}

async function handleAiApi(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  if (isAiStatusRoute(req.url ?? "/")) {
    if (req.method !== "GET") {
      sendJson(res, 405, {
        ok: false,
        code: "AI_METHOD_NOT_ALLOWED",
        error: "Method not allowed.",
      });
      return true;
    }
    sendJson(res, 200, getAiStatus());
    return true;
  }

  const subagentRoute = parseAiSubagentRoute(req.url ?? "/");
  if (!subagentRoute) {
    return false;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, {
      ok: false,
      code: "AI_METHOD_NOT_ALLOWED",
      error: "Method not allowed.",
      subagent: subagentRoute.subagent,
    });
    return true;
  }

  try {
    const rawBody = await readRequestBody(req);
    const parsed = JSON.parse(rawBody) as AiSubagentRequest;
    const result = await runAiSubagent(subagentRoute.subagent, parsed);
    sendJson(res, 200, result);
    return true;
  } catch (err) {
    if (err instanceof SyntaxError) {
      sendJson(res, 400, {
        ok: false,
        code: "AI_INVALID_REQUEST",
        error: "Invalid JSON body.",
        subagent: subagentRoute.subagent,
      });
      return true;
    }
    const mapped = mapAiErrorToResponse(err);
    sendJson(res, mapped.status, {
      ok: false,
      code: mapped.code,
      error: mapped.message,
      subagent: subagentRoute.subagent,
      provider: getAiStatus().provider,
      retryable: mapped.status >= 500,
    });
    return true;
  }
}

function startServer(): void {
  // Initialize audit log file for the default document
  initAuditFile(DATA_DIR, DEFAULT_DOC_ID);

  const server = createAppServer();

  server.listen(PORT, () => {
    const isFirstRun = !fs.existsSync(FIRST_RUN_MARKER);
    const params = new URLSearchParams({
      workspaceId: WORKSPACE_ID,
      localDocId: DEFAULT_DOC_ID,
      cloudDocId: DEFAULT_DOC_ID,
    });
    if (isFirstRun) {
      params.set("scopeId", TUTORIAL_SCOPE_ID);
    }
    const query = `?${params.toString()}`;
    const url = `http://localhost:${PORT}/${DEFAULT_PAGE}${query}`;
    console.log(`Viewer ready: ${url}`);
    openBrowser(url);
    if (isFirstRun) {
      try { fs.writeFileSync(FIRST_RUN_MARKER, new Date().toISOString()); } catch { /* ignore */ }
    }
    // Startup backup + periodic auto-backup
    const BACKUP_DIR = path.join(DATA_DIR, "backups");
    if (fs.existsSync(SQLITE_DB_PATH)) {
      const maxGen = Number(process.env.M3E_BACKUP_MAX_GENERATIONS) || 10;
      createBackup(SQLITE_DB_PATH, BACKUP_DIR)
        .then(() => { pruneOldBackups(BACKUP_DIR, maxGen); })
        .catch((err) => { console.error(`[backup] Startup backup failed: ${(err as Error).message}`); });
      startAutoBackup(SQLITE_DB_PATH, BACKUP_DIR);
    }
    // Auto sync setup
    if (cloudSyncConfig.autoSync && cloudTransport) {
      autoSyncHandle = startAutoSync(cloudTransport, cloudSyncConfig.autoSyncIntervalMs, {
        getLocalState: async () => {
          try {
            const model = RapidMvpModel.loadFromSqlite(SQLITE_DB_PATH, DEFAULT_DOC_ID);
            return {
              version: 1,
              savedAt: new Date().toISOString(),
              state: model.toJSON(),
            };
          } catch {
            return null;
          }
        },
        getDocId: () => DEFAULT_DOC_ID,
        getBaseSavedAt: () => null,
        getBaseDocVersion: () => null,
        onPushSuccess: (result) => {
          console.log(`[auto-sync] Push succeeded: docVersion=${result.cloudDocVersion ?? "?"}`);
        },
        onConflict: (result) => {
          console.warn(`[auto-sync] Conflict detected: cloudDocVersion=${result.cloudDocVersion ?? "?"}`);
        },
        onError: (error) => {
          console.error(`[auto-sync] Error: ${error}`);
        },
        onPullSuccess: (result) => {
          console.log(`[auto-sync] Initial pull succeeded: docVersion=${result.docVersion ?? "?"}`);
        },
        dataDir: DATA_DIR,
      });
      console.log(`[auto-sync] Started with interval ${cloudSyncConfig.autoSyncIntervalMs}ms`);
    }

    console.log("Press Ctrl+C to stop the server.");

    // Keep SSE connections alive through proxies
    setInterval(() => {
      const ping = ": heartbeat\n\n";
      for (let i = docWatchClients.length - 1; i >= 0; i--) {
        try {
          docWatchClients[i].res.write(ping);
        } catch {
          docWatchClients.splice(i, 1);
        }
      }
    }, 15_000);
  });
}

// ---------------------------------------------------------------------------
// Collab API
// ---------------------------------------------------------------------------

function parseCollabRoute(
  urlPath: string,
): { action: string; param?: string } | null {
  const pathname = new URL(urlPath, "http://localhost").pathname;
  if (!pathname.startsWith("/api/collab/")) return null;
  const rest = pathname.slice("/api/collab/".length);

  if (rest === "register") return { action: "register" };
  if (rest === "heartbeat") return { action: "heartbeat" };
  if (rest === "unregister") return { action: "unregister" };

  const entitiesMatch = rest.match(/^entities\/([^/]+)$/);
  if (entitiesMatch) return { action: "entities", param: decodeURIComponent(entitiesMatch[1]) };

  const lockMatch = rest.match(/^scope\/([^/]+)\/lock$/);
  if (lockMatch) return { action: "scope-lock", param: decodeURIComponent(lockMatch[1]) };

  const eventsMatch = rest.match(/^events\/([^/]+)$/);
  if (eventsMatch) return { action: "events", param: decodeURIComponent(eventsMatch[1]) };

  const pushMatch = rest.match(/^push\/([^/]+)$/);
  if (pushMatch) return { action: "push", param: decodeURIComponent(pushMatch[1]) };

  return null;
}

async function handleCollabApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  route: { action: string; param?: string },
): Promise<void> {
  if (!COLLAB_ENABLED) {
    sendJson(res, 404, { ok: false, error: "Collaboration not enabled. Set M3E_COLLAB=1." });
    return;
  }

  if (route.action === "register" && req.method === "POST") {
    const rawBody = await readRequestBody(req);
    const body = JSON.parse(rawBody) as {
      displayName?: string;
      role?: CollabRole;
      capabilities?: ("read" | "write")[];
    };
    if (!body.displayName || !body.role) {
      sendJson(res, 400, { ok: false, error: "displayName and role are required." });
      return;
    }
    const validRoles: CollabRole[] = ["owner", "human", "ai-supervised", "ai", "ai-readonly"];
    if (!validRoles.includes(body.role)) {
      sendJson(res, 400, { ok: false, error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
      return;
    }
    const entity = registerEntity(body.displayName, body.role, body.capabilities ?? ["read", "write"]);
    // Track presence for default doc on register
    touchPresence(DEFAULT_DOC_ID, entity.entityId, body.displayName, body.role);
    sendJson(res, 200, { ok: true, entityId: entity.entityId, token: entity.token, priority: entity.priority });
    return;
  }

  const entity = authenticateRequest(req);
  if (!entity) {
    sendJson(res, 401, { ok: false, error: "Unauthorized. Provide Authorization: Bearer {token}." });
    return;
  }

  switch (route.action) {
    case "heartbeat": {
      if (req.method !== "POST") { sendJson(res, 405, { ok: false, error: "Method not allowed." }); return; }
      const rawBody = await readRequestBody(req);
      const body = JSON.parse(rawBody) as { lockIds?: string[]; docId?: string };
      heartbeat(entity.entityId, body.lockIds ?? []);
      // Refresh presence on heartbeat
      touchPresence(body.docId ?? DEFAULT_DOC_ID, entity.entityId, entity.displayName, entity.role);
      sendJson(res, 200, { ok: true });
      return;
    }
    case "unregister": {
      if (req.method !== "DELETE") { sendJson(res, 405, { ok: false, error: "Method not allowed." }); return; }
      // Remove from all doc presence (use default doc for now)
      removePresence(DEFAULT_DOC_ID, entity.entityId);
      unregisterEntity(entity.entityId);
      sendJson(res, 200, { ok: true });
      return;
    }
    case "entities": {
      if (req.method !== "GET") { sendJson(res, 405, { ok: false, error: "Method not allowed." }); return; }
      const active = getActiveEntities();
      sendJson(res, 200, {
        ok: true,
        entities: active.map((e) => ({ entityId: e.entityId, displayName: e.displayName, role: e.role, priority: e.priority })),
        docVersion: getDocVersion(),
      });
      return;
    }
    case "scope-lock": {
      const scopeId = route.param!;
      if (req.method === "POST") {
        if (!entity.capabilities.includes("write")) { sendJson(res, 403, { ok: false, error: "Write capability required." }); return; }
        const result = acquireScopeLock(scopeId, entity);
        if (!result.ok) { sendJson(res, result.status, { ok: false, error: result.error }); return; }
        sendJson(res, 200, { ok: true, lockId: result.lock.lockId, expiresAt: new Date(result.lock.expiresAt).toISOString(), leaseDuration: result.lock.leaseDuration });
        return;
      }
      if (req.method === "DELETE") {
        const released = releaseScopeLock(scopeId, entity);
        sendJson(res, released ? 200 : 404, { ok: released, ...(released ? {} : { error: "Lock not found or not owned by you." }) });
        return;
      }
      sendJson(res, 405, { ok: false, error: "Method not allowed." });
      return;
    }
    case "events": {
      if (req.method !== "GET") { sendJson(res, 405, { ok: false, error: "Method not allowed." }); return; }
      addSseClient(entity.entityId, res);
      return;
    }
    case "push": {
      if (req.method !== "POST") { sendJson(res, 405, { ok: false, error: "Method not allowed." }); return; }
      if (!entity.capabilities.includes("write")) { sendJson(res, 403, { ok: false, error: "Write capability required." }); return; }
      const docId = route.param;
      if (!docId) { sendJson(res, 400, { ok: false, error: "Document ID required." }); return; }
      try {
        const rawBody = await readRequestBody(req);
        const body = JSON.parse(rawBody) as { scopeId?: string; lockId?: string; baseVersion?: number; changes?: { nodes?: Record<string, unknown> } };
        if (!body.scopeId || !body.lockId || body.baseVersion === undefined || !body.changes?.nodes) {
          sendJson(res, 400, { ok: false, error: "scopeId, lockId, baseVersion, and changes.nodes are required." });
          return;
        }
        const result = mergeScopePush(docId, body.scopeId, entity, body.lockId, body.baseVersion, body.changes.nodes as never, SQLITE_DB_PATH);
        // Update presence on push
        touchPresence(docId, entity.entityId, entity.displayName, entity.role);
        if (!result.ok && result.error === "Scope lock not held.") {
          sendJson(res, 403, result);
        } else {
          sendJson(res, 200, result);
        }
      } catch (err) {
        sendJson(res, 500, { ok: false, error: (err as Error).message || "Push failed." });
      }
      return;
    }
    default:
      sendJson(res, 404, { ok: false, error: "Unknown collab endpoint." });
  }
}

export function createAppServer(): http.Server {
  return http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const collabRoute = parseCollabRoute(req.url ?? "/");
    if (collabRoute) {
      await handleCollabApi(req, res, collabRoute);
      return;
    }

    if (isAiStatusRoute(req.url ?? "/") || parseAiSubagentRoute(req.url ?? "/")) {
      await handleAiApi(req, res);
      return;
    }

    if (isLinearTransformRoute(req.url ?? "/")) {
      await handleLinearTransformApi(req, res);
      return;
    }

    const flashRoute = parseFlashRoute(req.url ?? "/", req.method ?? "GET");
    if (flashRoute) {
      await handleFlashApi(req, res, flashRoute);
      return;
    }

    const backupRoute = parseBackupRoute(req.url ?? "/");
    if (backupRoute) {
      await handleBackupApi(req, res, backupRoute);
      return;
    }

    const syncRoute = parseSyncRoute(req.url ?? "/");
    if (syncRoute) {
      await handleSyncApi(req, res, syncRoute);
      return;
    }

    const watchDocId = parseDocWatchRoute(req.url ?? "/");
    if (watchDocId !== null) {
      if (req.method !== "GET") {
        sendJson(res, 405, { error: "Method not allowed." });
        return;
      }
      addDocWatchClient(watchDocId, res);
      return;
    }

    // Audit log endpoint
    const auditDocId = parseDocAuditRoute(req.url ?? "/");
    if (auditDocId !== null) {
      if (req.method !== "GET") {
        sendJson(res, 405, { error: "Method not allowed." });
        return;
      }
      const url = new URL(req.url ?? "/", "http://localhost");
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Math.max(1, Math.min(1000, Number(limitParam) || 100)) : 100;
      const entries = getRecentAuditEntries(limit);
      sendJson(res, 200, { ok: true, documentId: auditDocId, count: entries.length, entries });
      return;
    }

    // Presence endpoint
    const presenceDocId = parseDocPresenceRoute(req.url ?? "/");
    if (presenceDocId !== null) {
      if (req.method !== "GET") {
        sendJson(res, 405, { error: "Method not allowed." });
        return;
      }
      const list = getPresenceList(presenceDocId);
      sendJson(res, 200, { ok: true, documentId: presenceDocId, count: list.length, users: list });
      return;
    }

    const linearNoteRoute = parseLinearNoteRoute(req.url ?? "/");
    if (linearNoteRoute) {
      await handleLinearNoteApi(req, res, linearNoteRoute);
      return;
    }

    const homeRoute = parseHomeRoute(req.url ?? "/", req.method ?? "GET");
    if (homeRoute) {
      await handleHomeApi(req, res, homeRoute);
      return;
    }

    const linkRoute = parseLinkRoute(req.url ?? "/", req.method ?? "GET");
    if (linkRoute) {
      await handleLinkApi(req, res, linkRoute);
      return;
    }

    const docId = parseDocId(req.url ?? "/");
    if (docId !== null) {
      await handleApi(req, res, docId);
      return;
    }

    const target = safeResolve(req.url ?? "/");
    if (!target) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }

    sendFile(res, target);
  });
}

if (require.main === module) {
  runSampleGeneration();
  startServer();
}

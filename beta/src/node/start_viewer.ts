"use strict";

import "dotenv/config";
import fs from "fs";
import path from "path";
import http from "http";
import { spawnSync, exec } from "child_process";
import { RapidMvpModel } from "./rapid_mvp";
import { detectCloudConflict, loadCloudSyncConfig } from "./cloud_sync";
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
import type { AiSubagentRequest, AppState, LinearTransformRequest, SavedDoc } from "../shared/types";

// After compilation, this file lives at dist/node/start_viewer.js.
// ROOT must point two levels up to the mvp/ directory.
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = Number(process.env.M3E_PORT || "4173");
const DEFAULT_PAGE = "viewer.html";
const DATA_DIR = process.env.M3E_DATA_DIR ?? path.join(ROOT, "data");
const DEFAULT_DB_FILE = "M3E_dataV1.sqlite";
const DB_FILE = process.env.M3E_DB_FILE || DEFAULT_DB_FILE;
const SQLITE_DB_PATH = path.join(DATA_DIR, DB_FILE);
const FIRST_RUN_MARKER = path.join(DATA_DIR, ".m3e-launched");
const TUTORIAL_SCOPE_ID = "n_1775650869381_rns0cp";
const cloudSyncConfig = loadCloudSyncConfig();
const CLOUD_SYNC_ENABLED = cloudSyncConfig.enabled;
let cloudTransport: CloudSyncTransport | null = cloudSyncConfig.transport;

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

async function handleApi(req: http.IncomingMessage, res: http.ServerResponse, docId: string): Promise<boolean> {
  if (!docId) {
    sendJson(res, 400, { error: "Document id is required." });
    return true;
  }

  if (req.method === "GET") {
    try {
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

      const model = RapidMvpModel.fromJSON(candidate.state as never);
      const errors = model.validate();
      if (errors.length > 0) {
        sendJson(res, 400, { error: `Invalid model before save: ${errors.join(" | ")}` });
        return true;
      }

      model.saveToSqlite(SQLITE_DB_PATH, docId);
      sendJson(res, 200, { ok: true, savedAt: new Date().toISOString(), documentId: docId });
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
    sendJson(res, 200, {
      ok: true,
      enabled: false,
      mode: "disabled",
      documentId: route.docId,
    });
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
      const result = await transport.pull(route.docId);
      if (!result.ok) {
        sendSyncError(res, 404, "SYNC_CLOUD_NOT_FOUND", result.error || "Cloud document not found.", route.docId);
        return true;
      }
      const model = RapidMvpModel.fromJSON(result.state);
      const errors = model.validate();
      if (errors.length > 0) {
        sendSyncError(res, 400, "SYNC_CLOUD_INVALID_MODEL", `Cloud document is invalid: ${errors.join(" | ")}`, route.docId);
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        mode: modeLabel,
        version: 1,
        savedAt: result.savedAt,
        state: model.toJSON(),
        documentId: route.docId,
      });
    } catch (err) {
      sendSyncError(res, 500, "SYNC_PULL_FAILED", (err as Error).message || "Cloud pull failed.", route.docId);
    }
    return true;
  }

  if (route.action === "push" && req.method === "POST") {
    try {
      const rawBody = await readRequestBody(req);
      const parsed = JSON.parse(rawBody) as { state?: unknown; savedAt?: string; baseSavedAt?: string | null; force?: boolean };
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
      const result = await transport.push(route.docId, payload, parsed.baseSavedAt ?? null, Boolean(parsed.force));
      if (!result.ok) {
        const statusCode = result.error?.includes("conflict") || result.error?.includes("Conflict") ? 409 : 500;
        sendSyncError(res, statusCode, "SYNC_PUSH_FAILED", result.error || "Cloud push failed.", route.docId);
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        mode: modeLabel,
        savedAt: result.savedAt,
        documentId: route.docId,
        forced: result.forced,
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
  const server = createAppServer();

  server.listen(PORT, () => {
    const isFirstRun = !fs.existsSync(FIRST_RUN_MARKER);
    const query = isFirstRun ? `?scopeId=${TUTORIAL_SCOPE_ID}` : "";
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
    console.log("Press Ctrl+C to stop the server.");
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
      const body = JSON.parse(rawBody) as { lockIds?: string[] };
      heartbeat(entity.entityId, body.lockIds ?? []);
      sendJson(res, 200, { ok: true });
      return;
    }
    case "unregister": {
      if (req.method !== "DELETE") { sendJson(res, 405, { ok: false, error: "Method not allowed." }); return; }
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

    const syncRoute = parseSyncRoute(req.url ?? "/");
    if (syncRoute) {
      await handleSyncApi(req, res, syncRoute);
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

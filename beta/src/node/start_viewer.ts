"use strict";

import fs from "fs";
import path from "path";
import http from "http";
import { spawnSync, exec } from "child_process";
import { RapidMvpModel } from "./rapid_mvp";
import { detectCloudConflict } from "./cloud_sync";
import type { AppState, SavedDoc } from "../shared/types";

// After compilation, this file lives at dist/node/start_viewer.js.
// ROOT must point two levels up to the mvp/ directory.
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = 4173;
const DEFAULT_PAGE = "viewer.html";
const SQLITE_DB_PATH = path.join(ROOT, "data", "rapid-mvp.sqlite");
const CLOUD_SYNC_ENABLED = process.env.M3E_CLOUD_SYNC === "1";
const CLOUD_SYNC_DIR = process.env.M3E_CLOUD_DIR
  ? path.resolve(process.env.M3E_CLOUD_DIR)
  : path.join(ROOT, "data", "cloud-sync");

const MIME_BY_EXT: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mm": "application/xml; charset=utf-8",
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

function cloudDocPath(docId: string): string {
  const safeId = docId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(CLOUD_SYNC_DIR, `${safeId}.json`);
}

function ensureCloudSyncDir(): void {
  if (!CLOUD_SYNC_ENABLED) {
    return;
  }
  if (!fs.existsSync(CLOUD_SYNC_DIR)) {
    fs.mkdirSync(CLOUD_SYNC_DIR, { recursive: true });
  }
}

function readCloudDoc(filePath: string): SavedDoc | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as SavedDoc;
  if (!parsed || parsed.version !== 1 || !parsed.state) {
    return null;
  }
  return parsed;
}

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
      if (!candidate.state) {
        sendJson(res, 400, { error: "Invalid JSON format." });
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

  if (!CLOUD_SYNC_ENABLED) {
    sendJson(res, 200, {
      enabled: false,
      mode: "disabled",
      documentId: route.docId,
    });
    return true;
  }

  ensureCloudSyncDir();
  const filePath = cloudDocPath(route.docId);

  if (route.action === "status" && req.method === "GET") {
    const exists = fs.existsSync(filePath);
    const cloudDoc = exists ? readCloudDoc(filePath) : null;
    sendJson(res, 200, {
      enabled: true,
      mode: "file-mirror",
      documentId: route.docId,
      exists,
      cloudSavedAt: cloudDoc?.savedAt ?? null,
      lastSyncedAt: exists ? fs.statSync(filePath).mtime.toISOString() : null,
    });
    return true;
  }

  if (route.action === "pull" && req.method === "POST") {
    if (!fs.existsSync(filePath)) {
      sendSyncError(res, 404, "SYNC_CLOUD_NOT_FOUND", "Cloud document not found.", route.docId);
      return true;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as { version?: number; state?: AppState; savedAt?: string };
      if (!parsed || parsed.version !== 1 || !parsed.state) {
        sendSyncError(res, 400, "SYNC_CLOUD_UNSUPPORTED_FORMAT", "Cloud document has unsupported format.", route.docId);
        return true;
      }

      const model = RapidMvpModel.fromJSON(parsed.state);
      const errors = model.validate();
      if (errors.length > 0) {
        sendSyncError(
          res,
          400,
          "SYNC_CLOUD_INVALID_MODEL",
          `Cloud document is invalid: ${errors.join(" | ")}`,
          route.docId,
        );
        return true;
      }

      sendJson(res, 200, {
        ok: true,
        version: 1,
        savedAt: parsed.savedAt || fs.statSync(filePath).mtime.toISOString(),
        state: model.toJSON(),
        documentId: route.docId,
      });
      return true;
    } catch (err) {
      sendSyncError(
        res,
        500,
        "SYNC_PULL_FAILED",
        (err as Error).message || "Cloud pull failed.",
        route.docId,
      );
      return true;
    }
  }

  if (route.action === "push" && req.method === "POST") {
    try {
      const rawBody = await readRequestBody(req);
      const parsed = JSON.parse(rawBody) as { state?: unknown; savedAt?: string; baseSavedAt?: string | null; force?: boolean };
      const candidate = parsed && parsed.state ? parsed : { state: parsed, savedAt: new Date().toISOString() };
      if (!candidate.state) {
        sendSyncError(res, 400, "SYNC_INVALID_JSON_FORMAT", "Invalid JSON format.", route.docId);
        return true;
      }

      const existingCloudDoc = readCloudDoc(filePath);
      const baseSavedAt = parsed.baseSavedAt ?? null;
      const forcePush = Boolean(parsed.force);
      if (detectCloudConflict(existingCloudDoc?.savedAt ?? null, baseSavedAt, forcePush)) {
        sendSyncError(res, 409, "CLOUD_CONFLICT", "Cloud conflict detected.", route.docId, {
          cloudSavedAt: existingCloudDoc?.savedAt ?? null,
          baseSavedAt,
        });
        return true;
      }

      const model = RapidMvpModel.fromJSON(candidate.state as never);
      const errors = model.validate();
      if (errors.length > 0) {
        sendSyncError(
          res,
          400,
          "SYNC_PUSH_INVALID_MODEL",
          `Invalid model before cloud push: ${errors.join(" | ")}`,
          route.docId,
        );
        return true;
      }

      const payload: SavedDoc = {
        version: 1,
        savedAt: String(candidate.savedAt || new Date().toISOString()),
        state: model.toJSON(),
      };
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
      sendJson(res, 200, {
        ok: true,
        mode: "file-mirror",
        savedAt: payload.savedAt,
        documentId: route.docId,
        forced: forcePush,
      });
      return true;
    } catch (err) {
      if (err instanceof SyntaxError) {
        sendSyncError(res, 400, "SYNC_INVALID_JSON_BODY", "Invalid JSON body.", route.docId);
        return true;
      }
      sendSyncError(
        res,
        500,
        "SYNC_PUSH_FAILED",
        (err as Error).message || "Cloud push failed.",
        route.docId,
      );
      return true;
    }
  }

  sendSyncError(res, 405, "SYNC_METHOD_NOT_ALLOWED", "Method not allowed.", route.docId);
  return true;
}

function startServer(): void {
  const server = createAppServer();

  server.listen(PORT, () => {
    const url = `http://localhost:${PORT}/${DEFAULT_PAGE}`;
    console.log(`Viewer ready: ${url}`);
    openBrowser(url);
    console.log("Press Ctrl+C to stop the server.");
  });
}

export function createAppServer(): http.Server {
  return http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
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

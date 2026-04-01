"use strict";

import fs from "fs";
import path from "path";
import http from "http";
import { spawnSync, exec } from "child_process";
import { RapidMvpModel } from "./rapid_mvp";

// After compilation, this file lives at dist/node/start_viewer.js.
// ROOT must point two levels up to the mvp/ directory.
const ROOT = path.resolve(__dirname, "..", "..");
const PORT = 4173;
const DEFAULT_PAGE = "viewer.html";
const DATA_DIR = process.env.M3E_DATA_DIR ?? path.join(ROOT, "data");
const SQLITE_DB_PATH = path.join(DATA_DIR, "rapid-mvp.sqlite");

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

function startServer(): void {
  const server = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
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

  server.listen(PORT, () => {
    const url = `http://localhost:${PORT}/${DEFAULT_PAGE}`;
    console.log(`Viewer ready: ${url}`);
    openBrowser(url);
    console.log("Press Ctrl+C to stop the server.");
  });
}

runSampleGeneration();
startServer();

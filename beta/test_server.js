"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const PORT = Number(process.env.M3E_PORT || "14174");
if (PORT === 4173 && process.env.M3E_ALLOW_VISUAL_TEST_ON_4173 !== "1") {
  console.error("Refusing to run visual test server on beta port 4173. Use a dedicated test port.");
  process.exit(1);
}
const DEFAULT_PAGE = "viewer.html";

const MIME_BY_EXT = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mm": "application/xml; charset=utf-8",
};

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

function safeResolve(urlPath) {
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

function ensureSampleData() {
  const rapidPath = path.join(ROOT, "legacy", "rapid_mvp.js");
  const run = spawnSync(process.execPath, [rapidPath], {
    cwd: ROOT,
    stdio: "inherit",
  });

  if (run.status !== 0) {
    process.exit(run.status || 1);
  }
}

function sendFile(res, target) {
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

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readRequestBody(req, maxBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    req.on("data", (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        reject(new Error("Request body too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function writeSystemClipboard(text) {
  const input = Buffer.from(text, "utf8");
  const run = (command, args, method) => {
    const result = spawnSync(command, args, { input, encoding: "utf8" });
    if (result.status === 0) return { ok: true, method };
    const detail = result.stderr || (result.error && result.error.message) || `${command} exited with status ${result.status}`;
    return { ok: false, error: detail };
  };

  if (process.platform === "darwin") return run("pbcopy", [], "pbcopy");
  if (process.platform === "win32") return run("clip.exe", [], "clip.exe");
  const wlCopy = run("wl-copy", [], "wl-copy");
  if (wlCopy.ok) return wlCopy;
  const xclip = run("xclip", ["-selection", "clipboard"], "xclip");
  if (xclip.ok) return xclip;
  const xsel = run("xsel", ["--clipboard", "--input"], "xsel");
  if (xsel.ok) return xsel;
  return { ok: false, error: xsel.error || xclip.error || wlCopy.error || "No clipboard command available." };
}

function readSystemClipboard() {
  const run = (command, args, method) => {
    const result = spawnSync(command, args, { encoding: "utf8" });
    if (result.status === 0) return { ok: true, method, text: result.stdout || "" };
    const detail = result.stderr || (result.error && result.error.message) || `${command} exited with status ${result.status}`;
    return { ok: false, error: detail };
  };

  if (process.platform === "darwin") return run("pbpaste", [], "pbpaste");
  if (process.platform === "win32") return run("powershell.exe", ["-NoProfile", "-Command", "Get-Clipboard -Raw"], "powershell.exe");
  const wlPaste = run("wl-paste", [], "wl-paste");
  if (wlPaste.ok) return wlPaste;
  const xclip = run("xclip", ["-selection", "clipboard", "-out"], "xclip");
  if (xclip.ok) return xclip;
  const xsel = run("xsel", ["--clipboard", "--output"], "xsel");
  if (xsel.ok) return xsel;
  return { ok: false, error: xsel.error || xclip.error || wlPaste.error || "No clipboard command available." };
}

async function handleSystemClipboardApi(req, res) {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;
  if (pathname !== "/api/system-clipboard/write" && pathname !== "/api/system-clipboard/read") return false;
  if (pathname === "/api/system-clipboard/read") {
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Method not allowed." });
      return true;
    }
    const result = readSystemClipboard();
    sendJson(res, result.ok ? 200 : 500, result);
    return true;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed." });
    return true;
  }
  try {
    const rawBody = await readRequestBody(req, 5_000_000);
    const body = JSON.parse(rawBody);
    if (typeof body.text !== "string" || body.text.length === 0) {
      sendJson(res, 400, { ok: false, error: "Field 'text' must be a non-empty string." });
      return true;
    }
    const result = writeSystemClipboard(body.text);
    sendJson(res, result.ok ? 200 : 500, result);
  } catch (err) {
    sendJson(res, 400, { ok: false, error: (err && err.message) || "Invalid clipboard request." });
  }
  return true;
}

function startServer() {
  const server = http.createServer(async (req, res) => {
    if (await handleSystemClipboardApi(req, res)) {
      return;
    }

    const target = safeResolve(req.url || "/");
    if (!target) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }
    sendFile(res, target);
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Visual test server ready: http://127.0.0.1:${PORT}/${DEFAULT_PAGE}`);
  });
}

ensureSampleData();
startServer();

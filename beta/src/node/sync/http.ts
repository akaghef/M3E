/**
 * Remote sync HTTP.
 *   POST /api/sync/push   {commands:[{commandId, mapId, baseSeq, command}]}
 *                         -> {results:[{commandId, status, seq?, code?, message?}]}
 *   GET  /api/sync/pull?after=<seq>&scope=<id>
 *                         -> {lines, throughSeq} | {reclone:true, snapshotSeq}
 *   GET  /api/sync/clone  -> {snapshotSeq, records}
 *
 * `scope` is accepted. Disclosure rights are not modelled, so the answer is the
 * whole workspace. The issuer is taken from the connection headers, never from
 * the Command:
 *   x-m3e-connection: mcp | viewer   (default viewer)
 * The system account is server-internal; a request cannot name it.
 *   x-m3e-actor-instance: <Actor Instance id>  (mcp only)
 */
import type http from "http";
import { activeRecordStore, recordStoreDir } from "../record_store/active";
import type { ConnectionIdentity } from "./issuer";
import { pullSince } from "./journal_read";
import { issuerForConnection, pushCommands } from "./push";

function header(req: http.IncomingMessage, name: string): string {
  const raw = req.headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value.trim() : "";
}

export function connectionFromRequest(req: http.IncomingMessage): ConnectionIdentity {
  const kind = header(req, "x-m3e-connection");
  if (kind === "mcp") return { kind: "mcp", instanceId: header(req, "x-m3e-actor-instance") || "anonymous" };
  return { kind: "viewer" };
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  if (res.writableEnded) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function noStore(res: http.ServerResponse): void {
  sendJson(res, 503, { ok: false, code: "NOT_FOUND", error: "Sync runs on the record store." });
}

export async function handleRecordSyncHttp(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname !== "/api/sync/push" && url.pathname !== "/api/sync/pull" && url.pathname !== "/api/sync/clone") return false;
  try {
    const store = activeRecordStore();
    const storeDir = recordStoreDir();
    if (!store || !storeDir) {
      noStore(res);
      return true;
    }
    if (url.pathname === "/api/sync/push") {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: "Method not allowed." });
        return true;
      }
      if (!(req.headers["content-type"] || "").startsWith("application/json")) {
        sendJson(res, 415, { ok: false, code: "INVALID_COMMAND", error: "Use application/json." });
        return true;
      }
      const body = JSON.parse(await readBody(req, 8_000_000)) as { commands?: unknown };
      const issuer = issuerForConnection(connectionFromRequest(req), store);
      sendJson(res, 200, pushCommands(store, storeDir, body?.commands, issuer));
      return true;
    }
    if (url.pathname === "/api/sync/clone") {
      if (req.method !== "GET") {
        sendJson(res, 405, { ok: false, error: "Method not allowed." });
        return true;
      }
      const records = store.records();
      const headerRecord = records.find((record) => record.kind === "snapshot");
      const snapshotSeq = headerRecord && headerRecord.kind === "snapshot" ? headerRecord.seq : store.seq();
      sendJson(res, 200, { snapshotSeq, records });
      return true;
    }
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Method not allowed." });
      return true;
    }
    const afterRaw = url.searchParams.get("after");
    if (afterRaw === null || !/^\d+$/.test(afterRaw)) {
      sendJson(res, 400, { ok: false, code: "INVALID_COMMAND", error: "after must be a non-negative integer." });
      return true;
    }
    const after = Number(afterRaw);
    if (!Number.isSafeInteger(after)) {
      sendJson(res, 400, { ok: false, code: "INVALID_COMMAND", error: "after must be a non-negative integer." });
      return true;
    }
    const scope = url.searchParams.get("scope") ?? undefined;
    // `scope` selects nothing yet: disclosure rights are not modelled.
    sendJson(res, 200, pullSince(storeDir, after, store.seq(), scope));
  } catch (error) {
    if (!res.headersSent) {
      const message = error instanceof SyntaxError ? "Invalid JSON body." : (error as Error).message || "Sync request failed.";
      sendJson(res, 400, { ok: false, code: "INVALID_COMMAND", error: message });
    } else {
      res.end();
    }
  }
  return true;
}

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
import { activeRecordStore, localModeStore, recordStoreDir } from "../record_store/active";
import { sameSyncIdentity, type SyncIdentity } from "../record_store/sync_types";
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

export function sendSyncJson(res: http.ServerResponse, status: number, body: unknown): void {
  if (res.writableEnded) return;
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

// Transport bound, including the JSON envelope. Commands remain indivisible.
const PUSH_BODY_BYTES = 32_000_000;

class PushBodyTooLarge extends Error {
  constructor(readonly limitBytes: number) { super(`Push body exceeds ${limitBytes} bytes.`); }
}

function readBody(req: http.IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      if (size > limit) return; // Drain without buffering; keep the connection for the 413 response.
      size += chunk.length;
      if (size > limit) {
        chunks.length = 0;
        reject(new PushBodyTooLarge(limit));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
    req.on("aborted", () => reject(new Error("Push body was interrupted.")));
  });
}

function noStore(res: http.ServerResponse): void {
  sendSyncJson(res, 503, { ok: false, code: "NOT_FOUND", error: "Sync runs on the record store." });
}

export async function handleRecordSyncHttp(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname !== "/api/sync/push" && url.pathname !== "/api/sync/pull" && url.pathname !== "/api/sync/clone") return false;
  try {
    if (localModeStore()) {
      sendSyncJson(res, 409, { ok: false, code: "LOCAL_MODE", error: "Only the remote confirms Commands." });
      return true;
    }
    const store = activeRecordStore();
    const storeDir = recordStoreDir();
    if (!store || !storeDir) {
      noStore(res);
      return true;
    }
    const identity = store.syncIdentity();
    const fence = (provided: Partial<SyncIdentity>): boolean | undefined => {
      const scoped = Object.keys(identity).some((key) => Object.prototype.hasOwnProperty.call(provided, key));
      if (!scoped || sameSyncIdentity(identity, provided)) return scoped;
      sendSyncJson(res, 409, { ...identity, ok: false, code: "FENCED", error: "Workspace or history does not match." });
      return undefined;
    };
    if (url.pathname === "/api/sync/push") {
      if (req.method !== "POST") {
        sendSyncJson(res, 405, { ok: false, error: "Method not allowed." });
        return true;
      }
      if (!(req.headers["content-type"] || "").startsWith("application/json")) {
        sendSyncJson(res, 415, { ok: false, code: "INVALID_COMMAND", error: "Use application/json." });
        return true;
      }
      const encoding = header(req, "content-encoding").toLowerCase();
      if (encoding && encoding !== "identity") {
        sendSyncJson(res, 415, { ok: false, code: "UNSUPPORTED_CONTENT_ENCODING", error: "Use an uncompressed JSON body." });
        return true;
      }
      const body = JSON.parse(await readBody(req, PUSH_BODY_BYTES)) as ({ commands?: unknown } & Partial<SyncIdentity>) | null;
      const fenced = fence(body ?? {});
      if (fenced === undefined) return true;
      const issuer = issuerForConnection(connectionFromRequest(req), store);
      sendSyncJson(res, 200, { ...identity, ...pushCommands(store, storeDir, body?.commands, issuer, fenced) });
      return true;
    }
    const params = url.searchParams;
    const provided: Partial<SyncIdentity> = {};
    if (params.has("workspaceId")) provided.workspaceId = params.get("workspaceId")!;
    if (params.has("historyId")) provided.historyId = params.get("historyId")!;
    if (params.has("epoch")) provided.epoch = Number(params.get("epoch"));
    if (fence(provided) === undefined) return true;
    if (url.pathname === "/api/sync/clone") {
      if (req.method !== "GET") {
        sendSyncJson(res, 405, { ok: false, error: "Method not allowed." });
        return true;
      }
      const records = store.records();
      const headerRecord = records.find((record) => record.kind === "snapshot");
      const snapshotSeq = headerRecord && headerRecord.kind === "snapshot" ? headerRecord.seq : store.seq();
      sendSyncJson(res, 200, { ...identity, snapshotSeq, records, ...(url.searchParams.has("index") ? { index: store.snapshotIndex(records) } : {}) });
      return true;
    }
    if (req.method !== "GET") {
      sendSyncJson(res, 405, { ok: false, error: "Method not allowed." });
      return true;
    }
    const afterRaw = params.get("after");
    if (afterRaw === null || !/^\d+$/.test(afterRaw)) {
      sendSyncJson(res, 400, { ok: false, code: "INVALID_COMMAND", error: "after must be a non-negative integer." });
      return true;
    }
    const after = Number(afterRaw);
    if (!Number.isSafeInteger(after)) {
      sendSyncJson(res, 400, { ok: false, code: "INVALID_COMMAND", error: "after must be a non-negative integer." });
      return true;
    }
    const scope = url.searchParams.get("scope") ?? undefined;
    // `scope` selects nothing yet: disclosure rights are not modelled.
    sendSyncJson(res, 200, { ...identity, ...pullSince(storeDir, after, store.seq(), scope) });
  } catch (error) {
    if (!res.headersSent) {
      if (error instanceof PushBodyTooLarge) {
        sendSyncJson(res, 413, { ok: false, code: "PUSH_BODY_TOO_LARGE", error: error.message, limitBytes: error.limitBytes });
        return true;
      }
      const message = error instanceof SyntaxError ? "Invalid JSON body." : (error as Error).message || "Sync request failed.";
      sendSyncJson(res, 400, { ok: false, code: "INVALID_COMMAND", error: message });
    } else {
      res.end();
    }
  }
  return true;
}

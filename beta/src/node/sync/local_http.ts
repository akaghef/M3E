import type http from "http";
import { localModeStore } from "../record_store/active";
import { sendSyncJson } from "./http";
import { LocalSyncError } from "./local";

export async function handleLocalSyncHttp(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  notify: (mapIds: string[]) => void,
): Promise<boolean> {
  const route = new URL(req.url ?? "/", "http://localhost").pathname;
  const action = /^\/api\/sync\/local\/(status|conflicts|push|pull)$/.exec(route)?.[1];
  if (action === undefined) return false;
  const method = action === "status" || action === "conflicts" ? "GET" : "POST";
  if (req.method !== method) {
    sendSyncJson(res, 405, { ok: false, error: "Method not allowed." });
    return true;
  }
  const local = localModeStore();
  if (!local) {
    if (action === "status") sendSyncJson(res, 200, { mode: "remote" });
    else sendSyncJson(res, 404, { ok: false, error: "This server runs in remote mode." });
    return true;
  }
  try {
    if (action === "status") sendSyncJson(res, 200, await local.status());
    else if (action === "conflicts") sendSyncJson(res, 200, { conflicts: local.conflictList() });
    else sendSyncJson(res, 200, await (action === "push" ? local.push(notify) : local.pull(notify)));
  } catch (error) {
    if (error instanceof LocalSyncError) sendSyncJson(res, error.status, { ok: false, code: error.code, error: error.message });
    else {
      console.error("[local-sync]", error);
      sendSyncJson(res, 502, { ok: false, code: "SYNC_FAILED", error: "Could not apply synchronization." });
    }
  }
  return true;
}

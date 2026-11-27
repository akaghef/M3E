import type { IncomingMessage, ServerResponse } from "http";
import type { RecordWorkspaceStore } from "./store";

/** Full canonical baseline, or only the current records named by a retained change chain. */
export function handleMapRecordsHttp(req: IncomingMessage, res: ServerResponse, store: RecordWorkspaceStore | null): boolean {
  const url = new URL(req.url ?? "/", "http://localhost");
  const match = url.pathname.match(/^\/api\/maps\/([^/]+)\/records$/);
  if (!match) return false;
  const send = (status: number, body: unknown): void => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(body));
  };
  if (req.method !== "GET") { send(405, { error: "Method not allowed." }); return true; }
  if (!store) { send(409, { code: "FULL_READ_REQUIRED", fullReadRequired: true, reason: "record-store-unavailable" }); return true; }
  let mapId: string;
  try { mapId = decodeURIComponent(match[1]); }
  catch { send(400, { error: "Invalid map id." }); return true; }
  const since = url.searchParams.get("since") ?? undefined;
  const result = store.readMapRecords(mapId, since);
  if (result === null) send(409, { code: "FULL_READ_REQUIRED", fullReadRequired: true, mapId, ...store.mapChanges.cursor(mapId, store.seq()) });
  else if (result === undefined) send(404, { code: "NOT_FOUND", mapId });
  else send(200, result);
  return true;
}

export function mapRecordChangeFrame(payload: object): string {
  return `event: map_updated\ndata: ${JSON.stringify(payload)}\n\n`;
}

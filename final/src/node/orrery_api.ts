import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { isIP } from "node:net";
import type { OrrerySnapshotReader } from "../shared/orrery_seam_interface";

function isLoopback(address: string): boolean {
  const ipv4 = address.startsWith("::ffff:") ? address.slice(7) : address;
  return address === "::1" || (isIP(ipv4) === 4 && ipv4.startsWith("127."));
}

/** Private observations are local-only; LAN and proxy publication are not supported. */
function isLocalObservationRequest(req: IncomingMessage): boolean {
  if (!isLoopback(req.socket.remoteAddress ?? "")) return false;
  const host = req.headers.host;
  if (!host || /[\s/@\\?#]/.test(host)) return false;
  try {
    const url = new URL(`http://${host}`);
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    if (hostname !== "localhost" && !isLoopback(hostname)) return false;
    if (Number(url.port || 80) !== req.socket.localPort) return false;
    const origin = req.headers.origin;
    if (origin !== undefined && origin !== url.origin) return false;
    const site = req.headers["sec-fetch-site"];
    return site === undefined || site === "same-origin" || site === "none";
  } catch { return false; }
}

/** Server-owned SSE clients; shutdown closes streams before Server.close waits for them. */
export function createOrreryApi(reader: OrrerySnapshotReader) {
  const clients = new Set<() => void>();
  let closed = false;
  function close(): void { closed = true; for (const cleanup of [...clients]) cleanup(); reader.close(); }
  return {
    close,
    attach(server: Server): void {
      const originalClose = server.close;
      server.close = function (...args: Parameters<Server["close"]>) { close(); return originalClose.apply(this, args); };
      server.once("close", close);
    },
    handle(req: IncomingMessage, res: ServerResponse): boolean {
      const pathname = (req.url ?? "/").split("?", 1)[0];
      if (!pathname.startsWith("/api/orrery/")) return false;
      const json = (status: number, value: unknown) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(value)); };
      if (!isLocalObservationRequest(req)) { json(403, { error: "orrery_local_only" }); return true; }
      if (req.method !== "GET") { res.setHeader("Allow", "GET"); json(405, { error: "orrery_read_only" }); return true; }
      if (pathname !== "/api/orrery/runtime" && pathname !== "/api/orrery/events") { json(404, { error: "orrery_endpoint_unavailable" }); return true; }
      if (closed) { json(503, { error: "orrery_closed" }); return true; }
      if (pathname === "/api/orrery/runtime") { json(200, reader.snapshot()); return true; }
      if (clients.size >= 64) { json(503, { error: "orrery_client_limit" }); return true; }
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" });
      let stopped = false;
      let unsubscribe = () => {};
      const cleanup = () => { if (stopped) return; stopped = true; clearInterval(heartbeat); unsubscribe(); clients.delete(cleanup); res.end(); };
      const send = (snapshot: ReturnType<OrrerySnapshotReader["snapshot"]>) => {
        if (stopped) return;
        // Disconnect slow consumers instead of retaining an unbounded event queue.
        if (res.writableLength > 1024 * 1024) { cleanup(); return; }
        res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
      };
      const heartbeat = setInterval(() => { if (!res.write(": heartbeat\n\n")) cleanup(); }, 15000);
      heartbeat.unref();
      clients.add(cleanup);
      res.once("close", cleanup);
      res.once("error", cleanup);
      unsubscribe = reader.subscribe(send);
      send(reader.snapshot());
      return true;
    },
  };
}

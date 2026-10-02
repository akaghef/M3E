import http from "node:http";
import { afterEach, expect, it, vi } from "vitest";
import { createOrreryApi } from "../../src/node/orrery_api";
import { emptyOrrerySnapshot } from "../../src/shared/orrery_observation";
const servers: http.Server[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve())))); });
async function setup() {
  const listeners = new Set<Function>();
  const reader = { snapshot: () => emptyOrrerySnapshot(), subscribe: (listener: Function) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, close: vi.fn() };
  const api = createOrreryApi(reader);
  const server = http.createServer((req, res) => { if (!api.handle(req, res)) { res.statusCode = 404; res.end(); } });
  api.attach(server); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`;
  return { url, reader, listeners, server };
}
it("serves snapshots and rejects every mutation and command endpoint", async () => {
  const f = await setup();
  expect((await (await fetch(`${f.url}/api/orrery/runtime`)).json()).schema).toBe("m3e.orrery.v1");
  for (const route of ["runtime", "events", "commands"]) for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const response = await fetch(`${f.url}/api/orrery/${route}`, { method });
    expect(response.status).toBe(405); expect(await response.json()).toEqual({ error: "orrery_read_only" });
  }
  expect((await fetch(`${f.url}/api/orrery/commands`)).status).toBe(404);
});
it("streams initial and changed snapshots, removes disconnected clients, closes active streams with server", async () => {
  const f = await setup(); const controller = new AbortController();
  const response = await fetch(`${f.url}/api/orrery/events`, { signal: controller.signal }); const stream = response.body!.getReader();
  expect(new TextDecoder().decode((await stream.read()).value)).toContain("event: snapshot");
  for (const listener of f.listeners) listener({ ...emptyOrrerySnapshot(), revision: "changed" });
  expect(new TextDecoder().decode((await stream.read()).value)).toContain('"revision":"changed"');
  controller.abort(); await vi.waitFor(() => expect(f.listeners.size).toBe(0));
  const active = await fetch(`${f.url}/api/orrery/events`); const activeReader = active.body!.getReader(); await activeReader.read();
  await new Promise<void>(resolve => f.server.close(() => resolve()));
  expect(f.listeners.size).toBe(0); expect(f.reader.close).toHaveBeenCalled(); expect((await activeReader.read()).done).toBe(true);
});

it("allows same-origin local clients and rejects cross-site requests on both read routes", async () => {
  const f = await setup();
  expect((await fetch(`${f.url}/api/orrery/runtime`, { headers: { Origin: f.url, "Sec-Fetch-Site": "same-origin" } })).status).toBe(200);
  for (const route of ["runtime", "events"]) {
    for (const headers of [
      { Host: "attacker.example" },
      { Origin: "https://attacker.example" },
      { Origin: "null" },
      { Origin: "http://localhost:1234" },
      { "Sec-Fetch-Site": "cross-site" },
      { "Sec-Fetch-Site": "same-site" },
    ]) {
      // Use node:http because Fetch may normalize/replace the Host header.
      const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        http.get(`${f.url}/api/orrery/${route}`, { headers }, res => {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", chunk => { body += chunk; });
          res.on("end", () => resolve({ status: res.statusCode!, body }));
          res.on("error", reject);
        }).on("error", reject);
      });
      expect(response.status, JSON.stringify(headers)).toBe(403);
      expect(JSON.parse(response.body)).toEqual({ error: "orrery_local_only" });
    }
  }
  expect(f.listeners.size).toBe(0);
});

it("requires a loopback peer and matching local authority before exposing observations", () => {
  const reader = { snapshot: vi.fn(() => emptyOrrerySnapshot()), subscribe: vi.fn(() => () => {}), close: vi.fn() };
  const api = createOrreryApi(reader);
  for (const [remoteAddress, host, expected] of [
    ["127.0.0.1", "localhost:4173", 200],
    ["::1", "[::1]:4173", 200],
    ["::ffff:127.0.0.1", "127.0.0.1:4173", 200],
    ["192.168.1.20", "localhost:4173", 403],
    ["::ffff:192.168.1.20", "localhost:4173", 403],
    ["127.0.0.1", "rebound.example:4173", 403],
    ["127.0.0.1", "localhost:8770", 403],
    ["127.0.0.1", "user@localhost:4173", 403],
    ["127.0.0.1", "localhost:4173/", 403],
    ["127.0.0.1", undefined, 403],
  ] as const) {
    reader.snapshot.mockClear();
    const req = { url: "/api/orrery/runtime", method: "GET", headers: { host }, socket: { remoteAddress, localPort: 4173 } } as unknown as http.IncomingMessage;
    const res = { writeHead: vi.fn(), end: vi.fn() };
    expect(api.handle(req, res as unknown as http.ServerResponse)).toBe(true);
    expect(res.writeHead.mock.calls[0][0]).toBe(expected);
    expect(reader.snapshot).toHaveBeenCalledTimes(expected === 200 ? 1 : 0);
  }
});

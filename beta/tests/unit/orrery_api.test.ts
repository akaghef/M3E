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

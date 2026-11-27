import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { listenViewer, viewerListenOptions } from "../../src/node/remote_access";
import { createAppServer } from "../../src/node/start_viewer";
let dir: string;
let servers: http.Server[];
let children: ChildProcess[];
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-sock-")); servers = []; children = [];
  vi.stubEnv("M3E_DATA_DIR", dir); vi.stubEnv("M3E_STORE_DIR", undefined); vi.stubEnv("M3E_SYNC_REMOTE", undefined);
  vi.stubEnv("M3E_TAILSCALE_USERS", "beta@example.test"); vi.stubEnv("M3E_ORRERY_SOURCES", undefined); vi.stubEnv("M3E_CLOUD_SYNC", "0");
});
afterEach(async () => {
  for (const child of children) if (child.exitCode === null && child.signalCode === null) {
    const done = once(child, "exit"); child.kill("SIGKILL"); await done;
  }
  for (const server of servers) { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
  vi.unstubAllEnvs(); fs.rmSync(dir, { recursive: true, force: true });
});
function request(options: http.RequestOptions): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get({ ...options, agent: false }, async (res) => {
      // Decode once: socket and TCP split chunks at different bytes, inside multibyte characters.
      const chunks: Buffer[] = []; for await (const chunk of res) chunks.push(chunk as Buffer);
      resolve({ status: res.statusCode!, body: Buffer.concat(chunks).toString("utf8") });
    }).once("error", reject);
  });
}
const headers = { Host: "mini.tail1234.ts.net", "Tailscale-User-Login": "beta@example.test" };
test("socket option replaces TCP host and port", () => {
  vi.stubEnv("M3E_LISTEN_SOCKET", path.join(dir, "remote.sock"));
  expect(viewerListenOptions(4173, "127.0.0.1")).toEqual({ path: path.join(dir, "remote.sock") });
});
test("socket accepts the same routes and origins as TCP, mode 0600, and removes itself on close", async () => {
  const tcp = createAppServer(); servers.push(tcp);
  await new Promise<void>((resolve, reject) => { tcp.once("error", reject); tcp.listen(0, "127.0.0.1", resolve); });
  const port = (tcp.address() as net.AddressInfo).port;
  const socketPath = path.join(dir, "remote.sock"); vi.stubEnv("M3E_LISTEN_SOCKET", socketPath);
  const app = createAppServer(); servers.push(app);
  await listenViewer(app, port, () => {});
  expect(app.address()).toBe(socketPath);
  expect(fs.statSync(socketPath).mode & 0o777).toBe(0o600);
  for (const route of ["/api/sync/local/status", "/api/mcp/docs?name=glossary", "/home.html"]) {
    for (const supplied of [headers, { ...headers, Origin: "https://mini.tail1234.ts.net" }, { ...headers, Origin: "https://foreign.example" }, {}]) {
      expect(await request({ socketPath, path: route, headers: supplied })).toEqual(
        await request({ host: "127.0.0.1", port, path: route, headers: supplied }));
    }
  }
  await new Promise<void>((resolve) => app.close(() => resolve()));
  expect(fs.existsSync(socketPath)).toBe(false);
});
test("refuses ordinary files and active sockets without deleting them", async () => {
  const socketPath = path.join(dir, "remote.sock"); vi.stubEnv("M3E_LISTEN_SOCKET", socketPath);
  fs.writeFileSync(socketPath, "keep");
  const a = http.createServer(); servers.push(a);
  await expect(listenViewer(a, 0, () => {})).rejects.toThrow("not a socket");
  expect(fs.readFileSync(socketPath, "utf8")).toBe("keep"); fs.unlinkSync(socketPath);
  await listenViewer(a, 0, () => {});
  const inode = fs.statSync(socketPath).ino;
  const b = http.createServer(); servers.push(b);
  await expect(listenViewer(b, 0, () => {})).rejects.toThrow("already in use");
  expect(fs.statSync(socketPath).ino).toBe(inode);
});
test("start_viewer uses only the socket, recovers stale sockets and cleans up on SIGTERM", async () => {
  const socketPath = path.join(dir, "remote.sock");
  const probe = net.createServer();
  await new Promise<void>((resolve, reject) => { probe.once("error", reject); probe.listen(0, "127.0.0.1", resolve); });
  const port = (probe.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  const start = async () => {
    const child = spawn(process.execPath, [path.resolve(__dirname, "../../dist/node/start_viewer.js")], {
      cwd: path.resolve(__dirname, "../.."), env: { ...process.env, M3E_LISTEN_SOCKET: socketPath, M3E_PORT: String(port), M3E_HOST: "127.0.0.1", M3E_OPEN_BROWSER: "0", M3E_AUTO_SYNC: "0", M3E_SKIP_SAMPLE_GENERATION: "1" }, stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(child);
    await new Promise<void>((resolve, reject) => {
      let output = "";
      const timeout = setTimeout(() => reject(new Error(output || "startup watchdog")), 15000);
      child.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`exit ${code}: ${output}`)); });
      const read = (chunk: Buffer) => { output += String(chunk); if (output.includes("Viewer ready:")) { clearTimeout(timeout); resolve(); } };
      child.stdout!.on("data", read); child.stderr!.on("data", read);
    });
    return child;
  };
  const first = await start();
  expect(await request({ socketPath, path: "/api/sync/local/status", headers })).toMatchObject({ status: 200 });
  await expect(request({ host: "127.0.0.1", port, path: "/", headers })).rejects.toMatchObject({ code: "ECONNREFUSED" });
  expect(fs.statSync(socketPath).mode & 0o777).toBe(0o600);
  let exited = once(first, "exit"); first.kill("SIGKILL"); await exited;
  expect(fs.existsSync(socketPath)).toBe(true);
  const second = await start();
  expect(await request({ socketPath, path: "/api/sync/local/status", headers })).toMatchObject({ status: 200 });
  exited = once(second, "exit"); second.kill("SIGTERM"); await exited;
  expect(fs.existsSync(socketPath)).toBe(false);
}, 45000);

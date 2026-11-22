import fs from "node:fs";
import { get, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { allowedLogin, viewerListenOptions } from "../../src/node/remote_access";
import { createAppServer } from "../../src/node/start_viewer";

let server: Server | undefined;
let tempDir: string | undefined;

async function start(users: string | undefined): Promise<string> {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-remote-access-"));
  vi.stubEnv("M3E_DATA_DIR", tempDir);
  vi.stubEnv("M3E_STORE_DIR", undefined);
  vi.stubEnv("M3E_TAILSCALE_USERS", users);
  vi.stubEnv("M3E_ORRERY_SOURCES", undefined);
  vi.stubEnv("M3E_CLOUD_SYNC", "0");
  const app = server = createAppServer();
  await new Promise<void>((resolve, reject) => {
    app.once("error", reject);
    app.listen(0, "127.0.0.1", resolve);
  });
  return `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
}

async function readJson(url: string, headers: Record<string, string> = {}) {
  return new Promise<{ status: number | undefined; body: unknown }>((resolve, reject) => {
    get(url, { headers }, async (res) => {
      try {
        let text = "";
        res.setEncoding("utf8");
        for await (const chunk of res) text += chunk;
        resolve({ status: res.statusCode, body: JSON.parse(text) });
      } catch (error) {
        reject(error);
      }
    }).once("error", reject);
  });
}

afterEach(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  }
  vi.unstubAllEnvs();
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

it("passes M3E_HOST to the viewer listener and leaves host unspecified by default", () => {
  vi.stubEnv("M3E_HOST", "127.0.0.1");
  expect(viewerListenOptions(4173)).toEqual({ port: 4173, host: "127.0.0.1" });
  vi.stubEnv("M3E_HOST", undefined);
  expect(viewerListenOptions(4173)).toEqual({ port: 4173 });
});

it("matches a single trimmed login against a configured list", () => {
  expect(allowedLogin(undefined, undefined)).toBe(true);
  expect(allowedLogin(" beta@example.test ", "alpha@example.test, beta@example.test ")).toBe(true);
  expect(allowedLogin("other-beta@example.test", "beta@example.test")).toBe(false);
  expect(allowedLogin("beta@example.test, other@example.test", "beta@example.test")).toBe(false);
  expect(allowedLogin(["beta@example.test", "beta@example.test"], "beta@example.test")).toBe(false);
  expect(allowedLogin(" ", " , ")).toBe(false);
  expect(allowedLogin("beta@example.test", "")).toBe(false);
});

it("denies static and watch requests at ingress and lets the allowed login reach SSE", async () => {
  const url = await start("beta@example.test");
  const watch = `${url}/api/maps/fixture/watch`;
  expect(await readJson(`${url}/`)).toEqual({
    status: 403, body: { ok: false, code: "FORBIDDEN", error: expect.any(String) },
  });
  expect(await readJson(watch, { "Tailscale-User-Login": "other@example.test" })).toMatchObject({
    status: 403, body: { ok: false, code: "FORBIDDEN" },
  });
  const response = await fetch(watch, { headers: { "Tailscale-User-Login": "beta@example.test" } });
  try {
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
  } finally {
    await response.body?.cancel();
  }
});

it("admits the MCP adapter behind Serve and rejects a foreign browser Origin", async () => {
  const url = `${await start("beta@example.test")}/api/mcp/docs?name=glossary`;
  const headers = { Host: "mini.tail1234.ts.net", "Tailscale-User-Login": "beta@example.test" };
  expect(await readJson(url, headers)).toMatchObject({ status: 200, body: { ok: true, name: "glossary" } });
  expect(await readJson(url, { ...headers, Origin: "https://mini.tail1234.ts.net" })).toMatchObject({ status: 200 });
  expect(await readJson(url, { ...headers, Origin: "https://foreign.example" })).toMatchObject({ status: 403 });
});

it("keeps loopback MCP working and rejects a remote Host when the gate is unset", async () => {
  const url = `${await start(undefined)}/api/mcp/docs?name=glossary`;
  expect(await readJson(url)).toMatchObject({ status: 200, body: { ok: true } });
  expect(await readJson(url, { Host: "mini.tail1234.ts.net", "Tailscale-User-Login": "beta@example.test" })).toMatchObject({ status: 403 });
});

describe("movedToRemote", () => {
  it("returns the remote URL when the marker exists, null otherwise", async () => {
    const { movedToRemote } = await import("../../src/node/remote_access");
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "m3e-moved-"));
    expect(movedToRemote(dir)).toBeNull();
    fs.writeFileSync(path.join(dir, "moved-to-remote.json"), JSON.stringify({ url: "https://mini.tail1.ts.net" }));
    expect(movedToRemote(dir)).toBe("https://mini.tail1.ts.net");
    fs.writeFileSync(path.join(dir, "moved-to-remote.json"), "{");
    expect(movedToRemote(dir)).toBe("(remote URL not readable)");
  });
});

describe("plugin runtimeConfig API URL", () => {
  it("accepts loopback and HTTPS *.ts.net, rejects other hosts and plain HTTP on ts.net", async () => {
    const os = await import("node:os");
    const { runtimeConfig } = await import("../../../plugins/m3e/scripts/runtime.mjs");
    const env = (url: string) => ({ M3E_HOME: os.tmpdir() + "/m3e-no-config", M3E_API_URL: url });
    await expect(runtimeConfig(env("http://127.0.0.1:4173"))).resolves.toMatchObject({ apiUrl: "http://127.0.0.1:4173" });
    await expect(runtimeConfig(env("https://mini.tail1.ts.net"))).resolves.toMatchObject({ apiUrl: "https://mini.tail1.ts.net" });
    await expect(runtimeConfig(env("http://mini.tail1.ts.net"))).rejects.toThrow();
    await expect(runtimeConfig(env("https://example.com"))).rejects.toThrow();
  });
});

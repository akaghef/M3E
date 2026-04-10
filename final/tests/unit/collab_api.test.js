"use strict";

import { describe, it, expect, beforeAll, afterAll } from "vitest";
const http = require("http");

const { createAppServer } = require("../../dist/node/start_viewer");

let server;
let baseUrl;

async function request(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          // not json
        }
        resolve({ status: res.statusCode, json, text, headers: res.headers });
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Only run these tests when M3E_COLLAB=1
const COLLAB_ENABLED = process.env.M3E_COLLAB === "1";

describe("Collab API", { skip: !COLLAB_ENABLED }, () => {
  beforeAll(async () => {
    server = createAppServer();
    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(() => {
    server?.close();
  });

  it("register returns entityId and token", async () => {
    const res = await request("POST", "/api/collab/register", {
      displayName: "test-human",
      role: "human",
      capabilities: ["read", "write"],
    });
    expect(res.status).toBe(200);
    expect(res.json.ok).toBe(true);
    expect(res.json.entityId.startsWith("e_")).toBe(true);
    expect(res.json.token.startsWith("tok_")).toBe(true);
    expect(res.json.priority).toBe(100);
  });

  it("register rejects invalid role", async () => {
    const res = await request("POST", "/api/collab/register", {
      displayName: "bad",
      role: "superadmin",
    });
    expect(res.status).toBe(400);
  });

  it("unauthenticated request returns 401", async () => {
    const res = await request("POST", "/api/collab/heartbeat", {});
    expect(res.status).toBe(401);
  });

  it("authenticated heartbeat succeeds", async () => {
    const reg = await request("POST", "/api/collab/register", {
      displayName: "hb-test",
      role: "ai",
    });
    const token = reg.json.token;

    const res = await request("POST", "/api/collab/heartbeat", { lockIds: [] }, {
      Authorization: `Bearer ${token}`,
    });
    expect(res.status).toBe(200);
    expect(res.json.ok).toBe(true);
  });

  it("scope lock acquire and release", async () => {
    const reg = await request("POST", "/api/collab/register", {
      displayName: "locker",
      role: "human",
    });
    const token = reg.json.token;
    const auth = { Authorization: `Bearer ${token}` };

    // Acquire
    const lockRes = await request("POST", "/api/collab/scope/folder_123/lock", null, auth);
    expect(lockRes.status).toBe(200);
    expect(lockRes.json.ok).toBe(true);
    expect(lockRes.json.lockId.startsWith("lock_")).toBe(true);
    expect(lockRes.json.expiresAt).toBeTruthy();

    // Release
    const releaseRes = await request("DELETE", "/api/collab/scope/folder_123/lock", null, auth);
    expect(releaseRes.status).toBe(200);
    expect(releaseRes.json.ok).toBe(true);
  });

  it("higher priority preempts lock", async () => {
    // AI registers and locks
    const aiReg = await request("POST", "/api/collab/register", {
      displayName: "ai-worker",
      role: "ai",
    });
    const aiAuth = { Authorization: `Bearer ${aiReg.json.token}` };
    await request("POST", "/api/collab/scope/scope_preempt/lock", null, aiAuth);

    // Human registers and preempts
    const humanReg = await request("POST", "/api/collab/register", {
      displayName: "human-boss",
      role: "human",
    });
    const humanAuth = { Authorization: `Bearer ${humanReg.json.token}` };
    const preemptRes = await request("POST", "/api/collab/scope/scope_preempt/lock", null, humanAuth);
    expect(preemptRes.status).toBe(200);
    expect(preemptRes.json.ok).toBe(true);
  });

  it("lower priority cannot preempt lock", async () => {
    // Human locks
    const humanReg = await request("POST", "/api/collab/register", {
      displayName: "human-holder",
      role: "human",
    });
    const humanAuth = { Authorization: `Bearer ${humanReg.json.token}` };
    await request("POST", "/api/collab/scope/scope_no_preempt/lock", null, humanAuth);

    // AI tries to lock -> 409
    const aiReg = await request("POST", "/api/collab/register", {
      displayName: "ai-blocked",
      role: "ai",
    });
    const aiAuth = { Authorization: `Bearer ${aiReg.json.token}` };
    const failRes = await request("POST", "/api/collab/scope/scope_no_preempt/lock", null, aiAuth);
    expect(failRes.status).toBe(409);
  });

  it("entities list returns active entities", async () => {
    const reg = await request("POST", "/api/collab/register", {
      displayName: "lister",
      role: "ai-supervised",
    });
    const auth = { Authorization: `Bearer ${reg.json.token}` };

    const res = await request("GET", "/api/collab/entities/test-doc", null, auth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json.entities)).toBe(true);
    expect(res.json.entities.length > 0).toBe(true);
  });

  it("unregister removes entity", async () => {
    const reg = await request("POST", "/api/collab/register", {
      displayName: "to-remove",
      role: "ai",
    });
    const auth = { Authorization: `Bearer ${reg.json.token}` };

    const res = await request("DELETE", "/api/collab/unregister", null, auth);
    expect(res.status).toBe(200);

    // Subsequent request should fail
    const hb = await request("POST", "/api/collab/heartbeat", {}, auth);
    expect(hb.status).toBe(401);
  });

  it("SSE endpoint returns event-stream headers", async () => {
    const reg = await request("POST", "/api/collab/register", {
      displayName: "sse-test",
      role: "human",
    });

    // Use raw http to check headers without waiting for body to complete
    await new Promise((resolve, reject) => {
      const url = new URL("/api/collab/events/test-doc", baseUrl);
      const req = http.request(
        {
          method: "GET",
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          headers: { Authorization: `Bearer ${reg.json.token}` },
        },
        (res) => {
          expect(res.headers["content-type"]).toBe("text/event-stream");
          res.destroy(); // Close immediately, don't wait for stream
          resolve();
        },
      );
      req.on("error", reject);
      req.end();
    });
  });
});

describe("Collab API disabled", { skip: COLLAB_ENABLED }, () => {
  beforeAll(async () => {
    server = createAppServer();
    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(() => {
    server?.close();
  });

  it("collab endpoints return 404 when disabled", async () => {
    const res = await request("POST", "/api/collab/register", {
      displayName: "test",
      role: "human",
    });
    expect(res.status).toBe(404);
  });
});

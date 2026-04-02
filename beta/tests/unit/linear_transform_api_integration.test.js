const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const { createAppServer } = require("../../dist/node/start_viewer.js");

let appServer;
let providerServer;
let appBaseUrl;
let providerBaseUrl;

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

test.before(async () => {
  providerServer = http.createServer(async (req, res) => {
    if (req.url !== "/chat/completions" || req.method !== "POST") {
      res.statusCode = 404;
      res.end("not found");
      return;
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const userMessage = body.messages.find((message) => message.role === "user");

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({
      choices: [
        {
          message: {
            content: `stubbed-transform:${userMessage.content.includes("tree-to-linear") ? "ttl" : "ltt"}`,
          },
        },
      ],
    }));
  });
  await new Promise((resolve) => {
    providerServer.listen(0, "127.0.0.1", resolve);
  });
  const providerAddress = providerServer.address();
  providerBaseUrl = `http://127.0.0.1:${providerAddress.port}`;

  appServer = createAppServer();
  await new Promise((resolve) => {
    appServer.listen(0, "127.0.0.1", resolve);
  });
  const appAddress = appServer.address();
  appBaseUrl = `http://127.0.0.1:${appAddress.port}`;
});

test.after(async () => {
  delete process.env.M3E_AI_ENABLED;
  delete process.env.M3E_AI_PROVIDER;
  delete process.env.M3E_AI_TRANSPORT;
  delete process.env.M3E_AI_BASE_URL;
  delete process.env.M3E_AI_API_KEY;
  delete process.env.M3E_AI_MODEL;

  if (appServer) {
    await new Promise((resolve, reject) => {
      appServer.close((err) => err ? reject(err) : resolve());
    });
  }
  if (providerServer) {
    await new Promise((resolve, reject) => {
      providerServer.close((err) => err ? reject(err) : resolve());
    });
  }
});

test("linear transform status returns disabled when subagent is off", async () => {
  delete process.env.M3E_AI_ENABLED;
  delete process.env.M3E_AI_BASE_URL;
  delete process.env.M3E_AI_API_KEY;
  delete process.env.M3E_AI_MODEL;

  const result = await requestJson(`${appBaseUrl}/api/linear-transform/status`);
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.ok, true);
  assert.equal(result.payload.enabled, false);
  assert.equal(result.payload.configured, false);
});

test("linear transform convert proxies request to configured subagent", async () => {
  process.env.M3E_AI_ENABLED = "1";
  process.env.M3E_AI_PROVIDER = "deepseek";
  process.env.M3E_AI_TRANSPORT = "openai-compatible";
  process.env.M3E_AI_BASE_URL = providerBaseUrl;
  process.env.M3E_AI_API_KEY = "test-key";
  process.env.M3E_AI_MODEL = "deepseek-chat";

  const status = await requestJson(`${appBaseUrl}/api/linear-transform/status`);
  assert.equal(status.response.status, 200);
  assert.equal(status.payload.enabled, true);
  assert.equal(status.payload.configured, true);
  assert.equal(status.payload.provider, "deepseek");

  const converted = await requestJson(`${appBaseUrl}/api/linear-transform/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      direction: "tree-to-linear",
      sourceText: "- id: root\n  text: \"Root\"",
      scopeRootId: "root",
      scopeLabel: "Root",
    }),
  });
  assert.equal(converted.response.status, 200);
  assert.equal(converted.payload.ok, true);
  assert.equal(converted.payload.direction, "tree-to-linear");
  assert.equal(converted.payload.provider, "deepseek");
  assert.equal(converted.payload.model, "deepseek-chat");
  assert.equal(converted.payload.outputText, "stubbed-transform:ttl");
});

test("linear transform convert returns 503 when provider config is incomplete", async () => {
  process.env.M3E_AI_ENABLED = "1";
  process.env.M3E_AI_PROVIDER = "deepseek";
  process.env.M3E_AI_TRANSPORT = "openai-compatible";
  delete process.env.M3E_AI_BASE_URL;
  delete process.env.M3E_AI_API_KEY;
  delete process.env.M3E_AI_MODEL;

  const converted = await requestJson(`${appBaseUrl}/api/linear-transform/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      direction: "linear-to-tree",
      sourceText: "Root\n  Child",
    }),
  });
  assert.equal(converted.response.status, 503);
  assert.equal(converted.payload.ok, false);
  assert.equal(converted.payload.code, "LINEAR_TRANSFORM_FAILED");
  assert.match(converted.payload.error, /not fully configured/);
});

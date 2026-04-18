import { test, expect, beforeAll, afterAll } from "vitest";
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

beforeAll(async () => {
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
    const content = userMessage.content.includes("Topic generation request:")
      ? JSON.stringify({ topics: ["Root cause", "Alternative design", "Validation steps"] })
      : `stubbed-transform:${userMessage.content.includes("tree-to-linear") ? "ttl" : "ltt"}`;
    res.end(JSON.stringify({
      choices: [
        {
          message: {
            content,
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

afterAll(async () => {
  delete process.env.M3E_AI_ENABLED;
  delete process.env.M3E_AI_PROVIDER;
  delete process.env.M3E_AI_GATEWAY;
  delete process.env.M3E_AI_TRANSPORT;
  delete process.env.M3E_AI_BASE_URL;
  delete process.env.M3E_AI_API_KEY;
  delete process.env.M3E_AI_MODEL;
  delete process.env.M3E_AI_DEFAULT_MODEL_ALIAS;
  delete process.env.M3E_AI_MODEL_REGISTRY_JSON;

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

test("linear transform status returns disabled when subagent is explicitly opted out", async () => {
  process.env.M3E_AI_ENABLED = "0";
  delete process.env.M3E_AI_BASE_URL;
  delete process.env.M3E_AI_API_KEY;
  delete process.env.M3E_AI_MODEL;

  const result = await requestJson(`${appBaseUrl}/api/linear-transform/status`);
  expect(result.response.status).toBe(200);
  expect(result.payload.ok).toBe(true);
  expect(result.payload.enabled).toBe(false);
  expect(result.payload.configured).toBe(false);
});

test("linear transform convert proxies request to configured subagent", async () => {
  process.env.M3E_AI_ENABLED = "1";
  process.env.M3E_AI_PROVIDER = "deepseek";
  process.env.M3E_AI_TRANSPORT = "openai-compatible";
  process.env.M3E_AI_BASE_URL = providerBaseUrl;
  process.env.M3E_AI_API_KEY = "test-key";
  process.env.M3E_AI_MODEL = "deepseek-chat";

  const status = await requestJson(`${appBaseUrl}/api/ai/status`);
  expect(status.response.status).toBe(200);
  expect(status.payload.ok).toBe(true);
  expect(status.payload.enabled).toBe(true);
  expect(status.payload.configured).toBe(true);
  expect(status.payload.provider).toBe("deepseek");
  expect(status.payload.features["linear-transform"].available).toBe(true);
  expect(status.payload.features["topic-suggest"].available).toBe(true);

  const converted = await requestJson(`${appBaseUrl}/api/ai/subagent/linear-transform`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      mapId: "rapid-main",
      scopeId: "root",
      mode: "direct-result",
      input: {
        direction: "tree-to-linear",
        sourceText: "- id: root\n  text: \"Root\"",
        scopeLabel: "Root",
      },
    }),
  });
  expect(converted.response.status).toBe(200);
  expect(converted.payload.ok).toBe(true);
  expect(converted.payload.subagent).toBe("linear-transform");
  expect(converted.payload.provider).toBe("deepseek");
  expect(converted.payload.model).toBe("deepseek-chat");
  expect(converted.payload.requiresApproval).toBe(false);
  expect(converted.payload.proposal.kind).toBe("text-transform");
  expect(converted.payload.proposal.result.outputText).toBe("stubbed-transform:ttl");

  const compatibility = await requestJson(`${appBaseUrl}/api/linear-transform/convert`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      direction: "tree-to-linear",
      sourceText: "- id: root\n  text: \"Root\"",
      scopeRootId: "root",
      scopeLabel: "Root",
    }),
  });
  expect(compatibility.response.status).toBe(200);
  expect(compatibility.payload.outputText).toBe("stubbed-transform:ttl");
});

test("linear transform convert returns 503 when provider config is incomplete", async () => {
  process.env.M3E_AI_ENABLED = "1";
  process.env.M3E_AI_PROVIDER = "deepseek";
  process.env.M3E_AI_TRANSPORT = "openai-compatible";
  delete process.env.M3E_AI_BASE_URL;
  delete process.env.M3E_AI_API_KEY;
  delete process.env.M3E_AI_MODEL;

  const converted = await requestJson(`${appBaseUrl}/api/ai/subagent/linear-transform`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      mapId: "rapid-main",
      scopeId: "root",
      input: {
        direction: "linear-to-tree",
        sourceText: "Root\n  Child",
      },
    }),
  });
  expect(converted.response.status).toBe(503);
  expect(converted.payload.ok).toBe(false);
  expect(converted.payload.code).toBe("AI_NOT_CONFIGURED");
  expect(converted.payload.error).toMatch(/not fully configured/);
});

test("ai status and subagent resolve model alias from registry", async () => {
  process.env.M3E_AI_ENABLED = "1";
  process.env.M3E_AI_PROVIDER = "litellm";
  process.env.M3E_AI_GATEWAY = "litellm";
  process.env.M3E_AI_TRANSPORT = "openai-compatible";
  process.env.M3E_AI_BASE_URL = providerBaseUrl;
  process.env.M3E_AI_API_KEY = "test-key";
  delete process.env.M3E_AI_MODEL;
  process.env.M3E_AI_DEFAULT_MODEL_ALIAS = "chat.fast";
  process.env.M3E_AI_MODEL_REGISTRY_JSON = JSON.stringify({
    "chat.fast": {
      label: "Fast Cloud",
      kind: "chat",
      privacy: "cloud",
      capabilities: ["streaming"],
      targetModel: "deepseek-chat",
      dataPolicy: "cloud_allowed",
    },
  });

  const status = await requestJson(`${appBaseUrl}/api/ai/status`);
  expect(status.response.status).toBe(200);
  expect(status.payload.ok).toBe(true);
  expect(status.payload.gateway).toBe("litellm");
  expect(status.payload.activeModelAlias).toBe("chat.fast");
  expect(status.payload.model).toBe("deepseek-chat");
  expect(status.payload.availableModelAliases).toEqual(["chat.fast"]);

  const converted = await requestJson(`${appBaseUrl}/api/ai/subagent/linear-transform`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      mapId: "rapid-main",
      scopeId: "root",
      mode: "direct-result",
      modelAlias: "chat.fast",
      input: {
        direction: "tree-to-linear",
        sourceText: "- id: root\n  text: \"Root\"",
      },
    }),
  });

  expect(converted.response.status).toBe(200);
  expect(converted.payload.ok).toBe(true);
  expect(converted.payload.model).toBe("deepseek-chat");
  expect(converted.payload.resolvedModelAlias).toBe("chat.fast");
});

test("ai subagent returns 404 for unsupported subagent", async () => {
  process.env.M3E_AI_ENABLED = "1";
  process.env.M3E_AI_PROVIDER = "deepseek";
  process.env.M3E_AI_TRANSPORT = "openai-compatible";
  process.env.M3E_AI_BASE_URL = providerBaseUrl;
  process.env.M3E_AI_API_KEY = "test-key";
  process.env.M3E_AI_MODEL = "deepseek-chat";

  const response = await requestJson(`${appBaseUrl}/api/ai/subagent/unknown-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      mapId: "rapid-main",
      scopeId: "root",
      input: {},
    }),
  });
  expect(response.response.status).toBe(404);
  expect(response.payload.code).toBe("AI_UNSUPPORTED_SUBAGENT");
});

test("topic suggest subagent returns related topics", async () => {
  process.env.M3E_AI_ENABLED = "1";
  process.env.M3E_AI_PROVIDER = "ollama";
  process.env.M3E_AI_TRANSPORT = "openai-compatible";
  process.env.M3E_AI_BASE_URL = providerBaseUrl;
  process.env.M3E_AI_API_KEY = "ollama";
  process.env.M3E_AI_MODEL = "gemma3:4b";

  const response = await requestJson(`${appBaseUrl}/api/ai/subagent/topic-suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      mapId: "rapid-main",
      scopeId: "root",
      input: {
        nodeText: "AI infra setup",
        nodeDetails: "Need local and cloud routing",
        maxTopics: 3,
      },
    }),
  });

  expect(response.response.status).toBe(200);
  expect(response.payload.ok).toBe(true);
  expect(response.payload.subagent).toBe("topic-suggest");
  expect(response.payload.model).toBe("gemma3:4b");
  expect(response.payload.proposal.result.topics).toEqual([
    "Root cause",
    "Alternative design",
    "Validation steps",
  ]);
});

test("topic suggest subagent parses fenced json response", async () => {
  process.env.M3E_AI_ENABLED = "1";
  process.env.M3E_AI_PROVIDER = "ollama";
  process.env.M3E_AI_TRANSPORT = "openai-compatible";
  process.env.M3E_AI_BASE_URL = providerBaseUrl;
  process.env.M3E_AI_API_KEY = "ollama";
  process.env.M3E_AI_MODEL = "gemma3:4b";

  const originalCreateServer = providerServer;
  await new Promise((resolve, reject) => {
    providerServer.close((err) => err ? reject(err) : resolve());
  });

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
    const content = userMessage.content.includes("Topic generation request:")
      ? "```json\n{\"topics\":[\"栄養成分分析\",\"食品添加物\",\"食品安全規制\"]}\n```"
      : "stubbed-transform:ttl";
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ choices: [{ message: { content } }] }));
  });
  await new Promise((resolve) => providerServer.listen(new URL(providerBaseUrl).port, "127.0.0.1", resolve));

  const response = await requestJson(`${appBaseUrl}/api/ai/subagent/topic-suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      mapId: "rapid-main",
      scopeId: "root",
      input: {
        nodeText: "Research Foods",
        nodeDetails: "Need branch ideas",
        maxTopics: 3,
      },
    }),
  });

  expect(response.response.status).toBe(200);
  expect(response.payload.proposal.result.topics).toEqual([
    "栄養成分分析",
    "食品添加物",
    "食品安全規制",
  ]);
});

"use strict";

import https from "https";
import http from "http";
import { spawnSync } from "child_process";
import type { AiModelConfig, AiMessage, AiChatResponse } from "../shared/ai_types";

// On Windows, bw is installed as bw.cmd; on Unix it's just bw.
const BW_CMD = process.platform === "win32" ? "bw.cmd" : "bw";

export interface BitwardenStatus {
  available: boolean;
  locked: boolean;
}

export function getBitwardenStatus(): BitwardenStatus {
  const result = spawnSync(BW_CMD, ["status"], {
    encoding: "utf8",
    env: process.env,
    timeout: 5000,
  });
  if (result.error || result.status !== 0) {
    return { available: false, locked: true };
  }
  try {
    const parsed = JSON.parse(result.stdout.trim()) as { status?: string };
    return { available: true, locked: parsed.status !== "unlocked" };
  } catch {
    return { available: false, locked: true };
  }
}

export function getBitwardenApiKey(itemId: string): string {
  const result = spawnSync(BW_CMD, ["get", "item", itemId], {
    encoding: "utf8",
    env: process.env,
    timeout: 8000,
  });
  if (result.error || result.status !== 0) {
    const msg = result.stderr?.trim() || result.error?.message || "Bitwarden CLI error";
    throw new Error(msg);
  }
  let item: { login?: { password?: string } };
  try {
    item = JSON.parse(result.stdout.trim()) as { login?: { password?: string } };
  } catch {
    throw new Error("Failed to parse Bitwarden item JSON");
  }
  const key = item?.login?.password;
  if (!key) {
    throw new Error(`Bitwarden item "${itemId}" has no password field`);
  }
  return key;
}

export async function callAiModel(
  config: AiModelConfig,
  messages: AiMessage[],
  apiKey: string,
  maxTokens = 1024,
): Promise<AiChatResponse> {
  if (config.provider === "anthropic") {
    return callAnthropic(config.modelId, messages, apiKey, maxTokens);
  }
  if (config.provider === "openai" || config.provider === "custom") {
    return callOpenAiCompat(config.modelId, config.baseUrl ?? "https://api.openai.com", messages, apiKey, maxTokens);
  }
  return { ok: false, error: `Unknown provider: ${config.provider as string}` };
}

function callAnthropic(
  modelId: string,
  messages: AiMessage[],
  apiKey: string,
  maxTokens: number,
): Promise<AiChatResponse> {
  const body = JSON.stringify({ model: modelId, max_tokens: maxTokens, messages });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data) as {
              content?: { text: string }[];
              error?: { message: string };
            };
            if (parsed.error) {
              resolve({ ok: false, error: parsed.error.message });
            } else {
              resolve({ ok: true, content: parsed.content?.[0]?.text ?? "" });
            }
          } catch {
            resolve({ ok: false, error: "Failed to parse Anthropic API response" });
          }
        });
      },
    );
    req.on("error", (err: Error) => resolve({ ok: false, error: err.message }));
    req.write(body);
    req.end();
  });
}

function callOpenAiCompat(
  modelId: string,
  baseUrl: string,
  messages: AiMessage[],
  apiKey: string,
  maxTokens: number,
): Promise<AiChatResponse> {
  const body = JSON.stringify({ model: modelId, max_tokens: maxTokens, messages });
  let url: URL;
  try {
    url = new URL("/v1/chat/completions", baseUrl);
  } catch {
    return Promise.resolve({ ok: false, error: `Invalid baseUrl: ${baseUrl}` });
  }

  const lib = url.protocol === "https:" ? https : http;

  return new Promise((resolve) => {
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port ? Number(url.port) : undefined,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data) as {
              choices?: { message: { content: string } }[];
              error?: { message: string };
            };
            if (parsed.error) {
              resolve({ ok: false, error: parsed.error.message });
            } else {
              resolve({ ok: true, content: parsed.choices?.[0]?.message?.content ?? "" });
            }
          } catch {
            resolve({ ok: false, error: "Failed to parse API response" });
          }
        });
      },
    );
    req.on("error", (err: Error) => resolve({ ok: false, error: err.message }));
    req.write(body);
    req.end();
  });
}

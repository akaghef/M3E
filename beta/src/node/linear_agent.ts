import fs from "fs";
import path from "path";
import { loadAiProviderConfigFromEnv } from "./ai_infra";
import type {
  LinearTransformDirection,
  LinearTransformRequest,
  LinearTransformResponse,
  LinearTransformStatus,
} from "../shared/types";

interface LinearAgentConfig {
  enabled: boolean;
  provider: string | null;
  transport: "openai-compatible" | "mcp";
  baseUrl: string | null;
  apiKey: string | null;
  model: string | null;
  systemPrompt: string;
  directionPrompts: Partial<Record<LinearTransformDirection, string>>;
  mcpServerCommand: string | null;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

const DEFAULT_SYSTEM_PROMPT = [
  "You are a structure conversion subagent.",
  "Convert between M3E tree scope data and linear text.",
  "Follow the caller instruction and return only the requested output.",
].join(" ");

function readTextFileIfExists(filePath: string | undefined): string | null {
  if (!filePath) {
    return null;
  }
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    return null;
  }
  return fs.readFileSync(resolved, "utf8").trim();
}

function promptFileEnvName(direction: LinearTransformDirection): string {
  return direction === "tree-to-linear"
    ? "M3E_LINEAR_TRANSFORM_TREE_TO_LINEAR_PROMPT_FILE"
    : "M3E_LINEAR_TRANSFORM_LINEAR_TO_TREE_PROMPT_FILE";
}

export function loadLinearAgentConfigFromEnv(): LinearAgentConfig {
  const aiConfig = loadAiProviderConfigFromEnv();
  const systemPrompt = readTextFileIfExists(process.env.M3E_LINEAR_TRANSFORM_SYSTEM_PROMPT_FILE)
    ?? process.env.M3E_LINEAR_TRANSFORM_SYSTEM_PROMPT?.trim()
    ?? DEFAULT_SYSTEM_PROMPT;

  const directionPrompts: Partial<Record<LinearTransformDirection, string>> = {};
  (["tree-to-linear", "linear-to-tree"] as const).forEach((direction) => {
    const fromFile = readTextFileIfExists(process.env[promptFileEnvName(direction)]);
    const fromEnv = direction === "tree-to-linear"
      ? process.env.M3E_LINEAR_TRANSFORM_TREE_TO_LINEAR_PROMPT
      : process.env.M3E_LINEAR_TRANSFORM_LINEAR_TO_TREE_PROMPT;
    const prompt = fromFile ?? fromEnv?.trim();
    if (prompt) {
      directionPrompts[direction] = prompt;
    }
  });

  return {
    enabled: aiConfig.enabled,
    provider: aiConfig.provider,
    transport: aiConfig.transport,
    baseUrl: aiConfig.baseUrl,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
    systemPrompt,
    directionPrompts,
    mcpServerCommand: aiConfig.mcpServerCommand,
  };
}

export function getLinearTransformStatus(): LinearTransformStatus {
  const config = loadLinearAgentConfigFromEnv();
  const promptConfigured = Boolean(
    config.directionPrompts["tree-to-linear"] || config.directionPrompts["linear-to-tree"],
  );

  if (!config.enabled) {
    return {
      ok: true,
      enabled: false,
      configured: false,
      provider: config.provider,
      transport: config.transport,
      model: config.model,
      endpoint: config.baseUrl,
      promptConfigured,
      message: "Linear transform subagent is disabled.",
    };
  }

  if (config.transport === "mcp") {
    const configured = Boolean(config.mcpServerCommand);
    return {
      ok: true,
      enabled: true,
      configured,
      provider: config.provider,
      transport: config.transport,
      model: config.model,
      endpoint: config.mcpServerCommand,
      promptConfigured,
      message: configured
        ? "MCP transport is configured but not implemented in this build."
        : "MCP transport selected, but no MCP server command is configured.",
    };
  }

  const configured = Boolean(config.baseUrl && config.apiKey && config.model);
  return {
    ok: true,
    enabled: true,
    configured,
    provider: config.provider,
    transport: config.transport,
    model: config.model,
    endpoint: config.baseUrl,
    promptConfigured,
    message: configured
      ? "OpenAI-compatible linear transform subagent is configured."
      : "Missing base URL, API key, or model for the linear transform subagent.",
  };
}

function buildUserPrompt(request: LinearTransformRequest, config: LinearAgentConfig): string {
  const directionPrompt = config.directionPrompts[request.direction]
    ?? `Convert the provided ${request.direction} input and return only the transformed result.`;
  const scopeId = request.scopeRootId ?? "root";
  const scopeLabel = request.scopeLabel ?? "n/a";
  const instruction = request.instruction?.trim() || "No additional instruction.";
  return [
    directionPrompt,
    "",
    `Direction: ${request.direction}`,
    `Scope root id: ${scopeId}`,
    `Scope label: ${scopeLabel}`,
    `Instruction: ${instruction}`,
    "",
    "Source:",
    request.sourceText,
  ].join("\n");
}

function extractTextContent(payload: ChatCompletionResponse): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => item.text || "")
      .join("")
      .trim();
  }
  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }
  throw new Error("Subagent returned no text content.");
}

async function runOpenAiCompatibleTransform(
  request: LinearTransformRequest,
  config: LinearAgentConfig,
): Promise<LinearTransformResponse> {
  if (!config.baseUrl || !config.apiKey || !config.model) {
    throw new Error("Linear transform subagent is not fully configured.");
  }

  const response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: config.systemPrompt },
        { role: "user", content: buildUserPrompt(request, config) },
      ],
      temperature: 0.2,
    }),
  });

  const payload = await response.json() as ChatCompletionResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || `Subagent request failed with status ${response.status}.`);
  }

  const text = extractTextContent(payload);
  return {
    ok: true,
    direction: request.direction,
    provider: config.provider || "deepseek",
    model: config.model,
    outputText: text,
    rawText: text,
  };
}

export async function runLinearTransform(request: LinearTransformRequest): Promise<LinearTransformResponse> {
  const config = loadLinearAgentConfigFromEnv();
  if (!config.enabled) {
    throw new Error("Linear transform subagent is disabled.");
  }
  if (config.transport === "mcp") {
    throw new Error("MCP transport is not implemented yet.");
  }
  return runOpenAiCompatibleTransform(request, config);
}

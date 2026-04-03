import { getLinearTransformStatus, runLinearTransform } from "./linear_agent";
import { loadAiProviderConfigFromEnv } from "./ai_infra";
import fs from "fs";
import path from "path";
import type {
  AiStatusResponse,
  AiSubagentRequest,
  AiSubagentSuccessResponse,
  LinearTransformRequest,
} from "../shared/types";

type SupportedSubagent = "linear-transform" | "topic-suggest";

interface ChatCompletionResponse {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

const DEFAULT_TOPIC_PROMPT = [
  "You generate related subtopics for the selected M3E node.",
  "Return strict JSON only in this shape: {\"topics\":[\"...\"]}.",
  "Use concise noun phrases, avoid duplicates, and propose 3-6 topics.",
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

function topicSuggestPrompt(): string {
  return readTextFileIfExists(process.env.M3E_TOPIC_SUGGEST_PROMPT_FILE)
    ?? process.env.M3E_TOPIC_SUGGEST_PROMPT?.trim()
    ?? DEFAULT_TOPIC_PROMPT;
}

function isSupportedSubagent(name: string): name is SupportedSubagent {
  return name === "linear-transform" || name === "topic-suggest";
}

export function getAiStatus(): AiStatusResponse {
  const ai = loadAiProviderConfigFromEnv();
  const linear = getLinearTransformStatus();
  const configured = ai.transport === "mcp"
    ? Boolean(ai.mcpServerCommand)
    : Boolean(ai.baseUrl && ai.apiKey && ai.model);

  return {
    ok: true,
    enabled: ai.enabled,
    configured,
    provider: ai.provider,
    transport: ai.transport,
    model: ai.model,
    endpoint: ai.transport === "mcp" ? ai.mcpServerCommand : ai.baseUrl,
    message: configured
      ? "AI infrastructure is configured."
      : ai.enabled
        ? "AI infrastructure is enabled but not fully configured."
        : "AI infrastructure is disabled.",
    features: {
      "linear-transform": {
        available: linear.enabled && linear.configured,
        promptConfigured: linear.promptConfigured,
      },
      "topic-suggest": {
        available: ai.enabled && configured,
        promptConfigured: true,
      },
    },
  };
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(fieldName);
  }
  return value;
}

function normalizeLinearTransformInput(request: AiSubagentRequest): LinearTransformRequest {
  const input = request.input || {};
  const direction = requireString(input.direction, "AI_INPUT_DIRECTION_REQUIRED");
  if (direction !== "tree-to-linear" && direction !== "linear-to-tree") {
    throw new Error("AI_INPUT_DIRECTION_INVALID");
  }

  return {
    direction,
    sourceText: requireString(input.sourceText, "AI_INPUT_SOURCE_TEXT_REQUIRED"),
    scopeRootId: request.scopeId,
    scopeLabel: typeof input.scopeLabel === "string" ? input.scopeLabel : null,
    instruction: typeof input.instruction === "string" ? input.instruction : null,
  };
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

function parseTopicsFromModelText(rawText: string): string[] {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return [];
  }
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Accept simple bullet/list fallback when provider ignores JSON instruction.
    return trimmed
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-*0-9.\s]+/, "").trim())
      .filter((line) => line.length > 0)
      .slice(0, 8);
  }
  const topics = (parsed as { topics?: unknown[] })?.topics;
  if (!Array.isArray(topics)) {
    return [];
  }
  return topics
    .map((item) => String(item || "").trim())
    .filter((item) => item.length > 0)
    .slice(0, 8);
}

async function runTopicSuggestSubagent(
  request: AiSubagentRequest,
): Promise<{ topics: string[]; rawText: string; model: string; provider: string; usage?: AiSubagentSuccessResponse["usage"] }> {
  const ai = loadAiProviderConfigFromEnv();
  if (!ai.enabled) {
    throw new Error("AI infrastructure is disabled.");
  }
  if (ai.transport === "mcp") {
    throw new Error("MCP transport is not implemented yet.");
  }
  if (!ai.baseUrl || !ai.apiKey || !ai.model) {
    throw new Error("Topic suggestion subagent is not fully configured.");
  }

  const nodeText = requireString(request.input.nodeText, "AI_INPUT_NODE_TEXT_REQUIRED");
  const nodeDetails = typeof request.input.nodeDetails === "string" ? request.input.nodeDetails : "";
  const maxTopicsRaw = Number(request.input.maxTopics);
  const maxTopics = Number.isFinite(maxTopicsRaw) && maxTopicsRaw > 0
    ? Math.min(8, Math.max(1, Math.floor(maxTopicsRaw)))
    : 5;

  const userPrompt = [
    "Topic generation request:",
    `DocumentId: ${request.documentId}`,
    `ScopeId: ${request.scopeId}`,
    `NodeText: ${nodeText}`,
    `NodeDetails: ${nodeDetails || "(none)"}`,
    `MaxTopics: ${maxTopics}`,
    "Return JSON only.",
  ].join("\n");

  const response = await fetch(`${ai.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${ai.apiKey}`,
    },
    body: JSON.stringify({
      model: ai.model,
      messages: [
        { role: "system", content: topicSuggestPrompt() },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
    }),
  });

  const payload = await response.json() as ChatCompletionResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || `Subagent request failed with status ${response.status}.`);
  }

  const rawText = extractTextContent(payload);
  return {
    topics: parseTopicsFromModelText(rawText).slice(0, maxTopics),
    rawText,
    model: ai.model,
    provider: ai.provider || "deepseek",
    usage: payload.usage ? {
      inputTokens: payload.usage.prompt_tokens,
      outputTokens: payload.usage.completion_tokens,
      totalTokens: payload.usage.total_tokens,
    } : undefined,
  };
}

export async function runAiSubagent(
  subagent: string,
  request: AiSubagentRequest,
): Promise<AiSubagentSuccessResponse> {
  if (!isSupportedSubagent(subagent)) {
    throw new Error("AI_UNSUPPORTED_SUBAGENT");
  }

  const startedAt = Date.now();
  if (!request.documentId || request.documentId.trim().length === 0) {
    throw new Error("AI_DOCUMENT_ID_REQUIRED");
  }
  if (!request.scopeId || request.scopeId.trim().length === 0) {
    throw new Error("AI_SCOPE_ID_REQUIRED");
  }
  if (!request.input || typeof request.input !== "object") {
    throw new Error("AI_INPUT_REQUIRED");
  }

  if (subagent === "linear-transform") {
    const normalized = normalizeLinearTransformInput(request);
    const result = await runLinearTransform(normalized);
    return {
      ok: true,
      subagent,
      provider: result.provider,
      transport: loadAiProviderConfigFromEnv().transport,
      model: result.model,
      mode: request.mode === "direct-result" ? "direct-result" : "proposal",
      requiresApproval: false,
      proposal: {
        kind: "text-transform",
        summary: normalized.direction === "tree-to-linear"
          ? "Tree scope was converted to linear text."
          : "Linear text was converted for tree reconciliation.",
        result: {
          direction: result.direction,
          outputText: result.outputText,
          rawText: result.rawText,
        },
      },
      usage: result.usage,
      meta: {
        scopeId: request.scopeId,
        documentId: request.documentId,
        latencyMs: Date.now() - startedAt,
      },
    };
  }

  if (subagent === "topic-suggest") {
    const result = await runTopicSuggestSubagent(request);
    return {
      ok: true,
      subagent,
      provider: result.provider,
      transport: loadAiProviderConfigFromEnv().transport,
      model: result.model,
      mode: request.mode === "direct-result" ? "direct-result" : "proposal",
      requiresApproval: true,
      proposal: {
        kind: "topic-suggestions",
        summary: "Generated related topics for the selected node.",
        result: {
          topics: result.topics,
          rawText: result.rawText,
        },
      },
      usage: result.usage,
      meta: {
        scopeId: request.scopeId,
        documentId: request.documentId,
        latencyMs: Date.now() - startedAt,
      },
    };
  }

  throw new Error("AI_UNSUPPORTED_SUBAGENT");
}

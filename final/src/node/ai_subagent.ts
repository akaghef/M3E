import { getLinearTransformStatus, runLinearTransform } from "./linear_agent";
import { loadAiProviderConfigFromEnv, resolveAiModelConfig } from "./ai_infra";
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
  "Never wrap JSON in markdown code fences.",
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
  const resolved = resolveAiModelConfig(ai, null);
  const configured = ai.transport === "mcp"
    ? Boolean(ai.mcpServerCommand)
    : Boolean(ai.baseUrl && ai.apiKey && (resolved.model || ai.model));

  return {
    ok: true,
    enabled: ai.enabled,
    configured,
    provider: ai.provider,
    gateway: ai.gateway,
    transport: ai.transport,
    model: resolved.model || ai.model,
    activeModelAlias: resolved.alias,
    availableModelAliases: Object.keys(ai.modelRegistry),
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
        available: true,
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
    modelAlias: typeof request.modelAlias === "string" && request.modelAlias.trim().length > 0
      ? request.modelAlias.trim()
      : null,
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

function normalizeTopics(items: unknown[]): string[] {
  return items
    .map((item) => String(item || "").trim())
    .filter((item) => item.length > 0)
    .slice(0, 8);
}

function parseTopicsFromJsonCandidate(candidate: string): string[] | null {
  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (Array.isArray(parsed)) {
      return normalizeTopics(parsed);
    }
    const topics = (parsed as { topics?: unknown[] })?.topics;
    if (Array.isArray(topics)) {
      return normalizeTopics(topics);
    }
    return null;
  } catch {
    return null;
  }
}

function parseTopicsFromModelText(rawText: string): string[] {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return [];
  }

  const jsonCandidates: string[] = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    jsonCandidates.push(fenced[1].trim());
  }
  const objectLike = trimmed.match(/\{[\s\S]*\}/);
  if (objectLike?.[0]) {
    jsonCandidates.push(objectLike[0].trim());
  }

  for (const candidate of jsonCandidates) {
    const topics = parseTopicsFromJsonCandidate(candidate);
    if (topics && topics.length > 0) {
      return topics;
    }
  }

  // Accept simple bullet/list fallback when provider ignores JSON instruction.
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith("```"))
    .map((line) => line.replace(/^[-*0-9.\s]+/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 8);
}

function maxTopicsFromInput(input: Record<string, unknown>): number {
  const maxTopicsRaw = Number(input.maxTopics);
  return Number.isFinite(maxTopicsRaw) && maxTopicsRaw > 0
    ? Math.min(8, Math.max(1, Math.floor(maxTopicsRaw)))
    : 5;
}

function dedupeTopics(items: string[], maxTopics: number): string[] {
  const seen = new Set<string>();
  const topics: string[] = [];
  for (const item of items) {
    const topic = item.trim();
    const key = topic.toLowerCase();
    if (!topic || seen.has(key)) {
      continue;
    }
    seen.add(key);
    topics.push(topic);
    if (topics.length >= maxTopics) {
      break;
    }
  }
  return topics;
}

function localTopicSuggestions(nodeText: string, instruction: string, maxTopics: number): string[] {
  const normalizedInstruction = instruction.trim().toLowerCase();
  const base = nodeText.trim() || "Selected node";
  const normalizedNode = base.toLowerCase();
  const isSnakeNode = base.includes("ヘビ") || base.includes("蛇") || normalizedNode.includes("snake");
  const isLizardNode = base.includes("トカゲ") || normalizedNode.includes("lizard");
  if (isSnakeNode) {
    if (
      normalizedInstruction.includes("例")
      || normalizedInstruction.includes("example")
      || normalizedInstruction.includes("examples")
    ) {
      return dedupeTopics(["ニホンマムシ", "アオダイショウ", "シマヘビ", "コブラ", "ニシキヘビ"], maxTopics);
    }
    if (
      normalizedInstruction.includes("子分類")
      || normalizedInstruction.includes("分類")
      || normalizedInstruction.includes("classify")
      || normalizedInstruction.includes("classification")
    ) {
      return dedupeTopics(["毒ヘビ", "無毒ヘビ", "大型ヘビ", "水辺のヘビ", "樹上性のヘビ"], maxTopics);
    }
    if (
      normalizedInstruction.includes("関連")
      || normalizedInstruction.includes("topic")
      || normalizedInstruction.includes("related")
    ) {
      return dedupeTopics(["トカゲとの違い", "脱皮", "毒牙", "捕食行動", "冬眠"], maxTopics);
    }
    return dedupeTopics(["体のつくり", "生息環境", "食性", "毒の有無", "繁殖"], maxTopics);
  }
  if (isLizardNode) {
    if (
      normalizedInstruction.includes("例")
      || normalizedInstruction.includes("example")
      || normalizedInstruction.includes("examples")
    ) {
      return dedupeTopics(["ニホントカゲ", "カナヘビ", "ヤモリ", "イグアナ", "カメレオン"], maxTopics);
    }
    if (
      normalizedInstruction.includes("子分類")
      || normalizedInstruction.includes("分類")
      || normalizedInstruction.includes("classify")
      || normalizedInstruction.includes("classification")
    ) {
      return dedupeTopics(["地表性のトカゲ", "樹上性のトカゲ", "砂漠のトカゲ", "大型トカゲ", "小型トカゲ"], maxTopics);
    }
    if (
      normalizedInstruction.includes("関連")
      || normalizedInstruction.includes("topic")
      || normalizedInstruction.includes("related")
    ) {
      return dedupeTopics(["ヘビとの違い", "ヤモリとの違い", "尻尾の自切", "日光浴", "鱗"], maxTopics);
    }
    return dedupeTopics(["体のつくり", "生息環境", "食性", "尻尾の自切", "繁殖"], maxTopics);
  }
  if (normalizedInstruction.includes("簡潔") || normalizedInstruction.includes("concise")) {
    return dedupeTopics([`${base} の要点`, `${base} の一文要約`, `${base} の核心`, "残す情報", "削る情報"], maxTopics);
  }
  if (normalizedInstruction.includes("翻訳") || normalizedInstruction.includes("translate")) {
    return dedupeTopics([`${base} の英訳`, `${base} の和訳`, `${base} の専門用語`, "訳語メモ", "用語集"], maxTopics);
  }
  if (normalizedInstruction.includes("再生成") || normalizedInstruction.includes("regenerate")) {
    return dedupeTopics([`${base} の別案`, `${base} の対案`, `${base} の新しい切り口`, `${base} の検証観点`, `${base} の次の展開`], maxTopics);
  }
  if (
    normalizedInstruction.includes("例")
    || normalizedInstruction.includes("example")
    || normalizedInstruction.includes("examples")
  ) {
    return dedupeTopics([`${base} の代表例`, `${base} の具体例`, `${base} の応用例`, `${base} の日常例`, `${base} の反例`], maxTopics);
  }
  if (
    normalizedInstruction.includes("子分類")
    || normalizedInstruction.includes("分類")
    || normalizedInstruction.includes("classify")
    || normalizedInstruction.includes("classification")
  ) {
    return dedupeTopics([`${base} の分類軸`, `${base} の主要カテゴリ`, `${base} のサブタイプ`, `${base} の境界条件`, `${base} の例外`], maxTopics);
  }
  if (
    normalizedInstruction.includes("関連")
    || normalizedInstruction.includes("topic")
    || normalizedInstruction.includes("related")
  ) {
    return dedupeTopics([`${base} の関連概念`, `${base} の隣接領域`, `${base} の比較対象`, `${base} の前提知識`, `${base} の次の論点`], maxTopics);
  }
  if (normalizedInstruction.includes("詳細") || normalizedInstruction.includes("detail")) {
    return dedupeTopics([`${base} の定義`, `${base} の特徴`, `${base} の具体例`, `${base} の仕組み`, `${base} の注意点`], maxTopics);
  }
  const words = instruction
    .split(/[\s,、。;；:：/|]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 2)
    .slice(0, 3);
  return dedupeTopics([...words, "背景", "論点", "具体例", "判断", "次の作業"], maxTopics);
}

async function runTopicSuggestSubagent(
  request: AiSubagentRequest,
): Promise<{ topics: string[]; rawText: string; model: string; provider: string; usage?: AiSubagentSuccessResponse["usage"] }> {
  const nodeText = requireString(request.input.nodeText, "AI_INPUT_NODE_TEXT_REQUIRED");
  const nodeDetails = typeof request.input.nodeDetails === "string" ? request.input.nodeDetails : "";
  const maxTopics = maxTopicsFromInput(request.input);
  const ai = loadAiProviderConfigFromEnv();
  const baseUrl = ai.baseUrl;
  const apiKey = ai.apiKey;
  const model = ai.model;
  const configured = ai.transport === "openai-compatible" && Boolean(ai.enabled && baseUrl && apiKey && model);
  if (!configured) {
    const topics = localTopicSuggestions(nodeText, nodeDetails, maxTopics);
    return {
      topics,
      rawText: JSON.stringify({ topics }),
      model: "local-topic-draft-v1",
      provider: "local",
    };
  }
  if (ai.transport === "mcp") {
    throw new Error("MCP transport is not implemented yet.");
  }

  const userPrompt = [
    "Topic generation request:",
    `MapId: ${request.mapId}`,
    `ScopeId: ${request.scopeId}`,
    `NodeText: ${nodeText}`,
    `NodeDetails: ${nodeDetails || "(none)"}`,
    `MaxTopics: ${maxTopics}`,
    "Return JSON only.",
  ].join("\n");

  const response = await fetch(`${baseUrl!.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${apiKey!}`,
    },
    body: JSON.stringify({
      model,
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
    model: model!,
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
  if (!request.mapId || request.mapId.trim().length === 0) {
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
      resolvedModelAlias: result.modelAlias || null,
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
        mapId: request.mapId,
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
        mapId: request.mapId,
        latencyMs: Date.now() - startedAt,
      },
    };
  }

  throw new Error("AI_UNSUPPORTED_SUBAGENT");
}

import { getLinearTransformStatus, runLinearTransform } from "./linear_agent";
import { loadAiProviderConfigFromEnv, resolveAiModelConfig } from "./ai_infra";
import type {
  AiStatusResponse,
  AiSubagentRequest,
  AiSubagentSuccessResponse,
  LinearTransformRequest,
} from "../shared/types";

type SupportedSubagent = "linear-transform";

function isSupportedSubagent(name: string): name is SupportedSubagent {
  return name === "linear-transform";
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
        documentId: request.documentId,
        latencyMs: Date.now() - startedAt,
      },
    };
  }

  throw new Error("AI_UNSUPPORTED_SUBAGENT");
}

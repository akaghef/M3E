import type { LinearTransformTransport } from "../shared/types";

export type AiModelKind = "chat" | "embedding" | "rerank" | "image";
export type AiPrivacyMode = "local" | "cloud";
export type AiDataPolicy = "local_only" | "cloud_allowed" | "cloud_required";

export interface AiModelProfile {
  id: string;
  label: string;
  kind: AiModelKind;
  privacy: AiPrivacyMode;
  capabilities: string[];
  targetModel: string;
  dataPolicy: AiDataPolicy;
  fallbackChain?: string[];
}

export interface AiProviderConfig {
  enabled: boolean;
  provider: string | null;
  gateway: "none" | "litellm";
  transport: LinearTransformTransport;
  baseUrl: string | null;
  apiKey: string | null;
  model: string | null;
  defaultModelAlias: string | null;
  modelRegistry: Record<string, AiModelProfile>;
  mcpServerCommand: string | null;
}

export interface ResolvedAiModelConfig {
  alias: string | null;
  model: string | null;
  profile: AiModelProfile | null;
}

function isLocalBaseUrl(url: string | null): boolean {
  if (!url) {
    return false;
  }
  return url.includes("localhost") || url.includes("127.0.0.1");
}

function pickEnv(primary: string, legacy?: string): string | null {
  const value = process.env[primary]?.trim();
  if (value) {
    return value;
  }
  if (!legacy) {
    return null;
  }
  const fallback = process.env[legacy]?.trim();
  return fallback || null;
}

function isAiEnabledByEnv(): boolean {
  const raw = pickEnv("M3E_AI_ENABLED", "M3E_LINEAR_AGENT_ENABLED");
  if (!raw) {
    return true;
  }

  const normalized = raw.toLowerCase();
  return !(
    normalized === "0"
    || normalized === "false"
    || normalized === "off"
    || normalized === "no"
  );
}

function parseAiModelRegistryFromEnv(): Record<string, AiModelProfile> {
  const raw = pickEnv("M3E_AI_MODEL_REGISTRY_JSON");
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    const registry: Record<string, AiModelProfile> = {};
    for (const [alias, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") {
        continue;
      }
      const candidate = value as Record<string, unknown>;
      const targetModel = typeof candidate.targetModel === "string" && candidate.targetModel.trim().length > 0
        ? candidate.targetModel.trim()
        : null;
      if (!targetModel) {
        continue;
      }

      const kind = candidate.kind === "embedding" || candidate.kind === "rerank" || candidate.kind === "image"
        ? candidate.kind
        : "chat";
      const privacy = candidate.privacy === "local" ? "local" : "cloud";
      const dataPolicy = candidate.dataPolicy === "local_only"
        ? "local_only"
        : candidate.dataPolicy === "cloud_required"
          ? "cloud_required"
          : "cloud_allowed";

      registry[alias] = {
        id: alias,
        label: typeof candidate.label === "string" && candidate.label.trim().length > 0
          ? candidate.label.trim()
          : alias,
        kind,
        privacy,
        capabilities: Array.isArray(candidate.capabilities)
          ? candidate.capabilities.filter((item): item is string => typeof item === "string")
          : [],
        targetModel,
        dataPolicy,
        fallbackChain: Array.isArray(candidate.fallbackChain)
          ? candidate.fallbackChain.filter((item): item is string => typeof item === "string")
          : undefined,
      };
    }

    return registry;
  } catch {
    return {};
  }
}

function withDefaultModelAlias(config: AiProviderConfig): AiProviderConfig {
  if (!config.model) {
    return config;
  }

  if (config.modelRegistry["chat.default"]) {
    return config;
  }

  return {
    ...config,
    modelRegistry: {
      ...config.modelRegistry,
      "chat.default": {
        id: "chat.default",
        label: "Default Chat",
        kind: "chat",
        privacy: config.baseUrl?.includes("localhost") || config.baseUrl?.includes("127.0.0.1")
          ? "local"
          : "cloud",
        capabilities: ["streaming", "json"],
        targetModel: config.model,
        dataPolicy: "cloud_allowed",
      },
    },
  };
}

export function loadAiProviderConfigFromEnv(): AiProviderConfig {
  const transport = pickEnv("M3E_AI_TRANSPORT", "M3E_LINEAR_AGENT_TRANSPORT") === "mcp"
    ? "mcp"
    : "openai-compatible";

  const provider = pickEnv("M3E_AI_PROVIDER", "M3E_LINEAR_AGENT_PROVIDER") || "deepseek";
  const baseUrl = pickEnv("M3E_AI_BASE_URL", "M3E_LINEAR_AGENT_BASE_URL");
  const apiKey = pickEnv("M3E_AI_API_KEY", "M3E_LINEAR_AGENT_API_KEY");
  const model = pickEnv("M3E_AI_MODEL", "M3E_LINEAR_AGENT_MODEL");
  const effectiveApiKey = apiKey || ((provider === "ollama" || isLocalBaseUrl(baseUrl)) ? "ollama" : null);

  const baseConfig: AiProviderConfig = {
    enabled: isAiEnabledByEnv(),
    provider,
    gateway: pickEnv("M3E_AI_GATEWAY") === "litellm" ? "litellm" : "none",
    transport,
    baseUrl,
    apiKey: effectiveApiKey,
    model,
    defaultModelAlias: pickEnv("M3E_AI_DEFAULT_MODEL_ALIAS") || null,
    modelRegistry: parseAiModelRegistryFromEnv(),
    mcpServerCommand: pickEnv("M3E_AI_MCP_SERVER", "M3E_LINEAR_AGENT_MCP_SERVER"),
  };

  return withDefaultModelAlias(baseConfig);
}

export function resolveAiModelConfig(
  config: AiProviderConfig,
  requestedAlias?: string | null,
): ResolvedAiModelConfig {
  const alias = (requestedAlias && requestedAlias.trim().length > 0)
    ? requestedAlias.trim()
    : (config.defaultModelAlias && config.defaultModelAlias.trim().length > 0)
      ? config.defaultModelAlias.trim()
      : null;

  if (alias && config.modelRegistry[alias]) {
    const profile = config.modelRegistry[alias];
    return {
      alias,
      model: profile.targetModel,
      profile,
    };
  }

  return {
    alias,
    model: config.model,
    profile: null,
  };
}

import type { LinearTransformTransport } from "../shared/types";

export interface AiProviderConfig {
  enabled: boolean;
  provider: string | null;
  transport: LinearTransformTransport;
  baseUrl: string | null;
  apiKey: string | null;
  model: string | null;
  mcpServerCommand: string | null;
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

export function loadAiProviderConfigFromEnv(): AiProviderConfig {
  const transport = pickEnv("M3E_AI_TRANSPORT", "M3E_LINEAR_AGENT_TRANSPORT") === "mcp"
    ? "mcp"
    : "openai-compatible";

  const provider = pickEnv("M3E_AI_PROVIDER", "M3E_LINEAR_AGENT_PROVIDER") || "deepseek";
  const baseUrl = pickEnv("M3E_AI_BASE_URL", "M3E_LINEAR_AGENT_BASE_URL");
  const apiKey = pickEnv("M3E_AI_API_KEY", "M3E_LINEAR_AGENT_API_KEY");
  const model = pickEnv("M3E_AI_MODEL", "M3E_LINEAR_AGENT_MODEL");
  const effectiveApiKey = apiKey || ((provider === "ollama" || isLocalBaseUrl(baseUrl)) ? "ollama" : null);

  return {
    enabled: (pickEnv("M3E_AI_ENABLED", "M3E_LINEAR_AGENT_ENABLED") || "") === "1",
    provider,
    transport,
    baseUrl,
    apiKey: effectiveApiKey,
    model,
    mcpServerCommand: pickEnv("M3E_AI_MCP_SERVER", "M3E_LINEAR_AGENT_MCP_SERVER"),
  };
}

export type AiProvider = "anthropic" | "openai" | "custom";

export interface AiModelConfig {
  id: string;
  name: string;
  provider: AiProvider;
  modelId: string;
  baseUrl?: string;
  bitwardenItemId: string;
  enabled: boolean;
}

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiChatRequest {
  modelConfigId: string;
  messages: AiMessage[];
  nodeContext?: string;
  maxTokens?: number;
}

export interface AiChatResponse {
  ok: boolean;
  content?: string;
  error?: string;
}

export interface AiModelsFile {
  models: AiModelConfig[];
}

export interface BitwardenStatusResponse {
  ok: boolean;
  available: boolean;
  locked: boolean;
  error?: string;
}

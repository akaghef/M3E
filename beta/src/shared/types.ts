export type NodeType = "text" | "image" | "folder" | "alias";
export type AliasAccess = "read" | "write";
export type LinkDirection = "none" | "forward" | "backward" | "both";
export type LinkStyle = "default" | "dashed" | "soft" | "emphasis";

export interface TreeNode {
  id: string;
  parentId: string | null;
  children: string[];
  nodeType?: NodeType;
  scopeId?: string;
  text: string;
  collapsed: boolean;
  details: string;
  note: string;
  attributes: Record<string, string>;
  link: string;
  targetNodeId?: string;
  aliasLabel?: string;
  access?: AliasAccess;
  targetSnapshotLabel?: string;
  isBroken?: boolean;
}

export interface GraphLink {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType?: string;
  label?: string;
  direction?: LinkDirection;
  style?: LinkStyle;
}

export interface AppState {
  rootId: string;
  nodes: Record<string, TreeNode>;
  links?: Record<string, GraphLink>;
  linearNotesByScope?: Record<string, string>;
  linearTextFontScale?: number;
  linearPanelWidth?: number;
}

export interface SavedDoc {
  version: 1;
  savedAt: string;
  state: AppState;
}

export type LinearTransformDirection = "tree-to-linear" | "linear-to-tree";
export type LinearTransformTransport = "openai-compatible" | "mcp";

export interface LinearTransformStatus {
  ok: true;
  enabled: boolean;
  configured: boolean;
  provider: string | null;
  transport: LinearTransformTransport;
  model: string | null;
  endpoint: string | null;
  promptConfigured: boolean;
  message: string;
}

export interface LinearTransformRequest {
  direction: LinearTransformDirection;
  sourceText: string;
  scopeRootId?: string | null;
  scopeLabel?: string | null;
  instruction?: string | null;
  modelAlias?: string | null;
}

export interface LinearTransformResponse {
  ok: true;
  direction: LinearTransformDirection;
  provider: string;
  model: string;
  modelAlias?: string | null;
  outputText: string;
  rawText: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

export interface AiFeatureStatus {
  available: boolean;
  promptConfigured: boolean;
}

export interface AiStatusResponse {
  ok: true;
  enabled: boolean;
  configured: boolean;
  provider: string | null;
  gateway?: "none" | "litellm";
  transport: LinearTransformTransport;
  model: string | null;
  activeModelAlias?: string | null;
  availableModelAliases?: string[];
  endpoint: string | null;
  message: string;
  features: Record<string, AiFeatureStatus>;
}

// ---------------------------------------------------------------------------
// Cloud Sync Transport
// ---------------------------------------------------------------------------

export interface PushResult {
  ok: boolean;
  savedAt: string;
  documentId: string;
  forced: boolean;
  conflict?: boolean;
  cloudSavedAt?: string | null;
  error?: string;
}

export interface PullResult {
  ok: boolean;
  version: number;
  savedAt: string;
  state: AppState;
  documentId: string;
  error?: string;
}

export interface SyncStatus {
  ok: boolean;
  enabled: boolean;
  mode: string;
  documentId: string;
  exists: boolean;
  cloudSavedAt: string | null;
  lastSyncedAt: string | null;
}

export interface CloudSyncTransport {
  readonly mode: string;
  push(docId: string, doc: SavedDoc, baseSavedAt: string | null, force: boolean): Promise<PushResult>;
  pull(docId: string): Promise<PullResult>;
  status(docId: string): Promise<SyncStatus>;
}

export interface AiSubagentRequest {
  documentId: string;
  scopeId: string;
  provider?: string | null;
  modelAlias?: string | null;
  mode?: "proposal" | "direct-result";
  input: Record<string, unknown>;
  constraints?: {
    timeoutMs?: number;
    maxTokens?: number;
    temperature?: number;
  };
  clientContext?: {
    selectionNodeId?: string;
    requestId?: string;
  };
}

export interface AiSubagentSuccessResponse {
  ok: true;
  subagent: string;
  provider: string;
  transport: LinearTransformTransport;
  model: string;
  resolvedModelAlias?: string | null;
  mode: "proposal" | "direct-result";
  requiresApproval: boolean;
  proposal: {
    kind: string;
    summary?: string;
    result: Record<string, unknown>;
    warnings?: string[];
    explanations?: string[];
  };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  meta: {
    scopeId: string;
    documentId: string;
    latencyMs: number;
  };
}

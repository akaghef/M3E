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
  docVersion?: number;
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

export interface VaultImportOptions {
  maxFiles?: number;
  maxCharsPerFile?: number;
  skipAiTransform?: boolean;
  excludePatterns?: string[];
}

export interface VaultImportRequest {
  vaultPath: string;
  documentId?: string;
  modelAlias?: string | null;
  options?: VaultImportOptions;
}

export type VaultImportPhase = "discovery" | "parse" | "transform" | "links" | "persist";

export interface VaultImportProgress {
  phase: VaultImportPhase;
  total?: number;
  current?: number;
  currentFile?: string;
  status?: "ok";
  message?: string;
}

export interface VaultImportedFileSummary {
  relativePath: string;
  nodeId: string;
  wikilinkCount: number;
  truncated: boolean;
}

export interface VaultImportResult {
  ok: true;
  documentId: string;
  savedAt: string;
  fileCount: number;
  folderCount: number;
  nodeCount: number;
  truncatedFiles: number;
  warnings: string[];
  files: VaultImportedFileSummary[];
  state: AppState;
}

export interface VaultExportOptions {
  skipAiTransform?: boolean;
  overwrite?: boolean;
}

export interface VaultExportRequest {
  documentId: string;
  vaultPath: string;
  nodeId?: string;
  modelAlias?: string | null;
  options?: VaultExportOptions;
}

export type VaultExportPhase = "analysis" | "transform" | "write";

export interface VaultExportProgress {
  phase: VaultExportPhase;
  total?: number;
  current?: number;
  currentFile?: string;
  status?: "ok";
  message?: string;
}

export interface VaultExportResult {
  ok: true;
  documentId: string;
  vaultPath: string;
  fileCount: number;
  folderCount: number;
  warnings: string[];
  savedAt: string;
}

export interface VaultWatchStartRequest {
  documentId: string;
  vaultPath: string;
  modelAlias?: string | null;
  debounceMs?: number;
  importOptions?: VaultImportOptions;
  exportOptions?: VaultExportOptions;
}

export interface VaultWatchStopRequest {
  documentId: string;
}

export type VaultWatchEventType =
  | "watch-started"
  | "watch-stopped"
  | "vault-to-m3e"
  | "m3e-to-vault"
  | "watch-error";

export interface VaultWatchEvent {
  type: VaultWatchEventType;
  documentId: string;
  vaultPath: string;
  timestamp: string;
  detail?: string;
}

export interface VaultWatchStatus {
  ok: true;
  documentId: string;
  vaultPath: string;
  integrationMode: "obsidian-live";
  sourceOfTruth: "vault-md";
  running: boolean;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  lastError: string | null;
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
  cloudDocVersion?: number;
  remoteState?: AppState;
  error?: string;
}

export interface PullResult {
  ok: boolean;
  version: number;
  savedAt: string;
  state: AppState;
  documentId: string;
  docVersion?: number;
  error?: string;
}

export interface SyncStatus {
  ok: boolean;
  enabled: boolean;
  mode: string;
  documentId: string;
  exists: boolean;
  cloudSavedAt: string | null;
  cloudDocVersion?: number | null;
  lastSyncedAt: string | null;
}

export interface CloudSyncTransport {
  readonly mode: string;
  push(docId: string, doc: SavedDoc, baseSavedAt: string | null, force: boolean, baseDocVersion?: number | null): Promise<PushResult>;
  pull(docId: string): Promise<PullResult>;
  status(docId: string): Promise<SyncStatus>;
}

// ---------------------------------------------------------------------------
// Flash Ingest Pipeline
// ---------------------------------------------------------------------------

export type FlashSourceType = "text" | "markdown";

export type FlashDraftStatus = "pending" | "approved" | "partial" | "rejected";

export interface DraftNode {
  tempId: string;
  parentTempId: string | null;
  text: string;
  details: string;
  note: string;
  confidence: number;
  sourceRef: string;
  attributes: Record<string, string>;
}

export interface StructuredDraft {
  nodes: DraftNode[];
  suggestedParentId: string | null;
}

export interface FlashDraft {
  id: string;
  docId: string;
  sourceType: FlashSourceType;
  sourceRef: string;
  title: string;
  extractedText: string;
  structured: StructuredDraft;
  status: FlashDraftStatus;
  approvedNodeIds: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface FlashIngestRequest {
  docId: string;
  sourceType: FlashSourceType;
  content: string;
  options?: {
    maxDepth?: number;
    targetNodeId?: string;
  };
}

export interface FlashIngestBatchRequest {
  items: FlashIngestRequest[];
}

export interface FlashApproveRequest {
  mode: "all" | "partial";
  selectedNodeIds?: string[];
  targetParentId?: string;
  edits?: Record<string, { text?: string; details?: string; note?: string }>;
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

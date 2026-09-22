/** Public, provider-neutral observation contract. Runtime data never owns authoring content. */
export const ORRERY_SCHEMA = "m3e.orrery.v1" as const;

export type OrreryAgentKind = "ai" | "human";
export type OrrerySourceState = "connected" | "stale" | "unobservable" | "disabled";
export type OrreryLifecycleState =
  | "starting" | "thinking" | "tool-running" | "awaiting-user" | "blocked"
  | "idle" | "completed" | "failed" | "disconnected" | "unobservable";
export type OrreryRelationType = "conversation" | "handoff" | "assignment" | "attention" | "spawn" | "resource-use";

export interface OrreryProvenance {
  sourceId: string;
  hostId: string;
  sourceRecordId: string;
  observedAt: string;
  revision: string;
}

export interface OrrerySource {
  id: string;
  hostId: string;
  state: OrrerySourceState;
  observedAt: string | null;
  revision: string | null;
  /** Sanitized problem code, never an exception containing local paths or credentials. */
  problem?: string;
}

export interface OrreryActor {
  id: string;
  externalId: string;
  kind: OrreryAgentKind;
  name: string;
  backend: string;
  nativeSessionRef?: string;
  mailPrincipalRef?: string;
  parentActorId?: string;
  incarnation?: string;
  model?: string;
  title?: string;
  message?: string;
  rawState: string;
  /** Omitted when the source cannot establish an exact canonical lifecycle state. */
  lifecycleState?: OrreryLifecycleState;
  observationState: "observed" | "unobservable";
  lastActiveAt: string;
  capabilities: string[];
  provenance: OrreryProvenance;
}

export interface OrreryTransportEvidence {
  id: string;
  sourceActorId: string;
  targetActorId: string;
  sentAt: string;
  subject?: string;
  body?: string;
  deliveryState?: string;
  replyToId?: string;
  provenance: OrreryProvenance;
}

export interface OrreryRelation {
  id: string;
  sourceActorId: string;
  targetActorId: string;
  type: OrreryRelationType;
  evidenceIds: string[];
  provenance: OrreryProvenance;
}

/** Explicit request; unread count, generic blocked and elapsed time never create one. */
export interface OrreryAttentionRequest {
  id: string;
  actorId: string;
  requestedByActorId?: string;
  state: "open" | "resolved";
  text: string;
  provenance: OrreryProvenance;
}

export interface OrrerySnapshot {
  schema: typeof ORRERY_SCHEMA;
  revision: string;
  generatedAt: string;
  sources: OrrerySource[];
  actors: OrreryActor[];
  relations: OrreryRelation[];
  evidence: OrreryTransportEvidence[];
  attention: OrreryAttentionRequest[];
}

/** Human-owned binding to existing authoring nodes. Display names are never identity keys. */
export interface OrreryMapBinding {
  actorId: string;
  mapNodeId: string;
  roleNodeIds?: string[];
}

export type OrreryCommandState =
  | "requested" | "accepted" | "submitted" | "observed-finished" | "verified"
  | "rejected" | "failed" | "unknown-outcome";

export interface OrreryCommand {
  id: string;
  actorId: string;
  action: string;
  requestedAt: string;
  /** The adapter must advertise the action and own execution/authorization. */
  expectedIncarnation?: string;
  payload?: Record<string, unknown>;
}

export interface OrreryCommandReceipt {
  commandId: string;
  state: OrreryCommandState;
  observedAt: string;
  evidenceRef?: string;
  problem?: string;
}

export interface OrreryCommandAdapter {
  readonly capabilities: readonly string[];
  submit(command: OrreryCommand): Promise<OrreryCommandReceipt>;
}

export interface OrrerySnapshotReader {
  snapshot(): OrrerySnapshot;
  subscribe(listener: (snapshot: OrrerySnapshot) => void): () => void;
  close(): void;
}

export interface OrrerySourceConfig {
  id: string;
  hostId: string;
  path: string;
  format: "codex-app-v1" | "orrery-v1";
}

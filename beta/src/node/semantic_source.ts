import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import nodePath from "node:path";

export const SEMANTIC_SOURCE_SPECIMEN_SCHEMA = "m3e.semantic-source.specimen.v1" as const;

export type SourceKind =
  | "git-backed"
  | "obsidian-backed"
  | "m3e-local"
  | "provider-backed";

export type RefinementLevel = "D2" | "D3";
export type MaterializationClassification = "include" | "redact" | "exclude";

export interface SourceCapabilities {
  read: boolean;
  proposal: boolean;
  directWrite: boolean;
  history: boolean;
  transaction: boolean;
}

export interface SourceDescriptor {
  sourceId: string;
  sourceKind: SourceKind;
  schemaVersion: string;
  currentRevision: string;
  readRoute: string;
  writeRoute: string;
  classificationPolicy: string;
  capabilities: SourceCapabilities;
  lastIndexedRevision?: string;
}

export interface SemanticRecordProvenance {
  sourceRef: string;
  transformation?: string;
}

export interface SemanticEntity {
  localEntityId: string;
  entityType: string;
  label: string;
  documentRef: string;
  refinementLevel: RefinementLevel;
  selectedForGraph?: boolean;
  classification: MaterializationClassification;
  provenance: SemanticRecordProvenance;
}

export interface SemanticEntityRef {
  sourceId: string;
  localEntityId: string;
}

export interface SemanticAssertion {
  localAssertionId: string;
  relationType: string;
  from: SemanticEntityRef;
  to: SemanticEntityRef;
  ownerSourceId: string;
  refinementLevel: RefinementLevel;
  selectedForGraph?: boolean;
  classification: MaterializationClassification;
  provenance: SemanticRecordProvenance;
}

export interface SemanticSourcePackage {
  schema: typeof SEMANTIC_SOURCE_SPECIMEN_SCHEMA;
  descriptor: SourceDescriptor;
  entities: SemanticEntity[];
  assertions: SemanticAssertion[];
}

export interface SemanticSourceValidationIssue {
  code: string;
  path: string;
  message: string;
}

export type SemanticSourceValidationResult =
  | { ok: true; value: SemanticSourcePackage }
  | { ok: false; issues: SemanticSourceValidationIssue[] };

export interface RebuiltSemanticGraph {
  sourceId: string;
  sourceRevision: string;
  schemaVersion: string;
  entities: Array<SemanticEntity & { globalEntityId: string }>;
  assertions: Array<SemanticAssertion & { globalAssertionId: string }>;
  semanticContentHash: string;
}

const SOURCE_KINDS = new Set<SourceKind>([
  "git-backed",
  "obsidian-backed",
  "m3e-local",
  "provider-backed",
]);
const REFINEMENT_LEVELS = new Set<RefinementLevel>(["D2", "D3"]);
const CLASSIFICATIONS = new Set<MaterializationClassification>([
  "include",
  "redact",
  "exclude",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function addIssue(
  issues: SemanticSourceValidationIssue[],
  code: string,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function readRequiredString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: SemanticSourceValidationIssue[],
): string | undefined {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    addIssue(issues, "REQUIRED_STRING", `${path}.${key}`, "Expected a non-empty string.");
    return undefined;
  }
  return candidate;
}

function isSafeRepositoryRelativePath(value: string): boolean {
  if (value.includes("\0") || nodePath.isAbsolute(value)) return false;
  const segments = value.replace(/\\/g, "/").split("/");
  return !segments.includes("..");
}

function validateRefinement(
  value: Record<string, unknown>,
  path: string,
  issues: SemanticSourceValidationIssue[],
): void {
  const level = value.refinementLevel;
  if (typeof level !== "string" || !REFINEMENT_LEVELS.has(level as RefinementLevel)) {
    addIssue(issues, "REFINEMENT_LEVEL_INVALID", `${path}.refinementLevel`, "Graph records must be D3 or selected D2.");
    return;
  }
  if (level === "D2" && value.selectedForGraph !== true) {
    addIssue(issues, "D2_NOT_SELECTED", `${path}.selectedForGraph`, "D2 records require selectedForGraph=true.");
  }
}

function validateClassification(
  value: unknown,
  path: string,
  issues: SemanticSourceValidationIssue[],
): void {
  if (typeof value !== "string" || !CLASSIFICATIONS.has(value as MaterializationClassification)) {
    addIssue(issues, "CLASSIFICATION_INVALID", path, "Expected include, redact, or exclude.");
  }
}

function validateProvenance(
  value: unknown,
  path: string,
  refinementLevel: unknown,
  issues: SemanticSourceValidationIssue[],
): void {
  if (!isRecord(value)) {
    addIssue(issues, "PROVENANCE_REQUIRED", path, "Expected provenance object.");
    return;
  }
  const sourceRef = readRequiredString(value, "sourceRef", path, issues);
  if (sourceRef && !isSafeRepositoryRelativePath(sourceRef)) {
    addIssue(issues, "SOURCE_REF_UNSAFE", `${path}.sourceRef`, "sourceRef must be repository-relative and must not contain '..'.");
  }
  if (refinementLevel === "D2") {
    readRequiredString(value, "transformation", path, issues);
  }
}

function validateDescriptor(
  value: unknown,
  issues: SemanticSourceValidationIssue[],
): SourceDescriptor | undefined {
  const path = "descriptor";
  if (!isRecord(value)) {
    addIssue(issues, "DESCRIPTOR_REQUIRED", path, "Expected SourceDescriptor object.");
    return undefined;
  }

  const sourceId = readRequiredString(value, "sourceId", path, issues);
  const sourceKind = readRequiredString(value, "sourceKind", path, issues);
  const schemaVersion = readRequiredString(value, "schemaVersion", path, issues);
  readRequiredString(value, "currentRevision", path, issues);
  const readRoute = readRequiredString(value, "readRoute", path, issues);
  const writeRoute = readRequiredString(value, "writeRoute", path, issues);
  readRequiredString(value, "classificationPolicy", path, issues);

  if (value.lastIndexedRevision !== undefined && (
    typeof value.lastIndexedRevision !== "string" || value.lastIndexedRevision.trim().length === 0
  )) {
    addIssue(issues, "LAST_INDEXED_REVISION_INVALID", `${path}.lastIndexedRevision`, "Expected a non-empty revision string when present.");
  }

  if (sourceId && /[\\/]/.test(sourceId)) {
    addIssue(issues, "SOURCE_ID_PATH_COUPLED", `${path}.sourceId`, "sourceId must not be a filesystem path.");
  }
  if (sourceKind && !SOURCE_KINDS.has(sourceKind as SourceKind)) {
    addIssue(issues, "SOURCE_KIND_INVALID", `${path}.sourceKind`, "Unsupported sourceKind.");
  }
  if (schemaVersion !== undefined && schemaVersion !== "1") {
    addIssue(issues, "SCHEMA_VERSION_UNSUPPORTED", `${path}.schemaVersion`, "The Phase 1 specimen supports schemaVersion 1 only.");
  }
  if (readRoute && !readRoute.startsWith("file:")) {
    addIssue(issues, "READ_ROUTE_INVALID", `${path}.readRoute`, "The Phase 1 adapter accepts file: routes only.");
  }
  if (readRoute) {
    const routePath = readRoute.slice("file:".length);
    if (!routePath || !isSafeRepositoryRelativePath(routePath)) {
      addIssue(issues, "READ_ROUTE_UNSAFE", `${path}.readRoute`, "file: route must be repository-relative.");
    }
  }
  if (writeRoute && !writeRoute.startsWith("reject:")) {
    addIssue(issues, "WRITE_ROUTE_NOT_READ_ONLY", `${path}.writeRoute`, "The Phase 1 file adapter requires an explicit reject: write route.");
  }

  if (!isRecord(value.capabilities)) {
    addIssue(issues, "CAPABILITIES_REQUIRED", `${path}.capabilities`, "Expected capabilities object.");
  } else {
    for (const key of ["read", "proposal", "directWrite", "history", "transaction"]) {
      if (typeof value.capabilities[key] !== "boolean") {
        addIssue(issues, "CAPABILITY_INVALID", `${path}.capabilities.${key}`, "Expected boolean capability.");
      }
    }
    if (value.capabilities.read !== true) {
      addIssue(issues, "READ_CAPABILITY_REQUIRED", `${path}.capabilities.read`, "The file adapter must be readable.");
    }
    if (value.capabilities.directWrite !== false) {
      addIssue(issues, "DIRECT_WRITE_FORBIDDEN", `${path}.capabilities.directWrite`, "Phase 1 is read-only.");
    }
  }

  return value as unknown as SourceDescriptor;
}

export function validateSemanticSourcePackage(input: unknown): SemanticSourceValidationResult {
  const issues: SemanticSourceValidationIssue[] = [];
  if (!isRecord(input)) {
    return { ok: false, issues: [{ code: "PACKAGE_REQUIRED", path: "$", message: "Expected JSON object." }] };
  }

  if (input.schema !== SEMANTIC_SOURCE_SPECIMEN_SCHEMA) {
    addIssue(issues, "PACKAGE_SCHEMA_UNSUPPORTED", "schema", `Expected ${SEMANTIC_SOURCE_SPECIMEN_SCHEMA}.`);
  }
  const descriptor = validateDescriptor(input.descriptor, issues);
  const sourceId = descriptor?.sourceId;
  const entityIds = new Set<string>();
  const assertionIds = new Set<string>();

  if (!Array.isArray(input.entities)) {
    addIssue(issues, "ENTITIES_REQUIRED", "entities", "Expected entity array.");
  } else {
    input.entities.forEach((candidate, index) => {
      const path = `entities[${index}]`;
      if (!isRecord(candidate)) {
        addIssue(issues, "ENTITY_INVALID", path, "Expected entity object.");
        return;
      }
      const localId = readRequiredString(candidate, "localEntityId", path, issues);
      readRequiredString(candidate, "entityType", path, issues);
      readRequiredString(candidate, "label", path, issues);
      const documentRef = readRequiredString(candidate, "documentRef", path, issues);
      if (localId) {
        if (entityIds.has(localId)) addIssue(issues, "ENTITY_ID_DUPLICATE", `${path}.localEntityId`, "Duplicate localEntityId.");
        entityIds.add(localId);
      }
      if (documentRef && !isSafeRepositoryRelativePath(documentRef)) {
        addIssue(issues, "DOCUMENT_REF_UNSAFE", `${path}.documentRef`, "documentRef must be repository-relative.");
      }
      validateRefinement(candidate, path, issues);
      validateClassification(candidate.classification, `${path}.classification`, issues);
      validateProvenance(candidate.provenance, `${path}.provenance`, candidate.refinementLevel, issues);
    });
  }

  if (!Array.isArray(input.assertions)) {
    addIssue(issues, "ASSERTIONS_REQUIRED", "assertions", "Expected assertion array.");
  } else {
    input.assertions.forEach((candidate, index) => {
      const path = `assertions[${index}]`;
      if (!isRecord(candidate)) {
        addIssue(issues, "ASSERTION_INVALID", path, "Expected assertion object.");
        return;
      }
      const localId = readRequiredString(candidate, "localAssertionId", path, issues);
      readRequiredString(candidate, "relationType", path, issues);
      const ownerSourceId = readRequiredString(candidate, "ownerSourceId", path, issues);
      if (localId) {
        if (assertionIds.has(localId)) addIssue(issues, "ASSERTION_ID_DUPLICATE", `${path}.localAssertionId`, "Duplicate localAssertionId.");
        assertionIds.add(localId);
      }
      if (sourceId && ownerSourceId && ownerSourceId !== sourceId) {
        addIssue(issues, "ASSERTION_OWNER_MISMATCH", `${path}.ownerSourceId`, "Repository-local assertions must be owned by the descriptor source.");
      }

      for (const endpointName of ["from", "to"] as const) {
        const endpoint = candidate[endpointName];
        if (!isRecord(endpoint)) {
          addIssue(issues, "ENTITY_REF_REQUIRED", `${path}.${endpointName}`, "Expected entity reference.");
          continue;
        }
        const endpointSourceId = readRequiredString(endpoint, "sourceId", `${path}.${endpointName}`, issues);
        const endpointLocalId = readRequiredString(endpoint, "localEntityId", `${path}.${endpointName}`, issues);
        if (sourceId && endpointSourceId === sourceId && endpointLocalId && !entityIds.has(endpointLocalId)) {
          addIssue(issues, "LOCAL_ENTITY_UNRESOLVED", `${path}.${endpointName}.localEntityId`, "Local entity reference does not resolve.");
        }
      }
      validateRefinement(candidate, path, issues);
      validateClassification(candidate.classification, `${path}.classification`, issues);
      validateProvenance(candidate.provenance, `${path}.provenance`, candidate.refinementLevel, issues);
    });
  }

  return issues.length === 0
    ? { ok: true, value: input as unknown as SemanticSourcePackage }
    : { ok: false, issues };
}

export class SemanticSourceValidationError extends Error {
  constructor(
    readonly filePath: string,
    readonly issues: SemanticSourceValidationIssue[],
  ) {
    super(`Semantic source validation failed for ${filePath}: ${issues.length} issue(s)`);
    this.name = "SemanticSourceValidationError";
  }
}

export function loadSemanticSourceFile(filePath: string): SemanticSourcePackage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new SemanticSourceValidationError(filePath, [{ code: "JSON_PARSE_FAILED", path: "$", message }]);
  }
  const result = validateSemanticSourcePackage(parsed);
  if (!result.ok) throw new SemanticSourceValidationError(filePath, result.issues);
  return result.value;
}

export function makeGlobalSemanticId(sourceId: string, localId: string): string {
  return `m3e-semantic:${encodeURIComponent(sourceId)}:${encodeURIComponent(localId)}`;
}

export function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export class FileSemanticSourceAdapter {
  private readonly sourcePackage: SemanticSourcePackage;

  constructor(readonly filePath: string) {
    this.sourcePackage = loadSemanticSourceFile(filePath);
  }

  describe(): SourceDescriptor {
    return cloneJson(this.sourcePackage.descriptor);
  }

  readEntity(localEntityId: string): SemanticEntity | undefined {
    const entity = this.sourcePackage.entities.find((candidate) => candidate.localEntityId === localEntityId);
    return entity ? cloneJson(entity) : undefined;
  }

  readAssertion(localAssertionId: string): SemanticAssertion | undefined {
    const assertion = this.sourcePackage.assertions.find((candidate) => candidate.localAssertionId === localAssertionId);
    return assertion ? cloneJson(assertion) : undefined;
  }

  rebuild(): RebuiltSemanticGraph {
    const { descriptor } = this.sourcePackage;
    const entities = this.sourcePackage.entities
      .map((entity) => ({
        ...cloneJson(entity),
        globalEntityId: makeGlobalSemanticId(descriptor.sourceId, entity.localEntityId),
      }))
      .sort((left, right) => left.globalEntityId.localeCompare(right.globalEntityId));
    const assertions = this.sourcePackage.assertions
      .map((assertion) => ({
        ...cloneJson(assertion),
        globalAssertionId: makeGlobalSemanticId(descriptor.sourceId, assertion.localAssertionId),
      }))
      .sort((left, right) => left.globalAssertionId.localeCompare(right.globalAssertionId));
    const semanticContentHash = createHash("sha256")
      .update(stableSerialize({ entities, assertions }))
      .digest("hex");
    return {
      sourceId: descriptor.sourceId,
      sourceRevision: descriptor.currentRevision,
      schemaVersion: descriptor.schemaVersion,
      entities,
      assertions,
      semanticContentHash,
    };
  }
}

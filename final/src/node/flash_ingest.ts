"use strict";

import { RapidMvpModel } from "./rapid_mvp";
import type {
  FlashSourceType,
  FlashDraftStatus,
  DraftNode,
  StructuredDraft,
  FlashDraft,
  FlashIngestRequest,
  FlashApproveRequest,
  TreeNode,
} from "../shared/types";

// ---------------------------------------------------------------------------
// Flash attribute keys (m3e: namespace)
// ---------------------------------------------------------------------------

export const FLASH_ATTR = {
  BAND: "m3e:band",
  SOURCE_TYPE: "m3e:sourceType",
  SOURCE_URL: "m3e:sourceUrl",
  CAPTURED_AT: "m3e:capturedAt",
  CONFIDENCE: "m3e:confidence",
  STATUS: "m3e:status",
} as const;

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let _idCounter = 0;

function newDraftId(): string {
  _idCounter++;
  return `d_${Date.now()}_${_idCounter.toString(36)}`;
}

function newTempId(index: number): string {
  return `t_${String(index + 1).padStart(3, "0")}`;
}

/** Reset counter (for tests). */
export function _resetIdCounter(): void {
  _idCounter = 0;
}

// ---------------------------------------------------------------------------
// Draft Store (in-memory Map)
// ---------------------------------------------------------------------------

const drafts = new Map<string, FlashDraft>();

export function getDrafts(): Map<string, FlashDraft> {
  return drafts;
}

export function clearDrafts(): void {
  drafts.clear();
}

// ---------------------------------------------------------------------------
// Text -> tree conversion (no AI)
// ---------------------------------------------------------------------------

/**
 * Parse Markdown text into a flat list of DraftNode.
 *
 * Rules:
 * - Markdown headings (# ... ######) create parent-child hierarchy.
 * - Bullet list items (- or *) under a heading become children of that heading.
 * - Plain text with no structure becomes a single node.
 */
export function parseMarkdownToNodes(
  text: string,
  sourceRef: string,
  maxDepth: number = 4,
): DraftNode[] {
  const lines = text.split(/\r?\n/);
  const nodes: DraftNode[] = [];

  // Stack tracks [tempId, headingLevel]. Root is virtual level 0.
  const stack: Array<{ tempId: string | null; level: number }> = [
    { tempId: null, level: 0 },
  ];

  let nodeIndex = 0;
  let currentHeadingId: string | null = null;
  let pendingPlainLines: string[] = [];

  function flushPlainLines(): void {
    if (pendingPlainLines.length === 0) return;
    const combined = pendingPlainLines.join("\n").trim();
    if (!combined) {
      pendingPlainLines = [];
      return;
    }

    const parentId = currentHeadingId ?? stack[stack.length - 1].tempId;
    const id = newTempId(nodeIndex++);
    nodes.push({
      tempId: id,
      parentTempId: parentId,
      text: combined,
      details: "",
      note: "",
      confidence: 0.7,  // manual input confidence
      sourceRef,
      attributes: {},
    });
    pendingPlainLines = [];
  }

  for (const rawLine of lines) {
    const line = rawLine;

    // Check for heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushPlainLines();

      const level = Math.min(headingMatch[1].length, maxDepth);
      const headingText = headingMatch[2].trim();

      // Pop stack until we find a parent with level < current
      while (stack.length > 1 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const parentTempId = stack[stack.length - 1].tempId;
      const id = newTempId(nodeIndex++);
      nodes.push({
        tempId: id,
        parentTempId: parentTempId,
        text: headingText,
        details: "",
        note: "",
        confidence: 0.7,
        sourceRef,
        attributes: {},
      });

      stack.push({ tempId: id, level });
      currentHeadingId = id;
      continue;
    }

    // Check for bullet item
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (bulletMatch) {
      flushPlainLines();

      const bulletText = bulletMatch[1].trim();
      const parentId = currentHeadingId ?? stack[stack.length - 1].tempId;
      const id = newTempId(nodeIndex++);
      nodes.push({
        tempId: id,
        parentTempId: parentId,
        text: bulletText,
        details: "",
        note: "",
        confidence: 0.7,
        sourceRef,
        attributes: {},
      });
      continue;
    }

    // Plain text line -- accumulate
    if (line.trim()) {
      pendingPlainLines.push(line.trim());
    } else if (pendingPlainLines.length > 0) {
      // Empty line flushes accumulated plain text
      flushPlainLines();
    }
  }

  flushPlainLines();

  // If no structure was found, create a single node
  if (nodes.length === 0 && text.trim()) {
    nodes.push({
      tempId: newTempId(nodeIndex),
      parentTempId: null,
      text: text.trim(),
      details: "",
      note: "",
      confidence: 0.7,
      sourceRef,
      attributes: {},
    });
  }

  return nodes;
}

/**
 * Parse plain text into nodes.
 * Line breaks create separate nodes under a common root.
 */
export function parsePlainTextToNodes(
  text: string,
  sourceRef: string,
): DraftNode[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (lines.length === 1) {
    return [
      {
        tempId: newTempId(0),
        parentTempId: null,
        text: lines[0],
        details: "",
        note: "",
        confidence: 0.7,
        sourceRef,
        attributes: {},
      },
    ];
  }

  // Multiple lines: first line becomes root, rest become children
  const nodes: DraftNode[] = [];
  const rootId = newTempId(0);
  nodes.push({
    tempId: rootId,
    parentTempId: null,
    text: lines[0],
    details: "",
    note: "",
    confidence: 0.7,
    sourceRef,
    attributes: {},
  });

  for (let i = 1; i < lines.length; i++) {
    nodes.push({
      tempId: newTempId(i),
      parentTempId: rootId,
      text: lines[i],
      details: "",
      note: "",
      confidence: 0.7,
      sourceRef,
      attributes: {},
    });
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Extract title from content
// ---------------------------------------------------------------------------

function extractTitle(sourceType: FlashSourceType, content: string): string {
  if (sourceType === "markdown") {
    const match = content.match(/^#\s+(.+)$/m);
    if (match) return match[1].trim();
  }
  // Use first non-empty line, truncated
  const firstLine = content.split(/\r?\n/).find((l) => l.trim());
  if (firstLine) {
    const trimmed = firstLine.trim();
    return trimmed.length > 60 ? trimmed.slice(0, 57) + "..." : trimmed;
  }
  return "(untitled)";
}

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------

export function ingestSingle(request: FlashIngestRequest): FlashDraft {
  const { mapId, sourceType, content, options } = request;

  if (!mapId || !content || !content.trim()) {
    throw new Error("mapId and content are required.");
  }

  if (sourceType !== "text" && sourceType !== "markdown") {
    throw new Error(`Unsupported sourceType: ${sourceType}. Phase 1 supports "text" and "markdown".`);
  }

  const maxDepth = options?.maxDepth ?? 4;
  const sourceRef = `${sourceType}:inline`;

  // Parse content into nodes
  let draftNodes: DraftNode[];
  if (sourceType === "markdown") {
    draftNodes = parseMarkdownToNodes(content, sourceRef, maxDepth);
  } else {
    draftNodes = parsePlainTextToNodes(content, sourceRef);
  }

  const title = extractTitle(sourceType, content);
  const now = new Date().toISOString();
  const draftId = newDraftId();

  const draft: FlashDraft = {
    id: draftId,
    mapId,
    sourceType,
    sourceRef,
    title,
    extractedText: content,
    structured: {
      nodes: draftNodes,
      suggestedParentId: options?.targetNodeId ?? null,
    },
    status: "pending",
    approvedNodeIds: null,
    createdAt: now,
    updatedAt: now,
  };

  drafts.set(draftId, draft);
  return draft;
}

export function ingestBatch(
  items: FlashIngestRequest[],
): FlashDraft[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("items array is required and must not be empty.");
  }
  return items.map((item) => ingestSingle(item));
}

// ---------------------------------------------------------------------------
// Draft queries
// ---------------------------------------------------------------------------

export function listDrafts(filters?: {
  mapId?: string;
  status?: FlashDraftStatus;
}): FlashDraft[] {
  let result = Array.from(drafts.values());

  if (filters?.mapId) {
    result = result.filter((d) => d.mapId === filters.mapId);
  }
  if (filters?.status) {
    result = result.filter((d) => d.status === filters.status);
  }

  // Sort by createdAt descending
  result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return result;
}

export function getDraft(draftId: string): FlashDraft | undefined {
  return drafts.get(draftId);
}

export function deleteDraft(draftId: string): boolean {
  return drafts.delete(draftId);
}

// ---------------------------------------------------------------------------
// Approve
// ---------------------------------------------------------------------------

/**
 * Approve a draft and commit its nodes to the model.
 *
 * Returns the list of committed node IDs.
 */
export function approveDraft(
  draftId: string,
  request: FlashApproveRequest,
  model: RapidMvpModel,
): { committedNodeIds: string[]; parentId: string } {
  const draft = drafts.get(draftId);
  if (!draft) {
    throw new Error(`Draft not found: ${draftId}`);
  }
  if (draft.status !== "pending") {
    throw new Error(`Draft ${draftId} is not pending (status: ${draft.status}).`);
  }

  const { mode, selectedNodeIds, targetParentId, edits } = request;

  // Determine which nodes to commit
  let nodesToCommit: DraftNode[];
  if (mode === "all") {
    nodesToCommit = [...draft.structured.nodes];
  } else if (mode === "partial") {
    if (!selectedNodeIds || selectedNodeIds.length === 0) {
      throw new Error("selectedNodeIds is required for partial approval.");
    }
    const selected = new Set(selectedNodeIds);
    nodesToCommit = draft.structured.nodes.filter((n) => selected.has(n.tempId));

    // Auto-include ancestor nodes that are needed for hierarchy
    const allTempIds = new Set(draft.structured.nodes.map((n) => n.tempId));
    const nodeByTempId = new Map(draft.structured.nodes.map((n) => [n.tempId, n]));
    const finalSet = new Set(nodesToCommit.map((n) => n.tempId));

    for (const node of nodesToCommit) {
      let current = node;
      while (current.parentTempId && allTempIds.has(current.parentTempId) && !finalSet.has(current.parentTempId)) {
        finalSet.add(current.parentTempId);
        current = nodeByTempId.get(current.parentTempId)!;
      }
    }

    nodesToCommit = draft.structured.nodes.filter((n) => finalSet.has(n.tempId));
  } else {
    throw new Error(`Invalid mode: ${mode}. Must be "all" or "partial".`);
  }

  // Apply edits
  if (edits) {
    for (const node of nodesToCommit) {
      const edit = edits[node.tempId];
      if (edit) {
        if (edit.text !== undefined) node.text = edit.text;
        if (edit.details !== undefined) node.details = edit.details;
        if (edit.note !== undefined) node.note = edit.note;
        // Editing = confidence 0.8
        node.confidence = 0.8;
      }
    }
  }

  // Determine parent in the model
  const parentId = targetParentId
    ?? draft.structured.suggestedParentId
    ?? model.state.rootId;

  // Ensure parent exists in model
  if (!model.state.nodes[parentId]) {
    throw new Error(`Target parent node not found: ${parentId}`);
  }

  // Ensure _inbox scope exists
  const inboxNodeId = ensureInboxNode(model, parentId);

  // Map tempId -> real nodeId
  const tempToReal = new Map<string, string>();
  const committedNodeIds: string[] = [];
  const now = new Date().toISOString();

  // Process in order (parents before children)
  for (const draftNode of nodesToCommit) {
    let realParentId: string;
    if (draftNode.parentTempId && tempToReal.has(draftNode.parentTempId)) {
      realParentId = tempToReal.get(draftNode.parentTempId)!;
    } else {
      realParentId = inboxNodeId;
    }

    const nodeId = model.addNode(realParentId, draftNode.text);
    tempToReal.set(draftNode.tempId, nodeId);
    committedNodeIds.push(nodeId);

    // Set node properties via direct mutation (model exposes state)
    const node = model.state.nodes[nodeId];
    if (node) {
      node.details = draftNode.details;
      node.note = draftNode.note;
      node.attributes = {
        ...draftNode.attributes,
        [FLASH_ATTR.BAND]: "flash",
        [FLASH_ATTR.SOURCE_TYPE]: draft.sourceType,
        [FLASH_ATTR.SOURCE_URL]: draft.sourceRef,
        [FLASH_ATTR.CAPTURED_AT]: now,
        [FLASH_ATTR.CONFIDENCE]: String(draftNode.confidence),
        [FLASH_ATTR.STATUS]: "draft",
      };
    }
  }

  // Update draft status
  if (mode === "all") {
    draft.status = "approved";
  } else {
    draft.status = "partial";
    draft.approvedNodeIds = committedNodeIds;
  }
  draft.updatedAt = new Date().toISOString();

  return { committedNodeIds, parentId: inboxNodeId };
}

// ---------------------------------------------------------------------------
// _inbox node helper
// ---------------------------------------------------------------------------

const INBOX_TEXT = "_inbox";

function ensureInboxNode(model: RapidMvpModel, fallbackParentId: string): string {
  // Look for existing _inbox node under root
  const root = model.state.nodes[model.state.rootId];
  if (root) {
    for (const childId of root.children) {
      const child = model.state.nodes[childId];
      if (child && child.text === INBOX_TEXT) {
        return childId;
      }
    }
  }

  // Create _inbox node under root
  return model.addNode(model.state.rootId, INBOX_TEXT);
}

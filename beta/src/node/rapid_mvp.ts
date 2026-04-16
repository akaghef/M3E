"use strict";

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import type { TreeNode, AppState, SavedMap, AliasAccess, GraphLink, LinkDirection, LinkStyle } from "../shared/types";
import type { ScopedReadResult, ScopedWriteResult } from "../shared/scope_types";

type SqliteDatabase = InstanceType<typeof Database>;

type SqliteMapRow = {
  version: number;
  savedAt?: string;
  stateJson: string;
};

type SqliteMapListRow = {
  id: string;
  version: number;
  savedAt: string;
  stateJson: string;
  tags: string | null;
  archived: number | null;
  pinned: number | null;
  source: string | null;
};

export type MapSource = { kind: "obsidian"; path: string };

export interface MapSummaryInternal {
  id: string;
  label: string;
  savedAt: string;
  nodeCount: number;
  charCount: number;
  tags: string[];
  archived: boolean;
  pinned: boolean;
  source?: MapSource;
}

export interface ListMapsOptions {
  /** When true, archived maps are also returned. Default: false. */
  includeArchived?: boolean;
}

class RapidMvpModel {
  state: AppState;
  undoStack: AppState[];
  redoStack: AppState[];
  readonly maxHistory = 200;

  constructor(rootText = "Root") {
    const rootId = this._newId();
    this.state = {
      rootId,
      nodes: {
        [rootId]: {
          id: rootId,
          parentId: null,
          children: [],
          text: rootText,
          collapsed: false,
          details: "",
          note: "",
          attributes: {},
          link: "",
        },
      },
      links: {},
    };

    this.undoStack = [];
    this.redoStack = [];
  }

  _newId(): string {
    return `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  _cloneState(): AppState {
    return JSON.parse(JSON.stringify(this.state)) as AppState;
  }

  _normalizeNode(node: TreeNode): TreeNode {
    const normalizedType = node.nodeType ?? "text";
    return {
      ...node,
      nodeType: normalizedType,
      scopeId: node.scopeId ?? undefined,
      targetNodeId: node.targetNodeId ?? undefined,
      aliasLabel: node.aliasLabel ?? undefined,
      access: normalizedType === "alias" ? (node.access ?? "read") : undefined,
      targetSnapshotLabel: node.targetSnapshotLabel ?? undefined,
      isBroken: normalizedType === "alias" ? Boolean(node.isBroken) : undefined,
    };
  }

  _normalizeLink(link: GraphLink): GraphLink {
    return {
      ...link,
      relationType: link.relationType ?? undefined,
      label: link.label ?? undefined,
      direction: link.direction ?? "none",
      style: link.style ?? "default",
    };
  }

  _pushHistory(): void {
    this.undoStack.push(this._cloneState());
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  _requireNode(nodeId: string): TreeNode {
    const node = this.state.nodes[nodeId];
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    const normalized = this._normalizeNode(node);
    this.state.nodes[nodeId] = normalized;
    return normalized;
  }

  _replaceNode(node: TreeNode): void {
    this.state.nodes[node.id] = this._normalizeNode(node);
  }

  _ensureLinks(): Record<string, GraphLink> {
    if (!this.state.links) {
      this.state.links = {};
    }
    return this.state.links;
  }

  _deleteLinksForNode(nodeId: string): void {
    const links = this._ensureLinks();
    Object.keys(links).forEach((linkId) => {
      const link = links[linkId];
      if (!link) {
        return;
      }
      if (link.sourceNodeId === nodeId || link.targetNodeId === nodeId) {
        delete links[linkId];
      }
    });
  }

  _displayLabel(node: TreeNode): string {
    if (node.aliasLabel && node.aliasLabel.trim().length > 0) {
      return node.aliasLabel;
    }
    if (node.text && node.text.trim().length > 0) {
      return node.text;
    }
    return "Untitled";
  }

  _markAliasesBroken(targetNodeId: string, targetLabel: string): void {
    Object.values(this.state.nodes).forEach((node) => {
      const normalized = this._normalizeNode(node);
      if (normalized.nodeType !== "alias" || normalized.targetNodeId !== targetNodeId) {
        return;
      }
      normalized.isBroken = true;
      normalized.targetSnapshotLabel = targetLabel;
      normalized.text = normalized.aliasLabel
        ? `${normalized.aliasLabel} → ${targetLabel} (deleted)`
        : `${targetLabel} (deleted)`;
      this._replaceNode(normalized);
    });
  }

  addNode(parentId: string, text = "New Node", index: number | null = null): string {
    const parent = this._requireNode(parentId);
    this._pushHistory();

    const id = this._newId();
    const node: TreeNode = {
      id,
      parentId,
      children: [],
      nodeType: "text",
      text,
      collapsed: false,
      details: "",
      note: "",
      attributes: {},
      link: "",
    };

    this.state.nodes[id] = node;

    if (index === null || index < 0 || index > parent.children.length) {
      parent.children.push(id);
    } else {
      parent.children.splice(index, 0, id);
    }

    return id;
  }

  addAlias(parentId: string, targetNodeId: string, options?: {
    aliasLabel?: string;
    access?: AliasAccess;
    scopeId?: string;
  }): string {
    const parent = this._requireNode(parentId);
    const target = this._requireNode(targetNodeId);
    if (target.nodeType === "alias") {
      throw new Error("Alias cannot target another alias.");
    }

    this._pushHistory();

    const id = this._newId();
    const displayLabel = options?.aliasLabel?.trim() || this._displayLabel(target);
    const node: TreeNode = {
      id,
      parentId,
      children: [],
      nodeType: "alias",
      scopeId: options?.scopeId,
      text: displayLabel,
      collapsed: false,
      details: "",
      note: "",
      attributes: {},
      link: "",
      targetNodeId,
      aliasLabel: options?.aliasLabel,
      access: options?.access ?? "read",
      targetSnapshotLabel: undefined,
      isBroken: false,
    };

    this.state.nodes[id] = node;
    parent.children.push(id);
    return id;
  }

  /**
   * Change an alias node's access level (read / write).
   * Per Scope_and_Alias.md: default is read, write aliases can forward edits to target.
   */
  setAliasAccess(aliasId: string, access: AliasAccess): void {
    const node = this._requireNode(aliasId);
    if (node.nodeType !== "alias") {
      throw new Error(`Node ${aliasId} is not an alias.`);
    }
    if (access !== "read" && access !== "write") {
      throw new Error(`Invalid alias access: ${String(access)}`);
    }
    this._pushHistory();
    node.access = access;
  }

  /**
   * Rename an alias: updates aliasLabel (not target). Per spec, alias rename
   * is aliasLabel editing by default. Pass empty/undefined to clear aliasLabel
   * (alias then displays target's current label).
   */
  renameAlias(aliasId: string, aliasLabel: string | null | undefined): void {
    const node = this._requireNode(aliasId);
    if (node.nodeType !== "alias") {
      throw new Error(`Node ${aliasId} is not an alias.`);
    }
    this._pushHistory();
    const trimmed = (aliasLabel ?? "").trim();
    if (trimmed.length === 0) {
      node.aliasLabel = undefined;
    } else {
      node.aliasLabel = trimmed;
    }
    // Refresh visible text (not applicable if broken — keep "(deleted)" display)
    if (!node.isBroken) {
      if (trimmed.length > 0) {
        node.text = trimmed;
      } else if (node.targetNodeId) {
        const target = this.state.nodes[node.targetNodeId];
        if (target) node.text = this._displayLabel(target);
      }
    }
  }

  /**
   * Resolve alias to its canonical target node. Returns null if broken or missing.
   * alias -> alias chains are already forbidden, so single hop is sufficient.
   */
  resolveAliasTarget(aliasId: string): TreeNode | null {
    const node = this._requireNode(aliasId);
    if (node.nodeType !== "alias") {
      throw new Error(`Node ${aliasId} is not an alias.`);
    }
    if (node.isBroken || !node.targetNodeId) return null;
    return this.state.nodes[node.targetNodeId] ?? null;
  }

  /**
   * Edit the target node's text through a write-alias. Read-aliases and
   * broken aliases cannot forward edits. Per spec section "access control".
   */
  editViaAlias(aliasId: string, newText: string): void {
    const node = this._requireNode(aliasId);
    if (node.nodeType !== "alias") {
      throw new Error(`Node ${aliasId} is not an alias.`);
    }
    if (node.isBroken) {
      throw new Error(`Alias ${aliasId} is broken; cannot forward edits.`);
    }
    if ((node.access ?? "read") !== "write") {
      throw new Error(`Alias ${aliasId} is read-only; cannot forward edits to target.`);
    }
    if (!node.targetNodeId) {
      throw new Error(`Alias ${aliasId} has no target.`);
    }
    const target = this.state.nodes[node.targetNodeId];
    if (!target) {
      throw new Error(`Alias ${aliasId} target is missing.`);
    }
    this.editNode(target.id, newText);
  }

  addLink(sourceNodeId: string, targetNodeId: string, options?: {
    relationType?: string;
    label?: string;
    direction?: LinkDirection;
    style?: LinkStyle;
  }): string {
    const source = this._requireNode(sourceNodeId);
    const target = this._requireNode(targetNodeId);
    if (source.nodeType === "alias" || target.nodeType === "alias") {
      throw new Error("Graph links cannot target alias nodes in Beta.");
    }
    if (sourceNodeId === targetNodeId) {
      throw new Error("Graph links cannot connect a node to itself.");
    }

    this._pushHistory();

    const id = this._newId();
    this._ensureLinks()[id] = this._normalizeLink({
      id,
      sourceNodeId,
      targetNodeId,
      relationType: options?.relationType,
      label: options?.label,
      direction: options?.direction,
      style: options?.style,
    });
    return id;
  }

  removeLink(linkId: string): void {
    const links = this._ensureLinks();
    if (!links[linkId]) {
      throw new Error(`Link not found: ${linkId}`);
    }
    this._pushHistory();
    delete links[linkId];
  }

  addSibling(nodeId: string, text = "New Sibling", after = true): string {
    const node = this._requireNode(nodeId);
    if (node.parentId === null) {
      throw new Error("Root node cannot have siblings.");
    }

    const parent = this._requireNode(node.parentId);
    const currentIndex = parent.children.indexOf(nodeId);
    const insertIndex = after ? currentIndex + 1 : currentIndex;
    return this.addNode(parent.id, text, insertIndex);
  }

  editNode(nodeId: string, newText: string): void {
    const node = this._requireNode(nodeId);
    this._pushHistory();
    node.text = String(newText);
  }

  deleteNode(nodeId: string): void {
    const node = this._requireNode(nodeId);
    if (node.parentId === null) {
      throw new Error("Root node cannot be deleted.");
    }

    this._pushHistory();

    const parent = this._requireNode(node.parentId);
    parent.children = parent.children.filter((id) => id !== nodeId);

    const toDelete: string[] = [nodeId];
    while (toDelete.length > 0) {
      const current = toDelete.pop()!;
      const currentNode = this.state.nodes[current];
      if (!currentNode) {
        continue;
      }
      this._markAliasesBroken(current, this._displayLabel(this._normalizeNode(currentNode)));
      this._deleteLinksForNode(current);
      toDelete.push(...currentNode.children);
      delete this.state.nodes[current];
    }
  }

  reparentNode(nodeId: string, newParentId: string, index: number | null = null): void {
    this._requireNode(nodeId);
    this._requireNode(newParentId);

    const nodeBeforeCheck = this.state.nodes[nodeId]!;
    if (nodeBeforeCheck.parentId === null) {
      throw new Error("Root node cannot be reparented.");
    }

    if (nodeId === newParentId) {
      throw new Error("A node cannot be reparented to itself.");
    }

    if (this._isDescendant(newParentId, nodeId)) {
      throw new Error("Cycle detected: cannot move node under its descendant.");
    }

    this._pushHistory();

    // Re-fetch references after _isDescendant / _pushHistory to avoid stale pointers
    const node = this.state.nodes[nodeId]!;
    const newParent = this.state.nodes[newParentId]!;

    const oldParent = this._requireNode(node.parentId!);
    oldParent.children = oldParent.children.filter((id) => id !== nodeId);

    if (index === null || index < 0 || index > newParent.children.length) {
      newParent.children.push(nodeId);
    } else {
      newParent.children.splice(index, 0, nodeId);
    }

    node.parentId = newParentId;
  }

  undo(): boolean {
    if (this.undoStack.length === 0) {
      return false;
    }
    this.redoStack.push(this._cloneState());
    this.state = this.undoStack.pop()!;
    return true;
  }

  redo(): boolean {
    if (this.redoStack.length === 0) {
      return false;
    }
    this.undoStack.push(this._cloneState());
    this.state = this.redoStack.pop()!;
    return true;
  }

  _isDescendant(candidateDescendantId: string, ancestorId: string): boolean {
    const ancestor = this._requireNode(ancestorId);
    const stack: string[] = [...ancestor.children];
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (currentId === candidateDescendantId) {
        return true;
      }
      const current = this.state.nodes[currentId];
      if (current) {
        stack.push(...current.children);
      }
    }
    return false;
  }

  queryNodeIds(scopeRootId: string | null = null): string[] {
    const rootId = scopeRootId ?? this.state.rootId;
    this._requireNode(rootId);
    const result: string[] = [];
    const stack: string[] = [rootId];
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      const node = this.state.nodes[currentId];
      if (!node) {
        continue;
      }
      result.push(currentId);
      for (let i = node.children.length - 1; i >= 0; i -= 1) {
        stack.push(node.children[i]!);
      }
    }
    return result;
  }

  queryNodes(scopeRootId: string | null = null): TreeNode[] {
    return this.queryNodeIds(scopeRootId).map((nodeId) => this.state.nodes[nodeId]!);
  }

  /**
   * Find all alias nodes that point to the given canonical node.
   * Returns array of alias node IDs. Useful for reverse-lookup / coverage views.
   */
  getAliasesFor(targetNodeId: string): string[] {
    return Object.values(this.state.nodes)
      .filter((n) => n.nodeType === "alias" && n.targetNodeId === targetNodeId)
      .map((n) => n.id);
  }

  validate(): string[] {
    const errors: string[] = [];
    const nodes = this.state.nodes;
    const root = nodes[this.state.rootId];

    if (!root) {
      errors.push("Root node is missing.");
      return errors;
    }

    Object.values(nodes).forEach((node) => {
      const normalized = this._normalizeNode(node);
      if (node.parentId !== null && !nodes[node.parentId]) {
        errors.push(`Node ${node.id} has missing parent: ${node.parentId}`);
      }

      node.children.forEach((childId) => {
        if (!nodes[childId]) {
          errors.push(`Node ${node.id} has missing child reference: ${childId}`);
          return;
        }
        if (nodes[childId]!.parentId !== node.id) {
          errors.push(`Parent/child mismatch: ${node.id} -> ${childId}`);
        }
      });

      if (normalized.nodeType === "alias") {
        if (normalized.children.length > 0) {
          errors.push(`Alias node ${node.id} cannot have children.`);
        }

        if (normalized.access !== "read" && normalized.access !== "write") {
          errors.push(`Alias node ${node.id} has invalid access: ${String(normalized.access)}`);
        }

        if (!normalized.targetNodeId) {
          errors.push(`Alias node ${node.id} is missing targetNodeId.`);
        } else {
          const target = nodes[normalized.targetNodeId];
          if (!target) {
            if (!normalized.isBroken || !normalized.targetSnapshotLabel) {
              errors.push(`Alias node ${node.id} points to missing target: ${normalized.targetNodeId}`);
            }
          } else {
            const normalizedTarget = this._normalizeNode(target);
            if (normalizedTarget.nodeType === "alias") {
              errors.push(`Alias node ${node.id} cannot target alias node ${normalized.targetNodeId}.`);
            }
            if (normalized.isBroken) {
              errors.push(`Alias node ${node.id} is marked broken but target exists.`);
            }
          }
        }
      } else {
        if (normalized.targetNodeId) {
          errors.push(`Non-alias node ${node.id} cannot define targetNodeId.`);
        }
        if (normalized.access) {
          errors.push(`Non-alias node ${node.id} cannot define alias access.`);
        }
        if (normalized.isBroken) {
          errors.push(`Non-alias node ${node.id} cannot be marked broken.`);
        }
      }
    });

    const links = this.state.links ?? {};
    Object.values(links).forEach((link) => {
      const normalized = this._normalizeLink(link);
      const source = nodes[normalized.sourceNodeId];
      const target = nodes[normalized.targetNodeId];
      if (!source) {
        errors.push(`Link ${normalized.id} has missing source node: ${normalized.sourceNodeId}`);
      }
      if (!target) {
        errors.push(`Link ${normalized.id} has missing target node: ${normalized.targetNodeId}`);
      }
      if (normalized.sourceNodeId === normalized.targetNodeId) {
        errors.push(`Link ${normalized.id} cannot connect a node to itself.`);
      }
      if (source && this._normalizeNode(source).nodeType === "alias") {
        errors.push(`Link ${normalized.id} cannot use alias source node: ${normalized.sourceNodeId}`);
      }
      if (target && this._normalizeNode(target).nodeType === "alias") {
        errors.push(`Link ${normalized.id} cannot use alias target node: ${normalized.targetNodeId}`);
      }
      if (!["none", "forward", "backward", "both"].includes(normalized.direction ?? "none")) {
        errors.push(`Link ${normalized.id} has invalid direction: ${String(normalized.direction)}`);
      }
      if (!["default", "dashed", "soft", "emphasis"].includes(normalized.style ?? "default")) {
        errors.push(`Link ${normalized.id} has invalid style: ${String(normalized.style)}`);
      }
    });

    const visited = new Set<string>();
    const inStack = new Set<string>();
    const dfs = (nodeId: string): void => {
      if (inStack.has(nodeId)) {
        errors.push(`Cycle detected at node: ${nodeId}`);
        return;
      }
      if (visited.has(nodeId)) {
        return;
      }
      visited.add(nodeId);
      inStack.add(nodeId);

      const node = nodes[nodeId];
      if (node) {
        node.children.forEach((childId) => dfs(childId));
      }
      inStack.delete(nodeId);
    };

    dfs(this.state.rootId);

    const disconnected = Object.keys(nodes).filter((id) => !visited.has(id));
    if (disconnected.length > 0) {
      errors.push(`Disconnected nodes: ${disconnected.join(", ")}`);
    }

    return errors;
  }

  toJSON(): AppState {
    return this._cloneState();
  }

  static fromJSON(jsonState: AppState): RapidMvpModel {
    const model = new RapidMvpModel("tmp");
    model.state = JSON.parse(JSON.stringify(jsonState)) as AppState;
    if (!model.state.nodes || typeof model.state.nodes !== "object") {
      model.state.nodes = {};
    }
    Object.keys(model.state.nodes).forEach((nodeId) => {
      model.state.nodes[nodeId] = model._normalizeNode(model.state.nodes[nodeId]!);
    });
    const links = model.state.links ?? {};
    model.state.links = {};
    Object.keys(links).forEach((linkId) => {
      model.state.links![linkId] = model._normalizeLink(links[linkId]!);
    });
    model.undoStack = [];
    model.redoStack = [];
    return model;
  }

  private static openSqlite(dbPath: string): SqliteDatabase {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        saved_at TEXT NOT NULL,
        state_json TEXT NOT NULL
      )
    `);

    // ALTER TABLE migration for HOME page (tags, archived).
    // SQLite has no IF NOT EXISTS for ADD COLUMN, so we inspect pragma first.
    const cols = db.prepare(`PRAGMA table_info(documents)`).all() as Array<{ name: string }>;
    const colNames = new Set(cols.map((c) => c.name));
    if (!colNames.has("tags")) {
      db.exec(`ALTER TABLE documents ADD COLUMN tags TEXT`);
    }
    if (!colNames.has("archived")) {
      db.exec(`ALTER TABLE documents ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`);
    }
    if (!colNames.has("pinned")) {
      db.exec(`ALTER TABLE documents ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`);
    }
    if (!colNames.has("source")) {
      db.exec(`ALTER TABLE documents ADD COLUMN source TEXT`);
    }

    return db;
  }

  // ---------------------------------------------------------------------------
  // HOME page support: map-level CRUD & metadata
  // ---------------------------------------------------------------------------

  private static parseTagsColumn(raw: string | null): string[] {
    if (!raw) return [];
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (Array.isArray(parsed)) {
          return parsed
            .filter((t): t is string => typeof t === "string")
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
        }
      } catch {
        // fall through to comma-split
      }
    }
    return trimmed
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  private static computeStateMetrics(stateJson: string): { label: string; nodeCount: number; charCount: number } {
    let label = "Untitled";
    let nodeCount = 0;
    let charCount = 0;
    try {
      const state = JSON.parse(stateJson) as Partial<AppState>;
      const nodes = (state?.nodes ?? {}) as Record<string, TreeNode>;
      const ids = Object.keys(nodes);
      nodeCount = ids.length;
      for (const id of ids) {
        const n = nodes[id]!;
        charCount += (n.text?.length ?? 0) + (n.details?.length ?? 0) + (n.note?.length ?? 0);
      }
      const rootId = state?.rootId;
      if (rootId && nodes[rootId] && typeof nodes[rootId]!.text === "string") {
        const t = nodes[rootId]!.text.trim();
        if (t.length > 0) label = t;
      }
    } catch {
      // Treat as empty map — keep defaults.
    }
    return { label, nodeCount, charCount };
  }

  private static parseSourceColumn(raw: string | null): MapSource | undefined {
    if (!raw) return undefined;
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (
        parsed &&
        typeof parsed === "object" &&
        (parsed as { kind?: unknown }).kind === "obsidian" &&
        typeof (parsed as { path?: unknown }).path === "string"
      ) {
        return { kind: "obsidian", path: (parsed as { path: string }).path };
      }
    } catch {
      return undefined;
    }
    return undefined;
  }

  static listMaps(dbPath: string, options: ListMapsOptions = {}): MapSummaryInternal[] {
    const includeArchived = Boolean(options.includeArchived);
    const db = RapidMvpModel.openSqlite(dbPath);
    try {
      const sql = includeArchived
        ? `SELECT id, version, saved_at AS savedAt, state_json AS stateJson, tags, archived, pinned, source FROM documents ORDER BY saved_at DESC`
        : `SELECT id, version, saved_at AS savedAt, state_json AS stateJson, tags, archived, pinned, source FROM documents WHERE COALESCE(archived, 0) = 0 ORDER BY saved_at DESC`;
      const rows = db.prepare(sql).all() as SqliteMapListRow[];
      return rows.map((row) => {
        const metrics = RapidMvpModel.computeStateMetrics(row.stateJson);
        const source = RapidMvpModel.parseSourceColumn(row.source);
        const summary: MapSummaryInternal = {
          id: row.id,
          label: metrics.label,
          savedAt: row.savedAt,
          nodeCount: metrics.nodeCount,
          charCount: metrics.charCount,
          tags: RapidMvpModel.parseTagsColumn(row.tags),
          archived: Number(row.archived ?? 0) === 1,
          pinned: Number(row.pinned ?? 0) === 1,
        };
        if (source) {
          summary.source = source;
        }
        return summary;
      });
    } finally {
      db.close();
    }
  }

  static mapExists(dbPath: string, mapId: string): boolean {
    const db = RapidMvpModel.openSqlite(dbPath);
    try {
      const row = db.prepare(`SELECT 1 AS hit FROM documents WHERE id = ?`).get(mapId) as { hit: number } | undefined;
      return Boolean(row);
    } finally {
      db.close();
    }
  }

  static createMap(dbPath: string, mapId: string, rootLabel = "Untitled"): void {
    if (RapidMvpModel.mapExists(dbPath, mapId)) {
      throw new Error("Map already exists.");
    }
    const model = new RapidMvpModel(rootLabel);
    model.saveToSqlite(dbPath, mapId);
  }

  static duplicateMap(dbPath: string, sourceId: string, newId: string): void {
    if (RapidMvpModel.mapExists(dbPath, newId)) {
      throw new Error("Map already exists.");
    }
    const db = RapidMvpModel.openSqlite(dbPath);
    try {
      const src = db
        .prepare(`SELECT version, saved_at AS savedAt, state_json AS stateJson, tags FROM documents WHERE id = ?`)
        .get(sourceId) as { version: number; savedAt: string; stateJson: string; tags: string | null } | undefined;
      if (!src) {
        throw new Error("Map not found.");
      }
      db.prepare(
        `INSERT INTO documents (id, version, saved_at, state_json, tags, archived)
         VALUES (@id, @version, @savedAt, @stateJson, @tags, 0)`,
      ).run({
        id: newId,
        version: src.version,
        savedAt: new Date().toISOString(),
        stateJson: src.stateJson,
        tags: src.tags,
      });
    } finally {
      db.close();
    }
  }

  static renameMap(dbPath: string, mapId: string, newLabel: string): void {
    const trimmed = newLabel.trim();
    if (trimmed.length === 0) {
      throw new Error("Invalid label.");
    }
    const db = RapidMvpModel.openSqlite(dbPath);
    try {
      const row = db
        .prepare(`SELECT version, saved_at AS savedAt, state_json AS stateJson FROM documents WHERE id = ?`)
        .get(mapId) as SqliteMapRow & { savedAt: string } | undefined;
      if (!row) {
        throw new Error("Map not found.");
      }
      const state = JSON.parse(row.stateJson) as AppState;
      const root = state?.nodes?.[state.rootId];
      if (root) {
        root.text = trimmed;
      }
      db.prepare(
        `UPDATE documents SET state_json = @stateJson, saved_at = @savedAt WHERE id = @id`,
      ).run({
        id: mapId,
        stateJson: JSON.stringify(state),
        savedAt: new Date().toISOString(),
      });
    } finally {
      db.close();
    }
  }

  static setMapTags(dbPath: string, mapId: string, tags: string[]): void {
    if (!Array.isArray(tags) || !tags.every((t) => typeof t === "string")) {
      throw new Error("Invalid tags.");
    }
    const cleaned = Array.from(new Set(tags.map((t) => t.trim()).filter((t) => t.length > 0)));
    const db = RapidMvpModel.openSqlite(dbPath);
    try {
      const result = db
        .prepare(`UPDATE documents SET tags = ? WHERE id = ?`)
        .run(JSON.stringify(cleaned), mapId);
      if (result.changes === 0) {
        throw new Error("Map not found.");
      }
    } finally {
      db.close();
    }
  }

  static setArchived(dbPath: string, mapId: string, archived: boolean): void {
    const db = RapidMvpModel.openSqlite(dbPath);
    try {
      const result = db
        .prepare(`UPDATE documents SET archived = ? WHERE id = ?`)
        .run(archived ? 1 : 0, mapId);
      if (result.changes === 0) {
        throw new Error("Map not found.");
      }
    } finally {
      db.close();
    }
  }

  static setPinned(dbPath: string, mapId: string, pinned: boolean): void {
    const db = RapidMvpModel.openSqlite(dbPath);
    try {
      const result = db
        .prepare(`UPDATE documents SET pinned = ? WHERE id = ?`)
        .run(pinned ? 1 : 0, mapId);
      if (result.changes === 0) {
        throw new Error("Map not found.");
      }
    } finally {
      db.close();
    }
  }

  static setMapSource(dbPath: string, mapId: string, source: MapSource | null): void {
    const db = RapidMvpModel.openSqlite(dbPath);
    try {
      const serialized = source ? JSON.stringify(source) : null;
      const result = db
        .prepare(`UPDATE documents SET source = ? WHERE id = ?`)
        .run(serialized, mapId);
      if (result.changes === 0) {
        throw new Error("Map not found.");
      }
    } finally {
      db.close();
    }
  }

  static deleteDocument(dbPath: string, mapId: string): void {
    const db = RapidMvpModel.openSqlite(dbPath);
    try {
      const row = db
        .prepare(`SELECT COALESCE(archived, 0) AS archived FROM documents WHERE id = ?`)
        .get(mapId) as { archived: number } | undefined;
      if (!row) {
        throw new Error("Map not found.");
      }
      if (Number(row.archived) !== 1) {
        throw new Error("Map is not archived.");
      }
      db.prepare(`DELETE FROM documents WHERE id = ?`).run(mapId);
    } finally {
      db.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Scoped read / write (agent subtree access)
  // ---------------------------------------------------------------------------

  /**
   * Collect all node ids in the subtree rooted at `scopeId`, limited to
   * `depth` levels (0 = scope only, undefined = unlimited).
   */
  static collectSubtreeIds(
    state: AppState,
    scopeId: string,
    depth: number | undefined,
  ): string[] | null {
    if (!state.nodes[scopeId]) {
      return null;
    }
    const maxDepth = depth === undefined ? Infinity : Math.max(0, Math.floor(depth));
    const ids: string[] = [];
    const stack: Array<{ id: string; d: number }> = [{ id: scopeId, d: 0 }];
    while (stack.length > 0) {
      const { id, d } = stack.pop()!;
      const node = state.nodes[id];
      if (!node) continue;
      ids.push(id);
      if (d >= maxDepth) continue;
      for (let i = node.children.length - 1; i >= 0; i -= 1) {
        stack.push({ id: node.children[i]!, d: d + 1 });
      }
    }
    return ids;
  }

  /**
   * Build a SavedMap containing only the subtree rooted at `scopeId`.
   * Links are included only when BOTH endpoints are inside the subtree.
   */
  static readScopedState(
    dbPath: string,
    mapId: string,
    scopeId: string,
    depth?: number,
  ): ScopedReadResult {
    let model: RapidMvpModel;
    try {
      model = RapidMvpModel.loadFromSqlite(dbPath, mapId);
    } catch (err) {
      // bubble as standard error — callers distinguish map-not-found at the handler level
      throw err;
    }

    const state = model.toJSON();
    const ids = RapidMvpModel.collectSubtreeIds(state, scopeId, depth);
    if (!ids) {
      return {
        ok: false,
        error: {
          code: "SCOPE_NOT_FOUND",
          message: `Scope node not found in map: ${scopeId}`,
          details: { mapId, scopeId },
        },
      };
    }
    const idSet = new Set(ids);
    const subNodes: Record<string, TreeNode> = {};
    for (const id of ids) {
      const src = state.nodes[id]!;
      // Deep clone and — for the scope root — detach parent/children above depth limit
      const clone: TreeNode = JSON.parse(JSON.stringify(src));
      if (id === scopeId) {
        clone.parentId = null;
      }
      // Filter children to those actually present in the subtree slice
      clone.children = clone.children.filter((c) => idSet.has(c));
      subNodes[id] = clone;
    }

    const subLinks: Record<string, GraphLink> = {};
    const srcLinks = state.links ?? {};
    for (const [linkId, link] of Object.entries(srcLinks)) {
      if (idSet.has(link.sourceNodeId) && idSet.has(link.targetNodeId)) {
        subLinks[linkId] = { ...link };
      }
    }

    const map: SavedMap = {
      version: 1,
      savedAt: new Date().toISOString(),
      state: {
        rootId: scopeId,
        nodes: subNodes,
        links: subLinks,
      },
    };
    return { ok: true, map, nodeCount: ids.length };
  }

  /**
   * Replace only the subtree rooted at `scopeId` within `mapId`.
   *
   * Validation rules (conservative):
   *   - scopeId must exist in the stored map
   *   - incomingState.rootId must equal scopeId
   *   - incomingState.nodes[scopeId] must exist
   *   - every child reference inside incoming nodes must also be inside
   *     incomingState.nodes (no references escaping the subtree)
   *   - every parentId (except the scope root's own) must also be inside
   *     incomingState.nodes — scope root's parentId is ignored and the
   *     stored parent is preserved
   *   - incoming links may only reference nodes inside the subtree
   *
   * On success, nodes outside the subtree are preserved unchanged; nodes
   * inside the old subtree are removed and replaced by the new subtree,
   * and links wholly inside the old subtree are removed and replaced by
   * the new links.
   */
  static writeScopedState(
    dbPath: string,
    mapId: string,
    scopeId: string,
    incomingState: AppState,
  ): ScopedWriteResult {
    const model = RapidMvpModel.loadFromSqlite(dbPath, mapId);
    const stored = model.toJSON();

    if (!stored.nodes[scopeId]) {
      return {
        ok: false,
        error: {
          code: "SCOPE_NOT_FOUND",
          message: `Scope node not found in map: ${scopeId}`,
          details: { mapId, scopeId },
        },
      };
    }

    if (!incomingState || typeof incomingState !== "object") {
      return {
        ok: false,
        error: { code: "SCOPE_INVALID", message: "Missing or invalid incoming state." },
      };
    }

    if (incomingState.rootId !== scopeId) {
      return {
        ok: false,
        error: {
          code: "SCOPE_WRITE_ROOT_MISMATCH",
          message: `Incoming state.rootId (${incomingState.rootId}) must equal scope (${scopeId}).`,
        },
      };
    }

    const incomingNodes = incomingState.nodes ?? {};
    const incomingIds = new Set(Object.keys(incomingNodes));
    if (!incomingNodes[scopeId]) {
      return {
        ok: false,
        error: { code: "SCOPE_INVALID", message: `Incoming nodes missing scope root: ${scopeId}` },
      };
    }

    // Disallow references outside the incoming subtree
    for (const [id, node] of Object.entries(incomingNodes)) {
      for (const childId of node.children ?? []) {
        if (!incomingIds.has(childId)) {
          return {
            ok: false,
            error: {
              code: "SCOPE_WRITE_OUTSIDE_REFERENCE",
              message: `Node ${id} references child outside subtree: ${childId}`,
              details: { nodeId: id, childId },
            },
          };
        }
      }
      if (id !== scopeId) {
        if (node.parentId === null || node.parentId === undefined) {
          return {
            ok: false,
            error: {
              code: "SCOPE_WRITE_OUTSIDE_REFERENCE",
              message: `Non-root node ${id} must have a parent within the subtree.`,
              details: { nodeId: id },
            },
          };
        }
        if (!incomingIds.has(node.parentId)) {
          return {
            ok: false,
            error: {
              code: "SCOPE_WRITE_OUTSIDE_REFERENCE",
              message: `Node ${id} references parent outside subtree: ${node.parentId}`,
              details: { nodeId: id, parentId: node.parentId },
            },
          };
        }
      }
    }

    // Links inside the incoming subtree — reject any that reference outside
    const incomingLinks = incomingState.links ?? {};
    for (const [linkId, link] of Object.entries(incomingLinks)) {
      if (!incomingIds.has(link.sourceNodeId) || !incomingIds.has(link.targetNodeId)) {
        return {
          ok: false,
          error: {
            code: "SCOPE_WRITE_OUTSIDE_REFERENCE",
            message: `Link ${linkId} references node outside subtree.`,
            details: { linkId },
          },
        };
      }
    }

    // Compute the old subtree under scope (full subtree, no depth limit)
    const oldIds = RapidMvpModel.collectSubtreeIds(stored, scopeId, undefined)!;
    const oldIdSet = new Set(oldIds);

    // Detect collisions: incoming nodes (other than scopeId) whose ids already
    // exist OUTSIDE the old subtree would corrupt the map — reject.
    for (const id of incomingIds) {
      if (id === scopeId) continue;
      if (stored.nodes[id] && !oldIdSet.has(id)) {
        return {
          ok: false,
          error: {
            code: "SCOPE_WRITE_OUTSIDE_REFERENCE",
            message: `Incoming node id collides with existing node outside subtree: ${id}`,
            details: { nodeId: id },
          },
        };
      }
    }

    // Build merged state:
    //   - keep stored nodes outside the old subtree
    //   - swap in incoming nodes for the subtree
    //   - preserve scope root's original parentId (reject attempts to mutate it)
    const storedScope = stored.nodes[scopeId]!;
    const incomingScope = incomingNodes[scopeId]!;
    if (
      incomingScope.parentId !== undefined &&
      incomingScope.parentId !== null &&
      incomingScope.parentId !== storedScope.parentId
    ) {
      return {
        ok: false,
        error: {
          code: "SCOPE_WRITE_PARENT_MUTATION",
          message: `Cannot mutate scope root's parent. Expected ${storedScope.parentId}, got ${incomingScope.parentId}.`,
          details: { expected: storedScope.parentId, received: incomingScope.parentId },
        },
      };
    }

    const mergedNodes: Record<string, TreeNode> = {};
    for (const [id, node] of Object.entries(stored.nodes)) {
      if (!oldIdSet.has(id)) {
        mergedNodes[id] = node;
      }
    }
    for (const [id, node] of Object.entries(incomingNodes)) {
      const clone: TreeNode = JSON.parse(JSON.stringify(node));
      if (id === scopeId) {
        clone.parentId = storedScope.parentId;
      }
      mergedNodes[id] = clone;
    }

    // Links: drop any stored link that touches the old subtree (source or target
    // inside), because those endpoints may no longer exist after replacement.
    // The caller is expected to re-create cross-subtree links from outside.
    const mergedLinks: Record<string, GraphLink> = {};
    const srcLinks = stored.links ?? {};
    for (const [linkId, link] of Object.entries(srcLinks)) {
      const touchesOld = oldIdSet.has(link.sourceNodeId) || oldIdSet.has(link.targetNodeId);
      if (!touchesOld) {
        mergedLinks[linkId] = link;
      }
    }
    for (const [linkId, link] of Object.entries(incomingLinks)) {
      mergedLinks[linkId] = link;
    }

    const mergedState: AppState = {
      ...stored,
      rootId: stored.rootId,
      nodes: mergedNodes,
      links: mergedLinks,
    };

    const mergedModel = RapidMvpModel.fromJSON(mergedState);
    const errors = mergedModel.validate();
    if (errors.length > 0) {
      return {
        ok: false,
        error: {
          code: "SCOPE_INVALID",
          message: `Invalid model after scoped write: ${errors.join(" | ")}`,
          details: { errors },
        },
      };
    }

    mergedModel.saveToSqlite(dbPath, mapId);
    return {
      ok: true,
      savedAt: new Date().toISOString(),
      replacedNodeCount: incomingIds.size,
    };
  }

  saveToFile(filePath: string): void {
    const data: SavedMap = {
      version: 1,
      savedAt: new Date().toISOString(),
      state: this.toJSON(),
    };

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  }

  saveToSqlite(dbPath: string, mapId = "default"): void {
    const data: SavedMap = {
      version: 1,
      savedAt: new Date().toISOString(),
      state: this.toJSON(),
    };

    const db = RapidMvpModel.openSqlite(dbPath);
    try {
      db.prepare(
        `
          INSERT INTO documents (id, version, saved_at, state_json)
          VALUES (@id, @version, @savedAt, @stateJson)
          ON CONFLICT(id) DO UPDATE SET
            version = excluded.version,
            saved_at = excluded.saved_at,
            state_json = excluded.state_json
        `,
      ).run({
        id: mapId,
        version: data.version,
        savedAt: data.savedAt,
        stateJson: JSON.stringify(data.state),
      });
    } finally {
      db.close();
    }
  }

  static loadFromFile(filePath: string): RapidMvpModel {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as { version?: number; state?: AppState };

    if (!parsed || !parsed.version || parsed.version < 1 || !parsed.state) {
      throw new Error("Unsupported or invalid save format.");
    }

    const model = RapidMvpModel.fromJSON(parsed.state);
    const errors = model.validate();
    if (errors.length > 0) {
      throw new Error(`Invalid model after load: ${errors.join(" | ")}`);
    }

    return model;
  }

  static loadFromSqlite(dbPath: string, mapId = "default"): RapidMvpModel {
    const savedDoc = RapidMvpModel.loadSavedMapFromSqlite(dbPath, mapId);
    const model = RapidMvpModel.fromJSON(savedDoc.state);
    const errors = model.validate();
    if (errors.length > 0) {
      throw new Error(`Invalid model after load: ${errors.join(" | ")}`);
    }

    return model;
  }

  static loadSavedMapFromSqlite(dbPath: string, mapId = "default"): SavedMap {
    const db = RapidMvpModel.openSqlite(dbPath);
    try {
      const row = db
        .prepare(
          `
            SELECT version, saved_at AS savedAt, state_json AS stateJson
            FROM documents
            WHERE id = ?
          `,
        )
        .get(mapId) as SqliteMapRow | undefined;

      if (!row) {
        throw new Error("Map not found.");
      }

      if (!row.version || row.version < 1 || !row.stateJson || !row.savedAt) {
        throw new Error("Unsupported or invalid save format.");
      }

      return {
        version: 1,
        savedAt: row.savedAt,
        state: JSON.parse(row.stateJson) as AppState,
      };
    } finally {
      db.close();
    }
  }
}

export { RapidMvpModel };

if (require.main === module) {
  const model = new RapidMvpModel("Research Root");
  const a = model.addNode(model.state.rootId, "Question");
  const b = model.addSibling(a, "Hypothesis");
  model.addNode(a, "Background");
  model.editNode(b, "Hypothesis v2");

  const errors = model.validate();
  if (errors.length > 0) {
    console.error("Validation failed:", errors);
    process.exit(1);
  }

  const assetDir = path.join(path.resolve(__dirname, "..", ".."), "data");
  const savePath = path.join(assetDir, "rapid-sample.json");
  const sqlitePath = path.join(assetDir, "rapid-sample.sqlite");
  model.saveToFile(savePath);
  model.saveToSqlite(sqlitePath, "rapid-sample");
  console.log(`Rapid MVP sample saved: ${savePath}`);
  console.log(`Rapid MVP sample saved in SQLite: ${sqlitePath} (mapId=rapid-sample)`);
}

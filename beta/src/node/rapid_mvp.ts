"use strict";

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import type { TreeNode, AppState, SavedDoc } from "../shared/types";

type SqliteDatabase = InstanceType<typeof Database>;

type SqliteDocumentRow = {
  version: number;
  stateJson: string;
};

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
          details: "",
          note: "",
          attributes: {},
          link: "",
        },
      },
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
    return node;
  }

  addNode(parentId: string, text = "New Node", index: number | null = null): string {
    const parent = this._requireNode(parentId);
    this._pushHistory();

    const id = this._newId();
    const node: TreeNode = {
      id,
      parentId,
      children: [],
      text,
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
      toDelete.push(...currentNode.children);
      delete this.state.nodes[current];
    }
  }

  reparentNode(nodeId: string, newParentId: string, index: number | null = null): void {
    const node = this._requireNode(nodeId);
    const newParent = this._requireNode(newParentId);

    if (node.parentId === null) {
      throw new Error("Root node cannot be reparented.");
    }

    if (nodeId === newParentId) {
      throw new Error("A node cannot be reparented to itself.");
    }

    if (this._isDescendant(newParentId, nodeId)) {
      throw new Error("Cycle detected: cannot move node under its descendant.");
    }

    this._pushHistory();

    const oldParent = this._requireNode(node.parentId);
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

  queryNodeIds(scopeId: string | null = null): string[] {
    const rootId = scopeId ?? this.state.rootId;
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

  queryNodes(scopeId: string | null = null): TreeNode[] {
    return this.queryNodeIds(scopeId).map((nodeId) => this.state.nodes[nodeId]!);
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
    return db;
  }

  saveToFile(filePath: string): void {
    const data: SavedDoc = {
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

  saveToSqlite(dbPath: string, documentId = "default"): void {
    const data: SavedDoc = {
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
        id: documentId,
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

    if (!parsed || parsed.version !== 1 || !parsed.state) {
      throw new Error("Unsupported or invalid save format.");
    }

    const model = RapidMvpModel.fromJSON(parsed.state);
    const errors = model.validate();
    if (errors.length > 0) {
      throw new Error(`Invalid model after load: ${errors.join(" | ")}`);
    }

    return model;
  }

  static loadFromSqlite(dbPath: string, documentId = "default"): RapidMvpModel {
    const db = RapidMvpModel.openSqlite(dbPath);
    try {
      const row = db
        .prepare(
          `
            SELECT version, state_json AS stateJson
            FROM documents
            WHERE id = ?
          `,
        )
        .get(documentId) as SqliteDocumentRow | undefined;

      if (!row) {
        throw new Error("Document not found.");
      }

      if (row.version !== 1 || !row.stateJson) {
        throw new Error("Unsupported or invalid save format.");
      }

      const parsedState = JSON.parse(row.stateJson) as AppState;
      const model = RapidMvpModel.fromJSON(parsedState);
      const errors = model.validate();
      if (errors.length > 0) {
        throw new Error(`Invalid model after load: ${errors.join(" | ")}`);
      }

      return model;
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

  // Resolve path relative to the mvp/ root, regardless of compiled location.
  const savePath = path.join(path.resolve(__dirname, "..", ".."), "data", "rapid-sample.json");
  const sqlitePath = path.join(path.resolve(__dirname, "..", ".."), "data", "rapid-mvp.sqlite");
  model.saveToFile(savePath);
  model.saveToSqlite(sqlitePath, "rapid-sample");
  console.log(`Rapid MVP sample saved: ${savePath}`);
  console.log(`Rapid MVP sample saved in SQLite: ${sqlitePath} (docId=rapid-sample)`);
}

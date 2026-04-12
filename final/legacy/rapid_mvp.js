"use strict";

const fs = require("fs");
const path = require("path");

class RapidMvpModel {
  constructor(rootText = "Root") {
    const rootId = this._newId();
    this.state = {
      rootId,
      selectedId: rootId,
      nodes: {
        [rootId]: {
          id: rootId,
          parentId: null,
          children: [],
          text: rootText,
          collapsed: false,
        },
      },
    };

    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 200;
  }

  _newId() {
    return `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  _cloneState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  _pushHistory() {
    this.undoStack.push(this._cloneState());
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  _requireNode(nodeId) {
    const node = this.state.nodes[nodeId];
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    return node;
  }

  selectNode(nodeId) {
    this._requireNode(nodeId);
    this.state.selectedId = nodeId;
  }

  addNode(parentId, text = "New Node", index = null) {
    const parent = this._requireNode(parentId);
    this._pushHistory();

    const id = this._newId();
    const node = {
      id,
      parentId,
      children: [],
      text,
      collapsed: false,
    };

    this.state.nodes[id] = node;

    if (index === null || index < 0 || index > parent.children.length) {
      parent.children.push(id);
    } else {
      parent.children.splice(index, 0, id);
    }

    this.state.selectedId = id;
    return id;
  }

  addSibling(nodeId, text = "New Sibling", after = true) {
    const node = this._requireNode(nodeId);
    if (node.parentId === null) {
      throw new Error("Root node cannot have siblings.");
    }

    const parent = this._requireNode(node.parentId);
    const currentIndex = parent.children.indexOf(nodeId);
    const insertIndex = after ? currentIndex + 1 : currentIndex;
    return this.addNode(parent.id, text, insertIndex);
  }

  editNode(nodeId, newText) {
    const node = this._requireNode(nodeId);
    this._pushHistory();
    node.text = String(newText);
  }

  deleteNode(nodeId) {
    const node = this._requireNode(nodeId);
    if (node.parentId === null) {
      throw new Error("Root node cannot be deleted.");
    }

    this._pushHistory();

    const parent = this._requireNode(node.parentId);
    parent.children = parent.children.filter((id) => id !== nodeId);

    const toDelete = [nodeId];
    while (toDelete.length > 0) {
      const current = toDelete.pop();
      const currentNode = this.state.nodes[current];
      if (!currentNode) {
        continue;
      }
      toDelete.push(...currentNode.children);
      delete this.state.nodes[current];
    }

    this.state.selectedId = parent.id;
  }

  reparentNode(nodeId, newParentId, index = null) {
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
    this.state.selectedId = nodeId;
  }

  toggleCollapse(nodeId) {
    const node = this._requireNode(nodeId);
    this._pushHistory();
    node.collapsed = !node.collapsed;
  }

  undo() {
    if (this.undoStack.length === 0) {
      return false;
    }
    this.redoStack.push(this._cloneState());
    this.state = this.undoStack.pop();
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) {
      return false;
    }
    this.undoStack.push(this._cloneState());
    this.state = this.redoStack.pop();
    return true;
  }

  _isDescendant(candidateDescendantId, ancestorId) {
    const ancestor = this._requireNode(ancestorId);
    const stack = [...ancestor.children];
    while (stack.length > 0) {
      const currentId = stack.pop();
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

  validate() {
    const errors = [];
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
        if (nodes[childId].parentId !== node.id) {
          errors.push(`Parent/child mismatch: ${node.id} -> ${childId}`);
        }
      });
    });

    const visited = new Set();
    const inStack = new Set();
    const dfs = (nodeId) => {
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

  toJSON() {
    return this._cloneState();
  }

  static fromJSON(jsonState) {
    const model = new RapidMvpModel("tmp");
    model.state = JSON.parse(JSON.stringify(jsonState));
    model.undoStack = [];
    model.redoStack = [];
    return model;
  }

  saveToFile(filePath) {
    const data = {
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

  static loadFromFile(filePath) {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);

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
}

module.exports = {
  RapidMvpModel,
};

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

  // Always write under the app data directory regardless of current working directory.
  const savePath = path.join(__dirname, "..", "data", "rapid-sample.json");
  model.saveToFile(savePath);
  console.log(`Rapid MVP sample saved: ${savePath}`);
}

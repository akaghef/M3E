import type { AppState, TreeNode } from "./types";

// Level-specific boundaries and topology use the existing node attribute store.
// The canonical parent/children fields continue to describe level 0.
const PREFIX = "m3e:concreteness:";
const CREATED = `${PREFIX}created-level`;
const key = (field: string, level: number): string => `${PREFIX}${field}:${level}`;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const birth = (node: TreeNode): number => {
  const n = Number(node.attributes?.[CREATED]);
  return Number.isSafeInteger(n) && n < 0 ? n : 0;
};
const boundary = (node: TreeNode): boolean => node.nodeType === "folder";

export function hasConcretenessData(state: AppState): boolean {
  return Object.values(state.nodes).some(node => Object.keys(node.attributes || {}).some(k => k.startsWith(PREFIX)));
}

function arrange(state: AppState, source: AppState, level: number): void {
  const nodes = state.nodes;
  const originalOrder = new Map(Object.keys(nodes).map((id, i) => [id, i]));
  for (const node of Object.values(nodes)) {
    if (node.id === state.rootId) { node.parentId = null; continue; }
    const override = source.nodes[node.id]?.attributes?.[key("parent", level)];
    if (override && nodes[override] && override !== node.id) node.parentId = override;
    if (!node.parentId || !nodes[node.parentId]) node.parentId = state.rootId;
  }
  // Stale references after deletion, or malformed imported metadata, cannot
  // disconnect the displayed tree or introduce a layout recursion cycle.
  for (const node of Object.values(nodes)) {
    const seen = new Set([node.id]);
    let parent = node.parentId;
    while (parent) {
      if (seen.has(parent)) { node.parentId = state.rootId; break; }
      seen.add(parent); parent = nodes[parent]?.parentId ?? null;
    }
  }
  for (const node of Object.values(nodes)) node.children = [];
  for (const node of Object.values(nodes)) if (node.parentId) nodes[node.parentId]!.children.push(node.id);
  for (const node of Object.values(nodes)) {
    node.children.sort((a, b) => {
      const index = (id: string): number => {
        const raw = source.nodes[id]?.attributes?.[key("order", level)];
        return raw !== undefined && Number.isFinite(Number(raw)) ? Number(raw) : originalOrder.get(id)!;
      };
      return index(a) - index(b);
    });
  }
}

export function projectConcreteness(source: AppState, level: number): AppState {
  if (!Number.isSafeInteger(level)) throw new Error("Concreteness level must be an integer.");
  let state = clone(source);
  const ordered: Record<string, TreeNode> = {};
  const visit = (id: string): void => {
    const node = state.nodes[id];
    if (!node || ordered[id] || (birth(node) < 0 && id !== state.rootId)) return;
    ordered[id] = node;
    node.children.forEach(visit);
  };
  visit(state.rootId);
  state.nodes = ordered;
  for (const node of Object.values(ordered)) node.children = node.children.filter(id => Boolean(ordered[id]));

  if (level > 0) {
    const expand = (id: string, depth: number): void => {
      const node = state.nodes[id]; if (!node) return;
      const isScope = id !== state.rootId && boundary(node);
      const scopeDepth = depth + (isScope ? 1 : 0);
      if (isScope && scopeDepth <= level) node.nodeType = "text";
      const override = node.attributes[key("scope", level)];
      if (override !== undefined) node.nodeType = override === "true" ? "folder" : (node.nodeType === "folder" ? "text" : node.nodeType);
      node.children.forEach(child => expand(child, scopeDepth));
    };
    expand(state.rootId, 0);
    arrange(state, source, level);
  }
  for (let current = -1; current >= level; current--) {
    const nodes: Record<string, TreeNode> = {};
    const collect = (id: string, parent: string | null): void => {
      const node = state.nodes[id]; if (!node) return;
      let next = parent;
      if (id === state.rootId || boundary(node)) {
        const stored = source.nodes[id]!;
        nodes[id] = { ...clone(stored), parentId: parent, children: [], nodeType: "text", collapsed: false };
        next = id;
      }
      node.children.forEach(child => collect(child, next));
    };
    collect(state.rootId, null);
    for (const node of Object.values(source.nodes)) {
      if (birth(node) === current) nodes[node.id] = { ...clone(node), parentId: source.rootId, children: [], nodeType: node.nodeType === "alias" ? "alias" : "text", collapsed: false };
    }
    for (const node of Object.values(nodes)) {
      if (node.attributes[key("scope", current)] === "true") node.nodeType = "folder";
      node.collapsed = node.attributes[key("collapsed", current)] === "true";
    }
    state = { ...state, nodes };
    arrange(state, source, current);
  }
  state.links = Object.fromEntries(Object.entries(source.links || {}).filter(([, link]) => state.nodes[link.sourceNodeId] && state.nodes[link.targetNodeId]));
  return state;
}

/** A disposable ordinary AppState for the existing viewer, plus its canonical
 * source. Only actual edits are reconciled; projecting or changing level never
 * adds metadata or rewrites the source. No second map is persisted. */
export class ConcretenessView {
  source: AppState;
  state: AppState;
  private before: AppState;
  constructor(source: AppState, readonly level: number) {
    this.source = clone(source);
    this.state = projectConcreteness(this.source, level);
    this.before = clone(this.state);
  }

  commit(): AppState {
    const source = this.source, before = this.before, after = this.state, level = this.level;
    if (same(before, after)) return source;
    const removed = new Set<string>();
    const remove = (id: string): void => {
      if (removed.has(id) || after.nodes[id]) return;
      const node = source.nodes[id]; if (!node) return;
      removed.add(id); node.children.forEach(remove);
    };
    for (const id of Object.keys(before.nodes)) if (!after.nodes[id]) remove(id);
    for (const id of removed) delete source.nodes[id];
    for (const node of Object.values(source.nodes)) {
      node.children = node.children.filter(id => !removed.has(id));
      if (node.nodeType === "alias" && node.targetNodeId && removed.has(node.targetNodeId)) node.isBroken = true;
    }
    for (const [id, node] of Object.entries(after.nodes)) {
      const old = before.nodes[id];
      if (old && same(old, node)) continue;
      let stored = source.nodes[id];
      if (!stored) {
        stored = source.nodes[id] = clone(node);
        // Newly added coarse-level nodes have no level-0 topology. Keep the
        // storage tree connected; the level-0 projection omits these nodes.
        if (level < 0) {
          stored.parentId = source.rootId; stored.children = []; stored.nodeType = "text";
          stored.attributes[CREATED] = String(level);
          source.nodes[source.rootId]!.children.push(id);
        } else if (level > 0) {
          const parent = source.nodes[stored.parentId || source.rootId] || source.nodes[source.rootId]!;
          stored.parentId = parent.id;
          if (!parent.children.includes(id)) parent.children.push(id);
        }
      }
      const structural = new Set(["parentId", "children", "nodeType", "collapsed", "attributes"]);
      for (const field of Object.keys(node) as (keyof TreeNode)[]) {
        if (!structural.has(field) && (!old || !same(node[field], old[field]))) {
          (stored as unknown as Record<string, unknown>)[field] = clone(node[field] ?? null);
        }
      }
      for (const field of new Set([...Object.keys(old?.attributes || {}), ...Object.keys(node.attributes || {})])) {
        if (field.startsWith(PREFIX)) continue;
        if (old?.attributes[field] === node.attributes[field]) continue;
        if (node.attributes[field] === undefined) delete stored.attributes[field];
        else stored.attributes[field] = node.attributes[field]!;
      }
      if (level === 0) {
        stored.nodeType = node.nodeType; stored.collapsed = node.collapsed;
        stored.parentId = node.parentId;
        const hidden = stored.children.filter(id => !before.nodes[id] && !after.nodes[id] && source.nodes[id]);
        stored.children = [...node.children, ...hidden];
      } else {
        if (!old || node.parentId !== old.parentId) stored.attributes[key("parent", level)] = node.parentId || source.rootId;
        if (!old || node.nodeType !== old.nodeType) stored.attributes[key("scope", level)] = String(boundary(node));
        if (!old || node.collapsed !== old.collapsed) stored.attributes[key("collapsed", level)] = String(node.collapsed);
        if (!old || !same(node.children, old.children)) {
          node.children.forEach((child, i) => {
            const target = source.nodes[child] || after.nodes[child];
            if (target) { target.attributes[key("parent", level)] = id; target.attributes[key("order", level)] = String(i); }
          });
        }
      }
    }
    // Preserve records hidden in this projection. Derived scope/surface records
    // are only rewritten by the ordinary level-0 model synchronizer.
    for (const field of ["links", "annotations", "linearNotesByScope"] as const) {
      const prev = before[field] || {}, next = after[field] || {};
      if (same(prev, next)) continue;
      const target = (source[field] ||= {}) as Record<string, unknown>;
      for (const id of Object.keys(prev)) if (!(id in next)) delete target[id];
      for (const [id, value] of Object.entries(next)) if (!same(value, (prev as Record<string, unknown>)[id])) target[id] = clone(value);
    }
    for (const [id, link] of Object.entries(source.links || {})) if (removed.has(link.sourceNodeId) || removed.has(link.targetNodeId)) delete source.links![id];
    if (level === 0) {
      source.scopes = clone(after.scopes || {}); source.surfaces = clone(after.surfaces || {});
    }
    source.linearPanelWidth = after.linearPanelWidth;
    source.linearTextFontScale = after.linearTextFontScale;
    this.before = clone(after);
    return source;
  }
}

/** Include the selected displayed subtree and every represented node's original
 * contents. A coarse grouping may collect nodes with different original parents. */
export function concretenessSubtree(source: AppState, displayed: AppState, rootId: string): AppState {
  const included = new Set<string>();
  const original = (id: string): void => {
    if (included.has(id) || !source.nodes[id]) return;
    included.add(id); source.nodes[id]!.children.forEach(original);
  };
  const visible = (id: string): void => {
    original(id); displayed.nodes[id]?.children.forEach(visible);
  };
  visible(rootId);
  const state = clone(source); state.rootId = rootId;
  state.nodes = Object.fromEntries(Object.entries(state.nodes).filter(([id]) => included.has(id)));
  const root = state.nodes[rootId]!; root.parentId = null;
  for (const node of Object.values(state.nodes)) {
    node.children = node.children.filter(id => included.has(id));
    if (node.id !== rootId && !included.has(node.parentId || "")) {
      node.parentId = rootId; root.children.push(node.id);
    }
  }
  state.links = Object.fromEntries(Object.entries(state.links || {}).filter(([, link]) => included.has(link.sourceNodeId) && included.has(link.targetNodeId)));
  return state;
}

/** Reconnect cloned canonical contents and remap level-specific references using
 * the same ID mapping as the existing clipboard/alias cloning path. */
export function reconnectConcretenessCopies(state: AppState, idMap: Map<string, string>, roots: string[], target: string, level: number): void {
  for (const id of idMap.values()) {
    const node = state.nodes[id]!;
    for (const field of Object.keys(node.attributes)) {
      if (!field.startsWith(`${PREFIX}parent:`)) continue;
      const mapped = idMap.get(node.attributes[field]!);
      if (mapped) node.attributes[field] = mapped;
      else delete node.attributes[field];
    }
  }
  if (level === 0) for (const id of roots) delete state.nodes[id]!.attributes[CREATED];
  if (level !== 0) {
    for (const id of roots) state.nodes[id]!.attributes[key("parent", level)] = target;
    const projected = projectConcreteness(state, level);
    if (level < 0) for (const id of roots) {
      if (!projected.nodes[id]) state.nodes[id]!.attributes[CREATED] = String(level);
    }
  }
  // Coarse groups have no base-level contents. Keep their represented contents
  // reachable at level 0 while retaining the grouping through level attributes.
  for (const id of idMap.values()) {
    const node = state.nodes[id]!;
    let parent = state.nodes[node.parentId || ""];
    if (!parent || birth(parent) === 0) continue;
    const coarseParent = parent;
    while (parent && birth(parent) < 0) parent = state.nodes[parent.parentId || ""];
    const baseParent = parent || state.nodes[state.rootId]!;
    coarseParent.children = coarseParent.children.filter(child => child !== id);
    baseParent.children.push(id); node.parentId = baseParent.id;
    const parentLevel = birth(coarseParent);
    if (!node.attributes[key("parent", parentLevel)]) node.attributes[key("parent", parentLevel)] = coarseParent.id;
  }
}

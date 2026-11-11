/**
 * 木の不変量。アプリ側の規則であり、Neo4j にも SQLite にも入っていない。
 * エンジンは呼ばない。引数のノードと親リンクだけを見て、純関数として判定する。
 *
 * beta に fractional-indexing 依存は無い。兄弟順は順序キーの符号単位順で比べる。
 * これは fractional-indexing のキーが満たす比較と同じ向きで、キーの生成はしない。
 */

export type OrderKey = string;

export interface ParentLink {
  readonly parentId: string;
  readonly childId: string;
  readonly orderKey: OrderKey;
}

export interface TreeState {
  readonly nodeIds: readonly string[];
  readonly links: readonly ParentLink[];
}

export type TreeIssue =
  | { readonly code: "duplicate-node"; readonly nodeId: string }
  | { readonly code: "empty-node-id" }
  | { readonly code: "missing-node"; readonly nodeId: string }
  | { readonly code: "unknown-node"; readonly nodeId: string }
  | { readonly code: "multiple-parents"; readonly childId: string; readonly parentIds: readonly string[] }
  | { readonly code: "cycle"; readonly nodeIds: readonly string[] }
  | { readonly code: "duplicate-order-key"; readonly parentId: string; readonly orderKey: string; readonly childIds: readonly string[] }
  | { readonly code: "empty-order-key"; readonly parentId: string; readonly childId: string }
  | { readonly code: "no-parent"; readonly nodeId: string };

export type TreeResult =
  | { readonly ok: true; readonly tree: TreeState }
  | { readonly ok: false; readonly issues: readonly TreeIssue[] };

/** 順序キーの比較。負なら left が先、正なら right が先。 */
export function compareOrderKeys(left: OrderKey, right: OrderKey): -1 | 0 | 1 {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** ある親の子を、順序キーの昇順で返す。同キーは子 ID で決める。 */
export function childrenInOrder(state: TreeState, parentId: string): readonly string[] {
  return state.links
    .filter((link) => link.parentId === parentId)
    .slice()
    .sort((left, right) => {
      const byKey = compareOrderKeys(left.orderKey, right.orderKey);
      if (byKey !== 0) return byKey;
      return compareOrderKeys(left.childId, right.childId);
    })
    .map((link) => link.childId);
}

/** 子に向かっている親リンクの親 ID。単一親でないときは複数返る。 */
export function parentsOf(state: TreeState, nodeId: string): readonly string[] {
  return state.links.filter((link) => link.childId === nodeId).map((link) => link.parentId);
}

/** 単一親・循環禁止・兄弟の順序キーが一意であることを確かめる。通れば複製を返す。 */
export function validateTree(state: TreeState): TreeResult {
  const issues = collectIssues(state);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, tree: copyTree(state) };
}

/**
 * 親を付け替える。現在の木も付け替え後の木も検証を通ったときだけ新しい木を返す。
 * 循環、親の不在、兄弟キーの衝突は拒否する。
 */
export function changeParent(
  state: TreeState,
  childId: string,
  newParentId: string,
  orderKey: OrderKey,
): TreeResult {
  const current = validateTree(state);
  if (!current.ok) return current;

  const missing = missingNodeIssues(current.tree, [childId, newParentId]);
  if (missing.length > 0) return { ok: false, issues: missing };

  const links = current.tree.links.filter((link) => link.childId !== childId);
  links.push({ parentId: newParentId, childId, orderKey });
  return validateTree({ nodeIds: current.tree.nodeIds, links });
}

/**
 * 同じ親の下で順序キーだけを差し替える。通ったときだけ返す。
 * 親を持たないノードの並べ替えは拒否する。
 */
export function reorderSibling(state: TreeState, childId: string, orderKey: OrderKey): TreeResult {
  const current = validateTree(state);
  if (!current.ok) return current;

  const missing = missingNodeIssues(current.tree, [childId]);
  if (missing.length > 0) return { ok: false, issues: missing };

  const existing = current.tree.links.filter((link) => link.childId === childId);
  if (existing.length !== 1) return { ok: false, issues: [{ code: "no-parent", nodeId: childId }] };

  const parentId = existing[0]!.parentId;
  const links = current.tree.links.map((link) =>
    link.childId === childId ? { parentId, childId, orderKey } : { ...link },
  );
  return validateTree({ nodeIds: current.tree.nodeIds, links });
}

/**
 * 親リンクを外し、そのノードを根にする。子の親は変えない。
 * 外したあとも各ノードの親は高々一つで、検証を通った木だけを返す。
 */
export function detachParent(state: TreeState, childId: string): TreeResult {
  const current = validateTree(state);
  if (!current.ok) return current;

  const missing = missingNodeIssues(current.tree, [childId]);
  if (missing.length > 0) return { ok: false, issues: missing };

  const links = current.tree.links.filter((link) => link.childId !== childId);
  return validateTree({ nodeIds: current.tree.nodeIds, links });
}

function copyTree(state: TreeState): TreeState {
  return {
    nodeIds: [...state.nodeIds],
    links: state.links.map((link) => ({
      parentId: link.parentId,
      childId: link.childId,
      orderKey: link.orderKey,
    })),
  };
}

function missingNodeIssues(state: TreeState, nodeIds: readonly string[]): TreeIssue[] {
  const known = new Set(state.nodeIds);
  return nodeIds
    .filter((nodeId) => !known.has(nodeId))
    .map((nodeId) => ({ code: "missing-node" as const, nodeId }));
}

function collectIssues(state: TreeState): TreeIssue[] {
  const issues: TreeIssue[] = [];
  const seenIds = new Set<string>();

  for (const nodeId of state.nodeIds) {
    if (nodeId === "") {
      issues.push({ code: "empty-node-id" });
      continue;
    }
    if (seenIds.has(nodeId)) issues.push({ code: "duplicate-node", nodeId });
    seenIds.add(nodeId);
  }

  const known = new Set(state.nodeIds.filter((nodeId) => nodeId !== ""));
  const parentsByChild = new Map<string, string[]>();
  const childrenByParentKey = new Map<string, Map<string, string[]>>();

  for (const link of state.links) {
    if (!known.has(link.parentId)) issues.push({ code: "unknown-node", nodeId: link.parentId });
    if (!known.has(link.childId)) issues.push({ code: "unknown-node", nodeId: link.childId });
    if (link.orderKey === "") {
      issues.push({ code: "empty-order-key", parentId: link.parentId, childId: link.childId });
    }

    const parents = parentsByChild.get(link.childId);
    if (parents) parents.push(link.parentId);
    else parentsByChild.set(link.childId, [link.parentId]);

    let byKey = childrenByParentKey.get(link.parentId);
    if (!byKey) {
      byKey = new Map();
      childrenByParentKey.set(link.parentId, byKey);
    }
    const children = byKey.get(link.orderKey);
    if (children) children.push(link.childId);
    else byKey.set(link.orderKey, [link.childId]);
  }

  for (const [childId, parentIds] of parentsByChild) {
    if (parentIds.length > 1) issues.push({ code: "multiple-parents", childId, parentIds: [...parentIds] });
  }

  for (const [parentId, byKey] of childrenByParentKey) {
    for (const [orderKey, childIds] of byKey) {
      if (orderKey === "") continue;
      const distinct = [...new Set(childIds)];
      if (distinct.length > 1) {
        issues.push({ code: "duplicate-order-key", parentId, orderKey, childIds: distinct });
      }
    }
  }

  issues.push(...findCycles(known, parentsByChild));
  return dedupeIssues(issues);
}

function findCycles(known: ReadonlySet<string>, parentsByChild: ReadonlyMap<string, readonly string[]>): TreeIssue[] {
  const color = new Map<string, 0 | 1 | 2>();
  const cycles: string[][] = [];

  const visit = (nodeId: string, stack: string[]): void => {
    color.set(nodeId, 1);
    stack.push(nodeId);
    for (const parentId of parentsByChild.get(nodeId) ?? []) {
      const mark = color.get(parentId) ?? 0;
      if (mark === 1) {
        const start = stack.indexOf(parentId);
        cycles.push(start >= 0 ? stack.slice(start) : [parentId]);
      } else if (mark === 0) {
        visit(parentId, stack);
      }
    }
    stack.pop();
    color.set(nodeId, 2);
  };

  for (const nodeId of known) {
    if ((color.get(nodeId) ?? 0) === 0) visit(nodeId, []);
  }

  const seen = new Set<string>();
  const issues: TreeIssue[] = [];
  for (const cycle of cycles) {
    const key = canonicalCycle(cycle);
    if (seen.has(key)) continue;
    seen.add(key);
    const start = cycle.reduce((best, nodeId, index) => (nodeId < cycle[best]! ? index : best), 0);
    const nodeIds = [...cycle.slice(start), ...cycle.slice(0, start)];
    issues.push({ code: "cycle", nodeIds });
  }
  return issues;
}

function canonicalCycle(nodeIds: readonly string[]): string {
  if (nodeIds.length === 0) return "";
  let best = "";
  for (let index = 0; index < nodeIds.length; index += 1) {
    const rotated = [...nodeIds.slice(index), ...nodeIds.slice(0, index)].join("\0");
    if (best === "" || rotated < best) best = rotated;
  }
  return best;
}

function dedupeIssues(issues: readonly TreeIssue[]): TreeIssue[] {
  const seen = new Set<string>();
  const result: TreeIssue[] = [];
  for (const issue of issues) {
    const key = JSON.stringify(issue);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(issue);
  }
  return result;
}

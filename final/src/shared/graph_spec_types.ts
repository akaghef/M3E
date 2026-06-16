/**
 * PJ04 — Neutral Graph Specification
 *
 * Map から抽出される、実行ランタイム非依存の graph 記述。
 * この JSON は LangGraph (Python subprocess) にも、将来の TS 自前実装にも
 * 渡せる中立なコントラクト。
 *
 * 設計原則:
 *   - pure data。runtime 概念 (channel reducer 関数、callable 実体、executor
 *     内部状態) を持ち込まない。
 *   - JSON 往復可能。関数参照などは name-based (registry に解決を任せる)。
 *   - LangGraph の概念と 1:1 で対応できる粒度に留める (StateGraph / add_node
 *     / add_edge / add_conditional_edges / channels)。
 *   - 既存 graph_types.ts (PJ03 GraphInstance) とは独立。並存させる。
 *
 * 正本: projects/PJ04_MermaidSystemLangGraph/docs/map_attribute_spec.md
 */

export const GRAPH_SPEC_VERSION = "0.1" as const;
export const GRAPH_SPEC_START = "__start__" as const;
export const GRAPH_SPEC_END = "__end__" as const;

export type GraphSpecNodeKind =
  | "callable"   // 関数 node (registry から ref で解決)
  | "subgraph"   // 別 scope の graph を node として埋め込む
  | "tool"       // tool calling node
  | "entry"      // __start__ の alias (明示的 entry が欲しい場合)
  | "terminal";  // __end__ の alias

export type GraphSpecEdgeKind =
  | "static"        // 無条件に target に進む
  | "conditional";  // router 関数 (ref) が branch key を返し、branches で dispatch

export type GraphSpecReducerKind =
  | "append"    // list 末尾に追記 (operator.add / add_messages 相当)
  | "replace"   // 上書き (last write wins)
  | "merge"     // object shallow merge
  | "custom";   // custom reducer (registry 側で解決、ref で名前参照)

export interface GraphSpecNode {
  readonly id: string;
  readonly kind: GraphSpecNodeKind;
  /** registry に登録された callable / tool / subgraph 名 */
  readonly ref?: string;
  /** 表示用ラベル。無ければ node.text にフォールバック */
  readonly label?: string;
  /** kind="subgraph" のとき、対象 scope id */
  readonly subgraphScopeId?: string;
  /** 追加メタ (自由 string map)。実行に影響しない */
  readonly metadata?: Record<string, string>;
}

export interface GraphSpecStaticEdge {
  readonly id: string;
  readonly kind: "static";
  readonly source: string;
  readonly target: string;
  readonly label?: string;
}

export interface GraphSpecConditionalEdge {
  readonly id: string;
  readonly kind: "conditional";
  readonly source: string;
  /** router 関数の registry ref。state を受け取り branch key を返す */
  readonly routerRef: string;
  /** branch key → target node id の dispatch 表 */
  readonly branches: Record<string, string>;
  /** 例外時 fallback。任意 */
  readonly defaultTarget?: string;
  readonly label?: string;
}

export type GraphSpecEdge = GraphSpecStaticEdge | GraphSpecConditionalEdge;

export interface GraphSpecChannel {
  readonly name: string;
  readonly reducer: GraphSpecReducerKind;
  /** reducer="custom" のとき registry ref */
  readonly reducerRef?: string;
  /** 型ヒント (TS / JSON Schema / Zod 名など)。実行に影響しない */
  readonly typeHint?: string;
}

export interface GraphSpec {
  readonly version: typeof GRAPH_SPEC_VERSION;
  /** このグラフが対応する scope id */
  readonly scopeId: string;
  /** エントリ。GRAPH_SPEC_START または具体的 node id */
  readonly entry: string;
  readonly nodes: GraphSpecNode[];
  readonly edges: GraphSpecEdge[];
  readonly channels: GraphSpecChannel[];
  /** 追加メタ (source map id など)。実行に影響しない */
  readonly metadata?: Record<string, string>;
}

/**
 * GraphSpec 妥当性の基本チェック (pure)。詳細 validation は別層で。
 *   - node id の重複なし
 *   - edge id の重複なし
 *   - edge の source / target / branches target が node id に存在するか
 *     (__start__ / __end__ sentinel は特例)
 */
export interface GraphSpecValidationIssue {
  readonly kind: "duplicate_node" | "duplicate_edge" | "unknown_node" | "unknown_branch_target" | "missing_entry";
  readonly detail: string;
}

export function validateGraphSpec(spec: GraphSpec): GraphSpecValidationIssue[] {
  const issues: GraphSpecValidationIssue[] = [];
  const nodeIds = new Set<string>();
  for (const node of spec.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({ kind: "duplicate_node", detail: node.id });
    }
    nodeIds.add(node.id);
  }
  const isKnown = (id: string) =>
    id === GRAPH_SPEC_START || id === GRAPH_SPEC_END || nodeIds.has(id);
  if (!isKnown(spec.entry)) {
    issues.push({ kind: "missing_entry", detail: spec.entry });
  }
  const edgeIds = new Set<string>();
  for (const edge of spec.edges) {
    if (edgeIds.has(edge.id)) {
      issues.push({ kind: "duplicate_edge", detail: edge.id });
    }
    edgeIds.add(edge.id);
    if (!isKnown(edge.source)) {
      issues.push({ kind: "unknown_node", detail: `${edge.id}.source=${edge.source}` });
    }
    if (edge.kind === "static") {
      if (!isKnown(edge.target)) {
        issues.push({ kind: "unknown_node", detail: `${edge.id}.target=${edge.target}` });
      }
    } else {
      for (const [branch, target] of Object.entries(edge.branches)) {
        if (!isKnown(target)) {
          issues.push({
            kind: "unknown_branch_target",
            detail: `${edge.id}.branches[${branch}]=${target}`,
          });
        }
      }
      if (edge.defaultTarget && !isKnown(edge.defaultTarget)) {
        issues.push({ kind: "unknown_node", detail: `${edge.id}.defaultTarget=${edge.defaultTarget}` });
      }
    }
  }
  return issues;
}

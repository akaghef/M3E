# M3E コマンド言語仕様

最終更新: 2026-07-19

Status: Definition only（実装コード変更なし）

Related:
- [Federated_Semantic_Source.md](./Federated_Semantic_Source.md)
- [../04_Architecture/LLM_Graph_Conversation_Protocol.md](../04_Architecture/LLM_Graph_Conversation_Protocol.md)
- [../00_Home/Glossary.md](../00_Home/Glossary.md)

---

## 1. 目的

この仕様は、M3E の操作語彙を次の 3 平面に分けて定義する。

| 平面 | 役割 | 正規語彙 | 禁止事項 |
|---|---|---|---|
| 読み平面 | graph / node / edge / GraphLink / attributes を読む | openCypher / ISO GQL の read-only 語彙 | M3E 独自 query 言語、`CREATE` / `MERGE` / `SET` / `DELETE` |
| 書き平面 | M3E の state を変更する | M3E Command intent | 生 Cypher write、database raw write、owner routing 迂回 |
| 精錬平面 | source から derived read model / assertion を作る | `materialize` / `aggregate` / `derive` | transform / inputs / provenance なしの生成 |

M3E の既存正規語 `node` / `edge` / `GraphLink` / `scope` / `alias` / `attributes` / `nodeType` / `relationType` は維持する。property graph 語彙との対応は [Glossary](../00_Home/Glossary.md) の「M3E ⇄ property graph 対応表」に従う。

---

## 2. 原則

### 2.1 読みは openCypher / ISO GQL 語彙に寄せる

大域 query surface は [Federated_Semantic_Source.md](./Federated_Semantic_Source.md) RQ11 に従い、openCypher / ISO GQL の read-only 部分集合として定義する。M3E 独自 query 言語は作らない。

許可する語彙の例:

```cypher
MATCH (n)
WHERE n.nodeType = "text"
RETURN n.id, n.text
```

禁止する語彙:

```cypher
CREATE (n)
MERGE (n {id: "n1"})
SET n.text = "new"
DELETE n
DETACH DELETE n
```

Cypher の `RETURN` 句で列や式を選ぶ操作は `query projection` と呼び、M3E の `射影（Deep → Rapid）` や `materialization` と混同しない。

### 2.2 書きは Command intent に閉じる

変更要求は query text として実行しない。LLM / UI / human / bot / CI の変更要求は、[LLM Graph Conversation Protocol](../04_Architecture/LLM_Graph_Conversation_Protocol.md) の `graph operation` から Semantic Command へ正規化し、owner routing と `baseRevision` 検証を通す。

`graph operation` の説明用 envelope:

```typescript
interface GraphOperation {
  operationId: string
  operation: "create" | "set" | "remove" | "connect" | "disconnect" | "merge" | "reparent"
  targetRef: string
  key?: string
  value?: unknown
  baseRevision: string
  provenance: string
  reason?: string
}
```

この `operation` は確定 write ではない。M3E Command intent へ対応付け、allowed operation、owner、record role、classification、`baseRevision` を検証した後だけ owner adapter へ渡す。

### 2.3 精錬は transform + inputs + provenance を必須にする

`materialize` / `aggregate` / `derive` は source の正本を直接置き換えない。各操作は少なくとも次を保持する。

| 必須項目 | 意味 |
|---|---|
| `transform` | どの変換規則を適用したか |
| `inputs` | どの source / revision / record を入力にしたか |
| `provenance` | proposal、source event、upstream Command、human approval との因果 |

---

## 3. 読み平面

読み平面は read-only query surface である。目的は探索、確認、context projection、Demand Gate query であり、確定変更ではない。

### 3.1 対象

| M3E 正規語 | 読み取り対象 |
|---|---|
| `node` | `id`、`text`、`nodeType`、`attributes`、`link`、owner / revision metadata |
| `edge` | 親子関係。tree invariant を満たす Relationship の制約付き部分集合 |
| `GraphLink` | 非木構造の typed relation |
| `scope` | 認知・表示・編集境界としての node / subtree |
| `alias` | target node / entity への参照窓 |
| `attributes` | node / relation の key-value property |
| `relationType` | GraphLink / Deep relation の型 |

### 3.2 不変条件

1. `MATCH` / `WHERE` / `RETURN` 相当の read-only 語彙だけを query surface とする。
2. `CREATE` / `MERGE` / `SET` / `DELETE` / `DETACH DELETE` 相当の変更語彙は query surface で拒否する。
3. query result は source revision または snapshot ID を説明できなければならない。
4. source classification を越えて private record を露出しない。
5. 読み平面の結果は Command の `baseRevision` 根拠になりうるが、write そのものではない。

---

## 4. 書き平面

書き平面は M3E Command intent の集合である。ここに既存コマンド一覧を位置づける。

| Command intent | 既存 API / graph operation 対応 | 意味 | Cypher 類比 | 制約 |
|---|---|---|---|---|
| `assert` | `m3e.add`, `m3e.sibling`, `operation: "create"` / `"connect"` | node、edge、GraphLink、attribute assertion を追加する | `CREATE` / `MERGE` | 生 Cypher は実行しない。owner と `baseRevision` を検証する |
| `rename` | `m3e.edit`, `operation: "set"` with `key: "text"` | node の表示 text を変更する | `SET n.text = ...` | identity を text に依存させない |
| `reparent` | `m3e.move`, `m3e.promote`, `m3e.demote`, `operation: "reparent"` | edge を差し替え、親子構造を変更する | Relationship delete + create | tree invariant を保持する。authority を跨ぐ場合は `transfer` を要求する |
| `bind` | entity binding / scope bind / alias 作成 | occurrence、entity、scope / facet 表示を対応付ける | `MERGE` relationship | `edge`、`alias`、`GraphLink`、`scope bind` を混同しない |
| `transfer` | ownership transfer workflow | canonical owner を跨ぐ移動を二相以上で処理する | 複数 transaction + tombstone / redirect | 通常 `reparent` として確定しない |
| `delete` | `m3e.del`, `operation: "remove"` / `"disconnect"` | node subtree、edge、GraphLink、attribute を削除する | `DELETE` / `DETACH DELETE` | root 削除不可。source-owned target は owner adapter へ route する |
| `set-attribute` | `m3e.attr`, `m3e.set`, `operation: "set"` | `attributes` または許可 field を設定する | `SET n.key = ...` | field allowlist と classification を検証する |
| `unset-attribute` | `m3e.attrDel`, `m3e.unset`, `operation: "remove"` with `key` | `attributes` または許可 field を削除する | `REMOVE n.key` | 削除対象 field を明示する |
| `set-type` | `m3e.setType`, `m3e.active_node.setType` | `nodeType` を変更する | Label 変更 / `SET n.nodeType = ...` | `text` / `image` / `folder` / `alias` の意味は Data Model と Scope / Alias に従う |
| `mark` | `m3e.mark`, `m3e.unmark`, `m3e.clearMarks` | 複数 node の UI 操作対象集合を変更する | なし | canonical graph write ではない |
| `clone` | `m3e.clone` | node / subtree を別 identity として複製する | `CREATE` subgraph | `id` と `parentId` は新規。alias 解決は別 Command |
| `replace` | `m3e.replaceAll` | text が一致する node 群へ `rename` を一括適用する | `MATCH` + `SET` | dry-run preview と対象件数確認を要求する |
| `select` | `m3e.select`, `m3e.nav` | UI 選択 state を変更する | なし | canonical graph write ではない |
| `view` | `m3e.focus`, `m3e.fit`, `m3e.zoom`, `m3e.pan`, collapse / expand | 表示 state を変更する | なし | semantic write と混同しない |
| `load` | `m3e.load`, `m3e.new` | map / source を開く、または初期化する | なし | 未保存 state と owner boundary を確認する |
| `export` | `m3e.save`, `m3e.export` | portable artifact を出力する | なし | export artifact は自動的に canonical owner にならない |
| `history` | `m3e.undo`, `m3e.redo` | local history を戻す / 進める | transaction rollback 類比 | owner routing 下の remote revision とは同一視しない |

### 4.1 既存 browser API の位置づけ

`window.m3e` は既存 beta UI / browser console の互換 API であり、書き平面の実装候補である。将来のコマンドパネルで JS 入力をそのまま実行してはならない。

既存 API の主な分類:

各 API のシグネチャ・引数・戻り値・暗黙ターゲット・エラー仕様・組み合わせ例は [Command_API_Reference.md](./Command_API_Reference.md) を参照する。

| 分類 | API |
|---|---|
| node 参照 | `m3e.root`, `m3e.sel`, `m3e.parent`, `m3e.children`, `m3e.node` |
| 暗黙 target | `m3e.active_node`, `m3e.active_branch`, `m3e.active_scope` |
| 作成 | `m3e.add`, `m3e.sibling` |
| 編集 | `m3e.edit`, `m3e.del`, `m3e.move`, `m3e.promote`, `m3e.demote`, `m3e.clone`, `m3e.replaceAll` |
| attribute / field | `m3e.set`, `m3e.unset`, `m3e.attr`, `m3e.attrDel`, `m3e.setType` |
| 読み取り | `m3e.info`, `m3e.tree`, `m3e.find`, `m3e.findAll`, `m3e.depth`, `m3e.count`, `m3e.leaves`, `m3e.ancestors`, `m3e.path` |
| 選択 / view | `m3e.select`, `m3e.nav`, `m3e.collapse`, `m3e.expand`, `m3e.toggle`, `m3e.collapseAll`, `m3e.expandAll`, `m3e.fit`, `m3e.focus`, `m3e.zoom`, `m3e.zoomReset`, `m3e.pan` |
| mark | `m3e.mark`, `m3e.unmark`, `m3e.clearMarks`, `m3e.marked` |
| document | `m3e.new`, `m3e.save`, `m3e.load`, `m3e.export` |
| history | `m3e.undo`, `m3e.redo` |

### 4.2 Command envelope

Federated source へ確定変更を要求する Command は、最低限次を持つ。

| 項目 | 意味 |
|---|---|
| `commandId` | retry と audit を一意に識別する ID |
| `actor` | human、agent、bot、system とその識別情報 |
| `targetRef` | source と local entity / assertion を解決できる参照 |
| `intent` | `assert`、`rename`、`reparent`、`bind`、`transfer`、`delete` 等 |
| `baseRevision` | caller が読んだ owner revision |
| `provenance` | proposal、source event、upstream Command との因果参照 |
| `approvalState` | proposal / approved / rejected |

---

## 5. 精錬平面

精錬平面は source から再生成可能な read model、集計、派生 assertion を作る。確定 write ではなく、transform と provenance 付きの生成である。

| 操作 | 入力 | 出力 | 必須条件 | Cypher 類比 |
|---|---|---|---|---|
| `materialize` | canonical source revision、accepted graph、source event | Neo4j record、index、cache、context bundle | source / revision / schema / indexed time / provenance | read model 生成。`CREATE` 類比はあるが owner write ではない |
| `aggregate` | D0 / D1 record 群、query result | count、分類、正規化、summary | aggregation rule、input revision set、provenance | `MATCH ... RETURN count(...)` |
| `derive` | D1 / D2 / D3、typed relation、human approval | pattern、trend、claim、Deep assertion | transform、inputs、provenance、approval state | derived relationship creation 類比 |

精錬平面の出力は、owner concern により `source-materialized record` または proposal / accepted assertion へ分かれる。承認済みで M3E が所有する Deep assertion だけが、Recovery Gate 通過後に M3E-owned accepted graph の canonical runtime へ入れる。

---

## 6. Security Model（将来のコマンドパネル実装要件）

本節は「コマンドパネル実装前に満たす必須条件」を定義する。既存の browser console API は beta 互換面であり、将来の command panel の安全性を保証しない。

### 脅威

- ユーザー入力をそのまま `eval` / `Function` / `new Function` で実行することによるコードインジェクション
- DOM / `window` / `document` へのアクセスを経由した XSS
- `fetch` など外部通信 API の悪用によるデータ流出
- read-only query surface を write surface と誤認させる prompt / UI
- LLM output を database raw write として適用する経路

### 必須要件（MUST）

1. コマンドパネル実行系で `eval` / `Function` / `new Function` を使用しない。
2. 実行可能な文法は allowlist された Command intent に限定し、AST または構造化 input 検証で許可 node だけ通す。
3. 実行コンテキストは M3E Command API と最小限 utility のみを注入し、`window` / `document` / `globalThis` / `Function` / `XMLHttpRequest` / `fetch` にアクセス不可とする。
4. コマンドパネルからの外部ネットワークアクセスを禁止する。
5. コマンド実行前に intent、target、対象件数、Cypher 類比、owner route、危険度を表示し、明示承認後に実行する。
6. 実行ログは時刻、Command intent、target、対象件数、成功 / 失敗、provenance を保存し、入力全文の平文保存は既定で行わない。
7. 失敗時は fail-closed（実行中断）にする。
8. read-only query surface で `CREATE` / `MERGE` / `SET` / `DELETE` / `DETACH DELETE` を拒否する。
9. graph operation は Semantic Command へ正規化し、owner routing と `baseRevision` 検証を通す。

### 推奨要件（SHOULD）

- 実行環境は Web Worker など分離コンテキストを使う。
- 1 実行あたりの命令数、時間、変更件数に上限を設ける。
- 危険操作（`delete`, `reparent`, `transfer`, bulk `set-attribute`）は dry-run preview を提供する。

### 禁止事項

- ユーザー入力を JS としてそのまま評価する方式でのコマンドパネル実装。
- CSP 緩和での暫定回避（`unsafe-eval` の追加など）。
- Cypher write 文を貼り付けて M3E state を直接変更する方式。
- Mermaid / TOON / LLM natural language output の全置換を canonical graph write として扱う方式。

### 受け入れ条件

- セキュリティテストで、`window`, `document`, `fetch`, `Function` を参照する入力が拒否される。
- query surface で `CREATE` / `MERGE` / `SET` / `DELETE` / `DETACH DELETE` が拒否される。
- graph operation が Command intent、owner route、`baseRevision`、provenance を持つ Semantic Command に正規化される。
- source-owned target の変更が Neo4j raw write にならない。
- 監査ログに操作概要が残り、入力全文が既定で保存されない。

詳細テストケースは [../06_Operations/Command_Panel_Security_Test_Cases.md](../06_Operations/Command_Panel_Security_Test_Cases.md) を参照。

---

## 7. テスト観点

- `Command intent` 表が既存 `m3e.*` API を書き平面に位置づけている。
- 各 write intent が Cypher 類比を持つが、生 Cypher write を許可していない。
- `graph operation` から Semantic Command への整合が [LLM Graph Conversation Protocol](../04_Architecture/LLM_Graph_Conversation_Protocol.md) と一致している。
- read-only query surface が [Federated_Semantic_Source.md](./Federated_Semantic_Source.md) RQ11 と一致している。
- `materialize` / `aggregate` / `derive` が transform、inputs、provenance を必須としている。
- Glossary の M3E ⇄ property graph 対応表と矛盾しない。

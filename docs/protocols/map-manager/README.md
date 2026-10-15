# Map Manager Protocol Package

## Purpose

Map Manager prevents repeated AI confusion when reading, writing, laying out,
scoping, projecting, and delegating M3E maps.

This package is the operational SSOT for Map Manager behavior. Product meaning
stays in `docs/03_Spec/`. MCP Resources / Prompts publish this guidance; a local
skill is an optional entry point, not an execution prerequisite.

Fully specified targets and operations use the six MCP tools in
[MCP map operations](../mcp-map-operations.md) directly. This package guides open
structural decisions; consulting it does not require a separate agent or a new
decision when the user has already supplied the required constraints.

## Package files

| File | Role |
|---|---|
| `README.md` | Decision order, ownership, worker boundary |
| `gates.md` | Mandatory gates before mutation or delegation |
| `projection-rule.md` | Projection / interchange / storage separation |
| `../contracts/map_manager_contract.yaml` | Checkable Map Manager contract |
| `../contracts/scope_contract.yaml` | Checkable scope contract |
| `../contracts/write_contract.yaml` | Checkable write contract |

Legacy readers may still enter through `docs/protocols/map-manager.md`, but new
rules belong here.

## Canonical references

- Product data model: `docs/03_Spec/Data_Model.md`
- Scope and alias model: `docs/03_Spec/Scope_and_Alias.md`
- Path notation: `docs/03_Spec/Node_Path_Notation.md`
- Vocabulary: `docs/00_Home/Glossary.md`
- Four-category definitions: `docs/03_Spec/Data_Model.md#content--topology--layout--style`
- Layout modes: `docs/03_Spec/map_layout_modes.md`
- Visual policy: `docs/04_Architecture/Visual_Design_Guidelines.md`
- Write contract: `docs/protocols/map-write-protocol.md`
- Scope contract: `docs/protocols/scope-operation-protocol.md`

## Map Manager owns

When an open structural decision is assigned, the responsibility covers the
relevant items below. Already specified targets and constraints remain binding.

- target map / path / scope resolution
- projection target and purpose
- scope purpose and scope granularity
- scopen / unscopen decisions
- facet detection and facet-local rules
- edge / GraphLink / alias / node-level link distinction
- Topology / Layout / Style decisions under Content and explicit constraints
- layouting and display intent
- cross-scope and cross-facet alias/link operations
- worker handoff packet preparation
- post-write verification and ambiguity routing

## Worker must not own

- redefining scope boundaries
- deciding alias vs move vs GraphLink across facets
- changing Layout / Style / display intent outside the handoff
- restructuring outside assigned path
- deciding M3E storage shape
- writing M3E maps by direct REST API / SQLite / runtime-file mutation rather than an authorized MCP semantic operation
- writing cross-facet relations outside the explicit user request or assigned handoff

Workers return a handoff or ambiguity report when those decisions are needed.

## Decision order

When a write leaves structural decisions open, consider the relevant items below.
Keep specified choices; do not add a facet, Scope, anchor, or color merely to
complete this list. A fully specified operation proceeds directly through MCP.

1. Identify the map and target path using canonical display path notation; separate
   Content, explicit Topology / Layout / Style constraints, and open decisions.
2. Identify the requested projection or surface, if any.
3. Identify the scope purpose: cognition boundary, edit boundary, review batch,
   audit boundary, or product structure.
4. Decide whether the operation is local, scoped, cross-scope, or cross-facet.
5. Decide facet and facet-local meaning of parent-child.
6. Decide scope granularity.
7. Choose move vs alias vs GraphLink.
8. Decide remaining Layout / Style under display intent and explicit constraints.
9. Produce worker handoff or execute through the authorized map-write path.
10. Verify Content fidelity, explicit constraints, structure, display intent, and invariants.

## Content / Topology / Layout / Style の入出力契約

用語の意味は [Data Model](../../03_Spec/Data_Model.md#content--topology--layout--style) に従う。ここでは Map Manager の責任と受け渡しを定める。以下は手渡し情報の区分であり、製品 API の新規 schema ではない。

| 入力 | 受け渡す情報 | 扱い |
|---|---|---|
| Content | Research Worker 等からの情報単位・主張・意味上の関係・根拠 / provenance | 意味と根拠を保つ。整理の都合で主張を追加・変更しない |
| Topology の制約・提案 | 指定階層、兄弟順序、scope 境界、接続方式、既存 map 規約。明示的な要求と worker の提案を区別 | 要求・既存の制約を保持し、提案は採否を判断する。無指定の部分だけを Map Manager が決める |
| Layout / Style の制約 | 指定 Surface View、配置条件、視覚表現の規約 | 既存仕様・実装能力を確認し、指定の範囲を守る |
| display intent | 優先して認識する内容、比較対象、主として読ませる関係 | Topology・Layout・Style の判断条件として用い、Content や明示的な要求を上書きしない |

Research Worker は Content と根拠を返し、既にある構造要求も併記する。Topology を提案する場合は提案であることを明示する。Content-only の入力と、ユーザーが指定した「生物 → 界 → 門」のような階層制約付き入力を同じものとして処理しない。要求の由来・確定状態が不明なら、確定制約にも自由変更可にも決めつけず曖昧点として返す。

Map Manager は入力を読んだ上で、未確定の Topology・Layout・Style を display intent と既存 map 規約に基づき決定する。入力の制約同士、または製品不変条件・実装能力と衝突した場合は、衝突する条件を示して判断を返す。worker の提案は評価できるが、明示的な要求を黙って置き換えない。

| 出力 | 確定・記録する情報 | 検証 |
|---|---|---|
| Content | 表現対象と根拠、および node / relation への対応 | 主張・関係・根拠が保持され、視覚上の都合で新しい主張が加わっていない |
| Topology | node、edge / GraphLink / alias の選択、兄弟順序、scope 境界、spine | 明示制約、tree 不変条件、参照先、境界が成立する |
| Layout | Surface View と option、配置条件、寸法・collapse 等の入力 | 指定配置と既存 View 仕様に整合する |
| Style | 既存の視覚規約と必要な表示指定 | 意味を誤表示せず、寸法を Layout と整合させる |

未確定事項と display intent を出力に添える。M3E Command は認可済みの構造変更を確定し、配置・描画は既存の Layout / Rendering 経路が担う。構造判断を担当しない worker には、この確定結果と許可された実行範囲を渡す。

## Path notation

Use human-facing paths from `docs/03_Spec/Node_Path_Notation.md`.

Canonical display form:

```text
M:(<map label>)> A > B >> C
```

- `>` separates parent-child/display path segments inside the same scope.
- `>>` marks a scope boundary.
- `/` is legacy/API compatibility only.
- `\` is filesystem only.

When ambiguous, stop and resolve. Do not guess a target node.

## Required distinctions

- `edge`: parent-child tree ownership relation; participates in layout.
- `GraphLink`: non-tree relation; does not define tree ownership. Tree subtree
  placement excludes it; force placement may use it under Surface View rules.
- node-level `link`: external URL or attached attribute; not a graph relation.
- `alias`: reference window to a canonical entity; not an ownership move.

## Scope purpose

A scope is not a storage boundary. It is a purpose-bearing cognition and editing
boundary.

Use scope when:

- the user needs a local world
- a subtree has coherent meaning
- the boundary clarifies view, edit, or audit responsibility
- editing outside that boundary would create noise
- a worker can safely own the bounded region

Do not scope merely because a node has many children. First check semantic
cohesion and boundary purpose.

## Scope granularity

Prefer a scope that is:

- meaningful as a local world
- small enough for a worker to inspect without global context
- large enough to avoid fragmenting every tiny group
- stable under expected edits
- clear about view / edit / audit boundary

Soft guide: semantic cohesion first; node count is only a smell, not a rule.

## scopen / unscopen

- `scopen`: make an existing node or node group a scope boundary.
- `unscopen`: remove the boundary while preserving content.
- A worker may execute explicitly specified scopen/unscopen through MCP within the user-authorized target or handoff. An unresolved boundary purpose or ownership change requires structural judgment first.
- If scopen changes assigned worker ownership, update the handoff before work continues.

## Layouting and display intent

`layouting` is product/view behavior. `display intent` supplies the purpose and
requirements for Topology / Layout / Style decisions; it is not a fifth category.
Record it in the write-time human review contract.

Before inserting anchors or colors, decide:

- what should be noticed first
- what should be compared side-by-side
- what relation should stay primary
- whether anchors are semantic or display-synthetic
- what colors encode
- whether the result is scoped or unscoped

Tree subtree placement excludes `GraphLink`; force placement follows the
existing Surface View specification. Neither placement choice changes relation
ownership. Collapse changes the visible graph, not persistent Topology.

### 文脈に応じた構造の例

以下は旧資料の `flow` / `dependency` / `reviews` / `timeseries` / `document` の例を、意味判断の参考として保持したもの。必須の型・テンプレート・Scope分類ではない。これらのラベルや `m3e:facet` の旧属性値だけからfacetを認定しない。正規語のfacetはGlossaryに従い、PJ直下の意味的に凝集したScopeに限定する。既存の属性値を黙って変更せず、Scopeのない文書やレビューにも必要に応じて以下の構造例を参照できる。

| 文脈 | 親子edgeの意味の例 | GraphLinkの意味の例 | aliasとanchorの使い方の例 |
|---|---|---|---|
| 手順・処理の流れ (`flow`) | 明示された処理段階をdepth方向の骨格で表す | 追加の依存、合流、段階をまたぐ関係 | 他の文脈が正本を持つ場合にaliasで参照する。anchorを新しい処理段階に見せない |
| 依存関係 (`dependency`) | 依存方向を追えるspine・全域木 | 木に選ばれなかった依存 | 別の章別・実装別表示はaliasで参照できる。元資料にないgroupingは表示目的であることを区別する |
| レビュー・判断 (`reviews`) | 問い → 選択肢 → 根拠・不利益 | 問い同士の前提、競合、結び付き | 正本の問い・選択肢をaliasで再利用できる。必要なら文脈別anchorでレビュー単位をまとめる |
| 時系列 (`timeseries`) | 出来事の時期や段階の進行 | 主たる時系列に収まらない因果・依存 | aliasは相互参照に使える。anchorを入れる場合も時間順を維持する |
| 文書 (`document`) | 元の章・節の階層 | 引用、相互参照、主題上の関係 | aliasは索引や別の表示位置に使える。既存階層だけで読めるならanchorを追加しない |

ユーザーが指定した関係・階層・順序・表示を優先し、未決の部分にだけこれらの例を適用する。利用可能なMCP操作が必要な関係型や表示を扱えない場合、別の意味へ変換して実行せず不足を報告する。

### anchorと色の判断例

互いの関係が薄い項目を多数比較する場面では、文脈別のanchorが読み取りを助けることがある。一方、意味のある連続手順や元から明確な階層にanchorを挟むと、新しい処理段階や根拠のない分類に見えることがある。anchorは表示のための判断であっても、その挿入はTopologyの変更である。元資料の意味上のgroupingと表示目的のgroupingを区別し、後者を記録する任意のmetadataはData Modelの規約に従う。

例えばユーザーが「問いを文脈別に比較し、重要度・緊急度・確信度を見分け、Scopeは追加しない」と指定した場合、文脈別anchorの下に問い・選択肢・根拠・不利益を置く案がある。問いのfillを重要度、borderを緊急度、選択肢のfillを確信度に対応させる案もある。これは当該表示意図に対する例であり、一般のレビューやMapに適用する既定色ではない。既存の色の意味を保持し、明示されていない再着色を行わない。

処理順をdepth方向へ置き、同段階の `実行1` と `実行2` をbreadth方向で並べる要求では、その並列関係を保つ。読み取り上の必要がない `実行フェーズ` anchorを追加しない。順序、Scopeの有無、anchor、色の判断が既に指定されていれば、検討をやり直して変更しない。

## Worker handoff packet

A worker handoff must include:

1. target map label/id if known
2. target canonical path/scope
3. task goal
4. allowed files/nodes
5. forbidden changes
6. relevant spec/protocol links
7. verification expected
8. escalation triggers
9. report format
10. Content and provenance, explicit Topology / Layout / Style constraints and
    their source, confirmed decisions, display intent, and unresolved proposals

## Ambiguity handling

If the operation requires a structural judgment not explicitly assigned, Map
Manager should create a review question or return a handoff clarification.
Worker should not decide silently.

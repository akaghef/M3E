# Render Target Definition — canonical_mermaid fixed-map 化

**status**: draft
**date**: 2026-04-22
**scope**: PJ04 Phase 1 / Phase 2 の基準設計
**target**: `plan6/cycle2/canonical_mermaid.html` / `plan6/cycle2/canonical_rendered.svg`

## 目的

PJ04 Phase 1 の目標は、Mermaid source を読めることではなく、
`canonical_mermaid.html` のような system diagram を **fixed map 上で graph-first に再表現できること** にある。

そのため本書では次を固定する。

1. 何を render target とみなすか
2. M3E 側で最低限保持すべき graph semantics は何か
3. どこまでを見た目 parity とし、どこからを非目標とするか
4. Phase 1 / 2 / 3 の受け渡し境界はどこか

## 現時点の理解

M3E の現在の product vision との関係では、PJ04 は `beta/` の主戦場である `S2` Team Collaboration や `S3` 信頼性強化を置き換えるものではない。
PJ04 は、将来の graph authoring / inspection に向けて、
**fixed map 上で node / edge / scope をどう持てば Mermaid 級の system diagram を読めるか**
を検証する sandbox である。

この task で重要な glossary は以下。

- `map`: 1 つの知識マップ。本 PJ では固定 map を前提にする
- `scope`: 管理境界。今回は tree 的な親子の意味ではなく、graph 要素の grouping 境界としても使う候補がある
- `node`: 思考要素の最小単位。diagram 上の箱 / gate / terminal を担う
- `edge`: 親子ではなく、diagram 上の遷移関係を担う

## UI 用語の固定

本 PJ では、system diagram 周りの UI / 設計用語を以下で固定する。
過去に揺れていた `portal` は採用せず、`scope node` に統一する。
また、`surface` と `window` は明確に分離する。

| 用語 | 意味 | UI 上の見え方 | 補足 |
|---|---|---|---|
| `surface` | 図面そのもの。何を描いているかを決める内容面 | 1 枚の diagram | `root node` の代わりに、この概念を図面単位の基準に置く |
| `system surface` | `flow-lr` で描く system diagram の surface | 左右に流れる system 図 | Mermaid ふうの主画面 |
| `tree surface` | 従来の木表示面 | mind map / tree | system surface とは別の見え方 |
| `window` | surface をどう見ているかを決める閲覧枠 | 表示中の viewer 状態 | zoom / pan / selection / detail level は window 側に置く |
| `scope` | subsystem の内部図を表す構造単位 | subsystem の中身 | tree の親子そのものとは同一視しない |
| `scope node` | 下位 scope を持つ node | 箱・bracket 付き node | 旧 `portal` の代わりに使う用語 |
| `entity node` | 下位 scope を持たない通常 node | rect / diamond など | 普通の処理・判断・状態ノード |
| `node` | `scope node` と `entity node` を含む総称 | 図上の要素一般 | 実装上の総称として残す |
| `relation` | node 間の意味関係 | 矢印付き edge として表示 | `approve`, `reject`, `blocked` など |
| `edge` | relation の描画表現 | 線・矢印・label | UI では edge、意味上は relation |
| `forward edge` | 主進行方向の relation | 左→右中心の線 | system の主経路 |
| `back edge` | 戻り・loop の relation | 上下に逃がして戻る線 | 主経路と混ぜないための読み筋 |
| `selection` | window 上の現在選択 | ハイライトされた node | scope 遷移後も 1 つ残るのが原則 |
| `camera` | window の視点状態 | pan / zoom | surface ではなく window の状態 |
| `detail level` | window が surface をどの粒度で見せるか | `j/k` で増減 | 0 = 箱のみ、1 = 1 段 preview |
| `preview` | scope node の中身を一段だけ見せる表示 | box 内の簡易展開 | scope に入ることとは別 |
| `enter scope` | 下位 scope に入る操作 | `]` | surface を切り替える |
| `exit scope` | 一段外の scope に戻る操作 | `[` | surface を戻す |
| `main lane` | system surface の主フロー | 左右 1 列の読み筋 | 主経路を読むための骨格 |
| `lane` | 上下方向の補助段 | row | 分岐・例外・review loop 用 |
| `reference node` | 主フロー外の補助情報 | `Source / Notes` など | 主レーンには混ぜない前提が自然 |

### 用語上の判断

1. `scope` は subsystem の入口と内部図の両方に関わるが、UI 上では `scope node` として見せる
2. `surface` は図面、`window` はその見え方であり、同一視しない
3. `detail level` は graph 正本ではなく window state に属する
4. `portal` は採用しない。必要だった意味は `scope node` で表す

## Render target の定義

### 正本

Phase 1 の描画ターゲット正本は以下 2 つ。

- `plan6/cycle2/canonical_mermaid.html`
- `plan6/cycle2/canonical_rendered.svg`

Mermaid source は topology の正本として使ってよいが、
**Phase 1 の gate 判定は HTML / SVG で見える図として比較できること** を優先する。

### 今回再現したい情報

1. 17 個の node
2. 26 本の directed edge
3. gate node の diamond 形状
4. multi-line label
5. labeled edge
6. execute 周辺の loop と review/escalation 枝
7. LR 方向の全体レイアウト

### 今回まだ再現対象にしないもの

1. Mermaid と同一の auto-layout アルゴリズム
2. Mermaid 固有 CSS の完全再現
3. Mermaid source の live edit
4. SVG path 単位の一致

## Canonical graph の構成要素

### Node taxonomy

| kind | 対象 | Mermaid 上の形 | PJ04 での意味 |
|---|---|---|---|
| `action` | `Idea`, `Research`, `Vision`, `Strategy`, `Task Brainstorm`, `Dependency Sort`, `Phase Design`, `Execute`, `Generator`, `Evaluator`, `Task Done`, `Review Pool`, `Complete` | rectangle | 処理・状態・到達点 |
| `human_gate` | `Gate 1`, `Gate 2`, `Phase Gate` | diamond | 人間判定を要する分岐 |
| `escalation_gate` | `Human Gate` | rectangle in source, ただし意味的には gate | escalation 後の human 判定 |

補足:

- `Human Gate` は現行 Mermaid では rectangle だが、意味論的には gate に近い
- したがって PJ04 data model では `node.kind` と `render.shape` を分ける
- 例: `Human Gate` は `kind=human_gate`, `shape=rect` を許容する

### Edge taxonomy

| edge.type | label | 例 |
|---|---|---|
| `next` | 無ラベル | `Idea -> Research` |
| `approve` | `approve` | `Gate 1 -> Dependency Sort` |
| `reject` | `reject` | `Gate 1 -> Research`, `Gate 2 -> Strategy` |
| `fail` | `fail` | `Evaluator -> Generator` |
| `pass` | `pass` | `Evaluator -> Task Done` |
| `blocked` | `blocked` | `Execute -> Review Pool` |
| `resolved` | `resolved` | `Review Pool -> Execute` |
| `escalate` | `escalate` | `Review Pool -> Human Gate` |
| `phase_complete` | `phase complete` | `Execute -> Phase Gate` |
| `advance` | `advance` | `Phase Gate -> Execute` |
| `reopen` | `reopen` | `Phase Gate -> Research` |
| `done` | `done` | `Phase Gate -> Complete` |

補足:

- label は表示文字列
- `edge.type` は runtime / compile で使う正規化語
- 表示文字列と意味語を分離して保持する

## M3E graph-first 表現

### 基本方針

1. Mermaid source 自体を正本にしない
2. fixed map 上の node / edge を正本候補にする
3. layout は graph の属性として持つが、意味論から分離する
4. notes は補助説明であり graph 本体に混ぜない

### 最小 node schema

```yaml
id: strategy
label: Strategy
kind: action
render:
  shape: rect
  x: 412.6
  y: 68.1
  w: 74.7
  h: 34
group: explore
authority: canonical
```

### 最小 edge schema

```yaml
id: gate1_approve_dependency_sort
from: gate1
to: dependency_sort
type: approve
label: approve
render:
  route_hint: curve
authority: canonical
```

### Group / scope の扱い

Phase 1 では graph 自体を tree に還元しないため、
node の親子で diagram を表さない。

その代わりに次の 2 層を持つ。

1. `graph scope`: diagram 全体または phase grouping を持つ境界
2. `node / edge`: 実際の図要素

最小 grouping は以下。

- `explore`: Idea 〜 Gate 1
- `plan`: Dependency Sort 〜 Gate 2
- `execute`: Execute / Generator / Evaluator / Task Done / Review Pool / Human Gate / Phase Gate
- `terminal`: Complete

ただし Phase 1 では grouping はレイアウト補助であり、閉包境界としてはまだ弱くてよい。

## 描画要件

### Must

1. rectangle node を描ける
2. diamond node を描ける
3. directed edge を描ける
4. edge label を中央付近に描ける
5. multi-line label を描ける
6. loop edge を読める配置ができる
7. LR 基調の配置を保持できる

### Should

1. node ごとに size を自動計算できる
2. edge の交差を最小化できる
3. gate node を rectangle 群から視覚的に区別できる
4. `Execute` を hub として強調できる

### Won't yet

1. drag-edit
2. live Mermaid import
3. nested subgraph border
4. styling theme editor

## Phase 別の責務分離

### Phase 1

やること:

- canonical graph を fixed map に手で写せる
- 上記 Must を満たす
- `canonical_mermaid.html` / `canonical_rendered.svg` と見比べて major parity を確認できる

まだやらないこと:

- 一般 graph editor 化
- runtime semantics の厳密化
- compile 実行

### Phase 2

やること:

- node 追加
- edge 追加
- edge label 編集
- gate / action の shape 切替

この phase で初めて、render target を保ったまま編集可能かを問う。

### Phase 3

やること:

- `node.kind` と `render.shape` の分離を schema で固定
- `edge.type` と `edge.label` の分離を schema で固定
- graph scope と既存 scope の関係を明文化

## Parity 判定方法

### 合格

以下をすべて満たしたら Phase 1 parity 合格とする。

1. 17 node / 26 edge が固定 map 上で欠落なく表現される
2. `Gate 1`, `Gate 2`, `Phase Gate` が diamond として読める
3. `reject`, `approve`, `fail`, `pass`, `blocked`, `resolved`, `escalate`, `phase complete`, `advance`, `reopen`, `done` が label として読める
4. `Execute` 周辺の 3 ループ
   `Execute -> Generator -> Evaluator`
   `Execute -> Review Pool -> Human Gate`
   `Execute -> Phase Gate`
   が崩れずに読める
5. Mermaid native render と比較して「同じ graph を見ている」と判断できる

### 不合格

以下のいずれかに該当したら不合格。

1. node を tree 順に縦積みしただけで graph として読めない
2. gate がただのラベル差分になり、分岐点として見えない
3. edge label が欠落し、`approve/reject` などの意味差が消える
4. review / escalation / phase loop の 3 枝が混線して読めない

## open questions

1. `Human Gate` を Phase 1 で rectangle のままにするか、意味論優先で diamond 化するか
2. phase grouping を border 付き subgraph として出すか、色分けのみに留めるか
3. fixed map での座標正本をどこに置くか
4. Mermaid import をいつ許可するか

## 次タスク

1. canonical graph の 17 node / 26 edge を PJ04 固有 ID で列挙する
2. node ごとの `kind / shape / label / group` を表に落とす
3. edge ごとの `type / label / from / to` を表に落とす
4. fixed map prototype で必要な最小 attribute を洗い出す

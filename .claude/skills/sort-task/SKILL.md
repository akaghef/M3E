---
name: sort-task
description: >
  タスクプール（アイデアリスト、PJ候補、TODO群、backlog等）から相互依存関係を推論・整理して、
  DAG 形式で `projects/deps.json` に書き出し、実行順・並列集合・クリティカルパスを計算するスキル。
  以下の場面でトリガーする:
  - 「依存関係整理」「DAG化」「実行順決める」「タスクの前後関係」「ソート」と言われたとき
  - タスク・PJ・マイルストーンの集合を渡されて「どこから始める？」「並列化できる？」と聞かれたとき
  - backlog/*.md や docs/ideas/ 配下のリストを「整理して」と依頼されたとき
  - 既存 `projects/deps.json` への追記・編集を依頼されたとき
  - SortedTaskView の更新・再描画を依頼されたとき
  Mapへの書込はMCPの対応範囲で行い、旧REST writerへ切り替えない。
---

# sort-task — タスク依存の整理と出力

相互依存のあるタスク群を DAG として `projects/deps.json` に書き出し、
その DAG を 3 つの形式（md / chat / map）で出力する。

## DP Router

- DP0: 依存関係と出力先・表示規約を確定する。
- DP1: 初回はローカル計算環境と、map出力を使う場合のMCP対応範囲を確認する。
- DP2: 既存データを最小変更し、計算・検証後に要求された出力だけを更新する。

## 構成

```
.claude/skills/sort-task/
├── SKILL.md           ← この文書
└── deps.py            ← CLI（DAG 操作・クエリ）
```

データ: `projects/deps.json`（single source of truth）
依存: Python 3.10+ / networkx。map出力にはM3E MCPを利用する。

## 入力

1. **直接列挙**: 「タスク A, B, C, D の依存を整理」
2. **ファイル参照**: 「`backlog/pj-vision-100.md` の 1–10 を DAG 化」
3. **差分追加**: 「PJ-09 を追加、PJ-01 の後・PJ-02 の前」
4. **既存更新**: 「PJ-04 state を active に」「PJ-06→PJ-07 のエッジ削除」

## 動作手順

1. **入力特定** — ソースとタスク ID 規則を確認（既定: `PJ-NN`）
2. **タスク列挙** — 各タスクに `id` / `title` / `state`(省略時 `draft`) / `priority`
3. **依存推論** — 明示指示 > 推論。確信がない依存は **review pool** へ
4. **deps.json 更新** — `deps.py add` / `dep` / `rm-dep` / `state` / `rm` で最小差分
5. **検証** — `deps.py check`(cycle / unknown state / 参照切れ)
6. **出力** — 下記 3 モードから要求されたものを生成

## 出力モード

| モード | 宛先 | 用途 |
|--------|------|------|
| **chat** | 会話応答 | 対話中の確認・要約 |
| **md** | `projects/sort-task.md` 等 | 永続ドキュメント化・レビュー用 |
| **map** | M3E `SortedTaskView` | 視覚的確認・探索 |

指定がない場合は **chat** を既定。md や map は明示指示されたら実行。

### chat

`deps.py` の非 JSON 出力をそのまま要約:

```
追加: 3 node / 5 edge
critical path: PJ-01 → PJ-04 → PJ-07
layers:
  L0: PJ-01 PJ-06 PJ-08 PJ-04
  L1: PJ-03 PJ-02 PJ-07
ready: PJ-01 PJ-06 PJ-08 PJ-04

review pool（自信のない依存候補）:
  [ ] PJ-05 → PJ-03 ?  (ObserveSelf の出力を DogfoodDeep が使う可能性)
```

### md

`# DAG: {title}` から始まる以下のフォーマット:

```md
# DAG: projects/deps.json

最終更新: 2026-04-17

## critical path
PJ-01 → PJ-03

## layers
- L0 (parallel): PJ-01, PJ-04, PJ-06, PJ-08, PJ-00, PJ-05
- L1 (parallel): PJ-02, PJ-03, PJ-07

## ready
PJ-01, PJ-04, PJ-06, PJ-08, PJ-00, PJ-05

## nodes
| id | title | state | layer | prereqs |
|----|-------|-------|-------|---------|
| PJ-01 | TrustEng | draft | L0 | — |
| PJ-03 | DogfoodDeep | draft | L1 | PJ-01 |
...
```

書き出し先はユーザ指定（例: `backlog/sort-task-2026-04-17.md`）。指定が無ければ聞く。

### map

`docs/protocols/mcp-map-operations.md` に従い、六つのMCP Toolsで対象の発見・参加・
意味操作・検証を行う。`deps.py` は依存計算を担当し、Mapの全状態編集やREST保存は行わない。
以下の表示規約は、ユーザーがこのSortedTaskViewを指定した場合に適用する。

書込前に、必要な操作がMCP Schemaにあることを確認する。特にGraphLink生成が未対応なら、
必要な非木依存を失うMapを保存せず、不足機能を報告する。旧writerや一時スクリプトへ
切り替えたり、GraphLinkを親子関係で代用したりしない。

**レイアウト原則**:
- **tree-depth = DAG layer** — 深さが依存の方向に対応
- **siblings = parallel** — 兄弟は並列実行可能

**構造**:
```
SortedTaskView
├── meta
│   ├── critical-path: PJ-01 -> PJ-03
│   ├── open: N / total: M
│   ├── layers: K
│   └── last-render: <ISO8601>
└── DAG
    ├── PJ-01 TrustEng       ← L0
    │   └── PJ-03 DogfoodDeep ← L1（PJ-01 の子）
    ├── PJ-04 InfoGather
    │   └── PJ-02 HarnessTranspose
    ├── PJ-06 PrivacyLayer
    │   └── PJ-07 Projection
    ├── PJ-08 AdoptionEng
    ├── PJ-00 AlgLibMove dogfood
    └── PJ-05 ObserveSelf
```

**tree-parent 選定ルール**（layer L > 0 のノード）:
1. layer L-1 の prereq を候補とする
2. critical path 上のエッジがあればそれを採用
3. なければ「既存 tree-children 数が最小」な prereq（greedy spread）
4. 同点時は deps.py score 降順 → ID 昇順

tree-parent に選ばれなかった prereq は **GraphLink** (`relationType: "depends-on"`) として残す。
critical path 上のエッジは `style: "emphasis"`。

**PJ ノード attributes**: `{ pj_id, state, layer, on_critical }`

**対象**: ユーザー指定のMap / pathをMCPで解決する。保存済みIDを既定値として推測しない。

**再更新**: 既存 `SortedTaskView` の対象・制約を確認し、必要な差分だけを適用する。
一括削除・再構築を既定にしない。保持済みContextと変更結果を使い、再GETは不足・失効時だけ行う。

**前提**: 既存Betaへ接続したMCPが利用できること。未接続・非対応ならその不足を報告する。

## 依存推論の原則

- **ユーザが述べた依存を最優先** — 会話・memory・指示文の明示 > 推論
- **書かれていない依存は引かない** — 空想でエッジを足さない
- **共通基盤は共通基盤** — 「A が B, C, D の前提」は A→B, A→C, A→D の 3 エッジ
- **循環は禁忌** — 循環に見える場合はタスク分割を提案（自動分割しない）
- **粒度が揃わないとき** — 小粒タスクを大粒タスクの子として扱わず、親のみ DAG に載せる

## 禁則

- ユーザ承認なしに不確定な依存を引かない
- 既存 `deps.json` の state / priority / title を勝手に書き換えない
- node ID を勝手に rename しない
- **10 ノード / エッジ超** の一括操作はドライラン（差分提示）→ 承認 → 実行

## 使用例

### 例1: 新規 PJ 群を DAG 化 → chat 出力
```
ユーザ: backlog/pj-vision-100.md の Meta/Foundation を DAG 化して
→ add/dep を実行、chat で critical/layers/ready を要約
```

### 例2: DAG 更新 → map 再描画
```
ユーザ: PJ-09 を追加、PJ-01 の後、そして map 更新して
→ deps.py add PJ-09 + dep PJ-01 PJ-09、その後MCPの対応範囲を確認して指定Mapを更新
```

### 例3: md 形式でレビュー用に書き出し
```
ユーザ: 現状の DAG を backlog/sort-task-2026-04-17.md に出して
→ deps.py で layers/critical/ready を取得、md フォーマットで書き出し
```

## 関連

- `projects/deps.json` — データ
- `docs/protocols/mcp-map-operations.md` — MCPによるMap操作
- `backlog/pj-vision-100.md` — PJ ビジョン
- feedback memory `feedback_ambiguity_pooling` — 曖昧な依存は pool 化

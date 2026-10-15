---
name: canvas-protocol
description: |
  開発完了は通常 Beta の反映確認で判定し、PR を必須の状態媒体にしない。
  M3E マップを「canvas」(共有ホワイトボード) として agent と人間で使うための規約。
  agent は canvas を見て決定を読み、進捗を書き戻す。ただし agent の実装作業自体は
  canvas に依存しない (canvas が落ちていても作業は続行できる)。
  人間 (akaghef) は canvas 上で:
    - reviews/Qn に選択肢を立てて回答する (`attributes.selected="yes"`)
    - strategy で task の優先度を並び替える
    - scratch にアイデアを投入する
  agent は canvas 上で:
    - 着手前に reviews/Qn の回答を読む
    - 自分のタスク行に `attributes.status` を書く (in_progress / done)
    - 曖昧点があれば reviews/Qn として起票する
  以下の場面でトリガー: agent が「マップに書く」「canvas 確認」「reviews を見る」と判断した時、
  または devM3E オーケストレーターが Auto Map Sync を実行する時。
  実行はMCPを利用し、このSkillはcanvasの運用規約だけを補う。
---

# canvas-protocol — Agent ↔ Canvas Interaction Rules

M3E マップを共有 canvas として agent と人間で使う。canvas は **任意の同期ポイント**であり、
agent の主作業 (実装・テスト・本流統合) は canvas 不在でも完結できる設計を保つ。

## DP Router

- DP0: canvasの対象と運用規約を決める。
- DP1: 初期導入時はMCP接続と対象を確認する。
- DP2: 既知のContextで日常の参照・更新を行い、結果と変更通知を利用する。

## 1. Target server

- **default**: 既存Betaに接続されたMCP。
- map discovery: `m3e_get` で名前が「開発」のMapを特定し、返されたResource URIを使う。
- Finalは本番確認を明示されたときだけ対象にする。
- 操作規約: `docs/protocols/mcp-map-operations.md`。MCPが使えない場合にRESTや一時スクリプトへ切り替えない。

## 2. Canvas Layout (固定パス)

```
M:(開発)> SYSTEM > DEV
├── strategy/                       # 開発戦略・タスクボード
│   └── HOME Re-implementation/     # プロジェクト単位のサブツリー
│       ├── Visual tasks/           # ロール別タスク
│       ├── Data tasks/
│       └── Team coordination/
├── reviews/                        # 人間の判断待ちキュー
│   └── {Project}/Q1, Q2, ...       # 各 Q の子ノードが選択肢
│       └── (option) attributes.selected="yes" で確定
├── Agent Status/                   # 各 worker の現在状態
├── tasks/ doing / ready / done     # devM3E の Phase 5 同期先
├── scratch/                        # アイデア・バグ報告・後回し
└── Bugs/                           # 既知バグ
```

## 3. Read Protocol (agent → canvas)

着手前に必ず実施:

`m3e_get` で `reviews/{Project}` の必要な範囲を読み、`status="open"` のQに
未回答が無いか確認する。既存Contextが現在の状態を保持している場合はそれを利用する。

判断:
- 該当 Q が `attributes.selected="yes"` 付き選択肢を持つ → その決定で進める
- `status="open"` で未選択 → 待機 or 自己解釈せず人間に確認
- `status="resolved"` だが selected が無い → 人間に再確認 (canvas が壊れている可能性)

**重要**: canvas に到達できない / fetch 失敗の時、agent は作業を止めない。
ローカルで実装ドラフトを進め、作業報告 に「canvas 未参照、要確認」と明記する。

## 4. Write Protocol (agent → canvas)

### 4.1 タスク開始

更新時は対象へ `m3e_context` で参加し、`m3e_update` の `kind="content"` と
`attributes` で必要なキーだけを変更する。以下は更新内容の例であり、全状態を書き戻す手順ではない。

```js
{status: "in_progress", startedAt: "YYYY-MM-DD"}
```

### 4.2 タスク完了
```js
{status: "done", completedAt: "YYYY-MM-DD"}
```

### 4.3 新規 Q 起票 — Ambiguity Pooling (MUST)

**原則**: 曖昧点に当たったら **block しない / silently 決めない**。プールして暫定値で進む。akaghef が batch-review する。

```
reviews/{Project}/Qn (text="Qn: <一文の質問>",
  attributes={status:"open", raisedBy:"<role>", raisedAt:"YYYY-MM-DD"})
└── 選択肢 1 (details: Why / Trade-off)
└── 選択肢 2 (details: Why / Trade-off)
└── 選択肢 3 (attributes.tentative="yes" ← agent の暫定採用案)
```

ルール:
- 選択肢は **2-4個**、相互排他、details に Why と Trade-off を書く
- agent の暫定案には `attributes.tentative="yes"` を付ける (selected ではない)
- **`selected="yes"` は akaghef のみが付ける**。agent は付けない
- 作業報告 に "TENTATIVE — see reviews/Qn" と明記
- プールするのは reversal cost ≥30min の判断のみ。trivial (変数名等) は pool しない
- subagent は `AskUserQuestion` を使わない (blocking; orchestrator が map で集約)

### 4.4 Agent Status 更新 (MUST — 省略不可)

**オーケストレーターは subagent の状態が変わるたびに `DEV/Agent Status` を即座に書き換える義務がある。**
これは akaghef が IDE から subagent 活動を直接見られないため、map が唯一の可視化チャネルだから (2026-04-14 確立)。

トリガー (すべて即時更新):
- subagent dispatch → `<role>: working — <task one-liner> [HH:MM]`
- subagent 完了通知受信 → `<role>: done — <result> [HH:MM]` または `idle`
- 本流統合・必要な稼働確認完了 → 該当ロールを `idle` または次タスクへ
- blocked → `<role>: blocked — <reason> [HH:MM]`

**固定パス**: `M:(開発)> SYSTEM > DEV >> Agent Status`。

既知の対象は保持済みContextで更新し、保存結果・変更通知で次の操作に必要な情報を得る。
Contextが不足・失効したときだけ必要な範囲を取得する。Node数を理由にScopeを追加しない。

**ノード形式 (既存ロール 1 行更新; 新規追加しない)**:
- text: `[<role>: <status> ; <YYMMDD> <現在状態>]-[next: <次タスク>]`
- attributes: `{role, status}` (status は idle / working / blocked / done / active)
- 親ノード (`Agent Status`) の attributes に `{updated: "YYYY-MM-DD HH:MM", <role>: <status>, ...}` を上書き

既存ロールノード (visual, data, data2, team, manage) を **書き換える**。重複ノードを足さない。

実行: MCPで「開発」Mapと固定path `M:(開発)> SYSTEM > DEV >> Agent Status` を
解決して更新する。subtree外は触らず、自動再着色や一時書込スクリプトを追加しない。

## 5. Independence (canvas 障害時の挙動)

| 障害 | agent の対応 |
|------|-------------|
| canvas server 停止 | ローカル作業継続。作業報告に「canvas 未同期」フラグ |
| reviews/Qn 未起票 | 自己解釈せず 作業報告 で人間に質問 |
| 同時編集衝突 | MCPの競合結果・変更通知を確認して再判断する。失効した前提で再試行しない |
| 削除されたノード参照 | 旧書込を中断して生存する対象を再確認する。自動再作成・退避先への自動適用はしない |

## 6. Naming Conventions

- Q 番号: `Qn:` プレフィックス (例 `Q11: Scoped fetch/edit API`)
- ロール別タスク: `{Role} tasks/` (例 `Data tasks/`)
- プロジェクト wrapper: `{Project} Re-implementation` 等の判別可能な名称
- attributes キー: `status`, `selected`, `raised`, `startedAt`, `completedAt`, `priority`

## 7. Triggers

- セッション開始時 — `reviews/{自分の Project}/` を全件確認
- タスク着手前 — 関連 Q の回答有無確認
- 状態変化時 — Agent Status と該当タスク行を更新
- 曖昧点遭遇時 — reviews/Qn として起票し人間に escalate
- 完了通知 — devM3E Phase 5 (Integrate) と連動して canvas 反映

## 8. Link / Alias ルール

- **scopeをまたぐrelationの意味や所有関係が未決ならMap Manager規約を参照する。** 指定済みの操作はMCPへ直接渡せる。異なるscope間の可視性はalias、非木関係はGraphLinkとして区別する
- GraphLink はtree ownershipやTreeの部分木配置を定義しない。force配置への寄与はSurface View仕様に従う
- alias は参照先ノードの「別の場所での出現」を表す。alias 経由で関係を可視化する
- 詳細は `docs/03_Spec/Data_Model.md` と `docs/03_Spec/Scope_and_Alias.md` を参照。MCPで必要なrelation操作が未対応なら、その不足を報告し、別の関係型やRESTで代用しない

## 9. What NOT to write to canvas

- 大量の生ログ (作業報告 / dailies に書く)
- コミット SHA 列挙 (git に任せる)
- 一時的な debug 出力
- 本来 docs/ に書くべき設計文書 (canvas は判断・進捗のみ)

## Reference

- `docs/protocols/mcp-map-operations.md`: MCPによるtarget選択、参加、操作、検証
- `map-update` skill: status の一括更新
- `devM3E` skill: Auto Map Sync 義務、Core Loop との接続

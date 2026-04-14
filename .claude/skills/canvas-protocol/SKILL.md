---
name: canvas-protocol
description: |
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
---

# canvas-protocol — Agent ↔ Canvas Interaction Rules

M3E マップを共有 canvas として agent と人間で使う。canvas は **任意の同期ポイント**であり、
agent の主作業 (実装・テスト・PR) は canvas 不在でも完結できる設計を保つ。

## 1. Target server

- **default**: beta (port 4173, docId `akaghef-beta`)
- final (38482) は本番マップ。曖昧な時のみ確認 (m3e-map skill 参照)

## 2. Canvas Layout (固定パス)

```
ROOT/SYSTEM/DEV/
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

```bash
# reviews/{Project} を読み、status="open" の Q に未回答が無いか確認
curl -s http://localhost:4173/api/docs/akaghef-beta | node -e "..."
```

判断:
- 該当 Q が `attributes.selected="yes"` 付き選択肢を持つ → その決定で進める
- `status="open"` で未選択 → 待機 or 自己解釈せず人間に確認
- `status="resolved"` だが selected が無い → 人間に再確認 (canvas が壊れている可能性)

**重要**: canvas に到達できない / fetch 失敗の時、agent は作業を止めない。
ローカルで実装ドラフトを進め、PR description に「canvas 未参照、要確認」と明記する。

## 4. Write Protocol (agent → canvas)

### 4.1 タスク開始
```js
// strategy/{Project}/{Role} tasks/{taskNode}.attributes.status = "in_progress"
node.attributes = {...node.attributes, status: "in_progress", startedAt: "2026-04-14"};
```

### 4.2 タスク完了
```js
node.attributes = {...node.attributes, status: "done", completedAt: "2026-04-14"};
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
- PR description に "TENTATIVE — see reviews/Qn" と明記
- プールするのは reversal cost ≥30min の判断のみ。trivial (変数名等) は pool しない
- subagent は `AskUserQuestion` を使わない (blocking; orchestrator が map で集約)

### 4.4 Agent Status 更新 (MUST — 省略不可)

**オーケストレーターは subagent の状態が変わるたびに `DEV/Agent Status` を即座に書き換える義務がある。**
これは akaghef が IDE から subagent 活動を直接見られないため、map が唯一の可視化チャネルだから (2026-04-14 確立)。

トリガー (すべて即時更新):
- subagent dispatch → `<role>: working — <task one-liner> [HH:MM]`
- subagent 完了通知受信 → `<role>: done — <result> [HH:MM]` または `idle`
- PR merged → 該当ロールを `idle` または次タスクへ
- blocked → `<role>: blocked — <reason> [HH:MM]`

**固定パス**: `ROOT > SYSTEM > DEV > Agent Status`。

**効率化は API 側の責務 (重要)**: 「他 subtree を読まない」というルールは GET が全文書を返す限り無効 — 全ノードが context に入る。本当の効率化は Q11 scoped API (`?scope=<nodeId>&depth=N`) merge 後に達成される。
- 現状 (Q11 未 merge): full GET → path 走査して該当 subtree のみ抽出 (provisional)
- Q11 merge 後: `GET ?scope=<AgentStatus.id>&depth=1` / `POST ?scope=<AgentStatus.id>` に切替 (mandatory)

**Scope を使うかの判断**: DEV マップは ~50-300 ノード前提。subtree が小さい (<30 ノード目安) なら scope param 不要 — full GET で十分。scope は大きな subtree (例: strategy 全体, reviews 全体) に対してのみ使う。深い入れ子を作らない (ノード総数 300 を超えそうなら整理)。

**ノード形式 (既存ロール 1 行更新; 新規追加しない)**:
- text: `[<role>: <status> ; <YYMMDD> <現在状態>]-[next: <次タスク>]`
- attributes: `{role, status}` (status は idle / working / blocked / done / active)
- 親ノード (`Agent Status`) の attributes に `{updated: "YYYY-MM-DD HH:MM", <role>: <status>, ...}` を上書き

既存ロールノード (visual, data, data2, team, manage) を **書き換える**。重複ノードを足さない。

実装: inline `node -e "..."` で beta (4173, akaghef-beta) に POST。固定 path を `ROOT.children → SYSTEM → DEV → Agent Status` で辿り、subtree 外は触らない。tmp script はリポジトリ root に書かない。

## 5. Independence (canvas 障害時の挙動)

| 障害 | agent の対応 |
|------|-------------|
| canvas server 停止 | ローカル作業継続。PR に「canvas 未同期」フラグ |
| reviews/Qn 未起票 | 自己解釈せず PR description で人間に質問 |
| 同時編集衝突 | 後勝ち。次回 fetch で取り直して再 patch |
| 削除されたノード参照 | 警告ログ後スキップ。再作成しない |

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

## 8. What NOT to write to canvas

- 大量の生ログ (PR description / dailies に書く)
- コミット SHA 列挙 (git に任せる)
- 一時的な debug 出力
- 本来 dev-docs/ に書くべき設計文書 (canvas は判断・進捗のみ)

## Reference

- `m3e-map` skill: REST API の使い方、target 選択
- `map-update` skill: status の一括更新
- `devM3E` skill: Auto Map Sync 義務、Core Loop との接続

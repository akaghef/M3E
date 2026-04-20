---
pj_id: PJ03
doc_type: decision-memo-draft
decision_id: Decision-memo-2
target: 外部ツール採否（plan.md §流用方針 1）
status: draft
date: 2026-04-21
---

# 外部ツール採否メモ（draft）

## スコープ

plan.md §流用方針 1 の 3 候補 + 関連について、**参考実装として読むか** / **runtime として採用するか** / **不要か** を仮判定する。最終採否は Gate 1 で akaghef が判断する。

## 判定軸

| 軸 | 内容 |
|---|---|
| A. アーキテクチャ流用価値 | plan.md §データ構造の最小案 (State/Node/Edge/Checkpoint) に対してどれだけ同型か |
| B. 実 runtime 採用可否 | M3E（TypeScript）に現実的に組み込めるか |
| C. 運用規律としての流用価値 | 方法論として真似できる部分 |
| D. 学習コスト | 読解・試用の時間投資 |

## 候補 1: LangGraph

- **実体**: Python 製 graph-based agent workflow engine。`StateGraph` に `Node`, `Edge`, `conditional_edges`, `Checkpointer` が揃う
- **バージョン**: 1.1.8（2026-04-21 時点で sandbox に install 済み）
- **A（アーキテクチャ流用価値）**: ★★★★★ — plan.md のデータ構造とほぼ同型。特に Checkpointer の `thread_id` / resume パターンは T-1-5 に直接転用可能
- **B（runtime 採用）**: △ — Python なので M3E（TS）に組み込む場合は RPC/サブプロセス境界が必要。直接採用は D1 の選択肢 C を選んだ場合に限る
- **C（運用規律）**: 中 — 主に構造設計の参考
- **D（学習コスト）**: 低〜中 — StateGraph API はシンプル
- **仮判定**: **参考実装として install 済み**。採用判定は Gate 1 以降

## 候補 2: Hermes

- **実体**: Nous Research 系の agent 自己改善ループ方法論。特定パッケージというより論文・reference implementation 群
- **A**: 対象外（アーキテクチャではなく運用ループ）
- **B**: 対象外
- **C（運用規律）**: ★★★★ — plan.md §evaluator loop / round_max / last_feedback の設計思想に直接つながる。生成 → 評価 → 改稿のループを規律化するアイデア源
- **D**: 中 — 論文読解が主作業
- **仮判定**: **install 対象ではない**。`docs/hermes_loop_digest.md`（未作成）として方法論だけ抽出する。別タスクで pool

## 候補 3: Guardrails / Pydantic 系

- **実体**: `guardrails-ai`（出力 schema 検証）/ `pydantic`（型検証）。前者は後者の上に載る
- **A**: ☓ — workflow engine ではなく validator
- **B**: ○ — pydantic は LangGraph 経由ですでに依存 tree に入った（2.13.3）。TS 側には `zod` 相当で代替可
- **C**: ○ — evaluator の verdict schema を厳密化するのに使える
- **D**: 低 — schema 書けば動く
- **仮判定**: **Phase 1 では過剰**。evaluator の verdict 形式が安定してから検討。現時点 install 不要

## 候補 4: 他に検討すべきもの（補足）

| 候補 | 位置づけ | 仮判定 |
|---|---|---|
| CrewAI / AutoGen | multi-agent orchestration | Scope 外（PJ03 は 1 task 単位） |
| Prefect / Temporal | 汎用 workflow engine | 重すぎ。agent 特化ではない |
| LangSmith | trace / eval SaaS | LangGraph 依存 tree に入った（0.7.33）。使うなら API key 必要。当面不要 |

## まとめ（Gate 1 向け）

| ツール | install 済み | 参考実装として読む | 採用判定 |
|---|---|---|---|
| LangGraph | Yes (sandbox) | Yes | Gate 1 以降 |
| Hermes | - | 方法論のみ | Gate 1 以降 |
| Guardrails / Pydantic | Pydantic のみ間接的 | 要なら | 保留 |

## 次アクション

1. LangGraph のコアクラス（`StateGraph`, `Pregel`, `Checkpointer`）のソース読解メモ作成 — 別タスクで pool
2. Hermes 方法論ダイジェスト作成 — 別タスクで pool
3. plan.md D1（workflow 正本）の 3 択を、本メモを踏まえて Gate 1 で決定

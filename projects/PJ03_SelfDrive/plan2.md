---
pj_id: PJ03
project: SelfDrive
status: active
plan_role: active
date: 2026-04-21
supersedes: plan.md (partial — 成果は保持、完了判定は弱化)
related_reviews: Qn5_premature_done_declaration
---

# PJ03 SelfDrive — Plan 2

## TL;DR

Claude が PJ03 を「完了」と判定したが、その判定は強すぎた。

PJ03 で実際に成立したのは:

1. workflow state / edge / checkpoint の設計
2. reducer / orchestrator / clock / hook / projection の責務分離
3. M3E scope への **一方向 projection**

まだ成立していないのは:

1. **LangGraph 的な graph executor 本体**
2. node graph を実行入力として辿る runtime
3. graph が実際に回ることを示す dogfood

したがって Plan 2 の目的は、
**PJ03 の成果を捨てずに、LangGraph 的実体を取り込む／もしくは同等物を成立させること**
に置く。

## 現在地の再評価

### すでにできたもの

- 9 state / 17 edge / stop taxonomy
- checkpoint JSON を machine SSOT にしたこと
- reducer と orchestration の責務分離
- clock / dependency / review 条件の observable 化
- scope projection の one-way 統合

### まだできていないもの

- `WorkflowNode` / graph edge を実際の runtime が読んで実行すること
- graph 上の node 間遷移を engine が管理すること
- reducer が graph runtime の内部部品として位置づくこと
- LangGraph と比較して「取り込まなくてよい」と言えるだけの上位互換性

### 厳しい言い方をすると

現状の PJ03 は、LangGraph の代替ではなく、
**LangGraph を入れる前の repo 固有下地** までで止まっている。

この下地自体には価値があるが、
「LangGraph のようなものができた」とはまだ言えない。

## Plan 2 の主題

**LangGraph 的な graph executor を、PJ03 の既存成果の上に成立させる。**

ここでいう graph executor は最低限次を満たす:

1. `WorkflowNode` 群を実行入力に取る
2. node 間 edge を辿る
3. state / checkpoint を graph 実行の結果として更新する
4. reducer は graph 実行の内部遷移部品に格下げされる
5. 1 task だけでなく「task 内 graph」が存在する

## 方式候補

### A. LangGraph を取り込む

方針:

- LangGraph を graph runtime の正本に寄せる
- PJ03 の reducer / checkpoint / hook / review bridge を adapter として接続する

利点:

- graph executor 本体を一から作らなくてよい
- checkpoint / conditional edge / loop の骨格は既存実装を流用できる
- 「LangGraph 下位互換」問題を直接解消できる

難点:

- repo 固有の `tasks.yaml` / `reviews` / hooks / scope projection との adapter が必要
- Python runtime と TypeScript 側成果の境界整理が必要

### B. 自前 graph runtime を実装する

方針:

- `WorkflowNode` / graph edge を TypeScript で本当に実行する engine を作る
- reducer を graph runtime の内部部品として埋め込む

利点:

- repo 内の責務境界をそのまま使いやすい
- M3E / scope integration と一体設計しやすい

難点:

- LangGraph が既に持っている部分を再発明しがち
- 下位互換批判を受けやすい

### 現時点の暫定判断

**A を第一候補、B を fallback** にするのが妥当。

理由:

- 既存の PJ03 成果は adapter / boundary layer として再利用しやすい
- 未達なのは graph executor 本体であり、そこは LangGraph が最も近い

## 新しい成功基準

### 最小成功

- `WorkflowNode` / graph edge が実行入力になる
- reducer が「graph executor の内部部品」として位置づく
- graph の 1 cycle が dogfood で回る

### 中間成功

- LangGraph 取り込み、または同等 runtime で loop / checkpoint / conditional branch が動く
- `Generator -> Evaluator -> Router` が graph node として存在する
- checkpoint JSON と graph state の写像が壊れていない

### 最終成功

- M3E scope 内で「workflow state の snapshot」ではなく「graph 実行単位」が扱える方向が見える

## 非目標

- いきなり viewer 上で豪華な graph UI を作ること
- いきなり複数 PJ 並列実行まで広げること
- 既存の PJ03 成果を全部捨てて作り直すこと

## フェーズ

### Phase A — Gap 固定

目的:

- 現状 PJ03 が何を達成し、何を未達にしているかを文書で固定する

成果物:

- `README.md` / `plan.md` の完了表現を弱めるか、Plan 2 への参照を追加
- LangGraph 下位互換批判に対する技術的整理メモ

### Phase B — Graph Runtime 試作

目的:

- `WorkflowNode` / graph edge を実行する最小 graph runtime を成立させる

成果物:

- graph runtime adapter
- 1 graph dogfood
- reducer との接続

### Phase C — LangGraph 比較 or 採用確定

目的:

- A/B のどちらを本採用するかを技術的に固定する

成果物:

- LangGraph integration memo もしくは自前 runtime 継続判断
- 採用理由と非採用理由

### Phase D — Scope 内 graph 接続

目的:

- snapshot ではなく graph 実行単位を scope と接続する

成果物:

- graph summary projection
- node progress / current node / next edge の表示

## 直近タスク案

1. PJ03 の「done」表現を弱め、Plan 2 を正本候補として追加する
2. `WorkflowNode` / graph edge を実行入力に使う最小 spec を書く
3. LangGraph sandbox を再利用し、PJ03 checkpoint JSON との写像実験を行う
4. `Generator -> Evaluator -> Router` の 3 node graph を 1 本回す

## Plan 1 vs Plan 2 の claim 整理（T-4-1 成果）

| 項目 | Plan 1 の主張 | Plan 2 での再評価 |
|---|---|---|
| 9 state / 17 edge の設計 | 成立 | そのまま成立 |
| checkpoint JSON を machine SSOT に分離 | 成立 | そのまま成立 |
| reducer / orchestrator / daemon / CLI / hook の責務分離 | 成立 | そのまま成立 |
| clock / dependency / review 条件の observable 化 | 成立 | そのまま成立 |
| scope projection (one-way) | 成立 | scope snapshot まで成立（graph 実行単位は未達） |
| **「1 task workflow が実際に回る」** | 実際に回ったと主張 | **signal reducer が state を更新したまで**。graph を辿る runtime は未実装 |
| **「動的 workflow を scope 内で扱える方向」** | 達成と判定 | **基礎工事まで**。graph 実行単位の扱いは Plan 2 対象 |
| LangGraph 下位互換性 | Phase 0 で比較 draft のみ | **T-4-2 で gap 再整理**、T-6-1 で採用 or 非採用確定 |
| SubagentAdapter 実装 | 対象外 | 引き続き対象外 |
| 実 M3E viewer 描画 | 対象外 | 引き続き対象外 |

「そのまま成立」の 4 項は Plan 2 の前提として再利用。残り 3 項が Plan 2 の主戦場。

## 確定事項（Plan 2 進行に応じて追記される）

### Phase A (T-4-1, T-4-2) 確定 2026-04-21
- Plan 1 は「graph runtime の基礎工事まで」と弱化、Plan 2 が active plan
- LangGraph gap memo: G1-G3 を Plan 2 で埋める、subgraph / streaming / multi-agent は Plan 2 scope 外

### Phase B (T-5-1, T-5-2, T-5-3) 確定 2026-04-21
- graph runtime spec: 1 task = 1 graph、既存 WorkflowNode / WorkflowEdge 型は不変、fail-closed を reducer から継承、adapter として追加のみ
- graph_runtime.ts 実装: G→E→R 3 node graph が 2 scenario (happy / fail retry) で **mock-adapter smoke run**。dogfood_run_04.md に trace 記録
- G1 / G2 / G3 を **mock smoke run で閉じた**（実 adapter は Plan 2 非目標）
- T-7-2 adversarial review (Finding 1/2/3) 対応: custom predicate に full WorkflowStateCamel を渡す、graph position を checkpoint に永続化（`graphPosition` 追加、schema 10 field）、rejection 時に trace を fake 進行させず即 break

### Phase C (T-6-1) 確定 2026-04-21
- **自前 graph runtime を継続採用**（LangGraph 不採用）
- 理由: Python/TS 境界コスト / checkpoint schema 粒度不一致 / Plan 2 scope で LangGraph 優位機能が要らない
- 再評価トリガ: node-level checkpoint / subgraph / streaming / multi-agent supervisor / 自前劣後 bug 再発見 のいずれか
- 詳細: [docs/langgraph_vs_native_decision.md](docs/langgraph_vs_native_decision.md)

## 一言でいうと

Plan 1 の PJ03 は「workflow runtime の基礎工事」だった。  
Plan 2 の PJ03 は「LangGraph 的な実体を本当に成立させる」段階である。

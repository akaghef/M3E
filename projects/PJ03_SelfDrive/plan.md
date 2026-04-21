---
pj_id: PJ03
project: SelfDrive
status: reframing
date: 2026-04-20
---

# PJ03 SelfDrive — Plan

## TL;DR

現行の plan は、目的、手段、流用方針、実装対象が混線しているため、いったん立て直す。

SelfDrive の主題は **可視化** ではなく **Agent workflow をどう作るか** に置く。
同時に、M3E の Vision は **システムから 1 task までを相似形で扱えること**、そのために **静的構造だけでなく動的 state machine を内包すること** と定義する。

したがって、この PJ はまず

1. 何を正本にするか
2. 何を流用し、何を自作するか
3. workflow をどの粒度で持つか
4. M3E にどう統合するか

を確定する再設計フェーズから始める。

## 軸

**M3E は、システム、PJ、論点、1 task を相似な構造として扱える環境を目指す。そのために、静的 tree だけでなく、動的 workflow / state machine を同じ世界観で持てる必要がある。**

## 現在の問題

現行 plan には次の混線がある。

### 1. 目的と手段の混線

- SelfDrive の目的が「workflow engine 作成」なのか「可視化」なのかが曖昧
- LangGraph / Hermes が目的なのか、参考実装なのか、流用対象なのかが曖昧

### 2. 正本の混線

- `tasks.yaml` や hooks を正本として扱うのか
- それとも別の workflow model を正本として持つのか
- その境界が曖昧

### 3. M3E 本体との境界の混線

- SelfDrive が独立ハーネスPJなのか
- M3E への state machine 導入PJなのか
- 両者が混ざっている

### 4. 流用方針の未固定

- 既存の外部ツールを流用する範囲
- 手元の既存資産を流用する範囲
- 独自実装の最小核
- この3つが整理されていない

## 再定義

SelfDrive は次のPJとして再定義する。

**M3E に state machine / Agent workflow を持ち込むための設計・実装方針を確定し、最小の 1 workflow を成立させるPJ。**

ここで重要なのは、いきなり完成実装に入ることではない。
まず **設計上の分岐を潰すこと** が先である。

## 先に決めるべきこと

### D1. workflow の正本

次のどれを正本にするかを先に決める。

- A: `tasks.yaml` 拡張
- B: 別の workflow schema を定義
- C: 外部 workflow tool を正本とし、M3E は viewer / editor になる

### D2. 流用方針

次の3層を分けて決める。

- 外部ツールの流用
- 手元資産の流用
- M3E 独自実装

### D3. workflow の最小粒度

最初に扱う単位を固定する。

- 1 task
- 1 sub-pj
- 1 PJ

このPJでは、最初は **1 task** に固定する。

### D4. state machine の最小集合

状態を増やしすぎず、最初に必要な state を固定する。

候補:

- pending
- ready
- in_progress
- eval_pending
- blocked
- sleeping
- escalated
- done
- failed

### D5. M3E 統合境界

workflow を M3E にどう置くかを決める。

- tree の外側の runtime として置く
- 1 scope の内部構造として置く
- tree + overlay relation として置く

M3E の哲学に従うなら、最終的には **1 scope の内部に置く** 方向が本命。
ただし最初から完全統合しなくてよい。

## 流用方針の整理

### 1. 外部ツール

流用候補を先に調べ、採否を決める。

候補:

- LangGraph
- Hermes
- Guardrails / Pydantic 系
- その他 workflow / agent orchestration tool

### 2. 手元資産

暫定 runtime / adapter として使う候補。

- `tasks.yaml`
- `resume-cheatsheet.md`
- `reviews/Qn_*.md`
- ScheduleWakeup
- SessionStart / PostCompact / Stop hooks
- `sub-pj-do`

### 3. 独自実装

本当に必要な核だけに絞る。

候補:

- M3E 内 workflow schema
- M3E <-> workflow engine adapter
- scope 内への最小表示
- state 編集 UI

## 仮説

現時点での有力仮説は次である。

1. LangGraph 的な state / edge / checkpoint の骨格は流用価値が高い
2. Hermes 的な自己改善ループは運用規律として流用価値が高い
3. hooks / tasks / reviews は engine 本体ではなく adapter / runtime 補助層として使うのが自然
4. 可視化は engine の後でよい

ただし、これはまだ **仮説** であり、plan では前提にせず、Phase 0 で比較評価する。

## フェーズ

### Phase 0 — 設計分岐の確定

目的:

- 目的と手段の混線を解く
- 正本、流用方針、最小粒度、統合境界を固定する

成果物:

- Decision memo 1: workflow 正本
- Decision memo 2: 外部ツール採否
- Decision memo 3: 手元資産の役割
- Decision memo 4: 最小 state set
- Decision memo 5: M3E 統合境界

### Phase 1 — 最小 workflow specification

目的:

- 1 task 用の最小 workflow model を定義する

成果物:

- state 定義
- edge 定義
- checkpoint 定義
- blocked / sleeping / escalated の意味定義
- evaluator loop の定義

### Phase 2 — 実行基盤の仮接続（2026-04-21 kickoff）

目的:

- reducer を「signal を受ける純粋関数」から「外部 orchestrator が供給する signal で駆動される runtime」に接続する
- Phase 1 の reducer API を外部レイヤ（Clock daemon、subagent orchestrator、hook bridge）に配線する

akaghef 指示 (Phase 2 着手条件):

1. reducer 外の Clock daemon / tick orchestration を設計する
2. Generator / Evaluator subagent orchestration を reducer の外側で定義する
3. SessionStart / PostCompact hook 配線を checkpoint JSON 前提で接続する
4. sleeping / escalated の実稼働観察を orchestrator レイヤで回収する

成果物（task 単位、詳細は tasks.yaml）:

- T-2-1: Clock daemon（ScheduleWakeup + CronCreate 連携、sleeping → ready を tick で自動発火）
- T-2-2: Orchestrator shell（subagent dispatcher: Generator / Evaluator role 分離、verdict collection）
- T-2-3: SessionStart / PostCompact hook 配線（checkpoint JSON 前提の resume path）
- T-2-4: dogfood_run_02（sleeping / escalated / failed の実稼働観察）
- T-2-5: Phase 2 gate check（再 gate は akaghef 判断）

### Phase 3 — M3E 統合

目的:

- 1 scope の中で workflow を扱う最小統合を作る

成果物:

- workflow summary view
- current state 表示
- next transition 表示
- blocked reason 表示

## 成功基準

### 最小成功

- 設計分岐が確定する
- 1 task 用 workflow spec が書ける
- stop / blocked / wakeup / eval が state machine として記述できる

### 中間成功

- 1 task workflow が実際に回る
- checkpoint / resume が成立する

### 最終成功

- M3E が静的整理だけでなく、動的 workflow を scope 内で扱える方向へ進む

## 非目標

- いきなり完成エンジンを実装すること
- いきなり可視化を作り込むこと
- いきなり複数PJを回すこと
- このPJだけで M3E 全体の最終アーキテクチャを確定すること

## 直近タスク

1. 現行 plan の論点を分解する
2. 外部ツール候補を整理する
3. 手元資産の役割を一覧化する
4. workflow 正本の候補を 3 案に絞る
5. 1 task 用 state set を仮決めする

## 確定事項（2026-04-21 Phase 0 T-0-1..T-0-4 完了 / akaghef Gate 1 承認待ち）

Phase 0 の設計分岐 4 本を確定。各成果物は `docs/` 配下の独立 md を正本とする。

| 論点 | 結論 | 正本 |
|---|---|---|
| **D4 最小 state set** | 9 state: pending / ready / in_progress / eval_pending / blocked / sleeping / escalated / done / failed | [docs/workflow_state_set.md](docs/workflow_state_set.md) |
| **基本遷移** | 17 edges（E01..E17）、fail-closed、terminal 不可逆、human/machine/timer trigger 区別 | [docs/workflow_edges.md](docs/workflow_edges.md) |
| **D2 流用方針（手元資産）** | tasks.yaml=primary checkpoint / resume-cheatsheet=human summary / reviews=判断負債プール / ScheduleWakeup=one-shot sleeping / CronCreate=繰返し sleeping / hooks=resume entry・compact 復旧・停止ガード / sub-pj-do=engine の thin wrapper（長期） | [docs/legacy_asset_mapping.md](docs/legacy_asset_mapping.md) |
| **停止理由 taxonomy** | 停止理由 → blocked / sleeping / escalated / failed の exactly one に写像。E1/E2/E3 は必ず escalated。4 問 rubric で新規理由を分類 | [docs/stop_reason_taxonomy.md](docs/stop_reason_taxonomy.md) |
| **Qn_initial runtime timer host** | ScheduleWakeup + CronCreate 併用（役割分担: inner loop=ScheduleWakeup / outer monitor=Cron）— Gate 1 で akaghef 正式確定予定 | [reviews/Qn_initial.md](reviews/Qn_initial.md) |

### 却下した代替案

- `paused` / `queued` / `reviewing` state の追加 → `blocked` / `ready` / `escalated` に吸収（state 数膨張を防ぐ）
- plan.md §基本遷移 セクション先行執筆 → 成果物を `docs/` に集約、plan.md は索引のみ（SSOT 違反回避）
- ScheduleWakeup のみ採用 → Claude Code idle 時の continuity 要件を満たせない

### Phase 1 への handoff

- T-1-1 (`WorkflowState` / `WorkflowEdge` / `Checkpoint` / `RunContext` TypeScript 型): 9 state + 17 edge をそのまま union / struct に落とす
- T-1-3 runner: `workflow_edges.md` の表外遷移を fail-closed で拒否、writeback 対象は `tasks.yaml`（primary）+ `resume-cheatsheet.md`（human summary）
- T-1-4 evaluator loop: round 判定は E06/E07（`round + 1 <= round_max` で retry、超過で blocked）
- T-1-5 checkpoint: primary = tasks.yaml、PostCompact/SessionStart の復旧は resume-cheatsheet.md を経由

## Phase 1 結論（REJECTED 2026-04-21 akaghef; see Qn3_gate2_rework）

**Gate 2 差戻**。以下の主張は撤回し、[reviews/Qn3_gate2_rework.md](reviews/Qn3_gate2_rework.md) の P1..P4 決定後に再 gate する。
撤回理由の要点:

1. SSOT 宣言と実装の矛盾（escalationKind / wakeupAt / wakeupMechanism / failureReason / dependencies が checkpoint 永続化から欠落）
2. runner は signal reducer で engine ではない。「1 task workflow が実際に回る」は過大評価
3. sleeping / escalated の runtime semantics（clock 参照・review 紐付け）未実装
4. workflow_example.json が実行から参照されず、仕様と実装が二重表現
5. applyWriteback の regex surgical replace は checkpoint 正本として脆い
6. round semantics が E06 のみ定義で曖昧
7. code-reachable を gate 根拠にしたのは不十分

rework tasks: T-1-8 (P1 persistence)、T-1-9 (P2 runner 責務)、T-1-10 (P3 条件 observable)、T-1-11 (P4 example 処遇)。T-1-7 は status=blocked（blocker=Qn3）。

## 確定事項（2026-04-21 akaghef rework 方針確定）

| 論点 | 決定 | scope |
|---|---|---|
| **P1 checkpoint 永続化** | tasks.yaml は sprint contract 専用。machine SSOT = `runtime/checkpoints/{taskId}.json` | T-1-8 |
| **P2 runner 責務** | `workflow_reducer.ts` に改名。責務は `(state, signal) → nextState + patch` の純粋関数 + persistence adapter に限定。CLI は薄い wrapper に分離 | T-1-9 |
| **P3 observable 条件** | tasks.yaml に `dependencies`, `linked_review` 追加。Clock は注入可能 interface（`Date.now()` 直参照禁止）。reviewResolver / dependencyResolver も injectable | T-1-10 |
| **P4 workflow_example** | `workflow_example.json` 削除、`docs/workflow_example.md` 降格。runtime fixture は必要になってから schema 付きで復活 | T-1-11 |
| **rework 完了条件** | 「宣言した state の resume 情報が欠落しない」こと。未観察 edge を増やすことではない。restore test で sleeping/escalated/failed の invariant field が全て round-trip することを確認 | T-1-8 + T-1-10 |

### 却下した代替案

- tasks.yaml に state 関連フィールドを全部載せる → 人間契約 / 機械正本の責務混線が再発するため却下
- Clock の Date.now() 直参照 → テスト不能・時間依存不能コードになるため却下
- workflow_example.json を残す → 実行入力でない限り「動かない spec」ノイズになるため却下
- sleeping / escalated / failed の実稼働観察を Gate 2 再提出条件に含める → akaghef 明示却下（runtime 観察 ≠ 永続化整合）

## Phase 1.5 rework 結論（2026-04-21 T-1-8..T-1-11 完了 / akaghef Gate 2 v2 承認待ち）

Qn3 P1-P4 すべて resolve。rework 完了条件（宣言 state の resume 情報欠落なし）を test で直接検査して通過。

### rework 完了条件の直接検査

| 検査 | 結果 | artifact |
|---|---|---|
| **9 state すべての invariant field 完全 round-trip** | PASS 9/9 | [checkpoint_restore_test.ts](../../beta/src/node/checkpoint_restore_test.ts) — kind / round / roundMax / lastFeedback / blocker / escalationKind / wakeupAt / wakeupMechanism / failureReason |
| FixedClock で sleeping → ready (E09) | PASS | [clock_resolver_test.ts](../../beta/src/node/clock_resolver_test.ts) test 1 |
| AdvanceableClock の時刻進行判定 | PASS | 同 test 2 |
| Dependency cycle detection 明示 Error | PASS | 同 test 3 |
| linked_review open で human_approve reject | PASS | 同 test 4 |
| linked_review resolved で blocked → ready 自動 (E15) | PASS | 同 test 5 |

### P1-P4 達成根拠

| 論点 | 達成 | 根拠 |
|---|---|---|
| **P1 checkpoint 永続化** | ✓ | tasks.yaml から machine state 除去（grep=0）、runtime/checkpoints/*.json × 16 atomic write、schema 明文化 |
| **P2 reducer 責務** | ✓ | workflow_runner → workflow_reducer rename、CLI を workflow_cli.ts に分離、reducer_responsibility.md で engine 化を Phase 2 に先送り明記 |
| **P3 observable 条件** | ✓ | Clock interface (SystemClock / FixedClock / AdvanceableClock)、TasksFileDependencyResolver / ReviewsDirReviewResolver、tickAutoTransitions が E01/E09/E12/E13/E15 を条件駆動で発火、cycle detection 明示 Error |
| **P4 workflow_example** | ✓ | runtime/workflow_example.json 削除、docs/workflow_example.md に description 化、beta/src からの json 参照 0 |

### 実稼働観察（後続材料として記録、rework 完了条件ではない）

- T-1-7 blocked → ready: Qn3 resolved を ReviewsDirReviewResolver が検出 → E15 auto-fire 実観察
- T-1-10 / T-1-11 pending → ready: TasksFileDependencyResolver が deps done 検出 → E01 auto-fire 実観察

sleeping / escalated の実稼働観察は Phase 2 の orchestrator 側で扱う（Clock polling daemon は reducer の外）。

### Gate 2 v2 提出内容

- Phase 1.5 rework 5 task（T-1-8..T-1-11 + 再 T-1-7）すべて done
- Evaluator 3/3 (T-1-8, T-1-9, T-1-10, T-1-11) pass
- restore test 9/9 + clock/resolver test 19 assertions pass
- akaghef Qn3 rework 完了条件 = resume 情報の round-trip 整合 を直接検査で通過

以下は撤回された旧結論記録（参照のみ、信頼しない）:

## Phase 1 結論（旧・撤回済）

Phase 1 の 最小 workflow engine が dogfood で成立。

### 最小成功 5 項目の達成根拠

| 基準 | 根拠 artifact |
|---|---|
| 設計分岐が確定する | Phase 0 確定事項（state set / edges / legacy mapping / stop taxonomy） |
| 1 task 用 workflow spec が書ける | [beta/src/shared/workflow_types.ts](../../beta/src/shared/workflow_types.ts) (T-1-1) + [docs/workflow_example.md](docs/workflow_example.md) (T-1-2 の json は T-1-11 で description 降格) |
| stop / blocked / wakeup / eval が state machine として記述できる | [docs/workflow_edges.md](docs/workflow_edges.md) 17 edges + [docs/stop_reason_taxonomy.md](docs/stop_reason_taxonomy.md) 4 問 rubric |
| 1 task workflow が実際に回る | T-1-6 dogfood: T-1-2/T-1-3/T-1-4/T-1-5 の 4 task を runner 経由で pending→done（[artifacts/dogfood_run_01.md](artifacts/dogfood_run_01.md)） |
| checkpoint / resume が成立する | `loadCheckpoint` / `pickNextTask` / `--resume` CLI 動作、corrupt checkpoint は 3 段階の明示 Error（[docs/resume_protocol.md](docs/resume_protocol.md)） |

### Phase 2 (Hermes 改善ループ) 着手条件

着手可能とみなす条件:

- T-1-1..T-1-6 全 pass（現況）
- runner が tasks.yaml を破壊せずに writeback できる（T-1-3 eval で確認、T-1-6 で実観察）
- blocked への経路が実観察されている（`--demo` Scenario B で確認）
- sleeping / escalated / failed の code-reachability が確認済（Gate 2 Evaluator コメント通り、実稼働観察は Phase 2 で）

残課題（Phase 2 で最初に扱う候補）:

- SessionStart / PostCompact hook の自動配線（現状は CLI 手動）
- Generator / Evaluator 起動そのものを runner が orchestrate（現状は Manager が subagent を起動し verdict を runner に注入）
- sleeping / escalated / failed の実稼働観察と runbook
- Hermes 的な feedback の「次 round generator prompt に反映」ロジック

### 却下した代替案

- T-1-7 を runner を通さず手動 done にする → dogfood の連続性が切れるため却下。runner 経由で E04 (eval_required=false 経路) を通して done 化
- Generator/Evaluator を runner が直接呼ぶ → Phase 1 では sprint 膨張、先送り

## メモ

今は実装よりも、設計の分岐を潰す段階である。
plan の立て直しとは、作業項目を増やすことではなく、**何を決める plan なのかを明確にすること**である。


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

### Phase 2 — 実行基盤の仮接続

目的:

- Phase 1 の spec を、既存 runtime または外部ツールに仮接続する

成果物:

- adapter 実装方針
- resume / wakeup / stop の接続方式
- 1 task の試運転

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

## メモ

今は実装よりも、設計の分岐を潰す段階である。
plan の立て直しとは、作業項目を増やすことではなく、**何を決める plan なのかを明確にすること**である。


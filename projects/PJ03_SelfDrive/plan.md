---
pj_id: PJ03
project: SelfDrive
status: reframed
date: 2026-04-20
---

# PJ03 SelfDrive — Plan

## TL;DR

SelfDrive は、可視化PJではない。主目的は **既存ツールを流用して、M3E に最小の Agent workflow 作成・実行能力を持ち込むこと** である。

そのために、

- **LangGraph 的な state / node / edge / checkpoint** を workflow 骨格として採用し、
- **Hermes 的な自己改善ループ** を運用様式として取り込み、
- 既存の `tasks.yaml`、`resume-cheatsheet.md`、`reviews/`、hooks、ScheduleWakeup を暫定 runtime として使う。

可視化は後段でよい。まず必要なのは、agent workflow を **作れる・回せる・止まっても再開できる** ことだ。

## 軸

**M3E は、システムから 1 task までを相似な構造として扱える環境を目指す。そのために、静的 tree だけでなく、動的 Agent workflow も同じ世界観で保持できなければならない。**

SelfDrive は、その最初の実証PJである。

## 背景

現状の M3E は、scope、tree、alias、Command、Undo/Redo、保存整合性には強いが、**動的 Agent workflow を正本として持てない**。

その結果、

- DAG 風の静的整理には向く
- しかし loop、retry、conditional edge、checkpoint、resume、subagent 分岐を自然に持てない
- stop / blocked / eval / escalate が、構造ではなく暗黙運用へ散っている
- SelfDrive も、現状では hook と規約の組み合わせでしかなく、workflow authoring の核がない

これが最大の問題である。

## 再定義

SelfDrive は「sub-pj protocol を無人で回す harness PJ」ではなく、次のPJとして再定義する。

**既存ツールを流用しながら、M3E の中に最小の Agent workflow engine を持ち込むPJ。**

ここでいう engine は、豪華な実行基盤ではない。最低限、次を持つ。

- State schema
- Workflow node
- Conditional edge
- Checkpoint / resume
- Blocked / sleeping / escalated / done の区別
- Evaluator を含む loop

## grok 下調べから採るもの

### 1. LangGraph から採るもの

LangGraph の価値は可視化ではなく、**workflow の骨格を state machine として明示できること**にある。

今回採るのは次の考え方である。

- state を型として持つ
- node を関数単位で分ける
- edge を条件つきで張る
- checkpoint を持つ
- 再開可能にする
- human approval を edge condition として扱う

### 2. Hermes から採るもの

Hermes の価値は、自己改善ループにある。

今回採るのは次の考え方である。

- 実行結果から次回用の知見を残す
- skill / note / review を蓄積して次回を速くする
- 一度の execution を単発で終わらせず、継続的に改善する

これは M3E では、`reviews/`、`resume-cheatsheet.md`、`tasks.yaml` 更新規律として取り込める。

### 3. Guardrails 的発想から採るもの

workflow が壊れないために、未知 state、scope 外参照、不正 edge、無効 payload は fail-closed にする。

## 今回の方針

### 第一原則

**既存ツールを流用できるところは流用し、独自実装は workflow authoring の核に限定する。**

### 第二原則

**可視化はサブ。まず workflow を作れることが先。**

### 第三原則

**LangGraph そのものを埋め込むことが目標ではない。LangGraph 的骨格を、M3E と整合する形で取り込むことが目標である。**

## 今回使う範囲のツール

### A. workflow 骨格

最小の state machine モデルを定義する。

必要要素:

- `WorkflowState`
- `WorkflowNode`
- `WorkflowEdge`
- `EdgeCondition`
- `Checkpoint`
- `RunContext`

### B. 既存 runtime として流用するもの

- `tasks.yaml`
- `resume-cheatsheet.md`
- `reviews/Qn_*.md`
- `ScheduleWakeup`
- SessionStart / PostCompact / Stop hooks
- `sub-pj-do`

これらは engine の代替ではなく、**最初の persistence / recovery / trigger 層**として使う。

### C. 今回使わないもの

- 新規DB
- 外部 orchestrator
- LangGraph Studio のような本格可視化
- M3E 全面改修
- 汎用マルチPJ対応

## データ構造の最小案

### WorkflowState

```ts
interface WorkflowState {
  id: string
  kind: "pending" | "ready" | "in_progress" | "eval_pending" | "blocked" | "sleeping" | "escalated" | "done" | "failed"
  reason?: string
  updatedAt: string
}
```

### WorkflowNode

```ts
interface WorkflowNode {
  id: string
  label: string
  role: "generator" | "evaluator" | "router" | "human" | "system"
  actionRef?: string
}
```

### WorkflowEdge

```ts
interface WorkflowEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  condition: string
  onState: WorkflowState["kind"]
}
```

### Checkpoint

```ts
interface Checkpoint {
  workflowId: string
  currentNodeId: string
  currentState: WorkflowState["kind"]
  resumeRef?: string
  savedAt: string
}
```

### RunContext

```ts
interface RunContext {
  taskId: string
  scopeId: string
  reviewRefs: string[]
  wakeupAt?: string
  evaluatorRequired?: boolean
}
```

## 既存資産との写像

### tasks.yaml

- task 単位の現在 state を保持する暫定正本
- `pending / in_progress / done / blocked` を workflow state に拡張する起点

### resume-cheatsheet.md

- checkpoint 復元用の human-readable summary
- Hermes 的な「次回高速化メモ」の役割を持たせる

### reviews/Qn_*.md

- unresolved issue
- blocked / ambiguity / evaluator feedback の蓄積先

### ScheduleWakeup

- sleeping -> ready 遷移の runtime

### hooks

- SessionStart: restore
- PostCompact: checkpoint reload
- Stop: invalid stop の検知

## 最小 workflow モデル

今回の最小状態集合は次とする。

- pending
- ready
- in_progress
- eval_pending
- blocked
- sleeping
- escalated
- done
- failed

### 基本遷移

- pending -> ready
- ready -> in_progress
- in_progress -> eval_pending
- eval_pending -> done
- eval_pending -> in_progress
- in_progress -> blocked
- blocked -> sleeping
- blocked -> escalated
- sleeping -> ready
- 任意 -> failed

### 解釈

- stop は中立概念ではなく、必ず blocked / sleeping / escalated / failed に落とす
- evaluator は外部イベントではなく loop の一部
- human approval は edge condition
- wakeup は sleeping の回復 edge

## 戦略

### S1. 既存流用優先

LangGraph や Hermes の考え方を採るが、まずは既存ファイル規約と hooks の上に載せる。

### S2. workflow authoring 優先

可視化より先に、workflow を定義・編集・実行できる最小表現を作る。

### S3. stop reason の正規化

E1/E2/E3 を含め、停止理由をすべて既知 state に写像する。

### S4. checkpoint 先行

自走より先に resume 可能性を担保する。中断後に続けられない workflow は不採用。

### S5. evaluator の内在化

Generator と Evaluator を同一 workflow 上に置き、state 遷移でつなぐ。

### S6. reviews の Hermes 化

review を単なる保留メモでなく、次回高速化の学習資産として扱う。

### S7. tasks.yaml の state machine 化

現行 state を workflow state にマッピングし、曖昧な運用を減らす。

### S8. trigger の意味づけ固定

ScheduleWakeup は timer ではなく transition runtime として扱う。

### S9. hook の格下げ

hook は正本ではなく runtime guard と位置づける。

### S10. 1 task で試す

最初は 1 workflow / 1 task のみ。複数 task 同時実行は後回し。

### S11. 自己参照 dogfood

PJ03 自身の進行をこの workflow engine で回す。

### S12. Guardrails 的制約

未知 state、無効 edge、scope 外参照、欠損 checkpoint は reject する。

### S13. static / dynamic 分離

tree を壊さず、workflow は overlay または別 view として持つ。

### S14. 粒度横断検証

task、sub-pj、PJ の 3 粒度で同型性が保てるかを検証する。

### S15. 可視化は後置

workflow 表示は engine が回った後に追加する。今は current state と next edge の表示で十分。

## フェーズ

### Phase 0 — 再設計

目的:

- grok 由来の考え方を採り込み、PJ を workflow engine 開発へ再定義する
- 既存資産を state / edge / checkpoint / review に写像する

成果物:

- 最小 state set
- edge 一覧
- 現行資産との対応表
- stop reason taxonomy

### Phase 1 — 最小 workflow engine

目的:

- 1 task 分の workflow を定義し、実際に回す

成果物:

- state transitions
- evaluator loop
- checkpoint / resume
- blocked / sleeping / escalated の区別

### Phase 2 — Hermes 的改善ループ

目的:

- 実行結果を review / cheatsheet に落とし、次回高速化を起こす

成果物:

- review update rule
- cheatsheet update rule
- retry / reflection loop

### Phase 3 — 最小表示

目的:

- current state と next edge を 1 scope 内で確認できるようにする

成果物:

- current workflow summary
- blocked reason summary
- wakeup / escalation visibility

### Phase 4 — 粒度拡張

目的:

- 1 task で作った workflow モデルを sub-pj / PJ に広げる

成果物:

- 粒度横断例
- 相似性の確認

## 成功基準

### 最小成功

- 1 task が workflow として定義できる
- state transition が回る
- evaluator loop が回る
- checkpoint / resume が成立する
- stop reason が必ず既知 state に分類される

### 中間成功

- reviews と cheatsheet が次回高速化に効く
- SelfDrive 自身を自己参照で回せる

### 最終成功

- task / sub-pj / PJ を同型 workflow として扱える
- M3E が静的 tree 整理だけでなく、Agent workflow を扱える構造環境になる

## 非目標

- いきなり LangGraph 互換製品を作ること
- まず可視化から入ること
- 新 infra を大量導入すること
- M3E 全体のデータ構造を今回で確定し切ること

## 直近タスク

1. 最小 state set を確定する
2. tasks.yaml の現行 state を workflow state に写像する
3. stop reason taxonomy を作る
4. checkpoint 構造を決める
5. evaluator loop を 1 task で試す
6. review / cheatsheet 更新規律を決める
7. その後に最小表示を足す

## メモ

LangGraph は構造の流用元であり、Hermes は自走様式の流用元である。
今回の正解は、どちらか片方ではなく、**LangGraph 的 workflow 骨格 + Hermes 的自己改善ループ + 既存 runtime 流用** の組み合わせにある。


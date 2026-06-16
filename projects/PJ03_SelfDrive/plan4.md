---
pj_id: PJ03
project: SelfDrive
status: draft
date: 2026-04-21
supersedes: plan2.md (priority), plan3.md (runtime goalに関して)
related:
  - plan2.md
  - plan3.md
  - idea/non_tree_graph_runtime_warning.md
---

# PJ03 SelfDrive — Plan 4

## TL;DR

PJ03 の本題は、`tree-like M3E` の内部に workflow を説明的に載せることではない。
**tree と相補的に並ぶ non-tree graph runtime を、LangGraph をできる限り取り込んで成立させること**である。

Plan 1 は workflow groundwork、
Plan 3 は system picture demonstration としては価値がある。
しかしその 2 つは、**LangGraph 的 graph runtime を取り込んだことの代替にはならない**。

Plan 4 の目的は、このズレを解消し、
**LangGraph を第一候補・第一正本として導入し、M3E とは projection / bridge で接続する**
ところまでを主題として固定することにある。

## 最重要命題

**LangGraph をできる限り取り込む。**

これを曖昧にしないため、次の読み替えを禁止する。

1. 「LangGraph を取り込む」→「LangGraph 風の図を map に描く」
2. 「non-tree graph runtime」→「tree に workflow を投影する」
3. 「system diagram」→「knowledge tree の一種」
4. 「scope に接続する」→「tree を runtime の正本にする」

Plan 4 では、LangGraph 取り込みを **参考** ではなく **主命題** として扱う。

## 背景整理

### 何がすれ違ったか

これまでの PJ03 では、

- repo 固有運用 (`tasks.yaml`, `reviews`, hooks, checkpoint) の整合
- reducer / orchestrator / daemon / projection の責務分離
- viewer 上の system picture demo

が前進した。

しかしその過程で、
**「LangGraph をできる限り取り込む」よりも「repo 内の説明可能性を先に整える」**
が優先されてしまった。

その結果、

- graph-first runtime ではなく
- tree-first projection や
- demo 用の system picture

が前面に出た。

これは本来の主題からの逸脱である。

### 現在の位置づけ

- Plan 1: groundwork。保持してよい
- Plan 3: demonstration。保持してよい
- Plan 4: **runtime 本題**

## Plan 4 の主題

**LangGraph を第一候補として実際に導入し、PJ03 の既存 checkpoint / review / hook 資産と橋渡ししつつ、
tree に従属しない graph-first runtime を成立させる。**

ここでの runtime は最低限次を満たす。

1. graph node / edge が一次データ
2. conditional branch / loop / retry / route を graph 側が持つ
3. checkpoint は graph 実行位置を持つ
4. M3E map は runtime の正本ではなく projection / viewer / bridge
5. system diagram は graph model の説明図であって、tree ではない

## 優先順位

Plan 4 では次の優先順位を固定する。

1. LangGraph を実際に動かす
2. repo 固有資産との adapter を作る
3. graph 実行を dogfood で確認する
4. 必要最小限だけ M3E に投影する
5. viewer 表示や demo は最後

過去の誤りは、4 と 5 を 1 より先に進めたことにある。

## アーキテクチャ原則

### 原則 A. graph-first

runtime の正本は LangGraph 側の graph 定義と checkpoint である。

### 原則 B. tree は projection

M3E tree / scope / system picture は説明・観察・参照面であり、runtime を支配しない。

### 原則 C. repo 資産は adapter

次は graph runtime の外側 adapter として扱う。

- `tasks.yaml`
- `runtime/checkpoints/*.json`
- `reviews/Qn*.md`
- hooks
- `resume-cheatsheet.md`

### 原則 D. 自前実装は最小

LangGraph が持つ部分は再発明しない。
自前実装は、repo bridge と M3E projection に限定する。

## 非目標

- 自前 graph runtime を先に育てること
- tree-first な system diagram をさらに磨くこと
- LangGraph を使わずに「同等と主張する」こと
- viewer の見た目改善を先行すること
- universal demo skill を先に完成させること

## 方式決定

### 採用方針

**A. LangGraph 採用を既定路線とする**

fallback の自前 runtime は、
LangGraph で repo bridge がどうしても破綻した場合にのみ検討する。
この順序を逆転させない。

### 採用理由

- graph executor 本体を再発明しないため
- loop / checkpoint / branch / route を graph-native に持つため
- tree と別原理の runtime をそのまま取り込むため
- 「LangGraph をできる限り取り込む」という主命題に最も忠実だから

## フェーズ

### Phase 4-0 — LangGraph 実導入の最低成立

目的:

- sandbox ではなく、PJ03 専用 lab として LangGraph を実際に動かす

成果物:

- LangGraph 実行 lab
- `Generator -> Evaluator -> Router` 相当の最小 graph
- 1 cycle 実行ログ

完了条件:

- mock ではなく LangGraph graph が回る
- node / edge / route が graph-native に記述される

### Phase 4-1 — Repo Bridge

目的:

- LangGraph と PJ03 資産を接続する

成果物:

- checkpoint bridge
- reviews bridge
- tasks contract bridge
- hook bridge

完了条件:

- graph 実行位置が repo 側 checkpoint と対応づく
- review 解決が graph route に影響する

### Phase 4-2 — Dogfood

目的:

- PJ03 の実 task または最小同等 task を LangGraph runtime で回す

成果物:

- dogfood log
- fail / retry / block / resume の trace

完了条件:

- reducer 単体ではなく LangGraph runtime 全体として回る
- graph position を含む resume が成立する

### Phase 4-3 — M3E Bridge

目的:

- 必要最小限だけ M3E に投影する

成果物:

- graph summary projection
- current node / next edge / blocked reason 表示

完了条件:

- projection が graph runtime の補助面として成立する
- tree が正本に逆流しない

## 実装対象

最小セット:

- `projects/PJ03_SelfDrive/runtime/langgraph_lab/`
- `projects/PJ03_SelfDrive/docs/langgraph_bridge.md`
- `projects/PJ03_SelfDrive/docs/langgraph_dogfood.md`
- `projects/PJ03_SelfDrive/docs/langgraph_m3e_projection.md`

候補コード:

- `projects/PJ03_SelfDrive/runtime/langgraph_lab/*.py`
- `beta/src/node/langgraph_bridge.ts` または bridge wrapper
- `beta/src/shared/langgraph_projection_types.ts`

## 直近タスク

1. LangGraph lab の実環境を Windows / Linux どちらかで確実に通す
2. `Generator -> Evaluator -> Router` の最小 graph を LangGraph で動かす
3. PJ03 checkpoint JSON との写像を試す
4. reviews/Qn を route 条件に接ぐ
5. そこまで出来てから M3E projection を最小で足す

## 成功基準

### 最小成功

- LangGraph graph が実際に回る
- graph node / edge / route が runtime の正本になる
- PJ03 側資産との bridge が 1 本でも成立する

### 中間成功

- fail / retry / block / resume を LangGraph runtime で扱える
- repo checkpoint と graph position の写像が崩れない
- tree に依存しない system model が説明できる

### 最終成功

- M3E は tree-like knowledge base として残しつつ、
- それと相補的な non-tree graph runtime を LangGraph ベースで持てる

## Gate ルール

Plan 4 では次を gate 判定の最低条件にする。

1. **LangGraph を実際に動かしたか**
2. **graph-first runtime が成立したか**
3. **tree/projection を代替達成扱いしていないか**

この 3 つのどれかが欠けるなら、達成主張をしない。

## Plan 3 との関係

Plan 3 は無駄ではない。
ただし Plan 3 の成果は次に限定される。

- demo runbook
- viewer 上の timed replay
- system picture の説明

これは Plan 4 の補助資料にはなるが、runtime の達成根拠には使わない。

## 確定事項（Plan 4 Phase 4-0 closed / Phase 4-1..4-3 design-deliverables closed / phase-completion open、Gate 6 承認待ち）

> **【Gate 6 adversarial reviewer 指摘の吸収】** 3 Gate 連続で「same-shape over-claim」pattern が検出された
> (Gate 4 MockAdapter smoke / Gate 5 generic-runner-named-PJ03 / Gate 6 stub-as-decider + get_state-as-resume)。
> 本 §確定事項は reviewer の指示する 3 flag を verbatim で含めて整形。Phase 4-0 の 1 本だけを genuine ✓ とし、
> 他は design-closed / phase-open にダウングレード。

### Phase 4-0 (T-9-0 + T-9-1) — LangGraph 実導入 ✓ closed

- T-6-1 自前継続決定は **反転**。LangGraph を runtime 正本に採用（Qn6_plan4_langgraph_priority）
- `runtime/langgraph_lab/pj03_lab.py` が LangGraph 1.1.8 StateGraph で import + compile + invoke する
  （`StateGraph` / `MemorySaver` / `add_conditional_edges` は本物の API）
- 実行ログ: `artifacts/langgraph_run_01.log`
- **genuine ✓**: Plan 4 §Gate ルール 1 (LangGraph を実際に動かしたか) はこの phase で closed

### Phase 4-1 (T-9-2) — Repo Bridge 設計 △ design closed / phase open

- `docs/langgraph_bridge.md` frontmatter `status: authoritative` は **design authority only**。
  Phase 4-1 plan4.md §フェーズ 完了条件「graph 実行位置が repo 側 checkpoint と対応づく / review 解決が graph route に影響する」は **未達**
- 4 bridge の設計だけ完了、実コード (Python `--emit-checkpoint` + TS `langgraph_bridge.ts`) は次 PJ 候補
- TS 側資産の adapter 再配置は **設計文書上の commitment**、実装反映なし

### Phase 4-2 (T-9-3) — Dogfood △ smoke closed / phase open

- `artifacts/langgraph_dogfood_run_01.md` で 3 scenario 実走行を観察。ただし:
  - **Scenario 3 は in-process `get_state` round-trip、NOT cross-process resume**。`checkpoint が graph 実行位置を持つ` (plan4 §最小成功 3) は **未達**。
  - **Verifier / router の branch predicate は deterministic over lab-written state**。graph-first runtime は **location として成立、decision load としては未検証** (requires non-stub verifier)。
- repo checkpoint JSON との実 bridge は未実装

### Phase 4-3 (T-9-4) — M3E Projection 設計 △ design closed / phase open

- `docs/langgraph_m3e_projection.md` frontmatter `status: authoritative` は **design authority only**。
  `projectLangGraphThread` は **設計上の名前**、コードは未実装
- Phase 4-3 plan4.md §フェーズ 完了条件「projection が graph runtime の補助面として成立する」は **未達**
- 既存 `projectGraph` の「廃止候補」扱いも設計文書上の commitment であり、実際のコード削除は次 PJ 判断

### 【正直な残課題】次 PJ 候補

- repo bridge の **実コード** (Python `--emit-checkpoint` + TS `langgraph_bridge.ts`)
- 非 stub verifier (実 Anthropic API SubagentAdapter の LangGraph 統合)
- cross-process resume (SqliteSaver / PostgresSaver) と実 checkpoint round-trip test
- `projectLangGraphThread` の実装 + `projectGraph` 削除
- Plan 2 自前 `graph_runtime.ts` の削除決定

### Plan 4 §Gate ルール 3 条件との整合（adversarial review で flip 済）

| 条件 | 達成 | 根拠 / flag |
|---|---|---|
| 1. LangGraph を実際に動かしたか | ✓ | Phase 4-0、import + compile + invoke が本物の API で通る |
| 2. graph-first runtime が成立したか | △ | location として成立（route function が graph 側）、decision load としては未検証（verifier がスタブ、route predicate が lab-written state に閉じる） |
| 3. tree/projection を代替達成扱いしていないか | ✓ | 本 §確定事項で Phase 4-1/4-3 は design-closed / phase-open と明示、in-memory lab までしか走らせていないと明言、Plan 3 system diagram は **demo** と切り分け |

**Gate 6 判定**: Phase 4-0 で 1 本だけ ✓。Phase 4-1 / 4-2 / 4-3 は design-closed / phase-open。
次 PJ 起票が必要（非 stub verifier / 実 bridge / cross-process resume / projector 実装）。

## 一言でいうと

Plan 4 は、
**tree に従属しない LangGraph ベースの non-tree runtime を本当に取り込むための計画**
である。

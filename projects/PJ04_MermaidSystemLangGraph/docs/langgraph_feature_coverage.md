---
title: PJ04 LangGraph Feature Coverage
pj: PJ04
status: living
date: 2026-04-30
role: "LangGraph の主要機能を M3E で template / GraphSpec / run / test / UI まで実現できているかを追跡する評価表。"
---

# PJ04 LangGraph Feature Coverage

この表は「LangGraph の機能を M3E でどこまで扱えるか」を追跡する。
`langgraph_feasibility.md` は実現可能性の評価表、本書は実装到達度の評価表。

## 凡例

| 値 | 意味 |
|---|---|
| `DONE` | その層では一応使える。最低限の検証も済み |
| `PARTIAL` | 一部実装済み。PJv34 固定・手動検証・仕様不足などが残る |
| `PENDING` | 未実装。設計または handoff のみ |
| `N/A` | その層では直接扱わない |

評価軸:

| 軸 | 意味 |
|---|---|
| Template | System Block Template として定義済みか |
| GraphSpec | M3E の GraphSpec / compile contract に載るか |
| CLI Run | CLI で実行できるか |
| Test | 自動テスト、または明示された smoke test があるか |
| UI | viewer 上で人間が確認・操作できるか |

## Coverage Table

| # | LangGraph 機能 | M3E 表現 | Template | GraphSpec | CLI Run | Test | UI | 現状メモ | 次に詰めること |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `StateGraph` | System Scope / subsystem | DONE | PARTIAL | PARTIAL | PARTIAL | PARTIAL | `langgraph.subsystem.state_graph` 登録済み。PJv34 root / Generate Doc subsystem は compile warning 0 | generic Template System Spec から任意 subsystem を生成 |
| 2 | State schema | State Contract | PARTIAL | PARTIAL | PARTIAL | PENDING | PENDING | GraphSpec channels はあるが schema 本体は型ヒント中心 | State Contract v0.1 を固定 |
| 3 | Channel / reducer | State Channel | DONE | DONE | PARTIAL | PARTIAL | PENDING | `langgraph.state.channel` と GraphSpecChannel がある。reducer は `append/replace/merge/custom` | channel validation と reducer test |
| 4 | `add_node` deterministic callable | Process node | DONE | DONE | PARTIAL | PARTIAL | PARTIAL | `langgraph.node.process` 登録済み。GraphSpec node kind `callable` 対応 | callable registry の generic dispatch |
| 5 | LLM call node | LLM Call node | DONE | PARTIAL | PARTIAL | PARTIAL | PENDING | `langgraph.node.llm` 登録済み。DeepSeek は PJv34 runner で実行成功 | LLMClient を generic runner に接続 |
| 6 | `add_edge` | Default Edge | DONE | DONE | PARTIAL | PARTIAL | PARTIAL | `langgraph.edge.default` 登録済み。GraphSpec static edge 対応 | edge template から generic build |
| 7 | `add_conditional_edges` | Router node / conditional edge | DONE | DONE | PARTIAL | PARTIAL | PARTIAL | `langgraph.node.router` 登録済み。GraphSpec conditional edge 対応 | router_ref dispatch と default route test |
| 8 | `START` / `END` | GraphSpec sentinel / entry / terminal | PARTIAL | DONE | PARTIAL | PARTIAL | PENDING | `__start__`, `__end__`, single `entry` はある | multi-entry は `entries[]` / virtual START で別タスク |
| 9 | Subgraph as node | subsystem block / scope drill-down | DONE | PARTIAL | PARTIAL | PARTIAL | PARTIAL | Generate Doc subsystem を上位 1 node として扱える | generic nested subgraph compile と UI drill-down |
| 10 | Shared state subgraph | parent-child shared State Contract | PENDING | PENDING | PENDING | PENDING | PENDING | 方針は system_design / state docs にあるが未実装 | subgraph channel inheritance rule |
| 11 | Isolated state subgraph | input/output mapper | PENDING | PENDING | PENDING | PENDING | PENDING | mode 属性のみ先行予定 | mapper contract を Phase 4 で決める |
| 12 | Retry / backoff | failure loop inside subsystem | DONE | PARTIAL | PARTIAL | PENDING | PENDING | `langgraph.flow.retry` 登録済み。PJv34 runner に retry node はある | provider failure smoke で retry -> fallback_qn を確認 |
| 13 | Fallback / Qn | fallback_qn node / human review output | PARTIAL | PARTIAL | PARTIAL | PENDING | PENDING | PJv34 runner に fallback_qn はある。reviews/Qn 連携は未接続 | Qn output contract と map連携方針 |
| 14 | `interrupt` | Human Gate | DONE | PENDING | PENDING | PENDING | PENDING | `langgraph.flow.human_gate` 登録済み | Bridge Phase D と approval UI |
| 15 | `Command` | update + goto block | DONE | PENDING | PENDING | PENDING | PENDING | `langgraph.flow.command` 登録済み | GraphSpec edge/node contract へ反映 |
| 16 | `Send` fan-out | Parallel Send block | DONE | PENDING | PENDING | PENDING | PENDING | `langgraph.flow.parallel_send` 登録済み | super-step を自作せず bridge 側に渡す |
| 17 | Map-reduce | Send + reducer | PARTIAL | PENDING | PENDING | PENDING | PENDING | channel reducer はあるが Send 未接続 | fan-out result channel contract |
| 18 | `ToolNode` | Tool Node | DONE | PARTIAL | PENDING | PENDING | PENDING | `langgraph.node.tool` 登録済み。GraphSpec node kind `tool` はある | tool_refs schema と bridge ToolNode |
| 19 | `bind_tools` | provider adapter / tool schema | PENDING | N/A | PENDING | PENDING | PENDING | provider差分が大きい。現戦略では後段 | Anthropic 1本から始める |
| 20 | ReAct agent | LLM + ToolNode + router subsystem | PENDING | PARTIAL | PENDING | PENDING | PENDING | 部品テンプレは一部揃った | sample system spec を作る |
| 21 | `RunnableConfig` | runtime config / configurable | PENDING | PARTIAL | PENDING | PENDING | PENDING | GraphSpec metadata はあるが config propagation は未実装 | config contract と bridge payload |
| 22 | `recursion_limit` | run option / guard | PENDING | PENDING | PENDING | PENDING | PENDING | 未実装 | runner/bridge option に追加 |
| 23 | `thread_id` | Run / Thread | PENDING | N/A | PENDING | PENDING | PENDING | 用語は glossary 化済み。実装未接続 | TS side thread_id 管理 |
| 24 | `MemorySaver` | volatile checkpoint | PENDING | N/A | PENDING | PENDING | PENDING | bridge MVP 後 | bridge smoke で最小対応 |
| 25 | `SqliteSaver` | checkpoint store | PENDING | N/A | PENDING | PENDING | PENDING | 計画のみ | PJ04 runtime sqlite を配置 |
| 26 | `get_state` | runtime state inspect | PENDING | N/A | PENDING | PENDING | PENDING | 計画のみ | bridge IPC |
| 27 | `get_state_history` | checkpoint timeline | PENDING | N/A | PENDING | PENDING | PENDING | 計画のみ | TIME/UI Phase D |
| 28 | `update_state` / time travel | checkpoint fork | PENDING | N/A | PENDING | PENDING | PENDING | 計画のみ | interrupt + time travel task |
| 29 | Stream `values` | run stream value | PENDING | N/A | PENDING | PENDING | PENDING | 計画のみ | bridge stream AsyncIterator |
| 30 | Stream `updates` | node update stream | PENDING | N/A | PENDING | PENDING | PENDING | 計画のみ | per-node update event |
| 31 | Stream `messages` | LLM message/token stream | PENDING | N/A | PENDING | PENDING | PENDING | 計画のみ | provider stream adapter |
| 32 | Stream `debug` | debug event dump | PENDING | N/A | PENDING | PENDING | PENDING | 計画のみ | NDJSON debug trace |
| 33 | Trace / span | Trace Store / Runtime Board | PARTIAL | N/A | PARTIAL | PARTIAL | PENDING | PJv34 runner は trace JSON を出す。NDJSON ring は未実装 | trace schema v0.1 |
| 34 | Error handling | Result / failure route | PARTIAL | PARTIAL | PARTIAL | PENDING | PENDING | PJv34 runner は api_error/bad_output を分岐できる | failure route test |
| 35 | Provider abstraction | LLMClient | PARTIAL | N/A | PARTIAL | PARTIAL | N/A | DeepSeek smoke は成功。generic interface は未完成 | OpenAI/Anthropic/DeepSeek切替の1箇所化 |
| 36 | Secret handling | Secret provider | PARTIAL | N/A | PARTIAL | PARTIAL | N/A | env注入でDeepSeek実行済み。Bitwarden本線は handoff | with-keys / Bitwarden 経路を完了 |
| 37 | Template System Spec | YAML/JSON authoring input | DONE | DONE | PARTIAL | DONE | N/A | `templates/pjv34_weekly_review.yaml` を generic builder が読む。run側はまだPJv34固定 | generic runner へ接続 |
| 38 | Template build CLI | spec -> AppState / GraphSpec | DONE | DONE | DONE | DONE | N/A | `npm run template:build -- --spec ... --out ...` が成功。root / Generate Doc validation 0 | unknown template / missing slot の negative test |
| 39 | Template run CLI | GraphSpec -> artifact / trace | DONE | DONE | DONE | PARTIAL | N/A | `npm run template:run -- --spec ... --out ...` がmock providerで成功。trace node id はControl Graphと一致 | failure route / no-secret を自動テスト化 |
| 40 | Template test CLI | catalog/spec/build/run tests | PENDING | PENDING | PENDING | PENDING | N/A | テスト要件は文書化済み | catalog/spec/no-secret/failure route tests |
| 41 | System Diagram display | Outer graph display | PARTIAL | N/A | N/A | PARTIAL | PARTIAL | flow-lr / edge routing / subsystem表示は進んでいる | template-generated AppState の表示確認 |
| 42 | Contract badges L2 | kind / channel / status badges | PENDING | N/A | N/A | PENDING | PENDING | UI handoff 済み | visual側 task |
| 43 | Subsystem drill-down UI | scope 内部表示 | PARTIAL | N/A | N/A | PARTIAL | PARTIAL | scope移動は既存概念に乗る。template専用確認は未完 | Generate Doc subsystem preview |
| 44 | Runtime trace overlay UI | active node / trace display | PENDING | N/A | N/A | PENDING | PENDING | UI handoff 済み | trace JSON overlay |
| 45 | Data View | State Channel / resource view | PENDING | N/A | N/A | PENDING | PENDING | 用語は固定済み | channel editor / artifact preview |

## 現時点の要約

M3E がすでに持っている強い部分:

- System Block Template catalog は主要 LangGraph pattern の入口を持った
- GraphSpec v0.1 は基本 node / edge / conditional / channel を表現できる
- PJv34 固定なら template 生成、GraphSpec compile、DeepSeek run、artifact / trace 出力まで通った
- system diagram の視覚基盤は別トラックで進行済み

まだ弱い部分:

- generic YAML/JSON Template System Spec reader がない
- runner が PJv34 固定で、callable_ref / template contract による汎用 dispatch ではない
- failure route / no-secret / catalog validation が自動テスト化されていない
- Bridge / checkpoint / streaming / interrupt / tool binding はほぼ未実装
- UI は template-generated AppState / trace を読む段階まで未接続

## 次の埋め方

1. `T-TPL-1`: `Template System Spec` から AppState / GraphSpec を生成する generic builder
2. `T-TPL-2`: generic local runner + catalog/spec/build/run/failure/no-secret tests
3. `T-A-1`: GraphSpec v0.1 contract freeze と vitest
4. `T-B-1`: Python LangGraph bridge MVP
5. UI側: `handoff_ui_template_blocks.md` に沿って template-generated AppState / trace を表示

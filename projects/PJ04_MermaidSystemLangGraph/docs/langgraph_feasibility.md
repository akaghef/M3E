# LangGraph 全機能再現 — 実現可能性評価表

PJ04 (`04_MermaidSystemLangGraph`) で LangGraph (Python, v1.1.8 pin) の機能を M3E (TypeScript + sqlite) 上に移植するときの、**機能ごとの障壁と乗り越え可能性**の棚卸し。

採否判断用。実装計画そのものは [`idea/langgraph_full_feature_reproduction.md`](../idea/langgraph_full_feature_reproduction.md) 参照。

---

## 凡例

- **可能性**: 🟢 高 / 🟡 中 / 🔴 低
- **障壁の強さ**: 🪶 軽 / 🧱 中 / 🗻 重
- **Cost**: S (数日) / M (1-2 週) / L (数週間) / XL (月単位)

---

## 1. Graph Construction（構築層）

| 機能 | 障壁 | 強さ | 可能性 | Cost | 備考 |
|---|---|---|---|---|---|
| `StateGraph(Schema)` → `GraphBuilder<TState>` | TS の generics で state 型を carry するだけ | 🪶 | 🟢 | S | Builder pattern は TS 常套句 |
| `add_node(name, callable)` | — | 🪶 | 🟢 | S | Map<string, fn> |
| `add_edge(a, b)` | — | 🪶 | 🟢 | S | |
| `add_conditional_edges(a, router, map)` | router の return 型を TS の literal union で縛るのが面倒 | 🪶 | 🟢 | S | `keyof` trick でコンパイル時縛り可 |
| `START` / `END` sentinel | — | 🪶 | 🟢 | S | Symbol か reserved string |
| `compile(...)` | 各 option の integration 点が多い | 🧱 | 🟢 | M | Phase 後半ほど拡張する |

**総評**: ここは**ほぼ全部無条件で乗り越えられる**。TS で DSL を書くのは枯れた領域。

---

## 2. State 管理（channel / reducer）

| 機能 | 障壁 | 強さ | 可能性 | Cost | 備考 |
|---|---|---|---|---|---|
| `TypedDict` state | TS は runtime 型情報を持たない | 🪶 | 🟢 | S | interface + Zod/TypeBox で補完 |
| `Annotated[T, reducer]` 相当 | TS に Annotated 構文が無い | 🧱 | 🟢 | S | `defineChannel({ type, reducer })` で明示化、最も自然 |
| `operator.add` reducer | — | 🪶 | 🟢 | S | 自前関数で十分 |
| `add_messages` | `BaseMessage` 型階層と append semantics | 🧱 | 🟢 | M | LangChain.js の `BaseMessage` 互換型を自前で切るか、LangChain.js に依存するか 2 択 |
| Partial state merge (node return `{...state, x: v}`) | — | 🪶 | 🟢 | S | Object spread |
| Multiple channels with different reducers | channel versioning (checkpoint 連動) | 🧱 | 🟢 | M | channel 名と version を checkpoint に保存 |

**総評**: 🟢。Python の `Annotated` 糖衣構文が無いぶん、**明示的な `defineChannel` DSL にしたほうがむしろ TS 的には読みやすい**。

---

## 3. 制御フロー（routing / Command / Send）

| 機能 | 障壁 | 強さ | 可能性 | Cost | 備考 |
|---|---|---|---|---|---|
| Conditional routing | — | 🪶 | 🟢 | S | |
| `Command(goto=..., update=...)` | node return の discriminated union が肥大化しやすい | 🧱 | 🟢 | M | `{ kind: "command", goto, update }` で吸収 |
| `Send("node", payload)` | Pregel super-step (barrier 同期) が必要 | 🗻 | 🟡 | L | 初期は sequential、M2 で super-step 化が現実的 |
| Map-reduce pattern | Send + reducer の組合せ | 🗻 | 🟡 | L | Send が動けば自動的に成立 |
| Dynamic branching (goto mid-execution) | 同上 | 🧱 | 🟢 | M | Command で吸収 |

**総評**: 🟡。**Send + super-step が全体で最大の難所**。ここを正しく実装できるかで「本当に LangGraph 互換」と言えるかが決まる。Pregel の barrier semantics を読み込んでから手を付けたほうがいい。

---

## 4. Subgraph（入れ子）

| 機能 | 障壁 | 強さ | 可能性 | Cost | 備考 |
|---|---|---|---|---|---|
| Subgraph as node | compiled graph を Runnable 化 | 🧱 | 🟢 | M | `compiled.asNode()` で addNode 可能に |
| Shared state subgraph | 親子で channel 同一 schema | 🧱 | 🟢 | M | schema 制約を compile 時 check |
| Isolated state subgraph | state を input/output で isolate | 🧱 | 🟢 | M | `inputMapper` / `outputMapper` を必須化 |
| Recursive subgraph | infinite 再帰防止 | 🧱 | 🟢 | S | recursion_limit と共有の counter |
| Checkpoint scoping | 子 graph の checkpoint を親のどこに置くか | 🗻 | 🟡 | L | LangGraph は `checkpoint_ns` を導入している。追従必要 |

**総評**: 🟢〜🟡。checkpoint の namespace 管理が**隠れた複雑さ**。単純な nest なら S、checkpoint + time travel が絡むと L。

---

## 5. 永続化（checkpointer / thread / time travel）

| 機能 | 障壁 | 強さ | 可能性 | Cost | 備考 |
|---|---|---|---|---|---|
| `MemorySaver` | — | 🪶 | 🟢 | S | Map<threadId, list> |
| `SqliteSaver` | schema 設計（channel versions, pending writes, parents） | 🧱 | 🟢 | M | 既存 sqlite 接続を流用 |
| `thread_id` | — | 🪶 | 🟢 | S | config.configurable |
| `get_state` | — | 🪶 | 🟢 | S | |
| `get_state_history` | checkpoint chain の traversal | 🧱 | 🟢 | M | parent_id で linked list 辿る |
| `update_state(as_node=...)` | 新しい checkpoint を分岐として作る | 🗻 | 🟡 | L | **time travel の肝**。fork した checkpoint id を正しく付番 |
| Pending writes (partial super-step) | super-step 途中の障害復旧 | 🗻 | 🟡 | L | LangGraph は `PendingWrite` を DB に保存する。完全互換は重い |
| Checkpoint versioning | schema 進化への追従 | 🧱 | 🟢 | S | version field + migration hook |

**総評**: 🟢〜🟡。`update_state` での fork と pending writes が**LangGraph の durability 保証の根幹**。ここを妥協すると「動くけど壊れたら落ちる」実装になる。

---

## 6. Streaming

| 機能 | 障壁 | 強さ | 可能性 | Cost | 備考 |
|---|---|---|---|---|---|
| `stream(mode="values")` | AsyncIterator 生成 | 🪶 | 🟢 | S | |
| `stream(mode="updates")` | node 前後の diff 計算 | 🧱 | 🟢 | S | channel version 比較 |
| `stream(mode="messages")` | message channel のみ抽出 | 🧱 | 🟢 | M | LLM token streaming と整合 |
| `stream(mode="debug")` | 全 event dump | 🪶 | 🟢 | S | |
| `stream_events` | event tree / parent 追跡 | 🗻 | 🟡 | L | LangChain の RunTree 互換はかなり重い |
| Token streaming (LLM) | SDK の stream API 吸収 | 🧱 | 🟢 | M | Anthropic/OpenAI で別実装 |

**総評**: 🟢。**基本 stream mode は楽、`stream_events` だけ別格で重い**。後者は Phase 5 以降でいい。

---

## 7. Human-in-the-loop

| 機能 | 障壁 | 強さ | 可能性 | Cost | 備考 |
|---|---|---|---|---|---|
| `interrupt_before=[...]` | compile option | 🪶 | 🟢 | S | super-step 開始時に check |
| `interrupt_after=[...]` | — | 🪶 | 🟢 | S | |
| Dynamic `throw Interrupt(payload)` | executor での catch と state 保存 | 🧱 | 🟢 | M | 型付き例外で吸収 |
| Resume with `invoke(resume=value)` | interrupt 時点の channel 復元 + value 注入 | 🧱 | 🟢 | M | checkpoint 経由で自然に |
| Approval UI（viewer 側） | browser worker と node runtime の往復 | 🧱 | 🟢 | M | M5 で一緒にやる |

**総評**: 🟢。M3E の既存 `escalated` / `blocker` 概念とかなり整合する。**ここはむしろ M3E の得意分野**。

---

## 8. Tool / LLM

| 機能 | 障壁 | 強さ | 可能性 | Cost | 備考 |
|---|---|---|---|---|---|
| `Tool` interface | — | 🪶 | 🟢 | S | name + inputSchema + invoke |
| `ToolNode([tools])` | message 末尾の tool_calls を並列実行 | 🧱 | 🟢 | M | Send が使えると綺麗 |
| `bind_tools(llm, tools)` | SDK 側の tool schema 表現の差異 | 🗻 | 🟡 | L | Anthropic / OpenAI / Gemini で schema が違う。adapter 必須 |
| Anthropic Messages API | SDK drift、tool_use / tool_result | 🧱 | 🟢 | M | SDK 直叩きで十分 |
| OpenAI Responses API | 新旧 API 混在 | 🧱 | 🟢 | M | Responses API を正とする |
| ReAct agent | 上記組合せ | 🪶 | 🟢 | S | 部品が揃えば自明 |
| Multi-agent supervisor | subgraph + routing | 🧱 | 🟢 | M | Send が前提 |
| Agent retry / error recovery | tool 失敗時の graceful | 🧱 | 🟢 | M | Command で goto 元ノード |

**総評**: 🟡。**`bind_tools` の schema 互換が API プロバイダごとに違うのが最大の泥沼**。最初は Anthropic 1 本に絞ったほうがいい。

---

## 9. Compile 設定 / Config

| 機能 | 障壁 | 強さ | 可能性 | Cost | 備考 |
|---|---|---|---|---|---|
| `RunnableConfig` | config propagation (nested 呼出) | 🧱 | 🟢 | S | AsyncLocalStorage 的な context |
| `recursion_limit` | super-step カウンタ | 🪶 | 🟢 | S | |
| `configurable` fields | runtime 差替え可能な値 | 🧱 | 🟢 | M | node 関数に config を渡す契約 |
| `tags` / `metadata` | trace への伝搬 | 🪶 | 🟢 | S | |

**総評**: 🟢。TS の context propagation は少し面倒だが既知問題。

---

## 10. Observability

| 機能 | 障壁 | 強さ | 可能性 | Cost | 備考 |
|---|---|---|---|---|---|
| per-node span | TraceEmitter の実装 | 🧱 | 🟢 | M | OTel API を使うのが一番楽 |
| `run_id` / `parent_run_id` | nest と Send 時の親子関係 | 🧱 | 🟢 | M | |
| OpenTelemetry export | collector の準備（オプション） | 🪶 | 🟢 | S | `@opentelemetry/api` + stdout exporter |
| LangSmith HTTP export | 非公開 API に近い部分あり | 🗻 | 🟡 | L | LangChain SDK に依存すれば楽だが依存が膨らむ |
| Error trace integrity | エラー時に最後まで span を閉じる | 🧱 | 🟢 | M | try/finally 徹底 |

**総評**: 🟡。**OTel までは 🟢、LangSmith 完全互換は 🟡**。LangSmith は "LangChain を import すれば自動" な部分が多く、独立実装すると細かい差分が出やすい。

---

## 11. PJ04 特有の統合

| 機能 | 障壁 | 強さ | 可能性 | Cost | 備考 |
|---|---|---|---|---|---|
| Map → GraphSpec compile | attribute 規約の設計 | 🧱 | 🟢 | M | `m3e:kernel-*` namespace |
| Callable registry | 安全な名前解決（eval 回避） | 🧱 | 🟢 | S | 明示登録のみ |
| Scope = Subgraph の mapping | portal と subgraph の 1:1 対応 | 🪶 | 🟢 | S | すでに設計整合 |
| Browser worker runtime | node-only API (fs, sqlite) の分離 | 🗻 | 🟡 | L | IndexedDB checkpointer 必要、heavy は node に委譲 |
| viewer trace overlay | graph の動的描画 | 🧱 | 🟢 | M | 既存 portal 描画の上に重ねる |
| 既存 workflow_reducer との共存 | 名前空間を徹底分離 | 🪶 | 🟢 | S | `kernel/` 以下に隔離 |

**総評**: 🟢〜🟡。**browser 側の full runtime が最大の変動要因**。heavy を node に逃がす設計にすれば下がる。

---

## 総合判定

| カテゴリ | 総合可能性 | 重心となる障壁 | 必要工数目安 |
|---|---|---|---|
| Graph 構築 | 🟢 | — | S |
| State / Channel | 🟢 | Annotated 糖衣構文の代替 | S-M |
| 制御フロー | 🟡 | **Pregel super-step + Send** | L |
| Subgraph | 🟢 | checkpoint namespace | M-L |
| 永続化 | 🟡 | **time travel fork、pending writes** | L |
| Streaming | 🟢 | stream_events のみ別格 | M |
| Human-in-loop | 🟢 | — | M |
| Tool / LLM | 🟡 | **provider ごとの tool schema 差** | L |
| Config | 🟢 | context propagation | S-M |
| Observability | 🟡 | LangSmith 互換のみ重い | M-L |
| PJ04 統合 | 🟢 | browser worker 分離 | M-L |
| **総合** | **🟡 上寄り** | Pregel super-step / time travel / tool schema / observability | **XL (数ヶ月)** |

---

## 結論

**全機能を "動かす" レベルまで持っていくのは、🟡 高寄り = 十分現実的。** ただし工数は XL (数ヶ月)。

**完全な忠実移植**を目指すと以下 4 点でコストが跳ねる:
1. **Pregel super-step の正しい barrier semantics** （Send が動く前提）
2. **Time travel の checkpoint fork + pending writes**
3. **provider ごとの tool schema adapter**
4. **LangSmith 互換 trace schema の完全追従**

この 4 点は「そこそこ動く」から「壊れない」までのコストが桁違いに高い。
**実用最小で切るなら、(1) を Phase 3c、(2)(3) を Phase 4 後半、(4) は OTel 止まりで LangSmith は opt-in adapter に追いやる**戦略が費用対効果最良。

逆に言えば、**基本 4 割（graph 構築 + state + sequential 実行 + memory checkpointer + streaming values/updates + interrupt）までなら 1-2 ヶ月で到達**でき、そこで一度止めて使いながら残りを足していける。

---
title: PJ04 LangGraph Integration Plan
pj: PJ04
status: draft
date: 2026-04-22
supersedes_partial: idea/langgraph_full_feature_reproduction.md (full TS 再実装案は保留)
---

# LangGraph 内部取り込み計画 — 一貫した状態設計

## 0. 位置づけ

GUI 側 (flow-lr surface / portal / diamond / `[` `]` / edge routing v3) はほぼ完了。
本書は **authoring (map) ↔ spec (GraphSpec) ↔ runtime (LangGraph)** の 3 者がどう一貫した状態を保つかを確定し、各 Phase の deliverable を切る。

[langgraph_feasibility.md](langgraph_feasibility.md) の結論 — 「全機能 TS 再実装 🔴 / subprocess embed 🟢」 — を **本計画の前提として採択**。
[idea/langgraph_full_feature_reproduction.md](../idea/langgraph_full_feature_reproduction.md) は **保留案** (LangGraph 依存を切りたい場面が明確に出てから再開)。

---

## 1. アーキテクチャ確定 — 「どの層が何を所有するか」

```
┌────────────────────────────────────────────────────┐
│ M3E (TS)                                            │
│  - map (sqlite): authoring の単一正本                │
│  - viewer: 描画 + inspection overlay                 │
│  - GraphSpec: map から compile される pure JSON      │
│  - Bridge: subprocess / IPC / trace ingestion        │
└────────────────────────────────────────────────────┘
                     │ JSON over stdio (spec + input)
                     ▼
┌────────────────────────────────────────────────────┐
│ LangGraph (Python subprocess)                       │
│  - registry: callable / tool / router / reducer 実体 │
│  - executor: Pregel super-step + Send + interrupt   │
│  - checkpointer: thread_id ごとの state chain        │
│  - trace emitter: NDJSON event stream → stdout      │
└────────────────────────────────────────────────────┘
```

### 所有権マトリクス (= "一貫した状態" 定義)

| データ | 所有者 | 書き込み主 | 読み側 | 注記 |
|---|---|---|---|---|
| Map 構造 (nodes/links/scopes/attributes) | M3E sqlite | viewer / API | viewer / compiler | 唯一の authoring 正本 |
| GraphSpec JSON | derived | `compileFromMap` 再実行 | Bridge / debug UI | 永続化しない (毎回再生成) |
| Thread / Checkpoint (channel values / versions) | Python | executor | Bridge → viewer overlay | sqlite 別 DB or Python MemorySaver |
| Trace events (per-node span) | Python | executor | Bridge → viewer + OTel | NDJSON stream、ring buffer でファイル保存 |
| Inspection snapshot (map overlay 用の現在 node / 最終 values) | M3E runtime buffer | Bridge | viewer | **map には書き戻さない** (volatile) |
| Registry (callable 実体) | Python module | 開発者 | executor | map 側は ref 文字列のみ |

**核心原則**: map は **execution 状態を持たない**。実行中の live 値はすべて Python 側 + M3E 側の volatile buffer。viewer は overlay で可視化するが **map attribute には書かない**。

### 不変式 (システム化の骨格)

1. **I1 (compile 決定性)**: 同じ map snapshot から `compileFromMap` は同じ `GraphSpec` を返す。時刻・副作用依存しない。
2. **I2 (実行不可侵)**: map 編集は実行中の thread に影響しない。compile 時点の spec が freeze される。
3. **I3 (ref 一方向)**: map は ref 文字列のみ持つ。Python registry の関数実体を map が参照することはない。
4. **I4 (trace 非破壊)**: trace は append-only。map 側に書き戻さない。thread_id で世代管理。
5. **I5 (checkpoint 分離)**: kernel checkpoint は既存 `CheckpointFile` (PJ03) と別 table。migration 無し。
6. **I6 (具象軸 volatile)**: concreteness level / per-node override は window state のみ。map attribute に書き戻さない。詳細 [concreteness_axis.md](concreteness_axis.md)
7. **I7 (introspect 無害)**: `introspect_callable` / `fetch_source` は Python 側の state を変えない (read-only)。

---

## 2. Phase 分割 (直列、各 Phase 独立検証可)

### Phase A — Contract Freeze (現時点で着手可、2-3 日)
**狙い**: map attribute → GraphSpec の契約を確定し、既存実装を pin する。

- [x] `graph_spec_types.ts` / `graph_spec_compile.ts` は実装済 → version `0.1` で freeze
- [x] `map_attribute_spec.md` 第一版は書けている → 抜けを埋める (下記)
- [ ] `compileFromMap` の test 追加 (vitest 単体) — 3 パターン: 最小 linear / conditional / subgraph
- [ ] attribute spec の抜け穴埋め: subgraph scope の channel 継承ルール、conditional edge の default branch 挙動、entry が START 以外のときの semantics

**出口**: `GraphSpec v0.1` が固定。以降 attribute を増やすときは `0.2` に上げる契約を明文化。

### Phase B — Python Bridge MVP (1 週間)
**狙い**: GraphSpec JSON を受け取り LangGraph を invoke できる最小 subprocess を立て、stdin/stdout で往復する。

- [ ] `projects/PJ04_MermaidSystemLangGraph/runtime/bridge/` 新設
- [ ] `bridge.py`: stdin から `{spec, input, config, registry_path}` を読み、LangGraph の `StateGraph` を組んで `invoke` or `stream` する
- [ ] `registry.py`: callable / router / reducer / tool の名前 → 実体の dict。ハードコード開始
- [ ] `schema.py`: stdin/stdout プロトコル定義 (Pydantic)
  - IN: `{kind: "invoke"|"stream"|"update_state"|"get_state_history"|"introspect_callable"|"fetch_source", payload: ...}`
  - OUT: NDJSON stream `{kind: "event"|"state"|"error"|"introspection"|"source", ...}`
- [ ] 具象軸支援 IPC ([concreteness_axis.md §3](concreteness_axis.md) 参照):
  - `introspect_callable`: `{ref}` → `{signature, paramTypes, returnType, docOneLine, modulePath}` (Python `inspect` 使用)
  - `fetch_source`: `{modulePath, symbol}` → `{sourceText, startLine, endLine, filePath}` (symbol スコープのみ、16KB 上限)
  - 両者 **read-only** (I7 不変式)
- [ ] TS 側 `beta/src/node/kernel_bridge/` 新設
  - `spawn_bridge.ts`: child_process.spawn + line-buffered JSON parse
  - `bridge_client.ts`: `invoke(spec, input, { threadId })` → Promise<{finalState, events[]}>
- [ ] smoke test: PJ04 map の小 scope を compile → Python bridge へ流す → 完了 state が返る
- [ ] smoke test: `introspect_callable("agents.planner")` が signature を返す

**出口**: TS から Python LangGraph を呼んで結果を受け取れる。Trace は単純な NDJSON 吐きのみ。具象軸 L3 の下地が整う。

### Phase C — Streaming + Checkpoint (1 週間)
**狙い**: stream mode 4 種と thread 再開を通す。

- [ ] bridge_client `stream()`: AsyncIterator で `values` / `updates` / `messages` / `debug` のいずれかを返す
- [ ] thread_id 管理: M3E 側で UUID 割当、Python 側は `MemorySaver` or `SqliteSaver` (PJ04 専用 sqlite ファイル)
- [ ] `get_state(threadId)` / `get_state_history(threadId)` IPC
- [ ] viewer inspection overlay (最小):
  - 実行中 node を highlight (pulse)
  - 現在 state の簡易 dump panel (collapsible)
  - **map には書き込まない** (volatile)

**出口**: `[play]` ボタンで 1 invoke → map 上でアニメ。中断→再開が thread_id で機能。

### Phase D — Interrupt + Time Travel (1 週間)
**狙い**: human-in-the-loop と checkpoint fork を載せる。

- [ ] `interrupt_before` / `interrupt_after` の spec attribute 追加 (scope 属性 `m3e:kernel-interrupt-before` = JSON array)
- [ ] bridge: interrupt 発生時 `{kind: "interrupted", threadId, pendingNode, state}` を emit
- [ ] viewer: interrupt UI (approve / reject / edit-then-resume)
- [ ] `update_state(threadId, values, asNode?)` IPC
- [ ] time travel: history list → 任意 checkpoint で resume

**出口**: PJ04 map 上に approval gate を描き、実行が止まり、承認で進行する loop が 1 本回る。

### Phase E — Tool / LLM Binding (2 週間 — API key 次第で前倒し可)
**狙い**: Anthropic 1 プロバイダで ReAct agent サンプルを通す。

- [ ] `registry.py` に Anthropic client + 代表的 tool (search / calc / fs_read) 登録
- [ ] map 上で tool node を `m3e:kernel-node-kind=tool` / `m3e:kernel-callable-ref=tool.search` で表現
- [ ] `ToolNode` / `bind_tools` は LangGraph の public API を embed (自前実装しない)
- [ ] ReAct agent サンプル map を PJ04 内に作成し、E2E で invoke
- [ ] OpenAI / Gemini は Out-of-Scope (Phase E+)

**出口**: map authoring だけで ReAct agent が動く。LLM call 結果 trace が viewer に流れる。

### Phase F — Observability + Hardening (1 週間)
**狙い**: trace を信頼できる形で保存し、エラー時に壊れない。

- [ ] Python bridge の trace emitter → NDJSON ring buffer file (`projects/PJ04_MermaidSystemLangGraph/runtime/traces/<threadId>.ndjson`)
- [ ] OTel exporter (optional, env で有効化)
- [ ] viewer の trace timeline (scope 下部に per-node span)
- [ ] subprocess crash recovery: parent が再起動しても thread が継続できる (SqliteSaver 前提)
- [ ] LangSmith は **opt-in adapter** (env `LANGSMITH_API_KEY` 検出時のみ)、正式対応は後回し

**出口**: 1 invoke ごとに trace file が残り、再現できる。crash しても thread_id で拾い直せる。

---

## 3. 本計画で**やらない**こと (Out of Scope)

| 項目 | 理由 |
|---|---|
| TS で LangGraph を再実装 | feasibility 🔴、XL コスト、embed で十分 |
| Pregel super-step の自前実装 | LangGraph 本家に任せる |
| Time travel の pending writes 完全互換 | LangGraph の SqliteSaver をそのまま使う |
| LangSmith 完全互換 trace | OTel 止まり、LangSmith は opt-in |
| Browser Worker で Python 実行 | WASM Python は別プロジェクト相当。node subprocess のみ |
| 既存 PJ03 `workflow_reducer` / `graph_runtime` の書き換え | 契約据え置き |

---

## 4. 未決定事項 (E1/E2/E3 候補 — 決断が要る)

以下は実装着手前にユーザー確認が要るかもしれない点。**Phase A-B は判断保留でも着手可** (contract freeze と bridge MVP は非 LLM で完結)。

### Q1. Python 依存の置き方 — **★★★★☆ 推奨: (a) requirements.txt 同梱**
- (a) `projects/PJ04_MermaidSystemLangGraph/runtime/requirements.txt` で pin (langgraph 1.1.8)、venv を PJ04 配下に作る
  - 利点: PJ ごと独立、beta 本体に Python 依存が漏れない
  - 欠点: 初回 `pip install` が必要
- (b) beta repo 直下に venv
  - 利点: 1 回だけ入れれば beta 全体で共有
  - 欠点: beta を M3E の他 PJ が pure TS として使う前提を崩す
- (c) LangGraph をそのまま import せず HTTP 経由 (LangServe 相当)
  - 利点: プロセス境界が明確
  - 欠点: 1 ユーザー環境で HTTP server は過剰

### Q2. Registry の場所 — **★★★★☆ 推奨: (a) PJ04 配下に隔離**
- (a) `projects/PJ04_MermaidSystemLangGraph/runtime/registry/` に callable を書く。map の ref はここの Python module path
- (b) M3E 共通の registry を作り、PJ をまたぐ
- (c) map の attribute に Python コードを直書き (eval)

### Q3. Trace の persistence — **★★★☆☆ 推奨: (a) NDJSON ファイル**
- (a) NDJSON file per thread、M3E sqlite には入れない
- (b) M3E sqlite の別 table に入れる
- (c) メモリのみ、persist 不要

### Q4. Interrupt UI の承認 token — **Phase D で決める**
- (a) viewer から `{approve: true}` を stdin に書く
- (b) REST API 経由
- (c) sqlite の approval table に書いて bridge が polling

---

## 5. リスク

| リスク | 対策 |
|---|---|
| LangGraph 1.1.8 → 1.2 API drift | **pin + diff watch**。Phase F で upgrade check CI |
| subprocess crash で thread lost | SqliteSaver 前提 (Phase C)。parent restart で resume |
| map ↔ spec ↔ runtime の 3 者同期ずれ | 不変式 I1-I5 を test で強制 (compile 決定性、実行不可侵) |
| registry の eval 事故 | 名前 based registry のみ、map から任意 Python は呼べない |
| Python / Node 環境差 (Windows) | subprocess spawn の args / env を OS 分岐、CI で両方 smoke |

---

## 6. 判断の要点

**本計画は「LangGraph を M3E で描く + 動かす + 覗く」authoring + inspection layer に徹する**。
LangGraph を置き換えず、上に乗る。

この方針が受け入れ可能なら Phase A から着手する。
受け入れ難い (TS 自前実装を本気で進めたい) 場合、[idea/langgraph_full_feature_reproduction.md](../idea/langgraph_full_feature_reproduction.md) に切り替え、本計画は保留。

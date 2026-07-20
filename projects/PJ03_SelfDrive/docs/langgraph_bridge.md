# LangGraph Repo Bridge Design (T-9-2)

- **status**: authoritative (Plan 4 Phase 4-1)
- **phase**: 9
- **source**: plan4.md Phase 4-1 指示、T-9-1 lab (pj03_lab.py) を基底
- **referenced by**: T-9-3 dogfood, T-9-4 M3E projection

## 責務再配置（Plan 4 反転の核）

**LangGraph が runtime 正本。PJ03 既存 TypeScript 資産は bridge / adapter**:

```
┌──────────────────────────────────────────────┐
│ LangGraph runtime (Python, runtime.py)       │
│   StateGraph + MemorySaver/SqliteSaver       │
│   node / edge / conditional edge が一次データ │
│                                               │
│   ↑↓ bridge JSON (file-level 一方向 or pubsub) │
│                                               │
├──────────────────────────────────────────────┤
│ PJ03 TypeScript adapter 群                   │
│  - checkpoint JSON ↔ LangGraph thread state  │
│  - reviews/Qn*.md   → route condition        │
│  - tasks.yaml       → graph config           │
│  - hooks            → thread resume          │
│  - workflow_reducer │ → adapter downstream    │
│  - workflow_orchestrator │ → adapter (実 AI) │
│  - workflow_scope_projector │ → M3E bridge   │
└──────────────────────────────────────────────┘
```

## 4 bridge 設計

### 1. checkpoint bridge

**方向**: LangGraph thread state → repo checkpoint JSON (downstream)。逆流は原則しない。

**mapping**:

| LangGraph field | PJ03 checkpoint field | 備考 |
|---|---|---|
| `state.kind` | `state.kind` | 語彙一致 (pending/ready/in_progress/verifier_pending/done/blocked) |
| `state.round` | `state.round` | 同値 |
| `state.round_max` | `state.round_max` | 同値 |
| `state.feedback` | `state.last_feedback` | 名前差分のみ |
| `state.blocked` | `state.kind == "blocked"` + `state.blocker` | 論理同値、blocker 文字列は派生 |
| `state.last_node` | `state.graph_position` | graph position をそのまま格納 (既存 field 再利用) |
| checkpointer thread_id | `state.graph_thread_id` (新規追加候補) | もしくは task_id == thread_id の等式で暗黙一致 |
| `trace` | artifacts/langgraph_dogfood_run_*.md | 永続化は dogfood log のみ |

**実装方針**:
- `beta/src/node/langgraph_bridge.ts`: Python runtime が吐いた thread state JSON を読み、
  PJ03 checkpoint JSON 形式に mapping する downstream 変換器
- Python 側は lab で既に state を dict で返せる → `--emit-checkpoint <path>` で JSON dump、
  TS 側 bridge が読み取り
- thread_id は `task_id` と 1:1 (PJ03 の場合)。multi-thread は Plan 4 scope 外

### 2. reviews bridge

**方向**: reviews/Qn_*.md frontmatter → LangGraph conditional edge の state field (upstream input)。

**mapping**:

- review resolution `open` / `resolved` / `rejected` → state field `reviews_resolution: dict[str, str]`
- LangGraph 側 conditional edge が `state["reviews_resolution"]["Qn3"] == "resolved"` 等で route

**実装方針**:
- Python 側で `scan_reviews(reviews_dir)` が最初の invoke 前に reviews ディレクトリを読む
- TS 側 `ReviewsDirReviewResolver` は既存。Python からも同じ frontmatter パターンで読める
- 変換 adapter は Python 側に置く (LangGraph が正本なので)

### 3. tasks contract bridge

**方向**: tasks.yaml → LangGraph graph config (upstream input)。

**mapping**:

- `contract.done_when` / `contract.eval_criteria` → graph node の prompt payload
- `contract.dependencies` → 初期 invoke の precondition check (全員 done でなければ graph 起動しない)
- `contract.round_max` → initial state の round_max
- `contract.linked_review` → reviews bridge の lookup key

**実装方針**:
- Python 側で `load_contract(tasks_file, task_id)` が yaml 読み
- `build_state_for_task(contract)` が `PJ03State` initial を組み立てる
- yaml-to-dict は Python の pyyaml で十分

### 4. hook bridge

**方向**: SessionStart/PostCompact → LangGraph thread resume (bidirectional)。

**mapping**:

- SessionStart hook → Python `resume_thread(thread_id)` → app.get_state(config) の現状を TS 側に JSON dump
- PostCompact hook → 同じ手順を compaction 直後に実行
- 既存 `scripts/hooks/session-start.sh` は TS 側 workflow_cli --resume を呼んでいる。Plan 4 では
  その `--resume` 実装を LangGraph runtime 呼び出しに差し替える (将来)

**実装方針**:
- 既存 hook scripts は **保持**。中で呼ぶ Python lab CLI を追加 (`pj03_lab.py --resume <thread_id>`)
- hook 出力の additionalContext に LangGraph thread snapshot を embed

## Python / TypeScript 境界

- **Python 側 (runtime 正本)**: `projects/PJ03_SelfDrive/runtime/langgraph_lab/*.py`
  - LangGraph StateGraph / MemorySaver
  - reviews / tasks / checkpoint の読取 (loader module)
  - JSON dump/load via `--emit-*` CLI flags
- **TypeScript 側 (adapter)**: `beta/src/node/langgraph_bridge.ts`
  - Python 側の JSON dump を parse
  - 既存 checkpoint JSON 形式との往復 mapping
  - 既存 CLI (`workflow_cli.ts`) の `--resume` で Python Lab を subprocess 実行するか、中間 JSON 経由で連携
- **通信**: 当面は **file-level JSON 交換** (Python が dump → TS が read)。pub/sub や HTTP は Plan 4 scope 外

## 既存 TS 資産の adapter 格下げ

| TS 資産 | Plan 4 での役割 |
|---|---|
| `workflow_reducer.ts` | **Python LangGraph が正本。TS reducer は廃止候補 or "offline simulation" adapter に限定**。dogfood 後に決定 |
| `workflow_orchestrator.ts` | 実 Anthropic API 呼び出し adapter として temporary 保持。将来 Python 側から呼ぶか、LangGraph 標準 LLM integration に置換 |
| `workflow_scope_projector.ts` | **M3E bridge** として保持 (T-9-4 で設計)。LangGraph thread state → AppState の downstream projection |
| `clock_daemon.ts` | LangGraph の node で sleep/schedule を扱う場合は不要。保持 but deprecated |
| `graph_runtime.ts` | **Plan 2 自前 runtime。Plan 4 反転で役割消失**。削除 or "legacy reference" として保持 (T-9-5 gate で決定) |

## 具体的に実装する最小 bridge (T-9-3 dogfood で使う分)

1. Python: `pj03_lab.py` 拡張
   - `--task-id <id>`: tasks.yaml から contract を読む
   - `--reviews-dir <dir>`: reviews 読む
   - `--emit-checkpoint <path>`: 最終 state を PJ03 checkpoint JSON 形式で書き出す

2. TS: `langgraph_bridge.ts` スケルトン
   - `importFromLangGraph(jsonPath): void` — Python emit を読んで checkpoint JSON を更新
   - 既存 reducer の saveCheckpointState を経由 (SSOT 維持)

3. 1 cycle dogfood: T-9-3

## 本 plan の非目標

- Python と TS を runtime-level で双方向通信 (pub/sub, gRPC)
- LangGraph の Anthropic integration を実動 (API key 要)
- subgraph / multi-thread / streaming
- Plan 2 自前 runtime を Plan 4 timeline 内で削除

## Cross-reference

- `projects/PJ03_SelfDrive/plan4.md` §アーキテクチャ原則
- `projects/PJ03_SelfDrive/runtime/langgraph_lab/pj03_lab.py` (T-9-1)
- `projects/PJ03_SelfDrive/artifacts/langgraph_run_01.log` (T-9-1 実行)
- `projects/PJ03_SelfDrive/docs/langgraph_vs_native_decision.md` (T-6-1、反転済)

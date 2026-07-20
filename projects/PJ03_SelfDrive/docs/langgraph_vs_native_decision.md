# Decision: LangGraph 採用 or 自前 graph runtime 継続

- **status**: authoritative (T-6-1)
- **phase**: 6 (Plan 2 Phase C)
- **source**: T-4-2 langgraph_gap_memo.md + T-5-3 dogfood_run_04.md の両方を根拠
- **referenced by**: T-7-1 scope projection の graph 拡張、plan2.md §確定事項

> **[2026-04-21 追記 — Plan 4 で反転]** 本決定 (T-6-1) は akaghef が [plan4.md](../plan4.md) で明示的に
> 反転した。**Plan 4 では LangGraph を第一正本として採用**、自前 runtime は adapter に格下げ。
>
> 本決定の根拠 (Python/TS 境界コスト / checkpoint 粒度 / Plan 2 scope) は **Plan 2 scope 内の判断** としては
> 有効だったが、PJ03 本題「tree と相補的な non-tree runtime を取り込む」に対しては scope 不足だった。
> 詳細: [reviews/Qn6_plan4_langgraph_priority.md](../reviews/Qn6_plan4_langgraph_priority.md)
>
> 以下の本文は **Plan 2 時点の記録** として保持、現在の runtime 決定ではない。

## 結論 (Plan 2 時点 — Plan 4 で反転済)

**自前 graph runtime を継続採用する（暫定 1 年、次の見直し基準付き）。**

LangGraph への切り替えは **Plan 2 では行わない**。ただし下記の条件のいずれかが満たされたら再評価する（後述 §再評価トリガ）。

## 判断根拠

### 自前 runtime が解決済みの gap

dogfood_run_04 で G1-G3 すべてが実走行で closed:

| gap | 状態 | dogfood_04 の根拠 |
|---|---|---|
| G1: graph を実行入力として読む runtime | closed | `runGraph(GraphInstance)` が 2 scenario で回った |
| G2: add_node callable 相当 | closed | `resolveCallable` が role → SubagentAdapter メソッドを bind |
| G3: conditional edge の graph ネイティブ表現 | closed | `evalCondition` が always / evaluator_pass / evaluator_fail / round_lt_max / custom を処理 |

Phase 2 までに整備した reducer / orchestrator / Clock / hook / scope projector をそのまま再利用。

### LangGraph 採用の「価値があると断定できない」理由

1. **Python/TS 境界コスト**: LangGraph は Python。PJ03 の reducer / orchestrator / projector は TypeScript。採用するなら
   - Python 側に graph executor を置く
   - TS 側の reducer に HTTP/IPC で state を投げる
   - または reducer を Python に re-implement する  
   のいずれかが必要。どれも既存資産を半分以上捨てる

2. **checkpoint schema の粒度不一致**: LangGraph の checkpointer は thread_id × node-level だが、PJ03 の
   checkpoint JSON は task-level 1 file。統合するには schema を LangGraph 側に寄せる必要があり、
   その場合 Phase 1.5 rework で akaghef が明示した「SSOT は checkpoint JSON / invariant 9 field 欠落なし」
   要件を満たしながら LangGraph の multi-step checkpoint を載せる設計が要る。重い

3. **Plan 2 の規模感**: Plan 2 の残 Phase（D scope 接続）は TypeScript + AppState projection。LangGraph 採用で
   projection を Python 経由にするのは scope 違い

4. **multi-agent / subgraph / streaming は現時点で対象外**: これらは LangGraph が強い領域だが、
   Plan 2 非目標。Plan 2 で埋めるべき gap（G1-G3）は自前で closed。
   つまり「LangGraph でしか書けない機能」が現 scope に無い

### 自前 runtime 継続の制約（承知している）

以下は自前 runtime のままでは LangGraph 相当にならない点で、Plan 2 の scope 外と明示する:

- subgraph / 入れ子 graph
- node-level checkpoint（現 runtime は task-level）
- streaming
- supervisor pattern / multi-agent orchestration
- Hermes 的自己改善ループの「次 round Generator prompt への feedback 自動注入」実装（interface は FeedbackHook で露出済、実装は未）

これらが要る時点で LangGraph 採用（または自前を LangGraph 相当まで拡張）を再評価する。

## 再評価トリガ

以下のいずれかが満たされたら LangGraph 採用を再検討:

1. **node-level checkpoint が必要になる**: 単一 task 内で複数の node を重い計算として実行し、
   途中 resume が必要（LangGraph の MemorySaver / SqliteSaver が node 粒度で持つ機能）
2. **subgraph / 入れ子 graph が必要になる**: task を subtask に分解し、subgraph を部品化したいと
   akaghef が明示した
3. **streaming（token-level）が必要になる**: AI Chat UI 系の PJ で必須化
4. **multi-agent supervisor が必要になる**: 1 PJ 内で 2+ agent が並列協調動作する
5. **自前 runtime が LangGraph に対して明確に劣後する bug / ギャップを再発見する**
6. **1 年経過時点（2027-04-21 目安）での time-boxed 再評価**: 上記 1-5 に該当しなくても、
   年次で LangGraph の進化 / 自前 runtime の育ち具合を突き合わせる

上記に該当しない限り、自前 runtime を採用し続ける。

## 監視 watch items（軽量）

LangGraph の進化を継続的に watch するための最小項目:

- LangGraph 公式 release notes（major version bump、API break、Python 以外 SDK の有無）
- multi-agent / streaming 需要がユーザーから上がってきたら即再評価
- node-level checkpoint の設計要求が M3E 側から出たら即再評価

これは自前 runtime が「取り残される可能性」（§非採用側の欠点）に対する運用的な answer。

## 後続 task への影響

- T-7-1 graph projection 拡張: 自前 `GraphInstance` を AppState に投影。LangGraph 採用時より実装が単純
- Hermes 自己改善ループ: 自前 orchestrator の `FeedbackHook` をそのまま拡張すれば成立。別 PJ 候補
- 実 Anthropic API SubagentAdapter: 自前 runtime + adapter でそのまま差し替え可能。別 PJ 候補

## 採用案 / 非採用案の理由（要約）

### 採用（非選択）: LangGraph

- **利点**: graph executor 本体を作らなくてよい / checkpoint / conditional / loop / subgraph / streaming が既存 / 業界標準に載る
- **欠点**: Python/TS 境界コスト / checkpoint schema 粒度不一致 / Plan 2 規模で投資回収できない / 現時点で LangGraph 優位の機能（subgraph / streaming 等）が Plan 2 scope 外

### 非採用（選択）: 自前 runtime 継続

- **利点**: 既存 TypeScript 資産をそのまま使える / Plan 1.5 で確立した checkpoint SSOT を維持 / reducer / orchestrator / daemon / projector のレイヤ分離が壊れない / Plan 2 の scope と粒度が一致
- **欠点**: subgraph / streaming / node-level checkpoint が現時点で未 / 業界標準でないため外部連携時の adapter コストはいずれ発生 / 長期的に LangGraph の進化から取り残される可能性

### 決定後の bias 点検（adversarial review 2026-04-21 で指摘された点）

Gate 4 pre-gate adversarial review で以下が指摘された:

> Gate 2 の指摘は「reducer を engine と呼びすぎ」であり、build-vs-buy の根拠にはならない。
> 本メモで Gate 2 を自前維持の正当化に使うのは category error で、sunk-cost を隠した rhetoric。

正しい整理に直す:

- Gate 2 差戻の教訓は「**名前と実体を一致させる**」こと。build-vs-buy とは独立
- 本決定の根拠は次の 3 つのみで、Gate 2 とは切り離す:
  1. **Python/TS 境界コスト**: 既存 TypeScript 資産（reducer / orchestrator / projector / daemon / hook 配線 / scope projection）の半分以上を adapter 化で役目変更することになる
  2. **checkpoint 粒度の設計**: 既存 checkpoint JSON は task-level SSOT。LangGraph の thread×node 粒度と統合するには schema レベルの書き換えが要り、Plan 2 の scope を超える
  3. **Plan 2 の scope と LangGraph 優位機能の不一致**: subgraph / streaming / multi-agent が Plan 2 非目標で、LangGraph 優位の領域が現 scope に無い

LangGraph に乗り換えれば「reducer は adapter である」と**強く示せる**ので、名前と実体の一致には
むしろ有利であり得る。しかし上記 3 点の実務コストが大きいため、本 Plan 2 では自前継続とする。
Plan 2 を超える scope（subgraph / streaming / multi-agent）が発生したら再評価する。

## Cross-reference

- `projects/PJ03_SelfDrive/docs/langgraph_gap_memo.md`: gap matrix
- `projects/PJ03_SelfDrive/artifacts/dogfood_run_04.md`: 自前 runtime 実走行
- `projects/PJ03_SelfDrive/runtime/langgraph_sandbox/`: Python sandbox（再評価時に再利用）
- `backlog/pj03-gate-integrity-lessons.md`: 基礎工事 vs 実体 の教訓

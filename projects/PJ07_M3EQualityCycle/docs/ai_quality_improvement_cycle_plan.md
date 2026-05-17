---
title: PJ04 AI Quality Improvement Cycle Plan
pj: PJ04
status: draft
date: 2026-05-17
source:
  - ../references/chatgpt/260517_ai_quality_improvement_cycle.md
references:
  - ../../../docs/00_Home/Current_Status.md
  - ../../../docs/00_Home/Glossary.md
  - ../plan.md
  - ../../PJ04_MermaidSystemLangGraph/docs/global_strategy.md
  - ../../PJ04_MermaidSystemLangGraph/docs/langgraph_integration_plan.md
  - ../../PJ04_MermaidSystemLangGraph/docs/langgraph_feature_coverage.md
  - ../../PJ04_MermaidSystemLangGraph/docs/map_attribute_spec.md
  - ../../PJ04_MermaidSystemLangGraph/docs/system_block_templates.md
  - ../../../beta/src/node/graph_spec_compile.ts
  - ../../../beta/src/node/template_system_builder.ts
  - ../../../beta/src/node/template_run_cli.ts
  - ../../../beta/tests/unit/template_system_builder.test.js
---

# AI 品質改善サイクル実装計画

## 0. 位置づけ

この文書は、ChatGPT で検討した「AI による品質改善サイクル」を、PJ07 の実データ整理 PJ として実装するための計画である。

本計画は PJ04 の `langgraph_integration_plan.md` を置き換えない。PJ04 は `Authoring Map -> GraphSpec -> Runtime -> Trace Store -> Runtime Board` の runtime / system diagram 側を担当し、PJ07 はその上で扱う **実データ整理・品質改善ループ** を担当する。

既存方針との接続:

| ID | 接続先 | 本計画での使い方 |
|---|---|---|
| CF1 | `map` は authoring 正本 | AI は正本を直接改善せず、report / patch proposal / run log を出す |
| CF2 | `GraphSpec` は derived | 品質改善ループの実行契約も map から compile する |
| CF3 | Runtime state / trace は map に書き戻さない | trace は JSONL / artifact として保存し、viewer では overlay 表示だけにする |
| CF4 | AI-fill は Inner 限定 | 構造変更案は Inner / review surface で見せ、Outer は人間が確定する |
| CF5 | `S2` / `S3` 優先 | 自動改善より先に差分可視化、rollback、audit を固定する |

## 1. 現状観測

| ID | 事実 | 根拠 |
|---|---|---|
| ST1 | PJ04 は M3E を LangGraph 系システムの協働 authoring 環境にする sandbox | `plan.md`, `global_strategy.md` |
| ST2 | GraphSpec v0.1 と `compileFromMap` は存在する | `beta/src/shared/graph_spec_types.ts`, `beta/src/node/graph_spec_compile.ts` |
| ST3 | Template System Spec -> AppState / GraphSpec -> local run は通っている | `template_system_builder.ts`, `template_run_cli.ts`, `template_system_builder.test.js` |
| ST4 | `npm run template:test` は通過した | 2026-05-17 実行、1 file / 8 tests pass |
| ST5 | Python の default 環境では LangGraph は未導入 | `python .../smoke_test.py` が `ModuleNotFoundError: No module named 'langgraph'` |
| ST6 | LangGraph 依存は PJ04 sandbox 側に pin 済み | `runtime/langgraph_sandbox/requirements.txt` に `langgraph==1.1.8` |
| ST7 | Bridge / checkpoint / streaming / interrupt / tool binding はまだ未実装領域 | `tasks.yaml` の `T-B-1` 以降 |

結論: いきなり LangGraph bridge で品質改善ループを始めない。最初は既存の TS/template local runner 上で評価器と patch proposal を固め、Bridge MVP 後に LangGraph runtime へ差し替える。

## 2. 守る不変式

| ID | 不変式 | 破ると起きる問題 |
|---|---|---|
| IN1 | AI は正本 map を直接書き換えない | 思考資産の消失、認知接続の破壊 |
| IN2 | すべての改善案は `proposal/result` 形か patch 形で保存する | 採否・rollback・audit ができない |
| IN3 | 低リスクでも apply 前に recovery point を作る | `S3` の保存・復元優先と矛盾する |
| IN4 | evaluator と generator は分離する | 自己正当化ループで評価が汚染される |
| IN5 | trace / score / diagnosis は append-only | 失敗例から学習できない |
| IN6 | GPT 会話歴は最初の訓練対象にしない | 会話は価値が高いが正解判定が難しく、評価器が育たない |
| IN7 | 最初の訓練対象は数学 / 仕様 / テンプレ付き文書にする | round-trip と coverage の評価がしやすい |

## 3. 目標アーキテクチャ

```text
M3E map / scope
  ↓
ScopePackage
  ↓
Quality Evaluator
  ↓
ScopeQualityReport
  ↓
Patch Proposal Pool
  ↓
Review / Apply Gate
  ↓
Accepted patch + RunLog + Learning Data
  ↺
```

LangGraph bridge 後:

```text
Authoring Map
  ↓ compileFromMap
GraphSpec
  ↓ bridge_client
Python LangGraph
  ↓ NDJSON events
Trace Store / Runtime Board
  ↓ approved patch only
Authoring Map
```

## 4. データ契約

### 4.1 ScopePackage

```ts
type ScopePackage = {
  scopeId: string;
  mapId: string;
  band: "flash" | "rapid" | "deep" | "system";
  nodes: Array<{
    id: string;
    text: string;
    nodeType: string;
    parentId: string | null;
    attributes: Record<string, string>;
  }>;
  links: Array<{
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    relationType?: string;
    label?: string;
  }>;
  linearText?: string;
  templateId?: string;
};
```

### 4.2 ScopeQualityReport

```ts
type ScopeQualityReport = {
  reportId: string;
  scopeId: string;
  generatedAt: string;
  scores: {
    structure: number;
    coverage: number;
    coherence: number;
    relation: number;
    evidence: number;
    redundancy: number;
    projection: number;
    reversibility: number;
    overall: number;
  };
  diagnostics: {
    missingSlots: string[];
    weakBranches: string[];
    orphanCandidates: string[];
    redundantNodePairs: Array<[string, string]>;
    relationCandidates: Array<{ sourceId: string; targetId: string; relation: string; confidence: number }>;
  };
  recommendedPatches: PatchProposal[];
  confidence: number;
};
```

### 4.3 PatchProposal

既存の `AI_Common_API.md` の `proposal/result` 形に寄せる。自然文の改善案ではなく、適用可能な構造差分を主形式にする。

```ts
type PatchProposal =
  | { kind: "rename-node"; nodeId: string; before: string; after: string; risk: "low" | "mid" | "high" }
  | { kind: "set-attribute"; nodeId: string; key: string; before?: string; after: string; risk: "low" | "mid" | "high" }
  | { kind: "add-node"; parentId: string; draft: { text: string; attributes?: Record<string, string> }; risk: "mid" | "high" }
  | { kind: "move-node"; nodeId: string; oldParentId: string; newParentId: string; risk: "mid" | "high" }
  | { kind: "add-link"; sourceNodeId: string; targetNodeId: string; relationType: string; risk: "mid" | "high" }
  | { kind: "merge-nodes"; sourceIds: string[]; targetId: string; strategy: string; risk: "high" };
```

### 4.4 QualityRunRecord

```ts
type QualityRunRecord = {
  runId: string;
  scopeId: string;
  templateId?: string;
  promptId?: string;
  workerModel?: string;
  inputHash: string;
  reportHash: string;
  patchHash: string;
  scores: ScopeQualityReport["scores"];
  accepted: boolean | null;
  createdAt: string;
};
```

## 5. 実装フェーズ

### PH1. 非 LLM 品質観測器

目的: まず map を壊さない観測器を作る。

| ID | 作業 | 成果物 | 検証 |
|---|---|---|---|
| QP1 | `ScopePackage` extractor | `beta/src/node/scope_quality_package.ts` | fixture scope から安定 JSON を生成 |
| QP2 | heuristic evaluator | `beta/src/node/scope_quality_evaluator.ts` | depth / branching / long text / orphan / duplicate rough score |
| QP3 | report type | `beta/src/shared/scope_quality_types.ts` | TS compile |
| QP4 | CLI | `beta/src/node/scope_quality_cli.ts` | `node dist/node/scope_quality_cli.js --fixture ... --out tmp/...json` |
| QP5 | tests | `beta/tests/unit/scope_quality_evaluator.test.js` | `npm run test:unit -- scope_quality` |

Exit: `ScopeQualityReport` が LLM なしで出る。patch はまだ apply しない。

### PH2. Template coverage evaluator

目的: 汎用スコアではなく、文書型 / scope 型ごとの「あるべき slot」を測る。

| ID | 作業 | 成果物 | 検証 |
|---|---|---|---|
| QP6 | template requirement schema | `projects/PJ04_MermaidSystemLangGraph/templates/quality_scope_template.yaml` | YAML load |
| QP7 | coverage matcher | `scope_quality_evaluator.ts` 拡張 | missingSlots が安定出力 |
| QP8 | math/spec fixtures | `projects/PJ04_MermaidSystemLangGraph/specs/quality_fixtures/` | gold report と比較 |
| QP9 | coverage report markdown | `scope_quality_cli.ts --format md` | 人間が読める |

Exit: 数学 / 仕様 / PJv template に対して coverage が説明可能になる。

### PH3. round-trip evaluator

目的: M3E の品質観測量を「文書 -> map -> 文書」の可逆性で測る。

| ID | 作業 | 成果物 | 検証 |
|---|---|---|---|
| QP10 | map -> outline serializer | `beta/src/node/scope_outline_serializer.ts` | deterministic snapshot |
| QP11 | original vs reconstructed comparator | `scope_quality_evaluator.ts` 拡張 | coverage / hallucination / order drift を出す |
| QP12 | benchmark set | 数学・設計文書の小型 fixture | gold score |
| QP13 | run log | `tmp/quality-runs/*.jsonl` | append-only |

Exit: GPT 会話歴ではなく、まず評価しやすい文書で測定器を鍛える。

### PH4. patch proposal pool

目的: 自動改善ではなく、採否可能な差分候補を作る。

| ID | 作業 | 成果物 | 検証 |
|---|---|---|---|
| QP14 | patch proposal schema | `beta/src/shared/map_patch_proposal.ts` | schema test |
| QP15 | report -> patch generator | 低リスク rename / tag / missing slot draft | patch risk が付く |
| QP16 | review artifact | `tmp/quality-proposal-review.html` | accept/reject UI は localStorage でよい |
| QP17 | dry-run validator | patch 適用前後の invariant check | no mutation dry-run |

Exit: patch を人間が見て採否できる。ここまで正本 map は不変。

### PH5. safe apply gate

目的: `S3` に沿って rollback 可能な最小 apply を作る。

| ID | 作業 | 成果物 | 検証 |
|---|---|---|---|
| QP18 | recovery point hook | apply 前 backup / audit record | backup existence test |
| QP19 | low-risk apply | rename / set-attribute のみ | before/after diff |
| QP20 | mid/high-risk block | move / merge / add-link は review-only | 自動 apply されない |
| QP21 | audit log | patch id / actor / timestamp / before / after | append-only |

Exit: AL3 まで。構造再編は human review のまま。

### PH6. LangGraph bridge MVP に接続

目的: 品質改善 workflow を Runtime backend として LangGraph に載せる。

前提:

- `T-A-1`: GraphSpec v0.1 contract freeze
- `T-B-1`: Python LangGraph subprocess bridge MVP
- PJ04-local Python environment が使えること

| ID | 作業 | 成果物 | 検証 |
|---|---|---|---|
| QP22 | PJ04-local venv setup | `.venv` or documented local env | `smoke_test.py` OK |
| QP23 | quality workflow GraphSpec | `templates/quality_improvement_cycle.yaml` | `template:build` pass |
| QP24 | bridge runner target | local runner / bridge runner の切替 | same trace node ids |
| QP25 | NDJSON trace | `runtime/traces/<threadId>.ndjson` | append-only |

Exit: TS local runner と Python LangGraph runner で同じ品質改善 workflow が走る。

### PH7. Runtime Board / learning loop

目的: 失敗・採否・改善履歴を資源化する。

| ID | 作業 | 成果物 | 検証 |
|---|---|---|---|
| QP26 | Runtime Board overlay | active node / score / patch count | map attribute 不変 |
| QP27 | feedback ingestion | accepted/rejected を run record に追記 | append-only |
| QP28 | calibration | human feedback で score threshold を補正 | replay test |
| QP29 | template candidate pool | accepted run から template 候補抽出 | Deep 正本には即昇格しない |

Exit: 改善履歴と失敗履歴が次回 worker dispatch に使える。

## 6. 自動化レベル

| ID | Level | 許可 |
|---|---|---|
| AL0 | read-only | index / score / report |
| AL1 | proposal | patch proposal 生成 |
| AL2 | staging | review pool へ投入 |
| AL3 | guarded apply | typo rename / metadata 補完 / tag 付けだけ、backup 必須 |
| AL4 | apply + rollback | 当面禁止。validator と rollback 実績が溜まってから |
| AL5 | autonomous restructure | sandbox 実験だけ。正本 map では禁止 |

初期値は `AL2`。`AL3` は `QP18-QP21` 完了後に限定開放する。

## 7. 最初の 2 週間

| ID | 順序 | 作業 | 完了条件 |
|---|---:|---|---|
| WK1 | 1 | PH1 を実装 | LLM なし `ScopeQualityReport` が出る |
| WK2 | 2 | PH2 を実装 | template coverage が missingSlots を返す |
| WK3 | 3 | PH4 の schema / review artifact だけ作る | patch proposal を目視採否できる |
| WK4 | 4 | PJ04-local venv を整備 | LangGraph smoke が OK |
| WK5 | 5 | `T-A-1` / `T-B-1` と接続判断 | bridge MVP に進める |

この順番なら、LangGraph 環境が未整備でも価値が出る。逆に LangGraph bridge を先に作ると、評価器・patch・rollback が未成熟なまま自動実行層だけが強くなる。

## 8. GPT 会話歴の扱い

| ID | 方針 | 理由 |
|---|---|---|
| CH1 | GPT 会話歴は最初の訓練データにしない | 正解構造が曖昧で evaluator が育たない |
| CH2 | 会話歴は design-mining corpus として扱う | M3E 思想・設計判断・発想履歴の価値が高い |
| CH3 | 数学 / 仕様文書で round-trip evaluator を先に鍛える | 章立て・定義・命題・依存が評価しやすい |
| CH4 | evaluator が安定した後に GPT 会話歴へ適用する | 思想抽出を品質管理下に置ける |

## 9. 実装してはいけない順序

| ID | 禁止順序 | 理由 |
|---|---|---|
| NG1 | LangGraph bridge -> 自動 apply | rollback / audit が未完成だと危険 |
| NG2 | GPT 会話歴 batch -> Deep template 昇格 | 評価器がないと思想抽出の質が測れない |
| NG3 | LLM judge だけで quality score | きれいな説明に引きずられる |
| NG4 | structure merge / reparent を自動適用 | 人間の認知接続を切る |
| NG5 | Runtime trace を map attribute に永続化 | PJ04 の I-G5 違反 |

## 10. 検証コマンド

現状確認:

```powershell
cd C:\Users\Akaghef\dev\M3E\beta
npm run template:test
```

LangGraph 環境確認:

```powershell
cd C:\Users\Akaghef\dev\M3E
python projects\PJ04_MermaidSystemLangGraph\runtime\langgraph_sandbox\smoke_test.py
```

現在の default Python では LangGraph 未導入なので、`PH6` 前に PJ04-local venv を用意する。

将来の品質評価確認:

```powershell
cd C:\Users\Akaghef\dev\M3E\beta
npm run build:node
node dist/node/scope_quality_cli.js --fixture ../projects/PJ04_MermaidSystemLangGraph/specs/quality_fixtures/minimal_scope.json --out ../tmp/scope-quality-report.json
```

## 11. 完了条件

| ID | 条件 | 判定 |
|---|---|---|
| DN1 | 1 scope に対して Quality Report が出る | JSON + Markdown |
| DN2 | Report から PatchProposal が出る | apply 可能形式 |
| DN3 | Patch は dry-run validation できる | map 不変 |
| DN4 | 低リスク patch だけ backup 付きで apply できる | audit あり |
| DN5 | 同じ workflow が Template System Spec で表現できる | `template:build` pass |
| DN6 | LangGraph bridge 経由で同じ workflow が走る | `threadId` + trace |
| DN7 | Runtime Board で score / active node / patch count を見られる | map attribute 不変 |
| DN8 | accepted / rejected の履歴が次の evaluator に使える | run log replay |

## 12. 次の具体タスク

最短で価値が出る次 task は `QP1-QP5`。これは LangGraph 依存なしで始められ、既存 `template:test` の検証形に乗る。

次に着手すべき順:

1. `QP1-QP5`: `ScopeQualityReport` の非 LLM 実装
2. `QP6-QP9`: template coverage 実装
3. `QP14-QP17`: patch proposal review artifact
4. `QP22`: PJ04-local LangGraph venv 整備
5. `T-A-1` / `T-B-1`: GraphSpec freeze と Bridge MVP

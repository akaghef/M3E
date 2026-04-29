---
name: pj04-template-system
description: |
  PJ04 の MDD / LangGraph Template System Spec を扱う Claude 用スキル。
  以下の場面で使う:
  - PJ04 / MDD / Map Driven Development / LangGraph template / System Block Template に触るとき
  - PJv34 Weekly Review system を template から build / run / test するとき
  - `projects/PJ04_MermaidSystemLangGraph/templates/*.yaml` を作成・更新するとき
  - LangGraph 機能カバレッジ表を更新するとき
  - template-generated AppState / GraphSpec / trace を UI 担当に渡すとき
---

# PJ04 Template System

このスキルは、PJ04 の **Template System Spec -> AppState -> GraphSpec -> local run -> trace/artifact** の CLI ループを Claude が安全に使うための操作手順。

## Product Context

PJ04 の目的は M3E を **LangGraph 系システムの協働 authoring 環境** にすること。
M3E では system を直接コードで書かず、Map / Template System Spec から実行契約を作る。

標準ループ:

```text
System Block Template catalog
  -> Template System Spec (YAML/JSON)
  -> AppState
  -> GraphSpec
  -> local run
  -> trace / artifact
```

## Source Of Truth

| 目的 | ファイル |
|---|---|
| PJ04全体戦略 | `projects/PJ04_MermaidSystemLangGraph/docs/global_strategy.md` |
| Template仕様 | `projects/PJ04_MermaidSystemLangGraph/docs/system_block_templates.md` |
| LangGraph到達度 | `projects/PJ04_MermaidSystemLangGraph/docs/langgraph_feature_coverage.md` |
| PJv34 spec | `projects/PJ04_MermaidSystemLangGraph/templates/pjv34_weekly_review.yaml` |
| Template型 | `beta/src/shared/template_system_spec.ts` |
| Builder | `beta/src/node/template_system_builder.ts` |
| Build CLI | `beta/src/node/template_build_cli.ts` |
| Run CLI | `beta/src/node/template_run_cli.ts` |
| Tests | `beta/tests/unit/template_system_builder.test.js` |

## Current PJv34 Status

PJv34 Weekly Review はすでに Template System Spec としてテンプレ化済み。

実体:

```text
projects/PJ04_MermaidSystemLangGraph/templates/pjv34_weekly_review.yaml
```

上位 system:

```text
Load Context -> Generate Doc -> Write Output
```

`Generate Doc` subsystem 内部:

```text
Build Prompt
  -> Call Provider
  -> Evaluate Response
  -> pass: Return Draft
  -> api_error: Retry / Backoff -> retry: Call Provider / exhausted: Fallback / Qn
  -> bad_output: Fallback / Qn
```

## Commands

すべて repo root ではなく `beta/` で実行する。

### Build

YAML/JSON spec から AppState / GraphSpec / warnings / validation を出す。

```powershell
cd C:\Users\Akaghef\dev\M3E\beta
npm run template:build -- --spec projects/PJ04_MermaidSystemLangGraph/templates/pjv34_weekly_review.yaml --out tmp/pjv34-template-system-generic.json
```

成功条件:

- `Build issues: 0`
- `Warnings: 0`
- `Validation issues: 0`

### Run

spec を local runner で実行し、artifact markdown / trace json を出す。
API key がない場合は mock provider で走る。

```powershell
cd C:\Users\Akaghef\dev\M3E\beta
npm run template:run -- --spec projects/PJ04_MermaidSystemLangGraph/templates/pjv34_weekly_review.yaml --out tmp/pjv34-template-run-generic.md
```

成功時の trace:

```text
load_context -> build_prompt -> call_provider -> evaluate_response -> return_draft -> write_output
```

### Test

catalog/spec negative、build、mock run、provider failure -> retry -> fallback_qn、no-secret-output を確認する。

```powershell
cd C:\Users\Akaghef\dev\M3E\beta
npm run template:test
```

成功条件:

- `tests/unit/template_system_builder.test.js`
- `4 passed`

## DeepSeek

通常のスキル実行では DeepSeek key を要求しない。
`template:run` は key 無しなら mock provider を使う。

DeepSeek 実APIを使う場合だけ、親 shell に残さない方法を優先する。
既存の secret 方針は以下を参照:

```text
projects/PJ04_MermaidSystemLangGraph/docs/secrets_management.md
```

禁止:

- API key を repo / `.env` / docs / logs に書く
- browser JS から provider API を直叩きする
- 出力 artifact / trace に key を含める

## What Claude Should Do

### 新しい system をテンプレ化する場合

1. `system_block_templates.md` で使える template を確認する
2. `templates/*.yaml` に Template System Spec を書く
3. `npm run template:build` を通す
4. `npm run template:run` を mock provider で通す
5. 必要なら `npm run template:test` に regression を追加する
6. `langgraph_feature_coverage.md` と `tasks.yaml` を更新する
7. `docs/daily/YYMMDD.md` に作業ログを追記する

### PJv34 を確認する場合

1. `templates/pjv34_weekly_review.yaml` を読む
2. `npm run template:build -- --spec ...` を実行する
3. `npm run template:run -- --spec ...` を実行する
4. `tmp/pjv34-template-run-generic.md` と `.json` を確認する
5. `npm run template:test` を実行する

## Do Not Touch Yet

負債化しやすいので、明示指示がなければ触らない。

- Python LangGraph bridge
- checkpoint / thread / time travel
- streaming
- Send super-step semantics
- viewer UI / trace overlay
- Bitwarden / secret pipeline

これらは coverage 表では PENDING/PARTIAL のままにしてよい。

## Completion Criteria

このスキルを使った作業は、少なくとも以下を満たす。

- build/run/test のどれを実行したかを最終報告に書く
- `langgraph_feature_coverage.md` の状態が変わるなら更新する
- docs を更新したら `docs/daily/YYMMDD.md` に追記する
- API key や secret が差分・artifact・traceに混ざっていないことを確認する

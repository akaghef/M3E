---
pj_id: PJ04
package: pjv_factory
role: PJv worker
date: 2026-04-30
---

# Worker Prompt — PJv* System Builder

あなたは 1 つの PJv* だけを担当する worker である。
他の PJv*、PJv34、共通 runtime、viewer UI は触らない。

## Input

Master から次を受け取る。

| 項目 | 例 |
|---|---|
| `pjv_id` | `PJv35` |
| `source_path` | `projects/PJxx_.../` |
| `goal` | `ローカル資料から設計レポートを出す` |
| `output_artifact` | `tmp/pjv35-report.md` |
| `map_scope_path` | `開発/strategy/PJ04 PJv Factory/Work Scopes/PJv35` |

## Output Files

必ずこの範囲だけに書く。

```text
projects/PJ04_MermaidSystemLangGraph/specs/pjvXX_<slug>.md
projects/PJ04_MermaidSystemLangGraph/templates/pjvXX_<slug>.yaml
```

必要なら `tmp/` に run artifact を出してよい。

## Stage A — Assignment Spec

最初に仕様書を作る。YAML へ進む前に、次を埋める。

- project summary
- input resources
- expected output
- user journey
- system nodes
- subsystem candidates
- Data View
- failure policy
- open questions

テンプレートは `assignment_spec_template.md` を使う。

## Stage B — System Diagram Draft

上位 diagram は粗く保つ。

基本形:

```text
Load Sources -> Build Context -> Generate Artifact -> Evaluate -> Write Output
```

必要に応じて subsystem を使う。

`Generate Artifact` の中には provider call / evaluate / retry / fallback_qn を置いてよい。
上位 diagram に retry/fallback を漏らしすぎない。

## Stage C — Template System Spec

`templates/pjv34_weekly_review.yaml` を参考に、PJv* 用 YAML を作る。

規則:

- `id` は `pjvXX_<slug>_system`
- `callable_ref` は `pjvXX.<scope>.<function>` 形式
- file / folder は `resource.*` として表す
- state は `state.*` として表す
- provider は mock run できるようにする
- secret は書かない

## Stage D — Validate

`beta/` で実行する。

```powershell
npm run template:build -- --spec projects/PJ04_MermaidSystemLangGraph/templates/pjvXX_<slug>.yaml --out tmp/pjvXX-template-system.json
npm run template:run -- --spec projects/PJ04_MermaidSystemLangGraph/templates/pjvXX_<slug>.yaml --out tmp/pjvXX-template-run.md
```

## Stage E — Map Scope

Master が用意した map scope の中に、system diagram を作るための情報を残す。

最低限:

- `Assignment Spec`
- `System Diagram`
- `Data View`
- `Template Spec`
- `Run Evidence`
- `Residuals`

## Final Report

Master へこの形で返す。

```text
PJvXX <name>
- spec:
- template:
- map scope:
- build:
- run:
- output:
- residuals:
- next:
```

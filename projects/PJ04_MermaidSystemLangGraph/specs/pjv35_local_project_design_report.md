---
pj_id: PJ04
pjv_id: PJv35
slug: local_project_design_report
status: run_done
source_path: projects/
template_path: projects/PJ04_MermaidSystemLangGraph/templates/pjv35_local_project_design_report.yaml
map_scope: 開発/strategy/PJ04 PJv Factory/Work Scopes/PJv35 local_project_design_report
date: 2026-04-30
---

# PJv35 Local Project Design Report

## 1. Identity

| 項目 | 値 |
|---|---|
| PJv ID | PJv35 |
| slug | local_project_design_report |
| owner agent | Codex |
| source path | `projects/` |
| map scope path | `開発/strategy/PJ04 PJv Factory/Work Scopes/PJv35 local_project_design_report` |
| status | run_done |

## 2. Goal

ローカル `projects/` フォルダを読み、各 PJ の設計状態・未完タスク・次に見るべき PJ を日本語 Markdown レポートとして `tmp/` に出す。

## 3. Inputs

| input | kind | path / source | required | notes |
|---|---|---|---|---|
| projects folder | folder | `projects/` | yes | `PJ*` directory を対象にする |
| project README | file | `projects/PJ*/README.md` | no | タイトル抽出 |
| project tasks | file | `projects/PJ*/tasks.yaml` | no | pending task 抽出 |

## 4. Outputs

| output | kind | path / target | acceptance |
|---|---|---|---|
| design report | markdown | `tmp/pjv35-local-project-design-report.md` | PJごとの状況と次アクションがある |
| trace | json | `tmp/pjv35-local-project-design-report.json` | node id trace が残る |

## 5. User Journey

```text
START -> Load Projects -> Build Design Context -> Generate Design Report -> Evaluate Report -> Write Output -> END
```

## 6. System Nodes

| node id | label | template | reads | writes | done condition |
|---|---|---|---|---|---|
| load_projects | Load Projects | `io.load_local_folder` | `resource.projectsFolder` | `state.contextPackage` | PJ一覧が作られる |
| generate_design_report | Generate Design Report | `llm.generate_doc.subsystem` | `state.contextPackage`, `state.docGoal` | `state.draftDocument` | レポートdraftができる |
| write_output | Write Output | `io.write_artifact` | `state.draftDocument` | `resource.tmpDesignReport` | tmp markdown が書かれる |

## 7. Subsystems

| subsystem | parent node | internal nodes | reason |
|---|---|---|---|
| Generate Design Report subsystem | generate_design_report | build_prompt / call_provider / evaluate_response / retry_backoff / fallback_qn / return_draft | provider失敗とbad outputを上位diagramから隠す |

## 8. Data View

| resource/state | concrete entity | owner | lifecycle |
|---|---|---|---|
| `resource.projectsFolder` | `projects/` | local | read-only |
| `state.contextPackage` | discovered PJ summary JSON | runtime | transient |
| `state.draftDocument` | generated report markdown | runtime | transient |
| `resource.tmpDesignReport` | `tmp/pjv35-local-project-design-report.md` | local | generated |

## 9. Failure Policy

| failure | handling | map/Qn behavior |
|---|---|---|
| missing projects folder | fail fast | Qn |
| provider error | retry then fallback_qn | Qn |
| bad output | fallback_qn | Qn |

## 10. Template System Spec Plan

| field | value |
|---|---|
| yaml path | `projects/PJ04_MermaidSystemLangGraph/templates/pjv35_local_project_design_report.yaml` |
| root id | `pjv35_local_project_design_report_system` |
| entry | `load_projects` |
| graphSpecVersion | `0.1` |

## 11. Open Questions

| question | options | default if unanswered |
|---|---|---|
| レポート対象 PJ を全件にするか | all / PJ04のみ / activeのみ | all |
| run provider | mock / DeepSeek | mock |

## 12. Freeze Checklist

- [x] input / output が明確
- [x] 上位 diagram は 5 node 以下
- [x] subsystem 境界が明確
- [x] Data View が実体と対応している
- [x] failure policy がある
- [x] template catalog にある block だけで表現できる

## 13. Run Evidence

2026-04-30 に mock provider で `template:build` / `template:run` を実行。
成果物は `tmp/pjv35-local-project-design-report.md` と `.json`。

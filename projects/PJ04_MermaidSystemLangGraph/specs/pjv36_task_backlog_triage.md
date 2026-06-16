---
pj_id: PJ04
pjv_id: PJv36
title: Task Backlog Triage
date: 2026-04-30
status: template_built
---

# PJv36 — Task Backlog Triage

## Goal

`docs/06_Operations/Todo_Pool.md` と `projects/PJ04_MermaidSystemLangGraph/tasks.yaml` を読み、次に実装すべき候補を分類した triage report を `tmp/` に出す。

## Inputs

| input | kind | path / source | required | notes |
|---|---|---|---|---|
| Todo Pool | file | `docs/06_Operations/Todo_Pool.md` | yes | backlog / blocked の粗い候補 |
| PJ04 tasks | file | `projects/PJ04_MermaidSystemLangGraph/tasks.yaml` | yes | PJ04 の current queue |

## Outputs

| output | kind | path / target | acceptance |
|---|---|---|---|
| triage report | markdown | `tmp/pjv36-task-backlog-triage.md` | next action / blocked / defer が分かれる |

## User Journey

```text
Load Backlog -> Generate Triage -> Write Output
```

## System Nodes

| node id | label | template | reads | writes | done condition |
|---|---|---|---|---|---|
| load_backlog | Load Backlog | `io.load_local_folder` | `resource.todoPool` | `state.contextPackage` | Todo / tasks を読める |
| generate_triage | Generate Triage | `llm.generate_doc.subsystem` | `state.contextPackage`, `state.docGoal` | `state.draftDocument` | triage draft ができる |
| write_output | Write Output | `io.write_artifact` | `state.draftDocument` | `resource.tmpTriageReport` | tmp に出力される |

## Failure Policy

| failure | handling | map/Qn behavior |
|---|---|---|
| missing input | fallback_qn | Qn |
| provider error | retry then fallback_qn | Qn |
| bad output | fallback_qn | Qn |


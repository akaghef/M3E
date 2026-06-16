---
pj_id: PJ04
pjv_id: PJv37
title: Code Change Weekly Digest
date: 2026-04-30
status: template_built
---

# PJv37 — Code Change Weekly Digest

## Goal

直近の commit / daily log を読み、週次開発ダイジェストを `tmp/` に出す。

## Inputs

| input | kind | path / source | required | notes |
|---|---|---|---|---|
| git log | command/text | `git log` | yes | 直近変更の要約 |
| daily notes | folder | `docs/daily/` | yes | 人間向け作業文脈 |

## Outputs

| output | kind | path / target | acceptance |
|---|---|---|---|
| weekly digest | markdown | `tmp/pjv37-code-change-weekly-digest.md` | main changes / risks / next が分かる |

## User Journey

```text
Load Change Sources -> Generate Digest -> Write Output
```

## System Nodes

| node id | label | template | reads | writes | done condition |
|---|---|---|---|---|---|
| load_changes | Load Changes | `io.load_local_folder` | `resource.gitAndDaily` | `state.contextPackage` | commit / daily の context ができる |
| generate_digest | Generate Digest | `llm.generate_doc.subsystem` | `state.contextPackage`, `state.docGoal` | `state.draftDocument` | digest draft ができる |
| write_output | Write Output | `io.write_artifact` | `state.draftDocument` | `resource.tmpWeeklyDigest` | tmp に出力される |

## Failure Policy

| failure | handling | map/Qn behavior |
|---|---|---|
| missing input | fallback_qn | Qn |
| provider error | retry then fallback_qn | Qn |
| bad output | fallback_qn | Qn |


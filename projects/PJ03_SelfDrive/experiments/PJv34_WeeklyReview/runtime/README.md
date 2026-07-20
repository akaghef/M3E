# PJv34 Runtime

PJv34 は 4-view runtime を使う。

## Progress Board

目的: phase、task、blocker、next gate を見る。

初期 scope:

```text
PJv34 WeeklyReview
└── Progress Board
    ├── Phase 0 Local Projects Loop
    ├── Phase 1 LangGraph-shaped Orchestration
    ├── Phase 2 DeepSeek Secure Smoke
    └── Phase 3 M3E Runtime Integration
```

## Evaluation Board

目的: local loop E2E、broken file handling、tmp artifact output、後続のDeepSeek smoke の検証結果を見る。

初期 scope:

```text
Evaluation Board
├── Check: projects input only
├── Check: tmp output generated
├── Check: no network and no secret
├── Check: failure returns Result
└── Check: report is reviewable
```

## Review

目的: 人間判断が必要な論点を Qn として batch review する。

初期 scope:

```text
Review
├── Qn1 Input boundary
├── Qn2 Project status source
├── Qn3 tmp output policy
└── Qn4 LangGraph adoption timing
```

## Active Workspace

目的: 実装・設計の現物へ drill-down する。

初期 scope:

```text
Active Workspace
├── Boundary: projects/ input only
├── Interface: ProjectsScanner
├── Interface: ProjectSummaryExtractor
├── Interface: WeeklyReportBuilder
├── Interface: TmpArtifactWriter
├── Future: LLMClient
└── Future: DeepSeek
```

## Traceability

- task は Progress Board に置く。
- task の根拠は Active Workspace へ alias で示す。
- task の検証結果は Evaluation Board へ alias で示す。
- 判断が必要なものは Review の Qn へ alias で示す。

scope をまたぐ link は張らず、alias で参照する。

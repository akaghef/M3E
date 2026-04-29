# PJv34 Runtime

PJv34 は 4-view runtime を使う。

## Progress Board

目的: phase、task、blocker、next gate を見る。

初期 scope:

```text
PJv34 WeeklyReview
└── Progress Board
    ├── Phase 0 Mock Loop
    ├── Phase 1 DeepSeek Secure Smoke
    └── Phase 2 M3E Runtime Integration
```

## Evaluation Board

目的: mock E2E、secret leak check、DeepSeek smoke の検証結果を見る。

初期 scope:

```text
Evaluation Board
├── Check: mock provider no network
├── Check: no key in logs
├── Check: failure returns Result
└── Check: trace metadata complete
```

## Review

目的: 人間判断が必要な論点を Qn として batch review する。

初期 scope:

```text
Review
├── Qn1 Secret boundary
├── Qn2 Weekly review input range
└── Qn3 Proposal storage
```

## Active Workspace

目的: 実装・設計の現物へ drill-down する。

初期 scope:

```text
Active Workspace
├── Boundary: Node module first
├── Interface: LLMClient
├── Interface: SecretProvider
├── Interface: TraceLogger
├── Provider: Mock
└── Provider: DeepSeek
```

## Traceability

- task は Progress Board に置く。
- task の根拠は Active Workspace へ alias で示す。
- task の検証結果は Evaluation Board へ alias で示す。
- 判断が必要なものは Review の Qn へ alias で示す。

scope をまたぐ link は張らず、alias で参照する。

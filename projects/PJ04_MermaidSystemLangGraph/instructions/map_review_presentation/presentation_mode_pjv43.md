---
pj_id: PJ04
pjv_id: PJv43
title: Slideshow Mode / Map Review Tour
date: 2026-04-30
status: draft
---

# PJv43 — Slideshow Mode / Map Review Tour

PJv43 は `backlog/pj-vision-100.md` の #43 **Slideshow Mode — マップ通しで読む** を、PJ04 の確認作業に適用する PJv である。

## Immediate Goal

akaghef が全 map と PJ04 PJv Factory の各 work scope を、順番に見て verdict を返せる作業環境を作る。

## System Goal

将来的には viewer 上で `Presentation Mode` を実装し、review manifest / tour steps を使って次のように巡回できるようにする。

```text
Open Review Manifest
  -> Select Next Review Target
  -> Open Map / Scope
  -> Focus Step
  -> Capture Verdict
  -> Advance
```

## MVP Without UI Implementation

今は次で代替する。

- `review_manifest.yaml`: review queue
- M3E map `開発/strategy/PJ04 Presentation Review`: human-facing review board
- viewer URL: `http://localhost:4173/viewer.html?map=<mapId>`
- verdict は map node と daily に残す

## Later UI MVP

`idea/30_ux/slideshow/05_mvp_path.md` の Phase 1 を採用する。

| item | decision |
|---|---|
| step | 1 node |
| tour storage | `state.tour.steps[]` |
| control | bottom overlay |
| keys | Left / Right / Esc |
| narration | node details |
| camera | center/focus first, pan later |

## Acceptance

- review manifest から全 map の URL を開ける
- PJ04 PJv Factory scopes を順番に確認できる
- verdict を `pass / revise / blocked / discard` で残せる
- UI 実装前でも次セッションの確認作業が止まらない

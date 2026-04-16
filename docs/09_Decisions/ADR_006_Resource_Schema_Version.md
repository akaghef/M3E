# ADR 006: Resource 追加時の Schema Version 方針

## Status

Open (議論中)

## Date

2026-04-08

## Context

Resource 概念の導入 (Resource_Design.md) により、AppState に `resources` フィールドとノードに `allocations` フィールドを追加する必要がある。

現在の schema version は `1`。新しいフィールドを追加する際に version を `2` に上げるか、`1` のまま optional フィールドとして追加するかを決める必要がある。

### 関連する永続化方式の選択

| 方式 | 概要 | version への影響 |
|------|------|-----------------|
| A: AppState 直接拡張 | `AppState.resources` + `Node.allocations` を追加 | v2 が自然 |
| B: attributes 経由 | `attributes["resource:__definitions"]` に JSON | v1 のまま可能 |

どちらでもアプリケーション層の API は同一。方式 B から A への移行は後から可能。

## Options

### Option 1: version 2 に上げる (方式 A と同時)

- 明確な breaking change の境界
- `fromJSON` で version 分岐して migration 処理を書ける
- links (GraphLink) 追加時に version を上げなかった前例とは異なる

### Option 2: version 1 のまま optional で進める (方式 A)

- `links` と同じパターン。後方互換を保つ
- `resources` が undefined なら空として扱う
- version bump の migration 処理が不要

### Option 3: attributes 暫定 (方式 B) で MVP → 後で方式 A に移行

- schema 変更なしで最速リリース
- attributes の汚染と serialize/deserialize 層のコストが発生
- 移行時に結局 version 判断が必要になる

## Decision

TBD — manager 判断待ち

## Consequences

(決定後に記載)

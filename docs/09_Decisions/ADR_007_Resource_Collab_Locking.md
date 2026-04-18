# ADR 007: Collab 環境での Resource 定義の排他制御

## Status

Open (議論中)

## Date

2026-04-08

## Context

Resource は SSOT パターンで設計されており、定義はドキュメントに 1 箇所 (`AppState.resources`) のみ存在する。

Team Collaboration (collab) 環境では複数ユーザーが同時にマップを編集する。既存の排他制御は **scope lock** (スコープ単位のロック) で実現しているが、Resource 定義はスコープに属さないドキュメントレベルのデータである。

### 問題

- ユーザー A が Resource の `totalCapacity` を変更中に、ユーザー B が同じ Resource を削除した場合の競合
- Resource 定義の変更は全ノードの allocation に影響するため、影響範囲が scope を超える
- scope lock だけでは Resource 定義の同時編集を防げない

## Options

### Option 1: Document-level lock を新設

- Resource 定義の編集中はドキュメント全体をロック
- 最も安全だが、ロック粒度が粗く他ユーザーの作業をブロックする

### Option 2: Resource 単位の lock を新設

- 個別の Resource ID に対するロック
- scope lock と並列で動作する新しいロック種別
- 粒度は細かいが、実装コストが高い

### Option 3: Last-write-wins + 通知

- ロックなし。競合時は後の書き込みが勝つ
- 他ユーザーが Resource を変更した際に SSE で通知
- シンプルだが、意図しない上書きのリスクあり

### Option 4: MVP では single-user 前提、Collab 対応は後回し

- Resource 機能の MVP は個人利用を前提とする
- Collab Phase 2 以降で排他制御を設計
- 最速リリース。ただし Collab 有効時に Resource 編集で不整合が起きうる

## Decision

TBD — manager 判断待ち

## Consequences

(決定後に記載)

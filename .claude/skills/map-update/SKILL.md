---
name: map-update
description: M3E マップの strategy board のタスクステータスや Agent Status を一括更新するスキル。以下の場面でトリガーする：「マップ更新」「ステータス更新」「Agent Status 更新」「進捗反映」「マップに反映」「strategy 更新」と言われたとき、またはタスク完了後にマップへの反映が必要なとき。
---

# map-update — Strategy Board & Agent Status 一括更新

M3E マップの開発進捗を反映する Manager 用スキル。
構造判断は Map Manager、実行経路は `m3e-map` skill / `/api/maps` に寄せる。

## Target

```text
M:(開発)> SYSTEM > DEV
```

主な更新先:

- `M:(開発)> SYSTEM > DEV >> strategy`
- `M:(開発)> SYSTEM > DEV >> Agent Status`
- `M:(開発)> SYSTEM > DEV >> scratch`

`/` は legacy/API compatibility only。user-facing path は `M:(map label)> A > B >> C` を使う。

## API

- Base URL: `http://localhost:4173`（beta 開発サーバー）
- Map discovery: `GET /api/maps` で `label="開発"` の `mapId` を取得
- Read map: `GET /api/maps/{mapId}`
- Save map: `POST /api/maps/{mapId}`

final は `38482`。通常の開発 state 更新には使わない。

## Map Manager gates

次を含む場合は、更新前に `docs/protocols/map-manager/` を確認する。

- scope / scopen / unscopen
- alias vs move vs GraphLink
- cross-facet relation
- layouting / display intent
- MF / WMF / Mermaid / Markdown からの writeback
- target path ambiguity

## 実行フロー

1. `GET /api/maps` で `開発` map を discovery。
2. 対象 path / scope を canonical display path で解決。
3. 更新が trivial status update か、Map Manager gate 対象かを分類。
4. `GET /api/maps/{mapId}` で read。
5. in-memory で最小変更。
6. tree invariant / relation endpoint / display intent を確認。
7. `POST /api/maps/{mapId}` で save。
8. re-read して更新箇所を報告。

## 進捗の表現ルール

| 状態 | マップ上の表現 |
|---|---|
| 完了 | ノード削除ではなく、まず `status: done` と完了メモを付ける。削除は明示指示時のみ |
| 未着手 | `status: ready` |
| 途中 | `status: doing` と進捗メモ |
| ブロック | `status: blocked` と blocker メモ |

Agent Status は以下の形式に統一する。

```text
[{role}: {status} ; {current task}]-[next: {next task}]
```

## Report

```text
マップ更新完了:
- target: M:(開発)> SYSTEM > DEV >> ...
- changed: ...
- verified: ...
- unresolved: ...
```

## 注意

- worker は direct API / SQLite / runtime file write をしない。必要なら Map Manager handoff を返す。
- Manager がこの skill で更新する場合も、曖昧な構造判断は Map Manager gate を通す。
- サーバー停止時は、マップ更新を未実行として明記する。

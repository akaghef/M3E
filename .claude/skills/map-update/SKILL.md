---
name: map-update
description: M3E のstrategy boardやAgent Statusへの進捗反映を依頼されたとき、既存の状態表現に従ってMCPで更新する。一般のMap操作はこのSkillを必要としない。
---

# map-update — Strategy Board & Agent Status 一括更新

M3E マップの開発進捗を反映する Manager 用スキル。
未決の構造判断はMap Manager規約、実行は `docs/protocols/mcp-map-operations.md` の
六つのMCP Toolsを利用する。指定済みの対象・操作はMCPへ直接渡せる。

## DP Router

- DP0: 更新対象と状態表現を確認する。
- DP1: 初回はMCP接続と対象の解決を確認する。
- DP2: 保持済みContextと変更結果を利用して必要な項目を更新する。

## Target

```text
M:(開発)> SYSTEM > DEV
```

主な更新先:

- `M:(開発)> SYSTEM > DEV >> strategy`
- `M:(開発)> SYSTEM > DEV >> Agent Status`
- `M:(開発)> SYSTEM > DEV >> scratch`

`/` は legacy/API compatibility only。user-facing path は `M:(map label)> A > B >> C` を使う。

## MCP

- 既存Betaへ接続したMCPで `m3e_get` を使い、「開発」Mapと対象pathを特定する。
- `m3e_context` で参加し、以後は返されたContextとResource URIを利用する。
- 指定済み項目は `m3e_update`、必要な新規項目は `m3e_create` で変更する。
- `m3e_delete` は削除を明示された場合だけ使う。改善記録は `m3e_feedback` へ送る。

Finalは通常の開発state更新には使わない。

## Map Manager gates

次の判断が未決の場合は、更新前に `docs/protocols/map-manager/` を確認する。

- scope / scopen / unscopen
- alias vs move vs GraphLink
- cross-facet relation
- layouting / display intent
- MF / WMF / Mermaid / Markdown からの writeback
- target path ambiguity

## 実行フロー

1. 対象Map / path / scopeを特定する。曖昧な名前を推測で選ばない。
2. 参加済みContextを利用するか、`m3e_context` で参加する。
3. 未決の構造判断があればMap Manager規約で解決する。
4. MCPへ必要な意味操作だけを渡し、Coreの保存結果で変更内容を確認する。
5. 保持済みContextと変更通知で継続する。情報不足・失効時だけ必要な状態を取得する。

全状態編集、一時書込スクリプト、AgentによるNode ID生成、自動再着色は行わない。
成功後の再GETは必須にしない。表示の受入が依頼に含まれる場合は実画面を別途確認する。

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

- workerはdirect REST API / SQLite / runtime file writeをせず、許可された対象へのMCP操作を使う。
- 担当外の曖昧な構造判断はMap Manager規約に従って返す。
- MCP未接続・操作非対応なら更新を未実行として明記し、RESTへ切り替えない。

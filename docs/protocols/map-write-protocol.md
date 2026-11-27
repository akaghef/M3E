# Map Write Protocol

## Purpose

Define how AI writes M3E maps without corrupting structure or confusing semantic structure with display decisions.

## Required sequence

Use the [MCP map operation contract](mcp-map-operations.md) when the M3E MCP
server is available. Resolve the target and enter its Context once. Reuse that
Context for subsequent operations; retrieve additional state only when it is
missing or invalidated. The Core validates and atomically commits each semantic
operation. A successful Tool Result is the normal persistence evidence.

Before a write, distinguish specified CRUD from unresolved structural judgment.
For the latter, apply the Map Manager decision order using the canonical
Resources / Prompts. Do not make ordinary CRUD depend on a separate skill or
Agent. If the required MCP capability is unavailable, report that capability;
do not silently generate a full-state REST replacement script.

## Invariants

- root exists and has `parentId: null`
- every child has matching `parentId`
- no orphan nodes
- no cycles
- alias has no children
- alias target is not another alias
- relation edge endpoints exist and are non-alias unless explicitly revised by product spec

## Display-governed writes

If the user cares about reviewability, layout, color, grouping, scope, or worker handoff, do not treat the write as plain CRUD.

Decide before mutation:

- facet
- display intent
- anchoring
- color semantics
- scoped vs unscoped result

## Coloring

Preserve existing colors unless the requested operation explicitly changes
them. Structural edits do not trigger map-wide recoloring. In particular,
preserve importance / urgency / confidence semantics on review maps.

## Verification

The Core owns tree and reference validation. Use authoritative operation results
and change events for normal completion. Retrieve again when context is stale,
notifications were lost, or a specific verification needs data absent from the
result. Visual acceptance still requires observing the real rendered view.

Report:

- target map/path
- nodes/links changed
- whether scope/layout/display intent was preserved
- what was verified
- any unresolved ambiguity


## viewer の record 差分受信

store を使う server は、既存の map watch に以下の wire を追加する。記載する ID は API の値であり、画面に表示する名前ではない。

### 通知

`GET /api/maps/:mapId/watch` は SSE を返す。接続・再接続時の `event: map_watch_ready` は `{mapId, revision, seq, fullReadRequired: true}`。受信を開始してから baseline を取得する。既に baseline がある場合はその revision から差分取得してもよい。SSE の `Last-Event-ID` による再送は行わない。

変更時の `event: map_updated` の JSON は以下。

```typescript
{
  mapId: string,
  savedAt: string,
  sourceTabId: string | null,
  synchronized?: true,
  previousRevision: string,
  revision: string,
  seq: number,
  recordKeys: string[]
}
```

`recordKeys` は確定した journal の変更前後から得た canonical record key の集合。削除した key も含む。通知は record 本文を読まない。通常の保存・MCP 書込み・remote の sync push・local の rebase に共通する。書き込めなかった変更、拒否、同一 Command の再送は新しい変更通知を出さない。短時間に続いた変更の通知はまとめられるため、通知の key だけを無条件に適用せず、保持する revision から差分を取得する。

`revision` は比較・保管だけを行う opaque string。既存の map の CAS 用 revision、record の `rev`、remote の `confirmedSeq` とは別である。`previousRevision` と手元の revision が異なる場合は、通知を取りこぼした可能性がある。`seq` は通知対象 store の journal の通し番号で、別 map の確定により飛ぶことがある。数値の連続性を gap 判定に使わない。

### baseline と差分取得

`GET /api/maps/:mapId/records` は `200` と次を返す。

```typescript
{
  mapId: string, revision: string, seq: number,
  full: true, deleted: false,
  header: SnapshotHeader,
  records: Array<{rk: string, record: SnapshotRecord}>
}
```

baseline には対象 map の canonical records、idMap、共有 extensionDef、decay を含める。workspace 全体の commit や別 map は含めない。viewer の AppState JSON ではない。既存の record model と idMap を使って描画側の索引を構成する。canonical ID と viewer が持つ旧 ID を直接混ぜない。存在しない map の baseline は `404 NOT_FOUND`。

`GET /api/maps/:mapId/records?since=<URL encoded revision>` は、その revision 以降に変わった key ごとに**取得時点の最新 record**を一度ずつ返す。

```typescript
{
  mapId: string, previousRevision: string, revision: string, seq: number,
  full: false, deleted: boolean,
  records: Array<{rk: string, record: SnapshotRecord | null}>
}
```

`null` は削除。map の rename で別 map に移った record も旧 map に対しては `null`。`deleted: true` は map 自体の削除・rename を示す。変更がなければ `records: []`。HTTP 応答の `seq` は読取り時点の store の通し番号であり、同じ応答の revision と records は一貫した状態を表す。複数の確定をまとめて適用し、応答の revision を次の基点にする。並行した取得の古い応答で新しい状態を上書きしない。

server は map ごとに変更 key の延べ件数 4,096 までの連続した履歴を保持する。履歴脱落、未知の revision、store 再起動・置換による世代違いは、record を読む前に `409 {code: "FULL_READ_REQUIRED", fullReadRequired: true, mapId, revision, seq}`。そのときは `since` なしで baseline を読み直す。履歴を越える大きな変更の通知も `fullReadRequired: true` となり、`previousRevision` と `recordKeys` を省くことがある。通知の取りこぼしが保持範囲内なら `since` で回復できる。

SQLite を使う server の `/records` は `409 {code: "FULL_READ_REQUIRED", fullReadRequired: true, reason: "record-store-unavailable"}`。この場合と既存 client は従来の `GET /api/maps/:mapId` を使用する。既存の全体読込み口は維持する。

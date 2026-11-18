# portable snapshot の形式と、現行データからの変換規則

2026-11-17。状態: 担当の決め打ち、未承認。[post-migration-spec.md](./post-migration-spec.md) のレコードを、ファイルにどう書くかと、現行の保存データからどう作るかを定める。変換の実装と、合否を判定する検査は、本書だけを共有して別々に書く。

## 1. ファイル

- workspace 一つにつき、UTF-8 の JSON Lines を一つ。1 行が 1 レコード。
- 各行は `kind` を持つ。行の順序に意味は無い。書き出すときは、`kind`、次に key の文字列順で並べる（差分を安定させるため）。
- 1 行目は `{"kind":"snapshot","format":1,"workspaceId":"…","seq":0}`。
- 値が無い欄は書かない。`null` は書かない。

## 2. レコード

`rev` は、表に `rev` とあるレコードで整数。移行直後は 0。`commit`・`idMap`・`nodeView`・1 行目は `rev` を持たない。

| kind | key | 欄 |
|---|---|---|
| `map` | `id` | `rootNodeId`、`tags`?、`archived`?、`pinned`?、`source`?、`legacyVersion`?、`legacySavedAt`?、`linearTextFontScale`?、`linearPanelWidth`?、`extra`?、`rev` |
| `node` | `id` | `mapId`、`nodeType`?（`text` は書かない）、`text`、`collapsed`?（false は書かない）、`attributes`?、`alias`?、`extra`?、`rev` |
| `details` | `nodeId` | `mapId`、`v`（形の版。1）、`body`?、`note`?、`link`?、`rev` |
| `connection` | `id` | `mapId`、`type`（`edge` は parent edge、`graphlink` は relation edge）、`source`、`target`、`relationType`?、`label`?、`attributes`?、`rev`。parent edge は `ord` と `scopeId`。relation edge は `direction`?、`style`?、`color`?、`sourcePort`?、`targetPort`? |
| `scope` | `id` | `mapId`、`rootNodeId`、`primarySurfaceId`?、`rev` |
| `linearText` | `scopeId` または `mapId`＋`orphanKey` | `mapId`、`text`、`anchorNodeId`?、`rev` |
| `surface` | `id` | `mapId`、`scopeId`、`surfaceKind`、`layout`、`surfaceView`?、`rev` |
| `nodeView` | `surfaceId`＋`nodeId` | `mapId`、`x`?、`y`?、`flowCol`?、`flowRow`?、`shape`? |
| `annotation` | `id` | `mapId`、`scopeId`?、`annotationKind`（現行の `kind`。レコードの `kind` と衝突するため名前を変える）、ほか現行の欄をそのまま（`opacity`、`createdAt`、`text`、`fontSize`、`fontWeight`、`variant` を含む）、`extra`?、`rev` |
| `relationTypeDef` | `name` | `label`?、`description`?、`reads`（`source-to-target` / `target-to-source`）、`rev` |
| `prefix` | `prefix` | `uri`、`rev` |
| `account` | `id` | `accountKind`（`ai-agent` / `human` / `system`）、`displayName`、`externalIds`?、`roles`?、`rev` |
| `commit` | `seq` | `committedAt`、`issuer`（account の `id`）、`sessionId`? |
| `idMap` | `recordKind`＋`mapId`＋`oldId` | `newId`（ID を振り直したものだけ） |

- `alias` は `{ "target": nodeId, "label"?: string, "access"?: "read"|"write", "snapshotLabel"?: string, "broken"?: true }`。
- `attributes` は key と値の組。値は文字列・数値・真偽・配列・入れ子のいずれか。空の組は書かない。
- `extra` は、型定義に無い欄をそのまま入れる組。空なら書かない。
- `nodeView` は `rev` を持たない。属する surface の `rev` に従う。
- parent edge の `source` と `target` は node に限る。relation edge の端点は node か edge のレコード（`connection`）である。
- attribute の key は、現行の文字列を一字も変えない（接頭辞の無い key もそのまま）。

## 3. 現行データからの変換

入力は、workspace の SQLite の `maps` の各行（`id`、`state_json`、`tags`、`archived`、`pinned`、`source`）。`state_json` は `AppState`（`beta/src/shared/types.ts`）である。

### 3.1 ID

- 対象は node、relation edge、annotation の ID。map を `id` の文字列順に処理し、各 map の中では node、relation edge、annotation の順、同じ種別の中では現行の ID の文字列順に見る。
- 次のどれかに当たる ID だけ振り直す。(a) それより前に処理したレコード（種別を問わない。同じ workspace の全 map）が既に同じ ID を使っている。(b) 64 文字を超える。(c) `[A-Za-z0-9_.:-]` 以外の文字を含む。当たらないものは元の ID を保ち、「使用済み」に加える。
- 振り直した ID、parent edge の `connectionId`、`scopeId`、`surfaceId` は新しく作る。作り方は決定的にする: 接頭辞 ＋ `sha256("<workspaceId>|<mapId>|<recordKind>|<種>")` の 16 進の先頭 24 桁。
  - node: 接頭辞 `n_`、recordKind `node`、種は現行の ID。
  - relation edge: 接頭辞 `c_`、recordKind `graphlink`、種は現行の ID。
  - annotation: 接頭辞 `a_`、recordKind `annotation`、種は現行の ID。
  - parent edge: 接頭辞 `c_`、recordKind `edge`、種は子の node の（振り直し後の）ID。
  - scope: 接頭辞 `s_`、recordKind `scope`、種は root の node の（振り直し後の）ID。
  - surface: 接頭辞 `v_`、recordKind `surface`、種は現行の surface の ID。
- 同じ入力からは、何度変換しても同じ ID になる。
- 振り直した node・relation edge・annotation と、全ての surface は `idMap` に記録する（`recordKind` は `node` / `graphlink` / `annotation` / `surface`）。参照（`parentId`、`children`、`targetNodeId`、relation edge の端点、`nodeViews` の key、`linearNotesByScope` の key、`primarySurfaceId`、annotation の `scopeId`）は新しい ID に書き換える。

### 3.2 node と details

| 現行の欄 | 行き先 |
|---|---|
| `id`、`text` | `node` |
| `collapsed` | `node.collapsed`（true のときだけ） |
| `nodeType` | `folder` と `leaf` と欄なしは `text`（書かない）。`alias`・`image` はそのまま。それ以外の値もそのまま |
| `details` | `details.body`（空文字は書かない） |
| `note`、`link` | `details.note`、`details.link`（空文字は書かない） |
| `attributes` | `node.attributes`。値が null の key は落とす。空文字は残す。`m3e:edge-label` は落として、その node へ入る parent edge の `label` にする（空文字なら label を書かない） |
| `targetNodeId`、`aliasLabel`、`access`、`targetSnapshotLabel`、`isBroken` | `node.alias` の `target`、`label`、`access`、`snapshotLabel`、`broken`（`isBroken` は true のときだけ） |
| `parentId`、`children` | parent edge のレコード（`connection`、3.3） |
| `scopeId`、`aliasOf` | 捨てる |
| 上のどれでもない欄（`type`、`notes`、`createdAt`、`updatedAt` など） | `node.extra` にそのまま |

- `details` のレコードは、`body`・`note`・`link` のどれかがあるときだけ作る。

### 3.3 connection

- parent edge: `parentId` を持つ node ごとに一つ。`source` は親、`target` は子。
  - `scopeId`: parent edge が載る scope（record-schema DA59）。親から祖先へたどり、最初に出会う map の root または `folder` の node の scope。今の画面の見え方（scope の root の子は全部その scope の中）と一致する。
  - `ord`: 同じ親の `children` の並び順に、文字列として厳密に増加するキー。使う文字は `0-9a-z`。末尾が `0` のキーは作らない。同じ親の下でキーは重複しない。
  - 親の `children` に載っていない子（`parentId` はあるが配列に無い）は、配列の後ろに、ID の文字列順で並べる。`children` にあるが実在しない ID は捨てる。
- relation edge: `links` の各要素。`sourceNodeId` → `source`、`targetNodeId` → `target`。`sourcePort`・`targetPort` が `auto` なら書かない。ほかの欄はそのまま。型定義に無い欄は `attributes` ではなく `extra` に入れる。

### 3.4 scope、linear-text、surface、annotation

- scope: map の root の node と、`nodeType` が `folder` の node ごとに一つ。`primarySurfaceId` は、現行の `scopes["scope:<nodeId>"]` にあれば、その surface の新しい ID。`label`、`rootNodeIds`、`relationIds` は捨てる。
- 現行の `scopes` のうち、root の node が実在しないもの、root が上の規則で scope にならないものは捨てる。その surface と `nodeViews` も捨てる。
- linear-text: `linearNotesByScope` の各要素。key が scope の root の node の ID（または `scope:<nodeId>`）なら、その scope の `scopeId`。そうでなければ `orphanKey` に元の key を一字も変えずに入れて残す。その key（`scope:` を除いたもの）が scope の root でない実在の node を指す場合は、`anchorNodeId` にその node の（振り直し後の）ID も入れる。値が空文字のものは書かない。
- surface: `surfaces` の各要素。`scopeId` は新しい scope の ID。`kind` → `surfaceKind`。`nodeViews` は、値が一つでもある要素だけを `nodeView` にする。実在しない node の要素は捨てる。
- annotation: 現行の欄をそのまま。`scopeId` は新しい scope の ID に書き換える（解決しなければ欄を落とし、元の値を `extra.scopeId` に残す）。
- map: `rootNodeId`、行の `tags`・`archived`・`pinned`・`source`（値は行の値をそのまま。文字列なら文字列のまま）、行の `version` → `legacyVersion`、`saved_at` → `legacySavedAt`、`linearTextFontScale`、`linearPanelWidth`。`state_json` の top-level のうち `selectedId`・`scopeId`・`savedAt` は捨て、それ以外の未知の欄は `map.extra` に入れる。

### 3.5 最初から入れるレコード

- `relationTypeDef`: `consist-of`（`source-to-target`）、`detail`（`source-to-target`）、`rdfs:subClassOf`（`target-to-source`）、`rdf:type`（`target-to-source`）。
- `prefix`: `rdf` → `http://www.w3.org/1999/02/22-rdf-syntax-ns#`、`rdfs` → `http://www.w3.org/2000/01/rdf-schema#`。
- `account`: `{"id":"acct_migration","accountKind":"system","displayName":"移行"}`。
- `commit`: `{"seq":0,"committedAt":"<変換の時刻>","issuer":"acct_migration"}`。

## 4. 逆変換

snapshot から、現行の `AppState` の形を作り直せること。次の差だけを許す。

- 3 節で「捨てる」「落とす」と書いたもの。
- `nodeType` の `folder`: scope の root（map の root を除く）は `folder` に戻す。`leaf` は `text` になる。
- 欄なしと既定値の違い（`collapsed: false`、空文字の `details`・`note`・`link`、空の `attributes`）は、現行の既定値で埋める。
- 振り直した ID。
- `scopes` は、scope のレコードから `id: "scope:<rootNodeId>"`、`label`（root の node の `text`）、`rootNodeIds`、`relationIds: []`、`primarySurfaceId` を作る。現行に scope のレコードが無かった folder にも作られる。
- surface の ID は新しい ID のまま（旧 ID には戻さない）。

## 5. 合否

変換の実装とは別に書いた検査（`scripts/migration/judge_snapshot.py`）が、現行の SQLite と snapshot を読んで、3 節の規則を一つずつ独立に確かめる。問題が 0 件であることを合格とする。検査の基準は担当が持ち、実装の都合では変えない。

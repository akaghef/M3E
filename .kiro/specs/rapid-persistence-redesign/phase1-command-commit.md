# 第 1 段: Command の確定経路（保存形式は変えない）

2026-11-16。brief の決定「書込み経路の Command 化を先に、現在の保存形式のまま出す」の最初の出荷単位。状態: 設計。受入基準は本書の「受入」で固定し、実装者は変更しない。

用語は [Glossary](../../../docs/00_Home/Glossary.md) に従う。Command、journal、portable snapshot、canonical owner、map、scope、node、parent edge、relation edge、linear-text、Surface View は定義済みの語。レコード種別は [draft-record-model.md](./draft-record-model.md) 2 節の表に従う。

## 目的

- 画面の保存と MCP の更新が、同じ一つの確定関数を通る。
- 1 回の保存で運ぶ量と検査の単位が、map 全体ではなく変更したレコードになる。
- 確定した Command が、再生できる形で順に残る（journal の種）。
- 利用者から見える動作は変えない。

## 範囲

入れる: 確定関数、Command を受ける HTTP 経路、画面の保存（`saveDocToLocalDb`）、MCP の `mutate`。

入れない: 保存形式の変更（`maps.state_json` はそのまま）、Neo4j、兄弟順キー、ID の振り直し、他の書込み経路（brief の書込み経路表の残り）、Undo の Command 化、端末間の配送、Final。map 全体を送る既存の経路 `POST /api/maps/:id` は残す。

## Command の形

Command_Language 4.2 の envelope に、draft-record-model 5 節の「変更の一覧」を足す。

| 項目 | 内容 |
|---|---|
| `commandId` | 再送でも変わらない ID。`(mapId, commandId)` で一意 |
| `actor` | `{ kind: "human" \| "ai-agent" \| "system", id }` |
| `intent` | Command intent。監査用の分類。状態の遷移は `changes` だけで決まる |
| `provenance` | 発行元（画面の tab、MCP の context、上流の Command）。任意 |
| `changes` | レコード変更の一覧。順に適用する |

レコード変更 1 件:

| 項目 | 内容 |
|---|---|
| `kind` | レコード種別。下表 |
| `key` | 種別ごとの key（文字列の配列） |
| `op` | `create` / `update` / `delete` |
| `before` | 変更前の値。`update` は変えた field だけ、`delete` は全体、`create` は無し |
| `after` | 変更後の値。`update` は変えた field だけ、`create` は全体、`delete` は無し |

`before` が、この段での base revision の役を持つ。確定関数は、保存されている現在の値が `before` と等しいときだけ適用する（field 単位の比較）。等しくなければ、その Command 全体を拒否する。保存形式にレコードごとの revision が無いので、値の一致で代える。第 2 段でレコードに revision が付いたら、`before` の比較を revision の比較に置き換える。

レコード種別と、現在の保存形式での置き場:

| `kind` | `key` | 現在の置き場 | 備考 |
|---|---|---|---|
| `node` | `[nodeId]` | `nodes[id]` の、下の 2 種別を除く全 field | 型定義にない field も一つの field として運ぶ |
| `edge`（parent edge） | `[子の nodeId]` | `nodes[子].parentId` と、親の `children[]` の中の位置 | field は `parentId` と `index`。兄弟順キーは第 2 段 |
| `attribute` | `[持ち主の種別, 持ち主の ID, attribute の key]` | `nodes[id].attributes[k]`、`links[id].attributes[k]` | |
| `graph-link` | `[linkId]` | `links[id]` の、`attributes` を除く全 field | |
| `linear-text` | `[scope の key]` | `linearNotesByScope[k]` | |
| `scope-setting` | `[scope の key]` | `scopes[k]` | |
| `surface` | `[surfaceId]` | `surfaces[id]` の、`nodeViews` を除く全 field | |
| `surface-node-view` | `[surfaceId, nodeId]` | `surfaces[id].nodeViews[nodeId]` | |
| `annotation` | `[annotationId]` | `annotations` の 1 件 | 配列か連想かは現行の形に合わせる |
| `map-field` | `[field 名]` | 上記以外の top-level の field | 型定義にない key を含む |

parent edge のレコード（kind `edge`）の `index` は親の `children[]` の中の位置。同じ親の兄弟を並べ替える Command は、動いた子それぞれのこのレコードを `update` する。適用は「全 `delete` と全 `create` / `update` を反映した後の `children[]` が、`after.index` の昇順になる」ことで定義する。実装は、変更の対象になった親ごとに `children[]` を作り直してよい。

## 純粋な部品

`beta/src/shared/map_changes.ts`（入出力なし。画面とサーバの両方が使う）。

- `diffState(before, after): RecordChange[]`
- `applyChanges(state, changes): { ok: true, state } | { ok: false, conflicts }`。引数を書き換えない。
- `invertChanges(changes): RecordChange[]`

不変条件:

1. 忠実性: 任意の `before`・`after` について、`applyChanges(before, diffState(before, after))` の結果が `after` と深く等しい。型定義にない field、空の `attributes`、欠けた任意 field（`undefined` と「無い」の区別を含む）も保つ。object の key の順序は問わない。
2. 逆: `applyChanges(after, invertChanges(diffState(before, after)))` が `before` と深く等しい。
3. 競合: `current` が `before` と違う field を `changes` が触るとき、`applyChanges(current, changes)` は拒否し、どのレコードのどの field かを返す。触らない field の違いは通す。
4. 量: `diffState` の費用は node 数に比例してよいが、出力の大きさは変更したレコード数に比例する。node 20,001 件の map で node 1 件の text を変えた差分は、変更 1 件になる。

`src/cutover/` の部品は素材として使ってよい。使わない部品を残す必要はないが、この段では削除しない。

## 確定関数

`beta/src/node/map_commit.ts` の `commitMapCommand(dbPath, mapId, command)`。

- SQLite の 1 transaction（`BEGIN IMMEDIATE` 相当）で行う。
- 同じ `(mapId, commandId)` が記録済みなら、状態を変えずに、最初の確定の結果をそのまま返す。
- 現在の状態を読み、`applyChanges` を通し、既存の検査（`RapidMvpModel.fromJSON(...).validate()`）を通し、`state_json` と `saved_at` を書く。
- 確定した Command を `command_log` 表へ追記する。列: map ごとの通し番号、`commandId`、`actor`、`intent`、`provenance`、`changes`、確定時刻、確定後の `saved_at`。追記専用で、更新も削除もしない。
- 競合・検査の失敗では何も書かず、`commandId` も消費しない。
- 戻り値は、確定なら `{ ok: true, savedAt, seq, replayed }`、拒否なら `{ ok: false, code, conflicts, current }`。

`command_log` は表の追加だけで、`maps` 表は変えない。旧い実装はこの表を無視して動く。

確定関数を呼ぶのは同期の関数でよい（`better-sqlite3` は同期）。子プロセスは使わない。

## HTTP 経路

`POST /api/maps/:id/commands`。本文は Command 1 件。`X-M3E-Tab-Id` を既存の保存と同じに扱う。

- 確定: 200 `{ ok, savedAt, seq, mapId }`。既存の保存と同じ通知（`broadcastMapUpdate`）と、Vault 連携の後処理を行う。保存中の排他（`activeMapSaves`）と Vault の扱いは、既存の `POST /api/maps/:id` と同じにする。
- 競合: 409。本文は既存の `DOC_NODE_CONFLICT_Q` と同じ形（`code`、`state`、`savedAt`、`conflicts`）にし、画面の既存の競合 Panel がそのまま働くようにする。
- map が無い: 404。画面は既存の全体保存に切り替える。

## 画面の保存

`saveDocToLocalDb` は、`lastServerBaseState` から現在の状態への `diffState` を Command にして新しい経路へ送る。

- 変更が 0 件なら送らず、保存済みとして扱う。
- 成功時の後処理（`savedAt` の更新、`lastServerBaseState` の更新、他 tab への通知、collab・cloud の push、状態表示）は現状と同じにする。
- `force` のとき、`lastServerBaseState` が無いとき、404 のときは、既存の全体保存を使う。
- collab 参加中の分岐、読み取り専用、Grab 中の保留は現状のまま。
- 関数名 `saveDocToLocalDb`、`scheduleAutosave`、`currentDocSnapshot`、`cloneStateForSave`、`setStatus`、`updateLinearSaveStatus`、`showLocalSaveFailure`、`markLocalSaveSucceeded` は変えない（`tests/unit/autosave_status.test.ts` が名前で参照する）。
- `viewer.ts` の行数とトップレベルの `let` を増やさない。足す処理は別ファイルに置く。

## MCP

`M3eMcpService.mutate` は、読んだ状態と編集後の状態の `diffState` を Command にして、同じ確定関数を通す。既存の `expected_revision` の検査、`canWrite`、検査、通知はそのまま保つ。`m3e_create` / `m3e_update` / `m3e_delete` に任意の引数 `command_id` を足し、同じ `command_id` の再送は二重に適用せず、最初の結果を返す。

## 受入

Director が独立に実行して判定する。実装者は次のファイルを変更しない: `beta/tests/e2e/persistence_feel.spec.js`、本書。

1. `beta/tests/e2e/persistence_feel.spec.js` の 5 件が通る。変更前のコードでも 5 件通ることは確認済み。
2. 同じ検査の 20,001 node の map で、保存の往復の中央値が 121 ms 以下、編集から保存完了までの中央値が 2,500 ms 以下。変更前の実測は 90〜103 ms と約 2,000 ms（同じ端末、3 回）。
3. 同じ検査の 20,001 node の map で、node 1 件の text を変える保存の送信量が 10,000 バイト以下。変更前は 8,454,327 バイト。
4. 画面の保存が新しい経路を通っている。検査中の保存要求の宛先が `/api/maps/:id/commands` である。
5. 不変条件 1〜4 の単体テストがある。忠実性と逆は、`install/assets/seeds/core-seed.sqlite` の全 map を入力に含め、乱数で作った変更（node の追加・削除・改名・親変更・並べ替え、attribute、relation edge、linear-text、Surface View の配置値、型定義にない field）でも確かめる。
6. 確定関数の単体テストがある: 再送で二重に適用しない、競合で何も書かない、検査の失敗で何も書かない、`command_log` の通し番号が連続する、`command_log` の `changes` を空の初期状態から順に適用すると保存されている状態に一致する（その map がすべて Command で作られた場合）。
7. 既存の `npm test` が全部通る。新しい失敗、テストの削除、無断の skip が無い。
8. `npm run typecheck` と `npm run lint:deps` が通る。

## 実装で確定した点（2026-11-16）

- `commandId` は保存ごとに新しく発行する。変更の中身から導出しない（同じ編集をもう一度行うのは別の Command）。未確定のまま同じ変更を送り直すときだけ、同じ `commandId` を使う。
- MCP の `expected_revision` の検査は、確定関数の同じ transaction の中で行う。状態の書込みと `command_log` の追記を分けない。
- live の Vault に結び付いた map は、Markdown を先に書く順序を保つため、Command の経路では受けず（404、`LIVE_VAULT_WHOLE_SAVE`）、画面は既存の全体保存に切り替える。
- 受入検査 `persistence_feel.spec.js` は、保存要求として既存の経路と Command の経路の両方を数える。`M3E_FEEL_EXPECT_COMMANDS=1` で受入 2〜4 を検査する。
- 不変条件 1〜4 の判定は `beta/tests/unit/map_changes_invariants.test.ts`（Director 所有）で行う。入力を凍結し、乱数の編集と種データの全 map で往復を確かめる。
- 既知の制限: 確定の応答だけが失われ、その後に別の編集を重ねて保存すると、確定済みの変更と `before` が食い違って競合 Panel が出る。Use Local（全体保存）で進められる。

## 出荷記録（2026-11-16）

dev-beta `18e2b0a`。CI の Build & Test は success（1,231 件）。通常 Beta（Mac）は同日 12:50 にこの SHA から build して起動した。

| 項目 | 変更前 | 変更後 | 合格線 |
|---|---|---|---|
| 受入検査 5 件 | 5 件通過 | 5 件通過（3 回） | 全件 |
| 保存の往復の中央値（20,001 node） | 90〜103 ms | 55〜93 ms | 121 ms 以下 |
| 編集から保存完了までの中央値 | 約 2,000 ms | 約 1,000〜1,100 ms | 2,500 ms 以下 |
| 1 回の送信量（node 1 件の text 変更） | 8,454,327 バイト | 329 バイト | 10,000 バイト以下 |
| 保存の宛先 | `/api/maps/:id` | `/api/maps/:id/commands` | Command の経路 |

- 忠実性と逆は、個人の workspace の退避コピー（読み取り専用）でも確かめた。2026-11-11 の退避 51 map と、2026-11-16 の退避 69 map（最大 20,150 node）で、乱数の編集 25 件ずつの往復がすべて一致した。
- 実画面は、種データの複製を開いた隔離環境（port 4188）で、node の追加が Command の経路で保存され、再読込後も残ることを確かめた。
- 通常 Beta では、map の一覧（41 map）と研究 map（20,150 node）の表示、Command の経路の存在までを、書込みなしで確かめた。個人の map への最初の Command の確定は、利用者の次の編集で起きる。
- 通常 Beta の database には `command_log` 表ができている（追加のみ）。

## 第 2 段へ渡すもの

- `changes` はレコード単位なので、保存形式がレコードになっても Command の形は変わらない。変わるのは `before` の比較が revision の比較になる点と、parent edge のレコード（kind `edge`）の `index` が兄弟順キーになる点。
- `command_log` は端末内の journal の種。workspace × 書き手端末の stream への書き出しは第 2 段で扱う。

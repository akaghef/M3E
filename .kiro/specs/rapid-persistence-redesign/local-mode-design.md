# local モードの設計（多端末連携 v1）

sync-principles.md と sync-requirements.md の local 側を実装するための設計。remote 側（`/api/sync/push`・`pull`・`clone`）は実装済みで、これに対になる local を作る。

## 1. 範囲

- 含む：workspace 全体の clone、local commit と outbox、手動の push と pull、競合した Command の保全、workspace と世代の照合（fencing）、map 単位の操作（作成・削除・改名・列の変更）の同期、viewer の同期状態の表示と手動の Push / Pull。
- 含まない（次の段階）：scope 単位の部分複製と開示制御（R6.5〜R6.8）、保持期間切れの再 clone での前提の再照合（R6.9 のうち outbox の保全だけは行う）、自動同期。
- 端末はすべて akaghef の端末で、全 scope を持つ。

## 2. 役割と起動

- remote：今の server。`M3E_SYNC_REMOTE` を持たない。確定（seq の採番）は remote だけが行う。
- local：`M3E_SYNC_REMOTE=<remote の origin>` を持つ server。viewer・MCP からは今の server と同じに見える。
- local は自分で確定しない。local の seq（working store の commit 番号）は remote の seq と別物であり、remote の seq を偽造しない。

local の状態は端末の Neo4j に置く。confirmed と working store は同じ database の異なる `ws` である。

| 置き場 | 中身 |
|---|---|
| Neo4j の同期設定 | remote の origin、`workspaceId`、`historyId`、`epoch`、`confirmedSeq`、working store の基点 |
| Neo4j の confirmed 用 store | remote の確定系列の複製。seq は remote の seq |
| Neo4j の `Outbox` node | 未送信・結果不明の Command。working store の変更と同じ transaction で保存する |
| Neo4j の conflict の記録 | remote が conflict・reject を返した Command。消さずに保全する |
| Neo4j の working store | confirmed に outbox を載せた状態。viewer・MCP はここを読み書きする |

初回起動で同期設定が無ければ `GET /api/sync/clone` で remote の Neo4j の状態を受け取り、confirmed と working store を作る。clone payload は輸送の形式であり、別の snapshot ファイルを database として使わない。

## 3. local commit

- viewer・MCP の書込みは、working store に今までどおり commit する。
- 同じ Neo4j の write transaction で、その Command を `Outbox` node に保存する。entry は remote で compare-and-set（R7.1）できる形で持つ：
  - 内容の変更：`MapCommand`（`commandId`・`actor`・`intent`・`changes: RecordChange[]`、各 change は `before`/`after` を持つ）。`saveWholeMap` の差分（`diffState`）もこの形にする。
  - map 単位の操作：`{mapOp: "create" | "delete" | "rename" | "columns", ...}`。作成は初期内容を `changes` で運ぶ。
- parent edge の変更は、子の ID と `{parentId, ord}` の `before` / `after` を持つ。兄弟の index をずらす変更は作らない。working store と remote は、通常の移動・兄弟順を確定順の LWW とし、古い基点の outbox の移動も受ける。循環は拒否し、他の field は CAS、射影の書き戻しは位置も CAS とする。`index` 形式の既存 entry は読み取れ、受理した変更は順序キー形式で journal / outbox に書く。どちらの形で再送しても同じ Command と判定する。
- viewer の移動は、書込み位置で移動した node と前後の兄弟の順序キーを記録し、その parent edge だけを差分にする。新しい隣接 node にキーがなければ、その連続した範囲だけにキーを割り当てる。保存要求の作成・応答反映では、map の node 辞書と親の子配列を複製しない。応答待ちの間に行った次の移動は、先の応答で上書きしない。書込み範囲が不明な変更と全体置換は、完全な差分を使う。
- key 形式の構造変更は、変更した node と parent edge、scopen／unscopen に伴う scope とその参照先だけを射影する。scope をまたぐ部分木移動では、所属が変わる子孫の parent edge も更新するため、その部分木に比例する。入れ子の scope の内側で所属が変わらない parent edge は辿らない。surface・linear text・annotation の変換と、拒否・書込み失敗時の rollback は全体射影と同じ結果にする。近傍と保存の guard の索引は読み込み時に構成し、確定ごとに差分更新する。
- store が省く既定値・導出値は、viewer の値との比較時に同じ正規形で扱う。node、relation edge、scope、Surface View、parent edge の欄を production の field table と型定義から列挙し、viewer の前回の値を `before` にした create → update → delete を working store と remote で検証する。
- `before` と `after` が同じ update は `diffState` と Command builder で除く。変更が 0 件なら viewer / MCP は送信・確定を行わず、store に届いても journal と outbox に記録しない。
- entry は `baseSeq`（そのときの `confirmedSeq`）を持つ。
- `commandId` は local で作り、再送しても変えない（R4.2・R4.5）。

## 4. push（手動）

1. まだ送信対象にしていない同じ issuer の連続した Command を record ごとにまとめる。作成と削除は取り除き、更新は各欄の最初の `before` と最後の `after` にする。集約した Command には新しい `commandId` を振る。map の作成・削除・改名・列変更、map・issuer・actor・provenance・reason・confirm の違い、削除後の再作成は境界として元の順序を保つ。conflict・blocked は変更しない。集約後の outbox の entry を順に `POST /api/sync/push` へ送る。要求には `workspaceId`・`historyId`・`epoch` を付ける。
2. remote は、まず要求全体の照合（R6.2）を行い、食い違えば何も確定せず要求全体を拒否する。
3. 照合を通れば entry ごとに結果を返す（R6.3）：
   - `committed` / `no-op`（変更後の値と一致）：outbox から外す。内容は次の pull で confirmed に入る。
   - `conflict` / `rejected`：outbox から外し、Neo4j の conflict の記録 に理由と一緒に移す。黙って捨てない。
   - 通信断・結果不明：outbox に残す。同じ `commandId` で再送する（remote は重複を検出する）。
4. push の後に pull を行う。

outbox の新しい entry は `attempted: false` を持つ。各 push の全送信対象を最初の送信前に `attempted: true` として永続化する。途中で止まって未送信になった後続も保守的に集約対象から外す。欄がない既存 entry は送信履歴不明として集約しない。送信済み・結果不明の ID と内容は再送時にも変えない。この欄は transport に送らない。集約・送信対象の記録はNeo4j の write transaction で対象の `Outbox` node を更新するため、途中停止時に部分適用しない。処理対象は outbox の pending とその changes だけで、workspace は読まない。

集約自体は working store を書き換えない。集約後の停止で outbox の ID と working journal の ID が違っていても、基点と journal が有効なら変更された record だけを rebase する。

remote 側の追加：map 単位の操作（作成・削除・改名・列）を push で受け付ける。作成済みの map への create、存在しない map への変更は conflict として返す。

transport の実装では、同じ issuer が続く entry を JSON 本文（workspace と世代の照合情報を含む）4,000,000 byte までまとめ、それより大きい単一 Command は分割せず単独で送る。remote の非圧縮 JSON 本文の上限は 32,000,000 byte。上限超過は接続を破棄せず HTTP 413 `PUSH_BODY_TOO_LARGE` と `limitBytes` を返し、何も確定しない。request の `Content-Encoding` は未指定または `identity` のみを受け付ける。

proxy などが batch を 413 で拒否したときは、同じ push 内の batch の上限を縮め、単一 Command でも拒否されるかを確かめる。単独でも拒否されたら、outbox と後続の順序を保持し、同期状態に `push.state: "blocked"`・`code: "PUSH_COMMAND_TOO_LARGE"`・`commandId`・map 名・intent・理由・送信 byte 数・remote が返した上限を出す。状態は Neo4j の同期設定に保持し、接続確認が成功しても消さない。push は明示操作で再試行でき、対象 Command の結果が確定したら解除する。journal の記録内容は変えない。これは transport の実装上限であり、K10 の変更対象数・依存数などの未決事項を確定するものではない。

## 5. pull（手動）

1. `GET /api/sync/pull?after=<confirmedSeq>` に `workspaceId`・`historyId`・`epoch` を付けて要求する。応答も同じ三つを返し、local は食い違えば取り込まない。
2. 返った journal の行を seq の連続を確かめてから Neo4j の confirmed 用 store に transaction で保存・適用する（R5.4：確定時の変更をそのまま再生し、merge 規則で再判定しない）。
3. working store をその場で rebase する（[同期の思想](sync-principles.md)の「手間は変化分に比例させる」）。基点より後に pending が変えた record と、届いた行が変えた record だけを confirmed の値に戻し（`local-rebase` の変更を working store の Neo4j の transaction で保存する）、pending を順に commit し直す。載らない pending（前提が崩れたもの）は conflicts に移す。手間は届いた行と pending に比例し、workspace の大きさに依らない。届いた行が無く、pending も変わっていなければ何もしない。途中で失敗したら基点を消し、次の pull か起動で全体を作り直す。
4. viewer に map の更新を通知する（既存の watch / SSE）。
5. remote が `reclone` を返した場合（保持期間切れ）：outbox と conflicts を保ったまま clone し直し、Neo4j の別の `ws` に working store を全体から作り直して入れ替える（Δ が全体なので全体に比例してよい）。

起動時は、基点が working store の journal と outbox に合っていれば、working store をそのまま開き、止まっている間に届いた行だけを 3 と同じく rebase する。合わなければ（初回、作り直しの途中で止まった、など）全体から作り直す。

## 6. workspace と世代の照合（fencing）

- remote の store は `workspaceId`（既存）、`historyId`（store を作ったときに一度だけ生成）、`epoch`（remote を作り直したときに増やす。初期値 1）を持ち、Neo4j の `Head` node に記録し、clone / export の header にも渡す。既存の store で欠けていれば、開いたときに一度だけ生成して保存する。
- `/api/sync/clone`・`pull`・`push` の応答はこの三つを返す。`pull`・`push` の要求が三つを付けて来て一致しなければ 409 `FENCED` を返す。
- local は Neo4j の同期設定に clone 時の三つを保存し、以後すべての要求に付ける。食い違いの応答を受けたら同期を止め、状態に「同期を拒否された」と出す。

## 7. 同期状態（viewer）

- `GET /api/sync/local/status` → `{mode: "local", remote: {origin, state: "ok" | "unreachable" | "refused"}, push: {state: "idle"} | {state: "blocked", code, commandId, mapName, intent, reason, bytes, limitBytes?}, unsent, conflicts, confirmedSeq, lastPushAt, lastPullAt}`。remote モードの server は `{mode: "remote"}`。`push` は transport の状態で、接続状態と独立する。`commandId` は診断用であり GUI の通常表示には使わない。
- `POST /api/sync/local/push`・`POST /api/sync/local/pull` → 上の手順を実行し、結果の要約（送った件数、確定、conflict、取り込んだ行数）を返す。
- `GET /api/sync/local/conflicts` → 保全した entry の一覧（map 名・intent・理由・時刻）。
- viewer：toolbar に同期状態（接続状態・未送信件数・競合件数）と Push / Pull のボタン。表示に ID を出さない。
- 接続状態と未送信件数は独立に表示する（R1.1）。

## 8. 受入条件（判定は orchestrator が持つ）

remote 1 台と local 2 台（A・B）を別プロセス・別の Neo4jで動かして判定する。

| ID | 手順 | 合格 |
|---|---|---|
| AC1 | A・B を空の Neo4j から起動 | 両方が clone し、map 一覧と内容が remote と一致 |
| AC2 | A で node の text を変え、push | remote に確定、B の pull 後に B で見える。A の `unsent` は 0 |
| AC3 | A で編集し push しない | remote は変わらない（R6.1） |
| AC4 | remote を止めて A で編集、remote を戻して push | 確定する。止まっている間 A の状態は `unreachable`、`unsent` > 0 |
| AC5 | A・B が同じ node の text を別の値に変え、A→B の順に push | A は確定。B の entry は conflicts に残り、B の pull 後の表示は remote の値 |
| AC6 | A・B が別々の node を変え、両方 push・pull | 両方の変更が両端末と remote にある |
| AC7 | A で map を作成・別の map を削除、push、B で pull | B に作成が現れ、削除が消える |
| AC8 | A で編集後、push せずに A を再起動 | outbox が残り、再起動後の push で確定 |
| AC9 | 別の workspace（historyId が違う remote）に A の push・pull を向ける | 409 `FENCED`、何も確定・取り込みしない |
| AC10 | 全手順を通して | local の `confirmedSeq` は常に remote の seq のどれか。remote の journal に local 由来の重複確定がない |


## viewer の record 差分受信

server の map watch と `GET /api/maps/:mapId/records` は、[Map Write Protocol の wire 契約](../../../docs/protocols/map-write-protocol.md#viewer-の-record-差分受信)に従う。通常の保存、MCP の書込み、remote の sync push、working store の rebase を同じ journal の record key から通知する。rebase は `mapId` が空の内部 Command でも、変更前後の record の所属 map を使って通知する。

`revision` は store インスタンスと map の変更位置を表す opaque string、`seq` はその store の journal の通し番号である。working store と remote の seq は直接比較しない。再起動・reclone で store を置き換えると revision の世代が変わる。履歴が届かない場合は `409 FULL_READ_REQUIRED` を返し、viewer は同じ record 読取り口から全体を取得する。通常の差分受信は変更した record に比例し、workspace の全 map や journal を列挙しない。
